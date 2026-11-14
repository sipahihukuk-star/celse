// Duruşma ve keşifler kartının sağında: "Duruşma simülasyonu". Eldeki evrakla (tutanak, ara karar, bilirkişi raporu,
// dilekçeler) sıradaki duruşmada neler yaşanabileceğini yapay zekâ canlandırır: gündem, salonda konuşulabilecekler, hâkimin
// soruları, karşı tarafın beyanları, muhtemel ara kararlar, hazırlık. Dosya cihazda kodlanır, kodlu hâli gider; cevap
// gerçek adlarla açılıp föye kaydedilir. "Salonda canlandır" ilk yaptığımız Evrakla duruşma provasını (oyun sahnesi) açar.
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { asamalar, bugunGun, dTur, durusmaSirala, eAdi } from "../data/durusma";
import { Foy, Gorev, tarihYaz, yeniId } from "../data/foy";
import { bugunStr } from "../data/isTakibi";
import { BASLIK, okunacak, onerilenIsler } from "../data/yzCevap";
import { t } from "../i18n";
import { foyaSor } from "./foySorCagri";
import { s } from "./foyStil";
import { Btn } from "./kit";
import { sesliDur, sesliOku, useSesliOkuma } from "./sesliOku";
import { C } from "./theme";

const KONUSAN = /^(Hâkim|Hakim|Mahkeme Başkanı|Başkan|Üye Hâkim|Davacı vekili|Davalı vekili|Biz \([^)]*\)|Biz|Tanık|Bilirkişi|Savcı|Cumhuriyet Savcısı|Sanık|Müdafi|Katılan vekili|Müşteki|Davacı|Davalı|Katip|Zabıt kâtibi)\s*:/i;

export function DurusmaSimulasyon({ f, degistir, onHazirlan }: { f: Foy; degistir: (ek: Partial<Foy>) => void; onHazirlan?: (f: Foy) => void }) {
  const [bekle, setBekle] = useState(false);
  const [hata, setHata] = useState("");
  const [acik, setAcik] = useState<Set<string>>(new Set(["DURUŞMANIN GÜNDEMİ", "SALONDA OLABİLECEKLER"]));
  const okuyor = useSesliOkuma();
  const bugun = bugunGun();
  const evrakVar = f.evraklar.some(e => !!e.metin.trim());
  // Hedef: ileri tarihli ilk duruşma; yoksa son duruşmadan sonraki (günü yazılmamış) celse.
  const hedef = useMemo(() => {
    const xs = durusmaSirala(f.durusmalar || []).filter(d => dTur(d) === "durusma");
    const d = xs.find(x => x.tarih.slice(0, 10) >= bugun);
    const as = asamalar(f);
    const a = as.find(x => x.gunler.some(g => g.d && d && g.d.id === d.id)) || as.find(x => x.guncel);
    const celse = d ? a?.gunler.find(g => g.d?.id === d.id)?.celse : (() => { const c = a?.gunler.filter(g => g.celse).map(g => g.celse!) || []; return c.length ? Math.max(...c) + 1 : undefined; })();
    return { d, a, celse };
  }, [f.durusmalar, f.yargilamalar, f.mahkeme, f.esasNo, bugun]);
  const sim = f.durusmaSim;
  const eski = !!sim && (f.evraklar.some(e => e.eklenme > sim.tarih) || (hedef.d && sim.durusmaId !== hedef.d.id));

  const olustur = async () => {
    if (bekle) return;
    setHata(""); setBekle(true); sesliDur();
    const gecmis = durusmaSirala(f.durusmalar || []).filter(d => d.tarih.slice(0, 10) < bugun).slice(-8)
      .map(d => "- " + tarihYaz(d.tarih) + " " + (dTur(d) === "kesif" ? "keşif" : "duruşma") + (d.girildi === "evet" ? " (girildi)" : d.girildi === "hayir" ? " (girilmedi)" : "") + (d.not ? " · not: " + d.not : ""));
    const soru = [
      "Sıradaki duruşmanın simülasyonunu hazırla.",
      "Mahkeme: " + (hedef.a?.mahkeme || f.mahkeme || "yazılmamış") + (hedef.a?.esasNo ? " · dosya no " + hedef.a.esasNo : ""),
      hedef.d ? "Sıradaki duruşma: " + tarihYaz(hedef.d.tarih) + (hedef.celse ? " (" + hedef.celse + ". celse)" : "") + (hedef.d.e ? " · " + eAdi(f, hedef.d) + ": " + hedef.d.e : "") : "Sıradaki duruşma günü henüz yazılmadı" + (hedef.celse ? " (" + hedef.celse + ". celse olacak)" : "") + ".",
      gecmis.length ? "Önceki duruşma ve keşifler:\n" + gecmis.join("\n") : ""
    ].filter(Boolean).join("\n");
    try {
      const r = await foyaSor(f, soru, { simulasyon: true });
      if (!r.ok) { setHata(t(r.hata, r.vars)); return; }
      degistir({ durusmaSim: { tarih: new Date().toISOString(), durusmaId: hedef.d?.id, durusmaTarih: hedef.d?.tarih, metin: r.yeni.cevap, kaynaklar: r.yeni.kaynaklar } });
    } catch (e) { setHata(t(String((e as Error).message || e))); }
    finally { setBekle(false); }
  };

  // Cevap başlıklara bölünür; her başlık aç / kapa.
  const bolumler = useMemo(() => {
    if (!sim) return [] as { baslik: string; satirlar: string[] }[];
    const out: { baslik: string; satirlar: string[] }[] = [];
    for (const x of sim.metin.split("\n")) {
      const y = x.trim();
      if (!y) continue;
      const m = y.match(BASLIK);
      if (m) { out.push({ baslik: m[1], satirlar: [] }); const kalan = y.slice(m[0].length).trim(); if (kalan) out[out.length - 1].satirlar.push(kalan); continue; }
      if (!out.length) out.push({ baslik: "", satirlar: [] });
      out[out.length - 1].satirlar.push(y);
    }
    return out;
  }, [sim?.metin]);
  const isler = sim ? onerilenIsler(sim.metin).filter(o => !f.gorevler.some(g => g.metin === o.metin)) : [];
  const isEkle = () => {
    const yeni: Gorev[] = isler.map(o => ({ id: yeniId("g"), metin: o.metin, tarih: o.tarih, bitti: false, kaynak: "yapay", eklenme: bugunStr() }));
    if (yeni.length) degistir({ gorevler: [...f.gorevler, ...yeni] });
  };
  const ac = (b: string) => { const y = new Set(acik); if (y.has(b)) y.delete(b); else y.add(b); setAcik(y); };

  return (
    <View style={{ gap: 8, borderWidth: 1, borderColor: C.brassDim, borderRadius: 10, padding: 10 }}>
      <Text style={[s.body, { color: C.text, fontWeight: "800" }]}>🎭 {t("Duruşma simülasyonu")}</Text>
      <Text style={s.hint}>
        {hedef.d
          ? t("Sıradaki duruşma: {d}", { d: tarihYaz(hedef.d.tarih) }) + (hedef.celse ? " · " + t("{n}. celse", { n: hedef.celse }) : "") + (hedef.a?.kisa ? " · " + hedef.a.kisa : "")
          : t("Sıradaki duruşma günü yazılmadı") + (hedef.celse ? " · " + t("{n}. celse olacak", { n: hedef.celse }) : "")}
      </Text>
      <Text style={s.hint}>{t("Eldeki evrakla (tutanak, ara karar, bilirkişi raporu, dilekçeler) bu duruşmada neler yaşanabileceğini canlandırır: gündem, salonda konuşulabilecekler, hâkimin soruları, karşı tarafın beyanları, muhtemel ara kararlar ve hazırlık. Adlar ve numaralar cihazda kodlanır.")}{onHazirlan ? " " + t("“Salonda canlandır” evrakla duruşma provasını açar: duruşma salonda oynanır.") : ""}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <Btn label={bekle ? t("Hazırlanıyor…") : sim ? t("↻ Simülasyonu yenile") : t("▶ Simülasyonu oluştur")} onPress={olustur} disabled={bekle || !evrakVar} />
        {onHazirlan && <Btn kind="secondary" label={t("🎬 Salonda canlandır")} onPress={() => onHazirlan(f)} disabled={!evrakVar} />}
        {bekle && <ActivityIndicator color={C.brass} />}
      </View>
      {!evrakVar && <Text style={[s.hint, { color: C.mid }]}>{t("Simülasyon için föye en az bir okunabilir evrak (tutanak, dilekçe, ara karar) ekleyin.")}</Text>}
      {!!hata && <Text style={[s.hint, { color: C.bad }]}>{hata}</Text>}
      {sim && (
        <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <Text style={[s.hint, { flex: 1 }]}>{t("Hazırlandı: {d}", { d: tarihYaz(sim.tarih.slice(0, 10)) })}{sim.durusmaTarih ? " · " + t("{d} duruşması için", { d: tarihYaz(sim.durusmaTarih) }) : ""}</Text>
            <Pressable onPress={() => (okuyor ? sesliDur() : sesliOku(okunacak(sim.metin), 1.05))} accessibilityRole="button">
              <Text style={s.link}>{okuyor ? t("⏹ Durdur") : t("🔊 Sesli oku")}</Text>
            </Pressable>
          </View>
          {eski && <Text style={[s.hint, { color: C.mid }]}>{t("Simülasyondan sonra yeni evrak geldi ya da sıradaki duruşma değişti; yenileyin.")}</Text>}
          {bolumler.map((b, i) => {
            const on = !b.baslik || acik.has(b.baslik);
            return (
              <View key={b.baslik + i} style={{ gap: 3 }}>
                {!!b.baslik && (
                  <Pressable onPress={() => ac(b.baslik)} accessibilityRole="button" accessibilityState={{ expanded: on }}>
                    <Text style={{ color: C.brass, fontWeight: "800", fontSize: 12, letterSpacing: 0.5 }}>{on ? "▾ " : "▸ "}{b.baslik}</Text>
                  </Pressable>
                )}
                {on && b.satirlar.map((x, j) => {
                  const m = x.match(KONUSAN);
                  return m
                    ? <Text key={j} style={[s.body, { fontSize: 13 }]}><Text style={{ fontWeight: "800", color: /^Biz/i.test(m[1]) ? C.good : /^H[âa]kim|Başkan|Mahkeme/i.test(m[1]) ? C.brass : C.text }}>{m[1]}:</Text>{x.slice(m[0].length)}</Text>
                    : <Text key={j} style={[s.body, { fontSize: 13 }]}>{x}</Text>;
                })}
              </View>
            );
          })}
          {isler.length > 0 && <View style={s.row}><Btn kind="secondary" label={t("➕ Önerilen {n} işi Yapılacaklar'a ekle", { n: isler.length })} onPress={isEkle} /></View>}
          {!!sim.kaynaklar?.length && <Text style={s.hint}>{t("Kaynaklar: {x}", { x: sim.kaynaklar.map(k => k.baslik).join(" · ") })}</Text>}
          <Text style={s.hint}>{t("Simülasyon bir hazırlık aracıdır; duruşmada olacakları kesin göstermez. Son değerlendirme sizindir.")}</Text>
        </View>
      )}
    </View>
  );
}
