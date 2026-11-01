// İçerik denetimi (oyun motorunun doğrulamasına ek): oyuncuya cevabı ele veren biçimsel ipuçları.
// En yaygını uzunluk: doğru seçenek ötekilerden belirgin biçimde uzunsa oyuncu hukuk bilmeden doğruyu bulur.
import { CaseFile } from "./types";

/** Doğru seçeneğin en uzun yanlış seçenekten en çok bu oranda uzun olmasına izin verilir. */
export const MAX_LONGER = 1.15;

export interface CueStat { steps: number; correctLongest: number; correctShortest: number }

/** Seçenekli adımlarda doğru seçeneği ele veren uzunluk farklarını bulur. */
export function lengthCues(c: CaseFile): { problems: string[]; stat: CueStat } {
  const problems: string[] = [];
  const stat: CueStat = { steps: 0, correctLongest: 0, correctShortest: 0 };
  c.steps.forEach((s, i) => {
    if ((s.kind || "choice") !== "choice" || s.choices.length < 2) return;
    const best = Math.max(...s.choices.map(ch => ch.delta));
    const good = s.choices.filter(ch => ch.delta === best);
    const bad = s.choices.filter(ch => ch.delta < best);
    if (!bad.length) return;
    const len = (t: string) => t.trim().length;
    const g = Math.max(...good.map(ch => len(ch.text)));
    const b = Math.max(...bad.map(ch => len(ch.text)));
    const all = s.choices.map(ch => len(ch.text));
    stat.steps++;
    if (g >= Math.max(...all)) stat.correctLongest++;
    if (Math.min(...good.map(ch => len(ch.text))) <= Math.min(...all)) stat.correctShortest++;
    if (g > b * MAX_LONGER) problems.push(`adım ${i + 1}: doğru seçenek (${g} harf) en uzun yanlış seçenekten (${b} harf) belirgin biçimde uzun; uzunluk cevabı ele veriyor`);
  });
  return { problems, stat };
}

/** Dosyada oyuncunun cevabı kendisinin yazdığı/söylediği (serbest) adım var mı? */
export const hasFreeStep = (c: CaseFile) => c.steps.some(s => s.kind === "free");
