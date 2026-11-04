// iPhone'da klavye açıkken klavyenin hemen üstünde, sağda duran "Bitti" düğmesi. Çok satırlı yazı alanlarında iOS klavyesinde
// kapatma tuşu yoktur. Önceki InputAccessoryView yöntemi bazı ekranlarda (yeni iOS sürümlerinde) görünmedi; bu yüzden düğme
// klavye olaylarını dinleyip uygulamanın en üstüne çizilir ve her yazı alanında kendiliğinden çıkar.
import React, { useEffect, useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { C, F } from "./theme";
import { t } from "../i18n";

export const KB_BAR = "celse-klavye-cubugu";
/** Eski kullanım için korunur: artık yazı alanına bir şey eklemesi gerekmez. */
export const kbBar = {};

/** Mutlak konum ekranın altından ölçülür (SafeAreaView dolgusu etkilemez); düğme klavyenin 12 nokta üstünde durur. */
export function KeyboardBar(_p: { inModal?: boolean }) {
  const [h, setH] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const a = Keyboard.addListener("keyboardWillShow", e => setH(e.endCoordinates.height));
    const b = Keyboard.addListener("keyboardWillChangeFrame", e => setH(e.endCoordinates.screenY > 0 ? e.endCoordinates.height : 0));
    const c = Keyboard.addListener("keyboardWillHide", () => setH(0));
    return () => { a.remove(); b.remove(); c.remove(); };
  }, []);
  if (Platform.OS !== "ios" || h <= 0) return null;
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Klavyeyi kapat")} onPress={() => Keyboard.dismiss()} hitSlop={10}
        style={[s.btn, { bottom: h + 12 }]}>
        <Text style={s.t}>{t("Bitti")}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  btn: { position: "absolute", right: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, backgroundColor: C.bordo, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  t: { fontFamily: F.bodyBold, fontSize: 16, color: "#fff" }
});
