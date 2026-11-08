// "Toplu evrak yükle": elinizdeki bütün evrakı (dosyalar ya da bütün bir klasör, ZIP dahil) bir kerede seçersiniz; Celse hepsini
// bu bilgisayarda okur, dosya numarası, mahkeme ve taraf adlarına göre gruplar, var olan föylere ekler ya da yeni föy açar.
// Evrak hiçbir yere gönderilmez; okuma kütüphaneleri bir kez indirildikten sonra internet kapalıyken de çalışır.
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useAccount } from "../data/account";
import type { FoyTaraf } from "../data/foy";
import { ayarOku, ayarYaz, bosFoy, dosyaOku, dosyaSil, Foy, foyBaslik, FoyEvrak, foyGetir, foyHaber, foyKaydet, foylerKaydet, foySil, tarihYaz } from "../data/foy";
import { FoyTur, turBilgi } from "../data/foyTurleri";
import { FoylemeSohbeti } from "./FoylemeSohbeti";
import { geriAc } from "../data/foyleme";
import { HavuzEvrak, havuzuGrupla, HavuzGrup, Hedef } from "../data/havuz";
import { kunyeCikar, kunyeyiDoldur } from "../data/kunyeCikar";
import { turBul, yaziKalitesi, zipIcerigi } from "../engine/mask/readers";
import { t } from "../i18n";
import { evrakMetniOku, evrakOlustur, Kaynak } from "./foyEvrak";
import { boyutYaz, dosyaListesiSec, s } from "./foyStil";
import { AktarimSonucu, birlestir, tabloOku, tablodanFoyler } from "../data/foyAktar";
import { Btn } from "./kit";
import { C } from "./theme";

const UZANTILAR = ["udf", "doc", "docx", "rtf", "odt", "htm", "html", "txt", "pdf", "tif", "tiff", "jpg", "jpeg", "png", "zip", "xlsx", "xlsm", "csv", "xls"];
// Excel/CSV dosyası evrak değil, dosya listesidir: her satırı bir föy olur (Dosya listesini aktar ile aynı okuma).
const LISTE = ["xlsx", "xlsm", "csv"];
type Okunan = HavuzEvrak & { kaynak: () => Promise<Kaynak> };

/** kaynakFoy verilirse: o föyde toplanmış evrak (ör. hepsi tek föye yüklenmiş) okunur, gruplanır ve ait oldukları föylere taşınır. */
export function EvrakHavuzu({ liste, onBitti, kaynakFoy }: { liste: Foy[]; onBitti: (mesaj?: string) => void; kaynakFoy?: Foy }) {
  const { account } = useAccount();
  const [okunan, setOkunan] = useState<Okunan[]>([]);
  const [ilerleme, setIlerleme] = useState("");
  const [avukatlar, setAvukatlar] = useState("");
  const [hedefler, setHedefler] = useState<Record<string, Hedef>>({});
  const [ayriHedef, setAyriHedef] = useState<Record<string, string>>({});
  const [secim, setSecim] = useState<string | null>(null);
  const [ara, setAra] = useState("");
  const [uyguluyor, setUyguluyor] = useState(false);
  const [hazirlik, setHazirlik] = useState("");
  const [hazir, setHazir] = useState<boolean>(() => { try { return globalThis.localStorage?.getItem("celse-cevrimdisi-hazir") === "1"; } catch { return false; } });

  const [goster, setGoster] = useState<string | null>(null);
  const [tablolar, setTablolar] = useState<{ ad: string; sonuc: AktarimSonucu }[]>([]);
  const [tabloHata, setTabloHata] = useState("");
  // Akış: grubun hangi grubun devamı olduğu (öneriyi değiştirmek ya da kaldırmak için; null = bağ yok).
  const [zincir, setZincir] = useState<Record<string, string | null>>({});
  // Ayrılamayan evrakı bir gruba vermek (sohbetle).
  const [evrakGrup, setEvrakGrup] = useState<Record<string, string>>({});
  // Ayrılamayan evrak için sohbetle açılacak yeni föy (aynı küme tek föy olur).
  const [ayriYeni, setAyriYeni] = useState<Record<string, { foyTur: FoyTur; taraf: FoyTaraf; kume: string; merci?: string; no?: string }>>({});
  // Avukatın kuralı: tarafları ya da hangi tarafın vekili olunduğu belli olmayanlar beklesin.
  const [beklet, setBekletRaw] = useState<boolean>(() => { try { return globalThis.localStorage?.getItem("celse-havuz-beklet") !== "0"; } catch { return true; } });
  const setBeklet = (v: boolean) => { setBekletRaw(v); try { globalThis.localStorage?.setItem("celse-havuz-beklet", v ? "1" : "0"); } catch { /* yok say */ } };
  // Büro avukatları: kayıtlı liste; yoksa hesaptaki ad.
  useEffect(() => { ayarOku<string>("buroAvukatlari").then(x => setAvukatlar(x || (account?.adSoyad ? "Av. " + account.adSoyad : ""))).catch(() => {}); }, [account?.adSoyad]);
  // Föyde toplanmış evrak: metni zaten okunmuş, asıl dosya cihazdan okunur.
  useEffect(() => {
    if (!kaynakFoy) return;
    setOkunan(kaynakFoy.evraklar.map(e => ({
      id: e.id, ad: e.ad, boyut: e.boyut, metin: e.metin, okunamadi: e.okunamadi, oneri: e.metin ? kunyeCikar(e.metin) : {},
      kaynak: async () => { const b = await dosyaOku(e.id); return { ad: e.ad, bytes: b ? new Uint8Array(await b.arrayBuffer()) : new Uint8Array(), blob: b, yol: e.kaynak }; }
    })));
  }, [kaynakFoy?.id]);
  const avukatListesi = avukatlar.split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
  // Excel satırlarından föyler: listede aynı mahkeme ve esas varsa güncellenir, yoksa yeni föy olur. Evrak bu föylerle de eşleşir.
  const ayrim = useMemo(() => {
    const tek: Foy[] = [];
    const anahtar = (f: Foy) => (f.esasNo ? (f.mahkeme || "").toLocaleLowerCase("tr") + "|" + f.esasNo.replace(/\s+/g, "") : "");
    for (const x of tablolar.flatMap(t => t.sonuc.foyler)) if (!anahtar(x) || !tek.some(y => anahtar(y) === anahtar(x))) tek.push(x);
    return tek.length ? birlestir(liste, tek) : { yeni: [] as Foy[], guncellenen: [] as Foy[] };
  }, [tablolar, liste]);
  const tumFoy = useMemo(() => [...liste, ...ayrim.yeni], [liste, ayrim]);
  const { gruplar, ayrilamayan } = useMemo(() => havuzuGrupla(okunan, tumFoy, avukatListesi), [okunan, tumFoy, avukatlar]);
  const belirsiz = (g: HavuzGrup) => g.hedef.tur === "yeni" && (!!g.tarafBelirsiz || !g.birinci || !g.ikinci);
  const hedefi = (g: HavuzGrup): Hedef => hedefler[g.anahtar] || (beklet && belirsiz(g) ? { tur: "atla" } : g.hedef);
  const oncesi = (g: HavuzGrup): string | undefined => (g.anahtar in zincir ? zincir[g.anahtar] || undefined : g.onceki);

  const sec = async (klasor: boolean) => {
    const dosyalar = await dosyaListesiSec(UZANTILAR, klasor);
    if (!dosyalar.length) return;
    const yeni: Okunan[] = [];
    let i = 0;
    for (const d of dosyalar) {
      i++;
      const uz = (d.name.split(".").pop() || "").toLowerCase();
      if (uz === "xls") { setTabloHata(t("{ad}: eski Excel biçimi (.xls) okunamıyor; Excel'de “Farklı kaydet → Excel Çalışma Kitabı (.xlsx)” yapıp yeniden seçin.", { ad: d.name })); continue; }
      if (LISTE.includes(uz)) {
        try {
          const sonuc = tablodanFoyler(tabloOku(d.name, new Uint8Array(await d.arrayBuffer())));
          if (sonuc.foyler.length) setTablolar(x => [...x.filter(y => y.ad !== d.name), { ad: d.name, sonuc }]);
          else setTabloHata(t("{ad}: tabloda föy olacak satır bulunamadı (başlık satırında müvekkil, mahkeme, esas no gibi sütunlar olmalı).", { ad: d.name }));
        } catch (e) { setTabloHata(t("{ad}: {m}", { ad: d.name, m: String((e as Error).message || e) })); }
        continue;
      }
      const yol = (d as File & { webkitRelativePath?: string }).webkitRelativePath || d.name;
      const parca: Kaynak[] = [];
      const bytes = new Uint8Array(await d.arrayBuffer());
      if (turBul(d.name) === "zip") {
        try { parca.push(...zipIcerigi(bytes)); }
        catch (e) { yeni.push({ id: Math.random().toString(36).slice(2), ad: d.name, boyut: bytes.length, metin: "", okunamadi: t("ZIP açılamadı ({m})", { m: String((e as Error).message || e) }), oneri: {}, kaynak: async () => ({ ad: d.name, bytes, yol }) }); continue; }
      }
      else parca.push({ ad: d.name, bytes, yol });
      for (const k of parca) {
        setIlerleme(t("({a} / {b}) {ad} okunuyor…", { a: i, b: dosyalar.length, ad: k.ad }));
        if (okunan.some(x => x.ad === k.ad && x.boyut === k.bytes.length) || yeni.some(x => x.ad === k.ad && x.boyut === k.bytes.length)) continue;
        const o = await evrakMetniOku(k, m => setIlerleme(t("({a} / {b}) {ad}: {m}", { a: i, b: dosyalar.length, ad: k.ad, m: t(m) })));
        const metin = "hata" in o ? "" : o.metin;
        // Asıl dosya belleğe alınmaz; uygularken yeniden okunur (ZIP içindekiler bellekte kalır).
        const tekDosya = turBul(d.name) !== "zip";
        const kopya = tekDosya ? null : k;
        yeni.push({
          id: Math.random().toString(36).slice(2), ad: k.ad, boyut: k.bytes.length, metin, okunamadi: "hata" in o ? o.hata : o.okunamadi,
          oneri: metin ? kunyeCikar(metin) : {},
          kaynak: async () => kopya || { ad: d.name, bytes: new Uint8Array(await d.arrayBuffer()), blob: d, yol }
        });
      }
    }
    setIlerleme("");
    setOkunan(x => [...x, ...yeni]);
  };

  const uygula = async () => {
    setUyguluyor(true);
    await ayarYaz("buroAvukatlari", avukatlar);
    // Önce Excel listesindeki föyler kaydedilir (evrak bunlara da eklenebilsin diye).
    const listeFoy = ayrim.yeni.length + ayrim.guncellenen.length;
    if (listeFoy) await foylerKaydet([...ayrim.yeni, ...ayrim.guncellenen]);
    let yeniFoy = 0, eklenen = 0;
    const tasinan: string[] = [];
    const grupFoy: Record<string, string> = {};
    const isle = async (hedef: Hedef, evraklar: Okunan[], g?: HavuzGrup, kunye?: { merci?: string; no?: string }) => {
      if (hedef.tur === "atla" || !evraklar.length) return;
      if (g && hedef.tur === "var") grupFoy[g.anahtar] = hedef.foyId;
      // Föyden ayırırken: kendi föyünde kalacak evrak yerinde durur.
      if (kaynakFoy && hedef.tur === "var" && hedef.foyId === kaynakFoy.id) return;
      let f: Foy | undefined = hedef.tur === "var" ? await foyGetir(hedef.foyId) : bosFoy({ tur: hedef.foyTur, taraf: hedef.taraf, acilis: g?.acilis, ...(kunye?.merci ? { mahkeme: kunye.merci } : {}), ...(kunye?.no ? { esasNo: kunye.no } : {}) });
      if (!f) return;
      if (g) grupFoy[g.anahtar] = f.id;
      if (hedef.tur === "yeni") yeniFoy++;
      const eklenecek: FoyEvrak[] = [];
      // Kronoloji: evrak kendi tarihine göre eklenir.
      for (const e of [...evraklar].sort((a, b) => (a.oneri.belgeTarihi || "9999").localeCompare(b.oneri.belgeTarihi || "9999"))) {
        if (f.evraklar.some(x => x.ad === e.ad && x.boyut === e.boyut)) { if (kaynakFoy) tasinan.push(e.id); continue; } // aynı evrak zaten var
        if (kaynakFoy) tasinan.push(e.id);
        setIlerleme(t("{ad} föye ekleniyor…", { ad: e.ad }));
        const yeniE = await evrakOlustur(f, await e.kaynak(), { metin: e.metin, okunamadi: e.okunamadi });
        eklenecek.push(e.oneri.belgeTarihi ? { ...yeniE, tarih: e.oneri.belgeTarihi } : yeniE);
      }
      let x: Foy = { ...f, evraklar: [...f.evraklar, ...eklenecek] };
      for (const e of [...evraklar].sort((a, b) => Number(!!b.oneri.mahkeme) - Number(!!a.oneri.mahkeme))) {
        const r = kunyeyiDoldur(x, e.oneri);
        if (r.dolan.length) x = { ...x, ...r.ek };
      }
      await foyKaydet(x, true);
      eklenen += eklenecek.length;
    };
    for (const g of gruplar) await isle(hedefi(g), [...(g.evraklar as Okunan[]), ...(ayrilamayan as Okunan[]).filter(e => evrakGrup[e.id] === g.anahtar)], g);
    for (const e of ayrilamayan as Okunan[]) { const id = ayriHedef[e.id]; if (id && !evrakGrup[e.id]) await isle({ tur: "var", foyId: id }, [e]); }
    const kumeler = new Map<string, Okunan[]>();
    for (const e of ayrilamayan as Okunan[]) { const y = ayriYeni[e.id]; if (y && !evrakGrup[e.id] && !ayriHedef[e.id]) kumeler.set(y.kume, [...(kumeler.get(y.kume) || []), e]); }
    for (const es of kumeler.values()) { const y = ayriYeni[es[0].id]; await isle({ tur: "yeni", foyTur: y.foyTur, taraf: y.taraf }, es, undefined, y); }
    // Akış: devamı olan dosya öncekine bağlanır (zaten bağlı olan değişmez).
    for (const g of gruplar) {
      const once = oncesi(g);
      const sonraId = grupFoy[g.anahtar], onceId = once ? grupFoy[once] : undefined;
      if (!sonraId || !onceId || sonraId === onceId) continue;
      const sf = await foyGetir(sonraId);
      if (sf && !sf.oncekiId) await foyKaydet({ ...sf, oncekiId: onceId }, true);
    }
    if (kaynakFoy && tasinan.length) {
      const k = await foyGetir(kaynakFoy.id);
      if (k) {
        const kalan = k.evraklar.filter(e => !tasinan.includes(e.id));
        for (const id of tasinan) await dosyaSil(id).catch(() => {});
        const bos = !kalan.length && !k.muvekkil.trim() && !k.esasNo.trim() && !k.mahkeme.trim() && !k.gorevler.length && !k.notlar.trim();
        if (bos) await foySil({ ...k, evraklar: [] }); else await foyKaydet({ ...k, evraklar: kalan }, true);
      }
    }
    foyHaber();
    setUyguluyor(false); setIlerleme("");
    onBitti(t("{n} evrak föylere eklendi; {y} yeni föy açıldı.", { n: eklenen, y: yeniFoy + ayrim.yeni.length }) + (ayrim.guncellenen.length ? " " + t("Excel listesinden {g} föy güncellendi.", { g: ayrim.guncellenen.length }) : ""));
  };

  // Okuyucu güncellendiğinde ya da yazı tanıma sonradan hazırlandığında ayrılamayan evrak asıl dosyadan yeniden okunur.
  const yenidenOku = async () => {
    const xs = ayrilamayan as Okunan[];
    let i = 0;
    for (const e of xs) {
      i++;
      try {
        const k = await e.kaynak();
        if (!k.bytes.length) continue;
        const o = await evrakMetniOku(k, m => setIlerleme(t("({a} / {b}) {ad}: {m}", { a: i, b: xs.length, ad: e.ad, m: t(m) })));
        const metin = "hata" in o ? "" : o.metin;
        setOkunan(ys => ys.map(y => y.id === e.id ? { ...y, metin, okunamadi: "hata" in o ? o.hata : o.okunamadi, oneri: metin ? kunyeCikar(metin) : {} } : y));
      } catch { /* dosya artık yoksa geç */ }
    }
    setIlerleme("");
  };

  const hazirla = async () => {
    setHazirlik(t("Hazırlanıyor…"));
    try { const o = await import("./evrakOku"); await o.cevrimdisiHazirla(m => setHazirlik(t(m))); setHazirlik(""); setHazir(true); try { globalThis.localStorage?.setItem("celse-cevrimdisi-hazir", "1"); } catch { /* yok say */ } }
    catch (e) { setHazirlik(t("İndirilemedi: {m}", { m: String((e as Error).message || e) })); }
  };

  const foyAdi = (id: string) => { const f = tumFoy.find(x => x.id === id); return f ? `${turBilgi(f.tur).ad} · ${foyBaslik(f)}${f.esasNo ? " · " + f.esasNo : ""}` : "?"; };
  const hedefYaz = (h: Hedef) => h.tur === "var" ? t("Var olan föye: {f}", { f: foyAdi(h.foyId) }) : h.tur === "yeni" ? t("Yeni föy: {t} ({v})", { t: turBilgi(h.foyTur).ad, v: h.taraf === "davali" ? t("karşı tarafın vekiliyiz") : t("başvuran tarafın vekiliyiz") }) : t("Atlanacak");
  const secici = (onSec: (id: string) => void) => {
    const q = ara.trim().toLocaleLowerCase("tr");
    const xs = tumFoy.filter(f => !q || [f.muvekkil, f.karsiTaraf, f.mahkeme, f.esasNo].join(" ").toLocaleLowerCase("tr").includes(q)).slice(0, 12);
    return (
      <View style={{ gap: 6 }}>
        <TextInput value={ara} onChangeText={setAra} placeholder={t("Föy ara: müvekkil, karşı taraf, esas no…")} placeholderTextColor={C.muted} style={s.inputTek} />
        {xs.map(f => <Pressable key={f.id} onPress={() => { onSec(f.id); setSecim(null); setAra(""); }} style={s.foy}><Text style={s.fileT} numberOfLines={1}>{foyAdi(f.id)}</Text></Pressable>)}
        {!xs.length && <Text style={s.hint}>{t("Föy bulunamadı.")}</Text>}
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
      <View style={s.head}><Btn kind="ghost" label={t("‹ Föylere dön")} onPress={() => onBitti()} /></View>
      <Text style={s.eyebrow}>{t("DAVA TAKİBİ")}</Text>
      <Text style={s.title}>{kaynakFoy ? t("Evrakı föylere ayır") : t("Toplu evrak yükle")}</Text>
      <View style={s.warn}>
        <Text style={s.warnT}>{t("Bütün evrakı bir kerede atın, Celse ayırsın.")}</Text>
        <Text style={s.warnD}>{t("Dosyaları ya da bütün bir klasörü seçin (UDF, PDF, Word, TIF, fotoğraf, ZIP). Excel ya da CSV dosya listesi de atabilirsiniz: her satırı bir föy olur. Her evrak bu bilgisayarda okunur; dosya numarası, mahkeme, müvekkil ve karşı taraf adına göre gruplanır. Her grup var olan föyüne eklenir ya da yeni föy açılır; mahkeme, esas no, taraflar, vekiller ve açılış tarihi evraktan doldurulur. Önce önizleme görürsünüz, onaylamadan hiçbir şey kaydedilmez. Evrak internete gönderilmez.")}</Text>
      </View>

      <View style={s.card}>
        <Text style={s.label}>{t("Büronuzdaki avukatların adları (virgülle)")}</Text>
        <TextInput value={avukatlar} onChangeText={setAvukatlar} placeholder={t("Örn. Av. Ad Soyad, Av. Ad Soyad")} placeholderTextColor={C.muted} style={s.inputTek} />
        <Text style={s.hint}>{t("Evrakta “VEKİLİ” satırında bu adlar geçerse hangi tarafın vekili olduğunuz anlaşılır ve müvekkil doğru seçilir.")}</Text>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: beklet }} onPress={() => setBeklet(!beklet)} style={[s.row, { alignItems: "center" }]}>
          <Text style={[s.fileT, { color: beklet ? C.brass : C.muted }]}>{beklet ? "☑" : "☐"}</Text>
          <Text style={[s.hint, { flex: 1 }]}>{t("Tarafların adı ya da hangi tarafın vekili olduğum belli değilse föyleme, beklet (sonra sohbetle ya da elle karar veririm).")}</Text>
        </Pressable>
        {!kaynakFoy && <View style={s.row}>
          <Btn label={t("Dosyaları seç")} disabled={!!ilerleme || uyguluyor} onPress={() => sec(false)} />
          <Btn kind="secondary" label={t("Klasör seç")} disabled={!!ilerleme || uyguluyor} onPress={() => sec(true)} />
          {okunan.length > 0 && <Btn kind="ghost" label={t("Temizle")} disabled={uyguluyor} onPress={() => { setOkunan([]); setHedefler({}); setAyriHedef({}); }} />}
        </View>}
        {!!ilerleme && <View style={[s.row, { alignItems: "center" }]}><ActivityIndicator color={C.brass} /><Text style={s.hint}>{ilerleme}</Text></View>}
      </View>

      {!!tabloHata && <Text style={s.err}>{tabloHata}</Text>}
      {tablolar.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardT}>📊 {t("Excel / CSV dosya listesi")}</Text>
          {tablolar.map(x => (
            <View key={x.ad} style={[s.row, { alignItems: "center" }]}>
              <Text style={[s.hint, { flex: 1 }]}>{t("{ad}: {n} satır föy olacak{a}", { ad: x.ad, n: x.sonuc.foyler.length, a: x.sonuc.atlanan ? " · " + t("{k} boş satır atlandı", { k: x.sonuc.atlanan }) : "" })}{x.sonuc.eslesmeyen.length ? " · " + t("tanınmayan sütunlar notlara yazıldı: {s}", { s: x.sonuc.eslesmeyen.join(", ") }) : ""}</Text>
              <Btn kind="ghost" label={t("Kaldır")} onPress={() => setTablolar(y => y.filter(z => z.ad !== x.ad))} />
            </View>
          ))}
          <Text style={s.fileT}>{t("{y} yeni föy açılacak; {g} var olan föy güncellenecek (aynı mahkeme ve esas no).", { y: ayrim.yeni.length, g: ayrim.guncellenen.length })}</Text>
          {ayrim.yeni.slice(0, 8).map(f => <Text key={f.id} style={s.hint} numberOfLines={1}>• {[turBilgi(f.tur).ad, foyBaslik(f), f.mahkeme, f.esasNo].filter(Boolean).join(" · ")}</Text>)}
          {ayrim.yeni.length > 8 && <Text style={s.hint}>{t("… ve {n} föy daha", { n: ayrim.yeni.length - 8 })}</Text>}
          <Text style={s.hint}>{t("Aynı anda seçtiğiniz evrak, numarası ya da tarafları uyan bu föylere eklenir.")}</Text>
          {!okunan.length && <View style={s.row}><Btn label={uyguluyor ? t("Kaydediliyor…") : t("Onayla ve föyleri kaydet")} disabled={uyguluyor} onPress={uygula} /></View>}
        </View>
      )}

      {okunan.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardT}>{t("Önizleme: {n} evrak, {g} grup", { n: okunan.length, g: gruplar.length })}</Text>
          {gruplar.map(g => {
            const h = hedefi(g);
            return (
              <View key={g.anahtar} style={[s.foy, { flexDirection: "column", alignItems: "stretch", gap: 4 }]}>
                <Text style={s.meta}>{[g.mahkeme, g.esasNo, g.acilis ? t("açılış {d}", { d: tarihYaz(g.acilis) }) : ""].filter(Boolean).join(" · ") || t("Numarasız")}</Text>
                <Text style={s.fileT}>{[g.birinci, g.ikinci].filter(Boolean).join(" – ") || t("Taraflar okunamadı")}</Text>
                <Text style={s.hint} numberOfLines={3}>{g.evraklar.map(e => e.ad).join(" · ")}</Text>
                <Text style={[s.fileT, { color: h.tur === "atla" ? C.muted : C.brass }]}>→ {hedefYaz(h)}</Text>
                <Text style={s.hint}>{h.tur === "atla" && !hedefler[g.anahtar] && beklet && belirsiz(g) ? t("Beklemede: taraflar ya da vekilliğiniz evrakta belli değil.") : t("Neden: {n}", { n: t(g.neden) })}{h.tur === "yeni" && g.tarafBelirsiz ? " · " + t("hangi tarafın vekili olduğunuz evrakta bulunamadı; gerekirse değiştirin") : ""}</Text>
                {!!oncesi(g) && (() => { const o = gruplar.find(x => x.anahtar === oncesi(g)); return o ? (
                  <View style={[s.row, { alignItems: "center" }]}>
                    <Text style={[s.hint, { color: C.brass }]}>↳ {t("{a} dosyasının devamı olarak bağlanacak", { a: [o.mahkeme, o.esasNo].filter(Boolean).join(" ") || t("önceki grup") })}</Text>
                    <Pressable onPress={() => setZincir(x => ({ ...x, [g.anahtar]: null }))}><Text style={s.link}>{t("bağlama")}</Text></Pressable>
                  </View>) : null; })()}
                <View style={s.row}>
                  {h.tur === "yeni" && <Btn kind="ghost" label={h.taraf === "davali" ? t("Başvuran tarafın vekiliyiz") : t("Karşı tarafın vekiliyiz")} onPress={() => setHedefler(x => ({ ...x, [g.anahtar]: { ...h, taraf: h.taraf === "davali" ? "davaci" : "davali" } }))} />}
                  {h.tur === "yeni" && <TurSec deger={h.foyTur} onSec={ft => setHedefler(x => ({ ...x, [g.anahtar]: { ...h, foyTur: ft } }))} />}
                  <Btn kind="ghost" label={t("Başka föye ekle")} onPress={() => setSecim(secim === g.anahtar ? null : g.anahtar)} />
                  {h.tur !== "yeni" && <Btn kind="ghost" label={t("Yeni föy aç")} onPress={() => setHedefler(x => ({ ...x, [g.anahtar]: { tur: "yeni", foyTur: g.hedef.tur === "yeni" ? g.hedef.foyTur : "hukuk", taraf: "davaci" } }))} />}
                  {h.tur !== "atla" && <Btn kind="ghost" label={t("Atla")} onPress={() => setHedefler(x => ({ ...x, [g.anahtar]: { tur: "atla" } }))} />}
                </View>
                {secim === g.anahtar && secici(id => setHedefler(x => ({ ...x, [g.anahtar]: { tur: "var", foyId: id } })))}
              </View>
            );
          })}
          {ayrilamayan.length > 0 && (
            <View style={{ gap: 6 }}>
              <Text style={s.cardT}>{t("Ayrılamayan evrak ({n})", { n: ayrilamayan.length })}</Text>
              <Text style={s.hint}>{t("Bunlarda dosya numarası ya da taraf adları bulunamadı (ör. makbuz, fotoğraf, yazışma). Föyünü seçin; seçmezseniz eklenmez.")}</Text>
              <View style={s.row}><Btn kind="secondary" label={t("Bunları yeniden oku")} disabled={!!ilerleme} onPress={yenidenOku} /></View>
              {ayrilamayan.map(e => (
                <View key={e.id} style={{ gap: 4 }}>
                  <View style={[s.file, { alignItems: "center" }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.fileT} numberOfLines={1}>{e.ad}</Text>
                      <Text style={s.hint}>{evrakGrup[e.id] ? "→ " + t("grup: {g}", { g: (() => { const gg = gruplar.find(x => x.anahtar === evrakGrup[e.id]); return gg ? [gg.mahkeme, gg.esasNo].filter(Boolean).join(" ") || [gg.birinci, gg.ikinci].filter(Boolean).join(" – ") : ""; })() }) + " · " : ""}{boyutYaz(e.boyut)}{e.okunamadi ? " · " + t("metni okunamadı: {n}", { n: e.okunamadi }) : !e.metin.trim() ? " · " + t("içinde yazı bulunamadı") : ayriYeni[e.id] ? " · → " + t("yeni föy ({tur}){m}", { tur: turBilgi(ayriYeni[e.id].foyTur).ad, m: ayriYeni[e.id].merci || ayriYeni[e.id].no ? ": " + [ayriYeni[e.id].merci, ayriYeni[e.id].no].filter(Boolean).join(" ") : "" }) + " · " + t("bulunan: {x}", { x: [e.oneri.mahkeme ? t("merci") : "", e.oneri.esasNo ? t("dosya no") : "", e.oneri.birinci ? t("1. taraf") : "", e.oneri.ikinci ? t("2. taraf") : ""].filter(Boolean).join(", ") || t("hiçbiri") }) : " · " + t("bulunan: {x}", { x: [e.oneri.mahkeme ? t("merci") : "", e.oneri.esasNo ? t("dosya no") : "", e.oneri.birinci ? t("1. taraf") : "", e.oneri.ikinci ? t("2. taraf") : ""].filter(Boolean).join(", ") || t("hiçbiri") })}{ayriHedef[e.id] ? " → " + foyAdi(ayriHedef[e.id]) : ""}</Text>
                      {!!e.metin.trim() && !e.oneri.mahkeme && !e.oneri.esasNo && !e.oneri.birinci && !e.oneri.ikinci && (() => { const q = yaziKalitesi(e.metin); return <Text style={s.hint}>{t("okunan yazı: {h} harf, {s} satır, en uzun satır {u} karakter, Türkçe harf %{tr}{b}", { h: q.harf, s: q.satir, u: q.enUzunSatir, tr: q.turkce, b: q.bozuk ? " · " + t("yazı bozuk görünüyor") : "" })}</Text>; })()}
                      {!!e.metin.trim() && <Pressable onPress={() => setGoster(goster === e.id ? null : e.id)}><Text style={s.link}>{goster === e.id ? t("Metni gizle") : t("İlk satırları göster (yalnız bu ekranda)")}</Text></Pressable>}
                    </View>
                    <Btn kind="ghost" label={ayriHedef[e.id] ? t("Değiştir") : t("Föy seç")} onPress={() => setSecim(secim === e.id ? null : e.id)} />
                  </View>
                  {goster === e.id && <Text style={[s.hint, { fontFamily: undefined }]} selectable>{e.metin.split("\n").filter(x => x.trim()).slice(0, 14).join("\n")}</Text>}
                  {secim === e.id && secici(id => setAyriHedef(x => ({ ...x, [e.id]: id })))}
                </View>
              ))}
            </View>
          )}
          <FoylemeSohbeti gruplar={gruplar} ayrilamayan={ayrilamayan} liste={tumFoy} avukatlar={avukatListesi} hedefi={hedefi} oncesi={oncesi}
            uygula={(islemler, k) => {
              for (const x of islemler) {
                const g = x.grup ? gruplar.find(y => y.anahtar === k.gruplar[x.grup! - 1]) : undefined;
                const foyId = x.foy ? k.foyler[x.foy - 1] : undefined;
                if (x.islem === "hedef" && g) {
                  if (x.hedef === "atla") setHedefler(y => ({ ...y, [g.anahtar]: { tur: "atla" } }));
                  else if (foyId) setHedefler(y => ({ ...y, [g.anahtar]: { tur: "var", foyId } }));
                  else if (x.hedef === "yeni") { const h = hedefi(g); setHedefler(y => ({ ...y, [g.anahtar]: { tur: "yeni", foyTur: h.tur === "yeni" ? h.foyTur : g.hedef.tur === "yeni" ? g.hedef.foyTur : "hukuk", taraf: h.tur === "yeni" ? h.taraf : "davaci" } })); }
                } else if (x.islem === "tur" && g && x.tur && turBilgi(x.tur as FoyTur).tur === x.tur) {
                  const h = hedefi(g); setHedefler(y => ({ ...y, [g.anahtar]: { tur: "yeni", foyTur: x.tur as FoyTur, taraf: h.tur === "yeni" ? h.taraf : "davaci" } }));
                } else if (x.islem === "biz" && g && (x.taraf === 1 || x.taraf === 2)) {
                  const h = hedefi(g); setHedefler(y => ({ ...y, [g.anahtar]: { tur: "yeni", foyTur: h.tur === "yeni" ? h.foyTur : g.hedef.tur === "yeni" ? g.hedef.foyTur : "hukuk", taraf: x.taraf === 2 ? "davali" : "davaci" } }));
                } else if (x.islem === "zincir" && x.sonra) {
                  const sonra = k.gruplar[x.sonra - 1], once = x.once ? k.gruplar[x.once - 1] : null;
                  if (sonra) setZincir(y => ({ ...y, [sonra]: once || null }));
                } else if (x.islem === "evrak" && x.evrak) {
                  const eid = k.evraklar[x.evrak - 1];
                  if (!eid) continue;
                  const temizle = () => { setAyriYeni(y => { const z = { ...y }; delete z[eid]; return z; }); };
                  if (x.hedef === "yeni" && !g && !foyId) {
                    const tur = x.tur && turBilgi(x.tur as FoyTur).tur === x.tur ? x.tur as FoyTur : "hukuk";
                    setAyriYeni(y => ({ ...y, [eid]: { foyTur: tur, taraf: x.taraf === 2 ? "davali" : "davaci", kume: x.kume ? "k" + x.kume : eid, merci: typeof x.merci === "string" && x.merci !== "[DOSYA NO]" ? geriAc(x.merci, k.geri).slice(0, 200) : undefined, no: typeof x.no === "string" && /^DOSYA-\d+$/.test(x.no.trim()) ? geriAc(x.no.trim(), k.geri).slice(0, 60) : undefined } }));
                    setAyriHedef(y => { const z = { ...y }; delete z[eid]; return z; }); setEvrakGrup(y => { const z = { ...y }; delete z[eid]; return z; });
                    continue;
                  }
                  temizle();
                  if (g) setEvrakGrup(y => ({ ...y, [eid]: g.anahtar }));
                  else if (foyId) { setAyriHedef(y => ({ ...y, [eid]: foyId })); setEvrakGrup(y => { const z = { ...y }; delete z[eid]; return z; }); }
                  else if (x.hedef === "atla") { setAyriHedef(y => { const z = { ...y }; delete z[eid]; return z; }); setEvrakGrup(y => { const z = { ...y }; delete z[eid]; return z; }); }
                }
              }
            }} />
          <View style={s.row}>
            <Btn label={uyguluyor ? t("Ekleniyor…") : t("Onayla ve föylere ekle")} disabled={uyguluyor || !!ilerleme} onPress={uygula} />
          </View>
        </View>
      )}

      <View style={s.card}>
        <Text style={s.cardT}>{t("İnternet kapalıyken çalışma")}</Text>
        <Text style={s.hint}>{t("Word ve UDF dosyaları her zaman internetsiz okunur. Taranmış PDF, TIF ve fotoğrafı okumak (yazı tanıma) için gereken araç ise ilk kullanımda internetten indirilir. Bu düğme o aracı şimdiden indirip bu bilgisayara kaydeder; böylece adliyede, yolda ya da internet kesikken de taranmış evrak okunur. Bir kez basmanız yeter.")}</Text>
        <View style={s.row}><Btn kind={hazir ? "ghost" : "secondary"} label={hazir ? t("✓ Bu bilgisayar internetsiz okumaya hazır") : t("Bu bilgisayarı internetsiz okumaya hazırla")} disabled={!!hazirlik} onPress={hazirla} /></View>
        {!!hazirlik && <Text style={s.hint}>{hazirlik}</Text>}
      </View>
    </ScrollView>
  );
}

const SECENEK: FoyTur[] = ["hukuk", "ceza", "idari_dava", "sorusturma", "arabuluculuk", "icra", "idari_basvuru", "idari_sorusturma", "kurum_basvuru", "arabulucu_gorev", "bilirkisi_gorev"];
function TurSec({ deger, onSec }: { deger: FoyTur; onSec: (t: FoyTur) => void }) {
  const [acik, setAcik] = useState(false);
  if (!acik) return <Btn kind="ghost" label={t("Tür: {t} ▾", { t: turBilgi(deger).ad })} onPress={() => setAcik(true)} />;
  return (
    <View style={s.chips}>
      {SECENEK.map(x => <Pressable key={x} onPress={() => { onSec(x); setAcik(false); }} style={[s.chip, deger === x && s.chipOn]}><Text style={[s.chipT, deger === x && s.chipTOn]}>{t(turBilgi(x).ad)}</Text></Pressable>)}
    </View>
  );
}
