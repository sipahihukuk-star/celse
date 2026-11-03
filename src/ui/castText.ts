// Dosya metninden kadro ipuçları: kime "Hanım" / "Bey" diye hitap ediliyor, kimin kaç yaşında olduğu yazıyor.
// Yüz seçimi (castFaces.ts) bu ipuçlarını kullanır; oyuncunun avukatına yapılan hitap da oyuncunun yüzüne göre uyarlanır.
// Bu dosya arayüzden bağımsızdır (react-native yüklemez); tools/tutarlilik.ts denetimi de aynı kuralları kullanır.
import { CaseFile, Line, Scene, Side, Text } from "../engine/types";
import { FEMALE, partiesOf } from "./people";

export type Gender = "f" | "m";

/** Yaygın erkek adları: ad kesin bir cinsiyet söylüyorsa görünüş tarifinden (saç biçimi) önce gelir. */
export const MALE = new Set(("ahmet mehmet mustafa ali hasan hüseyin ibrahim ismail osman yusuf murat ömer emre burak onur kaan kerem selim serkan " +
  "levent cengiz hakan tolga tarık orhan kemal halil recep volkan mahmut bülent erkan selçuk ozan oğuz oğuzhan cem cemal cihan erdem erol " +
  "gökhan kadir kenan metin okan rıza serdar tuncay baran berk dursun hilmi necati nihat tamer ufuk ercan yavuz sinan barış can caner " +
  "ercüment fatih fikret gürkan harun hayati ilker koray mert nazım rahmi refik sami tahsin taner turgut uğur vedat yasin yiğit zafer " +
  "abdullah adnan alper arda batuhan bekir cevdet doğan engin eren ferhat furkan güven halit hamza hikmet kâmil kamil kudret mesut " +
  "muammer nevzat niyazi oktay ramazan reşat sabri sadık salih sedat semih suat şahin şükrü talat tayfun tunç turan ümit yaşar yılmaz " +
  "zeki mateo marc marek matthias mihai nuno dario hans peter thomas jan lukas luca marco pierre jean carlos miguel").split(" "));
/** people.ts'teki listede bulunmayan kadın adları (dosyalarda geçenler ve yaygın yabancı adlar). */
const FEMALE_EXTRA = new Set(("ayşen defne aysun serpil nurhan zelal selma selda melike meral hanna katrin lena lidia lina sophie anna nadia inge " +
  "giulia maria elena sofia laura julia marie claire eva emma nina olga irina esin işıl gülnur gülden nurten sevgül tuğçe beyza başak " +
  "betül cemile dilara ela elçin feyza gonca hacer helin hilal ilknur kader leman mehtap müzeyyen naz nazife nazlı neşe nuran özge " +
  "rabia rana sanem sezen şebnem şirin tülay yağmur zübeyde").split(" "));

const L = "A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîûÉéèëäåñ";
const lower = (s: string) => s.toLocaleLowerCase("tr");
const PREFIX = /^(av\.?|dr\.?|dt\.?|ecz\.?|prof\.?|doç\.?|op\.?|uzm\.?)$/i;

/** Kadro adının kişi kısmı ("Av. Selin Kaya · Davalı vekili" → ["selin", "kaya"]). */
export function nameTokens(name?: string): string[] {
  return lower((name || "").split("·")[0]).split(/\s+/).map(w => w.replace(/[^a-zçğıöşüâîûéèëäåñ]/g, "")).filter((w, i, a) => w && !PREFIX.test(a[i]));
}

/** Addan cinsiyet: kişi kısmındaki ilk tanınan ad karar verir ("Hâkim Selin Kaya", "Av. Cengiz Toprak"). */
export function nameGender(name?: string): Gender | undefined {
  for (const w of nameTokens(name)) {
    if (FEMALE.has(w) || FEMALE_EXTRA.has(w)) return "f";
    if (MALE.has(w)) return "m";
  }
  return undefined;
}

/* ---------- Metinlerin dolaşılması ---------- */

export type TextKind = "intro" | "line" | "reply" | "statement" | "choice" | "model" | "prompt" | "note" | "outcome" | "doc" | "evidence";
export interface Ctx {
  /** konuşan: kadro anahtarı, p1/p2, narr */
  who: string;
  kind: TextKind;
  /** adımın tarafı (seçenek, cevap ve adım satırlarında) */
  side?: Side;
  scene?: Scene;
  /** aynı satır dizisinde bir önceki ve bir sonraki konuşan */
  prev?: string;
  next?: string;
  /** dosyadaki yer (denetim çıktısı için) */
  path: string;
}

/** Dosyadaki her metne fn uygulanır; fn metni değiştirirse yeni bir dosya döner (asıl dosyaya dokunulmaz). */
export function mapCaseTexts(c: CaseFile, fn: (text: string, ctx: Ctx) => string): CaseFile {
  let changed = false;
  const s = (text: string, ctx: Ctx) => { const r = fn(text, ctx); if (r !== text) changed = true; return r; };
  const tx = (t: Text | undefined, ctx: Ctx): Text | undefined =>
    t === undefined ? t : typeof t === "string" ? s(t, ctx) : t.map((p, i) => ({ ...p, text: s(p.text, { ...ctx, path: `${ctx.path}[${i}]` }) }));
  const lines = (ls: Line[] | undefined, base: Omit<Ctx, "who" | "path" | "prev" | "next">, path: string): Line[] | undefined =>
    ls && ls.map((l, i) => ({ ...l, text: s(l.text, { ...base, who: l.who, prev: ls[i - 1]?.who, next: ls[i + 1]?.who, path: `${path}[${i}]` }) }));
  const resp = <T extends { note?: Text; reply?: Line[] } | undefined>(r: T, side: Side, scene: Scene, path: string): T =>
    r && ({ ...r, note: tx(r.note, { who: "narr", kind: "note", side, scene, path: `${path}.note` }), reply: lines(r.reply, { kind: "reply", side, scene }, `${path}.reply`) } as T);
  const out: CaseFile = {
    ...c,
    intro: lines(c.intro, { kind: "intro", scene: "office" }, "intro")!,
    docs: c.docs.map((d, i) => ({ ...d, d: s(d.d, { who: "narr", kind: "doc", path: `docs[${i}]` }) })),
    evidence: c.evidence?.map((e, i) => ({ ...e, desc: s(e.desc, { who: "narr", kind: "evidence", path: `evidence[${i}]` }) })),
    steps: c.steps.map((st, si) => {
      const side = st.side || "p1", scene = st.scene || "court", P = `steps[${si}]`;
      return {
        ...st,
        lines: lines(st.lines, { kind: "line", side, scene }, `${P}.lines`)!,
        prompt: s(st.prompt || "", { who: "narr", kind: "prompt", side, scene, path: `${P}.prompt` }),
        model: st.model === undefined ? undefined : s(st.model, { who: side, kind: "model", side, scene, path: `${P}.model` }),
        statement: st.statement && { ...st.statement, text: s(st.statement.text, { who: st.statement.who, kind: "statement", side, scene, path: `${P}.statement` }) },
        choices: (st.choices || []).map((ch, ci) => ({
          ...resp(ch, side, scene, `${P}.choices[${ci}]`),
          text: s(ch.text, { who: side, kind: "choice", side, scene, path: `${P}.choices[${ci}].text` })
        })),
        hit: resp(st.hit, side, scene, `${P}.hit`),
        miss: resp(st.miss, side, scene, `${P}.miss`),
        pass: resp(st.pass, side, scene, `${P}.pass`),
        responses: st.responses && Object.fromEntries(Object.entries(st.responses).map(([k, r]) => [k, resp(r, side, scene, `${P}.responses.${k}`)!]))
      };
    }),
    outcomes: c.outcomes.map((o, i) => ({ ...o, hukum: tx(o.hukum, { who: "judge", kind: "outcome", path: `outcomes[${i}].hukum` })!, summary: tx(o.summary, { who: "narr", kind: "outcome", path: `outcomes[${i}].summary` })! }))
  };
  // JSON'da olmayan alanlar (undefined) eklenmesin.
  for (const st of out.steps as any[]) for (const k of ["model", "statement", "hit", "miss", "pass", "responses"]) if (st[k] === undefined) delete st[k];
  if (out.evidence === undefined) delete (out as any).evidence;
  return changed ? out : c;
}

export function forEachText(c: CaseFile, fn: (text: string, ctx: Ctx) => void) {
  mapCaseTexts(c, (t, ctx) => { fn(t, ctx); return t; });
}

/* ---------- Hitaplar ---------- */

const T_LAWYER = /^(avukat|av\.|vekil|müdafi|müdafii)$/;
const T_PROS = /^(savcı|savcısı|başsavcı|başsavcısı)$/;
const T_JUDGE = /^(hâkim|hakim|başkan|başkanım|hakem|başhakem|yargıç|reis)$/;
const T_ROLE = /^(tanık|sanık|mağdur|müşteki|katılan|davacı|davalı|bilirkişi|uzlaştırmacı|şikâyetçi|borçlu|alacaklı|başvurucu|başvuran)$/;
const KEY_OF: Record<string, string[]> = {
  tanık: ["tanik", "witness"], sanık: ["sanik"], mağdur: ["magdur"], katılan: ["katilan"], davacı: ["davaci"], davalı: ["davali"],
  bilirkişi: ["expert", "bilirkisi"], uzlaştırmacı: ["uzl"], müşteki: ["musteki"]
};
const NOT_A_NAME = /^(ve|ile|bu|şu|o|bir|her|genç|yaşlı|sayın|değerli|muhterem|kıymetli|sevgili|ey|evet|hayır|peki|tamam|efendim)$/;

/** "Avukat Hanım", "Sayın Savcı Bey", "Cengiz Bey'in", "Tanık hanım", "Müdafi Beyefendi" */
const ADDR = new RegExp(
  `(^|[^${L}'’])((?:[Ss]ayın\\s+)?(?:(?:[Cc]umhuriyet|[Dd]anıştay|[Yy]argıtay|[Ss]ayıştay)\\s+)?[${L}.]+)\\s+(Hanım|Bey|hanım|bey)(efendi)?` +
  `((?:['’][${L}]+)|(?:ın|a|ı|la|dan|da)(?=[^${L}]|$))?(?=[^${L}]|$)`, "g");
/** "kadın savcı", "erkek hâkim" */
const GREF = new RegExp(`(^|[^${L}])(kadın|erkek|bayan)\\s+(savcı|hâkim|hakim|avukat|tanık|bilirkişi|başkan)(?=[^${L}]|$)`, "gi");

export interface Ref {
  kind: "addr" | "gender" | "age" | "vocative";
  /** metindeki eşleşme ve konumu */
  match: string;
  index: number;
  text: string;
  ctx: Ctx;
  /** ünvan ya da ad ("avukat", "savcı", "cengiz") */
  title: string;
  /** başvurulan kadro rolü (bulunamazsa boş) */
  role?: string;
  /** birden fazla aday kaldıysa */
  ambiguous?: boolean;
  candidates?: string[];
  g?: Gender;
  age?: number;
  /** yaş ipucunun kaynağı: sayı mı, "genç/yaşlı" gibi bir söz mü */
  ageWord?: boolean;
  /** ad kadroda yok (sahnede yüzü olmayan biri) */
  offstage?: boolean;
  /** hitap edilen ünvanın türü */
  tkind?: "lawyer" | "pros" | "judge" | "role" | "name";
}

interface Roster {
  c: CaseFile;
  roles: string[];
  tokens: Record<string, string[]>;
  first: Record<string, string>;
  left?: string;
  right?: string;
  other?: string;
}

function roster(c: CaseFile): Roster {
  const roles = Object.keys(c.cast);
  const tokens: Record<string, string[]> = {}, first: Record<string, string> = {};
  for (const r of roles) {
    // Ünvan sözcükleri ("hâkim", "cumhuriyet savcısı", "başkan") ad sayılmaz.
    const t = nameTokens(c.cast[r].name).filter(w => !T_JUDGE.test(w) && !T_PROS.test(w) && !T_ROLE.test(w) && !/^(cumhuriyet|danıştay|yargıtay|sayıştay|daire|mahkeme|kurul|komisyon|panel|bölüm|tek|yüce|divan|temsilcisi|başkanı|başkanvekili|üye|raportör|denetçi|savcılık|hükûmet|bakanlık|adalet|bakanlığı|arka|sıradan|bir|ses|mali|hizmetler|müdürü)$/.test(w));
    tokens[r] = t;
    if (t[0]) first[r] = t[0];
  }
  const p = partiesOf(c);
  const other = c.mode === "duel" ? "p2" : c.cast.opp && c.cast.opp.np !== "red" && !/savc/i.test(c.cast.opp.name || "") ? "opp" : undefined;
  return { c, roles, tokens, first, left: p.left, right: p.right, other };
}

const isLawyerRole = (R: Roster, r?: string) => !!r && (r === "p1" || r === "p2" || r === R.other);

/** Kadroda bir adın geçtiği yerler: tam ad, ad ya da (tekse) soyad. */
function mentions(R: Roster, text: string): { role: string; index: number; end: number; full: boolean }[] {
  const out: { role: string; index: number; end: number; full: boolean }[] = [];
  const low = lower(text);
  const surnameCount: Record<string, number> = {};
  for (const r of R.roles) for (const w of R.tokens[r].slice(1)) surnameCount[w] = (surnameCount[w] || 0) + 1;
  const firstCount: Record<string, number> = {};
  for (const r of R.roles) if (R.first[r]) firstCount[R.first[r]] = (firstCount[R.first[r]] || 0) + 1;
  for (const r of R.roles) {
    const t = R.tokens[r];
    if (!t.length) continue;
    const find = (needle: string, full: boolean) => {
      const re = new RegExp(`(^|[^${L}])(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?=[^${L}]|$)`, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(low))) out.push({ role: r, index: m.index + m[1].length, end: m.index + m[1].length + m[2].length, full });
    };
    if (t.length > 1) find(t.join(" "), true);
    if (firstCount[t[0]] === 1 && t[0].length >= 3) find(t[0], false);
    for (const w of t.slice(1)) if (surnameCount[w] === 1 && w.length >= 3) find(w, false);
  }
  // Aynı yeri kapsayan kısa eşleşmeler (tam adın parçası) atılır.
  return out.filter(m => !out.some(o => o !== m && o.full && !m.full && o.index <= m.index && o.end >= m.end && o.role === m.role))
    .sort((a, b) => a.index - b.index);
}

/** Sahnedeki bir avukata yapılan hitabın kime yöneldiği. */
function lawyerTarget(R: Roster, ctx: Ctx, g: Gender): { role?: string; ambiguous?: boolean; candidates: string[] } {
  const c = R.c, duel = c.mode === "duel";
  const cands = ["p1", ...(R.other ? [R.other] : [])];
  const w = ctx.who;
  // Avukatın kendisi konuşuyorsa karşısındakine hitap eder.
  if (w === "p1" || w === "p2" || (w === R.other && w)) {
    const t = w === "p1" ? R.other : "p1";
    return t ? { role: t, candidates: cands } : { ambiguous: true, candidates: cands };
  }
  // Müvekkil ya da taraflar kendi avukatına hitap eder.
  if (w === "client" || w === R.left || w === "party_p1") return { role: "p1", candidates: cands };
  if (w === R.right || w === "party_p2" || w === "karsi") return R.other ? { role: R.other, candidates: cands } : { role: "p1", candidates: cands };
  // Büroda karşı tarafın avukatı yoktur: büro ortağı, müvekkil ya da başka biri oyuncuya hitap eder.
  if (ctx.scene === "office") return { role: "p1", candidates: cands };
  // "Davalı, oturun. Vekil Bey, müvekkilinizi uyarın": az önce konuşan tarafın avukatı.
  if (ctx.prev && ctx.prev === R.left) return { role: "p1", candidates: cands };
  if (ctx.prev && ctx.prev === R.right && R.other) return { role: R.other, candidates: cands };
  // Hâkim ve diğerleri: hemen ardından ya da önünden konuşan avukat, yoksa hamlesine cevap verilen taraf.
  const near = [ctx.next, ctx.prev].filter(x => isLawyerRole(R, x)) as string[];
  const replySide = ctx.kind === "reply" || ctx.kind === "note" ? (ctx.side === "p2" ? (duel ? "p2" : R.other) : "p1") : undefined;
  let role: string | undefined;
  if (near.length && (!replySide || near[0] === replySide)) role = near[0];
  else if (replySide && !near.length) role = replySide;
  else if (!R.other) role = "p1";
  // Karşı avukatın adı belli ve cinsiyeti hitapla çelişiyorsa hitap oyuncuya yöneliktir.
  if (!role && R.other) {
    const og = nameGender(c.cast[R.other]?.name);
    if (og && og !== g) role = "p1";
  }
  return role ? { role, candidates: cands } : { ambiguous: true, candidates: cands };
}

function roleWordTargets(R: Roster, word: string): string[] {
  const keys = KEY_OF[word] || [];
  const re = new RegExp(`(^|[^${L}])${word}`, "i");
  return R.roles.filter(r => keys.includes(r) || re.test(lower(R.c.cast[r].name || "")));
}

function prosTargets(R: Roster): string[] {
  return R.roles.filter(r => r === "pros" || r === "savci" || (/savc/i.test(R.c.cast[r].name || "") && R.c.cast[r].look?.kind !== "civil"));
}

/** Ünvanı kadrodaki role bağlar. */
function resolveTitle(R: Roster, rawTitle: string, ctx: Ctx, g: Gender | undefined): Pick<Ref, "role" | "ambiguous" | "candidates" | "offstage" | "tkind" | "title"> {
  const words = lower(rawTitle).split(/\s+/).filter(w => w !== "sayın");
  const core = words[words.length - 1] || "";
  const pickNear = (cands: string[]) => {
    if (cands.length === 1) return { role: cands[0], candidates: cands };
    const near = [ctx.next, ctx.prev, ctx.who].find(x => x && cands.includes(x));
    return near ? { role: near, candidates: cands } : { ambiguous: cands.length > 1, candidates: cands };
  };
  if (T_LAWYER.test(core)) return { title: core, tkind: "lawyer", ...lawyerTarget(R, ctx, g || "m") };
  if (T_PROS.test(core)) return { title: "savcı", tkind: "pros", ...pickNear(prosTargets(R)) };
  if (T_JUDGE.test(core)) return { title: core, tkind: "judge", role: R.c.cast.judge ? "judge" : undefined, candidates: ["judge"] };
  if (T_ROLE.test(core)) return { title: core, tkind: "role", ...pickNear(roleWordTargets(R, core)) };
  // Ad büyük harfle başlar ("Cengiz Bey"); "söyleyen beyefendi" gibi sözler kişi adı değildir.
  const raw = rawTitle.trim().split(/\s+/).pop() || "";
  if (NOT_A_NAME.test(core) || raw[0] !== raw[0].toLocaleUpperCase("tr")) return { title: core };
  const byFirst = R.roles.filter(r => R.first[r] === core);
  const bySur = byFirst.length ? byFirst : R.roles.filter(r => R.tokens[r].slice(1).includes(core));
  if (!bySur.length) return { title: core, tkind: "name", offstage: true, candidates: [] };
  return { title: core, tkind: "name", ...pickNear(bySur) };
}

/* ---------- Yaş ---------- */

const AGE = new RegExp(`(\\d{2})\\s*(?:yaşında|yaşlarında)(ki|yım|yim|yız|ydı|ydım|ydi|yken|dır|dir)?(?=[^${L}]|$)`, "g");
const AGE_WORD = new RegExp(`(^|[^${L}])(orta yaşlı|genç kız|delikanlı|genç|yaşlı|ihtiyar|emekli|yaşını başını almış)(?=[^${L}]|$)`, "gi");
const WORD_AGE: Record<string, number> = { "orta yaşlı": 48, "genç kız": 22, delikanlı: 21, genç: 26, yaşlı: 68, ihtiyar: 72, emekli: 64, "yaşını başını almış": 62 };
const sentenceOf = (text: string, i: number) => {
  const a = Math.max(text.lastIndexOf(". ", i), text.lastIndexOf("! ", i), text.lastIndexOf("? ", i));
  const b = [". ", "! ", "? "].map(s => text.indexOf(s, i)).filter(x => x >= 0);
  return { start: a < 0 ? 0 : a + 2, end: b.length ? Math.min(...b) : text.length };
};

function ageRefs(R: Roster, text: string, ctx: Ctx): Ref[] {
  const out: Ref[] = [];
  const ms = mentions(R, text);
  let m: RegExpExecArray | null;
  AGE.lastIndex = 0;
  while ((m = AGE.exec(text))) {
    const n = +m[1], suf = m[2] || "", at = m.index;
    if (/^(ydı|ydi|yken)$/.test(suf)) continue; // geçmiş zaman: bugünkü yaşı söylemez
    if (/^\s*olacak/.test(text.slice(at + m[0].length))) continue;
    let role: string | undefined, age = n;
    if (/^(yım|yim|yız)$/.test(suf)) role = ctx.who;
    else if (suf === "ydım") {
      const now = text.slice(at).match(/şimdi\s+(\d{2})/);
      if (!now) continue;
      role = ctx.who; age = +now[1];
    } else if (suf === "ki") {
      // "27 yaşındaki motokurye Barış Ekinci": sonraki ad, yoksa önceki.
      role = (ms.find(x => x.index > at && x.index - at < 70) || [...ms].reverse().find(x => x.end <= at && at - x.end < 60))?.role;
    } else {
      // "Derya Koç 26 yaşında", "Yusuf Demirel geliyor. 34 yaşında": önceki en yakın ad.
      role = [...ms].reverse().find(x => x.end <= at && at - x.end < 160)?.role;
    }
    if (!role || !(role in R.c.cast)) continue;
    out.push({ kind: "age", match: m[0], index: at, text, ctx, title: m[0], role, age });
  }
  AGE_WORD.lastIndex = 0;
  while ((m = AGE_WORD.exec(text))) {
    const w = lower(m[2]), at = m.index + m[1].length, after = text.slice(at + m[2].length);
    // "genç avukat", "genç bir avukat olarak": oyuncunun kendisi; yaş ipucu sayılmaz.
    if (/^\s+(bir\s+)?(avukat|meslektaş|stajyer|vekil|müdafi|hukukçu|nesil|yaşta|yaşında|sayılır|değil)/i.test(after)) continue;
    if (/^\s+(bir\s+)?(hâkim|hakim|başkan)/i.test(after)) { if (R.c.cast.judge) out.push({ kind: "age", match: m[2], index: at, text, ctx, title: w, role: "judge", age: WORD_AGE[w], ageWord: true }); continue; }
    if (/^\s+(bir\s+)?savcı/i.test(after)) { const p = prosTargets(R); if (p.length === 1) out.push({ kind: "age", match: m[2], index: at, text, ctx, title: w, role: p[0], age: WORD_AGE[w], ageWord: true }); continue; }
    const s = sentenceOf(text, at);
    const next = ms.find(x => x.index > at && x.index - at < 30);
    const prev = [...ms].reverse().find(x => x.end <= at && x.index >= s.start && at - x.end < 80);
    const person = /^\s+(bir\s+)?(kadın|adam|erkek|kız|delikanlı|işçi|kurye|öğrenci|çift|müvekkil)/i.test(after) || w === "delikanlı" || w === "genç kız";
    const role = next?.role || (person ? prev?.role || ms.find(x => x.index > at && x.index < s.end)?.role : undefined);
    if (!role) continue;
    out.push({ kind: "age", match: m[2], index: at, text, ctx, title: w, role, age: WORD_AGE[w], ageWord: true });
  }
  return out;
}

/* ---------- Seslenmeler (sahnede biri olmalı) ---------- */

const VOC = /(^|[.!?…:]\s+|["“'‘]\s*)((?:Sayın\s+)?(?:Cumhuriyet\s+|Danıştay\s+|Yargıtay\s+(?:Cumhuriyet\s+)?|Sayıştay\s+)?(?:[Ss]avcı(?:sı|m)?|Tanık|Bilirkişi|Sanık|Mağdur|Katılan|Müşteki|Uzlaştırmacı))\s*[,?!]/g;
const VOC_SAYIN = /(^|[^A-Za-zÇĞİÖŞÜçğıöşü])Sayın\s+((?:Cumhuriyet\s+)?(?:Savcı(?:m)?|Tanık|Bilirkişi|Uzlaştırmacı))(?=[^A-Za-zÇĞİÖŞÜçğıöşü]|$)/g;

/* ---------- Bütün başvurular ---------- */

/** Dosyadaki hitaplar, cinsiyetli anışlar, yaşlar ve sahnedeki birine yapılan seslenmeler. */
export function scanCase(c: CaseFile): Ref[] {
  const R = roster(c);
  const out: Ref[] = [];
  forEachText(c, (text, ctx) => {
    let m: RegExpExecArray | null;
    ADDR.lastIndex = 0;
    while ((m = ADDR.exec(text))) {
      const g: Gender = /^h/i.test(m[3]) ? "f" : "m";
      const index = m.index + m[1].length;
      const r = resolveTitle(R, m[2], ctx, g);
      if (!r.tkind) continue;
      out.push({ kind: "addr", match: m[0].slice(m[1].length), index, text, ctx, g, ...r });
    }
    GREF.lastIndex = 0;
    while ((m = GREF.exec(text))) {
      const g: Gender = /^(kadın|bayan)$/i.test(m[2]) ? "f" : "m";
      const r = resolveTitle(R, m[3], ctx, g);
      if (r.tkind === "lawyer" && !/^(p1|p2|opp)$/.test(ctx.who)) continue; // "kadın avukat" genellikle genel bir söz
      out.push({ kind: "gender", match: m[0].slice(m[1].length), index: m.index + m[1].length, text, ctx, g, ...r });
    }
    out.push(...ageRefs(R, text, ctx));
    if (ctx.who !== "narr" && ctx.kind !== "doc" && ctx.kind !== "evidence") {
      for (const re of [VOC, VOC_SAYIN]) {
        re.lastIndex = 0;
        while ((m = re.exec(text))) {
          // "Tanık, olay gecesi ... gördü" üçüncü kişidir; seslenmede cümle ikinci kişiye döner ("beyanınız?", "açıklayın", "siz").
          const rest = text.slice(m.index + m[0].length).split(/[.!…]\s/)[0];
          if (re === VOC && m[0].trimEnd().endsWith(",") && !/(^|[^${L}])(siz|size|sizi|sizin|sizce)(?=[^${L}]|$)|n[ıiuü]z(?=[^${L}]|[ıi]|$)|y[ıiuü]n(?=[^${L}]|$)/.test(rest)) continue;
          const r = resolveTitle(R, m[2].replace(/(sı|m)$/, "").replace(/^(Sayın\s+)?(Cumhuriyet|Danıştay|Yargıtay|Sayıştay)\s+/i, ""), ctx, undefined);
          out.push({ kind: "vocative", match: m[2], index: m.index + m[1].length, text, ctx, ...r });
        }
      }
    }
  });
  return out;
}

export interface Hint { g?: Gender; gFrom?: string; age?: number; ageFrom?: string }

/** Kadro rolleri için metinden çıkan cinsiyet ve yaş. Cinsiyette ad > hitap > görünüş sırası castFaces.ts'te uygulanır. */
export function castHints(c: CaseFile, refs = scanCase(c)): Record<string, Hint> {
  const h: Record<string, Hint> = {};
  const votes: Record<string, { f: number; m: number }> = {};
  for (const r of refs) {
    if (!r.role || r.ambiguous) continue;
    if ((r.kind === "addr" || r.kind === "gender") && r.g) {
      const v = (votes[r.role] ||= { f: 0, m: 0 });
      v[r.g]++;
    }
    if (r.kind === "age" && r.age) {
      const cur = (h[r.role] ||= {});
      // Sayıyla yazılmış yaş, "genç / yaşlı" sözünden önce gelir; ilk geçen kullanılır.
      if (cur.age === undefined || (cur.ageFrom?.startsWith("söz") && !r.ageWord)) { cur.age = r.age; cur.ageFrom = (r.ageWord ? "söz: " : "metin: ") + r.match; }
    }
  }
  for (const [role, v] of Object.entries(votes)) {
    if (v.f === v.m) continue;
    const cur = (h[role] ||= {});
    cur.g = v.f > v.m ? "f" : "m";
    cur.gFrom = `hitap ${v.f}K/${v.m}E`;
  }
  return h;
}

/* ---------- Oyuncunun avukatına hitap ---------- */

const SUFFIX_SWAP: Record<string, string> = { "'ın": "'in", "'a": "'e", "'ı": "'i", "'la": "'le", "'dan": "'den", "'da": "'de", "'ın'": "'in'", ın: "'in", a: "'e", ı: "'i", la: "'le", dan: "'den", da: "'de" };
const SUFFIX_BACK: Record<string, string> = { "'in": "'ın", "'e": "'a", "'i": "'ı", "'le": "'la", "'den": "'dan", "'de": "'da" };

function swapGender(word: string, efendi: string, suffix: string, to: Gender): string {
  const cap = word[0] === word[0].toLocaleUpperCase("tr");
  const base = to === "f" ? (cap ? "Hanım" : "hanım") : (cap ? "Bey" : "bey");
  const suf = suffix.replace("’", "'");
  const s2 = efendi ? suf : to === "m" ? SUFFIX_SWAP[suf] ?? suf : SUFFIX_BACK[suf] ?? suf;
  return base + efendi + s2;
}

/** Oyuncunun (p1) avukatına "Avukat Hanım / Bey" gibi hitaplar oyuncunun yüzünün cinsiyetine çevrilir.
 *  Kime yöneldiği belli olmayan avukat hitabı "Sayın Avukat" olur. Diğer avukatlara yapılan hitaplara dokunulmaz. */
export function adaptPlayerAddress(c: CaseFile, female: boolean): CaseFile {
  const R = roster(c);
  const to: Gender = female ? "f" : "m";
  return mapCaseTexts(c, (text, ctx) => {
    ADDR.lastIndex = 0;
    if (!ADDR.test(text)) return text;
    ADDR.lastIndex = 0;
    return text.replace(ADDR, (all, pre: string, title: string, word: string, efendi = "", suffix = "") => {
      const g: Gender = /^h/i.test(word) ? "f" : "m";
      const r = resolveTitle(R, title, ctx, g);
      if (r.tkind !== "lawyer") return all;
      if (r.role === "p1") return g === to ? all : `${pre}${title} ${swapGender(word, efendi, suffix, to)}`;
      if (r.ambiguous && !suffix) {
        const core = title.replace(/^[Ss]ayın\s+/, "");
        const T = core === "Av." || core === "av." ? "Avukat" : core[0].toLocaleUpperCase("tr") + core.slice(1);
        return `${pre}Sayın ${T}`;
      }
      return all;
    });
  });
}
