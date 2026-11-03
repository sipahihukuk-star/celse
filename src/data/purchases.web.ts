// Web: mağaza yok, RevenueCat yüklenmez. Pro telefonda alınır; web'de hesaba girince "abonelikler" tablosundan açılır
// (bkz. subscription.ts). Bu dosya purchases.ts ile aynı dışa aktarımları verir.
import { BuyResult, CreditInfo, PlanInfo, PlanKind, ProState } from "./purchaseIds";

export const PURCHASES_AVAILABLE = false;
const none: ProState = { active: false, until: null, willRenew: false };
const NA: BuyResult = { ok: false, error: "Satın alma yalnızca mobil uygulamada yapılır." };

export function startPurchases() { /* web'de yapılacak bir şey yok */ }
export const proState = (): ProState => none;
export function onProChange(_f: () => void) { return () => {}; }
export const usePro = (): ProState => none;
export const getPlans = async (): Promise<PlanInfo[]> => [];
export const buyPlan = async (_k: PlanKind): Promise<BuyResult> => NA;
export const getCreditProducts = async (): Promise<CreditInfo[]> => [];
export const buyConsumable = async (_id: string): Promise<BuyResult> => NA;
export const restorePurchases = async (): Promise<BuyResult> => NA;
