// Sesli asistan: konuşarak sorulur ve yönetilir, cevap cihazın Türkçe sesiyle okunur. Dava takibinin her ekranında (föyün
// içinde de) sağ altta mikrofon düğmesi durur. Söylenen cümle önce bu cihazda kurallarla anlaşılır (sesKomut, sesEk); föyler
// sunucuya gitmez. Kurallar anlayamazsa cümle kodlanır (föydeki adlar [AD-1], dosya no [NO-1], çalışanlar [KİŞİ-1]) ve yapay
// zekâya standart komuta çevirtilir; komutu yine cihaz çalıştırır. Yazan her komut sesli onay ister. Konuşma tanıma tarayıcının
// özelliğidir: cihazda tanıma varsa o kullanılır, yoksa tarayıcı sesi kendi hizmetine gönderir; ekranda belirtilir.
import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";
import { buroUyeleri } from "../data/buro";
import { call } from "../data/danisma";
import { bosFoy, Foy, foyKaydet } from "../data/foy";
import { turBilgi } from "../data/foyTurleri";
import type { SekmeAd, SesUye } from "../data/sesEk";
import { sesKodAc, sesKodla } from "../data/sesKod";
import { Baglam, BITIR, Cevap, Eylem, sesliKomut } from "../data/sesKomut";
import { t } from "../i18n";
import { s } from "./foyStil";
import { Btn } from "./kit";
import { sesliDur, sesliOku, useSesliOkuma } from "./sesliOku";
import { C } from "./theme";

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const SR = (): Any => (Platform.OS === "web" && typeof window !== "undefined" ? (window as Any).SpeechRecognition || (window as Any).webkitSpeechRecognition : null);
export const sesliAsistanVar = () => !!SR();

/** Cihazda (çevrim dışı) Türkçe tanıma var mı; gerekirse indirilir. */
async function yerelTanima(): Promise<boolean> {
  const R = SR();
  if (!R?.available) return false;
  try {
    const d = await R.available({ langs: ["tr-TR"], processLocally: true });
    if (d === "available") return true;
    if (d === "downloadable" || d === "downloading") return !!(await R.install({ langs: ["tr-TR"], processLocally: true }));
  } catch { /* desteklenmiyor */ }
  return false;
}

// Ekran değişince konuşma ve bağlam kaybolmasın: modül düzeyinde tutulur.
type Satir = { kim: "siz" | "celse"; metin: string };
const kalici: { konusma: Satir[]; bag: Baglam; acik: boolean } = { konusma: [], bag: {}, acik: false };

export interface AsistanProps {
  liste: Foy[]; onAc: (id: string) => void; onIsler: () => void; onEkran?: (ad: "tevkil" | "buro") => void; onSekme?: (ad: SekmeAd) => void;
  /** sağ altta yüzen düğme (yoksa kart) */
  yuzen?: boolean;
  /** açık föy (komutlarda "bu dosya") ve açık ekran */
  baglamFoyId?: string; ekran?: string;
}

export function SesliAsistan({ liste, onAc, onIsler, onEkran, onSekme, yuzen, baglamFoyId, ekran }: AsistanProps) {
  const [konusma, setKonusmaRaw] = useState<Satir[]>(kalici.konusma);
  const setKonusma = (f: (k: Satir[]) => Satir[]) => setKonusmaRaw(k => { const y = f(k).slice(-30); kalici.konusma = y; return y; });
  const [acik, setAcikRaw] = useState(kalici.acik);
  const setAcik = (v: boolean) => { kalici.acik = v; setAcikRaw(v); };
  const [dinliyor, setDinliyor] = useState(false);
  const [dusunuyor, setDusunuyor] = useState(false);
  const [ara, setAra] = useState("");
  const [yazi, setYazi] = useState("");
  const [surekli, setSurekli] = useState(() => { try { return globalThis.localStorage?.getItem("celse-ses-surekli") !== "0"; } catch { return true; } });
  // Sohbet modu: bir kez basılır; asistan her cevaptan sonra yeniden dinler. Sessizlikte de dinlemeyi sürdürür; yalnız avukat
  // "teşekkürler / görüşürüz / sus" deyince, durdurunca ya da pencereyi kapatınca biter (son söz avukatındır).
  const sohbetAcik = useRef(false);
  const sessiz = useRef(0);
  const [yerel, setYerel] = useState<boolean | null>(null);
  const yerelRef = useRef(false); yerelRef.current = !!yerel;
  const [hata, setHata] = useState("");
  const rec = useRef<Any>(null);
  const listeRef = useRef(liste); listeRef.current = liste;
  const uyeRef = useRef<{ uyeler: SesUye[]; ben?: string }>({ uyeler: [] });
  const okuyor = useSesliOkuma();
  const durumRef = useRef({ okuyor: false, dinliyor: false, dusunuyor: false });
  durumRef.current = { okuyor, dinliyor, dusunuyor };
  const onceOkuyordu = useRef(false);
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (!yuzen) yerelTanima().then(setYerel);
    buroUyeleri().then(x => { uyeRef.current = { uyeler: x.uyeler, ben: x.ben }; }).catch(() => {});
    return () => { try { rec.current?.abort(); } catch { /* yok say */ } };
  }, []);
  // Açık föy değişince "bu dosya" o föy olur.
  useEffect(() => { if (baglamFoyId) kalici.bag = { ...kalici.bag, foyId: baglamFoyId }; }, [baglamFoyId]);
  // Sürekli konuşma: cevap okunup bitince yeniden dinlenir.
  useEffect(() => {
    if (onceOkuyordu.current && !okuyor && surekli && sohbetAcik.current && (kalici.acik || !yuzen)) setTimeout(() => { if (sohbetAcik.current) dinle(); }, 350);
    onceOkuyordu.current = okuyor;
  }, [okuyor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cevap sesli okunamadıysa (cihazda ses yok) sohbet modunda yine de yeniden dinlenir.
  useEffect(() => {
    if (konusma[konusma.length - 1]?.kim !== "celse") return;
    const z = setTimeout(() => {
      const d = durumRef.current;
      const ws = Platform.OS === "web" && typeof window !== "undefined" ? (window as Any).speechSynthesis : null;
      if (ws && (ws.speaking || ws.pending)) return;
      if (!d.okuyor && !d.dinliyor && !d.dusunuyor && surekli && sohbetAcik.current && (kalici.acik || !yuzen)) dinle();
    }, 3500);
    return () => clearTimeout(z);
  }, [konusma]); // eslint-disable-line react-hooks/exhaustive-deps

  const uygula = async (e: Eylem) => {
    if (e.tip === "yeniDava") {
      await foyKaydet(bosFoy({ ...e.foy, notlar: "Sesli asistanla kaydedildi; dava henüz açılmadı.", gorevler: [e.gorev] }));
      return;
    }
    if (e.tip === "yzSor") {
      const hedef = listeRef.current.find(x => x.id === e.foyId);
      if (!hedef) return;
      setDusunuyor(true);
      const { foyaSor } = await import("./foySorCagri");
      const r = await foyaSor(hedef, e.soru);
      setDusunuyor(false);
      const metin = r.ok ? r.yeni.cevap : t(r.hata, r.vars);
      if (r.ok) await foyKaydet({ ...hedef, yzSohbet: [...(hedef.yzSohbet || []), r.yeni].slice(-30) });
      setKonusma(k => [...k, { kim: "celse" as const, metin }]);
      const { okunacak } = await import("../data/yzCevap");
      sesliOku(r.ok ? okunacak(metin) : metin, 1.05);
      return;
    }
    if (e.tip === "buroSor") { await genelSor(e.soru); return; }
    if (e.tip === "sekme") { setTimeout(() => onSekme?.(e.ad), 900); return; }
    if (e.tip === "isler") { setTimeout(() => (onSekme ? onSekme("isler") : onIsler()), 900); return; }
    if (e.tip === "ekran") { setTimeout(() => (onSekme ? onSekme(e.ad) : onEkran?.(e.ad)), 900); return; }
    const f = listeRef.current.find(x => x.id === e.foyId);
    if (e.tip === "ac") { setTimeout(() => onAc(e.foyId), 1200); return; }
    if (!f) return;
    if (e.tip === "ekle") await foyKaydet({ ...f, gorevler: [...f.gorevler, e.gorev] });
    if (e.tip === "kapat") await foyKaydet({ ...f, gorevler: f.gorevler.map(g => (g.id === e.gorevId ? { ...g, bitti: true, kapanis: e.kapanis } : g)) });
    if (e.tip === "durusma") await foyKaydet({ ...f, durusmalar: (f.durusmalar || []).map(d => (d.id === e.durusmaId ? { ...d, ...e.ek } : d)) });
    if (e.tip === "kalem") await foyKaydet({ ...f, hesap: { ...(f.hesap || {}), kalemler: [...(f.hesap?.kalemler || []), e.kalem] } });
    if (e.tip === "foyYaz") {
      await foyKaydet({ ...f, ...e.ek });
      const g = e.diger ? listeRef.current.find(x => x.id === e.diger!.foyId) : undefined;
      if (g && e.diger) await foyKaydet({ ...g, ...e.diger.ek });
    }
  };

  /** Bütün dosyalar hakkında serbest soru (danisma genel_sor); cevap okunur. */
  const genelSor = async (soru: string) => {
    setDusunuyor(true);
    try {
      const { buroyaSor } = await import("./buroSoru");
      const r = await buroyaSor(listeRef.current, soru);
      const metin = r.ok ? r.cevap : t(r.hata, r.vars);
      setKonusma(k => [...k, { kim: "celse" as const, metin }]);
      const { okunacak } = await import("../data/yzCevap");
      sesliOku(r.ok ? okunacak(metin) : metin, 1.05);
    } finally { setDusunuyor(false); }
  };

  const yerelAnla = (x: string): Cevap => sesliKomut(x, listeRef.current, kalici.bag, undefined, uyeRef.current);
  const sonuc = (r: Cevap, sesli = true) => {
    kalici.bag = r.baglam;
    setKonusma(k => [...k, { kim: "celse" as const, metin: r.metin }]);
    if (r.eylem) uygula(r.eylem).catch(err => setHata(String((err as Error).message || err)));
    if (sesli) sesliOku(r.metin, 1.05);
  };

  /** Söyleneni işler. Tanımanın verdiği seçeneklerden ilk anlaşılanı alınır; hiçbiri anlaşılmazsa yapay zekâya yorumlatılır. */
  const isle = async (secenekler: string[]) => {
    const xs = secenekler.map(x => x.trim()).filter(Boolean);
    if (!xs.length) return;
    setKonusma(k => [...k, { kim: "siz" as const, metin: xs[0] }]);
    sessiz.current = 0;
    if (BITIR.test(xs[0].toLocaleLowerCase("tr").trim().replace(/[.!?]+$/, ""))) {
      sohbetAcik.current = false;
      // Son söz avukatındır: asistan konuşmaz, yalnız ekrana yazar.
      setHata(t("Sohbet bitti. Yeniden konuşmak için mikrofona basın."));
      return;
    }
    let ilk: Cevap | null = null;
    for (const x of xs) {
      const r = yerelAnla(x);
      if (!r.anlasilmadi) { sonuc(r); return; }
      ilk = ilk || r;
    }
    // Yapay zekâ yorumlayamazsa kuralların ilk cevabı (ör. dosyanın durumu) okunur.
    const yedek = (m: string) => sonuc(ilk && !/^Anlayamadım/.test(ilk.metin) ? ilk : { metin: m, baglam: kalici.bag });
    // Yapay zekâ yorumu: adlar ve numaralar kodlu gider.
    setDusunuyor(true);
    try {
      const kod = sesKodla(xs[0], listeRef.current, uyeRef.current.uyeler.map(u => u.ad));
      const acikFoy = kalici.bag.foyId ? listeRef.current.find(f => f.id === kalici.bag.foyId) : undefined;
      const r = await call<{ komutlar: string[]; cevap?: string }>("ses_anla", { soz: kod.kodlu, ekran: ekran || "", foy: acikFoy ? `${turBilgi(acikFoy.tur).ad}${acikFoy.asama ? ", aşama " + acikFoy.asama : ""}` : "" }, 30000);
      if (!r.ok) { if (ilk && !/^Anlayamadım/.test(ilk.metin)) yedek(""); else { setDusunuyor(false); await genelSor(xs[0]); } return; }
      const komutlar = (r.data.komutlar || []).map(k => sesKodAc(k, kod.harita));
      // Hiçbir komuta uymayan cümle bütün dosyalar hakkında serbest soru sayılır.
      if (!komutlar.length) { setDusunuyor(false); await genelSor(xs[0]); return; }
      const metinler: string[] = [];
      for (const k of komutlar) {
        const c = yerelAnla(k);
        kalici.bag = c.baglam;
        metinler.push(c.anlasilmadi ? t("Anlayamadım.") : c.metin);
        if (c.eylem) await uygula(c.eylem).catch(err => setHata(String((err as Error).message || err)));
        if (c.baglam.bekleyen) break; // onay bekleyen komuttan sonra durulur
      }
      const metin = metinler.join(" ");
      setKonusma(k => [...k, { kim: "celse" as const, metin }]);
      sesliOku(metin, 1.05);
    } finally { setDusunuyor(false); }
  };

  async function dinle() {
    const R = SR();
    if (!R) return;
    // Cihazda tanıma yalnız mikrofona ilk basılınca denetlenir (gerekirse dil paketi o an, kullanıcının isteğiyle indirilir).
    if (yerel === null && yuzen) { const v = await yerelTanima(); setYerel(v); yerelRef.current = v; }
    sesliDur(); setHata(""); setAra("");
    try { rec.current?.abort(); } catch { /* yok say */ }
    const r = new R();
    r.lang = "tr-TR"; r.interimResults = true; r.continuous = false; r.maxAlternatives = 3;
    if (yerelRef.current) r.processLocally = true;
    let son = "";
    let alternatifler: string[] = [];
    r.onresult = (e: Any) => {
      let ara2 = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          son += e.results[i][0].transcript;
          alternatifler = Array.from({ length: e.results[i].length || 1 }, (_, j) => e.results[i][j]?.transcript || "").filter(Boolean);
        } else ara2 += e.results[i][0].transcript;
      }
      setAra(son + ara2);
    };
    r.onerror = (e: Any) => {
      setDinliyor(false);
      const k = e?.error;
      // Sohbet modunda sessizlik sohbeti bitirmez: avukat kapatana ya da "teşekkürler" diyene kadar dinlemeye devam edilir.
      if (k === "no-speech" && surekli && sohbetAcik.current) { sessiz.current++; setTimeout(() => { if (sohbetAcik.current && (kalici.acik || !yuzen)) dinle(); }, 300); return; }
      if (k === "not-allowed" || k === "service-not-allowed") sohbetAcik.current = false;
      if (k === "not-allowed" || k === "service-not-allowed") setHata(t("Mikrofon izni verilmedi. Adres çubuğundaki kilit simgesinden mikrofona izin verin."));
      else if (k === "no-speech") setHata(t("Ses duyulmadı. Mikrofona basıp tekrar konuşun."));
      else if (k === "network") setHata(t("Konuşma tanıma hizmetine ulaşılamadı (internet)."));
      else if (k !== "aborted") setHata(t("Konuşma tanıma hatası: {k}", { k: String(k) }));
    };
    r.onend = () => {
      setDinliyor(false); setAra("");
      if (son.trim()) isle(alternatifler.length > 1 && son.trim() === alternatifler[0].trim() ? alternatifler : [son]);
    };
    rec.current = r;
    sohbetAcik.current = true;
    try { r.start(); setDinliyor(true); } catch (err) { setHata(String((err as Error).message || err)); }
  }
  const durdur = () => { sohbetAcik.current = false; try { rec.current?.stop(); } catch { /* yok say */ } };
  const yaziGonder = () => { if (yazi.trim()) { isle([yazi]); setYazi(""); } };
  const durum = dinliyor ? t("Dinliyorum…") : dusunuyor ? t("Düşünüyorum…") : okuyor ? t("Cevap okunuyor…") : t("Mikrofona basıp konuşun");

  const mikrofon = (boy: number) => (
    <Pressable accessibilityRole="button" accessibilityLabel={dinliyor ? t("Dinlemeyi durdur") : t("Konuş")} onPress={dinliyor ? durdur : dinle} disabled={!SR()}
      style={{ width: boy, height: boy, borderRadius: boy / 2, alignItems: "center", justifyContent: "center", backgroundColor: dinliyor ? C.bad : C.bordo, borderWidth: 2, borderColor: dinliyor ? "#fff" : C.brassDim, opacity: SR() ? 1 : 0.5 }}>
      <Text style={{ fontSize: boy * 0.42 }}>{dinliyor ? "⏹" : "🎙"}</Text>
    </Pressable>
  );
  const icerik = (
    <>
      <View style={[s.row, { alignItems: "center" }]}>
        {mikrofon(yuzen ? 52 : 64)}
        <View style={{ flex: 1, minWidth: 160, gap: 2 }}>
          <Text style={[s.body, { color: C.text }]}>{durum}</Text>
          <Text style={s.hint} numberOfLines={2}>{ara || t("Örn. “bugün ne var”, “bu dosyanın aşamasını bilirkişi yap”, “Yılmaz dosyasına 12 Aralık saat 10:30 duruşma ekle”, “yardım”")}</Text>
        </View>
        {okuyor && <Btn kind="ghost" label={t("Sesi kes")} onPress={sesliDur} />}
        {yuzen && <Pressable onPress={() => { durdur(); sesliDur(); setAcik(false); }} accessibilityLabel={t("Kapat")} hitSlop={10}><Text style={{ color: C.textSoft, fontSize: 22 }}>×</Text></Pressable>}
      </View>
      {!SR() && <Text style={s.hint}>{t("Bu tarayıcıda konuşma tanıma yok (Chrome ya da Edge'de çalışır). Aşağıya yazarak da komut verebilirsiniz.")}</Text>}
      {!!hata && <Text style={[s.hint, { color: C.bad }]}>{hata}</Text>}
      <ScrollView style={{ maxHeight: yuzen ? 260 : undefined }} contentContainerStyle={{ gap: 6 }}>
        {konusma.slice(yuzen ? -8 : -30).map((x, i) => (
          <Text key={i} style={[s.body, x.kim === "celse" ? { color: C.text } : { color: C.muted }]}>{x.kim === "siz" ? "🗣 " : "⚖ "}{x.metin}</Text>
        ))}
      </ScrollView>
      <TextInput value={yazi} onChangeText={setYazi} onSubmitEditing={yaziGonder} enterKeyHint="send" returnKeyType="send" blurOnSubmit={false}
        placeholder={t("Yazarak da komut verin, Enter ile gönderin")} placeholderTextColor={C.muted} style={s.inputTek} />
      <Pressable onPress={() => { const y = !surekli; setSurekli(y); try { globalThis.localStorage?.setItem("celse-ses-surekli", y ? "1" : "0"); } catch { /* yok say */ } }} style={[s.row, { alignItems: "center" }]} accessibilityRole="checkbox" accessibilityState={{ checked: surekli }}>
        <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: C.brassDim, backgroundColor: surekli ? C.brassDim : "transparent" }} />
        <Text style={s.hint}>{t("Sohbet modu: bir kez basın; cevaptan sonra yeniden dinler. Bitirmek için “teşekkürler” ya da “görüşürüz” deyin.")}</Text>
      </Pressable>
      <Text style={[s.hint, { fontSize: 11 }]}>{yerel
        ? t("Konuşmanız bu cihazda yazıya çevrilir. Anlaşılmayan cümle yapay zekâya adlar ve numaralar kodlanarak gider.")
        : t("Sesiniz yazıya çevrilmek için tarayıcının hizmetine (Chrome'da Google) gider. Anlaşılmayan cümle yapay zekâya föydeki adlar ve numaralar kodlanarak gider; föyde olmayan bir ad söylerseniz o ad gidebilir.")}</Text>
    </>
  );

  if (!yuzen) return <View style={[s.card, { gap: 10 }]}>{icerik}</View>;
  const genislik = Math.min(440, width - 24);
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", right: 12, bottom: 84, alignItems: "flex-end", gap: 10, zIndex: 50 }}>
      {acik && (
        <View style={[s.card, { width: genislik, gap: 8, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 18, borderColor: C.brassDim }]}>{icerik}</View>
      )}
      {!acik && (
        <Pressable onPress={() => { setAcik(true); if (SR()) dinle(); }} accessibilityRole="button" accessibilityLabel={t("Sesli asistan")}
          style={{ width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", backgroundColor: C.bordo, borderWidth: 2, borderColor: C.brass, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 12 }}>
          <Text style={{ fontSize: 26 }}>🎙</Text>
        </Pressable>
      )}
    </View>
  );
}
