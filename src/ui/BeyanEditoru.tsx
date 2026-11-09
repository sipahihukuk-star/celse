// Beyan editörü (föyün içinde ve Dava takibi > Beyan editörü sekmesinde) ve altında İçtihat, mevzuat ve doktrin paneli.
// Avukat beyan türünü ve talimatını yazar ya da söyler; yapay zekâ föyden gövdeyi yazar (beyanCagri). Başlık (merci, dosya no,
// taraflar, vekil, konu) ve imza cihazda föyden eklenir. Taslaklar föyde saklanır; çıktı avukatın seçtiği biçimde (UDF, Word, PDF).
// Kaynak paneli resmî sitelerde içtihat / mevzuat, DergiPark gibi açık erişimli sitelerde doktrin arar; avukat elle de ekler.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { atif, Beyan, BEYAN_TURLERI, beyanCercevesi, beyanDosyaAdi, beyanHtml, docxOlustur, HukukKaynak, tamMetin, udfOlustur } from "../data/beyan";
import { ayarOku, ayarYaz, Foy, foyKaydet, yeniId } from "../data/foy";
import { kutuphane, kutuphanedenSil, kutuphaneyeEkle } from "../data/hukukKutuphane";
import { t } from "../i18n";
import { Acilir } from "./Acilir";
import { beyanYazdir, kaynakBul } from "./beyanCagri";
import { indir, s } from "./foyStil";
import { Katlanir } from "./Katlanir";
import { Btn } from "./kit";
import { izinYokMetni, tanimaIzni, tanimaSinifi } from "./konusmaTanima";
import { C } from "./theme";

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const BICIMLER = [{ k: "udf", ad: "UYAP (UDF)" }, { k: "docx", ad: "Word (.docx)" }, { k: "pdf", ad: "PDF (yazdır)" }];
const TUR_AD: Record<HukukKaynak["tur"], string> = { ictihat: "İçtihat", mevzuat: "Mevzuat", doktrin: "Doktrin" };
const web = Platform.OS === "web";
const bosBeyan = (tur = BEYAN_TURLERI[0]): Beyan => { const n = new Date().toISOString(); return { id: yeniId("by"), olusturma: n, guncelleme: n, tur, konu: konuOner(tur), metin: "", kaynaklar: [] }; };
function konuOner(tur: string): string {
  const k: Record<string, string> = {
    "Bilirkişi raporuna itiraz": "Bilirkişi raporuna itirazlarımızın sunulmasıdır.", "Cevaba cevap (replik)": "Cevap dilekçesine karşı cevaplarımızın sunulmasıdır.",
    "İkinci cevap (düplik)": "Cevaba cevap dilekçesine karşı beyanlarımızın sunulmasıdır.", "Delil listesi ve tanık bildirimi": "Delillerimizin ve tanıklarımızın bildirilmesidir.",
    "Islah dilekçesi": "Islah talebimizin sunulmasıdır.", "İstinaf dilekçesi": "Kararın kaldırılması istemiyle istinaf sebeplerimizin sunulmasıdır.",
    "Temyiz dilekçesi": "Kararın bozulması istemiyle temyiz sebeplerimizin sunulmasıdır.", "Mazeret dilekçesi": "Mazeretimizin bildirilmesi ve duruşmanın ertelenmesi talebidir.",
    "Ara karara karşı beyan": "Ara karara ilişkin beyanlarımızın sunulmasıdır.", "Beyan dilekçesi": "Beyanlarımızın sunulmasıdır."
  };
  return k[tur] || "";
}

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

/** İçtihat, mevzuat ve doktrin: arama, sonuçlar, kütüphanem, elle ekleme. onEkle verilirse kaynak beyana eklenebilir. */
export function KaynakPaneli({ f, onEkle, ekli = [], konu: varsayilan = "" }: { f?: Foy | null; onEkle?: (k: HukukKaynak) => void; ekli?: string[]; konu?: string }) {
  const [tur, setTur] = useState<HukukKaynak["tur"]>("ictihat");
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
      <Text style={s.hint}>{t("İçtihat Yargıtay, Danıştay, Anayasa Mahkemesi, UYAP emsal ve AİHM sitelerinde; mevzuat mevzuat.gov.tr ve Resmî Gazete'de; doktrin DergiPark gibi açık erişimli sitelerde aranır. Yalnız aramada gerçekten bulunan kaynaklar gösterilir; künyeyi beyana koymadan önce kaynağı açıp kontrol edin.")}</Text>
      <View style={s.addRow}>
        <Acilir etiket={t("Ne arıyorsunuz")} secenekler={(["ictihat", "mevzuat", "doktrin"] as const).map(k => ({ k, ad: t(TUR_AD[k]), n: kut.filter(x => x.tur === k).length || undefined }))} secili={tur} onSec={k => { setTur(k as HukukKaynak["tur"]); setSonuc(null); }} />
        <TextInput value={konu} onChangeText={setKonu} onSubmitEditing={ara} placeholder={t("Konu: örn. kusur oranına itiraz, ıslah zamanaşımı")} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1, minWidth: 220 }]} returnKeyType="search" />
        <Btn label={bekle ? t("Aranıyor…") : t("🔍 Ara")} onPress={ara} disabled={bekle} />
      </View>
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
      const r = await beyanYazdir(f, b, talimat, duzelt);
      if (!r.ok) { setHata(t(r.hata, r.vars)); return; }
      sakla({ ...b, metin: r.metin, talimat });
      setTalimat("");
    } finally { setBekle(false); }
  };
  const disari = async () => {
    const metin = tamMetin(f, b, { vekil });
    ayarYaz("beyanBicim", bicim).catch(() => {});
    if (!web) { await Share.share({ message: metin, title: b.tur }); return; }
    if (bicim === "udf") indir(beyanDosyaAdi(f, b, "udf"), new Blob([udfOlustur(metin) as BlobPart], { type: "application/octet-stream" }));
    else if (bicim === "docx") indir(beyanDosyaAdi(f, b, "docx"), new Blob([docxOlustur(metin) as BlobPart], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
    else {
      const w = window.open("", "_blank");
      if (!w) { setHata(t("Yazdırma penceresi açılamadı; tarayıcının açılır pencere engelini kaldırın.")); return; }
      w.document.write(beyanHtml(metin, beyanDosyaAdi(f, b, "pdf").replace(/\.pdf$/, ""))); w.document.close();
      setTimeout(() => { w.focus(); w.print(); }, 400);
    }
  };
  const kaynakEkle = (k: HukukKaynak) => { if (!(b.kaynaklar || []).some(x => x.kunye === k.kunye)) sakla({ ...b, kaynaklar: [...(b.kaynaklar || []), k] }); };

  return (
    <View style={{ gap: 10 }}>
      <Text style={s.hint}>{t("Beyan türünü seçin, ne yazılmasını istediğinizi yazın ya da söyleyin. Gövdeyi yapay zekâ föydeki künye, işler, notlar ve önemli evraktan yazar (adlar ve numaralar kodlanarak gider); başlık ve imza föyden eklenir. Aşağıdaki kaynaklardan eklediklerinizi beyanda anar. Göndermeden önce mutlaka okuyup düzeltin.")}</Text>
      <View style={s.addRow}>
        <Acilir etiket={t("Taslak")} genislik={220} secenekler={[{ k: "_yeni", ad: t("✚ Yeni beyan") }, ...beyanlar.map(x => ({ k: x.id, ad: `${x.tur} · ${new Date(x.guncelleme).toLocaleDateString("tr-TR")}` }))]}
          secili={beyanlar.some(x => x.id === b.id) ? b.id : "_yeni"} onSec={k => { setHata(""); setB(k === "_yeni" ? bosBeyan(b.tur) : beyanlar.find(x => x.id === k) || bosBeyan()); }} />
        <Acilir etiket={t("Beyan türü")} genislik={240} secenekler={BEYAN_TURLERI.map(x => ({ k: x, ad: t(x) }))} secili={b.tur} onSec={k => sakla({ ...b, tur: k, konu: !b.konu || b.konu === konuOner(b.tur) ? konuOner(k) : b.konu })} />
      </View>
      <Text style={s.label}>{t("Konu")}</Text>
      <TextInput value={b.konu} onChangeText={x => sakla({ ...b, konu: x })} placeholder={t("Konu satırı")} placeholderTextColor={C.muted} style={s.inputTek} />
      <Text style={s.label}>{b.metin ? t("Düzeltme talimatı") : t("Talimat")}</Text>
      <TextInput value={talimat} onChangeText={setTalimat} multiline style={[s.input, { minHeight: 70 }]} placeholderTextColor={C.muted}
        placeholder={b.metin ? t("Örn. ikinci maddeyi kısalt, kusur oranına itirazı güçlendir, ek rapor talebini ekle") : t("Örn. bilirkişinin kusur oranını %50 vermesine itiraz et; kavşakta geçiş hakkının bizde olduğunu, tanık beyanlarını ve kamera kaydını vurgula; yeni heyet iste")} />
      <View style={s.addRow}>
        <Dikte onMetin={x => (x ? setTalimat(y => (y ? y + " " : "") + x) : setHata(t(izinYokMetni())))} />
        {!b.metin && <Btn label={bekle ? t("Yazılıyor… (bir dakika kadar)") : t("✍ Taslak yaz")} disabled={bekle} onPress={() => yaz(false)} />}
        {!!b.metin && <Btn label={bekle ? t("Düzeltiliyor…") : t("✍ Talimata göre düzelt")} disabled={bekle || !talimat.trim()} onPress={() => yaz(true)} />}
        {!!b.metin && <Btn kind="ghost" label={t("Baştan yaz")} disabled={bekle} onPress={() => yaz(false)} />}
      </View>
      {!!hata && <Text style={s.err}>{hata}</Text>}
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
export function BeyanSekmesi({ liste }: { liste: Foy[] }) {
  const acik = liste.filter(x => !x.ozel).sort((a, b) => (a.durum === b.durum ? (b.guncelleme || "").localeCompare(a.guncelleme || "") : a.durum === "acik" ? -1 : 1));
  const [id, setId] = useState<string>(acik[0]?.id || "");
  const f = liste.find(x => x.id === id);
  return (
    <ScrollView keyboardShouldPersistTaps="handled"><View style={s.wrap}>
      <Text style={s.eyebrow}>{t("DAVA TAKİBİ · BEYAN EDİTÖRÜ")}</Text>
      <Text style={s.title}>{t("Beyan editörü")}</Text>
      {!acik.length && <Text style={s.body}>{t("Önce bir föy ekleyin; beyan föydeki bilgilerle yazılır.")}</Text>}
      {!!acik.length && <Acilir etiket={t("Dosya")} genislik={320} secenekler={acik.map(x => ({ k: x.id, ad: [x.muvekkil || x.karsiTaraf || t("adsız"), x.mahkeme, x.esasNo].filter(Boolean).join(" · ") + (x.durum === "kapali" ? " (" + t("kapalı") + ")" : "") }))} secili={id} onSec={setId} />}
      {f && <View style={s.card}><BeyanEditoru key={f.id} f={f} onDegistir={ek => foyKaydet({ ...f, ...ek })} /></View>}
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
