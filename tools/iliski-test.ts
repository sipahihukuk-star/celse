// Föyler arası bağlantı önerileri: uydurma (sentetik) föylerle.
import { bosFoy, Foy } from "../src/data/foy";
import { ciftAnahtari, iliskiOner } from "../src/data/iliski";
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const ev = (id: string, metin: string) => ({ id, ad: id + ".udf", boyut: 1, eklenme: "2026-01-01T00:00:00Z", metin });
const f = (k: Partial<Foy>) => bosFoy(k);

const arb = f({ tur: "arabuluculuk", muvekkil: "Deneme Kişi Bir", karsiTaraf: "Uydurma Yapı A.Ş.", esasNo: "2026/4411" });
const dava = f({ tur: "hukuk", muvekkil: "DENEME KİŞİ BİR", karsiTaraf: "Uydurma Yapı AŞ", mahkeme: "İzmir 3. Asliye Hukuk Mahkemesi", esasNo: "2026/321",
  evraklar: [ev("e1", "Dava şartı arabuluculuk son tutanağı (Büro No 2026/4411) ektedir.")] });
const ikinci = f({ tur: "hukuk", muvekkil: "Deneme Kişi Bir", karsiTaraf: "Uydurma Yapı A.Ş.", mahkeme: "İzmir 5. Sulh Hukuk Mahkemesi", esasNo: "2026/77" });
const baska = f({ tur: "hukuk", muvekkil: "Deneme Kişi Bir", karsiTaraf: "Başka Karşı Taraf", esasNo: "2026/999" });
const kopya = f({ tur: "hukuk", muvekkil: "Deneme Kişi Bir", mahkeme: "İzmir 3. Asliye Hukuk Mahkemesi", esasNo: "2026/321" });
const sor = f({ tur: "sorusturma", muvekkil: "Örnek Müşteki", karsiTaraf: "Örnek Şüpheli", esasNo: "2025/12345" });
const ceza = f({ tur: "ceza", muvekkil: "Örnek Müşteki", mahkeme: "İzmir 7. Asliye Ceza Mahkemesi", esasNo: "2026/600",
  evraklar: [ev("e2", "İzmir Cumhuriyet Başsavcılığının 2025/12345 soruşturma sayılı iddianamesi"), ev("e3", "T.C.\nİZMİR 5. SULH HUKUK MAHKEMESİ\nESAS NO : 2026/77\nDAVACI : X")] });

const r = iliskiOner([arb, dava, ikinci, baska, kopya, sor, ceza], new Set());
const bul = (a: Foy, b: Foy, tur: string) => r.find(o => o.tur === tur && ((o.a.id === a.id && o.b.id === b.id) || (tur !== "zincir" && o.a.id === b.id && o.b.id === a.id)));
ok(!!bul(arb, dava, "zincir"), "arabuluculuk → hukuk davası zinciri");
ok(!!bul(dava, ikinci, "ilgili"), "aynı taraflar arasındaki iki dava ilgili");
ok(!r.some(o => [o.a.id, o.b.id].includes(baska.id) && o.tur !== "evrak"), "yalnız aynı müvekkil yetmez");
ok(!!bul(dava, kopya, "ayni"), "aynı mahkeme ve esas: iki kez açılmış");
ok(!!bul(sor, ceza, "zincir"), "soruşturma → ceza davası (numara evrakta geçiyor)");
ok(r.some(o => o.tur === "evrak" && o.a.id === ceza.id && o.b.id === ikinci.id && o.evrak?.id === "e3"), "yanlış föydeki evrak");
const r2 = iliskiOner([arb, dava], new Set([ciftAnahtari(arb.id, dava.id, "zincir")]));
ok(!r2.some(o => o.tur === "zincir"), "“Değil” denen bir daha önerilmez");
const r3 = iliskiOner([arb, { ...dava, oncekiId: arb.id }], new Set());
ok(!r3.length, "bağlı olanlar önerilmez");

if (fail) { console.log(`iliski-test: ${fail} hata`); process.exit(1); }
console.log("iliski-test: tamam");
