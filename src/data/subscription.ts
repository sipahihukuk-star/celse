// Yıllık abonelik. Ücretsiz kullanıcı kariyerin ilk FREE_CASES davasını oynar; geri kalan her şey abonelikle açılır.
// Abonelik durumu sunucuda "abonelikler" tablosundadır ve yalnızca ödeme bildirimleriyle (App Store / Google Play
// üzerinden RevenueCat, web'de iyzico) yazılır; oyuncu kendi aboneliğini değiştiremez.
import { useEffect, useState } from "react";
import { currentAccount, onAccountChange, supabase } from "./account";

export const FREE_CASES = 5;
/** Fiyat netleşince yazılacak (ör. "₺ 999 / yıl"). */
export const PRICE_LABEL = "";

let premiumUntil: Date | null = null;
let adminPreview = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(f => f());

/** Yönetim paneline PIN ile girildiğinde bu oturumda her şey açılır (içerik denetimi için). */
export function setAdminPreview(on: boolean) { adminPreview = on; emit(); }

async function refresh() {
  premiumUntil = null;
  const acc = currentAccount(), sb = supabase();
  if (acc?.mode === "server" && sb) {
    try {
      const { data } = await sb.from("abonelikler").select("bitis").eq("kullanici_id", acc.id).maybeSingle();
      if (data?.bitis) premiumUntil = new Date(data.bitis);
    } catch { /* ağ yoksa abonelik görünmez; ücretsiz kısım oynanır */ }
  }
  emit();
}
onAccountChange(refresh);

export function isPremium(): boolean {
  return adminPreview || (!!premiumUntil && premiumUntil.getTime() > Date.now());
}

export function usePremium(): { premium: boolean; until: Date | null; admin: boolean } {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force(n => n + 1);
    listeners.add(f); refresh();
    return () => { listeners.delete(f); };
  }, []);
  return { premium: isPremium(), until: premiumUntil, admin: adminPreview };
}
