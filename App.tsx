import { YeniSurum } from "./src/ui/YeniSurum";
import { Cinzel_700Bold } from "@expo-google-fonts/cinzel/700Bold";
import { Manrope_400Regular } from "@expo-google-fonts/manrope/400Regular";
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { PlayfairDisplay_400Regular_Italic } from "@expo-google-fonts/playfair-display/400Regular_Italic";
import { PlayfairDisplay_600SemiBold } from "@expo-google-fonts/playfair-display/600SemiBold";
import { PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display/700Bold";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono/500Medium";
import { IBMPlexMono_600SemiBold } from "@expo-google-fonts/ibm-plex-mono/600SemiBold";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import { BackHandler, Platform, StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AdminScreen from "./src/admin/AdminScreen";
import { signOut, supabase, useAccount } from "./src/data/account";
import AccountScreen from "./src/ui/AccountScreen";
import CharacterScreen from "./src/ui/CharacterScreen";
import { KeyboardBar } from "./src/ui/KeyboardBar";
import { NewPassword } from "./src/ui/NewPassword";
import { BoardInvite, joinIfConsented, shouldInvite } from "./src/ui/BoardInvite";
import { useCharacter } from "./src/data/character";
import LeaderboardScreen from "./src/ui/LeaderboardScreen";
import HistoryScreen from "./src/ui/HistoryScreen";
import { useServerAdmin } from "./src/data/adminHook";
import OfficeScreen from "./src/ui/OfficeScreen";
import DeskScreen from "./src/ui/DeskScreen";
import { closeFile, useFlow } from "./src/data/flow";
import { branchOf } from "./src/data/branches";
import { hasDegree } from "./src/data/life";
import { newLife, personalCosts } from "./src/data/life";
import { CITIES, routineIncome } from "./src/data/office";
import { careerSide, feeFor, kanunYoluOdemesi, lineText, monthlyCost, settleCase, SOURCE_LABEL, sourceOf, tl, useOffice } from "./src/data/office";
import { resumeMusic } from "./src/ui/music";
import { FREE_LEVEL, usePremium } from "./src/data/subscription";
import PaywallScreen from "./src/ui/PaywallScreen";
import ShopScreen from "./src/ui/ShopScreen";
import { runInnerBack } from "./src/ui/innerBack";
import { buildCareer, CaseRecord, levelOf, openIds, Progress, recordResult, resetProgress, useProgress, CHAPTERS } from "./src/data/career";
import { appealCase, nextAppeal } from "./src/engine/appeal";
import { AppealKind } from "./src/engine/types";
import { useCases } from "./src/data/useCases";
import { GameState, other, verdict } from "./src/engine/engine";
import { CaseFile, Player, Side } from "./src/engine/types";
import CareerScreen from "./src/ui/CareerScreen";
import GameScreen from "./src/ui/GameScreen";
import { CaseListScreen, SetupModal, TitleScreen } from "./src/ui/MenuScreens";
import { C } from "./src/ui/theme";
import VerdictScreen from "./src/ui/VerdictScreen";
import ClosingScreen from "./src/ui/ClosingScreen";
import { AiVerdict } from "./src/engine/judge";
import { createMatch, leaveMatch } from "./src/data/online";
import { localizeCase } from "./src/i18n/cases";
import { t, useLang } from "./src/i18n";
import { OnlineGame, OnlineLobby, OnlineWait } from "./src/ui/OnlineScreen";
import { TahkimScreen } from "./src/ui/TahkimScreen";
import DanismaScreen from "./src/ui/DanismaScreen";
import InboxScreen from "./src/ui/InboxScreen";
import DanismaDosyaScreen from "./src/ui/DanismaDosyaScreen";
import { evrakOturumu, evrakOturumuYaz, oynananYaz } from "./src/data/evrak";
import FoyScreen from "./src/ui/FoyScreen";
import { tarihYaz } from "./src/data/foy";
import { setAktifMaske } from "./src/engine/mask/oturum";
import { kaydirmaCubugu } from "./src/ui/webScrollbar";
kaydirmaCubugu();
import { dosyaBirak, dosyaBitir, dosyaKimligi, kayitOf, TutanakSatiri } from "./src/data/danismaDosya";
import { trackRoute } from "./src/data/usage";
import { useCloudSync } from "./src/data/sync";

/** from: oyun bitince nereye dönüleceği (dosya dolabı ya da yönetim paneli önizlemesi) */
type From = "list" | "admin" | "career" | "desk" | "tahkim" | "online" | "danismaDosya" | "evrak";
type Route =
  | { k: "title" }
  | { k: "list"; mode: "duel" | "solo" }
  | { k: "tahkim" }
  | { k: "online" }
  | { k: "onlineWait"; id: string; c: CaseFile }
  | { k: "onlineGame"; id: string; c: CaseFile }
  | { k: "admin" }
  | { k: "career" }
  | { k: "office" }
  | { k: "desk" }
  | { k: "account"; then?: "career" | "paywall" | "danisma" | "magaza"; tab?: "giris" | "kayit" }
  | { k: "danisma"; evrak?: boolean; ornek?: boolean }
  | { k: "foy"; sekme?: "beyan" | "kaynak" }
  | { k: "danismaDosya" }
  | { k: "paywall" }
  | { k: "magaza" }
  | { k: "history" }
  | { k: "character" }
  | { k: "board" }
  | { k: "inbox" }
  | { k: "game"; c: CaseFile; players: Record<Side, Player>; run: number; from: From; chain?: Chain }
  | { k: "closing"; c: CaseFile; players: Record<Side, Player>; game: GameState; from: From; tutanak?: TutanakSatiri[] }
  | { k: "verdict"; c: CaseFile; players: Record<Side, Player>; game: GameState; from: From; notice?: string; ai?: AiVerdict; chain?: Chain };

/** Kanun yolu zinciri: ilk derece davası, oyuncunun tarafı, ilk derece oyunu, önceki aşama ve kariyer kaydının denemeden önceki hâli. */
type Chain = { base: CaseFile; side: Side; baseGame: GameState; prev?: { c: CaseFile; game: GameState }; before?: CaseRecord | null; me: string; kayitlar?: OncekiKayit[] };
/** Kanun yolunda önceki aşamaların tutanakları (ilk derece, istinaf…): tutanakta en üstte görünür. */
export interface OncekiKayit { baslik: string; satirlar: TutanakSatiri[] }

const SOLO_PLAYERS: Record<Side, Player> = { p1: { name: "Siz", ai: false }, p2: { name: "Karşı taraf", ai: false } };

export default function App() {
  const [loaded, error] = useFonts({
    Cinzel_700Bold, PlayfairDisplay_400Regular_Italic, PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold,
    Manrope_400Regular, Manrope_500Medium, Manrope_700Bold,
    IBMPlexMono_500Medium, IBMPlexMono_600SemiBold
  });
  // Yavaş bağlantıda (telefon) yazı tipleri gelene kadar boş ekran beklenmez: 1,2 saniye sonra sistem yazı tipiyle açılır,
  // yazı tipleri gelince kendiliğinden değişir.
  const [yaziBekleme, setYaziBekleme] = useState(false);
  React.useEffect(() => { const z = setTimeout(() => setYaziBekleme(true), 1200); return () => clearTimeout(z); }, []);
  // Doğrudan yönetim paneli: adresin sonuna ?yonetim yazılınca panel açılır (PIN yine sorulur).
  const [route, setRouteRaw] = useState<Route>(() =>
    typeof window !== "undefined" && /[?&#]yonetim\b/i.test((window.location?.search || "") + (window.location?.hash || "")) ? { k: "admin" }
      // Danışma bağlantısı (telefondan "videoyu web'de hazırla") ve "Duruşmayı izle" önizlemesi (?izle-ornek) danışma ekranını açar.
      : Platform.OS === "web" && typeof window !== "undefined" && /[?&]foy\b/.test(window.location?.search || "") ? { k: "foy", sekme: (window.location.search.match(/[?&]sekme=(beyan|kaynak)\b/) || [])[1] as "beyan" | "kaynak" | undefined }
      : Platform.OS === "web" && typeof window !== "undefined" && /[?&](danisma=|izle-ornek|evrak)/.test(window.location?.search || "") ? { k: "danisma" }
      // Web mağazası: ?magaza (sitenin "Satın al" bağlantısı)
      : Platform.OS === "web" && typeof window !== "undefined" && /[?&#]magaza\b/.test((window.location?.search || "") + (window.location?.hash || "")) ? { k: "magaza" } : { k: "title" });
  // Geri tuşu (Android'in geri tuşu, tarayıcının geri düğmesi): bir önceki ekrana döner; giriş ekranında uygulamadan çıkar.
  // Duruşma, kapanış ve karar gibi bitmiş adımlar geçmişe yazılmaz; geri tuşu onların öncesindeki listeye döndürür.
  const routeRef = React.useRef(route);
  // Evrak oturumunun kod karşılıkları yalnız evrak ekranında ve oradan açılan oyunda etkin (giden metinler yeniden kodlanır).
  React.useEffect(() => {
    if (route.k === "danisma") return; // evrak ekranı kendisi açar ve kapanınca kapatır (EvrakScreen)
    const evrakta = (route.k === "game" || route.k === "verdict") && route.from === "evrak";
    setAktifMaske(evrakta ? evrakOturumu()?.map ?? null : null);
  }, [route]);
  const stack = React.useRef<Route[]>(route.k === "admin" || route.k === "danisma" || route.k === "magaza" || route.k === "foy" ? [{ k: "title" }] : []);
  const TRANSIENT = new Set(["game", "closing", "verdict", "onlineWait", "onlineGame"]);
  const setRoute = (r: Route) => {
    const cur = routeRef.current;
    if (r.k === "title") stack.current = [];
    else if (cur.k !== r.k && !TRANSIENT.has(cur.k)) {
      stack.current = [...stack.current.filter(x => x.k !== r.k), cur].slice(-20);
      if (Platform.OS === "web" && typeof window !== "undefined") { try { window.history.pushState({ celse: stack.current.length }, ""); } catch { /* yok say */ } }
    }
    routeRef.current = r; setRouteRaw(r);
  };
  const goBack = (): boolean => {
    if (setup) { setSetup(null); return true; }
    // Ekran içi alt sayfa (ör. Yönetim'de açık panel) varsa önce o kapanır.
    if (runInnerBack()) return true;
    const prev = stack.current.pop();
    if (!prev) { if (routeRef.current.k !== "title") { routeRef.current = { k: "title" }; setRouteRaw({ k: "title" }); return true; } return false; }
    if (routeRef.current.k === "onlineGame") leaveMatch((routeRef.current as { id: string }).id).catch(() => {});
    routeRef.current = prev; setRouteRaw(prev);
    return true;
  };
  const backRef = React.useRef(goBack); backRef.current = goBack;
  React.useEffect(() => {
    if (Platform.OS === "android") {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => backRef.current());
      return () => sub.remove();
    }
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const onPop = () => { backRef.current(); };
      window.addEventListener("popstate", onPop);
      return () => window.removeEventListener("popstate", onPop);
    }
  }, []);
  const [setup, setSetup] = useState<{ c: CaseFile; from: From; side?: Side; career?: boolean } | null>(null);
  /** kariyer dosyası internet üzerinden oynanıyorsa: maç bitince sonuç büroya işlenir */
  const [careerOnline, setCareerOnline] = useState<{ matchId: string; caseId: string; side: Side; from: From } | null>(null);
  const flow = useFlow();
  const [run, setRun] = useState(0);
  const [invite, setInvite] = useState(false);
  /** "Üye olmadan dene": giriş kartını geçip oyun menüsüne misafir olarak girer (bu oturum boyunca). */
  const [guest, setGuest] = useState(false);
  const me = useCharacter();
  // Oyun davaları ayrı dosyada: dava takibi ve danışmada hiç yüklenmez, ana sayfada 6 sn sonra, oyun ekranında hemen yüklenir.
  const cases = useCases(route.k === "title" ? 6000 : ["foy", "danisma", "danismaDosya", "account", "magaza", "paywall"].includes(route.k) ? -1 : 0);
  const progress = useProgress();
  const { account } = useAccount();
  const { premium, admin: pinAdmin } = usePremium();
  // Sunucuda yönetici olan hesap (ya da yönetim paneline PIN ile giren) her şeyi kilitsiz görür.
  const srvAdmin = useServerAdmin();
  const admin = pinAdmin || srvAdmin;
  const { office } = useOffice();
  // Giriş yapan hesabın büro, dosya akışı ve karakter yüzü cihazlar arasında eşitlenir (src/data/sync.ts).
  useCloudSync();
  // Dil değişince bütün ekran yeniden çizilir.
  const [lang] = useLang();

  // Yazı tipleri yüklenemezse (ör. ağ engeli) sistem yazı tipiyle devam edilir.
  // Üyelikte panoya onay veren oyuncu ilk girişte panoya eklenir. (Kancalar erken dönüşten önce durmalı.)
  const boardInfo = React.useRef<{ sehir?: string; avatar?: string; unvan?: string }>({});
  React.useEffect(() => {
    if (account?.mode === "server") { const id = setTimeout(() => joinIfConsented(boardInfo.current), 1500); return () => clearTimeout(id); }
  }, [account?.id]);
  // Kullanım istatistiği: duruşma açılınca, karar ekranına varınca ya da yarıda bırakılınca bir olay yazılır (src/data/usage.ts).
  React.useEffect(() => { trackRoute(route, !!careerOnline); }, [route]);
  if (!loaded && !error && !yaziBekleme) return <View style={styles.root} />;

  // Tahkim dosyaları seçili dilde açılır (çevirisi varsa).
  const startGame = async (c0: CaseFile, players: Record<Side, Player>, from: From = "list", chain?: Chain) => {
    const c = await localizeCase(c0);
    setRun(r => r + 1); setRoute({ k: "game", c, players, run: run + 1, from, chain });
  };
  const toList = (mode: "duel" | "solo") => setRoute({ k: "list", mode });
  const back = (c: CaseFile, from: From) => (from === "admin" ? setRoute({ k: "admin" }) : from === "career" ? setRoute({ k: "career" }) : from === "desk" ? setRoute({ k: "desk" })
    : from === "tahkim" ? setRoute({ k: "tahkim" }) : from === "online" ? setRoute({ k: "online" }) : from === "danismaDosya" ? setRoute({ k: "danismaDosya" }) : from === "evrak" ? setRoute({ k: "danisma", evrak: true }) : toList(c.mode));
  const fromOf = (c: CaseFile): From => (c.room === "tahkim" ? "tahkim" : "list");
  const findCase = (id: string) => cases.all.find(x => x.id === id);
  const dr = hasDegree(office?.life, "dr");
  // Ücretsiz sürüm: kariyerin ilk bölümü. Pro ya da yönetici her bölümü açık görür.
  const unlocked = premium || admin;
  const career = buildCareer(cases.career, progress, unlocked, FREE_LEVEL, { dr });
  boardInfo.current = { sehir: office ? CITIES.find(x => x.id === office.city)?.name : undefined, avatar: office?.avatar || me?.avatar, unvan: career.rank };
  const lockOf = new Map(career.chapters.flatMap(ch => ch.cases.map(x => [x.c.id, x.lock] as const)));
  const careerOpen = openIds(career);

  const careerFrom = (from: From) => from === "desk" || from === "career";
  /** Kariyer dosyasında büronun tarafı: masadaki dosyada teklifle gelen taraf, haritada büronun alacağı taraf. */
  const mySide = (c: CaseFile, from: From, players?: Record<Side, Player>): Side =>
    c.mode === "solo" ? "p1" : (from === "desk" && flow?.side[c.id]) || (players ? (players.p1.ai || players.p1.remote ? "p2" : players.p2.ai || players.p2.remote ? "p1" : careerSide(c)) : careerSide(c));
  const duelScore = (game: GameState, side: Side, ai?: AiVerdict) => ai ? ai[side] : Math.max(0, Math.min(100, 50 + game.pts[side] - game.pts[other(side)]));

  /** Kariyer sonucu: ilerlemeye yazar, yeni açılan bölümü bildirir; masadan açılan dosyada ücret kasaya girer ve ay kapanır. */
  const settle = (c: CaseFile, from: From, won: boolean, score: number): string | undefined => {
    let notice: string | undefined;
    const prev = progress[c.id] || { played: 0, won: false, best: 0 };
    const nextProgress: Progress = { ...progress, [c.id]: { played: prev.played + 1, won: prev.won || won, best: won ? Math.max(prev.best, score) : prev.best } };
    const after = buildCareer(cases.career, nextProgress, true, Infinity, { dr });
    const newCh = after.chapters.filter(ch => ch.open && !career.chapters.find(x => x.level === ch.level)!.open);
    if (newCh.length) notice = t("Yeni bölüm açıldı: {b}. Unvanınız artık \"{u}\".", { b: newCh.map(ch => t(ch.title)).join(", "), u: t(after.rank) });
    recordResult(c.id, won, score, levelOf(c));
    if (won) shouldInvite().then(v => { if (v) setInvite(true); }).catch(() => {});
    if (office && from === "desk") {
      const src = flow?.src[c.id] || sourceOf(c), spec = !!flow?.specialty.includes(branchOf(c));
      closeFile(c.id, won, score, office.month + 1);
      const fee = feeFor(c, office, won, score, { src, spec }), cost = monthlyCost(office).total;
      const personal = personalCosts(office.life || newLife(office.city), office.month + 1).total;
      const routine = routineIncome({ ...office, wins: (office.wins || 0) + (won ? 1 : 0) });
      const money = `${src !== "muvekkil" ? t(SOURCE_LABEL[src]) + " · " : ""}${lineText(fee.text)}${spec ? ` (${t("uzmanlık alanı")})` : ""}: `
        + t("+{ucret} · rutin işler +{rutin} · büro gideri −{buro} · kişisel gider −{kisisel} · kasa {kasa}.", { ucret: tl(fee.amount), rutin: tl(routine), buro: tl(cost), kisisel: tl(personal), kasa: tl(office.cash + fee.amount + routine - cost - personal) });
      notice = notice ? `${notice}\n${money}` : money;
      settleCase(c, won, score, { src, spec });
    }
    return notice;
  };

  /** Kanun yolu zinciri: tek kişilik davada ve bilgisayara karşı karşılıklı davada açılır (internet ve aynı cihazda iki kişi hariç). */
  const chainFor = (c: CaseFile, players: Record<Side, Player>, game: GameState, from: From): Chain | undefined => {
    if (from === "online" || players.p1.remote || players.p2.remote) return undefined;
    const side = mySide(c, from, players);
    if (c.mode === "duel" && (players[side].ai || !players[other(side)].ai)) return undefined;
    return { base: c, side, baseGame: game, before: careerFrom(from) ? progress[c.id] ?? null : undefined, me: c.mode === "solo" ? (players.p1.name === "Siz" ? meName : players.p1.name) : players[side].name };
  };
  /** Biten aşamanın tutanağı zincire eklenir; sonraki kanun yolu aşamasında "önceki aşamalar" olarak görünür. */
  const kayitEkle = (ch: Chain | undefined, c: CaseFile, tutanak: TutanakSatiri[], players?: Record<Side, Player>): Chain | undefined => {
    if (!ch || !tutanak.length) return ch;
    // Konuşanların adı bu aşamanın kadrosundan yazılır (sonraki aşamanın kadrosu başkadır).
    const adOf = (w: string) => w === "narr" ? t("Dosya notu") : w === "mubasir" ? t("Mübaşir") : (w === "p1" || w === "p2") ? `${players?.[w]?.name || ""} · ${c.sides[w].role}`.replace(/^ · /, "") : c.cast[w]?.name || (w === "party_p1" || w === "party_p2" ? c.sides[w === "party_p1" ? "p1" : "p2"].short : w === "karsi" ? t("Karşı taraf") : w);
    tutanak = tutanak.map(x => ({ ...x, ad: x.ad || adOf(x.who) }));
    const baslik = (c.appealOf ? (c.appealOf.kind === "temyiz" ? t("Temyiz") : c.forum ? t("İtiraz") : t("İstinaf")) : t("İlk derece")) + " · " + c.court + (c.esas ? " · " + c.esas : "");
    return { ...ch, kayitlar: [...(ch.kayitlar || []), { baslik, satirlar: tutanak }] };
  };
  /** Kanun yolu aşamasının sonucu kariyerde aynı denemenin kesin sonucu olur: ilk derece kaydının yerine, üst mahkeme çarpanıyla. */
  const settleAppeal = (stage: CaseFile, game: GameState, chain: Chain, from: From): string | undefined => {
    if (!careerFrom(from) || chain.before === undefined) return undefined;
    const won = verdict(stage, game).winner === "p1";
    const level = Math.min(5, Math.max(levelOf(stage), levelOf(chain.base) + 1));
    recordResult(chain.base.id, won, game.score, level, { amend: chain.before });
    const sonuc = won ? t("Son durum: {mahkeme} kararıyla kazandınız. Sonuç kariyerinize üst mahkeme çarpanıyla işlendi.", { mahkeme: stage.court })
      : t("Son durum: {mahkeme} kararıyla kaybettiniz. Kariyerinizde bu dosyanın sonucu güncellendi.", { mahkeme: stage.court });
    // Büro: kanun yolu ücreti; karar lehe döndüyse kalan vekâlet ücreti ve karşı vekâlet ücreti kasaya girer.
    if (!office || from !== "desk") return sonuc;
    const baseWon = verdict(chain.base, chain.baseGame).winner === chain.side;
    const baseScore = chain.base.mode === "solo" ? chain.baseGame.score : duelScore(chain.baseGame, chain.side);
    const ak = stage.appealOf!;
    const odeme = kanunYoluOdemesi({ base: chain.base, asama: `${ak.kind}-${ak.level}`, mahkeme: stage.courtShort || stage.court, baseWon, baseScore, wonNow: won,
      src: flow?.src[chain.base.id] || sourceOf(chain.base), spec: !!flow?.specialty.includes(branchOf(chain.base)) });
    odeme.then(r => {
      const cur = routeRef.current;
      if (!r || cur.k !== "verdict" || cur.c.id !== stage.id) return;
      const satir = r.kalemler.map(k => `${lineText(k.text)}: ${k.amount >= 0 ? "+" : "−"}${tl(Math.abs(k.amount))}`).join(" · ");
      setRoute({ ...cur, notice: `${sonuc}\n${satir} · ${t("kasa {kasa}", { kasa: tl(r.kasa) })}.` });
    }).catch(() => {});
    return sonuc;
  };
  /** Oyun bitince: kariyer dosyasında sonucu işler (antrenmanda işlemez); karşılıklıda önce son sözler alınır. */
  const finish = (c: CaseFile, players: Record<Side, Player>, game: GameState, from: From, tutanak: TutanakSatiri[] = [], chain?: Chain) => {
    let notice: string | undefined;
    // Danışma dosyası (gerçek olay): oyun kaydı sunucuya yazılır ve dosya sahibine gider; kariyere işlemez.
    const dosyaId = from === "danismaDosya" ? dosyaKimligi(c) : null;
    if (dosyaId) {
      setRoute({ k: "verdict", c, players, game, from, notice: t("Oyun kaydınız dosya sahibine gönderiliyor…") });
      dosyaBitir(dosyaId, kayitOf(c, game, tutanak)).then(r => {
        const cur = routeRef.current;
        if (cur.k !== "verdict" || cur.c.id !== c.id) return;
        setRoute({ ...cur, notice: r.error ? t("Oyun kaydı gönderilemedi: {hata}", { hata: t(r.error) }) : t("Oyun kaydınız dosya sahibine gönderildi; Gelen kutusuna bildirim gitti. Teşekkürler!") });
      });
      return;
    }
    // Evrakla duruşma provası: kariyere ve hiçbir sunucu kaydına işlemez.
    if (from === "evrak") {
      // Oynanan provanın dökümü (yalnız bu cihazda): "Provayı bitir"de çıktıya girer.
      const v = verdict(c, game);
      oynananYaz({
        tarih: new Date().toISOString(), baslik: c.title, hukum: v.hukum, ozet: v.summary,
        puan: c.mode === "solo" ? `${t("İkna")} ${game.score}/100` : `${game.pts.p1} – ${game.pts.p2}`,
        adimlar: game.log.map(l => ({ soru: l.prompt, cevap: l.text, puan: l.delta, not: l.note, madde: l.law }))
      });
      setRoute({ k: "verdict", c, players, game, from, notice: t("Prova bitti. Sonuç kariyerinize işlenmez; dökümü “Provayı bitir”den çıktı olarak alabilirsiniz.") });
      return;
    }
    if (c.appealOf && chain) { setRoute({ k: "verdict", c, players, game, from, notice: settleAppeal(c, game, chain, from), chain: kayitEkle(chain, c, tutanak, players) }); return; }
    if (c.mode === "duel" && !game.fatal) { setRoute({ k: "closing", c, players, game, from, tutanak }); return; }
    const next = kayitEkle(chainFor(c, players, game, from), c, tutanak, players);
    if (careerFrom(from)) {
      const side = mySide(c, from, players);
      notice = settle(c, from, verdict(c, game).winner === side, c.mode === "solo" ? game.score : duelScore(game, side));
    }
    setRoute({ k: "verdict", c, players, game, from, notice, chain: next });
  };
  const afterClosing = (c: CaseFile, players: Record<Side, Player>, game: GameState, from: From, ai: AiVerdict, tutanak: TutanakSatiri[] = []) => {
    let notice: string | undefined;
    const next = kayitEkle(chainFor(c, players, game, from), c, tutanak, players);
    if (careerFrom(from)) { const side = mySide(c, from, players); notice = settle(c, from, ai.winner === side, duelScore(game, side, ai)); }
    setRoute({ k: "verdict", c, players, game, from, ai, notice, chain: next });
  };
  /** Karar ekranındaki kanun yolu kutusu: açık yol için başvuru düğmesi, kapalı yol için kesinlik gerekçesi. */
  const appealFor = (r: Extract<Route, { k: "verdict" }>) => {
    const ch = r.chain;
    if (!ch) return undefined;
    const na = nextAppeal(r.c, r.game, ch.base, ch.side, ch.baseGame, r.ai ? (r.ai.winner === "sulh" ? "draw" : r.ai.winner) : undefined);
    if (na.closed) return { closed: true, text: na.closed.yarar ? t(ch.base.forum ? "İtiraz etmenizde hukuki yarar yok: {neden}" : "İstinafa başvurmanızda hukuki yarar yok: {neden}", { neden: na.closed.reason }) : t("Bu karar kesindir: {neden}", { neden: na.closed.reason }) };
    if (!na.offer) return undefined;
    const { kind, route: way, basic } = na.offer;
    const forum = !!ch.base.forum;
    const text = (forum ? (kind === "cevap" ? t("Karşı taraf karara itiraz etti. Cevap dilekçenizi hazırlayıp kararı {mahkeme} önünde savunun.", { mahkeme: way.court })
      : kind === "temyiz" ? t("Karar aleyhinize. {mahkeme} nezdinde temyiz yoluna başvurabilirsiniz.", { mahkeme: way.court })
      : t("Karar aleyhinize. Kararı {mahkeme} önüne yazılı itirazla götürebilirsiniz.", { mahkeme: way.court }))
      : kind === "cevap" ? t("Karşı taraf kararı istinaf etti. Cevap dilekçenizi hazırlayıp kararı {mahkeme} önünde savunun.", { mahkeme: way.court })
      : kind === "temyiz" ? t("Karar aleyhinize. {mahkeme} nezdinde temyiz yoluna başvurabilirsiniz.", { mahkeme: way.court })
      : t("Karar aleyhinize. {mahkeme} nezdinde istinaf yoluna başvurabilirsiniz.", { mahkeme: way.court }))
      + (basic && !forum ? " " + t("Bu dosya için temel bir kanun yolu aşaması kurulacak.") : "");
    const button = na.offer.label ? t(na.offer.label) : kind === "cevap" ? t("Karşı tarafın istinafına cevap ver") : kind === "temyiz" ? t("Temyize başvur") : t("İstinafa başvur");
    return { text, button, onPress: () => startAppeal(kind, r) };
  };
  const startAppeal = (kind: AppealKind, r: Extract<Route, { k: "verdict" }>) => {
    const ch = r.chain!;
    const prev = r.c.appealOf ? { c: r.c, game: r.game } : undefined;
    const stage = appealCase(ch.base, kind, { side: ch.side, baseGame: ch.baseGame, prev });
    startGame(stage, { p1: { name: ch.me, ai: false }, p2: { name: t("Karşı taraf"), ai: false } }, r.from, { ...ch, prev });
  };
  /** Kariyerden dosya açma: tek kişilik doğrudan, karşılıklı rakip seçimiyle (büronun tarafı sabit). */
  const playCareer = (c: CaseFile, from: "desk" | "career") => {
    if (c.mode === "solo") return startGame(c, { ...SOLO_PLAYERS, p1: { name: meName, ai: false } }, from);
    setSetup({ c, from, side: (from === "desk" && flow?.side[c.id]) || careerSide(c), career: true });
  };
  const meName = account?.adSoyad ? t("Av. {ad}", { ad: account.adSoyad }) : t("Siz");
  // Önizlemede karşılıklı dava, iki kişilik olarak aynı cihazda açılır.
  const previewPlayers = (c: CaseFile): Record<Side, Player> => c.mode === "duel" ? { p1: { name: "Oyuncu 1", ai: false }, p2: { name: "Oyuncu 2", ai: false } } : SOLO_PLAYERS;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={["top", "bottom", "left", "right"]} onTouchStart={resumeMusic}>
        <NewPassword />
        <YeniSurum />
        <BoardInvite visible={invite} onClose={() => setInvite(false)}
          info={{ sehir: office ? CITIES.find(x => x.id === office.city)?.name : undefined, avatar: office?.avatar || me?.avatar, unvan: career.rank }} />
        <StatusBar style="light" />
        <View key={lang} style={styles.root}>
        {route.k === "title" && <TitleScreen duelCount={cases.duel.length} soloCount={cases.solo.length} rankName={career.rank} started={Object.keys(progress).length > 0} won={career.won} total={career.total}
          account={account} server={!!supabase()}
          onAccount={() => setRoute({ k: "account" })} onSignIn={() => setRoute({ k: "account", tab: "giris" })} onSignUp={() => setRoute({ k: "account", tab: "kayit", then: "career" })} onSignOut={() => signOut()}
          onCareer={() => setRoute(!account ? { k: "account", then: "career" } : office ? { k: "desk" } : { k: "office" })}
          office={office} onOffice={() => setRoute(account ? { k: "office" } : { k: "account", then: "career" })} onDuel={() => toList("duel")} onSolo={() => toList("solo")} onAdmin={() => setRoute({ k: "admin" })}
          onHistory={() => setRoute({ k: "history" })} onCharacter={() => setRoute({ k: "character" })} onBoard={() => setRoute({ k: "board" })} isAdmin={srvAdmin} onMap={() => setRoute({ k: "career" })}
          onTahkim={() => setRoute({ k: "tahkim" })} onPro={() => setRoute({ k: "paywall" })} pro={unlocked} tahkimCount={cases.all.filter(c => c.room === "tahkim").length}
          guest={guest} onGuest={() => setGuest(true)} onLeaveGuest={() => setGuest(false)} onDanisma={(evrak?: boolean) => setRoute({ k: "danisma", evrak })} onOrnek={() => setRoute({ k: "danisma", ornek: true })} onFoy={(sekme?: "beyan" | "kaynak") => setRoute({ k: "foy", sekme })} onShop={Platform.OS === "web" ? () => setRoute({ k: "magaza" }) : undefined} onInbox={() => setRoute({ k: "inbox" })}
          onDanismaDosya={() => setRoute({ k: "danismaDosya" })} />}
        {route.k === "danismaDosya" && (
          <DanismaDosyaScreen signedIn={account?.mode === "server"} onBack={() => setRoute({ k: "title" })} onSignIn={() => setRoute({ k: "account", tab: "giris" })}
            onPlay={c => startGame(c, { ...SOLO_PLAYERS, p1: { name: meName, ai: false } }, "danismaDosya")} />
        )}
        {route.k === "foy" && (
          <FoyScreen key={route.sekme || "foy"} ilkSekme={route.sekme} ucretsiz={srvAdmin} onBack={() => setRoute({ k: "title" })}
            onHazirlan={f => {
              // Föyün evrakı Evrakla duruşma provasına aktarılır; onay kutusu boş başlar (gönderilecek metin denetlenmeli).
              evrakOturumuYaz({ evraklar: f.evraklar.filter(e => e.metin.trim()).map(e => ({ ad: e.ad, metin: e.metin })), yapistir: "", taraf: f.taraf, asama: f.durusma ? t("Sonraki duruşma {d}", { d: tarihYaz(f.durusma) }) : "", allow: [], extra: [], map: {}, aktarim: true });
              setRoute({ k: "danisma", evrak: true });
            }} />
        )}
        {route.k === "danisma" && (
          <DanismaScreen key={route.evrak ? "evrak" : route.ornek ? "ornek" : "danisma"} evrak={route.evrak} ornek={route.ornek} onEvrakPlay={c => startGame(c, { ...SOLO_PLAYERS, p1: { name: meName, ai: false } }, "evrak")} onBack={() => setRoute({ k: "title" })} signedIn={account?.mode === "server"} server={!!supabase()} admin={srvAdmin}
            onSignIn={() => setRoute({ k: "account", tab: "giris", then: "danisma" })} onSignUp={() => setRoute({ k: "account", tab: "kayit", then: "danisma" })} />
        )}
        {route.k === "board" && <LeaderboardScreen progress={progress} all={cases.all} rank={career.rank} onBack={() => setRoute({ k: "title" })}
          onSignIn={() => setRoute({ k: "account", tab: "giris" })} onSignUp={() => setRoute({ k: "account", tab: "kayit" })} />}
        {route.k === "character" && <CharacterScreen onBack={() => setRoute({ k: "title" })} />}
        {route.k === "inbox" && <InboxScreen onBack={() => setRoute({ k: "title" })} onSignIn={() => setRoute({ k: "account", tab: "giris" })} />}
        {route.k === "history" && <HistoryScreen view={career} progress={progress} all={cases.all} onBack={() => setRoute({ k: "title" })} onOffice={() => setRoute({ k: "office" })} />}
        {route.k === "tahkim" && (
          <TahkimScreen cases={cases.all.filter(c => c.room === "tahkim")} locked={() => false}
            onLocked={() => {}}
            onBack={() => setRoute({ k: "title" })} onPick={c => setSetup({ c, from: "tahkim" })} onOnline={() => setRoute({ k: "online" })} />
        )}
        {route.k === "online" && (
          <OnlineLobby all={cases.all} onBack={() => toList("duel")} onLogin={() => setRoute({ k: "account" })}
            onJoined={m => { const c = findCase(m.dava_id); if (c) setRoute({ k: "onlineGame", id: m.id, c }); }} />
        )}
        {route.k === "onlineWait" && (
          <OnlineWait id={route.id} c={route.c} onCancel={() => setRoute({ k: "online" })} onStart={m => setRoute({ k: "onlineGame", id: m.id, c: route.c })} />
        )}
        {route.k === "onlineGame" && (
          <OnlineGame key={route.id} id={route.id} c={route.c} onExit={() => setRoute({ k: "online" })}
            onDone={(game, players, ai) => {
              // Kariyer dosyası internetten oynandıysa sonuç büroya işlenir.
              if (careerOnline && careerOnline.matchId === route.id && ai) {
                const side = careerOnline.side, notice = settle(route.c, careerOnline.from, ai.winner === side, duelScore(game, side, ai));
                setCareerOnline(null);
                setRoute({ k: "verdict", c: route.c, players, game, from: careerOnline.from, ai, notice });
              } else setRoute({ k: "verdict", c: route.c, players, game, from: "online", ai });
            }} />
        )}
        {route.k === "office" && <OfficeScreen onBack={() => setRoute({ k: "title" })} onCareer={() => setRoute({ k: "desk" })} />}
        {route.k === "desk" && (
          <DeskScreen solo={cases.career} progress={progress} view={career} premium={premium} admin={admin}
            onPlay={c => playCareer(c, "desk")} onOffice={() => setRoute({ k: "office" })} onMap={() => setRoute({ k: "career" })}
            onPaywall={() => setRoute({ k: "paywall" })} onBack={() => setRoute({ k: "title" })} />
        )}
        {route.k === "account" && (
          <AccountScreen initial={route.tab} onBack={() => setRoute({ k: "title" })} onDone={() => setRoute(route.then === "career" ? (office ? { k: "desk" } : { k: "office" }) : route.then === "paywall" ? { k: "paywall" } : route.then === "danisma" ? { k: "danisma" } : route.then === "magaza" ? { k: "magaza" } : { k: "title" })} />
        )}
        {route.k === "career" && (
          <CareerScreen view={career} premium={unlocked} office={office} onOffice={() => setRoute({ k: "office" })} onPaywall={() => setRoute({ k: "paywall" })} onBack={() => setRoute(office ? { k: "desk" } : { k: "title" })} onPick={c => playCareer(c, "career")} onReset={() => resetProgress()} />
        )}
        {route.k === "list" && (
          <CaseListScreen mode={route.mode} cases={route.mode === "duel" ? cases.duel : cases.solo}
            // Tek kişilik dosyalar antrenmanda da kariyerdeki ilerlemeye göre açılır: kariyerde ulaşılmamış mahkemeye girilemez.
            lockedNote={c => admin || c.mode !== "solo" || c.career?.off || careerOpen.has(c.id) ? undefined
              : lockOf.get(c.id) === "premium" ? t("Celse Pro ile açılır")
              : t("Kariyerde açılır · {bolum}", { bolum: t(CHAPTERS[levelOf(c) - 1].title) })}
            onLocked={c => { if (lockOf.get(c.id) === "premium") setRoute({ k: "paywall" }); }}
            onBack={() => setRoute({ k: "title" })}
            onSwitch={() => toList(route.mode === "duel" ? "solo" : "duel")}
            onOnline={() => setRoute({ k: "online" })}
            onPick={c => (c.mode === "duel" ? setSetup({ c, from: "list" }) : startGame(c, SOLO_PLAYERS))} />
        )}
        {route.k === "paywall" && (
          <PaywallScreen onBack={() => goBack()} signedIn={account?.mode === "server"} server={!!supabase()}
            onSignIn={() => setRoute({ k: "account", tab: "giris", then: "paywall" })} onSignUp={() => setRoute({ k: "account", tab: "kayit", then: "paywall" })} />
        )}
        {route.k === "magaza" && (
          <ShopScreen onBack={() => goBack()} signedIn={account?.mode === "server"} server={!!supabase()}
            buyer={account ? { ad: account.adSoyad, eposta: account.eposta } : undefined}
            onSignIn={() => setRoute({ k: "account", tab: "giris", then: "magaza" })} onSignUp={() => setRoute({ k: "account", tab: "kayit", then: "magaza" })} />
        )}
        {route.k === "admin" && <AdminScreen onExit={() => setRoute({ k: "title" })} onPreview={c => startGame(c, previewPlayers(c), "admin")} onEvrak={() => setRoute({ k: "danisma", evrak: true })} onFoy={() => setRoute({ k: "foy" })} />}
        {route.k === "game" && (
          <GameScreen key={route.run} c={route.c} players={route.players} onceki={route.chain?.kayitlar}
            onExit={() => { if (route.from === "danismaDosya") { const id = dosyaKimligi(route.c); if (id) dosyaBirak(id); } back(route.c, route.from); }}
            onFinish={(game, tutanak) => finish(route.c, route.players, game, route.from, tutanak, route.chain)} />
        )}
        {route.k === "closing" && (
          <ClosingScreen c={route.c} game={route.game} players={route.players}
            onDone={ai => afterClosing(route.c, route.players, route.game, route.from, ai, route.tutanak)} />
        )}
        {route.k === "verdict" && (
          <VerdictScreen c={route.c} game={route.game} notice={route.notice} ai={route.ai} appeal={route.from === "danismaDosya" || route.from === "evrak" ? undefined : appealFor(route)}
            backLabel={route.from === "admin" ? t("Yönetim paneline dön") : route.from === "career" ? t("Kariyere dön") : route.from === "desk" ? t("Büro masasına dön") : route.from === "tahkim" ? t("Tahkim listesine dön") : route.from === "online" ? t("Çevrim içi lobiye dön") : route.from === "danismaDosya" ? t("Danışma dosyalarına dön") : route.from === "evrak" ? t("Provaya dön") : undefined}
            onRetry={route.from === "online" || route.from === "danismaDosya" ? undefined : () => startGame(route.c, route.players, route.from === "desk" ? "list" : route.from, route.c.appealOf ? route.chain : undefined)}
            onBack={() => back(route.c, route.from)} />
        )}
        <SetupModal key={setup?.c.id} c={setup?.c || null} fixedSide={setup?.side} career={setup?.career} meName={setup?.career ? meName : undefined}
          onClose={() => setSetup(null)} onStart={p => { const su = setup!; setSetup(null); startGame(su.c, p, su.from); }}
          onOnline={async (side, open) => {
            if (!account) { setSetup(null); setRoute({ k: "account" }); return; }
            const su = setup!; const m = await createMatch(su.c.id, side, open);
            if (su.career) setCareerOnline({ matchId: m.id, caseId: su.c.id, side, from: su.from });
            setSetup(null); setRoute({ k: "onlineWait", id: m.id, c: su.c });
          }} />
        </View>
        <KeyboardBar />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.wallDeep }
});
