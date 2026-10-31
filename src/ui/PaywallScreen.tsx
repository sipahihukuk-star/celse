// Abonelik ekranı. Ödeme altyapısı (App Store / Google Play aboneliği, web'de iyzico) bağlanınca "Abone ol" çalışır.
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { FREE_CASES, PRICE_LABEL, usePremium } from "../data/subscription";
import { Btn } from "./kit";
import { C, F } from "./theme";

const BENEFITS = [
  ["Bütün kariyer", "Yerel mahkemelerden Yargıtay'a, Danıştay'a, Sayıştay'a, Anayasa Mahkemesi'ne, AİHM'e ve UCM'ye kadar bütün davalar."],
  ["Karşılıklı duruşma", "Arkadaşınızla aynı cihazda ya da bilgisayara karşı bütün çok oyunculu davalar."],
  ["Serbest cevap değerlendirmesi", "Yazdığınız ya da söylediğiniz savunmayı yapay zekâ okuyup puanlar ve gerekçesini yazar."],
  ["Yeni davalar", "Abonelik süresince eklenen bütün yeni dosyalar."]
];

export default function PaywallScreen({ onBack }: { onBack: () => void }) {
  const { premium, until } = usePremium();
  const [msg, setMsg] = useState("");
  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={s.head}>
        <Btn kind="ghost" label="‹ Geri" onPress={onBack} />
      </View>
      <Text style={s.eyebrow}>CELSE · YILLIK ABONELİK</Text>
      <Text style={s.title}>{premium ? "Aboneliğiniz etkin" : "Kürsüye devam edin"}</Text>
      <Text style={s.sub}>
        {premium
          ? until ? `Aboneliğiniz ${until.toLocaleDateString("tr-TR")} tarihine kadar geçerli.` : "Bu oturumda bütün içerik açık."
          : `İlk ${FREE_CASES} dava ücretsiz. Yıllık abonelikle oyunun tamamı açılır.`}
      </Text>
      <View style={s.card}>
        {BENEFITS.map(([t, d]) => (
          <View key={t} style={s.item}>
            <Text style={s.tick}>✓</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.itemT}>{t}</Text>
              <Text style={s.itemD}>{d}</Text>
            </View>
          </View>
        ))}
        {!premium && (
          <>
            <Text style={s.price}>{PRICE_LABEL || "Fiyat yakında açıklanacak"}</Text>
            <Btn label="Yıllık abone ol" onPress={() => setMsg("Ödeme sistemi kurulum aşamasında. Abonelik çok yakında açılacak.")} />
            {!!msg && <Text style={s.msg}>{msg}</Text>}
            <Text style={s.fine}>Telefonda App Store ya da Google Play hesabınızdan, web'de kartla ödenir. Abonelik hesabınıza bağlanır; bütün cihazlarda geçerlidir. Yenilemeyi istediğiniz zaman kapatabilirsiniz.</Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 20, gap: 10 },
  head: { flexDirection: "row" },
  eyebrow: { fontFamily: F.mono, fontSize: 12, letterSpacing: 2.5, color: C.muted, marginTop: 8 },
  title: { fontFamily: F.display, fontSize: 34, color: C.brass },
  sub: { fontFamily: F.body, fontSize: 17, color: C.textSoft },
  card: { marginTop: 10, backgroundColor: C.panel, borderWidth: 1, borderColor: C.brassDim, borderRadius: 12, padding: 18, gap: 14 },
  item: { flexDirection: "row", gap: 10 },
  tick: { fontFamily: F.bodyBold, fontSize: 18, color: C.brass, width: 20 },
  itemT: { fontFamily: F.bodyBold, fontSize: 17, color: C.text },
  itemD: { fontFamily: F.body, fontSize: 15, color: C.textSoft },
  price: { fontFamily: F.display, fontSize: 24, color: C.text, marginTop: 6 },
  msg: { fontFamily: F.bodyMed, fontSize: 15, color: C.brass },
  fine: { fontFamily: F.body, fontSize: 13, color: C.muted }
});
