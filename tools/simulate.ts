// Tüm davalardaki bütün seçim yollarını oynatır:
// dava dosyalarını doğrular, her yolun bir kararla bittiğini ve her adımda seçilebilecek bir şey olduğunu denetler.
import { CASES } from "../src/data/cases";
import { applyChoice, choicesOf, createGame, findNextStep, kindOf, validateCase, verdict, GameState } from "../src/engine/engine";
import { CaseFile } from "../src/engine/types";

const players = { p1: { name: "A", ai: false }, p2: { name: "B", ai: false } };
let failures = 0;

for (const c of CASES as CaseFile[]) {
  const errs = validateCase(c);
  if (errs.length) { failures++; console.log(`✗ ${c.id} doğrulama:\n  ` + errs.join("\n  ")); continue; }
  const tally: Record<string, number> = {};
  let paths = 0, maxDepth = 0;
  const walk = (st: GameState, depth: number) => {
    const i = findNextStep(c, st);
    if (i === -1) {
      paths++; maxDepth = Math.max(maxDepth, depth);
      const v = verdict(c, st);
      tally[v.stamp] = (tally[v.stamp] || 0) + 1;
      if (!v.hukum || !v.summary) { failures++; console.log(`✗ ${c.id}: boş karar metni`); }
      return;
    }
    const list = choicesOf(c, st, i);
    const min = kindOf(c.steps[i]) === "choice" ? 2 : 1;
    if (list.length < min) { failures++; console.log(`✗ ${c.id}: adım ${i + 1} için seçenek kalmadı (bayraklar ${JSON.stringify(st.flags)})`); return; }
    list.forEach((_, k) => walk(applyChoice(c, st, i, k, "A"), depth + 1));
  };
  walk(createGame(c, players), 0);
  console.log(`✓ ${c.id}: ${paths} farklı yol, en uzun ${maxDepth} hamle → ${Object.entries(tally).map(([k, n]) => `${k} ${n}`).join(", ")}`);
}
if (failures) { console.log(`${failures} hata`); process.exit(1); }
console.log("Tüm denetimler geçti.");
