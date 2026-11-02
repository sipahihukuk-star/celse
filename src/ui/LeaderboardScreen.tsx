// Liderlik panosu: kariyer puanına göre en iyi avukatlar; bütün zamanlar ya da bu ay, Türkiye ya da büronun şehri.
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CaseFile } from "../engine/types";
import { useAccount } from "../data/account";
import { useCharacter } from "../data/character";
import { Progress } from "../data/career";
import { backfillPoints, BoardRow, displayName, fetchBoard, joinBoard, leaveBoard, myPoints, onBoard, Period } from "../data/leaderboard";
import { AVATARS, Avatar, CITIES, useOffice } from "../data/office";
import { AvatarFace } from "./OfficeScreen";
import { Btn } from "./kit";
import { C, F } from "./theme";
import { locale, t } from "../i18n";

const MEDAL = ["#d9b44a", "#c7ccd1", "#c98a55"];
const isAvatar = (k: string | null): k is Avatar => !!k && (AVATARS as readonly string[]).includes(k);
const num = (n: number) => n.toLocaleString(locale());

export default function LeaderboardScreen({ progress, all, rank, onBack, onSignIn, onSignUp }:
  { progress: Progress; all: CaseFile[]; rank: string; onBack: () => void; onSignIn: () => void; onSignUp: () => void }) {
  const { account } = useAccount();
  const { office } = useOffice();
  const me = useCharacter();
  const server = account?.mode === "server";
  const city = office ? CITIES.find(c => c.id === office.city)?.name : undefined;
  const avatar = office?.avatar || me?.avatar;
  const [period, setPeriod] = useState<Period>("tum");
  const [local, setLocal] = useState(false);
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [err, setErr] = useState<string>();
  const [joined, setJoined] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const mine = myPoints(progress, all);

  // Hesap değişince: eski kayıtların puanını yaz, panodaysa görünen bilgileri tazele.
  useEffect(() => {
    if (!server) { setJoined(false); return; }
    let live = true;
    (async () => {
      await backfillPoints(progress, all).catch(() => {});
      const on = await onBoard().catch(() => false);
      if (on) await joinBoard({ sehir: city, avatar, unvan: rank }).catch(() => {});
      if (live) { setJoined(on); setTick(n => n + 1); }
    })();
    return () => { live = false; };
  }, [account?.id]);

  useEffect(() => {
    let live = true;
    setRows(null); setErr(undefined);
    fetchBoard(period, local ? city : undefined).then(r => { if (live) { setRows(r.rows); setErr(r.error); } });
    return () => { live = false; };
  }, [period, local, tick]);

  const join = async () => {
    setBusy(true);
    const r = await joinBoard({ sehir: city, avatar, unvan: rank });
    setBusy(false);
    if (r.error) setErr(r.error); else { setJoined(true); setTick(n => n + 1); }
  };
  const leave = async () => { setBusy(true); await leaveBoard(); setBusy(false); setJoined(false); setTick(n => n + 1); };
  const myRow = rows?.find(r => r.ben);

  const Tab = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={onPress} style={[s.tab, on && s.tabOn]}>
      <Text style={[s.tabT, on && s.tabTOn]}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={s.headRow}><Btn kind="ghost" label={t("‹ Giriş")} onPress={onBack} /></View>
      <Text style={s.eyebrow}>{t("LİDERLİK PANOSU")}</Text>
      <Text style={s.title}>{t("Celse'nin en iyi avukatları")}</Text>

      {/* Oyuncunun kendi kartı */}
      <View style={s.meCard}>
        {avatar ? <AvatarFace k={avatar} size={52} /> : <View style={s.noFace} />}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.meName}>{account ? displayName(account.adSoyad) : t("Misafir")}</Text>
          <Text style={s.meSub}>{t("{p} puan", { p: num(mine) })} · {rank}</Text>
          {myRow && <Text style={s.meRank}>{period === "ay" ? t("Bu ay {n}. sıradasınız", { n: myRow.sira }) : t("{n}. sıradasınız", { n: myRow.sira })}</Text>}
        </View>
      </View>
      {!server ? (
        <View style={s.box}>
          <Text style={s.boxT}>{t("Panoda yer almak için üye olun ya da giriş yapın. Puanlarınız hesabınıza kaydedilir, her cihazda devam eder.")}</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Btn label={t("Üye ol")} onPress={onSignUp} />
            <Btn kind="ghost" label={t("Giriş yap")} onPress={onSignIn} />
          </View>
        </View>
      ) : joined === false ? (
        <View style={s.box}>
          <Text style={s.boxT}>{t("Panoya katıldığınızda adınız \"{ad}\" olarak; unvanınız, şehriniz ve puanınızla birlikte diğer oyunculara görünür. Telefonunuz ve e-postanız görünmez. İstediğiniz an panodan çıkabilirsiniz.", { ad: account ? displayName(account.adSoyad) : "" })}</Text>
          <Btn label={busy ? t("Katılınıyor…") : t("Panoya katıl")} onPress={join} disabled={busy} />
        </View>
      ) : null}

      <View style={s.tabs}>
        <Tab on={period === "tum"} label={t("Bütün zamanlar")} onPress={() => setPeriod("tum")} />
        <Tab on={period === "ay"} label={t("Bu ay")} onPress={() => setPeriod("ay")} />
        <View style={{ width: 12 }} />
        <Tab on={!local} label={t("Türkiye")} onPress={() => setLocal(false)} />
        {!!city && <Tab on={local} label={city} onPress={() => setLocal(true)} />}
      </View>

      {rows === null && !err ? <ActivityIndicator color={C.brass} style={{ marginVertical: 24 }} />
        : err ? <Text style={s.empty}>{t(err)}</Text>
        : rows!.length === 0 ? <Text style={s.empty}>{period === "ay" ? t("Bu ay henüz puan alan olmadı. İlk sırayı siz alın!") : t("Panoda henüz kimse yok. İlk sırayı siz alın!")}</Text>
        : (
          <View style={s.list}>
            {rows!.map(r => (
              <View key={`${r.sira}-${r.ad}-${r.ben}`} style={[s.row, r.ben && s.rowMe]}>
                <View style={[s.rank, r.sira <= 3 && { backgroundColor: MEDAL[r.sira - 1], borderColor: MEDAL[r.sira - 1] }]}>
                  <Text style={[s.rankT, r.sira <= 3 && { color: "#2a1018" }]}>{r.sira}</Text>
                </View>
                {isAvatar(r.avatar) ? <AvatarFace k={r.avatar} size={40} /> : <View style={[s.noFace, { width: 40, height: 40 }]} />}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.name} numberOfLines={1}>{r.ad}{r.ben ? " · " + t("siz") : ""}</Text>
                  <Text style={s.sub} numberOfLines={1}>{[r.unvan, r.sehir].filter(Boolean).join(" · ")}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={s.pts}>{num(r.puan)}</Text>
                  <Text style={s.sub}>{t("{n} galibiyet", { n: r.kazanilan })}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

      {joined && <Pressable onPress={leave} disabled={busy} style={{ alignSelf: "center", padding: 8 }}><Text style={s.leave}>{t("Panodan çık")}</Text></Pressable>}
      <Text style={s.fine}>{t("Puan nasıl hesaplanır? Kariyerdeki her dava için en iyi denemeniz sayılır: kazanılan davada 50 + dava puanı, kaybedilen davada dava puanının dörtte biri. Üst mahkemelerde çarpan artar: ağır ceza ve bölge ×1,25, Yargıtay ve Danıştay ×1,5, Anayasa Mahkemesi ×1,75, uluslararası mahkemeler ×2. Antrenman dosyaları sayılmaz.")}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 20, gap: 12 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  eyebrow: { fontFamily: F.mono, fontSize: 12, letterSpacing: 2.5, color: C.muted, marginTop: 6 },
  title: { fontFamily: F.display, fontSize: 28, color: C.brass },
  meCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.paperHi, borderRadius: 12, padding: 12 },
  meName: { fontFamily: F.display, fontSize: 19, color: C.brassInk },
  meSub: { fontFamily: F.bodyMed, fontSize: 14, color: C.inkSoft },
  meRank: { fontFamily: F.monoBold, fontSize: 12, letterSpacing: 1, color: C.brassInk },
  noFace: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.panel2 },
  box: { borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, borderRadius: 12, padding: 12, gap: 10 },
  boxT: { fontFamily: F.body, fontSize: 14, color: C.textSoft },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  tab: { borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.panel },
  tabOn: { backgroundColor: C.brass, borderColor: C.brass },
  tabT: { fontFamily: F.bodyMed, fontSize: 14, color: C.textSoft },
  tabTOn: { color: C.brassInk },
  list: { gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  rowMe: { borderColor: C.brass, backgroundColor: "rgba(255,255,255,0.10)" },
  rank: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  rankT: { fontFamily: F.monoBold, fontSize: 13, color: C.text },
  name: { fontFamily: F.bodyBold, fontSize: 15, color: C.text },
  sub: { fontFamily: F.body, fontSize: 12, color: C.muted },
  pts: { fontFamily: F.display, fontSize: 18, color: C.brass },
  empty: { fontFamily: F.body, fontSize: 15, color: C.textSoft, textAlign: "center", marginVertical: 20 },
  leave: { fontFamily: F.mono, fontSize: 12, color: C.muted, letterSpacing: 1 },
  fine: { fontFamily: F.body, fontSize: 12, color: C.muted, marginTop: 4 }
});
