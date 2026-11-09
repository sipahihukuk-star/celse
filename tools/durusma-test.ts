// Duruşma akışı, hesap ve talepler: uydurma (sentetik) evrakla.
import { bosFoy } from "../src/data/foy";
import { durusmaEkle, durusmaOzeti, durusmaUyarilari, evrakDurusmaOku, evraktanDurusma, kunyeDurusmasi, yerDegisti, banaAit } from "../src/data/durusma";
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

if (fail) { console.log(`durusma-test: ${fail} hata`); process.exit(1); } else console.log("durusma-test: tamam");
