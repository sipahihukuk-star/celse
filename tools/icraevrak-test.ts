// Takibe konu evraktan icra bilgisi (uydurma ilam, çek, fatura).
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
if (fail) { console.log(`icraevrak-test: ${fail} hata`); process.exit(1); }
console.log("icraevrak-test: tamam");
