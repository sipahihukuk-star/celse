// İsteğe bağlı hafif fon müziği (tools/muzik.py ile üretilmiş, kesintisiz döngü). Varsayılan kapalıdır.
// Açıkken satır seslendirilirken müzik kısılır.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { useEffect, useState } from "react";
import { onSpeakingChange } from "./voice";

const KEY = "celse-muzik";
const VOL = 0.22, DUCK = 0.07;
let on = false, loaded = false, player: AudioPlayer | null = null, speaking = false;
const listeners = new Set<(v: boolean) => void>();

function ensure() {
  if (player) return player;
  try {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: "mixWithOthers" }).catch(() => {});
    player = createAudioPlayer(require("../../assets/muzik/fon.mp3"));
    player.loop = true;
    player.volume = VOL;
  } catch { player = null; }
  return player;
}

function apply() {
  if (on) { const p = ensure(); if (p) { p.volume = speaking ? DUCK : VOL; try { p.play(); } catch { /* tarayıcı ilk dokunuşu bekliyor */ } } }
  else if (player) { try { player.pause(); } catch { /* yok say */ } }
}

onSpeakingChange(v => { speaking = v; if (player && on) player.volume = v ? DUCK : VOL; });

async function load() {
  if (loaded) return;
  loaded = true;
  try { on = (await AsyncStorage.getItem(KEY)) === "1"; } catch { /* yok say */ }
  listeners.forEach(f => f(on));
  if (on) apply();
}

export function setMusic(v: boolean) {
  on = v;
  try { AsyncStorage.setItem(KEY, v ? "1" : "0"); } catch { /* yok say */ }
  apply();
  listeners.forEach(f => f(v));
}

/** Tarayıcılar sesi ancak bir dokunuştan sonra başlatır; müzik açıksa ilk dokunuşta çalmaya başlar. */
export function resumeMusic() { if (on && player && !player.playing) apply(); else if (on && !player) apply(); }

export function useMusic(): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(on);
  useEffect(() => { listeners.add(setV); load(); return () => { listeners.delete(setV); }; }, []);
  return [v, setMusic];
}
