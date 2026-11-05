// Celse Pro ekranı. Telefonda App Store / Google Play aboneliği RevenueCat üzerinden alınır (fiyatlar mağazadan gelir).
// Web'de satın alma yoktur: Pro mobil uygulamada alınır, aynı hesapla web'e girilince açılır.
// Satın almadan önce sunucu hesabıyla giriş istenir; böylece abonelik hesaba bağlanır ve bütün cihazlarda geçerli olur.
import React, { useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PlanInfo, PlanKind } from "../data/purchaseIds";
import { buyPlan, getPlans, PURCHASES_AVAILABLE, restorePurchases } from "../data/purchases";
import { FALLBACK_PRICE, refreshPremium, usePremium } from "../data/subscription";
import { logUsage } from "../data/usage";
import { locale, t } from "../i18n";
import { Btn } from "./kit";
import { StoreLinks } from "./StoreLinks";
import { C, F } from "./theme";

const EULA_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
const PRIVACY_URL = "https://celse.themiscode.com/gizlilik.html";
const MANAGE_URL = Platform.OS === "android" ? "https://play.google.com/store/account/subscriptions" : "https://apps.apple.com/account/subscriptions";

const BENEFITS = [
  ["Bütün kariyer", "Heyetli mahkemelerden Yargıtay'a, Danıştay'a, Sayıştay'a, Anayasa Mahkemesi'ne, AİHM'e ve UCM'ye kadar bütün bölümler."],
  ["Büro masasında bütün dosyalar", "Üst mahkemelerden gelen dosyaları kabul edin, uzmanlık alanınızda büyüyün."],
  ["Antrenmanda bütün davalar", "Kariyerde ulaştığınız her mahkemenin davalarını antrenmanda da oynayın."],
  ["Telefonda ve web'de", "Pro hesabınıza bağlanır; aynı hesapla girdiğiniz her cihazda açılır. Yeni davalar abonelik süresince eklenir."]
];

/** Sayıyı para birimiyle yazar (Intl yoksa sade biçim). */
const money = (n: number, cur: string) => {
  try { return new Intl.NumberFormat(locale(), { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(n); } catch { return `${n.toFixed(2)} ${cur}`; }
};

interface Props { onBack: () => void; onSignIn: () => void; onSignUp: () => void; signedIn: boolean; server: boolean }

export default function PaywallScreen({ onBack, onSignIn, onSignUp, signedIn, server }: Props) {
  const { premium, until, willRenew, admin, credits } = usePremium();
  const [plans, setPlans] = useState<PlanInfo[] | null>(null);
  const [plan, setPlan] = useState<PlanKind>("yillik");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!premium) logUsage("paywall_goruldu");
    if (!PURCHASES_AVAILABLE) return;
    getPlans().then(setPlans).catch(() => setPlans([]));
  }, []);

  const info = (k: PlanKind) => plans?.find(p => p.kind === k);
  const m = info("aylik"), y = info("yillik");
  const priceOf = (k: PlanKind) => info(k)?.price || FALLBACK_PRICE[k];
  // Yıllık plan avantajı ve aylık karşılığı: mağaza fiyatı varsa ondan, yoksa varsayılan fiyatlardan (149,99 × 12 = 1.799,88 yerine 999,99).
  const save = m && y && m.amount > 0 ? Math.round((1 - y.amount / (m.amount * 12)) * 100) : 44;
  const perMonth = y ? money(y.amount / 12, y.currency) : "83,33 ₺";
  const after = () => { refreshPremium(); setTimeout(refreshPremium, 4000); setTimeout(refreshPremium, 12000); };

  const buy = async () => {
    setBusy(true); setMsg("");
    const r = await buyPlan(plan);
    setBusy(false);
    if (r.ok) { setMsg(t("Celse Pro açıldı. İyi duruşmalar!")); after(); logUsage("satin_alma", { davaId: `pro_${plan}` }); }
    else if (!r.cancelled) setMsg(t("Satın alma tamamlanamadı: {hata}", { hata: t(r.error || "bilinmeyen hata") }));
  };
  const restore = async () => {
    setBusy(true); setMsg("");
    const r = await restorePurchases();
    setBusy(false);
    setMsg(r.ok ? t("Satın alımlarınız geri yüklendi. Celse Pro açık.") : r.error ? t("Geri yükleme tamamlanamadı: {hata}", { hata: t(r.error) }) : t("Bu mağaza hesabında etkin bir Celse Pro aboneliği bulunamadı."));
    if (r.ok) after();
  };

  const planCard = (k: PlanKind) => {
    const on = plan === k, yearly = k === "yillik";
    return (
      <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setPlan(k)} style={[s.plan, on && s.planOn]}>
        {yearly && <Text style={s.badge}>{t("EN AVANTAJLI · %{n}", { n: save })}</Text>}
        <Text style={s.planLabel}>{yearly ? t("Yıllık") : t("Aylık")}</Text>
        <Text style={s.price}>{priceOf(k)}<Text style={s.per}> / {yearly ? t("yıl") : t("ay")}</Text></Text>
        <Text style={s.planNote}>{yearly ? t("Aylık yaklaşık {tutar} · 12 aylık ödemeye göre %{n} avantajlı", { tutar: perMonth, n: save }) : t("İstediğiniz zaman iptal")}</Text>
      </Pressable>
    );
  };

  const disclosure = Platform.OS === "android"
    ? t("Celse Pro aylık (1 ay) ya da yıllık (1 yıl) otomatik yenilenen bir aboneliktir. Ödeme, satın almayı onayladığınızda Google Play hesabınızdan alınır. Abonelik, dönem bitmeden iptal edilmezse aynı süre ve fiyatla kendiliğinden yenilenir ve yenileme ücreti hesabınızdan alınır. Aboneliğinizi Google Play > Ödemeler ve abonelikler bölümünden yönetebilir, otomatik yenilemeyi istediğiniz zaman kapatabilirsiniz.")
    : t("Celse Pro aylık (1 ay) ya da yıllık (1 yıl) otomatik yenilenen bir aboneliktir. Ödeme, satın almayı onayladığınızda Apple ID hesabınızdan alınır. Abonelik, mevcut dönemin bitiminden en az 24 saat önce kapatılmazsa aynı süre ve fiyatla kendiliğinden yenilenir; yenileme ücreti dönem bitmeden önceki 24 saat içinde hesabınızdan alınır. Aboneliğinizi satın aldıktan sonra App Store hesap ayarlarınızdan yönetebilir, otomatik yenilemeyi kapatabilirsiniz.");

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={s.head}>
        <Btn kind="ghost" label={t("‹ Geri")} onPress={onBack} />
      </View>
      <Text style={s.eyebrow}>{t("CELSE PRO")}</Text>
      <Text style={s.title}>{premium ? t("Celse Pro etkin") : t("Kürsüye devam edin")}</Text>
      <Text style={s.sub}>
        {premium
          ? until
            ? willRenew ? t("Aboneliğiniz {tarih} tarihinde yenilenecek.", { tarih: until.toLocaleDateString(locale()) }) : t("Aboneliğiniz {tarih} tarihine kadar geçerli.", { tarih: until.toLocaleDateString(locale()) })
            : admin ? t("Bu oturumda bütün içerik açık.") : t("Bütün içerik açık.")
          : t("Kariyerin ilk bölümü ücretsiz. Celse Pro ile bütün bölümler açılır.")}
      </Text>

      <View style={s.card}>
        {BENEFITS.map(([h, d]) => (
          <View key={h} style={s.item}>
            <Text style={s.tick}>✓</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.itemT}>{t(h)}</Text>
              <Text style={s.itemD}>{t(d)}</Text>
            </View>
          </View>
        ))}
        {credits > 0 && <Text style={s.itemD}>{t("\"Derdini anlat\" krediniz: {n}", { n: credits })}</Text>}

        {!premium && !PURCHASES_AVAILABLE && (
          <View style={s.note}>
            <Text style={s.noteT}>{t("Celse Pro mobil uygulamada satın alınır")}</Text>
            <Text style={s.itemD}>{t("Aboneliği iPhone ya da Android uygulamasından alın: aylık {aylik}, yıllık {yillik}. Telefonda aldığınız Pro, aynı hesapla giriş yaptığınızda web'de de açılır.", { aylik: FALLBACK_PRICE.aylik, yillik: FALLBACK_PRICE.yillik })}</Text>
            {signedIn
              ? <Btn kind="ghost" label={t("Aboneliğimi yeniden denetle")} onPress={() => { setMsg(""); refreshPremium().then(() => setMsg(t("Abonelik durumu güncellendi."))); }} />
              : server && (
                <View style={s.row}>
                  <Btn label={t("Giriş yap")} onPress={onSignIn} />
                  <Btn kind="ghost" label={t("Üye ol")} onPress={onSignUp} />
                </View>
              )}
          </View>
        )}

        {!premium && PURCHASES_AVAILABLE && (
          <>
            <View style={s.plans}>
              {planCard("yillik")}
              {planCard("aylik")}
            </View>
            {plans !== null && !plans.length && <Text style={s.fine}>{t("Mağaza fiyatları şu an alınamadı; gösterilen fiyatlar yaklaşıktır.")}</Text>}
            {signedIn ? (
              <Btn disabled={busy} label={busy ? t("Bekleyin…") : plan === "yillik" ? t("Yıllık abone ol · {fiyat}", { fiyat: priceOf("yillik") }) : t("Aylık abone ol · {fiyat}", { fiyat: priceOf("aylik") })} onPress={buy} />
            ) : (
              <View style={s.note}>
                <Text style={s.noteT}>{t("Önce giriş yapın")}</Text>
                <Text style={s.itemD}>{server
                  ? t("Abonelik hesabınıza bağlanır; böylece telefonu değiştirseniz de web'de oynasanız da Pro açık kalır.")
                  : t("Sunucuya şu an ulaşılamıyor. İnternet bağlantınızı kontrol edip uygulamayı yeniden açın.")}</Text>
                {server && (
                  <View style={s.row}>
                    <Btn label={t("Giriş yap")} onPress={onSignIn} />
                    <Btn kind="ghost" label={t("Üye ol")} onPress={onSignUp} />
                  </View>
                )}
              </View>
            )}
          </>
        )}

        {PURCHASES_AVAILABLE && (
          <View style={s.row}>
            {!premium && <Btn kind="ghost" disabled={busy} label={t("Satın alımları geri yükle")} onPress={restore} />}
            {premium && !admin && <Btn kind="ghost" label={t("Aboneliği yönet")} onPress={() => Linking.openURL(MANAGE_URL)} />}
          </View>
        )}
        {!!msg && <Text style={s.msg}>{msg}</Text>}

        {PURCHASES_AVAILABLE && <Text style={s.fine}>{disclosure}</Text>}
        <View style={s.links}>
          <Text accessibilityRole="link" style={s.link} onPress={() => Linking.openURL(EULA_URL)}>{t("Kullanım Koşulları (EULA)")}</Text>
          <Text style={s.fine}>·</Text>
          <Text accessibilityRole="link" style={s.link} onPress={() => Linking.openURL(PRIVACY_URL)}>{t("Gizlilik politikası")}</Text>
        </View>
      </View>

      {!premium && !PURCHASES_AVAILABLE && <StoreLinks />}
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
  note: { borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 14, gap: 8, backgroundColor: C.panel2 },
  noteT: { fontFamily: F.bodyBold, fontSize: 16, color: C.brass },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  plans: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
  plan: { flexGrow: 1, flexBasis: 200, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 14, gap: 2, backgroundColor: C.panel2 },
  planOn: { borderColor: C.brass, backgroundColor: "rgba(255,255,255,0.10)" },
  badge: { alignSelf: "flex-start", fontFamily: F.mono, fontSize: 10, letterSpacing: 1, color: C.brassInk, backgroundColor: C.brass, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4 },
  planLabel: { fontFamily: F.bodyBold, fontSize: 16, color: C.text },
  price: { fontFamily: F.display, fontSize: 26, color: C.text },
  per: { fontFamily: F.body, fontSize: 15, color: C.muted },
  planNote: { fontFamily: F.body, fontSize: 13, color: C.textSoft },
  msg: { fontFamily: F.bodyMed, fontSize: 15, color: C.brass },
  fine: { fontFamily: F.body, fontSize: 13, color: C.muted },
  links: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  link: { fontFamily: F.bodyMed, fontSize: 13, color: C.brass, textDecorationLine: "underline" }
});
