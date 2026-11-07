// Yönetim paneli · Görsel denetim: yüz, sahne, yaş ve görüşme kurallarını bütün davalarda cihazda (yapay zekâsız) tarar.
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CaseFile } from "../engine/types";
import { C, F } from "../ui/theme";
import { Section, SmallBtn } from "./form";
import { VisualIssue, visualAudit } from "./visualAudit";

const TUR: Record<VisualIssue["tur"], string> = { yuz: "Yüz", sahne: "Sahne", yas: "Yaş", gorusme: "Görüşme" };

export function VisualAuditPanel({ cases, onOpenCase, onClose }: { cases: CaseFile[]; onOpenCase: (id: string) => void; onClose: () => void }) {
  const [res, setRes] = useState<{ c: CaseFile; issues: VisualIssue[] }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const run = () => {
    setBusy(true);
    // Ekran "taranıyor" yazısını göstersin diye tarama bir sonraki karede başlar.
    setTimeout(() => {
      const out = cases.map(c => { try { return { c, issues: visualAudit(c) }; } catch (e) { return { c, issues: [{ tur: "gorusme" as const, yer: "dosya", sorun: "Denetim çalışmadı: " + (e as Error).message, oneri: "Geliştiriciye bildirin." }] }; } });
      setRes(out.filter(x => x.issues.length));
      setBusy(false);
    }, 30);
  };
  const toplam = res?.reduce((n, x) => n + x.issues.length, 0) ?? 0;
  return (
    <Section title="Görsel denetim"
      hint="Yapay zekâ denetiminin göremediği, ekranda ortaya çıkan hataları arar: oyuncunun yüzü yanlış tarafta mı, büroda karşı vekil görünüyor mu, yaşı yazmayan kişiye yaşlı yüz düşüyor mu, görüşmede tek şıklı soru kalıyor mu. Yapay zekâ kullanmaz, kredi harcamaz; birkaç saniye sürer."
      right={<SmallBtn label="Kapat" onPress={onClose} />}>
      <View style={st.row}>
        <SmallBtn label={busy ? "Taranıyor…" : res ? `Yeniden tara (${cases.length} dava)` : `Bütün davaları tara (${cases.length})`} tone="accent" disabled={busy} onPress={run} />
      </View>
      {res && !busy && (res.length === 0
        ? <Text style={[st.meta, { color: C.good }]}>✓ {cases.length} davada sorun bulunmadı.</Text>
        : <Text style={[st.meta, { color: C.bad }]}>{res.length} davada {toplam} sorun bulundu.</Text>)}
      {res?.map(({ c, issues }) => (
        <View key={c.id} style={st.card}>
          <View style={st.cardHead}>
            <Text style={st.caseTitle}>{c.title} <Text style={st.meta}>({c.id})</Text></Text>
            <SmallBtn label="Dosyayı aç" onPress={() => onOpenCase(c.id)} />
          </View>
          {issues.map((i, k) => (
            <View key={k} style={st.issue}>
              <Text style={st.chip}>{TUR[i.tur]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.text}><Text style={st.bold}>{i.yer}:</Text> {i.sorun}</Text>
                <Text style={st.meta}>{i.oneri}</Text>
              </View>
            </View>
          ))}
        </View>
      ))}
    </Section>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 8 },
  meta: { color: C.muted, fontFamily: F.body, fontSize: 13 },
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, marginTop: 10, gap: 8 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  caseTitle: { color: C.text, fontFamily: F.bodyBold, fontSize: 15, flexShrink: 1 },
  issue: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  chip: { color: C.brass, fontFamily: F.bodyBold, fontSize: 12, borderWidth: 1, borderColor: C.brass, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, overflow: "hidden" },
  text: { color: C.text, fontFamily: F.body, fontSize: 14 },
  bold: { fontFamily: F.bodyBold }
});
