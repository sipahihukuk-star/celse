// Föyleme sohbeti: avukat, toplu yüklenen evrakın nasıl föyleneceğini yazarak yönetir ("vekilliği belli olmayanları beklet",
// "arabuluculukları davalarına bağla", "3. grup ceza soruşturması"). Yapay zekâya yalnız KODLANMIŞ özet gider: kişi adları
// KİŞİ-n, büro avukatları AVUKAT-n olur; dosya adları ve evrak metni hiç gitmez. Cevaptaki kodlar cihazda gerçek adlara çevrilir.
// Model yalnız işlem listesi döner; işlemler önizlemeye uygulanır, avukat onaylamadan hiçbir şey kaydedilmez.
import type { Foy } from "./foy";
import type { HavuzEvrak, HavuzGrup, Hedef } from "./havuz";
import { adSade } from "./havuz";
import { evrakSinifla } from "./foyTurleri";

export interface FoyleIslem {
  islem: "hedef" | "tur" | "biz" | "zincir" | "evrak";
  grup?: number; foy?: number; evrak?: number; hedef?: string; tur?: string; taraf?: number; once?: number | null; sonra?: number;
}
export interface Kodlama {
  durum: string;
  /** numara → kimlik eşleşmeleri (gönderildiği anki sıra) */
  gruplar: string[]; foyler: string[]; evraklar: string[];
  /** kod → gerçek ad (yalnız cihazda) */
  geri: Record<string, string>;
  /** avukatın mesajındaki adları kodlar */
  kodla: (s: string) => string;
}


/** Tek başına geçtiğinde ad sayılmayacak sözcükler (uydurma adlarda ve şirket adlarında soyadı yerine gelebilir). */
const SIRADAN = new Set(["müşteki", "şüpheli", "sanık", "davacı", "davalı", "işçi", "işveren", "yapı", "inşaat", "ticaret", "sanayi", "kiracı", "kiraya", "veren",
  "borçlu", "alacaklı", "başvurucu", "taraf", "şirket", "holding", "grup", "bank", "bankası", "sigorta", "belediye", "başkanlığı", "müdürlüğü", "kooperatif", "vakıf", "derneği"]);

export function kodlaDurum(gruplar: HavuzGrup[], hedefi: (g: HavuzGrup) => Hedef, oncesi: (g: HavuzGrup) => string | undefined,
  ayrilamayan: HavuzEvrak[], foyler: Foy[], avukatlar: string[]): Kodlama {
  const kod = new Map<string, string>();
  const geri: Record<string, string> = {};
  let n = 0, a = 0;
  const ver = (ad?: string, avukat = false): string | null => {
    const k = adSade(ad);
    if (k.length < 3) return null;
    if (!kod.has(k)) { const c = avukat ? `AVUKAT-${++a}` : `KİŞİ-${++n}`; kod.set(k, c); geri[c] = (ad || "").trim(); }
    return kod.get(k)!;
  };
  avukatlar.forEach(x => ver(x.replace(/^av\.?\s*/i, ""), true));
  const bizimMi = (v?: string) => { const c = v ? ver(v.replace(/^av\.?\s*/i, "")) : null; return !!c && c.startsWith("AVUKAT"); };
  const ilgiliFoy = new Set<string>();
  gruplar.forEach(g => { const h = hedefi(g); if (h.tur === "var") ilgiliFoy.add(h.foyId); });
  const grupNo = gruplar.map(g => g.anahtar);
  const foyListe = [...foyler].sort((x, y) => Number(ilgiliFoy.has(y.id)) - Number(ilgiliFoy.has(x.id)) || y.guncelleme.localeCompare(x.guncelleme)).slice(0, 80);
  const foyNo = foyListe.map(f => f.id);
  const durum = {
    gruplar: gruplar.map((g, i) => {
      const h = hedefi(g);
      const v1 = g.evraklar.map(e => e.oneri.birinci?.vekil).find(Boolean), v2 = g.evraklar.map(e => e.oneri.ikinci?.vekil).find(Boolean);
      const once = oncesi(g);
      return {
        grup: i + 1, merci: g.mahkeme || null, no: g.esasNo || null, acilis: g.acilis || null,
        taraf1: ver(g.birinci), taraf2: ver(g.ikinci), vekil1: v1 ? ver(v1.replace(/^av\.?\s*/i, "")) : null, vekil2: v2 ? ver(v2.replace(/^av\.?\s*/i, "")) : null,
        biz: h.tur === "yeni" ? (g.tarafBelirsiz ? "belirsiz" : h.taraf === "davali" ? 2 : 1) : (bizimMi(v1) ? 1 : bizimMi(v2) ? 2 : "belirsiz"),
        hedef: h.tur === "var" ? `föy ${foyNo.indexOf(h.foyId) + 1}` : h.tur, tur: h.tur === "yeni" ? h.foyTur : null,
        onceki: once ? grupNo.indexOf(once) + 1 || null : null,
        evrak: g.evraklar.slice(0, 25).map(e => ({ tur: evrakSinifla("", e.metin).tur, tarih: e.oneri.belgeTarihi || null }))
      };
    }),
    ayrilamayan: ayrilamayan.slice(0, 60).map((e, i) => ({ evrak: i + 1, tur: e.metin ? evrakSinifla("", e.metin).tur : "okunamadı", taraf1: ver(e.oneri.birinci?.ad), taraf2: ver(e.oneri.ikinci?.ad), merci: e.oneri.mahkeme || null })),
    foyler: foyListe.map((f, i) => ({ foy: i + 1, tur: f.tur || "hukuk", muvekkil: ver(f.muvekkil), karsi: ver(f.karsiTaraf), no: f.esasNo || null, merci: f.mahkeme || null, acilis: f.acilis || null }))
  };
  // Mesajdaki adlar: tam ad, şirket eki olmadan ad ve soyadı (en az 4 harf); büyük/küçük harf ve Türkçe harf farkı gözetilmez.
  const kac = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const varyant = (w: string) => { const l = w.toLocaleLowerCase("tr"); return [...new Set([w, l, w.toLocaleUpperCase("tr"), l.slice(0, 1).toLocaleUpperCase("tr") + l.slice(1)])].map(kac).join("|"); };
  const desen = (kelimeler: string[]) => new RegExp(`(^|[^\\p{L}])${kelimeler.map(w => `(?:${varyant(w)})`).join("[\\s.,]+")}(?=[^\\p{L}]|$)`, "gu");
  const adlar = [...kod.entries()].map(([k, c]) => ({ ad: geri[c], k, c })).filter(x => x.ad).sort((x, y) => y.ad.length - x.ad.length);
  const kodla = (s: string) => {
    let x = s;
    for (const { ad, k, c } of adlar) {
      x = x.replace(new RegExp(kac(ad), "gi"), c);
      const ks = k.split(" ").filter(Boolean);
      if (ks.length) x = x.replace(desen(ks), `$1${c}`);
      const soyad = ks[ks.length - 1];
      if (ks.length > 1 && soyad && soyad.length >= 4 && !SIRADAN.has(soyad)) x = x.replace(desen([soyad]), `$1${c}`);
    }
    // Kimlik, telefon, e-posta hiç gitmez.
    return x.replace(/\b\d{10,11}\b/g, "[NUMARA]").replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[E-POSTA]").replace(/(?:\+90|0)\s?5\d{2}\s?\d{3}\s?\d{2}\s?\d{2}/g, "[TELEFON]");
  };
  return { durum: JSON.stringify(durum), gruplar: grupNo, foyler: foyNo, evraklar: ayrilamayan.slice(0, 60).map(e => e.id), geri, kodla };
}

/** Cevaptaki kodları gerçek adlara çevirir (yalnız cihazda). */
export const geriAc = (s: string, geri: Record<string, string>) => s.replace(/\b(KİŞİ|AVUKAT)-\d+\b/g, m => geri[m] || m);
