// Gerçekçi sahne: salon fotoğrafı üzerine fotoğraf karakterler. Çizim sahnesiyle (Stage) aynı arayüzü kullanır.
// Karakterler davanın kadrosundan seçilir: rol (hâkim, savcı, avukat, müvekkil), salon ve tahmini cinsiyete göre
// havuzdan, dava kimliğine bağlı olarak hep aynı kişi gelir; bir davada aynı yüz iki kez kullanılmaz.
import React, { useMemo, useState } from "react";
import { Image, LayoutChangeEvent, Platform, StyleSheet, Text, View } from "react-native";
import { currentAccount } from "../data/account";
import { CaseFile, Look, Scene } from "../engine/types";
import { PhotoKey, PHOTOS } from "./photos";
import { C, F } from "./theme";

interface Props { c: CaseFile; scene: Scene; focus: string | null; talking: boolean }

type Pool = { f: PhotoKey[]; m: PhotoKey[] };
const JUDGE: Pool = { f: ["hk-kadin-55", "hk-kadin-45", "hk-kadin-32"], m: ["hk-erkek-58", "hk-erkek-42", "hk-erkek-65"] };
const PROS: Pool = { f: ["sv-kadin"], m: ["sv-erkek"] };
const LAWYER: Pool = { f: ["av-kadin-32", "av-kadin-52", "av-kadin-25", "av-kadin-basortulu"], m: ["av-erkek-38", "av-erkek-58", "av-erkek-25"] };
const CIVIL: Pool = { f: ["mv-kadin-45", "mv-kadin-25", "mv-kadin-62", "mv-kadin-72"], m: ["mv-erkek-55", "mv-erkek-22", "mv-erkek-is", "mv-erkek-isci"] };
const AIHM: Pool = { f: ["ul-kadin-aihm", "ul-kadin-aihm2"], m: ["ul-erkek-aihm", "ul-erkek-aihm2", "ul-erkek-aihm3"] };
const UCM: Pool = { f: ["ul-kadin-ucm", "ul-kadin-ucm2"], m: ["ul-erkek-ucm", "ul-erkek-ucm2"] };

const FEMALE = new Set(("ayşe fatma zeynep elif emine hatice merve selin derya esra gül nur seda özlem aslı burcu ebru pınar sevgi canan leyla melek nazlı sibel tuğba " +
  "yasemin gamze didem filiz hande ipek meltem nesrin sevim şule ülkü zehra gülay gülsüm hülya nermin sevda songül feride nilüfer dilek ayten hacer " +
  "esma büşra kübra sema şeyma tülay yeliz aylin ceren cansu damla ezgi gizem irem melis nazan oya pelin serap sinem tuba tülin aysel nurcan gönül " +
  "berna eda sevil şükran hilal neslihan sena ece buket duygu nihan mine nevin perihan saadet sultan şerife zübeyde ayla birsen figen gülşen hale " +
  "lale meryem müge nalan nihal reyhan rukiye saliha semra sevinç şenay türkan yıldız zerrin zuhal fadime gülten necla nuray tülin halide naciye").split(" "));

const firstName = (name?: string) => (name || "").replace(/^(Av\.|Dr\.|Prof\.)\s*/i, "").split(/[\s·]+/)[0]?.toLocaleLowerCase("tr") || "";
function isFemale(look?: Look, name?: string): boolean {
  if (FEMALE.has(firstName(name))) return true;
  if (look?.beard || look?.style === "bald") return false;
  return look?.style === "long" || look?.style === "bun";
}
const isOld = (look?: Look) => !!look?.hair && /^#(6b6b|9a9a|a0a0|8a8a|b0b0|c0c0|7a7a)/i.test(look.hair);

function hash(s: string) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Salon arka planı ve kürsü geometrisi (fotoğraf koordinatları 1280×716). */
type Bench = { seats: number[]; y: number; h: number };
const ROOM: Record<string, { bg: PhotoKey; bench: Bench; pros?: { x: number; y: number; h: number } }> = {
  yerel: { bg: "bg-yerel", bench: { seats: [520, 640, 760], y: 338, h: 165 }, pros: { x: 965, y: 362, h: 150 } },
  yuksek: { bg: "bg-yuksek", bench: { seats: [345, 485, 627, 787, 930], y: 372, h: 210 } },
  aym: { bg: "bg-aym", bench: { seats: [152, 210, 268, 326, 384, 442, 500, 558, 638, 716, 774, 832, 890, 948, 1006, 1064, 1124], y: 372, h: 118 } },
  uluslararasi: { bg: "bg-uluslararasi", bench: { seats: [90, 143, 196, 250, 303, 356, 410, 463, 527, 580, 634, 687, 741, 794, 847, 901, 940], y: 300, h: 100 } }
};

function roomOf(c: CaseFile) {
  if (c.room === "uluslararasi" || /İnsan Hakları|Uluslararası/.test(c.court)) return ROOM.uluslararasi;
  if (/Anayasa|Yüce Divan/.test(c.court)) return ROOM.aym;
  if (c.room === "yuksek") return ROOM.yuksek;
  return ROOM.yerel;
}

interface Fig { key: string; photo: PhotoKey; flip?: boolean; x: number; bottom: number; h: number; z: number; front?: boolean }

/** Davanın kadrosuna fotoğraf atar. Aynı dava her açılışta aynı kişileri gösterir. */
function cast(c: CaseFile) {
  const used = new Set<PhotoKey>();
  const pick = (pool: Pool, female: boolean, seed: string, old = false): PhotoKey => {
    const list = [...(female ? pool.f : pool.m), ...(female ? pool.m : pool.f)];
    const start = old ? 0 : hash(c.id + seed) % (female ? pool.f.length : pool.m.length);
    for (let i = 0; i < list.length; i++) {
      const k = list[(start + i) % list.length];
      if (!used.has(k)) { used.add(k); return k; }
    }
    return list[start % list.length];
  };
  const intl = c.room === "uluslararasi" || /İnsan Hakları|Uluslararası/.test(c.court);
  const judgePool = intl ? (/Ceza Mahkemesi/.test(c.court) ? UCM : AIHM) : JUDGE;
  const j = c.cast.judge;
  const map: Record<string, PhotoKey> = {};
  map.judge = pick(judgePool, isFemale(j?.look, j?.name), "judge", isOld(j?.look));
  for (const [role, m] of Object.entries(c.cast)) {
    if (role === "judge") continue;
    const robe = m.look?.kind !== "civil";
    const red = m.np === "red" || role === "pros" || role === "savci";
    const pool = !robe ? CIVIL : red ? (intl ? judgePool : PROS) : LAWYER;
    map[role] = pick(pool, isFemale(m.look, m.name), role, isOld(m.look));
  }
  // Tek kişilik davada oyuncunun kendisi: hesaptaki ada göre avukat fotoğrafı.
  if (c.mode === "solo") {
    const me = currentAccount()?.adSoyad;
    const f = FEMALE.has(firstName(me));
    map.p1 = used.has(f ? "av-kadin-32" : "av-erkek-38") ? pick(LAWYER, f, "me") : (f ? "av-kadin-32" : "av-erkek-38");
    used.add(map.p1);
  }
  return map;
}

export default function PhotoStage({ c, scene, focus }: Props) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const { w: W, h: H } = box;
  const duel = c.mode === "duel";
  const faces = useMemo(() => cast(c), [c.id]);
  const room = roomOf(c);
  const bg = scene === "office" ? PHOTOS["bg-buro"] : PHOTOS[room.bg];

  // Arka plan "kapla" ölçeği: sahneyi doldurur, taşan kenarlar kırpılır.
  const s = W && H ? Math.max(W / bg.w, H / bg.h) : 1;
  const ox = (W - bg.w * s) / 2, oy = (H - bg.h * s) / 2;
  const X = (x: number) => ox + x * s, Y = (y: number) => oy + y * s;

  const figs: Fig[] = [];
  if (W && scene === "court") {
    const n = Math.max(1, c.bench?.judges ?? 1);
    const seats = room.bench.seats;
    // Ortadaki n koltuk; koltuk sayısından fazla hâkim varsa eşit aralıkla yayılır.
    let xs: number[];
    if (room === ROOM.yerel && n === 1) xs = [640];
    else if (n <= seats.length) { const st = Math.floor((seats.length - n) / 2); xs = seats.slice(st, st + n); }
    else xs = Array.from({ length: n }, (_, i) => seats[0] + (seats[seats.length - 1] - seats[0]) * (i / (n - 1)));
    let sx = xs.map(X);
    const lo = W * 0.06, hi = W * 0.94;
    if (sx[0] < lo || sx[sx.length - 1] > hi) sx = xs.map((_, i) => (n === 1 ? W / 2 : lo + (hi - lo) * (i / (n - 1))));
    const pres = Math.floor(n / 2);
    const intlPool = /Ceza Mahkemesi/.test(c.court) ? UCM : AIHM;
    const judgePool: PhotoKey[] = /uluslararasi/.test(room.bg) ? [...intlPool.m, ...intlPool.f]
      : ["hk-erkek-58", "hk-kadin-45", "hk-erkek-42", "hk-kadin-32", "hk-erkek-65", "hk-kadin-55"];
    const others = judgePool.filter(k => k !== faces.judge);
    const crowd = n > 7 ? 0.82 : 1;
    let m = 0;
    sx.forEach((x, i) => {
      const isP = i === pres;
      const mi = isP ? 0 : m++;
      const k = isP ? faces.judge : others[mi % others.length];
      figs.push({ key: isP ? "judge" : `judge_${i}`, photo: k, flip: !isP && Math.floor(mi / others.length) % 2 === 1, x, bottom: H - Y(room.bench.y) - room.bench.h * s * 0.06, h: room.bench.h * s * (isP ? 1.06 : crowd), z: 1 });
    });
    if (!duel && n === 1 && c.courtCast?.includes("pros") && room.pros && faces.pros) {
      figs.push({ key: "pros", photo: faces.pros, x: X(room.pros.x), bottom: H - Y(room.pros.y), h: room.pros.h * s, z: 1 });
    }
    if (!duel && c.courtCast?.includes("client") && faces.client) figs.push({ key: "client", photo: faces.client, x: W * 0.5, bottom: 0, h: H * 0.5, z: 3, front: true });
    if (faces.p1 || duel) figs.push({ key: "p1", photo: faces.p1 || "av-erkek-38", x: W * 0.17, bottom: 0, h: H * 0.66, z: 4, front: true });
    const oppKey = duel ? "p2" : "opp";
    if ((duel || c.courtCast?.includes("opp")) && faces[oppKey]) figs.push({ key: oppKey, photo: faces[oppKey], flip: true, x: W * 0.83, bottom: 0, h: H * 0.66, z: 4, front: true });
  } else if (W) {
    if (duel) {
      figs.push({ key: "p1", photo: faces.p1 || "av-erkek-38", x: W * 0.25, bottom: 0, h: H * 0.72, z: 4, front: true });
      if (faces.p2) figs.push({ key: "p2", photo: faces.p2, flip: true, x: W * 0.75, bottom: 0, h: H * 0.72, z: 4, front: true });
    } else if (faces.client) {
      figs.push({ key: "client", photo: faces.client, x: W * 0.5, bottom: 0, h: H * 0.8, z: 2, front: true });
    }
  }

  const fig = (f: Fig) => {
    const p = PHOTOS[f.photo];
    const h = f.h, w = h * (p.w / p.h);
    const bench = f.key.startsWith("judge");
    const lit = focus === null || focus === f.key || (bench && focus === "judge") || bench;
    const speaking = focus !== null && (focus === f.key || (f.key === "judge" && focus === "judge"));
    return (
      <View key={f.key} pointerEvents="none" style={{ position: "absolute", left: f.x - w / 2, bottom: f.bottom, width: w, height: h, zIndex: f.z + (speaking ? 1 : 0) }}>
        <Image source={p.src} resizeMode="contain" accessibilityIgnoresInvertColors
          style={[{ width: w, height: h }, f.flip && { transform: [{ scaleX: -1 }] }, !lit && f.front && styles.dim]} />
      </View>
    );
  };

  return (
    <View style={styles.stage} onLayout={onLayout}>
      {W > 0 && (
        <>
          <Image source={bg.src} resizeMode="cover" style={{ position: "absolute", left: ox, top: oy, width: bg.w * s, height: bg.h * s }} />
          {figs.sort((a, b) => a.z - b.z).map(fig)}
          {scene === "court" && (
            <View style={styles.plaque} pointerEvents="none"><Text style={styles.plaqueText} numberOfLines={1}>{c.courtShort}</Text></View>
          )}
          <View style={styles.vignette} pointerEvents="none" />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, overflow: "hidden", backgroundColor: "#111", borderRadius: 10 },
  // Konuşmayan ön plan karakterleri saydamlaşmaz, kararır (arka plan içlerinden görünmesin).
  dim: (Platform.OS === "web" ? { filter: "brightness(0.5)" } : { filter: [{ brightness: 0.5 }] }) as any,
  plaque: { position: "absolute", top: 8, alignSelf: "center", backgroundColor: "rgba(20,16,10,0.62)", borderRadius: 4, paddingHorizontal: 10, paddingVertical: 3, maxWidth: "80%" },
  plaqueText: { fontFamily: F.display, fontSize: 12, letterSpacing: 2, color: C.brass },
  vignette: { position: "absolute", left: 0, right: 0, bottom: 0, height: 40, backgroundColor: "rgba(0,0,0,0.0)" }
});
