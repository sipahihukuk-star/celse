// Celse Pro (aylık ya da yıllık abonelik). Ücretsiz kullanıcı kariyerin ilk bölümünü (FREE_LEVEL) baştan sona oynar;
// sonraki bölümler Pro ile açılır. Antrenman listesi kariyer kilidine uyar; tahkim ve karşılıklı duruşma serbesttir.
// Pro iki yerden gelir:
//  - telefonda RevenueCat'in "pro" yetkisi (purchases.ts; satın alınınca hemen açılır),
//  - sunucuda "abonelikler" tablosundaki geçerli satır. Bu satırı yalnız ödeme bildirimi (supabase/functions/odeme)
//    ya da yönetici (kaynak 'manuel') yazar; oyuncu yalnız okur. Böylece telefonda alınan Pro web'de de açılır.
// Yönetici (PIN ya da sunucu yöneticisi) her şeyi kilitsiz görür; bunu App.tsx premium || admin olarak birleştirir.
import { useEffect, useState } from "react";
import { currentAccount, onAccountChange, supabase } from "./account";
import { Platform } from "react-native";
import { onProChange, proState, startPurchases } from "./purchases";
import { getSettings, onSettingsChange } from "./settings";

/** Abonelik kilidi açık mı? false yapılırsa her şey ücretsiz olur (test). */
export const SUBSCRIPTION_ON = true;
/** Ücretsiz oynanan son kariyer bölümü (1 = "Adliyede ilk yıl"). */
export const FREE_LEVEL = 1;
/** Mağaza fiyatı alınamazsa gösterilen fiyatlar (KDV dahil). */
export const FALLBACK_PRICE = { aylik: "149,99 ₺", yillik: "999,99 ₺" };

let serverUntil: Date | null = null;
let credits = 0;
let adminPreview = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(f => f());
onProChange(emit);
onSettingsChange(emit);

/** Yönetim paneline PIN ile girildiğinde bu oturumda her şey açılır (içerik denetimi için). */
export function setAdminPreview(on: boolean) { adminPreview = on; emit(); }

/** Sunucudaki abonelik ve "Derdini anlat" kredisi. Satın almadan sonra da çağrılır (ödeme bildirimi birkaç saniye sürebilir). */
export async function refreshPremium() {
  let u: Date | null = null, k = 0;
  const acc = currentAccount(), sb = supabase();
  if (acc?.mode === "server" && sb) {
    try {
      const { data } = await sb.from("abonelikler").select("bitis").eq("kullanici_id", acc.id).maybeSingle();
      if (data?.bitis) u = new Date(data.bitis);
    } catch { /* ağ yoksa abonelik görünmez; ücretsiz kısım oynanır */ }
    try {
      const { data } = await sb.from("derdini_kredi").select("kredi").eq("kullanici_id", acc.id).maybeSingle();
      k = Math.max(0, Number(data?.kredi) || 0);
    } catch { /* 7. kurulum yapılmamış olabilir */ }
  }
  if (acc?.id !== currentAccount()?.id) return; // bu arada hesap değişti; yeni hesabın yenilemesi yazar
  serverUntil = u; credits = k;
  emit();
}
onAccountChange(refreshPremium);

const serverActive = () => !!serverUntil && serverUntil.getTime() > Date.now();

export function isPremium(): boolean {
  if (!SUBSCRIPTION_ON) return true;
  // Web'de satış yapılamaz: mağazada satış açılana kadar (yönetim > Oyun ayarları) web'de her şey açıktır.
  if (Platform.OS === "web" && !getSettings().webProKilidi) return true;
  return adminPreview || proState().active || serverActive();
}

/** Pro bitiş tarihi: mağazadaki ya da sunucudaki, hangisi daha geçse. */
function until(): Date | null {
  const a = proState().until, b = serverActive() ? serverUntil : null;
  return a && b ? (a > b ? a : b) : a || b;
}

export function usePremium(): { premium: boolean; until: Date | null; admin: boolean; willRenew: boolean; credits: number } {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force(n => n + 1);
    listeners.add(f); startPurchases(); refreshPremium();
    return () => { listeners.delete(f); };
  }, []);
  return { premium: isPremium(), until: until(), admin: adminPreview, willRenew: proState().willRenew, credits };
}
