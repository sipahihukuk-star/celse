// Beyan editörü (föyün içinde ve Dava takibi > Beyan editörü sekmesinde) ve altında İçtihat, mevzuat ve doktrin paneli.
// Avukat beyan türünü ve talimatını yazar ya da söyler; yapay zekâ föyden gövdeyi yazar (beyanCagri). Başlık (merci, dosya no,
// taraflar, vekil, konu) ve imza cihazda föyden eklenir. Taslaklar föyde saklanır; çıktı avukatın seçtiği biçimde (UDF, Word, PDF).
// Kaynak paneli resmî sitelerde içtihat / mevzuat, DergiPark gibi açık erişimli sitelerde doktrin arar; avukat elle de ekler.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { atif, Beyan, BEYAN_KLASORLERI, beyanCercevesi, beyanDosyaAdi, beyanHtml, beyanTuru, ciktiBicimi, docxOlustur, HukukKaynak, tamMetin, udfOlustur } from "../data/beyan";
import { ayarOku, ayarYaz, bosFoy, Foy, foyKaydet, yeniId } from "../data/foy";
import { turBilgi } from "../data/foyTurleri";
import { kutuphane, kutuphanedenSil, kutuphaneyeEkle } from "../data/hukukKutuphane";
import { DilekceOrnegi, ornekler, ornekSec } from "../data/dilekceOrnek";
import { t } from "../i18n";
import { Acilir } from "./Acilir";
import { beyanYazdir, kaynakBul } from "./beyanCagri";
import { belgeGetir, belgeKaynak, Karar, KanunMaddesi, kararAra, kararKaynak, kararKunye, MAHKEME_SECENEK, maddeKaynak, maddeKunye, MEVZUAT_TURU, mevzuatBul, MevzuatBelgesi, belgeKunye } from "./resmiKaynak";
import { indir, s } from "./foyStil";
import { DilekceOrnekleri } from "./DilekceOrnekleri";
import { Katlanir } from "./Katlanir";
import { Btn } from "./kit";
import { izinYokMetni, tanimaIzni, tanimaSinifi } from "./konusmaTanima";
import { C } from "./theme";

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const BICIMLER = [{ k: "udf", ad: "UYAP (UDF)" }, { k: "docx", ad: "Word (.docx)" }, { k: "pdf", ad: "PDF (yazdır)" }];
const TALIMAT_ORNEK: Record<string, string> = {
  mahkeme: "Örn. bilirkişinin kusur oranını %50 vermesine itiraz et; kavşakta geçiş hakkının bizde olduğunu, tanık beyanlarını ve kamera kaydını vurgula; yeni heyet iste",
  basvuru: "Örn. olayları tarih sırasıyla anlat, ihlal edilen hakları ayrı başlıklarla yaz, iç hukuk yollarının tüketildiğini ve sürede başvurduğumuzu göster",
  sozlesme: "Örn. kiraya veren müvekkil, aylık kira 20.000 TL, süre 1 yıl, depozito iki aylık kira, artış TÜFE oranında, ev hayvanı yasak",
  ihtarname: "Örn. 3 aylık kira borcunun 30 gün içinde ödenmesini, ödenmezse tahliye davası açılacağını ihtar et",
  rapor: "Örn. mahkemenin sorduğu kusur oranı ve tazminat hesabı; dosyadaki tutanak ve fotoğraflara göre değerlendir",
  serbest: "Örn. müvekkile dosyanın son durumunu, sıradaki duruşmayı ve beklenen süreyi sade bir dille anlatan yazı"
};
const TUR_AD: Record<HukukKaynak["tur"], string> = { ictihat: "İçtihat", mevzuat: "Mevzuat", doktrin: "Doktrin" };
const web = Platform.OS === "web";
const bosBeyan = (tur = "Beyan dilekçesi"): Beyan => { const n = new Date().toISOString(); return { id: yeniId("by"), olusturma: n, guncelleme: n, tur, konu: konuOner(tur), metin: "", kaynaklar: [] }; };
function konuOner(tur: string): string { return beyanTuru(tur).konu || ""; }

/** Talimatı söyleyerek yazdırmak için küçük dikte düğmesi. */
function Dikte({ onMetin }: { onMetin: (x: string) => void }) {
  const [dinliyor, setDinliyor] = useState(false);
  const rec = useRef<Any>(null);
  const R = tanimaSinifi();
  if (!R) return null;
  const basla = async () => {
    if (!(await tanimaIzni())) { onMetin(""); return; }
    const r = new R(); r.lang = "tr-TR"; r.interimResults = false; r.continuous = false;
    let son = "";
    r.onresult = (e: Any) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) son += e.results[i][0].transcript; };
    r.onend = () => { setDinliyor(false); if (son.trim()) onMetin(son.trim()); };
    r.onerror = () => setDinliyor(false);
    rec.current = r; try { r.start(); setDinliyor(true); } catch { setDinliyor(false); }
  };
  return <Btn kind={dinliyor ? "primary" : "ghost"} label={dinliyor ? t("⏹ Dur") : t("🎙 Söyle")} onPress={dinliyor ? () => { try { rec.current?.stop(); } catch { /* yok say */ } } : basla} />;
}

function KaynakKart({ k, onEkle, onKaydet, onSil, eklendi }: { k: HukukKaynak; onEkle?: () => void; onKaydet?: () => void; onSil?: () => void; eklendi?: boolean }) {
  return (
    <View style={[s.file, { flexDirection: "column", alignItems: "stretch", gap: 6 }]}>
      <Text style={s.meta}>{t(TUR_AD[k.tur])}{k.kaynak === "genel" ? " · " + t("yapay zekânın genel bilgisi, kaynak gösterilmedi") : k.kaynak === "elle" ? " · " + t("elle eklendi") : ""}</Text>
      <Text style={[s.body, { color: C.text, fontWeight: "700" }]}>{k.kunye}</Text>
      {!!k.ozet && <Text style={s.body}>{k.ozet}</Text>}
      {!!k.alinti && <Text style={[s.body, { fontStyle: "italic" }]}>“{k.alinti}”</Text>}
      <View style={s.addRow}>
        {!!k.url && <Pressable onPress={() => Linking.openURL(k.url!)}><Text style={s.link}>{t("Kaynağı aç")}</Text></Pressable>}
        {onEkle && <Btn kind={eklendi ? "secondary" : "primary"} label={eklendi ? t("✓ Beyanda") : t("➕ Beyana ekle")} onPress={onEkle} disabled={eklendi} />}
        {onKaydet && <Btn kind="ghost" label={t("⭐ Kütüphaneme kaydet")} onPress={onKaydet} />}
        {onSil && <Pressable onPress={onSil}><Text style={s.sil}>{t("Sil")}</Text></Pressable>}
      </View>
    </View>
  );
}

/** Bir kararın ya da mevzuatın tam metni (açılıp kapanır, içinde arama sözcükleri vurgulanmaz; kaydırılabilir). */
function TamMetin({ kaynak, id, meta }: { kaynak: "karar" | "mevzuat"; id: string; meta?: Karar | MevzuatBelgesi }) {
  const [m, setM] = useState<{ metin: string; pdf: boolean; url: string } | null>(null);
  const [hata, setHata] = useState("");
  useEffect(() => { belgeGetir(kaynak, id, meta).then(r => (r.ok ? setM(r) : setHata(t(r.hata, r.vars)))); }, [kaynak, id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (hata) return <Text style={s.err}>{hata}</Text>;
  if (!m) return <Text style={s.hint}>{t("Metin getiriliyor…")}</Text>;
  if (!m.metin) return <Text style={s.hint}>{m.pdf ? t("Bu belge yalnız PDF olarak yayımlanmış; “Kaynağı aç” ile resmî sitede okuyun.") : t("Metin alınamadı; “Kaynağı aç” ile resmî sitede okuyun.")}</Text>;
  return <ScrollView style={{ maxHeight: 420, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, backgroundColor: "#fbfaf6" }} nestedScrollEnabled><Text selectable style={{ color: "#111", fontSize: 14, lineHeight: 21 }}>{m.metin}</Text></ScrollView>;
}

/** Resmî arama: kararlar (Yargıtay, Danıştay, bölge adliye, ilk derece, KYB) ya da mevzuat (Celse kanun arşivi madde madde + resmî servis). */
function ResmiArama({ tur, f, onEkle, ekli, kaydet, ilkSoz, arsiv }: { tur: "ictihat" | "mevzuat"; f?: Foy | null; onEkle?: (k: HukukKaynak) => void; ekli: string[]; kaydet: (k: HukukKaynak) => void; ilkSoz: string; arsiv?: boolean }) {
  const [soz, setSoz] = useState(ilkSoz);
  const [mahkeme, setMahkeme] = useState("");
  const [birim, setBirim] = useState("");
  const [mtur, setMtur] = useState("");
  const [sayfa, setSayfa] = useState(1);
  const [bekle, setBekle] = useState(false);
  const [hata, setHata] = useState("");
  const [kararlar, setKararlar] = useState<Karar[] | null>(null);
  const [toplam, setToplam] = useState(0);
  const [maddeler, setMaddeler] = useState<KanunMaddesi[]>([]);
  const [belgeler, setBelgeler] = useState<MevzuatBelgesi[] | null>(null);
  const [acik, setAcik] = useState<string>("");
  const ara = async (sy = 1) => {
    if (soz.trim().length < 2) { setHata(t(tur === "ictihat" ? "Aranacak sözcükleri yazın (örn. \"bilirkişi raporuna itiraz\" süre)." : "Kanun ve madde (örn. HMK 281) ya da sözcük yazın.")); return; }
    setBekle(true); setHata(""); setAcik(""); setSayfa(sy);
    try {
      if (tur === "ictihat") {
        const r = await kararAra(soz, { mahkeme: mahkeme || undefined, birim: birim.trim() || undefined, sayfa: sy, kaynak: arsiv ? "arsiv" : undefined }, f);
        if (!r.ok) { setHata(t(r.hata, r.vars)); return; }
        setKararlar(r.kararlar); setToplam(r.toplam);
        if (!r.kararlar.length) setHata(t("Karar bulunamadı. Daha az sözcükle ya da tırnak içinde tam ifadeyle deneyin."));
      } else {
        const r = await mevzuatBul(soz, { tur: mtur || undefined, mulga: mtur === "MULGA", sayfa: sy }, f);
        if (!r.ok) { setHata(t(r.hata, r.vars)); return; }
        setMaddeler(sy === 1 ? r.maddeler : []); setBelgeler(r.belgeler);
        const not = [r.resmiHata ? t(r.resmiHata) : "", r.arsivYok ? t("Kanun arşivi henüz yüklenmedi (yönetim paneli > Mevzuat arşivi).") : ""].filter(Boolean).join(" ");
        if (not) setHata(not);
        else if (!r.maddeler.length && !r.belgeler.length) setHata(t("Sonuç yok. Kanun adını ya da kısaltmasını ve madde numarasını yazın (örn. TBK 49) ya da farklı sözcüklerle deneyin."));
      }
    } finally { setBekle(false); }
  };
  const Dugmeler = ({ k, acKey, url }: { k: HukukKaynak; acKey?: string; url?: string }) => (
    <View style={s.addRow}>
      {acKey && <Pressable onPress={() => setAcik(acik === acKey ? "" : acKey)}><Text style={s.link}>{acik === acKey ? t("Metni kapat") : t("Tam metni aç")}</Text></Pressable>}
      {!!url && <Pressable onPress={() => Linking.openURL(url)}><Text style={s.link}>{t("Resmî sitede aç")}</Text></Pressable>}
      {onEkle && <Btn kind={ekli.includes(k.kunye) ? "secondary" : "primary"} label={ekli.includes(k.kunye) ? t("✓ Beyanda") : t("➕ Beyana ekle")} disabled={ekli.includes(k.kunye)} onPress={() => onEkle(k)} />}
      <Btn kind="ghost" label={t("⭐ Kütüphaneme kaydet")} onPress={() => kaydet(k)} />
    </View>
  );
  return (
    <View style={{ gap: 10 }}>
      <View style={s.addRow}>
        {tur === "ictihat"
          ? <Acilir etiket={t("Mahkeme")} genislik={240} secenekler={MAHKEME_SECENEK.map(x => ({ k: x.k || "_", ad: t(x.ad) }))} secili={mahkeme || "_"} onSec={k => setMahkeme(k === "_" ? "" : k)} />
          : <Acilir etiket={t("Mevzuat türü")} genislik={280} secenekler={MEVZUAT_TURU.map(x => ({ k: x.k || "_", ad: t(x.ad) }))} secili={mtur || "_"} onSec={k => setMtur(k === "_" ? "" : k)} />}
        {tur === "ictihat" && <TextInput value={birim} onChangeText={setBirim} placeholder={t("Daire (isteğe bağlı): 9. Hukuk Dairesi")} placeholderTextColor={C.muted} style={[s.inputTek, { minWidth: 200 }]} />}
      </View>
      <View style={s.addRow}>
        <TextInput value={soz} onChangeText={setSoz} onSubmitEditing={() => ara(1)} returnKeyType="search" style={[s.inputTek, { flex: 1, minWidth: 220 }]} placeholderTextColor={C.muted}
          placeholder={tur === "ictihat" ? t("Örn. \"bilirkişi raporuna itiraz\" ek rapor  ·  kira tespiti +emsal") : t("Örn. HMK 281 · TBK m. 49 · Anayasa 36 · kat mülkiyeti aidat")} />
        <Btn label={bekle ? t("Aranıyor…") : t("🔍 Ara")} disabled={bekle} onPress={() => ara(1)} />
      </View>
      {!!hata && <Text style={s.err}>{hata}</Text>}
      {maddeler.map(m => { const k = maddeKaynak(m); const key = "m" + m.slug + m.madde; return (
        <View key={key} style={[s.file, { flexDirection: "column", alignItems: "stretch", gap: 6 }]}>
          <Text style={s.meta}>{t("Kanun maddesi")}{m.durum !== "yururlukte" ? " · " + t("MÜLGA") : ""}</Text>
          <Text style={[s.body, { color: C.text, fontWeight: "700" }]}>{maddeKunye(m)}{m.baslik ? " – " + m.baslik : ""}</Text>
          <Text selectable style={s.body}>{acik === key ? m.metin : m.metin.slice(0, 600) + (m.metin.length > 600 ? "…" : "")}</Text>
          <Dugmeler k={k} acKey={m.metin.length > 600 ? key : undefined} />
        </View>); })}
      {(belgeler || []).map(b => { const k = belgeKaynak(b); const key = "b" + b.id; return (
        <View key={key} style={[s.file, { flexDirection: "column", alignItems: "stretch", gap: 6 }]}>
          <Text style={s.meta}>{b.tur}{b.rgTarih ? " · RG " + b.rgTarih + (b.rgSayi ? "/" + b.rgSayi : "") : ""}{b.arsiv ? " · " + t("Celse arşivinde") : ""}</Text>
          <Text style={[s.body, { color: C.text, fontWeight: "700" }]}>{belgeKunye(b)}</Text>
          {!!b.bolum && <Text style={s.hint}>{b.bolum}</Text>}
          <Dugmeler k={k} acKey={key} url={b.url} />
          {acik === key && <TamMetin kaynak="mevzuat" id={b.id} meta={b} />}
        </View>); })}
      {(kararlar || []).map(x => { const k = kararKaynak(x); const key = "k" + x.id; return (
        <View key={key} style={[s.file, { flexDirection: "column", alignItems: "stretch", gap: 6 }]}>
          <Text style={s.meta}>{x.mahkeme}{x.kesinlesme ? " · " + x.kesinlesme : ""}</Text>
          <Text style={[s.body, { color: C.text, fontWeight: "700" }]}>{kararKunye(x)}</Text>
          {!!x.bolum && <Text style={s.hint}>{x.bolum}</Text>}
          <Dugmeler k={k} acKey={key} url={x.url} />
          {acik === key && <TamMetin kaynak="karar" id={x.id} meta={x} />}
        </View>); })}
      {((tur === "ictihat" && kararlar && toplam > sayfa * 10) || (tur === "mevzuat" && belgeler && belgeler.length === 10)) && (
        <View style={s.addRow}>
          {sayfa > 1 && <Btn kind="ghost" label={t("‹ Önceki")} disabled={bekle} onPress={() => ara(sayfa - 1)} />}
          <Text style={s.hint}>{t("Sayfa {n}", { n: sayfa })}{tur === "ictihat" ? " · " + t("{n} karar", { n: toplam.toLocaleString("tr-TR") }) : ""}</Text>
          <Btn kind="ghost" label={t("Sonraki ›")} disabled={bekle} onPress={() => ara(sayfa + 1)} />
        </View>
      )}
    </View>
  );
}

/** İçtihat, mevzuat ve doktrin: arama, sonuçlar, kütüphanem, elle ekleme. onEkle verilirse kaynak beyana eklenebilir. */
export function KaynakPaneli({ f, onEkle, ekli = [], konu: varsayilan = "" }: { f?: Foy | null; onEkle?: (k: HukukKaynak) => void; ekli?: string[]; konu?: string }) {
  const [tur, setTur] = useState<HukukKaynak["tur"]>("ictihat");
  const [yol, setYol] = useState<"resmi" | "arsiv" | "yz">("resmi");
  const [konu, setKonu] = useState(varsayilan);
  const [bekle, setBekle] = useState(false);
  const [hata, setHata] = useState("");
  const [sonuc, setSonuc] = useState<{ kaynaklar: HukukKaynak[]; genel: string } | null>(null);
  const [kut, setKut] = useState<HukukKaynak[]>([]);
  const [elle, setElle] = useState<{ kunye: string; ozet: string; alinti: string; url: string } | null>(null);
  useEffect(() => { kutuphane().then(setKut).catch(() => {}); }, []);
  const ara = async () => {
    if (konu.trim().length < 3) { setHata(t("Aranacak konuyu yazın (örn. bilirkişi raporuna itiraz süresi).")); return; }
    setBekle(true); setHata(""); setSonuc(null);
    try {
      const r = await kaynakBul(tur, konu, f);
      if (!r.ok) setHata(t(r.hata, r.vars));
      else { setSonuc({ kaynaklar: r.kaynaklar, genel: r.genel }); if (!r.kaynaklar.length && !r.genel) setHata(t("Resmî sitelerde bu konuda kaynak bulunamadı. Konuyu farklı sözcüklerle yazıp yeniden deneyin.")); }
    } finally { setBekle(false); }
  };
  const kaydet = async (k: HukukKaynak) => setKut(await kutuphaneyeEkle(k));
  const genelKaynak = (g: string): HukukKaynak => ({ id: yeniId("k"), tur: "doktrin", kunye: t("Doktrindeki görüşler (genel)"), ozet: g, kaynak: "genel", tarih: new Date().toISOString() });
  const kutTur = kut.filter(k => k.tur === tur);
  return (
    <View style={{ gap: 10 }}>
      <Text style={s.hint}>{t("Kararlar Adalet Bakanlığı'nın emsal karar servisinden (Yargıtay, Danıştay, bölge adliye, ilk derece, kanun yararına bozma) tam metniyle gelir. Kanunlar (yürürlükteki ve mülga) madde madde Celse arşivinden; KHK, Cumhurbaşkanlığı kararnamesi, yönetmelik, tüzük, genelge ve tebliğ resmî mevzuat servisinden aranır. Doktrin ve yapay zekâ araması DergiPark gibi açık erişimli sitelerde yapılır; künyeyi beyana koymadan önce kaynağı açıp kontrol edin.")}</Text>
      <View style={s.addRow}>
        <Acilir etiket={t("Ne arıyorsunuz")} secenekler={(["ictihat", "mevzuat", "doktrin"] as const).map(k => ({ k, ad: t(TUR_AD[k]), n: kut.filter(x => x.tur === k).length || undefined }))} secili={tur} onSec={k => { setTur(k as HukukKaynak["tur"]); setSonuc(null); setHata(""); }} />
        {tur !== "doktrin" && <Acilir etiket={t("Nereden")} genislik={260} secenekler={[{ k: "resmi", ad: tur === "ictihat" ? t("Resmî karar arama (UYAP emsal, canlı)") : t("Kanun arşivi ve resmî mevzuat") }, ...(tur === "ictihat" ? [{ k: "arsiv", ad: t("Celse içtihat arşivi") }] : []), { k: "yz", ad: t("Yapay zekâ ile ara") }]} secili={tur === "mevzuat" && yol === "arsiv" ? "resmi" : yol} onSec={k => { setYol(k as "resmi" | "arsiv" | "yz"); setHata(""); }} />}
      </View>
      {tur !== "doktrin" && yol !== "yz" && <ResmiArama key={tur + yol} arsiv={tur === "ictihat" && yol === "arsiv"} tur={tur} f={f} onEkle={onEkle} ekli={ekli} kaydet={kaydet} ilkSoz={varsayilan.replace(/(larımızın|lerimizin|imizin|ımızın)\s+sunulmasıdır\.?$/, "").replace(/\.$/, "")} />}
      {(tur === "doktrin" || yol === "yz") && <View style={s.addRow}>
        <TextInput value={konu} onChangeText={setKonu} onSubmitEditing={ara} placeholder={t("Konu: örn. kusur oranına itiraz, ıslah zamanaşımı")} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1, minWidth: 220 }]} returnKeyType="search" />
        <Btn label={bekle ? t("Aranıyor…") : t("🔍 Ara")} onPress={ara} disabled={bekle} />
      </View>}
      {!!hata && <Text style={s.err}>{hata}</Text>}
      {sonuc?.kaynaklar.map(k => <KaynakKart key={k.id} k={k} eklendi={ekli.includes(k.kunye)} onEkle={onEkle ? () => onEkle(k) : undefined} onKaydet={() => kaydet(k)} />)}
      {!!sonuc?.genel && <KaynakKart k={genelKaynak(sonuc.genel)} onEkle={onEkle ? () => onEkle(genelKaynak(sonuc.genel)) : undefined} onKaydet={() => kaydet(genelKaynak(sonuc.genel))} />}
      <Text style={s.secT}>{t("Kütüphanem")} · {t(TUR_AD[tur])} ({kutTur.length})</Text>
      {!kutTur.length && <Text style={s.hint}>{t("Kaydettiğiniz kaynaklar burada durur ve sonraki beyanlarda kullanılır.")}</Text>}
      {kutTur.slice(0, 30).map(k => <KaynakKart key={k.id} k={k} eklendi={ekli.includes(k.kunye)} onEkle={onEkle ? () => onEkle(k) : undefined} onSil={async () => setKut(await kutuphanedenSil(k.id))} />)}
      {!elle && <Btn kind="ghost" label={t("✚ Kendim ekleyeyim ({tur})", { tur: t(TUR_AD[tur]) })} onPress={() => setElle({ kunye: "", ozet: "", alinti: "", url: "" })} />}
      {elle && (
        <View style={[s.file, { flexDirection: "column", alignItems: "stretch", gap: 8 }]}>
          <TextInput value={elle.kunye} onChangeText={x => setElle({ ...elle, kunye: x })} placeholder={tur === "ictihat" ? t("Künye: Yargıtay 9. HD, 2023/1234 E., 2024/567 K., 12.03.2024") : tur === "mevzuat" ? t("Künye: 6100 sayılı HMK m. 281") : t("Künye: Yazar, Eser / Makale, Yayın, Yıl, s. 45")} placeholderTextColor={C.muted} style={s.inputTek} />
          <TextInput value={elle.ozet} onChangeText={x => setElle({ ...elle, ozet: x })} placeholder={t("Özet: ilgili ilke ya da görüş")} placeholderTextColor={C.muted} style={s.input} multiline />
          <TextInput value={elle.alinti} onChangeText={x => setElle({ ...elle, alinti: x })} placeholder={t("Alıntı (isteğe bağlı, kısa)")} placeholderTextColor={C.muted} style={s.inputTek} />
          <TextInput value={elle.url} onChangeText={x => setElle({ ...elle, url: x })} placeholder={t("Bağlantı (isteğe bağlı)")} placeholderTextColor={C.muted} style={s.inputTek} autoCapitalize="none" />
          <View style={s.addRow}>
            <Btn label={t("Kaydet")} disabled={!elle.kunye.trim()} onPress={async () => {
              const k: HukukKaynak = { id: yeniId("k"), tur, kunye: elle.kunye.trim(), ozet: elle.ozet.trim(), alinti: elle.alinti.trim() || undefined, url: elle.url.trim() || undefined, kaynak: "elle", tarih: new Date().toISOString() };
              await kaydet(k); if (onEkle) onEkle(k); setElle(null);
            }} />
            <Btn kind="ghost" label={t("Vazgeç")} onPress={() => setElle(null)} />
          </View>
        </View>
      )}
    </View>
  );
}

/** Bir föyün beyan editörü. onDegistir föyün değişen alanlarını kaydeder (beyanlar). */
export function BeyanEditoru({ f, onDegistir }: { f: Foy; onDegistir: (ek: Partial<Foy>) => void }) {
  const [beyanlar, setBeyanlar] = useState<Beyan[]>(f.beyanlar || []);
  const [b, setB] = useState<Beyan>(() => (f.beyanlar || [])[0] || bosBeyan());
  const [talimat, setTalimat] = useState("");
  const [bekle, setBekle] = useState(false);
  const [hata, setHata] = useState("");
  const [vekil, setVekil] = useState("");
  const [bicim, setBicim] = useState("udf");
  const [ornekSecim, setOrnekSecim] = useState("otomatik");
  const [orn, setOrn] = useState<DilekceOrnegi[]>([]);
  const [kullanilan, setKullanilan] = useState<number | null>(null);
  useEffect(() => { ornekler().then(setOrn).catch(() => {}); }, [b.tur, bekle]);
  const zaman = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { ayarOku<string>("beyanVekil").then(v => v && setVekil(v)); ayarOku<string>("beyanBicim").then(v => v && setBicim(v)); }, []);
  // Değişiklik bir saniye sonra föye kaydedilir (yalnız metni olan taslaklar).
  const sakla = (y: Beyan) => {
    setB(y);
    if (zaman.current) clearTimeout(zaman.current);
    zaman.current = setTimeout(() => {
      if (!y.metin.trim()) return;
      const g = { ...y, guncelleme: new Date().toISOString() };
      const xs = [g, ...beyanlar.filter(x => x.id !== g.id)].slice(0, 50);
      setBeyanlar(xs); onDegistir({ beyanlar: xs });
    }, 1000);
  };
  useEffect(() => () => { if (zaman.current) clearTimeout(zaman.current); }, []);
  const cerceve = useMemo(() => beyanCercevesi(f, b, { vekil }), [f, b, vekil]);

  const yaz = async (duzelt: boolean) => {
    setBekle(true); setHata("");
    try {
      const r = await beyanYazdir(f, b, talimat, duzelt, ornekSecim);
      if (!r.ok) { setHata(t(r.hata, r.vars)); return; }
      setKullanilan(r.ornekSayisi);
      sakla({ ...b, metin: r.metin, talimat });
      setTalimat("");
    } finally { setBekle(false); }
  };
  const disari = async () => {
    const metin = tamMetin(f, b, { vekil });
    const cb = ciktiBicimi(f, b, { vekil });
    ayarYaz("beyanBicim", bicim).catch(() => {});
    if (!web) { await Share.share({ message: metin, title: b.tur }); return; }
    if (bicim === "udf") indir(beyanDosyaAdi(f, b, "udf"), new Blob([udfOlustur(metin, cb.imza, cb.ortaBaslik) as BlobPart], { type: "application/octet-stream" }));
    else if (bicim === "docx") indir(beyanDosyaAdi(f, b, "docx"), new Blob([docxOlustur(metin, cb.imza, cb.ortaBaslik) as BlobPart], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
    else {
      const w = window.open("", "_blank");
      if (!w) { setHata(t("Yazdırma penceresi açılamadı; tarayıcının açılır pencere engelini kaldırın.")); return; }
      w.document.write(beyanHtml(metin, beyanDosyaAdi(f, b, "pdf").replace(/\.pdf$/, ""), cb.imza, cb.ortaBaslik)); w.document.close();
      setTimeout(() => { w.focus(); w.print(); }, 400);
    }
  };
  const kaynakEkle = (k: HukukKaynak) => { if (!(b.kaynaklar || []).some(x => x.kunye === k.kunye)) sakla({ ...b, kaynaklar: [...(b.kaynaklar || []), k] }); };

  return (
    <View style={{ gap: 10 }}>
      <Text style={s.hint}>{t("Klasörü ve belge türünü seçin (dilekçe, sözleşme, arabuluculuk, uzlaştırma, komisyon, Anayasa Mahkemesi, AİHM, ihtarname, bilirkişi raporu…), ne yazılmasını istediğinizi yazın ya da söyleyin. Gövdeyi yapay zekâ föydeki künye, işler, notlar ve önemli evraktan yazar (adlar ve numaralar kodlanarak gider); başlık ve imza föyden eklenir. Aşağıdaki kaynaklardan eklediklerinizi beyanda anar. Göndermeden önce mutlaka okuyup düzeltin.")}</Text>
      <View style={s.addRow}>
        <Acilir etiket={t("Taslak")} genislik={220} secenekler={[{ k: "_yeni", ad: t("✚ Yeni beyan") }, ...beyanlar.map(x => ({ k: x.id, ad: `${x.tur} · ${new Date(x.guncelleme).toLocaleDateString("tr-TR")}` }))]}
          secili={beyanlar.some(x => x.id === b.id) ? b.id : "_yeni"} onSec={k => { setHata(""); setB(k === "_yeni" ? bosBeyan(b.tur) : beyanlar.find(x => x.id === k) || bosBeyan()); }} />
        <Acilir etiket={t("Klasör")} genislik={240} secenekler={BEYAN_KLASORLERI.map(k => ({ k: k.ad, ad: t(k.ad), n: k.turler.length }))} secili={beyanTuru(b.tur).klasor}
          onSec={k => { const x = BEYAN_KLASORLERI.find(y => y.ad === k)!.turler[0].ad; sakla({ ...b, tur: x, konu: !b.konu || b.konu === konuOner(b.tur) ? konuOner(x) : b.konu }); }} />
        <Acilir etiket={t("Belge türü")} genislik={300} secenekler={(BEYAN_KLASORLERI.find(k => k.ad === beyanTuru(b.tur).klasor)?.turler || []).map(x => ({ k: x.ad, ad: t(x.ad) }))} secili={beyanTuru(b.tur).ad} onSec={k => sakla({ ...b, tur: k, konu: !b.konu || b.konu === konuOner(b.tur) ? konuOner(k) : b.konu })} />
      </View>
      {!!orn.length && (
        <Acilir etiket={t("Örnek dilekçem")} genislik={360} secili={ornekSecim} onSec={setOrnekSecim}
          secenekler={[{ k: "otomatik", ad: t("Otomatik: aynı türdeki örneklerim") + " (" + ornekSec(orn, b.tur).length + ")" }, { k: "yok", ad: t("Örnek kullanma") },
            ...orn.filter(x => x.klasor === beyanTuru(b.tur).klasor).slice(0, 40).map(x => ({ k: x.id, ad: (x.tur ? x.tur + " · " : "") + x.ad }))]} />
      )}
      <Text style={s.label}>{t("Konu")}</Text>
      <TextInput value={b.konu} onChangeText={x => sakla({ ...b, konu: x })} placeholder={t("Konu satırı")} placeholderTextColor={C.muted} style={s.inputTek} />
      <Text style={s.label}>{b.metin ? t("Düzeltme talimatı") : t("Talimat")}</Text>
      <TextInput value={talimat} onChangeText={setTalimat} multiline style={[s.input, { minHeight: 70 }]} placeholderTextColor={C.muted}
        placeholder={b.metin ? t("Örn. ikinci maddeyi kısalt, kusur oranına itirazı güçlendir, ek rapor talebini ekle") : t(TALIMAT_ORNEK[beyanTuru(b.tur).cerceve])} />
      <View style={s.addRow}>
        <Dikte onMetin={x => (x ? setTalimat(y => (y ? y + " " : "") + x) : setHata(t(izinYokMetni())))} />
        {!b.metin && <Btn label={bekle ? t("Yazılıyor… (bir dakika kadar)") : t("✍ Taslak yaz")} disabled={bekle} onPress={() => yaz(false)} />}
        {!!b.metin && <Btn label={bekle ? t("Düzeltiliyor…") : t("✍ Talimata göre düzelt")} disabled={bekle || !talimat.trim()} onPress={() => yaz(true)} />}
        {!!b.metin && <Btn kind="ghost" label={t("Baştan yaz")} disabled={bekle} onPress={() => yaz(false)} />}
      </View>
      {!!hata && <Text style={s.err}>{hata}</Text>}
      {kullanilan !== null && !bekle && <Text style={s.hint}>{kullanilan ? t("Üslup için {n} örnek dilekçenizden yararlanıldı.", { n: kullanilan }) : t("Bu türde örnek dilekçeniz yok; genel üslupla yazıldı.")}</Text>}
      {!!(b.kaynaklar || []).length && (
        <View style={{ gap: 6 }}>
          <Text style={s.label}>{t("Beyanda anılacak kaynaklar")}</Text>
          {(b.kaynaklar || []).map(k => (
            <View key={k.id} style={[s.row, { gap: 6 }]}>
              <Text style={[s.hint, { flex: 1 }]}>{t(TUR_AD[k.tur])}: {atif(k).slice(0, 220)}</Text>
              <Pressable onPress={() => sakla({ ...b, kaynaklar: (b.kaynaklar || []).filter(x => x.id !== k.id) })}><Text style={s.sil}>{t("Çıkar")}</Text></Pressable>
            </View>
          ))}
          {!!b.metin && <Text style={s.hint}>{t("Yeni eklediğiniz kaynakların gövdeye girmesi için “Talimata göre düzelt” deyin (örn. eklenen kararları ilgili yere koy).")}</Text>}
        </View>
      )}
      <Text style={s.label}>{t("Beyan")}</Text>
      <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 8, backgroundColor: "#fbfaf6", padding: 12, gap: 0 }}>
        <Text style={{ color: "#333", fontFamily: Platform.OS === "web" ? "'Times New Roman', serif" : undefined, fontSize: 13 }}>{cerceve.ust.join("\n")}</Text>
        <TextInput value={b.metin} onChangeText={x => sakla({ ...b, metin: x })} multiline placeholder={t("Gövde burada görünecek; doğrudan da yazabilirsiniz.")} placeholderTextColor="#999"
          style={{ minHeight: 360, color: "#111", fontSize: 15, lineHeight: 22, fontFamily: Platform.OS === "web" ? "'Times New Roman', serif" : undefined, textAlignVertical: "top", padding: 0 }} />
        <Text style={{ color: "#333", textAlign: "right", fontSize: 13, fontFamily: Platform.OS === "web" ? "'Times New Roman', serif" : undefined }}>{cerceve.alt.join("\n")}</Text>
      </View>
      <View style={s.addRow}>
        <TextInput value={vekil} onChangeText={x => { setVekil(x); ayarYaz("beyanVekil", x); }} placeholder={t("Vekil adı soyadı (imzada)")} placeholderTextColor={C.muted} style={[s.inputTek, { minWidth: 220 }]} />
        {web && <Acilir etiket={t("Biçim")} secenekler={BICIMLER.map(x => ({ k: x.k, ad: t(x.ad) }))} secili={bicim} onSec={setBicim} />}
        <Btn label={web ? t("⬇ İndir") : t("Paylaş")} disabled={!b.metin.trim()} onPress={disari} />
        {!!b.metin && beyanlar.some(x => x.id === b.id) && <Pressable onPress={() => { const xs = beyanlar.filter(x => x.id !== b.id); setBeyanlar(xs); onDegistir({ beyanlar: xs, silinen: [...(f.silinen || []), b.id].slice(-300) }); setB(bosBeyan(b.tur)); }}><Text style={s.sil}>{t("Taslağı sil")}</Text></Pressable>}
      </View>
      {web && bicim === "udf" && <Text style={s.hint}>{t("UDF dosyasını UYAP Doküman Editörü'nde açıp kontrol edin, sonra imzalayıp gönderin.")}</Text>}
      <Katlanir anahtar="kaynak-ic" baslik={t("📚 İçtihat, mevzuat ve doktrin")} ozet={t("ara, beyana ekle, kütüphaneye kaydet")}>
        <KaynakPaneli f={f} onEkle={kaynakEkle} ekli={(b.kaynaklar || []).map(x => x.kunye)} konu={b.konu} />
      </Katlanir>
    </View>
  );
}

/** Dava takibi > Beyan editörü sekmesi: föy seçilir, o föyün editörü açılır. */
const FOYSUZ = "foysuzBeyan";
/** Dava takibi > Beyan editörü sekmesi: föy seçmeden yazılabilir (başlık bilgileri elle) ya da bir föy seçilir. */
export function BeyanSekmesi({ liste }: { liste: Foy[] }) {
  const sirali = [...liste].sort((a, b) => (a.durum === b.durum ? (b.guncelleme || "").localeCompare(a.guncelleme || "") : a.durum === "acik" ? -1 : 1));
  const [id, setId] = useState<string>("_foysuz");
  const [serbest, setSerbest] = useState<Foy | null>(null);
  useEffect(() => { ayarOku<Foy>(FOYSUZ).then(x => setSerbest(x || bosFoy({ id: "foysuz", muvekkil: "", karsiTaraf: "", mahkeme: "", esasNo: "" }))).catch(() => setSerbest(bosFoy({ id: "foysuz" }))); }, []);
  const serbestKaydet = (ek: Partial<Foy>) => setSerbest(x => { const y = { ...(x as Foy), ...ek }; ayarYaz(FOYSUZ, y).catch(() => {}); return y; });
  const f = id === "_foysuz" ? serbest : liste.find(x => x.id === id);
  const etiket = (x: Foy) => [turBilgi(x.tur).kisa, x.muvekkil || x.karsiTaraf || t("adsız"), x.mahkeme, x.esasNo].filter(Boolean).join(" · ") + (x.ozel ? " 🔒" : "") + (x.durum === "kapali" ? " (" + t("kapalı") + ")" : "");
  return (
    <ScrollView keyboardShouldPersistTaps="handled"><View style={s.wrap}>
      <Text style={s.eyebrow}>{t("DAVA TAKİBİ · BEYAN EDİTÖRÜ")}</Text>
      <Text style={s.title}>{t("Beyan editörü")}</Text>
      <Acilir etiket={t("Dosya (isteğe bağlı)")} genislik={360} secili={id} onSec={setId}
        secenekler={[{ k: "_foysuz", ad: t("✎ Föy seçmeden yaz") }, ...sirali.map(x => ({ k: x.id, ad: etiket(x) }))]} />
      {id === "_foysuz" && serbest && (
        <View style={[s.card, { gap: 8 }]}>
          <Text style={s.hint}>{t("Föy seçmeden yazıyorsunuz: başlıktaki bilgileri buraya yazın (boş bırakılanlar “…” olur). Yapay zekâ yalnız talimatınızla ve eklediğiniz kaynaklarla yazar. Taslaklar bu bilgisayarda saklanır.")}</Text>
          <View style={s.addRow}>
            <TextInput value={serbest.mahkeme} onChangeText={x => serbestKaydet({ mahkeme: x })} placeholder={t("Merci (örn. İzmir 3. Asliye Hukuk Mahkemesi)")} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 2, minWidth: 220 }]} />
            <TextInput value={serbest.esasNo} onChangeText={x => serbestKaydet({ esasNo: x })} placeholder={t("Dosya no")} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1, minWidth: 120 }]} />
          </View>
          <View style={s.addRow}>
            <TextInput value={serbest.muvekkil} onChangeText={x => serbestKaydet({ muvekkil: x })} placeholder={t("Müvekkil")} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1, minWidth: 180 }]} />
            <TextInput value={serbest.karsiTaraf} onChangeText={x => serbestKaydet({ karsiTaraf: x })} placeholder={t("Karşı taraf")} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1, minWidth: 180 }]} />
            <Acilir etiket={t("Bizim taraf")} genislik={180} secili={serbest.taraf === "davali" ? "davali" : "davaci"} onSec={k => serbestKaydet({ taraf: k as Foy["taraf"] })}
              secenekler={[{ k: "davaci", ad: t("Davacı / başvuran") }, { k: "davali", ad: t("Davalı / sanık") }]} />
          </View>
        </View>
      )}
      <Katlanir anahtar="dilekce-ornek" baslik={t("📝 Dilekçe örneklerim")} ozet={t("kendi dilekçelerinizi ekleyin; beyanlar sizin üslubunuzla yazılsın")}>
        <DilekceOrnekleri />
      </Katlanir>
      {f && <View style={s.card}><BeyanEditoru key={f.id} f={f} onDegistir={ek => (f.id === "foysuz" ? serbestKaydet(ek) : foyKaydet({ ...f, ...ek }))} /></View>}
    </View></ScrollView>
  );
}

/** Dava takibi > İçtihat, mevzuat ve doktrin sekmesi: arama ve kütüphane (föyden bağımsız). */
export function KaynakSekmesi() {
  return (
    <ScrollView keyboardShouldPersistTaps="handled"><View style={s.wrap}>
      <Text style={s.eyebrow}>{t("DAVA TAKİBİ · KAYNAKLAR")}</Text>
      <Text style={s.title}>{t("İçtihat, mevzuat ve doktrin")}</Text>
      <View style={s.card}><KaynakPaneli /></View>
    </View></ScrollView>
  );
}
