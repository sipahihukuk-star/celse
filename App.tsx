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
import { useCases } from "./src/data/useCases";
import { GameState } from "./src/engine/engine";
import { CaseFile, Player, Side } from "./src/engine/types";
import GameScreen from "./src/ui/GameScreen";
import { CaseListScreen, SetupModal, TitleScreen } from "./src/ui/MenuScreens";
import { C } from "./src/ui/theme";
import VerdictScreen from "./src/ui/VerdictScreen";

/** from: oyun bitince nereye dönüleceği (dosya dolabı ya da yönetim paneli önizlemesi) */
type From = "list" | "admin";
type Route =
  | { k: "title" }
  | { k: "list"; mode: "duel" | "solo" }
  | { k: "admin" }
  | { k: "game"; c: CaseFile; players: Record<Side, Player>; run: number; from: From }
  | { k: "verdict"; c: CaseFile; players: Record<Side, Player>; game: GameState; from: From };

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

  // Yazı tipleri yüklenemezse (ör. ağ engeli) sistem yazı tipiyle devam edilir.
  if (!loaded && !error) return <View style={styles.root} />;

  const startGame = (c: CaseFile, players: Record<Side, Player>, from: From = "list") => { setRun(r => r + 1); setRoute({ k: "game", c, players, run: run + 1, from }); };
  const toList = (mode: "duel" | "solo") => setRoute({ k: "list", mode });
  const back = (c: CaseFile, from: From) => (from === "admin" ? setRoute({ k: "admin" }) : toList(c.mode));
  // Önizlemede karşılıklı dava, iki kişilik olarak aynı cihazda açılır.
  const previewPlayers = (c: CaseFile): Record<Side, Player> => c.mode === "duel" ? { p1: { name: "Oyuncu 1", ai: false }, p2: { name: "Oyuncu 2", ai: false } } : SOLO_PLAYERS;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={["top", "bottom", "left", "right"]}>
        <StatusBar style="light" />
        {route.k === "title" && <TitleScreen duelCount={cases.duel.length} soloCount={cases.solo.length} onDuel={() => toList("duel")} onSolo={() => toList("solo")} onAdmin={() => setRoute({ k: "admin" })} />}
        {route.k === "list" && (
          <CaseListScreen mode={route.mode} cases={route.mode === "duel" ? cases.duel : cases.solo}
            onBack={() => setRoute({ k: "title" })}
            onSwitch={() => toList(route.mode === "duel" ? "solo" : "duel")}
            onPick={c => (c.mode === "duel" ? setSetup(c) : startGame(c, SOLO_PLAYERS))} />
        )}
        {route.k === "admin" && <AdminScreen onExit={() => setRoute({ k: "title" })} onPreview={c => startGame(c, previewPlayers(c), "admin")} />}
        {route.k === "game" && (
          <GameScreen key={route.run} c={route.c} players={route.players}
            onExit={() => back(route.c, route.from)}
            onFinish={game => setRoute({ k: "verdict", c: route.c, players: route.players, game, from: route.from })} />
        )}
        {route.k === "verdict" && (
          <VerdictScreen c={route.c} game={route.game} backLabel={route.from === "admin" ? "Yönetim paneline dön" : undefined}
            onRetry={() => startGame(route.c, route.players, route.from)}
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
