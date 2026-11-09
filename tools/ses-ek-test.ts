// Sesli asistanın ek komutları ve yapay zekâya giden cümlenin kodlanması (uydurma föylerle).
import { bosFoy } from "../src/data/foy";
import { sesKodAc, sesKodla } from "../src/data/sesKod";
import { Baglam, sesliKomut } from "../src/data/sesKomut";
import { saatBul } from "../src/data/sesEk";

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const B = "2026-11-09";
const a = bosFoy({ muvekkil: "Ayşe Uydurmaoğlu", karsiTaraf: "Örnek Sigorta A.Ş.", mahkeme: "Uydurma 2. Asliye Hukuk Mahkemesi", esasNo: "2024/1111", tur: "hukuk", asama: "Tensip",
  notlar: "Müvekkil aradı.", gorevler: [{ id: "g1", metin: "Bilirkişi raporuna itiraz", tarih: "2026-11-20", bitti: false, kaynak: "elle" }],
  evraklar: [{ id: "e1", ad: "a.pdf", boyut: 1, eklenme: "2026-11-01T00:00:00Z", metin: "HÜKÜM: Davanın kabulüne,", tur: "Karar", tarih: "2026-10-12" }] });
const c = bosFoy({ muvekkil: "Mehmet Kurgusal", mahkeme: "Uydurma İcra Dairesi", esasNo: "2025/77", tur: "icra" });
const d = bosFoy({ muvekkil: "Zeynep Hayalî", durum: "kapali" });
const L = [a, c, d];
const ortam = { uyeler: [{ kullanici_id: "u1", ad: "Av. Yüksel Örnek", unvan: "Kurucu avukat" }, { kullanici_id: "u2", ad: "Selin Taslak", unvan: "Stajyer avukat" }], ben: "u1" };
let bg: Baglam = {};
const sor = (x: string) => { const r = sesliKomut(x, L, bg, B, ortam); bg = r.baglam; return r; };
const evet = () => sor("evet");

ok(saatBul("saat 10:30'da") === "10:30" && saatBul("14.00") === "14:00" && saatBul("saat 9") === "09:00", "saat");
let r = sor("duruşmalar sekmesini aç");
ok(r.eylem?.tip === "sekme" && r.eylem.ad === "durusmalar", "sekme: " + JSON.stringify(r.eylem));
r = sor("dava listesine git"); ok(r.eylem?.tip === "sekme" && r.eylem.ad === "liste", "git");
r = sor("geri dön"); ok(r.eylem?.tip === "sekme" && r.eylem.ad === "foyler", "geri");
r = sor("kaç açık icra dosyası var"); ok(/1 açık icra/.test(r.metin), "sayım: " + r.metin);
r = sor("kaç dosyam var"); ok(/3 dosya/.test(r.metin), "sayım hepsi: " + r.metin);
r = sor("Uydurmaoğlu dosyasının evraklarını oku"); ok(/Karar · Kabul/.test(r.metin), "evrak oku: " + r.metin);
r = sor("bu dosyanın notlarını oku"); ok(/Müvekkil aradı/.test(r.metin), "not oku (bağlam): " + r.metin);
r = sor("Uydurmaoğlu dosyasının aşamasını bilirkişi yap");
ok(r.baglam.bekleyen?.tip === "foyYaz" && /Bilirkişi/.test(r.metin) && !r.eylem, "aşama onay sorar: " + r.metin);
r = evet(); ok(r.eylem?.tip === "foyYaz" && (r.eylem.ek as { asama?: string }).asama === "Bilirkişi", "aşama: " + JSON.stringify(r.eylem));
r = sor("bu dosyanın esas numarasını 2025 bölü 14 yap"); evet();
ok(JSON.stringify(r.baglam).includes("2025/14"), "esas no: " + r.metin);
r = sor("Kurgusal dosyasının mahkemesini İzmir 5. İcra Dairesi yap");
ok(/İzmir 5\. İcra Dairesi/.test(r.metin), "mahkeme (büyük harf korunur): " + r.metin);
sor("vazgeç");
r = sor("Uydurmaoğlu dosyasına 12 Aralık saat 10:30 duruşma ekle");
ok(r.baglam.bekleyen?.tip === "foyYaz" && /12 Aralık.*10:30.*duruşması/.test(r.metin), "duruşma ekle: " + r.metin);
r = evet(); const du = (r.eylem as { ek: { durusmalar: { tarih: string; tur?: string }[]; durusma?: string } }).ek;
ok(du.durusmalar.some(x => x.tarih === "2026-12-12T10:30") && du.durusma === "2026-12-12T10:30", "duruşma eklendi");
r = sor("bu dosyaya keşif ekle 3 Aralık 14:00"); r = evet();
ok((r.eylem as { ek: { durusmalar: { tarih: string; tur?: string }[] } }).ek.durusmalar.some(x => x.tur === "kesif" && x.tarih === "2026-12-03T14:00"), "keşif eklendi");
r = sor("Uydurmaoğlu dosyasını kapat"); ok(/kapalı yapayım/.test(r.metin), "dosya kapat: " + r.metin); evet();
r = sor("Hayalî dosyasını yeniden aç"); ok(/açık yapayım/.test(r.metin), "yeniden aç: " + r.metin); sor("vazgeç");
r = sor("Uydurmaoğlu dosyasına not ekle: karşı taraf sulh teklif etti");
ok(/sulh teklif etti/.test(r.metin), "not ekle"); r = evet(); ok(/09\.11\.2026: karşı taraf sulh teklif etti/.test((r.eylem as { ek: { notlar: string } }).ek.notlar), "not yazıldı");
r = sor("bilirkişi işini Selin'e ver"); ok(/Selin Taslak adına/.test(r.metin), "iş ver: " + r.metin); r = evet();
ok((r.eylem as { ek: { gorevler: { atanan?: string }[] } }).ek.gorevler[0].atanan === "u2", "atandı");
r = sor("bilirkişi işinin son gününü 25 Kasım yap"); ok(/25 Kasım/.test(r.metin), "son gün: " + r.metin); sor("vazgeç");
r = sor("Uydurmaoğlu dosyasında bilirkişi işini sil"); ok(/sileyim/.test(r.metin), "iş sil: " + r.metin); r = evet();
ok((r.eylem as { ek: { gorevler: unknown[]; silinen: string[] } }).ek.gorevler.length === 0 && (r.eylem as { ek: { silinen: string[] } }).ek.silinen.includes("g1"), "silindi");
bg = {};
r = sor("Selin'in işleri"); ok(/Selin Taslak adına/.test(r.metin), "kişinin işleri: " + r.metin);
r = sor("duruşmaya girildi"); ok(r.eylem?.tip !== "foyYaz", "eski komut bozulmadı");
bg = {};
r = sor("şu dosyayla ilgili bir şey söyle bakalım biraz"); ok(!!r.anlasilmadi, "anlaşılmayan işaretlenir");
// İcra: haciz günü
bg = {};
r = sor("Kurgusal dosyasına 27 Kasım saat 9:30 haciz ekle"); ok(/haczi ekleyeyim/.test(r.metin), "haciz ekle: " + r.metin); r = evet();
const hz = (r.eylem as { ek: { durusmalar: { tur?: string; tarih: string }[] } }).ek.durusmalar;
ok(hz.some(x => x.tur === "haciz" && x.tarih === "2026-11-27T09:30"), "haciz eklendi " + JSON.stringify(hz));
r = sor("Kurgusal dosyasına 1 Aralık duruşma ekle"); ok(/haczi/.test(r.metin), "icrada duruşma → haciz: " + r.metin); sor("vazgeç");
r = sor("Uydurmaoğlu dosyasına 1 Aralık haciz ekle"); ok(/icra dosyası değil/.test(r.metin), "icra olmayana haciz yok");
const c2 = { ...c, durusmalar: [{ id: "h", tarih: "2026-11-05", tur: "haciz" as const }] };
const r2 = sesliKomut("Kurgusal dosyasında hacze gidildi", [a, c2, d], {}, B, ortam);
ok(/gidildi olarak işaretleyeyim/.test(r2.metin), "hacze gidildi: " + r2.metin);
// Dosya ilişkilendirme (iki föy birden yazılır) ve devam bağlantısı
bg = {};
r = sor("Uydurmaoğlu dosyasını 2025 bölü 77 dosyasıyla ilişkilendir");
ok(r.baglam.bekleyen?.tip === "foyYaz" && /ilişkilendireyim/.test(r.metin), "ilişkilendir: " + r.metin);
r = evet(); const ey = r.eylem as { ek: { ilgiliIds: string[] }; diger: { foyId: string; ek: { ilgiliIds: string[] } } };
ok(ey.ek.ilgiliIds.includes(c.id) && ey.diger.foyId === c.id && ey.diger.ek.ilgiliIds.includes(a.id), "iki yön");
bg = { foyId: c.id };
r = sor("bu dosyayı Hayalî dosyasıyla ilişkilendir"); ok(/ilişkilendireyim/.test(r.metin) && /Kurgusal/.test(r.metin) && /Hayalî/.test(r.metin), "bu dosya ile: " + r.metin); sor("vazgeç");
r = sor("Kurgusal dosyası Uydurmaoğlu dosyasının devamı"); ok(/devamı olarak bağlayayım/.test(r.metin), "devam: " + r.metin); r = evet();
ok((r.eylem as { ek: { oncekiId: string } }).ek.oncekiId === a.id, "önceki bağlandı");
// Mahkeme değişince gelecek duruşmalar yeni mahkemeyle akar
const md = bosFoy({ muvekkil: "Deniz Örnekçi", mahkeme: "Uydurma 1. Sulh Hukuk Mahkemesi", esasNo: "2025/5",
  durusmalar: [{ id: "p", tarih: "2026-10-01", mahkeme: "Uydurma 1. Sulh Hukuk Mahkemesi", esasNo: "2025/5" }, { id: "f", tarih: "2026-12-01", mahkeme: "Uydurma 1. Sulh Hukuk Mahkemesi", esasNo: "2025/5" }] });
const r3 = sesliKomut("Örnekçi dosyasının mahkemesini Uydurma 3. Asliye Hukuk Mahkemesi yap", [md], {}, B, ortam);
ok(/Gelecek 1 gün/.test(r3.metin), "gelecek gün sayısı: " + r3.metin);
const pt = (r3.baglam.bekleyen as { ek: { durusmalar: { id: string; mahkeme?: string }[] } }).ek.durusmalar;
ok(pt.find(x => x.id === "p")?.mahkeme === "Uydurma 1. Sulh Hukuk Mahkemesi" && pt.find(x => x.id === "f")?.mahkeme === "Uydurma 3. Asliye Hukuk Mahkemesi", "geçmiş kalır, gelecek akar " + JSON.stringify(pt));
// Kodlama: adlar ve dosya no gitmez, geri açılır.
const k = sesKodla("Ayşe Uydurmaoğlu'nun 2024 bölü 1111 dosyasını Selin'e ver, Örnek Sigorta aradı 05321234567", L, ortam.uyeler.map(u => u.ad));
ok(!/Uydurmaoğlu|Ayşe|1111|Selin|05321234567/.test(k.kodlu) && /Sigorta/.test(k.kodlu), "kodlu: " + k.kodlu);
const ac = sesKodAc(k.kodlu, k.harita);
ok(/Uydurmaoğlu/.test(ac) && /2024\/1111/.test(ac) && /Selin/.test(ac), "açıldı: " + ac);
if (fail) { console.log(`ses-ek-test: ${fail} hata`); process.exit(1); }
console.log("ses-ek-test: tamam");
