// Serbest cevap: oyuncu savunmasını kendisi yazar ya da söyler; cevap değerlendirilip puanına göre sonuç uygulanır.
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { serverReady, SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";
import { getAccessToken } from "../data/account";
import { evaluateFree } from "../engine/evaluate";
import { CaseFile, Step } from "../engine/types";
import { Btn } from "./kit";
import { C, F } from "./theme";

/** Tarayıcının konuşma tanıma özelliği (Chrome, Edge, Safari). Telefonda klavyedeki mikrofonla dikte edilir. */
function getRecognizer(): any {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const R = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return R ? new R() : null;
}

export default function FreeAnswer({ c, step, onResult }: { c: CaseFile; step: Step; onResult: (answer: string, score: number, feedback: string) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<any>(null);
  const canListen = useRef(!!getRecognizer());
  useEffect(() => () => { try { rec.current?.stop(); } catch { /* yok say */ } }, []);

  const toggleMic = () => {
    if (listening) { try { rec.current?.stop(); } catch { /* yok say */ } return; }
    const r = getRecognizer();
    if (!r) return;
    r.lang = "tr-TR"; r.interimResults = false; r.continuous = true;
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
    try { rec.current?.stop(); } catch { /* yok say */ }
    setBusy(true);
    const token = await getAccessToken();
    const ev = await evaluateFree(c, step, answer, serverReady() ? { url: SUPABASE_URL, key: SUPABASE_ANON_KEY, token } : undefined);
    setBusy(false);
    onResult(answer, ev.score, ev.feedback);
  };

  return (
    <View style={{ gap: 10 }}>
      <Text style={s.hint}>Cevabınızı kendi cümlelerinizle yazın{canListen.current ? " ya da mikrofona söyleyin" : Platform.OS !== "web" ? " ya da klavyedeki mikrofonla söyleyin" : ""}. Madde numarası vermek puanı artırır.</Text>
      <TextInput value={text} onChangeText={setText} multiline editable={!busy} placeholder="Sayın Hâkim, …" placeholderTextColor={C.muted}
        style={s.input} accessibilityLabel="Serbest cevap" maxLength={2000} />
      <View style={s.row}>
        {canListen.current && (
          <Pressable accessibilityRole="button" onPress={toggleMic} disabled={busy} style={[s.mic, listening && s.micOn]}>
            <Text style={[s.micText, listening && { color: C.brassInk }]}>{listening ? "■ Dinliyorum… durdur" : "🎤 Söyle"}</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        {busy ? (
          <View style={s.busy}><ActivityIndicator color={C.brass} /><Text style={s.hint}>Mahkeme cevabınızı değerlendiriyor…</Text></View>
        ) : (
          <Btn label="Cevabı sun ▸" onPress={submit} disabled={!text.trim()} />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  hint: { fontFamily: F.body, fontSize: 14, color: C.muted },
  input: { minHeight: 120, textAlignVertical: "top", fontFamily: F.body, fontSize: 17, color: C.text, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  mic: { borderWidth: 1, borderColor: C.brassDim, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  micOn: { backgroundColor: C.brass, borderColor: C.brass },
  micText: { fontFamily: F.bodyMed, fontSize: 15, color: C.text },
  busy: { flexDirection: "row", alignItems: "center", gap: 8 }
});
