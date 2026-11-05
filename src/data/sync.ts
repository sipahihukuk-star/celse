// Giriş yapmış (sunucu) hesabın büro, dosya akışı ve karakter yüzünü iPhone, Android ve web arasında eşitler.
// Kurallar ve çatışma çözümü: syncCore.ts. Sunucu tablosu: supabase/surum12.sql (oyuncu_durumu).
// Misafir ve cihaz profilleri eşitlenmez. Hata ve bağlantı yokluğu sessizdir; arayüz hiç beklemez.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { currentAccount, onAccountChange, onBeforeSignOut, supabase } from "./account";
import { readAvatarFor, writeAvatarFor } from "./character";
import { Flow, readFlowFor, writeFlowFor } from "./flow";
import { Office, readOfficeFor, writeOfficeFor } from "./office";
import { createSync, Remote, Snapshot } from "./syncCore";
import { onLocalChange } from "./syncBus";

const TABLE = "oyuncu_durumu";

function remote(): Remote | null {
  const sb = supabase();
  if (!sb) return null;
  return {
    async get(uid) {
      const { data, error } = await sb.from(TABLE).select("veri, surum, guncelleme").eq("kullanici_id", uid).maybeSingle();
      if (error) throw error;
      return data;
    },
    async insert(uid, veri) {
      const { data, error } = await sb.from(TABLE).insert({ kullanici_id: uid, veri }).select("surum, guncelleme").maybeSingle();
      if (error) { if (error.code === "23505") return null; throw error; }
      return data;
    },
    async update(uid, veri, surum) {
      const { data, error } = await sb.from(TABLE).update({ veri }).eq("kullanici_id", uid).eq("surum", surum).select("surum, guncelleme").maybeSingle();
      if (error) throw error;
      return data;
    }
  };
}

async function readLocal(uid: string): Promise<Snapshot> {
  const [buro, dosya, karakter] = await Promise.all([readOfficeFor(uid), readFlowFor(uid), readAvatarFor(uid)]);
  return { buro, dosya, karakter };
}
async function writeLocal(uid: string, s: Snapshot) {
  await writeOfficeFor(uid, s.buro as Office | null);
  await writeFlowFor(uid, s.dosya as Flow | null);
  await writeAvatarFor(uid, s.karakter);
}

let started = false;
/** Bir kez başlatılır (App.tsx). Hesap değişince çeker, yerel değişiklikten birkaç saniye sonra gönderir. */
export function startSync() {
  if (started) return;
  started = true;
  const core = createSync({ storage: AsyncStorage, account: currentAccount, remote, readLocal, writeLocal, delay: 3000 });
  onAccountChange(() => core.onAccount());
  onLocalChange(owner => core.onLocalChange(owner));
  onBeforeSignOut(async () => { await core.flush(); });
  try {
    // Arka plana geçerken (web'de sekme gizlenirken) bekleyen değişiklik hemen gönderilir; öne gelince yenisi alınır.
    AppState.addEventListener("change", s => { if (s === "active") core.onForeground(); else core.flush(); });
  } catch { /* yok say */ }
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try { window.addEventListener("pagehide", () => { core.flush(); }); } catch { /* yok say */ }
  }
  core.onAccount();
}

export function useCloudSync() {
  useEffect(() => { startSync(); }, []);
}
