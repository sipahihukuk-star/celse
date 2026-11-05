// Dosya çevirileri (bütün dosyalar): public/ceviri/<dil>/<id>.json (web sitesiyle birlikte yayınlanır, gerektiğinde indirilir).
// Çeviri, asıl dosyayla aynı yapıda olmalıdır (adımlar, seçenekler, bayraklar, puanlar); yalnızca metinler değişir.
// Yapı tutmazsa ya da indirilemezse Türkçe asıl kullanılır. Böylece internet üzerinden farklı dillerdeki iki oyuncu aynı
// hamle numaralarıyla oynayabilir.
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { supabase } from "../data/account";
import { normalizeCase } from "../engine/engine";
import { CaseFile } from "../engine/types";
import { getLang, Lang, useLang } from "./index";

const BASE = Platform.OS === "web" ? "./ceviri" : "https://celse.themiscode.com/ceviri";
const cache = new Map<string, CaseFile | null>();

const shape = (c: CaseFile) => JSON.stringify(c.steps.map(s => [s.kind || "choice", s.side, s.if || "", s.choices.map(ch => [ch.delta, (ch.set || []).join("+"), ch.if || "", ch.min ?? ""])]))
  + JSON.stringify(c.outcomes.map(o => [o.if || "", o.winner])) + JSON.stringify((c.evidence || []).map(e => e.id));

export async function localizeCase(c: CaseFile, lang: Lang = getLang()): Promise<CaseFile> {
  if (lang === "tr") return c;
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
    // Oyun mantığının kullandığı alanlar (mahkeme adı, hukuk dalı, salon, kariyer) Türkçe asıldan kalır: cübbe rengi,
    // kariyer seviyesi ve uzmanlık bu alanlara bakar. Mahkeme adı özel ad olduğu için Türkçe görünmesi de doğaldır.
    cache.set(key, t && shape(t) === shape(c) ? { ...t, id: c.id, court: c.court, area: c.area, room: c.room, forum: c.forum, bench: c.bench, career: c.career, difficulty: c.difficulty, mode: c.mode } : null);
  }
  return cache.get(key) || c;
}

/* ---------- Listelerde başlık ve kısa özet ---------- */
// Dosya listeleri (dolap, masa, kariyer haritası) seçili dildeki başlık ve özeti gösterir; tam çeviri oyun açılınca yüklenir.
export type CaseHead = { title?: string; teaser?: string };
const heads = new Map<Lang, Record<string, CaseHead>>();
const pending = new Map<Lang, Promise<Record<string, CaseHead>>>();

export function loadCaseHeads(lang: Lang): Promise<Record<string, CaseHead>> {
  if (lang === "tr") return Promise.resolve({});
  if (heads.has(lang)) return Promise.resolve(heads.get(lang)!);
  if (!pending.has(lang)) {
    pending.set(lang, (async () => {
      const out: Record<string, CaseHead> = {};
      try {
        const sb = supabase();
        const { data } = sb ? await sb.from("ceviriler").select("dava_id, title:veri->>title, teaser:veri->>teaser").eq("dil", lang) : { data: null };
        (data || []).forEach((r: { dava_id: string; title?: string; teaser?: string }) => { out[r.dava_id] = { title: r.title || undefined, teaser: r.teaser || undefined }; });
        heads.set(lang, out);
      } catch { /* sunucu yoksa Türkçe kalır */ }
      pending.delete(lang);
      return out;
    })());
  }
  return pending.get(lang)!;
}

export function useCaseHeads(): Record<string, CaseHead> {
  const [lang] = useLang();
  const [h, setH] = useState<Record<string, CaseHead>>(heads.get(lang) || {});
  useEffect(() => { let live = true; loadCaseHeads(lang).then(x => { if (live) setH(x); }); return () => { live = false; }; }, [lang]);
  return lang === "tr" ? {} : h;
}
