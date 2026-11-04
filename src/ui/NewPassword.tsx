// Şifre yenileme bağlantısıyla gelen oyuncuya yeni şifre sorulur.
import React, { useState } from "react";
import { Modal, StyleSheet, Text, TextInput, View } from "react-native";
import { endRecovery, isRecovering, setNewPassword, useAccount } from "../data/account";
import { KeyboardBar, kbBar } from "./KeyboardBar";
import { Btn } from "./kit";
import { C, F } from "./theme";
import { t } from "../i18n";

export function NewPassword() {
  const { account } = useAccount();
  const [p1, setP1] = useState(""), [p2, setP2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  if (!isRecovering()) return null;
  const save = async () => {
    if (p1 !== p2) return setMsg(t("Şifreler aynı değil."));
    setBusy(true); setMsg("");
    const r = await setNewPassword(p1);
    setBusy(false);
    if (r.error) setMsg(t(r.error));
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={endRecovery}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title}>{t("Yeni şifrenizi belirleyin")}</Text>
          {!!account && <Text style={s.sub}>{account.eposta}</Text>}
          <TextInput {...kbBar} style={s.input} value={p1} onChangeText={setP1} secureTextEntry placeholder={t("Yeni şifre (en az 6 karakter)")} placeholderTextColor={C.inkSoft} autoCapitalize="none" />
          <TextInput {...kbBar} style={s.input} value={p2} onChangeText={setP2} secureTextEntry placeholder={t("Yeni şifre (tekrar)")} placeholderTextColor={C.inkSoft} autoCapitalize="none" onSubmitEditing={save} />
          {!!msg && <Text style={s.err}>{msg}</Text>}
          <View style={s.row}>
            <Btn kind="ghostInk" label={t("Vazgeç")} onPress={endRecovery} disabled={busy} />
            <Btn label={busy ? t("Kaydediliyor…") : t("Şifreyi kaydet")} onPress={save} disabled={busy || !p1} />
          </View>
        </View>
      </View>
      <KeyboardBar inModal />
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(5,8,10,0.72)", alignItems: "center", justifyContent: "center", padding: 16 },
  card: { backgroundColor: C.paper, borderRadius: 8, padding: 22, width: "100%", maxWidth: 420, gap: 10 },
  title: { fontFamily: F.display, fontSize: 22, color: C.ink },
  sub: { fontFamily: F.body, fontSize: 14, color: C.inkSoft },
  input: { borderWidth: 1, borderColor: C.rule, borderRadius: 6, backgroundColor: C.paperHi, color: C.ink, fontFamily: F.body, fontSize: 16, paddingHorizontal: 12, paddingVertical: 10 },
  err: { fontFamily: F.body, fontSize: 14, color: C.bad },
  row: { flexDirection: "row", justifyContent: "flex-end", gap: 8, flexWrap: "wrap", marginTop: 4 }
});
