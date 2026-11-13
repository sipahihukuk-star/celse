// Satırı yana kaydırınca (sağa ya da sola) "🗑 Sil" düğmesi çıkar; basınca "Emin misiniz?" sorulur, onaylanırsa silinir.
// Bilgisayarda fareyle sürüklemek ya da satıra uzun basmak da aynı düğmeyi açar. Kaydırma geri yapılırsa düğme kapanır.
import React, { useMemo, useRef, useState } from "react";
import { PanResponder, Text, View } from "react-native";
import { t } from "../i18n";
import { s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";

export function KaydirSil({ children, onSil, soru, kapali }: { children: (uzunBas: () => void) => React.ReactNode; onSil: () => Promise<void> | void; soru?: string; /** silme yetkisi yok */ kapali?: boolean }) {
  const [durum, setDurum] = useState<"" | "sil" | "onay">("");
  const [bekle, setBekle] = useState(false);
  const durumRef = useRef(durum); durumRef.current = durum;
  const pan = useMemo(() => PanResponder.create({
    // Yatay hareket dikeyden belirgin büyükse kaydırma sayılır (sayfanın aşağı kaymasına karışmaz).
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
    onPanResponderRelease: (_e, g) => {
      if (Math.abs(g.dx) < 40) return;
      setDurum(durumRef.current ? "" : "sil");
    },
    onPanResponderTerminationRequest: () => true
  }), []);
  if (kapali) return <>{children(() => {})}</>;
  return (
    <View {...pan.panHandlers} style={{ gap: 6 }}>
      {children(() => setDurum(durum ? "" : "sil"))}
      {durum === "sil" && (
        <View style={[s.row, { gap: 8, justifyContent: "flex-end", alignItems: "center" }]}>
          <Btn kind="ghost" label={t("Vazgeç")} onPress={() => setDurum("")} />
          <Btn label={t("🗑 Sil")} onPress={() => setDurum("onay")} />
        </View>
      )}
      {durum === "onay" && (
        <View style={{ gap: 6, borderWidth: 1, borderColor: C.bad, borderRadius: 10, padding: 10 }}>
          <Text style={[s.body, { color: C.bad, fontWeight: "700" }]}>{soru || t("Emin misiniz? Silinen geri gelmez.")}</Text>
          <View style={[s.row, { gap: 8 }]}>
            <Btn label={bekle ? t("Siliniyor…") : t("Evet, sil")} disabled={bekle} onPress={async () => { setBekle(true); try { await onSil(); } finally { setBekle(false); setDurum(""); } }} />
            <Btn kind="ghost" label={t("Vazgeç")} onPress={() => setDurum("")} />
          </View>
        </View>
      )}
    </View>
  );
}
