// Takibe konu evraktan icra bilgisi (cihazda, yapay zekâsız): ilamın mahkemesi, esas/karar no'su, karar tarihi ve hüküm
// fıkrasındaki alacak kalemleri (tutar, faiz türü, faiz başlangıcı); çekin seri no'su, keşide/ibraz tarihi, bankası ve tutarı;
// bononun düzenleme ve vade tarihi; kira sözleşmesinin tarihi ve aylık kirası; faturanın tarihi, numarası ve tutarı.
// Yalnız boş alanlar doldurulur; avukat her zaman kontrol eder.
import type { FaizTuru, IcraBilgi, Kalem, TakipYolu } from "./icra";
import type { Foy } from "./foy";
import { kunyeCikar, TarafOneri } from "./kunyeCikar";

export type IcraEvrakTuru = "ilam" | "cek" | "senet" | "kira" | "fatura" | "diger";

const para = (x: string) => Number(x.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
const iso = (g: string, a: string, y: string) => `${y}-${a.padStart(2, "0")}-${g.padStart(2, "0")}`;
const TARIH = /(\d{1,2})[./-](\d{1,2})[./-]((?:19|20)\d{2})/;
// Tutar: "15.000,00 TL", "15.000 TL", "15.000,00-TL", "15.000,00.-TL", "15000 TL", "1.500.000,00 Türk Lirası".
const TUTAR = /(?<![\d.,])(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:[.,]?\s*-\s*)?(?:TL|TRY|₺|Türk Lirası)(?![\p{L}])/iu;
const TUTARLAR = new RegExp(TUTAR.source, "giu");
const ust = (x: string) => x.toLocaleUpperCase("tr");

// Ekranda her çizimde aynı evrak yeniden taranmasın: aynı metnin sonucu saklanır (son birkaç metin; metin değişirse yeniden okunur).
function onbellekli<T>(f: (m: string) => T, boy = 24): (m: string) => T {
  const sakla = new Map<string, T>();
  return (m: string) => {
    const v = sakla.get(m);
    if (v !== undefined) return v;
    const r = f(m);
    if (sakla.size >= boy) sakla.delete(sakla.keys().next().value as string);
    sakla.set(m, r);
    return r;
  };
}
export const evrakTuruBul = onbellekli(evrakTuruBulHam);
function evrakTuruBulHam(metin: string): IcraEvrakTuru {
  const u = ust(metin.slice(0, 6000));
  // İlam: hüküm kısmı uzun gerekçeden sonra (metnin sonunda) da olur; bölge adliye ve Yargıtay kararları da ilamdır.
  // Avukatın kendi dilekçesi ("… ilamı …, arz ve talep ederiz") ilam değildir.
  const tum = ust(metin);
  const dilekce = /ARZ VE TALEP|ARZ EDERİ[MZ]|SAYGILARIMLA|SAYGILARIMIZLA/.test(tum.slice(-1500)) && !/E-?İMZALIDIR|KATİP|ZABIT KATİBİ/.test(tum.slice(-1500));
  const hukumVar = /GEREKÇELİ KARAR|KISA KARAR|HÜKÜM\s*:|HÜKÜM\s+(?:GEREKÇESİ|YUKARIDA)|GEREĞİ DÜŞÜNÜLDÜ|İLAM|KARAR VERİLDİ|OY ?BİRLİĞİ(?:YLE|İLE)|OY ÇOKLUĞU(?:YLA|İLE)/.test(tum);
  const kararBasligi = /KARAR\s*(NO|TARİHİ|NUMARASI)|BÖLGE ADLİYE MAHKEMESİ|YARGITAY|HUKUK DAİRESİ/.test(tum);
  if (!dilekce && hukumVar && kararBasligi) return "ilam";
  if (/\bÇEK\b|ÇEK NO|KARŞILIKSIZ|MUHATAP BANKA|KEŞİDE YERİ/.test(u) && !/BONO|EMRE MUHARRER/.test(u)) return "cek";
  if (/BONO|EMRE MUHARRER|SENET/.test(u) && /VADE/.test(u)) return "senet";
  if (/KİRA SÖZLEŞMESİ|KİRA KONTRATI|AYLIK KİRA/.test(u)) return "kira";
  if (/FATURA/.test(u) && /(GENEL TOPLAM|ÖDENECEK TUTAR|FATURA NO|FATURA TARİHİ)/.test(u)) return "fatura";
  return "diger";
}

function faizTuru(x: string): FaizTuru | undefined {
  const u = ust(x);
  if (/1530/.test(u)) return "ttk1530";
  if (/AVANS|TİCARİ|REESKONT|3095.{0,30}2\.\s*MADDE/.test(u)) return "avans";
  if (/EN YÜKSEK MEVDUAT|MEVDUAT/.test(u)) return "mevduat";
  if (/YASAL|KANUNİ|ADİ KANUNİ/.test(u)) return "yasal";
  if (/FAİZSİZ|FAİZ İŞLETİLMEKSİZİN/.test(u)) return "yok";
  return undefined;
}

/** "01/06/2024 tarihinden", "15/03/2024 fesih tarihinden", "01.01.2025 T.", "01/02/2023'den itibaren" */
const TARIH_IFADE = new RegExp(TARIH.source + "(?:['’]?[\\p{L}]{2,4})?\\s*(?:[\\p{L}]+\\s+){0,3}?(?:tarihinden|tarihi|T\\.|itibaren)", "iu");
/** Metinde ilk geçen faiz türü (birden çok faiz türü sayılan cümlede en yakındaki). */
function faizTuruIlk(x: string): FaizTuru | undefined {
  const u = ust(x);
  const adaylar: [RegExp, FaizTuru][] = [[/1530/, "ttk1530"], [/AVANS|TİCARİ|REESKONT/, "avans"], [/MEVDUAT/, "mevduat"], [/YASAL|KANUNİ/, "yasal"], [/FAİZSİZ|FAİZ İŞLETİLMEKSİZİN/, "yok"]];
  let en: FaizTuru | undefined, yer = Infinity;
  for (const [re, tur] of adaylar) { const i = u.search(re); if (i >= 0 && i < yer) { yer = i; en = tur; } }
  return en;
}

/** Hükmün kimin lehine olduğu: davacı tarafı (davacı, katılan, alacaklı…), davalı tarafı (davalı, sanık, borçlu…), Hazine,
 *  iade (yatırılan avansın geri verilmesi), reddedilen kısım ya da anlaşılamayan. */
export type Lehine = "birinci" | "ikinci" | "hazine" | "iade" | "red" | "belirsiz";
export interface HukumKalemi extends Kalem { lehine: Lehine; cumle: string; brutMu?: boolean }

/** İlamın başındaki taraflar (davacı / davalı, vekilleri) ve tarihleri. */
export interface IlamTaraflari { birinci?: { ad: string; vekil?: string; vekilAdres?: string }; ikinci?: { ad: string; vekil?: string; vekilAdres?: string }; birinciler: TarafOneri[]; ikinciler: TarafOneri[]; davaTarihi?: string; kararTarihi?: string; islahTarihi?: string }
export const ilamTaraflari = onbellekli(ilamTaraflariHam, 12);
function ilamTaraflariHam(metin: string): IlamTaraflari {
  const k = kunyeCikar(metin);
  const tarih = (re: RegExp) => { const m = ust(metin).match(new RegExp(re.source + "\\s*[:.]?\\s*" + TARIH.source)); return m ? iso(m[m.length - 3], m[m.length - 2], m[m.length - 1]) : undefined; };
  const islah = ust(metin).match(new RegExp(TARIH.source + "\\s*(?:TARİHLİ|TARİHİNDE|T\\.)?\\s*(?:[\\p{L}]+\\s+){0,2}?ISLAH", "u")) || ust(metin).match(new RegExp("ISLAH\\s*(?:DİLEKÇESİ|TARİHİ)?\\s*(?:İLE|OLAN)?\\s*[:(]?\\s*" + TARIH.source, "u"));
  // Vekilin adresi: "VEKİLİ : Av. …" satırının altındaki adres satırı (ilk vekil satırı davacı tarafının, sonraki davalınınki).
  const vekilAdres = (vekil?: string) => {
    if (!vekil) return undefined;
    const soy = ust(vekil.replace(/^av\.?\s*/i, "").trim().split(/\s+/).pop() || "");
    const satir = metin.replace(/\r/g, "").split("\n").map(x => x.trim());
    for (let i = 0; i < Math.min(satir.length, 150); i++) {
      if (!/VEKİLİ|VEKİLLERİ/.test(ust(satir[i])) || !soy || !ust(satir[i]).includes(soy)) continue;
      const alt = satir[i + 1] || "";
      if (/\b(?:Mah|Cad|Sok|Sk|Bulv|Blv)\b\.?|Mahallesi|Caddesi|Sokak/i.test(alt) && !/^(DAVA|DAVALI|DAVACI|SANIK|KATILAN)/i.test(ust(alt))) return alt.replace(/\s+/g, " ").trim();
    }
    return undefined;
  };
  return {
    birinci: k.birinci?.ad ? { ad: k.birinci.ad, vekil: k.birinci.vekil, vekilAdres: vekilAdres(k.birinci.vekil) } : undefined,
    ikinci: k.ikinci?.ad ? { ad: k.ikinci.ad, vekil: k.ikinci.vekil, vekilAdres: vekilAdres(k.ikinci.vekil) } : undefined,
    birinciler: k.birinciler?.length ? k.birinciler : k.birinci ? [k.birinci] : [], ikinciler: k.ikinciler?.length ? k.ikinciler : k.ikinci ? [k.ikinci] : [],
    davaTarihi: tarih(/DAVA\s*(?:AÇILIŞ\s*)?TARİHİ/), kararTarihi: tarih(/KARAR\s*TARİHİ/) || k.belgeTarihi,
    islahTarihi: islah ? iso(islah[1], islah[2], islah[3]) : undefined
  };
}

const sade = (x?: string) => ust(x || "").replace(/[^A-ZÇĞİÖŞÜ ]/g, " ").replace(/\b(A Ş|LTD|ŞTİ|ANONİM|LİMİTED|ŞİRKETİ)\b/g, " ").replace(/\s+/g, " ").trim();
export const ayniKisi = (a?: string, b?: string) => { const x = sade(a), y = sade(b); return x.length > 3 && y.length > 3 && (x.includes(y) || y.includes(x)); };

/**
 * İlamın başındaki taraflardan takibin alacaklısı (müvekkil) ve borçlusu (karşı taraf): bizim tarafımız alacaklı, öteki taraf
 * borçludur; birden çok borçlu varsa ötekiler ek borçlu olur. Boş alanlar doldurulur; müvekkil ya da karşı taraf hanesinde
 * yanlış kişi (ör. karşı tarafa müvekkilin adı) yazılıysa düzeltilir. Elle yazılmış başka bir ad varsa dokunulmaz, öneri döner.
 */
export function ilamdanTaraflar(f: Foy, it: IlamTaraflari, yan: "birinci" | "ikinci", opt: { ekAlacakli?: boolean } = {}): { ek: Partial<Foy>; dolan: string[]; oneri?: TarafOneri } {
  const biz = yan === "birinci" ? it.birinciler : it.ikinciler;
  const onlar = yan === "birinci" ? it.ikinciler : it.birinciler;
  const bizV = (yan === "birinci" ? it.birinci : it.ikinci)?.vekil, onlarV = (yan === "birinci" ? it.ikinci : it.birinci)?.vekil;
  const ek: Partial<Foy> = {};
  const dolan: string[] = [];
  let oneri: TarafOneri | undefined;
  const bos = (x?: string) => !x || !x.trim();
  if (biz[0]) {
    const yanlis = bos(f.muvekkil) || onlar.some(x => ayniKisi(x.ad, f.muvekkil));
    if (yanlis) {
      ek.muvekkil = biz[0].ad; dolan.push("alacaklı (müvekkil)");
      ek.muvekkilBilgi = { ...(f.muvekkilBilgi || {}), kimlikNo: biz[0].kimlikNo || (bos(f.muvekkil) ? f.muvekkilBilgi?.kimlikNo : undefined), adres: biz[0].adres || (bos(f.muvekkil) ? f.muvekkilBilgi?.adres : undefined), vekil: f.muvekkilBilgi?.vekil || bizV };
    } else if (ayniKisi(biz[0].ad, f.muvekkil)) {
      const mb = { ...(f.muvekkilBilgi || {}) }; let d = false;
      if (bos(mb.kimlikNo) && biz[0].kimlikNo) { mb.kimlikNo = biz[0].kimlikNo; d = true; }
      if (bos(mb.adres) && biz[0].adres) { mb.adres = biz[0].adres; d = true; }
      if (bos(mb.vekil) && bizV) { mb.vekil = bizV; d = true; }
      if (d) { ek.muvekkilBilgi = mb; dolan.push("alacaklı bilgileri"); }
    }
  }
  // Birden çok alacaklı (davacılar): ötekiler künyedeki ek müvekkiller olur (liste boşsa). Yalnız o tarafın vekili bizsek:
  // aynı taraftaki öteki kişilerin başka avukatı olabilir.
  if (opt.ekAlacakli && biz.length > 1 && !(f.ekMuvekkiller || []).some(x => x.ad.trim())) {
    const ana = ek.muvekkil || f.muvekkil;
    const ekler = biz.filter(x => !ayniKisi(x.ad, ana));
    if (ekler.length) { ek.ekMuvekkiller = ekler.map(x => ({ ad: x.ad, kimlikNo: x.kimlikNo, adres: x.adres })); dolan.push(ekler.length + " ek alacaklı"); }
  }
  if (onlar[0]) {
    const muv = ek.muvekkil || f.muvekkil;
    const yanlis = bos(f.karsiTaraf) || ayniKisi(f.karsiTaraf, muv) || biz.some(x => ayniKisi(x.ad, f.karsiTaraf));
    if (yanlis) {
      ek.karsiTaraf = onlar[0].ad; dolan.push("borçlu (karşı taraf)");
      ek.karsiBilgi = { ...(f.karsiBilgi || {}), kimlikNo: onlar[0].kimlikNo, adres: onlar[0].adres, vekil: onlarV };
    } else if (onlar.some(x => ayniKisi(x.ad, f.karsiTaraf))) {
      const o0 = onlar.find(x => ayniKisi(x.ad, f.karsiTaraf))!;
      const kb = { ...(f.karsiBilgi || {}) }; let d = false;
      if (bos(kb.kimlikNo) && o0.kimlikNo) { kb.kimlikNo = o0.kimlikNo; d = true; }
      if (bos(kb.adres) && o0.adres) { kb.adres = o0.adres; d = true; }
      if (bos(kb.vekil) && onlarV) { kb.vekil = onlarV; d = true; }
      if (d) { ek.karsiBilgi = kb; dolan.push("borçlu bilgileri"); }
    } else oneri = onlar[0];
    // Birden çok borçlu: ötekiler ek borçlu.
    const birinciBorclu = ek.karsiTaraf || f.karsiTaraf;
    const ekler = onlar.filter(x => !ayniKisi(x.ad, birinciBorclu));
    // Eksik olanlar takibin borçlu kutularına ("2. borçlu", "3. borçlu") eklenir; önceden yazılmış ek borçlular korunur, boş kalan
    // kimlik no ve adresleri ilamdan tamamlanır. Künyede (öteki karşı taraflar) zaten yazılı olsa da takibin kutusuna da yazılır.
    const mevcut = (f.icra?.ekBorclular || []).filter(x => x.ad.trim());
    const yeni = ekler.filter(x => !mevcut.some(y => ayniKisi(y.ad, x.ad)));
    let tamam = 0;
    const eskiler = mevcut.map(y => {
      const x = ekler.find(z => ayniKisi(z.ad, y.ad));
      if (!x || ((y.kimlikNo || !x.kimlikNo) && (y.adres || !x.adres))) return y;
      tamam++;
      return { ...y, kimlikNo: y.kimlikNo || x.kimlikNo, adres: y.adres || x.adres };
    });
    if (yeni.length || tamam) {
      ek.icra = { ...(f.icra || { yol: "ilamli" }), ekBorclular: [...eskiler, ...yeni.map(x => ({ ad: x.ad, kimlikNo: x.kimlikNo, adres: x.adres }))] } as IcraBilgi;
      if (yeni.length) dolan.push(yeni.length + " ek borçlu");
      if (tamam) dolan.push("ek borçlu bilgileri");
      // İcra föyünün künyesinde karşı taraflar borçlulardır: künyede de görünsünler.
      if (f.tur === "icra" && yeni.length) ek.ekKarsiTaraflar = [...(f.ekKarsiTaraflar || []), ...yeni.filter(x => !(f.ekKarsiTaraflar || []).some(y => ayniKisi(y.ad, x.ad))).map(x => ({ ad: x.ad, kimlikNo: x.kimlikNo, adres: x.adres }))];
    }
    // Künyedeki öteki karşı tarafların boş kimlik no ve adresi de ilamdan tamamlanır (icra föyünde).
    if (f.tur === "icra") {
      const kt = ek.ekKarsiTaraflar || f.ekKarsiTaraflar || [];
      let d = false;
      const kt2 = kt.map(y => { const x = ekler.find(z => ayniKisi(z.ad, y.ad)); if (!x || ((y.kimlikNo || !x.kimlikNo) && (y.adres || !x.adres))) return y; d = true; return { ...y, kimlikNo: y.kimlikNo || x.kimlikNo, adres: y.adres || x.adres }; });
      if (d) ek.ekKarsiTaraflar = kt2;
    }
  }
  return { ek, dolan, oneri };
}

/** Bir tarafın hükümde adıyla anılabilmesi için ayırt edici sözcükleri (soyadı, şirket adının ilk sözcüğü). */
function adSozcukleri(ad?: string): string[] {
  if (!ad) return [];
  const w = ust(ad).replace(/[^A-ZÇĞİÖŞÜÂÎÛ ]/g, " ").split(/\s+/).filter(x => x.length >= 4 && !/^(ANONİM|ŞİRKETİ|LİMİTED|TİCARET|SANAYİ|VEKİLİ|DAVACI|DAVALI)$/.test(x));
  return /A\.?\s?Ş|LTD|ŞTİ|ŞİRKET/i.test(ad) ? w.slice(0, 1) : w.slice(-1);
}

/** "DAVACI-KARŞI DAVALIYA" → "DAVACIYA": karşı ve birleşen davadaki çift rol, asıl davadaki rolüne indirilir. */
const ciftRol = (u: string) => u
  .replace(/DAVACI(LAR)?\s*[-–/]?\s*\(?\s*(?:KARŞI|BİRLEŞEN DAVADA|BİRLEŞEN DAVA|KARŞI DAVADA)\s*DAVALI(LAR)?\s*\)?/g, (_m, a, b2) => "DAVACI" + (a || b2 || ""))
  .replace(/DAVALI(LAR)?\s*[-–/]?\s*\(?\s*(?:KARŞI|BİRLEŞEN DAVADA|BİRLEŞEN DAVA|KARŞI DAVADA)\s*DAVACI(LAR)?\s*\)?/g, (_m, a, b2) => "DAVALI" + (a || b2 || ""));
const ROL_KOK: [RegExp, "birinci" | "ikinci"][] = [[/DAVACI|KATILAN|MÜŞTEKİ|ALACAKLI|BAŞVURUCU|MÜDAHİL|İHBAR EDEN/, "birinci"], [/DAVALI|SANIK|BORÇLU|ŞÜPHELİ/, "ikinci"]];
const BIRINCI_YON = /DAVACI(?:LAR)?(?:A|YA)\b|DAVACI(?:LAR)? VEKİLİNE|KATILAN(?:LAR)?A\b|MÜŞTEKİ(?:LER)?(?:E|YE)\b|ALACAKLI(?:LAR)?(?:A|YA)\b|BAŞVURUCU(?:LAR)?(?:A|YA)\b|MÜDAHİL(?:LER)?E\b|İHBAR EDENE\b/g;
const IKINCI_YON = /DAVALI(?:LAR)?(?:A|YA)\b|DAVALI(?:LAR)? VEKİLİNE|SANIĞA\b|SANIKLARA\b|BORÇLU(?:LAR)?(?:A|YA)\b|ŞÜPHELİ(?:LER)?(?:E|YE)\b/g;
const ALAN = /ALINARAK|TAHSİLİ İLE|TAHSİLİYLE|TAHSİLLE|TAHSİL EDİLEREK|TAHSİLİNE/;
/**
 * Fıkranın kimin lehine olduğu. Sırasıyla: reddedilen, iade, Hazine; "… LEHİNE / YARARINA"; parayı alan ("alınarak" /
 * "tahsili ile" sözünden sonra anılan taraf, rolüyle ya da adıyla); yalnız ödeyen anılmışsa ("davalıdan tahsiline") öteki taraf;
 * en son fiilden önceki son "…-e / -a" (davacıya, davalıya).
 */
function lehineBul(uc0: string, adlar: { birinci: string[]; ikinci: string[] } = { birinci: [], ikinci: [] }): Lehine {
  const uc = ciftRol(uc0);
  if (/REDDİNE|REDDİ İLE/.test(uc) && !ALAN.test(uc)) return "red";
  if (/İADESİNE|İADE EDİLMESİNE/.test(uc)) return "iade";
  if (/HAZİNEYE|HAZİNE ADINA|GELİR KAYDI|İRAT KAYDI|İRAD KAYDI/.test(uc)) return "hazine";
  const lehine = uc.match(/(DAVACI|DAVALI|KATILAN|SANIK|ALACAKLI|BORÇLU)(?:LAR)?\s*(?:[\p{L}.]+\s+){0,3}?(?:LEHİNE|YARARINA)/u);
  const rolu = (x: string): "birinci" | "ikinci" | undefined => ROL_KOK.find(([re]) => re.test(x))?.[1];
  const adla = (x: string): "birinci" | "ikinci" | undefined => {
    const b1 = adlar.birinci.some(a => x.includes(a)), b2 = adlar.ikinci.some(a => x.includes(a));
    return b1 && !b2 ? "birinci" : b2 && !b1 ? "ikinci" : undefined;
  };
  const al = uc.match(ALAN);
  if (al && al[0] !== "TAHSİLİNE") {
    // Parayı alan: "alınarak"tan sonraki ilk rol ya da ad ("… alınarak davacı işçiye verilmesine").
    const sonra = uc.slice((al.index || 0) + al[0].length);
    const ilk = sonra.match(/DAVACI|DAVALI|KATILAN|MÜŞTEKİ|ALACAKLI|BORÇLU|SANIK|BAŞVURUCU/);
    const r = ilk ? rolu(ilk[0]) : undefined;
    const a = adla(sonra);
    if (r && !(a && a !== r && sonra.indexOf(ilk![0]) > 40)) return r;
    if (a) return a;
  }
  if (lehine) return rolu(lehine[1])!;
  // Yalnız ödeyen anılmış: "davalıdan tahsiline", "davalılardan müştereken ve müteselsilen alınarak".
  const oder = uc.match(/(DAVACI|DAVALI|SANIK|BORÇLU|KATILAN)(?:LAR)?(?:DAN|TAN)\b/);
  const son = (re: RegExp) => { let i = -1; for (const m of uc.matchAll(re)) i = m.index ?? i; return i; };
  const b = son(BIRINCI_YON), k = son(IKINCI_YON);
  if (b >= 0 || k >= 0) return b > k ? "birinci" : "ikinci";
  if (oder) return rolu(oder[1]) === "birinci" ? "ikinci" : "birinci";
  return "belirsiz";
}

/** Hükmü fıkralara ayırır: madde numaraları ("1-", "2)") ve hüküm fiilleri ("…verilmesine,", "…reddine,") fıkra sonudur. */
function fikralar(hukum: string): string[] {
  const FIIL = /(VERİLMESİNE|ÖDENMESİNE|TAHSİLİNE|REDDİNE|KAYDINA|İADESİNE|BIRAKILMASINA|MAHSUBUNA|HÜKMEDİLMESİNE|KABULÜNE|YÜKLETİLMESİNE|TAKDİRİNE|YER OLMADIĞINA|DAİR)\s*[,;.]?/g;
  const out: string[] = [];
  for (const parca of hukum.split(/\s(?=\d{1,2}\s*[-)]\s*\p{L})/u)) {
    const u = ust(parca);
    let bas = 0;
    for (const m of u.matchAll(FIIL)) { const son = (m.index || 0) + m[0].length; out.push(parca.slice(bas, son)); bas = son; }
    if (bas < parca.length) out.push(parca.slice(bas));
  }
  return out.map(x => x.trim()).filter(Boolean);
}

/**
 * İlamın yalnız hüküm kısmı: son "HÜKÜM" başlığından (ya da "GEREĞİ DÜŞÜNÜLDÜ") "açıkça okunup usulen anlatıldı"ya kadar.
 * İddia ve savunma özetindeki talep tutarları, gerekçedeki bilirkişi hesapları ve hükmün altındaki yargılama gideri dökümü
 * hüküm sayılmaz.
 */
const duzle = (metin: string) => metin.replace(/\s+/g, " ").replace(/H\s?Ü\s?K\s?Ü\s?M(?=\s*[:\-;]|\s+(?:Gerekçe|GEREKÇE|Yukarı|YUKARI|Açıkla|AÇIKLA|\d{1,2}\s*[-)]))/g, "HÜKÜM");
/** Düzlenmiş metinde hüküm başlığının yeri (son "HÜKÜM" ya da "GEREĞİ DÜŞÜNÜLDÜ"); yoksa -1. */
function hukumYeri(u: string): number {
  let i = -1;
  for (const m of u.matchAll(/\bHÜKÜM\s*(?:FIKRASI\s*)?(?::|-|;|(?=\s+(?:Gerekçe|GEREKÇE|Yukarı|YUKARI|Açıkla|AÇIKLA|\d{1,2}\s*[-)])))|GEREĞİ DÜŞÜNÜLDÜ|Gereği Düşünüldü|Gereği düşünüldü/g)) i = m.index || 0;
  return i;
}
export function hukumBolumu(metin: string): string {
  const u = duzle(metin);
  const i = Math.max(hukumYeri(u), 0);
  const kalan = u.slice(i);
  const son = kalan.slice(20).search(/açıkça okunup|AÇIKÇA OKUNUP|usulen anlatıldı|USULEN ANLATILDI|okunup anlatıldı|OKUNUP ANLATILDI|usulen tefhim|USULEN TEFHİM|YARGILAMA GİDERLERİ\s*:|Davacı Tarafından Yapılan Yargılama Gider(?:i|leri)\s*:|Katip\s+\d|Başkan\s+\d|Hakim\s+\d|e-imzalıdır/);
  return son >= 0 ? kalan.slice(0, son + 20) : kalan;
}

/** Tutardan sonra gelen "talebin", "üzerinden", "harçtan mahsubu" gibi sözler o tutarın hükmedilen alacak olmadığını gösterir. */
const ALACAK_DEGIL = /^\S{0,6}\s*(?:['’]?[\p{L}]{0,5}\s+)?(?:TALEB|İSTEM|ÜZERİNDEN|DEĞERİNDEN|DEĞERLİ|ISLAH|HARÇTAN|HARCIN MAHSUBU|MAHSUBU|DAVA DEĞER|KISMIN|ASIL ALACAK TALEB)/u;

/** Hüküm fıkrasındaki bütün para tutarları, kimin lehine olduklarıyla. */
export function hukumAnaliz(metin: string, kararTarihi?: string): HukumKalemi[] {
  const it = ilamTaraflari(metin);
  const kt = kararTarihi || it.kararTarihi;
  const adlar = { birinci: adSozcukleri(it.birinci?.ad), ikinci: adSozcukleri(it.ikinci?.ad) };
  const hukum = hukumBolumu(metin);
  const out: HukumKalemi[] = [];
  const ekle = (k: HukumKalemi) => { if (k.tutar > 0 && !out.some(x => x.ad === k.ad && x.tutar === k.tutar && x.lehine === k.lehine)) out.push(k); };
  const kalemAdi = (uc: string) => /MANEVİ TAZMİNAT/.test(uc) ? "Manevi tazminat" : /MADDİ TAZMİNAT|DESTEKTEN YOKSUN|İŞ GÖREMEZLİK|İŞGÖREMEZLİK/.test(uc) ? "Maddi tazminat"
    : /KIDEM/.test(uc) ? "Kıdem tazminatı" : /İHBAR/.test(uc) ? "İhbar tazminatı" : /FAZLA (?:MESAİ|ÇALIŞMA)/.test(uc) ? "Fazla mesai alacağı"
    : /YILLIK (?:ÜCRETLİ )?İZİN/.test(uc) ? "Yıllık izin ücreti" : /GENEL TATİL|BAYRAM/.test(uc) ? "UBGT alacağı" : /HAFTA TATİLİ/.test(uc) ? "Hafta tatili alacağı"
    : /KÖTÜ ?NİYET/.test(uc) ? "Kötüniyet tazminatı" : /ÜCRET ALACAĞ|BAKİYE ÜCRET|ÜCRETİN/.test(uc) ? "Ücret alacağı" : /PRİM/.test(uc) ? "Prim alacağı"
    : /NAFAKA/.test(uc) ? "Nafaka" : /KİRA/.test(uc) ? "Kira bedeli" : /DEĞER KAYB/.test(uc) ? "Değer kaybı" : /ARAÇ MAHRUMİYET|KAZANÇ KAYB/.test(uc) ? "Kazanç kaybı" : "Asıl alacak";
  // Faiz başlangıcı: yazılı tarih; yoksa "dava tarihinden", "karar tarihinden", "ıslah tarihinden" başlıktaki tarihten.
  const baslangic = (x: string): string | undefined => {
    const t = x.match(TARIH_IFADE);
    if (t) return iso(t[1], t[2], t[3]);
    const u = ust(x.slice(0, 220));
    if (/DAVA TARİHİ/.test(u)) return it.davaTarihi;
    if (/ISLAH/.test(u)) return it.islahTarihi;
    if (/KARAR TARİHİ|HÜKÜM TARİHİ/.test(u)) return kt;
    return undefined;
  };
  for (const c of fikralar(hukum)) {
    const tutarlar = [...c.matchAll(TUTARLAR)];
    if (!tutarlar.length) continue;
    const uc = ust(c);
    const lehine = lehineBul(uc, adlar);
    const cumle = c.slice(0, 400);
    const fzC = faizTuru(c) || "yasal";
    // Gider kalemleri (vekâlet ücreti, yargılama gideri, harç): fıkrada birçok tutar sayılsa da alınacak olan, "alınarak /
    // tahsili ile" sözünden hemen önceki tutardır ("toplam 2.450 TL giderden kabul oranına göre 2.100 TL'nin davalıdan alınarak").
    const tek = () => {
      const al = uc.search(/ALINARAK|TAHSİL/);
      const once = al >= 0 ? tutarlar.filter(m => (m.index || 0) < al) : [];
      return para((once.length ? once[once.length - 1] : tutarlar[tutarlar.length - 1])[1]);
    };
    // Gider kalemlerinde faiz: hüküm faizini ve başlangıcını yazmışsa ("… dava tarihinden itibaren işleyecek yasal faiziyle") o;
    // yazmamışsa karar tarihinden yasal faiz.
    const giderFaiz = (): { faizTuru: FaizTuru; faizBaslangic?: string } => (/FAİZ/.test(uc) ? { faizTuru: faizTuruIlk(c) || fzC, faizBaslangic: baslangic(c.slice(Math.max(0, uc.search(/FAİZ/) - 160))) || kt } : { faizTuru: "yasal", faizBaslangic: kt });
    if (/VEKALET ÜCRET|VEKÂLET ÜCRET|AVUKATLIK ÜCRET/.test(uc)) { ekle({ ad: "Vekâlet ücreti", tutar: tek(), ...giderFaiz(), lehine, cumle }); continue; }
    if (/YARGILAMA GİDER/.test(uc)) { ekle({ ad: "Yargılama gideri", tutar: tek(), ...giderFaiz(), lehine, cumle }); continue; }
    if (/HARÇ|HARC/.test(uc) && lehine !== "hazine") { ekle({ ad: "Harç", tutar: tek(), ...giderFaiz(), lehine, cumle }); continue; }
    // Bir fıkrada birden çok alacak ("50.000 TL kıdem, 20.000 TL ihbar tazminatının … tahsiline"): her tutar kendi kalemi;
    // adı tutarın ardındaki (yoksa önündeki) sözcüklerden; faiz türü ve başlangıcı bu tutardan sonra gelen ilk ifadeden.
    tutarlar.forEach((m, j) => {
      const bas = (m.index || 0) + m[0].length, son = j + 1 < tutarlar.length ? tutarlar[j + 1].index || c.length : c.length;
      if (ALACAK_DEGIL.test(ust(c.slice(bas, bas + 40)))) return;
      const once = c.slice(j ? (tutarlar[j - 1].index || 0) + tutarlar[j - 1][0].length : 0, m.index || 0);
      const sonra = c.slice(bas, Math.min(son, bas + 160));
      let ad = kalemAdi(ust(sonra));
      if (ad === "Asıl alacak") ad = kalemAdi(ust(once.slice(-80)));
      if (ad === "Asıl alacak" && tutarlar.length === 1) ad = kalemAdi(uc);
      const kalanC = c.slice(bas);
      const fz = faizTuruIlk(kalanC) || fzC;
      const brutMu = /BRÜT/.test(ust(once.slice(-20) + " " + sonra.slice(0, 20)));
      ekle({ ad, tutar: para(m[1]), faizTuru: /FAİZ/.test(uc) ? fz : "yok", faizBaslangic: /FAİZ/.test(uc) ? baslangic(kalanC) || baslangic(c) : undefined, lehine, cumle, brutMu });
    });
  }
  return out;
}

/** Hüküm fıkrasından bir tarafın lehine olan alacak kalemleri (varsayılan: davacı tarafı). */
export function hukumKalemleri(metin: string, kararTarihi?: string, yan: "birinci" | "ikinci" = "birinci"): Kalem[] {
  return hukumAnaliz(metin, kararTarihi).filter(x => x.lehine === yan || (x.lehine === "belirsiz" && yan === "birinci" && x.ad !== "Vekâlet ücreti"))
    .map(({ lehine: _l, cumle: _c, brutMu: _b, ...k }) => k);
}

/** Davada istenenler: dilekçenin "NETİCE VE TALEP / SONUÇ VE İSTEM" kısmından ya da ilamın iddia özetinden (ıslahla artırılan
 *  tutar varsa o). Hükümle karşılaştırmak içindir. */
export interface Talep { ad: string; tutar: number; islah?: boolean }
export function talepAnaliz(metin: string): Talep[] {
  const duz = duzle(metin);
  const u = ust(duz);
  const n = u.search(/NETİCE\s*(?:-\s*İ\s*|VE\s*)TALEP|SONUÇ\s*VE\s*(?:İSTEM|TALEP)|NETİCE-İ TALEP/);
  let parcalar: string[];
  if (n >= 0) {
    const kalan = duz.slice(n);
    const z = ust(kalan).slice(30).search(/SAYGILARIMIZLA|SAYGILARIMLA|SAYGI İLE|EKLER\s*:|DELİLLER\s*:|DAVACI VEKİLİ\s+AV|DAVALI VEKİLİ\s+AV/);
    parcalar = [z >= 0 ? kalan.slice(0, z + 30) : kalan.slice(0, 3000)];
  } else {
    const h = hukumYeri(duz);
    const once = duz.slice(0, h > 0 ? h : duz.length);
    parcalar = once.split(/(?<=[.;])\s+(?=[A-ZÇĞİÖŞÜ])/).filter(x => /TALEP|İSTEM|DAVA ETMİŞ|ISLAH/.test(ust(x)) && !/DAVALI VEKİLİ.*(?:CEVAP|SAVUNMA)|REDDİNİ/.test(ust(x)));
  }
  const out: Talep[] = [];
  for (const p of parcalar) {
    const islah = /ISLAH|ARTIR/.test(ust(p));
    const ts = [...p.matchAll(TUTARLAR)];
    ts.forEach((m, j) => {
      const bas = (m.index || 0) + m[0].length;
      const sonra = ust(p.slice(bas, Math.min(j + 1 < ts.length ? ts[j + 1].index || p.length : p.length, bas + 120)));
      const once = ust(p.slice(Math.max(0, (m.index || 0) - 80), m.index || 0));
      if (/HARÇ|VEKALET|VEKÂLET|YARGILAMA GİDER/.test(sonra.slice(0, 30))) return;
      const adBul = (sonra: string) => /KIDEM/.test(sonra) ? "Kıdem tazminatı" : /İHBAR/.test(sonra) ? "İhbar tazminatı" : /FAZLA (?:MESAİ|ÇALIŞMA)/.test(sonra) ? "Fazla mesai alacağı"
        : /YILLIK (?:ÜCRETLİ )?İZİN/.test(sonra) ? "Yıllık izin ücreti" : /GENEL TATİL|BAYRAM/.test(sonra) ? "UBGT alacağı" : /HAFTA TATİLİ/.test(sonra) ? "Hafta tatili alacağı"
        : /MANEVİ/.test(sonra) ? "Manevi tazminat" : /MADDİ|DESTEKTEN/.test(sonra) ? "Maddi tazminat" : /ÜCRET/.test(sonra) ? "Ücret alacağı" : /KİRA/.test(sonra) ? "Kira bedeli"
        : "Alacak";
      // "kıdem tazminatı talebini 90.000 TL'ye artırmış": ad tutardan öncedir.
      const onceAd = /^['’]?(?:YE|YA|E|A)\b/.test(sonra.slice(0, 4)) || /(?:TALEBİNİ|İSTEMİNİ|MİKTARINI|ALACAĞINI)\s*$/.test(once);
      const ad = onceAd && /KIDEM|İHBAR|MESAİ|İZİN|TATİL|MANEVİ|MADDİ|ÜCRET|KİRA/.test(once.slice(-50)) ? adBul(once.slice(-50)) : adBul(sonra) !== "Alacak" ? adBul(sonra) : adBul(once);
      const t: Talep = { ad, tutar: para(m[1]), islah: islah || undefined };
      const i = out.findIndex(x => x.ad === ad);
      if (i < 0) out.push(t); else if (islah || !out[i].islah) out[i] = t; // ıslah edilen tutar şimdilik istenenin yerine geçer
    });
  }
  return out;
}

/** Dilekçeyi hangi tarafın vekili yazmış: imza bloğundaki "Davacı Vekili" / "Davalı Vekili" ya da sonuç kısmındaki "müvekkil" ile
 *  "davalıdan tahsili" / "davanın reddi" birlikteliği. */
export function dilekceYazari(metin: string): { yan?: "birinci" | "ikinci"; imza?: string } {
  const u = ust(metin.replace(/\s+/g, " "));
  const son = u.slice(-700);
  const imza = metin.replace(/\s+/g, " ").slice(-700).match(/(?:Av\.|AV\.|Avukat|AVUKAT)\s*([A-ZÇĞİÖŞÜa-zçğıöşü. ]{4,60})/)?.[1]?.trim();
  if (/DAVACI(?:LAR)?\s+VEKİLİ/.test(son) && !/DAVALI(?:LAR)?\s+VEKİLİ/.test(son)) return { yan: "birinci", imza };
  if (/DAVALI(?:LAR)?\s+VEKİLİ/.test(son) && !/DAVACI(?:LAR)?\s+VEKİLİ/.test(son)) return { yan: "ikinci", imza };
  const n = u.search(/NETİCE\s*(?:-\s*İ\s*|VE\s*)TALEP|SONUÇ\s*VE\s*(?:İSTEM|TALEP)/);
  if (n >= 0) {
    const s = u.slice(n, n + 1500);
    if (/MÜVEKKİL/.test(s) && /DAVALI(?:LAR)?(?:DAN|TAN)|DAVALI(?:LAR)?(?:A|YA) YÜKLETİL/.test(s) && !/DAVANIN REDDİ/.test(s)) return { yan: "birinci", imza };
    if (/DAVANIN REDDİ/.test(s)) return { yan: "ikinci", imza };
  }
  return { imza };
}

// Etiketler Türkçe büyük harfe çevrilmiş metinde aranır (i bayrağı ı/I ve i/İ eşleşmesini yapmaz).
const tarihAl = (metin: string, etiket: RegExp) => { const m = ust(metin).match(new RegExp(etiket.source + "\\s*[:.]?\\s*" + TARIH.source, "i")); return m ? iso(m[m.length - 3], m[m.length - 2], m[m.length - 1]) : undefined; };

/** Bölge adliye / Yargıtay kararının başlığındaki tam ad: "İZMİR / BÖLGE ADLİYE MAHKEMESİ / 20. HUKUK DAİRESİ" →
 *  "İzmir Bölge Adliye Mahkemesi 20. Hukuk Dairesi". */
function bamAdi(metin: string): string | undefined {
  const satir = metin.split(/\n/).slice(0, 25).map(x => x.trim()).filter(Boolean);
  const i = satir.findIndex(x => /BÖLGE ADLİYE MAHKEMESİ|YARGITAY/.test(ust(x)));
  if (i < 0) return undefined;
  const bh = (x: string) => x.toLocaleLowerCase("tr").replace(/(^|\s)(\p{L})/gu, (_m, a, b) => a + b.toLocaleUpperCase("tr"));
  const sehir = /BÖLGE ADLİYE/.test(ust(satir[i])) && /^[A-ZÇĞİÖŞÜ]{3,15}$/.test(ust(satir[i - 1] || "")) && !/^T\.?C\.?$/.test(satir[i - 1]) ? bh(satir[i - 1]) + " " : "";
  const ad = satir[i].match(/(?:[A-ZÇĞİÖŞÜa-zçğıöşü]+\s+)?(?:BÖLGE ADLİYE MAHKEMESİ|YARGITAY)/i)?.[0] || satir[i];
  const daire = (satir[i].match(/\d{1,2}\s*\.\s*(?:HUKUK|CEZA)\s+DAİRESİ/i) || (satir[i + 1] || "").match(/^\d{1,2}\s*\.\s*(?:HUKUK|CEZA)\s+DAİRESİ/i))?.[0];
  const tamAd = (sehir && !ust(ad).startsWith(ust(sehir.trim())) ? sehir : "") + ad + (daire && !ad.includes(daire) ? " " + daire : "");
  return bh(tamAd.replace(/\s+/g, " ").trim()).replace(/(\d+)\s*\.\s*/g, "$1. ");
}

/** Evraktan icra bilgisi önerisi (yalnız bulunanlar). */
export function icraEvraktan(metin: string): { tur: IcraEvrakTuru; yol?: TakipYolu; bilgi: Partial<IcraBilgi>; kalemler: Kalem[] } {
  const tur = evrakTuruBul(metin);
  const k = kunyeCikar(metin);
  const bilgi: Partial<IcraBilgi> = {};
  let kalemler: Kalem[] = [];
  if (tur === "ilam") {
    const karar = metin.match(/KARAR\s*(?:NO|NUMARASI)\s*[:.]?\s*((?:19|20)\d{2}\s*\/\s*\d+)/i)?.[1]?.replace(/\s+/g, "");
    const kararTarihi = tarihAl(metin, /KARAR\s*TAR[İI]H[İI]/) || k.belgeTarihi;
    const kesin = tarihAl(metin, /KES[İI]NLE[ŞS](?:ME|T[İI]Ğ[İI])\s*(?:TAR[İI]H[İI])?/);
    bilgi.ilam = { mahkeme: bamAdi(metin) || k.mahkeme, esasNo: k.esasNo, kararNo: karar, kararTarihi, kesinlesme: kesin };
    kalemler = hukumKalemleri(metin, kararTarihi);
    return { tur, yol: "ilamli", bilgi, kalemler };
  }
  if (tur === "cek") {
    const seri = metin.match(/(?:SER[İI]\s*NO|ÇEK\s*NO|ÇEK\s*NUMARASI)\s*[:.]?\s*([A-Z0-9-]{4,})/i)?.[1];
    const kesideTarihi = tarihAl(metin, /KE[ŞS][İI]DE\s*TAR[İI]H[İI]/);
    const ibraz = tarihAl(metin, /(?:[İI]BRAZ|KAR[ŞS]ILIKSIZ)\s*(?:TAR[İI]H[İI])?/);
    const banka = metin.match(/([A-ZÇĞİÖŞÜ][\wÇĞİÖŞÜçğıöşü.&-]*(?:\s+[A-ZÇĞİÖŞÜ][\wÇĞİÖŞÜçğıöşü.&-]*){0,4}\s+BANKASI(?:\s+A\.?Ş\.?|\s+T\.?A\.?O\.?)?)/)?.[1];
    const tutar = metin.match(/#\s*([\d.]+,\d{2})\s*#/)?.[1] || metin.match(TUTAR)?.[1];
    bilgi.senet = { tur: "cek", seriNo: seri, duzenleme: kesideTarihi, vade: ibraz, banka, kesideci: k.birinci?.ad };
    if (tutar) kalemler = [{ ad: "Çek bedeli", tutar: para(tutar), faizTuru: "yasal", faizBaslangic: ibraz }];
    return { tur, yol: "kambiyo", bilgi, kalemler };
  }
  if (tur === "senet") {
    const duzenleme = tarihAl(metin, /(?:TANZ[İI]M|D[ÜU]ZENLEME)\s*TAR[İI]H[İI]/);
    const vade = tarihAl(metin, /VADE(?:\s*TAR[İI]H[İI])?/);
    const tutar = metin.match(/#\s*([\d.]+,\d{2})\s*#/)?.[1] || metin.match(TUTAR)?.[1];
    bilgi.senet = { tur: "bono", duzenleme, vade };
    if (tutar) kalemler = [{ ad: "Senet bedeli", tutar: para(tutar), faizTuru: "yasal", faizBaslangic: vade }];
    return { tur, yol: "kambiyo", bilgi, kalemler };
  }
  if (tur === "kira") {
    const sozlesmeTarihi = tarihAl(metin, /(?:S[ÖO]ZLE[ŞS]ME|BA[ŞS]LANGI[ÇC])\s*TAR[İI]H[İI]/);
    const aylik = metin.match(new RegExp("AYLIK\\s*K[İI]RA(?:\\s*BEDEL[İI])?\\s*[:.]?\\s*" + TUTAR.source, "i"))?.[1];
    bilgi.kira = { sozlesmeTarihi, aylikKira: aylik ? para(aylik) : undefined, adres: metin.match(/K[İI]RALANAN\s*(?:YER[İI]N|MECURUN)?\s*ADRES[İI]\s*[:.]?\s*([^\n]{8,160})/i)?.[1]?.trim() };
    return { tur, yol: "kira", bilgi, kalemler };
  }
  if (tur === "fatura") {
    const no = metin.match(/FATURA\s*NO\s*[:.]?\s*([A-Z0-9-]{3,})/i)?.[1];
    const tarih = tarihAl(metin, /FATURA\s*TAR[İI]H[İI]/) || k.belgeTarihi;
    const vade = tarihAl(metin, /(?:SON\s*[ÖO]DEME|VADE)\s*TAR[İI]H[İI]/);
    const tutar = metin.match(new RegExp("(?:GENEL\\s*TOPLAM|[ÖO]DENECEK\\s*TUTAR|TOPLAM)\\s*[:.]?\\s*" + TUTAR.source, "i"))?.[1];
    bilgi.belge = [tarih ? tarih.split("-").reverse().join(".") + " tarihli" : "", no ? no + " no'lu" : "", "fatura"].filter(Boolean).join(" ");
    if (tutar) kalemler = [{ ad: "Fatura bedeli", tutar: para(tutar), faizTuru: "yasal", faizBaslangic: vade || tarih }];
    return { tur, yol: "genel", bilgi, kalemler };
  }
  return { tur, bilgi, kalemler };
}

/** Föyün evrakından icra bilgisini doldurur: yalnız boş alanlar; kalemler hiç girilmemişse eklenir. */
/** kalem: false → alacak kalemleri yazılmaz (hükümden okunan kalemler önizlemede avukatın onayıyla yazılır). */
export function icraDoldur(b: IcraBilgi, metinler: string[], secenek: { kalem?: boolean } = {}): { yeni: IcraBilgi; dolan: string[] } {
  const oncelik: IcraEvrakTuru[] = ["ilam", "cek", "senet", "kira", "fatura"];
  const sonuclar = metinler.filter(x => x && x.trim()).map(icraEvraktan).filter(r => r.tur !== "diger")
    .sort((a, c) => oncelik.indexOf(a.tur) - oncelik.indexOf(c.tur));
  if (!sonuclar.length) return { yeni: b, dolan: [] };
  const r = sonuclar[0];
  const dolan: string[] = [];
  const y: IcraBilgi = { ...b };
  const bosKalem = !b.kalemler || !b.kalemler.some(k => k.tutar);
  if (r.yol && bosKalem && !b.asil) { if (y.yol !== r.yol) dolan.push("takip yolu"); y.yol = r.yol; if (r.yol === "kira") y.talep = y.talep || "haciz_tahliye"; }
  const birlestir = <T extends object>(eski: T | undefined, yeni: T | undefined, ad: string): T | undefined => {
    if (!yeni) return eski;
    const out = { ...(eski || {}) } as Record<string, unknown>;
    let degisti = false;
    for (const [kk, v] of Object.entries(yeni)) if (v !== undefined && v !== "" && (out[kk] === undefined || out[kk] === "")) { out[kk] = v; degisti = true; }
    if (degisti) dolan.push(ad);
    return out as T;
  };
  y.ilam = birlestir(b.ilam, r.bilgi.ilam, "ilam bilgileri");
  y.senet = birlestir(b.senet, r.bilgi.senet, r.bilgi.senet?.tur === "cek" ? "çek bilgileri" : "senet bilgileri");
  y.kira = birlestir(b.kira, r.bilgi.kira, "kira bilgileri");
  if (r.bilgi.belge && !b.belge) { y.belge = r.bilgi.belge; dolan.push("dayanak"); }
  if (secenek.kalem !== false && bosKalem && !b.asil && r.kalemler.length) { y.kalemler = r.kalemler; dolan.push(`${r.kalemler.length} alacak kalemi`); }
  if (r.yol === "ilamli" && !y.mahiyet && r.kalemler.length) { y.mahiyet = "4045"; dolan.push("takip mahiyeti (para alacağı)"); }
  return { yeni: y, dolan };
}

/**
 * Yanlış eklenen evrakın icra bilgilerine yazdıklarını geri alır: ilam / çek / senet / kira bilgilerinde ve alacak
 * kalemlerinde, o evraktan okunan değerle aynı olan her şey silinir (elle değiştirilmiş olanlar kalır). Ardından kalan
 * evrakla yeniden doldurmak için icraDoldur çağrılır.
 */
export function icraEvrakGeriAl(b: IcraBilgi, metin: string): IcraBilgi {
  const r = icraEvraktan(metin);
  if (r.tur === "diger") return b;
  const temizle = <T extends object>(eski: T | undefined, gelen: T | undefined): T | undefined => {
    if (!eski || !gelen) return eski;
    const out = { ...eski } as Record<string, unknown>;
    for (const [k, v] of Object.entries(gelen)) if (v !== undefined && v !== "" && out[k] === v) delete out[k];
    return Object.keys(out).length ? (out as T) : undefined;
  };
  const y: IcraBilgi = { ...b, ilam: temizle(b.ilam, r.bilgi.ilam), senet: temizle(b.senet, r.bilgi.senet), kira: temizle(b.kira, r.bilgi.kira) };
  if (r.bilgi.belge && b.belge === r.bilgi.belge) y.belge = undefined;
  const ayni = (k: Kalem) => r.kalemler.some(x => x.ad === k.ad.replace(/\s*\(net\)$/i, "") && Math.abs((x.tutar || 0) - (k.brut?.tutar ?? k.tutar ?? 0)) < 0.01);
  if (b.kalemler?.length) { const kalan = b.kalemler.filter(k => !ayni(k)); y.kalemler = kalan.length ? kalan : undefined; }
  if (!y.kalemler?.length && r.yol === "ilamli" && b.mahiyet === "4045") y.mahiyet = undefined;
  return y;
}