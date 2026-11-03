// İlk kariyer galibiyetinden sonra bir kez sorulur: liderlik panosunda görünmek ister misiniz?
// Panoda görünmek açık rızaya bağlıdır (KVKK); oyuncu "Şimdi değil" derse bir daha sorulmaz, panoya 🏆 ekranından katılabilir.
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { currentAccount, supabase } from "../data/account";
import { displayName, joinBoard, onBoard } from "../data/leaderboard";
import { Btn } from "./kit";
import { C, F } from "./theme";
import { t } from "../i18n";

const flagKey = (id: string) => `celse-pano-davet:${id}`;

/** Sunucu hesabı varsa, panoda değilse ve daha önce sorulmadıysa daveti göstermek gerekir. */
export async function shouldInvite(): Promise<boolean> {
  const acc = currentAccount();
  if (acc?.mode !== "server") return false;
  try { if (await AsyncStorage.getItem(flagKey(acc.id))) return false; } catch { return false; }
  return !(await onBoard().catch(() => true));
}

/** Üye olurken panoya onay verdiyse (hesap bilgisinde pano_onay) ilk girişte panoya eklenir; davet bir daha sorulmaz. */
export async function joinIfConsented(info: { sehir?: string; avatar?: string; unvan?: string }) {
  const acc = currentAccount(), sb = supabase();
  if (acc?.mode !== "server" || !sb) return;
  try {
    if (await AsyncStorage.getItem(flagKey(acc.id))) return;
    const { data } = await sb.auth.getUser();
    if (!data.user?.user_metadata?.pano_onay) return;
    if (!(await onBoard())) { const r = await joinBoard(info); if (r.error) return; }
    await AsyncStorage.setItem(flagKey(acc.id), "katildi");
  } catch { /* sonra yeniden denenir */ }
}

export function BoardInvite({ visible, info, onClose }: { visible: boolean; info: { sehir?: string; avatar?: string; unvan?: string }; onClose: (joined: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const acc = currentAccount();
  const done = async (join: boolean) => {
    if (acc) { try { await AsyncStorage.setItem(flagKey(acc.id), join ? "katildi" : "hayir"); } catch { /* yok say */ } }
    if (join) {
      setBusy(true); setErr("");
      const r = await joinBoard(info);
      setBusy(false);
      if (r.error) { setErr(t(r.error)); return; }
    }
    onClose(join);
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => done(false)}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.icon}>🏆</Text>
          <Text style={s.title}>{t("Tebrikler! Liderlik panosunda görünmek ister misiniz?")}</Text>
          <Text style={s.body}>{t("Panoya katıldığınızda adınız \"{ad}\" olarak; unvanınız, şehriniz ve puanınızla birlikte diğer oyunculara görünür. Telefonunuz ve e-postanız görünmez. İstediğiniz an panodan çıkabilirsiniz.", { ad: acc ? displayName(acc.adSoyad) : "" })}</Text>
          {!!err && <Text style={s.err}>{err}</Text>}
          <View style={s.row}>
            <Btn kind="ghostInk" label={t("Şimdi değil")} onPress={() => done(false)} disabled={busy} />
            <Btn label={busy ? t("Katılınıyor…") : t("Panoya katıl")} onPress={() => done(true)} disabled={busy} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(5,8,10,0.72)", alignItems: "center", justifyContent: "center", padding: 16 },
  card: { backgroundColor: C.paper, borderRadius: 8, padding: 22, width: "100%", maxWidth: 460, gap: 10 },
  icon: { fontSize: 36, textAlign: "center" },
  title: { fontFamily: F.display, fontSize: 21, color: C.ink, textAlign: "center" },
  body: { fontFamily: F.body, fontSize: 15, color: C.inkSoft },
  err: { fontFamily: F.body, fontSize: 14, color: C.bad },
  row: { flexDirection: "row", justifyContent: "flex-end", gap: 8, flexWrap: "wrap", marginTop: 4 }
});
