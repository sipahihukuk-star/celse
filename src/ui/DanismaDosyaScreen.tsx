// "Danışma dosyaları (gerçek olaylar)": "Derdini anlat" kullanıcılarının anonimleştirilmiş olaylarından üretilen tek kişilik dosyalar.
// Oyuncu bir dosyayı açmadan önce, oyun kaydının (seçimleri, cevapları, takma adı) dosya sahibine gösterileceğini kabul eder;
// dosya oyunun duruşma ekranında oynanır, bitince kayıt sahibine gider (App.tsx, danismaDosya.ts). Antrenmandır, kariyere işlemez.
import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { bekleyenDosyalar, BekleyenDosya, dosyaAl } from "../data/danismaDosya";
import type { CaseFile } from "../engine/types";
import { locale, t } from "../i18n";
import { Btn } from "./kit";
import { C, F } from "./theme";

interface Props { signedIn: boolean; onBack: () => void; onSignIn: () => void; onPlay: (c: CaseFile, dosyaId: string) => void }

export default function DanismaDosyaScreen({ signedIn, onBack, onSignIn, onPlay }: Props) {
  const [list, setList] = useState<BekleyenDosya[] | null>(null);
  const [err, setErr] = useState("");
  const [sec, setSec] = useState<BekleyenDosya | null>(null);
  const [kabul, setKabul] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const yukle = () => { setErr(""); bekleyenDosyalar().then(r => { setList(r.list); if (r.error) setErr(t(r.error)); }); };
  useEffect(() => { if (signedIn) yukle(); }, [signedIn]);

  const ac = async () => {
    if (!sec || !kabul) return;
    setBusy(true); setMsg("");
    const r = await dosyaAl(sec.id);
    setBusy(false);
    if (!r.c) { setMsg(t(r.error || "Bu dosya şu an açılamıyor.")); yukle(); return; }
    const id = sec.id;
    setSec(null); setKabul(false);
    onPlay(r.c, id);
  };

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={{ flexDirection: "row" }}><Btn kind="ghost" label={t("‹ Giriş")} onPress={onBack} /></View>
      <Text style={s.eyebrow}>{t("ANTRENMAN · SONUÇLAR KARİYERE İŞLEMEZ")}</Text>
      <Text style={s.title}>{t("Danışma dosyaları (gerçek olaylar)")}</Text>
      <Text style={s.sub}>{t("\"Derdini anlat\" kullanıcılarının anlattığı gerçek olaylar, kişisel bilgilerden arındırılarak dava dosyasına çevrildi. Dosya sahibinin avukatı sizsiniz; karşı tarafı ve hâkimi oyun oynar. Oyun kaydınız dosya sahibine gösterilir.")}</Text>

      {!signedIn ? (
        <View style={s.card}>
          <Text style={s.cardT}>{t("Giriş yapın")}</Text>
          <Text style={s.body}>{t("Danışma dosyalarını yalnız giriş yapmış oyuncular oynayabilir.")}</Text>
          <Btn label={t("Giriş yap")} onPress={onSignIn} />
        </View>
      ) : list === null ? <Text style={s.hint}>{t("Yükleniyor…")}</Text> : (
        <>
          {!!err && <Text style={s.err}>{err}</Text>}
          {!list.length && !err && <Text style={s.body}>{t("Şu an oyuncu bekleyen dosya yok. Biraz sonra yeniden bakın.")}</Text>}
          {list.map(f => (
            <Pressable key={f.id} accessibilityRole="button" onPress={() => { setSec(f); setKabul(false); setMsg(""); }} style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}>
              <Text style={s.meta}>{(f.alan || "").toLocaleUpperCase(locale())}{f.benim ? " · " + t("SİZ OYNUYORSUNUZ") : ""}</Text>
              <Text style={s.cardT}>{f.baslik}</Text>
              <Text style={s.court}>{f.mahkeme}</Text>
              {!!f.ozet && <Text style={s.body}>{f.ozet}</Text>}
              <Text style={s.hint}>{t("Gönderildi: {tarih}", { tarih: new Date(f.created_at).toLocaleString(locale()) })}</Text>
            </Pressable>
          ))}
          <Btn kind="ghost" label={t("Listeyi yenile")} onPress={yukle} />
          {!!msg && !sec && <Text style={s.err}>{msg}</Text>}
        </>
      )}

      <Modal visible={!!sec} transparent animationType="fade" onRequestClose={() => setSec(null)}>
        <View style={s.back}>
          <View style={s.modal} testID="oyuncu-bildirim">
            <Text style={s.eyebrow}>{t("DOSYAYI AÇMADAN ÖNCE")}</Text>
            <Text style={s.cardT}>{sec?.baslik}</Text>
            <View style={s.warn}>
              <Text style={s.warnT}>{t("Bu dosya gerçek bir kullanıcının anonimleştirilmiş olayından üretilmiştir. Oyun kaydınız (seçimleriniz, cevaplarınız ve takma adınız) dosya sahibine gösterilecektir; e-posta ve adınız gösterilmez.")}</Text>
            </View>
            <Text style={s.hint}>{t("Eğitim amaçlı canlandırmadır, hukuki görüş değildir. Yazdığınız cevaplarda kendinize ya da başkasına ait kişisel bilgi yazmayın. Dosyayı yarıda bırakırsanız başka oyunculara yeniden açılır.")}</Text>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: kabul }} onPress={() => setKabul(!kabul)} style={s.check}>
              <View style={[s.box, kabul && s.boxOn]}>{kabul && <Text style={s.tick}>✓</Text>}</View>
              <Text style={s.checkT}>{t("Okudum, kabul ediyorum.")}</Text>
            </Pressable>
            {!!msg && <Text style={s.err}>{msg}</Text>}
            <View style={s.row}>
              <Btn kind="ghost" label={t("Vazgeç")} onPress={() => setSec(null)} />
              <Btn label={busy ? t("Açılıyor…") : t("Dosyayı aç ›")} disabled={!kabul || busy} onPress={ac} style={(!kabul || busy) && { opacity: 0.45 }} />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 720, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 20, gap: 12 },
  eyebrow: { fontFamily: F.mono, fontSize: 12, letterSpacing: 2.5, color: C.muted },
  title: { fontFamily: F.display, fontSize: 30, color: C.brass },
  sub: { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.textSoft },
  card: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 14, gap: 6 },
  cardT: { fontFamily: F.displayMed, fontSize: 20, color: C.text },
  court: { fontFamily: F.bodyMed, fontSize: 14, color: C.brass },
  body: { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.textSoft },
  hint: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: C.muted },
  meta: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: C.brassDim },
  err: { fontFamily: F.bodyMed, fontSize: 14, color: C.bad },
  back: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { width: "100%", maxWidth: 520, backgroundColor: C.panel, borderWidth: 1, borderColor: C.brass, borderRadius: 14, padding: 18, gap: 12 },
  warn: { borderWidth: 1, borderColor: C.mid, borderRadius: 10, padding: 12, backgroundColor: "rgba(208,166,76,0.12)" },
  warnT: { fontFamily: F.bodyBold, fontSize: 15, lineHeight: 22, color: C.text },
  check: { flexDirection: "row", gap: 10, alignItems: "center" },
  box: { width: 22, height: 22, borderRadius: 4, borderWidth: 1, borderColor: C.brassDim, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: C.brass, borderColor: C.brass },
  tick: { fontFamily: F.bodyBold, fontSize: 14, color: C.brassInk },
  checkT: { flex: 1, fontFamily: F.bodyMed, fontSize: 15, color: C.text },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "flex-end" }
});
