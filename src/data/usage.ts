// Kullanım istatistikleri: hafif olay kaydı (supabase/surum9.sql "kullanim" tablosu).
// - Gönder ve unut: olaylar kuyruğa girer, birkaç saniyede bir toplu yazılır; oyunu hiçbir zaman bekletmez ya da düşürmez.
// - Çevrim dışıyken ya da sunucu yazmayı reddederse olaylar sessizce atılır (yeniden denenmez, cihazda birikmez).
// - Takma adlı: üye kimliği (giriş yapılmışsa) ve cihazda bir kez üretilen rastgele bir kimlik. Ad, e-posta, telefon gönderilmez.
// Okuma yalnız yöneticiye açıktır; yönetim panelindeki "İstatistikler" bölümü özet işlevlerle okur.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";
import app from "../../app.json";
import { GameState, verdict } from "../engine/engine";
import { AiVerdict } from "../engine/judge";
import { CaseFile, Player, Side } from "../engine/types";
import { currentAccount, supabase } from "./account";
import { levelOf } from "./career";
import { careerSide } from "./office";
import { FREE_LEVEL } from "./subscription";

export type UsageEvent = "dava_basladi" | "dava_bitti" | "dava_birakti" | "danisma" | "paywall_goruldu" | "satin_alma";
/** kariyer: kariyerden ya da büro masasından; solo: tek kişilik antrenman listesi; duel: karşılıklı (aynı cihaz, bilgisayar ya da internet);
 *  tahkim: tahkim ve komisyonlar listesi; antrenman: ayrılmış (ileride başka antrenman biçimleri için). */
export type UsageMode = "solo" | "duel" | "tahkim" | "antrenman" | "kariyer";

export const APP_VERSION = `${app.expo.version}${app.expo.runtimeVersion ? ` (${app.expo.runtimeVersion})` : ""}`;

interface Row {
  kullanici_id: string | null; olay: UsageEvent; dava_id: string | null; mod: UsageMode | null; ucretli: boolean;
  puan: number | null; kazandi: boolean | null; platform: string; surum: string;
}

const DEVICE_KEY = "celse-cihaz-kimligi";
const rand = () => {
  let s = "";
  for (let i = 0; i < 4; i++) s += Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, "0");
  return `c-${s}`;
};
let deviceId = rand();
let deviceLoaded = false;
async function loadDevice() {
  if (deviceLoaded) return;
  deviceLoaded = true;
  try {
    const v = await AsyncStorage.getItem(DEVICE_KEY);
    if (v && v.length >= 8 && v.length <= 64) deviceId = v; else await AsyncStorage.setItem(DEVICE_KEY, deviceId);
  } catch { /* depolama yoksa bu oturumluk kimlik kullanılır */ }
}

const queue: Row[] = [];
const MAX_QUEUE = 100, BATCH = 25, DELAY = 6000;
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let listening = false;

function listen() {
  if (listening) return;
  listening = true;
  try {
    // Uygulama arka plana geçerken (web'de sekme gizlenirken) bekleyen olaylar hemen gönderilir.
    AppState.addEventListener("change", s => { if (s !== "active") flush(); });
  } catch { /* yok say */ }
}

function schedule(ms = DELAY) {
  if (timer) return;
  timer = setTimeout(() => { timer = null; flush(); }, ms);
}

async function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (flushing || !queue.length) return;
  const sb = supabase();
  if (!sb) { queue.length = 0; return; }
  flushing = true;
  try {
    await loadDevice();
    while (queue.length) {
      const batch = queue.splice(0, BATCH).map(r => ({ ...r, oturum: deviceId }));
      // returning yok: misafir ve oyuncu satırları okuyamaz (yalnız yönetici).
      const { error } = await sb.from("kullanim").insert(batch);
      // Oturum süresi dolmuşsa üye kimliği reddedilir; sayılar kaybolmasın diye bir kez kimliksiz denenir.
      if (error && batch.some(r => r.kullanici_id)) await sb.from("kullanim").insert(batch.map(r => ({ ...r, kullanici_id: null })));
    }
  } catch { queue.length = 0; /* ağ yok: sessizce bırak */ }
  flushing = false;
}

/** Bir olay yazar. Hiçbir koşulda hata fırlatmaz. */
export function logUsage(olay: UsageEvent, e: { davaId?: string; mod?: UsageMode; ucretli?: boolean; puan?: number | null; kazandi?: boolean | null } = {}) {
  try {
    if (!supabase()) return;
    listen();
    const acc = currentAccount();
    queue.push({
      kullanici_id: acc?.mode === "server" ? acc.id : null,
      olay, dava_id: e.davaId ? e.davaId.slice(0, 80) : null, mod: e.mod || null, ucretli: !!e.ucretli,
      puan: typeof e.puan === "number" && isFinite(e.puan) ? Math.max(0, Math.min(100, Math.round(e.puan))) : null,
      kazandi: typeof e.kazandi === "boolean" ? e.kazandi : null,
      platform: Platform.OS === "ios" || Platform.OS === "android" || Platform.OS === "web" ? Platform.OS : "diger",
      surum: APP_VERSION.slice(0, 40)
    });
    if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
    schedule(queue.length >= BATCH ? 0 : DELAY);
  } catch { /* yok say */ }
}

/* ---------- Dava başlangıcı ve sonu (App.tsx'teki ekran geçişlerinden) ---------- */

/** App.tsx'teki ekran (route) yapısının burada gereken kısmı. */
interface RouteLike {
  k: string; c?: CaseFile; from?: string; players?: Record<Side, Player>; game?: GameState; ai?: AiVerdict;
}

/** Hangi biçimde oynandığı. */
function modeOf(c: CaseFile, from: string | undefined, careerOnline: boolean): UsageMode {
  if (from === "career" || from === "desk" || careerOnline) return "kariyer";
  if (c.room === "tahkim") return "tahkim";
  return c.mode === "duel" ? "duel" : "solo";
}

/** Abonelik (Celse Pro) kilidindeki içerik mi? Ücretsiz sürüm kariyerin ilk bölümüdür; antrenman listesi de aynı kilide uyar.
 *  Karşılıklı duruşma ve tahkim listesi ücretsizdir. */
function paidContent(c: CaseFile, mod: UsageMode): boolean {
  if (c.career?.off) return false;
  if (mod === "kariyer" || (mod === "solo" && c.mode === "solo")) return levelOf(c) > FREE_LEVEL;
  return false;
}

/** Oyuncunun tarafı: tek kişilikte p1; karşılıklıda bilgisayar ya da internetteki rakibin karşısı; aynı cihazda iki kişi oynuyorsa
 *  kariyerde büronun tarafı, antrenmanda belirsiz (null). */
function mySide(c: CaseFile, players: Record<Side, Player> | undefined, mod: UsageMode): Side | null {
  if (c.mode === "solo") return "p1";
  if (players?.p1.ai || players?.p1.remote) return "p2";
  if (players?.p2.ai || players?.p2.remote) return "p1";
  return mod === "kariyer" ? careerSide(c) : null;
}

function resultOf(r: RouteLike, side: Side | null): { puan: number | null; kazandi: boolean | null } {
  const { c, game, ai } = r;
  if (!c || !game) return { puan: null, kazandi: null };
  if (c.mode === "solo") {
    let w: string | undefined;
    try { w = verdict(c, game).winner; } catch { /* karar kuralı yoksa sonuç boş kalır */ }
    return { puan: game.score, kazandi: w ? w === "p1" : null };
  }
  if (!side) return { puan: null, kazandi: null };
  let winner: string | undefined = ai?.winner;
  if (!winner) { try { winner = verdict(c, game).winner; } catch { /* yok say */ } }
  const puan = ai ? ai[side] : 50 + game.pts[side] - game.pts[side === "p1" ? "p2" : "p1"];
  return { puan, kazandi: winner ? winner === side : null };
}

let playing: { id: string; mod: UsageMode; ucretli: boolean; route: RouteLike } | null = null;

/** Her ekran geçişinde çağrılır: duruşma açılınca "dava_basladi", karar ekranına varınca "dava_bitti",
 *  karar gelmeden duruşmadan çıkılınca "dava_birakti". Yönetim paneli önizlemeleri sayılmaz. */
export function trackRoute(r: RouteLike, careerOnline = false) {
  try {
    const startK = r.k === "game" || r.k === "onlineGame";
    if (r.k === "closing") return; // karşılıklı duruşmada son sözler: oyun sürüyor
    if (r.k === "verdict") {
      if (playing && r.c && r.c.id === playing.id) {
        const mod = r.from === "career" || r.from === "desk" ? "kariyer" : playing.mod;
        const res = resultOf(r, mySide(r.c, r.players || playing.route.players, mod));
        logUsage("dava_bitti", { davaId: playing.id, mod, ucretli: playing.ucretli, ...res });
      }
      playing = null;
      return;
    }
    if (playing) logUsage("dava_birakti", { davaId: playing.id, mod: playing.mod, ucretli: playing.ucretli });
    playing = null;
    if (startK && r.c && r.from !== "admin") {
      const mod = modeOf(r.c, r.from, careerOnline);
      playing = { id: r.c.id, mod, ucretli: paidContent(r.c, mod), route: r };
      logUsage("dava_basladi", { davaId: r.c.id, mod, ucretli: playing.ucretli });
    }
  } catch { /* istatistik oyunu asla durdurmaz */ }
}
