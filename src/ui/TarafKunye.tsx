// Künyede taraflar: birden çok müvekkil, birden çok karşı taraf ve her iki tarafın bütün vekilleri tek tek yazılır.
// İlk müvekkil / karşı taraf künyenin ana alanlarındadır (muvekkil, karsiTaraf, muvekkilBilgi, karsiBilgi); ötekiler
// ekMuvekkiller / ekKarsiTaraflar listelerinde, ilk vekilden sonrakiler ekVekiller listelerindedir.
import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { bizimVekiller, Foy, karsiVekiller, KarsiBilgi, MuvekkilBilgi, TarafKisi, tumKarsiTaraflar, tumMuvekkiller } from "../data/foy";
import { t } from "../i18n";
import { s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";

type Yan = "biz" | "karsi";
interface Props { f: Foy; degistir: (ek: Partial<Foy>) => void; guncel: () => Foy; surum: number; onEvraktan?: () => void; evrakMesaj?: string }

/** Taraf listesini künye alanlarına geri yazar (ilki ana alanlara, ötekiler ek listeye). */
function tarafYaz(f: Foy, yan: Yan, xs: TarafKisi[]): Partial<Foy> {
  const [ilk, ...ek] = xs.length ? xs : [{ ad: "" }];
  if (yan === "biz") return { muvekkil: ilk.ad, muvekkilBilgi: { ...(f.muvekkilBilgi || {}), kimlikNo: ilk.kimlikNo, adres: ilk.adres, telefon: ilk.telefon, eposta: ilk.eposta }, ekMuvekkiller: ek.length ? ek : undefined };
  return { karsiTaraf: ilk.ad, karsiBilgi: { ...(f.karsiBilgi || {}), kimlikNo: ilk.kimlikNo, adres: ilk.adres, telefon: ilk.telefon, eposta: ilk.eposta }, ekKarsiTaraflar: ek.length ? ek : undefined };
}
function vekilYaz(f: Foy, yan: Yan, xs: string[]): Partial<Foy> {
  const [ilk, ...ek] = xs.length ? xs : [""];
  return yan === "biz"
    ? { muvekkilBilgi: { ...(f.muvekkilBilgi || {}), vekil: ilk, ekVekiller: ek.length ? ek : undefined } }
    : { karsiBilgi: { ...(f.karsiBilgi || {}), vekil: ilk, ekVekiller: ek.length ? ek : undefined } };
}
/** Boş satırlar da düzenlenebilsin diye listeler süzülmeden alınır. */
const hamTaraflar = (f: Foy, yan: Yan): TarafKisi[] => {
  const b = yan === "biz" ? f.muvekkilBilgi : f.karsiBilgi;
  return [{ ad: (yan === "biz" ? f.muvekkil : f.karsiTaraf) || "", kimlikNo: b?.kimlikNo, adres: b?.adres, telefon: b?.telefon, eposta: b?.eposta }, ...((yan === "biz" ? f.ekMuvekkiller : f.ekKarsiTaraflar) || [])];
};
const hamVekiller = (f: Foy, yan: Yan): string[] => { const b = yan === "biz" ? f.muvekkilBilgi : f.karsiBilgi; return [b?.vekil || "", ...(b?.ekVekiller || [])]; };

export function TarafKunye({ f, degistir, guncel, surum, onEvraktan, evrakMesaj }: Props) {
  const [acik, setAcik] = useState<Record<string, boolean>>({});
  const [anahtar, setAnahtar] = useState(0); // satır eklenip silinince alanlar yeniden çizilsin
  const ac = (k: string) => setAcik(x => ({ ...x, [k]: !x[k] }));

  const tarafBolum = (yan: Yan) => {
    const xs = hamTaraflar(f, yan);
    const baslik = yan === "biz" ? t("Müvekkiller") : t("Karşı taraflar");
    const yaz = (i: number, ek: Partial<TarafKisi>) => { const g = guncel(); const ys = hamTaraflar(g, yan).map((x, j) => (j === i ? { ...x, ...ek } : x)); degistir(tarafYaz(g, yan, ys)); };
    const sil = (i: number) => { const g = guncel(); const ys = hamTaraflar(g, yan).filter((_, j) => j !== i); degistir(tarafYaz(g, yan, ys)); setAnahtar(x => x + 1); };
    const ekle = () => { const g = guncel(); const ys = [...hamTaraflar(g, yan), { ad: "" }]; degistir(tarafYaz(g, yan, ys)); setAcik(a => ({ ...a, [yan + ys.length]: false })); setAnahtar(x => x + 1); };
    return (
      <View style={{ gap: 6 }}>
        <Text style={[s.label, { color: C.brass }]}>{baslik} ({xs.filter(x => x.ad.trim()).length || 0})</Text>
        {xs.map((x, i) => {
          const k = yan + i;
          const dolu = [x.kimlikNo, x.adres, x.telefon, x.eposta].filter(y => (y || "").trim()).length;
          return (
            <View key={k + ":" + surum + ":" + anahtar} style={{ gap: 4, borderLeftWidth: 3, borderLeftColor: yan === "biz" ? C.brass : C.line, paddingLeft: 8 }}>
              <View style={[s.row, { gap: 6, alignItems: "center" }]}>
                <Text style={[s.hint, { width: 22 }]}>{i + 1}.</Text>
                <TextInput defaultValue={x.ad} onChangeText={v => yaz(i, { ad: v })} placeholder={yan === "biz" ? t("Müvekkilin adı / unvanı") : t("Karşı tarafın adı / unvanı")} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1 }]} />
                {(xs.length > 1 || x.ad) && <Pressable onPress={() => sil(i)} accessibilityLabel={t("Sil")}><Text style={[s.link, { color: C.bad }]}>✕</Text></Pressable>}
              </View>
              <Pressable onPress={() => ac(k)}><Text style={[s.link, { fontSize: 13 }]}>{acik[k] ? "▾ " : "▸ "}{t("Kimlik no, adres, iletişim")}{dolu ? " · " + t("{n} alan dolu", { n: dolu }) : ""}</Text></Pressable>
              {acik[k] && (
                <View style={s.alanlar}>
                  {([["T.C. kimlik / vergi no", "kimlikNo"], ["Telefon", "telefon"], ["E-posta", "eposta"], ["Adres", "adres"]] as const).map(([e, a]) => (
                    <View style={s.alan} key={a}>
                      <Text style={s.label}>{t(e)}</Text>
                      <TextInput defaultValue={x[a] || ""} onChangeText={v => yaz(i, { [a]: v })} multiline={a === "adres"} placeholderTextColor={C.muted} style={a === "adres" ? [s.input, { minHeight: 50 }] : s.inputTek} />
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
        <Pressable onPress={ekle}><Text style={s.link}>{yan === "biz" ? t("+ Müvekkil ekle") : t("+ Karşı taraf ekle")}</Text></Pressable>
      </View>
    );
  };

  const vekilBolum = (yan: Yan) => {
    const xs = hamVekiller(f, yan);
    const yaz = (i: number, v: string) => { const g = guncel(); const ys = hamVekiller(g, yan).map((x, j) => (j === i ? v : x)); degistir(vekilYaz(g, yan, ys)); };
    const sil = (i: number) => { const g = guncel(); degistir(vekilYaz(g, yan, hamVekiller(g, yan).filter((_, j) => j !== i))); setAnahtar(x => x + 1); };
    const ekle = () => { const g = guncel(); degistir(vekilYaz(g, yan, [...hamVekiller(g, yan), ""])); setAnahtar(x => x + 1); };
    return (
      <View style={{ gap: 4 }}>
        <Text style={[s.label, { color: C.brass }]}>{yan === "biz" ? t("Vekillerimiz") : t("Karşı taraf vekilleri")} ({xs.filter(x => x.trim()).length})</Text>
        {xs.map((x, i) => (
          <View key={"v" + yan + i + ":" + surum + ":" + anahtar} style={[s.row, { gap: 6, alignItems: "center" }]}>
            <Text style={[s.hint, { width: 22 }]}>{i + 1}.</Text>
            <TextInput defaultValue={x} onChangeText={v => yaz(i, v)} placeholder={t("Av. ad soyad · baro · sicil no")} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1 }]} />
            {(xs.length > 1 || x) && <Pressable onPress={() => sil(i)} accessibilityLabel={t("Sil")}><Text style={[s.link, { color: C.bad }]}>✕</Text></Pressable>}
          </View>
        ))}
        <Pressable onPress={ekle}><Text style={s.link}>{t("+ Vekil ekle")}</Text></Pressable>
      </View>
    );
  };

  const mb = f.muvekkilBilgi || {};
  const kb = f.karsiBilgi || {};
  const bilgi = <K extends "vekaletname" | "ek">(yan: Yan, k: K, etiket: string, ph?: string) => (
    <View style={s.alan} key={yan + k + ":" + surum}>
      <Text style={s.label}>{t(etiket)}</Text>
      <TextInput defaultValue={(yan === "biz" ? (mb as MuvekkilBilgi)[k] : (kb as KarsiBilgi & { vekaletname?: string })[k]) || ""} placeholder={ph ? t(ph) : undefined} placeholderTextColor={C.muted} multiline style={[s.input, { minHeight: 44 }]}
        onChangeText={v => { const g = guncel(); degistir(yan === "biz" ? { muvekkilBilgi: { ...(g.muvekkilBilgi || {}), [k]: v } } : { karsiBilgi: { ...(g.karsiBilgi || {}), [k]: v } }); }} />
    </View>
  );

  return (
    <View style={{ gap: 12, width: "100%" }}>
      {!!onEvraktan && (
        <View style={{ gap: 4 }}>
          <View style={[s.row, { gap: 8, alignItems: "center", flexWrap: "wrap" }]}>
            <Btn kind="secondary" label={t("📄 Tarafları ve vekilleri evraktan yükle")} onPress={onEvraktan} />
            <Text style={[s.hint, { flex: 1, minWidth: 200 }]}>{t("Föydeki evrakı okur; künyede olmayan ikinci, üçüncü müvekkili, karşı tarafları ve iki tarafın vekillerini ekler. Var olanlar çoğalmaz.")}</Text>
          </View>
          {!!evrakMesaj && <Text style={[s.hint, { color: C.brass }]}>{evrakMesaj}</Text>}
        </View>
      )}
      <View style={{ gap: 8, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 10 }}>
        {tarafBolum("biz")}
        {vekilBolum("biz")}
        <View style={s.alanlar}>
          {bilgi("biz", "vekaletname", "Vekâletname (noterlik, tarih, yevmiye no)", "İzmir 5. Noterliği, 12.03.2026, 12345")}
          {bilgi("biz", "ek", "Diğer bilgiler (yetkili, notlar)")}
        </View>
      </View>
      <View style={{ gap: 8, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 10 }}>
        {tarafBolum("karsi")}
        {vekilBolum("karsi")}
        <View style={s.alanlar}>{bilgi("karsi", "ek", "Diğer bilgiler")}</View>
      </View>
      <Text style={s.hint}>{t("Bu bilgiler yalnız bu cihazda (eşitlemede şifreli) durur; yapay zekâya gönderilen metinlerde bütün adlar kodlanır.")}</Text>
    </View>
  );
}

/** Künye özeti: "Ayşe Örnek ve 2 diğeri" gibi kısa gösterim için sayılar. */
export const tarafSayilari = (f: Foy) => ({ biz: tumMuvekkiller(f).length, karsi: tumKarsiTaraflar(f).length, bizV: bizimVekiller(f).length, karsiV: karsiVekiller(f).length });
