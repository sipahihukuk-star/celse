// Büyük dosya derleme: yüzlerce evraklı bir dosya, güçlü modele gitmeden önce evrak evrak ayıklanır, özetlenir ve sıralanır.
//  1) Maskelenmiş toplu metin evraklara bölünür ("=== Evrak n: ad ===" başlıklarından).
//  2) Evraklar partiler hâlinde (her parti ~180.000 karakter, en çok 25 evrak) hızlı modele gider; çok büyük bir evrak parçalara bölünür.
//     Her evrak için bir kart döner: tür, tarih (ay-yıl), önem (0 gereksiz … 3 kilit), özet ve kilit noktalar.
//  3) Gereksiz evraklar (önem 0: tebligat, harç makbuzu, vekaletname, üst yazı…) çıkarılır; gerekliler önem ve tarih sırasına dizilir.
//  4) Derlenmiş dosya: kronolojik dizin + önem sırasıyla özetler + bütçe elverdiğince en önemli evrakların tam metni.
// Hacim sınırı evrak sayısına değil karaktere göredir. Saf TypeScript: telefonda, web'de ve testte aynı çalışır.

export const DOGRUDAN_SINIR = 120000; // bunun altındaki dosya derlemeden doğrudan gönderilir
export const PARTI_AZAMI = 180000;
export const PARTI_EVRAK = 25;
export const DERLENMIS_BUTCE = 200000; // notlar, izle ve oyna için gönderilen derlenmiş dosyanın azami boyu
export const DERLEME_KARAKTER_KREDI = 750000; // yaklaşık 250 sayfa = 1 kredi

export interface MaskeliEvrak { no: number; ad: string; metin: string }
export interface PartiEvrak { no: number; ad: string; parca?: string; metin: string }
export interface DerlemeKarti { no: number; ad: string; tur: string; tarih: string; onem: number; ozet: string; kilit: string[] }

const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export const derlemeKredisi = (karakter: number) => Math.max(1, Math.ceil(karakter / DERLEME_KARAKTER_KREDI));

/** Toplu maskelenmiş metni evraklara böler. Başlıksız tek metin tek evrak sayılır. */
export function evrakBol(masked: string): MaskeliEvrak[] {
  const re = /^=== Evrak (\d+)(?::\s?([^\n]*?))? ===$/gm;
  const out: MaskeliEvrak[] = [];
  const bas: { no: number; ad: string; i: number; j: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked))) bas.push({ no: +m[1], ad: (m[2] || "").trim() || "Evrak " + m[1], i: m.index, j: m.index + m[0].length });
  if (!bas.length) return masked.trim() ? [{ no: 1, ad: "Evrak 1", metin: masked.trim() }] : [];
  bas.forEach((b, k) => out.push({ no: b.no, ad: b.ad, metin: masked.slice(b.j, k + 1 < bas.length ? bas[k + 1].i : masked.length).trim() }));
  return out.filter(e => e.metin.length > 0);
}

/** Çok uzun evrakı paragraf sınırından parçalara böler. */
function parcala(e: MaskeliEvrak, azami: number): PartiEvrak[] {
  if (e.metin.length <= azami) return [e];
  const parcalar: string[] = [];
  let kalan = e.metin;
  while (kalan.length > azami) {
    let kes = kalan.lastIndexOf("\n", azami);
    if (kes < azami * 0.6) kes = azami;
    parcalar.push(kalan.slice(0, kes)); kalan = kalan.slice(kes).trimStart();
  }
  if (kalan) parcalar.push(kalan);
  return parcalar.map((metin, i) => ({ no: e.no, ad: e.ad, parca: `${i + 1}/${parcalar.length}`, metin }));
}

/** Evrakları hızlı modele gidecek partilere ayırır. */
export function partiler(evraklar: MaskeliEvrak[], azami = PARTI_AZAMI, enCok = PARTI_EVRAK): PartiEvrak[][] {
  const out: PartiEvrak[][] = [];
  let p: PartiEvrak[] = [], boy = 0;
  for (const e of evraklar) for (const x of parcala(e, azami)) {
    if (p.length && (boy + x.metin.length > azami || p.length >= enCok)) { out.push(p); p = []; boy = 0; }
    p.push(x); boy += x.metin.length;
  }
  if (p.length) out.push(p);
  return out;
}

/** Aynı evrakın parçalarından gelen kartları birleştirir; eksik kartı (model atladıysa) önem 1 ile tamamlar. */
export function kartlariBirlestir(evraklar: MaskeliEvrak[], gelen: Partial<DerlemeKarti>[]): DerlemeKarti[] {
  const byNo = new Map<number, DerlemeKarti>();
  for (const k of gelen) {
    const no = Number(k.no);
    const e = evraklar.find(x => x.no === no);
    if (!e) continue;
    const onem = Math.max(0, Math.min(3, Math.round(Number(k.onem) || 0)));
    const eski = byNo.get(no);
    if (!eski) byNo.set(no, { no, ad: e.ad, tur: String(k.tur || "Evrak").slice(0, 60), tarih: String(k.tarih || "").slice(0, 30), onem, ozet: String(k.ozet || "").slice(0, 2500), kilit: (k.kilit || []).map(String).slice(0, 8) });
    else {
      eski.onem = Math.max(eski.onem, onem);
      if (!eski.tarih && k.tarih) eski.tarih = String(k.tarih).slice(0, 30);
      if (k.ozet) eski.ozet = (eski.ozet + " " + String(k.ozet)).slice(0, 4000);
      eski.kilit = [...eski.kilit, ...(k.kilit || []).map(String)].slice(0, 10);
    }
  }
  for (const e of evraklar) if (!byNo.has(e.no)) byNo.set(e.no, { no: e.no, ad: e.ad, tur: "Evrak", tarih: "", onem: 1, ozet: e.metin.slice(0, 400), kilit: [] });
  return [...byNo.values()];
}

/** "[Ekim 2026]" ya da "Ekim 2026" → sıralama anahtarı (yoksa çok büyük sayı: sona). */
export function tarihAnahtari(s: string): number {
  const m = s.match(new RegExp(`(${AYLAR.join("|")})\\s+((?:19|20)\\d{2})`));
  if (m) return +m[2] * 12 + AYLAR.indexOf(m[1]);
  const y = s.match(/(?:19|20)\d{2}/);
  return y ? +y[0] * 12 + 11 : 1e9;
}

/** Önem (büyükten küçüğe), sonra tarih (eskiden yeniye). */
export const onemSirasi = (a: DerlemeKarti, b: DerlemeKarti) => b.onem - a.onem || tarihAnahtari(a.tarih) - tarihAnahtari(b.tarih) || a.no - b.no;
export const tarihSirasi = (a: DerlemeKarti, b: DerlemeKarti) => tarihAnahtari(a.tarih) - tarihAnahtari(b.tarih) || a.no - b.no;
const ONEM = ["gereksiz", "yardımcı", "önemli", "kilit"];

/** Derlenmiş dosya metni: dizin, özetler ve bütçe elverdiğince tam metinler. onemliler: avukatın tam metin istediği evraklar. */
export function derlenmisMetin(evraklar: MaskeliEvrak[], kartlar: DerlemeKarti[], onemliler: Set<number>, butce = DERLENMIS_BUTCE): string {
  const ilgili = kartlar.filter(k => k.onem > 0 || onemliler.has(k.no));
  const cikan = kartlar.length - ilgili.length;
  const L: string[] = [];
  L.push(`DERLENMİŞ DOSYA: ${kartlar.length} evrak; ${cikan} evrak uyuşmazlığın esasına katkısı olmadığı için (tebligat, harç, vekaletname, üst yazı gibi) çıkarıldı.`);
  L.push("", "KRONOLOJİK DİZİN");
  for (const k of [...ilgili].sort(tarihSirasi)) L.push(`- ${k.tarih || "tarihsiz"} · ${k.tur} (Evrak ${k.no}) · ${ONEM[k.onem]}`);
  L.push("", "EVRAK ÖZETLERİ (önem sırasıyla)");
  // Özetler bütçenin %80'ini aşmasın: sığmayanların önemlileri kısaltılır, yardımcılar yalnız başlıkla anılır.
  let boy = L.join("\n").length;
  for (const k of [...ilgili].sort(onemSirasi)) {
    const bas = `### Evrak ${k.no} · ${k.tur} · ${k.tarih || "tarihsiz"} · ${ONEM[k.onem]}`;
    const tam = ["", bas, k.ozet, ...k.kilit.map(x => "• " + x)].join("\n");
    const parca = boy + tam.length <= butce * 0.8 ? tam : k.onem >= 2 ? ["", bas, k.ozet.slice(0, 300)].join("\n") : "\n" + bas;
    L.push(parca); boy += parca.length + 1;
  }
  let metin = L.join("\n");
  // Tam metinler: önce avukatın işaretledikleri, sonra kilit (3) evraklar; bütçe dolana kadar.
  const sira = [...ilgili].sort((a, b) => (onemliler.has(b.no) ? 1 : 0) - (onemliler.has(a.no) ? 1 : 0) || onemSirasi(a, b));
  const tam: string[] = [];
  for (const k of sira) {
    if (!onemliler.has(k.no) && k.onem < 3) continue;
    const e = evraklar.find(x => x.no === k.no);
    if (!e) continue;
    const parca = `\n\n### Evrak ${k.no} · ${k.tur} · TAM METİN\n${e.metin}`;
    if (metin.length + tam.join("").length + parca.length > butce) continue;
    tam.push(parca);
  }
  if (tam.length) metin += "\n\nÖNEMLİ EVRAKLARIN TAM METNİ" + tam.join("");
  return metin.slice(0, butce);
}
