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
// Tutar: "15.000,00 TL", "15.000 TL", "15.000,00-TL", "15.000,00.-TL", "15000 TL", "1.500.000,00 Türk Lirası".
const TUTAR = /(?<![\d.,])(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:[.,]?\s*-\s*)?(?:TL|TRY|₺|Türk Lirası)(?![\p{L}])/iu;
const TUTARLAR = new RegExp(TUTAR.source, "giu");
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

/** "01/06/2024 tarihinden", "15/03/2024 fesih tarihinden", "01.01.2025 T." */
const TARIH_IFADE = new RegExp(TARIH.source + "\\s*(?:[\\p{L}]+\\s+){0,3}?(?:tarihinden|tarihi|T\\.)", "iu");
/** Metinde ilk geçen faiz türü (birden çok faiz türü sayılan cümlede en yakındaki). */
function faizTuruIlk(x: string): FaizTuru | undefined {
  const u = ust(x);
  const adaylar: [RegExp, FaizTuru][] = [[/1530/, "ttk1530"], [/AVANS|TİCARİ|REESKONT/, "avans"], [/MEVDUAT/, "mevduat"], [/YASAL|KANUNİ/, "yasal"], [/FAİZSİZ|FAİZ İŞLETİLMEKSİZİN/, "yok"]];
  let en: FaizTuru | undefined, yer = Infinity;
  for (const [re, tur] of adaylar) { const i = u.search(re); if (i >= 0 && i < yer) { yer = i; en = tur; } }
  return en;
}

/** Hükmün kimin lehine olduğu: davacı tarafı (davacı, katılan, alacaklı…), davalı tarafı (davalı, sanık, borçlu…), Hazine,
 *  iade (yatırılan avansın geri verilmesi), reddedilen kısım ya da anlaşılamayan. */
export type Lehine = "birinci" | "ikinci" | "hazine" | "iade" | "red" | "belirsiz";
export interface HukumKalemi extends Kalem { lehine: Lehine; cumle: string; brutMu?: boolean }

const BIRINCI_YON = /DAVACI(?:LAR)?(?:A|YA)\b|DAVACI(?:LAR)? VEKİLİNE|KATILAN(?:LAR)?A\b|MÜŞTEKİ(?:LER)?(?:E|YE)\b|ALACAKLI(?:LAR)?(?:A|YA)\b|BAŞVURUCU(?:LAR)?(?:A|YA)\b|MÜDAHİL(?:LER)?E\b|İHBAR EDENE\b/g;
const IKINCI_YON = /DAVALI(?:LAR)?(?:A|YA)\b|DAVALI(?:LAR)? VEKİLİNE|SANIĞA\b|SANIKLARA\b|BORÇLU(?:LAR)?(?:A|YA)\b|ŞÜPHELİ(?:LER)?(?:E|YE)\b/g;
/** Fıkranın kimin lehine olduğu: fiilden önceki son "…-e / -a" (davacıya, davalıya, Hazineye) belirler. */
function lehineBul(uc: string): Lehine {
  if (/REDDİNE|REDDİ İLE/.test(uc) && !/ALINARAK|TAHSİL/.test(uc)) return "red";
  if (/İADESİNE|İADE EDİLMESİNE/.test(uc)) return "iade";
  if (/HAZİNEYE|HAZİNE ADINA|GELİR KAYDI/.test(uc)) return "hazine";
  const son = (re: RegExp) => { let i = -1; for (const m of uc.matchAll(re)) i = m.index ?? i; return i; };
  const b = son(BIRINCI_YON), k = son(IKINCI_YON);
  if (b < 0 && k < 0) return "belirsiz";
  return b > k ? "birinci" : "ikinci";
}

/** Hükmü fıkralara ayırır: madde numaraları ("1-", "2)") ve hüküm fiilleri ("…verilmesine,", "…reddine,") fıkra sonudur. */
function fikralar(hukum: string): string[] {
  const FIIL = /(VERİLMESİNE|ÖDENMESİNE|TAHSİLİNE|REDDİNE|KAYDINA|İADESİNE|BIRAKILMASINA|MAHSUBUNA|HÜKMEDİLMESİNE|KABULÜNE|YÜKLETİLMESİNE)\s*[,;.]?/g;
  const out: string[] = [];
  for (const parca of hukum.split(/\s(?=\d{1,2}\s*[-)]\s*\p{L})/u)) {
    const u = ust(parca);
    let bas = 0;
    for (const m of u.matchAll(FIIL)) { const son = (m.index || 0) + m[0].length; out.push(parca.slice(bas, son)); bas = son; }
    if (bas < parca.length) out.push(parca.slice(bas));
  }
  return out.map(x => x.trim()).filter(Boolean);
}

/** Hüküm fıkrasındaki bütün para tutarları, kimin lehine olduklarıyla. */
export function hukumAnaliz(metin: string, kararTarihi?: string): HukumKalemi[] {
  // UYAP ilamında başlık çoğu zaman harf aralıklı yazılır: "H Ü K Ü M".
  const u = metin.replace(/\s+/g, " ").replace(/H\s?Ü\s?K\s?Ü\s?M(?=\s*[:\-])/g, "HÜKÜM");
  const i = Math.max(u.search(/HÜKÜM\s*:|GEREĞİ DÜŞÜNÜLDÜ|Gereği Düşünüldü|HÜKÜM-|HÜKÜM FIKRASI/i), 0);
  const hukum = u.slice(i);
  const out: HukumKalemi[] = [];
  const ekle = (k: HukumKalemi) => { if (k.tutar > 0 && !out.some(x => x.ad === k.ad && x.tutar === k.tutar && x.lehine === k.lehine)) out.push(k); };
  const kalemAdi = (uc: string) => /MANEVİ TAZMİNAT/.test(uc) ? "Manevi tazminat" : /MADDİ TAZMİNAT|DESTEKTEN YOKSUN|İŞ GÖREMEZLİK|İŞGÖREMEZLİK/.test(uc) ? "Maddi tazminat"
    : /KIDEM/.test(uc) ? "Kıdem tazminatı" : /İHBAR/.test(uc) ? "İhbar tazminatı" : /FAZLA (?:MESAİ|ÇALIŞMA)/.test(uc) ? "Fazla mesai alacağı"
    : /YILLIK (?:ÜCRETLİ )?İZİN/.test(uc) ? "Yıllık izin ücreti" : /GENEL TATİL|BAYRAM/.test(uc) ? "UBGT alacağı" : /HAFTA TATİLİ/.test(uc) ? "Hafta tatili alacağı"
    : /KÖTÜ ?NİYET/.test(uc) ? "Kötüniyet tazminatı" : /ÜCRET ALACAĞ|BAKİYE ÜCRET|ÜCRETİN/.test(uc) ? "Ücret alacağı" : /PRİM/.test(uc) ? "Prim alacağı"
    : /NAFAKA/.test(uc) ? "Nafaka" : /KİRA/.test(uc) ? "Kira bedeli" : /DEĞER KAYB/.test(uc) ? "Değer kaybı" : /ARAÇ MAHRUMİYET|KAZANÇ KAYB/.test(uc) ? "Kazanç kaybı" : "Asıl alacak";
  for (const c of fikralar(hukum)) {
    const tutarlar = [...c.matchAll(TUTARLAR)];
    if (!tutarlar.length) continue;
    const uc = ust(c);
    const lehine = lehineBul(uc);
    const cumle = c.slice(0, 400);
    const tc = c.match(TARIH_IFADE);
    const fzC = faizTuru(c) || "yasal";
    // Vekâlet ücreti, yargılama gideri, harç: fıkrada gider kalemleri tek tek sayılsa da tek tutar ("toplam …" ya da en büyüğü).
    const tek = () => { const top = c.match(new RegExp("toplam\\s*(?:olarak\\s*)?" + TUTAR.source, "iu")); return top ? para(top[1]) : Math.max(...tutarlar.map(m => para(m[1]))); };
    if (/VEKALET ÜCRET|VEKÂLET ÜCRET|AVUKATLIK ÜCRET/.test(uc)) { ekle({ ad: "Vekâlet ücreti", tutar: para(tutarlar[0][1]), faizTuru: "yasal", faizBaslangic: kararTarihi, lehine, cumle }); continue; }
    if (/YARGILAMA GİDER/.test(uc)) { ekle({ ad: "Yargılama gideri", tutar: tek(), faizTuru: "yasal", faizBaslangic: kararTarihi, lehine, cumle }); continue; }
    if (/HARÇ|HARC/.test(uc) && lehine !== "hazine") { ekle({ ad: "Harç", tutar: tek(), faizTuru: "yasal", faizBaslangic: kararTarihi, lehine, cumle }); continue; }
    // Bir fıkrada birden çok alacak ("50.000 TL kıdem, 20.000 TL ihbar tazminatının … tahsiline"): her tutar kendi kalemi;
    // adı tutarın ardındaki (yoksa önündeki) sözcüklerden; faiz türü ve başlangıcı bu tutardan sonra gelen ilk ifadeden.
    tutarlar.forEach((m, j) => {
      const bas = (m.index || 0) + m[0].length, son = j + 1 < tutarlar.length ? tutarlar[j + 1].index || c.length : c.length;
      const once = c.slice(j ? (tutarlar[j - 1].index || 0) + tutarlar[j - 1][0].length : 0, m.index || 0);
      const sonra = c.slice(bas, Math.min(son, bas + 160));
      let ad = kalemAdi(ust(sonra));
      if (ad === "Asıl alacak") ad = kalemAdi(ust(once.slice(-80)));
      if (ad === "Asıl alacak" && tutarlar.length === 1) ad = kalemAdi(uc);
      const kalanC = c.slice(bas);
      const t = kalanC.match(TARIH_IFADE) || tc;
      const fz = faizTuruIlk(kalanC) || fzC;
      const brutMu = /BRÜT/.test(ust(once.slice(-20) + " " + sonra.slice(0, 20)));
      ekle({ ad, tutar: para(m[1]), faizTuru: /FAİZ/.test(uc) ? fz : "yok", faizBaslangic: t ? iso(t[1], t[2], t[3]) : undefined, lehine, cumle, brutMu });
    });
  }
  return out;
}

/** Hüküm fıkrasından bir tarafın lehine olan alacak kalemleri (varsayılan: davacı tarafı). */
export function hukumKalemleri(metin: string, kararTarihi?: string, yan: "birinci" | "ikinci" = "birinci"): Kalem[] {
  return hukumAnaliz(metin, kararTarihi).filter(x => x.lehine === yan || (x.lehine === "belirsiz" && yan === "birinci" && x.ad !== "Vekâlet ücreti"))
    .map(({ lehine: _l, cumle: _c, brutMu: _b, ...k }) => k);
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
/** kalem: false → alacak kalemleri yazılmaz (hükümden okunan kalemler önizlemede avukatın onayıyla yazılır). */
export function icraDoldur(b: IcraBilgi, metinler: string[], secenek: { kalem?: boolean } = {}): { yeni: IcraBilgi; dolan: string[] } {
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
  if (secenek.kalem !== false && bosKalem && !b.asil && r.kalemler.length) { y.kalemler = r.kalemler; dolan.push(`${r.kalemler.length} alacak kalemi`); }
  if (r.yol === "ilamli" && !y.mahiyet && r.kalemler.length) { y.mahiyet = "4045"; dolan.push("takip mahiyeti (para alacağı)"); }
  return { yeni: y, dolan };
}

/**
 * Yanlış eklenen evrakın icra bilgilerine yazdıklarını geri alır: ilam / çek / senet / kira bilgilerinde ve alacak
 * kalemlerinde, o evraktan okunan değerle aynı olan her şey silinir (elle değiştirilmiş olanlar kalır). Ardından kalan
 * evrakla yeniden doldurmak için icraDoldur çağrılır.
 */
export function icraEvrakGeriAl(b: IcraBilgi, metin: string): IcraBilgi {
  const r = icraEvraktan(metin);
  if (r.tur === "diger") return b;
  const temizle = <T extends object>(eski: T | undefined, gelen: T | undefined): T | undefined => {
    if (!eski || !gelen) return eski;
    const out = { ...eski } as Record<string, unknown>;
    for (const [k, v] of Object.entries(gelen)) if (v !== undefined && v !== "" && out[k] === v) delete out[k];
    return Object.keys(out).length ? (out as T) : undefined;
  };
  const y: IcraBilgi = { ...b, ilam: temizle(b.ilam, r.bilgi.ilam), senet: temizle(b.senet, r.bilgi.senet), kira: temizle(b.kira, r.bilgi.kira) };
  if (r.bilgi.belge && b.belge === r.bilgi.belge) y.belge = undefined;
  const ayni = (k: Kalem) => r.kalemler.some(x => x.ad === k.ad.replace(/\s*\(net\)$/i, "") && Math.abs((x.tutar || 0) - (k.brut?.tutar ?? k.tutar ?? 0)) < 0.01);
  if (b.kalemler?.length) { const kalan = b.kalemler.filter(k => !ayni(k)); y.kalemler = kalan.length ? kalan : undefined; }
  if (!y.kalemler?.length && r.yol === "ilamli" && b.mahiyet === "4045") y.mahiyet = undefined;
  return y;
}