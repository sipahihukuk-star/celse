// Büro yönetimi: oyuncunun karakteri, büro şehri, kasa, aylık giderler ve dava gelirleri.
// Her dava oyunda bir ay sürer; dava bitince ücret kasaya girer, ay sonu giderleri düşülür.
// Tutarlar oyun içi yaklaşık değerlerdir (resmî tarife değildir).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { CaseFile } from "../engine/types";
import { currentAccount, onAccountChange } from "./account";
import { levelOf } from "./career";

export interface City { id: string; name: string; rent: number; fee: number; note: string }
/** rent: aylık büro kirası (TL) · fee: vekâlet ücreti çarpanı (büyük şehirde ücret ve iş hacmi yüksek, kira da yüksek) */
export const CITIES: City[] = [
  { id: "istanbul", name: "İstanbul", rent: 45000, fee: 1.4, note: "En yüksek ücretler, en pahalı kira, en çetin rekabet." },
  { id: "ankara", name: "Ankara", rent: 30000, fee: 1.25, note: "Yüksek yargı ve bakanlıklar burada; idare davaları bol." },
  { id: "izmir", name: "İzmir", rent: 32000, fee: 1.25, note: "Ticaret ve iş davaları güçlü, kira yüksek." },
  { id: "bursa", name: "Bursa", rent: 22000, fee: 1.1, note: "Sanayi şehri: iş ve ticaret davaları." },
  { id: "antalya", name: "Antalya", rent: 25000, fee: 1.1, note: "Turizm, kira ve tüketici uyuşmazlıkları." },
  { id: "kocaeli", name: "Kocaeli", rent: 20000, fee: 1.05, note: "Fabrikalar ve iş kazası davaları." },
  { id: "adana", name: "Adana", rent: 16000, fee: 0.95, note: "Tarım ve ticaret; ceza davaları yoğun." },
  { id: "konya", name: "Konya", rent: 16000, fee: 0.95, note: "Geniş il, düşük kira, sadık müvekkiller." },
  { id: "gaziantep", name: "Gaziantep", rent: 15000, fee: 0.95, note: "Hızla büyüyen ticaret merkezi." },
  { id: "kayseri", name: "Kayseri", rent: 14000, fee: 0.9, note: "Esnaf ve ticaret davaları." },
  { id: "eskisehir", name: "Eskişehir", rent: 15000, fee: 0.9, note: "Üniversite şehri, kira davaları bol." },
  { id: "samsun", name: "Samsun", rent: 14000, fee: 0.9, note: "Karadeniz'in adliye merkezi." },
  { id: "trabzon", name: "Trabzon", rent: 14000, fee: 0.85, note: "Bölge adliye mahkemesi burada." },
  { id: "diyarbakir", name: "Diyarbakır", rent: 12000, fee: 0.85, note: "CMK görevlendirmeleri sık, kira düşük." },
  { id: "erzurum", name: "Erzurum", rent: 11000, fee: 0.8, note: "Bölge adliye mahkemesi var; düşük gider." },
  { id: "van", name: "Van", rent: 10000, fee: 0.8, note: "En düşük gider; adli yardım işleri bol." }
];

/** Oyuncunun seçebileceği avukat karakterleri (gerçekçi görünüm fotoğrafları). */
export const AVATARS = ["av-erkek-38", "av-kadin-32", "av-erkek-58", "av-kadin-52", "av-erkek-25", "av-kadin-25", "av-kadin-basortulu"] as const;
export type Avatar = typeof AVATARS[number];

export interface Ledger { ay: number; text: string; amount: number }
export interface Office {
  name: string;
  city: string;
  avatar: Avatar;
  cash: number;
  /** oyunda geçen ay sayısı */
  month: number;
  secretary: boolean;
  ledger: Ledger[];
}

export const START_CASH = 150000;
export const FIXED = { ofis: 6000, baro: 2500, muhasebe: 3500 };
export const SECRETARY = 30000;

export function monthlyCost(o: Office) {
  const city = CITIES.find(c => c.id === o.city) || CITIES[0];
  const items = [
    { text: "Büro kirası", amount: city.rent },
    { text: "Elektrik, su, internet, kırtasiye", amount: FIXED.ofis },
    { text: "Baro aidatı ve mesleki sigorta", amount: FIXED.baro },
    { text: "Mali müşavir", amount: FIXED.muhasebe }
  ];
  if (o.secretary) items.push({ text: "Sekreter maaşı", amount: SECRETARY });
  return { items, total: items.reduce((n, i) => n + i.amount, 0) };
}

/* ---------- Davanın büroya geliş biçimi ve ücreti ---------- */

export type Source = "muvekkil" | "cmk" | "adli";
const hash = (s: string) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/** Ceza davalarında sanık müdafiliği çoğu zaman CMK görevlendirmesiyle, bazı hukuk davaları adli yardımla gelir. */
export function sourceOf(c: CaseFile): Source {
  const role = c.sides.p1.role.toLocaleLowerCase("tr");
  const h = hash(c.id) % 100;
  if (/müdafi/.test(role) && levelOf(c) <= 2) return h < 55 ? "cmk" : "muvekkil";
  if (levelOf(c) === 1 && /davacı|kiracı|işçi|mirasçı|borçlu/.test(role)) return h < 25 ? "adli" : "muvekkil";
  return "muvekkil";
}
export const SOURCE_LABEL: Record<Source, string> = { muvekkil: "Müvekkil", cmk: "CMK görevlendirmesi", adli: "Adli yardım" };

/** Vekâlet ücreti: seviye arttıkça yükselir; şehir çarpanı uygulanır. CMK ve adli yardımda ücret sabittir ve sonuca bağlı değildir. */
export function feeFor(c: CaseFile, o: Office, won: boolean, score: number) {
  const src = sourceOf(c);
  const city = CITIES.find(x => x.id === o.city) || CITIES[0];
  if (src === "cmk") return { amount: 7500, text: "CMK ücreti (baro aracılığıyla, sonuçtan bağımsız)" };
  if (src === "adli") return { amount: 9000, text: "Adli yardım ücreti (baro aracılığıyla, sonuçtan bağımsız)" };
  const base = [0, 40000, 85000, 150000, 220000, 300000][levelOf(c)] || 40000;
  const full = Math.round((base * city.fee * (o.secretary ? 1.1 : 1)) / 500) * 500;
  if (won) {
    const bonus = Math.round((full * Math.max(0, score - 60)) / 100 / 500) * 500;
    return { amount: full + bonus, text: bonus ? `Vekâlet ücreti ve başarı primi (ikna ${score})` : "Vekâlet ücreti" };
  }
  return { amount: Math.round((full * 0.4) / 500) * 500, text: "Peşin alınan ücret (dava kaybedildi)" };
}

/* ---------- Kayıt ---------- */

const keyFor = () => `celse-buro-v1:${currentAccount()?.id || "misafir"}`;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(f => f());
onAccountChange(emit);

export async function loadOffice(): Promise<Office | null> {
  try { const v = await AsyncStorage.getItem(keyFor()); return v ? JSON.parse(v) : null; } catch { return null; }
}
async function save(o: Office | null) {
  try { if (o) await AsyncStorage.setItem(keyFor(), JSON.stringify(o)); else await AsyncStorage.removeItem(keyFor()); } catch { /* yok say */ }
  emit();
}

export async function openOffice(name: string, city: string, avatar: Avatar) {
  await save({ name, city, avatar, cash: START_CASH, month: 0, secretary: false, ledger: [{ ay: 0, text: "Kuruluş sermayesi", amount: START_CASH }] });
}
export async function updateOffice(patch: Partial<Office>) {
  const o = await loadOffice(); if (o) await save({ ...o, ...patch });
}
export async function closeOffice() { await save(null); }

/** Dava bitince: ücret kasaya girer, bir ay geçer, ay sonu giderleri düşülür. Ekranda gösterilecek özet döner. */
export async function settleCase(c: CaseFile, won: boolean, score: number) {
  const o = await loadOffice();
  if (!o) return null;
  const fee = feeFor(c, o, won, score);
  const cost = monthlyCost(o);
  const month = o.month + 1;
  const ledger = [...o.ledger,
    { ay: month, text: `${c.title}: ${fee.text}`, amount: fee.amount },
    { ay: month, text: "Aylık giderler", amount: -cost.total }].slice(-60);
  const cash = o.cash + fee.amount - cost.total;
  await save({ ...o, cash, month, ledger });
  return { fee, cost: cost.total, cash, month, source: sourceOf(c) };
}

export function useOffice(): { office: Office | null; ready: boolean } {
  const [s, setS] = useState<{ office: Office | null; ready: boolean }>({ office: null, ready: false });
  useEffect(() => {
    const load = () => { loadOffice().then(office => setS({ office, ready: true })); };
    load(); listeners.add(load);
    return () => { listeners.delete(load); };
  }, []);
  return s;
}

export const tl = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("tr-TR")} TL`;
