// Evraktan künye çıkarma: uydurma (sentetik) UYAP biçimli metinlerle.
import { yapiIskeleti, kunyeCikar, kunyeyiDoldur, taraflariEkle } from "../src/data/kunyeCikar";
import { bosFoy, Foy, foyBaslik } from "../src/data/foy";
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const simdi = new Date("2026-11-08T10:00:00Z");

const tutanak = `T.C.
İZMİR 3. ASLİYE HUKUK MAHKEMESİ
DURUŞMA TUTANAĞI
ESAS NO : 2026/321
DAVACI : DENEME KİŞİ BİR - 10000000146 Örnek Mah. Deneme Sok. No:5 Konak/İzmir
VEKİLİ : Av. ÖRNEK AVUKAT
DAVALI : UYDURMA YAPI A.Ş.
VEKİLİ : Av. DENEME VEKİL
DAVA : Kira Alacağı ve Tahliye
Gereği düşünüldü: Bilirkişi raporunun taraflara tebliğine, duruşmanın 12/03/2027 günü saat 10:30'a bırakılmasına karar verildi.`;
const o = kunyeCikar(tutanak, simdi);
ok(o.mahkeme === "İzmir 3. Asliye Hukuk Mahkemesi", "mahkeme: " + o.mahkeme);
ok(o.esasNo === "2026/321", "esas: " + o.esasNo);
ok(o.birinci?.ad === "Deneme Kişi Bir", "davacı: " + o.birinci?.ad);
ok(o.birinci?.kimlikNo === "10000000146", "davacı kimlik: " + o.birinci?.kimlikNo);
ok(o.birinci?.adres === "Örnek Mah. Deneme Sok. No:5 Konak/İzmir", "davacı adres: " + o.birinci?.adres);
ok(o.birinci?.vekil === "Av. Örnek Avukat", "davacı vekili: " + o.birinci?.vekil);
ok(o.ikinci?.ad === "Uydurma Yapı A.Ş.", "davalı: " + o.ikinci?.ad);
ok(o.ikinci?.vekil === "Av. Deneme Vekil", "davalı vekili: " + o.ikinci?.vekil);
ok(o.konu === "Kira Alacağı ve Tahliye", "konu: " + o.konu);
ok(o.durusma === "2027-03-12T10:30", "duruşma: " + o.durusma);

// Davalı vekiliysek müvekkil davalıdır; dolu alanlar değişmez.
const f = bosFoy({ taraf: "davali", mahkeme: "Elle yazılmış" });
const r = kunyeyiDoldur(f, o);
ok(r.ek.muvekkil === "Uydurma Yapı A.Ş." && r.ek.karsiTaraf === "Deneme Kişi Bir", "taraf seçimine göre müvekkil");
ok(r.ek.mahkeme === undefined, "dolu alan korunur");
ok(r.ek.karsiBilgi?.vekil === "Av. Örnek Avukat" && r.ek.karsiBilgi?.kimlikNo === "10000000146", "karşı taraf vekili ve kimliği");

const vekalet = `VEKALETNAME
Ben aşağıda imzası bulunan T.C. Kimlik No: 10000000146 DENEME KİŞİ BİR ... avukatlar ... vekil tayin ettim.
İZMİR 5. NOTERLİĞİ
Tarih: 03.02.2026 Yevmiye No: 04567`;
const v = kunyeCikar(vekalet, simdi).vekalet;
ok(v?.noter === "İzmir 5. Noterliği" && v?.yevmiye === "04567" && v?.tarih === "03.02.2026" && v?.kimlikNo === "10000000146", "vekâletname: " + JSON.stringify(v));
const r2 = kunyeyiDoldur(bosFoy(), kunyeCikar(vekalet, simdi));
ok(r2.ek.muvekkilBilgi?.vekaletname === "İzmir 5. Noterliği, 03.02.2026, yevmiye 04567", "vekâletname alanı: " + r2.ek.muvekkilBilgi?.vekaletname);

const iddianame = `T.C.
İZMİR CUMHURİYET BAŞSAVCILIĞI
Soruşturma No : 2026/9876
MÜŞTEKİ : DENEME MÜŞTEKİ
ŞÜPHELİ : ÖRNEK ŞÜPHELİ
SUÇ : Dolandırıcılık`;
const c = kunyeCikar(iddianame, simdi);
ok(c.mahkeme === "İzmir Cumhuriyet Başsavcılığı" && c.esasNo === "2026/9876" && c.birinci?.ad === "Deneme Müşteki" && c.ikinci?.ad === "Örnek Şüpheli" && c.konu === "Dolandırıcılık", "iddianame/soruşturma: " + JSON.stringify(c));
const eski = kunyeCikar("duruşmanın 12/03/2020 günü saat 10:30'a bırakılmasına", simdi);
ok(!eski.durusma, "geçmiş duruşma alınmaz");

ok(kunyeCikar("GEREKÇELİ KARAR\nDAVA TARİHİ : 05/01/2026\nKARAR TARİHİ : 01/10/2026", simdi).acilis === "2026-01-05", "açılış tarihi");
const tekSatir = kunyeCikar("İZMİR CUMHURİYET BAŞSAVCILIĞINA SUÇ DUYURUSUNDA BULUNAN : DENEME MÜŞTEKİ VEKİLİ : Av. ÖRNEK BÜRO AVUKATI ŞÜPHELİ : ÖRNEK ŞÜPHELİ SUÇ : Dolandırıcılık", simdi);
ok(tekSatir.mahkeme === "İzmir Cumhuriyet Başsavcılığı" && tekSatir.birinci?.ad === "Deneme Müşteki" && tekSatir.birinci?.vekil === "Av. Örnek Büro Avukatı" && tekSatir.ikinci?.ad === "Örnek Şüpheli", "tek satırlık suç duyurusu: " + JSON.stringify(tekSatir));
const sekme = kunyeCikar("İZMİR NÖBETÇİ İŞ MAHKEMESİ'NE\n\nDAVACI\t\t\t: ÖRNEK İŞÇİ (T.C. 10000000146)\nVEKİLİ\t\t\t: Av. ÖRNEK BÜRO AVUKATI\nDAVALI\t\t\t: DENEME İŞVEREN A.Ş.\nKONU\t\t\t: İşçilik alacakları", simdi);
ok(!sekme.mahkeme && sekme.birinci?.ad === "Örnek İşçi" && sekme.birinci?.kimlikNo === "10000000146" && sekme.birinci?.vekil === "Av. Örnek Büro Avukatı" && sekme.ikinci?.ad === "Deneme İşveren A.Ş." && sekme.konu === "İşçilik alacakları", "sekmeli dilekçe: " + JSON.stringify(sekme));
ok(kunyeCikar("GEREKÇELİ KARAR\nDAVA TARİHİ : 05/01/2026\nKARAR TARİHİ : 01/10/2026", simdi).belgeTarihi === "2026-10-01", "belge tarihi: karar tarihi");
const dilekce = kunyeCikar("İZMİR 4. İŞ MAHKEMESİ'NE\nDOSYA NO : 2026/55 Esas\nDAVALI : DENEME İŞVEREN LTD. ŞTİ.", simdi);
ok(dilekce.mahkeme === "İzmir 4. İş Mahkemesi" && dilekce.esasNo === "2026/55", "dilekçe başlığı: " + JSON.stringify(dilekce));
ok(!kunyeCikar("İZMİR NÖBETÇİ ASLİYE HUKUK MAHKEMESİ'NE", simdi).mahkeme, "nöbetçi mahkeme alınmaz");

// PDF'den sütun olarak gelen başlık (iki nokta yok), küçük harfli merci ve roller, başka merciler (uydurma).
{
  const a = kunyeCikar("T.C.\nİzmir 3. Asliye Hukuk Mahkemesi\nESAS NO  2026/55\nDavacı    Uydurma Kişi Dört\nVekili    Av. Örnek Avukat Beş\nDavalı    Hayali Şirket A.Ş.");
  ok(a.mahkeme === "İzmir 3. Asliye Hukuk Mahkemesi" && a.esasNo === "2026/55", "sütunlu başlık merci/no: " + JSON.stringify(a));
  ok(!!a.birinci && /Uydurma Kişi Dört/i.test(a.birinci.ad) && /Örnek Avukat Beş/i.test(a.birinci.vekil || "") && !!a.ikinci && /Hayali Şirket/i.test(a.ikinci.ad), "sütunlu taraflar: " + JSON.stringify(a));
  const b = kunyeCikar("T.C.\nADALET BAKANLIĞI\nTAZMİNAT KOMİSYONU BAŞKANLIĞI\nBAŞVURU NO: 2024/1234\nBAŞVURUCU: UYDURMA KİŞİ ALTI");
  ok(/Tazminat Komisyonu Başkanlığı/.test(b.mahkeme || "") && b.esasNo === "2024/1234" && /Uydurma Kişi Altı/.test(b.birinci?.ad || ""), "komisyon: " + JSON.stringify(b));
  const c = kunyeCikar("T.C.\nBAYRAKLI CUMHURİYET SAVCILIĞI\nSORUŞTURMA NO : 2025/9\nŞÜPHELİ : SAHTE KİŞİ YEDİ");
  ok(/Cumhuriyet Savcılığı/.test(c.mahkeme || ""), "savcılık: " + JSON.stringify(c));
}
// UYAP dosya bilgisi çıktısı (uydurma): etiketli alanlar ve taraf tablosu.
{
  const u = kunyeCikar("Dosya Bilgileri\nBirim    İzmir 7. İş Mahkemesi\nDosya No    2024/456\nDosya Türü    Hukuk Dava Dosyası\nDosya Durumu    Açık\nAçılış Tarihi    05.03.2024\nTaraf Bilgileri\nRol    Tipi    Adı\nDavacı    Kişi    UYDURMA KİŞİ SEKİZ    Av. ÖRNEK VEKİL DOKUZ\nDavalı    Kurum    HAYALİ KURUM A.Ş.");
  ok(u.mahkeme === "İzmir 7. İş Mahkemesi" && u.esasNo === "2024/456" && u.dosyaTuru === "Hukuk Dava Dosyası" && u.acilis === "2024-03-05", "UYAP alanları: " + JSON.stringify(u));
  ok(/Uydurma Kişi Sekiz/.test(u.birinci?.ad || "") && /Örnek Vekil Dokuz/.test(u.birinci?.vekil || "") && /Hayali Kurum/.test(u.ikinci?.ad || ""), "UYAP taraf tablosu: " + JSON.stringify(u));
  const c = kunyeCikar("Birim\nBayraklı Cumhuriyet Başsavcılığı\nDosya No\n2025/7788\nCbs Soruşturma Dosyası\nUYDURMA KİŞİ ON    Müşteki\nSAHTE KİŞİ ONBİR    Şüpheli");
  ok(/Başsavcılığı/.test(c.mahkeme || "") && c.esasNo === "2025/7788" && /Soruşturma/.test(c.dosyaTuru || "") && /Uydurma Kişi On/.test(c.birinci?.ad || "") && /Sahte Kişi Onbir/.test(c.ikinci?.ad || ""), "alt satırda değer, sonda rol: " + JSON.stringify(c));
  const isk = yapiIskeleti("Birim    İzmir 7. İş Mahkemesi\nDavacı    Kişi    UYDURMA KİŞİ SEKİZ    2024/456");
  ok(!/İzmir|UYDURMA|SEKİZ|2024\/456/.test(isk) && /Birim/.test(isk) && /Davacı/.test(isk) && /9999\/999/.test(isk), "iskelet ad ve numara göstermez: " + isk);
}
// Dilekçe başlıkları: etiket / iki nokta / değer ayrı satırda, numaralı taraflar, parantezli rol, "SAYIN HAKİMLİĞİ'NE"
const d1 = kunyeCikar("UYDURMA ASLİYE HUKUK MAHKEMESİ SAYIN HAKİMLİĞİ'NE\n2024/362 E.\nDAVALI\n:\nAYŞE ÖRNEK\nVEKİLİ\n:\nAv. Deneme Avukat\nDAVACI\n:\nMEHMET KURGU\nKONU\n:\nBilirkişi raporuna karşı beyanlarımızdır");
ok(d1.ikinci?.ad === "Ayşe Örnek" && d1.birinci?.ad === "Mehmet Kurgu" && d1.ikinci?.vekil === "Av. Deneme Avukat" && d1.esasNo === "2024/362" && d1.mahkeme === "Uydurma Asliye Hukuk Mahkemesi", "ayrı satırlı başlık: " + JSON.stringify(d1));
const d2 = kunyeCikar("UYDURMA ASLİYE HUKUK MAHKEMESİ'NE\nDOSYA NO : 2024/362\nDAVALILAR (KARŞI DAVACILAR) : 1- AYŞE ÖRNEK 2- ALİ ÖRNEK\nVEKİLLERİ : Av. Deneme Avukat\nDAVACI : MEHMET KURGU");
ok(d2.ikinci?.ad === "Ayşe Örnek", "numaralı ve parantezli rol: " + JSON.stringify(d2.ikinci));
// Hangi tarafın vekiliyiz: evraktaki vekil adımızdan
const fd = bosFoy({ tur: "hukuk", taraf: "davaci" });
const rd = kunyeyiDoldur(fd, d1, ["Av. Deneme Avukat"]);
ok(rd.ek.muvekkil === "Ayşe Örnek" && rd.ek.karsiTaraf === "Mehmet Kurgu" && rd.ek.taraf === "davali", "vekil adımız davalı tarafta: " + JSON.stringify(rd.ek));
ok(!rd.ek.davaTuru, "dilekçenin konusu (beyan) dava konusu yazılmaz");

// Föyde müvekkil yazılı ve evrakta davacı olarak geçiyorsa (föy "davalı" seçili olsa da) karşı tarafa müvekkilin adı yazılmaz.
{
  const o = kunyeCikar("DAVACI : UYDURMA İŞÇİ\nDAVALI : HAYALİ FABRİKA A.Ş.\n");
  const r = kunyeyiDoldur({ ...bosFoy(), muvekkil: "Uydurma İşçi", taraf: "davali" }, o);
  ok(r.ek.taraf === "davaci" && /HAYALİ|Hayali/.test(r.ek.karsiTaraf || ""), "müvekkil adından taraf: " + JSON.stringify(r.ek));
}
// Gerçek ilam başlıkları: uzun şirket unvanı, değer alt satırda, karşı dava rolleri, istinaf rolleri, alt alta numaralı davalılar.
{
  const t = (m: string) => { const o = kunyeCikar(m); return [o.birinci?.ad, o.ikinci?.ad, (o.ikinciler || []).length].join(" | "); };
  ok(/Abc Enerji Üretim İnşaat Turizm Gıda Sanayi ve Ticaret Anonim Şirketi/.test(t("DAVACI\t\t: AYŞE ÖRNEK\nDAVALI\t\t: ABC ENERJİ ÜRETİM İNŞAAT TURİZM GIDA SANAYİ VE TİCARET ANONİM ŞİRKETİ - 1234567890\n")), "uzun unvan");
  ok(t("DAVACI :\nAYŞE ÖRNEK\nDAVALI :\nHAYALİ YAPI A.Ş.\n") === "Ayşe Örnek | Hayali Yapı A.Ş. | 1", "değer alt satırda: " + t("DAVACI :\nAYŞE ÖRNEK\nDAVALI :\nHAYALİ YAPI A.Ş.\n"));
  ok(t("DAVACI-KARŞI DAVALI : AYŞE ÖRNEK\nDAVALI-KARŞI DAVACI : HAYALİ YAPI A.Ş.\n").startsWith("Ayşe Örnek | Hayali Yapı A.Ş."), "karşı dava rolleri");
  ok(t("İSTİNAF EDEN (DAVALI) : HAYALİ YAPI A.Ş.\nKARŞI TARAF (DAVACI) : AYŞE ÖRNEK\n").startsWith("Ayşe Örnek | Hayali Yapı A.Ş."), "istinaf rolleri parantezden: " + t("İSTİNAF EDEN (DAVALI) : HAYALİ YAPI A.Ş.\nKARŞI TARAF (DAVACI) : AYŞE ÖRNEK\n"));
  ok(t("DAVACI : AYŞE ÖRNEK\nDAVALI : 1-HAYALİ YAPI A.Ş.\nDAVALI : 2-ALİ HAYALİ\n") === "Ayşe Örnek | Hayali Yapı A.Ş. | 2", "alt alta numaralı davalılar");
}
// Birden çok davacı, davalı ve vekil: hepsi künyeye tek tek yazılır.
{
  const m = "T.C.\nUYDURMA 2. İŞ MAHKEMESİ\nDAVACILAR : 1- AYŞE ÖRNEK 2- MEHMET DENEME\nVEKİLLERİ : Av. ÖRNEK AVUKAT - Av. İKİNCİ AVUKAT\nVEKİLİ : Av. ÜÇÜNCÜ AVUKAT\nDAVALI : 1-HAYALİ YAPI A.Ş.\nVEKİLİ : Av. BAŞKA VEKİL, Av. DİĞER VEKİL\nDAVALI : 2-SOSYAL GÜVENLİK KURUMU BAŞKANLIĞI\n";
  const r = kunyeyiDoldur({ ...bosFoy(), taraf: "davaci" }, kunyeCikar(m));
  ok(r.ek.muvekkil === "Ayşe Örnek" && r.ek.ekMuvekkiller?.map(x => x.ad).join() === "Mehmet Deneme", "iki davacı: " + JSON.stringify([r.ek.muvekkil, r.ek.ekMuvekkiller]));
  ok(r.ek.karsiTaraf === "Hayali Yapı A.Ş." && r.ek.ekKarsiTaraflar?.map(x => x.ad).join() === "Sosyal Güvenlik Kurumu Başkanlığı", "iki davalı");
  ok(r.ek.muvekkilBilgi?.vekil === "Av. Örnek Avukat" && r.ek.muvekkilBilgi?.ekVekiller?.join() === "Av. İkinci Avukat,Av. Üçüncü Avukat", "üç vekilimiz: " + JSON.stringify(r.ek.muvekkilBilgi));
  ok(r.ek.karsiBilgi?.vekil === "Av. Başka Vekil" && r.ek.karsiBilgi?.ekVekiller?.join() === "Av. Diğer Vekil", "karşı tarafın iki vekili");
  const f2 = { ...bosFoy(), ...r.ek } as Foy;
  ok(foyBaslik(f2) === "Ayşe Örnek ve 1 diğeri – Hayali Yapı A.Ş. ve 1 diğeri", "föy başlığı: " + foyBaslik(f2));
  // Önceden tek taraflı doldurulmuş föy: "Tarafları evraktan yükle" eksik taraf ve vekilleri ekler, var olanı çoğaltmaz.
  const eski = { ...bosFoy(), taraf: "davaci", muvekkil: "AYŞE ÖRNEK", karsiTaraf: "Hayali Yapı A.Ş.", muvekkilBilgi: { vekil: "Av. Örnek Avukat", telefon: "0" }, karsiBilgi: { vekil: "Av. Başka Vekil" } } as Foy;
  const y = taraflariEkle(eski, kunyeCikar(m));
  const f3 = { ...eski, ...y.ek } as Foy;
  ok(f3.muvekkil === "AYŞE ÖRNEK" && f3.ekMuvekkiller?.map(x => x.ad).join() === "Mehmet Deneme", "ikinci müvekkil eklendi: " + JSON.stringify([f3.muvekkil, f3.ekMuvekkiller]));
  ok(f3.ekKarsiTaraflar?.map(x => x.ad).join() === "Sosyal Güvenlik Kurumu Başkanlığı", "ikinci davalı eklendi");
  ok(f3.muvekkilBilgi?.vekil === "Av. Örnek Avukat" && f3.muvekkilBilgi?.ekVekiller?.join() === "Av. İkinci Avukat,Av. Üçüncü Avukat" && f3.muvekkilBilgi?.telefon === "0", "vekillerimiz eklendi, telefon korundu: " + JSON.stringify(f3.muvekkilBilgi));
  ok(f3.karsiBilgi?.ekVekiller?.join() === "Av. Diğer Vekil", "karşı vekil eklendi");
  const z = taraflariEkle(f3, kunyeCikar(m));
  ok(!z.dolan.length, "ikinci kez basınca bir şey eklenmez: " + z.dolan);
  // Müvekkilin adı evrakta yoksa (başka dosyanın evrakı) taraf eklenmez.
  const baska = { ...eski, muvekkil: "Zeynep Başka", karsiTaraf: "Başka Ltd.", muvekkilBilgi: {}, karsiBilgi: {} } as Foy;
  const b2 = taraflariEkle(baska, kunyeCikar(m));
  ok(!Object.keys(b2.ek).length, "başka dosyanın evrakından taraf eklenmez: " + JSON.stringify(b2.ek));
}
if (fail) { console.log(`kunye-test: ${fail} hata`); process.exit(1); }
console.log("kunye-test: tamam");
