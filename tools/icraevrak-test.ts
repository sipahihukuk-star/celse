// Takibe konu evraktan icra bilgisi (uydurma ilam, çek, fatura).
import { dilekceYazari, hukumAnaliz, hukumKalemleri, ilamTaraflari, talepAnaliz } from "../src/data/icraEvrak";
import { icraDoldur, icraEvraktan } from "../src/data/icraEvrak";
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const ilam = `T.C.
UYDURMA 3. ASLİYE TİCARET MAHKEMESİ
ESAS NO : 2015/432
KARAR NO : 2026/592
DAVACI : UYDURMA KİŞİ BİR - 10000000146
VEKİLİ : Av. ÖRNEK AVUKAT
DAVALI : HAYALİ YAPI A.Ş.
KARAR TARİHİ : 24/06/2026
GEREKÇELİ KARAR
...
HÜKÜM: Gerekçesi yukarıda açıklandığı üzere;
1-Davanın KISMEN KABULÜ ile, 15.000,00 TL manevi tazminatın 01/03/2015 tarihinden itibaren işleyecek avans faizi ile birlikte davalıdan alınarak davacıya verilmesine, fazlaya ilişkin talebin reddine,
2-Alınması gereken 1.024,65 TL karar harcından peşin alınan 256,16 TL'nin mahsubu ile bakiye 768,49 TL harcın davalıdan alınarak Hazineye gelir kaydına,
3-Davacı tarafından yatırılan 256,39 TL peşin harcın davalıdan alınarak davacıya verilmesine,
4-Davacı tarafından yapılan 14.345,79 TL yargılama giderinin davalıdan alınarak davacıya verilmesine,
5-AAÜT uyarınca hesaplanan 15.000,00 TL vekalet ücretinin davalıdan alınarak davacıya verilmesine,`;
const r = icraEvraktan(ilam);
ok(r.tur === "ilam" && r.yol === "ilamli", "ilam türü: " + r.tur);
ok(r.bilgi.ilam?.kararNo === "2026/592" && r.bilgi.ilam?.kararTarihi === "2026-06-24" && r.bilgi.ilam?.esasNo === "2015/432" && /Asliye Ticaret/.test(r.bilgi.ilam?.mahkeme || ""), "ilam künyesi: " + JSON.stringify(r.bilgi.ilam));
const ad = r.kalemler.map(k => `${k.ad}:${k.tutar}:${k.faizTuru}:${k.faizBaslangic || ""}`);
ok(ad.includes("Manevi tazminat:15000:avans:2015-03-01"), "manevi tazminat: " + ad.join(" | "));
ok(ad.includes("Yargılama gideri:14345.79:yasal:2026-06-24") && ad.includes("Vekâlet ücreti:15000:yasal:2026-06-24") && ad.includes("Harç:256.39:yasal:2026-06-24"), "giderler: " + ad.join(" | "));
ok(!ad.some(x => x.startsWith("Harç:768.49")), "Hazineye gelir kaydı alınmaz");
const cek = `ÇEK
Muhatap Banka: UYDURMA KATILIM BANKASI A.Ş. Konak Şubesi
Seri No: ABC1234567
Keşide Yeri: İzmir  Keşide Tarihi: 01.08.2026
#50.000,00# TL
Keşideci: HAYALİ TİCARET LTD. ŞTİ.
Karşılıksızdır. Karşılıksız tarihi: 05.09.2026`;
const c = icraEvraktan(cek);
ok(c.tur === "cek" && c.bilgi.senet?.seriNo === "ABC1234567" && c.bilgi.senet?.duzenleme === "2026-08-01" && c.bilgi.senet?.vade === "2026-09-05" && c.kalemler[0]?.tutar === 50000, "çek: " + JSON.stringify(c));
const fat = "E-FATURA\nFatura No: GIB2026000000123\nFatura Tarihi: 10.07.2026\nSon Ödeme Tarihi: 10.08.2026\nGenel Toplam: 12.500,00 TL";
const fr = icraEvraktan(fat);
ok(fr.tur === "fatura" && /10\.07\.2026 tarihli GIB2026000000123 no'lu fatura/.test(fr.bilgi.belge || "") && fr.kalemler[0]?.tutar === 12500 && fr.kalemler[0]?.faizBaslangic === "2026-08-10", "fatura: " + JSON.stringify(fr));
const d = icraDoldur({ yol: "genel" }, ["vekaletname metni", ilam]);
ok(d.yeni.yol === "ilamli" && (d.yeni.kalemler || []).length === 4 && d.yeni.mahiyet === "4045" && d.dolan.length >= 3, "doldurma: " + d.dolan.join(", "));
const d2 = icraDoldur({ yol: "ilamli", kalemler: [{ ad: "Asıl alacak", tutar: 5, faizTuru: "yasal" }] }, [ilam]);
ok(d2.yeni.kalemler!.length === 1, "girilmiş kalemlere dokunulmaz");
// Gerçek ilamlarda sık biçimler: kuruşsuz tutar, "-TL" / ".-TL", bir cümlede birden çok alacak, ayrıntılı yargılama gideri
{
  const h = "HÜKÜM: 1-Davanın KABULÜ ile; 85.000 TL kıdem tazminatının 15/03/2024 fesih tarihinden itibaren en yüksek mevduat faizi ile, 22.500,00.-TL ihbar tazminatının, 40.000,00-TL fazla mesai alacağının ve 12.250 TL yıllık izin ücretinin dava tarihi olan 01/06/2024 tarihinden itibaren yasal faizi ile birlikte davalıdan tahsili ile davacıya ödenmesine, 2-Alınması gereken harçtan peşin alınan harcın mahsubu ile eksik kalan 8.000,00 TL harcın davalıdan alınarak Hazineye gelir kaydına, 3-Davacı tarafından yapılan başvurma harcı 427,60 TL, peşin harç 1.500,00 TL, tebligat ve posta gideri 640,00 TL, bilirkişi ücreti 6.000,00 TL olmak üzere toplam 8.567,60 TL yargılama giderinin davalıdan alınarak davacıya verilmesine, 4-Davacı kendisini vekille temsil ettirdiğinden AAÜT gereğince hesaplanan 32.000,00 TL vekalet ücretinin davalıdan alınarak davacıya verilmesine,";
  const k = hukumKalemleri(h, "2026-06-24");
  const bul = (ad: string) => k.find(x => x.ad === ad);
  ok(bul("Kıdem tazminatı")?.tutar === 85000 && bul("Kıdem tazminatı")?.faizTuru === "mevduat" && bul("Kıdem tazminatı")?.faizBaslangic === "2024-03-15", "kuruşsuz kıdem: " + JSON.stringify(bul("Kıdem tazminatı")));
  ok(bul("İhbar tazminatı")?.tutar === 22500 && bul("Fazla mesai alacağı")?.tutar === 40000 && bul("Yıllık izin ücreti")?.tutar === 12250, "aynı cümlede dört alacak: " + JSON.stringify(k));
  ok(bul("Fazla mesai alacağı")?.faizBaslangic === "2024-06-01" && bul("Fazla mesai alacağı")?.faizTuru === "yasal", "ortak faiz başlangıcı ve türü: " + JSON.stringify(bul("Fazla mesai alacağı")));
  ok(bul("Yargılama gideri")?.tutar === 8567.6 && !k.some(x => x.tutar === 427.6 || x.tutar === 8000), "yargılama gideri toplamı; hazineye harç alınmaz: " + JSON.stringify(k));
  ok(bul("Vekâlet ücreti")?.tutar === 32000 && k.length === 6, "toplam 6 kalem: " + k.map(x => x.ad + " " + x.tutar).join(" | "));
}
// Kimin lehine: iki vekâlet ücreti, reddedilen kısım, iade, Hazine; "H Ü K Ü M" başlığı; aynı maddede kabul ve red
{
  const h = "GEREKÇE: bilirkişi 120.000,00 TL hesaplamıştır. H Ü K Ü M : 1-Davanın KISMEN KABULÜ ile, brüt 85.000,00 TL kıdem tazminatının fesih tarihi olan 15/03/2024 tarihinden itibaren bankalarca mevduata uygulanan en yüksek faiz ile davalıdan tahsili ile davacıya verilmesine, fazlaya ilişkin 35.000,00 TL talebin REDDİNE, 2-Davacı tarafından yatırılan gider avansından kullanılmayan 1.250,00 TL'nin karar kesinleştiğinde davacıya iadesine, 3-Kabul edilen kısım üzerinden AAÜT gereğince hesaplanan 17.000,00 TL vekalet ücretinin davalıdan alınarak kendisini vekille temsil ettiren davacıya verilmesine, 4-Reddedilen kısım üzerinden AAÜT gereğince hesaplanan 8.400,00 TL vekalet ücretinin davacıdan alınarak davalıya verilmesine, 5-Eksik kalan 4.300,00 TL harcın davalıdan alınarak Hazineye gelir kaydına,";
  const a = hukumAnaliz(h, "2026-06-24");
  const k = a.find(x => x.ad === "Kıdem tazminatı");
  ok(!!k && k.tutar === 85000 && k.lehine === "birinci" && k.brutMu && k.faizTuru === "mevduat" && k.faizBaslangic === "2024-03-15", "kıdem davacı lehine (aynı maddede red olsa da): " + JSON.stringify(k));
  ok(!a.some(x => x.tutar === 120000), "gerekçedeki tutar alınmaz");
  ok((a.find(x => x.tutar === 35000)?.lehine ?? "red") === "red" && a.find(x => x.tutar === 1250)?.lehine === "iade" && a.find(x => x.tutar === 4300)?.lehine === "hazine", "red, iade, Hazine: " + JSON.stringify(a.map(x => [x.tutar, x.lehine])));
  const v = a.filter(x => x.ad === "Vekâlet ücreti");
  ok(v.length === 2 && v.find(x => x.tutar === 17000)?.lehine === "birinci" && v.find(x => x.tutar === 8400)?.lehine === "ikinci", "iki vekâlet ücreti, ayrı taraflara: " + JSON.stringify(v.map(x => [x.tutar, x.lehine])));
  const davaci = hukumKalemleri(h, "2026-06-24", "birinci"), davali = hukumKalemleri(h, "2026-06-24", "ikinci");
  ok(davaci.map(x => x.tutar).join(",") === "85000,17000", "davacı vekilinin takibe koyacağı: " + JSON.stringify(davaci));
  ok(davali.map(x => x.tutar).join(",") === "8400", "davalı vekilinin takibe koyacağı: " + JSON.stringify(davali));
}
// Gerçek gerekçeli karar düzeni: başlıkta taraflar ve dava tarihi; iddia özetinde istenen tutarlar ve ıslah; "HÜKÜM" iki noktasız;
// hükmün altında yargılama gideri dökümü; karşı dava; adla anılan taraf; kabul oranına göre hesaplanan gider.
{
  const ilam = [
    "T.C.", "UYDURMA 4. İŞ MAHKEMESİ", "GEREKÇELİ KARAR", "ESAS NO : 2023/101 Esas", "KARAR NO : 2026/77",
    "DAVACI : UYDURMA İŞÇİ - 10000000146", "VEKİLİ : Av. ÖRNEK AVUKAT", "DAVALI : HAYALİ FABRİKA A.Ş.", "VEKİLİ : Av. BAŞKA VEKİL",
    "DAVA : Alacak (İşçilik Alacağı)", "DAVA TARİHİ : 01/02/2023", "KARAR TARİHİ : 10/09/2026",
    "Davacı vekili dava dilekçesinde özetle; fazlaya ilişkin hakları saklı kalmak kaydıyla şimdilik 1.000,00 TL kıdem tazminatı, 500,00 TL ihbar tazminatının davalıdan tahsilini talep ve dava etmiştir.",
    "Davacı vekili 12/03/2025 tarihli ıslah dilekçesi ile kıdem tazminatı talebini 90.000,00 TL'ye, ihbar tazminatı talebini 12.500,00 TL'ye artırmıştır.",
    "Davalı vekili cevap dilekçesinde davanın reddini talep etmiştir. Bilirkişi 95.000 TL hesaplamıştır.",
    "HÜKÜM Gerekçesi yukarıda açıklandığı üzere;",
    "1-Davanın KISMEN KABULÜ ile; 85.000,00 TL brüt kıdem tazminatının dava tarihinden itibaren en yüksek mevduat faizi ile davalıdan alınarak davacı işçiye verilmesine,",
    "2-12.500,00 TL brüt ihbar tazminatının ıslah tarihinden itibaren yasal faiziyle davalıdan tahsiline,",
    "3-Davacı tarafından yapılan 450,00 TL tebligat ve 2.000,00 TL bilirkişi olmak üzere toplam 2.450,00 TL yargılama giderinden kabul ve red oranına göre hesaplanan 2.100,00 TL'nin davalıdan alınarak davacıya verilmesine, bakiyenin davacı üzerinde bırakılmasına,",
    "4-Kabul edilen 97.500,00 TL üzerinden hesaplanan 17.000,00 TL vekalet ücretinin davalı HAYALİ FABRİKA'dan alınarak UYDURMA İŞÇİ'ye verilmesine,",
    "5-Davalı-karşı davacı yararına takdir edilen 8.400,00 TL vekalet ücretinin davacı-karşı davalıdan alınarak davalı-karşı davacıya verilmesine,",
    "Dair, tarafların yüzüne karşı gerekçeli kararın tebliğinden itibaren 2 hafta içinde istinaf yolu açık olmak üzere verilen karar açıkça okunup usulen anlatıldı.",
    "Katip 123456 Hakim 654321",
    "YARGILAMA GİDERLERİ : Başvurma harcı 80,70 TL, Peşin harç 427,60 TL"
  ].join("\n");
  const a = hukumAnaliz(ilam);
  const b = (t: number) => a.find(x => x.tutar === t);
  ok(!a.some(x => [1000, 500, 90000, 95000, 80.7, 427.6, 2450, 97500].includes(x.tutar)), "iddia, gerekçe, gider dökümü ve 'üzerinden' tutarları alınmaz: " + JSON.stringify(a.map(x => x.tutar)));
  ok(b(85000)?.lehine === "birinci" && b(85000)?.faizBaslangic === "2023-02-01" && b(85000)?.faizTuru === "mevduat", "davacı işçiye; dava tarihi başlıktan: " + JSON.stringify(b(85000)));
  ok(b(12500)?.lehine === "birinci" && b(12500)?.faizBaslangic === "2025-03-12", "davalıdan tahsiline → davacı lehine; ıslah tarihi: " + JSON.stringify(b(12500)));
  ok(b(2100)?.ad === "Yargılama gideri" && b(2100)?.lehine === "birinci", "kabul oranına göre hesaplanan gider: " + JSON.stringify(a.map(x => [x.ad, x.tutar])));
  ok(b(17000)?.ad === "Vekâlet ücreti" && b(17000)?.lehine === "birinci", "adla anılan alan taraf: " + JSON.stringify(b(17000)));
  ok(b(8400)?.lehine === "ikinci", "karşı dava rolü: " + JSON.stringify(b(8400)));
  ok(a.length === 5, "beş kalem: " + a.map(x => x.ad + " " + x.tutar + " " + x.lehine).join(" | "));
  const it = ilamTaraflari(ilam);
  ok(it.davaTarihi === "2023-02-01" && it.kararTarihi === "2026-09-10" && it.islahTarihi === "2025-03-12" && /UYDURMA|Uydurma/.test(it.birinci?.ad || "") && /Başka|BAŞKA/i.test(it.ikinci?.vekil || ""), "ilam tarafları: " + JSON.stringify(it));
  const tp = talepAnaliz(ilam);
  ok(tp.find(x => x.ad === "Kıdem tazminatı")?.tutar === 90000 && tp.find(x => x.ad === "İhbar tazminatı")?.tutar === 12500, "ıslahla istenen: " + JSON.stringify(tp));
  const dil = "DAVACI : X\nVEKİLİ : Av. Örnek Avukat\nDAVALI : Y A.Ş.\nNETİCE VE TALEP : Fazlaya ilişkin haklarımız saklı kalmak kaydıyla 1.000 TL kıdem tazminatının davalıdan tahsili ile müvekkile verilmesine, yargılama giderlerinin davalıya yükletilmesine karar verilmesini saygılarımızla arz ve talep ederiz.\nDavacı Vekili\nAv. Örnek Avukat";
  ok(dilekceYazari(dil).yan === "birinci" && /Örnek Avukat/.test(dilekceYazari(dil).imza || ""), "dilekçeyi davacı vekili yazmış: " + JSON.stringify(dilekceYazari(dil)));
  ok(talepAnaliz(dil)[0]?.tutar === 1000, "netice ve talep: " + JSON.stringify(talepAnaliz(dil)));
  const cevap = "DAVACI : X\nDAVALI : Y\nSONUÇ VE İSTEM : Haksız ve mesnetsiz davanın reddine karar verilmesini talep ederiz.";
  ok(dilekceYazari(cevap).yan === "ikinci", "cevap dilekçesi davalı tarafından");
}
if (fail) { console.log(`icraevrak-test: ${fail} hata`); process.exit(1); }
console.log("icraevrak-test: tamam");
