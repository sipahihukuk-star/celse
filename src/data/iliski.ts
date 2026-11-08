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

export type OneriTur = "zincir" | "ilgili" | "ayni" | "evrak";
export interface IliskiOnerisi {
  anahtar: string; tur: OneriTur; puan: number; nedenler: string[];
  /** zincirde önceki dosya; ilgili/ayni için birinci föy */
  a: Foy; b: Foy;
  /** tur "evrak": a'daki bu evrak b'ye ait olabilir */
  evrak?: FoyEvrak;
}

const EKLER = new Set(["av", "avukat", "aş", "aş", "as", "a", "ş", "ltd", "şti", "sti", "limited", "anonim", "şirketi", "sirketi", "ve", "tic", "san"]);
/** Ad karşılaştırması için: küçük harf, noktalama yok, şirket ekleri (A.Ş., Ltd. Şti.) ve "Av." atılır. */
const sade = (x?: string) => (x || "").toLocaleLowerCase("tr").replace(/[^\p{L}\d]+/gu, " ").split(" ").filter(w => w && !EKLER.has(w)).join(" ");
const esasSade = (x?: string) => (x || "").replace(/\s+/g, "").replace(/[^\d/]/g, "");
const ESAS = /(?:19|20)\d{2}\s*\/\s*\d{2,7}/g;

function numaralar(f: Foy): Set<string> {
  const s = new Set<string>();
  for (const e of f.evraklar) for (const m of (e.metin || "").matchAll(ESAS)) s.add(esasSade(m[0]));
  for (const m of (f.notlar || "").matchAll(ESAS)) s.add(esasSade(m[0]));
  return s;
}
const kimlikler = (f: Foy) => new Set([f.muvekkilBilgi?.kimlikNo, f.karsiBilgi?.kimlikNo].map(x => (x || "").replace(/\D/g, "")).filter(x => x.length >= 10));
const ayniAd = (x?: string, y?: string) => { const a = sade(x), b = sade(y); return a.length >= 5 && a === b; };
const tarih = (f: Foy) => f.evraklar.map(e => e.eklenme).sort()[0] || f.olusturma;
export const ciftAnahtari = (a: string, b: string, tur: string) => [a, b].sort().join("|") + "|" + tur;

export function iliskiOner(liste: Foy[], reddedilen: Set<string>): IliskiOnerisi[] {
  const out: IliskiOnerisi[] = [];
  const nums = new Map(liste.map(f => [f.id, numaralar(f)] as const));
  const kims = new Map(liste.map(f => [f.id, kimlikler(f)] as const));
  const bagli = (x: Foy, y: Foy) => x.oncekiId === y.id || y.oncekiId === x.id || !!x.ilgiliIds?.includes(y.id) || !!y.ilgiliIds?.includes(x.id);
  for (let i = 0; i < liste.length; i++) for (let j = i + 1; j < liste.length; j++) {
    const x = liste[i], y = liste[j];
    if (bagli(x, y)) continue;
    const ex = esasSade(x.esasNo), ey = esasSade(y.esasNo);
    // Aynı mahkeme ve esas no: iki kez açılmış olabilir.
    if (ex.length >= 6 && ex === ey && sade(x.mahkeme) && sade(x.mahkeme) === sade(y.mahkeme)) {
      const k = ciftAnahtari(x.id, y.id, "ayni");
      if (!reddedilen.has(k)) out.push({ anahtar: k, tur: "ayni", puan: 10, nedenler: ["aynı mahkeme ve esas no"], a: x, b: y });
      continue;
    }
    let puan = 0; const nedenler: string[] = [];
    if (ex.length >= 6 && ex !== ey && nums.get(y.id)!.has(ex)) { puan += 3; nedenler.push(`${x.esasNo} numarası öteki föyün evrakında geçiyor`); }
    if (ey.length >= 6 && ex !== ey && nums.get(x.id)!.has(ey)) { puan += 3; nedenler.push(`${y.esasNo} numarası öteki föyün evrakında geçiyor`); }
    const kx = kims.get(x.id)!, ky = kims.get(y.id)!;
    if ([...kx].some(k => ky.has(k))) { puan += 4; nedenler.push("aynı kimlik / vergi no"); }
    if (ayniAd(x.muvekkil, y.muvekkil)) { puan += 2; nedenler.push("aynı müvekkil"); }
    if (ayniAd(x.karsiTaraf, y.karsiTaraf)) { puan += 2; nedenler.push("aynı karşı taraf"); }
    else if (ayniAd(x.muvekkil, y.karsiTaraf) || ayniAd(x.karsiTaraf, y.muvekkil)) { puan += 1; nedenler.push("taraflar yer değiştirmiş (karşı dava olabilir)"); }
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
      const o = kunyeCikar(ev.metin.slice(0, 4000));
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
  return out.sort((p, q) => q.puan - p.puan).slice(0, 50);
}
