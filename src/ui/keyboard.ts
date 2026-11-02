// Telefonda klavyenin açık olup olmadığı (serbest cevap ve son söz ekranları için).
import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setOpen(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return open;
}
