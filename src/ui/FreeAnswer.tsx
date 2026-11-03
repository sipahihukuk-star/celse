// Serbest cevap: oyuncu savunmasını kendisi yazar ya da söyler; cevap değerlendirilip puanına göre sonuç uygulanır.
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { kbBar } from "./KeyboardBar";
import { useKeyboardOpen } from "./keyboard";
import { AI_FUNCTION, serverReady, SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";
import { getAccessToken } from "../data/account";
import { evaluateFree } from "../engine/evaluate";
import { CaseFile, Step } from "../engine/types";
import { Btn } from "./kit";
import { C, F } from "./theme";
import { locale, t } from "../i18n";
import { hasDegree } from "../data/life";
import { isIntl, useOffice } from "../data/office";

/** Uluslararası dosyada savunma dili: Türkçe, İngilizce ya da Fransızca. */
const ANSWER_LANGS = [
  { v: "", label: "Türkçe", rec: "", ph: "" },
  { v: "en", label: "English", rec: "en-GB", ph: "Members of the Tribunal, …" },
  { v: "fr", label: "Français", rec: "fr-FR", ph: "Monsieur le Président, Mesdames et Messieurs les juges, …" }
];

/** Tarayıcının konuşma tanıma özelliği (Chrome, Edge, Safari). Telefonda klavyedeki mikrofonla dikte edilir. */
function getRecognizer(): any {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const R = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return R ? new R() : null;
}

export default function FreeAnswer({ c, step, onResult }: { c: CaseFile; step: Step; onResult: (answer: string, score: number, feedback: string) => void }) {
  const [text, setText] = useState("");
  const kbOpen = useKeyboardOpen();
  const { office } = useOffice();
  const intl = isIntl(c);
  const [alang, setAlang] = useState("");
  const cur = ANSWER_LANGS.find(x => x.v === alang)!;
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<any>(null);
  const canListen = useRef(!!getRecognizer());
  useEffect(() => () => { try { rec.current?.stop(); } catch { /* yok say */ } }, []);

  const toggleMic = () => {
    if (listening) { try { rec.current?.stop(); } catch { /* yok say */ } return; }
    const r = getRecognizer();
    if (!r) return;
    r.lang = cur.rec || locale(); r.interimResults = false; r.continuous = true;
    const base = text ? text.trimEnd() + " " : "";
    let said = "";
    r.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) said += e.results[i][0].transcript + " ";
      setText(base + said.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r; setListening(true);
    try { r.start(); } catch { setListening(false); }
  };

  const submit = async () => {
    const answer = text.trim();
    if (!answer || busy) return;
    Keyboard.dismiss();
    try { rec.current?.stop(); } catch { /* yok say */ }
    setBusy(true);
    const token = await getAccessToken();
    // Dil kursunu bitirmiş avukat o dilde savunursa daha çok, kurssuz yabancı dilde savunursa az ek puan alır.
    const bonus = alang ? (hasDegree(office?.life, alang) ? 8 : 3) : 0;
    const ev = await evaluateFree(c, step, answer, serverReady() ? { url: SUPABASE_URL, key: SUPABASE_ANON_KEY, token, fn: AI_FUNCTION } : undefined, alang ? { answerLang: alang, bonus } : undefined);
    setBusy(false);
    onResult(answer, ev.score, ev.feedback);
  };

  return (
    <View style={{ gap: 10 }}>
      <Text style={s.hint}>{canListen.current ? t("Cevabınızı kendi cümlelerinizle yazın ya da mikrofona söyleyin. Madde numarası vermek puanı artırır.")
        : Platform.OS !== "web" ? t("Cevabınızı kendi cümlelerinizle yazın ya da klavyedeki mikrofonla söyleyin. Madde numarası vermek puanı artırır.")
        : t("Cevabınızı kendi cümlelerinizle yazın. Madde numarası vermek puanı artırır.")}</Text>
      {intl && (
        <View style={s.langRow}>
          <Text style={s.hint}>{t("Savunma dili:")}</Text>
          {ANSWER_LANGS.map(l => (
            <Pressable key={l.v} accessibilityRole="radio" accessibilityState={{ selected: alang === l.v }} onPress={() => setAlang(l.v)} style={[s.lang, alang === l.v && s.langOn]}>
              <Text style={[s.langT, alang === l.v && { color: C.brassInk }]}>{l.label}</Text>
            </Pressable>
          ))}
          {!!alang && <Text style={s.hint}>{hasDegree(office?.life, alang) ? t("Dil kursunuz var: +8 puan") : t("Yabancı dilde savunma: +3 puan (kursla +8)")}</Text>}
        </View>
      )}
      <TextInput {...kbBar} value={text} onChangeText={setText} multiline editable={!busy} placeholder={cur.ph || (c.room === "tahkim" ? t("Sayın Hakem Heyeti, …") : t("Sayın Hâkim, …"))} placeholderTextColor={C.muted}
        style={s.input} accessibilityLabel={t("Serbest cevap")} maxLength={2000}
        returnKeyType="done" submitBehavior="blurAndSubmit" onSubmitEditing={() => Keyboard.dismiss()} />
      {kbOpen && (
        <Pressable accessibilityRole="button" onPress={() => Keyboard.dismiss()} style={s.kbClose}>
          <Text style={s.kbCloseT}>{t("Klavyeyi kapat ⌄")}</Text>
        </Pressable>
      )}
      <View style={s.row}>
        {canListen.current && (
          <Pressable accessibilityRole="button" onPress={toggleMic} disabled={busy} style={[s.mic, listening && s.micOn]}>
            <Text style={[s.micText, listening && { color: C.brassInk }]}>{listening ? t("■ Dinliyorum… durdur") : t("🎤 Söyle")}</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        {busy ? (
          <View style={s.busy}><ActivityIndicator color={C.brass} /><Text style={s.hint}>{c.room === "tahkim" ? t("Hakem heyeti cevabınızı değerlendiriyor…") : t("Mahkeme cevabınızı değerlendiriyor…")}</Text></View>
        ) : (
          <Btn label={t("Cevabı sun ▸")} onPress={submit} disabled={!text.trim()} />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  kbClose: { alignSelf: "flex-end", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2 },
  kbCloseT: { fontFamily: F.bodyMed, fontSize: 14, color: C.text },
  langRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  lang: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  langOn: { backgroundColor: C.brass, borderColor: C.brass },
  langT: { fontFamily: F.mono, fontSize: 12, color: C.text },
  hint: { fontFamily: F.body, fontSize: 14, color: C.muted },
  input: { minHeight: 120, textAlignVertical: "top", fontFamily: F.body, fontSize: 17, color: C.text, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  mic: { borderWidth: 1, borderColor: C.brassDim, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  micOn: { backgroundColor: C.brass, borderColor: C.brass },
  micText: { fontFamily: F.bodyMed, fontSize: 15, color: C.text },
  busy: { flexDirection: "row", alignItems: "center", gap: 8 }
});
