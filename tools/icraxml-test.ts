// UYAP XML: uydurma verilerle üretilir; il/ilçe kodu, takip kodları ve yapı kontrol edilir. (DTD doğrulaması ayrıca xmllint ile.)
import { bosFoy } from "../src/data/foy";
import { adresKodu, takipKodlari, uyapXml } from "../src/data/icraXml";
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const a = adresKodu("Uydurma Mah. 1 Sk. No:1 Karşıyaka / İZMİR");
ok(a.ilKodu === 35 && a.ilce === "KARŞIYAKA" && !!a.ilceKodu, "adres kodu: " + JSON.stringify(a));
ok(JSON.stringify(takipKodlari({ yol: "ilamli" })) === JSON.stringify({ takipTuru: 0, takipYolu: 1, takipSekli: 0 }), "ilamlı 4-5 kodları");
const f = bosFoy({ tur: "icra", muvekkil: "Uydurma Kişi Bir", karsiTaraf: "Hayali Yapı A.Ş.", mahkeme: "Uydurma 3. İcra Dairesi",
  muvekkilBilgi: { kimlikNo: "10000000146", adres: "Deneme Mah. 5 Sk. Bornova / İZMİR" }, karsiBilgi: { kimlikNo: "1234567890", adres: "Örnek Cad. 3 Konak / İZMİR" } });
const x = uyapXml(f, { yol: "ilamli", mahiyet: "4045", ilam: { mahkeme: "Uydurma 3. Asliye Ticaret Mahkemesi", esasNo: "2015/432", kararNo: "2026/592", kararTarihi: "2026-06-24" }, takipTarihi: "2026-10-26",
  kalemler: [{ ad: "Manevi tazminat", tutar: 15000, faizTuru: "avans", faizBaslangic: "2026-01-01" }, { ad: "Yargılama gideri", tutar: 1000.5, faizTuru: "yasal", faizBaslangic: "2026-06-24" }] },
  { adSoyad: "Av. Örnek Avukat", tcKimlikNo: "10000000078", baroNo: "1234" }, "2026-10-26");
ok(/takipTuru="0" takipYolu="1" takipSekli="0"/.test(x) && /mahiyetKodu="4045"/.test(x), "dosya öznitelikleri");
ok(/<kurum kurumAdi="Hayali Yapı A.Ş." vergiNo="1234567890"/.test(x) && /<kisiTumBilgileri adi="Uydurma Kişi" soyadi="Bir" tcKimlikNo="10000000146"/.test(x), "kişi / kurum");
ok(/ilamDosyaNoYil="2015" ilamDosyaSira="432" ilamKararNoYil="2026" ilamKararSira="592" ilamTarihi="24\/06\/2026"/.test(x), "ilam: " + (x.match(/<ilam[^>]*>/) || [])[0]);
ok(/alacakKalemTutar="1000.50"/.test(x) && /faizTipKod="FAIZT00007"/.test(x) && /faizTipKod="FAIZT00002"/.test(x), "kalem ve faiz kodları");
if (process.argv[2]) require("fs").writeFileSync(process.argv[2], x);
if (fail) { console.log(`icraxml-test: ${fail} hata`); process.exit(1); }
console.log("icraxml-test: tamam");
