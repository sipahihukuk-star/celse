// Uygulama içi satın alma (RevenueCat) · yalnız iOS ve Android. Web'de bunun yerine purchases.web.ts yüklenir.
// RevenueCat'teki kullanıcı kimliği Supabase hesabının kimliğiyle aynıdır (Purchases.logIn): ödeme bildirimi
// (supabase/functions/odeme) aboneliği bu kimlikle "abonelikler" tablosuna yazar; böylece telefonda alınan Pro web'de de açılır.
import { Platform } from "react-native";
import { useEffect, useState } from "react";
import Purchases, { CustomerInfo, PRODUCT_CATEGORY, PurchasesPackage, PurchasesStoreProduct } from "react-native-purchases";
import { currentAccount, onAccountChange } from "./account";
import { BuyResult, CREDIT_PACKS, CreditInfo, PlanInfo, PlanKind, PRO_ENTITLEMENT, PRODUCTS, ProState, REVENUECAT_KEYS } from "./purchaseIds";

/** Bu platformda mağazadan satın alma yapılabilir mi? (Web'de false.) */
export const PURCHASES_AVAILABLE = Platform.OS === "ios" || Platform.OS === "android";

let configured = false;
/** RevenueCat'e bildirilen kullanıcı (Supabase kimliği) ya da anonimse null */
let rcUser: string | null = null;
let pro: ProState = { active: false, until: null, willRenew: false };
const packages = new Map<PlanKind, PurchasesPackage>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(f => f());

/** Satın almanın bağlanacağı hesap: yalnız sunucu hesabı (cihaz profilleri ödeme bildirimiyle eşleşemez). */
const wantedUser = () => { const a = currentAccount(); return a?.mode === "server" ? a.id : null; };

function apply(info: CustomerInfo) {
  const ent = info.entitlements.active[PRO_ENTITLEMENT];
  pro = ent
    ? { active: true, until: ent.expirationDate ? new Date(ent.expirationDate) : null, willRenew: ent.willRenew, productId: ent.productIdentifier }
    : { active: false, until: null, willRenew: false };
  emit();
}

/** Bir kez yapılandırır; hesap açıksa doğrudan o kimlikle başlar. */
function setup(): boolean {
  if (configured) return true;
  if (!PURCHASES_AVAILABLE) return false;
  const apiKey = Platform.OS === "ios" ? REVENUECAT_KEYS.ios : REVENUECAT_KEYS.android;
  if (!apiKey) return false;
  try {
    const uid = wantedUser();
    Purchases.configure({ apiKey, appUserID: uid });
    rcUser = uid; configured = true;
    Purchases.addCustomerInfoUpdateListener(apply);
    Purchases.getCustomerInfo().then(apply).catch(() => { /* ağ yoksa Pro durumu sonra gelir */ });
  } catch { return false; }
  return true;
}

/** RevenueCat kullanıcısını oturumdaki hesapla eşitler: girişte logIn, çıkışta logOut. */
async function sync() {
  if (!setup()) return;
  const uid = wantedUser();
  if (uid === rcUser) return;
  try {
    if (uid) apply((await Purchases.logIn(uid)).customerInfo);
    else apply(await Purchases.logOut());
    rcUser = uid;
  } catch { /* bir sonraki hesap değişiminde ya da satın almadan önce yeniden denenir */ }
}
let chain: Promise<void> = Promise.resolve();
const queueSync = () => (chain = chain.then(sync, sync));
onAccountChange(() => { if (configured) queueSync(); });

/** Uygulama açılırken çağrılır (birden çok çağrı zararsızdır). */
export function startPurchases() { if (setup()) queueSync(); }

export const proState = (): ProState => pro;
export function onProChange(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }
export function usePro(): ProState {
  const [, force] = useState(0);
  useEffect(() => { startPurchases(); return onProChange(() => force(n => n + 1)); }, []);
  return pro;
}

const errText = (e: unknown) => (e as { message?: string })?.message || String(e);
const cancelled = (e: unknown) => !!(e as { userCancelled?: boolean | null })?.userCancelled;

/** Satın almadan önce: hesap açık mı ve RevenueCat o hesaba mı bağlı? */
async function ready(): Promise<string | null> {
  if (!setup()) return "Mağaza bu cihazda kullanılamıyor.";
  if (!wantedUser()) return "Satın almak için önce giriş yapın.";
  await queueSync();
  return rcUser === wantedUser() ? null : "Hesabınız mağazaya bağlanamadı. İnternet bağlantınızı kontrol edip yeniden deneyin.";
}

/** Varsayılan teklifteki aylık ve yıllık paketler, mağazanın yerel fiyatlarıyla. */
export async function getPlans(): Promise<PlanInfo[]> {
  if (!setup()) return [];
  const off = (await Purchases.getOfferings()).current;
  if (!off) return [];
  const byProduct = (id: string) => off.availablePackages.find(p => p.product.identifier === id) || null;
  const found: [PlanKind, PurchasesPackage | null][] = [["aylik", off.monthly || byProduct(PRODUCTS.aylik)], ["yillik", off.annual || byProduct(PRODUCTS.yillik)]];
  const out: PlanInfo[] = [];
  for (const [kind, p] of found) if (p) { packages.set(kind, p); out.push({ kind, price: p.product.priceString, productId: p.product.identifier, amount: p.product.price, currency: p.product.currencyCode }); }
  return out;
}

export async function buyPlan(kind: PlanKind): Promise<BuyResult> {
  const why = await ready();
  if (why) return { ok: false, error: why };
  try {
    if (!packages.has(kind)) await getPlans();
    const p = packages.get(kind);
    if (!p) return { ok: false, error: "Paket bulunamadı. Biraz sonra yeniden deneyin." };
    const r = await Purchases.purchasePackage(p);
    apply(r.customerInfo);
    return { ok: !!r.customerInfo.entitlements.active[PRO_ENTITLEMENT] };
  } catch (e) { return cancelled(e) ? { ok: false, cancelled: true } : { ok: false, error: errText(e) }; }
}

/** "Derdini anlat" kredi paketleri (tüketilebilir ürünler). Kredi, ödeme bildirimiyle sunucuya yazılır. */
let creditProducts: PurchasesStoreProduct[] = [];
export async function getCreditProducts(): Promise<CreditInfo[]> {
  if (!setup()) return [];
  creditProducts = await Purchases.getProducts(Object.keys(CREDIT_PACKS), PRODUCT_CATEGORY.NON_SUBSCRIPTION);
  return creditProducts.map(p => ({ productId: p.identifier, price: p.priceString, credits: CREDIT_PACKS[p.identifier] || 0 }));
}

export async function buyConsumable(productId: string): Promise<BuyResult> {
  const why = await ready();
  if (why) return { ok: false, error: why };
  try {
    if (!creditProducts.some(p => p.identifier === productId)) await getCreditProducts();
    const p = creditProducts.find(x => x.identifier === productId);
    if (!p) return { ok: false, error: "Ürün bulunamadı. Biraz sonra yeniden deneyin." };
    await Purchases.purchaseStoreProduct(p);
    return { ok: true };
  } catch (e) { return cancelled(e) ? { ok: false, cancelled: true } : { ok: false, error: errText(e) }; }
}

/** Satın alımları geri yükle (Apple bunu ister). Pro bulunduysa ok: true. */
export async function restorePurchases(): Promise<BuyResult> {
  const why = await ready();
  if (why) return { ok: false, error: why };
  try {
    const info = await Purchases.restorePurchases();
    apply(info);
    return { ok: !!info.entitlements.active[PRO_ENTITLEMENT] };
  } catch (e) { return { ok: false, error: errText(e) }; }
}
