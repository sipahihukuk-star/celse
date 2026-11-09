// DavaTek klasörü: avukat DavaTek'in evrak indirdiği klasörü bir kez seçer (Chrome ya da Edge, Windows ve Mac). Celse klasörü
// tarar; daha önce görmediği dosyaları okur ve esas/dosya numarasından (klasör adında ya da evrakın başında) ilgili föyü bulur.
// Eşleşen evrak föye eklenir; eşleşmeyenler avukata sorulur. Dosyalar bu bilgisayardan çıkmaz. Klasör izni tarayıcıda saklanır.
// Masaüstü köprüsü (masaustu/klasor, Windows kurulumu "CelseKlasorKurulum.exe"): kuruluysa klasör ondan okunur (127.0.0.1;
// tarayıcı izni gerekmez, her tarayıcıda çalışır, Windows açılınca kendiliğinden başlar). Köprü yalnız Celse sayfasına cevap verir.
import { ayarOku, ayarYaz, Foy } from "../data/foy";
import { turBul } from "../engine/mask/readers";
import { evrakMetniOku, Kaynak } from "./foyEvrak";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Tutamak = any;
const KLASOR = "davatekKlasor", GORULEN = "davatekGorulen";

export const klasorDestekli = () => typeof window !== "undefined" && typeof (window as any).showDirectoryPicker === "function";

export const KOPRU = "http://127.0.0.1:47613";
export const KURULUM_ADRESI = "./indir/CelseKlasorKurulum.exe";
export interface KopruDurumu { klasor: string; surum: string; dosya: number }
/** Masaüstü köprüsü çalışıyor mu (en çok 1,5 sn bekler). */
export async function kopruDurumu(): Promise<KopruDurumu | null> {
  if (typeof window === "undefined" || typeof fetch !== "function") return null;
  const ac = new AbortController();
  const z = setTimeout(() => ac.abort(), 1500);
  try {
    const r = await fetch(KOPRU + "/durum", { signal: ac.signal, cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.uygulama === "celse-klasor" ? { klasor: String(j.klasor || ""), surum: String(j.surum || ""), dosya: Number(j.dosya) || 0 } : null;
  } catch { return null; } finally { clearTimeout(z); }
}
export async function kopruKlasorDegistir(yol: string): Promise<string> {
  const r = await fetch(KOPRU + "/klasor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yol }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.hata || "Klasör değiştirilemedi.");
  return j.klasor;
}
export const kopruKlasorAc = () => fetch(KOPRU + "/ac", { method: "POST" }).catch(() => undefined);

export async function klasorBilgisi(): Promise<{ ad: string; izin: "granted" | "prompt" | "denied"; kopru?: boolean } | null> {
  const k = await kopruDurumu();
  if (k) return { ad: k.klasor, izin: "granted", kopru: true };
  const h = await ayarOku<Tutamak>(KLASOR).catch(() => undefined);
  if (!h) return null;
  let izin: "granted" | "prompt" | "denied" = "prompt";
  try { izin = await h.queryPermission({ mode: "read" }); } catch { /* eski tarayıcı */ }
  return { ad: h.name, izin };
}
/** Klasör seçtirir (kullanıcı tıklamasıyla çağrılmalı). */
export async function klasorSec(): Promise<string | null> {
  try {
    const h = await (window as any).showDirectoryPicker({ id: "celse-davatek", mode: "read" });
    await ayarYaz(KLASOR, h);
    return h.name;
  } catch { return null; }
}
export async function klasorBirak() { await ayarYaz(KLASOR, null); }

// Esas/dosya numarası: "2026/123", "2026-123", "2026_123 E." → "2026/123"
const NO = /(?<!\d)(19[89]\d|20\d\d)\s*[\/_\-. ]\s*(\d{1,6})(?!\d)/g;
const noSade = (s: string) => { const m = [...(s || "").matchAll(NO)][0]; return m ? `${m[1]}/${+m[2]}` : ""; };
const sade = (s: string) => (s || "").toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c").replace(/[^a-z0-9]/g, "");

export interface TaramaDosyasi { anahtar: string; kaynak: Kaynak; metin: string; okunamadi?: string; foyId?: string; neden?: string }

/** Yol ve metinden föy bulur: numara tek föyde varsa o; birden çoksa mahkeme adıyla ayırır. */
export function foyBul(yol: string, metin: string, liste: Foy[]): { foyId?: string; neden?: string } {
  const adaylar = (kaynak: string) => {
    const nolar = new Set([...kaynak.matchAll(NO)].map(m => `${m[1]}/${+m[2]}`));
    return liste.filter(f => f.esasNo && nolar.has(noSade(f.esasNo)));
  };
  const sec = (xs: Foy[], kaynak: string) => {
    if (xs.length === 1) return xs[0];
    const k = sade(kaynak);
    const ms = xs.filter(f => f.mahkeme && k.includes(sade(f.mahkeme).slice(0, 40)));
    return ms.length === 1 ? ms[0] : undefined;
  };
  let xs = adaylar(yol);
  let f = sec(xs, yol + " " + metin.slice(0, 3000));
  if (f) return { foyId: f.id, neden: "klasör adındaki numara" };
  xs = adaylar(metin.slice(0, 4000));
  f = sec(xs, metin.slice(0, 4000));
  if (f) return { foyId: f.id, neden: "evraktaki numara" };
  return { neden: xs.length > 1 ? "aynı numaralı birden çok föy var" : "numara bulunamadı" };
}

/** Klasörü tarar; yeni dosyaları okuyup föylerle eşleştirir. İzin gerekiyorsa ister (tıklamayla çağrılmalı). */
export async function klasorTara(liste: Foy[], ilerle: (m: string) => void, azami = 200): Promise<TaramaDosyasi[]> {
  const kopru = await kopruDurumu();
  const yeni: { anahtar: string; yol: string; dosya: File }[] = [];
  if (kopru) {
    const gorulen = new Set((await ayarOku<string[]>(GORULEN)) || []);
    ilerle("Celse Evrak klasörü taranıyor…");
    const r = await fetch(KOPRU + "/liste", { cache: "no-store" });
    if (!r.ok) throw new Error("Masaüstü köprüsü klasörü okuyamadı.");
    const j = await r.json() as { dosyalar: { yol: string; boyut: number; degisim: number }[] };
    for (const d of j.dosyalar || []) {
      if (yeni.length >= azami) break;
      const anahtar = `${d.yol}|${d.boyut}|${d.degisim}`;
      if (gorulen.has(anahtar)) continue;
      const g = await fetch(KOPRU + "/dosya?yol=" + encodeURIComponent(d.yol), { cache: "no-store" });
      if (!g.ok) continue;
      const blob = await g.blob();
      yeni.push({ anahtar, yol: d.yol, dosya: new File([blob], d.yol.split("/").pop() || d.yol, { lastModified: d.degisim }) });
    }
    return oku(yeni, liste, ilerle);
  }
  const h = await ayarOku<Tutamak>(KLASOR);
  if (!h) throw new Error("Önce DavaTek klasörünü seçin.");
  let izin = "prompt";
  try { izin = await h.queryPermission({ mode: "read" }); if (izin !== "granted") izin = await h.requestPermission({ mode: "read" }); } catch { /* yok say */ }
  if (izin !== "granted") throw new Error("Klasörü okuma izni verilmedi.");
  const gorulen = new Set((await ayarOku<string[]>(GORULEN)) || []);
  const gez = async (d: Tutamak, yol: string, derinlik: number) => {
    if (derinlik > 6 || yeni.length >= azami) return;
    for await (const g of d.values()) {
      if (yeni.length >= azami) break;
      const p = yol ? yol + "/" + g.name : g.name;
      if (g.kind === "directory") await gez(g, p, derinlik + 1);
      else if (turBul(g.name)) {
        const dosya: File = await g.getFile();
        const anahtar = `${p}|${dosya.size}|${dosya.lastModified}`;
        if (!gorulen.has(anahtar)) yeni.push({ anahtar, yol: p, dosya });
      }
    }
  };
  ilerle("Klasör taranıyor…");
  await gez(h, "", 0);
  return oku(yeni, liste, ilerle);
}

async function oku(yeni: { anahtar: string; yol: string; dosya: File }[], liste: Foy[], ilerle: (m: string) => void): Promise<TaramaDosyasi[]> {
  const out: TaramaDosyasi[] = [];
  let i = 0;
  for (const y of yeni) {
    i++;
    const kaynak: Kaynak = { ad: y.dosya.name, bytes: new Uint8Array(await y.dosya.arrayBuffer()), blob: y.dosya, yol: y.yol };
    const o = await evrakMetniOku(kaynak, m => ilerle(`(${i} / ${yeni.length}) ${y.dosya.name}: ${m}`));
    if ("hata" in o) { out.push({ anahtar: y.anahtar, kaynak, metin: "", okunamadi: o.hata, neden: "okunamadı" }); continue; }
    out.push({ anahtar: y.anahtar, kaynak, metin: o.metin, okunamadi: o.okunamadi, ...foyBul(y.yol, o.metin, liste) });
  }
  return out;
}
/** İşlenen (föye eklenen ya da atlanan) dosyalar bir daha sorulmaz. */
export async function gorulduYaz(anahtarlar: string[]) {
  const xs = new Set((await ayarOku<string[]>(GORULEN)) || []);
  for (const a of anahtarlar) xs.add(a);
  await ayarYaz(GORULEN, [...xs].slice(-20000));
}
