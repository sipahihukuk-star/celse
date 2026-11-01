// Tahkim dosyalarının çevirileri: public/ceviri/<dil>/<id>.json (web sitesiyle birlikte yayınlanır, gerektiğinde indirilir).
// Çeviri, asıl dosyayla aynı yapıda olmalıdır (adımlar, seçenekler, bayraklar, puanlar); yalnızca metinler değişir.
// Yapı tutmazsa ya da indirilemezse Türkçe asıl kullanılır. Böylece internet üzerinden farklı dillerdeki iki oyuncu aynı
// hamle numaralarıyla oynayabilir.
import { Platform } from "react-native";
import { supabase } from "../data/account";
import { normalizeCase } from "../engine/engine";
import { CaseFile } from "../engine/types";
import { getLang, Lang } from "./index";

const BASE = Platform.OS === "web" ? "./ceviri" : "https://sipahihukuk-star.github.io/celse/ceviri";
const cache = new Map<string, CaseFile | null>();

const shape = (c: CaseFile) => JSON.stringify(c.steps.map(s => [s.kind || "choice", s.side, s.if || "", s.choices.map(ch => [ch.delta, (ch.set || []).join("+"), ch.if || "", ch.min ?? ""])]))
  + JSON.stringify(c.outcomes.map(o => [o.if || "", o.winner])) + JSON.stringify((c.evidence || []).map(e => e.id));

export async function localizeCase(c: CaseFile, lang: Lang = getLang()): Promise<CaseFile> {
  if (lang === "tr" || c.room !== "tahkim") return c;
  const key = `${lang}/${c.id}`;
  if (!cache.has(key)) {
    let t: CaseFile | null = null;
    // Önce sitede yayınlanan çeviri, yoksa yönetim panelinde üretilip sunucuda saklanan çeviri.
    try { const r = await fetch(`${BASE}/${lang}/${c.id}.json`); if (r.ok) t = normalizeCase(await r.json()); } catch { /* yok say */ }
    if (!t || shape(t) !== shape(c)) {
      try {
        const sb = supabase();
        const { data } = sb ? await sb.from("ceviriler").select("veri").eq("dava_id", c.id).eq("dil", lang).maybeSingle() : { data: null };
        t = data?.veri ? normalizeCase(data.veri as CaseFile) : null;
      } catch { t = null; }
    }
    cache.set(key, t && shape(t) === shape(c) ? { ...t, id: c.id } : null);
  }
  return cache.get(key) || c;
}
