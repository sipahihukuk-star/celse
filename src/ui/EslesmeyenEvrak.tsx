// Evrak klasöründe (ya da toplu yüklemede) föyü bulunamayan bir evrak için seçenekler. Avukat neyin ne olduğunu söyler:
//  1) Yeni dosya aç: tür (ceza soruşturması, tarafımca yürütülen arabuluculuk, idari dava…) evraktan tahmin edilir, merci,
//     numara ve taraflar evraktan doldurulur; "şahsi dosyam" işaretlenirse dosya şifreli şahsi dosyalara açılır.
//  2) Var olan dosyaya ekle: dosyalar türü, mercii, numarası ve müvekkiliyle listelenir; aynı numaralılar başta gelir.
//  3) Atla.
import React, { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { bosFoy, Foy, foyKaydet, ozelKilitDurumu } from "../data/foy";
import { FoyTur, TURLER, turBilgi, turTahmin } from "../data/foyTurleri";
import { kunyeCikar } from "../data/kunyeCikar";
import { t } from "../i18n";
import { Acilir } from "./Acilir";
import type { TaramaDosyasi } from "./foyKlasor";
import { s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";

const NO = /(?<!\d)(19[89]\d|20\d\d)\s*[/_\-. ]\s*(\d{1,6})(?!\d)/g;
const nolar = (x: string) => new Set([...(x || "").matchAll(NO)].map(m => `${m[1]}/${+m[2]}`));
const temizAd = (ad: string) => ad.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_]+/g, " ").trim();

/** Bir dosyanın listede görünen adı: TÜR · merci · numara · müvekkil. */
export const foyEtiketi = (f: Foy) => [turBilgi(f.tur).kisa, f.mahkeme, f.esasNo, f.muvekkil || f.karsiTaraf].filter(Boolean).join(" · ") + (f.ozel ? " 🔒" : "") + (f.durum === "kapali" ? " (kapalı)" : "");

export function EslesmeyenEvrak({ d, liste, onEkle, onAtla }: { d: TaramaDosyasi; liste: Foy[]; onEkle: (foyId: string) => Promise<void>; onAtla: () => void }) {
  const k = useMemo(() => kunyeCikar(d.metin || ""), [d.metin]);
  const tahmin = useMemo<FoyTur>(() => turTahmin(k.dosyaTuru || "", k.mahkeme || "", d.kaynak.ad, (d.metin || "").slice(0, 4000)) || "hukuk", [k, d]);
  const [mod, setMod] = useState<"" | "yeni" | "var">("");
  const [tur, setTur] = useState<FoyTur>(tahmin);
  const [muvekkil, setMuvekkil] = useState(k.birinci?.ad || "");
  const [karsi, setKarsi] = useState(k.ikinci?.ad || "");
  const [merci, setMerci] = useState(k.mahkeme || "");
  const [no, setNo] = useState(k.esasNo || "");
  const [ozel, setOzel] = useState(false);
  const [q, setQ] = useState("");
  const [hata, setHata] = useState("");
  const [bekle, setBekle] = useState(false);
  const adaylar = useMemo(() => {
    const ns = nolar(d.kaynak.yol + " " + (d.metin || "").slice(0, 4000));
    const sk = (f: Foy) => (f.esasNo && [...nolar(f.esasNo)].some(x => ns.has(x)) ? 0 : 1);
    const kq = q.trim().toLocaleLowerCase("tr");
    return [...liste].filter(f => !kq || [turBilgi(f.tur).ad, f.muvekkil, f.karsiTaraf, f.mahkeme, f.esasNo].join(" ").toLocaleLowerCase("tr").includes(kq))
      .sort((a, b) => sk(a) - sk(b) || (b.guncelleme || "").localeCompare(a.guncelleme || "")).slice(0, 10);
  }, [liste, q, d]);
  const tb = turBilgi(tur);

  const ac = async () => {
    setHata("");
    if (ozel && (await ozelKilitDurumu()) !== "acik") { setHata(t("Şahsi dosyalar kilitli ya da şifresi kurulmamış. Föylerim ekranının üstündeki “🔒 Şahsi dosyalar” bölümünden şifreyle açın (yoksa kurun), sonra yeniden deneyin.")); return; }
    setBekle(true);
    try {
      const f = bosFoy({ tur, muvekkil: muvekkil.trim(), karsiTaraf: karsi.trim(), mahkeme: merci.trim(), esasNo: no.trim(), ...(k.acilis ? { acilis: k.acilis } : {}), ...(k.durusma ? { durusma: k.durusma } : {}), ...(ozel ? { ozel: true } : {}),
        notlar: t("“{ad}” evrakından açıldı.", { ad: d.kaynak.ad }) });
      await foyKaydet(f);
      await onEkle(f.id);
    } catch (e) { setHata(t(String((e as Error).message || e))); }
    setBekle(false);
  };

  return (
    <View style={[s.file, { flexDirection: "column", alignItems: "stretch", gap: 8 }]}>
      <Text style={s.fileT} numberOfLines={2}>{d.kaynak.ad}</Text>
      <Text style={s.hint}>{t("Bu evrakın dosyası bulunamadı ({n}).", { n: t(d.neden || "numara bulunamadı") })} {t("Evraktan anlaşılan:")} {[tb.ad, k.mahkeme, k.esasNo].filter(Boolean).join(" · ") || t("tür ve numara okunamadı")}{d.okunamadi ? " · " + t("okunamadı: {n}", { n: d.okunamadi }) : ""}</Text>
      {!mod && (
        <View style={s.addRow}>
          <Btn label={t("➕ Bunun için yeni dosya aç")} onPress={() => setMod("yeni")} />
          <Btn kind="secondary" label={t("📁 Var olan dosyaya ekle")} onPress={() => setMod("var")} />
          <Pressable onPress={onAtla}><Text style={s.sil}>{t("Atla")}</Text></Pressable>
        </View>
      )}
      {mod === "yeni" && (
        <View style={{ gap: 8 }}>
          <Text style={s.hint}>{t("Ne olduğunu seçin; bilgiler evraktan dolduruldu, düzeltebilirsiniz.")}</Text>
          <Acilir etiket={t("Bu evrak ne?")} genislik={340} secili={tur} onSec={x => setTur(x as FoyTur)}
            secenekler={TURLER.filter(x => x.tur !== "ozel_ceza").map(x => ({ k: x.tur, ad: t(x.ad) + (x.tur === tahmin ? " ✓ " + t("(tahmin)") : "") }))} />
          <Text style={s.hint}>{t(tb.aciklama)}</Text>
          <View style={s.addRow}>
            <TextInput value={merci} onChangeText={setMerci} placeholder={t(tb.merci) + (tb.merciOrnek ? " (" + tb.merciOrnek + ")" : "")} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 2, minWidth: 220 }]} />
            <TextInput value={no} onChangeText={setNo} placeholder={t(tb.no)} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1, minWidth: 120 }]} />
          </View>
          <View style={s.addRow}>
            <TextInput value={muvekkil} onChangeText={setMuvekkil} placeholder={t("Müvekkil (ya da dosyanın sahibi)")} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1, minWidth: 180 }]} />
            <TextInput value={karsi} onChangeText={setKarsi} placeholder={t("Karşı taraf")} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1, minWidth: 180 }]} />
          </View>
          <Pressable onPress={() => setOzel(x => !x)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }} accessibilityRole="checkbox" accessibilityState={{ checked: ozel }}>
            <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: ozel ? C.brass : C.muted, backgroundColor: ozel ? C.brass : "transparent", alignItems: "center", justifyContent: "center" }}>
              {ozel && <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>✓</Text>}
            </View>
            <Text style={[s.body, { flex: 1 }]}>{t("🔒 Şahsi dosyam: yalnız ben görürüm (şifreli; büroyla paylaşılmaz, yapay zekâ genel aramalarına girmez)")}</Text>
          </Pressable>
          {!!hata && <Text style={s.err}>{hata}</Text>}
          <View style={s.addRow}>
            <Btn label={bekle ? t("Açılıyor…") : t("Dosyayı aç ve evrakı içine koy")} disabled={bekle} onPress={ac} />
            <Btn kind="ghost" label={t("Geri")} onPress={() => setMod("")} />
          </View>
        </View>
      )}
      {mod === "var" && (
        <View style={{ gap: 6 }}>
          <TextInput value={q} onChangeText={setQ} placeholder={t("Ara: müvekkil, merci, numara, tür…")} placeholderTextColor={C.muted} style={s.inputTek} autoFocus />
          {adaylar.map(f => (
            <Pressable key={f.id} onPress={async () => { setBekle(true); try { await onEkle(f.id); } finally { setBekle(false); } }} disabled={bekle}>
              <Text style={s.link}>{foyEtiketi(f)}</Text>
            </Pressable>
          ))}
          {!adaylar.length && <Text style={s.hint}>{t("Eşleşen dosya yok; “Geri” deyip yeni dosya açabilirsiniz.")}</Text>}
          <View style={s.addRow}><Btn kind="ghost" label={t("Geri")} onPress={() => setMod("")} /><Pressable onPress={onAtla}><Text style={s.sil}>{t("Atla")}</Text></Pressable></View>
        </View>
      )}
    </View>
  );
}
