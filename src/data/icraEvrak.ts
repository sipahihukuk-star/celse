// Takibe konu evraktan icra bilgisi (cihazda, yapay zekâsız): ilamın mahkemesi, esas/karar no'su, karar tarihi ve hüküm
// fıkrasındaki alacak kalemleri (tutar, faiz türü, faiz başlangıcı); çekin seri no'su, keşide/ibraz tarihi, bankası ve tutarı;
// bononun düzenleme ve vade tarihi; kira sözleşmesinin tarihi ve aylık kirası; faturanın tarihi, numarası ve tutarı.
// Yalnız boş alanlar doldurulur; avukat her zaman kontrol eder.
import type { FaizTuru, IcraBilgi, Kalem, TakipYolu } from "./icra";
import { kunyeCikar } from "./kunyeCikar";

export type IcraEvrakTuru = "ilam" | "cek" | "senet" | "kira" | "fatura" | "diger";

const para = (x: string) => Number(x.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
const iso = (g: string, a: string, y: string) => `${y}-${a.padStart(2, "0")}-${g.padStart(2, "0")}`;
const TARIH = /(\d{1,2})[./-](\d{1,2})[./-]((?:19|20)\d{2})/;
const TUTAR = /(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})|\d+(?:,\d{1,2}))\s*(?:TL|TRY|₺|Türk Lirası)/i;
const ust = (x: string) => x.toLocaleUpperCase("tr");

export function evrakTuruBul(metin: string): IcraEvrakTuru {
  const u = ust(metin.slice(0, 6000));
  if (/GEREKÇELİ KARAR|KISA KARAR|HÜKÜM\s*:|GEREĞİ DÜŞÜNÜLDÜ|İLAM/.test(u) && /KARAR\s*(NO|TARİHİ)/.test(u)) return "ilam";
  if (/\bÇEK\b|ÇEK NO|KARŞILIKSIZ|MUHATAP BANKA|KEŞİDE YERİ/.test(u) && !/BONO|EMRE MUHARRER/.test(u)) return "cek";
  if (/BONO|EMRE MUHARRER|SENET/.test(u) && /VADE/.test(u)) return "senet";
  if (/KİRA SÖZLEŞMESİ|KİRA KONTRATI|AYLIK KİRA/.test(u)) return "kira";
  if (/FATURA/.test(u) && /(GENEL TOPLAM|ÖDENECEK TUTAR|FATURA NO|FATURA TARİHİ)/.test(u)) return "fatura";
  return "diger";
}

function faizTuru(x: string): FaizTuru | undefined {
  const u = ust(x);
  if (/1530/.test(u)) return "ttk1530";
  if (/AVANS|TİCARİ|REESKONT|3095.{0,30}2\.\s*MADDE/.test(u)) return "avans";
  if (/EN YÜKSEK MEVDUAT|MEVDUAT/.test(u)) return "mevduat";
  if (/YASAL|KANUNİ|ADİ KANUNİ/.test(u)) return "yasal";
  if (/FAİZSİZ|FAİZ İŞLETİLMEKSİZİN/.test(u)) return "yok";
  return undefined;
}

/** Hüküm fıkrasından alacak kalemleri. */
export function hukumKalemleri(metin: string, kararTarihi?: string): Kalem[] {
  const u = metin.replace(/\s+/g, " ");
  const i = Math.max(u.search(/HÜKÜM\s*:|GEREĞİ DÜŞÜNÜLDÜ|Gereği Düşünüldü|HÜKÜM-/i), 0);
  const hukum = u.slice(i);
  const out: Kalem[] = [];
  const ekle = (k: Kalem) => { if (k.tutar > 0 && !out.some(x => x.ad === k.ad && x.tutar === k.tutar)) out.push(k); };
  // Cümle cümle: "15.000,00 TL manevi tazminatın 01/01/2025 tarihinden itibaren işleyecek yasal faiziyle birlikte davalıdan tahsiline"
  // Hüküm maddeleri ("1-", "2)") ve cümleler ayrı ayrı; tutardaki "15.000,00" madde numarası sayılmaz.
  for (const c of hukum.split(/\s(?=\d{1,2}\s*[-)]\s*\p{L})|(?<=[.;])\s+(?=\p{Lu})/u)) {
    const m = c.match(TUTAR);
    if (!m) continue;
    const tutar = para(m[1]);
    const uc = ust(c);
    // Davacının lehine olmayan (Hazine'ye gelir kaydı, iade, reddedilen) cümleler atlanır.
    if (/HAZİNEYE GELİR|GELİR KAYDI|REDDİNE|İADESİNE|DAVACIYA İADE/.test(uc) && !/DAVALIDAN ALINARAK DAVACIYA/.test(uc)) continue;
    const t = c.match(new RegExp(TARIH.source + "\\s*(?:tarihinden|tarihi|T\\.)", "i"));
    const fz = faizTuru(c) || "yasal";
    if (/VEKALET ÜCRET|VEKÂLET ÜCRET|AVUKATLIK ÜCRET/.test(uc)) ekle({ ad: "Vekâlet ücreti", tutar, faizTuru: "yasal", faizBaslangic: kararTarihi });
    else if (/YARGILAMA GİDER/.test(uc)) ekle({ ad: "Yargılama gideri", tutar, faizTuru: "yasal", faizBaslangic: kararTarihi });
    else if (/HARÇ|HARC/.test(uc) && /DAVALIDAN ALINARAK DAVACIYA/.test(uc)) ekle({ ad: "Harç", tutar, faizTuru: "yasal", faizBaslangic: kararTarihi });
    else if (/TAHSİLİNE|ÖDENMESİNE|ALINARAK|VERİLMESİNE/.test(uc)) {
      const ad = /MANEVİ TAZMİNAT/.test(uc) ? "Manevi tazminat" : /MADDİ TAZMİNAT/.test(uc) ? "Maddi tazminat" : /KIDEM/.test(uc) ? "Kıdem tazminatı" : /İHBAR/.test(uc) ? "İhbar tazminatı"
        : /NAFAKA/.test(uc) ? "Nafaka" : /KİRA/.test(uc) ? "Kira bedeli" : "Asıl alacak";
      ekle({ ad, tutar, faizTuru: /FAİZ/.test(uc) ? fz : "yok", faizBaslangic: t ? iso(t[1], t[2], t[3]) : undefined });
    }
  }
  return out;
}

// Etiketler Türkçe büyük harfe çevrilmiş metinde aranır (i bayrağı ı/I ve i/İ eşleşmesini yapmaz).
const tarihAl = (metin: string, etiket: RegExp) => { const m = ust(metin).match(new RegExp(etiket.source + "\\s*[:.]?\\s*" + TARIH.source, "i")); return m ? iso(m[m.length - 3], m[m.length - 2], m[m.length - 1]) : undefined; };

/** Evraktan icra bilgisi önerisi (yalnız bulunanlar). */
export function icraEvraktan(metin: string): { tur: IcraEvrakTuru; yol?: TakipYolu; bilgi: Partial<IcraBilgi>; kalemler: Kalem[] } {
  const tur = evrakTuruBul(metin);
  const k = kunyeCikar(metin);
  const bilgi: Partial<IcraBilgi> = {};
  let kalemler: Kalem[] = [];
  if (tur === "ilam") {
    const karar = metin.match(/KARAR\s*(?:NO|NUMARASI)\s*[:.]?\s*((?:19|20)\d{2}\s*\/\s*\d+)/i)?.[1]?.replace(/\s+/g, "");
    const kararTarihi = tarihAl(metin, /KARAR\s*TAR[İI]H[İI]/) || k.belgeTarihi;
    const kesin = tarihAl(metin, /KES[İI]NLE[ŞS](?:ME|T[İI]Ğ[İI])\s*(?:TAR[İI]H[İI])?/);
    bilgi.ilam = { mahkeme: k.mahkeme, esasNo: k.esasNo, kararNo: karar, kararTarihi, kesinlesme: kesin };
    kalemler = hukumKalemleri(metin, kararTarihi);
    return { tur, yol: "ilamli", bilgi, kalemler };
  }
  if (tur === "cek") {
    const seri = metin.match(/(?:SER[İI]\s*NO|ÇEK\s*NO|ÇEK\s*NUMARASI)\s*[:.]?\s*([A-Z0-9-]{4,})/i)?.[1];
    const kesideTarihi = tarihAl(metin, /KE[ŞS][İI]DE\s*TAR[İI]H[İI]/);
    const ibraz = tarihAl(metin, /(?:[İI]BRAZ|KAR[ŞS]ILIKSIZ)\s*(?:TAR[İI]H[İI])?/);
    const banka = metin.match(/([A-ZÇĞİÖŞÜ][\wÇĞİÖŞÜçğıöşü.&-]*(?:\s+[A-ZÇĞİÖŞÜ][\wÇĞİÖŞÜçğıöşü.&-]*){0,4}\s+BANKASI(?:\s+A\.?Ş\.?|\s+T\.?A\.?O\.?)?)/)?.[1];
    const tutar = metin.match(/#\s*([\d.]+,\d{2})\s*#/)?.[1] || metin.match(TUTAR)?.[1];
    bilgi.senet = { tur: "cek", seriNo: seri, duzenleme: kesideTarihi, vade: ibraz, banka, kesideci: k.birinci?.ad };
    if (tutar) kalemler = [{ ad: "Çek bedeli", tutar: para(tutar), faizTuru: "yasal", faizBaslangic: ibraz }];
    return { tur, yol: "kambiyo", bilgi, kalemler };
  }
  if (tur === "senet") {
    const duzenleme = tarihAl(metin, /(?:TANZ[İI]M|D[ÜU]ZENLEME)\s*TAR[İI]H[İI]/);
    const vade = tarihAl(metin, /VADE(?:\s*TAR[İI]H[İI])?/);
    const tutar = metin.match(/#\s*([\d.]+,\d{2})\s*#/)?.[1] || metin.match(TUTAR)?.[1];
    bilgi.senet = { tur: "bono", duzenleme, vade };
    if (tutar) kalemler = [{ ad: "Senet bedeli", tutar: para(tutar), faizTuru: "yasal", faizBaslangic: vade }];
    return { tur, yol: "kambiyo", bilgi, kalemler };
  }
  if (tur === "kira") {
    const sozlesmeTarihi = tarihAl(metin, /(?:S[ÖO]ZLE[ŞS]ME|BA[ŞS]LANGI[ÇC])\s*TAR[İI]H[İI]/);
    const aylik = metin.match(new RegExp("AYLIK\\s*K[İI]RA(?:\\s*BEDEL[İI])?\\s*[:.]?\\s*" + TUTAR.source, "i"))?.[1];
    bilgi.kira = { sozlesmeTarihi, aylikKira: aylik ? para(aylik) : undefined, adres: metin.match(/K[İI]RALANAN\s*(?:YER[İI]N|MECURUN)?\s*ADRES[İI]\s*[:.]?\s*([^\n]{8,160})/i)?.[1]?.trim() };
    return { tur, yol: "kira", bilgi, kalemler };
  }
  if (tur === "fatura") {
    const no = metin.match(/FATURA\s*NO\s*[:.]?\s*([A-Z0-9-]{3,})/i)?.[1];
    const tarih = tarihAl(metin, /FATURA\s*TAR[İI]H[İI]/) || k.belgeTarihi;
    const vade = tarihAl(metin, /(?:SON\s*[ÖO]DEME|VADE)\s*TAR[İI]H[İI]/);
    const tutar = metin.match(new RegExp("(?:GENEL\\s*TOPLAM|[ÖO]DENECEK\\s*TUTAR|TOPLAM)\\s*[:.]?\\s*" + TUTAR.source, "i"))?.[1];
    bilgi.belge = [tarih ? tarih.split("-").reverse().join(".") + " tarihli" : "", no ? no + " no'lu" : "", "fatura"].filter(Boolean).join(" ");
    if (tutar) kalemler = [{ ad: "Fatura bedeli", tutar: para(tutar), faizTuru: "yasal", faizBaslangic: vade || tarih }];
    return { tur, yol: "genel", bilgi, kalemler };
  }
  return { tur, bilgi, kalemler };
}

/** Föyün evrakından icra bilgisini doldurur: yalnız boş alanlar; kalemler hiç girilmemişse eklenir. */
export function icraDoldur(b: IcraBilgi, metinler: string[]): { yeni: IcraBilgi; dolan: string[] } {
  const oncelik: IcraEvrakTuru[] = ["ilam", "cek", "senet", "kira", "fatura"];
  const sonuclar = metinler.filter(x => x && x.trim()).map(icraEvraktan).filter(r => r.tur !== "diger")
    .sort((a, c) => oncelik.indexOf(a.tur) - oncelik.indexOf(c.tur));
  if (!sonuclar.length) return { yeni: b, dolan: [] };
  const r = sonuclar[0];
  const dolan: string[] = [];
  const y: IcraBilgi = { ...b };
  const bosKalem = !b.kalemler || !b.kalemler.some(k => k.tutar);
  if (r.yol && bosKalem && !b.asil) { if (y.yol !== r.yol) dolan.push("takip yolu"); y.yol = r.yol; if (r.yol === "kira") y.talep = y.talep || "haciz_tahliye"; }
  const birlestir = <T extends object>(eski: T | undefined, yeni: T | undefined, ad: string): T | undefined => {
    if (!yeni) return eski;
    const out = { ...(eski || {}) } as Record<string, unknown>;
    let degisti = false;
    for (const [kk, v] of Object.entries(yeni)) if (v !== undefined && v !== "" && (out[kk] === undefined || out[kk] === "")) { out[kk] = v; degisti = true; }
    if (degisti) dolan.push(ad);
    return out as T;
  };
  y.ilam = birlestir(b.ilam, r.bilgi.ilam, "ilam bilgileri");
  y.senet = birlestir(b.senet, r.bilgi.senet, r.bilgi.senet?.tur === "cek" ? "çek bilgileri" : "senet bilgileri");
  y.kira = birlestir(b.kira, r.bilgi.kira, "kira bilgileri");
  if (r.bilgi.belge && !b.belge) { y.belge = r.bilgi.belge; dolan.push("dayanak"); }
  if (bosKalem && !b.asil && r.kalemler.length) { y.kalemler = r.kalemler; dolan.push(`${r.kalemler.length} alacak kalemi`); }
  if (r.yol === "ilamli" && !y.mahiyet && r.kalemler.length) { y.mahiyet = "4045"; dolan.push("takip mahiyeti (para alacağı)"); }
  return { yeni: y, dolan };
}
