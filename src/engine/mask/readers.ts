// Evrak okuyucular: UYAP UDF (zip içinde content.xml), Word DOCX (zip içinde word/document.xml) ve düz metin.
// Dosya cihazdan çıkmadan, bellekte açılır. PDF ve fotoğraftan okuma (OCR) sonraki aşamadadır.
import { unzipSync, strFromU8 } from "fflate";

export type EvrakTuru = "udf" | "docx" | "txt";

const decodeXml = (s: string) => s
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&amp;/g, "&");

export function turBul(ad: string): EvrakTuru | null {
  const e = ad.toLowerCase().split(".").pop();
  return e === "udf" ? "udf" : e === "docx" ? "docx" : e === "txt" || e === "text" ? "txt" : null;
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

export function evrakMetni(ad: string, bytes: Uint8Array): string {
  const tur = turBul(ad);
  if (tur === "udf") return udfMetni(bytes);
  if (tur === "docx") return docxMetni(bytes);
  if (tur === "txt") return strFromU8(bytes).replace(/\r\n?/g, "\n").trim();
  throw new Error("Bu dosya türü henüz okunamıyor. UDF, Word (DOCX) ya da metin dosyası yükleyin.");
}
