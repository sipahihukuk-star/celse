// Maskeleme motoru testi: uydurma (gerçek olmayan) bir dilekçe üzerinde kişisel veri sızıntısı, emsal künyelerinin korunması,
// geri çevirme ve okuyucular denetlenir. Gerçek müvekkil evrakı test verisi olarak KULLANILMAZ.
import { readFileSync } from "fs";
import { join } from "path";
import { zipSync, strToU8 } from "fflate";
import { mask, unmask, leaks, tcknGecerli, geriKodla } from "../src/engine/mask";
import { evrakMetni, zipIcerigi } from "../src/engine/mask/readers";
import { derlemeKredisi, derlenmisMetin, evrakBol, kartlariBirlestir, partiler } from "../src/engine/mask/derleme";

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("  ✗ " + m); } };

/** Kontrol haneleri doğru, uydurma bir TC kimlik numarası. */
function sahteTckn(seed: string): string {
  const d = seed.split("").map(Number);
  const t = (d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7]);
  d.push(((t % 10) + 10) % 10);
  d.push(d.reduce((a, b) => a + b, 0) % 10);
  return d.join("");
}
const TC1 = sahteTckn("123456780"), TC2 = sahteTckn("987654320");
ok(tcknGecerli(TC1) && tcknGecerli(TC2), "sahte TCKN kontrol hanesi");
ok(!tcknGecerli("12345678901"), "geçersiz TCKN reddedilmeli");

const DILEKCE = `ANKARA NÖBETÇİ İDARE MAHKEMESİ BAŞKANLIĞI'NA

DAVACI : Kemal YAZICI (T.C. Kimlik No: ${TC1})
Adres: Çiçekli Mah. Lale Sk. No: 7/3 Çankaya/Ankara
VEKİLİ : Av. Sevgi ÖZTÜRK, Örnek Cad. No: 12 Kat: 3 Konak/İzmir
Tel: 0 (532) 111 22 33 · e-posta: sevgi.ornek@ornekhukuk.test
DAVALI : Milli Savunma Bakanlığı
İHBAR OLUNAN : Deneme İnşaat Taahhüt Ltd. Şti. (Vergi No: 1234567890)

KONU : 12.03.2025 tarihli işlemin iptali.

AÇIKLAMALAR :
1. Müvekkil Kemal YAZICI, 5. Motorlu Piyade Tugayı, 2. Tabur'da görev yaparken ${TC2} T.C. kimlik numaralı tanık Hasan Demirtaş ile birlikte
olay yerindedir. Yazıcı'nın amiri Binbaşı Murat Kılıçarslan tarafından hazırlanan tutanak İzmir 3. İdare Mahkemesi'nin 2024/1188 E. sayılı
dosyasına sunulmuştur. Müvekkil halen Kırıkkale F Tipi Kapalı Ceza İnfaz Kurumu'nda değildir; bu husus Ankara 12. Asliye Hukuk Mahkemesi'nde de tartışılmıştır.
2. Müvekkilin IBAN numarası TR12 0001 0002 0003 0004 0005 06 olup sicil no: 2019-44871 olarak kayıtlıdır. Aracın plakası 06 ABC 123'tür.
3. Danıştay 13. Daire, E. 2018/3269, K. 2023/6335, T. 27.12.2023 kararı ve Yargıtay 4. Hukuk Dairesi'nin E. 2015/386, K. 2015/14940 sayılı
kararı ile Anayasa Mahkemesi'nin B. 2018/22072, T. 11/03/2021 kararı emsal niteliktedir. 2577 sayılı Kanun m. 7/1 uyarınca süre 60 gündür.
4. Dava değeri 150.000,00 TL'dir. İşlem 5 Ocak 2025 tarihinde tebliğ edilmiştir.

SONUÇ VE İSTEM : İşlemin iptaline karar verilmesini saygıyla arz ve talep ederim. 14.04.2025
Davacı Vekili Av. Sevgi ÖZTÜRK`;

const SIZMAMALI = ["Kemal", "YAZICI", "Yazıcı", "Sevgi", "ÖZTÜRK", TC1, TC2, "Çiçekli", "Lale Sk", "Örnek Cad", "532", "sevgi.ornek", "Deneme İnşaat",
  "1234567890", "Hasan", "Demirtaş", "Murat", "Kılıçarslan", "Motorlu Piyade", "2024/1188", "Kırıkkale", "TR12", "2019-44871", "ABC 123", "12.03.2025", "14.04.2025", "5 Ocak", "İzmir"];
const KORUNMALI = ["Milli Savunma Bakanlığı", "E. 2018/3269, K. 2023/6335", "E. 2015/386, K. 2015/14940", "B. 2018/22072", "2577 sayılı", "m. 7/1",
  "150.000,00 TL", "[Mart 2025]", "[Ocak 2025]", "[Nisan 2025]", "İDARE MAHKEMESİ", "ASLİYE HUKUK MAHKEMESİ"];

const r = mask(DILEKCE);
for (const s of leaks(r.masked, SIZMAMALI)) ok(false, `sızıntı: "${s}"`);
for (const s of KORUNMALI) ok(r.masked.includes(s), `korunmalı/olmalı: "${s}"`);
ok(/\[DAVACI\]/.test(r.masked), "davacı rol kodu");
ok(/\[DAVACI\]'nın|\[DAVACI\]’nın/.test(r.masked), "çekim ekiyle soyadı da davacı koduna dönmeli (Yazıcı'nın)");
ok(/\[DAVACI VEKİLİ\]|\[VEKİLİ\]/.test(r.masked), "vekil rol kodu");
ok(/\[TCKN-\d\]/.test(r.masked), "TCKN kodu");
ok(r.entities.every(e => e.count >= 1 && r.map[e.code] === e.value), "varlık listesi map ile tutarlı");

// Geri çevirme: maskelenmiş metin geri açılınca kişisel değerler yerine gelir (tarihlerin günü bilinçli olarak geri gelmez).
const back = unmask(r.masked, r.map);
for (const s of ["Kemal YAZICI", TC1, "Hasan Demirtaş", "2024/1188"]) ok(back.includes(s), `geri çevrilince olmalı: "${s}"`);
const answer = "[DAVACI] lehine [İDARE MAHKEMESİ-1] kararı emsal gösterilebilir.";
ok(!unmask(answer, r.map).includes("[DAVACI]"), "yapay zekâ cevabı geri çevrilmeli");

// Geri kodlama: ekranda gerçek adlarla yazılmış metin (ya da oyuncunun kendi cevabı) sunucuya ve seslendirmeye giderken yeniden kodlanır.
const acik = "Kemal YAZICI'nın tanığı Hasan Demirtaş; Yazıcı ayrıca [Ocak 2025] tarihinde İzmir 3. İdare Mahkemesi'ne başvurdu.";
const kod = geriKodla(acik, r.map, "kod"), ses = geriKodla(acik, r.map, "ses");
for (const v of ["Kemal", "YAZICI", "Yazıcı", "Hasan", "Demirtaş", "İzmir 3."]) { ok(!kod.includes(v), `geri kodlama (kod) sızıntı: ${v}`); ok(!ses.includes(v), `geri kodlama (ses) sızıntı: ${v}`); }
ok(kod.includes("[DAVACI]"), "geri kodlama: davacı kodu");
ok(ses.includes("davacı") && !/\[/.test(ses), "seslendirmede kod yerine rol adı okunmalı: " + ses);
ok(unmask("[Ocak 2025] tarihinde", r.map) === "Ocak 2025 tarihinde", "ay-yıl kodu parantezsiz açılmalı");

// Elle düzeltme: allow ile bir değer açık bırakılır, extra ile ek ifade gizlenir.
const r2 = mask(DILEKCE, { allow: ["Hasan Demirtaş"], extra: ["Binbaşı"] });
ok(r2.masked.includes("Hasan Demirtaş"), "allow: açık kalmalı");
ok(!r2.masked.includes("Binbaşı"), "extra: gizlenmeli");

// Okuyucular: UDF (content.xml CDATA) ve DOCX (word/document.xml).
const udf = zipSync({ "content.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><template><content><![CDATA[DAVACI : Kemal YAZICI\nAçıklama]]></content><properties/></template>`) });
ok(evrakMetni("dilekce.udf", udf).startsWith("DAVACI : Kemal YAZICI"), "UDF okuyucu");
const zip = zipSync({ "dosya/1.udf": udf, "dosya/__MACOSX/x": strToU8("x"), "ic.zip": zipSync({ "2.txt": strToU8("DAVACI : Kemal YAZICI") }), "not.exe": strToU8("x") });
ok(zipIcerigi(zip).map(x => x.ad).join(",") === "2.txt,1.udf" || zipIcerigi(zip).map(x => x.ad).sort().join(",") === "1.udf,2.txt", "ZIP içeriği (iç içe ZIP dahil, desteklenmeyenler atlanır)");
const docx = zipSync({ "word/document.xml": strToU8(`<w:document><w:body><w:p><w:r><w:t>DAVACI :</w:t></w:r><w:r><w:t xml:space="preserve"> Kemal &amp; YAZICI</w:t></w:r></w:p><w:p><w:r><w:t>İkinci</w:t></w:r></w:p></w:body></w:document>`) });
ok(evrakMetni("dilekce.docx", docx) === "DAVACI : Kemal & YAZICI\nİkinci", "DOCX okuyucu");

// Eski Word (.doc): uydurma bir dilekçenin Word 97-2003 hâli (tools/fixtures; gerçek kişi yok).
const doc = evrakMetni("dilekce.doc", new Uint8Array(readFileSync(join(process.cwd(), "tools/fixtures/uydurma-dilekce.doc"))));
ok(doc.includes("DAVACI : Selin KARAKAYA") && doc.includes("Şükür, ğüşıöç ĞÜŞİÖÇ"), "DOC okuyucu (Türkçe harfler dahil)");

// Büyük dosya derleme: bölme, partiler, kart birleştirme, ayıklama ve sıralama, bütçe.
{
  const parcalar: string[] = [];
  for (let i = 1; i <= 40; i++) parcalar.push(`=== Evrak ${i}: belge ${i} ===\n` + (i === 7 ? "Bilirkişi raporu metni.\n".repeat(20000) : `Evrak ${i} metni [DAVACI] hakkında.`));
  const ev = evrakBol(parcalar.join("\n\n"));
  ok(ev.length === 40 && ev[6].no === 7, "evrakBol 40 evrak");
  const ps = partiler(ev);
  ok(ps.every(p => p.reduce((a, x) => a + x.metin.length, 0) <= 180000 && p.length <= 25), "partiler sınır içinde");
  ok(ps.flat().filter(x => x.no === 7).length >= 3, "büyük evrak parçalara bölünür");
  const gelen = [
    { no: 1, tur: "Dava dilekçesi", tarih: "[Ocak 2024]", onem: 3, ozet: "Dava açıldı.", kilit: ["işe iade"] },
    { no: 2, tur: "Tebligat", tarih: "[Şubat 2024]", onem: 0, ozet: "Tebliğ." },
    { no: 7, tur: "Bilirkişi raporu", tarih: "[Mart 2025]", onem: 2, ozet: "Bölüm 1." },
    { no: 7, tur: "Bilirkişi raporu", tarih: "", onem: 3, ozet: "Bölüm 2." },
    { no: 99, tur: "Uydurma", onem: 3, ozet: "yok" }
  ];
  const kartlar = kartlariBirlestir(ev, gelen);
  ok(kartlar.length === 40, "her evraka bir kart (eksikler tamamlanır, uydurma no atlanır)");
  ok(kartlar.find(k => k.no === 7)!.onem === 3 && kartlar.find(k => k.no === 7)!.ozet.includes("Bölüm 2"), "parça kartları birleşir");
  const dm = derlenmisMetin(ev, kartlar, new Set([3]));
  ok(!dm.includes("Tebliğ.") && /1 evrak .*çıkarıldı/.test(dm), "gereksiz evrak ayıklanır");
  ok(dm.indexOf("### Evrak 1 · Dava dilekçesi") < dm.indexOf("### Evrak 3"), "önem sırası");
  ok(dm.includes("Evrak 3 · Evrak · TAM METİN"), "★ işaretli evrakın tam metni eklenir");
  ok(dm.length <= 200000, "derlenmiş dosya bütçe içinde");
  ok(derlemeKredisi(10) === 1 && derlemeKredisi(1500001) === 3, "derleme kredisi hacme göre");
}

// Cümle sonundaki noktalı ya da virgüllü uzun sayı da gizlenir; para tutarları kalır.
{
  const m = mask("Kimlik no 12345678901. Kayıt 98765432109, tutar 1.234.567,89 TL ve 12345678901,50 TL.").masked;
  ok(!/12345678901\.|98765432109/.test(m), "noktalı/virgüllü 11 haneli sayı gizlendi");
  ok(m.includes("1.234.567,89") && m.includes("12345678901,50"), "para tutarları korundu");
}

if (fail) { console.log("\nMASKELENMİŞ:\n" + r.masked + "\n"); console.log(r.entities); console.log(`mask-test: ${fail} hata`); process.exit(1); }
console.log(`mask-test: tamam (${r.entities.length} kod)`);
