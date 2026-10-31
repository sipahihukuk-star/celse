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
import { caseById, DUEL_CASES, SOLO_CASES } from "./src/data/cases";
import { GameState } from "./src/engine/engine";
import { CaseFile, Player, Side } from "./src/engine/types";
import GameScreen from "./src/ui/GameScreen";
import { CaseListScreen, SetupModal, TitleScreen } from "./src/ui/MenuScreens";
import { C } from "./src/ui/theme";
import VerdictScreen from "./src/ui/VerdictScreen";

type Route =
  | { k: "title" }
  | { k: "list"; mode: "duel" | "solo" }
  | { k: "game"; id: string; players: Record<Side, Player>; run: number }
  | { k: "verdict"; id: string; players: Record<Side, Player>; game: GameState };

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

  // Yazı tipleri yüklenemezse (ör. ağ engeli) sistem yazı tipiyle devam edilir.
  if (!loaded && !error) return <View style={styles.root} />;

  const startGame = (id: string, players: Record<Side, Player>) => { setRun(r => r + 1); setRoute({ k: "game", id, players, run: run + 1 }); };
  const toList = (mode: "duel" | "solo") => setRoute({ k: "list", mode });

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={["top", "bottom", "left", "right"]}>
        <StatusBar style="light" />
        {route.k === "title" && <TitleScreen duelCount={DUEL_CASES.length} soloCount={SOLO_CASES.length} onDuel={() => toList("duel")} onSolo={() => toList("solo")} />}
        {route.k === "list" && (
          <CaseListScreen mode={route.mode} cases={route.mode === "duel" ? DUEL_CASES : SOLO_CASES}
            onBack={() => setRoute({ k: "title" })}
            onSwitch={() => toList(route.mode === "duel" ? "solo" : "duel")}
            onPick={c => (c.mode === "duel" ? setSetup(c) : startGame(c.id, SOLO_PLAYERS))} />
        )}
        {route.k === "game" && (
          <GameScreen key={route.run} c={caseById(route.id)} players={route.players}
            onExit={() => toList(caseById(route.id).mode)}
            onFinish={game => setRoute({ k: "verdict", id: route.id, players: route.players, game })} />
        )}
        {route.k === "verdict" && (
          <VerdictScreen c={caseById(route.id)} game={route.game}
            onRetry={() => startGame(route.id, route.players)}
            onBack={() => toList(caseById(route.id).mode)} />
        )}
        <SetupModal key={setup?.id} c={setup} onClose={() => setSetup(null)} onStart={p => { const id = setup!.id; setSetup(null); startGame(id, p); }} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.wallDeep }
});
