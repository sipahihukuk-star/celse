// İnternet üzerinden karşılıklı oyun ekranları: lobi (kodla katıl, açık davetler), davet bekleme ve oyun + son söz + karar.
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { kbBar } from "./KeyboardBar";
import { AI_FUNCTION, serverReady, SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";
import { getAccessToken, useAccount } from "../data/account";
import { getMatch, joinMatch, leaveMatch, Match, Move, myId, openMatches, sendClosing, sendMove, sendVerdict, sideOf, useMatch } from "../data/online";
import { GameState } from "../engine/engine";
import { AiVerdict, judgeDuel } from "../engine/judge";
import { CaseFile, Player, Side } from "../engine/types";
import { localizeCase } from "../i18n/cases";
import { locale, t } from "../i18n";
import GameScreen from "./GameScreen";
import { Btn, Chip } from "./kit";
import { C, F } from "./theme";

const shareText = (m: Match, c?: CaseFile) => t("Celse'de benimle karşılıklı duruşmaya gel: {dava} · davet kodu {kod} · {adres}", { dava: c?.title || t("dava"), kod: m.kod, adres: "https://sipahihukuk-star.github.io/celse/" });

/* ---------------- Lobi ---------------- */

export function OnlineLobby({ all, onBack, onJoined, onLogin }: { all: CaseFile[]; onBack: () => void; onJoined: (m: Match) => void; onLogin: () => void }) {
  const { account } = useAccount();
  const [kod, setKod] = useState("");
  const [list, setList] = useState<Match[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const byId = new Map(all.map(c => [c.id, c]));
  const load = () => openMatches().then(setList).catch(e => setErr((e as Error).message));
  useEffect(() => { if (account) { load(); const t = setInterval(load, 5000); return () => clearInterval(t); } }, [account?.id]);

  const join = async (k: string) => {
    setBusy(true); setErr("");
    try { onJoined(await joinMatch(k)); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <View style={s.head}>
        <Btn kind="ghost" label={t("‹ Geri")} onPress={onBack} />
        <View style={{ flex: 1, minWidth: 220 }}>
          <Text style={s.eyebrow}>{t("İNTERNET ÜZERİNDEN")}</Text>
          <Text style={s.title}>{t("Karşılıklı duruşma")}</Text>
          <Text style={s.sub}>{t("Başka bir cihazdaki avukatla aynı davada karşı karşıya gelin; kararı yapay zekâ hâkim ya da hakem verir. Davet açmak için listeden bir dava seçip “İnternet üzerinden” deyin.")}</Text>
        </View>
      </View>
      {!account || !serverReady() ? (
        <View style={s.card}>
          <Text style={s.body}>{t("İnternet üzerinden oynamak için hesabınızla giriş yapın.")}</Text>
          <Btn label={t("Giriş yap ›")} onPress={onLogin} />
        </View>
      ) : (
        <>
          <View style={s.card}>
            <Text style={s.legend}>{t("DAVET KODUYLA KATIL")}</Text>
            <View style={s.row}>
              <TextInput {...kbBar} value={kod} onChangeText={x => setKod(x.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder={t("ör. K7P2QX")} placeholderTextColor={C.muted}
                style={[s.input, { flex: 1, letterSpacing: 4 }]} autoCapitalize="characters" autoCorrect={false} onSubmitEditing={() => kod.length === 6 && join(kod)} />
              <Btn label={busy ? t("Katılınıyor…") : t("Katıl")} disabled={kod.length !== 6 || busy} onPress={() => join(kod)} />
            </View>
          </View>
          <Text style={s.legend}>{t("RAKİP BEKLEYEN AÇIK DAVETLER")}</Text>
          {list === null ? <ActivityIndicator color={C.brass} /> : list.length === 0 ? <Text style={s.sub}>{t("Şu an açık davet yok. Bir dava seçip kendiniz davet açabilirsiniz.")}</Text> : list.map(m => {
            const c = byId.get(m.dava_id);
            const free: Side = m.p1 ? "p2" : "p1";
            return (
              <View key={m.id} style={s.item}>
                <View style={{ flex: 1, minWidth: 200, gap: 2 }}>
                  <Text style={s.itemT}>{c?.title || m.dava_id}</Text>
                  <Text style={s.sub} numberOfLines={1}>{c?.court}</Text>
                  <Text style={s.meta}>{t("{ad} bekliyor · size kalan rol: {rol}", { ad: (m.p1_ad || m.p2_ad) ?? t("Avukat"), rol: c?.sides[free].role || free })}</Text>
                </View>
                <Btn label={t("Katıl")} disabled={busy} onPress={() => join(m.kod)} />
              </View>
            );
          })}
          {!!err && <Text style={s.err}>{t(err)}</Text>}
        </>
      )}
    </ScrollView>
  );
}

/* ---------------- Davet bekleme ---------------- */

export function OnlineWait({ id, c, onCancel, onStart }: { id: string; c: CaseFile; onCancel: () => void; onStart: (m: Match) => void }) {
  const { match } = useMatch(id, 2000);
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (match?.durum === "oynaniyor") onStart(match); }, [match?.durum]);
  if (!match) return <View style={s.center}><ActivityIndicator color={C.brass} /></View>;
  const share = async () => {
    const text = shareText(match, c);
    try {
      if (Platform.OS === "web" && (navigator as any).clipboard) { await (navigator as any).clipboard.writeText(text); setCopied(true); }
      else await Share.share({ message: text });
    } catch { /* yok say */ }
  };
  return (
    <View style={s.center}>
      <View style={[s.card, { maxWidth: 520, width: "100%", alignItems: "center" }]}>
        <Text style={s.eyebrow}>{c.title.toLocaleUpperCase(locale())}</Text>
        <Text style={s.sub}>{match.acik ? t("Rakibiniz bu kodla katılacak ya da açık davetler listesinden sizi bulacak.") : t("Rakibiniz bu kodla katılacak.")}</Text>
        <Text style={s.code}>{match.kod}</Text>
        <Btn kind="ghost" label={copied ? t("Davet metni kopyalandı ✓") : t("Daveti paylaş / kopyala")} onPress={share} />
        <View style={[s.row, { justifyContent: "center" }]}><ActivityIndicator color={C.brass} /><Text style={s.body}>{t("Rakip bekleniyor…")}</Text></View>
        {match.durum === "iptal" && <Text style={s.err}>{t("Davet kapatıldı.")}</Text>}
        <Btn kind="ghost" label={t("Daveti iptal et")} onPress={async () => { await leaveMatch(id); onCancel(); }} />
      </View>
    </View>
  );
}

/* ---------------- Oyun ---------------- */

export function OnlineGame({ id, c: c0, onExit, onDone }: { id: string; c: CaseFile; onExit: () => void; onDone: (game: GameState, players: Record<Side, Player>, v: AiVerdict) => void }) {
  const { match, error } = useMatch(id, 1500);
  // Her oyuncu dosyayı kendi dilinde görür; yapı aynı olduğu için hamle numaraları ortaktır.
  const [c, setC] = useState<CaseFile | null>(null);
  useEffect(() => { localizeCase(c0).then(setC); }, [c0.id]);
  const [me, setMe] = useState<string | null>(null);
  const [ended, setEnded] = useState<GameState | null>(null);
  const [sendErr, setSendErr] = useState("");
  const queue = useRef<Move[]>([]);
  useEffect(() => { myId().then(setMe).catch(() => {}); }, []);

  // Gönderilemeyen hamle kaybolmasın: sırayla yeniden denenir.
  const flush = async () => {
    while (queue.current.length) {
      const m = queue.current[0];
      try { await sendMove(id, m); queue.current.shift(); setSendErr(""); }
      catch (e) { setSendErr(t("Hamle gönderilemedi, yeniden deneniyor…")); await new Promise(r => setTimeout(r, 2000)); }
    }
  };
  if (!match || !me || !c) return <View style={s.center}><ActivityIndicator color={C.brass} /><Text style={s.sub}>{error ? t(error) : t("Eşleşme yükleniyor…")}</Text></View>;
  const mySide = sideOf(match, me);
  if (!mySide) return <View style={s.center}><Text style={s.err}>{t("Bu eşleşmede yer almıyorsunuz.")}</Text><Btn label={t("Geri")} onPress={onExit} /></View>;
  const other: Side = mySide === "p1" ? "p2" : "p1";
  const players: Record<Side, Player> = {
    p1: { name: match.p1_ad || t("Avukat"), ai: false, remote: mySide !== "p1" },
    p2: { name: match.p2_ad || t("Avukat"), ai: false, remote: mySide !== "p2" }
  };

  if (match.durum === "iptal" && !ended) {
    return <View style={s.center}><Text style={s.body}>{t("{ad} oyundan ayrıldı.", { ad: players[other].name })}</Text><Btn label={t("Çık")} onPress={onExit} /></View>;
  }
  if (ended) return <OnlineClosing c={c} match={match} mySide={mySide} players={players} game={ended} onDone={v => onDone(ended, players, v)} onExit={onExit} />;

  return (
    <View style={{ flex: 1 }}>
      {!!sendErr && <Text style={[s.err, { textAlign: "center" }]}>{sendErr}</Text>}
      <GameScreen c={c} players={players}
        online={{ moves: match.hamleler || [], mySide, send: m => { queue.current.push(m); if (queue.current.length === 1) flush(); } }}
        onExit={async () => { await leaveMatch(id); onExit(); }}
        onFinish={g => setEnded(g)} />
    </View>
  );
}

/** Son sözler: her avukat kendi cihazında yazar; ikisi de gelince kurucu taraf yapay zekâ hakemden kararı ister. */
function OnlineClosing({ c, match, mySide, players, game, onDone, onExit }: { c: CaseFile; match: Match; mySide: Side; players: Record<Side, Player>; game: GameState; onDone: (v: AiVerdict) => void; onExit: () => void }) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const asked = useRef(false);
  const mine = mySide === "p1" ? match.son1 : match.son2;
  const theirs = mySide === "p1" ? match.son2 : match.son1;
  const host = match.kurucu === (mySide === "p1" ? match.p1 : match.p2);

  useEffect(() => {
    if (match.karar) { onDone(match.karar as AiVerdict); return; }
    if (!game.fatal && !(match.son1 && match.son2)) return;
    if (!host || asked.current) return;
    asked.current = true;
    (async () => {
      const token = await getAccessToken();
      const v = await judgeDuel(c, game, match.son1 || "", match.son2 || "", serverReady() ? { url: SUPABASE_URL, key: SUPABASE_ANON_KEY, token, fn: AI_FUNCTION } : undefined);
      try { await sendVerdict(match.id, v); } catch { /* karşı taraf zaten yazmış olabilir */ }
      const fresh = await getMatch(match.id);
      onDone((fresh?.karar as AiVerdict) || v);
    })();
  }, [match.son1, match.son2, match.karar]);

  if (mine || sent || game.fatal) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.brass} />
        <Text style={s.title}>{theirs || game.fatal ? t("Hakem karar için çekildi") : t("{ad} son sözünü yazıyor…", { ad: players[mySide === "p1" ? "p2" : "p1"].name })}</Text>
        <Text style={s.sub}>{t("Karar iki cihazda da aynı anda görünecek.")}</Text>
        <Btn kind="ghost" label={t("Oyundan çık")} onPress={onExit} />
      </View>
    );
  }
  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <Text style={s.eyebrow}>{c.court.toLocaleUpperCase(locale())} · {t("SON SÖZ")}</Text>
      <Text style={s.title}>{players[mySide].name} · {c.sides[mySide].role}</Text>
      <Text style={s.body}>{t("Davanın özünü, dayandığınız kuralları ve karşı tarafın zayıf noktasını birkaç cümlede söyleyin. Kararı yapay zekâ verecek: duruşmadaki hamleleriniz ve bu son söz birlikte değerlendirilir.")}</Text>
      <TextInput {...kbBar} value={text} onChangeText={setText} multiline placeholder={t("Sayın Hakem Heyeti, …")} placeholderTextColor={C.muted} style={[s.input, { minHeight: 160, textAlignVertical: "top" }]} maxLength={2500} />
      <Btn label={t("Son sözü sun ▸")} disabled={!text.trim()} onPress={async () => { setSent(true); try { await sendClosing(match.id, text.trim()); } catch { setSent(false); } }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 820, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 20, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 16 },
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 12 },
  eyebrow: { fontFamily: F.mono, fontSize: 12, letterSpacing: 2, color: C.muted },
  title: { fontFamily: F.display, fontSize: 26, color: C.brass, textAlign: "center" },
  sub: { fontFamily: F.body, fontSize: 15, color: C.muted },
  body: { fontFamily: F.body, fontSize: 16, color: C.textSoft },
  meta: { fontFamily: F.mono, fontSize: 11, color: C.muted },
  legend: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: C.muted, marginTop: 6 },
  card: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 16, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  input: { fontFamily: F.body, fontSize: 18, color: C.text, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  item: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12 },
  itemT: { fontFamily: F.displayMed, fontSize: 18, color: C.text },
  code: { fontFamily: F.monoBold, fontSize: 44, letterSpacing: 10, color: C.text, marginVertical: 6 },
  err: { fontFamily: F.body, fontSize: 14, color: C.bad }
});
