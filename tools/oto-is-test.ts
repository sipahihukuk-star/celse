// Kendiliğinden açılan işler: e-duruşma ve eksik künye (uydurma verilerle).
import { bosFoy } from "../src/data/foy";
import { adaylariUygula, eDurumYaz, eKarar, evrakIsAdaylari, kunyeEksikleri, otoIsleriEsitle } from "../src/data/otoIs";
import { arsivdenSil, arsivListesi, sinirGunu, suresiDolanlar } from "../src/data/isArsivi";
import { araKararIsleri } from "../src/data/evrakIs";
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const B = "2026-11-11";
const f = bosFoy({ tur: "hukuk", muvekkil: "Deneme", karsiTaraf: "Örnek A.Ş.", mahkeme: "İzmir 3. Asliye Hukuk", esasNo: "2025/311",
  durusmalar: [{ id: "d1", tarih: "2026-12-12T10:30" }, { id: "d0", tarih: "2026-08-01" }] as never,
  gorevler: [{ id: "g1", metin: "Elle iş", bitti: false, kaynak: "elle" }] });
const g1 = otoIsleriEsitle(f, B)!;
ok(!!g1 && g1.length === 2 && g1[0].id === "g1", "elle iş korunur, bir e-duruşma işi eklenir: " + g1?.map(x => x.id));
const e = g1.find(x => x.id === "oto-e-d1")!;
ok(!!e && /E-duruşma talep et \(12\.12\.2026 10:30/.test(e.metin) && e.tarih === "2026-12-05" && !e.bitti, "iş metni ve son günü (7 gün önce): " + e?.tarih);
ok(!g1.some(x => x.id === "oto-e-d0"), "geçmiş duruşmaya iş açılmaz");
const f2 = { ...f, gorevler: g1 };
ok(otoIsleriEsitle(f2, B) === null, "ikinci kez değişiklik yok (kayıt döngüsü olmaz)");
// Elle kapatılsa da açılır
const kapali = { ...f2, gorevler: g1.map(x => x.id === "oto-e-d1" ? { ...x, bitti: true, kapanis: { tarih: B, no: "1", kaynak: "elle" as const } } : x) };
ok(otoIsleriEsitle(kapali, B)!.find(x => x.id === "oto-e-d1")!.bitti === false, "kabul/red olmadan kapatılan iş yeniden açılır");
// Kabul
const k = eKarar(f2, "d1", "kabul", B);
ok(k.durusmalar!.find(d => d.id === "d1")!.e === "kabul", "sol tık: kabul");
const ki = k.gorevler!.find(x => x.id === "oto-e-d1")!;
ok(ki.bitti && /kabul/.test(ki.kapanis!.no), "kabulde iş kapanır");
const k2 = eKarar({ ...f2, ...k }, "d1", "kabul", B);
ok(k2.durusmalar!.find(d => d.id === "d1")!.e === undefined && !k2.gorevler!.find(x => x.id === "oto-e-d1")!.bitti, "ikinci basış kararı kaldırır, iş yeniden açılır");
const r = eKarar(f2, "d1", "red", B);
ok(r.durusmalar!.find(d => d.id === "d1")!.e === "red" && r.gorevler!.find(x => x.id === "oto-e-d1")!.bitti, "sağ tık: red, iş kapanır");
// Talep edildi
const tal = otoIsleriEsitle({ ...f2, durusmalar: [{ id: "d1", tarih: "2026-12-12T10:30", e: "talep" }] as never }, B)!;
ok(/sonucunu işaretleyin/.test(tal.find(x => x.id === "oto-e-d1")!.metin) && !tal.find(x => x.id === "oto-e-d1")!.bitti, "talep edilince iş 'sonucunu işaretleyin' olur");
// Ceza ve icra dosyasında e-duruşma işi yok
ok((otoIsleriEsitle({ ...f, tur: "ceza", mahkeme: "Uydurma 1. Asliye Ceza Mahkemesi", gorevler: [] }, B) || []).filter(x => x.id.startsWith("oto-e-")).every(x => /^SEGBİS/.test(x.metin)), "ceza davasında e-duruşma yerine SEGBİS işi");
ok(!(otoIsleriEsitle({ ...f, tur: "idari_dava", gorevler: [] }, B) || []).some(x => x.id.startsWith("oto-e-")), "idari davada e-duruşma işi yok");
// Silinen duruşma: açık iş kalkar
ok(!otoIsleriEsitle({ ...f2, durusmalar: [] }, B)!.some(x => x.id === "oto-e-d1"), "duruşma silinince açık e işi kalkar");
// Kapalı föy
ok(!(otoIsleriEsitle({ ...f, durum: "kapali", gorevler: [] }, B) || []).length, "kapalı föyde iş açılmaz");

// Künye
const bos = bosFoy({ tur: "hukuk", muvekkil: "Deneme" });
ok(kunyeEksikleri(bos).join(",") === "karşı taraf,mahkeme,dosya no", "eksikler: " + kunyeEksikleri(bos));
ok(kunyeEksikleri(bosFoy({ tur: "icra" })).join(",") === "müvekkil,karşı taraf,icra dairesi,takip no", "icra eksikleri: " + kunyeEksikleri(bosFoy({ tur: "icra" })));
ok(kunyeEksikleri(bosFoy({ tur: "danisma", muvekkil: "X" })).length === 0, "danışmada mahkeme ve no aranmaz");
const kg = otoIsleriEsitle(bos, B)!;
const ki2 = kg.find(x => x.id === "oto-kunye")!;
ok(!!ki2 && ki2.metin === "Künyeyi tamamlayın: karşı taraf, mahkeme, dosya no yok", "künye işi: " + ki2?.metin);
const yarim = otoIsleriEsitle({ ...bos, gorevler: kg, mahkeme: "İzmir 1. Asliye Hukuk" }, B)!;
ok(yarim.find(x => x.id === "oto-kunye")!.metin === "Künyeyi tamamlayın: karşı taraf, dosya no yok", "doldukça iş güncellenir");
const tam = otoIsleriEsitle({ ...bos, gorevler: kg, mahkeme: "M", esasNo: "2026/1", karsiTaraf: "K" }, B)!;
ok(tam.find(x => x.id === "oto-kunye")!.bitti, "künye tamamlanınca iş kapanır");
ok(!(otoIsleriEsitle({ ...bos, silinen: ["oto-kunye"] }, B) || []).some(x => x.id === "oto-kunye"), "silinen künye işi geri gelmez");

// Duruşma günü geçince açık e-duruşma işi "süresi geçti" diye kapanır (arşive düşer).
{
  const gecti = otoIsleriEsitle({ ...f, gorevler: g1 }, "2026-12-13")!;
  const x = gecti.find(y => y.id === "oto-e-d1")!;
  ok(x.bitti && x.kapanis?.sureGecti === true, "duruşması geçen e işi süresi geçti: " + JSON.stringify(x));
  // Duruşmalar sekmesinden: talep edildi → iş "sonucunu işaretleyin" olur; istenmeyecek → iş kapanır; sorulmadı → yeniden açılır.
  const t1 = eDurumYaz({ ...f, gorevler: g1 }, "d1", "talep", B);
  ok(t1.durusmalar!.find(d => d.id === "d1")!.eTalep === B && /sonucunu/.test(t1.gorevler!.find(y => y.id === "oto-e-d1")!.metin), "talep edildi");
  const t2 = eDurumYaz({ ...f, ...t1 } as never, "d1", "istenmeyecek", B);
  ok(t2.gorevler!.find(y => y.id === "oto-e-d1")!.bitti, "istenmeyecek: iş kapanır");
  const t3 = eDurumYaz({ ...f, ...t2 } as never, "d1", undefined, B);
  ok(!t3.gorevler!.find(y => y.id === "oto-e-d1")!.bitti && !t3.durusmalar!.find(d => d.id === "d1")!.e, "sorulmadı: iş yeniden açılır");
  const t4 = eDurumYaz({ ...f, ...t1 } as never, "d1", "kabul", B);
  ok(t4.durusmalar!.find(d => d.id === "d1")!.eKarar === B && t4.gorevler!.find(y => y.id === "oto-e-d1")!.bitti, "kabul: karar günü ve iş kapanır");
}
// Arşiv: süresi geçmiş açık iş, süresi geçip kapanan iş ve tamamlanan iş; saklama süresi dolanlar silinir.
{
  const ff = bosFoy({ tur: "hukuk", muvekkil: "Deneme", gorevler: [
    { id: "a", metin: "Geç kalmış iş", tarih: "2026-11-01", bitti: false, kaynak: "elle" },
    { id: "b", metin: "Bitmiş iş", tarih: "2025-06-01", bitti: true, kaynak: "elle", kapanis: { tarih: "2025-06-02", no: "1", kaynak: "elle" } },
    { id: "c", metin: "E işi", bitti: true, kaynak: "oto", kapanis: { tarih: "2026-10-01", no: "Süresi geçti", kaynak: "elle", sureGecti: true } },
    { id: "d", metin: "Yarınki iş", tarih: "2026-11-12", bitti: false, kaynak: "elle" }] });
  const a = arsivListesi([ff], B);
  ok(a.map(x => x.g.id + ":" + x.tur).join(",") === "a:gecmis_acik,c:gecmis_kapandi,b:tamamlandi", "arşiv: " + a.map(x => x.g.id + ":" + x.tur).join(","));
  ok(sinirGunu(B, 12) === "2025-11-11" && sinirGunu(B, 1) === "2026-10-11", "saklama sınırı");
  const d = suresiDolanlar([ff], 12, B);
  ok(d.length === 1 && d[0].g.id === "b", "1 yılı geçen kayıt");
  ok(suresiDolanlar([ff], 1, B).map(x => x.g.id).join(",") === "c,b", "1 ayda dolanlar");
  const sil = arsivdenSil(d);
  ok(sil.length === 1 && sil[0].gorevler.length === 3 && !sil[0].gorevler.some(g => g.id === "b"), "silinir");
}
// Tutanak işi: günü geçmiş duruşmanın tutanağı yoksa gecikmiş iş; tutanak eklenince kapanır. Ara karardaki görevler iş olur.
{
  const tf = bosFoy({ tur: "hukuk", muvekkil: "Deneme", karsiTaraf: "Örnek A.Ş.", mahkeme: "Uydurma 3. Asliye Hukuk", esasNo: "2025/311", taraf: "davaci",
    durusmalar: [{ id: "p1", tarih: "2026-11-04T10:30" }, { id: "p2", tarih: "2026-11-20T10:30" }, { id: "p3", tarih: "2026-06-01" }] as never });
  const a = otoIsleriEsitle(tf, B)!;
  const t1 = a.find(x => x.id === "oto-t-p1");
  ok(!!t1 && !t1.bitti && t1.tarih === "2026-11-04" && /tutanağını tarayıp/.test(t1.metin), "geçmiş duruşmaya tutanak işi: " + JSON.stringify(t1));
  ok(!a.some(x => x.id === "oto-t-p2" || x.id === "oto-t-p3"), "ileri ve çok eski duruşmaya tutanak işi açılmaz");
  const tutanak = "T.C.\nUYDURMA 3. ASLİYE HUKUK MAHKEMESİ\nDURUŞMA TUTANAĞI\nESAS NO : 2025/311\nCELSE NO : 4\nDURUŞMA TARİHİ : 04/11/2026\nDavacı vekili Av. Örnek geldi. Davalı vekili gelmedi.\nGEREĞİ DÜŞÜNÜLDÜ: 1- Bilirkişi ücreti olan 3.000,00 TL'nin yatırılması için davacı vekiline 2 hafta kesin süre verilmesine, aksi halde bu delile dayanmaktan vazgeçmiş sayılacağının ihtarına, 2- Davalı vekiline tanık listesini sunması için 1 hafta süre verilmesine, 3- Taraf vekillerine bilirkişi raporuna karşı beyanda bulunmaları için tebliğden itibaren 2 hafta süre verilmesine, 4- Duruşmanın 20/11/2026 günü saat 10:30'a bırakılmasına karar verildi.\nKatip 12345 Hakim 54321";
  const tf2 = { ...tf, gorevler: a, evraklar: [{ id: "ev1", ad: "tutanak.udf", boyut: 1, eklenme: "2026-11-13T09:00:00Z", metin: tutanak }] } as never;
  const B2 = "2026-11-14";
  const b = otoIsleriEsitle(tf2, B2)!;
  ok(b.find(x => x.id === "oto-t-p1")?.bitti === true, "tutanak eklenince tutanak işi kapanır");
  ok(!b.some(x => x.id.startsWith("oto-ak-")), "ara karar işi kendiliğinden eklenmez (onay bekler)");
  const ak = evrakIsAdaylari({ ...(tf2 as object), gorevler: b } as never, B2);
  ok(ak.length === 2 && !ak[0].eski && /3\.000,00 TL/.test(ak[0].metin) && ak[0].tarih === "2026-11-18", "ara karar adayları: bizim tarafa iki iş: " + JSON.stringify(ak.map(x => [x.metin.slice(0, 60), x.tarih])));
  ok(ak[1].tarih === "2026-11-27", "tebliğden itibaren süre evrakın eklendiği günden: " + ak[1].tarih);
  const uy = adaylariUygula({ ...(tf2 as object), gorevler: b } as never, [ak[0]], [ak[1].id], B2);
  const f2b = { ...(tf2 as object), ...uy } as never;
  ok(uy.gorevler!.some(x => x.id === ak[0].id && x.onayli && x.kaynak === "evrak"), "onaylanan aday iş olur");
  ok(evrakIsAdaylari(f2b, B2).length === 0, "seçilmeyen aday bir daha sorulmaz");
  ok((otoIsleriEsitle(f2b, B2) || (f2b as { gorevler: { id: string }[] }).gorevler).some(x => x.id === ak[0].id), "onaylı iş kendiliğinden silinmez");
  // Eski tarihli tutanak (geçen yılın) bugün eklense de iş çıkmaz; daha önce çıkmış ve yapılmamış işi kaldırılır.
  const eski = tutanak.replace("04/11/2026", "03/01/2026");
  const tf3 = { ...tf, gorevler: [{ id: "oto-ak-ev9-0", metin: "Ara karar: eski", tarih: "2026-01-17", bitti: false, kaynak: "evrak", eklenme: "2026-11-13" }, { id: "oto-ak-ev9-1", metin: "Ara karar: yapılmış", bitti: true, kaynak: "evrak", eklenme: "2026-11-13" }], evraklar: [{ id: "ev9", ad: "eski.udf", boyut: 1, eklenme: "2026-11-13T08:00:00Z", metin: eski }] } as never;
  const d3 = otoIsleriEsitle(tf3, B2) || (tf3 as { gorevler: { id: string }[] }).gorevler;
  ok(!d3.some(x => x.id === "oto-ak-ev9-0") && d3.some(x => x.id === "oto-ak-ev9-1"), "eski tutanağın açık ara karar işi kalkar, yapılmış kayıt kalır: " + JSON.stringify(d3.map(x => x.id)));
  // Başlangıçtan önce eklenen evraktan iş çıkmaz.
  const tf4 = { ...tf, gorevler: [], evraklar: [{ id: "ev8", ad: "t.udf", boyut: 1, eklenme: "2026-11-12T08:00:00Z", metin: tutanak }] } as never;
  ok(evrakIsAdaylari(tf4, B2).length === 0, "başlangıçtan önce eklenen evrak yeni evrak adaylarında yok");
  ok(evrakIsAdaylari(tf4, B2, true).every(x => x.eski) && evrakIsAdaylari(tf4, B2, true).length === 2, "elle istenince eski evraktan da aday çıkar, eski işaretli");
  // Kurum yazısı: bize yöneltilen istek iş olur.
  const yazi = "T.C.\nSOSYAL GÜVENLİK KURUMU\nUYDURMA SOSYAL GÜVENLİK İL MÜDÜRLÜĞÜ\nSayı : E-12345678-000-999\nKonu : Hizmet dökümü talebi\nTarih: 12.11.2026\nSAYIN AV. ÖRNEK AVUKAT\nİlgi dilekçeniz incelenmiştir. Talebinizin karşılanabilmesi için vekâletnamenin onaylı örneğini yazımızın tebliğinden itibaren 15 gün içinde Kurumumuza göndermeniz rica olunur. Bilgilerinize sunulur.\nUydurma Müdür";
  const tf5 = { ...tf, gorevler: [], evraklar: [{ id: "ev7", ad: "sgk.pdf", boyut: 1, eklenme: "2026-11-13T08:00:00Z", metin: yazi }] } as never;
  const y5 = evrakIsAdaylari(tf5, B2);
  ok(y5.length === 1 && /^Yazı: .*göndermeniz/.test(y5[0].metin) && y5[0].tarih === "2026-11-28", "kurum yazısındaki istek iş olur: " + JSON.stringify(y5.map(x => [x.metin, x.tarih])));
}
// Avukatın dilekçesinde geçen "ara kararı gereğince" ara karar sayılmaz.
{

  const dil = "UYDURMA 7. TÜKETİCİ MAHKEMESİ'NE\nESAS NO: 2025/503\nKONU: Beyanlarımızın sunulmasıdır.\nAÇIKLAMALAR: Sayın Mahkemenizin 10/02/2026 tarihli celsesinde kurulan 5 numaralı ara kararı gereğince, süresi içinde beyanlarımızın sunulmasına ilişkin 2 hafta süre verilmiştir.\nSONUÇ VE İSTEM: Yukarıda arz edilen nedenlerle arz ve talep ederiz.\nDavacı Vekili Av. Örnek";
  ok(araKararIsleri(dil, "davaci", "2026-02-10").length === 0, "dilekçedeki ara karar anışı iş olmaz");
}
if (fail) { console.log(`oto-is-test: ${fail} hata`); process.exit(1); }
console.log("oto-is-test: tamam");
