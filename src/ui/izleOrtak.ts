// "Duruşmayı izle" ortak parçaları: kadro (yüzler ve sesler), rol adları, sahne başlıkları, adımlar, sahne yerleşimi,
// sesli kayıt/video parçaları ve tutanak metni. Ekrandaki oynatıcı (DanismaWatch), MP3 ve video (izleVideo) aynı bilgiyi kullanır.
// Eğitim amaçlı canlandırmadır, hukuki görüş değildir; karakterler gerçek avukat değildir.
import type { Danisma, Kim, SahneTur, Senaryo } from "../data/danisma";
import { alanAdi } from "../data/danisma";
import { locale, t } from "../i18n";
import { hash, JUDGE, LAWYER } from "./castFaces";
import { PhotoKey, PHOTOS } from "./photos";
import { DESK, MIN_VIEW, ROOM } from "./PhotoStage";
import { Speaker, voiceOf } from "./voice";

export const UYARI_KISA = "Eğitim amaçlı canlandırmadır, hukuki görüş değildir. Oyuncular/karakterler gerçek avukat değildir.";

/** Siluet (baş ve omuzlar), 100×128 birimlik kutuda. SVG'de ve tuvalde (Path2D) aynı yol kullanılır. */
export const SIL_PATH = "M50 12 C61 12 68 22 68 35 C68 48 61 58 50 58 C39 58 32 48 32 35 C32 22 39 12 50 12 Z M42 56 L58 56 L59 67 C76 70 91 80 95 101 L97 128 L3 128 L5 101 C9 80 24 70 41 67 Z";
export const SIL_W = 100, SIL_H = 128;

export interface Kadro {
  /** Fotoğrafı olanların yüzü (siluetlerin yüzü yoktur). */
  yuz: Partial<Record<Kim, PhotoKey>>;
  /** Her konuşanın sesi (bulut sesi adı farklı olacak biçimde seçilir). */
  ses: Record<Kim | "narr", Speaker>;
}

/** Danışmaya bağlı sabit kadro: aynı danışma her açılışta aynı yüzleri ve sesleri kullanır. */
export function kadro(id: string): Kadro {
  const h = hash(id);
  const bizF = (h & 1) === 1;
  const pick = (pool: readonly PhotoKey[], k: number) => pool[k % pool.length];
  const bizAvukat = pick(bizF ? LAWYER.f : LAWYER.m, h >>> 3);
  // Karşı avukat ayırt edilsin diye öbür cinsiyetten seçilir.
  const karsiAvukat = pick(bizF ? LAWYER.m : LAWYER.f, h >>> 7);
  const hakim = pick((h >>> 2) & 1 ? JUDGE.f : JUDGE.m, h >>> 11);
  const yuz: Kadro["yuz"] = { bizAvukat, karsiAvukat, hakim };
  const female: Record<Kim, boolean> = {
    bizAvukat: bizAvukat.includes("kadin"), karsiAvukat: karsiAvukat.includes("kadin"), hakim: hakim.includes("kadin"),
    biz: ((h >>> 15) & 1) === 1, karsiTaraf: ((h >>> 16) & 1) === 1
  };
  const ses = { narr: { id: "narr", role: "narr", female: true } } as Kadro["ses"];
  const kullanilan = new Set<string>();
  for (const k of ["hakim", "bizAvukat", "karsiAvukat", "biz", "karsiTaraf"] as Kim[]) {
    let sp: Speaker = { id: `danisma:${id}:${k}`, role: k === "hakim" ? "judge" : k, female: female[k] };
    // Aynı cinsiyetten iki kişi aynı sesle konuşmasın: kimlik ekiyle başka bir ses denenir.
    for (let i = 1; i < 30 && kullanilan.has(voiceOf(sp)); i++) sp = { ...sp, id: `danisma:${id}:${k}:${i}` };
    kullanilan.add(voiceOf(sp));
    ses[k] = sp;
  }
  return { yuz, ses };
}

const tarafAdi = (s: Senaryo, biz: boolean) => ((s.taraf === "davaci") === biz ? t("davacı") : t("davalı"));

/** Konuşanın tam adı (konuşma balonunda ve tutanakta). */
export function kimAdi(kim: Kim, s: Senaryo) {
  const r = s.roller || ({} as Senaryo["roller"]);
  if (kim === "biz") return t("Siz ({taraf})", { taraf: tarafAdi(s, true) });
  if (kim === "karsiTaraf") return r.karsiTaraf || t("Karşı taraf");
  if (kim === "hakim") return r.hakim || t("Hâkim");
  if (kim === "bizAvukat") return `${r.bizAvukat || (s.taraf === "davaci" ? t("Davacı vekili") : t("Davalı vekili"))} · ${t("sizin avukatınız")}`;
  return `${r.karsiAvukat || (s.taraf === "davaci" ? t("Davalı vekili") : t("Davacı vekili"))} · ${t("karşı taraf")}`;
}

/** Sahnede kişinin üstündeki kısa ad. */
export function kimKisa(kim: Kim, s: Senaryo) {
  if (kim === "biz") return t("Siz ({taraf})", { taraf: tarafAdi(s, true) });
  if (kim === "karsiTaraf") return s.roller?.karsiTaraf || t("Karşı taraf");
  if (kim === "hakim") return s.roller?.hakim || t("Hâkim");
  if (kim === "bizAvukat") return t("Avukatınız");
  return t("Karşı taraf avukatı");
}

export function sahneBaslik(tur: SahneTur, s: Senaryo) {
  if (tur === "gorusme_biz") return { baslik: t("1. Görüşme — sizin avukatınız"), alt: t("Avukatınız sizi bürosunda dinliyor ve sorular soruyor.") };
  if (tur === "gorusme_karsi") return { baslik: t("2. Görüşme — karşı taraf"), alt: t("Karşı tarafın avukatı, {rol} ile görüşüyor.", { rol: kimKisa("karsiTaraf", s) }) };
  if (tur === "durusma") return { baslik: t("3. Duruşma"), alt: `${s.mahkeme || t("Mahkeme")} · ${t("temsilî duruşma")}` };
  return { baslik: t("4. Karar"), alt: t("Hâkimin eğitim amaçlı değerlendirmesi — gerçek bir karar değildir.") };
}

export type Adim = { k: "kart"; si: number } | { k: "satir"; si: number; li: number };
export function adimlar(s: Senaryo): Adim[] {
  const out: Adim[] = [];
  s.sahneler.forEach((sh, si) => { out.push({ k: "kart", si }); sh.satirlar.forEach((_, li) => out.push({ k: "satir", si, li })); });
  return out;
}

/** Sesli kayıt ve video parçaları: başta uyarı, her sahnenin başında anlatıcının okuduğu başlık, sonra satırlar.
 *  ara: önceki parçadan sonra konacak sessizlik (0 yok, 1 kısa, 2 uzun; sunucudaki ARA_MS ile aynı). */
export interface Parca { adim: Adim | null; metin: string; speaker: Speaker; ara: number }
export const ARA_SN = [0, 0.45, 1.2];
export function parcalar(s: Senaryo, k: Kadro): Parca[] {
  const out: Parca[] = [{ adim: null, metin: t(UYARI_KISA), speaker: k.ses.narr, ara: 0 }];
  for (const a of adimlar(s)) {
    const sh = s.sahneler[a.si];
    if (a.k === "kart") { const b = sahneBaslik(sh.tur, s); out.push({ adim: a, metin: `${b.baslik}. ${b.alt}`, speaker: k.ses.narr, ara: 2 }); }
    else { const l = sh.satirlar[a.li]; out.push({ adim: a, metin: l.metin, speaker: k.ses[l.kim], ara: 1 }); }
  }
  return out;
}

/* ---------- sahne yerleşimi (fotoğraf koordinatları 1280×716; ekranda ve tuvalde aynı) ---------- */
/** Yerel salon (bg-yerel): tek hâkimin kürsüdeki yeri. Görüşme odası ve dar ekran ölçüsü PhotoStage'den gelir. */
const BENCH = { x: 640, y: ROOM.yerel.bench.y, h: ROOM.yerel.bench.h };

export interface Fig { kim: Kim; photo?: PhotoKey; x: number; bottom: number; h: number; flip?: boolean; z: number; front: boolean }
export interface Yerlesim {
  bg: PhotoKey; s: number; ox: number; oy: number; W: number; H: number; figs: Fig[];
  /** Görüşme odasında masanın ön kenarı (bu çizginin altı kişilerin üstüne yeniden çizilir). */
  masa: number | null;
  /** Karşı tarafın bürosu: aynı oda aynalanarak başka bir büro gibi gösterilir. */
  ayna: boolean;
  salon: boolean;
}

export function yerlesim(tur: SahneTur, W: number, H: number, yuz: Kadro["yuz"]): Yerlesim {
  const office = tur === "gorusme_biz" || tur === "gorusme_karsi";
  const bg: PhotoKey = office ? "bg-gorusme" : "bg-yerel";
  const B = PHOTOS[bg];
  // Salonda savcı ve kâtip olmadığı için dar ekranda salonun ortası (kürsü) yeterlidir: oyundakinden daha yakın çekilir.
  const s = W && H ? Math.max(W / B.w, office ? H / B.h : Math.min(H / B.h, W / (MIN_VIEW * 0.55))) : 1;
  const ox = (W - B.w * s) / 2, oy = B.h * s > H ? (H - B.h * s) * 0.3 : H - B.h * s;
  const X = (x: number) => ox + x * s, Y = (y: number) => oy + y * s;
  const figs: Fig[] = [];
  if (office) {
    const ayna = tur === "gorusme_karsi";
    const av: Kim = ayna ? "karsiAvukat" : "bizAvukat", taraf: Kim = ayna ? "karsiTaraf" : "biz";
    const h = DESK.clientH * s, bottom = H - Y(DESK.clientBottom);
    // Taraf masanın karşısındaki koltukta; avukat masanın solunda (aynalı odada sağında), ona dönük.
    const tx = X(DESK.clientX), ax = Math.max(X(DESK.clientX - 360), W * 0.21);
    const m = (x: number) => (ayna ? W - x : x);
    figs.push({ kim: taraf, x: m(tx), bottom, h, z: 2, front: true });
    figs.push({ kim: av, photo: yuz[av], flip: !ayna, x: m(ax), bottom, h, z: 2, front: true });
    return { bg, s, ox, oy, W, H, figs, masa: Y(DESK.edge), ayna, salon: false };
  }
  const U = Math.min(H, B.h * s);
  figs.push({ kim: "hakim", photo: yuz.hakim, x: X(BENCH.x), bottom: H - Y(BENCH.y) - BENCH.h * s * 0.06, h: BENCH.h * s * 1.06, z: 1, front: false });
  // Dar (telefon) sahnede avukatlar kenara açılır, taraflar biraz küçülüp ortaya yaklaşır (PhotoStage ile aynı oranlar).
  const k = Math.max(0, Math.min(1, (W / U - 1) / 0.8)), lerp = (a: number, b: number) => a + (b - a) * k;
  const LX = lerp(0.12, 0.17), PX = lerp(0.39, 0.36), ph = U * lerp(0.46, 0.52), lh = U * 0.66;
  figs.push({ kim: "biz", x: W * PX, bottom: 0, h: ph, z: 3, front: true });
  figs.push({ kim: "karsiTaraf", x: W * (1 - PX), bottom: 0, h: ph, z: 3, front: true });
  figs.push({ kim: "bizAvukat", photo: yuz.bizAvukat, x: W * LX, bottom: 0, h: lh, z: 4, front: true });
  figs.push({ kim: "karsiAvukat", photo: yuz.karsiAvukat, flip: true, x: W * (1 - LX), bottom: 0, h: lh, z: 4, front: true });
  return { bg, s, ox, oy, W, H, figs, masa: null, ayna: false, salon: true };
}
/** Kişinin genişliği: fotoğraf oranı ya da siluet oranı. */
export const figW = (f: Fig) => (f.photo ? f.h * (PHOTOS[f.photo].w / PHOTOS[f.photo].h) : f.h * (SIL_W / SIL_H));

/* ---------- tutanak ve yazdırma (ikincil seçenek) ---------- */
export function ozetMetni(s: Senaryo, d: Danisma) {
  const L: string[] = [];
  L.push(t("Celse · Duruşmayı izle"), `${t(alanAdi(d.alan))} · ${new Date(d.created_at).toLocaleDateString(locale())}`, "", t(UYARI_KISA), "");
  L.push(t("Olay özeti").toLocaleUpperCase(locale()), s.ozet || d.olay, "");
  for (const sh of s.sahneler) {
    L.push(sahneBaslik(sh.tur, s).baslik.toLocaleUpperCase(locale()));
    for (const l of sh.satirlar) L.push(sh.tur === "karar" ? l.metin : `${kimAdi(l.kim, s)}: ${l.metin}`);
    L.push("");
  }
  if (s.uyari) L.push(s.uyari);
  return L.join("\n");
}

const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function ozetHtml(s: Senaryo, d: Danisma) {
  const sahne = s.sahneler.map(sh => {
    const satir = sh.tur === "karar"
      ? sh.satirlar.map(l => `<p>${esc(l.metin)}</p>`).join("")
      : sh.satirlar.map(l => `<p class="l"><b>${esc(kimAdi(l.kim, s))}:</b> ${esc(l.metin)}</p>`).join("");
    return `<h2>${esc(sahneBaslik(sh.tur, s).baslik)}</h2>${sh.tur === "karar" ? `<div class="karar">${satir}</div>` : satir}`;
  }).join("");
  return `<!doctype html><html lang="${esc(locale().slice(0, 2))}"><head><meta charset="utf-8"><title>${esc(t("Celse · Duruşmayı izle"))}</title>
<style>body{font:13pt/1.5 Georgia,serif;color:#111;max-width:720px;margin:24px auto;padding:0 16px}h1{font-size:20pt;margin:0}h2{font-size:14pt;margin:22px 0 6px;border-bottom:1px solid #999}
.m{color:#555;font:10pt sans-serif}.u{border:1px solid #7b1e2e;padding:8px 10px;font:10.5pt sans-serif;margin:12px 0}.l{margin:4px 0}.karar{border-left:3px solid #7b1e2e;padding-left:10px}</style></head>
<body><h1>${esc(t("Celse · Duruşmayı izle"))}</h1><div class="m">${esc(t(alanAdi(d.alan)))} · ${esc(new Date(d.created_at).toLocaleDateString(locale()))}</div>
<div class="u">${esc(t(UYARI_KISA))}</div><h2>${esc(t("Olay özeti"))}</h2><p>${esc(s.ozet || d.olay)}</p>${sahne}
<div class="u">${esc(s.uyari || t(UYARI_KISA))}</div></body></html>`;
}
