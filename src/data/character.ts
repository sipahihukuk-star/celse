// Oyuncunun karakteri: kendini tarif eder ya da özellikleri seçer; Celse avukat fotoğrafları arasından en yakın olanı bulur.
// Tarif ve seçimler yalnızca bu cihazda saklanır, hiçbir sunucuya gönderilmez.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { AVATARS, Avatar, loadOffice, updateOffice } from "./office";

export type Gender = "e" | "k";
export type Hair = "kisa" | "uzun" | "topuz" | "kivircik" | "kel" | "basortu";
export type HairColor = "siyah" | "kahve" | "kizil" | "sari" | "kir";
export type Beard = "yok" | "sakal" | "biyik";
export interface Traits { g?: Gender; age?: number; hair?: Hair; color?: HairColor; beard?: Beard; glasses?: boolean }

/** Her avukat fotoğrafının görünüşü (yeni fotoğraf eklenince buraya da yazılır). */
export const PORTRAIT_TRAITS: Record<Avatar, Required<Omit<Traits, "color">> & { color?: HairColor }> = {
  "av-erkek-25": { g: "e", age: 25, hair: "kisa", color: "siyah", beard: "yok", glasses: false },
  "av-erkek-27": { g: "e", age: 27, hair: "kivircik", color: "kahve", beard: "yok", glasses: false },
  "av-erkek-32": { g: "e", age: 32, hair: "kisa", color: "siyah", beard: "sakal", glasses: false },
  "av-erkek-38": { g: "e", age: 38, hair: "kisa", color: "siyah", beard: "sakal", glasses: false },
  "av-erkek-46": { g: "e", age: 46, hair: "kisa", color: "kir", beard: "yok", glasses: true },
  "av-erkek-58": { g: "e", age: 58, hair: "kisa", color: "kir", beard: "yok", glasses: true },
  "av-erkek-66": { g: "e", age: 66, hair: "kisa", color: "kir", beard: "biyik", glasses: false },
  "av-kadin-25": { g: "k", age: 25, hair: "uzun", color: "kahve", beard: "yok", glasses: false },
  "av-kadin-28": { g: "k", age: 28, hair: "kisa", color: "siyah", beard: "yok", glasses: false },
  "av-kadin-32": { g: "k", age: 32, hair: "uzun", color: "siyah", beard: "yok", glasses: false },
  "av-kadin-35": { g: "k", age: 35, hair: "topuz", color: "sari", beard: "yok", glasses: false },
  "av-kadin-41": { g: "k", age: 41, hair: "uzun", color: "kizil", beard: "yok", glasses: true },
  "av-kadin-52": { g: "k", age: 52, hair: "kisa", color: "kizil", beard: "yok", glasses: true },
  "av-kadin-61": { g: "k", age: 61, hair: "kisa", color: "kir", beard: "yok", glasses: false },
  "av-kadin-basortulu": { g: "k", age: 30, hair: "basortu", beard: "yok", glasses: false }
};

const has = (s: string, re: RegExp) => re.test(s);

/** Serbest tarifi özelliklere çevirir: "35 yaşında, kısa siyah saçlı, sakallı, gözlüklü bir erkeğim" gibi.
 *  Türkçenin yanında İngilizce, İspanyolca, Fransızca ve Almanca temel sözcükleri de tanır. */
export function parseTraits(text: string): Traits {
  const s = " " + text.toLocaleLowerCase("tr").replace(/[.,;:!?()]/g, " ") + " ";
  const t: Traits = {};
  if (has(s, /(kadın|bayan|hanım|kızım|anneyim| woman | female | lady | mujer | femme | frau | avocate | abogada | anwältin )/)) t.g = "k";
  else if (has(s, /(erkek|erkeğ| bay |adamım|beyefendi|babayım|avukat bey| man | male | guy | hombre | homme | mann | avocat | abogado | anwalt )/)) t.g = "e";
  const n = s.match(/(\d{2})\s*(yaş|years?|yo\b|-year|años|ans|jahre)/) || s.match(/\b([2-7]\d)\b/);
  if (n) { const a = +n[1]; if (a >= 20 && a <= 80) t.age = a; }
  else if (has(s, /genç|yeni mezun|stajyer|yirmili| young |joven|jeune| jung/)) t.age = 26;
  else if (has(s, /otuzlu|thirties|treinta|trentaine|dreißig/)) t.age = 34;
  else if (has(s, /orta yaş|kırklı|middle-aged|middle aged|forties|mediana edad|quarantaine|mittleren alters|vierzig/)) t.age = 45;
  else if (has(s, /ellili|fifties|cincuenta|cinquantaine|fünfzig/)) t.age = 55;
  else if (has(s, /yaşlı|kıdemli|emekli|altmış| old |elderly|senior|mayor|âgé|älter|alt /)) t.age = 63;
  if (has(s, /başörtü|türban|tesettür|eşarp|headscarf|hijab|pañuelo|foulard|voile|kopftuch/)) { t.hair = "basortu"; t.g = "k"; }
  else if (has(s, /( kel |dazlak|saçsız|saçlarım döküldü| bald |calvo|chauve|glatze)/)) t.hair = "kel";
  else if (has(s, /kıvırcık|dalgalı|bukle|curly|wavy|rizado|ondulado|bouclé|frisé|lockig|gewellt/)) t.hair = "kivircik";
  else if (has(s, /topuz|toplu saç|saçlarımı toplarım|topluyorum| bun |moño|chignon|dutt/)) t.hair = "topuz";
  else if (has(s, /uzun( \S+)? saç|saçlarım uzun|at kuyruğu|omuz|long( \S+)? hair|ponytail|pelo largo|cheveux longs|lange( \S+)? haare/)) t.hair = "uzun";
  else if (has(s, /kısa( \S+)? saç|saçlarım kısa|kısa kesim|short( \S+)? hair|pelo corto|cheveux courts|kurze( \S+)? haare/)) t.hair = "kisa";
  if (has(s, /kızıl|bakır|kestane|red hair|redhead|ginger|auburn|pelirroj|roux|rousse|rote haare|rothaarig/)) t.color = "kizil";
  else if (has(s, /sarı|sarışın|açık renk saç|blond|rubi/)) t.color = "sari";
  else if (has(s, /( kır |kırlaşmış|gri saç|beyaz saç|ak saç|ağarmış|grey|gray|white hair|canoso|pelo blanco|gris|cheveux blancs|graue|weiße haare)/)) t.color = "kir";
  else if (has(s, /kahverengi|kumral|kahve|brown|castaño|châtain|braun/)) t.color = "kahve";
  else if (has(s, /siyah|koyu saç|simsiyah|esmer|black|dark hair|pelo negro|moreno|noirs|bruns|schwarz|dunkle haare/)) t.color = "siyah";
  if (has(s, /sakalsız|sakalım yok|tıraşlı|tıraş|clean-shaven|clean shaven|no beard|sin barba|imberbe|rasé|sans barbe|ohne bart|glatt rasiert/)) t.beard = "yok";
  else if (has(s, /bıyık|moustache|mustache|bigote|schnurrbart/)) t.beard = "biyik";
  else if (has(s, /sakal|beard|barba|barbe|bart/)) t.beard = "sakal";
  if (t.beard && t.beard !== "yok" && !t.g) t.g = "e";
  if (has(s, /gözlüksüz|gözlük kullanmıyorum|gözlüğüm yok|no glasses|without glasses|sin gafas|sans lunettes|ohne brille/)) t.glasses = false;
  else if (has(s, /gözlük|glasses|spectacles|gafas|lentes|lunettes|brille/)) t.glasses = true;
  return t;
}

const NEAR_HAIR: Partial<Record<Hair, Hair[]>> = { uzun: ["topuz", "kivircik"], topuz: ["uzun"], kivircik: ["uzun", "kisa"], kel: ["kisa"], kisa: ["kivircik"] };
const NEAR_COLOR: Partial<Record<HairColor, HairColor[]>> = { siyah: ["kahve"], kahve: ["siyah", "kizil"], kizil: ["kahve"], sari: ["kahve"], kir: [] };

/** Bir fotoğrafın tarife uygunluğu (0-100). */
export function matchScore(t: Traits, k: Avatar): number {
  const p = PORTRAIT_TRAITS[k];
  let got = 0, max = 0;
  const add = (w: number, v: number) => { max += w; got += w * v; };
  if (t.g) add(40, t.g === p.g ? 1 : 0);
  if (t.age) add(20, Math.max(0, 1 - Math.abs(t.age - p.age) / 25));
  if (t.hair) add(15, t.hair === p.hair ? 1 : NEAR_HAIR[t.hair]?.includes(p.hair) ? 0.5 : 0);
  else if (p.hair === "basortu") add(10, 0.3);
  if (t.color && !p.color) add(10, 0.2);
  else if (t.color && p.color) add(10, t.color === p.color ? 1 : NEAR_COLOR[t.color]?.includes(p.color) ? 0.5 : 0);
  if (t.beard && (t.g ?? p.g) === "e") add(10, t.beard === p.beard ? 1 : t.beard !== "yok" && p.beard !== "yok" ? 0.5 : 0);
  if (t.glasses !== undefined) add(10, t.glasses === p.glasses ? 1 : 0);
  return max ? Math.round((got / max) * 100) : 0;
}

/** Fotoğrafları tarife en yakından uzağa sıralar; eşitlikte AVATARS sırası korunur. */
export function rankAvatars(t: Traits): { k: Avatar; score: number }[] {
  return AVATARS.map((k, i) => ({ k, score: matchScore(t, k), i })).sort((a, b) => b.score - a.score || a.i - b.i).map(({ k, score }) => ({ k, score }));
}

/* ---------- Saklama ---------- */
export interface Character { avatar: Avatar; traits: Traits; text: string }
const KEY = "celse-karakter-v1";
let cache: Character | null | undefined;
const listeners = new Set<() => void>();

export async function loadCharacter(): Promise<Character | null> {
  if (cache !== undefined) return cache;
  try {
    const v = JSON.parse((await AsyncStorage.getItem(KEY)) || "null");
    cache = v && (AVATARS as readonly string[]).includes(v.avatar) ? v : null;
  } catch { cache = null; }
  return cache ?? null;
}

/** Karakteri kaydeder; büro açıksa büronun karakteri de değişir (duruşmalarda bu yüz görünür). */
export async function saveCharacter(c: Character) {
  cache = c;
  try { await AsyncStorage.setItem(KEY, JSON.stringify(c)); } catch { /* depolama yoksa yalnız bu oturumda */ }
  const o = await loadOffice();
  if (o && o.avatar !== c.avatar) await updateOffice({ avatar: c.avatar });
  listeners.forEach(f => f());
}

export async function clearCharacter() {
  cache = null;
  try { await AsyncStorage.removeItem(KEY); } catch { /* yok say */ }
  listeners.forEach(f => f());
}

export function useCharacter(): Character | null {
  const [c, setC] = useState<Character | null>(cache ?? null);
  useEffect(() => {
    const load = () => { loadCharacter().then(setC); };
    load(); listeners.add(load);
    return () => { listeners.delete(load); };
  }, []);
  return c;
}
