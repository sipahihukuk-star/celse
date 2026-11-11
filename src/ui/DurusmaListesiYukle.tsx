// Duruşmalar sekmesi > "UYAP duruşma listesini yükle": avukatın UYAP'tan aldığı duruşma listesi (Excel, PDF, Word, ekran
// görüntüsü ya da kopyalanan metin) okunur, her satır dosya numarası ve mahkemeye göre föyüyle eşleştirilir; avukat önizlemeyi
// görüp onaylayınca günler föylerin duruşmalarına işlenir. Eşleşmeyen satırlar için föy seçilir, yeni föy açılır ya da atlanır.
// Liste bu cihazda okunur; hiçbir yere gönderilmez.
import React, { useMemo, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { DTUR_AD, DTUR_SIMGE } from "../data/durusma";
import { benzerFoyler, eslestir, ListeDurusmasi, ListeEslesmesi, listedenYeniFoy, listeyiIsle, metindenDurusmalar, tablodanDurusmalar, tekillestir } from "../data/durusmaListesi";
import { Foy, foyGetir, foylerKaydet } from "../data/foy";
import { tabloOku } from "../data/foyAktar";
import { t } from "../i18n";
import { Acilir } from "./Acilir";
import { evrakMetniOku, foyKisaAd } from "./foyEvrak";
import { dosyaSec, s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";

const web = Platform.OS === "web";
const trGun = (x: string) => x.slice(0, 10).split("-").reverse().join(".") + (x.length > 10 ? " " + x.slice(11, 16) : "");
const satirYaz = (r: ListeDurusmasi) => [trGun(r.tarih), DTUR_SIMGE[r.tur] + " " + t(DTUR_AD[r.tur]), r.mahkeme, r.esasNo].filter(Boolean).join(" · ");
const GOSTER = 150;

/** Dosyayı okur: tablo (Excel, CSV, Word) önce başlıklarıyla, olmazsa düz metin gibi; PDF ve resim yazı tanımayla. */
async function dosyadanOku(k: { ad: string; bytes: Uint8Array; blob?: Blob }, ilerle: (m: string) => void): Promise<ListeDurusmasi[]> {
  const uz = (k.ad.split(".").pop() || "").toLowerCase();
  if (["xlsx", "xlsm", "csv", "docx", "xls", "doc"].includes(uz)) {
    const tablo = tabloOku(k.ad, k.bytes);
    return tablodanDurusmalar(tablo) || metindenDurusmalar(tablo.map(r => r.map(x => String(x ?? "")).join("\t")).join("\n"));
  }
  if (uz === "txt") return metindenDurusmalar(new TextDecoder("utf-8").decode(k.bytes));
  const o = await evrakMetniOku(k, ilerle);
  if ("hata" in o) throw new Error(o.hata);
  if (!o.metin.trim()) throw new Error(t("Dosyada yazı okunamadı: {e}", { e: o.okunamadi || "" }));
  return metindenDurusmalar(o.metin);
}

export function DurusmaListesiYukle({ liste, onBitti }: { liste: Foy[]; onBitti?: (mesaj: string) => void }) {
  const [okunan, setOkunan] = useState<ListeDurusmasi[] | null>(null);
  const [kaynak, setKaynak] = useState("");
  const [secim, setSecim] = useState<Record<number, string>>({});
  const [yapistir, setYapistir] = useState(false);
  const [metin, setMetin] = useState("");
  const [durum, setDurum] = useState("");
  const [hata, setHata] = useState("");
  const [busy, setBusy] = useState(false);
  const [sonuc, setSonuc] = useState("");

  const eslesme = useMemo(() => (okunan ? eslestir(okunan, liste) : []), [okunan, liste]);
  const bas = (xs: ListeDurusmasi[], ad: string) => {
    const tek = tekillestir(xs);
    setOkunan(tek); setKaynak(ad); setSonuc("");
    const es = eslestir(tek, liste);
    // Varsayılan: eşleşen föye işle; seçim bekleyen ve eşleşmeyen atlanır (avukat seçer).
    setSecim(Object.fromEntries(es.map((e, i) => [i, e.durum === "eslesti" ? e.foy!.id : "atla"])));
    if (!tek.length) setHata(t("Bu listede dosya numarası ve günü birlikte olan satır bulunamadı. UYAP'taki duruşma listesinin Excel ya da PDF çıktısını yükleyin; ya da tabloyu seçip kopyalayıp “Metni yapıştır”a yapıştırın."));
  };
  const dosya = async () => {
    setHata(""); setSonuc("");
    const [k] = await dosyaSec(".xlsx,.xlsm,.csv,.docx,.pdf,.png,.jpg,.jpeg,.heic,.tif,.tiff,.txt,.udf", false);
    if (!k) return;
    setBusy(true); setDurum(t("Okunuyor…"));
    try { bas(await dosyadanOku(k, m => setDurum(t("Okunuyor: {m}", { m }))), k.ad); }
    catch (e) { setOkunan(null); setHata(String((e as Error).message || e)); }
    finally { setBusy(false); setDurum(""); }
  };
  const metinden = () => { setHata(""); bas(metindenDurusmalar(metin), t("yapıştırılan metin")); };

  const say = (d: ListeEslesmesi["durum"]) => eslesme.filter(e => e.durum === d).length;
  const islenecek = eslesme.map((e, i) => ({ e, i, s: secim[i] || "atla" })).filter(x => x.s !== "atla");
  const isle = async () => {
    setBusy(true); setHata("");
    try {
      const foyeGore = new Map<string, ListeDurusmasi[]>();
      const yeniler: Foy[] = [];
      for (const { e, s: sc } of islenecek) {
        if (sc === "yeni") yeniler.push(listedenYeniFoy(e.r));
        else foyeGore.set(sc, [...(foyeGore.get(sc) || []), e.r]);
      }
      const kayit: Foy[] = [];
      for (const [id, xs] of foyeGore) { const f = (await foyGetir(id)) || liste.find(x => x.id === id); if (f) kayit.push(listeyiIsle(f, xs)); }
      await foylerKaydet([...kayit, ...yeniler]);
      const m = t("{n} gün {f} föye işlendi.", { n: islenecek.length - yeniler.length, f: kayit.length }) + (yeniler.length ? " " + t("{y} yeni föy açıldı.", { y: yeniler.length }) : "");
      setSonuc(m); setOkunan(null); setSecim({}); setMetin(""); setYapistir(false);
      onBitti?.(m);
    } catch (e) { setHata(String((e as Error).message || e)); }
    finally { setBusy(false); }
  };

  const satir = (e: ListeEslesmesi, i: number) => {
    const sc = secim[i] || "atla";
    const setS = (v: string) => setSecim(x => ({ ...x, [i]: v }));
    const secenekler = e.durum === "eslesti"
      ? [{ k: e.foy!.id, ad: "✓ " + t("Bu föye işle") }, { k: "atla", ad: t("Atla") }]
      : [{ k: "atla", ad: t("Atla") }, ...(e.durum === "secim" ? e.adaylar : benzerFoyler(e.r, liste)).map(f => ({ k: f.id, ad: foyKisaAd(f).slice(0, 90) })), { k: "yeni", ad: "+ " + t("Yeni föy aç") }];
    return (
      <View key={i} style={{ gap: 4, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.line }}>
        <Text style={[s.body, { fontWeight: "700" }]}>{satirYaz(e.r)}</Text>
        {e.durum === "eslesti" && <Text style={s.hint}>→ {foyKisaAd(e.foy!)}{e.zatenVar ? " · " + t("bu gün föyde zaten kayıtlı") : ""}</Text>}
        {e.durum !== "eslesti" && <Text style={[s.hint, { color: C.bad }]}>{t(e.neden)}{e.r.taraflar ? " · " + e.r.taraflar : ""}</Text>}
        <Acilir etiket="" genislik={300} secili={sc} onSec={setS} secenekler={secenekler} />
      </View>
    );
  };
  const grup = (d: ListeEslesmesi["durum"], baslik: string) => {
    const xs = eslesme.map((e, i) => ({ e, i })).filter(x => x.e.durum === d);
    if (!xs.length) return null;
    return (
      <View style={{ gap: 2 }}>
        <Text style={[s.secT, { marginTop: 8 }]}>{baslik} ({xs.length})</Text>
        {xs.slice(0, GOSTER).map(x => satir(x.e, x.i))}
        {xs.length > GOSTER && <Text style={s.hint}>{t("ve {n} satır daha (bunlar da yukarıdaki seçime göre işlenir)", { n: xs.length - GOSTER })}</Text>}
      </View>
    );
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={s.body}>{t("UYAP Avukat'tan aldığınız duruşma listesini yükleyin: Excel, PDF, Word, ekran görüntüsü ya da sayfadan kopyalanan tablo. Her satır dosya numarası ve mahkemeye göre föyüyle eşleştirilir; onayladığınızda günler o föylerin duruşmalarına işlenir.")}</Text>
      <Text style={s.hint}>{t("Liste bu cihazda okunur, hiçbir yere gönderilmez. Kendiliğinden yeni föy açılmaz; föyü bulunamayan satırlar için siz seçersiniz.")}</Text>
      <View style={s.addRow}>
        {web && <Btn label={busy ? durum || t("Okunuyor…") : t("Dosya seç")} disabled={busy} onPress={dosya} />}
        <Btn kind="secondary" label={yapistir ? t("Yapıştırmayı kapat") : t("Metni yapıştır")} onPress={() => setYapistir(x => !x)} />
      </View>
      {yapistir && (
        <View style={{ gap: 6 }}>
          <TextInput value={metin} onChangeText={setMetin} multiline placeholder={t("UYAP'taki duruşma tablosunu seçip kopyalayın, buraya yapıştırın.")} placeholderTextColor={C.muted} style={[s.input, { minHeight: 120 }]} />
          <View style={s.addRow}><Btn label={t("Listeyi oku")} disabled={!metin.trim()} onPress={metinden} /></View>
        </View>
      )}
      {!!hata && <Text style={s.err}>{hata}</Text>}
      {!!sonuc && <Text style={[s.body, { color: C.good, fontWeight: "700" }]}>✓ {sonuc}</Text>}
      {okunan && okunan.length > 0 && (
        <View style={{ gap: 4 }}>
          <Text style={[s.body, { fontWeight: "700" }]}>{t("{kaynak}: {n} gün okundu", { kaynak, n: okunan.length })}</Text>
          <Text style={s.hint}>{t("✓ {a} föyüyle eşleşti · ? {b} seçim bekliyor · ✗ {c} föyü bulunamadı", { a: say("eslesti"), b: say("secim"), c: say("yok") })}</Text>
          {grup("secim", t("? Hangi föy olduğunu seçin"))}
          {grup("yok", t("✗ Föyü bulunamayanlar (föy seçin, yeni föy açın ya da atlayın)"))}
          {grup("eslesti", t("✓ Föyüyle eşleşenler"))}
          <View style={[s.addRow, { marginTop: 8 }]}>
            <Btn label={busy ? t("İşleniyor…") : t("✓ {n} günü föylere işle", { n: islenecek.length })} disabled={busy || !islenecek.length} onPress={isle} />
            <Pressable onPress={() => { setOkunan(null); setSecim({}); }}><Text style={s.link}>{t("Vazgeç")}</Text></Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
