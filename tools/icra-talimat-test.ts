// İcra talimatı: yapıştırılan ilamın sonundaki istek ayrılır, tutarlar ve eklenecek taraflar cihazda okunur (uydurma ilam).
import { readFileSync } from "fs";
import { join } from "path";
import { bosFoy, Foy } from "../src/data/foy";
import { evrakTuruBul, hukumKalemleri, icraEvraktan, ilamdanTaraflar, ilamTaraflari } from "../src/data/icraEvrak";
import { adCoz, talimatAyir, talimatOku, talimatUygula } from "../src/data/icraTalimat";
import { takipTalebiMetni, tumBorclular } from "../src/data/icra";

let fail = 0;
const ok = (c: unknown, m: string) => { if (c) console.log("✓ " + m); else { fail++; console.log("✗ " + m); } };
const ham = readFileSync(join(__dirname, "ornek/bam-ilam.txt"), "utf8");

const { evrak, talimat } = talimatAyir(ham);
ok(/^bu kararı 10\.000 tl vekalet/.test(talimat), "talimat ayrıldı: " + talimat.slice(0, 50));
ok(/e-imzalıdır$/.test(evrak) && !/hazırla/.test(evrak), "evrak talimatsız");
ok(evrakTuruBul(evrak) === "ilam", "bölge adliye kararı ilam sayılır");
// Hüküm uzun gerekçenin sonunda (ilk 6000 karakterden sonra) olsa da ilam.
const uzun = evrak.replace("Dosya kapsamına göre", ("Bilirkişi raporu ve tanık beyanları birlikte değerlendirilmiştir. ").repeat(120) + "Dosya kapsamına göre").replace(/gereği düşünüldü/i, "incelendi");
ok(evrakTuruBul(uzun) === "ilam", "hüküm metnin sonunda olsa da ilam");
const it = ilamTaraflari(evrak);
ok(it.birinciler.map(x => x.ad).join("|") === "Ayşe Örnek Deneme|Mehmet Deneme", "iki davacı: " + it.birinciler.map(x => x.ad));
ok(it.ikinciler.map(x => x.ad).join("|") === "Hayali Yılmaz|Kurgu Yılmaz", "iki davalı: " + it.ikinciler.map(x => x.ad));
ok(it.ikinciler[1].adres === "Kurgu Mah. Masal Cad. No:9 Buca/İZMİR" && it.birinciler[1].kimlikNo === "22222222220", "ikinci tarafların adres ve kimlik no'su");
ok(icraEvraktan(evrak).bilgi.ilam?.mahkeme === "İzmir Bölge Adliye Mahkemesi 20. Hukuk Dairesi", "mahkeme tam adı: " + icraEvraktan(evrak).bilgi.ilam?.mahkeme);
const hk = hukumKalemleri(evrak);
ok(hk.map(k => k.ad + ":" + k.tutar).join("|") === "Maddi tazminat:35000|Vekâlet ücreti:10000|Yargılama gideri:2538", "hüküm kalemleri: " + hk.map(k => k.ad + ":" + k.tutar));

const r = talimatOku(talimat);
ok(JSON.stringify(r.kalemler) === JSON.stringify([{ ad: "Vekâlet ücreti", tutar: 10000 }, { ad: "Yargılama gideri", tutar: 2538 }]), "talimattaki tutarlar: " + JSON.stringify(r.kalemler));
ok(r.alacaklilar.join() === "mehmet deneme" && r.borclular.join() === "kurgu yılmazı", "talimattaki adlar: " + JSON.stringify([r.alacaklilar, r.borclular]));
ok(adCoz("kurgu yılmazı", it.ikinciler).ad === "Kurgu Yılmaz", "ek atılıp evraktaki tarafla eşleşti");
ok(adCoz("ömer keskini", []).ad === "Ömer Keskin", "evrakta yoksa belirtme eki atılır");
ok(adCoz("Ali'yi", []).ad === "Ali", "kesme işaretli ek atılır");

const f: Foy = { ...bosFoy({ tur: "icra", taraf: "davaci" }), muvekkil: "Ayşe Örnek Deneme", karsiTaraf: "Hayali Yılmaz" };
const u = talimatUygula(f, r, { taraflar: [...it.birinciler, ...it.ikinciler], kaynak: evrak, hukumKalemleri: hk, kararTarihi: it.kararTarihi, ilamli: true });
const g = { ...f, ...u.ek } as Foy;
ok(g.ekMuvekkiller?.[0]?.ad === "Mehmet Deneme" && g.ekMuvekkiller?.[0]?.kimlikNo === "22222222220", "ek alacaklı künyeye (kimlik no'suyla)");
ok(g.icra?.ekBorclular?.[0]?.ad === "Kurgu Yılmaz" && !!g.icra?.ekBorclular?.[0]?.adres, "ek borçlu takibe (adresiyle)");
ok(g.icra?.yol === "ilamli" && g.icra?.kalemler?.length === 3 && g.icra.kalemler.find(k => k.ad === "Vekâlet ücreti")?.tutar === 10000, "ilamlı, üç kalem");
// Talimat başka tutar derse hükümdekinin üstüne yazılır.
const u2 = talimatUygula(g, talimatOku("vekalet ücreti 12.500 TL olsun, ayrıca 1.250,50 tl harç ekle"), {});
ok(u2.ek.icra?.kalemler?.find(k => k.ad === "Vekâlet ücreti")?.tutar === 12500 && u2.ek.icra?.kalemler?.find(k => k.ad === "Harç")?.tutar === 1250.5, "talimat tutarı değiştirir ve ekler");
// İkinci kez aynı talimat bir şey değiştirmez.
ok(!talimatUygula(g, r, { taraflar: [...it.birinciler, ...it.ikinciler], kaynak: evrak }).dolan.length, "aynı talimat ikinci kez değişiklik yapmaz");
// İlamdan taraflar: iki davacı alacaklı, iki davalı borçlu; vekilimizin büro adresi.
const bos: Foy = { ...bosFoy({ tur: "icra", taraf: "davaci" }), muvekkil: "", karsiTaraf: "" };
const y = ilamdanTaraflar(bos, it, "birinci", { ekAlacakli: true });
ok(!ilamdanTaraflar(bos, it, "birinci").ek.ekMuvekkiller, "vekil biz değilken öteki davacı alacaklı yapılmaz");
const h2 = { ...bos, ...y.ek } as Foy;
ok(h2.muvekkil === "Ayşe Örnek Deneme" && h2.ekMuvekkiller?.map(x => x.ad).join() === "Mehmet Deneme", "iki alacaklı: " + JSON.stringify([h2.muvekkil, h2.ekMuvekkiller]));
ok(h2.karsiTaraf === "Hayali Yılmaz" && h2.icra?.ekBorclular?.map(x => x.ad).join() === "Kurgu Yılmaz", "iki borçlu");
ok(h2.muvekkilBilgi?.adres === "Örnek Mah. Deneme Sok. No:5 Karşıyaka/İZMİR" && h2.karsiBilgi?.kimlikNo === "33333333330", "adres ve kimlik no ilamdan");
ok(it.birinci?.vekilAdres === "Hayal Mah. 1. Sok. No:3 Karşıyaka/İZMİR", "vekilin büro adresi: " + it.birinci?.vekilAdres);
// Davalılar başka biçimlerde yazılmış olsa da hepsi okunur.
{
  const bas = "T.C.\nİZMİR\nBÖLGE ADLİYE MAHKEMESİ\n20. HUKUK DAİRESİ\nDOSYA NO : 2025/1\nKARAR NO : 2026/2\nDAVACI : AYŞE ÖRNEK\nVEKİLİ : Av. ÖRNEK AVUKAT\n";
  const son = "\nHÜKÜM : 1- 1.000,00 TL vekalet ücretinin davalılardan alınarak davacıya verilmesine,\nDair karar verildi.\ne-imzalıdır";
  const bicimler: Record<string, string> = {
    "ayrı satır": "DAVALI : HAYALİ YILMAZ - 33333333330\nKurgu Mah. Masal Cad. No:9 Buca/İZMİR\nDAVALI : KURGU YILMAZ - 44444444440\nVEKİLİ : Av. BAŞKA VEKİL",
    "numarasız alt satır": "DAVALILAR : HAYALİ YILMAZ - T.C. 33333333330\nKurgu Mah. Masal Cad. No:9 Buca/İZMİR\nKURGU YILMAZ - T.C. 44444444440\nKurgu Mah. Masal Cad. No:9 Buca/İZMİR\nVEKİLİ : Av. BAŞKA VEKİL",
    "tek satırda numaralı": "DAVALILAR : 1- HAYALİ YILMAZ 2- KURGU YILMAZ\nVEKİLİ : Av. BAŞKA VEKİL",
    "ve ile": "DAVALILAR : HAYALİ YILMAZ ve KURGU YILMAZ\nVEKİLİ : Av. BAŞKA VEKİL",
    "virgülle": "DAVALILAR : HAYALİ YILMAZ, KURGU YILMAZ\nVEKİLİ : Av. BAŞKA VEKİL",
    "birleşen dava": "DAVALI : HAYALİ YILMAZ\nVEKİLİ : Av. BAŞKA VEKİL\nBİRLEŞEN DAVADA DAVALI : KURGU YILMAZ",
    "boşluksuz numara": "DAVALILAR : 1-HAYALİ YILMAZ 2-KURGU YILMAZ\nVEKİLİ : Av. BAŞKA VEKİL",
    "sekmeyle": "DAVALILAR : HAYALİ YILMAZ\tKURGU YILMAZ\nVEKİLİ : Av. BAŞKA VEKİL",
    "çok boşlukla": "DAVALILAR : HAYALİ YILMAZ      KURGU YILMAZ\nVEKİLİ : Av. BAŞKA VEKİL",
    "her davalının altında vekili": "DAVALILAR : 1. HAYALİ YILMAZ - T.C. 33333333330\nKurgu Mah. Masal Cad. No:9 Buca/İZMİR\nVEKİLİ : Av. BAŞKA VEKİL\n2. KURGU YILMAZ - T.C. 44444444440\nKurgu Mah. Masal Cad. No:9 Buca/İZMİR\nVEKİLİ : Av. DİĞER VEKİL",
    "numaralı rol etiketi": "1.DAVALI : HAYALİ YILMAZ\nVEKİLİ : Av. BAŞKA VEKİL\n2.DAVALI : KURGU YILMAZ",
    "rolden sonra numara": "DAVALI 1 : HAYALİ YILMAZ\nDAVALI 2 : KURGU YILMAZ\nVEKİLİ : Av. BAŞKA VEKİL",
    "satır içinde, küçük harfli": "DAVALILAR : 1. Hayali Yılmaz (TC: 33333333330) Kurgu Mah. Masal Cad. No:9 Buca/İZMİR 2. Kurgu Yılmaz (TC: 44444444440) Kurgu Mah. Masal Cad. No:9 Buca/İZMİR\nVEKİLİ : Av. BAŞKA VEKİL",
    "ikinci, adres ve vekilden sonra": "DAVALILAR : 1- HAYALİ YILMAZ\nT.C. 33333333330\nKurgu Mah. 2. Sok. No:9 Buca/İZMİR\nVEKİLİ : Av. BAŞKA VEKİL\nAvukat Mah. 1. Cad. No:2 Konak/İZMİR\n2- KURGU YILMAZ\nT.C. 44444444440\nKurgu Mah. Masal Cad. No:9 Buca/İZMİR",
    "numara noktalı, vekil adresli": "DAVALILAR : 1. HAYALİ YILMAZ\nVEKİLİ : Av. BAŞKA VEKİL\nAvukat Mah. Hukuk Sok. No:1 Konak/İZMİR\n2. KURGU YILMAZ\nKurgu Mah. Masal Cad. No:9 Buca/İZMİR\nDAVANIN KONUSU : Tazminat\n1. Davanın KABULÜNE karar verildi\n2. Fazlaya ilişkin talebin reddine"
  };
  for (const [ad, x] of Object.entries(bicimler)) {
    const t2 = ilamTaraflari(bas + x + son);
    ok(t2.ikinciler.map(y => y.ad).join("|") === "Hayali Yılmaz|Kurgu Yılmaz" && t2.ikinci?.ad === "Hayali Yılmaz", "iki davalı (" + ad + "): " + t2.ikinciler.map(y => y.ad).join("|") + " / " + t2.ikinci?.ad);
  }
  const tablo = ilamTaraflari("T.C.\nUYDURMA 1. ASLİYE HUKUK MAHKEMESİ\nESAS NO : 2025/1\nKARAR NO : 2026/2\nDavacı\tKişi\tAYŞE ÖRNEK\tAv. ÖRNEK AVUKAT\nDavalı\tKişi\tHAYALİ YILMAZ\nDavalı\tKişi\tKURGU YILMAZ\tAv. BAŞKA VEKİL" + son);
  ok(tablo.ikinciler.map(y => y.ad).join("|") === "Hayali Yılmaz|Kurgu Yılmaz", "UYAP tablosunda her satırdaki davalı: " + tablo.ikinciler.map(y => y.ad));
  ok(ilamTaraflari(bas.replace("AYŞE ÖRNEK", "ÖRNEK SANAYİ VE TİCARET A.Ş.") + "DAVALI : HAYALİ YILMAZ" + son).birinciler.length === 1, "şirket unvanındaki 've' bölünmez");
}
// Önceden bir ek borçlu yazılmışsa ilamdaki öteki borçlu yine eklenir; künyede de görünür; çıktılarda tekrar yok.
{
  const f0: Foy = { ...bosFoy({ tur: "icra", taraf: "davaci" }), muvekkil: "Ayşe Örnek Deneme", karsiTaraf: "Hayali Yılmaz", icra: { yol: "ilamli", ekBorclular: [{ ad: "Elle Yazılan Kefil" }] } };
  const r0 = ilamdanTaraflar(f0, it, "birinci");
  const g0 = { ...f0, ...r0.ek } as Foy;
  ok(g0.icra?.ekBorclular?.map(x => x.ad).join("|") === "Elle Yazılan Kefil|Kurgu Yılmaz", "ek borçlu varken ilamdaki öteki borçlu eklenir: " + g0.icra?.ekBorclular?.map(x => x.ad));
  ok(g0.ekKarsiTaraflar?.map(x => x.ad).join() === "Kurgu Yılmaz", "künyede de görünür");
  ok(tumBorclular(g0).map(x => x.ad).join("|") === "Hayali Yılmaz|Kurgu Yılmaz|Elle Yazılan Kefil", "bütün borçlular bir kez: " + tumBorclular(g0).map(x => x.ad));
  const tt = takipTalebiMetni(g0, g0.icra!, "2026-11-13");
  ok((tt.match(/Kurgu Yılmaz/g) || []).length === 1 && /3\) Elle Yazılan Kefil/.test(tt), "takip talebinde üç borçlu, tekrar yok");
  const k2 = talimatUygula({ ...f0, karsiTaraf: "Kurgu" } as Foy, talimatOku("borçlu kurgu yılmazı de ekle"), { taraflar: it.ikinciler });
  ok(k2.ek.icra?.ekBorclular?.some(x => x.ad === "Kurgu Yılmaz"), "kısa adlı birinci borçlu, uzun adlı ikinciyi engellemez");
}
// Sohbetten kutulara: icra dairesi, IBAN, kimlik no, adres, ilam bilgileri, faiz, masraf, not.
{
  const al = talimatOku("icra dairesi izmir 5. icra dairesi olsun, IBAN TR12 0006 4000 0011 2345 6789 01 hesap vekil adına, borçlu kurgu yılmazın tc no 44444444440, borçlu hayali yılmazın adresi Masal Mah. Kurgu Sok. No:3 Bornova/İzmir, kesinleşme tarihi 01.11.2026, vekalet ücretine faiz başlangıcı 15.10.2026, 1.250 TL protesto masrafı ekle");
  ok(al.alanlar?.icraDairesi === "İzmir 5. İcra Dairesi", "icra dairesi: " + al.alanlar?.icraDairesi);
  ok(al.alanlar?.iban === "TR12 0006 4000 0011 2345 6789 01" && al.alanlar?.hesapSahibi === "vekil", "IBAN ve hesap sahibi: " + al.alanlar?.iban);
  ok(al.alanlar?.ilam?.kesinlesme === "2026-11-01", "kesinleşme tarihi");
  ok(JSON.stringify(al.alanlar?.faizBaslangic) === JSON.stringify([{ kalem: "Vekâlet ücreti", tarih: "2026-10-15" }]), "kaleme özel faiz başlangıcı: " + JSON.stringify(al.alanlar?.faizBaslangic));
  ok(JSON.stringify(al.alanlar?.masraflar) === JSON.stringify([{ ad: "Protesto masrafı", tutar: 1250 }]), "masraf: " + JSON.stringify(al.alanlar?.masraflar));
  ok(!al.kalemler.length && !al.borclular.length, "tarih, IBAN, kimlik no tutar ya da yeni borçlu sanılmaz: " + JSON.stringify([al.kalemler, al.borclular]));
  ok(al.alanlar?.kisiBilgi?.length === 2, "iki kişi bilgisi: " + JSON.stringify(al.alanlar?.kisiBilgi));
  const fK: Foy = { ...bosFoy({ tur: "icra", taraf: "davaci" }), muvekkil: "Ayşe Örnek", karsiTaraf: "Hayali Yılmaz", ekKarsiTaraflar: [{ ad: "Kurgu Yılmaz" }],
    icra: { yol: "ilamli", ekBorclular: [{ ad: "Kurgu Yılmaz" }], kalemler: [{ ad: "Vekâlet ücreti", tutar: 10000, faizTuru: "yasal" }, { ad: "Yargılama gideri", tutar: 2538, faizTuru: "yasal" }] } };
  const uK = talimatUygula(fK, al, {});
  const gK = { ...fK, ...uK.ek } as Foy;
  ok(gK.mahkeme === "İzmir 5. İcra Dairesi" && gK.icra?.hesap?.iban?.startsWith("TR12") && gK.icra?.hesap?.sahibi === "vekil", "icra dairesi ve hesap kutulara");
  ok(gK.icra?.ekBorclular?.[0].kimlikNo === "44444444440" && gK.ekKarsiTaraflar?.[0].kimlikNo === "44444444440", "ikinci borçlunun kimlik no'su (takipte ve künyede)");
  ok(gK.karsiBilgi?.adres === "Masal Mah. Kurgu Sok. No:3 Bornova/İzmir", "birinci borçlunun adresi: " + gK.karsiBilgi?.adres);
  ok(gK.icra?.ilam?.kesinlesme === "2026-11-01" && gK.icra?.kalemler?.[0].faizBaslangic === "2026-10-15" && !gK.icra?.kalemler?.[1].faizBaslangic, "kesinleşme ve yalnız vekâlet ücretinin faiz başlangıcı");
  ok(gK.icra?.masraflar?.[0]?.tutar === 1250 && gK.icra?.ekBorclular?.length === 1, "masraf; yeni borçlu eklenmedi");
  const u3 = talimatUygula(gK, talimatOku("yargılama gideri kalemini sil, bütün kalemlere avans faizi uygula, not: kısmi ödeme yapıldı"), {});
  ok(u3.ek.icra?.kalemler?.length === 1 && u3.ek.icra.kalemler[0].faizTuru === "avans" && u3.ek.icra.not === "kısmi ödeme yapıldı", "kalem silme, faiz türü, not: " + JSON.stringify(u3.ek.icra?.kalemler));
  const u4 = talimatUygula(fK, talimatOku("alacaklının adresi Örnek Mah. Deneme Cad. No:1 Karşıyaka/İzmir"), {});
  ok(u4.ek.muvekkilBilgi?.adres === "Örnek Mah. Deneme Cad. No:1 Karşıyaka/İzmir", "alacaklının adresi");
}
// Gider kalemlerinde faiz: hüküm "dava tarihinden itibaren yasal faiz" diyorsa başlıktaki dava tarihi; demiyorsa karar tarihi.
{
  const ilamF = evrak.replace("KARAR TARİHİ : 15/10/2026", "DAVA TARİHİ : 05/03/2023\nKARAR TARİHİ : 15/10/2026")
    .replace("10.000,00 TL vekalet ücretinin davalılardan", "10.000,00 TL vekalet ücretinin dava tarihinden itibaren işleyecek yasal faiziyle birlikte davalılardan");
  const hf = hukumKalemleri(ilamF);
  ok(hf.find(k => k.ad === "Vekâlet ücreti")?.faizBaslangic === "2023-03-05", "vekâlet ücretine dava tarihinden faiz: " + hf.find(k => k.ad === "Vekâlet ücreti")?.faizBaslangic);
  ok(hf.find(k => k.ad === "Yargılama gideri")?.faizBaslangic === "2026-10-15", "faiz yazılmayan giderde karar tarihi");
  ok(hf.find(k => k.ad === "Maddi tazminat")?.faizBaslangic === "2022-02-01", "asıl alacakta hükümdeki tarih");
}
// Talimatsız ilam: hiçbir şey ayrılmaz.
ok(talimatAyir(evrak).talimat === "", "talimatsız ilamda talimat yok");
// Dilekçe ilam sayılmaz.
ok(evrakTuruBul("İZMİR 3. ASLİYE HUKUK MAHKEMESİ'NE\nESAS NO: 2023/512\nDAVACI: X\nAÇIKLAMALAR: Mahkemenizin ilamı ile karar verildi... KARAR NO 2025/1\nSONUÇ VE İSTEM: arz ve talep ederiz.\nDavacı Vekili Av. Örnek") !== "ilam", "dilekçe ilam değil");
if (fail) { console.log(`icra-talimat-test: ${fail} hata`); process.exit(1); }
console.log("icra-talimat-test: tamam");
