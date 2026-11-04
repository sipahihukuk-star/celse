// Fotoğraflı sahnenin yerleşimi (react-native yüklemez): arka plan ölçeği, kişilerin yeri ve boyu, kişilerin üstüne yeniden
// çizilecek arka plan parçaları (masa önü, zabıt masası). Oyundaki sahne (PhotoStage) ve "Duruşmayı izle" videosu (izleVideo,
// <canvas>) aynı yerleşimi çizer; böylece danışma canlandırması oyunla birebir aynı görünür.
import { CaseFile, Scene } from "../engine/types";
import { arbBench, AIHM, domesticForum, stateCourt, tintJudge, UCM } from "./castFaces";
import { partiesOf, robeOf } from "./people";
import { PhotoKey, PHOTOS } from "./photos";

/** Salon arka planı ve kürsü geometrisi (fotoğraf koordinatları 1280×716). */
type Bench = { seats: number[]; y: number; h: number };
export const ROOM: Record<string, { bg: PhotoKey; bench: Bench; pros?: { x: number; y: number; h: number } }> = {
  yerel: { bg: "bg-yerel", bench: { seats: [520, 640, 760], y: 338, h: 165 }, pros: { x: 965, y: 362, h: 150 } },
  yuksek: { bg: "bg-yuksek", bench: { seats: [345, 485, 627, 787, 930], y: 372, h: 210 } },
  aym: { bg: "bg-aym", bench: { seats: [152, 210, 268, 326, 384, 442, 500, 558, 638, 716, 774, 832, 890, 948, 1006, 1064, 1124], y: 372, h: 118 } },
  tahkim: { bg: "bg-tahkim", bench: { seats: [490, 642, 795], y: 347, h: 150 } },
  komisyon: { bg: "bg-komisyon", bench: { seats: [485, 645, 805], y: 305, h: 140 } },
  uluslararasi: { bg: "bg-uluslararasi", bench: { seats: [90, 143, 196, 250, 303, 356, 410, 463, 527, 580, 634, 687, 741, 794, 847, 901, 940], y: 300, h: 100 } }
};

export function roomOf(c: CaseFile) {
  if (stateCourt(c)) return /Bölge|Yargıtay|Dairesi/.test(c.court) ? ROOM.yuksek : ROOM.yerel;
  if (c.room === "tahkim") return domesticForum(c) ? ROOM.komisyon : ROOM.tahkim;
  if (c.room === "uluslararasi" || /İnsan Hakları|Uluslararası/.test(c.court)) return ROOM.uluslararasi;
  if (/Anayasa|Yüce Divan/.test(c.court)) return ROOM.aym;
  if (c.room === "yuksek") return ROOM.yuksek;
  return ROOM.yerel;
}

/** Görüşme odası (bg-gorusme, 1280×716): masanın uzak kenarı ve müvekkilin yeri. */
export const DESK = { edge: 467, clientX: 632, clientBottom: 520, clientH: 430 };
/** Yerel salonda zabıt kâtibinin masası (hâkimin önündeki bilgisayarlı masa, bg-yerel 1280×716). */
export const KATIP_DESK = { x0: 470, x1: 800, top: 413, bottom: 492, sitX: 640, top0: 318, h: 150 };
/** Kâtibin önündeki ekran (arkası bize dönük); başı ekranın üstünden görünür. */
export const SCREEN = { x0: 606, x1: 674, top: 376, bottom: 410, standW: 12, baseW: 46 };
/** Ön plandaki tek kişi (sanık, tanık, müvekkil, mübaşir) kâtibin yüzünü örtmesin: başı bu çizginin altında kalır. */
const FRONT_TOP = 418;
/** Yüksek mahkeme salonu (bg-yuksek): sağdaki zabıt masası ve ekranı. Kâtip ekranın arkasında oturur; savcı, heyette boş koltuk
 *  kalmazsa masanın solunda oturur. Masa önü ve ekran, bu kişilerin üstüne arka plandan yeniden çizilir. */
const YK = { deskTop: 412, katipX: 1126, prosDeskX: 1040, h: 172, cover: [{ x0: 1084, x1: 1170, top: 362, bottom: 414 }, { x0: 990, x1: 1262, top: 410, bottom: 500 }] };
/** Telefonda (dar sahnede) salonun en az bu kadarı (fotoğraf pikseli) görünür: savcı ve kâtip kadrajda kalır, karakterler küçülür. */
export const MIN_VIEW = 1060;

export interface StageFig { key: string; photo: PhotoKey; flip?: boolean; x: number; bottom: number; h: number; z: number; front?: boolean }
/** Kişilerin üstüne arka plandan yeniden çizilen parça (fotoğraf koordinatlarında). */
export interface Cover { x0: number; x1: number; top: number; bottom: number; z: number }
export interface StageLayout {
  bg: PhotoKey; s: number; ox: number; oy: number; W: number; H: number;
  figs: StageFig[]; covers: Cover[];
  /** Yerel salonda kâtibin ekranı çizilir mi (SCREEN). */
  screen: boolean;
  /** Salonun üstündeki ad levhası (büroda yok). */
  plaque: string | null;
}

/** Konuşanın sahnede bulunduğu yer ve boyu. W×H: sahnenin piksel ölçüsü (en fazla 2,1:1).
 *  guest: büroda görünen öbür kişi (ilk konuştuğu satırdan itibaren). */
export function stageLayout(o: { c: CaseFile; scene: Scene; faces: Record<string, PhotoKey>; focus: string | null; guest: string | null; W: number; H: number }): StageLayout {
  const { c, scene, faces, focus, W, H } = o;
  const duel = c.mode === "duel";
  const room = roomOf(c);
  const parties = partiesOf(c);
  const bg = scene === "office" ? PHOTOS["bg-gorusme"] : PHOTOS[room.bg];
  const bgKey: PhotoKey = scene === "office" ? "bg-gorusme" : room.bg;
  // Arka plan "kapla" ölçeği: sahneyi doldurur, taşan kenarlar kırpılır.
  // Duruşma salonu dar ekranda kırpılmaz, daraltılır: fotoğraf alta yaslanır, üstte kalan şerit duvarın uzantısıyla doldurulur.
  const s = W && H ? Math.max(W / bg.w, scene === "court" ? Math.min(H / bg.h, W / MIN_VIEW) : H / bg.h) : 1;
  /** Ön plandaki kişilerin ölçü birimi: sahne yüksekliği ya da (daraltılmış salonda) fotoğrafın görünen yüksekliği. */
  const U = Math.min(H, bg.h * s);
  // Kırpma gerekiyorsa üstten az, alttan çok kırpılır (kürsü ve başlar görünür kalsın; alt kısım zemin).
  const ox = (W - bg.w * s) / 2, oy = bg.h * s > H ? (H - bg.h * s) * 0.3 : H - bg.h * s;
  const X = (x: number) => ox + x * s, Y = (y: number) => oy + y * s;

  const figs: StageFig[] = [];
  const covers: Cover[] = [];
  let screen = false;
  if (W && scene === "court") {
    const n = Math.max(1, c.bench?.judges ?? 1);
    const seats = room.bench.seats;
    // Ortadaki n koltuk; koltuk sayısından fazla hâkim varsa eşit aralıkla yayılır.
    let xs: number[];
    if (room === ROOM.yerel && n === 1) xs = [640];
    else if ((room === ROOM.tahkim || room === ROOM.komisyon) && n === 1) xs = [room.bench.seats[1]];
    else if (n <= seats.length) { const st = Math.floor((seats.length - n) / 2); xs = seats.slice(st, st + n); }
    else xs = Array.from({ length: n }, (_, i) => seats[0] + (seats[seats.length - 1] - seats[0]) * (i / (n - 1)));
    let sx = xs.map(X);
    const lo = W * 0.06, hi = W * 0.94;
    if (sx[0] < lo || sx[sx.length - 1] > hi) sx = xs.map((_, i) => (n === 1 ? W / 2 : lo + (hi - lo) * (i / (n - 1))));
    const pres = Math.floor(n / 2);
    const intlPool = /Ceza Mahkemesi/.test(c.court) ? UCM : AIHM;
    // Tahkimde heyetin öbür üyeleri castFaces'teki sırayla gelir (taraflara aynı yüz verilmesin diye orada ayrılır).
    const tahkim = c.room === "tahkim" && !stateCourt(c);
    const judgePool: PhotoKey[] = tahkim ? arbBench(c, faces.judge) : /uluslararasi/.test(room.bg) ? [...intlPool.m, ...intlPool.f]
      : (["hk-erkek-58", "hk-kadin-45", "hk-erkek-42", "hk-kadin-32", "hk-erkek-65", "hk-kadin-55"] as PhotoKey[]).map(k => tintJudge(k, robeOf(c)));
    const others = tahkim ? judgePool : judgePool.filter(k => k !== faces.judge);
    const crowd = n > 7 ? 0.82 : 1;
    let m = 0;
    sx.forEach((x, i) => {
      const isP = i === pres;
      const mi = isP ? 0 : m++;
      const k = isP ? faces.judge : others[mi % others.length];
      figs.push({ key: isP ? "judge" : `judge_${i}`, photo: k, flip: !isP && Math.floor(mi / others.length) % 2 === 1, x, bottom: H - Y(room.bench.y) - room.bench.h * s * 0.06, h: room.bench.h * s * (isP ? 1.06 : crowd), z: 1 });
    });
    // Zabıt kâtibi: hâkimin tam altında, bize dönük oturur; başı ekranın üstünden görünür. Hâkim kürsüsünün önünde olduğu için
    // hâkimin üstüne çizilir; masanın önü ve ekran ayrıca kâtibin üstüne çizilir.
    if (room === ROOM.yerel && faces.katip) {
      figs.push({ key: "katip", photo: faces.katip, x: X(KATIP_DESK.sitX), bottom: H - Y(KATIP_DESK.top0) - KATIP_DESK.h * s, h: KATIP_DESK.h * s, z: 2 });
      covers.push({ x0: KATIP_DESK.x0, x1: KATIP_DESK.x1, top: KATIP_DESK.top, bottom: KATIP_DESK.bottom, z: 2 });
      screen = true;
    }
    // Yüksek mahkeme salonunda kâtip, sağdaki zabıt masasında ekranın arkasında oturur.
    if (room === ROOM.yuksek && faces.katip) {
      const kh = YK.h * s;
      figs.push({ key: "katip", photo: faces.katip, x: X(YK.katipX), bottom: H - Y(YK.deskTop) - kh * 0.37, h: kh, z: 1 });
    }
    if (room === ROOM.yuksek) YK.cover.forEach(r => covers.push({ ...r, z: 2 }));
    const katipShown = room === ROOM.yerel && !!faces.katip;
    const below = (h: number) => (katipShown ? Math.min(0, H - Y(FRONT_TOP) - h) : 0);
    // Mübaşir yalnızca tarafları çağırırken öne çıkar.
    if (focus === "mubasir" && faces.mubasir) figs.push({ key: "mubasir", photo: faces.mubasir, x: W * 0.5, bottom: below(U * 0.62), h: U * 0.62, z: 6, front: true });
    // Savcı (ceza davaları, Danıştay savcısı): kürsüde heyetin sağında oturur. Yerel salonda kendi yeri var; yüksek mahkemede
    // heyetin yanındaki boş koltuk, o da yoksa zabıt masası.
    // Yüksek mahkemede karşı taraf savcıysa (Cumhuriyet, Yargıtay ya da Sayıştay savcısı) ayakta değil, kürsüde oturur.
    const oppIsPros = !duel && room === ROOM.yuksek && c.cast.opp?.np === "red" && !faces.pros && !faces.savci;
    const prosKey = faces.pros ? "pros" : faces.savci ? "savci" : oppIsPros && faces.opp ? "opp" : null;
    if (prosKey) {
      if (room === ROOM.yerel && room.pros) figs.push({ key: prosKey, photo: faces[prosKey], x: X(room.pros.x), bottom: H - Y(room.pros.y), h: room.pros.h * s, z: 1 });
      else if (room === ROOM.yuksek) {
        const last = xs[xs.length - 1], free = room.bench.seats.find(v => v > last + 60);
        if (free && n <= 4) figs.push({ key: prosKey, photo: faces[prosKey], x: X(free), bottom: H - Y(room.bench.y) - room.bench.h * s * 0.06, h: room.bench.h * s * 0.98, z: 1 });
        else { const ph0 = YK.h * s; figs.push({ key: prosKey, photo: faces[prosKey], x: X(YK.prosDeskX), bottom: H - Y(YK.deskTop) - ph0 * 0.37, h: ph0, z: 1 }); }
      }
    }
    // Taraf teşkili: her taraf kendi avukatının yanında, avukatın biraz gerisinde durur (kâtibin altında kalacak boyda).
    // Dar (telefon) sahnede avukatlar kenara açılır, taraflar biraz küçülüp ortaya yaklaşır; yüzleri görünür kalır.
    const t = Math.max(0, Math.min(1, (W / U - 1) / 0.8)), lerp = (a: number, b: number) => a + (b - a) * t;
    const LX = lerp(0.12, 0.17), PX = lerp(0.4, 0.36), ph = U * lerp(0.42, 0.52), lh = U * 0.66;
    if (parties.left && faces[parties.left]) figs.push({ key: parties.left, photo: faces[parties.left], x: W * PX, bottom: below(ph), h: ph, z: 3, front: true });
    if (parties.right && faces[parties.right]) figs.push({ key: parties.right, photo: faces[parties.right], flip: true, x: W * (1 - PX), bottom: below(ph), h: ph, z: 3, front: true });
    if (faces.p1 || duel) figs.push({ key: "p1", photo: faces.p1 || "av-erkek-38", x: W * LX, bottom: 0, h: lh, z: 4, front: true });
    const oppKey = duel ? "p2" : "opp";
    if ((duel || (c.courtCast?.includes("opp") && !oppIsPros)) && faces[oppKey]) figs.push({ key: oppKey, photo: faces[oppKey], flip: true, x: W * (1 - LX), bottom: 0, h: lh, z: 4, front: true });
    // Salonda yeri olmayan biri (tanık, bilirkişi, uzman) konuşurken ortaya, kürsünün önüne çıkar.
    if (focus && faces[focus] && !figs.some(f => f.key === focus) && !/^(judge|mubasir|katip|narr)/.test(focus))
      figs.push({ key: focus, photo: faces[focus], x: W * 0.5, bottom: below(U * 0.58), h: U * 0.58, z: 6, front: true });
  } else if (W) {
    const g = o.guest && faces[o.guest] ? o.guest : null;
    if (duel) {
      figs.push({ key: "p1", photo: faces.p1 || "av-erkek-38", x: W * 0.25, bottom: 0, h: H * 0.72, z: 4, front: true });
      if (faces.p2) figs.push({ key: "p2", photo: faces.p2, flip: true, x: W * 0.75, bottom: 0, h: H * 0.72, z: 4, front: true });
      if (g) figs.push({ key: g, photo: faces[g], x: W * 0.5, bottom: 0, h: H * 0.62, z: 3, front: true });
    } else {
      // Koltuğun önünde, belinden aşağısı masanın arkasında kalacak biçimde (masa ön katmanı ayrıca çizilir).
      const ch = DESK.clientH * s;
      if (faces.client) figs.push({ key: "client", photo: faces.client, x: X(DESK.clientX), bottom: H - Y(DESK.clientBottom), h: ch, z: 2, front: true });
      // Diğer konuşan kişi masanın solunda durur; müvekkil yoksa koltuğa oturur.
      if (g) figs.push({ key: g, photo: faces[g], flip: true, x: faces.client ? Math.max(X(DESK.clientX - 370), W * 0.17) : X(DESK.clientX), bottom: H - Y(DESK.clientBottom), h: ch, z: 2, front: true });
      // Masa ön katmanı: arka planın masa kısmı, müvekkilin belinin üstüne yeniden çizilir (sahnenin bütün genişliğince).
      covers.push({ x0: -ox / s, x1: (W - ox) / s, top: DESK.edge, bottom: Math.max(bg.h, (H - oy) / s), z: 5 });
    }
  }
  return { bg: bgKey, s, ox, oy, W, H, figs, covers, screen, plaque: scene === "court" ? c.courtShort : null };
}

/** Kişi konuşuyor mu, aydınlık mı (konuşmayan ön plan kişileri kararır; kürsü hep aydınlık). */
export function figState(f: StageFig, focus: string | null) {
  const bench = f.key.startsWith("judge");
  const speaking = focus !== null && (focus === f.key || (f.key === "judge" && focus === "judge"));
  const lit = focus === null || focus === f.key || bench || !f.front;
  return { speaking, lit };
}

/** Çizim sırası: önce z, eşit z'de önce kişiler sonra örtüler (ekrandaki zIndex ve belge sırasıyla aynı). Konuşan bir kat öne çıkar. */
export function drawOrder(L: StageLayout, focus: string | null): ({ k: "fig"; f: StageFig } | { k: "cover"; r: Cover })[] {
  const items = [
    ...[...L.figs].sort((a, b) => a.z - b.z).map(f => ({ k: "fig" as const, f, z: f.z + (figState(f, focus).speaking ? 1 : 0), o: 0 })),
    ...L.covers.map(r => ({ k: "cover" as const, r, z: r.z, o: 1 }))
  ];
  return items.map((x, i) => ({ x, i })).sort((a, b) => a.x.z - b.x.z || a.x.o - b.x.o || a.i - b.i)
    .map(({ x }) => (x.k === "fig" ? { k: "fig", f: x.f } : { k: "cover", r: x.r }));
}
