// Dilekçe örnekleri: kodlama (uydurma kişi verileriyle), tür tahmini, klasör yolundan örnek tanıma, örnek seçimi.
import { ornekAnonim, ornekKodla, ornekKonu, ornekMetni, ornekSec, ornekTurTahmin, yoldanOrnek, DilekceOrnegi } from "../src/data/dilekceOrnek";

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const ornek = `İZMİR 4. ASLİYE HUKUK MAHKEMESİ'NE

DOSYA NO      : 2023/4567 Esas
DAVACI        : Zeynep Uydurmaca (TC: 10000000146)
VEKİLİ        : Av. Kemal Örnekoğlu, Alsancak Mah. 1453 Sok. No: 7 Konak/İzmir
DAVALI        : Deneme Sigorta A.Ş.
KONU          : Bilirkişi raporuna itirazlarımızın sunulmasıdır.

AÇIKLAMALAR
1- Bilirkişi Mehmet Uydurma tarafından düzenlenen raporda kusur oranı hatalı belirlenmiştir. Ödemeler TR33 0006 1005 1978 6457 8413 26 hesabına yapılmıştır. İletişim: zeynep@ornek.com
2- Rapor eksik incelemeye dayanmaktadır; tanık beyanları değerlendirilmemiştir.

SONUÇ VE İSTEM
Yeni bir bilirkişi heyetinden rapor alınmasını saygıyla arz ve talep ederiz.`;
const a = ornekAnonim(ornek);
ok(!!a && !/Zeynep|Uydurmaca|Örnekoğlu|10000000146|TR33|zeynep@|1453 Sok/.test(a), "kişisel veri kodlandı: " + a.slice(0, 400));
ok(/\[ÖRNEK [^\]]+-\d+\]/.test(a) && /AÇIKLAMALAR/.test(a) && /SONUÇ VE İSTEM/.test(a), "kodlar ÖRNEK önekli, yapı korunur");
const kd = ornekKodla(ornek, "Zeynep Uydurmaca bilirkişi itiraz.udf");
ok(!/Zeynep|Uydurmaca/.test(kd.ad) && /bilirkişi itiraz/.test(kd.ad), "dosya adındaki ad gizlenir: " + kd.ad);
ok(ornekKonu(a) === "Bilirkişi raporuna itirazlarımızın sunulmasıdır.", "konu satırı: " + ornekKonu(a));
ok(ornekTurTahmin(ornek) === "Bilirkişi raporuna itiraz", "tür tahmini: " + ornekTurTahmin(ornek));
ok(ornekTurTahmin("İSTANBUL BÖLGE ADLİYE MAHKEMESİ'NE gönderilmek üzere\nKONU: İstinaf dilekçemizin sunulmasıdır.") === "İstinaf dilekçesi", "istinaf tahmini");
ok(ornekTurTahmin("Sevgili dostum, nasılsın") === "", "belirsiz metinde tahmin yok");
ok(JSON.stringify(yoldanOrnek("Dilekçe örnekleri/Sözleşmeler/kira.docx")) === JSON.stringify({ klasor: "Sözleşmeler" }), "yol: alt klasör " + JSON.stringify(yoldanOrnek("Dilekçe örnekleri/Sözleşmeler/kira.docx")));
ok(!!yoldanOrnek("Sablonlar/x.udf") && yoldanOrnek("Sablonlar/x.udf")!.klasor === undefined, "şablon klasörü");
ok(yoldanOrnek("2024-123 Esas/karar.udf") === null && yoldanOrnek("örnek.udf") === null, "örnek klasörü dışı");
const o = (id: string, tur: string | undefined, klasor: string, ad = id): DilekceOrnegi => ({ id, ad, tur, klasor, metin: "metin " + id, eklenme: "" });
const xs = [o("a", "Bilirkişi raporuna itiraz", "Dilekçeler"), o("b", "Bilirkişi raporuna itiraz", "Dilekçeler"), o("c", "Bilirkişi raporuna itiraz", "Dilekçeler"), o("d", undefined, "Kanun yolları", "istinaf örneği"), o("e", "Kira sözleşmesi", "Sözleşmeler")];
ok(ornekSec(xs, "Bilirkişi raporuna itiraz").map(x => x.id).join() === "a,b", "aynı türden iki örnek");
ok(ornekSec(xs, "İstinaf dilekçesi").map(x => x.id).join() === "d", "aynı klasörden konusu yakın örnek");
ok(ornekSec(xs, "Temyiz dilekçesi").length === 1 && ornekSec(xs, "Bilirkişi raporuna itiraz", "yok").length === 0 && ornekSec(xs, "x", "e")[0].id === "e", "yok / elle seçim; eşleşme yoksa aynı klasörden bir örnek üslup için");
ok(ornekMetni(xs.slice(0, 2)).includes("--- Örnek 2: Bilirkişi raporuna itiraz ---"), "örnek metni");
if (fail) { console.log(`dilekce-ornek-test: ${fail} hata`); process.exit(1); }
console.log("dilekce-ornek-test: tamam");
