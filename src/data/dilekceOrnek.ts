// Dilekçe örneklerim: avukatın kendi yazdığı dilekçe, sözleşme ve başvurular. Beyan editörü yazarken aynı türden örnekleri
// yapay zekâya ÜSLUP VE YAPI örneği olarak verir (olguları, adları, numaraları yeni dosyaya taşınmaz).
// Gizlilik: örnek kaydedilirken cihazda kodlanır (adlar, kimlik ve dosya numaraları, adresler, IBAN, e-posta → [ÖRNEK KİŞİ-1] gibi);
// asıl metin hiç saklanmaz, yalnız kodlu hâli bu cihazda durur. Kodların karşılığı tutulmaz, yani geri açılamaz.
import { mask } from "../engine/mask";
import { BEYAN_KLASORLERI, BEYAN_TURLERI, beyanTuru } from "./beyan";
import { ayarOku, ayarYaz, dosyaSaklanir, yeniId } from "./foy";

export interface DilekceOrnegi { id: string; ad: string; klasor: string; tur?: string; konu?: string; metin: string; eklenme: string; kaynak?: string }

const ANAHTAR = "dilekceOrnekleri";
const TEK = 40000;
/** Telefonda ayarlar tek kayıtta durduğu için daha küçük sınır. */
const toplamSinir = () => (dosyaSaklanir() ? 40_000_000 : 1_200_000);
const KISILIK = /(?<!\d[.,]?)[1-9]\d{10}(?![.,]?\d)|\bTR\s?\d{2}(?:\s?\d{4}){5}|[\w.+-]+@[\w-]+\.[\w.]+/i;

const onek = (x: string) => x.replace(/\[([^[\]\n]{1,48}?)-(\d+)\]/g, "[ÖRNEK $1-$2]");
/** Metni kodlar; kodlar föy kodlarıyla karışmasın diye "ÖRNEK" önekini alır. Kişisel veri kalırsa boş döner. */
export function ornekAnonim(metin: string): string { return ornekKodla(metin, "").metin; }
/** Metni ve dosya adını birlikte kodlar (metinde geçen adlar dosya adında da gizlenir; klasör yolu saklanmaz). */
export function ornekKodla(metin: string, ad: string): { metin: string; ad: string } {
  const m = mask(metin.replace(/\r\n?/g, "\n").slice(0, TEK * 2));
  const x = onek(m.masked).replace(/\n{3,}/g, "\n\n").trim().slice(0, TEK);
  const adlar = m.entities.filter(e => e.kind !== "mahkeme" && e.value.length >= 3).flatMap(e => [e.value, ...e.value.split(/\s+/).filter(w => w.length >= 3 && /^[A-ZÇĞİÖŞÜ]/.test(w))]);
  const a = onek(mask(ad.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_]+/g, " "), { extra: adlar }).masked).trim().slice(0, 120);
  return { metin: KISILIK.test(x) ? "" : x, ad: KISILIK.test(a) ? "" : a };
}

const kucuk = (x: string) => x.toLocaleLowerCase("tr");
const BOS = new Set(["dilekçesi", "dilekçe", "talebi", "başvurusu", "başvuru", "karşı", "beyan", "genel", "olaylar", "sözleşmesi", "ihlal", "iddiaları"]);
const kokler = (x: string) => kucuk(x).split(/[^a-zçğıöşü]+/).filter(w => w.length >= 4 && !BOS.has(w)).map(w => w.slice(0, 6));

/** KONU satırı (varsa). */
export function ornekKonu(metin: string): string {
  const m = metin.match(/^\s*KONU\s*:\s*(.+)$/im);
  return m ? m[1].trim().slice(0, 300) : "";
}

/** Metinden belge türünü tahmin eder (KONU satırı ve ilk satırlar); emin değilse boş. */
export function ornekTurTahmin(metin: string, ad = ""): string {
  const bas = kucuk(ad + " " + ornekKonu(metin) + " " + metin.slice(0, 1500));
  let en = "", puan = 0;
  for (const tur of BEYAN_TURLERI) {
    const ks = kokler(tur);
    if (!ks.length) continue;
    const p = ks.filter(k => bas.includes(k)).length / ks.length;
    if (p > puan || (p === puan && p > 0 && tur.length > en.length)) { en = tur; puan = p; }
  }
  return puan >= 0.5 ? en : "";
}

export async function ornekler(): Promise<DilekceOrnegi[]> { return (await ayarOku<DilekceOrnegi[]>(ANAHTAR)) || []; }

/** Okunmuş metni kodlayıp örneklere ekler. Klasör boşsa türden, tür de yoksa "Dilekçeler". */
export async function ornekEkle(k: { ad: string; metin: string; klasor?: string; tur?: string; kaynak?: string }): Promise<DilekceOrnegi> {
  const { metin, ad } = ornekKodla(k.metin, k.ad);
  if (metin.length < 80) throw new Error("Örnekte yeterli yazı yok ya da kişisel veri tam gizlenemedi; kaydedilmedi.");
  const tur = k.tur || ornekTurTahmin(k.metin, k.ad) || undefined;
  const klasor = k.klasor && BEYAN_KLASORLERI.some(x => x.ad === k.klasor) ? k.klasor : tur ? beyanTuru(tur).klasor : "Dilekçeler";
  const o: DilekceOrnegi = { id: yeniId("do"), ad: ad || tur || klasor, klasor, tur, konu: ornekKonu(metin) || undefined, metin, eklenme: new Date().toISOString() };
  const xs = [o, ...(await ornekler()).filter(x => x.metin !== metin)];
  let boyut = 0;
  const kalan = xs.filter(x => (boyut += x.metin.length * 2) <= toplamSinir());
  if (!kalan.length) throw new Error("Örnek bu cihazın sınırını aşıyor.");
  await ayarYaz(ANAHTAR, kalan);
  return o;
}
export async function ornekGuncelle(id: string, ek: Partial<Pick<DilekceOrnegi, "klasor" | "tur" | "ad">>): Promise<DilekceOrnegi[]> {
  const xs = (await ornekler()).map(x => (x.id === id ? { ...x, ...ek } : x));
  await ayarYaz(ANAHTAR, xs); return xs;
}
export async function ornekSil(id: string): Promise<DilekceOrnegi[]> {
  const xs = (await ornekler()).filter(x => x.id !== id);
  await ayarYaz(ANAHTAR, xs); return xs;
}

/** Klasör yolunda "örnek" ya da "şablon" geçen dosyalar örnektir; ardından gelen klasör adı Celse klasörüyse o klasöre girer. */
export function yoldanOrnek(yol: string): { klasor?: string } | null {
  const ps = (yol || "").split(/[\\/]/).slice(0, -1);
  const i = ps.findIndex(p => /örnek|ornek|şablon|sablon/i.test(p));
  if (i < 0) return null;
  const alt = ps.slice(i + 1).map(kucuk);
  const k = BEYAN_KLASORLERI.find(x => alt.some(a => kucuk(x.ad).startsWith(a.slice(0, 6)) && a.length >= 4));
  return { klasor: k?.ad };
}

/**
 * Beyan için örnek seçer. secim: "otomatik" | "yok" | örnek id. Otomatikte aynı türden en yeni iki örnek;
 * yoksa aynı klasörden konusu en yakın bir örnek. Toplam en çok 24 bin karakter.
 */
export function ornekSec(xs: DilekceOrnegi[], tur: string, secim = "otomatik"): DilekceOrnegi[] {
  if (secim === "yok" || !xs.length) return [];
  if (secim !== "otomatik") return xs.filter(x => x.id === secim);
  const ayni = xs.filter(x => x.tur === tur).slice(0, 2);
  if (ayni.length) return ayni;
  const klasor = beyanTuru(tur).klasor, ks = kokler(tur);
  const aday = xs.filter(x => x.klasor === klasor)
    .map(x => ({ x, p: ks.filter(k => kucuk(x.ad + " " + (x.konu || "") + " " + (x.tur || "")).includes(k)).length }))
    .sort((a, b) => b.p - a.p);
  return aday.length && aday[0].p > 0 ? [aday[0].x] : [];
}
/** Seçilen örnekleri yapay zekâya gidecek tek metne çevirir. */
export function ornekMetni(xs: DilekceOrnegi[]): string {
  const pay = Math.floor(24000 / Math.max(1, xs.length));
  return xs.map((x, i) => `--- Örnek ${i + 1}: ${x.tur || x.klasor} ---\n${x.metin.slice(0, pay)}`).join("\n\n");
}
