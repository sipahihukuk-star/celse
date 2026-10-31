// Yönetim panelinin form bileşenleri: alan, çok satırlı alan, seçim düğmeleri, liste düzenleyici, koşullu metin.
import React, { ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Line, Text as RichText } from "../engine/types";
import { C, F } from "../ui/theme";

export function Section({ title, hint, children, right }: { title: string; hint?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.sectionTitle}>{title}</Text>
          {!!hint && <Text style={s.hint}>{hint}</Text>}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

export function Field({ label, value, onChange, placeholder, hint, mono, numeric, width }: {
  label: string; value: string | number | undefined; onChange: (v: string) => void; placeholder?: string; hint?: string; mono?: boolean; numeric?: boolean; width?: number | string;
}) {
  return (
    <View style={[s.field, width !== undefined && { width: width as any, flexGrow: 0 }]}>
      <Text style={s.label}>{label}</Text>
      <TextInput value={value === undefined ? "" : String(value)} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.muted}
        keyboardType={numeric ? "numbers-and-punctuation" : "default"} autoCapitalize="none" autoCorrect={false}
        style={[s.input, mono && s.mono]} />
      {!!hint && <Text style={s.hint}>{hint}</Text>}
    </View>
  );
}

export function Area({ label, value, onChange, placeholder, hint, rows = 3, mono }: {
  label: string; value: string | undefined; onChange: (v: string) => void; placeholder?: string; hint?: string; rows?: number; mono?: boolean;
}) {
  return (
    <View style={s.fieldFull}>
      <Text style={s.label}>{label}</Text>
      <TextInput value={value || ""} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.muted} multiline
        style={[s.input, { minHeight: rows * 22 + 16, textAlignVertical: "top" }, mono && s.mono]} />
      {!!hint && <Text style={s.hint}>{hint}</Text>}
    </View>
  );
}

export function Seg<T extends string>({ label, value, options, onChange }: { label?: string; value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={s.fieldFull}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <View style={s.seg}>
        {options.map(o => (
          <Pressable key={o.v} accessibilityRole="radio" accessibilityState={{ checked: value === o.v }} onPress={() => onChange(o.v)}
            style={[s.segItem, value === o.v && s.segOn]}>
            <Text style={[s.segText, value === o.v && s.segTextOn]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={s.toggle}>
      <View style={[s.box, value && s.boxOn]}>{value && <Text style={s.tick}>✓</Text>}</View>
      <Text style={s.toggleText}>{label}</Text>
    </Pressable>
  );
}

export function SmallBtn({ label, onPress, tone = "plain", disabled }: { label: string; onPress: () => void; tone?: "plain" | "accent" | "danger"; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}
      style={({ pressed }) => [s.small, tone === "accent" && s.smallAccent, tone === "danger" && s.smallDanger, (pressed || disabled) && { opacity: 0.6 }]}>
      <Text style={[s.smallText, tone === "accent" && { color: C.brassInk }, tone === "danger" && { color: C.bad }]}>{label}</Text>
    </Pressable>
  );
}

export const Row = ({ children }: { children: ReactNode }) => <View style={s.row}>{children}</View>;

/** Sıralanabilir, eklenip silinebilir liste. Her öğe kendi kartında, katlanabilir. */
export function ListEditor<T>({ items, onChange, render, title, make, addLabel, collapsedTitle }: {
  items: T[]; onChange: (items: T[]) => void; render: (item: T, update: (v: T) => void, i: number) => ReactNode;
  title: (item: T, i: number) => string; make: () => T; addLabel: string; collapsedTitle?: boolean;
}) {
  const [open, setOpen] = useState<number | null>(collapsedTitle ? null : 0);
  const move = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= items.length) return;
    const next = [...items]; [next[i], next[j]] = [next[j], next[i]]; onChange(next); setOpen(j);
  };
  return (
    <View style={{ gap: 8 }}>
      {items.map((it, i) => (
        <View key={i} style={s.item}>
          <Pressable onPress={() => setOpen(open === i ? null : i)} style={s.itemHead} accessibilityRole="button">
            <Text style={s.itemNo}>{i + 1}</Text>
            <Text style={s.itemTitle} numberOfLines={1}>{title(it, i) || "(boş)"}</Text>
            <View style={s.itemTools}>
              <SmallBtn label="↑" onPress={() => move(i, -1)} disabled={i === 0} />
              <SmallBtn label="↓" onPress={() => move(i, 1)} disabled={i === items.length - 1} />
              <SmallBtn label="Sil" tone="danger" onPress={() => onChange(items.filter((_, k) => k !== i))} />
            </View>
          </Pressable>
          {open === i && <View style={s.itemBody}>{render(it, v => onChange(items.map((x, k) => (k === i ? v : x))), i)}</View>}
        </View>
      ))}
      <View style={{ flexDirection: "row" }}><SmallBtn label={`+ ${addLabel}`} onPress={() => { onChange([...items, make()]); setOpen(items.length); }} /></View>
    </View>
  );
}

/** Düz metin ya da koşullu parçalardan oluşan metin (not, hüküm, özet). */
export function TextEditor({ label, value, onChange, hint }: { label: string; value: RichText | undefined; onChange: (v: RichText) => void; hint?: string }) {
  if (value === undefined || typeof value === "string") {
    return (
      <View style={s.fieldFull}>
        <Area label={label} value={value as string} onChange={onChange} hint={hint} />
        <View style={{ flexDirection: "row" }}><SmallBtn label="Koşullu parçalara böl" onPress={() => onChange([{ text: (value as string) || "" }])} /></View>
      </View>
    );
  }
  return (
    <View style={s.fieldFull}>
      <Text style={s.label}>{label} · koşullu parçalar</Text>
      <Text style={s.hint}>Koşulu tutan parçalar sırayla birleştirilir. Koşulsuz parça her zaman görünür.</Text>
      <ListEditor<{ if?: string; text: string }> items={value} onChange={onChange} addLabel="Parça ekle" make={() => ({ text: "" })}
        title={p => (p.if ? `[${p.if}] ` : "") + p.text}
        render={(p, up) => (<>
          <Field label="Koşul (boşsa her zaman)" value={p.if} onChange={v => up({ ...p, if: v || undefined })} mono placeholder="ör. makbuz && !ikrar" />
          <Area label="Metin" value={p.text} onChange={v => up({ ...p, text: v })} />
        </>)} />
      <View style={{ flexDirection: "row" }}><SmallBtn label="Düz metne çevir" onPress={() => onChange(value.map(p => p.text).join(""))} /></View>
    </View>
  );
}

/** Konuşma satırları. */
export function LinesEditor({ label, lines, onChange, speakers }: { label: string; lines: Line[] | undefined; onChange: (v: Line[]) => void; speakers: { v: string; label: string }[] }) {
  return (
    <View style={s.fieldFull}>
      <Text style={s.label}>{label}</Text>
      <ListEditor<Line> items={lines || []} onChange={onChange} addLabel="Satır ekle" make={() => ({ who: "narr", text: "" })} collapsedTitle
        title={l => `${speakers.find(x => x.v === l.who)?.label || l.who}: ${l.text}`}
        render={(l, up) => (<>
          <Seg label="Konuşan" value={l.who} options={speakers} onChange={v => up({ ...l, who: v })} />
          <Area label="Metin" value={l.text} onChange={v => up({ ...l, text: v })} />
          <Field label="Koşul (boşsa her zaman)" value={l.if} onChange={v => up({ ...l, if: v || undefined })} mono />
        </>)} />
    </View>
  );
}

export const csv = (v: string) => v.split(",").map(x => x.trim()).filter(Boolean);

const s = StyleSheet.create({
  section: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 14, gap: 10 },
  sectionHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  sectionTitle: { fontFamily: F.displayMed, fontSize: 18, color: C.brass },
  hint: { fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 2 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  field: { flexGrow: 1, flexBasis: 200, minWidth: 0, gap: 4 },
  fieldFull: { width: "100%", gap: 4 },
  label: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: C.muted, textTransform: "uppercase" },
  input: { fontFamily: F.body, fontSize: 16, color: C.text, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8 },
  mono: { fontFamily: F.mono, fontSize: 14 },
  seg: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  segItem: { borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  segOn: { backgroundColor: C.brass, borderColor: C.brass },
  segText: { fontFamily: F.body, fontSize: 14, color: C.text },
  segTextOn: { color: C.brassInk, fontFamily: F.bodyBold },
  toggle: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  box: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: C.brassDim, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: C.brass, borderColor: C.brass },
  tick: { color: C.brassInk, fontSize: 13, fontFamily: F.bodyBold },
  toggleText: { fontFamily: F.body, fontSize: 15, color: C.text },
  small: { borderWidth: 1, borderColor: C.line, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.panel2 },
  smallAccent: { backgroundColor: C.brass, borderColor: C.brass },
  smallDanger: { borderColor: "rgba(214,90,69,0.5)" },
  smallText: { fontFamily: F.bodyMed, fontSize: 13, color: C.text },
  item: { borderWidth: 1, borderColor: C.line, borderRadius: 8, backgroundColor: C.wallDeep },
  itemHead: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8 },
  itemNo: { fontFamily: F.monoBold, fontSize: 12, color: C.brass, minWidth: 18 },
  itemTitle: { flex: 1, minWidth: 0, fontFamily: F.body, fontSize: 15, color: C.text },
  itemTools: { flexDirection: "row", gap: 4 },
  itemBody: { padding: 10, paddingTop: 0, gap: 10 }
});
