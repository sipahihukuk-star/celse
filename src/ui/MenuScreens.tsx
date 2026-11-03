import React, { useEffect, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useVoiceEnabled } from "./voice";
import { Platform, Share } from "react-native";
import { StoreLinks } from "./StoreLinks";
import { DOWNLOAD_URL, WEB_URL } from "../data/settings";
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
export interface TitleProps {
  onCareer: () => void; onOffice: () => void; office: Office | null; onAccount: () => void; onSignUp: () => void; onSignIn: () => void; onSignOut: () => void;
  account: Account | null; server: boolean; started: boolean; onDuel: () => void; onSolo: () => void; onAdmin: () => void; onTahkim: () => void; onHistory: () => void; onCharacter: () => void; onBoard: () => void;
  /** sunucuda yönetici olan hesap: yönetim paneli yalnız ona görünür */ isAdmin?: boolean;
  /** Celse Pro ekranı (abonelik, geri yükleme) ve Pro etkin mi */ onPro?: () => void; pro?: boolean;
  onMap: () => void; tahkimCount: number; duelCount: number; soloCount: number; rankName: string; won: number; total: number;
}
export function TitleScreen(p: TitleProps) {
  const { width } = useWindowDimensions();
  const [tilt, setTilt] = useState(-4);
  const [menu, setMenu] = useState(false);
  useEffect(() => { const id = setInterval(() => setTilt(a => -a), 3000); return () => clearInterval(id); }, []);
  const wide = width >= 760;
  const { account, server, office } = p;
  return (
    <View style={{ flex: 1 }}>
      {/* Üst şerit: solda menü, sağda üyelik */}
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Menü")} onPress={() => setMenu(true)} style={styles.burger} hitSlop={10}>
          <View style={styles.burgerLine} /><View style={styles.burgerLine} /><View style={styles.burgerLine} />
        </Pressable>
        {p.isAdmin && (
          <Pressable accessibilityRole="button" accessibilityLabel={t("Yönetim paneli")} onPress={p.onAdmin} style={styles.adminBtn} hitSlop={8}>
            <Text style={styles.adminBtnT}>⚙ {t("Yönetim")}</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        {account ? (
          <Pressable accessibilityRole="button" onPress={p.onAccount} style={styles.accChip}>
            <Text style={styles.accChipT} numberOfLines={1}>{t("Av. {ad}", { ad: account.adSoyad })}</Text>
          </Pressable>
        ) : (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn kind="ghost" label={server ? t("Giriş yap") : t("Oyuncu seç")} onPress={p.onSignIn} />
            <Btn label={server ? t("Üye ol") : t("Yeni oyuncu")} onPress={p.onSignUp} />
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.titleWrap, wide && { flexDirection: "row-reverse", alignItems: "center" }]}>
        <View style={[styles.titleArt, wide && { flex: 0.8 }]}>
          <Scale angle={tilt} size={wide ? 320 : 150} left={C.p1} right={C.p2} />
        </View>
        <View style={[{ gap: 6 }, wide && { flex: 1.2 }]}>
          <Text style={styles.eyebrow}>{t("BİR AVUKATLIK OYUNU")}</Text>
          <Text style={[styles.logo, { fontSize: wide ? 104 : 68, lineHeight: wide ? 112 : 76 }]}>Celse</Text>
          <Text style={styles.byline}>BY THEMISCODE</Text>
          <Text style={styles.lede}>{t("Genç bir avukat olarak sulh ve asliye mahkemelerinde başlayın; davaları kazandıkça Yargıtay'a, Danıştay'a, Anayasa Mahkemesi'ne ve Strazburg'a yükselin.")}</Text>

          <Pressable accessibilityRole="button" onPress={p.onCareer} style={({ pressed }) => [styles.careerCard, { marginTop: 14 }, pressed && { opacity: 0.85 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.careerK}>{account ? t("KARİYER · {won}/{total} DAVA KAZANILDI", { won: p.won, total: p.total }) : t("KARİYER")}</Text>
              <Text style={styles.careerRank}>{account ? t(p.rankName) : server ? t("Giriş yapın, devam edin") : t("Oyuncu seçin, başlayın")}</Text>
            </View>
            <Text style={styles.careerGo}>{!account ? (server ? t("Giriş yap ›") : t("Başla ›")) : p.started ? t("Devam et ›") : t("Başla ›")}</Text>
          </Pressable>
          {account && (
            <Pressable accessibilityRole="button" onPress={p.onOffice} style={({ pressed }) => [styles.officeCard, pressed && { opacity: 0.85 }]}>
              {office && <AvatarFace k={office.avatar} size={44} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.careerKDark}>{office ? t("BÜRO · {sehir} · {ay}. AY", { sehir: (CITIES.find(c => c.id === office.city)?.name || "").toLocaleUpperCase("tr"), ay: office.month }) : t("BÜRO")}</Text>
                <Text style={styles.officeT}>{office ? t("Kasa {tutar}", { tutar: tl(office.cash) }) : t("Karakterinizi seçin, büronuzu açın")}</Text>
              </View>
              <Text style={styles.careerGoDark}>{office ? t("Büro ›") : t("Aç ›")}</Text>
            </Pressable>
          )}

          <Pressable accessibilityRole="button" onPress={p.onBoard} style={({ pressed }) => [styles.boardLink, pressed && { opacity: 0.8 }]}>
            <Text style={styles.boardIcon}>🏆</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.careerKDark}>{t("LİDERLİK PANOSU")}</Text>
              <Text style={styles.boardT}>{t("Diğer avukatlarla yarışın")}</Text>
            </View>
            <Text style={styles.careerGoDark}>{t("Sıralama ›")}</Text>
          </Pressable>

          <Text style={[styles.eyebrow, { marginTop: 18 }]}>{t("ANTRENMAN · SONUÇLAR KARİYERE İŞLEMEZ")}</Text>
          <View style={styles.cta}>
            <Btn kind="secondary" label={t("Tek kişilik dosyalar") + ` · ${p.soloCount}`} onPress={p.onSolo} />
            <Btn kind="secondary" label={t("Karşılıklı duruşma") + ` · ${p.duelCount}`} onPress={p.onDuel} />
            <Btn kind="secondary" label={t("Tahkim ve komisyonlar") + ` · ${p.tahkimCount}`} onPress={p.onTahkim} />
          </View>
          <Text style={styles.fact}>{t("Kariyerde bütün dosyalar (tek kişilik, karşılıklı, tahkim) büronuza iş olarak gelir; karşılıklı dosyaları bilgisayara, arkadaşınıza ya da internetten bir rakibe karşı oynarsınız ve sonuç kazancınıza işler.")}</Text>
          {Platform.OS === "web" ? <StoreLinks /> : (
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(WEB_URL)} style={({ pressed }) => [styles.webLink, pressed && { opacity: 0.8 }]}>
              <Text style={styles.webIcon}>🌐</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.careerKDark}>{t("WEB SÜRÜMÜ · BİLGİSAYARDAN DA OYNAYIN")}</Text>
                <Text style={styles.webUrl}>{WEB_URL.replace(/^https:\/\//, "").replace(/\/$/, "")}</Text>
                <Text style={styles.webNote}>{t("Uygulama açılmazsa bu adresten aynı hesapla girip kaldığınız yerden devam edebilirsiniz.")}</Text>
              </View>
              <Text style={styles.careerGoDark}>›</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
      <SideMenu visible={menu} onClose={() => setMenu(false)} {...p} />
    </View>
  );
}

/** Sol üstteki ☰ menü: hesap, geçmiş ve kazanç, ayarlar (dil, görünüm, müzik, seslendirme), gizlilik, yönetim. */
function SideMenu({ visible, onClose, ...p }: TitleProps & { visible: boolean; onClose: () => void }) {
  const [view, setView] = useViewMode();
  const [music, setMusic] = useMusic();
  const [voice, setVoice] = useVoiceEnabled();
  const [lang, chooseLang] = useLang();
  const go = (f: () => void) => () => { onClose(); f(); };
  const Item = ({ label, sub, onPress }: { label: string; sub?: string; onPress: () => void }) => (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.mItem, pressed && { backgroundColor: C.panel2 }]}>
      <Text style={styles.mItemT}>{label}</Text>
      {!!sub && <Text style={styles.mItemS}>{sub}</Text>}
    </Pressable>
  );
  const Toggle = ({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) => (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} onPress={() => set(!on)} style={styles.mItem}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={styles.mItemT}>{label}</Text>
        <View style={[styles.sw, on && styles.swOn]}><View style={[styles.swDot, on && { alignSelf: "flex-end", backgroundColor: C.brassInk }]} /></View>
      </View>
    </Pressable>
  );
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, flexDirection: "row" }}>
        <View style={styles.drawer}>
          <ScrollView contentContainerStyle={{ paddingVertical: 18, gap: 4 }}>
            <View style={styles.mHead}>
              <Text style={styles.mLogo}>Celse</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t("Kapat")} onPress={onClose} hitSlop={10}><Text style={styles.mClose}>✕</Text></Pressable>
            </View>
            <Text style={styles.mSection}>{t("HESAP")}</Text>
            {p.account ? (
              <>
                <Item label={t("Av. {ad}", { ad: p.account.adSoyad })} sub={t("Hesap bilgileri, çıkış, hesabı silme")} onPress={go(p.onAccount)} />
                <Item label={t("Çıkış yap")} onPress={go(p.onSignOut)} />
              </>
            ) : (
              <>
                <Item label={p.server ? t("Giriş yap") : t("Oyuncu seç")} onPress={go(p.onSignIn)} />
                <Item label={p.server ? t("Üye ol") : t("Yeni oyuncu")} onPress={go(p.onSignUp)} />
              </>
            )}
            {!!p.onPro && <Item label={t("Celse Pro")} sub={p.pro ? t("Aboneliğiniz etkin") : t("Bütün kariyer · aylık ya da yıllık abonelik")} onPress={go(p.onPro)} />}
            <Text style={styles.mSection}>{t("KARİYER")}</Text>
            <Item label={t("Liderlik panosu")} sub={t("Kariyer puanına göre en iyi avukatlar")} onPress={go(p.onBoard)} />
            <Item label={t("Karakterim")} sub={t("Kendinizi tarif edin, duruşmadaki yüzünüzü seçin")} onPress={go(p.onCharacter)} />
            <Item label={t("Geçmiş dosyalar ve başarı")} sub={t("Kazanılan ve kaybedilen davalar, puanlar, unvan")} onPress={go(p.onHistory)} />
            <Item label={t("Büro, kasa ve kazanç")} sub={t("Gelir-gider defteri, giderler, mesleki gelişim")} onPress={go(p.onOffice)} />
            <Item label={t("Kariyer haritası")} onPress={go(p.onMap)} />
            <Text style={styles.mSection}>{t("AYARLAR")}</Text>
            <View style={[styles.mItem, { flexDirection: "row", flexWrap: "wrap", gap: 6 }]}>
              {LANGS.map(l => (
                <Pressable key={l.id} accessibilityRole="radio" accessibilityState={{ checked: lang === l.id }} accessibilityLabel={l.name} onPress={() => chooseLang(l.id)}
                  style={[styles.langBtn, lang === l.id && styles.langOn]}>
                  <Text style={[styles.langText, lang === l.id && styles.langTextOn]}>{l.label}</Text>
                </Pressable>
              ))}
            </View>
            <Toggle label={t("Gerçekçi görünüm")} on={view === "gercek"} set={v => setView(v ? "gercek" : "cizim")} />
            <Toggle label={t("Seslendirme")} on={voice} set={setVoice} />
            <Toggle label={t("Fon müziği")} on={music} set={setMusic} />
            <Text style={styles.mSection}>{t("DİĞER")}</Text>
            {Platform.OS !== "web" && <Item label={t("Web sürümü")} sub={t("Bilgisayarda büyük ekranda oynayın")} onPress={() => Linking.openURL(WEB_URL)} />}
            <Item label={t("Celse'yi paylaş")} sub={t("iPhone, Android ve web bağlantısı")} onPress={() => Share.share({ message: t("Celse: avukatlık oyunu. İndirin ya da tarayıcıda oynayın: {url}", { url: DOWNLOAD_URL }) })} />
            <Item label={t("Gizlilik politikası")} onPress={() => Linking.openURL("https://sipahihukuk-star.github.io/celse/gizlilik.html")} />
            {p.isAdmin && <Item label={t("Yönetim paneli")} sub={t("Yalnızca yönetici hesabında görünür")} onPress={go(p.onAdmin)} />}
            <Text style={[styles.byline, { marginTop: 18, paddingHorizontal: 18 }]}>BY THEMISCODE</Text>
          </ScrollView>
        </View>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }} onPress={onClose} accessibilityLabel={t("Kapat")} />
      </View>
    </Modal>
  );
}

export function CaseListScreen({ mode, cases, onPick, onBack, onSwitch, lockedNote, onLocked, onOnline }: { mode: "duel" | "solo"; cases: CaseFile[]; onPick: (c: CaseFile) => void; onBack: () => void; onSwitch: () => void; lockedNote?: (c: CaseFile) => string | undefined; onLocked?: (c: CaseFile) => void; onOnline?: () => void }) {
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
          <Text style={styles.listSub}>{duel ? t("Aynı davada iki vekil sırayla hamle yapar. Bir dosya seçip rakibinizi belirleyin: aynı cihazda bir arkadaşınız, bilgisayar ya da internetten başka bir avukat.") : t("Tek bir rol üstlenin; karşı taraf ve hâkim hazır bekliyor.") + " " + t("Kariyerde ulaştığınız mahkemelerin dosyaları açıktır; üst mahkemeler kariyerde dava kazandıkça açılır.")}</Text>
        </View>
        <Btn kind="ghost" label={duel ? t("Tek kişilik ›") : t("Karşılıklı ›")} onPress={onSwitch} />
      </View>
      {duel && onOnline && (
        <Pressable accessibilityRole="button" onPress={onOnline} style={({ pressed }) => [styles.onlineBar, pressed && { opacity: 0.85 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.onlineK}>{t("İNTERNET ÜZERİNDEN")}</Text>
            <Text style={styles.onlineT}>{t("Davet koduyla katılın ya da açık davetlerden birini seçin")}</Text>
          </View>
          <Text style={styles.careerGoDark}>{t("Lobi ›")}</Text>
        </Pressable>
      )}
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
          <Text style={styles.sheetSub}>{opp === "friend" ? t("Aynı cihaz: iki taraf da bu telefonda oynanır; sıra değişince telefonu arkadaşınıza verirsiniz. Ayrı telefonlardan oynamak için \"İnternet üzerinden\"i seçin.")
            : opp === "online" ? t("Ayrı telefonlar: her avukat yalnızca kendi tarafının sorularını kendi telefonunda cevaplar.") : t("Karşı tarafı bilgisayar oynar.")}</Text>
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
  titleWrap: { flexGrow: 1, justifyContent: "center", width: "100%", maxWidth: 1080, alignSelf: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 18 },
  topBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, width: "100%", maxWidth: 1080, alignSelf: "center" },
  adminBtn: { marginLeft: 10, height: 40, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: C.brassDim, alignItems: "center", justifyContent: "center", backgroundColor: C.panel2 },
  adminBtnT: { fontFamily: F.bodyBold, fontSize: 14, color: C.brass },
  burger: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center", gap: 5 },
  burgerLine: { width: 20, height: 2, borderRadius: 1, backgroundColor: C.text },
  accChip: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, maxWidth: 220 },
  accChipT: { fontFamily: F.bodyMed, fontSize: 14, color: C.text },
  drawer: { width: "82%", maxWidth: 360, backgroundColor: C.wallDeep, borderRightWidth: 1, borderRightColor: C.line },
  mHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, marginBottom: 6 },
  mLogo: { fontFamily: F.logo, fontSize: 30, color: C.brass },
  mClose: { fontFamily: F.bodyBold, fontSize: 20, color: C.muted },
  mSection: { fontFamily: F.mono, fontSize: 11, letterSpacing: 2, color: C.brassDim, paddingHorizontal: 18, marginTop: 14, marginBottom: 2 },
  mItem: { paddingHorizontal: 18, paddingVertical: 11 },
  mItemT: { fontFamily: F.bodyMed, fontSize: 16, color: C.text },
  mItemS: { fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 2 },
  sw: { width: 44, height: 24, borderRadius: 12, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, padding: 2 },
  swOn: { backgroundColor: C.brass, borderColor: C.brass },
  swDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.muted },
  careerKDark: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: C.muted },
  careerGoDark: { fontFamily: F.bodyBold, fontSize: 17, color: C.brass },
  titleArt: { alignItems: "center" },
  eyebrow: { fontFamily: F.mono, fontSize: 12, letterSpacing: 2.5, color: C.muted },
  logo: { fontFamily: F.logo, color: C.brass, letterSpacing: 2 },
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
  webLink: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: C.panel, marginTop: 12 },
  webIcon: { fontSize: 24 },
  webUrl: { fontFamily: F.bodyBold, fontSize: 15, color: C.text },
  webNote: { fontFamily: F.body, fontSize: 12, color: C.muted },
  boardLink: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: C.panel },
  boardIcon: { fontSize: 26 },
  boardT: { fontFamily: F.display, fontSize: 18, color: C.text },
  officeCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 8 },
  officeT: { fontFamily: F.displayMed, fontSize: 19, color: C.text },
  careerK: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: C.brassInk, opacity: 0.8 },
  careerRank: { fontFamily: F.display, fontSize: 26, color: C.brassInk },
  signUp: { fontFamily: F.body, fontSize: 15, color: C.muted },
  signUpB: { fontFamily: F.bodyBold, color: C.text, textDecorationLine: "underline" },
  careerGo: { fontFamily: F.bodyBold, fontSize: 17, color: C.brassInk },
  cta: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  onlineBar: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: C.brass, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20, backgroundColor: C.panel },
  onlineK: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: C.brassDim },
  onlineT: { fontFamily: F.bodyMed, fontSize: 15, color: C.text },
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
