// Tevkil avukatlar: bütün föylerdeki tevkil kayıtları kişi başına tek kartta (kim, baro ve sicil, telefon, hangi dosyalar,
// kaç duruşmaya girdi, ne ödendi). Telefon ya da e-posta burada değişince o avukatın bütün föylerdeki kaydı güncellenir.
import React, { useMemo } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { Foy, foyBaslik, foyGetir, foyKaydet } from "../data/foy";
import { TevkilKisi, tevkilListesi, tlYaz } from "../data/hesap";
import { t } from "../i18n";
import { s } from "./foyStil";
import { Btn } from "./kit";
import { SonraKaydet } from "./SonraKaydet";
import { C } from "./theme";

export function TevkilListesi({ liste, onAc, onKapat }: { liste: Foy[]; onAc: (id: string) => void; onKapat: () => void }) {
  const kisiler = useMemo(() => tevkilListesi(liste.filter(f => !f.ozel)), [liste]);
  const hepsineYaz = async (k: TevkilKisi, alan: "telefon" | "eposta" | "baro" | "sicil", v: string) => {
    for (const d of k.dosyalar) {
      const f = (await foyGetir(d.f.id)) || d.f;
      await foyKaydet({ ...f, tevkil: (f.tevkil || []).map(x => (x.id === d.k.id ? { ...x, [alan]: v.trim() || undefined } : x)) });
    }
  };
  const genel = kisiler.reduce((a, k) => a + k.toplam, 0);
  return (
    <ScrollView contentContainerStyle={[s.wrap, { maxWidth: 1000 }]} keyboardShouldPersistTaps="handled">
      <View style={s.head}><Btn kind="ghost" label={t("‹ Föylere dön")} onPress={onKapat} /></View>
      <Text style={s.eyebrow}>{t("DAVA TAKİBİ · TEVKİL")}</Text>
      <Text style={s.title}>{t("Tevkil avukatlar")}</Text>
      <Text style={s.hint}>{t("Föylerdeki yetki belgelerinden ve tutanaklardan bulunan ya da elle eklenen meslektaşlar. Ödemeler föyün “Ücret, ödemeler ve masraflar” bölümüne “Tevkil ödemesi” olarak yazılır. Toplam ödenen: {x}.", { x: tlYaz(genel) })}</Text>
      {!kisiler.length && <View style={s.card}><Text style={s.hint}>{t("Henüz tevkil avukat kaydı yok. Föyün “Tevkil avukatlar” bölümünden ekleyin ya da yetki belgesini evraka ekleyin.")}</Text></View>}
      {kisiler.map(k => (
        <View key={k.anahtar} style={[s.card, { gap: 8 }]}>
          <View style={[s.row, { alignItems: "center" }]}>
            <Text style={[s.body, { color: C.text, fontWeight: "700", flex: 1 }]}>{k.ad}{k.baro ? " · " + k.baro + " Barosu" : ""}{k.sicil ? " · " + t("sicil {n}", { n: k.sicil }) : ""}</Text>
            <Text style={[s.body, { color: C.text, fontWeight: "700" }]}>{tlYaz(k.toplam)}</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
            {([["telefon", "Telefon", 160], ["eposta", "E-posta", 200], ["baro", "Baro", 120], ["sicil", "Sicil no", 100]] as const).map(([a, e, w]) => (
              <View key={a} style={{ gap: 4, minWidth: w, flex: 1 }}>
                <Text style={{ color: C.muted, fontSize: 11 }}>{t(e)}</Text>
                <SonraKaydet deger={k[a] || ""} onKaydet={v => hepsineYaz(k, a, v)} style={[s.inputTek, { paddingVertical: 6 }]} />
              </View>
            ))}
            {!!k.telefon && <Btn kind="ghost" label={"📞 " + t("Ara")} onPress={() => Linking.openURL("tel:" + k.telefon!.replace(/[^\d+]/g, "")).catch(() => {})} />}
          </View>
          {k.dosyalar.map(d => (
            <Pressable key={d.f.id + d.k.id} onPress={() => onAc(d.f.id)} style={[s.foy, { paddingVertical: 6 }]}>
              <Text style={[s.hint, { flex: 1, color: C.textSoft }]} numberOfLines={1}>{[foyBaslik(d.f), d.f.mahkeme, d.f.esasNo].filter(Boolean).join(" · ")}</Text>
              <Text style={s.hint}>{t("{n} duruşma", { n: d.durusma })} · {tlYaz(d.odenen)}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
