// Büroya sor: bütün föylerin özeti kodlanır (adlar, dosya no gitmez), soruda adı geçen föy ayrıntılı gider, şahsi föy hiç
// gitmez, cevap açılır; sesli komutlar ve sohbeti bitiren sözler (uydurma verilerle).
import { bosFoy } from "../src/data/foy";
import { BITIR, sesliKomut } from "../src/data/sesKomut";
import { unmask } from "../src/engine/mask";
import { buroSoruKaynagi } from "../src/ui/buroSoruKaynak";

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const bugun = "2026-11-09";
const a = bosFoy({ muvekkil: "Ayşe Uydurmaoğlu", karsiTaraf: "Örnek Sigorta A.Ş.", mahkeme: "İzmir 2. Asliye Hukuk Mahkemesi", esasNo: "2024/1111", asama: "Bilirkişi",
  notlar: "Ayşe Uydurmaoğlu ile görüşüldü.",
  durusmalar: [{ id: "d1", tarih: "2026-11-20T10:30" }, { id: "d0", tarih: "2026-10-01", girildi: "evet" }],
  gorevler: [{ id: "g1", metin: "Bilirkişi raporuna itiraz", tarih: "2026-11-11", bitti: false, kaynak: "elle", eklenme: "2026-11-01" }],
  hesap: { ucret: { tutar: 40000 }, kalemler: [{ id: "h1", tur: "tahsilat", tutar: 15000, tarih: "2026-10-01" }] } as never,
  evraklar: [{ id: "e1", ad: "rapor.pdf", boyut: 1, eklenme: "2026-11-01T10:00:00Z", tur: "Bilirkişi raporu", tarih: "2026-11-01", onemli: true, konu: "kusur oranı",
    metin: "BİLİRKİŞİ RAPORU\nDavacı Ayşe Uydurmaoğlu. Davalı Örnek Sigorta A.Ş. Kusur oranı %50 olarak belirlenmiştir." }] });
const b = bosFoy({ tur: "icra", muvekkil: "Kurgu Yapı Ltd. Şti.", karsiTaraf: "Hayali Tekstil", mahkeme: "İzmir 9. İcra Dairesi", esasNo: "2025/2222",
  durusmalar: [{ id: "h1", tur: "haciz", tarih: "2026-11-13" }] });
const c = bosFoy({ muvekkil: "Gizli Şahıs", karsiTaraf: "Baro", mahkeme: "Disiplin Kurulu", esasNo: "2026/3333", ozel: true });
const k = buroSoruKaynagi([a, b, c], "Uydurmaoğlu dosyasında bilirkişi raporu ne diyor?", [], bugun);
const hepsi = k.buro + k.soru;
ok(!/Uydurmaoğlu|Örnek Sigorta|Kurgu Yapı|Hayali Tekstil|2024\/1111|2025\/2222/.test(hepsi), "adlar ve dosya no gitmez: " + hepsi.match(/Uydurmaoğlu|Örnek Sigorta|Kurgu Yapı|Hayali Tekstil|2024\/1111|2025\/2222/)?.[0]);
ok(!/Gizli Şahıs|Disiplin|2026\/3333/.test(hepsi) && k.dosya === 2, "şahsi föy hiç gitmez");
ok(/2 açık, 0 kapalı/.test(k.buro) && /Dosya 1:/.test(k.buro) && /Dosya 2:/.test(k.buro), "iki föy özeti");
ok(/sıradaki duruşma 2026-11-20 Cuma 10:30/.test(k.buro) && /son duruşma 2026-10-01 Perşembe \(girildi\)/.test(k.buro), "duruşma günleri");
ok(/YAKLAŞAN 30 GÜN[\s\S]*2026-11-13 Cuma Haciz/.test(k.buro), "takvimde haciz");
ok(/GECİKMİŞ VE ACİL İŞLER[\s\S]*Bilirkişi raporuna itiraz \(son güne 2 gün/.test(k.buro), "acil iş");
ok(/kalan 25\.000 TL/.test(k.buro), "hesap: " + (k.buro.match(/hesap:[^\n·]*/) || [""])[0]);
ok(k.ayrintili === 1 && /AYRINTISI[\s\S]*Kusur oranı %50/.test(k.buro), "soruda geçen föy ayrıntılı");
const kod = (k.soru.match(/\[[^\]]+\]/) || [""])[0];
ok(!!kod && unmask(kod + " dosyasında kusur %50.", k.map).startsWith("Ayşe Uydurmaoğlu") && k.buro.includes(kod), "cevap açılır: " + kod);
const g = buroSoruKaynagi([a, b], "Bu hafta neler var?", [{ soru: "Hayali Tekstil dosyası ne durumda?", cevap: "Hayali Tekstil dosyasında haciz 13 Kasım." }], bugun);
ok(g.ayrintili === 1 && /AYRINTISI/.test(g.buro) && !/Kusur oranı/.test(g.buro) && !/Hayali/.test(JSON.stringify(g.gecmis)), "geçmişteki dosya da ayrıntılı, geçmiş kodlu");
// Sesli komut
const r = sesliKomut("büroya sor bu ay hangi dosyalarda karar bekleniyor", [a, b], {}, bugun);
ok(r.eylem?.tip === "buroSor" && (r.eylem as { soru: string }).soru === "bu ay hangi dosyalarda karar bekleniyor", "büroya sor komutu");
ok(!!sesliKomut("hocam bu hafta neler var bir özetle", [a, b], {}, bugun).anlasilmadi, "uzun serbest soru yapay zekâya");
ok(!sesliKomut("bugün ne var", [a, b], {}, bugun).anlasilmadi && !sesliKomut("bu hafta duruşmalar", [a, b], {}, bugun).anlasilmadi && !!sesliKomut("bu hafta neler var", [a, b], {}, bugun).anlasilmadi, "kısa komut cihazda");
for (const x of ["teşekkürler", "görüşürüz", "tamam sus", "şimdilik bu kadar", "sağol"]) ok(BITIR.test(x), "bitirir: " + x);
for (const x of ["bu dosyayı kapat", "evet", "bilirkişi işini kapat numara 4012", "teşekkürler bilirkişi işini kapat"]) ok(!BITIR.test(x), "bitirmez: " + x);
if (fail) { console.log(`burosor-test: ${fail} hata`); process.exit(1); }
console.log("burosor-test: tamam");
