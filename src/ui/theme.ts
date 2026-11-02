// Görsel kimlik (Themiscode): bordo ve beyaz. Koyu bordo zemin, beyaz yazı ve vurgular, bordo mürekkep.
// Anahtar adları tarihseldir ("brass" artık beyaz vurgu rengidir).
export const C = {
  wall: "#3a1520", wallDeep: "#1c0a0f", wallHi: "#4d1c2a",
  office: "#2c3631", officeHi: "#3b4a42", officeDeep: "#171d1a",
  wood: "#5c3b29", woodDeep: "#38231a", woodHi: "#80543a",
  brass: "#fbf4f5", brassDim: "#c79aa3", brassInk: "#7b1e2e",
  paper: "#e9e8e1", paperHi: "#f8f7f2", ink: "#1d2127", inkSoft: "#575d64", rule: "#c9c7bd",
  text: "#ffffff", textSoft: "#efe2e4", muted: "#c4a9ae",
  panel: "#2a1018", panel2: "#371621", line: "#55283a",
  bordo: "#8c1d2f", bordoHi: "#a8293d",
  good: "#4fae7c", bad: "#d65a45", mid: "#d0a64c",
  p1: "#7db3e3", p2: "#eb9a62", p1Ink: "#255f96", p2Ink: "#a44c17",
  hakim: "#8f1d24", hakimHukuk: "#1f6b47", hakimIdari: "#8a8d93", avukat: "#1f6b47", avukatYaka: "#9b1c2a", robe: "#15161a", shirt: "#f0eee6", mouth: "#5b2622",
  win: "#1f6b47", lose: "#a3241c", draw: "#7a5a12"
};

export const F = {
  // Başlıklar: Playfair Display (klasik, yüksek kontrastlı serif); metin: Manrope (okunaklı, modern); logo: Cinzel (taş yazıt).
  display: "PlayfairDisplay_700Bold",
  displayMed: "PlayfairDisplay_600SemiBold",
  logo: "Cinzel_700Bold",
  body: "Manrope_400Regular",
  bodyItalic: "PlayfairDisplay_400Regular_Italic",
  bodyMed: "Manrope_500Medium",
  bodyBold: "Manrope_700Bold",
  mono: "IBMPlexMono_500Medium",
  monoBold: "IBMPlexMono_600SemiBold"
};

export const sideColor = (s: "p1" | "p2") => (s === "p1" ? C.p1 : C.p2);
export const sideInk = (s: "p1" | "p2") => (s === "p1" ? C.p1Ink : C.p2Ink);
export const toneColor = (t: "good" | "mid" | "bad") => (t === "good" ? C.good : t === "bad" ? C.bad : C.mid);
