// Web'de yeni sürüm uyarısı: açık kalan sekme (özellikle telefonda saatlerce açık duran tarayıcı) eski sürümle çalışmaya devam
// eder. Sayfa öne gelince ve 5 dakikada bir sunucudaki index.html'in uygulama dosyası adına bakılır; değişmişse üstte
// "Celse güncellendi · Yenile" çıkar. Yalnız sitenin kendi index.html'i okunur, hiçbir veri gönderilmez.
import React, { useEffect, useState } from "react";
import { Platform, Pressable, Text } from "react-native";
import { t } from "../i18n";
import { C } from "./theme";

const DESEN = /_expo\/static\/js\/web\/(index-[a-f0-9]+\.js)/;

export function YeniSurum() {
  const [var_, setVar] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const simdiki = [...document.scripts].map(x => x.src.match(DESEN)?.[1]).find(Boolean);
    if (!simdiki) return; // geliştirme sunucusu
    let son = 0;
    const bak = async () => {
      if (document.visibilityState === "hidden" || Date.now() - son < 60_000) return;
      son = Date.now();
      try {
        const r = await fetch("./?surum=" + Date.now(), { cache: "no-store" });
        const yeni = (await r.text()).match(DESEN)?.[1];
        if (yeni && yeni !== simdiki) setVar(true);
      } catch { /* çevrim dışı */ }
    };
    const z = setInterval(bak, 5 * 60_000);
    document.addEventListener("visibilitychange", bak);
    window.addEventListener("focus", bak);
    const ilk = setTimeout(bak, 15_000);
    return () => { clearInterval(z); clearTimeout(ilk); document.removeEventListener("visibilitychange", bak); window.removeEventListener("focus", bak); };
  }, []);
  if (!var_) return null;
  return (
    <Pressable onPress={() => window.location.reload()} accessibilityRole="button"
      style={{ position: "fixed" as "absolute", top: 8, left: 8, right: 8, zIndex: 100, alignSelf: "center", maxWidth: 520, marginHorizontal: "auto", backgroundColor: C.brass, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 }}>
      <Text style={{ color: C.brassInk, fontWeight: "800", textAlign: "center" }}>{t("Celse güncellendi · yeni sürüme geçmek için dokunun")}</Text>
    </Pressable>
  );
}
