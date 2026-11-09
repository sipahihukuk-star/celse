// Evrak başlığı (uydurma evraklarla).
import { evrakBasligi, konuCikar } from "../src/data/evrakBaslik";
import { bosFoy } from "../src/data/foy";
import { evrakSinifla } from "../src/data/foyTurleri";

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
ok(konuCikar("İZMİR 2. ASLİYE HUKUK MAHKEMESİ'NE\nDOSYA NO: 2024/1111\nKONU : Bilirkişi raporuna itirazlarımızın sunulmasıdır.\nAÇIKLAMALAR") === "Bilirkişi raporuna itirazlarımızın sunulmasıdır", "KONU satırı");
ok(konuCikar("GEREKÇELİ KARAR\n...\nHÜKÜM: Gerekçesi yukarıda açıklandığı üzere,\n1-Davanın KISMEN KABULÜNE,", "Karar") === "Kısmen kabul", "hüküm");
ok(konuCikar("HÜKÜM: Davanın reddine,", "Karar") === "Ret", "ret");
ok(konuCikar("TUTANAK\nDuruşmanın 12.03.2027 günü saat 10:00'a bırakılmasına", "Duruşma tutanağı") === "Sonraki duruşma 12.03.2027", "sonraki duruşma");
ok(konuCikar("") === "", "boş");
const f = bosFoy({ muvekkil: "Ayşe Uydurmaoğlu", karsiTaraf: "Örnek Sigorta A.Ş.", mahkeme: "Uydurma 2. Asliye Hukuk Mahkemesi", esasNo: "2024/1111" });
const e = { id: "e1", ad: "scan_0001.pdf", boyut: 1000, eklenme: "2026-11-09T10:00:00Z", metin: "HÜKÜM: Davanın kabulüne,", tur: "Karar", tarih: "2026-10-12" };
const b = evrakBasligi(f, e);
ok(b.baslik === "Karar · Kabul · 12.10.2026", "başlık: " + b.baslik);
ok(b.ait === "Hukuk davası · Uydurma 2. Asliye Hukuk Mahkemesi 2024/1111 · Ayşe Uydurmaoğlu – Örnek Sigorta A.Ş.", "ait: " + b.ait);
ok(b.dosyaAdi === "2026-10-12 Karar Kabul 2024-1111 Uydurmaoğlu.pdf", "dosya adı: " + b.dosyaAdi);
ok(evrakSinifla("a.txt", "İZMİR 2. ASLİYE HUKUK MAHKEMESİNE\nDOSYA NO: 2024/1111\nKONU : Bilirkişi raporuna itirazlarımızın sunulmasıdır.").tur === "Dilekçe", "itiraz dilekçesi rapor sayılmaz");
ok(evrakSinifla("a.txt", "BİLİRKİŞİ RAPORU\nİZMİR 2. ASLİYE HUKUK MAHKEMESİ\nKONU: Hasar tespiti").tur === "Bilirkişi raporu", "asıl rapor");
ok(evrakSinifla("a.txt", "İZMİR BÖLGE ADLİYE MAHKEMESİNE\nKONU: İstinaf dilekçemizdir").tur === "İstinaf / temyiz dilekçesi", "istinaf");
if (fail) { console.log(`evrakbaslik-test: ${fail} hata`); process.exit(1); }
console.log("evrakbaslik-test: tamam");
