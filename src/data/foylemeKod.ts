// Föyleme sohbeti: avukat, toplu yüklenen evrakın nasıl föyleneceğini yazarak yönetir ("vekilliği belli olmayanları beklet",
// "arabuluculukları davalarına bağla", "3. grup ceza soruşturması"). Yapay zekâya yalnız KODLANMIŞ özet gider: kişi adları
// KİŞİ-n, büro avukatları AVUKAT-n, dosya numaraları DOSYA-n, merciler yalnız türüyle (ASLİYE HUKUK MAHKEMESİ-n) gider: mahkeme ve
// esas no birlikte, dosyaya erişebilen herkes için tarafları belirlenebilir kılar (KVKK'da kişisel veri; ceza dosyasında özel nitelikli).
// Dosya adları gitmez. Evrakın yalnız baş kısmı, önce bilinenler kodlanıp sonra maskelenerek (kalan adlar, kimlik no, adres, telefon,
// il çıkar) "ozet" olarak gider; böylece yapay zekâ evrakın ne olduğunu okuyabilir. Özetteki adlar da bütün evrakta aynı KİŞİ-n
// koduyla gider; cihaz evrakı ayıramadığında yapay zekâ aynı kişilere ait evrakı birleştirip föy önerebilir.
// Cevaptaki kodlar cihazda gerçek adlara çevrilir.
// Model yalnız işlem listesi döner; işlemler önizlemeye uygulanır, avukat onaylamadan hiçbir şey kaydedilmez.
import type { Foy } from "./foy";
import type { HavuzEvrak, HavuzGrup, Hedef } from "./havuz";
import { adSade } from "./havuz";
import { evrakSinifla } from "./foyTurleri";
import { mask } from "../engine/mask";

export interface FoyleIslem {
  islem: "hedef" | "tur" | "biz" | "zincir" | "evrak";
  grup?: number; foy?: number; evrak?: number; hedef?: string; tur?: string; taraf?: number; once?: number | null; sonra?: number;
  /** ayrılamayan evrak için yeni föy: aynı küme numarasını alanlar aynı föye girer; merci ve no evraktan okunmuşsa */
  kume?: number; merci?: string; no?: string;
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
  const kac = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const varyant = (w: string) => { const l = w.toLocaleLowerCase("tr"); return [...new Set([w, l, w.toLocaleUpperCase("tr"), l.slice(0, 1).toLocaleUpperCase("tr") + l.slice(1)])].map(kac).join("|"); };
  const desen = (kelimeler: string[]) => new RegExp(`(^|[^\\p{L}])${kelimeler.map(w => `(?:${varyant(w)})`).join("[\\s.,]+")}(?=[^\\p{L}]|$)`, "gu");
  // Dosya numarası ve merci kodları (aynı numara/merci hep aynı kodu alır).
  const esasKod = new Map<string, string>(), merciKod = new Map<string, string>();
  let d = 0;
  const esasSade = (x: string) => x.replace(/\s+/g, "").replace(/[^\d/]/g, "");
  const no = (x?: string | null): string | null => {
    const k = esasSade(x || "");
    if (k.length < 4) return null;
    if (!esasKod.has(k)) { const c = `DOSYA-${++d}`; esasKod.set(k, c); geri[c] = (x || "").trim(); }
    return esasKod.get(k)!;
  };
  const turSayac = new Map<string, number>();
  const merci = (x?: string | null): string | null => {
    const k = adSade(x || "");
    if (k.length < 3) return null;
    if (!merciKod.has(k)) {
      // Türü kalır (asliye hukuk, iş mahkemesi, başsavcılık…), il, ilçe ve sıra numarası gider.
      const tur = mask(x || "", {}).masked.replace(/\[([^\]]*)\]/g, (_m, c: string) => /MAHKEME|SAVCI|DAİRE|MÜDÜRL|BAŞKANL|BÜRO|KURUL/.test(c) ? " " + c.replace(/-\d+$/, "") + " " : " ").replace(/\bT\.?\s?C\.?(?=\s|$)/g, " ").replace(/\d+\s*\.?/g, " ").replace(/\s+/g, " ").trim().toLocaleUpperCase("tr") || "MERCİ";
      const n = (turSayac.get(tur) || 0) + 1; turSayac.set(tur, n);
      const c = `${tur}-${n}`; merciKod.set(k, c); geri[c] = (x || "").trim();
    }
    return merciKod.get(k)!;
  };
  avukatlar.forEach(x => ver(x.replace(/^av\.?\s*/i, ""), true));
  const bizimMi = (v?: string) => { const c = v ? ver(v.replace(/^av\.?\s*/i, "")) : null; return !!c && c.startsWith("AVUKAT"); };
  // Evrakın baş kısmı: bilinen adlar KİŞİ-n / AVUKAT-n olur, sonra maskeleme kalan adları, kimlik no, adres ve telefonu çıkarır.
  // Maskenin bulduğu merci ve dosya numaraları durumdaki kodlarla değiştirilir (yapay zekâ özeti gruplarla eşleştirebilsin).
  const ozet = (metin: string, uzunluk: number): string | null => {
    const bas = (metin || "").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim().slice(0, uzunluk * 2);
    if (!bas) return null;
    const m = mask(kodla(bas), {});
    let x = m.masked;
    for (const [k, v] of Object.entries(m.map).sort((p, q) => q[0].length - p[0].length)) {
      if (/^\[ESAS-\d+\]$/.test(k)) x = x.split(k).join(no(v) || k);
      else if (/MAHKEMES|SAVCILI|DAİRES|MÜDÜRLÜĞ|BAŞKANLIĞ/.test(k)) x = x.split(k).join(merci(v) || k);
      // Kişi ve şirket adları bütün evrakta AYNI koda çevrilir (KİŞİ-n): yapay zekâ aynı kişinin evrakını birleştirebilsin.
      // Adres, kimlik/telefon numarası, il gibi öteki yer tutucular gizli kalır.
      else if (!/^\[(ADRES|NO|İL|İLÇE|TELEFON|TEL|E-?POSTA|IBAN|PLAKA|TARİH|KART|HESAP|SİCİL|PASAPORT|PARSEL|ADA|URL|WEB)/.test(k)) {
        const c = ver(v.replace(/^av\.?\s*/i, ""));
        if (c) x = x.split(k).join(c);
      }
    }
    return kodla(x.replace(/\[KİŞİ-(\d+)\]/g, "[AD-$1]")).slice(0, uzunluk);
  };
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
        grup: i + 1, merci: merci(g.mahkeme), no: no(g.esasNo), acilis: g.acilis || null,
        taraf1: ver(g.birinci), taraf2: ver(g.ikinci), vekil1: v1 ? ver(v1.replace(/^av\.?\s*/i, "")) : null, vekil2: v2 ? ver(v2.replace(/^av\.?\s*/i, "")) : null,
        biz: h.tur === "yeni" ? (g.tarafBelirsiz ? "belirsiz" : h.taraf === "davali" ? 2 : 1) : (bizimMi(v1) ? 1 : bizimMi(v2) ? 2 : "belirsiz"),
        hedef: h.tur === "var" ? `föy ${foyNo.indexOf(h.foyId) + 1}` : h.tur, tur: h.tur === "yeni" ? h.foyTur : null,
        onceki: once ? grupNo.indexOf(once) + 1 || null : null,
        evrak: g.evraklar.slice(0, 25).map((e, j) => ({ tur: evrakSinifla("", e.metin).tur, tarih: e.oneri.belgeTarihi || null, ...(j < 2 && e.metin ? { ozet: ozet(e.metin, 350) } : {}) }))
      };
    }),
    ayrilamayan: ayrilamayan.slice(0, 60).map((e, i) => ({ evrak: i + 1, tur: e.metin ? evrakSinifla("", e.metin).tur : "okunamadı", taraf1: ver(e.oneri.birinci?.ad), taraf2: ver(e.oneri.ikinci?.ad), merci: merci(e.oneri.mahkeme), no: no(e.oneri.esasNo), ozet: e.metin ? ozet(e.metin, 700) : null })),
    foyler: foyListe.map((f, i) => ({ foy: i + 1, tur: f.tur || "hukuk", muvekkil: ver(f.muvekkil), karsi: ver(f.karsiTaraf), no: no(f.esasNo), merci: merci(f.mahkeme), acilis: f.acilis || null }))
  };
  // Mesajdaki adlar: tam ad, şirket eki olmadan ad ve soyadı (en az 4 harf); büyük/küçük harf ve Türkçe harf farkı gözetilmez.
  function kodla(s: string) {
    const adlar = [...kod.entries()].map(([k, c]) => ({ ad: geri[c], k, c })).filter(x => x.ad).sort((x, y) => y.ad.length - x.ad.length);
    let x = s;
    for (const { ad, k, c } of adlar) {
      x = x.replace(new RegExp(kac(ad), "gi"), c);
      const ks = k.split(" ").filter(Boolean);
      if (ks.length) x = x.replace(desen(ks), `$1${c}`);
      const soyad = ks[ks.length - 1];
      if (ks.length > 1 && soyad && soyad.length >= 4 && !SIRADAN.has(soyad)) x = x.replace(desen([soyad]), `$1${c}`);
    }
    for (const [ad, c] of [...merciKod.entries()].map(([, c]) => [geri[c], c] as const).sort((p, q) => q[0].length - p[0].length)) if (ad) x = x.replace(new RegExp(kac(ad), "gi"), c);
    // Dosya numaraları: bilinenler koduyla, ötekiler genel yer tutucuyla.
    x = x.replace(/\b(?:19|20)\d{2}\s*\/\s*\d{1,7}\b/g, m => esasKod.get(esasSade(m)) || "[DOSYA NO]");
    // Kimlik, telefon, e-posta hiç gitmez.
    return x.replace(/\b\d{10,11}\b/g, "[NUMARA]").replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[E-POSTA]").replace(/(?:\+90|0)\s?5\d{2}\s?\d{3}\s?\d{2}\s?\d{2}/g, "[TELEFON]");
  }
  return { durum: JSON.stringify(durum), gruplar: grupNo, foyler: foyNo, evraklar: ayrilamayan.slice(0, 60).map(e => e.id), geri, kodla };
}

/** Cevaptaki kodları gerçek adlara çevirir (yalnız cihazda). */
export const geriAc = (s: string, geri: Record<string, string>) => {
  let x = s.replace(/\b(KİŞİ|AVUKAT|DOSYA)-\d+\b/g, m => geri[m] || m);
  // Merci kodları ("ASLİYE HUKUK MAHKEMESİ-2"): uzun olandan başlayarak.
  for (const k of Object.keys(geri).filter(k => !/^(KİŞİ|AVUKAT|DOSYA)-\d+$/.test(k)).sort((p, q) => q.length - p.length)) x = x.split(k).join(geri[k]);
  return x;
};
