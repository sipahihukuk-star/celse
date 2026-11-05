// "Duruşmayı izle" videosu (yalnız web): sahneler bir <canvas>'a çizilir (oyunun sahne yerleşimiyle — stageLayout — arka plan,
// yüzler, masa önü, salon levhası; altta altyazı, üstte sabit uyarı), satırların bulut sesleri WebAudio ile aynı zaman çizelgesine konur ve MediaRecorder ile tek dosyaya kaydedilir
// (tarayıcı destekliyorsa mp4, değilse webm). Kayıt gerçek sürede yapılır. Yeni bir yerel modül gerektirmez.
// Eğitim amaçlı canlandırmadır, hukuki görüş değildir; karakterler gerçek avukat değildir.
import { Image as RNImage, Platform } from "react-native";
import type { Danisma, Kim, Senaryo } from "../data/danisma";
import { t } from "../i18n";
import { ARA_SN, gorunum, Kadro, kimAdi, Parca, parcalar, sahneBaslik, UYARI_KISA } from "./izleOrtak";
import { MOUTHS } from "./mouths";
import { visemes } from "./PhotoStage";
import { PhotoKey, PHOTOS } from "./photos";
import { drawOrder, figState, KATIP_DESK, SCREEN, StageFig, stageLayout, StageLayout } from "./stageLayout";
import { C, F } from "./theme";
import { lineAudioUrl } from "./voice";

export interface VideoIptal { iptal: boolean }
const W = 1280, H = 720, FPS = 30;

const g = () => globalThis as any;
const AC = () => g().AudioContext || g().webkitAudioContext;

/** Tarayıcı tuvali kaydedebiliyor mu (MediaRecorder, canvas.captureStream, WebAudio)? */
export function videoDestekli(): boolean {
  if (Platform.OS !== "web" || typeof document === "undefined") return false;
  try {
    const MR = g().MediaRecorder;
    return !!MR && !!AC() && typeof (document.createElement("canvas") as any).captureStream === "function" && !!mimeOf();
  } catch { return false; }
}

function mimeOf(): string {
  const MR = g().MediaRecorder;
  // Önce telefonlarda da açılan H.264/AAC mp4; yoksa webm (Chrome, Firefox); en son tarayıcının kendi mp4'ü (Safari).
  const list = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1,mp4a", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return list.find(m => { try { return MR.isTypeSupported(m); } catch { return false; } }) || "";
}

/** require() ile gelen görselin web adresi. */
function uriOf(src: any): string {
  if (typeof src === "string") return src;
  if (src && typeof src.uri === "string") return src.uri;
  if (src && typeof src.default === "string") return src.default;
  try { const r = (RNImage as any).resolveAssetSource?.(src); if (r?.uri) return r.uri; } catch { /* yok say */ }
  return "";
}
function loadImg(src: any): Promise<HTMLImageElement | null> {
  const uri = uriOf(src);
  if (!uri) return Promise.resolve(null);
  return new Promise(res => {
    const im = new (g().Image)() as HTMLImageElement;
    im.crossOrigin = "anonymous";
    im.onload = () => res(im); im.onerror = () => res(null);
    im.src = uri;
  });
}

interface Seg { p: Parca; buf: AudioBuffer | null; start: number; dur: number }

/** Videoyu kaydeder. ilerleme: hazırlık (sesler, görseller) ve kayıt oranı. onizleme: tuvalin gösterileceği öğe. */
export async function videoKaydet(o: {
  s: Senaryo; d: Danisma; k: Kadro; iptal: VideoIptal; onizleme?: HTMLElement;
  ilerleme: (asama: "hazirlik" | "kayit", oran: number) => void;
}): Promise<{ blob: Blob; uzanti: string; sessiz: boolean }> {
  const { s, k, iptal } = o;
  const mime = mimeOf();
  if (!videoDestekli()) throw new Error(t("Bu tarayıcı video kaydını desteklemiyor."));
  let list = parcalar(s, k);
  // Geliştirme denemesi: window.__izleVideoKisa ile her sahneden yalnız ilk iki satır (otomatik ekran denemesi için).
  if (g().__izleVideoKisa) list = list.filter(p => !p.adim || p.adim.k === "kart" || p.adim.li < 2);

  // 1) görseller: her sahnenin yerleşimindeki arka plan ve yüzler (heyet üyeleri dahil) ile kadronun bütün yüzleri.
  const keys = new Set<PhotoKey>(["bg-gorusme"]);
  Object.values(k.faces).forEach(x => x && keys.add(x));
  for (const sh of s.sahneler) {
    const g = gorunum(k, sh.tur);
    const L = stageLayout({ c: k.c, scene: g.scene, faces: g.faces, focus: null, guest: null, W, H: SH });
    keys.add(L.bg); L.figs.forEach(f => keys.add(f.photo));
  }
  const img: Partial<Record<string, HTMLImageElement | null>> = {};
  const mouth: Record<string, { a: HTMLImageElement | null; o: HTMLImageElement | null }> = {};
  await Promise.all([...keys].map(async key => {
    img[key] = await loadImg(PHOTOS[key].src);
    const m = MOUTHS[key];
    if (m) mouth[key] = { a: m.a ? await loadImg(m.a) : null, o: m.o ? await loadImg(m.o) : null };
  }));
  if ([...keys].some(x => x.startsWith("bg-") && !img[x])) throw new Error(t("Görseller yüklenemedi."));
  // Konuşmayan kişinin karartılmış kopyası bir kez hazırlanır (her karede filtre uygulamak yavaştır).
  const koyu: Record<string, HTMLCanvasElement> = {};
  for (const key of keys) {
    const im = img[key];
    if (!im || key.startsWith("bg-")) continue;
    const c = document.createElement("canvas");
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext("2d")!;
    x.drawImage(im, 0, 0);
    x.globalCompositeOperation = "source-atop"; x.fillStyle = "rgba(0,0,0,0.5)"; x.fillRect(0, 0, c.width, c.height);
    koyu[key] = c;
  }

  // 2) sesler (oynatmayla aynı bulut sesleri; gelmeyen satır okuma süresi kadar sessiz kalır)
  const ac: AudioContext = new (AC())();
  await ac.resume().catch(() => {});
  const bufs: (AudioBuffer | null)[] = new Array(list.length).fill(null);
  let done = 0, idx = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (idx < list.length) {
      const j = idx++;
      try {
        const url = await lineAudioUrl(list[j].metin, list[j].speaker);
        if (url) { const r = await fetch(url); if (r.ok) bufs[j] = await ac.decodeAudioData(await r.arrayBuffer()); }
      } catch { bufs[j] = null; }
      o.ilerleme("hazirlik", ++done / list.length);
      if (iptal.iptal) break;
    }
  }));
  if (iptal.iptal) { ac.close().catch(() => {}); throw new Error("iptal"); }
  const sessiz = bufs.every(b => !b);
  const segs: Seg[] = [];
  let tt = 0.6;
  list.forEach((p, j) => {
    tt += ARA_SN[p.ara] || 0;
    const read = !p.adim ? 3.5 : p.adim.k === "kart" ? 2.8 : Math.max(2.2, p.metin.length * 0.055);
    const dur = Math.max(bufs[j] ? bufs[j]!.duration + 0.25 : read, p.adim?.k === "kart" ? 2.4 : 0);
    segs.push({ p, buf: bufs[j], start: tt, dur });
    tt += dur;
  });
  const total = tt + 1.2;

  // 3) tuval ve kayıt
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  cv.setAttribute("style", "width:100%;height:100%;display:block");
  if (o.onizleme) { o.onizleme.innerHTML = ""; o.onizleme.appendChild(cv); }
  const ctx = cv.getContext("2d")!;
  const dest = ac.createMediaStreamDestination();
  // Ses izi hiç boş kalmasın (seslendirme yoksa da kayıt sessiz bir ses iziyle düzgün zamanlanır).
  try { const sil = ac.createConstantSource(); sil.offset.value = 0; sil.connect(dest); sil.start(); } catch { /* yok say */ }
  const stream: MediaStream = (cv as any).captureStream(FPS);
  const both = new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new (g().MediaRecorder)(both, { mimeType: mime, videoBitsPerSecond: 2500000, audioBitsPerSecond: 96000 }) as MediaRecorder;
  const chunks: Blob[] = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise<void>(res => { rec.onstop = () => res(); });

  const ciz = (el: number) => {
    const i = segs.findIndex(x => el < x.start + x.dur + 0.0001 && el >= x.start - (ARA_SN[x.p.ara] || 0) - 0.0001);
    const seg = segs[Math.max(0, i < 0 ? segs.length - 1 : i)];
    cizSahne(ctx, s, k, img, koyu, mouth, seg, el - seg.start);
  };
  ciz(0);
  rec.start(1000);
  const t0 = ac.currentTime + 0.3;
  segs.forEach(x => {
    if (!x.buf) return;
    const src = ac.createBufferSource();
    src.buffer = x.buf;
    src.connect(dest); src.connect(ac.destination);
    src.start(t0 + x.start);
  });
  await new Promise<void>(res => {
    const tm = setInterval(() => {
      const el = ac.currentTime - t0;
      if (iptal.iptal || el >= total) { clearInterval(tm); res(); return; }
      ciz(Math.max(0, el));
      o.ilerleme("kayit", Math.min(1, el / total));
    }, 1000 / FPS);
  });
  rec.stop();
  await stopped;
  stream.getTracks().forEach(x => x.stop());
  ac.close().catch(() => {});
  if (iptal.iptal) throw new Error("iptal");
  const tur = (rec.mimeType || mime).split(";")[0];
  const blob = new Blob(chunks, { type: tur });
  return { blob, uzanti: tur === "video/mp4" ? "mp4" : "webm", sessiz };
}

/* ---------- çizim ---------- */
function sarmala(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(/\s+/), lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const tr = cur ? cur + " " + w : w;
    if (ctx.measureText(tr).width > max && cur) { lines.push(cur); cur = w; } else cur = tr;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Kare düzeni: üstte sabit uyarı şeridi, ortada sahne, altta konuşanın adı ve altyazı (uygulamadaki gibi; altyazı kimseyi örtmez). */
const SY = 44, SH = 480, CY = SY + SH;

type Img = Partial<Record<string, HTMLImageElement | null>>;
type Agiz = Record<string, { a: HTMLImageElement | null; o: HTMLImageElement | null }>;

function cizSahne(ctx: CanvasRenderingContext2D, s: Senaryo, k: Kadro, img: Img, koyu: Record<string, HTMLCanvasElement>, mouth: Agiz, seg: Seg, el: number) {
  const a = seg.p.adim;
  const sahne = s.sahneler[a ? a.si : 0];
  const line = a && a.k === "satir" ? sahne.satirlar[a.li] : null;
  const g = gorunum(k, sahne.tur);
  const focus = line ? g.key[line.kim] : null;
  // Oyundaki sahneyle aynı yerleşim (büroda konuk yok: danışma görüşmesinde masada yalnız danışan ya da karşı taraf oturur).
  const L = stageLayout({ c: k.c, scene: g.scene, faces: g.faces, focus, guest: null, W, H: SH });
  ctx.save();
  ctx.fillStyle = C.wallDeep; ctx.fillRect(0, 0, W, H);

  // Sahne (SY..CY arası, kırpılarak).
  ctx.save();
  ctx.beginPath(); ctx.rect(0, SY, W, SH); ctx.clip(); ctx.translate(0, SY);
  ctx.fillStyle = "#111"; ctx.fillRect(0, 0, W, SH);
  // Ağız karesi: konuşma süresince metnin seslerine göre (PhotoStage ile aynı sıralama).
  let mf = 0;
  if (line && el >= 0) {
    const seq = visemes(line.metin);
    const per = seg.buf ? Math.max(0.04, seg.buf.duration / Math.max(1, seq.length)) : 0.058;
    const i = Math.floor(el / per);
    mf = i < seq.length ? seq[i] : 0;
  }
  cizYerlesim(ctx, L, img, koyu, mouth, focus, mf);
  if (L.plaque) {
    ctx.font = `22px ${F.display}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const w = Math.min(W * 0.8, ctx.measureText(L.plaque).width + 30);
    ctx.fillStyle = "rgba(20,16,10,0.62)"; ctx.fillRect(W / 2 - w / 2, 10, w, 34);
    ctx.fillStyle = C.brass; ctx.fillText(L.plaque, W / 2, 28, w - 20);
  }
  ctx.restore();

  // Altyazı alanı: konuşanın adı ve metni; uzun metin sayfalara bölünüp ses süresine yayılır.
  ctx.fillStyle = C.panel; ctx.fillRect(0, CY, W, H - CY);
  ctx.fillStyle = C.line; ctx.fillRect(0, CY, W, 2);
  if (line) {
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    let size = 28, lines: string[] = [];
    for (; size >= 22; size -= 2) { ctx.font = `${size}px ${F.body}`; lines = sarmala(ctx, line.metin, W - 100); if (lines.length <= 4) break; }
    const lh = size + 8, per = 4, pages = Math.ceil(lines.length / per);
    const page = Math.min(pages - 1, Math.floor((Math.max(0, el) / Math.max(0.1, seg.dur)) * pages));
    ctx.fillStyle = sahne.tur === "karar" ? C.mid : C.brassDim;
    ctx.font = `21px ${F.bodyBold}`;
    ctx.fillText(kimAdi(line.kim, s) + (sahne.tur === "karar" ? " · " + t("EĞİTİM AMAÇLI KARAR") : ""), 50, CY + 34, W - 100);
    ctx.fillStyle = "#fff"; ctx.font = `${size}px ${F.body}`;
    lines.slice(page * per, page * per + per).forEach((l, i) => ctx.fillText(l, 50, CY + 34 + (i + 1) * lh, W - 100));
  } else {
    // Açılış ve sahne başlığı kartı.
    ctx.fillStyle = "rgba(12,4,7,0.74)"; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const b = a ? sahneBaslik(sahne.tur, s) : { baslik: t("Duruşmayı izle"), alt: t("Celse · eğitim amaçlı canlandırma") };
    ctx.fillStyle = C.brass; ctx.font = `56px ${F.display}`; ctx.fillText(b.baslik, W / 2, H / 2 - 30, W - 120);
    ctx.fillStyle = C.textSoft; ctx.font = `28px ${F.body}`;
    sarmala(ctx, b.alt, W - 240).slice(0, 3).forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + 40 + i * 38));
  }

  // Sabit uyarı şeridi.
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, SY);
  ctx.fillStyle = "#fff"; ctx.font = `19px ${F.bodyMed}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(t(UYARI_KISA), W / 2, SY / 2 + 1, W - 40);
  ctx.restore();
}

/** Oyundaki sahnenin (PhotoStage) tuvaldeki karşılığı: aynı yerleşim, aynı çizim sırası. */
function cizYerlesim(ctx: CanvasRenderingContext2D, L: StageLayout, img: Img, koyu: Record<string, HTMLCanvasElement>, mouth: Agiz, focus: string | null, mf: number) {
  const bg = img[L.bg];
  const B = PHOTOS[L.bg];
  if (!bg) return;
  const { s, ox, oy } = L;
  const X = (x: number) => ox + x * s, Y = (y: number) => oy + y * s;
  // Daraltılmış salonda üstte kalan şerit: fotoğrafın üst kenarı dikeyde uzatılır, biraz karartılır.
  if (oy > 0) {
    ctx.drawImage(bg, 0, 0, B.w, B.h * 0.06, ox, 0, B.w * s, oy + 1);
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, 0, L.W, oy + 1);
  }
  ctx.drawImage(bg, ox, oy, B.w * s, B.h * s);
  for (const d of drawOrder(L, focus)) {
    if (d.k === "fig") { cizKisi(ctx, d.f, L.H, img, koyu, mouth, focus, mf, L.figs); continue; }
    // Örtü: arka planın bu parçası kişilerin üstüne yeniden çizilir (fotoğrafın dışına taşan kısım kırpılır).
    const x0 = Math.max(0, d.r.x0), x1 = Math.min(B.w, d.r.x1), y0 = Math.max(0, d.r.top), y1 = Math.min(B.h, d.r.bottom);
    if (x1 > x0 && y1 > y0) ctx.drawImage(bg, x0, y0, x1 - x0, y1 - y0, X(x0), Y(y0), (x1 - x0) * s, (y1 - y0) * s);
  }
  if (L.screen) {
    // Kâtibin ekranı: arkası bize dönük; ayağı masaya oturur.
    const sx = X(SCREEN.x0), sw = (SCREEN.x1 - SCREEN.x0) * s, top = Y(SCREEN.top), sh = (SCREEN.bottom - SCREEN.top) * s;
    ctx.fillStyle = "#16171a"; ctx.strokeStyle = "#34363c"; ctx.lineWidth = Math.max(1, s);
    ctx.beginPath(); (ctx as any).roundRect ? (ctx as any).roundRect(sx, top, sw, sh, 3 * s) : ctx.rect(sx, top, sw, sh); ctx.fill(); ctx.stroke();
    const foot = Y(KATIP_DESK.top + 3);
    ctx.fillStyle = "#24262b";
    ctx.fillRect(sx + sw / 2 - (SCREEN.standW * s) / 2, top + sh, SCREEN.standW * s, Math.max(0, foot - (top + sh) - 2.5 * s));
    ctx.fillRect(sx + sw / 2 - (SCREEN.baseW * s) / 2, foot - 2.5 * s, SCREEN.baseW * s, 2.5 * s);
  }
}

function cizKisi(ctx: CanvasRenderingContext2D, f: StageFig, HH: number, img: Img, koyu: Record<string, HTMLCanvasElement>, mouth: Agiz, focus: string | null, mf: number, shown: StageFig[]) {
  const P = PHOTOS[f.photo];
  const h = f.h, w = h * (P.w / P.h), x0 = f.x - w / 2, y0 = HH - f.bottom - h;
  const { speaking, lit } = figState(f, focus, shown);
  const im = img[f.photo];
  if (!im) return;
  ctx.save();
  if (f.flip) { ctx.translate(f.x, 0); ctx.scale(-1, 1); ctx.translate(-f.x, 0); }
  ctx.drawImage(!lit && koyu[f.photo] ? koyu[f.photo] : im, x0, y0, w, h);
  const m = MOUTHS[f.photo], mi = mouth[f.photo];
  if (speaking && mf && m && mi) {
    const src = mf === 2 ? mi.o || mi.a : mi.a || mi.o;
    if (src) {
      const mx = x0 + m.x * w, my = y0 + m.y * h, mw = m.w * w, mh = m.h * h;
      if (mf === 4) ctx.globalAlpha = 0.55;
      if (mf === 3) ctx.drawImage(src, mx - mw * 0.03, my + mh * 0.19, mw * 1.06, mh * 0.62);
      else ctx.drawImage(src, mx, my, mw, mh);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}
