// Dava dosyalarındaki bütün seçim yollarını oynatır:
// dosyaları doğrular, her yolun bir kararla bittiğini ve her adımda seçilebilecek bir şey olduğunu denetler.
//
//   npm test                                   → klasördeki bütün davalar
//   npx tsx tools/simulate.ts dosya1.json ...  → yalnızca verilen dosyalar
import fs from "fs";
import path from "path";
import { normalizeCase, validateCase } from "../src/engine/engine";
import { CaseFile } from "../src/engine/types";
import { simulateCase } from "../src/engine/simulate";
import { hasFreeStep, lengthCues } from "../src/engine/lint";

const dir = path.join(__dirname, "../src/data/cases");
const args = process.argv.slice(2);
const files = args.length ? args : fs.readdirSync(dir).filter(f => f.endsWith(".json")).map(f => path.join(dir, f));
let failures = 0;
const cue = { steps: 0, correctLongest: 0, correctShortest: 0 };

for (const file of files) {
  let c: CaseFile;
  try { c = normalizeCase(JSON.parse(fs.readFileSync(file, "utf8"))); }
  catch (e) { failures++; console.log(`✗ ${path.basename(file)}: JSON okunamadı — ${(e as Error).message}`); continue; }
  const errs = validateCase(c);
  if (errs.length) { failures++; console.log(`✗ ${c.id} doğrulama:\n  ` + errs.join("\n  ")); continue; }
  const r = simulateCase(c);
  if (r.problems.length) { failures++; console.log(`✗ ${c.id}:\n  ` + r.problems.slice(0, 10).join("\n  ")); continue; }
  // Biçimsel ipuçları: uzunluğu ele veren seçenekler ve serbest cevap adımı.
  const lc = lengthCues(c);
  cue.steps += lc.stat.steps; cue.correctLongest += lc.stat.correctLongest; cue.correctShortest += lc.stat.correctShortest;
  const lint = [...lc.problems, ...(hasFreeStep(c) ? [] : ["serbest cevap (yazılı / sesli) adımı yok"])];
  if (lint.length) { failures++; console.log(`✗ ${c.id} içerik:\n  ` + lint.join("\n  ")); continue; }
  console.log(`✓ ${c.id}: ${r.paths} farklı yol${r.truncated ? " (sınırda kesildi)" : ""}, en uzun ${r.maxDepth} hamle → ${Object.entries(r.tally).map(([k, n]) => `${k} ${n}`).join(", ")}`);
}

// Uygulamaya kayıtlı olmayan dosya kalmasın
if (!args.length) {
  const index = fs.readFileSync(path.join(dir, "index.ts"), "utf8");
  fs.readdirSync(dir).filter(f => f.endsWith(".json")).forEach(f => {
    if (!index.includes(`"./${f}"`)) { failures++; console.log(`✗ ${f} src/data/cases/index.ts içinde kayıtlı değil`); }
  });
}

if (cue.steps) {
  const lp = Math.round(cue.correctLongest * 100 / cue.steps), sp = Math.round(cue.correctShortest * 100 / cue.steps);
  console.log(`Seçenekli adım: ${cue.steps} · doğru seçenek en uzun: %${lp} · en kısa: %${sp}`);
  // Bütün dosyalar denetlenirken doğru seçenek ne hep en uzun ne hep en kısa olmalı (rastgele beklenti ~%25-35).
  if (!args.length && (lp > 45 || sp > 45)) { failures++; console.log(`✗ Doğru seçeneğin uzunluğu genel olarak ele veriyor (en uzun %${lp}, en kısa %${sp}; sınır %45).`); }
}
if (failures) { console.log(`${failures} hata`); process.exit(1); }
console.log("Tüm denetimler geçti.");
