// Web mağazası: Celse Pro (aylık, yıllık) ve "Derdini anlat" kredi paketleri; ürün → sepet → sipariş özeti ve onaylar → ödeme.
// Ürünler, fiyatlar ve açıklamalar yasal sayfalarla aynı kaynaktan gelir (src/legal/satis.ts · URUNLER), böylece
// sitede ve sözleşmelerde yazan fiyat hep aynıdır. Kart ödemesi lisanslı ödeme kuruluşunun sayfasında alınır (üye işyeri onayından sonra bağlanır).
// Sepet sayfa içinde saklanır; giriş yapmak için mağazadan çıkıp dönünce kaybolmaz.
import React, { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { WEB_URL } from "../data/settings";
import { logUsage } from "../data/usage";
import { URUNLER, Urun } from "../legal/satis";
import { t } from "../i18n";
import { Btn } from "./kit";
import { LegalFooter } from "./LegalFooter";
import { C, F } from "./theme";

type Cart = Record<string, number>;
let CART: Cart = {};
const subs = new Set<(c: Cart) => void>();
const setCart = (c: Cart) => { CART = c; subs.forEach(f => f(c)); };
function useCart(): [Cart, (c: Cart) => void] {
  const [c, set] = useState<Cart>(CART);
  useEffect(() => { subs.add(set); return () => { subs.delete(set); }; }, []);
  return [c, setCart];
}

const MAX_KREDI_ADET = 10;
const tl = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TL";
const byId = (id: string) => URUNLER.find(u => u.id === id);
const lines = (c: Cart) => Object.entries(c).map(([id, n]) => ({ u: byId(id), n })).filter((l): l is { u: Urun; n: number } => !!l.u && l.n > 0);
const total = (c: Cart) => lines(c).reduce((a, l) => a + l.u.fiyat * l.n, 0);
const count = (c: Cart) => lines(c).reduce((a, l) => a + l.n, 0);
const open = (file: string) => Linking.openURL(WEB_URL + file);

/** Sepete ekleme kuralı: abonelikten yalnız biri (aylık ya da yıllık) ve 1 adet; kredi paketleri adetli. */
function add(c: Cart, u: Urun): Cart {
  if (u.tur === "abonelik") {
    const rest = Object.fromEntries(Object.entries(c).filter(([id]) => byId(id)?.tur !== "abonelik"));
    return { ...rest, [u.id]: 1 };
  }
  return { ...c, [u.id]: Math.min(MAX_KREDI_ADET, (c[u.id] || 0) + 1) };
}

type Step = "urun" | "sepet" | "odeme";
interface Props { onBack: () => void; signedIn: boolean; server: boolean; buyer?: { ad: string; eposta: string }; onSignIn: () => void; onSignUp: () => void }

export default function ShopScreen({ onBack, signedIn, server, buyer, onSignIn, onSignUp }: Props) {
  const [cart, update] = useCart();
  const [step, setStep] = useState<Step>(() => (count(CART) ? "sepet" : "urun"));
  const [ok, setOk] = useState({ on: false, mesafeli: false, ifa: false });
  const [msg, setMsg] = useState("");
  const scroll = React.useRef<React.ComponentRef<typeof ScrollView>>(null);
  useEffect(() => { logUsage("paywall_goruldu", { davaId: "web_magaza" }); }, []);
  const go = (s: Step) => { setStep(s); setMsg(""); scroll.current?.scrollTo({ y: 0, animated: false }); };

  const l = lines(cart);
  const hasSub = l.some(x => x.u.tur === "abonelik");
  const sub = l.find(x => x.u.tur === "abonelik")?.u;
  const ready = ok.on && ok.mesafeli && (!hasSub || ok.ifa);

  const pay = () => {
    if (!ready) { setMsg(t("Devam etmek için onay kutularını işaretleyin.")); return; }
    logUsage("paywall_goruldu", { davaId: "web_magaza_odeme" });
    setMsg(t("Kartla ödeme, ödeme kuruluşunun üye işyeri onayı tamamlanınca bu adımda açılacak. O zamana kadar Celse Pro'yu ve danışma kredilerini iPhone ya da Android uygulamasından alabilirsiniz; aynı hesapla girdiğinizde web'de de geçerli olur."));
  };

  const Steps = () => (
    <View style={s.steps}>
      {([["urun", "1. Ürünler"], ["sepet", `2. Sepet (${count(cart)})`], ["odeme", "3. Sipariş ve ödeme"]] as [Step, string][]).map(([k, label]) => (
        <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: step === k }} disabled={k !== "urun" && !count(cart)}
          onPress={() => go(k)} style={[s.stepChip, step === k && s.stepOn]}>
          <Text style={[s.stepT, step === k && s.stepTOn]}>{t(label)}</Text>
        </Pressable>
      ))}
    </View>
  );

  const ProductCard = ({ u }: { u: Urun }) => {
    const n = cart[u.id] || 0;
    return (
      <View style={[s.prod, n > 0 && s.prodOn]}>
        <Text style={s.prodK}>{u.tur === "abonelik" ? t("ABONELİK") : t("KREDİ PAKETİ")}</Text>
        <Text style={s.prodT}>{u.ad}</Text>
        <Text style={s.price}>{u.fiyatMetni}<Text style={s.per}>{u.donem ? ` / ${u.donem}` : ""}</Text></Text>
        <Text style={s.fine}>{t("KDV dahil")}</Text>
        <Text style={s.desc}>{u.kisa}</Text>
        {u.icerik.map(i => <Text key={i} style={s.bullet}>✓ {i}</Text>)}
        <View style={{ flex: 1 }} />
        <Btn kind={n > 0 ? "ghost" : "primary"} label={n > 0 ? (u.tur === "abonelik" ? t("Sepette ✓") : t("Bir tane daha ekle ({n})", { n })) : t("Sepete ekle")}
          onPress={() => { update(add(cart, u)); setMsg(t("{ad} sepete eklendi.", { ad: u.ad })); }} disabled={u.tur === "abonelik" && n > 0} />
      </View>
    );
  };

  const Summary = ({ editable }: { editable: boolean }) => (
    <View style={s.card}>
      {l.map(({ u, n }) => (
        <View key={u.id} style={s.line}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.lineT}>{u.ad}</Text>
            <Text style={s.fine}>{u.fiyatMetni}{u.donem ? ` / ${u.donem}` : ""}{u.tur === "kredi" ? ` × ${n}` : ""}</Text>
          </View>
          {editable && u.tur === "kredi" && (
            <View style={s.qty}>
              <Pressable accessibilityRole="button" accessibilityLabel={t("Azalt")} onPress={() => update({ ...cart, [u.id]: n - 1 })} style={s.qtyBtn}><Text style={s.qtyT}>−</Text></Pressable>
              <Text style={s.qtyN}>{n}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t("Artır")} disabled={n >= MAX_KREDI_ADET} onPress={() => update({ ...cart, [u.id]: n + 1 })} style={s.qtyBtn}><Text style={s.qtyT}>+</Text></Pressable>
            </View>
          )}
          <Text style={s.lineP}>{tl(u.fiyat * n)}</Text>
          {editable && (
            <Pressable accessibilityRole="button" accessibilityLabel={t("Sepetten çıkar")} onPress={() => { const c = { ...cart }; delete c[u.id]; update(c); }} hitSlop={8}>
              <Text style={s.remove}>✕</Text>
            </Pressable>
          )}
        </View>
      ))}
      <View style={[s.line, s.totalLine]}>
        <Text style={[s.lineT, { flex: 1 }]}>{t("Toplam (KDV dahil)")}</Text>
        <Text style={s.totalP}>{tl(total(cart))}</Text>
      </View>
      <Text style={s.fine}>{t("Teslimat ücreti yoktur. Ürünler ödeme onaylanınca Celse hesabınıza anında tanımlanır.")}</Text>
      {sub && <Text style={s.fine}>{t("{ad}, siz iptal edene kadar her {donem} aynı fiyatla yenilenir. İstediğiniz an Hesap > Abonelik bölümünden ya da e-postayla iptal edebilirsiniz; ödenen dönemin sonuna kadar Pro açık kalır.", { ad: sub.ad, donem: sub.donem || "" })}</Text>}
    </View>
  );

  const Check = ({ on, set, children }: { on: boolean; set: (v: boolean) => void; children: React.ReactNode }) => (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => set(!on)} style={s.check}>
      <View style={[s.box, on && s.boxOn]}>{on && <Text style={s.boxTick}>✓</Text>}</View>
      <Text style={s.checkT}>{children}</Text>
    </Pressable>
  );
  const Link = ({ file, label }: { file: string; label: string }) => <Text style={s.inlineLink} onPress={() => open(file)}>{label}</Text>;

  return (
    <ScrollView ref={scroll} contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
      <View style={s.head}>
        <Btn kind="ghost" label={t("‹ Geri")} onPress={step === "urun" ? onBack : () => go(step === "odeme" ? "sepet" : "urun")} />
        <View style={{ flex: 1 }} />
        {count(cart) > 0 && step === "urun" && <Btn label={t("Sepet ({n}) ›", { n: count(cart) })} onPress={() => go("sepet")} />}
      </View>
      <Text style={s.eyebrow}>{t("CELSE · SATIN AL")}</Text>
      <Text style={s.title}>{step === "urun" ? t("Celse Pro ve Derdini Anlat") : step === "sepet" ? t("Sepetiniz") : t("Sipariş özeti ve ödeme")}</Text>
      <Steps />

      {step === "urun" && (
        <>
          <Text style={s.sub}>{t("Kariyerin ilk bölümü, tahkim bölümü ve karşılıklı duruşma ücretsizdir. Celse Pro ile bütün kariyer açılır; Derdini Anlat ayrı satılan danışma kredileriyle kullanılır.")}</Text>
          <View style={s.grid}>{URUNLER.map(u => <ProductCard key={u.id} u={u} />)}</View>
          <Text style={s.fine}>{t("Derdini Anlat eğitim amaçlı bir simülasyondur; hukuki danışmanlık ya da avukatlık hizmeti değildir. Bütün fiyatlar Türk lirasıdır ve KDV dahildir.")}</Text>
          <Text style={s.inlineRow}><Link file="fiyatlar.html" label={t("Fiyat listesi")} /> · <Link file="iade.html" label={t("İade ve cayma hakkı")} /> · <Link file="teslimat.html" label={t("Teslimat")} /></Text>
        </>
      )}

      {step === "sepet" && (count(cart) ? (
        <>
          <Summary editable />
          <View style={s.row}>
            <Btn kind="ghost" label={t("Alışverişe devam et")} onPress={() => go("urun")} />
            <Btn label={t("Siparişi tamamla ›")} onPress={() => go("odeme")} />
          </View>
        </>
      ) : (
        <View style={s.card}>
          <Text style={s.desc}>{t("Sepetiniz boş.")}</Text>
          <Btn label={t("Ürünlere göz atın")} onPress={() => go("urun")} />
        </View>
      ))}

      {step === "odeme" && count(cart) > 0 && (
        <>
          <Summary editable={false} />
          {!signedIn ? (
            <View style={s.card}>
              <Text style={s.cardT}>{t("Önce giriş yapın")}</Text>
              <Text style={s.desc}>{server
                ? t("Satın aldığınız ürün Celse hesabınıza tanımlanır; böylece web'de, iPhone'da ve Android'de aynı hesapla kullanırsınız. Sepetiniz giriş yaptıktan sonra da burada olur.")
                : t("Sunucuya şu an ulaşılamıyor. İnternet bağlantınızı kontrol edip sayfayı yenileyin.")}</Text>
              {server && <View style={s.row}><Btn label={t("Giriş yap")} onPress={onSignIn} /><Btn kind="ghost" label={t("Üye ol")} onPress={onSignUp} /></View>}
            </View>
          ) : (
            <>
              <View style={s.card}>
                <Text style={s.cardT}>{t("Alıcı")}</Text>
                <Text style={s.desc}>{buyer?.ad}</Text>
                <Text style={s.fine}>{buyer?.eposta}</Text>
                <Text style={s.fine}>{t("Fatura (e-Arşiv) ve sipariş teyidi bu e-posta adresine gönderilir.")}</Text>
              </View>
              <View style={s.card}>
                <Check on={ok.on} set={v => setOk({ ...ok, on: v })}>
                  <Link file="on-bilgilendirme.html" label={t("Ön Bilgilendirme Formu")} />{t("'nu okudum ve bilgilendirildim.")}
                </Check>
                <Check on={ok.mesafeli} set={v => setOk({ ...ok, mesafeli: v })}>
                  <Link file="satis-sozlesmesi.html" label={t("Mesafeli Satış Sözleşmesi")} />{t("'ni okudum ve kabul ediyorum.")}
                </Check>
                {hasSub && (
                  <Check on={ok.ifa} set={v => setOk({ ...ok, ifa: v })}>
                    {t("Celse Pro'nun ödemeden hemen sonra hesabımda açılmasını istiyorum. Dijital içeriğin anında ifa edilmesi nedeniyle Celse Pro için cayma hakkımın sona ereceğini biliyorum (Mesafeli Sözleşmeler Yönetmeliği m.15/1-ğ). Ayrıntılar: ")}
                    <Link file="iade.html" label={t("İade ve Cayma Hakkı")} />
                  </Check>
                )}
              </View>
              <Btn disabled={!ready} label={t("Kartla güvenli öde · {tutar}", { tutar: tl(total(cart)) })} onPress={pay} />
              <View style={s.marks}>{["VISA", "Mastercard", "TROY"].map(m => <Text key={m} style={s.mark}>{m}</Text>)}</View>
              <Text style={s.fine}>{t("Kart bilgileriniz yalnızca lisanslı ödeme kuruluşunun güvenli ödeme sayfasına girilir; Celse kart bilginizi görmez ve saklamaz.")}</Text>
            </>
          )}
        </>
      )}

      {!!msg && <Text style={s.msg}>{msg}</Text>}
      <LegalFooter />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 980, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 20, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  eyebrow: { fontFamily: F.mono, fontSize: 12, letterSpacing: 2.5, color: C.muted, marginTop: 6 },
  title: { fontFamily: F.display, fontSize: 32, color: C.brass },
  sub: { fontFamily: F.body, fontSize: 16, lineHeight: 23, color: C.textSoft },
  steps: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stepChip: { borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.panel2 },
  stepOn: { borderColor: C.brass, backgroundColor: C.bordo },
  stepT: { fontFamily: F.bodyMed, fontSize: 13, color: C.muted },
  stepTOn: { color: C.text },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  prod: { flexGrow: 1, flexBasis: 210, maxWidth: "100%", minHeight: 300, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 16, gap: 6 },
  prodOn: { borderColor: C.brass },
  prodK: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: C.muted },
  prodT: { fontFamily: F.bodyBold, fontSize: 17, color: C.text },
  price: { fontFamily: F.display, fontSize: 28, color: C.text },
  per: { fontFamily: F.body, fontSize: 15, color: C.muted },
  desc: { fontFamily: F.body, fontSize: 15, lineHeight: 21, color: C.textSoft },
  bullet: { fontFamily: F.body, fontSize: 13, lineHeight: 19, color: C.textSoft },
  card: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 16, gap: 10 },
  cardT: { fontFamily: F.bodyBold, fontSize: 16, color: C.brass },
  line: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  lineT: { fontFamily: F.bodyBold, fontSize: 15, color: C.text },
  lineP: { fontFamily: F.bodyBold, fontSize: 15, color: C.text, minWidth: 90, textAlign: "right" },
  totalLine: { borderBottomWidth: 0, paddingBottom: 0 },
  totalP: { fontFamily: F.display, fontSize: 24, color: C.text },
  remove: { fontFamily: F.bodyBold, fontSize: 16, color: C.muted, paddingHorizontal: 4 },
  qty: { flexDirection: "row", alignItems: "center", gap: 6 },
  qtyBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center", backgroundColor: C.panel2 },
  qtyT: { fontFamily: F.bodyBold, fontSize: 16, color: C.text },
  qtyN: { fontFamily: F.bodyBold, fontSize: 15, color: C.text, minWidth: 18, textAlign: "center" },
  check: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  box: { width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: C.brassDim, alignItems: "center", justifyContent: "center", marginTop: 1 },
  boxOn: { backgroundColor: C.bordo, borderColor: C.brass },
  boxTick: { fontFamily: F.bodyBold, fontSize: 14, color: C.text },
  checkT: { flex: 1, fontFamily: F.body, fontSize: 14, lineHeight: 20, color: C.textSoft },
  inlineLink: { color: C.brass, textDecorationLine: "underline", fontFamily: F.bodyMed },
  inlineRow: { fontFamily: F.body, fontSize: 14, color: C.muted },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  marks: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mark: { fontFamily: F.bodyBold, fontSize: 12, color: C.text, borderWidth: 1, borderColor: C.line, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: C.panel2 },
  msg: { fontFamily: F.bodyMed, fontSize: 15, lineHeight: 21, color: C.brass },
  fine: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: C.muted }
});
