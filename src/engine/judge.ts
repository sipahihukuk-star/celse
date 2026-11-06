// Karşılıklı duruşmada yapay zekâ hâkim: iki tarafın hamlelerini ve son sözlerini sunucudaki modele gönderir.
// Sunucu ya da model yoksa karar hamle puanlarına ve son sözlerdeki hukuki kavramlara göre çevrimdışı verilir.
import { getLang } from "../i18n";
import { canon } from "./evaluate";
import { GameState } from "./engine";
import { CaseFile, Side } from "./types";
import { disariGiden } from "./mask/oturum";
/** Evrak oturumunda giden metindeki gerçek adlar yeniden kodlanır. */
const disariGidenJson = (o: Record<string, unknown>) => JSON.stringify(o, (_k, v) => (typeof v === "string" ? disariGiden(v) : v));

export interface AiVerdict { winner: Side | "sulh"; p1: number; p2: number; hukum: string; gerekce: string; by: "ai" | "puan" }

/** Hamle dökümü (modelin okuyacağı biçimde). */
export function movesText(c: CaseFile, g: GameState) {
  return g.log.map((e, i) => `${i + 1}. ${e.side} (${c.sides[e.side].role}) · Soru: ${e.prompt}\n   Hamle: ${e.text}\n   Değerlendirme (${e.delta >= 0 ? "+" : ""}${e.delta}): ${e.note}${e.law ? ` [${e.law}]` : ""}`).join("\n");
}

/** Bilgisayar rakibin son sözü: seçtiği hamlelerin özeti. */
export function aiClosing(c: CaseFile, g: GameState, side: Side) {
  const mine = g.log.filter(e => e.side === side && e.delta > 0).map(e => e.text.replace(/^[A-H]\)\s*/, ""));
  const head = `Sayın Mahkeme, ${c.sides[side].role} olarak dosyadaki belgeler ve duruşmadaki beyanlarımız ışığında talebimizin kabulünü istiyoruz.`;
  return [head, ...mine.slice(-3)].join(" ");
}

/** Çevrimdışı karar: hamle puanları + son sözde geçen, hamle notlarındaki kanun atıflarının sayısı. */
function offline(c: CaseFile, g: GameState, s1: string, s2: string): AiVerdict {
  const laws = Array.from(new Set(g.log.map(e => e.law).filter(Boolean) as string[]));
  const bonus = (t: string) => Math.min(15, laws.filter(l => canon(t).includes(canon(l).split(" ").slice(0, 3).join(" "))).length * 5) + Math.min(5, Math.floor(t.trim().length / 120));
  const d = (g.pts.p1 - g.pts.p2) / 2;
  const p1 = Math.round(Math.max(0, Math.min(100, 50 + d + bonus(s1)))), p2 = Math.round(Math.max(0, Math.min(100, 50 - d + bonus(s2))));
  const winner: AiVerdict["winner"] = Math.abs(p1 - p2) < 4 ? "sulh" : p1 > p2 ? "p1" : "p2";
  return {
    winner, p1, p2, by: "puan",
    hukum: winner === "sulh" ? "Davanın kısmen kabulüne, kısmen reddine," : `Davada ${c.sides[winner].role} tarafının taleplerinin kabulüne,`,
    gerekce: "Yapay zekâ hâkime şu an ulaşılamadı; karar duruşmadaki hamlelerin puanına ve son sözlerde ileri sürülen hukuki dayanaklara göre verildi."
  };
}

export async function judgeDuel(c: CaseFile, g: GameState, s1: string, s2: string, server?: { url: string; key: string; token?: string; fn: string }): Promise<AiVerdict> {
  if (!server?.url) return offline(c, g, s1, s2);
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 45000);
    const res = await fetch(`${server.url}/functions/v1/${server.fn}`, {
      method: "POST", signal: ctrl.signal,
      headers: { "Content-Type": "application/json", apikey: server.key, Authorization: `Bearer ${server.token || server.key}` },
      body: disariGidenJson({
        mode: "karar", dil: getLang(), dava: c.title, alan: c.area, mahkeme: c.court, olay: c.teaser,
        belgeler: c.docs.map(d => `- ${d.t}: ${d.d}`).join("\n"),
        rol1: c.sides.p1.role, rol2: c.sides.p2.role, hamleler: movesText(c, g), son1: s1.slice(0, 2500), son2: s2.slice(0, 2500)
      })
    });
    clearTimeout(t);
    if (!res.ok) return offline(c, g, s1, s2);
    const j = await res.json();
    if (!j || !["p1", "p2", "sulh"].includes(j.winner)) return offline(c, g, s1, s2);
    return { winner: j.winner, p1: j.p1, p2: j.p2, hukum: j.hukum || "", gerekce: j.gerekce || "", by: "ai" };
  } catch { return offline(c, g, s1, s2); }
}
