// Dava takibi (föyler). Her dava bir föydür: künye (müvekkil, karşı taraf, mahkeme, esas no), duruşmalar, evrak, görevler ve
// yapay zekâ değerlendirmesi. Hepsi YALNIZ BU CİHAZDA (tarayıcının IndexedDB deposu) tutulur; sunucuya gitmez. Yapay zekâya
// yalnız cihazda kodlanmış metin gider (Evrakla duruşma provasıyla aynı yol) ve kaydedilmez.
// Kaybolmaya karşı "Yedeği indir" bütün föyleri tek dosyaya yazar; "Yedekten yükle" geri getirir.

export type FoyTaraf = "davaci" | "davali";
export interface Gorev { id: string; metin: string; tarih?: string; bitti: boolean; kaynak: "elle" | "yapay" | "aktarma" }
export interface FoyEvrak { id: string; ad: string; boyut: number; eklenme: string; metin: string; okunamadi?: string }
export interface FoyDegerlendirme { tarih: string; ozet: string; uyusmazlik: string[]; sureler: string[]; zayif: string[] }
export interface Foy {
  id: string; olusturma: string; guncelleme: string;
  muvekkil: string; karsiTaraf: string; mahkeme: string; esasNo: string; davaTuru: string; taraf: FoyTaraf;
  durum: "acik" | "kapali";
  /** Sonraki duruşma: YYYY-AA-GG (saat isteğe bağlı: YYYY-AA-GGTSS:DD). */
  durusma?: string;
  notlar: string; gorevler: Gorev[]; evraklar: FoyEvrak[]; degerlendirme?: FoyDegerlendirme;
}

export const yeniId = (on: string) => on + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
export function bosFoy(k: Partial<Foy> = {}): Foy {
  const simdi = new Date().toISOString();
  return { id: yeniId("foy"), olusturma: simdi, guncelleme: simdi, muvekkil: "", karsiTaraf: "", mahkeme: "", esasNo: "", davaTuru: "", taraf: "davaci", durum: "acik", notlar: "", gorevler: [], evraklar: [], ...k };
}
export const foyBaslik = (f: Foy) => [f.muvekkil || "Müvekkil yazılmamış", f.karsiTaraf].filter(Boolean).join(" – ");

// ---------- IndexedDB ----------
const DB = "celse-foy", SURUM = 1;
const destek = () => typeof indexedDB !== "undefined";
export const foyDestekli = destek;

function ac(): Promise<IDBDatabase> {
  return new Promise((ok, hata) => {
    const r = indexedDB.open(DB, SURUM);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains("foyler")) db.createObjectStore("foyler", { keyPath: "id" });
      if (!db.objectStoreNames.contains("dosyalar")) db.createObjectStore("dosyalar");
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => hata(r.error);
  });
}
function islem<T>(depo: "foyler" | "dosyalar", kip: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
  return ac().then(db => new Promise<T>((ok, hata) => {
    const tx = db.transaction(depo, kip);
    const r = f(tx.objectStore(depo));
    tx.oncomplete = () => { ok((r ? (r as IDBRequest).result : undefined) as T); db.close(); };
    tx.onerror = () => { hata(tx.error); db.close(); };
    tx.onabort = () => { hata(tx.error); db.close(); };
  }));
}

// Ekranlar değişiklikten haberdar olsun diye basit dinleyici.
const dinleyiciler = new Set<() => void>();
export function foyDinle(f: () => void) { dinleyiciler.add(f); return () => { dinleyiciler.delete(f); }; }
const haber = () => dinleyiciler.forEach(f => { try { f(); } catch { /* yok say */ } });

export async function foyler(): Promise<Foy[]> {
  if (!destek()) return [];
  const xs = (await islem<Foy[]>("foyler", "readonly", s => s.getAll())) || [];
  return xs.sort((a, b) => b.guncelleme.localeCompare(a.guncelleme));
}
export async function foyGetir(id: string): Promise<Foy | undefined> {
  if (!destek()) return undefined;
  return islem<Foy | undefined>("foyler", "readonly", s => s.get(id));
}
export async function foyKaydet(f: Foy, sessiz = false) {
  await islem("foyler", "readwrite", s => { s.put({ ...f, guncelleme: new Date().toISOString() }); });
  if (!sessiz) haber();
}
export async function foylerKaydet(xs: Foy[]) {
  const simdi = new Date().toISOString();
  await islem("foyler", "readwrite", s => { for (const f of xs) s.put({ ...f, guncelleme: simdi }); });
  haber();
}
export async function foySil(f: Foy) {
  await islem("foyler", "readwrite", s => { s.delete(f.id); });
  await islem("dosyalar", "readwrite", s => { for (const e of f.evraklar) s.delete(e.id); });
  haber();
}
/** Evrakın asıl dosyası (açmak ve indirmek için). */
export const dosyaYaz = (id: string, b: Blob) => islem("dosyalar", "readwrite", s => { s.put(b, id); });
export const dosyaOku = (id: string) => islem<Blob | undefined>("dosyalar", "readonly", s => s.get(id));
export const dosyaSil = (id: string) => islem("dosyalar", "readwrite", s => { s.delete(id); });

// ---------- Yedek ----------
/** Bütün föyler (evrak metinleri dahil, asıl dosyalar hariç) tek JSON metninde. */
export async function yedekMetni() {
  return JSON.stringify({ tur: "celse-foy-yedek", surum: 1, tarih: new Date().toISOString(), foyler: await foyler() });
}
export async function yedektenYukle(metin: string): Promise<number> {
  const j = JSON.parse(metin);
  if (!j || j.tur !== "celse-foy-yedek" || !Array.isArray(j.foyler)) throw new Error("Bu dosya Celse föy yedeği değil.");
  const xs = (j.foyler as Foy[]).filter(f => f && f.id);
  await islem("foyler", "readwrite", s => { for (const f of xs) s.put(f); });
  haber();
  return xs.length;
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
