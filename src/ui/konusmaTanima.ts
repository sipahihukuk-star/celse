// Konuşma tanıma: web'de tarayıcının SpeechRecognition'ı, telefonda (iOS, Android) expo-speech-recognition'ın aynı arayüzü
// taşıyan sınıfı (ExpoWebSpeechRecognition: iPhone'da Apple'ın, Android'de Google'ın tanıma hizmeti). Telefonda ilk kullanımda
// mikrofon ve konuşma tanıma izni istenir. Modül yoksa (eski telefon sürümü) tanıma yok sayılır.
import { Platform } from "react-native";

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
let yerelModul: Any | null | undefined;
function modul(): Any | null {
  if (yerelModul !== undefined) return yerelModul;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require("expo-speech-recognition");
    yerelModul = m?.ExpoSpeechRecognitionModule?.isRecognitionAvailable?.() ? m : null;
  } catch { yerelModul = null; }
  return yerelModul;
}

export const telefonda = Platform.OS !== "web";

/** SpeechRecognition sınıfı (yoksa null). */
export function tanimaSinifi(): Any {
  if (!telefonda) return typeof window !== "undefined" ? (window as Any).SpeechRecognition || (window as Any).webkitSpeechRecognition || null : null;
  return modul()?.ExpoWebSpeechRecognition || null;
}

/** Telefonda mikrofon ve konuşma tanıma izni (web'de tarayıcı kendisi sorar). */
export async function tanimaIzni(): Promise<boolean> {
  if (!telefonda) return true;
  const m = modul();
  if (!m) return false;
  try { return !!(await m.ExpoSpeechRecognitionModule.requestPermissionsAsync())?.granted; } catch { return false; }
}

export const izinYokMetni = () => (telefonda
  ? "Mikrofon ya da konuşma tanıma izni verilmedi. Telefonun Ayarlar > Celse bölümünden Mikrofon ve Konuşma Tanıma iznini açın."
  : "Mikrofon izni verilmedi. Adres çubuğundaki kilit simgesinden mikrofona izin verin.");
