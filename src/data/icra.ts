// İcra takibi hazırlığı: UYAP'ta takip açmak için gereken bütün bilgi (takip yolu, alacaklı, borçlular, dayanak belge, alacak
// kalemleri, işlemiş faiz, takip sonrası faiz, talep) ve bunlardan takip talebi özeti. Hesaplar cihazda yapılır.
// Oranlar (kaynak: Resmî Gazete; Celse'nin bildiği son durum):
//  - Yasal faiz (3095 m.1): %9 (2006–31.05.2024), %24 (01.06.2024, 8485 s. CK), %31 (31.07.2026, 7589 s. Kanun: TCMB reeskont
//    oranının %80'i; her yıl 31 Aralık oranına göre, 30 Haziran oranı 5 puan ayrışırsa ikinci yarıda o).
//  - Avans faizi (3095 m.2/2, ticari işlerde temerrüt): TCMB avans faizi oranları 1990'dan 20.12.2025'e (%39,75) dönem dönem.
//  - Vekâlet ücreti: 2026–2027 AAÜT (RG 03.11.2026): nispi dilimler; icra dairesinde maktu 12.500 TL (takip 78.125 TL'ye kadar),
//    tahliye 26.000 TL; borçlu ödeme süresinde öderse dörtte üçü.
import type { Foy } from "./foy";

export type TakipYolu = "genel" | "kambiyo" | "kira" | "ilamli" | "ipotek" | "tasinir_rehni";
export type FaizTuru = "yasal" | "avans" | "ttk1530" | "sozlesme" | "mevduat" | "yok";
export type ParaBirimi = "TL" | "USD" | "EUR" | "GBP";

export interface Kisi { ad: string; kimlikNo?: string; adres?: string }
export interface Masraf { ad: string; tutar: number }
/** Alacak kalemi: UYAP'ta her kalem kendi faiz türüyle ayrı satırdır (ör. manevi tazminat avans faizli, yargılama gideri yasal faizli). */
export interface Kalem { ad: string; tutar: number; faizTuru?: FaizTuru; oran?: number; faizBaslangic?: string; islemisElle?: number }
export interface IcraBilgi {
  yol: TakipYolu;
  talep?: "haciz" | "haciz_tahliye" | "tahliye" | "rehin";
  // Dayanak belge
  ilam?: { mahkeme?: string; esasNo?: string; kararNo?: string; kararTarihi?: string; kesinlesme?: string; dosyaTuru?: string };
  senet?: { tur?: "bono" | "cek" | "police"; duzenleme?: string; vade?: string; seriNo?: string; banka?: string; kesideci?: string };
  kira?: { sozlesmeTarihi?: string; aylikKira?: number; aylar?: string; adres?: string };
  belge?: string; // genel haciz: fatura, sözleşme, cari hesap, ihtarname…
  ekBorclular?: Kisi[];
  // Alacak
  kalemler?: Kalem[];
  /** ödemenin yapılacağı hesap (takip talebinin 1. maddesi) */
  hesap?: { iban?: string; banka?: string; sahibi?: "vekil" | "alacakli" };
  /** adres yerine MERNİS adresi seçilsin */
  mernisAlacakli?: boolean; mernisBorclu?: boolean;
  paraBirimi?: ParaBirimi;
  kur?: number; // takip tarihindeki kur (yabancı para)
  asil?: number;
  faizBaslangic?: string; // YYYY-AA-GG: temerrüt / vade / karar tarihi
  takipTarihi?: string; // YYYY-AA-GG
  faizTuru?: FaizTuru;
  oran?: number; // elle oran (yıllık %): sözleşme / mevduat / tablo dışı dönem
  islemisFaizElle?: number; // hesaplanan yerine elle
  masraflar?: Masraf[];
  ilamVekalet?: number; // ilamlı: ilamdaki vekâlet ücreti
  yargilamaGideri?: number; // ilamlı: ilamdaki yargılama gideri
  /** UYAP takip mahiyeti (Örnek 7 ve 4-5'te zorunlu; 18.12.2015 duyurusu) */
  mahiyet?: string;
  /** TBK 100 (eski BK 84): kısmi ödemeler önce faiz, masraf ve ferilere mahsup edilsin (varsayılan evet) */
  tbk100?: boolean;
  bsmv?: boolean;
  kkdf?: boolean;
  takipSonrasiTur?: FaizTuru;
  takipSonrasiOran?: number;
  not?: string;
}

export const TAKIP_YOLLARI: { k: TakipYolu; ad: string; ornek?: string }[] = [
  { k: "genel", ad: "İlamsız takip – genel haciz yolu", ornek: "Örnek 7" },
  { k: "kambiyo", ad: "Kambiyo senetlerine dayalı haciz yolu", ornek: "Örnek 10" },
  { k: "kira", ad: "Kira alacağı (ilamsız tahliye ve haciz)", ornek: "Örnek 13" },
  { k: "ilamli", ad: "İlamlı takip – para alacağı", ornek: "Örnek 4-5" },
  { k: "ipotek", ad: "İpoteğin paraya çevrilmesi yoluyla takip", ornek: "Örnek 9" },
  { k: "tasinir_rehni", ad: "Taşınır rehninin paraya çevrilmesi yoluyla takip", ornek: "Örnek 8" }
];
/** UYAP takip mahiyeti kodları (XML: <dosya mahiyetKodu="…">). Yalnız biri seçilir. */
export const MAHIYETLER: { kod: string; ad: string; yol: "genel" | "ilamli" }[] = [
  { kod: "1007", ad: "Telefon (sabit)", yol: "genel" }, { kod: "1107", ad: "Çocuk teslimi", yol: "genel" }, { kod: "1207", ad: "Tüketici hakem heyeti", yol: "genel" },
  { kod: "1307", ad: "Belgesiz", yol: "genel" }, { kod: "1407", ad: "Sözleşme / protokol", yol: "genel" }, { kod: "2007", ad: "Telefon (cep)", yol: "genel" },
  { kod: "3007", ad: "İnternet / TV", yol: "genel" }, { kod: "4007", ad: "Su", yol: "genel" }, { kod: "5007", ad: "Elektrik", yol: "genel" },
  { kod: "6007", ad: "Doğal gaz", yol: "genel" }, { kod: "7007", ad: "Kredi kartı", yol: "genel" }, { kod: "8008", ad: "Kredi sözleşmesi", yol: "genel" },
  { kod: "9009", ad: "Nafaka", yol: "genel" },
  { kod: "1045", ad: "Nafaka", yol: "ilamli" }, { kod: "2045", ad: "Çocuk teslimi", yol: "ilamli" }, { kod: "3045", ad: "Tüketici hakem heyeti", yol: "ilamli" },
  { kod: "4045", ad: "Para alacağı", yol: "ilamli" }
];

export const FAIZ_TURLERI: { k: FaizTuru; ad: string }[] = [
  { k: "yasal", ad: "Yasal faiz (3095 m.1)" },
  { k: "avans", ad: "Avans faizi – ticari temerrüt (3095 m.2/2)" },
  { k: "ttk1530", ad: "TTK 1530 temerrüt faizi (mal ve hizmet tedarikinde geç ödeme)" },
  { k: "sozlesme", ad: "Sözleşmedeki temerrüt faizi" },
  { k: "mevduat", ad: "Bankalarca uygulanan en yüksek mevduat faizi" },
  { k: "yok", ad: "Faiz istenmiyor" }
];
export const turAdi = (k?: FaizTuru) => FAIZ_TURLERI.find(x => x.k === k)?.ad || "";

/** Dönemsel oran tabloları: [başlangıç (dahil), yıllık %]. */
/** Yasal faiz (3095 m.1): 1984 ilk metin %30; 97/10353 BKK %50; 4489 s. Kanun %60; 2002/3978 BKK %55; 2003/5754 BKK %50;
 * 2003/6667 BKK %43; 2004/7546 BKK %38; 5335 s. Kanun %12; 2005/9831 BKK %9; 8485 s. CK %24; 7589 s. Kanun %31. */
export const YASAL: [string, number][] = [["1984-12-19", 30], ["1998-01-01", 50], ["2000-01-01", 60], ["2002-07-01", 55], ["2003-07-01", 50], ["2004-01-01", 43],
  ["2004-07-01", 38], ["2005-05-01", 12], ["2006-01-01", 9], ["2024-06-01", 24], ["2026-07-31", 31]];
/** TTK m.1530/7 temerrüt faizi: TCMB her yıl ilan eder (tcmb.gov.tr "TTK Md. 1530"). */
export const TTK1530: [string, number][] = [["2013-01-01", 15], ["2014-01-01", 12.75], ["2015-01-01", 11.5], ["2016-01-01", 11.5], ["2017-01-01", 10.75], ["2018-01-01", 10.75],
  ["2019-01-01", 21.25], ["2020-01-01", 15], ["2021-01-01", 18.25], ["2022-01-01", 17.25], ["2023-01-01", 11.75], ["2024-01-01", 48], ["2025-01-01", 53.25], ["2026-01-01", 43]];
/** Avans faizi: TCMB "Reeskont ve Avans Faiz Oranları" tablosu (1990–20.12.2025, tcmb.gov.tr). Politika faizi değildir. */
export const AVANS: [string, number][] = [
  ["1990-01-01", 45.0], ["1990-09-20", 48.25], ["1990-11-23", 50.75], ["1991-02-15", 54.5], ["1994-01-27", 65.0], ["1994-04-21", 98.0], ["1994-07-12", 85.0], ["1994-07-27", 75.0], ["1994-10-01", 64.0], ["1995-06-10", 60.0], ["1995-08-01", 57.0], ["1997-08-02", 80.0], ["1999-12-30", 70.0], ["2002-05-17", 64.0], ["2003-06-14", 57.0], ["2003-10-08", 48.0], ["2004-06-15", 42.0], ["2005-01-13", 35.0], ["2005-05-25", 30.0], ["2005-12-20", 25.0], ["2006-12-20", 29.0], ["2007-12-28", 27.0], ["2009-04-09", 20.0], ["2009-06-12", 19.0], ["2009-12-22", 16.0], ["2010-12-30", 15.0], ["2011-12-29", 17.75], ["2012-06-19", 16.5], ["2012-12-20", 13.75], ["2013-06-21", 11.0], ["2013-12-27", 11.75], ["2014-12-14", 10.5], ["2016-12-31", 9.75], ["2018-06-29", 19.5], ["2019-10-11", 18.25], ["2019-12-21", 13.75], ["2020-06-13", 10.0], ["2020-12-19", 16.75], ["2021-12-31", 15.75], ["2022-12-31", 10.75], ["2023-06-24", 16.75], ["2023-09-01", 26.75], ["2023-09-28", 31.75], ["2023-11-01", 36.75], ["2023-12-01", 41.75], ["2023-12-23", 44.25], ["2024-04-01", 51.75], ["2024-12-28", 49.25], ["2025-03-08", 44.25], ["2025-09-17", 42.25], ["2025-12-20", 39.75]
];

const gun = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
const r2 = (x: number) => Math.round(x * 100) / 100;

export interface FaizDilimi { bas: string; son: string; gun: number; oran: number; tutar: number }
/** Basit faiz, dönem dönem: anapara × oran × gün / 365. Tabloda karşılığı olmayan dönem için "eksik" döner. */
export function islemisFaiz(asil: number, bas: string, son: string, tur: FaizTuru, elleOran?: number): { tutar: number; dilimler: FaizDilimi[]; eksik?: string } {
  if (!asil || !bas || !son || tur === "yok" || gun(bas, son) <= 0) return { tutar: 0, dilimler: [] };
  let tablo: [string, number][];
  if (elleOran !== undefined && elleOran > 0) tablo = [["1900-01-01", elleOran]];
  else if (tur === "yasal") tablo = YASAL;
  else if (tur === "avans") tablo = AVANS;
  else if (tur === "ttk1530") tablo = TTK1530;
  else return { tutar: 0, dilimler: [], eksik: "Bu faiz türü için yıllık oranı yazın." };
  const dilimler: FaizDilimi[] = [];
  let eksik: string | undefined;
  if (bas < tablo[0][0]) eksik = `${tablo[0][0].split("-").reverse().join(".")} öncesi dönemin oranı Celse'de yok; yıllık oranı elle yazın.`;
  for (let i = 0; i < tablo.length; i++) {
    const dBas = tablo[i][0] > bas ? tablo[i][0] : bas;
    const dSon = i + 1 < tablo.length && tablo[i + 1][0] < son ? tablo[i + 1][0] : son;
    const g = gun(dBas, dSon);
    if (g <= 0) continue;
    dilimler.push({ bas: dBas, son: dSon, gun: g, oran: tablo[i][1], tutar: r2(asil * tablo[i][1] / 100 * g / 365) });
  }
  return { tutar: r2(dilimler.reduce((a, d) => a + d.tutar, 0)), dilimler, eksik };
}

/** 2026–2027 AAÜT Üçüncü Kısım nispi dilimleri. */
const DILIMLER: [number, number][] = [[800000, 16], [800000, 15], [1600000, 14], [1600000, 13], [2400000, 11], [3200000, 8], [4000000, 5], [4800000, 3], [5600000, 2], [Infinity, 1]];
export const ICRA_MAKTU = 12500, ICRA_MAKTU_ESIK = 78125, TAHLIYE_MAKTU = 26000;
export function nispiUcret(matrah: number): number {
  let kalan = matrah, ucret = 0;
  for (const [dilim, oran] of DILIMLER) { const x = Math.min(kalan, dilim); ucret += x * oran / 100; kalan -= x; if (kalan <= 0) break; }
  return r2(ucret);
}
/** İcra takibinde vekâlet ücreti (bilgi amaçlı; dosya hesabını icra dairesi yapar). */
export function icraVekalet(takipMiktari: number, tahliye: boolean): { ucret: number; aciklama: string; ucDortte: number } {
  const alacak = takipMiktari <= 0 ? 0 : takipMiktari <= ICRA_MAKTU_ESIK ? Math.min(ICRA_MAKTU, takipMiktari) : nispiUcret(takipMiktari);
  const ucret = r2(alacak + (tahliye ? TAHLIYE_MAKTU : 0));
  const aciklama = (takipMiktari <= ICRA_MAKTU_ESIK ? `maktu ${tl(ICRA_MAKTU)} (takip ${tl(ICRA_MAKTU_ESIK)}'ye kadar; takip miktarını geçemez)` : "nispi tarife")
    + (tahliye ? ` + tahliye maktu ${tl(TAHLIYE_MAKTU)}` : "");
  return { ucret, aciklama, ucDortte: r2(ucret * 3 / 4) };
}

export const tl = (x: number, pb: ParaBirimi = "TL") => x.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + pb;
const tarihYaz = (x?: string) => (x ? x.split("-").reverse().join(".") : "…");

/** Takip yoluna göre hazır kalem adları (UYAP takip talebindeki adlarla). */
export const KALEM_ADLARI: Record<TakipYolu, string[]> = {
  ilamli: ["Asıl alacak", "Manevi tazminat", "Maddi tazminat", "Yargılama gideri", "Vekâlet ücreti", "Bakiye harç", "Kıdem tazminatı", "İhbar tazminatı", "Nafaka"],
  genel: ["Asıl alacak", "Fatura bedeli", "Cari hesap alacağı", "Kredi kartı borcu", "Sözleşme bedeli", "Cezai şart"],
  kambiyo: ["Çek bedeli", "Senet bedeli", "Poliçe bedeli"],
  kira: ["Kira bedeli", "Aidat", "Ortak gider"],
  ipotek: ["Asıl alacak", "Kredi borcu"],
  tasinir_rehni: ["Asıl alacak", "Kredi borcu"]
};

/** Kalemler; eski kayıtlarda tek asıl alacak + ilam vekâlet ücreti + yargılama gideri kalemlere çevrilir. */
export function kalemleri(b: IcraBilgi): Kalem[] {
  if (b.kalemler) return b.kalemler;
  const xs: Kalem[] = [];
  // Yeni föy: hazır ilk kalem (takip yoluna göre adı) boş tutarla gelir.
  if (!b.asil && !b.yargilamaGideri && !b.ilamVekalet) return [{ ad: KALEM_ADLARI[b.yol || "genel"][0], tutar: 0, faizTuru: b.faizTuru || "yasal" }];
  if (b.asil) xs.push({ ad: "Asıl alacak", tutar: b.asil, faizTuru: b.faizTuru || "yasal", oran: b.oran, faizBaslangic: b.faizBaslangic, islemisElle: b.islemisFaizElle });
  if (b.yol === "ilamli" && b.yargilamaGideri) xs.push({ ad: "Yargılama gideri", tutar: b.yargilamaGideri, faizTuru: "yasal", faizBaslangic: b.ilam?.kararTarihi });
  if (b.yol === "ilamli" && b.ilamVekalet) xs.push({ ad: "Vekâlet ücreti", tutar: b.ilamVekalet, faizTuru: "yasal", faizBaslangic: b.ilam?.kararTarihi });
  return xs;
}

export interface KalemHesap { k: Kalem; faiz: number; dilimler: FaizDilimi[]; eksik?: string }
export interface IcraHesap {
  kalemler: KalemHesap[]; asil: number; faiz: number; masraf: number; ek: { ad: string; tutar: number }[];
  toplam: number; toplamTL: number; vekalet: ReturnType<typeof icraVekalet>;
}
export function icraHesapla(b: IcraBilgi, bugun = new Date().toISOString().slice(0, 10)): IcraHesap {
  const tarih = b.takipTarihi || bugun;
  const kalemler: KalemHesap[] = kalemleri(b).map(k => {
    if (k.islemisElle !== undefined) return { k, faiz: k.islemisElle, dilimler: [] };
    const f = islemisFaiz(k.tutar || 0, k.faizBaslangic || "", tarih, k.faizTuru || "yasal", k.oran);
    return { k, faiz: f.tutar, dilimler: f.dilimler, eksik: f.eksik };
  });
  const asil = r2(kalemler.reduce((a, x) => a + (x.k.tutar || 0), 0));
  const faiz = r2(kalemler.reduce((a, x) => a + x.faiz, 0));
  const masraf = r2((b.masraflar || []).reduce((a, m) => a + (m.tutar || 0), 0));
  const ek: { ad: string; tutar: number }[] = [];
  const ilk = kalemler[0]?.k.tutar || 0;
  if (b.yol === "kambiyo" && ilk) {
    // TTK m.644/1-c: çek bedelinin %10'u çek tazminatı; TTK m.725/1-d: bono/poliçede binde üçü aşmayan komisyon.
    if (b.senet?.tur === "cek") ek.push({ ad: "Çek tazminatı (%10, TTK 644)", tutar: r2(ilk * 0.1) });
    else ek.push({ ad: "Komisyon (binde 3, TTK 725)", tutar: r2(ilk * 0.003) });
  }
  const toplam = r2(asil + faiz + masraf + ek.reduce((a, x) => a + x.tutar, 0));
  const yabanci = b.paraBirimi && b.paraBirimi !== "TL";
  const toplamTL = yabanci ? r2(toplam * (b.kur || 0)) : toplam;
  const tahliye = b.yol === "kira" && (b.talep === "haciz_tahliye" || b.talep === "tahliye");
  return { kalemler, asil, faiz, masraf, ek, toplam, toplamTL, vekalet: icraVekalet(toplamTL, tahliye) };
}

const faizKisa = (k?: FaizTuru) => (k === "yasal" ? "yasal faiz" : k === "avans" ? "avans faizi" : k === "ttk1530" ? "TTK 1530 temerrüt faizi" : k === "sozlesme" ? "sözleşmedeki temerrüt faizi" : k === "mevduat" ? "en yüksek mevduat faizi" : "");
/** Takip sonrası faiz: her kalem kendi faiz türüyle ("manevi tazminat için avans faizi, diğer alacaklar için yasal faiz"). */
function sonrakiFaiz(b: IcraBilgi): string {
  const xs = kalemleri(b).filter(k => k.tutar && (k.faizTuru || "yasal") !== "yok");
  if (!xs.length) return "";
  const gruplar = new Map<string, string[]>();
  for (const k of xs) { const t = faizKisa(k.faizTuru || "yasal") + (k.oran ? ` (yıllık %${String(k.oran).replace(".", ",")})` : ""); gruplar.set(t, [...(gruplar.get(t) || []), k.ad.toLocaleLowerCase("tr")]); }
  if (gruplar.size === 1) return `takip tarihinden itibaren ${[...gruplar.keys()][0]} oranından az olmamak üzere değişen oranlarda faizi`;
  const parcalar = [...gruplar.entries()].map(([t, adlar], i, a) => (i === a.length - 1 ? `diğer alacaklar için hesaplanacak ${t}` : `${adlar.join(", ")} için hesaplanacak ${t}`));
  return `takip tarihinden itibaren ${parcalar.join(" ve ")} oranından az olmamak üzere değişen oranlarda faizi`;
}

/** "Alacaklının talep ettiği hak" metni (UYAP XML: alacaklininTalepEttigiHak). */
export function talepEdilenHak(b: IcraBilgi, bugun = new Date().toISOString().slice(0, 10)): string {
  const h = icraHesapla(b, bugun);
  const pb = b.paraBirimi || "TL";
  const faiz = sonrakiFaiz(b);
  return `${tl(h.toplam, pb)} tutarındaki toplam alacağın, fazlaya ilişkin haklarımız saklı kalmak ve tahsilde tekerrür olmamak kaydıyla, ${faiz ? faiz + ", " : ""}icra giderleri ve avukatlık ücreti ile birlikte tahsili talebidir.`
    + (b.tbk100 !== false ? " TBK 100. madde uyarınca kısmi ödemeler öncelikle faiz ve giderlere mahsup edilecektir." : "");
}

/** UYAP'ta takip açmak için eksik kalan bilgiler. */
export function icraEksikler(f: Foy, b: IcraBilgi): string[] {
  const e: string[] = [];
  const m = f.muvekkilBilgi || {}, k = f.karsiBilgi || {};
  if (f.taraf === "davali") e.push("Föyde borçlu tarafın vekili görünüyorsunuz; takip talebi alacaklı vekili olarak hazırlanır.");
  if (!f.mahkeme) e.push("İcra dairesi");
  if (!f.muvekkil) e.push("Alacaklının adı / unvanı");
  if (!m.kimlikNo) e.push("Alacaklının T.C. kimlik ya da vergi no'su");
  if (!m.adres && !b.mernisAlacakli) e.push("Alacaklının adresi (ya da MERNİS adresi)");
  if (!f.karsiTaraf) e.push("Borçlunun adı / unvanı");
  if (!k.kimlikNo) e.push("Borçlunun T.C. kimlik ya da vergi no'su");
  if (!k.adres && !b.mernisBorclu) e.push("Borçlunun adresi (ya da MERNİS adresi)");
  if (!b.hesap?.iban) e.push("Ödemenin yapılacağı hesap (IBAN)");
  const ks = kalemleri(b);
  if (!ks.some(x => x.tutar)) e.push("En az bir alacak kalemi ve tutarı");
  for (const x of ks) if (x.tutar && (x.faizTuru || "yasal") !== "yok" && !x.faizBaslangic && x.islemisElle === undefined) e.push(`"${x.ad}" için faiz başlangıç tarihi`);
  if (b.paraBirimi && b.paraBirimi !== "TL" && !b.kur) e.push("Takip tarihindeki döviz kuru");
  if (b.yol === "ilamli" && (!b.ilam?.mahkeme || !b.ilam?.esasNo || !b.ilam?.kararNo || !b.ilam?.kararTarihi)) e.push("İlamın mahkemesi, esas ve karar no'su, karar tarihi");
  if (b.yol === "kambiyo" && (!b.senet?.tur || !b.senet?.vade)) e.push("Senedin türü ve vadesi");
  if (b.yol === "kira" && (!b.kira?.aylikKira || !b.kira?.aylar)) e.push("Aylık kira ve takibe konu aylar");
  if (b.yol === "genel" && !b.belge) e.push("Alacağın dayanağı (fatura, sözleşme, cari hesap…)");
  if ((b.yol === "genel" || b.yol === "ilamli") && !b.mahiyet) e.push("Takip mahiyeti (Örnek 7 ve 4-5'te zorunlu)");
  return e;
}

/** Takip talebi özeti: UYAP'ın ürettiği takip talebi düzeninde. */
export function takipTalebiMetni(f: Foy, b: IcraBilgi, bugun = new Date().toISOString().slice(0, 10), vekil?: string): string {
  const h = icraHesapla(b, bugun);
  const pb = b.paraBirimi || "TL";
  const yol = TAKIP_YOLLARI.find(x => x.k === b.yol);
  const m = f.muvekkilBilgi || {}, k = f.karsiBilgi || {};
  const kisi = (ad?: string, kimlik?: string, adres?: string, mernis?: boolean) => [ad || "…", kimlik ? `(T.C./V.K.N. ${kimlik})` : "", mernis ? "– MERNİS adresi seçilmiştir" : adres ? `– ${adres}` : ""].filter(Boolean).join(" ");
  const borclular = [kisi(f.karsiTaraf, k.kimlikNo, k.adres, b.mernisBorclu), ...(b.ekBorclular || []).filter(x => x.ad).map(x => kisi(x.ad, x.kimlikNo, x.adres))];
  // UYAP icra emrindeki kalıp: "… Mahkemesi'nin 2015/432 (Hukuk Dava Dosyası) esas ve 2026/592 karar sayılı 24/06/2026 karar tarihli ilamı"
  const dayanak = b.yol === "ilamli" ? `${b.ilam?.mahkeme || "…"}'nin ${b.ilam?.esasNo || "…"} (${b.ilam?.dosyaTuru || "Hukuk Dava Dosyası"}) esas ve ${b.ilam?.kararNo || "…"} karar sayılı ${b.ilam?.kararTarihi ? b.ilam.kararTarihi.split("-").reverse().join("/") : "…"} karar tarihli ilamı${b.ilam?.kesinlesme ? ` (kesinleşme ${tarihYaz(b.ilam.kesinlesme)})` : ""}`
    : b.yol === "kambiyo" ? `${b.senet?.tur === "cek" ? "Çek" : b.senet?.tur === "police" ? "Poliçe" : "Bono"}: düzenleme ${tarihYaz(b.senet?.duzenleme)}, vade ${tarihYaz(b.senet?.vade)}${b.senet?.seriNo ? `, seri/çek no ${b.senet.seriNo}` : ""}${b.senet?.banka ? `, ${b.senet.banka}` : ""}${b.senet?.kesideci ? `, keşideci ${b.senet.kesideci}` : ""}`
    : b.yol === "kira" ? `${tarihYaz(b.kira?.sozlesmeTarihi)} tarihli kira sözleşmesi; aylık kira ${b.kira?.aylikKira ? tl(b.kira.aylikKira, pb) : "…"}; takibe konu aylar: ${b.kira?.aylar || "…"}${b.kira?.adres ? `; kiralanan: ${b.kira.adres}` : ""}`
    : b.yol === "ipotek" || b.yol === "tasinir_rehni" ? (b.belge || "Rehin / ipotek belgesi: …")
    : (b.belge || "…");
  const talep = b.talep === "haciz_tahliye" ? "Haciz ve tahliye yolu" : b.talep === "tahliye" ? "Tahliye yolu"
    : b.yol === "ipotek" || b.yol === "tasinir_rehni" ? "Rehnin paraya çevrilmesi yolu" : "Haciz yolu";
  const sat: string[] = [];
  const mah = MAHIYETLER.find(x => x.kod === b.mahiyet);
  sat.push("TAKİP TALEBİ ÖZETİ (UYAP'a giriş sırasıyla)", "");
  sat.push(`Takip yolu: ${yol ? yol.ad + (yol.ornek ? ` (${yol.ornek})` : " (örnek no'yu UYAP'ta seçin)") : "…"}${mah ? ` · takip mahiyeti: ${mah.ad} (${mah.kod})` : ""}`);
  sat.push(`İcra dairesi: ${f.mahkeme || "…"}`);
  sat.push(`1. Alacaklı: ${kisi(f.muvekkil, m.kimlikNo, m.adres, b.mernisAlacakli)}`);
  sat.push(`   Vekili: ${vekil ? "Av. " + vekil.replace(/^av\.?\s*/i, "") : "…"}${m.vekaletname ? ` (vekâletname: ${m.vekaletname})` : ""}`);
  sat.push(`   Ödeme hesabı: ${b.hesap?.iban ? `${b.hesap.iban}${b.hesap.banka ? " – " + b.hesap.banka : ""} (${b.hesap.sahibi === "alacakli" ? "alacaklı adına" : "vekil adına"})` : "…"}`);
  sat.push(`2. Borçlu${borclular.length > 1 ? "lar" : ""}:`);
  borclular.forEach((x, i) => sat.push(`   ${i + 1}) ${x}`));
  sat.push(`3. Alacağın dayanağı: ${dayanak}`);
  sat.push("4. Alacak kalemleri:");
  for (const x of h.kalemler) {
    if (!x.k.tutar) continue;
    const tur = x.k.faizTuru || "yasal";
    sat.push(`   ${tl(x.k.tutar, pb)}  ${x.k.ad}${tur !== "yok" ? ` (istenen: ${faizKisa(tur)}${x.k.oran ? ` yıllık %${String(x.k.oran).replace(".", ",")}` : ""})` : ""}`);
    if (tur !== "yok" && x.faiz) {
      sat.push(`   ${tl(x.faiz, pb)}  ${x.k.ad} bedeline işlemiş ${faizKisa(tur)}${x.k.faizBaslangic ? ` (${tarihYaz(x.k.faizBaslangic)} – ${tarihYaz(b.takipTarihi || bugun)})` : ""}`);
      for (const d of x.dilimler) sat.push(`        ${tarihYaz(d.bas)} – ${tarihYaz(d.son)}: ${d.gun} gün × %${String(d.oran).replace(".", ",")} = ${tl(d.tutar, pb)}`);
    }
  }
  for (const x of h.ek) sat.push(`   ${tl(x.tutar, pb)}  ${x.ad}`);
  for (const x of b.masraflar || []) if (x.tutar) sat.push(`   ${tl(x.tutar, pb)}  ${x.ad || "Masraf"}`);
  sat.push(`   ${tl(h.toplam, pb)}  Toplam alacak${pb !== "TL" ? ` (takip tarihindeki kur ${b.kur || "…"} ile ${tl(h.toplamTL)}; ödeme günündeki kurla tahsili istenir)` : ""}`);
  sat.push(`5. Talep edilen hak: ${talepEdilenHak(b, bugun)}`);
  sat.push(`   TBK 100: ${b.tbk100 !== false ? "uygulanacak" : "uygulanmayacak"} · BSMV: ${b.bsmv ? "evet" : "hayır"} · KKDF: ${b.kkdf ? "evet" : "hayır"}`);
  sat.push(`6. Takip yolu (48/9): ${talep}`);
  if (b.not) sat.push(`Not: ${b.not}`);
  sat.push("");
  sat.push(`Bilgi: 2026–2027 AAÜT'ye göre icra vekâlet ücreti yaklaşık ${tl(h.vekalet.ucret)} (${h.vekalet.aciklama}); borçlu ödeme süresinde öderse ${tl(h.vekalet.ucDortte)}. Dosya hesabını icra dairesi yapar.`);
  return sat.join("\n");
}
