// İcra föyünde "📄 İcra örnekleri (İİK Yönetmeliği)": takip yoluna göre Örnek 1 (takip talebi) ve borçluya gidecek emrin
// örneği (Örnek 5, 7, 10, 13…) dosyanın bilgileriyle doldurulur; önizlenir, kopyalanır, Word ya da UDF olarak indirilir.
// Bütün örnekler (1–14, 44 ve takip sonrası olanlar) listeden seçilebilir.
import React, { useState } from "react";
import { Text, View } from "react-native";
import { docxOlustur, udfOlustur } from "../data/beyan";
import { Foy } from "../data/foy";
import { IcraBilgi } from "../data/icra";
import { emirOrnegi, ICRA_ORNEKLERI, ORNEK_TUR_AD, ornek, ornekMetni } from "../data/icraOrnekleri";
import { t } from "../i18n";
import { Acilir } from "./Acilir";
import { indir, s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";

export function IcraOrnekleri({ f, b, vekil }: { f: Foy; b: IcraBilgi; vekil?: string }) {
  const emir = emirOrnegi(b);
  // Seçilmedikçe takip yoluna göre emir örneği gösterilir (takip yolu sonradan değişse de izler).
  const [sec, setSec] = useState<string | null>(null);
  const [goster, setGoster] = useState(false);
  const [bilgi, setBilgi] = useState("");
  const o = (sec && ornek(sec)) || ornek(emir)!;
  const metin = () => ornekMetni(o.no, f, b, { vekil });
  const ad = (uz: string) => `ornek-${o.no}-${(f.esasNo || f.id).replace(/[^\w-]+/g, "-")}.${uz}`;
  const bos = o.tur === "takip_sonrasi";
  const sure = [o.odeme ? t("ödeme {n} gün", { n: o.odeme }) : "", o.itiraz ? t("itiraz {n} gün", { n: o.itiraz }) : "", o.malBeyani ? t("mal beyanı {n} gün", { n: o.malBeyani }) : "", o.tahliye ? t("teslim / tahliye {n} gün", { n: o.tahliye }) : ""].filter(Boolean).join(" · ");
  return (
    <View style={{ gap: 6, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 10 }}>
      <Text style={[s.body, { color: C.text, fontWeight: "700" }]}>{t("📄 İcra örnekleri (İİK Yönetmeliği)")}</Text>
      <Text style={s.hint}>{t("Bu takipte: takip talebi Örnek 1, borçluya gidecek emir Örnek {e}. Seçtiğiniz örnek dosyanın bilgileriyle doldurulur; emri icra dairesi UYAP'ta düzenler, buradaki metin kontrol ve müvekkile bilgi içindir.", { e: emir })}</Text>
      <Acilir etiket={t("Örnek")} secili={o.no} genislik={420} onSec={k => { setSec(k); setGoster(false); setBilgi(""); }}
        secenekler={ICRA_ORNEKLERI.map(x => ({ k: x.no, ad: `Örnek ${x.no} – ${t(x.ad)}${x.no === emir || x.no === "1" ? " ★" : ""} (${t(ORNEK_TUR_AD[x.tur])})` }))} />
      <Text style={s.hint}>{o.madde} · {o.kanun}{sure ? " · " + sure : ""}</Text>
      {bos ? (
        <Text style={s.hint}>{t("Bu örnek takip açıldıktan sonra icra dairesince düzenlenir (ör. haciz ihbarnamesini talep üzerine daire gönderir); Celse yalnız yerini ve dayanağını gösterir.")}</Text>
      ) : (
        <View style={[s.row, { gap: 8, flexWrap: "wrap" }]}>
          <Btn kind="secondary" label={goster ? t("Önizlemeyi gizle") : t("Önizle")} onPress={() => setGoster(!goster)} />
          <Btn kind="secondary" label={t("⬇ Word (.docx)")} onPress={() => { indir(ad("docx"), new Blob([docxOlustur(metin(), 0, true) as BlobPart], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })); setBilgi(t("Word dosyası indirildi.")); }} />
          <Btn kind="ghost" label={t("⬇ UDF")} onPress={() => { indir(ad("udf"), new Blob([udfOlustur(metin(), 0, true) as BlobPart], { type: "application/octet-stream" })); setBilgi(t("UDF dosyası indirildi.")); }} />
          <Btn kind="ghost" label={t("Kopyala")} onPress={async () => { try { await (globalThis.navigator as Navigator | undefined)?.clipboard?.writeText(metin()); setBilgi(t("Metin kopyalandı.")); } catch { setGoster(true); } }} />
        </View>
      )}
      {goster && !bos && <Text selectable style={[s.body, { fontFamily: "monospace", fontSize: 12, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 8 }]}>{metin()}</Text>}
      {!!bilgi && <Text style={[s.hint, { color: C.good }]}>{bilgi}</Text>}
    </View>
  );
}
