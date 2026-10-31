// Dosya akışı (kariyer): her ay büroya branşlara ayrılmış yeni dosyalar gelir. Oyuncu kabul eder ya da geri çevirir;
// kabul edilen dosya masaya konur, duruşması bitince masadan kalkar ve ücreti kasaya girer.
// Hangi branşta başarılıysa o branştan daha çok dosya gelir; oyuncu isterse birkaç branşa odaklanabilir.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { CaseFile } from "../engine/types";
import { currentAccount, onAccountChange } from "./account";
import { Branch, branchOf, BRANCHES } from "./branches";
import { buildCareer, levelOf, Progress } from "./career";
import { sourceOf } from "./office";

export interface Offer { id: string; month: number }
export interface Flow {
  offers: Offer[];
  /** kabul edilip masada bekleyen dosyalar */
  active: string[];
  /** kapanan dosyalar: sonucu ve ayı */
  closed: Record<string, { won: boolean; score: number; month: number }>;
  /** geri çevrilen dosyalar (ay) — bir süre tekrar gelmez */
  declined: Record<string, number>;
  /** odaklanılan branşlar (boşsa hepsi) */
  focus: Branch[];
  /** dosyası gelmiş, yani açılmış branşlar */
  seen: Branch[];
  /** teklifler en son hangi ay için hazırlandı */
  dealtFor: number;
}

const empty = (): Flow => ({ offers: [], active: [], closed: {}, declined: {}, focus: [], seen: [], dealtFor: -1 });
const keyFor = () => `celse-dosya-v1:${currentAccount()?.id || "misafir"}`;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(f => f());
onAccountChange(emit);

export async function loadFlow(): Promise<Flow> {
  try { const v = await AsyncStorage.getItem(keyFor()); return v ? { ...empty(), ...JSON.parse(v) } : empty(); } catch { return empty(); }
}
async function save(f: Flow) {
  try { await AsyncStorage.setItem(keyFor(), JSON.stringify(f)); } catch { /* yok say */ }
  emit();
}

export function useFlow(): Flow | null {
  const [f, setF] = useState<Flow | null>(null);
  useEffect(() => {
    const load = () => { loadFlow().then(setF); };
    load(); listeners.add(load);
    return () => { listeners.delete(load); };
  }, []);
  return f;
}

/* ---------- Branş başarısı ---------- */

export interface BranchStat { id: Branch; label: string; icon: string; won: number; lost: number; weight: number; open: boolean; waiting: number }

export function branchStats(f: Flow, solo: CaseFile[]): BranchStat[] {
  const byId = new Map(solo.map(c => [c.id, c]));
  return BRANCHES.map(b => {
    let won = 0, lost = 0;
    for (const [id, r] of Object.entries(f.closed)) {
      const c = byId.get(id);
      if (c && branchOf(c) === b.id) r.won ? won++ : lost++;
    }
    // Başarı ağırlığı: her kazanılan dosya o branştan gelme ihtimalini artırır, kaybedilen biraz azaltır.
    const weight = Math.max(0.4, Math.min(6, 1 + won * 0.8 - lost * 0.35));
    const waiting = f.offers.filter(o => { const c = byId.get(o.id); return c && branchOf(c) === b.id; }).length;
    return { ...b, won, lost, weight, open: f.seen.includes(b.id), waiting };
  });
}

/* ---------- Teklif dağıtımı ---------- */

const rand = (seed: string) => { let h = 2166136261; for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; };

function diffWeight(d: CaseFile["difficulty"], month: number) {
  const k = d || "orta";
  if (month < 4) return { basit: 3, orta: 1, zor: 0.25 }[k];
  if (month < 10) return { basit: 1.4, orta: 2, zor: 0.9 }[k];
  return { basit: 0.8, orta: 1.5, zor: 2 }[k];
}

/** Ay başında teklifleri tazeler: bir aydan eski teklifler düşer (müvekkil başka avukata gider), boşluklar dolar. */
export function deal(f: Flow, solo: CaseFile[], progress: Progress, month: number, extra = 0): Flow {
  if (f.dealtFor === month) return f;
  const career = buildCareer(solo, progress);
  const openLevels = new Set(career.chapters.filter(ch => ch.open).map(ch => ch.level));
  const maxLevel = Math.max(1, ...openLevels);
  const stats = new Map(branchStats(f, solo).map(s => [s.id, s.weight]));
  const offers = f.offers.filter(o => month - o.month < 2 && !f.active.includes(o.id));
  const taken = new Set([...offers.map(o => o.id), ...f.active, ...Object.keys(f.closed)]);
  let pool = solo.filter(c => !c.career?.off && openLevels.has(levelOf(c)) && !taken.has(c.id) && !(f.declined[c.id] !== undefined && month - f.declined[c.id] < 6));
  const focused = f.focus.length ? pool.filter(c => f.focus.includes(branchOf(c))) : pool;
  if (focused.length) pool = focused;
  const want = 3 + extra;
  const r = rand(`${currentAccount()?.id || "m"}:${month}`);
  const seen = new Set(f.seen);
  while (offers.length < want && pool.length) {
    const w = pool.map(c => (stats.get(branchOf(c)) || 1) * diffWeight(c.difficulty, month) * (levelOf(c) === maxLevel ? 1.6 : 1));
    let t = r() * w.reduce((a, b) => a + b, 0), i = 0;
    while (i < w.length - 1 && (t -= w[i]) > 0) i++;
    const c = pool.splice(i, 1)[0];
    offers.push({ id: c.id, month });
    seen.add(branchOf(c));
  }
  return { ...f, offers, seen: BRANCHES.map(b => b.id).filter(b => seen.has(b)), dealtFor: month };
}

export async function ensureDeal(solo: CaseFile[], progress: Progress, month: number, extra = 0) {
  const f = await loadFlow();
  const n = deal(f, solo, progress, month, extra);
  if (n !== f) await save(n);
}

export async function accept(id: string) {
  const f = await loadFlow();
  if (!f.offers.some(o => o.id === id)) return;
  await save({ ...f, offers: f.offers.filter(o => o.id !== id), active: [...f.active, id] });
}
export async function decline(id: string, month: number) {
  const f = await loadFlow();
  await save({ ...f, offers: f.offers.filter(o => o.id !== id), declined: { ...f.declined, [id]: month } });
}
export async function setFocus(focus: Branch[]) {
  const f = await loadFlow();
  // Odak değişince yeni teklifler hemen o branşlardan gelsin: odak dışı bekleyen teklifler kalkar ve yeniden dağıtılır.
  await save({ ...f, focus, offers: focus.length ? [] : f.offers, dealtFor: -1 });
}
/** Dosya kapandı: masadan kalkar. */
export async function closeFile(id: string, won: boolean, score: number, month: number) {
  const f = await loadFlow();
  await save({ ...f, active: f.active.filter(x => x !== id), offers: f.offers.filter(o => o.id !== id), closed: { ...f.closed, [id]: { won, score, month } } });
}
export async function resetFlow() { await save(empty()); }

export const sourceTag = (c: CaseFile) => sourceOf(c);
