// Sesli asistan: komut anlama (uydurma föylerle).
import { bosFoy } from "../src/data/foy";
import { Baglam, sesliKomut, sesliTarih, soylenenNo } from "../src/data/sesKomut";

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const B = "2026-11-09";
ok(sesliTarih("son gün 15 kasım", B).tarih === "2026-11-15", "15 kasım");
ok(sesliTarih("3 ocak", B).tarih === "2027-01-03", "geçmiş ay gelecek yıl");
ok(sesliTarih("yarın", B).tarih === "2026-11-10" && sesliTarih("üç gün sonra", B).tarih === "2026-11-12" && sesliTarih("2 hafta sonra", B).tarih === "2026-11-23", "göreli");
ok(sesliTarih("20.12.2026", B).tarih === "2026-12-20", "rakamla");
ok(soylenenNo("numara 4 0 1 2 3") === "40123" && soylenenNo("evrak no IE 2026 871") === "IE2026871" && soylenenNo("4 0 1 2 3") === "40123", "numara: " + soylenenNo("evrak no IE 2026 871"));

const a = bosFoy({ muvekkil: "Ayşe Uydurmaoğlu", karsiTaraf: "Örnek Sigorta A.Ş.", mahkeme: "Uydurma 2. Asliye Hukuk Mahkemesi", esasNo: "2024/1111", asama: "Bilirkişi", durusma: "2026-11-12",
  gorevler: [{ id: "g1", metin: "Bilirkişi raporuna itiraz", tarih: "2026-11-11", bitti: false, kaynak: "elle", eklenme: "2026-11-01" }] });
const b = bosFoy({ muvekkil: "Mehmet Kurgusal", mahkeme: "Uydurma 3. Asliye Hukuk Mahkemesi", esasNo: "2025/55", gorevler: [{ id: "g2", metin: "İstinaf dilekçesi", tarih: "2026-11-06", bitti: false, kaynak: "elle", eklenme: "2026-10-01" }] });
const c = bosFoy({ muvekkil: "Ayşe Hayalîgil", mahkeme: "Uydurma 1. İş Mahkemesi", esasNo: "2023/9" });
const L = [a, b, c];
let bg: Baglam = {};
const sor = (x: string) => { const r = sesliKomut(x, L, bg, B); bg = r.baglam; return r; };

let r = sor("bugün ne var");
ok(/1 gecikmiş/.test(r.metin) && /1 acil/.test(r.metin) && /İstinaf dilekçesi/.test(r.metin), "özet: " + r.metin);
r = sor("bu hafta duruşmalar");
ok(/1 duruşma/.test(r.metin) && /12 Kasım Perşembe/.test(r.metin), "duruşma: " + r.metin);
r = sor("Uydurmaoğlu dosyası ne durumda");
ok(r.baglam.foyId === a.id && /Bilirkişi raporuna itiraz/.test(r.metin) && /2024 bölü 1111/.test(r.metin), "dosya durumu: " + r.metin);
r = sor("2025 bölü 55 dosyası");
ok(r.baglam.foyId === b.id, "esas no ile");
r = sor("Ayşe dosyası");
ok(r.baglam.bekleyen?.tip === "foySec" && /2 dosya buldum/.test(r.metin), "iki aday: " + r.metin);
r = sor("ikinci");
ok(r.baglam.foyId === c.id, "ikinci seçildi");
r = sor("Uydurmaoğlu dosyasına iş ekle tanık listesi ver son gün 20 kasım");
ok(r.baglam.bekleyen?.tip === "ekle" && /tanık listesi ver/.test(r.metin) && /20 Kasım/.test(r.metin) && !r.eylem, "ekle onay sorar: " + r.metin);
r = sor("evet");
ok(r.eylem?.tip === "ekle" && r.eylem.foyId === a.id && r.eylem.gorev.tarih === "2026-11-20" && r.eylem.gorev.metin === "tanık listesi ver", "ekle: " + JSON.stringify(r.eylem));
r = sor("bilirkişi işini kapat");
ok(r.baglam.bekleyen?.tip === "kapatNo" && /numara olmadan kapanmaz/.test(r.metin) && !r.eylem, "numarasız kapanmaz: " + r.metin);
r = sor("4 0 1 2 3 4");
ok(r.baglam.bekleyen?.tip === "kapatOnay" && /4 0 1 2 3 4/.test(r.metin), "numara okunur: " + r.metin);
r = sor("evet");
ok(r.eylem?.tip === "kapat" && r.eylem.gorevId === "g1" && r.eylem.kapanis.no === "401234", "kapat: " + JSON.stringify(r.eylem));
r = sor("istinaf işini kapat numara 778899");
ok(r.baglam.bekleyen?.tip === "kapatOnay", "tek cümlede numara");
r = sor("vazgeç");
ok(!r.eylem && !r.baglam.bekleyen, "vazgeç");
r = sor("Kurgusal dosyasını aç");
ok(r.eylem?.tip === "ac" && r.eylem.foyId === b.id, "aç");
r = sor("gecikmiş işler");
ok(/1 gecikmiş/.test(r.metin), "gecikmiş");
ok(/Anlayamadım/.test(sor("hava nasıl").metin), "anlaşılmayan");
// Yeni dava: eksikler tek tek sorulur, onayla föy açılır ve "Dava aç" işi yazılır.
bg = {};
r = sor("yeni dava aç boşanma davası");
ok(r.baglam.bekleyen?.tip === "yeniDava" && /Müvekkilin adı/.test(r.metin), "yeni dava: müvekkil sorulur: " + r.metin);
r = sor("zeynep örnekoğlu");
ok(/Karşı taraf/.test(r.metin), "karşı taraf sorulur");
r = sor("geç");
ok(/ne zamana kadar/.test(r.metin), "tarih sorulur");
r = sor("iki hafta sonra");
ok(/boşanma davası/.test(r.metin) && /Zeynep Örnekoğlu/.test(r.metin) && /23 Kasım/.test(r.metin) && !r.eylem, "onay sorulur: " + r.metin);
r = sor("evet");
ok(r.eylem?.tip === "yeniDava" && r.eylem.foy.muvekkil === "Zeynep Örnekoğlu" && r.eylem.foy.karsiTaraf === "" && r.eylem.foy.davaTuru === "boşanma davası" && r.eylem.gorev.metin === "Dava aç: boşanma davası" && r.eylem.gorev.tarih === "2026-11-23", "yeni dava eylemi: " + JSON.stringify(r.eylem));
bg = {};
r = sor("yeni icra takibi kaydet");
ok(r.baglam.bekleyen?.tip === "yeniDava" && r.baglam.bekleyen.v.tur === "icra" && /Müvekkil/.test(r.metin), "icra türü: " + JSON.stringify(r.baglam.bekleyen));
sor("vazgeç");
r = sor("tüm işleri oku");
ok(/açık iş var/.test(r.metin), "tüm işler: " + r.metin);
if (fail) { console.log(`ses-test: ${fail} hata`); process.exit(1); }
console.log("ses-test: tamam");
