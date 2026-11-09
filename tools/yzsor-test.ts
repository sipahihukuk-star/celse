// "Yapay zekâya sor": dosya kodlanır (adlar, numaralar gitmez), cevap açılır, önerilen işler ayrıştırılır (uydurma verilerle).
import { bosFoy } from "../src/data/foy";
import { onerilenIsler, okunacak } from "../src/data/yzCevap";
import { unmask } from "../src/engine/mask";
import { foySoruKaynagi } from "../src/ui/foyEvrak";

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const f = bosFoy({ muvekkil: "Ayşe Uydurmaoğlu", karsiTaraf: "Örnek Sigorta A.Ş.", mahkeme: "İzmir 2. Asliye Hukuk Mahkemesi", esasNo: "2024/1111", asama: "Bilirkişi",
  notlar: "Ayşe Uydurmaoğlu ile görüşüldü, Örnek Sigorta teklif yapmadı.",
  gorevler: [{ id: "g1", metin: "Bilirkişi raporuna itiraz", tarih: "2026-11-20", bitti: false, kaynak: "elle" }],
  evraklar: [{ id: "e1", ad: "rapor.pdf", boyut: 1, eklenme: "2026-11-01T10:00:00Z", tur: "Bilirkişi raporu", tarih: "2026-11-01", onemli: true,
    metin: "BİLİRKİŞİ RAPORU\nDavacı Ayşe Uydurmaoğlu vekili Av. Mehmet Kurgusal. Davalı Örnek Sigorta A.Ş. Kusur oranı %50 olarak belirlenmiştir. ".repeat(3) }] });
const k = foySoruKaynagi(f, "Ayşe Uydurmaoğlu için itiraz süresi ne zaman doluyor?", [{ soru: "Örnek Sigorta ne dedi?", cevap: "Örnek Sigorta teklif yapmadı." }], "Hukuk davası");
const hepsi = k.dosya + k.soru + JSON.stringify(k.gecmis);
ok(!/Uydurmaoğlu|Örnek Sigorta|Kurgusal|2024\/1111/.test(hepsi), "adlar ve dosya no gitmez: " + hepsi.match(/Uydurmaoğlu|Örnek Sigorta|Kurgusal|2024\/1111/)?.[0]);
ok(/KÜNYE/.test(k.dosya) && /Bilirkişi raporuna itiraz/.test(k.dosya) && /Kusur oranı %50/.test(k.dosya) && k.evrakSay === 1, "künye, işler ve evrak gider");
ok(/itiraz süresi/.test(k.soru) && k.gecmis.length === 1, "soru ve geçmiş ayrıldı");
const kod = (k.soru.match(/\[[^\]]+\]/) || [""])[0];
ok(!!kod && unmask("Müvekkil " + kod + " için süre 2 hafta.", k.map).includes("Ayşe Uydurmaoğlu"), "cevap açılır: " + kod);
ok(k.dosya.includes(kod), "aynı kişi aynı kod");
const cevap = "NEREDE KALDIK:\nBilirkişi raporu geldi.\n\nSIRADA NE VAR:\nİtiraz dilekçesi.\n\nÖNERİLEN İŞLER:\n- Bilirkişi raporuna itiraz dilekçesi ver (20.11.2026)\n- Müvekkili bilgilendir\n\nDİKKAT:\n- Süre kesindir";
const is = onerilenIsler(cevap);
ok(is.length === 2 && is[0].metin === "Bilirkişi raporuna itiraz dilekçesi ver" && is[0].tarih === "2026-11-20" && !is[1].tarih, "önerilen işler: " + JSON.stringify(is));
ok(okunacak(cevap).startsWith("NEREDE KALDIK. Bilirkişi raporu geldi.") && !/-/.test(okunacak(cevap).replace(/\d/g, "")), "sesli metin: " + okunacak(cevap).slice(0, 60));
if (fail) { console.log(`yzsor-test: ${fail} hata`); process.exit(1); }
console.log("yzsor-test: tamam");
