// Beyan taslakları büro eşitlemesinde kimliğe göre birleşir; aynı taslağın en son düzenlenen hâli kalır, silinen geri gelmez.
// React Native ve Expo modülleri boş sayılır; ağa gidilmez (uydurma verilerle).
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */
const Module = require("module");
const yukle = Module._load;
Module._load = function (req: string, ...a: any[]) {
  if (/^(react-native|@react-native|expo|@expo|@supabase)/.test(req)) return new Proxy({}, { get: () => () => ({}) });
  return yukle.call(this, req, ...a);
};
const { surumBirlestir, gelenFoy } = require("../src/data/foyBulut");
const { bosFoy } = require("../src/data/foy");
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const f = bosFoy({ muvekkil: "Uydurma Kişi" });
const b = { id: "b1", olusturma: "2026-11-09T10:00:00Z", guncelleme: "2026-11-09T10:00:00Z", tur: "Beyan dilekçesi", konu: "", metin: "ilk" };
const x = { ...f, beyanlar: [b, { ...b, id: "b2", metin: "ikinci" }] };
const y = { ...f, beyanlar: [{ ...b, metin: "yeni hâli", guncelleme: "2026-11-09T11:00:00Z" }, { ...b, id: "b3", metin: "üçüncü" }] };
const m = surumBirlestir(x, y);
ok(m.beyanlar?.length === 3 && m.beyanlar.find((z: any) => z.id === "b1")?.metin === "yeni hâli", "taslaklar birleşir, en yeni kalır: " + JSON.stringify(m.beyanlar?.map((z: any) => z.id + ":" + z.metin)));
const m2 = surumBirlestir({ ...x, beyanlar: [b], silinen: ["b2"] }, { ...y, beyanlar: [...y.beyanlar, { ...b, id: "b2", metin: "ikinci" }] });
ok(!m2.beyanlar?.some((z: any) => z.id === "b2"), "silinen taslak geri gelmez");
// Bağlantılar: öbür cihazın daha yeni ama bağlantısız sürümü gelince "devamı" ve "ilgili" kaybolmaz.
const yerelF = { ...f, guncelleme: "2026-11-10T10:00:00Z", oncekiId: "onceki1", ilgiliIds: ["i1"] };
const uzakF = { ...f, guncelleme: "2026-11-10T12:00:00Z", notlar: "uzakta not", ilgiliIds: ["i2"] };
const g = gelenFoy(uzakF, yerelF, false).f;
ok(g?.oncekiId === "onceki1" && g?.ilgiliIds?.sort().join() === "i1,i2" && g?.notlar === "uzakta not", "bağlantılar korunur: " + JSON.stringify([g?.oncekiId, g?.ilgiliIds]));
if (fail) { console.log(`beyan-esitle-test: ${fail} hata`); process.exit(1); }
console.log("beyan-esitle-test: tamam");
