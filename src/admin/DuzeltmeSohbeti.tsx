// Yönetim paneli · Düzeltme sohbeti: yönetici ekran görüntüsü ve kısa bir düzeltme isteği gönderir; yapay zekâ
//  1) hangi dava dosyası olduğunu bulur ve sorunun dosya içeriğinde mi (metin, şık, açıklama, puan, karar) yoksa kodda mı
//     (kanun yolu aşamaları, yüz/sahne, ses, ekran düzeni) olduğunu ayırır;
//  2) dosya içeriğindeyse düzeltmeyi işlem listesi olarak önerir; yönetici görür, "Uygula ve yayınla" der;
//  3) koddaysa geliştiriciye iletilecek notu yazar (kopyalanır).
// Uygulanan her düzeltme önce oyun motorunun denetiminden geçer (applyIssues → engineCheck).
import React, { useRef, useState } from "react";
import { Image, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { CaseFile } from "../engine/types";
import { C, F } from "../ui/theme";
import { askAdmin, applyIssues, engineCheck, extractJson, flatten, Issue, Op } from "./ai";
import { Section, SmallBtn } from "./form";
import { store } from "./store";
import { PanelEntry } from "./AiPanels";

type Gorsel = { tur: string; veri: string; onizleme: string };
type Oneri = { c: CaseFile; ozet: string; islemler: Op[]; next?: CaseFile; problems: string[]; durum: "bekliyor" | "yayinda" | "taslak" | "vazgecildi" };
type Mesaj =
  | { kim: "ben"; metin: string; gorseller: Gorsel[] }
  | { kim: "yz"; metin: string; oneri?: Oneri; not?: string };

/** Ekran görüntüsünü küçültür (en uzun kenar 1600 px, JPEG): hem hızlı gider hem modelin sınırını aşmaz. */
function gorselHazirla(f: File): Promise<Gorsel> {
  return new Promise((ok, hata) => {
    const img = new window.Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
      const d = cv.toDataURL("image/jpeg", 0.85);
      URL.revokeObjectURL(url);
      ok({ tur: "image/jpeg", veri: d.split(",")[1], onizleme: d });
    };
    img.onerror = () => { URL.revokeObjectURL(url); hata(new Error("Görsel okunamadı.")); };
    img.src = url;
  });
}

const BUL_SISTEM = [
  "Sen Celse adlı avukatlık eğitim oyununun baş editörüsün. Yönetici sana oyundan bir ekran görüntüsü ve kısa bir düzeltme isteği gönderiyor.",
  "Görevin: (1) Ekrandaki dava dosyasını aşağıdaki listeden bul. Ekranın üstünde dosyanın başlığı (kısaltılmış olabilir, ör. 'Trabzo…') ve esas numarası (ör. 2027/4297) görünür; konuşmacı adları, mahkeme ve metin de ipucudur.",
  "(2) Sorunun nerede olduğunu ayır:",
  "- 'dosya': dava dosyasının kendi içeriği: konuşmalar, sorular, şıklar, açıklamalar (note), puanlar, kanun maddeleri, kişi adları, tarihler, karar metinleri, müvekkil görüşmesi soruları.",
  "- 'kod': oyunun kodunun ürettiği şeyler: istinaf / temyiz / cevap dilekçesi / itiraz aşamaları (süre hesabı, merci, sebep, talep, dilekçe önizlemesi, dairenin kararı; bunlar her dava için otomatik üretilir), kişilerin yüzleri ve fotoğrafları, sahne düzeni, seslendirme, ekran düzeni, düğmeler, krediler, ödeme, yönetim paneli.",
  "- 'soru': hangi dosya olduğu ya da ne istendiği gerçekten anlaşılmıyorsa.",
  "Yanıtın YALNIZCA şu JSON olsun:",
  '{"tur": "dosya|kod|soru", "id": "dosyanın kimliği (dosya ya da kod için, biliniyorsa)", "neden": "bir cümle", "soru": "tur soru ise yöneticiye sorulacak kısa soru", "gelistirici": "tur kod ise geliştiriciye iletilecek, sorunu ve beklenen davranışı anlatan kısa not"}'
].join("\n");

const DUZELT_SISTEM = [
  "Sen Türk hukukunda uzman, titiz bir hâkim ve Celse avukatlık eğitim oyununun baş editörüsün. Yöneticinin düzeltme isteğini (ve varsa ekran görüntüsünü) dava dosyasına uygulayacaksın.",
  "Dosya sana 'alan.yolu = değer' satırları hâlinde verilir. Yollar sıfırdan sayar (steps.0 birinci adımdır).",
  "Kurallar:",
  "- Yalnız istenen düzeltmeyi ve onun zorunlu kıldığı tutarlılık değişikliklerini yap; başka bir şeyi değiştirme.",
  "- islem: 'degistir' (alanın yeni TAM değeri; metnin bir kelimesi değişse bile bütün metni yaz), 'ekle' (diziye öğe ekler; yol eklenecek konumu gösterir), 'sil'.",
  "- Var olan bayrak (set) ve koşul (if) adlarını değiştirme. Doğru şık yanlışlardan belirgin uzun olmasın.",
  "- Hukuki içerik Kasım 2026 mevzuatına uygun olsun; emin değilsen 'ozet'te belirt.",
  "- Görüşme (interview) adımında koşulsuz soru sayısı, sorulabilecek soru sayısından (limit) en az bir fazla olmalı.",
  "Yanıtın YALNIZCA şu JSON olsun:",
  '{"ozet": "yaptığın değişikliğin bir-iki cümlelik açıklaması", "islemler": [{"islem": "degistir", "yol": "steps.2.choices.1.text", "deger": "..."}]}'
].join("\n");

export function DuzeltmeSohbeti({ entries, onSaved, onClose }: { entries: PanelEntry[]; onSaved: () => void; onClose: () => void }) {
  const [mesajlar, setMesajlar] = useState<Mesaj[]>([]);
  const [metin, setMetin] = useState("");
  const [gorseller, setGorseller] = useState<Gorsel[]>([]);
  const [mesgul, setMesgul] = useState("");
  const kaydir = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const ekle = (m: Mesaj) => setMesajlar(x => [...x, m]);
  const oneriGuncelle = (i: number, ek: Partial<Oneri>) => setMesajlar(x => x.map((m, k) => (k === i && m.kim === "yz" && m.oneri ? { ...m, oneri: { ...m.oneri, ...ek } } : m)));

  const gorselSec = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*"; input.multiple = true;
    input.onchange = async () => {
      const fs = Array.from(input.files || []).slice(0, 4 - gorseller.length);
      const hazir = await Promise.all(fs.map(f => gorselHazirla(f).catch(() => null)));
      setGorseller(g => [...g, ...hazir.filter((x): x is Gorsel => !!x)].slice(0, 4));
    };
    input.click();
  };

  const gonder = async () => {
    const istek = metin.trim();
    if (!istek && !gorseller.length) return;
    const gs = gorseller;
    ekle({ kim: "ben", metin: istek, gorseller: gs });
    setMetin(""); setGorseller([]);
    // Önceki konuşma (yalnız metin) bağlam olarak gider; ekran görüntüleri yalnız bu mesajınkiler.
    const gecmis = mesajlar.slice(-8).map(m => (m.kim === "ben" ? "Yönetici: " + m.metin : "Editör: " + m.metin)).join("\n");
    try {
      setMesgul("Dosya ve sorunun yeri bulunuyor…");
      const liste = entries.map(e => `${e.c.id} | ${e.c.title} | ${e.c.esas || ""} | ${e.c.court} | ${Object.values(e.c.cast || {}).map(k => k.name).filter(Boolean).slice(0, 4).join(", ")}`).join("\n");
      const r1 = await askAdmin(BUL_SISTEM, [gecmis && "Önceki konuşma:\n" + gecmis, "Düzeltme isteği: " + (istek || "(yalnız ekran görüntüsü)"), "Dava dosyaları (kimlik | başlık | esas | mahkeme | kişiler):\n" + liste].filter(Boolean).join("\n\n"),
        { model: "derin", azami: 1500, gorseller: gs.map(g => ({ tur: g.tur, veri: g.veri })) });
      const j = extractJson<{ tur?: string; id?: string; neden?: string; soru?: string; gelistirici?: string }>(r1.text);
      const e = entries.find(x => x.c.id === j.id);
      if (j.tur === "soru" || (j.tur === "dosya" && !e)) { ekle({ kim: "yz", metin: j.soru || "Hangi dava dosyası olduğunu bulamadım. Dosyanın adını ya da esas numarasını yazar mısınız?" }); return; }
      if (j.tur === "kod") {
        const not = [`Celse · kod düzeltmesi${e ? ` · dosya: ${e.c.title} (${e.c.id})` : ""}`, `İstek: ${istek}`, `Sorun: ${j.gelistirici || j.neden || ""}`].join("\n");
        ekle({ kim: "yz", metin: `Bu düzeltme dava dosyasında değil, oyunun kodunda (${j.neden || "otomatik üretilen bölüm"}). Yönetim panelinden değiştirilemez; aşağıdaki notu Claude'a iletin.`, not });
        return;
      }
      setMesgul(`“${e!.c.title}” dosyasında düzeltme hazırlanıyor…`);
      const motor = engineCheck(e!.c);
      const r2 = await askAdmin(DUZELT_SISTEM, [
        `Dosya: ${e!.c.title} (${e!.c.id}) · ${e!.c.court} · ${e!.c.mode === "duel" ? "karşılıklı (p1, p2)" : "tek kişilik (oyuncu p1)"}`,
        gecmis && "Önceki konuşma:\n" + gecmis,
        "Yöneticinin düzeltme isteği: " + (istek || "(ekran görüntüsündeki sorunu düzelt)"),
        motor.length ? "Motor denetimi:\n" + motor.map(m => "- " + m).join("\n") : "",
        "Alanlar:\n" + flatten(e!.c)
      ].filter(Boolean).join("\n\n"), { model: "derin", azami: 8000, gorseller: gs.map(g => ({ tur: g.tur, veri: g.veri })) });
      const k = extractJson<{ ozet?: string; islemler?: Op[] }>(r2.text);
      const islemler = Array.isArray(k.islemler) ? k.islemler : [];
      if (!islemler.length) { ekle({ kim: "yz", metin: k.ozet || "Dosyada değiştirilecek bir şey bulamadım. Biraz daha ayrıntı yazar mısınız?" }); return; }
      let next: CaseFile | undefined, problems: string[] = [];
      try {
        const issue: Issue = { onem: "orta", tur: "dil", yer: "", sorun: istek, oneri: k.ozet || "", islemler } as Issue;
        const r = applyIssues(e!.c, [issue]); next = r.next; problems = r.problems;
      } catch (err) { problems = ["Düzeltme dosyaya uygulanamadı: " + String((err as Error).message || err)]; }
      ekle({ kim: "yz", metin: k.ozet || "Düzeltme hazır.", oneri: { c: e!.c, ozet: k.ozet || "", islemler, next, problems, durum: "bekliyor" } });
    } catch (err) {
      ekle({ kim: "yz", metin: "Bir sorun oldu: " + String((err as Error).message || err) });
    } finally {
      setMesgul("");
      setTimeout(() => kaydir.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const kaydet = async (i: number, o: Oneri, durum: "yayinda" | "taslak") => {
    if (!o.next) return;
    try { await store.save(o.next, durum, "sohbet"); oneriGuncelle(i, { durum }); onSaved(); }
    catch (err) { ekle({ kim: "yz", metin: "Kaydedilemedi: " + String((err as Error).message || err) }); }
  };
  const eskiDeger = (c: CaseFile, yol: string) => {
    let v: unknown = c;
    for (const p of yol.split(".")) { if (v == null) return undefined; v = (v as Record<string, unknown>)[p]; }
    return v;
  };
  const yaz = (v: unknown) => (v === undefined ? "—" : typeof v === "string" ? v : JSON.stringify(v)).slice(0, 600);

  if (Platform.OS !== "web") return <Section title="Düzeltme sohbeti" right={<SmallBtn label="Kapat" onPress={onClose} />}><Text style={st.meta}>Şimdilik bilgisayarda çalışır.</Text></Section>;

  return (
    <Section title="Düzeltme sohbeti"
      hint="Oyundan ekran görüntüsünü ekleyip neyin yanlış olduğunu yazın (ör. “bu soruda şıklar saçma, doğru cevabı şu yap”). Yapay zekâ dosyayı bulur, düzeltmeyi önerir; siz “Uygula ve yayınla” deyince oyunculara gider. Sorun dosyada değil kodda ise geliştiriciye iletilecek notu hazırlar."
      right={<SmallBtn label="Kapat" onPress={onClose} />}>
      <ScrollView ref={kaydir} style={{ maxHeight: 620 }} contentContainerStyle={{ gap: 10 }}>
        {mesajlar.length === 0 && <Text style={st.meta}>Henüz mesaj yok.</Text>}
        {mesajlar.map((m, i) => m.kim === "ben" ? (
          <View key={i} style={[st.balon, st.ben]}>
            {!!m.metin && <Text style={st.text}>{m.metin}</Text>}
            {m.gorseller.length > 0 && <View style={st.row}>{m.gorseller.map((g, k) => <Image key={k} source={{ uri: g.onizleme }} style={st.kucuk} />)}</View>}
          </View>
        ) : (
          <View key={i} style={[st.balon, st.yz]}>
            <Text style={st.text}>{m.metin}</Text>
            {!!m.not && (
              <View style={st.kutu}>
                <Text style={st.mono}>{m.not}</Text>
                <View style={st.row}><SmallBtn label="Notu kopyala" onPress={() => { try { navigator.clipboard.writeText(m.not!); } catch { /* yok say */ } }} /></View>
              </View>
            )}
            {!!m.oneri && (
              <View style={st.kutu}>
                <Text style={st.bold}>{m.oneri.c.title} · {m.oneri.islemler.length} değişiklik</Text>
                {m.oneri.islemler.slice(0, 12).map((op, k) => (
                  <View key={k} style={{ gap: 2 }}>
                    <Text style={st.mono}>{op.islem || "degistir"} · {op.yol}</Text>
                    {op.islem !== "ekle" && <Text style={[st.meta, { textDecorationLine: "line-through" }]}>{yaz(eskiDeger(m.oneri!.c, op.yol))}</Text>}
                    {op.islem !== "sil" && <Text style={[st.meta, { color: C.good }]}>{yaz(op.deger)}</Text>}
                  </View>
                ))}
                {m.oneri.problems.length > 0 && <Text style={[st.meta, { color: C.bad }]}>Oyun motoru sorun buldu, yayınlanamaz: {m.oneri.problems.slice(0, 3).join(" · ")}</Text>}
                {m.oneri.durum === "bekliyor" ? (
                  <View style={st.row}>
                    <SmallBtn label="Uygula ve yayınla" tone="accent" disabled={!m.oneri.next || m.oneri.problems.length > 0} onPress={() => kaydet(i, m.oneri!, "yayinda")} />
                    <SmallBtn label="Taslak kaydet" disabled={!m.oneri.next} onPress={() => kaydet(i, m.oneri!, "taslak")} />
                    <SmallBtn label="Vazgeç" onPress={() => oneriGuncelle(i, { durum: "vazgecildi" })} />
                  </View>
                ) : <Text style={[st.meta, { color: m.oneri.durum === "vazgecildi" ? C.muted : C.good }]}>{m.oneri.durum === "yayinda" ? "✓ Yayınlandı; oyuncular bir sonraki açılışta görür." : m.oneri.durum === "taslak" ? "✓ Taslak olarak kaydedildi." : "Vazgeçildi."}</Text>}
              </View>
            )}
          </View>
        ))}
        {!!mesgul && <Text style={st.meta}>{mesgul}</Text>}
      </ScrollView>
      {gorseller.length > 0 && (
        <View style={st.row}>
          {gorseller.map((g, k) => <Image key={k} source={{ uri: g.onizleme }} style={st.kucuk} />)}
          <SmallBtn label="Görselleri kaldır" onPress={() => setGorseller([])} />
        </View>
      )}
      <TextInput value={metin} onChangeText={setMetin} multiline placeholder="Ne düzeltilsin? Ekran görüntüsü de ekleyebilirsiniz." placeholderTextColor={C.muted} style={st.input} />
      <View style={st.row}>
        <SmallBtn label={`Ekran görüntüsü ekle${gorseller.length ? ` (${gorseller.length}/4)` : ""}`} disabled={gorseller.length >= 4 || !!mesgul} onPress={gorselSec} />
        <SmallBtn label={mesgul ? "Çalışıyor…" : "Gönder"} tone="accent" disabled={!!mesgul || (!metin.trim() && !gorseller.length)} onPress={gonder} />
      </View>
    </Section>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" },
  balon: { borderRadius: 12, padding: 12, gap: 8, maxWidth: "92%" },
  ben: { alignSelf: "flex-end", backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line },
  yz: { alignSelf: "flex-start", backgroundColor: C.panel, borderWidth: 1, borderColor: C.brassDim },
  kutu: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, gap: 8 },
  text: { color: C.text, fontFamily: F.body, fontSize: 15, lineHeight: 21 },
  bold: { color: C.text, fontFamily: F.bodyBold, fontSize: 14 },
  meta: { color: C.muted, fontFamily: F.body, fontSize: 13, lineHeight: 18 },
  mono: { color: C.brass, fontFamily: F.mono, fontSize: 12 },
  kucuk: { width: 72, height: 120, borderRadius: 6, backgroundColor: "#000" },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, minHeight: 80, color: C.text, fontFamily: F.body, fontSize: 15, backgroundColor: C.panel2, textAlignVertical: "top" }
});
