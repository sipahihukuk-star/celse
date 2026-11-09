// "Yapay zekâya sor" cevabının işlenmesi: başlıklar, önerilen işler, sesli okunacak metin.
import { tarihCoz } from "./foy";

export const BASLIK = /^(NEREDE KALDIK|SIRADA NE VAR|YASAL İMKÂNLAR|YASAL IMKANLAR|SÜRELER|DİKKAT|ÖNERİLEN İŞLER)\s*:/;

/** Cevaptaki "ÖNERİLEN İŞLER" satırları: "- iş (15.11.2026)". */
export function onerilenIsler(cevap: string): { metin: string; tarih?: string }[] {
  const satir = cevap.split("\n");
  const i = satir.findIndex(x => /^ÖNERİLEN İŞLER\s*:/.test(x.trim()));
  if (i < 0) return [];
  const out: { metin: string; tarih?: string }[] = [];
  for (const x of satir.slice(i + 1)) {
    const y = x.trim();
    if (!y) { if (out.length) break; continue; }
    if (BASLIK.test(y)) break;
    const m = y.match(/^[-–•]\s*(.+)$/);
    if (!m) continue;
    const d = m[1].match(/\((?:son gün:?\s*)?(\d{1,2}\.\d{1,2}\.\d{4})\)\s*$/i);
    out.push({ metin: m[1].replace(/\s*\((?:son gün:?\s*)?\d{1,2}\.\d{1,2}\.\d{4}\)\s*$/i, "").trim(), tarih: d ? tarihCoz(d[1]) : undefined });
  }
  return out.slice(0, 5);
}
/** Sesli okumada başlıklar cümleye çevrilir, tireler atılır. */
export const okunacak = (x: string) => x.split("\n").map(y => y.trim().replace(/^[-–•]\s*/, "")).filter(Boolean).map(y => (BASLIK.test(y) ? y.replace(/:\s*$/, ".").replace(/:\s*/, ". ") : y)).join(" ");

