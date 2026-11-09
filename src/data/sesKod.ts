// Sesli komutun yapay zekâya yorumlatılması için cümleyi kodlar: föylerdeki müvekkil / karşı taraf adları [AD-n], dosya
// numaraları [NO-n], büro çalışanları [KİŞİ-n], uzun sayılar (kimlik, telefon, IBAN) [SAYI] olur. Dönen komut cihazda açılır.
import type { Foy } from "./foy";

// Şirket unvanlarında geçen genel sözcükler kişisel veri değildir; kodlanmaz (yorum bozulmasın).
const GENEL = new Set(["sigorta", "inşaat", "ticaret", "sanayi", "limited", "şirketi", "anonim", "holding", "turizm", "gıda", "tekstil", "otomotiv", "enerji", "lojistik", "nakliyat",
  "bankası", "banka", "belediyesi", "belediye", "bakanlığı", "müdürlüğü", "başkanlığı", "kurumu", "hazine", "hazinesi", "maliye", "vakfı", "derneği", "kooperatifi", "mahkemesi",
  "asliye", "hukuk", "ceza", "icra", "dairesi", "sulh", "ağır", "idare", "vergi", "noterliği", "avukat", "dosya", "dosyası", "dosyasına", "dosyasında", "dava", "davası", "işi", "işini"]);
const kelime = (x: string) => x.toLocaleLowerCase("tr").split(/[^\p{L}\d]+/u).filter(w => w.length >= 3 && !GENEL.has(w));
const kok = (t: string) => t.slice(0, Math.max(4, t.length - 4));

export interface SesKodu { kodlu: string; harita: Record<string, string> }

/** Cümleyi kodlar. Kod → söylenen asıl sözcük. */
export function sesKodla(soz: string, liste: Foy[], kisiler: string[] = []): SesKodu {
  const adlar = new Set<string>();
  for (const f of liste) if (!f.ozel) for (const w of kelime(`${f.muvekkil} ${f.karsiTaraf}`)) adlar.add(w);
  const kisi = new Set(kisiler.flatMap(kelime));
  const harita: Record<string, string> = {};
  const geri = new Map<string, string>();
  let n = { AD: 0, NO: 0, "KİŞİ": 0 } as Record<string, number>;
  const kod = (tur: string, asil: string, anahtar: string) => {
    const k = geri.get(tur + ":" + anahtar);
    if (k) return k;
    n = { ...n, [tur]: n[tur] + 1 };
    const y = `[${tur}-${n[tur]}]`;
    geri.set(tur + ":" + anahtar, y); harita[y] = asil;
    return y;
  };
  let x = soz.replace(/\b(\d{4})\s*(?:bölü|\/|-)\s*(\d{1,7})\b/giu, (a, y, s) => kod("NO", `${y}/${s}`, `${y}/${s}`));
  x = x.replace(/\d[\d\s-]{8,}\d/g, s => (s.replace(/\D/g, "").length >= 10 ? "[SAYI]" : s));
  x = x.replace(/[\p{L}][\p{L}'’]*/gu, w => {
    const t = w.toLocaleLowerCase("tr").replace(/['’].*$/, "");
    if (t.length < 3 || GENEL.has(t)) return w;
    const ek = w.slice(w.replace(/['’].*$/, "").length);
    for (const a of kisi) if (a.startsWith(kok(t)) || (a.length >= 4 && t.startsWith(a))) return kod("KİŞİ", w.replace(/['’].*$/, ""), a) + ek;
    for (const a of adlar) if (a.startsWith(kok(t)) || (a.length >= 4 && t.startsWith(a))) return kod("AD", w.replace(/['’].*$/, ""), a) + ek;
    return w;
  });
  return { kodlu: x, harita };
}

/** Yapay zekânın döndürdüğü komuttaki kodları asıl sözcüklere çevirir. */
export function sesKodAc(komut: string, harita: Record<string, string>): string {
  return komut.replace(/\[(?:AD|NO|KİŞİ)-\d+\]/g, k => harita[k] ?? k).replace(/\[SAYI\]/g, "");
}
