// Oyunun kuralları. Arayüzden bağımsızdır; aynı kod mobilde, web'de ve testlerde çalışır.
import { parseDate } from "./deadline";
import { Flags, names, parse, test } from "./expr";
import { CaseFile, Choice, EvidenceItem, EvidenceResponse, Fatal, Line, Player, Side, Step, Text, Winner } from "./types";

export interface LogEntry {
  side: Side;
  ai: boolean;
  prompt: string;
  text: string;
  letter: string;
  delta: number;
  note: string;
  law?: string;
  /** serbest cevap: puan, uygulanan sonuç ve örnek cevap */
  free?: { score: number; band: string; model?: string };
  /** dilekçe kuran adımda: dilekçeye yazılan bölüm ve cümle (dilekçe önizlemesi bunlardan kurulur) */
  doc?: { section: string; text: string };
}

export interface GameState {
  caseId: string;
  mode: "duel" | "solo";
  players: Record<Side, Player>;
  stepIdx: number;
  flags: Flags;
  /** karşılıklı modda her tarafın hamle puanı */
  pts: Record<Side, number>;
  /** tek kişilik modda 0–100 arası ikna */
  score: number;
  log: LogEntry[];
  fatal?: { fatal: Fatal; side: Side };
  /** müvekkil görüşmelerinde sorulan soruların sırası (adım → soru indeksleri) */
  asked: Record<number, number[]>;
  /** bitirilen görüşme adımları */
  closed: number[];
  /** not kırma çarpanı: hatalı hamlede düşen puan bununla çarpılır (1 = dosyadaki değer) */
  penalty?: number;
}

/** Ekranda gösterilen, adım türünden bağımsız seçenek. */
export interface Resolved extends Choice {
  /** evidence: sunulan delil (itiraz etmeden geçmede boş) */
  evidence?: EvidenceItem;
  /** interview: sorulan sorunun indeksi */
  q?: number;
  /** interview: görüşmeyi bitirme */
  finish?: boolean;
}

export interface Verdict {
  winner: Winner;
  stamp: string;
  label: string;
  hukum: string;
  summary: string;
  noCourt: boolean;
}

export const other = (s: Side): Side => (s === "p1" ? "p2" : "p1");
export const kindOf = (s: Step) => s.kind || "choice";

/** Dava dosyasındaki isteğe bağlı alanları tamamlar (JSON'dan, yönetim panelinden ya da Excel'den gelen her dosya bundan geçer). */
export function normalizeCase(raw: CaseFile): CaseFile {
  return {
    ...raw,
    steps: raw.steps.map(s => ({ ...s, side: s.side || "p1", scene: s.scene || "court", lines: s.lines || [], choices: s.choices || [] }))
  };
}

export function createGame(c: CaseFile, players: Record<Side, Player>, opts?: { penalty?: number }): GameState {
  return { penalty: opts?.penalty && opts.penalty > 0 ? opts.penalty : 1, caseId: c.id, mode: c.mode, players, stepIdx: -1, flags: {}, pts: { p1: 0, p2: 0 }, score: 50, log: [], asked: {}, closed: [] };
}

export function textOf(t: Text | undefined, flags: Flags): string {
  if (!t) return "";
  if (typeof t === "string") return t;
  return t.filter(p => test(p.if, flags)).map(p => p.text).join("");
}

export function linesOf(lines: Line[], flags: Flags): Line[] {
  return lines.filter(l => test(l.if, flags));
}

/** O anda delil çantasında bulunan belgeler. */
export function bagOf(c: CaseFile, flags: Flags): EvidenceItem[] {
  return (c.evidence || []).filter(e => test(e.if, flags));
}

export function isOver(state: GameState): boolean {
  return !!state.fatal || !!state.flags.end;
}

function interviewOpen(c: CaseFile, state: GameState, idx: number): boolean {
  const st = c.steps[idx];
  if (!st || kindOf(st) !== "interview" || state.closed.includes(idx)) return false;
  const asked = state.asked[idx] || [];
  const limit = st.limit ?? st.choices.length;
  const left = st.choices.filter((q, i) => !asked.includes(i) && test(q.if, state.flags)).length;
  return asked.length < limit && left > 0;
}

/** Sıradaki oynanabilir adımın indeksi; dava bittiyse -1. Açık bir görüşme varsa aynı adım döner. */
export function findNextStep(c: CaseFile, state: GameState): number {
  if (isOver(state)) return -1;
  if (state.stepIdx >= 0 && interviewOpen(c, state, state.stepIdx)) return state.stepIdx;
  for (let i = state.stepIdx + 1; i < c.steps.length; i++) {
    if (test(c.steps[i].if, state.flags)) return i;
  }
  return -1;
}

const fromResponse = (r: EvidenceResponse | undefined, fallback: EvidenceResponse): EvidenceResponse => r || fallback;

/** Adımın o anki seçenekleri: klasik seçenekler, çantadaki deliller ya da sorulmamış sorular. */
export function choicesOf(c: CaseFile, state: GameState, stepIdx: number): Resolved[] {
  const st = c.steps[stepIdx];
  const f = state.flags;
  const kind = kindOf(st);
  if (kind === "evidence") {
    const miss = st.miss || { delta: -10, note: "Bu delil beyanı çürütmüyor." };
    const out: Resolved[] = bagOf(c, f).map(ev => {
      const hit = (st.correct || []).includes(ev.id);
      const r = hit ? st.hit! : fromResponse(st.responses?.[ev.id], miss);
      return { text: ev.title, delta: r.delta, set: r.set, note: r.note, law: r.law ?? ev.law, reply: r.reply, evidence: ev };
    });
    const pass = st.pass || { delta: -15, note: "İtiraz etmediniz; beyan cevapsız kaldı." };
    out.push({ text: "İtiraz etmeden geç", delta: pass.delta, set: pass.set, note: pass.note, law: pass.law, reply: pass.reply });
    return out;
  }
  if (kind === "interview") {
    const asked = state.asked[stepIdx] || [];
    const out: Resolved[] = st.choices
      .map((q, i) => ({ ...q, q: i }))
      .filter(q => !asked.includes(q.q) && test(q.if, f));
    out.push({ text: "Görüşmeyi bitir", delta: 0, finish: true });
    return out;
  }
  // Tarih adımı serbest cevap gibi puanlanır (doğru gün 100, erken 50, geç 0); dilekçe önizlemesinde tek hamle "sun"dur.
  if (kind === "free" || kind === "date") return freeBands(st);
  if (kind === "dilekce") return [{ text: "Dilekçeyi sun", delta: 0, finish: true }];
  return st.choices.filter(ch => test(ch.if, f));
}

/** Serbest cevap sonuçları, alt puan sınırına göre yüksekten düşüğe. */
export function freeBands(st: Step): Resolved[] {
  return [...st.choices].sort((a, b) => (b.min ?? 0) - (a.min ?? 0));
}

/** Puana göre uygulanacak serbest cevap sonucunun indeksi (choicesOf sırasına göre). */
export function bandFor(st: Step, score: number): number {
  const bands = freeBands(st);
  const i = bands.findIndex(b => score >= (b.min ?? 0));
  return i === -1 ? bands.length - 1 : i;
}

export function applyChoice(c: CaseFile, state: GameState, stepIdx: number, choiceIdx: number, letter: string, free?: { answer: string; feedback?: string; score: number }): GameState {
  const step = c.steps[stepIdx];
  const ch = choicesOf(c, state, stepIdx)[choiceIdx];
  const flags = { ...state.flags };
  (ch.set || []).forEach(fl => { flags[fl] = true; });
  const side = step.side;
  const pts = { ...state.pts };
  let score = state.score;
  // Not kırma: yalnız eksi puanlar çarpılır; doğru hamlenin ödülü değişmez.
  const delta = ch.delta < 0 ? Math.round(ch.delta * (state.penalty ?? 1)) : ch.delta;
  if (state.mode === "duel") pts[side] += delta;
  else score = Math.max(0, Math.min(100, score + delta));
  const asked = { ...state.asked };
  let closed = state.closed;
  if (kindOf(step) === "interview") {
    if (ch.finish) closed = [...closed, stepIdx];
    else asked[stepIdx] = [...(asked[stepIdx] || []), ch.q!];
  }
  const entry: LogEntry = {
    side, ai: state.players[side].ai, prompt: step.prompt, text: free ? `“${free.answer}”` : ch.text, letter, delta,
    note: free?.feedback ? `${free.feedback}${textOf(ch.note, flags) ? " " + textOf(ch.note, flags) : ""}` : textOf(ch.note, flags), law: ch.law,
    ...(free ? { free: { score: free.score, band: ch.text, model: step.model } } : {}),
    ...(step.section && (free?.answer || ch.doc) ? { doc: { section: step.section, text: (kindOf(step) === "free" && free ? free.answer : ch.doc || "").trim() } } : {})
  };
  return {
    ...state, stepIdx, flags, pts, score, asked, closed, log: ch.finish ? state.log : [...state.log, entry],
    fatal: ch.fatal ? { fatal: ch.fatal, side } : state.fatal
  };
}

export function verdict(c: CaseFile, state: GameState): Verdict {
  let winner: Winner, label: string | undefined, hukum: string, summary: string, noCourt: boolean, stamp: string | undefined;
  if (state.fatal) {
    const f = state.fatal.fatal;
    winner = other(state.fatal.side);
    label = f.label; hukum = f.hukum; summary = f.summary; noCourt = !!f.label;
  } else {
    const o = c.outcomes.find(x => test(x.if, state.flags));
    if (!o) throw new Error(`${c.id}: hiçbir karar kuralı tutmadı`);
    winner = o.winner; label = o.label; stamp = o.stamp; noCourt = !!o.noCourt;
    hukum = textOf(o.hukum, state.flags); summary = textOf(o.summary, state.flags);
  }
  if (!stamp) {
    if (c.mode === "solo") stamp = winner === "p1" ? "KAZANDINIZ" : "KAYBETTİNİZ";
    else stamp = winner === "draw" ? "SULH" : `${c.sides[winner].short.toLocaleUpperCase("tr")} KAZANDI`;
  }
  return { winner, stamp, label: label || "HÜKÜM:", hukum, summary, noCourt };
}

export function grade(d: number): { tone: "good" | "mid" | "bad"; label: string } {
  if (d >= 15) return { tone: "good", label: "Yerinde hamle" };
  if (d > 0) return { tone: "mid", label: "Kabul edilebilir" };
  if (d === 0) return { tone: "mid", label: "Etkisiz hamle" };
  return { tone: "bad", label: "Hatalı hamle" };
}

export function rank(score: number): string {
  return score >= 90 ? "Kıdemli avukat" : score >= 70 ? "Deneyimli avukat" : score >= 50 ? "Genç avukat" : "Stajyer avukat";
}

export function shuffle(n: number, rand = Math.random): number[] {
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Bilgisayar rakip: "hard" çoğunlukla en iyi hamleyi, "easy" yarı yarıya yapar; oyunu bitiren hamleyi rastgele seçmez. */
export function aiPick(choices: Choice[], level: "easy" | "hard" = "easy", rand = Math.random): number {
  let best = 0;
  choices.forEach((c, i) => { if (c.delta > choices[best].delta) best = i; });
  if (rand() < (level === "hard" ? 0.85 : 0.5)) return best;
  const pool = choices.map((_, i) => i).filter(i => i !== best && !choices[i].fatal);
  return pool.length ? pool[Math.floor(rand() * pool.length)] : best;
}

/** Dava dosyasını yükleme öncesi denetler; hata listesini döndürür. */
export function validateCase(c: CaseFile): string[] {
  const errs: string[] = [];
  if (c.difficulty && !["basit", "orta", "zor"].includes(c.difficulty)) errs.push(`zorluk "${c.difficulty}" geçersiz (basit, orta ya da zor olmalı)`);
  const who = new Set(["narr", "p1", "p2", ...Object.keys(c.cast)]);
  const setFlags = new Set<string>(["end"]);
  const addSets = (s?: string[]) => (s || []).forEach(f => setFlags.add(f));
  c.steps.forEach(s => {
    s.choices.forEach(ch => addSets(ch.set));
    [s.hit, s.miss, s.pass, ...Object.values(s.responses || {})].forEach(r => addSets(r?.set));
  });
  const evIds = new Set((c.evidence || []).map(e => e.id));
  const checkExpr = (e: string | undefined, where: string) => {
    if (!e) return;
    try {
      parse(e);
      names(e).forEach(n => { if (!setFlags.has(n)) errs.push(`${where}: "${n}" bayrağını açan bir seçenek yok`); });
    } catch (err) { errs.push(`${where}: ${(err as Error).message}`); }
  };
  const checkText = (t: Text | undefined, where: string) => { if (t && typeof t !== "string") t.forEach((p, i) => checkExpr(p.if, `${where}[${i}]`)); };
  const checkLines = (ls: Line[] | undefined, where: string) => (ls || []).forEach((l, i) => {
    if (!who.has(l.who)) errs.push(`${where}[${i}]: konuşan "${l.who}" tanımlı değil`);
    checkExpr(l.if, `${where}[${i}]`);
  });
  const checkResp = (r: EvidenceResponse | undefined, where: string) => {
    if (!r) return;
    checkText(r.note, `${where}.note`); checkLines(r.reply, `${where}.reply`);
  };
  checkLines(c.intro, "intro");
  (c.evidence || []).forEach(e => checkExpr(e.if, `delil ${e.id}`));
  c.steps.forEach((s, si) => {
    const w = `adım ${si + 1}`;
    const kind = kindOf(s);
    checkExpr(s.if, w);
    checkLines(s.lines, `${w}.lines`);
    if (kind === "choice" && (s.choices.length < 2 || s.choices.length > 6)) errs.push(`${w}: 2–6 seçenek olmalı`);
    if (kind === "interview" && !s.choices.length) errs.push(`${w}: görüşmede en az bir soru olmalı`);
    if (kind === "free") {
      if (s.choices.length < 2) errs.push(`${w}: serbest cevapta en az iki sonuç (iyi / zayıf) olmalı`);
      if (!s.choices.some(ch => !ch.min)) errs.push(`${w}: serbest cevapta alt sınırı 0 olan bir sonuç olmalı (her cevap bir sonuca düşmeli)`);
      if (!s.rubric && !s.keywords?.length) errs.push(`${w}: serbest cevapta değerlendirme ölçütü (rubric) ya da anahtar kavramlar olmalı`);
    }
    if (kind === "date") {
      if (!s.deadline || !parseDate(s.deadline.teblig)) errs.push(`${w}: tarih adımında geçerli bir tebliğ tarihi (deadline.teblig, GG.AA.YYYY) olmalı`);
      else if (!s.deadline.days && !s.deadline.weeks && !s.deadline.months) errs.push(`${w}: tarih adımında süre (deadline.days, weeks ya da months) olmalı`);
      const mins = s.choices.map(ch => ch.min ?? 0);
      if (![100, 50, 0].every(m => mins.includes(m))) errs.push(`${w}: tarih adımında üç sonuç olmalı: min 100 (doğru gün), 50 (erken), 0 (süre geçti)`);
    }
    if (kind === "dilekce" && !s.paper?.title) errs.push(`${w}: dilekçe önizlemesinde başlık (paper.title) olmalı`);
    if (kind === "evidence") {
      if (!c.evidence?.length) errs.push(`${w}: delil adımı var ama davada delil çantası yok`);
      if (!s.correct?.length || !s.hit) errs.push(`${w}: delil adımında "correct" ve "hit" gerekli`);
      (s.correct || []).forEach(id => { if (!evIds.has(id)) errs.push(`${w}: "${id}" çantada yok`); });
      Object.keys(s.responses || {}).forEach(id => { if (!evIds.has(id)) errs.push(`${w}: responses içindeki "${id}" çantada yok`); });
      if (s.statement) checkLines([s.statement], `${w}.statement`);
      checkResp(s.hit, `${w}.hit`); checkResp(s.miss, `${w}.miss`); checkResp(s.pass, `${w}.pass`);
      Object.entries(s.responses || {}).forEach(([id, r]) => checkResp(r, `${w}.responses.${id}`));
    }
    s.choices.forEach((ch, ci) => {
      checkExpr(ch.if, `${w}.seçenek ${ci + 1}`);
      checkText(ch.note, `${w}.seçenek ${ci + 1}.note`);
      checkLines(ch.reply, `${w}.seçenek ${ci + 1}.reply`);
    });
  });
  c.outcomes.forEach((o, i) => { checkExpr(o.if, `karar ${i + 1}`); checkText(o.hukum, `karar ${i + 1}.hukum`); checkText(o.summary, `karar ${i + 1}.summary`); });
  if (!c.outcomes.length || c.outcomes[c.outcomes.length - 1].if) errs.push("son karar kuralı koşulsuz olmalı");
  return errs;
}
