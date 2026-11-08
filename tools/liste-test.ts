// UYAP dosya listesi: her satır bir föy; tek dosyaya ait evrak liste sayılmaz (uydurma verilerle).
import { dosyaListesiOku, listedenFoyler } from "../src/data/dosyaListesi";
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const liste = `Dosya Sorgulama Sonuçları
Sıra  Birim  Dosya No  Dosya Türü  Dosya Durumu  Açılış Tarihi
1  İzmir 2. Sulh Ceza Hakimliği Değişik İş  2024/1111  Ceza Dava Dosyası  Kapalı  03.02.2024
2  İzmir 4. Asliye Ceza Mahkemesi  2023/2222  Ceza Dava Dosyası  Kapalı  10.11.2023
3  Bornova Cumhuriyet Başsavcılığı  2024/3333  Cbs Soruşturma Dosyası  Açık  15.01.2024
4  İzmir 9. İcra Dairesi  2022/4444  İcra Dosyası  Açık  01.06.2022
5  Ankara Bölge İdare Mahkemesi 3. İdari Dava Dairesi  2025/55  İdare Dava Dosyası  Açık  20.02.2025`;
const r = dosyaListesiOku(liste);
ok(!!r && r.length >= 4, "liste satırları: " + JSON.stringify(r));
const f = listedenFoyler(liste, "liste.pdf");
const bul = (no: string) => f.find(x => x.esasNo === no);
ok(bul("2023/2222")?.tur === "ceza" && bul("2023/2222")?.durum === "kapali" && /Asliye Ceza Mahkemesi/.test(bul("2023/2222")?.mahkeme || ""), "ceza dosyası: " + JSON.stringify(bul("2023/2222")));
ok(bul("2024/3333")?.tur === "sorusturma" && /Başsavcılığı/.test(bul("2024/3333")?.mahkeme || "") && bul("2024/3333")?.acilis === "2024-01-15", "soruşturma: " + JSON.stringify(bul("2024/3333")));
ok(/Sulh Ceza Hakimliği/.test(bul("2024/1111")?.mahkeme || ""), "hakimlik: " + JSON.stringify(bul("2024/1111")));
ok(bul("2022/4444")?.tur === "icra", "icra: " + JSON.stringify(bul("2022/4444")));
ok(bul("2025/55")?.tur === "idari_dava", "idari dava: " + JSON.stringify(bul("2025/55")));
const karar = "T.C.\nİZMİR 3. ASLİYE HUKUK MAHKEMESİ\nESAS NO: 2026/12\nDAVACI: UYDURMA\nGEREĞİ DÜŞÜNÜLDÜ:\nİzmir 5. Asliye Hukuk Mahkemesinin 2023/45 Esas sayılı dosyası getirtildi ve incelendi, bu dosyada verilen kararın kesinleştiği anlaşıldı.\nDavanın kabulüne karar verildi.";
ok(dosyaListesiOku(karar) === null, "karar liste sayılmaz");
if (fail) { console.log(`liste-test: ${fail} hata`); process.exit(1); }
console.log("liste-test: tamam");
