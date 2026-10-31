// Duruşma akışı: satırlar → belgeler → (sıra değişimi) → seçenekler → cevap satırları → geri bildirim → ... → karar.
import { useEffect, useState } from "react";
import { aiPick, applyChoice, bandFor, choicesOf, createGame, findNextStep, GameState, kindOf, linesOf, shuffle, textOf } from "../engine/engine";
import { CaseFile, Line, Player, Scene, Side } from "../engine/types";

type After = { k: "docs" } | { k: "turn"; step: number } | { k: "feedback"; step: number } | { k: "next" };

export type Phase =
  | { k: "lines"; lines: Line[]; i: number; after: After }
  | { k: "docs" }
  | { k: "pass"; step: number }
  | { k: "choices"; step: number; order: number[]; aiPick?: number }
  | { k: "feedback"; step: number }
  | { k: "done" };

interface Flow { game: GameState; phase: Phase; scene: Scene; lastSide: Side | null }

export const LETTERS = "ABCDEFGH";

export function useCourt(c: CaseFile, players: Record<Side, Player>, onFinish: (g: GameState) => void) {
  const [f, setF] = useState<Flow>(() => ({
    game: createGame(c, players), scene: "office", lastSide: null,
    phase: { k: "lines", lines: c.intro, i: 0, after: { k: "docs" } }
  }));

  const twoHumans = c.mode === "duel" && !players.p1.ai && !players.p2.ai;

  /** Klasik seçenekler karıştırılır; delil ve görüşme listeleri sabit kalır ("geç" / "bitir" en sonda). */
  const orderFor = (game: GameState, step: number) => {
    const n = choicesOf(c, game, step).length;
    return kindOf(c.steps[step]) === "choice" ? shuffle(n) : [...Array(n).keys()];
  };
  const toChoices = (cur: Flow, step: number): Flow =>
    ({ ...cur, lastSide: c.steps[step].side, phase: { k: "choices", step, order: orderFor(cur.game, step) } });

  const toTurn = (cur: Flow, step: number): Flow => {
    const side = c.steps[step].side;
    if (twoHumans && cur.lastSide !== side) return { ...cur, phase: { k: "pass", step } };
    return toChoices(cur, step);
  };
  const toNextStep = (cur: Flow): Flow => {
    const idx = findNextStep(c, cur.game);
    if (idx === -1) return { ...cur, phase: { k: "done" } };
    // Süren bir müvekkil görüşmesine dönülüyorsa giriş satırları tekrar oynatılmaz.
    if (idx === cur.game.stepIdx) return toTurn(cur, idx);
    const st = c.steps[idx];
    return toLines({ ...cur, scene: st.scene }, linesOf(st.lines, cur.game.flags), { k: "turn", step: idx });
  };
  const resolveAfter = (cur: Flow, after: After): Flow => {
    if (after.k === "docs") return { ...cur, phase: { k: "docs" } };
    if (after.k === "turn") return toTurn(cur, after.step);
    if (after.k === "feedback") return { ...cur, phase: { k: "feedback", step: after.step } };
    return cur.game.fatal || cur.game.flags.end ? { ...cur, phase: { k: "done" } } : toNextStep(cur);
  };
  function toLines(cur: Flow, lines: Line[], after: After): Flow {
    return lines.length ? { ...cur, phase: { k: "lines", lines, i: 0, after } } : resolveAfter(cur, after);
  }

  /** Satır ilerlet / belgeleri geç / sıra ekranını geç / geri bildirimden devam et. */
  const next = () => setF(cur => {
    const p = cur.phase;
    if (p.k === "lines") return p.i + 1 < p.lines.length ? { ...cur, phase: { ...p, i: p.i + 1 } } : resolveAfter(cur, p.after);
    if (p.k === "docs") return toNextStep(cur);
    if (p.k === "pass") return toChoices(cur, p.step);
    if (p.k === "feedback") return resolveAfter(cur, { k: "next" });
    return cur;
  });

  /** Bir önceki satıra dön (yalnızca okumak için; verilmiş kararlar geri alınmaz). */
  const prev = () => setF(cur => {
    const p = cur.phase;
    return p.k === "lines" && p.i > 0 ? { ...cur, phase: { ...p, i: p.i - 1 } } : cur;
  });

  const choose = (choice: number, letter: string) => setF(cur => {
    const p = cur.phase;
    if (p.k !== "choices") return cur;
    const ch = choicesOf(c, cur.game, p.step)[choice];
    const game = applyChoice(c, cur.game, p.step, choice, letter);
    // Açıklaması olmayan hamlelerde (ör. görüşme sorusu) geri bildirim ekranı atlanır.
    const after: After = textOf(ch.note, game.flags) ? { k: "feedback", step: p.step } : { k: "next" };
    return toLines({ ...cur, game }, ch.reply ? linesOf(ch.reply, game.flags) : [], after);
  });

  /** Serbest cevap: değerlendirme puanına düşen sonuç uygulanır, oyuncunun cümlesi ve geri bildirim kayda geçer. */
  const chooseFree = (answer: string, score: number, feedback: string) => setF(cur => {
    const p = cur.phase;
    if (p.k !== "choices") return cur;
    const st = c.steps[p.step];
    const idx = bandFor(st, score);
    const ch = choicesOf(c, cur.game, p.step)[idx];
    const game = applyChoice(c, cur.game, p.step, idx, "✎", { answer, feedback, score });
    return toLines({ ...cur, game }, ch.reply ? linesOf(ch.reply, game.flags) : [], { k: "feedback", step: p.step });
  });

  // Bilgisayar rakibin hamlesi: düşünür, seçeneği işaretler, sonra oynar.
  const p = f.phase;
  const aiTurn = p.k === "choices" && players[c.steps[p.step].side].ai;
  useEffect(() => {
    if (p.k !== "choices" || !aiTurn) return;
    if (p.aiPick === undefined) {
      const t = setTimeout(() => {
        const pick = aiPick(choicesOf(c, f.game, p.step), players[c.steps[p.step].side].level);
        setF(cur => (cur.phase === p ? { ...cur, phase: { ...p, aiPick: pick } } : cur));
      }, 1300);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => choose(p.aiPick!, LETTERS[p.order.indexOf(p.aiPick!)] || "•"), 900);
    return () => clearTimeout(t);
  }, [p, aiTurn]);

  useEffect(() => { if (p.k === "done") onFinish(f.game); }, [p.k]);

  return { ...f, next, prev, choose, chooseFree, aiTurn };
}
