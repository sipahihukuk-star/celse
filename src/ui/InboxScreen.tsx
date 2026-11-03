// Gelen kutusu: duyurular, hata bildirimlerine yanıtlar ve sistem mesajları; altında oyuncunun kendi hata bildirimleri.
// Liste okunmamışları noktayla gösterir; mesaja dokununca ayrıntısı açılır ve okundu sayılır.
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAccount } from "../data/account";
import { markRead, Message, MyReport, ReportStatus, useInbox, useUnreadCount } from "../data/inbox";
import { locale, t } from "../i18n";
import { Btn, Chip } from "./kit";
import { C, F } from "./theme";

/** color: koyu zeminde, ink: kâğıt zeminde (ayrıntı) */
const KIND: Record<Message["tur"], { label: string; color: string; ink: string }> = {
  duyuru: { label: "Duyuru", color: C.p1, ink: C.p1Ink },
  yanit: { label: "Yanıt", color: C.good, ink: C.win },
  sistem: { label: "Sistem", color: C.brassDim, ink: C.inkSoft }
};
const STATUS: Record<ReportStatus, { label: string; color: string }> = {
  yeni: { label: "Alındı", color: C.brassDim },
  inceleniyor: { label: "İnceleniyor", color: C.mid },
  duzeltildi: { label: "Düzeltildi", color: C.good },
  reddedildi: { label: "Hata bulunmadı", color: C.muted }
};
const CAT: Record<MyReport["kategori"], string> = { metin: "Metin / yazım", hukuki: "Hukuki hata", gorsel: "Görsel uyumsuzluk", teknik: "Teknik sorun", diger: "Diğer" };

const when = (iso: string) => {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  return days < 1 ? d.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString(locale(), { day: "numeric", month: "short", year: days > 300 ? "numeric" : undefined });
};

export default function InboxScreen({ onBack, onSignIn }: { onBack: () => void; onSignIn: () => void }) {
  const { account } = useAccount();
  const { messages, reports, unread, loaded, refresh } = useInbox();
  const [open, setOpen] = useState<Message | null>(null);
  const [pulling, setPulling] = useState(false);
  const member = account?.mode === "server";
  useEffect(() => { refresh(); }, []);
  useEffect(() => { if (open && !open.read) markRead([open.id]); }, [open?.id]);

  if (open) {
    const k = KIND[open.tur] || KIND.sistem;
    return (
      <ScrollView contentContainerStyle={s.wrap}>
        <View style={s.head}><Btn kind="ghost" label={t("‹ Gelen kutusu")} onPress={() => setOpen(null)} /></View>
        <View style={s.detail}>
          <View style={s.metaRow}>
            <Chip label={t(k.label).toLocaleUpperCase(locale())} color={k.ink} />
            {open.ilgili_bildirim != null && <Text style={s.metaInk}>{t("Bildirim #{n}", { n: open.ilgili_bildirim })}</Text>}
            <View style={{ flex: 1 }} />
            <Text style={s.metaInk}>{new Date(open.created_at).toLocaleString(locale(), { dateStyle: "medium", timeStyle: "short" })}</Text>
          </View>
          <Text style={s.dTitle}>{open.baslik}</Text>
          <Text style={s.dBody} selectable>{open.metin}</Text>
          <Text style={s.sign}>— Celse · Themiscode</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.wrap}
      refreshControl={<RefreshControl refreshing={pulling} tintColor={C.brass} onRefresh={async () => { setPulling(true); await refresh(); setPulling(false); }} />}>
      <View style={s.head}>
        <Btn kind="ghost" label={t("‹ Giriş")} onPress={onBack} />
        <View style={{ flex: 1 }} />
        {unread > 0 && <Btn kind="ghost" label={t("Tümünü okundu say")} onPress={() => markRead(messages.filter(m => !m.read).map(m => m.id))} />}
      </View>
      <Text style={s.eyebrow}>{unread > 0 ? t("{n} OKUNMAMIŞ", { n: unread }) : t("HEPSİ OKUNDU")}</Text>
      <Text style={s.title}>{t("Gelen kutusu")}</Text>
      <Text style={s.lede}>{t("Duyurular ve gönderdiğiniz hata bildirimlerine verilen yanıtlar burada.")}</Text>

      {!member && (
        <View style={s.guest}>
          <Text style={s.guestT}>{t("Misafir olarak yalnız genel duyuruları görüyorsunuz. Hata bildirimlerinize yanıt alabilmek için giriş yapın.")}</Text>
          <Btn kind="secondary" label={t("Giriş yap")} onPress={onSignIn} style={{ alignSelf: "flex-start" }} />
        </View>
      )}

      {!loaded && <ActivityIndicator color={C.brass} style={{ marginTop: 20 }} />}
      {loaded && !messages.length && <Text style={s.empty}>{t("Henüz mesajınız yok.")}</Text>}
      <View style={{ gap: 8 }}>
        {messages.map(m => {
          const k = KIND[m.tur] || KIND.sistem;
          return (
            <Pressable key={m.id} accessibilityRole="button" accessibilityLabel={(m.read ? "" : t("Okunmamış") + ": ") + m.baslik} onPress={() => setOpen(m)}
              style={({ pressed }) => [s.row, !m.read && s.rowUnread, pressed && { opacity: 0.85 }]}>
              <View style={[s.dot, { backgroundColor: m.read ? "transparent" : C.bad }]} />
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <View style={s.metaRow}>
                  <Text style={[s.kind, { color: k.color }]}>{t(k.label).toLocaleUpperCase(locale())}</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={s.meta}>{when(m.created_at)}</Text>
                </View>
                <Text style={[s.rowT, !m.read && { fontFamily: F.bodyBold }]} numberOfLines={1}>{m.baslik}</Text>
                <Text style={s.rowS} numberOfLines={2}>{m.metin}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {member && reports.length > 0 && (
        <>
          <Text style={s.h}>{t("Hata bildirimlerim")}</Text>
          {reports.map(r => {
            const st = STATUS[r.durum] || STATUS.yeni;
            return (
              <View key={r.id} style={s.rep}>
                <View style={s.metaRow}>
                  <Text style={s.meta}>#{r.id} · {t(CAT[r.kategori] || "Diğer")}{r.dava_id ? ` · ${r.dava_id}` : ""}</Text>
                  <View style={{ flex: 1 }} />
                  <Chip label={t(st.label).toLocaleUpperCase(locale())} color={st.color} />
                </View>
                <Text style={s.rowS} numberOfLines={3}>{r.aciklama}</Text>
                {!!r.yanit && <Text style={s.repAns} numberOfLines={4}>{t("Yanıt: {metin}", { metin: r.yanit })}</Text>}
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

/** Menü düğmesinin köşesindeki okunmamış noktası. */
export function InboxDot() {
  const n = useUnreadCount();
  if (n <= 0) return null;
  return <View style={s.burgerDot} accessibilityLabel={t("{n} okunmamış mesaj", { n })} />;
}

/** Yan menüdeki "Gelen kutusu" satırı, okunmamış sayısı rozetiyle. */
export function InboxMenuItem({ onPress }: { onPress: () => void }) {
  const n = useUnreadCount();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={n > 0 ? `${t("Gelen kutusu")} · ${t("{n} okunmamış mesaj", { n })}` : t("Gelen kutusu")} onPress={onPress}
      style={({ pressed }) => [s.mItem, pressed && { backgroundColor: C.panel2 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={s.mItemT}>{t("Gelen kutusu")}</Text>
        {n > 0 && <View style={s.badge}><Text style={s.badgeT}>{n > 99 ? "99+" : n}</Text></View>}
      </View>
      <Text style={s.mItemS}>{t("Duyurular ve hata bildirimlerinize yanıtlar")}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  eyebrow: { fontFamily: F.mono, fontSize: 11, letterSpacing: 2, color: C.muted, marginTop: 6 },
  title: { fontFamily: F.display, fontSize: 30, color: C.brass },
  lede: { fontFamily: F.body, fontSize: 15, color: C.textSoft, marginBottom: 4 },
  guest: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, gap: 10 },
  guestT: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: C.textSoft },
  empty: { fontFamily: F.bodyItalic, fontSize: 16, color: C.muted, marginTop: 12 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12 },
  rowUnread: { backgroundColor: C.panel2, borderColor: C.brassDim },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  kind: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1.2 },
  meta: { fontFamily: F.mono, fontSize: 11, color: C.muted },
  metaInk: { fontFamily: F.mono, fontSize: 11, color: C.inkSoft },
  rowT: { fontFamily: F.bodyMed, fontSize: 16, color: C.text },
  rowS: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: C.muted },
  h: { fontFamily: F.displayMed, fontSize: 19, color: C.brass, marginTop: 18 },
  rep: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, gap: 6 },
  repAns: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: C.textSoft, borderLeftWidth: 3, borderLeftColor: C.good, paddingLeft: 8 },
  detail: { backgroundColor: C.paper, borderRadius: 4, padding: 20, gap: 12 },
  dTitle: { fontFamily: F.display, fontSize: 24, color: C.ink },
  dBody: { fontFamily: F.body, fontSize: 16, lineHeight: 25, color: C.ink },
  sign: { fontFamily: F.bodyItalic, fontSize: 15, color: C.inkSoft, marginTop: 4 },
  mItem: { paddingHorizontal: 18, paddingVertical: 11 },
  mItemT: { fontFamily: F.bodyMed, fontSize: 16, color: C.text },
  mItemS: { fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 2 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: C.bad, alignItems: "center", justifyContent: "center" },
  badgeT: { fontFamily: F.bodyBold, fontSize: 12, color: "#ffffff" },
  burgerDot: { position: "absolute", top: -3, right: -5, width: 10, height: 10, borderRadius: 5, backgroundColor: C.bad, borderWidth: 1.5, borderColor: C.wallDeep }
});
