// Yönetim panelinde oluşturulan davaların saklandığı yer.
// Şimdilik cihazda (tarayıcıda / telefonda) saklanır. Supabase bağlandığında yalnızca bu dosyadaki
// ContentStore arayüzünü uygulayan yeni bir sınıf yazılır; panel ve oyun değişmez.
import AsyncStorage from "@react-native-async-storage/async-storage";
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

export const store: ContentStore = new LocalStore();

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
