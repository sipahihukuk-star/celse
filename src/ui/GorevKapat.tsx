// Bir işin kapanışı: "Yapıldı, kapat" işi hemen kapatır (arşive düşer). İş emri / evrak numarası isteğe bağlıdır; UYAP gönderim
// ekranının, makbuzun ya da tebligat barkodunun fotoğrafı seçilirse numara bu cihazda okunup yazılır. "Listeden kaldır" işi siler.
import React, { useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import type { Gorev, GorevKapanis } from "../data/foy";
import { DUZEY_AD, Duzey, isEmriAdaylari, NoAday, bugunStr } from "../data/isTakibi";
import { t } from "../i18n";
import { dosyaSec, s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";

export const DUZEY_RENK: Record<Duzey, string> = { gecikti: "#ff4d4d", bugun: "#ff4d4d", acil: C.bad, uyari: C.p2, dikkat: C.mid, sakin: C.good, tarihsiz: C.muted };
export const duzeyAdi = (d: Duzey) => t(DUZEY_AD[d]);

export function GorevKapat({ g, onKapat, onVazgec, onSil }: { g: Gorev; onKapat: (k: GorevKapanis) => void; onVazgec: () => void; onSil?: () => void }) {
  const [no, setNo] = useState("");
  const [kaynak, setKaynak] = useState<GorevKapanis["kaynak"]>("elle");
  const [gorsel, setGorsel] = useState<string>();
  const [adaylar, setAdaylar] = useState<NoAday[] | null>(null);
  const [durum, setDurum] = useState("");
  const [okunuyor, setOkunuyor] = useState(false);
  const web = Platform.OS === "web";

  const gorselOku = async () => {
    const [k] = await dosyaSec("image/*,.pdf,.tif,.tiff", false);
    if (!k) return;
    setOkunuyor(true); setDurum(t("Görsel okunuyor…")); setAdaylar(null);
    try {
      const { evrakMetniOku } = await import("./foyEvrak");
      const r = await evrakMetniOku(k, m => setDurum(t(m)));
      if ("hata" in r) { setDurum(t(r.hata)); return; }
      if (!r.metin.trim()) { setDurum(t("Görsel okunamadı{n}. İnternet bağlantısını kontrol edin ya da numarayı elle yazın.", { n: r.okunamadi ? ": " + t(r.okunamadi) : "" })); return; }
      const xs = isEmriAdaylari(r.metin);
      setGorsel(k.ad); setAdaylar(xs);
      if (xs.length) { setNo(xs[0].no); setKaynak("gorsel"); setDurum(t("Görselde bulunan numara yazıldı. Doğru olduğunu kontrol edin; değilse aşağıdakilerden seçin ya da düzeltin.")); }
      else setDurum(t("Görselde numara bulunamadı. Numarayı elle yazın."));
    } catch (e) { setDurum(t(String((e as Error).message || e))); }
    finally { setOkunuyor(false); }
  };

  return (
    <View style={{ gap: 8, padding: 10, borderWidth: 1, borderColor: C.brassDim, borderRadius: 10, backgroundColor: C.panel2 }}>
      <Text style={[s.body, { color: C.text }]}>{t("İşi kapat: {is}", { is: g.metin })}</Text>
      <Text style={s.hint}>{t("Numara yazmak zorunlu değil. İsterseniz iş emri / evrak numarasını yazın ya da UYAP gönderim ekranının, makbuzun veya tebligat barkodunun fotoğrafını seçin; numara fotoğraftan okunup kutuya yazılır.")}</Text>
      <View style={s.addRow}>
        <TextInput value={no} onChangeText={v => { setNo(v); setKaynak(gorsel && adaylar?.some(x => x.no === v) ? "gorsel" : "elle"); }} placeholder={t("İş emri / evrak no (isteğe bağlı)")} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1, minWidth: 180 }]} autoCapitalize="characters" />
        {web && <Btn kind="ghost" label={okunuyor ? t("Okunuyor…") : t("📷 Numarayı fotoğraftan al")} disabled={okunuyor} onPress={gorselOku} />}
      </View>
      {!!durum && <Text style={s.hint}>{durum}</Text>}
      {!!adaylar && adaylar.length > 1 && (
        <View style={s.row}>
          {adaylar.map(x => (
            <Pressable key={x.no} onPress={() => { setNo(x.no); setKaynak("gorsel"); }} style={{ borderWidth: 1, borderColor: no === x.no ? C.brass : C.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={[s.hint, { color: no === x.no ? C.text : C.textSoft }]}>{x.no}{x.etiket ? ` (${x.etiket.toLocaleLowerCase("tr")})` : ""}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={s.row}>
        <Btn label={t("✓ Yapıldı, kapat")} onPress={() => onKapat({ tarih: bugunStr(), no: no.trim(), kaynak: no.trim() ? kaynak : "elle", gorsel: no.trim() && kaynak === "gorsel" ? gorsel : undefined })} />
        {onSil && <Btn kind="ghost" label={t("🗑 Listeden kaldır")} onPress={onSil} />}
        <Btn kind="ghost" label={t("Vazgeç")} onPress={onVazgec} />
      </View>
    </View>
  );
}
