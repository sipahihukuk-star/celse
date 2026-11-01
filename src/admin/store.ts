// Yönetim panelinde düzeltilen ya da üretilen davaların saklandığı yer.
// Sunucu (Supabase "dosyalar" tablosu) erişilebilirse oradan okunur: yayındaki dosyaları bütün oyuncular görür,
// yalnızca yöneticiler yazabilir. Sunucu yoksa ya da giriş yapan kişi yönetici değilse cihazda saklanır.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../data/account";
import { normalizeCase } from "../engine/engine";
import { CaseFile } from "../engine/types";

export type Status = "taslak" | "yayinda";

export interface StoredCase {
  case: CaseFile;
  status: Status;
  updatedAt: string;
}

export interface ContentStore {
  list(): Promise<StoredCase[]>;
  save(c: CaseFile, status: Status): Promise<void>;
  remove(id: string): Promise<void>;
}

const KEY = "celse-yonetim-davalar-v1";

class LocalStore implements ContentStore {
  private async read(): Promise<Record<string, StoredCase>> {
    try { return JSON.parse((await AsyncStorage.getItem(KEY)) || "{}"); } catch { return {}; }
  }
  private async write(all: Record<string, StoredCase>) {
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
  }
  async list() {
    const all = await this.read();
    return Object.values(all).map(s => ({ ...s, case: normalizeCase(s.case) }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async save(c: CaseFile, status: Status) {
    const all = await this.read();
    all[c.id] = { case: c, status, updatedAt: new Date().toISOString() };
    await this.write(all);
    notify();
  }
  async remove(id: string) {
    const all = await this.read();
    delete all[id];
    await this.write(all);
    notify();
  }
}

const local = new LocalStore();

/** Giriş yapan kişi sunucuda yönetici mi? (yonetici_mi() işlevi; sonuç oturum boyunca saklanır) */
let adminCache: Promise<boolean> | null = null;
export function serverAdmin(): Promise<boolean> {
  const sb = supabase();
  if (!sb) return Promise.resolve(false);
  if (!adminCache) adminCache = (async () => {
    try { const { data, error } = await sb.rpc("yonetici_mi"); return !error && data === true; } catch { return false; }
  })();
  return adminCache;
}
export function resetAdminCache() { adminCache = null; }

class ServerStore implements ContentStore {
  async list() {
    const sb = supabase();
    if (!sb) return local.list();
    try {
      const { data, error } = await sb.from("dosyalar").select("id, veri, durum, guncelleme");
      if (error) throw error;
      const remote: StoredCase[] = (data || []).map((r: any) => ({ case: normalizeCase(r.veri), status: r.durum as Status, updatedAt: r.guncelleme }));
      // Yönetici değilse cihazdaki eski taslaklar da panelde görünsün.
      const mine = (await serverAdmin()) ? [] : (await local.list()).filter(l => !remote.some(r => r.case.id === l.case.id));
      return [...remote, ...mine].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } catch { return local.list(); }
  }
  async save(c: CaseFile, status: Status, kaynak = "panel") {
    const sb = supabase();
    if (sb && (await serverAdmin())) {
      const { data: u } = await sb.auth.getUser();
      const { error } = await sb.from("dosyalar").upsert({ id: c.id, veri: c, durum: status, kaynak, guncelleme: new Date().toISOString(), guncelleyen: u.user?.id ?? null });
      if (error) throw new Error(error.message);
      notify();
      return;
    }
    await local.save(c, status);
  }
  async remove(id: string) {
    const sb = supabase();
    if (sb && (await serverAdmin())) {
      const { error } = await sb.from("dosyalar").delete().eq("id", id);
      if (error) throw new Error(error.message);
      notify();
      return;
    }
    await local.remove(id);
  }
}

export const store: ContentStore & { save(c: CaseFile, status: Status, kaynak?: string): Promise<void> } = new ServerStore();

// Değişiklikten haberdar olmak isteyen ekranlar (oyun listesi, panel) için basit yayın.
const listeners = new Set<() => void>();
export function subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
function notify() { listeners.forEach(fn => fn()); }

/* ---------- Yönetim paneli girişi (cihazda saklanan PIN) ---------- */
const PIN_KEY = "celse-yonetim-pin";
export async function getPin(): Promise<string | null> {
  try { return await AsyncStorage.getItem(PIN_KEY); } catch { return null; }
}
export async function setPin(pin: string) {
  await AsyncStorage.setItem(PIN_KEY, pin);
}
