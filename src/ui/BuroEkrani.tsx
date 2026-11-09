// Büro ve çalışanlar: büro kurma, çalışan davet etme (ünvan ve yetkiyle), davetle katılma, ünvan değiştirme, çıkarma.
// Föyler büro anahtarıyla uçtan uca şifreli paylaşılır; ayrıntı data/buro.ts ve supabase/surum18.sql.
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { BuroDurum, buroDurumu, burodanAyril, buroKur, davetGuncelle, davetIptal, davetKabul, davetOlustur, UNVANLAR, unvanYetkisi, uyeCikar, uyeGuncelle, Yetki, YETKI_AD } from "../data/buro";
import { esitle } from "../data/foyBulut";
import { buroDosyaDurumu, DosyaDurum } from "../data/buroDosya";
import { t } from "../i18n";
import { Acilir } from "./Acilir";
import { s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";

const tarihYaz = (x?: string) => (x ? x.slice(0, 10).split("-").reverse().join(".") : "");
const yetkiSecenek = (Object.keys(YETKI_AD) as Yetki[]).map(k => ({ k, ad: t(YETKI_AD[k]) }));
const unvanSecenek = UNVANLAR.map(x => ({ k: x.ad, ad: t(x.ad) }));

export function BuroEkrani({ onKapat }: { onKapat: () => void }) {
  const [d, setD] = useState<BuroDurum | null>(null);
  const [mesaj, setMesaj] = useState<{ t: string; ok?: boolean } | null>(null);
  const [busy, setBusy] = useState("");
  // Kur / katıl
  const [buroAd, setBuroAd] = useState("");
  const [benimAd, setBenimAd] = useState("");
  const [kod, setKod] = useState("");
  // Davet
  const [dAd, setDAd] = useState("");
  const [dUnvan, setDUnvan] = useState(""); // önceden seçili ünvan yok: yanlışlıkla "Stajyer avukat" gitmesin
  const [dYetki, setDYetki] = useState<Yetki>("yaz");
  const [adOdak, setAdOdak] = useState(false);
  const [yeniKod, setYeniKod] = useState<{ kod: string; ad: string; unvan: string } | null>(null);
  const [cikarSor, setCikarSor] = useState<string | null>(null);

  const [dosya, setDosya] = useState<DosyaDurum | null>(null);
  useEffect(() => { const z = setInterval(() => { buroDosyaDurumu().then(setDosya).catch(() => {}); }, 3000); buroDosyaDurumu().then(setDosya).catch(() => {}); return () => clearInterval(z); }, []);
  const yenile = () => buroDurumu().then(setD).catch(e => { setMesaj({ t: String((e as Error).message || e) }); setD({ tur: "yok" }); });
  useEffect(() => { yenile(); }, []);
  const yap = async (ad: string, f: () => Promise<void>, basari?: string) => {
    setBusy(ad); setMesaj(null);
    try { await f(); if (basari) setMesaj({ t: basari, ok: true }); await yenile(); }
    catch (e) { setMesaj({ t: t(String((e as Error).message || e)) }); }
    finally { setBusy(""); }
  };
  // Kopyalama sonucu tuşun kendisinde görünür (sayfanın altındaki mesaj ekranın dışında kalıyordu).
  const [kopyaDurum, setKopyaDurum] = useState<"" | "ok" | "hata">("");
  const kopyaZaman = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (kopyaZaman.current) clearTimeout(kopyaZaman.current); }, []);
  const kopyala = async (x: string) => {
    const g = globalThis as unknown as {
      navigator?: { clipboard?: { writeText: (s: string) => Promise<void> } };
      document?: { createElement: (t: string) => { value: string; style: { position: string; opacity: string }; select: () => void; remove: () => void }; body: { appendChild: (e: unknown) => void }; execCommand: (c: string) => boolean };
    };
    let ok = false;
    try { if (g.navigator?.clipboard) { await g.navigator.clipboard.writeText(x); ok = true; } } catch { /* aşağıdaki yedek yolu dene */ }
    if (!ok && g.document) {
      try {
        const ta = g.document.createElement("textarea");
        ta.value = x; ta.style.position = "fixed"; ta.style.opacity = "0";
        g.document.body.appendChild(ta); ta.select(); ok = g.document.execCommand("copy"); ta.remove();
      } catch { ok = false; }
    }
    setKopyaDurum(ok ? "ok" : "hata");
    if (kopyaZaman.current) clearTimeout(kopyaZaman.current);
    kopyaZaman.current = setTimeout(() => setKopyaDurum(""), 2500);
  };

  const ust = (
    <>
      <View style={s.head}><Btn kind="ghost" label={t("‹ Föylere dön")} onPress={onKapat} /></View>
      <Text style={s.eyebrow}>{t("DAVA TAKİBİ · BÜRO")}</Text>
      <Text style={s.title}>{t("Büro ve çalışanlar")}</Text>
      <Text style={s.hint}>{t("Avukat, stajyer avukat, katip, sekreter… her çalışan Celse'ye kendi hesabıyla girer, büronun föylerini ve kendisine atanan işleri görür. Föyler büro anahtarıyla uçtan uca şifrelidir: sunucu içeriği okuyamaz. Şahsi dosyalarınız büroya gitmez.")}</Text>
    </>
  );
  if (!d) return <ScrollView contentContainerStyle={s.wrap}>{ust}<ActivityIndicator color={C.brass} /></ScrollView>;
  const mesajV = mesaj && <Text style={[s.hint, { color: mesaj.ok ? C.good : C.bad }]}>{mesaj.t}</Text>;

  if (d.tur === "giris_yok" || d.tur === "kurulum_yok" || d.tur === "esitleme_yok") {
    return (
      <ScrollView contentContainerStyle={s.wrap}>{ust}
        <View style={s.card}>
          <Text style={s.body}>{d.tur === "giris_yok" ? t("Önce hesabınızla giriş yapın (ana ekran > Hesap).")
            : d.tur === "kurulum_yok" ? t("Sunucuda büro kurulumu (18. kurulum) henüz yapılmamış.")
              : t("Önce bu cihazda bulut eşitlemesini açın: Föylerim ekranındaki “Bulut eşitlemesi” kartından eşitleme şifrenizi belirleyin ya da girin. Büro anahtarı bu şifreyle korunur.")}</Text>
        </View>{mesajV}
      </ScrollView>
    );
  }

  if (d.tur === "yok") {
    return (
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">{ust}
        <View style={s.card}>
          <Text style={[s.body, { color: C.text }]}>{t("Büro kur (büronun sahibi avukat)")}</Text>
          <TextInput value={buroAd} onChangeText={setBuroAd} placeholder={t("Büronun adı: ör. Sipahi Hukuk Bürosu")} placeholderTextColor={C.muted} style={s.inputTek} />
          <TextInput value={benimAd} onChangeText={setBenimAd} placeholder={t("Adınız: ör. Av. Ad Soyad")} placeholderTextColor={C.muted} style={s.inputTek} />
          <Text style={s.hint}>{t("Büro kurulunca bu cihazdaki (şahsi olmayan) föyleriniz büroya taşınır ve çalışanlarınız görebilir. Şahsi dosyalar taşınmaz.")}</Text>
          <Btn label={busy === "kur" ? t("Kuruluyor…") : t("Büroyu kur")} disabled={!!busy || !buroAd.trim() || !benimAd.trim()}
            onPress={() => yap("kur", async () => { await buroKur(buroAd, benimAd); await esitle(); }, t("Büro kuruldu. Şimdi çalışanlarınızı davet edin."))} />
        </View>
        <View style={s.card}>
          <Text style={[s.body, { color: C.text }]}>{t("Davetle katıl (çalışan)")}</Text>
          <Text style={s.hint}>{t("Büronun avukatından aldığınız 12 karakterlik davet kodunu girin. Kod tek kullanımlıktır ve 7 gün geçerlidir.")}</Text>
          <TextInput value={kod} onChangeText={setKod} placeholder={t("Davet kodu: ör. K7PD-3QXM-W2HA")} placeholderTextColor={C.muted} autoCapitalize="characters" style={s.inputTek} />
          <TextInput value={benimAd} onChangeText={setBenimAd} placeholder={t("Adınız")} placeholderTextColor={C.muted} style={s.inputTek} />
          <Text style={s.hint}>{t("Katılınca büronun föyleri bu cihaza gelir; bu cihazda şahsi olmayan föyünüz varsa o da büroya gider.")}</Text>
          <Btn label={busy === "katil" ? t("Katılınıyor…") : t("Büroya katıl")} disabled={!!busy || !kod.trim()}
            onPress={() => yap("katil", async () => { await davetKabul(kod, benimAd); setKod(""); await esitle(); }, t("Büroya katıldınız; föyler geliyor."))} />
        </View>{mesajV}
      </ScrollView>
    );
  }

  const { b, anahtar } = d;
  const yonetici = b.ben.yetki === "yonetici";
  const davetMetni = yeniKod ? t("Merhaba {ad}, Celse büromuza {unvan} olarak davetlisiniz. celse.themiscode.com adresinde kendi hesabınızla giriş yapın; Dava takibi > Föylerim > Bulut eşitlemesi'nden kendi eşitleme şifrenizi belirleyin; sonra 👥 Büro ve çalışanlar > Davetle katıl'a şu kodu yazın: {kod} (tek kullanımlık, 7 gün geçerli).", { ad: yeniKod.ad || "", unvan: yeniKod.unvan.toLocaleLowerCase("tr"), kod: yeniKod.kod }) : "";
  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">{ust}
      <View style={s.card}>
        <Text style={[s.body, { color: C.text, fontWeight: "700" }]}>{b.ad}</Text>
        <Text style={s.hint}>{t("Siz: {ad} · {unvan} · {yetki}", { ad: b.ben.ad, unvan: t(b.ben.unvan), yetki: t(YETKI_AD[b.ben.yetki]) })}</Text>
        {!anahtar && <Text style={[s.hint, { color: C.bad }]}>{t("Bu cihazda büro anahtarı açılamadı. Bulut eşitlemesini bu cihazda açın; anahtar kendiliğinden gelir.")}</Text>}
      </View>

      <View style={s.card}>
        <Text style={[s.body, { color: C.text }]}>{t("Çalışanlar ({n})", { n: b.uyeler.length })}</Text>
        {b.uyeler.map(u => {
          const kurucu = u.kullanici_id === b.kurucu, ben = u.kullanici_id === b.ben.kullanici_id;
          return (
            <View key={u.kullanici_id} style={{ gap: 6, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line }}>
              <Text style={[s.body, { color: C.text }]}>{u.ad || t("(adsız)")}{ben ? " · " + t("siz") : ""}</Text>
              {yonetici && !kurucu ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
                  <Acilir etiket={t("Ünvan")} secili={u.unvan} genislik={200} secenekler={unvanSecenek.some(x => x.k === u.unvan) ? unvanSecenek : [{ k: u.unvan, ad: u.unvan }, ...unvanSecenek]}
                    onSec={k => yap("u" + u.kullanici_id, () => uyeGuncelle(b.id, u.kullanici_id, { unvan: k, yetki: unvanYetkisi(k) }), t("{ad}: {unvan}", { ad: u.ad, unvan: t(k) }))} />
                  <Acilir etiket={t("Yetki")} secili={u.yetki} genislik={290} secenekler={yetkiSecenek}
                    onSec={k => yap("y" + u.kullanici_id, () => uyeGuncelle(b.id, u.kullanici_id, { yetki: k as Yetki }), t("Yetki değişti."))} />
                  {cikarSor === u.kullanici_id ? (
                    <View style={[s.row, { alignItems: "center" }]}>
                      <Text style={s.hint}>{t("Çıkarılsın mı? Büro föylerini artık göremez.")}</Text>
                      <Btn kind="ghost" label={t("Evet, çıkar")} onPress={() => { setCikarSor(null); yap("c", () => uyeCikar(b.id, u.kullanici_id), t("{ad} bürodan çıkarıldı.", { ad: u.ad })); }} />
                      <Btn kind="ghost" label={t("Vazgeç")} onPress={() => setCikarSor(null)} />
                    </View>
                  ) : <Pressable onPress={() => setCikarSor(u.kullanici_id)} style={{ paddingTop: 22 }}><Text style={s.sil}>{t("Bürodan çıkar")}</Text></Pressable>}
                </View>
              ) : <Text style={s.hint}>{t(u.unvan)} · {t(YETKI_AD[u.yetki])} · {t("katıldı {d}", { d: tarihYaz(u.katilma) })}</Text>}
            </View>
          );
        })}
      </View>

      {yonetici && (
        <View style={s.card}>
          <Text style={[s.body, { color: C.text }]}>{t("+ Çalışan davet et")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
            {/* Ünvan ve Yetki kutularıyla aynı yapı: üstte küçük etiket, altta aynı yükseklik ve köşede kutu. */}
            <View style={{ minWidth: 220, flex: 1, gap: 4 }}>
              <Text style={{ color: C.muted, fontSize: 11, letterSpacing: 0.5 }}>{t("Adı soyadı")}</Text>
              <TextInput value={dAd} onChangeText={setDAd} placeholder={t("ör. Ad Soyad")} placeholderTextColor={C.muted}
                onFocus={() => setAdOdak(true)} onBlur={() => setAdOdak(false)}
                style={[s.inputTek, { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, fontSize: 14, borderColor: adOdak ? C.brass : C.line }, Platform.OS === "web" ? { outlineWidth: 0 } : null]} />
            </View>
            <Acilir etiket={t("Ünvan")} secili={dUnvan} genislik={200} secenekler={[...(dUnvan ? [] : [{ k: "", ad: t("Ünvan seçin") }]), ...unvanSecenek]} onSec={k => { setDUnvan(k); setDYetki(unvanYetkisi(k)); }} />
            <Acilir etiket={t("Yetki")} secili={dYetki} genislik={290} secenekler={yetkiSecenek} onSec={k => setDYetki(k as Yetki)} />
          </View>
          <Btn label={busy === "davet" ? t("Hazırlanıyor…") : t("Davet kodu oluştur")} disabled={!!busy || !dAd.trim() || !dUnvan || !anahtar}
            onPress={() => yap("davet", async () => { const k = await davetOlustur(b.id, { ad: dAd, unvan: dUnvan, yetki: dYetki }); setYeniKod({ kod: k, ad: dAd, unvan: dUnvan }); setDAd(""); setDUnvan(""); })} />
          {!!dAd.trim() && !dUnvan && <Text style={s.hint}>{t("Ünvanı seçin: katip, sekreter, stajyer avukat…")}</Text>}
          {yeniKod && (
            <View style={[s.warn, { gap: 8 }]}>
              <Text style={[s.body, { color: C.text }]}>{t("Davet kodu (bir kez gösterilir):")}</Text>
              <Text selectable style={{ color: C.brass, fontSize: 26, fontWeight: "800", letterSpacing: 2 }}>{yeniKod.kod}</Text>
              <Text style={s.hint} selectable>{davetMetni}</Text>
              <View style={s.row}>
                {Platform.OS === "web" && <Btn kind={kopyaDurum === "ok" ? "primary" : "secondary"} label={kopyaDurum === "ok" ? t("Kopyalandı ✓") : t("Mesajı kopyala")} onPress={() => kopyala(davetMetni)} />}
                <Btn kind="ghost" label={t("Kapat")} onPress={() => { setYeniKod(null); setKopyaDurum(""); }} />
              </View>
              {kopyaDurum === "hata" && <Text style={[s.hint, { color: C.bad }]}>{t("Kopyalanamadı. Metni fareyle seçip Ctrl+C ile kopyalayın.")}</Text>}
              <Text style={s.hint}>{t("Kodu yalnız o kişiye, yüz yüze ya da WhatsApp'tan iletin. Kodu bilen herkes büroya bu ünvanla katılabilir; yanlış kişiye gittiyse aşağıdan iptal edin.")}</Text>
            </View>
          )}
          {b.davetler.length > 0 && (
            <View style={{ gap: 4 }}>
              <Text style={s.hint}>{t("Bekleyen davetler")}</Text>
              {b.davetler.map(x => (
                <View key={x.id} style={[s.row, { alignItems: "flex-end", flexWrap: "wrap" }]}>
                  <Text style={[s.body, { flex: 1, minWidth: 160 }]}>{x.ad} · {t("son gün {d}", { d: tarihYaz(x.son) })}</Text>
                  <Acilir etiket={t("Ünvan")} secili={x.unvan} genislik={180} secenekler={unvanSecenek.some(u => u.k === x.unvan) ? unvanSecenek : [{ k: x.unvan, ad: x.unvan }, ...unvanSecenek]}
                    onSec={k => yap("d" + x.id, () => davetGuncelle(x.id, { unvan: k, yetki: unvanYetkisi(k) }), t("{ad}: {unvan}", { ad: x.ad, unvan: t(k) }))} />
                  <Pressable onPress={() => yap("i", () => davetIptal(x.id), t("Davet iptal edildi."))} style={{ paddingBottom: 10 }}><Text style={s.sil}>{t("İptal")}</Text></Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={s.card}>
        <Text style={[s.body, { color: C.text }]}>{t("Asıl evrak dosyaları")}</Text>
        <Text style={s.hint}>{t("Büro föylerindeki PDF, UDF ve fotoğraflar büro anahtarıyla şifrelenip büro bulutuna yüklenir; çalışanlar evrakı açınca kendi bilgisayarına iner. Şahsi dosyalarınız yüklenmez. Yükleme Celse açıkken, her eşitlemede birkaç dosya olarak sürer.")}</Text>
        {!!dosya && (
          <Text style={[s.hint, { color: dosya.kurulumYok || dosya.hata ? C.bad : dosya.bekleyen ? C.mid : C.good }]}>
            {dosya.kurulumYok ? t("Sunucuda dosya deposu kurulmamış (supabase/surum20.sql çalıştırılmalı).")
              : dosya.hata ? t("Yükleme hatası: {h}", { h: dosya.hata })
              : t("{y} dosya büro bulutunda", { y: dosya.yuklenen }) + (dosya.bekleyen ? " · " + t("{n} dosya sırada", { n: dosya.bekleyen }) : " · " + t("hepsi yüklendi ✓")) + (dosya.buyuk ? " · " + t("{n} dosya 45 MB'tan büyük, yüklenmedi", { n: dosya.buyuk }) : "")}
          </Text>
        )}
      </View>

      <View style={s.card}>
        <Text style={s.hint}>{t("Yetkiler: Yönetici çalışan ekler, çıkarır, ünvan verir ve föy siler. “Föy yazar ve siler” yetkisindeki avukat föy ekler, değiştirir, siler. “Föy yazar, silemez” yetkisindeki stajyer, katip ve sekreter föy ve evrak ekler, iş kapatır ama föy silemez. İşler Yapılacaklar ekranından çalışana atanır.")}</Text>
        {b.ben.kullanici_id !== b.kurucu && (
          <Btn kind="ghost" label={t("Bürodan ayrıl")} onPress={() => yap("ayril", () => burodanAyril(b.id), t("Bürodan ayrıldınız. Föyler bu cihazda kaldı."))} />
        )}
      </View>
      {mesajV}
    </ScrollView>
  );
}
