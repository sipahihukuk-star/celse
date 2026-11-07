// "Evrakla duruşma provası": avukatın dosya evrakı cihazda maskelenir (src/engine/mask), sunucuya yalnız kodlu metin gider
// (danisma fonksiyonu, evrak işlemi; hiçbir şey kaydedilmez). Gelen hazırlık notları cihazda gerçek değerlere geri çevrilir.
import { call } from "./danisma";
import { unmask } from "../engine/mask";
import type { DerlemeKarti, PartiEvrak } from "../engine/mask/derleme";
import type { Senaryo } from "./danisma";
import type { CaseFile } from "../engine/types";
import { dosyaAc, senaryoAc } from "./evrakAc";
export { dosyaAc, senaryoAc };
import { setAktifMaske } from "../engine/mask/oturum";
import { arsivGuncelle } from "./evrakArsiv";

export interface Prova {
  ozet: string; uyusmazlik: string[]; hakimSorulari: { soru: string; cevap: string }[]; karsiArgumanlar: { arguman: string; cevap: string }[];
  zayif: string[]; eksik: string[]; sureler: string[]; sozlu: string; uyari?: string;
}
/** Yükleme üst sınırı yalnız tarayıcı belleği için (yaklaşık 20.000 sayfa); büyük dosya derlenerek gönderilir (src/engine/mask/derleme.ts). */
export const EVRAK_AZAMI = 60000000;

// paket: sunucunun verdiği imzalı bilet. Aynı evrak için ilk mod (oyna ya da izle) 3 kredi ve hazırlık notları dahil, öteki mod 2 kredi.
export const evrakProva = (metin: string, taraf: "davaci" | "davali", asama: string, paket?: string) =>
  call<Prova & { avukatKalan?: number; paket?: string }>("evrak", { metin, taraf, asama, kabul: true, akis: true, paket }, 300000);

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

// ---------- Duruşma salonu: yapay zekâ oynasın (izle) ya da avukat kendisi oynasın ----------

/** Canlandırma senaryosu (Duruşmayı izle oynatıcısıyla aynı biçim); kişiler kodlarıyla gelir. */
export const evrakIzle = (metin: string, taraf: "davaci" | "davali", asama: string, paket?: string) =>
  call<{ senaryo: Senaryo; avukatKalan?: number; paket?: string }>("evrak_izle", { metin, taraf, asama, kabul: true, akis: true, paket }, 300000);
/** Oynanabilir tek kişilik dosya; kişiler kodlarıyla gelir. */
export const evrakOyna = (metin: string, taraf: "davaci" | "davali", asama: string, paket?: string) =>
  call<{ dosya: unknown; avukatKalan?: number; paket?: string }>("evrak_oyna", { metin, taraf, asama, kabul: true, akis: true, paket }, 360000);

/** Büyük dosya: hacme göre kredi düşer ve 6 saat geçerli bilet döner (yöneticiye ve deneme izinlisine ücretsiz). */
export const evrakBiletAl = (toplam: number) => call<{ bilet: string; avukatKalan?: number | null }>("evrak_bilet", { toplam }, 30000);
/** Bir partideki evrakların kartları (tür, tarih, önem, özet, kilit noktalar). */
export const evrakDerle = (bilet: string, evraklar: PartiEvrak[]) =>
  call<{ kartlar: Partial<DerlemeKarti>[] }>("evrak_derle", { bilet, evraklar, akis: true }, 240000);

/** Evrak oturumu: ekran oyuna geçip geri dönünce kaybolmasın diye bellekte tutulur (cihazda; sunucuya gitmez).
 *  "Oturumu temizle" ya da uygulamanın kapanması siler. Oturum varken giden metinler yeniden kodlanır (mask/oturum.ts). */
export interface EvrakOturum {
  evraklar: { ad: string; metin: string }[]; yapistir: string; taraf: "davaci" | "davali"; asama: string; allow: string[]; extra: string[];
  map: Record<string, string>; prova?: { kodlu: Prova; acik: Prova }; senaryo?: Senaryo; dosya?: CaseFile;
  /** Büyük dosya derlemesi: bilet (6 saat; yeniden denemede kredi düşmez), evrak kartları ve tam metni istenen evraklar. */
  derleme?: { bilet?: string; kartlar?: DerlemeKarti[]; onemliler: number[] };
  /** Bu cihazdaki "Önceki hazırlıklarım" kaydı: kimliği ve (evrak yeniden yüklenmeden açıldıysa) kodların karşılıkları. */
  arsivId?: string; arsivMap?: Record<string, string>;
  /** Sunucunun imzalı prova paketi bileti (indirimli ikinci mod ve dahil hazırlık notları için). */
  paket?: string;
  /** Avukatın kendi oynadığı provanın dökümü (oyun bitince App yazar). */
  oynanan?: OynananProva;
  /** Hazırlık notları arka planda hazırlanıyor. */
  notlarBekliyor?: boolean;
}
export interface OynananProva { tarih: string; baslik: string; hukum: string; ozet: string; puan: string; adimlar: { soru: string; cevap: string; puan: number; not: string; madde?: string }[] }
let oturum: EvrakOturum | null = null;
export const evrakOturumu = () => oturum;
export function evrakOturumuYaz(o: EvrakOturum | null) {
  oturum = o;
  setAktifMaske(o ? o.map : null);
}

// ---------- Arka planda hazırlık notları ----------
// Mod (oyna ya da izle) hazırlanınca notlar arkada istenir; avukat bu sırada oynar ya da izler. Ekran açık olmasa da sonuç
// oturuma ve bu cihazdaki "Önceki hazırlıklarım" kaydına yazılır; açık ekran dinleyiciyle haberdar edilir.
const dinleyiciler = new Set<() => void>();
export function evrakDinle(f: () => void) { dinleyiciler.add(f); return () => { dinleyiciler.delete(f); }; }
export const evrakHaber = () => dinleyiciler.forEach(f => { try { f(); } catch { /* ekran kapanmış */ } });

export async function notlariArkadaAl(metin: string, taraf: "davaci" | "davali", asama: string, paket: string | undefined, map: Record<string, string>) {
  const o0 = oturum;
  if (!o0 || o0.prova || o0.notlarBekliyor) return;
  oturum = { ...o0, notlarBekliyor: true }; evrakHaber();
  const r = await evrakProva(metin, taraf, asama, paket);
  const o = oturum;
  if (!o || o.arsivId !== o0.arsivId) return; // bu arada başka bir dosyaya geçildi
  if (!r.ok) { oturum = { ...o, notlarBekliyor: false }; evrakHaber(); return; }
  const { avukatKalan: _k, paket: yeniPaket, ...kodlu } = r.data;
  void _k;
  const prova = { kodlu: kodlu as Prova, acik: provaAc(kodlu as Prova, map) };
  oturum = { ...o, notlarBekliyor: false, prova, paket: yeniPaket || o.paket };
  if (o.arsivId) arsivGuncelle(o.arsivId, { prova, paket: yeniPaket || o.paket }).catch(() => {});
  evrakHaber();
}

/** Avukatın oynadığı prova bitince (App.tsx): döküm oturuma ve cihazdaki kayda yazılır; "Provayı bitir"de çıktıya girer. */
export function oynananYaz(x: OynananProva) {
  const o = oturum;
  if (!o) return;
  oturum = { ...o, oynanan: x };
  if (o.arsivId) arsivGuncelle(o.arsivId, { oynanan: x }).catch(() => {});
  evrakHaber();
}
