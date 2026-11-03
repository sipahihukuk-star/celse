// iPhone'da klavyenin hemen üstünde duran "Bitti" çubuğu. Çok satırlı yazı alanlarında iOS klavyesinde kapatma tuşu
// yoktur; bu çubuk her yazı alanına bağlanır (inputAccessoryViewID) ve dokununca klavyeyi indirir.
import React from "react";
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { C, F } from "./theme";
import { t } from "../i18n";

export const KB_BAR = "celse-klavye-cubugu";
/** TextInput'a eklenecek özellik: <TextInput {...kbBar} /> */
export const kbBar = Platform.OS === "ios" ? { inputAccessoryViewID: KB_BAR } : {};

export function KeyboardBar() {
  if (Platform.OS !== "ios") return null;
  return (
    <InputAccessoryView nativeID={KB_BAR}>
      <View style={s.bar}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Klavyeyi kapat")} onPress={() => Keyboard.dismiss()} hitSlop={12} style={s.btn}>
          <Text style={s.t}>{t("Bitti")}</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: "row", justifyContent: "flex-end", backgroundColor: "#d1d3d9", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#a9abb0", paddingHorizontal: 12, paddingVertical: 6 },
  btn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: C.bordo },
  t: { fontFamily: F.bodyBold, fontSize: 16, color: "#fff" }
});
