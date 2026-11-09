// Hukuk kütüphanesi: avukatın kaydettiği içtihat, mevzuat ve doktrin kaynakları (yapay zekânın bulduğu ya da elle eklenen).
// Bu cihazda saklanır; beyan editöründe beyana eklenir.
import type { HukukKaynak } from "./beyan";
import { ayarOku, ayarYaz } from "./foy";

const ANAHTAR = "hukukKutuphane";
export async function kutuphane(): Promise<HukukKaynak[]> { return (await ayarOku<HukukKaynak[]>(ANAHTAR)) || []; }
/** Aynı künye ya da bağlantı varsa yenisiyle değiştirilir; en yeniler başta. */
export async function kutuphaneyeEkle(k: HukukKaynak): Promise<HukukKaynak[]> {
  const xs = (await kutuphane()).filter(x => x.id !== k.id && !(x.url && x.url === k.url) && x.kunye !== k.kunye);
  const y = [k, ...xs].slice(0, 1000);
  await ayarYaz(ANAHTAR, y);
  return y;
}
export async function kutuphanedenSil(id: string): Promise<HukukKaynak[]> {
  const y = (await kutuphane()).filter(x => x.id !== id);
  await ayarYaz(ANAHTAR, y);
  return y;
}
