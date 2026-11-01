// Dosya akışı (kariyer): her ay büroya branşlara ayrılmış yeni dosyalar gelir. Oyuncu kabul eder ya da geri çevirir;
// kabul edilen dosya masaya konur, duruşması bitince masadan kalkar ve ücreti kasaya girer.
// Hangi branşta başarılıysa o branştan daha çok dosya gelir; oyuncu isterse birkaç branşa odaklanabilir.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { CaseFile, Side } from "../engine/types";
import { currentAccount, onAccountChange } from "./account";
import { Branch, branchOf, BRANCHES } from "./branches";
import { buildCareer, levelOf, Progress } from "./career";
import { careerSide, publicRole, Source, sourceOf } from "./office";

export interface Offer { id: string; month: number; src?: Source; side?: Side }
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
  /** dosyanın büroya geliş yolu (CMK, adli yardım, müvekkil) ve karşılıklı dosyada büronun tarafı */
  src: Record<string, Source>;
  side: Record<string, Side>;
  /** uzmanlık alanı (oyun önerir, oyuncu onaylar) ve önerinin en son sorulduğu kapalı dosya sayısı */
  specialty: Branch[];
  specialtyAskedAt?: number;
}

const empty = (): Flow => ({ offers: [], active: [], closed: {}, declined: {}, focus: [], seen: [], dealtFor: -1, src: {}, side: {}, specialty: [] });
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

/** Kariyerin başı: ilk dosyalar baro üzerinden (CMK ve adli yardım) gelir; bu kadar dosya kapanınca serbest müvekkiller gelir. */
export const EARLY_FILES = 3;
/** Uzmanlık önerisinin ilk sorulduğu kapalı dosya sayısı. */
export const SPECIALTY_AT = 6;

/** Bu ay masaya gelecek teklif sayısı: başta iki, kapanan dosya arttıkça çoğalır; okul ve çalışanlar etkiler. */
export function offerCount(f: Flow, extra = 0, slow = 0) {
  const closed = Object.keys(f.closed).length;
  const base = closed < EARLY_FILES ? 2 : Math.min(5, 2 + Math.floor((closed - EARLY_FILES) / 3) + 1);
  return Math.max(1, base + extra - slow);
}

/** Ay başında teklifleri tazeler: bir aydan eski teklifler düşer (müvekkil başka avukata gider), boşluklar dolar.
 *  pool: kariyere girebilen bütün dosyalar (tek kişilik, karşılıklı, tahkim). */
export function deal(f: Flow, pool0: CaseFile[], progress: Progress, month: number, extra = 0, slow = 0, dr = false): Flow {
  if (f.dealtFor === month) return f;
  const career = buildCareer(pool0, progress, true, Infinity, { dr });
  const openLevels = new Set(career.chapters.filter(ch => ch.open).map(ch => ch.level));
  const maxLevel = Math.max(1, ...openLevels);
  const stats = new Map(branchStats(f, pool0).map(s => [s.id, s.weight]));
  const offers = f.offers.filter(o => month - o.month < 2 && !f.active.includes(o.id));
  const taken = new Set([...offers.map(o => o.id), ...f.active, ...Object.keys(f.closed)]);
  const early = Object.keys(f.closed).length < EARLY_FILES;
  let pool = pool0.filter(c => !c.career?.off && openLevels.has(levelOf(c)) && !taken.has(c.id) && !(f.declined[c.id] !== undefined && month - f.declined[c.id] < 6));
  // Başlangıç: yalnız baro görevlendirmeleri (CMK müdafiliği, adli yardım), önce kolay olanlar.
  if (early) { const pub = pool.filter(c => publicRole(c) && c.difficulty !== "zor"); if (pub.length) pool = pub; }
  const focused = f.focus.length ? pool.filter(c => f.focus.includes(branchOf(c))) : pool;
  if (focused.length) pool = focused;
  const want = offerCount(f, extra, slow);
  const r = rand(`${currentAccount()?.id || "m"}:${month}`);
  const seen = new Set(f.seen);
  const src = { ...f.src }, side = { ...f.side };
  while (offers.length < want && pool.length) {
    // Başlangıçta CMK ve adli yardım dosyaları karışık gelsin: gelmiş türden olmayan varsa önce o.
    if (early) {
      const got = new Set(offers.map(o => o.src));
      const fresh = pool.filter(c => !got.has(publicRole(c)?.src));
      if (fresh.length && fresh.length < pool.length) { const keep = new Set(fresh.map(c => c.id)); pool = [...fresh, ...pool.filter(c => !keep.has(c.id))].slice(0, fresh.length); }
    }
    const w = pool.map(c => (stats.get(branchOf(c)) || 1) * diffWeight(c.difficulty, month) * (levelOf(c) === maxLevel ? 1.6 : 1)
      * (f.specialty.includes(branchOf(c)) ? 2.5 : 1) * (c.mode === "duel" ? 0.8 : 1));
    let t = r() * w.reduce((a, b) => a + b, 0), i = 0;
    while (i < w.length - 1 && (t -= w[i]) > 0) i++;
    const c = pool.splice(i, 1)[0];
    // Geliş yolu: başlangıçta baro görevi; sonra müdafilik dosyalarının yarısı CMK, bazı ilk derece dosyaları adli yardım.
    const pub = publicRole(c);
    const roll = r();
    const s: Source = pub && (early || roll < (pub.src === "cmk" ? 0.5 : 0.2)) ? pub.src : c.mode === "solo" ? sourceOf(c) : "muvekkil";
    src[c.id] = s;
    side[c.id] = pub && s !== "muvekkil" ? pub.side : careerSide(c);
    offers.push({ id: c.id, month, src: s, side: side[c.id] });
    seen.add(branchOf(c));
  }
  return { ...f, offers, src, side, seen: BRANCHES.map(b => b.id).filter(b => seen.has(b)), dealtFor: month };
}

/** Uzmanlık önerisi: en başarılı iki branş (en az bir kazanılmış dosyası olan). */
export function suggestSpecialty(f: Flow, pool: CaseFile[]): Branch[] {
  return branchStats(f, pool).filter(b => b.won > 0).sort((a, b) => b.weight - a.weight || b.won - a.won).slice(0, 2).map(b => b.id);
}
export function specialtyDue(f: Flow) {
  const closed = Object.keys(f.closed).length;
  return !f.specialty.length && closed >= SPECIALTY_AT && closed - (f.specialtyAskedAt ?? -99) >= 4;
}
export async function setSpecialty(b: Branch[]) {
  const f = await loadFlow();
  await save({ ...f, specialty: b, specialtyAskedAt: Object.keys(f.closed).length, offers: [], dealtFor: -1 });
}
export async function postponeSpecialty() {
  const f = await loadFlow();
  await save({ ...f, specialtyAskedAt: Object.keys(f.closed).length });
}

export async function ensureDeal(pool: CaseFile[], progress: Progress, month: number, extra = 0, slow = 0, dr = false) {
  const f = await loadFlow();
  const n = deal(f, pool, progress, month, extra, slow, dr);
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
