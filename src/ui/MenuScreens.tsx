import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { CaseFile, Player, Side } from "../engine/types";
import { Btn, Scale } from "./kit";
import { loadResults, SavedResult } from "./storage";
import { C, F } from "./theme";

/* ---------- Giriş ---------- */
export function TitleScreen({ onDuel, onSolo, duelCount, soloCount }: { onDuel: () => void; onSolo: () => void; duelCount: number; soloCount: number }) {
  const { width } = useWindowDimensions();
  const [tilt, setTilt] = useState(-4);
  useEffect(() => { const t = setInterval(() => setTilt(a => -a), 3000); return () => clearInterval(t); }, []);
  const wide = width >= 760;
  return (
    <ScrollView contentContainerStyle={[styles.titleWrap, wide && { flexDirection: "row-reverse", alignItems: "center" }]}>
      <View style={[styles.titleArt, wide && { flex: 0.8 }]}>
        <Scale angle={tilt} size={wide ? 340 : 180} left={C.p1} right={C.p2} />
      </View>
      <View style={[{ gap: 6 }, wide && { flex: 1.2 }]}>
        <Text style={styles.eyebrow}>BİR AVUKATLIK OYUNU</Text>
        <Text style={[styles.logo, { fontSize: wide ? 128 : 84, lineHeight: wide ? 120 : 82 }]}>Celse</Text>
        <Text style={styles.lede}>Aynı dava, iki vekil. Dilekçeden karara kadar sırayla hamle yapın; hâkimin terazisi her cevapla bir tarafa eğilir.</Text>
        <View style={styles.facts}>
          <Text style={styles.fact}><Text style={styles.factB}>{duelCount}</Text> karşılıklı dava</Text>
          <Text style={styles.fact}><Text style={styles.factB}>{soloCount}</Text> tek kişilik dosya</Text>
          <Text style={styles.fact}><Text style={styles.factB}>2</Text> oyuncu ya da bilgisayara karşı</Text>
        </View>
        <View style={styles.cta}>
          <Btn label="Karşılıklı duruşma" onPress={onDuel} />
          <Btn kind="secondary" label="Tek kişilik dosyalar" onPress={onSolo} />
        </View>
      </View>
    </ScrollView>
  );
}

/* ---------- Dosya dolabı ---------- */
export function CaseListScreen({ mode, cases, onPick, onBack, onSwitch }: { mode: "duel" | "solo"; cases: CaseFile[]; onPick: (c: CaseFile) => void; onBack: () => void; onSwitch: () => void }) {
  const [res, setRes] = useState<Record<string, SavedResult>>({});
  useEffect(() => { loadResults().then(setRes); }, [mode]);
  const { width } = useWindowDimensions();
  const cols = width >= 1000 ? 3 : width >= 640 ? 2 : 1;
  const duel = mode === "duel";
  return (
    <ScrollView contentContainerStyle={styles.listWrap}>
      <View style={styles.listHead}>
        <Btn kind="ghost" label="‹ Giriş" onPress={onBack} />
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text style={styles.listTitle}>{duel ? "Karşılıklı duruşma" : "Tek kişilik dosyalar"}</Text>
          <Text style={styles.listSub}>{duel ? "Aynı davada iki vekil sırayla hamle yapar. Arkadaşınızla aynı cihazda ya da bilgisayara karşı oynayın." : "Tek bir rol üstlenin; karşı taraf ve hâkim hazır bekliyor."}</Text>
        </View>
        <Btn kind="ghost" label={duel ? "Tek kişilik ›" : "Karşılıklı ›"} onPress={onSwitch} />
      </View>
      <View style={styles.folders}>
        {cases.map(c => {
          const r = res[c.id];
          return (
            <Pressable key={c.id} onPress={() => onPick(c)} accessibilityRole="button" style={({ pressed }) => [{ width: `${100 / cols - (cols > 1 ? 2 : 0)}%` as any }, pressed && { transform: [{ translateY: -3 }] }]}>
              <View style={[styles.tab, { backgroundColor: c.color }]}><Text style={styles.tabText}>{c.esas}</Text></View>
              <View style={[styles.folder, { backgroundColor: c.color }]}>
                <Text style={styles.fArea}>{c.area.toLocaleUpperCase("tr")}</Text>
                <Text style={styles.fTitle}>{c.title}</Text>
                <Text style={styles.fCourt}>{c.court}</Text>
                <Text style={styles.fTeaser}>{c.teaser}</Text>
                <View style={styles.fMeta}>
                  <Text style={styles.fRole}>{duel ? `${c.sides.p1.role} ⇄ ${c.sides.p2.role}` : `Rol: ${c.sides.p1.role}`}</Text>
                  {!!c.bench && c.bench.judges > 1 && <Text style={styles.fBench}>Heyet: {c.bench.title || `${c.bench.judges} hâkim`}</Text>}
                  <View style={[styles.status, r && r.tone === "win" && styles.statusWin, r && r.tone === "lose" && styles.statusLose]}>
                    <Text style={styles.statusText}>{r ? `Son: ${r.text}` : "Oynanmadı"}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

/* ---------- Karşılıklı duruşma kurulumu ---------- */
function Seg({ options, value, onChange }: { options: { v: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.seg}>
      {options.map(o => (
        <Pressable key={o.v} accessibilityRole="radio" accessibilityState={{ checked: value === o.v }} onPress={() => onChange(o.v)}
          style={[styles.segItem, value === o.v && styles.segOn]}>
          <Text style={[styles.segText, value === o.v && { color: C.paper }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function SetupModal({ c, onClose, onStart }: { c: CaseFile | null; onClose: () => void; onStart: (p: Record<Side, Player>) => void }) {
  const [opp, setOpp] = useState("friend");
  const [n1, setN1] = useState(""), [n2, setN2] = useState("");
  const [side, setSide] = useState<Side>("p1");
  const [lvl, setLvl] = useState<"easy" | "hard">("easy");
  if (!c) return null;
  const start = () => {
    if (opp === "friend") return onStart({ p1: { name: n1.trim() || "Oyuncu 1", ai: false }, p2: { name: n2.trim() || "Oyuncu 2", ai: false } });
    const ai: Player = { name: lvl === "hard" ? "Usta Bilgisayar" : "Çaylak Bilgisayar", ai: true, level: lvl };
    const me: Player = { name: "Siz", ai: false };
    onStart(side === "p1" ? { p1: me, p2: ai } : { p1: ai, p2: me });
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>{c.title}</Text>
          <Text style={styles.sheetSub}>{c.court} · {c.esas}</Text>
          <Text style={styles.legend}>RAKİBİNİZ</Text>
          <Seg value={opp} onChange={setOpp} options={[{ v: "friend", label: "Arkadaşım (aynı cihaz)" }, { v: "ai", label: "Bilgisayar" }]} />
          {opp === "friend" ? (
            <View style={{ gap: 10, marginTop: 14 }}>
              <Text style={styles.legend}>OYUNCU 1 · {c.sides.p1.role.toLocaleUpperCase("tr")}</Text>
              <TextInput style={styles.input} value={n1} onChangeText={setN1} placeholder="Oyuncu 1" placeholderTextColor={C.inkSoft} maxLength={18} />
              <Text style={styles.legend}>OYUNCU 2 · {c.sides.p2.role.toLocaleUpperCase("tr")}</Text>
              <TextInput style={styles.input} value={n2} onChangeText={setN2} placeholder="Oyuncu 2" placeholderTextColor={C.inkSoft} maxLength={18} />
            </View>
          ) : (
            <View style={{ gap: 10, marginTop: 14 }}>
              <Text style={styles.legend}>ROLÜNÜZ</Text>
              <Seg value={side} onChange={v => setSide(v as Side)} options={[{ v: "p1", label: c.sides.p1.role }, { v: "p2", label: c.sides.p2.role }]} />
              <Text style={styles.legend}>RAKİP SEVİYESİ</Text>
              <Seg value={lvl} onChange={v => setLvl(v as "easy" | "hard")} options={[{ v: "easy", label: "Çaylak" }, { v: "hard", label: "Usta" }]} />
            </View>
          )}
          <View style={styles.sheetActions}>
            <Btn kind="ghostInk" label="Vazgeç" onPress={onClose} />
            <Btn label="Duruşmayı başlat" onPress={start} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  titleWrap: { flexGrow: 1, justifyContent: "center", width: "100%", maxWidth: 1080, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 32, gap: 24 },
  titleArt: { alignItems: "center" },
  eyebrow: { fontFamily: F.mono, fontSize: 12, letterSpacing: 2.5, color: C.muted },
  logo: { fontFamily: F.display, color: C.brass },
  lede: { fontFamily: F.body, fontSize: 19, lineHeight: 27, color: "#d9d5ca", maxWidth: 480, marginTop: 8 },
  facts: { flexDirection: "row", flexWrap: "wrap", columnGap: 18, rowGap: 4, marginVertical: 14 },
  fact: { fontFamily: F.body, fontSize: 15, color: C.muted },
  factB: { fontFamily: F.monoBold, color: C.text },
  cta: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  listWrap: { width: "100%", maxWidth: 1080, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 20 },
  listHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 14, marginBottom: 24 },
  listTitle: { fontFamily: F.display, fontSize: 32, color: C.brass },
  listSub: { fontFamily: F.body, fontSize: 16, color: C.muted, marginTop: 2 },
  folders: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 22 },
  tab: { alignSelf: "flex-start", marginLeft: 14, paddingHorizontal: 14, paddingVertical: 6, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  tabText: { fontFamily: F.mono, fontSize: 12, color: "#f3efe4" },
  folder: { borderRadius: 10, padding: 18, gap: 8, minHeight: 250, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  fArea: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: "rgba(243,239,228,0.8)" },
  fTitle: { fontFamily: F.display, fontSize: 28, color: "#f3efe4" },
  fCourt: { fontFamily: F.body, fontSize: 15, color: "rgba(243,239,228,0.85)" },
  fTeaser: { fontFamily: F.body, fontSize: 16, lineHeight: 22, color: "rgba(243,239,228,0.9)" },
  fMeta: { marginTop: "auto", paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.18)", gap: 8 },
  fBench: { fontFamily: F.mono, fontSize: 11, color: "rgba(243,239,228,0.8)" },
  fRole: { fontFamily: F.bodyBold, fontSize: 14, color: "#f3efe4" },
  status: { alignSelf: "flex-start", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  statusWin: { backgroundColor: "rgba(79,174,124,0.25)", borderColor: "rgba(79,174,124,0.6)" },
  statusLose: { backgroundColor: "rgba(214,90,69,0.25)", borderColor: "rgba(214,90,69,0.6)" },
  statusText: { fontFamily: F.mono, fontSize: 11, color: "#f3efe4" },
  overlay: { flex: 1, backgroundColor: "rgba(5,8,10,0.72)", alignItems: "center", justifyContent: "center", padding: 16 },
  sheet: { backgroundColor: C.paper, borderRadius: 4, padding: 22, width: "100%", maxWidth: 560 },
  sheetTitle: { fontFamily: F.display, fontSize: 26, color: C.ink },
  sheetSub: { fontFamily: F.mono, fontSize: 12, color: C.inkSoft, marginBottom: 16 },
  legend: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: C.inkSoft, marginBottom: 2 },
  seg: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  segItem: { borderWidth: 1, borderColor: C.rule, backgroundColor: C.paperHi, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  segOn: { backgroundColor: C.ink, borderColor: C.ink },
  segText: { fontFamily: F.body, fontSize: 15, color: C.ink },
  input: { fontFamily: F.body, fontSize: 16, borderWidth: 1, borderColor: C.rule, borderRadius: 6, backgroundColor: C.paperHi, color: C.ink, paddingHorizontal: 12, paddingVertical: 10 },
  sheetActions: { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: 10, marginTop: 20 }
});
