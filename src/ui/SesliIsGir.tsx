// Föyün "Yapılacaklar" bölümünde sesle (ya da yazarak) iş ekleme alanı: 🎙'a basıp "yarın bilirkişi raporuna itiraz et,
// ayrıca cuma günü müvekkili ara" denince iki iş son günleriyle eklenir. Söylenenler bu cihazda işlenir; yapay zekâya gitmez.
// Her eklemenin altında "Geri al" vardır.
import React, { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Gorev, tarihYaz, yeniId } from "../data/foy";
import { bugunStr } from "../data/isTakibi";
import { sestenIsler, SesliIs } from "../data/sestenIs";
import { t } from "../i18n";
import { s } from "./foyStil";
import { Btn } from "./kit";
import { izinYokMetni, tanimaIzni, tanimaSinifi } from "./konusmaTanima";
import { C } from "./theme";

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
interface Mesaj { soz: string; isler: SesliIs[]; idler: string[]; geriAlindi?: boolean }

export function SesliIsGir({ onEkle, onGeriAl }: { onEkle: (xs: Gorev[]) => void; onGeriAl: (idler: string[]) => void }) {
  const [metin, setMetin] = useState("");
  const [ara, setAra] = useState("");
  const [dinliyor, setDinliyor] = useState(false);
  const [hata, setHata] = useState("");
  const [mesajlar, setMesajlar] = useState<Mesaj[]>([]);
  const rec = useRef<Any>(null);
  const R = tanimaSinifi();

  const gonder = (soz: string) => {
    const x = soz.trim();
    if (!x) return;
    const isler = sestenIsler(x, bugunStr());
    if (!isler.length) { setHata(t("Bu cümleden iş çıkaramadım; ör. “yarın bilirkişi raporuna itiraz et” deyin.")); return; }
    const yeni: Gorev[] = isler.map(i => ({ id: yeniId("g"), metin: i.metin, tarih: i.tarih, bitti: false, kaynak: "elle", eklenme: bugunStr() }));
    onEkle(yeni);
    setMesajlar(m => [...m.slice(-5), { soz: x, isler, idler: yeni.map(g => g.id) }]);
    setMetin(""); setHata("");
  };

  const dinle = async () => {
    if (dinliyor) { try { rec.current?.stop(); } catch { /* yok say */ } return; }
    if (!R) return;
    if (!(await tanimaIzni())) { setHata(t(izinYokMetni())); return; }
    setHata(""); setAra("");
    const r = new R();
    r.lang = "tr-TR"; r.interimResults = true; r.continuous = true;
    let son = "";
    r.onresult = (e: Any) => { let a = ""; for (let i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) son += e.results[i][0].transcript + " "; else a += e.results[i][0].transcript; } setAra(son + a); };
    r.onerror = (e: Any) => { setDinliyor(false); if (e?.error === "not-allowed" || e?.error === "service-not-allowed") setHata(t(izinYokMetni())); else if (e?.error !== "aborted" && e?.error !== "no-speech") setHata(t("Konuşma tanıma hatası: {k}", { k: String(e?.error) })); };
    r.onend = () => { setDinliyor(false); setAra(""); if (son.trim()) gonder(son); };
    rec.current = r;
    try { r.start(); setDinliyor(true); } catch (err) { setHata(String((err as Error).message || err)); }
  };

  const geriAl = (i: number) => {
    const m = mesajlar[i];
    if (!m || m.geriAlindi) return;
    onGeriAl(m.idler);
    setMesajlar(xs => xs.map((y, j) => (j === i ? { ...y, geriAlindi: true } : y)));
  };

  return (
    <View style={{ gap: 6, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 8, backgroundColor: C.panel }}>
      <Text style={[s.label, { color: C.brass }]}>{t("🎙 Sesle iş ekle")}</Text>
      {mesajlar.map((m, i) => (
        <View key={i} style={{ gap: 3 }}>
          <Text style={[s.hint, { alignSelf: "flex-end", textAlign: "right", backgroundColor: C.panel2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, maxWidth: "90%" }]}>“{m.soz}”</Text>
          <View style={{ alignSelf: "flex-start", maxWidth: "95%", borderLeftWidth: 3, borderLeftColor: m.geriAlindi ? C.line : C.good, paddingLeft: 8, gap: 2 }}>
            {m.isler.map((x, j) => (
              <Text key={j} style={[s.body, m.geriAlindi && { textDecorationLine: "line-through", color: C.muted }]}>
                ☐ {x.metin}<Text style={s.hint}>{x.tarih ? "  · " + t("son gün") + " " + tarihYaz(x.tarih) : "  · " + t("tarihsiz")}</Text>
              </Text>
            ))}
            <Text style={s.hint}>
              {m.geriAlindi ? t("Geri alındı.") : t("{n} iş eklendi.", { n: m.isler.length })}
              {!m.geriAlindi && <Text style={[s.link, { fontSize: 13 }]} onPress={() => geriAl(i)}>{"  " + t("Geri al")}</Text>}
            </Text>
          </View>
        </View>
      ))}
      {!!ara && <Text style={[s.hint, { fontStyle: "italic" }]}>{ara}</Text>}
      <View style={[s.row, { gap: 6, alignItems: "center" }]}>
        {!!R && (
          <Pressable onPress={dinle} accessibilityRole="button" accessibilityLabel={dinliyor ? t("Dinlemeyi bitir") : t("Konuşarak iş ekle")}
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: dinliyor ? C.bad : C.brass }}>
            <Text style={{ fontSize: 20, color: C.brassInk }}>{dinliyor ? "■" : "🎙"}</Text>
          </Pressable>
        )}
        <TextInput value={metin} onChangeText={setMetin} onSubmitEditing={() => gonder(metin)} multiline
          placeholder={dinliyor ? t("Dinliyorum… bitince ■'a basın") : t("Söyleyin ya da yazın: “yarın bilirkişi raporuna itiraz et, ayrıca cuma müvekkili ara”")}
          placeholderTextColor={C.muted} style={[s.input, { flex: 1, minHeight: 44 }]} />
        <Btn kind="secondary" label={t("Ekle")} disabled={!metin.trim()} onPress={() => gonder(metin)} />
      </View>
      {!R && <Text style={s.hint}>{t("Bu tarayıcıda konuşma tanıma yok; yazarak ekleyebilirsiniz (Chrome ya da Edge'de 🎙 görünür).")}</Text>}
      {!!hata && <Text style={[s.hint, { color: C.bad }]}>{hata}</Text>}
      <Text style={s.hint}>{t("Tarih söyleyebilirsiniz: bugün, yarın, 3 gün içinde, haftaya, cuma günü, 25.11.2026, 12 Aralık, ay sonuna kadar. Birden çok işi “ayrıca” ya da “bir de” ile ayırın. Söyledikleriniz bu cihazda işlenir.")}</Text>
    </View>
  );
}
