// Büro masası: kariyerin ana ekranı. Gelen dosyalar (kabul / geri çevir), masadaki dosyalar, branşlar ve odak,
// kasa ve bu ayın hayat olayı.
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Branch, branchLabel, branchOf } from "../data/branches";
import { CareerView, DIFFICULTY, Progress } from "../data/career";
import { accept, branchStats, decline, ensureDeal, Flow, setFocus, useFlow } from "../data/flow";
import { dateOf } from "../data/life";
import { closeMonth, eventChoices, feeFor, monthlyCost, resolveEvent, SOURCE_LABEL, sourceOf, tl, useOffice } from "../data/office";
import { personalCosts } from "../data/life";
import { FREE_CASES } from "../data/subscription";
import { CaseFile } from "../engine/types";
import { Btn } from "./kit";
import { AvatarFace } from "./OfficeScreen";
import { C, F } from "./theme";

export const DESK_MAX = 3;

interface Props {
  solo: CaseFile[];
  progress: Progress;
  view: CareerView;
  premium: boolean;
  admin: boolean;
  onPlay: (c: CaseFile) => void;
  onOffice: () => void;
  onMap: () => void;
  onPaywall: () => void;
  onBack: () => void;
}

export default function DeskScreen({ solo, progress, view, premium, admin, onPlay, onOffice, onMap, onPaywall, onBack }: Props) {
  const { office } = useOffice();
  const flow = useFlow();
  const [closing, setClosing] = useState(false);
  const month = (office?.month || 0) + 1;
  const extra = (office?.life?.stajyer ? 1 : 0) + (office?.life?.katip ? 1 : 0);
  useEffect(() => { if (office && flow) ensureDeal(solo, progress, month, extra); }, [office?.month, flow?.dealtFor, extra, flow?.focus.join()]);
  if (!office || !flow) return <View />;

  const byId = new Map(solo.map(c => [c.id, c]));
  const stats = branchStats(flow, solo).filter(b => b.open);
  const ev = eventChoices(office);
  const used = Object.keys(flow.closed).length + flow.active.length;
  const freeLeft = premium || admin ? Infinity : FREE_CASES - used;
  const deskFull = flow.active.length >= DESK_MAX;
  const cost = monthlyCost(office).total + personalCosts(office.life!, month).total;
  const toggle = (b: Branch) => setFocus(flow.focus.includes(b) ? flow.focus.filter(x => x !== b) : [...flow.focus, b]);

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={s.head}>
        <Btn kind="ghost" label="‹ Giriş" onPress={onBack} />
        <View style={{ flex: 1 }} />
        <Btn kind="ghost" label="Kariyer haritası" onPress={onMap} />
        <Btn kind="ghost" label="Büro ve hayat" onPress={onOffice} />
      </View>

      <View style={s.idRow}>
        <AvatarFace k={office.avatar} size={64} />
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text style={s.eyebrow}>{dateOf(month).toLocaleUpperCase("tr")} · {view.rank.toLocaleUpperCase("tr")}</Text>
          <Text style={s.title} numberOfLines={1}>{office.name}</Text>
        </View>
        <View style={s.cashBox}>
          <Text style={s.k}>Kasa</Text>
          <Text style={[s.cash, office.cash < 0 && { color: C.bad }]}>{tl(office.cash)}</Text>
          <Text style={s.small}>Ay sonu gider ≈ {tl(cost)}</Text>
        </View>
      </View>

      {ev && (
        <View style={s.event}>
          <Text style={s.eventK}>BU AY · KARAR VERİN</Text>
          <Text style={s.eventT}>{ev.title}</Text>
          <Text style={s.eventD}>{ev.text}</Text>
          <View style={{ gap: 8, marginTop: 6 }}>
            {ev.choices.map((ch, i) => (
              <Pressable key={i} accessibilityRole="button" disabled={ch.disabled} onPress={() => resolveEvent(i)} style={({ pressed }) => [s.choice, ch.disabled && { opacity: 0.45 }, pressed && { backgroundColor: C.panel2 }]}>
                <Text style={s.choiceT}>{ch.label}{ch.once ? `  ·  ${ch.once > 0 ? "+" : ""}${tl(ch.once)}` : ""}</Text>
                {!!ch.note && <Text style={s.choiceD}>{ch.note}{ch.disabled ? " (kasa yetersiz)" : ""}</Text>}
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {stats.length > 0 && (
        <View style={{ gap: 6 }}>
          <Text style={s.h}>Branşlar <Text style={s.hNote}>· dokunarak odaklanın; odak seçerseniz yalnız o branşlardan dosya gelir</Text></Text>
          <View style={s.chips}>
            <Pressable onPress={() => setFocus([])} style={[s.chip, !flow.focus.length && s.chipOn]}><Text style={s.chipT}>Hepsi</Text></Pressable>
            {stats.map(b => (
              <Pressable key={b.id} accessibilityRole="checkbox" accessibilityState={{ checked: flow.focus.includes(b.id) }} onPress={() => toggle(b.id)} style={[s.chip, flow.focus.includes(b.id) && s.chipOn]}>
                <Text style={s.chipT}>{b.icon} {b.label}</Text>
                <Text style={s.chipS}>{b.won}K · {b.lost}Y{b.weight > 1.6 ? " · ★" : ""}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <Text style={s.h}>Gelen dosyalar <Text style={s.hNote}>· kabul etmezseniz bir ay sonra müvekkil başka avukata gider</Text></Text>
      {!flow.offers.length && <Text style={s.empty}>Bu ay yeni dosya yok. Masadaki dosyaları bitirin ya da ayı kapatın.</Text>}
      {flow.offers.map(o => {
        const c = byId.get(o.id); if (!c) return null;
        return <FileCard key={o.id} c={c} office={office} offer onAccept={() => (freeLeft <= 0 ? onPaywall() : accept(c.id))} onDecline={() => decline(c.id, month)}
          disabled={deskFull || !!ev} why={ev ? "Önce bu ayın kararını verin" : deskFull ? `Masanız dolu (en çok ${DESK_MAX} dosya)` : freeLeft <= 0 ? "Ücretsiz dosyalar bitti · abonelikle devam" : undefined} />;
      })}

      <Text style={s.h}>Masamdaki dosyalar ({flow.active.length}/{DESK_MAX})</Text>
      {!flow.active.length && <Text style={s.empty}>Masanız boş. Gelen dosyalardan birini kabul edin.</Text>}
      {flow.active.map(id => {
        const c = byId.get(id); if (!c) return null;
        return <FileCard key={id} c={c} office={office} onPlay={() => onPlay(c)} disabled={!!ev} why={ev ? "Önce bu ayın kararını verin" : undefined} />;
      })}

      {!flow.active.length && !ev && (
        closing ? (
          <View style={s.closeBox}>
            <Text style={s.small}>Dosyasız bir ay geçer: gelir olmaz, büro ve kişisel giderler ({tl(cost)}) kasadan düşer, yeni dosyalar gelir.</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Btn kind="ghost" label="Vazgeç" onPress={() => setClosing(false)} />
              <Btn label="Ayı kapat" onPress={() => { setClosing(false); closeMonth([], 0); }} />
            </View>
          </View>
        ) : <Pressable onPress={() => setClosing(true)} style={s.closeLink}><Text style={s.closeLinkT}>Bu ayı dosyasız kapat ›</Text></Pressable>
      )}
    </ScrollView>
  );
}

function FileCard({ c, office, offer, onAccept, onDecline, onPlay, disabled, why }: { c: CaseFile; office: any; offer?: boolean; onAccept?: () => void; onDecline?: () => void; onPlay?: () => void; disabled?: boolean; why?: string }) {
  const src = sourceOf(c);
  const fee = feeFor(c, office, true, 70).amount;
  const d = c.difficulty ? DIFFICULTY[c.difficulty] : null;
  return (
    <View style={[s.card, { borderLeftColor: c.color }]}>
      <View style={s.cardTop}>
        <Text style={s.branch}>{branchLabel(branchOf(c)).toLocaleUpperCase("tr")}{c.process ? " · TAKİP DOSYASI" : ""}</Text>
        {d && <Text style={[s.diff, { color: d.color, borderColor: d.color }]}>{d.label}</Text>}
      </View>
      <Text style={s.cardT}>{c.title}</Text>
      <Text style={s.cardCourt}>{c.court} · {c.sides.p1.role}</Text>
      <Text style={s.cardTeaser} numberOfLines={3}>{c.teaser}</Text>
      <Text style={[s.fee, src !== "muvekkil" && { color: C.p1 }]}>{SOURCE_LABEL[src]} · {src === "muvekkil" ? `ücret ≈ ${tl(fee)} (kazanırsanız prim)` : `sabit ücret ${tl(fee)}`}</Text>
      {!!why && <Text style={s.why}>{why}</Text>}
      <View style={s.cardBtns}>
        {offer ? (
          <>
            <Btn kind="ghost" label="Geri çevir" onPress={onDecline!} />
            <Btn label="Kabul et" onPress={onAccept!} disabled={disabled} style={disabled && { opacity: 0.5 }} />
          </>
        ) : <Btn label="Duruşmaya gir ›" onPress={onPlay!} disabled={disabled} style={disabled && { opacity: 0.5 }} />}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 880, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 20, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  idRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14 },
  eyebrow: { fontFamily: F.mono, fontSize: 12, letterSpacing: 2, color: C.muted },
  title: { fontFamily: F.display, fontSize: 26, color: C.brass },
  cashBox: { borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, minWidth: 170 },
  k: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.2, color: C.muted, textTransform: "uppercase" },
  cash: { fontFamily: F.display, fontSize: 26, color: C.text },
  small: { fontFamily: F.body, fontSize: 14, color: C.textSoft },
  event: { borderWidth: 1, borderColor: C.brass, backgroundColor: "rgba(208,166,76,0.10)", borderRadius: 12, padding: 14, gap: 4 },
  eventK: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: C.brass },
  eventT: { fontFamily: F.display, fontSize: 22, color: C.text },
  eventD: { fontFamily: F.body, fontSize: 16, color: C.textSoft },
  choice: { borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, borderRadius: 8, padding: 10 },
  choiceT: { fontFamily: F.bodyBold, fontSize: 16, color: C.text },
  choiceD: { fontFamily: F.body, fontSize: 14, color: C.textSoft },
  h: { fontFamily: F.display, fontSize: 20, color: C.text, marginTop: 8 },
  hNote: { fontFamily: F.body, fontSize: 13, color: C.muted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.panel },
  chipOn: { borderColor: C.brass, backgroundColor: "rgba(208,166,76,0.16)" },
  chipT: { fontFamily: F.bodyMed, fontSize: 14, color: C.text },
  chipS: { fontFamily: F.mono, fontSize: 10, color: C.muted },
  empty: { fontFamily: F.body, fontSize: 15, color: C.muted },
  card: { borderWidth: 1, borderColor: C.line, borderLeftWidth: 5, backgroundColor: C.panel, borderRadius: 10, padding: 12, gap: 3 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  branch: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.2, color: C.brass },
  diff: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1, borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, textTransform: "uppercase" },
  cardT: { fontFamily: F.display, fontSize: 20, color: C.text },
  cardCourt: { fontFamily: F.body, fontSize: 14, color: C.muted },
  cardTeaser: { fontFamily: F.body, fontSize: 15, color: C.textSoft },
  fee: { fontFamily: F.mono, fontSize: 12, color: C.brassDim, marginTop: 2 },
  why: { fontFamily: F.bodyMed, fontSize: 13, color: C.brass },
  cardBtns: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 6 },
  closeBox: { alignItems: "center", gap: 10, padding: 10 },
  closeLink: { alignSelf: "center", padding: 10 },
  closeLinkT: { fontFamily: F.mono, fontSize: 12, color: C.muted, letterSpacing: 1 }
});
