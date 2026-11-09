// Açılır kutu: başlık ve seçili değer görünür, basınca seçenekler altında listelenir; seçince kapanır.
// Çok sayıda düğme yerine (durum, tür, dava türü, aşama, sıralama) tek kutu.
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { C } from "./theme";

export interface Secenek { k: string; ad: string; n?: number }

export function Acilir(p: { etiket: string; secenekler: Secenek[]; secili: string; onSec: (k: string) => void; genislik?: number; acikBasla?: boolean }) {
  const [acik, setAcik] = useState(!!p.acikBasla);
  const sec = p.secenekler.find(x => x.k === p.secili) || p.secenekler[0];
  const yaz = (x?: Secenek) => (x ? x.ad + (x.n !== undefined ? ` (${x.n})` : "") : "");
  return (
    <View style={{ minWidth: p.genislik || 170, flexGrow: 0, gap: 4 }}>
      <Text style={{ color: C.muted, fontSize: 11, letterSpacing: 0.5 }}>{p.etiket}</Text>
      <Pressable onPress={() => setAcik(!acik)} accessibilityRole="button" accessibilityLabel={`${p.etiket}: ${yaz(sec)}`}
        style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: acik ? C.brass : C.line, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: C.panel2 }}>
        <Text style={{ color: C.text, flex: 1 }} numberOfLines={1}>{yaz(sec)}</Text>
        <Text style={{ color: C.brass }}>{acik ? "▴" : "▾"}</Text>
      </Pressable>
      {acik && (
        <ScrollView style={{ maxHeight: 280, borderWidth: 1, borderColor: C.line, borderRadius: 10, backgroundColor: C.panel }} nestedScrollEnabled>
          {p.secenekler.map(x => (
            <Pressable key={x.k} onPress={() => { p.onSec(x.k); setAcik(false); }} accessibilityRole="button"
              style={{ paddingVertical: 8, paddingHorizontal: 12, flexDirection: "row", gap: 8, backgroundColor: x.k === p.secili ? C.panel2 : "transparent" }}>
              <Text style={{ color: C.brass, width: 14 }}>{x.k === p.secili ? "✓" : ""}</Text>
              <Text style={{ color: C.text, flex: 1 }}>{yaz(x)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
