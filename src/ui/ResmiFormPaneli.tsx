// Beyan editörü > Resmî form: seçilen belge türünün resmî formu (Tazminat Komisyonu Word formları, AYM bireysel başvuru,
// Sigorta Tahkim Komisyonu online başvurusu). Alanlar föyden ve vekil bilgilerinden dolar, düzeltilebilir; Word formu kurumun
// kendi şablonuyla doldurulup indirilir, çevrimiçi başvuruda her alan "Kopyala" ile sitedeki kutuya yapıştırılır.
import React, { useMemo, useState } from "react";
import { Linking, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Beyan, docxOlustur, udfOlustur } from "../data/beyan";
import type { Foy } from "../data/foy";
import { docxFormDoldur, formBul, formMetni, formOnDoldur, turFormlari, VekilKunye } from "../data/resmiForm";
import { t } from "../i18n";
import { Acilir } from "./Acilir";
import { indir, s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";

const web = Platform.OS === "web";
const VEKIL_ANAHTAR = "celse-vekil";
const vekilOku = (ad: string): VekilKunye => {
  let v: VekilKunye & { baroNo?: string } = {};
  try { v = JSON.parse(globalThis.localStorage?.getItem(VEKIL_ANAHTAR) || "{}"); } catch { /* yok say */ }
  return { ...v, ad: ad || v.ad };
};
const kopyala = async (x: string) => { try { await (globalThis.navigator as Navigator | undefined)?.clipboard?.writeText(x); return true; } catch { return false; } };
const dosyaAdi = (f: Foy, ad: string, uz: string) => `${ad}${f.esasNo ? "-" + f.esasNo.replace(/[^\w]+/g, "-") : ""}.${uz}`.replace(/\s+/g, "-");

export function ResmiFormPaneli({ f, b, vekilAd, onKaydet }: { f: Foy; b: Beyan; vekilAd: string; onKaydet: (b: Beyan) => void }) {
  const formlar = turFormlari(b.tur);
  const [secili, setSecili] = useState(b.form?.id && formlar.some(x => x.id === b.form!.id) ? b.form.id : formlar[0]?.id || "");
  const [vekil, setVekilHam] = useState<VekilKunye>(() => vekilOku(vekilAd));
  const [vekilAc, setVekilAc] = useState(false);
  const [bilgi, setBilgi] = useState("");
  const form = formBul(secili) || formlar[0];
  const kayitli = b.form?.id === form?.id ? b.form.alanlar : {};
  const d = useMemo(() => (form ? formOnDoldur(form, f, b, { ...vekil, ad: vekilAd || vekil.ad }, kayitli) : {}), [form, f, b, vekil, vekilAd, kayitli]);
  if (!form) return null;
  const degis = (k: string, v: string) => onKaydet({ ...b, form: { id: form.id, alanlar: { ...kayitli, [k]: v } } });
  const sifirla = (k: string) => { const a = { ...kayitli }; delete a[k]; onKaydet({ ...b, form: { id: form.id, alanlar: a } }); };
  const setVekil = (ek: Partial<VekilKunye>) => {
    const v = { ...vekil, ...ek }; setVekilHam(v);
    try { const eski = JSON.parse(globalThis.localStorage?.getItem(VEKIL_ANAHTAR) || "{}"); globalThis.localStorage?.setItem(VEKIL_ANAHTAR, JSON.stringify({ ...eski, ...ek })); } catch { /* yok say */ }
  };
  const wordIndir = async () => {
    setBilgi("");
    try {
      const r = await fetch("./formlar/" + form.dosya);
      if (!r.ok) throw new Error(String(r.status));
      const cikti = docxFormDoldur(new Uint8Array(await r.arrayBuffer()), form, d);
      indir(dosyaAdi(f, form.kisa, "docx"), new Blob([cikti as BlobPart], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
      setBilgi(t("Resmî form dolduruldu ve indirildi. Word'de açıp kontrol edin; imzalayıp eklerle birlikte gönderin."));
    } catch (e) { setBilgi(t("Form şablonu alınamadı: {e}", { e: String((e as Error).message || e) })); }
  };
  const nushaIndir = (uz: "docx" | "udf") => {
    const m = formMetni(form, d);
    const veri = uz === "udf" ? udfOlustur(m, 0, true) : docxOlustur(m, 0, true);
    indir(dosyaAdi(f, form.kisa, uz), new Blob([veri as BlobPart], { type: uz === "udf" ? "application/octet-stream" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
  };
  let bolum = "";
  return (
    <View style={{ gap: 8, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12 }}>
      <Text style={[s.secT, { marginTop: 0 }]}>{t("📋 Resmî form")}</Text>
      {formlar.length > 1 && (
        <Acilir etiket={t("Hangi form")} genislik={380} secili={form.id} onSec={setSecili} secenekler={formlar.map(x => ({ k: x.id, ad: t(x.ad) }))} />
      )}
      <Text style={s.hint}>{t(form.aciklama)}</Text>
      <Text style={s.hint}>{t("Alanlar föyden, müvekkil bilgilerinden ve vekil bilgilerinizden doldu; düzeltebilirsiniz. Bu bilgiler yalnız bu cihazda (eşitlemede şifreli) durur, yapay zekâya gönderilmez.")}</Text>
      <Pressable onPress={() => setVekilAc(x => !x)}><Text style={s.link}>{vekilAc ? t("Vekil bilgilerini gizle") : t("Vekil bilgileriniz (bir kez yazılır)")}</Text></Pressable>
      {vekilAc && (
        <View style={s.addRow}>
          {([["baro", "Kayıtlı olduğu baro (örn. İzmir Barosu)"], ["baroNo", "Baro sicil no"], ["tc", "T.C. kimlik no"], ["telefon", "Telefon"], ["eposta", "E-posta"], ["adres", "Yazışma adresi"]] as [keyof VekilKunye, string][]).map(([k, et]) => (
            <TextInput key={k} value={vekil[k] || ""} onChangeText={x => setVekil({ [k]: x })} placeholder={t(et)} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1, minWidth: k === "adres" ? 320 : 180 }]} />
          ))}
        </View>
      )}
      {form.alanlar.map(a => {
        const baslik = a.bolum && a.bolum !== bolum ? (bolum = a.bolum) : "";
        const elle = kayitli[a.k] !== undefined;
        return (
          <View key={a.k} style={{ gap: 3 }}>
            {!!baslik && <Text style={[s.hint, { fontWeight: "800", letterSpacing: 1, marginTop: 6 }]}>{t(baslik).toLocaleUpperCase("tr")}</Text>}
            <View style={[s.row, { alignItems: "center", gap: 8, flexWrap: "wrap" }]}>
              <Text style={[s.body, { flex: 1, minWidth: 180 }]}>{t(a.etiket)}</Text>
              {form.tip === "cevrimici" && <Pressable onPress={async () => setBilgi((await kopyala(d[a.k] || "")) ? t("“{a}” kopyalandı; sitedeki kutuya yapıştırın.", { a: t(a.etiket) }) : t("Kopyalanamadı; metni seçip kopyalayın."))}><Text style={s.link}>{t("Kopyala")}</Text></Pressable>}
              {elle && <Pressable onPress={() => sifirla(a.k)}><Text style={s.link}>{a.k === "aciklamalar" || a.k === "olaylar" ? t("↺ beyan metnini al") : t("↺ föydeki değer")}</Text></Pressable>}
            </View>
            {a.secenek && !a.cok
              ? <Acilir etiket="" genislik={240} secili={d[a.k] || ""} onSec={x => degis(a.k, x)} secenekler={[{ k: "", ad: t("Seçiniz") }, ...a.secenek.map(x => ({ k: x, ad: t(x) }))]} />
              : <TextInput value={d[a.k] || ""} onChangeText={x => degis(a.k, x)} multiline={!!a.cok} placeholder={a.ipucu ? t(a.ipucu) : ""} placeholderTextColor={C.muted}
                  style={[a.cok ? s.input : s.inputTek, a.cok ? { minHeight: a.k === "aciklamalar" || a.k === "olaylar" ? 140 : 70 } : null]} />}
          </View>
        );
      })}
      {!!bilgi && <Text style={[s.hint, { color: C.good }]}>{bilgi}</Text>}
      <View style={s.addRow}>
        {form.tip === "docx" && web && <Btn label={t("📄 Resmî formu doldur ve indir (Word)")} onPress={wordIndir} />}
        {form.tip === "cevrimici" && !!form.site && <Btn label={t("🌐 Başvuru sitesini aç")} onPress={() => Linking.openURL(form.site!)} />}
        {form.tip === "cevrimici" && <Btn kind="secondary" label={t("Hepsini kopyala")} onPress={async () => setBilgi((await kopyala(formMetni(form, d))) ? t("Bütün alanlar sırasıyla kopyalandı.") : t("Kopyalanamadı."))} />}
        {form.tip === "cevrimici" && web && <Btn kind="secondary" label={t("Yazdırılabilir nüsha (Word)")} onPress={() => nushaIndir("docx")} />}
        {form.tip === "cevrimici" && web && <Btn kind="ghost" label={t("UDF")} onPress={() => nushaIndir("udf")} />}
      </View>
    </View>
  );
}
