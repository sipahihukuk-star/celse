// Kendiliğinden açılan işler: e-duruşma ve eksik künye (uydurma verilerle).
import { bosFoy } from "../src/data/foy";
import { eDurumYaz, eKarar, kunyeEksikleri, otoIsleriEsitle } from "../src/data/otoIs";
import { arsivdenSil, arsivListesi, sinirGunu, suresiDolanlar } from "../src/data/isArsivi";
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const B = "2026-11-11";
const f = bosFoy({ tur: "hukuk", muvekkil: "Deneme", karsiTaraf: "Örnek A.Ş.", mahkeme: "İzmir 3. Asliye Hukuk", esasNo: "2025/311",
  durusmalar: [{ id: "d1", tarih: "2026-12-12T10:30" }, { id: "d0", tarih: "2026-10-01" }] as never,
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
ok(!(otoIsleriEsitle({ ...f, tur: "ceza", gorevler: [] }, B) || []).some(x => x.id.startsWith("oto-e-")), "ceza davasında e-duruşma işi yok");
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
if (fail) { console.log(`oto-is-test: ${fail} hata`); process.exit(1); }
console.log("oto-is-test: tamam");
