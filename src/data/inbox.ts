// Gelen kutusu ve hata bildirimleri (supabase/surum9.sql).
// - mesajlar: kullanici_id boşsa bütün oyunculara duyuru; doluysa yalnız o oyuncuya (ör. hata bildirimine yanıt).
// - Okundu bilgisi üyede sunucuda (mesaj_okundu), misafirde cihazda tutulur. Misafir yalnız duyuruları görür.
// - Yeni mesajlar uygulama öne geldiğinde ve birkaç dakikada bir yoklanır (anlık bildirim yok).
// - mesajGonder(): yönetim panelinin tek gönderme yolu (duyuru, kişiye mesaj, hata bildirimine yanıt).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { currentAccount, onAccountChange, supabase } from "./account";

export type MessageKind = "duyuru" | "yanit" | "sistem";
export interface Message { id: string; kullanici_id: string | null; baslik: string; metin: string; tur: MessageKind; ilgili_bildirim: number | null; created_at: string; read: boolean }

export type ReportCategory = "metin" | "hukuki" | "gorsel" | "teknik" | "diger";
export type ReportStatus = "yeni" | "inceleniyor" | "duzeltildi" | "reddedildi";
export interface MyReport { id: number; dava_id: string | null; kategori: ReportCategory; aciklama: string; durum: ReportStatus; yanit: string | null; created_at: string }

const POLL_MS = 3 * 60 * 1000;
const LOCAL_READ = "celse-okunan-duyurular";

let messages: Message[] = [];
let reports: MyReport[] = [];
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(f => f());

async function localRead(): Promise<Set<string>> {
  try { return new Set(JSON.parse((await AsyncStorage.getItem(LOCAL_READ)) || "[]")); } catch { return new Set(); }
}

/** Mesajları ve (üyede) kendi hata bildirimlerini sunucudan yeniden okur. Ağ yoksa eldeki liste kalır. */
export function refreshInbox(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    const sb = supabase(), acc = currentAccount();
    if (!sb) { messages = []; reports = []; loaded = true; return; }
    const member = acc?.mode === "server";
    try {
      const [m, r, mine] = await Promise.all([
        sb.from("mesajlar").select("id, kullanici_id, baslik, metin, tur, ilgili_bildirim, created_at").order("created_at", { ascending: false }).limit(100),
        member ? sb.from("mesaj_okundu").select("mesaj_id").eq("kullanici_id", acc!.id).limit(1000) : Promise.resolve({ data: null, error: null }),
        member ? sb.from("hata_bildirimleri").select("id, dava_id, kategori, aciklama, durum, yanit, created_at").eq("kullanici_id", acc!.id).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: null, error: null })
      ]);
      if (acc?.id !== currentAccount()?.id) return; // bu arada hesap değişti
      if (m.error) return; // 9. kurulum yapılmamış ya da ağ hatası: eski liste kalır
      const read = member ? new Set(((r.data || []) as { mesaj_id: string }[]).map(x => x.mesaj_id)) : await localRead();
      // Misafir yalnız duyuruları görür (sunucu da yalnız onları verir).
      messages = ((m.data || []) as Omit<Message, "read">[])
        .filter(x => member || !x.kullanici_id)
        .map(x => ({ ...x, read: read.has(x.id) }));
      reports = member && !mine.error ? ((mine.data || []) as MyReport[]) : [];
      loaded = true;
    } catch { /* ağ yok */ }
  })().finally(() => { loading = null; emit(); });
  return loading;
}

export async function markRead(ids: string[]) {
  const fresh = ids.filter(id => messages.some(m => m.id === id && !m.read));
  if (!fresh.length) return;
  messages = messages.map(m => (fresh.includes(m.id) ? { ...m, read: true } : m));
  emit();
  const sb = supabase(), acc = currentAccount();
  try {
    if (acc?.mode === "server" && sb) await sb.rpc("mesajlari_okundu", { p_ids: fresh });
    else {
      const s = await localRead(); fresh.forEach(id => s.add(id));
      await AsyncStorage.setItem(LOCAL_READ, JSON.stringify([...s].slice(-500)));
    }
  } catch { /* bir sonraki yoklamada yeniden okunmamış görünebilir */ }
}

let polling: ReturnType<typeof setInterval> | null = null;
let appSub: { remove: () => void } | null = null;
function startPolling() {
  if (polling) return;
  polling = setInterval(() => { refreshInbox(); }, POLL_MS);
  try { appSub = AppState.addEventListener("change", s => { if (s === "active") refreshInbox(); }); } catch { /* yok say */ }
}
function stopPolling() {
  if (polling) clearInterval(polling);
  polling = null; appSub?.remove(); appSub = null;
}
onAccountChange(() => { messages = []; reports = []; if (listeners.size) refreshInbox(); });

/** Gelen kutusu: mesajlar, okunmamış sayısı, kendi hata bildirimleri. Bir bileşen kullandıkça yoklama sürer. */
export function useInbox(): { messages: Message[]; reports: MyReport[]; unread: number; loaded: boolean; refresh: () => Promise<void> } {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force(n => n + 1);
    listeners.add(f); startPolling();
    if (!loaded) refreshInbox();
    return () => { listeners.delete(f); if (!listeners.size) stopPolling(); };
  }, []);
  return { messages, reports, unread: messages.filter(m => !m.read).length, loaded, refresh: refreshInbox };
}

export const useUnreadCount = () => useInbox().unread;

/* ---------- Hata bildirimi (oyuncu) ---------- */

export interface ReportInput { davaId?: string; adim?: number | null; kategori: ReportCategory; aciklama: string; baglam: Record<string, unknown> }

/** Hata bildirimi gönderir. Misafir de gönderebilir; üye ise yanıt gelen kutusuna düşer. */
export async function sendReport(r: ReportInput): Promise<{ error?: string }> {
  const sb = supabase();
  if (!sb) return { error: "Sunucuya ulaşılamıyor. İnternet bağlantınızı kontrol edip yeniden deneyin." };
  const acc = currentAccount();
  const row = {
    kullanici_id: acc?.mode === "server" ? acc.id : null,
    dava_id: r.davaId ? r.davaId.slice(0, 80) : null,
    adim: typeof r.adim === "number" ? r.adim : null,
    kategori: r.kategori,
    aciklama: r.aciklama.trim().slice(0, 4000),
    baglam: r.baglam
  };
  try {
    // returning yok: misafir kendi satırını okuyamaz.
    let { error } = await sb.from("hata_bildirimleri").insert(row);
    if (error && row.kullanici_id) ({ error } = await sb.from("hata_bildirimleri").insert({ ...row, kullanici_id: null }));
    if (error) return { error: /row-level security/i.test(error.message) ? "Kısa sürede çok fazla bildirim gönderildi. Biraz sonra yeniden deneyin." : "Bildirim gönderilemedi. Biraz sonra yeniden deneyin." };
    if (row.kullanici_id) refreshInbox();
    return {};
  } catch { return { error: "Sunucuya ulaşılamıyor. İnternet bağlantınızı kontrol edip yeniden deneyin." }; }
}

/* ---------- Gönderme (yönetici) ---------- */

export interface OutgoingMessage {
  /** alıcı üyenin kimliği; null = bütün oyunculara duyuru */
  kime: string | null;
  baslik: string;
  metin: string;
  tur?: MessageKind;
  /** hata bildirimine yanıtsa bildirimin numarası: bildirimin durumu ve yanıtı da aynı işlemde yazılır */
  ilgiliBildirim?: number;
  durum?: ReportStatus;
  /** bildirime yazılan yanıt (yönetici notu); boşsa metin kullanılır */
  yanit?: string;
}

/** Yönetim panelinden mesaj gönderen tek işlev. Dönüş: eklenen mesajın kimliği (misafir bildirimine yanıtta mesaj eklenmez). */
export async function mesajGonder(m: OutgoingMessage): Promise<{ id?: string | null; error?: string }> {
  const sb = supabase();
  if (!sb) return { error: "Sunucuya ulaşılamıyor." };
  let id: string | null = null;
  try {
    if (m.ilgiliBildirim != null) {
      const { data, error } = await sb.rpc("hata_yanitla", {
        p_id: m.ilgiliBildirim, p_durum: m.durum || null, p_yanit: (m.yanit ?? m.metin) || null,
        p_baslik: m.baslik || null, p_metin: m.metin || null
      });
      if (error) return { error: error.message };
      id = (data as string | null) || null;
    } else {
      const { data, error } = await sb.from("mesajlar")
        .insert({ kullanici_id: m.kime, baslik: m.baslik.trim().slice(0, 160), metin: m.metin.trim().slice(0, 8000), tur: m.tur || (m.kime ? "sistem" : "duyuru"), gonderen: currentAccount()?.id || null })
        .select("id").single();
      if (error) return { error: error.message };
      id = (data as { id: string }).id;
    }
  } catch (e) { return { error: (e as Error).message || "Gönderilemedi." }; }

  epostaBildir(id);
  return { id };
}

/** Gelen kutusuna düşen mesajın e-posta kopyası. Yönetim panelinden gönderilen mesajlar (mesajGonder) ve sunucudaki işlevlerin
 *  bıraktığı mesajlar (ör. surum13.sql danisma_dosya_bitir: "Danışma dosyanız oynandı") aynı kancadan geçer. */
export function epostaBildir(id: string | null | undefined) {
  if (!id) return;
  // TODO(e-posta): Türkiye'de barınan SMTP hizmeti (Resend) kurulunca e-posta burada gönderilecek. Plan:
  //   supabase()?.functions.invoke("eposta-gonder", { body: { mesaj_id: id } }).catch(() => {});
  // Edge function, mesajı servis anahtarıyla okuyup alıcının (duyuruda bütün üyelerin) e-postasına gönderir.
  // E-posta hatası mesajın gelen kutusuna düşmesini engellememeli; bu yüzden beklenmez ve hata yok sayılır.
}

/** Yalnız bildirimin durumunu değiştirir (oyuncuya mesaj gitmez). */
export async function setReportStatus(id: number, durum: ReportStatus): Promise<{ error?: string }> {
  const sb = supabase();
  if (!sb) return { error: "Sunucuya ulaşılamıyor." };
  try {
    const { error } = await sb.rpc("hata_yanitla", { p_id: id, p_durum: durum, p_yanit: null, p_baslik: null, p_metin: null });
    return error ? { error: error.message } : {};
  } catch (e) { return { error: (e as Error).message }; }
}
