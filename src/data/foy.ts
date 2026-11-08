// Dava takibi (föyler). Her dosya bir föydür: türü (hukuk davası, soruşturma, arabuluculuk…), künye, aşama, duruşmalar, evrak,
// görevler ve yapay zekâ değerlendirmesi. Föyler birbirine bağlanır (soruşturma → ceza davası; arabuluculuk → hukuk davası).
// Hepsi YALNIZ BU CİHAZDA (tarayıcının IndexedDB deposu) tutulur; asıl evrak ve gerçek adlar sunucuya gitmez. Yapay zekâya
// yalnız cihazda kodlanmış metin gider. Kişisel ceza ve baro soruşturmaları "özel"dir: ayrı bir şifreden türetilen anahtarla
// AES-GCM ile şifrelenip saklanır; şifre girilmeden listede görünmez, şifre hiçbir yere kaydedilmez.
// Kaybolmaya karşı "Yedeği indir" bütün föyleri tek dosyaya yazar (özel föyler şifreli hâliyle); "Yedekten yükle" geri getirir.
import { FoyTur, ozelTur } from "./foyTurleri";

export type FoyTaraf = "davaci" | "davali";
export interface Gorev { id: string; metin: string; tarih?: string; bitti: boolean; kaynak: "elle" | "yapay" | "aktarma" }
export interface FoyEvrak {
  id: string; ad: string; boyut: number; eklenme: string; metin: string; okunamadi?: string;
  /** evrak türü (Bilirkişi raporu, Karar, Dilekçe…) ve önemi: cihazda belirlenir, avukat değiştirebilir */
  tur?: string; onemli?: boolean;
  /** bu evrakın tek başına kodlanmış hâli (yalnız bu metin dışarı gidebilir) ve kodların karşılıkları (cihazda kalır) */
  maskeli?: string; kodlar?: Record<string, string>;
  /** DavaTek klasöründen geldiyse klasördeki yolu */
  kaynak?: string;
}
export interface FoyDegerlendirme { tarih: string; ozet: string; uyusmazlik: string[]; sureler: string[]; zayif: string[] }
export interface Foy {
  id: string; olusturma: string; guncelleme: string;
  /** dosya türü; eski föylerde yoktur (hukuk davası sayılır) */
  tur?: FoyTur;
  /** türüne göre aşama (Tahkikat, İddianame, Haciz…) */
  asama?: string;
  /** bu dosya hangi dosyanın devamı (soruşturma → ceza davası, arabuluculuk → hukuk davası) */
  oncekiId?: string;
  /** kilitli özel dosya (kişisel ceza, baro soruşturması) */
  ozel?: boolean;
  muvekkil: string; karsiTaraf: string; mahkeme: string; esasNo: string; davaTuru: string; taraf: FoyTaraf;
  durum: "acik" | "kapali";
  /** Sonraki duruşma: YYYY-AA-GG (saat isteğe bağlı: YYYY-AA-GGTSS:DD). */
  durusma?: string;
  notlar: string; gorevler: Gorev[]; evraklar: FoyEvrak[]; degerlendirme?: FoyDegerlendirme;
}

export const yeniId = (on: string) => on + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
export function bosFoy(k: Partial<Foy> = {}): Foy {
  const simdi = new Date().toISOString();
  const f: Foy = { id: yeniId("foy"), olusturma: simdi, guncelleme: simdi, tur: "hukuk", muvekkil: "", karsiTaraf: "", mahkeme: "", esasNo: "", davaTuru: "", taraf: "davaci", durum: "acik", notlar: "", gorevler: [], evraklar: [], ...k };
  f.ozel = ozelTur(f.tur);
  return f;
}
export const foyBaslik = (f: Foy) => [f.muvekkil || "Müvekkil yazılmamış", f.karsiTaraf].filter(Boolean).join(" – ");

// ---------- IndexedDB ----------
// Sürüm 2: "ozel" (şifreli özel föyler) ve "ayar" (kilit bilgisi, DavaTek klasörü, görülen dosyalar) depoları eklendi.
const DB = "celse-foy", SURUM = 2;
type Depo = "foyler" | "dosyalar" | "ozel" | "ayar";
const destek = () => typeof indexedDB !== "undefined";
export const foyDestekli = destek;

function ac(): Promise<IDBDatabase> {
  return new Promise((ok, hata) => {
    const r = indexedDB.open(DB, SURUM);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains("foyler")) db.createObjectStore("foyler", { keyPath: "id" });
      if (!db.objectStoreNames.contains("dosyalar")) db.createObjectStore("dosyalar");
      if (!db.objectStoreNames.contains("ozel")) db.createObjectStore("ozel", { keyPath: "id" });
      if (!db.objectStoreNames.contains("ayar")) db.createObjectStore("ayar");
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => hata(r.error);
  });
}
function islem<T>(depo: Depo, kip: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
  return ac().then(db => new Promise<T>((ok, hata) => {
    const tx = db.transaction(depo, kip);
    const r = f(tx.objectStore(depo));
    tx.oncomplete = () => { ok((r ? (r as IDBRequest).result : undefined) as T); db.close(); };
    tx.onerror = () => { hata(tx.error); db.close(); };
    tx.onabort = () => { hata(tx.error); db.close(); };
  }));
}
export const ayarOku = <T>(k: string) => islem<T | undefined>("ayar", "readonly", s => s.get(k));
export const ayarYaz = (k: string, v: unknown) => islem("ayar", "readwrite", s => { s.put(v, k); });

// Ekranlar değişiklikten haberdar olsun diye basit dinleyici.
const dinleyiciler = new Set<() => void>();
export function foyDinle(f: () => void) { dinleyiciler.add(f); return () => { dinleyiciler.delete(f); }; }
const haber = () => dinleyiciler.forEach(f => { try { f(); } catch { /* yok say */ } });

// ---------- Özel föy kilidi (şifreleme) ----------
interface Sifreli { iv: Uint8Array; veri: ArrayBuffer }
interface KilitBilgi { tuz: Uint8Array; dogrulama: Sifreli }
interface OzelKayit extends Sifreli { id: string }
const DOGRULAMA = "celse-ozel-foy";
const KILIT_SURE = 15 * 60 * 1000;
let anahtar: CryptoKey | null = null;
let sonKullanim = 0;
const kodla = (s: string) => new TextEncoder().encode(s);

async function anahtarTuret(sifre: string, tuz: Uint8Array) {
  const ham = await crypto.subtle.importKey("raw", kodla(sifre), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: tuz as BufferSource, iterations: 250000, hash: "SHA-256" }, ham, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function sifrele(k: CryptoKey, veri: Uint8Array): Promise<Sifreli> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return { iv, veri: await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, k, veri as BufferSource) };
}
const coz = (k: CryptoKey, x: Sifreli) => crypto.subtle.decrypt({ name: "AES-GCM", iv: x.iv as BufferSource }, k, x.veri);
/** Kullanılan anahtar (15 dakika dokunulmazsa kilit kendiliğinden kapanır). */
function etkinAnahtar() {
  if (anahtar && Date.now() - sonKullanim > KILIT_SURE) anahtar = null;
  if (anahtar) sonKullanim = Date.now();
  return anahtar;
}
export async function ozelKilitDurumu(): Promise<"yok" | "kilitli" | "acik"> {
  if (!destek()) return "yok";
  const k = await ayarOku<KilitBilgi>("ozelKilit");
  return !k ? "yok" : etkinAnahtar() ? "acik" : "kilitli";
}
export async function ozelKilitKur(sifre: string) {
  if (sifre.length < 6) throw new Error("Şifre en az 6 karakter olmalı.");
  if (await ayarOku<KilitBilgi>("ozelKilit")) throw new Error("Özel dosya şifresi zaten kurulu.");
  const tuz = crypto.getRandomValues(new Uint8Array(16));
  const k = await anahtarTuret(sifre, tuz);
  await ayarYaz("ozelKilit", { tuz, dogrulama: await sifrele(k, kodla(DOGRULAMA)) } as KilitBilgi);
  anahtar = k; sonKullanim = Date.now(); haber();
}
export async function ozelAc(sifre: string): Promise<boolean> {
  const b = await ayarOku<KilitBilgi>("ozelKilit");
  if (!b) return false;
  const k = await anahtarTuret(sifre, b.tuz);
  try {
    const d = new TextDecoder().decode(await coz(k, b.dogrulama));
    if (d !== DOGRULAMA) return false;
  } catch { return false; }
  anahtar = k; sonKullanim = Date.now(); haber();
  return true;
}
export function ozelKilitle() { anahtar = null; haber(); }
export const ozelSayisi = () => (destek() ? islem<number>("ozel", "readonly", s => s.count()) : Promise.resolve(0));
async function ozelCoz(x: OzelKayit, k: CryptoKey): Promise<Foy | null> {
  try { return JSON.parse(new TextDecoder().decode(await coz(k, x))) as Foy; } catch { return null; }
}

// ---------- Föyler ----------
export async function foyler(): Promise<Foy[]> {
  if (!destek()) return [];
  const xs = (await islem<Foy[]>("foyler", "readonly", s => s.getAll())) || [];
  const k = etkinAnahtar();
  if (k) {
    const oz = (await islem<OzelKayit[]>("ozel", "readonly", s => s.getAll())) || [];
    for (const x of oz) { const f = await ozelCoz(x, k); if (f) xs.push(f); }
  }
  return xs.sort((a, b) => b.guncelleme.localeCompare(a.guncelleme));
}
export async function foyGetir(id: string): Promise<Foy | undefined> {
  if (!destek()) return undefined;
  const f = await islem<Foy | undefined>("foyler", "readonly", s => s.get(id));
  if (f) return f;
  const k = etkinAnahtar();
  if (!k) return undefined;
  const x = await islem<OzelKayit | undefined>("ozel", "readonly", s => s.get(id));
  return x ? (await ozelCoz(x, k)) || undefined : undefined;
}
async function yaz(f: Foy) {
  if (f.ozel) {
    const k = etkinAnahtar();
    if (!k) throw new Error("Özel dosyalar kilitli. Kaydetmek için şifreyle açın.");
    const x = await sifrele(k, kodla(JSON.stringify(f)));
    await islem("ozel", "readwrite", s => { s.put({ id: f.id, ...x }); });
  } else await islem("foyler", "readwrite", s => { s.put(f); });
}
export async function foyKaydet(f: Foy, sessiz = false) {
  await yaz({ ...f, guncelleme: new Date().toISOString() });
  if (!sessiz) haber();
}
export async function foylerKaydet(xs: Foy[]) {
  const simdi = new Date().toISOString();
  const acik = xs.filter(f => !f.ozel), ozel = xs.filter(f => f.ozel);
  await islem("foyler", "readwrite", s => { for (const f of acik) s.put({ ...f, guncelleme: simdi }); });
  for (const f of ozel) await yaz({ ...f, guncelleme: simdi });
  haber();
}
export async function foySil(f: Foy) {
  await islem(f.ozel ? "ozel" : "foyler", "readwrite", s => { s.delete(f.id); });
  await islem("dosyalar", "readwrite", s => { for (const e of f.evraklar) s.delete(e.id); });
  haber();
}

/** Evrakın asıl dosyası (açmak ve indirmek için). Özel föyün dosyası şifreli yazılır. */
export async function dosyaYaz(id: string, b: Blob, ozel = false) {
  if (!ozel) return islem("dosyalar", "readwrite", s => { s.put(b, id); });
  const k = etkinAnahtar();
  if (!k) throw new Error("Özel dosyalar kilitli.");
  const x = await sifrele(k, new Uint8Array(await b.arrayBuffer()));
  return islem("dosyalar", "readwrite", s => { s.put({ sifreli: true, tip: b.type, ...x }, id); });
}
export async function dosyaOku(id: string): Promise<Blob | undefined> {
  const v = await islem<Blob | (Sifreli & { sifreli: true; tip: string }) | undefined>("dosyalar", "readonly", s => s.get(id));
  if (!v || v instanceof Blob) return v as Blob | undefined;
  const k = etkinAnahtar();
  if (!k) return undefined;
  return new Blob([await coz(k, v)], { type: v.tip || "" });
}
export const dosyaSil = (id: string) => islem("dosyalar", "readwrite", s => { s.delete(id); });

// ---------- Dosya zinciri ----------
/** Föyün öncekileri (en eskiden başlayarak) ve kendisinden doğan dosyalar. */
export function zincir(f: Foy, liste: Foy[]): { onceki: Foy[]; sonraki: Foy[] } {
  const byId = new Map(liste.map(x => [x.id, x] as const));
  const onceki: Foy[] = [];
  const gorulen = new Set([f.id]);
  let x = f.oncekiId ? byId.get(f.oncekiId) : undefined;
  while (x && !gorulen.has(x.id)) { onceki.unshift(x); gorulen.add(x.id); x = x.oncekiId ? byId.get(x.oncekiId) : undefined; }
  const sonraki: Foy[] = [];
  const topla = (id: string) => { for (const y of liste) if (y.oncekiId === id && !gorulen.has(y.id)) { gorulen.add(y.id); sonraki.push(y); topla(y.id); } };
  topla(f.id);
  return { onceki, sonraki };
}
/** "hedef"i "f"nin öncesi yapmak döngü kurar mı? */
export function donguMu(f: Foy, hedefId: string, liste: Foy[]) {
  if (hedefId === f.id) return true;
  return zincir(f, liste).sonraki.some(x => x.id === hedefId);
}

// ---------- Yedek ----------
/** Bütün föyler (evrak metinleri dahil, asıl dosyalar hariç) tek JSON metninde. Özel föyler şifreli hâliyle yazılır. */
const b64 = (b: ArrayBuffer | Uint8Array) => { const u = b instanceof Uint8Array ? b : new Uint8Array(b); let s = ""; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); };
const b64Coz = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export async function yedekMetni() {
  const acik = (await islem<Foy[]>("foyler", "readonly", s => s.getAll())) || [];
  const oz = (await islem<OzelKayit[]>("ozel", "readonly", s => s.getAll())) || [];
  const kilit = await ayarOku<KilitBilgi>("ozelKilit");
  return JSON.stringify({
    tur: "celse-foy-yedek", surum: 2, tarih: new Date().toISOString(), foyler: acik,
    ozel: oz.map(x => ({ id: x.id, iv: b64(x.iv), veri: b64(x.veri) })),
    kilit: kilit ? { tuz: b64(kilit.tuz), iv: b64(kilit.dogrulama.iv), veri: b64(kilit.dogrulama.veri) } : undefined
  });
}
export async function yedektenYukle(metin: string): Promise<number> {
  const j = JSON.parse(metin);
  if (!j || j.tur !== "celse-foy-yedek" || !Array.isArray(j.foyler)) throw new Error("Bu dosya Celse föy yedeği değil.");
  const xs = (j.foyler as Foy[]).filter(f => f && f.id);
  await islem("foyler", "readwrite", s => { for (const f of xs) s.put(f); });
  let n = xs.length;
  // Özel föyler yalnız aynı şifreyle açılabilir: bu cihazda şifre yoksa yedekteki kilit bilgisi de alınır.
  if (Array.isArray(j.ozel) && j.ozel.length && j.kilit) {
    const yerel = await ayarOku<KilitBilgi>("ozelKilit");
    const ayni = yerel && b64(yerel.tuz) === j.kilit.tuz;
    if (!yerel) await ayarYaz("ozelKilit", { tuz: b64Coz(j.kilit.tuz), dogrulama: { iv: b64Coz(j.kilit.iv), veri: b64Coz(j.kilit.veri).buffer } } as KilitBilgi);
    if (!yerel || ayni) {
      await islem("ozel", "readwrite", s => { for (const x of j.ozel) s.put({ id: x.id, iv: b64Coz(x.iv), veri: b64Coz(x.veri).buffer }); });
      n += j.ozel.length;
    }
  }
  haber();
  return n;
}

// ---------- Tarih yardımcıları ----------
/** "12.03.2027", "12/03/2027 10:30", "2027-03-12", Excel seri numarası (46000 gibi) → YYYY-AA-GG[THH:DD]; anlaşılmazsa undefined. */
export function tarihCoz(v: unknown): string | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  if (typeof v === "number" || /^\d{5}([.,]\d+)?$/.test(String(v).trim())) {
    const n = Number(String(v).trim().replace(",", "."));
    if (n > 20000 && n < 80000) {
      const d = new Date(Math.round((n - 25569) * 86400 * 1000));
      const g = d.toISOString().slice(0, 10);
      const kesir = n % 1;
      if (kesir > 0.0001) { const dk = Math.round(kesir * 1440); return `${g}T${String(Math.floor(dk / 60)).padStart(2, "0")}:${String(dk % 60).padStart(2, "0")}`; }
      return g;
    }
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?/);
  if (m) return iso(+m[1], +m[2], +m[3], m[4], m[5]);
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:\s+(?:saat\s*)?(\d{1,2})[:.](\d{2}))?/i);
  if (m) return iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1], m[4], m[5]);
  return undefined;
}
function iso(y: number, a: number, g: number, s?: string, d?: string) {
  if (a < 1 || a > 12 || g < 1 || g > 31 || y < 1990 || y > 2100) return undefined;
  const t = `${y}-${String(a).padStart(2, "0")}-${String(g).padStart(2, "0")}`;
  return s && d ? `${t}T${String(+s).padStart(2, "0")}:${d}` : t;
}
export function tarihYaz(x?: string) {
  if (!x) return "";
  const [g, s] = x.split("T");
  const [y, a, d] = g.split("-");
  return `${d}.${a}.${y}${s ? " " + s : ""}`;
}
/** Bugünden kaç gün sonra (geçmişse eksi). */
export function kacGun(x?: string) {
  if (!x) return undefined;
  const b = new Date(); b.setHours(0, 0, 0, 0);
  const d = new Date(x.slice(0, 10) + "T00:00:00");
  return Math.round((d.getTime() - b.getTime()) / 86400000);
}
