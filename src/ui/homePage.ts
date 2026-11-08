// Ön yüzde hangi sayfa açılır: "takip" (dava takibi, föyler), "danisma" (Derdini anlat ve avukat araçları) ya da "oyun" (kariyer ve oyun).
// Kullanıcı parmağıyla kaydırıp hangi sayfada kalırsa uygulama bir dahaki açılışta o sayfayla açılır. Tercih cihazda saklanır.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export type HomePage = "takip" | "danisma" | "oyun";
export const HOME_PAGES: HomePage[] = ["takip", "danisma", "oyun"];
const KEY = "celse-onyuz";
let page: HomePage = "danisma";
let loaded = false;
const listeners = new Set<(p: HomePage) => void>();

export function setHomePage(p: HomePage) {
  if (p === page) return;
  page = p;
  try { AsyncStorage.setItem(KEY, p); } catch { /* yok say */ }
  listeners.forEach(f => f(p));
}

/** ready: kayıtlı tercih okundu mu (okunmadan ilk kaydırma yapılmaz). */
export function useHomePage(): [HomePage, (p: HomePage) => void, boolean] {
  const [p, setP] = useState(page);
  const [ready, setReady] = useState(loaded);
  useEffect(() => {
    listeners.add(setP);
    if (!loaded) {
      AsyncStorage.getItem(KEY)
        .then(v => { if (v === "takip" || v === "danisma" || v === "oyun") { page = v; listeners.forEach(f => f(v)); } })
        .catch(() => {})
        .finally(() => { loaded = true; setReady(true); });
    }
    return () => { listeners.delete(setP); };
  }, []);
  return [p, setHomePage, ready];
}

// Görünen bölümler: kullanıcı (ya da yönetici) kullanmadığı yüzleri kapatabilir; kapalı yüz ön sayfada ve sekmelerde görünmez.
// En az bir yüz açık kalır. Tercih cihazda saklanır.
const YKEY = "celse-yuzler";
let yuzler: HomePage[] = [...HOME_PAGES];
let yLoaded = false;
const yListeners = new Set<(p: HomePage[]) => void>();
export function setGorunenYuzler(xs: HomePage[]) {
  const temiz = HOME_PAGES.filter(h => xs.includes(h));
  yuzler = temiz.length ? temiz : [...HOME_PAGES];
  try { AsyncStorage.setItem(YKEY, JSON.stringify(yuzler)); } catch { /* yok say */ }
  yListeners.forEach(f => f(yuzler));
  if (!yuzler.includes(page)) setHomePage(yuzler[0]);
}
export function useGorunenYuzler(): [HomePage[], (xs: HomePage[]) => void] {
  const [xs, setXs] = useState(yuzler);
  useEffect(() => {
    yListeners.add(setXs);
    if (!yLoaded) {
      AsyncStorage.getItem(YKEY).then(v => {
        const a = v ? (JSON.parse(v) as HomePage[]) : null;
        if (Array.isArray(a)) { const t = HOME_PAGES.filter(h => a.includes(h)); if (t.length) { yuzler = t; yListeners.forEach(f => f(t)); if (!t.includes(page)) setHomePage(t[0]); } }
      }).catch(() => {}).finally(() => { yLoaded = true; });
    }
    return () => { yListeners.delete(setXs); };
  }, []);
  return [xs, setGorunenYuzler];
}
export const yuzAdi = (h: HomePage) => (h === "takip" ? "Dava takibi" : h === "danisma" ? "Derdini anlat" : "Kariyer ve oyun");
