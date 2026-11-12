// Dilekçe örneklerinin cihazlar arası eşitlenmesi: bir bilgisayarda eklenen dilekçe örnekleri öteki bilgisayarda ve telefonda da
// görünür, beyan yazarken her yerde örnek alınır. Föy eşitlemesinin aynı tablosu ve aynı uçtan uca şifresiyle gider
// (foy_bulut, tur "metin", kayıt kimliği "ornek:<id>"); sunucu yalnız şifreli veriyi görür. Örnekler zaten kodlanmış
// (adlar, numaralar gizli) hâldedir.
import type { SupabaseClient } from "@supabase/supabase-js";
import { DilekceOrnegi, ornekler, ornekleriYaz, SILINEN } from "./dilekceOrnek";
import { ayarOku, ayarYaz } from "./foy";
import type { Anahtar } from "./sifre";

type Paketle = (k: Anahtar, x: unknown) => Promise<{ iv: string; veri: string }>;
type Ac = <T>(k: Anahtar, r: { iv: string; veri: string }) => Promise<T>;
interface Satir { kayit_id: string; iv: string; veri: string; guncelleme: string; silindi: boolean; degisim?: string }

const zaman = (x: DilekceOrnegi) => x.guncelleme || x.eklenme;

/** Örnekleri çeker ve gönderir; gelen ve giden sayısını döner. */
export async function ornekleriEsitle(sb: SupabaseClient, uid: string, k: Anahtar, paketle: Paketle, ac: Ac, tablo = "foy_bulut"): Promise<{ gelen: number; giden: number }> {
  let gelen = 0, giden = 0;
  const gonderilen = (await ayarOku<Record<string, string>>("ornekGonderilen")) || {};
  let cekim = (await ayarOku<string>("ornekCekim")) || "";
  let xs = await ornekler();
  const yerel = new Map(xs.map(x => [x.id, x] as const));
  const silinen = (await ayarOku<Record<string, string>>(SILINEN)) || {};
  let degisti = false;
  // 1) Çek.
  const onceki = cekim ? Date.parse(cekim) : NaN;
  let alt = cekim && !isNaN(onceki) ? new Date(onceki - 120000).toISOString() : "";
  for (;;) {
    let q = sb.from(tablo).select("kayit_id, iv, veri, guncelleme, silindi, degisim").eq("tur", "metin").like("kayit_id", "ornek:%").order("degisim", { ascending: true }).limit(100);
    if (alt) q = q.gt("degisim", alt);
    const r = await q;
    if (r.error) throw new Error(r.error.message);
    const satirlar = (r.data || []) as Satir[];
    for (const x of satirlar) {
      cekim = x.degisim || cekim;
      const id = x.kayit_id.slice(6);
      const y = yerel.get(id);
      if (x.silindi) { if (y && zaman(y) <= x.guncelleme) { yerel.delete(id); degisti = true; gelen++; } delete gonderilen[id]; continue; }
      if (silinen[id]) continue;
      if (y && zaman(y) >= x.guncelleme) continue;
      const o = await ac<DilekceOrnegi>(k, x);
      if (!o?.id || !o.metin) continue;
      yerel.set(id, { ...o, guncelleme: x.guncelleme });
      gonderilen[id] = x.guncelleme; degisti = true; gelen++;
    }
    if (satirlar.length < 100) break;
    alt = cekim;
  }
  if (degisti) { xs = [...yerel.values()].sort((a, b) => zaman(b).localeCompare(zaman(a))); await ornekleriYaz(xs); }
  await ayarYaz("ornekCekim", cekim);
  // 2) Gönder: değişenler ve silinenler.
  const bekleyen: (Satir & { tur: "metin" })[] = [];
  for (const x of xs) {
    const z = zaman(x);
    if (gonderilen[x.id] === z) continue;
    bekleyen.push({ kayit_id: "ornek:" + x.id, tur: "metin", ...(await paketle(k, x)), guncelleme: z, silindi: false });
    gonderilen[x.id] = z; giden++;
  }
  for (const [id, z] of Object.entries(silinen)) { bekleyen.push({ kayit_id: "ornek:" + id, tur: "metin", iv: "", veri: "", guncelleme: z, silindi: true }); delete gonderilen[id]; giden++; }
  for (let i = 0; i < bekleyen.length; i += 50) {
    const r = await sb.from(tablo).upsert(bekleyen.slice(i, i + 50).map(x => ({ kullanici_id: uid, ...x })), { onConflict: "kullanici_id,kayit_id" });
    if (r.error) throw new Error(r.error.message);
  }
  await ayarYaz("ornekGonderilen", gonderilen);
  if (Object.keys(silinen).length) await ayarYaz(SILINEN, {});
  return { gelen, giden };
}
