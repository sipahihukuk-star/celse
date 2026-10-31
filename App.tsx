import { AlegreyaSans_400Regular } from "@expo-google-fonts/alegreya-sans/400Regular";
import { AlegreyaSans_400Regular_Italic } from "@expo-google-fonts/alegreya-sans/400Regular_Italic";
import { AlegreyaSans_500Medium } from "@expo-google-fonts/alegreya-sans/500Medium";
import { AlegreyaSans_700Bold } from "@expo-google-fonts/alegreya-sans/700Bold";
import { AlegreyaSC_500Medium } from "@expo-google-fonts/alegreya-sc/500Medium";
import { AlegreyaSC_700Bold } from "@expo-google-fonts/alegreya-sc/700Bold";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono/500Medium";
import { IBMPlexMono_600SemiBold } from "@expo-google-fonts/ibm-plex-mono/600SemiBold";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AdminScreen from "./src/admin/AdminScreen";
import { signOut, supabase, useAccount } from "./src/data/account";
import AccountScreen from "./src/ui/AccountScreen";
import PaywallScreen from "./src/ui/PaywallScreen";
import OfficeScreen from "./src/ui/OfficeScreen";
import DeskScreen from "./src/ui/DeskScreen";
import { closeFile } from "./src/data/flow";
import { newLife, personalCosts } from "./src/data/life";
import { routineIncome } from "./src/data/office";
import { feeFor, monthlyCost, settleCase, SOURCE_LABEL, sourceOf, tl, useOffice } from "./src/data/office";
import { resumeMusic } from "./src/ui/music";
import { FREE_CASES, usePremium } from "./src/data/subscription";
import { buildCareer, levelOf, openIds, Progress, recordResult, resetProgress, useProgress, CHAPTERS } from "./src/data/career";
import { useCases } from "./src/data/useCases";
import { GameState, verdict } from "./src/engine/engine";
import { CaseFile, Player, Side } from "./src/engine/types";
import CareerScreen from "./src/ui/CareerScreen";
import GameScreen from "./src/ui/GameScreen";
import { CaseListScreen, SetupModal, TitleScreen } from "./src/ui/MenuScreens";
import { C } from "./src/ui/theme";
import VerdictScreen from "./src/ui/VerdictScreen";

/** from: oyun bitince nereye dönüleceği (dosya dolabı ya da yönetim paneli önizlemesi) */
type From = "list" | "admin" | "career" | "desk";
type Route =
  | { k: "title" }
  | { k: "list"; mode: "duel" | "solo" }
  | { k: "admin" }
  | { k: "career" }
  | { k: "office" }
  | { k: "desk" }
  | { k: "account"; then?: "career" }
  | { k: "paywall"; back: "career" | "list" | "title"; mode?: "duel" | "solo" }
  | { k: "game"; c: CaseFile; players: Record<Side, Player>; run: number; from: From }
  | { k: "verdict"; c: CaseFile; players: Record<Side, Player>; game: GameState; from: From; notice?: string };

const SOLO_PLAYERS: Record<Side, Player> = { p1: { name: "Siz", ai: false }, p2: { name: "Karşı taraf", ai: false } };

export default function App() {
  const [loaded, error] = useFonts({
    AlegreyaSC_500Medium, AlegreyaSC_700Bold,
    AlegreyaSans_400Regular, AlegreyaSans_400Regular_Italic, AlegreyaSans_500Medium, AlegreyaSans_700Bold,
    IBMPlexMono_500Medium, IBMPlexMono_600SemiBold
  });
  const [route, setRoute] = useState<Route>({ k: "title" });
  const [setup, setSetup] = useState<CaseFile | null>(null);
  const [run, setRun] = useState(0);
  const cases = useCases();
  const progress = useProgress();
  const { account } = useAccount();
  const { premium, admin } = usePremium();
  const { office } = useOffice();

  // Yazı tipleri yüklenemezse (ör. ağ engeli) sistem yazı tipiyle devam edilir.
  if (!loaded && !error) return <View style={styles.root} />;

  const startGame = (c: CaseFile, players: Record<Side, Player>, from: From = "list") => { setRun(r => r + 1); setRoute({ k: "game", c, players, run: run + 1, from }); };
  const toList = (mode: "duel" | "solo") => setRoute({ k: "list", mode });
  const back = (c: CaseFile, from: From) => (from === "admin" ? setRoute({ k: "admin" }) : from === "career" ? setRoute({ k: "career" }) : from === "desk" ? setRoute({ k: "desk" }) : toList(c.mode));
  const career = buildCareer(cases.solo, progress, premium, FREE_CASES);
  const lockOf = new Map(career.chapters.flatMap(ch => ch.cases.map(x => [x.c.id, x.lock] as const)));
  const careerOpen = openIds(career);

  /** Oyun bitince: tek kişilik davada sonucu kariyere yazar, yeni açılan bölüm ya da davayı bildirir. */
  const finish = (c: CaseFile, players: Record<Side, Player>, game: GameState, from: From) => {
    let notice: string | undefined;
    if (c.mode === "solo" && from !== "admin") {
      const won = verdict(c, game).winner === "p1";
      const prev = progress[c.id] || { played: 0, won: false, best: 0 };
      const nextProgress: Progress = { ...progress, [c.id]: { played: prev.played + 1, won: prev.won || won, best: won ? Math.max(prev.best, game.score) : prev.best } };
      const after = buildCareer(cases.solo, nextProgress);
      const newCh = after.chapters.filter(ch => ch.open && !career.chapters.find(x => x.level === ch.level)!.open);
      const afterOpen = openIds(after);
      const newCases = after.chapters.flatMap(ch => ch.cases).filter(x => afterOpen.has(x.c.id) && !careerOpen.has(x.c.id));
      if (newCh.length) notice = `Yeni bölüm açıldı: ${newCh.map(ch => ch.title).join(", ")}. Unvanınız artık "${after.rank}".`;
      else if (newCases.length) notice = `Sıradaki dava açıldı: ${newCases.map(x => x.c.title).join(", ")}.`;
      recordResult(c.id, won, game.score);
      // Büro hesabı (yalnız masadan açılan dosyalarda): ücret kasaya girer, ay kapanır, dosya masadan kalkar.
      if (office && from === "desk") {
        closeFile(c.id, won, game.score, office.month + 1);
        const fee = feeFor(c, office, won, game.score), cost = monthlyCost(office).total;
        const src = sourceOf(c);
        const personal = personalCosts(office.life || newLife(office.city), office.month + 1).total;
        const routine = routineIncome({ ...office, wins: (office.wins || 0) + (won ? 1 : 0) });
        const money = `${src !== "muvekkil" ? SOURCE_LABEL[src] + " · " : ""}${fee.text}: +${tl(fee.amount)} · rutin işler +${tl(routine)} · büro gideri −${tl(cost)} · kişisel gider −${tl(personal)} · kasa ${tl(office.cash + fee.amount + routine - cost - personal)}.`;
        notice = notice ? `${notice}\n${money}` : money;
        settleCase(c, won, game.score);
      }
    }
    setRoute({ k: "verdict", c, players, game, from, notice });
  };
  // Önizlemede karşılıklı dava, iki kişilik olarak aynı cihazda açılır.
  const previewPlayers = (c: CaseFile): Record<Side, Player> => c.mode === "duel" ? { p1: { name: "Oyuncu 1", ai: false }, p2: { name: "Oyuncu 2", ai: false } } : SOLO_PLAYERS;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={["top", "bottom", "left", "right"]} onTouchStart={resumeMusic}>
        <StatusBar style="light" />
        {route.k === "title" && <TitleScreen duelCount={cases.duel.length} soloCount={cases.solo.length} rankName={career.rank} started={Object.keys(progress).length > 0} won={career.won} total={career.total}
          account={account} server={!!supabase()}
          onAccount={() => setRoute({ k: "account" })} onSignOut={() => signOut()}
          onCareer={() => setRoute(!account ? { k: "account", then: "career" } : office ? { k: "desk" } : { k: "office" })}
          office={office} onOffice={() => setRoute({ k: "office" })} onDuel={() => toList("duel")} onSolo={() => toList("solo")} onAdmin={() => setRoute({ k: "admin" })} />}
        {route.k === "paywall" && (
          <PaywallScreen onBack={() => (route.back === "career" ? setRoute({ k: "career" }) : route.back === "list" ? toList(route.mode || "solo") : setRoute({ k: "title" }))} />
        )}
        {route.k === "office" && <OfficeScreen onBack={() => setRoute({ k: "title" })} onCareer={() => setRoute({ k: "desk" })} />}
        {route.k === "desk" && (
          <DeskScreen solo={cases.solo} progress={progress} view={career} premium={premium} admin={admin}
            onPlay={c => startGame(c, SOLO_PLAYERS, "desk")} onOffice={() => setRoute({ k: "office" })} onMap={() => setRoute({ k: "career" })}
            onPaywall={() => setRoute({ k: "paywall", back: "career" })} onBack={() => setRoute({ k: "title" })} />
        )}
        {route.k === "account" && (
          <AccountScreen onBack={() => setRoute({ k: "title" })} onDone={() => setRoute(route.then === "career" ? (office ? { k: "desk" } : { k: "office" }) : { k: "title" })} />
        )}
        {route.k === "career" && (
          <CareerScreen view={career} premium={premium} office={office} onOffice={() => setRoute({ k: "office" })} onPaywall={() => setRoute({ k: "paywall", back: "career" })} onBack={() => setRoute(office ? { k: "desk" } : { k: "title" })} onPick={c => startGame(c, SOLO_PLAYERS, "career")} onReset={() => resetProgress()} />
        )}
        {route.k === "list" && (
          <CaseListScreen mode={route.mode} cases={route.mode === "duel" ? cases.duel : cases.solo}
            lockedNote={c => admin ? undefined : c.mode === "duel" ? (premium ? undefined : "Abonelikle açılır")
              : lockOf.get(c.id) === "premium" ? "Abonelikle açılır"
              : !c.career?.off && !careerOpen.has(c.id) ? `Kariyerde açılır · ${CHAPTERS[levelOf(c) - 1].title}` : undefined}
            onLocked={c => { if (c.mode === "duel" || lockOf.get(c.id) === "premium") setRoute({ k: "paywall", back: "list", mode: c.mode }); }}
            onBack={() => setRoute({ k: "title" })}
            onSwitch={() => toList(route.mode === "duel" ? "solo" : "duel")}
            onPick={c => (c.mode === "duel" ? setSetup(c) : startGame(c, SOLO_PLAYERS))} />
        )}
        {route.k === "admin" && <AdminScreen onExit={() => setRoute({ k: "title" })} onPreview={c => startGame(c, previewPlayers(c), "admin")} />}
        {route.k === "game" && (
          <GameScreen key={route.run} c={route.c} players={route.players}
            onExit={() => back(route.c, route.from)}
            onFinish={game => finish(route.c, route.players, game, route.from)} />
        )}
        {route.k === "verdict" && (
          <VerdictScreen c={route.c} game={route.game} notice={route.notice}
            backLabel={route.from === "admin" ? "Yönetim paneline dön" : route.from === "career" ? "Kariyere dön" : route.from === "desk" ? "Büro masasına dön" : undefined}
            onRetry={() => startGame(route.c, route.players, route.from === "desk" ? "list" : route.from)}
            onBack={() => back(route.c, route.from)} />
        )}
        <SetupModal key={setup?.id} c={setup} onClose={() => setSetup(null)} onStart={p => { const c = setup!; setSetup(null); startGame(c, p); }} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.wallDeep }
});
