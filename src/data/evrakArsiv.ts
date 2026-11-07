// "Önceki hazırlıklarım": evrakla duruşma provasının sonuçları (hazırlık notları, canlandırma, oynanabilir dosya) yalnız BU CİHAZDA
// saklanır; sunucuya gitmez. Evrakın kendisi saklanmaz, yalnız sonuçlar ve kodların karşılıkları (sonuçta gerçek adlar görünsün diye).
// En çok 10 kayıt, 30 gün; avukat her kaydı ya da hepsini silebilir. Ekrandan yanlışlıkla çıkan avukat sonucu kaybetmesin diye eklendi.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CaseFile } from "../engine/types";
import type { Senaryo } from "./danisma";
import type { Prova } from "./evrak";

export interface ArsivKayit {
  id: string; tarih: string; baslik: string; taraf: "davaci" | "davali"; asama: string;
  map: Record<string, string>; prova?: { kodlu: Prova; acik: Prova }; senaryo?: Senaryo; dosya?: CaseFile;
}

const KEY = "celse-evrak-arsiv";
const AZAMI = 10;
const OMUR = 30 * 24 * 3600 * 1000;

async function oku(): Promise<ArsivKayit[]> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    const xs = v ? (JSON.parse(v) as ArsivKayit[]) : [];
    const sinir = Date.now() - OMUR;
    return Array.isArray(xs) ? xs.filter(x => x && x.id && new Date(x.tarih).getTime() > sinir) : [];
  } catch { return []; }
}

async function yaz(xs: ArsivKayit[]) {
  // Tarayıcı deposu dolarsa en eski kayıtlar düşülerek yeniden denenir.
  for (let n = xs.length; n >= 0; n--) {
    try { await AsyncStorage.setItem(KEY, JSON.stringify(xs.slice(0, n))); return; } catch { /* sığmadı: bir eksiğiyle dene */ }
  }
}

export const arsivListesi = () => oku();

/** Aynı kimlikli kaydı günceller ya da en başa ekler. */
export async function arsivKaydet(k: ArsivKayit) {
  const xs = (await oku()).filter(x => x.id !== k.id);
  await yaz([k, ...xs].slice(0, AZAMI));
}

export async function arsivSil(id: string) { await yaz((await oku()).filter(x => x.id !== id)); }
export async function arsivTemizle() { try { await AsyncStorage.removeItem(KEY); } catch { /* yok say */ } }
