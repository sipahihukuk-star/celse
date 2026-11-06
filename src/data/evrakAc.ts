// Evrak oturumundan gelen canlandırma ve oyun dosyasındaki kodları cihazda gerçek değerlere çevirir (React Native'e bağımlı değil; testte de çalışır).
import { unmask } from "../engine/mask";
import type { Senaryo } from "./danisma";
import type { CaseFile } from "../engine/types";
import { oynanabilir } from "./danismaKayit";

/** Kimlik, bayrak ve görünüş alanlarına dokunmadan bütün metinleri gerçek değerlere çevirir. */
const DOKUNMA = new Set(["look", "color", "id", "who", "if", "set", "correct", "side", "scene", "kind", "np", "winner", "courtCast", "attire", "tur", "kim", "taraf"]);
function derinAc<T>(v: T, map: Record<string, string>, key = ""): T {
  if (DOKUNMA.has(key)) return v;
  if (typeof v === "string") return unmask(v, map) as unknown as T;
  if (Array.isArray(v)) return v.map(x => derinAc(x, map)) as unknown as T;
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) o[k] = derinAc(x, map, k);
    return o as T;
  }
  return v;
}
export const senaryoAc = (s: Senaryo, map: Record<string, string>): Senaryo => ({ ...derinAc(s, map), evrak: true });
export function dosyaAc(raw: unknown, map: Record<string, string>): CaseFile | null {
  const c = oynanabilir(derinAc(raw, map));
  return c ? { ...c, career: { off: true } } : null;
}

