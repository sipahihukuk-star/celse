// Duruşma akışı, hesap ve talepler: uydurma (sentetik) evrakla.
import { bosFoy } from "../src/data/foy";
import { eDurusmaTalebi } from "../src/data/beyan";
import { otoIsleriEsitle } from "../src/data/otoIs";
import { asamalar, eAdi, eTuru, mahkemeKisa, durusmaDuzeni, eSorulur, durusmaEkle, durusmaOzeti, durusmaUyarilari, evrakDurusmaOku, evraktanDurusma, kunyeDurusmasi, yerDegisti, banaAit, takvim } from "../src/data/durusma";
import { hesapOzeti, makbuzOku, standartGiderler, talepOku, tevkilOku, tutarCoz, ucretSozlesmesiOku } from "../src/data/hesap";
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const simdi = new Date("2026-11-09T09:00:00");
const ev = (id: string, metin: string, tarih?: string) => ({ id, ad: id, boyut: 1, eklenme: "2026-11-01T00:00:00Z", metin, tarih });

// 1) Tutanak: o günkü duruşma, bizim vekil geldi, sonraki duruşma günü.
const tutanak = `T.C.
İZMİR 3. ASLİYE HUKUK MAHKEMESİ
ESAS NO : 2026/321
DURUŞMA TUTANAĞI
DURUŞMA TARİHİ : 15/10/2026
Belli günde açık duruşmaya başlandı. Davacı vekili Av. Deneme Avukat geldi. Davalı vekili gelmedi.
Duruşmanın 18/12/2026 günü saat 10:30'a bırakılmasına karar verildi.`;
const b1 = evrakDurusmaOku(tutanak, "davaci", simdi);
ok(b1.oturum?.tarih === "2026-10-15" && b1.oturum?.girildi === "evet", "tutanak: 15.10 girildi " + JSON.stringify(b1.oturum));
ok(b1.tarihler.includes("2026-12-18T10:30"), "tutanak: sonraki duruşma 18.12 10:30 " + JSON.stringify(b1.tarihler));
const b1b = evrakDurusmaOku(tutanak, "davali", simdi);
ok(b1b.oturum?.girildi === "hayir", "davalı vekiliysek girilmedi");

// 2) E-duruşma talep dilekçesi, sonra kabul ekranı (fotoğraftan okunmuş metin), sonra red.
const talep = `İZMİR 3. ASLİYE HUKUK MAHKEMESİ'NE\nDOSYA NO: 2026/321 E.\n18.12.2026 tarihli duruşmaya e-duruşma yoluyla katılmak istiyoruz; e-duruşma talebimizin kabulünü arz ederiz.\nTarih: 20.11.2026`;
const kabulFoto = `UYAP Avukat Portal\nE-Duruşma Talebiniz Onaylanmıştır\nDosya: 2026/321 Duruşma Tarihi: 18.12.2026 10:30`;
const redKarar = `ARA KARAR\nDavacı vekilinin e-duruşma talebinin reddine,\nDuruşmanın 18/12/2026 günü saat 10:30'a bırakılmasına`;
ok(evrakDurusmaOku(talep, "davaci", simdi).e?.durum === "talep", "talep dilekçesi");
ok(evrakDurusmaOku(kabulFoto, "davaci", simdi).e?.durum === "kabul", "onay ekranı: kabul");
ok(evrakDurusmaOku(redKarar, "davaci", simdi).e?.durum === "red", "ara karar: red");

let f = bosFoy({ mahkeme: "İzmir 3. Asliye Hukuk Mahkemesi", esasNo: "2026/321", taraf: "davaci" });
let r = evraktanDurusma(f, [ev("t1", tutanak, "2026-10-15"), ev("d1", talep, "2026-11-20")], simdi);
f = { ...f, durusmalar: r.durusmalar };
const d1812 = f.durusmalar!.find(x => x.tarih.startsWith("2026-12-18"));
ok(f.durusmalar!.length === 2, "iki duruşma: " + f.durusmalar!.map(x => x.tarih).join(","));
ok(d1812?.e === "talep" && d1812?.eTalep === "2026-11-20", "18.12 e-duruşma talep edildi " + JSON.stringify(d1812));
r = evraktanDurusma(f, [ev("k1", kabulFoto, "2026-11-25")], simdi);
f = { ...f, durusmalar: r.durusmalar };
ok(f.durusmalar!.find(x => x.tarih.startsWith("2026-12-18"))?.e === "kabul", "kabul işlendi");
// Kabulden sonra gelen talep dilekçesi geri götürmez.
r = evraktanDurusma(f, [ev("d2", talep, "2026-11-26")], simdi);
ok(r.durusmalar.find(x => x.tarih.startsWith("2026-12-18"))?.e === "kabul", "kabul geri gitmez");

// 3) Uyarılar.
const g = bosFoy({ durusmalar: [
  { id: "a", tarih: "2026-10-20" },                      // geçmiş, işaretsiz → girildi uyarısı
  { id: "b", tarih: "2026-11-20" },                      // 11 gün sonra, e sorulmadı → son gün 13.11
  { id: "c", tarih: "2026-11-12", e: "talep" }           // karar bekleniyor
] });
const u = durusmaUyarilari(g, "2026-11-09");
ok(u.some(x => x.tur === "girildi" && x.d?.id === "a" && x.duzey === "gecikti"), "girildi uyarısı");
ok(u.some(x => x.tur === "eSor" && x.d?.id === "b" && x.sonGun === "2026-11-13" && x.duzey === "uyari"), "e-duruşma sorusu son gün 13.11 " + JSON.stringify(u.map(x => [x.tur, x.sonGun, x.duzey])));
ok(u.some(x => x.tur === "eKarar" && x.d?.id === "c"), "karar bekleniyor");
ok(!durusmaOzeti(g, "2026-11-09").iyi, "özet: sorun var");
const temiz = bosFoy({ durusmalar: [{ id: "a", tarih: "2026-10-20", girildi: "evet" }, { id: "b", tarih: "2026-12-20", e: "kabul" }] });
ok(durusmaOzeti(temiz, "2026-11-09").iyi && durusmaOzeti(temiz, "2026-11-09").metin.includes("✓"), "özet: her şey işlendi");
ok(durusmaUyarilari(bosFoy({ durum: "kapali", durusmalar: [{ id: "x", tarih: "2026-11-01" }] }), "2026-11-09").length === 0, "kapalı föy uyarmaz");
ok(durusmaUyarilari(bosFoy({ durusmalar: [{ id: "x", tarih: "2025-01-01" }] }), "2026-11-09").length === 0, "çok eski duruşma uyarmaz");
const sonrakiYok = durusmaUyarilari(bosFoy({ durusmalar: [{ id: "x", tarih: "2026-11-01", girildi: "evet" }] }), "2026-11-09");
ok(sonrakiYok.some(x => x.tur === "sonraki"), "sonraki duruşma günü yazılmadı");

// 4) Künyedeki gün akışa girer; aynı güne ikinci kayıt açılmaz.
const k = bosFoy({ durusma: "2026-12-01T09:30" });
const kx = kunyeDurusmasi(k)!;
ok(kx.length === 1 && kunyeDurusmasi({ ...k, durusmalar: kx }) === null, "künye duruşması bir kez");
ok(durusmaEkle({ ...k, durusmalar: kx }, "2026-12-01").length === 1, "aynı gün tek kayıt");

// 5) Esas no / mahkeme değişimi.
ok(yerDegisti({ id: "1", tarih: "x", esasNo: "2025/10", mahkeme: "İzmir 3. Asliye Hukuk" }, { id: "2", tarih: "y", esasNo: "2026/55", mahkeme: "İzmir 2. Asliye Ticaret" }) === "İzmir 2. Asliye Ticaret · 2026/55", "yer değişti");
ok(yerDegisti({ id: "1", tarih: "x", esasNo: "2025/10" }, { id: "2", tarih: "y", esasNo: "2025/10 E." }) === null, "aynı numara");

// 6) Bildirim kime: yönetici her föy, çalışan yalnız sorumlu olduğu.
const sf = bosFoy({ sorumlu: { id: "u2", ad: "Katip" } });
ok(banaAit(sf, { uid: "u1", yonetici: true }) && banaAit(sf, { uid: "u2", yonetici: false }) && !banaAit(sf, { uid: "u3", yonetici: false }) && banaAit(sf, null), "bildirim alıcıları");

// 7) Hesap.
ok(tutarCoz("12.500,50 TL") === 12500.5 && tutarCoz("12500") === 12500 && tutarCoz("1.250") === 1250, "tutar çözme");
ok(ucretSozlesmesiOku("AVUKATLIK ÜCRET SÖZLEŞMESİ\nMadde 3: Avukatlık ücreti olarak 75.000,00 TL kararlaştırılmıştır.").tutar === 75000, "ücret sözleşmesi");
const mk = makbuzOku("HARÇ TAHSİL MAKBUZU\nPeşin harç 615,40 TL\nGENEL TOPLAM : 1.230,80 TL");
ok(mk?.kategori === "Başvuru / peşin harç" && mk?.tutar === 1230.8, "harç makbuzu " + JSON.stringify(mk));
ok(makbuzOku("GİDER AVANSI TAHSİL MAKBUZU\nTOPLAM 2.000,00")?.kategori === "Gider avansı", "gider avansı");
const tv = tevkilOku("YETKİ BELGESİ\nİzmir Barosu avukatlarından Av. Örnek Meslektaş (Sicil No: 12345, Tel: 0532 111 22 33) 2026/321 esas sayılı dosyada duruşmaya girmek üzere yetki verilmiştir.\nAv. Deneme Avukat", ["Av. Deneme Avukat"]);
ok(tv.length === 1 && tv[0].ad === "Av. Örnek Meslektaş" && tv[0].sicil === "12345" && tv[0].baro === "İzmir", "tevkil yetki belgesi " + JSON.stringify(tv));
ok(tevkilOku("Davacı vekili Av. Örnek İkinci yetki belgesi ile geldi.").length === 1, "tutanakta tevkil");
ok(tevkilOku("Davacı vekili Av. Deneme Avukat geldi.").length === 0, "tevkil yok");
const tl = talepOku("İhtiyati tedbir talebinin kabulüne, adli yardım talebinin reddine karar verildi.");
ok(tl.some(x => x.tur === "ihtiyati_tedbir" && x.durum === "kabul") && tl.some(x => x.tur === "adli_yardim" && x.durum === "red"), "talep kararları " + JSON.stringify(tl));
ok(talepOku("Alacağımızın güvence altına alınması için ihtiyati haciz kararı verilmesini arz ve talep ederiz.")[0]?.durum === "talep", "ihtiyati haciz talebi");
const hf = bosFoy({ durusmalar: [{ id: "a", tarih: "2026-10-01", girildi: "evet" }, { id: "b", tarih: "2026-10-20", girildi: "evet", e: "kabul" }, { id: "c", tarih: "2026-11-01", girildi: "hayir" }],
  evraklar: [{ ...ev("x", "a"), tur: "Dilekçe" }, { ...ev("y", "b"), tur: "Cevap dilekçesi" }] });
const sg = standartGiderler(hf, { yol: 400, kirtasiyeDilekce: 50, kirtasiyeDosya: 100 }, "2026-11-09");
ok(sg.filter(x => x.kategori === "Yol gideri").length === 1 && sg.find(x => x.aciklama?.startsWith("Dilekçe"))?.tutar === 100 && sg.some(x => x.aciklama === "Dosya kırtasiyesi"), "yol ve kırtasiye " + JSON.stringify(sg.map(x => [x.kategori, x.tutar, x.aciklama])));
const hf2 = { ...hf, hesap: { kalemler: sg } };
ok(standartGiderler(hf2, { yol: 400, kirtasiyeDilekce: 50, kirtasiyeDosya: 100 }, "2026-11-09").length === 0, "ikinci kez yazılmaz");
const oz = hesapOzeti({ ...hf2, hesap: { ucret: { tutar: 50000 }, kalemler: [...sg, { id: "t", tarih: "2026-11-01", tutar: 20000, tur: "tahsilat" }] } });
ok(oz.kalanUcret === 30000 && oz.masraf === 600, "hesap özeti " + JSON.stringify(oz));

// Keşif: evraktan keşif günü ayrı okunur, duruşma sayılmaz; e-duruşma sorulmaz; takvimde ikisi birlikte.
const ara = "ARA KARAR\nDosyanın bilirkişi ile birlikte mahallinde keşif yapılmak üzere keşfin 25/11/2026 günü saat 10:00'da yapılmasına, duruşmanın 15/12/2026 günü saat 09:30'a bırakılmasına karar verildi.";
const kb = evrakDurusmaOku(ara, "davaci", simdi);
ok(kb.kesifler?.[0] === "2026-11-25T10:00" && kb.tarihler.length === 1 && kb.tarihler[0] === "2026-12-15T09:30", "keşif ayrı okunur " + JSON.stringify(kb));
const kf = bosFoy({ tur: "hukuk", mahkeme: "Uydurma 1. Asliye Hukuk Mahkemesi", esasNo: "2026/5" });
const kr = evraktanDurusma(kf, [ev("k1", ara, "2026-11-05")], simdi);
const kesifD = kr.durusmalar.find(x => x.tur === "kesif");
ok(!!kesifD && kr.durusmalar.length === 2 && kr.degisen.includes("keşif günü"), "keşif akışa girer " + JSON.stringify(kr));
const ku = durusmaUyarilari({ ...kf, durusmalar: kr.durusmalar }, "2026-11-20");
ok(!ku.some(x => x.d?.id === kesifD?.id && x.tur.startsWith("e")) && ku.some(x => x.tur === "eSor" && x.d?.tur !== "kesif"), "keşifte e-duruşma sorulmaz " + JSON.stringify(ku.map(x => [x.tur, x.d?.tur])));
ok(durusmaUyarilari({ ...kf, durusmalar: kr.durusmalar }, "2026-11-25").some(x => /keşif/i.test(x.metin)), "bugün keşif uyarısı");
ok(durusmaEkle({ ...kf, durusmalar: kr.durusmalar }, "2026-11-25", {}).length === 3, "aynı gün duruşma ayrı kayıt");
const tk = takvim([{ ...kf, durusmalar: kr.durusmalar }, { ...bosFoy({}), ozel: true, durusmalar: [{ id: "z", tarih: "2026-11-26" }] }], "2026-11-01", "2026-12-31", "2026-11-09");
ok(tk.length === 2 && tk[0].tur === "kesif" && tk[1].tur === "durusma", "takvim " + JSON.stringify(tk.map(x => [x.gun, x.tur])));

// İcra: duruşma yok; haciz ve keşif günü. Evraktan haciz günü okunur, duruşma cümlesi icrada eklenmez, e-duruşma sorulmaz.
const icf = bosFoy({ tur: "icra", mahkeme: "Uydurma 4. İcra Dairesi", esasNo: "2026/90", durusma: "2026-11-20" });
ok(kunyeDurusmasi(icf)?.[0]?.tur === "haciz", "icrada künyedeki gün haciz olur");
const hm = "Alacaklı vekilinin talebi üzerine borçlunun adresinde haczin 27/11/2026 günü saat 09:30'da yapılmasına, kıymet takdiri için keşfin 04/12/2026 günü yapılmasına karar verildi.";
const hb = evrakDurusmaOku(hm, "davaci", simdi);
ok(hb.hacizler?.[0] === "2026-11-27T09:30" && hb.kesifler?.[0] === "2026-12-04" && !hb.tarihler.length, "haciz ve keşif okunur " + JSON.stringify(hb));
const hr = evraktanDurusma(icf, [ev("h1", hm, "2026-11-08")], simdi);
ok(hr.durusmalar.filter(x => x.tur === "haciz").length === 1 && hr.durusmalar.some(x => x.tur === "kesif") && hr.degisen.includes("haciz günü"), "akışa haciz " + JSON.stringify(hr.durusmalar));
const hu = durusmaUyarilari({ ...icf, durusmalar: hr.durusmalar }, "2026-11-27");
ok(hu.some(x => /Bugün haciz/.test(x.metin)) && !hu.some(x => x.tur.startsWith("e")), "haciz uyarısı, e-duruşma yok " + JSON.stringify(hu.map(x => x.metin)));
ok(durusmaUyarilari({ ...icf, durusmalar: hr.durusmalar }, "2026-11-30").some(x => /Hacze gidildi mi/.test(x.metin)), "hacze gidildi mi");

// E-duruşma yalnız hukukta; idare mahkemesinde duruşma talepli
{
  ok(eSorulur(bosFoy({ tur: "hukuk" })) && eSorulur(bosFoy({ tur: "ceza" })) && !eSorulur(bosFoy({ tur: "idari_dava" })), "e-duruşma hukukta, SEGBİS cezada; idari davada sorulmaz");
  ok(eTuru(bosFoy({ tur: "ceza", mahkeme: "Uydurma 2. Asliye Ceza Mahkemesi" })) === "segbis" && eTuru(bosFoy({ tur: "ceza", mahkeme: "Uydurma 1. İcra Ceza Mahkemesi" })) === "e" && eAdi(bosFoy({ tur: "ceza" })) === "SEGBİS", "ceza: SEGBİS; icra ceza mahkemesi: e-duruşma");
  ok(durusmaDuzeni({ tur: "hukuk" }) === "olagan" && durusmaDuzeni({ tur: "ceza" }) === "olagan" && durusmaDuzeni({ tur: "idari_dava" }) === "talepli" && durusmaDuzeni({ tur: "tazminat_komisyonu" }) === "talepli" && durusmaDuzeni({ tur: "danisma" }) === "yok", "duruşma düzeni");
  const idari = bosFoy({ tur: "idari_dava", durusmalar: [{ id: "i1", tarih: "2026-10-01", girildi: "evet" }] });
  ok(!durusmaUyarilari(idari, "2026-11-09").some(u => u.tur === "sonraki" || u.tur === "eSor"), "idari: sonraki duruşma ve e-duruşma sorulmaz");
  const h = (eTalep: string, bugun: string) => durusmaUyarilari(bosFoy({ tur: "hukuk", durusmalar: [{ id: "h1", tarih: "2026-12-10T10:00", e: "talep", eTalep }] }), bugun).find(u => u.tur === "eKarar");
  ok(!h("2026-11-09", "2026-11-10"), "talepten hemen sonra uyarmaz");
  ok(!h("2026-11-09", "2026-11-11"), "uzak duruşmada henüz uyarmaz");
  const u2 = h("2026-11-09", "2026-11-26");
  ok(!!u2 && u2.bas === "2026-11-26" && /karar verilmedi/.test(u2.metin), "talepten 2 gün sonra değil, duruşmadan 14 gün önce başlar (uzak duruşma): " + JSON.stringify(u2 && { bas: u2.bas, m: u2.metin }));
  const u3 = h("2026-12-01", "2026-12-03");
  ok(!!u3 && u3.bas === "2026-12-03", "yakın duruşmada talepten 2 gün sonra başlar");
  const u4 = h("2026-12-01", "2026-12-09");
  ok(!!u4 && /1 gün var, e-duruşma kararı yok/.test(u4.metin) && (u4.duzey === "gecikti" || u4.duzey === "bugun"), "duruşmaya 1 gün kala acil: " + JSON.stringify(u4 && { m: u4.metin, d: u4.duzey }));
  const u5 = h("2026-12-01", "2026-12-10");
  ok(!!u5 && /Bugün duruşma: e-duruşma kararı yok/.test(u5.metin), "duruşma günü");
  const kabul = durusmaUyarilari(bosFoy({ tur: "hukuk", durusmalar: [{ id: "h1", tarih: "2026-12-10", e: "kabul", eTalep: "2026-12-01", eKarar: "2026-12-04" }] }), "2026-12-09");
  ok(!kabul.some(u => u.tur === "eKarar" || u.tur === "eRed"), "kabulde uyarı yok");
  const red = durusmaUyarilari(bosFoy({ tur: "hukuk", durusmalar: [{ id: "h1", tarih: "2026-12-10", e: "red" }] }), "2026-12-09");
  ok(red.some(u => u.tur === "eRed"), "redde bizzat girilecek uyarısı");
  const b = eDurusmaTalebi("2026-12-10T10:30");
  ok(b.tur === "E-duruşma talebi" && /10\.12\.2026 saat 10:30/.test(b.metin) && /HMK m\. 149/.test(b.metin) && /SONUÇ VE İSTEM/.test(b.metin), "e-duruşma talep dilekçesi");
}

// ── Yargılama aşamaları, mahkeme kısaltması, celse numarası, SEGBİS (uydurma künyeler) ──
{
  ok(mahkemeKisa("İzmir 3. Asliye Hukuk Mahkemesi") === "İzmir 3. AHM", "kısaltma AHM: " + mahkemeKisa("İzmir 3. Asliye Hukuk Mahkemesi"));
  ok(mahkemeKisa("İZMİR BÖLGE ADLİYE MAHKEMESİ 20. HUKUK DAİRESİ") === "İzmir BAM 20. HD", "kısaltma BAM HD: " + mahkemeKisa("İZMİR BÖLGE ADLİYE MAHKEMESİ 20. HUKUK DAİRESİ"));
  ok(mahkemeKisa("Uydurma 2. Ağır Ceza Mahkemesi") === "Uydurma 2. AğCM" && mahkemeKisa("Uydurma 1. İş Mahkemesi") === "Uydurma 1. İş M.", "kısaltma AğCM, İş M.");
  ok(mahkemeKisa("Uydurma 4. Asliye Hukuk Mahkemesi (Tüketici Mahkemesi Sıfatıyla)") === "Uydurma 4. AHM", "sıfatıyla parantezi atılır");
  // Görevsizlikle başka mahkemeye geçmiş dosya: eski aşama solda, şimdiki sağda.
  const fa = bosFoy({ tur: "hukuk", mahkeme: "Uydurma 2. Asliye Ticaret Mahkemesi", esasNo: "2026/40", durusmalar: [
    { id: "a1", tarih: "2025-03-10", mahkeme: "Uydurma 5. Asliye Hukuk Mahkemesi", esasNo: "2024/900" },
    { id: "a2", tarih: "2025-06-12", mahkeme: "Uydurma 5. Asliye Hukuk Mahkemesi", esasNo: "2024/900" },
    { id: "b1", tarih: "2026-02-01", celse: 3 },
    { id: "b2", tarih: "2026-05-05" },
    { id: "b3", tarih: "2026-09-09", tur: "kesif" }
  ] });
  const as = asamalar(fa);
  ok(as.length === 2 && as[0].kisa === "Uydurma 5. AHM" && as[1].guncel && as[1].kisa === "Uydurma 2. ATM", "iki aşama, eski solda: " + as.map(a => a.kisa + " " + a.esasNo).join(" | "));
  ok(JSON.stringify(as[1].eksik) === "[1,2]" && as[1].gunler.map(g => (g.d ? g.d.id : "?") + ":" + (g.celse || "")).join(",") === "?:1,?:2,b1:3,b2:4,b3:", "3. celseden önceki iki celse ? ve sonraki 4.: " + as[1].gunler.map(g => (g.d ? g.d.id : "?") + ":" + (g.celse || "")).join(","));
  ok(!as[0].eksik.length, "celse no bilinmeyen aşamada ? yok");
  const g = otoIsleriEsitle(fa, "2026-11-14") || [];
  const ci = g.find(x => x.id.startsWith("oto-celse-"));
  ok(!!ci && /1, 2\. celse/.test(ci.metin) && /Uydurma 2\. ATM 2026\/40/.test(ci.metin), "eksik celse işi: " + ci?.metin);
  const fb = { ...fa, gorevler: g, durusmalar: [...fa.durusmalar!, { id: "c1", tarih: "2025-10-01", celse: 1 }, { id: "c2", tarih: "2025-12-01", celse: 2 }] };
  const g2 = otoIsleriEsitle(fb, "2026-11-14") || fb.gorevler;
  ok(asamalar(fb)[1].eksik.length === 0 && g2.find(x => x.id === ci?.id)?.bitti === true, "günler yazılınca ? kalkar, iş kapanır");
  // Tutanaktan celse numarası ve eski aşamanın evraktan bulunması.
  const tut = "T.C.\nUYDURMA 2. ASLİYE TİCARET MAHKEMESİ\nESAS NO : 2026/40\nDURUŞMA TUTANAĞI\n5. CELSE\nDuruşma tarihi: 05.05.2026\nDavacı vekili Av. Kurgu geldi.\nDuruşmanın 09/12/2026 günü saat 10:00'a bırakılmasına";
  const bt = evrakDurusmaOku(tut, "davaci", simdi);
  ok(bt.oturum?.celse === 5, "tutanaktan 5. celse: " + JSON.stringify(bt.oturum));
  const r5 = evraktanDurusma(fa, [ev("t5", tut, "2026-05-05")], simdi);
  ok(r5.durusmalar.find(x => x.id === "b2")?.celse === 5, "05.05 duruşması 5. celse oldu");
  const gor = "T.C.\nUYDURMA 7. SULH HUKUK MAHKEMESİ\nESAS NO : 2023/77\nKARAR NO : 2024/5\nGEREKÇELİ KARAR\nMahkememizin görevsizliğine karar verildi.\nKarar tarihi: 10.01.2024";
  const r6 = evraktanDurusma(fa, [ev("k6", gor, "2024-01-10")], simdi);
  const as6 = asamalar({ ...fa, yargilamalar: r6.yargilamalar });
  ok(!!r6.yargilamalar?.length && as6[0].kisa === "Uydurma 7. SHM" && as6[0].esasNo === "2023/77", "evraktan eski aşama sola eklendi: " + as6.map(a => a.kisa).join(" | "));
  ok(!evraktanDurusma({ ...fa, yargilamalar: r6.yargilamalar }, [ev("k7", gor, "2024-01-10")], simdi).yargilamalar, "aynı aşama ikinci kez eklenmez");
  const dil = "UYDURMA 2. ASLİYE TİCARET MAHKEMESİ'NE\nDOSYA NO: 2026/40 E.\nKONU: Duruşma günü hakkında beyanımızdır.";
  ok(!evraktanDurusma(fa, [ev("dl", dil, "2026-06-01")], simdi).yargilamalar, "kendi mahkemesine yazılan dilekçe yeni aşama açmaz");
  // SEGBİS: ceza davasında uyarı ve dilekçe SEGBİS adıyla.
  const fc = bosFoy({ tur: "ceza", mahkeme: "Uydurma 3. Asliye Ceza Mahkemesi", esasNo: "2026/12", durusmalar: [{ id: "s1", tarih: "2026-11-25T10:00" }] });
  const uc = durusmaUyarilari(fc, "2026-11-14");
  ok(uc.some(u => /^SEGBİS talep edilecek mi/.test(u.metin)), "ceza: SEGBİS sorusu: " + uc.map(u => u.metin).join(" | "));
  const gc = otoIsleriEsitle(fc, "2026-11-14") || [];
  ok(gc.some(x => /^SEGBİS talep et/.test(x.metin)), "ceza: SEGBİS işi");
  const bs = eDurusmaTalebi("2026-11-25T10:00", "segbis");
  ok(bs.tur === "SEGBİS talebi" && /SEGBİS/.test(bs.metin) && !/HMK/.test(bs.metin), "SEGBİS talep dilekçesi");
}
if (fail) { console.log(`durusma-test: ${fail} hata`); process.exit(1); } else console.log("durusma-test: tamam");
