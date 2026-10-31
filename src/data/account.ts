// Üyelik. İki çalışma biçimi vardır:
// - Sunucu (Supabase ayarlıysa): gerçek hesap; ad soyad, telefon, e-posta ve şifre. Kariyer her cihazda devam eder.
// - Cihaz (Supabase henüz ayarlı değilse): aynı cihazda birden çok oyuncu profili; her birinin ayrı kariyeri olur.
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { serverReady, SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";

export interface Account {
  id: string;
  adSoyad: string;
  telefon: string;
  eposta: string;
  mode: "server" | "local";
}

export interface SignUpInput { adSoyad: string; telefon: string; eposta: string; sifre?: string; kvkk: boolean }

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  if (!serverReady()) return null;
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
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
  const d = t.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("90")) return "0" + d.slice(2);
  if (d.length === 10 && d.startsWith("5")) return "0" + d;
  return d;
}
export function checkSignUp(v: SignUpInput, needPassword: boolean): string | null {
  if (v.adSoyad.trim().split(/\s+/).length < 2) return "Adınızı ve soyadınızı yazın.";
  if (!/^05\d{9}$/.test(normalizePhone(v.telefon))) return "Telefon numarasını 05xx xxx xx xx biçiminde yazın.";
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

export async function initAccount() {
  if (ready) return;
  const sb = supabase();
  if (sb) {
    const { data } = await sb.auth.getSession();
    const u = data.session?.user;
    current = u ? await loadServerProfile(u.id, u.email || "") : null;
    sb.auth.onAuthStateChange(async (_e, session) => {
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
      options: { data: { ad_soyad: row.adSoyad, telefon: row.telefon, kvkk_onay: new Date().toISOString() } }
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
  const { error } = await sb.auth.resetPasswordForEmail(eposta.trim().toLowerCase());
  return error ? { error: trError(error.message) } : {};
}

export async function switchLocal(id: string) {
  current = (await localProfiles()).find(p => p.id === id) || null;
  try { await AsyncStorage.setItem(LOCAL_CURRENT, id); } catch { /* yok say */ }
  emit();
}

export async function deleteLocal(id: string) {
  await saveLocal((await localProfiles()).filter(p => p.id !== id));
  try { await AsyncStorage.removeItem(`celse-kariyer-v1:${id}`); } catch { /* yok say */ }
  if (current?.id === id) { current = null; try { await AsyncStorage.removeItem(LOCAL_CURRENT); } catch { /* yok say */ } }
  emit();
}

export async function signOut() {
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
