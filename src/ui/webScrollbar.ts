// Web: kaydırma çubuğu her zaman görünsün. Windows 11'deki Chrome ve Edge çubuğu fare üstüne gelene kadar gizliyor
// (kaplama çubuğu); dokunmatik alanı olmayan ya da bunu bilmeyen kullanıcı sayfanın aşağısında düğme olduğunu fark etmiyor.
// Özel çubuk biçimi tarayıcıyı kalıcı çubuğa geçirir. Yatay sayfa kaydırıcısının (ön yüz) çubuğu gizli kalır.
import { Platform } from "react-native";

export function kaydirmaCubugu() {
  if (Platform.OS !== "web" || typeof document === "undefined" || document.getElementById("celse-cubuk")) return;
  const st = document.createElement("style");
  st.id = "celse-cubuk";
  st.textContent = [
    "::-webkit-scrollbar { width: 12px; height: 0px; }",
    "::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }",
    "::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.38); border-radius: 8px; border: 3px solid transparent; background-clip: padding-box; min-height: 40px; }",
    "::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.6); border: 3px solid transparent; background-clip: padding-box; }",
    "html { scrollbar-color: rgba(255,255,255,0.4) rgba(255,255,255,0.05); }"
  ].join("\n");
  document.head.appendChild(st);
}
