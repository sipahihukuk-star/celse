// Dava takibinin üst çubuğu: solda "☰" menü düğmesi ve açık bölümün adı, sağda "🎙 Sesli asistan".
// ☰'a basınca ekranın solundan aşağı doğru uzanan menü açılır: Föyler, Müvekkillerim, Başvuru yap, Beyan editörü,
// İçtihat-mevzuat-doktrin, Duruşma ve keşifler, Yapılacaklar, Dava listesi, Toplu evrak yükle, Büro, Tevkil, Şahsi dosyalarım
// ve hemen altında Sesli asistan. Föy açıkken çubuk gizlenir (föyden geri dönünce hangi bölümdeyseniz oraya dönülür).
import React, { useState } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { t } from "../i18n";
import { C } from "./theme";
import { asistanAc } from "./SesliAsistan";

export type Sekme = "foyler" | "muvekkil" | "basvuru" | "sahsi" | "beyan" | "kaynak" | "durusmalar" | "isler" | "liste" | "toplu" | "buro" | "tevkil";
const SEKMELER: { k: Sekme; ad: string; web?: boolean }[] = [
  { k: "foyler", ad: "📁 Föyler" }, { k: "muvekkil", ad: "👤 Müvekkillerim" }, { k: "basvuru", ad: "📝 Başvuru yap" }, { k: "beyan", ad: "✍ Beyan editörü" },
  { k: "kaynak", ad: "📚 İçtihat, mevzuat, doktrin" }, { k: "durusmalar", ad: "⚖ Duruşma, haciz, keşif" }, { k: "isler", ad: "✅ Yapılacaklar" },
  { k: "liste", ad: "📋 Dava listesi" }, { k: "toplu", ad: "📥 Toplu evrak yükle", web: true }, { k: "buro", ad: "👥 Büro" }, { k: "tevkil", ad: "🤝 Tevkil" },
  { k: "sahsi", ad: "🔒 Şahsi dosyalarım" }
];

export function TakipSekmeler({ aktif, onSec, rozet }: { aktif: Sekme; onSec: (k: Sekme) => void; rozet?: Partial<Record<Sekme, number>> }) {
  const web = Platform.OS === "web";
  const [acik, setAcik] = useState(false);
  const liste = SEKMELER.filter(x => web || !x.web);
  const secili = liste.find(x => x.k === aktif);
  const toplam = liste.reduce((a, x) => a + (rozet?.[x.k] || 0), 0);
  const sec = (k: Sekme) => { setAcik(false); onSec(k); };
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: C.wallDeep, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
      <Pressable onPress={() => setAcik(true)} accessibilityRole="button" accessibilityLabel={t("Menü")}
        style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: C.brass, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", lineHeight: 20 }}>☰</Text>
        {toplam > 0 && <View style={{ backgroundColor: C.bad, borderRadius: 9, minWidth: 18, paddingHorizontal: 5, alignItems: "center" }}><Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{toplam}</Text></View>}
      </Pressable>
      <Text style={{ flex: 1, color: C.text, fontWeight: "800", fontSize: 15 }} numberOfLines={1}>{secili ? t(secili.ad) : ""}</Text>
      <Pressable onPress={asistanAc} accessibilityRole="button" accessibilityLabel={t("Sesli asistan")}
        style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: C.brass }}>
        <Text style={{ color: C.text, fontWeight: "700", fontSize: 13 }}>{t("🎙 Sesli asistan")}</Text>
      </Pressable>

      <Modal visible={acik} transparent animationType="fade" onRequestClose={() => setAcik(false)}>
        <View style={{ flex: 1, flexDirection: "row" }}>
          <View style={{ width: 300, maxWidth: "85%", height: "100%", backgroundColor: C.wallDeep, borderRightWidth: 1, borderRightColor: C.brass, paddingTop: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
              <Text style={{ flex: 1, color: C.brass, fontWeight: "800", fontSize: 13, letterSpacing: 1 }}>{t("DAVA TAKİBİ")}</Text>
              <Pressable onPress={() => setAcik(false)} accessibilityRole="button" accessibilityLabel={t("Menüyü kapat")} style={{ padding: 6 }}>
                <Text style={{ color: C.text, fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingVertical: 8 }} accessibilityRole="tablist">
              {liste.map(x => {
                const on = x.k === aktif, n = rozet?.[x.k] || 0;
                return (
                  <Pressable key={x.k} onPress={() => sec(x.k)} accessibilityRole="tab" accessibilityState={{ selected: on }}
                    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 13, backgroundColor: on ? C.bordo : pressed ? C.panel2 : "transparent", borderLeftWidth: 3, borderLeftColor: on ? C.brass : "transparent" })}>
                    <Text style={{ flex: 1, color: on ? C.text : C.textSoft, fontWeight: on ? "800" : "600", fontSize: 15 }}>{t(x.ad)}</Text>
                    {n > 0 && <View style={{ backgroundColor: C.bad, borderRadius: 9, minWidth: 20, paddingHorizontal: 5, alignItems: "center" }}><Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{n}</Text></View>}
                  </Pressable>
                );
              })}
              <Pressable onPress={() => { setAcik(false); asistanAc(); }} accessibilityRole="button"
                style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 13, backgroundColor: pressed ? C.panel2 : "transparent", borderLeftWidth: 3, borderLeftColor: "transparent" })}>
                <Text style={{ color: C.brass, fontWeight: "700", fontSize: 15 }}>{t("🎙 Sesli asistan")}</Text>
              </Pressable>
            </ScrollView>
          </View>
          <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={() => setAcik(false)} accessibilityLabel={t("Menüyü kapat")} />
        </View>
      </Modal>
    </View>
  );
}
