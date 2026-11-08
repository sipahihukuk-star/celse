// Dava takibi: föy listesi, yaklaşan duruşma ve işler, föy sayfası (künye, evrak, görevler, yapay zekâ değerlendirmesi),
// Excel/Word'den toplu föy, yedek. Her şey bu cihazda (src/data/foy.ts); yapay zekâya yalnız kodlanmış metin gider.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { bosFoy, dosyaOku, dosyaSil, dosyaYaz, Foy, foyBaslik, foyDestekli, foyDinle, FoyEvrak, foyGetir, foyKaydet, foyler as foyListesi, foylerKaydet, foySil, Gorev, kacGun, tarihCoz, tarihYaz, yedekMetni, yedektenYukle, yeniId } from "../data/foy";
import { AktarimSonucu, birlestir, tabloOku, tablodanFoyler } from "../data/foyAktar";
import { evrakMetni, turBul, zipIcerigi } from "../engine/mask/readers";
import { mask, unmask } from "../engine/mask";
import { DOGRUDAN_SINIR } from "../engine/mask/derleme";
import { evrakProva } from "../data/evrak";
import { setAvukatKalan, usePremium } from "../data/subscription";
import { EVRAK_KREDI } from "../data/purchaseIds";
import { useInnerBack } from "./innerBack";
import { IconBadge } from "./icons";
import { Btn } from "./kit";
import { t } from "../i18n";
import { C, F } from "./theme";

type Kaynak = { ad: string; bytes: Uint8Array; blob?: Blob };
function dosyaSec(accept: string, coklu = true): Promise<Kaynak[]> {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file"; input.multiple = coklu; input.accept = accept;
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      resolve(await Promise.all(files.map(async f => ({ ad: f.name, bytes: new Uint8Array(await f.arrayBuffer()), blob: f }))));
    };
    input.click();
  });
}
function indir(ad: string, icerik: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(icerik); a.download = ad; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
const boyutYaz = (n: number) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
const gunYaz = (g?: number) => (g === undefined ? "" : g === 0 ? t("bugün") : g === 1 ? t("yarın") : g > 0 ? t("{n} gün sonra", { n: g }) : t("{n} gün geçti", { n: -g }));

export default function FoyScreen(p: { onBack: () => void; onHazirlan: (f: Foy) => void; ucretsiz?: boolean }) {
  const [liste, setListe] = useState<Foy[]>([]);
  const [yuklendi, setYuklendi] = useState(false);
  const [secili, setSecili] = useState<string | null>(null);
  const [aktar, setAktar] = useState(false);
  const [ara, setAra] = useState("");
  const [filtre, setFiltre] = useState<"acik" | "kapali" | "hepsi">("acik");
  const [mesaj, setMesaj] = useState<{ t: string; ok?: boolean } | null>(null);
  const yenile = () => foyListesi().then(x => { setListe(x); setYuklendi(true); }).catch(() => setYuklendi(true));
  useEffect(() => { yenile(); return foyDinle(yenile); }, []);
  useInnerBack(!!secili || aktar, () => { setSecili(null); setAktar(false); });

  if (Platform.OS !== "web" || !foyDestekli()) {
    return (
      <ScrollView contentContainerStyle={s.wrap}>
        <View style={s.head}><Btn kind="ghost" label={t("‹ Geri")} onPress={p.onBack} /></View>
        <Text style={s.title}>{t("Dava takibi")}</Text>
        <Text style={s.body}>{t("Dava takibi şimdilik bilgisayarda çalışır: celse.themiscode.com adresini bilgisayarınızda Chrome ya da Edge ile açın. Föyler o bilgisayarda saklanır.")}</Text>
      </ScrollView>
    );
  }
  if (aktar) return <Aktar mevcut={liste} onBitti={(n) => { setAktar(false); if (n) setMesaj({ t: n, ok: true }); }} />;
  if (secili) return <FoySayfa id={secili} onKapat={() => setSecili(null)} onHazirlan={p.onHazirlan} ucretsiz={p.ucretsiz} />;

  const q = ara.trim().toLocaleLowerCase("tr");
  const gorunen = liste
    .filter(f => filtre === "hepsi" || f.durum === filtre)
    .filter(f => !q || [f.muvekkil, f.karsiTaraf, f.mahkeme, f.esasNo, f.davaTuru, f.notlar].join(" ").toLocaleLowerCase("tr").includes(q))
    .sort((a, b) => (a.durusma || "9999").localeCompare(b.durusma || "9999") || b.guncelleme.localeCompare(a.guncelleme));
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

  const yeni = async () => { const f = bosFoy(); await foyKaydet(f); setSecili(f.id); };
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
        <Text style={s.warnT}>{t("Föyleriniz yalnız bu bilgisayarda saklanır.")}</Text>
        <Text style={s.warnD}>{t("Künye, evrak ve görevler sunucuya gitmez. Yapay zekâ değerlendirmesinde yalnız cihazda kodlanmış metin gönderilir ve kaydedilmez. Bilgisayar değişirse ya da tarayıcı verisi silinirse föyler kaybolur; düzenli olarak yedek alın.")}</Text>
        <View style={s.row}>
          <Btn kind="ghost" label={t("Yedeği indir")} onPress={yedekAl} />
          <Btn kind="ghost" label={t("Yedekten yükle")} onPress={yedekYukle} />
        </View>
      </View>

      <View style={s.row}>
        <Btn label={t("+ Yeni föy")} onPress={yeni} />
        <Btn kind="secondary" label={t("Excel ya da Word'den toplu ekle")} onPress={() => setAktar(true)} />
      </View>
      {mesaj && <Text style={[s.hint, { color: mesaj.ok ? C.good : C.bad }]}>{mesaj.t}</Text>}

      {yaklasan.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardT}>{t("Yaklaşanlar (14 gün)")}</Text>
          {yaklasan.slice(0, 20).map((y, i) => (
            <Pressable key={i} onPress={() => setSecili(y.f.id)} style={({ pressed }) => [s.yak, pressed && { opacity: 0.8 }]}>
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
        {yuklendi && liste.length === 0 && <Text style={s.body}>{t("Henüz föy yok. “+ Yeni föy” ile tek tek ekleyin ya da dosya listenizi Excel veya Word tablosundan toplu olarak aktarın.")}</Text>}
        {gorunen.map(f => {
          const g = kacGun(f.durusma);
          const acikGorev = f.gorevler.filter(x => !x.bitti).length;
          return (
            <Pressable key={f.id} onPress={() => setSecili(f.id)} style={({ pressed }) => [s.foy, pressed && { opacity: 0.85 }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.foyT} numberOfLines={1}>{foyBaslik(f)}</Text>
                <Text style={s.hint} numberOfLines={1}>{[f.mahkeme, f.esasNo, f.davaTuru].filter(Boolean).join(" · ") || t("Mahkeme ve esas no yazılmamış")}</Text>
                <Text style={s.meta}>{[f.taraf === "davali" ? t("DAVALI VEKİLİ") : t("DAVACI VEKİLİ"), t("{n} EVRAK", { n: f.evraklar.length }), acikGorev ? t("{n} AÇIK İŞ", { n: acikGorev }) : ""].filter(Boolean).join(" · ")}</Text>
              </View>
              {!!f.durusma && <Text style={[s.foyD, g !== undefined && g >= 0 && g <= 7 && { color: C.brass }]}>{tarihYaz(f.durusma)}{"\n"}<Text style={s.hint}>{gunYaz(g)}</Text></Text>}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
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

/* ---------- föy sayfası ---------- */
function FoySayfa({ id, onKapat, onHazirlan, ucretsiz }: { id: string; onKapat: () => void; onHazirlan: (f: Foy) => void; ucretsiz?: boolean }) {
  const [f, setF] = useState<Foy | null>(null);
  const [okuma, setOkuma] = useState("");
  const [err, setErr] = useState("");
  const [yeniGorev, setYeniGorev] = useState("");
  const [gorevTarih, setGorevTarih] = useState("");
  const [durusmaYazi, setDurusmaYazi] = useState("");
  const [silOnay, setSilOnay] = useState(false);
  const [degerlendiriliyor, setDegerlendiriliyor] = useState(false);
  const prem = usePremium();
  const bedava = !!ucretsiz || prem.evrak;
  const zaman = useRef<ReturnType<typeof setTimeout> | null>(null);
  const son = useRef<Foy | null>(null);
  useEffect(() => { foyGetir(id).then(x => { if (x) { setF(x); setDurusmaYazi(x.durusma ? tarihYaz(x.durusma) : ""); } }); }, [id]);
  // Her değişiklik yarım saniye sonra kaydedilir; ekrandan çıkarken bekleyen kayıt hemen yazılır.
  const degistir = (ek: Partial<Foy>) => setF(x => {
    if (!x) return x;
    const y = { ...x, ...ek };
    son.current = y;
    if (zaman.current) clearTimeout(zaman.current);
    zaman.current = setTimeout(() => { foyKaydet(y); zaman.current = null; }, 500);
    return y;
  });
  useEffect(() => () => { if (zaman.current && son.current) { clearTimeout(zaman.current); foyKaydet(son.current); } }, []);
  if (!f) return <ScrollView contentContainerStyle={s.wrap}><Text style={s.hint}>{t("Yükleniyor…")}</Text></ScrollView>;

  const evrakEkle = async () => {
    setErr("");
    const secilen = await dosyaSec(".udf,.doc,.docx,.txt,.pdf,.tif,.tiff,.jpg,.jpeg,.png,.zip");
    const sira: Kaynak[] = [];
    for (const k of secilen) {
      if (turBul(k.ad) === "zip") { try { sira.push(...zipIcerigi(k.bytes)); } catch { setErr(t("{ad}: ZIP dosyası açılamadı.", { ad: k.ad })); } }
      else sira.push(k);
    }
    const eklenen: FoyEvrak[] = [];
    let i = 0;
    for (const k of sira) {
      i++;
      const tur = turBul(k.ad);
      if (!tur) { setErr(t("{ad}: bu dosya türü okunamıyor.", { ad: k.ad })); continue; }
      const onEk = sira.length > 1 ? `(${i} / ${sira.length}) ` : "";
      const ilerle = (m: string) => setOkuma(`${onEk}${k.ad}: ${t(m)}`);
      let metin = "", okunamadi: string | undefined;
      try {
        if (tur === "pdf" || tur === "tif" || tur === "resim") {
          const oku = await import("./evrakOku");
          metin = tur === "pdf" ? await oku.pdfMetni(k.bytes, ilerle) : tur === "tif" ? await oku.tifMetni(k.bytes, ilerle) : await oku.resimMetni(k.bytes, k.ad, ilerle);
        } else { ilerle("okunuyor"); metin = evrakMetni(k.ad, k.bytes); }
      } catch (e) { okunamadi = String((e as Error).message || e); }
      const e: FoyEvrak = { id: yeniId("ev"), ad: k.ad, boyut: k.bytes.length, eklenme: new Date().toISOString(), metin, okunamadi };
      try { await dosyaYaz(e.id, k.blob || new Blob([k.bytes as BlobPart])); } catch { /* asıl dosya saklanamazsa metin yine durur */ }
      eklenen.push(e);
    }
    setOkuma("");
    if (eklenen.length) degistir({ evraklar: [...f.evraklar, ...eklenen] });
  };
  const evrakAc = async (e: FoyEvrak) => {
    const b = await dosyaOku(e.id);
    if (!b) { setErr(t("Asıl dosya bu cihazda bulunamadı (yalnız okunan metni var).")); return; }
    if (/\.(pdf|jpg|jpeg|png|txt)$/i.test(e.ad)) window.open(URL.createObjectURL(b), "_blank"); else indir(e.ad, b);
  };
  const evrakSil = async (e: FoyEvrak) => { await dosyaSil(e.id).catch(() => {}); degistir({ evraklar: f.evraklar.filter(x => x.id !== e.id) }); };
  const gorevEkle = () => {
    const m = yeniGorev.trim();
    if (!m) return;
    degistir({ gorevler: [...f.gorevler, { id: yeniId("g"), metin: m, tarih: tarihCoz(gorevTarih), bitti: false, kaynak: "elle" }] });
    setYeniGorev(""); setGorevTarih("");
  };
  const gorevDegistir = (g: Gorev, ek: Partial<Gorev> | null) => degistir({ gorevler: ek ? f.gorevler.map(x => (x.id === g.id ? { ...x, ...ek } : x)) : f.gorevler.filter(x => x.id !== g.id) });

  // Yapay zekâ değerlendirmesi: evrak cihazda kodlanır, kodlu metin gider; dönen özet, süreler ve yapılacaklar föye yazılır.
  const tumMetin = f.evraklar.filter(e => e.metin.trim()).map((e, i) => `=== ${t("Evrak")} ${i + 1}: ${e.ad.replace(/\.[^.]+$/, "")} ===\n${e.metin}`).join("\n\n");
  const degerlendir = async () => {
    setErr("");
    const m = mask(tumMetin, {});
    if (m.masked.length > DOGRUDAN_SINIR) { setErr(t("Evrak çok uzun. “Duruşmaya hazırlan” ekranında dosyayı derleyip oradan değerlendirin.")); return; }
    if (/(?<!\d[.,]?)[1-9]\d{10}(?![.,]?\d)|\bTR\s?\d{2}(?:\s?\d{4}){5}|[\w.+-]+@[\w-]+\.[\w.]+/i.test(m.masked)) { setErr(t("Metinde gizlenmemiş kişisel veri kalmış olabilir. “Duruşmaya hazırlan” ekranında kontrol edip gizleyin.")); return; }
    setDegerlendiriliyor(true);
    const r = await evrakProva(m.masked, f.taraf, t("Dava takibi: dosyanın güncel durumunun özeti, işleyen ve yaklaşan süreler, avukatın yapması gereken işler."));
    setDegerlendiriliyor(false);
    if (!r.ok) { setErr(t(r.error, r.vars)); return; }
    if (typeof r.data.avukatKalan === "number") setAvukatKalan(r.data.avukatKalan);
    const u = (x: string) => unmask(x, m.map);
    const d = r.data;
    const yapay: Gorev[] = (d.eksik || []).map(x => ({ id: yeniId("g"), metin: u(x), bitti: false, kaynak: "yapay" as const }))
      .filter(x => !f.gorevler.some(y => y.metin === x.metin));
    degistir({
      degerlendirme: { tarih: new Date().toISOString(), ozet: u(d.ozet || ""), uyusmazlik: (d.uyusmazlik || []).map(u), sureler: (d.sureler || []).map(u), zayif: (d.zayif || []).map(u) },
      gorevler: [...f.gorevler, ...yapay]
    });
  };

  // Bileşen değil, düz işlev: her tuşta yeniden kurulup odağı kaybetmesin.
  const alanEl = (etiket: string, deger: string, alan: keyof Foy, ph?: string) => (
    <View style={s.alan} key={alan}>
      <Text style={s.label}>{t(etiket)}</Text>
      <TextInput defaultValue={deger} onChangeText={v => degistir({ [alan]: v } as Partial<Foy>)} placeholder={ph ? t(ph) : undefined} placeholderTextColor={C.muted} style={s.inputTek} />
    </View>
  );
  const g = kacGun(f.durusma);
  const acik = f.gorevler.filter(x => !x.bitti).sort((a, b) => (a.tarih || "9999").localeCompare(b.tarih || "9999"));
  const biten = f.gorevler.filter(x => x.bitti);

  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
      <View style={s.head}><Btn kind="ghost" label={t("‹ Föylere dön")} onPress={onKapat} /></View>
      <Text style={s.eyebrow}>{[f.mahkeme, f.esasNo].filter(Boolean).join(" · ").toLocaleUpperCase("tr") || t("YENİ FÖY")}</Text>
      <Text style={s.title}>{foyBaslik(f)}</Text>

      <View style={s.card}>
        <View style={s.row}>
          <Btn label={t("Duruşmaya hazırlan")} onPress={() => onHazirlan(f)} disabled={!f.evraklar.some(e => e.metin.trim())} />
          <Btn kind="secondary" label={degerlendiriliyor ? t("Değerlendiriliyor…") : t("Föyü yapay zekâyla değerlendir")} onPress={degerlendir} disabled={degerlendiriliyor || !tumMetin.trim()} />
        </View>
        <Text style={s.hint}>{t("Duruşmaya hazırlan: föyün evrakı Evrakla duruşma provasına aktarılır; orada kendiniz oynarsınız ya da yapay zekâ oynar. Değerlendirme: özet, süreler ve yapılacak işler föye yazılır{k}.", { k: bedava ? "" : " (" + t("{n} kredi", { n: EVRAK_KREDI.evrak }) + ")" })}</Text>
        {degerlendiriliyor && <Text style={s.hint}>{t("Bir-üç dakika sürebilir; sayfayı açık tutun.")}</Text>}
        {!!err && <Text style={s.err}>{err}</Text>}
      </View>

      <View style={s.card}>
        <Text style={s.cardT}>{t("Künye")}</Text>
        <View style={s.alanlar}>
          {alanEl("Müvekkil", f.muvekkil, "muvekkil")}
          {alanEl("Karşı taraf", f.karsiTaraf, "karsiTaraf")}
          {alanEl("Mahkeme", f.mahkeme, "mahkeme", "İzmir 3. Asliye Ticaret Mahkemesi")}
          {alanEl("Esas no", f.esasNo, "esasNo", "2026/123")}
          {alanEl("Dava türü", f.davaTuru, "davaTuru")}
          <View style={s.alan}>
            <Text style={s.label}>{t("Sonraki duruşma")}</Text>
            <TextInput value={durusmaYazi} onChangeText={v => { setDurusmaYazi(v); const d = tarihCoz(v); if (d || !v.trim()) degistir({ durusma: d }); }} placeholder="12.03.2027 10:30" placeholderTextColor={C.muted} style={s.inputTek} />
            {!!f.durusma && <Text style={[s.hint, g !== undefined && g >= 0 && g <= 7 && { color: C.brass }]}>{gunYaz(g)}</Text>}
            {!!durusmaYazi.trim() && !tarihCoz(durusmaYazi) && <Text style={s.err}>{t("Tarihi 12.03.2027 ya da 12.03.2027 10:30 biçiminde yazın.")}</Text>}
          </View>
        </View>
        <View style={s.chips}>
          {(["davaci", "davali"] as const).map(k => (
            <Pressable key={k} onPress={() => degistir({ taraf: k })} style={[s.chip, f.taraf === k && s.chipOn]}>
              <Text style={[s.chipT, f.taraf === k && s.chipTOn]}>{k === "davaci" ? t("Davacı / şikâyetçi vekiliyiz") : t("Davalı / sanık vekiliyiz")}</Text>
            </Pressable>
          ))}
          {(["acik", "kapali"] as const).map(k => (
            <Pressable key={k} onPress={() => degistir({ durum: k })} style={[s.chip, f.durum === k && s.chipOn]}>
              <Text style={[s.chipT, f.durum === k && s.chipTOn]}>{k === "acik" ? t("Açık") : t("Kapalı")}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.label}>{t("Notlar")}</Text>
        <TextInput defaultValue={f.notlar} onChangeText={v => degistir({ notlar: v })} multiline placeholder={t("Dosyayla ilgili notlarınız")} placeholderTextColor={C.muted} style={s.input} />
      </View>

      <View style={s.card}>
        <Text style={s.cardT}>{t("Yapılacaklar")}</Text>
        {acik.map(x => (
          <View key={x.id} style={s.gorev}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: false }} onPress={() => gorevDegistir(x, { bitti: true })} style={s.box} />
            <View style={{ flex: 1 }}>
              <Text style={s.body}>{x.metin}</Text>
              <Text style={s.hint}>{[x.tarih ? tarihYaz(x.tarih) + " · " + gunYaz(kacGun(x.tarih)) : "", x.kaynak === "yapay" ? t("yapay zekâ önerisi, kontrol edin") : ""].filter(Boolean).join(" · ")}</Text>
            </View>
            <Pressable onPress={() => gorevDegistir(x, null)}><Text style={s.sil}>{t("Sil")}</Text></Pressable>
          </View>
        ))}
        <View style={s.addRow}>
          <TextInput value={yeniGorev} onChangeText={setYeniGorev} onSubmitEditing={gorevEkle} placeholder={t("Yeni iş: ör. bilirkişi raporuna itiraz")} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1 }]} />
          <TextInput value={gorevTarih} onChangeText={setGorevTarih} onSubmitEditing={gorevEkle} placeholder={t("son gün")} placeholderTextColor={C.muted} style={[s.inputTek, { width: 120 }]} />
          <Btn kind="secondary" label={t("Ekle")} onPress={gorevEkle} />
        </View>
        {biten.length > 0 && <Text style={s.hint}>{t("Tamamlanan")}: {biten.map(x => x.metin).join(" · ")}</Text>}
      </View>

      <View style={s.card}>
        <Text style={s.cardT}>{t("Evrak")} ({f.evraklar.length})</Text>
        <Text style={s.hint}>{t("UDF, Word, PDF, TIF, fotoğraf ya da UYAP/DavaTek'ten inen ZIP. Dosyalar bu bilgisayarda saklanır; taranmış evrakın yazısı da burada okunur.")}</Text>
        <View style={s.row}><Btn kind="secondary" label={t("Evrak ekle")} onPress={evrakEkle} disabled={!!okuma} /></View>
        {!!okuma && <Text style={s.hint}>{okuma}</Text>}
        {f.evraklar.map(e => (
          <View key={e.id} style={s.file}>
            <IconBadge name="notes" size={30} />
            <View style={{ flex: 1 }}>
              <Text style={s.fileT} numberOfLines={1}>{e.ad}</Text>
              <Text style={s.hint}>{boyutYaz(e.boyut)} · {tarihYaz(e.eklenme.slice(0, 10))}{e.okunamadi ? " · " + t("metni okunamadı") : e.metin.trim() ? "" : " · " + t("metin yok")}</Text>
            </View>
            <Pressable onPress={() => evrakAc(e)}><Text style={s.link}>{t("Aç")}</Text></Pressable>
            <Pressable onPress={() => evrakSil(e)}><Text style={s.sil}>{t("Sil")}</Text></Pressable>
          </View>
        ))}
      </View>

      {f.degerlendirme && (
        <View style={s.card}>
          <Text style={s.cardT}>{t("Yapay zekâ değerlendirmesi")}</Text>
          <Text style={s.hint}>{tarihYaz(f.degerlendirme.tarih.slice(0, 10))} · {t("Eğitim ve yardım amaçlıdır; süreleri ve sonucu kendiniz doğrulayın.")}</Text>
          <Text style={s.body}>{f.degerlendirme.ozet}</Text>
          {f.degerlendirme.sureler.length > 0 && <><Text style={s.secT}>{t("Süreler")}</Text>{f.degerlendirme.sureler.map((x, i) => <Text key={i} style={s.body}>• {x}</Text>)}</>}
          {f.degerlendirme.uyusmazlik.length > 0 && <><Text style={s.secT}>{t("Çekişmeli konular")}</Text>{f.degerlendirme.uyusmazlik.map((x, i) => <Text key={i} style={s.body}>• {x}</Text>)}</>}
          {f.degerlendirme.zayif.length > 0 && <><Text style={s.secT}>{t("Zayıf noktalar ve riskler")}</Text>{f.degerlendirme.zayif.map((x, i) => <Text key={i} style={s.body}>• {x}</Text>)}</>}
        </View>
      )}

      <View style={s.row}>
        {!silOnay ? <Btn kind="ghost" label={t("Föyü sil")} onPress={() => setSilOnay(true)} />
          : <><Text style={[s.err, { alignSelf: "center" }]}>{t("Föy, evrakı ve görevleriyle bu bilgisayardan silinecek.")}</Text>
            <Btn kind="ghost" label={t("Evet, sil")} onPress={async () => { if (zaman.current) clearTimeout(zaman.current); zaman.current = null; son.current = null; await foySil(f); onKapat(); }} />
            <Btn kind="ghost" label={t("Vazgeç")} onPress={() => setSilOnay(false)} /></>}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 900, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 20, gap: 12 },
  head: { flexDirection: "row" },
  eyebrow: { fontFamily: F.mono, fontSize: 12, letterSpacing: 2.5, color: C.muted, marginTop: 4 },
  title: { fontFamily: F.display, fontSize: 30, color: C.brass },
  warn: { borderWidth: 1, borderColor: C.mid, borderRadius: 10, padding: 12, gap: 6, backgroundColor: "rgba(208,166,76,0.10)" },
  warnT: { fontFamily: F.bodyBold, fontSize: 15, color: C.text },
  warnD: { fontFamily: F.body, fontSize: 13, lineHeight: 19, color: C.textSoft },
  card: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 14, gap: 10 },
  cardT: { fontFamily: F.displayMed, fontSize: 20, color: C.text },
  secT: { fontFamily: F.bodyBold, fontSize: 15, color: C.brass, marginTop: 4 },
  body: { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.textSoft },
  hint: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: C.muted },
  meta: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: C.brassDim },
  label: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: C.brass, textTransform: "uppercase" },
  err: { fontFamily: F.bodyMed, fontSize: 14, lineHeight: 20, color: C.bad },
  link: { fontFamily: F.bodyMed, fontSize: 14, color: C.brass, textDecorationLine: "underline", paddingHorizontal: 4 },
  sil: { fontFamily: F.bodyMed, fontSize: 13, color: C.muted, textDecorationLine: "underline", paddingHorizontal: 4 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
  addRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.panel2 },
  chipOn: { backgroundColor: C.brass, borderColor: C.brass },
  chipT: { fontFamily: F.bodyMed, fontSize: 14, color: C.text },
  chipTOn: { color: C.brassInk, fontFamily: F.bodyBold },
  inputTek: { borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontFamily: F.body, fontSize: 15, color: C.text, backgroundColor: C.panel2 },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, minHeight: 90, fontFamily: F.body, fontSize: 15, color: C.text, backgroundColor: C.panel2, textAlignVertical: "top" },
  alanlar: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  alan: { flexGrow: 1, flexBasis: 260, gap: 4 },
  foy: { flexDirection: "row", gap: 10, alignItems: "center", borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, backgroundColor: C.panel2 },
  foyT: { fontFamily: F.bodyBold, fontSize: 16, color: C.text },
  foyD: { fontFamily: F.monoBold, fontSize: 13, color: C.text, textAlign: "right" },
  yak: { flexDirection: "row", gap: 12, alignItems: "center", borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 },
  yakTarih: { width: 120, fontFamily: F.monoBold, fontSize: 13, color: C.text },
  gorev: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  box: { width: 22, height: 22, borderRadius: 4, borderWidth: 1, borderColor: C.brassDim, marginTop: 2 },
  file: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, backgroundColor: C.panel2 },
  fileT: { fontFamily: F.bodyMed, fontSize: 14, color: C.text }
});
