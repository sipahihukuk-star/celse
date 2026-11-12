// Beyan editörü > "Dilekçe örneklerim": avukatın kendi dilekçeleri. Dosyadan ya da bütün bir klasörden eklenir; metin cihazda okunur,
// adlar ve numaralar kodlanır, yalnız kodlu hâli saklanır. Beyan yazılırken aynı türden örnekler üslup örneği olarak kullanılır.
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Beyan, BEYAN_KLASORLERI, BEYAN_TURLERI, beyanTuru } from "../data/beyan";
import { bosFoy, Foy, yeniId } from "../data/foy";
import { turBilgi } from "../data/foyTurleri";
import { beyanYazdir } from "./beyanCagri";
import { Katlanir } from "./Katlanir";
import { C } from "./theme";
import { TextInput } from "react-native";
import { DilekceOrnegi, ornekDinle, ornekEkle, ornekGuncelle, ornekler, ornekSil } from "../data/dilekceOrnek";
import { t } from "../i18n";
import { Acilir } from "./Acilir";
import { evrakMetniOku } from "./foyEvrak";
import { dosyaListesiSec, s } from "./foyStil";
import { Btn } from "./kit";

const UZANTI = ["udf", "docx", "doc", "pdf", "txt", "rtf", "tif", "tiff", "jpg", "jpeg", "png"];
const web = Platform.OS === "web";

/** Toplu ekleme (Evrak klasöründeki "Dilekçe örnekleri" alt klasörü de bunu kullanır). */
export async function dosyalardanOrnek(dosyalar: { ad: string; bytes: Uint8Array; yol?: string }[], klasor: string | undefined, ilerle: (m: string) => void): Promise<{ eklenen: number; hatali: string[] }> {
  let eklenen = 0; const hatali: string[] = [];
  let i = 0;
  for (const d of dosyalar) {
    i++;
    const o = await evrakMetniOku({ ad: d.ad, bytes: d.bytes, yol: d.yol }, m => ilerle(`(${i} / ${dosyalar.length}) ${d.ad}: ${m}`));
    if ("hata" in o || !o.metin.trim()) { hatali.push(d.ad); continue; }
    try { await ornekEkle({ ad: d.ad, metin: o.metin, klasor, kaynak: d.yol || d.ad }); eklenen++; } catch { hatali.push(d.ad); }
  }
  return { eklenen, hatali };
}

/**
 * "📥 Dilekçelerimi çek": avukatın bilgisayarındaki dilekçeleri (tek tek ya da bütün klasör) Celse'ye alır. Metin cihazda okunur,
 * adlar ve numaralar gizlenerek saklanır; eşitleme açıksa öteki bilgisayarlara ve telefona da gider. Beyan yazılırken
 * Celse bunlardan örnek alır (üslup ve yapı).
 */
export function DilekceCek({ kisa, onDegisti }: { kisa?: boolean; onDegisti?: () => void }) {
  const [n, setN] = useState<number | null>(null);
  const [ilerleme, setIlerleme] = useState("");
  const [mesaj, setMesaj] = useState("");
  const [bekle, setBekle] = useState(false);
  useEffect(() => { const yukle = () => { ornekler().then(x => setN(x.length)).catch(() => setN(0)); }; yukle(); return ornekDinle(yukle); }, []);
  const cek = async (klasorSec: boolean) => {
    const dosyalar = await dosyaListesiSec(UZANTI, klasorSec);
    if (!dosyalar.length) return;
    setBekle(true); setMesaj("");
    try {
      const r = await dosyalardanOrnek(await Promise.all(dosyalar.map(async f => ({ ad: f.name, bytes: new Uint8Array(await f.arrayBuffer()), yol: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name }))), undefined, setIlerleme);
      setMesaj(t("{n} dilekçe alındı.", { n: r.eklenen }) + (r.hatali.length ? " " + t("Okunamayan ya da gizlenemeyen: {x}", { x: r.hatali.slice(0, 5).join(", ") + (r.hatali.length > 5 ? " …" : "") }) : ""));
      onDegisti?.();
    } finally { setIlerleme(""); setBekle(false); }
  };
  return (
    <View style={[s.card, { gap: 6, borderColor: C.brass }]}>
      <Text style={[s.body, { fontWeight: "800" }]}>{t("📥 Dilekçelerimi çek")}{n ? "  ·  " + t("{n} dilekçeniz kayıtlı", { n }) : ""}</Text>
      {!kisa && <Text style={s.hint}>{t("Bilgisayarınızdaki kendi dilekçelerinizi (UDF, Word, PDF) tek tek ya da bütün klasörüyle Celse'ye alın. Adlar, kimlik ve dosya numaraları, adresler bu cihazda gizlenir; yalnız gizlenmiş hâli saklanır. Eşitleme açıksa öteki bilgisayarlarınıza ve telefonunuza da gider. Beyan yazarken Celse aynı türdeki dilekçelerinizi üslup ve yapı örneği olarak alır; olayları ve adları yeni dosyaya taşımaz.")}</Text>}
      {web ? (
        <View style={s.addRow}>
          <Btn label={bekle ? t("Alınıyor…") : t("📄 Dilekçe dosyalarını seç")} disabled={bekle} onPress={() => cek(false)} />
          <Btn kind="secondary" label={t("📁 Bütün klasörü al")} disabled={bekle} onPress={() => cek(true)} />
        </View>
      ) : <Text style={s.hint}>{t("Dilekçeleri bilgisayardaki Celse'den ekleyin; eşitlemeyle buraya da gelir.")}</Text>}
      {!kisa && <Text style={s.hint}>{t("Başka bir bilgisayardaki dilekçeler için: o bilgisayarda Celse'yi açıp aynı hesapla buradan çekin ya da Celse Klasör programının izlediği evrak klasöründe “Dilekçe örnekleri” adlı bir alt klasöre koyun; kendiliğinden gelir.")}</Text>}
      {!!ilerleme && <Text style={s.hint}>{ilerleme}</Text>}
      {!!mesaj && <Text style={[s.hint, { color: C.good }]}>{mesaj}</Text>}
    </View>
  );
}

export function DilekceOrnekleri({ secili, onSec, yenile }: { secili?: Set<string>; onSec?: (id: string) => void; yenile?: number } = {}) {
  const [xs, setXs] = useState<DilekceOrnegi[]>([]);
  const [hedef, setHedef] = useState("_oto");
  const [goster, setGoster] = useState("_hepsi");
  const [ilerleme, setIlerleme] = useState("");
  const [mesaj, setMesaj] = useState("");
  const [acik, setAcik] = useState<string | null>(null);
  const [bekle, setBekle] = useState(false);
  useEffect(() => { const yukle = () => { ornekler().then(setXs).catch(() => {}); }; yukle(); return ornekDinle(yukle); }, [yenile]);
  const sayilar = useMemo(() => { const m: Record<string, number> = {}; for (const x of xs) m[x.klasor] = (m[x.klasor] || 0) + 1; return m; }, [xs]);
  const liste = goster === "_hepsi" ? xs : xs.filter(x => x.klasor === goster);

  const ekle = async (klasorSec: boolean) => {
    const dosyalar = await dosyaListesiSec(UZANTI, klasorSec);
    if (!dosyalar.length) return;
    setBekle(true); setMesaj("");
    try {
      const r = await dosyalardanOrnek(await Promise.all(dosyalar.map(async f => ({ ad: f.name, bytes: new Uint8Array(await f.arrayBuffer()), yol: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name }))), hedef === "_oto" ? undefined : hedef, setIlerleme);
      setXs(await ornekler());
      setMesaj(t("{n} örnek eklendi.", { n: r.eklenen }) + (r.hatali.length ? " " + t("Okunamayan ya da gizlenemeyen: {x}", { x: r.hatali.slice(0, 5).join(", ") + (r.hatali.length > 5 ? " …" : "") }) : ""));
    } finally { setIlerleme(""); setBekle(false); }
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={s.hint}>{t("Kendi yazdığınız dilekçe, sözleşme ve başvuruları buraya ekleyin. Beyan yazılırken aynı türdeki örnekleriniz yapay zekâya üslup ve yapı örneği olarak verilir; olayları ve adları yeni dosyaya taşınmaz. Dosya bu bilgisayarda okunur; adlar, kimlik ve dosya numaraları, adresler kodlanır ve yalnız kodlu hâli saklanır (asıl dosya saklanmaz).")}</Text>
      {web ? (
        <View style={s.addRow}>
          <Acilir etiket={t("Nereye")} genislik={240} secili={hedef} onSec={setHedef}
            secenekler={[{ k: "_oto", ad: t("Otomatik (metinden anlaşılır)") }, ...BEYAN_KLASORLERI.map(k => ({ k: k.ad, ad: t(k.ad) }))]} />
          <Btn label={bekle ? t("Ekleniyor…") : t("📄 Dosyalardan ekle")} disabled={bekle} onPress={() => ekle(false)} />
          <Btn kind="secondary" label={t("📁 Bütün klasörü ekle")} disabled={bekle} onPress={() => ekle(true)} />
        </View>
      ) : <Text style={s.hint}>{t("Örnekleri bilgisayardaki Celse'den ekleyin.")}</Text>}
      <Text style={s.hint}>{t("Evrak klasörünüzde adı “Dilekçe örnekleri” olan bir alt klasör açarsanız oraya koyduğunuz dosyalar föye değil, buraya gelir (içinde “Sözleşmeler”, “Arabuluculuk” gibi alt klasörler açabilirsiniz).")}</Text>
      {!!ilerleme && <Text style={s.hint}>{ilerleme}</Text>}
      {!!mesaj && <Text style={s.hint}>{mesaj}</Text>}
      {!!xs.length && (
        <Acilir etiket={t("Göster")} genislik={260} secili={goster} onSec={setGoster}
          secenekler={[{ k: "_hepsi", ad: t("Bütün örnekler"), n: xs.length }, ...BEYAN_KLASORLERI.filter(k => sayilar[k.ad]).map(k => ({ k: k.ad, ad: t(k.ad), n: sayilar[k.ad] }))]} />
      )}
      {liste.slice(0, 100).map(x => (
        <View key={x.id} style={[s.file, { flexDirection: "column", alignItems: "stretch", gap: 6 }]}>
          <View style={[s.row, { alignItems: "center", gap: 8 }]}>
            {!!onSec && (
              <Pressable onPress={() => onSec(x.id)} accessibilityRole="checkbox" accessibilityState={{ checked: !!secili?.has(x.id) }} hitSlop={6}
                style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: secili?.has(x.id) ? C.brass : C.muted, backgroundColor: secili?.has(x.id) ? C.brass : "transparent", alignItems: "center", justifyContent: "center" }}>
                {secili?.has(x.id) && <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>✓</Text>}
              </Pressable>
            )}
            <Text style={[s.fileT, { flex: 1 }]} numberOfLines={2}>{x.ad}</Text>
          </View>
          <View style={s.addRow}>
            <Acilir etiket={t("Klasör")} genislik={200} secili={x.klasor} onSec={async k => setXs(await ornekGuncelle(x.id, { klasor: k, tur: BEYAN_KLASORLERI.find(y => y.ad === k)?.turler.some(z => z.ad === x.tur) ? x.tur : undefined }))}
              secenekler={BEYAN_KLASORLERI.map(k => ({ k: k.ad, ad: t(k.ad) }))} />
            <Acilir etiket={t("Belge türü")} genislik={260} secili={x.tur || "_yok"} onSec={async k => setXs(await ornekGuncelle(x.id, { tur: k === "_yok" ? undefined : k }))}
              secenekler={[{ k: "_yok", ad: t("Belirsiz") }, ...(BEYAN_KLASORLERI.find(k => k.ad === x.klasor)?.turler || []).map(z => ({ k: z.ad, ad: t(z.ad) })), ...(x.tur && !BEYAN_TURLERI.includes(x.tur) ? [{ k: x.tur, ad: x.tur }] : [])]} />
          </View>
          <View style={s.addRow}>
            <Pressable onPress={() => setAcik(acik === x.id ? null : x.id)}><Text style={s.link}>{acik === x.id ? t("Gizle") : t("Kodlu metni gör")}</Text></Pressable>
            <Pressable onPress={async () => setXs(await ornekSil(x.id))}><Text style={s.sil}>{t("Sil")}</Text></Pressable>
          </View>
          {acik === x.id && <Text style={[s.hint, { fontFamily: web ? "'Times New Roman', serif" : undefined }]}>{x.metin.slice(0, 4000)}{x.metin.length > 4000 ? " …" : ""}</Text>}
        </View>
      ))}
      {liste.length > 100 && <Text style={s.hint}>{t("… ve {n} örnek daha", { n: liste.length - 100 })}</Text>}
    </View>
  );
}

/** Beyan editörü > "Beyanlarım, dilekçelerim ve örneklerim": Celse'de yazılan bütün beyanlar, yüklenen dilekçe örnekleri ve
 *  seçilen örneklere bakarak yapay zekâyla yeni (genel, yer tutuculu) örnek dilekçe oluşturma. */
export function BeyanKutuphanesi({ liste, serbest, onAc, onTohum }: { liste: Foy[]; serbest: Foy | null; onAc: (foyId: string, beyanId: string) => void; onTohum: (b: Beyan) => void }) {
  const [secili, setSecili] = useState<Set<string>>(new Set());
  const [yenile, setYenile] = useState(0);
  const [klasor, setKlasor] = useState(BEYAN_KLASORLERI[0].ad);
  const [tur, setTur] = useState(BEYAN_KLASORLERI[0].turler[0].ad);
  const [ek, setEk] = useState("");
  const [sonuc, setSonuc] = useState("");
  const [bekle, setBekle] = useState(false);
  const [mesaj, setMesaj] = useState("");
  const [q, setQ] = useState("");
  const beyanlar = useMemo(() => {
    const out: { f: Foy; b: Beyan }[] = [];
    for (const f of [...liste, ...(serbest ? [serbest] : [])]) for (const b of f.beyanlar || []) if (b.metin.trim()) out.push({ f, b });
    const kq = q.trim().toLocaleLowerCase("tr");
    return out.filter(x => !kq || [x.b.tur, x.b.konu, x.f.muvekkil, x.f.mahkeme, x.f.esasNo].join(" ").toLocaleLowerCase("tr").includes(kq))
      .sort((a, c) => (c.b.guncelleme || "").localeCompare(a.b.guncelleme || ""));
  }, [liste, serbest, q]);
  const sec = (id: string) => setSecili(x => { const y = new Set(x); if (y.has(id)) y.delete(id); else y.add(id); return y; });
  const olustur = async () => {
    setBekle(true); setMesaj(""); setSonuc("");
    try {
      const f = bosFoy({ id: "foysuz", muvekkil: "", karsiTaraf: "", mahkeme: "", esasNo: "" });
      const n = new Date().toISOString();
      const b: Beyan = { id: yeniId("by"), olusturma: n, guncelleme: n, tur, konu: "", metin: "" };
      const talimat = t("Seçili örnek dilekçeleri inceleyerek “{tur}” türünde genel, yeniden kullanılabilir bir ÖRNEK dilekçe yaz. Somut kişi, kurum, tarih, numara ve tutar yerine köşeli parantezli yer tutucular kullan ([MÜVEKKİL], [KARŞI TARAF], [MAHKEME], [ESAS NO], [TARİH], [TUTAR]). Örneklerdeki ortak yapıyı, başlıkları, kalıp ifadeleri ve hukuki gerekçe iskeletini koru; örneklerden olay ayrıntısı taşıma.", { tur: t(tur) }) + (ek.trim() ? "\n" + ek.trim() : "");
      const r = await beyanYazdir(f, b, talimat, false, "ids:" + [...secili].join(","));
      if (!r.ok) setMesaj(t(r.hata, r.vars)); else setSonuc(r.metin);
    } finally { setBekle(false); }
  };
  return (
    <View style={{ gap: 10 }}>
      <Katlanir anahtar="kutuphane-beyan" baslik={t("✍ Beyanlarım ({n})", { n: beyanlar.length })} ozet={t("Celse'de yazdığınız bütün beyan ve dilekçeler")}>
        <View style={{ gap: 6 }}>
          <TextInput value={q} onChangeText={setQ} placeholder={t("Ara: tür, konu, müvekkil, merci, numara…")} placeholderTextColor={C.muted} style={s.inputTek} />
          {!beyanlar.length && <Text style={s.hint}>{t("Henüz yazılmış beyan yok.")}</Text>}
          {beyanlar.slice(0, 60).map(({ f, b }) => (
            <View key={f.id + b.id} style={[s.file, { flexDirection: "column", alignItems: "stretch", gap: 3 }]}>
              <Text style={s.fileT} numberOfLines={2}>{b.tur}{b.konu ? " · " + b.konu : ""}</Text>
              <Text style={s.hint}>{f.id === "foysuz" ? t("Föy seçmeden yazılan") : [turBilgi(f.tur).kisa, f.muvekkil, f.mahkeme, f.esasNo].filter(Boolean).join(" · ")}{" · " + new Date(b.guncelleme).toLocaleDateString("tr-TR")}</Text>
              <View style={s.row}>
                <Pressable onPress={() => onAc(f.id, b.id)}><Text style={s.link}>{t("Editörde aç")}</Text></Pressable>
                <Pressable onPress={async () => { try { await ornekEkle({ ad: b.tur + (b.konu ? " – " + b.konu.slice(0, 60) : ""), metin: b.metin, tur: b.tur, klasor: beyanTuru(b.tur).klasor }); setYenile(x => x + 1); setMesaj(t("Örneklerinize eklendi (adlar ve numaralar kodlandı).")); } catch (e) { setMesaj(t(String((e as Error).message || e))); } }}>
                  <Text style={s.link}>{t("📝 Örneklerime ekle")}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </Katlanir>
      <Text style={s.secT}>{t("📝 Dilekçe örneklerim")}</Text>
      <Text style={s.hint}>{t("Elinizdeki bütün dilekçeleri buraya ekleyin. Kutucukla seçtiklerinize bakarak yeni bir örnek oluşturabilirsiniz.")}</Text>
      <DilekceOrnekleri secili={secili} onSec={sec} yenile={yenile} />
      {secili.size > 0 && (
        <View style={[s.warn, { gap: 8 }]}>
          <Text style={[s.body, { fontWeight: "700" }]}>{t("✨ Seçtiğim {n} örneğe bakarak yeni örnek oluştur", { n: secili.size })}{secili.size > 4 ? " " + t("(ilk 4'ü kullanılır)") : ""}</Text>
          <View style={s.addRow}>
            <Acilir etiket={t("Klasör")} genislik={240} secili={klasor} onSec={k => { setKlasor(k); setTur(BEYAN_KLASORLERI.find(x => x.ad === k)!.turler[0].ad); }} secenekler={BEYAN_KLASORLERI.map(k => ({ k: k.ad, ad: t(k.ad) }))} />
            <Acilir etiket={t("Belge türü")} genislik={300} secili={tur} onSec={setTur} secenekler={(BEYAN_KLASORLERI.find(x => x.ad === klasor)?.turler || []).map(x => ({ k: x.ad, ad: t(x.ad) }))} />
          </View>
          <TextInput value={ek} onChangeText={setEk} multiline placeholder={t("İsteğe bağlı ek talimat (örn. iş davası için, kısa tut, Yargıtay kararlarına yer aç)")} placeholderTextColor={C.muted} style={[s.input, { minHeight: 60 }]} />
          <View style={s.addRow}>
            <Btn label={bekle ? t("Oluşturuluyor…") : t("✨ Örnek oluştur")} disabled={bekle} onPress={olustur} />
            <Btn kind="ghost" label={t("Seçimi temizle")} onPress={() => setSecili(new Set())} />
          </View>
          {!!sonuc && (
            <View style={{ gap: 6 }}>
              <Text style={[s.body, { fontFamily: web ? "'Times New Roman', serif" : undefined, backgroundColor: "#fbfaf6", color: "#111", padding: 10, borderRadius: 8 }]}>{sonuc}</Text>
              <View style={s.addRow}>
                <Btn label={t("📝 Örneklerime kaydet")} onPress={async () => { try { await ornekEkle({ ad: t("Celse örneği – {t}", { t: t(tur) }), metin: sonuc, tur, klasor: beyanTuru(tur).klasor }); setYenile(x => x + 1); setMesaj(t("Yeni örnek kaydedildi.")); } catch (e) { setMesaj(t(String((e as Error).message || e))); } }} />
                <Btn kind="secondary" label={t("Editörde aç ve düzenle")} onPress={() => { const n = new Date().toISOString(); onTohum({ id: yeniId("by"), olusturma: n, guncelleme: n, tur, konu: "", metin: sonuc }); }} />
              </View>
            </View>
          )}
        </View>
      )}
      {!!mesaj && <Text style={s.hint}>{mesaj}</Text>}
    </View>
  );
}
