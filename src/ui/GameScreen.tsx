import React, { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useKeyboardOpen } from "./keyboard";
import { bagOf, choicesOf, GameState, grade, kindOf } from "../engine/engine";
import { CaseFile, Line, Player, Side } from "../engine/types";
import { Btn, Chip, Scale } from "./kit";
import PhotoStage, { cast } from "./PhotoStage";
import { speakerId } from "./castFaces";
import { adaptPlayerAddress } from "./castText";
import { useCharacterState } from "../data/character";
import { useOffice } from "../data/office";
import Stage from "./Stage";
import { useViewMode } from "./viewMode";
import { C, F, sideColor, toneColor } from "./theme";
import { LETTERS, OnlineLink, useCourt } from "./useCourt";
import { prefetchLines, Speaker, speakLine, stopSpeaking, useSpeaking, useVoiceEnabled } from "./voice";
import FreeAnswer from "./FreeAnswer";
import { DeadlineAnswer, PetitionPaper } from "./AppealParts";
import { getLang, locale, t } from "../i18n";
import { BugReportLink, BugReportModal } from "./BugReport";
import { APP_VERSION } from "../data/usage";
import type { TutanakSatiri } from "../data/danismaDosya";

/** onFinish'in ikinci değeri ekrandaki duruşma tutanağıdır (danışma dosyalarının oyun kaydı için; danismaDosya.ts kayitOf). */
interface Props { c: CaseFile; players: Record<Side, Player>; onExit: () => void; onFinish: (g: GameState, tutanak: TutanakSatiri[]) => void; online?: OnlineLink }

/** Motorun hamle değerlendirme etiketi (Türkçe) seçili dile çevrilir. */
const gradeLabel = (l: string) =>
  l === "Yerinde hamle" ? t("Yerinde hamle") : l === "Kabul edilebilir" ? t("Kabul edilebilir") : l === "Etkisiz hamle" ? t("Etkisiz hamle") : l === "Hatalı hamle" ? t("Hatalı hamle") : l;

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

export default function GameScreen(props: Props) {
  const { office, ready } = useOffice();
  const me = useCharacterState();
  // Her karakterin yüzü (ve sesi) davanın kadrosundan seçilir; oyuncunun yüzü büroda seçtiği karakterdir.
  // Karşılıklı davada oyuncunun tarafı: internetten oynanıyorsa kendi tarafı, bilgisayara karşı ise insan olan taraf.
  const mySide = props.online?.mySide ?? (props.players.p1.ai && !props.players.p2.ai ? "p2" : "p1");
  const faces = useMemo(() => cast(props.c, office?.avatar || me.character?.avatar, mySide), [props.c, office?.avatar, me.character?.avatar, mySide]);
  // Oyuncunun avukatına "Avukat Hanım / Bey" hitabı, sahnedeki yüzünün cinsiyetine uyarlanır (kime yöneldiği belli
  // olmayan avukat hitabı "Sayın Avukat" olur). Satırlar, seçenekler, notlar ve seslendirme aynı metni kullanır.
  const playerFemale = (faces[props.c.mode === "duel" ? mySide : "p1"] || "").includes("kadin");
  const c = useMemo(() => adaptPlayerAddress(props.c, playerFemale), [props.c, playerFemale]);
  // Duruşma akışı ilk satırları başlangıçta alır: karakter yüklenmeden başlarsa hitap yanlış cinsiyetle kalırdı.
  if (!ready || !me.ready) return <View style={styles.root} />;
  return <Game {...props} c={c} faces={faces} />;
}

function Game({ c, players, onExit, onFinish, online, faces }: Props & { faces: Record<string, string> }) {
  // Tutanak, oyun bitince karar ekranına giderken onFinish ile verilir (en güncel hâli ref'ten okunur).
  const tutanakRef = useRef<TutanakSatiri[]>([]);
  const court = useCourt(c, players, g => onFinish(g, tutanakRef.current), online);
  const { game, phase, scene } = court;
  const { width, height } = useWindowDimensions();
  const [docs, setDocs] = useState(false);
  const [record, setRecord] = useState(false);
  const [bug, setBug] = useState(false);
  // Duruşma tutanağı: gösterilen her satır ve verilen her karar, sırasıyla.
  const [history, setHistory] = useState<TutanakSatiri[]>([]);
  tutanakRef.current = history;
  // Tutanak açıldığında bir kez en sona kaydırılır; sonra oyuncu serbestçe yukarı aşağı gezer.
  const recScrolled = useRef(false);
  const seen = useRef(new WeakMap<object, number>());
  const duel = c.mode === "duel";
  const wide = width >= 860;

  const line: Line | null = phase.k === "lines" ? phase.lines[phase.i] : null;
  const tw = useTypewriter(line ? line.text : "");

  const speakerName = (who: string) => {
    if (who === "narr") return { name: t("Dosya notu"), dot: C.muted };
    if (who === "mubasir") return { name: t("Mübaşir"), dot: C.muted };
    if (who === "p1" || who === "p2") return { name: `${players[who].name} · ${c.sides[who].role}`, dot: sideColor(who) };
    const m = c.cast[who];
    if (!m && who === "karsi") return { name: t("Karşı taraf"), dot: C.brass };
    if (!m && (who === "party_p1" || who === "party_p2")) return { name: c.sides[who === "party_p1" ? "p1" : "p2"].short, dot: C.brass };
    return { name: m?.name || who, dot: m?.np === "red" ? "#c2343c" : m?.np === "green" ? "#2f9a66" : C.brass };
  };

  let focus: string | null = null;
  if (line && line.who !== "narr") focus = line.who;
  if (phase.k === "choices" || phase.k === "pass") focus = duel ? c.steps[phase.step].side : scene === "court" ? "p1" : null;

  // Terazi açısı ve puan
  const angle = duel ? -Math.max(-60, Math.min(60, game.pts.p1 - game.pts.p2)) / 60 * 15 : -(game.score - 50) / 50 * 15;
  const last = game.log[game.log.length - 1];

  const scroller = useRef<any>(null);
  const recRef = useRef<any>(null);
  useEffect(() => { scroller.current?.scrollTo({ y: 0, animated: false }); }, [phase]);

  const tapLine = () => (tw.done ? court.next() : tw.finish());

  useEffect(() => {
    if (phase.k !== "lines" || !line) return;
    const max = seen.current.get(phase.lines) ?? -1;
    if (phase.i > max) { seen.current.set(phase.lines, phase.i); setHistory(h => [...h, { who: line.who, text: line.text, scene }]); }
  }, [phase]);
  useEffect(() => {
    const e = game.log[game.log.length - 1];
    if (e) setHistory(h => [...h, { who: e.side, text: `${c.sides[e.side].short}: ${e.text}`, karar: true, scene },
      ...(e.note ? [{ who: "narr", text: (e.law ? e.law + " · " : "") + t(e.note), not: true, scene }] : [])]);
  }, [game.log.length]);

  // Seslendirme: her yeni satır, soru ve geri bildirim okunur.
  const [voiceOn, setVoiceOn] = useVoiceEnabled();
  const [viewMode] = useViewMode();
  const speaking = useSpeaking();
  // Her karakterin sesi, sahnede görünen yüzün cinsiyetine göre seçilir; oyuncunun sesi bütün davalarda aynıdır.
  const speaker = (who: string): Speaker => who === "narr" ? { id: "narr", role: "narr", female: false }
    : { id: speakerId(c, who, faces[who] || "", duel), role: who, female: (faces[who] || "").includes("kadin") };
  // Sıradaki üç satırı önceden seslendir.
  useEffect(() => {
    if (!voiceOn || phase.k !== "lines") return;
    prefetchLines(phase.lines.slice(phase.i + 1, phase.i + 4).map(l => ({ text: l.text, speaker: speaker(l.who) })));
  }, [phase, voiceOn]);
  useEffect(() => {
    if (!voiceOn) return;
    if (phase.k === "lines" && line) speakLine(line.text, speaker(line.who));
    else if (phase.k === "choices" && !court.aiTurn) { const pr = c.steps[phase.step].prompt; if (pr) speakLine(pr, "narr"); }
    else if (phase.k === "feedback" && last) speakLine(last.note || "", "narr");
  }, [phase, voiceOn]);
  useEffect(() => () => { stopSpeaking(); }, []);
  const kbOpen = useKeyboardOpen();

  // Hata bildirimi: hangi adımda ve hangi satırdayken bildirildiği kendiliğinden eklenir.
  const stepIdx: number | null = "step" in phase ? phase.step : phase.k === "lines" && "step" in phase.after ? phase.after.step : null;
  const bugContext = () => {
    const shownText = line ? line.text : phase.k === "choices" ? c.steps[phase.step].prompt : phase.k === "feedback" && last ? last.note || last.text : "";
    return {
      dava: c.title, mahkeme: c.court, esas: c.esas, bicim: c.mode, asama: phase.k, adim: stepIdx,
      satir_no: phase.k === "lines" ? phase.i : null, konusan: line ? speakerName(line.who).name : null,
      satir: (typeof shownText === "string" ? shownText : "").slice(0, 1200),
      puan: duel ? game.pts : game.score, hamle: game.log.length,
      surum: APP_VERSION, platform: Platform.OS, dil: getLang(), gorunum: viewMode, ekran: `${Math.round(width)}x${Math.round(height)}`
    };
  };
  const bugFromDocs = () => { setDocs(false); setTimeout(() => setBug(true), Platform.OS === "web" ? 0 : 400); };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.top}>
        <Btn kind="ghost" label={t("‹ Dosyalar")} onPress={onExit} />
        <View style={styles.topCase}>
          <Text style={styles.court} numberOfLines={1}>{c.court}</Text>
          <Text style={styles.esas} numberOfLines={1}>{duel ? `${c.esas} · ${c.sides.p1.short} ⇄ ${c.sides.p2.short}` : `${c.esas} · ${c.sides.p1.role}`}</Text>
        </View>
        <Btn kind="ghost" label={voiceOn ? "🔊" : "🔇"} onPress={() => setVoiceOn(!voiceOn)} />
        <Btn kind="ghost" label={t("Dosya")} onPress={() => setDocs(true)} />
        <View style={styles.scaleBox}>
          <Scale angle={angle} size={width < 480 ? 56 : 80} left={duel ? C.p1 : C.brass} right={duel ? C.p2 : C.brass} />
          {duel ? (
            <Text style={styles.score}><Text style={{ color: C.p1 }}>{game.pts.p1}</Text><Text style={{ color: C.muted }}>:</Text><Text style={{ color: C.p2 }}>{game.pts.p2}</Text></Text>
          ) : (
            <View><Text style={styles.scoreLabel}>{t("İKNA")}</Text><Text style={styles.score}>{game.score}</Text></View>
          )}
        </View>
      </View>

      {/* Telefonda klavye açıkken sahne küçülür; yazı alanı ve "Cevabı sun" düğmesi görünür kalır. */}
      <View style={[styles.stageWrap, { flex: wide ? 1.5 : 1 }, kbOpen && !wide && { flex: 0.35 }]}>
        {viewMode === "gercek"
          ? <PhotoStage c={c} scene={scene} focus={focus} talking={!!line && (voiceOn ? speaking || !tw.done : true)}
              say={line && phase.k === "lines" ? { id: `${game.log.length}-${phase.i}-${line.text.length}`, text: line.text, voice: voiceOn } : undefined} />
          : <Stage c={c} scene={scene} focus={focus} talking={!!line && !tw.done} />}
      </View>

      <View style={[styles.panel, { flex: wide ? 0.85 : 1 }]}>
        <ScrollView ref={scroller} contentContainerStyle={styles.panelInner} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {phase.k === "lines" && line && (
            <Pressable onPress={tapLine} accessibilityRole="button" accessibilityLabel={t("Devam")}>
              <View style={styles.np}><View style={[styles.dot, { backgroundColor: speakerName(line.who).dot }]} /><Text style={line.who === "narr" ? styles.npNarr : styles.npText}>{speakerName(line.who).name}</Text></View>
              <Text style={[styles.dlg, line.who === "narr" && styles.dlgNarr]}>{tw.shown}</Text>
              <View style={styles.rowBetween}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Btn kind="ghost" label={t("‹ Geri")} onPress={court.prev} disabled={phase.i === 0} />
                  <Btn kind="ghost" label={t("Tutanak")} onPress={() => setRecord(true)} disabled={history.length < 2} />
                </View>
                <Btn kind="next" label={t("Devam ▸")} onPress={tapLine} />
              </View>
            </Pressable>
          )}

          {phase.k === "docs" && (
            <View>
              <Text style={styles.npNarr}>{t("DOSYADAKİ BELGELER")}</Text>
              <View style={[styles.docGrid, wide && styles.twoCol]}>
                {c.docs.map(d => (
                  <View key={d.t} style={[styles.doc, wide && styles.half]}><Text style={styles.docT}>{d.t}</Text><Text style={styles.docD}>{d.d}</Text></View>
                ))}
              </View>
              <View style={styles.rowEnd}><Btn kind="next" label={t("Devam ▸")} onPress={court.next} /></View>
            </View>
          )}

          {phase.k === "pass" && (() => {
            const side = c.steps[phase.step].side;
            return (
              <View style={styles.pass}>
                <Chip label={t("SIRA DEĞİŞİYOR")} color={sideColor(side)} />
                <Text style={[styles.passName, { color: sideColor(side) }]}>{players[side].name}</Text>
                <Text style={styles.muted}>{c.sides[side].role}</Text>
                <Text style={styles.muted}>{t("Cihazı bu oyuncuya verin.")}</Text>
                <Btn kind="next" label={t("Hazırım ▸")} onPress={court.next} style={{ marginTop: 8 }} />
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
                {duel && <Chip label={t("SIRA: {ad} · {rol}", { ad: players[st.side].name, rol: c.sides[st.side].role }).toLocaleUpperCase(locale())} color={sideColor(st.side)} style={{ alignSelf: "flex-start", marginBottom: 8 }} />}

                {kind === "evidence" && st.statement && (
                  <View style={styles.statement}>
                    <Text style={styles.statementWho}>{speakerName(st.statement.who).name}</Text>
                    <Text style={styles.statementText}>“{st.statement.text}”</Text>
                  </View>
                )}
                {kind === "interview" && <Chip label={t("SORU HAKKI: {kalan} / {limit}", { kalan: limit - asked, limit })} color={C.brass} style={{ alignSelf: "flex-start", marginBottom: 8 }} />}
                <Text style={styles.prompt}>{st.prompt}</Text>

                {kind === "evidence" && <Text style={styles.bagTitle}>{t("DELİL ÇANTASI")}</Text>}
                {kind === "free" && !isAI && <FreeAnswer key={phase.step} c={c} step={st} onResult={court.chooseFree} />}
                {/* Kanun yolu: oyuncu süre son gününü yazar; dilekçe önizlemesinde tek hamle "sun"dur. */}
                {kind === "date" && !isAI && <DeadlineAnswer key={phase.step} c={c} step={st} onResult={court.chooseFree} />}
                {kind === "dilekce" && <PetitionPaper c={c} game={game} stepIdx={phase.step} name={players.p1.name} onSubmit={() => pick(0, 0)} />}
                {kind !== "free" && kind !== "date" && kind !== "dilekce" && <View style={[styles.choices, wide && kind !== "interview" && styles.twoCol]}>
                  {phase.order.map((ci, pos) => {
                    const ch = list[ci];
                    if (!ch) return null;
                    // "İtiraz etmeden geç" ve "Görüşmeyi bitir" ayrı, sade bir düğme olarak en altta gösterilir.
                    if ((kind === "evidence" && !ch.evidence) || ch.finish) return null;
                    if (kind === "evidence" && ch.evidence) {
                      const ev = ch.evidence;
                      return (
                        <Pressable key={ci} accessibilityRole="button" accessibilityLabel={t("Delil sun: {delil}", { delil: ev.title })} disabled={isAI} onPress={() => pick(ci, pos)}
                          style={({ pressed }) => [styles.evCard, wide && styles.half, pressed && styles.evPressed, phase.aiPick === ci && styles.evPicked, isAI && phase.aiPick !== ci && { opacity: 0.6 }]}>
                          <View style={styles.evHead}>
                            <Text style={styles.evType}>{ev.type === "kanun" ? t("KANUN") : ev.type === "beyan" ? t("BEYAN") : t("BELGE")}</Text>
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
                {(kind === "evidence" || kind === "interview") && (() => {
                  const ci = list.findIndex(ch => (kind === "evidence" && !ch.evidence) || ch.finish);
                  if (ci < 0) return null;
                  return (
                    <View style={styles.rowStart}>
                      <Btn kind="ghost" label={kind === "evidence" ? t("İtiraz etmeden geç") : t("Görüşmeyi bitir")} onPress={() => pick(ci, phase.order.indexOf(ci))} disabled={isAI} />
                    </View>
                  );
                })()}
                {!isAI && history.length > 0 && (
                  <View style={styles.rowStart}><Btn kind="ghost" label={t("‹ Önceki konuşmaları oku")} onPress={() => setRecord(true)} /></View>
                )}
                {isAI && <Text style={styles.thinking}>{court.remoteTurn ? t("{ad} hamlesini düşünüyor (internet üzerinden)…", { ad: players[st.side].name }) : t("{ad} düşünüyor…", { ad: players[st.side].name })}</Text>}
              </View>
            );
          })()}

          {phase.k === "feedback" && last && (() => {
            const g = grade(last.delta);
            return (
              <View>
                <View style={styles.fbHead}>
                  {duel && <Chip label={c.sides[last.side].role + (last.ai ? " · " + t("Bilgisayar") : "")} color={sideColor(last.side)} />}
                  <Chip label={`${gradeLabel(g.label)} · ${last.delta > 0 ? "+" : ""}${last.delta} ${duel ? t("puan") : t("ikna")}`} color={toneColor(g.tone)} />
                  {!!last.law && <Chip label={last.law} color={C.brass} />}
                </View>
                {last.free ? (
                  <>
                    <Chip label={t("DEĞERLENDİRME: {puan}/100 · {sonuc}", { puan: last.free.score, sonuc: last.free.band }).toLocaleUpperCase(locale())} color={toneColor(g.tone)} style={{ alignSelf: "flex-start", marginBottom: 8 }} />
                    <Text style={styles.fbChoice}>{t("Cevabınız: {cevap}", { cevap: last.text })}</Text>
                  </>
                ) : <Text style={styles.fbChoice}>{t("Seçim ({harf}): {secim}", { harf: last.letter, secim: t(last.text) })}</Text>}
                <Text style={styles.fbNote}>{last.note ? t(last.note) : ""}</Text>
                {!!last.free?.model && <Text style={[styles.fbNote, { marginTop: 8, fontStyle: "italic" }]}>{t("Örnek cevap: {cevap}", { cevap: last.free.model })}</Text>}
                <View style={styles.rowEnd}><Btn kind="next" label={game.fatal || game.flags.end ? t("Sonucu gör ▸") : t("Devam ▸")} onPress={court.next} /></View>
              </View>
            );
          })()}
          <BugReportLink onPress={() => setBug(true)} />
        </ScrollView>
      </View>

      <Modal visible={record} transparent animationType="fade" onRequestClose={() => setRecord(false)} onShow={() => { recScrolled.current = false; }}>
        <View style={styles.overlay}>
          {/* Arka plana dokununca kapanır; kâğıt ayrı durur ki iPhone'da kaydırma dokunuşları yutulmasın. */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRecord(false)} accessibilityLabel={t("Kapat")} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t("Duruşma tutanağı")}</Text>
            <Text style={styles.sheetSub}>{c.court} · {c.esas}</Text>
            <ScrollView style={{ maxHeight: Math.max(240, height * 0.62) }} ref={recRef} showsVerticalScrollIndicator
              onContentSizeChange={() => { if (!recScrolled.current) { recScrolled.current = true; recRef.current?.scrollToEnd({ animated: false }); } }}>
              {history.map((h, i) => (
                <View key={i} style={[styles.sheetItem, h.karar && styles.recKarar, h.not && styles.recNot]}>
                  <Text style={[styles.sheetT, h.not && styles.recNotT]}>{h.karar ? t("KARAR") : h.not ? t("Hukukçu notu") : speakerName(h.who).name}</Text>
                  <Text style={[styles.sheetD, h.not && { fontStyle: "italic" }]}>{h.text}</Text>
                </View>
              ))}
            </ScrollView>
            <Btn kind="ghostInk" label={t("Kapat")} onPress={() => setRecord(false)} style={{ alignSelf: "flex-start", marginTop: 14 }} />
          </View>
        </View>
      </Modal>

      <Modal visible={docs} transparent animationType="fade" onRequestClose={() => setDocs(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDocs(false)} accessibilityLabel={t("Kapat")} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t("Dosya")}</Text>
            <Text style={styles.sheetSub}>{c.court} · {c.esas}</Text>
            <ScrollView style={{ maxHeight: Math.max(240, height * 0.62) }} showsVerticalScrollIndicator>
              {c.docs.map(d => (
                <View key={d.t} style={styles.sheetItem}><Text style={styles.sheetT}>{d.t}</Text><Text style={styles.sheetD}>{d.d}</Text></View>
              ))}
              {bagOf(c, game.flags).length > 0 && (
                <>
                  <Text style={styles.sheetSection}>{t("DELİL ÇANTASI")}</Text>
                  {bagOf(c, game.flags).map(e => (
                    <View key={e.id} style={styles.sheetItem}>
                      <Text style={styles.sheetT}>{e.title}{e.law ? `  ·  ${e.law}` : ""}</Text>
                      <Text style={styles.sheetD}>{e.desc}</Text>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
            <View style={styles.sheetActions}>
              <Btn kind="ghostInk" label={t("Kapat")} onPress={() => setDocs(false)} />
              <BugReportLink ink onPress={bugFromDocs} />
            </View>
          </View>
        </View>
      </Modal>

      <BugReportModal visible={bug} onClose={() => setBug(false)} davaId={c.id} adim={stepIdx} subtitle={`${c.court} · ${c.esas}`} context={bugContext} />
    </KeyboardAvoidingView>
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
  recNot: { borderTopWidth: 0, paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: C.rule, marginBottom: 4 },
  recNotT: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: C.inkSoft },
  recKarar: { backgroundColor: "rgba(255,255,255,0.11)", paddingHorizontal: 8 },
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
  sheetActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14 },
  sheetItem: { borderTopWidth: 1, borderTopColor: C.rule, paddingVertical: 10, gap: 2 },
  sheetT: { fontFamily: F.bodyBold, fontSize: 16, color: C.ink },
  sheetD: { fontFamily: F.body, fontSize: 15, color: C.inkSoft }
});
