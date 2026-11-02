// Gerçekçi sahne: salon fotoğrafı üzerine fotoğraf karakterler. Çizim sahnesiyle (Stage) aynı arayüzü kullanır.
// Karakterler davanın kadrosundan seçilir: rol (hâkim, savcı, avukat, müvekkil), salon ve tahmini cinsiyete göre
// havuzdan, dava kimliğine bağlı olarak hep aynı kişi gelir; bir davada aynı yüz iki kez kullanılmaz.
import React, { useEffect, useMemo, useState } from "react";
import { Image, LayoutChangeEvent, Platform, StyleSheet, Text, View } from "react-native";
import { Avatar, useOffice } from "../data/office";
import { useCharacter } from "../data/character";
import { MOUTHS } from "./mouths";
import { firstName, FEMALE, isFemale, partiesOf, robeOf } from "./people";
import { currentAccount } from "../data/account";
import { CaseFile, Look, Scene } from "../engine/types";
import { PhotoKey, PHOTOS } from "./photos";
import { C, F } from "./theme";

/** Konuşulan satır: ağız kareleri metindeki seslere göre sıralanır. voice: satır seslendiriliyor mu. */
export interface Say { id: string; text: string; voice: boolean }
interface Props { c: CaseFile; scene: Scene; focus: string | null; talking: boolean; say?: Say }

type Pool = { f: PhotoKey[]; m: PhotoKey[] };
const JUDGE: Pool = { f: ["hk-kadin-55", "hk-kadin-45", "hk-kadin-32"], m: ["hk-erkek-58", "hk-erkek-42", "hk-erkek-65"] };
const PROS: Pool = { f: ["sv-kadin"], m: ["sv-erkek"] };
const LAWYER: Pool = { f: ["av-kadin-32", "av-kadin-52", "av-kadin-25", "av-kadin-basortulu", "av-kadin-41", "av-kadin-28", "av-kadin-61", "av-kadin-35"], m: ["av-erkek-38", "av-erkek-58", "av-erkek-25", "av-erkek-46", "av-erkek-32", "av-erkek-66", "av-erkek-27"] };
const CIVIL: Pool = { f: ["mv-kadin-45", "mv-kadin-25", "mv-kadin-62", "mv-kadin-72"], m: ["mv-erkek-55", "mv-erkek-22", "mv-erkek-is", "mv-erkek-isci"] };
const AIHM: Pool = { f: ["ul-kadin-aihm", "ul-kadin-aihm2"], m: ["ul-erkek-aihm", "ul-erkek-aihm2", "ul-erkek-aihm3"] };
/** Tahkimde avukatlar cübbe giymez: takım elbiseli vekiller. */
const COUNSEL: Pool = { f: ["ks-kadin-38"], m: ["ks-erkek-40", "mv-erkek-is"] };
/** Hakemler (takım elbiseli): milletlerarası ve Türk. */
const ARB_INTL: Pool = { f: ["ar-kadin-50"], m: ["ar-erkek-62", "ar-erkek-48"] };
const ARB_TR: Pool = { f: ["ar-tr-kadin-44"], m: ["ar-tr-erkek-56"] };
const UCM: Pool = { f: ["ul-kadin-ucm", "ul-kadin-ucm2"], m: ["ul-erkek-ucm", "ul-erkek-ucm2"] };

const isOld = (look?: Look) => !!look?.hair && /^#(6b6b|9a9a|a0a0|8a8a|b0b0|c0c0|7a7a)/i.test(look.hair);

function hash(s: string) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Salon arka planı ve kürsü geometrisi (fotoğraf koordinatları 1280×716). */
type Bench = { seats: number[]; y: number; h: number };
const ROOM: Record<string, { bg: PhotoKey; bench: Bench; pros?: { x: number; y: number; h: number } }> = {
  yerel: { bg: "bg-yerel", bench: { seats: [520, 640, 760], y: 338, h: 165 }, pros: { x: 965, y: 362, h: 150 } },
  yuksek: { bg: "bg-yuksek", bench: { seats: [345, 485, 627, 787, 930], y: 372, h: 210 } },
  aym: { bg: "bg-aym", bench: { seats: [152, 210, 268, 326, 384, 442, 500, 558, 638, 716, 774, 832, 890, 948, 1006, 1064, 1124], y: 372, h: 118 } },
  tahkim: { bg: "bg-tahkim", bench: { seats: [490, 642, 795], y: 347, h: 150 } },
  komisyon: { bg: "bg-komisyon", bench: { seats: [485, 645, 805], y: 305, h: 140 } },
  uluslararasi: { bg: "bg-uluslararasi", bench: { seats: [90, 143, 196, 250, 303, 356, 410, 463, 527, 580, 634, 687, 741, 794, 847, 901, 940], y: 300, h: 100 } }
};

/** Türkiye'deki kurullar ve komisyonlar (TFF Tahkim Kurulu, İHTK, Sigorta Tahkim) Ankara'daki toplantı salonunda görülür. */
const domesticForum = (c: CaseFile) => c.forum === "tff" || c.forum === "ihtk" || c.forum === "sigorta";
/** Tahkim bölümündeki bazı dosyalar devlet mahkemesinde görülür (iptal davası, tanıma-tenfiz): onlar adliye salonunda. */
export const stateCourt = (c: CaseFile) => c.room === "tahkim" && /Asliye|Bölge Adliye|Yargıtay|Hukuk Dairesi|Ticaret Mahkemesi|Bölge İdare|İdare Mahkemesi/.test(c.court) && !/Tahkim|Komisyon|Kurul/.test(c.court);
function roomOf(c: CaseFile) {
  if (stateCourt(c)) return /Bölge|Yargıtay|Dairesi/.test(c.court) ? ROOM.yuksek : ROOM.yerel;
  if (c.room === "tahkim") return domesticForum(c) ? ROOM.komisyon : ROOM.tahkim;
  if (c.room === "uluslararasi" || /İnsan Hakları|Uluslararası/.test(c.court)) return ROOM.uluslararasi;
  if (/Anayasa|Yüce Divan/.test(c.court)) return ROOM.aym;
  if (c.room === "yuksek") return ROOM.yuksek;
  return ROOM.yerel;
}

/** Görüşme odası (bg-gorusme, 1280×716): masanın uzak kenarı ve müvekkilin yeri. */
const DESK = { edge: 467, clientX: 632, clientBottom: 520, clientH: 430 };
/** Yerel salonda zabıt kâtibinin masası (hâkimin önündeki bilgisayarlı masa, bg-yerel 1280×716). */
const KATIP_DESK = { x0: 470, x1: 800, top: 413, bottom: 492, sitX: 640, top0: 318, h: 150 };
/** Kâtibin önündeki ekran (arkası bize dönük); başı ekranın üstünden görünür. */
const SCREEN = { x0: 606, x1: 674, top: 376, bottom: 410, standW: 12, baseW: 46 };
/** Ön plandaki tek kişi (sanık, tanık, müvekkil, mübaşir) kâtibin yüzünü örtmesin: başı bu çizginin altında kalır. */
const FRONT_TOP = 418;
/** Yüksek mahkeme salonu (bg-yuksek): sağdaki zabıt masası ve ekranı. Kâtip ekranın arkasında oturur; savcı, heyette boş koltuk
 *  kalmazsa masanın solunda oturur. Masa önü ve ekran, bu kişilerin üstüne arka plandan yeniden çizilir. */
const YK = { deskTop: 412, katipX: 1126, prosDeskX: 1040, h: 172, cover: [{ x0: 1084, x1: 1170, top: 362, bottom: 414 }, { x0: 990, x1: 1262, top: 410, bottom: 500 }] };
/** Telefonda (dar sahnede) salonun en az bu kadarı (fotoğraf pikseli) görünür: savcı ve kâtip kadrajda kalır, karakterler küçülür. */
const MIN_VIEW = 1060;

/** Mahkemeye göre değişen mübaşir ve kâtip yüzleri. */
const MUBASIR = ["mubasir", "mubasir-kadin", "mubasir-genc", "mubasir-yasli"] as const;
const KATIP = ["katip", "katip-erkek", "katip-kadin-45", "katip-erkek-45"] as const;

export function tintJudge(k: PhotoKey, robe: string): PhotoKey {
  const t = `${k}${robe}`;
  return robe && /^hk-/.test(k) && t in PHOTOS ? (t as PhotoKey) : k;
}

interface Fig { key: string; photo: PhotoKey; flip?: boolean; x: number; bottom: number; h: number; z: number; front?: boolean }

/** Davanın kadrosuna fotoğraf atar. Aynı dava her açılışta aynı kişileri gösterir. */
export function cast(c: CaseFile, avatar?: Avatar | null) {
  const used = new Set<PhotoKey>(avatar ? [avatar] : []);
  const pick = (pool: Pool, female: boolean, seed: string, old = false): PhotoKey => {
    const list = [...(female ? pool.f : pool.m), ...(female ? pool.m : pool.f)];
    const start = old ? 0 : hash(c.id + seed) % (female ? pool.f.length : pool.m.length);
    for (let i = 0; i < list.length; i++) {
      const k = list[(start + i) % list.length];
      if (!used.has(k)) { used.add(k); return k; }
    }
    return list[start % list.length];
  };
  const tahkim = c.room === "tahkim" && !stateCourt(c);
  const intl = !tahkim && (c.room === "uluslararasi" || /İnsan Hakları|Uluslararası/.test(c.court));
  const judgePool = tahkim ? (domesticForum(c) || c.forum === "istac" ? ARB_TR : ARB_INTL) : intl ? (/Ceza Mahkemesi/.test(c.court) ? UCM : AIHM) : JUDGE;
  const j = c.cast.judge;
  const map: Record<string, PhotoKey> = {};
  map.judge = tintJudge(pick(judgePool, isFemale(j?.look, j?.name), "judge", isOld(j?.look)), robeOf(c));
  for (const [role, m] of Object.entries(c.cast)) {
    if (role === "judge") continue;
    const robe = m.look?.kind !== "civil";
    const red = m.np === "red" || role === "pros" || role === "savci";
    const counsel = tahkim && (role === "p1" || role === "p2" || role === "opp");
    const pool = counsel ? { f: COUNSEL.f.filter(k => k in PHOTOS), m: COUNSEL.m.filter(k => k in PHOTOS) } as Pool : !robe ? CIVIL : red ? (intl ? judgePool : PROS) : LAWYER;
    map[role] = pick(pool, isFemale(m.look, m.name), role, isOld(m.look));
  }
  // Oyuncunun kendisi: büroda seçtiği karakter; seçmemişse hesaptaki ada göre bir avukat.
  if (!tahkim && (avatar || c.mode === "solo")) {
    const f = FEMALE.has(firstName(currentAccount()?.adSoyad));
    const mine: PhotoKey = avatar || (f ? "av-kadin-32" : "av-erkek-38");
    // Karşı tarafın avukatı oyuncunun yüzünü taşıyorsa ona başka bir yüz ver.
    for (const [r, k] of Object.entries(map)) if (k === mine && r !== "p1") { used.delete(k); used.add(mine); map[r] = pick(LAWYER, k.includes("kadin"), r + "2"); }
    map.p1 = mine;
    used.add(mine);
  }
  // Taraf teşkili: kadroda karşılığı olmayan taraf (ör. karşı tarafın kendisi) için de bir yüz seçilir.
  const pr = partiesOf(c);
  // Şirket ya da kulüp tarafı takım elbiseli bir yetkiliyle temsil edilir.
  const corp = (k: string) => k.startsWith("party_") && /şirket|sigorta|a\.ş|kulüp|üretici|tedarikçi|satıcı|alıcı|işveren|yüklenici|armatör|kiracı \(|distribütör|lisans|havuz/i.test(c.sides[k === "party_p1" ? "p1" : "p2"].role);
  const SUIT: Pool = { f: ["ks-kadin-38", "mv-kadin-45"].filter(k => k in PHOTOS) as PhotoKey[], m: ["mv-erkek-is", "ks-erkek-40", "mv-erkek-55"].filter(k => k in PHOTOS) as PhotoKey[] };
  for (const k of [pr.left, pr.right]) if (k && !map[k]) map[k] = pick(corp(k) ? SUIT : CIVIL, hash(c.id + k) % 2 === 0, k);
  // Mübaşir ve kâtip dosyanın mahkemesine göre seçilir: aynı mahkemede hep aynı kişiler, başka mahkemede başkaları.
  const pool = <T extends readonly string[]>(arr: T) => arr.filter(k => k in PHOTOS) as unknown as PhotoKey[];
  const mubs = pool(MUBASIR), kats = pool(KATIP);
  if (mubs.length) map.mubasir = mubs[hash(c.court + "mub") % mubs.length];
  if (kats.length) map.katip = kats[hash(c.court + "kat") % kats.length];
  return map;
}

/** Ağız kareleri: 0 kapalı, 1 açık ("a"), 2 yuvarlak ("o, u"), 3 yayvan ("e, i"), 4 yarı açık (ünsüzler). */
export function visemes(text: string): number[] {
  const out: number[] = [];
  for (const ch of text.toLocaleLowerCase("tr")) {
    if ("aâı".includes(ch)) out.push(1);
    else if ("oöuüû".includes(ch)) out.push(2);
    else if ("eiîé".includes(ch)) out.push(3);
    else if ("mbpv".includes(ch)) out.push(0);
    else if (/[.,;:!?…]/.test(ch)) out.push(0, 0, 0);
    else if (/\s/.test(ch)) out.push(0);
    else if (/[a-zçğşıöü0-9]/.test(ch)) out.push(4);
  }
  return out;
}

/** Konuşma süresine orantılı ağız hareketi: satırın harfleri konuşma hızında sırayla kareye dönüşür.
 *  Seslendirme açıkken ses sürdükçe (gerekirse başa dönerek), kapalıyken metnin okunma süresince oynar. */
function useMouthFrame(on: boolean, say?: Say) {
  const [f, setF] = useState(0);
  useEffect(() => {
    if (!on || !say) { setF(0); return; }
    const seq = visemes(say.text);
    if (!seq.length) { setF(0); return; }
    const per = say.voice ? 66 : 58;
    const t0 = Date.now();
    const t = setInterval(() => {
      let i = Math.floor((Date.now() - t0) / per);
      if (i >= seq.length) { if (!say.voice) { setF(0); clearInterval(t); return; } i = i % seq.length; }
      setF(seq[i]);
    }, 40);
    return () => clearInterval(t);
  }, [on, say?.id, say?.voice]);
  return f;
}

export default function PhotoStage({ c, scene, focus, talking, say }: Props) {
  const { office } = useOffice();
  const mouth = useMouthFrame(talking && focus !== null && focus !== "narr", say);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  // Geniş ve basık ekranlarda (bilgisayar) sahne en fazla 2,1:1 oranında çizilir ve ortalanır; yoksa arka plan
  // yukarıdan ve aşağıdan çok kırpılır, hâkimin başı kesilir.
  const { w: W0, h: H } = box;
  const W = Math.min(W0, Math.round(H * 2.1));
  const duel = c.mode === "duel";
  const me = useCharacter();
  const faces = useMemo(() => cast(c, office?.avatar || me?.avatar), [c.id, office?.avatar, me?.avatar]);
  const room = roomOf(c);
  const parties = useMemo(() => partiesOf(c), [c.id]);
  // Büro görüşmesi: avukatın koltuğundan bakış; müvekkil masanın karşısındaki koltukta oturur.
  const bg = scene === "office" ? PHOTOS["bg-gorusme"] : PHOTOS[room.bg];

  // Arka plan "kapla" ölçeği: sahneyi doldurur, taşan kenarlar kırpılır.
  // Duruşma salonu dar ekranda kırpılmaz, daraltılır: fotoğraf alta yaslanır, üstte kalan şerit duvarın uzantısıyla doldurulur.
  const s = W && H ? Math.max(W / bg.w, scene === "court" ? Math.min(H / bg.h, W / MIN_VIEW) : H / bg.h) : 1;
  /** Ön plandaki kişilerin ölçü birimi: sahne yüksekliği ya da (daraltılmış salonda) fotoğrafın görünen yüksekliği. */
  const U = Math.min(H, bg.h * s);
  // Kırpma gerekiyorsa üstten az, alttan çok kırpılır (kürsü ve başlar görünür kalsın; alt kısım zemin).
  const ox = (W - bg.w * s) / 2, oy = bg.h * s > H ? (H - bg.h * s) * 0.3 : H - bg.h * s;
  const X = (x: number) => ox + x * s, Y = (y: number) => oy + y * s;

  const figs: Fig[] = [];
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
    const arbPool: string[] = domesticForum(c) ? ["ar-tr-erkek-56", "ar-tr-kadin-44", "ar-tr-erkek-40", "ar-erkek-62"] : c.forum === "istac" ? ["ar-tr-erkek-56", "ar-kadin-50", "ar-erkek-48", "ar-tr-kadin-44"] : ["ar-erkek-62", "ar-kadin-50", "ar-erkek-48", "ar-tr-erkek-56"];
    const judgePool: PhotoKey[] = c.room === "tahkim" && !stateCourt(c) ? (arbPool.filter(k => k in PHOTOS) as PhotoKey[]) : /uluslararasi/.test(room.bg) ? [...intlPool.m, ...intlPool.f]
      : (["hk-erkek-58", "hk-kadin-45", "hk-erkek-42", "hk-kadin-32", "hk-erkek-65", "hk-kadin-55"] as PhotoKey[]).map(k => tintJudge(k, robeOf(c)));
    const others = judgePool.filter(k => k !== faces.judge);
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
    }
    // Yüksek mahkeme salonunda kâtip, sağdaki zabıt masasında ekranın arkasında oturur.
    if (room === ROOM.yuksek && faces.katip) {
      const kh = YK.h * s;
      figs.push({ key: "katip", photo: faces.katip, x: X(YK.katipX), bottom: H - Y(YK.deskTop) - kh * 0.37, h: kh, z: 1 });
    }
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
    if (duel) {
      figs.push({ key: "p1", photo: faces.p1 || "av-erkek-38", x: W * 0.25, bottom: 0, h: H * 0.72, z: 4, front: true });
      if (faces.p2) figs.push({ key: "p2", photo: faces.p2, flip: true, x: W * 0.75, bottom: 0, h: H * 0.72, z: 4, front: true });
    } else if (faces.client) {
      // Koltuğun önünde, belinden aşağısı masanın arkasında kalacak biçimde (masa ön katmanı ayrıca çizilir).
      const ch = DESK.clientH * s;
      figs.push({ key: "client", photo: faces.client, x: X(DESK.clientX), bottom: H - Y(DESK.clientBottom), h: ch, z: 2, front: true });
    }
  }

  const fig = (f: Fig) => {
    const p = PHOTOS[f.photo];
    const h = f.h, w = h * (p.w / p.h);
    const bench = f.key.startsWith("judge");
    const lit = focus === null || focus === f.key || (bench && focus === "judge") || bench;
    const speaking = focus !== null && (focus === f.key || (f.key === "judge" && focus === "judge"));
    const m = speaking && mouth ? MOUTHS[f.photo] : undefined;
    return (
      <View key={f.key} pointerEvents="none" style={[{ position: "absolute", left: f.x - w / 2, bottom: f.bottom, width: w, height: h, zIndex: f.z + (speaking ? 1 : 0) }, f.flip && { transform: [{ scaleX: -1 }] }]}>
        <Image source={p.src} resizeMode="contain" accessibilityIgnoresInvertColors
          style={[{ width: w, height: h }, !lit && f.front && Platform.OS === "web" && styles.dim]} />
        {/* Telefonda karartma: aynı görselin siyaha boyanmış kopyası üstüne yarı saydam konur (saydam kenarlar korunur;
            iOS'taki "filter" karakterin çevresini gri bir kare olarak gösteriyordu). */}
        {!lit && f.front && Platform.OS !== "web" && (
          <Image source={p.src} resizeMode="contain" style={{ position: "absolute", left: 0, top: 0, width: w, height: h, tintColor: "#000", opacity: 0.5 }} />
        )}
        {m && (m.a || m.o) && (() => {
          // 1: açık, 2: yuvarlak, 3: yayvan (açık kare dikeyde basık), 4: yarı açık (açık kare yarı saydam).
          const src = mouth === 2 ? m.o || m.a : m.a || m.o;
          const extra = mouth === 3 ? { transform: [{ scaleY: 0.62 }, { scaleX: 1.06 }] } : mouth === 4 ? { opacity: 0.55 } : null;
          return <Image source={src} resizeMode="stretch"
            style={[{ position: "absolute", left: m.x * w, top: m.y * h, width: m.w * w, height: m.h * h }, extra]} />;
        })()}
      </View>
    );
  };

  return (
    <View style={styles.outer} onLayout={onLayout}>
     <View style={[styles.stage, W0 > W && { position: "absolute", top: 0, bottom: 0, left: (W0 - W) / 2, width: W }]}>
      {W > 0 && (
        <>
          {oy > 0 && (
            // Daraltılmış salonda üstte kalan şerit: fotoğrafın üst kenarı dikeyde uzatılır (duvar ve tavan devam eder).
            <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: oy + 1, overflow: "hidden" }}>
              <Image source={bg.src} resizeMode="stretch" style={{ position: "absolute", left: ox, top: 0, width: bg.w * s, height: (oy + 1) / 0.06 }} />
              <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.35)" }} />
            </View>
          )}
          <Image source={bg.src} resizeMode="cover" style={{ position: "absolute", left: ox, top: oy, width: bg.w * s, height: bg.h * s }} />
          {figs.sort((a, b) => a.z - b.z).map(fig)}
          {scene === "court" && room === ROOM.yerel && faces.katip && (
            <View pointerEvents="none" style={{ position: "absolute", left: X(KATIP_DESK.x0), width: (KATIP_DESK.x1 - KATIP_DESK.x0) * s, top: Y(KATIP_DESK.top), height: (KATIP_DESK.bottom - KATIP_DESK.top) * s, overflow: "hidden", zIndex: 2 }}>
              <Image source={bg.src} resizeMode="cover" style={{ position: "absolute", left: ox - X(KATIP_DESK.x0), top: oy - Y(KATIP_DESK.top), width: bg.w * s, height: bg.h * s }} />
            </View>
          )}
          {scene === "court" && room === ROOM.yerel && faces.katip && (
            // Kâtibin bilgisayar ekranı: arkası bize dönük; ayağı masaya oturur.
            <View pointerEvents="none" style={{ position: "absolute", left: X(SCREEN.x0), width: (SCREEN.x1 - SCREEN.x0) * s, top: Y(SCREEN.top), height: (KATIP_DESK.top + 3 - SCREEN.top) * s, zIndex: 2, alignItems: "center" }}>
              <View style={[styles.screen, { width: "100%", height: (SCREEN.bottom - SCREEN.top) * s, borderRadius: 3 * s }]} />
              <View style={[styles.stand, { width: SCREEN.standW * s, flex: 1 }]} />
              <View style={[styles.stand, { width: SCREEN.baseW * s, height: 2.5 * s, borderRadius: 2 * s }]} />
            </View>
          )}
          {scene === "court" && room === ROOM.yuksek && YK.cover.map((r, i) => (
            // Zabıt masasının önü ve ekranı, kâtip ile savcının üstüne yeniden çizilir.
            <View key={"yk" + i} pointerEvents="none" style={{ position: "absolute", left: X(r.x0), width: (r.x1 - r.x0) * s, top: Y(r.top), height: (r.bottom - r.top) * s, overflow: "hidden", zIndex: 2 }}>
              <Image source={bg.src} resizeMode="cover" style={{ position: "absolute", left: ox - X(r.x0), top: oy - Y(r.top), width: bg.w * s, height: bg.h * s }} />
            </View>
          ))}
          {scene === "office" && !duel && (
            // Masa ön katmanı: arka planın masa kısmı, müvekkilin belinin üstüne yeniden çizilir.
            <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: Y(DESK.edge), bottom: 0, overflow: "hidden", zIndex: 5 }}>
              <Image source={bg.src} resizeMode="cover" style={{ position: "absolute", left: ox, top: oy - Y(DESK.edge), width: bg.w * s, height: bg.h * s }} />
            </View>
          )}
          {scene === "court" && (
            <View style={styles.plaque} pointerEvents="none"><Text style={styles.plaqueText} numberOfLines={1}>{c.courtShort}</Text></View>
          )}
          <View style={styles.vignette} pointerEvents="none" />
        </>
      )}
     </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1 },
  stage: { flex: 1, overflow: "hidden", backgroundColor: "#111", borderRadius: 10 },
  // Konuşmayan ön plan karakterleri saydamlaşmaz, kararır (arka plan içlerinden görünmesin).
  dim: (Platform.OS === "web" ? { filter: "brightness(0.5)" } : { filter: [{ brightness: 0.5 }] }) as any,
  screen: { backgroundColor: "#16171a", borderWidth: 1, borderColor: "#34363c", borderBottomColor: "#0b0b0c" },
  stand: { backgroundColor: "#24262b" },
  plaque: { position: "absolute", top: 8, alignSelf: "center", backgroundColor: "rgba(20,16,10,0.62)", borderRadius: 4, paddingHorizontal: 10, paddingVertical: 3, maxWidth: "80%" },
  plaqueText: { fontFamily: F.display, fontSize: 12, letterSpacing: 2, color: C.brass },
  vignette: { position: "absolute", left: 0, right: 0, bottom: 0, height: 40, backgroundColor: "rgba(0,0,0,0.0)" }
});
