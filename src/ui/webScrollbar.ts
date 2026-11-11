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
    "html { scrollbar-color: rgba(255,255,255,0.4) rgba(255,255,255,0.05); }",
    // Telefon: sayfa yana kaymasın, kenardan çekince esneyip oynamasın.
    "html, body { overflow-x: hidden; overscroll-behavior: none; max-width: 100%; }",
    // iPhone: 16 pikselden küçük yazılı kutuya dokununca Safari sayfayı büyütüyor; büyüyen sayfa parmakla yana kayıyor,
    // yüzen mikrofon yerinde durduğu için arka plan oynuyor gibi görünüyordu. Telefonda kutuların yazısı 16 piksel.
    "@media (max-width: 820px) { input, textarea, select { font-size: 16px !important; } }"
  ].join("\n");
  document.head.appendChild(st);
  // Kutuya dokununca kendiliğinden büyütme kapalı (iOS iki parmakla büyütmeye yine izin verir).
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp && !/maximum-scale/.test(vp.getAttribute("content") || "")) vp.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1");
}
