// Föy sayfasında icra takibi hazırlığı: UYAP'ta takip açmak için gereken bütün bilgi ve takip talebi özeti.
// Alacaklı ve borçlu bilgileri föyün künyesinden gelir (müvekkil = alacaklı, karşı taraf = borçlu); burada takip yolu,
// dayanak belge, alacak kalemleri, faiz ve talep doldurulur. Hesap cihazda yapılır.
import React, { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Foy, FoyEvrak, TarafKisi, tarihCoz } from "../data/foy";
import { Kalem, KALEM_ADLARI, kalemleri, MAHIYETLER, FAIZ_TURLERI, FaizTuru, IcraBilgi, icraEksikler, icraHesapla, Masraf, ParaBirimi, TAKIP_YOLLARI, TakipYolu, tl, turAdi } from "../data/icra";
import { t } from "../i18n";
import { useAccount } from "../data/account";
import { uyapXml, vekilEksik } from "../data/icraXml";
import { Acilir } from "./Acilir";
import { IcraHazirla } from "./IcraHazirla";
import { IcraSohbet } from "./IcraSohbet";
import { IcraOrnekleri } from "./IcraOrnekleri";
import { dilekceYazari, evrakTuruBul, hukumAnaliz, hukumBolumu, ilamdanTaraflar, ilamTaraflari, Lehine, Talep, talepAnaliz } from "../data/icraEvrak";
import { bizimVekil, hukumIskeleti, taraflarIskeleti } from "../data/kunyeCikar";
import { FaizDurumu, useFaizOranlari } from "../data/faizOran";
import { BRUT_TURLER, brutNet, BrutTur, brutTurTahmin, GV_ORANLARI } from "../data/brutNet";
import { indir, s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";

const sayi = (v: string): number | undefined => { const x = v.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, ""); return x ? Number(x) : undefined; };
const sayiYaz = (x?: number) => (x === undefined ? "" : String(x).replace(".", ","));
const tarihYaz = (x?: string) => (x ? x.split("-").reverse().join(".") : "");

const birGunOnce = (x: string) => new Date(Date.parse(x + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
const adSade = (x?: string) => (x || "").toLocaleUpperCase("tr").replace(/[^A-ZÇĞİÖŞÜ0-9 ]/g, " ").replace(/\s+/g, " ").trim();
export function IcraBolum({ f, degistir, surum, onEvraktan, onEvrakEkle, onEvrakSil, onKaydet, onMetinEkle, bizimAdlar = [], okuma, guncel, yenile, hata, ornekYok }: { ornekYok?: boolean; f: Foy; degistir: (ek: Partial<Foy>) => void; surum: number; guncel?: () => Foy; yenile?: () => void; hata?: string; onEvraktan?: () => void; onEvrakEkle?: () => void; onEvrakSil?: (e: FoyEvrak) => void; onKaydet?: () => Promise<void>; onMetinEkle?: (metin: string) => Promise<void>; bizimAdlar?: string[]; okuma?: string }) {
  const b: IcraBilgi = f.icra || { yol: "genel", talep: "haciz", paraBirimi: "TL", faizTuru: "yasal" };
  const [bilgi, setBilgi] = useState("");
  const yaz = (ek: Partial<IcraBilgi>) => degistir({ icra: { ...b, ...ek } });
  // Faiz oranları sunucudan (TCMB'nin günlük denetimi) gelince hesap yenilenir.
  const faiz = useFaizOranlari();
  const h = useMemo(() => icraHesapla(b), [f.icra, faiz.surum]);
  const eksik = useMemo(() => icraEksikler(f, b), [f]);
  const pb = b.paraBirimi || "TL";

  const alan = (etiket: string, deger: string, deg: (v: string) => void, ph?: string, gen = 220) => (
    <View style={{ flexGrow: 1, flexBasis: gen, gap: 4 }} key={etiket + ":" + surum}>
      <Text style={s.label}>{t(etiket)}</Text>
      <TextInput defaultValue={deger} onChangeText={deg} placeholder={ph ? t(ph) : undefined} placeholderTextColor={C.muted} style={s.inputTek} />
    </View>
  );
  const tarih = (etiket: string, deger: string | undefined, deg: (v: string | undefined) => void) =>
    alan(etiket, tarihYaz(deger), v => deg(tarihCoz(v)), "GG.AA.YYYY", 150);
  const para = (etiket: string, deger: number | undefined, deg: (v: number | undefined) => void) =>
    alan(etiket, sayiYaz(deger), v => deg(sayi(v)), "0,00", 150);

  const masraflar = b.masraflar || [];
  const masrafYaz = (i: number, ek: Partial<Masraf>) => yaz({ masraflar: masraflar.map((m, j) => (j === i ? { ...m, ...ek } : m)) });
  const borclular = b.ekBorclular || [];
  // İcra föyünde künyedeki öteki karşı taraflar (2., 3. davalı…) borçludur: takibin "2. borçlu" kutularına da yazılır.
  const kunyeBorclu = f.tur === "icra" ? (f.ekKarsiTaraflar || []).filter(x => x.ad.trim() && adSade(x.ad) !== adSade(f.karsiTaraf) && !borclular.some(y => adSade(y.ad) === adSade(x.ad))) : [];
  React.useEffect(() => {
    if (kunyeBorclu.length) yaz({ ekBorclular: [...borclular.filter(x => x.ad.trim() || x.kimlikNo || x.adres), ...kunyeBorclu.map(x => ({ ad: x.ad, kimlikNo: x.kimlikNo, adres: x.adres }))] });
  }, [kunyeBorclu.map(x => x.ad).join("|")]);
  // Kalemler: eski kayıttaki tek asıl alacak ilk düzenlemede kalem listesine çevrilir.
  const ks = kalemleri(b);
  const kalemlerYaz = (xs: Kalem[]) => yaz({ kalemler: xs, asil: undefined, islemisFaizElle: undefined, ilamVekalet: undefined, yargilamaGideri: undefined });
  const kalemYaz = (i: number, ek: Partial<Kalem>) => kalemlerYaz(ks.map((k, j) => (j === i ? { ...k, ...ek } : k)));

  const { account } = useAccount();
  // Vekil bilgileri (UYAP XML'inde zorunlu): bu bilgisayarda hatırlanır, her föyde yeniden yazılmaz.
  const [vekil, setVekilRaw] = useState<{ ad?: string; tc?: string; baroNo?: string; tbbNo?: string; adres?: string }>(() => { try { return JSON.parse(globalThis.localStorage?.getItem("celse-vekil") || "{}"); } catch { return {}; } });
  const setVekil = (ek: Partial<typeof vekil>) => { const v = { ...vekil, ...ek }; setVekilRaw(v); try { globalThis.localStorage?.setItem("celse-vekil", JSON.stringify(v)); } catch { /* yok say */ } };
  const vekilBilgi = { adSoyad: vekil.ad || account?.adSoyad || "", tcKimlikNo: vekil.tc, baroNo: vekil.baroNo, tbbNo: vekil.tbbNo, adres: vekil.adres };
  // İlamda vekil olarak siz yazılıysanız (adınız ya da büro avukatlarınızdan biri) büro adresiniz oradan alınır (boşsa).
  React.useEffect(() => {
    if (vekil.adres) return;
    const ilam = f.evraklar.filter(e => e.metin.trim() && evrakTuruBul(e.metin) === "ilam").sort((a, c) => c.eklenme.localeCompare(a.eklenme))[0];
    if (!ilam) return;
    const it = ilamTaraflari(ilam.metin);
    const biz = [it.birinci, it.ikinci].find(x => x?.vekil && bizimVekil(x.vekil, [...bizimAdlar, vekil.ad || "", account?.adSoyad || ""].filter(Boolean)));
    if (biz?.vekilAdres) setVekil({ adres: biz.vekilAdres, ad: vekil.ad || biz.vekil });
  }, [f.evraklar.length]);
  const [xmlHata, setXmlHata] = useState("");
  const xmlIndir = () => {
    setBilgi(""); setXmlHata("");
    // Olmadan XML'in anlamı olmayanlar: taraf adları, alacak kalemi, vekil bilgisi. Ötekiler (adres, kimlik no, IBAN) uyarıdır;
    // UYAP'ta "Tamamlanmayan Dosyalarım"da da tamamlanabilir.
    const sart = [...eksik.filter(x => /adı \/ unvanı|alacak kalemi/.test(x)), ...vekilEksik(vekilBilgi)];
    if (sart.length) { setXmlHata(t("XML için önce şunları yazın: {x}.", { x: sart.map(x => t(x)).join(", ") }) + (vekilEksik(vekilBilgi).length ? " " + t("Vekil bilgileri bu bölümün altındaki “Vekil bilgileri” alanlarına bir kez yazılır.") : "")); return; }
    const uyari = eksik.filter(x => !/adı \/ unvanı|alacak kalemi|İcra dairesi/.test(x));
    const x = uyapXml(f, b, vekilBilgi);
    indir(`uyap-takip-${(f.esasNo || f.id).replace(/[^\w-]+/g, "-")}.xml`, new Blob([x], { type: "application/xml;charset=utf-8" }));
    setBilgi(t("XML indirildi. UYAP Avukat Portal → İcra Takip Açılış – XML ekranında il, adliye ve kota/tevzi tipini seçip bu dosyayı yükleyin; takip “Tamamlanmayan Dosyalarım”a düşer, orada kontrol edip imzalarsınız."));
    if (uyari.length) setXmlHata(t("Dosyada eksik kalanlar (UYAP'ta tamamlamanız gerekir): {x}.", { x: uyari.map(y => t(y)).join(", ") }));
  };

  return (
    <View style={{ gap: 12 }}>
      {(!!onEvrakEkle || !!onEvraktan) && (
        <View style={{ gap: 6, borderWidth: 1, borderColor: C.brassDim, borderRadius: 10, padding: 10 }}>
          <Text style={[s.body, { color: C.text }]}>{t("1. Takibe konu evrakı yükleyin")}</Text>
          <Text style={s.hint}>{t("İlam, çek, senet, kira sözleşmesi ya da fatura (PDF, fotoğraf, UDF, Word) ve varsa vekâletname. Celse okur; takip yolu, ilam/çek bilgileri, alacak kalemleri, faiz başlangıçları ve tarafların adı, kimlik no'su, adresi kendiliğinden yazılır. Yalnız boş alanlar doldurulur.")}</Text>
          <View style={s.row}>
            {!!onEvrakEkle && <Btn label={okuma ? t("Okunuyor…") : t("📎 Evrak yükle (ilam, çek, senet…)")} disabled={!!okuma} onPress={onEvrakEkle} />}
          </View>
          {!!okuma && <Text style={s.hint}>{okuma}</Text>}
          {!!hata && !okuma && <Text style={[s.hint, { color: C.bad }]}>{hata}</Text>}
          {!!onEvrakSil && f.evraklar.length > 0 && (
            <View style={{ gap: 4, marginTop: 4 }}>
              <Text style={s.label}>{t("Yüklenen evrak ({n})", { n: f.evraklar.length })}</Text>
              {[...f.evraklar].sort((a, c) => c.eklenme.localeCompare(a.eklenme)).slice(0, 12).map(e => (
                <View key={e.id} style={[s.row, { alignItems: "center", gap: 8, flexWrap: "wrap" }]}>
                  <Text style={[s.body, { flex: 1, minWidth: 180 }]} numberOfLines={1}>📄 {e.ad}</Text>
                  <EvrakSilDugme onSil={() => onEvrakSil(e)} />
                </View>
              ))}
              <Text style={s.hint}>{t("Yanlış evrakı silince ondan yazılan bilgiler (ilam, çek, alacak kalemleri, taraflar) da kaldırılır; elle değiştirdikleriniz kalır. Kalan evrak varsa bilgiler onlardan yeniden doldurulur.")}</Text>
            </View>
          )}
        </View>
      )}
      <IcraHazirla f={f} degistir={degistir} guncel={guncel} yenile={yenile} onKaydet={onKaydet} />
      <IcraSohbet f={f} degistir={degistir} onMetinEkle={onMetinEkle} onKaydet={onKaydet} guncel={guncel} yenile={yenile} bizimAdlar={bizimAdlar} />
      <HukumOnizleme f={f} degistir={degistir} bizimAdlar={bizimAdlar} kalemSayisi={ks.filter(k => k.tutar).length} onKabul={async xs => { kalemlerYaz(xs); if (onKaydet) await onKaydet(); }} />

      {/* Taraflar ve icra dairesi: künyeye yazılır (künyede de görünür) */}
      <Text style={s.secT}>{t("İcra dairesi ve taraflar")}</Text>
      <View style={s.alanlar}>
        {alan("İcra dairesi", f.mahkeme || "", v => degistir({ mahkeme: v }), "Örn. İzmir Genel İcra Dairesi", 260)}
        {alan("Takip no (açıldıktan sonra)", f.esasNo || "", v => degistir({ esasNo: v }), "2026/1234 E.", 160)}
      </View>
      <Text style={s.label}>{t("Alacaklı (müvekkil)")}</Text>
      <View style={s.alanlar}>
        {alan("Adı soyadı / unvanı", f.muvekkil || "", v => degistir({ muvekkil: v }), undefined, 240)}
        {alan("T.C. kimlik / vergi no", f.muvekkilBilgi?.kimlikNo || "", v => degistir({ muvekkilBilgi: { ...f.muvekkilBilgi, kimlikNo: v.replace(/\D/g, "") } }), undefined, 160)}
        {alan("Adresi", f.muvekkilBilgi?.adres || "", v => degistir({ muvekkilBilgi: { ...f.muvekkilBilgi, adres: v } }), "Mahalle, cadde/sokak, no, ilçe / il", 320)}
      </View>
      {/* Birden çok alacaklı: künyedeki öteki müvekkiller */}
      {(f.ekMuvekkiller || []).map((x, i) => {
        const xs = f.ekMuvekkiller || [];
        const yazM = (ek: Partial<TarafKisi>) => degistir({ ekMuvekkiller: xs.map((y, j) => (j === i ? { ...y, ...ek } : y)) });
        return (
          <View key={"am" + i + ":" + surum} style={[s.alanlar, { alignItems: "flex-end" }]}>
            {alan(`${i + 2}. alacaklı`, x.ad, v => yazM({ ad: v }), "Ad soyad / unvan", 240)}
            {alan("T.C. / vergi no", x.kimlikNo || "", v => yazM({ kimlikNo: v.replace(/\D/g, "") }), undefined, 150)}
            {alan("Adres", x.adres || "", v => yazM({ adres: v }), undefined, 300)}
            <Pressable onPress={() => { degistir({ ekMuvekkiller: xs.filter((_, j) => j !== i) }); yenile?.(); }}><Text style={s.sil}>{t("Kaldır")}</Text></Pressable>
          </View>
        );
      })}
      <View style={s.row}><Btn kind="ghost" label={t("+ Alacaklı ekle")} onPress={() => degistir({ ekMuvekkiller: [...(f.ekMuvekkiller || []), { ad: "" }] })} /></View>
      <View style={{ gap: 2, borderLeftWidth: 3, borderLeftColor: C.brass, paddingLeft: 8 }}>
        <Text style={s.body}><Text style={{ fontWeight: "800" }}>{t("Alacaklı vekili")}:</Text> {vekilBilgi.adSoyad ? (/^av\./i.test(vekilBilgi.adSoyad) ? "" : "Av. ") + vekilBilgi.adSoyad : t("(yazılmamış)")}{vekil.baroNo ? " · " + t("sicil {n}", { n: vekil.baroNo }) : ""}</Text>
        <Text style={s.hint}>{vekil.adres || t("Büro adresi yazılmamış")} · {t("aşağıdaki “Vekil bilgileri”nden değiştirilir; bütün takiplerde kullanılır")}</Text>
      </View>
      <Text style={s.label}>{t("Borçlu")}</Text>
      <View style={s.alanlar}>
        {alan("Adı soyadı / unvanı", f.karsiTaraf || "", v => degistir({ karsiTaraf: v }), undefined, 240)}
        {alan("T.C. kimlik / vergi no", f.karsiBilgi?.kimlikNo || "", v => degistir({ karsiBilgi: { ...f.karsiBilgi, kimlikNo: v.replace(/\D/g, "") } }), undefined, 160)}
        {alan("Adresi", f.karsiBilgi?.adres || "", v => degistir({ karsiBilgi: { ...f.karsiBilgi, adres: v } }), undefined, 320)}
      </View>
      {/* Borçlular */}
      <Text style={s.hint}>{t("Yukarıdaki 1. borçlu künyedeki karşı taraftır; öteki borçlular (ilamdaki öteki davalılar, kefil, avalist…) aşağıda.")}</Text>
      {borclular.map((x, i) => (
        <View key={i + ":" + surum} style={[s.alanlar, { alignItems: "flex-end" }]}>
          {alan(`${i + 2}. borçlu`, x.ad, v => yaz({ ekBorclular: borclular.map((y, j) => (j === i ? { ...y, ad: v } : y)) }), "Ad soyad / unvan")}
          {alan("T.C. / vergi no", x.kimlikNo || "", v => yaz({ ekBorclular: borclular.map((y, j) => (j === i ? { ...y, kimlikNo: v } : y)) }), undefined, 150)}
          {alan("Adres", x.adres || "", v => yaz({ ekBorclular: borclular.map((y, j) => (j === i ? { ...y, adres: v } : y)) }), undefined, 260)}
          <Pressable onPress={() => degistir({ icra: { ...b, ekBorclular: borclular.filter((_, j) => j !== i) }, ...(f.tur === "icra" ? { ekKarsiTaraflar: (f.ekKarsiTaraflar || []).filter(y => adSade(y.ad) !== adSade(x.ad)) } : {}) })}><Text style={s.sil}>{t("Kaldır")}</Text></Pressable>
        </View>
      ))}
      <View style={s.row}><Btn kind="ghost" label={t("+ Borçlu ekle (kefil, avalist, ciranta…)")} onPress={() => yaz({ ekBorclular: [...borclular, { ad: "" }] })} /></View>
      <Text style={s.hint}>{t("Adres yazmak yerine aşağıdaki “Ödeme hesabı ve adresler” bölümünden MERNİS adresini de seçebilirsiniz.")}</Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
        <Acilir etiket={t("Takip yolu")} secili={b.yol} genislik={300} onSec={k => yaz({ yol: k as TakipYolu, talep: k === "kira" ? "haciz_tahliye" : k === "ipotek" || k === "tasinir_rehni" ? "rehin" : "haciz" })}
          secenekler={TAKIP_YOLLARI.map(x => ({ k: x.k, ad: t(x.ad) + (x.ornek ? ` (${x.ornek})` : "") }))} />
        {b.yol === "kira" && <Acilir etiket={t("Talep")} secili={b.talep || "haciz_tahliye"} genislik={220} onSec={k => yaz({ talep: k as IcraBilgi["talep"] })}
          secenekler={[{ k: "haciz_tahliye", ad: t("Haciz ve tahliye") }, { k: "haciz", ad: t("Yalnız haciz (kira alacağı)") }, { k: "tahliye", ad: t("Yalnız tahliye") }]} />}
        {b.yol === "kira" && b.talep === "tahliye" && <Acilir etiket={t("Tahliye sebebi")} secili={b.kira?.sozlesmeSonu ? "son" : "odenmedi"} genislik={300} onSec={k => yaz({ kira: { ...b.kira, sozlesmeSonu: k === "son" } })}
          secenekler={[{ k: "odenmedi", ad: t("Kira ödenmedi – ödeme emri (Örnek 13)") }, { k: "son", ad: t("Kira süresi bitti – tahliye emri (Örnek 14)") }]} />}
        {(b.yol === "ipotek" || b.yol === "tasinir_rehni") && <Acilir etiket={t("Dayanak")} secili={b.ilamNiteliginde ? "ilam" : "adi"} genislik={320} onSec={k => yaz({ ilamNiteliginde: k === "ilam" })}
          secenekler={[{ k: "adi", ad: b.yol === "ipotek" ? t("İpotek belgesi – ödeme emri (Örnek 9)") : t("Rehin sözleşmesi – ödeme emri (Örnek 8)") }, { k: "ilam", ad: b.yol === "ipotek" ? t("İlam niteliğinde belge – icra emri (Örnek 6)") : t("İlam – icra emri (Örnek 44)") }]} />}
        {(b.yol === "genel" || b.yol === "ilamli") && <Acilir etiket={t("Takip mahiyeti (zorunlu)")} secili={b.mahiyet || "-"} genislik={240} onSec={k => yaz({ mahiyet: k === "-" ? undefined : k })}
          secenekler={[{ k: "-", ad: t("Seçiniz") }, ...MAHIYETLER.filter(x => x.yol === b.yol).map(x => ({ k: x.kod, ad: `${t(x.ad)} (${x.kod})` }))]} />}
        <Acilir etiket={t("Para birimi")} secili={pb} genislik={110} onSec={k => yaz({ paraBirimi: k as ParaBirimi })}
          secenekler={(["TL", "USD", "EUR", "GBP"] as const).map(k => ({ k, ad: k }))} />
      </View>

      {/* Dayanak belge */}
      <Text style={s.secT}>{t("Alacağın dayanağı")}</Text>
      {b.yol === "ilamli" && (
        <View style={s.alanlar}>
          {alan("İlamı veren mahkeme", b.ilam?.mahkeme || "", v => yaz({ ilam: { ...b.ilam, mahkeme: v } }), "Örn. İzmir 3. Asliye Hukuk Mahkemesi", 260)}
          {alan("Esas no", b.ilam?.esasNo || "", v => yaz({ ilam: { ...b.ilam, esasNo: v } }), "2025/123", 120)}
          {alan("Karar no", b.ilam?.kararNo || "", v => yaz({ ilam: { ...b.ilam, kararNo: v } }), "2026/45", 120)}
          {tarih("Karar tarihi", b.ilam?.kararTarihi, v => yaz({ ilam: { ...b.ilam, kararTarihi: v } }))}
          {tarih("Kesinleşme (varsa)", b.ilam?.kesinlesme, v => yaz({ ilam: { ...b.ilam, kesinlesme: v } }))}
          <Acilir etiket={t("İlamın dosya türü")} secili={b.ilam?.dosyaTuru || "Hukuk Dava Dosyası"} genislik={220} onSec={k => yaz({ ilam: { ...b.ilam, dosyaTuru: k } })}
            secenekler={["Hukuk Dava Dosyası", "Ceza Dava Dosyası", "İdari Dava Dosyası", "İş Dava Dosyası", "Tüketici Dava Dosyası", "Ticaret Dava Dosyası", "Aile Dava Dosyası"].map(x => ({ k: x, ad: t(x) }))} />
        </View>
      )}
      {b.yol === "kambiyo" && (
        <View style={s.alanlar}>
          <Acilir etiket={t("Senet türü")} secili={b.senet?.tur || "bono"} genislik={140} onSec={k => yaz({ senet: { ...b.senet, tur: k as "bono" | "cek" | "police" } })}
            secenekler={[{ k: "bono", ad: t("Bono") }, { k: "cek", ad: t("Çek") }, { k: "police", ad: t("Poliçe") }]} />
          {tarih("Düzenleme tarihi", b.senet?.duzenleme, v => yaz({ senet: { ...b.senet, duzenleme: v } }))}
          {tarih(b.senet?.tur === "cek" ? "İbraz / karşılıksız tarihi" : "Vade", b.senet?.vade, v => yaz({ senet: { ...b.senet, vade: v } }))}
          {alan("Seri / çek no", b.senet?.seriNo || "", v => yaz({ senet: { ...b.senet, seriNo: v } }), undefined, 140)}
          {b.senet?.tur === "cek" && alan("Muhatap banka / şube", b.senet?.banka || "", v => yaz({ senet: { ...b.senet, banka: v } }), undefined, 200)}
          {alan("Keşideci", b.senet?.kesideci || "", v => yaz({ senet: { ...b.senet, kesideci: v } }), undefined, 200)}
        </View>
      )}
      {b.yol === "kira" && (
        <View style={s.alanlar}>
          {tarih("Kira sözleşmesi tarihi", b.kira?.sozlesmeTarihi, v => yaz({ kira: { ...b.kira, sozlesmeTarihi: v } }))}
          {para("Aylık kira", b.kira?.aylikKira, v => yaz({ kira: { ...b.kira, aylikKira: v } }))}
          {alan("Takibe konu aylar", b.kira?.aylar || "", v => yaz({ kira: { ...b.kira, aylar: v } }), "Örn. Haziran–Eylül 2026 (4 ay)", 240)}
          {alan("Kiralananın adresi", b.kira?.adres || "", v => yaz({ kira: { ...b.kira, adres: v } }), undefined, 300)}
        </View>
      )}
      {(b.yol === "genel" || b.yol === "ipotek" || b.yol === "tasinir_rehni") && (
        <View style={s.alanlar}>
          {alan(b.yol === "genel" ? "Dayanak (fatura, sözleşme, cari hesap, ihtarname…)" : "Rehin / ipotek belgesi (tapu, akit tablosu, rehin sözleşmesi)", b.belge || "", v => yaz({ belge: v }),
            b.yol === "genel" ? "Örn. 12.03.2026 tarihli ve 123 no'lu fatura" : "Örn. 05.01.2025 tarihli ipotek akit tablosu, 1. derece", 400)}
        </View>
      )}


      {/* Ödeme hesabı ve adres seçimi */}
      <Text style={s.secT}>{t("Ödeme hesabı ve adresler")}</Text>
      <View style={s.alanlar}>
        {alan("IBAN (ödemenin yapılacağı hesap)", b.hesap?.iban || "", v => { yaz({ hesap: { ...b.hesap, iban: v.toUpperCase().replace(/\s+/g, "") } }); try { globalThis.localStorage?.setItem("celse-icra-iban", v.toUpperCase().replace(/\s+/g, "")); } catch { /* yok say */ } }, "TR…", 280)}
        {alan("Banka", b.hesap?.banka || "", v => { yaz({ hesap: { ...b.hesap, banka: v } }); try { globalThis.localStorage?.setItem("celse-icra-banka", v); } catch { /* yok say */ } }, undefined, 200)}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
        <Acilir etiket={t("Hesap kimin adına")} secili={b.hesap?.sahibi || "vekil"} genislik={170} onSec={k => yaz({ hesap: { ...b.hesap, sahibi: k as "vekil" | "alacakli" } })} secenekler={[{ k: "vekil", ad: t("Vekil adına") }, { k: "alacakli", ad: t("Alacaklı adına") }]} />
        <Acilir etiket={t("Alacaklı adresi")} secili={b.mernisAlacakli ? "M" : "A"} genislik={200} onSec={k => yaz({ mernisAlacakli: k === "M" })} secenekler={[{ k: "A", ad: t("Künyedeki adres") }, { k: "M", ad: t("MERNİS adresi") }]} />
        <Acilir etiket={t("Borçlu adresi")} secili={b.mernisBorclu ? "M" : "A"} genislik={200} onSec={k => yaz({ mernisBorclu: k === "M" })} secenekler={[{ k: "A", ad: t("Künyedeki adres") }, { k: "M", ad: t("MERNİS adresi") }]} />
      </View>
      {!b.hesap?.iban && (() => { let i = "", bk = ""; try { i = globalThis.localStorage?.getItem("celse-icra-iban") || ""; bk = globalThis.localStorage?.getItem("celse-icra-banka") || ""; } catch { /* yok say */ } return i ? <View style={s.row}><Btn kind="ghost" label={t("Son kullanılan hesabı yaz ({i})", { i: i.slice(0, 4) + "…" + i.slice(-4) })} onPress={() => yaz({ hesap: { ...b.hesap, iban: i, banka: bk || b.hesap?.banka } })} /></View> : null; })()}

      {/* Alacak kalemleri: her kalem kendi faiz türüyle (UYAP takip talebindeki gibi) */}
      <Text style={s.secT}>{t("Alacak kalemleri")}</Text>
      <Text style={s.hint}>{t("UYAP'taki gibi her kalem ayrı yazılır ve kendi faizini işletir (ör. manevi tazminat avans faizli; yargılama gideri, vekâlet ücreti, bakiye harç yasal faizli). İşlemiş faiz kalem kalem hesaplanır; takip sonrası faiz de her kalemin kendi türüyle istenir.")}</Text>
      <View style={s.alanlar}>
        {pb !== "TL" && alan("Takip tarihindeki kur", sayiYaz(b.kur), v => yaz({ kur: sayi(v) }), "Örn. 41,25", 150)}
        {tarih("Takip tarihi (boşsa bugün)", b.takipTarihi, v => yaz({ takipTarihi: v }))}
      </View>
      {h.kalemler.map((x, i) => (
        <View key={i + ":" + surum} style={{ gap: 6, borderLeftWidth: 2, borderLeftColor: C.brassDim, paddingLeft: 10 }}>
          <View style={[s.alanlar, { alignItems: "flex-end" }]}>
            {alan("Kalem", x.k.ad, v => kalemYaz(i, { ad: v }), "Örn. Asıl alacak", 200)}
            {para(`Tutar (${pb})`, x.k.tutar || undefined, v => kalemYaz(i, { tutar: v || 0 }))}
            {tarih("Faiz başlangıcı", x.k.faizBaslangic, v => kalemYaz(i, { faizBaslangic: v }))}
            <Pressable onPress={() => kalemlerYaz(ks.filter((_, j) => j !== i))}><Text style={s.sil}>{t("Kaldır")}</Text></Pressable>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
            <Acilir etiket={t("Faiz türü")} secili={x.k.faizTuru || "yasal"} genislik={280} onSec={k => kalemYaz(i, { faizTuru: k as FaizTuru })} secenekler={FAIZ_TURLERI.map(y => ({ k: y.k, ad: t(y.ad) }))} />
            {(x.k.faizTuru || "yasal") !== "yok" && alan(x.k.faizTuru === "sozlesme" || x.k.faizTuru === "mevduat" ? "Yıllık oran (%)" : "Yıllık oran (%) – boşsa dönemsel", sayiYaz(x.k.oran), v => kalemYaz(i, { oran: sayi(v) }), x.k.faizTuru === "avans" ? "39,75" : x.k.faizTuru === "yasal" || !x.k.faizTuru ? "9 / 24 / 31" : "Örn. 48", 170)}
            {(x.k.faizTuru || "yasal") !== "yok" && para("İşlemiş faiz elle (isteğe bağlı)", x.k.islemisElle, v => kalemYaz(i, { islemisElle: v }))}
          </View>
          <BrutNetSatir k={x.k} pb={pb} onYaz={ek => kalemYaz(i, ek)} />
          {(x.k.faizTuru || "yasal") !== "yok" && <Text style={s.body}>{t("İşlemiş faiz: {x}", { x: tl(x.faiz, pb) })}{x.k.islemisElle !== undefined ? " " + t("(elle)") : ""}</Text>}
          {x.k.islemisElle === undefined && x.dilimler.map((d, j, xs) => <Text key={j} style={s.hint}>{tarihYaz(d.bas)} – {j + 1 < xs.length ? tarihYaz(birGunOnce(d.son)) : tarihYaz(d.son)}: {d.gun} {t("gün")} × %{String(d.oran).replace(".", ",")} = {tl(d.tutar, pb)}</Text>)}
          {!!x.eksik && x.k.islemisElle === undefined && <Text style={[s.hint, { color: C.bad }]}>{t(x.eksik)}</Text>}
        </View>
      ))}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
        <Acilir etiket={t("+ Kalem ekle")} secili="" genislik={260} onSec={k => k && kalemlerYaz([...ks, { ad: k, tutar: 0, faizTuru: "yasal", faizBaslangic: b.yol === "ilamli" && /Yargılama|Vekâlet|harç/i.test(k) ? b.ilam?.kararTarihi : undefined }])}
          secenekler={[{ k: "", ad: t("Kalem seçin…") }, ...KALEM_ADLARI[b.yol].map(x => ({ k: x, ad: t(x) }))]} />
      </View>
      {h.ek.map(x => <Text key={x.ad} style={s.body}>{t(x.ad)}: {tl(x.tutar, pb)}</Text>)}
      <Text style={s.label}>{t("Masraflar (protesto, ihtarname, noter…)")}</Text>
      {masraflar.map((m, i) => (
        <View key={i + ":" + surum} style={[s.alanlar, { alignItems: "flex-end" }]}>
          {alan("Masraf", m.ad, v => masrafYaz(i, { ad: v }), "Örn. ihtarname masrafı")}
          {para("Tutar", m.tutar, v => masrafYaz(i, { tutar: v || 0 }))}
          <Pressable onPress={() => yaz({ masraflar: masraflar.filter((_, j) => j !== i) })}><Text style={s.sil}>{t("Kaldır")}</Text></Pressable>
        </View>
      ))}
      <View style={s.row}><Btn kind="ghost" label={t("+ Masraf ekle")} onPress={() => yaz({ masraflar: [...masraflar, { ad: "", tutar: 0 }] })} /></View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
        <Acilir etiket={t("TBK 100 mahsup")} secili={b.tbk100 === false ? "H" : "E"} genislik={130} onSec={k => yaz({ tbk100: k === "E" })} secenekler={[{ k: "E", ad: t("Evet") }, { k: "H", ad: t("Hayır") }]} />
        <Acilir etiket={t("BSMV")} secili={b.bsmv ? "E" : "H"} genislik={110} onSec={k => yaz({ bsmv: k === "E" })} secenekler={[{ k: "H", ad: t("Hayır") }, { k: "E", ad: t("Evet") }]} />
        <Acilir etiket={t("KKDF")} secili={b.kkdf ? "E" : "H"} genislik={110} onSec={k => yaz({ kkdf: k === "E" })} secenekler={[{ k: "H", ad: t("Hayır") }, { k: "E", ad: t("Evet") }]} />
      </View>

      {/* Sonuç */}
      <View style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, gap: 4 }}>
        <Text style={[s.body, { color: C.text, fontWeight: "700" }]}>{t("Takip miktarı: {x}", { x: tl(h.toplam, pb) })}{pb !== "TL" ? ` · ${tl(h.toplamTL)}` : ""}</Text>
        <Text style={[s.body, { color: C.text }]}>{t("İcra vekâlet ücreti (2026–2027 AAÜT): {u}", { u: tl(h.vekalet.ucret) })}<Text style={s.hint}>{"  " + t("{a}; borçlu ödeme süresinde öderse {d}", { a: h.vekalet.aciklama, d: tl(h.vekalet.ucDortte) })}</Text></Text>
        <View style={[s.row, { gap: 8, alignItems: "center", flexWrap: "wrap" }]}>
          <Acilir etiket={t("Takip talebine")} secili={b.icraVekaletYazma ? "hayir" : "evet"} genislik={260} onSec={k => yaz({ icraVekaletYazma: k === "hayir" })}
            secenekler={[{ k: "evet", ad: t("İcra vekâlet ücretini yaz") }, { k: "hayir", ad: t("Yazma (yalnız bilgi)") }]} />
          <Text style={[s.hint, { flex: 1, minWidth: 220 }]}>{t("Takip miktarına eklenmez; takip giderleriyle birlikte borçludan ayrıca istenir. Kesin hesabı icra dairesi yapar.")}</Text>
        </View>
      </View>
      {eksik.length > 0 && (
        <View style={{ gap: 2 }}>
          <Text style={[s.hint, { color: C.bad }]}>{t("UYAP'ta takip açmak için eksik:")}</Text>
          {eksik.map(x => <Text key={x} style={s.hint}>• {t(x)}</Text>)}
        </View>
      )}
      {alan("Not (takip talebine eklenir)", b.not || "", v => yaz({ not: v }), undefined, 400)}
      <Text style={s.secT}>{t("Vekil bilgileri (UYAP XML için; bu bilgisayarda hatırlanır)")}</Text>
      <View style={s.alanlar}>
        {alan("Vekilin adı soyadı", vekil.ad || account?.adSoyad || "", v => setVekil({ ad: v }), "Av. Ad Soyad", 200)}
        {alan("T.C. kimlik no", vekil.tc || "", v => setVekil({ tc: v.replace(/\D/g, "") }), undefined, 150)}
        {alan("Baro sicil no", vekil.baroNo || "", v => setVekil({ baroNo: v }), undefined, 120)}
        {alan("TBB no", vekil.tbbNo || "", v => setVekil({ tbbNo: v }), undefined, 120)}
        {alan("Büro adresi", vekil.adres || "", v => setVekil({ adres: v }), "… / İZMİR", 300)}
      </View>
      <View style={{ gap: 6, borderWidth: 2, borderColor: C.brass, borderRadius: 12, padding: 12 }}>
        <Text style={[s.body, { color: C.text, fontWeight: "700" }]}>{t("3. 📤 UYAP'a yükleme (XML)")}</Text>
        <Text style={s.hint}>{t("a) Aşağıdaki düğmeyle XML dosyasını indirin. b) UYAP Avukat Portal → menü → Dava Açılış İşlemleri → İcra Takip Açılış – XML. c) İl, adliye, kota / daire tevzi tipi ve takip tipini seçin. d) “Dosya Seç” ile indirdiğiniz .xml dosyasını seçin ve takibi başlatın. e) Takip “Tamamlanmayan Dosyalarım”a düşer: orada kontrol edip dayanak evrakı ekler, imzalar ve harcı yatırırsınız.")}</Text>
        <View style={s.row}><Btn label={t("📤 XML dosyasını oluştur ve indir")} onPress={xmlIndir} /></View>
        {vekilEksik(vekilBilgi).length > 0 && <Text style={s.hint}>{t("XML için vekil bilgisi eksik: {x}", { x: vekilEksik(vekilBilgi).map(x => t(x)).join(", ") })}</Text>}
        {!!xmlHata && <Text style={[s.hint, { color: C.bad }]}>{xmlHata}</Text>}
        {!!bilgi && <Text style={[s.hint, { color: C.good }]}>{bilgi}</Text>}
      </View>
      {!ornekYok && <IcraOrnekleri f={f} b={b} vekil={vekilBilgi.adSoyad} />}
      <Text style={s.hint}>{faizNotu(faiz.durum)}</Text>
    </View>
  );
}

/** Kalemin altında: "⇄ Brütten nete çevir" (işçilik alacakları). Kesintileri gösterir; onaylanınca kalemin tutarı net olur,
 *  brüt tutar saklanır ve geri alınabilir. */
function BrutNetSatir({ k, pb, onYaz }: { k: Kalem; pb: ParaBirimi; onYaz: (ek: Partial<Kalem>) => void }) {
  const [acik, setAcik] = useState(false);
  const [tur, setTur] = useState<BrutTur>(() => k.brut?.tur || brutTurTahmin(k.ad));
  const [gv, setGv] = useState(k.brut?.gv || 15);
  if (k.brut) {
    return (
      <View style={[s.row, { flexWrap: "wrap", gap: 8, alignItems: "center" }]}>
        <Text style={s.hint}>{t("Brüt {b} → net {n} ({tur}, gelir vergisi %{gv})", { b: tl(k.brut.tutar, pb), n: tl(k.tutar, pb), tur: t(BRUT_TURLER.find(x => x.k === k.brut!.tur)!.ad.split(":")[0]), gv: k.brut.gv })}</Text>
        <Pressable onPress={() => onYaz({ tutar: k.brut!.tutar, brut: undefined, ad: k.ad.replace(/\s*\(net\)$/i, "") })}><Text style={s.link}>{t("Brüte geri dön")}</Text></Pressable>
      </View>
    );
  }
  if (!acik) return <Pressable onPress={() => setAcik(true)} disabled={!k.tutar}><Text style={[s.link, !k.tutar && { opacity: 0.5 }]}>{t("⇄ Brütten nete çevir (işçilik alacağı)")}</Text></Pressable>;
  const r = brutNet(k.tutar, tur, gv);
  return (
    <View style={{ gap: 6, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 8 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Acilir etiket={t("Alacağın niteliği")} secili={tur} genislik={330} onSec={x => setTur(x as BrutTur)} secenekler={BRUT_TURLER.map(x => ({ k: x.k, ad: t(x.ad) }))} />
        {tur !== "kidem" && <Acilir etiket={t("Gelir vergisi dilimi")} secili={String(gv)} genislik={150} onSec={x => setGv(Number(x))} secenekler={GV_ORANLARI.map(x => ({ k: String(x), ad: "%" + x }))} />}
      </View>
      <Text style={s.body}>{t("Brüt: {x}", { x: tl(r.brut, pb) })}</Text>
      {r.kesintiler.map(x => <Text key={x.ad} style={s.hint}>− {t(x.ad)}: {tl(x.tutar, pb)}</Text>)}
      <Text style={[s.body, { fontWeight: "800" }]}>{t("Net: {x}", { x: tl(r.net, pb) })}</Text>
      <Text style={s.hint}>{t("Gelir vergisi tek dilimle yaklaşık hesaplanır (bordrodaki kümülatif matrah ve asgari ücret istisnası dikkate alınmaz). İlam alacağı zaten “net” yazıyorsa çevirmeyin.")}</Text>
      <View style={[s.row, { gap: 8, alignItems: "center" }]}>
        <Btn label={t("✓ Neti bu kalemin tutarı yap")} onPress={() => { onYaz({ tutar: r.net, brut: { tutar: r.brut, tur, gv }, ad: /\(net\)$/i.test(k.ad) ? k.ad : k.ad + " (net)" }); setAcik(false); }} />
        <Pressable onPress={() => setAcik(false)}><Text style={s.link}>{t("Vazgeç")}</Text></Pressable>
      </View>
    </View>
  );
}

/** İki basışlı silme: ilk basışta kırmızıya döner ("Silinsin mi?"), ikinci basışta siler; 4 saniye içinde basılmazsa eski hâline döner. */
function EvrakSilDugme({ onSil }: { onSil: () => void }) {
  const [onay, setOnay] = useState(false);
  const z = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const bas = () => {
    if (onay) { if (z.current) clearTimeout(z.current); setOnay(false); onSil(); return; }
    setOnay(true); z.current = setTimeout(() => setOnay(false), 4000);
  };
  return (
    <Pressable onPress={bas} accessibilityRole="button" accessibilityLabel={onay ? t("Silmeyi onayla") : t("Evrakı sil")}
      style={({ pressed }) => [{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.bad, backgroundColor: onay ? C.bad : "transparent" }, pressed && { opacity: 0.6, transform: [{ scale: 0.96 }] }]}>
      <Text style={{ color: onay ? "#fff" : C.bad, fontWeight: "700" }}>{onay ? t("Silinsin mi? Yeniden basın") : t("🗑 Sil")}</Text>
    </Pressable>
  );
}

const yuzde = (x?: [string, number]) => (x ? "%" + String(x[1]).replace(".", ",") + " (" + x[0].split("-").reverse().join(".") + ")" : "");
/** Faiz oranlarının kaynağı ve son günlük denetim. */
function faizNotu(d: FaizDurumu): string {
  const son = d.son ? new Date(d.son).toLocaleString("tr", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  return [
    son ? t("Faiz oranları TCMB'nin resmî tablolarından her sabah denetlenir; son denetim: {s}.", { s: son }) : t("Faiz oranları Celse'de kayıtlı tablolardan (günlük denetim henüz bağlanmadı)."),
    t("Güncel: avans faizi {a}, yasal faiz {y}, TTK 1530 faizi {k}.", { a: yuzde(d.sonAvans), y: yuzde(d.sonYasal), k: yuzde(d.sonTtk) }),
    d.hesaplanan.length ? t("{x} tarihli yasal faiz oranı 7589 s. Kanun kuralıyla (reeskont oranının %80'i) hesaplandı; Resmî Gazete'den kontrol edin.", { x: d.hesaplanan.map(x => x.split("-").reverse().join(".")).join(", ") }) : "",
    d.not ? t("Son denetimde not: {n}", { n: d.not }) : "",
    t("Tabloda olmayan bir oran için kalemin oran alanına elle yazabilirsiniz. Hesaplar bilgi içindir; takip talebini UYAP'ta kontrol edin.")
  ].filter(Boolean).join(" ");
}

const LEHINE_AD: Record<Lehine, string> = { birinci: "davacı lehine", ikinci: "davalı lehine", hazine: "Hazine'ye", iade: "iade", red: "reddedilen", belirsiz: "kimin lehine olduğu anlaşılamadı: kontrol edin" };
const ADSADE = (x?: string) => ust2(x || "").replace(/[^A-ZÇĞİÖŞÜ ]/g, " ").replace(/\s+/g, " ").trim();
const ust2 = (x: string) => x.toLocaleUpperCase("tr");

/**
 * Hangi tarafın vekiliyiz: (1) ilamdaki vekil adı bizim avukatlarımızdan biri; (2) föydeki müvekkil adı ilamda davacı ya da
 * davalı olarak geçiyor; (3) föydeki dilekçeyi (netice ve talep, imza) bizim avukatımız yazmış; (4) föydeki seçim.
 */
export function bizimYanBul(f: Foy, ilamMetni: string, bizimAdlar: string[]): { yan: "birinci" | "ikinci"; neden: string; kesin: boolean } {
  const it = ilamTaraflari(ilamMetni);
  const v1 = bizimVekil(it.birinci?.vekil, bizimAdlar), v2 = bizimVekil(it.ikinci?.vekil, bizimAdlar);
  if (v1 !== v2) return { yan: v1 ? "birinci" : "ikinci", neden: t("İlamda {v} {r} vekili olarak yazılı.", { v: (v1 ? it.birinci?.vekil : it.ikinci?.vekil) || "", r: v1 ? t("davacı") : t("davalı") }), kesin: true };
  const m = ADSADE(f.muvekkil);
  if (m.length > 4) {
    const a1 = ADSADE(it.birinci?.ad), a2 = ADSADE(it.ikinci?.ad);
    const uy = (a: string) => !!a && (a.includes(m) || m.includes(a));
    if (uy(a1) !== uy(a2)) return { yan: uy(a1) ? "birinci" : "ikinci", neden: t("Müvekkiliniz ({m}) ilamda {r} olarak geçiyor.", { m: f.muvekkil, r: uy(a1) ? t("davacı") : t("davalı") }), kesin: true };
  }
  for (const e of f.evraklar) {
    if (!e.metin.trim() || evrakTuruBul(e.metin) === "ilam") continue;
    const d = dilekceYazari(e.metin);
    if (d.yan && d.imza && bizimVekil("Av. " + d.imza, bizimAdlar)) return { yan: d.yan, neden: t("“{ad}” dilekçesini {r} vekili sıfatıyla siz yazmışsınız.", { ad: e.ad, r: d.yan === "birinci" ? t("davacı") : t("davalı") }), kesin: true };
  }
  return { yan: f.taraf === "davali" ? "ikinci" : "birinci", neden: t("İlamdan anlaşılamadı; föydeki seçime göre. Doğru değilse aşağıdan değiştirin."), kesin: false };
}

/**
 * İlamdan takip: önce taraflar (davacı, davalı, vekilleri; bizim hangi tarafın vekili olduğumuz ve neden), sonra davada
 * istenenler (netice ve talep / ıslah), sonra hükümle verilen tutarlar kimin lehine olduklarıyla. Bizim lehimize olanlar seçili
 * gelir; "Kabul et ve kaydet" ile takibe yazılır.
 */
function HukumOnizleme({ f, degistir, kalemSayisi, bizimAdlar, onKabul }: { f: Foy; degistir: (ek: Partial<Foy>) => void; kalemSayisi: number; bizimAdlar: string[]; onKabul: (xs: Kalem[]) => Promise<void> }) {
  const ilamlar = useMemo(() => f.evraklar.filter(e => e.metin.trim() && evrakTuruBul(e.metin) === "ilam").sort((a, b) => b.eklenme.localeCompare(a.eklenme)), [f.evraklar]);
  const [katAcik, setKatAcik] = useState(false);
  const [ilamId, setIlamId] = useState<string | undefined>(undefined);
  const ilam = ilamlar.find(e => e.id === ilamId) || ilamlar[0];
  const tespit = useMemo(() => (ilam ? bizimYanBul(f, ilam.metin, bizimAdlar) : undefined), [ilam?.id, f.muvekkil, f.taraf, f.evraklar.length, bizimAdlar.join("|")]);
  const yan: "birinci" | "ikinci" = tespit?.yan || (f.taraf === "davali" ? "ikinci" : "birinci");
  // İlamdan kesin anlaşılan taraf föyün seçiminden farklıysa föy düzeltilir (bir kez).
  const uygulandi = React.useRef("");
  React.useEffect(() => {
    if (!ilam || !tespit?.kesin || uygulandi.current === ilam.id) return;
    uygulandi.current = ilam.id;
    const ist = tespit.yan === "ikinci" ? "davali" : "davaci";
    if ((f.taraf || "davaci") !== ist) degistir({ taraf: ist });
  }, [ilam?.id, tespit?.kesin, tespit?.yan]);
  const it = useMemo(() => (ilam ? ilamTaraflari(ilam.metin) : undefined), [ilam?.id, ilam?.metin]);
  // Alacaklı ve borçlu ilamın başından: bizim taraf alacaklı, öteki taraf borçlu (boşsa ya da yanlış kişi yazılıysa yazılır).
  const yerlesim = useMemo(() => (it ? ilamdanTaraflar(f, it, yan, { ekAlacakli: bizimVekil((yan === "birinci" ? it.birinci : it.ikinci)?.vekil, bizimAdlar) }) : undefined), [it, yan, f.muvekkil, f.karsiTaraf, f.muvekkilBilgi, f.karsiBilgi, f.icra?.ekBorclular]);
  const [tarafMesaj, setTarafMesaj] = useState("");
  React.useEffect(() => {
    if (!yerlesim || !Object.keys(yerlesim.ek).length) return;
    // Yapay zekâyla hazırlanıp avukatça onaylanan taraflar kurallı okumayla değiştirilmez.
    if (f.icra?.yzHazirlik) return;
    // Taraf seçimi föye henüz yazılmadıysa (yukarıdaki düzeltme) önce o yazılsın.
    if (tespit?.kesin && (f.taraf || "davaci") !== (yan === "ikinci" ? "davali" : "davaci")) return;
    degistir(yerlesim.ek);
    setTarafMesaj(t("İlamdan yazıldı: {x}.", { x: yerlesim.dolan.map(x => t(x)).join(", ") }));
  }, [yerlesim, f.taraf]);
  const liste = useMemo(() => (ilam ? hukumAnaliz(ilam.metin, f.icra?.ilam?.kararTarihi) : []), [ilam?.id, ilam?.metin, f.icra?.ilam?.kararTarihi]);
  // Okuma raporu: Celse'nin ilamdan ne okuduğu ve ilamın kişisel veri içermeyen yapı iskeleti (adlar □, rakamlar 9).
  const [rapor, setRapor] = useState(false);
  const raporMetni = () => {
    if (!ilam || !it) return "";
    const tr = (x?: string) => (x ? x.split("-").reverse().join(".") : "yok");
    const satir = [
      "CELSE OKUMA RAPORU (kişisel veri yok: adlar □, rakamlar 9)",
      `Davacı tarafı: ${it.birinciler.length} kişi · vekil ${it.birinci?.vekil ? "var" : "yok"}`,
      `Davalı tarafı: ${it.ikinciler.length} kişi · vekil ${it.ikinci?.vekil ? "var" : "yok"}`,
      `Dava tarihi: ${it.davaTarihi ? "bulundu" : "bulunamadı"} · karar tarihi: ${it.kararTarihi ? "bulundu" : "bulunamadı"}`,
      "Hüküm kalemleri: " + (liste.length ? liste.map(k => `${k.ad} (${k.lehine}, faiz ${k.faizTuru || "-"}, başlangıç ${k.faizBaslangic ? (k.faizBaslangic === it.davaTarihi ? "dava tarihi" : k.faizBaslangic === it.kararTarihi ? "karar tarihi" : "hükümdeki tarih") : "yok"})`).join("; ") : "yok"),
      "", "--- BAŞLIK VE TARAFLAR ---", taraflarIskeleti(ilam.metin, 60), "", "--- HÜKÜM ---", hukumIskeleti(hukumBolumu(ilam.metin))
    ];
    return satir.join("\n");
  };
  const raporBolumu = () => (
    <View style={{ gap: 4 }}>
      <Pressable onPress={() => setRapor(!rapor)}><Text style={[s.link, { fontSize: 13 }]}>{rapor ? "▾ " : "▸ "}{t("🔍 Okuma raporu: taraf ya da faiz yanlış okunduysa")}</Text></Pressable>
      {rapor && (
        <View style={{ gap: 4 }}>
          <Text style={s.hint}>{t("Celse'nin ilamdan ne okuduğunu ve ilamın yapısını gösterir. Adlar □, rakamlar 9 olarak gizlenmiştir; kişisel veri içermez. Yanlış okunan yer varsa bu metni kopyalayıp destek için gönderebilirsiniz.")}</Text>
          <Text selectable style={[s.hint, { fontFamily: "monospace", borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 8 }]}>{raporMetni()}</Text>
          <View style={s.row}><Btn kind="ghost" label={t("Raporu kopyala")} onPress={async () => { try { await (globalThis.navigator as Navigator | undefined)?.clipboard?.writeText(raporMetni()); setTarafMesaj(t("Okuma raporu kopyalandı.")); } catch { /* metin seçilebilir */ } }} /></View>
        </View>
      )}
    </View>
  );
  const talepler = useMemo(() => {
    if (!ilam) return [];
    // Önce föydeki dava ve ıslah dilekçelerinin "netice ve talep"i; yoksa ilamın iddia özeti.
    const dil = f.evraklar.filter(e => e.id !== ilam.id && e.metin.trim() && /NETİCE|SONUÇ VE (?:İSTEM|TALEP)/i.test(ust2(e.metin)) && dilekceYazari(e.metin).yan === "birinci");
    const xs = dil.sort((a, b) => a.eklenme.localeCompare(b.eklenme)).flatMap(e => talepAnaliz(e.metin));
    const birlesik: Talep[] = [];
    for (const x of [...xs, ...talepAnaliz(ilam.metin)]) { const i = birlesik.findIndex(y => y.ad === x.ad); if (i < 0) birlesik.push(x); else if (x.islah) birlesik[i] = x; }
    return birlesik;
  }, [ilam?.id, f.evraklar.length]);
  const varsayilan = () => new Set(liste.map((x, i) => (x.lehine === yan ? i : -1)).filter(i => i >= 0));
  const [secili, setSecili] = useState<Set<number>>(varsayilan);
  const [acik, setAcik] = useState(kalemSayisi === 0);
  const [mesaj, setMesaj] = useState("");
  React.useEffect(() => { setSecili(varsayilan()); }, [liste, yan]);
  if (!ilam) return null;
  if (!acik) return (
    <View style={{ gap: 2 }}>
      {!!mesaj && <Text style={[s.hint, { color: C.good, fontWeight: "700" }]}>✓ {mesaj}</Text>}
      <Pressable onPress={() => { setMesaj(""); setAcik(true); }}><Text style={s.link}>{t("⚖ İlamı yeniden oku: taraflar, talepler, hüküm")}</Text></Pressable>
      {raporBolumu()}
    </View>
  );
  const sec = liste.filter((_, i) => secili.has(i));
  const toplam = sec.reduce((a, x) => a + x.tutar, 0);
  const bas = (n: string, x: string) => <Text style={[s.label, { marginTop: 6, color: C.brass }]}>{n} · {x}</Text>;
  const tarafSatir = (rol: string, x?: { ad: string; vekil?: string }, biz?: boolean) => (
    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "baseline" }}>
      <Text style={[s.body, { fontWeight: "800", minWidth: 62 }]}>{rol}:</Text>
      <Text style={[s.body, { flex: 1, minWidth: 160 }]}>{x?.ad || t("ilamda bulunamadı")}{x?.vekil ? " · " + t("vekili") + " " + x.vekil : ""}</Text>
      {biz && <Text style={[s.hint, { color: C.good, fontWeight: "800" }]}>{t("◀ BİZ")}</Text>}
    </View>
  );
  return (
    <View style={{ gap: 6, borderWidth: 1, borderColor: C.brass, borderRadius: 10, padding: 10 }}>
      <Pressable onPress={() => setKatAcik(!katAcik)} accessibilityRole="button" style={[s.row, { alignItems: "center", gap: 8 }]}>
        <Text style={[s.body, { color: C.text, fontWeight: "800", flex: 1 }]}>{t("⚖ Celse'nin kendi okuması (yapay zekâsız)")}</Text>
        <Text style={s.hint}>{katAcik ? "▴" : "▾"}</Text>
      </Pressable>
      {!katAcik && <Text style={s.hint}>{t("İlamın taraflarını ve hükmünü bu cihazda kurallarla okur; yapay zekânın hazırladığıyla karşılaştırmak ya da yapay zekâsız doldurmak için açın.")}</Text>}
      {katAcik && <>
      {ilamlar.length > 1 && (
        <Acilir etiket={t("Okunan ilam")} secili={ilam.id} genislik={300} onSec={k => setIlamId(k)} secenekler={ilamlar.map(e => ({ k: e.id, ad: e.ad }))} />
      )}

      {bas("1", t("Taraflar"))}
      {tarafSatir(t("Davacı"), it?.birinci, yan === "birinci")}
      {tarafSatir(t("Davalı"), it?.ikinci, yan === "ikinci")}
      <Acilir etiket={t("Bu dosyada kimin vekilisiniz?")} secili={yan} genislik={300} onSec={k => degistir({ taraf: k === "ikinci" ? "davali" : "davaci" })}
        secenekler={[{ k: "birinci", ad: t("Davacı vekiliyiz") }, { k: "ikinci", ad: t("Davalı vekiliyiz") }]} />
      {!!tespit && <Text style={[s.hint, { color: tespit.kesin ? C.good : C.mid }]}>{tespit.neden}</Text>}
      <View style={{ gap: 2, borderLeftWidth: 3, borderLeftColor: C.brass, paddingLeft: 8 }}>
        <Text style={s.body}><Text style={{ fontWeight: "800" }}>{t("Alacaklı")}:</Text> {f.muvekkil || t("(yazılmamış)")}{(f.ekMuvekkiller || []).filter(x => x.ad.trim()).length ? " " + t("ve {n} ek alacaklı", { n: (f.ekMuvekkiller || []).filter(x => x.ad.trim()).length }) : ""}</Text>
        <Text style={s.body}><Text style={{ fontWeight: "800" }}>{t("Borçlu")}:</Text> {f.karsiTaraf || t("(yazılmamış)")}{(f.icra?.ekBorclular || []).filter(x => x.ad.trim()).length ? " " + t("ve {n} ek borçlu", { n: (f.icra?.ekBorclular || []).filter(x => x.ad.trim()).length }) : ""}</Text>
        {!!tarafMesaj && <Text style={[s.hint, { color: C.good }]}>{tarafMesaj}</Text>}
        {!!yerlesim?.oneri && (
          <Pressable onPress={() => { const o = yerlesim.oneri!; degistir({ karsiTaraf: o.ad, karsiBilgi: { ...(f.karsiBilgi || {}), kimlikNo: o.kimlikNo, adres: o.adres, vekil: (yan === "birinci" ? it?.ikinci : it?.birinci)?.vekil } }); setTarafMesaj(t("Borçlu ilamdan yazıldı.")); }}>
            <Text style={s.link}>{t("Borçlu hanesinde başka bir ad yazılı. İlamdaki {r} “{ad}” borçlu olarak yazılsın mı? Dokunun.", { r: yan === "birinci" ? t("davalı") : t("davacı"), ad: yerlesim.oneri.ad })}</Text>
          </Pressable>
        )}
      </View>

      {bas("2", t("Davada istenenler"))}
      {talepler.length
        ? talepler.map((x, i) => <Text key={i} style={s.body}>• {t(x.ad)}: {tl(x.tutar, "TL")}{x.islah ? " " + t("(ıslahla)") : ""}</Text>)
        : <Text style={s.hint}>{t("Dava dilekçesinin netice ve talebi ya da ilamın iddia özeti okunamadı. Dava dilekçesini föye ekler ya da aşağıdaki kutuya yapıştırırsanız burada görünür.")}</Text>}

      {bas("3", t("Hükümle verilenler"))}
      {!liste.length && <Text style={[s.hint, { color: C.bad }]}>{t("Hüküm kısmında tutar bulunamadı. Hüküm metnini aşağıdaki kutuya yapıştırıp yapay zekâdan okumasını isteyebilir ya da kalemleri elle ekleyebilirsiniz.")}</Text>}
      {liste.map((x, i) => {
        const on = secili.has(i);
        const bizim = x.lehine === yan;
        const istenen = talepler.find(y => y.ad === x.ad);
        return (
          <Pressable key={i} onPress={() => setSecili(v => { const y = new Set(v); if (y.has(i)) y.delete(i); else y.add(i); return y; })} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
            style={({ pressed }) => [{ flexDirection: "row", gap: 8, alignItems: "flex-start", paddingVertical: 4, borderTopWidth: 1, borderTopColor: C.line }, pressed && { opacity: 0.6 }]}>
            <View style={{ width: 20, height: 20, marginTop: 2, borderRadius: 4, borderWidth: 2, borderColor: on ? C.brass : C.muted, backgroundColor: on ? C.brass : "transparent", alignItems: "center", justifyContent: "center" }}>{on && <Text style={{ color: C.brassInk, fontWeight: "900", fontSize: 13, lineHeight: 15 }}>✓</Text>}</View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[s.body, { fontWeight: "700", color: on ? C.text : C.textSoft }]}>{t(x.ad)}{x.brutMu ? " " + t("(brüt)") : ""}: {tl(x.tutar, "TL")}{istenen && istenen.tutar !== x.tutar ? "  ·  " + t("istenen {x}", { x: tl(istenen.tutar, "TL") }) : ""}</Text>
              <Text style={[s.hint, { color: bizim ? C.good : x.lehine === "belirsiz" ? C.mid : C.muted, fontWeight: bizim ? "700" : "400" }]}>
                {bizim ? t("müvekkiliniz lehine") : t(LEHINE_AD[x.lehine])}{x.faizTuru && x.faizTuru !== "yok" ? " · " + t(turAdi(x.faizTuru)) : ""}{x.faizBaslangic ? " · " + t("{d} tarihinden", { d: tarihYaz(x.faizBaslangic) }) : x.faizTuru && x.faizTuru !== "yok" ? " · " + t("faiz başlangıcı yazılmamış") : ""}
              </Text>
              <Text style={s.hint} numberOfLines={2}>{x.cumle}</Text>
            </View>
          </Pressable>
        );
      })}
      {liste.length > 0 && (
        <>
          <Text style={[s.body, { fontWeight: "800" }]}>{t("Seçilen {n} kalem: {x}", { n: sec.length, x: tl(toplam, "TL") })}</Text>
          {kalemSayisi > 0 && <Text style={[s.hint, { color: C.mid }]}>{t("Şu an yazılı {n} alacak kaleminin yerine bunlar yazılır.", { n: kalemSayisi })}</Text>}
          <View style={[s.row, { gap: 8, alignItems: "center", flexWrap: "wrap" }]}>
            <Btn label={t("✓ Kabul et ve kaydet")} disabled={!sec.length} onPress={async () => {
              const kt = f.icra?.ilam?.kararTarihi || it?.kararTarihi;
              await onKabul(sec.map(({ lehine: _l, cumle: _c, brutMu, ...k }) => ({ ...k, ad: brutMu ? k.ad + " (brüt)" : k.ad, faizBaslangic: k.faizBaslangic || (/Yargılama|Vekâlet|Harç/.test(k.ad) ? kt : undefined) })));
              setMesaj(t("{n} kalem takibe yazıldı ve kaydedildi.", { n: sec.length })); setAcik(false);
            }} />
            {kalemSayisi > 0 && <Pressable onPress={() => setAcik(false)}><Text style={s.link}>{t("Vazgeç")}</Text></Pressable>}
          </View>
        </>
      )}
      {raporBolumu()}
      </>}
      {!!mesaj && <Text style={[s.hint, { color: C.good }]}>{mesaj}</Text>}
    </View>
  );
}
