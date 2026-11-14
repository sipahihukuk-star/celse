// Uzayan liste: belli yükseklikte kalır, yanındaki ▲ / ▼ düğmeleriyle yukarı ve aşağı kayar (duruşma günleri, simülasyon).
import React, { useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { t } from "../i18n";
import { C } from "./theme";

/** Uzayan gün listesi: belli bir yükseklikte kalır, yanında ▲ / ▼ düğmeleriyle yukarı ve aşağı kayar; ilk açılışta en
 *  yeni günler (alt kısım) görünür. Liste kısaysa düğmeler çıkmaz. */
export function KayanListe({ children, yukseklik = 250, sonaGit = true }: { children: React.ReactNode; yukseklik?: number; sonaGit?: boolean }) {
  const KAYAN_YUKSEKLIK = yukseklik;
  const ref = useRef<React.ElementRef<typeof ScrollView>>(null);
  const [h, setH] = useState(0);
  const [y, setY] = useState(0);
  const ilk = useRef(true);
  const uzun = h > KAYAN_YUKSEKLIK + 4;
  const kay = (d: number) => ref.current?.scrollTo({ y: Math.max(0, Math.min(h - KAYAN_YUKSEKLIK, y + d)), animated: true });
  const dugme = (yazi: string, d: number, kapali: boolean, ad: string) => (
    <Pressable onPress={() => kay(d)} disabled={kapali} accessibilityRole="button" accessibilityLabel={ad} hitSlop={4}
      style={{ width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: kapali ? C.line : C.brass, alignItems: "center", justifyContent: "center", opacity: kapali ? 0.4 : 1 }}>
      <Text style={{ color: kapali ? C.muted : C.brass, fontSize: 13, fontWeight: "800" }}>{yazi}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      <ScrollView ref={ref} style={{ flex: 1, maxHeight: KAYAN_YUKSEKLIK }} contentContainerStyle={{ gap: 6 }} nestedScrollEnabled showsVerticalScrollIndicator={uzun}
        scrollEventThrottle={32} onScroll={e => setY(e.nativeEvent.contentOffset.y)}
        onContentSizeChange={(_w, yuk) => { setH(yuk); if (sonaGit && ilk.current && yuk > KAYAN_YUKSEKLIK) { ilk.current = false; setTimeout(() => { ref.current?.scrollToEnd({ animated: false }); setY(yuk - KAYAN_YUKSEKLIK); }, 60); } }}>
        {children}
      </ScrollView>
      {uzun && (
        <View style={{ justifyContent: "space-between", paddingVertical: 2 }}>
          {dugme("▲", -120, y <= 2, t("Yukarı kaydır"))}
          {dugme("▼", 120, y >= h - KAYAN_YUKSEKLIK - 2, t("Aşağı kaydır"))}
        </View>
      )}
    </View>
  );
}
