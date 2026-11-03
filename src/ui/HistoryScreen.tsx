// Geçmiş dosyalar ve başarı: kariyerde oynanan dosyalar, sonuçları, unvan ve itibar; büronun toplam gelir-gideri.
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { CareerView, Progress } from "../data/career";
import { lineText, tl, useOffice } from "../data/office";
import { CaseFile } from "../engine/types";
import { t } from "../i18n";
import { Btn } from "./kit";
import { C, F } from "./theme";

export default function HistoryScreen({ view, progress, all, onBack, onOffice }: { view: CareerView; progress: Progress; all: CaseFile[]; onBack: () => void; onOffice: () => void }) {
  const { office } = useOffice();
  const byId = new Map(all.map(c => [c.id, c]));
  const played = Object.entries(progress).filter(([id]) => byId.has(id)).sort((a, b) => Number(b[1].won) - Number(a[1].won));
  const won = played.filter(([, r]) => r.won).length;
  const ledger = office?.ledger || [];
  const income = ledger.filter(l => l.amount > 0).reduce((n, l) => n + l.amount, 0);
  const spent = -ledger.filter(l => l.amount < 0).reduce((n, l) => n + l.amount, 0);
  const Stat = ({ k, v }: { k: string; v: string }) => (
    <View style={s.stat}><Text style={s.statK}>{k}</Text><Text style={s.statV}>{v}</Text></View>
  );
  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={s.head}>
        <Btn kind="ghost" label={t("‹ Giriş")} onPress={onBack} />
        <View style={{ flex: 1 }} />
        <Btn kind="ghost" label={t("Büro, kasa ve kazanç")} onPress={onOffice} />
      </View>
      <Text style={s.eyebrow}>{t("KARİYER")}</Text>
      <Text style={s.title}>{t("Geçmiş dosyalar ve başarı")}</Text>
      <View style={s.stats}>
        <Stat k={t("Unvan")} v={t(view.rank)} />
        <Stat k={t("Kazanılan")} v={`${won} / ${played.length}`} />
        <Stat k={t("İtibar")} v={String(view.itibar)} />
        {office && <Stat k={t("Kasa")} v={tl(office.cash)} />}
        {office && <Stat k={t("Toplam gelir")} v={tl(income)} />}
        {office && <Stat k={t("Toplam gider")} v={tl(spent)} />}
      </View>
      <Text style={s.h}>{t("Oynanan dosyalar")}</Text>
      {!played.length && <Text style={s.empty}>{t("Henüz kariyerde dosya kapatmadınız.")}</Text>}
      {played.map(([id, r]) => {
        const c = byId.get(id)!;
        return (
          <View key={id} style={[s.row, { borderLeftColor: c.color }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.rowT} numberOfLines={1}>{c.title}</Text>
              <Text style={s.rowS} numberOfLines={1}>{c.court}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[s.badge, { color: r.won ? C.good : C.bad }]}>{r.won ? t("KAZANDINIZ") : t("KAYBETTİNİZ")}</Text>
              <Text style={s.rowS}>{r.won ? t("en iyi {n}", { n: r.best }) : ""}{r.played > 1 ? ` · ${r.played}×` : ""}</Text>
            </View>
          </View>
        );
      })}
      {ledger.length > 0 && <Text style={s.h}>{t("Son hareketler")}</Text>}
      {ledger.slice(-15).reverse().map((l, i) => (
        <View key={i} style={s.led}>
          <Text style={s.ledT} numberOfLines={2}>{l.ay}. {t("ay")} · {lineText(l.text)}</Text>
          <Text style={[s.ledA, { color: l.amount < 0 ? C.bad : l.amount > 0 ? C.good : C.muted }]}>{l.amount ? tl(l.amount) : ""}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 880, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 20, gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  eyebrow: { fontFamily: F.mono, fontSize: 12, letterSpacing: 2, color: C.muted },
  title: { fontFamily: F.display, fontSize: 28, color: C.brass },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginVertical: 6 },
  stat: { borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, minWidth: 140 },
  statK: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.2, color: C.muted, textTransform: "uppercase" },
  statV: { fontFamily: F.display, fontSize: 20, color: C.text },
  h: { fontFamily: F.display, fontSize: 20, color: C.text, marginTop: 10 },
  empty: { fontFamily: F.body, fontSize: 15, color: C.muted },
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: C.line, borderLeftWidth: 5, backgroundColor: C.panel, borderRadius: 10, padding: 12 },
  rowT: { fontFamily: F.displayMed, fontSize: 17, color: C.text },
  rowS: { fontFamily: F.body, fontSize: 13, color: C.muted },
  badge: { fontFamily: F.monoBold, fontSize: 12, letterSpacing: 1 },
  led: { flexDirection: "row", gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.line },
  ledT: { flex: 1, fontFamily: F.body, fontSize: 14, color: C.textSoft },
  ledA: { fontFamily: F.monoBold, fontSize: 13 }
});
