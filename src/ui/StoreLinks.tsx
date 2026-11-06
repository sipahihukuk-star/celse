// Web sürümünde "Telefonunuza indirin" kartı: iPhone ve Android için QR kodları ve bağlantılar.
// Bağlantılar yönetim panelinden (Oyun ayarları) değiştirilebilir; test döneminde TestFlight / Play test bağlantısı olabilir.
import qrcode from "qrcode-generator";
import React, { useMemo } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { useSettings } from "../data/settings";
import { t } from "../i18n";
import { C, F } from "./theme";

export function QR({ value, size = 132 }: { value: string; size?: number }) {
  const { n, d } = useMemo(() => {
    const q = qrcode(0, "M"); q.addData(value); q.make();
    const n = q.getModuleCount(); let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { n, d };
  }, [value]);
  const pad = 2;
  return (
    <Svg width={size} height={size} viewBox={`${-pad} ${-pad} ${n + pad * 2} ${n + pad * 2}`} accessibilityLabel={value}>
      <Rect x={-pad} y={-pad} width={n + pad * 2} height={n + pad * 2} fill="#ffffff" />
      <Path d={d} fill="#1c0a0f" />
    </Svg>
  );
}

export function StoreLinks() {
  const st = useSettings();
  const Item = ({ label, sub, url }: { label: string; sub: string; url: string }) => (
    <Pressable accessibilityRole="link" onPress={() => Linking.openURL(url)} style={({ pressed }) => [s.item, pressed && { opacity: 0.85 }]}>
      <View style={s.qr}><QR value={url} /></View>
      <Text style={s.label}>{label}</Text>
      <Text style={s.sub}>{sub}</Text>
    </Pressable>
  );
  return (
    <View style={s.card}>
      <Text style={s.eyebrow}>{t("TELEFONUNUZA İNDİRİN")}</Text>
      <Text style={s.title}>{t("Celse cebinizde")}</Text>
      <Text style={s.sub}>{t("Telefonunuzun kamerasıyla QR kodu okutun. Kariyeriniz hesabınıza kayıtlıdır; telefonda kaldığınız yerden devam edersiniz.")}</Text>
      <View style={s.row}>
        <Item label="iPhone · App Store" sub={t("iOS")} url={st.iosLink} />
        <Item label="Android · Google Play" sub={t("Android")} url={st.androidLink} />
      </View>
    </View>
  );
}

/** Geniş web ekranında ön yüzün iki yanındaki QR: solda iPhone, sağda Android. Sayfa kaydırılmadan görünür. */
export function StoreRail({ platform }: { platform: "ios" | "android" }) {
  const st = useSettings();
  const ios = platform === "ios";
  const url = ios ? st.iosLink : st.androidLink;
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={ios ? "iPhone · App Store" : "Android · Google Play"} onPress={() => Linking.openURL(url)}
      style={({ pressed }) => [s.rail, pressed && { opacity: 0.85 }]}>
      <Text style={[s.eyebrow, { textAlign: "center" }]}>{t("TELEFONUNUZA İNDİRİN")}</Text>
      <View style={s.qr}><QR value={url} size={120} /></View>
      <Text style={s.label}>{ios ? "iPhone · App Store" : "Android · Google Play"}</Text>
      <Text style={[s.sub, { textAlign: "center" }]}>{t("Kamerayla okutun")}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  rail: { width: 168, alignItems: "center", gap: 8, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 10 },
  card: { borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, borderRadius: 14, padding: 16, gap: 6, marginTop: 18 },
  eyebrow: { fontFamily: F.mono, fontSize: 11, letterSpacing: 2, color: C.brassDim },
  title: { fontFamily: F.display, fontSize: 22, color: C.text },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 8 },
  item: { alignItems: "center", gap: 6 },
  qr: { padding: 6, backgroundColor: "#fff", borderRadius: 10 },
  label: { fontFamily: F.bodyBold, fontSize: 14, color: C.text },
  sub: { fontFamily: F.body, fontSize: 13, color: C.muted }
});
