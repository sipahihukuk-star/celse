// Dava takibi: föy listesi (türe göre), yeni giriş menüsü (dava, suç duyurusu, arabuluculuk, idari başvuru, icra, sözleşme…),
// yaklaşan duruşma ve işler, kilitli özel dosyalar, DavaTek klasörü, Excel/Word'den toplu föy, yedek.
// Her şey bu cihazda (src/data/foy.ts); yapay zekâya yalnız kodlanmış metin gider. Föy sayfası: FoySayfa.tsx.
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { bosFoy, Foy, foyBaslik, foyDinle, foyKaydet, foyler as foyListesi, foylerKaydet, kacGun, ozelAc, ozelKilitDurumu, ozelKilitKur, ozelKilitle, tarihYaz, yedekMetni, yedektenYukle } from "../data/foy";
import { AktarimSonucu, birlestir, tabloOku, tablodanFoyler } from "../data/foyAktar";
import { turDuzeltmeleri } from "../data/dosyaListesi";
import { DAVA_TURLERI, FoyTur, Giris, GIRISLER, turBilgi, TURLER } from "../data/foyTurleri";
import { useInnerBack } from "./innerBack";
import { FoySayfa } from "./FoySayfa";
import { evrakOlustur } from "./foyEvrak";
import { gorulduYaz, klasorBilgisi, klasorDestekli, klasorSec, klasorTara, TaramaDosyasi } from "./foyKlasor";
import { dosyaSec, gunYaz, indir, s } from "./foyStil";
import { FoyBulutKart } from "./FoyBulutKart";
import { FloatingNav, useFloatingNav } from "./FloatingNav";
import { IliskiKart } from "./IliskiKart";
import { EvrakHavuzu } from "./EvrakHavuzu";
import { Acilir } from "./Acilir";
import { Katlanir } from "./Katlanir";
import { DavaListesi } from "./DavaListesi";
import { gunlukBildirim, IsTakibi } from "./IsTakibi";
import { SesliAsistan } from "./SesliAsistan";
import { duzeySayilari } from "../data/isTakibi";
import { DUZEY_RENK } from "./GorevKapat";
import { Btn } from "./kit";
import { t } from "../i18n";
import { C } from "./theme";

type Secili = { id: string; ekle?: string };

export default function FoyScreen(p: { onBack: () => void; onHazirlan: (f: Foy) => void; ucretsiz?: boolean }) {
  const [liste, setListe] = useState<Foy[]>([]);
  const [yuklendi, setYuklendi] = useState(false);
  const [secili, setSecili] = useState<Secili | null>(null);
  const [aktar, setAktar] = useState(false);
  const [havuz, setHavuz] = useState<false | true | Foy>(false);
  const [rapor, setRapor] = useState(false);
  const [isler, setIsler] = useState(false);
  const [ses, setSes] = useState(false);
  // "sahsi": şahsi dosyalar bölümünden açılan giriş (yeni föy şahsi ve şifreli olur).
  const [giris, setGiris] = useState<false | "normal" | "sahsi">(false);
  const [ara, setAra] = useState("");
  const [filtre, setFiltre] = useState<"acik" | "kapali" | "hepsi">("acik");
  const [turF, setTurF] = useState<FoyTur | "hepsi">("hepsi");
  // Yalnız evrakı olan föyler (listeden gelen binlerce boş föy arasında evrak yüklenmiş olanları bulmak için).
  const [evrakli, setEvrakli] = useState(false);
  // Türün altında açılan alt süzgeçler: hangi dava (dava türü) ve aşama; "" = belirtilmemiş, null = hepsi.
  const [davaF, setDavaF] = useState<string | null>(null);
  const [asamaF, setAsamaF] = useState<string | null>(null);
  const [turDuzelt, setTurDuzelt] = useState("");
  const [mesaj, setMesaj] = useState<{ t: string; ok?: boolean } | null>(null);
  const [kilit, setKilit] = useState<"yok" | "kilitli" | "acik">("yok");
  // Föy listesi sayfa sayfa: 5, 10, 25, 50, 100 (tercih bu cihazda hatırlanır).
  const [sayfa, setSayfa] = useState(0);
  const [boy, setBoyRaw] = useState<number>(() => { try { const v = Number(globalThis.localStorage?.getItem("celse-foy-sayfa")); return [5, 10, 25, 50, 100].includes(v) ? v : 25; } catch { return 25; } });
  const setBoy = (n: number) => { setBoyRaw(n); setSayfa(0); try { globalThis.localStorage?.setItem("celse-foy-sayfa", String(n)); } catch { /* yok say */ } };
  const nav = useFloatingNav();
  const [sirala, setSiralaRaw] = useState<"durusma" | "acilisYeni" | "acilisEski" | "degisim">(() => { try { const v = globalThis.localStorage?.getItem("celse-foy-sirala"); return v === "acilisYeni" || v === "acilisEski" || v === "degisim" ? v : "durusma"; } catch { return "durusma"; } });
  const setSirala = (v: typeof sirala) => { setSiralaRaw(v); setSayfa(0); try { globalThis.localStorage?.setItem("celse-foy-sirala", v); } catch { /* yok say */ } };
  useEffect(() => { setSayfa(0); }, [ara, filtre, turF, davaF, asamaF]);
  useEffect(() => { setDavaF(null); setAsamaF(null); }, [turF]);
  const [kilitSor, setKilitSor] = useState<null | { sonra?: () => void }>(null);
  const yenile = () => {
    foyListesi().then(x => { setListe(x); setYuklendi(true); gunlukBildirim(x); }).catch(() => setYuklendi(true));
    ozelKilitDurumu().then(setKilit).catch(() => {});
  };
  useEffect(() => { yenile(); return foyDinle(yenile); }, []);
  // Dava takibinden çıkınca şahsi dosyalar kilitlenir (bilgisayarı başkası kullanırsa görünmesin).
  useEffect(() => () => { ozelKilitle(); }, []);
  useInnerBack(!!secili || aktar || !!havuz || !!giris || !!kilitSor || rapor || isler, () => { if (secili && (rapor || isler)) { setSecili(null); return; } setSecili(null); setAktar(false); setHavuz(false); setGiris(false); setKilitSor(null); setRapor(false); setIsler(false); });

  // Telefonda: föyler uygulamanın deposunda; evrak ekleme, toplu aktarma, DavaTek klasörü ve yedek dosyası bilgisayardadır.
  const web = Platform.OS === "web";
  if (kilitSor) return <OzelKilit durum={kilit} onKapat={() => setKilitSor(null)} onAcildi={() => { const f = kilitSor.sonra; setKilitSor(null); yenile(); f?.(); }} />;
  if (isler && !secili) return <IsTakibi liste={liste} onAc={id => setSecili({ id })} onKapat={() => setIsler(false)} />;
  if (rapor && !secili) return <DavaListesi liste={liste} onAc={id => setSecili({ id })} onKapat={() => setRapor(false)} />;
  if (havuz) return <EvrakHavuzu liste={liste.filter(f => !f.ozel || (havuz !== true && f.id === havuz.id))} kaynakFoy={havuz === true ? undefined : havuz} onBitti={m => { setHavuz(false); if (m) setMesaj({ t: m, ok: true }); yenile(); }} />;
  if (aktar) return <Aktar mevcut={liste} onBitti={(n) => { setAktar(false); if (n) setMesaj({ t: n, ok: true }); }} />;
  if (secili) return <FoySayfa key={secili.id} id={secili.id} ekle={secili.ekle} liste={liste} onKapat={() => setSecili(null)} onAc={id => setSecili({ id })} onHazirlan={p.onHazirlan} ucretsiz={p.ucretsiz} onAyir={f => { setSecili(null); setHavuz(f); }} />;

  const yeniFoy = async (tur: FoyTur, ek: { ozel?: boolean; davaTuru?: string } = {}) => {
    const olustur = async () => { const f = bosFoy({ tur, ozel: !!ek.ozel, davaTuru: ek.davaTuru || "" }); await foyKaydet(f); setGiris(false); setSecili({ id: f.id }); };
    if (ek.ozel && (await ozelKilitDurumu()) !== "acik") { setKilitSor({ sonra: olustur }); return; }
    await olustur();
  };
  if (giris) return <GirisMenu liste={giris === "sahsi" ? liste.filter(f => f.ozel) : liste.filter(f => !f.ozel)} sahsi={giris === "sahsi"} onKapat={() => setGiris(false)} onSec={yeniFoy} onEvraka={(id, tur) => { setGiris(false); setSecili({ id, ekle: tur }); }} />;

  const q = ara.trim().toLocaleLowerCase("tr");
  const byId = new Map(liste.map(f => [f.id, f] as const));
  // Şahsi dosyalar büro listesine, yaklaşanlara, önerilere ve DavaTek eşleştirmesine hiç karışmaz; yalnız en alttaki
  // şahsi dosyalar bölümünde, kilit açıkken görünür.
  const buro = liste.filter(f => !f.ozel);
  const sahsiler = liste.filter(f => f.ozel);
  const gorunen = buro
    .filter(f => filtre === "hepsi" || f.durum === filtre)
    .filter(f => turF === "hepsi" || (f.tur || "hukuk") === turF)
    .filter(f => !evrakli || f.evraklar.length > 0)
    .filter(f => davaF === null || (f.davaTuru || "").trim() === davaF)
    .filter(f => asamaF === null || (f.asama || "").trim() === asamaF)
    .filter(f => !q || [f.muvekkil, f.karsiTaraf, f.mahkeme, f.esasNo, f.davaTuru, f.notlar, turBilgi(f.tur).ad, ...Object.values(f.muvekkilBilgi || {})].join(" ").toLocaleLowerCase("tr").includes(q))
    .sort((a, b) => {
      const ac = (f: Foy) => f.acilis || f.olusturma.slice(0, 10);
      if (sirala === "acilisYeni") return ac(b).localeCompare(ac(a));
      if (sirala === "acilisEski") return ac(a).localeCompare(ac(b));
      if (sirala === "degisim") return b.guncelleme.localeCompare(a.guncelleme);
      return (a.durusma || "9999").localeCompare(b.durusma || "9999") || b.guncelleme.localeCompare(a.guncelleme);
    });
  const turlerVar = TURLER.filter(x => buro.some(f => (f.tur || "hukuk") === x.tur));
  // Yaklaşanlar: önümüzdeki 14 gün (ve geçmiş ama tamamlanmamış işler).
  const yaklasan: { f: Foy; tur: "durusma" | "gorev"; metin: string; tarih: string; gun: number }[] = [];
  for (const f of buro.filter(x => x.durum === "acik")) {
    const g = kacGun(f.durusma);
    if (f.durusma && g !== undefined && g >= 0 && g <= 14) yaklasan.push({ f, tur: "durusma", metin: t("Duruşma"), tarih: f.durusma, gun: g });
    for (const x of f.gorevler) {
      const gg = kacGun(x.tarih);
      if (!x.bitti && x.tarih && gg !== undefined && gg <= 14) yaklasan.push({ f, tur: "gorev", metin: x.metin, tarih: x.tarih, gun: gg });
    }
  }
  yaklasan.sort((a, b) => a.tarih.localeCompare(b.tarih));

  const yedekAl = async () => indir("celse-foyler-" + new Date().toISOString().slice(0, 10) + ".json", new Blob([await yedekMetni()], { type: "application/json" }));
  const yedekYukle = async () => {
    const [k] = await dosyaSec(".json", false);
    if (!k) return;
    try { const n = await yedektenYukle(new TextDecoder().decode(k.bytes)); setMesaj({ t: t("{n} föy yedekten yüklendi.", { n }), ok: true }); }
    catch (e) { setMesaj({ t: t(String((e as Error).message || e)) }); }
  };

  const foySatir = (f: Foy) => {
          const g = kacGun(f.durusma);
          const acikGorev = f.gorevler.filter(x => !x.bitti).length;
          const once = f.oncekiId ? byId.get(f.oncekiId) : undefined;
          const tb = turBilgi(f.tur);
          return (
            <Pressable key={f.id} onPress={() => setSecili({ id: f.id })} style={({ pressed }) => [s.foy, pressed && { opacity: 0.85 }]}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[s.turChip, f.ozel && s.ozelChip]}>{f.ozel ? "🔒 " : ""}{tb.kisa}{f.asama ? " · " + f.asama.toLocaleUpperCase("tr") : ""}</Text>
                <Text style={s.foyT} numberOfLines={1}>{foyBaslik(f)}</Text>
                <Text style={s.hint} numberOfLines={1}>{[f.mahkeme, f.esasNo, f.davaTuru, f.acilis ? t("açılış {d}", { d: tarihYaz(f.acilis) }) : ""].filter(Boolean).join(" · ") || t("Merci ve numara yazılmamış")}</Text>
                {!!once && <Text style={s.hint} numberOfLines={1}>↳ {t("{tur} {no} dosyasının devamı", { tur: turBilgi(once.tur).ad, no: once.esasNo || "" })}</Text>}
                <Text style={s.meta}>{[t("{n} EVRAK", { n: f.evraklar.length }), acikGorev ? t("{n} AÇIK İŞ", { n: acikGorev }) : ""].filter(Boolean).join(" · ")}</Text>
              </View>
              {!!f.durusma && <Text style={[s.foyD, g !== undefined && g >= 0 && g <= 7 && { color: C.brass }]}>{tarihYaz(f.durusma)}{"\n"}<Text style={s.hint}>{gunYaz(g)}</Text></Text>}
            </Pressable>
          );
  };
  const sayfaSay = Math.max(1, Math.ceil(gorunen.length / boy));
  const cur = Math.min(sayfa, sayfaSay - 1);
  const sayfadaki = gorunen.slice(cur * boy, cur * boy + boy);
  const sayfalama = (
    <View style={[s.row, { alignItems: "flex-end", flexWrap: "wrap" }]}>
      <Acilir etiket={t("Sırala")} secili={sirala} onSec={k => setSirala(k as typeof sirala)} genislik={190}
        secenekler={[{ k: "durusma", ad: t("Duruşma") }, { k: "acilisYeni", ad: t("Açılış (yeni önce)") }, { k: "acilisEski", ad: t("Açılış (eski önce)") }, { k: "degisim", ad: t("Son değişiklik") }]} />
      <Acilir etiket={t("Sayfada")} secili={String(boy)} onSec={k => setBoy(Number(k))} genislik={90}
        secenekler={[5, 10, 25, 50, 100].map(n => ({ k: String(n), ad: String(n) }))} />
      {sayfaSay > 1 && <>
        <Btn kind="ghost" label={t("‹ Önceki")} disabled={cur === 0} onPress={() => setSayfa(cur - 1)} />
        <Text style={s.hint}>{t("Sayfa {a} / {b} · {c}–{d} / {e} föy", { a: cur + 1, b: sayfaSay, c: cur * boy + 1, d: Math.min(gorunen.length, (cur + 1) * boy), e: gorunen.length })}</Text>
        <Btn kind="ghost" label={t("Sonraki ›")} disabled={cur >= sayfaSay - 1} onPress={() => { setSayfa(cur + 1); nav.toTop(); }} />
      </>}
    </View>
  );
  return (
    <View style={{ flex: 1 }}>
    <ScrollView ref={nav.ref} onScroll={nav.onScroll} scrollEventThrottle={64} contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
      <View style={s.head}><Btn kind="ghost" label={t("‹ Geri")} onPress={p.onBack} /></View>
      <Text style={s.eyebrow}>{t("DAVA TAKİBİ · CELSE AVUKAT")}</Text>
      <Text style={s.title}>{t("Föylerim")}</Text>
      <View style={s.warn}>
        <Text style={s.warnT}>{web ? t("Föyleriniz bu cihazda saklanır.") : t("Föyleriniz bu telefonda saklanır.")}</Text>
        <Text style={s.warnD}>{t("Yapay zekâya yalnız cihazda kodlanmış metin gönderilir ve kaydedilmez. Bulut eşitlemesini açarsanız föyler bu cihazda şifrelenip diğer cihazlarınıza gider; sunucu içeriği okuyamaz. Eşitleme kapalıysa cihaz değişince ya da tarayıcı verisi silinince föyler kaybolur; yedek alın.")}</Text>
        {web && <View style={s.row}>
          <Btn kind="ghost" label={t("Yedeği indir")} onPress={yedekAl} />
          <Btn kind="ghost" label={t("Yedekten yükle")} onPress={yedekYukle} />
        </View>}
      </View>

      <View style={s.row}>
        {web && <Btn label={t("📥 Toplu evrak yükle")} onPress={() => setHavuz(true)} />}
        <Btn kind="secondary" label={t("📋 Dava listesi")} onPress={() => setRapor(true)} />
        <Btn kind="secondary" label={t("✅ Yapılacaklar")} onPress={() => setIsler(true)} />
        {web && <Btn kind={ses ? "primary" : "secondary"} label={t("🎙 Sesli asistan")} onPress={() => setSes(!ses)} />}
        <Btn kind={web ? "secondary" : "primary"} label={t("+ Yeni giriş")} onPress={() => setGiris("normal")} />
        {web && <Btn kind="ghost" label={t("Dosya listesini Excel/Word'den aktar")} onPress={() => setAktar(true)} />}
      </View>
      {mesaj && <Text style={[s.hint, { color: mesaj.ok ? C.good : C.bad }]}>{mesaj.t}</Text>}
      {web && ses && <SesliAsistan liste={liste} onAc={id => setSecili({ id })} onIsler={() => setIsler(true)} />}
      {(() => {
        const n = duzeySayilari(liste);
        const kirmizi = n.gecikti + n.bugun + n.acil;
        if (!kirmizi && !n.uyari) return null;
        return (
          <Pressable onPress={() => setIsler(true)} accessibilityRole="button" style={{ borderWidth: 1, borderColor: kirmizi ? DUZEY_RENK.gecikti : DUZEY_RENK.uyari, borderRadius: 10, padding: 12, backgroundColor: (kirmizi ? DUZEY_RENK.gecikti : DUZEY_RENK.uyari) + "22" }}>
            <Text style={{ color: kirmizi ? DUZEY_RENK.gecikti : DUZEY_RENK.uyari, fontWeight: "700", fontSize: 14 }}>
              ⚠ {[n.gecikti ? t("{n} gecikmiş", { n: n.gecikti }) : "", n.bugun ? t("{n} son günü bugün", { n: n.bugun }) : "", n.acil ? t("{n} acil", { n: n.acil }) : "", n.uyari ? t("{n} bu hafta", { n: n.uyari }) : ""].filter(Boolean).join(" · ")} — {t("Yapılacaklar'ı aç ›")}
            </Text>
          </Pressable>
        );
      })()}

      <FoyBulutKart />
      <IliskiKart liste={buro} onAc={id => setSecili({ id })} />
      {(() => {
        const duzelecek = turDuzeltmeleri(buro);
        if (!duzelecek.length && !turDuzelt) return null;
        return (
          <Katlanir anahtar="turduzelt" baslik={t("Föy türleri düzeltilebilir")} ozet={duzelecek.length ? t("{n} föy", { n: duzelecek.length }) : t("tamam")}>
            {duzelecek.length > 0 && <Text style={s.hint}>{t("UYAP listesinden aktarılan {n} föyün türü ya da dava türü yeni kurallara göre düzeltilebilir (ör. satış memurluğu, tazminat komisyonu, sulh ceza hakimliği, icra ceza). Elle değiştirdiğiniz türlere dokunulmaz.", { n: duzelecek.length })}</Text>}
            {duzelecek.length > 0 && <Text style={s.hint}>{Object.entries(duzelecek.reduce((m, x) => { const k = x.f.tur === x.tur ? `${turBilgi(x.tur).ad}: ${x.davaTuru}` : `${turBilgi(x.f.tur).ad} → ${turBilgi(x.tur).ad}${x.davaTuru ? " (" + x.davaTuru + ")" : ""}`; m[k] = (m[k] || 0) + 1; return m; }, {} as Record<string, number>)).map(([k, n]) => `${k}: ${n}`).join(" · ")}</Text>}
            {!!turDuzelt && <Text style={[s.hint, { color: C.brass }]}>{turDuzelt}</Text>}
            {duzelecek.length > 0 && <View style={s.row}><Btn label={t("Türleri düzelt")} onPress={async () => { await foylerKaydet(duzelecek.map(x => ({ ...x.f, tur: x.tur, davaTuru: x.f.davaTuru || x.davaTuru }))); setTurDuzelt(t("{n} föyün türü düzeltildi.", { n: duzelecek.length })); yenile(); }} /></View>}
          </Katlanir>
        );
      })()}
      {web && <KlasorKart liste={buro} onBilgi={m => setMesaj(m)} />}

      {yaklasan.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardT}>{t("Yaklaşanlar (14 gün)")}</Text>
          {yaklasan.slice(0, 20).map((y, i) => (
            <Pressable key={i} onPress={() => setSecili({ id: y.f.id })} style={({ pressed }) => [s.yak, pressed && { opacity: 0.8 }]}>
              <Text style={[s.yakTarih, y.gun < 0 && { color: C.bad }, y.gun <= 2 && y.gun >= 0 && { color: C.brass }]}>{tarihYaz(y.tarih)}{"\n"}<Text style={s.hint}>{gunYaz(y.gun)}</Text></Text>
              <View style={{ flex: 1 }}>
                <Text style={s.fileT}>{y.tur === "durusma" ? "⚖ " : "☐ "}{y.metin}</Text>
                <Text style={s.hint} numberOfLines={1}>{foyBaslik(y.f)} · {y.f.mahkeme} {y.f.esasNo}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <View style={s.card}>
        <TextInput value={ara} onChangeText={setAra} placeholder={t("Ara: müvekkil, karşı taraf, mahkeme, esas no…")} placeholderTextColor={C.muted} style={s.inputTek} />
        {(() => {
          // Süzgeçler açılır kutularda: durum, evrak, tür; tür seçilince o türün dava türleri ve aşamaları.
          const tf = turF === "hepsi" ? [] : buro.filter(f => (f.tur || "hukuk") === turF && (filtre === "hepsi" || f.durum === filtre));
          const say = (al: (f: Foy) => string, sabit: string[] = []) => {
            const m = new Map<string, number>(sabit.map(x => [x, 0]));
            for (const f of tf) { const k = al(f).trim(); m.set(k, (m.get(k) || 0) + 1); }
            return [...m.entries()].sort((a, b) => (a[0] === "" ? 1 : b[0] === "" ? -1 : 0) || b[1] - a[1]).map(([k, n]) => ({ k: "x:" + k, ad: k || t("Belirtilmemiş"), n }));
          };
          const hepsi = { k: "*", ad: t("Hepsi"), n: tf.length };
          return (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
              <Acilir etiket={t("Durum")} secili={filtre} onSec={k => setFiltre(k as typeof filtre)}
                secenekler={(["acik", "kapali", "hepsi"] as const).map(k => ({ k, ad: k === "acik" ? t("Açık") : k === "kapali" ? t("Kapalı") : t("Hepsi"), n: buro.filter(f => k === "hepsi" || f.durum === k).length }))} />
              <Acilir etiket={t("Dosya türü")} secili={turF} onSec={k => setTurF(k as FoyTur | "hepsi")} genislik={200}
                secenekler={[{ k: "hepsi", ad: t("Bütün türler"), n: buro.length }, ...turlerVar.map(x => ({ k: x.tur, ad: t(x.ad), n: buro.filter(f => (f.tur || "hukuk") === x.tur).length }))]} />
              {turF !== "hepsi" && <Acilir etiket={t("Hangi dava")} secili={davaF === null ? "*" : "x:" + davaF} onSec={k => setDavaF(k === "*" ? null : k.slice(2))} genislik={200}
                secenekler={[hepsi, ...say(f => f.davaTuru || "")]} />}
              {turF !== "hepsi" && <Acilir etiket={t("Aşama")} secili={asamaF === null ? "*" : "x:" + asamaF} onSec={k => setAsamaF(k === "*" ? null : k.slice(2))}
                secenekler={[hepsi, ...say(f => f.asama || "", turBilgi(turF).asamalar)]} />}
              <Acilir etiket={t("Evrak")} secili={evrakli ? "var" : "hepsi"} onSec={k => setEvrakli(k === "var")}
                secenekler={[{ k: "hepsi", ad: t("Bütün föyler") }, { k: "var", ad: t("Evrakı olanlar"), n: buro.filter(f => f.evraklar.length > 0).length }]} />
            </View>
          );
        })()}
        {yuklendi && liste.length === 0 && <Text style={s.body}>{t("Henüz föy yok. “+ Yeni giriş” ile ekleyin ya da dosya listenizi Excel veya Word tablosundan toplu olarak aktarın.")}</Text>}
        {gorunen.length > 1 && sayfalama}
        {sayfadaki.map(foySatir)}
        {gorunen.length > boy && sayfalama}
      </View>

      {/* Şahsi dosyalar: sayfanın en sonunda, kilit açıkken; kilitliyken hiçbir yerde sayısı bile görünmez. */}
      {kilit === "acik" ? (
        <View style={[s.card, { borderColor: C.mid }]}>
          <Text style={s.cardT}>🔓 {t("Şahsi dosyalarım ({n})", { n: sahsiler.length })}</Text>
          <Text style={s.hint}>{t("Yalnız şifreyi bilen görür; büro listesine, yaklaşanlara, önerilere ve DavaTek eşleştirmesine karışmaz. 15 dakika kullanılmazsa ya da dava takibinden çıkınca kendiliğinden kilitlenir.")}</Text>
          {sahsiler.map(foySatir)}
          <View style={s.row}>
            <Btn kind="secondary" label={t("+ Şahsi dosya ekle")} onPress={() => setGiris("sahsi")} />
            <Btn kind="ghost" label={t("Kilitle")} onPress={() => { ozelKilitle(); yenile(); }} />
          </View>
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setKilitSor({})} hitSlop={8} style={{ alignSelf: "flex-start", paddingVertical: 14 }}>
          <Text style={[s.hint, { textDecorationLine: "underline", opacity: 0.6 }]}>{t("Şahsi dosyalar")}</Text>
        </Pressable>
      )}
    </ScrollView>
    <FloatingNav nav={nav} onBack={p.onBack} />
    </View>
  );
}

/* ---------- yeni giriş menüsü ---------- */
function GirisMenu({ liste, sahsi, onKapat, onSec, onEvraka }: { liste: Foy[]; sahsi?: boolean; onKapat: () => void; onSec: (t: FoyTur, ek: { ozel?: boolean; davaTuru?: string }) => void; onEvraka: (id: string, tur: string) => void }) {
  const [alt, setAlt] = useState<Giris | null>(null);
  const [ara, setAra] = useState("");
  // "Hangi dava": türün alt listesi (boşanma, işe iade, hekim disiplin soruşturması…). Seçilen föyde "Konu" olur.
  const [altTur, setAltTur] = useState<FoyTur | null>(null);
  const [kendi, setKendi] = useState("");
  const sec = (tur: FoyTur) => (DAVA_TURLERI[tur]?.length ? setAltTur(tur) : onSec(tur, { ozel: sahsi }));
  // Şahsi dosya girişi yalnız şahsi dosyalar bölümünden (kilit açıkken) açılır; büro girişinde şahsi seçeneği hiç görünmez.
  const sahsiKart = sahsi ? (
    <View style={[s.warn, { borderColor: C.mid }]}>
      <Text style={s.warnT}>🔒 {t("Şahsi dosya açıyorsunuz")}</Text>
      <Text style={s.warnD}>{t("Kendi davanız, soruşturmanız ya da başvurunuz: ayrı şifreyle şifrelenip saklanır, büro föyleriyle karışmaz.")}</Text>
    </View>
  ) : null;
  if (altTur) {
    const tb = turBilgi(altTur);
    return (
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <View style={s.head}><Btn kind="ghost" label={t("‹ Geri")} onPress={() => setAltTur(null)} /></View>
        <Text style={s.eyebrow}>{(sahsi ? t("ŞAHSİ · ") : "") + tb.kisa}</Text>
        <Text style={s.title}>{altTur === "idari_sorusturma" || altTur === "baro" || altTur === "sorusturma" ? t("Hangi soruşturma?") : t("Hangi dava?")}</Text>
        <View style={s.grid}>
          {DAVA_TURLERI[altTur]!.map(x => (
            <Pressable key={x} onPress={() => onSec(altTur, { ozel: sahsi, davaTuru: x })} style={({ pressed }) => [s.girisK, pressed && { opacity: 0.85 }]}>
              <Text style={s.girisT}>{t(x)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.label}>{t("Listede yoksa kendiniz yazın")}</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <TextInput value={kendi} onChangeText={setKendi} placeholder={t("Örn. ecrimisil, önalım, haksız rekabet…")} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1, minWidth: 220 }]} onSubmitEditing={() => kendi.trim() && onSec(altTur, { ozel: sahsi, davaTuru: kendi.trim() })} />
          <Btn label={kendi.trim() ? t("Bununla aç") : t("Konuyu sonra yazarım")} onPress={() => onSec(altTur, { ozel: sahsi, davaTuru: kendi.trim() })} />
        </View>
      </ScrollView>
    );
  }
  if (alt?.evrakaEkle) {
    const q = ara.trim().toLocaleLowerCase("tr");
    const xs = liste.filter(f => !q || [f.muvekkil, f.karsiTaraf, f.mahkeme, f.esasNo].join(" ").toLocaleLowerCase("tr").includes(q)).slice(0, 30);
    return (
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <View style={s.head}><Btn kind="ghost" label={t("‹ Geri")} onPress={() => setAlt(null)} /></View>
        <Text style={s.title}>{t("{tur} hangi föye?", { tur: t(alt.evrakaEkle) })}</Text>
        <TextInput value={ara} onChangeText={setAra} placeholder={t("Ara: müvekkil, karşı taraf, esas no…")} placeholderTextColor={C.muted} style={s.inputTek} />
        {xs.map(f => (
          <Pressable key={f.id} onPress={() => onEvraka(f.id, alt.evrakaEkle!)} style={s.foy}>
            <View style={{ flex: 1 }}>
              <Text style={s.turChip}>{turBilgi(f.tur).kisa}</Text>
              <Text style={s.foyT} numberOfLines={1}>{foyBaslik(f)}</Text>
              <Text style={s.hint} numberOfLines={1}>{[f.mahkeme, f.esasNo].filter(Boolean).join(" · ")}</Text>
            </View>
          </Pressable>
        ))}
        {!liste.length && <Text style={s.body}>{t("Önce bir föy oluşturun.")}</Text>}
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={s.head}><Btn kind="ghost" label={t("‹ Föylere dön")} onPress={alt ? () => setAlt(null) : onKapat} /></View>
      <Text style={s.eyebrow}>{t("YENİ GİRİŞ")}</Text>
      <Text style={s.title}>{alt ? t(alt.ad) : t("Ne ile başlıyorsunuz?")}</Text>
      {!alt && <Text style={s.hint}>{t("Dosyalar sonradan birbirine bağlanabilir: suç duyurusu ceza davasına, arabuluculuk hukuk davasına, idari başvuru idari davaya dönüştüğünde föyün içinden “Devamını aç” deyin.")}</Text>}
      {sahsiKart}
      <View style={s.grid}>
        {(alt?.secenek ? alt.secenek.map(x => ({ ad: turBilgi(x).ad, aciklama: turBilgi(x).aciklama, tur: x } as Giris)) : GIRISLER)
          .filter(g => !(sahsi && g.evrakaEkle)).map(g => (
            <Pressable key={g.ad} onPress={() => (g.tur ? sec(g.tur) : setAlt(g))} style={({ pressed }) => [s.girisK, sahsi && { borderColor: C.mid }, pressed && { opacity: 0.85 }]}>
              <Text style={s.girisT}>{sahsi ? "🔒 " : ""}{t(g.ad)}</Text>
              <Text style={s.hint}>{t(g.aciklama)}</Text>
            </Pressable>
          ))}
      </View>
    </ScrollView>
  );
}

/* ---------- özel dosya kilidi ---------- */
function OzelKilit({ durum, onKapat, onAcildi }: { durum: "yok" | "kilitli" | "acik"; onKapat: () => void; onAcildi: () => void }) {
  const [a, setA] = useState(""), [b, setB] = useState("");
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const kur = durum === "yok";
  const git = async () => {
    setErr("");
    if (kur && a !== b) { setErr(t("Şifreler aynı değil.")); return; }
    setBusy(true);
    try {
      if (kur) { await ozelKilitKur(a); onAcildi(); }
      else if (await ozelAc(a)) onAcildi();
      else setErr(t("Şifre yanlış."));
    } catch (e) { setErr(t(String((e as Error).message || e))); }
    setBusy(false);
  };
  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
      <View style={s.head}><Btn kind="ghost" label={t("‹ Vazgeç")} onPress={onKapat} /></View>
      <Text style={s.eyebrow}>{t("ÖZEL DOSYALAR")}</Text>
      <Text style={s.title}>{kur ? t("Özel dosya şifresi belirleyin") : t("Özel dosyaları açın")}</Text>
      <View style={s.card}>
        <Text style={s.body}>{kur
          ? t("Kişisel ceza soruşturmaları ve baro soruşturmaları bu şifreden türetilen anahtarla şifrelenip saklanır. Şifre hiçbir yere kaydedilmez; unutursanız bu dosyalar açılamaz. En az 6 karakter.")
          : t("Özel dosyalar şifreli. Açmak için şifrenizi girin; 15 dakika kullanılmazsa yeniden kilitlenir.")}</Text>
        <TextInput value={a} onChangeText={setA} secureTextEntry placeholder={t("Şifre")} placeholderTextColor={C.muted} style={s.inputTek} onSubmitEditing={kur ? undefined : git} autoFocus />
        {kur && <TextInput value={b} onChangeText={setB} secureTextEntry placeholder={t("Şifre (tekrar)")} placeholderTextColor={C.muted} style={s.inputTek} onSubmitEditing={git} />}
        {!!err && <Text style={s.err}>{err}</Text>}
        <View style={s.row}><Btn label={busy ? t("Bekleyin…") : kur ? t("Şifreyi kur ve aç") : t("Aç")} onPress={git} disabled={busy || !a} /></View>
      </View>
    </ScrollView>
  );
}

/* ---------- DavaTek klasörü ---------- */
function KlasorKart({ liste, onBilgi }: { liste: Foy[]; onBilgi: (m: { t: string; ok?: boolean }) => void }) {
  const [bilgi, setBilgi] = useState<{ ad: string; izin: string } | null>(null);
  const [ilerleme, setIlerleme] = useState("");
  const [bekleyen, setBekleyen] = useState<TaramaDosyasi[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { klasorBilgisi().then(setBilgi).catch(() => {}); }, []);
  const byId = useMemo(() => new Map(liste.map(f => [f.id, f] as const)), [liste]);
  if (!klasorDestekli()) return null;

  const ekle = async (xs: { d: TaramaDosyasi; foyId: string }[]) => {
    const gruplar = new Map<string, TaramaDosyasi[]>();
    for (const x of xs) gruplar.set(x.foyId, [...(gruplar.get(x.foyId) || []), x.d]);
    for (const [id, ds] of gruplar) {
      const f = byId.get(id);
      if (!f) continue;
      const evraklar = [...f.evraklar];
      for (const d of ds) evraklar.push(await evrakOlustur(f, d.kaynak, { metin: d.metin, okunamadi: d.okunamadi }));
      await foyKaydet({ ...f, evraklar });
    }
    await gorulduYaz(xs.map(x => x.d.anahtar));
  };
  const tara = async () => {
    setBusy(true); setBekleyen([]);
    try {
      const sonuc = await klasorTara(liste, setIlerleme);
      const eslesen = sonuc.filter(d => d.foyId).map(d => ({ d, foyId: d.foyId! }));
      await ekle(eslesen);
      const kalan = sonuc.filter(d => !d.foyId);
      setBekleyen(kalan);
      onBilgi({ t: sonuc.length ? t("{n} yeni dosya bulundu: {e} tanesi föyüne eklendi, {k} tanesi için föy seçmeniz gerekiyor.", { n: sonuc.length, e: eslesen.length, k: kalan.length }) : t("Klasörde yeni dosya yok."), ok: true });
    } catch (e) { onBilgi({ t: t(String((e as Error).message || e)) }); }
    setIlerleme(""); setBusy(false);
    klasorBilgisi().then(setBilgi).catch(() => {});
  };
  return (
    <Katlanir anahtar="davatek" baslik={t("DavaTek klasörü")} ozet={bilgi ? bilgi.ad : t("klasör seçilmedi")}>
      <Text style={s.hint}>{t("DavaTek'in evrak indirdiği klasörü bir kez seçin. “Yeni evrakı al” dediğinizde Celse klasördeki yeni dosyaları okur, esas ya da dosya numarasından föyünü bulup ekler. Dosyalar bu bilgisayardan çıkmaz.")}</Text>
      <View style={s.row}>
        {bilgi ? <Btn label={busy ? t("Okunuyor…") : t("Yeni evrakı al")} onPress={tara} disabled={busy} /> : null}
        <Btn kind={bilgi ? "ghost" : "secondary"} label={bilgi ? t("Klasörü değiştir ({ad})", { ad: bilgi.ad }) : t("Klasörü seç")} onPress={async () => { const ad = await klasorSec(); if (ad) setBilgi({ ad, izin: "granted" }); }} disabled={busy} />
      </View>
      {!!ilerleme && <Text style={s.hint}>{ilerleme}</Text>}
      {bekleyen.map(d => (
        <View key={d.anahtar} style={[s.file, { flexWrap: "wrap" }]}>
          <View style={{ flex: 1, minWidth: 200 }}>
            <Text style={s.fileT} numberOfLines={1}>{d.kaynak.ad}</Text>
            <Text style={s.hint} numberOfLines={1}>{d.kaynak.yol} · {t(d.neden || "")}</Text>
          </View>
          <FoySecici liste={liste} onSec={async id => { await ekle([{ d, foyId: id }]); setBekleyen(xs => xs.filter(x => x !== d)); }} />
          <Pressable onPress={async () => { await gorulduYaz([d.anahtar]); setBekleyen(xs => xs.filter(x => x !== d)); }}><Text style={s.sil}>{t("Atla")}</Text></Pressable>
        </View>
      ))}
    </Katlanir>
  );
}
function FoySecici({ liste, onSec }: { liste: Foy[]; onSec: (id: string) => void }) {
  const [ac, setAc] = useState(false);
  const [q, setQ] = useState("");
  if (!ac) return <Pressable onPress={() => setAc(true)}><Text style={s.link}>{t("Föy seç")}</Text></Pressable>;
  const xs = liste.filter(f => { const k = q.trim().toLocaleLowerCase("tr"); return !k || [f.muvekkil, f.karsiTaraf, f.mahkeme, f.esasNo].join(" ").toLocaleLowerCase("tr").includes(k); }).slice(0, 8);
  return (
    <View style={{ width: "100%", gap: 4 }}>
      <TextInput value={q} onChangeText={setQ} placeholder={t("Ara…")} placeholderTextColor={C.muted} style={s.inputTek} autoFocus />
      {xs.map(f => <Pressable key={f.id} onPress={() => onSec(f.id)}><Text style={s.link}>{foyBaslik(f)} · {f.esasNo}</Text></Pressable>)}
    </View>
  );
}

/* ---------- toplu aktarma ---------- */
function Aktar({ mevcut, onBitti }: { mevcut: Foy[]; onBitti: (mesaj?: string) => void }) {
  const [sonuc, setSonuc] = useState<(AktarimSonucu & { ad: string }) | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const sec = async () => {
    setErr("");
    const [k] = await dosyaSec(".xlsx,.xlsm,.csv,.docx,.xls,.doc", false);
    if (!k) return;
    try { setSonuc({ ...tablodanFoyler(tabloOku(k.ad, k.bytes)), ad: k.ad }); } catch (e) { setSonuc(null); setErr(t(String((e as Error).message || e))); }
  };
  const ayrim = useMemo(() => (sonuc ? birlestir(mevcut, sonuc.foyler) : null), [sonuc, mevcut]);
  const kaydet = async () => {
    if (!ayrim) return;
    setBusy(true);
    await foylerKaydet([...ayrim.yeni, ...ayrim.guncellenen]);
    setBusy(false);
    onBitti(t("{y} yeni föy oluşturuldu, {g} föy güncellendi.", { y: ayrim.yeni.length, g: ayrim.guncellenen.length }));
  };
  const ALAN: Record<string, string> = { muvekkil: "Müvekkil", karsiTaraf: "Karşı taraf", davaci: "Davacı", davali: "Davalı", mahkeme: "Mahkeme", esasNo: "Esas no", davaTuru: "Dava türü", taraf: "Sıfatımız", durusma: "Duruşma tarihi", notlar: "Not", gorev: "Yapılacak", durum: "Durum" };
  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={s.head}><Btn kind="ghost" label={t("‹ Föylere dön")} onPress={() => onBitti()} /></View>
      <Text style={s.title}>{t("Toplu föy ekle")}</Text>
      <View style={s.card}>
        <Text style={s.body}>{t("Dosya listenizi Excel (.xlsx, .csv) ya da Word (.docx) tablosu olarak yükleyin. İlk satır başlık olsun; her satır bir föy olur. Başlık adları serbesttir: Müvekkil, Karşı taraf (ya da Davacı ve Davalı), Sıfatımız, Mahkeme, Esas no, Dava türü, Duruşma tarihi, Yapılacak, Not, Durum.")}</Text>
        <Text style={s.hint}>{t("Aynı mahkeme ve esas numaralı föy zaten varsa çift föy oluşmaz, var olan güncellenir. Dosya bilgisayarınızda okunur; hiçbir yere gönderilmez.")}</Text>
        <View style={s.row}>
          <Btn label={t("Dosya seç")} onPress={sec} />
          <Btn kind="ghost" label={t("Örnek Excel şablonunu indir")} onPress={() => { const a = document.createElement("a"); a.href = "/foy-sablonu.xlsx"; a.download = "celse-foy-sablonu.xlsx"; a.click(); }} />
        </View>
        {!!err && <Text style={s.err}>{err}</Text>}
      </View>
      {sonuc && ayrim && (
        <View style={s.card}>
          <Text style={s.cardT}>{sonuc.ad}</Text>
          <Text style={s.body}>{t("{n} föy bulundu: {y} yeni, {g} var olan föyün güncellemesi.", { n: sonuc.foyler.length, y: ayrim.yeni.length, g: ayrim.guncellenen.length })}{sonuc.atlanan ? " " + t("{n} boş satır atlandı.", { n: sonuc.atlanan }) : ""}</Text>
          <Text style={s.hint}>{t("Tanınan sütunlar")}: {Object.entries(sonuc.eslesen).map(([a, h]) => `${h} → ${t(ALAN[a] || a)}`).join(", ")}</Text>
          {sonuc.eslesmeyen.length > 0 && <Text style={s.hint}>{t("Tanınmayan, atlanan sütunlar")}: {sonuc.eslesmeyen.join(", ")}</Text>}
          {sonuc.foyler.slice(0, 30).map(f => (
            <View key={f.id} style={s.foy}>
              <View style={{ flex: 1 }}>
                <Text style={s.foyT} numberOfLines={1}>{foyBaslik(f)}</Text>
                <Text style={s.hint} numberOfLines={1}>{[f.taraf === "davali" ? t("Davalı vekili") : t("Davacı vekili"), f.mahkeme, f.esasNo, f.davaTuru].filter(Boolean).join(" · ")}</Text>
              </View>
              {!!f.durusma && <Text style={s.foyD}>{tarihYaz(f.durusma)}</Text>}
            </View>
          ))}
          {sonuc.foyler.length > 30 && <Text style={s.hint}>{t("ve {n} föy daha", { n: sonuc.foyler.length - 30 })}</Text>}
          <View style={s.row}><Btn label={busy ? t("Kaydediliyor…") : t("Föyleri oluştur")} onPress={kaydet} disabled={busy || !sonuc.foyler.length} /></View>
        </View>
      )}
    </ScrollView>
  );
}

