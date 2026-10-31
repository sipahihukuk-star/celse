// Büro: karakter ve şehir seçimi (ilk açılış), sonra kasa, aylık giderler ve hesap defteri.
import React, { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAccount } from "../data/account";
import { AVATARS, Avatar, CITIES, closeOffice, monthlyCost, Office, openOffice, SECRETARY, START_CASH, tl, updateOffice, useOffice } from "../data/office";
import { Btn } from "./kit";
import { PHOTOS } from "./photos";
import { dateOf, personalCosts } from "../data/life";
import { FEMALE, firstName } from "./people";
import { C, F } from "./theme";

const AV_LABEL: Record<Avatar, string> = {
  "av-erkek-38": "Erkek · 38", "av-kadin-32": "Kadın · 32", "av-erkek-58": "Erkek · 58", "av-kadin-52": "Kadın · 52",
  "av-erkek-25": "Erkek · 25", "av-kadin-25": "Kadın · 25", "av-kadin-basortulu": "Kadın · 30"
};

export function AvatarFace({ k, size = 64 }: { k: Avatar; size?: number }) {
  const p = PHOTOS[k];
  const w = size * 1.6, h = w * (p.h / p.w);
  // Yüz, kesit fotoğrafın üst-orta bölümündedir; yuvarlak çerçeveye o kısım sığdırılır.
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: C.panel2 }}>
      <Image source={p.src} style={{ position: "absolute", width: w, height: h, left: (size - w) / 2, top: -h * 0.06 }} resizeMode="contain" />
    </View>
  );
}

export default function OfficeScreen({ onBack, onCareer }: { onBack: () => void; onCareer: () => void }) {
  const { office, ready } = useOffice();
  if (!ready) return <View />;
  return office ? <Dashboard o={office} onBack={onBack} onCareer={onCareer} /> : <Setup onBack={onBack} onDone={onCareer} />;
}

function Setup({ onBack, onDone, initial }: { onBack: () => void; onDone: () => void; initial?: Office }) {
  const { account } = useAccount();
  const [avatar, setAvatar] = useState<Avatar>(initial?.avatar || (FEMALE.has(firstName(account?.adSoyad)) ? "av-kadin-32" : "av-erkek-38"));
  const [city, setCity] = useState(initial?.city || "izmir");
  const [name, setName] = useState(initial?.name || (account ? `Av. ${account.adSoyad} Hukuk Bürosu` : "Hukuk Bürosu"));
  const edit = !!initial;
  const save = async () => {
    if (edit) {
      // Taşınma: başka şehre geçiş masraflıdır.
      const moving = city !== initial!.city;
      const cost = moving ? 20000 : 0;
      await updateOffice({ avatar, name: name.trim() || initial!.name, city, cash: initial!.cash - cost,
        ledger: moving ? [...initial!.ledger, { ay: initial!.month, text: "Taşınma ve yeni büro kurulumu", amount: -cost }].slice(-60) : initial!.ledger });
    } else await openOffice(name.trim() || "Hukuk Bürosu", city, avatar);
    onDone();
  };
  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={s.headRow}><Btn kind="ghost" label="‹ Geri" onPress={onBack} /></View>
      <Text style={s.eyebrow}>{edit ? "BÜRO AYARLARI" : "BÜRONUZU AÇIN"}</Text>
      <Text style={s.title}>{edit ? "Karakter ve şehir" : "Cübbeniz hazır"}</Text>
      {!edit && <Text style={s.sub}>Duruşmalarda sizi temsil edecek karakteri ve büronuzu açacağınız şehri seçin. {tl(START_CASH)} kuruluş sermayesiyle başlarsınız; her dava bir ay sürer, ay sonunda kira ve giderler kasadan düşer.</Text>}

      <Text style={s.h}>Karakteriniz</Text>
      <View style={s.avatars}>
        {AVATARS.map(k => (
          <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: avatar === k }} accessibilityLabel={AV_LABEL[k]} onPress={() => setAvatar(k)}
            style={[s.avatar, avatar === k && s.on]}>
            <Image source={PHOTOS[k].src} style={{ width: 92, height: 118 }} resizeMode="contain" />
            <Text style={s.avLabel}>{AV_LABEL[k]}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.h}>Büronun adı</Text>
      <TextInput value={name} onChangeText={setName} style={s.input} placeholderTextColor={C.muted} maxLength={60} />

      <Text style={s.h}>Şehir {edit && <Text style={s.hNote}>(başka şehre taşınmak 20.000 TL)</Text>}</Text>
      <View style={s.cities}>
        {CITIES.map(ct => (
          <Pressable key={ct.id} accessibilityRole="radio" accessibilityState={{ checked: city === ct.id }} onPress={() => setCity(ct.id)} style={[s.city, city === ct.id && s.on]}>
            <Text style={s.cityName}>{ct.name}</Text>
            <Text style={s.cityRow}>Kira {tl(ct.rent)} · Ücret ×{ct.fee.toLocaleString("tr-TR")}</Text>
            <Text style={s.cityNote}>{ct.note}</Text>
          </Pressable>
        ))}
      </View>
      <Btn label={edit ? "Kaydet" : "Büroyu aç"} onPress={save} />
      <Text style={s.fine}>Tutarlar oyun içi yaklaşık değerlerdir; gerçek kira, Avukatlık Asgari Ücret Tarifesi ya da CMK ücret tarifesi değildir.</Text>
    </ScrollView>
  );
}

function Dashboard({ o, onBack, onCareer }: { o: Office; onBack: () => void; onCareer: () => void }) {
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (edit) return <Setup initial={o} onBack={() => setEdit(false)} onDone={() => setEdit(false)} />;
  const city = CITIES.find(c => c.id === o.city) || CITIES[0];
  const cost = monthlyCost(o);
  const allCost = cost.total + (o.life ? personalCosts(o.life, o.month + 1).total : 0);
  const runway = allCost ? Math.floor(o.cash / allCost) : 0;
  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={s.headRow}>
        <Btn kind="ghost" label="‹ Giriş" onPress={onBack} />
        <View style={{ flex: 1 }} />
        <Btn label="Büro masası ›" onPress={onCareer} />
      </View>
      <View style={s.idRow}>
        <AvatarFace k={o.avatar} size={84} />
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text style={s.eyebrow}>{city.name.toLocaleUpperCase("tr")} · {dateOf(o.month + 1).toLocaleUpperCase("tr")}</Text>
          <Text style={s.title}>{o.name}</Text>
          <Pressable onPress={() => setEdit(true)} accessibilityRole="button"><Text style={s.link}>Karakter, ad ya da şehir değiştir ›</Text></Pressable>
        </View>
      </View>

      <View style={s.cards}>
        <View style={[s.card, { flexBasis: 240 }]}>
          <Text style={s.k}>Kasa</Text>
          <Text style={[s.cash, o.cash < 0 && { color: C.bad }]}>{tl(o.cash)}</Text>
          <Text style={s.small}>{o.cash < 0 ? "Kasa ekside: kirayı ödemek için dava almalısınız." : runway < 2 ? "Kasa bir aydan az gidere yetiyor." : `Davasız ${runway} ay idare eder.`}</Text>
        </View>
        <View style={[s.card, { flexBasis: 280 }]}>
          <Text style={s.k}>Büro giderleri · {tl(cost.total)}/ay</Text>
          {cost.items.map(i => (
            <View key={i.text} style={s.line}><Text style={s.lineT}>{i.text}</Text><Text style={s.lineV}>{tl(i.amount)}</Text></View>
          ))}
          <Pressable accessibilityRole="switch" accessibilityState={{ checked: o.secretary }} onPress={() => updateOffice({ secretary: !o.secretary })} style={s.toggle}>
            <View style={[s.box, o.secretary && s.boxOn]}>{o.secretary && <Text style={s.tick}>✓</Text>}</View>
            <Text style={s.toggleT}>Sekreter çalıştır ({tl(SECRETARY)}/ay): müvekkil davalarında ücret %10 artar.</Text>
          </Pressable>
        </View>
      </View>

      {o.life && (() => {
        const L = o.life!; const pc = personalCosts(L, o.month + 1);
        return (
          <View style={s.card}>
            <Text style={s.k}>Hayatınız · {dateOf(o.month + 1)} · kişisel gider {tl(pc.total)}/ay</Text>
            <Text style={s.small}>{[L.married ? "Evli" : L.divorced ? "Boşanmış" : "Bekâr", L.children.length ? `${L.children.length} çocuk` : "", L.owner ? "Ev sahibi" : "Kirada", L.car && L.car !== "yok" ? "Arabalı" : "Arabasız", L.stajyer ? "Stajyer var" : "", L.katip ? "Katip var" : ""].filter(Boolean).join(" · ")}</Text>
            {pc.items.map(i => (
              <View key={i.text} style={s.line}><Text style={s.lineT}>{i.text}</Text><Text style={s.lineV}>{tl(i.amount)}</Text></View>
            ))}
            <Text style={s.small}>Zamanla hayatınızda olaylar çıkar (araba, evlilik, çocuk, ev, eleman…). Kararları büro masasında verirsiniz.</Text>
          </View>
        );
      })()}

      <View style={s.card}>
        <Text style={s.k}>Davalar büroya nasıl gelir?</Text>
        <Text style={s.small}>• <Text style={s.b}>Müvekkil:</Text> vekâlet ücreti davanın basamağına ve şehrinize göre belirlenir; kazanırsanız ikna puanınıza göre prim alırsınız, kaybederseniz yalnızca peşin kısmı kalır.</Text>
        <Text style={s.small}>• <Text style={s.b}>CMK görevlendirmesi:</Text> baro sizi şüpheli ya da sanık müdafii olarak atar; ücret sabittir ve sonuçtan bağımsızdır.</Text>
        <Text style={s.small}>• <Text style={s.b}>Adli yardım:</Text> ücreti ödeyemeyen kişinin davası baro aracılığıyla size gelir; ücret sabittir.</Text>
      </View>

      <View style={s.card}>
        <Text style={s.k}>Hesap defteri</Text>
        {o.ledger.slice().reverse().slice(0, 14).map((l, i) => (
          <View key={i} style={s.line}>
            <Text style={s.lineT} numberOfLines={2}><Text style={s.month}>{l.ay}. ay </Text>{l.text}</Text>
            <Text style={[s.lineV, { color: l.amount < 0 ? C.bad : C.good }]}>{l.amount < 0 ? "" : "+"}{tl(l.amount)}</Text>
          </View>
        ))}
      </View>

      {confirm ? (
        <View style={{ alignItems: "center", gap: 8, marginTop: 10 }}>
          <Text style={s.small}>Büro kapanır, kasa ve defter silinir. Kariyer ilerlemeniz korunur.</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Btn kind="ghost" label="Vazgeç" onPress={() => setConfirm(false)} />
            <Btn label="Büroyu kapat" onPress={() => { setConfirm(false); closeOffice(); }} />
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setConfirm(true)} style={{ alignSelf: "center", padding: 8, marginTop: 10 }}><Text style={s.reset}>Büroyu kapat ve yeniden kur</Text></Pressable>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 880, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 20, gap: 10 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  eyebrow: { fontFamily: F.mono, fontSize: 12, letterSpacing: 2.5, color: C.muted, marginTop: 6 },
  title: { fontFamily: F.display, fontSize: 30, color: C.brass },
  sub: { fontFamily: F.body, fontSize: 16, color: C.textSoft },
  h: { fontFamily: F.bodyBold, fontSize: 17, color: C.text, marginTop: 10 },
  hNote: { fontFamily: F.body, fontSize: 14, color: C.muted },
  avatars: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  avatar: { alignItems: "center", borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingTop: 8, paddingBottom: 6, paddingHorizontal: 6, backgroundColor: C.panel },
  on: { borderColor: C.brass, backgroundColor: "rgba(255,255,255,0.11)" },
  avLabel: { fontFamily: F.mono, fontSize: 11, color: C.textSoft, marginTop: 4 },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 8, backgroundColor: C.panel, color: C.text, fontFamily: F.body, fontSize: 17, paddingHorizontal: 12, paddingVertical: 10 },
  cities: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  city: { flexGrow: 1, flexBasis: 200, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 10, backgroundColor: C.panel, gap: 2 },
  cityName: { fontFamily: F.displayMed, fontSize: 18, color: C.text },
  cityRow: { fontFamily: F.mono, fontSize: 11, color: C.brass },
  cityNote: { fontFamily: F.body, fontSize: 13, color: C.muted },
  fine: { fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 6 },
  idRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14, marginTop: 6 },
  link: { fontFamily: F.bodyMed, fontSize: 15, color: C.p1, marginTop: 2 },
  cards: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: { flexGrow: 1, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, borderRadius: 12, padding: 14, gap: 6 },
  k: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.2, color: C.muted, textTransform: "uppercase" },
  cash: { fontFamily: F.display, fontSize: 34, color: C.text },
  small: { fontFamily: F.body, fontSize: 15, color: C.textSoft },
  b: { fontFamily: F.bodyBold, color: C.text },
  line: { flexDirection: "row", justifyContent: "space-between", gap: 10, paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: C.line },
  lineT: { flex: 1, fontFamily: F.body, fontSize: 14, color: C.textSoft },
  lineV: { fontFamily: F.mono, fontSize: 13, color: C.text },
  month: { fontFamily: F.mono, fontSize: 11, color: C.muted },
  toggle: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  box: { width: 22, height: 22, borderRadius: 5, borderWidth: 1, borderColor: C.brassDim, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: C.brass, borderColor: C.brass },
  tick: { fontFamily: F.bodyBold, fontSize: 14, color: C.brassInk },
  toggleT: { flex: 1, fontFamily: F.body, fontSize: 14, color: C.textSoft },
  reset: { fontFamily: F.mono, fontSize: 12, color: C.muted, letterSpacing: 1 }
});
