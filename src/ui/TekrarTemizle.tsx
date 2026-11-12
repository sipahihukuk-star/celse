// Föylerde biriken tekrar eden evrak (aynı yazı başka adla, UDF ile PDF'i, ikinci kez indirilmiş) için temizlik kartı.
// Önce ne silineceği gösterilir; her tekrar kümesinde yazısı olan, en önce eklenen evrak kalır. Silinenlerin asıl dosyası da
// bu cihazdan kalkar; kaldırılan evrak öteki cihazda da föyden çıkar (eşitleme "silinen" listesiyle).
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { dosyaSil, Foy, foyBaslik, FoyEvrak, foylerKaydet, silineniNotEt } from "../data/foy";
import { tekrarEdenEvrak } from "../data/tekillik";
import { t } from "../i18n";
import { s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";

export function TekrarTemizle({ liste, onBitti }: { liste: Foy[]; onBitti?: (m: string) => void }) {
  // Hesap ağır olabilir: ekran açıldıktan kısa süre sonra yapılır.
  const [hazir, setHazir] = useState(false);
  useEffect(() => { const z = setTimeout(() => setHazir(true), 1500); return () => clearTimeout(z); }, []);
  const tekrar = useMemo(() => (hazir ? liste.map(f => ({ f, xs: tekrarEdenEvrak(f) })).filter(x => x.xs.length) : []), [hazir, liste]);
  const [ac, setAc] = useState(false);
  const [busy, setBusy] = useState(false);
  const toplam = tekrar.reduce((n, x) => n + x.xs.length, 0);
  if (!toplam) return null;
  const temizle = async () => {
    setBusy(true);
    try {
      const yeni: Foy[] = tekrar.map(({ f, xs }) => { const ids = new Set(xs.map(e => e.id)); return { ...f, evraklar: f.evraklar.filter(e => !ids.has(e.id)), silinen: silineniNotEt(f, [...ids]) }; });
      await foylerKaydet(yeni);
      for (const { xs } of tekrar) for (const e of xs) dosyaSil(e.id).catch(() => {});
      onBitti?.(t("{n} föyden {m} tekrar eden evrak kaldırıldı.", { n: tekrar.length, m: toplam }));
    } finally { setBusy(false); setAc(false); }
  };
  return (
    <View style={[s.card, { borderColor: C.mid, gap: 6 }]}>
      <Text style={[s.body, { fontWeight: "800" }]}>{t("🧹 {m} tekrar eden evrak ({n} föyde)", { m: toplam, n: tekrar.length })}</Text>
      <Text style={s.hint}>{t("Aynı evrak föye birden çok kez girmiş (aynı yazı başka adla, UDF ile PDF'i, ikinci kez indirilmiş). Her birinden yazısı olan, en önce eklenen kalır; ötekiler kaldırılır. Tarihi ya da sayısı farklı olan benzer evrak (ör. iki ayrı zabıt) tekrar sayılmaz.")}</Text>
      {!ac
        ? <View style={s.row}><Btn kind="secondary" label={t("Göster")} onPress={() => setAc(true)} /></View>
        : <>
          {tekrar.slice(0, 30).map(({ f, xs }) => (
            <View key={f.id} style={{ gap: 2, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 4 }}>
              <Text style={[s.hint, { color: C.text, fontWeight: "700" }]} numberOfLines={1}>{foyBaslik(f)} · {f.mahkeme} {f.esasNo}</Text>
              {xs.slice(0, 6).map((e: FoyEvrak) => <Text key={e.id} style={s.hint} numberOfLines={1}>– {e.ad}</Text>)}
              {xs.length > 6 && <Text style={s.hint}>{t("ve {n} evrak daha", { n: xs.length - 6 })}</Text>}
            </View>
          ))}
          {tekrar.length > 30 && <Text style={s.hint}>{t("ve {n} föy daha", { n: tekrar.length - 30 })}</Text>}
          <View style={[s.row, { gap: 8, alignItems: "center" }]}>
            <Btn label={busy ? t("Kaldırılıyor…") : t("🧹 Tekrarları kaldır ({m})", { m: toplam })} disabled={busy} onPress={temizle} />
            <Pressable onPress={() => setAc(false)}><Text style={s.link}>{t("Vazgeç")}</Text></Pressable>
          </View>
          <Text style={s.hint}>{t("Önce “Yedek al” ile yedek almanızı öneririz.")}</Text>
        </>}
    </View>
  );
}
