// Yapay zekâ denetim raporları: sunucuda (denetimler tablosu, yalnız yöneticiler) ya da cihazda saklanır.
// Böylece denetimi bilgisayarda başlatıp sonuçlarını telefondan onaylamak mümkündür.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../data/account";
import { AuditReport } from "./ai";
import { serverAdmin } from "./store";

const KEY = "celse-denetimler-v1";

async function readLocal(): Promise<Record<string, AuditReport>> {
  try { return JSON.parse((await AsyncStorage.getItem(KEY)) || "{}"); } catch { return {}; }
}

export async function listReports(): Promise<Record<string, AuditReport>> {
  const sb = supabase();
  if (sb && (await serverAdmin())) {
    const { data, error } = await sb.from("denetimler").select("dava_id, rapor");
    if (!error && data) return Object.fromEntries(data.map((r: any) => [r.dava_id, r.rapor as AuditReport]));
  }
  return readLocal();
}

export async function saveReport(r: AuditReport) {
  const sb = supabase();
  if (sb && (await serverAdmin())) {
    const { error } = await sb.from("denetimler").upsert({ dava_id: r.davaId, rapor: r, tarih: new Date().toISOString() });
    if (!error) return;
  }
  const all = await readLocal();
  all[r.davaId] = r;
  try { await AsyncStorage.setItem(KEY, JSON.stringify(all)); } catch { /* yok say */ }
}
