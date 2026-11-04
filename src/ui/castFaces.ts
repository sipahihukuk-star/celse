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
/** Sivil yüzler (müvekkil, sanık, tanık). mv-erkek-22 (kapüşonlu, kaygılı genç), mv-erkek-isci (iş ceketli), mv-erkek-55 (kareli
 *  gömlek, mont), mv-erkek-is (yakası açık gömlek, sert bakışlı), mv-kadin-25 (kazaklı genç), mv-kadin-72 (başörtülü yaşlı) gündelik
 *  ya da sert görünür: yalnız bu havuzda kalır, şirket ve tahkim rollerine (EXEC, COUNSEL) verilmez. */
export const CIVIL: Pool = { f: ["mv-kadin-45", "mv-kadin-25", "mv-kadin-62", "mv-kadin-72"], m: ["mv-erkek-55", "mv-erkek-22", "mv-erkek-is", "mv-erkek-isci"] };
export const AIHM: Pool = { f: ["ul-kadin-aihm", "ul-kadin-aihm2"], m: ["ul-erkek-aihm", "ul-erkek-aihm2", "ul-erkek-aihm3"] };
/** Hakemler (takım elbiseli): milletlerarası ve Türk. */
export const ARB_INTL: Pool = { f: ["ar-kadin-50"], m: ["ar-erkek-62", "ar-erkek-48"] };
export const ARB_TR: Pool = { f: ["ar-tr-kadin-44"], m: ["ar-tr-erkek-56"] };
/** Şirket yetkilisi, yönetici, ticari tahkimde taraf: takım elbiseli, derli toplu yüzler (vekiller ks-, hakem çekimleri ar-).
 *  Heyette oturan hakemlerin yüzleri dosyada ayrılır (arbBench), aynı kişi hem hakem hem taraf olmaz. */
export const EXEC: Pool = { f: ["ks-kadin-38", "ar-tr-kadin-44", "ar-kadin-50"], m: ["ks-erkek-40", "ar-tr-erkek-40", "ar-erkek-48", "ar-tr-erkek-56", "ar-erkek-62"] };
/** EXEC tükenirse aynı cinsiyetten yedek (gündelik ama derli toplu: bej palto, bluz). Erkekte yedek yok. */
const EXEC_SPARE: Pool = { f: ["mv-kadin-62"], m: [] };
/** Tahkimde avukatlar cübbe giymez: takım elbiseli vekiller (önce dosya tutan ks- yüzleri). */
export const COUNSEL: Pool = EXEC;
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

/** Tahkim heyetinin (başhakem dışındaki) üyeleri bu sırayla gelir (PhotoStage/stageLayout bu sırayı kullanır). */
export function arbBench(c: CaseFile, judge: PhotoKey | undefined): PhotoKey[] {
  const pool = domesticForum(c) ? ["ar-tr-erkek-56", "ar-tr-kadin-44", "ar-tr-erkek-40", "ar-erkek-62"] : c.forum === "istac" ? ["ar-tr-erkek-56", "ar-kadin-50", "ar-erkek-48", "ar-tr-kadin-44"] : ["ar-erkek-62", "ar-kadin-50", "ar-erkek-48", "ar-tr-erkek-56"];
  return (pool.filter(k => k in PHOTOS) as PhotoKey[]).filter(k => k !== judge);
}

/** Ticari tahkim (ICC, ISTAC, LCIA, UNCITRAL) ve CAS: taraflar ve kadrodaki sivil kişiler şirket ya da kurum adına gelir. */
export const commercialArb = (c: CaseFile) => c.room === "tahkim" && !stateCourt(c) && /^(icc|istac|lcia|uncitral|cas)$/.test(c.forum || "");
/** Kadrodaki kişinin şirket/kurum adına gelen biri olduğu (ad etiketinin tamamına bakılır; "Av.", "Dr." ünvanlı sivil kişiler de). */
export const CORP_ROLE = /şirket|müdür|direktör|genel sekreter|yetkili|başkan|müşavir|kurucu|yönetim kurulu|yönetici|\bcfo\b|\bceo\b|şefi|temsilci/i;
/** Taraf sıfatının (sides.role) şirket ya da kulüp olduğu. */
export const CORP_SIDE = /şirket|sigorta|banka|a\.ş|kulüp|üretici|tedarikçi|satıcı|alıcı|işveren|yüklenici|armatör|kiracı \(|distribütör|lisans|havuz/i;

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
  /** ordered: havuzun sırası önceliktir (ilk boş yüz); yoksa dava kimliğine bağlı bir yerden başlanır.
   *  spare: havuz tükenince, öbür cinsiyete geçmeden önce denenecek aynı cinsiyetten yedekler. Seçenek verilirse önce aynı
   *  cinsiyetin bütün boş yüzleri denenir (seçeneksiz çağrılar eski sırayı korur). */
  const pick = (pool: Pool, female: boolean, seed: string, age?: number, o?: { ordered?: boolean; spare?: Pool }): PhotoKey => {
    const same = female ? pool.f : pool.m;
    const take = (k: PhotoKey) => { used.add(k); return k; };
    if (age !== undefined) {
      // En yakın yaştaki boş yüz; eşit yakınlıkta dava kimliğine bağlı sabit bir sıra (ordered ise havuz sırası).
      const d = (k: PhotoKey) => Math.abs((faceAge(k) ?? 40) - age);
      const ranked = [...same].sort((a, b) => d(a) - d(b) || (o?.ordered ? same.indexOf(a) - same.indexOf(b) : hash(c.id + seed + a) - hash(c.id + seed + b)));
      for (const k of ranked) if (!used.has(k)) return take(k);
    }
    if (o) {
      const st = o.ordered ? 0 : hash(c.id + seed) % Math.max(1, same.length);
      for (let i = 0; i < same.length; i++) { const k = same[(st + i) % same.length]; if (!used.has(k)) return take(k); }
      for (const k of o.spare ? (female ? o.spare.f : o.spare.m) : []) if (!used.has(k)) return take(k);
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
  // Tahkimde heyetin öbür üyeleri de salonda oturur: yüzleri taraflara ve vekillere verilmesin.
  if (tahkim) {
    const wings = arbBench(c, map.judge);
    for (let i = 0; i < Math.max(0, (c.bench?.judges ?? 1) - 1) && wings.length; i++) used.add(wings[i % wings.length]);
  }
  const exec = (role: string, name?: string) => commercialArb(c) || CORP_ROLE.test(name || "") || /^(Av|Dr|Prof|Doç)\./.test(name || "") || (role === "karsi" || role.startsWith("party_")) && corpSide(role);
  const corpSide = (k: string) => CORP_SIDE.test(c.sides[k === "party_p1" ? "p1" : "p2"].role);
  const isCounsel = (role: string) => tahkim && (role === "p1" || role === "p2" || role === "opp");
  // Tahkimde önce vekiller seçilir (dosya tutan ks- yüzleri onlara kalsın), sonra öbür kişiler.
  const roles = Object.keys(c.cast).filter(r => r !== "judge").sort((a, b) => +isCounsel(b) - +isCounsel(a));
  for (const role of roles) {
    const m = c.cast[role];
    const robe = m.look?.kind !== "civil";
    const red = m.np === "red" || role === "pros" || role === "savci";
    if (isCounsel(role)) { map[role] = pick(COUNSEL, femaleOf(role), role, ageOf(role), { ordered: true, spare: EXEC_SPARE }); continue; }
    // Şirket ya da kurum adına gelen sivil kişi (yönetici, yetkili; ticari tahkimde herkes): takım elbiseli yüz.
    if (!robe && !red && (m.attire === "business" || exec(role, m.name))) { map[role] = pick(EXEC, femaleOf(role), role, ageOf(role), { spare: EXEC_SPARE }); continue; }
    const pool = !robe ? CIVIL : red ? (intl ? judgePool : PROS) : LAWYER;
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
  // Şirket, kulüp ya da ticari tahkimde taraf: takım elbiseli bir yetkiliyle temsil edilir (EXEC); öbürleri sivil.
  for (const k of [pr.left, pr.right]) if (k && !map[k]) {
    const f = hash(c.id + k) % 2 === 0;
    map[k] = exec(k) ? pick(EXEC, f, k, undefined, { spare: EXEC_SPARE }) : pick(CIVIL, f, k);
  }
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
