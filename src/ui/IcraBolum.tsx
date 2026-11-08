// Föy sayfasında icra takibi hazırlığı: UYAP'ta takip açmak için gereken bütün bilgi ve takip talebi özeti.
// Alacaklı ve borçlu bilgileri föyün künyesinden gelir (müvekkil = alacaklı, karşı taraf = borçlu); burada takip yolu,
// dayanak belge, alacak kalemleri, faiz ve talep doldurulur. Hesap cihazda yapılır.
import React, { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Foy, tarihCoz } from "../data/foy";
import { FAIZ_TURLERI, FaizTuru, IcraBilgi, icraEksikler, icraHesapla, Masraf, ParaBirimi, TAKIP_YOLLARI, TakipYolu, takipTalebiMetni, tl } from "../data/icra";
import { t } from "../i18n";
import { useAccount } from "../data/account";
import { Acilir } from "./Acilir";
import { indir, s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";

const sayi = (v: string): number | undefined => { const x = v.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, ""); return x ? Number(x) : undefined; };
const sayiYaz = (x?: number) => (x === undefined ? "" : String(x).replace(".", ","));
const tarihYaz = (x?: string) => (x ? x.split("-").reverse().join(".") : "");

export function IcraBolum({ f, degistir, surum }: { f: Foy; degistir: (ek: Partial<Foy>) => void; surum: number }) {
  const b: IcraBilgi = f.icra || { yol: "genel", talep: "haciz", paraBirimi: "TL", faizTuru: "yasal" };
  const [bilgi, setBilgi] = useState("");
  const yaz = (ek: Partial<IcraBilgi>) => degistir({ icra: { ...b, ...ek } });
  const h = useMemo(() => icraHesapla(b), [f.icra]);
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

  const { account } = useAccount();
  const metin = () => takipTalebiMetni(f, b, undefined, account?.adSoyad);
  const kopyala = async () => {
    try { await (globalThis.navigator as Navigator | undefined)?.clipboard?.writeText(metin()); setBilgi(t("Takip talebi özeti kopyalandı; UYAP'ta alanlara sırayla yapıştırabilirsiniz.")); }
    catch { setBilgi(t("Kopyalanamadı; aşağıdaki metni seçip kopyalayın.")); }
  };
  const [goster, setGoster] = useState(false);

  return (
    <View style={{ gap: 12 }}>
      <Text style={s.hint}>{t("Alacaklı (müvekkil) ve borçlu (karşı taraf) adı, kimlik no ve adresi künyeden alınır. Buraya takibin yolu, dayanağı ve alacak kalemleri girilir; Celse işlemiş faizi ve toplamı hesaplar, UYAP'a giriş sırasıyla takip talebi özetini hazırlar.")}</Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
        <Acilir etiket={t("Takip yolu")} secili={b.yol} genislik={300} onSec={k => yaz({ yol: k as TakipYolu, talep: k === "kira" ? "haciz_tahliye" : k === "ipotek" || k === "tasinir_rehni" ? "rehin" : "haciz" })}
          secenekler={TAKIP_YOLLARI.map(x => ({ k: x.k, ad: t(x.ad) + (x.ornek ? ` (${x.ornek})` : "") }))} />
        {b.yol === "kira" && <Acilir etiket={t("Talep")} secili={b.talep || "haciz_tahliye"} genislik={220} onSec={k => yaz({ talep: k as IcraBilgi["talep"] })}
          secenekler={[{ k: "haciz_tahliye", ad: t("Haciz ve tahliye") }, { k: "haciz", ad: t("Yalnız haciz (kira alacağı)") }, { k: "tahliye", ad: t("Yalnız tahliye") }]} />}
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

      {/* Borçlular */}
      <Text style={s.secT}>{t("Borçlular")}</Text>
      <Text style={s.hint}>{t("1. borçlu künyedeki karşı taraftır: {ad}", { ad: f.karsiTaraf || t("(yazılmamış)") })}</Text>
      {borclular.map((x, i) => (
        <View key={i + ":" + surum} style={[s.alanlar, { alignItems: "flex-end" }]}>
          {alan(`${i + 2}. borçlu`, x.ad, v => yaz({ ekBorclular: borclular.map((y, j) => (j === i ? { ...y, ad: v } : y)) }), "Ad soyad / unvan")}
          {alan("T.C. / vergi no", x.kimlikNo || "", v => yaz({ ekBorclular: borclular.map((y, j) => (j === i ? { ...y, kimlikNo: v } : y)) }), undefined, 150)}
          {alan("Adres", x.adres || "", v => yaz({ ekBorclular: borclular.map((y, j) => (j === i ? { ...y, adres: v } : y)) }), undefined, 260)}
          <Pressable onPress={() => yaz({ ekBorclular: borclular.filter((_, j) => j !== i) })}><Text style={s.sil}>{t("Kaldır")}</Text></Pressable>
        </View>
      ))}
      <View style={s.row}><Btn kind="ghost" label={t("+ Borçlu ekle (kefil, avalist, ciranta…)")} onPress={() => yaz({ ekBorclular: [...borclular, { ad: "" }] })} /></View>

      {/* Alacak kalemleri */}
      <Text style={s.secT}>{t("Alacak kalemleri")}</Text>
      <View style={s.alanlar}>
        {para(`Asıl alacak (${pb})`, b.asil, v => yaz({ asil: v }))}
        {pb !== "TL" && alan("Takip tarihindeki kur", sayiYaz(b.kur), v => yaz({ kur: sayi(v) }), "Örn. 41,25", 150)}
        {tarih("Faiz başlangıcı (temerrüt / vade)", b.faizBaslangic, v => yaz({ faizBaslangic: v }))}
        {tarih("Takip tarihi (boşsa bugün)", b.takipTarihi, v => yaz({ takipTarihi: v }))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
        <Acilir etiket={t("İşlemiş faiz türü")} secili={b.faizTuru || "yasal"} genislik={300} onSec={k => yaz({ faizTuru: k as FaizTuru })} secenekler={FAIZ_TURLERI.map(x => ({ k: x.k, ad: t(x.ad) }))} />
        {(b.faizTuru || "yasal") !== "yok" && alan(b.faizTuru === "sozlesme" || b.faizTuru === "mevduat" ? "Yıllık oran (%)" : "Yıllık oran (%) – boşsa Celse'deki oranlar", sayiYaz(b.oran), v => yaz({ oran: sayi(v) }), b.faizTuru === "yasal" ? "9 / 24 / 31 dönemsel" : b.faizTuru === "avans" ? "39,75 (20.12.2025'ten)" : "Örn. 48", 200)}
      </View>
      {(b.faizTuru || "yasal") !== "yok" && (
        <View style={{ gap: 2 }}>
          <Text style={s.body}>{t("İşlemiş faiz: {x}", { x: tl(h.faiz, pb) })}{b.islemisFaizElle !== undefined ? " " + t("(elle girildi)") : ""}</Text>
          {b.islemisFaizElle === undefined && h.faizDilimleri.map((d, i) => <Text key={i} style={s.hint}>{tarihYaz(d.bas)} – {tarihYaz(d.son)}: {d.gun} {t("gün")} × %{String(d.oran).replace(".", ",")} = {tl(d.tutar, pb)}</Text>)}
          {!!h.faizEksik && b.islemisFaizElle === undefined && <Text style={[s.hint, { color: C.bad }]}>{t(h.faizEksik)}</Text>}
          <View style={s.alanlar}>{para("İşlemiş faizi elle yaz (isteğe bağlı)", b.islemisFaizElle, v => yaz({ islemisFaizElle: v }))}</View>
        </View>
      )}
      {b.yol === "ilamli" && (
        <View style={s.alanlar}>
          {para("İlam vekâlet ücreti", b.ilamVekalet, v => yaz({ ilamVekalet: v }))}
          {para("Yargılama gideri", b.yargilamaGideri, v => yaz({ yargilamaGideri: v }))}
        </View>
      )}
      {h.ek.filter(x => !/İlam|Yargılama/.test(x.ad)).map(x => <Text key={x.ad} style={s.body}>{t(x.ad)}: {tl(x.tutar, pb)}</Text>)}
      <Text style={s.label}>{t("Masraflar (protesto, ihtarname, noter…)")}</Text>
      {masraflar.map((m, i) => (
        <View key={i + ":" + surum} style={[s.alanlar, { alignItems: "flex-end" }]}>
          {alan("Masraf", m.ad, v => masrafYaz(i, { ad: v }), "Örn. ihtarname masrafı")}
          {para("Tutar", m.tutar, v => masrafYaz(i, { tutar: v || 0 }))}
          <Pressable onPress={() => yaz({ masraflar: masraflar.filter((_, j) => j !== i) })}><Text style={s.sil}>{t("Kaldır")}</Text></Pressable>
        </View>
      ))}
      <View style={s.row}><Btn kind="ghost" label={t("+ Masraf ekle")} onPress={() => yaz({ masraflar: [...masraflar, { ad: "", tutar: 0 }] })} /></View>

      {/* Takip sonrası faiz */}
      <Text style={s.secT}>{t("Takip sonrası faiz")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
        <Acilir etiket={t("Faiz türü")} secili={b.takipSonrasiTur || b.faizTuru || "yasal"} genislik={300} onSec={k => yaz({ takipSonrasiTur: k as FaizTuru })} secenekler={FAIZ_TURLERI.map(x => ({ k: x.k, ad: t(x.ad) }))} />
        {alan("Yıllık oran (%) – değişkense boş bırakın", sayiYaz(b.takipSonrasiOran), v => yaz({ takipSonrasiOran: sayi(v) }), undefined, 200)}
      </View>

      {/* Sonuç */}
      <View style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, gap: 4 }}>
        <Text style={[s.body, { color: C.text, fontWeight: "700" }]}>{t("Takip miktarı: {x}", { x: tl(h.toplam, pb) })}{pb !== "TL" ? ` · ${tl(h.toplamTL)}` : ""}</Text>
        <Text style={s.hint}>{t("İcra vekâlet ücreti (2026–2027 AAÜT, bilgi için): {u} · ödeme süresinde ödenirse {d}. Dosya hesabını icra dairesi yapar.", { u: tl(h.vekalet.ucret), d: tl(h.vekalet.ucDortte) })}</Text>
      </View>
      {eksik.length > 0 && (
        <View style={{ gap: 2 }}>
          <Text style={[s.hint, { color: C.bad }]}>{t("UYAP'ta takip açmak için eksik:")}</Text>
          {eksik.map(x => <Text key={x} style={s.hint}>• {t(x)}</Text>)}
        </View>
      )}
      {alan("Not (takip talebine eklenir)", b.not || "", v => yaz({ not: v }), undefined, 400)}
      <View style={s.row}>
        <Btn label={t("Takip talebi özetini kopyala")} onPress={kopyala} />
        <Btn kind="secondary" label={goster ? t("Özeti gizle") : t("Özeti göster")} onPress={() => setGoster(!goster)} />
        <Btn kind="ghost" label={t("Metin olarak indir")} onPress={() => indir(`takip-talebi-${(f.esasNo || f.id).replace(/[^\w-]+/g, "-")}.txt`, new Blob([metin()], { type: "text/plain;charset=utf-8" }))} />
      </View>
      {!!bilgi && <Text style={[s.hint, { color: C.good }]}>{bilgi}</Text>}
      {goster && <Text selectable style={[s.body, { fontFamily: "monospace", fontSize: 13 }]}>{metin()}</Text>}
      <Text style={s.hint}>{t("Oranlar: yasal faiz %9 (31.05.2024'e kadar), %24 (01.06.2024), %31 (31.07.2026, 7589 s. Kanun); avans faizi %39,75 (20.12.2025). Yeni bir oran yayımlandığında yukarıdaki oran alanına yazabilirsiniz. Hesaplar bilgi içindir; takip talebini UYAP'ta kontrol edin.")}</Text>
    </View>
  );
}
