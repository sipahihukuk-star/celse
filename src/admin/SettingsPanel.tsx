// Yönetim paneli · Oyun ayarları: not kırma oranı ve kariyerde ilerledikçe artışı.
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CHAPTERS } from "../data/career";
import { GameSettings, saveSettings, useSettings } from "../data/settings";
import { C, F } from "../ui/theme";
import { Field, Section, Seg, SmallBtn } from "./form";

const BASES = ["0.5", "0.75", "1", "1.25", "1.5", "2", "2.5", "3"];
const STEPS = ["0", "0.1", "0.15", "0.25", "0.35", "0.5"];

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const cur = useSettings();
  const [v, setV] = useState<GameSettings>(cur);
  const [msg, setMsg] = useState("");
  const pct = (x: number) => `%${Math.round(x * 100)}`;
  return (
    <Section title="Oyun ayarları" hint="Not kırma: oyuncu hatalı bir hamle yaptığında düşen puan bu oranla çarpılır. Doğru hamlenin puanı değişmez. Kariyer basamağı yükseldikçe oran kendiliğinden artar."
      right={<SmallBtn label="Kapat" onPress={onClose} />}>
      <Seg label="Web'de Pro kilidi" value={v.webProKilidi ? "acik" : "kapali"} onChange={x => setV({ ...v, webProKilidi: x === "acik" })}
        options={[{ v: "kapali", label: "Kapalı (web'de her şey açık)" }, { v: "acik", label: "Açık (2. bölümden sonrası Pro)" }]} />
      <Text style={st.note}>Mağazada satış açılınca "Açık"a getirin. Web'den satın alma yapılmaz; telefonda alınan Pro, aynı hesapla web'de de geçerlidir.</Text>
      <Seg label="Celse Avukat satışı" value={v.avukatSatis ? "acik" : "kapali"} onChange={x => setV({ ...v, avukatSatis: x === "acik" })}
        options={[{ v: "kapali", label: "Kapalı (yakında yazar)" }, { v: "acik", label: "Açık (satın alma görünür)" }]} />
      <Text style={st.note}>App Store ve Google Play'de celse_avukat_aylik ve celse_avukat_yillik ürünleri onaylanıp RevenueCat'e bağlanınca "Açık"a getirin.</Text>
      <Seg label="Temel not kırma oranı" value={String(v.notKirma)} onChange={x => setV({ ...v, notKirma: Number(x) })}
        options={BASES.map(b => ({ v: b, label: pct(Number(b)) }))} />
      <Seg label="Her basamakta artış" value={String(v.notKirmaArtis)} onChange={x => setV({ ...v, notKirmaArtis: Number(x) })}
        options={STEPS.map(b => ({ v: b, label: "+" + pct(Number(b)) }))} />
      <View style={st.table}>
        {CHAPTERS.map(ch => (
          <View key={ch.level} style={st.row}>
            <Text style={st.lvl}>{ch.title}</Text>
            <Text style={st.val}>{pct(v.notKirma * (1 + v.notKirmaArtis * (ch.level - 1)))}</Text>
          </View>
        ))}
      </View>
      <Text style={st.note}>Örnek: dosyada −10 puanlık bir hata, %150 oranda −15 puan düşürür.</Text>
      <Field label="iPhone bağlantısı (App Store ya da TestFlight herkese açık bağlantısı)" value={v.iosLink} onChange={x => setV({ ...v, iosLink: x })} mono />
      <Field label="Android bağlantısı (Google Play ya da test katılım bağlantısı)" value={v.androidLink} onChange={x => setV({ ...v, androidLink: x })} mono />
      <Text style={st.note}>Web sitesindeki QR kodları ve https://celse.themiscode.com/indir.html sayfası bu bağlantılara yönlenir.</Text>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <SmallBtn label="Kaydet" tone="accent" onPress={async () => {
          const where = await saveSettings(v);
          setMsg(where === "sunucu" ? "Kaydedildi; bütün oyunculara uygulanır." : "Yalnız bu cihaza kaydedildi (sunucu ayar tablosu yok ya da yönetici girişi yapılmadı).");
        }} />
        {!!msg && <Text style={st.note}>{msg}</Text>}
      </View>
    </Section>
  );
}

const st = StyleSheet.create({
  table: { borderWidth: 1, borderColor: C.line, borderRadius: 8, overflow: "hidden" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: C.panel2 },
  lvl: { fontFamily: F.body, fontSize: 14, color: C.text },
  val: { fontFamily: F.monoBold, fontSize: 14, color: C.brass },
  note: { fontFamily: F.body, fontSize: 13, color: C.muted }
});
