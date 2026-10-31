// Sahne görünümü: "gercek" (fotoğraf) ya da "cizim" (vektör çizim). Tercih cihazda saklanır.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export type ViewMode = "gercek" | "cizim";
const KEY = "celse-gorunum";
let mode: ViewMode = "gercek";
let loaded = false;
const listeners = new Set<(m: ViewMode) => void>();

export function setViewMode(m: ViewMode) {
  mode = m;
  try { AsyncStorage.setItem(KEY, m); } catch { /* yok say */ }
  listeners.forEach(f => f(m));
}

export function useViewMode(): [ViewMode, (m: ViewMode) => void] {
  const [m, setM] = useState(mode);
  useEffect(() => {
    listeners.add(setM);
    if (!loaded) {
      loaded = true;
      AsyncStorage.getItem(KEY).then(v => { if (v === "cizim" || v === "gercek") { mode = v; listeners.forEach(f => f(v)); } }).catch(() => {});
    }
    return () => { listeners.delete(setM); };
  }, []);
  return [m, setViewMode];
}
