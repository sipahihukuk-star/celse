// Seslendirme. İki katman:
// 1) Bulut sesleri (Google Cloud Text-to-Speech): Supabase'deki "seslendir" fonksiyonu her satırı bir kez seslendirir,
//    dosyayı depoda saklar; sonraki oynayışlarda hazır dosya çalınır. Her karaktere kendi sesi atanır.
// 2) Cihaz sesi (expo-speech): sunucu kurulmamışsa ya da ağ yoksa. Karakterlere cihazdaki Türkçe seslerden
//    biri ve ayrı bir ses tonu verilir.
// Her iki durumda da metindeki kısaltmalar okunmadan önce açılır ("TBK m.147" → "Türk Borçlar Kanunu madde 147").
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AudioPlayer, createAudioPlayer } from "expo-audio";
import * as Speech from "expo-speech";
import { useEffect, useState } from "react";
import { CLOUD_VOICES, serverReady, SUPABASE_ANON_KEY, SUPABASE_URL, TTS_FUNCTION } from "../config";
import { getAccessToken } from "../data/account";
import { expandForSpeech } from "../engine/speechText";
import { getLang } from "../i18n";

/** Seçili dile göre bulut sesi bölgesi; Türkçe kısaltma açımı yalnız Türkçede yapılır. */
const REGION: Record<string, string> = { tr: "tr-TR", en: "en-US", es: "es-ES", fr: "fr-FR", de: "de-DE" };
const spoken = (text: string) => (getLang() === "tr" ? expandForSpeech(text) : text);
export { expandForSpeech };

const KEY = "celse-seslendirme";
let enabled = false;
let loaded = false;
const listeners = new Set<(on: boolean) => void>();

/* ---------- Konuşmacılar ve sesler ---------- */

export interface Speaker { id: string; female: boolean; role: string }

const hash = (s: string) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

type DevVoice = { id: string; female?: boolean };
let devVoices: DevVoice[] = [];
const F_NAMES = /yelda|emel|filiz|seda|zeynep|elif|x-cfs|x-efs|x-ama|female|kadın/i;
const M_NAMES = /cem|ahmet|tolga|x-mfm|x-tmc|male|erkek/i;

async function load() {
  if (loaded) return;
  loaded = true;
  try { enabled = (await AsyncStorage.getItem(KEY)) === "1"; } catch { /* yok say */ }
  try {
    const all = await Speech.getAvailableVoicesAsync();
    const tr = all.filter(v => v.language?.toLowerCase().replace("_", "-").startsWith("tr"));
    // Daha kaliteli (Enhanced / doğal) sesler başa.
    tr.sort((a, b) => (b.quality === "Enhanced" ? 1 : 0) - (a.quality === "Enhanced" ? 1 : 0) || (/natural|online/i.test(b.name) ? 1 : 0) - (/natural|online/i.test(a.name) ? 1 : 0));
    devVoices = tr.map(v => ({ id: v.identifier, female: F_NAMES.test(v.name + v.identifier) ? true : M_NAMES.test(v.name + v.identifier) ? false : undefined }));
  } catch { /* ses listesi alınamazsa dil koduyla devam edilir */ }
  listeners.forEach(f => f(enabled));
}

/** Cihaz sesi: cinsiyete uygun ses varsa o, yoksa ton ile ayrışma. Aynı karakter hep aynı sesle konuşur. */
function deviceVoice(s: Speaker) {
  const h = hash(s.id);
  const narr = s.role === "narr";
  const match = devVoices.filter(v => v.female === s.female);
  const pool = narr ? devVoices.slice(0, 1) : match.length ? match : devVoices;
  const voice = pool.length ? pool[h % pool.length] : undefined;
  const genderOk = !voice || voice.female === undefined || voice.female === s.female;
  // Ton: hâkim tok ve yavaş; kişiye göre küçük farklar; ses cinsiyete uymuyorsa ton kaydırılır.
  let pitch = narr ? 1.0 : 0.94 + ((h >> 8) % 13) / 100;
  if (!genderOk || (voice?.female === undefined && !narr)) pitch += s.female ? 0.16 : -0.14;
  let rate = narr ? 1.0 : 0.96 + ((h >> 4) % 9) / 100;
  if (s.role === "judge") { pitch -= 0.05; rate -= 0.05; }
  return { voice: voice?.id, pitch, rate };
}

/** Bulut sesi: kadın ve erkek ses listesinden karaktere sabit bir ses; anlatıcının sesi ayrıdır. */
function cloudVoice(s: Speaker) {
  const list = s.female ? CLOUD_VOICES.f : CLOUD_VOICES.m;
  const v = s.role === "narr" ? CLOUD_VOICES.narr : list[hash(s.id) % list.length];
  return v.replace(/^tr-TR/, REGION[getLang()] || "tr-TR");
}

/* ---------- Çalma ---------- */

let speaking = false;
const speakListeners = new Set<(on: boolean) => void>();
const setSpeaking = (on: boolean) => { if (speaking !== on) { speaking = on; speakListeners.forEach(f => f(on)); } };
let player: AudioPlayer | null = null;
let token = 0;
let cloudDown = false;

const urlCache = new Map<string, Promise<string | null>>();

/** Bulut ses dosyasının adresi; aynı (ses, metin) için istek bir kez yapılır ve sonucu saklanır. */
function cloudUrl(text: string, voice: string): Promise<string | null> {
  if (!serverReady() || cloudDown) return Promise.resolve(null);
  const key = voice + "|" + text;
  const hit = urlCache.get(key);
  if (hit) return hit;
  const p = (async () => {
    try {
      const auth = (await getAccessToken()) || SUPABASE_ANON_KEY;
      const r = await fetch(`${SUPABASE_URL}/functions/v1/${TTS_FUNCTION}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${auth}` },
        body: JSON.stringify({ text, voice })
      });
      if (!r.ok) { if (r.status === 404 || r.status === 501) cloudDown = true; urlCache.delete(key); return null; }
      const j = await r.json();
      const url = typeof j.url === "string" ? j.url : null;
      // Dosyayı da önceden indir ki çalarken beklenmesin.
      if (url) { try { fetch(url).catch(() => {}); } catch { /* yok say */ } }
      return url;
    } catch { urlCache.delete(key); return null; }
  })();
  urlCache.set(key, p);
  return p;
}

/** Sıradaki satırları arka planda hazırlar (oyuncu okurken seslendirilir, geçince beklemeden çalar). */
export function prefetchLines(lines: { text: string; speaker: Speaker }[]) {
  if (!enabled) return;
  for (const l of lines) if (l.text) cloudUrl(spoken(l.text), cloudVoice(l.speaker));
}

function stopAll() {
  token++;
  Speech.stop();
  if (player) { try { player.pause(); player.remove(); } catch { /* yok say */ } player = null; }
  setSpeaking(false);
}

export async function speakLine(text: string, speaker: Speaker | string = "narr") {
  if (!enabled || !text) return;
  stopAll();
  const my = token;
  const s: Speaker = typeof speaker === "string" ? { id: speaker, role: speaker, female: false } : speaker;
  const say = spoken(text);
  setSpeaking(true);
  const url = await cloudUrl(say, cloudVoice(s));
  if (my !== token) return;
  if (url) {
    try {
      const p = createAudioPlayer({ uri: url });
      player = p;
      const sub = p.addListener("playbackStatusUpdate", st => {
        if (st.didJustFinish && my === token) { setSpeaking(false); sub.remove(); }
      });
      p.play();
      return;
    } catch { /* cihaz sesine geç */ }
  }
  const v = deviceVoice(s);
  Speech.speak(say, {
    language: REGION[getLang()] || "tr-TR", voice: getLang() === "tr" ? v.voice : undefined, pitch: v.pitch, rate: v.rate,
    onDone: () => { if (my === token) setSpeaking(false); },
    onStopped: () => { if (my === token) setSpeaking(false); },
    onError: () => { if (my === token) setSpeaking(false); }
  });
}

export function stopSpeaking() { stopAll(); }

export function setVoiceEnabled(on: boolean) {
  enabled = on;
  if (!on) stopAll();
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

export function onSpeakingChange(f: (on: boolean) => void) { speakListeners.add(f); return () => { speakListeners.delete(f); }; }

/** Şu an bir satır okunuyor mu? (Ağız hareketi bu sürece göre sürer.) */
export function useSpeaking() {
  const [on, setOn] = useState(speaking);
  useEffect(() => { speakListeners.add(setOn); return () => { speakListeners.delete(setOn); }; }, []);
  return on;
}
