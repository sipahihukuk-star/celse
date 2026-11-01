// Duruşma akışı: satırlar → belgeler → (sıra değişimi) → seçenekler → cevap satırları → geri bildirim → ... → karar.
import { useEffect, useState } from "react";
import { penaltyFor } from "../data/settings";
import { aiPick, applyChoice, bandFor, choicesOf, createGame, findNextStep, GameState, kindOf, linesOf, shuffle, textOf } from "../engine/engine";
import { CaseFile, Line, Player, Scene, Side } from "../engine/types";
import type { Move } from "../data/online";

/** İnternet üzerinden oyunda: sunucudan gelen hamleler ve kendi hamlemizi gönderme. */
export interface OnlineLink { moves: Move[]; send: (m: Move) => void; mySide: Side }

type After = { k: "docs" } | { k: "turn"; step: number } | { k: "feedback"; step: number } | { k: "next" };

export type Phase =
  | { k: "lines"; lines: Line[]; i: number; after: After }
  | { k: "docs" }
  | { k: "pass"; step: number }
  | { k: "choices"; step: number; order: number[]; aiPick?: number }
  | { k: "feedback"; step: number }
  | { k: "done" };

interface Flow { game: GameState; phase: Phase; scene: Scene; lastSide: Side | null; called?: boolean; n: number }

/** Mübaşirin çağrısı: "2026/566 esas sayılı dosyanın tarafları, İzmir 4. İş Mahkemesi duruşma salonuna!" */
export function mubasirLine(c: CaseFile): Line {
  const esas = (c.esas || "").replace(/\s*Esas$/i, "");
  if (c.room === "uluslararasi" || /İnsan Hakları|Uluslararası/.test(c.court)) return { who: "mubasir", text: "Mahkeme! Lütfen ayağa kalkın." };
  const yuksek = /Yargıtay|Danıştay|Sayıştay|Anayasa/.test(c.court);
  return { who: "mubasir", text: yuksek
    ? `${esas} esas sayılı dosyada duruşma başlıyor. Taraf vekilleri salona!`
    : `${esas} esas sayılı dosyanın tarafları, ${c.court} duruşma salonuna!` };
}

export const LETTERS = "ABCDEFGH";

export function useCourt(c: CaseFile, players: Record<Side, Player>, onFinish: (g: GameState) => void, online?: OnlineLink) {
  const [f, setF] = useState<Flow>(() => ({
    game: createGame(c, players, { penalty: penaltyFor(c) }), scene: "office", lastSide: null, n: 0,
    phase: { k: "lines", lines: c.intro, i: 0, after: { k: "docs" } }
  }));

  // Aynı cihazda iki kişi oynuyorsa sıra değişiminde cihaz devredilir; internet rakibinde gerekmez.
  const twoHumans = c.mode === "duel" && !players.p1.ai && !players.p2.ai && !players.p1.remote && !players.p2.remote;

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
    let lines = linesOf(st.lines, cur.game.flags);
    // Duruşma salonuna ilk girişte mübaşir dosyayı ve tarafları çağırır.
    if (st.scene === "court" && cur.scene !== "court" && !cur.called && (c.room !== "tahkim" || /Asliye|Bölge Adliye|Yargıtay|Dairesi|Mahkemesi/.test(c.court) && !/Tahkim|Komisyon|Kurul/.test(c.court))) lines = [mubasirLine(c), ...lines];
    return toLines({ ...cur, scene: st.scene, called: cur.called || st.scene === "court" }, lines, { k: "turn", step: idx });
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

  const applyPick = (choice: number, letter: string) => setF(cur => {
    const p = cur.phase;
    if (p.k !== "choices") return cur;
    const ch = choicesOf(c, cur.game, p.step)[choice];
    const game = applyChoice(c, cur.game, p.step, choice, letter);
    // Açıklaması olmayan hamlelerde (ör. görüşme sorusu) geri bildirim ekranı atlanır.
    const after: After = textOf(ch.note, game.flags) ? { k: "feedback", step: p.step } : { k: "next" };
    return toLines({ ...cur, game, n: cur.n + 1 }, ch.reply ? linesOf(ch.reply, game.flags) : [], after);
  });
  /** Oyuncunun kendi hamlesi; internet oyununda sunucuya da yazılır. */
  const choose = (choice: number, letter: string) => {
    const p = f.phase;
    if (online && p.k === "choices" && c.steps[p.step].side === online.mySide) online.send({ n: f.n, step: p.step, choice, letter, side: online.mySide });
    applyPick(choice, letter);
  };

  /** Serbest cevap: değerlendirme puanına düşen sonuç uygulanır, oyuncunun cümlesi ve geri bildirim kayda geçer. */
  const applyFree = (answer: string, score: number, feedback: string) => setF(cur => {
    const p = cur.phase;
    if (p.k !== "choices") return cur;
    const st = c.steps[p.step];
    const idx = bandFor(st, score);
    const ch = choicesOf(c, cur.game, p.step)[idx];
    const game = applyChoice(c, cur.game, p.step, idx, "✎", { answer, feedback, score });
    return toLines({ ...cur, game, n: cur.n + 1 }, ch.reply ? linesOf(ch.reply, game.flags) : [], { k: "feedback", step: p.step });
  });
  const chooseFree = (answer: string, score: number, feedback: string) => {
    const p = f.phase;
    if (online && p.k === "choices" && c.steps[p.step].side === online.mySide) {
      online.send({ n: f.n, step: p.step, choice: bandFor(c.steps[p.step], score), letter: "✎", side: online.mySide, answer, score, feedback });
    }
    applyFree(answer, score, feedback);
  };

  // Bilgisayar rakibin hamlesi: düşünür, seçeneği işaretler, sonra oynar.
  const p = f.phase;
  const remoteTurn = p.k === "choices" && !!players[c.steps[p.step].side].remote;
  const aiTurn = p.k === "choices" && (players[c.steps[p.step].side].ai || remoteTurn);
  // İnternet rakibinin hamlesi sunucudan gelince işaretlenir ve oynanır.
  const pending = remoteTurn && p.k === "choices" ? online?.moves.find(m => m.n === f.n && m.step === p.step) : undefined;
  useEffect(() => {
    if (!remoteTurn || p.k !== "choices" || !pending) return;
    if (pending.answer !== undefined) {
      const t = setTimeout(() => applyFree(pending.answer!, pending.score ?? 0, pending.feedback || ""), 500);
      return () => clearTimeout(t);
    }
    if (p.aiPick === undefined) { setF(cur => (cur.phase === p ? { ...cur, phase: { ...p, aiPick: pending.choice } } : cur)); return; }
    const t = setTimeout(() => applyPick(p.aiPick!, pending.letter || "•"), 900);
    return () => clearTimeout(t);
  }, [p, remoteTurn, pending?.n]);
  useEffect(() => {
    if (p.k !== "choices" || !aiTurn || remoteTurn) return;
    if (p.aiPick === undefined) {
      const t = setTimeout(() => {
        const pick = aiPick(choicesOf(c, f.game, p.step), players[c.steps[p.step].side].level);
        setF(cur => (cur.phase === p ? { ...cur, phase: { ...p, aiPick: pick } } : cur));
      }, 1300);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => applyPick(p.aiPick!, LETTERS[p.order.indexOf(p.aiPick!)] || "•"), 900);
    return () => clearTimeout(t);
  }, [p, aiTurn]);

  useEffect(() => { if (p.k === "done") onFinish(f.game); }, [p.k]);

  return { ...f, next, prev, choose, chooseFree, aiTurn, remoteTurn };
}
