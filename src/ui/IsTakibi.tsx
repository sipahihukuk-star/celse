// Yapılacaklar: bütün föylerdeki işler tek ekranda. Uyarı gün geçtikçe artar (renk ve düzey); iş yalnız
// iş emri / evrak numarasıyla kapanır. Yeni iş buradan da eklenir; liste Excel'e aktarılır.
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { bosFoy, Foy, foyBaslik, foyKaydet, Gorev, tarihCoz, tarihYaz, yeniId } from "../data/foy";
import { FoyTur, TURLER } from "../data/foyTurleri";
import { bugunStr, duzeySayilari, DUZEY_SIRA, isListesi, IsSuzgec, isTablosu } from "../data/isTakibi";
import { xlsxYaz } from "../data/xlsxYaz";
import { buroUyeleri, Uye } from "../data/buro";
import { t } from "../i18n";
import { Acilir } from "./Acilir";
import { indir, s } from "./foyStil";
import { DUZEY_RENK, duzeyAdi, GorevKapat } from "./GorevKapat";
import { Btn } from "./kit";
import { C } from "./theme";

export function IsTakibi({ liste, onAc, onKapat }: { liste: Foy[]; onAc: (id: string) => void; onKapat: () => void }) {
  const [sz, setSz] = useState<IsSuzgec>(() => {
    const v: IsSuzgec = { gorunum: "acik", duzey: "hepsi", tur: "hepsi", ara: "" };
    try { return { ...v, ...JSON.parse(globalThis.localStorage?.getItem("celse-is-takibi") || "{}"), ara: "" }; } catch { return v; }
  });
  const yaz = (ek: Partial<IsSuzgec>) => { const y = { ...sz, ...ek }; setSz(y); setSayfa(0); try { const { ara: _a, ...k } = y; globalThis.localStorage?.setItem("celse-is-takibi", JSON.stringify(k)); } catch { /* yok say */ } };
  const [sayfa, setSayfa] = useState(0);
  // Büro çalışanları (iş atama). Büro yoksa liste boş, atama alanları görünmez.
  const [uyeler, setUyeler] = useState<Uye[]>([]);
  const [ben, setBen] = useState<string>();
  useEffect(() => { buroUyeleri().then(x => { setUyeler(x.uyeler); setBen(x.ben); }).catch(() => {}); }, []);
  const [kime, setKime] = useState("");
  const atama = (uid: string) => { const u = uyeler.find(x => x.kullanici_id === uid); return u ? { atanan: u.kullanici_id, atananAd: u.ad } : { atanan: undefined, atananAd: undefined }; };
  const kisiSecenek = [{ k: "", ad: t("Kimseye") }, ...uyeler.map(u => ({ k: u.kullanici_id, ad: `${u.ad} · ${t(u.unvan)}${u.kullanici_id === ben ? " (" + t("siz") + ")" : ""}` }))];
  const [kapat, setKapat] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState("");
  const satirlar = useMemo(() => isListesi(liste, sz), [liste, sz]);
  const sayilar = useMemo(() => duzeySayilari(liste), [liste]);
  const BOY = 50;
  const sayfaSay = Math.max(1, Math.ceil(satirlar.length / BOY));
  const cur = Math.min(sayfa, sayfaSay - 1);
  const gorunen = satirlar.slice(cur * BOY, (cur + 1) * BOY);
  const buro = liste.filter(f => !f.ozel);
  const turler = TURLER.filter(x => !x.eski && buro.some(f => (f.tur || "hukuk") === x.tur));

  const gorevYaz = async (f: Foy, g: Gorev, ek: Partial<Gorev> | null) => {
    await foyKaydet({ ...f, gorevler: ek ? f.gorevler.map(x => (x.id === g.id ? { ...x, ...ek } : x)) : f.gorevler.filter(x => x.id !== g.id) });
  };

  // Yeni iş: föy aranıp seçilir.
  const [foyAra, setFoyAra] = useState("");
  const [hedef, setHedef] = useState<Foy | null>(null);
  const [yeni, setYeni] = useState("");
  const [sonGun, setSonGun] = useState("");
  const bulunan = useMemo(() => {
    const q = foyAra.trim().toLocaleLowerCase("tr");
    if (q.length < 2 || hedef) return [];
    return buro.filter(f => [f.muvekkil, f.karsiTaraf, f.mahkeme, f.esasNo, f.davaTuru].join(" ").toLocaleLowerCase("tr").includes(q)).slice(0, 8);
  }, [foyAra, hedef, liste]);
  // Henüz açılmamış dava: föy açılır, "Dava aç" işi yapılacaklara yazılır.
  const [yeniDava, setYeniDava] = useState(false);
  const [yd, setYd] = useState<{ tur: FoyTur; muvekkil: string; karsi: string; dava: string }>({ tur: "hukuk", muvekkil: "", karsi: "", dava: "" });
  const davaKaydet = async () => {
    if (!yd.dava.trim() && !yd.muvekkil.trim()) return;
    const is = yeni.trim() || "Dava aç: " + (yd.dava.trim() || TURLER.find(x => x.tur === yd.tur)?.ad || "dava");
    const g: Gorev = { id: yeniId("g"), metin: is, tarih: tarihCoz(sonGun), bitti: false, kaynak: "elle", eklenme: bugunStr(), ...atama(kime) };
    await foyKaydet(bosFoy({ tur: yd.tur, muvekkil: yd.muvekkil.trim(), karsiTaraf: yd.karsi.trim(), davaTuru: yd.dava.trim(), notlar: "Yapılacaklardan kaydedildi; dava henüz açılmadı.", gorevler: [g] }));
    setMesaj(t("Yeni föy açıldı, iş yapılacaklara yazıldı: {is}", { is })); setYeni(""); setSonGun(""); setYd({ tur: yd.tur, muvekkil: "", karsi: "", dava: "" });
  };
  const ekle = async () => {
    if (!hedef || !yeni.trim()) return;
    const g: Gorev = { id: yeniId("g"), metin: yeni.trim(), tarih: tarihCoz(sonGun), bitti: false, kaynak: "elle", eklenme: bugunStr(), ...atama(kime) };
    await foyKaydet({ ...hedef, gorevler: [...hedef.gorevler, g] });
    setMesaj(t("İş eklendi: {is}", { is: g.metin })); setYeni(""); setSonGun("");
  };

  const excel = () => {
    const b = xlsxYaz("Yapılacaklar", isTablosu(satirlar), [40, 30, 32, 14, 12, 12, 34, 10, 14, 22, 20]);
    indir(`yapilacaklar-${bugunStr()}.xlsx`, new Blob([b as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  };
  const web = Platform.OS === "web";
  const N = globalThis as unknown as { Notification?: { permission: string; requestPermission: () => Promise<string> } };
  const [bildirim, setBildirim] = useState(N.Notification?.permission || "");

  const acikToplam = DUZEY_SIRA.reduce((a, d) => a + sayilar[d], 0);
  return (
    <ScrollView contentContainerStyle={[s.wrap, { maxWidth: 1000 }]} keyboardShouldPersistTaps="handled">
      <View style={s.head}><Btn kind="ghost" label={t("‹ Föylere dön")} onPress={onKapat} /></View>
      <Text style={s.eyebrow}>{t("DAVA TAKİBİ · YAPILACAKLAR")}</Text>
      <Text style={s.title}>{t("Yapılacaklar")}</Text>
      <Text style={s.hint}>{t("Bütün föylerdeki işler. Uyarı son gün gelince değil, gün geçtikçe artar: kalan gün azaldıkça ve işin eklendiği günden son güne kadarki sürenin yarısı, dörtte üçü geçtikçe renk koyulaşır. Son günü yazılmamış işler de bekledikçe uyarır. Bir iş, iş emri / evrak numarası yazılmadan kapanmaz.")}</Text>

      <View style={[s.card, { flexDirection: "row", flexWrap: "wrap", gap: 8 }]}>
        {DUZEY_SIRA.filter(d => sayilar[d]).map(d => (
          <Pressable key={d} onPress={() => yaz({ gorunum: "acik", duzey: sz.duzey === d ? "hepsi" : d })} style={{ borderWidth: 1, borderColor: DUZEY_RENK[d], borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: sz.duzey === d ? DUZEY_RENK[d] + "33" : "transparent" }}>
            <Text style={{ color: DUZEY_RENK[d], fontWeight: "700", fontSize: 13 }}>{duzeyAdi(d)}: {sayilar[d]}</Text>
          </Pressable>
        ))}
        {!acikToplam && <Text style={s.hint}>{t("Açık iş yok.")}</Text>}
      </View>

      <View style={s.card}>
        <Text style={[s.body, { color: C.text }]}>{t("+ Yeni iş")}</Text>
        <Acilir etiket={t("İş nereye")} secili={yeniDava ? "yeni" : "mevcut"} genislik={280} onSec={k => setYeniDava(k === "yeni")}
          secenekler={[{ k: "mevcut", ad: t("Var olan bir föye") }, { k: "yeni", ad: t("Yeni dava (henüz açılmadı)") }]} />
        {uyeler.length > 1 && <Acilir etiket={t("Kime verilsin")} secili={kime} genislik={300} secenekler={kisiSecenek} onSec={setKime} />}
        {yeniDava ? (
          <View style={{ gap: 8 }}>
            <Acilir etiket={t("Dosya türü")} secili={yd.tur} genislik={260} onSec={k => setYd({ ...yd, tur: k as FoyTur })}
              secenekler={TURLER.filter(x => !x.eski && !["arabulucu_gorev", "bilirkisi_gorev", "sozlesme", "danisma"].includes(x.tur)).map(x => ({ k: x.tur, ad: t(x.ad) }))} />
            <View style={s.addRow}>
              <TextInput value={yd.dava} onChangeText={v => setYd({ ...yd, dava: v })} placeholder={t("Dava: ör. boşanma davası, işe iade")} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1, minWidth: 200 }]} />
              <TextInput value={yd.muvekkil} onChangeText={v => setYd({ ...yd, muvekkil: v })} placeholder={t("Müvekkil")} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1, minWidth: 160 }]} />
              <TextInput value={yd.karsi} onChangeText={v => setYd({ ...yd, karsi: v })} placeholder={t("Karşı taraf")} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1, minWidth: 160 }]} />
            </View>
            <View style={s.addRow}>
              <TextInput value={yeni} onChangeText={setYeni} placeholder={t("İş (boş bırakılırsa: Dava aç)")} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1, minWidth: 220 }]} />
              <TextInput value={sonGun} onChangeText={setSonGun} placeholder={t("son gün (gg.aa.yyyy)")} placeholderTextColor={C.muted} style={[s.inputTek, { width: 170 }]} />
              <Btn kind="secondary" label={t("Föyü aç ve işi yaz")} disabled={!yd.dava.trim() && !yd.muvekkil.trim()} onPress={davaKaydet} />
            </View>
          </View>
        ) : hedef ? (
          <View style={[s.row, { alignItems: "center" }]}>
            <Text style={[s.body, { flex: 1 }]} numberOfLines={1}>{foyBaslik(hedef)} · {[hedef.mahkeme, hedef.esasNo].filter(Boolean).join(" ")}</Text>
            <Pressable onPress={() => { setHedef(null); setFoyAra(""); }}><Text style={s.sil}>{t("Föyü değiştir")}</Text></Pressable>
          </View>
        ) : (
          <TextInput value={foyAra} onChangeText={setFoyAra} placeholder={t("Föy ara: müvekkil, mahkeme, dosya no…")} placeholderTextColor={C.muted} style={s.inputTek} />
        )}
        {!yeniDava && bulunan.map(f => (
          <Pressable key={f.id} onPress={() => setHedef(f)} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <Text style={s.body} numberOfLines={1}>{foyBaslik(f)}</Text>
            <Text style={s.hint} numberOfLines={1}>{[f.mahkeme, f.esasNo, f.durum === "kapali" ? t("kapalı") : ""].filter(Boolean).join(" · ")}</Text>
          </Pressable>
        ))}
        {!yeniDava && !!hedef && (
          <View style={s.addRow}>
            <TextInput value={yeni} onChangeText={setYeni} onSubmitEditing={ekle} placeholder={t("İş: ör. bilirkişi raporuna itiraz")} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1, minWidth: 220 }]} />
            <TextInput value={sonGun} onChangeText={setSonGun} onSubmitEditing={ekle} placeholder={t("son gün (gg.aa.yyyy)")} placeholderTextColor={C.muted} style={[s.inputTek, { width: 170 }]} />
            <Btn kind="secondary" label={t("Ekle")} disabled={!yeni.trim()} onPress={ekle} />
          </View>
        )}
        {!!mesaj && <Text style={[s.hint, { color: C.good }]}>{mesaj}</Text>}
      </View>

      <View style={s.card}>
        <TextInput value={sz.ara} onChangeText={v => yaz({ ara: v })} placeholder={t("Ara: iş, taraf, mahkeme, dosya no, iş emri no…")} placeholderTextColor={C.muted} style={s.inputTek} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
          <Acilir etiket={t("Göster")} secili={sz.gorunum} genislik={170} onSec={k => yaz({ gorunum: k as IsSuzgec["gorunum"] })}
            secenekler={[{ k: "acik", ad: t("Açık işler") }, { k: "kapali", ad: t("Kapananlar") }, { k: "hepsi", ad: t("Hepsi") }]} />
          <Acilir etiket={t("Uyarı")} secili={sz.duzey} genislik={210} onSec={k => yaz({ duzey: k as IsSuzgec["duzey"] })}
            secenekler={[{ k: "hepsi", ad: t("Hepsi") }, { k: "acil", ad: t("Gecikmiş, bugün ve acil") }, { k: "hafta", ad: t("Bu hafta ve öncesi") }, ...DUZEY_SIRA.map(d => ({ k: d, ad: duzeyAdi(d), n: sayilar[d] }))]} />
          {uyeler.length > 1 && <Acilir etiket={t("Kişi")} secili={sz.kisi || "hepsi"} genislik={240} onSec={k => yaz({ kisi: k })}
            secenekler={[{ k: "hepsi", ad: t("Herkesin işleri") }, ...(ben ? [{ k: ben, ad: t("Bana verilenler") }] : []), { k: "yok", ad: t("Kimseye verilmemiş") }, ...uyeler.filter(u => u.kullanici_id !== ben).map(u => ({ k: u.kullanici_id, ad: `${u.ad} · ${t(u.unvan)}` }))]} />}
          <Acilir etiket={t("Dosya türü")} secili={sz.tur} genislik={210} onSec={k => yaz({ tur: k })}
            secenekler={[{ k: "hepsi", ad: t("Bütün türler") }, ...turler.map(x => ({ k: x.tur, ad: t(x.ad) }))]} />
        </View>
        <View style={[s.row, { alignItems: "center" }]}>
          <Text style={[s.body, { flex: 1 }]}>{t("{n} iş", { n: satirlar.length })}</Text>
          {web && N.Notification && bildirim !== "granted" && <Btn kind="ghost" label={t("🔔 Bildirimleri aç")} onPress={async () => setBildirim(await N.Notification!.requestPermission())} />}
          <Btn kind="secondary" label={t("Excel'e aktar (.xlsx)")} disabled={!satirlar.length} onPress={excel} />
        </View>
        {bildirim === "granted" && <Text style={s.hint}>{t("Bildirimler açık: Celse her gün ilk açıldığında gecikmiş ve acil işleri bildirir.")}</Text>}
      </View>

      {gorunen.map(({ f, g, u }) => {
        const renk = g.bitti ? C.line : DUZEY_RENK[u.duzey];
        return (
          <View key={f.id + g.id} style={[s.card, { borderLeftWidth: 5, borderLeftColor: renk, gap: 6 }]}>
            <View style={[s.row, { alignItems: "flex-start" }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.body, { color: g.bitti ? C.muted : C.text, textDecorationLine: g.bitti ? "line-through" : "none" }]}>{g.metin}</Text>
                <Pressable onPress={() => onAc(f.id)}><Text style={[s.hint, { textDecorationLine: "underline" }]} numberOfLines={1}>{foyBaslik(f)} · {[f.mahkeme, f.esasNo].filter(Boolean).join(" ")}</Text></Pressable>
                {g.bitti
                  ? <Text style={[s.hint, { color: C.good }]}>{g.kapanis ? t("Kapandı {d} · no: {no}{g}", { d: tarihYaz(g.kapanis.tarih), no: g.kapanis.no, g: g.kapanis.kaynak === "gorsel" ? " · " + t("görselden okundu") : "" }) : t("Numarasız kapatılmış (eski kayıt)")}</Text>
                  : <Text style={{ color: renk, fontSize: 13, fontWeight: "700" }}>{duzeyAdi(u.duzey)} · {t(u.metin)}{g.tarih ? " · " + t("son gün {d}", { d: tarihYaz(g.tarih) }) : ""}</Text>}
                {g.kaynak === "yapay" && !g.bitti && <Text style={s.hint}>{t("yapay zekâ önerisi, kontrol edin")}</Text>}
                {uyeler.length > 1 && !g.bitti
                  ? <Acilir etiket={t("Kimde")} secili={g.atanan || ""} genislik={260} secenekler={kisiSecenek} onSec={k => gorevYaz(f, g, atama(k))} />
                  : !!g.atananAd && <Text style={s.hint}>👤 {g.atananAd}</Text>}
              </View>
              {!g.bitti && kapat !== g.id && <Btn kind="secondary" label={t("Kapat…")} onPress={() => setKapat(g.id)} />}
              {g.bitti && !g.kapanis && <Btn kind="ghost" label={t("Numara ekle")} onPress={() => setKapat(g.id)} />}
              {g.bitti && <Pressable onPress={() => gorevYaz(f, g, { bitti: false, kapanis: undefined })}><Text style={s.sil}>{t("Yeniden aç")}</Text></Pressable>}
            </View>
            {kapat === g.id && <GorevKapat g={g} onVazgec={() => setKapat(null)} onKapat={async k => { await gorevYaz(f, g, { bitti: true, kapanis: k }); setKapat(null); }} />}
          </View>
        );
      })}
      {!gorunen.length && <Text style={s.hint}>{t("Bu süzgeçlere uyan iş yok.")}</Text>}
      {sayfaSay > 1 && (
        <View style={[s.row, { alignItems: "center" }]}>
          <Btn kind="ghost" label={t("‹ Önceki")} disabled={cur === 0} onPress={() => setSayfa(cur - 1)} />
          <Text style={s.hint}>{t("Sayfa {a} / {b}", { a: cur + 1, b: sayfaSay })}</Text>
          <Btn kind="ghost" label={t("Sonraki ›")} disabled={cur >= sayfaSay - 1} onPress={() => setSayfa(cur + 1)} />
        </View>
      )}
    </ScrollView>
  );
}

/** Günde bir kez (uygulama açılınca) gecikmiş ve acil işler tarayıcı bildirimi olarak gösterilir. */
export function gunlukBildirim(liste: Foy[]) {
  try {
    const N = (globalThis as unknown as { Notification?: { permission: string; new (b: string, o: object): unknown } }).Notification;
    if (!N || N.permission !== "granted") return;
    const bugun = bugunStr();
    if (globalThis.localStorage?.getItem("celse-bildirim-gun") === bugun) return;
    const n = duzeySayilari(liste, bugun);
    const acil = n.gecikti + n.bugun + n.acil;
    if (!acil && !n.uyari) return;
    globalThis.localStorage?.setItem("celse-bildirim-gun", bugun);
    new N("Celse · Yapılacaklar", { body: [n.gecikti ? `${n.gecikti} gecikmiş` : "", n.bugun ? `${n.bugun} son günü bugün` : "", n.acil ? `${n.acil} acil` : "", n.uyari ? `${n.uyari} bu hafta` : ""].filter(Boolean).join(", ") + " iş var." });
  } catch { /* bildirim yoksa geç */ }
}
