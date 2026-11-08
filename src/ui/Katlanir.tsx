// Başlığına basınca altına doğru açılıp kapanan bölüm (föy sayfasında künye, zincir, mesaj, yapılacaklar, evrak).
// Açık/kapalı tercihi bölüm bölüm bu cihazda hatırlanır.
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { s } from "./foyStil";
import { C } from "./theme";

const oku = (k: string) => { try { const v = globalThis.localStorage?.getItem("celse-bolum-" + k); return v === null || v === undefined ? null : v === "1"; } catch { return null; } };
const yaz = (k: string, v: boolean) => { try { globalThis.localStorage?.setItem("celse-bolum-" + k, v ? "1" : "0"); } catch { /* yok say */ } };

export function Katlanir(p: { anahtar: string; baslik: string; ozet?: string; varsayilan?: boolean; zorla?: boolean; children: React.ReactNode }) {
  const [acik, setAcik] = useState<boolean>(() => p.zorla || (oku(p.anahtar) ?? !!p.varsayilan));
  const degis = () => { const v = !acik; setAcik(v); yaz(p.anahtar, v); };
  return (
    <View style={s.card}>
      <Pressable onPress={degis} accessibilityRole="button" accessibilityState={{ expanded: acik }} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={[s.cardT, { flex: 1 }]}>{p.baslik}</Text>
        {!!p.ozet && !acik && <Text style={[s.hint, { flexShrink: 1 }]} numberOfLines={1}>{p.ozet}</Text>}
        <Text style={{ color: C.brass, fontSize: 18 }}>{acik ? "▴" : "▾"}</Text>
      </Pressable>
      {acik && <View style={{ gap: 10 }}>{p.children}</View>}
    </View>
  );
}
