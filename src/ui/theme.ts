// Görsel kimlik: gece duruşma salonu — arduvaz duvar, ceviz lambri, pirinç terazi.
export const C = {
  wall: "#2a333d", wallDeep: "#161c22", wallHi: "#3a4652",
  office: "#2c3631", officeHi: "#3b4a42", officeDeep: "#171d1a",
  wood: "#5c3b29", woodDeep: "#38231a", woodHi: "#80543a",
  brass: "#d0a64c", brassDim: "#8f7436", brassInk: "#2a1f0c",
  paper: "#e9e8e1", paperHi: "#f8f7f2", ink: "#1d2127", inkSoft: "#575d64", rule: "#c9c7bd",
  text: "#ece8dd", textSoft: "#d4d0c4", muted: "#a2aab1",
  panel: "#141a20", panel2: "#1c242c", line: "#2f3b46",
  good: "#4fae7c", bad: "#d65a45", mid: "#d0a64c",
  p1: "#7db3e3", p2: "#eb9a62", p1Ink: "#255f96", p2Ink: "#a44c17",
  hakim: "#8f1d24", avukat: "#1f6b47", robe: "#15161a", shirt: "#f0eee6", mouth: "#5b2622",
  win: "#1f6b47", lose: "#a3241c", draw: "#7a5a12"
};

export const F = {
  display: "AlegreyaSC_700Bold",
  displayMed: "AlegreyaSC_500Medium",
  body: "AlegreyaSans_400Regular",
  bodyItalic: "AlegreyaSans_400Regular_Italic",
  bodyMed: "AlegreyaSans_500Medium",
  bodyBold: "AlegreyaSans_700Bold",
  mono: "IBMPlexMono_500Medium",
  monoBold: "IBMPlexMono_600SemiBold"
};

export const sideColor = (s: "p1" | "p2") => (s === "p1" ? C.p1 : C.p2);
export const sideInk = (s: "p1" | "p2") => (s === "p1" ? C.p1Ink : C.p2Ink);
export const toneColor = (t: "good" | "mid" | "bad") => (t === "good" ? C.good : t === "bad" ? C.bad : C.mid);
