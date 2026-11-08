// Evrak okuyucuları: uydurma dosyalarla UDF çeşitleri, RTF, HTML olarak kaydedilmiş Word, Türkçe kod sayfalı metin, yanlış uzantı.
import { strToU8, zipSync } from "fflate";
import { evrakMetni, evrakTanisi, gercekTur } from "../src/engine/mask/readers";
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const dene = (ad: string, b: Uint8Array, bek: RegExp, m: string) => { try { const x = evrakMetni(ad, b); ok(bek.test(x), m + ": " + x.slice(0, 120)); } catch (e) { ok(false, m + " hata: " + (e as Error).message + " " + evrakTanisi(ad, b)); } };
const udf = (xml: string) => zipSync({ "content.xml": strToU8(xml) });
const METIN = "İZMİR 3. ASLİYE HUKUK MAHKEMESİ\nESAS NO: 2026/12\nDAVACI: UYDURMA ŞAHIS ĞÜÇ";
dene("a.udf", udf(`<?xml version="1.0" encoding="UTF-8"?><template format_id="1.8"><content><![CDATA[${METIN}]]></content><properties/></template>`), /ASLİYE[\s\S]*ĞÜÇ/, "UDF düz");
dene("b.udf", udf(`<template><content type="text" xml:space="preserve">\n<![CDATA[${METIN.slice(0, 20)}]]><![CDATA[${METIN.slice(20)}]]>\n</content></template>`), /ASLİYE HUKUK[\s\S]*2026\/12/, "UDF öznitelik + çok CDATA");
dene("c.udf", udf(`<template><content>İZMİR &amp; ESAS NO: 2026/12</content></template>`), /İZMİR & ESAS/, "UDF kaçışlı");
dene("d.odt", zipSync({ mimetype: strToU8("application/vnd.oasis.opendocument.text"), "content.xml": strToU8(`<office:document-content><office:body><office:text><text:p>DAVACI:<text:s/>UYDURMA</text:p><text:p>ESAS NO: 2026/12</text:p></office:text></office:body></office:document-content>`) }), /DAVACI: UYDURMA\nESAS/, "ODT");
const rtf = "{\\rtf1\\ansi\\ansicpg1254{\\fonttbl{\\f0 Times;}}{\\*\\generator X;}\\f0 \\'dd\\'dfZM\\'dd\\'d0 MAHKEMES\\'dd\\par DAVACI: \\u286?\\u220?\\u199? \\'fe\\par}";
dene("e.rtf", strToU8(rtf), /^İßZMİĞ MAHKEMESİ\nDAVACI: ĞÜÇ ş$/, "RTF Türkçe");
dene("f.doc", strToU8(rtf), /MAHKEMESİ/, "RTF .doc uzantılı");
dene("g.doc", strToU8(`<html><head><meta charset="utf-8"><style>p{}</style></head><body><p>ESAS NO: 2026/12</p><p>DAVALI: ÖRNEK</p></body></html>`), /ESAS NO: 2026\/12\s*\nDAVALI: ÖRNEK/, "HTML .doc uzantılı");
dene("h.txt", Uint8Array.from([0xdd, 0x5a, 0x4d, 0xdd, 0x52, 0x20, 0xf0, 0xfe, 0xfd]), /^İZMİR ğşı$/, "Windows-1254 metin");
const docx = zipSync({ "word/document.xml": strToU8(`<w:document><w:body><w:p><w:r><w:t>ESAS NO: 2026/12</w:t></w:r></w:p></w:body></w:document>`), "[Content_Types].xml": strToU8("<Types/>") });
dene("i.doc", docx, /2026\/12/, "DOCX .doc uzantılı");
dene("j.udf", docx, /2026\/12/, "DOCX .udf uzantılı");
ok(gercekTur("x", strToU8("%PDF-1.4")) === "pdf", "PDF imzası");
ok(/content\.xml/.test(evrakTanisi("k.udf", udf("<x/>"))), "tanı paket içini gösterir");
try { evrakMetni("k.udf", udf("<template><content></content></template>")); ok(false, "boş UDF hata vermeli"); } catch (e) { ok(/boş/.test((e as Error).message), "boş UDF nedeni"); }
if (fail) { console.log(`okuyucu-test: ${fail} hata`); process.exit(1); }
console.log("okuyucu-test: tamam");
