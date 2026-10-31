// Kariyer modu: oyuncu tek hâkimli yerel mahkemelerde başlar, kazandıkça yüksek mahkemelere ilerler.
// Kurallar arayüzden bağımsızdır; ekranlar yalnızca buildCareer() sonucunu çizer.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { CaseFile } from "../engine/types";
import { currentAccount, onAccountChange, supabase } from "./account";

export interface Chapter {
  level: number;
  title: string;
  /** bu bölüme ulaşan oyuncunun unvanı */
  rank: string;
  courts: string;
  blurb: string;
}

export const CHAPTERS: Chapter[] = [
  { level: 1, title: "Adliyede ilk yıl", rank: "Genç avukat", courts: "Sulh, Asliye Hukuk, Asliye Ceza, İş Mahkemesi",
    blurb: "Tek hâkimli mahkemeler. Süreler, ispat yükü ve temel usul hataları." },
  { level: 2, title: "Heyetli mahkemeler", rank: "Avukat", courts: "Ağır Ceza, İdare ve Vergi Mahkemesi, Bölge Adliye Mahkemesi",
    blurb: "Başkan ve iki üyeli heyetler, istinaf incelemesi." },
  { level: 3, title: "Yüksek yargı", rank: "Kıdemli avukat", courts: "Yargıtay, Danıştay, Sayıştay",
    blurb: "Duruşmalı temyiz, Danıştay'da ilk derece davaları, Sayıştay yargılaması." },
  { level: 4, title: "Anayasa Mahkemesi", rank: "Anayasa avukatı", courts: "Bölümler, Genel Kurul, Yüce Divan",
    blurb: "Bireysel başvuru, iptal davası ve Yüce Divan yargılaması." },
  { level: 5, title: "Uluslararası mahkemeler", rank: "Uluslararası avukat", courts: "Avrupa İnsan Hakları Mahkemesi, Uluslararası Ceza Mahkemesi",
    blurb: "Strazburg ve Lahey: büyük heyetler, yabancı usul." }
];

/** Davanın kariyer seviyesi: elle yazılmışsa o, yazılmamışsa mahkemeden çıkarılır. */
export function levelOf(c: CaseFile): number {
  const l = c.career?.level;
  if (l && l >= 1 && l <= CHAPTERS.length) return l;
  const court = c.court || "";
  if (c.room === "uluslararasi" || /İnsan Hakları|Ceza Mahkemesi ·|Uluslararası/.test(court)) return 5;
  if (/Anayasa|Yüce Divan/.test(court)) return 4;
  if (/Yargıtay|Danıştay|Sayıştay/.test(court)) return 3;
  if ((c.bench?.judges || 1) > 1 || /Ağır Ceza|Bölge|İdare Mahkemesi|Vergi Mahkemesi/.test(court)) return 2;
  return 1;
}

/** Bir sonraki bölümü açmak için bu bölümde kazanılması gereken dava sayısı. */
export const winsNeeded = (n: number) => Math.min(4, Math.max(1, Math.ceil(n * 0.6)));

/* ---------- İlerleme kaydı ---------- */

export interface CaseRecord { played: number; won: boolean; best: number }
export type Progress = Record<string, CaseRecord>;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(f => f());
onAccountChange(emit);

/** Her oyuncunun kariyeri ayrı anahtarda tutulur; oturum yoksa "misafir". */
const keyFor = () => `celse-kariyer-v1:${currentAccount()?.id || "misafir"}`;

async function loadLocal(): Promise<Progress> {
  try { return JSON.parse((await AsyncStorage.getItem(keyFor())) || "{}"); } catch { return {}; }
}

/** Sunucudaki kayıtlarla yereli birleştirir (her dava için en iyi değer). */
export async function loadProgress(): Promise<Progress> {
  const local = await loadLocal();
  const acc = currentAccount(), sb = supabase();
  if (acc?.mode !== "server" || !sb) return local;
  try {
    const { data } = await sb.from("kariyer").select("dava_id, oynama, kazandi, en_iyi").eq("kullanici_id", acc.id);
    const merged: Progress = { ...local };
    (data || []).forEach(r => {
      const l = merged[r.dava_id];
      merged[r.dava_id] = { played: Math.max(l?.played || 0, r.oynama), won: !!(l?.won || r.kazandi), best: Math.max(l?.best || 0, r.en_iyi) };
    });
    await AsyncStorage.setItem(keyFor(), JSON.stringify(merged));
    return merged;
  } catch { return local; }
}

/** Tek kişilik bir davanın sonucunu kaydeder. En iyi puan ve "en az bir kez kazandı" bilgisi korunur. */
export async function recordResult(id: string, won: boolean, score: number) {
  try {
    const all = await loadLocal();
    const prev = all[id] || { played: 0, won: false, best: 0 };
    const rec = { played: prev.played + 1, won: prev.won || won, best: won ? Math.max(prev.best, score) : prev.best };
    all[id] = rec;
    await AsyncStorage.setItem(keyFor(), JSON.stringify(all));
    const acc = currentAccount(), sb = supabase();
    if (acc?.mode === "server" && sb) {
      await sb.from("kariyer").upsert({ kullanici_id: acc.id, dava_id: id, oynama: rec.played, kazandi: rec.won, en_iyi: rec.best, guncelleme: new Date().toISOString() });
    }
  } catch { /* depolama ya da ağ yoksa sessizce geç; yerel kayıt kalır */ }
  emit();
}

export async function resetProgress() {
  try { await AsyncStorage.removeItem(keyFor()); } catch { /* yok say */ }
  const acc = currentAccount(), sb = supabase();
  if (acc?.mode === "server" && sb) { try { await sb.from("kariyer").delete().eq("kullanici_id", acc.id); } catch { /* yok say */ } }
  emit();
}

export function useProgress(): Progress {
  const [p, setP] = useState<Progress>({});
  useEffect(() => {
    const load = () => { loadProgress().then(setP); };
    load(); listeners.add(load);
    return () => { listeners.delete(load); };
  }, []);
  return p;
}

/* ---------- Kariyer durumu ---------- */

export type CaseLock = "open" | "locked";
export interface CareerCase { c: CaseFile; lock: CaseLock; rec?: CaseRecord; why?: string }
export interface CareerChapter extends Chapter {
  cases: CareerCase[];
  open: boolean;
  wins: number;
  need: number;
  /** kilitliyse neden */
  why?: string;
}
export interface CareerView {
  chapters: CareerChapter[];
  /** ulaşılan en yüksek açık bölümün unvanı */
  rank: string;
  /** kazanılan davaların en iyi puanlarının toplamı */
  itibar: number;
  won: number;
  total: number;
  /** sıradaki hedef cümlesi */
  next: string;
}

export const DIFFICULTY = {
  basit: { label: "Basit", rank: 0, color: "#4fae7c" },
  orta: { label: "Orta", rank: 1, color: "#d0a64c" },
  zor: { label: "Zor", rank: 2, color: "#d65a45" }
} as const;

/** Bölüm içinde: önce basit, sonra orta, sonra zor; aynı zorlukta `order`, o da yoksa liste sırası. */
const sortKey = (c: CaseFile, idx: Map<string, number>) =>
  DIFFICULTY[c.difficulty || "orta"].rank * 100000 + (c.career?.order ?? 1000 + idx.get(c.id)!);
const sortCases = (a: CaseFile, b: CaseFile, idx: Map<string, number>) => sortKey(a, idx) - sortKey(b, idx);

/**
 * Kurallar:
 * - İlk bölüm baştan açıktır. Bir bölüm, önceki dolu bölümde yeterli dava kazanılınca açılır. Boş bölümler ("yakında") atlanır.
 * - Açık bölümde davalar sırayla açılır: bir dava oynanınca (sonucu ne olursa olsun) sıradaki açılır.
 */
export function buildCareer(solo: CaseFile[], progress: Progress): CareerView {
  const idx = new Map(solo.map((c, i) => [c.id, i]));
  const pool = solo.filter(c => !c.career?.off);
  let prevOpen = true, prevWins = 0, prevNeed = 0, prevTitle = "";
  let rankName = CHAPTERS[0].rank, itibar = 0, wonAll = 0, next = "";
  const chapters: CareerChapter[] = CHAPTERS.map(ch => {
    const list = pool.filter(c => levelOf(c) === ch.level).sort((a, b) => sortCases(a, b, idx));
    const wins = list.filter(c => progress[c.id]?.won).length;
    const need = winsNeeded(list.length);
    let open: boolean, why: string | undefined;
    if (!list.length) { open = false; why = "Yakında"; }
    else if (prevTitle === "") { open = true; }
    else { open = prevOpen && prevWins >= prevNeed; if (!open) why = `"${prevTitle}" bölümünde ${prevNeed} dava kazanın`; }
    let prevPlayed = true;
    const cases: CareerCase[] = list.map(c => {
      const rec = progress[c.id];
      if (rec?.won) { itibar += rec.best; wonAll++; }
      const ok = open && prevPlayed;
      prevPlayed = !!rec?.played;
      return { c, rec, lock: ok ? "open" : "locked", why: ok ? undefined : open ? "Önceki davayı oynayın" : why };
    });
    if (list.length) {
      if (open) {
        rankName = ch.rank;
        if (wins < need && !next) next = `${ch.title}: bir sonraki bölüm için ${need - wins} dava daha kazanın.`;
      }
      prevOpen = open; prevWins = wins; prevNeed = need; prevTitle = ch.title;
    }
    return { ...ch, cases, open, wins, need, why };
  });
  const total = chapters.reduce((n, ch) => n + ch.cases.length, 0);
  if (!next) next = wonAll === total ? "Bütün davaları kazandınız." : "Kalan davaları kazanarak itibarınızı artırın.";
  return { chapters, rank: rankName, itibar, won: wonAll, total, next };
}

/** Kariyerde açık mı? (Serbest listede kilit göstermek için) */
export function openIds(view: CareerView): Set<string> {
  return new Set(view.chapters.flatMap(ch => ch.cases.filter(x => x.lock === "open").map(x => x.c.id)));
}
