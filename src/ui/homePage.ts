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

// Görünen bölümler: kullanıcı kullanmadığı yüzleri kapatabilir (tercih cihazda); yönetici de yönetim panelinden kişi başına
// yüz kapatabilir (sunucuda: ozel_yetkiler.yuzler, surum16.sql). Görünen = kullanıcının açık bıraktıkları ∩ yöneticinin izin verdikleri.
// En az bir yüz açık kalır. Kapalı yüz ön sayfada ve sekmelerde görünmez.
const YKEY = "celse-yuzler";
let yerel: HomePage[] = [...HOME_PAGES];
/** yöneticinin izin verdiği yüzler; null = hepsi */
let izinli: HomePage[] | null = null;
let yLoaded = false;
const yListeners = new Set<(p: HomePage[]) => void>();
function gorunen(): HomePage[] {
  const xs = HOME_PAGES.filter(h => yerel.includes(h) && (!izinli || izinli.includes(h)));
  return xs.length ? xs : izinli && izinli.length ? [...izinli] : [...HOME_PAGES];
}
let yuzler: HomePage[] = gorunen();
function yay() {
  yuzler = gorunen();
  yListeners.forEach(f => f(yuzler));
  if (!yuzler.includes(page)) setHomePage(yuzler[0]);
}
/** Kullanıcının kendi tercihi (ayarlardaki "Kullandığım bölümler"). */
export function setGorunenYuzler(xs: HomePage[]) {
  const temiz = HOME_PAGES.filter(h => xs.includes(h));
  yerel = temiz.length ? temiz : [...HOME_PAGES];
  try { AsyncStorage.setItem(YKEY, JSON.stringify(yerel)); } catch { /* yok say */ }
  yay();
}
/** Sunucudaki izin (oturum açılınca ve yenilenince). null ya da boş = hepsi açık. */
export function setIzinliYuzler(xs: string[] | null) {
  const temiz = xs ? HOME_PAGES.filter(h => xs.includes(h)) : [];
  const yeni = temiz.length ? temiz : null;
  if (JSON.stringify(yeni) === JSON.stringify(izinli)) return;
  izinli = yeni;
  yay();
}
export const izinliYuzler = () => izinli;
export function useGorunenYuzler(): [HomePage[], (xs: HomePage[]) => void] {
  const [xs, setXs] = useState(yuzler);
  useEffect(() => {
    yListeners.add(setXs);
    setXs(yuzler);
    if (!yLoaded) {
      AsyncStorage.getItem(YKEY).then(v => {
        const a = v ? (JSON.parse(v) as HomePage[]) : null;
        if (Array.isArray(a)) { const t = HOME_PAGES.filter(h => a.includes(h)); if (t.length) { yerel = t; yay(); } }
      }).catch(() => {}).finally(() => { yLoaded = true; });
    }
    return () => { yListeners.delete(setXs); };
  }, []);
  return [xs, setGorunenYuzler];
}
export const yuzAdi = (h: HomePage) => (h === "takip" ? "Dava takibi" : h === "danisma" ? "Derdini anlat" : "Kariyer ve oyun");
