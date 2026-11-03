// Dosya çevirisi (yönetim paneli): dosyadaki yalnızca metin alanları toplanır, parça parça yapay zekâya çevirtilir ve aynı
// yerlerine yazılır. Yapı (adımlar, seçenekler, bayraklar, puanlar) hiç değişmez; bu yüzden farklı dillerdeki iki oyuncu
// internet üzerinden aynı dosyayı oynayabilir. Çeviriler sunucuda "ceviriler" tablosunda saklanır, herkes okuyabilir.
import { supabase } from "../data/account";
import { CaseFile } from "../engine/types";
import { askAdmin, extractJson } from "./ai";
import { AiError, applyOps } from "./aiCore";

export const LANG_NAMES: Record<string, string> = { en: "English", es: "Spanish", fr: "French", de: "German" };

/** Çevrilecek alanlar (anahtar adına göre). Kimlik, konuşmacı, koşul, bayrak ve sayı alanları çevrilmez. */
const TEXT_KEYS = new Set(["title", "area", "court", "courtShort", "esas", "teaser", "text", "t", "d", "desc", "prompt", "note", "hukum", "summary", "label", "role", "short", "name", "rubric", "model", "law", "stamp", "inscription"]);

export function textLeaves(c: CaseFile): [string, string][] {
  const out: [string, string][] = [];
  const walk = (v: unknown, path: string, key: string) => {
    if (typeof v === "string") { if ((TEXT_KEYS.has(key) || key === "terms") && v.trim()) out.push([path, v]); return; }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${path}.${i}`, key)); return; }
    if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        if (k === "look" || k === "id" || k === "who" || k === "if" || k === "set" || k === "correct") continue;
        walk(x, path ? `${path}.${k}` : k, k);
      }
    }
  };
  walk(c, "", "");
  return out;
}

const SYSTEM = (lang: string) => [
  "You are a professional legal translator specialised in Turkish law, Turkish court procedure, international and sports arbitration. The texts are dialogue, questions, answer options, notes and documents of a courtroom training game set in Turkish (or international) courts.",
  "Translate each Turkish string in the given JSON array into " + LANG_NAMES[lang] + ".",
  "Rules: keep the same number of items and the same order; keep numbers, dates, amounts, case numbers, article references and personal names accurate; render Turkish courts and statutes naturally for a foreign reader while keeping the abbreviation once where useful (e.g. 'TBK m.147' -> 'Turkish Code of Obligations (TBK) art. 147', 'İzmir 3. Asliye Hukuk Mahkemesi' -> the target-language equivalent of 'İzmir 3rd Civil Court of First Instance'); keep the register of a hearing (formal, concise); keep short labels short; keep {placeholders} and line breaks unchanged; do not add explanations.",
  "Answer ONLY with a JSON array of translated strings."
].join("\n");

export async function translateCase(c: CaseFile, lang: string, onProgress?: (done: number, total: number) => void, model: "derin" | "hizli" = "derin"): Promise<CaseFile> {
  const leaves = textLeaves(c);
  const chunks: [string, string][][] = [];
  let cur: [string, string][] = [], size = 0;
  for (const l of leaves) {
    if (size + l[1].length > 4000 && cur.length) { chunks.push(cur); cur = []; size = 0; }
    cur.push(l); size += l[1].length;
  }
  if (cur.length) chunks.push(cur);
  const ops: { yol: string; deger: string }[] = [];
  let done = 0;
  // Parçalar ikişer ikişer aynı anda çevrilir.
  for (let i = 0; i < chunks.length; i += 2) {
    const part = await Promise.all(chunks.slice(i, i + 2).map(async ch => {
      const { text } = await askAdmin(SYSTEM(lang), JSON.stringify(ch.map(x => x[1])), { model, azami: 12000 });
      const arr = extractJson<string[]>(text);
      if (!Array.isArray(arr) || arr.length !== ch.length) throw new AiError("Çeviri eksik geldi; tekrar deneyin.");
      return ch.map((x, k) => ({ yol: x[0], deger: String(arr[k]) }));
    }));
    part.forEach(p => ops.push(...p));
    done += part.reduce((n, p) => n + p.length, 0);
    onProgress?.(done, leaves.length);
  }
  return applyOps(c, ops);
}

/** Sunucudaki çeviriler: { "<dil>/<dava_id>": true } */
export async function listTranslations(): Promise<Set<string>> {
  const sb = supabase();
  if (!sb) return new Set();
  const { data } = await sb.from("ceviriler").select("dava_id, dil");
  return new Set((data || []).map((r: any) => `${r.dil}/${r.dava_id}`));
}

export async function saveTranslation(id: string, lang: string, c: CaseFile) {
  const sb = supabase();
  if (!sb) throw new AiError("Sunucuya ulaşılamıyor.");
  const { error } = await sb.from("ceviriler").upsert({ dava_id: id, dil: lang, veri: c, guncelleme: new Date().toISOString() });
  if (error) throw new AiError(error.message);
}
