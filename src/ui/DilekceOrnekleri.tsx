// Beyan editörü > "Dilekçe örneklerim": avukatın kendi dilekçeleri. Dosyadan ya da bütün bir klasörden eklenir; metin cihazda okunur,
// adlar ve numaralar kodlanır, yalnız kodlu hâli saklanır. Beyan yazılırken aynı türden örnekler üslup örneği olarak kullanılır.
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { BEYAN_KLASORLERI, BEYAN_TURLERI } from "../data/beyan";
import { DilekceOrnegi, ornekEkle, ornekGuncelle, ornekler, ornekSil } from "../data/dilekceOrnek";
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

export function DilekceOrnekleri() {
  const [xs, setXs] = useState<DilekceOrnegi[]>([]);
  const [hedef, setHedef] = useState("_oto");
  const [goster, setGoster] = useState("_hepsi");
  const [ilerleme, setIlerleme] = useState("");
  const [mesaj, setMesaj] = useState("");
  const [acik, setAcik] = useState<string | null>(null);
  const [bekle, setBekle] = useState(false);
  useEffect(() => { ornekler().then(setXs).catch(() => {}); }, []);
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
          <Text style={s.fileT} numberOfLines={2}>{x.ad}</Text>
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
