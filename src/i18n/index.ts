// Dil desteği. Arayüz metinleri Türkçe kaynak cümleyle anahtarlanır: t("Karşılıklı duruşma") seçili dildeki karşılığı,
// yoksa Türkçesini döndürür. Değişkenler {ad} biçiminde yazılır: t("{n} dosya", { n: 5 }).
// Sözlükler: en.ts, es.ts, fr.ts, de.ts. Türk hukuku dosyaları Türkçe kalır; tahkim dosyalarının çevirileri ayrıca yüklenir.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import de from "./de";
import en from "./en";
import es from "./es";
import fr from "./fr";

export type Lang = "tr" | "en" | "es" | "fr" | "de";
export const LANGS: { id: Lang; label: string; name: string }[] = [
  { id: "tr", label: "TR", name: "Türkçe" },
  { id: "en", label: "EN", name: "English" },
  { id: "es", label: "ES", name: "Español" },
  { id: "fr", label: "FR", name: "Français" },
  { id: "de", label: "DE", name: "Deutsch" }
];
const DICT: Record<Exclude<Lang, "tr">, Record<string, string>> = { en, es, fr, de };
const KEY = "celse-dil";

let lang: Lang = "tr";
const listeners = new Set<(l: Lang) => void>();
let loaded = false;

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const v = (await AsyncStorage.getItem(KEY)) as Lang | null;
    if (v && LANGS.some(l => l.id === v)) { lang = v; markDocLang(v); listeners.forEach(f => f(lang)); }
  } catch { /* yok say */ }
}

export const getLang = () => lang;
/** Tarayıcıya sayfanın dilini bildirir (yoksa Chrome Türkçe sayfayı İngilizce sanıp çeviri önerir). */
function markDocLang(l: Lang) {
  // Uygulamanın kendi dil seçimi var: Chrome'un otomatik çevirisi kapatılır ("Kabul et" → "Kabil ve" gibi bozulmalar oluyordu).
  try { if (typeof document !== "undefined") { document.documentElement.lang = l; document.documentElement.setAttribute("translate", "no"); document.documentElement.classList.add("notranslate"); } } catch { /* yok say */ }
}
markDocLang("tr");

export function setLang(l: Lang) {
  lang = l;
  markDocLang(l);
  try { AsyncStorage.setItem(KEY, l); } catch { /* yok say */ }
  listeners.forEach(f => f(l));
}

export function t(s: string, vars?: Record<string, string | number>): string {
  let out = lang === "tr" ? s : DICT[lang][s] ?? s;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

/** Bileşeni dil değişince yeniden çizer. */
export function useLang(): [Lang, (l: Lang) => void] {
  const [l, setL] = useState(lang);
  useEffect(() => { listeners.add(setL); load(); return () => { listeners.delete(setL); }; }, []);
  return [l, setLang];
}

/** Yerel tarih/sayı biçimi için BCP-47 etiketi. */
export const locale = () => ({ tr: "tr-TR", en: "en-GB", es: "es-ES", fr: "fr-FR", de: "de-DE" }[lang]);
