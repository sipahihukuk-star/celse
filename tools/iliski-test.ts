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

// Aynı taraflı çok föy: çift çift tekrar eden öneriler yerine tek grup önerisi.
{
  const icralar = [1, 2, 3, 4, 5].map(i => f({ tur: "icra", muvekkil: "Uydurma Alacaklı ve 1 diğeri", karsiTaraf: i === 3 ? "Kurgu Borçlu" : "Kurgu Borçlu ve 1 diğeri", foyNo: "İ-" + i }));
  const g = iliskiOner(icralar, new Set());
  ok(g.length === 1 && g[0].tur === "grup" && g[0].kopya === true && g[0].grup!.length === 5 && g[0].ciftler!.length === 10, "5 numarasız aynı taraflı icra föyü: 10 çift yerine tek 'kopya' grubu: " + g.map(o => o.tur + ":" + (o.grup?.length || 2)).join(","));
  const davalar = ["2026/11", "2026/12", "2026/13", "2026/14"].map(e => f({ tur: "hukuk", muvekkil: "Deneme Kişi İki", karsiTaraf: "Uydurma İnşaat A.Ş.", esasNo: e }));
  const g2 = iliskiOner(davalar, new Set());
  ok(g2.length === 1 && g2[0].tur === "grup" && !g2[0].kopya && g2[0].grup!.length === 4, "aynı taraflı 4 ayrı dava: tek 'ilgili' grubu");
  // Gruptakiler ilk föye bağlanınca (yıldız) hiçbir çift yeniden önerilmez.
  const [ilk, ...oteki] = davalar;
  const bagli = [{ ...ilk, ilgiliIds: oteki.map(x => x.id) }, ...oteki.map(x => ({ ...x, ilgiliIds: [ilk.id] }))];
  ok(iliskiOner(bagli, new Set()).length === 0, "zincirleme bağlı olanlar (B–A–C) bir daha önerilmez");
  // "Değil" denen grubun çiftleri reddedilince grup da gelmez.
  ok(iliskiOner(icralar, new Set([g[0].anahtar, ...g[0].ciftler!])).length === 0, "grup reddedilince bir daha gelmez");
  // "ve 1 diğeri" ortak sözcük sayılmaz: başka kişilerin föyleri kopya sanılmaz.
  const yabanci = [f({ tur: "icra", muvekkil: "Başka Kişi ve 1 diğeri", karsiTaraf: "Öteki Borçlu ve 1 diğeri" }), icralar[0]];
  ok(!iliskiOner(yabanci, new Set()).length, "“ve 1 diğeri” adları eşleştirmez");
  // İki numarasız kopya: "aynı dosya" önerisi (birleştirilebilir).
  ok(iliskiOner(icralar.slice(0, 2), new Set()).some(o => o.tur === "ayni"), "iki numarasız kopya: aynı dosya olabilir");
}

if (fail) { console.log(`iliski-test: ${fail} hata`); process.exit(1); }
console.log("iliski-test: tamam");
