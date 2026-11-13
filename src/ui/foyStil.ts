// Dava takibi ekranlarının ortak stilleri ve küçük yardımcıları (dosya seçme, indirme, tarih yazımı).
import { StyleSheet } from "react-native";
import { t } from "../i18n";
import { C, F } from "./theme";
import type { Kaynak } from "./foyEvrak";

/** Telefon ya da tablet tarayıcısı mı (iPadOS masaüstü gibi görünür; dokunmatik Mac yoktur). */
export const mobilTarayici = () => {
  const n = globalThis.navigator as (Navigator & { maxTouchPoints?: number }) | undefined;
  return !!n && (/Android|iPhone|iPad|iPod/i.test(n.userAgent || "") || (n.platform === "MacIntel" && (n.maxTouchPoints || 0) > 1));
};
/**
 * Telefonda dosya seçicinin süzgeci: iPhone ve Android, tanımadıkları uzantıları (.udf, .tif…) soluk gösterip seçtirmez.
 * Bu yüzden telefonda yalnız "image/*" gibi tür süzgeçleri bırakılır; uzantılı listede süzgeç kaldırılır, tür içerikten anlaşılır.
 */
export const secimSuzgeci = (accept: string) => (mobilTarayici() && /\.[a-z0-9]+/i.test(accept) ? "" : accept);
export function dosyaSec(accept: string, coklu = true): Promise<Kaynak[]> {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file"; input.multiple = coklu; input.accept = secimSuzgeci(accept);
    // iOS Safari'de sayfaya eklenmemiş input bazen açılmaz ya da seçimden sonra change olayı gelmez.
    input.style.display = "none"; document.body.appendChild(input);
    setTimeout(() => input.remove(), 10 * 60 * 1000);
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      input.remove();
      resolve(await Promise.all(files.map(async f => ({ ad: f.name, bytes: new Uint8Array(await f.arrayBuffer()), blob: f }))));
    };
    input.click();
  });
}
/** Dosyaları ya da bütün bir klasörü (alt klasörler dahil) seçtirir; içerik hemen okunmaz (çok sayıda dosyada bellek dolmasın). */
export function dosyaListesiSec(uzantilar: string[], klasor = false): Promise<File[]> {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file"; input.multiple = true;
    if (klasor) input.setAttribute("webkitdirectory", ""); else input.accept = secimSuzgeci(uzantilar.map(x => "." + x).join(","));
    input.onchange = () => {
      const xs = Array.from(input.files || []).filter(f => uzantilar.includes((f.name.split(".").pop() || "").toLowerCase()));
      resolve(xs);
    };
    input.click();
  });
}
export function indir(ad: string, icerik: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(icerik); a.download = ad; a.style.display = "none";
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
export const boyutYaz = (n: number) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
export const gunYaz = (g?: number) => (g === undefined ? "" : g === 0 ? t("bugün") : g === 1 ? t("yarın") : g > 0 ? t("{n} gün sonra", { n: g }) : t("{n} gün geçti", { n: -g }));

export const s = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 900, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 20, gap: 12 },
  head: { flexDirection: "row" },
  eyebrow: { fontFamily: F.mono, fontSize: 12, letterSpacing: 2.5, color: C.muted, marginTop: 4 },
  title: { fontFamily: F.display, fontSize: 30, color: C.brass },
  warn: { borderWidth: 1, borderColor: C.mid, borderRadius: 10, padding: 12, gap: 6, backgroundColor: "rgba(208,166,76,0.10)" },
  warnT: { fontFamily: F.bodyBold, fontSize: 15, color: C.text },
  warnD: { fontFamily: F.body, fontSize: 13, lineHeight: 19, color: C.textSoft },
  card: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 14, gap: 10 },
  cardT: { fontFamily: F.displayMed, fontSize: 20, color: C.text },
  secT: { fontFamily: F.bodyBold, fontSize: 15, color: C.brass, marginTop: 4 },
  body: { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.textSoft },
  hint: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: C.muted },
  meta: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: C.brassDim },
  label: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: C.brass, textTransform: "uppercase" },
  err: { fontFamily: F.bodyMed, fontSize: 14, lineHeight: 20, color: C.bad },
  link: { fontFamily: F.bodyMed, fontSize: 14, color: C.brass, textDecorationLine: "underline", paddingHorizontal: 4 },
  sil: { fontFamily: F.bodyMed, fontSize: 13, color: C.muted, textDecorationLine: "underline", paddingHorizontal: 4 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
  addRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.panel2 },
  chipOn: { backgroundColor: C.brass, borderColor: C.brass },
  chipT: { fontFamily: F.bodyMed, fontSize: 14, color: C.text },
  chipTOn: { color: C.brassInk, fontFamily: F.bodyBold },
  inputTek: { borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontFamily: F.body, fontSize: 15, color: C.text, backgroundColor: C.panel2 },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, minHeight: 90, fontFamily: F.body, fontSize: 15, color: C.text, backgroundColor: C.panel2, textAlignVertical: "top" },
  alanlar: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  alan: { flexGrow: 1, flexBasis: 260, gap: 4 },
  foy: { flexDirection: "row", gap: 10, alignItems: "center", borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, backgroundColor: C.panel2 },
  foyT: { fontFamily: F.bodyBold, fontSize: 16, color: C.text },
  foyD: { fontFamily: F.monoBold, fontSize: 13, color: C.text, textAlign: "right" },
  yak: { flexDirection: "row", gap: 12, alignItems: "center", borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 },
  yakTarih: { width: 120, fontFamily: F.monoBold, fontSize: 13, color: C.text },
  gorev: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  box: { width: 22, height: 22, borderRadius: 4, borderWidth: 1, borderColor: C.brassDim, marginTop: 2 },
  file: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, backgroundColor: C.panel2 },
  turChip: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1.2, color: C.brass, borderWidth: 1, borderColor: C.brassDim, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start" },
  ozelChip: { borderColor: C.mid, color: C.mid },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  girisK: { flexGrow: 1, flexBasis: 200, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, backgroundColor: C.panel2, gap: 2 },
  girisT: { fontFamily: F.bodyBold, fontSize: 15, color: C.text },
  zincir: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  zHalka: { borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.panel2 },
  zHalkaOn: { borderColor: C.brass },
  onemsiz: { opacity: 0.55 },
  fileT: { fontFamily: F.bodyMed, fontSize: 14, color: C.text }
});
