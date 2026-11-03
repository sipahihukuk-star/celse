// Kariyer haritası: bölümler aşağıdan yukarıya değil, oyuncunun yolculuğu sırasıyla yukarıdan aşağıya dizilir.
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CareerCase, CareerChapter, CareerView, DIFFICULTY } from "../data/career";
import { CaseFile } from "../engine/types";
import { CITIES, feeFor, Office, sourceOf, SOURCE_LABEL, tl } from "../data/office";
import { AvatarFace } from "./OfficeScreen";
import { Btn } from "./kit";
import { C, F } from "./theme";
import { t } from "../i18n";

export default function CareerScreen({ view, onBack, onPick, onReset, onPaywall, premium, office, onOffice }: { office: Office | null; onOffice: () => void; view: CareerView; onBack: () => void; onPick: (c: CaseFile) => void; onReset: () => void; onPaywall: () => void; premium: boolean }) {
  const pct = view.total ? Math.round((view.won / view.total) * 100) : 0;
  const [confirm, setConfirm] = useState(false);
  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={s.head}>
        <Btn kind="ghost" label={t("‹ Giriş")} onPress={onBack} />
        <View style={{ flex: 1, minWidth: 220 }}>
          <Text style={s.eyebrow}>{t("KARİYER")}</Text>
          <Text style={s.rank}>{t(view.rank)}</Text>
          <Text style={s.next}>{view.next}</Text>
        </View>
        <View style={s.stats}>
          <Stat k={t("İtibar")} v={String(view.itibar)} />
          <Stat k={t("Kazanılan")} v={`${view.won}/${view.total}`} />
        </View>
      </View>
      {office && (
        <Pressable accessibilityRole="button" onPress={onOffice} style={s.office}>
          <AvatarFace k={office.avatar} size={40} />
          <Text style={s.officeT} numberOfLines={1}>{office.name} · {CITIES.find(c => c.id === office.city)?.name}</Text>
          <Text style={[s.officeCash, office.cash < 0 && { color: C.bad }]}>{tl(office.cash)} ›</Text>
        </Pressable>
      )}
      <View style={s.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
        <View style={[s.barFill, { width: `${pct}%` }]} />
      </View>

      {!premium && (
        <Pressable accessibilityRole="button" onPress={onPaywall} style={s.promo}>
          <Text style={s.promoT}>{t("İlk 5 dava ücretsiz.")}</Text>
          <Text style={s.promoD}>{t("Yargıtay'a, Danıştay'a, Anayasa Mahkemesi'ne, AİHM'e ve karşılıklı duruşmaya abonelikle devam edin · yıllık 5.000 TL ›")}</Text>
        </Pressable>
      )}
      <View style={{ gap: 18, marginTop: 22 }}>
        {view.chapters.map((ch, i) => <ChapterCard key={ch.level} ch={ch} no={i + 1} onPick={onPick} onPaywall={onPaywall} office={office} />)}
      </View>

      {confirm ? (
        <View style={s.confirm}>
          <Text style={s.confirmText}>{t("Bütün kariyer ilerlemesi silinir ve ilk bölümden başlarsınız.")}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Btn kind="ghost" label={t("Vazgeç")} onPress={() => setConfirm(false)} />
            <Btn label={t("Evet, sıfırla")} onPress={() => { setConfirm(false); onReset(); }} />
          </View>
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setConfirm(true)} style={s.reset}>
          <Text style={s.resetText}>{t("Kariyeri sıfırla")}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statK}>{k}</Text>
      <Text style={s.statV}>{v}</Text>
    </View>
  );
}

function ChapterCard({ ch, no, onPick, onPaywall, office }: { office: Office | null; ch: CareerChapter; no: number; onPick: (c: CaseFile) => void; onPaywall: () => void }) {
  const soon = !ch.cases.length;
  const done = ch.open && ch.wins >= ch.need;
  return (
    <View style={[s.chapter, !ch.open && s.chapterLocked]}>
      <View style={s.chHead}>
        <View style={[s.chNo, ch.open && s.chNoOpen, done && s.chNoDone]}>
          <Text style={[s.chNoText, ch.open && { color: C.brassInk }]}>{done ? "✓" : no}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.chTitle}>{t(ch.title)}</Text>
          <Text style={s.chCourts}>{t(ch.courts)}</Text>
          <View style={[s.badge, ch.open ? s.badgeOpen : s.badgeLocked]}>
            <Text style={s.badgeText}>{soon ? t("YAKINDA") : ch.open ? t("{w}/{n} GALİBİYET", { w: ch.wins, n: ch.need }) : t("KİLİTLİ")}</Text>
          </View>
        </View>
      </View>
      <Text style={s.chBlurb}>{t(ch.blurb)}</Text>
      {!ch.open && !!ch.why && !soon && <Text style={s.chWhy}>🔒 {ch.why}.</Text>}
      {soon && <Text style={s.chWhy}>{t("Bu basamağın davaları hazırlanıyor; şimdilik bir sonraki bölüme geçilir.")}</Text>}
      {ch.cases.length > 0 && (
        <View style={s.cases}>
          {ch.cases.map((x, i) => <CaseRow key={x.c.id} x={x} i={i} onPick={onPick} onPaywall={onPaywall} office={office} />)}
        </View>
      )}
    </View>
  );
}

function CaseRow({ x, i, onPick, onPaywall, office }: { office: Office | null; x: CareerCase; i: number; onPick: (c: CaseFile) => void; onPaywall: () => void }) {
  const open = x.lock === "open";
  const paid = x.lock === "premium";
  const src = sourceOf(x.c);
  const fee = office ? feeFor(x.c, office, true, 60).amount : 0;
  const st = !x.rec?.played ? (open ? t("Yeni") : "") : x.rec.won ? t("Kazandınız · {n}", { n: x.rec.best }) : t("Kaybettiniz");
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !open }} disabled={!open && !paid} onPress={() => (paid ? onPaywall() : onPick(x.c))}
      style={({ pressed }) => [s.row, !open && { opacity: 0.45 }, pressed && { backgroundColor: C.panel2 }]}>
      <View style={[s.dot, { backgroundColor: x.c.color }]}><Text style={s.dotText}>{open ? i + 1 : paid ? "💎" : "🔒"}</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.titleLine}>
          <Text style={s.rowTitle} numberOfLines={1}>{x.c.title}</Text>
          {!!x.c.difficulty && <Text style={[s.diff, { color: DIFFICULTY[x.c.difficulty].color, borderColor: DIFFICULTY[x.c.difficulty].color }]}>{t(DIFFICULTY[x.c.difficulty].label)}</Text>}
        </View>
        <Text style={s.rowSub} numberOfLines={1}>{x.c.court} · {x.c.area}</Text>
        {!!office && <Text style={[s.rowFee, src !== "muvekkil" && { color: C.p1 }]} numberOfLines={1}>{t(SOURCE_LABEL[src])} · {src === "muvekkil" ? t("ücret ~{tutar}", { tutar: tl(fee) }) : t("sabit ücret {tutar}", { tutar: tl(fee) })}</Text>}
        {!open && !!x.why && <Text style={s.rowWhy}>{x.why}</Text>}
      </View>
      {!!st && (
        <View style={[s.status, x.rec?.won && s.statusWin, !!x.rec?.played && !x.rec.won && s.statusLose]}>
          <Text style={s.statusText}>{st}</Text>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 880, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 20 },
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 14 },
  eyebrow: { fontFamily: F.mono, fontSize: 12, letterSpacing: 2.5, color: C.muted },
  rank: { fontFamily: F.display, fontSize: 34, color: C.brass },
  next: { fontFamily: F.body, fontSize: 16, color: C.textSoft, marginTop: 2 },
  stats: { flexDirection: "row", gap: 10 },
  stat: { borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, minWidth: 92 },
  statK: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: C.muted, textTransform: "uppercase" },
  statV: { fontFamily: F.monoBold, fontSize: 20, color: C.text },
  bar: { height: 6, borderRadius: 3, backgroundColor: C.panel2, marginTop: 16, overflow: "hidden" },
  barFill: { height: 6, backgroundColor: C.brass },
  chapter: { borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, borderRadius: 12, padding: 16, gap: 8 },
  chapterLocked: { backgroundColor: "rgba(20,26,32,0.55)" },
  chHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  chNo: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.brassDim, alignItems: "center", justifyContent: "center" },
  chNoOpen: { backgroundColor: C.brass, borderColor: C.brass },
  chNoDone: { backgroundColor: C.good, borderColor: C.good },
  chNoText: { fontFamily: F.monoBold, fontSize: 15, color: C.muted },
  chTitle: { fontFamily: F.display, fontSize: 22, color: C.text },
  chCourts: { fontFamily: F.body, fontSize: 14, color: C.muted },
  badge: { alignSelf: "flex-start", marginTop: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  badgeOpen: { borderColor: C.brassDim, backgroundColor: "rgba(255,255,255,0.10)" },
  badgeLocked: { borderColor: C.line },
  badgeText: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: C.textSoft },
  chBlurb: { fontFamily: F.body, fontSize: 15, color: C.textSoft },
  chWhy: { fontFamily: F.bodyMed, fontSize: 14, color: C.brass },
  cases: { marginTop: 4, borderTopWidth: 1, borderTopColor: C.line },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.line },
  dot: { width: 30, height: 30, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  dotText: { fontFamily: F.monoBold, fontSize: 12, color: "#f3efe4" },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { flexShrink: 1, fontFamily: F.displayMed, fontSize: 18, color: C.text },
  diff: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1, borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, textTransform: "uppercase" },
  rowSub: { fontFamily: F.body, fontSize: 13, color: C.muted },
  rowFee: { fontFamily: F.mono, fontSize: 11, color: C.brassDim },
  office: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  officeT: { flex: 1, fontFamily: F.bodyMed, fontSize: 15, color: C.textSoft },
  officeCash: { fontFamily: F.monoBold, fontSize: 15, color: C.text },
  rowWhy: { fontFamily: F.body, fontSize: 13, color: C.brassDim },
  status: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  statusWin: { backgroundColor: "rgba(79,174,124,0.2)", borderColor: "rgba(79,174,124,0.6)" },
  statusLose: { backgroundColor: "rgba(214,90,69,0.2)", borderColor: "rgba(214,90,69,0.6)" },
  statusText: { fontFamily: F.mono, fontSize: 11, color: C.text },
  confirm: { alignSelf: "center", alignItems: "center", gap: 10, marginTop: 26, padding: 12 },
  confirmText: { fontFamily: F.body, fontSize: 15, color: C.textSoft, textAlign: "center" },
  promo: { marginTop: 18, borderWidth: 1, borderColor: C.brass, backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 10, padding: 14, gap: 2 },
  promoT: { fontFamily: F.display, fontSize: 18, color: C.brass },
  promoD: { fontFamily: F.body, fontSize: 15, color: C.text },
  reset: { alignSelf: "center", marginTop: 26, padding: 8 },
  resetText: { fontFamily: F.mono, fontSize: 12, color: C.muted, letterSpacing: 1 }
});
