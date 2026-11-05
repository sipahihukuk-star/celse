// "Derdini anlat" · Uygulamadaki avukat oyuncular oynasın: danışmadan üretilen anonim, tek kişilik dava dosyaları (surum13.sql).
// Dosyayı sunucudaki danisma fonksiyonu üretir ("dosya" işlemi, danisma.ts dosyaHazirla). Oyuncular bekleyen dosyaları listeler,
// kaydının dosya sahibine gösterileceğini kabul ederek alır ve oyundaki duruşma ekranında oynar; bitince oyun kaydı (tutanak,
// seçimler, puan, sonuç) sunucuya yazılır ve dosya sahibinin gelen kutusuna mesaj düşer. Dosya sahibi kaydı "Duruşmayı izle"
// oynatıcısında izler (kayitSenaryo). Eğitim amaçlı canlandırmadır, hukuki görüş değildir; oyuncular gerçek avukat olmayabilir.
import type { CaseFile } from "../engine/types";
import { supabase } from "./account";
import { epostaBildir, refreshInbox } from "./inbox";
import { BekleyenDosya, DanismaDosyasi, OyunKaydi, oynanabilir } from "./danismaKayit";
export * from "./danismaKayit";

/** Dosya sahibinin dosyaları, danışma kimliğine göre. Tablo henüz kurulmadıysa (surum13.sql) boş döner. */
export async function dosyalarim(): Promise<Record<string, DanismaDosyasi>> {
  const sb = supabase();
  if (!sb) return {};
  const { data, error } = await sb.from("danisma_dosyalari").select("id, danisma_id, durum, oynayan, kayit, created_at, alindi_at, oynandi_at").limit(100);
  if (error || !data) return {};
  const out: Record<string, DanismaDosyasi> = {};
  for (const r of data as unknown as DanismaDosyasi[]) out[r.danisma_id] = r;
  return out;
}

const hata = (m?: string) => (/kabul gerekli/.test(m || "") ? "Devam etmek için uyarıyı kabul edin."
  : /alınamadı/.test(m || "") ? "Bu dosyayı başka bir oyuncu aldı ya da dosya artık yok."
  : /giriş gerekli/.test(m || "") ? "Önce giriş yapın."
  : "Sunucu şu an cevap veremedi. Biraz sonra yeniden deneyin.");

/** Giriş yapmış oyuncuya bekleyen dosyalar. */
export async function bekleyenDosyalar(): Promise<{ list: BekleyenDosya[]; error?: string }> {
  const sb = supabase();
  if (!sb) return { list: [], error: "Sunucuya şu an ulaşılamıyor." };
  const { data, error } = await sb.rpc("danisma_dosya_listesi");
  if (error) return { list: [], error: hata(error.message) };
  return { list: (data || []) as BekleyenDosya[] };
}

/** Oyuncu, kaydının dosya sahibine gösterileceği uyarısını kabul ederek dosyayı alır. */
export async function dosyaAl(id: string): Promise<{ c?: CaseFile; error?: string }> {
  const sb = supabase();
  if (!sb) return { error: "Sunucuya şu an ulaşılamıyor." };
  const { data, error } = await sb.rpc("danisma_dosya_al", { p_id: id, p_kabul: true });
  if (error) return { error: hata(error.message) };
  const c = oynanabilir(data);
  if (!c) { await dosyaBirak(id); return { error: "Bu dosya şu an açılamıyor." }; }
  return { c };
}

/** Oyuncu yarıda çıkarsa dosya yeniden başka oyunculara açılır. */
export async function dosyaBirak(id: string) {
  try { await supabase()?.rpc("danisma_dosya_birak", { p_id: id }); } catch { /* yok say */ }
}

/** Oyun kaydını yazar; dosya "oynandi" olur ve sahibinin gelen kutusuna mesaj düşer (e-posta kancası: inbox.ts epostaBildir). */
export async function dosyaBitir(id: string, kayit: OyunKaydi): Promise<{ error?: string }> {
  const sb = supabase();
  if (!sb) return { error: "Sunucuya şu an ulaşılamıyor." };
  const { data, error } = await sb.rpc("danisma_dosya_bitir", { p_id: id, p_kayit: kayit });
  if (error) return { error: hata(error.message) };
  epostaBildir(data as string | null);
  refreshInbox();
  return {};
}
