// Föyde üç bölüm: (1) ücret, tahsilat ve masraflar (yol ve kırtasiye hesabıyla), (2) tevkil avukatlar, (3) talepler.
// Evrak eklenince (sözleşme, makbuz, yetki belgesi, karar) ilgili alanlar kendiliğinden dolar; buradan elle de yazılır.
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { ayarOku, ayarYaz, Foy, FoyEvrak, silineniNotEt, tarihCoz, tarihYaz } from "../data/foy";
import { BirimBedel, evraktanHesap, HesapKalem, hesapOzeti, KalemTur, MASRAF_KATEGORI, standartGiderler, Talep, TALEP_AD, TalepDurum, TalepTur, TevkilAvukat, tlYaz, tutarCoz, VARSAYILAN_BEDEL, yeniKalemId, yeniKisiId, yeniTalepId } from "../data/hesap";
import { bugunGun } from "../data/durusma";
import { t } from "../i18n";
import { Acilir } from "./Acilir";
import { s } from "./foyStil";
import { Btn } from "./kit";
import { SonraKaydet } from "./SonraKaydet";
import { C } from "./theme";

type EvrakEkle = (tur?: string) => Promise<FoyEvrak[]>;
const etiket = { color: C.muted, fontSize: 11, letterSpacing: 0.5 } as const;
const KALEM_AD: Record<KalemTur, string> = { tahsilat: "Müvekkilden tahsilat", masraf: "Dava masrafı", tevkil: "Tevkil ödemesi" };

export function hesapOzetYazi(f: Foy): string {
  const o = hesapOzeti(f);
  if (!o.ucret && !o.tahsilat && !o.masraf && !o.tevkil) return t("kayıt yok");
  return [o.ucret ? t("ücret {x}", { x: tlYaz(o.ucret) }) : "", o.tahsilat ? t("tahsil {x}", { x: tlYaz(o.tahsilat) }) : "", o.ucret ? t("kalan {x}", { x: tlYaz(o.kalanUcret) }) : "", o.masraf ? t("masraf {x}", { x: tlYaz(o.masraf) }) : "", o.tevkil ? t("tevkil {x}", { x: tlYaz(o.tevkil) }) : ""].filter(Boolean).join(" · ");
}

export function HesapBolum({ f, degistir, evrakEkle }: { f: Foy; degistir: (ek: Partial<Foy>) => void; evrakEkle?: EvrakEkle }) {
  const hesap = f.hesap || { kalemler: [] };
  const [tur, setTur] = useState<KalemTur>("tahsilat");
  const [kategori, setKategori] = useState(MASRAF_KATEGORI[0]);
  const [kisi, setKisi] = useState(f.tevkil?.[0]?.id || "");
  const [tutar, setTutar] = useState("");
  const [gun, setGun] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [mesaj, setMesaj] = useState("");
  const [bedel, setBedel] = useState<BirimBedel>(VARSAYILAN_BEDEL);
  const [bedelAc, setBedelAc] = useState(false);
  useEffect(() => { ayarOku<BirimBedel>("birimBedel").then(x => x && setBedel({ ...VARSAYILAN_BEDEL, ...x })).catch(() => {}); }, []);
  const o = hesapOzeti(f);
  const kalemler = useMemo(() => [...hesap.kalemler].sort((a, b) => b.tarih.localeCompare(a.tarih)), [hesap.kalemler]);
  const yaz = (k: HesapKalem[], ucret = hesap.ucret) => degistir({ hesap: { ...hesap, ...(ucret ? { ucret } : {}), kalemler: k } });
  const ekle = () => {
    const n = tutarCoz(tutar);
    if (!n) { setMesaj(t("Tutarı yazın: ör. 1.250,50")); return; }
    if (tur === "tevkil" && !kisi) { setMesaj(t("Önce aşağıdan tevkil avukatı ekleyin.")); return; }
    yaz([...hesap.kalemler, { id: yeniKalemId(), tarih: tarihCoz(gun)?.slice(0, 10) || bugunGun(), tutar: n, tur, ...(tur === "masraf" ? { kategori } : {}), ...(tur === "tevkil" ? { kisi } : {}), ...(aciklama.trim() ? { aciklama: aciklama.trim() } : {}) }]);
    setTutar(""); setAciklama(""); setGun(""); setMesaj("");
  };
  const belgeEkle = async (evrakTur: string) => {
    if (!evrakEkle) return;
    const xs = await evrakEkle(evrakTur);
    if (xs.length) setMesaj(t("Evrak eklendi; okunabilen bilgiler işlendi. Kontrol edin."));
  };
  const gider = standartGiderler(f, bedel, bugunGun());
  const bedelYaz = (ek: Partial<BirimBedel>) => { const y = { ...bedel, ...ek }; setBedel(y); ayarYaz("birimBedel", y).catch(() => {}); };
  const sozlesme = hesap.ucret?.sozlesmeEvrakId ? f.evraklar.find(e => e.id === hesap.ucret!.sozlesmeEvrakId) : undefined;

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {[[t("Vekâlet ücreti"), o.ucret], [t("Tahsil edilen"), o.tahsilat], [t("Kalan ücret"), o.kalanUcret], [t("Dava masrafı"), o.masraf], [t("Tevkil ödemesi"), o.tevkil]].map(([a, v]) => (
          <View key={a as string} style={{ borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 120 }}>
            <Text style={etiket}>{a}</Text>
            <Text style={[s.body, { color: C.text, fontWeight: "700" }]}>{tlYaz(v as number)}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
        <View style={{ gap: 4, minWidth: 150 }}>
          <Text style={etiket}>{t("Sözleşmedeki vekâlet ücreti (TL)")}</Text>
          <SonraKaydet deger={hesap.ucret?.tutar ? String(hesap.ucret.tutar).replace(".", ",") : ""} onKaydet={v => yaz(hesap.kalemler, { ...(hesap.ucret || {}), tutar: tutarCoz(v) })}
            placeholder="75.000" style={[s.inputTek, { paddingVertical: 6 }]} />
        </View>
        {evrakEkle && <Btn kind="secondary" label={sozlesme ? t("Sözleşmeyi değiştir") : t("📎 Ücret sözleşmesini tara / ekle")} onPress={() => belgeEkle("Vekâlet ücreti sözleşmesi")} />}
        {!!sozlesme && <Text style={[s.hint, { flex: 1 }]}>📄 {sozlesme.ad}</Text>}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
        <Acilir etiket={t("Kayıt")} secili={tur} genislik={190} onSec={k => setTur(k as KalemTur)} secenekler={(Object.keys(KALEM_AD) as KalemTur[]).map(k => ({ k, ad: t(KALEM_AD[k]) }))} />
        {tur === "masraf" && <Acilir etiket={t("Masraf türü")} secili={kategori} genislik={200} onSec={setKategori} secenekler={MASRAF_KATEGORI.map(k => ({ k, ad: t(k) }))} />}
        {tur === "tevkil" && <Acilir etiket={t("Avukat")} secili={kisi || "-"} genislik={200} onSec={setKisi} secenekler={(f.tevkil || []).length ? f.tevkil!.map(x => ({ k: x.id, ad: x.ad })) : [{ k: "-", ad: t("Önce avukat ekleyin") }]} />}
        <View style={{ gap: 4, width: 110 }}><Text style={etiket}>{t("Tutar (TL)")}</Text><TextInput value={tutar} onChangeText={setTutar} onSubmitEditing={ekle} placeholder="1.250" placeholderTextColor={C.muted} style={[s.inputTek, { paddingVertical: 6 }]} /></View>
        <View style={{ gap: 4, width: 110 }}><Text style={etiket}>{t("Tarih")}</Text><TextInput value={gun} onChangeText={setGun} placeholder={t("bugün")} placeholderTextColor={C.muted} style={[s.inputTek, { paddingVertical: 6 }]} /></View>
        <View style={{ gap: 4, flex: 1, minWidth: 140 }}><Text style={etiket}>{t("Açıklama")}</Text><TextInput value={aciklama} onChangeText={setAciklama} onSubmitEditing={ekle} placeholderTextColor={C.muted} style={[s.inputTek, { paddingVertical: 6 }]} /></View>
        <Btn label={t("Ekle")} onPress={ekle} disabled={!tutar.trim()} />
      </View>
      {evrakEkle && <View style={s.row}><Btn kind="ghost" label={t("📎 Makbuz / dekont ekle (tutar okunur)")} onPress={() => belgeEkle("Harç / masraf")} /></View>}

      {kalemler.length > 0 && (
        <View style={{ gap: 2 }}>
          {kalemler.map(k => (
            <View key={k.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: C.line }}>
              <Text style={[s.hint, { width: 78 }]}>{tarihYaz(k.tarih)}</Text>
              <Text style={[s.body, { flex: 1 }]} numberOfLines={2}>
                <Text style={{ color: k.tur === "tahsilat" ? C.good : k.tur === "tevkil" ? C.p1 : C.mid, fontWeight: "700" }}>{t(k.tur === "masraf" ? k.kategori || "Masraf" : KALEM_AD[k.tur])}</Text>
                {k.tur === "tevkil" ? " · " + (f.tevkil?.find(x => x.id === k.kisi)?.ad || "") : ""}{k.aciklama ? " · " + k.aciklama : ""}
              </Text>
              <Text style={[s.body, { color: C.text, fontWeight: "700" }]}>{tlYaz(k.tutar)}</Text>
              <Pressable onPress={() => degistir({ hesap: { ...hesap, kalemler: hesap.kalemler.filter(x => x.id !== k.id) }, silinen: silineniNotEt(f, [k.id]) })} hitSlop={6}><Text style={s.sil}>✕</Text></Pressable>
            </View>
          ))}
        </View>
      )}

      <Pressable onPress={() => setBedelAc(!bedelAc)}><Text style={s.link}>{bedelAc ? "▾ " : "▸ "}{t("Yol ve kırtasiye giderini hesapla")}{gider.length ? " · " + t("{n} kalem yazılabilir", { n: gider.length }) : ""}</Text></Pressable>
      {bedelAc && (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {([["yol", "Yol (TL / bizzat girilen duruşma)"], ["kirtasiyeDilekce", "Kırtasiye (TL / dilekçe)"], ["kirtasiyeDosya", "Kırtasiye (TL / dosya, bir kez)"]] as const).map(([k, a]) => (
              <View key={k} style={{ gap: 4, minWidth: 170, flex: 1 }}>
                <Text style={etiket}>{t(a)}</Text>
                <SonraKaydet deger={bedel[k] ? String(bedel[k]) : ""} onKaydet={v => bedelYaz({ [k]: tutarCoz(v) || 0 })} placeholder="0" style={[s.inputTek, { paddingVertical: 6 }]} />
              </View>
            ))}
          </View>
          <Text style={s.hint}>{t("Birim bedeller bu cihazda saklanır ve bütün föylerde kullanılır. E-duruşmayla girilen duruşmada yol gideri yazılmaz; aynı duruşma iki kez sayılmaz.")}</Text>
          {gider.length > 0 ? (
            <>
              {gider.map(k => <Text key={k.id} style={s.hint}>+ {tarihYaz(k.tarih)} · {t(k.kategori || "")} · {k.aciklama} · {tlYaz(k.tutar)}</Text>)}
              <Btn kind="secondary" label={t("Bu {n} kalemi masraflara yaz", { n: gider.length })} onPress={() => { yaz([...hesap.kalemler, ...gider]); setMesaj(t("Yol ve kırtasiye giderleri yazıldı.")); }} />
            </>
          ) : <Text style={s.hint}>{t("Yazılacak yeni yol ya da kırtasiye gideri yok (birim bedeli girin; duruşmada “girildi” kutusu işaretli olmalı).")}</Text>}
        </View>
      )}
      {!!mesaj && <Text style={[s.hint, { color: C.brass }]}>{mesaj}</Text>}
    </View>
  );
}

export function TevkilBolum({ f, degistir, onTara }: { f: Foy; degistir: (ek: Partial<Foy>) => void; onTara?: () => string }) {
  const xs = f.tevkil || [];
  const [mesaj, setMesaj] = useState("");
  const guncelle = (x: TevkilAvukat, ek: Partial<TevkilAvukat> | null) =>
    degistir(ek ? { tevkil: xs.map(y => (y.id === x.id ? { ...y, ...ek } : y)) } : { tevkil: xs.filter(y => y.id !== x.id), silinen: silineniNotEt(f, [x.id]) });
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.hint}>{t("Dosyada yetki belgesiyle (tevkilen) duruşmaya giren meslektaşlar. Yetki belgesi ya da tutanak eklenince kendiliğinden bulunur. Ödemeleri “Ücret, ödemeler ve masraflar”a “Tevkil ödemesi” olarak yazın; hangi duruşmaya girdiği duruşma şeridinden seçilir.")}</Text>
      {xs.map(x => {
        const odenen = (f.hesap?.kalemler || []).filter(k => k.tur === "tevkil" && k.kisi === x.id).reduce((a, k) => a + k.tutar, 0);
        return (
          <View key={x.id} style={{ borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 8, gap: 6 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {([["ad", "Ad soyad", 200], ["baro", "Baro", 110], ["sicil", "Sicil no", 90], ["telefon", "Telefon", 140], ["eposta", "E-posta", 180], ["not", "Not", 180]] as const).map(([k, a, w]) => (
                <View key={k} style={{ gap: 4, minWidth: w, flex: 1 }}>
                  <Text style={etiket}>{t(a)}</Text>
                  <SonraKaydet deger={x[k] || ""} onKaydet={v => guncelle(x, { [k]: v.trim() || undefined })} style={[s.inputTek, { paddingVertical: 6 }]} />
                </View>
              ))}
            </View>
            <View style={[s.row, { alignItems: "center" }]}>
              <Text style={[s.hint, { flex: 1 }]}>{[t("{n} duruşma", { n: (x.durusmalar || []).length }), t("ödenen {x}", { x: tlYaz(odenen) }), x.kaynak === "evrak" ? t("evraktan bulundu, kontrol edin") : ""].filter(Boolean).join(" · ")}</Text>
              <Pressable onPress={() => guncelle(x, null)}><Text style={s.sil}>{t("Sil")}</Text></Pressable>
            </View>
          </View>
        );
      })}
      <View style={s.row}>
        <Btn kind="secondary" label={t("+ Tevkil avukat ekle")} onPress={() => degistir({ tevkil: [...xs, { id: yeniKisiId(), ad: "Av. ", kaynak: "elle" }] })} />
        {onTara && <Btn kind="ghost" label={t("Evraktan tara")} onPress={() => setMesaj(onTara())} />}
      </View>
      {!!mesaj && <Text style={[s.hint, { color: C.brass }]}>{mesaj}</Text>}
    </View>
  );
}

const TALEP_TURLERI: TalepTur[] = ["adli_yardim", "ihtiyati_haciz", "ihtiyati_tedbir", "delil_tespiti", "yurutmeyi_durdurma", "durusmali_inceleme"];
export function TaleplerBolum({ f, degistir, evrakEkle }: { f: Foy; degistir: (ek: Partial<Foy>) => void; evrakEkle?: EvrakEkle }) {
  const xs = f.talepler || [];
  const bugun = bugunGun();
  const yaz = (tur: TalepTur, durum: TalepDurum | "-", ek: Partial<Talep> = {}) => {
    const o = xs.find(x => x.tur === tur);
    if (durum === "-") { if (o) degistir({ talepler: xs.filter(x => x.id !== o.id), silinen: silineniNotEt(f, [o.id]) }); return; }
    const y: Talep = { ...(o || { id: yeniTalepId(), tur, tarih: bugun }), durum, ...(durum !== "talep" && !o?.kararTarih ? { kararTarih: bugun } : {}), ...ek };
    degistir({ talepler: o ? xs.map(x => (x.id === o.id ? y : x)) : [...xs, y] });
  };
  return (
    <View style={{ gap: 6 }}>
      {TALEP_TURLERI.map(tur => {
        const o = xs.find(x => x.tur === tur);
        const ev = o?.evrakId ? f.evraklar.find(e => e.id === o.evrakId) : undefined;
        const renk = o?.durum === "kabul" ? C.good : o?.durum === "red" ? C.bad : o ? C.mid : C.line;
        return (
          <View key={tur} style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: 8, borderLeftWidth: 4, borderLeftColor: renk, paddingLeft: 8 }}>
            <Text style={[s.body, { color: C.text, minWidth: 140, paddingBottom: 8 }]}>{o?.durum === "kabul" ? "✓ " : o?.durum === "red" ? "✗ " : o ? "⏳ " : "☐ "}{t(TALEP_AD[tur])}</Text>
            <Acilir etiket={t("Durum")} secili={o?.durum || "-"} genislik={190} onSec={k => yaz(tur, k as TalepDurum | "-")}
              secenekler={[{ k: "-", ad: t("Talep yok") }, { k: "talep", ad: "⏳ " + t("Talep edildi") }, { k: "kabul", ad: "✓ " + t("Kabul edildi") }, { k: "red", ad: "✗ " + t("Reddedildi") }]} />
            {evrakEkle && <Btn kind="ghost" label={ev ? "📄 " + ev.ad.slice(0, 24) : t("📎 Evrak")} onPress={async () => { const e = await evrakEkle("Dilekçe"); if (e[0]) yaz(tur, o?.durum || "talep", { evrakId: e[0].id }); }} />}
            {!!o && <Text style={[s.hint, { paddingBottom: 8 }]}>{[o.tarih ? t("talep {d}", { d: tarihYaz(o.tarih) }) : "", o.kararTarih && o.durum !== "talep" ? t("karar {d}", { d: tarihYaz(o.kararTarih) }) : ""].filter(Boolean).join(" · ")}</Text>}
          </View>
        );
      })}
    </View>
  );
}

/** Föyün evrakını baştan tarar (hesap, tevkil, talepler); işlenenleri anlatan yazı döner. */
export function hesapTara(f: Foy, haric: string[], degistir: (ek: Partial<Foy>) => void): string {
  const r = evraktanHesap(f, f.evraklar, haric, bugunGun());
  if (r.degisen.length) degistir(r.ek);
  return r.degisen.length ? t("Evraktan işlendi: {x}. Kontrol edin.", { x: r.degisen.join(", ") }) : t("Evrakta yeni bilgi bulunamadı.");
}
