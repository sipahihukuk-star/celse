// Tahkim ve komisyonlar: forumlara göre gruplanmış karşılıklı dosyalar ve her forum için kısa rehber
// (hangi olaylarda başvurulur, süreç, karar, karara karşı yol).
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { DIFFICULTY } from "../data/career";
import { FORUMS, Forum } from "../data/forums";
import { CaseFile } from "../engine/types";
import { Btn, Chip } from "./kit";
import { C, F } from "./theme";
import { locale, t } from "../i18n";

export function TahkimScreen({ cases, locked, onLocked, onBack, onPick, onOnline }: {
  cases: CaseFile[]; locked: (c: CaseFile) => boolean; onLocked: () => void; onBack: () => void; onPick: (c: CaseFile) => void; onOnline: () => void;
}) {
  const [forum, setForum] = useState<string>("hepsi");
  const [guide, setGuide] = useState<string | null>(null);
  const present = FORUMS.filter(f => cases.some(c => c.forum === f.id));
  const groups = [...new Set(present.map(f => f.group))];
  const shown = (f: Forum) => forum === "hepsi" || forum === f.id;

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={s.head}>
        <Btn kind="ghost" label={t("‹ Giriş")} onPress={onBack} />
        <View style={{ flex: 1, minWidth: 240 }}>
          <Text style={s.eyebrow}>{t("KARŞILIKLI · YAPAY ZEKÂ HAKEM")}</Text>
          <Text style={s.title}>{t("Tahkim ve komisyonlar")}</Text>
          <Text style={s.sub}>{t("Milletlerarası ticari tahkim, spor tahkimi, İnsan Hakları Tazminat Komisyonu ve Sigorta Tahkim Komisyonu dosyaları. İki avukat karşı karşıya gelir; kararı yapay zekâ hakem verir. Aynı cihazda, bilgisayara karşı ya da internet üzerinden oynanır.")}</Text>
        </View>
        <Btn kind="secondary" label={t("İnternet üzerinden oyna ›")} onPress={onOnline} />
      </View>

      <View style={s.chips}>
        {[{ id: "hepsi", short: t("Hepsi") }, ...present].map(f => (
          <Pressable key={f.id} onPress={() => setForum(f.id)} style={[s.chip, forum === f.id && s.chipOn]} accessibilityRole="tab" accessibilityState={{ selected: forum === f.id }}>
            <Text style={[s.chipT, forum === f.id && { color: C.brassInk }]}>{f.short} {f.id !== "hepsi" ? `· ${cases.filter(c => c.forum === f.id).length}` : ""}</Text>
          </Pressable>
        ))}
      </View>

      {cases.length === 0 && <Text style={s.sub}>{t("Dosyalar hazırlanıyor.")}</Text>}

      {groups.map(g => (
        <View key={g} style={{ gap: 10 }}>
          {present.filter(f => f.group === g && shown(f)).length > 0 && <Text style={s.group}>{t(g).toLocaleUpperCase(locale())}</Text>}
          {present.filter(f => f.group === g && shown(f)).map(f => (
            <View key={f.id} style={s.forum}>
              <Pressable onPress={() => setGuide(guide === f.id ? null : f.id)} style={s.forumHead} accessibilityRole="button">
                <Text style={s.forumName}>{t(f.name)}</Text>
                <Text style={s.guideLink}>{guide === f.id ? t("Rehberi kapat ▲") : t("Nasıl işler? ▼")}</Text>
              </Pressable>
              {guide === f.id && (
                <View style={s.guide}>
                  <Text style={s.gH}>{t("Hangi olaylarda başvurulur")}</Text>
                  {f.olaylar.map((x, i) => <Text key={i} style={s.gT}>● {t(x)}</Text>)}
                  <Text style={s.gH}>{t("Yargılama nasıl yürür")}</Text>
                  {f.surec.map((x, i) => <Text key={i} style={s.gT}>● {t(x)}</Text>)}
                  <Text style={s.gT}><Text style={s.gB}>{t("Karar:")} </Text>{t(f.karar)}</Text>
                  <Text style={s.gT}><Text style={s.gB}>{t("Karara karşı yol:")} </Text>{t(f.yol)}</Text>
                </View>
              )}
              {cases.filter(c => c.forum === f.id).map(c => {
                const lock = locked(c);
                return (
                  <Pressable key={c.id} onPress={() => (lock ? onLocked() : onPick(c))} style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]} accessibilityRole="button">
                    <View style={[s.bar, { backgroundColor: c.color }]} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={s.rowTop}>
                        <Text style={s.cardT}>{c.title}</Text>
                        {c.difficulty && <Chip label={t(DIFFICULTY[c.difficulty].label).toLocaleUpperCase(locale())} color={DIFFICULTY[c.difficulty].color} />}
                        {lock && <Chip label={t("ABONELİKLE")} color={C.muted} />}
                      </View>
                      <Text style={s.cardM} numberOfLines={1}>{c.area.replace(/^Tahkim · /, "")}</Text>
                      <Text style={s.cardD} numberOfLines={3}>{c.teaser}</Text>
                      <Text style={s.cardS}>{c.sides.p1.role} ⟷ {c.sides.p2.role}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 1000, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 20, gap: 14 },
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 12 },
  eyebrow: { fontFamily: F.mono, fontSize: 12, letterSpacing: 2, color: C.muted },
  title: { fontFamily: F.display, fontSize: 30, color: C.brass },
  sub: { fontFamily: F.body, fontSize: 15, color: C.muted, lineHeight: 21 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.panel },
  chipOn: { backgroundColor: C.brass, borderColor: C.brass },
  chipT: { fontFamily: F.bodyMed, fontSize: 14, color: C.text },
  group: { fontFamily: F.mono, fontSize: 12, letterSpacing: 2, color: C.brassDim, marginTop: 6 },
  forum: { gap: 8 },
  forumHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  forumName: { fontFamily: F.display, fontSize: 20, color: C.text },
  guideLink: { fontFamily: F.bodyMed, fontSize: 14, color: C.brass, textDecorationLine: "underline" },
  guide: { backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, gap: 6 },
  gH: { fontFamily: F.bodyBold, fontSize: 15, color: C.text, marginTop: 4 },
  gT: { fontFamily: F.body, fontSize: 14, color: C.textSoft, lineHeight: 20 },
  gB: { fontFamily: F.bodyBold, color: C.text },
  card: { flexDirection: "row", gap: 10, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12 },
  bar: { width: 5, borderRadius: 3 },
  rowTop: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  cardT: { fontFamily: F.displayMed, fontSize: 18, color: C.text },
  cardM: { fontFamily: F.mono, fontSize: 11, color: C.muted },
  cardD: { fontFamily: F.body, fontSize: 15, color: C.textSoft, lineHeight: 20 },
  cardS: { fontFamily: F.mono, fontSize: 11, color: C.brassDim }
});
