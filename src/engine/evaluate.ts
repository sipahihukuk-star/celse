// Serbest cevap değerlendirmesi. Sunucu varsa yapay zekâ (Supabase Edge Function → Claude) puanlar;
// yoksa ya da cevap gelmezse adımdaki anahtar kavramlarla çevrimdışı puanlanır.
import { CaseFile, KeywordGroup, Step } from "./types";

export interface Evaluation { score: number; feedback: string; by: "ai" | "kavram" }

/** Türkçe büyük/küçük harf ve şapka farklarını yok sayar. */
export function norm(s: string): string {
  return s.toLocaleLowerCase("tr").replace(/[âà]/g, "a").replace(/[îì]/g, "i").replace(/[ûù]/g, "u").replace(/\s+/g, " ").trim();
}

export function keywordScore(answer: string, groups: KeywordGroup[] = []): Evaluation {
  const a = norm(answer);
  const total = groups.reduce((n, g) => n + (g.weight ?? 1), 0);
  if (!total) return { score: a.length > 40 ? 50 : 20, feedback: "", by: "kavram" };
  const hits: string[] = [], misses: string[] = [];
  let got = 0;
  for (const g of groups) {
    const hit = g.terms.find(t => a.includes(norm(t)));
    if (hit) { got += g.weight ?? 1; hits.push(g.terms[0]); } else misses.push(g.terms[0]);
  }
  const score = Math.round((got / total) * 100);
  const feedback = [
    hits.length ? `Cevabınızda geçen kilit kavramlar: ${hits.join(", ")}.` : "Cevabınızda beklenen kilit kavramlardan hiçbiri geçmiyor.",
    misses.length ? `Eksik kalanlar: ${misses.join(", ")}.` : ""
  ].filter(Boolean).join(" ");
  return { score, feedback, by: "kavram" };
}

export async function evaluateFree(c: CaseFile, st: Step, answer: string, server?: { url: string; key: string; token?: string }): Promise<Evaluation> {
  const offline = () => keywordScore(answer, st.keywords);
  if (!server?.url || !answer.trim()) return offline();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(`${server.url}/functions/v1/degerlendir`, {
      method: "POST", signal: ctrl.signal,
      headers: { "Content-Type": "application/json", apikey: server.key, Authorization: `Bearer ${server.token || server.key}` },
      body: JSON.stringify({ dava: c.title, alan: c.area, mahkeme: c.court, rol: c.sides[st.side].role, soru: st.prompt, olcut: st.rubric || "", ornek: st.model || "", cevap: answer.slice(0, 2000) })
    });
    clearTimeout(t);
    if (!res.ok) return offline();
    const j = await res.json();
    const score = Math.max(0, Math.min(100, Math.round(Number(j.score))));
    if (!Number.isFinite(score)) return offline();
    return { score, feedback: String(j.feedback || ""), by: "ai" };
  } catch {
    return offline();
  }
}
