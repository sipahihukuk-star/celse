// Seslendirme: satırları cihazın Türkçe sesiyle okur (telefonda sistem sesi, web'de tarayıcı sesi).
// Ücretsizdir ve internetsiz çalışır. Sonradan hazır ses dosyalarına (ör. ElevenLabs) geçmek için yalnızca speakLine değişir.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";
import { useEffect, useState } from "react";

const KEY = "celse-seslendirme";
let enabled = false;
let loaded = false;
const listeners = new Set<(on: boolean) => void>();
let trVoice: string | undefined;

async function load() {
  if (loaded) return;
  loaded = true;
  try { enabled = (await AsyncStorage.getItem(KEY)) === "1"; } catch { /* yok say */ }
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    trVoice = voices.find(v => v.language?.toLowerCase().startsWith("tr"))?.identifier;
  } catch { /* ses listesi alınamazsa dil koduyla devam edilir */ }
  listeners.forEach(f => f(enabled));
}

export function setVoiceEnabled(on: boolean) {
  enabled = on;
  if (!on) Speech.stop();
  try { AsyncStorage.setItem(KEY, on ? "1" : "0"); } catch { /* yok say */ }
  listeners.forEach(f => f(on));
}

export function useVoiceEnabled(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(enabled);
  useEffect(() => {
    listeners.add(setOn); load();
    return () => { listeners.delete(setOn); };
  }, []);
  return [on, setVoiceEnabled];
}

/** Konuşana göre ton: hâkim daha tok ve yavaş, anlatıcı nötr, müvekkil biraz daha hızlı. */
const TONE: Record<string, { pitch: number; rate: number }> = {
  judge: { pitch: 0.85, rate: 0.95 },
  narr: { pitch: 1.0, rate: 1.0 },
  client: { pitch: 1.1, rate: 1.05 },
  opp: { pitch: 0.95, rate: 1.0 },
  pros: { pitch: 0.9, rate: 0.98 },
  p1: { pitch: 1.0, rate: 1.0 },
  p2: { pitch: 1.05, rate: 1.0 }
};

export function speakLine(text: string, who = "narr") {
  if (!enabled || !text) return;
  Speech.stop();
  const t = TONE[who] || { pitch: 1.0, rate: 1.0 };
  Speech.speak(text, { language: "tr-TR", voice: trVoice, pitch: t.pitch, rate: t.rate });
}

export function stopSpeaking() { Speech.stop(); }
