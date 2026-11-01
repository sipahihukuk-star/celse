// İnternet üzerinden karşılıklı oyun. Eşleşme Supabase'deki "eslesmeler" tablosunda tutulur (supabase/surum3.sql).
// İki cihaz aynı oyun motorunu çalıştırır; yalnızca hamleler (seçilen seçenek, serbest cevap puanı) sunucuya yazılır ve
// karşı cihaz bunları sırayla uygular. Son sözler ve yapay zekâ hakemin kararı da aynı satırda saklanır.
import { useEffect, useRef, useState } from "react";
import { Side } from "../engine/types";
import { currentAccount, supabase } from "./account";

export interface Move { n: number; step: number; choice: number; letter: string; side: Side; answer?: string; score?: number; feedback?: string }

export interface Match {
  id: string; kod: string; dava_id: string; dil: string;
  durum: "bekliyor" | "oynaniyor" | "bitti" | "iptal"; acik: boolean;
  kurucu: string; p1: string | null; p2: string | null; p1_ad: string | null; p2_ad: string | null;
  hamleler: Move[]; son1: string | null; son2: string | null; karar: any; olusturma: string;
}

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = () => Array.from({ length: 6 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join("");

function sb() {
  const s = supabase();
  if (!s) throw new Error("Sunucuya ulaşılamıyor.");
  return s;
}
async function uid() {
  const { data } = await sb().auth.getUser();
  if (!data.user) throw new Error("İnternet üzerinden oynamak için giriş yapın.");
  return data.user.id;
}
const myName = () => currentAccount()?.adSoyad || "Avukat";

export async function createMatch(davaId: string, side: Side, acik: boolean, dil = "tr"): Promise<Match> {
  const me = await uid();
  for (let i = 0; i < 5; i++) {
    const row = { kod: code(), dava_id: davaId, dil, acik, kurucu: me, [side]: me, [`${side}_ad`]: myName() };
    const { data, error } = await sb().from("eslesmeler").insert(row).select().single();
    if (!error) return data as Match;
    if (!/duplicate|unique/i.test(error.message)) throw new Error(error.message);
  }
  throw new Error("Davet kodu oluşturulamadı, tekrar deneyin.");
}

export async function joinMatch(kod: string): Promise<Match> {
  await uid();
  const { data, error } = await sb().rpc("eslesmeye_katil", { k: kod, ad: myName() });
  if (error) throw new Error(error.message);
  return data as Match;
}

export async function getMatch(id: string): Promise<Match | null> {
  const { data } = await sb().from("eslesmeler").select("*").eq("id", id).maybeSingle();
  return (data as Match) || null;
}

/** Herkese açık, rakip bekleyen davetler (kendi davetleriniz hariç). */
export async function openMatches(): Promise<Match[]> {
  const me = await uid();
  const { data, error } = await sb().from("eslesmeler").select("*").eq("durum", "bekliyor").eq("acik", true)
    .neq("kurucu", me).order("olusturma", { ascending: false }).limit(40);
  if (error) throw new Error(error.message);
  // Bir günden eski bekleyen davetler gösterilmez.
  return ((data || []) as Match[]).filter(m => Date.now() - new Date(m.olusturma).getTime() < 86400000);
}

export async function sendMove(id: string, m: Move) {
  const { error } = await sb().rpc("hamle_ekle", { m: id, n: m.n, h: m });
  if (error) throw new Error(error.message);
}
export async function sendClosing(id: string, text: string) {
  const { error } = await sb().rpc("son_soz_yaz", { m: id, metin: text });
  if (error) throw new Error(error.message);
}
export async function sendVerdict(id: string, karar: unknown) {
  const { error } = await sb().rpc("karar_yaz", { m: id, k: karar });
  if (error) throw new Error(error.message);
}
export async function leaveMatch(id: string) {
  try { await sb().rpc("eslesme_birak", { m: id }); } catch { /* yok say */ }
}

export const sideOf = (m: Match, me: string): Side | null => (m.p1 === me ? "p1" : m.p2 === me ? "p2" : null);
export async function myId() { return uid(); }

/** Eşleşmeyi izler (2 saniyede bir yenilenir). Sayfa kapalıyken istek atılmaz. */
export function useMatch(id: string | null, ms = 2000) {
  const [m, setM] = useState<Match | null>(null);
  const [err, setErr] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    if (!id) return;
    let t: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try { const x = await getMatch(id); if (alive.current) { setM(x); setErr(""); } }
      catch (e) { if (alive.current) setErr((e as Error).message); }
      if (alive.current) t = setTimeout(tick, ms);
    };
    tick();
    return () => { alive.current = false; clearTimeout(t); };
  }, [id, ms]);
  return { match: m, error: err, refresh: async () => { if (id) setM(await getMatch(id)); } };
}
