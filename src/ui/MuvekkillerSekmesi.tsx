// "👤 Müvekkillerim": vekâletnameler toplu yüklenir (dosyalar ya da bütün klasör), her biri bu cihazda okunur (taranmışsa yazı
// tanımayla) ve her vekil eden için müvekkil kartı hazırlanır. Avukat sonucu görür, "💾 Hepsini kaydet" demeden hiçbir şey
// kaydedilmez. 2000 vekâletname yüklenirse 2000 müvekkil (aynı kişi birden çok vekâletnamede geçiyorsa tek kart) oluşur.
// Kart açılınca bilgileri düzeltilir, vekâletname dosyaları indirilir, müvekkilin dava dosyaları görülür.
import React, { useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { dosyaOku, dosyaYaz, Foy, FoyEvrak, foyBaslik, foylerKaydet, foyKaydet, foySil, yeniId } from "../data/foy";
import { turBilgi } from "../data/foyTurleri";
import { dosyalariTamamla, kartDosyalari, OkunanVekalet, sadeAd, vekaletlerdenKartlar } from "../data/muvekkil";
import { vekaletOku } from "../data/vekaletOku";
import { t } from "../i18n";
import { evrakMetniOku } from "./foyEvrak";
import { indir, s } from "./foyStil";
import { HizliGirdi } from "./HizliGirdi";
import { KaydirSil } from "./KaydirSil";
import { Btn } from "./kit";
import { C } from "./theme";

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const SAYFA = 50;
const UZANTI = /\.(pdf|udf|jpe?g|png|tiff?|docx?|txt|rtf|odt)$/i;

/** Tarayıcıda dosya ya da klasör seçtirir; dosyalar belleğe alınmaz, sırayla okunur (binlerce vekâletname için). */
function dosyalariSec(klasor: boolean): Promise<File[]> {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file"; input.multiple = true;
    if (klasor) (input as Any).webkitdirectory = true;
    else input.accept = ".pdf,.udf,.jpg,.jpeg,.png,.tif,.tiff,.doc,.docx,.txt,.rtf,.odt";
    input.style.display = "none";
    input.onchange = () => { const xs = [...(input.files || [])].filter(f => UZANTI.test(f.name)); input.remove(); resolve(xs); };
    document.body.appendChild(input); input.click();
  });
}

interface Okuma { toplam: number; i: number; ad: string; okunan: (OkunanVekalet & { dosya: File })[]; hata: string[] }

export function MuvekkillerSekmesi({ kartlar, dosyalar, onAc }: { kartlar: Foy[]; dosyalar: Foy[]; onAc: (id: string) => void }) {
  const web = Platform.OS === "web";
  const [ara, setAra] = useState("");
  const [sayfa, setSayfa] = useState(0);
  const [okuma, setOkuma] = useState<Okuma | null>(null);
  const [onizleme, setOnizleme] = useState<null | { yeni: Foy[]; guncel: Foy[]; okunamayan: string[]; dosyaHaritasi: Map<string, File>; cikar: Set<string> }>(null);
  const [kayit, setKayit] = useState("");
  const [bilgi, setBilgi] = useState("");
  const [tamamla, setTamamla] = useState<Foy[] | null>(null);
  const dur = useRef(false);

  const liste = useMemo(() => {
    const q = sadeAd(ara);
    const xs = q ? kartlar.filter(f => sadeAd([f.muvekkil, f.muvekkilBilgi?.kimlikNo, f.muvekkilBilgi?.adres].join(" ")).includes(q)) : kartlar;
    return [...xs].sort((a, b) => a.muvekkil.localeCompare(b.muvekkil, "tr"));
  }, [kartlar, ara]);
  const gorunen = liste.slice(sayfa * SAYFA, sayfa * SAYFA + SAYFA);
  const dosyaSayisi = useMemo(() => new Map(kartlar.map(k => [k.id, kartDosyalari(k, dosyalar).length])), [kartlar, dosyalar]);

  const yukle = async (klasor: boolean) => {
    const xs = await dosyalariSec(klasor);
    if (!xs.length) return;
    dur.current = false; setBilgi(""); setOnizleme(null);
    const o: Okuma = { toplam: xs.length, i: 0, ad: "", okunan: [], hata: [] };
    setOkuma({ ...o });
    for (const d of xs) {
      if (dur.current) break;
      o.i++; o.ad = d.name;
      if (o.i % 3 === 1 || xs.length < 50) setOkuma({ ...o });
      try {
        const bytes = new Uint8Array(await d.arrayBuffer());
        const r = await evrakMetniOku({ ad: d.name, bytes }, () => {});
        if ("hata" in r) { o.hata.push(d.name); continue; }
        if (!r.metin.trim()) { o.okunan.push({ kaynak: d.name, vekalet: vekaletOku(""), dosya: d }); continue; }
        o.okunan.push({ kaynak: d.name, vekalet: vekaletOku(r.metin), dosya: d, evrak: { id: yeniId("ev"), ad: d.name, boyut: d.size, eklenme: new Date().toISOString(), metin: r.metin.slice(0, 60000), tur: "Vekâletname", onemli: true } as FoyEvrak });
      } catch { o.hata.push(d.name); }
    }
    setOkuma(null);
    const r = vekaletlerdenKartlar(o.okunan, kartlar);
    const dosyaHaritasi = new Map(o.okunan.filter(x => x.evrak).map(x => [x.evrak!.id, x.dosya] as const));
    setOnizleme({ ...r, okunamayan: [...r.okunamayan, ...o.hata], dosyaHaritasi, cikar: new Set() });
  };

  const kaydet = async () => {
    if (!onizleme) return;
    const xs = [...onizleme.yeni.filter(f => !onizleme.cikar.has(f.id)), ...onizleme.guncel];
    try {
      // Vekâletname dosyalarının aslı cihazda saklanır.
      let n = 0;
      for (const f of xs) for (const e of f.evraklar) {
        const d = onizleme.dosyaHaritasi.get(e.id);
        if (d) { try { await dosyaYaz(e.id, d); } catch { /* metin yine durur */ } onizleme.dosyaHaritasi.delete(e.id); }
        if (++n % 50 === 0) setKayit(t("Vekâletnameler saklanıyor… {n}", { n }));
      }
      for (let i = 0; i < xs.length; i += 200) { setKayit(t("Kaydediliyor… {n} / {m}", { n: Math.min(i + 200, xs.length), m: xs.length })); await foylerKaydet(xs.slice(i, i + 200)); }
      setKayit(""); setOnizleme(null);
      setBilgi(t("{y} yeni müvekkil kaydedildi, {g} müvekkilin kartı güncellendi.", { y: onizleme.yeni.length - onizleme.cikar.size, g: onizleme.guncel.length }));
    } catch (e) { setKayit(""); setBilgi(t(String((e as Error).message || e))); }
  };

  if (okuma) return (
    <ScrollView contentContainerStyle={s.wrap}>
      <Text style={s.title}>{t("Vekâletnameler okunuyor")}</Text>
      <Text style={s.body}>{t("{i} / {n} · {ad}", { i: okuma.i, n: okuma.toplam, ad: okuma.ad })}</Text>
      <View style={{ height: 8, backgroundColor: C.panel2, borderRadius: 4, overflow: "hidden" }}><View style={{ height: 8, width: `${Math.round((okuma.i / okuma.toplam) * 100)}%`, backgroundColor: C.brass }} /></View>
      <Text style={s.hint}>{t("Okuma bu cihazda yapılır; taranmış vekâletnamelerde yazı tanıma biraz sürer. Sayfayı kapatmayın.")}</Text>
      <View style={s.row}><Btn kind="ghost" label={t("Durdur (okunanlarla devam et)")} onPress={() => { dur.current = true; }} /></View>
    </ScrollView>
  );

  if (onizleme) {
    const secili = onizleme.yeni.filter(f => !onizleme.cikar.has(f.id));
    const kontrol = onizleme.yeni.filter(f => !f.muvekkilBilgi?.kimlikNo || !f.muvekkilBilgi?.adres);
    return (
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>{t("Okuma bitti")}</Text>
        <View style={[s.card, { gap: 4 }]}>
          <Text style={s.body}>{t("Yeni müvekkil: {n}", { n: onizleme.yeni.length })}</Text>
          <Text style={s.body}>{t("Var olan kartla birleşecek: {n}", { n: onizleme.guncel.length })}</Text>
          <Text style={s.body}>{t("Kimlik no ya da adresi okunamayan (kontrol edin): {n}", { n: kontrol.length })}</Text>
          <Text style={[s.body, { color: onizleme.okunamayan.length ? C.bad : C.text }]}>{t("Vekil edeni okunamayan vekâletname: {n}", { n: onizleme.okunamayan.length })}</Text>
          {!!onizleme.okunamayan.length && <Text style={s.hint} numberOfLines={4}>{onizleme.okunamayan.slice(0, 30).join(", ")}{onizleme.okunamayan.length > 30 ? "…" : ""}</Text>}
        </View>
        <View style={[s.row, { gap: 8, flexWrap: "wrap" }]}>
          <Btn label={kayit || t("💾 Hepsini kaydet ({n})", { n: secili.length + onizleme.guncel.length })} disabled={!!kayit || !(secili.length + onizleme.guncel.length)} onPress={kaydet} />
          <Btn kind="ghost" label={t("Vazgeç (hiçbiri kaydedilmez)")} disabled={!!kayit} onPress={() => setOnizleme(null)} />
        </View>
        <Text style={s.secT}>{t("Yeni müvekkiller")}</Text>
        <Text style={s.hint}>{t("İstemediğinizi işaretten çıkarın. Bilgiler kaydettikten sonra kartta düzeltilebilir.")}</Text>
        {onizleme.yeni.slice(0, 300).map(f => {
          const cik = onizleme.cikar.has(f.id);
          const eksik = !f.muvekkilBilgi?.kimlikNo || !f.muvekkilBilgi?.adres;
          return (
            <Pressable key={f.id} onPress={() => setOnizleme(o => o && ({ ...o, cikar: new Set(cik ? [...o.cikar].filter(x => x !== f.id) : [...o.cikar, f.id]) }))}
              style={[s.foy, { opacity: cik ? 0.5 : 1, borderColor: eksik ? C.mid : C.line }]}>
              <Text style={{ fontSize: 18, color: cik ? C.muted : C.good }}>{cik ? "☐" : "☑"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.foyT} numberOfLines={1}>{f.muvekkil}</Text>
                <Text style={s.hint} numberOfLines={2}>{[f.muvekkilBilgi?.kimlikNo || t("kimlik no yok"), f.muvekkilBilgi?.adres || t("adres yok"), f.muvekkilBilgi?.vekaletname].filter(Boolean).join(" · ")}</Text>
              </View>
            </Pressable>
          );
        })}
        {onizleme.yeni.length > 300 && <Text style={s.hint}>{t("…ve {n} müvekkil daha (hepsi kaydedilir).", { n: onizleme.yeni.length - 300 })}</Text>}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
      <Text style={s.eyebrow}>{t("MÜVEKKİLLERİM")}</Text>
      <Text style={s.title}>{t("👤 Müvekkillerim ({n})", { n: kartlar.length })}</Text>
      <View style={[s.card, { gap: 8, borderColor: C.brass }]}>
        <Text style={s.cardT}>{t("📥 Vekâletnameleri toplu yükle")}</Text>
        <Text style={s.hint}>{t("Vekâletnameleri (PDF, UDF, fotoğraf, TIFF, Word) seçin ya da hepsinin bulunduğu klasörü seçin. Her biri bu cihazda okunur; vekil eden, kimlik no, adres, noterlik, yevmiye no, tarih, vekiller ve özel yetkiler çıkarılır. Her vekil eden için bir müvekkil kartı hazırlanır; siz “Hepsini kaydet” demeden kaydedilmez. Hiçbir bilgi dışarı gönderilmez.")}</Text>
        {web ? (
          <View style={[s.row, { gap: 8, flexWrap: "wrap" }]}>
            <Btn label={t("📄 Vekâletname dosyalarını seç")} onPress={() => yukle(false)} />
            <Btn kind="secondary" label={t("📁 Klasörü seç")} onPress={() => yukle(true)} />
          </View>
        ) : <Text style={s.hint}>{t("Toplu yükleme bilgisayarda (celse.themiscode.com) yapılır; kartlar telefona eşitlenir.")}</Text>}
        {!!bilgi && <Text style={[s.hint, { color: C.good }]}>{bilgi}</Text>}
      </View>

      {kartlar.length > 0 && (
        <View style={[s.card, { gap: 6 }]}>
          <Text style={s.secT}>{t("Dava dosyalarındaki eksik müvekkil bilgileri")}</Text>
          <Text style={s.hint}>{t("Föylerde müvekkilin kimlik no, adres ya da vekâletname alanı boşsa kartından doldurulur; yazılmış olan değişmez. Aynı adlı iki kart varsa adla eşleştirme yapılmaz.")}</Text>
          {!tamamla ? <View style={s.row}><Btn kind="secondary" label={t("🔁 Eksikleri bul")} onPress={() => setTamamla(dosyalariTamamla(kartlar, dosyalar))} /></View>
            : tamamla.length ? (
              <View style={[s.row, { gap: 8, flexWrap: "wrap", alignItems: "center" }]}>
                <Text style={s.body}>{t("{n} föyde eksik bilgi tamamlanacak.", { n: tamamla.length })}</Text>
                <Btn label={t("💾 Tamamla ve kaydet")} onPress={async () => { await foylerKaydet(tamamla); setBilgi(t("{n} föyün müvekkil bilgileri tamamlandı.", { n: tamamla.length })); setTamamla(null); }} />
                <Btn kind="ghost" label={t("Vazgeç")} onPress={() => setTamamla(null)} />
              </View>
            ) : <Text style={s.hint}>{t("Tamamlanacak eksik bilgi yok.")}</Text>}
        </View>
      )}

      {kartlar.length > 0 && <HizliGirdi value={ara} onChangeText={x => { setAra(x); setSayfa(0); }} placeholder={t("Müvekkil ara: ad, kimlik no, adres…")} placeholderTextColor={C.muted} style={s.inputTek} />}
      {gorunen.length > 0 && <Text style={s.hint}>{t("Silmek için satırı yana kaydırın (bilgisayarda uzun basın).")}</Text>}
      {gorunen.map(f => (
        <KaydirSil key={f.id} soru={t("“{ad}” müvekkil kartı silinsin mi? (Dava dosyaları silinmez.)", { ad: f.muvekkil })} onSil={async () => { await foySil(f); }}>
          {uzunBas => (
            <Pressable onPress={() => onAc(f.id)} onLongPress={uzunBas} delayLongPress={500} style={({ pressed }) => [s.foy, pressed && { opacity: 0.85 }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.foyT} numberOfLines={1}>{f.muvekkil || t("(adsız)")}</Text>
                <Text style={s.hint} numberOfLines={1}>{[f.muvekkilBilgi?.kimlikNo, f.muvekkilBilgi?.vekaletname, dosyaSayisi.get(f.id) ? t("{n} dosya", { n: dosyaSayisi.get(f.id) || 0 }) : ""].filter(Boolean).join(" · ")}</Text>
              </View>
              <Text style={s.link}>{t("Aç ›")}</Text>
            </Pressable>
          )}
        </KaydirSil>
      ))}
      {liste.length > SAYFA && (
        <View style={[s.row, { gap: 8, alignItems: "center" }]}>
          <Btn kind="ghost" label="‹" disabled={!sayfa} onPress={() => setSayfa(sayfa - 1)} />
          <Text style={s.hint}>{t("{a}–{b} / {n}", { a: sayfa * SAYFA + 1, b: Math.min(liste.length, sayfa * SAYFA + SAYFA), n: liste.length })}</Text>
          <Btn kind="ghost" label="›" disabled={(sayfa + 1) * SAYFA >= liste.length} onPress={() => setSayfa(sayfa + 1)} />
        </View>
      )}
      {!kartlar.length && <Text style={s.hint}>{t("Henüz müvekkil kartı yok. Vekâletnameleri yükleyin.")}</Text>}
    </ScrollView>
  );
}

/** Müvekkil kartı: bilgiler düzeltilir (💾 Kaydet ile), vekâletnameler indirilir, müvekkilin dava dosyaları açılır. */
export function MuvekkilKarti({ kart, dosyalar, onKapat, onDosyaAc }: { kart: Foy; dosyalar: Foy[]; onKapat: () => void; onDosyaAc: (id: string) => void }) {
  const [f, setF] = useState(kart);
  const [degisti, setDegisti] = useState(false);
  const [bilgi, setBilgi] = useState("");
  const [silOnay, setSilOnay] = useState(false);
  const mb = f.muvekkilBilgi || {};
  const yaz = (ek: Partial<Foy>) => { setF(x => ({ ...x, ...ek })); setDegisti(true); setBilgi(""); };
  const yazB = (k: keyof NonNullable<Foy["muvekkilBilgi"]>, v: string) => yaz({ muvekkilBilgi: { ...(f.muvekkilBilgi || {}), [k]: v } });
  const davalar = useMemo(() => kartDosyalari(f, dosyalar), [f, dosyalar]);
  const alan = (etiket: string, deger: string, deg: (v: string) => void, cok = false) => (
    <View style={{ gap: 4 }}>
      <Text style={s.label}>{t(etiket)}</Text>
      <TextInput defaultValue={deger} onChangeText={deg} multiline={cok} placeholderTextColor={C.muted} style={cok ? [s.input, { minHeight: 60 }] : s.inputTek} />
    </View>
  );
  const kaydet = async () => { await foyKaydet({ ...f, guncelleme: new Date().toISOString() }); setDegisti(false); setBilgi(t("Kaydedildi.")); };
  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
      <View style={[s.head, { gap: 8 }]}>
        <Btn kind="ghost" label={t("‹ Müvekkillerim")} onPress={onKapat} />
      </View>
      <Text style={s.eyebrow}>{t("MÜVEKKİL KARTI")}</Text>
      <Text style={s.title}>{f.muvekkil || t("(adsız)")}</Text>
      <View style={[s.card, { gap: 8 }]}>
        {alan("Ad soyad / unvan", f.muvekkil, v => yaz({ muvekkil: v }))}
        {alan("T.C. kimlik no / vergi no", mb.kimlikNo || "", v => yazB("kimlikNo", v.replace(/\D/g, "")))}
        {alan("Telefon", mb.telefon || "", v => yazB("telefon", v))}
        {alan("E-posta", mb.eposta || "", v => yazB("eposta", v))}
        {alan("Adres", mb.adres || "", v => yazB("adres", v), true)}
        {alan("Vekâletname (noterlik, tarih, yevmiye no)", mb.vekaletname || "", v => yazB("vekaletname", v))}
        {alan("Vekiller", mb.vekil || "", v => yazB("vekil", v))}
        {alan("Kapsam ve özel yetkiler", mb.ek || "", v => yazB("ek", v), true)}
        {alan("Not", f.notlar || "", v => yaz({ notlar: v }), true)}
        <View style={[s.row, { gap: 8, alignItems: "center" }]}>
          <Btn label={t("💾 Kaydet")} disabled={!degisti} onPress={kaydet} />
          <Text style={[s.hint, { color: bilgi ? C.good : C.muted }]}>{bilgi || (degisti ? t("Değişiklik var; “💾 Kaydet”e basın.") : "")}</Text>
        </View>
      </View>

      <Text style={s.secT}>{t("Vekâletnameler ({n})", { n: f.evraklar.length })}</Text>
      {f.evraklar.map(e => (
        <View key={e.id} style={[s.foy, { gap: 8 }]}>
          <Text style={[s.body, { flex: 1 }]} numberOfLines={1}>{e.ad}</Text>
          <Pressable onPress={async () => { const b = await dosyaOku(e.id); if (b) indir(e.ad, b); else setBilgi(t("Bu dosyanın aslı bu cihazda yok.")); }}><Text style={s.link}>{t("İndir")}</Text></Pressable>
        </View>
      ))}

      <Text style={s.secT}>{t("Dava dosyaları ({n})", { n: davalar.length })}</Text>
      {davalar.map(d => (
        <Pressable key={d.id} onPress={() => onDosyaAc(d.id)} style={({ pressed }) => [s.foy, pressed && { opacity: 0.85 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.foyT} numberOfLines={1}>{[d.foyNo, foyBaslik(d)].filter(Boolean).join(" · ")}</Text>
            <Text style={s.hint} numberOfLines={1}>{[t(turBilgi(d.tur).ad), d.mahkeme, d.esasNo].filter(Boolean).join(" · ")}</Text>
          </View>
          <Text style={s.link}>{t("Aç ›")}</Text>
        </Pressable>
      ))}
      {!davalar.length && <Text style={s.hint}>{t("Bu müvekkilin adıyla ya da kimlik no'suyla açılmış dava dosyası yok.")}</Text>}

      <View style={[s.row, { gap: 8, marginTop: 12 }]}>
        {!silOnay ? <Btn kind="ghost" label={t("Müvekkil kartını sil")} onPress={() => setSilOnay(true)} />
          : <><Text style={[s.err, { alignSelf: "center" }]}>{t("Emin misiniz? Kart ve vekâletname dosyaları silinir; dava dosyaları silinmez.")}</Text>
            <Btn kind="ghost" label={t("Evet, sil")} onPress={async () => { await foySil(f); onKapat(); }} />
            <Btn kind="ghost" label={t("Vazgeç")} onPress={() => setSilOnay(false)} /></>}
      </View>
    </ScrollView>
  );
}
