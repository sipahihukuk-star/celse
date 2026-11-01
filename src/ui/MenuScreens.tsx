import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { CaseFile, Player, Side } from "../engine/types";
import { Account } from "../data/account";
import { DIFFICULTY } from "../data/career";
import { Btn, Scale } from "./kit";
import { useViewMode } from "./viewMode";
import { useMusic } from "./music";
import { CITIES, Office, tl } from "../data/office";
import { AvatarFace } from "./OfficeScreen";
import { loadResults, SavedResult } from "./storage";
import { C, F } from "./theme";
import { LANGS, locale, t, useLang } from "../i18n";

/* ---------- Giriş ---------- */
export function TitleScreen({ onCareer, onOffice, office, onDuel, onSolo, onAdmin, onAccount, onSignUp, onSignOut, onTahkim, onOnline, tahkimCount, account, server, duelCount, soloCount, rankName, started, won, total }: { onTahkim: () => void; onOnline: () => void; tahkimCount: number; onCareer: () => void; onOffice: () => void; office: Office | null; onAccount: () => void; onSignUp: () => void; onSignOut: () => void; account: Account | null; server: boolean; started: boolean; onDuel: () => void; onSolo: () => void; onAdmin: () => void; duelCount: number; soloCount: number; rankName: string; won: number; total: number }) {
  const { width } = useWindowDimensions();
  const [tilt, setTilt] = useState(-4);
  useEffect(() => { const id = setInterval(() => setTilt(a => -a), 3000); return () => clearInterval(id); }, []);
  const wide = width >= 760;
  const [view, setView] = useViewMode();
  const [music, setMusic] = useMusic();
  const [lang, chooseLang] = useLang();
  return (
    <ScrollView contentContainerStyle={[styles.titleWrap, wide && { flexDirection: "row-reverse", alignItems: "center" }]}>
      <View style={[styles.titleArt, wide && { flex: 0.8 }]}>
        <Scale angle={tilt} size={wide ? 340 : 180} left={C.p1} right={C.p2} />
      </View>
      <View style={[{ gap: 6 }, wide && { flex: 1.2 }]}>
        <View style={styles.langRow} accessibilityRole="radiogroup" accessibilityLabel={t("Dil")}>
          {LANGS.map((l, i) => (
            <React.Fragment key={l.id}>
              {i > 0 && <Text style={styles.langSep}>·</Text>}
              <Pressable accessibilityRole="radio" accessibilityState={{ checked: lang === l.id }} accessibilityLabel={l.name} onPress={() => chooseLang(l.id)}
                style={[styles.langBtn, lang === l.id && styles.langOn]}>
                <Text style={[styles.langText, lang === l.id && styles.langTextOn]}>{l.label}</Text>
              </Pressable>
            </React.Fragment>
          ))}
        </View>
        <View style={styles.accRow}>
          {account ? (
            <>
              <Text style={styles.accHello}>{t("Av. {ad}", { ad: account.adSoyad })}</Text>
              <Pressable accessibilityRole="button" onPress={onAccount}><Text style={styles.accLink}>{server ? t("Hesap") : t("Oyuncu değiştir")}</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={onSignOut}><Text style={styles.accLink}>{t("Çıkış")}</Text></Pressable>
            </>
          ) : (
            <Pressable accessibilityRole="button" onPress={onAccount}><Text style={styles.accLink}>{server ? t("Giriş yap ›") : t("Oyuncu oluştur / seç ›")}</Text></Pressable>
          )}
        </View>
        <Text style={styles.eyebrow}>{t("BİR AVUKATLIK OYUNU")}</Text>
        <Text style={[styles.logo, { fontSize: wide ? 128 : 84, lineHeight: wide ? 120 : 82 }]}>Celse</Text>
        <Text style={styles.byline}>BY THEMISCODE</Text>
        <Text style={styles.lede}>{t("Genç bir avukat olarak sulh ve asliye mahkemelerinde başlayın; davaları kazandıkça Yargıtay'a, Danıştay'a, Anayasa Mahkemesi'ne ve Strazburg'a yükselin.")}</Text>
        <View style={styles.facts}>
          <Text style={styles.fact}><Text style={styles.factB}>{duelCount}</Text> {t("karşılıklı dava")}</Text>
          <Text style={styles.fact}><Text style={styles.factB}>{soloCount}</Text> {t("tek kişilik dosya")}</Text>
          {tahkimCount > 0 && <Text style={styles.fact}><Text style={styles.factB}>{tahkimCount}</Text> {t("tahkim ve komisyon dosyası")}</Text>}
          <Text style={styles.fact}><Text style={styles.factB}>2</Text> {t("oyuncu ya da bilgisayara karşı")}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onCareer} style={({ pressed }) => [styles.careerCard, pressed && { opacity: 0.85 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.careerK}>{account ? t("KARİYER · {won}/{total} DAVA KAZANILDI", { won, total }) : t("KARİYER")}</Text>
            <Text style={styles.careerRank}>{account ? rankName : server ? t("Giriş yapın, devam edin") : t("Oyuncu seçin, başlayın")}</Text>
          </View>
          <Text style={styles.careerGo}>{!account ? (server ? t("Giriş yap ›") : t("Başla ›")) : started ? t("Devam et ›") : t("Başla ›")}</Text>
        </Pressable>
        {!account && server && (
          <Pressable accessibilityRole="button" onPress={onSignUp} style={{ alignSelf: "flex-start", paddingVertical: 4 }}>
            <Text style={styles.signUp}>{t("Hesabınız yok mu?")} <Text style={styles.signUpB}>{t("Üye olun ›")}</Text></Text>
          </Pressable>
        )}
        {account && (
          <Pressable accessibilityRole="button" onPress={onOffice} style={({ pressed }) => [styles.officeCard, pressed && { opacity: 0.85 }]}>
            {office && <AvatarFace k={office.avatar} size={44} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.careerK}>{office ? t("BÜRO · {sehir} · {ay}. AY", { sehir: (CITIES.find(c => c.id === office.city)?.name || "").toLocaleUpperCase("tr"), ay: office.month }) : t("BÜRO")}</Text>
              <Text style={styles.officeT}>{office ? t("Kasa {tutar}", { tutar: tl(office.cash) }) : t("Karakterinizi seçin, büronuzu açın")}</Text>
            </View>
            <Text style={styles.careerGo}>{office ? t("Büro ›") : t("Aç ›")}</Text>
          </Pressable>
        )}
        <Text style={styles.fact}>{t("Kariyerde bütün dosyalar (tek kişilik, karşılıklı, tahkim) büronuza iş olarak gelir; karşılıklı dosyaları bilgisayara, arkadaşınıza ya da internetten bir rakibe karşı oynarsınız ve sonuç kazancınıza işler.")}</Text>
        <View style={styles.cta}>
          <Text style={[styles.eyebrow, { width: "100%" }]}>{t("ANTRENMAN · SONUÇLAR KARİYERE İŞLEMEZ")}</Text>
          <Btn kind="secondary" label={t("Tek kişilik dosyalar")} onPress={onSolo} />
          <Btn kind="secondary" label={t("Karşılıklı duruşma")} onPress={onDuel} />
          <Btn kind="secondary" label={t("Tahkim ve komisyonlar")} onPress={onTahkim} />
          <Btn kind="secondary" label={t("İnternet üzerinden oyna")} onPress={onOnline} />
        </View>
        <Pressable accessibilityRole="button" onPress={() => setView(view === "gercek" ? "cizim" : "gercek")} style={styles.adminLink}>
          <Text style={styles.adminLinkText}>{t("Görünüm")}: {view === "gercek" ? t("Gerçekçi ⇄ Çizime geç") : t("Çizim ⇄ Gerçekçiye geç")}</Text>
        </Pressable>
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: music }} onPress={() => setMusic(!music)} style={styles.adminLink}>
          <Text style={styles.adminLinkText}>{t("Fon müziği")}: {music ? t("Açık ♪ (kapat)") : t("Kapalı (aç)")}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onAdmin} style={styles.adminLink}>
          <Text style={styles.adminLinkText}>{t("Yönetim paneli ›")}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/* ---------- Dosya dolabı ---------- */
export function CaseListScreen({ mode, cases, onPick, onBack, onSwitch, lockedNote, onLocked }: { mode: "duel" | "solo"; cases: CaseFile[]; onPick: (c: CaseFile) => void; onBack: () => void; onSwitch: () => void; lockedNote?: (c: CaseFile) => string | undefined; onLocked?: (c: CaseFile) => void }) {
  const [res, setRes] = useState<Record<string, SavedResult>>({});
  useEffect(() => { loadResults().then(setRes); }, [mode]);
  const { width } = useWindowDimensions();
  const cols = width >= 1000 ? 3 : width >= 640 ? 2 : 1;
  const duel = mode === "duel";
  return (
    <ScrollView contentContainerStyle={styles.listWrap}>
      <View style={styles.listHead}>
        <Btn kind="ghost" label={t("‹ Giriş")} onPress={onBack} />
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text style={styles.eyebrow}>{t("ANTRENMAN · SONUÇLAR KARİYERE İŞLEMEZ")}</Text>
          <Text style={styles.listTitle}>{duel ? t("Karşılıklı duruşma") : t("Tek kişilik dosyalar")}</Text>
          <Text style={styles.listSub}>{duel ? t("Aynı davada iki vekil sırayla hamle yapar. Arkadaşınızla aynı cihazda ya da bilgisayara karşı oynayın.") : t("Tek bir rol üstlenin; karşı taraf ve hâkim hazır bekliyor.")}</Text>
        </View>
        <Btn kind="ghost" label={duel ? t("Tek kişilik ›") : t("Karşılıklı ›")} onPress={onSwitch} />
      </View>
      <View style={styles.folders}>
        {cases.map(c => {
          const r = res[c.id];
          const lock = lockedNote?.(c);
          return (
            <Pressable key={c.id} onPress={() => (lock ? onLocked?.(c) : onPick(c))} disabled={!!lock && !onLocked} accessibilityRole="button" accessibilityState={{ disabled: !!lock }}
              style={({ pressed }) => [{ width: `${100 / cols - (cols > 1 ? 2 : 0)}%` as any }, lock && { opacity: 0.5 }, pressed && { transform: [{ translateY: -3 }] }]}>
              <View style={[styles.tab, { backgroundColor: c.color }]}><Text style={styles.tabText}>{c.esas}</Text></View>
              <View style={[styles.folder, { backgroundColor: c.color }]}>
                <Text style={styles.fArea}>{c.area.toLocaleUpperCase("tr")}{c.difficulty ? `  ·  ${t(DIFFICULTY[c.difficulty].label).toLocaleUpperCase(locale())}` : ""}</Text>
                <Text style={styles.fTitle}>{c.title}</Text>
                <Text style={styles.fCourt}>{c.court}</Text>
                <Text style={styles.fTeaser}>{c.teaser}</Text>
                <View style={styles.fMeta}>
                  <Text style={styles.fRole}>{duel ? `${c.sides.p1.role} ⇄ ${c.sides.p2.role}` : t("Rol: {rol}", { rol: c.sides.p1.role })}</Text>
                  {!!c.bench && c.bench.judges > 1 && <Text style={styles.fBench}>{t("Heyet: {heyet}", { heyet: c.bench.title || t("{n} hâkim", { n: c.bench.judges }) })}</Text>}
                  <View style={[styles.status, !lock && r && r.tone === "win" && styles.statusWin, !lock && r && r.tone === "lose" && styles.statusLose]}>
                    <Text style={styles.statusText}>{lock ? `🔒 ${lock}` : r ? t("Son: {sonuc}", { sonuc: r.text }) : t("Oynanmadı")}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

/* ---------- Karşılıklı duruşma kurulumu ---------- */
function Seg({ options, value, onChange }: { options: { v: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.seg}>
      {options.map(o => (
        <Pressable key={o.v} accessibilityRole="radio" accessibilityState={{ checked: value === o.v }} onPress={() => onChange(o.v)}
          style={[styles.segItem, value === o.v && styles.segOn]}>
          <Text style={[styles.segText, value === o.v && { color: C.paper }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** fixedSide: kariyerden açılan dosyada büronun tarafı sabittir (rol seçilmez); meName oyuncunun adı. */
export function SetupModal({ c, onClose, onStart, onOnline, fixedSide, meName, career }: { c: CaseFile | null; onClose: () => void; onStart: (p: Record<Side, Player>) => void; onOnline?: (side: Side, open: boolean) => Promise<void>; fixedSide?: Side; meName?: string; career?: boolean }) {
  const [opp, setOpp] = useState(fixedSide ? "ai" : "friend");
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [n1, setN1] = useState(""), [n2, setN2] = useState("");
  const [side, setSide] = useState<Side>("p1");
  const [lvl, setLvl] = useState<"easy" | "hard">("easy");
  if (!c) return null;
  const mySide: Side = fixedSide || side;
  const start = async () => {
    if (opp === "online" && onOnline) {
      setBusy(true); setErr("");
      try { await onOnline(mySide, open); } catch (e) { setErr((e as Error).message); }
      setBusy(false); return;
    }
    if (opp === "friend" && fixedSide) {
      const me: Player = { name: meName || t("Siz"), ai: false }, fr: Player = { name: (fixedSide === "p1" ? n2 : n1).trim() || t("Arkadaşınız"), ai: false };
      return onStart(fixedSide === "p1" ? { p1: me, p2: fr } : { p1: fr, p2: me });
    }
    if (opp === "friend") return onStart({ p1: { name: n1.trim() || t("Oyuncu 1"), ai: false }, p2: { name: n2.trim() || t("Oyuncu 2"), ai: false } });
    const ai: Player = { name: lvl === "hard" ? t("Usta Bilgisayar") : t("Çaylak Bilgisayar"), ai: true, level: lvl };
    const me: Player = { name: meName || t("Siz"), ai: false };
    onStart(mySide === "p1" ? { p1: me, p2: ai } : { p1: ai, p2: me });
  };
  const roleSeg = (label: string) => fixedSide
    ? <><Text style={styles.legend}>{label}</Text><Text style={styles.sheetSub}>{c.sides[fixedSide].role}{career ? " · " + t("büronuza gelen taraf") : ""}</Text></>
    : <><Text style={styles.legend}>{label}</Text><Seg value={side} onChange={v => setSide(v as Side)} options={[{ v: "p1", label: c.sides.p1.role }, { v: "p2", label: c.sides.p2.role }]} /></>;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>{c.title}</Text>
          <Text style={styles.sheetSub}>{c.court} · {c.esas}</Text>
          {career && <Text style={styles.sheetSub}>{t("Kariyer dosyası: sonuç ücretinize ve itibarınıza işler. Rakibiniz kim olursa olsun siz büronuzun tarafını savunursunuz.")}</Text>}
          <Text style={styles.legend}>{t("RAKİBİNİZ")}</Text>
          <Seg value={opp} onChange={setOpp} options={[{ v: "friend", label: t("Arkadaşım (aynı cihaz)") }, { v: "online", label: t("İnternet üzerinden") }, { v: "ai", label: t("Bilgisayar") }]} />
          {opp === "online" ? (
            <View style={{ gap: 10, marginTop: 14 }}>
              {roleSeg(t("ROLÜNÜZ"))}
              <Text style={styles.legend}>{t("DAVET")}</Text>
              <Seg value={open ? "acik" : "kod"} onChange={v => setOpen(v === "acik")} options={[{ v: "acik", label: t("Herkese açık + kod") }, { v: "kod", label: t("Yalnız kodla") }]} />
              <Text style={styles.sheetSub}>{t("Davet kodu oluşur; rakibiniz kodla ya da açık davetler listesinden katılır. Hesabınızla giriş yapmış olmalısınız.")}</Text>
              {!!err && <Text style={[styles.sheetSub, { color: C.bad }]}>{t(err)}</Text>}
            </View>
          ) : opp === "friend" && fixedSide ? (
            <View style={{ gap: 10, marginTop: 14 }}>
              {roleSeg(t("ROLÜNÜZ"))}
              <Text style={styles.legend}>{t("ARKADAŞINIZ · {rol}", { rol: c.sides[fixedSide === "p1" ? "p2" : "p1"].role.toLocaleUpperCase(locale()) })}</Text>
              <TextInput style={styles.input} value={fixedSide === "p1" ? n2 : n1} onChangeText={fixedSide === "p1" ? setN2 : setN1} placeholder={t("Arkadaşınız")} placeholderTextColor={C.inkSoft} maxLength={18} />
            </View>
          ) : opp === "friend" ? (
            <View style={{ gap: 10, marginTop: 14 }}>
              <Text style={styles.legend}>{t("OYUNCU 1 · {rol}", { rol: c.sides.p1.role.toLocaleUpperCase(locale()) })}</Text>
              <TextInput style={styles.input} value={n1} onChangeText={setN1} placeholder={t("Oyuncu 1")} placeholderTextColor={C.inkSoft} maxLength={18} />
              <Text style={styles.legend}>{t("OYUNCU 2 · {rol}", { rol: c.sides.p2.role.toLocaleUpperCase(locale()) })}</Text>
              <TextInput style={styles.input} value={n2} onChangeText={setN2} placeholder={t("Oyuncu 2")} placeholderTextColor={C.inkSoft} maxLength={18} />
            </View>
          ) : (
            <View style={{ gap: 10, marginTop: 14 }}>
              {roleSeg(t("ROLÜNÜZ"))}
              <Text style={styles.legend}>{t("RAKİP SEVİYESİ")}</Text>
              <Seg value={lvl} onChange={v => setLvl(v as "easy" | "hard")} options={[{ v: "easy", label: t("Çaylak") }, { v: "hard", label: t("Usta") }]} />
            </View>
          )}
          <View style={styles.sheetActions}>
            <Btn kind="ghostInk" label={t("Vazgeç")} onPress={onClose} />
            <Btn label={opp === "online" ? (busy ? t("Davet açılıyor…") : t("Davet aç ›")) : t("Duruşmayı başlat")} onPress={start} disabled={busy} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  titleWrap: { flexGrow: 1, justifyContent: "center", width: "100%", maxWidth: 1080, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 32, gap: 24 },
  titleArt: { alignItems: "center" },
  eyebrow: { fontFamily: F.mono, fontSize: 12, letterSpacing: 2.5, color: C.muted },
  logo: { fontFamily: F.display, color: C.brass },
  lede: { fontFamily: F.body, fontSize: 19, lineHeight: 27, color: "#d9d5ca", maxWidth: 480, marginTop: 8 },
  facts: { flexDirection: "row", flexWrap: "wrap", columnGap: 18, rowGap: 4, marginVertical: 14 },
  fact: { fontFamily: F.body, fontSize: 15, color: C.muted },
  factB: { fontFamily: F.monoBold, color: C.text },
  adminLink: { alignSelf: "flex-start", paddingVertical: 8, marginTop: 6 },
  adminLinkText: { fontFamily: F.mono, fontSize: 12, letterSpacing: 1, color: C.muted },
  langRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4, marginBottom: 4 },
  langBtn: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  langOn: { backgroundColor: C.brass, borderColor: C.brass },
  langText: { fontFamily: F.mono, fontSize: 12, letterSpacing: 1, color: C.muted },
  langTextOn: { fontFamily: F.monoBold, color: C.brassInk },
  langSep: { fontFamily: F.mono, fontSize: 12, color: C.line },
  accRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14, marginBottom: 6 },
  accHello: { fontFamily: F.bodyMed, fontSize: 15, color: C.textSoft },
  accLink: { fontFamily: F.mono, fontSize: 12, letterSpacing: 1, color: C.brass },
  byline: { fontFamily: F.monoBold, fontSize: 12, letterSpacing: 4, color: C.brassDim, marginTop: -2, marginBottom: 6 },
  careerCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.brass, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 14, marginBottom: 12, maxWidth: 480 },
  officeCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 8 },
  officeT: { fontFamily: F.displayMed, fontSize: 19, color: C.text },
  careerK: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: C.brassInk, opacity: 0.8 },
  careerRank: { fontFamily: F.display, fontSize: 26, color: C.brassInk },
  signUp: { fontFamily: F.body, fontSize: 15, color: C.muted },
  signUpB: { fontFamily: F.bodyBold, color: C.text, textDecorationLine: "underline" },
  careerGo: { fontFamily: F.bodyBold, fontSize: 17, color: C.brassInk },
  cta: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  listWrap: { width: "100%", maxWidth: 1080, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 20 },
  listHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 14, marginBottom: 24 },
  listTitle: { fontFamily: F.display, fontSize: 32, color: C.brass },
  listSub: { fontFamily: F.body, fontSize: 16, color: C.muted, marginTop: 2 },
  folders: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 22 },
  tab: { alignSelf: "flex-start", marginLeft: 14, paddingHorizontal: 14, paddingVertical: 6, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  tabText: { fontFamily: F.mono, fontSize: 12, color: "#f3efe4" },
  folder: { borderRadius: 10, padding: 18, gap: 8, minHeight: 250, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  fArea: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: "rgba(243,239,228,0.8)" },
  fTitle: { fontFamily: F.display, fontSize: 28, color: "#f3efe4" },
  fCourt: { fontFamily: F.body, fontSize: 15, color: "rgba(243,239,228,0.85)" },
  fTeaser: { fontFamily: F.body, fontSize: 16, lineHeight: 22, color: "rgba(243,239,228,0.9)" },
  fMeta: { marginTop: "auto", paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.18)", gap: 8 },
  fBench: { fontFamily: F.mono, fontSize: 11, color: "rgba(243,239,228,0.8)" },
  fRole: { fontFamily: F.bodyBold, fontSize: 14, color: "#f3efe4" },
  status: { alignSelf: "flex-start", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  statusWin: { backgroundColor: "rgba(79,174,124,0.25)", borderColor: "rgba(79,174,124,0.6)" },
  statusLose: { backgroundColor: "rgba(214,90,69,0.25)", borderColor: "rgba(214,90,69,0.6)" },
  statusText: { fontFamily: F.mono, fontSize: 11, color: "#f3efe4" },
  overlay: { flex: 1, backgroundColor: "rgba(5,8,10,0.72)", alignItems: "center", justifyContent: "center", padding: 16 },
  sheet: { backgroundColor: C.paper, borderRadius: 4, padding: 22, width: "100%", maxWidth: 560 },
  sheetTitle: { fontFamily: F.display, fontSize: 26, color: C.ink },
  sheetSub: { fontFamily: F.mono, fontSize: 12, color: C.inkSoft, marginBottom: 16 },
  legend: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: C.inkSoft, marginBottom: 2 },
  seg: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  segItem: { borderWidth: 1, borderColor: C.rule, backgroundColor: C.paperHi, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  segOn: { backgroundColor: C.ink, borderColor: C.ink },
  segText: { fontFamily: F.body, fontSize: 15, color: C.ink },
  input: { fontFamily: F.body, fontSize: 16, borderWidth: 1, borderColor: C.rule, borderRadius: 6, backgroundColor: C.paperHi, color: C.ink, paddingHorizontal: 12, paddingVertical: 10 },
  sheetActions: { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: 10, marginTop: 20 }
});
