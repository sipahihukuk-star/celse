// Duruşma ve keşifler sekmesi: bütün föylerdeki duruşma ve keşif günleri gün gün. Satıra basınca föy açılır; girildi kutusu
// buradan da işaretlenir; hukuk duruşmalarında e-duruşmanın istenip istenmediği, istendiyse kabul / red sonucu buradan izlenir ve
// işaretlenir ("E-duruşmalar" görünümü); bekleyen konular görünür; liste Excel'e aktarılır.
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { bugunGun, dTur, DTur, DTUR_AD, DTUR_SIMGE, EDurum, eSorulur, girildiSoru, gunKaydir, icraMi, takvim, TakvimSatir } from "../data/durusma";
import { eDurumYaz } from "../data/otoIs";
import { useSayfalama } from "./Sayfalama";
import { Foy, foyKaydet } from "../data/foy";
import { turBilgi } from "../data/foyTurleri";
import { xlsxYaz } from "../data/xlsxYaz";
import { t } from "../i18n";
import { Acilir } from "./Acilir";
import { indir, s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";
import { DurusmaListesiYukle } from "./DurusmaListesiYukle";
import { Katlanir } from "./Katlanir";

const AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const GUN = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const gunBaslik = (g: string) => { const d = new Date(g + "T00:00:00Z"); return `${d.getUTCDate()} ${AY[d.getUTCMonth()]} ${d.getUTCFullYear()} ${GUN[d.getUTCDay()]}`; };
const trTarih = (x: string) => x.slice(0, 10).split("-").reverse().join(".");
const E_AD: Record<string, string> = { istenmeyecek: "e-duruşma istenmeyecek", talep: "e-duruşma talep edildi, karar bekleniyor", kabul: "e-duruşma kabul ✓", red: "e-duruşma reddedildi: bizzat girilecek" };
/** Hukuk (e-duruşma sorulan) dosyasının duruşması mı? */
const eSatiri = (x: TakvimSatir) => x.tur === "durusma" && eSorulur(x.f) && !icraMi(x.f);
const E_SECENEK: { k: EDurum | "-"; ad: string }[] = [{ k: "-", ad: "Sorulmadı / istenmedi" }, { k: "talep", ad: "Talep edildi ⏳" }, { k: "kabul", ad: "Kabul edildi ✓" }, { k: "red", ad: "Reddedildi ✗" }, { k: "istenmeyecek", ad: "İstenmeyecek" }];
type Donem = "bugun" | "hafta" | "30" | "90" | "ileri" | "gecmis30" | "gecmis365";

export function DurusmalarEkrani({ liste, onAc, yukleAc }: { liste: Foy[]; onAc: (id: string) => void; yukleAc?: boolean }) {
  const bugun = bugunGun();
  const [donem, setDonem] = useState<Donem>(() => { try { return (globalThis.localStorage?.getItem("celse-durusma-donem") as Donem) || "30"; } catch { return "30"; } });
  const [tur, setTur] = useState<"hepsi" | DTur | "e">("hepsi");
  const [bekleyen, setBekleyen] = useState(false);
  // Sıra: eskiden yeniye (yakın gün önce) ya da yeniden eskiye.
  const [sira, setSiraRaw] = useState<"eski" | "yeni">(() => { try { return globalThis.localStorage?.getItem("celse-durusma-sira") === "yeni" ? "yeni" : "eski"; } catch { return "eski"; } });
  const setSira = (v: "eski" | "yeni") => { setSiraRaw(v); try { globalThis.localStorage?.setItem("celse-durusma-sira", v); } catch { /* yok say */ } };
  const [ara, setAra] = useState("");
  const donemSec = (d: Donem) => { setDonem(d); try { globalThis.localStorage?.setItem("celse-durusma-donem", d); } catch { /* yok say */ } };
  const [bas, son] = donem === "bugun" ? [bugun, bugun] : donem === "hafta" ? [bugun, gunKaydir(bugun, 7)] : donem === "30" ? [bugun, gunKaydir(bugun, 30)]
    : donem === "90" ? [bugun, gunKaydir(bugun, 90)] : donem === "ileri" ? [bugun, gunKaydir(bugun, 3650)] : donem === "gecmis30" ? [gunKaydir(bugun, -30), gunKaydir(bugun, -1)] : [gunKaydir(bugun, -365), gunKaydir(bugun, -1)];
  const hepsi = useMemo(() => takvim(liste, bas, son, bugun), [liste, bas, son, bugun]);
  const q = ara.trim().toLocaleLowerCase("tr");
  const satirlar = hepsi.filter(x => (tur === "hepsi" || (tur === "e" ? eSatiri(x) : x.tur === tur)) && (!bekleyen || !!x.uyari)
    && (!q || [x.f.muvekkil, x.f.karsiTaraf, x.d.mahkeme || x.f.mahkeme, x.d.esasNo || x.f.esasNo, x.f.davaTuru].join(" ").toLocaleLowerCase("tr").includes(q)));
  // Sıraya dizilir, sayfalara bölünür (Sayfada 5 / 10 / 25…), sayfadakiler gün gün gruplanır.
  const sirali = useMemo(() => (sira === "yeni" ? [...satirlar].reverse() : satirlar), [satirlar, sira]);
  const sayfa = useSayfalama("durusmalar", sirali, 25, [donem, tur, bekleyen, sira, satirlar.length]);
  const gruplar = useMemo(() => {
    const m = new Map<string, TakvimSatir[]>();
    for (const x of sayfa.sayfadaki) m.set(x.gun, [...(m.get(x.gun) || []), x]);
    return [...m.entries()];
  }, [sayfa.sayfadaki]);

  // Özet: bugün, yarın, 7 gün, e-duruşma kararı beklenen, geçmişte işaretlenmemiş.
  const ozet = useMemo(() => {
    const yakin = takvim(liste, gunKaydir(bugun, -45), gunKaydir(bugun, 7), bugun);
    return {
      bugun: yakin.filter(x => x.gun === bugun).length,
      yarin: yakin.filter(x => x.gun === gunKaydir(bugun, 1)).length,
      hafta: yakin.filter(x => x.gun >= bugun).length,
      kesif: yakin.filter(x => x.gun >= bugun && x.tur === "kesif").length,
      haciz: yakin.filter(x => x.gun >= bugun && x.tur === "haciz").length,
      eBekleyen: takvim(liste, bugun, gunKaydir(bugun, 90), bugun).filter(x => x.d.e === "talep").length,
      eSorulmadi: takvim(liste, bugun, gunKaydir(bugun, 30), bugun).filter(x => eSatiri(x) && !x.d.e).length,
      eKabul: takvim(liste, bugun, gunKaydir(bugun, 30), bugun).filter(x => eSatiri(x) && x.d.e === "kabul").length,
      isaretsiz: yakin.filter(x => x.gun < bugun && !x.d.girildi && x.f.durum !== "kapali").length
    };
  }, [liste, bugun]);

  const girildi = async (x: TakvimSatir) => {
    const sonraki = x.d.girildi === undefined ? "evet" : x.d.girildi === "evet" ? "hayir" : undefined;
    await foyKaydet({ ...x.f, durusmalar: (x.f.durusmalar || []).map(d => (d.id === x.d.id ? { ...d, girildi: sonraki } : d)) });
  };
  const eYaz = async (x: TakvimSatir, durum: EDurum | undefined) => { await foyKaydet({ ...x.f, ...eDurumYaz(x.f, x.d.id, durum, bugun) }); };
  const excel = () => {
    const tablo: (string | number)[][] = [["Gün", "Saat", "Tür", "Mahkeme / merci", "Dosya no", "Müvekkil – karşı taraf", "Dosya türü", "Aşama", "E-duruşma", "Girildi", "Bekleyen konu"],
      ...(sira === "yeni" ? [...satirlar].reverse() : satirlar).map(x => [trTarih(x.d.tarih), x.d.tarih.length > 10 ? x.d.tarih.slice(11, 16) : "", DTUR_AD[x.tur], x.d.mahkeme || x.f.mahkeme, x.d.esasNo || x.f.esasNo,
        [x.f.muvekkil, x.f.karsiTaraf].filter(Boolean).join(" – "), turBilgi(x.f.tur).ad, x.f.asama || "", x.d.e ? E_AD[x.d.e] : "", x.d.girildi === "evet" ? "Evet" : x.d.girildi === "hayir" ? "Hayır" : "", x.uyari?.metin || ""])];
    const b = xlsxYaz("Duruşma haciz keşif", tablo, [12, 7, 9, 34, 12, 34, 16, 14, 26, 8, 34]);
    indir(`durusma-ve-kesifler-${bugun}.xlsx`, new Blob([b as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  };

  const Hap = ({ ad, n, renk, onPress }: { ad: string; n: number; renk: string; onPress?: () => void }) => (
    <Pressable onPress={onPress} disabled={!onPress} style={{ borderWidth: 1, borderColor: n ? renk : C.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
      <Text style={{ color: n ? renk : C.muted, fontWeight: "700", fontSize: 13 }}>{ad}: {n}</Text>
    </Pressable>
  );

  return (
    <ScrollView contentContainerStyle={[s.wrap, { maxWidth: 1000 }]} keyboardShouldPersistTaps="handled">
      <Text style={s.eyebrow}>{t("DAVA TAKİBİ · DURUŞMA, HACİZ, KEŞİF")}</Text>
      <Text style={s.title}>{t("Duruşma, haciz ve keşif")}</Text>
      <Text style={s.hint}>{t("Bütün föylerdeki duruşma, haciz ve keşif günleri (icra dosyalarında duruşma yoktur; haciz ve keşif günü vardır). Satıra basınca föy açılır; kutuya basarak işaretleyin (bir kez ✓, iki kez ✗). Keşif ve haciz günleri tutanak ve ara karardan da okunur. Hukuk duruşmalarında sağdaki “E-duruşma” seçiminden e-duruşmanın istenip istenmediğini, istendiyse kabul ya da red sonucunu işaretleyin; “Tür: E-duruşmalar” yalnız bunları gösterir.")}</Text>

      <View style={[s.card, { flexDirection: "row", flexWrap: "wrap", gap: 8 }]}>
        <Hap ad={t("Bugün")} n={ozet.bugun} renk={C.bad} onPress={() => donemSec("bugun")} />
        <Hap ad={t("Yarın")} n={ozet.yarin} renk={C.p2} onPress={() => donemSec("hafta")} />
        <Hap ad={t("7 gün içinde")} n={ozet.hafta} renk={C.mid} onPress={() => donemSec("hafta")} />
        <Hap ad={t("Keşif (7 gün)")} n={ozet.kesif} renk={C.brass} onPress={() => { donemSec("hafta"); setTur("kesif"); }} />
        <Hap ad={t("Haciz (7 gün)")} n={ozet.haciz} renk={C.brass} onPress={() => { donemSec("hafta"); setTur("haciz"); }} />
        <Hap ad={t("E-duruşma istenmemiş (30 gün)")} n={ozet.eSorulmadi} renk={C.bad} onPress={() => { donemSec("30"); setTur("e"); setBekleyen(false); }} />
        <Hap ad={t("E-duruşma kararı beklenen")} n={ozet.eBekleyen} renk={C.mid} onPress={() => { donemSec("90"); setTur("e"); setBekleyen(false); }} />
        <Hap ad={t("E-duruşma kabul (30 gün)")} n={ozet.eKabul} renk={C.good} onPress={() => { donemSec("30"); setTur("e"); setBekleyen(false); }} />
        <Hap ad={t("Girildi işaretlenmemiş")} n={ozet.isaretsiz} renk={C.bad} onPress={() => { donemSec("gecmis30"); setBekleyen(true); }} />
      </View>

      <Katlanir key={yukleAc ? "a" : "k"} anahtar="durusma-liste-yukle" zorla={yukleAc} baslik={t("📥 UYAP duruşma listesini yükle")} ozet={t("Excel, PDF, Word, ekran görüntüsü ya da kopyalanan tablo")}>
        <DurusmaListesiYukle liste={liste} onBitti={() => { donemSec("ileri"); setTur("hepsi"); setBekleyen(false); setAra(""); }} />
      </Katlanir>

      <View style={s.card}>
        <TextInput value={ara} onChangeText={setAra} placeholder={t("Ara: müvekkil, mahkeme, dosya no…")} placeholderTextColor={C.muted} style={s.inputTek} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
          <Acilir etiket={t("Dönem")} secili={donem} genislik={200} onSec={k => donemSec(k as Donem)}
            secenekler={[{ k: "bugun", ad: t("Bugün") }, { k: "hafta", ad: t("Önümüzdeki 7 gün") }, { k: "30", ad: t("Önümüzdeki 30 gün") }, { k: "90", ad: t("Önümüzdeki 90 gün") }, { k: "ileri", ad: t("Bütün ileri tarihler") }, { k: "gecmis30", ad: t("Geçmiş 30 gün") }, { k: "gecmis365", ad: t("Geçmiş 1 yıl") }]} />
          <Acilir etiket={t("Tür")} secili={tur} genislik={220} onSec={k => setTur(k as "hepsi" | DTur | "e")}
            secenekler={[{ k: "hepsi", ad: t("Hepsi") }, { k: "durusma", ad: "⚖ " + t("Yalnız duruşma") }, { k: "e", ad: "💻 " + t("E-duruşmalar (hukuk)") }, { k: "haciz", ad: "📌 " + t("Yalnız haciz") }, { k: "kesif", ad: "🔍 " + t("Yalnız keşif") }]} />
          <Acilir etiket={t("Sıra")} secili={sira} genislik={190} onSec={k => setSira(k as "eski" | "yeni")}
            secenekler={[{ k: "eski", ad: t("Eskiden yeniye") }, { k: "yeni", ad: t("Yeniden eskiye") }]} />
          <Acilir etiket={t("Göster")} secili={bekleyen ? "bekleyen" : "hepsi"} genislik={220} onSec={k => setBekleyen(k === "bekleyen")}
            secenekler={[{ k: "hepsi", ad: t("Hepsi") }, { k: "bekleyen", ad: t("Yalnız konu bekleyenler") }]} />
        </View>
        <View style={[s.row, { alignItems: "center" }]}>
          <Text style={[s.body, { flex: 1 }]}>{t("{n} kayıt", { n: satirlar.length })} · {trTarih(bas)}{bas !== son ? " – " + trTarih(son) : ""}</Text>
          <Btn kind="secondary" label={t("Excel'e aktar (.xlsx)")} disabled={!satirlar.length} onPress={excel} />
        </View>
      </View>

      {sayfa.ust}
      {gruplar.map(([g, xs]) => (
        <View key={g} style={{ gap: 6 }}>
          <Text style={{ color: g === bugun ? C.bad : C.brass, fontWeight: "800", fontSize: 15, marginTop: 6 }}>
            {gunBaslik(g)}{g === bugun ? " · " + t("bugün") : g === gunKaydir(bugun, 1) ? " · " + t("yarın") : ""}
          </Text>
          {xs.map(x => {
            const tr = dTur(x.d), kesif = tr !== "durusma";
            const gecmis = x.gun < bugun;
            return (
              <View key={x.f.id + x.d.id} style={[s.card, { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center", borderLeftWidth: 5, borderLeftColor: x.uyari ? C.mid : kesif ? C.brass : C.line, paddingVertical: 10 }]}>
                <Pressable onPress={() => girildi(x)} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: x.d.girildi === "evet" }}
                  accessibilityLabel={t(girildiSoru(tr)).replace(/\?$/, "")}
                  style={{ width: 26, height: 26, borderRadius: 5, borderWidth: 2, alignItems: "center", justifyContent: "center",
                    borderColor: x.d.girildi === "evet" ? C.good : x.d.girildi === "hayir" ? C.bad : gecmis ? C.mid : C.muted,
                    backgroundColor: x.d.girildi === "evet" ? C.good : x.d.girildi === "hayir" ? C.bad : "transparent" }}>
                  {!!x.d.girildi && <Text style={{ color: "#fff", fontWeight: "800" }}>{x.d.girildi === "evet" ? "✓" : "✗"}</Text>}
                </Pressable>
                <Pressable onPress={() => onAc(x.f.id)} accessibilityRole="button" style={{ flex: 1, minWidth: 200, gap: 2 }}>
                  <Text style={[s.body, { color: C.text, fontWeight: "700" }]}>
                    {x.d.tarih.length > 10 ? x.d.tarih.slice(11, 16) + " · " : ""}{DTUR_SIMGE[tr] + " " + t(DTUR_AD[tr])} · {x.d.mahkeme || x.f.mahkeme || t("mahkeme yazılmamış")}{(x.d.esasNo || x.f.esasNo) ? " · " + (x.d.esasNo || x.f.esasNo) : ""}
                  </Text>
                  <Text style={s.hint} numberOfLines={1}>{[[x.f.muvekkil, x.f.karsiTaraf].filter(Boolean).join(" – "), x.f.davaTuru || t(turBilgi(x.f.tur).ad), x.f.asama].filter(Boolean).join(" · ")}</Text>
                  {((!!x.d.e && !eSatiri(x)) || !!x.uyari) && (
                    <Text style={{ color: x.uyari ? C.mid : x.d.e === "kabul" ? C.good : x.d.e === "red" ? C.bad : C.textSoft, fontSize: 13, fontWeight: "700" }}>
                      {[x.d.e && !kesif && !eSatiri(x) ? t(E_AD[x.d.e]) : "", x.uyari ? "⚠ " + t(x.uyari.metin) : ""].filter(Boolean).join(" · ")}
                    </Text>
                  )}
                  {!!x.d.not && <Text style={s.hint} numberOfLines={2}>{x.d.not}</Text>}
                </Pressable>
                {eSatiri(x) && (
                  <View style={{ alignItems: "flex-end", gap: 2 }}>
                    <Acilir etiket={t("E-duruşma")} secili={x.d.e || "-"} genislik={170} onSec={k => eYaz(x, k === "-" ? undefined : k as EDurum)}
                      secenekler={E_SECENEK.map(o => ({ k: o.k, ad: t(o.ad) }))} />
                    {(!!x.d.eTalep || !!x.d.eKarar) && <Text style={[s.hint, { fontSize: 11 }]}>{[x.d.eTalep ? t("talep {d}", { d: trTarih(x.d.eTalep) }) : "", x.d.eKarar ? t("karar {d}", { d: trTarih(x.d.eKarar) }) : ""].filter(Boolean).join(" · ")}</Text>}
                  </View>
                )}
                <Text style={{ color: C.brassDim, fontSize: 18 }}>›</Text>
              </View>
            );
          })}
        </View>
      ))}
      {sayfa.alt}
      {!gruplar.length && <Text style={s.hint}>{t("Bu dönemde duruşma, haciz ya da keşif yok.")}</Text>}
    </ScrollView>
  );
}
