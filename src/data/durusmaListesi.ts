// UYAP duruşma listesi (Avukat Portal "Duruşma Sorgulama" / "Duruşmalarım" çıktısı): Excel, CSV, Word tablosu, PDF, ekran
// görüntüsü ya da sayfadan kopyalanıp yapıştırılan metin. Her satır bir duruşma (keşif, haciz) günüdür. Satırlar dosya numarası
// ve mahkemeye göre var olan föylerle eşleştirilir ve gün o föyün duruşmalarına işlenir; yeni föy kendiliğinden açılmaz.
// Okuma ve eşleştirme cihazda yapılır; liste hiçbir yere gönderilmez.
import { durusmaEkle, DTur, Durusma, bugunGun, icraMi } from "./durusma";
import { bosFoy, Foy, tarihCoz } from "./foy";
import { turTahmin } from "./foyTurleri";
import { adSade, esasNorm, merciUyumu } from "./iliski";
import { merciBul } from "./dosyaListesi";
import { basHarf } from "./kunyeCikar";

export interface ListeDurusmasi {
  /** satırın kendisi (ekranda gösterilir) */
  satir: string;
  mahkeme?: string;
  esasNo: string;
  /** YYYY-AA-GG ya da YYYY-AA-GGTSS:DD */
  tarih: string;
  tur: DTur;
  taraflar?: string;
  islem?: string;
}

const sade = (s: unknown) => String(s ?? "").toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c").replace(/[^a-z0-9]/g, "");
const turBul = (x: string): DTur => (/kesif|keşif|keşf/i.test(x) ? "kesif" : /haciz|hacz/i.test(x) ? "haciz" : "durusma");
const ESAS = /\b((?:19|20)\d{2})\s*\/\s*(\d{1,7})\b/;
const TARIH_SAAT = /\b(\d{1,2})[./-](\d{1,2})[./-]((?:19|20)\d{2})\b(?:\s*(?:-|,|saat|Saat|SAAT)?\s*(\d{1,2})[:.](\d{2})\b)?/g;
const SAAT = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/;

/** Saat hücresi: "10:30", "10.30" ya da Excel kesri (0,4375). */
function saatCoz(v: unknown): string | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  if (typeof v === "number" && v > 0 && v < 1) { const dk = Math.round(v * 1440); return `${String(Math.floor(dk / 60)).padStart(2, "0")}:${String(dk % 60).padStart(2, "0")}`; }
  const m = String(v).match(SAAT);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : undefined;
}
const saatEkle = (tarih: string, saat?: string) => (saat && tarih.length === 10 ? `${tarih}T${saat}` : tarih);

// ---------- Tablo (Excel, CSV, Word, yapıştırılan sekmeli metin) ----------
type Alan = "mahkeme" | "esasNo" | "tarih" | "saat" | "taraflar" | "islem";
const ESLER: [Alan, RegExp][] = [
  ["mahkeme", /^(birim|birimadi|mahkeme|mahkemeadi|daire|merci|yargibirimi)/],
  ["esasNo", /^(dosyano|dosyanumarasi|esasno|esas|dosya$|takipno)/],
  ["saat", /^(saat|durusmasaati|islemsaati)/],
  ["tarih", /^(durusmatarihi|islemtarihi|tarih|durusmagunu|gun|durusma$|tarihsaat)/],
  ["taraflar", /^(taraf|taraflar|tarafbilgisi|davaci|davali|muvekkil)/],
  ["islem", /^(islem|islemturu|durusmaturu|tur|turu|aciklama|sonuc|durusmanedeni)/]
];

/** Tablo bir duruşma listesiyse satırları; başlık tanınmazsa null (o zaman satırlar metin olarak okunur). */
export function tablodanDurusmalar(tablo: (string | number)[][]): ListeDurusmasi[] | null {
  const satirlar = tablo.filter(r => r.some(x => String(x ?? "").trim()));
  let bas = -1, enIyi = 0;
  for (let i = 0; i < Math.min(8, satirlar.length); i++) {
    const n = new Set(satirlar[i].map(h => ESLER.find(([, re]) => re.test(sade(h)))?.[0]).filter(Boolean)).size;
    if (n > enIyi) { enIyi = n; bas = i; }
  }
  if (bas < 0 || enIyi < 2) return null;
  const sutun: Partial<Record<Alan, number>> = {};
  satirlar[bas].forEach((h, i) => { const al = ESLER.find(([a, re]) => sutun[a] === undefined && re.test(sade(h))); if (al) sutun[al[0]] = i; });
  if (sutun.esasNo === undefined || sutun.tarih === undefined) return null;
  const al = (r: (string | number)[], a: Alan) => (sutun[a] === undefined ? "" : r[sutun[a]!] ?? "");
  const yazi = (r: (string | number)[], a: Alan) => String(al(r, a)).replace(/\s+/g, " ").trim();
  const out: ListeDurusmasi[] = [];
  for (const r of satirlar.slice(bas + 1)) {
    const e = yazi(r, "esasNo").match(ESAS);
    let tarih = tarihCoz(al(r, "tarih"));
    if (!tarih) { const m = yazi(r, "tarih").match(/(\d{1,2})[./-](\d{1,2})[./-]((?:19|20)\d{2})/); tarih = m ? tarihCoz(`${m[1]}.${m[2]}.${m[3]}`) : undefined; }
    if (!e || !tarih) continue;
    tarih = saatEkle(tarih, saatCoz(al(r, "saat")) || saatCoz(yazi(r, "tarih").replace(/^\S+/, "")));
    const islem = yazi(r, "islem");
    const mahkeme = yazi(r, "mahkeme");
    out.push({ satir: r.map(x => String(x ?? "").trim()).filter(Boolean).join(" · "), mahkeme: mahkeme || undefined, esasNo: `${e[1]}/${e[2]}`, tarih, tur: turBul(islem), taraflar: yazi(r, "taraflar") || undefined, islem: islem || undefined });
  }
  return out;
}

// ---------- Eski Excel (.xls) ve web sayfası (.html) ----------
const VARLIK: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const varlikCoz = (x: string) => x.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, k: string) => (k[0] === "#" ? String.fromCodePoint(k[1].toLowerCase() === "x" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10)) : VARLIK[k.toLowerCase()] ?? m));
/** HTML tablosunu satır ve hücrelere ayırır (UYAP'ın "Excel'e aktar" çıktısı çoğu zaman .xls uzantılı bir HTML tablosudur). */
export function htmlTablo(html: string): string[][] {
  const out: string[][] = [];
  for (const tr of html.match(/<tr[\s\S]*?<\/tr>/gi) || []) {
    const hucreler = (tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || []).map(c => varlikCoz(c.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim());
    if (hucreler.length) out.push(hucreler);
  }
  return out;
}
/** .xls / .html dosyasının baytları: HTML ise tablo; eski ikili Excel ise açıklamalı hata. */
export function eskiExcelTablo(bytes: Uint8Array): string[][] {
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0)
    throw new Error("Bu dosya eski Excel biçiminde (.xls). Excel'de açıp “Farklı kaydet → Excel Çalışma Kitabı (.xlsx)” ile kaydedip yükleyin; ya da UYAP'tan PDF olarak alın veya tabloyu kopyalayıp “Metni yapıştır”a yapıştırın.");
  let metin = new TextDecoder("utf-8").decode(bytes);
  if (metin.includes("\uFFFD")) { try { metin = new TextDecoder("windows-1254").decode(bytes); } catch { /* utf-8 kalsın */ } }
  if (!/<table/i.test(metin)) throw new Error("Dosyada tablo bulunamadı.");
  return htmlTablo(metin);
}

// ---------- Düz metin (PDF, ekran görüntüsü, kopyalanan sayfa) ----------
/** Her satırda (ya da birkaç satıra bölünmüş kayıtta) dosya numarası ve gün aranır. */
export function metindenDurusmalar(metin: string): ListeDurusmasi[] {
  // Sekmeyle ayrılmış (UYAP sayfasından kopyalanan) tablo önce tablo olarak denenir.
  if (/\t/.test(metin)) {
    const t = tablodanDurusmalar(metin.split(/\r?\n/).map(x => x.split("\t")));
    if (t && t.length) return t;
  }
  const satirlar = metin.split(/\r?\n/).map(x => x.replace(/\s+/g, " ").trim()).filter(Boolean);
  const out: ListeDurusmasi[] = [];
  for (let i = 0; i < satirlar.length; i++) {
    const x = satirlar[i];
    const e = x.match(ESAS);
    if (!e) continue;
    // Gün aynı satırda yoksa bir sonraki satırlara taşmış olabilir (kayıt birkaç satıra bölünür).
    let blok = x, j = i;
    while (!new RegExp(TARIH_SAAT.source).test(blok.replace(ESAS, " ")) && j < i + 2 && j + 1 < satirlar.length && !ESAS.test(satirlar[j + 1])) blok += " " + satirlar[++j];
    const temiz = blok.replace(ESAS, " ");
    const gunler = [...temiz.matchAll(TARIH_SAAT)];
    if (!gunler.length) continue;
    // Saati olan gün duruşma günüdür (kayıt / açılış tarihi saatsizdir); hiçbirinde saat yoksa son gün.
    const g = gunler.find(m => m[4]) || gunler[gunler.length - 1];
    let tarih = tarihCoz(`${g[1]}.${g[2]}.${g[3]}`);
    if (!tarih) continue;
    const saat = g[4] ? `${g[4].padStart(2, "0")}:${g[5]}` : saatCoz(temiz.slice((g.index || 0) + g[0].length));
    tarih = saatEkle(tarih, saat);
    const u = blok.toLocaleUpperCase("tr");
    let mahkeme = merciBul(u);
    if (!mahkeme && i > 0 && !ESAS.test(satirlar[i - 1])) mahkeme = merciBul(satirlar[i - 1].toLocaleUpperCase("tr"));
    out.push({ satir: blok, mahkeme: mahkeme ? basHarf(mahkeme) : undefined, esasNo: `${e[1]}/${e[2]}`, tarih, tur: turBul(blok), islem: undefined });
    i = j;
  }
  return out;
}

/** Aynı dosyanın aynı günü bir kez. */
export function tekillestir(xs: ListeDurusmasi[]): ListeDurusmasi[] {
  const m = new Map<string, ListeDurusmasi>();
  for (const r of xs) {
    const k = esasNorm(r.esasNo) + "|" + (r.mahkeme || "").toLocaleLowerCase("tr") + "|" + r.tarih.slice(0, 10) + "|" + r.tur;
    const v = m.get(k);
    if (!v || r.tarih.length > v.tarih.length) m.set(k, r);
  }
  return [...m.values()].sort((a, b) => a.tarih.localeCompare(b.tarih));
}

// ---------- Föylerle eşleştirme ----------
export type EslesmeDurumu = "eslesti" | "secim" | "yok";
export interface ListeEslesmesi {
  r: ListeDurusmasi;
  durum: EslesmeDurumu;
  /** kendiliğinden eşleşen föy */
  foy?: Foy;
  /** seçilecek föyler (aynı numara birden çok föyde, ya da numara tutuyor ama mahkeme farklı yazılmış) */
  adaylar: Foy[];
  neden: string;
  /** bu gün föyde zaten kayıtlı (saat eksikse tamamlanır) */
  zatenVar: boolean;
}

const gunKayitli = (f: Foy, r: ListeDurusmasi) => (f.durusmalar || []).some(d => d.tarih.slice(0, 10) === r.tarih.slice(0, 10) && (d.tur || "durusma") === r.tur && (d.tarih.length >= r.tarih.length));

/** Taraflar sütunu verilmişse föyün müvekkil / karşı taraf adıyla ortak sözcük var mı? */
function tarafTutar(f: Foy, taraflar?: string): boolean {
  if (!taraflar) return false;
  const t = adSade(taraflar).split(" ").filter(w => w.length >= 4);
  const adlar = (adSade(f.muvekkil) + " " + adSade(f.karsiTaraf)).split(" ").filter(w => w.length >= 4);
  return t.some(w => adlar.includes(w));
}

export function eslestir(satirlar: ListeDurusmasi[], liste: Foy[]): ListeEslesmesi[] {
  const dizin = new Map<string, Foy[]>();
  for (const f of liste) {
    const e = esasNorm(f.esasNo); if (e) dizin.set(e, [...(dizin.get(e) || []), f]);
    // Föyün önceki numaraları (dosya mahkeme değiştirdiyse duruşma kayıtlarında durur).
    for (const d of f.durusmalar || []) { const x = esasNorm(d.esasNo); if (x && x !== e) dizin.set(x, [...(dizin.get(x) || []).filter(y => y.id !== f.id), f]); }
  }
  const numarasizlar = liste.filter(f => !esasNorm(f.esasNo) && f.durum !== "kapali");
  return satirlar.map(r => {
    const ayni = dizin.get(esasNorm(r.esasNo)) || [];
    const uyumlu = ayni.filter(f => merciUyumu(f.mahkeme, r.mahkeme) !== "celisir");
    const tam = uyumlu.filter(f => merciUyumu(f.mahkeme, r.mahkeme) === "ayni");
    const sec = (f: Foy, neden: string): ListeEslesmesi => ({ r, durum: "eslesti", foy: f, adaylar: [], neden, zatenVar: gunKayitli(f, r) });
    if (tam.length === 1) return sec(tam[0], "aynı dosya no ve mahkeme");
    if (uyumlu.length === 1) return sec(uyumlu[0], r.mahkeme ? "aynı dosya no (föyde mahkeme yazılı değil)" : "aynı dosya no");
    // Birden çok aday: taraf adı tutan tek föy varsa o.
    const adaylar = (tam.length > 1 ? tam : uyumlu.length > 1 ? uyumlu : ayni);
    const taraf = adaylar.filter(f => tarafTutar(f, r.taraflar));
    if (adaylar.length > 1 && taraf.length === 1) return sec(taraf[0], "aynı dosya no ve taraf adı");
    if (adaylar.length) return { r, durum: "secim", adaylar, neden: adaylar.length > 1 ? "bu numarada birden çok föy var" : "dosya no tutuyor, mahkeme farklı yazılmış", zatenVar: false };
    // Föyde dosya no yazılı değilse: aynı mahkeme ya da taraf adı tutan numarasız föyler seçenek olur.
    const numarasiz = numarasizlar.filter(f => tarafTutar(f, r.taraflar) || (merciUyumu(f.mahkeme, r.mahkeme) === "ayni" && !!r.mahkeme));
    if (numarasiz.length && numarasiz.length <= 8) return { r, durum: "secim", adaylar: numarasiz, neden: "bu numarada föy yok; dosya no'su yazılmamış föylerde mahkeme ya da taraf adı tutuyor", zatenVar: false };
    return { r, durum: "yok", adaylar: [], neden: "bu numarada föy yok", zatenVar: false };
  });
}

/** Eşleşmeyen satır için akla yatkın föyler (aynı mahkeme ve aynı yıl, ya da taraf adı tutan), en yakını önde. */
export function benzerFoyler(r: ListeDurusmasi, liste: Foy[], n = 8): Foy[] {
  const yil = esasNorm(r.esasNo).slice(0, 4);
  return liste
    .map(f => ({ f, p: (merciUyumu(f.mahkeme, r.mahkeme) === "ayni" ? 3 : 0) + (esasNorm(f.esasNo).startsWith(yil) ? 1 : 0) + (tarafTutar(f, r.taraflar) ? 4 : 0) }))
    .filter(x => x.p >= 3).sort((a, b) => b.p - a.p).slice(0, n).map(x => x.f);
}

/** Satırın gününü föye işler: duruşma akışına eklenir (aynı gün varsa saat tamamlanır); ileri tarihliyse "sonraki duruşma" olur. */
export function listeyiIsle(f: Foy, xs: ListeDurusmasi[], bugun = bugunGun()): Foy {
  let durusmalar: Durusma[] = f.durusmalar || [];
  for (const r of xs) {
    const tur: DTur = icraMi(f) && r.tur === "durusma" ? "haciz" : r.tur;
    durusmalar = durusmaEkle({ ...f, durusmalar }, r.tarih, { tur, kaynak: "liste", mahkeme: r.mahkeme || f.mahkeme || undefined, esasNo: r.esasNo, not: r.islem && r.islem.length < 80 ? r.islem : undefined });
  }
  const ileri = xs.filter(r => r.tarih.slice(0, 10) >= bugun && r.tur === "durusma").map(r => r.tarih).sort()[0];
  const durusma = ileri && (!f.durusma || f.durusma.slice(0, 10) < bugun || f.durusma.slice(0, 10) > ileri.slice(0, 10) || f.durusma.slice(0, 10) === ileri.slice(0, 10)) ? ileri : f.durusma;
  return { ...f, durusmalar, durusma, guncelleme: new Date().toISOString() };
}

/** Eşleşmeyen satırdan yeni föy: mahkeme, numara ve gün; taraflar nota yazılır (hangisinin müvekkil olduğu listede yazmaz). */
export function listedenYeniFoy(r: ListeDurusmasi): Foy {
  const tur = turTahmin(r.mahkeme || "", r.islem || "") || "hukuk";
  const f = bosFoy({ tur, mahkeme: r.mahkeme || "", esasNo: r.esasNo, notlar: r.taraflar ? "Duruşma listesindeki taraflar: " + r.taraflar : "" });
  return listeyiIsle(f, [r]);
}
