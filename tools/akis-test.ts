// Kariyer: alınmayan dosyalar ay başında gider ve gelen dosya sayısı düşer; dosya kabul edildikçe yeniden artar.
// Hayat olayları seyrek gelir (evlilik ve çocuk hemen değil). React Native modülleri boş sayılır.
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */
const Module = require("module");
const yukle = Module._load;
Module._load = function (req: string, ...a: any[]) {
  if (/^(react-native|@react-native|expo|@expo)/.test(req) || /\.(webp|png|jpg|jpeg|mp3|m4a)$/.test(req)) return new Proxy({}, { get: () => () => ({}) });
  return yukle.call(this, req, ...a);
};
const fs = require("fs"), path = require("path");
const { deal, offerCount } = require("../src/data/flow");
const { dueEvent, newLife } = require("../src/data/life");

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const dir = path.join(__dirname, "../src/data/cases");
const pool = fs.readdirSync(dir).filter((f: string) => f.endsWith(".json")).map((f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
const bos = { offers: [], active: [], closed: {} as Record<string, unknown>, declined: {}, focus: [], seen: [], dealtFor: -1, src: {}, side: {}, specialty: [] };
// 9 kapalı dosya: temel teklif sayısı 5.
const kapali: Record<string, unknown> = {}; pool.slice(0, 9).forEach((c: any, i: number) => { kapali[c.id] = { won: true, score: 80, month: i + 1 }; });
let f: any = { ...bos, closed: kapali };
ok(offerCount(f) === 5, "temel teklif 5: " + offerCount(f));
f = deal(f, pool, {}, 10);
const ilk = f.offers.map((o: any) => o.id);
ok(f.offers.length === 5, "10. ay 5 teklif: " + f.offers.length);
f = deal(f, pool, {}, 11);
ok(f.kacan === 5 && f.akis === -1 && !f.offers.some((o: any) => ilk.includes(o.id)), "alınmayanlar gitti, akış düştü");
ok(f.offers.length === 4, "11. ay 4 teklif: " + f.offers.length);
f = deal(f, pool, {}, 12); f = deal(f, pool, {}, 13); f = deal(f, pool, {}, 14);
ok(f.akis === -3 && f.offers.length === 2, "akış −3, 2 teklif: " + f.akis + " / " + f.offers.length);
ok(f.offers.length >= 1 && f.declined[ilk[0]] === 11, "giden dosya bir süre gelmez");
// Kabul ettikçe artar: her kabul +0,5.
f = { ...f, akis: -3 + 0.5 * 4 };
ok(offerCount(f) === 4, "iki-üç dosya alınca artar: " + offerCount(f));
// Masa doluyken giden dosya akışı düşürmez.
const g = deal({ ...bos, closed: kapali, active: ["a", "b", "c"], offers: [{ id: pool[20].id, month: 5 }], akis: 0 }, pool, {}, 6);
ok(g.akis === 0 && g.kacan === 1, "masa doluyken ceza yok");

// Hayat: her olayda "evet" seçen oyuncu.
let l = newLife("izmir"); const ay: Record<string, number[]> = {};
for (let m = 1; m <= 72; m++) {
  const ctx = { life: l, month: m, cash: 5e6, casesThisYear: 0, wins: Math.floor(m * 0.6) };
  const e = dueEvent(ctx); if (!e) continue;
  const ch = e.choices(ctx)[0];
  l = ch.apply ? ch.apply(l, m) : l;
  l = { ...l, lastEventAt: m, sorulan: { ...(l.sorulan || {}), [e.id]: m }, done: [...l.done, e.id], snooze: { ...l.snooze, [e.id]: m + (ch.snooze || (e.repeat ? 1 : 0)) } };
  (ay[e.id] = ay[e.id] || []).push(m);
}
ok((ay.evlilik?.[0] || 0) >= 18, "evlilik 18. aydan önce gelmez: " + ay.evlilik);
ok((ay.cocuk?.[0] || 0) >= 36 && (!ay.cocuk[1] || ay.cocuk[1] - ay.cocuk[0] >= 30), "çocuklar seyrek: " + ay.cocuk);
const hepsi = Object.values(ay).flat().sort((a, b) => a - b);
ok(hepsi.every((m, i) => !i || m - hepsi[i - 1] >= 3), "olaylar arası en az 3 ay");
ok(Object.keys(ay).length >= 12, "farklı olaylar çıkar: " + Object.keys(ay).join(","));
if (fail) { console.log(`akis-test: ${fail} hata`); process.exit(1); }
console.log("akis-test: tamam");
