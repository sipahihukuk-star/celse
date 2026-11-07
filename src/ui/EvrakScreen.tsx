// "Evrakla duruşma provası" (beta, yönetici): avukat dosya evrakını yükler (web: UDF, Word, metin; telefonda şimdilik yapıştırma),
// evrak CİHAZDA maskelenir, avukat onay ekranında kodlanan her değeri görür, açık bırakır ya da ek ifade gizler; sunucuya yalnız
// kodlu metin gider ve hiçbir şey kaydedilmez. Gelen hazırlık notları cihazda gerçek adlara geri çevrilir.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { Entity, Kind, mask, unmask } from "../engine/mask";
import { evrakMetni, turBul, zipIcerigi } from "../engine/mask/readers";
import { DerlemeKarti, DOGRUDAN_SINIR, derlemeKredisi, derlenmisMetin, evrakBol, kartlariBirlestir, onemSirasi, partiler } from "../engine/mask/derleme";
import { dosyaAc, EVRAK_AZAMI, evrakBiletAl, evrakDerle, evrakIzle, evrakOturumu, evrakOturumuYaz, evrakOyna, evrakProva, Prova, provaAc, provaMetni, senaryoAc } from "../data/evrak";
import type { Danisma, Senaryo } from "../data/danisma";
import type { CaseFile } from "../engine/types";
import DanismaWatch from "./DanismaWatch";
import { EvrakOkuyucu, EvrakOkuyucuRef } from "./EvrakOkuyucu";
import { base64, baytlar, dosyaSecTelefon, fotografCek, TELEFON_SECIM } from "./evrakSec";
import { AvukatPaketKart } from "./AvukatPaketKart";
import { useSettings } from "../data/settings";
import { setAvukatKalan, usePremium } from "../data/subscription";
import { EVRAK_KREDI } from "../data/purchaseIds";
import { IconBadge } from "./icons";
import { setAktifMaske } from "../engine/mask/oturum";
import { ArsivKayit, arsivKaydet, arsivListesi, arsivSil, arsivTemizle } from "../data/evrakArsiv";
import { useInnerBack } from "./innerBack";
import { Btn } from "./kit";
import { t } from "../i18n";
import { C, F } from "./theme";

type Adim = "yukle" | "onay" | "bekle" | "sonuc";
interface Evrak { ad: string; metin: string }

const TUR_ADI: Record<Kind, string> = {
  taraf: "Taraflar", sirket: "Şirketler", kisi: "Öteki kişiler", avukat: "Avukatlar", kimlik: "Kimlik ve hesap numaraları", iletisim: "İletişim",
  adres: "Adresler", yer: "Yerler ve birimler", mahkeme: "Mahkeme ve daireler", dosya: "Dosya numaraları", numara: "Öteki numaralar", kurum: "Kurumlar", elle: "Elle gizlenenler"
};
const SIRA: Kind[] = ["taraf", "kisi", "avukat", "sirket", "kimlik", "iletisim", "adres", "mahkeme", "dosya", "yer", "numara", "kurum", "elle"];

/** Web: dosya seçme penceresi; seçilen dosyalar bellekte okunur, hiçbir yere yüklenmez. */
function dosyaSec(): Promise<{ ad: string; bytes: Uint8Array }[]> {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file"; input.multiple = true; input.accept = ".udf,.doc,.docx,.txt,.pdf,.tif,.tiff,.jpg,.jpeg,.png,.zip";
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      resolve(await Promise.all(files.map(async f => ({ ad: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }))));
    };
    input.click();
  });
}

/** Maskelenmiş metinde hâlâ kişisel veri izi: geçerli kimlik no, IBAN, e-posta, cep telefonu, uzun sayılar (sunucu da denetler). */
function riskler(s: string): string[] {
  const out: string[] = [];
  if (/(^|\D)[1-9]\d{10}(?!\d)/.test(s)) out.push(t("11 haneli sayı"));
  if (/\bTR\s?\d{2}(?:\s?\d{4}){5}/i.test(s)) out.push("IBAN");
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(s)) out.push(t("e-posta"));
  if (/(^|\D)(?:\+90|0)?\s?\(?5\d{2}\)?\s?\d{3}\s?\d{2}\s?\d{2}(?!\d)/.test(s)) out.push(t("telefon"));
  return out;
}

/** ZIP'ten çıkan baytları telefondaki okuyucuya göndermek için base64'e çevirir. */
function bytesBase64(b: Uint8Array): string {
  const T = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] || 0) << 8) | (b[i + 2] || 0);
    out += T[(n >> 18) & 63] + T[(n >> 12) & 63] + (i + 1 < b.length ? T[(n >> 6) & 63] : "=") + (i + 2 < b.length ? T[n & 63] : "=");
  }
  return out;
}

/** "Duruşmayı izle" oynatıcısı danışma kaydı bekler; evrak canlandırmasının sunucuda kaydı yoktur, yerinde bir karşılık verilir. */
const sahteDanisma = (s: Senaryo): Danisma => ({
  id: "evrak-" + Math.abs([...s.ozet].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7)), alan: "diger", olay: s.ozet, deliller: "", karsi: "", talep: "",
  durum: "hazir", degerlendirme: null, canlandirma: null, takip: [], kalan_takip: 0, created_at: new Date().toISOString()
});

export default function EvrakScreen(p: { onBack: () => void; onPlay?: (c: CaseFile) => void; /** yönetici ya da deneme izni: kredi düşmez */ ucretsiz?: boolean }) {
  // Celse Avukat paketi: işlem başına kredi (notlar 1, izle 3, oyna 3); yöneticiler ve deneme izinlileri ücretsiz.
  const prem = usePremium();
  const ayar = useSettings();
  const ucretsiz = !!p.ucretsiz || prem.evrak;
  const av = prem.avukat;
  const yeter = (n: number) => ucretsiz || (!!av?.aktif && av.kalan >= n);
  const kalanYaz = (k?: number) => { if (typeof k === "number") setAvukatKalan(k); };
  // Oyundan dönünce kaldığı yerden açılır (oturum bellekte; uygulama kapanınca silinir).
  const o = useMemo(() => evrakOturumu(), []);
  const [adim, setAdim] = useState<Adim>(o?.prova ? "sonuc" : o ? "onay" : "yukle");
  const [evraklar, setEvraklar] = useState<Evrak[]>(o?.evraklar || []);
  const [yapistir, setYapistir] = useState(o?.yapistir || "");
  const [taraf, setTaraf] = useState<"davaci" | "davali">(o?.taraf || "davaci");
  const [asama, setAsama] = useState(o?.asama || "");
  const [allow, setAllow] = useState<string[]>(o?.allow || []);
  const [extra, setExtra] = useState<string[]>(o?.extra || []);
  const [senaryo, setSenaryo] = useState<Senaryo | null>(o?.senaryo || null);
  const [dosya, setDosya] = useState<CaseFile | null>(o?.dosya || null);
  const [izle, setIzle] = useState(false);
  const [mesgul, setMesgul] = useState<"" | "prova" | "izle" | "oyna">("");
  const [ek, setEk] = useState("");
  const [okudum, setOkudum] = useState(!!o);
  const [tamami, setTamami] = useState(false);
  const [err, setErr] = useState("");
  const [prova, setProva] = useState<{ kodlu: Prova; acik: Prova } | null>(o?.prova || null);
  const [kodlu, setKodlu] = useState(false);
  const [kopyalandi, setKopyalandi] = useState(false);
  // Büyük dosya derlemesi (bilet 6 saat geçerli; kartlar tür, tarih, önem ve özet taşır).
  const [bilet, setBilet] = useState<string | undefined>(o?.derleme?.bilet);
  const [kartlar, setKartlar] = useState<DerlemeKarti[] | null>(o?.derleme?.kartlar || null);
  const [onemliler, setOnemliler] = useState<number[]>(o?.derleme?.onemliler || []);
  const [derleniyor, setDerleniyor] = useState("");
  const [hepsiGorunsun, setHepsiGorunsun] = useState(false);
  // Önceki hazırlıklar (yalnız bu cihazda). arsivMap: kayıt evrak yeniden yüklenmeden açıldıysa kodların karşılıkları oradan gelir.
  const [arsivId, setArsivId] = useState<string | undefined>(o?.arsivId);
  const [arsivMap, setArsivMap] = useState<Record<string, string> | null>(o?.arsivMap || null);
  const [arsiv, setArsiv] = useState<ArsivKayit[]>([]);
  useEffect(() => { if (adim === "yukle") arsivListesi().then(setArsiv); }, [adim]);

  useInnerBack(adim === "onay" || adim === "sonuc", () => geri());
  useInnerBack(izle, () => setIzle(false));

  const tumMetin = useMemo(() => {
    const parts = evraklar.map((e, i) => `=== ${t("Evrak")} ${i + 1}: ${e.ad.replace(/\.[^.]+$/, "")} ===\n${e.metin}`);
    if (yapistir.trim()) parts.push(`=== ${t("Evrak")} ${parts.length + 1} ===\n${yapistir.trim()}`);
    return parts.join("\n\n");
  }, [evraklar, yapistir]);
  // Evrak adı da kişisel veri taşıyabilir (müvekkil adıyla kaydedilmiş dosya): başlıklar da maskeden geçer.
  const sonuc = useMemo(() => (adim === "yukle" ? null : mask(tumMetin, { allow, extra })), [adim, tumMetin, allow, extra]);
  const risk = sonuc ? riskler(sonuc.masked) : [];
  // Oturum: maskeleme değişince önceki sonuçlar eski kodlarla üretildiği için atılır.
  const imza = useRef(JSON.stringify([allow, extra, tumMetin.length]));
  useEffect(() => {
    const yeni = JSON.stringify([allow, extra, tumMetin.length]);
    if (yeni !== imza.current) { imza.current = yeni; setProva(null); setSenaryo(null); setDosya(null); setKartlar(null); partiSonuc.current.clear(); setArsivMap(null); setArsivId(undefined); }
  }, [allow, extra, tumMetin]);
  useEffect(() => {
    if (!sonuc) return;
    evrakOturumuYaz({ evraklar, yapistir, taraf, asama, allow, extra, map: arsivMap || sonuc.map, prova: prova || undefined, senaryo: senaryo || undefined, dosya: dosya || undefined, derleme: { bilet, kartlar: kartlar || undefined, onemliler }, arsivId, arsivMap: arsivMap || undefined });
  }, [sonuc, evraklar, yapistir, taraf, asama, allow, extra, prova, senaryo, dosya, bilet, kartlar, onemliler, arsivId, arsivMap]);
  // Her yeni sonuç (notlar, canlandırma, oynanabilir dosya) bu cihazdaki "Önceki hazırlıklarım"a yazılır; ekrandan çıkınca kaybolmaz.
  useEffect(() => {
    if (!sonuc || !(prova || senaryo || dosya)) return;
    const id = arsivId || "ev-" + Date.now().toString(36);
    if (!arsivId) setArsivId(id);
    const baslik = (prova?.acik.ozet || senaryo?.ozet || dosya?.title || t("Evrakla duruşma provası")).replace(/\s+/g, " ").slice(0, 110);
    arsivKaydet({ id, tarih: new Date().toISOString(), baslik, taraf, asama, map: arsivMap || sonuc.map, prova: prova || undefined, senaryo: senaryo || undefined, dosya: dosya || undefined });
  }, [prova, senaryo, dosya]);
  /** Kayıtlı hazırlığı açar: evrak yüklenmeden sonuçlar görünür; izle ve oyna kayıtlıysa yeniden açılır (kredi düşmez). */
  const arsivAc = (k: ArsivKayit) => {
    imza.current = JSON.stringify([[], [], 0]);
    setEvraklar([]); setYapistir(""); setAllow([]); setExtra([]); setKartlar(null); setBilet(undefined); setOnemliler([]); setErr("");
    setTaraf(k.taraf); setAsama(k.asama); setArsivMap(k.map); setArsivId(k.id);
    setProva(k.prova || null); setSenaryo(k.senaryo || null); setDosya(k.dosya || null); setOkudum(true); setKodlu(false);
    setAdim("sonuc");
  };
  const arsivdenAcik = !!arsivMap && !tumMetin.trim();
  const geri = () => (adim === "sonuc" ? (arsivdenAcik ? setAdim("yukle") : setAdim("onay")) : adim === "onay" ? setAdim("yukle") : undefined);
  // Gönderilecek metin: küçük dosyada maskelenmiş evrakın kendisi; büyük dosyada derlenmiş dosya (derlenmeden gönderilmez).
  const buyuk = !!sonuc && sonuc.masked.length > DOGRUDAN_SINIR;
  const bolunmus = useMemo(() => (buyuk && sonuc ? evrakBol(sonuc.masked) : []), [buyuk, sonuc]);
  const calisma = useMemo(() => {
    if (!sonuc) return "";
    if (!buyuk) return sonuc.masked;
    return kartlar ? derlenmisMetin(bolunmus, kartlar, new Set(onemliler)) : "";
  }, [sonuc, buyuk, bolunmus, kartlar, onemliler]);
  /** Dosyayı derle: partiler hızlı modele gider (aynı anda üç parti); yarıda kalırsa aynı biletle kaldığı yerden sürer. */
  const partiSonuc = useRef(new Map<number, Partial<DerlemeKarti>[]>());
  const derle = async () => {
    if (!sonuc) return;
    setErr("");
    const ps = partiler(bolunmus);
    let b = bilet;
    if (!b) {
      setDerleniyor(t("Hazırlanıyor…"));
      const r = await evrakBiletAl(sonuc.masked.length);
      if (!r.ok) { setDerleniyor(""); setErr(t(r.error, r.vars)); return; }
      kalanYaz(r.data.avukatKalan ?? undefined);
      b = r.data.bilet; setBilet(b); partiSonuc.current.clear();
    }
    let bitti = partiSonuc.current.size, hata = "";
    setDerleniyor(t("Derleniyor: {i} / {n} parti", { i: bitti, n: ps.length }));
    let sira = 0;
    const isci = async () => {
      while (!hata) {
        const k = sira++;
        if (k >= ps.length) return;
        if (partiSonuc.current.has(k)) continue;
        let r = await evrakDerle(b!, ps[k]);
        if (!r.ok && r.error !== "bilet" && r.error !== "maskelenmemiş veri") r = await evrakDerle(b!, ps[k]); // bir kez yeniden dene
        if (!r.ok) { hata = r.error === "bilet" ? "bilet" : t(r.error, r.vars); return; }
        partiSonuc.current.set(k, r.data.kartlar);
        bitti++;
        setDerleniyor(t("Derleniyor: {i} / {n} parti", { i: bitti, n: ps.length }));
      }
    };
    await Promise.all([isci(), isci(), isci()]);
    setDerleniyor("");
    if (hata === "bilet") { setBilet(undefined); setErr(t("Derleme süresi doldu (6 saat). “Dosyayı derle”ye yeniden basın.")); return; }
    if (hata) { setErr(t("Derleme yarıda kaldı: {h} “Dosyayı derle”ye yeniden basınca kaldığı yerden sürer; yeniden kredi düşmez.", { h: hata })); return; }
    const gelen = [...partiSonuc.current.values()].flat();
    setKartlar(kartlariBirlestir(bolunmus, gelen));
  };
  const cik = () => { evrakOturumuYaz(null); p.onBack(); };
  // Ekran kapanınca kodların karşılıkları giden metinlerde etkin kalmaz (oyuna geçilirse App yeniden açar).
  useEffect(() => () => setAktifMaske(null), []);

  // Okuma ilerlemesi (PDF sayfaları, yazı tanıma) ve taranmış evrak uyarısı.
  const [okuma, setOkumaState] = useState("");
  const okumaSon = useRef("");
  const setOkuma = (m: string) => { if (m) okumaSon.current = m; setOkumaState(m); };
  const [ocrUyari, setOcrUyari] = useState(false);
  const okuyucu = useRef<EvrakOkuyucuRef>(null);
  /** Seçilen dosyaları sırayla okur. ZIP açılır ve içindeki evraklar tek tek okunur (sınır evrak sayısı değil, hacimdir).
   *  Web'de bayt dizisi gelir; telefonda dosya adresi (uri) gelir ve gerektiğinde okunur. */
  type Kaynak = { ad: string; bytes?: Uint8Array; uri?: string };
  const isle = async (secilen: Kaynak[]) => {
    const yeni: Evrak[] = [];
    const sira: Kaynak[] = [];
    for (const f of secilen) {
      if (turBul(f.ad) === "zip") {
        try { const ic = zipIcerigi(f.bytes || await baytlar(f.uri!)); if (!ic.length) setErr(t("{ad}: ZIP içinde okunabilir evrak yok.", { ad: f.ad })); sira.push(...ic); }
        catch { setErr(t("{ad}: ZIP dosyası açılamadı.", { ad: f.ad })); }
      } else sira.push(f);
    }
    let i = 0;
    for (const f of sira) {
      i++;
      const tur = turBul(f.ad);
      if (!tur) { setErr(t("{ad}: bu dosya türü okunamıyor. UDF, Word (DOC/DOCX), PDF, TIF, JPG/PNG, ZIP ya da metin dosyası seçin.", { ad: f.ad })); continue; }
      try {
        let metin: string;
        const onEk = sira.length > 1 ? `(${i} / ${sira.length}) ` : "";
        const ilerle = (m: string) => setOkuma(`${onEk}${f.ad}: ${t(m)}`);
        if (tur === "pdf" || tur === "tif" || tur === "resim") {
          if (Platform.OS === "web") {
            // Kütüphaneler ve yazı tanıma yalnız gerektiğinde, tarayıcıda yüklenir; dosya cihazdan çıkmaz.
            const oku = await import("./evrakOku");
            const by = f.bytes!;
            metin = tur === "pdf" ? await oku.pdfMetni(by, ilerle) : tur === "tif" ? await oku.tifMetni(by, ilerle) : await oku.resimMetni(by, f.ad, ilerle);
          } else {
            // Telefonda aynı okuma, görünmez WebView içinde (EvrakOkuyucu); dosya telefondan çıkmaz.
            if (!okuyucu.current) throw new Error("Okuyucu hazır değil, yeniden deneyin.");
            ilerle("Dosya hazırlanıyor…");
            const b64 = f.uri ? await base64(f.uri) : bytesBase64(f.bytes!);
            metin = await okuyucu.current.oku(f.ad, tur, b64, ilerle);
          }
          if (tur !== "pdf" || /yazı tanıma/i.test(okumaSon.current)) setOcrUyari(true);
        } else { ilerle("okunuyor"); metin = evrakMetni(f.ad, f.bytes || await baytlar(f.uri!)); }
        if (metin.replace(/\s/g, "").length < 20) { setErr(t("{ad}: dosyada okunabilir metin bulunamadı.", { ad: f.ad })); continue; }
        yeni.push({ ad: f.ad, metin });
      } catch (e) { setErr(`${f.ad}: ${t(String((e as Error).message || e))}`); }
    }
    setEvraklar(l => [...l, ...yeni]);
    setOkuma("");
  };
  const ekle = async () => {
    setErr("");
    try {
      if (Platform.OS === "web") await isle(await dosyaSec());
      else await isle(await dosyaSecTelefon());
    } catch (e) { setErr(t(String((e as Error)?.message || "Dosya okunamadı."))); setOkuma(""); }
  };
  const cek = async () => {
    setErr("");
    try { const f = await fotografCek(); if (f) await isle([f]); }
    catch (e) { setErr(t(String((e as Error)?.message || "Fotoğraf okunamadı."))); setOkuma(""); }
  };
  const seciliGizle = () => {
    if (Platform.OS !== "web") return;
    const sel = (window.getSelection?.()?.toString() || "").trim();
    if (sel.length >= 2 && !/^\[[^\]]+\]$/.test(sel)) setExtra(x => (x.includes(sel) ? x : [...x, sel]));
  };
  const gonder = async () => {
    if (!sonuc) return;
    if (prova) { setAdim("sonuc"); return; }
    setErr(""); setMesgul("prova");
    const r = await evrakProva(calisma, taraf, asama.trim());
    setMesgul("");
    if (!r.ok) { setErr(t(r.error, r.vars)); return; }
    kalanYaz(r.data.avukatKalan);
    setProva({ kodlu: r.data, acik: provaAc(r.data, sonuc.map) });
    setKodlu(false); setAdim("sonuc");
  };
  /** Yapay zekâ oynasın: canlandırma senaryosu; bir kez üretilir, yeniden izlemede aynısı açılır. */
  const izlet = async () => {
    if (!sonuc) return;
    if (senaryo) { setIzle(true); return; }
    setErr(""); setMesgul("izle");
    const r = await evrakIzle(calisma, taraf, asama.trim());
    setMesgul("");
    if (!r.ok) { setErr(t(r.error, r.vars)); return; }
    kalanYaz(r.data.avukatKalan);
    const sn = senaryoAc(r.data.senaryo, sonuc.map);
    setSenaryo(sn); setIzle(true);
  };
  /** Ben oynayayım: evraktan oynanabilir dosya; avukat kendi tarafının vekili olarak duruşmaya girer. */
  const oyna = async () => {
    if (!sonuc || !p.onPlay) return;
    if (dosya) { p.onPlay(dosya); return; }
    setErr(""); setMesgul("oyna");
    const r = await evrakOyna(calisma, taraf, asama.trim());
    setMesgul("");
    if (!r.ok) { setErr(t(r.error, r.vars)); return; }
    kalanYaz(r.data.avukatKalan);
    const c = dosyaAc(r.data.dosya, sonuc.map);
    if (!c) { setErr(t("Dosya şu an oynanabilir hâle getirilemedi. Yeniden deneyin.")); return; }
    setDosya(c);
    evrakOturumuYaz({ evraklar, yapistir, taraf, asama, allow, extra, map: arsivMap || sonuc.map, prova: prova || undefined, senaryo: senaryo || undefined, dosya: c, arsivId, arsivMap: arsivMap || undefined });
    p.onPlay(c);
  };
  const paylas = async () => {
    if (!prova) return;
    const metin = provaMetni(kodlu ? prova.kodlu : prova.acik, s => t(s));
    if (Platform.OS === "web") {
      try { await navigator.clipboard.writeText(metin); setKopyalandi(true); setTimeout(() => setKopyalandi(false), 2000); } catch { /* yok say */ }
    } else Share.share({ message: metin }).catch(() => {});
  };
  const indir = () => {
    if (!prova || Platform.OS !== "web") return;
    const blob = new Blob([provaMetni(kodlu ? prova.kodlu : prova.acik, s => t(s))], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "durusma-provasi.txt"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const uzun = tumMetin.length > EVRAK_AZAMI;
  const gruplar = useMemo(() => {
    const g = new Map<Kind, Entity[]>();
    for (const e of sonuc?.entities || []) g.set(e.kind, [...(g.get(e.kind) || []), e]);
    return SIRA.filter(k => g.has(k)).map(k => [k, g.get(k)!] as const);
  }, [sonuc]);

  if (izle && senaryo) return <DanismaWatch key={senaryo.ozet.length} s={senaryo} d={sahteDanisma(senaryo)} onClose={() => setIzle(false)} />;
  const hazir = okudum && risk.length === 0 && !mesgul && !!calisma;
  const Aksiyonlar = (
    <View style={s.card}>
      <Text style={s.cardT}>{t("Duruşma salonuna girin")}</Text>
      <Text style={s.hint}>{ucretsiz ? t("Deneme erişimi: işlemler kredi düşmez.")
        : av?.aktif ? t("Celse Avukat · bu ay kalan {k} / {a} kredi · yenilenme {d}", { k: av.kalan, a: av.aylik, d: av.donemSonu ? av.donemSonu.toLocaleDateString("tr-TR") : "" })
        : t("Evrakla duruşma provası Celse Avukat paketiyle kullanılır: ayda 160 kredi, Celse Pro dahil.") + (ayar.avukatSatis ? "" : " " + t("Paket yakında satışta."))}</Text>
      <View style={s.acts}>
        <Pressable accessibilityRole="button" disabled={dosya ? !!mesgul : !hazir || !yeter(EVRAK_KREDI.evrak_oyna)} onPress={oyna} style={({ pressed }) => [s.act, (dosya ? !!mesgul : !hazir || !yeter(EVRAK_KREDI.evrak_oyna)) && s.actOff, pressed && { opacity: 0.85 }]}>
          <IconBadge name="scales" size={44} />
          <Text style={s.actT}>{mesgul === "oyna" ? t("Dosya hazırlanıyor…") : dosya ? t("Yeniden oyna") : t("Ben oynayayım")}</Text>
          <Text style={s.actD}>{t("Kendi tarafınızın vekili olarak duruşmaya girin: müvekkil görüşmesi, hâkimin soruları, delille itiraz, sözlü savunma ve karar.")}</Text>
          {!ucretsiz && !dosya && <Text style={s.cost}>{t("{n} kredi", { n: EVRAK_KREDI.evrak_oyna })}</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" disabled={senaryo ? !!mesgul : !hazir || !yeter(EVRAK_KREDI.evrak_izle)} onPress={izlet} style={({ pressed }) => [s.act, (senaryo ? !!mesgul : !hazir || !yeter(EVRAK_KREDI.evrak_izle)) && s.actOff, pressed && { opacity: 0.85 }]}>
          <IconBadge name="film" size={44} />
          <Text style={s.actT}>{mesgul === "izle" ? t("Canlandırma hazırlanıyor…") : senaryo ? t("Yeniden izle") : t("Yapay zekâ oynasın")}</Text>
          <Text style={s.actD}>{t("Büro görüşmeleri, duruşma ve karar fotoğraflı karakterlerle sahnelenir; siz izlersiniz.")}</Text>
          {!ucretsiz && !senaryo && <Text style={s.cost}>{t("{n} kredi", { n: EVRAK_KREDI.evrak_izle })}</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" disabled={prova ? !!mesgul : !hazir || !yeter(EVRAK_KREDI.evrak)} onPress={gonder} style={({ pressed }) => [s.act, (prova ? !!mesgul : !hazir || !yeter(EVRAK_KREDI.evrak)) && s.actOff, pressed && { opacity: 0.85 }]}>
          <IconBadge name="notes" size={44} />
          <Text style={s.actT}>{mesgul === "prova" ? t("Hazırlanıyor…") : prova ? t("Hazırlık notlarını aç") : t("Hazırlık notları")}</Text>
          <Text style={s.actD}>{t("Hâkimin soruları, karşı tarafın argümanları, zayıf noktalar, süreler ve sözlü beyan taslağı.")}</Text>
          {!ucretsiz && !prova && <Text style={s.cost}>{t("{n} kredi", { n: EVRAK_KREDI.evrak })}</Text>}
        </Pressable>
      </View>
      {!!mesgul && <Text style={s.hint}>{t("Evrakın uzunluğuna göre bir-üç dakika sürebilir; ekranı açık tutun.")}</Text>}
      {!!err && <Text style={s.err}>{err}</Text>}
      {arsivdenAcik && <Text style={s.hint}>{t("Bu hazırlık bu cihazdaki kayıttan açıldı. Kayıtlı olanlar kredi düşmeden açılır; yeni bir işlem için evrakı yeniden yükleyin.")}</Text>}
      {!hazir && !mesgul && !arsivdenAcik && <Text style={s.hint}>{risk.length ? t("Önce metinde kalan kişisel veriyi gizleyin.") : !okudum ? t("Önce gönderilecek metni denetleyip onay kutusunu işaretleyin.") : t("Önce dosyayı derleyin.")}</Text>}
      <Text style={s.hint}>{t("Ekranda gerçek adlar görünür; seslendirmeye ve yapay zekâ puanlamasına giden metinlerde adlar yeniden kodlanır.")}</Text>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag">
      <View style={s.head}>
        <Btn kind="ghost" label={t("‹ Geri")} onPress={() => (adim === "yukle" ? cik() : geri())} />
        <View style={{ flex: 1 }} />
        {adim !== "yukle" && <Btn kind="ghost" label={t("Oturumu temizle")} onPress={cik} />}
      </View>
      <Text style={s.eyebrow}>{t("EVRAKLA DURUŞMA PROVASI · CELSE AVUKAT")}</Text>
      <Text style={s.title}>{t("Dosyanızla duruşmaya hazırlanın")}</Text>
      <View style={s.warn}>
        <Text style={s.warnT}>{t("Kişisel veriler cihazınızdan çıkmaz.")}</Text>
        <Text style={s.warnD}>{t("Evrak bu cihazda okunur ve maskelenir: adlar, kimlik ve dosya numaraları, adresler ve mahkeme adları kodlara çevrilir; tarihlerde yalnız ay ve yıl kalır. Sunucuya yalnız sizin onayladığınız kodlu metin gider ve kaydedilmez. Sonuçlar ve kodların karşılıkları yalnız bu cihazda, “Önceki hazırlıklarım” listesinde 30 gün saklanır; oradan silebilirsiniz.")}</Text>
      </View>
      {!ucretsiz && <AvukatPaketKart />}

      {adim === "yukle" && arsiv.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardT}>{t("Önceki hazırlıklarım")}</Text>
          <Text style={s.hint}>{t("Yalnız bu cihazda saklanır, sunucuya gitmez; 30 gün sonra kendiliğinden silinir. Açmak kredi düşmez.")}</Text>
          {arsiv.map(k => (
            <View key={k.id} style={s.arsivRow}>
              <View style={{ flex: 1, minWidth: 200, gap: 2 }}>
                <Text style={s.body} numberOfLines={2}>{k.baslik}</Text>
                <Text style={s.hint}>{new Date(k.tarih).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {[k.prova && t("notlar"), k.senaryo && t("canlandırma"), k.dosya && t("oynanabilir dosya")].filter(Boolean).join(", ")}</Text>
              </View>
              <Btn kind="secondary" label={t("Aç")} onPress={() => arsivAc(k)} />
              <Btn kind="ghost" label={t("Sil")} onPress={() => arsivSil(k.id).then(() => arsivListesi().then(setArsiv))} />
            </View>
          ))}
          <View style={s.row}><Btn kind="ghost" label={t("Hepsini bu cihazdan sil")} onPress={() => arsivTemizle().then(() => setArsiv([]))} /></View>
        </View>
      )}

      {adim === "yukle" && (
        <View style={s.card}>
          <Text style={s.cardT}>{t("1. Evrakı ekleyin")}</Text>
          <Text style={s.hint}>{t("Dilekçe, cevap, bilirkişi raporu, ara karar gibi evrakı seçin: UYAP UDF ve TIF, PDF, Word (DOC ve DOCX), evrak fotoğrafı (JPG/PNG), UYAP'tan inen ZIP ya da metin dosyası. Evrak sayısı sınırsızdır; büyük dosya önce derlenir. Taranmış evrak, yazı tanımayla bu cihazda okunur.")}</Text>
          <View style={s.row}>
            <Btn kind="secondary" label={okuma ? t("Okunuyor…") : t("Dosya seç")} disabled={!!okuma} onPress={ekle} />
            {Platform.OS !== "web" && TELEFON_SECIM && <Btn kind="ghost" label={t("Fotoğraf çek")} disabled={!!okuma} onPress={cek} />}
          </View>
          {!!okuma && <Text style={s.hint}>{okuma}</Text>}
          {ocrUyari && !okuma && <Text style={s.hint}>{t("Taranmış sayfalardan yazı tanımayla okunan metinde harf hataları olabilir; adlar bu yüzden kaçabilir. Maskeleme ekranında metni dikkatle denetleyin.")}</Text>}
          {Platform.OS !== "web" && adim === "yukle" && <EvrakOkuyucu ref={okuyucu} />}
          {evraklar.length > 0 && (
            <Text style={s.meta}>{t("{n} evrak · yaklaşık {s} sayfa · {k} karakter", { n: evraklar.length, s: Math.max(1, Math.round(evraklar.reduce((a, e) => a + e.metin.length, 0) / 3000)).toLocaleString("tr-TR"), k: evraklar.reduce((a, e) => a + e.metin.length, 0).toLocaleString("tr-TR") })}</Text>
          )}
          {(hepsiGorunsun ? evraklar : evraklar.slice(0, 8)).map((e, i) => (
            <View key={i} style={s.file}>
              <Text style={s.fileT} numberOfLines={1}>{e.ad}</Text>
              <Text style={s.meta}>{t("{n} karakter", { n: e.metin.length.toLocaleString("tr-TR") })}</Text>
              <Pressable accessibilityRole="button" onPress={() => setEvraklar(l => l.filter((_, j) => j !== i))}><Text style={s.link}>{t("Çıkar")}</Text></Pressable>
            </View>
          ))}
          {evraklar.length > 8 && (
            <View style={s.row}>
              <Pressable onPress={() => setHepsiGorunsun(x => !x)}><Text style={s.link}>{hepsiGorunsun ? t("Kısalt") : t("Bütün evrakları göster ({n})", { n: evraklar.length })}</Text></Pressable>
              <Pressable onPress={() => setEvraklar([])}><Text style={s.link}>{t("Hepsini çıkar")}</Text></Pressable>
            </View>
          )}
          <Text style={s.label}>{t("Ya da metni yapıştırın")}</Text>
          <TextInput style={s.input} multiline value={yapistir} onChangeText={setYapistir} placeholder={t("Evrakın metni…")} placeholderTextColor={C.muted} />
          <Text style={s.label}>{t("Hangi taraftasınız?")}</Text>
          <View style={s.chips}>
            {([["davaci", "Davacı / başvuran / müşteki"], ["davali", "Davalı / sanık / karşı taraf"]] as const).map(([k, l]) => (
              <Pressable key={k} accessibilityRole="radio" accessibilityState={{ selected: taraf === k }} onPress={() => setTaraf(k)} style={[s.alan, taraf === k && s.alanOn]}>
                <Text style={[s.alanT, taraf === k && s.alanTOn]}>{t(l)}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.label}>{t("Aşama ve beklentiniz (isteğe bağlı)")}</Text>
          <TextInput style={[s.input, { minHeight: 60 }]} multiline value={asama} onChangeText={setAsama} maxLength={200}
            placeholder={t("ör. ilk duruşma, tanık dinlenecek; bilirkişi raporuna itiraz edeceğiz")} placeholderTextColor={C.muted} />
          {!!err && <Text style={s.err}>{err}</Text>}
          {uzun && <Text style={s.err}>{t("Evrak bu cihazın belleği için çok büyük. Dosyayı birkaç parçaya bölün.")}</Text>}
          <View style={s.row}>
            <Btn label={t("Maskele ve göster")} disabled={tumMetin.trim().length < 200 || uzun} onPress={() => { setOkudum(false); setAdim("onay"); }} />
          </View>
          {tumMetin.trim().length > 0 && tumMetin.trim().length < 200 && <Text style={s.hint}>{t("En az 200 karakterlik evrak gerekir.")}</Text>}
        </View>
      )}

      {(adim === "onay" || adim === "bekle") && sonuc && (
        <>
          <View style={s.card}>
            <Text style={s.cardT}>{t("2. Maskelemeyi denetleyin")}</Text>
            <Text style={s.hint}>{t("Aşağıdaki değerler kodlara çevrildi. Gizlenmesi gerekmeyen bir değere dokunursanız açık kalır. Kaçan bir ad ya da numara görürseniz aşağıya yazıp gizleyin.")}</Text>
            {gruplar.map(([k, list]) => (
              <View key={k} style={{ gap: 6 }}>
                <Text style={s.label}>{t(TUR_ADI[k])}</Text>
                <View style={s.chips}>
                  {list.map(e => (
                    <Pressable key={e.code} accessibilityRole="button" accessibilityHint={t("Açık bırak")} onPress={() => setAllow(a => [...a, e.value])} style={s.ent}>
                      <Text style={s.entC}>{e.code}</Text>
                      <Text style={s.entV} numberOfLines={1}>{e.value}{e.count > 1 ? `  ×${e.count}` : ""}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            {allow.length > 0 && (
              <View style={{ gap: 6 }}>
                <Text style={s.label}>{t("Açık bırakılanlar (dokunursanız yeniden gizlenir)")}</Text>
                <View style={s.chips}>
                  {allow.map(v => <Pressable key={v} onPress={() => setAllow(a => a.filter(x => x !== v))} style={[s.ent, s.entOpen]}><Text style={s.entV}>{v}</Text></Pressable>)}
                </View>
              </View>
            )}
            <Text style={s.label}>{t("Ayrıca gizle")}</Text>
            <View style={s.addRow}>
              <TextInput style={[s.input, { flex: 1, minHeight: 0 }]} value={ek} onChangeText={setEk} placeholder={t("ör. kaçan bir soyadı ya da yer adı")} placeholderTextColor={C.muted}
                onSubmitEditing={() => { const v = ek.trim(); if (v.length >= 2) { setExtra(x => [...x, v]); setEk(""); } }} returnKeyType="done" />
              <Btn kind="secondary" label={t("Gizle")} disabled={ek.trim().length < 2} onPress={() => { setExtra(x => [...x, ek.trim()]); setEk(""); }} />
            </View>
            {extra.length > 0 && (
              <View style={s.chips}>
                {extra.map(v => <Pressable key={v} onPress={() => setExtra(x => x.filter(y => y !== v))} style={s.ent}><Text style={s.entV}>{v}  ✕</Text></Pressable>)}
              </View>
            )}
          </View>

          <View style={s.card}>
            <Text style={s.cardT}>{t("3. Gönderilecek metin")}</Text>
            <Text style={s.hint}>{Platform.OS === "web" ? t("Sunucuya yalnız bu metin gider. Kaçan bir ifadeyi fareyle seçip “Seçtiğimi gizle”ye basabilirsiniz.") : t("Sunucuya yalnız bu metin gider.")}</Text>
            {Platform.OS === "web" && <View style={s.row}><Btn kind="ghost" label={t("Seçtiğimi gizle")} onPress={seciliGizle} /></View>}
            <View style={s.preview}>
              <Text style={s.pre} selectable>
                {(tamami ? sonuc.masked : sonuc.masked.slice(0, 6000)).split(/(\[[^\]\n]{1,40}\])/).map((part, i) =>
                  i % 2 ? <Text key={i} style={s.code}>{part}</Text> : part)}
              </Text>
            </View>
            {sonuc.masked.length > 6000 && (
              <Pressable onPress={() => setTamami(x => !x)}><Text style={s.link}>{tamami ? t("Kısalt") : t("Tamamını göster ({n} karakter)", { n: sonuc.masked.length.toLocaleString("tr-TR") })}</Text></Pressable>
            )}
            {risk.length > 0 && <Text style={s.err}>{t("Dikkat: metinde hâlâ {x} görünüyor. Gizlemeden gönderilemez.", { x: risk.join(", ") })}</Text>}
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: okudum }} onPress={() => setOkudum(x => !x)} style={s.check}>
              <View style={[s.box, okudum && s.boxOn]}>{okudum && <Text style={s.tick}>✓</Text>}</View>
              <Text style={s.checkT}>{t("Gönderilecek metni denetledim; kişisel veri kalmadı. Hazırlık notlarının yapay zekâ ürünü olduğunu, hata yapabileceğini ve son değerlendirmenin bana ait olduğunu biliyorum.")}</Text>
            </Pressable>
          </View>
          {buyuk && sonuc && (
            <View style={s.card}>
              <Text style={s.cardT}>{t("4. Dosyayı derle")}</Text>
              <Text style={s.hint}>{t("Dosya büyük: {n} evrak, yaklaşık {p} sayfa. Güçlü modele gitmeden önce her evrak ayrı ayrı okunur; gereksizler (tebligat, harç, vekaletname, üst yazı) ayıklanır, gerekliler özetlenip önem ve tarih sırasına dizilir. Derleme de kaydedilmez.", { n: bolunmus.length, p: Math.max(1, Math.round(sonuc.masked.length / 3000)).toLocaleString("tr-TR") })}</Text>
              {!kartlar && (
                <View style={s.row}>
                  <Btn label={derleniyor || (bilet ? t("Derlemeyi sürdür") : t("Dosyayı derle"))} disabled={!!derleniyor || !okudum || risk.length > 0 || (!bilet && !ucretsiz && !yeter(derlemeKredisi(sonuc.masked.length)))} onPress={derle} />
                  {!ucretsiz && !bilet && <Text style={[s.cost, { alignSelf: "center" }]}>{t("{n} kredi", { n: derlemeKredisi(sonuc.masked.length) })}</Text>}
                </View>
              )}
              {!!derleniyor && <Text style={s.hint}>{t("Ekranı açık tutun; büyük dosyada birkaç dakika sürebilir.")}</Text>}
              {kartlar && (() => {
                const ilgili = [...kartlar].filter(k => k.onem > 0 || onemliler.includes(k.no)).sort(onemSirasi);
                const cikan = kartlar.filter(k => k.onem === 0 && !onemliler.includes(k.no));
                const ONEM = ["GEREKSİZ", "YARDIMCI", "ÖNEMLİ", "KİLİT"];
                const goster = hepsiGorunsun ? ilgili : ilgili.slice(0, 25);
                const ac = (x: string) => unmask(x, sonuc.map);
                return (
                  <View style={{ gap: 8 }}>
                    <Text style={s.warnT}>{t("Derlendi: {n} gerekli evrak, {c} evrak ayıklandı.", { n: ilgili.length, c: cikan.length })}</Text>
                    <Text style={s.hint}>{t("Sıralama önem ve tarihe göre. ★ ile işaretlediğiniz evrakların tam metni de gönderilir (kilit evraklar kendiliğinden eklenir).")}</Text>
                    {goster.map(k => (
                      <View key={k.no} style={s.kart}>
                        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: onemliler.includes(k.no) }} hitSlop={8}
                          onPress={() => setOnemliler(x => (x.includes(k.no) ? x.filter(y => y !== k.no) : [...x, k.no]))}>
                          <Text style={[s.yildiz, onemliler.includes(k.no) && { color: C.brass }]}>{onemliler.includes(k.no) ? "★" : "☆"}</Text>
                        </Pressable>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={s.cost}>{ONEM[k.onem]} · {ac(k.tarih) || t("tarihsiz")} · {t("Evrak")} {k.no}</Text>
                          <Text style={s.fileT} numberOfLines={1}>{k.tur} — {ac(k.ad)}</Text>
                          <Text style={s.actD} numberOfLines={2}>{ac(k.ozet)}</Text>
                        </View>
                      </View>
                    ))}
                    {ilgili.length > 25 && <Pressable onPress={() => setHepsiGorunsun(x => !x)}><Text style={s.link}>{hepsiGorunsun ? t("Kısalt") : t("Bütün gerekli evrakları göster ({n})", { n: ilgili.length })}</Text></Pressable>}
                    {cikan.length > 0 && <Text style={s.hint}>{t("Ayıklananlar: {l}", { l: cikan.slice(0, 12).map(k => `${k.tur} (Evrak ${k.no})`).join(", ") + (cikan.length > 12 ? "…" : "") })}</Text>}
                    <Pressable onPress={() => { setKartlar(null); partiSonuc.current.clear(); }}><Text style={s.link}>{t("Yeniden derle")}</Text></Pressable>
                  </View>
                );
              })()}
            </View>
          )}
          {Aksiyonlar}
        </>
      )}

      {adim === "sonuc" && Aksiyonlar}
      {adim === "sonuc" && prova && <ProvaView p={kodlu ? prova.kodlu : prova.acik} />}
      {adim === "sonuc" && prova && (
        <View style={s.card}>
          <Pressable accessibilityRole="switch" accessibilityState={{ checked: kodlu }} onPress={() => setKodlu(x => !x)} style={s.check}>
            <View style={[s.box, kodlu && s.boxOn]}>{kodlu && <Text style={s.tick}>✓</Text>}</View>
            <Text style={s.checkT}>{t("Kodlu hâliyle göster (paylaşmadan önce)")}</Text>
          </Pressable>
          <View style={s.row}>
            <Btn kind="secondary" label={Platform.OS === "web" ? (kopyalandi ? t("Kopyalandı") : t("Kopyala")) : t("Paylaş")} onPress={paylas} />
            {Platform.OS === "web" && <Btn kind="ghost" label={t("Metin olarak indir")} onPress={indir} />}
          </View>
          <Text style={s.hint}>{t("Hazırlık notları sunucuda kaydedilmez; yalnız bu cihazda, evrak ekranının başındaki “Önceki hazırlıklarım” listesinde 30 gün durur. Başka yerde saklamak için kopyalayın ya da indirin.")}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function ProvaView({ p }: { p: Prova }) {
  const Liste = ({ h, xs }: { h: string; xs: string[] }) => (xs.length ? (
    <View style={s.card}><Text style={s.secT}>{t(h)}</Text>{xs.map((x, i) => <Text key={i} style={s.body}>• {x}</Text>)}</View>
  ) : null);
  const Cift = ({ h, xs }: { h: string; xs: { a: string; b: string }[] }) => (xs.length ? (
    <View style={s.card}>
      <Text style={s.secT}>{t(h)}</Text>
      {xs.map((x, i) => (
        <View key={i} style={s.pair}>
          <Text style={s.q}>{i + 1}. {x.a}</Text>
          <Text style={s.body}>→ {x.b}</Text>
        </View>
      ))}
    </View>
  ) : null);
  return (
    <>
      <View style={s.card}><Text style={s.secT}>{t("Özet")}</Text><Text style={s.body} selectable>{p.ozet}</Text></View>
      <Liste h="Çekişmeli konular" xs={p.uyusmazlik} />
      <Cift h="Hâkimin sorabileceği sorular" xs={p.hakimSorulari.map(x => ({ a: x.soru, b: x.cevap }))} />
      <Cift h="Karşı tarafın argümanları ve cevaplarımız" xs={p.karsiArgumanlar.map(x => ({ a: x.arguman, b: x.cevap }))} />
      <Liste h="Zayıf noktalar ve riskler" xs={p.zayif} />
      <Liste h="Eksik delil ve yapılacaklar" xs={p.eksik} />
      <Liste h="Süreler" xs={p.sureler} />
      {!!p.sozlu && <View style={s.card}><Text style={s.secT}>{t("Sözlü beyan taslağı")}</Text><Text style={s.body} selectable>{p.sozlu}</Text></View>}
      {!!p.uyari && <Text style={s.hint}>{p.uyari}</Text>}
    </>
  );
}

const s = StyleSheet.create({
  arsivRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 },
  wrap: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 20, gap: 12 },
  head: { flexDirection: "row" },
  eyebrow: { fontFamily: F.mono, fontSize: 12, letterSpacing: 2.5, color: C.muted, marginTop: 4 },
  title: { fontFamily: F.display, fontSize: 30, color: C.brass },
  warn: { borderWidth: 1, borderColor: C.mid, borderRadius: 10, padding: 12, gap: 4, backgroundColor: "rgba(208,166,76,0.10)" },
  warnT: { fontFamily: F.bodyBold, fontSize: 15, color: C.text },
  warnD: { fontFamily: F.body, fontSize: 13, lineHeight: 19, color: C.textSoft },
  card: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 14, gap: 10 },
  cardT: { fontFamily: F.displayMed, fontSize: 20, color: C.text },
  secT: { fontFamily: F.bodyBold, fontSize: 16, color: C.brass },
  body: { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.textSoft },
  q: { fontFamily: F.bodyBold, fontSize: 15, lineHeight: 22, color: C.text },
  pair: { gap: 4, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: C.line },
  hint: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: C.muted },
  meta: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: C.brassDim },
  label: { fontFamily: F.mono, fontSize: 12, letterSpacing: 1, color: C.brass, textTransform: "uppercase" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  addRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  alan: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.panel2 },
  alanOn: { backgroundColor: C.brass, borderColor: C.brass },
  alanT: { fontFamily: F.bodyMed, fontSize: 14, color: C.text },
  alanTOn: { color: C.brassInk, fontFamily: F.bodyBold },
  ent: { borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.panel2, maxWidth: 320, gap: 2 },
  entOpen: { borderColor: C.mid, borderStyle: "dashed" },
  entC: { fontFamily: F.monoBold, fontSize: 11, color: C.brass },
  entV: { fontFamily: F.body, fontSize: 13, color: C.textSoft },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, minHeight: 120, fontFamily: F.body, fontSize: 15, color: C.text, backgroundColor: C.panel2, textAlignVertical: "top" },
  file: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, backgroundColor: C.panel2 },
  fileT: { flex: 1, fontFamily: F.bodyMed, fontSize: 14, color: C.text },
  preview: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 12, backgroundColor: C.paperHi, maxHeight: 520, overflow: "scroll" as const },
  pre: { fontFamily: F.body, fontSize: 13, lineHeight: 20, color: C.ink },
  code: { fontFamily: F.monoBold, fontSize: 12, color: C.brassInk, backgroundColor: "rgba(140,29,47,0.10)" },
  err: { fontFamily: F.bodyMed, fontSize: 14, lineHeight: 20, color: C.bad },
  link: { fontFamily: F.bodyMed, fontSize: 14, color: C.brass, textDecorationLine: "underline" },
  check: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  box: { width: 22, height: 22, borderRadius: 4, borderWidth: 1, borderColor: C.brassDim, alignItems: "center", justifyContent: "center", marginTop: 2 },
  boxOn: { backgroundColor: C.brass, borderColor: C.brass },
  tick: { fontFamily: F.bodyBold, fontSize: 14, color: C.brassInk },
  acts: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  act: { flexGrow: 1, flexBasis: 200, borderWidth: 1, borderColor: C.brassDim, borderRadius: 12, padding: 14, gap: 6, backgroundColor: C.panel2 },
  actOff: { opacity: 0.45 },
  actIcon: { fontSize: 28 },
  actT: { fontFamily: F.display, fontSize: 19, color: C.text },
  kart: { flexDirection: "row", gap: 10, alignItems: "flex-start", borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 10, backgroundColor: C.panel2 },
  yildiz: { fontSize: 22, color: C.muted, lineHeight: 26 },
  cost: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: C.brassDim, marginTop: 2 },
  actD: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: C.textSoft },
  checkT: { flex: 1, fontFamily: F.body, fontSize: 14, lineHeight: 20, color: C.textSoft }
});
