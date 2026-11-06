import { getLang } from "../i18n";
// Serbest cevap değerlendirmesi. Sunucu varsa yapay zekâ (Supabase Edge Function → Claude) puanlar;
// yoksa ya da cevap gelmezse adımdaki anahtar kavramlarla çevrimdışı puanlanır.
import { expandForSpeech } from "./speechText";
import { CaseFile, KeywordGroup, Step } from "./types";
import { disariGiden } from "./mask/oturum";
/** Evrak oturumunda giden metindeki gerçek adlar yeniden kodlanır. */
const disariGidenJson = (o: Record<string, unknown>) => JSON.stringify(o, (_k, v) => (typeof v === "string" ? disariGiden(v) : v));

export interface Evaluation { score: number; feedback: string; by: "ai" | "kavram" }

/** Türkçe büyük/küçük harf ve şapka farklarını yok sayar. */
export function norm(s: string): string {
  return s.toLocaleLowerCase("tr").replace(/[âà]/g, "a").replace(/[îì]/g, "i").replace(/[ûù]/g, "u").replace(/\s+/g, " ").trim();
}

/** Kısaltma ile açık yazımı eşitler: "TBK m.147", "Türk Borçlar Kanunu madde 147" ve "TBK 147. madde" aynı sayılır. */
export function canon(s: string): string {
  return norm(expandForSpeech(s))
    .replace(/(\d+)\s*\.\s*maddes[iı]/g, "madde $1").replace(/(\d+)\s*\.\s*madde/g, "madde $1")
    .replace(/(\d+)\s*\.\s*fıkras[iı]/g, "fıkra $1")
    .replace(/['’`"“”.,;:()]/g, " ").replace(/\s+/g, " ").trim();
}

export function keywordScore(answer: string, groups: KeywordGroup[] = []): Evaluation {
  const a = norm(answer), ac = canon(answer);
  const total = groups.reduce((n, g) => n + (g.weight ?? 1), 0);
  if (!total) return { score: a.length > 40 ? 50 : 20, feedback: "", by: "kavram" };
  const hits: string[] = [], misses: string[] = [];
  let got = 0;
  for (const g of groups) {
    const hit = g.terms.find(t => a.includes(norm(t)) || ac.includes(canon(t)));
    if (hit) { got += g.weight ?? 1; hits.push(g.terms[0]); } else misses.push(g.terms[0]);
  }
  const score = Math.round((got / total) * 100);
  const feedback = [
    hits.length ? `Cevabınızda geçen kilit kavramlar: ${hits.join(", ")}.` : "Cevabınızda beklenen kilit kavramlardan hiçbiri geçmiyor.",
    misses.length ? `Eksik kalanlar: ${misses.join(", ")}.` : ""
  ].filter(Boolean).join(" ");
  return { score, feedback, by: "kavram" };
}

const LANG_NOTE: Record<string, string> = {
  en: "İngilizce", fr: "Fransızca"
};

/** answerLang: uluslararası dosyada cevabın yazıldığı yabancı dil (en, fr). bonus: dil yetkinliği için eklenecek puan. */
export async function evaluateFree(c: CaseFile, st: Step, answer: string, server?: { url: string; key: string; token?: string; fn?: string }, opts?: { answerLang?: string; bonus?: number }): Promise<Evaluation> {
  const ev = await evaluateRaw(c, st, answer, server, opts?.answerLang);
  if (!opts?.answerLang || !opts.bonus) return ev;
  const score = Math.min(100, ev.score + opts.bonus);
  return { ...ev, score, feedback: `${ev.feedback} (+${opts.bonus}: ${LANG_NOTE[opts.answerLang] || ""} savunma)`.trim() };
}

async function evaluateRaw(c: CaseFile, st: Step, answer: string, server?: { url: string; key: string; token?: string; fn?: string }, answerLang?: string): Promise<Evaluation> {
  // Yabancı dildeki cevap anahtar kelimelerle (Türkçe) ölçülemez: çevrimdışıyken orta puan verilir.
  const offline = () => answerLang ? { score: 50, feedback: "Yabancı dildeki cevabınız çevrim dışıyken ayrıntılı değerlendirilemedi.", by: "kavram" as const } : keywordScore(answer, st.keywords);
  const note = answerLang ? `(Not: Oyuncu bu cevabı uluslararası yargı mercii önünde ${LANG_NOTE[answerLang] || answerLang} yazmıştır. Hukuki içeriği dilden bağımsız değerlendir; kavramların yabancı dildeki karşılıklarını kabul et; yalnızca anlamı bozan dil hataları puanı düşürsün.) ` : "";
  if (!server?.url || !answer.trim()) return offline();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(`${server.url}/functions/v1/${server.fn || "degerlendir"}`, {
      method: "POST", signal: ctrl.signal,
      headers: { "Content-Type": "application/json", apikey: server.key, Authorization: `Bearer ${server.token || server.key}` },
      body: disariGidenJson({ mode: "puan", dil: getLang(), dava: c.title, alan: c.area, mahkeme: c.court, rol: c.sides[st.side].role, soru: note + st.prompt, olcut: st.rubric || "", ornek: st.model || "", cevap: answer.slice(0, 2000) })
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
