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

const dir = path.join(__dirname, "../src/data/cases");
const args = process.argv.slice(2);
const files = args.length ? args : fs.readdirSync(dir).filter(f => f.endsWith(".json")).map(f => path.join(dir, f));
let failures = 0;

for (const file of files) {
  let c: CaseFile;
  try { c = normalizeCase(JSON.parse(fs.readFileSync(file, "utf8"))); }
  catch (e) { failures++; console.log(`✗ ${path.basename(file)}: JSON okunamadı — ${(e as Error).message}`); continue; }
  const errs = validateCase(c);
  if (errs.length) { failures++; console.log(`✗ ${c.id} doğrulama:\n  ` + errs.join("\n  ")); continue; }
  const r = simulateCase(c);
  if (r.problems.length) { failures++; console.log(`✗ ${c.id}:\n  ` + r.problems.slice(0, 10).join("\n  ")); continue; }
  console.log(`✓ ${c.id}: ${r.paths} farklı yol${r.truncated ? " (sınırda kesildi)" : ""}, en uzun ${r.maxDepth} hamle → ${Object.entries(r.tally).map(([k, n]) => `${k} ${n}`).join(", ")}`);
}

// Uygulamaya kayıtlı olmayan dosya kalmasın
if (!args.length) {
  const index = fs.readFileSync(path.join(dir, "index.ts"), "utf8");
  fs.readdirSync(dir).filter(f => f.endsWith(".json")).forEach(f => {
    if (!index.includes(`"./${f}"`)) { failures++; console.log(`✗ ${f} src/data/cases/index.ts içinde kayıtlı değil`); }
  });
}

if (failures) { console.log(`${failures} hata`); process.exit(1); }
console.log("Tüm denetimler geçti.");
