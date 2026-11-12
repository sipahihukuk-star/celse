// Tekrarın önlenmesi (uydurma veri): aynı dosya ikinci föy, aynı evrak ikinci kayıt olmaz.
import { bosFoy, Foy, FoyEvrak } from "../src/data/foy";
import { ayniEvrakMi, ayniFoyuBul, esiVar, tekrarEdenEvrak } from "../src/data/tekillik";
import { havuzuGrupla } from "../src/data/havuz";
import { birlestir } from "../src/data/foyAktar";
import { kunyeCikar } from "../src/data/kunyeCikar";
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };

const f1 = bosFoy({ id: "f1", tur: "hukuk", mahkeme: "Uydurma Asliye Hukuk Mahkemesi", esasNo: "2024/362" });
const f2 = bosFoy({ id: "f2", tur: "hukuk", mahkeme: "Uydurma 2. İş Mahkemesi", esasNo: "2024/362" });
const f3 = bosFoy({ id: "f3", tur: "icra", mahkeme: "", esasNo: "2023/77" });
const liste = [f1, f2, f3];
ok(ayniFoyuBul(liste, { mahkeme: "T.C. UYDURMA ASLİYE HUKUK MAHKEMESİ SAYIN HAKİMLİĞİ", esasNo: "2024/0362 E." })?.id === "f1", "merci ve esas yazım farkı aynı föy");
ok(ayniFoyuBul(liste, { mahkeme: "Uydurma 3. Asliye Ticaret Mahkemesi", esasNo: "2024/362" }) === undefined, "başka merci aynı numara: yeni föy");
ok(ayniFoyuBul(liste, { mahkeme: "Uydurma 5. İcra Dairesi", esasNo: "2023/077" })?.id === "f3", "föyde merci yazılı değil, numara tek: aynı föy");
ok(ayniFoyuBul(liste, { esasNo: "2024/362" }) === undefined, "merci yok, numarada iki föy: karar verilmez");
ok(ayniFoyuBul(liste, { mahkeme: "Uydurma Asliye Hukuk Mahkemesi", esasNo: "2024/362", ozel: true }) === undefined, "şahsi föy büro föyüyle karışmaz");

const govde = "Davacı vekili tarafından mahkememize sunulan dilekçe ile davalı aleyhine açılan alacak davasında yapılan yargılama sonunda dosya incelendi. Taraflara usulüne uygun tebligat yapıldığı anlaşıldı. Tanıklar dinlendi, bilirkişi raporu alındı ve rapora karşı itirazlar değerlendirildi. ";
const SOZ = "alfa bravo çarli delta eko foks golf otel hindi india juliet kilo lima mayk kasım oskar papa kebek romeo sierra tango üniform viktor viski eksray yanki zulu".split(" ");
const uzun = Array.from({ length: 160 }, (_x, i) => SOZ[i % SOZ.length] + SOZ[(i * 7) % SOZ.length]).join(" ");
const zabit = (tarih: string, no: string) => `T.C. UYDURMA ASLİYE HUKUK MAHKEMESİ DURUŞMA TUTANAĞI ESAS NO 2024/362 CELSE ${no} DURUŞMA TARİHİ ${tarih} ` + govde + uzun;
const ev = (id: string, ad: string, metin: string, boyut = 1000, eklenme = "2026-01-0" + id.slice(-1)): FoyEvrak => ({ id, ad, boyut, eklenme, metin } as FoyEvrak);
const a = ev("e1", "tutanak.udf", zabit("10/09/2026", "3"));
ok(ayniEvrakMi(a, ev("e2", "Duruşma Tutanağı (1).pdf", zabit("10/09/2026", "3").toLocaleUpperCase("tr").replace(/ /g, "  \n"), 5000)), "aynı yazı başka ad, büyük harf ve boşluk farkı: aynı evrak");
ok(!ayniEvrakMi(a, ev("e3", "tutanak.udf", zabit("17/10/2026", "4"))), "aynı kalıpta başka tarih ve celse: ayrı evrak");
ok(ayniEvrakMi(a, ev("e4", "kopya.pdf", "Sayfa üstbilgisi uydurma büro " + zabit("10/09/2026", "3"))), "yalnız rakamsız üstbilgi farkı: aynı evrak");
ok(ayniEvrakMi(ev("g1", "foto.jpg", "", 4321), ev("g2", "FOTO.JPG", "", 4321)) && !ayniEvrakMi(ev("g1", "foto.jpg", "", 4321), ev("g3", "foto.jpg", "", 999)), "yazısız dosyada ad ve boyut");
ok(!ayniEvrakMi(ev("k1", "a.udf", "Kısa yazı 1"), ev("k2", "b.udf", "Kısa yazı 1")), "çok kısa yazı tek başına eş sayılmaz (ad farklı)");
const ff = { ...f1, evraklar: [ev("e9", "ikinci.pdf", zabit("10/09/2026", "3"), 1, "2026-02-01"), a, ev("e3", "tutanak2.udf", zabit("17/10/2026", "4")), ev("e8", "bos.pdf", "", 1000, "2026-03-01")] } as Foy;
const tk = tekrarEdenEvrak(ff);
ok(tk.length === 1 && tk[0].id === "e9", "en önce eklenen kalır, sonraki tekrar: " + tk.map(x => x.id));
ok(!!esiVar(ff.evraklar, { ad: "yeni ad.pdf", boyut: 3, metin: zabit("10/09/2026", "3") }), "föyde eşi var");

// Toplu yükleme: aynı dosyanın iki evrakı (merci farklı yazılmış) tek grup olur ve var olan föye gider.
const evr = (id: string, m: string) => ({ id, ad: id + ".udf", boyut: 1, metin: m, oneri: kunyeCikar(m) });
const h = havuzuGrupla([
  evr("x1", "T.C.\nUYDURMA ASLİYE HUKUK MAHKEMESİ\nESAS NO : 2024/0362\nDAVACI : AYŞE ÖRNEK\nDAVALI : HAYALİ YAPI A.Ş.\n"),
  evr("x2", "UYDURMA ASLİYE HUKUK MAHKEMESİ SAYIN HAKİMLİĞİ'NE\nDOSYA NO : 2024/362 E.\nDAVACI : AYŞE ÖRNEK\nDAVALI : HAYALİ YAPI A.Ş.\n")
], liste, []);
ok(h.gruplar.length === 1 && h.gruplar[0].hedef.tur === "var" && (h.gruplar[0].hedef as { foyId: string }).foyId === "f1", "havuz: tek grup, var olan föy: " + JSON.stringify(h.gruplar.map(g => [g.anahtar, g.hedef])));

// Excel / UYAP listesi: listede iki kez geçen dosya tek föy; yazım farkıyla var olan föy güncellenir.
const r = birlestir(liste, [
  bosFoy({ mahkeme: "Uydurma Asliye Hukuk Mahkemesi Sayın Hakimliği", esasNo: "2024/0362", muvekkil: "Ayşe Örnek" }),
  bosFoy({ mahkeme: "Uydurma 9. Sulh Hukuk Mahkemesi", esasNo: "2025/5" }),
  bosFoy({ mahkeme: "Uydurma 9 Sulh Hukuk", esasNo: "2025/005", karsiTaraf: "Hayali Yapı" })
]);
ok(r.guncellenen.length === 1 && r.guncellenen[0].id === "f1" && r.guncellenen[0].muvekkil === "Ayşe Örnek", "var olan föy güncellenir");
ok(r.yeni.length === 1 && r.yeni[0].karsiTaraf === "Hayali Yapı", "listede iki kez geçen dosya tek yeni föy: " + r.yeni.length);

if (fail) { console.log(`tekillik-test: ${fail} hata`); process.exit(1); }
console.log("tekillik-test: tamam");
