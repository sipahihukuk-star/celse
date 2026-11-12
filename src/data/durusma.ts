// Duruşma akışı: föydeki her duruşma günü bir kayıttır. Her kayıtta iki kutu vardır:
//  1) Duruşmaya girildi mi (boş / ✓ girildi / ✗ girilmedi). Günü geçmiş ve işaretlenmemiş duruşma uyarır.
//  2) E-duruşma: önce "talep edilecek mi?" sorulur. "Talep edilmeyecek" denirse kutu kapanır; "talep edildi" denirse
//     karar beklenir ve karar gelene kadar uyarır; kabulde ✓, redde ✗ (duruşmaya bizzat girilecek).
// Keşif de aynı akışta tutulur (tur: "kesif"): keşfe katılındı mı sorulur; e-duruşma sorulmaz. İcra dosyasında duruşma yoktur:
// günler haciz (tur: "haciz") ve keşif günüdür; evraktaki haciz günü de okunur.
// Dosya yeni bir esas no aldıysa ya da mahkeme değiştiyse (görevsizlik, birleşme, istinaf) kayıt o günkü mahkemeyi ve
// numarayı taşır; akışta değişiklik ayrıca gösterilir. Kayıtlar künyedeki "sonraki duruşma"dan, elle ve evraktan (tutanak,
// ara karar, e-duruşma onay ekranının fotoğrafı) oluşur. Her şey bu cihazda; metin hiçbir yere gönderilmez.
import type { Foy } from "./foy";
import { kunyeCikar } from "./kunyeCikar";

export type Girildi = "evet" | "hayir";
export type EDurum = "istenmeyecek" | "talep" | "kabul" | "red";
export type DTur = "durusma" | "kesif" | "haciz";
export const dTur = (d: { tur?: DTur }): DTur => d.tur || "durusma";
/** İcra dosyasında duruşma olmaz: günler haciz ve keşif (kıymet takdiri) günüdür. */
export const icraMi = (f: { tur?: string }) => f.tur === "icra";
/** Bu föyde kullanılan gün türleri; ilki varsayılandır. */
export const gunTurleri = (f: { tur?: string }): DTur[] => (icraMi(f) ? ["haciz", "kesif"] : ["durusma", "kesif"]);
export const DTUR_AD: Record<DTur, string> = { durusma: "Duruşma", kesif: "Keşif", haciz: "Haciz" };
export const DTUR_SIMGE: Record<DTur, string> = { durusma: "⚖", kesif: "🔍", haciz: "📌" };
/** Kutunun sorusu: duruşmaya girildi mi / keşfe katılındı mı / hacze gidildi mi. */
export const girildiSoru = (t: DTur) => (t === "kesif" ? "Keşfe katılındı mı?" : t === "haciz" ? "Hacze gidildi mi?" : "Duruşmaya girildi mi?");
export interface Durusma {
  id: string;
  /** duruşma (yoksa) ya da keşif */
  tur?: DTur;
  /** YYYY-AA-GG ya da YYYY-AA-GGTSS:DD */
  tarih: string;
  /** o duruşmadaki mahkeme ve dosya numarası (dosya numara ya da mahkeme değiştirdiyse farklıdır) */
  mahkeme?: string; esasNo?: string;
  girildi?: Girildi;
  e?: EDurum;
  /** e-duruşma talebinin ve kararın günü (YYYY-AA-GG) ve talebi Celse'den gönderen çalışan */
  eTalep?: string; eKarar?: string; eTalepEden?: string;
  not?: string;
  kaynak?: "elle" | "kunye" | "evrak" | "liste";
  /** bilginin okunduğu evrak */
  evrakId?: string;
}

/** E-duruşma yalnız hukuk davalarında (ilk derece, istinaf ve temyiz duruşmaları) sorulur. */
export const E_TURLER = ["hukuk"];
/** Duruşma düzeni: hukuk ve ceza davalarında her celsede duruşma olur; idare mahkemesi, komisyon, AYM / AİHM ve disiplin
 *  dosyalarında duruşma yalnız talep ya da karar üzerine (çoğu zaman bir kez) yapılır; diğerlerinde duruşma yoktur. */
export type DurusmaDuzeni = "olagan" | "talepli" | "yok";
export function durusmaDuzeni(f: { tur?: string }): DurusmaDuzeni {
  const t = f.tur || "hukuk";
  if (t === "hukuk" || t === "ceza" || t === "ozel_ceza") return "olagan";
  if (t === "idari_dava" || t === "tazminat_komisyonu" || t === "bireysel_basvuru" || t === "kurum_basvuru" || t === "baro" || t === "idari_sorusturma" || t === "bilirkisi_gorev") return "talepli";
  return "yok";
}
export const eSorulur = (f: Foy) => E_TURLER.includes(f.tur || "hukuk");
/** E-duruşma talebi için son gün: duruşmadan bu kadar gün önce (mahkemenin karar verecek zamanı olsun). */
export const E_TALEP_GUN = 7;
/** Günü geçmiş ama işaretlenmemiş duruşma ancak bu kadar gün içindeyse uyarır (eski dosyadan gelen geçmiş duruşmalar susar). */
const GECMIS_UYARI_GUN = 45;

const gun = (x: string) => Date.parse(x.slice(0, 10) + "T00:00:00Z");
const fark = (a: string, b: string) => Math.round((gun(b) - gun(a)) / 86400000);
export const gunEkle = (x: string, n: number) => new Date(gun(x) + n * 86400000).toISOString().slice(0, 10);
export const bugunGun = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const yeniDId = () => "d-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
const esasNormal = (x?: string) => (x || "").replace(/\s+/g, "").replace(/(E|ESAS)\.?$/i, "");
const mahkemeNormal = (x?: string) => (x || "").toLocaleLowerCase("tr").replace(/mahkemesi|\s+/g, "");

export function durusmaSirala(xs: Durusma[]): Durusma[] { return [...xs].sort((a, b) => a.tarih.localeCompare(b.tarih)); }

/** Aynı güne ikinci kayıt açılmaz: saat ya da bilgi eksikse var olan tamamlanır. */
export function durusmaEkle(f: Foy, tarih: string, ek: Partial<Durusma> = {}): Durusma[] {
  const xs = f.durusmalar || [];
  const g = tarih.slice(0, 10);
  const tur = ek.tur || "durusma";
  const var_ = xs.find(x => x.tarih.slice(0, 10) === g && dTur(x) === tur);
  if (var_) {
    const y: Durusma = { ...var_, tarih: tarih.length > var_.tarih.length ? tarih : var_.tarih };
    for (const k of ["mahkeme", "esasNo", "girildi", "e", "eTalep", "eKarar", "evrakId"] as const) if (y[k] === undefined && ek[k] !== undefined) (y as unknown as Record<string, unknown>)[k] = ek[k];
    return JSON.stringify(y) === JSON.stringify(var_) ? xs : xs.map(x => (x.id === var_.id ? y : x));
  }
  return durusmaSirala([...xs, { id: yeniDId(), tarih, mahkeme: f.mahkeme || undefined, esasNo: f.esasNo || undefined, kaynak: "elle", ...ek }]);
}

/** Künyedeki "sonraki duruşma" akışta yoksa eklenir. Değişiklik yoksa null. */
export function kunyeDurusmasi(f: Foy): Durusma[] | null {
  if (!f.durusma) return null;
  const xs = durusmaEkle(f, f.durusma, { kaynak: "kunye", ...(icraMi(f) ? { tur: "haciz" as DTur } : {}) });
  return xs === (f.durusmalar || []) ? null : xs;
}

// ── Evraktan okuma ──────────────────────────────────────────────────────────────────────────────────
const tarihIso = (g: string, a: string, y: string, s?: string, d?: string) => {
  const yy = +y, aa = +a, gg = +g;
  if (aa < 1 || aa > 12 || gg < 1 || gg > 31 || yy < 2000 || yy > 2100) return undefined;
  const t = `${yy}-${String(aa).padStart(2, "0")}-${String(gg).padStart(2, "0")}`;
  return s && d && +s < 24 && +d < 60 ? `${t}T${String(+s).padStart(2, "0")}:${d}` : t;
};
const TARIH = String.raw`(\d{1,2})[./](\d{1,2})[./](\d{4})`;
const SAAT = String.raw`(?:\s*(?:günü|tarihinde|tarihli|gün)?\s*(?:saat\s*:?\s*)?(\d{1,2})[:.](\d{2}))?`;
// "duruşmanın 12/03/2027 günü saat 10:30'a bırakılmasına", "duruşma 12.03.2027 tarihine ertelendi", "DURUŞMA TARİHİ: 12.03.2027 10:30"
const ILERI = new RegExp(TARIH + SAAT + String.raw`\s*['’]?\s*[a-zçğıöşü]{0,4}\s*(?:günü\s*)?(?:saat\s*\d{1,2}[:.]\d{2}\s*['’]?\s*[a-zçğıöşü]{0,3}\s*)?(?:bırakıl|ertelen|duruşma|tarihine|gününe)`, "gi");
const ETIKETLI = new RegExp(String.raw`(?:DURUŞMA|CELSE|OTURUM|E-?\s?DURUŞMA)\s*(?:GÜNÜ|TARİHİ|SAATİ|TARİH)\s*(?:VE\s*SAATİ)?\s*:?\s*` + TARIH + SAAT, "gi");
// Keşif: "keşfin 12/03/2027 günü saat 10:00'da yapılmasına", "12.03.2027 günü mahallinde keşif yapılmasına", "KEŞİF TARİHİ: 12.03.2027"
const KESIF_ETIKET = new RegExp(String.raw`KEŞ[İI]F\s*(?:GÜNÜ|TARİHİ|TARİH)\s*(?:VE\s*SAATİ)?\s*:?\s*` + TARIH + SAAT, "gi");
const KESIF_ONCE = new RegExp(String.raw`keşf[a-zçğıöşü]*\s+(?:ve\s+bilirkişi\s+incelemesi(?:nin)?\s+)?` + TARIH + SAAT, "gi");
const KESIF_SONRA = new RegExp(TARIH + SAAT + String.raw`[^\n.,;]{0,40}?(?:mahallinde\s+)?keşi?f`, "gi");
// Haciz: "haczin 12/03/2027 günü saat 10:00'da yapılmasına", "12.03.2027 tarihinde haciz mahalline gidilmesine", "HACİZ TARİHİ: 12.03.2027"
const HACIZ_ETIKET = new RegExp(String.raw`HAC[İI]Z\s*(?:GÜNÜ|TARİHİ|TARİH)\s*(?:VE\s*SAATİ)?\s*:?\s*` + TARIH + SAAT, "gi");
const HACIZ_ONCE = new RegExp(String.raw`hacz[a-zçğıöşü]*\s+(?:işleminin\s+)?` + TARIH + SAAT, "gi");
const HACIZ_SONRA = new RegExp(TARIH + SAAT + String.raw`[^\n.,;]{0,40}?hac(?:iz|z)`, "gi");
const TUTANAK = /DURUŞMA\s+TUTANAĞI|CELSE\s+TUTANAĞI|AÇIK\s+DURUŞMAYA\s+BAŞLANDI|DURUŞMAYA\s+BAŞLANDI|OTURUM\s+TUTANAĞI|DURUŞMA\s+AÇILDI/i;

const BIZ: Record<"davaci" | "davali", string> = {
  davaci: "DAVACI|DAVACILAR|MÜŞTEKİ|MÜŞTEKİLER|KATILAN|KATILANLAR|ALACAKLI|BAŞVURUCU|BAŞVURAN|MAĞDUR|ŞİKAYETÇİ|ŞİKÂYETÇİ",
  davali: "DAVALI|DAVALILAR|SANIK|SANIKLAR|ŞÜPHELİ|BORÇLU|KARŞI TARAF|ALEYHİNE BAŞVURULAN"
};

export interface EvrakDurusmaBulgu {
  /** metinde geçen duruşma günleri (geçmiş ve ileri) */
  tarihler: string[];
  /** metinde geçen keşif günleri */
  kesifler?: string[];
  /** metinde geçen haciz günleri */
  hacizler?: string[];
  /** tutanaksa: o duruşmanın günü ve bizim vekilin gelip gelmediği */
  oturum?: { tarih: string; girildi?: Girildi };
  /** e-duruşma: talep / kabul / red ve hangi duruşma için */
  e?: { durum: "talep" | "kabul" | "red"; tarih?: string };
  mahkeme?: string; esasNo?: string; belgeTarihi?: string;
}

/** Bir evrakın metninden duruşma bilgisi (cihazda, kurallarla). Görselden okunan (JPEG) metin de aynı yoldan geçer. */
export function evrakDurusmaOku(metin: string, taraf: "davaci" | "davali" = "davaci", simdi = new Date()): EvrakDurusmaBulgu {
  const u = metin.toLocaleUpperCase("tr").replace(/[ \t]+/g, " ");
  const k = kunyeCikar(metin, simdi);
  const o: EvrakDurusmaBulgu = { tarihler: [], mahkeme: k.mahkeme, esasNo: k.esasNo, belgeTarihi: k.belgeTarihi };
  // Önce etiketli ve önünde "haczin / keşfin" geçen günler (kesin), sonra arkasında geçenler (yalnız kesin olmayan günler).
  const topla = (res: RegExp[], haric: string[]) => {
    const out: string[] = [];
    for (const re of res) for (const m of metin.matchAll(re)) {
      const x = tarihIso(m[1], m[2], m[3], m[4], m[5]);
      if (!x || haric.some(y => y.slice(0, 10) === x.slice(0, 10))) continue;
      const i = out.findIndex(y => y.slice(0, 10) === x.slice(0, 10)); if (i < 0) out.push(x); else if (x.length > out[i].length) out[i] = x;
    }
    return out;
  };
  const kesinH = topla([HACIZ_ETIKET, HACIZ_ONCE], []), kesinK = topla([KESIF_ETIKET, KESIF_ONCE], kesinH);
  const haciz = [...kesinH, ...topla([HACIZ_SONRA], [...kesinH, ...kesinK])];
  const kesif = [...kesinK, ...topla([KESIF_SONRA], [...haciz, ...kesinK])];
  if (kesif.length) o.kesifler = kesif.sort();
  if (haciz.length) o.hacizler = haciz.sort();
  const kesifGun = new Set([...kesif, ...haciz].map(x => x.slice(0, 10)));
  const ekle = (x?: string) => { if (x && !kesifGun.has(x.slice(0, 10)) && !o.tarihler.some(y => y.slice(0, 10) === x.slice(0, 10))) o.tarihler.push(x); };
  for (const re of [ETIKETLI, ILERI]) for (const m of metin.matchAll(re)) ekle(tarihIso(m[1], m[2], m[3], m[4], m[5]));
  // Tutanak: başlıktaki duruşma günü o oturumun günüdür; ilerideki gün "bırakılmasına" denen sonraki duruşmadır.
  if (TUTANAK.test(u)) {
    const bas = u.slice(0, 1500).match(new RegExp(String.raw`(?:DURUŞMA|CELSE|OTURUM)\s*(?:TARİHİ|GÜNÜ)?\s*:?\s*` + TARIH));
    const ilk = bas ? tarihIso(bas[1], bas[2], bas[3]) : k.belgeTarihi;
    if (ilk) {
      ekle(ilk);
      const rol = BIZ[taraf];
      const re = new RegExp(String.raw`(?:${rol})\s*(?:VEKİLİ|VEKİLLERİ|MÜDAFİİ|MÜDAFİLERİ)(?:(?!VEKİL|MÜDAFİ)[^\n]){0,90}?\b(GELDİ|HAZIR|KATILDI|BAĞLANDI|GELMEDİ|YOK|KATILMADI|BAĞLANAMADI|GELMEMİŞ)`, "u");
      const m = u.match(re);
      o.oturum = { tarih: ilk, girildi: m ? (/GELMEDİ|YOK|KATILMADI|BAĞLANAMADI|GELMEMİŞ/.test(m[1]) ? "hayir" : "evet") : undefined };
    }
  }
  // E-duruşma (hukuk) ve SEGBİS (ceza) talebi ve kararı.
  if (/E-?\s?DURUŞMA|SEGB[İI]S|SES VE GÖRÜNTÜ (?:BİLİŞİM|AKTARIM)/.test(u)) {
    const red = /(E-?\s?DURUŞMA|SEGB[İI]S)[^\n]{0,120}?(REDDİNE|REDDEDİL|ONAYLANMADI|UYGUN GÖRÜLMEDİ|KABUL EDİLMEDİ|KABULÜNE YER OLMADIĞINA|REDDOLUN)/.test(u)
      || /(TALEBİNİZ|TALEP)\s*(REDDEDİLMİŞTİR|REDDEDİLDİ|ONAYLANMAMIŞTIR)/.test(u);
    const kabul = !red && (/(E-?\s?DURUŞMA|SEGB[İI]S)[^\n]{0,120}?(KABULÜNE|KABUL EDİL|ONAYLAN|UYGUN GÖRÜL|İLE KATILIM(I|IN)A KARAR)/.test(u)
      || /(TALEBİNİZ|TALEP)\s*(ONAYLANMIŞTIR|ONAYLANDI|KABUL EDİLMİŞTİR)/.test(u));
    const talep = /(E-?\s?DURUŞMA|SEGB[İI]S)[^\n]{0,80}?(TALEB|İLE KATILMAK|YOLUYLA KATILMAK|İLE BAĞLAN)/.test(u);
    const durum = red ? "red" : kabul ? "kabul" : talep ? "talep" : undefined;
    if (durum) {
      // Hangi duruşma: metinde geçen ve belgeden sonraki ilk gün; yoksa föyün belgeden sonraki ilk duruşması (çağıran bulur).
      const sonra = o.tarihler.filter(x => !o.oturum || x.slice(0, 10) !== o.oturum.tarih.slice(0, 10)).filter(x => !o.belgeTarihi || x.slice(0, 10) >= o.belgeTarihi).sort();
      o.e = { durum, tarih: sonra[0] };
    }
  }
  o.tarihler.sort();
  return o;
}

const E_SIRA: Record<EDurum, number> = { istenmeyecek: 0, talep: 1, kabul: 2, red: 2 };

/** Evraktan okunanları föyün duruşma akışına işler. Elle işaretlenmiş kutulara dokunulmaz; e-duruşma geri gitmez
 *  (kabul edilmiş bir talep, sonradan gelen talep dilekçesiyle "talep"e dönmez). */
export function evraktanDurusma(f: Foy, evraklar: { id: string; metin: string; tarih?: string; eklenme: string }[], simdi = new Date()): { durusmalar: Durusma[]; degisen: string[] } {
  let xs = f.durusmalar || [];
  const degisen = new Set<string>();
  const ff = () => ({ ...f, durusmalar: xs });
  const sira = [...evraklar].filter(e => e.metin && e.metin.trim()).sort((a, b) => (a.tarih || a.eklenme).localeCompare(b.tarih || b.eklenme));
  for (const e of sira) {
    const b = evrakDurusmaOku(e.metin, f.taraf || "davaci", simdi);
    const yer = { mahkeme: b.mahkeme, esasNo: b.esasNo };
    for (const t of icraMi(f) ? [] : b.tarihler) {
      const once = xs;
      xs = durusmaEkle(ff(), t, { kaynak: "evrak", evrakId: e.id, ...yer });
      if (xs !== once) degisen.add("duruşma günü");
    }
    for (const t of b.hacizler || []) {
      const once = xs;
      xs = durusmaEkle(ff(), t, { tur: "haciz", kaynak: "evrak", evrakId: e.id, ...yer });
      if (xs !== once) degisen.add("haciz günü");
    }
    for (const t of b.kesifler || []) {
      const once = xs;
      xs = durusmaEkle(ff(), t, { tur: "kesif", kaynak: "evrak", evrakId: e.id, ...yer });
      if (xs !== once) degisen.add("keşif günü");
    }
    if (b.oturum?.girildi) {
      const d = xs.find(x => x.tarih.slice(0, 10) === b.oturum!.tarih.slice(0, 10));
      if (d && !d.girildi) { xs = xs.map(x => (x.id === d.id ? { ...x, girildi: b.oturum!.girildi } : x)); degisen.add(b.oturum.girildi === "evet" ? "duruşmaya girildi" : "duruşmaya girilmedi"); }
    }
    // E-duruşma yalnız hukuk davalarında (ceza duruşmasında e-duruşma yoktur; SEGBİS ayrı bir şeydir).
    if (b.e && eSorulur(f)) {
      const ref = b.e.tarih || (e.tarih || b.belgeTarihi || e.eklenme.slice(0, 10));
      const d = b.e.tarih ? xs.find(x => x.tarih.slice(0, 10) === b.e!.tarih!.slice(0, 10) && dTur(x) === "durusma") : durusmaSirala(xs).find(x => x.tarih.slice(0, 10) >= ref.slice(0, 10) && dTur(x) === "durusma");
      if (d && (!d.e || E_SIRA[b.e.durum] > E_SIRA[d.e] || (d.e === "istenmeyecek" && b.e.durum !== "talep"))) {
        const gunu = (e.tarih || b.belgeTarihi || e.eklenme).slice(0, 10);
        xs = xs.map(x => (x.id === d.id ? { ...x, e: b.e!.durum, ...(b.e!.durum === "talep" ? { eTalep: x.eTalep || gunu } : { eKarar: gunu, eTalep: x.eTalep || gunu }) } : x));
        degisen.add(b.e.durum === "talep" ? "e-duruşma talebi" : b.e.durum === "kabul" ? "e-duruşma kabulü" : "e-duruşma reddi");
      }
    }
  }
  return { durusmalar: durusmaSirala(xs), degisen: [...degisen] };
}

/** Föyün mahkemesi ya da dosya numarası değişince (görevsizlik, birleşme, istinaf, yeni esas): bugün ve sonrasındaki günler
 *  yeni mahkeme ve numarayla akar; geçmiş günler o günkü mahkeme ve numarayla kalır. Değişiklik yoksa null. */
export function yerDegisimi(f: Foy, ek: { mahkeme?: string; esasNo?: string }, bugun = bugunGun()): Durusma[] | null {
  const xs = f.durusmalar || [];
  let degisti = false;
  const ys = xs.map(d => {
    if (d.tarih.slice(0, 10) < bugun) return d;
    const y = { ...d };
    if (ek.mahkeme !== undefined && (!d.mahkeme || d.mahkeme === f.mahkeme) && d.mahkeme !== (ek.mahkeme || undefined)) { y.mahkeme = ek.mahkeme || undefined; degisti = true; }
    if (ek.esasNo !== undefined && (!d.esasNo || d.esasNo === f.esasNo) && d.esasNo !== (ek.esasNo || undefined)) { y.esasNo = ek.esasNo || undefined; degisti = true; }
    return y;
  });
  return degisti ? ys : null;
}

/** Akışta mahkeme ya da dosya numarası bir önceki duruşmadan farklıysa: değişikliği anlatan kısa yazı. */
export function yerDegisti(onceki: Durusma | undefined, d: Durusma): string | null {
  if (!onceki) return null;
  const esas = d.esasNo && onceki.esasNo && esasNormal(d.esasNo) !== esasNormal(onceki.esasNo);
  const mah = d.mahkeme && onceki.mahkeme && mahkemeNormal(d.mahkeme) !== mahkemeNormal(onceki.mahkeme);
  if (!esas && !mah) return null;
  return [mah ? d.mahkeme : "", esas ? d.esasNo : ""].filter(Boolean).join(" · ");
}

// ── Uyarılar ────────────────────────────────────────────────────────────────────────────────────────
export type DUyariTur = "girildi" | "eSor" | "eKarar" | "eRed" | "sonraki";
export type DDuzey = "gecikti" | "bugun" | "acil" | "uyari" | "dikkat";
export interface DurusmaUyari { f: Foy; d?: Durusma; tur: DUyariTur; metin: string; sonGun: string; kalan: number; duzey: DDuzey; /** bildirimlerin başlayacağı gün (yoksa son günden 3 gün önce) */ bas?: string }
const duzeyOf = (kalan: number): DDuzey => (kalan < 0 ? "gecikti" : kalan === 0 ? "bugun" : kalan <= 3 ? "acil" : kalan <= 7 ? "uyari" : "dikkat");

/** Bir föyün duruşma uyarıları. Kapalı ve şahsi föyler uyarmaz. */
export function durusmaUyarilari(f: Foy, bugun = bugunGun()): DurusmaUyari[] {
  if (f.ozel || f.durum === "kapali") return [];
  const out: DurusmaUyari[] = [];
  const xs = durusmaSirala(f.durusmalar || []);
  const ekle = (d: Durusma | undefined, tur: DUyariTur, metin: string, sonGun: string, enErken?: number, bas?: string) => {
    const kalan = fark(bugun, sonGun);
    if (enErken !== undefined && kalan > enErken && !(bas && bas <= bugun)) return;
    out.push({ f, d, tur, metin, sonGun, kalan, duzey: duzeyOf(kalan), ...(bas ? { bas } : {}) });
  };
  for (const d of xs) {
    const g = d.tarih.slice(0, 10);
    const kalanD = fark(bugun, g);
    const tur = dTur(d);
    if (kalanD < 0) {
      if (!d.girildi && -kalanD <= GECMIS_UYARI_GUN) ekle(d, "girildi", girildiSoru(tur) + " Kutu işaretlenmedi", g);
      continue;
    }
    if (tur !== "durusma" || icraMi(f)) {
      if (kalanD === 0 && !d.girildi) ekle(d, "girildi", tur === "kesif" ? "Bugün keşif var: katılınca kutuyu işaretleyin" : tur === "haciz" ? "Bugün haciz var: gidilince kutuyu işaretleyin" : "Bugün işlem var: kutuyu işaretleyin", g);
      continue;
    }
    if (!d.e && eSorulur(f)) ekle(d, "eSor", "E-duruşma talep edilecek mi? Karar verilmedi", gunEkle(g, -E_TALEP_GUN), 21);
    else if (d.e === "talep" && eSorulur(f)) {
      // Karar gelmeyen talep: talepten iki gün sonra (en geç duruşmadan iki hafta önce) her gün hatırlatılır; duruşmaya iki gün
      // kala karar hâlâ yoksa acil olur (UYAP'ta görünmeyen ret yüzünden duruşma kaçmasın).
      const bas = [d.eTalep ? gunEkle(d.eTalep, 2) : bugun, gunEkle(g, -14)].sort()[1];
      const metin = kalanD <= 2 ? (kalanD === 0 ? "Bugün duruşma: e-duruşma kararı yok! UYAP'tan bakın; kabul edilmediyse duruşmaya girecek kişiyi hemen ayarlayın" : "Duruşmaya " + kalanD + " gün var, e-duruşma kararı yok! UYAP'tan bakın; kabul edilmediyse duruşmaya girecek kişiyi ayarlayın")
        : "E-duruşma talebine karar verilmedi: UYAP'tan kontrol edin";
      ekle(d, "eKarar", metin, gunEkle(g, -2), 21, bas);
    }
    else if (d.e === "red" && eSorulur(f)) ekle(d, "eRed", "E-duruşma reddedildi: duruşmaya bizzat girilecek", g, 7);
    if (kalanD === 0 && !d.girildi) ekle(d, "girildi", "Bugün duruşma var: girilince kutuyu işaretleyin", g);
  }
  // Son duruşma geçmiş, girilmiş ve sonraki gün yazılmamışsa: sonraki duruşma günü sorulur.
  const son = xs.filter(x => dTur(x) === "durusma").slice(-1)[0];
  if (son && fark(bugun, son.tarih.slice(0, 10)) < 0 && son.girildi && !xs.some(x => x.tarih.slice(0, 10) >= bugun) && durusmaDuzeni(f) === "olagan")
    ekle(son, "sonraki", "Sonraki duruşma günü yazılmadı", gunEkle(son.tarih.slice(0, 10), 3), 0);
  return out;
}

export function tumDurusmaUyarilari(liste: Foy[], bugun = bugunGun()): DurusmaUyari[] {
  const S: DDuzey[] = ["gecikti", "bugun", "acil", "uyari", "dikkat"];
  return liste.flatMap(f => durusmaUyarilari(f, bugun)).sort((a, b) => S.indexOf(a.duzey) - S.indexOf(b.duzey) || a.sonGun.localeCompare(b.sonGun));
}

/** Föy bu kişiyi ilgilendiriyor mu (bildirim için): büro yoksa herkes; yönetici her föy; çalışan yalnız sorumlu olduğu föy. */
export function banaAit(f: Foy, ben?: { uid: string; yonetici: boolean } | null): boolean {
  if (!ben || ben.yonetici) return true;
  return f.sorumlu?.id === ben.uid || f.gorevler.some(g => !g.bitti && g.atanan === ben.uid);
}

/** Akışın tek satırlık özeti (içi rahatlasın diye: sorun yoksa bunu açıkça söyler). */
export function durusmaOzeti(f: Foy, bugun = bugunGun()): { metin: string; iyi: boolean } {
  const xs = f.durusmalar || [];
  if (!xs.length) return { metin: f.durusma ? "Gün akışa ekleniyor" : icraMi(f) ? "Haciz ya da keşif günü yok" : "Duruşma günü yok", iyi: true };
  const u = durusmaUyarilari(f, bugun);
  const sonraki = durusmaSirala(xs).find(x => x.tarih.slice(0, 10) >= bugun);
  const kesifMi = sonraki && dTur(sonraki) !== "durusma";
  const sn = sonraki ? `sonraki ${kesifMi ? DTUR_AD[dTur(sonraki)].toLocaleLowerCase("tr") + " " : ""}${sonraki.tarih.slice(8, 10)}.${sonraki.tarih.slice(5, 7)}.${sonraki.tarih.slice(0, 4)}` + (sonraki.e === "kabul" ? " · e-duruşma ✓" : "") : "";
  if (!u.length) return { metin: ["Her şey işlendi ✓", sn].filter(Boolean).join(" · "), iyi: true };
  return { metin: `${u.length} konu bekliyor: ${u[0].metin.toLocaleLowerCase("tr")}`, iyi: false };
}

// ── Takvim (Duruşmalar ve keşifler sekmesi) ─────────────────────────────────────────────────────────
export interface TakvimSatir { f: Foy; d: Durusma; gun: string; tur: DTur; uyari?: DurusmaUyari }
/** Bütün föylerdeki duruşma ve keşifler, bas ile son (dahil) arasında, güne ve saate göre. Şahsi föyler katılmaz. */
export function takvim(liste: Foy[], bas: string, son: string, bugun = bugunGun()): TakvimSatir[] {
  const out: TakvimSatir[] = [];
  for (const f of liste) {
    if (f.ozel) continue;
    const u = durusmaUyarilari(f, bugun);
    for (const d of f.durusmalar || []) {
      const g = d.tarih.slice(0, 10);
      if (g < bas || g > son) continue;
      out.push({ f, d, gun: g, tur: dTur(d), uyari: u.find(x => x.d?.id === d.id) });
    }
  }
  return out.sort((a, b) => a.d.tarih.localeCompare(b.d.tarih) || (a.f.mahkeme || "").localeCompare(b.f.mahkeme || "", "tr"));
}
export const gunKaydir = (x: string, n: number) => gunEkle(x, n);
