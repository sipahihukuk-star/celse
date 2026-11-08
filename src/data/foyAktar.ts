// Toplu föy oluşturma: Excel (.xlsx), CSV ya da Word (.docx) tablosundan. İlk satır başlıktır; başlık adları serbesttir
// ("Müvekkil", "Karşı taraf", "Mahkeme", "Esas no", "Dava türü", "Sıfatımız", "Duruşma tarihi", "Not", "Yapılacak"...).
// Dosya cihazda okunur; hiçbir yere gönderilmez.
import { unzipSync, strFromU8 } from "fflate";
import { bosFoy, Foy, FoyTaraf, tarihCoz, yeniId } from "./foy";

const xmlCoz = (s: string) => s
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&amp;/g, "&");
const metinler = (xml: string) => [...xml.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)].map(m => xmlCoz(m[1])).join("");

/** Excel'in ilk sayfası satır satır (hücreler metin ya da sayı). */
export function xlsxTablo(bytes: Uint8Array): (string | number)[][] {
  const z = unzipSync(bytes);
  const oku = (ad: string) => (z[ad] ? strFromU8(z[ad]) : "");
  const paylasilan = [...oku("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => metinler(m[1]));
  // İlk sayfanın dosyası: workbook.xml'deki ilk <sheet r:id> → workbook.xml.rels'teki hedef.
  const wb = oku("xl/workbook.xml"), rels = oku("xl/_rels/workbook.xml.rels");
  const rid = (wb.match(/<sheet\b[^>]*\br:id="([^"]+)"/) || [])[1];
  const hedef = rid ? (rels.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`)) || rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`)) || [])[1] : undefined;
  const yol = hedef ? (hedef.startsWith("/") ? hedef.slice(1) : "xl/" + hedef.replace(/^\.\//, "")) : Object.keys(z).find(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k));
  const sayfa = yol ? oku(yol) : "";
  if (!sayfa) throw new Error("Excel dosyasında sayfa bulunamadı.");
  const sutun = (ref: string) => { let n = 0; for (const ch of ref.replace(/\d+/g, "")) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  const out: (string | number)[][] = [];
  for (const r of sayfa.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const satir: (string | number)[] = [];
    for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const at = c[1], ic = c[2] || "";
      const ref = (at.match(/\br="([A-Z]+)\d+"/) || [])[1];
      const tur = (at.match(/\bt="(\w+)"/) || [])[1];
      const v = (ic.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let deger: string | number = "";
      if (tur === "s") deger = paylasilan[Number(v)] ?? "";
      else if (tur === "inlineStr") deger = metinler(ic);
      else if (tur === "str" || tur === "e") deger = v ? xmlCoz(v) : "";
      else if (tur === "b") deger = v === "1" ? "DOĞRU" : "YANLIŞ";
      else if (v !== undefined) deger = isNaN(Number(v)) ? xmlCoz(v) : Number(v);
      const i = ref ? sutun(ref) : satir.length;
      while (satir.length < i) satir.push("");
      satir[i] = deger;
    }
    out.push(satir);
  }
  return out;
}

/** Word belgesindeki en büyük tablo. */
export function docxTablo(bytes: Uint8Array): string[][] {
  const z = unzipSync(bytes, { filter: f => f.name === "word/document.xml" });
  const xml = z["word/document.xml"] ? strFromU8(z["word/document.xml"]) : "";
  const tablolar = [...xml.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)].map(t =>
    [...t[1].matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)].map(r =>
      [...r[1].matchAll(/<w:tc>([\s\S]*?)<\/w:tc>/g)].map(c => c[1].split(/<\/w:p>/).map(metinler).filter(Boolean).join(" ").trim())));
  if (!tablolar.length) throw new Error("Word belgesinde tablo bulunamadı. Föyleri bir tabloya, ilk satırı başlık olacak şekilde yazın.");
  return tablolar.sort((a, b) => b.length - a.length)[0];
}

/** CSV (noktalı virgül, virgül ya da sekmeyle ayrılmış; tırnaklı hücreler desteklenir). */
export function csvTablo(metin: string): string[][] {
  const ilk = metin.split(/\r?\n/)[0] || "";
  const ayrac = [";", "\t", ","].sort((a, b) => ilk.split(b).length - ilk.split(a).length)[0];
  const out: string[][] = []; let satir: string[] = [], hucre = "", tirnak = false;
  for (let i = 0; i < metin.length; i++) {
    const ch = metin[i];
    if (tirnak) { if (ch === "\"") { if (metin[i + 1] === "\"") { hucre += "\""; i++; } else tirnak = false; } else hucre += ch; continue; }
    if (ch === "\"") tirnak = true;
    else if (ch === ayrac) { satir.push(hucre); hucre = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && metin[i + 1] === "\n") i++; satir.push(hucre); out.push(satir); satir = []; hucre = ""; }
    else hucre += ch;
  }
  if (hucre || satir.length) { satir.push(hucre); out.push(satir); }
  return out;
}

export function tabloOku(ad: string, bytes: Uint8Array): (string | number)[][] {
  const uz = ad.toLowerCase().split(".").pop();
  if (uz === "xlsx" || uz === "xlsm") return xlsxTablo(bytes);
  if (uz === "docx") return docxTablo(bytes);
  if (uz === "csv" || uz === "txt") return csvTablo(new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, ""));
  if (uz === "xls" || uz === "doc") throw new Error("Eski Excel/Word biçimi (.xls, .doc) okunamıyor. Dosyayı .xlsx ya da .docx olarak kaydedip yükleyin.");
  throw new Error("Excel (.xlsx), CSV ya da Word (.docx) dosyası yükleyin.");
}

// ---------- Başlık eşleme ----------
type Alan = "muvekkil" | "karsiTaraf" | "davaci" | "davali" | "mahkeme" | "esasNo" | "davaTuru" | "taraf" | "durusma" | "notlar" | "gorev" | "durum";
const ESLER: [Alan, RegExp][] = [
  ["muvekkil", /^(muvekkil|muvekkilimiz|musteri|client|vekaletveren)/],
  ["karsiTaraf", /^(karsitaraf|karsi|hasim|rakip)/],
  ["davaci", /^(davaci|alacakli|musteki|basvuran|katilan)/],
  ["davali", /^(davali|borclu|sanik|supheli|aleyhine)/],
  ["mahkeme", /^(mahkeme|birim|daire|icradairesi|merci)/],
  ["esasNo", /^(esas|dosyano|dosyanumarasi|esasno|dosya$|takipno|sorusturmano)/],
  ["davaTuru", /^(davaturu|davakonusu|konu|tur|davacinsi|nitelik)/],
  ["taraf", /^(taraf|sifat|sifatimiz|vekilliksifati|temsil)/],
  ["durusma", /^(durusma|sonrakidurusma|durusmatarihi|tarih|celse)/],
  ["notlar", /^(not|notlar|aciklama|aciklamalar|durumnotu)/],
  ["gorev", /^(gorev|yapilacak|yapilacaklar|is|isler|todo)/],
  ["durum", /^(durum|dosyadurumu|acikkapali)/]
];
const sade = (s: unknown) => String(s ?? "").toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c").replace(/[^a-z0-9]/g, "");

export interface AktarimSonucu { foyler: Foy[]; eslesen: Partial<Record<Alan, string>>; eslesmeyen: string[]; atlanan: number }

export function tablodanFoyler(tablo: (string | number)[][]): AktarimSonucu {
  const satirlar = tablo.filter(r => r.some(x => String(x ?? "").trim()));
  if (satirlar.length < 2) throw new Error("Tabloda başlık satırı ve en az bir föy satırı olmalı.");
  // Başlık: ilk dolu satırlardan en çok eşleşeni (üstte başlık dışı bir yazı olabilir).
  let bas = 0, enIyi = -1;
  for (let i = 0; i < Math.min(5, satirlar.length - 1); i++) {
    const n = satirlar[i].filter(h => ESLER.some(([, re]) => re.test(sade(h)))).length;
    if (n > enIyi) { enIyi = n; bas = i; }
  }
  if (enIyi < 1) throw new Error("Başlık satırı tanınamadı. İlk satıra “Müvekkil, Karşı taraf, Mahkeme, Esas no, Duruşma tarihi” gibi başlıklar yazın (örnek şablonu indirebilirsiniz).");
  const basliklar = satirlar[bas].map(h => String(h ?? "").trim());
  const sutun: Partial<Record<Alan, number>> = {}, eslesen: Partial<Record<Alan, string>> = {}, eslesmeyen: string[] = [];
  basliklar.forEach((h, i) => {
    if (!h) return;
    const al = ESLER.find(([a, re]) => sutun[a] === undefined && re.test(sade(h)));
    if (al) { sutun[al[0]] = i; eslesen[al[0]] = h; } else eslesmeyen.push(h);
  });
  const al = (r: (string | number)[], a: Alan) => (sutun[a] === undefined ? "" : r[sutun[a]!] ?? "");
  const yazi = (r: (string | number)[], a: Alan) => String(al(r, a)).replace(/\s+/g, " ").trim();
  const foyler: Foy[] = []; let atlanan = 0;
  for (const r of satirlar.slice(bas + 1)) {
    let muvekkil = yazi(r, "muvekkil"), karsi = yazi(r, "karsiTaraf");
    const davaci = yazi(r, "davaci"), davali = yazi(r, "davali"), sifat = sade(yazi(r, "taraf"));
    let taraf: FoyTaraf = /davali|sanik|supheli|borclu|karsi|aleyh/.test(sifat) ? "davali" : "davaci";
    if (davaci || davali) {
      if (muvekkil && davali && sade(davali).includes(sade(muvekkil).slice(0, 12))) taraf = "davali";
      else if (muvekkil && davaci && sade(davaci).includes(sade(muvekkil).slice(0, 12))) taraf = "davaci";
      if (!muvekkil) muvekkil = taraf === "davali" ? davali : davaci;
      if (!karsi) karsi = taraf === "davali" ? davaci : davali;
    }
    const esasNo = yazi(r, "esasNo"), mahkeme = yazi(r, "mahkeme");
    if (!muvekkil && !karsi && !esasNo && !mahkeme) { atlanan++; continue; }
    const gorev = yazi(r, "gorev");
    foyler.push(bosFoy({
      muvekkil, karsiTaraf: karsi, mahkeme, esasNo, davaTuru: yazi(r, "davaTuru"), taraf,
      durusma: tarihCoz(al(r, "durusma")), notlar: yazi(r, "notlar"),
      durum: /kapali|kapandi|bitti|kesinles|arsiv/.test(sade(yazi(r, "durum"))) ? "kapali" : "acik",
      gorevler: gorev ? [{ id: yeniId("g"), metin: gorev, bitti: false, kaynak: "aktarma" }] : []
    }));
  }
  return { foyler, eslesen, eslesmeyen, atlanan };
}

/** Aynı mahkeme ve esas numaralı föy varsa yenisi onunla birleştirilir (tekrar yükleme çift föy yaratmasın). */
export function birlestir(varolan: Foy[], gelen: Foy[]): { yeni: Foy[]; guncellenen: Foy[] } {
  const anahtar = (f: Foy) => (f.esasNo ? sade(f.mahkeme) + "|" + sade(f.esasNo) : "");
  const harita = new Map(varolan.filter(anahtar).map(f => [anahtar(f), f] as const));
  const yeni: Foy[] = [], guncellenen: Foy[] = [];
  for (const g of gelen) {
    const v = anahtar(g) ? harita.get(anahtar(g)) : undefined;
    if (!v) { yeni.push(g); continue; }
    guncellenen.push({
      ...v, muvekkil: g.muvekkil || v.muvekkil, karsiTaraf: g.karsiTaraf || v.karsiTaraf, davaTuru: g.davaTuru || v.davaTuru,
      durusma: g.durusma || v.durusma, notlar: g.notlar && !v.notlar.includes(g.notlar) ? (v.notlar ? v.notlar + "\n" : "") + g.notlar : v.notlar,
      gorevler: [...v.gorevler, ...g.gorevler.filter(x => !v.gorevler.some(y => y.metin === x.metin))], durum: g.durum
    });
  }
  return { yeni, guncellenen };
}
