// Karakter oluşturma: oyuncu kendini tarif eder ya da özellikleri seçer; en yakın avukat fotoğrafları önerilir.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Beard, Character, Gender, Hair, HairColor, parseTraits, rankAvatars, saveCharacter, Traits, useCharacter } from "../data/character";
import { Avatar, useOffice } from "../data/office";
import { useAccount } from "../data/account";
import { FEMALE, firstName } from "./people";
import { Btn } from "./kit";
import { PHOTOS } from "./photos";
import { C, F } from "./theme";
import { t } from "../i18n";

type Opt<T> = { v: T; label: string };
const AGES: { v: number; label: string; min: number; max: number }[] = [
  { v: 27, label: "25–30", min: 0, max: 30 }, { v: 36, label: "31–40", min: 31, max: 40 },
  { v: 48, label: "41–55", min: 41, max: 55 }, { v: 62, label: "56+", min: 56, max: 200 }
];

function Row<T>({ label, opts, value, set }: { label: string; opts: Opt<T>[]; value: T | undefined; set: (v: T | undefined) => void }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <View style={s.chips}>
        {opts.map(o => {
          const on = value === o.v;
          return (
            <Pressable key={String(o.v)} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => set(on ? undefined : o.v)} style={[s.chip, on && s.chipOn]}>
              <Text style={[s.chipT, on && s.chipTOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Tarif + seçimler + önerilen yüzler. Seçim her değiştiğinde onChange çağrılır. */
export function CharacterPicker({ initial, onChange }: { initial?: Partial<Character>; onChange: (c: Character) => void }) {
  const { account } = useAccount();
  const fallback: Avatar = FEMALE.has(firstName(account?.adSoyad)) ? "av-kadin-32" : "av-erkek-38";
  const [text, setText] = useState(initial?.text || "");
  const [traits, setTraits] = useState<Traits>(initial?.traits || {});
  const [avatar, setAvatar] = useState<Avatar>(initial?.avatar || fallback);
  // Oyuncu bir yüzü elle seçtiyse tarif değişene kadar o yüz korunur.
  const manual = useRef(!!initial?.avatar);
  const ranked = useMemo(() => rankAvatars(traits), [traits]);
  const any = Object.values(traits).some(v => v !== undefined);

  useEffect(() => {
    if (!manual.current && any) setAvatar(ranked[0].k);
  }, [ranked]);
  useEffect(() => { onChange({ avatar, traits, text }); }, [avatar, traits, text]);

  // Elle seçilen özellikler tarifte aynı konu yeniden geçene kadar korunur; tarifin geri kalanı her yazışta baştan okunur.
  const hand = useRef<Traits>((() => {
    const h: Traits = { ...(initial?.traits || {}) };
    for (const k of Object.keys(parseTraits(initial?.text || "")) as (keyof Traits)[]) delete h[k];
    return h;
  })());
  const setT = (patch: Partial<Traits>) => {
    manual.current = false;
    hand.current = { ...hand.current, ...patch };
    setTraits(tr => ({ ...tr, ...patch }));
  };
  const onText = (v: string) => {
    setText(v);
    const p = parseTraits(v);
    for (const k of Object.keys(p) as (keyof Traits)[]) delete hand.current[k];
    manual.current = false;
    setTraits({ ...p, ...hand.current });
  };
  const ageOpt = traits.age === undefined ? undefined : AGES.find(a => traits.age! >= a.min && traits.age! <= a.max)?.v;
  const top = any ? ranked.slice(0, 3) : [];
  const rest = any ? ranked.slice(3) : ranked;

  const Face = ({ k, score, big }: { k: Avatar; score?: number; big?: boolean }) => (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: avatar === k }} accessibilityLabel={score !== undefined ? t("%{n} uyum", { n: score }) : undefined}
      onPress={() => { manual.current = true; setAvatar(k); }} style={[s.face, big && s.faceBig, avatar === k && s.on]}>
      <Image source={PHOTOS[k].src} style={big ? { width: 92, height: 118 } : { width: 76, height: 98 }} resizeMode="contain" />
      {score !== undefined && <Text style={s.score}>{t("%{n} uyum", { n: score })}</Text>}
    </Pressable>
  );

  return (
    <View style={{ gap: 10 }}>
      <Text style={s.h}>{t("Kendinizi tarif edin")}</Text>
      <TextInput value={text} onChangeText={onText} multiline style={s.input} placeholderTextColor={C.muted} maxLength={300}
        placeholder={t("Ör. 35 yaşında, kısa siyah saçlı, sakallı ve gözlüklü bir erkek avukatım.")} blurOnSubmit returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} />
      <Text style={s.note}>{t("Yazdıkça aşağıdaki seçimler kendiliğinden işaretlenir; dilerseniz elle de değiştirebilirsiniz.")}</Text>

      <Row<Gender> label={t("Cinsiyet")} value={traits.g} set={v => setT({ g: v, ...(v === "k" ? { beard: undefined } : {}) })}
        opts={[{ v: "k", label: t("Kadın") }, { v: "e", label: t("Erkek") }]} />
      <Row<number> label={t("Yaş")} value={ageOpt} set={v => setT({ age: v })} opts={AGES.map(a => ({ v: a.v, label: a.label }))} />
      <Row<Hair> label={t("Saç")} value={traits.hair} set={v => setT({ hair: v })}
        opts={[{ v: "kisa", label: t("Kısa") }, { v: "uzun", label: t("Uzun") }, { v: "topuz", label: t("Topuz") }, { v: "kivircik", label: t("Kıvırcık") },
          { v: "kel", label: t("Kel") }, { v: "basortu", label: t("Başörtülü") }]} />
      {traits.hair !== "basortu" && traits.hair !== "kel" && (
        <Row<HairColor> label={t("Saç rengi")} value={traits.color} set={v => setT({ color: v })}
          opts={[{ v: "siyah", label: t("Siyah") }, { v: "kahve", label: t("Kahverengi") }, { v: "kizil", label: t("Kızıl") }, { v: "sari", label: t("Sarı") }, { v: "kir", label: t("Kır / beyaz") }]} />
      )}
      {traits.g !== "k" && (
        <Row<Beard> label={t("Sakal")} value={traits.beard} set={v => setT({ beard: v })}
          opts={[{ v: "yok", label: t("Yok") }, { v: "sakal", label: t("Sakallı") }, { v: "biyik", label: t("Bıyıklı") }]} />
      )}
      <Row<boolean> label={t("Gözlük")} value={traits.glasses} set={v => setT({ glasses: v })}
        opts={[{ v: true, label: t("Gözlüklü") }, { v: false, label: t("Gözlüksüz") }]} />

      {top.length > 0 && (
        <>
          <Text style={s.h}>{t("Size en yakın")}</Text>
          <View style={s.faces}>{top.map(r => <Face key={r.k} k={r.k} score={r.score} big />)}</View>
        </>
      )}
      <Text style={s.h}>{top.length ? t("Diğer yüzler") : t("Bir yüz seçin")}</Text>
      <View style={s.faces}>{rest.map(r => <Face key={r.k} k={r.k} />)}</View>
      <Text style={s.note}>{t("Tarifiniz yalnızca bu cihazda saklanır, hiçbir yere gönderilmez. Yeni yüz seçenekleri zamanla eklenecek.")}</Text>
    </View>
  );
}

export default function CharacterScreen({ onBack }: { onBack: () => void }) {
  const saved = useCharacter();
  const { office } = useOffice();
  const pick = useRef<Character | null>(null);
  const initial = saved || (office ? { avatar: office.avatar } : undefined);
  const save = async () => { if (pick.current) await saveCharacter(pick.current); onBack(); };
  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <View style={s.headRow}><Btn kind="ghost" label={t("‹ Geri")} onPress={onBack} /></View>
      <Text style={s.eyebrow}>{t("KARAKTERİNİZ")}</Text>
      <Text style={s.title}>{t("Duruşmada sizi kim temsil edecek?")}</Text>
      <Text style={s.sub}>{t("Kendinizi birkaç kelimeyle anlatın; Celse cübbeli avukatlar arasından size en çok benzeyeni bulsun. Seçtiğiniz yüz bütün duruşmalarda ve büronuzda görünür.")}</Text>
      <CharacterPicker key={initial?.avatar || "yeni"} initial={initial} onChange={c => { pick.current = c; }} />
      <Btn label={t("Bu karakterle devam et")} onPress={save} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 880, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 20, gap: 10 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  eyebrow: { fontFamily: F.mono, fontSize: 12, letterSpacing: 2.5, color: C.muted, marginTop: 6 },
  title: { fontFamily: F.display, fontSize: 28, color: C.brass },
  sub: { fontFamily: F.body, fontSize: 16, color: C.textSoft },
  h: { fontFamily: F.bodyBold, fontSize: 17, color: C.text, marginTop: 8 },
  note: { fontFamily: F.body, fontSize: 13, color: C.muted },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 8, backgroundColor: C.panel, color: C.text, fontFamily: F.body, fontSize: 16, paddingHorizontal: 12, paddingVertical: 10, minHeight: 72, textAlignVertical: "top" },
  row: { gap: 6 },
  rowLabel: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: C.muted, textTransform: "uppercase" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.panel },
  chipOn: { backgroundColor: C.brass, borderColor: C.brass },
  chipT: { fontFamily: F.bodyMed, fontSize: 14, color: C.textSoft },
  chipTOn: { color: C.brassInk },
  faces: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  face: { alignItems: "center", borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingTop: 6, paddingBottom: 4, paddingHorizontal: 4, backgroundColor: C.panel },
  faceBig: { paddingHorizontal: 8, paddingTop: 8 },
  on: { borderColor: C.brass, borderWidth: 2, backgroundColor: "rgba(255,255,255,0.11)" },
  score: { fontFamily: F.mono, fontSize: 11, color: C.brass, marginTop: 4 }
});
