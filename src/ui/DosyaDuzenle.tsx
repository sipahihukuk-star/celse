// Föylerim: "🧩 Dosyaları düzenle" düğmesi. Tek basışta bütün föyler taranır (cihazda):
//  - Aynı dosyanın birden çok föyü: esas no aynı ("2023/0311 E." = "2023/311"), merci ve taraflar çelişmiyor → tek föyde birleştirilir.
//  - Biri ötekinin devamı: suç duyurusu / soruşturma → ceza davası, arabuluculuk → dava, idari başvuru → idari dava, dava → icra…
//    (birinin numarası ötekinin evrakında geçiyor ve tür sırası uygun) → "devamı" olarak iç içe bağlanır, föyler ayrı kalır.
// Sonuç önce gösterilir; avukat istemediği grubu çıkarır, "Uygula" der. Uygulamadan önce bütün föylerin yedeği indirilir.
import React, { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { hareketEkle } from "../data/evrakHareket";
import { ayarOku, ayarYaz, Foy, foyGetir, foyKaydet, yedekMetni } from "../data/foy";
import { baglantilariCevir, foyBirlestir, kalacakFoy } from "../data/foyBirlestir";
import { turBilgi } from "../data/foyTurleri";
import { ayniGruplari, ciftAnahtari, iliskiOner, IliskiOnerisi } from "../data/iliski";
import { t } from "../i18n";
import { foyKisaAd } from "./foyEvrak";
import { indir, s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";

const etiket = (f: Foy) => [turBilgi(f.tur).ad, f.mahkeme || t("merci yok"), f.esasNo || t("numara yok"), f.muvekkil || t("müvekkil yok")].join(" · ") + ` (${f.evraklar.length} ${t("evrak")})`;
type Sonuc = { gruplar: { foyler: Foy[]; nedenler: string[] }[]; zincirler: IliskiOnerisi[] };

export function DosyaDuzenle({ liste, onAc }: { liste: Foy[]; onAc: (id: string) => void }) {
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);
  const [cikar, setCikar] = useState<Set<string>>(new Set());
  const [bekle, setBekle] = useState(false);
  const [ilerleme, setIlerleme] = useState("");
  const [bilgi, setBilgi] = useState("");
  const [hepsi, setHepsi] = useState(false);

  const bul = async () => {
    setBekle(true); setBilgi(""); setCikar(new Set());
    await new Promise(r => setTimeout(r, 30));
    try {
      const red = new Set((await ayarOku<string[]>("iliskiRed")) || []);
      const buro = liste.filter(f => !f.ozel);
      const gruplar = ayniGruplari(buro, red);
      // Devamı: tür sırası uygun ve birinin numarası ötekinin evrakında geçiyor (taraf adı yazılmamış föylerde de yakalanır).
      const zincirler = iliskiOner(buro, red, 100000).filter(o => o.tur === "zincir" && !o.b.oncekiId && o.nedenler.some(n => /evrakında geçiyor/.test(n)));
      setSonuc({ gruplar, zincirler });
    } finally { setBekle(false); }
  };

  const uygula = async () => {
    if (!sonuc) return;
    setBekle(true); setBilgi("");
    try {
      // Önce yedek: bir şey ters giderse Föylerim > Yedekten yükle ile geri dönülür.
      if (Platform.OS === "web") {
        const y = await yedekMetni();
        indir(`celse-yedek-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`, new Blob([y], { type: "application/json" }));
      }
      const gruplar = sonuc.gruplar.filter((_g, i) => !cikar.has("g" + i));
      const zincirler = sonuc.zincirler.filter(o => !cikar.has(o.anahtar));
      let birlesen = 0, baglanan = 0;
      const silinen = new Map<string, string>(); // birleşince giden föy → kalan föy
      for (let i = 0; i < gruplar.length; i++) {
        setIlerleme(t("Birleştiriliyor: {i} / {n} grup", { i: i + 1, n: gruplar.length }));
        const fs = gruplar[i].foyler;
        let kalan = fs.reduce((a, b) => kalacakFoy(a, b)[0]);
        for (const f of fs) {
          if (f.id === kalan.id) continue;
          try { kalan = await foyBirlestir(kalan.id, f.id, false); silinen.set(f.id, kalan.id); birlesen++; } catch { /* bulunamayan föy atlanır */ }
        }
        hareketEkle({ yon: "giden", ad: foyKisaAd(kalan), sonuc: "birlesti", foyId: kalan.id, foyAd: foyKisaAd(kalan), not: t("{n} föy tek föyde birleştirildi", { n: fs.length }) }).catch(() => {});
      }
      if (silinen.size) { setIlerleme(t("Bağlantılar güncelleniyor…")); await baglantilariCevir(silinen); }
      for (let i = 0; i < zincirler.length; i++) {
        setIlerleme(t("Bağlanıyor: {i} / {n}", { i: i + 1, n: zincirler.length }));
        const o = zincirler[i];
        const aId = silinen.get(o.a.id) || o.a.id, bId = silinen.get(o.b.id) || o.b.id;
        if (aId === bId) continue;
        const b = await foyGetir(bId);
        if (!b || b.oncekiId) continue;
        await foyKaydet({ ...b, oncekiId: aId });
        baglanan++;
      }
      // Çıkarılan (istenmeyen) gruplar bir daha önerilmesin.
      const red = new Set((await ayarOku<string[]>("iliskiRed")) || []);
      sonuc.gruplar.forEach((g, i) => { if (cikar.has("g" + i)) for (const x of g.foyler) for (const y of g.foyler) if (x.id < y.id) red.add(ciftAnahtari(x.id, y.id, "ayni")); });
      sonuc.zincirler.forEach(o => { if (cikar.has(o.anahtar)) red.add(o.anahtar); });
      await ayarYaz("iliskiRed", [...red]);
      setSonuc(null);
      setBilgi(t("Tamam: {b} föy birleştirildi, {z} dosya devamı olarak bağlandı. Yedek indirildi.", { b: birlesen, z: baglanan }));
    } catch (e) { setBilgi(t("Durdu: {e}. Yapılanlar kaydedildi; yedekten geri dönebilirsiniz.", { e: String((e as Error).message || e) })); }
    finally { setBekle(false); setIlerleme(""); }
  };

  const degis = (k: string) => setCikar(x => { const y = new Set(x); if (y.has(k)) y.delete(k); else y.add(k); return y; });
  const kutu = (k: string) => (
    <Pressable onPress={() => degis(k)} accessibilityRole="checkbox" accessibilityState={{ checked: !cikar.has(k) }} hitSlop={6}
      style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: cikar.has(k) ? C.muted : C.brass, backgroundColor: cikar.has(k) ? "transparent" : C.brass, alignItems: "center", justifyContent: "center" }}>
      {!cikar.has(k) && <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>✓</Text>}
    </Pressable>
  );
  const sinir = hepsi ? 1000 : 8;
  const fazla = (n: number) => n > sinir;

  return (
    <View style={[s.card, { gap: 8 }]}>
      <Text style={s.cardT}>{t("🧩 Dosyaları düzenle")}</Text>
      <Text style={s.hint}>{t("Tek basışta bütün föyler taranır: aynı dosyanın birden çok föyü (esas no aynı; merci ve taraflar çelişmiyor) bulunur, suç duyurusu → ceza davası, arabuluculuk → dava gibi devam eden dosyalar bulunur. Önce sonucu görürsünüz; uygun olanları “Uygula” ile birleştirir ve iç içe bağlarsınız.")}</Text>
      {!sonuc && <Btn label={bekle ? t("Taranıyor…") : t("🔍 Benzer ve devam eden dosyaları bul")} disabled={bekle || !liste.length} onPress={bul} />}
      {sonuc && (
        <View style={{ gap: 8 }}>
          <Text style={[s.body, { fontWeight: "700" }]}>{t("Bulunan: aynı dosyanın birden çok föyü {g} grup ({f} föy) · devamı olan {z} dosya", { g: sonuc.gruplar.length, f: sonuc.gruplar.reduce((a, g) => a + g.foyler.length, 0), z: sonuc.zincirler.length })}</Text>
          {!sonuc.gruplar.length && !sonuc.zincirler.length && <Text style={s.hint}>{t("Birleştirilecek ya da bağlanacak dosya bulunamadı.")}</Text>}
          {!!sonuc.gruplar.length && <Text style={s.secT}>{t("🔀 Birleştirilecekler (her grup tek föy olur)")}</Text>}
          {sonuc.gruplar.slice(0, sinir).map((g, i) => {
            const kalan = g.foyler.reduce((a, b) => kalacakFoy(a, b)[0]);
            return (
              <View key={"g" + i} style={[s.file, { flexDirection: "column", alignItems: "stretch", gap: 4, opacity: cikar.has("g" + i) ? 0.5 : 1 }]}>
                <View style={[s.row, { gap: 8, alignItems: "center" }]}>{kutu("g" + i)}<Text style={[s.hint, { flex: 1 }]}>{t("Neden: {n}", { n: g.nedenler.join(", ") })}</Text></View>
                {g.foyler.map(f => (
                  <Pressable key={f.id} onPress={() => onAc(f.id)}><Text style={[s.body, f.id === kalan.id ? { fontWeight: "700" } : null]}>{f.id === kalan.id ? "★ " : "• "}{etiket(f)}</Text></Pressable>
                ))}
                <Text style={[s.hint, { fontSize: 11 }]}>{t("★ kalacak föy; ötekilerin evrakı, işleri ve notları ona taşınır.")}</Text>
              </View>
            );
          })}
          {fazla(sonuc.gruplar.length) && <Text style={s.hint}>{t("… ve {n} grup daha", { n: sonuc.gruplar.length - sinir })}</Text>}
          {!!sonuc.zincirler.length && <Text style={s.secT}>{t("🔗 İç içe bağlanacaklar (② ①'in devamı olur)")}</Text>}
          {sonuc.zincirler.slice(0, sinir).map(o => (
            <View key={o.anahtar} style={[s.file, { flexDirection: "column", alignItems: "stretch", gap: 4, opacity: cikar.has(o.anahtar) ? 0.5 : 1 }]}>
              <View style={[s.row, { gap: 8, alignItems: "center" }]}>{kutu(o.anahtar)}<Text style={[s.hint, { flex: 1 }]}>{t("Neden: {n}", { n: o.nedenler.join(", ") })}</Text></View>
              <Pressable onPress={() => onAc(o.a.id)}><Text style={s.body}>① {etiket(o.a)}</Text></Pressable>
              <Pressable onPress={() => onAc(o.b.id)}><Text style={s.body}>② {etiket(o.b)}</Text></Pressable>
            </View>
          ))}
          {fazla(sonuc.zincirler.length) && <Text style={s.hint}>{t("… ve {n} bağlantı daha", { n: sonuc.zincirler.length - sinir })}</Text>}
          {(fazla(sonuc.gruplar.length) || fazla(sonuc.zincirler.length)) && <Pressable onPress={() => setHepsi(x => !x)}><Text style={s.link}>{hepsi ? t("Daha az göster") : t("Hepsini listele")}</Text></Pressable>}
          {!!ilerleme && <Text style={s.hint}>{ilerleme}</Text>}
          <View style={s.addRow}>
            {(sonuc.gruplar.length > 0 || sonuc.zincirler.length > 0) && <Btn label={bekle ? t("Uygulanıyor…") : t("✓ Yedek al ve uygula")} disabled={bekle} onPress={uygula} />}
            <Btn kind="ghost" label={t("Vazgeç")} disabled={bekle} onPress={() => setSonuc(null)} />
          </View>
          <Text style={[s.hint, { fontSize: 11 }]}>{t("İstemediğiniz grubun ya da bağlantının kutusunu kaldırın; bir daha önerilmez. Uygulamadan önce bütün föylerin yedeği bilgisayarınıza indirilir.")}</Text>
        </View>
      )}
      {!!bilgi && <Text style={[s.hint, { color: C.good }]}>{bilgi}</Text>}
    </View>
  );
}
