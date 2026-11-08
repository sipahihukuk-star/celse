// Föyleme sohbeti: yapay zekâya giden özette ve mesajda gerçek ad, kimlik ve telefon kalmamalı (uydurma verilerle).
import { bosFoy } from "../src/data/foy";
import { geriAc, kodlaDurum } from "../src/data/foylemeKod";
import { havuzuGrupla, HavuzEvrak } from "../src/data/havuz";
import { kunyeCikar } from "../src/data/kunyeCikar";
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const ev = (id: string, metin: string): HavuzEvrak => ({ id, ad: "Deneme Kişi Bir dilekçe.udf", boyut: 1, metin, oneri: kunyeCikar(metin) });
const e1 = ev("a", "T.C.\nİZMİR 3. ASLİYE HUKUK MAHKEMESİ\nESAS NO : 2026/321\nDAVACI : DENEME KİŞİ BİR - 10000000146\nVEKİLİ : Av. ÖRNEK BÜRO AVUKATI\nDAVALI : UYDURMA YAPI A.Ş.");
const foy = bosFoy({ muvekkil: "Başka Müvekkil", karsiTaraf: "Öteki Taraf", esasNo: "2025/1" });
const { gruplar, ayrilamayan } = havuzuGrupla([e1], [foy], ["Av. Örnek Büro Avukatı"]);
const k = kodlaDurum(gruplar, g => g.hedef, () => undefined, ayrilamayan, [foy], ["Av. Örnek Büro Avukatı"]);
ok(!/Deneme|Uydurma|Örnek Büro|Başka Müvekkil|Öteki Taraf|10000000146|dilekçe\.udf/i.test(k.durum), "özette gerçek ad yok: " + k.durum.slice(0, 300));
ok(/KİŞİ-\d/.test(k.durum) && /AVUKAT-1/.test(k.durum), "kodlar var");
const m = k.kodla("Deneme Kişi Bir dosyasında davacı vekiliyiz, Uydurma Yapı ile arabuluculuk da var. Tel 0532 111 22 33, TC 10000000146");
ok(!/Deneme|Uydurma|0532|10000000146/.test(m), "mesaj kodlandı: " + m);
const c = Object.entries(k.geri).find(([, ad]) => /Deneme Kişi Bir/i.test(ad))?.[0];
ok(!/2026\/321|İZMİR|İzmir|3\. ASLİYE/.test(k.durum) && /DOSYA-1/.test(k.durum) && /ASLİYE HUKUK MAHKEMESİ-1/.test(k.durum), "mahkeme ve esas no kodlu: " + k.durum.slice(0, 300));
const m2 = k.kodla("İzmir 3. Asliye Hukuk Mahkemesi 2026/321 esas sayılı dosya ile 2024/9 sayılı dosya");
ok(!/2026\/321|2024\/9|İzmir 3/.test(m2) && /DOSYA-1/.test(m2), "mesajdaki numara ve merci kodlandı: " + m2);
ok(geriAc("DOSYA-1 ASLİYE HUKUK MAHKEMESİ-1 dosyasında", k.geri).toLocaleUpperCase("tr") === "2026/321 İZMİR 3. ASLİYE HUKUK MAHKEMESİ DOSYASINDA", "numara ve merci geri açılır: " + geriAc("DOSYA-1 ASLİYE HUKUK MAHKEMESİ-1 dosyasında", k.geri));
ok(!!c && geriAc(`${c} için yeni föy açtım.`, k.geri).startsWith("Deneme Kişi Bir"), "cevap geri açılıyor");
// Ayrılamayan evrak: baş kısmı maskelenip gider; bilinmeyen adlar, kimlik ve adres çıkar, merci ve numara kalır.
const e2 = ev("b", "T.C.\nANKARA CUMHURİYET BAŞSAVCILIĞINA\nŞİKAYETÇİ : HAYALİ ŞAHIS İKİ (TC 10000000078)\nADRES : Uydurma Mah. Deneme Sok. No:3 Çankaya/Ankara\nŞÜPHELİ : SAHTE İSİM ÜÇ\nSUÇ : Dolandırıcılık\nAçıklamalar: 2025/777 sayılı dosya ile ilgilidir.");
const r2 = havuzuGrupla([e2], [], []);
const k2 = kodlaDurum(r2.gruplar, g => g.hedef, () => undefined, r2.ayrilamayan.length ? r2.ayrilamayan : [e2], [], []);
ok(/Dolandırıcılık/.test(k2.durum) && /ozet/.test(k2.durum), "özet var: " + k2.durum.slice(0, 400));
ok(!/HAYALİ|Hayali|SAHTE|Sahte|10000000078|Uydurma Mah|Deneme Sok/.test(k2.durum), "özette gerçek ad, kimlik, adres yok: " + k2.durum);
ok(!/2025\/777|ANKARA|Ankara/.test(k2.durum) && /BAŞSAVCILIĞI-1/.test(k2.durum), "numara ve il kodlanır, merci türü kalır: " + k2.durum);
if (fail) { console.log(`foyleme-test: ${fail} hata`); process.exit(1); }
console.log("foyleme-test: tamam");
