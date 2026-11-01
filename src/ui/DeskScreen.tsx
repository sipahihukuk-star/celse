// Büro masası: kariyerin ana ekranı. Gelen dosyalar (kabul / geri çevir), masadaki dosyalar, branşlar ve odak,
// kasa ve bu ayın hayat olayı.
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Branch, branchLabel, branchOf } from "../data/branches";
import { CareerView, DIFFICULTY, Progress } from "../data/career";
import { accept, branchStats, decline, EARLY_FILES, ensureDeal, Flow, postponeSpecialty, setFocus, setSpecialty, specialtyDue, suggestSpecialty, useFlow } from "../data/flow";
import { dateOf, EDU, hasDegree, studying } from "../data/life";
import { careerSide, closeMonth, enroll, eventChoices, feeFor, monthlyCost, Office, resolveEvent, Source, SOURCE_LABEL, sourceOf, tl, useOffice } from "../data/office";
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
  const extra = (office?.life?.stajyer ? 1 : 0) + (office?.life?.katip ? 1 : 0) + (office?.life?.ownOffice ? 1 : 0);
  const slow = studying(office?.life).filter(x => EDU.find(e => e.id === x.id)?.slow).length;
  const dr = hasDegree(office?.life, "dr");
  const [pickSpec, setPickSpec] = useState(false);
  useEffect(() => { if (office && flow) ensureDeal(solo, progress, month, extra, slow, dr); }, [office?.month, flow?.dealtFor, extra, slow, dr, flow?.focus.join()]);
  if (!office || !flow) return <View />;

  const byId = new Map(solo.map(c => [c.id, c]));
  const stats = branchStats(flow, solo).filter(b => b.open);
  const ev = eventChoices(office);
  const used = Object.keys(flow.closed).length + flow.active.length;
  const freeLeft = premium || admin ? Infinity : FREE_CASES - used;
  const deskFull = flow.active.length >= DESK_MAX;
  const cost = monthlyCost(office).total + personalCosts(office.life!, month).total;
  const toggle = (b: Branch) => setFocus(flow.focus.includes(b) ? flow.focus.filter(x => x !== b) : [...flow.focus, b]);
  const closedN = Object.keys(flow.closed).length;
  const specDue = specialtyDue(flow) && !ev;
  const suggestion = specDue ? suggestSpecialty(flow, solo) : [];
  const allStats = branchStats(flow, solo);
  const life = office.life!;

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

      {closedN < EARLY_FILES && (
        <View style={s.info}>
          <Text style={s.eventK}>MESLEĞİN İLK AYLARI</Text>
          <Text style={s.small}>İlk dosyalarınız baro üzerinden gelir: CMK görevlendirmesiyle müdafilik ve adli yardım bürosunun verdiği davalar. Ücretleri sabit ve düşüktür. {EARLY_FILES} dosya kapattıktan sonra serbest müvekkiller kapınızı çalmaya başlar; kapattıkça daha çok dosya gelir.</Text>
        </View>
      )}

      {specDue && (
        <View style={s.event}>
          <Text style={s.eventK}>UZMANLIK ALANI</Text>
          <Text style={s.eventT}>{suggestion.length ? `Öneri: ${suggestion.map(b => branchLabel(b)).join(" ve ")}` : "Bir uzmanlık alanı seçin"}</Text>
          <Text style={s.eventD}>Kapattığınız {closedN} dosyaya göre en başarılı olduğunuz alan{suggestion.length > 1 ? "lar" : ""} bunlar. Uzmanlık alanınızdan iki buçuk kat daha çok dosya gelir ve bu dosyalarda ücretiniz %15 artar. Diğer alanlardan da dosya gelmeye devam eder; alanınızı sonra değiştirebilirsiniz.</Text>
          {pickSpec ? (
            <View style={s.chips}>
              {allStats.map(b => (
                <Pressable key={b.id} onPress={() => { setPickSpec(false); setSpecialty([b.id]); }} style={s.chip}>
                  <Text style={s.chipT}>{b.icon} {b.label}</Text>
                  <Text style={s.chipS}>{b.won}K · {b.lost}Y</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              {suggestion.length > 0 && <Btn label="Öneriyi kabul et" onPress={() => setSpecialty(suggestion)} />}
              <Btn kind="secondary" label="Başka alan seçeyim" onPress={() => setPickSpec(true)} />
              <Btn kind="ghost" label="Henüz değil" onPress={() => postponeSpecialty()} />
            </View>
          )}
        </View>
      )}

      {flow.specialty.length > 0 && (
        <View style={s.specRow}>
          <Text style={s.small}>Uzmanlık alanınız: <Text style={{ color: C.brass }}>{flow.specialty.map(b => branchLabel(b)).join(", ")}</Text></Text>
          <Pressable onPress={() => setSpecialty([])}><Text style={s.closeLinkT}>değiştir ›</Text></Pressable>
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
        return <FileCard key={o.id} c={c} office={office} src={flow.src[c.id] || o.src} side={flow.side[c.id] || o.side} spec={flow.specialty.includes(branchOf(c))} offer onAccept={() => (freeLeft <= 0 ? onPaywall() : accept(c.id))} onDecline={() => decline(c.id, month)}
          disabled={deskFull || !!ev} why={ev ? "Önce bu ayın kararını verin" : deskFull ? `Masanız dolu (en çok ${DESK_MAX} dosya)` : freeLeft <= 0 ? "Ücretsiz dosyalar bitti · abonelikle devam" : undefined} />;
      })}

      <Text style={s.h}>Masamdaki dosyalar ({flow.active.length}/{DESK_MAX})</Text>
      {!flow.active.length && <Text style={s.empty}>Masanız boş. Gelen dosyalardan birini kabul edin.</Text>}
      {flow.active.map(id => {
        const c = byId.get(id); if (!c) return null;
        return <FileCard key={id} c={c} office={office} src={flow.src[c.id]} side={flow.side[c.id]} spec={flow.specialty.includes(branchOf(c))} onPlay={() => onPlay(c)} disabled={!!ev} why={ev ? "Önce bu ayın kararını verin" : undefined} />;
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

      <Text style={s.h}>Mesleki gelişim <Text style={s.hNote}>· ücret her ay kişisel giderlerinize eklenir</Text></Text>
      <View style={{ gap: 8 }}>
        {EDU.map(e => {
          const done = hasDegree(life, e.id);
          const now = studying(life).find(x => x.id === e.id);
          const blocked = !!e.needs && !hasDegree(life, e.needs);
          return (
            <View key={e.id} style={s.edu}>
              <View style={{ flex: 1, minWidth: 220, gap: 2 }}>
                <Text style={s.choiceT}>{e.label} <Text style={s.chipS}>· {e.months} ay · ayda {tl(e.monthly)}</Text></Text>
                <Text style={s.choiceD}>{e.gain}</Text>
                {now && <Text style={[s.why, { color: C.p1 }]}>Devam ediyor · {dateOf(now.until)} tarihinde biter</Text>}
                {blocked && !done && !now && <Text style={s.why}>Önce yüksek lisansı bitirin.</Text>}
              </View>
              {done ? <Text style={[s.diff, { color: C.good, borderColor: C.good }]}>Tamamlandı</Text>
                : now ? null : <Btn kind="secondary" label="Kaydol" disabled={blocked} onPress={() => enroll(e.id)} style={blocked && { opacity: 0.5 }} />}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function FileCard({ c, office, offer, onAccept, onDecline, onPlay, disabled, why, src: src0, side: side0, spec }: { c: CaseFile; office: Office; offer?: boolean; onAccept?: () => void; onDecline?: () => void; onPlay?: () => void; disabled?: boolean; why?: string; src?: Source; side?: "p1" | "p2"; spec?: boolean }) {
  const src = src0 || sourceOf(c);
  const side = side0 || careerSide(c);
  const fee = feeFor(c, office, true, 70, { src, spec }).amount;
  const d = c.difficulty ? DIFFICULTY[c.difficulty] : null;
  return (
    <View style={[s.card, { borderLeftColor: c.color }]}>
      <View style={s.cardTop}>
        <Text style={s.branch}>{branchLabel(branchOf(c)).toLocaleUpperCase("tr")}{c.process ? " · TAKİP DOSYASI" : ""}</Text>
        {d && <Text style={[s.diff, { color: d.color, borderColor: d.color }]}>{d.label}</Text>}
      </View>
      <Text style={s.cardT}>{c.title}</Text>
      <Text style={s.cardCourt}>{c.court} · {c.sides[side].role}</Text>
      {c.mode === "duel" && <Text style={s.duelTag}>KARŞILIKLI · rakip: {c.sides[side === "p1" ? "p2" : "p1"].role} · bilgisayara, arkadaşınıza ya da internetten bir rakibe karşı</Text>}
      <Text style={s.cardTeaser} numberOfLines={3}>{c.teaser}</Text>
      <Text style={[s.fee, src !== "muvekkil" && { color: C.p1 }]}>{SOURCE_LABEL[src]} · {src === "muvekkil" ? `ücret ≈ ${tl(fee)} (kazanırsanız prim)` : `sabit ücret ${tl(fee)}`}{spec ? " · uzmanlık alanı" : ""}</Text>
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
  event: { borderWidth: 1, borderColor: C.brass, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 14, gap: 4 },
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
  chipOn: { borderColor: C.brass, backgroundColor: "rgba(255,255,255,0.13)" },
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
  closeLinkT: { fontFamily: F.mono, fontSize: 12, color: C.muted, letterSpacing: 1 },
  info: { borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, borderRadius: 12, padding: 12, gap: 4 },
  specRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  edu: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, borderRadius: 10, padding: 10 },
  duelTag: { fontFamily: F.mono, fontSize: 11, color: C.p2 }
});
