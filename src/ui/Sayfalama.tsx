// Uzun listeleri sayfalara böler: "Sayfada 5 / 10 / 25 / 50 / 100" seçimi ve ‹ Önceki / Sonraki ›. Seçim her liste için bu
// cihazda hatırlanır (Föylerim listesindeki sistemin aynısı; yaklaşanlar, arşiv, duruşmalar, işler, evrak hareketleri…).
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { t } from "../i18n";
import { Acilir } from "./Acilir";
import { s } from "./foyStil";
import { Btn } from "./kit";

export const BOYLAR = [5, 10, 25, 50, 100];

export function useSayfalama<T>(anahtar: string, xs: T[], varsayilan = 10, sifirla: unknown[] = []): { sayfadaki: T[]; ust: React.ReactNode; alt: React.ReactNode } {
  const k = "celse-sayfa-" + anahtar;
  const [boy, setBoyRaw] = useState<number>(() => { try { const v = Number(globalThis.localStorage?.getItem(k)); return BOYLAR.includes(v) ? v : varsayilan; } catch { return varsayilan; } });
  const [sayfa, setSayfa] = useState(0);
  const setBoy = (n: number) => { setBoyRaw(n); setSayfa(0); try { globalThis.localStorage?.setItem(k, String(n)); } catch { /* yok say */ } };
  useEffect(() => { setSayfa(0); }, sifirla); // süzgeç değişince başa dön
  const say = Math.max(1, Math.ceil(xs.length / boy));
  const cur = Math.min(sayfa, say - 1);
  const sayfadaki = xs.slice(cur * boy, cur * boy + boy);
  if (xs.length <= 5) return { sayfadaki: xs, ust: null, alt: null };
  const gezinme = say > 1 ? (
    <>
      <Btn kind="ghost" label={t("‹ Önceki")} disabled={cur === 0} onPress={() => setSayfa(cur - 1)} />
      <Text style={s.hint}>{t("{c}–{d} / {e}", { c: cur * boy + 1, d: Math.min(xs.length, (cur + 1) * boy), e: xs.length })}</Text>
      <Btn kind="ghost" label={t("Sonraki ›")} disabled={cur >= say - 1} onPress={() => setSayfa(cur + 1)} />
    </>
  ) : null;
  const ust = (
    <View style={[s.row, { alignItems: "flex-end", flexWrap: "wrap", gap: 8 }]}>
      <Acilir etiket={t("Sayfada")} secili={String(boy)} genislik={90} onSec={x => setBoy(Number(x))} secenekler={BOYLAR.map(n => ({ k: String(n), ad: String(n) }))} />
      {gezinme}
    </View>
  );
  const alt = say > 1 && sayfadaki.length >= 5 ? <View style={[s.row, { alignItems: "center", flexWrap: "wrap", gap: 8 }]}>{gezinme}</View> : null;
  return { sayfadaki, ust, alt };
}

/** Hazır kullanım: listenin üstünde "Sayfada" seçimi, altında sayfa geçişi. */
export function Sayfali<T>({ anahtar, xs, varsayilan = 10, sifirla = [], satir }: { anahtar: string; xs: T[]; varsayilan?: number; sifirla?: unknown[]; satir: (x: T, i: number) => React.ReactNode }) {
  const { sayfadaki, ust, alt } = useSayfalama(anahtar, xs, varsayilan, sifirla);
  return <>{ust}{sayfadaki.map(satir)}{alt}</>;
}
