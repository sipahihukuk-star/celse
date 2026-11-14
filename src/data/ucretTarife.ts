// Avukatlık Asgari Ücret Tarifesi (AAÜT) ve dava açılışındaki yargılama giderleri (cihazda hesaplanır, tahmindir).
// Kaynaklar (Celse'nin bildiği son durum; her yıl Kasım'da yeni AAÜT, Ocak'ta yeni harç tutarları yayımlanır):
//  - 2026–2027 AAÜT: RG 03.11.2026, sayı 33419 (aynı gün yürürlükte). Maktu ücretler İkinci Kısım; nispi dilimler Üçüncü Kısım.
//  - 2025–2026 AAÜT: RG 04.11.2025 (yalnız başlıca maktu ücretler biliniyor: asliye, sulh, tüketici, ağır ceza, idare, icra).
//  - Harçlar: 98 Seri No.lu Harçlar Kanunu Genel Tebliği (RG 31.12.2025): başvurma harcı sulh 335,20 TL, asliye / iş / aile /
//    tüketici / ticaret 732,00 TL; maktu karar ve ilam harcı 732,00 TL; nispi karar ve ilam harcı binde 68,31 (peşini dörtte biri);
//    icra başvurma 732,00 TL, ilamsız takip peşin harcı binde 5; istinaf başvurma 2.002,00 TL, temyiz 3.608,50 TL.
//  - HMK Gider Avansı Tarifesi (RG 28.10.2025): taraf başına beş tebligat + 530 TL; PTT tebligat ücreti 300 TL (01.10.2026).
// Mahkeme, karşı tarafa yükletilecek vekâlet ücretini karar tarihinde yürürlükteki tarifeye göre belirler; burada dava açılış
// tarihindeki tarife ile bugünkü tarife birlikte gösterilir. Avukat ile müvekkil daha yüksek ücrette anlaşabilir; asgariden az olamaz.
import type { Foy } from "./foy";

export type MahkemeTur = "sulh_hukuk" | "asliye" | "tuketici" | "fikri" | "agir_ceza" | "cocuk_agir" | "cocuk" | "sulh_ceza" | "icra_mahkemesi" | "icra_ceza"
  | "idare" | "bam" | "danistay" | "yargitay_temyiz" | "aym" | "sorusturma" | "icra_takibi" | "tahliye_takibi" | "arabuluculuk" | "tuketici_hakem" | "ortakligin_giderilmesi" | "ihtiyati";
export const MAHKEME_AD: Record<MahkemeTur, string> = {
  sulh_hukuk: "Sulh hukuk mahkemesi", asliye: "Asliye mahkemesi (hukuk, ticaret, iş, aile, ceza)", tuketici: "Tüketici mahkemesi", fikri: "Fikri ve sınai haklar mahkemesi",
  agir_ceza: "Ağır ceza mahkemesi", cocuk_agir: "Çocuk ağır ceza mahkemesi", cocuk: "Çocuk mahkemesi", sulh_ceza: "Sulh ceza / infaz hâkimliği",
  icra_mahkemesi: "İcra mahkemesi (dava ve duruşmalı işler)", icra_ceza: "İcra ceza işleri", idare: "İdare / vergi mahkemesi (duruşmasız)", bam: "Bölge adliye / bölge idare (istinaf, bir duruşmalı)",
  danistay: "Danıştay ilk derece (duruşmasız)", yargitay_temyiz: "Yargıtay / Danıştay temyiz duruşması", aym: "Anayasa Mahkemesi bireysel başvuru (duruşmasız)",
  sorusturma: "Ceza soruşturma evresi", icra_takibi: "İcra dairesi takibi", tahliye_takibi: "Tahliyeye ilişkin icra takibi", arabuluculuk: "Arabuluculuk (anlaşamama)",
  tuketici_hakem: "Tüketici hakem heyeti", ortakligin_giderilmesi: "Ortaklığın giderilmesi davası", ihtiyati: "İhtiyati haciz / tedbir / delil tespiti (duruşmasız)"
};

interface Tarife { ad: string; bas: string; rg: string; maktu: Partial<Record<MahkemeTur, number>>; dilimler?: [number, number][] }
export const TARIFELER: Tarife[] = [
  { ad: "2026–2027 AAÜT", bas: "2026-11-03", rg: "RG 03.11.2026, sayı 33419",
    maktu: { sulh_hukuk: 40000, asliye: 62000, tuketici: 30000, fikri: 70000, agir_ceza: 86000, cocuk_agir: 86000, cocuk: 62000, sulh_ceza: 23000, icra_mahkemesi: 23000, icra_ceza: 20000,
      idare: 40000, bam: 28000, danistay: 50000, yargitay_temyiz: 50000, aym: 55000, sorusturma: 15000, icra_takibi: 12500, tahliye_takibi: 26000, arabuluculuk: 10000,
      tuketici_hakem: 9000, ortakligin_giderilmesi: 52000, ihtiyati: 13000 },
    dilimler: [[800000, 16], [800000, 15], [1600000, 14], [1600000, 13], [2400000, 11], [3200000, 8], [4000000, 5], [4800000, 3], [5600000, 2], [Infinity, 1]] },
  { ad: "2025–2026 AAÜT", bas: "2025-11-04", rg: "RG 04.11.2025",
    maktu: { sulh_hukuk: 30000, asliye: 45000, tuketici: 22500, agir_ceza: 65000, cocuk_agir: 65000, idare: 30000, icra_takibi: 9000, tahliye_takibi: 20000 } }
];

/** Föyün mahkemesinden (ya da türünden) tarifedeki yer. */
export function mahkemeTuru(f: Pick<Foy, "mahkeme" | "tur" | "davaTuru">): MahkemeTur {
  const m = (f.mahkeme || "").toLocaleLowerCase("tr");
  const konu = (f.davaTuru || "").toLocaleLowerCase("tr");
  if (f.tur === "icra") return /tahliye/.test(konu) ? "tahliye_takibi" : "icra_takibi";
  if (f.tur === "sorusturma") return "sorusturma";
  if (f.tur === "arabuluculuk") return "arabuluculuk";
  if (f.tur === "bireysel_basvuru") return "aym";
  if (/ortaklığın giderilmesi|izale/.test(konu)) return "ortakligin_giderilmesi";
  if (/bölge adliye|bölge idare/.test(m)) return "bam";
  if (/yargıtay/.test(m)) return "yargitay_temyiz";
  if (/danıştay/.test(m)) return "danistay";
  if (/anayasa/.test(m)) return "aym";
  if (/hakem heyeti/.test(m)) return "tuketici_hakem";
  if (/çocuk ağır ceza/.test(m)) return "cocuk_agir";
  if (/ağır ceza/.test(m)) return "agir_ceza";
  if (/çocuk mahkeme/.test(m)) return "cocuk";
  if (/sulh ceza|infaz/.test(m)) return "sulh_ceza";
  if (/icra ceza/.test(m)) return "icra_ceza";
  if (/icra (?:hukuk )?mahkeme|icra hukuk/.test(m)) return "icra_mahkemesi";
  if (/sulh hukuk/.test(m)) return "sulh_hukuk";
  if (/tüketici/.test(m)) return "tuketici";
  if (/fikri ve sınai|fikrî ve sınaî/.test(m)) return "fikri";
  if (/idare mahkeme|vergi mahkeme/.test(m) || f.tur === "idari_dava") return "idare";
  return "asliye";
}

const tarifeBul = (gun: string) => TARIFELER.find(x => gun >= x.bas);
function nispi(deger: number, dilimler: [number, number][]): number {
  let kalan = deger, u = 0;
  for (const [d, o] of dilimler) { const x = Math.min(kalan, d); u += x * o / 100; kalan -= x; if (kalan <= 0) break; }
  return Math.round(u * 100) / 100;
}

export interface AsgariUcret {
  mahkeme: MahkemeTur;
  /** bugünkü tarife */
  guncel: { tarife: string; rg: string; maktu?: number; nispi?: number; asgari?: number };
  /** dava açılış tarihindeki tarife (bugünkünden farklıysa) */
  acilis?: { tarife: string; tarih: string; maktu?: number; bilinmiyor?: boolean };
  notlar: string[];
}
/** Konusu para olan işlerde nispi ücret (Üçüncü Kısım), maktu ücretten az olamaz; konusu para olmayanda maktu. */
export function asgariUcret(f: Pick<Foy, "mahkeme" | "tur" | "davaTuru" | "acilis" | "olusturma">, davaDegeri?: number, bugun = new Date().toISOString().slice(0, 10)): AsgariUcret {
  const mt = mahkemeTuru(f);
  const g = tarifeBul(bugun) || TARIFELER[0];
  const maktu = g.maktu[mt];
  const n = davaDegeri && davaDegeri > 0 && g.dilimler && !["sorusturma", "agir_ceza", "cocuk_agir", "cocuk", "sulh_ceza", "icra_ceza", "aym", "bam", "yargitay_temyiz"].includes(mt) ? nispi(davaDegeri, g.dilimler) : undefined;
  const notlar: string[] = [];
  let asgari = maktu;
  if (n !== undefined) {
    asgari = Math.max(n, maktu || 0);
    notlar.push(n < (maktu || 0) ? "Nispi ücret maktu ücretin altında kaldığı için maktu ücret uygulanır." : "Konusu para olan iş: dava değerine göre nispi ücret.");
    if (mt === "icra_takibi" && davaDegeri! <= 78125) asgari = Math.min(maktu || 0, davaDegeri!);
    if (mt === "arabuluculuk" || mt === "tuketici_hakem") { asgari = Math.min(asgari, davaDegeri!); notlar.push("Ücret asıl alacağı geçemez."); }
  }
  const acilisGun = (f.acilis || f.olusturma || "").slice(0, 10);
  let acilis: AsgariUcret["acilis"];
  if (acilisGun && acilisGun < g.bas) {
    const a = tarifeBul(acilisGun);
    acilis = a ? { tarife: a.ad, tarih: acilisGun, maktu: a.maktu[mt], bilinmiyor: a.maktu[mt] === undefined } : { tarife: "", tarih: acilisGun, bilinmiyor: true };
  }
  notlar.push("Mahkeme karşı tarafa vekâlet ücretini karar tarihinde yürürlükteki tarifeye göre yükler. Müvekkille daha yüksek ücrette anlaşılabilir; asgari ücretin altında anlaşılamaz (Av.K. m.164).");
  return { mahkeme: mt, guncel: { tarife: g.ad, rg: g.rg, maktu, nispi: n, asgari }, acilis, notlar };
}

export interface GiderTahmini { kod: string; kategori: string; aciklama: string; tutar: number }
const BASVURMA = { sulh: 335.2, asliye: 732 }, MAKTU_KARAR = 732, NISPI_BINDE = 68.31, TEBLIGAT = 300, AVANS_SABIT = 530;
const ICRA_BASVURMA = 732, ICRA_PESIN_BINDE = 5, ISTINAF = 2002, TEMYIZ = 3608.5;

/** Davayı biz açıyorsak açılışta ödenecek başlangıç giderleri; davalıysak kanun yoluna giderken ödenecekler bilgi olarak. */
export function giderTahmini(f: Pick<Foy, "mahkeme" | "tur" | "davaTuru" | "taraf" | "ekMuvekkiller" | "ekKarsiTaraflar"> & { icra?: { ekBorclular?: unknown[] } }, davaDegeri?: number): { kalemler: GiderTahmini[]; notlar: string[] } {
  const mt = mahkemeTuru(f);
  const notlar: string[] = [];
  const kalemler: GiderTahmini[] = [];
  const tarafSayisi = 1 + (f.ekMuvekkiller?.length || 0) + 1 + (f.ekKarsiTaraflar?.length || 0);
  const r2 = (x: number) => Math.round(x * 100) / 100;
  if (f.tur === "ceza" || ["sorusturma", "agir_ceza", "cocuk_agir", "cocuk", "sulh_ceza", "icra_ceza"].includes(mt) || (mt === "asliye" && /ceza/i.test(f.mahkeme))) {
    notlar.push("Ceza yargılamasında harç alınmaz; tanık ve bilirkişi giderleri mahkemece karşılanır.");
    return { kalemler, notlar };
  }
  if (mt === "icra_takibi" || mt === "tahliye_takibi") {
    const borclu = 1 + (f.icra?.ekBorclular?.length || 0);
    kalemler.push({ kod: "icra-basvurma", kategori: "Başvuru / peşin harç", aciklama: "İcra başvurma harcı", tutar: ICRA_BASVURMA });
    if (davaDegeri) kalemler.push({ kod: "icra-pesin", kategori: "Başvuru / peşin harç", aciklama: "Peşin harç (binde 5)", tutar: r2(davaDegeri * ICRA_PESIN_BINDE / 1000) });
    kalemler.push({ kod: "icra-tebligat", kategori: "Tebligat / posta", aciklama: `Ödeme emri tebligatı (${borclu} borçlu)`, tutar: borclu * TEBLIGAT });
    notlar.push("Tahsil harcı (ödeme emri tebliğinden önce %2,27, sonra %4,55; hacizden sonra %9,10) tahsilat sırasında borçludan alınır.");
    return { kalemler, notlar };
  }
  if (f.taraf === "davali") {
    notlar.push("Davalı olarak açılışta harç ve gider avansı ödemezsiniz. Kanun yoluna giderseniz: istinaf başvurma harcı 2.002,00 TL, temyiz 3.608,50 TL ve karar harcı farkı.");
    kalemler.push({ kod: "istinaf", kategori: "İstinaf / temyiz harcı", aciklama: "İstinaf başvurma harcı (istinafa gidilirse)", tutar: ISTINAF });
    kalemler.push({ kod: "temyiz", kategori: "İstinaf / temyiz harcı", aciklama: "Temyiz başvurma harcı (temyize gidilirse)", tutar: TEMYIZ });
    return { kalemler, notlar };
  }
  const idare = mt === "idare" || mt === "danistay";
  kalemler.push({ kod: "basvurma", kategori: "Başvuru / peşin harç", aciklama: "Başvurma harcı", tutar: mt === "sulh_hukuk" ? BASVURMA.sulh : BASVURMA.asliye });
  if (davaDegeri && !idare) kalemler.push({ kod: "pesin", kategori: "Başvuru / peşin harç", aciklama: `Peşin nispi harç (dava değeri × binde 68,31 ÷ 4)`, tutar: r2(davaDegeri * NISPI_BINDE / 1000 / 4) });
  else kalemler.push({ kod: "pesin", kategori: "Başvuru / peşin harç", aciklama: "Maktu karar ve ilam harcı (peşin)", tutar: MAKTU_KARAR });
  kalemler.push({ kod: "avans", kategori: "Gider avansı", aciklama: `Gider avansı (${tarafSayisi} taraf × 5 tebligat × ${TEBLIGAT} TL + ${AVANS_SABIT} TL)`, tutar: tarafSayisi * 5 * TEBLIGAT + AVANS_SABIT });
  notlar.push("Bilirkişi, keşif (keşif harcı 5.188,00 TL) ve tanık giderleri mahkemenin ara kararıyla ayrıca istenir; ara karar gelince buraya eklenir.");
  if (davaDegeri && !idare) notlar.push(`Davanın sonunda karar harcı (binde 68,31: ${r2(davaDegeri * NISPI_BINDE / 1000).toLocaleString("tr-TR")} TL) hesaplanır; peşin ödenen düşülür.`);
  return { kalemler, notlar };
}

/** Dava dilekçesinden ya da harç makbuzundan dava değeri: "Dava Değeri : 100.000,00 TL", "harca esas değer 250.000 TL". */
export function davaDegeriBul(metinler: string[]): number | undefined {
  for (const m of metinler) {
    const x = m.match(/(?:DAVA\s+DEĞERİ|DAVA\s+DEGERI|HARCA\s+ESAS\s+DEĞER|Harca\s+esas\s+değer|Dava\s+değeri|DEĞERİ)\s*[:：]?\s*([\d.]{1,15}(?:,\d{1,2})?)\s*(?:TL|₺|Türk\s+Lirası)/i);
    if (x) { const n = Number(x[1].replace(/\./g, "").replace(",", ".")); if (n > 0 && n < 1e12) return n; }
  }
  return undefined;
}
