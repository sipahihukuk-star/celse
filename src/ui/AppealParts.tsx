// Kanun yolu aşamasının iki özel adımı: oyuncunun süre son gününü kendisinin yazdığı tarih alanı ve dilekçe önizlemesi.
import React, { useRef, useState } from "react";
import { Platform, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { petitionOf } from "../engine/appeal";
import { gradeDeadline, longDate, parseDate } from "../engine/deadline";
import { GameState } from "../engine/engine";
import { CaseFile, Step } from "../engine/types";
import { t } from "../i18n";
import { hideKeyboardBar, kbBar } from "./KeyboardBar";
import { Btn } from "./kit";
import { C, F } from "./theme";

/** Gün / ay / yıl alanları (web ve telefonda aynı; sayı klavyesi). Sonuç serbest cevap gibi puanla bildirilir. */
export function DeadlineAnswer({ c, step, onResult }: { c: CaseFile; step: Step; onResult: (answer: string, score: number, feedback: string) => void }) {
  const r = step.deadline!;
  const teblig = parseDate(r.teblig);
  const [d, setD] = useState(""), [m, setM] = useState(""), [y, setY] = useState(teblig ? String(teblig.getUTCFullYear()) : "");
  const [err, setErr] = useState("");
  const mRef = useRef<any>(null), yRef = useRef<any>(null);
  const digits = (s: string) => s.replace(/\D/g, "");
  const submit = () => {
    const answer = `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`;
    const g = gradeDeadline(r, answer, c.appealOf?.regime);
    if (!g) { setErr(t("Geçerli bir tarih yazın (GG.AA.YYYY).")); return; }
    onResult(answer, g.score, g.feedback);
  };
  return (
    <View style={s.wrap}>
      <View style={s.teblig}>
        <Text style={s.k}>{t("TEBLİĞ TARİHİ")}</Text>
        <Text style={s.v}>{teblig ? longDate(teblig) : r.teblig}</Text>
        {!!r.what && <Text style={s.what}>{r.what}</Text>}
      </View>
      <Text style={s.k}>{t("SON GÜN")}</Text>
      <View style={s.row}>
        <Field label={t("Gün")} value={d} width={58} max={2} onChange={v => { setD(digits(v)); setErr(""); if (digits(v).length === 2) mRef.current?.focus(); }} onSubmit={() => mRef.current?.focus()} />
        <Text style={s.dot}>.</Text>
        <Field inputRef={mRef} label={t("Ay")} value={m} width={58} max={2} onChange={v => { setM(digits(v)); setErr(""); if (digits(v).length === 2) yRef.current?.focus(); }} onSubmit={() => yRef.current?.focus()} />
        <Text style={s.dot}>.</Text>
        <Field inputRef={yRef} label={t("Yıl")} value={y} width={86} max={4} onChange={v => { setY(digits(v)); setErr(""); }} onSubmit={submit} />
        <View style={s.submit}><Btn kind="next" label={t("Son günü bildir ▸")} onPress={submit} disabled={!d || !m || y.length !== 4} /></View>
      </View>
      {!!err && <Text style={s.err} accessibilityRole="alert">{err}</Text>}
      <Text style={s.hint}>{t("Süreyi kendiniz hesaplayın; son gün tatile rastlıyorsa bunu da gözetin.")}</Text>
    </View>
  );
}

function Field({ label, value, width, max, onChange, onSubmit, inputRef }: { label: string; value: string; width: number; max: number; onChange: (v: string) => void; onSubmit: () => void; inputRef?: React.Ref<any> }) {
  return (
    <View style={{ gap: 4 }}>
      <TextInput {...kbBar} ref={inputRef} value={value} onChangeText={onChange} onSubmitEditing={onSubmit} keyboardType="number-pad" inputMode="numeric" maxLength={max}
        onFocus={() => hideKeyboardBar(Platform.OS === "ios")} onBlur={() => hideKeyboardBar(false)}
        placeholder={max === 4 ? "YYYY" : max === 2 && label === t("Gün") ? "GG" : "AA"} placeholderTextColor={C.muted} returnKeyType={max === 4 ? "done" : "next"}
        accessibilityLabel={label} style={[s.input, { width }]} />
      <Text style={s.small}>{label}</Text>
    </View>
  );
}

/** Dilekçe önizlemesi: oyuncunun önceki adımlarda kurduğu dilekçe, kâğıt üzerinde. */
export function PetitionPaper({ c, game, stepIdx, name, onSubmit }: { c: CaseFile; game: GameState; stepIdx: number; name: string; onSubmit: () => void }) {
  const p = petitionOf(c, game, stepIdx);
  const narrow = useWindowDimensions().width < 600;
  // Misafir oyuncunun adı yok ("Siz"): imza yeri boş bırakılır.
  const signer = !name || name === "Siz" || name === t("Siz") ? t("Av. (imza)") : name;
  const merci = p.sections.find(x => x.title === "MERCİ");
  const rest = p.sections.filter(x => x !== merci);
  return (
    <View style={{ gap: 12 }}>
      <View style={s.paper}>
        {merci ? merci.lines.slice(-1).map((l, i) => <Text key={i} style={s.to}>{l}</Text>) : null}
        <Text style={s.title}>{p.title}</Text>
        <View style={s.meta}>
          {p.meta.map(x => (
            <View key={x.k} style={narrow ? s.metaCol : s.metaRow}><Text style={[s.metaK, narrow && { minWidth: 0, paddingTop: 0 }]}>{x.k.toLocaleUpperCase("tr")}</Text><Text style={s.metaV}>{x.v}</Text></View>
          ))}
        </View>
        {rest.map(sec => (
          <View key={sec.title} style={{ marginTop: 12 }}>
            <Text style={s.secT}>{sec.title}</Text>
            {sec.lines.map((l, i) => <Text key={i} style={s.secL}>{l}</Text>)}
          </View>
        ))}
        {!rest.length && <Text style={s.secL}>{t("Bu dilekçede henüz bir sebep yok.")}</Text>}
        <View style={s.sign}>
          <Text style={s.secL}>{t("Saygılarımızla,")}</Text>
          <Text style={s.signName}>{signer}</Text>
          {!!p.sign && <Text style={s.small2}>{p.sign}</Text>}
        </View>
      </View>
      <View style={s.actions}><Btn kind="next" label={t("Dilekçeyi sun ▸")} onPress={onSubmit} /></View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 10 },
  teblig: { backgroundColor: C.paper, borderRadius: 6, padding: 12, gap: 2, alignSelf: "flex-start", minWidth: 240 },
  k: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: C.muted },
  v: { fontFamily: F.bodyBold, fontSize: 18, color: C.ink },
  what: { fontFamily: F.body, fontSize: 13, color: C.inkSoft },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 6, flexWrap: "wrap" },
  submit: { marginLeft: 10, paddingTop: 2 },
  dot: { fontFamily: F.monoBold, fontSize: 24, color: C.muted, paddingTop: 6 },
  input: { fontFamily: F.monoBold, fontSize: 22, color: C.text, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, textAlign: "center" },
  small: { fontFamily: F.mono, fontSize: 10, color: C.muted, textAlign: "center" },
  err: { fontFamily: F.bodyMed, fontSize: 14, color: C.bad },
  hint: { fontFamily: F.body, fontSize: 14, color: C.muted },
  actions: { flexDirection: "row", justifyContent: "flex-end" },
  paper: { backgroundColor: C.paperHi, borderRadius: 3, padding: 18, borderWidth: 1, borderColor: C.rule },
  to: { fontFamily: F.bodyBold, fontSize: 14, lineHeight: 20, color: C.ink, textAlign: "center" },
  title: { fontFamily: F.display, fontSize: 18, letterSpacing: 2, color: C.ink, textAlign: "center", marginTop: 12 },
  meta: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.rule, paddingVertical: 8, marginTop: 10, gap: 4 },
  metaRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  metaCol: { gap: 1, marginBottom: 4 },
  metaK: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1, color: C.inkSoft, minWidth: 150, paddingTop: 3 },
  metaV: { fontFamily: F.bodyMed, fontSize: 14, color: C.ink, flexShrink: 1 },
  secT: { fontFamily: F.monoBold, fontSize: 12, letterSpacing: 1.5, color: C.ink, marginBottom: 4 },
  secL: { fontFamily: F.body, fontSize: 14, lineHeight: 21, color: C.ink, marginBottom: 4 },
  sign: { alignItems: "flex-end", marginTop: 14 },
  signName: { fontFamily: F.bodyBold, fontSize: 15, color: C.ink },
  small2: { fontFamily: F.body, fontSize: 13, color: C.inkSoft }
});
