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
ok(!!c && geriAc(`${c} için yeni föy açtım.`, k.geri).startsWith("Deneme Kişi Bir"), "cevap geri açılıyor");
if (fail) { console.log(`foyleme-test: ${fail} hata`); process.exit(1); }
console.log("foyleme-test: tamam");
