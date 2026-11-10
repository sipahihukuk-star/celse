// Föy birleştirme ve tür tahmini (uydurma verilerle).
import { bosFoy } from "../src/data/foy";
import { foylariBirlestir, kalacakFoy } from "../src/data/foyBirlestir";
import { turTahmin } from "../src/data/foyTurleri";
import { ayniDosyaMi, ayniGruplari, iliskiOner } from "../src/data/iliski";
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const ev = (id: string, ad: string, boyut = 100) => ({ id, ad, boyut, eklenme: "2026-01-01", metin: "x" });
const a = bosFoy({ muvekkil: "Deneme Kişi", mahkeme: "İzmir 2. Asliye Hukuk Mahkemesi", esasNo: "2023/311", notlar: "A notu", olusturma: "2026-01-01T00:00:00Z",
  evraklar: [ev("e1", "dava.udf"), ev("e2", "cevap.udf")], gorevler: [{ id: "g1", metin: "Delil listesi", bitti: false, kaynak: "elle" }] });
const b = bosFoy({ karsiTaraf: "Örnek A.Ş.", mahkeme: "İzmir 2. Asliye Hukuk Mahkemesi", esasNo: "2023/311", notlar: "B notu", olusturma: "2026-02-01T00:00:00Z", durum: "acik",
  evraklar: [ev("e9", "dava.udf"), ev("e3", "bilirkisi.pdf")], gorevler: [{ id: "g2", metin: "Delil listesi", bitti: false, kaynak: "elle" }, { id: "g3", metin: "Duruşma", bitti: false, kaynak: "elle" }],
  durusmalar: [{ id: "d1", tarih: "2026-12-01T10:00" }] as never, ilgiliIds: ["x1"] });
const [k, g] = kalacakFoy(a, b);
ok(k.id === b.id && g.id === a.id, "daha dolu olan (işi ve duruşması çok) kalır");
const y = foylariBirlestir(k, g);
ok(y.id === b.id && y.evraklar.map(e => e.id).join() === "e9,e3,e2", "evrak birleşir, aynı ad ve boyutlu bir kez: " + y.evraklar.map(e => e.id));
ok(y.gorevler.map(x => x.id).join() === "g2,g3", "aynı iş bir kez: " + y.gorevler.map(x => x.id));
ok(y.karsiTaraf === "Örnek A.Ş." && y.muvekkil === "Deneme Kişi", "boş alan ötekinden dolar");
ok(y.notlar === "B notu\n\nA notu" && (y.durusmalar || []).length === 1 && (y.ilgiliIds || []).join() === "x1", "notlar, duruşmalar, ilgili bağlantılar");
ok(turTahmin("", "Diyarbakır Bölge Adliye Mahkemesi 3. Hukuk Dairesi", "karar.udf", "Davacı işçinin disiplin cezasının iptali ... şikâyet") === "hukuk", "BAM hukuk dairesi (metinde disiplin geçse de) hukuk");
ok(turTahmin("", "Ankara Bölge Adliye Mahkemesi 5. Ceza Dairesi", "", "şikâyetçi") === "ceza", "BAM ceza dairesi ceza");
ok(turTahmin("", "İl Sağlık Müdürlüğü", "", "hakkında disiplin soruşturması") === "idari_sorusturma", "kurum disiplin soruşturması yine disiplin");
ok(turTahmin("", "İzmir Cumhuriyet Başsavcılığı", "", "suç duyurusu") === "sorusturma", "savcılık soruşturma");
// Aynı dosya: esas no aynı (sıfır, "E." farkı), merci ve taraflar çelişmiyor, en az bir olumlu işaret
const F = (o: Record<string, unknown>) => bosFoy(o as never);
const d1 = F({ mahkeme: "Bismil 2. Asliye Hukuk Mahkemesi Sayın Hakimliği", esasNo: "2023/311", muvekkil: "Deneme Kişi", karsiTaraf: "Örnek Ltd." });
const d2 = F({ mahkeme: "Bismil 2. Asliye Hukuk Mahkemesi", esasNo: "2023/0311 E.", muvekkil: "", karsiTaraf: "Örnek Ltd. Şti." });
const d3 = F({ mahkeme: "", esasNo: "2023/311", muvekkil: "DENEME KİŞİ", karsiTaraf: "" });
const d4 = F({ mahkeme: "İzmir 5. İş Mahkemesi", esasNo: "2023/311", muvekkil: "Deneme Kişi" });
const d5 = F({ mahkeme: "", esasNo: "2023/311", muvekkil: "Başka Biri" });
const d6 = F({ mahkeme: "", esasNo: "2023/311", muvekkil: "" });
ok(!!ayniDosyaMi(d1, d2) && !!ayniDosyaMi(d1, d3) && !ayniDosyaMi(d1, d4) && !ayniDosyaMi(d3, d5) && !ayniDosyaMi(d6, d5), "aynı dosya kuralları");
const gr = ayniGruplari([d1, d2, d3, d4, d5, d6]);
ok(gr.length === 1 && gr[0].foyler.map(x => x.id).sort().join() === [d1.id, d2.id, d3.id].sort().join(), "gruplama: " + gr.map(g => g.foyler.length).join());
ok(iliskiOner([d1, d2, d4], new Set()).some(o => o.tur === "ayni"), "öneride de görünür");
if (fail) { console.log(`foy-birlestir-test: ${fail} hata`); process.exit(1); }
console.log("foy-birlestir-test: tamam");
