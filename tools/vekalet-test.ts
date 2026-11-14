// Vekâletname okuma: uydurma vekâletnamelerle (gerçek kişi ve belge kullanılmaz).
import { vekaletKunye, vekaletOku } from "../src/data/vekaletOku";
import { dosyalariTamamla, kartDosyalari, karttanGetir, vekaletlerdenKartlar } from "../src/data/muvekkil";
import { bosFoy, Foy } from "../src/data/foy";
let fail = 0;
const ok = (c: unknown, m: string) => { if (c) console.log("✓ " + m); else { fail++; console.log("✗ " + m); } };

// 1) Noter kalıbı: "Ben … T.C. Kimlik No … olan AD SOYAD", tek vekil eden, vekil avukatlar.
const a = `T.C.
UYDURMA 5. NOTERLİĞİ
Yevmiye No: 12345
VEKALETNAME
Ben aşağıda imzası bulunan T.C. Kimlik No: 12345678950 olan AYŞE ÖRNEK DENEME, Hayal Mah. Masal Sok. No:5 Karşıyaka/İZMİR adresinde mukim,
İzmir Barosu avukatlarından Av. Kurgu Avukat ve Av. Temsili Hukukçu'yu vekil tayin ettim. Vekillerim birlikte ya da ayrı ayrı bilumum dava ve icra takiplerinde,
davayı kabul, feragat, sulh, ibra, ahzu kabz, başkasını tevkil ve azil yetkileriyle temsile yetkilidir.
VEKİL EDEN: AYŞE ÖRNEK DENEME
Düzenleme Tarihi: 12.03.2026`;
const va = vekaletOku(a);
ok(va.vekilEdenler.length === 1 && va.vekilEdenler[0].ad === "Ayşe Örnek Deneme" && va.vekilEdenler[0].kimlikNo === "12345678950", "1: vekil eden ve kimlik no: " + JSON.stringify(va.vekilEdenler));
ok(va.vekilEdenler[0]?.adres === "Hayal Mah. Masal Sok. No:5 Karşıyaka/İZMİR", "1: adres: " + va.vekilEdenler[0]?.adres);
ok(va.vekiller.join("|") === "Kurgu Avukat|Temsili Hukukçu", "1: vekiller: " + va.vekiller.join("|"));
ok(va.noterlik === "Uydurma 5. Noterliği" && va.yevmiyeNo === "12345" && va.tarih === "2026-03-12", "1: noter, yevmiye, tarih: " + vekaletKunye(va));
ok(["Ahzu kabz (para almak)", "Sulh", "Davadan feragat", "İbra", "Başkasını tevkil"].every(x => va.ozelYetkiler.includes(x)) && va.kapsam === "Genel dava vekâletnamesi", "1: özel yetkiler: " + va.ozelYetkiler.join(", "));

// 2) Etiketli, birden çok vekil eden (eşler), numaralı.
const b = `VEKALETNAME
VEKİL EDENLER : 1- MEHMET DENEME (T.C. Kimlik No: 23456789138) 2- FATMA DENEME (T.C. Kimlik No: 34567891238)
ADRESİ : Kurgu Mah. Örnek Cad. No:12 Bornova/İZMİR
VEKİL : Av. KURGU AVUKAT, İzmir Barosu
Yukarıda adı geçen vekilimi her türlü dava ve takipte temsile, tahliye ve haciz işlemlerine yetkili kıldık.
İZMİR 12. NOTERLİĞİ   Yevmiye: 54321   Tarih: 5 Ocak 2026`;
const vb = vekaletOku(b);
ok(vb.vekilEdenler.map(x => x.ad + ":" + x.kimlikNo).join("|") === "Mehmet Deneme:23456789138|Fatma Deneme:34567891238", "2: iki vekil eden: " + JSON.stringify(vb.vekilEdenler));
ok(vb.vekilEdenler.every(x => x.adres === "Kurgu Mah. Örnek Cad. No:12 Bornova/İZMİR"), "2: ortak adres ikisine de");
ok(vb.noterlik === "İzmir 12. Noterliği" && vb.yevmiyeNo === "54321" && vb.tarih === "2026-01-05", "2: noter ve yazıyla tarih: " + vekaletKunye(vb));
ok(vb.vekiller.length === 1 && vb.vekiller[0] === "Kurgu Avukat", "2: vekil: " + vb.vekiller);

// 3) Şirket vekâletnamesi: unvan ve vergi no; yetkilinin kimlik no'su ayrı.
const c = `VEKALETNAME
Merkezi Hayal Mah. Masal Cad. No:1 Konak/İZMİR adresinde bulunan KURGU YAZILIM TİCARET LİMİTED ŞİRKETİ (Vergi No: 1234567890) adına
şirket müdürü T.C. Kimlik No: 45678912316 olan HAYALİ YÖNETİCİ, şirketi temsilen Av. Temsili Hukukçu'yu vekil tayin etmiştir.
UYDURMA 3. NOTERLİĞİ Yevmiye No: 777 Tarih: 01/02/2026`;
const vc = vekaletOku(c);
ok(vc.vekilEdenler.length === 1 && vc.vekilEdenler[0].sirket && vc.vekilEdenler[0].ad === "KURGU YAZILIM TİCARET LİMİTED ŞİRKETİ" && vc.vekilEdenler[0].vergiNo === "1234567890", "3: şirket ve vergi no; şirket müdürü müvekkil sayılmadı: " + JSON.stringify(vc.vekilEdenler));

// 4) Okunamayan: uyarı verilir, uydurma kişi çıkmaz.
const vd = vekaletOku("Taranmış sayfa okunamadı . . . 123");
ok(!vd.vekilEdenler.length && vd.uyarilar.includes("Vekil eden okunamadı"), "4: okunamayanda kimse uydurulmaz");
// 5) Avukatın kimlik numarası vekil eden sayılmaz.
const ve = vekaletOku(`VEKİL EDEN: AYŞE ÖRNEK (T.C. 12345678950) vekil olarak İzmir Barosu avukatlarından Av. Kurgu Avukat (T.C. 56789123416) tayin edilmiştir. Uydurma 1. Noterliği Yevmiye 5 Tarih 01.01.2026`);
ok(ve.vekilEdenler.length === 1 && ve.vekilEdenler[0].kimlikNo === "12345678950", "5: avukatın kimlik no'su müvekkil sayılmadı: " + JSON.stringify(ve.vekilEdenler));

// Müvekkil kartları: aynı kişi tek kart; var olan kartla birleşir; okunamayan ayrıca.
{
  const okunan = [{ kaynak: "a.pdf", vekalet: va }, { kaynak: "b.pdf", vekalet: vb }, { kaynak: "c.pdf", vekalet: vc }, { kaynak: "d.pdf", vekalet: vd }, { kaynak: "e.pdf", vekalet: ve }];
  const r = vekaletlerdenKartlar(okunan, []);
  ok(r.yeni.length === 4 && r.okunamayan.join() === "d.pdf", "kartlar: 4 müvekkil (aynı kişi iki vekâletnamede tek kart), 1 okunamayan: " + r.yeni.map(x => x.muvekkil).join(", "));
  const ayse = r.yeni.find(x => x.muvekkilBilgi?.kimlikNo === "12345678950")!;
  ok(ayse.muvekkil === "Ayşe Örnek Deneme" && ayse.muvekkilBilgi?.adres?.startsWith("Hayal Mah") && /Uydurma 5\. Noterliği, 12\.03\.2026, yevmiye 12345/.test(ayse.muvekkilBilgi?.vekaletname || "") && /Ahzu kabz/.test(ayse.muvekkilBilgi?.ek || ""), "kartın bilgileri vekâletnameden: " + JSON.stringify(ayse.muvekkilBilgi));
  const r2 = vekaletlerdenKartlar([{ kaynak: "b2.pdf", vekalet: vb }], r.yeni);
  ok(r2.yeni.length === 0 && r2.guncel.length === 2, "yeniden yüklenen vekâletname var olan kartlarla birleşti");
  // Dava föyünde eksik bilgiler karttan tamamlanır; yazılmış olan değişmez.
  const dosya = { ...bosFoy({ tur: "hukuk" }), muvekkil: "AYŞE ÖRNEK DENEME", muvekkilBilgi: { adres: "Elle yazılmış adres" } } as Foy;
  const t = dosyalariTamamla(r.yeni, [dosya]);
  ok(t.length === 1 && t[0].muvekkilBilgi?.kimlikNo === "12345678950" && t[0].muvekkilBilgi?.adres === "Elle yazılmış adres" && /yevmiye 12345/.test(t[0].muvekkilBilgi?.vekaletname || ""), "dava föyünde boş alanlar tamamlandı, dolu adres korundu");
  ok(kartDosyalari(ayse, [dosya]).length === 1, "kartın dosyaları bulunur");
  // Föyün içinden "Eksik bilgileri müvekkil klasöründen getir": ilk ve öteki müvekkiller.
  const iki = { ...bosFoy({ tur: "hukuk" }), muvekkil: "Mehmet Deneme", muvekkilBilgi: { telefon: "0555" }, ekMuvekkiller: [{ ad: "FATMA DENEME" }, { ad: "Tanımsız Kişi" }] } as Foy;
  const g = karttanGetir(iki, r.yeni);
  ok(g.ek.muvekkilBilgi?.kimlikNo === "23456789138" && g.ek.muvekkilBilgi?.telefon === "0555" && /İzmir 12\. Noterliği/.test(g.ek.muvekkilBilgi?.vekaletname || ""), "ilk müvekkilin boş bilgileri karttan geldi, dolu telefon korundu");
  ok(g.ek.ekMuvekkiller?.[0].kimlikNo === "34567891238" && /Bornova/.test(g.ek.ekMuvekkiller?.[0].adres || "") && g.bulunamayan.join() === "Tanımsız Kişi", "öteki müvekkil de doldu; kartı olmayan bildirildi");
  // 2000 vekâletname: hız
  const t0 = Date.now(); const cok = [];
  for (let i = 0; i < 2000; i++) {
    const b9 = String(100000000 + i * 37); const d = b9.split("").map(Number); const d10 = (((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10 + 10) % 10; const tc = b9 + d10 + ((d.reduce((x, y) => x + y, 0) + d10) % 10);
    cok.push({ kaynak: i + ".pdf", vekalet: vekaletOku(a.replace("12345678950", tc).replace("AYŞE ÖRNEK DENEME", "KİŞİ " + ["BİR", "İKİ", "ÜÇ", "DÖRT"][i % 4] + " NUMARA" + "ABCDEFGHIJ"[i % 10] + "ABCDEFGHIJ"[Math.floor(i / 10) % 10] + "ABCDEFGHIJ"[Math.floor(i / 100) % 10]).replaceAll("AYŞE ÖRNEK DENEME", "X")) });
  }
  const rc = vekaletlerdenKartlar(cok, []);
  ok(rc.yeni.length === 2000, "2000 vekâletnameden 2000 müvekkil kartı (" + (Date.now() - t0) + " ms)");
}

if (fail) { console.log(`vekalet-test: ${fail} hata`); process.exit(1); }
console.log("vekalet-test: tamam");
