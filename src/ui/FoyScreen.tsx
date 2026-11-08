// Dava takibi: föy listesi (türe göre), yeni giriş menüsü (dava, suç duyurusu, arabuluculuk, idari başvuru, icra, sözleşme…),
// yaklaşan duruşma ve işler, kilitli özel dosyalar, DavaTek klasörü, Excel/Word'den toplu föy, yedek.
// Her şey bu cihazda (src/data/foy.ts); yapay zekâya yalnız kodlanmış metin gider. Föy sayfası: FoySayfa.tsx.
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { bosFoy, Foy, foyBaslik, foyDinle, foyKaydet, foyler as foyListesi, foylerKaydet, kacGun, ozelAc, ozelKilitDurumu, ozelKilitKur, ozelKilitle, ozelSayisi, tarihYaz, yedekMetni, yedektenYukle } from "../data/foy";
import { AktarimSonucu, birlestir, tabloOku, tablodanFoyler } from "../data/foyAktar";
import { DAVA_TURLERI, FoyTur, Giris, GIRISLER, turBilgi, TURLER } from "../data/foyTurleri";
import { useInnerBack } from "./innerBack";
import { FoySayfa } from "./FoySayfa";
import { evrakOlustur } from "./foyEvrak";
import { gorulduYaz, klasorBilgisi, klasorDestekli, klasorSec, klasorTara, TaramaDosyasi } from "./foyKlasor";
import { dosyaSec, gunYaz, indir, s } from "./foyStil";
import { FoyBulutKart } from "./FoyBulutKart";
import { Btn } from "./kit";
import { t } from "../i18n";
import { C } from "./theme";

type Secili = { id: string; ekle?: string };

export default function FoyScreen(p: { onBack: () => void; onHazirlan: (f: Foy) => void; ucretsiz?: boolean }) {
  const [liste, setListe] = useState<Foy[]>([]);
  const [yuklendi, setYuklendi] = useState(false);
  const [secili, setSecili] = useState<Secili | null>(null);
  const [aktar, setAktar] = useState(false);
  const [giris, setGiris] = useState(false);
  const [ara, setAra] = useState("");
  const [filtre, setFiltre] = useState<"acik" | "kapali" | "hepsi">("acik");
  const [turF, setTurF] = useState<FoyTur | "hepsi">("hepsi");
  const [mesaj, setMesaj] = useState<{ t: string; ok?: boolean } | null>(null);
  const [kilit, setKilit] = useState<"yok" | "kilitli" | "acik">("yok");
  const [ozelN, setOzelN] = useState(0);
  const [kilitSor, setKilitSor] = useState<null | { sonra?: () => void }>(null);
  const yenile = () => {
    foyListesi().then(x => { setListe(x); setYuklendi(true); }).catch(() => setYuklendi(true));
    ozelKilitDurumu().then(setKilit).catch(() => {});
    ozelSayisi().then(setOzelN).catch(() => {});
  };
  useEffect(() => { yenile(); return foyDinle(yenile); }, []);
  useInnerBack(!!secili || aktar || giris || !!kilitSor, () => { setSecili(null); setAktar(false); setGiris(false); setKilitSor(null); });

  // Telefonda: föyler uygulamanın deposunda; evrak ekleme, toplu aktarma, DavaTek klasörü ve yedek dosyası bilgisayardadır.
  const web = Platform.OS === "web";
  if (kilitSor) return <OzelKilit durum={kilit} onKapat={() => setKilitSor(null)} onAcildi={() => { const f = kilitSor.sonra; setKilitSor(null); yenile(); f?.(); }} />;
  if (aktar) return <Aktar mevcut={liste} onBitti={(n) => { setAktar(false); if (n) setMesaj({ t: n, ok: true }); }} />;
  if (secili) return <FoySayfa key={secili.id} id={secili.id} ekle={secili.ekle} liste={liste} onKapat={() => setSecili(null)} onAc={id => setSecili({ id })} onHazirlan={p.onHazirlan} ucretsiz={p.ucretsiz} />;

  const yeniFoy = async (tur: FoyTur, ek: { ozel?: boolean; davaTuru?: string } = {}) => {
    const olustur = async () => { const f = bosFoy({ tur, ozel: !!ek.ozel, davaTuru: ek.davaTuru || "" }); await foyKaydet(f); setGiris(false); setSecili({ id: f.id }); };
    if (ek.ozel && (await ozelKilitDurumu()) !== "acik") { setKilitSor({ sonra: olustur }); return; }
    await olustur();
  };
  if (giris) return <GirisMenu liste={liste} onKapat={() => setGiris(false)} onSec={yeniFoy} onEvraka={(id, tur) => { setGiris(false); setSecili({ id, ekle: tur }); }} />;

  const q = ara.trim().toLocaleLowerCase("tr");
  const byId = new Map(liste.map(f => [f.id, f] as const));
  const gorunen = liste
    .filter(f => filtre === "hepsi" || f.durum === filtre)
    .filter(f => turF === "hepsi" || (f.tur || "hukuk") === turF)
    .filter(f => !q || [f.muvekkil, f.karsiTaraf, f.mahkeme, f.esasNo, f.davaTuru, f.notlar, turBilgi(f.tur).ad].join(" ").toLocaleLowerCase("tr").includes(q))
    .sort((a, b) => (a.durusma || "9999").localeCompare(b.durusma || "9999") || b.guncelleme.localeCompare(a.guncelleme));
  const turlerVar = TURLER.filter(x => liste.some(f => (f.tur || "hukuk") === x.tur));
  // Yaklaşanlar: önümüzdeki 14 gün (ve geçmiş ama tamamlanmamış işler).
  const yaklasan: { f: Foy; tur: "durusma" | "gorev"; metin: string; tarih: string; gun: number }[] = [];
  for (const f of liste.filter(x => x.durum === "acik")) {
    const g = kacGun(f.durusma);
    if (f.durusma && g !== undefined && g >= 0 && g <= 14) yaklasan.push({ f, tur: "durusma", metin: t("Duruşma"), tarih: f.durusma, gun: g });
    for (const x of f.gorevler) {
      const gg = kacGun(x.tarih);
      if (!x.bitti && x.tarih && gg !== undefined && gg <= 14) yaklasan.push({ f, tur: "gorev", metin: x.metin, tarih: x.tarih, gun: gg });
    }
  }
  yaklasan.sort((a, b) => a.tarih.localeCompare(b.tarih));

  const yedekAl = async () => indir("celse-foyler-" + new Date().toISOString().slice(0, 10) + ".json", new Blob([await yedekMetni()], { type: "application/json" }));
  const yedekYukle = async () => {
    const [k] = await dosyaSec(".json", false);
    if (!k) return;
    try { const n = await yedektenYukle(new TextDecoder().decode(k.bytes)); setMesaj({ t: t("{n} föy yedekten yüklendi.", { n }), ok: true }); }
    catch (e) { setMesaj({ t: t(String((e as Error).message || e)) }); }
  };

  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
      <View style={s.head}><Btn kind="ghost" label={t("‹ Geri")} onPress={p.onBack} /></View>
      <Text style={s.eyebrow}>{t("DAVA TAKİBİ · CELSE AVUKAT")}</Text>
      <Text style={s.title}>{t("Föylerim")}</Text>
      <View style={s.warn}>
        <Text style={s.warnT}>{web ? t("Föyleriniz bu cihazda saklanır.") : t("Föyleriniz bu telefonda saklanır.")}</Text>
        <Text style={s.warnD}>{t("Yapay zekâya yalnız cihazda kodlanmış metin gönderilir ve kaydedilmez. Bulut eşitlemesini açarsanız föyler bu cihazda şifrelenip diğer cihazlarınıza gider; sunucu içeriği okuyamaz. Eşitleme kapalıysa cihaz değişince ya da tarayıcı verisi silinince föyler kaybolur; yedek alın.")}</Text>
        {web && <View style={s.row}>
          <Btn kind="ghost" label={t("Yedeği indir")} onPress={yedekAl} />
          <Btn kind="ghost" label={t("Yedekten yükle")} onPress={yedekYukle} />
        </View>}
      </View>

      <View style={s.row}>
        <Btn label={t("+ Yeni giriş")} onPress={() => setGiris(true)} />
        {web && <Btn kind="secondary" label={t("Excel ya da Word'den toplu ekle")} onPress={() => setAktar(true)} />}
      </View>
      {mesaj && <Text style={[s.hint, { color: mesaj.ok ? C.good : C.bad }]}>{mesaj.t}</Text>}

      <FoyBulutKart />
      {web && <KlasorKart liste={liste} onBilgi={m => setMesaj(m)} />}

      <View style={[s.card, { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }]}>
        <Text style={[s.body, { flex: 1 }]}>{kilit === "yok" ? t("🔒 Şahsi dosyalarınız (kendi davalarınız, soruşturmalarınız) ayrı şifreyle kilitli ve şifreli saklanabilir.")
          : kilit === "acik" ? t("🔓 Şahsi dosyalar açık ({n}). 15 dakika kullanılmazsa kendiliğinden kilitlenir.", { n: ozelN }) : t("🔒 Şahsi dosyalar kilitli ({n}).", { n: ozelN })}</Text>
        {kilit === "acik" ? <Btn kind="ghost" label={t("Kilitle")} onPress={ozelKilitle} />
          : <Btn kind="secondary" label={kilit === "yok" ? t("Şifre kur") : t("Şifreyle aç")} onPress={() => setKilitSor({})} />}
      </View>

      {yaklasan.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardT}>{t("Yaklaşanlar (14 gün)")}</Text>
          {yaklasan.slice(0, 20).map((y, i) => (
            <Pressable key={i} onPress={() => setSecili({ id: y.f.id })} style={({ pressed }) => [s.yak, pressed && { opacity: 0.8 }]}>
              <Text style={[s.yakTarih, y.gun < 0 && { color: C.bad }, y.gun <= 2 && y.gun >= 0 && { color: C.brass }]}>{tarihYaz(y.tarih)}{"\n"}<Text style={s.hint}>{gunYaz(y.gun)}</Text></Text>
              <View style={{ flex: 1 }}>
                <Text style={s.fileT}>{y.tur === "durusma" ? "⚖ " : "☐ "}{y.metin}</Text>
                <Text style={s.hint} numberOfLines={1}>{foyBaslik(y.f)} · {y.f.mahkeme} {y.f.esasNo}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <View style={s.card}>
        <TextInput value={ara} onChangeText={setAra} placeholder={t("Ara: müvekkil, karşı taraf, mahkeme, esas no…")} placeholderTextColor={C.muted} style={s.inputTek} />
        <View style={s.chips}>
          {(["acik", "kapali", "hepsi"] as const).map(k => (
            <Pressable key={k} onPress={() => setFiltre(k)} style={[s.chip, filtre === k && s.chipOn]}>
              <Text style={[s.chipT, filtre === k && s.chipTOn]}>{k === "acik" ? t("Açık") : k === "kapali" ? t("Kapalı") : t("Hepsi")} ({liste.filter(f => k === "hepsi" || f.durum === k).length})</Text>
            </Pressable>
          ))}
        </View>
        {turlerVar.length > 1 && (
          <View style={s.chips}>
            <Pressable onPress={() => setTurF("hepsi")} style={[s.chip, turF === "hepsi" && s.chipOn]}><Text style={[s.chipT, turF === "hepsi" && s.chipTOn]}>{t("Bütün türler")}</Text></Pressable>
            {turlerVar.map(x => (
              <Pressable key={x.tur} onPress={() => setTurF(x.tur)} style={[s.chip, turF === x.tur && s.chipOn]}>
                <Text style={[s.chipT, turF === x.tur && s.chipTOn]}>{t(x.ad)} ({liste.filter(f => (f.tur || "hukuk") === x.tur).length})</Text>
              </Pressable>
            ))}
          </View>
        )}
        {yuklendi && liste.length === 0 && <Text style={s.body}>{t("Henüz föy yok. “+ Yeni giriş” ile ekleyin ya da dosya listenizi Excel veya Word tablosundan toplu olarak aktarın.")}</Text>}
        {gorunen.map(f => {
          const g = kacGun(f.durusma);
          const acikGorev = f.gorevler.filter(x => !x.bitti).length;
          const once = f.oncekiId ? byId.get(f.oncekiId) : undefined;
          const tb = turBilgi(f.tur);
          return (
            <Pressable key={f.id} onPress={() => setSecili({ id: f.id })} style={({ pressed }) => [s.foy, pressed && { opacity: 0.85 }]}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[s.turChip, f.ozel && s.ozelChip]}>{f.ozel ? "🔒 " : ""}{tb.kisa}{f.asama ? " · " + f.asama.toLocaleUpperCase("tr") : ""}</Text>
                <Text style={s.foyT} numberOfLines={1}>{foyBaslik(f)}</Text>
                <Text style={s.hint} numberOfLines={1}>{[f.mahkeme, f.esasNo, f.davaTuru].filter(Boolean).join(" · ") || t("Merci ve numara yazılmamış")}</Text>
                {!!once && <Text style={s.hint} numberOfLines={1}>↳ {t("{tur} {no} dosyasının devamı", { tur: turBilgi(once.tur).ad, no: once.esasNo || "" })}</Text>}
                <Text style={s.meta}>{[t("{n} EVRAK", { n: f.evraklar.length }), acikGorev ? t("{n} AÇIK İŞ", { n: acikGorev }) : ""].filter(Boolean).join(" · ")}</Text>
              </View>
              {!!f.durusma && <Text style={[s.foyD, g !== undefined && g >= 0 && g <= 7 && { color: C.brass }]}>{tarihYaz(f.durusma)}{"\n"}<Text style={s.hint}>{gunYaz(g)}</Text></Text>}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

/* ---------- yeni giriş menüsü ---------- */
function GirisMenu({ liste, onKapat, onSec, onEvraka }: { liste: Foy[]; onKapat: () => void; onSec: (t: FoyTur, ek: { ozel?: boolean; davaTuru?: string }) => void; onEvraka: (id: string, tur: string) => void }) {
  const [alt, setAlt] = useState<Giris | null>(null);
  const [ara, setAra] = useState("");
  // Şahsi dosya: avukatın kendi dosyası (her türden olabilir); ayrı şifreyle kilitli ve şifreli saklanır.
  const [sahsi, setSahsi] = useState(false);
  // "Hangi dava": türün alt listesi (boşanma, işe iade, hekim disiplin soruşturması…). Seçilen föyde "Konu" olur.
  const [altTur, setAltTur] = useState<FoyTur | null>(null);
  const [kendi, setKendi] = useState("");
  const sec = (tur: FoyTur) => (DAVA_TURLERI[tur]?.length ? setAltTur(tur) : onSec(tur, { ozel: sahsi }));
  const sahsiKart = (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: sahsi }} onPress={() => setSahsi(!sahsi)} style={[s.girisK, { width: "100%", flexGrow: 0, flexBasis: "auto", flexDirection: "row", alignItems: "center", gap: 12 }, sahsi && { borderColor: C.mid, backgroundColor: C.panel2 }]}>
      <Text style={{ fontSize: 22 }}>{sahsi ? "🔒" : "🔓"}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.girisT}>{sahsi ? t("Şahsi dosyam olarak açılacak") : t("Şahsi dosyam mı?")}</Text>
        <Text style={s.hint}>{t("Kendi davanız, soruşturmanız ya da başvurunuz (boşanma, kira, ücret alacağı, ceza, baro, disiplin…) her türde şahsi dosya olabilir: ayrı şifreyle kilitli ve şifreli saklanır, büro föyleriyle karışmaz.")}</Text>
      </View>
      <Text style={[s.girisT, { color: sahsi ? C.mid : C.muted }]}>{sahsi ? t("AÇIK") : t("KAPALI")}</Text>
    </Pressable>
  );
  if (altTur) {
    const tb = turBilgi(altTur);
    return (
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <View style={s.head}><Btn kind="ghost" label={t("‹ Geri")} onPress={() => setAltTur(null)} /></View>
        <Text style={s.eyebrow}>{(sahsi ? t("ŞAHSİ · ") : "") + tb.kisa}</Text>
        <Text style={s.title}>{altTur === "idari_sorusturma" || altTur === "baro" || altTur === "sorusturma" ? t("Hangi soruşturma?") : t("Hangi dava?")}</Text>
        <View style={s.grid}>
          {DAVA_TURLERI[altTur]!.map(x => (
            <Pressable key={x} onPress={() => onSec(altTur, { ozel: sahsi, davaTuru: x })} style={({ pressed }) => [s.girisK, pressed && { opacity: 0.85 }]}>
              <Text style={s.girisT}>{t(x)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.label}>{t("Listede yoksa kendiniz yazın")}</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <TextInput value={kendi} onChangeText={setKendi} placeholder={t("Örn. ecrimisil, önalım, haksız rekabet…")} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1, minWidth: 220 }]} onSubmitEditing={() => kendi.trim() && onSec(altTur, { ozel: sahsi, davaTuru: kendi.trim() })} />
          <Btn label={kendi.trim() ? t("Bununla aç") : t("Konuyu sonra yazarım")} onPress={() => onSec(altTur, { ozel: sahsi, davaTuru: kendi.trim() })} />
        </View>
      </ScrollView>
    );
  }
  if (alt?.evrakaEkle) {
    const q = ara.trim().toLocaleLowerCase("tr");
    const xs = liste.filter(f => !q || [f.muvekkil, f.karsiTaraf, f.mahkeme, f.esasNo].join(" ").toLocaleLowerCase("tr").includes(q)).slice(0, 30);
    return (
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <View style={s.head}><Btn kind="ghost" label={t("‹ Geri")} onPress={() => setAlt(null)} /></View>
        <Text style={s.title}>{t("{tur} hangi föye?", { tur: t(alt.evrakaEkle) })}</Text>
        <TextInput value={ara} onChangeText={setAra} placeholder={t("Ara: müvekkil, karşı taraf, esas no…")} placeholderTextColor={C.muted} style={s.inputTek} />
        {xs.map(f => (
          <Pressable key={f.id} onPress={() => onEvraka(f.id, alt.evrakaEkle!)} style={s.foy}>
            <View style={{ flex: 1 }}>
              <Text style={s.turChip}>{turBilgi(f.tur).kisa}</Text>
              <Text style={s.foyT} numberOfLines={1}>{foyBaslik(f)}</Text>
              <Text style={s.hint} numberOfLines={1}>{[f.mahkeme, f.esasNo].filter(Boolean).join(" · ")}</Text>
            </View>
          </Pressable>
        ))}
        {!liste.length && <Text style={s.body}>{t("Önce bir föy oluşturun.")}</Text>}
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={s.head}><Btn kind="ghost" label={t("‹ Föylere dön")} onPress={alt ? () => setAlt(null) : onKapat} /></View>
      <Text style={s.eyebrow}>{t("YENİ GİRİŞ")}</Text>
      <Text style={s.title}>{alt ? t(alt.ad) : t("Ne ile başlıyorsunuz?")}</Text>
      {!alt && <Text style={s.hint}>{t("Dosyalar sonradan birbirine bağlanabilir: suç duyurusu ceza davasına, arabuluculuk hukuk davasına, idari başvuru idari davaya dönüştüğünde föyün içinden “Devamını aç” deyin.")}</Text>}
      {sahsiKart}
      <View style={s.grid}>
        {(alt?.secenek ? alt.secenek.map(x => ({ ad: turBilgi(x).ad, aciklama: turBilgi(x).aciklama, tur: x } as Giris)) : GIRISLER)
          .filter(g => !(sahsi && g.evrakaEkle)).map(g => (
            <Pressable key={g.ad} onPress={() => (g.tur ? sec(g.tur) : setAlt(g))} style={({ pressed }) => [s.girisK, sahsi && { borderColor: C.mid }, pressed && { opacity: 0.85 }]}>
              <Text style={s.girisT}>{sahsi ? "🔒 " : ""}{t(g.ad)}</Text>
              <Text style={s.hint}>{t(g.aciklama)}</Text>
            </Pressable>
          ))}
      </View>
    </ScrollView>
  );
}

/* ---------- özel dosya kilidi ---------- */
function OzelKilit({ durum, onKapat, onAcildi }: { durum: "yok" | "kilitli" | "acik"; onKapat: () => void; onAcildi: () => void }) {
  const [a, setA] = useState(""), [b, setB] = useState("");
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const kur = durum === "yok";
  const git = async () => {
    setErr("");
    if (kur && a !== b) { setErr(t("Şifreler aynı değil.")); return; }
    setBusy(true);
    try {
      if (kur) { await ozelKilitKur(a); onAcildi(); }
      else if (await ozelAc(a)) onAcildi();
      else setErr(t("Şifre yanlış."));
    } catch (e) { setErr(t(String((e as Error).message || e))); }
    setBusy(false);
  };
  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
      <View style={s.head}><Btn kind="ghost" label={t("‹ Vazgeç")} onPress={onKapat} /></View>
      <Text style={s.eyebrow}>{t("ÖZEL DOSYALAR")}</Text>
      <Text style={s.title}>{kur ? t("Özel dosya şifresi belirleyin") : t("Özel dosyaları açın")}</Text>
      <View style={s.card}>
        <Text style={s.body}>{kur
          ? t("Kişisel ceza soruşturmaları ve baro soruşturmaları bu şifreden türetilen anahtarla şifrelenip saklanır. Şifre hiçbir yere kaydedilmez; unutursanız bu dosyalar açılamaz. En az 6 karakter.")
          : t("Özel dosyalar şifreli. Açmak için şifrenizi girin; 15 dakika kullanılmazsa yeniden kilitlenir.")}</Text>
        <TextInput value={a} onChangeText={setA} secureTextEntry placeholder={t("Şifre")} placeholderTextColor={C.muted} style={s.inputTek} onSubmitEditing={kur ? undefined : git} autoFocus />
        {kur && <TextInput value={b} onChangeText={setB} secureTextEntry placeholder={t("Şifre (tekrar)")} placeholderTextColor={C.muted} style={s.inputTek} onSubmitEditing={git} />}
        {!!err && <Text style={s.err}>{err}</Text>}
        <View style={s.row}><Btn label={busy ? t("Bekleyin…") : kur ? t("Şifreyi kur ve aç") : t("Aç")} onPress={git} disabled={busy || !a} /></View>
      </View>
    </ScrollView>
  );
}

/* ---------- DavaTek klasörü ---------- */
function KlasorKart({ liste, onBilgi }: { liste: Foy[]; onBilgi: (m: { t: string; ok?: boolean }) => void }) {
  const [bilgi, setBilgi] = useState<{ ad: string; izin: string } | null>(null);
  const [ilerleme, setIlerleme] = useState("");
  const [bekleyen, setBekleyen] = useState<TaramaDosyasi[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { klasorBilgisi().then(setBilgi).catch(() => {}); }, []);
  const byId = useMemo(() => new Map(liste.map(f => [f.id, f] as const)), [liste]);
  if (!klasorDestekli()) return null;

  const ekle = async (xs: { d: TaramaDosyasi; foyId: string }[]) => {
    const gruplar = new Map<string, TaramaDosyasi[]>();
    for (const x of xs) gruplar.set(x.foyId, [...(gruplar.get(x.foyId) || []), x.d]);
    for (const [id, ds] of gruplar) {
      const f = byId.get(id);
      if (!f) continue;
      const evraklar = [...f.evraklar];
      for (const d of ds) evraklar.push(await evrakOlustur(f, d.kaynak, { metin: d.metin, okunamadi: d.okunamadi }));
      await foyKaydet({ ...f, evraklar });
    }
    await gorulduYaz(xs.map(x => x.d.anahtar));
  };
  const tara = async () => {
    setBusy(true); setBekleyen([]);
    try {
      const sonuc = await klasorTara(liste, setIlerleme);
      const eslesen = sonuc.filter(d => d.foyId).map(d => ({ d, foyId: d.foyId! }));
      await ekle(eslesen);
      const kalan = sonuc.filter(d => !d.foyId);
      setBekleyen(kalan);
      onBilgi({ t: sonuc.length ? t("{n} yeni dosya bulundu: {e} tanesi föyüne eklendi, {k} tanesi için föy seçmeniz gerekiyor.", { n: sonuc.length, e: eslesen.length, k: kalan.length }) : t("Klasörde yeni dosya yok."), ok: true });
    } catch (e) { onBilgi({ t: t(String((e as Error).message || e)) }); }
    setIlerleme(""); setBusy(false);
    klasorBilgisi().then(setBilgi).catch(() => {});
  };
  return (
    <View style={s.card}>
      <Text style={s.cardT}>{t("DavaTek klasörü")}</Text>
      <Text style={s.hint}>{t("DavaTek'in evrak indirdiği klasörü bir kez seçin. “Yeni evrakı al” dediğinizde Celse klasördeki yeni dosyaları okur, esas ya da dosya numarasından föyünü bulup ekler. Dosyalar bu bilgisayardan çıkmaz.")}</Text>
      <View style={s.row}>
        {bilgi ? <Btn label={busy ? t("Okunuyor…") : t("Yeni evrakı al")} onPress={tara} disabled={busy} /> : null}
        <Btn kind={bilgi ? "ghost" : "secondary"} label={bilgi ? t("Klasörü değiştir ({ad})", { ad: bilgi.ad }) : t("Klasörü seç")} onPress={async () => { const ad = await klasorSec(); if (ad) setBilgi({ ad, izin: "granted" }); }} disabled={busy} />
      </View>
      {!!ilerleme && <Text style={s.hint}>{ilerleme}</Text>}
      {bekleyen.map(d => (
        <View key={d.anahtar} style={[s.file, { flexWrap: "wrap" }]}>
          <View style={{ flex: 1, minWidth: 200 }}>
            <Text style={s.fileT} numberOfLines={1}>{d.kaynak.ad}</Text>
            <Text style={s.hint} numberOfLines={1}>{d.kaynak.yol} · {t(d.neden || "")}</Text>
          </View>
          <FoySecici liste={liste} onSec={async id => { await ekle([{ d, foyId: id }]); setBekleyen(xs => xs.filter(x => x !== d)); }} />
          <Pressable onPress={async () => { await gorulduYaz([d.anahtar]); setBekleyen(xs => xs.filter(x => x !== d)); }}><Text style={s.sil}>{t("Atla")}</Text></Pressable>
        </View>
      ))}
    </View>
  );
}
function FoySecici({ liste, onSec }: { liste: Foy[]; onSec: (id: string) => void }) {
  const [ac, setAc] = useState(false);
  const [q, setQ] = useState("");
  if (!ac) return <Pressable onPress={() => setAc(true)}><Text style={s.link}>{t("Föy seç")}</Text></Pressable>;
  const xs = liste.filter(f => { const k = q.trim().toLocaleLowerCase("tr"); return !k || [f.muvekkil, f.karsiTaraf, f.mahkeme, f.esasNo].join(" ").toLocaleLowerCase("tr").includes(k); }).slice(0, 8);
  return (
    <View style={{ width: "100%", gap: 4 }}>
      <TextInput value={q} onChangeText={setQ} placeholder={t("Ara…")} placeholderTextColor={C.muted} style={s.inputTek} autoFocus />
      {xs.map(f => <Pressable key={f.id} onPress={() => onSec(f.id)}><Text style={s.link}>{foyBaslik(f)} · {f.esasNo}</Text></Pressable>)}
    </View>
  );
}

/* ---------- toplu aktarma ---------- */
function Aktar({ mevcut, onBitti }: { mevcut: Foy[]; onBitti: (mesaj?: string) => void }) {
  const [sonuc, setSonuc] = useState<(AktarimSonucu & { ad: string }) | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const sec = async () => {
    setErr("");
    const [k] = await dosyaSec(".xlsx,.xlsm,.csv,.docx,.xls,.doc", false);
    if (!k) return;
    try { setSonuc({ ...tablodanFoyler(tabloOku(k.ad, k.bytes)), ad: k.ad }); } catch (e) { setSonuc(null); setErr(t(String((e as Error).message || e))); }
  };
  const ayrim = useMemo(() => (sonuc ? birlestir(mevcut, sonuc.foyler) : null), [sonuc, mevcut]);
  const kaydet = async () => {
    if (!ayrim) return;
    setBusy(true);
    await foylerKaydet([...ayrim.yeni, ...ayrim.guncellenen]);
    setBusy(false);
    onBitti(t("{y} yeni föy oluşturuldu, {g} föy güncellendi.", { y: ayrim.yeni.length, g: ayrim.guncellenen.length }));
  };
  const ALAN: Record<string, string> = { muvekkil: "Müvekkil", karsiTaraf: "Karşı taraf", davaci: "Davacı", davali: "Davalı", mahkeme: "Mahkeme", esasNo: "Esas no", davaTuru: "Dava türü", taraf: "Sıfatımız", durusma: "Duruşma tarihi", notlar: "Not", gorev: "Yapılacak", durum: "Durum" };
  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={s.head}><Btn kind="ghost" label={t("‹ Föylere dön")} onPress={() => onBitti()} /></View>
      <Text style={s.title}>{t("Toplu föy ekle")}</Text>
      <View style={s.card}>
        <Text style={s.body}>{t("Dosya listenizi Excel (.xlsx, .csv) ya da Word (.docx) tablosu olarak yükleyin. İlk satır başlık olsun; her satır bir föy olur. Başlık adları serbesttir: Müvekkil, Karşı taraf (ya da Davacı ve Davalı), Sıfatımız, Mahkeme, Esas no, Dava türü, Duruşma tarihi, Yapılacak, Not, Durum.")}</Text>
        <Text style={s.hint}>{t("Aynı mahkeme ve esas numaralı föy zaten varsa çift föy oluşmaz, var olan güncellenir. Dosya bilgisayarınızda okunur; hiçbir yere gönderilmez.")}</Text>
        <View style={s.row}>
          <Btn label={t("Dosya seç")} onPress={sec} />
          <Btn kind="ghost" label={t("Örnek Excel şablonunu indir")} onPress={() => { const a = document.createElement("a"); a.href = "/foy-sablonu.xlsx"; a.download = "celse-foy-sablonu.xlsx"; a.click(); }} />
        </View>
        {!!err && <Text style={s.err}>{err}</Text>}
      </View>
      {sonuc && ayrim && (
        <View style={s.card}>
          <Text style={s.cardT}>{sonuc.ad}</Text>
          <Text style={s.body}>{t("{n} föy bulundu: {y} yeni, {g} var olan föyün güncellemesi.", { n: sonuc.foyler.length, y: ayrim.yeni.length, g: ayrim.guncellenen.length })}{sonuc.atlanan ? " " + t("{n} boş satır atlandı.", { n: sonuc.atlanan }) : ""}</Text>
          <Text style={s.hint}>{t("Tanınan sütunlar")}: {Object.entries(sonuc.eslesen).map(([a, h]) => `${h} → ${t(ALAN[a] || a)}`).join(", ")}</Text>
          {sonuc.eslesmeyen.length > 0 && <Text style={s.hint}>{t("Tanınmayan, atlanan sütunlar")}: {sonuc.eslesmeyen.join(", ")}</Text>}
          {sonuc.foyler.slice(0, 30).map(f => (
            <View key={f.id} style={s.foy}>
              <View style={{ flex: 1 }}>
                <Text style={s.foyT} numberOfLines={1}>{foyBaslik(f)}</Text>
                <Text style={s.hint} numberOfLines={1}>{[f.taraf === "davali" ? t("Davalı vekili") : t("Davacı vekili"), f.mahkeme, f.esasNo, f.davaTuru].filter(Boolean).join(" · ")}</Text>
              </View>
              {!!f.durusma && <Text style={s.foyD}>{tarihYaz(f.durusma)}</Text>}
            </View>
          ))}
          {sonuc.foyler.length > 30 && <Text style={s.hint}>{t("ve {n} föy daha", { n: sonuc.foyler.length - 30 })}</Text>}
          <View style={s.row}><Btn label={busy ? t("Kaydediliyor…") : t("Föyleri oluştur")} onPress={kaydet} disabled={busy || !sonuc.foyler.length} /></View>
        </View>
      )}
    </ScrollView>
  );
}

