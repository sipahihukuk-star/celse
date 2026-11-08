// Föy sayfası: tür ve aşama, dosya zinciri (öncesi ve devamı), künye, yapılacaklar, evrak (tür ve önem, kodlu hâli),
// "Dosya ne durumda?" (önemli evrak üzerinden yapay zekâ özeti, sesli dinleme). Her şey bu cihazda; dışarı yalnız kodlu metin gider.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { kunyeCikar, kunyeyiDoldur } from "../data/kunyeCikar";
import { MuvekkilMesaj } from "./MuvekkilMesaj";
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

export function FoySayfa({ id, liste, ekle, onKapat, onAc, onHazirlan, ucretsiz }: {
  id: string; liste: Foy[]; ekle?: string; onKapat: () => void; onAc: (id: string) => void; onHazirlan: (f: Foy) => void; ucretsiz?: boolean;
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
  const [karsiAc, setKarsiAc] = useState(false);
  const [surum, setSurum] = useState(0);
  const [kunyeMesaj, setKunyeMesaj] = useState("");
  const [soruluyor, setSoruluyor] = useState(false);
  const [baglaAc, setBaglaAc] = useState(false);
  const [baglaAra, setBaglaAra] = useState("");
  const [turSec, setTurSec] = useState<string | null>(null);
  const [kodluGor, setKodluGor] = useState<string | null>(null);
  const [onemsizAc, setOnemsizAc] = useState(false);
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
    const secilen = await dosyaSec(".udf,.doc,.docx,.txt,.pdf,.tif,.tiff,.jpg,.jpeg,.png,.zip");
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
    if (eklenen.length) degistir({ evraklar: [...f.evraklar, ...eklenen], ...kunyeEvraktan(eklenen, f) });
  };
  const evrakAc = async (e: FoyEvrak) => {
    if (!dosyaSaklanir()) { setErr(t("Asıl dosya bilgisayarınızda duruyor; telefonda yalnız künye ve kodlanmış metin vardır.")); return; }
    const b = await dosyaOku(e.id);
    if (!b) { setErr(t("Asıl dosya bu cihazda bulunamadı (yalnız okunan metni var).")); return; }
    if (/\.(pdf|jpg|jpeg|png|txt)$/i.test(e.ad)) window.open(URL.createObjectURL(b), "_blank"); else indir(e.ad, b);
  };
  const evrakDegistir = (e: FoyEvrak, ek: Partial<FoyEvrak> | null) => {
    if (!ek) { dosyaSil(e.id).catch(() => {}); degistir({ evraklar: f.evraklar.filter(x => x.id !== e.id) }); return; }
    degistir({ evraklar: f.evraklar.map(x => (x.id === e.id ? { ...x, ...ek } : x)) });
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
      const r = kunyeyiDoldur(x, kunyeCikar(e.metin));
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
  const onemli = f.evraklar.filter(e => e.onemli !== false), onemsiz = f.evraklar.filter(e => e.onemli === false);
  const halka = (x: Foy, ben = false) => (
    <Pressable key={x.id} onPress={ben ? undefined : async () => { await hemenKaydet(); onAc(x.id); }} style={[s.zHalka, ben && s.zHalkaOn]}>
      <Text style={s.meta}>{turBilgi(x.tur).kisa}</Text>
      <Text style={s.fileT} numberOfLines={1}>{x.esasNo || x.mahkeme || foyBaslik(x)}</Text>
    </Pressable>
  );
  const evrakSatir = (e: FoyEvrak) => (
    <View key={e.id} style={{ gap: 6 }}>
      <View style={[s.file, e.onemli === false && s.onemsiz]}>
        <IconBadge name="notes" size={30} />
        <View style={{ flex: 1 }}>
          <Text style={s.fileT} numberOfLines={1}>{e.ad}</Text>
          <Text style={s.hint}>{boyutYaz(e.boyut)} · {tarihYaz(e.eklenme.slice(0, 10))}{e.okunamadi ? " · " + t("metni okunamadı") : e.metin.trim() ? "" : e.bulutMetin ? " · " + t("metni bulutta (kodlu)") : " · " + t("metin yok")}{e.kaynak ? " · DavaTek" : ""}</Text>
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
        <View style={s.chips}>
          {EVRAK_TURLERI.map(x => (
            <Pressable key={x} onPress={() => { evrakDegistir(e, { tur: x }); setTurSec(null); }} style={[s.chip, e.tur === x && s.chipOn]}>
              <Text style={[s.chipT, e.tur === x && s.chipTOn]}>{t(x)}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {kodluGor === e.id && !!e.maskeli && (
        <View style={s.warn}>
          <Text style={s.hint}>{t("Bu evrakın dışarı gidebilecek tek hâli budur: kişi, kurum, numara ve adresler kodlanmıştır. Kodların karşılıkları yalnız bu cihazda.")}</Text>
          <Text style={s.body}>{e.maskeli.slice(0, 1500)}{e.maskeli.length > 1500 ? " …" : ""}</Text>
        </View>
      )}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
      <View style={s.head}><Btn kind="ghost" label={t("‹ Föylere dön")} onPress={async () => { await hemenKaydet(); onKapat(); }} /></View>
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
              <View style={s.chips}>
                {[0.8, 1, 1.25, 1.5].map(h => (
                  <Pressable key={h} onPress={() => { setHiz(h); if (okuyor) sesliOku(okunacak(f.degerlendirme!), h); }} style={[s.chip, hiz === h && s.chipOn]}>
                    <Text style={[s.chipT, hiz === h && s.chipTOn]}>{String(h).replace(".", ",")}×</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          {sesliOkumaVar() && !yerelSesVar() && <Text style={s.hint}>{t("Bu bilgisayarda yerel Türkçe ses yok; tarayıcının çevrim içi sesi kullanılır.")}</Text>}
          <Text style={s.body}>{f.degerlendirme.ozet}</Text>
          {f.degerlendirme.sureler.length > 0 && <><Text style={s.secT}>{t("Süreler")}</Text>{f.degerlendirme.sureler.map((x, i) => <Text key={i} style={s.body}>• {x}</Text>)}</>}
          {f.degerlendirme.uyusmazlik.length > 0 && <><Text style={s.secT}>{t("Çekişmeli konular")}</Text>{f.degerlendirme.uyusmazlik.map((x, i) => <Text key={i} style={s.body}>• {x}</Text>)}</>}
          {f.degerlendirme.zayif.length > 0 && <><Text style={s.secT}>{t("Zayıf noktalar ve riskler")}</Text>{f.degerlendirme.zayif.map((x, i) => <Text key={i} style={s.body}>• {x}</Text>)}</>}
        </View>
      )}

      <View style={s.card}>
        <Text style={s.cardT}>{t("Dosya zinciri")}</Text>
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
      </View>

      <View style={s.card}>
        <Text style={s.cardT}>{t("Künye")}</Text>
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
          {alanEl(f.tur === "idari_sorusturma" || f.tur === "baro" || f.tur === "sorusturma" ? "Soruşturma konusu" : "Dava konusu", f.davaTuru, "davaTuru")}
          <View style={s.alan}>
            <Text style={s.label}>{t("Sonraki duruşma / toplantı")}</Text>
            <TextInput value={durusmaYazi} onChangeText={v => { setDurusmaYazi(v); const d = tarihCoz(v); if (d || !v.trim()) degistir({ durusma: d }); }} placeholder={t("Örn. 12.03.2027 10:30")} placeholderTextColor={C.muted} style={s.inputTek} />
            {!!f.durusma && <Text style={[s.hint, g !== undefined && g >= 0 && g <= 7 && { color: C.brass }]}>{gunYaz(g)}</Text>}
            {!!durusmaYazi.trim() && !tarihCoz(durusmaYazi) && <Text style={s.err}>{t("Tarihi 12.03.2027 ya da 12.03.2027 10:30 biçiminde yazın.")}</Text>}
          </View>
        </View>
        <Text style={s.label}>{t("Dosya türü")}</Text>
        <View style={s.chips}>
          {TURLER.filter(x => !x.eski || x.tur === f.tur).map(x => (
            <Pressable key={x.tur} onPress={() => degistir({ tur: x.tur, asama: x.asamalar.includes(f.asama || "") ? f.asama : undefined })} style={[s.chip, (f.tur || "hukuk") === x.tur && s.chipOn]}>
              <Text style={[s.chipT, (f.tur || "hukuk") === x.tur && s.chipTOn]}>{t(x.ad)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.label}>{t("Aşama")}</Text>
        <View style={s.chips}>
          {tb.asamalar.map(x => (
            <Pressable key={x} onPress={() => degistir({ asama: f.asama === x ? undefined : x })} style={[s.chip, f.asama === x && s.chipOn]}>
              <Text style={[s.chipT, f.asama === x && s.chipTOn]}>{t(x)}</Text>
            </Pressable>
          ))}
        </View>
        {!!DAVA_TURLERI[f.tur || "hukuk"]?.length && (
          <>
            <Text style={s.label}>{f.tur === "idari_sorusturma" || f.tur === "baro" || f.tur === "sorusturma" ? t("Hangi soruşturma") : t("Hangi dava")}</Text>
            <View style={s.chips}>
              {DAVA_TURLERI[f.tur || "hukuk"]!.map(x => (
                <Pressable key={x} onPress={() => degistir({ davaTuru: f.davaTuru === x ? "" : x })} style={[s.chip, f.davaTuru === x && s.chipOn]}>
                  <Text style={[s.chipT, f.davaTuru === x && s.chipTOn]}>{t(x)}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
        <View style={s.chips}>
          {taraflar && (["davaci", "davali"] as const).map((k, i) => (
            <Pressable key={k} onPress={() => degistir({ taraf: k })} style={[s.chip, f.taraf === k && s.chipOn]}>
              <Text style={[s.chipT, f.taraf === k && s.chipTOn]}>{t(taraflar[i])}</Text>
            </Pressable>
          ))}
          {(["acik", "kapali"] as const).map(k => (
            <Pressable key={k} onPress={() => degistir({ durum: k })} style={[s.chip, f.durum === k && s.chipOn]}>
              <Text style={[s.chipT, f.durum === k && s.chipTOn]}>{k === "acik" ? t("Açık") : t("Kapalı")}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.label}>{t("Notlar")}</Text>
        <TextInput defaultValue={f.notlar} onChangeText={v => degistir({ notlar: v })} multiline placeholder={t("Dosyayla ilgili notlarınız")} placeholderTextColor={C.muted} style={s.input} />
      </View>

      <MuvekkilMesaj f={f} />

      <View style={s.card}>
        <Text style={s.cardT}>{t("Yapılacaklar")}</Text>
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
      </View>

      <View style={s.card}>
        <Text style={s.cardT}>{t("Evrak")} ({f.evraklar.length})</Text>
        <Text style={s.hint}>{t("UDF, Word, PDF, TIF, fotoğraf ya da UYAP/DavaTek'ten inen ZIP. Dosyalar bu cihazda saklanır; taranmış evrakın yazısı da burada okunur. Her evrakın türü ve önemi kendiliğinden belirlenir, değiştirebilirsiniz.")}</Text>
        {dosyaSaklanir() ? (
          <View style={s.row}>
            {!!ekle && <Btn label={t("{tur} ekle", { tur: t(ekle) })} onPress={() => evrakEkle(ekle)} disabled={!!okuma} />}
            <Btn kind="secondary" label={t("Evrak ekle")} onPress={() => evrakEkle()} disabled={!!okuma} />
          </View>
        ) : <Text style={s.hint}>{t("Telefondan evrak ekleme uygulamanın bir sonraki sürümünde gelecek; şimdilik evrakı bilgisayardan ekleyin, bulut eşitlemesiyle buraya gelir.")}</Text>}
        {!!okuma && <Text style={s.hint}>{okuma}</Text>}
        {onemli.map(evrakSatir)}
        {onemsiz.length > 0 && (
          <>
            <Pressable onPress={() => setOnemsizAc(!onemsizAc)}><Text style={s.link}>{onemsizAc ? "▾ " : "▸ "}{t("Önemsiz evrak ({n})", { n: onemsiz.length })}</Text></Pressable>
            {onemsizAc && onemsiz.map(evrakSatir)}
          </>
        )}
      </View>

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
  );
}
