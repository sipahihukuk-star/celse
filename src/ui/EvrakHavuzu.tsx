// "Toplu evrak yükle": elinizdeki bütün evrakı (dosyalar ya da bütün bir klasör, ZIP dahil) bir kerede seçersiniz; Celse hepsini
// bu bilgisayarda okur, dosya numarası, mahkeme ve taraf adlarına göre gruplar, var olan föylere ekler ya da yeni föy açar.
// Evrak hiçbir yere gönderilmez; okuma kütüphaneleri bir kez indirildikten sonra internet kapalıyken de çalışır.
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useAccount } from "../data/account";
import { ayarOku, ayarYaz, bosFoy, dosyaOku, dosyaSil, Foy, foyBaslik, FoyEvrak, foyGetir, foyHaber, foyKaydet, foySil, tarihYaz } from "../data/foy";
import { FoyTur, turBilgi } from "../data/foyTurleri";
import { HavuzEvrak, havuzuGrupla, HavuzGrup, Hedef } from "../data/havuz";
import { kunyeCikar, kunyeyiDoldur } from "../data/kunyeCikar";
import { turBul, zipIcerigi } from "../engine/mask/readers";
import { t } from "../i18n";
import { evrakMetniOku, evrakOlustur, Kaynak } from "./foyEvrak";
import { boyutYaz, dosyaListesiSec, s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";

const UZANTILAR = ["udf", "doc", "docx", "txt", "pdf", "tif", "tiff", "jpg", "jpeg", "png", "zip"];
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

  const [goster, setGoster] = useState<string | null>(null);
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
  const { gruplar, ayrilamayan } = useMemo(() => havuzuGrupla(okunan, liste, avukatListesi), [okunan, liste, avukatlar]);
  const hedefi = (g: HavuzGrup): Hedef => hedefler[g.anahtar] || g.hedef;

  const sec = async (klasor: boolean) => {
    const dosyalar = await dosyaListesiSec(UZANTILAR, klasor);
    if (!dosyalar.length) return;
    const yeni: Okunan[] = [];
    let i = 0;
    for (const d of dosyalar) {
      i++;
      const yol = (d as File & { webkitRelativePath?: string }).webkitRelativePath || d.name;
      const parca: Kaynak[] = [];
      const bytes = new Uint8Array(await d.arrayBuffer());
      if (turBul(d.name) === "zip") { try { parca.push(...zipIcerigi(bytes)); } catch { continue; } }
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
    let yeniFoy = 0, eklenen = 0;
    const tasinan: string[] = [];
    const isle = async (hedef: Hedef, evraklar: Okunan[], g?: HavuzGrup) => {
      if (hedef.tur === "atla" || !evraklar.length) return;
      // Föyden ayırırken: kendi föyünde kalacak evrak yerinde durur.
      if (kaynakFoy && hedef.tur === "var" && hedef.foyId === kaynakFoy.id) return;
      let f: Foy | undefined = hedef.tur === "var" ? await foyGetir(hedef.foyId) : bosFoy({ tur: hedef.foyTur, taraf: hedef.taraf, acilis: g?.acilis });
      if (!f) return;
      if (hedef.tur === "yeni") yeniFoy++;
      const eklenecek: FoyEvrak[] = [];
      for (const e of evraklar) {
        if (f.evraklar.some(x => x.ad === e.ad && x.boyut === e.boyut)) { if (kaynakFoy) tasinan.push(e.id); continue; } // aynı evrak zaten var
        if (kaynakFoy) tasinan.push(e.id);
        setIlerleme(t("{ad} föye ekleniyor…", { ad: e.ad }));
        eklenecek.push(await evrakOlustur(f, await e.kaynak(), { metin: e.metin, okunamadi: e.okunamadi }));
      }
      let x: Foy = { ...f, evraklar: [...f.evraklar, ...eklenecek] };
      for (const e of [...evraklar].sort((a, b) => Number(!!b.oneri.mahkeme) - Number(!!a.oneri.mahkeme))) {
        const r = kunyeyiDoldur(x, e.oneri);
        if (r.dolan.length) x = { ...x, ...r.ek };
      }
      await foyKaydet(x, true);
      eklenen += eklenecek.length;
    };
    for (const g of gruplar) await isle(hedefi(g), g.evraklar as Okunan[], g);
    for (const e of ayrilamayan as Okunan[]) { const id = ayriHedef[e.id]; if (id) await isle({ tur: "var", foyId: id }, [e]); }
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
    onBitti(t("{n} evrak föylere eklendi; {y} yeni föy açıldı.", { n: eklenen, y: yeniFoy }));
  };

  const hazirla = async () => {
    setHazirlik(t("Hazırlanıyor…"));
    try { const o = await import("./evrakOku"); await o.cevrimdisiHazirla(m => setHazirlik(t(m))); setHazirlik(t("Hazır: bu bilgisayar artık internet kapalıyken de evrak okuyabilir.")); }
    catch (e) { setHazirlik(t("İndirilemedi: {m}", { m: String((e as Error).message || e) })); }
  };

  const foyAdi = (id: string) => { const f = liste.find(x => x.id === id); return f ? `${turBilgi(f.tur).ad} · ${foyBaslik(f)}${f.esasNo ? " · " + f.esasNo : ""}` : "?"; };
  const hedefYaz = (h: Hedef) => h.tur === "var" ? t("Var olan föye: {f}", { f: foyAdi(h.foyId) }) : h.tur === "yeni" ? t("Yeni föy: {t} ({v})", { t: turBilgi(h.foyTur).ad, v: h.taraf === "davali" ? t("karşı tarafın vekiliyiz") : t("başvuran tarafın vekiliyiz") }) : t("Atlanacak");
  const secici = (onSec: (id: string) => void) => {
    const q = ara.trim().toLocaleLowerCase("tr");
    const xs = liste.filter(f => !q || [f.muvekkil, f.karsiTaraf, f.mahkeme, f.esasNo].join(" ").toLocaleLowerCase("tr").includes(q)).slice(0, 12);
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
        <Text style={s.warnD}>{t("Dosyaları ya da bütün bir klasörü seçin (UDF, PDF, Word, TIF, fotoğraf, ZIP). Her evrak bu bilgisayarda okunur; dosya numarası, mahkeme, müvekkil ve karşı taraf adına göre gruplanır. Her grup var olan föyüne eklenir ya da yeni föy açılır; mahkeme, esas no, taraflar, vekiller ve açılış tarihi evraktan doldurulur. Önce önizleme görürsünüz, onaylamadan hiçbir şey kaydedilmez. Evrak internete gönderilmez.")}</Text>
      </View>

      <View style={s.card}>
        <Text style={s.label}>{t("Büronuzdaki avukatların adları (virgülle)")}</Text>
        <TextInput value={avukatlar} onChangeText={setAvukatlar} placeholder={t("Örn. Av. Ad Soyad, Av. Ad Soyad")} placeholderTextColor={C.muted} style={s.inputTek} />
        <Text style={s.hint}>{t("Evrakta “VEKİLİ” satırında bu adlar geçerse hangi tarafın vekili olduğunuz anlaşılır ve müvekkil doğru seçilir.")}</Text>
        {!kaynakFoy && <View style={s.row}>
          <Btn label={t("Dosyaları seç")} disabled={!!ilerleme || uyguluyor} onPress={() => sec(false)} />
          <Btn kind="secondary" label={t("Klasör seç")} disabled={!!ilerleme || uyguluyor} onPress={() => sec(true)} />
          {okunan.length > 0 && <Btn kind="ghost" label={t("Temizle")} disabled={uyguluyor} onPress={() => { setOkunan([]); setHedefler({}); setAyriHedef({}); }} />}
        </View>}
        {!!ilerleme && <View style={[s.row, { alignItems: "center" }]}><ActivityIndicator color={C.brass} /><Text style={s.hint}>{ilerleme}</Text></View>}
      </View>

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
                <Text style={s.hint}>{t("Neden: {n}", { n: t(g.neden) })}{h.tur === "yeni" && g.tarafBelirsiz ? " · " + t("hangi tarafın vekili olduğunuz evrakta bulunamadı; gerekirse değiştirin") : ""}</Text>
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
              {ayrilamayan.map(e => (
                <View key={e.id} style={{ gap: 4 }}>
                  <View style={[s.file, { alignItems: "center" }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.fileT} numberOfLines={1}>{e.ad}</Text>
                      <Text style={s.hint}>{boyutYaz(e.boyut)}{e.okunamadi ? " · " + t("metni okunamadı") : !e.metin.trim() ? " · " + t("metin yok") : " · " + t("bulunan: {x}", { x: [e.oneri.mahkeme ? t("merci") : "", e.oneri.esasNo ? t("dosya no") : "", e.oneri.birinci ? t("1. taraf") : "", e.oneri.ikinci ? t("2. taraf") : ""].filter(Boolean).join(", ") || t("hiçbiri") })}{ayriHedef[e.id] ? " → " + foyAdi(ayriHedef[e.id]) : ""}</Text>
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
          <View style={s.row}>
            <Btn label={uyguluyor ? t("Ekleniyor…") : t("Onayla ve föylere ekle")} disabled={uyguluyor || !!ilerleme} onPress={uygula} />
          </View>
        </View>
      )}

      <View style={s.card}>
        <Text style={s.cardT}>{t("İnternet kapalıyken çalışma")}</Text>
        <Text style={s.hint}>{t("Word, UDF ve metin dosyaları her zaman internetsiz okunur. Taranmış PDF, TIF ve fotoğraf için yazı tanıma kütüphanesi ve Türkçe dil dosyası bir kez indirilir; sonra bu bilgisayarda kalır. Hazırlamak için bir kez internete bağlıyken basın.")}</Text>
        <View style={s.row}><Btn kind="secondary" label={t("Bu bilgisayarı internetsiz okumaya hazırla")} onPress={hazirla} /></View>
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
