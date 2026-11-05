// "Evrakla duruşma provası" (beta, yönetici): avukat dosya evrakını yükler (web: UDF, Word, metin; telefonda şimdilik yapıştırma),
// evrak CİHAZDA maskelenir, avukat onay ekranında kodlanan her değeri görür, açık bırakır ya da ek ifade gizler; sunucuya yalnız
// kodlu metin gider ve hiçbir şey kaydedilmez. Gelen hazırlık notları cihazda gerçek adlara geri çevrilir.
import React, { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { Entity, Kind, mask } from "../engine/mask";
import { evrakMetni, turBul } from "../engine/mask/readers";
import { EVRAK_AZAMI, evrakProva, Prova, provaAc, provaMetni } from "../data/evrak";
import { useInnerBack } from "./innerBack";
import { Btn } from "./kit";
import { t } from "../i18n";
import { C, F } from "./theme";

type Adim = "yukle" | "onay" | "bekle" | "sonuc";
interface Evrak { ad: string; metin: string }

const TUR_ADI: Record<Kind, string> = {
  taraf: "Taraflar", sirket: "Şirketler", kisi: "Öteki kişiler", avukat: "Avukatlar", kimlik: "Kimlik ve hesap numaraları", iletisim: "İletişim",
  adres: "Adresler", yer: "Yerler ve birimler", mahkeme: "Mahkeme ve daireler", dosya: "Dosya numaraları", numara: "Öteki numaralar", kurum: "Kurumlar", elle: "Elle gizlenenler"
};
const SIRA: Kind[] = ["taraf", "kisi", "avukat", "sirket", "kimlik", "iletisim", "adres", "mahkeme", "dosya", "yer", "numara", "kurum", "elle"];

/** Web: dosya seçme penceresi; seçilen dosyalar bellekte okunur, hiçbir yere yüklenmez. */
function dosyaSec(): Promise<{ ad: string; bytes: Uint8Array }[]> {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file"; input.multiple = true; input.accept = ".udf,.docx,.txt";
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      resolve(await Promise.all(files.map(async f => ({ ad: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }))));
    };
    input.click();
  });
}

/** Maskelenmiş metinde hâlâ kişisel veri izi: geçerli kimlik no, IBAN, e-posta, cep telefonu, uzun sayılar (sunucu da denetler). */
function riskler(s: string): string[] {
  const out: string[] = [];
  if (/(^|\D)[1-9]\d{10}(?!\d)/.test(s)) out.push(t("11 haneli sayı"));
  if (/\bTR\s?\d{2}(?:\s?\d{4}){5}/i.test(s)) out.push("IBAN");
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(s)) out.push(t("e-posta"));
  if (/(^|\D)(?:\+90|0)?\s?\(?5\d{2}\)?\s?\d{3}\s?\d{2}\s?\d{2}(?!\d)/.test(s)) out.push(t("telefon"));
  return out;
}

export default function EvrakScreen(p: { onBack: () => void }) {
  const [adim, setAdim] = useState<Adim>("yukle");
  const [evraklar, setEvraklar] = useState<Evrak[]>([]);
  const [yapistir, setYapistir] = useState("");
  const [taraf, setTaraf] = useState<"davaci" | "davali">("davaci");
  const [asama, setAsama] = useState("");
  const [allow, setAllow] = useState<string[]>([]);
  const [extra, setExtra] = useState<string[]>([]);
  const [ek, setEk] = useState("");
  const [okudum, setOkudum] = useState(false);
  const [tamami, setTamami] = useState(false);
  const [err, setErr] = useState("");
  const [prova, setProva] = useState<{ kodlu: Prova; acik: Prova; map: Record<string, string> } | null>(null);
  const [kodlu, setKodlu] = useState(false);
  const [kopyalandi, setKopyalandi] = useState(false);

  useInnerBack(adim === "onay" || adim === "sonuc", () => setAdim(adim === "sonuc" ? "onay" : "yukle"));

  const tumMetin = useMemo(() => {
    const parts = evraklar.map((e, i) => `=== ${t("Evrak")} ${i + 1}: ${e.ad.replace(/\.[^.]+$/, "")} ===\n${e.metin}`);
    if (yapistir.trim()) parts.push(`=== ${t("Evrak")} ${parts.length + 1} ===\n${yapistir.trim()}`);
    return parts.join("\n\n");
  }, [evraklar, yapistir]);
  // Evrak adı da kişisel veri taşıyabilir (müvekkil adıyla kaydedilmiş dosya): başlıklar da maskeden geçer.
  const sonuc = useMemo(() => (adim === "yukle" ? null : mask(tumMetin, { allow, extra })), [adim, tumMetin, allow, extra]);
  const risk = sonuc ? riskler(sonuc.masked) : [];

  const ekle = async () => {
    setErr("");
    try {
      const secilen = await dosyaSec();
      const yeni: Evrak[] = [];
      for (const f of secilen) {
        if (!turBul(f.ad)) { setErr(t("{ad}: bu dosya türü henüz okunamıyor. UDF, Word (DOCX) ya da metin dosyası seçin.", { ad: f.ad })); continue; }
        try { yeni.push({ ad: f.ad, metin: evrakMetni(f.ad, f.bytes) }); }
        catch (e) { setErr(`${f.ad}: ${t(String((e as Error).message || e))}`); }
      }
      setEvraklar(l => [...l, ...yeni]);
    } catch { setErr(t("Dosya okunamadı.")); }
  };
  const seciliGizle = () => {
    if (Platform.OS !== "web") return;
    const sel = (window.getSelection?.()?.toString() || "").trim();
    if (sel.length >= 2 && !/^\[[^\]]+\]$/.test(sel)) setExtra(x => (x.includes(sel) ? x : [...x, sel]));
  };
  const gonder = async () => {
    if (!sonuc) return;
    setErr(""); setAdim("bekle");
    const r = await evrakProva(sonuc.masked, taraf, asama.trim());
    if (!r.ok) { setErr(t(r.error, r.vars)); setAdim("onay"); return; }
    setProva({ kodlu: r.data, acik: provaAc(r.data, sonuc.map), map: sonuc.map });
    setKodlu(false); setAdim("sonuc");
  };
  const paylas = async () => {
    if (!prova) return;
    const metin = provaMetni(kodlu ? prova.kodlu : prova.acik, s => t(s));
    if (Platform.OS === "web") {
      try { await navigator.clipboard.writeText(metin); setKopyalandi(true); setTimeout(() => setKopyalandi(false), 2000); } catch { /* yok say */ }
    } else Share.share({ message: metin }).catch(() => {});
  };
  const indir = () => {
    if (!prova || Platform.OS !== "web") return;
    const blob = new Blob([provaMetni(kodlu ? prova.kodlu : prova.acik, s => t(s))], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "durusma-provasi.txt"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const uzun = tumMetin.length > EVRAK_AZAMI;
  const gruplar = useMemo(() => {
    const g = new Map<Kind, Entity[]>();
    for (const e of sonuc?.entities || []) g.set(e.kind, [...(g.get(e.kind) || []), e]);
    return SIRA.filter(k => g.has(k)).map(k => [k, g.get(k)!] as const);
  }, [sonuc]);

  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag">
      <View style={s.head}>
        <Btn kind="ghost" label={t("‹ Geri")} onPress={() => (adim === "yukle" ? p.onBack() : adim === "sonuc" ? setAdim("onay") : adim === "onay" ? setAdim("yukle") : undefined)} />
      </View>
      <Text style={s.eyebrow}>{t("EVRAKLA DURUŞMA PROVASI · DENEME")}</Text>
      <Text style={s.title}>{t("Dosyanızla duruşmaya hazırlanın")}</Text>
      <View style={s.warn}>
        <Text style={s.warnT}>{t("Kişisel veriler cihazınızdan çıkmaz.")}</Text>
        <Text style={s.warnD}>{t("Evrak bu cihazda okunur ve maskelenir: adlar, kimlik ve dosya numaraları, adresler ve mahkeme adları kodlara çevrilir; tarihlerde yalnız ay ve yıl kalır. Sunucuya yalnız sizin onayladığınız kodlu metin gider ve kaydedilmez. Kodların karşılıkları yalnız bu ekranda tutulur; ekrandan çıkınca silinir.")}</Text>
      </View>

      {adim === "yukle" && (
        <View style={s.card}>
          <Text style={s.cardT}>{t("1. Evrakı ekleyin")}</Text>
          {Platform.OS === "web" ? (
            <>
              <Text style={s.hint}>{t("Dilekçe, cevap, bilirkişi raporu, ara karar gibi evrakı seçin: UYAP UDF, Word (DOCX) ya da metin dosyası. PDF ve fotoğraftan okuma sonra gelecek.")}</Text>
              <View style={s.row}><Btn kind="secondary" label={t("Dosya seç")} onPress={ekle} /></View>
            </>
          ) : <Text style={s.hint}>{t("Telefonda şimdilik evrakın metnini aşağıya yapıştırın. Dosyadan okuma web'de açık.")}</Text>}
          {evraklar.map((e, i) => (
            <View key={i} style={s.file}>
              <Text style={s.fileT} numberOfLines={1}>{e.ad}</Text>
              <Text style={s.meta}>{t("{n} karakter", { n: e.metin.length.toLocaleString("tr-TR") })}</Text>
              <Pressable accessibilityRole="button" onPress={() => setEvraklar(l => l.filter((_, j) => j !== i))}><Text style={s.link}>{t("Çıkar")}</Text></Pressable>
            </View>
          ))}
          <Text style={s.label}>{t("Ya da metni yapıştırın")}</Text>
          <TextInput style={s.input} multiline value={yapistir} onChangeText={setYapistir} placeholder={t("Evrakın metni…")} placeholderTextColor={C.muted} />
          <Text style={s.label}>{t("Hangi taraftasınız?")}</Text>
          <View style={s.chips}>
            {([["davaci", "Davacı / başvuran / müşteki"], ["davali", "Davalı / sanık / karşı taraf"]] as const).map(([k, l]) => (
              <Pressable key={k} accessibilityRole="radio" accessibilityState={{ selected: taraf === k }} onPress={() => setTaraf(k)} style={[s.alan, taraf === k && s.alanOn]}>
                <Text style={[s.alanT, taraf === k && s.alanTOn]}>{t(l)}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.label}>{t("Aşama ve beklentiniz (isteğe bağlı)")}</Text>
          <TextInput style={[s.input, { minHeight: 60 }]} multiline value={asama} onChangeText={setAsama} maxLength={200}
            placeholder={t("ör. ilk duruşma, tanık dinlenecek; bilirkişi raporuna itiraz edeceğiz")} placeholderTextColor={C.muted} />
          {!!err && <Text style={s.err}>{err}</Text>}
          {uzun && <Text style={s.err}>{t("Evrak çok uzun. Daha az sayfa seçin.")}</Text>}
          <View style={s.row}>
            <Btn label={t("Maskele ve göster")} disabled={tumMetin.trim().length < 200 || uzun} onPress={() => { setOkudum(false); setAdim("onay"); }} />
          </View>
          {tumMetin.trim().length > 0 && tumMetin.trim().length < 200 && <Text style={s.hint}>{t("En az 200 karakterlik evrak gerekir.")}</Text>}
        </View>
      )}

      {(adim === "onay" || adim === "bekle") && sonuc && (
        <>
          <View style={s.card}>
            <Text style={s.cardT}>{t("2. Maskelemeyi denetleyin")}</Text>
            <Text style={s.hint}>{t("Aşağıdaki değerler kodlara çevrildi. Gizlenmesi gerekmeyen bir değere dokunursanız açık kalır. Kaçan bir ad ya da numara görürseniz aşağıya yazıp gizleyin.")}</Text>
            {gruplar.map(([k, list]) => (
              <View key={k} style={{ gap: 6 }}>
                <Text style={s.label}>{t(TUR_ADI[k])}</Text>
                <View style={s.chips}>
                  {list.map(e => (
                    <Pressable key={e.code} accessibilityRole="button" accessibilityHint={t("Açık bırak")} onPress={() => setAllow(a => [...a, e.value])} style={s.ent}>
                      <Text style={s.entC}>{e.code}</Text>
                      <Text style={s.entV} numberOfLines={1}>{e.value}{e.count > 1 ? `  ×${e.count}` : ""}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            {allow.length > 0 && (
              <View style={{ gap: 6 }}>
                <Text style={s.label}>{t("Açık bırakılanlar (dokunursanız yeniden gizlenir)")}</Text>
                <View style={s.chips}>
                  {allow.map(v => <Pressable key={v} onPress={() => setAllow(a => a.filter(x => x !== v))} style={[s.ent, s.entOpen]}><Text style={s.entV}>{v}</Text></Pressable>)}
                </View>
              </View>
            )}
            <Text style={s.label}>{t("Ayrıca gizle")}</Text>
            <View style={s.addRow}>
              <TextInput style={[s.input, { flex: 1, minHeight: 0 }]} value={ek} onChangeText={setEk} placeholder={t("ör. kaçan bir soyadı ya da yer adı")} placeholderTextColor={C.muted}
                onSubmitEditing={() => { const v = ek.trim(); if (v.length >= 2) { setExtra(x => [...x, v]); setEk(""); } }} returnKeyType="done" />
              <Btn kind="secondary" label={t("Gizle")} disabled={ek.trim().length < 2} onPress={() => { setExtra(x => [...x, ek.trim()]); setEk(""); }} />
            </View>
            {extra.length > 0 && (
              <View style={s.chips}>
                {extra.map(v => <Pressable key={v} onPress={() => setExtra(x => x.filter(y => y !== v))} style={s.ent}><Text style={s.entV}>{v}  ✕</Text></Pressable>)}
              </View>
            )}
          </View>

          <View style={s.card}>
            <Text style={s.cardT}>{t("3. Gönderilecek metin")}</Text>
            <Text style={s.hint}>{Platform.OS === "web" ? t("Sunucuya yalnız bu metin gider. Kaçan bir ifadeyi fareyle seçip “Seçtiğimi gizle”ye basabilirsiniz.") : t("Sunucuya yalnız bu metin gider.")}</Text>
            {Platform.OS === "web" && <View style={s.row}><Btn kind="ghost" label={t("Seçtiğimi gizle")} onPress={seciliGizle} /></View>}
            <View style={s.preview}>
              <Text style={s.pre} selectable>
                {(tamami ? sonuc.masked : sonuc.masked.slice(0, 6000)).split(/(\[[^\]\n]{1,40}\])/).map((part, i) =>
                  i % 2 ? <Text key={i} style={s.code}>{part}</Text> : part)}
              </Text>
            </View>
            {sonuc.masked.length > 6000 && (
              <Pressable onPress={() => setTamami(x => !x)}><Text style={s.link}>{tamami ? t("Kısalt") : t("Tamamını göster ({n} karakter)", { n: sonuc.masked.length.toLocaleString("tr-TR") })}</Text></Pressable>
            )}
            {risk.length > 0 && <Text style={s.err}>{t("Dikkat: metinde hâlâ {x} görünüyor. Gizlemeden gönderilemez.", { x: risk.join(", ") })}</Text>}
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: okudum }} onPress={() => setOkudum(x => !x)} style={s.check}>
              <View style={[s.box, okudum && s.boxOn]}>{okudum && <Text style={s.tick}>✓</Text>}</View>
              <Text style={s.checkT}>{t("Gönderilecek metni denetledim; kişisel veri kalmadı. Hazırlık notlarının yapay zekâ ürünü olduğunu, hata yapabileceğini ve son değerlendirmenin bana ait olduğunu biliyorum.")}</Text>
            </Pressable>
            {!!err && <Text style={s.err}>{err}</Text>}
            <View style={s.row}>
              <Btn label={adim === "bekle" ? t("Hazırlanıyor…") : t("Duruşma provasını hazırla")} disabled={!okudum || risk.length > 0 || adim === "bekle"} onPress={gonder} />
            </View>
            {adim === "bekle" && <Text style={s.hint}>{t("Evrakın uzunluğuna göre bir-iki dakika sürebilir.")}</Text>}
          </View>
        </>
      )}

      {adim === "sonuc" && prova && <ProvaView p={kodlu ? prova.kodlu : prova.acik} />}
      {adim === "sonuc" && prova && (
        <View style={s.card}>
          <Pressable accessibilityRole="switch" accessibilityState={{ checked: kodlu }} onPress={() => setKodlu(x => !x)} style={s.check}>
            <View style={[s.box, kodlu && s.boxOn]}>{kodlu && <Text style={s.tick}>✓</Text>}</View>
            <Text style={s.checkT}>{t("Kodlu hâliyle göster (paylaşmadan önce)")}</Text>
          </Pressable>
          <View style={s.row}>
            <Btn kind="secondary" label={Platform.OS === "web" ? (kopyalandi ? t("Kopyalandı") : t("Kopyala")) : t("Paylaş")} onPress={paylas} />
            {Platform.OS === "web" && <Btn kind="ghost" label={t("Metin olarak indir")} onPress={indir} />}
          </View>
          <Text style={s.hint}>{t("Hazırlık notları kaydedilmez; bu ekrandan çıkınca silinir. Saklamak için kopyalayın ya da indirin.")}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function ProvaView({ p }: { p: Prova }) {
  const Liste = ({ h, xs }: { h: string; xs: string[] }) => (xs.length ? (
    <View style={s.card}><Text style={s.secT}>{t(h)}</Text>{xs.map((x, i) => <Text key={i} style={s.body}>• {x}</Text>)}</View>
  ) : null);
  const Cift = ({ h, xs }: { h: string; xs: { a: string; b: string }[] }) => (xs.length ? (
    <View style={s.card}>
      <Text style={s.secT}>{t(h)}</Text>
      {xs.map((x, i) => (
        <View key={i} style={s.pair}>
          <Text style={s.q}>{i + 1}. {x.a}</Text>
          <Text style={s.body}>→ {x.b}</Text>
        </View>
      ))}
    </View>
  ) : null);
  return (
    <>
      <View style={s.card}><Text style={s.secT}>{t("Özet")}</Text><Text style={s.body} selectable>{p.ozet}</Text></View>
      <Liste h="Çekişmeli konular" xs={p.uyusmazlik} />
      <Cift h="Hâkimin sorabileceği sorular" xs={p.hakimSorulari.map(x => ({ a: x.soru, b: x.cevap }))} />
      <Cift h="Karşı tarafın argümanları ve cevaplarımız" xs={p.karsiArgumanlar.map(x => ({ a: x.arguman, b: x.cevap }))} />
      <Liste h="Zayıf noktalar ve riskler" xs={p.zayif} />
      <Liste h="Eksik delil ve yapılacaklar" xs={p.eksik} />
      <Liste h="Süreler" xs={p.sureler} />
      {!!p.sozlu && <View style={s.card}><Text style={s.secT}>{t("Sözlü beyan taslağı")}</Text><Text style={s.body} selectable>{p.sozlu}</Text></View>}
      {!!p.uyari && <Text style={s.hint}>{p.uyari}</Text>}
    </>
  );
}

const s = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 20, gap: 12 },
  head: { flexDirection: "row" },
  eyebrow: { fontFamily: F.mono, fontSize: 12, letterSpacing: 2.5, color: C.muted, marginTop: 4 },
  title: { fontFamily: F.display, fontSize: 30, color: C.brass },
  warn: { borderWidth: 1, borderColor: C.mid, borderRadius: 10, padding: 12, gap: 4, backgroundColor: "rgba(208,166,76,0.10)" },
  warnT: { fontFamily: F.bodyBold, fontSize: 15, color: C.text },
  warnD: { fontFamily: F.body, fontSize: 13, lineHeight: 19, color: C.textSoft },
  card: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 14, gap: 10 },
  cardT: { fontFamily: F.displayMed, fontSize: 20, color: C.text },
  secT: { fontFamily: F.bodyBold, fontSize: 16, color: C.brass },
  body: { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.textSoft },
  q: { fontFamily: F.bodyBold, fontSize: 15, lineHeight: 22, color: C.text },
  pair: { gap: 4, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: C.line },
  hint: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: C.muted },
  meta: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: C.brassDim },
  label: { fontFamily: F.mono, fontSize: 12, letterSpacing: 1, color: C.brass, textTransform: "uppercase" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  addRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  alan: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.panel2 },
  alanOn: { backgroundColor: C.brass, borderColor: C.brass },
  alanT: { fontFamily: F.bodyMed, fontSize: 14, color: C.text },
  alanTOn: { color: C.brassInk, fontFamily: F.bodyBold },
  ent: { borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.panel2, maxWidth: 320, gap: 2 },
  entOpen: { borderColor: C.mid, borderStyle: "dashed" },
  entC: { fontFamily: F.monoBold, fontSize: 11, color: C.brass },
  entV: { fontFamily: F.body, fontSize: 13, color: C.textSoft },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, minHeight: 120, fontFamily: F.body, fontSize: 15, color: C.text, backgroundColor: C.panel2, textAlignVertical: "top" },
  file: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, backgroundColor: C.panel2 },
  fileT: { flex: 1, fontFamily: F.bodyMed, fontSize: 14, color: C.text },
  preview: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 12, backgroundColor: C.paperHi, maxHeight: 520, overflow: "scroll" as const },
  pre: { fontFamily: F.body, fontSize: 13, lineHeight: 20, color: C.ink },
  code: { fontFamily: F.monoBold, fontSize: 12, color: C.brassInk, backgroundColor: "rgba(140,29,47,0.10)" },
  err: { fontFamily: F.bodyMed, fontSize: 14, lineHeight: 20, color: C.bad },
  link: { fontFamily: F.bodyMed, fontSize: 14, color: C.brass, textDecorationLine: "underline" },
  check: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  box: { width: 22, height: 22, borderRadius: 4, borderWidth: 1, borderColor: C.brassDim, alignItems: "center", justifyContent: "center", marginTop: 2 },
  boxOn: { backgroundColor: C.brass, borderColor: C.brass },
  tick: { fontFamily: F.bodyBold, fontSize: 14, color: C.brassInk },
  checkT: { flex: 1, fontFamily: F.body, fontSize: 14, lineHeight: 20, color: C.textSoft }
});
