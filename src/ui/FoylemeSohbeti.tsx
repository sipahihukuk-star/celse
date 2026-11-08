// Toplu evrak yüklemede föyleme sohbeti: avukat yazar ("vekilliği belli olmayanları beklet", "arabuluculukları davalarına
// bağla", "ceza soruşturmalarını ayrı aç"), yapay zekâ önizlemeye uygulanacak işlemleri döner. Giden yalnız kodlu özet ve
// kodlanmış mesajdır (foyleme.ts); cevaptaki kodlar burada gerçek adlara çevrilir. Onaylamadan hiçbir şey kaydedilmez.
import React, { useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, View } from "react-native";
import type { Foy } from "../data/foy";
import { FoyleIslem, foyleSor, geriAc, Kodlama, kodlaDurum } from "../data/foyleme";
import type { HavuzEvrak, HavuzGrup, Hedef } from "../data/havuz";
import { t } from "../i18n";
import { s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";

interface Mesaj { kim: "avukat" | "yz"; metin: string; islem?: number }

export function FoylemeSohbeti(p: {
  gruplar: HavuzGrup[]; ayrilamayan: HavuzEvrak[]; liste: Foy[]; avukatlar: string[];
  hedefi: (g: HavuzGrup) => Hedef; oncesi: (g: HavuzGrup) => string | undefined;
  uygula: (islemler: FoyleIslem[], k: Kodlama) => void;
}) {
  const [mesajlar, setMesajlar] = useState<Mesaj[]>([]);
  const [yazi, setYazi] = useState("");
  const [bekliyor, setBekliyor] = useState(false);
  const gecmis = useRef<string[]>([]);
  const ornekler = [
    t("Tarafları ve vekilliğim belli olanları föyle, ötekileri beklet."),
    t("Ceza soruşturmalarını ayrı, arabuluculukları ayrı föyle; davalarına kronolojik sırayla bağla."),
    t("2. grupta davalı vekiliyiz.")
  ];

  const gonder = async (metin: string) => {
    const m = metin.trim();
    if (!m || bekliyor) return;
    const k = kodlaDurum(p.gruplar, p.hedefi, p.oncesi, p.ayrilamayan, p.liste, p.avukatlar);
    const kodlu = k.kodla(m);
    setMesajlar(x => [...x, { kim: "avukat", metin: m }]);
    setYazi(""); setBekliyor(true);
    const r = await foyleSor(k.durum, kodlu, gecmis.current);
    setBekliyor(false);
    if (!r.ok) {
      const hata = r.status === 403 ? t("Föyleme sohbeti Celse Avukat paketiyle kullanılır.") : r.status === 404 || /bilinmeyen|unknown/i.test(r.error) ? t("Föyleme sohbeti sunucuda henüz açılmadı (danisma fonksiyonu güncellenmeli).") : r.error;
      setMesajlar(x => [...x, { kim: "yz", metin: hata }]);
      return;
    }
    gecmis.current = [...gecmis.current, "Avukat: " + kodlu, "Yardımcı: " + r.data.cevap].slice(-12);
    const islemler = (r.data.islemler || []).filter(x => x && typeof x === "object");
    p.uygula(islemler, k);
    setMesajlar(x => [...x, { kim: "yz", metin: geriAc(r.data.cevap || "", k.geri), islem: islemler.length }]);
  };

  return (
    <View style={[s.card, { borderColor: C.brassDim }]}>
      <Text style={s.cardT}>💬 {t("Föyleme sohbeti")}</Text>
      <Text style={s.hint}>{t("Nasıl föyleneceğini yazın; önizleme buna göre değişir, onaylamadan hiçbir şey kaydedilmez. Yapay zekâya kişi adları gitmez: adlar bu cihazda KİŞİ-1, KİŞİ-2 gibi kodlanır, evrakın kendisi ve dosya adları hiç gitmez.")}</Text>
      {mesajlar.length > 0 && (
        <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 8 }}>
          {mesajlar.map((x, i) => (
            <View key={i} style={{ alignSelf: x.kim === "avukat" ? "flex-end" : "flex-start", maxWidth: "88%", backgroundColor: x.kim === "avukat" ? C.panel2 : "transparent", borderWidth: 1, borderColor: x.kim === "avukat" ? C.line : C.brassDim, borderRadius: 12, padding: 10 }}>
              <Text style={s.body}>{x.metin}</Text>
              {x.kim === "yz" && !!x.islem && <Text style={[s.hint, { color: C.brass }]}>{t("{n} değişiklik önizlemeye uygulandı.", { n: x.islem })}</Text>}
            </View>
          ))}
        </ScrollView>
      )}
      {bekliyor && <View style={[s.row, { alignItems: "center" }]}><ActivityIndicator color={C.brass} /><Text style={s.hint}>{t("Düşünüyor…")}</Text></View>}
      {!mesajlar.length && (
        <View style={{ gap: 6 }}>
          {ornekler.map(o => <Btn key={o} kind="ghost" label={o} onPress={() => gonder(o)} />)}
        </View>
      )}
      <View style={[s.row, { alignItems: "flex-end" }]}>
        <TextInput value={yazi} onChangeText={setYazi} multiline placeholder={t("Örn. Yüksel Sipahi'nin vekil olduğu dosyaları föyle; suç duyurularını ceza soruşturması olarak aç…")} placeholderTextColor={C.muted} style={[s.input, { flex: 1, minHeight: 60 }]} />
        <Btn label={t("Gönder")} disabled={bekliyor || !yazi.trim()} onPress={() => gonder(yazi)} />
      </View>
    </View>
  );
}
