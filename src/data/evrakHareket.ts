// Evrak hareketleri: gelen (evrak klasöründen, toplu yüklemeden ya da elle föye eklenen) ve giden (indirilen beyan, başka föye
// taşınan evrak, birleştirilen föy) her evrakın nereye gittiği. Avukat "Gördüm" der (gizlenir) ya da kaldırır.
// Klasör taramaları da kaydedilir: yarıda kalan (elektrik / bağlantı kesildi) tarama görünür; o dosyalar bir sonraki taramada
// yeniden alınır, çünkü dosya ancak föye yazıldıktan sonra "işlendi" sayılır.
import { ayarOku, ayarYaz, dosyaSaklanir, yeniId } from "./foy";

export type HareketSonuc = "foy" | "ornek" | "bekliyor" | "okunamadi" | "atlandi" | "indirildi" | "tasindi" | "birlesti" | "tarama" | "tekrar";
export interface EvrakHareketi {
  id: string; zaman: string; yon: "gelen" | "giden"; ad: string; sonuc: HareketSonuc;
  /** nereden geldi: klasördeki yol, "Toplu yükleme", "Föye elle" */
  kaynak?: string;
  foyId?: string; foyAd?: string;
  not?: string;
  goruldu?: boolean;
  /** klasör dosyasının anahtarı (bekleyen evrak sonra föye girince aynı satır güncellenir) ya da taramanın kimliği */
  anahtar?: string;
  /** tarama satırı: bitti mi */
  bitti?: boolean;
}

const ANAHTAR = "evrakHareket";
const sinir = () => (dosyaSaklanir() ? 3000 : 300);
let bekleyen: EvrakHareketi[] = [];
let zincir: Promise<void> = Promise.resolve();
let zamanlayici: ReturnType<typeof setTimeout> | null = null;
let bekleyenSoz: (() => void)[] = [];
const dinleyiciler = new Set<() => void>();
export const hareketDinle = (f: () => void) => { dinleyiciler.add(f); return () => { dinleyiciler.delete(f); }; };

/** Bekleyenleri tek yazışta kaydeder (aynı anahtarlı satır güncellenir). */
function yaz(): Promise<void> {
  const xs = bekleyen; bekleyen = [];
  if (!xs.length) return zincir;
  zincir = zincir.then(async () => {
    let mevcut = (await ayarOku<EvrakHareketi[]>(ANAHTAR)) || [];
    for (const h of xs) {
      const i = h.anahtar ? mevcut.findIndex(m => m.anahtar === h.anahtar && m.sonuc !== "foy" && m.sonuc !== "ornek") : -1;
      if (i >= 0) mevcut[i] = { ...mevcut[i], ...h, id: mevcut[i].id, goruldu: false };
      else mevcut.unshift(h);
    }
    mevcut = mevcut.slice(0, sinir());
    await ayarYaz(ANAHTAR, mevcut);
    dinleyiciler.forEach(f => f());
  }).catch(() => {});
  return zincir;
}

export function hareketEkle(xs: Omit<EvrakHareketi, "id" | "zaman">[] | Omit<EvrakHareketi, "id" | "zaman">): Promise<void> {
  const z = new Date().toISOString();
  for (const x of Array.isArray(xs) ? xs : [xs]) bekleyen.push({ ...x, id: yeniId("hr"), zaman: z });
  if (zamanlayici) clearTimeout(zamanlayici);
  return new Promise(ok => {
    bekleyenSoz.push(ok);
    zamanlayici = setTimeout(() => { zamanlayici = null; const sz = bekleyenSoz; bekleyenSoz = []; yaz().then(() => sz.forEach(f => f())); }, 300);
  });
}

export async function hareketler(): Promise<EvrakHareketi[]> { await zincir; return (await ayarOku<EvrakHareketi[]>(ANAHTAR)) || []; }

async function degistir(f: (xs: EvrakHareketi[]) => EvrakHareketi[]) {
  zincir = zincir.then(async () => { await ayarYaz(ANAHTAR, f((await ayarOku<EvrakHareketi[]>(ANAHTAR)) || [])); dinleyiciler.forEach(g => g()); }).catch(() => {});
  return zincir;
}
export const hareketGoruldu = (ids: string[] | "hepsi") => degistir(xs => xs.map(x => (ids === "hepsi" || ids.includes(x.id) ? { ...x, goruldu: true } : x)));
export const hareketSil = (ids: string[] | "gorulenler") => degistir(xs => xs.filter(x => (ids === "gorulenler" ? !x.goruldu : !ids.includes(x.id))));

/** Yarıda kalmış tarama: bitmemiş ve 10 dakikadan eski. */
export const yarimTarama = (h: EvrakHareketi, simdi = Date.now()) => h.sonuc === "tarama" && !h.bitti && simdi - new Date(h.zaman).getTime() > 10 * 60000;

export const SONUC_AD: Record<HareketSonuc, string> = {
  tekrar: "zaten vardı, kaydedilmedi",
  foy: "föye girdi", ornek: "dilekçe örneklerine kaydedildi", bekliyor: "föyü bulunamadı, sizi bekliyor", okunamadi: "okunamadı",
  atlandi: "atlandı", indirildi: "indirildi", tasindi: "başka föye taşındı", birlesti: "föyler birleştirildi", tarama: "klasör taraması"
};
