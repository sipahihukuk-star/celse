// Föylerim: "Bağlantı önerileri" kartı. Hangi föylerin birbirinin devamı ya da ilgilisi olduğunu, hangi evrakın yanlış föyde
// durduğunu cihazda bulur (iliski.ts); avukat tek tuşla bağlar, taşır ya da "Değil" der (bir daha önerilmez).
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ayarOku, ayarYaz, Foy, foyBaslik, foyGetir, foyKaydet } from "../data/foy";
import { turBilgi } from "../data/foyTurleri";
import { iliskiOner, IliskiOnerisi } from "../data/iliski";
import { t } from "../i18n";
import { s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";

const etiket = (f: Foy) => `${turBilgi(f.tur).ad} · ${foyBaslik(f)}${f.esasNo ? " · " + f.esasNo : ""}`;

export function IliskiKart({ liste, onAc }: { liste: Foy[]; onAc: (id: string) => void }) {
  const [red, setRed] = useState<Set<string> | null>(null);
  const [acik, setAcik] = useState(false);
  const [bilgi, setBilgi] = useState("");
  useEffect(() => { ayarOku<string[]>("iliskiRed").then(x => setRed(new Set(x || []))).catch(() => setRed(new Set())); }, []);
  const oneriler = useMemo(() => (red ? iliskiOner(liste, red) : []), [liste, red]);
  if (!red || !oneriler.length) return bilgi ? <Text style={[s.hint, { color: C.good }]}>{bilgi}</Text> : null;

  const reddet = async (o: IliskiOnerisi) => {
    const y = new Set(red); y.add(o.anahtar); setRed(y);
    await ayarYaz("iliskiRed", [...y]);
  };
  // Kaydetmeden önce föyün son hâli okunur (açık başka bir ekranda değişmiş olabilir).
  const guncel = async (f: Foy) => (await foyGetir(f.id)) || f;
  const uygula = async (o: IliskiOnerisi, nasil: "zincir" | "ilgili" | "tasi") => {
    const a = await guncel(o.a), b = await guncel(o.b);
    if (nasil === "zincir") { await foyKaydet({ ...b, oncekiId: a.id }); setBilgi(t("Bağlandı: {b}, {a} dosyasının devamı.", { a: foyBaslik(a), b: foyBaslik(b) })); }
    else if (nasil === "ilgili") {
      await foyKaydet({ ...a, ilgiliIds: [...new Set([...(a.ilgiliIds || []), b.id])] });
      await foyKaydet({ ...b, ilgiliIds: [...new Set([...(b.ilgiliIds || []), a.id])] });
      setBilgi(t("İlgili dosya olarak bağlandı."));
    } else if (o.evrak) {
      const ev = a.evraklar.find(e => e.id === o.evrak!.id);
      if (!ev) return;
      await foyKaydet({ ...b, evraklar: [...b.evraklar, ev] });
      await foyKaydet({ ...a, evraklar: a.evraklar.filter(e => e.id !== ev.id) });
      setBilgi(t("“{e}” taşındı.", { e: ev.ad }));
    }
  };

  const goster = acik ? oneriler : oneriler.slice(0, 3);
  return (
    <View style={[s.card, { borderColor: C.brass }]}>
      <Text style={s.cardT}>🔗 {t("Bağlantı önerileri ({n})", { n: oneriler.length })}</Text>
      <Text style={s.hint}>{t("Dosya numaraları, kimlik numaraları, taraf adları ve dosya türlerine bakılarak bu cihazda bulundu; hiçbir bilgi dışarı gönderilmedi. Uygun olanı bağlayın, olmayana “Değil” deyin.")}</Text>
      {goster.map(o => (
        <View key={o.anahtar} style={[s.foy, { flexDirection: "column", alignItems: "stretch", gap: 6 }]}>
          <Text style={s.meta}>{o.tur === "zincir" ? t("DEVAMI OLABİLİR") : o.tur === "ilgili" ? t("İLGİLİ OLABİLİR") : o.tur === "ayni" ? t("AYNI DOSYA İKİ KEZ AÇILMIŞ OLABİLİR") : t("EVRAK BAŞKA FÖYE AİT OLABİLİR")}</Text>
          {o.tur === "evrak" ? (
            <Text style={s.fileT}>📄 {o.evrak!.ad}{"\n"}<Text style={s.hint}>{t("şu an: {a}", { a: etiket(o.a) })}{"\n"}{t("ait olabileceği föy: {b}", { b: etiket(o.b) })}</Text></Text>
          ) : (
            <View style={{ gap: 2 }}>
              <Pressable onPress={() => onAc(o.a.id)}><Text style={s.fileT} numberOfLines={2}>{o.tur === "zincir" ? "① " : "• "}{etiket(o.a)}</Text></Pressable>
              <Pressable onPress={() => onAc(o.b.id)}><Text style={s.fileT} numberOfLines={2}>{o.tur === "zincir" ? "② " : "• "}{etiket(o.b)}</Text></Pressable>
            </View>
          )}
          <Text style={s.hint}>{t("Neden: {n}", { n: o.nedenler.join(", ") })}</Text>
          <View style={s.row}>
            {o.tur === "zincir" && <Btn label={t("② ①'in devamı olarak bağla")} onPress={() => uygula(o, "zincir")} />}
            {(o.tur === "zincir" || o.tur === "ilgili") && <Btn kind={o.tur === "zincir" ? "secondary" : "primary"} label={t("İlgili dosya olarak bağla")} onPress={() => uygula(o, "ilgili")} />}
            {o.tur === "evrak" && <Btn label={t("Evrakı o föye taşı")} onPress={() => uygula(o, "tasi")} />}
            {o.tur === "ayni" && <Btn kind="secondary" label={t("İkisini de aç, karşılaştır")} onPress={() => onAc(o.a.id)} />}
            <Btn kind="ghost" label={t("Değil")} onPress={() => reddet(o)} />
          </View>
        </View>
      ))}
      {oneriler.length > 3 && <Btn kind="ghost" label={acik ? t("Daha az göster") : t("Hepsini göster ({n})", { n: oneriler.length })} onPress={() => setAcik(!acik)} />}
      {!!bilgi && <Text style={[s.hint, { color: C.good }]}>{bilgi}</Text>}
    </View>
  );
}
