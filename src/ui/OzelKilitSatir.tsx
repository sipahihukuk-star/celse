// Şahsi dosyalar kilidi, gerektiği yerde (föy sayfası, evrak kartı) açılır ya da ilk kez kurulur.
import React, { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { ozelAc, ozelKilitDurumu, ozelKilitKur } from "../data/foy";
import { t } from "../i18n";
import { s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";

export function OzelKilitSatir({ onAcildi, onVazgec, dugme }: { onAcildi: () => void | Promise<void>; onVazgec?: () => void; dugme?: string }) {
  const [durum, setDurum] = useState<"" | "yok" | "kilitli" | "acik">("");
  const [sifre, setSifre] = useState(""), [sifre2, setSifre2] = useState("");
  const [hata, setHata] = useState(""), [bekle, setBekle] = useState(false);
  useEffect(() => { ozelKilitDurumu().then(d => { setDurum(d); if (d === "acik") onAcildi(); }).catch(() => setDurum("yok")); }, []);
  if (!durum || durum === "acik") return null;
  const tamam = async () => {
    setHata(""); setBekle(true);
    try {
      if (durum === "yok") {
        if (sifre.length < 6) { setHata(t("Şifre en az 6 karakter olmalı.")); return; }
        if (sifre !== sifre2) { setHata(t("Şifreler aynı değil.")); return; }
        await ozelKilitKur(sifre);
      } else if (!(await ozelAc(sifre))) { setHata(t("Şifre yanlış.")); return; }
      setSifre(""); setSifre2(""); setDurum("acik");
      await onAcildi();
    } catch (e) { setHata(t(String((e as Error).message || e))); }
    finally { setBekle(false); }
  };
  return (
    <View style={[s.warn, { gap: 6 }]}>
      <Text style={s.body}>{durum === "yok"
        ? t("Şahsi dosyalar için henüz şifre kurulmamış. Bir şifre belirleyin (en az 6 karakter): şahsi dosyalar bu şifreden türetilen anahtarla şifrelenir; şifre hiçbir yere kaydedilmez, unutursanız açılamaz.")
        : t("Şahsi dosyalar kilitli. Şifrenizi girin.")}</Text>
      <TextInput value={sifre} onChangeText={setSifre} secureTextEntry placeholder={t("Şifre")} placeholderTextColor={C.muted} style={s.inputTek} autoFocus onSubmitEditing={durum === "kilitli" ? tamam : undefined} />
      {durum === "yok" && <TextInput value={sifre2} onChangeText={setSifre2} secureTextEntry placeholder={t("Şifre (tekrar)")} placeholderTextColor={C.muted} style={s.inputTek} onSubmitEditing={tamam} />}
      {!!hata && <Text style={s.err}>{hata}</Text>}
      <View style={s.addRow}>
        <Btn label={bekle ? t("Bekleyin…") : dugme || (durum === "yok" ? t("Şifreyi kur") : t("Kilidi aç"))} disabled={bekle || !sifre} onPress={tamam} />
        {!!onVazgec && <Btn kind="ghost" label={t("Vazgeç")} onPress={onVazgec} />}
      </View>
    </View>
  );
}
