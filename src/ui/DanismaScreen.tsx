// "Derdini anlat": oyuncu kendi olayını dört kutuya yazar; ücretsiz eksik bilgi denetiminden geçince 1 krediyle
// eğitim amaçlı değerlendirme, aynı kredi içinde duruşma canlandırması ve en çok 5 takip sorusu alır. Canlandırmayı hemen yapay zekâ
// yapar ya da olay anonimleştirilerek uygulamadaki avukat oyunculara oynatılır (danismaDosya.ts); ikisi birlikte de seçilebilir.
// Eğitim amaçlı canlandırmadır, hukuki görüş değildir (1136 sayılı Avukatlık Kanunu m.35). Uyarı her ekranda bir kez gösterilir.
import React, { useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  ALANLAR, alanAdi, ASGARI, AZAMI, BOS_FORM, Cevap, izleSenaryo, Senaryo, cevaplariEkle, Danisma, DanismaForm, Degerlendirme, deleteDanisma,
  ALAN_ADI, degerlendir, dosyaHazirla, formHatalari, kontrolEt, Kutu, listDanismalar, Soru, takipSor, TAKIP_HAKKI
} from "../data/danisma";
import { CreditInfo, PRODUCTS } from "../data/purchaseIds";
import { buyConsumable, getCreditProducts, PURCHASES_AVAILABLE } from "../data/purchases";
import { refreshPremium, usePremium } from "../data/subscription";
import { locale, t } from "../i18n";
import { ORNEK_DANISMA, ORNEK_SENARYO } from "../data/izleOrnek";
import DanismaWatch from "./DanismaWatch";
import EvrakScreen from "./EvrakScreen";
import type { CaseFile } from "../engine/types";
import { cinsKodu, danisanKadinMi, kimAdi, sahneBaslik } from "./izleOrtak";
import { beklemeDoldu, DanismaDosyasi, dosyalarim, INSAN_BEKLEME_DK, kayitSenaryo, OyunKaydi } from "../data/danismaDosya";
import { useAccount } from "../data/account";
import { useCharacter } from "../data/character";
import { useOffice } from "../data/office";
import { Btn } from "./kit";
import { StoreLinks } from "./StoreLinks";
import { C, F } from "./theme";

interface Props { evrak?: boolean; onEvrakPlay?: (c: CaseFile) => void; onBack: () => void; onSignIn: () => void; onSignUp: () => void; signedIn: boolean; server: boolean; admin: boolean }

const KUTU: Record<Kutu, { label: string; hint: string }> = {
  olay: { label: "Somut olay", hint: "Ne oldu? Olayları tarih sırasıyla yazın: ne zaman, kim (rolüyle), ne yaptı." },
  deliller: { label: "Deliller ve ek bilgiler", hint: "Elinizdeki belgeler, mesajlar, tanıklar, tarihler ve tutarlar." },
  karsi: { label: "Karşı tarafın argümanları", hint: "Karşı taraf ne diyor ya da ne diyecek?" },
  talep: { label: "Talebiniz", hint: "Ne istiyorsunuz? (ör. alacağımı tahsil etmek, işe iade, nafaka)" }
};
const BOLUM: [keyof Degerlendirme, string][] = [
  ["nitelik", "Olayın hukuki niteliği ve uygulanabilecek mevzuat"],
  ["guclu", "Güçlü yönler"],
  ["zayif", "Zayıf yönler / riskler"],
  ["deliller", "Delillerin değeri ve eksik deliller"],
  ["savunma", "Karşı tarafın muhtemel savunması"],
  ["yollar", "İzlenebilecek yollar ve süreler"],
  ["kapanis", "Kapanış"]
];
/** Mağaza fiyatı alınamazsa gösterilen fiyatlar (KDV dahil). */
const PAKETLER = [{ productId: PRODUCTS.derdini1, credits: 1, price: "₺149,99" }, { productId: PRODUCTS.derdini3, credits: 3, price: "₺349,99" }];

const errText = (r: Cevap<unknown>) => (r.ok ? "" : t(r.error, r.vars));

/** Web adresindeki parametre (?izle-ornek, ?danisma=<kimlik>). Telefonda boş. */
const adresParam = (re: RegExp) => {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const m = (window.location?.search || "").match(re);
  return m ? m[1] || "" : null;
};

export default function DanismaScreen(p: Props) {
  const [view, setView] = useState<"yeni" | "gecmis" | "sonuc">("yeni");
  const [list, setList] = useState<Danisma[] | null>(null);
  const [open, setOpen] = useState<Danisma | null>(null);
  // "Duruşmayı izle" oynatıcısı. Geliştirme önizlemesi: web'de ?izle-ornek ile gömülü örnek senaryo açılır (sunucuya gitmez).
  const [watch, setWatch] = useState<{ s: Senaryo; d: Danisma; son?: boolean; oyuncu?: boolean } | null>(() =>
    adresParam(/[?&](izle-ornek)\b/) !== null ? { s: ORNEK_SENARYO, d: ORNEK_DANISMA, son: adresParam(/[?&]izle-ornek=(son)\b/) === "son" } : null);
  // Telefondan "videoyu web'de hazırla" ile gelen bağlantı: ?danisma=<kimlik> o danışmanın kayıtlar ekranını açar.
  const hedef = useRef(adresParam(/[?&]danisma=([0-9a-f-]{36})/i));
  // Oyunculara gönderilen dosyalar (danışma kimliğine göre); surum13.sql kurulmadıysa boş.
  const [dosyalar, setDosyalar] = useState<Record<string, DanismaDosyasi>>({});
  // "Evrakla duruşma provası" (beta: yalnız yönetici; sonra avukatlara açılacak).
  const premE = usePremium();
  const evrakIzinli = premE.evrak || !!premE.avukat?.aktif;
  const [evrak, setEvrak] = useState(() => !!p.evrak || adresParam(/[?&](evrak)\b/) !== null);
  const reload = () => listDanismalar().then(l => {
    setList(l);
    dosyalarim().then(setDosyalar).catch(() => {});
    const h = hedef.current && l.find(x => x.id === hedef.current);
    if (h) {
      hedef.current = null;
      setOpen(h); setView("sonuc");
      if (h.senaryo) setWatch({ s: h.senaryo, d: h, son: true });
    }
  }).catch(() => setList([]));
  useEffect(() => { if (p.signedIn) reload(); }, [p.signedIn]);

  if (evrak) return <EvrakScreen ucretsiz={!!p.admin} onPlay={p.onEvrakPlay} onBack={() => (p.evrak ? p.onBack() : setEvrak(false))} />;
  if (watch) return <DanismaWatch key={watch.d.id + (watch.oyuncu ? ":oyuncu" : "")} s={watch.s} d={watch.d} basla={watch.son ? "son" : undefined} onClose={() => setWatch(null)} />;
  const oyuncuKaydi = (d: Danisma, k: OyunKaydi) => { const sn = kayitSenaryo(k); if (sn) setWatch({ s: sn, d, oyuncu: true }); };

  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag">
      <View style={s.head}>
        <Btn kind="ghost" label={view === "sonuc" ? t("‹ Geri") : t("‹ Giriş")} onPress={() => (view === "sonuc" ? setView("gecmis") : p.onBack())} />
      </View>
      <Text style={s.eyebrow}>{t("DERDİNİ ANLAT")}</Text>
      <Text style={s.title}>{t("Derdinizi anlatın")}</Text>
      <Text style={s.sub}>{t("Olayınızı anlatın; Türk hukukuna göre güçlü ve zayıf yönlerinizi, delillerinizi, karşı tarafın muhtemel savunmasını ve izlenebilecek yolları eğitim amaçlı olarak görün.")}</Text>
      <Disclaimer />

      {!p.signedIn ? (
        <View style={s.card}>
          <Text style={s.cardT}>{t("Danışma için giriş yapın")}</Text>
          <Text style={s.body}>{t("Anlattıklarınız ve değerlendirmeler hesabınıza kaydedilir; istediğiniz zaman silebilirsiniz. Kredi de hesabınıza bağlıdır.")}</Text>
          {p.server ? (
            <View style={s.row}>
              <Btn label={t("Giriş yap")} onPress={p.onSignIn} />
              <Btn kind="ghost" label={t("Üye ol")} onPress={p.onSignUp} />
            </View>
          ) : <Text style={s.err}>{t("Sunucuya şu an ulaşılamıyor. İnternet bağlantınızı kontrol edip uygulamayı yeniden açın.")}</Text>}
        </View>
      ) : (
        <>
          {view !== "sonuc" && (
            <View style={s.tabs}>
              {([["yeni", t("Yeni danışma")], ["gecmis", list?.length ? t("Geçmiş ({n})", { n: list.length }) : t("Geçmiş")]] as const).map(([k, l]) => (
                <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: view === k }} onPress={() => setView(k)} style={[s.tab, view === k && s.tabOn]}>
                  <Text style={[s.tabText, view === k && s.tabTextOn]}>{l}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {view === "yeni" && (p.admin || evrakIzinli) && (
            <Pressable accessibilityRole="button" onPress={() => setEvrak(true)} style={s.card}>
              <Text style={s.meta}>{t("YENİ · AVUKATLAR İÇİN · DENEME")}</Text>
              <Text style={s.cardT}>{t("Evrakla duruşma provası")}</Text>
              <Text style={s.body}>{t("Dosyanın evrakını yükleyin: kişisel veriler bu cihazda kodlanır, yalnız kodlu metin gönderilir. Hâkimin soruları, karşı tarafın argümanları ve sözlü beyan taslağı hazırlanır.")}</Text>
            </Pressable>
          )}
          {view === "yeni" && <NewForm admin={p.admin} onDone={d => { setOpen(d); setView("sonuc"); reload(); }} />}
          {view === "gecmis" && <History list={list} dosyalar={dosyalar} onOpen={d => { setOpen(d); setView("sonuc"); }} onDeleted={reload} onKayit={oyuncuKaydi} />}
          {view === "sonuc" && open && <Result key={open.id} d={open} dosya={dosyalar[open.id] || null} onChange={d => { setOpen(d); setList(l => l?.map(x => (x.id === d.id ? d : x)) || l); }}
            onDosya={f => setDosyalar(m => ({ ...m, [open.id]: f }))} onKayit={k => oyuncuKaydi(open, k)}
            onWatch={(sn, son) => setWatch({ s: sn, d: open, son })} />}
        </>
      )}
    </ScrollView>
  );
}

/** Çok satırlı kutu: yalnız yazarken kendi içinde kayar. Odakta değilken parmak kutunun üstünden de sayfayı kaydırır
 *  (iPhone'da kutu kaydırmayı kendisi yakalayınca sayfa aşağı inmiyordu). */
function FieldInput(p: React.ComponentProps<typeof TextInput>) {
  const [on, setOn] = useState(false);
  return <TextInput {...p} scrollEnabled={on}
    onFocus={e => { setOn(true); p.onFocus?.(e); }} onBlur={e => { setOn(false); p.onBlur?.(e); }} />;
}

function Disclaimer() {
  return (
    <View style={s.warn}>
      <Text style={s.warnT}>{t("Eğitim amaçlı canlandırmadır, hukuki görüş değildir.")}</Text>
      <Text style={s.warnD}>{t("Avukatlık Kanunu m.35 uyarınca hukuki görüş yalnız avukatlarca verilir. Gerçek ad, soyad ya da T.C. kimlik numarası yazmayın; kişilerden rolleriyle söz edin (işveren, kiracı, eş gibi).")}</Text>
    </View>
  );
}

/** Zorunlu kabul: değerlendirme ve canlandırma yapay zekâ ürünüdür, hata yapabilir, mahkeme kararı ya da hukuki görüş değildir
 *  (KVKK açık rıza kutusundan ayrıdır; sunucu da "kabul" ister). */
function KabulKutusu({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => set(!on)} style={s.check} testID="kabul">
      <View style={[s.box, on && s.boxOn]}>{on && <Text style={s.tick}>✓</Text>}</View>
      <Text style={s.checkT}>{t("Zorunlu:")} {t("Bu değerlendirme ve duruşma canlandırmasının yapay zekâ tarafından üretildiğini, hata yapabileceğini, gerçek bir mahkeme kararı ya da hukuki görüş olmadığını bildiğimi ve bu bilinçle kullandığımı kabul ediyorum.")}</Text>
    </Pressable>
  );
}

function Credits({ admin, credits }: { admin: boolean; credits: number }) {
  return (
    <View style={[s.chip, credits > 0 || admin ? s.chipOn : null]}>
      <Text style={[s.chipT, (credits > 0 || admin) && { color: C.brassInk }]}>{admin ? t("Yönetici · ücretsiz danışma") : t("Kalan kredi: {n}", { n: credits })}</Text>
    </View>
  );
}

/* ---------- yeni danışma ---------- */
function NewForm({ admin, onDone }: { admin: boolean; onDone: (d: Danisma) => void }) {
  const { credits } = usePremium();
  const [form, setFormRaw] = useState<DanismaForm>(BOS_FORM);
  const [shown, setShown] = useState(false);
  const [sorular, setSorular] = useState<Soru[] | null>(null);
  const [cevaplar, setCevaplar] = useState<string[]>([]);
  const [onay, setOnay] = useState<string | null>(null);
  const [riza, setRiza] = useState(false);
  const [kabul, setKabul] = useState(false);
  const [ornek, setOrnek] = useState(false);
  const [busy, setBusy] = useState<"" | "kontrol" | "degerlendir">("");
  const [msg, setMsg] = useState<{ t: string; ok?: boolean } | null>(null);
  // Form değişince önceki "yeterli" onayı düşer: değerlendirme yalnız denetlenen metne yapılır.
  const setForm = (f: DanismaForm) => { setFormRaw(f); setOnay(null); };
  const errs = formHatalari(form);
  const complete = Object.keys(errs).length === 0;
  const canStart = riza && kabul && !!onay && (admin || credits > 0) && !busy;

  const check = async (f: DanismaForm = form) => {
    setShown(true); setMsg(null);
    if (!riza) { setMsg({ t: t("Devam etmek için açık rıza kutusunu işaretleyin.") }); return; }
    if (!kabul) { setMsg({ t: t("Devam etmek için yapay zekâ uyarısını kabul ettiğinizi işaretleyin.") }); return; }
    const eksik = Object.keys(formHatalari(f)) as (keyof typeof ALAN_ADI)[];
    if (eksik.length) { setMsg({ t: t("Şu alanlar eksik: {alanlar}. Kırmızıyla işaretli alanları tamamlamadan devam edemezsiniz.", { alanlar: eksik.map(k => t(ALAN_ADI[k])).join(", ") }) }); return; }
    setBusy("kontrol");
    const r = await kontrolEt(f);
    setBusy("");
    if (!r.ok) return setMsg({ t: errText(r) });
    if (r.data.uygunsuz) { setSorular(null); return setMsg({ t: t("Bu istek değerlendirilemedi: {neden}", { neden: r.data.neden || "" }) }); }
    if (r.data.yeterli && r.data.onay) { setSorular(null); setCevaplar([]); setOnay(r.data.onay); setMsg({ t: t("Bilgiler yeterli. Değerlendirmeyi başlatabilirsiniz."), ok: true }); return; }
    setSorular(r.data.sorular); setCevaplar(r.data.sorular.map(() => ""));
    setMsg({ t: t("Değerlendirme için birkaç bilgi eksik. Aşağıdaki soruları cevaplayın.") });
  };
  const addAnswers = () => {
    if (!sorular) return;
    if (!cevaplar.some(c => c.trim())) return setMsg({ t: t("En az bir soruyu cevaplayın.") });
    const f = cevaplariEkle(form, sorular, cevaplar, { soru: t("Soru"), cevap: t("Cevap") });
    setForm(f); setSorular(null); setCevaplar([]);
    check(f);
  };
  const start = async () => {
    if (!onay) return;
    setBusy("degerlendir"); setMsg(null);
    const r = await degerlendir(form, onay, ornek);
    setBusy("");
    if (!r.ok) {
      if (r.status === 409) setOnay(null);
      refreshPremium();
      return setMsg({ t: errText(r) + (r.iade ? " " + t("Krediniz düşülmedi.") : "") });
    }
    refreshPremium();
    const d: Danisma = { ...form, id: r.data.id, durum: "hazir", degerlendirme: r.data.degerlendirme, canlandirma: null, senaryo: null, takip: [], kalan_takip: r.data.kalan_takip, created_at: new Date().toISOString(), kabul_zaman: new Date().toISOString() };
    setFormRaw(BOS_FORM); setOnay(null); setShown(false); setMsg(null);
    onDone(d);
  };

  const fieldErr = (k: Kutu | "alan") => {
    const e = errs[k];
    if (!shown || !e) return null;
    const n = form[k as Kutu]?.trim().length || 0;
    return <Text style={s.fieldErr}>{t(e, { n: k === "alan" ? 0 : e.startsWith("En çok") ? AZAMI : ASGARI[k as Kutu], m: n })}</Text>;
  };

  return (
    <View style={{ gap: 14 }}>
      <Credits admin={admin} credits={credits} />
      <View style={s.card}>
        <Text style={s.label}>{t("Hukuk alanı")} *</Text>
        <View style={s.chips}>
          {ALANLAR.map(a => (
            <Pressable key={a.id} accessibilityRole="radio" accessibilityState={{ checked: form.alan === a.id }} onPress={() => setForm({ ...form, alan: a.id })}
              style={[s.alan, form.alan === a.id && s.alanOn]}>
              <Text style={[s.alanT, form.alan === a.id && s.alanTOn]}>{t(a.label)}</Text>
            </Pressable>
          ))}
        </View>
        {fieldErr("alan")}
      </View>

      {(Object.keys(KUTU) as Kutu[]).map((k, i) => {
        const bad = shown && !!errs[k];
        return (
          <View key={k} style={s.card}>
            <Text style={s.label}>{i + 1}. {t(KUTU[k].label)} *</Text>
            <Text style={s.hint}>{t(KUTU[k].hint)}</Text>
            <FieldInput multiline value={form[k]} onChangeText={v => setForm({ ...form, [k]: v })} maxLength={AZAMI}
              placeholderTextColor={C.muted} placeholder={t("En az {n} karakter", { n: ASGARI[k] })}
              style={[s.input, bad && s.inputBad]} textAlignVertical="top" accessibilityLabel={t(KUTU[k].label)} />
            <View style={s.counterRow}>
              {fieldErr(k) || <View />}
              <Text style={[s.counter, form[k].trim().length >= ASGARI[k] && { color: C.good }]}>{form[k].trim().length} / {ASGARI[k]}+</Text>
            </View>
          </View>
        );
      })}

      {sorular && sorular.length > 0 && (
        <View style={[s.card, { borderColor: C.mid }]}>
          <Text style={s.cardT}>{t("Eksik bilgiler")}</Text>
          <Text style={s.hint}>{t("Cevaplarınız ilgili kutunun sonuna eklenir. Bilmiyorsanız \"bilmiyorum\" yazabilirsiniz.")}</Text>
          {sorular.map((q, i) => (
            <View key={i} style={{ gap: 4 }}>
              <Text style={s.body}>{i + 1}. {q.soru} <Text style={s.hint}>({t(KUTU[q.kutu].label)})</Text></Text>
              <FieldInput multiline value={cevaplar[i] || ""} onChangeText={v => setCevaplar(c => c.map((x, j) => (j === i ? v : x)))}
                style={[s.input, { minHeight: 64 }]} textAlignVertical="top" placeholderTextColor={C.muted} placeholder={t("Cevabınız")} />
            </View>
          ))}
          <Btn label={busy === "kontrol" ? t("Denetleniyor…") : t("Cevapları ekle ve yeniden denetle")} disabled={!!busy} onPress={addAnswers} />
        </View>
      )}

      {!!msg && <Text style={[s.msg, msg.ok && { color: C.good }]}>{msg.t}</Text>}

      <View style={s.card}>
        <Text style={s.cardT}>{t("Kişisel verileriniz")}</Text>
        <Text style={s.hint}>{t("Değerlendirme için dosya numarası, mahkeme adı, kişi ya da şirket adı, adres, plaka veya kesin tarih gerekmez; tarihler için yaklaşık ay ve yıl yeterlidir. Sağlık bilgisini yalnız konuyla doğrudan ilgiliyse ve genel olarak yazın. Bu tür numaralar yazılsa bile sunucuda gizlenir.")}</Text>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: riza }} onPress={() => setRiza(!riza)} style={s.check}>
          <View style={[s.box, riza && s.boxOn]}>{riza && <Text style={s.tick}>✓</Text>}</View>
          <Text style={s.checkT}>{t("Zorunlu:")} {t("Yazdıklarımın eğitim amaçlı değerlendirme için yurt dışındaki yapay zekâ hizmet sağlayıcısına (Anthropic, ABD) aktarılarak işlenmesine; yazdıklarımda sağlık gibi özel nitelikli bir bilgi varsa onun da işlenmesine açık rıza veriyorum. Aydınlatma metnini okudum. Rızamı geçmiş danışmalarımı silerek geri alabilirim.")} <Text style={s.link} onPress={() => Linking.openURL("https://celse.themiscode.com/gizlilik.html")}>{t("Aydınlatma metni")}</Text></Text>
        </Pressable>
        <KabulKutusu on={kabul} set={setKabul} />
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: ornek }} onPress={() => setOrnek(!ornek)} style={s.check}>
          <View style={[s.box, ornek && s.boxOn]}>{ornek && <Text style={s.tick}>✓</Text>}</View>
          <Text style={s.checkT}>{t("İsteğe bağlı:")} {t("Olayımın, kişisel bilgilerden arındırılarak (anonimleştirilerek) Celse'de eğitim amaçlı örnek dava dosyası hazırlanmasında kullanılmasına muvafakat ediyorum. Bu izin değerlendirmeyi ya da ücreti etkilemez; danışmamı silersem izin de ortadan kalkar.")}</Text>
        </Pressable>
      </View>

      <View style={s.card}>
        <Btn kind={onay ? "ghost" : "primary"} label={busy === "kontrol" ? t("Denetleniyor…") : onay ? t("✓ Bilgiler yeterli") : t("Eksik bilgi denetimi (ücretsiz)")} disabled={!!busy || !!onay} onPress={() => check()} />
        <Btn label={busy === "degerlendir" ? t("Değerlendiriliyor… (bir dakika sürebilir)") : admin ? t("Değerlendirmeyi başlat (yönetici · ücretsiz)") : t("Değerlendirmeyi başlat (1 kredi)")}
          disabled={!canStart} onPress={start} style={!canStart && { opacity: 0.45 }} />
        {!onay && <Text style={s.hint}>{complete ? t("Değerlendirme, eksik bilgi denetiminden \"yeterli\" sonucu alınca açılır.") : t("Önce bütün alanları doldurun; ardından eksik bilgi denetimi yapılır.")}</Text>}
        <Text style={s.hint}>{t("Kredi yalnız değerlendirme başlayınca düşer; aynı kredi içinde duruşma canlandırması ve {n} takip sorusu vardır. Değerlendirme yapılamazsa kredi geri verilir.", { n: TAKIP_HAKKI })}</Text>
      </View>

      {!admin && credits <= 0 && <BuyCredits />}
    </View>
  );
}

function BuyCredits() {
  const [items, setItems] = useState<CreditInfo[] | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { if (PURCHASES_AVAILABLE) getCreditProducts().then(setItems).catch(() => setItems([])); }, []);
  if (!PURCHASES_AVAILABLE) {
    return (
      <View style={s.card}>
        <Text style={s.cardT}>{t("Krediniz yok")}</Text>
        <Text style={s.body}>{t("\"Derdini anlat\" kredisi iPhone ya da Android uygulamasından satın alınır (1 kredi {a}, 3 kredi {b}). Aynı hesapla giriş yaptığınızda kredi web'de de kullanılır.", { a: PAKETLER[0].price, b: PAKETLER[1].price })}</Text>
        <Btn kind="ghost" label={t("Kredimi yeniden denetle")} onPress={() => { setMsg(""); refreshPremium().then(() => setMsg(t("Kredi durumu güncellendi."))); }} />
        {!!msg && <Text style={s.hint}>{msg}</Text>}
        {Platform.OS === "web" && <StoreLinks />}
      </View>
    );
  }
  const shown = PAKETLER.map(pk => ({ ...pk, price: items?.find(x => x.productId === pk.productId)?.price || pk.price }));
  const buy = async (id: string) => {
    setBusy(id); setMsg("");
    const r = await buyConsumable(id);
    setBusy("");
    if (r.ok) {
      setMsg(t("Satın alma tamamlandı. Krediniz birkaç saniye içinde görünür."));
      refreshPremium(); setTimeout(refreshPremium, 4000); setTimeout(refreshPremium, 12000);
    } else if (!r.cancelled) setMsg(t("Satın alma tamamlanamadı: {hata}", { hata: t(r.error || "bilinmeyen hata") }));
  };
  return (
    <View style={s.card}>
      <Text style={s.cardT}>{t("Kredi alın")}</Text>
      <View style={s.row}>
        {shown.map(pk => (
          <Pressable key={pk.productId} accessibilityRole="button" disabled={!!busy} onPress={() => buy(pk.productId)} style={({ pressed }) => [s.pack, pressed && { opacity: 0.85 }]}>
            <Text style={s.packN}>{pk.credits === 1 ? t("1 kredi") : t("{n} kredi", { n: pk.credits })}</Text>
            <Text style={s.packP}>{busy === pk.productId ? t("Bekleyin…") : pk.price}</Text>
          </Pressable>
        ))}
      </View>
      {items !== null && !items.length && <Text style={s.hint}>{t("Mağaza fiyatları şu an alınamadı; gösterilen fiyatlar yaklaşıktır.")}</Text>}
      <Text style={s.hint}>{t("Tek seferlik satın almadır, abonelik değildir. Kredi hesabınıza bağlanır ve web'de de kullanılır.")}</Text>
      {!!msg && <Text style={s.msg}>{msg}</Text>}
    </View>
  );
}

/* ---------- geçmiş ---------- */
/** Oyunculara gönderilen dosyanın durumu (geçmiş listesinde ve sonuç ekranında). */
function dosyaDurumu(f: DanismaDosyasi) {
  if (f.durum === "oynandi") return t("Avukat oyuncu oynadı · kayıt hazır");
  if (f.durum === "oynaniyor") return t("Bir avukat oyuncu dosyanızı oynuyor");
  return beklemeDoldu(f) ? t("{dk} dakikadır oyuncu bekliyor", { dk: INSAN_BEKLEME_DK }) : t("Oyuncu bekleniyor");
}

function History({ list, dosyalar, onOpen, onDeleted, onKayit }: {
  list: Danisma[] | null; dosyalar: Record<string, DanismaDosyasi>; onOpen: (d: Danisma) => void; onDeleted: () => void; onKayit: (d: Danisma, k: OyunKaydi) => void;
}) {
  const [ask, setAsk] = useState<string | null>(null);
  if (list === null) return <Text style={s.hint}>{t("Yükleniyor…")}</Text>;
  if (!list.length) return <Text style={s.body}>{t("Henüz danışmanız yok.")}</Text>;
  return (
    <View style={{ gap: 10 }}>
      {list.map(d => {
        const f = dosyalar[d.id];
        return (
          <View key={d.id} style={s.card}>
            <Text style={s.meta}>{t(alanAdi(d.alan)).toLocaleUpperCase(locale())} · {new Date(d.created_at).toLocaleDateString(locale())}</Text>
            <Text style={s.body} numberOfLines={3}>{d.olay}</Text>
            {!!f && <View style={[s.chip, f.durum === "oynandi" && s.chipOn]}><Text style={[s.chipT, f.durum === "oynandi" && { color: C.brassInk }]}>{dosyaDurumu(f)}</Text></View>}
            <View style={s.row}>
              <Btn label={t("Aç")} onPress={() => onOpen(d)} />
              {f?.durum === "oynandi" && f.kayit && kayitSenaryo(f.kayit) && <Btn kind="ghost" label={t("▶ Oyuncu kaydını izle")} onPress={() => onKayit(d, f.kayit as OyunKaydi)} />}
              {ask === d.id ? (
                <>
                  <Btn kind="ghost" label={t("Vazgeç")} onPress={() => setAsk(null)} />
                  <Btn kind="ghost" label={t("Evet, kalıcı olarak sil")} onPress={async () => { setAsk(null); await deleteDanisma(d.id); onDeleted(); }} />
                </>
              ) : <Btn kind="ghost" label={t("Sil")} onPress={() => setAsk(d.id)} />}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ---------- sonuç: değerlendirme, canlandırma, takip ---------- */
function Paras({ text }: { text: string }) {
  return (
    <View style={{ gap: 6 }}>
      {text.split(/\n+/).map(x => x.trim()).filter(Boolean).map((line, i) => /^[-•]\s+/.test(line)
        ? <View key={i} style={s.bullet}><Text style={s.bulletDot}>•</Text><Text style={[s.body, { flex: 1 }]}>{line.replace(/^[-•]\s+/, "")}</Text></View>
        : <Text key={i} style={s.body}>{line}</Text>)}
    </View>
  );
}

type Yol = "yz" | "insan" | "ikisi";

function Result({ d, dosya, onChange, onWatch, onDosya, onKayit }: {
  d: Danisma; dosya: DanismaDosyasi | null; onChange: (d: Danisma) => void; onWatch: (s: Senaryo, son?: boolean) => void;
  onDosya: (f: DanismaDosyasi) => void; onKayit: (k: OyunKaydi) => void;
}) {
  const [taraf, setTaraf] = useState<"davaci" | "davali">(d.canlandirma?.taraf || d.senaryo?.taraf || "davaci");
  const [busy, setBusy] = useState<"" | "izle" | "takip" | "dosya">("");
  const [soru, setSoru] = useState("");
  const [msg, setMsg] = useState("");
  const [metin, setMetin] = useState(false);
  const [kayitMetni, setKayitMetni] = useState(false);
  const [izleMsg, setIzleMsg] = useState("");
  const [yol, setYol] = useState<Yol>("yz");
  // Yapay zekâ uyarısı: bu danışmada değerlendirmeden önce kabul edildiyse yeniden sorulmaz (eski danışmalarda burada sorulur).
  const [kabul, setKabul] = useState(!!d.kabul_zaman);
  const deg = d.degerlendirme;
  // Danışanın cinsiyeti (sahnedeki yüz ve modelin hitapları): karakter, büro, hesap adı, sonra danışma metni.
  const karakter = useCharacter();
  const { office } = useOffice();
  const { account } = useAccount();
  const bos: Senaryo = { taraf, mahkeme: "", ozet: "", roller: { bizAvukat: "", karsiAvukat: "", hakim: "", karsiTaraf: "" }, sahneler: [] };
  const cins = cinsKodu(danisanKadinMi({ karakter: karakter?.avatar, buro: office?.avatar, ad: account?.adSoyad }, d.senaryo || bos, d));

  const hazirla = async (): Promise<Senaryo | null> => {
    if (d.senaryo) return d.senaryo;
    setBusy("izle"); setIzleMsg("");
    const r = await izleSenaryo(d.id, taraf, cins);
    setBusy("");
    if (!r.ok) { setIzleMsg(errText(r)); return null; }
    onChange({ ...d, senaryo: r.data.senaryo });
    return r.data.senaryo;
  };
  const izle = async (son?: boolean) => {
    if (!kabul) return setIzleMsg(t("Devam etmek için yapay zekâ uyarısını kabul ettiğinizi işaretleyin."));
    const sn = await hazirla();
    if (sn) onWatch(sn, son);
  };
  const gonder = async (): Promise<boolean> => {
    if (!kabul) { setIzleMsg(t("Devam etmek için yapay zekâ uyarısını kabul ettiğinizi işaretleyin.")); return false; }
    setBusy("dosya"); setIzleMsg("");
    const r = await dosyaHazirla(d.id, taraf, cins);
    setBusy("");
    if (!r.ok) { setIzleMsg(errText(r)); return false; }
    onDosya({ id: r.data.dosya.id, danisma_id: d.id, durum: r.data.dosya.durum as DanismaDosyasi["durum"], oynayan: null, kayit: null, created_at: r.data.dosya.created_at, alindi_at: null, oynandi_at: null });
    return true;
  };
  const basla = async () => {
    if (yol === "insan") { await gonder(); return; }
    if (yol === "ikisi" && !dosya && !(await gonder())) return;
    await izle();
  };
  // Bekleme süresi dolduysa (oyuncu almadıysa) yapay zekâ canlandırması kendiliğinden hazırlanır (aynı kredinin içindedir).
  const doldu = !!dosya && dosya.durum === "bekliyor" && beklemeDoldu(dosya);
  const otomatik = useRef(false);
  useEffect(() => {
    if (doldu && !d.senaryo && kabul && !otomatik.current && !busy) { otomatik.current = true; hazirla(); }
  }, [doldu, d.senaryo, kabul]);

  const ask = async () => {
    if (soru.trim().length < 5) return setMsg(t("Sorunuzu biraz daha açık yazın."));
    setBusy("takip"); setMsg("");
    const r = await takipSor(d.id, soru.trim());
    setBusy("");
    if (!r.ok) return setMsg(errText(r));
    setSoru("");
    onChange({ ...d, takip: [...d.takip, { soru: r.data.soru, cevap: r.data.cevap }], kalan_takip: r.data.kalan_takip });
  };
  const c = d.canlandirma;
  const sn = d.senaryo;
  const name = (rol: string, ad?: string) => ad || (rol === "hakim" ? t("Hâkim") : rol === "davaci" ? t("Davacı vekili") : t("Davalı vekili"));
  const kayit = dosya?.durum === "oynandi" ? dosya.kayit : null;
  const kayitSn = kayit ? kayitSenaryo(kayit) : null;
  const secim = (k: Yol, baslik: string, alt: string) => (
    <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: yol === k }} onPress={() => setYol(k)} style={[s.yol, yol === k && s.yolOn]}>
      <View style={[s.radio, yol === k && s.radioOn]}>{yol === k && <View style={s.radioDot} />}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.yolT}>{baslik}</Text>
        <Text style={s.hint}>{alt}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={{ gap: 14 }}>
      <Text style={s.meta}>{t(alanAdi(d.alan)).toLocaleUpperCase(locale())} · {new Date(d.created_at).toLocaleDateString(locale())}</Text>
      <View style={[s.card, { borderColor: C.brass }]}>
        <Text style={s.cardT}>{t("Duruşmayı izle")}</Text>
        <Text style={s.hint}>{t("Davanız sahnelenir: avukatınız sizi dinler, duruşma yapılır ve hâkim gerekçeli bir karar verir. Aynı kredinin içindedir.")}</Text>
        {!d.kabul_zaman && <KabulKutusu on={kabul} set={setKabul} />}
        {(!sn || !dosya) && (
          <View style={s.row}>
            {(["davaci", "davali"] as const).map(x => (
              <Pressable key={x} accessibilityRole="radio" accessibilityState={{ checked: taraf === x }} onPress={() => setTaraf(x)} style={[s.alan, taraf === x && s.alanOn]}>
                <Text style={[s.alanT, taraf === x && s.alanTOn]}>{x === "davaci" ? t("Ben davacı tarafıyım") : t("Ben davalı tarafıyım")}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {!dosya ? (
          <>
            <Text style={s.label}>{t("Duruşmayı kim canlandırsın?")}</Text>
            {secim("yz", t("Hemen yapay zekâ canlandırsın"), t("Bir dakika içinde hazır. Avukatlar, karşı taraf ve hâkim yapay zekâdır."))}
            {secim("insan", t("Uygulamadaki avukat oyuncular oynasın"), t("Olayınız anonimleştirilir; avukatınızı uygulamadaki bir avukat oyuncu oynar."))}
            {secim("ikisi", t("İkisi de: şimdi yapay zekâ, sonra oyuncular"), t("Yapay zekâ canlandırmasını hemen izlersiniz; oyuncu kaydı geldiğinde onu da izlersiniz."))}
            {yol !== "yz" && (
              <View style={s.warnBox} testID="oyuncu-uyari">
                <Text style={s.warnBoxT}>{t("Hemen olmaz")}</Text>
                <Text style={s.body}>{t("Dosyanız, bir avukat oyuncu onu aldığında oynanır. Oyuncular genellikle kısa sürede oynar; {dk} dakika içinde kimse almazsa yapay zekâ canlandırması hazırlanır. Kesin bir süre garantisi yoktur.", { dk: INSAN_BEKLEME_DK })}</Text>
                <Text style={s.body}>{t("Oynandığında Gelen kutunuza bildirim gelir (e-posta bildirimi açıldığında e-postayla da). Kaydı bu ekrandan ve Geçmiş'ten izlersiniz.")}</Text>
                <Text style={s.hint}>{t("Olayınızdan, kişisel bilgiler çıkarılarak (anonimleştirilerek) bir dava dosyası hazırlanır ve giriş yapmış oyunculara gösterilir; adınız ve e-postanız gösterilmez. Oyuncular gerçek avukat olmayabilir. Ek ücret yoktur; yapay zekâ canlandırması aynı kredinin içindedir.")}</Text>
              </View>
            )}
            <Btn label={busy === "dosya" ? t("Dosya hazırlanıyor… (birkaç dakika sürebilir)") : busy === "izle" ? t("Duruşma hazırlanıyor… (bir dakika sürebilir)")
              : yol === "insan" ? t("Oyunculara gönder") : yol === "ikisi" ? t("▶ Duruşmayı izle ve oyunculara gönder") : t("▶ Duruşmayı izle")}
              disabled={!!busy || !kabul} onPress={basla} style={[s.big, (!kabul || !!busy) && { opacity: 0.45 }]} />
          </>
        ) : (
          <View style={{ gap: 10 }}>
            <View style={[s.chip, dosya.durum === "oynandi" && s.chipOn]}><Text style={[s.chipT, dosya.durum === "oynandi" && { color: C.brassInk }]}>{dosyaDurumu(dosya)}</Text></View>
            {dosya.durum !== "oynandi" && !doldu && <Text style={s.hint}>{t("Dosyanız oyunculara açıldı. Oynandığında Gelen kutunuza bildirim gelir. {dk} dakika içinde kimse almazsa yapay zekâ canlandırması hazırlanır.", { dk: INSAN_BEKLEME_DK })}</Text>}
            {doldu && <Text style={s.body}>{t("{dk} dakika içinde bir avukat oyuncu dosyanızı almadı. Yapay zekâ canlandırması aynı kredinin içindedir ve sizin için hazırlanıyor; dosyanız oyunculara açık kalır.", { dk: INSAN_BEKLEME_DK })}</Text>}
            {kayit && (
              <>
                <Text style={s.body}>{t("Dosyanızı {ad} oynadı. Sonuç: {sonuc} · ikna puanı {puan}/100.", { ad: kayit.oynayan || dosya.oynayan || t("bir avukat oyuncu"), sonuc: kayit.sonuc?.stamp || "", puan: kayit.puan })}</Text>
                {kayitSn ? <Btn label={t("▶ Oyuncu kaydını izle")} onPress={() => onKayit(kayit)} style={s.big} /> : null}
                <Pressable onPress={() => setKayitMetni(!kayitMetni)} accessibilityRole="button"><Text style={s.link}>{kayitMetni ? t("Kaydın metnini gizle") : t("Oyuncu kaydının metnini göster")}</Text></Pressable>
                {(kayitMetni || !kayitSn) && <KayitMetni k={kayit} />}
              </>
            )}
            {(!!sn || doldu || dosya.durum !== "oynandi") && (
              <Btn kind={sn ? "primary" : "ghost"} label={busy === "izle" ? t("Duruşma hazırlanıyor… (bir dakika sürebilir)") : sn ? t("▶ Yapay zekâ canlandırmasını izle") : t("Yapay zekâ canlandırmasını şimdi hazırla")}
                disabled={!!busy || !kabul} onPress={() => izle()} />
            )}
          </View>
        )}
        {!!sn && <Btn kind="ghost" label={t("🎧 🎬 Sesli kaydı ve videoyu indir")} disabled={!!busy} onPress={() => izle(true)} />}
        {busy === "dosya" && <Text style={s.hint}>{t("Olayınızdan oyuncular için anonim bir dava dosyası hazırlanıyor…")}</Text>}
        {!!izleMsg && <Text style={s.msg}>{izleMsg}</Text>}
      </View>
      {!deg ? <Text style={s.body}>{t("Değerlendirme bulunamadı.")}</Text> : deg.metin && !deg.nitelik ? (
        <View style={s.card}><Paras text={deg.metin} /></View>
      ) : BOLUM.map(([k, title], i) => (
        <View key={k} style={[s.card, k === "kapanis" && { borderColor: C.brass }]}>
          <Text style={s.secT}>{k === "kapanis" ? "" : `${i + 1}. `}{t(title)}</Text>
          <Paras text={String(deg[k] || "")} />
        </View>
      ))}

      <View style={s.card}>
        <Text style={s.cardT}>{t("Metin olarak oku")}</Text>
        <Pressable onPress={() => setMetin(!metin)} accessibilityRole="button"><Text style={s.link}>{metin ? t("Metni gizle") : t("Duruşmanın metnini göster")}</Text></Pressable>
        {metin && sn && (
          <View style={{ gap: 10 }}>
            {sn.sahneler.map((sh, i) => (
              <View key={i} style={{ gap: 8 }}>
                <Text style={s.secT}>{sahneBaslik(sh.tur, sn).baslik}</Text>
                {sh.satirlar.map((l, j) => {
                  const mine = l.kim === "biz" || l.kim === "bizAvukat", judge = l.kim === "hakim";
                  return (
                    <View key={j} style={[s.bubble, judge ? s.bJudge : mine ? s.bMine : s.bOther]}>
                      <Text style={[s.bWho, mine && { color: C.brassInk }]}>{kimAdi(l.kim, sn)}</Text>
                      <Text style={[s.bText, mine && { color: C.brassInk }]}>{l.metin}</Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}
        {metin && !sn && c && (
          <View style={{ gap: 10 }}>
            {c.satirlar.map((l, i) => {
              const mine = l.rol === c.taraf, judge = l.rol === "hakim";
              return (
                <View key={i} style={[s.bubble, judge ? s.bJudge : mine ? s.bMine : s.bOther]}>
                  <Text style={[s.bWho, mine && { color: C.brassInk }]}>{name(l.rol, l.ad)}{mine ? " · " + t("siz") : ""}</Text>
                  <Text style={[s.bText, mine && { color: C.brassInk }]}>{l.metin}</Text>
                </View>
              );
            })}
            {!!c.degerlendirme && (
              <View style={[s.card, { backgroundColor: C.panel2 }]}>
                <Text style={s.secT}>{t("Hâkimin kararı")}</Text>
                <Paras text={c.degerlendirme} />
              </View>
            )}
          </View>
        )}
        {metin && !sn && !c && <Text style={s.hint}>{t("Metin, duruşma hazırlandıktan sonra burada görünür.")}</Text>}
      </View>

      <View style={s.card}>
        <Text style={s.cardT}>{t("Takip soruları")}</Text>
        <Text style={s.hint}>{t("Aynı kredi içinde {n} soru hakkınız var. Kalan: {k}", { n: TAKIP_HAKKI, k: d.kalan_takip })}</Text>
        {d.takip.map((q, i) => (
          <View key={i} style={{ gap: 6 }}>
            <View style={[s.bubble, s.bMine]}><Text style={[s.bText, { color: C.brassInk }]}>{q.soru}</Text></View>
            <View style={[s.bubble, s.bOther]}><Paras text={q.cevap} /></View>
          </View>
        ))}
        {d.kalan_takip > 0 && (
          <>
            <FieldInput multiline value={soru} onChangeText={setSoru} maxLength={1000} style={[s.input, { minHeight: 64 }]} textAlignVertical="top"
              placeholderTextColor={C.muted} placeholder={t("Sorunuzu yazın")} accessibilityLabel={t("Takip sorusu")} />
            <Btn label={busy === "takip" ? t("Cevaplanıyor…") : t("Sor ({k} hak kaldı)", { k: d.kalan_takip })} disabled={!!busy} onPress={ask} />
          </>
        )}
      </View>
      {!!msg && <Text style={s.msg}>{msg}</Text>}
    </View>
  );
}

/** Oyuncu kaydının metin tutanağı: bütün konuşmalar, oyuncunun seçimleri ve açıklamalar, karar (görsel oynatıcının yedeği). */
function KayitMetni({ k }: { k: OyunKaydi }) {
  return (
    <View style={{ gap: 8 }}>
      {(k.satirlar || []).map((l, i) => l.tur === "not"
        ? <Text key={i} style={s.hint}>{l.text}</Text>
        : (
          <View key={i} style={[s.bubble, l.who === "judge" ? s.bJudge : l.who === "p1" || l.who === "client" ? s.bMine : s.bOther]}>
            <Text style={[s.bWho, (l.who === "p1" || l.who === "client") && { color: C.brassInk }]}>{l.who === "p1" ? `${k.oynayan || l.ad} · ${t("avukat oyuncu")}` : l.who === "client" ? t("Siz") : l.ad}{l.tur === "karar" ? " · " + t("seçim") : ""}</Text>
            <Text style={[s.bText, (l.who === "p1" || l.who === "client") && { color: C.brassInk }]}>{l.text}</Text>
          </View>
        ))}
      {!!k.sonuc && (
        <View style={[s.card, { backgroundColor: C.panel2 }]}>
          <Text style={s.secT}>{t("Hâkimin kararı")} · {k.sonuc.stamp}</Text>
          <Paras text={k.sonuc.hukum} />
          {!!k.sonuc.summary && <Paras text={k.sonuc.summary} />}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 720, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 20, gap: 12 },
  head: { flexDirection: "row" },
  eyebrow: { fontFamily: F.mono, fontSize: 12, letterSpacing: 2.5, color: C.muted, marginTop: 4 },
  title: { fontFamily: F.display, fontSize: 32, color: C.brass },
  sub: { fontFamily: F.body, fontSize: 16, lineHeight: 23, color: C.textSoft },
  warn: { borderWidth: 1, borderColor: C.mid, borderRadius: 10, padding: 12, gap: 4, backgroundColor: "rgba(208,166,76,0.10)" },
  warnT: { fontFamily: F.bodyBold, fontSize: 15, color: C.text },
  warnD: { fontFamily: F.body, fontSize: 13, lineHeight: 19, color: C.textSoft },
  card: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 14, gap: 10 },
  cardT: { fontFamily: F.displayMed, fontSize: 20, color: C.text },
  secT: { fontFamily: F.bodyBold, fontSize: 16, color: C.brass },
  body: { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.textSoft },
  hint: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: C.muted },
  meta: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: C.brassDim },
  label: { fontFamily: F.mono, fontSize: 12, letterSpacing: 1, color: C.brass, textTransform: "uppercase" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tabs: { flexDirection: "row", gap: 8 },
  tab: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: C.panel },
  tabOn: { backgroundColor: C.brass, borderColor: C.brass },
  tabText: { fontFamily: F.bodyMed, fontSize: 15, color: C.text },
  tabTextOn: { color: C.brassInk, fontFamily: F.bodyBold },
  chip: { alignSelf: "flex-start", borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  chipOn: { backgroundColor: C.brass, borderColor: C.brass },
  chipT: { fontFamily: F.monoBold, fontSize: 12, letterSpacing: 1, color: C.muted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  alan: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.panel2 },
  alanOn: { backgroundColor: C.brass, borderColor: C.brass },
  alanT: { fontFamily: F.bodyMed, fontSize: 14, color: C.text },
  alanTOn: { color: C.brassInk, fontFamily: F.bodyBold },
  check: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  box: { width: 22, height: 22, borderRadius: 4, borderWidth: 1, borderColor: C.brassDim, alignItems: "center", justifyContent: "center", marginTop: 2 },
  boxOn: { backgroundColor: C.brass, borderColor: C.brass },
  tick: { fontFamily: F.bodyBold, fontSize: 14, color: C.brassInk },
  checkT: { flex: 1, fontFamily: F.body, fontSize: 14, lineHeight: 20, color: C.textSoft },
  link: { color: C.brass, textDecorationLine: "underline" },
  input: { fontFamily: F.body, fontSize: 16, lineHeight: 22, color: C.text, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, minHeight: 120, maxHeight: 240 },
  inputBad: { borderColor: C.bad },
  counterRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  counter: { fontFamily: F.mono, fontSize: 11, color: C.muted },
  fieldErr: { flex: 1, fontFamily: F.bodyMed, fontSize: 13, color: C.bad },
  msg: { fontFamily: F.bodyMed, fontSize: 15, color: C.bad },
  err: { fontFamily: F.bodyMed, fontSize: 14, color: C.bad },
  pack: { flexGrow: 1, flexBasis: 140, borderWidth: 1, borderColor: C.brass, borderRadius: 10, padding: 14, gap: 2, backgroundColor: C.panel2 },
  packN: { fontFamily: F.bodyBold, fontSize: 16, color: C.text },
  packP: { fontFamily: F.display, fontSize: 24, color: C.brass },
  bullet: { flexDirection: "row", gap: 8 },
  bulletDot: { fontFamily: F.bodyBold, fontSize: 15, lineHeight: 22, color: C.brass },
  bubble: { borderRadius: 12, padding: 12, gap: 4, maxWidth: "92%" },
  bJudge: { alignSelf: "center", backgroundColor: C.bordo, maxWidth: "100%" },
  bMine: { alignSelf: "flex-end", backgroundColor: C.brass },
  bOther: { alignSelf: "flex-start", backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line },
  bWho: { fontFamily: F.monoBold, fontSize: 11, letterSpacing: 1, color: C.brassDim, textTransform: "uppercase" },
  bText: { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.text },
  big: { paddingVertical: 15 },
  yol: { flexDirection: "row", gap: 10, alignItems: "flex-start", borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, backgroundColor: C.panel2 },
  yolOn: { borderColor: C.brass },
  yolT: { fontFamily: F.bodyBold, fontSize: 15, color: C.text },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: C.brassDim, alignItems: "center", justifyContent: "center", marginTop: 2 },
  radioOn: { borderColor: C.brass },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.brass },
  warnBox: { borderWidth: 1, borderColor: C.mid, borderRadius: 10, padding: 12, gap: 6, backgroundColor: "rgba(208,166,76,0.10)" },
  warnBoxT: { fontFamily: F.bodyBold, fontSize: 15, color: C.mid }
});
