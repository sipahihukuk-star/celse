// "Hata bildir" penceresi: oyuncu duruşma sırasında metin, hukuk, görsel ya da teknik bir hatayı bildirir.
// Dava, adım, ekrandaki satır, uygulama sürümü, platform ve dil kendiliğinden eklenir (supabase/surum9.sql "hata_bildirimleri").
import { KeyboardBar, kbBar } from "./KeyboardBar";
import React, { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAccount } from "../data/account";
import { ReportCategory, sendReport } from "../data/inbox";
import { t } from "../i18n";
import { Btn } from "./kit";
import { C, F } from "./theme";

const CATS: { v: ReportCategory; label: string }[] = [
  { v: "metin", label: "Metin / yazım" },
  { v: "hukuki", label: "Hukuki hata" },
  { v: "gorsel", label: "Görsel uyumsuzluk" },
  { v: "teknik", label: "Teknik sorun" },
  { v: "diger", label: "Diğer" }
];

interface Props {
  visible: boolean;
  onClose: () => void;
  davaId: string;
  adim: number | null;
  /** pencerenin alt başlığı (mahkeme · esas) */
  subtitle?: string;
  /** gönderim anında okunur: ekrandaki satır, aşama, sürüm, platform, dil… */
  context: () => Record<string, unknown>;
}

export function BugReportModal({ visible, onClose, davaId, adim, subtitle, context }: Props) {
  const { account } = useAccount();
  const [kat, setKat] = useState<ReportCategory | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [ctx, setCtx] = useState<Record<string, unknown>>({});
  const member = account?.mode === "server";
  const close = () => { onClose(); setTimeout(() => { setDone(false); setText(""); setKat(null); setErr(""); }, 300); };
  const send = async () => {
    if (!kat) return setErr(t("Bir tür seçin."));
    if (text.trim().length < 5) return setErr(t("Lütfen hatayı birkaç kelimeyle anlatın."));
    setBusy(true); setErr("");
    const r = await sendReport({ davaId, adim, kategori: kat, aciklama: text, baglam: { ...context(), kategori: kat } });
    setBusy(false);
    if (r.error) setErr(t(r.error)); else setDone(true);
  };
  const preview = (() => {
    const satir = typeof ctx.satir === "string" ? ctx.satir : "";
    return [
      t("Dava: {id}", { id: davaId }) + (adim != null ? " · " + t("Adım {n}", { n: adim + 1 }) : ""),
      satir ? `“${satir.length > 140 ? satir.slice(0, 140) + "…" : satir}”` : "",
      [ctx.surum, ctx.platform, ctx.dil].filter(Boolean).join(" · ")
    ].filter(Boolean);
  })();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} onShow={() => setCtx(context())}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={st.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={t("Kapat")} />
          <View style={st.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10 }}>
              <Text style={st.title}>{t("Hata bildir")}</Text>
              {!!subtitle && <Text style={st.sub}>{subtitle}</Text>}
              {done ? (
                <>
                  <Text style={st.body}>{t("Teşekkürler, bildiriminiz alındı. Dosyayı inceleyip gerekiyorsa düzelteceğiz.")}</Text>
                  {member && <Text style={st.note}>{t("Yanıtımız gelen kutunuza düşecek (☰ Menü › Gelen kutusu).")}</Text>}
                  <Btn kind="ghostInk" label={t("Kapat")} onPress={close} style={{ alignSelf: "flex-start" }} />
                </>
              ) : (
                <>
                  <Text style={st.label}>{t("NE TÜR BİR HATA?")}</Text>
                  <View style={st.cats}>
                    {CATS.map(o => (
                      <Pressable key={o.v} accessibilityRole="radio" accessibilityState={{ checked: kat === o.v }} onPress={() => { setKat(o.v); setErr(""); }}
                        style={[st.cat, kat === o.v && st.catOn]}>
                        <Text style={[st.catT, kat === o.v && st.catTOn]}>{t(o.label)}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={st.label}>{t("AÇIKLAMA")}</Text>
                  <TextInput {...kbBar} value={text} onChangeText={v => { setText(v); setErr(""); }} multiline maxLength={4000}
                    placeholder={t("Ne yanlış? Doğrusu ne olmalı? (ör. madde numarası, yazım hatası, uyumsuz görsel)")} placeholderTextColor={C.inkSoft}
                    style={st.input} accessibilityLabel={t("Açıklama")} />
                  <View style={st.ctx}>
                    <Text style={st.ctxH}>{t("Bildirime kendiliğinden eklenenler")}</Text>
                    {preview.map((p, i) => <Text key={i} style={st.ctxT} numberOfLines={3}>{p}</Text>)}
                  </View>
                  {!member && <Text style={st.note}>{t("Giriş yapmadan da bildirebilirsiniz; ancak size yanıt verebilmemiz için giriş yapmanızı öneririz. Üyelerin bildirimlerine yanıt gelen kutusuna düşer.")}</Text>}
                  {!!err && <Text style={st.err}>{err}</Text>}
                  <View style={st.actions}>
                    <Btn kind="ghostInk" label={t("Vazgeç")} onPress={close} />
                    <Btn label={busy ? t("Gönderiliyor…") : t("Gönder")} onPress={send} disabled={busy} />
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
      <KeyboardBar inModal />
    </Modal>
  );
}

/** Duruşma ekranındaki küçük "Hata bildir" bağlantısı. */
export function BugReportLink({ onPress, ink }: { onPress: () => void; ink?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t("Hata bildir")} onPress={onPress} hitSlop={8}
      style={({ pressed }) => [st.link, ink && { marginTop: 0 }, pressed && { opacity: 0.6 }]}>
      <Text style={[st.linkT, ink && { color: C.inkSoft }]}>⚑ {t("Hata bildir")}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(5,8,10,0.72)", alignItems: "center", justifyContent: "center", padding: 16 },
  sheet: { backgroundColor: C.paper, borderRadius: 4, padding: 20, width: "100%", maxWidth: 560, maxHeight: "92%" },
  title: { fontFamily: F.display, fontSize: 24, color: C.ink },
  sub: { fontFamily: F.mono, fontSize: 12, color: C.inkSoft, marginTop: -6 },
  body: { fontFamily: F.body, fontSize: 16, lineHeight: 23, color: C.ink },
  label: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.2, color: C.inkSoft, marginTop: 4 },
  cats: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  cat: { borderWidth: 1, borderColor: C.rule, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.paperHi },
  catOn: { backgroundColor: C.bordo, borderColor: C.bordo },
  catT: { fontFamily: F.bodyMed, fontSize: 14, color: C.ink },
  catTOn: { color: "#ffffff" },
  input: { fontFamily: F.body, fontSize: 16, color: C.ink, backgroundColor: C.paperHi, borderWidth: 1, borderColor: C.rule, borderRadius: 6, padding: 10, minHeight: 110, textAlignVertical: "top" },
  ctx: { borderLeftWidth: 3, borderLeftColor: C.rule, paddingLeft: 10, gap: 2 },
  ctxH: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1, color: C.inkSoft, textTransform: "uppercase" },
  ctxT: { fontFamily: F.body, fontSize: 13, color: C.inkSoft },
  note: { fontFamily: F.body, fontSize: 13, lineHeight: 19, color: C.inkSoft },
  err: { fontFamily: F.bodyMed, fontSize: 14, color: "#a3241c" },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
  link: { alignSelf: "flex-end", paddingVertical: 4, paddingHorizontal: 2, marginTop: 10 },
  linkT: { fontFamily: F.body, fontSize: 13, color: C.muted }
});
