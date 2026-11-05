// "Evrakla duruşma provası": avukatın dosya evrakı cihazda maskelenir (src/engine/mask), sunucuya yalnız kodlu metin gider
// (danisma fonksiyonu, evrak işlemi; hiçbir şey kaydedilmez). Gelen hazırlık notları cihazda gerçek değerlere geri çevrilir.
import { call } from "./danisma";
import { unmask } from "../engine/mask";

export interface Prova {
  ozet: string; uyusmazlik: string[]; hakimSorulari: { soru: string; cevap: string }[]; karsiArgumanlar: { arguman: string; cevap: string }[];
  zayif: string[]; eksik: string[]; sureler: string[]; sozlu: string; uyari?: string;
}
export const EVRAK_AZAMI = 120000;

export const evrakProva = (metin: string, taraf: "davaci" | "davali", asama: string) =>
  call<Prova>("evrak", { metin, taraf, asama, kabul: true }, 240000);

/** Hazırlık notlarındaki kodları gerçek değerlere çevirir (yalnız cihazda). */
export function provaAc(p: Prova, map: Record<string, string>): Prova {
  const u = (s: string) => unmask(s, map);
  return {
    ...p, ozet: u(p.ozet), sozlu: u(p.sozlu), uyusmazlik: p.uyusmazlik.map(u), zayif: p.zayif.map(u), eksik: p.eksik.map(u), sureler: p.sureler.map(u),
    hakimSorulari: p.hakimSorulari.map(x => ({ soru: u(x.soru), cevap: u(x.cevap) })),
    karsiArgumanlar: p.karsiArgumanlar.map(x => ({ arguman: u(x.arguman), cevap: u(x.cevap) }))
  };
}

/** Hazırlık notlarının düz metni (kopyalama ve indirme için). */
export function provaMetni(p: Prova, t: (s: string) => string): string {
  const L: string[] = [t("EVRAKLA DURUŞMA PROVASI"), "", t("Özet"), p.ozet, ""];
  const sec = (h: string, xs: string[]) => { if (xs.length) L.push(h, ...xs.map(x => "• " + x), ""); };
  sec(t("Çekişmeli konular"), p.uyusmazlik);
  if (p.hakimSorulari.length) L.push(t("Hâkimin sorabileceği sorular"), ...p.hakimSorulari.flatMap((x, i) => [`${i + 1}. ${x.soru}`, `   → ${x.cevap}`]), "");
  if (p.karsiArgumanlar.length) L.push(t("Karşı tarafın argümanları ve cevaplarımız"), ...p.karsiArgumanlar.flatMap((x, i) => [`${i + 1}. ${x.arguman}`, `   → ${x.cevap}`]), "");
  sec(t("Zayıf noktalar ve riskler"), p.zayif);
  sec(t("Eksik delil ve yapılacaklar"), p.eksik);
  sec(t("Süreler"), p.sureler);
  if (p.sozlu) L.push(t("Sözlü beyan taslağı"), p.sozlu, "");
  if (p.uyari) L.push(p.uyari);
  return L.join("\n");
}
