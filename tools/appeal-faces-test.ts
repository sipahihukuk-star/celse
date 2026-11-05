// Kanun yolu aşamalarında (istinaf, temyiz, istinafa cevap) ilk derecedeki kişilerin yüzleri ve sesleri değişmemeli;
// üst mahkemenin hâkimi ise ilk derece hâkiminden farklı bir yüz olmalı.  Çalıştırma: npx tsx tools/appeal-faces-test.ts
import "./stub-assets";
import fs from "fs";
import path from "path";
import { appealCase } from "../src/engine/appeal";
import { normalizeCase } from "../src/engine/engine";
import { CaseFile } from "../src/engine/types";
import { castFaces, speakerId } from "../src/ui/castFaces";

const dir = path.join(__dirname, "../src/data/cases");
const cases: CaseFile[] = fs.readdirSync(dir).filter(f => f.endsWith(".json")).map(f => normalizeCase(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))));
let n = 0; const errs: string[] = [];
for (const base of cases) {
  if (base.room === "tahkim" || base.room === "uluslararasi") continue;
  for (const side of (base.mode === "duel" ? ["p1", "p2"] : ["p1"]) as ("p1" | "p2")[]) {
    for (const kind of ["istinaf", "temyiz", "cevap"] as const) {
      let a: CaseFile;
      try { a = appealCase(base, kind, { side }); } catch { continue; }
      n++;
      // Oyuncunun seçtiği karakter: ilk derecede kendi tarafında, kanun yolunda yine onda; karşı vekil asla onun yüzünü almaz.
      const av = "av-erkek-38" as const;
      const bA = castFaces(base, av, false, side), aA = castFaces(a, av, false);
      if (base.mode === "duel" && bA[side] !== av) errs.push(`${base.id} ${side}: oyuncunun karakteri kendi tarafında değil`);
      if (aA.p1 !== av) errs.push(`${base.id} ${kind} ${side}: kanun yolunda oyuncunun karakteri yok`);
      for (const [r, k] of Object.entries(aA)) if (r !== "p1" && k === av) errs.push(`${base.id} ${kind} ${side}: ${r} oyuncunun yüzünü taşıyor`);
      for (const female of [false, true]) {
        const bm = castFaces(base, null, female, side), am = castFaces(a, null, female);
        for (const [r, br] of Object.entries(a.appealOf?.same || {})) {
          if (bm[br] && (r === "p1" || r in a.cast) && !am[r]) errs.push(`${base.id} ${kind} ${side}: ${r} yüzsüz kaldı`);
          if (am[r] && bm[br] && am[r] !== bm[br]) errs.push(`${base.id} ${kind} ${side}: ${r} yüzü değişti (${bm[br]} → ${am[r]})`);
          if (am[r] && bm[br] && speakerId(a, r, am[r], false) !== speakerId(base, br, bm[br], base.mode === "duel")) errs.push(`${base.id} ${kind} ${side}: ${r} sesi değişti`);
        }
        if (am.judge && bm.judge && am.judge === bm.judge) errs.push(`${base.id} ${kind}: üst mahkeme hâkimi ilk derece hâkimiyle aynı yüz`);
      }
    }
  }
}
console.log(`Kanun yolu kadrosu: ${n} aşama denetlendi.`);
if (errs.length) { console.log(errs.slice(0, 30).join("\n")); console.log(`${errs.length} sorun`); process.exit(1); }
console.log("Kanun yolu kadro denetimleri geçti.");
