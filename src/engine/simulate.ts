// Bir davanın bütün seçim yollarını oynatır. Hem komut satırındaki test hem de yönetim panelindeki "Denetle" bunu kullanır.
import { test } from "./expr";
import { applyChoice, choicesOf, createGame, findNextStep, GameState, kindOf, verdict } from "./engine";
import { CaseFile } from "./types";

export interface SimResult {
  paths: number;
  maxDepth: number;
  /** karar damgasına göre yol sayısı */
  tally: Record<string, number>;
  problems: string[];
  /** yol sayısı sınırı aşıldı mı */
  truncated: boolean;
  /** her karar kuralına ulaşan yol sayısı (aynı sırayla) */
  byOutcome: number[];
  /** davayı erken bitiren (fatal) hamleyle biten yollar */
  fatalPaths: number;
  /** hiç seçilmeyen ya da hiç görülmeyen adımlar (1'den başlayan numaralar) */
  unreachedSteps: number[];
}

export function simulateCase(c: CaseFile, limit = 50000): SimResult {
  const players = { p1: { name: "A", ai: false }, p2: { name: "B", ai: false } };
  const r: SimResult = { paths: 0, maxDepth: 0, tally: {}, problems: [], truncated: false, byOutcome: c.outcomes.map(() => 0), fatalPaths: 0, unreachedSteps: [] };
  const visited = new Set<number>();
  const seen = new Set<string>();
  const walk = (st: GameState, depth: number) => {
    if (r.paths >= limit) { r.truncated = true; return; }
    let i: number;
    try { i = findNextStep(c, st); } catch (e) { r.problems.push((e as Error).message); return; }
    if (i === -1) {
      r.paths++; r.maxDepth = Math.max(r.maxDepth, depth);
      try {
        const v = verdict(c, st);
        r.tally[v.stamp] = (r.tally[v.stamp] || 0) + 1;
        if (st.fatal) r.fatalPaths++;
        else { const oi = c.outcomes.findIndex(o => test(o.if, st.flags)); if (oi >= 0) r.byOutcome[oi]++; }
        if (!v.hukum || !v.summary) {
          const key = "bos:" + JSON.stringify(st.flags);
          if (!seen.has(key)) { seen.add(key); r.problems.push(`Boş karar metni (bayraklar: ${JSON.stringify(st.flags)})`); }
        }
      } catch (e) { r.problems.push((e as Error).message); }
      return;
    }
    visited.add(i);
    const list = choicesOf(c, st, i);
    const min = kindOf(c.steps[i]) === "choice" ? 2 : 1;
    if (list.length < min) {
      const key = `adim:${i}:${JSON.stringify(st.flags)}`;
      if (!seen.has(key)) { seen.add(key); r.problems.push(`Adım ${i + 1} için seçenek kalmadı (bayraklar: ${JSON.stringify(st.flags)})`); }
      return;
    }
    list.forEach((_, k) => walk(applyChoice(c, st, i, k, "A"), depth + 1));
  };
  walk(createGame(c, players), 0);
  if (!r.truncated) r.unreachedSteps = c.steps.map((_, i) => i).filter(i => !visited.has(i)).map(i => i + 1);
  return r;
}
