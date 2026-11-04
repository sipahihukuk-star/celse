// "Duruşmayı izle" videosu (yalnız web): sahneler bir <canvas>'a çizilir (arka plan, yüzler ve siluetler, ad etiketleri, altyazı,
// sabit uyarı), satırların bulut sesleri WebAudio ile aynı zaman çizelgesine konur ve MediaRecorder ile tek dosyaya kaydedilir
// (tarayıcı destekliyorsa mp4, değilse webm). Kayıt gerçek sürede yapılır. Yeni bir yerel modül gerektirmez.
// Eğitim amaçlı canlandırmadır, hukuki görüş değildir; karakterler gerçek avukat değildir.
import { Image as RNImage, Platform } from "react-native";
import type { Danisma, Kim, Senaryo } from "../data/danisma";
import { t } from "../i18n";
import { ARA_SN, Fig, figW, Kadro, kimAdi, kimKisa, Parca, parcalar, sahneBaslik, SIL_H, SIL_PATH, SIL_W, UYARI_KISA, yerlesim } from "./izleOrtak";
import { MOUTHS } from "./mouths";
import { visemes } from "./PhotoStage";
import { PhotoKey, PHOTOS } from "./photos";
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

  // 1) görseller
  const keys = new Set<PhotoKey>(["bg-gorusme", "bg-yerel"]);
  Object.values(k.yuz).forEach(x => x && keys.add(x));
  const img: Partial<Record<string, HTMLImageElement | null>> = {};
  const mouth: Record<string, { a: HTMLImageElement | null; o: HTMLImageElement | null }> = {};
  await Promise.all([...keys].map(async key => {
    img[key] = await loadImg(PHOTOS[key].src);
    const m = MOUTHS[key];
    if (m) mouth[key] = { a: m.a ? await loadImg(m.a) : null, o: m.o ? await loadImg(m.o) : null };
  }));
  if (!img["bg-gorusme"] || !img["bg-yerel"]) throw new Error(t("Görseller yüklenemedi."));
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

function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, on: boolean) {
  ctx.font = `20px ${F.bodyBold}`;
  const w = Math.min(360, ctx.measureText(text).width + 26), h = 32;
  const lx = Math.max(6, Math.min(W - w - 6, x - w / 2));
  ctx.fillStyle = on ? C.bordo : "rgba(10,10,14,0.75)";
  ctx.strokeStyle = on ? "#fff" : "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); (ctx as any).roundRect ? (ctx as any).roundRect(lx, y, w, h, 16) : ctx.rect(lx, y, w, h); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, lx + w / 2, y + h / 2 + 1, w - 20);
}

/** Kare düzeni: üstte sabit uyarı şeridi, ortada sahne, altta konuşanın adı ve altyazı (uygulamadaki gibi; altyazı kimseyi örtmez). */
const SY = 44, SH = 480, CY = SY + SH;

function cizSahne(ctx: CanvasRenderingContext2D, s: Senaryo, k: Kadro, img: Partial<Record<string, HTMLImageElement | null>>, koyu: Record<string, HTMLCanvasElement>,
  mouth: Record<string, { a: HTMLImageElement | null; o: HTMLImageElement | null }>, seg: Seg, el: number) {
  const a = seg.p.adim;
  const sahne = s.sahneler[a ? a.si : 0];
  const line = a && a.k === "satir" ? sahne.satirlar[a.li] : null;
  const focus: Kim | null = line ? line.kim : null;
  const y = yerlesim(sahne.tur, W, SH, k.yuz);
  const bg = img[y.bg]!;
  const B = PHOTOS[y.bg];
  ctx.save();
  ctx.fillStyle = C.wallDeep; ctx.fillRect(0, 0, W, H);

  // Sahne (SY..CY arası, kırpılarak).
  ctx.save();
  ctx.beginPath(); ctx.rect(0, SY, W, SH); ctx.clip(); ctx.translate(0, SY);
  const bgDraw = (sy: number, sh: number, dy: number) => {
    ctx.save();
    if (y.ayna) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.drawImage(bg, 0, sy, B.w, sh, y.ox, dy, B.w * y.s, sh * y.s);
    ctx.restore();
  };
  bgDraw(0, B.h, y.oy);
  // Ağız karesi: konuşma süresince metnin seslerine göre (PhotoStage ile aynı sıralama).
  let mf = 0;
  if (line && el >= 0) {
    const seq = visemes(line.metin);
    const per = seg.buf ? Math.max(0.04, seg.buf.duration / Math.max(1, seq.length)) : 0.058;
    const i = Math.floor(el / per);
    mf = i < seq.length ? seq[i] : 0;
  }
  for (const f of [...y.figs].sort((p, q) => p.z - q.z)) cizKisi(ctx, f, SH, img, koyu, mouth, focus, mf);
  if (y.masa !== null) bgDraw((y.masa - y.oy) / y.s, B.h - (y.masa - y.oy) / y.s, y.masa);
  // Ad etiketleri: siluetlerde hep, diğerlerinde konuşurken.
  for (const f of y.figs) {
    if (f.photo && f.kim !== focus) continue;
    let top = f.photo ? SH - f.bottom - f.h * (f.kim === "hakim" ? 0.18 : 0.1) : SH - f.bottom - f.h * 0.52 - (y.salon && f.kim === "karsiTaraf" ? 40 : 0);
    if (y.masa !== null && f.photo) top = Math.min(top, y.masa - 44);
    pill(ctx, kimKisa(f.kim, s), f.x, Math.max(56, Math.min(SH - 40, top)), f.kim === focus);
  }
  if (y.salon) {
    ctx.font = `22px ${F.display}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const tx = (s.mahkeme || t("Mahkeme")) + " · " + t("temsilî");
    const w = ctx.measureText(tx).width + 30;
    ctx.fillStyle = "rgba(20,16,10,0.62)"; ctx.fillRect(W / 2 - w / 2, 10, w, 34);
    ctx.fillStyle = C.brass; ctx.fillText(tx, W / 2, 28);
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
    ctx.fillText(kimAdi(line.kim, s) + (sahne.tur === "karar" ? " · " + t("EĞİTİM AMAÇLI DEĞERLENDİRME · GERÇEK KARAR DEĞİLDİR") : ""), 50, CY + 34, W - 100);
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

function cizKisi(ctx: CanvasRenderingContext2D, f: Fig, HH: number, img: Partial<Record<string, HTMLImageElement | null>>, koyu: Record<string, HTMLCanvasElement>,
  mouth: Record<string, { a: HTMLImageElement | null; o: HTMLImageElement | null }>, focus: Kim | null, mf: number) {
  const w = figW(f), h = f.h, x0 = f.x - w / 2, y0 = HH - f.bottom - h;
  const speaking = focus === f.kim;
  const lit = focus === null || speaking || !f.front;
  ctx.save();
  if (!f.photo) {
    // Siluet: koyu dolgu ve açık kenar çizgisi (konuşurken parlak); ekrandakiyle aynı.
    ctx.translate(x0, y0); ctx.scale(w / SIL_W, h / SIL_H);
    const p = new Path2D(SIL_PATH);
    ctx.fillStyle = "#17171c"; ctx.fill(p);
    ctx.strokeStyle = speaking ? "#fbf4f5" : "rgba(255,255,255,0.55)"; ctx.lineWidth = speaking ? 1.9 : 1.2; ctx.stroke(p);
    ctx.restore();
    return;
  }
  const im = img[f.photo];
  if (!im) { ctx.restore(); return; }
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
