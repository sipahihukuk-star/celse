// İcra takibinde avukatın yazdığı (ya da yapıştırdığı evrakın sonuna eklediği) talimatı cihazda okur; yapay zekâ gerekmez:
//   "bu kararı 10.000 TL vekâlet ücreti ve 2.538 TL yargılama gideri olacak şekilde takibe koy; alacaklı X ile borçlu Y'yi de ekle"
//   → alacak kalemleri (vekâlet ücreti 10.000, yargılama gideri 2.538), ek alacaklı X, ek borçlu Y.
// Adlar evraktaki taraflarla eşleştirilir (doğru yazımı, kimlik no ve adresi oradan gelir); "Yılmaz'ı", "keskini" gibi ekler atılır.
import type { Foy, TarafKisi } from "./foy";
import type { IcraBilgi, Kalem } from "./icra";
import type { TarafOneri } from "./kunyeCikar";

const ust = (x: string) => x.toLocaleUpperCase("tr");
const harf = "A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîû";

/** Talimat fiilleri: metnin sonundaki cümle avukatın isteği mi? */
const TALIMAT = /(hazırla|hazırlayın|hazırlayacağız|hazırlayalım|ekle|ekleyin|yaz\b|yazın|çıkar|hesapla|olacak şekilde|düzelt|koy\b|koyun|takip aç|takibi aç|takibe koy)/i;

/** Yapıştırılan metni evrak ve (sonuna eklenmiş) talimat diye ayırır. */
export function talimatAyir(metin: string): { evrak: string; talimat: string } {
  const x = metin.replace(/\r/g, "");
  // 1) Son imza ("e-imzalıdır") sonrasında kalan söz.
  let son = -1, sonUz = 0;
  for (const m of x.matchAll(/e-?\s?imzalıdır|E-?\s?İMZALIDIR|imzalıdır|İMZALIDIR/g)) { son = m.index ?? son; sonUz = m[0].length; }
  if (son >= 0) {
    const kuyruk = x.slice(son + sonUz).replace(/^[\s"'”“’.,;:)\-–]+/, "").trim();
    const kalanImza = /e-?\s?imzalıdır/i.test(kuyruk);
    if (!kalanImza && kuyruk.replace(new RegExp(`[^${harf}]`, "g"), "").length >= 10 && TALIMAT.test(kuyruk)) return { evrak: x.slice(0, son + sonUz).trim(), talimat: kuyruk };
  }
  // 2) Son paragraf küçük harfli bir istekse.
  const satirlar = x.trim().split(/\n+/);
  const sonSatir = satirlar[satirlar.length - 1] || "";
  if (satirlar.length > 3 && sonSatir.length < 700 && TALIMAT.test(sonSatir) && /[a-zçğıöşü]/.test(sonSatir) && !/VERİLMESİNE|KARAR VERİLDİ|ARZ VE TALEP|arz ve talep|arz ederim/i.test(sonSatir))
    return { evrak: satirlar.slice(0, -1).join("\n").trim(), talimat: sonSatir.trim() };
  return { evrak: x.trim(), talimat: "" };
}

export interface TalimatSonucu { kalemler: { ad: string; tutar: number }[]; alacaklilar: string[]; borclular: string[] }

const sayi = (x: string) => {
  const t = x.replace(/\s/g, "");
  // "10.000" binlik; "2.538,50" binlik + kuruş; "2538,5" kuruş.
  return Number(/,\d{1,2}$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(/[.,](?=\d{3}(?:\D|$))/g, ""));
};
const KALEMLER: [RegExp, string][] = [
  [/vek[aâ]let\s*ücret|avukatlık\s*ücret/i, "Vekâlet ücreti"],
  [/yargılama\s*gider/i, "Yargılama gideri"],
  [/harç|harc/i, "Harç"],
  [/manevi\s*tazminat/i, "Manevi tazminat"],
  [/maddi\s*tazminat|destekten\s*yoksun/i, "Maddi tazminat"],
  [/kıdem/i, "Kıdem tazminatı"],
  [/ihbar\s*tazminat/i, "İhbar tazminatı"],
  [/fazla\s*(?:mesai|çalışma)/i, "Fazla mesai alacağı"],
  [/yıllık\s*(?:ücretli\s*)?izin/i, "Yıllık izin ücreti"],
  [/kira/i, "Kira bedeli"],
  [/asıl\s*alacak|alacak/i, "Asıl alacak"]
];
const TUTAR = /(\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:tl|try|₺|türk\s*lirası)?(?:['’]?(?:lik|lık|luk|lük))?/gi;

/** Talimattaki tutarlı kalemler ve eklenecek alacaklı / borçlu adları. */
export function talimatOku(talimat: string): TalimatSonucu {
  const out: TalimatSonucu = { kalemler: [], alacaklilar: [], borclular: [] };
  const x = talimat.replace(/\s+/g, " ");
  for (const m of x.matchAll(TUTAR)) {
    const tutar = sayi(m[1]);
    if (!tutar || tutar < 1 || /^(19|20)\d{2}$/.test(m[1])) continue;
    const bas = (m.index || 0) + m[0].length;
    const sonra = x.slice(bas, bas + 40), once = x.slice(Math.max(0, (m.index || 0) - 40), m.index || 0);
    // Kalemin adı tutarın hemen ardında ("10.000 TL vekâlet ücreti") ya da önünde ("vekâlet ücreti 10.000 TL").
    const bul = (s: string) => KALEMLER.find(([re]) => re.test(s))?.[1];
    const ad = bul(sonra.split(/\d/)[0]) || bul(once.split(/\d/).pop() || "");
    if (!ad) continue;
    const i = out.kalemler.findIndex(k => k.ad === ad);
    if (i >= 0) out.kalemler[i].tutar = tutar; else out.kalemler.push({ ad, tutar });
  }
  // "alacaklı X (ve Z) ile borçlu Y'yi de ekle", "borçlu olarak Y ekle", "alacaklılara X'i ekle"
  const ROL = /(alacaklı|borçlu)(?:lar)?(?:a|ya|lara)?(?=\s)\s*(?:olarak\s*)?/gi;
  const roller = [...x.matchAll(ROL)];
  roller.forEach((m, i) => {
    const bas = (m.index || 0) + m[0].length;
    const bit = i + 1 < roller.length ? roller[i + 1].index || x.length : x.length;
    let parca = x.slice(bas, bit);
    parca = parca.split(/\s(?:da|de)\s+(?:ekle|yaz|koy)|\s(?:ekle|yaz|koy)(?:yin|yiniz|r misin)?\b|[.;!?]/i)[0];
    parca = parca.replace(/\s+(?:ile|ve)\s*$/i, "").replace(/^\s*(?:olarak|da|de)\s+/i, "");
    const adlar = parca.split(/\s*,\s*|\s+ve\s+|\s+ile\s+/i).map(a => a.trim()).filter(a => a.length >= 3 && !/^(taraf|taraflar|kişi|kişiler|da|de)$/i.test(a));
    const hedef = /alacak/i.test(m[1]) ? out.alacaklilar : out.borclular;
    for (const a of adlar) if (!hedef.includes(a)) hedef.push(a);
  });
  return out;
}

const sade = (x?: string) => ust(x || "").replace(/[^A-ZÇĞİÖŞÜÂÎÛ ]/g, " ").replace(/\s+/g, " ").trim();
/** Talimattaki adı ("kurgu yılmazı", "Ali'yi") evraktaki taraflarla ya da metinle eşleştirir; bulunamazsa eki atıp düzgün yazar. */
export function adCoz(ham: string, taraflar: TarafOneri[], kaynak = ""): TarafKisi {
  const h = sade(ham.replace(/['’][a-zçğıöşü]+$/i, ""));
  for (const t of taraflar) {
    const s = sade(t.ad);
    if (s && (h === s || (h.startsWith(s) && h.length - s.length <= 3) || (s.startsWith(h) && h.length >= 5))) return { ad: t.ad, kimlikNo: t.kimlikNo, adres: t.adres };
  }
  // Metinde (ör. ilamın gövdesinde) geçen yazımı: son sözcük 0-3 harf kısaltılarak aranır.
  const ks = h.split(" ");
  const u = ust(kaynak);
  for (let k = 0; k <= 3 && kaynak; k++) {
    const son = ks[ks.length - 1];
    if (son.length - k < 3) break;
    const aday = [...ks.slice(0, -1), son.slice(0, son.length - k)].join(" ");
    const i = u.search(new RegExp(`(?<![A-ZÇĞİÖŞÜ])${aday.replace(/\s+/g, "\\s+")}(?![A-ZÇĞİÖŞÜ])`));
    if (i >= 0) return { ad: bicim(kaynak.slice(i, i + aday.length).replace(/\s+/g, " ")) };
  }
  // Son sözcükteki belirtme eki ("keskini", "yılmazı"): ünsüzden sonra gelen tek ünlü atılır.
  const son = ks[ks.length - 1];
  const ekli = /[BCÇDFGĞHJKLMNPRSŞTVYZ][IİUÜ]$/.test(son) && son.length > 4;
  return { ad: bicim([...ks.slice(0, -1), ekli ? son.slice(0, -1) : son].join(" ")) };
}
const bicim = (x: string) => x.toLocaleLowerCase("tr").replace(/(^|\s)(\p{L})/gu, (_m, a, b) => a + b.toLocaleUpperCase("tr"));

/**
 * Talimatı föye uygular: alacak kalemleri (talimattaki tutarlar hükümden okunanların üstüne yazılır, olmayan eklenir),
 * ek alacaklılar (künyedeki müvekkillere) ve ek borçlular (takibin borçlularına).
 */
export function talimatUygula(f: Foy, r: TalimatSonucu, opt: { taraflar?: TarafOneri[]; kaynak?: string; hukumKalemleri?: Kalem[]; kararTarihi?: string; ilamli?: boolean }): { ek: Partial<Foy>; dolan: string[] } {
  const dolan: string[] = [];
  const ek: Partial<Foy> = {};
  const b: IcraBilgi = { ...(f.icra || { yol: "genel", paraBirimi: "TL", faizTuru: "yasal" }) };
  let icraDegisti = false;
  if (r.kalemler.length || opt.hukumKalemleri?.length) {
    const mevcut = (b.kalemler || []).filter(k => k.tutar);
    const temel: Kalem[] = mevcut.length ? mevcut.map(k => ({ ...k })) : (opt.hukumKalemleri || []).map(k => ({ ...k }));
    for (const t of r.kalemler) {
      const i = temel.findIndex(k => k.ad.replace(/\s*\((?:brüt|net)\)$/i, "") === t.ad);
      if (i >= 0) { if (temel[i].tutar !== t.tutar) { temel[i].tutar = t.tutar; dolan.push(`${t.ad}: ${t.tutar.toLocaleString("tr-TR")} TL`); } }
      else { temel.push({ ad: t.ad, tutar: t.tutar, faizTuru: "yasal", faizBaslangic: opt.kararTarihi }); dolan.push(`${t.ad}: ${t.tutar.toLocaleString("tr-TR")} TL`); }
    }
    if (!mevcut.length && opt.hukumKalemleri?.length) dolan.unshift(`hükümden ${opt.hukumKalemleri.length} kalem`);
    if (JSON.stringify(temel) !== JSON.stringify(mevcut)) { b.kalemler = temel; b.asil = undefined; b.islemisFaizElle = undefined; b.ilamVekalet = undefined; b.yargilamaGideri = undefined; icraDegisti = true; }
  }
  if (opt.ilamli && b.yol !== "ilamli") { b.yol = "ilamli"; b.talep = "haciz"; if (!b.mahiyet) b.mahiyet = "4045"; icraDegisti = true; dolan.push("takip yolu: ilamlı"); }
  const taraflar = opt.taraflar || [];
  const ayni = (a?: string, c?: string) => { const x = sade(a), y = sade(c); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };
  // Borçlularda yalnız tam eşleşme: "Ali Kaya" ile "Ali Kaya İnşaat Ltd." ayrı kişilerdir.
  const ayniTam = (a?: string, c?: string) => { const x = sade(a), y = sade(c); return !!x && x === y; };
  // Ek alacaklılar → künyedeki müvekkiller.
  const ekM = [...(f.ekMuvekkiller || [])];
  for (const a of r.alacaklilar) {
    const k = adCoz(a, taraflar, opt.kaynak);
    if (ayni(k.ad, f.muvekkil) || ekM.some(x => ayni(x.ad, k.ad))) continue;
    if (!(f.muvekkil || "").trim()) { ek.muvekkil = k.ad; ek.muvekkilBilgi = { ...(f.muvekkilBilgi || {}), kimlikNo: k.kimlikNo, adres: k.adres }; }
    else ekM.push(k);
    dolan.push("alacaklı " + k.ad);
  }
  if (ekM.length !== (f.ekMuvekkiller || []).length) ek.ekMuvekkiller = ekM;
  // Ek borçlular → takibin borçluları.
  const ekB = [...(b.ekBorclular || [])];
  for (const a of r.borclular) {
    const k = adCoz(a, taraflar, opt.kaynak);
    if (ayniTam(k.ad, f.karsiTaraf) || ekB.some(x => ayniTam(x.ad, k.ad))) continue;
    if (!(f.karsiTaraf || "").trim()) { ek.karsiTaraf = k.ad; ek.karsiBilgi = { ...(f.karsiBilgi || {}), kimlikNo: k.kimlikNo, adres: k.adres }; }
    else ekB.push({ ad: k.ad, kimlikNo: k.kimlikNo, adres: k.adres });
    dolan.push("borçlu " + k.ad);
  }
  if (ekB.length !== (b.ekBorclular || []).length) {
    b.ekBorclular = ekB; icraDegisti = true;
    // İcra föyünün künyesindeki karşı taraflar da borçlulardır.
    if (f.tur === "icra") { const ekK = [...(f.ekKarsiTaraflar || [])]; for (const x of ekB) if (!ekK.some(y => ayni(y.ad, x.ad))) ekK.push({ ad: x.ad, kimlikNo: x.kimlikNo, adres: x.adres }); ek.ekKarsiTaraflar = ekK; }
  }
  if (icraDegisti) ek.icra = b;
  return { ek, dolan };
}
