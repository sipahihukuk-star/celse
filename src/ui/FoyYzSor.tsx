// Föyde "Yapay zekâya sor": avukat dosyası hakkında yazarak ya da konuşarak sorar (ne durumda, nerede kaldık, sırada ne
// var, mevzuata göre hangi yollar açık, hangi süreler işliyor). Dosya cihazda kodlanır, kodlu hâli gider; cevap cihazda gerçek
// adlarla açılır, sesli okunabilir ve föye kaydedilir. Önerilen işler tek dokunuşla yapılacaklara eklenir.
import React, { useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, TextInput, View } from "react-native";
import { Foy, Gorev, yeniId, YzSoru } from "../data/foy";
import { bugunStr } from "../data/isTakibi";
import { t } from "../i18n";
import { foyaSor } from "./foySorCagri";
import { BASLIK, okunacak, onerilenIsler } from "../data/yzCevap";
import { s } from "./foyStil";
import { Btn } from "./kit";
import { sesliDur, sesliOku, useSesliOkuma } from "./sesliOku";
import { C } from "./theme";
import { izinYokMetni, tanimaIzni, tanimaSinifi } from "./konusmaTanima";

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const SR = (): Any => tanimaSinifi();
const HAZIR = ["Bu dosya ne durumda, nerede kaldık?", "Sırada ne yapmalıyım?", "Mevzuata göre hangi yollar açık?", "Hangi süreler işliyor?"];
export function FoyYzSor({ f, onDegistir }: { f: Foy; tur?: string; onDegistir: (ek: Partial<Foy>) => void }) {
  const [soru, setSoru] = useState("");
  const [bekle, setBekle] = useState(false);
  const [hata, setHata] = useState("");
  const [dinliyor, setDinliyor] = useState(false);
  const [ara, setAra] = useState("");
  const [sesli, setSesli] = useState(false);
  const okuyor = useSesliOkuma();
  const rec = useRef<Any>(null);
  const sohbet = f.yzSohbet || [];

  const sor = async (q: string, sesle = false) => {
    const x = q.trim();
    if (x.length < 3 || bekle) return;
    setHata(""); setBekle(true); sesliDur();
    try {
      const r = await foyaSor(f, x);
      if (!r.ok) { setHata(t(r.hata, r.vars)); return; }
      const yeni = r.yeni, cevap = yeni.cevap;
      onDegistir({ yzSohbet: [...sohbet, yeni].slice(-30) });
      setSoru("");
      if (sesle || sesli) sesliOku(okunacak(cevap), 1.05);
    } catch (e) { setHata(t(String((e as Error).message || e))); }
    finally { setBekle(false); }
  };

  const dinle = async () => {
    const R = SR();
    if (!R) return;
    if (!(await tanimaIzni())) { setHata(t(izinYokMetni())); return; }
    sesliDur(); setHata(""); setAra("");
    try { rec.current?.abort(); } catch { /* yok say */ }
    const r = new R();
    r.lang = "tr-TR"; r.interimResults = true; r.continuous = false;
    let son = "";
    r.onresult = (e: Any) => { let a = ""; for (let i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) son += e.results[i][0].transcript; else a += e.results[i][0].transcript; } setAra(son + a); };
    r.onerror = (e: Any) => { setDinliyor(false); if (e?.error === "not-allowed" || e?.error === "service-not-allowed") setHata(t(izinYokMetni())); else if (e?.error !== "aborted" && e?.error !== "no-speech") setHata(t("Konuşma tanıma hatası: {k}", { k: String(e?.error) })); };
    r.onend = () => { setDinliyor(false); setAra(""); if (son.trim()) { setSoru(son.trim()); sor(son, true); } };
    rec.current = r;
    try { r.start(); setDinliyor(true); } catch (err) { setHata(String((err as Error).message || err)); }
  };

  const isEkle = (y: YzSoru) => {
    const xs = onerilenIsler(y.cevap).filter(o => !f.gorevler.some(g => g.metin === o.metin));
    if (!xs.length) return;
    const yeni: Gorev[] = xs.map(o => ({ id: yeniId("g"), metin: o.metin, tarih: o.tarih, bitti: false, kaynak: "yapay", eklenme: bugunStr() }));
    onDegistir({ gorevler: [...f.gorevler, ...yeni] });
  };
  const tarihSaat = (x: string) => { const d = new Date(x); return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

  return (
    <View style={{ gap: 10 }}>
      <Text style={s.hint}>{t("Dosyanız hakkında yazarak ya da konuşarak sorun: ne durumda, nerede kaldık, sırada ne var, mevzuata göre hangi yollar açık, hangi süreler işliyor. Künye, işler, notlar ve önemli evrak bu cihazda kodlanır; adlar ve numaralar gönderilmez. Gerekirse mevzuatın güncel metni resmî sitelerde aranır. Son karar sizindir; madde ve süreleri kontrol edin.")}</Text>
      <View style={s.row}>
        {HAZIR.map(h => <Btn key={h} kind="ghost" label={t(h)} disabled={bekle} onPress={() => sor(t(h))} />)}
      </View>
      <View style={s.addRow}>
        <TextInput value={dinliyor ? ara || t("Dinliyorum…") : soru} onChangeText={setSoru} onSubmitEditing={() => sor(soru)} editable={!dinliyor}
          // Enter gönderir; Shift+Enter yeni satır açar (telefon klavyesinde tuş "Gönder" yazar).
          onKeyPress={(e: Any) => { const n = e?.nativeEvent; if (n?.key === "Enter" && !n.shiftKey) { e.preventDefault?.(); sor(soru); } }}
          enterKeyHint="send" returnKeyType="send" blurOnSubmit={false}
          placeholder={t("Sorunuzu yazın, Enter ile gönderin: ör. bilirkişi raporuna itiraz süresi ne zaman doluyor?")} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1, minWidth: 220 }]} multiline />
        {!!SR() && <Btn kind={dinliyor ? "primary" : "secondary"} label={dinliyor ? t("⏹ Dur") : t("🎙 Konuşarak sor")} disabled={bekle} onPress={dinliyor ? () => { try { rec.current?.stop(); } catch { /* yok say */ } } : dinle} />}
        <Btn label={bekle ? t("Düşünüyor…") : t("Gönder ➤")} disabled={bekle || soru.trim().length < 3} onPress={() => sor(soru)} />
      </View>
      <Pressable onPress={() => setSesli(!sesli)} style={[s.row, { alignItems: "center" }]} accessibilityRole="checkbox" accessibilityState={{ checked: sesli }}>
        <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: C.brassDim, backgroundColor: sesli ? C.brassDim : "transparent" }} />
        <Text style={s.hint}>{t("Cevapları her zaman sesli oku (konuşarak sorunca zaten okunur)")}</Text>
      </Pressable>
      {bekle && <View style={[s.row, { alignItems: "center" }]}><ActivityIndicator color={C.brass} /><Text style={s.hint}>{t("Dosya okunuyor, gerekirse mevzuat kontrol ediliyor… (yarım dakika kadar sürebilir)")}</Text></View>}
      {!!hata && <Text style={[s.hint, { color: C.bad }]}>{hata}</Text>}

      {[...sohbet].reverse().map(y => {
        const isler = onerilenIsler(y.cevap);
        const eklenmemis = isler.filter(o => !f.gorevler.some(g => g.metin === o.metin));
        return (
          <View key={y.id} style={{ gap: 6, padding: 10, borderWidth: 1, borderColor: C.line, borderRadius: 10 }}>
            <Text style={[s.body, { color: C.muted }]}>🗣 {y.soru} <Text style={s.hint}>· {tarihSaat(y.tarih)}</Text></Text>
            {y.cevap.split("\n").filter(z => z.trim()).map((z, i) => (
              <Text key={i} style={BASLIK.test(z.trim()) ? { color: C.brass, fontWeight: "700", fontSize: 14, marginTop: 4 } : [s.body, { color: C.text }]}>{z.trim()}</Text>
            ))}
            {!!y.kaynaklar?.length && (
              <View style={{ gap: 2 }}>
                <Text style={s.hint}>{t("Kontrol edilen kaynaklar:")}</Text>
                {y.kaynaklar.map(k => <Pressable key={k.url} onPress={() => Linking.openURL(k.url)}><Text style={[s.hint, { textDecorationLine: "underline" }]} numberOfLines={1}>{k.baslik}</Text></Pressable>)}
              </View>
            )}
            <View style={s.row}>
              <Btn kind="ghost" label={okuyor ? t("⏹ Sesi kes") : t("🔊 Sesli oku")} onPress={() => (okuyor ? sesliDur() : sesliOku(okunacak(y.cevap), 1.05))} />
              {eklenmemis.length > 0 && <Btn kind="secondary" label={t("+ Önerilen {n} işi yapılacaklara ekle", { n: eklenmemis.length })} onPress={() => isEkle(y)} />}
              {isler.length > 0 && !eklenmemis.length && <Text style={[s.hint, { color: C.good, alignSelf: "center" }]}>{t("Önerilen işler yapılacaklarda")}</Text>}
              <Pressable onPress={() => onDegistir({ yzSohbet: sohbet.filter(z => z.id !== y.id) })} style={{ alignSelf: "center" }}><Text style={s.sil}>{t("Sil")}</Text></Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}
