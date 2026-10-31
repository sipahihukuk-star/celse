// Sunucu ayarları. Supabase projesi kurulunca bu iki değer doldurulur (Supabase > Project Settings > API).
// Boş kaldıkça oyun tamamen cihazda çalışır: üyelik kapalıdır, serbest cevaplar anahtar kavramlarla puanlanır.
export const SUPABASE_URL = "https://ouyyfhobpihyrnwlcimo.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_Q4-NnTAvRCcATNHc-LLogA_iXkjpV2v";

let reachable = true;
/** Sunucuya ulaşılamıyorsa (ağ yok, tarayıcı engeli) oyun cihaz moduna düşer. */
export const setServerReachable = (v: boolean) => { reachable = v; };
export const serverReady = () => reachable && !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

/** Supabase'deki seslendirme fonksiyonunun adresi (panelden kurulurken verilen ad). */
export const TTS_FUNCTION = "bright-action";

/** Bulut seslendirme (Google Cloud Text-to-Speech) için karakter sesleri. Supabase "seslendir" fonksiyonu
 *  GOOGLE_TTS_KEY ile kurulunca kullanılır; ses adı bulunamazsa fonksiyon WaveNet sesine düşer. */
export const CLOUD_VOICES = {
  narr: "tr-TR-Chirp3-HD-Kore",
  f: ["tr-TR-Chirp3-HD-Aoede", "tr-TR-Chirp3-HD-Leda", "tr-TR-Chirp3-HD-Zephyr", "tr-TR-Chirp3-HD-Despina", "tr-TR-Chirp3-HD-Gacrux"],
  m: ["tr-TR-Chirp3-HD-Charon", "tr-TR-Chirp3-HD-Orus", "tr-TR-Chirp3-HD-Fenrir", "tr-TR-Chirp3-HD-Iapetus", "tr-TR-Chirp3-HD-Algenib", "tr-TR-Chirp3-HD-Schedar"]
};
