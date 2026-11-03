// Giriş ekranının üstündeki tek giriş kartı: e-posta, şifre, "Giriş yap", "Üye ol" ve "Şifremi unuttum".
// Sunucu ayarlı değilken (cihaz profilleri) e-posta/şifre yerine "Oyuncu seç" ve "Yeni oyuncu" düğmeleri görünür.
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { resetPassword, signIn } from "../data/account";
import { t } from "../i18n";
import { kbBar } from "./KeyboardBar";
import { Btn } from "./kit";
import { C, F } from "./theme";

export function LoginCard({ server, onSignUp, onPickLocal, onDone }: { server: boolean; onSignUp: () => void; onPickLocal: () => void; onDone?: () => void }) {
  const [e, setE] = useState(""), [p, setP] = useState("");
  const [msg, setMsg] = useState<{ t: string; ok?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!server) {
    return (
      <View style={s.card}>
        <Text style={s.title}>{t("Oyuncunuzu seçin")}</Text>
        <Text style={s.sub}>{t("Her oyuncunun kariyeri ayrı tutulur. Sunucu bağlandığında gerçek üyelik açılacak.")}</Text>
        <View style={s.row}>
          <Btn label={t("Oyuncu seç")} onPress={onPickLocal} />
          <Btn kind="ghost" label={t("Yeni oyuncu")} onPress={onSignUp} />
        </View>
      </View>
    );
  }
  const submit = async () => {
    if (!e.trim() || !p) return setMsg({ t: t("E-posta ve şifrenizi yazın.") });
    setBusy(true); setMsg(null);
    const r = await signIn(e, p);
    setBusy(false);
    if (r.error) setMsg({ t: t(r.error) }); else { setP(""); onDone?.(); }
  };
  return (
    <View style={s.card} accessibilityLabel={t("Giriş yap")}>
      <Text style={s.title}>{t("Giriş yap")}</Text>
      <View style={{ gap: 4 }}>
        <Text style={s.label}>{t("E-posta")}</Text>
        <TextInput {...kbBar} value={e} onChangeText={setE} placeholder={t("ornek@eposta.com")} placeholderTextColor={C.muted} style={s.input}
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" accessibilityLabel={t("E-posta")} />
      </View>
      <View style={{ gap: 4 }}>
        <Text style={s.label}>{t("Şifre")}</Text>
        <TextInput {...kbBar} value={p} onChangeText={setP} secureTextEntry placeholderTextColor={C.muted} style={s.input} onSubmitEditing={submit}
          autoCapitalize="none" autoCorrect={false} autoComplete="password" textContentType="password" accessibilityLabel={t("Şifre")} />
      </View>
      {!!msg && <Text style={[s.msg, msg.ok && { color: C.good }]}>{msg.t}</Text>}
      <View style={s.row}>
        <Btn label={busy ? t("Giriş yapılıyor…") : t("Giriş yap")} disabled={busy} onPress={submit} style={{ flexGrow: 1 }} />
        <Btn kind="ghost" label={t("Üye ol")} onPress={onSignUp} style={{ flexGrow: 1 }} />
      </View>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={async () => {
        if (!e.trim()) return setMsg({ t: t("Önce e-posta adresinizi yazın.") });
        const r = await resetPassword(e);
        setMsg(r.error ? { t: t(r.error) } : { t: t("Şifre yenileme bağlantısı e-posta adresinize gönderildi."), ok: true });
      }}>
        <Text style={s.link}>{t("Şifremi unuttum")}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: { gap: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.brassDim, borderRadius: 12, padding: 16, maxWidth: 480, width: "100%" },
  title: { fontFamily: F.displayMed, fontSize: 22, color: C.text },
  sub: { fontFamily: F.body, fontSize: 14, color: C.textSoft },
  label: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: C.muted, textTransform: "uppercase" },
  input: { fontFamily: F.body, fontSize: 17, color: C.text, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  msg: { fontFamily: F.bodyMed, fontSize: 14, color: C.bad },
  link: { fontFamily: F.body, fontSize: 14, color: C.brass, textDecorationLine: "underline", alignSelf: "flex-start" }
});
