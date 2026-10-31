import React, { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { bagOf, choicesOf, GameState, grade, kindOf } from "../engine/engine";
import { CaseFile, Line, Player, Side } from "../engine/types";
import { Btn, Chip, Scale } from "./kit";
import Stage from "./Stage";
import { C, F, sideColor, toneColor } from "./theme";
import { LETTERS, useCourt } from "./useCourt";
import { speakLine, stopSpeaking, useVoiceEnabled } from "./voice";
import FreeAnswer from "./FreeAnswer";

interface Props { c: CaseFile; players: Record<Side, Player>; onExit: () => void; onFinish: (g: GameState) => void }

/** Metni harf harf yazar; dokunulunca tamamlar. */
function useTypewriter(text: string) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const t = setInterval(() => setN(v => { if (v >= text.length) { clearInterval(t); return v; } return v + 2; }), 18);
    return () => clearInterval(t);
  }, [text]);
  return { shown: text.slice(0, n), done: n >= text.length, finish: () => setN(text.length) };
}

export default function GameScreen({ c, players, onExit, onFinish }: Props) {
  const court = useCourt(c, players, onFinish);
  const { game, phase, scene } = court;
  const { width } = useWindowDimensions();
  const [docs, setDocs] = useState(false);
  const [record, setRecord] = useState(false);
  // Duruşma tutanağı: gösterilen her satır ve verilen her karar, sırasıyla.
  const [history, setHistory] = useState<{ who: string; text: string; karar?: boolean }[]>([]);
  const seen = useRef(new WeakMap<object, number>());
  const duel = c.mode === "duel";
  const wide = width >= 860;

  const line: Line | null = phase.k === "lines" ? phase.lines[phase.i] : null;
  const tw = useTypewriter(line ? line.text : "");

  const speakerName = (who: string) => {
    if (who === "narr") return { name: "Dosya notu", dot: C.muted };
    if (who === "p1" || who === "p2") return { name: `${players[who].name} · ${c.sides[who].role}`, dot: sideColor(who) };
    const m = c.cast[who];
    return { name: m?.name || who, dot: m?.np === "red" ? "#c2343c" : m?.np === "green" ? "#2f9a66" : C.brass };
  };

  let focus: string | null = null;
  if (line && line.who !== "narr") focus = line.who;
  if (phase.k === "choices" || phase.k === "pass") focus = duel ? c.steps[phase.step].side : scene === "court" ? "p1" : null;

  // Terazi açısı ve puan
  const angle = duel ? -Math.max(-60, Math.min(60, game.pts.p1 - game.pts.p2)) / 60 * 15 : -(game.score - 50) / 50 * 15;
  const last = game.log[game.log.length - 1];

  const scroller = useRef<any>(null);
  useEffect(() => { scroller.current?.scrollTo({ y: 0, animated: false }); }, [phase]);

  const tapLine = () => (tw.done ? court.next() : tw.finish());

  useEffect(() => {
    if (phase.k !== "lines" || !line) return;
    const max = seen.current.get(phase.lines) ?? -1;
    if (phase.i > max) { seen.current.set(phase.lines, phase.i); setHistory(h => [...h, { who: line.who, text: line.text }]); }
  }, [phase]);
  useEffect(() => {
    const e = game.log[game.log.length - 1];
    if (e) setHistory(h => [...h, { who: e.side, text: `${c.sides[e.side].short}: ${e.text}`, karar: true }]);
  }, [game.log.length]);

  // Seslendirme: her yeni satır, soru ve geri bildirim okunur.
  const [voiceOn, setVoiceOn] = useVoiceEnabled();
  useEffect(() => {
    if (!voiceOn) return;
    if (phase.k === "lines" && line) speakLine(line.text, line.who);
    else if (phase.k === "choices" && !court.aiTurn) { const pr = c.steps[phase.step].prompt; if (pr) speakLine(pr, "narr"); }
    else if (phase.k === "feedback" && last) speakLine(last.note || "", "narr");
  }, [phase, voiceOn]);
  useEffect(() => () => { stopSpeaking(); }, []);

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Btn kind="ghost" label="‹ Dosyalar" onPress={onExit} />
        <View style={styles.topCase}>
          <Text style={styles.court} numberOfLines={1}>{c.court}</Text>
          <Text style={styles.esas} numberOfLines={1}>{duel ? `${c.esas} · ${c.sides.p1.short} ⇄ ${c.sides.p2.short}` : `${c.esas} · ${c.sides.p1.role}`}</Text>
        </View>
        <Btn kind="ghost" label={voiceOn ? "🔊" : "🔇"} onPress={() => setVoiceOn(!voiceOn)} />
        <Btn kind="ghost" label="Dosya" onPress={() => setDocs(true)} />
        <View style={styles.scaleBox}>
          <Scale angle={angle} size={width < 480 ? 56 : 80} left={duel ? C.p1 : C.brass} right={duel ? C.p2 : C.brass} />
          {duel ? (
            <Text style={styles.score}><Text style={{ color: C.p1 }}>{game.pts.p1}</Text><Text style={{ color: C.muted }}>:</Text><Text style={{ color: C.p2 }}>{game.pts.p2}</Text></Text>
          ) : (
            <View><Text style={styles.scoreLabel}>İKNA</Text><Text style={styles.score}>{game.score}</Text></View>
          )}
        </View>
      </View>

      <View style={[styles.stageWrap, { flex: wide ? 1.15 : 1 }]}>
        <Stage c={c} scene={scene} focus={focus} talking={!!line && !tw.done} />
      </View>

      <View style={[styles.panel, { flex: wide ? 0.85 : 1 }]}>
        <ScrollView ref={scroller} contentContainerStyle={styles.panelInner}>
          {phase.k === "lines" && line && (
            <Pressable onPress={tapLine} accessibilityRole="button" accessibilityLabel="Devam">
              <View style={styles.np}><View style={[styles.dot, { backgroundColor: speakerName(line.who).dot }]} /><Text style={line.who === "narr" ? styles.npNarr : styles.npText}>{speakerName(line.who).name}</Text></View>
              <Text style={[styles.dlg, line.who === "narr" && styles.dlgNarr]}>{tw.shown}</Text>
              <View style={styles.rowBetween}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Btn kind="ghost" label="‹ Geri" onPress={court.prev} disabled={phase.i === 0} />
                  <Btn kind="ghost" label="Tutanak" onPress={() => setRecord(true)} disabled={history.length < 2} />
                </View>
                <Btn kind="next" label="Devam ▸" onPress={tapLine} />
              </View>
            </Pressable>
          )}

          {phase.k === "docs" && (
            <View>
              <Text style={styles.npNarr}>DOSYADAKİ BELGELER</Text>
              <View style={[styles.docGrid, wide && styles.twoCol]}>
                {c.docs.map(d => (
                  <View key={d.t} style={[styles.doc, wide && styles.half]}><Text style={styles.docT}>{d.t}</Text><Text style={styles.docD}>{d.d}</Text></View>
                ))}
              </View>
              <View style={styles.rowEnd}><Btn kind="next" label="Devam ▸" onPress={court.next} /></View>
            </View>
          )}

          {phase.k === "pass" && (() => {
            const side = c.steps[phase.step].side;
            return (
              <View style={styles.pass}>
                <Chip label="SIRA DEĞİŞİYOR" color={sideColor(side)} />
                <Text style={[styles.passName, { color: sideColor(side) }]}>{players[side].name}</Text>
                <Text style={styles.muted}>{c.sides[side].role}</Text>
                <Text style={styles.muted}>Cihazı bu oyuncuya verin.</Text>
                <Btn kind="next" label="Hazırım ▸" onPress={court.next} style={{ marginTop: 8 }} />
              </View>
            );
          })()}

          {phase.k === "choices" && (() => {
            const st = c.steps[phase.step];
            const kind = kindOf(st);
            const list = choicesOf(c, game, phase.step);
            const isAI = court.aiTurn;
            const pick = (ci: number, pos: number) => court.choose(ci, LETTERS[pos] || String(pos + 1));
            const pickedStyle = (ci: number) => [phase.aiPick === ci && styles.choicePicked, isAI && phase.aiPick !== ci && { opacity: 0.6 }];
            const asked = (game.asked[phase.step] || []).length;
            const limit = st.limit ?? st.choices.length;
            return (
              <View>
                {duel && <Chip label={`SIRA: ${players[st.side].name} · ${c.sides[st.side].role}`.toLocaleUpperCase("tr")} color={sideColor(st.side)} style={{ alignSelf: "flex-start", marginBottom: 8 }} />}

                {kind === "evidence" && st.statement && (
                  <View style={styles.statement}>
                    <Text style={styles.statementWho}>{speakerName(st.statement.who).name}</Text>
                    <Text style={styles.statementText}>“{st.statement.text}”</Text>
                  </View>
                )}
                {kind === "interview" && <Chip label={`SORU HAKKI: ${limit - asked} / ${limit}`} color={C.brass} style={{ alignSelf: "flex-start", marginBottom: 8 }} />}
                <Text style={styles.prompt}>{st.prompt}</Text>

                {kind === "evidence" && <Text style={styles.bagTitle}>DELİL ÇANTASI</Text>}
                {kind === "free" && !isAI && <FreeAnswer key={phase.step} c={c} step={st} onResult={court.chooseFree} />}
                {kind !== "free" && <View style={[styles.choices, wide && kind !== "interview" && styles.twoCol]}>
                  {phase.order.map((ci, pos) => {
                    const ch = list[ci];
                    if (!ch) return null;
                    // "İtiraz etmeden geç" ve "Görüşmeyi bitir" ayrı, sade bir düğme olarak en altta gösterilir.
                    if ((kind === "evidence" && !ch.evidence) || ch.finish) return null;
                    if (kind === "evidence" && ch.evidence) {
                      const ev = ch.evidence;
                      return (
                        <Pressable key={ci} accessibilityRole="button" accessibilityLabel={`Delil sun: ${ev.title}`} disabled={isAI} onPress={() => pick(ci, pos)}
                          style={({ pressed }) => [styles.evCard, wide && styles.half, pressed && styles.evPressed, phase.aiPick === ci && styles.evPicked, isAI && phase.aiPick !== ci && { opacity: 0.6 }]}>
                          <View style={styles.evHead}>
                            <Text style={styles.evType}>{ev.type === "kanun" ? "KANUN" : ev.type === "beyan" ? "BEYAN" : "BELGE"}</Text>
                            {!!ev.law && <Text style={styles.evLaw}>{ev.law}</Text>}
                          </View>
                          <Text style={styles.evTitle}>{ev.title}</Text>
                          <Text style={styles.evDesc}>{ev.desc}</Text>
                        </Pressable>
                      );
                    }
                    return (
                      <Pressable key={ci} accessibilityRole="button" accessibilityLabel={`${LETTERS[pos]}) ${ch.text}`} disabled={isAI} onPress={() => pick(ci, pos)}
                        style={({ pressed }) => [styles.choice, wide && kind !== "interview" && styles.half, pressed && styles.choicePressed, ...pickedStyle(ci)]}>
                        <View style={styles.key}><Text style={styles.keyText}>{kind === "interview" ? "?" : LETTERS[pos]}</Text></View>
                        <Text style={styles.choiceText}>{ch.text}</Text>
                      </Pressable>
                    );
                  })}
                </View>}
                {kind !== "choice" && kind !== "free" && (() => {
                  const ci = list.findIndex(ch => (kind === "evidence" && !ch.evidence) || ch.finish);
                  if (ci < 0) return null;
                  return (
                    <View style={styles.rowStart}>
                      <Btn kind="ghost" label={kind === "evidence" ? "İtiraz etmeden geç" : "Görüşmeyi bitir"} onPress={() => pick(ci, phase.order.indexOf(ci))} disabled={isAI} />
                    </View>
                  );
                })()}
                {!isAI && history.length > 0 && (
                  <View style={styles.rowStart}><Btn kind="ghost" label="‹ Önceki konuşmaları oku" onPress={() => setRecord(true)} /></View>
                )}
                {isAI && <Text style={styles.thinking}>{players[st.side].name} düşünüyor…</Text>}
              </View>
            );
          })()}

          {phase.k === "feedback" && last && (() => {
            const g = grade(last.delta);
            return (
              <View>
                <View style={styles.fbHead}>
                  {duel && <Chip label={c.sides[last.side].role + (last.ai ? " · Bilgisayar" : "")} color={sideColor(last.side)} />}
                  <Chip label={`${g.label} · ${last.delta > 0 ? "+" : ""}${last.delta} ${duel ? "puan" : "ikna"}`} color={toneColor(g.tone)} />
                  {!!last.law && <Chip label={last.law} color={C.brass} />}
                </View>
                {last.free ? (
                  <>
                    <Chip label={`DEĞERLENDİRME: ${last.free.score}/100 · ${last.free.band}`.toLocaleUpperCase("tr")} color={toneColor(g.tone)} style={{ alignSelf: "flex-start", marginBottom: 8 }} />
                    <Text style={styles.fbChoice}>Cevabınız: {last.text}</Text>
                  </>
                ) : <Text style={styles.fbChoice}>Seçim ({last.letter}): {last.text}</Text>}
                <Text style={styles.fbNote}>{last.note}</Text>
                {!!last.free?.model && <Text style={[styles.fbNote, { marginTop: 8, fontStyle: "italic" }]}>Örnek cevap: {last.free.model}</Text>}
                <View style={styles.rowEnd}><Btn kind="next" label={game.fatal || game.flags.end ? "Sonucu gör ▸" : "Devam ▸"} onPress={court.next} /></View>
              </View>
            );
          })()}
        </ScrollView>
      </View>

      <Modal visible={record} transparent animationType="fade" onRequestClose={() => setRecord(false)}>
        <Pressable style={styles.overlay} onPress={() => setRecord(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Duruşma tutanağı</Text>
            <Text style={styles.sheetSub}>{c.court} · {c.esas}</Text>
            <ScrollView style={{ maxHeight: 460 }} ref={r => { setTimeout(() => r?.scrollToEnd?.({ animated: false }), 0); }}>
              {history.map((h, i) => (
                <View key={i} style={[styles.sheetItem, h.karar && styles.recKarar]}>
                  <Text style={styles.sheetT}>{h.karar ? "KARAR" : speakerName(h.who).name}</Text>
                  <Text style={styles.sheetD}>{h.text}</Text>
                </View>
              ))}
            </ScrollView>
            <Btn kind="ghostInk" label="Kapat" onPress={() => setRecord(false)} style={{ alignSelf: "flex-start", marginTop: 14 }} />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={docs} transparent animationType="fade" onRequestClose={() => setDocs(false)}>
        <Pressable style={styles.overlay} onPress={() => setDocs(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Dosya</Text>
            <Text style={styles.sheetSub}>{c.court} · {c.esas}</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {c.docs.map(d => (
                <View key={d.t} style={styles.sheetItem}><Text style={styles.sheetT}>{d.t}</Text><Text style={styles.sheetD}>{d.d}</Text></View>
              ))}
              {bagOf(c, game.flags).length > 0 && (
                <>
                  <Text style={styles.sheetSection}>DELİL ÇANTASI</Text>
                  {bagOf(c, game.flags).map(e => (
                    <View key={e.id} style={styles.sheetItem}>
                      <Text style={styles.sheetT}>{e.title}{e.law ? `  ·  ${e.law}` : ""}</Text>
                      <Text style={styles.sheetD}>{e.desc}</Text>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
            <Btn kind="ghostInk" label="Kapat" onPress={() => setDocs(false)} style={{ alignSelf: "flex-start", marginTop: 14 }} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: "100%", maxWidth: 1080, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  topCase: { flex: 1, minWidth: 0 },
  court: { fontFamily: F.displayMed, fontSize: 17, color: C.text },
  esas: { fontFamily: F.mono, fontSize: 11, color: C.muted },
  scaleBox: { flexDirection: "row", alignItems: "center", gap: 4 },
  score: { fontFamily: F.monoBold, fontSize: 18, color: C.brass },
  scoreLabel: { fontFamily: F.mono, fontSize: 9, letterSpacing: 2, color: C.muted },
  stageWrap: { minHeight: 200 },
  panel: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 12, minHeight: 230 },
  panelInner: { padding: 16 },
  np: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  npText: { fontFamily: F.displayMed, fontSize: 15, color: C.text },
  npNarr: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: C.muted },
  dlg: { fontFamily: F.body, fontSize: 18, lineHeight: 27, color: C.text, minHeight: 54, maxWidth: 760 },
  dlgNarr: { fontFamily: F.bodyItalic, color: C.textSoft },
  rowEnd: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 12 },
  recKarar: { backgroundColor: "rgba(208,166,76,0.14)", paddingHorizontal: 8 },
  rowStart: { flexDirection: "row", justifyContent: "flex-start", marginTop: 12 },
  statement: { backgroundColor: C.panel2, borderLeftWidth: 4, borderLeftColor: C.bad, borderRadius: 6, padding: 12, marginBottom: 12, gap: 4 },
  statementWho: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: C.muted },
  statementText: { fontFamily: F.bodyItalic, fontSize: 17, lineHeight: 25, color: C.text },
  bagTitle: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: C.muted, marginBottom: 6 },
  evCard: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.rule, borderRadius: 6, padding: 12, gap: 3 },
  evPressed: { borderColor: C.brass },
  evPicked: { borderColor: C.bad, borderWidth: 2 },
  evHead: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  evType: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1.5, color: C.inkSoft },
  evLaw: { fontFamily: F.monoBold, fontSize: 11, color: C.wood },
  evTitle: { fontFamily: F.bodyBold, fontSize: 16, color: C.ink },
  evDesc: { fontFamily: F.body, fontSize: 14, lineHeight: 19, color: C.inkSoft },
  sheetSection: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: C.inkSoft, marginTop: 16, marginBottom: 2 },
  docGrid: { gap: 8, marginTop: 8 },
  twoCol: { flexDirection: "row", flexWrap: "wrap" },
  half: { width: "49%" },
  doc: { backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, gap: 2 },
  docT: { fontFamily: F.bodyBold, fontSize: 16, color: C.text },
  docD: { fontFamily: F.body, fontSize: 15, color: C.muted },
  pass: { alignItems: "center", gap: 6, paddingVertical: 8 },
  passName: { fontFamily: F.display, fontSize: 32 },
  muted: { fontFamily: F.body, fontSize: 16, color: C.muted },
  prompt: { fontFamily: F.displayMed, fontSize: 19, color: C.brass, marginBottom: 10 },
  choices: { gap: 8 },
  choice: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 11 },
  choicePressed: { borderColor: C.brassDim, backgroundColor: "#212b34" },
  choicePicked: { borderColor: C.brass, backgroundColor: "#2b2a20" },
  key: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: C.brassDim, alignItems: "center", justifyContent: "center" },
  keyText: { fontFamily: F.mono, fontSize: 12, color: C.brass },
  choiceText: { flex: 1, fontFamily: F.body, fontSize: 16, lineHeight: 22, color: C.text },
  thinking: { fontFamily: F.bodyItalic, fontSize: 15, color: C.muted, marginTop: 10 },
  fbHead: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  fbChoice: { fontFamily: F.body, fontSize: 15, color: C.muted, marginBottom: 6 },
  fbNote: { fontFamily: F.body, fontSize: 17, lineHeight: 25, color: C.text, maxWidth: 780 },
  overlay: { flex: 1, backgroundColor: "rgba(5,8,10,0.72)", alignItems: "center", justifyContent: "center", padding: 16 },
  sheet: { backgroundColor: C.paper, borderRadius: 4, padding: 22, width: "100%", maxWidth: 640 },
  sheetTitle: { fontFamily: F.display, fontSize: 24, color: C.ink },
  sheetSub: { fontFamily: F.mono, fontSize: 12, color: C.inkSoft, marginBottom: 12 },
  sheetItem: { borderTopWidth: 1, borderTopColor: C.rule, paddingVertical: 10, gap: 2 },
  sheetT: { fontFamily: F.bodyBold, fontSize: 16, color: C.ink },
  sheetD: { fontFamily: F.body, fontSize: 15, color: C.inkSoft }
});
