// Föyün hesabı ve talepleri (cihazda; eşitlemede şifreli):
//  - Vekâlet ücreti: sözleşmedeki tutar (taranmış sözleşmeden okunabilir) ve sözleşme evrakı.
//  - Kalemler: müvekkilden tahsilat, dava masrafı (harç, gider avansı, bilirkişi, tebligat, yol, kırtasiye…), tevkil ödemesi.
//  - Yol ve kırtasiye: büronun birim bedellerine göre girilen duruşmalardan ve dilekçelerden hesaplanır.
//  - Tevkil avukatlar: dosyada yetki belgesiyle duruşmaya giren meslektaşlar; evraktan tanınır, avukat onaylayınca kaydedilir.
//    Bütün föylerdeki kayıtlar birleşerek "Tevkil avukatlar" listesini oluşturur (kim, telefon, hangi dosyalar, ne ödendi).
//  - Talepler: adli yardım, ihtiyati haciz, ihtiyati tedbir, delil tespiti, yürütmeyi durdurma, duruşmalı inceleme.
import type { Foy } from "./foy";

export type KalemTur = "tahsilat" | "masraf" | "tevkil";
export interface HesapKalem {
  id: string; tarih: string; tutar: number; tur: KalemTur;
  kategori?: string; aciklama?: string;
  /** tevkil ödemesi: avukatın kimliği (TevkilAvukat.id) */
  kisi?: string;
  /** dekont, makbuz ya da sözleşme evrakı */
  evrakId?: string;
  /** yol gideri hangi duruşma için hesaplandı (aynı duruşma iki kez sayılmasın) */
  durusmaId?: string;
  /** tarifeden hesaplanmış başlangıç gideri (ucretTarife.ts kodu): gerçek makbuz gelince düzeltilir */
  tahmin?: string;
  /** "Tamamı tahsil edildi" düğmesiyle yazılan kalan ücret tahsilatı (düğme geri alınınca silinir) */
  tamami?: boolean;
}
export interface FoyHesap {
  ucret?: { tutar?: number; aciklama?: string; sozlesmeEvrakId?: string; tarih?: string };
  /** dava değeri (harca esas değer): asgari ücret ve harç hesabı için */
  davaDegeri?: number;
  kalemler: HesapKalem[];
}
export interface TevkilAvukat {
  id: string; ad: string; baro?: string; sicil?: string; telefon?: string; eposta?: string; not?: string;
  /** hangi duruşmalara girdi (Durusma.id) */
  durusmalar?: string[];
  kaynak?: "elle" | "evrak"; evrakId?: string;
}
export type TalepTur = "adli_yardim" | "ihtiyati_haciz" | "ihtiyati_tedbir" | "delil_tespiti" | "yurutmeyi_durdurma" | "durusmali_inceleme";
export type TalepDurum = "talep" | "kabul" | "red";
export interface Talep { id: string; tur: TalepTur; durum: TalepDurum; tarih?: string; kararTarih?: string; evrakId?: string; not?: string }

export const TALEP_AD: Record<TalepTur, string> = {
  adli_yardim: "Adli yardım", ihtiyati_haciz: "İhtiyati haciz", ihtiyati_tedbir: "İhtiyati tedbir",
  delil_tespiti: "Delil tespiti", yurutmeyi_durdurma: "Yürütmeyi durdurma", durusmali_inceleme: "Duruşmalı inceleme"
};
export const MASRAF_KATEGORI = ["Başvuru / peşin harç", "Gider avansı", "Bilirkişi ücreti", "Keşif gideri", "Tebligat / posta", "Tanık ücreti",
  "İstinaf / temyiz harcı", "Noter", "Yol gideri", "Kırtasiye / fotokopi", "Diğer"];

const yid = (on: string) => on + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
export const yeniKalemId = () => yid("h");
export const yeniKisiId = () => yid("tv");
export const yeniTalepId = () => yid("t");

/** "12.500,50 TL", "12500", "12.500" → 12500.5 */
export function tutarCoz(x: string): number | undefined {
  const s = x.replace(/[^\d.,]/g, "");
  if (!s) return undefined;
  const n = /,\d{1,2}$/.test(s) ? Number(s.replace(/\./g, "").replace(",", ".")) : /\.\d{1,2}$/.test(s) && (s.match(/\./g) || []).length === 1 && !/\.\d{3}$/.test(s) ? Number(s.replace(/,/g, "")) : Number(s.replace(/[.,]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
export const tlYaz = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + " TL";

export interface HesapOzet { ucret: number; tahsilat: number; kalanUcret: number; masraf: number; tevkil: number }
export function hesapOzeti(f: Foy): HesapOzet {
  const k = f.hesap?.kalemler || [];
  const top = (t: KalemTur) => k.filter(x => x.tur === t).reduce((a, x) => a + (x.tutar || 0), 0);
  const ucret = f.hesap?.ucret?.tutar || 0, tahsilat = top("tahsilat");
  return { ucret, tahsilat, kalanUcret: Math.max(0, ucret - tahsilat), masraf: top("masraf"), tevkil: top("tevkil") };
}

// ── Yol ve kırtasiye ────────────────────────────────────────────────────────────────────────────────
/** Büronun birim bedelleri (bu cihazda tutulur). */
export interface BirimBedel { yol: number; kirtasiyeDilekce: number; kirtasiyeDosya: number }
export const VARSAYILAN_BEDEL: BirimBedel = { yol: 0, kirtasiyeDilekce: 0, kirtasiyeDosya: 0 };
/** Henüz yazılmamış yol ve kırtasiye kalemleri: bizzat girilen her duruşma için bir yol gideri (e-duruşma ile girilen
 *  duruşmada yol yoktur), dosyadaki her dilekçe için kırtasiye, dosya başına bir kez sabit kırtasiye. */
export function standartGiderler(f: Foy, b: BirimBedel, bugun: string): HesapKalem[] {
  const var_ = f.hesap?.kalemler || [];
  const out: HesapKalem[] = [];
  if (b.yol > 0) for (const d of f.durusmalar || []) {
    if (d.girildi !== "evet" || d.e === "kabul" || var_.some(x => x.durusmaId === d.id)) continue;
    out.push({ id: yeniKalemId(), tarih: d.tarih.slice(0, 10), tutar: b.yol, tur: "masraf", kategori: "Yol gideri", aciklama: "Duruşma " + d.tarih.slice(0, 10).split("-").reverse().join("."), durusmaId: d.id });
  }
  if (b.kirtasiyeDilekce > 0) {
    const dilekce = f.evraklar.filter(e => /dilekçe|savunma/i.test(e.tur || "")).length;
    const yazilan = var_.filter(x => x.kategori === "Kırtasiye / fotokopi" && x.aciklama?.startsWith("Dilekçe")).reduce((a, x) => a + Math.round((x.tutar || 0) / b.kirtasiyeDilekce), 0);
    const n = dilekce - yazilan;
    if (n > 0) out.push({ id: yeniKalemId(), tarih: bugun, tutar: n * b.kirtasiyeDilekce, tur: "masraf", kategori: "Kırtasiye / fotokopi", aciklama: `Dilekçe kırtasiyesi (${n} dilekçe)` });
  }
  if (b.kirtasiyeDosya > 0 && !var_.some(x => x.aciklama === "Dosya kırtasiyesi")) out.push({ id: yeniKalemId(), tarih: bugun, tutar: b.kirtasiyeDosya, tur: "masraf", kategori: "Kırtasiye / fotokopi", aciklama: "Dosya kırtasiyesi" });
  return out;
}

// ── Evraktan okuma ──────────────────────────────────────────────────────────────────────────────────
const UST = (x: string) => x.toLocaleUpperCase("tr").replace(/[ \t]+/g, " ");
const PARA = String.raw`(\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:TL|₺|TÜRK LİRASI)`;

/** Vekâlet ücreti sözleşmesi mi; öyleyse kararlaştırılan ücret. */
export function ucretSozlesmesiOku(metin: string): { sozlesme: boolean; tutar?: number } {
  const u = UST(metin);
  const sozlesme = /(AVUKATLIK|VEKALET|VEKÂLET)\s*ÜCRET[İI]?\s*SÖZLEŞMES[İI]|ÜCRET SÖZLEŞMES[İI]/.test(u);
  if (!sozlesme) return { sozlesme };
  const m = u.match(new RegExp(String.raw`(?:ÜCRET|BEDEL|TUTAR)[^\n]{0,80}?` + PARA)) || u.match(new RegExp(PARA));
  return { sozlesme, tutar: m ? tutarCoz(m[1]) : undefined };
}

/** Harç / masraf makbuzu, dekont: kategori ve tutar (en büyük "TOPLAM" ya da son tutar). */
export function makbuzOku(metin: string): { kategori: string; tutar: number } | null {
  const u = UST(metin);
  if (!/MAKBUZ|DEKONT|HARÇ TAHS|TAHSİLAT|GİDER AVANSI|ÖDEME BELGESİ/.test(u)) return null;
  const kategori = /GİDER AVANSI/.test(u) ? "Gider avansı" : /BİLİRKİŞİ/.test(u) ? "Bilirkişi ücreti" : /KEŞİF/.test(u) ? "Keşif gideri" : /İSTİNAF|TEMYİZ/.test(u) ? "İstinaf / temyiz harcı"
    : /HARÇ/.test(u) ? "Başvuru / peşin harç" : /POSTA|TEBLİGAT/.test(u) ? "Tebligat / posta" : /NOTER/.test(u) ? "Noter" : "Diğer";
  const top = u.match(new RegExp(String.raw`(?:GENEL\s*)?TOPLAM[^\n\d]{0,30}` + PARA.replace(String.raw`\s*(?:TL|₺|TÜRK LİRASI)`, String.raw`\s*(?:TL|₺)?`)));
  const tum = [...u.matchAll(new RegExp(PARA, "g"))].map(m => tutarCoz(m[1]) || 0);
  const tutar = top ? tutarCoz(top[1]) : tum.length ? Math.max(...tum) : undefined;
  return tutar ? { kategori, tutar } : null;
}

/** Tevkil: yetki belgesi ya da tutanakta "yetki belgesi ile" giren avukat. Bizim büronun avukatları ve karşı taraf vekili çıkarılır. */
export function tevkilOku(metin: string, haric: string[] = []): { ad: string; baro?: string; sicil?: string; telefon?: string }[] {
  const u = UST(metin);
  if (!/YETKİ BELGES|TEVKİL|YETKİ VERİL/.test(u)) return [];
  const sade = (x: string) => x.toLocaleLowerCase("tr").replace(/^av(ukat)?\.?\s*/i, "").replace(/[^\p{L} ]+/gu, " ").replace(/\s+/g, " ").trim();
  const haricS = haric.map(sade).filter(Boolean);
  const out: { ad: string; baro?: string; sicil?: string; telefon?: string }[] = [];
  const ADLAR = /(?<![A-ZÇĞİÖŞÜ])(?:AV\.|AVUKAT\s)\s*([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ]+(?:\s+[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ]+){1,3})/g;
  // Yetki belgesinde yetki verilen avukat; tutanakta "yetki belgesi ile / tevkilen" geçen avukat.
  const bolgeler: string[] = [];
  for (const m of u.matchAll(/[^\n]{0,160}(YETKİ BELGES[İI](?:\s*İLE|YLE)?|TEVKİLEN|TEVKİL|YETKİ VERİL[A-ZÇĞİÖŞÜ]*)[^\n]{0,160}/g)) bolgeler.push(m[0]);
  if (/YETKİ BELGESİ\s*$/m.test(u.slice(0, 400))) bolgeler.push(u.slice(0, 2500));
  for (const b of bolgeler) for (const m of b.matchAll(ADLAR)) {
    const ad = m[1].replace(/\s+(VEKİLİ|İLE|YETKİ|BELGESİ|GELDİ|HAZIR|TEVKİLEN|BAROSU|SİCİL).*$/, "").trim();
    const s = sade(ad);
    if (s.split(" ").length < 2 || haricS.some(h => h && (h === s || h.includes(s) || s.includes(h))) || out.some(o => sade(o.ad) === s)) continue;
    const baro = b.match(/([A-ZÇĞİÖŞÜ]+)\s+BAROSU/)?.[1];
    const sicil = b.match(/SİCİL\s*(?:NO|NUMARASI)?\s*[:.]?\s*(\d{2,7})/)?.[1];
    const tel = b.match(/(?:TEL|TELEFON|GSM)\s*[:.]?\s*(\+?9?0?\s*\(?5\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2})/)?.[1];
    const ilk = (w: string) => w.slice(0, 1) + w.slice(1).toLocaleLowerCase("tr");
    out.push({ ad: "Av. " + ad.split(" ").map(ilk).join(" "), baro: baro ? ilk(baro) : undefined, sicil, telefon: tel?.replace(/\s+/g, " ") });
  }
  return out;
}

/** Talep ve kararı: "ihtiyati tedbir talebinin kabulüne", "adli yardım talebimizin…", "yürütmenin durdurulmasına". */
export function talepOku(metin: string): { tur: TalepTur; durum: TalepDurum }[] {
  const u = UST(metin);
  const DESEN: [TalepTur, string][] = [
    ["adli_yardim", "ADLİ YARDIM"], ["ihtiyati_haciz", "İHTİYATİ HACİZ"], ["ihtiyati_tedbir", "İHTİYATİ TEDBİR"],
    ["delil_tespiti", "DELİL TESPİT"], ["yurutmeyi_durdurma", "YÜRÜTMEN[İI]N DURDURULMASI|YÜRÜTMEYİ DURDURMA"], ["durusmali_inceleme", "DURUŞMALI (?:İNCELEME|OLARAK İNCELEN)"]
  ];
  const out: { tur: TalepTur; durum: TalepDurum }[] = [];
  for (const [tur, d] of DESEN) {
    const re = new RegExp(String.raw`(?:${d})[^\n,;]{0,120}`, "g");
    let durum: TalepDurum | undefined;
    for (const m of u.matchAll(re)) {
      const x = m[0];
      if (/REDDİNE|REDDEDİL|KABULÜNE YER OLMADIĞINA|UYGUN GÖRÜLMEDİ/.test(x)) { durum = "red"; break; }
      if (/KABULÜNE|KABUL EDİL|KARAR VERİLMİŞTİR|UYGUN GÖRÜL|DURDURULMASINA|KONULMASINA|TEDBİR KONULMASINA|HACİZ KONULMASINA/.test(x)) durum = "kabul";
      else if (!durum && /TALEP|İSTEM|TALEBİMİZ|KARAR VERİLMESİNİ|ARZ VE TALEP/.test(x)) durum = "talep";
    }
    if (durum) out.push({ tur, durum });
  }
  return out;
}

const TALEP_SIRA: Record<TalepDurum, number> = { talep: 0, kabul: 1, red: 1 };
/** Yeni eklenen evraktan föyün hesabına, tevkil kayıtlarına ve taleplerine işlenecekler (yalnız eksik olan eklenir; elle
 *  yazılana dokunulmaz). haric: bizim büronun avukatları ve karşı taraf vekili (tevkil sayılmaz). */
export function evraktanHesap(f: Foy, evraklar: { id: string; metin: string; tarih?: string; eklenme: string }[], haric: string[], bugun: string): { ek: Partial<Foy>; degisen: string[] } {
  const degisen = new Set<string>();
  let hesap: FoyHesap = { kalemler: [...(f.hesap?.kalemler || [])], ...(f.hesap?.ucret ? { ucret: { ...f.hesap.ucret } } : {}) };
  let tevkil = [...(f.tevkil || [])];
  let talepler = [...(f.talepler || [])];
  const sade = (x: string) => x.toLocaleLowerCase("tr").replace(/^av(ukat)?\.?\s*/, "").replace(/[^\p{L} ]+/gu, " ").replace(/\s+/g, " ").trim();
  for (const e of evraklar) {
    if (!e.metin || !e.metin.trim()) continue;
    const gun = (e.tarih || e.eklenme).slice(0, 10) || bugun;
    const u = ucretSozlesmesiOku(e.metin);
    if (u.sozlesme && !hesap.ucret?.sozlesmeEvrakId) { hesap = { ...hesap, ucret: { ...(hesap.ucret || {}), sozlesmeEvrakId: e.id, tarih: hesap.ucret?.tarih || gun, ...(hesap.ucret?.tutar ? {} : u.tutar ? { tutar: u.tutar } : {}) } }; degisen.add("vekâlet ücreti sözleşmesi"); continue; }
    const m = makbuzOku(e.metin);
    if (m && !hesap.kalemler.some(k => k.evrakId === e.id)) { hesap.kalemler.push({ id: yeniKalemId(), tarih: gun, tutar: m.tutar, tur: "masraf", kategori: m.kategori, aciklama: "Makbuzdan okundu", evrakId: e.id }); degisen.add("masraf (" + m.kategori.toLocaleLowerCase("tr") + ")"); }
    for (const tv of tevkilOku(e.metin, haric)) {
      const o = tevkil.find(x => sade(x.ad) === sade(tv.ad));
      if (o) { tevkil = tevkil.map(x => (x.id === o.id ? { ...x, baro: x.baro || tv.baro, sicil: x.sicil || tv.sicil, telefon: x.telefon || tv.telefon } : x)); continue; }
      tevkil.push({ id: yeniKisiId(), ...tv, kaynak: "evrak", evrakId: e.id }); degisen.add("tevkil avukat (" + tv.ad + ")");
    }
    for (const tl of talepOku(e.metin)) {
      const o = talepler.find(x => x.tur === tl.tur);
      if (!o) { talepler.push({ id: yeniTalepId(), tur: tl.tur, durum: tl.durum, tarih: gun, ...(tl.durum !== "talep" ? { kararTarih: gun } : {}), evrakId: e.id }); degisen.add(TALEP_AD[tl.tur].toLocaleLowerCase("tr") + " " + (tl.durum === "talep" ? "talebi" : tl.durum === "kabul" ? "kabulü" : "reddi")); }
      else if (TALEP_SIRA[tl.durum] > TALEP_SIRA[o.durum]) { talepler = talepler.map(x => (x.id === o.id ? { ...x, durum: tl.durum, kararTarih: gun, evrakId: x.evrakId || e.id } : x)); degisen.add(TALEP_AD[tl.tur].toLocaleLowerCase("tr") + (tl.durum === "kabul" ? " kabulü" : " reddi")); }
    }
  }
  const ek: Partial<Foy> = {};
  if (degisen.size) { ek.hesap = hesap; if (tevkil.length) ek.tevkil = tevkil; if (talepler.length) ek.talepler = talepler; }
  return { ek, degisen: [...degisen] };
}

/** Bütün föylerdeki tevkil kayıtları kişi başına birleşir: hangi dosyalar, kaç duruşma, ne ödendi. */
export interface TevkilKisi { anahtar: string; ad: string; baro?: string; sicil?: string; telefon?: string; eposta?: string; dosyalar: { f: Foy; k: TevkilAvukat; odenen: number; durusma: number }[]; toplam: number }
export function tevkilListesi(liste: Foy[]): TevkilKisi[] {
  const sade = (x: string) => x.toLocaleLowerCase("tr").replace(/^av(ukat)?\.?\s*/, "").replace(/[^\p{L} ]+/gu, " ").replace(/\s+/g, " ").trim();
  const m = new Map<string, TevkilKisi>();
  for (const f of liste) for (const k of f.tevkil || []) {
    const a = k.sicil ? "s:" + k.sicil : "a:" + sade(k.ad);
    const x = m.get(a) || { anahtar: a, ad: k.ad, dosyalar: [], toplam: 0 } as TevkilKisi;
    for (const alan of ["baro", "sicil", "telefon", "eposta"] as const) if (!x[alan] && k[alan]) x[alan] = k[alan];
    const odenen = (f.hesap?.kalemler || []).filter(h => h.tur === "tevkil" && h.kisi === k.id).reduce((s, h) => s + h.tutar, 0);
    x.dosyalar.push({ f, k, odenen, durusma: (k.durusmalar || []).length });
    x.toplam += odenen;
    m.set(a, x);
  }
  return [...m.values()].sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
}
