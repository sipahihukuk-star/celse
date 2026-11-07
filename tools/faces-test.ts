// Görsel ve akış denetimi (src/admin/visualAudit.ts) bütün davalarda: yüzler doğru tarafta, büroda yalnız sırası gelen
// avukat, yaşı yazmayan sivile yaşlı yüz yok, görüşmede tek şıklı soru yok. Yönetim panelindeki "Görsel denetim" de aynısını yapar.
// Çalıştırma: npx tsx tools/faces-test.ts
import "./stub-assets";
import fs from "fs";
import path from "path";
import { normalizeCase } from "../src/engine/engine";
import { CaseFile } from "../src/engine/types";
import { castFaces, faceAge } from "../src/ui/castFaces";
import { visualAudit } from "../src/admin/visualAudit";

const dir = path.join(__dirname, "../src/data/cases");
const cases: CaseFile[] = fs.readdirSync(dir).filter(f => f.endsWith(".json")).map(f => normalizeCase(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))));
const errs: string[] = [];
for (const c of cases) for (const i of visualAudit(c)) errs.push(`${c.id} · ${i.yer}: ${i.sorun}`);

// Bildirilen dava: Gülay Sezer orta yaşlı bir yüz almalı.
const nafaka = cases.find(c => c.id === "dk-yoksulluk-nafakasi")!;
const g = castFaces(nafaka, "av-erkek-58", false, "p2").gulay;
if ((faceAge(g) ?? 40) >= 60) errs.push(`dk-yoksulluk-nafakasi: Gülay Sezer yaşlı yüz aldı (${g})`);

if (errs.length) { console.error(errs.join("\n")); console.error(`\n${errs.length} hata`); process.exit(1); }
console.log(`Görsel denetim: ${cases.length} dava, hata yok. (Gülay Sezer: ${g})`);
