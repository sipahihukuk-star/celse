// Kanun yolu süresinin son günü. Arayüzden bağımsızdır; oyundaki tarih adımı, testler ve dosya üreticisi aynı hesabı kullanır.
//
// Kural: süre tebliğin ertesi günü başlar (ilk gün sayılmaz). Gün olarak süre, son günün bitiminde; hafta olarak süre,
// başladığı güne karşılık gelen haftanın aynı adlı gününde biter (HMK m.92; CMK m.39). Son gün resmî tatile ya da hafta
// sonuna rastlarsa süre izleyen ilk iş gününün bitimine uzar (HMK m.93; CMK m.39/3; İYUK m.8/3).
import { ADLI_TATIL, BAYRAMLAR, SABIT_TATIL } from "./sinirlar";
import { DeadlineRule, Regime } from "./types";

const DAY = 86400000;
const GUN = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

/** "GG.AA.YYYY" (ya da G.A.YYYY, "/" ve "-" ayraçlı) → UTC gece yarısı; geçersizse null. */
export function parseDate(s: string): Date | null {
  const m = (s || "").trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return d.getUTCDate() === +m[1] && d.getUTCMonth() === +m[2] - 1 ? d : null;
}
export const fmtDate = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
/** "3 Mayıs 2027 Pazartesi" */
export const longDate = (d: Date) => `${d.getUTCDate()} ${AY[d.getUTCMonth()]} ${d.getUTCFullYear()} ${GUN[d.getUTCDay()]}`;
export const weekday = (d: Date) => GUN[d.getUTCDay()];
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

const md = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
const iso = (d: Date) => `${d.getUTCFullYear()}-${md(d)}`;

/** Resmî tatil mi? (hafta sonu hariç) Adı döner. */
export function holidayName(d: Date): string | null {
  const k = md(d);
  if (SABIT_TATIL.includes(k)) {
    return ({ "01-01": "Yılbaşı", "04-23": "Ulusal Egemenlik ve Çocuk Bayramı", "05-01": "Emek ve Dayanışma Günü", "05-19": "Atatürk'ü Anma, Gençlik ve Spor Bayramı",
      "07-15": "Demokrasi ve Millî Birlik Günü", "08-30": "Zafer Bayramı", "10-29": "Cumhuriyet Bayramı" } as Record<string, string>)[k];
  }
  // BAYRAMLAR her yıl için 7 gün: önce Ramazan (3), sonra Kurban (4).
  const i = BAYRAMLAR.indexOf(iso(d));
  if (i >= 0) return i % 7 < 3 ? "Ramazan Bayramı" : "Kurban Bayramı";
  return null;
}
export const isWorkday = (d: Date) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !holidayName(d);

export interface DeadlineCalc {
  teblig: Date;
  /** sürenin takvime göre bittiği gün (tatil kaydırması öncesi) */
  raw: Date;
  /** adli tatil uzaması sonrası */
  afterTatil: Date;
  /** gerçek son gün */
  last: Date;
  /** son günün neden kaydığı (ör. "Cumartesi", "Zafer Bayramı", "adli tatil") */
  shifts: string[];
  label: string;
}

/** Sürenin son günü. regime verilirse adli tatil uzaması uygulanır (sinirlar.ts → ADLI_TATIL). */
export function lastDay(r: DeadlineRule, regime?: Regime): DeadlineCalc {
  const teblig = parseDate(r.teblig);
  if (!teblig) throw new Error(`Geçersiz tebliğ tarihi: ${r.teblig}`);
  const n = r.weeks ? r.weeks * 7 : r.days || 0;
  const raw = addDays(teblig, n);
  const shifts: string[] = [];
  let d = raw;
  const ext = regime ? ADLI_TATIL.uzama[regime] : undefined;
  if (ext) {
    const y = d.getUTCFullYear(), from = parseDate(`${ADLI_TATIL.from.slice(3)}.${ADLI_TATIL.from.slice(0, 2)}.${y}`)!, to = parseDate(`${ADLI_TATIL.to.slice(3)}.${ADLI_TATIL.to.slice(0, 2)}.${y}`)!;
    if (d >= from && d <= to) { d = addDays(to, ext); shifts.push(`adli tatil (${ext} gün uzar)`); }
  }
  const afterTatil = d;
  while (!isWorkday(d)) { shifts.push(holidayName(d) || weekday(d)); d = addDays(d, 1); }
  const label = r.weeks ? `${r.weeks === 1 ? "bir" : r.weeks === 2 ? "iki" : r.weeks} hafta` : `${r.days} gün`;
  return { teblig, raw, afterTatil, last: d, shifts, label };
}

/** Oyuncunun yazdığı günün değerlendirmesi: 100 doğru, 50 süreden önce (dilekçe yine süresinde), 0 süre geçmiş. */
export function gradeDeadline(r: DeadlineRule, answer: string, regime?: Regime): { score: number; feedback: string; calc: DeadlineCalc } | null {
  const a = parseDate(answer);
  if (!a) return null;
  const calc = lastDay(r, regime);
  const why = explainDeadline(r, regime, calc);
  const score = a.getTime() === calc.last.getTime() ? 100 : a < calc.last ? 50 : 0;
  const you = `Yazdığınız gün: ${longDate(a)}.`;
  const feedback = score === 100 ? `${you} Doğru. ${why}` : score === 50 ? `${you} Bu gün süre içinde, ama son gün değil. ${why}` : `${you} Bu gün süre dışında. ${why}`;
  return { score, feedback, calc };
}

/** "Tebliğ 19.04.2027 Pazartesi; süre ertesi gün başlar, iki hafta 03.05.2027 Pazartesi günü biter (HMK m.345)." */
export function explainDeadline(r: DeadlineRule, regime?: Regime, calc = lastDay(r, regime)): string {
  const parts = [`Tebliğ ${fmtDate(calc.teblig)} ${weekday(calc.teblig)}; süre ertesi gün başlar ve ${calc.label} ${fmtDate(calc.raw)} ${weekday(calc.raw)} günü dolar (${r.law}).`];
  if (calc.afterTatil.getTime() !== calc.raw.getTime()) parts.push(`Bu gün adli tatile rastladığından süre ${fmtDate(calc.afterTatil)} gününe uzar.`);
  if (calc.last.getTime() !== calc.afterTatil.getTime()) {
    const why = Array.from(new Set(calc.shifts.filter(s => !s.startsWith("adli")))).join(", ");
    parts.push(`Son gün tatile (${why}) rastladığından süre izleyen ilk iş günü, ${fmtDate(calc.last)} ${weekday(calc.last)} bitiminde dolar (${regime === "cmk" ? "CMK m.39/3" : regime === "iyuk" ? "İYUK m.8/3" : "HMK m.93"}).`);
  }
  parts.push(`Son gün: ${longDate(calc.last)}.`);
  return parts.join(" ");
}

/** Tebliğ tarihi önerisi: karar tarihinden `after` gün sonraki iş günü; son gün adli tatile rastlamasın diye gerekirse ileri alınır. */
export function suggestTeblig(kararTarihi: string, rule: Omit<DeadlineRule, "teblig">, regime: Regime, after = 18): string {
  let d = parseDate(kararTarihi) || parseDate("01.03.2027")!;
  d = addDays(d, after);
  const inTatil = (x: Date) => { const k = md(x); return k >= ADLI_TATIL.from && k <= ADLI_TATIL.to; };
  for (let i = 0; i < 80; i++) {
    if (isWorkday(d) && !inTatil(d)) {
      const c = lastDay({ ...rule, teblig: fmtDate(d) }, regime);
      if (c.afterTatil.getTime() === c.raw.getTime() && !inTatil(c.raw)) return fmtDate(d);
    }
    d = addDays(d, 1);
  }
  return fmtDate(d);
}
