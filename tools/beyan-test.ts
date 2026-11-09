// Beyan editörü: başlık (hitap, taraf sıfatları, vekil, konu), UDF ve Word çıktısının geri okunması (uydurma verilerle).
import { BEYAN_KLASORLERI, BEYAN_TURLERI, beyanCercevesi, beyanTuru, ciktiBicimi, docxOlustur, merciyeHitap, tamMetin, tarafAdlari, udfOlustur, Beyan } from "../src/data/beyan";
import { bosFoy } from "../src/data/foy";
import { docxMetni, udfMetni } from "../src/engine/mask/readers";
import { unzipSync } from "fflate";

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
ok(merciyeHitap("İzmir 2. Asliye Hukuk Mahkemesi") === "İZMİR 2. ASLİYE HUKUK MAHKEMESİ'NE", "hitap -NE: " + merciyeHitap("İzmir 2. Asliye Hukuk Mahkemesi"));
ok(merciyeHitap("İzmir Cumhuriyet Başsavcılığı") === "İZMİR CUMHURİYET BAŞSAVCILIĞI'NA", "hitap -NA");
ok(merciyeHitap("İzmir 9. İcra Dairesi") === "İZMİR 9. İCRA DAİRESİ'NE", "icra dairesi");
ok(tarafAdlari({ tur: "icra", taraf: "davaci" }).join() === "ALACAKLI,BORÇLU" && tarafAdlari({ tur: "ceza", taraf: "davali" }).join() === "SANIK,KATILAN", "taraf sıfatları");
const f = bosFoy({ muvekkil: "Ayşe Uydurmaoğlu", karsiTaraf: "Örnek Sigorta A.Ş.", mahkeme: "İzmir 2. Asliye Hukuk Mahkemesi", esasNo: "2024/1111" });
const b: Beyan = { id: "b1", olusturma: "2026-11-09T10:00:00Z", guncelleme: "2026-11-09T10:00:00Z", tur: BEYAN_TURLERI[1], konu: "Bilirkişi raporuna itirazlarımızın sunulmasıdır.",
  metin: "Yukarıda numarası yazılı dosyada beyanlarımızı sunarız.\n\nAÇIKLAMALAR\n1- Rapor eksiktir & çelişkilidir <özetle>.\n\nSONUÇ VE İSTEM\nYeni heyetten rapor alınmasını saygıyla arz ve talep ederiz." };
const c = beyanCercevesi(f, b, { vekil: "Deneme Avukat", tarih: "09.11.2026" });
ok(c.ust[0] === "İZMİR 2. ASLİYE HUKUK MAHKEMESİ'NE" && c.ust.some(x => /^DOSYA NO\s+: 2024\/1111 Esas$/.test(x)) && c.ust.some(x => /^DAVACI\s+: Ayşe Uydurmaoğlu$/.test(x))
  && c.ust.some(x => /^VEKİLİ\s+: Av\. Deneme Avukat$/.test(x)) && c.ust.some(x => /^DAVALI\s+: Örnek Sigorta A\.Ş\.$/.test(x)) && c.ust.some(x => /^KONU\s+: Bilirkişi/.test(x)), "başlık: " + c.ust.join(" | "));
ok(c.alt.join("|") === "|Saygılarımızla.|09.11.2026|Davacı Vekili|Av. Deneme Avukat", "imza: " + c.alt.join("|"));
const tam = tamMetin(f, b, { vekil: "Deneme Avukat", tarih: "09.11.2026" });
const udf = udfOlustur(tam);
ok(udfMetni(udf).trim() === tam.trim(), "UDF geri okunur");
const icerik = new TextDecoder().decode(unzipSync(udf)["content.xml"]);
ok(/<template format_id="1.8">/.test(icerik) && /Alignment="1"[^>]*><content[^>]*bold="true" startOffset="0"/.test(icerik) && /Alignment="3"/.test(icerik), "UDF biçimi (ortalı hitap, iki yana yaslı gövde)");
const toplam = [...icerik.matchAll(/length="(\d+)"/g)].reduce((a, m) => a + Number(m[1]), 0);
ok(toplam === tam.length + 1, "UDF paragraf ofsetleri metni tam kaplar: " + toplam + " / " + (tam.length + 1));
const docx = docxOlustur(tam);
ok(docxMetni(docx).replace(/\n+/g, "\n").trim() === tam.replace(/\n+/g, "\n").trim(), "Word geri okunur");
// Klasörler ve çerçeveler
ok(BEYAN_KLASORLERI.length >= 12 && new Set(BEYAN_TURLERI).size === BEYAN_TURLERI.length, "klasörler, türler tekil");
ok(beyanTuru("Şikâyet / suç duyurusu").ad === "Şikâyet dilekçesi / suç duyurusu" && beyanTuru("bilinmeyen").cerceve === "mahkeme", "eski adlar ve bilinmeyen tür");
const ck = (tur: string) => beyanCercevesi(f, { konu: "K", tur }, { vekil: "Deneme Avukat", tarih: "09.11.2026" });
let x = ck("Şikâyet dilekçesi / suç duyurusu");
ok(x.ust[0] === "İZMİR CUMHURİYET BAŞSAVCILIĞI'NA" && x.ust.some(y => /^MÜŞTEKİ\s+: Ayşe/.test(y)) && x.ust.some(y => /^ŞÜPHELİ\s+: Örnek/.test(y)) && x.alt.includes("Müşteki Vekili"), "savcılık hitabı: " + x.ust.join(" | "));
x = ck("Bireysel başvuru (olaylar ve ihlal iddiaları)");
ok(x.ust[0] === "ANAYASA MAHKEMESİ BAŞKANLIĞI'NA" && x.ust.some(y => /^BAŞVURUCU\s+: Ayşe/.test(y)) && !x.ust.some(y => /DOSYA NO/.test(y)) && x.alt.includes("Başvurucu Vekili"), "AYM: " + x.ust.join(" | "));
x = ck("AİHM başvurusu (olaylar, ihlaller, iç hukuk yolları)");
ok(x.ust.some(y => /^DAVALI DEVLET \(TÜRKİYE\)\s*: Türkiye Cumhuriyeti$/.test(y)), "AİHM davalı devlet: " + x.ust.join(" | "));
x = ck("Sigorta Tahkim Komisyonu başvurusu");
ok(x.ust[0] === "SİGORTA TAHKİM KOMİSYONU BAŞKANLIĞI'NA" && x.ust.some(y => /^SİGORTA KURULUŞU\s*: Örnek Sigorta/.test(y)), "STK: " + x.ust.join(" | "));
x = ck("Kira sözleşmesi");
ok(x.ust[0] === "KİRA SÖZLEŞMESİ" && !x.alt.length && x.imza === 0, "sözleşme çerçevesi");
x = ck("Ödeme ihtarı");
ok(x.ust[0] === "İHTARNAME" && x.ust.some(y => /^KEŞİDECİ\s+: Ayşe/.test(y)) && x.ust.some(y => /^MUHATAP\s+: Örnek/.test(y)) && x.alt.some(y => /Sayın Noter/.test(y)) && x.alt.slice(-3).join("|") === "09.11.2026|Keşideci Vekili|Av. Deneme Avukat", "ihtarname");
x = ck("Arabuluculuk başvurusu");
ok(x.ust[0] === "İZMİR ADLİYESİ ARABULUCULUK BÜROSU'NA", "arabuluculuk bürosu");
x = ck("Bilirkişi raporu");
ok(x.ust.some(y => /^RAPOR KONUSU\s*: K/.test(y)) && x.alt.includes("Bilirkişi"), "bilirkişi raporu");
const sb = ciktiBicimi(f, { ...b, tur: "Serbest beyan" });
ok(!sb.ortaBaslik && sb.imza === 0 && !/bold="true" startOffset="0"/.test(new TextDecoder().decode(unzipSync(udfOlustur("Sayın müvekkilim,\nmetin", sb.imza, sb.ortaBaslik))["content.xml"])), "serbest: ilk satır ortalı değil");
if (fail) { console.log(`beyan-test: ${fail} hata`); process.exit(1); }
console.log("beyan-test: tamam");
