// Liderlik panosu: kariyer davalarından toplanan pano puanına göre sıralama (sunucu: supabase/surum6.sql).
// Panoda yalnızca katılmayı seçen oyuncular "Av. Ad S." biçiminde görünür; çıkınca satırı silinir.
import { CaseFile } from "../engine/types";
import { currentAccount, supabase } from "./account";
import { boardPoints, levelOf, Progress } from "./career";

export interface BoardRow { sira: number; ad: string; sehir: string | null; avatar: string | null; unvan: string | null; puan: number; kazanilan: number; dava: number; ben: boolean }
export type Period = "tum" | "ay";

/** "Yüksel Sipahi" → "Av. Yüksel S." (soyadın yalnız baş harfi görünür). */
export function displayName(adSoyad: string): string {
  const parts = adSoyad.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Av.";
  if (parts.length === 1) return `Av. ${parts[0]}`;
  const last = parts[parts.length - 1];
  return `Av. ${parts.slice(0, -1).join(" ")} ${last.charAt(0).toLocaleUpperCase("tr")}.`;
}

/** Oyuncunun yerel toplam pano puanı (sunucuya ulaşılamasa da gösterilebilir). */
export function myPoints(progress: Progress, all: CaseFile[]): number {
  const lvl = new Map(all.map(c => [c.id, levelOf(c)]));
  return Object.entries(progress).reduce((n, [id, r]) => n + (r.pts ?? (r.won ? boardPoints(true, r.best, lvl.get(id) || 1) : 0)), 0);
}

export async function onBoard(): Promise<boolean> {
  const acc = currentAccount(), sb = supabase();
  if (acc?.mode !== "server" || !sb) return false;
  const { data } = await sb.from("pano").select("kullanici_id").eq("kullanici_id", acc.id).maybeSingle();
  return !!data;
}

/** Panoya katılır ya da görünen bilgileri (unvan, şehir, yüz) günceller. */
export async function joinBoard(info: { sehir?: string; avatar?: string; unvan?: string }): Promise<{ error?: string }> {
  const acc = currentAccount(), sb = supabase();
  if (acc?.mode !== "server" || !sb) return { error: "Panoda yer almak için üye girişi gerekir." };
  // Büro ve karakter cihazda tutulur; büro açılmamış bir cihazdan girilince eski şehir ve yüz silinmesin diye yalnız bilinenler yazılır.
  const row: Record<string, string> = { kullanici_id: acc.id, gorunen_ad: displayName(acc.adSoyad), guncelleme: new Date().toISOString() };
  if (info.sehir) row.sehir = info.sehir;
  if (info.avatar) row.avatar = info.avatar;
  if (info.unvan) row.unvan = info.unvan;
  const { error } = await sb.from("pano").upsert(row);
  return error ? { error: "Panoya katılınamadı. Bağlantınızı kontrol edip yeniden deneyin." } : {};
}

export async function leaveBoard(): Promise<void> {
  const acc = currentAccount(), sb = supabase();
  if (acc?.mode !== "server" || !sb) return;
  await sb.from("pano").delete().eq("kullanici_id", acc.id);
}

/** Eski kayıtlarda pano puanı yoktur: kazanılmış davalar için puan hesaplanıp sunucuya yazılır (aylık sıralamaya girmez). */
export async function backfillPoints(progress: Progress, all: CaseFile[]): Promise<void> {
  const acc = currentAccount(), sb = supabase();
  if (acc?.mode !== "server" || !sb) return;
  const byId = new Map(all.map(c => [c.id, c]));
  const rows = Object.entries(progress)
    .filter(([id, r]) => !r.pts && r.won && byId.has(id))
    .map(([id, r]) => {
      const lvl = levelOf(byId.get(id)!);
      return { kullanici_id: acc.id, dava_id: id, oynama: r.played, kazandi: r.won, en_iyi: r.best, puan: boardPoints(true, r.best, lvl), seviye: lvl };
    });
  if (rows.length) await sb.from("kariyer").upsert(rows);
}

export async function fetchBoard(period: Period, city?: string): Promise<{ rows: BoardRow[]; error?: string }> {
  const sb = supabase();
  if (!sb) return { rows: [], error: "Liderlik panosu sunucu bağlantısı gerektirir." };
  const { data, error } = await sb.rpc("liderlik", { donem: period, sehir_f: city || null });
  if (error) return { rows: [], error: "Liderlik panosu şu an açılamadı." };
  return { rows: ((data || []) as BoardRow[]).map(r => ({ ...r, sira: Number(r.sira), puan: Number(r.puan), kazanilan: Number(r.kazanilan), dava: Number(r.dava) })) };
}
