// Yönetim panelinin yapay zekâ bölümleri:
//  - Denetim: dosyaları yapay zekâya inceletir, bulunan hataları listeler; yöneticinin onayladığı düzeltmeler uygulanır,
//    dosya oyun motoruyla yeniden sınanır ve yayınlanır.
//  - Üretim: istenen branş, mahkeme, zorluk ve konuda yeni dosya yazdırır; motorla sınar, taslak olarak kaydeder.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BRANCHES } from "../data/branches";
import { CaseFile } from "../engine/types";
import { Chip } from "../ui/kit";
import { C, F } from "../ui/theme";
import { AiError, applyIssues, auditCase, AuditReport, generateCase, GenResult, Issue, Op } from "./ai";
import { listReports, saveReport } from "./audits";
import { Section, Seg, SmallBtn } from "./form";
import { CourtPreset, PRESETS } from "./presets";
import { store } from "./store";

export interface PanelEntry { c: CaseFile; status: string; builtIn: boolean }

const ONEM: Record<Issue["onem"], { label: string; color: string }> = {
  yuksek: { label: "YÜKSEK", color: "#e0614c" }, orta: { label: "ORTA", color: "#d0a64c" }, dusuk: { label: "DÜŞÜK", color: "#9fb4c8" }
};
const TUR: Record<string, string> = { hukuk: "Hukuki hata", puan: "Puanlama", tutarlilik: "Tutarlılık", dil: "Dil / yazım", yapi: "Oyun yapısı" };
const errText = (e: unknown) => (e instanceof AiError || e instanceof Error ? e.message : String(e));

function getAt(obj: any, path: string): unknown {
  return path.split(".").filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
const show = (v: unknown) => (v === undefined ? "—" : typeof v === "string" ? v : JSON.stringify(v));

/* ================= Denetim ================= */

export function AuditPanel({ entries, onSaved, onPreview, onClose }: { entries: PanelEntry[]; onSaved: () => void; onPreview: (c: CaseFile) => void; onClose: () => void }) {
  const [reports, setReports] = useState<Record<string, AuditReport>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [queue, setQueue] = useState<{ total: number; done: number; running: boolean } | null>(null);
  const stop = useRef(false);
  const [q, setQ] = useState("");
  const [onlyIssues, setOnlyIssues] = useState<"hepsi" | "sorunlu" | "denetlenmemis">("hepsi");

  useEffect(() => { listReports().then(setReports).catch(() => {}); }, []);

  const run = async (c: CaseFile) => {
    setBusy(b => ({ ...b, [c.id]: "İnceleniyor…" }));
    try {
      const r = await auditCase(c);
      await saveReport(r);
      setReports(x => ({ ...x, [c.id]: r }));
      setBusy(b => { const n = { ...b }; delete n[c.id]; return n; });
    } catch (e) {
      setBusy(b => ({ ...b, [c.id]: "Hata: " + errText(e) }));
      throw e;
    }
  };

  const runMany = async (list: CaseFile[]) => {
    stop.current = false;
    setQueue({ total: list.length, done: 0, running: true });
    let i = 0;
    const worker = async () => {
      while (!stop.current && i < list.length) {
        const c = list[i++];
        try { await run(c); } catch (e) { if (/yönetici|giriş|eski sürüm|kurulu değil/.test(errText(e))) { stop.current = true; } }
        setQueue(qq => qq && { ...qq, done: qq.done + 1 });
      }
    };
    await Promise.all([worker(), worker()]);
    setQueue(qq => qq && { ...qq, running: false });
  };

  const pending = (r?: AuditReport) => (r ? r.sorunlar.filter(s => s.durum !== "uygulandi" && s.durum !== "reddedildi") : []);
  const shown = entries.filter(e => {
    const r = reports[e.c.id];
    if (onlyIssues === "sorunlu" && !pending(r).length) return false;
    if (onlyIssues === "denetlenmemis" && r) return false;
    return !q || `${e.c.title} ${e.c.court} ${e.c.area}`.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr"));
  });
  const audited = entries.filter(e => reports[e.c.id]).length;
  const openIssues = entries.reduce((n, e) => n + pending(reports[e.c.id]).length, 0);

  if (open) {
    const e = entries.find(x => x.c.id === open);
    const r = reports[open];
    if (e && r) return (
      <ReportView entry={e} report={r} onBack={() => setOpen(null)} onPreview={onPreview}
        onReaudit={async () => { try { await run(e.c); } catch { /* satırda gösterilir */ } }}
        busy={busy[open]}
        onReport={async nr => { await saveReport(nr); setReports(x => ({ ...x, [open]: nr })); }}
        onSaved={onSaved} />
    );
  }

  return (
    <Section title="Yapay zekâ denetimi" hint="Dosyalar hukuki doğruluk, puanlama, tutarlılık ve yazım yönünden incelenir. Bulunan hatalar size listelenir; yalnızca onayladığınız düzeltmeler uygulanır, dosya oyun motoruyla yeniden sınanır ve sonra yayınlanır."
      right={<SmallBtn label="Kapat" onPress={onClose} />}>
      <Text style={st.meta}>{audited}/{entries.length} dosya denetlendi · bekleyen {openIssues} sorun</Text>
      <View style={st.rowWrap}>
        {queue?.running
          ? <><ActivityIndicator color={C.brass} /><Text style={st.meta}>{queue.done}/{queue.total} dosya denetlendi…</Text><SmallBtn label="Durdur" tone="danger" onPress={() => { stop.current = true; }} /></>
          : <>
              <SmallBtn label={`Denetlenmemişleri denetle (${entries.length - audited})`} tone="accent" disabled={entries.length === audited} onPress={() => runMany(entries.filter(e => !reports[e.c.id]).map(e => e.c))} />
              <SmallBtn label={`Tümünü yeniden denetle (${entries.length})`} onPress={() => runMany(entries.map(e => e.c))} />
            </>}
      </View>
      {queue && !queue.running && <Text style={st.meta}>Toplu denetim bitti: {queue.done}/{queue.total}.</Text>}
      <Text style={st.note}>Her dosya yaklaşık yarım dakika sürer; toplu denetim sırasında bu ekran açık kalmalı. Sonuçlar sunucuda saklanır, başka cihazdan da onaylayabilirsiniz.</Text>
      <TextInput value={q} onChangeText={setQ} placeholder="Ara…" placeholderTextColor={C.muted} style={st.search} />
      <Seg value={onlyIssues} onChange={setOnlyIssues} options={[{ v: "hepsi", label: "Hepsi" }, { v: "sorunlu", label: "Bekleyen sorunu olanlar" }, { v: "denetlenmemis", label: "Denetlenmemiş" }]} />
      <View style={{ gap: 6 }}>
        {shown.map(e => {
          const r = reports[e.c.id];
          const p = pending(r);
          const counts = (["yuksek", "orta", "dusuk"] as const).map(k => [k, p.filter(s => s.onem === k).length] as const).filter(([, n]) => n);
          return (
            <View key={e.c.id} style={st.item}>
              <View style={{ flex: 1, minWidth: 200, gap: 2 }}>
                <Text style={st.itemTitle} numberOfLines={1}>{e.c.title}</Text>
                <Text style={st.meta} numberOfLines={1}>{e.c.court} · {e.c.area}</Text>
                {busy[e.c.id] ? <Text style={[st.meta, /^Hata/.test(busy[e.c.id]) && { color: C.bad }]}>{busy[e.c.id]}</Text>
                  : r ? <View style={st.rowWrap}>
                      {counts.length ? counts.map(([k, n]) => <Chip key={k} label={`${n} ${ONEM[k].label}`} color={ONEM[k].color} />) : <Chip label="SORUN YOK" color={C.good} />}
                      {r.motor.length > 0 && <Chip label={`${r.motor.length} MOTOR`} color={C.bad} />}
                      <Text style={st.date}>{new Date(r.tarih).toLocaleDateString("tr-TR")}</Text>
                    </View>
                  : <Text style={st.meta}>Denetlenmedi</Text>}
              </View>
              <View style={st.rowWrap}>
                {r && <SmallBtn label={p.length ? "Sorunları gör ›" : "Raporu gör"} tone={p.length ? "accent" : "plain"} onPress={() => setOpen(e.c.id)} />}
                <SmallBtn label={r ? "Yeniden denetle" : "Denetle"} disabled={!!busy[e.c.id] && !/^Hata/.test(busy[e.c.id])} onPress={() => { run(e.c).catch(() => {}); }} />
              </View>
            </View>
          );
        })}
      </View>
    </Section>
  );
}

function ReportView({ entry, report, onBack, onPreview, onReaudit, busy, onReport, onSaved }: {
  entry: PanelEntry; report: AuditReport; onBack: () => void; onPreview: (c: CaseFile) => void; onReaudit: () => void; busy?: string;
  onReport: (r: AuditReport) => Promise<void>; onSaved: () => void;
}) {
  const c = entry.c;
  const waiting = report.sorunlar.map((s, i) => ({ s, i })).filter(x => x.s.durum !== "uygulandi" && x.s.durum !== "reddedildi");
  const [sel, setSel] = useState<Set<number>>(() => new Set(waiting.filter(x => x.s.islemler.length).map(x => x.i)));
  const [result, setResult] = useState<{ next: CaseFile; problems: string[]; idx: number[] } | null>(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const toggle = (i: number) => setSel(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const mark = async (idx: number[], durum: Issue["durum"]) => {
    const nr = { ...report, sorunlar: report.sorunlar.map((s, i) => (idx.includes(i) ? { ...s, durum } : s)) };
    await onReport(nr);
  };
  const apply = () => {
    const idx = [...sel].sort((a, b) => a - b);
    try {
      const r = applyIssues(c, idx.map(i => report.sorunlar[i]));
      setResult({ ...r, idx }); setMsg("");
    } catch (e) { setMsg("Düzeltmeler uygulanamadı: " + errText(e)); }
  };
  const publish = async (status: "yayinda" | "taslak") => {
    if (!result) return;
    setSaving(true);
    try {
      await store.save(result.next, status, "duzeltme");
      await mark(result.idx, "uygulandi");
      setMsg(status === "yayinda" ? "Düzeltilmiş dosya yayınlandı. Oyuncular bir sonraki açılışta yeni hâlini görür." : "Düzeltilmiş dosya taslak olarak kaydedildi.");
      setResult(null); setSel(new Set());
      onSaved();
    } catch (e) { setMsg("Kaydedilemedi: " + errText(e)); }
    setSaving(false);
  };

  return (
    <Section title={c.title} hint={`${c.court} · ${c.area} · denetim: ${new Date(report.tarih).toLocaleString("tr-TR")}`}
      right={<SmallBtn label="‹ Listeye dön" onPress={onBack} />}>
      {!!report.ozet && <Text style={st.body}>{report.ozet}</Text>}
      {report.motor.length > 0 && (
        <View style={st.box}>
          <Text style={st.boxTitle}>Oyun motorunun bulduğu yapısal sorunlar</Text>
          {report.motor.map((m, i) => <Text key={i} style={st.meta}>• {m}</Text>)}
        </View>
      )}
      {report.sorunlar.length === 0 && <Text style={st.body}>Yapay zekâ bu dosyada hata bulmadı.</Text>}
      {report.sorunlar.map((s, i) => {
        const done = s.durum === "uygulandi" || s.durum === "reddedildi";
        return (
          <View key={i} style={[st.issue, done && { opacity: 0.55 }]}>
            <View style={st.rowWrap}>
              {!done && s.islemler.length > 0 && (
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: sel.has(i) }} onPress={() => toggle(i)} style={[st.check, sel.has(i) && st.checkOn]}>
                  {sel.has(i) && <Text style={st.tick}>✓</Text>}
                </Pressable>
              )}
              <Chip label={ONEM[s.onem]?.label || s.onem} color={ONEM[s.onem]?.color || C.muted} />
              <Text style={st.kind}>{TUR[s.tur] || s.tur}</Text>
              <Text style={st.where}>{s.yer}</Text>
              {s.durum === "uygulandi" && <Chip label="UYGULANDI" color={C.good} />}
              {s.durum === "reddedildi" && <Chip label="REDDEDİLDİ" color={C.muted} />}
            </View>
            <Text style={st.body}><Text style={st.b}>Sorun: </Text>{s.sorun}</Text>
            <Text style={st.body}><Text style={st.b}>Öneri: </Text>{s.oneri}</Text>
            {s.islemler.length > 0 && !done && <OpsView c={c} ops={s.islemler} />}
            {s.islemler.length === 0 && !done && <Text style={st.meta}>Bu sorun için otomatik düzeltme önerilmedi; düzenleyiciden elle düzeltebilirsiniz.</Text>}
            {!done && <View style={st.rowWrap}><SmallBtn label="Bu sorunu reddet" onPress={() => { mark([i], "reddedildi"); setSel(x => { const n = new Set(x); n.delete(i); return n; }); }} /></View>}
          </View>
        );
      })}
      {waiting.length > 0 && !result && (
        <View style={st.rowWrap}>
          <SmallBtn label={`Seçilen ${sel.size} düzeltmeyi uygula ve sına`} tone="accent" disabled={!sel.size} onPress={apply} />
          <SmallBtn label="Yeniden denetle" disabled={!!busy && !/^Hata/.test(busy)} onPress={onReaudit} />
        </View>
      )}
      {!!busy && <Text style={st.meta}>{busy}</Text>}
      {result && (
        <View style={[st.box, { borderColor: result.problems.length ? C.bad : C.good }]}>
          <Text style={st.boxTitle}>{result.problems.length ? "Düzeltmeler uygulandı ama oyun motoru sorun buldu" : "Düzeltmeler uygulandı; dosyanın bütün yolları sorunsuz oynandı"}</Text>
          {result.problems.slice(0, 8).map((p, i) => <Text key={i} style={st.meta}>• {p}</Text>)}
          <View style={st.rowWrap}>
            <SmallBtn label="▶ Düzeltilmiş hâlini oyna" onPress={() => onPreview(result.next)} disabled={result.problems.length > 0} />
            <SmallBtn label="Onayla ve yayınla" tone="accent" disabled={saving || result.problems.length > 0} onPress={() => publish("yayinda")} />
            <SmallBtn label="Taslak olarak kaydet" disabled={saving} onPress={() => publish("taslak")} />
            <SmallBtn label="Vazgeç" onPress={() => setResult(null)} />
          </View>
        </View>
      )}
      {!!msg && <Text style={st.body}>{msg}</Text>}
    </Section>
  );
}

function OpsView({ c, ops }: { c: CaseFile; ops: Op[] }) {
  const [openAll, setOpenAll] = useState(false);
  return (
    <View style={st.ops}>
      {ops.slice(0, openAll ? ops.length : 3).map((o, i) => {
        const old = getAt(c, o.yol);
        const kind = o.islem || "degistir";
        return (
          <View key={i} style={{ gap: 2 }}>
            <Text style={st.path}>{kind === "sil" ? "Silinecek" : kind === "ekle" ? "Eklenecek" : "Değişecek"} · {o.yol}</Text>
            {kind !== "ekle" && <Text style={st.old} numberOfLines={openAll ? undefined : 4}><Text style={st.b}>Şimdiki: </Text>{show(old)}</Text>}
            {kind !== "sil" && <Text style={st.new} numberOfLines={openAll ? undefined : 6}><Text style={st.b}>Yeni: </Text>{show(o.deger)}</Text>}
          </View>
        );
      })}
      {(ops.length > 3 || !openAll) && <Pressable onPress={() => setOpenAll(!openAll)}><Text style={st.more}>{openAll ? "Kısalt" : ops.length > 3 ? `Tüm değişiklikleri göster (${ops.length})` : "Tam metni göster"}</Text></Pressable>}
    </View>
  );
}

/* ================= Üretim ================= */

const GEN_PRESETS = PRESETS.filter(p => !["sayistay", "yuce-divan", "aym-genel-kurul", "aihm-buyuk", "ucm-temyiz"].includes(p.key));

export function GeneratePanel({ takenIds, onSaved, onPreview, onEdit, onClose }: {
  takenIds: string[]; onSaved: () => void; onPreview: (c: CaseFile) => void; onEdit: (c: CaseFile) => void; onClose: () => void;
}) {
  const [mode, setMode] = useState<"solo" | "duel">("solo");
  const [branch, setBranch] = useState(BRANCHES[0].label);
  const [preset, setPreset] = useState<CourtPreset>(PRESETS[0]);
  const [difficulty, setDifficulty] = useState<"basit" | "orta" | "zor">("orta");
  const [steps, setSteps] = useState<"4" | "5" | "6">("5");
  const [topic, setTopic] = useState("");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [res, setRes] = useState<GenResult | null>(null);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState<"" | "taslak" | "yayinda">("");

  const start = async () => {
    setRunning(true); setErr(""); setRes(null); setSaved(""); setLog([]);
    try {
      const r = await generateCase({ mode, branch, preset, difficulty, topic, steps: Number(steps) }, takenIds, s => setLog(l => [...l, s]));
      setRes(r);
      // Kaybolmasın diye hemen taslak olarak kaydedilir.
      await store.save(r.c, "taslak", "uretim"); setSaved("taslak"); onSaved();
    } catch (e) { setErr(errText(e)); }
    setRunning(false);
  };
  const publish = async () => {
    if (!res) return;
    try { await store.save(res.c, "yayinda", "uretim"); setSaved("yayinda"); onSaved(); } catch (e) { setErr(errText(e)); }
  };
  const groups = useMemo(() => [...new Set(GEN_PRESETS.map(p => p.group))], []);

  return (
    <Section title="Yapay zekâ ile dosya üret" hint="İstediğiniz branş, mahkeme ve konuda yeni bir dava dosyası yazdırın. Dosya oyun motoruyla sınanır ve taslak olarak kaydedilir; oynayıp beğenirseniz yayınlarsınız."
      right={<SmallBtn label="Kapat" onPress={onClose} />}>
      <Seg label="Mod" value={mode} onChange={setMode} options={[{ v: "solo", label: "Tek kişilik (kariyer)" }, { v: "duel", label: "Karşılıklı duruşma" }]} />
      <Seg label="Branş" value={branch} onChange={setBranch} options={BRANCHES.map(b => ({ v: b.label, label: `${b.icon} ${b.label}` }))} />
      {groups.map(g => (
        <View key={g} style={{ gap: 6 }}>
          <Text style={st.label}>{g.toLocaleUpperCase("tr")}</Text>
          <View style={st.rowWrap}>
            {GEN_PRESETS.filter(p => p.group === g).map(p => (
              <Pressable key={p.key} onPress={() => setPreset(p)} style={[st.preset, preset.key === p.key && st.presetOn]} accessibilityRole="radio" accessibilityState={{ checked: preset.key === p.key }}>
                <Text style={[st.presetText, preset.key === p.key && { color: C.brassInk }]}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      <Seg label="Zorluk" value={difficulty} onChange={setDifficulty} options={[{ v: "basit", label: "Basit" }, { v: "orta", label: "Orta" }, { v: "zor", label: "Zor" }]} />
      <Seg label="Adım sayısı" value={steps} onChange={setSteps} options={[{ v: "4", label: "4" }, { v: "5", label: "5" }, { v: "6", label: "6" }]} />
      <Text style={st.label}>KONU (İSTEĞE BAĞLI)</Text>
      <TextInput value={topic} onChangeText={setTopic} multiline placeholder="ör. Kambiyo senedinde zamanaşımı itirazı; ya da: işçinin haklı fesih nedeniyle kıdem tazminatı, tanık beyanları çelişkili" placeholderTextColor={C.muted} style={st.topic} />
      <View style={st.rowWrap}>
        <SmallBtn label={running ? "Üretiliyor…" : "✨ Dosyayı üret"} tone="accent" disabled={running} onPress={start} />
        {running && <ActivityIndicator color={C.brass} />}
      </View>
      <Text style={st.note}>Üretim 1–3 dakika sürer; bu ekran açık kalmalı.</Text>
      {log.map((l, i) => <Text key={i} style={st.meta}>{l}</Text>)}
      {!!err && <Text style={[st.body, { color: C.bad }]}>{err}</Text>}
      {res && (
        <View style={[st.box, { borderColor: res.problems.length ? C.bad : C.good }]}>
          <Text style={st.itemTitle}>{res.c.title}</Text>
          <Text style={st.meta}>{res.c.court} · {res.c.area} · {res.c.steps.length} adım</Text>
          <Text style={st.body}>{res.c.teaser}</Text>
          {res.problems.slice(0, 6).map((p, i) => <Text key={i} style={[st.meta, { color: C.bad }]}>• {p}</Text>)}
          <Text style={st.meta}>{saved === "yayinda" ? "Yayında: oyuncuların büro masasına ve listelere gelecek." : saved === "taslak" ? "Taslak olarak kaydedildi (yalnızca panelde görünür)." : ""}</Text>
          <View style={st.rowWrap}>
            <SmallBtn label="▶ Oyna" disabled={res.problems.length > 0} onPress={() => onPreview(res.c)} />
            <SmallBtn label="Düzenleyicide aç" onPress={() => onEdit(res.c)} />
            {saved !== "yayinda" && <SmallBtn label="Yayınla" tone="accent" disabled={res.problems.length > 0} onPress={publish} />}
          </View>
          <Text style={st.note}>Yayınlamadan önce “Yapay zekâ denetimi” bölümünde bu dosyayı ayrıca denetletmeniz önerilir.</Text>
        </View>
      )}
    </Section>
  );
}

const st = StyleSheet.create({
  rowWrap: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  meta: { fontFamily: F.body, fontSize: 14, color: C.muted },
  date: { fontFamily: F.mono, fontSize: 11, color: C.muted },
  note: { fontFamily: F.body, fontSize: 13, color: C.muted, fontStyle: "italic" },
  body: { fontFamily: F.body, fontSize: 15, color: C.textSoft, lineHeight: 21 },
  b: { fontFamily: F.bodyBold, color: C.text },
  label: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: C.muted },
  search: { fontFamily: F.body, fontSize: 16, color: C.text, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  item: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10 },
  itemTitle: { fontFamily: F.displayMed, fontSize: 17, color: C.text },
  box: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, gap: 6, backgroundColor: C.panel2 },
  boxTitle: { fontFamily: F.bodyBold, fontSize: 15, color: C.text },
  issue: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, gap: 6, backgroundColor: C.panel2 },
  kind: { fontFamily: F.bodyBold, fontSize: 14, color: C.text },
  where: { fontFamily: F.mono, fontSize: 12, color: C.muted },
  check: { width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: C.brassDim, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: C.bordo, borderColor: C.bordo },
  tick: { color: "#fff", fontFamily: F.bodyBold, fontSize: 14 },
  ops: { borderLeftWidth: 3, borderLeftColor: C.line, paddingLeft: 8, gap: 6 },
  path: { fontFamily: F.mono, fontSize: 11, color: C.muted },
  old: { fontFamily: F.body, fontSize: 14, color: "#e8b4b4" },
  new: { fontFamily: F.body, fontSize: 14, color: "#9fe0b8" },
  more: { fontFamily: F.bodyMed, fontSize: 13, color: C.brass, textDecorationLine: "underline" },
  preset: { borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: C.panel2 },
  presetOn: { backgroundColor: C.brass, borderColor: C.brass },
  presetText: { fontFamily: F.bodyMed, fontSize: 14, color: C.text },
  topic: { fontFamily: F.body, fontSize: 16, color: C.text, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, minHeight: 70, textAlignVertical: "top" }
});
