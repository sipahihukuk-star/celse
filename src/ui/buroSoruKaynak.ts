// Büroya sor (sesli asistan ve yazarak): bütün föyler hakkında serbest soru. "Bu hafta neler var?", "Ahmet Bey'in dosyalarında
// son durum ne?", "Hangi dosyada bilirkişi raporu geldi?", "Kimden ne kadar ücret alacağımız var?" gibi.
// Cihazda bütün açık föylerin kısa özeti (künye, aşama, sıradaki gün, açık işler, son evrak, hesap), yaklaşan 30 günün takvimi,
// gecikmiş ve acil işler ve soruda adı geçen en çok iki föyün ayrıntısı (notlar, önemli evrakın metni) hazırlanır; hepsi BİRLİKTE
// kodlanır (adlar, dosya numaraları, kimlik ve iletişim bilgileri gitmez) ve danisma "genel_sor" ile sorulur. Cevap cihazda açılır.
// Şahsi (şifreli) föyler hiç katılmaz; onlar föyün içindeki "Yapay zekâya sor" ile sorulur.
import { DTUR_AD, dTur, takvim } from "../data/durusma";
import { Foy } from "../data/foy";
import { turBilgi } from "../data/foyTurleri";
import { hesapOzeti, tlYaz } from "../data/hesap";
import { bugunStr, uyariDuzeyi } from "../data/isTakibi";
import { foyBul } from "../data/sesKomut";
import { mask } from "../engine/mask";
import { ekAdlar } from "./foyEvrak";

// Tarihler YYYY-AA-GG (haftanın günüyle) yazılır: kodlama gg.aa.yyyy tarihlerini aya indirir, takvim için gün gerekir.
const GUN = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const tr = (x?: string) => (x ? x.slice(0, 10) + " " + GUN[new Date(x.slice(0, 10) + "T12:00:00Z").getUTCDay()] + (x.length > 10 ? " " + x.slice(11, 16) : "") : "");
// Kişi ve şirket adlarının tek başına söylenen parçaları da (soyadı, şirketin ilk sözcüğü) kodlanır.
const GENEL = new Set(["sigorta", "inşaat", "ticaret", "sanayi", "limited", "şirketi", "anonim", "holding", "turizm", "gıda", "tekstil", "otomotiv", "enerji", "lojistik", "nakliyat", "yapı",
  "bankası", "banka", "belediyesi", "belediye", "bakanlığı", "müdürlüğü", "başkanlığı", "kurumu", "hazine", "hazinesi", "maliye", "vakfı", "derneği", "kooperatifi", "ltd.", "şti.", "a.ş.", "tic.", "san.", "ve"]);
const adParcalari = (x: string) => x.split(/\s+/).map(w => w.replace(/[.,;:()]+$/g, "")).filter(w => w.length >= 4 && !GENEL.has(w.toLocaleLowerCase("tr")) && /^\p{Lu}/u.test(w));
const gunEkle = (g: string, n: number) => { const d = new Date(g + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const ONCELIK = ["Gerekçeli karar", "Karar", "Bilirkişi raporu", "Ara karar", "Duruşma tutanağı", "İddianame", "Ödeme emri", "Dava dilekçesi", "Cevap dilekçesi", "Dilekçe"];

/** Bir föyün tek satırlık özeti (kodlanmadan önce). */
export function foySatiri(f: Foy, no: number, bugun: string): string {
  const p: string[] = [`Dosya ${no}: ${turBilgi(f.tur).ad}${f.davaTuru ? " · " + f.davaTuru : ""}`];
  p.push("bizim taraf " + (f.taraf === "davali" ? "davalı/sanık/borçlu" : "davacı/başvuran/alacaklı"));
  if (f.mahkeme || f.esasNo) p.push("merci " + [f.mahkeme, f.esasNo].filter(Boolean).join(" "));
  p.push("müvekkil " + (f.muvekkil || "yazılmamış") + (f.karsiTaraf ? " · karşı taraf " + f.karsiTaraf : ""));
  if (f.asama) p.push("aşama " + f.asama);
  if (f.durum === "kapali") p.push("KAPALI" + (f.kapanis ? " " + tr(f.kapanis) : ""));
  if (f.acilis) p.push("açılış " + tr(f.acilis));
  if (f.sorumlu?.ad) p.push("sorumlu " + f.sorumlu.ad);
  const gelecek = (f.durusmalar || []).filter(d => d.tarih.slice(0, 10) >= bugun).sort((a, b) => a.tarih.localeCompare(b.tarih));
  if (gelecek.length) p.push("sıradaki " + gelecek.slice(0, 2).map(d => DTUR_AD[dTur(d)].toLocaleLowerCase("tr") + " " + tr(d.tarih) + (d.e === "kabul" ? " (e-duruşma)" : "")).join(", "));
  else if (f.durusma && f.durusma.slice(0, 10) >= bugun) p.push("sıradaki duruşma " + tr(f.durusma));
  const gecmis = (f.durusmalar || []).filter(d => d.tarih.slice(0, 10) < bugun).sort((a, b) => b.tarih.localeCompare(a.tarih))[0];
  if (gecmis) p.push("son " + DTUR_AD[dTur(gecmis)].toLocaleLowerCase("tr") + " " + tr(gecmis.tarih) + (gecmis.girildi === "evet" ? " (girildi)" : gecmis.girildi === "hayir" ? " (girilmedi)" : " (girildi mi yazılmamış)"));
  const acik = f.gorevler.filter(g => !g.bitti);
  if (acik.length) {
    const sira = [...acik].sort((a, b) => (a.tarih || "9999").localeCompare(b.tarih || "9999")).slice(0, 4);
    p.push(`açık işler ${acik.length}: ` + sira.map(g => g.metin.slice(0, 120) + (g.tarih ? " (son gün " + tr(g.tarih) + ", " + uyariDuzeyi(g, f, bugun).metin + ")" : "") + (g.atananAd ? " [" + g.atananAd + "]" : "")).join("; "));
  } else p.push("açık iş yok");
  const evrak = [...f.evraklar].sort((a, b) => (b.tarih || b.eklenme).localeCompare(a.tarih || a.eklenme));
  if (evrak.length) p.push(`evrak ${evrak.length}, son: ` + evrak.slice(0, 3).map(e => (e.tur || "Evrak") + (e.konu ? " (" + e.konu.slice(0, 100) + ")" : "") + " " + tr(e.tarih || e.eklenme)).join("; "));
  const h = hesapOzeti(f);
  if (h.ucret || h.tahsilat || h.masraf) p.push(`hesap: ücret ${tlYaz(h.ucret)}, tahsil ${tlYaz(h.tahsilat)}, kalan ${tlYaz(h.kalanUcret)}, masraf ${tlYaz(h.masraf)}`);
  if (f.talepler?.length) p.push("talepler: " + f.talepler.map(t => t.tur.replace(/_/g, " ") + " " + t.durum).join(", "));
  return p.join(" · ");
}

/** Ayrıntı: notlar, son değerlendirme, bütün işler ve önemli evrakın metni (sınıra kadar). */
function ayrinti(f: Foy, no: number, sinir: number): string {
  const xs: string[] = [`=== DOSYA ${no} AYRINTISI ===`];
  if (f.notlar.trim()) xs.push("Notlar: " + f.notlar.trim().slice(0, 2500));
  if (f.degerlendirme?.ozet) xs.push("Son değerlendirme (" + tr(f.degerlendirme.tarih) + "): " + f.degerlendirme.ozet.slice(0, 2500));
  if (f.gorevler.length) xs.push("İşler:\n" + f.gorevler.slice(-25).map(g => "- " + g.metin + (g.tarih ? " (son gün " + tr(g.tarih) + ")" : "") + (g.bitti ? " [tamamlandı" + (g.kapanis ? " " + tr(g.kapanis.tarih) + " no " + g.kapanis.no : "") + "]" : " [açık]")).join("\n"));
  if (f.evraklar.length) xs.push("Evrak listesi:\n" + [...f.evraklar].sort((a, b) => (a.tarih || a.eklenme).localeCompare(b.tarih || b.eklenme)).slice(-40).map(e => "- " + (e.tur || "Evrak") + (e.konu ? ": " + e.konu : "") + " · " + tr(e.tarih || e.eklenme)).join("\n"));
  const onemli = f.evraklar.filter(e => e.onemli !== false && e.metin.trim())
    .sort((a, b) => { const pa = ONCELIK.indexOf(a.tur || ""), pb = ONCELIK.indexOf(b.tur || ""); return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb) || (b.tarih || b.eklenme).localeCompare(a.tarih || a.eklenme); });
  let kalan = sinir - xs.join("\n").length;
  for (const e of onemli) {
    if (kalan < 1500) break;
    const m = e.metin.slice(0, Math.min(12000, kalan - 200));
    xs.push(`--- ${e.tur || "Evrak"} · ${tr(e.tarih || e.eklenme)} ---\n${m}`);
    kalan -= m.length + 80;
  }
  return xs.join("\n");
}

export interface BuroKaynak { buro: string; soru: string; gecmis: { soru: string; cevap: string }[]; map: Record<string, string>; ayrintili: number; dosya: number }

/** Bütün büronun kodlanmış özeti + soru + geçmiş. Şahsi föyler katılmaz. */
export function buroSoruKaynagi(liste: Foy[], soru: string, gecmis: { soru: string; cevap: string }[] = [], bugun = bugunStr(), sinir = 95000): BuroKaynak {
  const foyler = liste.filter(f => !f.ozel)
    .sort((a, b) => (a.durum === b.durum ? 0 : a.durum === "acik" ? -1 : 1) || (b.guncelleme || "").localeCompare(a.guncelleme || ""));
  const no = new Map(foyler.map((f, i) => [f.id, i + 1]));
  // Soruda (ya da son sorudaki) adı geçen föyler ayrıntılı gider.
  const ilgili = [...foyBul(foyler, soru), ...(gecmis.length ? foyBul(foyler, gecmis[gecmis.length - 1].soru) : [])]
    .filter((f, i, a) => a.indexOf(f) === i).slice(0, 2);
  const acik = foyler.filter(f => f.durum === "acik"), kapali = foyler.filter(f => f.durum !== "acik");
  const bas = [`=== BUGÜN: ${tr(bugun)} ===`, `=== DOSYALAR (${acik.length} açık, ${kapali.length} kapalı) ===`];
  const ozetSinir = sinir * (ilgili.length ? 0.55 : 0.85);
  let ozet = "";
  let atlanan = 0;
  for (const f of [...acik, ...kapali]) {
    const s = foySatiri(f, no.get(f.id)!, bugun) + "\n";
    if (ozet.length + s.length > ozetSinir) { atlanan++; continue; }
    ozet += s;
  }
  if (atlanan) ozet += `(${atlanan} dosya sığmadığı için yazılmadı; çoğu kapalı dosyadır.)\n`;
  const bitis = gunEkle(bugun, 30);
  const tk = takvim(foyler, bugun, bitis, bugun);
  const takvimMetni = "=== YAKLAŞAN 30 GÜN ===\n" + (tk.length ? tk.slice(0, 80).map(x => `- ${tr(x.d.tarih)} ${DTUR_AD[x.tur]}: Dosya ${no.get(x.f.id)} (${x.f.muvekkil || "müvekkil yazılmamış"}, ${x.d.mahkeme || x.f.mahkeme || "merci yazılmamış"})${x.d.e === "kabul" ? " e-duruşma" : ""}`).join("\n") : "(kayıtlı gün yok)");
  const isler = acik.flatMap(f => f.gorevler.filter(g => !g.bitti).map(g => ({ f, g, u: uyariDuzeyi(g, f, bugun) })))
    .filter(x => ["gecikti", "bugun", "acil", "uyari"].includes(x.u.duzey)).sort((a, b) => (a.g.tarih || "9999").localeCompare(b.g.tarih || "9999"));
  const isMetni = "=== GECİKMİŞ VE ACİL İŞLER ===\n" + (isler.length ? isler.slice(0, 60).map(x => `- Dosya ${no.get(x.f.id)}: ${x.g.metin.slice(0, 140)} (${x.u.metin})${x.g.atananAd ? " [" + x.g.atananAd + "]" : ""}`).join("\n") : "(yok)");
  const kalanYer = sinir - (bas.join("\n").length + ozet.length + takvimMetni.length + isMetni.length) - 2000;
  const ayr = ilgili.map(f => ayrinti(f, no.get(f.id)!, Math.max(3000, kalanYer / ilgili.length)));
  const metin = [...bas, ozet, takvimMetni, isMetni, ...ayr].join("\n\n");
  // Hepsi birlikte kodlanır: aynı kişi her yerde aynı kodla görünür.
  const adlar = [...new Set(foyler.flatMap(f => { const xs = ekAdlar(f); return [...xs, ...xs.flatMap(adParcalari)]; }))].sort((a, b) => b.length - a.length);
  const AYRAC = "\n␞␞\n";
  const m = mask([metin, soru, ...gecmis.flatMap(x => [x.soru, x.cevap])].join(AYRAC), { extra: adlar });
  // Tek başına geçen soyadı / kısa ad, tam adın koduyla aynı kodu alır (yalnız tek bir kişiye aitse): model ikisini bağlayabilsin.
  const kodu = new Map(Object.entries(m.map).map(([c, v]) => [v, c]));
  const sahibi = new Map<string, Set<string>>();
  for (const f of foyler) for (const ad of ekAdlar(f)) for (const p of adParcalari(ad)) { const x = sahibi.get(p) || new Set(); x.add(ad); sahibi.set(p, x); }
  let maskeli = m.masked;
  for (const [p, sahip] of sahibi) {
    const cp = kodu.get(p), ad = [...sahip][0], ca = ad ? kodu.get(ad) : undefined;
    if (sahip.size === 1 && cp && ca && cp !== ca) maskeli = maskeli.split(cp).join(ca);
  }
  const k = maskeli.split(AYRAC.trim()).map(x => x.trim());
  const gk: { soru: string; cevap: string }[] = [];
  for (let i = 2; i + 1 < k.length; i += 2) gk.push({ soru: k[i], cevap: k[i + 1] });
  return { buro: k[0], soru: k[1] || soru, gecmis: gk, map: m.map, ayrintili: ilgili.length, dosya: foyler.length };
}

