// Web sürümünün giriş sayfasının altında duran yasal bilgiler: satış sözleşmesi, ön bilgilendirme, iade, teslimat, fiyatlar,
// gizlilik ve iletişim sayfalarına bağlantılar, satıcı (şirket) bilgileri ve ödeme yöntemi işaretleri.
// Mesafeli Sözleşmeler Yönetmeliği ve ödeme kuruluşlarının üye işyeri koşulları bu bilgilerin sitede kolayca bulunmasını ister.
import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SATICI } from "../legal/satis";
import { WEB_URL } from "../data/settings";
import { C, F } from "./theme";

const LINKS: [string, string][] = [
  ["Mesafeli Satış Sözleşmesi", "satis-sozlesmesi.html"],
  ["Ön Bilgilendirme Formu", "on-bilgilendirme.html"],
  ["İade ve Cayma Hakkı", "iade.html"],
  ["Teslimat ve Hizmet Sunumu", "teslimat.html"],
  ["Fiyatlar", "fiyatlar.html"],
  ["Gizlilik ve KVKK", "gizlilik.html"],
  ["İletişim", "iletisim.html"]
];

const MARKS = ["VISA", "Mastercard", "TROY"];

export function LegalFooter({ onShop }: { onShop?: () => void } = {}) {
  return (
    <View style={s.wrap}>
      <View style={s.links}>
        <Pressable accessibilityRole="link" onPress={onShop || (() => Linking.openURL(WEB_URL + "?magaza"))} hitSlop={4} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
          <Text style={[s.link, { fontFamily: F.bodyBold }]}>Satın al</Text>
        </Pressable>
        {LINKS.map(([label, file]) => (
          <Pressable key={file} accessibilityRole="link" onPress={() => Linking.openURL(WEB_URL + file)} hitSlop={4}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
            <Text style={s.link}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.marks}>
        {MARKS.map(m => <Text key={m} style={s.mark}>{m}</Text>)}
      </View>
      <Text style={s.company}>{SATICI.unvan}</Text>
      <Text style={s.meta}>{SATICI.adres} · {SATICI.telefon} · {SATICI.eposta}</Text>
      <Text style={s.meta}>MERSİS {SATICI.mersis} · {SATICI.vergi}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 28, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line, gap: 10 },
  links: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 6 },
  link: { fontFamily: F.body, fontSize: 13, color: C.brass, textDecorationLine: "underline" },
  marks: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mark: { fontFamily: F.bodyBold, fontSize: 12, letterSpacing: 0.5, color: C.text, borderWidth: 1, borderColor: C.line, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: C.panel2 },
  company: { fontFamily: F.bodyBold, fontSize: 12, color: C.muted },
  meta: { fontFamily: F.body, fontSize: 12, lineHeight: 17, color: C.muted }
});
