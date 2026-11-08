// Cihazda şifreleme (şahsi dosyalar ve bulut eşitlemesi): AES-256-GCM, anahtar şifreden PBKDF2-SHA256 ile türetilir.
// Tarayıcıda tarayıcının kendi şifrelemesi (WebCrypto) kullanılır; telefonda (React Native'de WebCrypto yoktur) aynı
// algoritmalar saf JavaScript ile (@noble) çalışır. İki yol aynı çıktıyı verir: bilgisayarda şifrelenen telefonda açılır.
// IV (12 bayt) ve tuz yalnız benzersiz olmalıdır; güvenli rastgele üreteç yoksa (telefonda) zaman, sayaç ve rastgele
// değerlerin SHA-256 özetinden üretilir.
import { gcm } from "@noble/ciphers/aes.js";
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

export interface Sifreli { iv: Uint8Array; veri: ArrayBuffer }
/** Tarayıcıda CryptoKey, telefonda ham 32 bayt. */
export type Anahtar = CryptoKey | Uint8Array;

let zorlaSaf = false;
/** Yalnız testler için: tarayıcıda da saf JavaScript yolunu kullan. */
export function sifreTestSaf(v: boolean) { zorlaSaf = v; }
const webcrypto = () => (!zorlaSaf && typeof crypto !== "undefined" && !!crypto.subtle && typeof crypto.subtle.deriveKey === "function");

let sayac = 0;
const tohum = String(Math.random()) + String(Date.now());
export function rastgele(n: number): Uint8Array {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") return crypto.getRandomValues(new Uint8Array(n));
  const out = new Uint8Array(n);
  let i = 0;
  while (i < n) {
    sayac++;
    const t = typeof performance !== "undefined" ? performance.now() : 0;
    const h = sha256(kodla(tohum + "|" + Date.now() + "|" + t + "|" + sayac + "|" + Math.random()));
    for (let j = 0; j < h.length && i < n; j++) out[i++] = h[j];
  }
  return out;
}

export function kodla(s: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(s);
  // UTF-8 (Hermes'te TextEncoder yoksa).
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) { const d = s.charCodeAt(i + 1); if (d >= 0xdc00 && d < 0xe000) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; } }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return new Uint8Array(out);
}
export function metneCevir(b: ArrayBuffer | Uint8Array): string {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(u);
  // UTF-8 çözücü (Hermes'te TextDecoder yoksa).
  const parca: string[] = [];
  let kod: number[] = [];
  for (let i = 0; i < u.length;) {
    const a = u[i];
    let c: number;
    if (a < 0x80) { c = a; i += 1; }
    else if (a < 0xe0) { c = ((a & 31) << 6) | (u[i + 1] & 63); i += 2; }
    else if (a < 0xf0) { c = ((a & 15) << 12) | ((u[i + 1] & 63) << 6) | (u[i + 2] & 63); i += 3; }
    else { c = ((a & 7) << 18) | ((u[i + 1] & 63) << 12) | ((u[i + 2] & 63) << 6) | (u[i + 3] & 63); i += 4; }
    if (c >= 0x10000) { c -= 0x10000; kod.push(0xd800 + (c >> 10), 0xdc00 + (c & 1023)); } else kod.push(c);
    if (kod.length > 8000) { parca.push(String.fromCharCode(...kod)); kod = []; }
  }
  parca.push(String.fromCharCode(...kod));
  return parca.join("");
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export function b64(b: ArrayBuffer | Uint8Array): string {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  for (let i = 0; i < u.length; i += 3) {
    const n = (u[i] << 16) | ((u[i + 1] || 0) << 8) | (u[i + 2] || 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < u.length ? B64[(n >> 6) & 63] : "=") + (i + 2 < u.length ? B64[n & 63] : "=");
  }
  return s;
}
export function b64Coz(s: string): Uint8Array {
  const temiz = s.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((temiz.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < temiz.length; i += 4) {
    const n = (B64.indexOf(temiz[i]) << 18) | (B64.indexOf(temiz[i + 1]) << 12) | ((B64.indexOf(temiz[i + 2]) & 63) << 6) | (B64.indexOf(temiz[i + 3]) & 63);
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

export const YINELEME = 250000;

/** Şifreden anahtar. Tarayıcıda yalnız bu sayfada kullanılabilen (dışarı alınamaz) anahtar; telefonda ham bayt. */
export async function anahtarTuret(sifre: string, tuz: Uint8Array, yineleme = YINELEME): Promise<Anahtar> {
  if (webcrypto()) {
    const ham = await crypto.subtle.importKey("raw", kodla(sifre) as BufferSource, "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt: tuz as BufferSource, iterations: yineleme, hash: "SHA-256" }, ham, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  return pbkdf2Async(sha256, kodla(sifre), tuz, { c: yineleme, dkLen: 32, asyncTick: 20 });
}

/** Ham bayttan anahtar (cihazda saklanmış eşitleme anahtarı). */
export async function hamAnahtar(b: Uint8Array): Promise<Anahtar> {
  if (webcrypto()) return crypto.subtle.importKey("raw", b as BufferSource, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  return b;
}
/** Şifreden ham anahtar baytları (telefonda saklanabilsin diye; tarayıcıda da aynı baytlar çıkar). */
export async function hamTuret(sifre: string, tuz: Uint8Array, yineleme = YINELEME): Promise<Uint8Array> {
  if (webcrypto()) {
    const ham = await crypto.subtle.importKey("raw", kodla(sifre) as BufferSource, "PBKDF2", false, ["deriveBits"]);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: tuz as BufferSource, iterations: yineleme, hash: "SHA-256" }, ham, 256));
  }
  return pbkdf2Async(sha256, kodla(sifre), tuz, { c: yineleme, dkLen: 32, asyncTick: 20 });
}

const ab = (u: Uint8Array): ArrayBuffer => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

export async function sifrele(k: Anahtar, veri: Uint8Array): Promise<Sifreli> {
  const iv = rastgele(12);
  if (k instanceof Uint8Array) return { iv, veri: ab(gcm(k, iv).encrypt(veri)) };
  return { iv, veri: await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, k, veri as BufferSource) };
}
export async function coz(k: Anahtar, x: Sifreli): Promise<ArrayBuffer> {
  const iv = x.iv instanceof Uint8Array ? x.iv : new Uint8Array(x.iv as ArrayBuffer);
  if (k instanceof Uint8Array) return ab(gcm(k, iv).decrypt(new Uint8Array(x.veri)));
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, k, x.veri);
}
