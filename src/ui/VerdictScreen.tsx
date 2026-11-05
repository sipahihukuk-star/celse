import React, { useEffect, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { GameState, grade, rank, verdict, Verdict } from "../engine/engine";
import { CaseFile } from "../engine/types";
import { AiVerdict } from "../engine/judge";
import { Btn, Chip } from "./kit";
import { saveResult } from "./storage";
import { stateCourt } from "./PhotoStage";
import { C, F, sideColor, sideInk, toneColor } from "./theme";
import { locale, t } from "../i18n";

/** Kanun yolu kutusu: başvuru düğmesi ya da "Bu karar kesindir: …" açıklaması. */
export interface AppealPanel { text: string; button?: string; onPress?: () => void; closed?: boolean }
interface Props { c: CaseFile; game: GameState; onRetry?: () => void; onBack: () => void; backLabel?: string; notice?: string; ai?: AiVerdict; appeal?: AppealPanel }

const TAIL = " istinaf yolu açık olmak üzere verilen karar açıkça okunup usulen anlatıldı.";
const cap = (s: string) => { const l = s.toLocaleLowerCase(locale()); return l.charAt(0).toLocaleUpperCase(locale()) + l.slice(1); };

/** Motorun ürettiği damga ve başlık (Türkçe) ekranda seçili dile çevrilir; davaya özgü damgalar olduğu gibi kalır. */
function localStamp(c: CaseFile, v: Verdict): string {
  if (v.stamp === "KAZANDINIZ") return t("KAZANDINIZ");
  if (v.stamp === "KAYBETTİNİZ") return t("KAYBETTİNİZ");
  if (v.stamp === "SULH") return t("SULH");
  if (v.winner !== "draw" && v.stamp === `${c.sides[v.winner].short.toLocaleUpperCase("tr")} KAZANDI`)
    return t("{taraf} KAZANDI", { taraf: c.sides[v.winner].short.toLocaleUpperCase(locale()) });
  return v.stamp;
}
const localLabel = (l: string) => (l === "HÜKÜM:" ? t("HÜKÜM:") : l);
const rankLabel = (score: number) => {
  const r = rank(score);
  return r === "Kıdemli avukat" ? t("Kıdemli avukat") : r === "Deneyimli avukat" ? t("Deneyimli avukat") : r === "Genç avukat" ? t("Genç avukat") : r === "Stajyer avukat" ? t("Stajyer avukat") : r;
};

export default function VerdictScreen({ c, game, onRetry, onBack, backLabel, notice, ai, appeal }: Props) {
  const v = useMemo(() => {
    const v0 = verdict(c, game);
    const base = { ...v0, stamp: localStamp(c, v0), label: localLabel(v0.label) };
    if (!ai) return base;
    // Yapay zekâ hâkimin kararı (karşılıklı duruşma): kazanan, hüküm ve gerekçe ondan gelir.
    const winner = ai.winner === "sulh" ? "draw" as const : ai.winner;
    return { ...base, winner, label: t("HÜKÜM:"), hukum: ai.hukum || base.hukum, summary: ai.gerekce || base.summary,
      stamp: winner === "draw" ? t("SULH") : t("{taraf} KAZANDI", { taraf: c.sides[winner].short.toLocaleUpperCase(locale()) }) };
  }, [c, game, ai]);
  const duel = c.mode === "duel";
  const arb = c.room === "tahkim" && !stateCourt(c);
  const P = game.players;
  const stampColor = v.winner === "draw" ? C.draw : duel || v.winner === "p1" ? C.win : C.lose;

  useEffect(() => {
    const tone = v.winner === "draw" ? "draw" : duel || v.winner === "p1" ? "win" : "lose";
    // Kanun yolu aşamasının sonucu, listelerde ana davanın sonucu olarak görünür.
    saveResult(c.appealOf?.id || c.id, { text: duel ? cap(v.stamp) : `${cap(v.stamp)} · ${game.score}`, tone });
  }, []);

  const leader = game.pts.p1 === game.pts.p2 ? null : game.pts.p1 > game.pts.p2 ? "p1" : "p2";

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.karar}>
        {/* Tahkim kararlarında "T.C." başlığı yok; Türkiye'deki kurul ve komisyonlarda vardır. */}
        {(!arb || c.forum === "tff" || c.forum === "ihtk" || c.forum === "sigorta" || c.forum === "baro") && <Text style={styles.head}>T.C.</Text>}
        <Text style={styles.courtName}>{c.court.toLocaleUpperCase(locale())}</Text>
        <Text style={styles.sub}>{arb ? t(c.forum === "ihtk" ? "KOMİSYON KARARI" : c.forum === "baro" ? "DİSİPLİN KURULU KARARI" : c.forum === "tff" ? "TAHKİM KURULU KARARI" : "HAKEM KARARI")
          : c.appealOf ? t(c.appealOf.kind === "temyiz" ? "TEMYİZ İNCELEMESİ" : "İSTİNAF İNCELEMESİ") : t("KISA KARAR")}</Text>

        <View style={styles.meta}>
          <Meta k={t("Esas No")} v={c.esas} />
          <Meta k={t("Karar Tarihi")} v={c.kararTarihi} />
          {duel ? (<><Meta k={c.sides.p1.role} v={P.p1.name} /><Meta k={c.sides.p2.role} v={P.p2.name} /></>) : <Meta k={t("Rolünüz")} v={c.sides.p1.role} />}
        </View>

        <Text style={styles.hukum}><Text style={styles.label}>{v.label} </Text>{v.hukum}{v.noCourt || arb ? "" : t(TAIL)}</Text>
        <View style={[styles.stamp, { borderColor: stampColor }]}><Text style={[styles.stampText, { color: stampColor }]}>{v.stamp}</Text></View>
        {duel && <Text style={styles.galip}>{v.winner === "draw" ? t("Taraflar uzlaştı.") : t("Davayı kazanan: {ad} · {rol}", { ad: P[v.winner].name, rol: c.sides[v.winner].role })}</Text>}
        {ai && <Text style={styles.label}>{ai.by === "ai" ? (arb ? t("YAPAY ZEKÂ HAKEMİN GEREKÇESİ") : t("YAPAY ZEKÂ HÂKİMİN GEREKÇESİ")) : t("GEREKÇE")}</Text>}
        <Text style={styles.summary}>{v.summary}</Text>

        <View style={styles.scores}>
          {duel ? (["p1", "p2"] as const).map(s => (
            <View key={s} style={styles.scoreCell}>
              <Text style={styles.metaK}>{c.sides[s].role}</Text>
              <Text style={[styles.scoreBig, { color: sideInk(s) }]}>{ai ? `${ai[s]}/100` : t("{n} puan", { n: game.pts[s] })}</Text>
              <Text style={styles.metaV}>{P[s].name}</Text>
            </View>
          )) : (
            <>
              <View style={styles.scoreCell}><Text style={styles.metaK}>{t("Mahkemedeki ikna")}</Text><Text style={styles.scoreBig}>{game.score}/100</Text></View>
              <View style={styles.scoreCell}><Text style={styles.metaK}>{t("Değerlendirme")}</Text><Text style={styles.scoreBig}>{rankLabel(game.score)}</Text></View>
            </>
          )}
        </View>
        {duel && (
          <Text style={styles.lead}>
            {ai ? t("Duruşmadaki hamle puanları: {ad1} {p1}, {ad2} {p2}.", { ad1: P.p1.name, p1: game.pts.p1, ad2: P.p2.name, p2: game.pts.p2 })
                + (ai.by === "ai" ? " " + (arb ? t("Hakem hamleleri ve son sözleri birlikte değerlendirdi.") : t("Hâkim hamleleri ve son sözleri birlikte değerlendirdi.")) : "")
              : leader ? t("Hamle puanında önde: {ad}. Puan hamlelerin hukuki isabetini ölçer; davanın sonucu kilit hamlelere bağlıdır.", { ad: P[leader].name }) : t("Hamle puanları eşit.")}
          </Text>
        )}
      </View>

      {!!notice && (
        <View style={styles.notice} accessibilityRole="alert">
          <Text style={styles.noticeK}>{t("KARİYER")}</Text>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      )}

      {!!appeal && (
        <View style={[styles.notice, styles.appeal, appeal.closed && styles.appealClosed]}>
          <Text style={styles.noticeK}>{t("KANUN YOLU")}{c.appealOf?.basic ? " · " + t("TEMEL AŞAMA") : ""}</Text>
          <Text style={styles.noticeText}>{appeal.text}</Text>
          {!!appeal.button && !!appeal.onPress && <Btn label={appeal.button} onPress={appeal.onPress} style={{ alignSelf: "flex-start", marginTop: 6 }} />}
        </View>
      )}

      <View style={styles.actions}>
        {onRetry && <Btn kind={appeal?.button ? "ghost" : "primary"} label={t("Davayı yeniden oyna")} onPress={onRetry} />}
        <Btn kind="ghost" label={backLabel || t("Dosya dolabına dön")} onPress={onBack} />
      </View>

      <View style={styles.log}>
        <Text style={styles.logTitle}>{t("Duruşma kaydı")}</Text>
        {game.log.map((l, i) => {
          const g = grade(l.delta);
          return (
            <View key={i} style={styles.lg}>
              <View style={styles.lgTop}>
                {duel && <Chip label={c.sides[l.side].role + (l.ai ? " · " + t("Bilgisayar") : "")} color={sideColor(l.side)} />}
                <Text style={styles.lgQ}>{l.prompt}</Text>
              </View>
              <View style={styles.lgA}>
                <Text style={[styles.lgD, { color: toneColor(g.tone) }]}>{l.delta > 0 ? "+" : ""}{l.delta}</Text>
                <Text style={styles.lgText}>{l.letter}) {t(l.text)}</Text>
              </View>
              {!!l.note && <Text style={styles.lgNote}>{t(l.note)}{l.law ? <Text style={{ fontFamily: F.bodyBold }}> ({l.law})</Text> : null}</Text>}
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
  notice: { width: "100%", marginTop: 16, borderWidth: 1, borderColor: C.brass, backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 8, padding: 14, gap: 4 },
  noticeK: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: C.brass },
  noticeText: { fontFamily: F.bodyMed, fontSize: 17, color: C.text },
  appeal: { borderColor: C.brassDim, backgroundColor: C.panel2 },
  appealClosed: { borderColor: C.line, backgroundColor: C.panel },
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
