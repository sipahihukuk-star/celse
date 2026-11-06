// Telefonda PDF, TIF ve fotoğraf okuyucu: görünmez WebView (src/ui/evrakOkuyucuHtml.ts). Dosya telefonda okunur, gönderilmez.
import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { EVRAK_OKUYUCU_HTML } from "./evrakOkuyucuHtml";

export interface EvrakOkuyucuRef { oku: (ad: string, tur: "pdf" | "tif" | "resim", b64: string, ilerle: (m: string) => void) => Promise<string> }
// Paketin tür tanımı bu React sürümüyle props'u "never" olarak çözüyor; yalnız kullandığımız alanlarla gevşek tür verilir.
type WVRef = { postMessage: (s: string) => void };
const WV = WebView as unknown as React.ComponentType<{
  ref?: React.Ref<WVRef>; originWhitelist: string[]; javaScriptEnabled: boolean; source: { html: string; baseUrl: string };
  onMessage: (e: { nativeEvent: { data: string } }) => void;
}>;
type Bekleyen = { ok: (s: string) => void; hata: (e: Error) => void; ilerle: (m: string) => void };

export const EvrakOkuyucu = forwardRef<EvrakOkuyucuRef>(function EvrakOkuyucu(_p, ref) {
  const wv = useRef<WVRef>(null);
  const bekleyen = useRef(new Map<string, Bekleyen>());
  const hazir = useRef<Promise<void> | null>(null);
  const hazirOl = useRef<() => void>(() => {});
  if (!hazir.current) hazir.current = new Promise<void>(ok => { hazirOl.current = ok; });
  useImperativeHandle(ref, () => ({
    oku: async (ad, tur, b64, ilerle) => {
      await hazir.current;
      const id = Math.random().toString(36).slice(2);
      return new Promise<string>((ok, hata) => {
        bekleyen.current.set(id, { ok, hata, ilerle });
        wv.current?.postMessage(JSON.stringify({ id, ad, tur, b64 }));
      });
    }
  }), []);
  return (
    <View pointerEvents="none" style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }}>
      <WV ref={wv} originWhitelist={["*"]} javaScriptEnabled source={{ html: EVRAK_OKUYUCU_HTML, baseUrl: "https://celse.themiscode.com/" }}
        onMessage={e => {
          let m: { id?: string; hazir?: boolean; ilerleme?: string; metin?: string; hata?: string };
          try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
          if (m.hazir) { hazirOl.current(); return; }
          const b = m.id ? bekleyen.current.get(m.id) : undefined;
          if (!b) return;
          if (m.ilerleme) { b.ilerle(m.ilerleme); return; }
          bekleyen.current.delete(m.id!);
          if (typeof m.metin === "string") b.ok(m.metin); else b.hata(new Error(m.hata || "Dosya okunamadı."));
        }} />
    </View>
  );
});
