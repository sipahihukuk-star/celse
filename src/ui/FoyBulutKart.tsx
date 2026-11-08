// Föylerim ekranındaki "Bulut eşitlemesi" kartı: eşitleme şifresini kurma, başka cihazda açma, elle ve kendiliğinden eşitleme.
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { foyDinle } from "../data/foy";
import { bulutAc, bulutCihazdaKapat, BulutDurum, bulutDurumu, bulutKur, esitle } from "../data/foyBulut";
import { t } from "../i18n";
import { s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";
import { Katlanir } from "./Katlanir";

const saatYaz = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function FoyBulutKart() {
  const [durum, setDurum] = useState<BulutDurum | null>(null);
  const [sifre, setSifre] = useState("");
  const [sifre2, setSifre2] = useState("");
  const [busy, setBusy] = useState<"" | "kur" | "ac" | "esitle">("");
  const [mesaj, setMesaj] = useState<{ t: string; ok?: boolean } | null>(null);
  const zaman = useRef<ReturnType<typeof setTimeout> | null>(null);
  const susturma = useRef(false);

  const yenile = () => bulutDurumu().then(setDurum).catch(() => setDurum({ tur: "kurulum_yok" }));
  const simdiEsitle = async (sessiz = false) => {
    if (!sessiz) setBusy("esitle");
    try {
      susturma.current = true;
      const r = await esitle();
      if (!sessiz || r.gelen) setMesaj({ t: t("Eşitlendi: {g} föy geldi, {c} föy gitti.", { g: r.gelen, c: r.giden }), ok: true });
    } catch (e) { setMesaj({ t: t(String((e as Error).message || e)) }); }
    finally { setTimeout(() => { susturma.current = false; }, 300); if (!sessiz) setBusy(""); yenile(); }
  };

  useEffect(() => { yenile(); }, []);
  // Açıkken: ekran açılınca ve föyler değiştikten birkaç saniye sonra kendiliğinden eşitlenir.
  useEffect(() => {
    if (durum?.tur !== "acik") return;
    simdiEsitle(true);
    const kapat = foyDinle(() => {
      if (susturma.current) return;
      if (zaman.current) clearTimeout(zaman.current);
      zaman.current = setTimeout(() => simdiEsitle(true), 4000);
    });
    return () => { kapat(); if (zaman.current) clearTimeout(zaman.current); };
  }, [durum?.tur]);

  if (!durum) return null;
  const kur = async () => {
    setMesaj(null);
    if (sifre.length < 8) { setMesaj({ t: t("Eşitleme şifresi en az 8 karakter olmalı.") }); return; }
    if (sifre !== sifre2) { setMesaj({ t: t("Şifreler aynı değil.") }); return; }
    setBusy("kur");
    try { await bulutKur(sifre); setSifre(""); setSifre2(""); await yenile(); }
    catch (e) { setMesaj({ t: t(String((e as Error).message || e)) }); }
    setBusy("");
  };
  const ac = async () => {
    setMesaj(null); setBusy("ac");
    try {
      if (await bulutAc(sifre)) { setSifre(""); await yenile(); }
      else setMesaj({ t: t("Şifre yanlış.") });
    } catch (e) { setMesaj({ t: t(String((e as Error).message || e)) }); }
    setBusy("");
  };

  return (
    <Katlanir anahtar="bulut" baslik={"☁️ " + t("Bulut eşitlemesi")} ozet={durum.tur === "acik" ? t("açık") : durum.tur === "cihaz_kapali" ? t("bu cihazda kapalı") : durum.tur === "sifre_yok" ? t("kurulmadı") : durum.tur === "giris_yok" ? t("giriş gerekli") : ""}>
      {durum.tur === "giris_yok" && <Text style={s.hint}>{t("Föylerinizi bilgisayar ile telefon arasında eşitlemek için hesabınıza giriş yapın.")}</Text>}
      {durum.tur === "kurulum_yok" && <Text style={s.hint}>{t("Bulut eşitlemesi henüz sunucuda kurulmadı (yönetici: supabase/surum17.sql).")}</Text>}
      {(durum.tur === "sifre_yok" || durum.tur === "cihaz_kapali") && (
        <>
          <Text style={s.hint}>{durum.tur === "sifre_yok"
            ? t("Föyleriniz bu cihazda şifrelenip buluta gider; telefonunuzda ve diğer bilgisayarlarınızda aynı şifreyle açılır. Evrak metinleri ayrıca kişisel verileri kodlanarak gönderilir; asıl dosyalar (PDF, UDF) gönderilmez. Şifre hiçbir yere kaydedilmez: unutursanız buluttaki föyler açılamaz, biz de açamayız.")
            : t("Bu hesapta bulut eşitlemesi açık. Föylerinizi bu cihaza getirmek için eşitleme şifrenizi girin.")}</Text>
          <TextInput value={sifre} onChangeText={setSifre} secureTextEntry placeholder={t("Eşitleme şifresi")} placeholderTextColor={C.muted} style={s.inputTek} />
          {durum.tur === "sifre_yok" && <TextInput value={sifre2} onChangeText={setSifre2} secureTextEntry placeholder={t("Eşitleme şifresi (tekrar)")} placeholderTextColor={C.muted} style={s.inputTek} />}
          <View style={s.row}>
            {busy ? <><ActivityIndicator color={C.brass} /><Text style={s.hint}>{t("Anahtar hazırlanıyor; telefonda birkaç saniye sürebilir…")}</Text></>
              : <Btn label={durum.tur === "sifre_yok" ? t("Şifreyi belirle ve eşitlemeyi aç") : t("Bu cihazda aç")} onPress={durum.tur === "sifre_yok" ? kur : ac} />}
          </View>
        </>
      )}
      {durum.tur === "acik" && (
        <>
          <Text style={s.hint}>{t("Açık. Föyler değiştikçe kendiliğinden eşitlenir.")}{durum.son ? " " + t("Son eşitleme: {z}.", { z: saatYaz(durum.son) }) : ""}</Text>
          <View style={s.row}>
            <Btn kind="secondary" label={busy === "esitle" ? t("Eşitleniyor…") : t("Şimdi eşitle")} disabled={!!busy} onPress={() => simdiEsitle()} />
            <Btn kind="ghost" label={t("Bu cihazda kapat")} onPress={async () => { await bulutCihazdaKapat(); setMesaj(null); yenile(); }} />
          </View>
        </>
      )}
      {mesaj && <Text style={[s.hint, { color: mesaj.ok ? C.good : C.bad }]}>{mesaj.t}</Text>}
    </Katlanir>
  );
}
