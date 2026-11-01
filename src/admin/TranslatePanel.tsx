// Yönetim paneli · Çeviriler: tahkim dosyalarını yapay zekâyla İngilizce, İspanyolca, Fransızca ve Almancaya çevirir.
// Yalnız metinler çevrilir, yapı aynı kalır; çeviri sunucuda saklanır ve o dili seçen oyunculara otomatik açılır.
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { CaseFile } from "../engine/types";
import { Chip } from "../ui/kit";
import { C, F } from "../ui/theme";
import { Section, Seg, SmallBtn } from "./form";
import { LANG_NAMES, listTranslations, saveTranslation, textLeaves, translateCase } from "./translate";

export function TranslatePanel({ cases, onClose }: { cases: CaseFile[]; onClose: () => void }) {
  const [lang, setLang] = useState<"en" | "es" | "fr" | "de">("en");
  const [have, setHave] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const stop = useRef(false);
  const list = cases.filter(c => c.room === "tahkim");
  const reload = () => listTranslations().then(setHave);
  useEffect(() => { reload(); }, []);

  const one = async (c: CaseFile) => {
    setBusy(b => ({ ...b, [c.id]: "Çevriliyor…" }));
    try {
      const tr = await translateCase(c, lang, (d, t) => setBusy(b => ({ ...b, [c.id]: `Çevriliyor… ${Math.round((d / t) * 100)}%` })));
      await saveTranslation(c.id, lang, tr);
      setHave(h => new Set(h).add(`${lang}/${c.id}`));
      setBusy(b => { const n = { ...b }; delete n[c.id]; return n; });
    } catch (e) { setBusy(b => ({ ...b, [c.id]: "Hata: " + (e as Error).message })); }
  };
  const all = async () => {
    stop.current = false; setRunning(true);
    for (const c of list.filter(x => !have.has(`${lang}/${x.id}`))) { if (stop.current) break; await one(c); }
    setRunning(false);
  };
  const missing = list.filter(c => !have.has(`${lang}/${c.id}`));
  const chars = missing.reduce((n, c) => n + textLeaves(c).reduce((m, l) => m + l[1].length, 0), 0);

  return (
    <Section title="Çeviriler" hint="Tahkim dosyalarını seçili dile çevirir. Yalnız metinler çevrilir; oyun yapısı aynı kalır. Çeviri sunucuda saklanır ve o dili seçen oyunculara kendiliğinden açılır."
      right={<SmallBtn label="Kapat" onPress={onClose} />}>
      <Seg label="Dil" value={lang} onChange={setLang} options={Object.entries(LANG_NAMES).map(([v, l]) => ({ v: v as any, label: l }))} />
      <Text style={st.meta}>{list.length - missing.length}/{list.length} dosya {LANG_NAMES[lang]} çevirili · eksik metin ≈ {Math.round(chars / 1000)} bin karakter</Text>
      <View style={st.row}>
        {running ? <><ActivityIndicator color={C.brass} /><SmallBtn label="Durdur" tone="danger" onPress={() => { stop.current = true; }} /></>
          : <SmallBtn label={`Eksik ${missing.length} dosyayı çevir`} tone="accent" disabled={!missing.length} onPress={all} />}
      </View>
      <Text style={st.note}>Her dosya yaklaşık 1–2 dakika sürer ve Anthropic hesabınızdan kullanım düşer. Ekran açık kalmalı; yarıda kalırsa kaldığı yerden devam eder.</Text>
      {list.map(c => (
        <View key={c.id} style={st.item}>
          <Text style={st.name} numberOfLines={1}>{c.title}</Text>
          {busy[c.id] ? <Text style={[st.meta, /^Hata/.test(busy[c.id]) && { color: C.bad }]}>{busy[c.id]}</Text>
            : have.has(`${lang}/${c.id}`) ? <Chip label="ÇEVRİLDİ" color={C.good} /> : <Chip label="YOK" color={C.muted} />}
          <SmallBtn label={have.has(`${lang}/${c.id}`) ? "Yeniden çevir" : "Çevir"} disabled={running || !!busy[c.id] && !/^Hata/.test(busy[c.id])} onPress={() => one(c)} />
        </View>
      ))}
    </Section>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  item: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 8 },
  name: { fontFamily: F.bodyMed, fontSize: 15, color: C.text, flex: 1, minWidth: 180 },
  meta: { fontFamily: F.body, fontSize: 13, color: C.muted },
  note: { fontFamily: F.body, fontSize: 13, color: C.muted, fontStyle: "italic" }
});
