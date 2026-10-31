// Küçük ortak bileşenler: düğmeler, çipler, terazi.
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { C, F } from "./theme";

type BtnKind = "primary" | "secondary" | "ghost" | "next" | "ghostInk";

export function Btn({ label, onPress, kind = "primary", style, disabled }: { label: string; onPress: () => void; kind?: BtnKind; style?: StyleProp<ViewStyle>; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.btn, styles[kind], pressed && { opacity: 0.8 }, style]}>
      <Text style={[styles.btnText, textStyles[kind]]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, color, style }: { label: string; color: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.chip, { borderColor: color }, style]}>
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

/** Değeri yumuşakça hedefe taşır (terazi için). */
function useTween(target: number, ms = 700) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = Date.now(), a = from.current;
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      const val = a + (target - a) * e;
      from.current = val; setV(val);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

/** Terazi: angle > 0 sağ kefe aşağı, < 0 sol kefe aşağı (derece). */
export function Scale({ angle, left = C.brass, right = C.brass, size = 82 }: { angle: number; left?: string; right?: string; size?: number }) {
  const a = useTween(angle);
  return (
    <Svg width={size} height={size * 0.6} viewBox="0 0 120 72">
      <Rect x={58} y={16} width={4} height={46} fill={C.brass} />
      <Rect x={44} y={62} width={32} height={6} rx={2} fill={C.brassDim} />
      <G rotation={a} origin="60, 16">
        <Rect x={12} y={14.5} width={96} height={3.5} rx={1.5} fill={C.brass} />
        <G rotation={-a} origin="18, 17">
          <Path d="M18 17 L9 40 M18 17 L27 40" stroke={C.brassDim} strokeWidth={1.2} />
          <Path d="M6 40 Q18 51 30 40 Z" fill={left} />
        </G>
        <G rotation={-a} origin="102, 17">
          <Path d="M102 17 L93 40 M102 17 L111 40" stroke={C.brassDim} strokeWidth={1.2} />
          <Path d="M90 40 Q102 51 114 40 Z" fill={right} />
        </G>
      </G>
      <Circle cx={60} cy={16} r={4} fill={C.brass} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: 6, paddingHorizontal: 20, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: C.bordo, borderWidth: 1, borderColor: "#c0485c" },
  secondary: { borderWidth: 1, borderColor: C.brassDim },
  ghost: { borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 7 },
  ghostInk: { borderWidth: 1, borderColor: C.rule, paddingHorizontal: 14, paddingVertical: 9 },
  next: { borderWidth: 1, borderColor: C.brassDim, paddingHorizontal: 16, paddingVertical: 7 },
  btnText: { fontFamily: F.bodyBold, fontSize: 16 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { fontFamily: F.mono, fontSize: 11, letterSpacing: 0.5 }
});

const textStyles: Record<BtnKind, TextStyle> = {
  primary: { color: "#ffffff" },
  secondary: { color: C.brass },
  ghost: { color: C.text, fontFamily: F.body, fontSize: 15 },
  ghostInk: { color: C.ink, fontFamily: F.body, fontSize: 15 },
  next: { color: C.brass, fontFamily: F.bodyMed, fontSize: 15 }
};
