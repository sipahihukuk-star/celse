// Evrak okuyucular: UYAP UDF (zip içinde content.xml), Word DOCX (zip içinde word/document.xml) ve düz metin.
// Dosya cihazdan çıkmadan, bellekte açılır. PDF, TIF ve fotoğraf web'de src/ui/evrakOku.ts ile (yazı tanıma dahil) okunur.
import { unzipSync, strFromU8 } from "fflate";
import * as CFB from "cfb";

export type EvrakTuru = "udf" | "docx" | "doc" | "txt" | "pdf" | "tif" | "resim" | "zip";

const decodeXml = (s: string) => s
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&amp;/g, "&");

export function turBul(ad: string): EvrakTuru | null {
  const e = ad.toLowerCase().split(".").pop();
  if (e === "udf") return "udf";
  if (e === "docx") return "docx";
  if (e === "doc") return "doc";
  if (e === "txt" || e === "text") return "txt";
  if (e === "pdf") return "pdf";
  if (e === "tif" || e === "tiff") return "tif";
  if (e === "jpg" || e === "jpeg" || e === "png") return "resim";
  if (e === "zip") return "zip";
  return null;
}

/** UDF: metnin tamamı content.xml içindeki <content><![CDATA[ … ]]></content> bölümündedir. */
export function udfMetni(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const name = Object.keys(files).find(f => /(^|\/)content\.xml$/i.test(f));
  if (!name) throw new Error("UDF dosyasında content.xml bulunamadı.");
  const xml = strFromU8(files[name]);
  const cdata = xml.match(/<content>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/content>/);
  if (cdata) return cdata[1].replace(/\r\n?/g, "\n").trim();
  const plain = xml.match(/<content>([\s\S]*?)<\/content>/);
  if (plain) return decodeXml(plain[1]).trim();
  throw new Error("UDF dosyasında metin bulunamadı.");
}

/** DOCX: paragraflar (<w:p>) satır, sekmeler boşluk olur. */
export function docxMetni(bytes: Uint8Array): string {
  const files = unzipSync(bytes, { filter: f => f.name === "word/document.xml" });
  const doc = files["word/document.xml"];
  if (!doc) throw new Error("Word dosyasında metin bulunamadı.");
  const xml = strFromU8(doc);
  const paras = xml.split(/<\/w:p>/).map(p => {
    const runs: string[] = [];
    p.replace(/<w:tab\/>|<w:br\/>|<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g, (m, txt) => { runs.push(m.startsWith("<w:tab") ? "\t" : m.startsWith("<w:br") ? "\n" : decodeXml(txt)); return m; });
    return runs.join("");
  });
  return paras.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Eski Word (.doc, Word 97-2003): bileşik dosyanın WordDocument akışındaki parça tablosundan (Clx/PlcPcd) metin okunur.
// Parça ya sıkıştırılmış (Windows-1252, bayt başına bir karakter) ya da UTF-16'dır; Türkçe harfler UTF-16 parçalarındadır.
const CP1252: Record<number, number> = { 0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x2c6, 0x89: 0x2030, 0x8a: 0x160, 0x8b: 0x2039, 0x8c: 0x152, 0x8e: 0x17d,
  0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x2dc, 0x99: 0x2122, 0x9a: 0x161, 0x9b: 0x203a, 0x9c: 0x153, 0x9e: 0x17e, 0x9f: 0x178 };
export function docMetni(bytes: Uint8Array): string {
  const cfb = CFB.read(bytes, { type: "array" });
  const akis = (ad: string) => { const e = CFB.find(cfb, ad); return e && e.content ? Uint8Array.from(e.content as ArrayLike<number>) : null; };
  const wd = akis("WordDocument");
  if (!wd || wd.length < 0x1aa) throw new Error("Word dosyası okunamadı. Dosyayı Word'de açıp .docx olarak kaydedin.");
  const dv = new DataView(wd.buffer, wd.byteOffset, wd.byteLength);
  if (dv.getUint16(0, true) !== 0xa5ec) throw new Error("Bu dosya Word 97-2003 biçiminde değil. .docx olarak kaydedip yükleyin.");
  const bayrak = dv.getUint16(0x0a, true);
  if (bayrak & 0x0100) throw new Error("Word dosyası parolalı. Parolayı kaldırıp yeniden yükleyin.");
  const tablo = akis(bayrak & 0x0200 ? "1Table" : "0Table");
  if (!tablo) throw new Error("Word dosyası okunamadı. Dosyayı .docx olarak kaydedin.");
  const ccpText = dv.getInt32(0x4c, true);
  const fcClx = dv.getUint32(0x1a2, true), lcbClx = dv.getUint32(0x1a6, true);
  const tv = new DataView(tablo.buffer, tablo.byteOffset, tablo.byteLength);
  let i = fcClx;
  const son = fcClx + lcbClx;
  while (i < son && tablo[i] === 0x01) i += 3 + tv.getInt16(i + 1, true); // Prc (biçim) kayıtları atlanır
  if (tablo[i] !== 0x02) throw new Error("Word dosyasının metin tablosu bulunamadı. .docx olarak kaydedin.");
  const lcb = tv.getUint32(i + 1, true);
  const plc = i + 5;
  const n = Math.floor((lcb - 4) / 12);
  let out = "";
  for (let k = 0; k < n; k++) {
    const cp0 = tv.getUint32(plc + k * 4, true), cp1 = tv.getUint32(plc + (k + 1) * 4, true);
    if (cp0 >= ccpText) break;
    const adet = Math.min(cp1, ccpText) - cp0;
    const fcRaw = tv.getUint32(plc + (n + 1) * 4 + k * 8 + 2, true);
    if (fcRaw & 0x40000000) {
      const bas = (fcRaw & 0x3fffffff) / 2;
      for (let j = 0; j < adet && bas + j < wd.length; j++) { const b = wd[bas + j]; out += String.fromCharCode(CP1252[b] || b); }
    } else {
      for (let j = 0; j < adet && fcRaw + j * 2 + 1 < wd.length; j++) out += String.fromCharCode(dv.getUint16(fcRaw + j * 2, true));
    }
  }
  // Alan kodları: 0x13 komut 0x14 sonuç 0x15 → yalnız sonuç kalır; hücre ve sayfa işaretleri satır olur.
  out = out.replace(/\u0013[^\u0013\u0014\u0015]*\u0014([^\u0013\u0015]*)\u0015/g, "$1").replace(/\u0013[^\u0015]*\u0015/g, "");
  return out.replace(/\r/g, "\n").replace(/[\u0007]/g, "\t").replace(/[\u000b\u000c]/g, "\n")
    .replace(/[\u0000-\u0008\u000e-\u001f]/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

/** ZIP (UYAP'tan toplu inen dosya gibi): içindeki evraklar ad ve baytlarıyla; klasörler ve sistem dosyaları atlanır. İç içe ZIP de açılır. */
export function zipIcerigi(bytes: Uint8Array, derinlik = 0): { ad: string; bytes: Uint8Array }[] {
  const files = unzipSync(bytes);
  const out: { ad: string; bytes: Uint8Array }[] = [];
  for (const yol of Object.keys(files).sort()) {
    const ad = yol.split("/").pop() || yol;
    if (!ad || yol.endsWith("/") || yol.startsWith("__MACOSX") || ad.startsWith(".")) continue;
    const tur = turBul(ad);
    if (tur === "zip") { if (derinlik < 2) out.push(...zipIcerigi(files[yol], derinlik + 1)); continue; }
    if (tur) out.push({ ad, bytes: files[yol] });
  }
  return out;
}

export function evrakMetni(ad: string, bytes: Uint8Array): string {
  const tur = turBul(ad);
  if (tur === "udf") return udfMetni(bytes);
  if (tur === "docx") return docxMetni(bytes);
  if (tur === "doc") return docMetni(bytes);
  if (tur === "txt") return strFromU8(bytes).replace(/\r\n?/g, "\n").trim();
  throw new Error("Bu dosya türü henüz okunamıyor. UDF, Word (DOCX) ya da metin dosyası yükleyin.");
}
