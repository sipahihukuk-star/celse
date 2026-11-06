// Yüz ve sahne denetimi:
//  1) Karşılıklı davada oyuncu p2'yi oynuyorsa büroda ve salonda kendi yüzü p2'de, karşı vekil başka bir yüzde.
//  2) Karşılıklı davada büroda yalnız sırası gelen tarafın avukatı görünür (karşı vekil müvekkil görüşmesine girmez).
//  3) Metinde yaşı yazmayan, saçı kır olmayan sivil kişiye yaşlı yüz (kır saçlı 62, başörtülü 72) verilmez.
//  4) Görüşmelerde son soruda da seçim kalır (tek şıklı soru olmaz).
// Çalıştırma: npx tsx tools/faces-test.ts
import "./stub-assets";
import fs from "fs";
import path from "path";
import { choicesOf, findNextStep, applyChoice, createGame, normalizeCase, validateCase } from "../src/engine/engine";
import { CaseFile } from "../src/engine/types";
import { castFaces, faceAge, isOld } from "../src/ui/castFaces";
import { castHints } from "../src/ui/castText";
import { stageLayout } from "../src/ui/stageLayout";

const dir = path.join(__dirname, "../src/data/cases");
const cases: CaseFile[] = fs.readdirSync(dir).filter(f => f.endsWith(".json")).map(f => normalizeCase(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))));
const errs: string[] = [];
const av = "av-erkek-58" as const;

for (const c of cases) {
  // 1 ve 2
  if (c.mode === "duel" && c.room !== "tahkim") for (const side of ["p1", "p2"] as const) {
    const f = castFaces(c, av, false, side);
    const other = side === "p1" ? "p2" : "p1";
    if (f[side] !== av) errs.push(`${c.id} ${side}: oyuncunun yüzü kendi tarafında değil`);
    if (f[other] === av) errs.push(`${c.id} ${side}: karşı vekil oyuncunun yüzünü taşıyor`);
    c.steps.forEach((st, i) => {
      if (st.scene !== "office") return;
      const guest = Object.keys(c.cast).find(r => !/^(judge|p1|p2)$/.test(r)) || null;
      const L = stageLayout({ c, scene: "office", faces: f, focus: null, guest, W: 1200, H: 600, side: st.side });
      const keys = L.figs.map(x => x.key);
      if (!keys.includes(st.side)) errs.push(`${c.id} adım ${i + 1}: büroda sırası gelen avukat (${st.side}) yok`);
      if (keys.includes(st.side === "p1" ? "p2" : "p1")) errs.push(`${c.id} adım ${i + 1}: büroda karşı vekil de görünüyor`);
    });
  }
  // 3
  const f = castFaces(c, av, false);
  const hints = castHints(c);
  for (const [r, m] of Object.entries(c.cast)) {
    if (m.look?.kind !== "civil" || hints[r]?.age !== undefined || isOld(m.look)) continue;
    if ((faceAge(f[r]) ?? 40) >= 60 && /^mv-/.test(f[r])) errs.push(`${c.id} ${r} (${m.name}): yaşı belirtilmemiş kişiye yaşlı yüz ${f[r]}`);
  }
  // 4: içerik kuralı ve oyun akışı (her soruda en az iki soru seçeneği)
  for (const e of validateCase(c)) if (/görüşmede/.test(e)) errs.push(`${c.id}: ${e}`);
  c.steps.forEach((st, i) => {
    if (st.kind !== "interview") return;
    let g = createGame(c, { p1: { name: "A", ai: false }, p2: { name: "B", ai: false } } as any);
    g = { ...g, stepIdx: i, flags: {} };
    for (let k = 0; k < 10 && findNextStep(c, g) === i; k++) {
      const ch = choicesOf(c, g, i);
      const sorular = ch.filter(x => !x.finish).length;
      if (sorular < 2 && (g.asked[i] || []).length > 0) { errs.push(`${c.id} adım ${i + 1}: tek şıklı soru`); break; }
      g = applyChoice(c, g, i, ch.findIndex(x => !x.finish), "A");
    }
  });
}

// Bildirilen dava: Gülay Sezer orta yaşlı bir yüz almalı.
const nafaka = cases.find(c => c.id === "dk-yoksulluk-nafakasi")!;
const g = castFaces(nafaka, av, false, "p2").gulay;
if ((faceAge(g) ?? 40) >= 60) errs.push(`dk-yoksulluk-nafakasi: Gülay Sezer yaşlı yüz aldı (${g})`);

if (errs.length) { console.error(errs.join("\n")); console.error(`\n${errs.length} hata`); process.exit(1); }
console.log(`Yüz ve sahne denetimi: ${cases.length} dava, hata yok. (Gülay Sezer: ${g})`);
