// Föyde üç bölüm: (1) ücret, tahsilat ve masraflar (yol ve kırtasiye hesabıyla), (2) tevkil avukatlar, (3) talepler.
// Evrak eklenince (sözleşme, makbuz, yetki belgesi, karar) ilgili alanlar kendiliğinden dolar; buradan elle de yazılır.
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Foy, FoyEvrak, silineniNotEt, tarihCoz, tarihYaz } from "../data/foy";
import { evraktanHesap, HesapKalem, hesapOzeti, KalemTur, MASRAF_KATEGORI, Talep, TALEP_AD, TalepDurum, TalepTur, TevkilAvukat, tlYaz, tutarCoz, yeniKalemId, yeniKisiId, yeniTalepId, yuzdeUcret } from "../data/hesap";
import { davaDegeriEvraktan } from "../data/ucretTarife";
import { bugunGun } from "../data/durusma";
import { t } from "../i18n";
import { Acilir } from "./Acilir";
import { s } from "./foyStil";
import { Btn } from "./kit";
import { SonraKaydet } from "./SonraKaydet";
import { AsgariUcretKart } from "./AsgariUcretKart";
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
  const [tamMesaj, setTamMesaj] = useState("");
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
  // "Tamamı tahsil edildi": kalan ücret tek tahsilat kalemi olarak yazılır; işaret kaldırılınca yalnız bu kalem silinir.
  const tamami = o.ucret > 0 && o.kalanUcret === 0;
  const tamamiDegistir = () => {
    if (!o.ucret) { setTamMesaj(t("Önce sözleşmedeki vekâlet ücretini yazın.")); return; }
    if (tamami) {
      const oto = hesap.kalemler.filter(k => k.tamami);
      if (!oto.length) { setTamMesaj(t("Tahsilatlar elle yazılmış; geri almak için aşağıdaki listeden silin.")); return; }
      yaz(hesap.kalemler.filter(k => !k.tamami));
      setTamMesaj(t("“Tamamı tahsil edildi” işareti kaldırıldı."));
      return;
    }
    yaz([...hesap.kalemler, { id: yeniKalemId(), tarih: bugunGun(), tutar: o.kalanUcret, tur: "tahsilat", aciklama: t("Ücretin tamamı tahsil edildi"), tamami: true }]);
    setTamMesaj(t("Kalan ücret ({x}) tahsil edildi olarak yazıldı.", { x: tlYaz(o.kalanUcret) }));
  };
  // Yüzde ücret: dava değerinin %'si (+ varsa sabit kısım). Dava değeri (elle ya da evraktan) değişince ücret yeniden hesaplanır.
  const evraktanDeger = useMemo(() => davaDegeriEvraktan(f.evraklar).deger, [f.evraklar]);
  const deger = hesap.davaDegeri ?? evraktanDeger;
  const yuzde = hesap.ucret?.yuzde;
  useEffect(() => {
    if (!yuzde) return;
    const hedef = yuzdeUcret(yuzde, deger, hesap.ucret?.sabit);
    if (hedef !== hesap.ucret?.tutar) degistir({ hesap: { ...hesap, ucret: { ...(hesap.ucret || {}), tutar: hedef } } });
  }, [yuzde, deger, hesap.ucret?.sabit]);
  const tlKaydet = (v: string) => {
    const n = tutarCoz(v);
    if (yuzde) yaz(hesap.kalemler, { ...(hesap.ucret || {}), sabit: n, tutar: yuzdeUcret(yuzde, deger, n) });
    else yaz(hesap.kalemler, { ...(hesap.ucret || {}), tutar: n });
  };
  const yuzdeKaydet = (v: string) => {
    const x = Number(v.replace(",", ".").replace(/[^\d.]/g, ""));
    const u = { ...(hesap.ucret || {}) };
    if (!(x > 0)) {
      // Yüzde silindi: sabit kısım (varsa) sözleşme ücreti olarak kalır.
      const sabit = u.sabit; delete u.yuzde; delete u.sabit;
      yaz(hesap.kalemler, { ...u, tutar: sabit });
      return;
    }
    const sabit = u.yuzde ? u.sabit : undefined;
    yaz(hesap.kalemler, { ...u, yuzde: x, sabit, tutar: yuzdeUcret(x, deger, sabit) });
  };
  const sozlesme = hesap.ucret?.sozlesmeEvrakId ? f.evraklar.find(e => e.id === hesap.ucret!.sozlesmeEvrakId) : undefined;

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {[[t("Vekâlet ücreti"), o.ucret], [t("Tahsil edilen"), o.tahsilat], [t("Kalan ücret"), o.kalanUcret], [t("Dava masrafı"), o.masraf], [t("Tevkil ödemesi"), o.tevkil]].map(([a, v], i) => (
          <View key={a as string} style={{ borderWidth: 1, borderColor: i === 1 && tamami ? C.good : C.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 120, gap: 2 }}>
            <Text style={etiket}>{a}</Text>
            <Text style={[s.body, { color: C.text, fontWeight: "700" }]}>{tlYaz(v as number)}</Text>
            {i === 1 && (
              <Pressable onPress={tamamiDegistir} disabled={!o.ucret} accessibilityRole="checkbox" accessibilityState={{ checked: tamami, disabled: !o.ucret }} hitSlop={6}
                style={{ flexDirection: "row", alignItems: "center", gap: 5, opacity: o.ucret ? 1 : 0.5 }}>
                <Text style={{ fontSize: 15, color: tamami ? C.good : C.brass }}>{tamami ? "☑" : "☐"}</Text>
                <Text style={{ color: tamami ? C.good : C.textSoft, fontSize: 12, fontWeight: "700" }}>{t("Tamamı tahsil edildi")}</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>
      {!!tamMesaj && <Text style={[s.hint, { color: C.good }]}>{tamMesaj}</Text>}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
        <View style={{ gap: 4, minWidth: 150 }}>
          <Text style={etiket}>{yuzde ? t("Sabit / peşin kısım (TL, varsa)") : t("Sözleşmedeki vekâlet ücreti (TL)")}</Text>
          <SonraKaydet deger={(yuzde ? hesap.ucret?.sabit : hesap.ucret?.tutar) ? String(yuzde ? hesap.ucret!.sabit : hesap.ucret!.tutar).replace(".", ",") : ""} onKaydet={tlKaydet}
            placeholder={yuzde ? t("yoksa boş") : "75.000"} style={[s.inputTek, { paddingVertical: 6 }]} />
        </View>
        <View style={{ gap: 4, width: 160 }}>
          <Text style={etiket}>{t("Dava değeri (TL)")}</Text>
          <SonraKaydet deger={hesap.davaDegeri ? String(hesap.davaDegeri).replace(".", ",") : ""} placeholder={evraktanDeger ? tlYaz(evraktanDeger) : t("ör. 250.000")}
            onKaydet={v => degistir({ hesap: { ...hesap, davaDegeri: tutarCoz(v) } })} style={[s.inputTek, { paddingVertical: 6 }]} />
        </View>
        <View style={{ gap: 4, width: 150 }}>
          <Text style={etiket}>{t("ya da dava değerinin %'si")}</Text>
          <SonraKaydet deger={yuzde ? String(yuzde).replace(".", ",") : ""} onKaydet={yuzdeKaydet} placeholder={t("ör. 15")} style={[s.inputTek, { paddingVertical: 6 }]} />
        </View>
        {evrakEkle && <Btn kind="secondary" label={sozlesme ? t("Sözleşmeyi değiştir") : t("📎 Ücret sözleşmesini tara / ekle")} onPress={() => belgeEkle("Vekâlet ücreti sözleşmesi")} />}
        {!!sozlesme && <Text style={[s.hint, { flex: 1 }]}>📄 {sozlesme.ad}</Text>}
      </View>

      {!!yuzde && (
        <View style={{ gap: 2 }}>
          <Text style={[s.body, { color: C.text }]}>
            {t("Vekâlet ücreti: ")}
            {[hesap.ucret?.sabit ? tlYaz(hesap.ucret.sabit) : "", deger ? "%" + String(yuzde).replace(".", ",") + " × " + tlYaz(deger) + " = " + tlYaz((deger * yuzde) / 100) : "%" + String(yuzde).replace(".", ",")].filter(Boolean).join(" + ")}
            {deger ? <Text style={{ fontWeight: "800", color: C.brass }}>{"  →  " + tlYaz(hesap.ucret?.tutar || 0)}</Text> : null}
          </Text>
          {!deger && <Text style={[s.hint, { color: C.mid }]}>{t("Dava değeri yazılınca (ya da dava dilekçesi yüklenince) ücret TL olarak hesaplanır.")}</Text>}

          {yuzde > 25 && <Text style={[s.hint, { color: C.bad }]}>{t("Yüzde olarak kararlaştırılan ücret dava değerinin %25'ini geçemez (Av.K. m.164/2).")}</Text>}
          <Text style={s.hint}>{t("Sözleşme “tahsil edilecek tutarın” yüzdesini öngörüyorsa kesin ücret tahsilatta belli olur; burada dava değeri üzerinden tahmin gösterilir.")}</Text>
        </View>
      )}

      <AsgariUcretKart f={f} degistir={degistir} />

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
