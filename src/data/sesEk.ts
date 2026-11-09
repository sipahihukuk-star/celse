// Sesli asistanın ek komutları: föyün alanlarını değiştirme (aşama, durum, mahkeme, esas no, dava türü, taraflar), not,
// duruşma ve keşif ekleme, işi silme / başkasına verme / son gününü değiştirme, sekmeleri açma, sayım, evrak ve not okuma.
// Yazan her komut önce sesli onay ister ("… yapayım mı?" → "evet"). Hepsi cihazda; hiçbir şey sunucuya gitmez.
import type { Foy, Gorev } from "./foy";
import { FoyTur, TURLER, turBilgi } from "./foyTurleri";
import { evrakBasligi } from "./evrakBaslik";
import { durusmaEkle, durusmaSirala, DTur, dTur, DTUR_AD, icraMi, yerDegisimi } from "./durusma";
import { donguMu } from "./foy";
import { silineniNotEt } from "./foy";
import type { Baglam, Cevap } from "./sesKomut";
import { foyBul, foyKisa, sesliTarih, tarihSoyle } from "./sesKomut";

export type SekmeAd = "foyler" | "durusmalar" | "isler" | "liste" | "toplu" | "buro" | "tevkil";
export interface SesUye { kullanici_id: string; ad: string; unvan: string }
export interface SesOrtam { uyeler?: SesUye[]; ben?: string }

const SEKME_SOZ: [RegExp, SekmeAd, string][] = [
  [/duruşma(lar)?(\s+ve\s+keşif(ler)?)?|keşifler|hacizler/, "durusmalar", "Duruşma, haciz ve keşif"], [/yapılacaklar|işler\s+(sekme|ekran)/, "isler", "Yapılacaklar"],
  [/dava\s+liste/, "liste", "Dava listesi"], [/toplu\s+(evrak|yükle)|evrak\s+yükle/, "toplu", "Toplu evrak yükle"],
  [/büro|çalışanlar/, "buro", "Büro ve çalışanlar"], [/tevkil/, "tevkil", "Tevkil avukatlar"], [/föyler(im)?|ana\s+sayfa|dosyalar(ım)?\s+(sekme|ekran|liste)/, "foyler", "Föyler"]
];
const kucuk = (x: string) => x.toLocaleLowerCase("tr");
const yeniGorevId = () => "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const trTarih = (x: string) => x.slice(0, 10).split("-").reverse().join(".");
/** "saat 10:30", "10.30'da", "saat 14" → "10:30" */
export function saatBul(m: string): string | undefined {
  const x = m.match(/saat\s*(\d{1,2})(?:[:.\s](\d{2}))?|(?:^|\s)(\d{1,2})[:.](\d{2})(?:['’]?\s*[a-zçğıöşü]{0,3})?(?=\s|$)/);
  if (!x) return;
  const s = Number(x[1] ?? x[3]), d = Number(x[2] ?? x[4] ?? 0);
  return s < 24 && d < 60 ? `${String(s).padStart(2, "0")}:${String(d).padStart(2, "0")}` : undefined;
}

/** Söylenen sözden föyü bulur: ad ya da dosya no; yoksa "bu dosya" / bağlamdaki föy. */
function hedefFoy(liste: Foy[], parca: string, bag?: Foy): { f?: Foy; adaylar: Foy[] } {
  const temiz = parca.replace(/\b(bu|şu)\s+(dosya|föy)\S*/g, " ");
  const ad = temiz.trim() ? foyBul(liste, temiz) : [];
  if (ad.length === 1) return { f: ad[0], adaylar: ad };
  if (!ad.length && bag) return { f: bag, adaylar: [] };
  return { adaylar: ad };
}
function isEsle(f: Foy, soz: string): Gorev[] {
  const acik = f.gorevler.filter(g => !g.bitti);
  const toks = kucuk(soz).split(/[^\p{L}\d]+/u).filter(x => x.length >= 3 && !["işini", "işi", "işinin", "görevi", "görevini", "dosyasında", "dosyası", "sil", "ver", "yap"].includes(x));
  const puan = acik.map(g => ({ g, p: toks.filter(t => kucuk(g.metin).split(/[^\p{L}\d]+/u).some(w => w.length >= 3 && (w.startsWith(t.slice(0, Math.max(4, t.length - 3))) || t.startsWith(w)))).length })).filter(x => x.p > 0).sort((a, b) => b.p - a.p);
  return puan.length ? puan.filter(x => x.p === puan[0].p).map(x => x.g) : [];
}
function kisiBul(uyeler: SesUye[], soz: string): SesUye | undefined {
  const s = kucuk(soz);
  return uyeler.find(u => kucuk(u.ad).split(/\s+/).some(w => w.length >= 3 && new RegExp(`(^|\\s)${w.slice(0, Math.max(3, w.length - 2))}`).test(s)))
    || uyeler.find(u => s.includes(kucuk(u.unvan)));
}

/** Ek komutlar: anlaşılmazsa null (ana ayrıştırıcı devam eder). */
export function ekKomut(soz: string, liste: Foy[], b: Baglam, bag: Foy | undefined, bugun: string, ortam: SesOrtam = {}): Cevap | null {
  const m = kucuk(soz).trim().replace(/[.!?]+$/, "");
  const cevap = (metin: string, baglam: Baglam = { foyId: b.foyId }, eylem?: Cevap["eylem"]): Cevap => ({ metin, baglam, eylem });
  const onay = (f: Foy, ek: Partial<Foy>, soru: string, diger?: { foyId: string; ek: Partial<Foy> }): Cevap => cevap(soru, { foyId: f.id, bekleyen: { tip: "foyYaz", foyId: f.id, ek, diger, ozet: soru.replace(/\s*(yapayım|yazayım|ekleyeyim|sileyim|vereyim|kapatayım|açayım|işaretleyeyim|bağlayayım)\s+mı\?$/, "") } });
  const dosyaYok = (adaylar: Foy[]) => adaylar.length > 1
    ? cevap(`${adaylar.length} dosya buldum: ${adaylar.slice(0, 3).map(foyKisa).join("; ")}. Dosya numarasıyla ya da tam adla söyleyin.`)
    : cevap("Hangi dosya? Müvekkilin adını ya da dosya numarasını söyleyin, ya da önce dosyayı açın.");

  // Sekmeler ve geri: "duruşmalar sekmesini aç", "yapılacaklara git", "geri dön", "föylere dön"
  if (/(sekme|ekran|sayfa)\S*\s*(aç|git|göster)|(aç|git|göster)$|['’]?(y|n)?[ae]\s+git|^geri(\s+dön)?$|föylere\s+dön/.test(m) && !/dosyas[ıi]n?ı?\s+aç/.test(m)) {
    if (/^geri(\s+dön)?$|föylere\s+dön/.test(m)) return cevap("Föylere dönüyorum.", {}, { tip: "sekme", ad: "foyler" });
    const s = SEKME_SOZ.find(([re]) => re.test(m));
    if (s && !foyBul(liste, m.replace(s[0], " ")).length) return cevap(`${s[2]} açılıyor.`, { foyId: b.foyId }, { tip: "sekme", ad: s[1] });
  }

  // İki dosyayı ilişkilendir: "Yılmaz dosyasını 2025/14 dosyasıyla ilişkilendir", "bu dosyayı Kurgusal dosyasına bağla",
  // "Yılmaz dosyası 2024/1111 dosyasının devamı" (önceki dosya bağlantısı: istinaf, temyiz, icra gibi zincir).
  const ilx = m.match(/^(.+?)\s+(?:ile\s+)?(ilişkilendir|ilişkili\s+yap|ilişkili\s+olsun|bağla|birbirine\s+bağla|devamı(?:dır)?|devamıdır|devamı\s+olarak\s+bağla)$/);
  if (ilx) {
    const devam = /devam/.test(ilx[2]);
    const ham = ilx[1].replace(/(\d{4})\s*(?:bölü|\/|-)\s*(\d+)/g, "$1/$2");
    const toks = ham.split(/\s+/);
    const temiz = (x: string) => x.replace(/(dosyas[ıi]n[ıi]n|dosyas[ıi]n[ıi]|dosyas[ıi]yla|dosyas[ıi]na|dosyas[ıi]|dosyay[ıi]|dosyaya|dosya)$/, "").replace(/['’]?(n[ıi]n|[ıi]n|y?la|y?le|y?[ıi]|y?a|y?e|ile)$/, "").trim();
    const bul = (parca: string) => {
      const p = parca.split(/\s+/).map(temiz).filter(Boolean).join(" ");
      if (/^(bu|şu)$/.test(p) || !p) return bag ? [bag] : [];
      return foyBul(liste, p);
    };
    let ikili: [Foy, Foy] | null = null;
    for (let k = 1; k < toks.length && !ikili; k++) {
      const A = bul(toks.slice(0, k).join(" ")), Bf = bul(toks.slice(k).join(" "));
      if (A.length === 1 && Bf.length === 1 && A[0].id !== Bf[0].id) ikili = [A[0], Bf[0]];
    }
    if (!ikili) return cevap("Hangi iki dosyayı bağlayacağımı anlayamadım. Örneğin: Yılmaz dosyasını 2025 bölü 14 dosyasıyla ilişkilendir, ya da önce bir dosyayı açıp: bu dosyayı Kurgusal dosyasıyla ilişkilendir.");
    const [A, Bf] = ikili;
    if (devam) {
      if (donguMu(A, Bf.id, liste)) return cevap("Bu bağlantı döngü oluşturur; ters yönde bağlı olabilirler.");
      return onay(A, { oncekiId: Bf.id }, `${foyKisa(A)} dosyasını ${foyKisa(Bf)} dosyasının devamı olarak bağlayayım mı?`);
    }
    if ((A.ilgiliIds || []).includes(Bf.id)) return cevap("Bu iki dosya zaten ilişkili.", { foyId: A.id });
    return onay(A, { ilgiliIds: [...(A.ilgiliIds || []), Bf.id] }, `${foyKisa(A)} ile ${foyKisa(Bf)} dosyalarını ilişkilendireyim mi?`, { foyId: Bf.id, ek: { ilgiliIds: [...new Set([...(Bf.ilgiliIds || []), A.id])] } });
  }

  // Sayım: "kaç dosyam var", "kaç açık icra dosyası var", "kaç kapalı dosya"
  if (/^kaç\s|kaç\s+(tane\s+)?(açık|kapalı)?\s*\S*\s*(dosya|dava|föy|takip)/.test(m)) {
    const tur = TURLER.find(x => !x.eski && (m.includes(kucuk(x.kisa)) || m.includes(kucuk(x.ad).split(" ")[0])));
    const durum = /kapalı|kapanmış|biten/.test(m) ? "kapali" : /açık|devam/.test(m) ? "acik" : "hepsi";
    const xs = liste.filter(f => !f.ozel && (!tur || (f.tur || "hukuk") === tur.tur) && (durum === "hepsi" || f.durum === durum));
    return cevap(`${xs.length} ${durum === "acik" ? "açık " : durum === "kapali" ? "kapalı " : ""}${tur ? kucuk(tur.ad) + " " : ""}dosya var.`);
  }

  // İşler kişiye göre: "bana verilen işler", "Ayşe'nin işleri"
  if (/(bana|benim)\s+(verilen|atanan)\s+iş|benim\s+işlerim|(nin|nın|nun|nün|in|ın|un|ün)\s+işleri/.test(m) && ortam.uyeler?.length) {
    const kisi = /(bana|benim)/.test(m) ? ortam.uyeler.find(u => u.kullanici_id === ortam.ben) : kisiBul(ortam.uyeler, m);
    if (!kisi) return cevap("Kimin işlerini okuyayım? Çalışanın adını söyleyin.");
    const xs = liste.flatMap(f => f.gorevler.filter(g => !g.bitti && g.atanan === kisi.kullanici_id).map(g => ({ f, g })));
    if (!xs.length) return cevap(`${kisi.ad} adına açık iş yok.`);
    return cevap(`${kisi.ad} adına ${xs.length} açık iş var. ` + xs.slice(0, 8).map((x, i) => `${i + 1}: ${x.g.metin}, ${foyKisa(x.f)}${x.g.tarih ? ", son gün " + tarihSoyle(x.g.tarih) : ""}`).join(". ") + ".");
  }

  // Evrak ve notları oku: "Yılmaz dosyasının evraklarını oku", "son evrak ne", "bu dosyanın notlarını oku"
  if (/evrak\S*\s+(oku|say|neler|ne)|son\s+(gelen\s+)?evrak/.test(m)) {
    const { f, adaylar } = hedefFoy(liste, m.replace(/evrak\S*|oku|son|gelen|neler|ne/g, " "), bag);
    if (!f) return dosyaYok(adaylar);
    const xs = [...f.evraklar].sort((a, c) => (c.tarih || c.eklenme).localeCompare(a.tarih || a.eklenme)).slice(0, /son\s+(gelen\s+)?evrak/.test(m) ? 1 : 5);
    if (!xs.length) return cevap(`${foyKisa(f)} dosyasında evrak yok.`, { foyId: f.id });
    return cevap(`${foyKisa(f)}: ${f.evraklar.length} evrak. Son ${xs.length}: ` + xs.map((e, i) => `${i + 1}: ${evrakBasligi(f, e).baslik}`).join(". ") + ".", { foyId: f.id });
  }
  if (/not(lar)?(ını|unu|u|ı)?\s+(oku|ne)/.test(m)) {
    const { f, adaylar } = hedefFoy(liste, m.replace(/not\S*|oku/g, " "), bag);
    if (!f) return dosyaYok(adaylar);
    return cevap(f.notlar.trim() ? `${foyKisa(f)} notları: ${f.notlar.trim().slice(0, 600)}` : `${foyKisa(f)} dosyasında not yok.`, { foyId: f.id });
  }

  // Not ekle: "Yılmaz dosyasına not ekle: müvekkil aradı"
  const notx = m.match(/^(.*?)\s*not\s+(?:ekle|yaz|düş)\s*[:,]?\s*(.+)$/);
  if (notx) {
    const { f, adaylar } = hedefFoy(liste, notx[1], bag);
    if (!f) return dosyaYok(adaylar);
    const not = soz.trim().replace(/^.*?not\s+(?:ekle|yaz|düş)\s*[:,]?\s*/i, "");
    const satir = `${trTarih(bugun)}: ${not}`;
    return onay(f, { notlar: (f.notlar.trim() ? f.notlar.trim() + "\n" : "") + satir }, `${foyKisa(f)} dosyasına not: "${not}". Ekleyeyim mi?`);
  }

  // Duruşma ya da keşif ekle: "Yılmaz dosyasına duruşma ekle 12 Aralık saat 10:30", "keşif ekle 3 Aralık 14:00"
  // Hacze gidildi / keşfe katılındı: "Kurgusal dosyasında hacze gidildi", "keşfe katılmadık"
  const hgx = m.match(/hacze?\s+(gidildi|gittik|gittim|çıkıldı|çıktık|gidilmedi|gidemedik|gitmedik|çıkılmadı|yapıldı|yapılamadı)|keşfe\s+(katıldık|katılındı|katıldım|gidildi|gittik|katılmadık|katılınmadı|gidilmedi|gidemedik)/);
  if (hgx) {
    const tur: DTur = /^hac/.test(hgx[0]) ? "haciz" : "kesif";
    const { f, adaylar } = hedefFoy(liste, m.replace(hgx[0], " "), bag);
    if (!f) return dosyaYok(adaylar);
    const d = [...durusmaSirala(f.durusmalar || [])].reverse().find(x => dTur(x) === tur && x.tarih.slice(0, 10) <= bugun);
    if (!d) return cevap(`${foyKisa(f)} dosyasında günü gelmiş ${DTUR_AD[tur].toLocaleLowerCase("tr")} kaydı yok.`, { foyId: f.id });
    const girildi = /medi|madı|madık|emedik|medik|lamadı|ınmadı/.test(hgx[0]) ? "hayir" as const : "evet" as const;
    return onay(f, { durusmalar: (f.durusmalar || []).map(x => (x.id === d.id ? { ...x, girildi } : x)) }, `${foyKisa(f)}, ${tarihSoyle(d.tarih)} ${DTUR_AD[tur].toLocaleLowerCase("tr")}: ${girildi === "evet" ? (tur === "haciz" ? "gidildi" : "katılındı") : (tur === "haciz" ? "gidilmedi" : "katılınmadı")} olarak işaretleyeyim mi?`);
  }

  const dex = m.match(/(duruşma|keşif|haciz)\s*(?:günü\s*)?(?:ekle|yaz|koy)(?!\S*\s*(?:il|dik|dim))|(?:duruşma|keşif|haciz)\s+(?:günü|tarihi)\s+/);
  if (dex) {
    let tur: DTur = /keşif/.test(dex[0]) ? "kesif" : /haciz/.test(dex[0]) ? "haciz" : "durusma";
    const { tarih, kalan } = sesliTarih(m, bugun);
    if (!tarih) return cevap(`${DTUR_AD[tur]} gününü anlayamadım. Örneğin: 12 Aralık saat 10:30.`);
    const saat = saatBul(kalan);
    const { f, adaylar } = hedefFoy(liste, kalan.split(/duruşma|keşif|haciz/)[0], bag);
    if (!f) return dosyaYok(adaylar);
    if (icraMi(f) && tur === "durusma") tur = "haciz"; // icra dosyasında duruşma olmaz
    if (!icraMi(f) && tur === "haciz") return cevap(`${foyKisa(f)} bir icra dosyası değil; haciz günü icra dosyasına yazılır.`, { foyId: f.id });
    const t = saat ? `${tarih}T${saat}` : tarih;
    const durusmalar = durusmaEkle(f, t, tur === "durusma" ? {} : { tur });
    const ileri = durusmalar.filter(x => x.tarih.slice(0, 10) >= bugun && (x.tur || "durusma") === "durusma").sort((a, c) => a.tarih.localeCompare(c.tarih));
    return onay(f, { durusmalar, ...(ileri.length ? { durusma: ileri[0].tarih } : {}) }, `${foyKisa(f)} dosyasına ${tarihSoyle(tarih)}${saat ? " saat " + saat : ""} ${tur === "kesif" ? "keşfi" : tur === "haciz" ? "haczi" : "duruşması"} ekleyeyim mi?`);
  }

  // Dosyayı kapat / yeniden aç: "Yılmaz dosyasını kapat", "bu dosyayı kapalıya al", "dosyayı yeniden aç"
  if (/dosya\S*\s+(kapat|kapalıya\s+al|kapandı)|dosya\S*\s+(yeniden\s+aç|açığa\s+al|tekrar\s+aç)/.test(m)) {
    const kapat = /kapat|kapalıya|kapandı/.test(m);
    const { f, adaylar } = hedefFoy(liste, m.replace(/dosya\S*\s+(kapat\S*|kapalıya\s+al|kapandı|yeniden\s+aç|açığa\s+al|tekrar\s+aç)/, " "), bag);
    if (!f) return dosyaYok(adaylar);
    return onay(f, kapat ? { durum: "kapali", kapanis: f.kapanis || bugun } : { durum: "acik" }, `${foyKisa(f)} dosyasını ${kapat ? "kapalı" : "açık"} yapayım mı?`);
  }

  // Alan değiştir: "aşamasını bilirkişi yap", "mahkemesini İzmir 3. Asliye Hukuk yap", "esas numarasını 2025/14 yap", "dava türünü işe iade yap"
  const alx = m.match(/^(.*?)\s*(aşama|mahkeme|merci|esas\s*(?:no|numara)|dosya\s*(?:no|numara)|dava\s*türü|konu|müvekkil|karşı\s*taraf)\S*\s+(.+?)\s+(?:yap|olarak\s+(?:değiştir|güncelle|yaz)|olsun|değiştir|güncelle)$/);
  if (alx) {
    const { f, adaylar } = hedefFoy(liste, alx[1], bag);
    if (!f) return dosyaYok(adaylar);
    const alanSoz = alx[2];
    const ham = soz.trim().replace(/[.!?]+$/, "");
    const degerHam = (() => { const r = new RegExp(alanSoz.replace(/\s+/g, "\\s*") + "\\S*\\s+(.+?)\\s+(?:yap|olarak|olsun|değiştir|güncelle)", "i"); return (ham.match(r)?.[1] || alx[3]).trim(); })();
    const deger = alanSoz.startsWith("esas") || alanSoz.startsWith("dosya") ? degerHam.replace(/\s*(?:bölü|\/|-)\s*/g, "/").replace(/\s+/g, "") : degerHam;
    if (alanSoz === "aşama") {
      const as = turBilgi(f.tur).asamalar;
      const uy = as.find(a => kucuk(a).startsWith(kucuk(deger).slice(0, 5))) || as.find(a => kucuk(a).includes(kucuk(deger).split(" ")[0]));
      return onay(f, { asama: uy || deger }, `${foyKisa(f)} dosyasının aşamasını "${uy || deger}" yapayım mı?`);
    }
    const alan = alanSoz.startsWith("mahkeme") || alanSoz === "merci" ? "mahkeme" : alanSoz.startsWith("esas") || alanSoz.startsWith("dosya") ? "esasNo" : alanSoz.startsWith("dava") || alanSoz === "konu" ? "davaTuru" : alanSoz === "müvekkil" ? "muvekkil" : "karsiTaraf";
    if (alan === "mahkeme" || alan === "esasNo") {
      const d = yerDegisimi(f, { [alan]: deger });
      const n = d ? d.filter((x, i) => x !== (f.durusmalar || [])[i]).length : 0;
      return onay(f, { [alan]: deger, ...(d ? { durusmalar: d } : {}) } as Partial<Foy>, `${foyKisa(f)} dosyasının ${alan === "mahkeme" ? "mahkemesini" : "dosya numarasını"} "${deger}" yapayım mı?${n ? ` Gelecek ${n} gün de yeni ${alan === "mahkeme" ? "mahkemeyle" : "numarayla"} akar.` : ""}`.replace(/mı\? (Gelecek.*)$/, "mı? $1"));
    }
    const ad = { mahkeme: "mahkemesini", esasNo: "dosya numarasını", davaTuru: "dava türünü", muvekkil: "müvekkilini", karsiTaraf: "karşı tarafını" }[alan];
    return onay(f, { [alan]: deger } as Partial<Foy>, `${foyKisa(f)} dosyasının ${ad} "${deger}" yapayım mı?`);
  }
  // Dosya türü: "bu dosyanın türünü icra yap"
  const trx = m.match(/^(.*?)\s*(?:dosya\s+)?tür(?:ü|ünü)\s+(.+?)\s+(?:yap|olsun|değiştir)$/);
  if (trx) {
    const { f, adaylar } = hedefFoy(liste, trx[1], bag);
    if (!f) return dosyaYok(adaylar);
    const tur = TURLER.find(x => !x.eski && (kucuk(x.ad).startsWith(trx[2].slice(0, 4)) || kucuk(x.kisa).startsWith(trx[2].slice(0, 4))));
    if (!tur) return cevap(`"${trx[2]}" diye bir dosya türü bulamadım.`);
    return onay(f, { tur: tur.tur as FoyTur }, `${foyKisa(f)} dosyasının türünü "${tur.ad}" yapayım mı?`);
  }

  // İş sil / başkasına ver / son gününü değiştir
  const isx = m.match(/^(.*?)\s+(?:işini|görevini|işi)\s+(sil|kaldır|(.+?)['’]?(?:y|n)?[ae]\s+ver|(.+?)['’]?(?:y|n)?[ae]\s+ata)$/) || m.match(/^(.*?)\s+(?:işinin|görevinin)\s+son\s+gün\S*\s+(.+?)\s+(?:yap|olsun|ertele)$/);
  if (isx) {
    const parca = isx[1];
    const adaylar = foyBul(liste, parca);
    const foylar = adaylar.length ? adaylar : bag ? [bag] : liste.filter(f => !f.ozel);
    const isler = foylar.flatMap(f => isEsle(f, parca).map(g => ({ f, g })));
    if (!isler.length) return cevap("Hangi işi kastettiğinizi bulamadım. İşin adından bir kelime ve dosyayı söyleyin.");
    if (isler.length > 1) return cevap(`${isler.length} iş buldum: ${isler.slice(0, 3).map(x => x.g.metin + ", " + foyKisa(x.f)).join("; ")}. Hangisi? Dosyayı da söyleyin.`);
    const { f, g } = isler[0];
    if (/son\s+gün/.test(m)) {
      const t = sesliTarih(isx[2], bugun).tarih;
      if (!t) return cevap("Yeni son günü anlayamadım. Örneğin: 20 Kasım ya da iki hafta sonra.");
      return onay(f, { gorevler: f.gorevler.map(x => (x.id === g.id ? { ...x, tarih: t } : x)) }, `"${g.metin}" işinin son gününü ${tarihSoyle(t)} yapayım mı?`);
    }
    if (/^(sil|kaldır)$/.test(isx[2])) return onay(f, { gorevler: f.gorevler.filter(x => x.id !== g.id), silinen: silineniNotEt(f, [g.id]) }, `"${g.metin}" işini, ${foyKisa(f)}, sileyim mi?`);
    const kim = isx[3] || isx[4] || "";
    const u = ortam.uyeler?.length ? (/^(bana|kendime)$/.test(kim) ? ortam.uyeler.find(x => x.kullanici_id === ortam.ben) : kisiBul(ortam.uyeler, kim)) : undefined;
    if (!u) return cevap(ortam.uyeler?.length ? `"${kim}" adında bir çalışan bulamadım.` : "Büro kurulmadığı için iş başkasına verilemiyor.");
    return onay(f, { gorevler: f.gorevler.map(x => (x.id === g.id ? { ...x, atanan: u.kullanici_id, atananAd: u.ad } : x)) }, `"${g.metin}" işini ${u.ad} adına vereyim mi?`);
  }
  // İş ekle, kişiye vererek: "Yılmaz dosyasına iş ekle tanık listesi ver Ayşe'ye ver" — ana ayrıştırıcı ekler; burada yok.
  void yeniGorevId;
  return null;
}
