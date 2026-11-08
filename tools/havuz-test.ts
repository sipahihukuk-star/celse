// Evrak havuzu gruplama: uydurma (sentetik) evrakla.
import { bosFoy } from "../src/data/foy";
import { havuzuGrupla, HavuzEvrak } from "../src/data/havuz";
import { kunyeCikar } from "../src/data/kunyeCikar";
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const simdi = new Date("2026-11-08T10:00:00Z");
let n = 0;
const ev = (metin: string): HavuzEvrak => ({ id: "h" + ++n, ad: "e" + n + ".udf", boyut: 1, metin, oneri: kunyeCikar(metin, simdi) });
const bas = (m: string, e: string, d: string, dv: string, dl: string, dlv: string, ek = "") => `T.C.\n${m}\nESAS NO : ${e}\nDAVACI : ${d}\nVEKİLİ : Av. ${dv}\nDAVALI : ${dl}\nVEKİLİ : Av. ${dlv}\n${ek}`;
const a1 = ev(bas("İZMİR 3. ASLİYE HUKUK MAHKEMESİ", "2026/321", "DENEME KİŞİ BİR", "ÖRNEK BÜRO AVUKATI", "UYDURMA YAPI A.Ş.", "DENEME VEKİL", "DAVA TARİHİ : 05/01/2026"));
const a2 = ev("T.C.\nİZMİR 3. ASLİYE HUKUK MAHKEMESİ\nESAS NO : 2026/321\nTENSİP ZAPTI");
const a3 = ev("BİLİRKİŞİ RAPORU\nDosya No: 2026/321 Esas\nDavacı: Deneme Kişi Bir");
const b1 = ev(bas("İZMİR 4. İŞ MAHKEMESİ", "2025/88", "ÖRNEK İŞÇİ", "BAŞKA AVUKAT", "DENEME İŞVEREN LTD. ŞTİ.", "ÖRNEK BÜRO AVUKATI", "DAVA TARİHİ : 10/03/2025"));
const c1 = ev("T.C.\nİZMİR CUMHURİYET BAŞSAVCILIĞI\nSoruşturma No : 2026/9876\nMÜŞTEKİ : DENEME MÜŞTEKİ\nŞÜPHELİ : ÖRNEK ŞÜPHELİ");
const d1 = ev("İHTARNAME\nKeşideci : DENEME KİRAYA VEREN\nMuhatap : ÖRNEK KİRACI");
const x1 = ev("Fatura makbuzu, tutar 1.000 TL");
const varOlan = bosFoy({ tur: "hukuk", mahkeme: "İzmir 3. Asliye Hukuk Mahkemesi", esasNo: "2026/321", muvekkil: "Deneme Kişi Bir" });
const r = havuzuGrupla([a1, a2, a3, b1, c1, d1, x1], [varOlan], ["Örnek Büro Avukatı"]);
const g321 = r.gruplar.find(g => g.esasNo === "2026/321");
ok(!!g321 && g321.evraklar.length === 3, "aynı numaralı 3 evrak tek grupta: " + g321?.evraklar.map(e => e.id));
ok(g321?.hedef.tur === "var" && g321.hedef.foyId === varOlan.id, "var olan föye bağlandı");
const g88 = r.gruplar.find(g => g.esasNo === "2025/88");
ok(g88?.hedef.tur === "yeni" && g88.hedef.foyTur === "hukuk" && g88.hedef.taraf === "davali" && !g88.tarafBelirsiz, "iş davası: yeni föy, davalı vekiliyiz: " + JSON.stringify(g88?.hedef));
ok(g88?.acilis === "2025-03-10", "açılış tarihi");
const gs = r.gruplar.find(g => g.esasNo === "2026/9876");
ok(gs?.hedef.tur === "yeni" && gs.hedef.foyTur === "sorusturma" && !!gs.tarafBelirsiz, "soruşturma: tür ve taraf belirsiz");
ok(r.ayrilamayan.some(e => e.id === x1.id), "künyesiz evrak ayrılamayanlarda");
ok(r.gruplar[0].esasNo === "2025/88", "gruplar açılış tarihine göre sıralı");
void d1;

const arb = ev("T.C.\nİZMİR ARABULUCULUK BÜROSU\nBÜRO NO : 2025/700\nBAŞVURUCU : ÖRNEK İŞÇİ\nKARŞI TARAF : DENEME İŞVEREN LTD. ŞTİ.\nBAŞVURU TARİHİ : 01/02/2025");
const r2 = havuzuGrupla([b1, arb], [], ["Örnek Büro Avukatı"]);
const ga = r2.gruplar.find(g => g.esasNo === "2025/700"), gd = r2.gruplar.find(g => g.esasNo === "2025/88");
ok(ga?.hedef.tur === "yeni" && ga.hedef.foyTur === "arabuluculuk", "arabuluculuk bürosu türü: " + JSON.stringify(ga?.hedef));
ok(!!gd && gd.onceki === ga?.anahtar, "akış: iş davası arabuluculuğun devamı");

if (fail) { console.log(`havuz-test: ${fail} hata`); process.exit(1); }
console.log("havuz-test: tamam");
