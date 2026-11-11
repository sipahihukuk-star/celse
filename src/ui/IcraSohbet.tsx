// İcra takibi bölümünde sohbet alanı: avukat evrakın metnini (UYAP'tan, PDF'ten kopyalayıp) yapıştırır, Celse bu cihazda okur;
// isterse yapay zekâya ne yapacağını yazar ("müvekkilimin alacaklarını yaz", "davalıya verilen vekâlet ücretini çıkar"). Yapay
// zekânın önerdiği değişiklik avukat "Uygula ve kaydet" demeden takibe yazılmaz.
import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Foy } from "../data/foy";
import { IcraBilgi } from "../data/icra";
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

export function IcraSohbet({ f, degistir, onMetinEkle, onKaydet }: { f: Foy; degistir: (ek: Partial<Foy>) => void; onMetinEkle?: (metin: string) => Promise<void>; onKaydet?: () => Promise<void> }) {
  const [metin, setMetin] = useState("");
  const [soru, setSoru] = useState("");
  const [bekle, setBekle] = useState(false);
  const [ekleniyor, setEkleniyor] = useState(false);
  const [hata, setHata] = useState("");
  const [bilgi, setBilgi] = useState("");
  const [oneri, setOneri] = useState<IcraDegisiklik | null>(null);
  const b: IcraBilgi = f.icra || { yol: "genel", paraBirimi: "TL", faizTuru: "yasal" };
  const sohbet = b.sohbet || [];

  const ekle = async () => {
    const x = metin.trim();
    if (x.length < 40 || !onMetinEkle) return;
    setEkleniyor(true); setHata(""); setBilgi("");
    try { await onMetinEkle(x); setMetin(""); setBilgi(t("Metin föye evrak olarak eklendi ve bu cihazda okundu. Aşağıdaki “İlamdan takip” kutusunu kontrol edin.")); }
    catch (e) { setHata(String((e as Error).message || e)); }
    finally { setEkleniyor(false); }
  };

  const gonder = async (q: string) => {
    const x = q.trim();
    if (x.length < 3 || bekle) return;
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
        <Btn label={t("Gönder")} disabled={bekle || soru.trim().length < 3} onPress={() => gonder(soru)} />
      </View>
      {sohbet.length > 0 && <Pressable onPress={() => degistir({ icra: { ...b, sohbet: [] } })}><Text style={[s.link, { color: C.muted }]}>{t("Sohbeti temizle")}</Text></Pressable>}
    </View>
  );
}
