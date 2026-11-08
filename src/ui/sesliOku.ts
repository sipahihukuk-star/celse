// Föy özetini, dilekçeyi ya da raporu cihazın kendi Türkçe sesiyle okur (tarayıcının konuşma sentezi). Metin gerçek adlar
// içerebileceği için bulut seslendirmesine gönderilmez; cihazda çalışan (localService) Türkçe ses tercih edilir.
// Hız 0,7–1,6 arasında ayarlanır. Uzun metin cümle cümle sıraya konur (bazı tarayıcılar uzun tek parçayı yarıda keser).
import { useEffect, useState } from "react";

const synth = () => (typeof window !== "undefined" ? window.speechSynthesis : undefined);
const dinleyiciler = new Set<(on: boolean) => void>();
let konusuyor = false;
const bildir = (on: boolean) => { konusuyor = on; dinleyiciler.forEach(f => f(on)); };

export const sesliOkumaVar = () => !!synth() && typeof SpeechSynthesisUtterance !== "undefined";

function turkceSes(): { ses?: SpeechSynthesisVoice; yerel: boolean } {
  const xs = synth()?.getVoices() || [];
  const tr = xs.filter(v => /^tr/i.test(v.lang));
  const yerel = tr.find(v => v.localService);
  return { ses: yerel || tr[0], yerel: !!yerel || !tr.length };
}
/** Cihazda Türkçe ses yoksa tarayıcının çevrim içi sesi kullanılabilir; ekranda uyarmak için. */
export const yerelSesVar = () => turkceSes().yerel;

function parcala(metin: string): string[] {
  const cumleler = metin.replace(/\s+/g, " ").match(/[^.!?…:;]+[.!?…:;]*/g) || [metin];
  const out: string[] = []; let cur = "";
  for (const c of cumleler) {
    if ((cur + " " + c).length > 220 && cur) { out.push(cur.trim()); cur = c; } else cur += " " + c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function sesliOku(metin: string, hiz = 1) {
  const s = synth();
  if (!s || !metin.trim()) return;
  s.cancel();
  const { ses } = turkceSes();
  const parcalar = parcala(metin);
  parcalar.forEach((p, i) => {
    const u = new SpeechSynthesisUtterance(p);
    u.lang = "tr-TR"; u.rate = Math.max(0.5, Math.min(2, hiz));
    if (ses) u.voice = ses;
    if (i === 0) u.onstart = () => bildir(true);
    if (i === parcalar.length - 1) { u.onend = () => bildir(false); u.onerror = () => bildir(false); }
    s.speak(u);
  });
}
export function sesliDur() { synth()?.cancel(); bildir(false); }

export function useSesliOkuma(): boolean {
  const [on, setOn] = useState(konusuyor);
  useEffect(() => { dinleyiciler.add(setOn); return () => { dinleyiciler.delete(setOn); sesliDur(); }; }, []);
  return on;
}
