// Yönetim paneli · Çeviriler: bütün dosyaları yapay zekâyla İngilizce, İspanyolca, Fransızca ve Almancaya çevirir.
// Yalnız metinler çevrilir, yapı aynı kalır; çeviri sunucuda saklanır ve o dili seçen oyunculara otomatik açılır.
// Toplu çeviride birkaç dosya aynı anda çevrilir; durdurulursa ya da sayfa kapanırsa kaldığı yerden (eksiklerden) devam eder.
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { CaseFile } from "../engine/types";
import { Chip } from "../ui/kit";
import { C, F } from "../ui/theme";
import { Section, Seg, SmallBtn } from "./form";
import { LANG_NAMES, listTranslations, saveTranslation, textLeaves, translateCase } from "./translate";

type L = "en" | "es" | "fr" | "de";
const LANGS = Object.keys(LANG_NAMES) as L[];
type Model = "hizli" | "derin";
// Yaklaşık maliyet ($ / milyon token): giriş, çıkış. Türkçe metinde 1 token ≈ 3 karakter; çeviri çıktısı benzer uzunlukta.
const PRICE: Record<Model, [number, number]> = { hizli: [0.1, 0.5], derin: [2, 10] };
const POOL = 3;

export function TranslatePanel({ cases, onClose }: { cases: CaseFile[]; onClose: () => void }) {
  const [lang, setLang] = useState<L | "hepsi">("hepsi");
  const [model, setModel] = useState<Model>("hizli");
  const [have, setHave] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [only, setOnly] = useState<"hepsi" | "tahkim">("hepsi");
  const stop = useRef(false);
  const list = only === "tahkim" ? cases.filter(c => c.room === "tahkim") : cases;
  const reload = () => listTranslations().then(setHave);
  useEffect(() => { reload(); }, []);

  const langs = lang === "hepsi" ? LANGS : [lang];
  const jobs = langs.flatMap(l => list.filter(c => !have.has(`${l}/${c.id}`)).map(c => ({ c, l })));
  const chars = jobs.reduce((n, j) => n + textLeaves(j.c).reduce((m, x) => m + x[1].length, 0), 0);
  const tokens = chars / 3;
  const cost = (tokens * 1.3 * PRICE[model][0] + tokens * 1.2 * PRICE[model][1]) / 1e6;

  const one = async (c: CaseFile, l: L) => {
    const k = `${l}/${c.id}`;
    setBusy(b => ({ ...b, [k]: "başladı" }));
    try {
      const tr = await translateCase(c, l, (d, t) => setBusy(b => ({ ...b, [k]: `${Math.round((d / t) * 100)}%` })), model);
      await saveTranslation(c.id, l, tr);
      setHave(h => new Set(h).add(k));
      setErrors(e => { const n = { ...e }; delete n[k]; return n; });
    } catch (e) {
      setErrors(er => ({ ...er, [k]: (e as Error).message }));
    } finally {
      setBusy(b => { const n = { ...b }; delete n[k]; return n; });
      setDone(n => n + 1);
    }
  };
  const all = async () => {
    stop.current = false; setRunning(true); setDone(0);
    const queue = [...jobs];
    const worker = async () => { while (queue.length && !stop.current) { const j = queue.shift()!; await one(j.c, j.l); } };
    await Promise.all(Array.from({ length: POOL }, worker));
    setRunning(false);
    reload();
  };

  const total = list.length;
  const errList = Object.entries(errors);
  return (
    <Section title="Çeviriler" hint="Dosyaları seçili dile çevirir. Yalnız metinler çevrilir; oyun yapısı aynı kalır. Çeviri sunucuda saklanır ve o dili seçen oyunculara kendiliğinden açılır (listelerde başlık ve özet, duruşmada bütün metinler)."
      right={<SmallBtn label="Kapat" onPress={onClose} />}>
      <Seg label="Dil" value={lang} onChange={setLang} options={[{ v: "hepsi" as const, label: "Dört dil" }, ...LANGS.map(v => ({ v, label: LANG_NAMES[v] }))]} />
      <Seg label="Dosyalar" value={only} onChange={setOnly} options={[{ v: "hepsi", label: `Bütün dosyalar (${cases.length})` }, { v: "tahkim", label: "Yalnız tahkim" }]} />
      <Seg label="Model" value={model} onChange={setModel} options={[{ v: "hizli", label: "Hızlı ve ucuz (Haiku)" }, { v: "derin", label: "En kaliteli (Sonnet)" }]} />
      {LANGS.map(l => <Text key={l} style={st.meta}>{LANG_NAMES[l]}: {list.filter(c => have.has(`${l}/${c.id}`)).length}/{total} dosya çevrili</Text>)}
      <Text style={st.est}>Eksik: {jobs.length} çeviri · ≈ {Math.round(chars / 1000).toLocaleString("tr-TR")} bin karakter · tahmini maliyet ≈ {cost < 1 ? cost.toFixed(2) : Math.round(cost)} $</Text>
      <View style={st.row}>
        {running ? <>
          <ActivityIndicator color={C.brass} />
          <Text style={st.meta}>{done}/{jobs.length + done} tamamlandı</Text>
          <SmallBtn label="Durdur" tone="danger" onPress={() => { stop.current = true; }} />
        </> : <SmallBtn label={`Eksik ${jobs.length} çeviriyi başlat`} tone="accent" disabled={!jobs.length} onPress={all} />}
      </View>
      <Text style={st.note}>Aynı anda {POOL} dosya çevrilir; hızlı modelde bir dosya ~20–40 saniye, kaliteli modelde 1–2 dakika sürer. Ücret Anthropic hesabınızdan düşer. Ekran açık kalmalı; durdurursanız ya da sayfa kapanırsa "başlat"a yeniden basınca eksiklerden devam eder.</Text>
      {Object.entries(busy).map(([k, v]) => {
        const [l, id] = k.split("/");
        const c = cases.find(x => x.id === id);
        return (
          <View key={k} style={st.item}>
            <Text style={st.name} numberOfLines={1}>{c?.title || id}</Text>
            <Chip label={`${l.toUpperCase()} · ${v}`} color={C.brass} />
          </View>
        );
      })}
      {errList.length > 0 && <Text style={[st.meta, { color: C.bad }]}>{errList.length} çeviri hata verdi; "başlat"a yeniden basınca tekrar denenir.</Text>}
      {errList.slice(0, 8).map(([k, v]) => (
        <View key={k} style={st.item}>
          <Text style={st.name} numberOfLines={1}>{cases.find(x => x.id === k.split("/")[1])?.title || k}</Text>
          <Text style={[st.meta, { color: C.bad }]} numberOfLines={2}>{k.split("/")[0].toUpperCase()} · {v}</Text>
        </View>
      ))}
    </Section>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  item: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 8 },
  name: { fontFamily: F.bodyMed, fontSize: 15, color: C.text, flex: 1, minWidth: 180 },
  meta: { fontFamily: F.body, fontSize: 13, color: C.muted },
  est: { fontFamily: F.bodyBold, fontSize: 14, color: C.text },
  note: { fontFamily: F.body, fontSize: 13, color: C.muted, fontStyle: "italic" }
});
