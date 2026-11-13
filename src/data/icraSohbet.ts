// İcra takibi sohbeti (saf kısım; ağ çağrısı ui/icraSorCagri.ts): avukat ilamı (ya da yapıştırdığı evrakı) yapay zekâya okutup "müvekkilimin alacaklarını yaz", "davalının
// vekâlet ücretini çıkar" gibi talimat verir. Föy bu cihazda kodlanır, yalnız kodlu hâli gider:
//  • kişi, şirket, adres, numara: maskeleme motoru ([DAVACI], [ŞİRKET-1] …);
//  • tarihler: faiz başlangıcı için gün gerekir, bu yüzden her tarih [TARİH-n] koduna çevrilir (gerçeği cihazda kalır).
// Cevaptaki kodlar cihazda gerçek değerlere döner; önerilen değişiklik avukat "Uygula" demeden yazılmaz.
import { bizimVekiller, Foy, karsiVekiller, tumKarsiTaraflar, tumMuvekkiller } from "./foy";
import { FaizTuru, Kalem, kalemleri, TakipYolu, turAdi } from "./icra";
import { evrakTuruBul } from "./icraEvrak";
import { mask, unmask } from "../engine/mask";

/** Föyün bilinen adları her metinde mutlaka kodlansın (şirketlerde unvan eki olmadan geçen kısa ad da). */
const SIRKET_EKI = /\s+(A\.?\s?Ş\.?|ANONİM ŞİRKETİ|Anonim Şirketi|LTD\.?\s?ŞTİ\.?|Ltd\.?\s?Şti\.?|LİMİTED ŞİRKETİ|Limited Şirketi|ve Tic\.?.*|VE TİC\.?.*|San\.?\s?ve\s?Tic\.?.*)$/;
export const ekAdlar = (f: Foy) => {
  // Birden çok müvekkil / karşı taraf ve bütün vekiller de kodlanır.
  const xs = [...tumMuvekkiller(f), ...tumKarsiTaraflar(f), ...(f.icra?.ekBorclular || [])].map(x => x.ad).concat([...bizimVekiller(f), ...karsiVekiller(f)].map(v => v.replace(/^Av\.\s*/i, "").split(/[·,(]/)[0])).map(x => (x || "").trim()).filter(x => x.length > 2);
  for (const x of [...xs]) { const k = x.replace(SIRKET_EKI, "").trim(); if (k !== x && k.length > 4) xs.push(k); }
  return xs;
};

export interface IcraSohbetSatiri { soru: string; cevap: string; tarih: string }
export interface IcraDegisiklik {
  taraf?: "davaci" | "davali"; kalemler?: Kalem[]; yol?: TakipYolu;
  /** takip formunun kutuları (yapay zekânın önerisi; kişisel bilgiler cihazda kodundan açılmış olarak) */
  alanlar?: import("./icraTalimat").TalimatAlanlari;
}

export const SIZINTI = /(?<!\d[.,]?)[1-9]\d{10}(?![.,]?\d)|\bTR\s?\d{2}(?:\s?\d{4}){5}|[\w.+-]+@[\w-]+\.[\w.]+/i;
const TARIH_G = /\b(\d{1,2})[./-](\d{1,2})[./-]((?:19|20)\d{2})\b/g;
export const FAIZLER: FaizTuru[] = ["yasal", "avans", "ttk1530", "sozlesme", "mevduat", "yok"];
export const YOLLAR: TakipYolu[] = ["ilamli", "genel", "kambiyo", "kira"];
const tarihYaz = (x?: string) => (x ? x.split("-").reverse().join(".") : "");

/** Gönderilecek metni hazırlar: tarihler [TARİH-n], öteki kişisel veriler maskeleme motoruyla kodlanır. */
export function icraSoruKaynagi(f: Foy, soru: string, gecmis: IcraSohbetSatiri[], yapistirilan = "", sinir = 70000) {
  const b = f.icra;
  const kunye = [
    "=== KÜNYE ===",
    "Bizim taraf: " + (f.taraf === "davali" ? "DAVALI vekiliyiz" : "DAVACI vekiliyiz") + " (avukat değiştirebilir)",
    "Müvekkil: " + (f.muvekkil || "yazılmamış") + " · karşı taraf: " + (f.karsiTaraf || "yazılmamış"),
    "İcra dairesi: " + (f.mahkeme || "yazılmamış"),
    "=== ŞU ANKİ TAKİP BİLGİSİ ===",
    "Takip yolu: " + (b?.yol || "yazılmamış"),
    b?.ilam ? "İlam: " + [b.ilam.mahkeme, b.ilam.esasNo && "E. " + b.ilam.esasNo, b.ilam.kararNo && "K. " + b.ilam.kararNo, b.ilam.kararTarihi && "karar " + tarihYaz(b.ilam.kararTarihi)].filter(Boolean).join(", ") : "",
    "Alacak kalemleri:",
    ...(b && kalemleri(b).some(k => k.tutar) ? kalemleri(b).filter(k => k.tutar).map(k => `- ${k.ad}: ${k.tutar} TL; faiz: ${k.faizTuru || "yok"}${k.faizBaslangic ? " " + tarihYaz(k.faizBaslangic) + " tarihinden" : ""}`) : ["(henüz yok)"])
  ].filter(Boolean).join("\n");
  // Evrak: önce ilamlar, sonra öteki önemli evrak (dilekçeler); en yeni ilam en başta.
  const sirali = f.evraklar.filter(e => e.metin.trim()).sort((a, c) => (evrakTuruBul(c.metin) === "ilam" ? 1 : 0) - (evrakTuruBul(a.metin) === "ilam" ? 1 : 0) || c.eklenme.localeCompare(a.eklenme));
  const parca: string[] = [];
  let toplam = yapistirilan.length;
  for (const e of sirali) { const n = Math.min(e.metin.length, 30000); if (toplam + n > sinir) continue; parca.push("=== EVRAK · " + (evrakTuruBul(e.metin) === "ilam" ? "İLAM" : e.tur || "Diğer") + " ===\n" + e.metin.slice(0, 30000)); toplam += n; }
  if (yapistirilan.trim()) parca.unshift("=== AVUKATIN YAPIŞTIRDIĞI METİN ===\n" + yapistirilan.slice(0, 40000));
  const AYRAC = "\n␞␞\n";
  const ham = [kunye + "\n\n" + parca.join("\n\n"), soru, ...gecmis.slice(-4).flatMap(x => [x.soru, x.cevap])].join(AYRAC);
  // Tarihler önce kodlanır (maskeleme motoru günü atar; faiz başlangıcı için gün gerekir).
  const tarihler: Record<string, string> = {};
  const geri = new Map<string, string>();
  const tarihli = ham.replace(TARIH_G, (_m, g: string, a: string, y: string) => {
    const iso = `${y}-${a.padStart(2, "0")}-${g.padStart(2, "0")}`;
    let kod = geri.get(iso);
    if (!kod) { kod = `[TARİH-${geri.size + 1}]`; geri.set(iso, kod); tarihler[kod] = iso; }
    return kod;
  });
  const m = mask(tarihli, { extra: ekAdlar(f) });
  const k = m.masked.split(AYRAC.trim()).map(x => x.trim());
  const gk: { soru: string; cevap: string }[] = [];
  for (let i = 2; i + 1 < k.length; i += 2) gk.push({ soru: k[i], cevap: k[i + 1] });
  return { dosya: k[0], soru: k[1] || soru, gecmis: gk, map: m.map, tarihler };
}

/** Kodlu cevabı açar: [TARİH-n] → gg.aa.yyyy (metinde) ya da YYYY-AA-GG (alanlarda); öteki kodlar gerçek değerlere. */
export function ac(x: string, map: Record<string, string>, tarihler: Record<string, string>, iso = false): string {
  const t = x.replace(/\[TARİH-\d+\]/g, kod => (tarihler[kod] ? (iso ? tarihler[kod] : tarihYaz(tarihler[kod])) : kod));
  return unmask(t, map);
}

/** Önerilen değişikliğin avukata gösterilecek özeti. */
export function degisiklikOzeti(d: IcraDegisiklik): string[] {
  const out: string[] = [];
  const a = d.alanlar;
  if (a) {
    if (a.icraDairesi) out.push("İcra dairesi: " + a.icraDairesi);
    if (a.ilam) out.push("İlam: " + [a.ilam.mahkeme, a.ilam.esasNo && a.ilam.esasNo + " E.", a.ilam.kararNo && a.ilam.kararNo + " K.", a.ilam.kararTarihi && "karar " + tarihYaz(a.ilam.kararTarihi), a.ilam.kesinlesme && "kesinleşme " + tarihYaz(a.ilam.kesinlesme)].filter(Boolean).join(" · "));
    if (a.takipTarihi) out.push("Takip tarihi: " + tarihYaz(a.takipTarihi));
    if (a.mahiyet) out.push("Takip mahiyeti: " + a.mahiyet);
    if (a.paraBirimi) out.push("Para birimi: " + a.paraBirimi);
    for (const m of a.masraflar || []) out.push(`${m.ad}: ${m.tutar.toLocaleString("tr-TR")} TL`);
    if (a.not) out.push("Not: " + a.not);
    for (const k of a.kisiBilgi || []) out.push(`${k.rol === "borclu" ? "Borçlu" : "Alacaklı"} ${k.ad || ""}${k.kimlikNo ? " · kimlik no " + k.kimlikNo : ""}${k.adres ? " · adres " + k.adres : ""}`.replace(/\s+/g, " "));
  }
  if (d.taraf) out.push(d.taraf === "davali" ? "Biz: davalı vekiliyiz" : "Biz: davacı vekiliyiz");
  if (d.yol) out.push("Takip yolu: " + d.yol);
  if (d.kalemler) for (const k of d.kalemler) out.push(`${k.ad}: ${k.tutar.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL · ${turAdi(k.faizTuru) || "faizsiz"}${k.faizBaslangic ? " · " + tarihYaz(k.faizBaslangic) + " tarihinden" : ""}`);
  return out;
}
