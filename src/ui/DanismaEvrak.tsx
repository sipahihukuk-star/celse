// Derdini anlat: vatandaşın olayına evrak eklemesi (ihtarname, sözleşme, karar, bilirkişi raporu, mesaj ekran görüntüsü…).
// Dosyalar bu cihazda okunur (taranmışsa yazısı burada çıkarılır), kişisel veriler (adlar, numaralar, adresler) burada kodlanır;
// sunucuya ve yapay zekâya yalnız kodlu metin gider. Asıl dosya hiçbir yere yüklenmez ve saklanmaz.
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { mask } from "../engine/mask";
import { t } from "../i18n";
import { evrakMetniOku } from "./foyEvrak";
import { dosyaSec } from "./foyStil";
import { Btn } from "./kit";
import { C, F } from "./theme";

/** Sunucunun kabul ettiği en uzun kodlu evrak metni (danisma fonksiyonu: DANISMA_EVRAK). */
export const DANISMA_EVRAK_AZAMI = 40000;
const KABUL = ".udf,.doc,.docx,.txt,.pdf,.tif,.tiff,.jpg,.jpeg,.png";

export interface EkliEvrak { id: string; ad: string; ham: string; okunamadi?: string }

/** Ekli evrakı birlikte kodlar (aynı kişi her belgede aynı kodla görünsün) ve sınıra göre kırpar. */
export function evrakBirlestir(xs: EkliEvrak[]): { metin: string; kirpildi: boolean; kod: number } {
  const dolu = xs.filter(x => x.ham.trim());
  if (!dolu.length) return { metin: "", kirpildi: false, kod: 0 };
  const ham = dolu.map((x, i) => `=== Evrak ${i + 1}: ${x.ad.replace(/\.[^.]+$/, "")} ===\n${x.ham.trim()}`).join("\n\n");
  const m = mask(ham);
  const kirpildi = m.masked.length > DANISMA_EVRAK_AZAMI;
  return { metin: m.masked.slice(0, DANISMA_EVRAK_AZAMI), kirpildi, kod: Object.keys(m.map).length };
}

export function DanismaEvrak({ ekler, setEkler }: { ekler: EkliEvrak[]; setEkler: (xs: EkliEvrak[]) => void }) {
  const [okuma, setOkuma] = useState("");
  const [err, setErr] = useState("");
  const [gor, setGor] = useState(false);
  if (Platform.OS !== "web") {
    return (
      <View style={st.card}>
        <Text style={st.label}>{t("Evrak (isteğe bağlı)")}</Text>
        <Text style={st.hint}>{t("Evrak eklemek için celse.themiscode.com adresini aynı hesapla bilgisayardan ya da telefonun tarayıcısından açın.")}</Text>
      </View>
    );
  }
  const ekle = async () => {
    setErr("");
    const secilen = await dosyaSec(KABUL);
    if (!secilen.length) return;
    const yeni: EkliEvrak[] = [];
    for (const k of secilen) {
      const o = await evrakMetniOku(k, m => setOkuma(`${k.ad}: ${m}`));
      if ("hata" in o) { setErr(t("{ad} okunamadı: {hata}", { ad: k.ad, hata: o.hata })); continue; }
      if (!o.metin.trim()) { setErr(t("{ad} içinde okunabilir yazı bulunamadı.", { ad: k.ad })); continue; }
      yeni.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ad: k.ad, ham: o.metin, okunamadi: o.okunamadi });
    }
    setOkuma("");
    if (yeni.length) setEkler([...ekler, ...yeni]);
  };
  const b = evrakBirlestir(ekler);
  return (
    <View style={st.card}>
      <Text style={st.label}>{t("Evrak (isteğe bağlı)")}</Text>
      <Text style={st.hint}>{t("İhtarname, sözleşme, karar, bilirkişi raporu, yazışma ya da ekran görüntüsü ekleyebilirsiniz. Dosyalar bu cihazda okunur; adlar, kimlik ve telefon numaraları, adresler burada kodlanır. Yalnız kodlu metin gönderilir; asıl dosya hiçbir yere yüklenmez.")}</Text>
      {ekler.map(x => (
        <View key={x.id} style={st.row}>
          <Text style={st.ad} numberOfLines={1}>📄 {x.ad}</Text>
          <Text style={st.hint}>{t("{n} karakter", { n: x.ham.length.toLocaleString("tr-TR") })}</Text>
          <Pressable accessibilityRole="button" onPress={() => setEkler(ekler.filter(y => y.id !== x.id))} hitSlop={8}><Text style={st.sil}>{t("Kaldır")}</Text></Pressable>
        </View>
      ))}
      {!!okuma && <Text style={st.hint}>{t("Okunuyor: {m}", { m: okuma })}</Text>}
      {!!err && <Text style={st.err}>{err}</Text>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Btn kind="secondary" label={ekler.length ? t("+ Evrak ekle") : t("📎 Evrak ekle")} disabled={!!okuma} onPress={() => { ekle().catch(() => { setOkuma(""); setErr(t("Dosya okunamadı.")); }); }} />
        {!!b.metin && <Btn kind="ghost" label={gor ? t("Gönderilecek metni gizle") : t("Gönderilecek metni gör")} onPress={() => setGor(!gor)} />}
      </View>
      {!!b.metin && <Text style={st.hint}>{t("{k} kişisel bilgi kodlandı.", { k: b.kod })}{b.kirpildi ? " " + t("Evrak çok uzun; ilk {n} karakteri gönderilir.", { n: DANISMA_EVRAK_AZAMI.toLocaleString("tr-TR") }) : ""}</Text>}
      {gor && !!b.metin && <Text style={st.onizleme} selectable>{b.metin.slice(0, 4000)}{b.metin.length > 4000 ? "\n…" : ""}</Text>}
    </View>
  );
}

const st = StyleSheet.create({
  card: { gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  label: { fontFamily: F.bodyBold, fontSize: 15, color: C.text },
  hint: { fontFamily: F.body, fontSize: 13, lineHeight: 19, color: C.muted },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  ad: { flex: 1, fontFamily: F.bodyMed, fontSize: 14, color: C.text },
  sil: { fontFamily: F.bodyMed, fontSize: 13, color: C.bad, textDecorationLine: "underline" },
  err: { fontFamily: F.body, fontSize: 13, color: C.bad },
  onizleme: { fontFamily: F.mono, fontSize: 12, lineHeight: 17, color: C.textSoft, backgroundColor: C.panel2, borderRadius: 8, padding: 10 }
});
