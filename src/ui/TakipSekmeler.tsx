// Dava takibinin üst sekmeleri: Föyler, Beyan editörü, İçtihat-mevzuat-doktrin, Duruşma ve keşifler, Yapılacaklar, Dava listesi, Toplu evrak yükle, Büro, Tevkil.
// Her ekranın üstünde aynı çubuk durur; föy açıkken gizlenir (föyden geri dönünce hangi sekmedeyseniz oraya dönülür).
import React from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { t } from "../i18n";
import { C } from "./theme";

export type Sekme = "foyler" | "beyan" | "kaynak" | "durusmalar" | "isler" | "liste" | "toplu" | "buro" | "tevkil";
const SEKMELER: { k: Sekme; ad: string; web?: boolean }[] = [
  { k: "foyler", ad: "📁 Föyler" }, { k: "beyan", ad: "✍ Beyan editörü" }, { k: "kaynak", ad: "📚 İçtihat, mevzuat, doktrin" }, { k: "durusmalar", ad: "⚖ Duruşma, haciz, keşif" }, { k: "isler", ad: "✅ Yapılacaklar" },
  { k: "liste", ad: "📋 Dava listesi" }, { k: "toplu", ad: "📥 Toplu evrak yükle", web: true }, { k: "buro", ad: "👥 Büro" }, { k: "tevkil", ad: "🤝 Tevkil" }
];

export function TakipSekmeler({ aktif, onSec, rozet }: { aktif: Sekme; onSec: (k: Sekme) => void; rozet?: Partial<Record<Sekme, number>> }) {
  const web = Platform.OS === "web";
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: C.wallDeep }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6, flexGrow: 1, justifyContent: "center" }} accessibilityRole="tablist">
        {SEKMELER.filter(x => web || !x.web).map(x => {
          const sec = x.k === aktif, n = rozet?.[x.k] || 0;
          return (
            <Pressable key={x.k} onPress={() => onSec(x.k)} accessibilityRole="tab" accessibilityState={{ selected: sec }}
              style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: sec ? C.brass : C.line, backgroundColor: sec ? C.bordo : "transparent", flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ color: sec ? C.text : C.textSoft, fontWeight: sec ? "800" : "600", fontSize: 13 }}>{t(x.ad)}</Text>
              {n > 0 && <View style={{ backgroundColor: C.bad, borderRadius: 9, minWidth: 18, paddingHorizontal: 5, alignItems: "center" }}><Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{n}</Text></View>}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
