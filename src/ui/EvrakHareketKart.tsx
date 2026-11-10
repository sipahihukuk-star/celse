// Föylerim: "Evrak hareketleri" kartı. Gelen evrak (klasör, toplu yükleme, elle) nereye gitti, giden evrak (indirilen beyan,
// taşınan evrak, birleştirilen föy) nereye çıktı; yarıda kalan klasör taraması. Satır "Gördüm" ile gizlenir ya da kaldırılır.
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { EvrakHareketi, hareketDinle, hareketGoruldu, hareketler, hareketSil, SONUC_AD, yarimTarama } from "../data/evrakHareket";
import type { Foy } from "../data/foy";
import { t } from "../i18n";
import { Acilir } from "./Acilir";
import { s } from "./foyStil";
import { Katlanir } from "./Katlanir";
import { Btn } from "./kit";
import { C } from "./theme";

const saat = (z: string) => { const d = new Date(z); return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }); };
const RENK: Partial<Record<EvrakHareketi["sonuc"], string>> = { foy: C.good, ornek: C.good, bekliyor: C.mid, okunamadi: C.bad, atlandi: C.muted, indirildi: C.text, tasindi: C.text, birlesti: C.text };

export function EvrakHareketKart({ liste, onAc }: { liste: Foy[]; onAc: (id: string) => void }) {
  const [xs, setXs] = useState<EvrakHareketi[]>([]);
  const [goster, setGoster] = useState<"yeni" | "hepsi">("yeni");
  const [yon, setYon] = useState<"hepsi" | "gelen" | "giden">("hepsi");
  const [sayi, setSayi] = useState(40);
  useEffect(() => { const yukle = () => hareketler().then(setXs).catch(() => {}); yukle(); return hareketDinle(yukle); }, []);
  const ids = useMemo(() => new Set(liste.map(f => f.id)), [liste]);
  const gorunen = xs.filter(x => (goster === "hepsi" || !x.goruldu) && (yon === "hepsi" || x.yon === yon));
  const yeni = xs.filter(x => !x.goruldu);
  const gun = Date.now() - 24 * 3600000;
  const son = xs.filter(x => new Date(x.zaman).getTime() > gun && x.sonuc !== "tarama");
  const bekleyen = xs.filter(x => x.sonuc === "bekliyor" && !x.goruldu).length;
  const yarim = xs.filter(x => yarimTarama(x) && !x.goruldu);
  if (!xs.length) return null;
  const ozet = [t("son 24 saat: {g} gelen, {c} giden", { g: son.filter(x => x.yon === "gelen").length, c: son.filter(x => x.yon === "giden").length }),
    bekleyen ? t("{n} evrak föy bekliyor", { n: bekleyen }) : "", yarim.length ? t("yarım kalan tarama var") : ""].filter(Boolean).join(" · ");
  return (
    <Katlanir key={yarim.length || bekleyen ? "dikkat" : "olagan"} anahtar="evrak-hareket" baslik={t("📥📤 Evrak hareketleri") + (yeni.length ? ` (${yeni.length})` : "")} ozet={ozet} zorla={!!yarim.length || !!bekleyen}>
      <View style={{ gap: 8 }}>
        <Text style={s.hint}>{t("Gelen evrak (evrak klasörü, toplu yükleme, föye elle) hangi föye girdi; giden evrak (indirilen beyan, başka föye taşınan evrak, birleştirilen föy) nereye çıktı. Celse evrak klasöründeki dosyaları yalnız okur; taşımaz, silmez. Bir dosya ancak föye yazıldıktan sonra işlenmiş sayılır: tarama yarıda kalırsa (elektrik, bağlantı) o dosyalar bir sonraki taramada yeniden alınır. İnceledikten sonra satırı “Gördüm” ile gizleyin ya da kaldırın.")}</Text>
        {yarim.map(x => (
          <View key={x.id} style={[s.warn, { gap: 4 }]}>
            <Text style={[s.body, { color: C.bad }]}>{t("⚠ {z} tarihli klasör taraması yarıda kalmış: {n}", { z: saat(x.zaman), n: x.not || "" })}</Text>
            <Text style={s.hint}>{t("Föye yazılamayan dosyalar klasörde duruyor ve bir sonraki taramada yeniden alınır; Evrak klasörü bölümünde “Yeni evrakı şimdi al” diyebilirsiniz.")}</Text>
            <View style={s.row}><Btn kind="ghost" label={t("Gördüm")} onPress={() => hareketGoruldu([x.id])} /></View>
          </View>
        ))}
        <View style={[s.addRow, { alignItems: "flex-end" }]}>
          <Acilir etiket={t("Göster")} genislik={200} secili={goster} onSec={k => setGoster(k as "yeni" | "hepsi")} secenekler={[{ k: "yeni", ad: t("Görmediklerim"), n: yeni.length }, { k: "hepsi", ad: t("Hepsi"), n: xs.length }]} />
          <Acilir etiket={t("Yön")} genislik={180} secili={yon} onSec={k => setYon(k as "hepsi" | "gelen" | "giden")} secenekler={[{ k: "hepsi", ad: t("Gelen ve giden") }, { k: "gelen", ad: t("📥 Gelen") }, { k: "giden", ad: t("📤 Giden") }]} />
          {!!yeni.length && <Btn kind="secondary" label={t("Hepsini gördüm")} onPress={() => hareketGoruldu("hepsi")} />}
          {xs.some(x => x.goruldu) && <Btn kind="ghost" label={t("Görülenleri kaldır")} onPress={() => hareketSil("gorulenler")} />}
        </View>
        {!gorunen.length && <Text style={s.hint}>{t("Görmediğiniz hareket yok.")}</Text>}
        {gorunen.filter(x => !yarimTarama(x)).slice(0, sayi).map(x => (
          <View key={x.id} style={[s.file, { flexDirection: "column", alignItems: "stretch", gap: 3, opacity: x.goruldu ? 0.6 : 1 }]}>
            <Text style={s.fileT} numberOfLines={2}>{x.yon === "gelen" ? "📥 " : "📤 "}{x.ad}</Text>
            <Text style={[s.hint, { color: RENK[x.sonuc] || C.muted }]}>
              {saat(x.zaman)} · {x.sonuc === "tarama" ? (x.not || t(SONUC_AD.tarama)) : t(SONUC_AD[x.sonuc])}
              {x.sonuc !== "tarama" && x.not ? " · " + x.not : ""}
            </Text>
            {!!x.foyId && (ids.has(x.foyId)
              ? <Pressable onPress={() => onAc(x.foyId!)}><Text style={s.link}>{"→ " + (x.foyAd || t("föyü aç"))}</Text></Pressable>
              : !!x.foyAd && <Text style={s.hint}>{"→ " + x.foyAd + " " + t("(föy artık yok ya da şahsi dosyalar kilitli)")}</Text>)}
            {x.sonuc === "bekliyor" && <Text style={s.hint}>{t("Aşağıdaki “Evrak klasörü” bölümünde bu evrak için föy seçin ya da yeni dosya açın.")}</Text>}
            {!!x.kaynak && <Text style={[s.hint, { fontSize: 11 }]} numberOfLines={1}>{x.kaynak}</Text>}
            <View style={s.row}>
              {!x.goruldu && <Pressable onPress={() => hareketGoruldu([x.id])}><Text style={s.link}>{t("Gördüm")}</Text></Pressable>}
              <Pressable onPress={() => hareketSil([x.id])}><Text style={s.sil}>{t("Kaldır")}</Text></Pressable>
            </View>
          </View>
        ))}
        {gorunen.length > sayi && <Btn kind="ghost" label={t("Daha fazla ({n})", { n: gorunen.length - sayi })} onPress={() => setSayi(n => n + 60)} />}
      </View>
    </Katlanir>
  );
}
