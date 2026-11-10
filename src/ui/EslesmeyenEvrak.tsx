// Evrak klasöründe (ya da toplu yüklemede) föyü bulunamayan bir evrak için seçenekler. Avukat neyin ne olduğunu söyler:
//  1) Yeni dosya aç: tür (ceza soruşturması, tarafımca yürütülen arabuluculuk, idari dava…) evraktan tahmin edilir, merci,
//     numara ve taraflar evraktan doldurulur; "şahsi dosyam" işaretlenirse dosya şifreli şahsi dosyalara açılır.
//  2) Var olan dosyaya ekle: dosyalar türü, mercii, numarası ve müvekkiliyle listelenir; aynı numaralılar başta gelir.
//  3) Dilekçe örneği olarak kaydet: evrak föye girmez; kodlanıp "Dilekçe örneklerim"e girer (beyan yazarken üslup örneği).
//  4) Gereksiz: listeden kalkar, Celse bir daha sormaz (dosya bilgisayarda kalır). Sonra bakarım: bu taramada gizlenir.
// "İçeriğe bak" evrakın okunan yazısını gösterir. Var olan dosyalar benzerliğe göre (numara, taraf adı, merci, tür) sıralanır.
import React, { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { BEYAN_KLASORLERI, beyanTuru } from "../data/beyan";
import { ornekEkle, ornekTurTahmin } from "../data/dilekceOrnek";
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

export function EslesmeyenEvrak({ d, liste, onEkle, onAtla, onOrnek, onSonra }: { d: TaramaDosyasi; liste: Foy[]; onEkle: (foyId: string) => Promise<void>; onAtla: () => void; onOrnek?: () => void; onSonra?: () => void }) {
  const k = useMemo(() => kunyeCikar(d.metin || ""), [d.metin]);
  const tahmin = useMemo<FoyTur>(() => turTahmin(k.dosyaTuru || "", k.mahkeme || "", d.kaynak.ad, (d.metin || "").slice(0, 4000)) || "hukuk", [k, d]);
  const [mod, setMod] = useState<"" | "yeni" | "var" | "ornek">("");
  const ornekTur = useMemo(() => ornekTurTahmin(d.metin || "", d.kaynak.ad), [d]);
  const [ornekKlasor, setOrnekKlasor] = useState(() => (ornekTur ? beyanTuru(ornekTur).klasor : "Dilekçeler"));
  const [tur, setTur] = useState<FoyTur>(tahmin);
  const [muvekkil, setMuvekkil] = useState(k.birinci?.ad || "");
  const [karsi, setKarsi] = useState(k.ikinci?.ad || "");
  const [merci, setMerci] = useState(k.mahkeme || "");
  const [no, setNo] = useState(k.esasNo || "");
  const [ozel, setOzel] = useState(false);
  const [q, setQ] = useState("");
  const [icerik, setIcerik] = useState(false);
  const [turSuz, setTurSuz] = useState<string>("_hepsi");
  const [hata, setHata] = useState("");
  const [bekle, setBekle] = useState(false);
  // Benzerlik: aynı numara > taraf adı tutuyor > dosya adında föyün tarafı geçiyor > aynı merci > aynı tür.
  const adaylar = useMemo(() => {
    const ns = nolar(d.kaynak.yol + " " + (d.metin || "").slice(0, 4000));
    const bas = (d.kaynak.yol + " " + d.kaynak.ad + " " + (d.metin || "").slice(0, 4000)).toLocaleLowerCase("tr");
    const adlar = [k.birinci?.ad, k.ikinci?.ad].filter(Boolean).map(x => String(x).toLocaleLowerCase("tr"));
    const kelime = (x?: string) => (x || "").toLocaleLowerCase("tr").split(/[^a-zçğıöşü]+/).filter(w => w.length >= 4);
    const puanla = (f: Foy) => {
      const neden: string[] = []; let p = 0;
      if (f.esasNo && [...nolar(f.esasNo)].some(x => ns.has(x))) { p += 100; neden.push(t("aynı numara")); }
      const taraf = [...kelime(f.muvekkil), ...kelime(f.karsiTaraf)];
      const tutan = taraf.filter(w => bas.includes(w) || adlar.some(a => a.includes(w)));
      if (tutan.length) { p += 30 + tutan.length * 10; neden.push(t("taraf adı tutuyor")); }
      const merci = (x: string) => x.toLocaleLowerCase("tr").replace(/sayın|hakimliği|hâkimliği|mahkemesi(ne)?|'?n[ea]\b|[.,']/g, " ").replace(/\s+/g, " ").trim();
      if (k.mahkeme && f.mahkeme) { const a = merci(k.mahkeme), b = merci(f.mahkeme); if (a.length > 6 && b.length > 6 && (a === b || a.includes(b) || b.includes(a))) { p += 15; neden.push(t("aynı merci")); } }
      if ((f.tur || "hukuk") === tahmin) { p += 5; }
      return { f, p, neden };
    };
    const kq = q.trim().toLocaleLowerCase("tr");
    return liste
      .filter(f => turSuz === "_hepsi" || (f.tur || "hukuk") === turSuz)
      .filter(f => !kq || [turBilgi(f.tur).ad, f.muvekkil, f.karsiTaraf, f.mahkeme, f.esasNo, f.davaTuru].join(" ").toLocaleLowerCase("tr").includes(kq))
      .map(puanla)
      .filter(x => kq || turSuz !== "_hepsi" || x.p >= 15)
      .sort((a, b) => b.p - a.p || (b.f.guncelleme || "").localeCompare(a.f.guncelleme || "")).slice(0, 12);
  }, [liste, q, d, k, tahmin, turSuz]);
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
          <Btn label={t("➕ Bunun için yeni dosya aç")} onPress={() => { setOzel(false); setMod("yeni"); }} />
          <Btn kind="secondary" label={t("📁 Var olan dosyaya ekle")} onPress={() => setMod("var")} />
          <Btn kind="secondary" label={t("🔒 Şahsi dosyam")} onPress={() => { setOzel(true); setMod("yeni"); }} />
          {!!onOrnek && !!(d.metin || "").trim() && <Btn kind="secondary" label={t("📝 Dilekçe örneği olarak kaydet")} onPress={() => setMod("ornek")} />}
        </View>
      )}
      {!mod && (
        <View style={[s.addRow, { alignItems: "center" }]}>
          <Pressable onPress={() => setIcerik(x => !x)}><Text style={s.link}>{icerik ? t("İçeriği gizle") : t("👁 İçeriğe bak")}</Text></Pressable>
          {!!onSonra && <Pressable onPress={onSonra}><Text style={s.link}>{t("Sonra bakarım")}</Text></Pressable>}
          <Pressable onPress={onAtla}><Text style={s.sil}>{t("🗑 Gereksiz, listeden kaldır")}</Text></Pressable>
        </View>
      )}
      {icerik && (
        <View style={{ gap: 4, borderLeftWidth: 2, borderLeftColor: C.line, paddingLeft: 8 }}>
          <Text style={s.hint}>{d.kaynak.yol}</Text>
          <Text style={[s.body, { fontSize: 13 }]}>{(d.metin || "").trim() ? (d.metin || "").trim().slice(0, 2500) + ((d.metin || "").length > 2500 ? " …" : "") : t("Bu evrakın yazısı okunamadı ({n}).", { n: d.okunamadi || t("taranmış görüntü olabilir") })}</Text>
          <Text style={s.hint}>{t("“Gereksiz” derseniz dosya bilgisayarınızdaki klasörde kalır; Celse yalnız bir daha sormaz.")}</Text>
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
      {mod === "ornek" && (
        <View style={{ gap: 8 }}>
          <Text style={s.hint}>{t("Bu evrak bir dosyaya girmez; adlar ve numaralar kodlanıp Beyan editörü > Dilekçe örneklerim'e kaydedilir. Beyan yazarken üslup örneği olur.")}{ornekTur ? " " + t("Anlaşılan tür: {x}", { x: t(ornekTur) }) : ""}</Text>
          <Acilir etiket={t("Hangi klasör")} genislik={280} secili={ornekKlasor} onSec={setOrnekKlasor} secenekler={BEYAN_KLASORLERI.map(k => ({ k: k.ad, ad: t(k.ad) }))} />
          {!!hata && <Text style={s.err}>{hata}</Text>}
          <View style={s.addRow}>
            <Btn label={bekle ? t("Kaydediliyor…") : t("Örnek olarak kaydet")} disabled={bekle} onPress={async () => {
              setBekle(true); setHata("");
              try { await ornekEkle({ ad: d.kaynak.ad, metin: d.metin || "", klasor: ornekKlasor, tur: ornekTur && beyanTuru(ornekTur).klasor === ornekKlasor ? ornekTur : undefined, kaynak: d.kaynak.yol }); onOrnek?.(); }
              catch (e) { setHata(t(String((e as Error).message || e))); }
              setBekle(false);
            }} />
            <Btn kind="ghost" label={t("Geri")} onPress={() => setMod("")} />
          </View>
        </View>
      )}
      {mod === "var" && (
        <View style={{ gap: 6 }}>
          <View style={[s.addRow, { alignItems: "flex-end" }]}>
            <TextInput value={q} onChangeText={setQ} placeholder={t("Ara: ad soyad, merci, numara…")} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1, minWidth: 220 }]} autoFocus />
            <Acilir etiket={t("Dava tipi")} genislik={220} secili={turSuz} onSec={setTurSuz}
              secenekler={[{ k: "_hepsi", ad: t("Bütün türler") }, ...TURLER.filter(x => liste.some(f => (f.tur || "hukuk") === x.tur)).map(x => ({ k: x.tur, ad: t(x.ad), n: liste.filter(f => (f.tur || "hukuk") === x.tur).length }))]} />
          </View>
          {!q.trim() && turSuz === "_hepsi" && <Text style={s.hint}>{t("Benzer dosyalar (numara, taraf adı, merci ve türe göre). Aradığınız yoksa ad soyad yazın ya da dava tipini seçin.")}</Text>}
          {adaylar.map(({ f, neden }) => (
            <Pressable key={f.id} onPress={async () => { setBekle(true); try { await onEkle(f.id); } finally { setBekle(false); } }} disabled={bekle} style={{ gap: 1 }}>
              <Text style={s.link}>{[f.muvekkil || t("müvekkil yazılmamış"), f.karsiTaraf].filter(Boolean).join(" – ")}{f.ozel ? " 🔒" : ""}</Text>
              <Text style={s.hint}>{[turBilgi(f.tur).ad, f.davaTuru, f.mahkeme, f.esasNo, f.durum === "kapali" ? t("kapalı") : ""].filter(Boolean).join(" · ")}{neden.length ? "  ·  " + neden.join(", ") : ""}</Text>
            </Pressable>
          ))}
          {!adaylar.length && <Text style={s.hint}>{q.trim() || turSuz !== "_hepsi" ? t("Bu aramayla dosya yok.") : t("Benzer dosya bulunamadı. Ad soyad yazarak arayın, dava tipini seçin ya da “Geri” deyip yeni dosya açın.")}</Text>}
          <View style={s.addRow}><Btn kind="ghost" label={t("Geri")} onPress={() => setMod("")} /></View>
        </View>
      )}
    </View>
  );
}
