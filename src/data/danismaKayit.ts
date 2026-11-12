// "Derdini anlat" · oyuncu kayıtları: türler, bekleme süresi, oyun kaydının yazılması ve "Duruşmayı izle" senaryosuna çevrilmesi.
// Ağ ve cihaz bağımlılığı yoktur (komut satırında sınanır); sunucu işlemleri danismaDosya.ts'tedir.
import { normalizeCase, validateCase, verdict, GameState } from "../engine/engine";
import type { CaseFile, Scene } from "../engine/types";
import type { Kim, Sahne, Senaryo, SenaryoSatir } from "./danisma";

/** Oyuncu bu kadar dakika içinde dosyayı almazsa dosya sahibine haber verilir ve yapay zekâ canlandırması önerilir. */
export const INSAN_BEKLEME_DK = 30;

export type DosyaDurum = "bekliyor" | "oynaniyor" | "oynandi";

/** Duruşma ekranının tutanağındaki bir satır (GameScreen): gösterilen konuşma, verilen karar ya da açıklama notu. */
export interface TutanakSatiri { who: string; text: string; karar?: boolean; not?: boolean; scene?: Scene; /** konuşanın adı (kanun yolunda önceki aşamanın tutanağı gösterilirken) */ ad?: string }

export interface KayitSatiri { who: string; ad: string; text: string; scene: Scene; tur?: "karar" | "not" }
export interface OyunKaydi {
  baslik: string; mahkeme: string; ozet: string;
  /** opp: karşı vekilin adı (karşı vekil yoksa savcınınki; savci true) */
  roller: { p1: string; p2: string; opp?: string; karsi?: string; savci?: boolean };
  satirlar: KayitSatiri[];
  secimler: { soru: string; cevap: string; puan: number; not?: string; madde?: string; serbest?: boolean }[];
  puan: number;
  sonuc: { winner: string; stamp: string; hukum: string; summary: string };
  /** sunucu yazar (oynayanın takma adı) */
  oynayan?: string;
}

/** Dosya sahibinin gördüğü satır (oynayanın üye kimliği yoktur). */
export interface DanismaDosyasi {
  id: string; danisma_id: string; durum: DosyaDurum; oynayan: string | null; kayit: OyunKaydi | null;
  created_at: string; alindi_at: string | null; oynandi_at: string | null;
}

/** Oyuncunun listesindeki bekleyen dosya (dosya sahibinin kimliği yoktur). */
export interface BekleyenDosya { id: string; baslik: string; alan: string; mahkeme: string; ozet: string; durum: DosyaDurum; benim: boolean; created_at: string }

/** Dosya hâlâ bir oyuncu bekliyor ve bekleme süresi doldu mu (dosya sahibine yapay zekâ canlandırması önerilir). */
export const beklemeDoldu = (f: Pick<DanismaDosyasi, "durum" | "created_at">, now = Date.now()) =>
  f.durum !== "oynandi" && now - new Date(f.created_at).getTime() >= INSAN_BEKLEME_DK * 60000;

/** Dosyanın oyun motorunun doğrulamasından geçmiş hâli; geçemezse null (sunucu da denetler; bu ikinci emniyettir). */
export function oynanabilir(raw: unknown): CaseFile | null {
  try {
    const c = normalizeCase(raw as CaseFile);
    if (c.mode !== "solo" || !c.cast?.judge || validateCase(c).length) return null;
    return c;
  } catch { return null; }
}

/** Dosya kimliği oyundaki dava kimliğinden ("danisma-dosya:<kimlik>"). */
export const dosyaKimligi = (c: CaseFile) => (c.id.startsWith("danisma-dosya:") ? c.id.slice("danisma-dosya:".length) : null);

const cut = (s: unknown, n: number) => String(s ?? "").slice(0, n);

/** Biten oyunun kaydı: duruşma ekranının tutanağı, motorun hamle kaydı (seçim, puan, açıklama) ve karar. */
export function kayitOf(c: CaseFile, game: GameState, tutanak: TutanakSatiri[]): OyunKaydi {
  const v = verdict(c, game);
  const ad = (who: string) => who === "narr" ? "Dosya notu" : who === "p1" ? c.sides.p1.role : c.cast[who]?.name || (who === "karsi" ? "Karşı taraf" : who);
  const onek = `${c.sides.p1.short}: `;
  return {
    baslik: cut(c.title, 120), mahkeme: cut(c.court, 120), ozet: cut(c.teaser, 1500),
    roller: { p1: c.sides.p1.role, p2: c.sides.p2.role, opp: c.cast.opp?.name || c.cast.pros?.name, karsi: c.cast.karsi?.name, ...(!c.cast.opp && c.cast.pros ? { savci: true } : {}) },
    satirlar: tutanak.slice(0, 400).map(h => ({
      who: h.karar ? "p1" : h.who, ad: cut(ad(h.karar ? "p1" : h.who), 80),
      text: cut(h.karar && h.text.startsWith(onek) ? h.text.slice(onek.length) : h.text, 2000),
      scene: h.scene === "office" ? "office" : "court",
      ...(h.karar ? { tur: "karar" as const } : h.not ? { tur: "not" as const } : {})
    })),
    secimler: game.log.slice(0, 60).map(e => ({ soru: cut(e.prompt, 500), cevap: cut(e.text, 2000), puan: e.delta, ...(e.note ? { not: cut(e.note, 1500) } : {}), ...(e.law ? { madde: cut(e.law, 200) } : {}), ...(e.free ? { serbest: true } : {}) })),
    puan: game.score,
    sonuc: { winner: v.winner, stamp: v.stamp, hukum: cut(v.hukum, 3000), summary: cut(v.summary, 3000) }
  };
}

/** Kayıttaki konuşanın "Duruşmayı izle" oynatıcısındaki karşılığı; anlatıcı, tanık, bilirkişi gibi kişiler görsel oynatıcıda
 *  gösterilmez (metin olarak tutanakta kalır). */
function kimOf(who: string, k: OyunKaydi): Kim | null {
  if (who === "p1") return "bizAvukat";
  if (who === "client") return "biz";
  if (who === "judge") return "hakim";
  if (who === "opp" || (who === "pros" && k.roller?.savci)) return "karsiAvukat";
  if (who === "karsi" || who === "party_p2") return "karsiTaraf";
  return null;
}

/** Oyuncu kaydını "Duruşmayı izle" senaryosuna çevirir: büro satırları görüşme sahnesi, salon satırları duruşma, karar hâkimin sözü.
 *  Görsel oynatıcıda gösterilecek konuşma yoksa null (ekran metin tutanağını gösterir). */
export function kayitSenaryo(k: OyunKaydi): Senaryo | null {
  const sahneler: Sahne[] = [];
  for (const l of k.satirlar || []) {
    if (l.tur === "not") continue;
    const kim = kimOf(l.who, k);
    if (!kim || !l.text) continue;
    const tur = l.scene === "office" ? "gorusme_biz" : "durusma";
    const son = sahneler[sahneler.length - 1];
    const satir: SenaryoSatir = { kim, metin: l.text };
    if (son && son.tur === tur) son.satirlar.push(satir); else sahneler.push({ tur, satirlar: [satir] });
  }
  if (sahneler.reduce((a, x) => a + x.satirlar.length, 0) < 2) return null;
  const karar = [k.sonuc?.hukum, k.sonuc?.summary].map(x => (x || "").trim()).filter(Boolean);
  if (karar.length) sahneler.push({ tur: "karar", satirlar: karar.map(metin => ({ kim: "hakim" as Kim, metin })) });
  const davali = /davalı|sanık|müdafi|şüpheli/i.test(k.roller?.p1 || "");
  return {
    taraf: davali ? "davali" : "davaci", mahkeme: k.mahkeme || "", ozet: k.ozet || "",
    roller: { bizAvukat: k.oynayan || k.roller?.p1 || "", karsiAvukat: k.roller?.opp || "", hakim: "", karsiTaraf: k.roller?.karsi || k.roller?.p2 || "" },
    sahneler, uyari: "", oyuncu: k.oynayan || "Avukat oyuncu"
  };
}
