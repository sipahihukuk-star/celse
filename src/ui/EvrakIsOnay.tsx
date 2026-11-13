// "📋 Yapılacak işleri çıkar": yeni gelen evrakta (tutanağın ara kararı, kurum yazısı) bize düşen işler önce gösterilir;
// avukat seçer, metni ve son günü düzeltir, "Yapılacaklara ekle" der. Seçilenler hem föyün Yapılacaklar'ına hem iş listesine
// girer; seçilmeyenler bir daha sorulmaz. Eski tarihli evraktan çıkanlar seçili gelmez. Okuma bu cihazda, kurallarla yapılır.
import React, { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Foy, foyBaslik, foyGetir, foyKaydet, tarihCoz, tarihYaz } from "../data/foy";
import { adaylariUygula, EvrakIsAdayi, evrakIsAdaylari } from "../data/otoIs";
import { t } from "../i18n";
import { s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";

interface Satir extends EvrakIsAdayi { sec: boolean; tarihYazi: string }

/** Föy listesinden (ya da tek föyden) bekleyen adaylar. */
export const bekleyenAdaylar = (liste: Foy[], hepsi = false) => liste.filter(f => f.durum !== "kapali" || hepsi).flatMap(f => evrakIsAdaylari(f, undefined, hepsi));

/** yerel: föy sayfasında açık föy (kaydedilmemiş değişiklikler ezilmesin diye sayfanın kendi degistir'i kullanılır). */
export function EvrakIsOnay({ liste, hepsi, baslik, onBitti, yerel }: { liste: Foy[]; hepsi?: boolean; baslik?: string; onBitti?: (m: string) => void; yerel?: { f: () => Foy; degistir: (ek: Partial<Foy>) => void } }) {
  const adaylar = useMemo(() => bekleyenAdaylar(liste, hepsi), [liste, hepsi]);
  const [acik, setAcik] = useState(false);
  const [satirlar, setSatirlar] = useState<Satir[]>([]);
  const [busy, setBusy] = useState(false);
  const [mesaj, setMesaj] = useState("");
  const foyAd = (id: string) => { const f = liste.find(x => x.id === id); return f ? [f.foyNo, foyBaslik(f), [f.mahkeme, f.esasNo].filter(Boolean).join(" ")].filter(Boolean).join(" · ") : ""; };

  const ac = () => {
    setSatirlar(adaylar.map(a => ({ ...a, sec: !a.eski, tarihYazi: a.tarih ? tarihYaz(a.tarih) : "" })));
    setAcik(true); setMesaj("");
  };
  const degis = (id: string, ek: Partial<Satir>) => setSatirlar(xs => xs.map(x => (x.id === id ? { ...x, ...ek } : x)));
  const uygula = async (hicbiri = false) => {
    setBusy(true);
    try {
      let eklenen = 0;
      for (const foyId of [...new Set(satirlar.map(x => x.foyId))]) {
        const f = yerel ? yerel.f() : await foyGetir(foyId);
        if (!f || f.id !== foyId) continue;
        const xs = satirlar.filter(x => x.foyId === foyId);
        const sec = hicbiri ? [] : xs.filter(x => x.sec && x.metin.trim()).map(x => ({ id: x.id, metin: x.metin.trim(), tarih: tarihCoz(x.tarihYazi)?.slice(0, 10) }));
        const red = xs.filter(x => !sec.some(y => y.id === x.id)).map(x => x.id);
        eklenen += sec.length;
        if (yerel) yerel.degistir(adaylariUygula(f, sec, red));
        else await foyKaydet({ ...f, ...adaylariUygula(f, sec, red) });
      }
      const m = hicbiri ? t("Evraktan çıkan işler eklenmedi; bir daha sorulmayacak.") : t("{n} iş Yapılacaklar'a ve föyüne eklendi.", { n: eklenen });
      setMesaj(m); setAcik(false); onBitti?.(m);
    } catch (e) { setMesaj(t(String((e as Error).message || e))); }
    setBusy(false);
  };

  if (!adaylar.length && !acik) return mesaj ? <Text style={[s.hint, { color: C.good }]}>{mesaj}</Text> : null;
  if (!acik && hepsi) return <View style={s.row}><Btn kind="ghost" label={t("📋 Evraktan yapılacak işleri çıkar ({n})", { n: adaylar.length })} onPress={ac} /></View>;
  if (!acik) return (
    <View style={{ gap: 4, borderWidth: 1, borderColor: C.mid, borderRadius: 10, padding: 10 }}>
      <Text style={[s.body, { fontWeight: "700", color: C.mid }]}>{baslik || t("Yeni gelen evrakta size düşen {n} iş var", { n: adaylar.length })}</Text>
      <Text style={s.hint}>{t("Tutanakların ara kararından ve kurum yazılarından bu cihazda çıkarıldı. Görüp onaylayın; onaylananlar Yapılacaklar'a ve föyün içine eklenir.")}</Text>
      <View style={s.row}><Btn label={t("📋 Yapılacak işleri çıkar ({n})", { n: adaylar.length })} onPress={ac} /></View>
    </View>
  );
  const secili = satirlar.filter(x => x.sec).length;
  return (
    <View style={{ gap: 8, borderWidth: 1, borderColor: C.mid, borderRadius: 10, padding: 10 }}>
      <Text style={[s.body, { fontWeight: "700" }]}>{t("Evraktan çıkan işler")}</Text>
      <Text style={s.hint}>{t("Yapmanız gerekenleri işaretleyin; metni ve son günü düzeltebilirsiniz. İşaretlemedikleriniz bir daha sorulmaz.")}</Text>
      {satirlar.map(x => (
        <View key={x.id} style={{ gap: 4, borderLeftWidth: 3, borderLeftColor: x.sec ? C.good : C.line, paddingLeft: 8 }}>
          <View style={[s.row, { gap: 8, alignItems: "flex-start" }]}>
            <Pressable onPress={() => degis(x.id, { sec: !x.sec })} accessibilityRole="checkbox" accessibilityState={{ checked: x.sec }} style={{ paddingTop: 8 }}>
              <Text style={{ fontSize: 18, color: x.sec ? C.good : C.muted }}>{x.sec ? "☑" : "☐"}</Text>
            </Pressable>
            <TextInput defaultValue={x.metin} onChangeText={v => degis(x.id, { metin: v })} multiline placeholderTextColor={C.muted} style={[s.input, { flex: 1, minHeight: 44 }]} />
            <TextInput value={x.tarihYazi} onChangeText={v => degis(x.id, { tarihYazi: v })} placeholder={t("son gün")} placeholderTextColor={C.muted} style={[s.inputTek, { width: 110 }]} />
          </View>
          <Text style={s.hint} numberOfLines={2}>{foyAd(x.foyId)} · {x.evrakAd}{x.eski ? " · " + t("eski tarihli evrak") : ""}</Text>
        </View>
      ))}
      <View style={[s.row, { gap: 8, flexWrap: "wrap" }]}>
        <Btn label={busy ? t("Ekleniyor…") : t("✓ Seçilenleri Yapılacaklar'a ekle ({n})", { n: secili })} disabled={busy || !secili} onPress={() => uygula()} />
        <Btn kind="ghost" label={t("Hiçbirini ekleme")} disabled={busy} onPress={() => uygula(true)} />
        <Btn kind="ghost" label={t("Sonra bakarım")} disabled={busy} onPress={() => setAcik(false)} />
      </View>
      {!!mesaj && <Text style={s.hint}>{mesaj}</Text>}
    </View>
  );
}
