// Föyden müvekkile WhatsApp ya da Telegram mesajı: duruşma hatırlatması, dosyanın durumu, evrak/bilgi isteği.
// Mesaj cihazda hazır kalıptan yazılır (yapay zekâ yok), avukat düzenler; gönderme avukatın kendi WhatsApp/Telegram'ından olur.
import React, { useMemo, useState } from "react";
import { Linking, Platform, Pressable, Share, Text, TextInput, View } from "react-native";
import { Foy, tarihYaz } from "../data/foy";
import { t } from "../i18n";
import { s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";

type Kalip = "durusma" | "durum" | "evrak" | "serbest";

/** 0532…, +90 532…, 532… → 90532… (WhatsApp bağlantısı için). */
export function telefonNormal(x?: string): string | null {
  let d = (x || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = "90" + d.slice(1);
  if (d.length === 10 && d.startsWith("5")) d = "90" + d;
  return d.length >= 11 && d.length <= 15 ? d : null;
}

function metinYaz(f: Foy, k: Kalip): string {
  const ad = (f.muvekkil || "").trim();
  const hitap = ad ? t("Sayın {ad},", { ad }) : t("Merhaba,");
  const dosya = [f.mahkeme, f.esasNo ? f.esasNo + " " + t("esas sayılı") : ""].filter(Boolean).join(" ") || t("dosyanız");
  if (k === "durusma") {
    if (!f.durusma) return hitap + " " + t("{d} dosyanızın duruşma günü henüz belli değil; belli olunca bilgi vereceğim.", { d: dosya });
    const [g, saat] = tarihYaz(f.durusma).split(" ");
    return hitap + " " + t("{d} dosyanızın duruşması {g} tarihinde yapılacaktır{s}. Katılmanız gerekirse ayrıca haber vereceğim. Sorunuz olursa yazabilirsiniz.", { d: dosya, g, s: saat ? " " + t("(saat {s})", { s: saat }) : "" });
  }
  if (k === "durum") {
    const ozet = f.degerlendirme?.ozet?.trim();
    return hitap + " " + t("{d} dosyanızla ilgili kısa bilgi:", { d: dosya }) + " " + (ozet || t("[dosyanın son durumunu buraya yazın]")) + " " + t("Ayrıntıları görüşmek isterseniz arayabilirsiniz.");
  }
  if (k === "evrak") {
    const isler = f.gorevler.filter(g => !g.bitti).map(g => "- " + g.metin).slice(0, 6).join("\n");
    return hitap + " " + t("{d} dosyanız için sizden şu belge ve bilgilere ihtiyacımız var:", { d: dosya }) + "\n" + (isler || "- " + t("[istenen belgeyi yazın]")) + "\n" + t("Fotoğrafını bu mesaja yanıt olarak gönderebilirsiniz.");
  }
  return hitap + " ";
}

export function MuvekkilMesaj({ f, ic }: { f: Foy; ic?: boolean }) {
  const [kalip, setKalip] = useState<Kalip>("durusma");
  const varsayilan = useMemo(() => metinYaz(f, kalip), [f.id, kalip, f.durusma, f.mahkeme, f.esasNo, f.muvekkil, f.degerlendirme?.tarih]);
  const [metin, setMetin] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState("");
  const yazi = metin ?? varsayilan;
  const tel = telefonNormal(f.muvekkilBilgi?.telefon);
  const ac = (url: string) => { if (Platform.OS === "web") window.open(url, "_blank", "noopener"); else Linking.openURL(url).catch(() => setBilgi(t("Uygulama açılamadı."))); };
  const kopyala = async () => {
    try {
      if (Platform.OS === "web" && navigator.clipboard) { await navigator.clipboard.writeText(yazi); setBilgi(t("Mesaj kopyalandı.")); }
      else await Share.share({ message: yazi });
    } catch { setBilgi(t("Kopyalanamadı; metni seçip kopyalayın.")); }
  };
  const kaliplar: { k: Kalip; ad: string }[] = [
    { k: "durusma", ad: t("Duruşma hatırlatması") }, { k: "durum", ad: t("Dosyanın durumu") }, { k: "evrak", ad: t("Belge / bilgi isteği") }, { k: "serbest", ad: t("Boş mesaj") }
  ];
  return (
    <View style={ic ? { gap: 10 } : s.card}>
      {!ic && <Text style={s.cardT}>{t("Müvekkile mesaj")}</Text>}
      <View style={s.chips}>
        {kaliplar.map(x => (
          <Pressable key={x.k} onPress={() => { setKalip(x.k); setMetin(null); setBilgi(""); }} style={[s.chip, kalip === x.k && s.chipOn]}>
            <Text style={[s.chipT, kalip === x.k && s.chipTOn]}>{x.ad}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput value={yazi} onChangeText={setMetin} multiline style={[s.input, { minHeight: 110 }]} />
      <View style={s.row}>
        <Btn label={t("WhatsApp'ta aç")} disabled={!yazi.trim()} onPress={() => ac((tel ? `https://wa.me/${tel}` : "https://wa.me/") + "?text=" + encodeURIComponent(yazi))} />
        <Btn kind="secondary" label={t("Telegram'da aç")} disabled={!yazi.trim()} onPress={() => ac("https://t.me/share/url?url=" + encodeURIComponent(" ") + "&text=" + encodeURIComponent(yazi))} />
        <Btn kind="ghost" label={Platform.OS === "web" ? t("Kopyala") : t("Paylaş")} onPress={kopyala} />
      </View>
      <Text style={s.hint}>{tel ? t("WhatsApp müvekkilin numarasıyla ({n}) açılır; mesajı orada kontrol edip siz gönderirsiniz.", { n: "+" + tel }) : t("Müvekkilin telefonunu “Müvekkil bilgileri”ne yazarsanız WhatsApp doğrudan onun sohbetiyle açılır; Telegram'da kişiyi siz seçersiniz.")} {t("Mesaj WhatsApp ya da Telegram üzerinden gider; müvekkil sırrı içeren ayrıntıları sınırlı tutun.")}</Text>
      {!!bilgi && <Text style={[s.hint, { color: C.good }]}>{bilgi}</Text>}
    </View>
  );
}
