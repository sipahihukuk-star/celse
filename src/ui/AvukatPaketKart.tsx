// Celse Avukat paketi satın alma kartı (Evrakla duruşma provası ekranında). Yönetimde "Celse Avukat satışı" açılınca görünür.
// Telefonda mağaza fiyatlarıyla abonelik alınır; paket ödeme bildirimiyle sunucuda açılır ve aynı hesapla web'de de geçerlidir.
// Web'de şimdilik satış yoktur (iyzico onayından sonra eklenecek); telefon uygulamasına yönlendirilir.
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, View } from "react-native";
import { buyAvukat, getAvukatPlans, PURCHASES_AVAILABLE, restorePurchases } from "../data/purchases";
import type { AvukatPlan } from "../data/purchaseIds";
import { refreshPremium, usePremium } from "../data/subscription";
import { useSettings } from "../data/settings";
import { Btn } from "./kit";
import { t } from "../i18n";
import { C, F } from "./theme";

export function AvukatPaketKart() {
  const st = useSettings();
  const prem = usePremium();
  const [planlar, setPlanlar] = useState<AvukatPlan[] | null>(null);
  const [mesgul, setMesgul] = useState("");
  const [mesaj, setMesaj] = useState("");
  useEffect(() => { if (PURCHASES_AVAILABLE && st.avukatSatis) getAvukatPlans().then(setPlanlar).catch(() => setPlanlar([])); }, [st.avukatSatis]);
  if (!st.avukatSatis || prem.avukat?.aktif) return null;

  // Satın almadan sonra ödeme bildirimi sunucuya birkaç saniyede ulaşır; paket açılana kadar kısa aralıklarla yeniden okunur.
  const bekle = async () => {
    for (let i = 0; i < 12; i++) {
      await refreshPremium();
      await new Promise(r => setTimeout(r, 2500));
    }
  };
  const al = async (p: AvukatPlan) => {
    setMesaj(""); setMesgul(p.productId);
    const r = await buyAvukat(p.productId);
    if (r.ok) { setMesaj(t("Teşekkürler. Paketiniz birkaç saniye içinde açılır.")); await bekle(); }
    else if (!r.cancelled) setMesaj(t(r.error || "Satın alma tamamlanamadı."));
    setMesgul("");
  };
  const geriYukle = async () => {
    setMesgul("geri"); setMesaj("");
    await restorePurchases(); await refreshPremium();
    setMesgul("");
  };

  return (
    <View style={s.kart}>
      <Text style={s.eyebrow}>{t("CELSE AVUKAT")}</Text>
      <Text style={s.baslik}>{t("Evrakla duruşma provası için paket")}</Text>
      <Text style={s.madde}>• {t("Ayda 160 kredi: hazırlık notları 1, yapay zekâ canlandırması 3, Ben oynayayım 3 kredi; büyük dosya derlemesi yaklaşık 250 sayfada 1 kredi")}</Text>
      <Text style={s.madde}>• {t("Celse Pro dahil: bütün kariyer bölümleri ve dosyalar")}</Text>
      <Text style={s.madde}>• {t("Aynı hesapla iPhone, Android ve web'de geçerli")}</Text>
      {Platform.OS === "web" || !PURCHASES_AVAILABLE ? (
        <>
          <Text style={s.not}>{t("Paketi şimdilik Celse telefon uygulamasından (App Store ya da Google Play) alabilirsiniz; aldığınız an aynı hesapla burada da açılır.")}</Text>
          <View style={s.row}>
            <Btn kind="secondary" label="App Store" onPress={() => Linking.openURL(st.iosLink)} />
            <Btn kind="secondary" label="Google Play" onPress={() => Linking.openURL(st.androidLink)} />
          </View>
        </>
      ) : planlar === null ? <ActivityIndicator color={C.brass} /> : planlar.length === 0 ? (
        <Text style={s.not}>{t("Paket şu an mağazada görünmüyor. Biraz sonra yeniden deneyin.")}</Text>
      ) : (
        <View style={s.row}>
          {planlar.map(p => (
            <Btn key={p.productId} label={mesgul === p.productId ? t("Bekleyin…") : p.kind === "aylik" ? t("Aylık · {f}", { f: p.price }) : t("Yıllık · {f}", { f: p.price })}
              kind={p.kind === "yillik" ? "primary" : "secondary"} disabled={!!mesgul} onPress={() => al(p)} />
          ))}
        </View>
      )}
      {!!mesaj && <Text style={s.not}>{mesaj}</Text>}
      {Platform.OS !== "web" && PURCHASES_AVAILABLE && (
        <>
          <Text style={s.not}>{t("Abonelik, siz iptal edene kadar dönem sonunda aynı süreyle yenilenir; mağaza hesabınızın abonelik ayarlarından istediğiniz an iptal edebilirsiniz.")}</Text>
          <Btn kind="ghost" label={mesgul === "geri" ? t("Bekleyin…") : t("Satın alımları geri yükle")} disabled={!!mesgul} onPress={geriYukle} />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  kart: { borderWidth: 1, borderColor: C.brassDim, borderRadius: 14, padding: 16, gap: 8, backgroundColor: C.panel2 },
  eyebrow: { fontFamily: F.mono, fontSize: 11, letterSpacing: 2, color: C.brassDim },
  baslik: { fontFamily: F.display, fontSize: 22, color: C.text },
  madde: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: C.textSoft },
  not: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: C.muted },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 }
});
