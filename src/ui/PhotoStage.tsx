// Gerçekçi sahne: salon fotoğrafı üzerine fotoğraf karakterler. Çizim sahnesiyle (Stage) aynı arayüzü kullanır.
// Karakterler davanın kadrosundan seçilir: rol (hâkim, savcı, avukat, müvekkil), salon ve tahmini cinsiyete göre
// havuzdan, dava kimliğine bağlı olarak hep aynı kişi gelir; bir davada aynı yüz iki kez kullanılmaz.
import React, { useEffect, useMemo, useState } from "react";
import { Image, LayoutChangeEvent, Platform, StyleSheet, Text, View } from "react-native";
import { Avatar, useOffice } from "../data/office";
import { useCharacter } from "../data/character";
import { MOUTHS } from "./mouths";
import { firstName, FEMALE } from "./people";
import { castFaces, officeGuest } from "./castFaces";
import { Cover, drawOrder, figState, KATIP_DESK, SCREEN, StageFig, stageLayout } from "./stageLayout";
import { currentAccount } from "../data/account";
import { CaseFile, Scene } from "../engine/types";
import { PhotoKey, PHOTOS } from "./photos";
import { C, F } from "./theme";

export { stateCourt, tintJudge } from "./castFaces";

/** Konuşulan satır: ağız kareleri metindeki seslere göre sıralanır. voice: satır seslendiriliyor mu. */
export interface Say { id: string; text: string; voice: boolean }
interface Props { c: CaseFile; scene: Scene; focus: string | null; talking: boolean; say?: Say }

export { DESK, MIN_VIEW, ROOM } from "./stageLayout";

/** Davanın kadrosuna fotoğraf atar (bkz. castFaces.ts). Oyuncu karakter seçmemişse hesaptaki ada göre bir avukat yüzü alır. */
export function cast(c: CaseFile, avatar?: Avatar | null) {
  return castFaces(c, avatar, FEMALE.has(firstName(currentAccount()?.adSoyad)));
}

/** Ağız kareleri: 0 kapalı, 1 açık ("a"), 2 yuvarlak ("o, u"), 3 yayvan ("e, i"), 4 yarı açık (ünsüzler). */
export function visemes(text: string): number[] {
  const out: number[] = [];
  for (const ch of text.toLocaleLowerCase("tr")) {
    if ("aâı".includes(ch)) out.push(1);
    else if ("oöuüû".includes(ch)) out.push(2);
    else if ("eiîé".includes(ch)) out.push(3);
    else if ("mbpv".includes(ch)) out.push(0);
    else if (/[.,;:!?…]/.test(ch)) out.push(0, 0, 0);
    else if (/\s/.test(ch)) out.push(0);
    else if (/[a-zçğşıöü0-9]/.test(ch)) out.push(4);
  }
  return out;
}

/** Konuşma süresine orantılı ağız hareketi: satırın harfleri konuşma hızında sırayla kareye dönüşür.
 *  Seslendirme açıkken ses sürdükçe (gerekirse başa dönerek), kapalıyken metnin okunma süresince oynar. */
export function useMouthFrame(on: boolean, say?: Say) {
  const [f, setF] = useState(0);
  useEffect(() => {
    if (!on || !say) { setF(0); return; }
    const seq = visemes(say.text);
    if (!seq.length) { setF(0); return; }
    const per = say.voice ? 66 : 58;
    const t0 = Date.now();
    const t = setInterval(() => {
      let i = Math.floor((Date.now() - t0) / per);
      if (i >= seq.length) { if (!say.voice) { setF(0); clearInterval(t); return; } i = i % seq.length; }
      setF(seq[i]);
    }, 40);
    return () => clearInterval(t);
  }, [on, say?.id, say?.voice]);
  return f;
}

/** faces: kadro dışarıdan verilirse (ör. "Duruşmayı izle") oyuncunun karakteri yerine bu yüzler kullanılır. */
export default function PhotoStage({ c, scene, focus, talking, say, faces: given }: Props & { faces?: Record<string, PhotoKey> }) {
  const { office } = useOffice();
  const mouth = useMouthFrame(talking && focus !== null && focus !== "narr", say);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  // Geniş ve basık ekranlarda (bilgisayar) sahne en fazla 2,1:1 oranında çizilir ve ortalanır; yoksa arka plan
  // yukarıdan ve aşağıdan çok kırpılır, hâkimin başı kesilir.
  const { w: W0, h: H } = box;
  const W = Math.min(W0, Math.round(H * 2.1));
  const me = useCharacter();
  const own = useMemo(() => (given ? null : cast(c, office?.avatar || me?.avatar)), [c.id, office?.avatar, me?.avatar, !!given]);
  const faces = given || own!;
  // Büroda konuşan diğer kişi (büro ortağı, müvekkilin yakını, şirket yetkilisi; karşılıklı modda müvekkil): ilk konuştuğu
  // satırdan itibaren büroda görünür, salona geçilince çıkar. Böylece yüzü olmayan bir ses konuşmaz.
  const [guest, setGuest] = useState<string | null>(null);
  useEffect(() => {
    if (scene !== "office") { if (guest) setGuest(null); return; }
    if (focus && focus !== guest && officeGuest(c, focus) && faces[focus]) setGuest(focus);
  }, [scene, focus, c.id]);
  // Büro görüşmesi: avukatın koltuğundan bakış; müvekkil masanın karşısındaki koltukta oturur.
  const L = useMemo(() => stageLayout({ c, scene, faces, focus, guest, W, H }), [c, scene, faces, focus, guest, W, H]);
  const { s, ox, oy } = L;
  const bg = PHOTOS[L.bg];
  const X = (x: number) => ox + x * s, Y = (y: number) => oy + y * s;

  const fig = (f: StageFig) => {
    const p = PHOTOS[f.photo];
    const h = f.h, w = h * (p.w / p.h);
    const { speaking, lit } = figState(f, focus);
    const m = speaking && mouth ? MOUTHS[f.photo] : undefined;
    return (
      <View key={f.key} pointerEvents="none" style={[{ position: "absolute", left: f.x - w / 2, bottom: f.bottom, width: w, height: h, zIndex: f.z + (speaking ? 1 : 0) }, f.flip && { transform: [{ scaleX: -1 }] }]}>
        <Image source={p.src} resizeMode="contain" accessibilityIgnoresInvertColors
          style={[{ width: w, height: h }, !lit && Platform.OS === "web" && styles.dim]} />
        {/* Telefonda karartma: aynı görselin siyaha boyanmış kopyası üstüne yarı saydam konur (saydam kenarlar korunur;
            iOS'taki "filter" karakterin çevresini gri bir kare olarak gösteriyordu). */}
        {!lit && Platform.OS !== "web" && (
          <Image source={p.src} resizeMode="contain" style={{ position: "absolute", left: 0, top: 0, width: w, height: h, tintColor: "#000", opacity: 0.5 }} />
        )}
        {m && (m.a || m.o) && (() => {
          // 1: açık, 2: yuvarlak, 3: yayvan (açık kare dikeyde basık), 4: yarı açık (açık kare yarı saydam).
          const src = mouth === 2 ? m.o || m.a : m.a || m.o;
          const extra = mouth === 3 ? { transform: [{ scaleY: 0.62 }, { scaleX: 1.06 }] } : mouth === 4 ? { opacity: 0.55 } : null;
          return <Image source={src} resizeMode="stretch"
            style={[{ position: "absolute", left: m.x * w, top: m.y * h, width: m.w * w, height: m.h * h }, extra]} />;
        })()}
      </View>
    );
  };
  // Kişilerin üstüne arka plandan yeniden çizilen parça (masa önü, zabıt masası ve ekranı).
  const cover = (r: Cover, i: number) => (
    <View key={"cv" + i} pointerEvents="none" style={{ position: "absolute", left: X(r.x0), width: (r.x1 - r.x0) * s, top: Y(r.top), height: (r.bottom - r.top) * s, overflow: "hidden", zIndex: r.z }}>
      <Image source={bg.src} resizeMode="cover" style={{ position: "absolute", left: ox - X(r.x0), top: oy - Y(r.top), width: bg.w * s, height: bg.h * s }} />
    </View>
  );

  return (
    <View style={styles.outer} onLayout={onLayout}>
     <View style={[styles.stage, W0 > W && { position: "absolute", top: 0, bottom: 0, left: (W0 - W) / 2, width: W }]}>
      {W > 0 && (
        <>
          {oy > 0 && (
            // Daraltılmış salonda üstte kalan şerit: fotoğrafın üst kenarı dikeyde uzatılır (duvar ve tavan devam eder).
            <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: oy + 1, overflow: "hidden" }}>
              <Image source={bg.src} resizeMode="stretch" style={{ position: "absolute", left: ox, top: 0, width: bg.w * s, height: (oy + 1) / 0.06 }} />
              <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.35)" }} />
            </View>
          )}
          <Image source={bg.src} resizeMode="cover" style={{ position: "absolute", left: ox, top: oy, width: bg.w * s, height: bg.h * s }} />
          {drawOrder(L, focus).map((d, i) => (d.k === "fig" ? fig(d.f) : cover(d.r, i)))}
          {L.screen && (
            // Kâtibin bilgisayar ekranı: arkası bize dönük; ayağı masaya oturur.
            <View pointerEvents="none" style={{ position: "absolute", left: X(SCREEN.x0), width: (SCREEN.x1 - SCREEN.x0) * s, top: Y(SCREEN.top), height: (KATIP_DESK.top + 3 - SCREEN.top) * s, zIndex: 2, alignItems: "center" }}>
              <View style={[styles.screen, { width: "100%", height: (SCREEN.bottom - SCREEN.top) * s, borderRadius: 3 * s }]} />
              <View style={[styles.stand, { width: SCREEN.standW * s, flex: 1 }]} />
              <View style={[styles.stand, { width: SCREEN.baseW * s, height: 2.5 * s, borderRadius: 2 * s }]} />
            </View>
          )}
          {L.plaque !== null && (
            <View style={styles.plaque} pointerEvents="none"><Text style={styles.plaqueText} numberOfLines={1}>{L.plaque}</Text></View>
          )}
          <View style={styles.vignette} pointerEvents="none" />
        </>
      )}
     </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1 },
  stage: { flex: 1, overflow: "hidden", backgroundColor: "#111", borderRadius: 10 },
  // Konuşmayan ön plan karakterleri saydamlaşmaz, kararır (arka plan içlerinden görünmesin).
  dim: (Platform.OS === "web" ? { filter: "brightness(0.5)" } : { filter: [{ brightness: 0.5 }] }) as any,
  screen: { backgroundColor: "#16171a", borderWidth: 1, borderColor: "#34363c", borderBottomColor: "#0b0b0c" },
  stand: { backgroundColor: "#24262b" },
  plaque: { position: "absolute", top: 8, alignSelf: "center", backgroundColor: "rgba(20,16,10,0.62)", borderRadius: 4, paddingHorizontal: 10, paddingVertical: 3, maxWidth: "80%" },
  plaqueText: { fontFamily: F.display, fontSize: 12, letterSpacing: 2, color: C.brass },
  vignette: { position: "absolute", left: 0, right: 0, bottom: 0, height: 40, backgroundColor: "rgba(0,0,0,0.0)" }
});
