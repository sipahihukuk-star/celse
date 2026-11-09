// Sesli asistan: konuşarak sorulur, cevap cihazın Türkçe sesiyle okunur. Söylenen cümle bu cihazda (sesKomut) anlaşılır;
// föyler sunucuya gitmez. Konuşma tanıma tarayıcının özelliğidir: cihazda tanıma varsa o kullanılır, yoksa tarayıcı sesi
// kendi hizmetine (Chrome'da Google) gönderip yazıya çevirir; ekranda bu belirtilir. İş ekleme ve kapatma sesli onayla yapılır.
import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { bosFoy, Foy, foyKaydet } from "../data/foy";
import { Baglam, Eylem, sesliKomut } from "../data/sesKomut";
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

export function SesliAsistan({ liste, onAc, onIsler, onEkran }: { liste: Foy[]; onAc: (id: string) => void; onIsler: () => void; onEkran?: (ad: "tevkil" | "buro") => void }) {
  const [konusma, setKonusma] = useState<{ kim: "siz" | "celse"; metin: string }[]>([]);
  const [dinliyor, setDinliyor] = useState(false);
  const [ara, setAra] = useState("");
  const [yazi, setYazi] = useState("");
  const [surekli, setSurekli] = useState(() => { try { return globalThis.localStorage?.getItem("celse-ses-surekli") === "1"; } catch { return false; } });
  const [yerel, setYerel] = useState<boolean | null>(null);
  const yerelRef = useRef(false); yerelRef.current = !!yerel;
  const [hata, setHata] = useState("");
  const bag = useRef<Baglam>({});
  const rec = useRef<Any>(null);
  const listeRef = useRef(liste); listeRef.current = liste;
  const okuyor = useSesliOkuma();
  const onceOkuyordu = useRef(false);

  useEffect(() => { yerelTanima().then(setYerel); return () => { try { rec.current?.abort(); } catch { /* yok say */ } }; }, []);
  // Sürekli konuşma: cevap okunup bitince yeniden dinlenir.
  useEffect(() => {
    if (onceOkuyordu.current && !okuyor && surekli) dinle();
    onceOkuyordu.current = okuyor;
  }, [okuyor]); // eslint-disable-line react-hooks/exhaustive-deps

  const uygula = async (e: Eylem) => {
    if (e.tip === "yeniDava") {
      const yeni = bosFoy({ ...e.foy, notlar: "Sesli asistanla kaydedildi; dava henüz açılmadı.", gorevler: [e.gorev] });
      await foyKaydet(yeni);
      return;
    }
    const f = listeRef.current.find(x => x.id === (e.tip === "isler" || e.tip === "ekran" ? "" : e.foyId));
    if (e.tip === "ekle" && f) await foyKaydet({ ...f, gorevler: [...f.gorevler, e.gorev] });
    if (e.tip === "kapat" && f) await foyKaydet({ ...f, gorevler: f.gorevler.map(g => (g.id === e.gorevId ? { ...g, bitti: true, kapanis: e.kapanis } : g)) });
    if (e.tip === "ac") setTimeout(() => onAc(e.foyId), 1800);
    if (e.tip === "isler") setTimeout(onIsler, 1200);
    if (e.tip === "durusma" && f) await foyKaydet({ ...f, durusmalar: (f.durusmalar || []).map(d => (d.id === e.durusmaId ? { ...d, ...e.ek } : d)) });
    if (e.tip === "kalem" && f) await foyKaydet({ ...f, hesap: { ...(f.hesap || {}), kalemler: [...(f.hesap?.kalemler || []), e.kalem] } });
    if (e.tip === "ekran") setTimeout(() => onEkran?.(e.ad), 1200);
  };

  const isle = (soz: string) => {
    const x = soz.trim();
    if (!x) return;
    const r = sesliKomut(x, listeRef.current, bag.current);
    bag.current = r.baglam;
    setKonusma(k => [...k, { kim: "siz" as const, metin: x }, { kim: "celse" as const, metin: r.metin }].slice(-20));
    if (r.eylem) uygula(r.eylem).catch(err => setHata(String((err as Error).message || err)));
    sesliOku(r.metin, 1.05);
  };

  function dinle() {
    const R = SR();
    if (!R) return;
    sesliDur(); setHata(""); setAra("");
    try { rec.current?.abort(); } catch { /* yok say */ }
    const r = new R();
    r.lang = "tr-TR"; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    if (yerelRef.current) r.processLocally = true;
    let son = "";
    r.onresult = (e: Any) => {
      let ara2 = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) son += e.results[i][0].transcript; else ara2 += e.results[i][0].transcript;
      }
      setAra(son + ara2);
    };
    r.onerror = (e: Any) => {
      setDinliyor(false);
      const k = e?.error;
      if (k === "not-allowed" || k === "service-not-allowed") setHata(t("Mikrofon izni verilmedi. Adres çubuğundaki kilit simgesinden mikrofona izin verin."));
      else if (k === "no-speech") setHata(t("Ses duyulmadı. Mikrofona basıp tekrar konuşun."));
      else if (k === "network") setHata(t("Konuşma tanıma hizmetine ulaşılamadı (internet)."));
      else if (k !== "aborted") setHata(t("Konuşma tanıma hatası: {k}", { k: String(k) }));
    };
    r.onend = () => { setDinliyor(false); setAra(""); if (son.trim()) isle(son); };
    rec.current = r;
    try { r.start(); setDinliyor(true); } catch (err) { setHata(String((err as Error).message || err)); }
  }
  const durdur = () => { try { rec.current?.stop(); } catch { /* yok say */ } };

  if (!SR()) return (
    <View style={s.card}><Text style={s.hint}>{t("Bu tarayıcıda konuşma tanıma yok. Chrome ya da Edge ile açın. Aşağıya yazarak da sorabilirsiniz.")}</Text>
      <TextInput value={yazi} onChangeText={setYazi} onSubmitEditing={() => { isle(yazi); setYazi(""); }} placeholder={t("Örn. bugün ne var")} placeholderTextColor={C.muted} style={s.inputTek} />
      {konusma.slice(-2).map((x, i) => <Text key={i} style={[s.body, x.kim === "celse" && { color: C.text }]}>{x.kim === "siz" ? "🗣 " : "⚖ "}{x.metin}</Text>)}
    </View>
  );

  return (
    <View style={[s.card, { gap: 10 }]}>
      <View style={[s.row, { alignItems: "center" }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={dinliyor ? t("Dinlemeyi durdur") : t("Konuş")} onPress={dinliyor ? durdur : dinle}
          style={{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: dinliyor ? C.bad : C.bordo, borderWidth: 2, borderColor: dinliyor ? "#fff" : C.brassDim }}>
          <Text style={{ fontSize: 28 }}>{dinliyor ? "⏹" : "🎙"}</Text>
        </Pressable>
        <View style={{ flex: 1, minWidth: 200, gap: 2 }}>
          <Text style={[s.body, { color: C.text }]}>{dinliyor ? t("Dinliyorum…") : okuyor ? t("Cevap okunuyor…") : t("Mikrofona basıp konuşun")}</Text>
          <Text style={s.hint}>{ara || t("Örn. “bugün ne var”, “Yılmaz dosyası ne durumda”, “bu hafta duruşmalar”, “yardım”")}</Text>
        </View>
        {okuyor && <Btn kind="ghost" label={t("Sesi kes")} onPress={sesliDur} />}
      </View>
      <Pressable onPress={() => { const y = !surekli; setSurekli(y); try { globalThis.localStorage?.setItem("celse-ses-surekli", y ? "1" : "0"); } catch { /* yok say */ } }} style={[s.row, { alignItems: "center" }]} accessibilityRole="checkbox" accessibilityState={{ checked: surekli }}>
        <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: C.brassDim, backgroundColor: surekli ? C.brassDim : "transparent" }} />
        <Text style={s.hint}>{t("Sürekli konuşma: cevap bitince yeniden dinlesin (“vazgeç” ya da ⏹ ile durur)")}</Text>
      </Pressable>
      {!!hata && <Text style={[s.hint, { color: C.bad }]}>{hata}</Text>}
      {konusma.map((x, i) => (
        <Text key={i} style={[s.body, x.kim === "celse" ? { color: C.text } : { color: C.muted }]}>{x.kim === "siz" ? "🗣 " : "⚖ "}{x.metin}</Text>
      ))}
      <TextInput value={yazi} onChangeText={setYazi} onSubmitEditing={() => { isle(yazi); setYazi(""); }} placeholder={t("İsterseniz yazarak da sorun, Enter'a basın")} placeholderTextColor={C.muted} style={s.inputTek} />
      <Text style={s.hint}>{yerel
        ? t("Konuşmanız bu cihazda yazıya çevriliyor; sunucuya gitmiyor. Cevap cihazın sesiyle okunur.")
        : t("Dikkat: bu tarayıcıda cihazda tanıma yok; sesiniz yazıya çevrilmek için tarayıcının hizmetine (Chrome'da Google, Edge'de Microsoft) gider. Föyleriniz gitmez; yalnız söylediğiniz cümle gider. Müvekkil adı yerine dosya numarasıyla sorabilirsiniz.")}</Text>
    </View>
  );
}
