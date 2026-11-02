// Oyun ayarları (yönetim panelinden): not kırma oranı ve kariyerde ilerledikçe artışı.
// Sunucudaki "ayarlar" tablosunda tutulur (herkes okur, yalnız yönetici yazar); sunucu yoksa cihazda saklanır.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { CaseFile } from "../engine/types";
import { supabase } from "./account";
import { levelOf } from "./career";

export interface GameSettings {
  /** hatalı hamlede düşen puanın çarpanı (1 = dosyadaki değer) */
  notKirma: number;
  /** her kariyer basamağında (yerel → heyetli → yüksek yargı → AYM → uluslararası) çarpana eklenen oran */
  notKirmaArtis: number;
  /** Mağaza bağlantıları (QR ve "indir" sayfası). Test döneminde TestFlight / Play test bağlantısı yazılabilir. */
  iosLink: string;
  androidLink: string;
}
export const WEB_URL = "https://sipahihukuk-star.github.io/celse/";
export const DOWNLOAD_URL = WEB_URL + "indir.html";
export const DEFAULT_SETTINGS: GameSettings = {
  notKirma: 1, notKirmaArtis: 0.15,
  iosLink: "https://apps.apple.com/app/id6829524134",
  androidLink: "https://play.google.com/store/apps/details?id=com.themiscode.celse"
};
const link = (v: unknown, d: string) => (typeof v === "string" && /^https:\/\/\S+$/.test(v.trim()) ? v.trim() : d);
const LOCAL = "celse-ayarlar-v1";

let current: GameSettings = { ...DEFAULT_SETTINGS };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(f => f());
const clean = (v: Partial<GameSettings> | null | undefined): GameSettings => ({
  notKirma: Math.max(0.25, Math.min(4, Number(v?.notKirma) || DEFAULT_SETTINGS.notKirma)),
  notKirmaArtis: Math.max(0, Math.min(1, v?.notKirmaArtis === undefined ? DEFAULT_SETTINGS.notKirmaArtis : Number(v.notKirmaArtis) || 0)),
  iosLink: link(v?.iosLink, DEFAULT_SETTINGS.iosLink),
  androidLink: link(v?.androidLink, DEFAULT_SETTINGS.androidLink)
});

export async function loadSettings(): Promise<GameSettings> {
  try { const v = await AsyncStorage.getItem(LOCAL); if (v) current = clean(JSON.parse(v)); } catch { /* yok say */ }
  const sb = supabase();
  if (sb) {
    try {
      const { data } = await sb.from("ayarlar").select("deger").eq("anahtar", "oyun").maybeSingle();
      if (data?.deger) { current = clean(data.deger); await AsyncStorage.setItem(LOCAL, JSON.stringify(current)); }
    } catch { /* tablo yoksa ya da ağ yoksa cihazdaki değer */ }
  }
  emit();
  return current;
}
loadSettings();

export const settings = () => current;

/** Yönetici kaydeder: önce sunucuya, olmazsa yalnız bu cihaza. Dönen değer nereye yazıldığını söyler. */
export async function saveSettings(v: GameSettings): Promise<"sunucu" | "cihaz"> {
  current = clean(v);
  try { await AsyncStorage.setItem(LOCAL, JSON.stringify(current)); } catch { /* yok say */ }
  emit();
  const sb = supabase();
  if (sb) {
    const { error } = await sb.from("ayarlar").upsert({ anahtar: "oyun", deger: current, guncelleme: new Date().toISOString() });
    if (!error) return "sunucu";
  }
  return "cihaz";
}

export function useSettings(): GameSettings {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force(n => n + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return current;
}

/** Davanın not kırma çarpanı: temel oran, mahkemenin kariyer basamağı yükseldikçe artar. */
export function penaltyFor(c: CaseFile, s: GameSettings = current) {
  return Math.round(s.notKirma * (1 + s.notKirmaArtis * (levelOf(c) - 1)) * 100) / 100;
}
