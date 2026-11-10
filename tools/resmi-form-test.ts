// Resmî formlar: Tazminat Komisyonu Word formlarının doldurulması (uydurma verilerle), çevrimiçi form metni.
import { readFileSync, writeFileSync } from "fs";
import { bosFoy } from "../src/data/foy";
import { docxFormDoldur, formBul, formMetni, formOnDoldur, FORMLAR, turFormlari } from "../src/data/resmiForm";
import { docxMetni } from "../src/engine/mask/readers";
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const f = bosFoy({ muvekkil: "Ayşe Uydurmaoğlu", karsiTaraf: "Örnek Sigorta A.Ş.", mahkeme: "İzmir 2. Asliye Hukuk Mahkemesi", esasNo: "2015/1111", acilis: "2015-03-02", kapanis: "2024-06-10",
  muvekkilBilgi: { kimlikNo: "10000000146", adres: "Deneme Mah. 1. Sok. No: 2 Konak/İzmir", telefon: "0555 000 00 00" } });
const v = { ad: "Deneme Avukat", baro: "İzmir Barosu", baroNo: "12345", adres: "Örnek Cad. No: 5 Karşıyaka/İzmir", telefon: "0232 000 00 00", eposta: "av@ornek.test" };
const govde = "Davam 2015 yılında açılmış ve 2024 yılında kesinleşmiştir.\nYargılama dokuz yılı aşkın sürmüştür.";
ok(turFormlari("İnsan Hakları Tazminat Komisyonu başvurusu").length === 4 && turFormlari("Sigorta Tahkim Komisyonu başvurusu")[0].id === "stk", "türe göre formlar");
for (const id of ["tazminat-dogrudan", "tazminat-aym", "tazminat-aihm", "tazminat-cmk"]) {
  const form = formBul(id)!;
  const d = formOnDoldur(form, f, { metin: govde }, v, { dogum: "İzmir, 01.01.1980", aymNo: "2020/123", aymTarih: "05.05.2020", aihmNo: "12345/20", aihmTarih: "06.06.2020", esasKarar: "2015/1111 E., 2023/999 K.", cmk141: "141/e, 141/l" });
  const cikti = docxFormDoldur(new Uint8Array(readFileSync("public/formlar/" + form.dosya)), form, d);
  writeFileSync(process.env.CIKTI ? process.env.CIKTI + "/" + id + ".docx" : "/dev/null", cikti);
  const t = docxMetni(cikti).replace(/[ \t]+/g, " ");
  const has = (re: RegExp, m: string) => ok(re.test(t), id + ": " + m);
  has(/ADI – SOYADI\s*: Ayşe Uydurmaoğlu/, "ad soyad");
  has(/KİMLİK NUMARASI\s*: 10000000146/, "kimlik");
  has(/DOĞUM YERİ ve TARİHİ\s*: İzmir, 01\.01\.1980/, "doğum");
  has(/YAZIŞMA ADRESİ\s*: Deneme Mah\. 1\. Sok\. No: 2 Konak\/İzmir/, "müvekkil adresi");
  has(/ADI SOYADI\s*: Deneme Avukat/, "vekil adı");
  has(/YAZIŞMA ADRESİ\s*: Örnek Cad\. No: 5/, "vekil adresi (ikinci)");
  has(/BARO SİCİL NO\s*: İzmir Barosu · 12345/, "baro");
  has(/E-POSTA ADRESİ\s*: av@ornek\.test/, "e-posta");
  has(/ESAS ve KARAR NO\s*: 2015\/1111 E\., 2023\/999 K\./, "esas karar");
  has(/KESİNLEŞME TARİHİ\s*: 10\.06\.2024/, "kesinleşme");
  has(/AÇIKLAMALAR\s*\n+Davam 2015 yılında açılmış[^\n]*\n+Yargılama dokuz yılı aşkın sürmüştür\.\n[\s\S]*SONUÇ ve TALEP/, "açıklamalar yerinde");
  has(/Başvurucu Sayısı:\s*1/, "başvurucu sayısı");
  has(id === "tazminat-cmk" ? /Müracaat eden Ayşe Uydurmaoğlu vekili Av\. Deneme Avukat/ : /Müracaat eden Ayşe Uydurmaoğlu vekili[\s\S]*Av\. Deneme Avukat/, "imza");
  if (id === "tazminat-aym") has(/AYM BAŞVURU NO\s*: 2020\/123/, "AYM no");
  if (id === "tazminat-aihm") has(/AİHM BAŞVURU NO\s*: 12345\/20/, "AİHM no");
  if (id === "tazminat-cmk") { has(/141\/e ☒/, "141/e işaretli"); has(/141\/l ☒/, "141/l işaretli"); ok(!/141\/f ☒/.test(t), "141/f işaretsiz"); }
  ok(!/\.\.…/.test(t), id + ": noktalar kalmadı");
}
const aym = formBul("aym-bb")!;
const m = formMetni(aym, formOnDoldur(aym, f, { metin: govde }, v));
ok(/II\. BAŞVURUCU \(GERÇEK KİŞİ\)\nT\.C\. kimlik numarası: 10000000146\nAdı: Ayşe\nSoyadı: Uydurmaoğlu/.test(m) && /Avukatın adı: Deneme\nAvukatın soyadı: Avukat/.test(m) && /A\. Olaylar[^\n]*:\nDavam 2015/.test(m), "AYM formu metni");
ok(FORMLAR.every(x => new Set(x.alanlar.map(a => a.k)).size === x.alanlar.length), "alan anahtarları tekil");
if (fail) { console.log(`resmi-form-test: ${fail} hata`); process.exit(1); }
console.log("resmi-form-test: tamam");
