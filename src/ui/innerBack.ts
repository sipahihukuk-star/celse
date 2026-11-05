// Ekran içi "geri" adımları: bir ekranın içinde açılan alt sayfa (ör. Yönetim'de bir panel ya da dava düzenleyici) açıkken
// tarayıcının geri düğmesi ve Android'in geri tuşu önce o alt sayfayı kapatır, ekrandan çıkmaz.
// App.tsx'teki goBack önce runInnerBack()'i dener; alt sayfa yoksa ekranlar arası geri dönüşe geçer.
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

const handlers: (() => void)[] = [];

/** Alt sayfa açıkken (active) geri düğmesi onBack'i çağırır. Web'de tarayıcı geçmişine bir adım eklenir. */
export function useInnerBack(active: boolean, onBack: () => void) {
  const ref = useRef(onBack); ref.current = onBack;
  useEffect(() => {
    if (!active) return;
    const h = () => ref.current();
    handlers.push(h);
    if (Platform.OS === "web" && typeof window !== "undefined") { try { window.history.pushState({ celseInner: true }, ""); } catch { /* yok say */ } }
    return () => { const i = handlers.lastIndexOf(h); if (i >= 0) handlers.splice(i, 1); };
  }, [active]);
}

/** En son açılan alt sayfayı kapatır; kapatacak bir şey yoksa false döner. */
export function runInnerBack(): boolean {
  const h = handlers.pop();
  if (!h) return false;
  h();
  return true;
}
