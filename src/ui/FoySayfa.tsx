// Föy sayfası: tür ve aşama, dosya zinciri (öncesi ve devamı), künye, yapılacaklar, evrak (tür ve önem, kodlu hâli),
// "Dosya ne durumda?" (önemli evrak üzerinden yapay zekâ özeti, sesli dinleme). Her şey bu cihazda; dışarı yalnız kodlu metin gider.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { kunyeCikar, kunyeyiDoldur } from "../data/kunyeCikar";
import { MuvekkilMesaj } from "./MuvekkilMesaj";
import { Katlanir } from "./Katlanir";
import { Acilir } from "./Acilir";
import { IcraBolum } from "./IcraBolum";
import { tl } from "../data/icra";
import { komisyonaUygun } from "../data/davaListesi";
import { evrakTuruBul, icraDoldur } from "../data/icraEvrak";
import { dosyaOku, dosyaSaklanir, dosyaSil, donguMu, Foy, KarsiBilgi, MuvekkilBilgi, foyBaslik, FoyEvrak, foyGetir, foyKaydet, foyOzelYap, foySil, ozelKilitDurumu, Gorev, kacGun, bosFoy, tarihCoz, tarihYaz, yeniId, zincir } from "../data/foy";
import { DAVA_TURLERI, EVRAK_TURLERI, FoyTur, turBilgi, TURLER } from "../data/foyTurleri";
import { unmask } from "../engine/mask";
import { zipIcerigi, turBul } from "../engine/mask/readers";
import { evrakProva } from "../data/evrak";
import { metinleriGetir } from "../data/foyBulut";
import { setAvukatKalan, usePremium } from "../data/subscription";
import { EVRAK_KREDI } from "../data/purchaseIds";
import { durumKaynagi, evrakHazirla, evrakOkuVeHazirla, Kaynak } from "./foyEvrak";
import { boyutYaz, dosyaSec, gunYaz, indir, s } from "./foyStil";
import { sesliDur, sesliOku, sesliOkumaVar, useSesliOkuma, yerelSesVar } from "./sesliOku";
import { IconBadge } from "./icons";
import { FloatingNav, useFloatingNav } from "./FloatingNav";
import { Btn } from "./kit";
import { t } from "../i18n";
import { C } from "./theme";

const DAVA: FoyTur[] = ["hukuk", "ceza", "idari_dava"];
function tarafAdlari(tur?: FoyTur): [string, string] | null {
  switch (tur || "hukuk") {
    case "hukuk": case "idari_dava": return ["Davacı vekiliyiz", "Davalı vekiliyiz"];
    case "ceza": case "sorusturma": return ["Müşteki / katılan vekiliyiz", "Şüpheli / sanık müdafiiyiz"];
    case "icra": return ["Alacaklı vekiliyiz", "Borçlu vekiliyiz"];
    case "arabuluculuk": case "kurum_basvuru": case "idari_basvuru": return ["Başvurucu tarafız", "Karşı tarafız"];
    default: return null;
  }
}

export function FoySayfa({ id, liste, ekle, onKapat, onAc, onHazirlan, ucretsiz, onAyir }: {
  id: string; liste: Foy[]; ekle?: string; onKapat: () => void; onAc: (id: string) => void; onHazirlan: (f: Foy) => void; ucretsiz?: boolean;
  /** bu föyde toplanmış evrakı ait oldukları föylere ayır */
  onAyir?: (f: Foy) => void;
}) {
  const [f, setF] = useState<Foy | null>(null);
  const [yok, setYok] = useState(false);
  const [okuma, setOkuma] = useState("");
  const [err, setErr] = useState("");
  const [yeniGorev, setYeniGorev] = useState("");
  const [gorevTarih, setGorevTarih] = useState("");
  const [durusmaYazi, setDurusmaYazi] = useState("");
  const [silOnay, setSilOnay] = useState(false);
  const [muvAc, setMuvAc] = useState(false);
  // Evrak listesi: seçim kutuları, toplu işlem ve sayfalama (5, 10, 25, 50, 100; tercih bu cihazda hatırlanır).
  const [secim, setSecim] = useState<Set<string>>(new Set());
  const [evrakSuz, setEvrakSuz] = useState<"hepsi" | "onemli" | "onemsiz">("hepsi");
  const [evrakSayfa, setEvrakSayfa] = useState(0);
  const [evrakBoy, setEvrakBoyRaw] = useState<number>(() => { try { const v = Number(globalThis.localStorage?.getItem("celse-foy-evrak-sayfa")); return [5, 10, 25, 50, 100].includes(v) ? v : 10; } catch { return 10; } });
  const setEvrakBoy = (n: number) => { setEvrakBoyRaw(n); setEvrakSayfa(0); try { globalThis.localStorage?.setItem("celse-foy-evrak-sayfa", String(n)); } catch { /* yok say */ } };
  const [topluSil, setTopluSil] = useState(false);
  const nav = useFloatingNav();
  const [karsiAc, setKarsiAc] = useState(false);
  const [surum, setSurum] = useState(0);
  const [icraMesaj, setIcraMesaj] = useState("");
  const [kunyeMesaj, setKunyeMesaj] = useState("");
  const [soruluyor, setSoruluyor] = useState(false);
  const [baglaAc, setBaglaAc] = useState(false);
  const [baglaAra, setBaglaAra] = useState("");
  const [turSec, setTurSec] = useState<string | null>(null);
  const [kodluGor, setKodluGor] = useState<string | null>(null);
  const [hiz, setHiz] = useState(1);
  const okuyor = useSesliOkuma();
  const prem = usePremium();
  const bedava = !!ucretsiz || prem.evrak;
  const zaman = useRef<ReturnType<typeof setTimeout> | null>(null);
  const son = useRef<Foy | null>(null);
  useEffect(() => {
    setF(null); setYok(false);
    foyGetir(id).then(x => { if (x) { setF(x); setDurusmaYazi(x.durusma ? tarihYaz(x.durusma) : ""); } else setYok(true); });
  }, [id]);
  // Her değişiklik yarım saniye sonra kaydedilir; ekrandan çıkarken bekleyen kayıt hemen yazılır.
  const degistir = (ek: Partial<Foy>) => setF(x => {
    if (!x) return x;
    const y = { ...x, ...ek };
    son.current = y;
    if (zaman.current) clearTimeout(zaman.current);
    zaman.current = setTimeout(() => { foyKaydet(y).catch(e => setErr(t(String((e as Error).message || e)))); zaman.current = null; }, 500);
    return y;
  });
  const hemenKaydet = async () => { if (zaman.current && son.current) { clearTimeout(zaman.current); zaman.current = null; await foyKaydet(son.current); } };
  useEffect(() => () => { if (zaman.current && son.current) { clearTimeout(zaman.current); foyKaydet(son.current).catch(() => {}); } }, []);
  const zin = useMemo(() => (f ? zincir(f, liste) : { onceki: [], sonraki: [] }), [f, liste]);

  if (yok) return <ScrollView contentContainerStyle={s.wrap}><Btn kind="ghost" label={t("‹ Föylere dön")} onPress={onKapat} /><Text style={s.err}>{t("Föy bulunamadı ya da şahsi dosyalar kilitli.")}</Text></ScrollView>;
  if (!f) return <ScrollView contentContainerStyle={s.wrap}><Text style={s.hint}>{t("Yükleniyor…")}</Text></ScrollView>;
  const tb = turBilgi(f.tur);

  const evrakEkle = async (zorTur?: string) => {
    setErr("");
    const secilen = await dosyaSec(".udf,.doc,.docx,.rtf,.odt,.htm,.html,.txt,.pdf,.tif,.tiff,.jpg,.jpeg,.png,.zip");
    const sira: Kaynak[] = [];
    for (const k of secilen) {
      if (turBul(k.ad) === "zip") { try { sira.push(...zipIcerigi(k.bytes)); } catch { setErr(t("{ad}: ZIP dosyası açılamadı.", { ad: k.ad })); } }
      else sira.push(k);
    }
    const eklenen: FoyEvrak[] = [];
    let i = 0;
    for (const k of sira) {
      i++;
      const onEk = sira.length > 1 ? `(${i} / ${sira.length}) ` : "";
      const r = await evrakOkuVeHazirla(f, k, m => setOkuma(`${onEk}${k.ad}: ${t(m)}`));
      if ("hata" in r) { setErr(t("{ad}: {hata}.", { ad: k.ad, hata: t(r.hata) })); continue; }
      eklenen.push(zorTur ? { ...r, tur: zorTur, onemli: true } : r);
    }
    setOkuma("");
    if (eklenen.length) {
      // İcra föyünde takibe konu evrak (ilam, çek, senet, kira sözleşmesi, fatura) icra bilgilerini de doldurur.
      const ic = f.tur === "icra" ? icraDoldur(f.icra || { yol: "genel", paraBirimi: "TL", faizTuru: "yasal" }, eklenen.map(e => e.metin)) : null;
      degistir({ evraklar: [...f.evraklar, ...eklenen], ...kunyeEvraktan(eklenen, f), ...(ic && ic.dolan.length ? { icra: ic.yeni } : {}) });
      if (ic && ic.dolan.length) { setIcraMesaj(t("İcra bilgileri evraktan dolduruldu: {x}. Kontrol edin.", { x: ic.dolan.join(", ") })); setSurum(v => v + 1); }
    }
  };
  const evrakAc = async (e: FoyEvrak) => {
    if (!dosyaSaklanir()) { setErr(t("Asıl dosya bilgisayarınızda duruyor; telefonda yalnız künye ve kodlanmış metin vardır.")); return; }
    const b = await dosyaOku(e.id);
    if (!b) { setErr(t("Asıl dosya bu cihazda bulunamadı (yalnız okunan metni var).")); return; }
    if (/\.(pdf|jpg|jpeg|png|txt)$/i.test(e.ad)) window.open(URL.createObjectURL(b), "_blank"); else indir(e.ad, b);
  };
  const evrakDegistir = (e: FoyEvrak, ek: Partial<FoyEvrak> | null) => {
    if (!ek) { dosyaSil(e.id).catch(() => {}); degistir({ evraklar: f.evraklar.filter(x => x.id !== e.id) }); setSecim(x => { const y = new Set(x); y.delete(e.id); return y; }); return; }
    degistir({ evraklar: f.evraklar.map(x => (x.id === e.id ? { ...x, ...ek } : x)) });
  };
  /** Seçilen evraka toplu işlem: sil ya da önemli/önemsiz yap. */
  const topluIslem = (ek: Partial<FoyEvrak> | null) => {
    if (!secim.size) return;
    if (!ek) {
      for (const id of secim) dosyaSil(id).catch(() => {});
      degistir({ evraklar: f.evraklar.filter(x => !secim.has(x.id)) });
      setSecim(new Set()); setTopluSil(false); setEvrakSayfa(0);
      return;
    }
    degistir({ evraklar: f.evraklar.map(x => (secim.has(x.id) ? { ...x, ...ek } : x)) });
    setSecim(new Set());
  };
  const gorevEkle = () => {
    const m = yeniGorev.trim();
    if (!m) return;
    degistir({ gorevler: [...f.gorevler, { id: yeniId("g"), metin: m, tarih: tarihCoz(gorevTarih), bitti: false, kaynak: "elle" }] });
    setYeniGorev(""); setGorevTarih("");
  };
  const gorevDegistir = (g: Gorev, ek: Partial<Gorev> | null) => degistir({ gorevler: ek ? f.gorevler.map(x => (x.id === g.id ? { ...x, ...ek } : x)) : f.gorevler.filter(x => x.id !== g.id) });

  // Dosya ne durumda: önemli evrak cihazda birlikte kodlanır; kodlu metin gider, dönen özet gerçek adlarla föye yazılır.
  const durumSor = async () => {
    setErr("");
    // Eski evrakın türü ve önemi yoksa şimdi belirlenir.
    const hazir = f.evraklar.some(e => e.tur === undefined) ? { ...f, evraklar: f.evraklar.map(e => (e.tur === undefined ? evrakHazirla(f, e) : e)) } : f;
    if (hazir !== f) degistir({ evraklar: hazir.evraklar });
    // Metni bu cihazda olmayan evrak (telefon, ya da başka bilgisayardan eşitlenmiş föy) buluttan kodlanmış hâliyle getirilir.
    let tam = hazir;
    try { tam = await metinleriGetir(hazir); } catch { /* bulut yoksa eldekilerle devam */ }
    const k = durumKaynagi(tam);
    if (!k.kullanilan.length) { setErr(t("Önemli olarak işaretli, yazısı okunmuş evrak yok. Evrak ekleyin ya da önemini değiştirin.")); return; }
    if (/(?<!\d[.,]?)[1-9]\d{10}(?![.,]?\d)|\bTR\s?\d{2}(?:\s?\d{4}){5}|[\w.+-]+@[\w-]+\.[\w.]+/i.test(k.metin)) { setErr(t("Metinde gizlenmemiş kişisel veri kalmış olabilir. “Duruşmaya hazırlan” ekranında kontrol edip gizleyin.")); return; }
    setSoruluyor(true);
    const r = await evrakProva(k.metin, f.taraf, t("Dava takibi ({tur}{asama}): dosyanın şu anki durumu (hangi aşamada, en son ne oldu, sırada ne var), işleyen ve yaklaşan süreler, avukatın yapması gereken işler.", { tur: tb.ad, asama: f.asama ? ", " + f.asama : "" }));
    setSoruluyor(false);
    if (!r.ok) { setErr(t(r.error, r.vars)); return; }
    if (typeof r.data.avukatKalan === "number") setAvukatKalan(r.data.avukatKalan);
    const u = (x: string) => unmask(x, k.map);
    const d = r.data;
    const yapay: Gorev[] = (d.eksik || []).map(x => ({ id: yeniId("g"), metin: u(x), bitti: false, kaynak: "yapay" as const }))
      .filter(x => !f.gorevler.some(y => y.metin === x.metin));
    degistir({
      degerlendirme: { tarih: new Date().toISOString(), ozet: u(d.ozet || ""), uyusmazlik: (d.uyusmazlik || []).map(u), sureler: (d.sureler || []).map(u), zayif: (d.zayif || []).map(u) },
      gorevler: [...f.gorevler, ...yapay]
    });
  };
  const okunacak = (d: NonNullable<Foy["degerlendirme"]>) => [d.ozet, d.sureler.length ? t("Süreler.") + " " + d.sureler.join(". ") : "", d.zayif.length ? t("Riskler.") + " " + d.zayif.join(". ") : ""].filter(Boolean).join(" ");

  const devaminiAc = async (tur: FoyTur) => {
    await hemenKaydet();
    const yeni = bosFoy({ tur, oncekiId: f.id, muvekkil: f.muvekkil, karsiTaraf: f.karsiTaraf, taraf: f.taraf, davaTuru: f.davaTuru, notlar: t("{ad} dosyasının devamı.", { ad: [tb.ad, f.esasNo].filter(Boolean).join(" ") }) });
    if (tur === "ceza" && f.tur === "sorusturma") yeni.asama = "Tensip";
    await foyKaydet(yeni);
    onAc(yeni.id);
  };
  const baglanabilir = liste.filter(x => x.id !== f.id && !donguMu(f, x.id, liste))
    .filter(x => { const q = baglaAra.trim().toLocaleLowerCase("tr"); return !q || [x.muvekkil, x.karsiTaraf, x.mahkeme, x.esasNo].join(" ").toLocaleLowerCase("tr").includes(q); })
    .slice(0, 12);

  const alanEl = (etiket: string, deger: string, alan: keyof Foy, ph?: string) => (
    <View style={s.alan} key={alan + ":" + surum}>
      <Text style={s.label}>{t(etiket)}</Text>
      <TextInput defaultValue={deger} onChangeText={v => degistir({ [alan]: v } as Partial<Foy>)} placeholder={ph ? t(ph) : undefined} placeholderTextColor={C.muted} style={s.inputTek} />
    </View>
  );
  const mb = f.muvekkilBilgi || {};
  const mbDolu = Object.values(mb).filter(x => (x || "").trim()).length;
  const mbEl = (etiket: string, k: keyof MuvekkilBilgi, ph?: string) => (
    <View style={s.alan} key={"m" + k + ":" + surum}>
      <Text style={s.label}>{t(etiket)}</Text>
      <TextInput defaultValue={mb[k] || ""} onChangeText={v => degistir({ muvekkilBilgi: { ...(son.current?.muvekkilBilgi || f.muvekkilBilgi || {}), [k]: v } })} placeholder={ph ? t(ph) : undefined} placeholderTextColor={C.muted} multiline={k === "adres" || k === "ek"} style={s.inputTek} />
    </View>
  );
  const kb = f.karsiBilgi || {};
  const kbDolu = Object.values(kb).filter(x => (x || "").trim()).length;
  const kbEl = (etiket: string, k: keyof KarsiBilgi, ph?: string) => (
    <View style={s.alan} key={"k" + k + ":" + surum}>
      <Text style={s.label}>{t(etiket)}</Text>
      <TextInput defaultValue={kb[k] || ""} onChangeText={v => degistir({ karsiBilgi: { ...(son.current?.karsiBilgi || f.karsiBilgi || {}), [k]: v } })} placeholder={ph ? t(ph) : undefined} placeholderTextColor={C.muted} multiline={k === "adres" || k === "ek"} style={s.inputTek} />
    </View>
  );
  /** Okunmuş evraktan künyenin boş alanlarını doldurur (cihazda; metin hiçbir yere gitmez). */
  const kunyeEvraktan = (evraklar: FoyEvrak[], temel: Foy): Partial<Foy> => {
    let x: Foy = temel; const tum: string[] = [];
    for (const e of [...evraklar].sort((a, b) => a.eklenme.localeCompare(b.eklenme))) {
      if (!e.metin.trim()) continue;
      const o = kunyeCikar(e.metin);
      // İcra föyünde künyedeki merci icra dairesidir: ilamın, çekin ya da faturanın mahkemesi/numarası oraya yazılmaz (icra bilgilerine gider).
      if ((temel.tur === "icra") && !/İCRA/.test((o.mahkeme || "").toLocaleUpperCase("tr"))) { o.mahkeme = undefined; o.esasNo = undefined; }
      // Çek ve senette keşideci borçludur (karşı taraf), müvekkil değil.
      if (temel.tur === "icra" && /^(cek|senet)$/.test(evrakTuruBul(e.metin))) { o.ikinci = o.ikinci || o.birinci; o.birinci = undefined; }
      const r = kunyeyiDoldur(x, o);
      if (r.dolan.length) { x = { ...x, ...r.ek }; tum.push(...r.dolan); }
    }
    const ek: Partial<Foy> = {};
    for (const k of ["mahkeme", "esasNo", "davaTuru", "durusma", "muvekkil", "karsiTaraf", "muvekkilBilgi", "karsiBilgi"] as const) if (x[k] !== temel[k]) (ek as Record<string, unknown>)[k] = x[k];
    setKunyeMesaj(tum.length ? t("Evraktan dolduruldu: {x}. Kontrol edin.", { x: [...new Set(tum)].join(", ") }) : t("Evrakta künyeye eklenecek yeni bilgi bulunamadı (yalnız boş alanlar doldurulur)."));
    if (tum.length) setSurum(v => v + 1);
    if (ek.durusma) setDurusmaYazi(tarihYaz(ek.durusma));
    return ek;
  };
  const g = kacGun(f.durusma);
  const acik = f.gorevler.filter(x => !x.bitti).sort((a, b) => (a.tarih || "9999").localeCompare(b.tarih || "9999"));
  const biten = f.gorevler.filter(x => x.bitti);
  const taraflar = tarafAdlari(f.tur);
  // Evrak kronolojik: kendi tarihi (karar, tutanak, dilekçe tarihi) ya da eklenme günü.
  const evrakSira = (a: FoyEvrak, b: FoyEvrak) => (a.tarih || a.eklenme.slice(0, 10)).localeCompare(b.tarih || b.eklenme.slice(0, 10));
  const onemli = f.evraklar.filter(e => e.onemli !== false).sort(evrakSira), onemsiz = f.evraklar.filter(e => e.onemli === false).sort(evrakSira);
  const halka = (x: Foy, ben = false) => (
    <Pressable key={x.id} onPress={ben ? undefined : async () => { await hemenKaydet(); onAc(x.id); }} style={[s.zHalka, ben && s.zHalkaOn]}>
      <Text style={s.meta}>{turBilgi(x.tur).kisa}</Text>
      <Text style={s.fileT} numberOfLines={1}>{x.esasNo || x.mahkeme || foyBaslik(x)}</Text>
    </Pressable>
  );
  const evrakSatir = (e: FoyEvrak) => (
    <View key={e.id} style={{ gap: 6 }}>
      <View style={[s.file, e.onemli === false && s.onemsiz]}>
        <Kutu acik={secim.has(e.id)} onPress={() => setSecim(x => { const y = new Set(x); if (y.has(e.id)) y.delete(e.id); else y.add(e.id); return y; })} etiket={t("{ad} seç", { ad: e.ad })} />
        <IconBadge name="notes" size={30} />
        <View style={{ flex: 1 }}>
          <Text style={s.fileT} numberOfLines={1}>{e.ad}</Text>
          <Text style={s.hint}>{e.tarih ? t("evrak tarihi {d}", { d: tarihYaz(e.tarih) }) + " · " : ""}{boyutYaz(e.boyut)} · {t("eklendi {d}", { d: tarihYaz(e.eklenme.slice(0, 10)) })}{e.okunamadi ? " · " + t("metni okunamadı: {n}", { n: e.okunamadi }) : e.metin.trim() ? "" : e.bulutMetin ? " · " + t("metni bulutta (kodlu)") : " · " + t("metin yok")}{e.kaynak ? " · DavaTek" : ""}</Text>
          <View style={[s.row, { gap: 12 }]}>
            <Pressable onPress={() => setTurSec(turSec === e.id ? null : e.id)}><Text style={s.link}>{t(e.tur || "Tür seç")} ▾</Text></Pressable>
            <Pressable onPress={() => evrakDegistir(e, { onemli: e.onemli === false })}><Text style={s.link}>{e.onemli === false ? t("☆ Önemsiz") : t("★ Önemli")}</Text></Pressable>
            {!!e.maskeli && <Pressable onPress={() => setKodluGor(kodluGor === e.id ? null : e.id)}><Text style={s.sil}>{t("Kodlu hâli")}</Text></Pressable>}
          </View>
        </View>
        <Pressable onPress={() => evrakAc(e)}><Text style={s.link}>{t("Aç")}</Text></Pressable>
        <Pressable onPress={() => evrakDegistir(e, null)}><Text style={s.sil}>{t("Sil")}</Text></Pressable>
      </View>
      {turSec === e.id && (
        <Acilir etiket={t("Evrak türü")} secili={e.tur || ""} genislik={240} acikBasla onSec={x => { evrakDegistir(e, { tur: x }); setTurSec(null); }}
          secenekler={EVRAK_TURLERI.map(x => ({ k: x, ad: t(x) }))} />
      )}
      {kodluGor === e.id && !!e.maskeli && (
        <View style={s.warn}>
          <Text style={s.hint}>{t("Bu evrakın dışarı gidebilecek tek hâli budur: kişi, kurum, numara ve adresler kodlanmıştır. Kodların karşılıkları yalnız bu cihazda.")}</Text>
          <Text style={s.body}>{e.maskeli.slice(0, 1500)}{e.maskeli.length > 1500 ? " …" : ""}</Text>
        </View>
      )}
    </View>
  );

  const geri = async () => { await hemenKaydet(); onKapat(); };
  return (
    <View style={{ flex: 1 }}>
    <ScrollView ref={nav.ref} onScroll={nav.onScroll} scrollEventThrottle={64} contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
      <View style={s.head}><Btn kind="ghost" label={t("‹ Föylere dön")} onPress={geri} /></View>
      <Text style={s.eyebrow}>{[tb.kisa, f.asama, f.mahkeme, f.esasNo].filter(Boolean).join(" · ").toLocaleUpperCase("tr")}</Text>
      <Text style={s.title}>{foyBaslik(f)}</Text>
      {f.ozel && <Text style={[s.turChip, s.ozelChip]}>🔒 {t("ŞAHSİ DOSYA · ŞİFRELİ SAKLANIR")}</Text>}

      <View style={s.card}>
        <View style={s.row}>
          <Btn label={soruluyor ? t("Bakılıyor…") : t("Dosya ne durumda?")} onPress={durumSor} disabled={soruluyor || !onemli.some(e => e.metin.trim() || e.bulutMetin)} />
          {DAVA.includes(f.tur || "hukuk") && <Btn kind="secondary" label={t("Duruşmaya hazırlan")} onPress={async () => { await hemenKaydet(); onHazirlan(f); }} disabled={!f.evraklar.some(e => e.metin.trim())} />}
        </View>
        <Text style={s.hint}>{t("Dosya ne durumda: önemli evrak (kararlar, bilirkişi raporları, tutanaklar, dilekçeler) cihazda kodlanıp yapay zekâya gönderilir; özet, süreler ve yapılacak işler föye yazılır{k}. Önemsiz işaretlenen evrak (tebligat, makbuz, vekâletname) gönderilmez.", { k: bedava ? "" : " (" + t("{n} kredi", { n: EVRAK_KREDI.evrak }) + ")" })}</Text>
        {soruluyor && <Text style={s.hint}>{t("Bir-üç dakika sürebilir; sayfayı açık tutun.")}</Text>}
        {!!err && <Text style={s.err}>{err}</Text>}
      </View>

      {f.degerlendirme && (
        <View style={s.card}>
          <Text style={s.cardT}>{t("Dosyanın durumu")}</Text>
          <Text style={s.hint}>{tarihYaz(f.degerlendirme.tarih.slice(0, 10))} · {t("Yardım amaçlıdır; süreleri ve sonucu kendiniz doğrulayın.")}</Text>
          {sesliOkumaVar() && (
            <View style={s.row}>
              {okuyor ? <Btn kind="secondary" label={t("■ Durdur")} onPress={sesliDur} /> : <Btn kind="secondary" label={t("🔊 Sesli dinle")} onPress={() => sesliOku(okunacak(f.degerlendirme!), hiz)} />}
              <Acilir etiket={t("Okuma hızı")} secili={String(hiz)} genislik={110} onSec={k => { const h = Number(k); setHiz(h); if (okuyor) sesliOku(okunacak(f.degerlendirme!), h); }}
                secenekler={[0.8, 1, 1.25, 1.5].map(h => ({ k: String(h), ad: String(h).replace(".", ",") + "×" }))} />
            </View>
          )}
          {sesliOkumaVar() && !yerelSesVar() && <Text style={s.hint}>{t("Bu bilgisayarda yerel Türkçe ses yok; tarayıcının çevrim içi sesi kullanılır.")}</Text>}
          <Text style={s.body}>{f.degerlendirme.ozet}</Text>
          {f.degerlendirme.sureler.length > 0 && <><Text style={s.secT}>{t("Süreler")}</Text>{f.degerlendirme.sureler.map((x, i) => <Text key={i} style={s.body}>• {x}</Text>)}</>}
          {f.degerlendirme.uyusmazlik.length > 0 && <><Text style={s.secT}>{t("Çekişmeli konular")}</Text>{f.degerlendirme.uyusmazlik.map((x, i) => <Text key={i} style={s.body}>• {x}</Text>)}</>}
          {f.degerlendirme.zayif.length > 0 && <><Text style={s.secT}>{t("Zayıf noktalar ve riskler")}</Text>{f.degerlendirme.zayif.map((x, i) => <Text key={i} style={s.body}>• {x}</Text>)}</>}
        </View>
      )}

      <Katlanir anahtar="zincir" baslik={t("Dosya zinciri")} ozet={zin.onceki.length + zin.sonraki.length + (f.ilgiliIds?.length || 0) ? t("{n} bağlı dosya", { n: zin.onceki.length + zin.sonraki.length + (f.ilgiliIds?.length || 0) }) : t("bağlı dosya yok")}>
        <View style={s.zincir}>
          {zin.onceki.map(x => <React.Fragment key={x.id}>{halka(x)}<Text style={s.hint}>→</Text></React.Fragment>)}
          {halka(f, true)}
          {zin.sonraki.map(x => <React.Fragment key={x.id}><Text style={s.hint}>→</Text>{halka(x)}</React.Fragment>)}
        </View>
        {tb.sonraki.length > 0 && (
          <>
            <Text style={s.label}>{t("Devamını aç (dönüştü)")}</Text>
            <View style={s.chips}>
              {tb.sonraki.map(x => (
                <Pressable key={x} onPress={() => devaminiAc(x)} style={s.chip}><Text style={s.chipT}>+ {t(turBilgi(x).ad)}</Text></Pressable>
              ))}
            </View>
          </>
        )}
        {!!f.ilgiliIds?.length && (
          <>
            <Text style={s.label}>{t("İlgili dosyalar")}</Text>
            <View style={s.chips}>
              {f.ilgiliIds.map(id => liste.find(x => x.id === id)).filter((x): x is Foy => !!x).map(x => (
                <View key={x.id} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  {halka(x)}
                  <Pressable accessibilityLabel={t("Bağlantıyı kaldır")} hitSlop={6} onPress={() => { degistir({ ilgiliIds: (f.ilgiliIds || []).filter(y => y !== x.id) }); foyGetir(x.id).then(o => o && foyKaydet({ ...o, ilgiliIds: (o.ilgiliIds || []).filter(y => y !== f.id) }, true)).catch(() => {}); }}><Text style={s.hint}>✕</Text></Pressable>
                </View>
              ))}
            </View>
          </>
        )}
        <View style={s.row}>
          <Btn kind="ghost" label={baglaAc ? t("Vazgeç") : f.oncekiId ? t("Önceki dosyayı değiştir") : t("Önceki bir dosyaya bağla")} onPress={() => setBaglaAc(!baglaAc)} />
          {!!f.oncekiId && <Btn kind="ghost" label={t("Bağlantıyı kaldır")} onPress={() => degistir({ oncekiId: undefined })} />}
        </View>
        {baglaAc && (
          <View style={{ gap: 6 }}>
            <TextInput value={baglaAra} onChangeText={setBaglaAra} placeholder={t("Ara: müvekkil, karşı taraf, esas no…")} placeholderTextColor={C.muted} style={s.inputTek} />
            {baglanabilir.map(x => (
              <Pressable key={x.id} onPress={() => { degistir({ oncekiId: x.id }); setBaglaAc(false); }} style={s.foy}>
                <View style={{ flex: 1 }}>
                  <Text style={s.meta}>{turBilgi(x.tur).kisa}</Text>
                  <Text style={s.fileT} numberOfLines={1}>{foyBaslik(x)}</Text>
                  <Text style={s.hint} numberOfLines={1}>{[x.mahkeme, x.esasNo].filter(Boolean).join(" · ")}</Text>
                </View>
              </Pressable>
            ))}
            {!baglanabilir.length && <Text style={s.hint}>{t("Bağlanabilecek föy yok.")}</Text>}
          </View>
        )}
      </Katlanir>

      <Katlanir anahtar="kunye" baslik={t("Künye")} varsayilan={!f.mahkeme && !f.muvekkil} ozet={[f.mahkeme, f.esasNo, f.muvekkil].filter(Boolean).join(" · ")}>
        {f.evraklar.some(e => e.metin.trim()) && (
          <View style={[s.row, { alignItems: "center" }]}>
            <Btn kind="ghost" label={t("Künyeyi evraktan doldur")} onPress={() => { const ek = kunyeEvraktan(f.evraklar, f); if (Object.keys(ek).length) degistir(ek); }} />
            <Text style={[s.hint, { flex: 1 }]}>{t("Mahkeme, esas no, taraflar, vekiller, kimlik no, adres, duruşma günü ve vekâletname bilgisi evrakın kendisinden, bu cihazda okunur. Yalnız boş alanlar doldurulur.")}</Text>
          </View>
        )}
        {!!kunyeMesaj && <Text style={[s.hint, { color: C.brass }]}>{kunyeMesaj}</Text>}
        <View style={s.alanlar}>
          {alanEl("Müvekkil", f.muvekkil, "muvekkil")}
          {alanEl("Karşı taraf", f.karsiTaraf, "karsiTaraf")}
          <View style={[s.alan, { flexBasis: "100%" }]}>
            <Pressable onPress={() => setMuvAc(!muvAc)}><Text style={s.link}>{muvAc ? "▾ " : "▸ "}{t("Müvekkil bilgileri")}{mbDolu ? " · " + t("{n} alan dolu", { n: mbDolu }) : ""}</Text></Pressable>
            {muvAc && (
              <View style={[s.alanlar, { marginTop: 6 }]}>
                {mbEl("T.C. kimlik / vergi no", "kimlikNo")}
                {mbEl("Telefon", "telefon")}
                {mbEl("E-posta", "eposta")}
                {mbEl("Adres", "adres")}
                {mbEl("Vekâletname (noterlik, tarih, yevmiye no)", "vekaletname", "İzmir 5. Noterliği, 12.03.2026, 12345")}
                {mbEl("Diğer bilgiler (diğer müvekkiller, yetkili, notlar)", "ek")}
                <Text style={[s.hint, { flexBasis: "100%" }]}>{t("Bu bilgiler yalnız bu cihazda (eşitlemede şifreli) durur; yapay zekâya hiç gönderilmez.")}</Text>
              </View>
            )}
            <Pressable onPress={() => setKarsiAc(!karsiAc)} style={{ marginTop: 6 }}><Text style={s.link}>{karsiAc ? "▾ " : "▸ "}{t("Karşı taraf bilgileri")}{kbDolu ? " · " + t("{n} alan dolu", { n: kbDolu }) : ""}</Text></Pressable>
            {karsiAc && (
              <View style={[s.alanlar, { marginTop: 6 }]}>
                {kbEl("Vekili (ad, baro, sicil no)", "vekil", "Örn. Av. … · İzmir Barosu · 12345")}
                {kbEl("T.C. kimlik / vergi no", "kimlikNo")}
                {kbEl("Telefon", "telefon")}
                {kbEl("E-posta", "eposta")}
                {kbEl("Adres", "adres")}
                {kbEl("Diğer bilgiler", "ek")}
                <Text style={[s.hint, { flexBasis: "100%" }]}>{t("Bu bilgiler yalnız bu cihazda (eşitlemede şifreli) durur; yapay zekâya hiç gönderilmez.")}</Text>
              </View>
            )}
          </View>
          {alanEl(tb.merci, f.mahkeme, "mahkeme", tb.merciOrnek ? "Örn. " + tb.merciOrnek : undefined)}
          {alanEl(tb.no, f.esasNo, "esasNo", "Örn. 2026/123")}
          <View style={s.alan} key={"acilis:" + surum}>
            <Text style={s.label}>{t("Açılış tarihi")}</Text>
            <TextInput defaultValue={tarihYaz(f.acilis)} onChangeText={v => { const d = tarihCoz(v); if (d || !v.trim()) degistir({ acilis: d ? d.slice(0, 10) : undefined }); }} placeholder={t("Örn. 05.01.2026")} placeholderTextColor={C.muted} style={s.inputTek} />
          </View>
          {alanEl(f.tur === "idari_sorusturma" || f.tur === "baro" || f.tur === "sorusturma" ? "Soruşturma konusu" : "Dava konusu", f.davaTuru, "davaTuru")}
          <View style={s.alan}>
            <Text style={s.label}>{t("Sonraki duruşma / toplantı")}</Text>
            <TextInput value={durusmaYazi} onChangeText={v => { setDurusmaYazi(v); const d = tarihCoz(v); if (d || !v.trim()) degistir({ durusma: d }); }} placeholder={t("Örn. 12.03.2027 10:30")} placeholderTextColor={C.muted} style={s.inputTek} />
            {!!f.durusma && <Text style={[s.hint, g !== undefined && g >= 0 && g <= 7 && { color: C.brass }]}>{gunYaz(g)}</Text>}
            {!!durusmaYazi.trim() && !tarihCoz(durusmaYazi) && <Text style={s.err}>{t("Tarihi 12.03.2027 ya da 12.03.2027 10:30 biçiminde yazın.")}</Text>}
          </View>
        </View>
        {/* Dosya türü, aşama ve hangi dava: açılır kutularda; kutuya basınca başlıklar altına doğru listelenir. */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
          <Acilir etiket={t("Dosya türü")} secili={f.tur || "hukuk"} genislik={230}
            onSec={k => { const x = TURLER.find(y => y.tur === k)!; degistir({ tur: x.tur, asama: x.asamalar.includes(f.asama || "") ? f.asama : undefined }); }}
            secenekler={TURLER.filter(x => !x.eski || x.tur === f.tur).map(x => ({ k: x.tur, ad: t(x.ad) }))} />
          <Acilir etiket={t("Aşama")} secili={f.asama || "-"} genislik={200} onSec={k => degistir({ asama: k === "-" ? undefined : k })}
            secenekler={[{ k: "-", ad: t("Belirtilmemiş") }, ...tb.asamalar.map(x => ({ k: x, ad: t(x) }))]} />
          {(!!DAVA_TURLERI[f.tur || "hukuk"]?.length || !!f.davaTuru) && (
            <Acilir etiket={f.tur === "idari_sorusturma" || f.tur === "baro" || f.tur === "sorusturma" ? t("Hangi soruşturma") : t("Hangi dava")} secili={f.davaTuru || "-"} genislik={260}
              onSec={k => degistir({ davaTuru: k === "-" ? "" : k })}
              secenekler={[{ k: "-", ad: t("Belirtilmemiş") }, ...[...(DAVA_TURLERI[f.tur || "hukuk"] || []), ...(f.davaTuru && !(DAVA_TURLERI[f.tur || "hukuk"] || []).includes(f.davaTuru) ? [f.davaTuru] : [])].map(x => ({ k: x, ad: t(x) }))]} />
          )}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
          {taraflar && <Acilir etiket={t("Hangi tarafın vekiliyiz")} secili={f.taraf || "davaci"} genislik={220} onSec={k => degistir({ taraf: k as "davaci" | "davali" })}
            secenekler={(["davaci", "davali"] as const).map((k, i) => ({ k, ad: t(taraflar[i]) }))} />}
          <Acilir etiket={t("Dosya durumu")} secili={f.durum || "acik"} genislik={140} onSec={k => degistir({ durum: k as "acik" | "kapali", ...(k === "kapali" && !f.kapanis ? { kapanis: new Date().toISOString().slice(0, 10) } : {}) })}
            secenekler={[{ k: "acik", ad: t("Açık") }, { k: "kapali", ad: t("Kapalı") }]} />
          {f.durum === "kapali" && (
            <View style={{ gap: 4, minWidth: 150 }} key={"kapanis:" + surum}>
              <Text style={{ color: C.muted, fontSize: 11, letterSpacing: 0.5 }}>{t("Kapanış / kesinleşme")}</Text>
              <TextInput defaultValue={tarihYaz(f.kapanis)} onChangeText={v => { const d = tarihCoz(v); if (d || !v.trim()) degistir({ kapanis: d ? d.slice(0, 10) : undefined }); }} placeholder="GG.AA.YYYY" placeholderTextColor={C.muted} style={s.inputTek} />
            </View>
          )}
          {komisyonaUygun(f) && <Acilir etiket={t("Tazminat Komisyonu (6384)")} secili={f.komisyon?.durum || "yok"} genislik={210}
            onSec={k => degistir({ komisyon: { ...(f.komisyon || {}), durum: k as "yok" | "basvuruldu" | "sonuclandi", ...(k !== "yok" && !f.komisyon?.tarih ? { tarih: new Date().toISOString().slice(0, 10) } : {}) } })}
            secenekler={[{ k: "yok", ad: t("Başvurulmadı") }, { k: "basvuruldu", ad: t("Başvuruldu") }, { k: "sonuclandi", ad: t("Sonuçlandı") }]} />}
          {komisyonaUygun(f) && f.komisyon && f.komisyon.durum !== "yok" && (
            <View style={{ gap: 4, minWidth: 150 }} key={"kom:" + surum}>
              <Text style={{ color: C.muted, fontSize: 11, letterSpacing: 0.5 }}>{t("Komisyon başvuru tarihi / no")}</Text>
              <TextInput defaultValue={[tarihYaz(f.komisyon.tarih), f.komisyon.no].filter(Boolean).join(" · ")} onChangeText={v => { const d = tarihCoz(v.split("·")[0].trim()); const no = v.split("·")[1]?.trim(); degistir({ komisyon: { ...f.komisyon!, tarih: d ? d.slice(0, 10) : f.komisyon!.tarih, no: no || undefined } }); }} placeholder="GG.AA.YYYY · 2024/1234" placeholderTextColor={C.muted} style={s.inputTek} />
            </View>
          )}
        </View>
        <Text style={s.label}>{t("Notlar")}</Text>
        <TextInput defaultValue={f.notlar} onChangeText={v => degistir({ notlar: v })} multiline placeholder={t("Dosyayla ilgili notlarınız")} placeholderTextColor={C.muted} style={s.input} />
      </Katlanir>

      {(f.tur === "icra" || !!f.icra) && (
        <Katlanir anahtar="icra" baslik={t("İcra takibi bilgileri")} varsayilan ozet={f.icra?.asil ? t("asıl alacak {x}", { x: tl(f.icra.asil, f.icra.paraBirimi || "TL") }) : t("doldurulmadı")}>
          {!!icraMesaj && <Text style={[s.hint, { color: C.good }]}>{icraMesaj}</Text>}
          <IcraBolum f={f} degistir={degistir} surum={surum} okuma={okuma} onEvrakEkle={dosyaSaklanir() ? () => evrakEkle() : undefined} onEvraktan={() => {
            const r = icraDoldur(f.icra || { yol: "genel", paraBirimi: "TL", faizTuru: "yasal" }, f.evraklar.map(e => e.metin));
            if (r.dolan.length) { degistir({ icra: r.yeni }); setSurum(v => v + 1); }
            setIcraMesaj(r.dolan.length ? t("İcra bilgileri evraktan dolduruldu: {x}. Kontrol edin.", { x: r.dolan.join(", ") }) : f.evraklar.some(e => e.metin.trim()) ? t("Evrakta ilam, çek, senet, kira sözleşmesi ya da fatura bulunamadı; ya da alanlar zaten dolu (yalnız boş alanlar doldurulur).") : t("Önce aşağıdaki Evrak bölümünden takibe konu evrakı (ilam, çek, senet, kira sözleşmesi, fatura) ve varsa vekâletnameyi ekleyin."));
          }} />
        </Katlanir>
      )}

      <Katlanir anahtar="mesaj" baslik={t("Müvekkile mesaj")} ozet={t("WhatsApp / Telegram")}><MuvekkilMesaj f={f} ic /></Katlanir>

      <Katlanir anahtar="gorev" baslik={t("Yapılacaklar")} ozet={acik.length ? t("{n} açık iş", { n: acik.length }) : t("açık iş yok")}>
        {acik.map(x => (
          <View key={x.id} style={s.gorev}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: false }} onPress={() => gorevDegistir(x, { bitti: true })} style={s.box} />
            <View style={{ flex: 1 }}>
              <Text style={s.body}>{x.metin}</Text>
              <Text style={s.hint}>{[x.tarih ? tarihYaz(x.tarih) + " · " + gunYaz(kacGun(x.tarih)) : "", x.kaynak === "yapay" ? t("yapay zekâ önerisi, kontrol edin") : ""].filter(Boolean).join(" · ")}</Text>
            </View>
            <Pressable onPress={() => gorevDegistir(x, null)}><Text style={s.sil}>{t("Sil")}</Text></Pressable>
          </View>
        ))}
        <View style={s.addRow}>
          <TextInput value={yeniGorev} onChangeText={setYeniGorev} onSubmitEditing={gorevEkle} placeholder={t("Yeni iş: ör. bilirkişi raporuna itiraz")} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1 }]} />
          <TextInput value={gorevTarih} onChangeText={setGorevTarih} onSubmitEditing={gorevEkle} placeholder={t("son gün")} placeholderTextColor={C.muted} style={[s.inputTek, { width: 120 }]} />
          <Btn kind="secondary" label={t("Ekle")} onPress={gorevEkle} />
        </View>
        {biten.length > 0 && <Text style={s.hint}>{t("Tamamlanan")}: {biten.map(x => x.metin).join(" · ")}</Text>}
      </Katlanir>

      <Katlanir anahtar="evrak" baslik={`${t("Evrak")} (${f.evraklar.length})`} zorla={!!ekle} ozet={f.evraklar.length ? t("{n} evrak", { n: f.evraklar.length }) : t("evrak yok")}>
        <Text style={s.hint}>{t("UDF, Word, PDF, TIF, fotoğraf ya da UYAP/DavaTek'ten inen ZIP. Dosyalar bu cihazda saklanır; taranmış evrakın yazısı da burada okunur. Her evrakın türü ve önemi kendiliğinden belirlenir, değiştirebilirsiniz.")}</Text>
        {dosyaSaklanir() ? (
          <View style={s.row}>
            {!!ekle && <Btn label={t("{tur} ekle", { tur: t(ekle) })} onPress={() => evrakEkle(ekle)} disabled={!!okuma} />}
            <Btn kind="secondary" label={t("Evrak ekle")} onPress={() => evrakEkle()} disabled={!!okuma} />
          </View>
        ) : <Text style={s.hint}>{t("Telefondan evrak ekleme uygulamanın bir sonraki sürümünde gelecek; şimdilik evrakı bilgisayardan ekleyin, bulut eşitlemesiyle buraya gelir.")}</Text>}
        {!!okuma && <Text style={s.hint}>{okuma}</Text>}
        {!!onAyir && f.evraklar.length > 1 && dosyaSaklanir() && (
          <View style={[s.row, { alignItems: "center" }]}>
            <Btn kind="secondary" label={t("Evrakı föylere ayır")} onPress={async () => { await hemenKaydet(); const g = await foyGetir(f.id); onAyir(g || f); }} />
            <Text style={[s.hint, { flex: 1 }]}>{t("Farklı dosyalara ait evrak bu föyde toplandıysa: Celse her evrakın dosya numarasını, merciini ve taraflarını okur, ait olduğu föye taşır ya da yeni föy açar. Önce önizleme gösterir.")}</Text>
          </View>
        )}
        {f.evraklar.length > 0 && (() => {
          const liste = evrakSuz === "onemli" ? onemli : evrakSuz === "onemsiz" ? onemsiz : [...onemli, ...onemsiz];
          const sayfaSay = Math.max(1, Math.ceil(liste.length / evrakBoy));
          const cur = Math.min(evrakSayfa, sayfaSay - 1);
          const sayfadaki = liste.slice(cur * evrakBoy, cur * evrakBoy + evrakBoy);
          const hepsiSecili = liste.length > 0 && liste.every(e => secim.has(e.id));
          const sayfaGec = (n: number) => { setEvrakSayfa(Math.max(0, Math.min(sayfaSay - 1, n))); };
          const sayfalama = sayfaSay > 1 && (
            <View style={[s.row, { alignItems: "center" }]}>
              <Btn kind="ghost" label={t("‹ Önceki")} disabled={cur === 0} onPress={() => sayfaGec(cur - 1)} />
              <Text style={s.hint}>{t("Sayfa {a} / {b} · {c}–{d} / {e} evrak", { a: cur + 1, b: sayfaSay, c: cur * evrakBoy + 1, d: Math.min(liste.length, (cur + 1) * evrakBoy), e: liste.length })}</Text>
              <Btn kind="ghost" label={t("Sonraki ›")} disabled={cur >= sayfaSay - 1} onPress={() => sayfaGec(cur + 1)} />
            </View>
          );
          return (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
                <Acilir etiket={t("Göster")} secili={evrakSuz} genislik={170} onSec={k => { setEvrakSuz(k as typeof evrakSuz); setEvrakSayfa(0); }}
                  secenekler={[{ k: "hepsi", ad: t("Hepsi"), n: f.evraklar.length }, { k: "onemli", ad: t("Önemli"), n: onemli.length }, { k: "onemsiz", ad: t("Önemsiz"), n: onemsiz.length }]} />
                <Acilir etiket={t("Sayfada")} secili={String(evrakBoy)} genislik={90} onSec={k => setEvrakBoy(Number(k))} secenekler={[5, 10, 25, 50, 100].map(n => ({ k: String(n), ad: String(n) }))} />
              </View>
              <View style={[s.file, { alignItems: "center", flexWrap: "wrap" }]}>
                <Kutu acik={hepsiSecili} yarim={!hepsiSecili && liste.some(e => secim.has(e.id))} etiket={t("Tümünü seç")}
                  onPress={() => setSecim(hepsiSecili ? new Set([...secim].filter(id => !liste.some(e => e.id === id))) : new Set([...secim, ...liste.map(e => e.id)]))} />
                <Text style={[s.fileT, { flex: 1 }]}>{secim.size ? t("{n} evrak seçili", { n: secim.size }) : t("Tümünü seç ({n})", { n: liste.length })}</Text>
                {secim.size > 0 && !topluSil && (
                  <>
                    <Btn kind="ghost" label={t("★ Önemli yap")} onPress={() => topluIslem({ onemli: true })} />
                    <Btn kind="ghost" label={t("☆ Önemsiz yap")} onPress={() => topluIslem({ onemli: false })} />
                    <Btn kind="ghost" label={t("Seçilenleri sil")} onPress={() => setTopluSil(true)} />
                    <Btn kind="ghost" label={t("Seçimi kaldır")} onPress={() => setSecim(new Set())} />
                  </>
                )}
                {topluSil && (
                  <>
                    <Text style={[s.err, { alignSelf: "center" }]}>{t("{n} evrak bu föyden silinecek.", { n: secim.size })}</Text>
                    <Btn kind="ghost" label={t("Evet, sil")} onPress={() => topluIslem(null)} />
                    <Btn kind="ghost" label={t("Vazgeç")} onPress={() => setTopluSil(false)} />
                  </>
                )}
              </View>
              {sayfalama}
              {sayfadaki.map(evrakSatir)}
              {!sayfadaki.length && <Text style={s.hint}>{t("Bu bölümde evrak yok.")}</Text>}
              {sayfalama}
            </>
          );
        })()}
      </Katlanir>

      <View style={s.row}>
        <Btn kind="ghost" label={f.ozel ? t("🔓 Şahsi dosyalardan çıkar") : t("🔒 Şahsi dosyalarıma taşı")} onPress={async () => {
          setErr("");
          if ((await ozelKilitDurumu()) !== "acik") { setErr(t("Önce Föylerim ekranında şahsi dosyaları şifreyle açın (şifre kurulu değilse oradan kurun).")); return; }
          try { await hemenKaydet(); const y = await foyOzelYap(son.current || f, !f.ozel); son.current = null; setF(y); }
          catch (e) { setErr(t(String((e as Error).message || e))); }
        }} />
        {!silOnay ? <Btn kind="ghost" label={t("Föyü sil")} onPress={() => setSilOnay(true)} />
          : <><Text style={[s.err, { alignSelf: "center" }]}>{t("Föy, evrakı ve görevleriyle bu cihazdan silinecek.")}</Text>
            <Btn kind="ghost" label={t("Evet, sil")} onPress={async () => { if (zaman.current) clearTimeout(zaman.current); zaman.current = null; son.current = null; await foySil(f); onKapat(); }} />
            <Btn kind="ghost" label={t("Vazgeç")} onPress={() => setSilOnay(false)} /></>}
      </View>
    </ScrollView>
    <FloatingNav nav={nav} onBack={geri} backLabel={t("‹ Föylere dön")} />
    </View>
  );
}

/** Seçim kutusu (☐ / ☑ / yarım ▣). */
function Kutu({ acik, yarim, onPress, etiket }: { acik: boolean; yarim?: boolean; onPress: () => void; etiket: string }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: yarim ? "mixed" : acik }} accessibilityLabel={etiket} onPress={onPress} hitSlop={8}
      style={{ width: 24, height: 24, borderRadius: 5, borderWidth: 2, borderColor: acik || yarim ? C.brass : C.muted, backgroundColor: acik ? C.brass : "transparent", alignItems: "center", justifyContent: "center" }}>
      {acik ? <Text style={{ color: C.brassInk, fontWeight: "800", fontSize: 15, lineHeight: 18 }}>✓</Text> : yarim ? <View style={{ width: 10, height: 3, backgroundColor: C.brass }} /> : null}
    </Pressable>
  );
}
