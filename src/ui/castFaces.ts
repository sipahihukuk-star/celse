// Davanın kadrosuna fotoğraf yüzü atar (react-native yüklemez; denetim aracı da kullanır).
import type { Avatar } from "../data/office";
import { CaseFile, Look } from "../engine/types";
import { isFemale, partiesOf, robeOf } from "./people";
import { castHints, nameGender } from "./castText";
import { PhotoKey, PHOTOS } from "./photos";

export type Pool = { f: PhotoKey[]; m: PhotoKey[] };
export const JUDGE: Pool = { f: ["hk-kadin-55", "hk-kadin-45", "hk-kadin-32"], m: ["hk-erkek-58", "hk-erkek-42", "hk-erkek-65"] };
export const PROS: Pool = { f: ["sv-kadin"], m: ["sv-erkek"] };
export const LAWYER: Pool = { f: ["av-kadin-32", "av-kadin-52", "av-kadin-25", "av-kadin-basortulu", "av-kadin-41", "av-kadin-28", "av-kadin-61", "av-kadin-35"], m: ["av-erkek-38", "av-erkek-58", "av-erkek-25", "av-erkek-46", "av-erkek-32", "av-erkek-66", "av-erkek-27"] };
export const CIVIL: Pool = { f: ["mv-kadin-45", "mv-kadin-25", "mv-kadin-62", "mv-kadin-72"], m: ["mv-erkek-55", "mv-erkek-22", "mv-erkek-is", "mv-erkek-isci"] };
export const AIHM: Pool = { f: ["ul-kadin-aihm", "ul-kadin-aihm2"], m: ["ul-erkek-aihm", "ul-erkek-aihm2", "ul-erkek-aihm3"] };
/** Tahkimde avukatlar cübbe giymez: takım elbiseli vekiller. */
export const COUNSEL: Pool = { f: ["ks-kadin-38"], m: ["ks-erkek-40", "mv-erkek-is"] };
/** Hakemler (takım elbiseli): milletlerarası ve Türk. */
export const ARB_INTL: Pool = { f: ["ar-kadin-50"], m: ["ar-erkek-62", "ar-erkek-48"] };
export const ARB_TR: Pool = { f: ["ar-tr-kadin-44"], m: ["ar-tr-erkek-56"] };
export const UCM: Pool = { f: ["ul-kadin-ucm", "ul-kadin-ucm2"], m: ["ul-erkek-ucm", "ul-erkek-ucm2"] };

/** Adında yaş yazmayan yüzlerin görünen yaşı (fotoğraflara bakılarak tahmin edildi). */
const FACE_AGE: Partial<Record<PhotoKey, number>> = {
  "sv-erkek": 42, "sv-kadin": 40, "mv-erkek-is": 55, "mv-erkek-isci": 36, "mv-erkek-55": 58, "mv-kadin-45": 40,
  "av-kadin-basortulu": 30, "ks-erkek-40": 38, "ks-kadin-38": 35,
  "ul-erkek-aihm": 65, "ul-erkek-aihm2": 50, "ul-erkek-aihm3": 60, "ul-kadin-aihm": 60, "ul-kadin-aihm2": 45,
  "ul-erkek-ucm": 55, "ul-erkek-ucm2": 50, "ul-kadin-ucm": 42, "ul-kadin-ucm2": 65,
  mubasir: 45, "mubasir-kadin": 40, "mubasir-genc": 27, "mubasir-yasli": 62, katip: 30, "katip-erkek": 30
};
/** Yüzün yaşı: tablodan ya da adındaki sayıdan (hk-kadin-55, av-erkek-28-gozluk). */
export function faceAge(k?: string): number | undefined {
  if (!k) return undefined;
  const base = k.replace(/-(yesil|gri)$/, "") as PhotoKey;
  return FACE_AGE[base] ?? (base.match(/-(\d{2})(?:-|$)/) ? +base.match(/-(\d{2})(?:-|$)/)![1] : undefined);
}
export const faceFemale = (k?: string) => !!k && /kadin/.test(k);

export const isOld = (look?: Look) => !!look?.hair && /^#(6b6b|9a9a|a0a0|8a8a|b0b0|c0c0|7a7a)/i.test(look.hair);

export function hash(s: string) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Türkiye'deki kurullar ve komisyonlar (TFF Tahkim Kurulu, İHTK, Sigorta Tahkim) Ankara'daki toplantı salonunda görülür. */
export const domesticForum = (c: CaseFile) => c.forum === "tff" || c.forum === "ihtk" || c.forum === "sigorta";
/** Tahkim bölümündeki bazı dosyalar devlet mahkemesinde görülür (iptal davası, tanıma-tenfiz): onlar adliye salonunda. */
export const stateCourt = (c: CaseFile) => c.room === "tahkim" && /Asliye|Bölge Adliye|Yargıtay|Hukuk Dairesi|Ticaret Mahkemesi|Bölge İdare|İdare Mahkemesi/.test(c.court) && !/Tahkim|Komisyon|Kurul/.test(c.court);

export function tintJudge(k: PhotoKey, robe: string): PhotoKey {
  const t = `${k}${robe}`;
  return robe && /^hk-/.test(k) && t in PHOTOS ? (t as PhotoKey) : k;
}

/** Mahkemeye göre değişen mübaşir ve kâtip yüzleri. */
const MUBASIR = ["mubasir", "mubasir-kadin", "mubasir-genc", "mubasir-yasli"] as const;
const KATIP = ["katip", "katip-erkek", "katip-kadin-45", "katip-erkek-45"] as const;

/** Davanın kadrosuna fotoğraf atar. Aynı dava her açılışta aynı kişileri gösterir.
 *  accountFemale: oyuncu karakter seçmemişse hesaptaki adın kadın adı olup olmadığı.
 *
 *  Cinsiyet: (1) kadrodaki ad ("Derya Kaya" → kadın) — isim plakasında ve metinde hep görünür, en güvenilir kaynaktır;
 *  (2) metindeki hitaplar ("Savcı Hanım", "Hâkim Bey", "kadın tanık") — okuyucunun gördüğü sözdür, adı olmayan rollerde
 *  (savcı, hâkim, tanık) yüz buna uyar; (3) görünüş tarifi (sakal, saç biçimi) — çizim sahnesi için yazılmıştır, kısa saç
 *  "erkek" sayıldığından en zayıf kaynaktır. Ad ile hitap çelişirse metin hatasıdır (tools/tutarlilik.ts raporlar).
 *  Yaş: metinde yazan yaş ("22 yaşında", "genç", "yaşlı") ya da kır saç; varsa havuzdaki en yakın yaştaki yüz seçilir. */
export function castFaces(c: CaseFile, avatar?: Avatar | null, accountFemale = false) {
  const used = new Set<PhotoKey>(avatar ? [avatar] : []);
  const hints = castHints(c);
  const femaleOf = (role: string) => {
    const m = c.cast[role];
    const ng = nameGender(m?.name) ?? hints[role]?.g;
    return ng ? ng === "f" : isFemale(m?.look, m?.name);
  };
  const ageOf = (role: string) => hints[role]?.age ?? (isOld(c.cast[role]?.look) ? 62 : undefined);
  const pick = (pool: Pool, female: boolean, seed: string, age?: number): PhotoKey => {
    const same = female ? pool.f : pool.m;
    if (age !== undefined) {
      // En yakın yaştaki boş yüz; eşit yakınlıkta dava kimliğine bağlı sabit bir sıra.
      const d = (k: PhotoKey) => Math.abs((faceAge(k) ?? 40) - age);
      const ranked = [...same].sort((a, b) => d(a) - d(b) || hash(c.id + seed + a) - hash(c.id + seed + b));
      for (const k of ranked) if (!used.has(k)) { used.add(k); return k; }
    }
    const list = [...same, ...(female ? pool.m : pool.f)];
    const start = hash(c.id + seed) % same.length;
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
  map.judge = tintJudge(pick(judgePool, j ? femaleOf("judge") : false, "judge", ageOf("judge")), robeOf(c));
  for (const [role, m] of Object.entries(c.cast)) {
    if (role === "judge") continue;
    const robe = m.look?.kind !== "civil";
    const red = m.np === "red" || role === "pros" || role === "savci";
    const counsel = tahkim && (role === "p1" || role === "p2" || role === "opp");
    const pool = counsel ? { f: COUNSEL.f.filter(k => k in PHOTOS), m: COUNSEL.m.filter(k => k in PHOTOS) } as Pool : !robe ? CIVIL : red ? (intl ? judgePool : PROS) : LAWYER;
    map[role] = pick(pool, femaleOf(role), role, ageOf(role));
  }
  // Oyuncunun kendisi: büroda seçtiği karakter; seçmemişse hesaptaki ada göre bir avukat.
  if (!tahkim && (avatar || c.mode === "solo")) {
    const mine: PhotoKey = avatar || (accountFemale ? "av-kadin-32" : "av-erkek-38");
    // Karşı tarafın avukatı oyuncunun yüzünü taşıyorsa ona başka bir yüz ver.
    for (const [r, k] of Object.entries(map)) if (k === mine && r !== "p1") { used.delete(k); used.add(mine); map[r] = pick(LAWYER, k.includes("kadin"), r + "2", ageOf(r)); }
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

/** Büroda konuşan ve büroda görünmesi gereken kişi (büro ortağı, müvekkilin yakını, şirket yetkilisi, karşılıklı modda müvekkil).
 *  Hâkim, karşı vekil ve savcının büro sahnesindeki satırları yazılı beyandır (dilekçe, görüş, ara karar); büroda çizilmez. */
export const writtenInOffice = (who: string) => /^(judge|opp|pros|savci|mubasir|katip)$/.test(who);
export function officeGuest(c: CaseFile, who: string): boolean {
  return who in c.cast && who !== "p1" && who !== "p2" && !writtenInOffice(who) && !(c.mode === "solo" && who === "client") && c.cast[who]?.np !== "red";
}

/** Konuşan kişi sahnede görünüyor mu (PhotoStage'in yerleşim kurallarıyla aynı; denetim aracı kullanır). */
export function speakerVisible(c: CaseFile, faces: Record<string, PhotoKey>, scene: "office" | "court", who: string): boolean {
  if (who === "narr") return true;
  if (scene === "court") return who === "p1" || !!faces[who];
  if (c.mode === "duel") return who === "p1" || who === "p2" || (officeGuest(c, who) && !!faces[who]);
  return who === "p1" || (who === "client" && !!faces.client) || (officeGuest(c, who) && !!faces[who]);
}
