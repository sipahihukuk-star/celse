// Yapılacaklar takibi: uyarı düzeyi ve görselden iş emri numarası (uydurma verilerle).
import { bosFoy } from "../src/data/foy";
import { duzeySayilari, isEmriAdaylari, isListesi, uyariDuzeyi } from "../src/data/isTakibi";

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const f = bosFoy({ muvekkil: "Uydurma Kişi", mahkeme: "Uydurma 1. Asliye Hukuk Mahkemesi", esasNo: "2025/1" });
const g = (tarih?: string, eklenme = "2026-11-01", bitti = false) => ({ id: "g" + Math.random(), metin: "İş", tarih, eklenme, bitti, kaynak: "elle" as const });
const B = "2026-11-09";
ok(uyariDuzeyi(g("2026-12-31"), f, B).duzey === "sakin", "uzak son gün sakin");
ok(uyariDuzeyi(g("2026-11-20", "2026-11-08"), f, B).duzey === "dikkat", "11 gün dikkat");
ok(uyariDuzeyi(g("2026-11-15", "2026-11-08"), f, B).duzey === "uyari", "6 gün uyarı");
ok(uyariDuzeyi(g("2026-11-11"), f, B).duzey === "acil", "2 gün acil");
ok(uyariDuzeyi(g(B), f, B).duzey === "bugun", "bugün");
ok(uyariDuzeyi(g("2026-11-05"), f, B).duzey === "gecikti" && uyariDuzeyi(g("2026-11-05"), f, B).metin === "4 gün gecikti", "gecikti");
// Gün geçtikçe artar: 30 gün kala aynı iş, sürenin %75'i geçtiyse uyarı.
ok(uyariDuzeyi(g("2026-12-09", "2026-11-09"), f, B).duzey === "sakin", "yeni eklenen 30 gün sakin");
ok(uyariDuzeyi(g("2026-11-29", "2026-09-01"), f, B).duzey === "uyari", "sürenin çoğu geçmiş, 20 gün kala uyarı");
ok(uyariDuzeyi(g("2026-12-09", "2026-10-10"), f, B).duzey === "dikkat", "yarısı geçmiş dikkat");
ok(uyariDuzeyi(g(undefined, "2026-11-01"), f, B).duzey === "tarihsiz" && uyariDuzeyi(g(undefined, "2026-10-01"), f, B).duzey === "uyari", "tarihsiz bekledikçe uyarır");
const f2 = { ...f, gorevler: [g("2026-11-05"), g("2026-12-31"), g(undefined, "2026-11-01", true)] };
ok(isListesi([f2], { gorunum: "acik", duzey: "hepsi", tur: "hepsi", ara: "" }, B).map(x => x.u.duzey).join() === "gecikti,sakin", "sıralama ve açıklar");
ok(isListesi([f2], { gorunum: "acik", duzey: "acil", tur: "hepsi", ara: "" }, B).length === 1, "acil süzgeci");
ok(duzeySayilari([f2], B).gecikti === 1, "sayılar");
// Görsel (yazı tanıma çıktısı) — uydurma.
const ocr = "UYAP Avukat Portal\nEvrak Gönderildi\nEvrak No : 4O1234567\nDosya No 2025/123\nT.C. Kimlik 12345678901\nTarih 09.11.2026";
const a = isEmriAdaylari(ocr);
ok(a[0]?.no === "401234567", "evrak no (O→0): " + JSON.stringify(a));
ok(!a.some(x => x.no === "12345678901" || x.no === "2025/123"), "TCKN ve dosya no aday değil");
ok(isEmriAdaylari("İş Emri Numarası: IE-2026-00871")[0]?.no === "IE-2026-00871", "iş emri no");
ok(isEmriAdaylari("Makbuz no 778899\nBarkod 1234567890123")[0]?.no.length > 0, "makbuz/barkod");
if (fail) { console.log(`istakibi-test: ${fail} hata`); process.exit(1); }
console.log("istakibi-test: tamam");
