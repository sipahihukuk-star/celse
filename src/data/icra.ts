// İcra takibi hazırlığı: UYAP'ta takip açmak için gereken bütün bilgi (takip yolu, alacaklı, borçlular, dayanak belge, alacak
// kalemleri, işlemiş faiz, takip sonrası faiz, talep) ve bunlardan takip talebi özeti. Hesaplar cihazda yapılır.
// Oranlar (kaynak: Resmî Gazete; Celse'nin bildiği son durum):
//  - Yasal faiz (3095 m.1): %9 (2006–31.05.2024), %24 (01.06.2024, 8485 s. CK), %31 (31.07.2026, 7589 s. Kanun: TCMB reeskont
//    oranının %80'i; her yıl 31 Aralık oranına göre, 30 Haziran oranı 5 puan ayrışırsa ikinci yarıda o).
//  - Avans faizi (3095 m.2/2, ticari işlerde temerrüt): %39,75 (20.12.2025 TCMB tebliği). Daha eski dönemler Celse'de yok.
//  - Vekâlet ücreti: 2026–2027 AAÜT (RG 03.11.2026): nispi dilimler; icra dairesinde maktu 12.500 TL (takip 78.125 TL'ye kadar),
//    tahliye 26.000 TL; borçlu ödeme süresinde öderse dörtte üçü.
import type { Foy } from "./foy";

export type TakipYolu = "genel" | "kambiyo" | "kira" | "ilamli" | "ipotek" | "tasinir_rehni";
export type FaizTuru = "yasal" | "avans" | "sozlesme" | "mevduat" | "yok";
export type ParaBirimi = "TL" | "USD" | "EUR" | "GBP";

export interface Kisi { ad: string; kimlikNo?: string; adres?: string }
export interface Masraf { ad: string; tutar: number }
export interface IcraBilgi {
  yol: TakipYolu;
  talep?: "haciz" | "haciz_tahliye" | "tahliye" | "rehin";
  // Dayanak belge
  ilam?: { mahkeme?: string; esasNo?: string; kararNo?: string; kararTarihi?: string; kesinlesme?: string };
  senet?: { tur?: "bono" | "cek" | "police"; duzenleme?: string; vade?: string; seriNo?: string; banka?: string; kesideci?: string };
  kira?: { sozlesmeTarihi?: string; aylikKira?: number; aylar?: string; adres?: string };
  belge?: string; // genel haciz: fatura, sözleşme, cari hesap, ihtarname…
  ekBorclular?: Kisi[];
  // Alacak
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
  { k: "ipotek", ad: "İpoteğin paraya çevrilmesi yoluyla takip" },
  { k: "tasinir_rehni", ad: "Taşınır rehninin paraya çevrilmesi yoluyla takip" }
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
  { k: "sozlesme", ad: "Sözleşmedeki temerrüt faizi" },
  { k: "mevduat", ad: "Bankalarca uygulanan en yüksek mevduat faizi" },
  { k: "yok", ad: "Faiz istenmiyor" }
];
export const turAdi = (k?: FaizTuru) => FAIZ_TURLERI.find(x => x.k === k)?.ad || "";

/** Dönemsel oran tabloları: [başlangıç (dahil), yıllık %]. */
export const YASAL: [string, number][] = [["2006-01-01", 9], ["2024-06-01", 24], ["2026-07-31", 31]];
export const AVANS: [string, number][] = [["2025-12-20", 39.75]];

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

export interface IcraHesap {
  asil: number; faiz: number; faizDilimleri: FaizDilimi[]; faizEksik?: string; masraf: number; ek: { ad: string; tutar: number }[];
  toplam: number; toplamTL: number; vekalet: ReturnType<typeof icraVekalet>;
}
export function icraHesapla(b: IcraBilgi, bugun = new Date().toISOString().slice(0, 10)): IcraHesap {
  const asil = b.asil || 0;
  const tarih = b.takipTarihi || bugun;
  const f = b.islemisFaizElle !== undefined ? { tutar: b.islemisFaizElle, dilimler: [] as FaizDilimi[], eksik: undefined } : islemisFaiz(asil, b.faizBaslangic || "", tarih, b.faizTuru || "yasal", b.oran);
  const masraf = r2((b.masraflar || []).reduce((a, m) => a + (m.tutar || 0), 0));
  const ek: { ad: string; tutar: number }[] = [];
  if (b.yol === "ilamli") {
    if (b.ilamVekalet) ek.push({ ad: "İlam vekâlet ücreti", tutar: b.ilamVekalet });
    if (b.yargilamaGideri) ek.push({ ad: "Yargılama gideri", tutar: b.yargilamaGideri });
  }
  if (b.yol === "kambiyo" && asil) {
    // TTK m.644/1-c: çek bedelinin %10'u çek tazminatı; TTK m.725/1-d: bono/poliçede binde üçü aşmayan komisyon.
    if (b.senet?.tur === "cek") ek.push({ ad: "Çek tazminatı (%10, TTK 644)", tutar: r2(asil * 0.1) });
    else ek.push({ ad: "Komisyon (binde 3, TTK 725)", tutar: r2(asil * 0.003) });
  }
  const toplam = r2(asil + f.tutar + masraf + ek.reduce((a, x) => a + x.tutar, 0));
  const yabanci = b.paraBirimi && b.paraBirimi !== "TL";
  const toplamTL = yabanci ? r2(toplam * (b.kur || 0)) : toplam;
  const tahliye = b.yol === "kira" && (b.talep === "haciz_tahliye" || b.talep === "tahliye");
  return { asil, faiz: f.tutar, faizDilimleri: f.dilimler, faizEksik: f.eksik, masraf, ek, toplam, toplamTL, vekalet: icraVekalet(toplamTL, tahliye) };
}

/** "Alacaklının talep ettiği hak" metni (UYAP XML: alacaklininTalepEttigiHak). */
export function talepEdilenHak(b: IcraBilgi, bugun = new Date().toISOString().slice(0, 10)): string {
  const h = icraHesapla(b, bugun);
  const pb = b.paraBirimi || "TL";
  const tur = b.takipSonrasiTur || b.faizTuru || "yasal";
  const oran = b.takipSonrasiOran ?? (tur === b.faizTuru ? b.oran : undefined);
  const faiz = tur === "yok" ? "" : `takip tarihinden itibaren ${oran ? `yıllık %${String(oran).replace(".", ",")} oranında` : "değişen oranlarda"} ${turAdi(tur).replace(/\s*\(.*\)$/, "").replace(/ – .*$/, "").toLocaleLowerCase("tr")} işleyecek, `;
  return `${tl(h.toplam, pb)} tutarındaki toplam alacağın tahsilde tekerrür olmamak şartıyla, ${faiz}icra gideri ve vekâlet ücreti ile birlikte tahsili talebidir. (Fazlaya dair ve faiz oranlarındaki artıştan doğan talep hakkımız saklıdır)`
    + (b.tbk100 !== false ? " TBK. 100. mad. gereğince kısmi ödemeler öncelikle varsa işlemiş faiz, masraf ve ferilere mahsup edilecektir." : "");
}

/** UYAP'ta takip açmak için eksik kalan bilgiler. */
export function icraEksikler(f: Foy, b: IcraBilgi): string[] {
  const e: string[] = [];
  const m = f.muvekkilBilgi || {}, k = f.karsiBilgi || {};
  if (f.taraf === "davali") e.push("Föyde borçlu tarafın vekili görünüyorsunuz; takip talebi alacaklı vekili olarak hazırlanır.");
  if (!f.mahkeme) e.push("İcra dairesi");
  if (!f.muvekkil) e.push("Alacaklının adı / unvanı");
  if (!m.kimlikNo) e.push("Alacaklının T.C. kimlik ya da vergi no'su");
  if (!m.adres) e.push("Alacaklının adresi");
  if (!f.karsiTaraf) e.push("Borçlunun adı / unvanı");
  if (!k.kimlikNo) e.push("Borçlunun T.C. kimlik ya da vergi no'su");
  if (!k.adres) e.push("Borçlunun adresi");
  if (!b.asil) e.push("Asıl alacak tutarı");
  if (b.paraBirimi && b.paraBirimi !== "TL" && !b.kur) e.push("Takip tarihindeki döviz kuru");
  if ((b.faizTuru || "yasal") !== "yok" && !b.faizBaslangic && b.islemisFaizElle === undefined) e.push("Faiz başlangıç (temerrüt / vade) tarihi");
  if (b.yol === "ilamli" && (!b.ilam?.mahkeme || !b.ilam?.esasNo || !b.ilam?.kararNo || !b.ilam?.kararTarihi)) e.push("İlamın mahkemesi, esas ve karar no'su, karar tarihi");
  if (b.yol === "kambiyo" && (!b.senet?.tur || !b.senet?.vade)) e.push("Senedin türü ve vadesi");
  if (b.yol === "kira" && (!b.kira?.aylikKira || !b.kira?.aylar)) e.push("Aylık kira ve takibe konu aylar");
  if (b.yol === "genel" && !b.belge) e.push("Alacağın dayanağı (fatura, sözleşme, cari hesap…)");
  if ((b.yol === "genel" || b.yol === "ilamli") && !b.mahiyet) e.push("Takip mahiyeti (Örnek 7 ve 4-5'te zorunlu)");
  return e;
}

/** Takip talebi özeti: UYAP'taki giriş sırasıyla. */
export function takipTalebiMetni(f: Foy, b: IcraBilgi, bugun = new Date().toISOString().slice(0, 10), vekil?: string): string {
  const h = icraHesapla(b, bugun);
  const pb = b.paraBirimi || "TL";
  const yol = TAKIP_YOLLARI.find(x => x.k === b.yol);
  const m = f.muvekkilBilgi || {}, k = f.karsiBilgi || {};
  const kisi = (ad?: string, kimlik?: string, adres?: string) => [ad || "…", kimlik ? `(T.C./V.K.N. ${kimlik})` : "", adres ? `– ${adres}` : ""].filter(Boolean).join(" ");
  const borclular = [kisi(f.karsiTaraf, k.kimlikNo, k.adres), ...(b.ekBorclular || []).filter(x => x.ad).map(x => kisi(x.ad, x.kimlikNo, x.adres))];
  const dayanak = b.yol === "ilamli" ? `${b.ilam?.mahkeme || "…"} ${b.ilam?.esasNo || "…"} E., ${b.ilam?.kararNo || "…"} K. sayılı, ${tarihYaz(b.ilam?.kararTarihi)} tarihli ilam${b.ilam?.kesinlesme ? ` (kesinleşme ${tarihYaz(b.ilam.kesinlesme)})` : ""}`
    : b.yol === "kambiyo" ? `${b.senet?.tur === "cek" ? "Çek" : b.senet?.tur === "police" ? "Poliçe" : "Bono"}: düzenleme ${tarihYaz(b.senet?.duzenleme)}, vade ${tarihYaz(b.senet?.vade)}${b.senet?.seriNo ? `, seri/çek no ${b.senet.seriNo}` : ""}${b.senet?.banka ? `, ${b.senet.banka}` : ""}${b.senet?.kesideci ? `, keşideci ${b.senet.kesideci}` : ""}`
    : b.yol === "kira" ? `${tarihYaz(b.kira?.sozlesmeTarihi)} tarihli kira sözleşmesi; aylık kira ${b.kira?.aylikKira ? tl(b.kira.aylikKira, pb) : "…"}; takibe konu aylar: ${b.kira?.aylar || "…"}${b.kira?.adres ? `; kiralanan: ${b.kira.adres}` : ""}`
    : b.yol === "ipotek" || b.yol === "tasinir_rehni" ? (b.belge || "Rehin / ipotek belgesi: …")
    : (b.belge || "…");
  const sonraTur = b.takipSonrasiTur || b.faizTuru || "yasal";
  const sonraOran = b.takipSonrasiOran ?? (sonraTur === b.faizTuru ? b.oran : undefined);
  const sonra = sonraTur === "yok" ? "Takip sonrası faiz istenmiyor."
    : `Asıl alacağa (${tl(h.asil, pb)}) takip tarihinden itibaren tahsil tarihine kadar ${turAdi(sonraTur).toLocaleLowerCase("tr")}${sonraOran ? ` (yıllık %${sonraOran})` : sonraTur === "yasal" || sonraTur === "avans" ? " (değişen oranlarla)" : ""} işletilmesi.`;
  const talep = b.talep === "haciz_tahliye" ? "Alacağın tahsili için haciz ve kiralananın tahliyesi" : b.talep === "tahliye" ? "Kiralananın tahliyesi"
    : b.yol === "ipotek" || b.yol === "tasinir_rehni" ? "Rehnin paraya çevrilmesi" : "Alacağın tahsili için haciz";
  const sat: string[] = [];
  sat.push("TAKİP TALEBİ ÖZETİ (UYAP'a giriş sırasıyla)", "");
  const mah = MAHIYETLER.find(x => x.kod === b.mahiyet);
  sat.push(`1. Takip yolu: ${yol ? yol.ad + (yol.ornek ? ` (${yol.ornek})` : " (örnek no'yu UYAP'ta seçin)") : "…"}${mah ? ` · takip mahiyeti: ${mah.ad} (${mah.kod})` : ""}`);
  sat.push(`2. İcra dairesi: ${f.mahkeme || "…"}`);
  sat.push(`3. Alacaklı: ${kisi(f.muvekkil, m.kimlikNo, m.adres)}`);
  sat.push(`   Alacaklı vekili: ${vekil ? "Av. " + vekil.replace(/^av\.?\s*/i, "") : "…"}${m.vekaletname ? ` (vekâletname: ${m.vekaletname})` : ""}`);
  sat.push(`4. Borçlu${borclular.length > 1 ? "lar" : ""}:`);
  borclular.forEach((x, i) => sat.push(`   ${i + 1}) ${x}`));
  sat.push(`5. Alacağın dayanağı: ${dayanak}`);
  sat.push("6. Alacak kalemleri:");
  sat.push(`   - Asıl alacak: ${tl(h.asil, pb)}`);
  if ((b.faizTuru || "yasal") !== "yok") {
    if (b.islemisFaizElle !== undefined) sat.push(`   - İşlemiş faiz (${turAdi(b.faizTuru || "yasal")}): ${tl(h.faiz, pb)}`);
    else {
      sat.push(`   - İşlemiş faiz (${turAdi(b.faizTuru || "yasal")}, ${tarihYaz(b.faizBaslangic)} – ${tarihYaz(b.takipTarihi || bugun)}): ${tl(h.faiz, pb)}`);
      for (const d of h.faizDilimleri) sat.push(`       ${tarihYaz(d.bas)} – ${tarihYaz(d.son)}: ${d.gun} gün × %${d.oran} = ${tl(d.tutar, pb)}`);
    }
  }
  for (const x of h.ek) sat.push(`   - ${x.ad}: ${tl(x.tutar, pb)}`);
  for (const x of b.masraflar || []) if (x.tutar) sat.push(`   - ${x.ad || "Masraf"}: ${tl(x.tutar, pb)}`);
  sat.push(`   TOPLAM: ${tl(h.toplam, pb)}${pb !== "TL" ? ` (takip tarihindeki kur ${b.kur || "…"} ile ${tl(h.toplamTL)}; ödeme günündeki kurla tahsili istenir)` : ""}`);
  sat.push(`7. Takip sonrası faiz: ${sonra}`);
  sat.push(`8. Talep (48/9): ${talep}.`);
  sat.push(`9. Alacaklının talep ettiği hak: ${talepEdilenHak(b, bugun)}`);
  sat.push(`   TBK 100 mahsup: ${b.tbk100 !== false ? "evet" : "hayır"} · BSMV: ${b.bsmv ? "evet" : "hayır"} · KKDF: ${b.kkdf ? "evet" : "hayır"}`);
  if (b.not) sat.push(`Not: ${b.not}`);
  sat.push("");
  sat.push(`Bilgi: 2026–2027 AAÜT'ye göre icra vekâlet ücreti yaklaşık ${tl(h.vekalet.ucret)} (${h.vekalet.aciklama}); borçlu ödeme süresinde öderse ${tl(h.vekalet.ucDortte)}. Dosya hesabını icra dairesi yapar; takip talebinde ayrıca istenmesi gerekmez.`);
  return sat.join("\n");
}
