// "Derdini anlat": oyuncu kendi olayını dört kutuya yazar; ücretsiz eksik bilgi denetiminden geçince 1 krediyle
// eğitim amaçlı değerlendirme, aynı kredi içinde duruşma canlandırması ve en çok 5 takip sorusu alır.
// Eğitim amaçlı canlandırmadır, hukuki görüş değildir (1136 sayılı Avukatlık Kanunu m.35).
import React, { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  ALANLAR, alanAdi, ASGARI, AZAMI, BOS_FORM, canlandir, Cevap, cevaplariEkle, Danisma, DanismaForm, Degerlendirme, deleteDanisma,
  degerlendir, formHatalari, kontrolEt, Kutu, listDanismalar, Soru, takipSor, TAKIP_HAKKI
} from "../data/danisma";
import { CreditInfo, PRODUCTS } from "../data/purchaseIds";
import { buyConsumable, getCreditProducts, PURCHASES_AVAILABLE } from "../data/purchases";
import { refreshPremium, usePremium } from "../data/subscription";
import { locale, t } from "../i18n";
import { kbBar } from "./KeyboardBar";
import { Btn } from "./kit";
import { StoreLinks } from "./StoreLinks";
import { C, F } from "./theme";

interface Props { onBack: () => void; onSignIn: () => void; onSignUp: () => void; signedIn: boolean; server: boolean; admin: boolean }

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
  ["kapanis", "Bir avukata danışın"]
];
/** Mağaza fiyatı alınamazsa gösterilen fiyatlar (KDV dahil). */
const PAKETLER = [{ productId: PRODUCTS.derdini1, credits: 1, price: "₺149,99" }, { productId: PRODUCTS.derdini3, credits: 3, price: "₺349,99" }];

const errText = (r: Cevap<unknown>) => (r.ok ? "" : t(r.error, r.vars));

export default function DanismaScreen(p: Props) {
  const [view, setView] = useState<"yeni" | "gecmis" | "sonuc">("yeni");
  const [list, setList] = useState<Danisma[] | null>(null);
  const [open, setOpen] = useState<Danisma | null>(null);
  const reload = () => listDanismalar().then(setList).catch(() => setList([]));
  useEffect(() => { if (p.signedIn) reload(); }, [p.signedIn]);

  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
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
          {view === "yeni" && <NewForm admin={p.admin} onDone={d => { setOpen(d); setView("sonuc"); reload(); }} />}
          {view === "gecmis" && <History list={list} onOpen={d => { setOpen(d); setView("sonuc"); }} onDeleted={reload} />}
          {view === "sonuc" && open && <Result key={open.id} d={open} onChange={d => { setOpen(d); setList(l => l?.map(x => (x.id === d.id ? d : x)) || l); }} />}
        </>
      )}
    </ScrollView>
  );
}

function Disclaimer() {
  return (
    <View style={s.warn}>
      <Text style={s.warnT}>{t("Eğitim amaçlı canlandırmadır, hukuki görüş değildir.")}</Text>
      <Text style={s.warnD}>{t("Avukatlık Kanunu m.35 uyarınca hukuki görüş yalnız avukatlarca verilir. Gerçek ad, soyad ya da T.C. kimlik numarası yazmayın; kişilerden rolleriyle söz edin (işveren, kiracı, eş gibi). Somut işiniz için bir avukata danışın.")}</Text>
    </View>
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
  const [busy, setBusy] = useState<"" | "kontrol" | "degerlendir">("");
  const [msg, setMsg] = useState<{ t: string; ok?: boolean } | null>(null);
  // Form değişince önceki "yeterli" onayı düşer: değerlendirme yalnız denetlenen metne yapılır.
  const setForm = (f: DanismaForm) => { setFormRaw(f); setOnay(null); };
  const errs = formHatalari(form);
  const complete = Object.keys(errs).length === 0;
  const canStart = !!onay && (admin || credits > 0) && !busy;

  const check = async (f: DanismaForm = form) => {
    setShown(true); setMsg(null);
    if (Object.keys(formHatalari(f)).length) { setMsg({ t: t("Bilgiler eksik. Kırmızıyla işaretli alanları tamamlamadan devam edemezsiniz.") }); return; }
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
    const r = await degerlendir(form, onay);
    setBusy("");
    if (!r.ok) {
      if (r.status === 409) setOnay(null);
      refreshPremium();
      return setMsg({ t: errText(r) + (r.iade ? " " + t("Krediniz düşülmedi.") : "") });
    }
    refreshPremium();
    const d: Danisma = { ...form, id: r.data.id, durum: "hazir", degerlendirme: r.data.degerlendirme, canlandirma: null, takip: [], kalan_takip: r.data.kalan_takip, created_at: new Date().toISOString() };
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
            <TextInput {...kbBar} multiline value={form[k]} onChangeText={v => setForm({ ...form, [k]: v })} maxLength={AZAMI}
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
              <TextInput {...kbBar} multiline value={cevaplar[i] || ""} onChangeText={v => setCevaplar(c => c.map((x, j) => (j === i ? v : x)))}
                style={[s.input, { minHeight: 64 }]} textAlignVertical="top" placeholderTextColor={C.muted} placeholder={t("Cevabınız")} />
            </View>
          ))}
          <Btn label={busy === "kontrol" ? t("Denetleniyor…") : t("Cevapları ekle ve yeniden denetle")} disabled={!!busy} onPress={addAnswers} />
        </View>
      )}

      {!!msg && <Text style={[s.msg, msg.ok && { color: C.good }]}>{msg.t}</Text>}

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
function History({ list, onOpen, onDeleted }: { list: Danisma[] | null; onOpen: (d: Danisma) => void; onDeleted: () => void }) {
  const [ask, setAsk] = useState<string | null>(null);
  if (list === null) return <Text style={s.hint}>{t("Yükleniyor…")}</Text>;
  if (!list.length) return <Text style={s.body}>{t("Henüz danışmanız yok.")}</Text>;
  return (
    <View style={{ gap: 10 }}>
      {list.map(d => (
        <View key={d.id} style={s.card}>
          <Text style={s.meta}>{t(alanAdi(d.alan)).toLocaleUpperCase(locale())} · {new Date(d.created_at).toLocaleDateString(locale())}</Text>
          <Text style={s.body} numberOfLines={3}>{d.olay}</Text>
          <View style={s.row}>
            <Btn label={t("Aç")} onPress={() => onOpen(d)} />
            {ask === d.id ? (
              <>
                <Btn kind="ghost" label={t("Vazgeç")} onPress={() => setAsk(null)} />
                <Btn kind="ghost" label={t("Evet, kalıcı olarak sil")} onPress={async () => { setAsk(null); await deleteDanisma(d.id); onDeleted(); }} />
              </>
            ) : <Btn kind="ghost" label={t("Sil")} onPress={() => setAsk(d.id)} />}
          </View>
        </View>
      ))}
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

function Result({ d, onChange }: { d: Danisma; onChange: (d: Danisma) => void }) {
  const [taraf, setTaraf] = useState<"davaci" | "davali">("davaci");
  const [busy, setBusy] = useState<"" | "canlandir" | "takip">("");
  const [soru, setSoru] = useState("");
  const [msg, setMsg] = useState("");
  const deg = d.degerlendirme;
  const play = async () => {
    setBusy("canlandir"); setMsg("");
    const r = await canlandir(d.id, taraf);
    setBusy("");
    if (!r.ok) return setMsg(errText(r));
    onChange({ ...d, canlandirma: r.data.canlandirma });
  };
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
  const name = (rol: string, ad?: string) => ad || (rol === "hakim" ? t("Hâkim") : rol === "davaci" ? t("Davacı vekili") : t("Davalı vekili"));

  return (
    <View style={{ gap: 14 }}>
      <Text style={s.meta}>{t(alanAdi(d.alan)).toLocaleUpperCase(locale())} · {new Date(d.created_at).toLocaleDateString(locale())}</Text>
      {!deg ? <Text style={s.body}>{t("Değerlendirme bulunamadı.")}</Text> : deg.metin && !deg.nitelik ? (
        <View style={s.card}><Paras text={deg.metin} /></View>
      ) : BOLUM.map(([k, title], i) => (
        <View key={k} style={[s.card, k === "kapanis" && { borderColor: C.brass }]}>
          <Text style={s.secT}>{k === "kapanis" ? "" : `${i + 1}. `}{t(title)}</Text>
          <Paras text={String(deg[k] || "")} />
        </View>
      ))}
      <Disclaimer />

      <View style={s.card}>
        <Text style={s.cardT}>{t("Duruşmayı canlandır")}</Text>
        {!c ? (
          <>
            <Text style={s.hint}>{t("Aynı kredinin içindedir. Davacı ve davalı vekilleri birkaç tur konuşur; sonunda hâkim eğitim amaçlı bir değerlendirme yapar. Bir kez üretilir.")}</Text>
            <View style={s.row}>
              {(["davaci", "davali"] as const).map(x => (
                <Pressable key={x} accessibilityRole="radio" accessibilityState={{ checked: taraf === x }} onPress={() => setTaraf(x)} style={[s.alan, taraf === x && s.alanOn]}>
                  <Text style={[s.alanT, taraf === x && s.alanTOn]}>{x === "davaci" ? t("Ben davacı tarafıyım") : t("Ben davalı tarafıyım")}</Text>
                </Pressable>
              ))}
            </View>
            <Btn label={busy === "canlandir" ? t("Duruşma hazırlanıyor…") : t("Duruşmayı canlandır")} disabled={!!busy} onPress={play} />
          </>
        ) : (
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
                <Text style={s.secT}>{t("Hâkimin eğitim amaçlı değerlendirmesi")}</Text>
                <Paras text={c.degerlendirme} />
              </View>
            )}
          </View>
        )}
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
            <TextInput {...kbBar} multiline value={soru} onChangeText={setSoru} maxLength={1000} style={[s.input, { minHeight: 64 }]} textAlignVertical="top"
              placeholderTextColor={C.muted} placeholder={t("Sorunuzu yazın")} accessibilityLabel={t("Takip sorusu")} />
            <Btn label={busy === "takip" ? t("Cevaplanıyor…") : t("Sor ({k} hak kaldı)", { k: d.kalan_takip })} disabled={!!busy} onPress={ask} />
          </>
        )}
      </View>
      {!!msg && <Text style={s.msg}>{msg}</Text>}
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
  input: { fontFamily: F.body, fontSize: 16, lineHeight: 22, color: C.text, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, minHeight: 120 },
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
  bText: { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.text }
});
