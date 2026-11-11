// Kendiliğinden açılan işler: e-duruşma ve eksik künye (uydurma verilerle).
import { bosFoy } from "../src/data/foy";
import { eKarar, kunyeEksikleri, otoIsleriEsitle } from "../src/data/otoIs";
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

if (fail) { console.log(`oto-is-test: ${fail} hata`); process.exit(1); }
console.log("oto-is-test: tamam");
