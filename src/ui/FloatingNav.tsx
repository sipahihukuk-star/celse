// Uzun sayfalarda sağ altta duran gezinti düğmeleri: aşağı inilince "↑ Başa dön" ve isteğe bağlı "‹ Geri".
// Kullanım: ScrollView'a onScroll={nav.onScroll} scrollEventThrottle={64} ref={nav.ref} verin, ScrollView'ın kardeşi olarak <FloatingNav nav={nav} /> koyun.
import React, { useRef, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { t } from "../i18n";
import { C, F } from "./theme";

export function useFloatingNav(threshold = 600) {
  const ref = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [show, setShow] = useState(false);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    if ((y > threshold) !== show) setShow(y > threshold);
  };
  const toTop = () => { ref.current?.scrollTo({ y: 0, animated: true }); };
  return { ref, show, onScroll, toTop };
}

export function FloatingNav({ nav, onBack, backLabel }: { nav: ReturnType<typeof useFloatingNav>; onBack?: () => void; backLabel?: string }) {
  if (!nav.show) return null;
  return (
    <View pointerEvents="box-none" style={s.wrap}>
      {!!onBack && (
        <Pressable accessibilityRole="button" onPress={onBack} style={({ pressed }) => [s.btn, pressed && { opacity: 0.8 }]}>
          <Text style={s.t}>{backLabel || t("‹ Geri")}</Text>
        </Pressable>
      )}
      <Pressable accessibilityRole="button" accessibilityLabel={t("Sayfanın başına dön")} onPress={nav.toTop} style={({ pressed }) => [s.btn, s.top, pressed && { opacity: 0.8 }]}>
        <Text style={s.t}>↑ {t("Başa dön")}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: "absolute", right: 16, bottom: 20, flexDirection: "row", gap: 10, zIndex: 50 },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.brassDim, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  top: { backgroundColor: C.bordo, borderColor: "rgba(255,255,255,0.35)" },
  t: { fontFamily: F.bodyBold, fontSize: 14, color: C.text }
});
