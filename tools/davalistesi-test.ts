// Dava listesi: süre, sıradaki iş, Tazminat Komisyonu (elle ve bağlı föyden), süzgeçler, xlsx (uydurma verilerle).
import { unzipSync, strFromU8 } from "fflate";
import { bosFoy } from "../src/data/foy";
import { davaListesi, listeTablosu, sureYaz, yargilamaSuresi } from "../src/data/davaListesi";
import { xlsxYaz } from "../src/data/xlsxYaz";
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const bugun = "2026-11-09";
const a = bosFoy({ tur: "hukuk", mahkeme: "Uydurma 2. İş Mahkemesi", esasNo: "2019/10", muvekkil: "Uydurma Bir", karsiTaraf: "Hayali A.Ş.", acilis: "2019-03-01", asama: "Bilirkişi",
  gorevler: [{ id: "g1", metin: "Bilirkişi raporuna itiraz", tarih: "2026-11-20", bitti: false, kaynak: "elle" }] });
const k = bosFoy({ tur: "idari_basvuru", mahkeme: "Adalet Bakanlığı Tazminat Komisyonu Başkanlığı", esasNo: "2024/55", acilis: "2024-05-01", ilgiliIds: [a.id] });
a.ilgiliIds = [k.id];
const c = bosFoy({ tur: "ceza", mahkeme: "Uydurma 4. Asliye Ceza Mahkemesi", esasNo: "2025/7", acilis: "2025-09-01", durusma: "2026-12-01T10:30" });
const d = bosFoy({ tur: "idari_dava", mahkeme: "Uydurma 1. İdare Mahkemesi", esasNo: "2020/3", acilis: "2020-01-10", durum: "kapali", kapanis: "2023-01-10", komisyon: { durum: "sonuclandi", tarih: "2022-05-01" } });
const oz = bosFoy({ tur: "ceza", ozel: true, mahkeme: "Gizli", acilis: "2010-01-01" });
const liste = [a, k, c, d, oz];
ok(sureYaz(400) === "1 yıl 1 ay" && yargilamaSuresi(d, bugun).metin === "3 yıl", "süre: " + sureYaz(400) + " / " + yargilamaSuresi(d, bugun).metin);
const tum = davaListesi(liste, { tur: "hepsi", durum: "hepsi", enAzYil: 0, komisyon: "hepsi", sirala: "sure", ara: "" }, bugun);
ok(tum.length === 4 && !tum.some(x => x.f.ozel), "şahsi dosya yok, 4 satır");
ok(tum[0].f.id === a.id && tum[0].komisyon.durum === "basvuruldu" && tum[0].komisyon.kaynak === "bagli", "en uzun önce, bağlı komisyon: " + JSON.stringify(tum[0].komisyon));
ok(tum[0].sonrakiIs === "Bilirkişi raporuna itiraz" && tum.find(x => x.f.id === c.id)!.sonrakiIs === "Duruşma", "sıradaki iş");
const bes = davaListesi(liste, { tur: "hepsi", durum: "acik", enAzYil: 5, komisyon: "hepsi", sirala: "sure", ara: "" }, bugun);
ok(bes.length === 1 && bes[0].f.id === a.id, "5 yıldan uzun açık: " + bes.map(x => x.esasNo));
const yok = davaListesi(liste, { tur: "hepsi", durum: "hepsi", enAzYil: 0, komisyon: "yok", sirala: "sure", ara: "" }, bugun);
ok(yok.length === 1 && yok[0].f.id === c.id, "başvurulmamış: " + yok.map(x => x.esasNo));
const x = xlsxYaz("Dava listesi", listeTablosu(tum), [10, 20]);
const z = unzipSync(x);
const sh = strFromU8(z["xl/worksheets/sheet1.xml"]);
ok(!!z["xl/workbook.xml"] && /Tazminat Komisyonu/.test(sh) && /Başvuruldu/.test(sh) && /2019\/10/.test(sh), "xlsx içeriği");
// Sütun başlığına göre sıralama: açılış yeniden eskiye / eskiden yeniye, mahkeme A–Z, dosya no yıl ve sıraya göre, duruşma (boş sonda).
{
  const sz = { tur: "hepsi", durum: "hepsi" as const, enAzYil: 0, komisyon: "hepsi" as const, sirala: "sure" as const, ara: "" };
  const ac = (kolon: string, yon?: "artan" | "azalan") => davaListesi(liste, { ...sz, kolon: kolon as never, yon }, bugun).map(x => x.f.esasNo).join(",");
  ok(ac("acilis") === "2025/7,2024/55,2020/3,2019/10", "açılış ilk basış yeniden eskiye: " + ac("acilis"));
  ok(ac("acilis", "artan") === "2019/10,2020/3,2024/55,2025/7", "açılış eskiden yeniye: " + ac("acilis", "artan"));
  ok(ac("mahkeme").split(",")[0] === "2024/55", "mahkeme A–Z (Adalet Bakanlığı önce): " + ac("mahkeme"));
  ok(ac("esasNo", "artan") === "2019/10,2020/3,2024/55,2025/7", "dosya no yıl ve sıra: " + ac("esasNo", "artan"));
  ok(ac("durusma").startsWith("2025/7"), "duruşması olan önce, boşlar sonda: " + ac("durusma"));
}
if (fail) { console.log(`davalistesi-test: ${fail} hata`); process.exit(1); }
console.log("davalistesi-test: tamam");
