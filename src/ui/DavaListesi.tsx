// Dava listesi: bütün türlerde dosyalar bir tabloda (mahkeme, dosya no, taraflar, aşama, sıradaki iş, yargılama süresi,
// Tazminat Komisyonu). Açılır kutularla süzülür, satıra basınca föy açılır, Excel'e (.xlsx) aktarılır.
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { davaListesi, komisyonaUygun, komisyonAdi, ListeSuzgec, listeTablosu } from "../data/davaListesi";
import type { Foy } from "../data/foy";
import { TURLER } from "../data/foyTurleri";
import { xlsxYaz } from "../data/xlsxYaz";
import { t } from "../i18n";
import { Acilir } from "./Acilir";
import { indir, s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";

const tarihYaz = (x?: string) => (x ? x.slice(0, 10).split("-").reverse().join(".") : "");
const KOLON: [string, number][] = [["Tür", 120], ["Mahkeme / merci", 230], ["Dosya no", 100], ["Müvekkil – karşı taraf", 240], ["Aşama", 110], ["Sıradaki iş", 220], ["Açılış", 90], ["Yargılama süresi", 120], ["Tazminat Komisyonu", 130], ["AYM / AİHM", 120]];

export function DavaListesi({ liste, onAc, onKapat }: { liste: Foy[]; onAc: (id: string) => void; onKapat: () => void }) {
  const [sz, setSz] = useState<ListeSuzgec>(() => {
    const v: ListeSuzgec = { tur: "hepsi", durum: "acik", enAzYil: 0, komisyon: "hepsi", sirala: "sure", ara: "" };
    try { return { ...v, ...JSON.parse(globalThis.localStorage?.getItem("celse-dava-listesi") || "{}"), ara: "" }; } catch { return v; }
  });
  const yaz = (ek: Partial<ListeSuzgec>) => { const y = { ...sz, ...ek }; setSz(y); setSayfa(0); try { const { ara: _a, ...k } = y; globalThis.localStorage?.setItem("celse-dava-listesi", JSON.stringify(k)); } catch { /* yok say */ } };
  const [boy, setBoy] = useState(25);
  const [sayfa, setSayfa] = useState(0);
  const satirlar = useMemo(() => davaListesi(liste, sz), [liste, sz]);
  const sayfaSay = Math.max(1, Math.ceil(satirlar.length / boy));
  const cur = Math.min(sayfa, sayfaSay - 1);
  const gorunen = satirlar.slice(cur * boy, (cur + 1) * boy);
  const turler = TURLER.filter(x => !x.eski && liste.some(f => !f.ozel && (f.tur || "hukuk") === x.tur));
  const uzunSay = satirlar.filter(x => x.sure.bitmedi && x.sure.gun >= 5 * 365.25).length;

  const excel = () => {
    const tablo = listeTablosu(satirlar);
    const b = xlsxYaz("Dava listesi", tablo, [16, 34, 12, 36, 20, 16, 34, 14, 12, 16, 10, 8, 18, 16, 14]);
    indir(`dava-listesi-${new Date().toISOString().slice(0, 10)}.xlsx`, new Blob([b as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  };

  const hucre = (w: number, icerik: React.ReactNode, ek?: object) => <View style={[{ width: w, paddingVertical: 8, paddingHorizontal: 8, justifyContent: "center" }, ek]}>{icerik}</View>;
  const yazi = (x: string, renk: string = C.textSoft, kalin = false) => <Text style={{ color: renk, fontSize: 13, fontWeight: kalin ? "700" : "400" }} numberOfLines={3}>{x || "—"}</Text>;

  return (
    <ScrollView contentContainerStyle={[s.wrap, { maxWidth: 1420 }]} keyboardShouldPersistTaps="handled">
      <View style={s.head}><Btn kind="ghost" label={t("‹ Föylere dön")} onPress={onKapat} /></View>
      <Text style={s.eyebrow}>{t("DAVA TAKİBİ · LİSTE")}</Text>
      <Text style={s.title}>{t("Dava listesi")}</Text>
      <Text style={s.hint}>{t("Bütün türlerde dosyalarınız: mahkeme, dosya no, taraflar, aşama, sıradaki iş, yargılama süresi ve Tazminat Komisyonu (6384 s. Kanun) başvurusu. Satıra basınca föy açılır. Şahsi dosyalar bu listede yoktur.")}</Text>

      <View style={s.card}>
        <TextInput value={sz.ara} onChangeText={v => yaz({ ara: v })} placeholder={t("Ara: mahkeme, dosya no, taraf, aşama, iş…")} placeholderTextColor={C.muted} style={s.inputTek} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
          <Acilir etiket={t("Dosya türü")} secili={sz.tur} genislik={210} onSec={k => yaz({ tur: k })}
            secenekler={[{ k: "hepsi", ad: t("Bütün türler"), n: liste.filter(f => !f.ozel).length }, ...turler.map(x => ({ k: x.tur, ad: t(x.ad), n: liste.filter(f => !f.ozel && (f.tur || "hukuk") === x.tur).length }))]} />
          <Acilir etiket={t("Durum")} secili={sz.durum} genislik={130} onSec={k => yaz({ durum: k as ListeSuzgec["durum"] })}
            secenekler={[{ k: "acik", ad: t("Açık") }, { k: "kapali", ad: t("Kapalı") }, { k: "hepsi", ad: t("Hepsi") }]} />
          <Acilir etiket={t("Yargılama süresi")} secili={String(sz.enAzYil)} genislik={170} onSec={k => yaz({ enAzYil: Number(k) })}
            secenekler={[0, 1, 2, 3, 4, 5, 7, 10].map(n => ({ k: String(n), ad: n ? t("{n} yıldan uzun", { n }) : t("Hepsi") }))} />
          <Acilir etiket={t("Tazminat Komisyonu")} secili={sz.komisyon} genislik={200} onSec={k => yaz({ komisyon: k as ListeSuzgec["komisyon"] })}
            secenekler={[{ k: "hepsi", ad: t("Hepsi") }, { k: "yok", ad: t("Başvurulmamış") }, { k: "var", ad: t("Başvurulmuş / sonuçlanmış") }]} />
          <Acilir etiket={t("Sırala")} secili={sz.sirala} genislik={200} onSec={k => yaz({ sirala: k as ListeSuzgec["sirala"] })}
            secenekler={[{ k: "sure", ad: t("En uzun süren önce") }, { k: "is", ad: t("Sıradaki işin tarihi") }, { k: "acilisEski", ad: t("Açılış (eski önce)") }, { k: "acilisYeni", ad: t("Açılış (yeni önce)") }, { k: "mahkeme", ad: t("Mahkemeye göre") }]} />
          <Acilir etiket={t("Sayfada")} secili={String(boy)} genislik={90} onSec={k => { setBoy(Number(k)); setSayfa(0); }} secenekler={[10, 25, 50, 100, 250].map(n => ({ k: String(n), ad: String(n) }))} />
        </View>
        <View style={[s.row, { alignItems: "center" }]}>
          <Text style={[s.body, { flex: 1 }]}>{t("{n} dosya", { n: satirlar.length })}{uzunSay ? " · " + t("{n} açık dosya 5 yıldan uzun sürüyor", { n: uzunSay }) : ""}</Text>
          <Btn kind="secondary" label={t("Excel'e aktar (.xlsx)")} disabled={!satirlar.length} onPress={excel} />
        </View>
      </View>

      <ScrollView horizontal contentContainerStyle={{ flexDirection: "column" }} style={{ borderWidth: 1, borderColor: C.line, borderRadius: 10 }}>
        <View style={{ flexDirection: "row", backgroundColor: C.panel2, borderBottomWidth: 1, borderBottomColor: C.line }}>
          {KOLON.map(([ad, w]) => <React.Fragment key={ad}>{hucre(w, yazi(t(ad), C.brass, true))}</React.Fragment>)}
        </View>
        {gorunen.map((x, i) => {
          const uzun = x.sure.bitmedi && x.sure.gun >= 5 * 365.25;
          const kom = komisyonaUygun(x.f) || x.komisyon.durum !== "yok" ? komisyonAdi(x.komisyon.durum) : "";
          return (
            <Pressable key={x.f.id} onPress={() => onAc(x.f.id)} accessibilityRole="button" style={{ flexDirection: "row", backgroundColor: i % 2 ? "transparent" : C.panel, borderBottomWidth: 1, borderBottomColor: C.line }}>
              {hucre(KOLON[0][1], yazi(t(x.tur)))}
              {hucre(KOLON[1][1], yazi(x.mahkeme, C.text))}
              {hucre(KOLON[2][1], yazi(x.esasNo, C.text, true))}
              {hucre(KOLON[3][1], yazi(x.taraflar))}
              {hucre(KOLON[4][1], yazi(x.asama))}
              {hucre(KOLON[5][1], yazi([x.sonrakiIs, tarihYaz(x.sonrakiTarih)].filter(Boolean).join(" · ")))}
              {hucre(KOLON[6][1], yazi(tarihYaz(x.acilis)))}
              {hucre(KOLON[7][1], yazi(x.sure.metin + (x.sure.tahmini ? " ~" : ""), uzun ? C.bad : C.textSoft, uzun))}
              {hucre(KOLON[8][1], yazi(kom, x.komisyon.durum === "yok" ? C.muted : C.good))}
              {hucre(KOLON[9][1], yazi(x.bireysel, x.bireysel ? C.good : C.muted))}
            </Pressable>
          );
        })}
        {!gorunen.length && <View style={{ padding: 16 }}><Text style={s.hint}>{t("Bu süzgeçlere uyan dosya yok.")}</Text></View>}
      </ScrollView>
      {sayfaSay > 1 && (
        <View style={[s.row, { alignItems: "center" }]}>
          <Btn kind="ghost" label={t("‹ Önceki")} disabled={cur === 0} onPress={() => setSayfa(cur - 1)} />
          <Text style={s.hint}>{t("Sayfa {a} / {b}", { a: cur + 1, b: sayfaSay })}</Text>
          <Btn kind="ghost" label={t("Sonraki ›")} disabled={cur >= sayfaSay - 1} onPress={() => setSayfa(cur + 1)} />
        </View>
      )}
      <Text style={s.hint}>{t("~ işareti: açılış ya da kapanış tarihi yazılmamış, süre föyün oluşturulduğu / son değiştiği güne göre tahmini. Açılış tarihini künyeye, kapanışı “Dosya durumu: Kapalı” seçince çıkan alana yazın. Tazminat Komisyonu durumu künyeden seçilir; föy, Tazminat Komisyonu föyüne bağlıysa kendiliğinden “Başvuruldu” görünür.")}</Text>
    </ScrollView>
  );
}
