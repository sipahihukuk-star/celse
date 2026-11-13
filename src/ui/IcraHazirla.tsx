// "🤖 Takibi yapay zekâyla hazırla": en güçlü model föydeki bütün evrakı okur (adlar, kimlik no'ları, adresler ve tarihler
// kodlanarak gider; cevap bu cihazda açılır) ve icra takibi açılırsa kim kimden hangi kalemi, hangi faizle, hangi tarihten
// itibaren isteyebilir, açıkça listeler. Celse'nin kendi okumasıyla karşılaştırılır; avukat görüp "Takibe yaz" demeden
// föye hiçbir şey yazılmaz. Yazılınca XML için gereken her şey (alacaklılar, borçlular, kalemler, ilam, yol, mahiyet) dolar.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Foy, tarihYaz } from "../data/foy";
import { FAIZ_TURLERI, MAHIYETLER, TAKIP_YOLLARI, tl } from "../data/icra";
import { evrakTuruBul, hukumKalemleri } from "../data/icraEvrak";
import { hazirligiUygula, IcraHazirlik, okumaKarsilastir } from "../data/icraHazirla";
import { t } from "../i18n";
import { s } from "./foyStil";
import { icraHazirla } from "./icraSorCagri";
import { Btn } from "./kit";
import { C } from "./theme";

const faizAdi = (k?: string) => FAIZ_TURLERI.find(x => x.k === k)?.ad || k || "yasal";

export function IcraHazirla({ f, degistir, guncel, yenile, onKaydet }: { f: Foy; degistir: (ek: Partial<Foy>) => void; guncel?: () => Foy; yenile?: () => void; onKaydet?: () => Promise<void> }) {
  const [not, setNot] = useState("");
  const [bekle, setBekle] = useState(false);
  const [sn, setSn] = useState(0);
  const [hata, setHata] = useState("");
  const [bilgi, setBilgi] = useState("");
  const [h, setH] = useState<IcraHazirlik | null>(null);
  const zaman = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (zaman.current) clearInterval(zaman.current); }, []);
  const metinli = f.evraklar.filter(e => e.metin.trim());

  // Celse'nin kendi (kurallı) okuması: en yeni ilamın hükmünden bizim lehimize kalemler.
  const yerel = useMemo(() => {
    const ilam = metinli.filter(e => evrakTuruBul(e.metin) === "ilam").sort((a, c) => c.eklenme.localeCompare(a.eklenme))[0];
    return ilam ? hukumKalemleri(ilam.metin, f.icra?.ilam?.kararTarihi, f.taraf === "davali" ? "ikinci" : "birinci") : null;
  }, [f.evraklar.length, f.taraf, f.icra?.ilam?.kararTarihi]);
  const farklar = useMemo(() => (h && yerel ? okumaKarsilastir(h, yerel) : []), [h, yerel]);

  const baslat = async () => {
    setBekle(true); setHata(""); setBilgi(""); setH(null); setSn(0);
    zaman.current = setInterval(() => setSn(x => x + 1), 1000);
    try {
      const r = await icraHazirla(guncel ? guncel() : f, not);
      if (!r.ok) {
        setHata(t(r.hata, r.vars) + (r.status === 400 || r.status === 404 ? " " + t("Sunucudaki yapay zekâ işlevi (danisma) henüz güncellenmemiş olabilir.") : ""));
        return;
      }
      if (!r.h.borclular.length && !r.h.kalemler.length) { setHata(t("Yapay zekâ evrakta takibe konu bir hüküm bulamadı. İlamın (karar metninin) yüklendiğinden emin olun.")); return; }
      setH(r.h);
    } catch (e) { setHata(String((e as Error).message || e)); }
    finally { if (zaman.current) clearInterval(zaman.current); zaman.current = null; setBekle(false); }
  };

  const yazdir = async () => {
    if (!h) return;
    const { ek, yazilan } = hazirligiUygula(guncel ? guncel() : f, h);
    degistir(ek);
    yenile?.();
    if (onKaydet) await onKaydet();
    setH(null);
    setBilgi(t("Takibe yazıldı: {x}. Aşağıdaki alanlardan kontrol edip UYAP XML'ini indirebilirsiniz.", { x: yazilan.map(x => t(x)).join(", ") }));
  };

  const toplam = h ? h.kalemler.reduce((a, k) => a + k.tutar, 0) : 0;
  const kisiSatiri = (x: { ad: string; kimlikNo?: string; adres?: string }, i: number) => (
    <Text key={i} style={s.body}>
      {i + 1}. <Text style={{ fontWeight: "700" }}>{x.ad}</Text>
      <Text style={s.hint}>{"  · " + (x.kimlikNo ? t("kimlik no {n}", { n: x.kimlikNo }) : t("kimlik no yok"))}{" · " + (x.adres || t("adres yok"))}</Text>
    </Text>
  );

  return (
    <View style={{ gap: 8, borderWidth: 2, borderColor: C.brass, borderRadius: 12, padding: 12 }}>
      <Text style={[s.body, { color: C.text, fontWeight: "700" }]}>{t("2. 🤖 Takibi yapay zekâyla hazırla")}</Text>
      <Text style={s.hint}>{t("En güçlü yapay zekâ modeli yüklenen bütün evrakı (ilk derece kararı, istinaf / temyiz kararı, dilekçeler) okur ve takip açılırsa kim kimden hangi alacağı, hangi faizle, hangi tarihten itibaren isteyebilir, tek tek çıkarır: bütün davacılar ve davalılar (2., 3. borçlu dahil), alacak kalemleri, faiz türü ve başlangıcı, ilam bilgileri. Adlar, kimlik no'ları, adresler ve tarihler kodlanarak gönderilir; cevap bu cihazda açılır. Siz görüp “Takibe yaz” demeden hiçbir şey yazılmaz.")}</Text>
      {!metinli.length ? (
        <Text style={s.hint}>{t("Önce yukarıdan ilamı (kararı) yükleyin.")}</Text>
      ) : (
        <>
          <TextInput value={not} onChangeText={setNot} multiline editable={!bekle}
            placeholder={t("Not (isteğe bağlı): ör. “istinaf kararı esas alınsın”, “yalnız 1. davalı aleyhine takip açılacak”")}
            placeholderTextColor={C.muted} style={[s.input, { minHeight: 44 }]} />
          <View style={[s.row, { gap: 8, flexWrap: "wrap", alignItems: "center" }]}>
            <Btn label={bekle ? t("Evrak okunuyor… {n} sn", { n: sn }) : h ? t("🤖 Yeniden hazırla") : t("🤖 Takibi hazırla ({n} evrak okunacak)", { n: metinli.length })} disabled={bekle} onPress={baslat} />
            {bekle && <Text style={s.hint}>{t("Dikkatli okuma 1-3 dakika sürebilir; bu ekranda bekleyin.")}</Text>}
          </View>
        </>
      )}
      {!!hata && <Text style={[s.hint, { color: C.bad }]}>{hata}</Text>}
      {!!bilgi && <Text style={[s.hint, { color: C.good }]}>{bilgi}</Text>}

      {h && (
        <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 }}>
          {!!h.ozet && <Text style={[s.body, { color: C.text }]}>{h.ozet}</Text>}

          <View style={{ gap: 2 }}>
            <Text style={s.label}>{t("Alacaklılar ({n})", { n: h.alacaklilar.length })}</Text>
            {h.alacaklilar.length ? h.alacaklilar.map(kisiSatiri) : <Text style={[s.hint, { color: C.bad }]}>{t("Bulunamadı")}</Text>}
          </View>
          <View style={{ gap: 2 }}>
            <Text style={s.label}>{t("Borçlular ({n})", { n: h.borclular.length })}</Text>
            {h.borclular.length ? h.borclular.map(kisiSatiri) : <Text style={[s.hint, { color: C.bad }]}>{t("Bulunamadı")}</Text>}
          </View>

          <View style={{ gap: 6 }}>
            <Text style={s.label}>{t("İstenebilecek alacaklar ({n})", { n: h.kalemler.length })}</Text>
            {h.kalemler.map((k, i) => (
              <View key={i} style={{ gap: 2, borderLeftWidth: 3, borderLeftColor: C.brass, paddingLeft: 8 }}>
                <Text style={s.body}><Text style={{ fontWeight: "700" }}>{k.ad}</Text>{"  " + tl(k.tutar)}</Text>
                <Text style={s.hint}>
                  {t("Faiz: {f}", { f: t(faizAdi(k.faizTuru)) })}
                  {k.faizTuru !== "yok" ? " · " + (k.faizBaslangic ? t("{d} tarihinden", { d: tarihYaz(k.faizBaslangic) }) : t("başlangıç tarihi yok, kontrol edin")) : ""}
                </Text>
                {(!!k.alacakli || !!k.borclular) && <Text style={s.hint}>{(k.borclular || t("borçlular")) + " → " + (k.alacakli || t("alacaklı"))}</Text>}
                {!!k.dayanak && <Text style={s.hint}>{t("Dayanak: {d}", { d: k.dayanak })}</Text>}
              </View>
            ))}
            <Text style={[s.body, { fontWeight: "700" }]}>{t("Asıl alacak toplamı: {x}", { x: tl(toplam) })}</Text>
            <Text style={s.hint}>{t("İşlemiş faiz takip tarihine kadar Celse'de hesaplanır (TCMB oranlarıyla); icra vekâlet ücreti ve masraflar takip talebine ayrıca eklenir.")}</Text>
          </View>

          {!!h.ilam && Object.values(h.ilam).some(Boolean) && (
            <Text style={s.hint}>
              {t("İlam")}: {[h.ilam.mahkeme, h.ilam.esasNo && "E. " + h.ilam.esasNo, h.ilam.kararNo && "K. " + h.ilam.kararNo, h.ilam.kararTarihi && t("karar {d}", { d: tarihYaz(h.ilam.kararTarihi) }), h.ilam.kesinlesme && t("kesinleşme {d}", { d: tarihYaz(h.ilam.kesinlesme) })].filter(Boolean).join(", ")}
              {h.davaTarihi ? " · " + t("dava tarihi {d}", { d: tarihYaz(h.davaTarihi) }) : ""}
              {h.yol ? " · " + t(TAKIP_YOLLARI.find(x => x.k === h.yol)?.ad || h.yol) : ""}
              {h.mahiyet ? " · " + t("mahiyet {m}", { m: MAHIYETLER.find(x => x.kod === h.mahiyet)?.ad || h.mahiyet }) : ""}
            </Text>
          )}

          {yerel && (
            farklar.length ? (
              <View style={{ gap: 2 }}>
                <Text style={[s.label, { color: C.bad }]}>{t("⚠ Celse'nin kendi okumasıyla farklar")}</Text>
                {farklar.map((x, i) => <Text key={i} style={s.hint}>• {x.metin}</Text>)}
              </View>
            ) : h.kalemler.length ? <Text style={[s.hint, { color: C.good }]}>{t("✓ Tutarlar ve faizler Celse'nin kendi okumasıyla tutuyor.")}</Text> : null
          )}
          {!!h.kontrol.length && (
            <View style={{ gap: 2 }}>
              <Text style={s.label}>{t("Kontrol etmeniz gerekenler")}</Text>
              {h.kontrol.map((x, i) => <Text key={i} style={s.hint}>• {x}</Text>)}
            </View>
          )}

          <Text style={s.hint}>{t("“Takibe yaz” alacaklıları, borçluları (künyedeki karşı taraflarla birlikte), alacak kalemlerini ve ilam bilgilerini bu listeyle değiştirir; föyde olup burada boş kalan kimlik no ve adresler korunur.")}</Text>
          <View style={[s.row, { gap: 8, flexWrap: "wrap" }]}>
            <Btn label={t("✓ Takibe yaz")} onPress={yazdir} />
            <Btn kind="ghost" label={t("Vazgeç")} onPress={() => setH(null)} />
          </View>
        </View>
      )}
    </View>
  );
}
