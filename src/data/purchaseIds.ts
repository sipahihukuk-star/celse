// Uygulama içi satın alma ayarları (RevenueCat). Hem telefon (purchases.ts) hem web (purchases.web.ts) bunu kullanır.
//
// ▼▼▼ REVENUECAT ANAHTARLARI · YALNIZ BURADAN DEĞİŞTİRİLİR ▼▼▼
// iOS: gerçek App Store anahtarı. Android: Play bağlanana kadar RevenueCat "Test Store" anahtarı (herkese açık SDK anahtarıdır, depoya yazılabilir; gizli anahtar DEĞİL).
// Mağazalar bağlanınca RevenueCat > Project settings > API keys'teki "appl_…" (iOS) ve "goog_…" (Android) anahtarları yazılır.
// Gizli (sk_…) anahtar asla buraya yazılmaz.
export const REVENUECAT_KEYS = {
  ios: "appl_xWwtERsVWbDbjoLimuYhjPvczPO",
  android: "test_WRECbJQMhoilDPDbWlDxuNCHPlI"
};
// ▲▲▲ REVENUECAT ANAHTARLARI ▲▲▲

/** RevenueCat'teki yetki (entitlement) kimliği: etkinse oyuncu Celse Pro'dur. */
export const PRO_ENTITLEMENT = "pro";

/** App Store Connect / Google Play ürün kimlikleri (iki mağazada aynı). */
export const PRODUCTS = {
  aylik: "celse_pro_aylik",
  yillik: "celse_pro_yillik",
  derdini1: "celse_derdini_anlat_1",
  derdini3: "celse_derdini_anlat_3"
} as const;

/** "Derdini anlat" kredi paketleri: ürün → kaç kredi (sunucudaki ödeme fonksiyonu da aynı eşlemeyi kullanır). */
export const CREDIT_PACKS: Record<string, number> = { [PRODUCTS.derdini1]: 1, [PRODUCTS.derdini3]: 3 };

export type PlanKind = "aylik" | "yillik";
/** Paywall'da gösterilen plan: fiyat metni mağazanın yerel biçimindedir (ör. "₺149,99"). */
export interface PlanInfo { kind: PlanKind; price: string; productId: string; /** sayısal fiyat ve para birimi (aylık karşılık ve avantaj hesabı için) */ amount: number; currency: string }
export interface CreditInfo { productId: string; price: string; credits: number }
export interface ProState { active: boolean; until: Date | null; willRenew: boolean; productId?: string }
export interface BuyResult { ok: boolean; cancelled?: boolean; error?: string }
