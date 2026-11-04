// "Duruşmayı izle": danışmanın senaryosu oyunun kendi fotoğraflı sahnesiyle (PhotoStage) oynatılır: görüşme oyundaki görüşme
// odasında (danışan masanın karşısında oturur), karşı tarafın görüşmesi karşı vekilin bakışından aynı odada, duruşma ve karar o mahkeme türünün
// oyundaki salonunda. Yüzler oyunun havuzlarından gelir (izleOrtak.kadro); adlar yalnız rollerdir. Satırlar seslendirilir (ses açık başlar, 🔇 ile kapanır) ve
// otomatik ilerler. Sonda sesli kayıt (MP3) ve video (web) indirilir; metin özeti yazdırma ikincil seçenektir.
// Eğitim amaçlı canlandırmadır, hukuki görüş değildir; karakterler gerçek avukat değildir.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { alanAdi, Danisma, Kim, Senaryo, sesKaydi } from "../data/danisma";
import { WEB_URL } from "../data/settings";
import { locale, t } from "../i18n";
import { Adim, adimlar, gorunum, kadro, Kadro, kimAdi, ozetHtml, ozetMetni, parcalar, sahneBaslik, UYARI_KISA } from "./izleOrtak";
import { videoDestekli, videoKaydet, VideoIptal } from "./izleVideo";
import { Btn } from "./kit";
import PhotoStage from "./PhotoStage";
import { C, F } from "./theme";
import { lineAudioUrl, prefetchLines, speakLine, stopSpeaking, useSpeaking } from "./voice";

interface Props { s: Senaryo; d: Danisma; onClose: () => void; basla?: "son" }

function useTypewriter(text: string) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const tm = setInterval(() => setN(v => { if (v >= text.length) { clearInterval(tm); return v; } return v + 2; }), 18);
    return () => clearInterval(tm);
  }, [text]);
  return { shown: text.slice(0, n), done: n >= text.length, finish: () => setN(text.length) };
}

export default function DanismaWatch({ s, d, onClose, basla }: Props) {
  const steps = useMemo(() => adimlar(s), [s]);
  const k = useMemo(() => kadro(d, s), [d.id, s]);
  const [pos, setPos] = useState(0);
  const [son, setSon] = useState(basla === "son");
  const [auto, setAuto] = useState(true);
  const [ses, setSes] = useState(true);
  const speaking = useSpeaking();
  const { width } = useWindowDimensions();
  const wide = width >= 860;

  const step: Adim = steps[Math.min(pos, steps.length - 1)];
  const sahne = s.sahneler[step.si];
  const line = step.k === "satir" ? sahne.satirlar[step.li] : null;
  const baslik = sahneBaslik(sahne.tur, s);
  const tw = useTypewriter(line ? line.metin : "");

  const next = () => { if (pos + 1 >= steps.length) { stopSpeaking(); setSon(true); } else setPos(pos + 1); };
  const prev = () => setPos(p => Math.max(0, p - 1));
  const skip = () => {
    const i = steps.findIndex((a, j) => j > pos && a.k === "kart");
    if (i < 0) { stopSpeaking(); setSon(true); } else setPos(i);
  };

  // Seslendirme: her yeni satır (ve sahne başlığı) kendi sesiyle okunur; sıradaki üç satır önceden hazırlanır.
  const heard = useRef(false);
  const since = useRef(Date.now());
  useEffect(() => {
    heard.current = false; since.current = Date.now();
    if (son) return;
    if (!ses) { stopSpeaking(); return; }
    const say = line ? { text: line.metin, sp: k.ses[line.kim] } : { text: `${baslik.baslik}. ${baslik.alt}`, sp: k.ses.narr };
    speakLine(say.text, say.sp, true);
    prefetchLines(steps.slice(pos + 1, pos + 4).map(a => a.k === "satir"
      ? { text: s.sahneler[a.si].satirlar[a.li].metin, speaker: k.ses[s.sahneler[a.si].satirlar[a.li].kim] }
      : { text: `${sahneBaslik(s.sahneler[a.si].tur, s).baslik}. ${sahneBaslik(s.sahneler[a.si].tur, s).alt}`, speaker: k.ses.narr }), true);
  }, [pos, ses, son]);
  useEffect(() => () => { stopSpeaking(); }, []);

  // Otomatik ilerleme: ses açıksa satırın sesi bitince; kapalıysa (ya da ses gelmezse) okuma süresi kadar bekler.
  useEffect(() => {
    if (!auto || son) return;
    const read = line ? Math.max(1800, line.metin.length * 45) : 2600;
    if (ses && speaking) {
      heard.current = true;
      const cap = setTimeout(next, read + 20000);
      return () => clearTimeout(cap);
    }
    if (line && !tw.done) return;
    // Ses bittiyse kısa bir ara; ses hiç gelmediyse ya da hemen kesildiyse metnin okunabileceği kadar beklenir.
    const min = line ? line.metin.length * 30 : 2600;
    const tm = setTimeout(next, ses && heard.current ? Math.max(550, min - (Date.now() - since.current)) : read);
    return () => clearTimeout(tm);
  }, [auto, pos, tw.done, speaking, ses, son]);

  if (son) return <EndScreen s={s} d={d} k={k} onClose={onClose} onReplay={() => { setPos(0); setSon(false); }} />;

  const talking = !!line && (ses ? speaking || !tw.done : true);
  const tap = () => (line && !tw.done ? tw.finish() : next());

  return (
    <View style={st.root}>
      <View style={st.top}>
        <Btn kind="ghost" label={t("‹ Çık")} onPress={() => { stopSpeaking(); onClose(); }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.topT} numberOfLines={1}>{baslik.baslik}</Text>
          <Text style={st.topS} numberOfLines={1}>{t("Duruşmayı izle")} · {pos + 1} / {steps.length}</Text>
        </View>
        <Btn kind="ghost" label={ses ? "🔊" : "🔇"} onPress={() => setSes(!ses)} />
        <Btn kind="ghost" label={auto ? "❚❚" : "▶"} onPress={() => setAuto(!auto)} />
      </View>
      <Text style={st.warn}>{t(UYARI_KISA)}</Text>

      <View style={[st.stageWrap, { flex: wide ? 1.5 : 1 }]}>
        <WatchStage k={k} si={step.si} tur={sahne.tur} focus={line ? line.kim : null} talking={talking}
          say={line ? { id: `${pos}`, text: line.metin, voice: ses } : undefined} />
        {step.k === "kart" && (
          <View style={st.card} pointerEvents="none">
            <Text style={st.cardT}>{baslik.baslik}</Text>
            <Text style={st.cardS}>{baslik.alt}</Text>
          </View>
        )}
      </View>

      <View style={[st.panel, wide ? { flex: 0.85 } : { flexShrink: 1, maxHeight: "50%" }]}>
        <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={st.panelIn}>
          {line ? (
            <Pressable onPress={tap} accessibilityRole="button" accessibilityLabel={t("İleri")}>
              <View style={st.np}><View style={[st.dot, { backgroundColor: dotOf(line.kim) }]} /><Text style={st.npT}>{kimAdi(line.kim, s)}</Text></View>
              {sahne.tur === "karar" && <Text style={st.kararChip}>{t("EĞİTİM AMAÇLI DEĞERLENDİRME · GERÇEK KARAR DEĞİLDİR")}</Text>}
              <Text style={st.dlg}>{tw.shown}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={tap} accessibilityRole="button">
              <Text style={st.cardP}>{baslik.alt}</Text>
            </Pressable>
          )}
          <View style={st.ctrl}>
            <Btn kind="ghost" label={t("‹ Geri")} onPress={prev} disabled={pos === 0} style={pos === 0 && { opacity: 0.4 }} />
            <Btn kind="ghost" label={t("Sahneyi atla »")} onPress={skip} />
            <Btn kind="next" label={step.k === "kart" ? t("Başla ›") : t("İleri ›")} onPress={tap} />
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const dotOf = (kim: Kim) => (kim === "hakim" ? C.bordoHi : kim === "bizAvukat" || kim === "biz" ? C.good : C.mid);

/* ---------- sahne: oyunun sahnesi ---------- */
function WatchStage({ k, si, tur, focus, talking, say }: {
  k: Kadro; si: number; tur: Senaryo["sahneler"][number]["tur"]; focus: Kim | null; talking: boolean;
  say?: { id: string; text: string; voice: boolean };
}) {
  const g = useMemo(() => gorunum(k, tur), [k, tur]);
  // Her sahne yeni baştan kurulur (büroda bir önceki sahnenin konuğu kalmasın).
  return <PhotoStage key={si} c={k.c} scene={g.scene} faces={g.faces} focus={focus ? g.key[focus] : null} talking={talking} say={say} />;
}

/* ---------- son ekran: kayıtlar ve özet ---------- */
function EndScreen({ s, d, k, onClose, onReplay }: { s: Senaryo; d: Danisma; k: Kadro; onClose: () => void; onReplay: () => void }) {
  const [busy, setBusy] = useState<"" | "mp3" | "video">("");
  const [prog, setProg] = useState("");
  const [msg, setMsg] = useState<{ t: string; ok?: boolean } | null>(null);
  const [tutanak, setTutanak] = useState(false);
  const iptal = useRef<VideoIptal>({ iptal: false });
  const preview = useRef<any>(null);
  const videoOk = useMemo(() => videoDestekli(), []);

  const indir = (url: string, ad?: string) => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const a = document.createElement("a");
      a.href = url; if (ad) a.download = ad; a.rel = "noopener"; a.target = "_blank";
      document.body.appendChild(a); a.click(); a.remove();
    } else Linking.openURL(url);
  };

  const mp3 = async () => {
    setBusy("mp3"); setMsg(null); setProg(t("Sesli kayıt hazırlanıyor…"));
    try {
      let r = await sesKaydi(d.id);
      if (!r.ok && r.error === "parça gerekli") {
        const list = parcalar(s, k);
        const yollar: (string | null)[] = new Array(list.length).fill(null);
        let n = 0, i = 0;
        // Satırlar dörder dörder seslendirilir (oynatırken seslendirilmiş olanlar hazır gelir).
        await Promise.all(Array.from({ length: 4 }, async () => {
          while (i < list.length) {
            const j = i++;
            const url = await lineAudioUrl(list[j].metin, list[j].speaker);
            const m = url ? url.split("/object/public/ses/")[1] : null;
            yollar[j] = m ? decodeURIComponent(m.split("?")[0]) : null;
            setProg(t("Satırlar seslendiriliyor… {n}/{m}", { n: ++n, m: list.length }));
          }
        }));
        if (yollar.some(x => !x)) { setMsg({ t: t("Seslendirme şu an kullanılamıyor. Biraz sonra yeniden deneyin.") }); return; }
        setProg(t("Kayıt birleştiriliyor…"));
        r = await sesKaydi(d.id, list.map((p, j) => ({ yol: yollar[j] as string, ara: p.ara })));
      }
      if (!r.ok) { setMsg({ t: t(r.error, r.vars) }); return; }
      indir(r.data.url, "celse-durusma.mp3");
      setMsg({ t: Platform.OS === "web" ? t("Sesli kayıt indiriliyor (celse-durusma.mp3).") : t("Sesli kayıt açılıyor; paylaş menüsünden kaydedebilirsiniz."), ok: true });
    } finally { setBusy(""); setProg(""); }
  };

  const video = async () => {
    setBusy("video"); setMsg(null); iptal.current = { iptal: false };
    try {
      const host = preview.current as unknown as HTMLElement | null;
      const r = await videoKaydet({
        s, d, k, iptal: iptal.current, onizleme: host || undefined,
        ilerleme: (asama, oran) => setProg(asama === "hazirlik"
          ? t("Video hazırlanıyor: sesler ve görseller yükleniyor… %{n}", { n: Math.round(oran * 100) })
          : t("Video kaydediliyor… %{n} (gerçek sürede kaydedilir; sekmeyi açık tutun)", { n: Math.round(oran * 100) }))
      });
      const url = URL.createObjectURL(r.blob);
      indir(url, "celse-durusma." + r.uzanti);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMsg({ t: t("Video indirildi (celse-durusma.{uzanti}).", { uzanti: r.uzanti }) + (r.sessiz ? " " + t("Seslendirme kullanılamadığı için video sessizdir.") : ""), ok: true });
    } catch (e) {
      if (!iptal.current.iptal) setMsg({ t: t("Video hazırlanamadı: {hata}", { hata: String((e as Error)?.message || e) }) });
    } finally { setBusy(""); setProg(""); }
  };

  const yazdir = () => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.getElementById("celse-yazdir")?.remove();
      const f = document.createElement("iframe");
      f.id = "celse-yazdir";
      f.setAttribute("style", "position:fixed;right:0;bottom:0;width:0;height:0;border:0");
      document.body.appendChild(f);
      const doc = f.contentWindow?.document;
      if (!doc) return;
      doc.open(); doc.write(ozetHtml(s, d)); doc.close();
      setTimeout(() => { try { f.contentWindow?.focus(); f.contentWindow?.print(); } catch { /* yok say */ } }, 250);
    } else Share.share({ title: t("Celse · Duruşmayı izle"), message: ozetMetni(s, d) }).catch(() => {});
  };

  const karar = s.sahneler.find(x => x.tur === "karar");
  return (
    <ScrollView contentContainerStyle={st.endWrap}>
      <View style={{ flexDirection: "row" }}><Btn kind="ghost" label={t("‹ Danışmaya dön")} onPress={onClose} /></View>
      <Text style={st.eyebrow}>{t("DURUŞMAYI İZLE")}</Text>
      <Text style={st.endT}>{t("Canlandırma bitti")}</Text>
      <Text style={st.endM}>{t(alanAdi(d.alan)).toLocaleUpperCase(locale())} · {s.mahkeme || t("Mahkeme")}</Text>
      <View style={st.warnBox}><Text style={st.warnT}>{t(UYARI_KISA)}</Text><Text style={st.warnD}>{s.uyari || ""}</Text></View>

      <View style={[st.box, { borderColor: C.brass }]}>
        <Text style={st.boxT}>{t("Kaydı alın")}</Text>
        <Btn label={busy === "mp3" ? t("Hazırlanıyor…") : t("🎧 Sesli kaydı indir (MP3)")} disabled={!!busy} onPress={mp3} />
        <Text style={st.hint}>{t("Bütün sahneler, her karakter kendi sesiyle, tek bir MP3 dosyasında. Bir kez hazırlanır; sonra hemen iner.")}</Text>
        {Platform.OS === "web" ? (videoOk ? (
          <>
            <Btn label={busy === "video" ? t("Video kaydediliyor…") : t("🎬 Videoyu indir")} disabled={!!busy} onPress={video} />
            <Text style={st.hint}>{t("Sahneler, altyazı ve seslerle video olarak kaydedilir. Kayıt canlandırma süresince (birkaç dakika) sürer; bu sekmeyi açık tutun.")}</Text>
            {busy === "video" && <Btn kind="ghost" label={t("Videoyu iptal et")} onPress={() => { iptal.current.iptal = true; }} />}
          </>
        ) : <Text style={st.hint}>{t("Bu tarayıcı video kaydını desteklemiyor; Chrome, Edge ya da Firefox'un güncel sürümünü deneyin.")}</Text>) : (
          <>
            <Text style={st.hint}>{t("Video web sürümünde indirilir. Aynı hesapla giriş yaptığınızda bu danışma orada da açılır.")}</Text>
            <Btn kind="ghost" label={t("🎬 Videoyu web'de hazırla ›")} onPress={() => Linking.openURL(`${WEB_URL}?danisma=${d.id}`)} />
          </>
        )}
        {!!prog && <Text style={st.prog}>{prog}</Text>}
        {!!msg && <Text style={[st.msg, msg.ok && { color: C.good }]}>{msg.t}</Text>}
        {Platform.OS === "web" && <View ref={preview} style={[st.preview, busy !== "video" && { display: "none" }]} />}
      </View>

      <View style={st.box}>
        <Text style={st.boxT}>{t("Olay özeti")}</Text>
        <Text style={st.body}>{s.ozet || d.olay}</Text>
      </View>
      {!!karar && (
        <View style={st.box}>
          <Text style={st.boxT}>{t("Hâkimin eğitim amaçlı değerlendirmesi")}</Text>
          {karar.satirlar.map((l, i) => <Text key={i} style={st.body}>{l.metin}</Text>)}
        </View>
      )}
      <View style={st.box}>
        <Pressable onPress={() => setTutanak(!tutanak)} accessibilityRole="button"><Text style={st.boxT}>{tutanak ? "▾ " : "▸ "}{t("Tutanak (bütün konuşmalar)")}</Text></Pressable>
        {tutanak && s.sahneler.filter(x => x.tur !== "karar").map((sh, i) => (
          <View key={i} style={{ gap: 6 }}>
            <Text style={st.sec}>{sahneBaslik(sh.tur, s).baslik}</Text>
            {sh.satirlar.map((l, j) => <Text key={j} style={st.body}><Text style={st.who}>{kimAdi(l.kim, s)}: </Text>{l.metin}</Text>)}
          </View>
        ))}
      </View>
      <View style={st.row}>
        <Btn kind="ghost" label={t("↺ Baştan izle")} onPress={onReplay} />
        <Btn kind="ghost" label={Platform.OS === "web" ? t("Metni yazdır") : t("Metni paylaş")} onPress={yazdir} />
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, width: "100%", maxWidth: 1080, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  topT: { fontFamily: F.displayMed, fontSize: 16, color: C.text },
  topS: { fontFamily: F.mono, fontSize: 11, color: C.muted },
  warn: { fontFamily: F.bodyMed, fontSize: 12, lineHeight: 16, color: C.textSoft, backgroundColor: "rgba(208,166,76,0.14)", borderWidth: 1, borderColor: C.mid, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  stageWrap: { minHeight: 200 },
  card: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(12,4,7,0.72)", borderRadius: 10, alignItems: "center", justifyContent: "center", padding: 18, gap: 8, zIndex: 20 },
  cardT: { fontFamily: F.display, fontSize: 26, color: C.brass, textAlign: "center" },
  cardS: { fontFamily: F.body, fontSize: 15, lineHeight: 21, color: C.textSoft, textAlign: "center", maxWidth: 520 },
  cardP: { fontFamily: F.bodyItalic, fontSize: 17, lineHeight: 25, color: C.textSoft },
  panel: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 12, minHeight: 170 },
  panelIn: { padding: 14, gap: 8 },
  np: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 6, maxWidth: "100%" },
  dot: { width: 9, height: 9, borderRadius: 5 },
  npT: { fontFamily: F.displayMed, fontSize: 14, color: C.text, flexShrink: 1 },
  kararChip: { fontFamily: F.monoBold, fontSize: 10, letterSpacing: 1, color: C.mid, marginBottom: 4 },
  dlg: { fontFamily: F.body, fontSize: 17, lineHeight: 25, color: C.text, minHeight: 50 },
  ctrl: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 6 },
  endWrap: { width: "100%", maxWidth: 720, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 20, gap: 12 },
  eyebrow: { fontFamily: F.mono, fontSize: 12, letterSpacing: 2.5, color: C.muted },
  endT: { fontFamily: F.display, fontSize: 30, color: C.brass },
  endM: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: C.brassDim },
  warnBox: { borderWidth: 1, borderColor: C.mid, borderRadius: 10, padding: 12, gap: 4, backgroundColor: "rgba(208,166,76,0.10)" },
  warnT: { fontFamily: F.bodyBold, fontSize: 14, color: C.text },
  warnD: { fontFamily: F.body, fontSize: 12, lineHeight: 17, color: C.textSoft },
  box: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 14, gap: 10 },
  boxT: { fontFamily: F.displayMed, fontSize: 19, color: C.text },
  sec: { fontFamily: F.bodyBold, fontSize: 15, color: C.brass, marginTop: 6 },
  who: { fontFamily: F.bodyBold, color: C.text },
  body: { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.textSoft },
  hint: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: C.muted },
  prog: { fontFamily: F.bodyMed, fontSize: 14, color: C.mid },
  msg: { fontFamily: F.bodyMed, fontSize: 14, color: C.bad },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  preview: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000", borderRadius: 8, overflow: "hidden" }
});
