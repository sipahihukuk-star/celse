// "🤖 Takibi en güçlü yapay zekâyla hazırla": yapay zekâ föydeki bütün evrakı (kişisel veriler kodlanmış olarak) okur ve
// icra takibi açılırsa kimin (alacaklılar) kimden (borçlular) hangi kalemi, hangi faizle, hangi tarihten itibaren
// isteyebileceğini çıkarır. Kodlar cihazda açılır (icraSorCagri.icraHazirla); burada sonuç föye yazılır ve Celse'nin kendi
// okumasıyla (hukumAnaliz) karşılaştırılır. Avukat önizlemeyi görmeden hiçbir şey yazılmaz.
import { Foy, TarafKisi } from "./foy";
import { FaizTuru, IcraBilgi, Kalem, Kisi, MAHIYETLER, TakipYolu } from "./icra";
import { ayniKisi, ilamTaraflari } from "./icraEvrak";
import { ac, FAIZLER, isoCikar, YOLLAR } from "./icraSohbet";

export interface HazirlikKisi { ad: string; kimlikNo?: string; adres?: string }
export interface HazirlikKalemi extends Kalem { alacakli?: string; borclular?: string; dayanak?: string }
export interface IcraHazirlik {
  ozet: string;
  yol?: TakipYolu; mahiyet?: string;
  ilam?: { mahkeme?: string; esasNo?: string; kararNo?: string; kararTarihi?: string; kesinlesme?: string };
  davaTarihi?: string;
  alacaklilar: HazirlikKisi[];
  borclular: HazirlikKisi[];
  kalemler: HazirlikKalemi[];
  kontrol: string[];
}

const dolu = (x?: string) => (x && x.trim() ? x.trim() : undefined);
/** Aynı kişi föyde varsa onun kimlik ve adresi korunur; yapay zekâdan gelen boşsa föydeki kalır. */
function birlestir(yeni: HazirlikKisi, eskiler: (TarafKisi | Kisi | undefined)[]): TarafKisi {
  const e = eskiler.find(x => x && ayniKisi(x.ad, yeni.ad));
  return { ...(e || {}), ad: yeni.ad, kimlikNo: dolu(yeni.kimlikNo) || e?.kimlikNo, adres: dolu(yeni.adres) || e?.adres };
}

/** Kalemin adı: birden çok alacaklı ya da borçlu varsa kimden kime istendiği adında da görünür (takip talebinde okunur). */
export function kalemAdi(k: HazirlikKalemi, h: IcraHazirlik): string {
  const ek: string[] = [];
  if (h.alacaklilar.length > 1 && dolu(k.alacakli)) ek.push("alacaklı: " + k.alacakli!.trim());
  if (h.borclular.length > 1 && dolu(k.borclular)) ek.push("borçlu: " + k.borclular!.trim());
  return (k.ad + (ek.length ? " (" + ek.join("; ") + ")" : "")).slice(0, 160);
}

/** Önizlemedeki "✓ Takibe yaz": XML'e yetecek her şey föye yazılır (alacaklılar, borçlular, kalemler, ilam, yol, mahiyet). */
export function hazirligiUygula(f: Foy, h: IcraHazirlik): { ek: Partial<Foy>; yazilan: string[] } {
  const b: IcraBilgi = f.icra || { yol: "ilamli", talep: "haciz", paraBirimi: "TL", faizTuru: "yasal" };
  const ek: Partial<Foy> = {};
  const yazilan: string[] = [];
  const eskiAlacakli: TarafKisi[] = [{ ad: f.muvekkil, kimlikNo: f.muvekkilBilgi?.kimlikNo, adres: f.muvekkilBilgi?.adres }, ...(f.ekMuvekkiller || [])];
  const eskiBorclu: TarafKisi[] = [{ ad: f.karsiTaraf, kimlikNo: f.karsiBilgi?.kimlikNo, adres: f.karsiBilgi?.adres }, ...(f.ekKarsiTaraflar || []), ...(b.ekBorclular || [])];
  if (h.alacaklilar.length) {
    const xs = h.alacaklilar.map(x => birlestir(x, eskiAlacakli));
    ek.muvekkil = xs[0].ad;
    ek.muvekkilBilgi = { ...(f.muvekkilBilgi || {}), kimlikNo: xs[0].kimlikNo, adres: xs[0].adres };
    ek.ekMuvekkiller = xs.slice(1);
    yazilan.push(xs.length + " alacaklı");
  }
  let ekBorclular = b.ekBorclular;
  if (h.borclular.length) {
    const xs = h.borclular.map(x => birlestir(x, eskiBorclu));
    ek.karsiTaraf = xs[0].ad;
    ek.karsiBilgi = { ...(f.karsiBilgi || {}), kimlikNo: xs[0].kimlikNo, adres: xs[0].adres };
    ekBorclular = xs.slice(1).map(x => ({ ad: x.ad, kimlikNo: x.kimlikNo, adres: x.adres }));
    // İcra föyünün künyesinde karşı taraflar borçlulardır; ötekiler künyede de görünür.
    if (f.tur === "icra") ek.ekKarsiTaraflar = xs.slice(1);
    yazilan.push(xs.length + " borçlu");
  }
  // Faiz başlangıcı okunamayan gider kalemlerine (vekâlet ücreti, yargılama gideri, harç) karar tarihi yazılır.
  const kt = h.ilam?.kararTarihi || b.ilam?.kararTarihi;
  const kalemler: Kalem[] | undefined = h.kalemler.length
    ? h.kalemler.map(k => ({ ad: kalemAdi(k, h), tutar: k.tutar, faizTuru: k.faizTuru || "yasal",
      faizBaslangic: k.faizTuru === "yok" ? undefined : k.faizBaslangic || (/vekâlet|vekalet|yargılama|harç/i.test(k.ad) ? kt : undefined) }))
    : undefined;
  if (kalemler) yazilan.push(kalemler.length + " alacak kalemi");
  const il = h.ilam || {};
  const ilam = { ...(b.ilam || {}), ...Object.fromEntries(Object.entries(il).filter(([, v]) => dolu(v as string))), ...(h.davaTarihi ? { davaTarihi: h.davaTarihi } : {}) };
  if (Object.keys(il).some(k => dolu((il as Record<string, string>)[k]))) yazilan.push("ilam bilgileri");
  ek.icra = {
    ...b,
    yol: h.yol || b.yol || "ilamli",
    mahiyet: h.mahiyet || b.mahiyet,
    ilam,
    ekBorclular,
    yzHazirlik: { tarih: new Date().toISOString() },
    ...(kalemler ? { kalemler, asil: undefined, islemisFaizElle: undefined, ilamVekalet: undefined, yargilamaGideri: undefined } : {})
  };
  if (h.yol) yazilan.push("takip yolu");
  return { ek, yazilan };
}

const gun = (x?: string) => (x && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x.split("-").reverse().join(".") : "başlangıçsız");
export interface Fark { tur: "eksik" | "fazla" | "tutar" | "faiz"; metin: string }
/** Celse'nin kendi okumasıyla (kurallar, bu cihazda) karşılaştırma: tutması güven verir, tutmayan satırlar gösterilir. */
export function okumaKarsilastir(h: IcraHazirlik, yerel: Kalem[]): Fark[] {
  const farklar: Fark[] = [];
  const kalan = yerel.filter(x => x.tutar > 0);
  const kurus = (a: number, b: number) => Math.abs(a - b) < 0.01;
  for (const k of h.kalemler) {
    const i = kalan.findIndex(x => kurus(x.tutar, k.tutar));
    if (i < 0) { farklar.push({ tur: "fazla", metin: k.ad + ": " + k.tutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " TL Celse'nin kendi okumasında yok" }); continue; }
    const y = kalan.splice(i, 1)[0];
    if ((y.faizTuru || "yasal") !== (k.faizTuru || "yasal") || (y.faizBaslangic && k.faizBaslangic && y.faizBaslangic !== k.faizBaslangic))
      farklar.push({ tur: "faiz", metin: k.ad + ": yapay zekâ " + (k.faizTuru || "yasal") + " faiz, " + gun(k.faizBaslangic) + " tarihinden; Celse'nin okuması " + (y.faizTuru || "yasal") + " faiz, " + gun(y.faizBaslangic) + " tarihinden. Hükmün ilgili bendine bakın." });
  }
  for (const y of kalan) farklar.push({ tur: "eksik", metin: y.ad + ": " + y.tutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " TL Celse'nin okumasında var, yapay zekânın listesinde yok (karşı taraf lehine ya da istinafta kaldırılmış olabilir)" });
  return farklar;
}

/** Sunucudan gelen (kodlu) JSON cihazda açılır ve doğrulanır: tutar sayı, faiz türü listeden, tarihler YYYY-AA-GG.
 *  Açılamayan kod (ör. [AD-9]) kimlik no ya da adres olarak yazılmaz. */
export function hazirlikCoz(d: Record<string, unknown>, map: Record<string, string>, tarihler: Record<string, string>): IcraHazirlik {
  const m = (x: unknown, n = 300) => (typeof x === "string" && x.trim() ? ac(x, map, tarihler).trim().slice(0, n) : undefined);
  const tarih = (x: unknown) => (typeof x === "string" ? isoCikar(ac(x, map, tarihler, true)) : undefined);
  const kodsuz = (x?: string) => (x && !/\[[A-ZÇĞİÖŞÜ]+-\d+\]/.test(x) ? x : undefined);
  const kisi = (x: Record<string, unknown>): HazirlikKisi => ({ ad: m(x.ad, 200) || "", kimlikNo: kodsuz(m(x.kimlikNo, 30))?.replace(/\D/g, "") || undefined, adres: kodsuz(m(x.adres, 300)) });
  const dizi = (x: unknown) => (Array.isArray(x) ? (x as unknown[]).filter(y => y && typeof y === "object") as Record<string, unknown>[] : []);
  const il = (d.ilam && typeof d.ilam === "object" ? d.ilam : {}) as Record<string, unknown>;
  const sayi = (x: unknown) => (typeof x === "number" ? x : Number(String(x ?? "").replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")));
  return {
    ozet: m(d.ozet, 3000) || "",
    yol: YOLLAR.includes(d.yol as TakipYolu) ? (d.yol as TakipYolu) : undefined,
    mahiyet: typeof d.mahiyet === "string" && MAHIYETLER.some(x => x.kod === d.mahiyet) ? d.mahiyet : undefined,
    ilam: { mahkeme: m(il.mahkeme, 160), esasNo: m(il.esasNo, 30), kararNo: m(il.kararNo, 30), kararTarihi: tarih(il.kararTarihi), kesinlesme: tarih(il.kesinlesme) },
    davaTarihi: tarih(d.davaTarihi),
    alacaklilar: dizi(d.alacaklilar).map(kisi).filter(x => x.ad).slice(0, 20),
    borclular: dizi(d.borclular).map(kisi).filter(x => x.ad).slice(0, 20),
    kalemler: dizi(d.kalemler).map(x => {
      const fz = FAIZLER.includes(x.faizTuru as FaizTuru) ? (x.faizTuru as FaizTuru) : "yasal";
      const tutar = sayi(x.tutar);
      return { ad: m(x.ad, 80) || "Alacak", tutar: Math.round((Number.isFinite(tutar) ? tutar : 0) * 100) / 100, faizTuru: fz, faizBaslangic: fz === "yok" ? undefined : tarih(x.faizBaslangic), alacakli: m(x.alacakli, 200), borclular: m(x.borclular, 400), dayanak: m(x.dayanak, 80) };
    }).filter(x => x.tutar > 0).slice(0, 40),
    kontrol: (Array.isArray(d.kontrol) ? d.kontrol : []).map(x => m(x, 500) || "").filter(Boolean).slice(0, 12)
  };
}

/** Föye henüz yazılmamış taraflar (ör. ilamdaki 2. davalı) ve vekilleri de kodlansın diye: evraktaki bütün taraf adları. */
export function hazirlikAdlari(f: Foy): string[] {
  const out = new Set<string>();
  for (const e of f.evraklar) {
    if (!e.metin.trim()) continue;
    try {
      const it = ilamTaraflari(e.metin);
      for (const x of [...it.birinciler, ...it.ikinciler]) if (x.ad) out.add(x.ad);
      for (const v of [it.birinci?.vekil, it.ikinci?.vekil]) if (v) v.split(/[,;]|\s+ve\s+/).map(x => x.replace(/^\s*Av\.\s*/i, "").trim()).forEach(x => x && out.add(x));
    } catch { /* okunamayan evrak atlanır */ }
  }
  return [...out].filter(x => x.length > 2);
}
