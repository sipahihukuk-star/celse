// Evraktan künye çıkarma: uydurma (sentetik) UYAP biçimli metinlerle.
import { kunyeCikar, kunyeyiDoldur } from "../src/data/kunyeCikar";
import { bosFoy } from "../src/data/foy";
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
const dilekce = kunyeCikar("İZMİR 4. İŞ MAHKEMESİ'NE\nDOSYA NO : 2026/55 Esas\nDAVALI : DENEME İŞVEREN LTD. ŞTİ.", simdi);
ok(dilekce.mahkeme === "İzmir 4. İş Mahkemesi" && dilekce.esasNo === "2026/55", "dilekçe başlığı: " + JSON.stringify(dilekce));
ok(!kunyeCikar("İZMİR NÖBETÇİ ASLİYE HUKUK MAHKEMESİ'NE", simdi).mahkeme, "nöbetçi mahkeme alınmaz");

if (fail) { console.log(`kunye-test: ${fail} hata`); process.exit(1); }
console.log("kunye-test: tamam");
