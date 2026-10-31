// Cihazda saklanan son sonuçlar (dosya dolabındaki durum etiketleri).
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface SavedResult { text: string; tone: "win" | "lose" | "draw" }
const KEY = "celse-sonuclar-v2";

export async function loadResults(): Promise<Record<string, SavedResult>> {
  try { return JSON.parse((await AsyncStorage.getItem(KEY)) || "{}"); } catch { return {}; }
}

export async function saveResult(id: string, r: SavedResult) {
  try {
    const all = await loadResults();
    all[id] = r;
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* depolama kullanılamıyorsa sessizce geç */ }
}
