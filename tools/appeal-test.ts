// Kanun yolu denetimi (npm test'in ikinci yarısı):
//  1) süre hesabı: tebliğ + süre, hafta sonu ve resmî tatil kaydırması, adli tatil
//  2) kesinlik: kanunYolu() parasal sınır, ceza türü ve kanunda kesin karar kuralları
//  3) her davanın kanun yolu aşamaları (elle yazılmış ve temel): şema doğrulaması + bütün yolların oynatılması
//
//   npx tsx tools/appeal-test.ts               → bütün davalar
//   npx tsx tools/appeal-test.ts dosya.json    → yalnızca verilen dosyalar
import fs from "fs";
import path from "path";
import { allStages, appealCase, kanunYolu, nextAppeal, petitionOf, validateAppeals } from "../src/engine/appeal";
import { gradeDeadline, lastDay, fmtDate } from "../src/engine/deadline";
import { applyChoice, choicesOf, createGame, findNextStep, normalizeCase, validateCase } from "../src/engine/engine";
import { lengthCues } from "../src/engine/lint";
import { simulateCase } from "../src/engine/simulate";
import { PARASAL_SINIR } from "../src/engine/sinirlar";
import { CaseFile } from "../src/engine/types";

let failures = 0;
const ok = (cond: boolean, msg: string) => { if (!cond) { failures++; console.log("✗ " + msg); } };

// 1) Süre hesabı
const eq = (teblig: string, rule: { days?: number; weeks?: number }, want: string, regime?: "hmk" | "cmk" | "iyuk") => {
  const got = fmtDate(lastDay({ teblig, law: "test", ...rule }, regime).last);
  ok(got === want, `süre: tebliğ ${teblig} + ${rule.weeks ? rule.weeks + " hafta" : rule.days + " gün"} → ${want} beklenirdi, ${got} çıktı`);
};
eq("19.04.2027", { weeks: 2 }, "03.05.2027");           // Pazartesi → iki hafta sonra Pazartesi
eq("16.04.2027", { weeks: 2 }, "30.04.2027");           // Cuma → Cuma
eq("17.04.2027", { weeks: 2 }, "03.05.2027");           // son gün 1 Mayıs Cumartesi (aynı zamanda tatil) → Pazartesi
eq("15.04.2027", { weeks: 2 }, "29.04.2027");
eq("05.10.2026", { days: 30 }, "04.11.2026");           // Çarşamba
eq("29.09.2026", { days: 30 }, "30.10.2026");           // 29 Ekim Cumhuriyet Bayramı → 30 Ekim Cuma
eq("02.05.2027", { weeks: 2 }, "20.05.2027");           // 16 Mayıs Pazar + Kurban Bayramı 16–19 Mayıs → 20 Mayıs
eq("10.07.2026", { weeks: 2 }, "07.09.2026", "hmk");    // 24 Temmuz adli tatilde → 7 Eylül (HMK m.104)
eq("10.07.2026", { weeks: 2 }, "03.09.2026", "cmk");    // CMK m.331/4: üç gün
const g = gradeDeadline({ teblig: "19.04.2027", weeks: 2, law: "HMK m.345" }, "3.5.2027");
ok(!!g && g.score === 100, "süre: 3.5.2027 doğru kabul edilmeli");
ok(gradeDeadline({ teblig: "19.04.2027", weeks: 2, law: "HMK m.345" }, "02.05.2027")?.score === 50, "süre: erken gün 50 puan");
ok(gradeDeadline({ teblig: "19.04.2027", weeks: 2, law: "HMK m.345" }, "04.05.2027")?.score === 0, "süre: geç gün 0 puan");
ok(gradeDeadline({ teblig: "19.04.2027", weeks: 2, law: "HMK m.345" }, "31.02.2027") === null, "süre: geçersiz tarih reddedilmeli");

// 2) Kesinlik
const dir = path.join(__dirname, "../src/data/cases");
const load = (f: string): CaseFile => normalizeCase(JSON.parse(fs.readFileSync(f, "utf8")));
const byId = (id: string) => load(path.join(dir, id + ".json"));
{
  const c = byId("is-ucret-hakli-fesih");
  ok(kanunYolu(c).istinaf.open, "kesinlik: iş davasında istinaf açık olmalı");
  // Parasal sınır: yalnız sınır tanımlıysa uygulanır (sinirlar.ts); test geçici bir sınırla yapılır.
  const y = 2026, keep = PARASAL_SINIR[y];
  PARASAL_SINIR[y] = { ...keep, hmkIstinaf: 50000, hmkTemyiz: 600000 };
  const small = { ...c, kanunYolu: { deger: 30000, yil: y } };
  const w = kanunYolu(small).istinaf;
  ok(!w.open && /HMK m\.341/.test((w as any).reason), "kesinlik: sınırın altındaki dava istinafa kapalı olmalı (HMK m.341)");
  const mid = { ...c, kanunYolu: { deger: 400000, yil: y } };
  ok(kanunYolu(mid).istinaf.open && !kanunYolu(mid).temyiz.open, "kesinlik: istinaf sınırının üstü, temyiz sınırının altı");
  PARASAL_SINIR[y] = keep;
  const ceza = byId("agir-oldurmeye-tesebbus");
  ok(!kanunYolu(ceza, { stage: { winner: "p2", hukum: "", summary: "", ceza: { hapisAy: 36 } } }).temyiz.open, "kesinlik: 3 yıl hapiste temyiz kapalı (CMK m.286/2-a)");
  ok(kanunYolu(ceza, { stage: { winner: "p2", hukum: "", summary: "", ceza: { hapisAy: 120 } } }).temyiz.open, "kesinlik: 10 yıl hapiste temyiz açık");
  ok(!kanunYolu(ceza, { outcome: { winner: "p2", hukum: "", summary: "", ceza: { adliParaTL: 2000 } } }).istinaf.open, "kesinlik: 2.000 TL adli para cezasında istinaf kapalı (CMK m.272/3-a)");
  const idare = byId("idare-disiplin-savunma");
  ok(!kanunYolu(idare, { stage: { winner: "p2", hukum: "", summary: "", karar: "ret" } }).temyiz.open, "kesinlik: kınamada BİM ret kararı kesin (İYUK m.45/6)");
  ok(kanunYolu(idare, { stage: { winner: "p2", hukum: "", summary: "", karar: "kaldirma" } }).temyiz.open, "kesinlik: BİM kaldırıp yeniden karar verirse temyiz açık (İYUK m.46/2)");
  const bam = byId("bam-kaldirip-gonderme");
  ok(!kanunYolu(bam).istinaf.open, "kesinlik: bölge adliye kararına karşı istinaf olmaz");
  ok(!kanunYolu(bam, { stage: { winner: "p2", hukum: "", summary: "", karar: "gonderme" } }).temyiz.open, "kesinlik: gönderme kararı kesin (HMK m.353/1-a)");
}

// 3) Bütün davaların kanun yolu aşamaları
const args = process.argv.slice(2);
const files = args.length ? args : fs.readdirSync(dir).filter(f => f.endsWith(".json")).map(f => path.join(dir, f));
let stages = 0, hand = 0;
for (const f of files) {
  const c = load(f);
  const errs = validateAppeals(c, validateCase);
  if (errs.length) { failures++; console.log(`✗ ${c.id} kanun yolu doğrulama:\n  ` + errs.slice(0, 8).join("\n  ")); continue; }
  for (const s of allStages(c)) {
    stages++;
    const r = simulateCase(s, 20000);
    const lint = s.appealOf!.basic ? [] : lengthCues(s).problems;
    if (!s.appealOf!.basic) {
      hand++;
      if (!r.truncated && r.unreachedSteps.length) lint.push(`hiçbir yolda ulaşılmayan adımlar: ${r.unreachedSteps.join(", ")}`);
    }
    if (r.problems.length || lint.length) { failures++; console.log(`✗ ${s.id}:\n  ` + [...r.problems, ...lint].slice(0, 8).join("\n  ")); }
  }
}
// Dilekçe önizlemesi ve sıradaki kanun yolu: bir oyunu en iyi hamlelerle oynat.
{
  const c = byId("is-ucret-hakli-fesih");
  const s = appealCase(c, "istinaf");
  let st = createGame(s, { p1: { name: "A", ai: false }, p2: { name: "B", ai: false } });
  for (let i = findNextStep(s, st); i !== -1; i = findNextStep(s, st)) {
    const list = choicesOf(s, st, i);
    if (s.steps[i].kind === "dilekce") {
      const p = petitionOf(s, st, i);
      ok(p.sections.length >= 3, `dilekçe önizlemesi en az üç bölüm içermeli (${p.sections.map(x => x.title).join(", ")})`);
    }
    const best = s.steps[i].kind === "date" || s.steps[i].kind === "free" ? 0 : list.reduce((b, ch, k) => (ch.delta > list[b].delta ? k : b), 0);
    st = applyChoice(s, st, i, best, "A", s.steps[i].kind === "date" || s.steps[i].kind === "free" ? { answer: "x", score: 100 } : undefined);
  }
  ok(!st.fatal, "en iyi hamlelerle istinaf süre yönünden reddedilmemeli");
  ok(nextAppeal(s, st, c, "p1", undefined).offer === undefined, "kazanılan istinaftan sonra temyiz önerilmemeli");
}
console.log(`Kanun yolu: ${stages} aşama denetlendi (${hand} elle yazılmış).`);
if (failures) { console.log(`${failures} hata`); process.exit(1); }
console.log("Kanun yolu denetimleri geçti.");
