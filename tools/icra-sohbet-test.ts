// İcra takibi sohbeti: gönderilecek metin (uydurma föy). Tarihler [TARİH-n] koduna çevrilir, kişi adları ve kimlik no kodlanır,
// tutarlar kalır; geçmiş konuşma da kodlanır. Ağ çağrılmaz.
import { icraSoruKaynagi } from "../src/data/icraSohbet";
import type { Foy } from "../src/data/foy";
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const ilam = "T.C.\nUYDURMA 4. İŞ MAHKEMESİ\nESAS NO : 2023/101\nKARAR NO : 2026/77\nDAVACI : AYŞE ÖRNEKOĞLU - 10000000146\nVEKİLİ : Av. ÖRNEK AVUKAT\nDAVALI : HAYALİ FABRİKA A.Ş.\nDAVA TARİHİ : 01/02/2023\nKARAR TARİHİ : 10/09/2026\nHÜKÜM: 1-85.000,00 TL brüt kıdem tazminatının 15/03/2024 tarihinden itibaren en yüksek mevduat faizi ile davalıdan alınarak davacıya verilmesine,";
const n = new Date().toISOString();
const f = { id: "f1", olusturma: n, guncelleme: n, tur: "icra", muvekkil: "Ayşe Örnekoğlu", karsiTaraf: "Hayali Fabrika A.Ş.", mahkeme: "", esasNo: "", davaTuru: "", taraf: "davaci", durum: "acik", notlar: "", gorevler: [],
  evraklar: [{ id: "e1", ad: "ilam.udf", boyut: 1, eklenme: n, metin: ilam }],
  icra: { yol: "ilamli", kalemler: [{ ad: "Vekâlet ücreti", tutar: 17000, faizTuru: "yasal", faizBaslangic: "2026-09-10" }], sohbet: [{ soru: "Ayşe Örnekoğlu davacı mı?", cevap: "Evet, 01/02/2023 tarihli davada davacıdır.", tarih: n }] }
} as unknown as Foy;
const k = icraSoruKaynagi(f, "Ayşe Örnekoğlu için alacakları yaz", f.icra!.sohbet!);
const hepsi = k.dosya + " " + k.soru + " " + JSON.stringify(k.gecmis);
ok(!/Örnekoğlu|ÖRNEKOĞLU|10000000146|HAYALİ FABRİKA|Hayali Fabrika/.test(hepsi), "adlar ve kimlik no gitmez: " + hepsi.slice(0, 400));
ok(!/\d{1,2}[./]\d{1,2}[./](19|20)\d{2}/.test(hepsi), "açık tarih gitmez");
ok(/85\.000,00 TL/.test(k.dosya) && /17000 TL/.test(k.dosya), "tutarlar kalır");
const kod = Object.entries(k.tarihler).find(([, v]) => v === "2024-03-15")?.[0];
ok(!!kod && k.dosya.includes(kod), "faiz başlangıcı tarihi kodla gider: " + JSON.stringify(k.tarihler));
ok(Object.values(k.tarihler).includes("2023-02-01") && Object.values(k.tarihler).includes("2026-09-10"), "dava ve karar tarihi kodlu");
ok(k.gecmis.length === 1 && /\[TARİH-\d+\]/.test(k.gecmis[0].cevap), "geçmiş konuşma da kodlanır: " + JSON.stringify(k.gecmis));
ok(/DAVACI vekiliyiz/.test(k.dosya), "bizim taraf yazılır");
if (fail) { console.log(`icra-sohbet-test: ${fail} hata`); process.exit(1); }
console.log("icra-sohbet-test: tamam");
