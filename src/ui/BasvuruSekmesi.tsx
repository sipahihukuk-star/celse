// "📝 Başvuru yap" sekmesi: arabuluculuk, arabulucu belgesi, bilirkişi raporu, icra takibi, dava, idari dava, idareye başvuru,
// suç duyurusu, AYM, AİHM, Tazminat Komisyonu, kurum başvurusu ve görülen davada talepler tek yerde. Tür seçilince ne
// gerektiği listelenir; o türdeki bir föy seçilir ya da yeni başvuru föyü açılır ve föy "başvuru" görünümünde açılır
// (dilekçe / belge yazma, icra takibi, talepler). Gelen evrak (UYAP'tan indirilen) föyün kendi görünümünde kalır.
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { BASVURULAR, basvuruBul } from "../data/basvuru";
import { bosFoy, Foy, foyBaslik, foySil } from "../data/foy";
import { buroYetkim } from "../data/buro";
import { KaydirSil } from "./KaydirSil";
import { DAVA_TURLERI, turBilgi } from "../data/foyTurleri";
import { t } from "../i18n";
import { s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";

export function BasvuruSekmesi({ liste, onAc }: { liste: Foy[]; onAc: (id: string, basvuru: string, taslak?: Foy) => void }) {
  const [secK, setSecK] = useState<string | null>(null);
  const [ara, setAra] = useState("");
  const [hata, setHata] = useState("");
  // "Hangi dava": hukuk davası, soruşturma… için konu (föyde "Konu" olur); boş bırakılabilir.
  const [konu, setKonu] = useState("");
  const [silinen, setSilinen] = useState<Set<string>>(new Set());
  const [yetki, setYetki] = useState<string | null>(null);
  useEffect(() => { buroYetkim().then(setYetki).catch(() => {}); }, []);
  const b = basvuruBul(secK || undefined);
  const turler = b ? b.foyTurleri || [b.foyTur] : [];
  const foyler = useMemo(() => {
    if (!b) return [];
    const q = ara.trim().toLocaleLowerCase("tr");
    return liste.filter(f => turler.includes(f.tur || "hukuk") && f.durum !== "kapali")
      .filter(f => !q || [foyBaslik(f), f.mahkeme, f.esasNo, f.foyNo, f.muvekkil, f.karsiTaraf].join(" ").toLocaleLowerCase("tr").includes(q))
      .sort((a, c) => c.guncelleme.localeCompare(a.guncelleme)).slice(0, 30);
  }, [liste, secK, ara]);

  const yeni = async () => {
    if (!b) return;
    try { const f = bosFoy({ tur: b.foyTur, davaTuru: konu.trim() }); onAc(f.id, b.k, f); }
    catch (e) { setHata(t(String((e as Error).message || e))); }
  };

  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
      <Text style={s.eyebrow}>{t("BAŞVURU YAP")}</Text>
      <Text style={s.title}>{t("📝 Başvuru yap")}</Text>
      <Text style={s.hint}>{t("Yapacağınız başvuruyu seçin: neler gerektiği listelenir, başvuruyu bir föyde hazırlarsınız (dilekçe, belge, icra takibi, talep). UYAP'tan gelen ve yüklenen evrak föylerin kendisinde, Föyler sekmesinde kalır.")}</Text>

      {!b && <View style={s.grid}>
        {BASVURULAR.map(x => {
          const on = x.k === secK;
          return (
            <Pressable key={x.k} onPress={() => { setSecK(on ? null : x.k); setAra(""); setHata(""); setKonu(""); }} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={({ pressed }) => [s.girisK, on && { borderColor: C.brass, backgroundColor: C.bordo }, pressed && { opacity: 0.85 }]}>
              <Text style={s.girisT}>{t(x.ad)}</Text>
              <Text style={s.hint}>{t(x.aciklama)}</Text>
            </Pressable>
          );
        })}
      </View>}

      {b && <View style={s.row}><Btn kind="ghost" label={t("‹ Başka başvuru seç")} onPress={() => setSecK(null)} /></View>}
      {b && (
        <View style={[s.card, { gap: 8, borderColor: C.brass }]}>
          <Text style={s.cardT}>{t(b.ad)}</Text>
          <Text style={s.hint}>{t(b.aciklama)}</Text>
          <Text style={s.secT}>{t("Hazırlanması gerekenler")}</Text>
          {b.gerekenler.map((x, i) => <Text key={i} style={s.body}>☐ {t(x)}</Text>)}

          <Text style={s.secT}>{t("Yeni mi, var olan föyde mi?")}</Text>
          {!!DAVA_TURLERI[b.foyTur]?.length && !b.talep && (
            <View style={{ gap: 4 }}>
              <Text style={s.label}>{t("Konu (isteğe bağlı)")}</Text>
              <View style={s.chips}>
                {DAVA_TURLERI[b.foyTur]!.map(x => (
                  <Pressable key={x} onPress={() => setKonu(konu === x ? "" : x)} style={[s.chip, konu === x && s.chipOn]}>
                    <Text style={[s.chipT, konu === x && s.chipTOn]}>{t(x)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          {!b.talep && <View style={s.row}><Btn label={b.icra ? t("➕ Yeni icra takibi aç") : t("➕ Yeni aç: {tur}", { tur: t(turBilgi(b.foyTur).ad) }) + (konu ? " · " + t(konu) : "")} onPress={yeni} /></View>}
          {!!hata && <Text style={s.err}>{hata}</Text>}
          {foyler.length > 0 || ara ? (
            <>
              <TextInput value={ara} onChangeText={setAra} placeholder={t("Var olan föylerde ara: ad, mahkeme, dosya no…")} placeholderTextColor={C.muted} style={s.inputTek} />
              {foyler.length > 0 && <Text style={s.hint}>{t("Silmek için satırı yana kaydırın (bilgisayarda uzun basın).")}</Text>}
              {foyler.filter(f => !silinen.has(f.id)).map(f => (
                <KaydirSil key={f.id} kapali={yetki === "yaz"} soru={t("“{ad}” föyü, evrakı ve görevleriyle bu cihazdan silinsin mi?", { ad: [f.foyNo, foyBaslik(f)].filter(Boolean).join(" · ") })}
                  onSil={async () => { await foySil(f); setSilinen(x => new Set([...x, f.id])); }}>
                  {uzunBas => (
                    <Pressable onPress={() => onAc(f.id, b.k)} onLongPress={uzunBas} delayLongPress={500} style={({ pressed }) => [s.foy, pressed && { opacity: 0.85 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.foyT} numberOfLines={1}>{[f.foyNo, foyBaslik(f)].filter(Boolean).join(" · ")}</Text>
                        <Text style={s.hint} numberOfLines={1}>{[t(turBilgi(f.tur).ad), f.mahkeme, f.esasNo].filter(Boolean).join(" · ")}</Text>
                      </View>
                      <Text style={s.link}>{t("Aç ›")}</Text>
                    </Pressable>
                  )}
                </KaydirSil>
              ))}
              {!foyler.length && <Text style={s.hint}>{t("Aramaya uyan açık föy yok.")}</Text>}
            </>
          ) : <Text style={s.hint}>{b.talep ? t("Açık dava ya da icra föyü yok.") : t("Bu türde açık föy yok; yukarıdan yenisini açın.")}</Text>}
        </View>
      )}
    </ScrollView>
  );
}
