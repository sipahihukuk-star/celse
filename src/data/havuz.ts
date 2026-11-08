// Evrak havuzu: avukatın elindeki bütün evrakı (UDF, PDF, Word, fotoğraf, ZIP, klasör) bir kerede atması; Celse her evrakı bu
// bilgisayarda okur (kunyeCikar), dosya numarası, mahkeme ve taraf adlarına göre gruplar, her grubu var olan bir föye bağlar ya
// da yeni föy önerir. Hiçbir şey dışarı gönderilmez; internet kapalıyken de çalışır.
import type { Foy, FoyTaraf } from "./foy";
import { FoyTur, turTahmin } from "./foyTurleri";
import type { KunyeOneri } from "./kunyeCikar";

export interface HavuzEvrak { id: string; ad: string; boyut: number; metin: string; okunamadi?: string; oneri: KunyeOneri; hata?: string }
export type Hedef = { tur: "var"; foyId: string } | { tur: "yeni"; foyTur: FoyTur; taraf: FoyTaraf } | { tur: "atla" };
export interface HavuzGrup {
  anahtar: string;
  esasNo?: string; mahkeme?: string; birinci?: string; ikinci?: string; acilis?: string;
  evraklar: HavuzEvrak[];
  hedef: Hedef;
  /** neden bu föy / bu tür seçildi */
  neden: string;
  /** büro avukatlarının adı evrakta geçmediği için hangi tarafın vekili olunduğu tahmin */
  tarafBelirsiz?: boolean;
}

const EKLER = new Set(["av", "avukat", "aş", "as", "a", "ş", "ltd", "şti", "sti", "limited", "anonim", "şirketi", "sirketi", "ve", "tic", "san"]);
export const adSade = (x?: string) => (x || "").toLocaleLowerCase("tr").replace(/[^\p{L}\d]+/gu, " ").split(" ").filter(w => w && !EKLER.has(w)).join(" ");
const esasSade = (x?: string) => (x || "").replace(/\s+/g, "").replace(/[^\d/]/g, "");
const merciSade = (x?: string) => adSade(x).replace(/\b(t c|tc)\b/g, "").trim();

/** Büro avukatlarından biri bu vekil adında geçiyor mu (soyadı ve adın ilk kelimesi yeter). */
function bizimVekil(vekil: string | undefined, avukatlar: string[]) {
  const v = adSade(vekil);
  if (!v) return false;
  return avukatlar.some(a => { const k = adSade(a).split(" ").filter(w => w.length > 2); return k.length > 0 && k.every(w => v.includes(w)); });
}

export function havuzuGrupla(evraklar: HavuzEvrak[], foyler: Foy[], avukatlar: string[]): { gruplar: HavuzGrup[]; ayrilamayan: HavuzEvrak[] } {
  const gruplar = new Map<string, HavuzGrup>();
  const ayrilamayan: HavuzEvrak[] = [];
  const esasGrup = new Map<string, string[]>();
  const ekle = (k: string, e: HavuzEvrak, o: KunyeOneri) => {
    let g = gruplar.get(k);
    if (!g) { g = { anahtar: k, evraklar: [], hedef: { tur: "atla" }, neden: "" }; gruplar.set(k, g); }
    g.evraklar.push(e);
    g.esasNo = g.esasNo || o.esasNo; g.mahkeme = g.mahkeme || o.mahkeme;
    g.birinci = g.birinci || o.birinci?.ad; g.ikinci = g.ikinci || o.ikinci?.ad;
    if (o.acilis && (!g.acilis || o.acilis < g.acilis)) g.acilis = o.acilis;
    const es = esasSade(g.esasNo);
    if (es) esasGrup.set(es, [...new Set([...(esasGrup.get(es) || []), k])]);
  };
  // 1) Mahkemesi ve numarası olanlar; 2) yalnız numarası olanlar (aynı numaralı tek grup varsa ona); 3) yalnız taraf adları olanlar.
  const sira = [...evraklar].sort((a, b) => Number(!!b.oneri.mahkeme) - Number(!!a.oneri.mahkeme));
  for (const e of sira) {
    const o = e.oneri, es = esasSade(o.esasNo);
    if (es.length >= 6 && o.mahkeme) { ekle(es + "|" + merciSade(o.mahkeme), e, o); continue; }
    if (es.length >= 6) {
      const var_ = esasGrup.get(es) || [];
      ekle(var_.length === 1 ? var_[0] : es + "|?", e, o);
      continue;
    }
    const b1 = adSade(o.birinci?.ad), b2 = adSade(o.ikinci?.ad);
    if (b1.length >= 5 && b2.length >= 5) { ekle("t|" + [b1, b2].sort().join("|"), e, o); continue; }
    ayrilamayan.push(e);
  }
  // Her grubu var olan föye bağla ya da yeni föy öner.
  for (const g of gruplar.values()) {
    const es = esasSade(g.esasNo), ms = merciSade(g.mahkeme);
    const ayniNo = es.length >= 6 ? foyler.filter(f => esasSade(f.esasNo) === es) : [];
    let f = ayniNo.find(x => ms && merciSade(x.mahkeme) === ms) || (ayniNo.length === 1 && (!ms || !merciSade(ayniNo[0].mahkeme)) ? ayniNo[0] : undefined);
    if (f) { g.hedef = { tur: "var", foyId: f.id }; g.neden = "aynı dosya numarası" + (ms ? " ve mahkeme" : ""); continue; }
    const b1 = adSade(g.birinci), b2 = adSade(g.ikinci);
    if (b1.length >= 5 && b2.length >= 5) {
      f = foyler.find(x => { const m = adSade(x.muvekkil), k = adSade(x.karsiTaraf); return (m === b1 && k === b2) || (m === b2 && k === b1); });
      if (f && !esasSade(f.esasNo)) { g.hedef = { tur: "var", foyId: f.id }; g.neden = "aynı müvekkil ve karşı taraf"; continue; }
    }
    // Yeni föy: tür mahkemeden, taraf vekil adından.
    const foyTur = turTahmin(g.mahkeme || "", ...g.evraklar.map(e => e.oneri.konu || "")) || "hukuk";
    const bizBirinci = g.evraklar.some(e => bizimVekil(e.oneri.birinci?.vekil, avukatlar));
    const bizIkinci = g.evraklar.some(e => bizimVekil(e.oneri.ikinci?.vekil, avukatlar));
    const taraf: FoyTaraf = bizIkinci && !bizBirinci ? "davali" : "davaci";
    g.hedef = { tur: "yeni", foyTur, taraf };
    g.tarafBelirsiz = bizBirinci === bizIkinci;
    g.neden = es ? "bu numarayla föy yok" : "bu taraflarla föy yok";
  }
  const sirali = [...gruplar.values()].sort((a, b) => (a.acilis || "9999").localeCompare(b.acilis || "9999") || (a.esasNo || "").localeCompare(b.esasNo || ""));
  return { gruplar: sirali, ayrilamayan };
}
