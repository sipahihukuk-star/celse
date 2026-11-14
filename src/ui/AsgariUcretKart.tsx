// "Ücret, ödemeler ve masraflar"ın başında: AAÜT'ye göre asgari vekâlet ücreti (mahkemeye, dava değerine ve dava açılış
// tarihine göre) ve davayı açarken ödenecek başlangıç giderleri (harçlar, gider avansı). Sözleşmedeki ücret avukatça yazılır;
// asgari ücret hep görünür, sözleşme altındaysa uyarılır. Giderler seçilip "Masraflara ekle" ile tahmini kalem olarak yazılır;
// gerçek makbuz / dekont ya da mahkemenin ara kararı gelince düzeltilir ya da silinir.
import React, { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Foy, tarihYaz } from "../data/foy";
import { HesapKalem, tlYaz, tutarCoz, yeniKalemId } from "../data/hesap";
import { asgariUcret, davaDegeriEvraktan, giderTahmini, MAHKEME_AD } from "../data/ucretTarife";
import { bugunGun } from "../data/durusma";
import { t } from "../i18n";
import { s } from "./foyStil";
import { Btn } from "./kit";
import { SonraKaydet } from "./SonraKaydet";
import { C } from "./theme";

const etiket = { color: C.muted, fontSize: 11, letterSpacing: 0.5 } as const;

export function AsgariUcretKart({ f, degistir }: { f: Foy; degistir: (ek: Partial<Foy>) => void }) {
  const hesap = f.hesap || { kalemler: [] };
  const evraktanDeger = useMemo(() => davaDegeriEvraktan(f.evraklar).deger, [f.evraklar]);
  const deger = hesap.davaDegeri ?? evraktanDeger;
  const a = useMemo(() => asgariUcret(f, deger), [f.mahkeme, f.tur, f.davaTuru, f.acilis, deger]);
  const g = useMemo(() => giderTahmini(f, deger), [f.mahkeme, f.tur, f.taraf, f.ekMuvekkiller, f.ekKarsiTaraflar, f.icra?.ekBorclular, deger]);
  const yazili = new Set(hesap.kalemler.map(k => k.tahmin).filter(Boolean));
  const [sec, setSec] = useState<Set<string> | null>(null);
  const secili = sec || new Set(g.kalemler.filter(k => !yazili.has(k.kod)).map(k => k.kod));
  const [mesaj, setMesaj] = useState("");
  // Aç / kapa: kapalıyken yalnız başlık ve tek satır özet (asgari ücret, eklenmemiş gider toplamı, uyarı) görünür.
  const [acik, setAcik] = useState(false);
  // Tarifede olmayan giderler (bilirkişi, keşif, tanık…): ne masrafı olduğu ve TL tutarı yazılıp eklenir.
  const [digerAd, setDigerAd] = useState("");
  const [digerTutar, setDigerTutar] = useState("");
  // Evraktan (makbuz, dekont) ya da elle gerçek gider yazılınca aynı türdeki tahmini kayıt kaldırılabilir.
  const cakisan = hesap.kalemler.filter(k => k.tahmin && hesap.kalemler.some(x => !x.tahmin && x.tur === "masraf" && x.kategori === k.kategori));
  const sozlesme = hesap.ucret?.tutar || 0;
  const asgari = a.guncel.asgari || 0;
  const kalanGider = g.kalemler.filter(k => !yazili.has(k.kod)).reduce((x, k) => x + k.tutar, 0);

  const giderEkle = () => {
    const yeni: HesapKalem[] = g.kalemler.filter(k => secili.has(k.kod) && !yazili.has(k.kod))
      .map(k => ({ id: yeniKalemId(), tarih: f.acilis?.slice(0, 10) || bugunGun(), tutar: k.tutar, tur: "masraf", kategori: k.kategori, aciklama: k.aciklama + " (tarifeden tahmini)", tahmin: k.kod }));
    if (!yeni.length) { setMesaj(t("Seçili yeni gider yok.")); return; }
    degistir({ hesap: { ...hesap, kalemler: [...hesap.kalemler, ...yeni] } });
    setSec(null);
    setMesaj(t("{n} gider masraflara eklendi (tahmini). Makbuz ya da ara karar gelince tutarı düzeltin.", { n: yeni.length }));
  };

  const digerKategori = (x: string) => {
    const u = x.toLocaleLowerCase("tr");
    return /bilirkişi/.test(u) ? "Bilirkişi ücreti" : /keşif/.test(u) ? "Keşif gideri" : /tanık/.test(u) ? "Tanık ücreti" : /tebligat|posta/.test(u) ? "Tebligat / posta"
      : /avans/.test(u) ? "Gider avansı" : /istinaf|temyiz/.test(u) ? "İstinaf / temyiz harcı" : /harç/.test(u) ? "Başvuru / peşin harç" : /noter/.test(u) ? "Noter" : /yol|ulaşım|yakıt|otopark/.test(u) ? "Yol gideri" : /kırtasiye|fotokopi|baskı/.test(u) ? "Kırtasiye / fotokopi" : /iletişim|telefon|kargo|kurye/.test(u) ? "İletişim (telefon, posta, kargo)" : "Diğer";
  };
  const digerEkle = () => {
    const ad = digerAd.trim(), n = tutarCoz(digerTutar);
    if (!ad) { setMesaj(t("Ne masrafı olduğunu yazın: ör. Bilirkişi ücreti")); return; }
    if (!n) { setMesaj(t("Tutarı TL olarak yazın: ör. 6.000")); return; }
    degistir({ hesap: { ...hesap, kalemler: [...hesap.kalemler, { id: yeniKalemId(), tarih: bugunGun(), tutar: n, tur: "masraf", kategori: digerKategori(ad), aciklama: ad }] } });
    setDigerAd(""); setDigerTutar("");
    setMesaj(t("“{a}” {x} masraflara eklendi.", { a: ad, x: tlYaz(n) }));
  };

  return (
    <View style={{ gap: 8, borderWidth: 1, borderColor: C.brass, borderRadius: 10, padding: 10 }}>
      <Pressable onPress={() => setAcik(!acik)} accessibilityRole="button" accessibilityState={{ expanded: acik }} hitSlop={6}
        style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={[s.body, { flex: 1, color: C.text, fontWeight: "700" }]}>{t("⚖ Asgari vekâlet ücreti ve başlangıç giderleri")}</Text>
        <Text style={{ color: C.brass, fontSize: 13, fontWeight: "700" }}>{acik ? t("▲ Kapat") : t("▼ Aç")}</Text>
      </Pressable>
      {!acik && (
        <Pressable onPress={() => setAcik(true)}>
          <Text style={s.hint}>
            {t("Asgari ücret: ")}<Text style={{ fontWeight: "800", color: C.brass }}>{asgari ? tlYaz(asgari) : t("tarifede bulunamadı")}</Text>
            {kalanGider > 0 ? " · " + t("eklenmemiş tahmini gider {x}", { x: tlYaz(kalanGider) }) : ""}
          </Text>
          {sozlesme > 0 && asgari > 0 && sozlesme < asgari && <Text style={[s.hint, { color: C.bad }]}>{t("Sözleşmedeki ücret ({x}) asgari ücretin altında.", { x: tlYaz(sozlesme) })}</Text>}
        </Pressable>
      )}
      {acik && <>
      <Text style={s.hint}>
        {t("Yer: {m}", { m: t(MAHKEME_AD[a.mahkeme]) })}{deger ? " · " + t("dava değeri {x}", { x: tlYaz(deger) }) + (hesap.davaDegeri ? "" : " (" + t("evraktan") + ")") : " · " + t("dava değeri yazılmadı (yukarıdaki kutudan yazın)")}
      </Text>
      <View style={{ gap: 2 }}>
        <Text style={[s.body, { color: C.text }]}>
          {t("Asgari ücret ({tarife}): ", { tarife: a.guncel.tarife })}<Text style={{ fontWeight: "800", color: C.brass }}>{asgari ? tlYaz(asgari) : t("tarifede bulunamadı")}</Text>
        </Text>
        <Text style={s.hint}>
          {[a.guncel.maktu ? t("maktu {x}", { x: tlYaz(a.guncel.maktu) }) : "", a.guncel.nispi !== undefined ? t("dava değerine göre nispi {x}", { x: tlYaz(a.guncel.nispi) }) : "", a.guncel.rg].filter(Boolean).join(" · ")}
        </Text>
        {a.acilis && (
          <Text style={s.hint}>
            {a.acilis.bilinmiyor
              ? t("Dava açılış tarihindeki ({d}) tarifenin bu kalemi Celse'de yok; güncel tarife gösteriliyor.", { d: tarihYaz(a.acilis.tarih) })
              : t("Dava açılış tarihindeki ({d}) {tarife}: maktu {x}.", { d: tarihYaz(a.acilis.tarih), tarife: a.acilis.tarife, x: tlYaz(a.acilis.maktu || 0) })}
          </Text>
        )}
        {sozlesme > 0 && asgari > 0 && sozlesme < asgari && <Text style={[s.hint, { color: C.bad }]}>{t("Sözleşmedeki ücret ({x}) asgari ücretin altında.", { x: tlYaz(sozlesme) })}</Text>}
        {!sozlesme && asgari > 0 && <View style={s.row}><Btn kind="secondary" label={t("Asgari ücreti sözleşme ücreti olarak yaz ({x})", { x: tlYaz(asgari) })} onPress={() => degistir({ hesap: { ...hesap, ucret: { ...(hesap.ucret || {}), tutar: asgari, aciklama: hesap.ucret?.aciklama || a.guncel.tarife + " asgari ücret" } } })} /></View>}
        {a.notlar.map((n, i) => <Text key={i} style={s.hint}>• {t(n)}</Text>)}
      </View>

      {g.kalemler.length > 0 && <Text style={[s.label, { marginTop: 4 }]}>{t("Davayı açarken ödenecek giderler (tahmini)")}</Text>}
      {g.kalemler.map(k => {
        const var_ = yazili.has(k.kod), on = secili.has(k.kod);
        return (
          <Pressable key={k.kod} disabled={var_} onPress={() => { const y = new Set(secili); if (on) y.delete(k.kod); else y.add(k.kod); setSec(y); }} style={[s.row, { gap: 8, alignItems: "center" }]}>
            <Text style={{ fontSize: 16, color: var_ ? C.good : on ? C.brass : C.muted }}>{var_ ? "✓" : on ? "☑" : "☐"}</Text>
            <Text style={[s.body, { flex: 1 }]}>{t(k.aciklama)}</Text>
            <Text style={[s.body, { fontWeight: "700" }]}>{tlYaz(k.tutar)}</Text>
          </Pressable>
        );
      })}
      {g.kalemler.length > 0 && (
        <View style={[s.row, { gap: 8, alignItems: "center" }]}>
          <Btn label={t("➕ Seçilenleri masraflara ekle")} onPress={giderEkle} disabled={![...secili].some(k => !yazili.has(k))} />
          <Text style={s.hint}>{t("Toplam: {x}", { x: tlYaz(g.kalemler.filter(k => secili.has(k.kod) || yazili.has(k.kod)).reduce((x, k) => x + k.tutar, 0)) })}</Text>
        </View>
      )}
      <Text style={[s.label, { marginTop: 4 }]}>{t("Diğer giderler (bilirkişi, keşif, tanık, yol, kırtasiye, iletişim…)")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {["Bilirkişi ücreti", "Keşif gideri", "Tanık ücreti", "Tebligat gideri", "Ek gider avansı", "Yol gideri", "Kırtasiye gideri", "İletişim gideri"].map(x => (
          <Pressable key={x} onPress={() => setDigerAd(t(x))} style={{ borderWidth: 1, borderColor: digerAd === t(x) ? C.brass : C.line, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: digerAd === t(x) ? C.brass : C.textSoft, fontSize: 12 }}>{t(x)}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
        <View style={{ gap: 4, flex: 1, minWidth: 200 }}>
          <Text style={etiket}>{t("Ne masrafı")}</Text>
          <TextInput value={digerAd} onChangeText={setDigerAd} onSubmitEditing={digerEkle} placeholder={t("ör. Bilirkişi ücreti (talebimiz üzerine)")} placeholderTextColor={C.muted} style={[s.inputTek, { paddingVertical: 6 }]} />
        </View>
        <View style={{ gap: 4, width: 140 }}>
          <Text style={etiket}>{t("Tutar (TL)")}</Text>
          <TextInput value={digerTutar} onChangeText={setDigerTutar} onSubmitEditing={digerEkle} placeholder="6.000" placeholderTextColor={C.muted} keyboardType="decimal-pad" style={[s.inputTek, { paddingVertical: 6 }]} />
        </View>
        <Btn label={t("➕ Ekle")} onPress={digerEkle} disabled={!digerAd.trim() || !digerTutar.trim()} />
      </View>
      {g.notlar.map((n, i) => <Text key={i} style={s.hint}>• {t(n)}</Text>)}
      <Text style={s.hint}>{t("Tutarlar 2026 harç tarifesi ve HMK gider avansı tarifesine göre tahminidir; vezne makbuzu ya da dekont ekleyince gerçek tutarı yazın. Bilirkişi, keşif, tanık, yol, kırtasiye ve iletişim gibi tarifede olmayan giderleri yukarıdaki “Diğer giderler”den ekleyin.")}</Text>
      {cakisan.length > 0 && (
        <View style={[s.row, { gap: 8, alignItems: "center" }]}>
          <Text style={[s.hint, { flex: 1, color: C.mid }]}>{t("{n} tahmini giderin gerçek kaydı (makbuz / dekont) da var.", { n: cakisan.length })}</Text>
          <Btn kind="secondary" label={t("Tahminleri kaldır")} onPress={() => { degistir({ hesap: { ...hesap, kalemler: hesap.kalemler.filter(k => !cakisan.includes(k)) } }); setMesaj(t("Gerçek kaydı gelen tahmini giderler kaldırıldı.")); }} />
        </View>
      )}
      </>}
      {!!mesaj && <Text style={[s.hint, { color: C.good }]}>{mesaj}</Text>}
    </View>
  );
}
