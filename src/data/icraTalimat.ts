// İcra takibinde avukatın yazdığı (ya da yapıştırdığı evrakın sonuna eklediği) talimatı cihazda okur; yapay zekâ gerekmez:
//   "bu kararı 10.000 TL vekâlet ücreti ve 2.538 TL yargılama gideri olacak şekilde takibe koy; alacaklı X ile borçlu Y'yi de ekle"
//   → alacak kalemleri (vekâlet ücreti 10.000, yargılama gideri 2.538), ek alacaklı X, ek borçlu Y.
// Adlar evraktaki taraflarla eşleştirilir (doğru yazımı, kimlik no ve adresi oradan gelir); "Yılmaz'ı", "keskini" gibi ekler atılır.
import type { Foy, TarafKisi } from "./foy";
import type { FaizTuru, IcraBilgi, Kalem, Masraf, ParaBirimi, TakipYolu } from "./icra";
import { AVANS, kalemleri, TTK1530, YASAL } from "./icra";
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

/** Talimattan takip formunun kutularına yazılacaklar ("icra dairesi …", "borçlu X'in adresi …", "IBAN …", "kesinleşme …"). */
export interface TalimatAlanlari {
  icraDairesi?: string; iban?: string; banka?: string; hesapSahibi?: "vekil" | "alacakli";
  yol?: TakipYolu; mahiyet?: string; paraBirimi?: ParaBirimi; takipTarihi?: string;
  ilam?: { mahkeme?: string; esasNo?: string; kararNo?: string; kararTarihi?: string; kesinlesme?: string };
  faizTuru?: FaizTuru; faizBaslangic?: { kalem?: string; tarih?: string; ref?: "dava" | "karar" | "kesinlesme" | "takip" }[];
  /** "faiz %31", "yüzde 31 faiz": yasal / avans faizinde dönemsel tabloyla aynıysa sabitlenmez */
  faizOran?: number;
  masraflar?: Masraf[]; not?: string; mernis?: ("alacakli" | "borclu")[];
  kisiBilgi?: { rol: "alacakli" | "borclu"; ad?: string; kimlikNo?: string; adres?: string }[];
  kalemSil?: string[];
}
export interface TalimatSonucu { kalemler: { ad: string; tutar: number }[]; alacaklilar: string[]; borclular: string[]; alanlar?: TalimatAlanlari }

const TARIH_RE = /(\d{1,2})[./-](\d{1,2})[./-]((?:19|20)\d{2})/;
const isoTarih = (x?: string) => { const m = x?.match(TARIH_RE); return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : undefined; };
const bicimAd = (x: string) => x.toLocaleLowerCase("tr").replace(/(^|\s)(\p{L})/gu, (_m, a, b) => a + b.toLocaleUpperCase("tr")).replace(/\b(\d+)\s*\.\s*/g, "$1. ");

/** Kutulara yazılacak bilgiler (tutar ve taraf eklemeden ayrı). */
export function alanlariOku(talimat: string): TalimatAlanlari {
  const a: TalimatAlanlari = {};
  const x = talimat.replace(/\s+/g, " ").trim();
  const u = ust(x);
  // İcra dairesi: "İzmir 5. İcra Dairesi", "izmir genel icra dairesinde aç"
  for (const daire of x.matchAll(/((?:\p{L}+\s+){0,2}(?:\d+\s*\.\s*|genel\s+)?(?:icra\s+dairesi|icra\s+müdürlüğü))/giu)) {
    const ad = daire[1].replace(/^(?:(?:takibi|takip|dosyayı|dosya|olarak|ve|ile|için|icra|dairesi|daire)\s+)+/i, "").trim();
    if (ad.split(/\s+/).length >= 3 && (!a.icraDairesi || ad.length > a.icraDairesi.length)) a.icraDairesi = bicimAd(ad);
  }
  // IBAN ve banka
  const iban = x.match(/TR\s?\d{2}(?:\s?\d{4}){5}\s?\d{0,2}/i);
  if (iban) a.iban = iban[0].toUpperCase().replace(/\s+/g, " ").trim();
  const banka = x.match(/((?:\p{L}+\s){0,2}(?:bankası|katılım bankası|bank))\b/iu);
  if (banka && a.iban) a.banka = bicimAd(banka[1]);
  if (/hesap\w*\s+(?:benim|vekil|büro)|vekil\s+adına|benim\s+adıma/i.test(x)) a.hesapSahibi = "vekil";
  else if (/hesap\w*\s+(?:müvekkil|alacaklı)|alacaklı\s+adına|müvekkil\s+adına/i.test(x)) a.hesapSahibi = "alacakli";
  // Takip yolu, mahiyet, para birimi
  if (/ilamsız|genel haciz/i.test(x)) a.yol = "genel";
  else if (/ilamlı/i.test(x)) a.yol = "ilamli";
  else if (/kambiyo|\bçek(?:e|le|ten)?\b|\bbono|\bsenet/i.test(x) && /takip|yol/i.test(x)) a.yol = "kambiyo";
  else if (/kira\s+(?:takibi|alacağı|yolu)/i.test(x)) a.yol = "kira";
  if (/mahiyet/i.test(x) || /para alacağı olarak/i.test(x)) {
    if (/nafaka/i.test(x)) a.mahiyet = a.yol === "genel" ? "9009" : "1045";
    else if (/çocuk teslim/i.test(x)) a.mahiyet = a.yol === "genel" ? "1107" : "2045";
    else if (/tüketici hakem/i.test(x)) a.mahiyet = a.yol === "genel" ? "1207" : "3045";
    else if (/para alacağı/i.test(x)) a.mahiyet = "4045";
  }
  if (/\b(?:usd|dolar)\b/i.test(x)) a.paraBirimi = "USD"; else if (/\b(?:eur|euro|avro)\b/i.test(x)) a.paraBirimi = "EUR"; else if (/\b(?:gbp|sterlin)\b/i.test(x)) a.paraBirimi = "GBP";
  // İlam bilgileri ve tarihler
  const tarihSonra = (re: RegExp) => { const m = x.match(new RegExp(re.source + "[^\\d]{0,25}(\\d{1,2}[./-]\\d{1,2}[./-](?:19|20)\\d{2})", "i")); return isoTarih(m?.[1]); };
  const ilam: NonNullable<TalimatAlanlari["ilam"]> = {};
  const kes = tarihSonra(/kesinle[sş]/); if (kes) ilam.kesinlesme = kes;
  const kt = tarihSonra(/karar\s+tarih/); if (kt) ilam.kararTarihi = kt;
  const es = x.match(/esas\s*(?:no|numarası)?\s*:?\s*((?:19|20)\d{2}\s*\/\s*\d{1,7})/i) || x.match(/((?:19|20)\d{2}\s*\/\s*\d{1,7})\s*(?:esas|e\.)/i);
  if (es) ilam.esasNo = es[1].replace(/\s+/g, "");
  const kn = x.match(/karar\s*(?:no|numarası)\s*:?\s*((?:19|20)\d{2}\s*\/\s*\d{1,7})/i) || x.match(/((?:19|20)\d{2}\s*\/\s*\d{1,7})\s*(?:karar|k\.)/i);
  if (kn) ilam.kararNo = kn[1].replace(/\s+/g, "");
  const mh = x.match(/((?:\p{L}+\s+){1,2}(?:\d+\s*\.\s*)?(?:\p{L}+\s+){1,3}(?:mahkemesi|hukuk dairesi))/iu);
  if (mh && !/icra/i.test(mh[1])) ilam.mahkeme = bicimAd(mh[1].replace(/^(?:ilamı|ilam|karar|kararı|veren|mahkeme|olarak|ve)\s+/i, ""));
  if (Object.keys(ilam).length) a.ilam = ilam;
  const tt = tarihSonra(/takip\s+tarih/); if (tt) a.takipTarihi = tt;
  // Faiz türü (bütün kalemler) ve kaleme özel başlangıç
  const ft = /avans|ticari faiz/i.test(x) ? "avans" : /mevduat/i.test(x) ? "mevduat" : /1530/i.test(x) ? "ttk1530" : /sözleşme(?:deki)?\s*(?:temerrüt\s*)?faiz/i.test(x) ? "sozlesme" : /3095|yasal faiz|kanuni faiz/i.test(x) ? "yasal" : /faizsiz|faiz istem|faiz olmasın/i.test(x) ? "yok" : undefined;
  if (ft && /faiz/i.test(x)) a.faizTuru = ft as FaizTuru;
  for (const m of x.matchAll(/((?:\p{L}+\s+){0,3}?)(?:için\s+)?faiz(?:i|in)?\s*(?:başlangıcı|başlangıç tarihi)?\s*:?\s*(\d{1,2}[./-]\d{1,2}[./-](?:19|20)\d{2})/giu)) {
    const tarih = isoTarih(m[2]); if (!tarih) continue;
    const kalem = KALEMLER.find(([re]) => re.test(m[1]))?.[1];
    (a.faizBaslangic ||= []).push({ kalem, tarih });
  }
  // "asıl alacağa 15.03.2024 tarihinden itibaren avans faizi"
  for (const m of x.matchAll(/((?:\p{L}+\s+){0,3}?)(\d{1,2}[./-]\d{1,2}[./-](?:19|20)\d{2})\s*(?:tarihinden|['’]?(?:den|dan|ten|tan))\s*(?:itibaren\s+)?[^.\n]{0,40}?faiz/giu)) {
    const tarih = isoTarih(m[2]); if (!tarih || a.faizBaslangic?.some(y => y.tarih === tarih)) continue;
    (a.faizBaslangic ||= []).push({ kalem: KALEMLER.find(([re]) => re.test(m[1]))?.[1], tarih });
  }
  // "dava tarihinden itibaren", "karar tarihinden", "kesinleşme tarihinden", "takip tarihinden" (faizle birlikte)
  if (/faiz/i.test(x)) for (const m of x.matchAll(/((?:\p{L}+\s+){0,3}?)(dava|karar|kesinleşme|takip)\s+tarihinden/giu)) {
    const ref = ({ dava: "dava", karar: "karar", kesinleşme: "kesinlesme", takip: "takip" } as const)[m[2].toLocaleLowerCase("tr") as "dava"];
    (a.faizBaslangic ||= []).push({ kalem: KALEMLER.find(([re]) => re.test(m[1]))?.[1], ref });
  }
  // Faiz oranı: "faiz %31", "yüzde 31 faiz", "faiz oranı 31"
  const fo = x.match(/faiz[^.\n%]{0,40}?(?:%|yüzde|oranı)\s*(\d{1,2}(?:[.,]\d{1,2})?)/i) || x.match(/(?:%|yüzde)\s*(\d{1,2}(?:[.,]\d{1,2})?)[^.\n]{0,30}?faiz/i);
  if (fo) { const n = Number(fo[1].replace(",", ".")); if (n > 0 && n < 200) a.faizOran = n; }
  // Masraf: "1.250 TL protesto masrafı", "ihtarname masrafı 850 TL"
  for (const m of x.matchAll(/(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:tl|₺)?\s*(?:lik\s+)?((?:protesto|ihtarname|noter|tebligat|posta|keşif|bilirkişi)\w*)\s+(?:masraf|gider|ücret)/giu)) (a.masraflar ||= []).push({ ad: bicimAd(m[2]) + " masrafı", tutar: sayi(m[1]) });
  for (const m of x.matchAll(/((?:protesto|ihtarname|noter|tebligat|posta)\w*)\s+(?:masraf|gider|ücret)\w*\s*:?\s*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:tl|₺)/giu)) (a.masraflar ||= []).push({ ad: bicimAd(m[1]) + " masrafı", tutar: sayi(m[2]) });
  // Not
  const not = x.match(/\bnot\s*(?:olarak|:)\s*(.+)$/i); if (not) a.not = not[1].trim();
  // MERNİS
  if (/mernis/i.test(x)) { if (/borçlu/i.test(x)) (a.mernis ||= []).push("borclu"); if (/alacaklı|müvekkil/i.test(x)) (a.mernis ||= []).push("alacakli"); if (!a.mernis) a.mernis = ["borclu"]; }
  // Kişi bilgisi: "borçlu X'in adresi …", "alacaklının T.C. no'su 123…", "ikinci borçlunun vergi no 123…"
  const parcalar = x.split(/(?=\b(?:ve\s+|ayrıca\s+)?(?:alacaklı|borçlu|müvekkil)\p{L}*\s)/iu);
  for (const p of parcalar) {
    const rm = p.match(/^(?:ve\s+|ayrıca\s+)?(alacaklı|borçlu|müvekkil)\p{L}*\s+/iu);
    if (!rm) continue;
    const rol: "alacakli" | "borclu" = /borçlu/i.test(rm[1]) ? "borclu" : "alacakli";
    const govde = p.slice(rm[0].length);
    const km = govde.match(/^(.*?)\s*(?:'?n?[ıiuü]n\s+)?(?:t\.?\s?c\.?|tc|kimlik|vergi|vkn)\s*(?:no|numarası|kimlik no)?(?:'?s[ıiuü])?\s*:?\s*(\d{10,11})/iu);
    const am = govde.match(/^(.*?)\s*(?:'?n?[ıiuü]n\s+)?adres(?:i|ini)?\s*(?:olarak)?\s*:?\s*(.+?)(?:\s+(?:olsun|yaz|olarak yaz|ekle|kaydet)\b.*)?$/iu);
    const adHam = (km?.[1] || am?.[1] || "").replace(/'?n?[ıiuü]n$/iu, "").replace(/\s+(?:olan|isimli|adlı)$/i, "").trim();
    const bilgi: { rol: "alacakli" | "borclu"; ad?: string; kimlikNo?: string; adres?: string } = { rol };
    if (adHam && adHam.length >= 3 && !/^(adresi|tc|kimlik)$/i.test(adHam)) bilgi.ad = adHam;
    if (km) bilgi.kimlikNo = km[2];
    // Adres, küçük harfle başlayan yeni bir cümle parçasında biter ("…/İzmir, kesinleşme tarihi …").
    if (am && am[2].length >= 8) bilgi.adres = am[2].split(/,\s+(?=\p{Ll})|;\s*/u)[0].replace(/(?:\s*(?:t\.?\s?c\.?|tc|kimlik|vergi)\b.*)$/i, "").replace(/[.;,\s]+$/, "");
    if (bilgi.kimlikNo || bilgi.adres) (a.kisiBilgi ||= []).push(bilgi);
  }
  // Kalem silme: "yargılama gideri kalemini sil"
  for (const m of x.matchAll(/((?:\p{L}+\s+){1,3})kalem(?:ini|i)?\s+(?:sil|çıkar|kaldır)/giu)) { const k = KALEMLER.find(([re]) => re.test(m[1]))?.[1]; if (k) (a.kalemSil ||= []).push(k); }
  void u;
  return a;
}

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
  [/asıl\s*alaca[kğ]/i, "Asıl alacak"],
  [/yıllık\s*(?:ücretli\s*)?izin/i, "Yıllık izin ücreti"],
  [/kira/i, "Kira bedeli"],
  [/asıl\s*alacak|alacak/i, "Asıl alacak"]
];
const TUTAR = /(\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:tl|try|₺|türk\s*lirası)?(?:['’]?(?:lik|lık|luk|lük))?/gi;

/** Talimattaki tutarlı kalemler ve eklenecek alacaklı / borçlu adları. */
export function talimatOku(talimat: string): TalimatSonucu {
  const out: TalimatSonucu = { kalemler: [], alacaklilar: [], borclular: [] };
  const alanlar = alanlariOku(talimat);
  if (Object.keys(alanlar).length) out.alanlar = alanlar;
  // Tarih, IBAN, kimlik ve dosya numaraları tutar sanılmasın; masraflar ayrıca okunur.
  const x = talimat.replace(/\s+/g, " ").replace(/TR\s?\d{2}(?:\s?\d{4}){5}\s?\d{0,2}/gi, " ").replace(/\d{1,2}[./-]\d{1,2}[./-](?:19|20)\d{2}/g, " ")
    .replace(/(?:19|20)\d{2}\s*\/\s*\d{1,7}/g, " ").replace(/\b\d{10,11}\b/g, " ")
    .replace(/(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:tl|₺)?\s*(?:lik\s+)?(?:protesto|ihtarname|noter|tebligat|posta|keşif|bilirkişi)\w*\s+(?:masraf|gider|ücret)\w*/gi, " ")
    .replace(/(?:protesto|ihtarname|noter|tebligat|posta)\w*\s+(?:masraf|gider|ücret)\w*\s*:?\s*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:tl|₺)/gi, " ");
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
  // Taraf ekleme yalnız "ekle / ilave et / de yaz" isteğinde; "borçlunun adresi …" gibi bilgi cümleleri ekleme sayılmaz.
  const roller = /\b(?:ekle|ilave|dahil et)|\s(?:da|de)\s+(?:yaz|koy)/i.test(x) ? [...x.matchAll(ROL)] : [];
  roller.forEach((m, i) => {
    const bas = (m.index || 0) + m[0].length;
    const bit = i + 1 < roller.length ? roller[i + 1].index || x.length : x.length;
    let parca = x.slice(bas, bit);
    parca = parca.split(/\s(?:da|de)\s+(?:ekle|yaz|koy)|\s(?:ekle|yaz|koy)(?:yin|yiniz|r misin)?\b|[.;!?]/i)[0];
    parca = parca.replace(/\s+(?:ile|ve)\s*$/i, "").replace(/^\s*(?:olarak|da|de)\s+/i, "");
    // "borçlu X'in kimlik no / adresi …" bilgi cümlesidir, yeni taraf değil.
    if (/(?:t\.?\s?c\.?\s|tc\b|kimlik|vergi|adres|iban)/i.test(parca)) return;
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
export function talimatUygula(f: Foy, r: TalimatSonucu, opt: { taraflar?: TarafOneri[]; kaynak?: string; hukumKalemleri?: Kalem[]; kararTarihi?: string; davaTarihi?: string; ilamli?: boolean }): { ek: Partial<Foy>; dolan: string[] } {
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
  // Kutular
  const a = r.alanlar;
  if (a) {
    const tr = (x?: string) => (x ? x.split("-").reverse().join(".") : "");
    if (a.icraDairesi && a.icraDairesi !== f.mahkeme) { ek.mahkeme = a.icraDairesi; dolan.push("icra dairesi: " + a.icraDairesi); }
    if (a.iban || a.banka || a.hesapSahibi) { b.hesap = { ...(b.hesap || {}), ...(a.iban ? { iban: a.iban } : {}), ...(a.banka ? { banka: a.banka } : {}), ...(a.hesapSahibi ? { sahibi: a.hesapSahibi } : {}) }; icraDegisti = true; dolan.push("ödeme hesabı"); }
    if (a.yol && a.yol !== b.yol) { b.yol = a.yol; icraDegisti = true; dolan.push("takip yolu"); }
    if (a.mahiyet && a.mahiyet !== b.mahiyet) { b.mahiyet = a.mahiyet; icraDegisti = true; dolan.push("takip mahiyeti"); }
    if (a.paraBirimi && a.paraBirimi !== b.paraBirimi) { b.paraBirimi = a.paraBirimi; icraDegisti = true; dolan.push("para birimi: " + a.paraBirimi); }
    if (a.takipTarihi) { b.takipTarihi = a.takipTarihi; icraDegisti = true; dolan.push("takip tarihi " + tr(a.takipTarihi)); }
    if (a.ilam) { b.ilam = { ...(b.ilam || {}), ...a.ilam }; icraDegisti = true; dolan.push("ilam bilgileri (" + Object.entries(a.ilam).map(([k, v]) => ({ mahkeme: "mahkeme", esasNo: "esas", kararNo: "karar no", kararTarihi: "karar tarihi " + tr(v), kesinlesme: "kesinleşme " + tr(v) } as Record<string, string>)[k]).join(", ") + ")"); }
    if (a.faizTuru || a.faizBaslangic || a.kalemSil || a.faizOran) {
      // Eski kayıtlarda kalemler ayrı alanlarda (asıl alacak, vekâlet ücreti…): önce kalemlere çevrilir, yoksa faiz boş listeye yazılırdı.
      let ks = kalemleri(b).filter(k => k.tutar).map(k => ({ ...k }));
      if (!b.kalemler) { b.asil = undefined; b.islemisFaizElle = undefined; b.ilamVekalet = undefined; b.yargilamaGideri = undefined; }
      if (a.kalemSil) { const once = ks.length; ks = ks.filter(k => !a.kalemSil!.includes(k.ad.replace(/\s*\((?:brüt|net)\)$/i, ""))); if (ks.length !== once) dolan.push((once - ks.length) + " kalem silindi"); }
      if (a.faizTuru) { ks = ks.map(k => ({ ...k, faizTuru: a.faizTuru })); dolan.push("faiz türü: " + a.faizTuru); }
      for (const fb of a.faizBaslangic || []) {
        const tarih = fb.tarih || (fb.ref === "dava" ? opt.davaTarihi || b.ilam?.davaTarihi : fb.ref === "karar" ? opt.kararTarihi || b.ilam?.kararTarihi : fb.ref === "kesinlesme" ? b.ilam?.kesinlesme : fb.ref === "takip" ? b.takipTarihi : undefined);
        const adi = { dava: "dava tarihi", karar: "karar tarihi", kesinlesme: "kesinleşme tarihi", takip: "takip tarihi" }[fb.ref || "dava"];
        if (!tarih) { dolan.push((fb.kalem ? fb.kalem + " " : "") + "faiz başlangıcı: " + adi + " evrakta bulunamadı, tarihi yazın"); continue; }
        // Kalem belirtilmeden "dava tarihinden" denmişse gider kalemleri (vekâlet ücreti, yargılama gideri, harç) karar tarihinden işler.
        const gider = (ad: string) => /vekâlet|vekalet|yargılama|harç/i.test(ad);
        const kt = opt.kararTarihi || b.ilam?.kararTarihi;
        ks = ks.map(k => (fb.kalem ? k.ad.startsWith(fb.kalem) : true) ? { ...k, faizBaslangic: !fb.kalem && fb.ref === "dava" && gider(k.ad) && kt ? kt : tarih } : k); dolan.push((fb.kalem ? fb.kalem + " " : "") + "faiz başlangıcı " + tr(tarih) + (fb.ref ? " (" + adi + ")" : ""));
      }
      if (a.faizOran) {
        // Yasal / avans / TTK 1530 faizinde dönemsel tablo uygulanır (7589 s. Kanun: 31.07.2026'dan itibaren %31); avukatın yazdığı
        // oran bugünkü tablo oranıyla aynıysa kaleme sabit oran yazılmaz (yoksa geçmiş dönemler de o oranla hesaplanırdı).
        const bugun = new Date().toISOString().slice(0, 10);
        const tabloOrani = (tur?: FaizTuru) => { const tb = tur === "avans" ? AVANS : tur === "ttk1530" ? TTK1530 : tur === "yasal" || !tur ? YASAL : undefined; return tb ? [...tb].reverse().find(([g]) => g <= bugun)?.[1] : undefined; };
        let sabit = 0;
        ks = ks.map(k => { if ((k.faizTuru || "yasal") === "yok") return k; const to = tabloOrani(k.faizTuru); if (to === a.faizOran) return { ...k, oran: undefined }; sabit++; return { ...k, oran: a.faizOran }; });
        dolan.push(sabit ? "yıllık faiz oranı %" + String(a.faizOran).replace(".", ",") + " (sabit)" : "faiz oranı: dönemsel tablo (bugün %" + String(a.faizOran).replace(".", ",") + "; önceki dönemler kendi oranıyla)");
      }
      b.kalemler = ks; icraDegisti = true;
    }
    if (a.masraflar?.length) { const ms = [...(b.masraflar || [])]; for (const m of a.masraflar) if (!ms.some(x => x.ad === m.ad && x.tutar === m.tutar)) { ms.push(m); dolan.push(`${m.ad}: ${m.tutar.toLocaleString("tr-TR")} TL`); } b.masraflar = ms; icraDegisti = true; }
    if (a.not) { b.not = a.not; icraDegisti = true; dolan.push("not"); }
    if (a.mernis) { if (a.mernis.includes("borclu")) b.mernisBorclu = true; if (a.mernis.includes("alacakli")) b.mernisAlacakli = true; icraDegisti = true; dolan.push("MERNİS adresi"); }
    for (const kb of a.kisiBilgi || []) {
      const yeni = { ...(kb.kimlikNo ? { kimlikNo: kb.kimlikNo } : {}), ...(kb.adres ? { adres: kb.adres } : {}) };
      const neler = [kb.kimlikNo ? "kimlik no" : "", kb.adres ? "adres" : ""].filter(Boolean).join(" ve ");
      if (kb.rol === "alacakli") {
        const ekM2 = ek.ekMuvekkiller || f.ekMuvekkiller || [];
        const i = kb.ad ? ekM2.findIndex(x => sade(adCoz(kb.ad!, [{ ad: x.ad }]).ad) === sade(x.ad)) : -1;
        if (i >= 0 && !(kb.ad && sade(adCoz(kb.ad, [{ ad: f.muvekkil || "" }]).ad) === sade(f.muvekkil))) { ek.ekMuvekkiller = ekM2.map((x, j) => (j === i ? { ...x, ...yeni } : x)); dolan.push(`${ekM2[i].ad}: ${neler}`); }
        else { ek.muvekkilBilgi = { ...(ek.muvekkilBilgi || f.muvekkilBilgi || {}), ...yeni }; dolan.push(`alacaklı ${f.muvekkil || ""}: ${neler}`.replace("  ", " ")); }
      } else {
        const ana = !kb.ad || sade(adCoz(kb.ad, [{ ad: f.karsiTaraf || "" }]).ad) === sade(f.karsiTaraf);
        const bul = (xs: TarafKisi[]) => (kb.ad ? xs.findIndex(x => sade(adCoz(kb.ad!, [{ ad: x.ad }]).ad) === sade(x.ad)) : -1);
        if (ana && (f.karsiTaraf || "").trim()) { ek.karsiBilgi = { ...(ek.karsiBilgi || f.karsiBilgi || {}), ...yeni }; dolan.push(`borçlu ${f.karsiTaraf}: ${neler}`); continue; }
        const iB = bul(b.ekBorclular || []), iK = bul(ek.ekKarsiTaraflar || f.ekKarsiTaraflar || []);
        if (iB >= 0) { b.ekBorclular = (b.ekBorclular || []).map((x, j) => (j === iB ? { ...x, ...yeni } : x)); icraDegisti = true; }
        if (iK >= 0) ek.ekKarsiTaraflar = (ek.ekKarsiTaraflar || f.ekKarsiTaraflar || []).map((x, j) => (j === iK ? { ...x, ...yeni } : x));
        if (iB >= 0 || iK >= 0) dolan.push(`${kb.ad ? adCoz(kb.ad, [...(b.ekBorclular || []), ...(f.ekKarsiTaraflar || [])].map(x => ({ ad: x.ad }))).ad : "borçlu"}: ${neler}`);
        else if (kb.ad) { const k = adCoz(kb.ad, taraflar, opt.kaynak); b.ekBorclular = [...(b.ekBorclular || []), { ad: k.ad, kimlikNo: k.kimlikNo, ...yeni }]; icraDegisti = true; dolan.push(`borçlu ${k.ad} eklendi (${neler})`); }
      }
    }
  }
  if (icraDegisti) ek.icra = b;
  return { ek, dolan };
}
