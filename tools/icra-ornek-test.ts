// İİK Yönetmeliği örnekleri: takip yoluna göre emir örneği, metinlerin doldurulması, icra vekâlet ücreti satırı (uydurma föy).
import { bosFoy, Foy } from "../src/data/foy";
import { IcraBilgi, takipTalebiMetni } from "../src/data/icra";
import { emirOrnegi, ICRA_ORNEKLERI, ornekMetni } from "../src/data/icraOrnekleri";

let fail = 0;
const ok = (c: unknown, m: string) => { if (c) console.log("✓ " + m); else { fail++; console.log("✗ " + m); } };
const b0: IcraBilgi = { yol: "ilamli", talep: "haciz", paraBirimi: "TL", faizTuru: "yasal", mahiyet: "4045",
  ilam: { mahkeme: "Uydurma 3. Asliye Hukuk Mahkemesi", esasNo: "2023/512", kararNo: "2025/188", kararTarihi: "2026-10-15" },
  kalemler: [{ ad: "Maddi tazminat", tutar: 35000, faizTuru: "yasal", faizBaslangic: "2022-02-01" }, { ad: "Vekâlet ücreti", tutar: 10000, faizTuru: "yasal", faizBaslangic: "2026-10-15" }] };
const f: Foy = { ...bosFoy({ tur: "icra", taraf: "davaci" }), mahkeme: "Uydurma İcra Dairesi", muvekkil: "Ayşe Örnek", karsiTaraf: "Hayali Yılmaz",
  ekMuvekkiller: [{ ad: "Mehmet Deneme" }], icra: { ...b0, ekBorclular: [{ ad: "Kurgu Yılmaz" }] } };
const b = f.icra!;

ok(emirOrnegi(b) === "5", "ilamlı para alacağı → Örnek 5");
ok(emirOrnegi({ ...b, mahiyet: "2045" }) === "3", "ilamlı çocuk teslimi → Örnek 3");
ok(emirOrnegi({ yol: "genel" }) === "7" && emirOrnegi({ yol: "kambiyo" }) === "10" && emirOrnegi({ yol: "kira" }) === "13", "ilamsız 7, kambiyo 10, kira 13");
ok(emirOrnegi({ yol: "kira", talep: "tahliye", kira: { sozlesmeSonu: true } }) === "14", "kira süresi bitti → Örnek 14");
ok(emirOrnegi({ yol: "ipotek" }) === "9" && emirOrnegi({ yol: "ipotek", ilamNiteliginde: true }) === "6", "ipotek 9 / ilam niteliğinde 6");
ok(emirOrnegi({ yol: "tasinir_rehni" }) === "8" && emirOrnegi({ yol: "tasinir_rehni", ilamNiteliginde: true }) === "44", "taşınır rehni 8 / 44");
ok(ICRA_ORNEKLERI.filter(x => x.tur !== "takip_sonrasi").map(x => x.no).join() === "1,2,3,4,5,6,7,8,9,10,11,12,13,14,44", "takip açılışı örneklerinin hepsi var");

const tt = takipTalebiMetni(f, b, "2026-11-13", "Örnek Avukat");
ok(/Örnek 1/.test(tt) && /borçluya gidecek emir: Örnek 5/.test(tt), "takip talebi Örnek 1, emir Örnek 5");
ok(/İcra vekâlet ücreti \(2026–2027 AAÜT/.test(tt) && /borçludan tahsili istenir/.test(tt), "icra vekâlet ücreti takip talebinde");
ok(/1\. Alacaklılar:\n\s+1\) Ayşe Örnek\n\s+2\) Mehmet Deneme/.test(tt), "iki alacaklı takip talebinde");
ok(!/İcra vekâlet ücreti \(2026/.test(takipTalebiMetni(f, { ...b, icraVekaletYazma: true }, "2026-11-13")), "istenirse yazılmaz");

const e5 = ornekMetni("5", f, b, { vekil: "Örnek Avukat", bugun: "2026-11-13" });
ok(/ÖRNEK NO: 5/.test(e5) && /ALACAKLILAR :/.test(e5) && /BORÇLULAR :\n\s+1\) Hayali Yılmaz\n\s+2\) Kurgu Yılmaz/.test(e5), "Örnek 5: taraflar");
ok(/7 gün içinde icra dairesinin banka hesabına/.test(e5) && /İİK m\. 33/.test(e5) && /İİK m\. 74/.test(e5), "Örnek 5: süre, icranın geri bırakılması, mal beyanı");
ok(/Uydurma 3\. Asliye Hukuk Mahkemesi'nin 2023\/512 esas ve 2025\/188 karar sayılı 15\.10\.2026 tarihli ilamı/.test(e5), "Örnek 5: dayanak ilam");
ok(/İcra vekâlet ücreti \(AAÜT\)/.test(e5), "Örnek 5: icra vekâlet ücreti");
const e10 = ornekMetni("10", f, { ...b, yol: "kambiyo", senet: { tur: "bono", vade: "2026-09-01" } }, { bugun: "2026-11-13" });
ok(/ödeme 10 gün · itiraz 5 gün · mal beyanı 10 gün/.test(e10) && /%10/.test(e10), "Örnek 10: süreler ve kötüniyet cezası");
if (fail) { console.log(`icra-ornek-test: ${fail} hata`); process.exit(1); }
console.log("icra-ornek-test: tamam");
