// Klavye açıkken klavyenin hemen üstünde, sağda duran "Bitti" düğmesi (iPhone ve Android).
// iOS klavyesinde çok satırlı yazı alanlarını kapatma tuşu yoktur; Android'de ise dışarı dokunmak çoğu zaman başka bir
// kutuya girmeye yol açar. Düğme klavye olaylarını dinleyip uygulamanın en üstüne çizilir ve her yazı alanında kendiliğinden çıkar.
// iOS: konum ekranın altından klavye yüksekliği kadar yukarıdır. Android: pencere klavyeyle küçülebilir (resize) ya da
// kaydırılabilir; bu yüzden düğmenin kabının pencere içindeki alt kenarı ölçülür ve klavyenin üst kenarına göre yerleştirilir.
import React, { useEffect, useRef, useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { C, F } from "./theme";
import { t } from "../i18n";

export const KB_BAR = "celse-klavye-cubugu";
/** Eski kullanım için korunur: artık yazı alanına bir şey eklemesi gerekmez. */
export const kbBar = {};

/** Kendi kapatma/ilerleme tuşu olan yazı alanları (iOS rakam klavyesindeki "Next"/"Done" gibi) odaklanınca "Bitti" gizlenir;
 *  yoksa iki düğme üst üste biner. Kullanım: onFocus={() => hideKeyboardBar(true)} onBlur={() => hideKeyboardBar(false)}. */
let hidden = false;
const hideSubs = new Set<(h: boolean) => void>();
export function hideKeyboardBar(h: boolean) { hidden = h; hideSubs.forEach(f => f(h)); }

export function KeyboardBar(_p: { inModal?: boolean }) {
  const [bottom, setBottom] = useState(-1);
  const [off, setOff] = useState(hidden);
  useEffect(() => { hideSubs.add(setOff); return () => { hideSubs.delete(setOff); }; }, []);
  const box = useRef<React.ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (Platform.OS === "ios") {
      const a = Keyboard.addListener("keyboardWillShow", e => setBottom(e.endCoordinates.height + 12));
      const b = Keyboard.addListener("keyboardWillChangeFrame", e => setBottom(e.endCoordinates.screenY > 0 ? e.endCoordinates.height + 12 : -1));
      const c = Keyboard.addListener("keyboardWillHide", () => setBottom(-1));
      return () => { a.remove(); b.remove(); c.remove(); };
    }
    if (Platform.OS === "android") {
      const place = (kbTop: number) => {
        // Kabın penceredeki alt kenarı klavyenin üst kenarından aşağıdaysa (pencere küçülmediyse) aradaki fark kadar yukarı çıkar.
        const v = box.current;
        if (!v) { setBottom(12); return; }
        v.measureInWindow((_x: number, y: number, _w: number, h: number) => setBottom(Math.max(12, y + h - kbTop + 12)));
      };
      const a = Keyboard.addListener("keyboardDidShow", e => { setBottom(12); place(e.endCoordinates.screenY); setTimeout(() => place(e.endCoordinates.screenY), 150); });
      const c = Keyboard.addListener("keyboardDidHide", () => setBottom(-1));
      return () => { a.remove(); c.remove(); };
    }
  }, []);
  if (Platform.OS !== "ios" && Platform.OS !== "android") return null;
  return (
    <View ref={box} collapsable={false} pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}>
      {bottom >= 0 && !off && (
        <Pressable accessibilityRole="button" accessibilityLabel={t("Klavyeyi kapat")} onPress={() => Keyboard.dismiss()} hitSlop={10}
          style={[s.btn, { bottom }]}>
          <Text style={s.t}>{t("Bitti")}</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  btn: { position: "absolute", right: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, backgroundColor: C.bordo, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 8 },
  t: { fontFamily: F.bodyBold, fontSize: 16, color: "#fff" }
});
