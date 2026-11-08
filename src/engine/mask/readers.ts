// Evrak okuyucular: UYAP UDF (zip içinde content.xml), Word DOCX (zip içinde word/document.xml) ve düz metin.
// Dosya cihazdan çıkmadan, bellekte açılır. PDF, TIF ve fotoğraf web'de src/ui/evrakOku.ts ile (yazı tanıma dahil) okunur.
import { unzipSync, strFromU8 } from "fflate";
import * as CFB from "cfb";

export type EvrakTuru = "udf" | "docx" | "doc" | "txt" | "pdf" | "tif" | "resim" | "zip" | "rtf" | "html";

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
  if (e === "rtf") return "rtf";
  if (e === "odt") return "udf";
  if (e === "htm" || e === "html") return "html";
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
  // <content> etiketinde öznitelik olabilir; metin bir ya da birkaç CDATA bölümünde ya da düz (kaçışlı) yazılmış olabilir.
  const govde = xml.match(/<content(?:\s[^>]*)?>([\s\S]*?)<\/content>/);
  if (govde) {
    const parcalar = [...govde[1].matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)].map(m => m[1]);
    const metin = (parcalar.length ? parcalar.join("") : decodeXml(govde[1].replace(/<[^>]+>/g, ""))).replace(/\r\n?/g, "\n").trim();
    if (metin) return metin;
  }
  // OpenDocument (LibreOffice .odt ya da UDF yerine kaydedilmiş): paragraflar text:p / text:h etiketlerindedir.
  if (/<office:(text|body)/.test(xml)) {
    const metin = xmlMetni(xml.replace(/<text:(s|tab)\b[^>]*\/>/g, " ").replace(/<text:line-break\s*\/>/g, "\n").replace(/<\/text:(p|h)>/g, "\n"));
    if (metin) return metin;
  }
  throw new Error("UDF dosyasında metin bulunamadı (boş ya da yalnız resim içeren UDF olabilir).");
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

const xmlMetni = (x: string) => decodeXml(x.replace(/<[^>]+>/g, "")).replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

/** Web sayfası olarak kaydedilmiş Word (.doc uzantılı HTML de olur). */
export function htmlMetni(bytes: Uint8Array): string {
  let x = strFromU8(bytes);
  const cs = x.slice(0, 3000).match(/charset=["']?([\w-]+)/i)?.[1]?.toLowerCase();
  if (cs && /1254|8859-9|latin5/.test(cs)) x = cp1254(bytes);
  return xmlMetni(x.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|h\d|li)>/gi, "\n").replace(/&nbsp;/g, " "));
}

// Windows-1254 (Türkçe) tek baytlık kod sayfası: 0x80-0xFF arası.
const CP1254 = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008d\u008e\u008f\u0090‘’“”•–—˜™š›œ\u009d\u009eŸ\u00a0¡¢£¤¥¦§¨©ª«¬\u00ad®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏĞÑÒÓÔÕÖ×ØÙÚÛÜİŞßàáâãäåæçèéêëìíîïğñòóôõö÷øùúûüışÿ";
const cp1254Kar = (b: number) => (b < 0x80 ? String.fromCharCode(b) : CP1254[b - 0x80]);
const cp1254 = (bytes: Uint8Array) => Array.from(bytes, cp1254Kar).join("");

/** RTF: denetim sözcükleri atılır; \'xx (Türkçe kod sayfası) ve \uN karakterleri çözülür. */
export function rtfMetni(bytes: Uint8Array): string {
  const r = cp1254(bytes);
  let out = "", i = 0, atla = 0;
  const yigin: number[] = [];
  let gizli = 0; // \*, fonttbl, colortbl, stylesheet, info, pict gibi gruplar
  while (i < r.length) {
    const c = r[i];
    if (c === "{") { yigin.push(gizli); i++; continue; }
    if (c === "}") { gizli = yigin.pop() ?? 0; i++; continue; }
    if (c === "\\") {
      const n = r[i + 1];
      if (n === "\\" || n === "{" || n === "}") { if (!gizli) out += n; i += 2; continue; }
      if (n === "'") { if (!gizli) { if (atla > 0) atla--; else out += cp1254Kar(parseInt(r.substr(i + 2, 2), 16)); } i += 4; continue; }
      if (n === "*") { gizli = 1; i += 2; continue; }
      const m = /^([a-z]+)(-?\d+)? ?/i.exec(r.slice(i + 1, i + 40));
      if (!m) { i += 2; continue; }
      const [tum, sozcuk, sayi] = m;
      i += 1 + tum.length;
      if (/^(fonttbl|colortbl|stylesheet|info|pict|object|header|footer|headerl|headerr|footerl|footerr|listtable|listoverridetable|rsidtbl|generator|xmlnstbl|themedata|colorschememapping|latentstyles|datastore)$/.test(sozcuk)) { gizli = 1; continue; }
      if (gizli) continue;
      if (sozcuk === "par" || sozcuk === "line" || sozcuk === "row") out += "\n";
      else if (sozcuk === "tab" || sozcuk === "cell") out += "\t";
      else if (sozcuk === "u" && sayi) { let k = +sayi; if (k < 0) k += 65536; out += String.fromCharCode(k); atla = 1; }
      continue;
    }
    if (c === "\r" || c === "\n") { i++; continue; }
    if (!gizli) { if (atla > 0) atla--; else out += c; }
    i++;
  }
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

const SIK = new Set(["ve", "ile", "bir", "bu", "için", "olarak", "olan", "da", "de", "ki", "mahkemesi", "dava", "davacı", "davalı", "tarih", "tarihli", "no", "karar",
  "tarafından", "ilgili", "sayılı", "gereği", "olduğu", "edilen", "hakkında", "esas", "vekili", "talep", "gibi", "kadar", "göre", "veya", "ise", "her", "olup", "edilmesine"]);
/** Çıkarılan yazının okunur Türkçe olup olmadığı (bozuk yazı tipi kodlamalı PDF'ler anlamsız karakter verir). Kişisel bilgi içermez. */
export function yaziKalitesi(metin: string): { harf: number; satir: number; enUzunSatir: number; turkce: number; sik: number; bozuk: boolean } {
  const harfler = metin.match(/\p{L}/gu) || [];
  const turkce = harfler.filter(c => /[a-zçğıöşüâîûA-ZÇĞİÖŞÜÂÎÛ]/.test(c)).length;
  const kelimeler = (metin.toLocaleLowerCase("tr").match(/\p{L}{2,}/gu) || []);
  const sik = kelimeler.filter(w => SIK.has(w)).length;
  const satirlar = metin.split("\n");
  const garip = (metin.match(/[\u0000-\u0008\u000e-\u001f\ue000-\uf8ff\ufffd]/g) || []).length;
  const turkceOran = harfler.length ? turkce / harfler.length : 0;
  const sikOran = kelimeler.length ? sik / kelimeler.length : 0;
  const bozuk = harfler.length > 30 && (turkceOran < 0.85 || garip > harfler.length * 0.05 || (kelimeler.length > 40 && sikOran < 0.015));
  return { harf: harfler.length, satir: satirlar.length, enUzunSatir: Math.max(0, ...satirlar.map(x => x.length)), turkce: Math.round(turkceOran * 100), sik: Math.round(sikOran * 1000) / 10, bozuk };
}

/** Dosyanın gerçek türü (uzantısı yanlış ya da eksik olsa da): içeriğin ilk baytlarına bakılır. */
export function gercekTur(ad: string, bytes: Uint8Array): EvrakTuru | null {
  const b = bytes;
  if (b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf";
  if (b.length >= 4 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return "doc";
  if (b.length >= 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a) || (b[0] === 0x4d && b[1] === 0x4d && b[3] === 0x2a))) return "tif";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "resim";
  if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "resim";
  if (b.length >= 5 && b[0] === 0x7b && b[1] === 0x5c && b[2] === 0x72 && b[3] === 0x74 && b[4] === 0x66) return "rtf";
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) {
    let icerik: string[] = [];
    try { unzipSync(b, { filter: f => { icerik.push(f.name); return false; } }); } catch { icerik = []; }
    if (icerik.some(n => /(^|\/)content\.xml$/i.test(n))) return "udf";
    if (icerik.includes("word/document.xml")) return "docx";
    return "zip";
  }
  const bas = cp1254(b.subarray(0, 600)).replace(/^\u00ef\u00bb\u00bf/, "").trimStart().toLowerCase();
  if (/^<(!doctype html|html|\?xml[^>]*>\s*<html)/.test(bas) || (/^mime-version/.test(bas) && /text\/html/.test(cp1254(b.subarray(0, 4000)).toLowerCase()))) return "html";
  const t = turBul(ad);
  if (t && t !== "doc" && t !== "udf" && t !== "docx") return t;
  // .doc/.udf/.docx uzantılı ama yukarıdaki imzalardan hiçbiri değil: düz metin olabilir.
  // Uzantısız: çoğunlukla okunabilir karakterse düz metin.
  const ornek = b.subarray(0, 2000);
  let duz = 0;
  for (const x of ornek) if (x === 9 || x === 10 || x === 13 || x >= 32) duz++;
  return ornek.length && duz / ornek.length > 0.95 ? "txt" : null;
}

/** Okunamayan evrak için kişisel bilgi içermeyen teknik tanı (tür, boyut, ilk baytlar, paket içindeki dosya adları). */
export function evrakTanisi(ad: string, bytes: Uint8Array): string {
  const uz = (ad.split(".").pop() || "").toLowerCase();
  const gt = gercekTur(ad, bytes);
  const ilk = Array.from(bytes.subarray(0, 8)).map(x => x.toString(16).padStart(2, "0")).join(" ");
  let paket = "";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const adlar: string[] = [];
    try { unzipSync(bytes, { filter: f => { adlar.push(f.name.split("/").slice(-2).join("/")); return false; } }); } catch (e) { adlar.push("açılamadı: " + String((e as Error).message || e)); }
    paket = " · paket içi: " + adlar.slice(0, 12).join(", ") + (adlar.length > 12 ? " …" : "");
  }
  return `uzantı .${uz || "-"} · içerik türü ${gt || "tanınmadı"} · ${bytes.length} bayt · ilk baytlar ${ilk}${paket}`;
}

/** Düz metin: UTF-8 değilse Türkçe Windows kod sayfası (eski Not Defteri dosyaları). */
function duzMetin(bytes: Uint8Array): string {
  let x = strFromU8(bytes);
  if (x.includes("\ufffd")) x = cp1254(bytes);
  return x.replace(/^\ufeff/, "").replace(/\r\n?/g, "\n").trim();
}

export function evrakMetni(ad: string, bytes: Uint8Array): string {
  const tur = gercekTur(ad, bytes);
  if (tur === "udf") return udfMetni(bytes);
  if (tur === "docx") return docxMetni(bytes);
  if (tur === "doc") return docMetni(bytes);
  if (tur === "txt") return duzMetin(bytes);
  if (tur === "rtf") return rtfMetni(bytes);
  if (tur === "html") return htmlMetni(bytes);
  throw new Error("Bu dosya türü henüz okunamıyor. UDF, Word (DOCX) ya da metin dosyası yükleyin.");
}
