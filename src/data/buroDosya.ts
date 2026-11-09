// Büronun asıl evrak dosyaları (PDF, UDF, fotoğraf): büro bulutunda, büro anahtarıyla şifreli (supabase/surum20.sql, "buro-evrak").
// Yükleme büro eşitlemesiyle birlikte, her seferinde birkaç dosya olarak yapılır; dosya bu cihazda yoksa açarken buluttan
// indirilir, çözülür ve cihazda saklanır. Şahsi föylerin dosyaları hiç yüklenmez (şahsi föyler büroya gitmez).
import { supabase } from "./account";
import { buroAnahtari } from "./buro";
import { ayarOku, ayarYaz, dosyaOku, dosyaYaz, Foy } from "./foy";
import { coz, sifrele } from "./sifre";

const KOVA = "buro-evrak";
/** Bir eşitlemede en çok bu kadar dosya yüklenir (eşitleme takılmasın); kalanlar sonraki eşitlemelerde gider. */
export const TUR_BASI = 15;
/** Bu boyuttan büyük dosya yüklenmez (kova sınırı 50 MB). */
export const AZAMI = 45 * 1024 * 1024;

export interface DosyaDurum { yuklenen: number; bekleyen: number; buyuk: number; kurulumYok?: boolean; hata?: string; tarih?: string }
export const buroDosyaDurumu = async () => (await ayarOku<DosyaDurum>("buroDosyaDurum")) || null;

const yol = (buroId: string, evrakId: string) => `${buroId}/${evrakId}`;
const tipOf = (ad: string) => (/\.pdf$/i.test(ad) ? "application/pdf" : /\.jpe?g$/i.test(ad) ? "image/jpeg" : /\.png$/i.test(ad) ? "image/png" : /\.tiff?$/i.test(ad) ? "image/tiff" : /\.txt$/i.test(ad) ? "text/plain" : "application/octet-stream");

/** Bu cihazda olup büro bulutunda olmayan asıl dosyaları şifreleyip yükler; föyden silinen evrakın dosyasını buluttan kaldırır. */
export async function buroDosyalariYukle(b: { buroId: string; k: CryptoKey | Uint8Array }, foyler: Iterable<Foy>, sinir = TUR_BASI): Promise<DosyaDurum> {
  const sb = supabase();
  const gonderilen = (await ayarOku<Record<string, number>>("buroDosyaGonderilen")) || {};
  const durum: DosyaDurum = { yuklenen: 0, bekleyen: 0, buyuk: 0, tarih: new Date().toISOString() };
  if (!sb) return durum;
  const silinecek: string[] = [];
  let bu = 0;
  try {
    for (const f of foyler) {
      if (f.ozel) continue;
      for (const id of f.silinen || []) if (gonderilen[id]) silinecek.push(id);
      for (const e of f.evraklar) {
        if (gonderilen[e.id]) { durum.yuklenen++; continue; }
        if (bu >= sinir) { durum.bekleyen++; continue; }
        const blob = await dosyaOku(e.id).catch(() => undefined);
        if (!blob) continue; // asıl dosyası bu cihazda olmayan evrak (başka cihazdan gelmiş): yükleyen o cihazdır
        if (blob.size > AZAMI) { durum.buyuk++; continue; }
        const x = await sifrele(b.k, new Uint8Array(await blob.arrayBuffer()));
        const paket = new Uint8Array(12 + x.veri.byteLength);
        paket.set(x.iv, 0); paket.set(new Uint8Array(x.veri), 12);
        const r = await sb.storage.from(KOVA).upload(yol(b.buroId, e.id), new Blob([paket as BlobPart], { type: "application/octet-stream" }), { upsert: true, contentType: "application/octet-stream" });
        if (r.error) {
          if (/bucket|not found|policy|row-level/i.test(r.error.message)) { durum.kurulumYok = true; break; }
          throw new Error(r.error.message);
        }
        gonderilen[e.id] = blob.size; bu++; durum.yuklenen++;
      }
      if (durum.kurulumYok) break;
    }
    if (silinecek.length && !durum.kurulumYok) {
      const r = await sb.storage.from(KOVA).remove(silinecek.map(id => yol(b.buroId, id)));
      if (!r.error) for (const id of silinecek) delete gonderilen[id];
    }
  } catch (e) { durum.hata = String((e as Error).message || e); }
  await ayarYaz("buroDosyaGonderilen", gonderilen);
  await ayarYaz("buroDosyaDurum", durum);
  return durum;
}

/** Asıl dosya: önce bu cihazdan; yoksa büro bulutundan indirilip çözülür ve bu cihazda saklanır. */
export async function asilDosya(evrakId: string, ad = ""): Promise<Blob | undefined> {
  const yerel = await dosyaOku(evrakId).catch(() => undefined);
  if (yerel) return yerel;
  const b = await buroAnahtari();
  const sb = supabase();
  if (!b || !sb) return undefined;
  const r = await sb.storage.from(KOVA).download(yol(b.buroId, evrakId));
  if (r.error || !r.data) return undefined;
  const p = new Uint8Array(await r.data.arrayBuffer());
  if (p.length < 13) return undefined;
  const acik = await coz(b.k, { iv: p.slice(0, 12), veri: p.slice(12).buffer });
  const blob = new Blob([acik], { type: tipOf(ad) });
  await dosyaYaz(evrakId, blob).catch(() => {});
  const g = (await ayarOku<Record<string, number>>("buroDosyaGonderilen")) || {};
  if (!g[evrakId]) { g[evrakId] = blob.size; await ayarYaz("buroDosyaGonderilen", g); }
  return blob;
}
