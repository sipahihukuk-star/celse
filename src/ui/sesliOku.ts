// Föy özetini, dilekçeyi ya da raporu cihazın kendi Türkçe sesiyle okur (tarayıcının konuşma sentezi). Metin gerçek adlar
// içerebileceği için bulut seslendirmesine gönderilmez; cihazda çalışan (localService) Türkçe ses tercih edilir.
// Hız 0,7–1,6 arasında ayarlanır. Uzun metin cümle cümle sıraya konur (bazı tarayıcılar uzun tek parçayı yarıda keser).
// Telefonda (iOS, Android) tarayıcı sentezi yoktur; cihazın kendi Türkçe sesi expo-speech ile kullanılır.
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Speech from "expo-speech";

const YEREL = Platform.OS !== "web";
const synth = () => (!YEREL && typeof window !== "undefined" ? window.speechSynthesis : undefined);
const dinleyiciler = new Set<(on: boolean) => void>();
let konusuyor = false;
const bildir = (on: boolean) => { konusuyor = on; dinleyiciler.forEach(f => f(on)); };

export const sesliOkumaVar = () => YEREL || (!!synth() && typeof SpeechSynthesisUtterance !== "undefined");

function turkceSes(): { ses?: SpeechSynthesisVoice; yerel: boolean } {
  const xs = synth()?.getVoices() || [];
  const tr = xs.filter(v => /^tr/i.test(v.lang));
  const yerel = tr.find(v => v.localService);
  return { ses: yerel || tr[0], yerel: !!yerel || !tr.length };
}
/** Cihazda Türkçe ses yoksa tarayıcının çevrim içi sesi kullanılabilir; ekranda uyarmak için. */
export const yerelSesVar = () => YEREL || turkceSes().yerel;

function parcala(metin: string): string[] {
  const cumleler = metin.replace(/\s+/g, " ").match(/[^.!?…:;]+[.!?…:;]*/g) || [metin];
  const out: string[] = []; let cur = "";
  for (const c of cumleler) {
    if ((cur + " " + c).length > 220 && cur) { out.push(cur.trim()); cur = c; } else cur += " " + c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// Chrome, kullanıcı dokunuşu olmadan başlayan ilk konuşmayı engelliyor: yapay zekâ cevabı ağdan gelince (dokunuştan saniyeler
// sonra) okunamıyordu. Mikrofona basıldığı anda sessiz, boş bir konuşma başlatılır; sayfa böylece "sesli" sayılır.
let kilitAcik = false;
let engelDinleyici: ((x: string) => void) | null = null;
export const sesEngeliDinle = (f: ((x: string) => void) | null) => { engelDinleyici = f; };
export function sesKilidiAc() {
  if (YEREL || kilitAcik) return;
  const s = synth();
  if (!s || typeof SpeechSynthesisUtterance === "undefined") return;
  try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; u.lang = "tr-TR"; s.speak(u); kilitAcik = true; } catch { /* yok say */ }
  try { s.getVoices(); } catch { /* sesler yüklensin */ }
}

export function sesliOku(metin: string, hiz = 1) {
  if (YEREL) {
    if (!metin.trim()) return;
    Speech.stop();
    const parcalar = parcala(metin);
    parcalar.forEach((p, i) => Speech.speak(p, {
      language: "tr-TR", rate: Math.max(0.5, Math.min(2, hiz)),
      onStart: i === 0 ? () => bildir(true) : undefined,
      onDone: i === parcalar.length - 1 ? () => bildir(false) : undefined,
      onStopped: () => bildir(false), onError: () => bildir(false)
    }));
    return;
  }
  const s = synth();
  if (!s || !metin.trim()) return;
  const mesgul = s.speaking || s.pending;
  s.cancel();
  // cancel'dan hemen sonra verilen konuşmayı Chrome zaman zaman yutuyor: meşgulse kısa bir ara verilir.
  const basla = () => {
    const { ses } = turkceSes();
    const parcalar = parcala(metin);
    parcalar.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p);
      u.lang = "tr-TR"; u.rate = Math.max(0.5, Math.min(2, hiz));
      if (ses) u.voice = ses;
      if (i === 0) u.onstart = () => bildir(true);
      u.onerror = (e: SpeechSynthesisErrorEvent) => {
        bildir(false);
        if (e?.error === "not-allowed") engelDinleyici?.("Tarayıcı sesli cevabı engelledi; mikrofona bir kez daha basın.");
        else if (e?.error && e.error !== "interrupted" && e.error !== "canceled") engelDinleyici?.("Sesli cevap okunamadı (" + e.error + ").");
      };
      if (i === parcalar.length - 1) u.onend = () => bildir(false);
      s.speak(u);
    });
    if (s.paused) s.resume();
  };
  if (mesgul) setTimeout(basla, 80); else basla();
}
export function sesliDur() { if (YEREL) Speech.stop(); else synth()?.cancel(); bildir(false); }

export function useSesliOkuma(): boolean {
  const [on, setOn] = useState(konusuyor);
  useEffect(() => { dinleyiciler.add(setOn); return () => { dinleyiciler.delete(setOn); sesliDur(); }; }, []);
  return on;
}
