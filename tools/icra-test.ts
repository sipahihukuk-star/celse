// İcra hesapları: dönemsel yasal faiz, avans faizi, AAÜT 2026-2027 vekâlet ücreti, takip talebi metni (uydurma verilerle).
import { bosFoy } from "../src/data/foy";
import { icraEksikler, icraHesapla, icraVekalet, islemisFaiz, nispiUcret, takipTalebiMetni } from "../src/data/icra";
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const yakin = (a: number, b: number) => Math.abs(a - b) < 0.02;
// 100.000 TL, 01.01.2024 – 01.01.2025: 152 gün %9 + 214 gün %24 (2024-06-01 sınır)
const f1 = islemisFaiz(100000, "2024-01-01", "2025-01-01", "yasal");
ok(f1.dilimler.length === 2 && f1.dilimler[0].gun === 152 && f1.dilimler[1].gun === 214, "yasal faiz dilimleri: " + JSON.stringify(f1.dilimler));
ok(yakin(f1.tutar, 100000 * 0.09 * 152 / 365 + 100000 * 0.24 * 214 / 365), "yasal faiz tutarı: " + f1.tutar);
// 31.07.2026 sınırı: %24 → %31
const f2 = islemisFaiz(10000, "2026-07-01", "2026-08-30", "yasal");
ok(f2.dilimler.length === 2 && f2.dilimler[0].oran === 24 && f2.dilimler[0].gun === 30 && f2.dilimler[1].oran === 31 && f2.dilimler[1].gun === 30, "2026 yasal faiz değişimi: " + JSON.stringify(f2.dilimler));
// Avans: 20.12.2025 öncesi eksik uyarısı; elle oranla sabit
ok(!!islemisFaiz(1000, "2025-01-01", "2026-01-01", "avans").eksik, "avans eski dönem uyarısı");
ok(yakin(islemisFaiz(1000, "2025-01-01", "2026-01-01", "avans", 45).tutar, 1000 * 0.45 * 365 / 365), "elle oran");
ok(islemisFaiz(1000, "2026-01-01", "2026-03-02", "avans").tutar > 0 && !islemisFaiz(1000, "2026-01-01", "2026-03-02", "avans").eksik, "avans güncel dönem");
// AAÜT: ilk 800.000 %16, sonraki 800.000 %15
ok(nispiUcret(800000) === 128000 && nispiUcret(1600000) === 248000, "nispi dilimler: " + nispiUcret(1600000));
ok(icraVekalet(50000, false).ucret === 12500 && icraVekalet(10000, false).ucret === 10000, "maktu ve tavan");
ok(icraVekalet(100000, true).ucret === 16000 + 26000, "tahliye maktu eklenir: " + icraVekalet(100000, true).ucret);
// Kambiyo: çek tazminatı %10
const f = bosFoy({ tur: "icra", muvekkil: "Uydurma Alacaklı A.Ş.", karsiTaraf: "Hayali Borçlu", mahkeme: "Uydurma 3. İcra Dairesi", taraf: "davaci",
  muvekkilBilgi: { kimlikNo: "1234567890", adres: "Uydurma Mah. 1" }, karsiBilgi: { kimlikNo: "10000000146", adres: "Hayali Sok. 2" } });
const b = { yol: "kambiyo" as const, senet: { tur: "cek" as const, vade: "2026-09-01", duzenleme: "2026-08-01" }, asil: 50000, faizBaslangic: "2026-09-01", takipTarihi: "2026-10-01", faizTuru: "avans" as const, hesap: { iban: "TR000000000000000000000000" } };
const h = icraHesapla(b);
ok(h.ek.some(x => /Çek tazminatı/.test(x.ad) && x.tutar === 5000), "çek tazminatı");
ok(yakin(h.toplam, 50000 + 5000 + h.faiz), "toplam");
const metin = takipTalebiMetni(f, b, "2026-10-01");
ok(/Örnek 10/.test(metin) && /Çek tazminatı/.test(metin) && /Toplam alacak/.test(metin) && /takip tarihinden itibaren/.test(metin), "takip talebi metni:\n" + metin);
ok(/tahsilde tekerrür olmamak kaydıyla/.test(metin) && /TBK 100/.test(metin), "talep edilen hak");
ok(icraEksikler(f, { ...b, yol: "genel", belge: "fatura" }).some(x => /mahiyet/.test(x)), "mahiyet zorunlu");
ok(icraEksikler(f, b).length === 0, "eksik yok: " + icraEksikler(f, b).join(", "));
ok(icraEksikler(bosFoy({ tur: "icra" }), { yol: "genel" }).length >= 5, "eksikler listelenir");
// Kalem kalem faiz (UYAP takip talebindeki gibi): manevi tazminat avans, yargılama gideri yasal.
{
  const { talepEdilenHak } = require("../src/data/icra");
  const k = { yol: "ilamli" as const, takipTarihi: "2026-10-01", kalemler: [
    { ad: "Manevi tazminat", tutar: 15000, faizTuru: "avans" as const, faizBaslangic: "2026-01-01" },
    { ad: "Yargılama gideri", tutar: 1000, faizTuru: "yasal" as const, faizBaslangic: "2026-06-01" },
    { ad: "Bakiye harç", tutar: 250, faizTuru: "yasal" as const, faizBaslangic: "2026-06-01" }] };
  const hh = icraHesapla(k);
  ok(hh.kalemler.length === 3 && hh.kalemler[0].dilimler[0].oran === 39.75 && hh.kalemler[1].dilimler.length === 2, "kalem dilimleri: " + JSON.stringify(hh.kalemler.map(x => x.dilimler)));
  ok(yakin(hh.toplam, 16250 + hh.faiz), "kalemli toplam");
  const th = talepEdilenHak(k);
  ok(/manevi tazminat için hesaplanacak avans faizi ve diğer alacaklar için hesaplanacak yasal faiz/.test(th), "talep metni kalem kalem: " + th);
  const m2 = takipTalebiMetni(f, k, "2026-10-01");
  ok(/Manevi tazminat bedeline işlemiş avans faizi/.test(m2) && /Bakiye harç \(istenen: yasal faiz\)/.test(m2), "özet kalemleri:\n" + m2);
  // Eski kayıt (tek asıl alacak) kalemlere çevrilir
  ok(icraHesapla({ yol: "genel", asil: 1000, faizTuru: "yasal", faizBaslangic: "2026-01-01", takipTarihi: "2026-02-01" }).kalemler.length === 1, "eski kayıt");
}
if (fail) { console.log(`icra-test: ${fail} hata`); process.exit(1); }
console.log("icra-test: tamam");
