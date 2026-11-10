// Metinden (makale, blog, dilekçe, yapay zekâ cevabı) Yargıtay ve Danıştay karar künyelerini ayıklar: mahkeme, daire / kurul,
// esas ve karar numarası. Doğrulama bu künyelerle resmî serviste yapılır.
export interface KararKunyesi { mahkeme: "YARGITAYKARARI" | "DANISTAYKARAR"; birim: string; esas: string; karar: string; metin: string }

const NO = String.raw`((?:19|20)\d{2})\s*\/\s*(\d{1,6})`;
const ESAS = new RegExp(String.raw`(?:\bE(?:sas)?\s*(?:No)?\s*[.:]?\s*${NO})|(?:${NO}\s*(?:E\b\.?|Esas\b))`, "gi");
const KARAR = new RegExp(String.raw`(?:\bK(?:arar)?\s*(?:No)?\s*[.:]?\s*${NO})|(?:${NO}\s*(?:K\b\.?|Karar\b))`, "i");
const sade = (y: string, n: string) => `${y}/${Number(n)}`;

/** Künyenin önündeki metinden daire / kurul ve mahkeme. */
function birimBul(on: string): { mahkeme: KararKunyesi["mahkeme"]; birim: string } | null {
  const x = on.replace(/\s+/g, " ");
  const danistay = /Danıştay|\bD\.\s*\d|\bDan\.|İDDK|İDD?GK|VDDK|İdare Dava Daireleri|Vergi Dava Daireleri/i.test(x);
  const son = (re: RegExp) => { let m: RegExpExecArray | null = null, k: RegExpExecArray | null; const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"); while ((k = g.exec(x))) m = k; return m; };
  let m: RegExpExecArray | null;
  if ((m = son(/(?:İçtihadı Birleştirme Büyük Genel Kurulu|İBBGK|YİBK)/i))) return { mahkeme: "YARGITAYKARARI", birim: "Büyük Genel Kurulu" };
  if ((m = son(/(?:İçtihatları Birleştirme Kurulu|İBK)/i))) return danistay ? { mahkeme: "DANISTAYKARAR", birim: "İçtihatları Birleştirme Kurulu" } : { mahkeme: "YARGITAYKARARI", birim: "Büyük Genel Kurulu" };
  if ((m = son(/(?:Hukuk Genel Kurulu|\bHGK\b|\bH\.G\.K\.?)/i))) return { mahkeme: "YARGITAYKARARI", birim: "Hukuk Genel Kurulu" };
  if ((m = son(/(?:Ceza Genel Kurulu|\bCGK\b|\bC\.G\.K\.?)/i))) return { mahkeme: "YARGITAYKARARI", birim: "Ceza Genel Kurulu" };
  if ((m = son(/(?:İdari Dava Daireleri Kurulu|İdare Dava Daireleri Kurulu|İDDK|İDDGK)/i))) return { mahkeme: "DANISTAYKARAR", birim: "İdare Dava Daireleri Kurulu" };
  if ((m = son(/(?:Vergi Dava Daireleri Kurulu|VDDK)/i))) return { mahkeme: "DANISTAYKARAR", birim: "Vergi Dava Daireleri Kurulu" };
  if ((m = son(/(\d{1,2})\s*\.\s*(?:H\.?\s?D\b\.?|Hukuk\s+Daire(?:si)?)/i))) return { mahkeme: "YARGITAYKARARI", birim: `${Number(m[1])}. Hukuk Dairesi` };
  if ((m = son(/(\d{1,2})\s*\.\s*(?:C\.?\s?D\b\.?|Ceza\s+Daire(?:si)?)/i))) return { mahkeme: "YARGITAYKARARI", birim: `${Number(m[1])}. Ceza Dairesi` };
  if (danistay && (m = son(/(\d{1,2})\s*\.\s*D(?:aire(?:si)?\b|\b\.?)/i))) return { mahkeme: "DANISTAYKARAR", birim: `${Number(m[1])}. Daire` };
  return null;
}

/** Metindeki künyeler (aynı künye bir kez). Daire / kurul ya da karar numarası bulunamayan künyeler de döner (birim/karar boş). */
export function kunyeleriAyikla(metin: string): KararKunyesi[] {
  const out: KararKunyesi[] = [];
  const gor = new Set<string>();
  const x = metin || "";
  let m: RegExpExecArray | null;
  ESAS.lastIndex = 0;
  while ((m = ESAS.exec(x))) {
    const esas = m[1] ? sade(m[1], m[2]) : sade(m[3], m[4]);
    const on = x.slice(Math.max(0, m.index - 140), m.index);
    // Önde başka bir esas numarası varsa ondan sonrası (bir önceki künyenin dairesi karışmasın).
    const onKes = on.split(/(?:19|20)\d{2}\s*\/\s*\d{1,6}\s*(?:E\b\.?|Esas\b|K\b\.?|Karar\b)/i).pop() || on;
    const b = birimBul(onKes);
    const arka = x.slice(m.index + m[0].length, m.index + m[0].length + 60);
    const k = arka.match(KARAR);
    const karar = k ? (k[1] ? sade(k[1], k[2]) : sade(k[3], k[4])) : "";
    if (!b) continue;
    const anahtar = `${b.mahkeme}|${b.birim}|${esas}|${karar}`;
    if (gor.has(anahtar)) continue;
    gor.add(anahtar);
    const bas = Math.max(0, m.index - Math.min(80, on.length)), son = m.index + m[0].length + (k ? (k.index || 0) + k[0].length : 0);
    out.push({ ...b, esas, karar, metin: x.slice(bas, son).replace(/\s+/g, " ").trim() });
  }
  return out;
}

export const kunyeYaz = (k: Pick<KararKunyesi, "mahkeme" | "birim" | "esas" | "karar">) =>
  `${k.mahkeme === "DANISTAYKARAR" ? "Danıştay" : "Yargıtay"} ${k.birim}, E. ${k.esas}${k.karar ? ", K. " + k.karar : ""}`;
