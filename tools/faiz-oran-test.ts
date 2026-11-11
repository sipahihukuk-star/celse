// Günlük faiz denetiminden gelen oranların tablolara eklenmesi ve 7589 s. Kanun yasal faiz hesabı (uydurma oranlarla).
import { faizOranlariniUygula, yasalTuret } from "../src/data/faizTablo";
import { AVANS, islemisFaiz, TTK1530, YASAL } from "../src/data/icra";
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };

const y = yasalTuret([["2025-12-20", 38.75], ["2026-09-01", 35], ["2027-03-01", 28]], "2027-11-11");
ok(JSON.stringify(y) === JSON.stringify([{ bas: "2027-01-01", oran: 28 }, { bas: "2027-07-01", oran: 22.4 }]), "yasal: 31 Aralık oranının %80'i, Haziran 5 puan ayrışınca ikinci yarı: " + JSON.stringify(y));
ok(yasalTuret([["2026-09-01", 35], ["2027-03-01", 33]], "2027-11-11").length === 1, "5 puandan az ayrışma: ikinci yarı yok");

const avansOnce = AVANS.length;
const n = faizOranlariniUygula([
  { tur: "avans", bas: "2025-12-20", oran: 39.75 },
  { tur: "avans", bas: "2026-12-26", oran: 36.5 },
  { tur: "reeskont", bas: "2025-12-20", oran: 38.75 },
  { tur: "reeskont", bas: "2026-12-26", oran: 35.5 },
  { tur: "ttk1530", bas: "2027-01-01", oran: 40 }
], "2027-02-01");
ok(AVANS.length === avansOnce + 1 && AVANS[AVANS.length - 1][0] === "2026-12-26", "yeni avans dönemi eklenir, var olan çoğalmaz");
ok(TTK1530[TTK1530.length - 1][1] === 40, "TTK 1530 yeni yıl");
ok(YASAL[YASAL.length - 1][0] === "2027-01-01" && YASAL[YASAL.length - 1][1] === 28.4, "2027 yasal faizi reeskonttan: " + JSON.stringify(YASAL.slice(-2)));
ok(n.n === 3, "eklenen sayısı: " + n.n);
const f = islemisFaiz(1000, "2026-12-01", "2027-01-31", "avans");
ok(f.dilimler.length === 2 && f.dilimler[1].oran === 36.5, "faiz hesabı yeni dönemi kullanır");
ok(faizOranlariniUygula([{ tur: "avans", bas: "2026-12-26", oran: 36.5 }], "2027-02-01").n === 0, "ikinci kez aynı oranlar: değişiklik yok");

if (fail) { console.log(`faiz-oran-test: ${fail} hata`); process.exit(1); }
console.log("faiz-oran-test: tamam");
