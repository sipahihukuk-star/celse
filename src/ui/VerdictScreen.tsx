import React, { useEffect, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { GameState, grade, rank, verdict } from "../engine/engine";
import { CaseFile } from "../engine/types";
import { Btn, Chip } from "./kit";
import { saveResult } from "./storage";
import { C, F, sideColor, sideInk, toneColor } from "./theme";

interface Props { c: CaseFile; game: GameState; onRetry: () => void; onBack: () => void }

const TAIL = " istinaf yolu açık olmak üzere verilen karar açıkça okunup usulen anlatıldı.";
const cap = (s: string) => { const l = s.toLocaleLowerCase("tr"); return l.charAt(0).toLocaleUpperCase("tr") + l.slice(1); };

export default function VerdictScreen({ c, game, onRetry, onBack }: Props) {
  const v = useMemo(() => verdict(c, game), [c, game]);
  const duel = c.mode === "duel";
  const P = game.players;
  const stampColor = v.winner === "draw" ? C.draw : duel || v.winner === "p1" ? C.win : C.lose;

  useEffect(() => {
    const tone = v.winner === "draw" ? "draw" : duel || v.winner === "p1" ? "win" : "lose";
    saveResult(c.id, { text: duel ? cap(v.stamp) : `${cap(v.stamp)} · ${game.score}`, tone });
  }, []);

  const leader = game.pts.p1 === game.pts.p2 ? null : game.pts.p1 > game.pts.p2 ? "p1" : "p2";

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.karar}>
        <Text style={styles.head}>T.C.</Text>
        <Text style={styles.courtName}>{c.court.toLocaleUpperCase("tr")}</Text>
        <Text style={styles.sub}>KISA KARAR</Text>

        <View style={styles.meta}>
          <Meta k="Esas No" v={c.esas} />
          <Meta k="Karar Tarihi" v={c.kararTarihi} />
          {duel ? (<><Meta k={c.sides.p1.role} v={P.p1.name} /><Meta k={c.sides.p2.role} v={P.p2.name} /></>) : <Meta k="Rolünüz" v={c.sides.p1.role} />}
        </View>

        <Text style={styles.hukum}><Text style={styles.label}>{v.label} </Text>{v.hukum}{v.noCourt ? "" : TAIL}</Text>
        <View style={[styles.stamp, { borderColor: stampColor }]}><Text style={[styles.stampText, { color: stampColor }]}>{v.stamp}</Text></View>
        {duel && <Text style={styles.galip}>{v.winner === "draw" ? "Taraflar uzlaştı." : `Davayı kazanan: ${P[v.winner].name} · ${c.sides[v.winner].role}`}</Text>}
        <Text style={styles.summary}>{v.summary}</Text>

        <View style={styles.scores}>
          {duel ? (["p1", "p2"] as const).map(s => (
            <View key={s} style={styles.scoreCell}>
              <Text style={styles.metaK}>{c.sides[s].role}</Text>
              <Text style={[styles.scoreBig, { color: sideInk(s) }]}>{game.pts[s]} puan</Text>
              <Text style={styles.metaV}>{P[s].name}</Text>
            </View>
          )) : (
            <>
              <View style={styles.scoreCell}><Text style={styles.metaK}>Mahkemedeki ikna</Text><Text style={styles.scoreBig}>{game.score}/100</Text></View>
              <View style={styles.scoreCell}><Text style={styles.metaK}>Değerlendirme</Text><Text style={styles.scoreBig}>{rank(game.score)}</Text></View>
            </>
          )}
        </View>
        {duel && (
          <Text style={styles.lead}>
            {leader ? `Hamle puanında önde: ${P[leader].name}. Puan hamlelerin hukuki isabetini ölçer; davanın sonucu kilit hamlelere bağlıdır.` : "Hamle puanları eşit."}
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        <Btn label="Davayı yeniden oyna" onPress={onRetry} />
        <Btn kind="ghost" label="Dosya dolabına dön" onPress={onBack} />
      </View>

      <View style={styles.log}>
        <Text style={styles.logTitle}>Duruşma kaydı</Text>
        {game.log.map((l, i) => {
          const g = grade(l.delta);
          return (
            <View key={i} style={styles.lg}>
              <View style={styles.lgTop}>
                {duel && <Chip label={c.sides[l.side].role + (l.ai ? " · Bilgisayar" : "")} color={sideColor(l.side)} />}
                <Text style={styles.lgQ}>{l.prompt}</Text>
              </View>
              <View style={styles.lgA}>
                <Text style={[styles.lgD, { color: toneColor(g.tone) }]}>{l.delta > 0 ? "+" : ""}{l.delta}</Text>
                <Text style={styles.lgText}>{l.letter}) {l.text}</Text>
              </View>
              {!!l.note && <Text style={styles.lgNote}>{l.note}{l.law ? <Text style={{ fontFamily: F.bodyBold }}> ({l.law})</Text> : null}</Text>}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return <View style={styles.metaCell}><Text style={styles.metaK}>{k}</Text><Text style={styles.metaV}>{v}</Text></View>;
}

const styles = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 800, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 20 },
  karar: { backgroundColor: C.paper, borderRadius: 4, padding: 24 },
  head: { textAlign: "center", fontFamily: F.display, fontSize: 15, color: C.ink, letterSpacing: 1 },
  courtName: { textAlign: "center", fontFamily: F.display, fontSize: 20, color: C.ink, letterSpacing: 1 },
  sub: { textAlign: "center", fontFamily: F.mono, fontSize: 11, color: C.inkSoft, letterSpacing: 2, marginTop: 4 },
  meta: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.rule, paddingVertical: 10, marginVertical: 20, rowGap: 10 },
  metaCell: { width: "50%", paddingRight: 8 },
  metaK: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1.5, color: C.inkSoft, textTransform: "uppercase" },
  metaV: { fontFamily: F.bodyMed, fontSize: 16, color: C.ink },
  hukum: { fontFamily: F.body, fontSize: 18, lineHeight: 28, color: C.ink, marginBottom: 16 },
  label: { fontFamily: F.display, letterSpacing: 1 },
  stamp: { alignSelf: "flex-start", borderWidth: 3, borderRadius: 6, paddingHorizontal: 16, paddingVertical: 6, transform: [{ rotate: "-6deg" }], marginVertical: 6 },
  stampText: { fontFamily: F.display, fontSize: 22, letterSpacing: 3 },
  galip: { fontFamily: F.bodyMed, fontSize: 16, color: C.ink, marginTop: 10 },
  summary: { fontFamily: F.body, fontSize: 16, lineHeight: 24, color: "#3a3f45", marginTop: 10, marginBottom: 18 },
  scores: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderTopColor: C.rule, paddingTop: 14, rowGap: 12 },
  scoreCell: { width: "50%", paddingRight: 8 },
  scoreBig: { fontFamily: F.display, fontSize: 22, color: C.ink },
  lead: { fontFamily: F.body, fontSize: 14, color: C.inkSoft, marginTop: 12 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center", marginVertical: 22 },
  log: { gap: 10 },
  logTitle: { fontFamily: F.display, fontSize: 20, color: C.brass, marginBottom: 2 },
  lg: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, gap: 6 },
  lgTop: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  lgQ: { fontFamily: F.displayMed, fontSize: 15, color: C.muted, flexShrink: 1 },
  lgA: { flexDirection: "row", gap: 10 },
  lgD: { fontFamily: F.monoBold, fontSize: 15, minWidth: 30 },
  lgText: { flex: 1, fontFamily: F.body, fontSize: 15, color: C.text },
  lgNote: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: "#c7c3b8" }
});
