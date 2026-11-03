// Yönetim paneli grafikleri (react-native-svg; web, iOS ve Android'de aynı çizilir).
// Sütun (yığılmış olabilir) ve çizgi grafiği, yatay çubuk listesi. Bir sütuna ya da noktaya dokununca değeri üstte yazılır.
import React, { useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { C, F } from "../ui/theme";

/** Kategorik renkler (sırayla atanır; koyu zemin #2a1018 üzerinde renk körlüğü ve kontrast denetiminden geçti). */
export const SERIES = ["#3987e5", "#d95926"];
const GRID = "rgba(255,255,255,0.10)";
const H_AXIS = 26, Y_AXIS = 34;

/** 1-2-5 basamaklı "güzel" üst sınır. */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
export const fmtNum = (v: number) => (Number(v) || 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 });

/** Üstü 4px yuvarlatılmış, tabana oturan sütun. */
function barPath(x: number, y: number, w: number, h: number, round: boolean): string {
  const r = round ? Math.min(4, w / 2, h) : 0;
  if (h <= 0) return "";
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, e => { const nw = Math.round(e.nativeEvent.layout.width); if (Math.abs(nw - w) > 1) setW(nw); }];
}

interface Point { label: string; long?: string }

function Axis({ w, h, max }: { w: number; h: number; max: number }) {
  return (
    <>
      {[0, 0.5, 1].map(f => <Line key={f} x1={Y_AXIS} x2={w} y1={h - f * h + 0.5} y2={h - f * h + 0.5} stroke={f === 0 ? "rgba(255,255,255,0.25)" : GRID} strokeWidth={1} />)}
    </>
  );
}

function YLabels({ h, max, unit }: { h: number; max: number; unit?: string }) {
  return (
    <>
      {[0, 0.5, 1].filter(f => f !== 0.5 || Number.isInteger(max / 2)).map(f => (
        <Text key={f} style={[s.yl, { top: h - f * h - 7 }]}>{fmtNum(max * f)}{f === 1 && unit ? unit : ""}</Text>
      ))}
    </>
  );
}

/** Alt eksen etiketleri: en az 66px aralıkla, sondan geriye doğru (son dönem her zaman yazılır). */
function XLabels({ points, plotW, step }: { points: Point[]; plotW: number; step: number }) {
  const every = Math.max(1, Math.ceil(66 / Math.max(1, step)));
  const last = points.length - 1;
  return (
    <View style={{ height: H_AXIS, marginLeft: Y_AXIS }}>
      {points.map((p, i) => (last - i) % every === 0 && i * step + step / 2 >= 20 ? (
        <Text key={i} numberOfLines={1} style={[s.xl, { left: Math.max(-6, Math.min(plotW - 56, i * step + step / 2 - 28)) }]}>{p.label}</Text>
      ) : null)}
    </View>
  );
}

/** Sütun grafiği. values[i][j]: i. dönemde j. serinin değeri; birden çok seri üst üste yığılır. */
export function BarChart({ points, values, names, colors = SERIES, height = 150, unit }: {
  points: Point[]; values: number[][]; names: string[]; colors?: string[]; height?: number; unit?: string;
}) {
  const [w, onLayout] = useWidth();
  const [sel, setSel] = useState<number | null>(null);
  const totals = values.map(v => v.reduce((a, b) => a + b, 0));
  const max = niceMax(Math.max(0, ...totals));
  const plotW = Math.max(0, w - Y_AXIS), step = points.length ? plotW / points.length : 0;
  const bw = Math.max(1, Math.min(28, step * (points.length > 60 ? 0.8 : 0.66)));
  const i = sel ?? points.length - 1;
  return (
    <View onLayout={onLayout}>
      <Readout title={points[i]?.long || points[i]?.label || ""} items={names.map((n, j) => ({ name: n, color: colors[j], value: values[i]?.[j] ?? 0 }))} total={names.length > 1 ? totals[i] : undefined} unit={unit} live={sel != null} />
      {w > 0 && (
        <View style={{ height }}>
          <Svg width={w} height={height}>
            <Axis w={w} h={height} max={max} />
            {values.map((v, k) => {
              let base = height;
              const x = Y_AXIS + k * step + (step - bw) / 2;
              const top = v.reduce((last, val, j) => (val > 0 ? j : last), -1);
              return v.map((val, j) => {
                if (val <= 0) return null;
                const hgt = (val / max) * height;
                const gap = j > 0 && base < height ? 2 : 0; // yığılmış parçalar arasında 2px zemin boşluğu
                const y = base - hgt;
                const d = barPath(x, y, bw, Math.max(0.5, hgt - gap), j === top);
                base = y;
                return <Path key={`${k}-${j}`} d={d} fill={colors[j]} opacity={sel == null || sel === k ? 1 : 0.45} />;
              });
            })}
          </Svg>
          <YLabels h={height} max={max} unit={unit} />
          <View style={[StyleSheet.absoluteFill, { left: Y_AXIS, flexDirection: "row" }]}>
            {points.map((p, k) => (
              <Pressable key={k} accessibilityLabel={`${p.long || p.label}: ${names.map((n, j) => `${n} ${values[k]?.[j] ?? 0}`).join(", ")}`}
                onPress={() => setSel(sel === k ? null : k)} onHoverIn={() => setSel(k)} onHoverOut={() => setSel(null)} style={{ width: step, height }} />
            ))}
          </View>
        </View>
      )}
      {w > 0 && <XLabels points={points} plotW={plotW} step={step} />}
    </View>
  );
}

/** Çizgi grafiği (tek seri). */
export function LineChart({ points, values, name, color = SERIES[0], height = 130, unit }: {
  points: Point[]; values: number[]; name: string; color?: string; height?: number; unit?: string;
}) {
  const [w, onLayout] = useWidth();
  const [sel, setSel] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...values));
  const plotW = Math.max(0, w - Y_AXIS), step = points.length ? plotW / points.length : 0;
  const xy = values.map((v, k) => [Y_AXIS + k * step + step / 2, height - (v / max) * (height - 4) - 2] as const);
  const d = xy.map(([x, y], k) => `${k ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const i = sel ?? points.length - 1;
  return (
    <View onLayout={onLayout}>
      <Readout title={points[i]?.long || points[i]?.label || ""} items={[{ name, color, value: values[i] ?? 0 }]} unit={unit} live={sel != null} />
      {w > 0 && (
        <View style={{ height }}>
          <Svg width={w} height={height}>
            <Axis w={w} h={height} max={max} />
            {sel != null && xy[sel] && <Line x1={xy[sel][0]} x2={xy[sel][0]} y1={0} y2={height} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />}
            <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {xy[i] && <Circle cx={xy[i][0]} cy={xy[i][1]} r={4.5} fill={color} stroke={C.panel} strokeWidth={2} />}
          </Svg>
          <YLabels h={height} max={max} unit={unit} />
          <View style={[StyleSheet.absoluteFill, { left: Y_AXIS, flexDirection: "row" }]}>
            {points.map((p, k) => (
              <Pressable key={k} accessibilityLabel={`${p.long || p.label}: ${values[k]}`} onPress={() => setSel(sel === k ? null : k)} onHoverIn={() => setSel(k)} onHoverOut={() => setSel(null)} style={{ width: step, height }} />
            ))}
          </View>
        </View>
      )}
      {w > 0 && <XLabels points={points} plotW={plotW} step={step} />}
    </View>
  );
}

/** Seçili dönemin değerleri (lejant görevi de görür: renk + ad + değer). */
function Readout({ title, items, total, unit, live }: { title: string; items: { name: string; color: string; value: number }[]; total?: number; unit?: string; live: boolean }) {
  return (
    <View style={s.readout}>
      <Text style={s.roT}>{title}{live ? "" : " · son dönem"}</Text>
      <View style={s.roItems}>
        {items.map(it => (
          <View key={it.name} style={s.roItem}>
            <View style={[s.sw, { backgroundColor: it.color }]} />
            <Text style={s.roN}>{it.name}</Text>
            <Text style={s.roV}>{fmtNum(it.value)}{unit || ""}</Text>
          </View>
        ))}
        {total != null && <Text style={s.roN}>toplam <Text style={s.roV}>{fmtNum(total)}{unit || ""}</Text></Text>}
      </View>
    </View>
  );
}

/** Yatay çubuk listesi (en çok oynanan davalar, oyun biçimleri). */
export function HBars({ rows, color = SERIES[0] }: { rows: { label: string; sub?: string; value: number; tag?: string }[]; color?: string }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <View style={{ gap: 8 }}>
      {rows.map((r, i) => (
        <View key={i} style={{ gap: 3 }}>
          <View style={s.hbHead}>
            <Text style={s.hbL} numberOfLines={1}>{r.label}</Text>
            {!!r.tag && <Text style={s.hbTag}>{r.tag}</Text>}
            <Text style={s.hbV}>{fmtNum(r.value)}</Text>
          </View>
          <View style={s.hbTrack}><View style={[s.hbBar, { width: `${Math.max(1.5, (r.value / max) * 100)}%`, backgroundColor: color }]} /></View>
          {!!r.sub && <Text style={s.hbSub} numberOfLines={1}>{r.sub}</Text>}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  yl: { position: "absolute", left: 0, width: Y_AXIS - 6, textAlign: "right", fontFamily: F.mono, fontSize: 10, color: C.muted },
  xl: { position: "absolute", top: 6, width: 56, textAlign: "center", fontFamily: F.mono, fontSize: 10, color: C.muted },
  readout: { marginBottom: 8, minHeight: 38 },
  roT: { fontFamily: F.mono, fontSize: 11, color: C.muted, marginBottom: 3 },
  roItems: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 14, rowGap: 2 },
  roItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  sw: { width: 10, height: 10, borderRadius: 2 },
  roN: { fontFamily: F.body, fontSize: 13, color: C.textSoft },
  roV: { fontFamily: F.monoBold, fontSize: 14, color: C.text },
  hbHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  hbL: { flex: 1, minWidth: 0, fontFamily: F.bodyMed, fontSize: 14, color: C.text },
  hbTag: { fontFamily: F.mono, fontSize: 10, color: C.muted, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  hbV: { fontFamily: F.monoBold, fontSize: 13, color: C.text, minWidth: 36, textAlign: "right" },
  hbTrack: { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden" },
  hbBar: { height: 8, borderRadius: 4 },
  hbSub: { fontFamily: F.body, fontSize: 12, color: C.muted }
});
