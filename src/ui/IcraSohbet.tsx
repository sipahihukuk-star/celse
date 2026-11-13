// İcra takibi bölümünde sohbet alanı: avukat evrakın metnini (UYAP'tan, PDF'ten kopyalayıp) yapıştırır, Celse bu cihazda okur;
// isterse yapay zekâya ne yapacağını yazar ("müvekkilimin alacaklarını yaz", "davalıya verilen vekâlet ücretini çıkar"). Yapay
// zekânın önerdiği değişiklik avukat "Uygula ve kaydet" demeden takibe yazılmaz.
import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Foy } from "../data/foy";
import { IcraBilgi } from "../data/icra";
import { evrakTuruBul, hukumKalemleri, ilamdanTaraflar, ilamTaraflari } from "../data/icraEvrak";
import { talimatAyir, talimatOku, talimatUygula } from "../data/icraTalimat";
import { bizimVekil } from "../data/kunyeCikar";
import { t } from "../i18n";
import { degisiklikOzeti, IcraDegisiklik, icraSor } from "./icraSorCagri";
import { s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";

const HAZIR = [
  "İlamın hükmünü oku; müvekkilime verilen alacakları faiz türü ve başlangıcıyla yaz",
  "Tarafları ve hangi tarafın vekili olduğumuzu kontrol et",
  "İki vekâlet ücreti var mı, hangisi kime verilmiş?",
  "Takip için eksik ne var?"
];

export function IcraSohbet({ f, degistir, onMetinEkle, onKaydet, guncel, yenile, bizimAdlar = [] }: { f: Foy; degistir: (ek: Partial<Foy>) => void; onMetinEkle?: (metin: string) => Promise<void>; onKaydet?: () => Promise<void>; guncel?: () => Foy; yenile?: () => void; bizimAdlar?: string[] }) {
  const [metin, setMetin] = useState("");
  const [soru, setSoru] = useState("");
  const [bekle, setBekle] = useState(false);
  const [ekleniyor, setEkleniyor] = useState(false);
  const [hata, setHata] = useState("");
  const [bilgi, setBilgi] = useState("");
  const [oneri, setOneri] = useState<IcraDegisiklik | null>(null);
  const b: IcraBilgi = f.icra || { yol: "genel", paraBirimi: "TL", faizTuru: "yasal" };
  const sohbet = b.sohbet || [];

  /**
   * Talimatı önce bu cihazda uygular (tutarlar, eklenecek alacaklı / borçlu); okunacak bir şey yoksa yapay zekâya sorar.
   * Föydeki en yeni ilam varsa hükmünden bizim lehimize olan kalemler temel alınır, talimattaki tutarlar üstüne yazılır.
   */
  const talimatla = async (talimat: string): Promise<boolean> => {
    const r = talimatOku(talimat);
    if (!r.kalemler.length && !r.alacaklilar.length && !r.borclular.length) return false;
    const g = guncel ? guncel() : f;
    const ilam = g.evraklar.filter(e => e.metin.trim() && evrakTuruBul(e.metin) === "ilam").sort((a, c) => c.eklenme.localeCompare(a.eklenme))[0];
    const it = ilam ? ilamTaraflari(ilam.metin) : undefined;
    // Bizim taraf: ilamdaki vekil bizim avukatımızsa o; değilse föydeki seçim.
    const v1 = bizimVekil(it?.birinci?.vekil, bizimAdlar), v2 = bizimVekil(it?.ikinci?.vekil, bizimAdlar);
    const yan: "birinci" | "ikinci" = v1 !== v2 ? (v1 ? "birinci" : "ikinci") : g.taraf === "davali" ? "ikinci" : "birinci";
    const kt = g.icra?.ilam?.kararTarihi || it?.kararTarihi;
    // Önce ilamın taraflarını yerleştir (davacılar alacaklı, davalılar borçlu); talimattaki adlar onların üstüne eklenir.
    const yer = it ? ilamdanTaraflar(g, it, yan, { ekAlacakli: yan === "birinci" ? v1 : v2 }) : { ek: {} as Partial<Foy>, dolan: [] as string[] };
    const g2: Foy = { ...g, ...yer.ek };
    const u0 = talimatUygula(g2, r, {
      taraflar: it ? [...it.birinciler, ...it.ikinciler] : [], kaynak: g.evraklar.map(e => e.metin).join("\n"),
      hukumKalemleri: ilam ? hukumKalemleri(ilam.metin, kt, yan) : [], kararTarihi: kt, ilamli: !!ilam || /ilam|karar/i.test(talimat)
    });
    const u = { ek: { ...yer.ek, ...u0.ek, icra: u0.ek.icra || (yer.ek.icra ? { ...(g.icra || b), ...yer.ek.icra } : undefined) } as Partial<Foy>, dolan: [...yer.dolan.map(x => t(x)), ...u0.dolan] };
    if (!u.ek.icra) delete u.ek.icra;
    const icra = u.ek.icra || g.icra || b;
    if (u0.ek.icra && yer.ek.icra?.ekBorclular && !u0.ek.icra.ekBorclular) icra.ekBorclular = yer.ek.icra.ekBorclular;
    const cevap = u.dolan.length ? t("Bu cihazda uygulandı: {x}. Aşağıdaki alanlardan kontrol edin.", { x: u.dolan.join(", ") }) : t("Talimattaki her şey zaten takipte yazılı; değişiklik gerekmedi.");
    degistir({ ...u.ek, icra: { ...icra, sohbet: [...(icra.sohbet || []), { soru: talimat, cevap, tarih: new Date().toISOString() }].slice(-20) } });
    yenile?.();
    if (onKaydet) await onKaydet();
    setBilgi(cevap);
    return true;
  };

  const ekle = async () => {
    const { evrak, talimat } = talimatAyir(metin);
    if (evrak.length < 40 || !onMetinEkle) { if (talimat || metin.trim().length >= 3) await gonder(metin); return; }
    setEkleniyor(true); setHata(""); setBilgi("");
    try {
      const once = (guncel ? guncel() : f).evraklar.length;
      await onMetinEkle(evrak); setMetin("");
      // Föy sayfası yeni evrakı bir sonraki çizimde alır; talimat ona göre uygulansın diye kısa bir süre beklenir.
      for (let i = 0; i < 40 && guncel && guncel().evraklar.length <= once; i++) await new Promise(r => setTimeout(r, 50));
      setBilgi(t("Metin föye evrak olarak eklendi ve bu cihazda okundu. Aşağıdaki “İlamdan takip” kutusunu kontrol edin."));
      // Metnin sonuna yazılmış istek ("… olacak şekilde takibi hazırla, borçlu X'i de ekle") ayrıca uygulanır.
      if (talimat && !(await talimatla(talimat))) await gonder(talimat);
    }
    catch (e) { setHata(String((e as Error).message || e)); }
    finally { setEkleniyor(false); }
  };

  const gonder = async (q: string) => {
    const x = q.trim();
    if (x.length < 3 || bekle) return;
    // Tutar ve taraf içeren talimat bu cihazda uygulanır; öteki sorular yapay zekâya gider.
    if (await talimatla(x)) { setSoru(""); return; }
    setBekle(true); setHata(""); setBilgi(""); setOneri(null);
    try {
      // Yapıştırılıp henüz eklenmemiş metin de bu soruyla birlikte gider.
      const r = await icraSor(f, x, metin.trim());
      if (!r.ok) { setHata(t(r.hata, r.vars)); return; }
      degistir({ icra: { ...b, sohbet: [...sohbet, r.satir].slice(-20) } });
      setSoru("");
      if (r.degisiklik) setOneri(r.degisiklik);
    } catch (e) { setHata(String((e as Error).message || e)); }
    finally { setBekle(false); }
  };

  const uygula = async () => {
    if (!oneri) return;
    const ek: Partial<Foy> = {};
    if (oneri.taraf) ek.taraf = oneri.taraf;
    const icra: IcraBilgi = { ...b, sohbet: b.sohbet };
    if (oneri.yol) icra.yol = oneri.yol;
    if (oneri.kalemler) { icra.kalemler = oneri.kalemler; icra.asil = undefined; icra.islemisFaizElle = undefined; icra.ilamVekalet = undefined; icra.yargilamaGideri = undefined; }
    degistir({ ...ek, icra });
    setOneri(null);
    if (onKaydet) await onKaydet();
    setBilgi(t("Değişiklik takibe yazıldı ve kaydedildi."));
  };

  return (
    <View style={{ gap: 6, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 10 }}>
      <Text style={[s.body, { color: C.text, fontWeight: "800" }]}>{t("💬 Evrakı yapıştırın, yapay zekâyla konuşun")}</Text>
      <Text style={s.hint}>{t("İlamın, dilekçenin ya da raporun metnini kopyalayıp buraya yapıştırın: “Evrak olarak ekle” ile Celse bu cihazda okur. Yapay zekâya ne yapacağını alttaki kutuya yazabilirsiniz. Adlar, numaralar ve tarihler gönderilmeden önce bu cihazda kodlanır; öneriyi siz onaylamadan hiçbir şey değişmez.")}</Text>
      <TextInput value={metin} onChangeText={setMetin} multiline placeholder={t("Evrak metnini buraya yapıştırın…")} placeholderTextColor={C.muted}
        style={[s.input, { minHeight: 90, maxHeight: 220 }]} />
      {metin.trim().length > 0 && (
        <View style={[s.row, { gap: 8, alignItems: "center", flexWrap: "wrap" }]}>
          {!!onMetinEkle && <Btn label={ekleniyor ? t("Okunuyor…") : t("📋 Evrak olarak ekle ve oku")} disabled={ekleniyor || metin.trim().length < 40} onPress={ekle} />}
          <Pressable onPress={() => setMetin("")}><Text style={s.link}>{t("Temizle")}</Text></Pressable>
          <Text style={s.hint}>{t("{n} karakter", { n: metin.trim().length })}</Text>
        </View>
      )}

      {sohbet.slice(-6).map((x, i) => (
        <View key={i} style={{ gap: 2, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6 }}>
          <Text style={[s.body, { fontWeight: "700", color: C.brass }]}>{t("Siz")}: <Text style={{ fontWeight: "400", color: C.text }}>{x.soru}</Text></Text>
          <Text selectable style={s.body}>{x.cevap}</Text>
        </View>
      ))}
      {oneri && (
        <View style={{ gap: 4, borderWidth: 1, borderColor: C.brass, borderRadius: 8, padding: 8 }}>
          <Text style={[s.body, { fontWeight: "800" }]}>{t("Önerilen değişiklik")}</Text>
          {degisiklikOzeti(oneri).map((x, i) => <Text key={i} style={s.body}>• {t(x)}</Text>)}
          {!!oneri.kalemler && b.kalemler?.some(k => k.tutar) && <Text style={[s.hint, { color: C.mid }]}>{t("Şu an yazılı alacak kalemlerinin yerine bunlar yazılır.")}</Text>}
          <View style={[s.row, { gap: 8, alignItems: "center" }]}>
            <Btn label={t("✓ Uygula ve kaydet")} onPress={uygula} />
            <Pressable onPress={() => setOneri(null)}><Text style={s.link}>{t("Vazgeç")}</Text></Pressable>
          </View>
        </View>
      )}
      {bekle && <View style={[s.row, { gap: 8, alignItems: "center" }]}><ActivityIndicator color={C.brass} /><Text style={s.hint}>{t("Yapay zekâ okuyor…")}</Text></View>}
      {!!hata && <Text style={[s.hint, { color: C.bad }]}>{hata}</Text>}
      {!!bilgi && <Text style={[s.hint, { color: C.good }]}>{bilgi}</Text>}

      <View style={[s.row, { gap: 6, flexWrap: "wrap" }]}>
        {HAZIR.map(h => (
          <Pressable key={h} disabled={bekle} onPress={() => gonder(t(h))} accessibilityRole="button"
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [{ maxWidth: "100%", borderWidth: 1, borderColor: hovered ? C.brass : C.line, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 10 }, pressed && { opacity: 0.55, transform: [{ scale: 0.97 }] }, bekle && { opacity: 0.5 }]}>
            <Text style={[s.hint, { color: C.text }]}>{t(h)}</Text>
          </Pressable>
        ))}
      </View>
      <View style={[s.row, { gap: 8, alignItems: "flex-end" }]}>
        <TextInput value={soru} onChangeText={setSoru} multiline placeholder={t("Ne yapayım? Ör. “ihbarı da ekle”")} placeholderTextColor={C.muted}
          onKeyPress={(e: { nativeEvent?: { key?: string; shiftKey?: boolean }; preventDefault?: () => void }) => { const n = e?.nativeEvent; if (n?.key === "Enter" && !n.shiftKey) { e.preventDefault?.(); gonder(soru); } }}
          style={[s.input, { flex: 1, minHeight: 44 }]} />
        <Btn label={t("Gönder")} disabled={bekle || ekleniyor || (soru.trim().length < 3 && metin.trim().length < 3)} onPress={() => (soru.trim().length >= 3 ? gonder(soru) : ekle())} />
      </View>
      {sohbet.length > 0 && <Pressable onPress={() => degistir({ icra: { ...b, sohbet: [] } })}><Text style={[s.link, { color: C.muted }]}>{t("Sohbeti temizle")}</Text></Pressable>}
    </View>
  );
}
