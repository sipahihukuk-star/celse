// Sesle (ya da yazarak) söylenen cümleden yapılacak iş çıkarır: "yarın bilirkişi raporuna itiraz et",
// "üç gün içinde masraf yatır, ayrıca cuma günü müvekkili ara" → iki iş, son günleriyle. Ağ yok; tamamen cihazda çalışır.

export interface SesliIs { metin: string; tarih?: string }

const SAYI: Record<string, number> = {
  bir: 1, iki: 2, üç: 3, uc: 3, dört: 4, dort: 4, beş: 5, bes: 5, altı: 6, alti: 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10,
  "on bir": 11, "on iki": 12, "on beş": 15, "on bes": 15, yirmi: 20, "yirmi bir": 21, otuz: 30, kırk: 40, kirk: 40, "kırk beş": 45, altmış: 60,
};
const AYLAR = ["ocak", "şubat", "mart", "nisan", "mayıs", "haziran", "temmuz", "ağustos", "eylül", "ekim", "kasım", "aralık"];
const GUNLER = ["pazar", "pazartesi", "salı", "çarşamba", "perşembe", "cuma", "cumartesi"];

const isoGun = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const yerel = (s: string) => { const [y, a, g] = s.slice(0, 10).split("-").map(Number); return new Date(y, a - 1, g); };
const kucuk = (s: string) => s.toLocaleLowerCase("tr");

const SAYI_RE = "(\\d{1,3}|" + Object.keys(SAYI).sort((a, b) => b.length - a.length).join("|") + ")";
const sayiOku = (x: string) => (/^\d+$/.test(x) ? Number(x) : SAYI[kucuk(x)] || 0);

// JavaScript'in \b'si Türkçe harfleri (ı, ş, ü…) kelime saymaz; bunun yerine Unicode harflerine göre sınır.
const SINIR = "(?:(?<![\\p{L}\\d])(?=[\\p{L}\\d])|(?<=[\\p{L}\\d])(?![\\p{L}\\d]))";
const rx = (r: RegExp | string, bayrak = "iu") => new RegExp((typeof r === "string" ? r : r.source).split("\\b").join(SINIR), bayrak);

interface Kural { re: RegExp; gun: (m: RegExpMatchArray, bugun: Date) => Date | undefined }
const ekle = (d: Date, gun = 0, ay = 0) => new Date(d.getFullYear(), d.getMonth() + ay, d.getDate() + gun);

const KURALLAR: Kural[] = [
  // 12.03.2027, 12/3, 12.03
  { re: rx(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?:'?(?:e|a|ye|ya)\b)?(?:\s+(?:tarihine|tarihinde|tarihe))?(?:\s+kadar)?\b/i), gun: (m, b) => {
    const g = +m[1], a = +m[2]; if (a < 1 || a > 12 || g < 1 || g > 31) return undefined;
    let y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : b.getFullYear();
    let d = new Date(y, a - 1, g); if (!m[3] && d < b) { y++; d = new Date(y, a - 1, g); } return d;
  } },
  // 12 Aralık (2026)
  { re: rx("\\b(\\d{1,2})\\s+(" + AYLAR.join("|") + ")(?:\\s+(\\d{4}))?(?:'?(?:a|e|ya|ye|da|de|ta|te))?(?:\\s+(?:tarihine|günü))?(?:\\s+kadar)?"), gun: (m, b) => {
    const a = AYLAR.indexOf(kucuk(m[2])); let d = new Date(m[3] ? +m[3] : b.getFullYear(), a, +m[1]);
    if (!m[3] && d < b) d = new Date(b.getFullYear() + 1, a, +m[1]); return d;
  } },
  // N gün / hafta / ay sonra · içinde · içerisinde
  { re: rx("\\b" + SAYI_RE + "\\s+(gün|hafta|ay)(?:\\s+(?:sonra|içinde|içerisinde|zarfında|süre\\s+içinde))?(?:\\s+(?:sonra|kadar))?"), gun: (m, b) => {
    const n = sayiOku(m[1]); if (!n) return undefined; const k = kucuk(m[2]);
    return k === "ay" ? ekle(b, 0, n) : ekle(b, k === "hafta" ? n * 7 : n);
  } },
  { re: rx(/\b(?:bu\s+)?ay\s+sonuna\s+kadar\b|\bay\s+sonu(?:nda)?\b/iu), gun: (_m, b) => new Date(b.getFullYear(), b.getMonth() + 1, 0) },
  { re: rx(/\bhafta\s+sonuna\s+kadar\b|\bbu\s+hafta\b/iu), gun: (_m, b) => ekle(b, (5 - b.getDay() + 7) % 7) },
  { re: rx(/\bhaftaya\b|\bgelecek\s+hafta\b|\bönümüzdeki\s+hafta\b/iu), gun: (_m, b) => ekle(b, 7) },
  { re: rx(/\bgelecek\s+ay\b|\bönümüzdeki\s+ay\b/iu), gun: (_m, b) => ekle(b, 0, 1) },
  { re: rx(/\b(?:öbür|öbürsü|ertesi)\s*gün\b/iu), gun: (_m, b) => ekle(b, 2) },
  { re: rx(/\byarın(?:a\s+kadar|dan\s+sonra)?\b/iu), gun: (_m, b) => ekle(b, 1) },
  { re: rx(/\bbugün(?:\s+içinde)?\b/iu), gun: (_m, b) => b },
  // (gelecek / haftaya) pazartesi (günü) (ye kadar)
  { re: rx("\\b(gelecek\\s+|haftaya\\s+|önümüzdeki\\s+)?(" + GUNLER.slice().sort((a, b) => b.length - a.length).join("|") + ")(?:'?(?:ya|ye|a|e))?(?:\\s+günü)?(?:ne|e)?(?:\\s+kadar)?\\b"), gun: (m, b) => {
    const h = GUNLER.indexOf(kucuk(m[2])); let fark = (h - b.getDay() + 7) % 7; if (fark === 0) fark = 7; if (m[1]) fark += fark < 7 ? 7 : 0;
    return ekle(b, fark);
  } },
];

/** Söylenen metni tek tek işlere böler ("ayrıca", "bir de", "sonra da", satır, nokta, noktalı virgül). */
export function cumleler(metin: string): string[] {
  return metin
    .replace(/\s+/g, " ")
    .split(/[\n;]+|\.\s+|\s+(?:ayrıca|bir de|sonra da|bunun dışında|ek olarak)\s+/iu)
    .map(x => x.replace(/^[\s,.-]+|[\s,.-]+$/g, "").replace(/^(?:ve|ayrıca|bir de)\s+/iu, ""))
    .filter(x => x.length >= 3);
}

/** Bir cümleden işi ve son gününü çıkarır; tarih ifadesi işin metninden silinir. */
export function cumledenIs(cumle: string, bugun: string): SesliIs {
  const b = yerel(bugun);
  let metin = cumle;
  let tarih: string | undefined;
  for (const k of KURALLAR) {
    const m = metin.match(k.re);
    if (!m) continue;
    const d = k.gun(m, b);
    if (!d) continue;
    tarih = isoGun(d);
    metin = (metin.slice(0, m.index) + " " + metin.slice((m.index || 0) + m[0].length));
    break;
  }
  metin = metin
    .replace(rx(/\b(?:son\s+gün(?:ü)?|en\s+geç|kadar|içinde)\b/, "giu"), " ")
    .replace(/^(?:lütfen\s+)?(?:iş\s+ekle|yapılacak(?:lara)?\s+(?:ekle|yaz)|not\s+al|hatırlat)\s*[:,]?\s*/iu, "")
    .replace(/\s*(?:diye\s+(?:iş\s+)?(?:ekle|yaz|not\s+al|hatırlat|kaydet)|(?:iş\s+olarak|işlere|yapılacaklara)\s+(?:ekle|yaz|kaydet))\s*$/iu, "")
    .replace(/\s+([,.])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.:-]+|[\s,.:-]+$/g, "");
  if (metin) metin = metin.charAt(0).toLocaleUpperCase("tr") + metin.slice(1);
  return { metin, tarih };
}

/** Söylenen bütün metinden iş listesi. */
export function sestenIsler(metin: string, bugun: string): SesliIs[] {
  return cumleler(metin).map(c => cumledenIs(c, bugun)).filter(x => x.metin.length >= 3);
}
