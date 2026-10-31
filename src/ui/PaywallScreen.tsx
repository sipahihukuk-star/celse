// Abonelik ekranı. Ödeme altyapısı (App Store / Google Play aboneliği, web'de iyzico) bağlanınca "Abone ol" çalışır.
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { FREE_CASES, PLANS, tl, usePremium } from "../data/subscription";
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
  const [plan, setPlan] = useState<string>("yillik");
  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={s.head}>
        <Btn kind="ghost" label="‹ Geri" onPress={onBack} />
      </View>
      <Text style={s.eyebrow}>CELSE · ABONELİK</Text>
      <Text style={s.title}>{premium ? "Aboneliğiniz etkin" : "Kürsüye devam edin"}</Text>
      <Text style={s.sub}>
        {premium
          ? until ? `Aboneliğiniz ${until.toLocaleDateString("tr-TR")} tarihine kadar geçerli.` : "Bu oturumda bütün içerik açık."
          : `İlk ${FREE_CASES} dava ücretsiz. Abonelikle oyunun tamamı açılır.`}
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
            <View style={s.plans}>
              {PLANS.map(p => (
                <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ checked: plan === p.id }} onPress={() => setPlan(p.id)}
                  style={[s.plan, plan === p.id && s.planOn]}>
                  {"best" in p && p.best && <Text style={s.badge}>EN AVANTAJLI</Text>}
                  <Text style={s.planLabel}>{p.label}</Text>
                  <Text style={s.price}>{tl(p.price)}<Text style={s.per}> / {p.per}</Text></Text>
                  <Text style={s.planNote}>{p.note}</Text>
                </Pressable>
              ))}
            </View>
            <Btn label={plan === "yillik" ? "Yıllık abone ol" : "Aylık abone ol"} onPress={() => setMsg("Ödeme sistemi kurulum aşamasında. Abonelik çok yakında açılacak.")} />
            {!!msg && <Text style={s.msg}>{msg}</Text>}
            <Text style={s.fine}>Fiyatlara KDV dahildir. Telefonda App Store ya da Google Play hesabınızdan, web'de kartla ödenir. Abonelik dönem sonunda kendiliğinden yenilenir; yenilemeyi istediğiniz zaman kapatabilirsiniz. Abonelik hesabınıza bağlanır ve bütün cihazlarda geçerlidir.</Text>
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
  plans: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
  plan: { flexGrow: 1, flexBasis: 200, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 14, gap: 2, backgroundColor: C.panel2 },
  planOn: { borderColor: C.brass, backgroundColor: "rgba(255,255,255,0.10)" },
  badge: { alignSelf: "flex-start", fontFamily: F.mono, fontSize: 10, letterSpacing: 1, color: C.brassInk, backgroundColor: C.brass, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4 },
  planLabel: { fontFamily: F.bodyBold, fontSize: 16, color: C.text },
  price: { fontFamily: F.display, fontSize: 26, color: C.text },
  per: { fontFamily: F.body, fontSize: 15, color: C.muted },
  planNote: { fontFamily: F.body, fontSize: 13, color: C.textSoft },
  msg: { fontFamily: F.bodyMed, fontSize: 15, color: C.brass },
  fine: { fontFamily: F.body, fontSize: 13, color: C.muted }
});
