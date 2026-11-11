// Bilgisayar ↔ telefon eşitlemesinin kendiliğinden çalışması. Dava takibi açık olduğu sürece (hangi sekme ya da föy açık
// olursa olsun):
//  • açılışta,
//  • sekmeye / uygulamaya geri dönülünce (telefonda tarayıcıyı yeniden açınca),
//  • ekran açıkken dakikada bir (öteki cihazdaki değişiklikler gelsin),
//  • bu cihazda bir föy değiştikten 4 saniye sonra (değişiklik öteki cihaza gitsin)
// eşitlenir. Eskiden yalnız Föylerim ana listesi açıkken eşitleniyordu; föy sayfasında ya da başka sekmede çalışırken
// öteki cihazın değişiklikleri gelmiyor, iki cihaz birbirinden farklı görünüyordu.
import { Platform } from "react-native";
import { foyDinle } from "./foy";
import { cihazAnahtari, esitle, oturum } from "./foyBulut";

const ARALIK = 60_000;
let sayac = 0;
let susturma = false;
let son = 0;
const dinleyen = new Set<(m: string) => void>();
/** Eşitleme sonucu (ör. "3 föy geldi") isteyen ekranlar için. */
export function otoEsitlemeDinle(f: (m: string) => void) { dinleyen.add(f); return () => { dinleyen.delete(f); }; }

async function acikMi(): Promise<boolean> {
  try { const uid = await oturum(); return !!uid && !!(await cihazAnahtari(uid)); } catch { return false; }
}

/** Şimdi eşitler (eşitleme bu cihazda açık değilse sessizce geçer). */
export async function otoEsitle(): Promise<void> {
  if (!(await acikMi())) return;
  susturma = true; son = Date.now();
  try {
    const r = await esitle();
    if (r.gelen || r.giden) dinleyen.forEach(f => f(`${r.gelen}|${r.giden}`));
    // Asıl dosyalar birkaç birkaç yüklenir: bekleyen varsa kısa süre sonra sürer.
    if (r.dosyaBekleyen) setTimeout(() => { otoEsitle(); }, 2500);
  } catch { /* ağ yok ya da oturum kapalı: sonraki turda yeniden denenir */ }
  finally { setTimeout(() => { susturma = false; }, 400); }
}

/** Kendiliğinden eşitlemeyi başlatır; dönen fonksiyon durdurur. Birden çok ekran çağırsa da bir kez çalışır. */
export function otoEsitlemeBaslat(): () => void {
  sayac++;
  if (sayac > 1) return () => { sayac--; };
  let zaman: ReturnType<typeof setTimeout> | null = null;
  const gorunur = () => Platform.OS !== "web" || globalThis.document?.visibilityState !== "hidden";
  otoEsitle();
  const kapatDinle = foyDinle(() => {
    if (susturma) return;
    if (zaman) clearTimeout(zaman);
    zaman = setTimeout(() => { otoEsitle(); }, 4000);
  });
  const periyot = setInterval(() => { if (gorunur() && Date.now() - son > ARALIK - 5000) otoEsitle(); }, ARALIK);
  const geriDon = () => { if (gorunur() && Date.now() - son > 10_000) otoEsitle(); };
  const doc = globalThis.document, win = globalThis.window as Window | undefined;
  if (Platform.OS === "web") { doc?.addEventListener?.("visibilitychange", geriDon); win?.addEventListener?.("focus", geriDon); win?.addEventListener?.("online", geriDon); }
  let appSub: { remove: () => void } | undefined;
  if (Platform.OS !== "web") {
    // Uygulama arka plandan öne gelince.
    import("react-native").then(({ AppState }) => { appSub = AppState.addEventListener("change", s => { if (s === "active") geriDon(); }); }).catch(() => {});
  }
  return () => {
    sayac--;
    if (sayac > 0) return;
    kapatDinle(); clearInterval(periyot); if (zaman) clearTimeout(zaman);
    if (Platform.OS === "web") { doc?.removeEventListener?.("visibilitychange", geriDon); win?.removeEventListener?.("focus", geriDon); win?.removeEventListener?.("online", geriDon); }
    appSub?.remove();
  };
}
