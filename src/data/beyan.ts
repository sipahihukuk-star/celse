// Beyan editörü: föyden beyan / dilekçe taslağı. Başlık (merci, dosya no, taraflar, vekil, konu) cihazda föyden kurulur;
// gövdeyi yapay zekâ kodlanmış föyden yazar (beyanCagri.ts), avukat düzeltir. Taslaklar föyde saklanır (büroda eşitlenir).
// Çıktı avukatın seçtiği biçimde: UYAP UDF, Word (.docx) ya da PDF (yazdırma penceresinden).
// İçtihat, mevzuat ve doktrin kaynakları (HukukKaynak) beyana eklenir ve kütüphanede (bu cihazda) saklanır.
import { strToU8, zipSync } from "fflate";
import type { Foy } from "./foy";

export interface HukukKaynak {
  id: string;
  tur: "ictihat" | "mevzuat" | "doktrin";
  /** "Yargıtay 9. HD, 2023/1234 E., 2024/567 K., 12.03.2024" ya da "HMK m. 281" ya da "Yazar, Eser, s. 45" */
  kunye: string;
  /** kısa özet / ilgili ilke */
  ozet: string;
  /** kısa alıntı (birkaç cümle) */
  alinti?: string;
  url?: string;
  /** yz: yapay zekâ resmî sitelerde buldu; genel: yapay zekânın genel bilgisi (kaynak gösterilmedi); elle: avukat ekledi */
  kaynak: "yz" | "genel" | "elle";
  tarih: string;
}

export interface Beyan {
  id: string; olusturma: string; guncelleme: string;
  tur: string; konu: string;
  /** gövde (başlık ve imza hariç) */
  metin: string;
  /** beyana eklenen kaynaklar */
  kaynaklar?: HukukKaynak[];
  /** son verilen talimat */
  talimat?: string;
}

export const BEYAN_TURLERI = [
  "Beyan dilekçesi", "Bilirkişi raporuna itiraz", "Cevaba cevap (replik)", "İkinci cevap (düplik)", "Cevap dilekçesi", "Dava dilekçesi",
  "Delil listesi ve tanık bildirimi", "Ara karara karşı beyan", "Islah dilekçesi", "İstinaf dilekçesi", "İstinafa cevap", "Temyiz dilekçesi", "Temyize cevap",
  "Duruşmada sözlü beyan notu", "Esas hakkında mütalaaya karşı savunma", "Şikâyet / suç duyurusu", "İtiraz (CMK 268)", "İcra takibine itiraz / şikâyet",
  "İdari başvuru / itiraz", "Mazeret dilekçesi", "Serbest beyan"
];

/** Föy türüne göre tarafların sıfatı: [bizim taraf, karşı taraf]. */
export function tarafAdlari(f: Pick<Foy, "tur" | "taraf">): [string, string] {
  const biz = f.taraf !== "davali";
  switch (f.tur) {
    case "icra": return biz ? ["ALACAKLI", "BORÇLU"] : ["BORÇLU", "ALACAKLI"];
    case "sorusturma": return biz ? ["MÜŞTEKİ", "ŞÜPHELİ"] : ["ŞÜPHELİ", "MÜŞTEKİ"];
    case "ceza": case "ozel_ceza": return biz ? ["KATILAN", "SANIK"] : ["SANIK", "KATILAN"];
    case "idari_dava": return biz ? ["DAVACI", "DAVALI İDARE"] : ["DAVALI İDARE", "DAVACI"];
    case "idari_basvuru": case "kurum_basvuru": case "tazminat_komisyonu": case "bireysel_basvuru": return ["BAŞVURAN", "KARŞI TARAF"];
    default: return biz ? ["DAVACI", "DAVALI"] : ["DAVALI", "DAVACI"];
  }
}

const buyuk = (x: string) => x.toLocaleUpperCase("tr");
/** "İzmir 2. Asliye Hukuk Mahkemesi" → "İZMİR 2. ASLİYE HUKUK MAHKEMESİ'NE" (son ünlüye göre -NE / -NA). */
export function merciyeHitap(merci: string): string {
  const m = merci.trim();
  if (!m) return "… MAHKEMESİ'NE";
  if (/['’](NE|NA|YE|YA)$/i.test(m)) return buyuk(m);
  const unlu = (m.toLocaleLowerCase("tr").match(/[aeıioöuü]/g) || ["e"]).pop()!;
  return buyuk(m) + ("aıou".includes(unlu) ? "'NA" : "'NE");
}

export interface BaslikBilgi { vekil?: string; tarih?: string }

/** Beyanın başlığı (hitap, dosya no, taraflar, vekil, konu) ve imza bölümü; föyden. */
export function beyanCercevesi(f: Foy, b: Pick<Beyan, "konu">, k: BaslikBilgi = {}): { ust: string[]; alt: string[] } {
  const [biz, karsi] = tarafAdlari(f);
  const no = f.esasNo ? f.esasNo + (/^(hukuk|ceza|idari_dava|bilirkisi_gorev)$/.test(f.tur || "hukuk") && !/esas|e\.?$/i.test(f.esasNo) ? " Esas" : "") : "";
  const sat = (e: string, d: string) => `${(e + " ").padEnd(16, " ")}: ${d}`;
  const ust = [merciyeHitap(f.mahkeme), "", ...(no ? [sat("DOSYA NO", no)] : []),
    sat(biz, f.muvekkil || "…"), sat("VEKİLİ", k.vekil ? "Av. " + k.vekil.replace(/^Av\.?\s*/i, "") : "Av. …"), sat(karsi, f.karsiTaraf || "…"),
    ...(b.konu ? [sat("KONU", b.konu)] : []), ""];
  const tarih = k.tarih || new Date().toLocaleDateString("tr-TR");
  const alt = ["", "Saygılarımızla.", tarih, `${biz.charAt(0) + biz.slice(1).toLocaleLowerCase("tr")} Vekili`, k.vekil ? "Av. " + k.vekil.replace(/^Av\.?\s*/i, "") : "Av. …"];
  return { ust, alt };
}

/** Kaynakların beyana yazılacak atıf satırı. */
export const atif = (x: HukukKaynak) => x.kunye + (x.alinti ? `: "${x.alinti}"` : x.ozet ? ` (${x.ozet})` : "");

export function tamMetin(f: Foy, b: Beyan, k: BaslikBilgi = {}): string {
  const c = beyanCercevesi(f, b, k);
  return [...c.ust, b.metin.trim(), ...c.alt].join("\n");
}

// ── Çıktılar ──────────────────────────────────────────────────────────────────────────────────────────
const xml = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const BASLIK_SATIRI = /^[A-ZÇĞİÖŞÜ0-9 .,'’()/-]{4,}:?$/;

/** UYAP Doküman Editörü biçimi (UDF): zip içinde content.xml; metin tek CDATA, paragraflar ofsetle biçimlenir.
 *  Hitap satırı ortalı ve kalın, ana başlıklar (AÇIKLAMALAR, SONUÇ VE İSTEM…) kalın, gövde iki yana yaslı, imza sağda. */
export function udfOlustur(metin: string, imzaSatiri = 4): Uint8Array {
  const satirlar = metin.replace(/\r\n?/g, "\n").split("\n");
  let ofset = 0;
  const paragraflar = satirlar.map((s, i) => {
    const uzunluk = s.length + 1;
    const ilk = i === 0, imza = i >= satirlar.length - imzaSatiri, baslik = BASLIK_SATIRI.test(s.trim()) && s.trim().length < 60;
    const hiza = ilk ? 1 : imza ? 2 : baslik || /^\S.{0,15}\s*:/.test(s) ? 0 : 3;
    const p = `<paragraph Alignment="${hiza}" LeftIndent="0.0" RightIndent="0.0" SpaceAbove="0.0" SpaceBelow="0.0" LineSpacing="0.5"><content family="Times New Roman" size="12"${ilk || baslik ? ' bold="true"' : ""} startOffset="${ofset}" length="${uzunluk}" /></paragraph>`;
    ofset += uzunluk;
    return p;
  });
  const govde = satirlar.join("\n") + "\n";
  const icerik = `<?xml version="1.0" encoding="UTF-8" ?>
<template format_id="1.8">
<content><![CDATA[${govde.replace(/\]\]>/g, "]]]]><![CDATA[>")}]]></content>
<properties><pageFormat mediaSizeName="1" leftMargin="70.875" rightMargin="70.875" topMargin="56.7" bottomMargin="56.7" paperOrientation="1" headerFOffset="20.0" footerFOffset="20.0" /></properties>
<elements resolver="hvl-default">
${paragraflar.join("\n")}
</elements>
<styles><style name="default" description="Geçerli" family="Dialog" size="12" bold="false" italic="false" foreground="-13421773" FONT_ATTRIBUTE_KEY="javax.swing.plaf.FontUIResource[family=Dialog,name=Dialog,style=plain,size=12]" /><style name="hvl-default" family="Times New Roman" size="12" description="Gövde" /></styles>
</template>
`;
  return zipSync({ "content.xml": strToU8(icerik) }, { level: 6 });
}

/** Word (.docx): Times New Roman 12, hitap ortalı kalın, başlıklar kalın, gövde iki yana yaslı, imza sağda. */
export function docxOlustur(metin: string, imzaSatiri = 4): Uint8Array {
  const satirlar = metin.replace(/\r\n?/g, "\n").split("\n");
  const p = satirlar.map((s, i) => {
    const ilk = i === 0, imza = i >= satirlar.length - imzaSatiri, baslik = BASLIK_SATIRI.test(s.trim()) && s.trim().length < 60;
    const hiza = ilk ? "center" : imza ? "right" : baslik || /^\S.{0,15}\s*:/.test(s) ? "left" : "both";
    const r = s ? `<w:r><w:rPr>${ilk || baslik ? "<w:b/>" : ""}</w:rPr><w:t xml:space="preserve">${xml(s)}</w:t></w:r>` : "";
    return `<w:p><w:pPr><w:jc w:val="${hiza}"/><w:spacing w:after="0" w:line="360" w:lineRule="auto"/></w:pPr>${r}</w:p>`;
  }).join("");
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${p}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1418" w:bottom="1134" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const stil = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="tr-TR"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;
  return zipSync({
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`),
    "word/_rels/document.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "word/document.xml": strToU8(doc),
    "word/styles.xml": strToU8(stil)
  });
}

/** Yazdırma (PDF olarak kaydet) için sade HTML sayfası. */
export function beyanHtml(metin: string, baslik: string, imzaSatiri = 4): string {
  const satirlar = metin.replace(/\r\n?/g, "\n").split("\n");
  const p = satirlar.map((s, i) => {
    const ilk = i === 0, imza = i >= satirlar.length - imzaSatiri, b = BASLIK_SATIRI.test(s.trim()) && s.trim().length < 60;
    const hiza = ilk ? "center" : imza ? "right" : b || /^\S.{0,15}\s*:/.test(s) ? "left" : "justify";
    return `<p style="text-align:${hiza};${ilk || b ? "font-weight:bold;" : ""}white-space:pre-wrap;margin:0;min-height:1.5em">${xml(s)}</p>`;
  }).join("");
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${xml(baslik)}</title><style>@page{size:A4;margin:2cm 2.5cm}body{font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:1.5;color:#000;background:#fff}</style></head><body>${p}</body></html>`;
}

/** Dosya adı: "2024-1111 Bilirkişi raporuna itiraz 09.11.2026". */
export function beyanDosyaAdi(f: Foy, b: Beyan, uzanti: string): string {
  const ad = [f.esasNo.replace(/[\\/:*?"<>|]/g, "-"), b.tur, new Date(b.guncelleme).toLocaleDateString("tr-TR")].filter(Boolean).join(" ");
  return ad.replace(/\s+/g, " ").trim() + "." + uzanti;
}
