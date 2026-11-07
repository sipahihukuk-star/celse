// Görsel ve akış denetimi (yapay zekâsız, cihazda çalışır): yapay zekâ denetiminin göremediği, ekranda ortaya çıkan hatalar.
//  1) Karşılıklı davada oyuncu hangi tarafı oynarsa oynasın kendi yüzü kendi tarafında, karşı vekil başka bir yüzde.
//  2) Karşılıklı davada büroda yalnız sırası gelen tarafın avukatı görünür (karşı vekil müvekkil görüşmesine girmez).
//  3) Metinde yaşı yazmayan, saçı kır olmayan sivil kişiye yaşlı yüz (kır saçlı 62, başörtülü 72) düşmez.
//  4) Görüşmelerde son soruda da seçim kalır (tek şıklı soru olmaz).
//  5) Dosyada ve kanun yolu aşamalarında (istinaf, cevap, temyiz) hiçbir şık yarıda kesilip "…" ile bitmez.
// Yönetim panelindeki "Görsel denetim" düğmesi ve tools/faces-test.ts aynı denetimi kullanır.
import { allStages } from "../engine/appeal";
import { applyChoice, choicesOf, createGame, findNextStep, normalizeCase, validateCase } from "../engine/engine";
import { CaseFile } from "../engine/types";
import { castFaces, faceAge, isOld } from "../ui/castFaces";
import { castHints } from "../ui/castText";
import { stageLayout } from "../ui/stageLayout";

export interface VisualIssue { tur: "yuz" | "sahne" | "yas" | "gorusme" | "sik"; yer: string; sorun: string; oneri: string }

const AV = "av-erkek-58" as const;

export function visualAudit(raw: CaseFile): VisualIssue[] {
  let c: CaseFile;
  try { c = normalizeCase(raw); } catch (e) { return [{ tur: "gorusme", yer: "dosya", sorun: "Dosya okunamadı: " + (e as Error).message, oneri: "Dosyayı düzenleyicide açıp kaydedin." }]; }
  const out: VisualIssue[] = [];

  // 1 ve 2: karşılıklı dava, iki taraf için ayrı ayrı.
  if (c.mode === "duel" && c.room !== "tahkim") for (const side of ["p1", "p2"] as const) {
    const f = castFaces(c, AV, false, side);
    const other = side === "p1" ? "p2" : "p1";
    if (f[side] !== AV) out.push({ tur: "yuz", yer: `${side} tarafı`, sorun: `Oyuncu ${side} tarafını oynadığında kendi yüzü o tarafta görünmüyor.`, oneri: "Kod hatası: geliştiriciye bildirin." });
    if (f[other] === AV) out.push({ tur: "yuz", yer: `${side} tarafı`, sorun: "Karşı vekil oyuncunun yüzünü taşıyor (taraflar karışıyor).", oneri: "Kod hatası: geliştiriciye bildirin." });
    const guest = Object.keys(c.cast).find(r => !/^(judge|p1|p2)$/.test(r)) || null;
    let bildirildi = false;
    c.steps.forEach((st, i) => {
      if (st.scene !== "office" || bildirildi) return;
      const keys = stageLayout({ c, scene: "office", faces: f, focus: null, guest, W: 1200, H: 600, side: st.side }).figs.map(x => x.key);
      if (!keys.includes(st.side)) { out.push({ tur: "sahne", yer: `${i + 1}. adım`, sorun: `Büroda sırası gelen avukat (${st.side}) görünmüyor.`, oneri: "Kod hatası: geliştiriciye bildirin." }); bildirildi = true; }
      else if (keys.includes(st.side === "p1" ? "p2" : "p1")) { out.push({ tur: "sahne", yer: `${i + 1}. adım`, sorun: "Büroda karşı vekil de görünüyor.", oneri: "Kod hatası: geliştiriciye bildirin." }); bildirildi = true; }
    });
  }

  // 3: yaş ile yüz uyumu.
  const f = castFaces(c, AV, false);
  const hints = castHints(c);
  for (const [r, m] of Object.entries(c.cast)) {
    if (m.look?.kind !== "civil" || hints[r]?.age !== undefined || isOld(m.look)) continue;
    const ad = m.name || r, ilk = ad.split(" ·")[0].split(" ")[0];
    if ((faceAge(f[r]) ?? 40) >= 60 && /^mv-/.test(f[r])) out.push({ tur: "yas", yer: ad, sorun: `Yaşı belirtilmemiş ${ad} yaşlı bir yüzle görünüyor.`, oneri: `Giriş metnine yaşını yazın (ör. "${ilk} bugün 45 yaşında.").` });
  }

  // 4: görüşmede tek şıklı soru (içerik kuralı ve oyun akışı).
  for (const e of validateCase(c)) if (/görüşmede/.test(e)) out.push({ tur: "gorusme", yer: e.split(":")[0], sorun: e.split(":").slice(1).join(":").trim(), oneri: "Görüşmeye koşulsuz bir soru daha ekleyin ya da soru hakkını (limit) bir azaltın." });
  c.steps.forEach((st, i) => {
    if (st.kind !== "interview") return;
    let g = createGame(c, { p1: { name: "A", ai: false }, p2: { name: "B", ai: false } } as any);
    g = { ...g, stepIdx: i, flags: {} };
    for (let k = 0; k < 10 && findNextStep(c, g) === i; k++) {
      const ch = choicesOf(c, g, i);
      if (ch.filter(x => !x.finish).length < 2 && (g.asked[i] || []).length > 0) {
        out.push({ tur: "gorusme", yer: `${i + 1}. adım`, sorun: "Görüşmede tek şıklı soru kalıyor.", oneri: "Görüşmeye koşulsuz bir soru daha ekleyin." });
        break;
      }
      g = applyChoice(c, g, i, ch.findIndex(x => !x.finish), "A");
    }
  });
  // 5: yarıda kesilmiş şık (dosyanın kendisinde ve otomatik kurulan kanun yolu aşamalarında).
  const kesik = (st: { choices?: { text: string }[] }) => (st.choices || []).find(ch => /(…|\.\.\.)\s*$/.test(ch.text));
  c.steps.forEach((st, i) => { const k = kesik(st); if (k) out.push({ tur: "sik", yer: `${i + 1}. adım`, sorun: `Şık yarıda kesilmiş: “${k.text.slice(-60)}”`, oneri: "Şıkkı tam bir cümle olarak yazın." }); });
  let stages: CaseFile[] = [];
  try { stages = allStages(c); } catch { /* kanun yolu kurulamazsa bu denetim atlanır */ }
  for (const sc of stages) sc.steps.forEach((st, i) => {
    const k = kesik(st);
    if (k) out.push({ tur: "sik", yer: `${sc.title || "Kanun yolu"} · ${i + 1}. adım`, sorun: `Kanun yolu şıkkı yarıda kesilmiş: “${k.text.slice(-60)}”`, oneri: "Kod hatası: geliştiriciye bildirin." });
  });
  // Aynı sorun iki taraftan iki kez gelmesin.
  const seen = new Set<string>();
  return out.filter(x => { const k = x.tur + x.yer + x.sorun; if (seen.has(k)) return false; seen.add(k); return true; });
}
