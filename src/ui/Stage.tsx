// Sahne: duruşma salonu ya da büro. Karakterler sahne ölçüsüne göre yerleştirilir.
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { CaseFile, Look, Scene } from "../engine/types";
import Character, { BACK_LOOK } from "./Character";
import { robeOf } from "./people";
import { C, F } from "./theme";

interface Props {
  c: CaseFile;
  scene: Scene;
  /** konuşan ya da sırası gelen rol; null ise herkes eşit görünür */
  focus: string | null;
  talking: boolean;
}

interface Slot { role: string; look: Look; cx: number; bottom: number; h: number; z: number; cw?: number; bottomPx?: number }

/** Salon türüne göre renkler: yerel mahkeme, yüksek mahkeme, uluslararası mahkeme. */
const ROOMS = {
  yerel: { wall: [C.wallHi, C.wall, C.wallDeep], panel: C.wood, panelTop: C.woodHi, plank: C.woodDeep, floor: ["#24170f", "#120c08"], bench: C.wood, benchTop: C.woodHi, plaque: "#a98535", inscr: C.brass },
  yuksek: { wall: ["#3a2f35", "#2a2228", "#151114"], panel: "#4a2a22", panelTop: "#6e3f2e", plank: "#2e1913", floor: ["#1f130e", "#0e0806"], bench: "#4f2c22", benchTop: "#7a4632", plaque: "#b8954a", inscr: "#d8b25c" },
  uluslararasi: { wall: ["#4a5d72", "#36475a", "#1d2733"], panel: "#5a6878", panelTop: "#8796a6", plank: "#46525f", floor: ["#2a3038", "#161a1f"], bench: "#8a7457", benchTop: "#b39c7c", plaque: "#d9d2c3", inscr: "#c9d3de" }
} as const;

const SKINS = ["#e2b48c", "#c99670", "#f0c9a4", "#b88560", "#d9a982", "#a9744f", "#e8c09c"];
const HAIRS = ["#2a2220", "#6b6b70", "#3a2a20", "#9a9a9e", "#151515", "#5a4a3c", "#7a3b1f"];
const STYLES: Look["style"][] = ["short", "long", "bun", "bald", "curly", "short", "long"];

/** Heyetteki diğer hâkimler: başkanın cübbesini taşır, yüzleri farklılaşır. */
function memberLook(base: Look, i: number): Look {
  return { ...base, skin: SKINS[(i * 3) % SKINS.length], hair: HAIRS[(i * 5 + 1) % HAIRS.length], style: STYLES[(i * 2 + 1) % STYLES.length], glasses: i % 3 === 1, beard: i % 4 === 2 };
}

const BOOKS = [["TMK","TBK","HMK","İİK","TTK"],["TCK","CMK","AY","İŞ K.","İYUK"],["","","","","",""]];
const BOOK_COLORS = ["#6b2a2a","#2f4a63","#3b5e47","#6a5432","#4b3a5c","#7a6a52"];

export default function Stage({ c, scene, focus, talking }: Props) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const { w, h } = box;
  const duel = c.mode === "duel";
  // Çizim görünümünde de hâkim yakası mahkemeye göre: ceza kırmızı, hukuk yeşil, idari gri (dosyada özel renk yoksa).
  const robe = robeOf(c);
  const judgeCollar = robe === "-yesil" ? C.hakimHukuk : robe === "-gri" ? C.hakimIdari : undefined;
  const look = (role: string): Look => {
    if (role === "p1" && !duel) return BACK_LOOK;
    const L = c.cast[role].look;
    return role === "judge" && judgeCollar && !L.collarColor ? { ...L, collarColor: judgeCollar } : L;
  };

  const pal = ROOMS[c.room || "yerel"];
  const judges = Math.max(1, c.bench?.judges ?? 1);
  const benchW = judges === 1 ? Math.min(w * 0.62, 560) : judges <= 3 ? Math.min(w * 0.74, 640) : judges <= 7 ? Math.min(w * 0.86, 780) : w * 0.94;
  const inscription = c.inscription === undefined ? "ADALET MÜLKÜN TEMELİDİR" : c.inscription;

  const slots: Slot[] = [];
  if (scene === "court") {
    const pros = !duel && judges === 1 && c.courtCast?.includes("pros");
    if (judges === 1) {
      slots.push({ role: "judge", look: look("judge"), cx: pros ? 0.41 : 0.5, bottom: 0.34, h: 0.38, z: 1 });
    } else {
      // Kalabalık heyetler iki sıra oturur; başkan tek sayılı sıranın ortasındadır.
      // Hâkimler kürsünün üst kenarına göre yerleştirilir: gövdelerinin yaklaşık %60'ı kürsünün üstünde görünür; arka sıra yarım kafa yukarıda durur.
      const rows = judges > 7 ? [{ n: judges - Math.floor(judges / 2), lift: 0.5, hMax: 0.3, width: benchW * 0.9, z: 0 }, { n: Math.floor(judges / 2), lift: 0, hMax: 0.34, width: benchW, z: 1 }]
                              : [{ n: judges, lift: 0, hMax: 0.38, width: benchW, z: 1 }];
      const presRow = rows.length === 1 ? 0 : rows[1].n % 2 === 1 ? 1 : 0;
      let k = 0;
      rows.forEach((r, ri) => {
        const slotW = r.width / r.n, left0 = (w - r.width) / 2;
        const cw = Math.min(slotW * 0.98, h * r.hMax * 0.8);
        for (let i = 0; i < r.n; i++) {
          const pres = ri === presRow && i === Math.floor(r.n / 2);
          const charH = cw / 0.8, benchTop = h * 0.46;
          const bottomPx = benchTop - charH * 0.4 + charH * r.lift;
          slots.push({ role: pres ? "judge" : `judge_${k}`, look: pres ? look("judge") : memberLook(look("judge"), k + 1), cx: w ? (left0 + slotW * (i + 0.5)) / w : 0.5, bottom: 0, bottomPx, h: r.hMax, z: r.z, cw });
          if (!pres) k++;
        }
      });
    }
    if (pros) slots.push({ role: "pros", look: look("pros"), cx: 0.63, bottom: 0.34, h: 0.38, z: 1 });
    if (!duel && c.courtCast?.includes("client")) slots.push({ role: "client", look: look("client"), cx: 0.5, bottom: 0.04, h: 0.5, z: 3 });
    slots.push({ role: "p1", look: look("p1"), cx: 0.16, bottom: 0, h: 0.64, z: 4 });
    if (duel || c.courtCast?.includes("opp")) slots.push({ role: duel ? "p2" : "opp", look: look(duel ? "p2" : "opp"), cx: 0.84, bottom: 0, h: 0.64, z: 4 });
  } else if (duel) {
    slots.push({ role: "p1", look: look("p1"), cx: 0.2, bottom: 0, h: 0.64, z: 4 });
    slots.push({ role: "p2", look: look("p2"), cx: 0.8, bottom: 0, h: 0.64, z: 4 });
  } else {
    slots.push({ role: "client", look: look("client"), cx: 0.5, bottom: 0.1, h: 0.7, z: 1 });
  }

  const charView = (s: Slot) => {
    const ch = s.h * h, cw = s.cw ?? Math.min(ch * 0.8, w * 0.42);
    // Heyet üyeleri saydamlaşmaz; üst üste binen sıralar birbirine karışmasın.
    const bench = s.role.startsWith("judge");
    const lit = focus === null || focus === s.role || (bench && focus === "judge");
    const opacity = lit ? 1 : bench ? 1 : 0.45;
    return (
      <View key={s.role} style={{ position: "absolute", width: cw, height: cw / 0.8, left: s.cx * w - cw / 2, bottom: s.bottomPx ?? s.bottom * h, zIndex: s.z, opacity }}>
        <Character look={s.look} talking={talking && focus === s.role} />
      </View>
    );
  };

  return (
    <View style={styles.stage} onLayout={onLayout}>
      {w > 0 && scene === "court" && (
        <>
          <LinearGradient colors={[...pal.wall]} style={StyleSheet.absoluteFill} />
          {!!inscription && <Text style={[styles.inscr, { color: pal.inscr, fontSize: Math.max(9, Math.min(17, w / 42)), top: judges > 7 ? "3%" : "5%" }]} numberOfLines={1}>{inscription}</Text>}
          <View style={[styles.panels, { height: h * 0.46, backgroundColor: pal.panel, borderTopColor: pal.panelTop }]}>
            {Array.from({ length: Math.ceil(w / 64) }).map((_, i) => <View key={i} style={[styles.plank, { borderRightColor: pal.plank }]} />)}
          </View>
          <LinearGradient colors={[...pal.floor]} style={[styles.abs, { left: 0, right: 0, bottom: 0, height: h * 0.18 }]} />
          {slots.filter(s => s.z < 2).map(charView)}
          <View style={[styles.bench, { width: benchW, left: (w - benchW) / 2, bottom: h * 0.18, height: h * 0.28, backgroundColor: pal.bench, borderTopColor: pal.benchTop }]}>
            <View style={[styles.plaque, { backgroundColor: pal.plaque }, !duel && c.courtCast?.includes("client") && { alignSelf: "flex-start", marginLeft: 12, maxWidth: "34%" }]}><Text style={[styles.plaqueText, { fontSize: Math.max(8, Math.min(13, w / 70)) }]} numberOfLines={1}>{c.courtShort}</Text></View>
          </View>
          {slots.filter(s => s.z === 3).map(charView)}
          {!duel && c.courtCast?.includes("client") && (
            <View style={[styles.lectern, { width: Math.min(w * 0.24, 170), left: (w - Math.min(w * 0.24, 170)) / 2, height: h * 0.16 }]}>
              <Text style={styles.lecternText}>SANIK</Text>
            </View>
          )}
          {slots.filter(s => s.z >= 4).map(charView)}
        </>
      )}
      {w > 0 && scene === "office" && (
        <>
          <LinearGradient colors={[C.officeHi, C.office, C.officeDeep]} style={StyleSheet.absoluteFill} />
          <View style={[styles.window, { right: w * 0.05, top: h * 0.09, width: w * 0.24, height: h * 0.4 }]}>
            <View style={styles.winBarV} /><View style={styles.winBarH} /><View style={styles.moon} />
          </View>
          <View style={[styles.shelf, { left: w * 0.03, top: h * 0.07, width: w * 0.34, height: h * 0.64 }]}>
            {BOOKS.map((row, ri) => (
              <View key={ri} style={styles.shelfRow}>
                {row.map((t, i) => (
                  <View key={i} style={[styles.book, { backgroundColor: BOOK_COLORS[(i + ri * 2) % 6], height: `${76 + ((i * 7 + ri * 5) % 20)}%` }]}>
                    {!!t && <Text style={styles.bookText} numberOfLines={1}>{t}</Text>}
                  </View>
                ))}
              </View>
            ))}
          </View>
          {!duel && slots.map(charView)}
          <View style={[styles.desk, { left: w * 0.05, right: w * 0.05, height: h * 0.23 }]}>
            <View style={[styles.paper, { left: "33%", transform: [{ rotate: "-5deg" }] }]} />
            <View style={[styles.paper, { right: "33%", transform: [{ rotate: "7deg" }] }]} />
          </View>
          {duel && slots.map(charView)}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, borderRadius: 12, overflow: "hidden", backgroundColor: C.wall, borderWidth: 1, borderColor: "#0b0f13" },
  abs: { position: "absolute" },
  inscr: { position: "absolute", top: "5%", left: 0, right: 0, textAlign: "center", fontFamily: F.display, color: C.brass, letterSpacing: 3 },
  panels: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", backgroundColor: C.wood, borderTopWidth: 5, borderTopColor: C.woodHi, overflow: "hidden" },
  plank: { width: 64, borderRightWidth: 3, borderRightColor: C.woodDeep },
  bench: { position: "absolute", backgroundColor: C.wood, borderTopWidth: 6, borderTopColor: C.woodHi, borderTopLeftRadius: 3, borderTopRightRadius: 3, alignItems: "center", justifyContent: "center", zIndex: 2 },
  plaque: { backgroundColor: "#a98535", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 2 },
  plaqueText: { fontFamily: F.display, color: C.brassInk, letterSpacing: 2 },
  lectern: { position: "absolute", bottom: 0, backgroundColor: C.wood, borderTopWidth: 4, borderTopColor: C.woodHi, alignItems: "center", justifyContent: "center", zIndex: 3 },
  lecternText: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, color: "#e9d6a6" },
  window: { position: "absolute", backgroundColor: "#16253a", borderWidth: 6, borderColor: "#3b2a20" },
  winBarV: { position: "absolute", top: 0, bottom: 0, left: "50%", width: 4, marginLeft: -2, backgroundColor: "#3b2a20" },
  winBarH: { position: "absolute", left: 0, right: 0, top: "50%", height: 4, marginTop: -2, backgroundColor: "#3b2a20" },
  moon: { position: "absolute", width: 9, height: 9, borderRadius: 5, backgroundColor: "#f3ead0", top: "16%", right: "20%" },
  shelf: { position: "absolute", backgroundColor: C.woodDeep, borderWidth: 6, borderColor: C.wood, borderRadius: 3, padding: 4, gap: 4 },
  shelfRow: { flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 3, borderBottomWidth: 4, borderBottomColor: C.woodHi, paddingHorizontal: 4 },
  book: { flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden", borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  bookText: { fontFamily: F.mono, fontSize: 8, color: "#efe2c2", transform: [{ rotate: "-90deg" }], width: 40, textAlign: "center" },
  desk: { position: "absolute", bottom: 0, backgroundColor: C.wood, borderTopWidth: 6, borderTopColor: C.woodHi, borderTopLeftRadius: 4, borderTopRightRadius: 4, zIndex: 2 },
  paper: { position: "absolute", top: -10, width: "15%", height: "34%", backgroundColor: C.paper, borderRadius: 1 }
});
