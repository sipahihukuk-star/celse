// Üyelik. İki çalışma biçimi vardır:
// - Sunucu (Supabase ayarlıysa): gerçek hesap; ad soyad, telefon, e-posta ve şifre. Kariyer her cihazda devam eder.
// - Cihaz (Supabase henüz ayarlı değilse): aynı cihazda birden çok oyuncu profili; her birinin ayrı kariyeri olur.
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { serverReady, setServerReachable, SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";

export interface Account {
  id: string;
  adSoyad: string;
  telefon: string;
  eposta: string;
  mode: "server" | "local";
}

export interface SignUpInput { adSoyad: string; telefon: string; eposta: string; sifre?: string; kvkk: boolean; /** liderlik panosunda görünmeye açık rıza */ pano?: boolean }

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  if (!serverReady()) return null;
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: Platform.OS === "web" } });
  return client;
}

const LOCAL_LIST = "celse-oyuncular-v1";
const LOCAL_CURRENT = "celse-aktif-oyuncu";
let current: Account | null = null;
let ready = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(f => f());

export const currentAccount = () => current;

/* ---------- doğrulama ---------- */
export function normalizePhone(t: string): string {
  // Yabancı numara: + ile başlıyorsa uluslararası biçimde saklanır.
  if (t.trim().startsWith("+") && !t.trim().startsWith("+90")) return "+" + t.replace(/\D/g, "");
  const d = t.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("90")) return "0" + d.slice(2);
  if (d.length === 10 && d.startsWith("5")) return "0" + d;
  return d;
}
export function checkSignUp(v: SignUpInput, needPassword: boolean): string | null {
  if (v.adSoyad.trim().split(/\s+/).length < 2) return "Adınızı ve soyadınızı yazın.";
  const ph = normalizePhone(v.telefon);
  if (!/^05\d{9}$/.test(ph) && !/^\+\d{8,15}$/.test(ph)) return "Telefon numarasını 05xx xxx xx xx biçiminde (yurt dışı için +ülke kodu ile) yazın.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.eposta.trim())) return "Geçerli bir e-posta adresi yazın.";
  if (needPassword && (v.sifre || "").length < 8) return "Şifre en az 8 karakter olmalı.";
  if (!v.kvkk) return "Devam etmek için aydınlatma metnini okuduğunuzu onaylayın.";
  return null;
}

/* ---------- cihaz profilleri ---------- */
export async function localProfiles(): Promise<Account[]> {
  try { return JSON.parse((await AsyncStorage.getItem(LOCAL_LIST)) || "[]"); } catch { return []; }
}
async function saveLocal(list: Account[]) { try { await AsyncStorage.setItem(LOCAL_LIST, JSON.stringify(list)); } catch { /* yok say */ } }
const newId = () => "yerel-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ---------- oturum ---------- */
async function loadServerProfile(userId: string, email: string): Promise<Account> {
  const sb = supabase()!;
  const { data } = await sb.from("profiller").select("ad_soyad, telefon, eposta").eq("id", userId).maybeSingle();
  return { id: userId, adSoyad: data?.ad_soyad || "", telefon: data?.telefon || "", eposta: data?.eposta || email, mode: "server" };
}

/** Sunucu gerçekten erişilebilir mi? Erişilemiyorsa cihaz profilleriyle devam edilir. */
async function probe() {
  if (!serverReady()) return;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: SUPABASE_ANON_KEY }, signal: ctrl.signal });
    clearTimeout(t);
    if (r.status >= 500) setServerReachable(false);
  } catch { setServerReachable(false); }
}

export async function initAccount() {
  if (ready) return;
  await probe();
  const sb = supabase();
  if (sb) {
    const { data } = await sb.auth.getSession();
    const u = data.session?.user;
    current = u ? await loadServerProfile(u.id, u.email || "") : null;
    sb.auth.onAuthStateChange(async (ev, session) => {
      if (ev === "PASSWORD_RECOVERY") { recovering = true; }
      const nu = session?.user;
      current = nu ? await loadServerProfile(nu.id, nu.email || "") : null;
      emit();
    });
  } else {
    const id = await AsyncStorage.getItem(LOCAL_CURRENT).catch(() => null);
    current = (await localProfiles()).find(p => p.id === id) || null;
  }
  ready = true;
  emit();
}

export async function signUp(v: SignUpInput): Promise<{ error?: string; needsConfirm?: boolean }> {
  const sb = supabase();
  const err = checkSignUp(v, !!sb);
  if (err) return { error: err };
  const row = { adSoyad: v.adSoyad.trim(), telefon: normalizePhone(v.telefon), eposta: v.eposta.trim().toLowerCase() };
  if (sb) {
    const { data, error } = await sb.auth.signUp({
      email: row.eposta, password: v.sifre!,
      options: { data: { ad_soyad: row.adSoyad, telefon: row.telefon, kvkk_onay: new Date().toISOString(), ...(v.pano ? { pano_onay: new Date().toISOString() } : {}) } }
    });
    if (error) return { error: trError(error.message) };
    // E-posta doğrulaması açıksa oturum hemen açılmaz.
    if (!data.session) return { needsConfirm: true };
    return {};
  }
  const list = await localProfiles();
  if (list.some(p => p.eposta === row.eposta)) return { error: "Bu e-posta ile bu cihazda zaten bir oyuncu var. Listeden seçin." };
  const acc: Account = { id: newId(), ...row, mode: "local" };
  await saveLocal([...list, acc]);
  await switchLocal(acc.id);
  return {};
}

export async function signIn(eposta: string, sifre: string): Promise<{ error?: string }> {
  const sb = supabase();
  if (!sb) return { error: "Sunucu henüz ayarlı değil." };
  const { error } = await sb.auth.signInWithPassword({ email: eposta.trim().toLowerCase(), password: sifre });
  return error ? { error: trError(error.message) } : {};
}

export async function resetPassword(eposta: string): Promise<{ error?: string }> {
  const sb = supabase();
  if (!sb) return { error: "Sunucu henüz ayarlı değil." };
  // Bağlantı web sürümünü açar; orada yeni şifre penceresi çıkar (uygulama da web adresiyle aynı hesabı kullanır).
  const { error } = await sb.auth.resetPasswordForEmail(eposta.trim().toLowerCase(), { redirectTo: "https://celse.themiscode.com/" });
  return error ? { error: trError(error.message) } : {};
}

export async function switchLocal(id: string) {
  current = (await localProfiles()).find(p => p.id === id) || null;
  try { await AsyncStorage.setItem(LOCAL_CURRENT, id); } catch { /* yok say */ }
  emit();
}

export async function deleteLocal(id: string) {
  await saveLocal((await localProfiles()).filter(p => p.id !== id));
  for (const k of accountKeys(id)) { try { await AsyncStorage.removeItem(k); } catch { /* yok say */ } }
  if (current?.id === id) { current = null; try { await AsyncStorage.removeItem(LOCAL_CURRENT); } catch { /* yok say */ } }
  emit();
}

/** Oturumdaki üyeliği sunucudan kalıcı olarak siler (profil, kariyer, abonelik ve eşleşmeler birlikte gider) ve cihazdaki kayıtları temizler. */
export async function deleteServerAccount(): Promise<{ error?: string }> {
  const sb = supabase();
  const id = current?.id;
  if (!sb || !id) return { error: "Önce giriş yapın." };
  const { error } = await sb.rpc("hesabimi_sil");
  if (error) return { error: "Hesap silinemedi: " + error.message };
  for (const k of accountKeys(id)) { try { await AsyncStorage.removeItem(k); } catch { /* yok say */ } }
  try { await sb.auth.signOut(); } catch { /* oturum zaten düştü */ }
  current = null;
  emit();
  return {};
}

/** Hesaba bağlı cihaz kayıtları (kariyer, büro, dosya akışı, karakter, eşitleme bilgisi). */
const accountKeys = (id: string) => [`celse-kariyer-v1:${id}`, `celse-buro-v1:${id}`, `celse-dosya-v1:${id}`, `celse-karakter-v1:${id}`, `celse-esitleme-v1:${id}`];

/** Çıkıştan hemen önce çalışır (ör. bekleyen eşitlemeyi göndermek için); en fazla birkaç saniye beklenir, hata çıkışı engellemez. */
const beforeSignOut = new Set<() => Promise<void>>();
export function onBeforeSignOut(f: () => Promise<void>) { beforeSignOut.add(f); return () => { beforeSignOut.delete(f); }; }

export async function signOut() {
  if (beforeSignOut.size) {
    const all = Promise.all([...beforeSignOut].map(f => f().catch(() => {})));
    await Promise.race([all, new Promise(r => setTimeout(r, 2000))]);
  }
  const sb = supabase();
  if (sb) await sb.auth.signOut();
  else { try { await AsyncStorage.removeItem(LOCAL_CURRENT); } catch { /* yok say */ } }
  current = null;
  emit();
}

export async function getAccessToken(): Promise<string | undefined> {
  const sb = supabase();
  if (!sb) return undefined;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token;
}

/* ---------- Şifre yenileme ---------- */
// E-postadaki "şifre yenileme" bağlantısıyla gelen oyuncu geçici oturumla açılır; yeni şifresini belirleyene kadar pencere görünür.
// Bağlantı adresi "type=recovery" taşır; Supabase adresi temizlemeden önce bakılır.
let recovering = Platform.OS === "web" && typeof window !== "undefined" && /type=recovery/.test(window.location.hash + window.location.search);
export const isRecovering = () => recovering;
export function endRecovery() { recovering = false; emit(); }
export async function setNewPassword(sifre: string): Promise<{ error?: string }> {
  const sb = supabase();
  if (!sb) return { error: "Sunucu henüz ayarlı değil." };
  if (sifre.length < 6) return { error: "Şifre en az 6 karakter olmalı." };
  const { error } = await sb.auth.updateUser({ password: sifre });
  if (error) return { error: trError(error.message) };
  recovering = false; emit();
  return {};
}

export function useAccount(): { account: Account | null; ready: boolean } {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force(n => n + 1);
    listeners.add(f); initAccount();
    return () => { listeners.delete(f); };
  }, []);
  return { account: current, ready };
}

export function onAccountChange(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }

function trError(m: string): string {
  if (/already registered/i.test(m)) return "Bu e-posta ile zaten bir hesap var. Giriş yapın.";
  if (/Invalid login/i.test(m)) return "E-posta ya da şifre hatalı.";
  if (/Email not confirmed/i.test(m)) return "E-posta adresiniz henüz doğrulanmadı. Gelen kutunuzu kontrol edin.";
  if (/Password should be/i.test(m)) return "Şifre en az 8 karakter olmalı.";
  if (/rate limit/i.test(m)) return "Çok fazla deneme yapıldı. Biraz sonra tekrar deneyin.";
  return m;
}
