// AAÜT asgari ücret ve başlangıç giderleri (uydurma föylerle).
import { bosFoy } from "../src/data/foy";
import { asgariUcret, davaDegeriBul, giderTahmini, mahkemeTuru } from "../src/data/ucretTarife";
let fail = 0;
const ok = (c: unknown, m: string) => { if (c) console.log("✓ " + m); else { fail++; console.log("✗ " + m); } };
const BUGUN = "2026-11-14";
const asliye = bosFoy({ tur: "hukuk", mahkeme: "Uydurma 3. Asliye Hukuk Mahkemesi", acilis: "2026-11-10" });
ok(mahkemeTuru(asliye) === "asliye" && asgariUcret(asliye, undefined, BUGUN).guncel.asgari === 62000, "asliye maktu 62.000 TL (2026–2027)");
const a1 = asgariUcret(asliye, 1000000, BUGUN);
ok(a1.guncel.nispi === 158000 && a1.guncel.asgari === 158000, "1.000.000 TL dava değeri: nispi 158.000 TL: " + JSON.stringify(a1.guncel));
const sulh = bosFoy({ tur: "hukuk", mahkeme: "Uydurma 2. Sulh Hukuk Mahkemesi", acilis: "2026-11-05" });
ok(asgariUcret(sulh, 100000, BUGUN).guncel.asgari === 40000, "sulh: nispi 16.000 maktu 40.000'in altında, 40.000");
const eski = bosFoy({ tur: "hukuk", mahkeme: "Uydurma 5. Asliye Ticaret Mahkemesi", acilis: "2026-01-10" });
const ae = asgariUcret(eski, undefined, BUGUN);
ok(ae.acilis?.tarife === "2025–2026 AAÜT" && ae.acilis.maktu === 45000, "açılış tarihindeki tarife: 2025–2026 asliye 45.000");
ok(asgariUcret(bosFoy({ tur: "hukuk", mahkeme: "Uydurma 1. Tüketici Mahkemesi" }), undefined, BUGUN).guncel.asgari === 30000, "tüketici 30.000");
ok(asgariUcret(bosFoy({ tur: "ceza", mahkeme: "Uydurma 4. Ağır Ceza Mahkemesi" }), 5000000, BUGUN).guncel.asgari === 86000, "ağır ceza maktu 86.000 (dava değeri işlemez)");
ok(asgariUcret(bosFoy({ tur: "icra" }), 50000, BUGUN).guncel.asgari === 12500, "icra 50.000 TL takip: 12.500");
// Giderler
const g = giderTahmini({ ...asliye, taraf: "davaci" }, 100000);
ok(g.kalemler.map(k => k.kod + ":" + k.tutar).join(",") === "basvurma:732,pesin:1707.75,avans:3530", "asliye davacı 100.000 TL: " + g.kalemler.map(k => k.kod + ":" + k.tutar).join(","));
ok(giderTahmini({ ...sulh, taraf: "davaci" }).kalemler[0].tutar === 335.2, "sulh başvurma 335,20");
ok(giderTahmini({ ...asliye, taraf: "davali" }).kalemler.map(k => k.kod).join() === "istinaf,temyiz", "davalı: açılışta harç yok, kanun yolu harçları");
const gi = giderTahmini({ ...bosFoy({ tur: "icra" }), icra: { ekBorclular: [{}] } }, 100000);
ok(gi.kalemler.map(k => k.tutar).join() === "732,500,600", "icra: başvurma, binde 5 peşin, 2 borçluya tebligat");
ok(!giderTahmini(bosFoy({ tur: "ceza", mahkeme: "Uydurma 4. Asliye Ceza Mahkemesi" })).kalemler.length, "ceza davasında harç yok");
ok(davaDegeriBul(["DAVA DEĞERİ : 250.000,00 TL"]) === 250000 && davaDegeriBul(["Harca esas değer 75.500 TL"]) === 75500, "dava değeri evraktan okunur");
if (fail) { console.log(`ucret-test: ${fail} hata`); process.exit(1); }
console.log("ucret-test: tamam");
