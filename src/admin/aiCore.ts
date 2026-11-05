// Yapay zekâ araçlarının saf yardımcıları (ağ ve cihaz bağımlılığı yok; komut satırında da sınanabilir).
import { normalizeCase, validateCase } from "../engine/engine";
import { hasFreeStep, lengthCues } from "../engine/lint";
import { simulateCase } from "../engine/simulate";
import { validateAppeals } from "../engine/appeal";
import { CaseFile } from "../engine/types";

export class AiError extends Error {}

/** Model yanıtındaki JSON'u çıkarır (kod bloğu ya da açıklama satırları olsa da). */
export function extractJson<T = any>(text: string): T {
  const t = text.replace(/```(?:json)?/g, "");
  const a = [t.indexOf("{"), t.indexOf("[")].filter(i => i >= 0);
  if (!a.length) throw new AiError("Yapay zekâ yanıtında JSON yok.");
  const start = Math.min(...a);
  const end = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  try { return JSON.parse(t.slice(start, end + 1)); }
  catch (e) { throw new AiError("Yapay zekâ yanıtı okunamadı (yarım kalmış olabilir): " + (e as Error).message); }
}

/* ---------- Alan yolları ve düzeltme işlemleri ---------- */

/** Dosyayı "yol = değer" satırlarına açar. Görünüş (look) ve renk alanları hukuki içerik olmadığı için atlanır. */
export function flatten(c: CaseFile): string {
  const out: string[] = [];
  const walk = (v: unknown, path: string) => {
    if (/(^|\.)look$|(^|\.)color$/.test(path)) return;
    if (Array.isArray(v)) {
      if (v.every(x => typeof x !== "object" || x === null)) { out.push(`${path} = ${JSON.stringify(v)}`); return; }
      v.forEach((x, i) => walk(x, path ? `${path}.${i}` : String(i)));
    } else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
    } else out.push(`${path} = ${JSON.stringify(v)}`);
  };
  walk(c, "");
  return out.join("\n");
}

export interface Op { islem?: "degistir" | "ekle" | "sil"; yol: string; deger?: unknown }

/** Düzeltme işlemlerini dosyanın bir kopyasına uygular. */
export function applyOps(c: CaseFile, ops: Op[]): CaseFile {
  const root: any = JSON.parse(JSON.stringify(c));
  for (const op of ops) {
    const parts = String(op.yol || "").split(".").filter(Boolean);
    if (!parts.length) throw new AiError("Boş yol");
    let obj = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (obj[k] === undefined || obj[k] === null) obj[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      obj = obj[k];
      if (typeof obj !== "object") throw new AiError(`Yol bulunamadı: ${op.yol}`);
    }
    const last = parts[parts.length - 1];
    const kind = op.islem || "degistir";
    if (Array.isArray(obj) && /^\d+$/.test(last)) {
      const i = Number(last);
      if (kind === "sil") obj.splice(i, 1);
      else if (kind === "ekle") obj.splice(Math.min(i, obj.length), 0, op.deger);
      else obj[i] = op.deger;
    } else if (kind === "sil") delete obj[last];
    else if (kind === "ekle" && Array.isArray(obj[last])) obj[last].push(op.deger);
    else obj[last] = op.deger;
  }
  return root as CaseFile;
}

/** Oyun motoruyla sınama: şema doğrulaması + bütün seçim yollarının oynatılması. */
export function engineCheck(c: CaseFile): string[] {
  let n: CaseFile;
  try { n = normalizeCase(c); } catch (e) { return ["Dosya okunamadı: " + (e as Error).message]; }
  const errs = validateCase(n);
  if (errs.length) return errs;
  try {
    const r = simulateCase(n, 20000);
    const out = [...r.problems];
    if (!r.truncated && r.unreachedSteps.length) out.push(`Hiçbir yolda ulaşılmayan adımlar: ${r.unreachedSteps.join(", ")}`);
    out.push(...lengthCues(n).problems);
    if (!hasFreeStep(n)) out.push("serbest cevap (yazılı / sesli, kind: free) adımı yok; en az bir adım free olmalı");
    // Kanun yolu aşamaları (elle yazılmış ve temel): şema denetimi.
    if (!n.appealOf) out.push(...validateAppeals(n, validateCase));
    return out;
  } catch (e) { return ["Oynatma hatası: " + (e as Error).message]; }
}

/* ---------- Denetim raporu ---------- */

export interface Issue {
  onem: "yuksek" | "orta" | "dusuk";
  tur: "hukuk" | "puan" | "tutarlilik" | "dil" | "yapi";
  yer: string;
  sorun: string;
  oneri: string;
  islemler: Op[];
  /** panelde: uygulandı mı */
  durum?: "bekliyor" | "uygulandi" | "reddedildi";
}
export interface AuditReport { davaId: string; baslik: string; tarih: string; ozet: string; sorunlar: Issue[]; motor: string[] }

/** Seçilen sorunların düzeltmelerini uygular ve motorla sınar. */
export function applyIssues(c: CaseFile, issues: Issue[]): { next: CaseFile; problems: string[] } {
  const next = normalizeCase(applyOps(c, issues.flatMap(i => i.islemler)));
  return { next, problems: engineCheck(next) };
}

