// Föyler arası bağlantı önerileri (cihazda; yapay zekâya hiçbir şey gitmez). Yükleme ya da aktarma sonrası hangi dosyaların
// birbiriyle ilgili olduğunu bulur:
//  - zincir: biri ötekinin devamı (arabuluculuk → hukuk davası, soruşturma → ceza davası, idari başvuru → idari dava, dava → icra…)
//  - ilgili: aynı taraflar arasındaki öteki dosyalar (karşı dava, birleşen dosya, aynı kira ilişkisinden alacak ve tahliye…)
//  - ayni: aynı mahkeme ve esas no ile iki föy (iki kez açılmış olabilir)
//  - evrak: bir föydeki evrak başka bir föyün dosya numarasını taşıyor (yanlış föye eklenmiş olabilir)
// İşaretler: bir föyün dosya numarasının ötekinin evrakında geçmesi, aynı kimlik no, aynı müvekkil ve karşı taraf adı, tür sırası.
// Gerçek adlar ve kimlik numaraları kullanıldığı için bu iş bilinçli olarak cihazda yapılır.
import type { Foy, FoyEvrak } from "./foy";
import { turBilgi } from "./foyTurleri";
import { kunyeCikar } from "./kunyeCikar";

export type OneriTur = "zincir" | "ilgili" | "ayni" | "evrak" | "grup";
export interface IliskiOnerisi {
  anahtar: string; tur: OneriTur; puan: number; nedenler: string[];
  /** zincirde önceki dosya; ilgili/ayni için birinci föy */
  a: Foy; b: Foy;
  /** tur "evrak": a'daki bu evrak b'ye ait olabilir */
  evrak?: FoyEvrak;
  /** tur "grup": aynı taraflı üç ya da daha çok föy (çift çift tekrar tekrar önerilmesin diye tek öneri) */
  grup?: Foy[];
  /** grubun içindeki çift önerilerinin anahtarları ("Değil" denince hepsi reddedilir) */
  ciftler?: string[];
  /** grup: aynı türde, numarasız ya da aynı numaralı, aynı taraflı föyler: aynı dosyanın kopyaları olabilir */
  kopya?: boolean;
}

const EKLER = new Set(["diğeri", "diğerleri", "digeri", "digerleri", "av", "avukat", "aş", "aş", "as", "a", "ş", "ltd", "şti", "sti", "limited", "anonim", "şirketi", "sirketi", "ve", "tic", "san"]);
/** Ad karşılaştırması için: küçük harf, noktalama yok, şirket ekleri (A.Ş., Ltd. Şti.) ve "Av." atılır. */
const sade = (x?: string) => (x || "").toLocaleLowerCase("tr").replace(/[^\p{L}\d]+/gu, " ").split(" ").filter(w => w && !EKLER.has(w)).join(" ");
const esasSade = (x?: string) => (x || "").replace(/\s+/g, "").replace(/[^\d/]/g, "");
const ESAS = /(?:19|20)\d{2}\s*\/\s*\d{2,7}/g;

/** Esas no karşılaştırması: "2023/0311 E." ile "2023/311" aynıdır. */
export const esasNorm = (x?: string) => { const m = (x || "").match(/((?:19|20)\d{2})\s*[/\-.]\s*0*(\d{1,7})/); return m ? m[1] + "/" + m[2] : ""; };
/** Merci karşılaştırması: "Bismil 2. Asliye Hukuk Mahkemesi Sayın Hakimliği" ile "Bismil 2. Asliye Hukuk Mahkemesi" aynıdır. */
export const merciSade = (x?: string) => sade(x).replace(/\b(sayın|hakimliği|hâkimliği|mahkemesi|mahkemesine|mahkemesi'ne|başkanlığı|başkanlığına|müdürlüğü|müdürlüğüne)\b/g, " ").replace(/\s+/g, " ").trim();
/** İki merci adı: aynı mı, çelişiyor mu, yoksa biri yazılı değil mi? */
export function merciUyumu(a?: string, b?: string): "ayni" | "celisir" | "bilinmiyor" {
  const x = merciSade(a), y = merciSade(b);
  if (!x || !y) return "bilinmiyor";
  return x === y || x.includes(y) || y.includes(x) ? "ayni" : "celisir";
}
/** Ad karşılaştırması için sadeleştirme (küçük harf, noktalama ve şirket ekleri atılır). */
export const adSade = (x?: string) => sade(x);
const kelimeler = (x: string) => x.split(" ").filter(w => w.length >= 4);
const adTutar = (a: string, b: string) => !!a && !!b && (a === b || kelimeler(a).some(w => kelimeler(b).includes(w)));
const adCelisir = (a: string, b: string) => !!a && !!b && !adTutar(a, b);
/**
 * İki föy aynı dosya mı? Esas no aynı (baştaki sıfırlar, "E." yok sayılır) ve hiçbir bilgi çelişmiyor (merci, müvekkil, karşı taraf
 * yazılıysa uyumlu) ve en az bir olumlu işaret var (aynı merci, aynı müvekkil ya da aynı karşı taraf). Şahsi ile büro föyü birleşmez.
 */
export function ayniDosyaMi(x: Foy, y: Foy): string[] | null {
  if (!!x.ozel !== !!y.ozel) return null;
  const ex = esasNorm(x.esasNo);
  if (!ex || ex !== esasNorm(y.esasNo)) return null;
  const mx = merciSade(x.mahkeme), my = merciSade(y.mahkeme);
  const merciAyni = !!mx && !!my && (mx === my || mx.includes(my) || my.includes(mx));
  if (mx && my && !merciAyni) return null;
  const ax = { m: sade(x.muvekkil), k: sade(x.karsiTaraf) }, ay = { m: sade(y.muvekkil), k: sade(y.karsiTaraf) };
  if (adCelisir(ax.m, ay.m) || adCelisir(ax.k, ay.k)) return null;
  const neden: string[] = ["aynı esas no (" + ex + ")"];
  if (merciAyni) neden.push("aynı merci");
  if (adTutar(ax.m, ay.m)) neden.push("aynı müvekkil");
  if (adTutar(ax.k, ay.k)) neden.push("aynı karşı taraf");
  return neden.length >= 2 ? neden : null;
}

/** İki föyün bilgileri çelişiyor mu (merci ya da taraf adı yazılı ve farklı)? Gruplarda zincirleme yanlış birleşmeyi önler. */
function celisir(x: Foy, y: Foy): boolean {
  const mx = merciSade(x.mahkeme), my = merciSade(y.mahkeme);
  if (mx && my && !(mx === my || mx.includes(my) || my.includes(mx))) return true;
  return adCelisir(sade(x.muvekkil), sade(y.muvekkil)) || adCelisir(sade(x.karsiTaraf), sade(y.karsiTaraf));
}

/** Bütün listede aynı dosyanın birden çok föyü: gruplar (her grup tek föyde birleştirilebilir). */
export function ayniGruplari(liste: Foy[], reddedilen: Set<string> = new Set()): { foyler: Foy[]; nedenler: string[] }[] {
  const esas = new Map<string, number[]>();
  liste.forEach((f, i) => { const e = esasNorm(f.esasNo); if (e) esas.set(e, [...(esas.get(e) || []), i]); });
  const ata = liste.map((_x, i) => i);
  const kok = (i: number): number => (ata[i] === i ? i : (ata[i] = kok(ata[i])));
  const neden = new Map<number, Set<string>>();
  for (const xs of esas.values()) {
    if (xs.length < 2 || xs.length > 60) continue;
    for (let p = 0; p < xs.length; p++) for (let q = p + 1; q < xs.length; q++) {
      const x = liste[xs[p]], y = liste[xs[q]];
      if (reddedilen.has(ciftAnahtari(x.id, y.id, "ayni"))) continue;
      const n = ayniDosyaMi(x, y);
      if (!n) continue;
      const a = kok(xs[p]), b = kok(xs[q]);
      if (a !== b && xs.some(i => kok(i) === a && xs.some(j => kok(j) === b && celisir(liste[i], liste[j])))) continue;
      if (a !== b) { ata[b] = a; neden.set(a, new Set([...(neden.get(a) || []), ...(neden.get(b) || []), ...n])); }
      else neden.set(a, new Set([...(neden.get(a) || []), ...n]));
    }
  }
  const gruplar = new Map<number, Foy[]>();
  liste.forEach((f, i) => { const k = kok(i); if (k !== i || neden.has(k)) gruplar.set(k, [...(gruplar.get(k) || []), f]); });
  return [...gruplar.entries()].filter(([, fs]) => fs.length > 1).map(([k, fs]) => ({ foyler: fs, nedenler: [...(neden.get(k) || [])] }));
}

// Evrak metinleri taranırken bulunanlar föyün kimliği ve güncelleme zamanına göre saklanır: föy listesi her yenilendiğinde
// (eşitleme, kayıt) binlerce evrak baştan taranmasın (telefonda ekran açılırken donmanın asıl sebebi buydu).
const numOnbellek = new Map<string, Set<string>>();
const kunyeOnbellek = new Map<string, { esasNo?: string; mahkeme?: string }>();
const sinirla = <K, V>(m: Map<K, V>) => { if (m.size > 30000) m.clear(); };
function numaralar(f: Foy): Set<string> {
  const ok = f.id + "|" + f.guncelleme;
  const eski = numOnbellek.get(ok);
  if (eski) return eski;
  const s = numaralarHam(f);
  sinirla(numOnbellek); numOnbellek.set(ok, s);
  return s;
}
/** Evrak başlığındaki künye (esas no, merci); evrak değişmediği sürece bir kez okunur. */
function evrakKunyesi(ev: { id: string; metin: string }): { esasNo?: string; mahkeme?: string } {
  const ok = ev.id + "|" + ev.metin.length;
  let x = kunyeOnbellek.get(ok);
  if (!x) {
    const bas = ev.metin.slice(0, 4000);
    // Başlıkta yıl/numara biçiminde bir numara yoksa künye okumaya gerek yok (en pahalı adım).
    if (!/(?:19|20)\d{2}\s*\/\s*\d/.test(bas)) x = {};
    else { const o = kunyeCikar(bas); x = { esasNo: o.esasNo, mahkeme: o.mahkeme }; }
    sinirla(kunyeOnbellek); kunyeOnbellek.set(ok, x);
  }
  return x;
}
/**
 * Öneriler hesaplanmadan önce evrak taraması küçük parçalar hâlinde, aralarda ekrana nefes aldırarak yapılır
 * (telefonda binlerce evrakta ekran donmasın). Bittikten sonra iliskiOner önbellekten hızlı çalışır.
 */
export async function iliskiHazirla(liste: Foy[], iptal?: () => boolean): Promise<void> {
  let bas = Date.now();
  const nefes = async () => { if (Date.now() - bas > 25) { await new Promise(ok => setTimeout(ok, 0)); bas = Date.now(); } };
  for (const f of liste) {
    if (iptal?.()) return;
    numaralar(f); await nefes();
    if (esasSade(f.esasNo).length < 6) continue;
    for (const ev of f.evraklar) { if (ev.metin && ev.metin.trim()) { evrakKunyesi(ev); await nefes(); if (iptal?.()) return; } }
  }
}
function numaralarHam(f: Foy): Set<string> {
  const s = new Set<string>();
  for (const e of f.evraklar) for (const m of (e.metin || "").matchAll(ESAS)) s.add(esasSade(m[0]));
  for (const m of (f.notlar || "").matchAll(ESAS)) s.add(esasSade(m[0]));
  return s;
}
const kimlikler = (f: Foy) => new Set([f.muvekkilBilgi?.kimlikNo, f.karsiBilgi?.kimlikNo].map(x => (x || "").replace(/\D/g, "")).filter(x => x.length >= 10));
const tarih = (f: Foy) => f.evraklar.map(e => e.eklenme).sort()[0] || f.olusturma;
export const ciftAnahtari = (a: string, b: string, tur: string) => [a, b].sort().join("|") + "|" + tur;

export function iliskiOner(liste: Foy[], reddedilen: Set<string>, sinir = 50): IliskiOnerisi[] {
  const out: IliskiOnerisi[] = [];
  const nums = new Map(liste.map(f => [f.id, numaralar(f)] as const));
  const kims = new Map(liste.map(f => [f.id, kimlikler(f)] as const));
  // Binlerce föyde bütün çiftleri karşılaştırmak yerine yalnız ortak bir işareti olan çiftlere bakılır
  // (aynı esas no, birinin numarası ötekinin evrakında, aynı kimlik, aynı ad).
  const sadeAd = new Map(liste.map(f => [f.id, { m: sade(f.muvekkil), k: sade(f.karsiTaraf) }] as const));
  const dizin = new Map<string, number[]>();
  const koy = (anahtar: string, i: number) => { const a = dizin.get(anahtar); if (a) { if (a[a.length - 1] !== i) a.push(i); } else dizin.set(anahtar, [i]); };
  liste.forEach((f, i) => {
    const e = esasSade(f.esasNo); if (e.length >= 6) koy("e:" + e, i);
    const en = esasNorm(f.esasNo); if (en) koy("n:" + en, i);
    for (const n of nums.get(f.id)!) koy("e:" + n, i);
    for (const k of kims.get(f.id)!) koy("k:" + k, i);
    const a = sadeAd.get(f.id)!;
    if (a.m.length >= 5) koy("a:" + a.m, i);
    if (a.k.length >= 5) koy("a:" + a.k, i);
  });
  const ciftler = new Set<number>();
  const N = liste.length;
  for (const xs of dizin.values()) {
    if (xs.length < 2 || xs.length > 400) continue; // çok yaygın bir ad ya da numara işaret sayılmaz
    for (let p = 0; p < xs.length; p++) for (let q = p + 1; q < xs.length; q++) ciftler.add(Math.min(xs[p], xs[q]) * N + Math.max(xs[p], xs[q]));
  }
  // Zaten bağlı olanlar (doğrudan ya da zincirleme: A–B ve B–C bağlıysa A–C de önerilmez).
  const kok = new Map<string, string>();
  const bul = (id: string): string => { let x = id; while (kok.has(x) && kok.get(x) !== x) x = kok.get(x)!; return x; };
  const birles = (a: string, b: string) => { const ra = bul(a), rb = bul(b); if (ra !== rb) kok.set(ra, rb); };
  const varIds = new Set(liste.map(f => f.id));
  for (const f of liste) {
    if (f.oncekiId && varIds.has(f.oncekiId)) birles(f.id, f.oncekiId);
    for (const g of f.ilgiliIds || []) if (varIds.has(g)) birles(f.id, g);
  }
  const bagli = (x: Foy, y: Foy) => bul(x.id) === bul(y.id);
  for (const c of ciftler) {
    const i = Math.floor(c / N), j = c % N;
    const x = liste[i], y = liste[j];
    if (bagli(x, y)) continue;
    const ex = esasSade(x.esasNo), ey = esasSade(y.esasNo);
    // Aynı esas no ve çelişmeyen merci / taraflar: iki kez açılmış olabilir.
    const ayni = ayniDosyaMi(x, y) || numarasizKopya(x, y);
    if (ayni) {
      const k = ciftAnahtari(x.id, y.id, "ayni");
      if (!reddedilen.has(k)) out.push({ anahtar: k, tur: "ayni", puan: 10, nedenler: ayni, a: x, b: y });
      continue;
    }
    let puan = 0; const nedenler: string[] = [];
    if (ex.length >= 6 && ex !== ey && nums.get(y.id)!.has(ex)) { puan += 3; nedenler.push(`${x.esasNo} numarası öteki föyün evrakında geçiyor`); }
    if (ey.length >= 6 && ex !== ey && nums.get(x.id)!.has(ey)) { puan += 3; nedenler.push(`${y.esasNo} numarası öteki föyün evrakında geçiyor`); }
    const kx = kims.get(x.id)!, ky = kims.get(y.id)!;
    if ([...kx].some(k => ky.has(k))) { puan += 4; nedenler.push("aynı kimlik / vergi no"); }
    const ax = sadeAd.get(x.id)!, ay = sadeAd.get(y.id)!;
    const es = (a: string, b: string) => a.length >= 5 && a === b;
    if (es(ax.m, ay.m)) { puan += 2; nedenler.push("aynı müvekkil"); }
    if (es(ax.k, ay.k)) { puan += 2; nedenler.push("aynı karşı taraf"); }
    else if (es(ax.m, ay.k) || es(ax.k, ay.m)) { puan += 1; nedenler.push("taraflar yer değiştirmiş (karşı dava olabilir)"); }
    const tx = turBilgi(x.tur), ty = turBilgi(y.tur);
    const xOnce = tx.sonraki.includes(y.tur || "hukuk"), yOnce = ty.sonraki.includes(x.tur || "hukuk");
    const zincir = xOnce || yOnce;
    if (zincir) puan += 1;
    // Yalnız aynı müvekkil yetmez; en az iki güçlü işaret gerekir.
    if (puan < 4) continue;
    let [a, b] = [x, y];
    if (zincir) {
      if (xOnce && !yOnce) [a, b] = [x, y];
      else if (yOnce && !xOnce) [a, b] = [y, x];
      else [a, b] = tarih(x) <= tarih(y) ? [x, y] : [y, x];
    }
    if (zincir) nedenler.push(`${turBilgi(a.tur).ad} → ${turBilgi(b.tur).ad} sırası uygun`);
    const tur: OneriTur = zincir && !b.oncekiId ? "zincir" : "ilgili";
    const k = ciftAnahtari(a.id, b.id, tur);
    if (!reddedilen.has(k)) out.push({ anahtar: k, tur, puan, nedenler, a, b });
  }
  // Yanlış föye eklenmiş evrak: evrakın kendi başlığındaki esas no başka bir föyünkiyle aynı.
  const esasFoy = new Map<string, Foy[]>();
  for (const f of liste) { const e = esasSade(f.esasNo); if (e.length >= 6) esasFoy.set(e, [...(esasFoy.get(e) || []), f]); }
  for (const f of liste) {
    const kendi = esasSade(f.esasNo);
    if (kendi.length < 6) continue;
    for (const ev of f.evraklar) {
      if (!ev.metin || !ev.metin.trim()) continue;
      const o = evrakKunyesi(ev);
      const e = esasSade(o.esasNo);
      if (e.length < 6 || e === kendi) continue;
      // Evrakın başlığında merci de olmalı ve hedef föyünkiyle aynı olmalı (metinde geçen başka bir dosya numarası yetmez).
      if (!o.mahkeme) continue;
      const hedef = (esasFoy.get(e) || []).filter(h => h.id !== f.id && (!h.mahkeme || sade(o.mahkeme) === sade(h.mahkeme)));
      if (hedef.length !== 1) continue;
      const k = ciftAnahtari(f.id, hedef[0].id, "evrak:" + ev.id);
      if (!reddedilen.has(k)) out.push({ anahtar: k, tur: "evrak", puan: 6, nedenler: [`evrakın başlığındaki dosya no ${o.esasNo}`], a: f, b: hedef[0], evrak: ev });
    }
  }
  return gruplaOneriler(out).sort((p, q) => q.puan - p.puan).slice(0, sinir);
}

/** Numarası yazılmamış iki föy aynı türde ve tarafları aynıysa (ör. iki kez açılmış icra takibi) aynı dosya olabilir. */
function numarasizKopya(x: Foy, y: Foy): string[] | null {
  if (!!x.ozel !== !!y.ozel || (x.tur || "hukuk") !== (y.tur || "hukuk")) return null;
  if (esasSade(x.esasNo) || esasSade(y.esasNo)) return null;
  const ax = { m: sade(x.muvekkil), k: sade(x.karsiTaraf) }, ay = { m: sade(y.muvekkil), k: sade(y.karsiTaraf) };
  // Ad tam aynı olmayabilir ("X" ile "X ve 1 diğeri"): ortak sözcük yeter; ikisi de yazılı olmalı.
  if (ax.m.length < 5 || ax.k.length < 5 || ay.m.length < 5 || ay.k.length < 5 || !adTutar(ax.m, ay.m) || !adTutar(ax.k, ay.k)) return null;
  const mx = merciSade(x.mahkeme), my = merciSade(y.mahkeme);
  if (mx && my && mx !== my) return null;
  return ["numarası yazılmamış", "aynı tür (" + turBilgi(x.tur).ad + ")", "aynı müvekkil", "aynı karşı taraf"];
}

/** Üç ya da daha çok föy birbirine çift çift öneriliyorsa (ör. aynı taraflı 10 icra föyü: 45 öneri) tek "grup" önerisi olur. */
function gruplaOneriler(out: IliskiOnerisi[]): IliskiOnerisi[] {
  const sonuc = out.filter(o => o.tur === "evrak" || o.tur === "zincir");
  // "Aynı dosya" ve "ilgili" öneriler ayrı gruplanır (birleştirme ile bağlama karışmasın).
  for (const tur of ["ayni", "ilgili"] as const) {
  const cift = out.filter(o => o.tur === tur);
  const kok = new Map<string, string>();
  const bul = (id: string): string => { let x = id; while (kok.has(x) && kok.get(x) !== x) x = kok.get(x)!; return x; };
  for (const o of cift) { const ra = bul(o.a.id), rb = bul(o.b.id); if (ra !== rb) kok.set(ra, rb); }
  const gruplar = new Map<string, IliskiOnerisi[]>();
  for (const o of cift) { const r = bul(o.a.id); gruplar.set(r, [...(gruplar.get(r) || []), o]); }
  for (const xs of gruplar.values()) {
    const foyler = new Map<string, Foy>();
    for (const o of xs) { foyler.set(o.a.id, o.a); foyler.set(o.b.id, o.b); }
    if (foyler.size < 3) { sonuc.push(...xs); continue; }
    const grup = [...foyler.values()].sort((a, b) => (a.foyNo || "").localeCompare(b.foyNo || "", "tr", { numeric: true }));
    const kopya = xs.every(o => o.tur === "ayni");
    const nedenler = [...new Set(xs.flatMap(o => o.nedenler).filter(n => !/^aynı esas no/.test(n)))].slice(0, 5);
    sonuc.push({ anahtar: "grup|" + tur + "|" + grup.map(f => f.id).sort().join("|"), tur: "grup", puan: Math.max(...xs.map(o => o.puan)), nedenler, a: grup[0], b: grup[1], grup, ciftler: xs.map(o => o.anahtar), kopya });
  }
  }
  return sonuc;
}

/** Föyün müvekkilinin ve karşı tarafının öteki dosyaları (ad ya da kimlik no aynı; müvekkil başka dosyada karşı taraf
 *  olarak da geçebilir). Şahsi föyler dahil değil. */
export function kisiDosyalari(liste: Foy[], f: Foy): { muvekkil: Foy[]; karsi: Foy[] } {
  const ayni = (ad: string, kimlik: string | undefined, x: Foy) => {
    const s = sade(ad);
    const k = (kimlik || "").replace(/\D/g, "");
    return (!!s && s.split(" ").length >= 1 && s.length >= 4 && (sade(x.muvekkil) === s || sade(x.karsiTaraf) === s))
      || (k.length >= 10 && [x.muvekkilBilgi?.kimlikNo, x.karsiBilgi?.kimlikNo].some(y => (y || "").replace(/\D/g, "") === k));
  };
  const diger = liste.filter(x => x.id !== f.id && !x.ozel);
  const sirala = (xs: Foy[]) => xs.sort((a, b) => (a.durum === b.durum ? (b.acilis || b.olusturma).localeCompare(a.acilis || a.olusturma) : a.durum === "acik" ? -1 : 1));
  return {
    muvekkil: f.muvekkil.trim() ? sirala(diger.filter(x => ayni(f.muvekkil, f.muvekkilBilgi?.kimlikNo, x))) : [],
    karsi: f.karsiTaraf.trim() ? sirala(diger.filter(x => ayni(f.karsiTaraf, f.karsiBilgi?.kimlikNo, x))) : []
  };
}
