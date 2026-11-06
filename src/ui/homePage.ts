// Ön yüzde hangi sayfa açılır: "danisma" (Derdini anlat ve avukat araçları) ya da "oyun" (kariyer ve oyun).
// Kullanıcı parmağıyla kaydırıp hangi sayfada kalırsa uygulama bir dahaki açılışta o sayfayla açılır. Tercih cihazda saklanır.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export type HomePage = "danisma" | "oyun";
export const HOME_PAGES: HomePage[] = ["danisma", "oyun"];
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
        .then(v => { if (v === "danisma" || v === "oyun") { page = v; listeners.forEach(f => f(v)); } })
        .catch(() => {})
        .finally(() => { loaded = true; setReady(true); });
    }
    return () => { listeners.delete(setP); };
  }, []);
  return [p, setHomePage, ready];
}
