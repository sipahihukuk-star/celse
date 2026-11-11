// UYAP duruşma listesi okuma ve föylerle eşleştirme (uydurma verilerle).
import { bosFoy } from "../src/data/foy";
import { eskiExcelTablo, eslestir, htmlTablo, listedenYeniFoy, listeyiIsle, metindenDurusmalar, tablodanDurusmalar, tekillestir } from "../src/data/durusmaListesi";
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };

// Excel tablosu: üstte başlık dışı satır, saat ayrı sütunda (Excel kesri), tarih Excel gün sayısı.
const tablo = tablodanDurusmalar([
  ["Avukat Duruşma Listesi"],
  ["Sıra", "Birim Adı", "Dosya No", "Duruşma Tarihi", "Saat", "Taraflar", "İşlem Türü"],
  [1, "İzmir 3. Asliye Hukuk Mahkemesi", "2025/0311 Esas", "12.12.2026", 0.4375, "Deneme Kişi - Örnek A.Ş.", "Duruşma"],
  [2, "İzmir 5. Ağır Ceza Mahkemesi", "2024/88", 46374, "14:00", "K.H. Kamu Davası", "Duruşma"],
  [3, "Karşıyaka 2. Sulh Hukuk Mahkemesi", "2026/12", "05/01/2027 09:15", "", "", "Keşif"],
  [4, "", "", "", "", "", ""]
])!;
ok(!!tablo && tablo.length === 3, "tablodan 3 duruşma okunur: " + tablo?.length);
ok(tablo[0].tarih === "2026-12-12T10:30" && tablo[0].esasNo === "2025/0311", "tarih + Excel saati: " + tablo[0].tarih);
ok(tablo[1].tarih.startsWith("2026-12-1") && tablo[1].tarih.endsWith("T14:00"), "Excel gün sayısı tarih: " + tablo[1].tarih);
ok(tablo[2].tur === "kesif" && tablo[2].tarih === "2027-01-05T09:15", "keşif ve aynı hücredeki saat: " + tablo[2].tarih);

// PDF / ekran görüntüsünden düz metin: kayıt tarihi saatsiz, duruşma günü saatli; birim bir üst satırda.
const metin = [
  "UYAP AVUKAT DURUŞMA LİSTESİ 11.11.2026",
  "1 İZMİR 3. ASLİYE HUKUK MAHKEMESİ 2025/311 01.03.2025 12/12/2026 10:30 Duruşma",
  "İZMİR 1. İDARE MAHKEMESİ",
  "2 2026/45 Esas 15.01.2027 saat 11.00 Duruşma",
  "3 BORNOVA 1. İCRA HUKUK MAHKEMESİ 2026/9",
  "20.01.2027 09:30 Duruşma"
].join("\n");
const m = metindenDurusmalar(metin);
ok(m.length === 3, "metinden 3 duruşma: " + m.length);
ok(m[0].tarih === "2026-12-12T10:30" && /İzmir 3\. Asliye Hukuk/i.test(m[0].mahkeme || ""), "saatli gün seçilir, açılış tarihi değil: " + m[0].tarih + " " + m[0].mahkeme);
ok(m[1].tarih === "2027-01-15T11:00" && /İdare/i.test(m[1].mahkeme || ""), "üst satırdaki birim: " + m[1].mahkeme + " " + m[1].tarih);
ok(m[2].tarih === "2027-01-20T09:30", "alt satıra taşan gün: " + m[2].tarih);

// Sekmeli (UYAP sayfasından kopyalanan) metin tablo gibi okunur.
const sekmeli = metindenDurusmalar("Birim\tDosya No\tDuruşma Tarihi\nİzmir 3. Asliye Hukuk Mahkemesi\t2025/311\t12.12.2026 10:30\n");
ok(sekmeli.length === 1 && sekmeli[0].tarih === "2026-12-12T10:30", "sekmeli metin");
ok(tekillestir([...m, m[0]]).length === 3, "aynı gün iki kez sayılmaz");

// Eşleştirme
const a = bosFoy({ muvekkil: "Deneme Kişi", mahkeme: "İzmir 3. Asliye Hukuk", esasNo: "2025/311 E." });
const b = bosFoy({ muvekkil: "Başka Kişi", mahkeme: "İzmir 4. Asliye Hukuk Mahkemesi", esasNo: "2025/311" });
const c = bosFoy({ muvekkil: "Üçüncü", mahkeme: "", esasNo: "2024/88" });
const d1 = bosFoy({ muvekkil: "Ali Veli", mahkeme: "İzmir 1. İdare Mahkemesi", esasNo: "2026/45", tur: "idari_dava" });
const d2 = bosFoy({ muvekkil: "Ayşe Kaya", mahkeme: "İzmir 1. İdare Mahkemesi", esasNo: "2026/45", tur: "idari_dava" });
const es = eslestir([tablo[0], tablo[1], tablo[2], m[1]], [a, b, c, d1, d2]);
ok(es[0].durum === "eslesti" && es[0].foy?.id === a.id, "aynı numara + aynı mahkeme: doğru föy (öteki mahkemedeki aynı numara değil)");
ok(es[1].durum === "eslesti" && es[1].foy?.id === c.id, "föyde mahkeme yazılı değilse numara yeter");
ok(es[2].durum === "yok", "numarası olmayan satır eşleşmez");
ok(es[3].durum === "secim" && es[3].adaylar.length === 2, "aynı mahkeme ve numarada iki föy: seçim");
const tek = eslestir([{ ...m[1], taraflar: "Ayşe Kaya - İzmir Valiliği" }], [d1, d2]);
ok(tek[0].durum === "eslesti" && tek[0].foy?.id === d2.id, "taraf adı tek föyü seçer");
const yanlis = eslestir([{ ...tablo[0], mahkeme: "Bornova 1. Asliye Ticaret Mahkemesi" }], [a]);
ok(yanlis[0].durum === "secim", "numara tutuyor, mahkeme farklı: kendiliğinden işlenmez");

// İşleme
const islenmis = listeyiIsle(a, [tablo[0]], "2026-11-11");
ok(islenmis.durusmalar?.length === 1 && islenmis.durusmalar[0].tarih === "2026-12-12T10:30" && islenmis.durusmalar[0].kaynak === "liste", "gün föyün duruşmalarına işlenir");
ok(islenmis.durusma === "2026-12-12T10:30", "ileri tarihli gün sonraki duruşma olur");
const ikinci = listeyiIsle(islenmis, [tablo[0]], "2026-11-11");
ok(ikinci.durusmalar?.length === 1, "aynı liste ikinci kez yüklenince gün çoğalmaz");
ok(eslestir([tablo[0]], [ikinci])[0].zatenVar, "zaten kayıtlı gün işaretlenir");
const saatsiz = listeyiIsle(bosFoy({ esasNo: "2025/311", durusmalar: [{ id: "x", tarih: "2026-12-12" }] as never }), [tablo[0]], "2026-11-11");
ok(saatsiz.durusmalar?.length === 1 && saatsiz.durusmalar[0].tarih === "2026-12-12T10:30", "saati eksik kayıt tamamlanır");
const icra = listeyiIsle(bosFoy({ tur: "icra", esasNo: "2026/9" }), [m[2]], "2026-11-11");
ok(icra.durusmalar?.[0].tur === "haciz", "icra dosyasında gün haciz günüdür");
const yeni = listedenYeniFoy({ ...m[1], taraflar: "A - B" });
ok(yeni.esasNo === "2026/45" && yeni.tur === "idari_dava" && yeni.durusmalar?.length === 1 && /A - B/.test(yeni.notlar), "yeni föy: tür, numara, gün, taraflar notta");

// UYAP "Excel'e aktar": .xls uzantılı HTML tablo
const html = `<html><body><table><tr><th>Birim Ad&#305;</th><th>Dosya No</th><th>Duru&#351;ma Tarihi</th></tr><tr><td>&#304;zmir 3. Asliye Hukuk Mahkemesi</td><td>2025/311</td><td>12.12.2026&nbsp;10:30</td></tr></table></body></html>`;
const ht = tablodanDurusmalar(eskiExcelTablo(new TextEncoder().encode(html)));
ok(!!ht && ht.length === 1 && ht[0].tarih === "2026-12-12T10:30" && /İzmir 3/.test(ht[0].mahkeme || ""), "HTML .xls tablosu okunur: " + JSON.stringify(ht));
ok(htmlTablo("<tr><td>a<br>b</td></tr>")[0][0] === "a b", "hücre içi satır sonu");
let ikili = "";
try { eskiExcelTablo(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 1, 2])); } catch (e) { ikili = String((e as Error).message); }
ok(/xlsx/.test(ikili), "ikili .xls için açıklamalı hata");
// Dosya no'su yazılmamış föy: taraf adı tutuyorsa seçenek olur
const numsuz = bosFoy({ muvekkil: "Deneme Kişi", mahkeme: "İzmir 3. Asliye Hukuk" });
const ns = eslestir([{ ...tablo[0], esasNo: "2026/999" }], [numsuz]);
ok(ns[0].durum === "secim" && ns[0].adaylar[0]?.id === numsuz.id, "numarasız föy, mahkeme ve taraf adıyla seçenek olur");

if (fail) { console.log(`durusma-listesi-test: ${fail} hata`); process.exit(1); }
console.log("durusma-listesi-test: tamam");
