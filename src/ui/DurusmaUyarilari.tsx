// Dışarıdan bakış: bütün föylerdeki duruşma ve e-duruşma konuları tek kartta (Yapılacaklar ekranının başında).
// Her satırda dosya, duruşma günü, ne beklendiği ve son güne kalan; föyü açmadan oradan işaretlenir.
import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { Durusma, DurusmaUyari, tumDurusmaUyarilari } from "../data/durusma";
import { Foy, foyBaslik, foyGetir, foyKaydet, tarihYaz } from "../data/foy";
import { t } from "../i18n";
import { Acilir } from "./Acilir";
import { s } from "./foyStil";
import { C } from "./theme";

export const D_RENK = { gecikti: C.bad, bugun: C.bad, acil: C.bad, uyari: C.mid, dikkat: C.mid } as const;

export function DurusmaUyarilari({ liste, onAc, en = 50 }: { liste: Foy[]; onAc: (id: string) => void; en?: number }) {
  const us = useMemo(() => tumDurusmaUyarilari(liste), [liste]);
  if (!us.length) return (
    <View style={[s.card, { paddingVertical: 10, borderColor: C.good + "88" }]}>
      <Text style={[s.body, { color: C.good, fontWeight: "700" }]}>⚖ {t("Duruşmalar: bekleyen bir şey yok ✓")}</Text>
    </View>
  );
  const isle = async (u: DurusmaUyari, ek: Partial<Durusma>) => {
    const f = (await foyGetir(u.f.id)) || u.f;
    await foyKaydet({ ...f, durusmalar: (f.durusmalar || []).map(x => (x.id === u.d!.id ? { ...x, ...ek } : x)) });
  };
  const bugun = new Date().toISOString().slice(0, 10);
  return (
    <View style={[s.card, { gap: 6, borderColor: C.mid }]}>
      <Text style={[s.body, { color: C.text, fontWeight: "700" }]}>⚖ {t("Duruşma ve e-duruşma ({n})", { n: us.length })}</Text>
      {us.slice(0, en).map((u, i) => (
        <View key={u.f.id + (u.d?.id || "") + u.tur + i} style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, borderLeftWidth: 4, borderLeftColor: D_RENK[u.duzey], paddingLeft: 8, paddingVertical: 2 }}>
          <Pressable onPress={() => onAc(u.f.id)} style={{ flex: 1, minWidth: 220 }}>
            <Text style={s.fileT} numberOfLines={1}>{foyBaslik(u.f)}</Text>
            <Text style={[s.hint, { color: D_RENK[u.duzey] }]} numberOfLines={2}>
              {[u.d ? tarihYaz(u.d.tarih) : "", t(u.metin), u.kalan < 0 ? t("{n} gün geçti", { n: -u.kalan }) : u.kalan === 0 ? t("bugün") : t("son güne {n} gün", { n: u.kalan }), [u.f.mahkeme, u.f.esasNo].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
            </Text>
          </Pressable>
          {u.d && u.tur === "girildi" && (
            <Acilir etiket={t("İşaretle")} secili="-" genislik={150} onSec={k => k !== "-" && isle(u, { girildi: k as "evet" | "hayir" })}
              secenekler={[{ k: "-", ad: t("Seçin") }, { k: "evet", ad: "✓ " + t("Girildi") }, { k: "hayir", ad: "✗ " + t("Girilmedi") }]} />
          )}
          {u.d && u.tur === "eSor" && (
            <Acilir etiket={t("E-duruşma")} secili="-" genislik={190} onSec={k => k !== "-" && isle(u, k === "talep" ? { e: "talep", eTalep: bugun } : { e: "istenmeyecek" })}
              secenekler={[{ k: "-", ad: t("Seçin") }, { k: "istenmeyecek", ad: t("Talep edilmeyecek") }, { k: "talep", ad: "⏳ " + t("Talep edildi") }]} />
          )}
          {u.d && u.tur === "eKarar" && (
            <Acilir etiket={t("Karar")} secili="-" genislik={150} onSec={k => k !== "-" && isle(u, { e: k as "kabul" | "red", eKarar: bugun })}
              secenekler={[{ k: "-", ad: t("Bekleniyor") }, { k: "kabul", ad: "✓ " + t("Kabul") }, { k: "red", ad: "✗ " + t("Red") }]} />
          )}
        </View>
      ))}
    </View>
  );
}
