// Föylerim ekranının başındaki büro kartı.
// - Kullanıcı bir büroya üyeyse: hangi büroda ve hangi ünvanla çalıştığı tek satırda görünür.
// - Üye değilse (önceden kayıt olmuş çalışan dava takibine girince boş bir föy listesiyle karşılaşıyordu):
//   davet kodunu doğrudan burada girer. Eşitleme şifresi gerekiyorsa aynı kartta belirlenir ya da girilir;
//   tek tuşla şifre kurulur, büroya katılınır ve büronun föyleri gelir. Büroda çalışmayan kişi kartı kapatabilir.
import React, { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { BuroDurum, buroDurumu, davetKabul } from "../data/buro";
import { ayarOku, ayarYaz } from "../data/foy";
import { bulutAc, BulutDurum, bulutDurumu, bulutKur, esitle } from "../data/foyBulut";
import { t } from "../i18n";
import { s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";

export function BuroKatilKart({ onBuro }: { onBuro: () => void }) {
  const [d, setD] = useState<BuroDurum | null>(null);
  const [bulut, setBulut] = useState<BulutDurum | null>(null);
  const [gizli, setGizli] = useState(true);
  const [kod, setKod] = useState("");
  const [ad, setAd] = useState("");
  const [sifre, setSifre] = useState("");
  const [sifre2, setSifre2] = useState("");
  const [busy, setBusy] = useState(false);
  const [mesaj, setMesaj] = useState<{ t: string; ok?: boolean } | null>(null);

  const yenile = async () => {
    try { const [a, b] = await Promise.all([buroDurumu(), bulutDurumu()]); setD(a); setBulut(b); } catch { setD(null); }
  };
  useEffect(() => { yenile(); ayarOku<boolean>("buroKartGizli").then(x => setGizli(!!x)).catch(() => setGizli(false)); }, []);

  if (!d || d.tur === "giris_yok" || d.tur === "kurulum_yok") return null;
  if (d.tur === "uye") {
    return (
      <Pressable onPress={onBuro} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }}>
        <Text style={[s.hint, { color: C.textSoft }]}>👥 {d.b.ad} · {t(d.b.ben.unvan)}{d.anahtar ? "" : " · " + t("büro anahtarı bu cihazda açık değil")}</Text>
      </Pressable>
    );
  }
  if (gizli) {
    return (
      <Pressable onPress={() => { setGizli(false); ayarYaz("buroKartGizli", false).catch(() => {}); }}>
        <Text style={s.link}>{t("Bir büroda çalışıyorsanız davet kodunu girin ›")}</Text>
      </Pressable>
    );
  }

  const sifreYok = bulut?.tur === "sifre_yok", cihazKapali = bulut?.tur === "cihaz_kapali";
  const katil = async () => {
    setMesaj(null);
    if (sifreYok) {
      if (sifre.length < 8) { setMesaj({ t: t("Eşitleme şifresi en az 8 karakter olmalı.") }); return; }
      if (sifre !== sifre2) { setMesaj({ t: t("Şifreler aynı değil.") }); return; }
    }
    setBusy(true);
    try {
      if (sifreYok) await bulutKur(sifre);
      else if (cihazKapali && !(await bulutAc(sifre))) { setMesaj({ t: t("Eşitleme şifresi yanlış.") }); return; }
      await davetKabul(kod, ad);
      setKod(""); setSifre(""); setSifre2("");
      await esitle().catch(() => ({ gelen: 0, giden: 0 }));
      setMesaj({ t: t("Büroya katıldınız; büronun föyleri geliyor."), ok: true });
      await yenile();
    } catch (e) { setMesaj({ t: t(String((e as Error).message || e)) }); }
    finally { setBusy(false); }
  };

  return (
    <View style={[s.card, { borderColor: C.brass }]}>
      <Text style={[s.body, { color: C.text, fontWeight: "700" }]}>{t("Bir büroda mı çalışıyorsunuz?")}</Text>
      <Text style={s.hint}>{t("Büronuzun avukatından aldığınız davet kodunu girin; büronun föyleri bu hesaba gelir. Daha önce kayıt olduysanız yeni hesap açmanız gerekmez.")}</Text>
      <TextInput value={kod} onChangeText={setKod} placeholder={t("Davet kodu: ör. K7PD-3QXM-W2HA")} placeholderTextColor={C.muted} autoCapitalize="characters" style={s.inputTek} />
      <TextInput value={ad} onChangeText={setAd} placeholder={t("Adınız soyadınız")} placeholderTextColor={C.muted} style={s.inputTek} />
      {sifreYok && (
        <>
          <Text style={s.hint}>{t("Büro föyleri uçtan uca şifrelidir. Kendinize bir eşitleme şifresi belirleyin (en az 8 karakter); öbür cihazlarınızda da bu şifreyi kullanacaksınız.")}</Text>
          <TextInput value={sifre} onChangeText={setSifre} secureTextEntry placeholder={t("Eşitleme şifresi")} placeholderTextColor={C.muted} style={s.inputTek} />
          <TextInput value={sifre2} onChangeText={setSifre2} secureTextEntry placeholder={t("Eşitleme şifresi (tekrar)")} placeholderTextColor={C.muted} style={s.inputTek} />
        </>
      )}
      {cihazKapali && (
        <>
          <Text style={s.hint}>{t("Bu hesabın eşitleme şifresini girin (daha önce başka bir cihazda belirlediğiniz şifre).")}</Text>
          <TextInput value={sifre} onChangeText={setSifre} secureTextEntry placeholder={t("Eşitleme şifresi")} placeholderTextColor={C.muted} style={s.inputTek} />
        </>
      )}
      <View style={[s.row, { alignItems: "center" }]}>
        <Btn label={busy ? t("Katılınıyor…") : t("Büroya katıl")} disabled={busy || !kod.trim() || ((sifreYok || cihazKapali) && !sifre)} onPress={katil} />
        <Btn kind="ghost" label={t("Büro kuracağım")} onPress={onBuro} />
        <Btn kind="ghost" label={t("Büroda çalışmıyorum")} onPress={() => { setGizli(true); ayarYaz("buroKartGizli", true).catch(() => {}); }} />
      </View>
      {mesaj && <Text style={[s.hint, { color: mesaj.ok ? C.good : C.bad }]}>{mesaj.t}</Text>}
    </View>
  );
}
