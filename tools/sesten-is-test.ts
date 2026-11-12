// Sesle söylenen işin metni ve son günü (sentetik cümleler).
import { sestenIsler } from "../src/data/sestenIs";

let hata = 0;
const esit = (ad: string, a: unknown, b: unknown) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { hata++; console.log("✗", ad, "\n  beklenen:", JSON.stringify(b), "\n  çıkan:   ", JSON.stringify(a)); } else console.log("✓", ad); };
const B = "2026-11-13"; // cuma

esit("yarın", sestenIsler("yarın bilirkişi raporuna itiraz et", B), [{ metin: "Bilirkişi raporuna itiraz et", tarih: "2026-11-14" }]);
esit("üç gün içinde + ayrıca cuma", sestenIsler("üç gün içinde gider avansını yatır ayrıca cuma günü müvekkili ara", B),
  [{ metin: "Gider avansını yatır", tarih: "2026-11-16" }, { metin: "Müvekkili ara", tarih: "2026-11-20" }]);
esit("tarih noktalı", sestenIsler("Tanık listesini 25.11.2026 tarihine kadar ver", B), [{ metin: "Tanık listesini ver", tarih: "2026-11-25" }]);
esit("ay adı", sestenIsler("12 Aralık'a kadar istinaf dilekçesi yaz", B), [{ metin: "İstinaf dilekçesi yaz", tarih: "2026-12-12" }]);
esit("2 hafta", sestenIsler("2 hafta sonra dosyayı kontrol et", B), [{ metin: "Dosyayı kontrol et", tarih: "2026-11-27" }]);
esit("tarihsiz", sestenIsler("Karşı tarafın cevabını oku.", B), [{ metin: "Karşı tarafın cevabını oku" }]);
esit("pazartesiye kadar", sestenIsler("pazartesiye kadar harcı yatır", B), [{ metin: "Harcı yatır", tarih: "2026-11-16" }]);
esit("ay sonu", sestenIsler("ay sonuna kadar masraf dökümünü gönder", B), [{ metin: "Masraf dökümünü gönder", tarih: "2026-11-30" }]);
esit("iş ekle öneki", sestenIsler("iş ekle: bugün vekâletnameyi tara", B), [{ metin: "Vekâletnameyi tara", tarih: "2026-11-13" }]);
esit("en geç", sestenIsler("Islah dilekçesini 20.11 en geç ver", B), [{ metin: "Islah dilekçesini ver", tarih: "2026-11-20" }]);
esit("iki iş satır", sestenIsler("haftaya keşif avansını yatır\nbir de bilirkişiye soru listesi hazırla", B),
  [{ metin: "Keşif avansını yatır", tarih: "2026-11-20" }, { metin: "Bilirkişiye soru listesi hazırla" }]);

if (hata) { console.log(hata + " hata"); process.exit(1); }
console.log("sesten iş: hepsi geçti");
