// Karşılıklı duruşmanın son bölümü: taraflar son sözlerini yazar ya da söyler, yapay zekâ hâkim kararı verir.
// Aynı cihazda iki oyuncu varsa sıra karşı tarafa geçerken önceki metin gizlenir. Bilgisayar rakibin son sözü hamlelerinden derlenir.
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AI_FUNCTION, serverReady, SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";
import { getAccessToken } from "../data/account";
import { GameState } from "../engine/engine";
import { aiClosing, AiVerdict, judgeDuel } from "../engine/judge";
import { CaseFile, Player, Side } from "../engine/types";
import { Btn } from "./kit";
import { C, F, sideColor } from "./theme";

function getRecognizer(): any {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const R = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return R ? new R() : null;
}

export default function ClosingScreen({ c, game, players, onDone }: { c: CaseFile; game: GameState; players: Record<Side, Player>; onDone: (v: AiVerdict) => void }) {
  const order: Side[] = ["p1", "p2"];
  const [turn, setTurn] = useState(0);
  const [said, setSaid] = useState<Record<Side, string>>({ p1: "", p2: "" });
  const [text, setText] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<any>(null);
  const canListen = !!getRecognizer();
  const side = order[turn];

  // Bilgisayar tarafının sözü kendiliğinden yazılır.
  useEffect(() => {
    if (turn < 2 && players[side].ai) { setSaid(x => ({ ...x, [side]: aiClosing(c, game, side) })); setTurn(t => t + 1); }
  }, [turn]);
  useEffect(() => {
    if (turn < 2 || busy) return;
    setBusy(true);
    (async () => {
      const token = await getAccessToken();
      const v = await judgeDuel(c, game, said.p1, said.p2, serverReady() ? { url: SUPABASE_URL, key: SUPABASE_ANON_KEY, token, fn: AI_FUNCTION } : undefined);
      onDone(v);
    })();
  }, [turn]);

  const toggleMic = () => {
    if (listening) { try { rec.current?.stop(); } catch { /* yok say */ } return; }
    const r = getRecognizer(); if (!r) return;
    r.lang = "tr-TR"; r.interimResults = false; r.continuous = true;
    const base = text ? text.trimEnd() + " " : ""; let got = "";
    r.onresult = (e: any) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) got += e.results[i][0].transcript + " "; setText(base + got.trim()); };
    r.onend = () => setListening(false); r.onerror = () => setListening(false);
    rec.current = r; setListening(true);
    try { r.start(); } catch { setListening(false); }
  };
  const submit = () => {
    try { rec.current?.stop(); } catch { /* yok say */ }
    setSaid(x => ({ ...x, [side]: text.trim() }));
    setText(""); setReady(false); setTurn(t => t + 1);
  };

  if (turn >= 2 || busy) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.brass} size="large" />
        <Text style={s.title}>Hâkim karar için çekildi</Text>
        <Text style={s.sub}>Duruşma tutanağı ve son sözler değerlendiriliyor…</Text>
      </View>
    );
  }
  if (players[side].ai) return <View style={s.center}><ActivityIndicator color={C.brass} /></View>;
  const twoHumans = !players.p1.ai && !players.p2.ai;

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <Text style={s.eyebrow}>{c.court.toLocaleUpperCase("tr")} · SON SÖZ</Text>
      <Text style={[s.title, { color: sideColor(side) }]}>{players[side].name} · {c.sides[side].role}</Text>
      {twoHumans && !ready ? (
        <View style={{ gap: 12 }}>
          <Text style={s.sub}>{turn === 0 ? "Hâkim taraflara son sözlerini soruyor. Önce" : "Şimdi sıra"} {players[side].name}. {turn === 1 ? "Cihazı karşı tarafa verin; önceki tarafın yazdığı gizli kalacak." : "Karşı taraf ekrana bakmasın."}</Text>
          <Btn label="Hazırım ▸" onPress={() => setReady(true)} />
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Text style={s.sub}>Davanın özünü, dayandığınız kanun maddelerini ve karşı tarafın zayıf noktasını birkaç cümlede söyleyin. Kararı yapay zekâ hâkim verecek: duruşmadaki hamleleriniz ve bu son söz birlikte değerlendirilir.</Text>
          <TextInput value={text} onChangeText={setText} multiline placeholder="Sayın Mahkeme, …" placeholderTextColor={C.muted} style={s.input} maxLength={2500} accessibilityLabel="Son söz" />
          <View style={s.row}>
            {canListen && (
              <Pressable accessibilityRole="button" onPress={toggleMic} style={[s.mic, listening && s.micOn]}>
                <Text style={[s.micText, listening && { color: C.brassInk }]}>{listening ? "■ Dinliyorum… durdur" : "🎤 Söyle"}</Text>
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            <Btn label="Son sözü sun ▸" onPress={submit} disabled={!text.trim()} style={!text.trim() && { opacity: 0.5 }} />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 24, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  eyebrow: { fontFamily: F.mono, fontSize: 12, letterSpacing: 2, color: C.muted },
  title: { fontFamily: F.display, fontSize: 26, color: C.brass, textAlign: "center" },
  sub: { fontFamily: F.body, fontSize: 16, color: C.textSoft },
  input: { minHeight: 160, borderWidth: 1, borderColor: C.line, borderRadius: 10, backgroundColor: C.panel, color: C.text, fontFamily: F.body, fontSize: 17, padding: 12, textAlignVertical: "top" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  mic: { borderWidth: 1, borderColor: C.brassDim, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  micOn: { backgroundColor: C.brass, borderColor: C.brass },
  micText: { fontFamily: F.bodyMed, fontSize: 15, color: C.text }
});
