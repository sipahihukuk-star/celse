// Dava düzenleyici: sekmeler hâlinde bütün dava alanları, canlı denetim, önizleme ve JSON görünümü.
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { CHAPTERS, levelOf } from "../data/career";
import { normalizeCase, validateCase } from "../engine/engine";
import { simulateCase, SimResult } from "../engine/simulate";
import { CaseFile, CastMember, Choice, EvidenceItem, EvidenceResponse, Look, Outcome, Step } from "../engine/types";
import Character from "../ui/Character";
import { Btn, Chip } from "../ui/kit";
import { C, F } from "../ui/theme";
import { Area, csv, Field, LinesEditor, ListEditor, Row, Section, Seg, SmallBtn, TextEditor, Toggle } from "./form";
import { applyPreset, PRESETS } from "./presets";
import { Status } from "./store";

type Tab = "genel" | "karakterler" | "acilis" | "canta" | "adimlar" | "kararlar" | "denetim" | "json";
const TABS: { k: Tab; label: string }[] = [
  { k: "genel", label: "Genel" }, { k: "karakterler", label: "Karakterler" }, { k: "acilis", label: "Açılış ve belgeler" },
  { k: "canta", label: "Delil çantası" }, { k: "adimlar", label: "Adımlar" }, { k: "kararlar", label: "Kararlar" },
  { k: "denetim", label: "Denetim" }, { k: "json", label: "JSON" }
];

interface Props {
  initial: CaseFile;
  status: Status | "yerlesik";
  isNew: boolean;
  takenIds: string[];
  onSave: (c: CaseFile, status: Status) => void;
  onPreview: (c: CaseFile) => void;
  onClose: () => void;
}

export default function CaseEditor({ initial, status, isNew, takenIds, onSave, onPreview, onClose }: Props) {
  const [c, setC] = useState<CaseFile>(initial);
  const [tab, setTab] = useState<Tab>("genel");
  const [dirty, setDirty] = useState(isNew);
  const set = (next: CaseFile) => { setC(next); setDirty(true); };
  const errors = useMemo(() => validateCase(c), [c]);
  const idClash = isNew && takenIds.includes(c.id);
  const canSave = !idClash && !!c.id.trim();
  const { width } = useWindowDimensions();

  return (
    <View style={st.root}>
      <View style={[st.head, width < 640 && { flexDirection: "column", alignItems: "stretch" }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.crumb}>YÖNETİM · {isNew ? "YENİ DAVA" : "DAVA DÜZENLE"}</Text>
          <Text style={st.title} numberOfLines={1}>{c.title || "(başlıksız)"}</Text>
          <View style={st.badges}>
            <Chip label={status === "yayinda" ? "YAYINDA" : status === "taslak" ? "TASLAK" : "UYGULAMAYLA GELEN"} color={status === "yayinda" ? C.good : C.brass} />
            <Chip label={errors.length ? `${errors.length} HATA` : "DOĞRULAMA TEMİZ"} color={errors.length ? C.bad : C.good} />
            {dirty && <Chip label="KAYDEDİLMEDİ" color={C.muted} />}
          </View>
        </View>
        <View style={st.actions}>
          <SmallBtn label="‹ Listeye dön" onPress={onClose} />
          <SmallBtn label="▶ Oyna (önizleme)" onPress={() => onPreview(normalizeCase(c))} disabled={errors.length > 0} />
          <SmallBtn label="Taslak olarak kaydet" onPress={() => { onSave(normalizeCase(c), "taslak"); setDirty(false); }} disabled={!canSave} />
          <SmallBtn label="Yayınla" tone="accent" onPress={() => { onSave(normalizeCase(c), "yayinda"); setDirty(false); }} disabled={!canSave || errors.length > 0} />
        </View>
      </View>
      {idClash && <Text style={st.warn}>Bu kimlik başka bir davada kullanılıyor. Genel sekmesinden farklı bir kimlik verin.</Text>}
      {errors.length > 0 && <Text style={st.warn}>Hatalar giderilmeden dava yayınlanamaz ve oynanamaz. Ayrıntılar Denetim sekmesinde.</Text>}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={st.tabs}>
        {TABS.map(t => (
          <Pressable key={t.k} onPress={() => setTab(t.k)} style={[st.tab, tab === t.k && st.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === t.k }}>
            <Text style={[st.tabText, tab === t.k && st.tabTextOn]}>{t.label}{t.k === "adimlar" ? ` (${c.steps.length})` : t.k === "canta" ? ` (${c.evidence?.length || 0})` : t.k === "kararlar" ? ` (${c.outcomes.length})` : ""}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={st.body} keyboardShouldPersistTaps="handled">
        {tab === "genel" && <GeneralTab c={c} set={set} isNew={isNew} />}
        {tab === "karakterler" && <CastTab c={c} set={set} />}
        {tab === "acilis" && <IntroTab c={c} set={set} />}
        {tab === "canta" && <EvidenceTab c={c} set={set} />}
        {tab === "adimlar" && <StepsTab c={c} set={set} />}
        {tab === "kararlar" && <OutcomesTab c={c} set={set} />}
        {tab === "denetim" && <CheckTab c={c} errors={errors} onPreview={() => onPreview(normalizeCase(c))} />}
        {tab === "json" && <JsonTab c={c} set={set} />}
      </ScrollView>
    </View>
  );
}

/* ---------- yardımcılar ---------- */
type TabProps = { c: CaseFile; set: (c: CaseFile) => void };

function speakersOf(c: CaseFile) {
  const out = [{ v: "narr", label: "Anlatıcı" }];
  Object.entries(c.cast).forEach(([k, m]) => out.push({ v: k, label: m.name || (k === "p1" ? c.sides.p1.role : k === "p2" ? c.sides.p2.role : k) }));
  if (c.mode === "solo" && !c.cast.p1) out.push({ v: "p1", label: `Oyuncu (${c.sides.p1.role})` });
  return out;
}
function flagsOf(c: CaseFile): string[] {
  const f = new Set<string>();
  const add = (s?: string[]) => (s || []).forEach(x => f.add(x));
  c.steps.forEach(s => { s.choices.forEach(ch => add(ch.set)); [s.hit, s.miss, s.pass, ...Object.values(s.responses || {})].forEach(r => add(r?.set)); });
  return [...f];
}
function FlagHelp({ c }: { c: CaseFile }) {
  const flags = flagsOf(c);
  return (
    <Text style={st.hint}>
      Koşullarda kullanılabilecek bayraklar: {flags.length ? flags.join(", ") : "henüz yok (seçeneklerin “açtığı bayraklar” alanından eklenir)"}. Koşul dili: ve “&&”, veya “||”, değil “!”, parantez.
    </Text>
  );
}

/* ---------- Genel ---------- */
function GeneralTab({ c, set, isNew }: TabProps & { isNew: boolean }) {
  return (
    <>
      <Section title="Kimlik ve görünüm" hint="Dosya dolabında ve karar ekranında görünen bilgiler.">
        <Row>
          <Field label="Kimlik (benzersiz)" value={c.id} onChange={v => isNew && set({ ...c, id: v.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} mono hint={isNew ? "Küçük harf, rakam ve tire." : "Kayıtlı davanın kimliği değiştirilemez."} />
          <Field label="Başlık" value={c.title} onChange={v => set({ ...c, title: v })} />
          <Field label="Alan" value={c.area} onChange={v => set({ ...c, area: v })} hint="ör. İş Hukuku · İşe iade" />
        </Row>
        <Area label="Tanıtım" value={c.teaser} onChange={v => set({ ...c, teaser: v })} rows={2} />
        <Row>
          <Field label="Esas / dosya no" value={c.esas} onChange={v => set({ ...c, esas: v })} />
          <Field label="Karar tarihi" value={c.kararTarihi} onChange={v => set({ ...c, kararTarihi: v })} />
          <Field label="Dosya rengi" value={c.color} onChange={v => set({ ...c, color: v })} mono hint="#rrggbb" />
          <View style={[st.swatch, { backgroundColor: /^#[0-9a-fA-F]{6}$/.test(c.color) ? c.color : C.panel2 }]} />
        </Row>
        <Seg label="Zorluk" value={c.difficulty || "orta"} onChange={v => set({ ...c, difficulty: v })}
          options={[{ v: "basit", label: "Basit · maddi hukuk ağırlıklı" }, { v: "orta", label: "Orta · bir usul tuzağı" }, { v: "zor", label: "Zor · usul merkezde" }]} />
        <Seg label="Mod" value={c.mode} onChange={v => set({ ...c, mode: v })} options={[{ v: "solo", label: "Tek kişilik" }, { v: "duel", label: "Karşılıklı duruşma" }]} />
        <Row>
          <Field label="Oyuncunun / 1. tarafın rolü" value={c.sides.p1.role} onChange={v => set({ ...c, sides: { ...c.sides, p1: { ...c.sides.p1, role: v } } })} />
          <Field label="Kısa adı" value={c.sides.p1.short} onChange={v => set({ ...c, sides: { ...c.sides, p1: { ...c.sides.p1, short: v } } })} />
          {c.mode === "duel" && <>
            <Field label="2. tarafın rolü" value={c.sides.p2.role} onChange={v => set({ ...c, sides: { ...c.sides, p2: { ...c.sides.p2, role: v } } })} />
            <Field label="Kısa adı" value={c.sides.p2.short} onChange={v => set({ ...c, sides: { ...c.sides, p2: { ...c.sides.p2, short: v } } })} />
          </>}
        </Row>
      </Section>

      <Section title="Mahkeme" hint="Şablon seçmek mahkeme adını, heyeti, salonu ve başkanın görünüşünü birlikte doldurur. Sonra ayrıntıları değiştirebilirsiniz.">
        <Text style={st.label}>ŞABLONLAR</Text>
        <View style={st.presetGrid}>
          {PRESETS.map(p => (
            <Pressable key={p.key} onPress={() => set(applyPreset(c, p))} style={({ pressed }) => [st.preset, pressed && { borderColor: C.brass }]}>
              <Text style={st.presetGroup}>{p.group.toLocaleUpperCase("tr")}</Text>
              <Text style={st.presetLabel}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
        <Row>
          <Field label="Mahkeme adı" value={c.court} onChange={v => set({ ...c, court: v })} />
          <Field label="Kürsü plakası" value={c.courtShort} onChange={v => set({ ...c, courtShort: v })} />
        </Row>
        <Row>
          <Field label="Heyetteki hâkim sayısı" value={c.bench?.judges ?? 1} numeric onChange={v => set({ ...c, bench: { ...(c.bench || { judges: 1 }), judges: Math.max(1, Math.min(21, parseInt(v) || 1)) } })} width={180} />
          <Field label="Heyetin adı" value={c.bench?.title} onChange={v => set({ ...c, bench: { judges: c.bench?.judges ?? 1, title: v || undefined } })} />
        </Row>
        <Seg label="Salon" value={c.room || "yerel"} onChange={v => set({ ...c, room: v })} options={[{ v: "yerel", label: "Yerel mahkeme" }, { v: "yuksek", label: "Yüksek mahkeme" }, { v: "uluslararasi", label: "Uluslararası" }]} />
        <Row>
          <Field label="Kürsü yazısı" value={c.inscription ?? ""} onChange={v => set({ ...c, inscription: v ? v : null })} hint="Boş bırakılırsa yazı çıkmaz." />
        </Row>
        {c.mode === "solo" && (
          <View style={{ gap: 6 }}>
            <Text style={st.label}>SALONDA BULUNANLAR</Text>
            <Row>
              {[["opp", "Karşı taraf"], ["client", "Müvekkil / sanık (kürsü önünde)"], ["pros", "Savcı (hâkimin yanında; yalnız tek hâkimde)"]].map(([k, l]) => (
                <Toggle key={k} label={l} value={!!c.courtCast?.includes(k)} onChange={on => set({ ...c, courtCast: on ? [...new Set([...(c.courtCast || ["judge", "you"]), k])] : (c.courtCast || []).filter(x => x !== k) })} />
              ))}
            </Row>
          </View>
        )}
      </Section>

      {c.mode === "solo" && (
        <Section title="Kariyer" hint={`Oyuncu ilk bölümden başlar; bir bölümün davalarının yüzde 60’ını (en çok 4) kazanınca sonraki bölüm açılır. Bölüm içinde davalar sırayla açılır. Seviye "Otomatik" bırakılırsa mahkemeden çıkarılır: şu an ${CHAPTERS[levelOf({ ...c, career: undefined }) - 1].title}.`}>
          <Seg label="Bölüm" value={String(c.career?.level ?? 0)}
            onChange={v => set({ ...c, career: { ...c.career, level: v === "0" ? undefined : Number(v) } })}
            options={[{ v: "0", label: "Otomatik" }, ...CHAPTERS.map(ch => ({ v: String(ch.level), label: `${ch.level}. ${ch.title}` }))]} />
          <Row>
            <Field label="Bölüm içindeki sıra" value={c.career?.order} numeric width={200} hint="Küçük sayı önce oynanır. Boşsa listenin sonuna eklenir."
              onChange={v => set({ ...c, career: { ...c.career, order: v.trim() ? Math.max(1, parseInt(v) || 1) : undefined } })} />
          </Row>
          <Toggle label="Kariyerde gösterme (yalnızca serbest listede oynansın)" value={!!c.career?.off} onChange={off => set({ ...c, career: { ...c.career, off: off || undefined } })} />
        </Section>
      )}
    </>
  );
}

/* ---------- Karakterler ---------- */
function LookEditor({ look, onChange }: { look: Look; onChange: (l: Look) => void }) {
  const robe = look.kind !== "civil";
  return (
    <View style={st.lookWrap}>
      <View style={st.lookPreview}><Character look={look} /></View>
      <View style={{ flex: 1, minWidth: 220, gap: 8 }}>
        <Seg label="Kıyafet" value={look.kind === "back" ? "robe" : look.kind} onChange={v => onChange({ ...look, kind: v })} options={[{ v: "robe", label: "Cübbe" }, { v: "civil", label: "Sivil" }]} />
        {robe && <Seg label="Yaka" value={look.collar || "avukat"} onChange={v => onChange({ ...look, collar: v })} options={[{ v: "hakim", label: "Hâkim / savcı (kırmızı)" }, { v: "avukat", label: "Avukat (yeşil)" }]} />}
        <Seg label="Saç" value={look.style || "short"} onChange={v => onChange({ ...look, style: v })} options={[{ v: "short", label: "Kısa" }, { v: "long", label: "Uzun" }, { v: "bun", label: "Topuz" }, { v: "curly", label: "Kıvırcık" }, { v: "bald", label: "Kel" }]} />
        <Row>
          <Field label="Ten rengi" value={look.skin} onChange={v => onChange({ ...look, skin: v })} mono />
          <Field label="Saç rengi" value={look.hair} onChange={v => onChange({ ...look, hair: v })} mono />
        </Row>
        <Row>
          <Toggle label="Sakal" value={!!look.beard} onChange={v => onChange({ ...look, beard: v })} />
          <Toggle label="Gözlük" value={!!look.glasses} onChange={v => onChange({ ...look, glasses: v })} />
        </Row>
        {robe ? (
          <Row>
            <Field label="Cübbe rengi (isteğe bağlı)" value={look.robe} onChange={v => onChange({ ...look, robe: v || undefined })} mono />
            <Field label="Yaka rengi (isteğe bağlı)" value={look.collarColor} onChange={v => onChange({ ...look, collarColor: v || undefined })} mono />
          </Row>
        ) : (
          <Row>
            <Field label="Gömlek rengi" value={look.shirt} onChange={v => onChange({ ...look, shirt: v })} mono />
            <Field label="İç renk" value={look.inner} onChange={v => onChange({ ...look, inner: v })} mono />
          </Row>
        )}
      </View>
    </View>
  );
}

function CastTab({ c, set }: TabProps) {
  const entries = Object.entries(c.cast);
  const roleHint: Record<string, string> = { judge: "Hâkim / başkan (heyetin diğer üyeleri buna göre çizilir)", opp: "Karşı taraf", client: "Müvekkil", pros: "Savcı", p1: "1. oyuncunun avukatı", p2: "2. oyuncunun avukatı" };
  const [newKey, setNewKey] = useState("");
  return (
    <>
      {entries.map(([k, m]) => (
        <Section key={k} title={m.name || roleHint[k] || k} hint={`Kimlik: ${k}${roleHint[k] ? " · " + roleHint[k] : " · sahnede çizilmez, yalnızca konuşur"}`}
          right={k !== "judge" ? <SmallBtn label="Sil" tone="danger" onPress={() => { const cast = { ...c.cast }; delete cast[k]; set({ ...c, cast }); }} /> : undefined}>
          <Row>
            <Field label="Görünen ad" value={m.name} onChange={v => set({ ...c, cast: { ...c.cast, [k]: { ...m, name: v } } })} />
          </Row>
          <Seg label="İsim plakası" value={m.np || "civil"} onChange={v => set({ ...c, cast: { ...c.cast, [k]: { ...m, np: v } } })} options={[{ v: "red", label: "Kırmızı (hâkim, savcı)" }, { v: "green", label: "Yeşil (avukat)" }, { v: "civil", label: "Pirinç (sivil)" }]} />
          <LookEditor look={m.look} onChange={l => set({ ...c, cast: { ...c.cast, [k]: { ...m, look: l } } })} />
        </Section>
      ))}
      <Section title="Yeni karakter" hint="Örneğin raportör, tanık ya da savcı. Sahnede yalnızca hâkim, karşı taraf, müvekkil ve savcı çizilir; diğerleri konuşma satırlarında görünür.">
        <Row>
          <Field label="Kimlik" value={newKey} onChange={v => setNewKey(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))} mono placeholder="ör. tanik" />
          <View style={{ justifyContent: "flex-end" }}>
            <SmallBtn label="+ Ekle" tone="accent" disabled={!newKey || !!c.cast[newKey]} onPress={() => {
              const m: CastMember = { name: newKey, np: "civil", look: { kind: "civil", skin: "#d6a57c", hair: "#2a2220", style: "short", shirt: "#4a4f57", inner: "#c9c4b8" } };
              set({ ...c, cast: { ...c.cast, [newKey]: m } }); setNewKey("");
            }} />
          </View>
        </Row>
      </Section>
    </>
  );
}

/* ---------- Açılış ve belgeler ---------- */
function IntroTab({ c, set }: TabProps) {
  return (
    <>
      <Section title="Açılış konuşmaları" hint="Dava büroda başlar; olay anlatılır.">
        <LinesEditor label="Satırlar" lines={c.intro} onChange={v => set({ ...c, intro: v })} speakers={speakersOf(c)} />
      </Section>
      <Section title="Dosyadaki belgeler" hint="Açılıştan sonra gösterilir; oyuncu “Dosya” düğmesiyle her an açabilir.">
        <ListEditor items={c.docs} onChange={v => set({ ...c, docs: v })} addLabel="Belge ekle" make={() => ({ t: "", d: "" })} collapsedTitle
          title={d => d.t} render={(d, up) => (<>
            <Field label="Belge adı" value={d.t} onChange={v => up({ ...d, t: v })} />
            <Area label="Açıklama" value={d.d} onChange={v => up({ ...d, d: v })} rows={2} />
          </>)} />
      </Section>
    </>
  );
}

/* ---------- Delil çantası ---------- */
function EvidenceTab({ c, set }: TabProps) {
  return (
    <Section title="Delil çantası" hint="Delil adımlarında oyuncu bu listeden seçer. Koşul verilen delil, o bayrak açılana kadar çantada görünmez (ör. müvekkil görüşmesinde ortaya çıkan belge).">
      <FlagHelp c={c} />
      <ListEditor items={c.evidence || []} onChange={v => set({ ...c, evidence: v })} addLabel="Delil ekle" collapsedTitle
        make={(): EvidenceItem => ({ id: `ev_${(c.evidence?.length || 0) + 1}`, type: "belge", title: "", desc: "" })}
        title={e => `${e.title || e.id}${e.if ? `  [${e.if}]` : ""}`}
        render={(e, up) => (<>
          <Row>
            <Field label="Kimlik" value={e.id} onChange={v => up({ ...e, id: v })} mono />
            <Field label="Başlık" value={e.title} onChange={v => up({ ...e, title: v })} />
          </Row>
          <Seg label="Tür" value={e.type} onChange={v => up({ ...e, type: v })} options={[{ v: "belge", label: "Belge" }, { v: "kanun", label: "Kanun maddesi" }, { v: "beyan", label: "Beyan" }]} />
          <Area label="Açıklama" value={e.desc} onChange={v => up({ ...e, desc: v })} rows={2} />
          <Row>
            <Field label="Madde etiketi" value={e.law} onChange={v => up({ ...e, law: v || undefined })} placeholder="ör. HMK m.200" />
            <Field label="Görünme koşulu" value={e.if} onChange={v => up({ ...e, if: v || undefined })} mono placeholder="ör. makbuz" />
          </Row>
        </>)} />
    </Section>
  );
}

/* ---------- Adımlar ---------- */
function ChoiceEditor({ ch, up, c, question }: { ch: Choice; up: (v: Choice) => void; c: CaseFile; question?: boolean }) {
  return (
    <>
      <Area label={question ? "Soru" : "Seçenek metni"} value={ch.text} onChange={v => up({ ...ch, text: v })} rows={2} />
      <Row>
        <Field label="Puan etkisi" value={ch.delta} numeric onChange={v => up({ ...ch, delta: parseInt(v) || 0 })} width={140} hint="Doğru hamle +15…+25" />
        <Field label="Açtığı bayraklar" value={(ch.set || []).join(", ")} onChange={v => up({ ...ch, set: csv(v).length ? csv(v) : undefined })} mono hint="Virgülle ayırın" />
        <Field label="Görünme koşulu" value={ch.if} onChange={v => up({ ...ch, if: v || undefined })} mono />
        <Field label="Madde etiketi" value={ch.law} onChange={v => up({ ...ch, law: v || undefined })} />
      </Row>
      <LinesEditor label={question ? "Cevap (müvekkilin söyledikleri)" : "Seçimden sonra konuşanlar"} lines={ch.reply} onChange={v => up({ ...ch, reply: v.length ? v : undefined })} speakers={speakersOf(c)} />
      <TextEditor label="Açıklama (geri bildirim)" value={ch.note} onChange={v => up({ ...ch, note: v })} hint={question ? "Boş bırakılırsa geri bildirim ekranı çıkmaz." : undefined} />
      {!question && (
        <>
          <Toggle label="Bu hamle davayı hemen bitirir (seçen taraf kaybeder)" value={!!ch.fatal} onChange={on => up({ ...ch, fatal: on ? { hukum: "", summary: "" } : undefined })} />
          {ch.fatal && (<>
            <Field label="Etiket (boşsa HÜKÜM:)" value={ch.fatal.label} onChange={v => up({ ...ch, fatal: { ...ch.fatal!, label: v || undefined } })} />
            <Area label="Hüküm" value={ch.fatal.hukum} onChange={v => up({ ...ch, fatal: { ...ch.fatal!, hukum: v } })} />
            <Area label="Özet" value={ch.fatal.summary} onChange={v => up({ ...ch, fatal: { ...ch.fatal!, summary: v } })} />
          </>)}
        </>
      )}
    </>
  );
}

function ResponseEditor({ label, r, onChange, c }: { label: string; r: EvidenceResponse | undefined; onChange: (r: EvidenceResponse | undefined) => void; c: CaseFile }) {
  const v = r || { delta: 0, note: "" };
  return (
    <View style={st.resp}>
      <Text style={st.respTitle}>{label}</Text>
      <Row>
        <Field label="Puan etkisi" value={v.delta} numeric onChange={x => onChange({ ...v, delta: parseInt(x) || 0 })} width={140} />
        <Field label="Açtığı bayraklar" value={(v.set || []).join(", ")} onChange={x => onChange({ ...v, set: csv(x).length ? csv(x) : undefined })} mono />
        <Field label="Madde etiketi" value={v.law} onChange={x => onChange({ ...v, law: x || undefined })} />
      </Row>
      <LinesEditor label="Ardından konuşanlar" lines={v.reply} onChange={x => onChange({ ...v, reply: x.length ? x : undefined })} speakers={speakersOf(c)} />
      <TextEditor label="Açıklama" value={v.note} onChange={x => onChange({ ...v, note: x })} />
    </View>
  );
}

function StepEditor({ step, up, c }: { step: Step; up: (s: Step) => void; c: CaseFile }) {
  const kind = step.kind || "choice";
  const bag = c.evidence || [];
  return (
    <>
      <Seg label="Adım türü" value={kind} onChange={v => up({ ...step, kind: v, choices: step.choices || [] })} options={[{ v: "choice", label: "Seçenekli" }, { v: "interview", label: "Müvekkil görüşmesi" }, { v: "evidence", label: "Delil çantası / itiraz" }]} />
      <Row>
        {c.mode === "duel" && <Seg label="Sıra kimde" value={step.side} onChange={v => up({ ...step, side: v })} options={[{ v: "p1", label: c.sides.p1.role }, { v: "p2", label: c.sides.p2.role }]} />}
        <Seg label="Sahne" value={step.scene} onChange={v => up({ ...step, scene: v })} options={[{ v: "office", label: "Büro" }, { v: "court", label: "Duruşma salonu" }]} />
      </Row>
      <Field label="Adımın görünme koşulu" value={step.if} onChange={v => up({ ...step, if: v || undefined })} mono hint="Boşsa her zaman oynanır." />
      <LinesEditor label="Adımdan önce konuşanlar" lines={step.lines} onChange={v => up({ ...step, lines: v })} speakers={speakersOf(c)} />
      {kind === "evidence" && (
        <View style={st.resp}>
          <Text style={st.respTitle}>İtiraz edilecek beyan</Text>
          <Seg label="Konuşan" value={step.statement?.who || "opp"} onChange={v => up({ ...step, statement: { who: v, text: step.statement?.text || "" } })} options={speakersOf(c).filter(s => s.v !== "narr")} />
          <Area label="Beyan" value={step.statement?.text} onChange={v => up({ ...step, statement: { who: step.statement?.who || "opp", text: v } })} />
        </View>
      )}
      <Area label="Soru (oyuncuya)" value={step.prompt} onChange={v => up({ ...step, prompt: v })} rows={2} />

      {kind === "choice" && (
        <ListEditor items={step.choices} onChange={v => up({ ...step, choices: v })} addLabel="Seçenek ekle" collapsedTitle
          make={() => ({ text: "", delta: 0, note: "" })} title={ch => `${ch.delta > 0 ? "+" : ""}${ch.delta}  ${ch.text}`}
          render={(ch, u) => <ChoiceEditor ch={ch} up={u} c={c} />} />
      )}
      {kind === "interview" && (<>
        <Field label="Sorulabilecek soru sayısı" value={step.limit ?? step.choices.length} numeric onChange={v => up({ ...step, limit: Math.max(1, parseInt(v) || 1) })} width={220} />
        <ListEditor items={step.choices} onChange={v => up({ ...step, choices: v })} addLabel="Soru ekle" collapsedTitle
          make={() => ({ text: "", delta: 0, reply: [{ who: "client", text: "" }] })} title={ch => `${ch.delta > 0 ? "+" : ""}${ch.delta}  ${ch.text}${ch.set?.length ? `  → ${ch.set.join(", ")}` : ""}`}
          render={(ch, u) => <ChoiceEditor ch={ch} up={u} c={c} question />} />
      </>)}
      {kind === "evidence" && (<>
        <Text style={st.label}>DOĞRU DELİLLER</Text>
        {bag.length === 0 ? <Text style={st.warnInline}>Önce “Delil çantası” sekmesinden delil ekleyin.</Text> : (
          <View style={st.chips}>
            {bag.map(e => {
              const on = (step.correct || []).includes(e.id);
              return (
                <Pressable key={e.id} onPress={() => up({ ...step, correct: on ? (step.correct || []).filter(x => x !== e.id) : [...(step.correct || []), e.id] })}
                  style={[st.chipBtn, on && st.chipOn]}>
                  <Text style={[st.chipText, on && { color: C.brassInk }]}>{on ? "✓ " : ""}{e.title || e.id}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <ResponseEditor label="Doğru delil sunulunca" r={step.hit} onChange={r => up({ ...step, hit: r })} c={c} />
        <ResponseEditor label="Yanlış delil sunulunca (varsayılan)" r={step.miss} onChange={r => up({ ...step, miss: r })} c={c} />
        <ResponseEditor label="İtiraz etmeden geçilince" r={step.pass} onChange={r => up({ ...step, pass: r })} c={c} />
        <Text style={st.label}>BELİRLİ DELİLLER İÇİN ÖZEL SONUÇ</Text>
        <Text style={st.hint}>Örneğin doğru madde ama yanlış belge sunulduğunda kısmi puan vermek için.</Text>
        {bag.filter(e => !(step.correct || []).includes(e.id)).map(e => {
          const r = step.responses?.[e.id];
          return (
            <View key={e.id} style={{ gap: 6 }}>
              <Toggle label={`${e.title || e.id} için özel sonuç`} value={!!r} onChange={on => {
                const responses = { ...(step.responses || {}) };
                if (on) responses[e.id] = { delta: 0, note: "" }; else delete responses[e.id];
                up({ ...step, responses });
              }} />
              {r && <ResponseEditor label={e.title || e.id} r={r} onChange={x => up({ ...step, responses: { ...(step.responses || {}), [e.id]: x! } })} c={c} />}
            </View>
          );
        })}
      </>)}
    </>
  );
}

function StepsTab({ c, set }: TabProps) {
  const kindLabel = (s: Step) => (s.kind === "interview" ? "Görüşme" : s.kind === "evidence" ? "Delil" : "Seçenekli");
  return (
    <Section title="Adımlar" hint="Adımlar sırayla oynanır. Koşulu tutmayan adım atlanır.">
      <FlagHelp c={c} />
      <ListEditor items={c.steps} onChange={v => set({ ...c, steps: v })} addLabel="Adım ekle" collapsedTitle
        make={(): Step => ({ kind: "choice", side: "p1", scene: "court", lines: [], prompt: "", choices: [{ text: "", delta: 15, note: "" }, { text: "", delta: -10, note: "" }] })}
        title={s => `${kindLabel(s)} · ${s.scene === "office" ? "Büro" : "Salon"}${s.if ? `  [${s.if}]` : ""} · ${s.prompt}`}
        render={(s, up) => <StepEditor step={s} up={up} c={c} />} />
    </Section>
  );
}

/* ---------- Kararlar ---------- */
function OutcomesTab({ c, set }: TabProps) {
  const winners = [{ v: "p1" as const, label: c.mode === "solo" ? "Oyuncu kazanır" : `${c.sides.p1.short} kazanır` }, { v: "p2" as const, label: c.mode === "solo" ? "Oyuncu kaybeder" : `${c.sides.p2.short} kazanır` }, { v: "draw" as const, label: "Uzlaşma / sulh" }];
  return (
    <Section title="Karar kuralları" hint="Yukarıdan aşağıya denenir; koşulu tutan ilk kural kararı verir. En alttaki kural koşulsuz olmalıdır.">
      <FlagHelp c={c} />
      <ListEditor items={c.outcomes} onChange={v => set({ ...c, outcomes: v })} addLabel="Kural ekle" collapsedTitle
        make={(): Outcome => ({ winner: "p1", hukum: "", summary: "" })}
        title={o => `${o.if ? `[${o.if}]` : "(koşulsuz)"} → ${winners.find(w => w.v === o.winner)?.label}`}
        render={(o, up) => (<>
          <Field label="Koşul (son kuralda boş)" value={o.if} onChange={v => up({ ...o, if: v || undefined })} mono />
          <Seg label="Sonuç" value={o.winner} onChange={v => up({ ...o, winner: v })} options={winners} />
          <Row>
            <Field label="Damga (boşsa otomatik)" value={o.stamp} onChange={v => up({ ...o, stamp: v || undefined })} placeholder="ör. SULH" />
            <Field label="Etiket (boşsa HÜKÜM:)" value={o.label} onChange={v => up({ ...o, label: v || undefined })} placeholder="ör. ARA KARAR:" />
          </Row>
          <Toggle label="“İstinaf yolu açık olmak üzere…” cümlesini ekleme" value={!!o.noCourt} onChange={v => up({ ...o, noCourt: v || undefined })} />
          <TextEditor label="Hüküm" value={o.hukum} onChange={v => up({ ...o, hukum: v })} />
          <TextEditor label="Özet (oyuncuya açıklama)" value={o.summary} onChange={v => up({ ...o, summary: v })} />
        </>)} />
    </Section>
  );
}

/* ---------- Denetim ---------- */
function CheckTab({ c, errors, onPreview }: { c: CaseFile; errors: string[]; onPreview: () => void }) {
  const [sim, setSim] = useState<SimResult | null>(null);
  const run = () => setSim(simulateCase(normalizeCase(c), 30000));
  return (
    <>
      <Section title="Doğrulama" hint="Koşulların yazımı, konuşmacılar, deliller ve karar kuralları denetlenir.">
        {errors.length === 0 ? <Text style={st.ok}>✓ Hata yok.</Text> : errors.map((e, i) => <Text key={i} style={st.err}>• {e}</Text>)}
      </Section>
      <Section title="Bütün yolları oyna" hint="Oyuncunun yapabileceği her seçim sırası denenir. Takılan yol, ulaşılamayan adım ya da hiç verilemeyen karar varsa burada görünür."
        right={<SmallBtn label="Denetimi başlat" tone="accent" onPress={run} disabled={errors.length > 0} />}>
        {!sim ? <Text style={st.hint}>Denetimi başlatın.</Text> : (
          <View style={{ gap: 8 }}>
            <Text style={sim.problems.length ? st.err : st.ok}>{sim.problems.length ? `✗ ${sim.problems.length} sorun bulundu` : "✓ Bütün yollar bir kararla bitiyor"}</Text>
            {sim.problems.slice(0, 20).map((p, i) => <Text key={i} style={st.err}>• {p}</Text>)}
            <Text style={st.stat}>{sim.paths.toLocaleString("tr-TR")} farklı yol{sim.truncated ? " (sınırda kesildi)" : ""} · en uzun {sim.maxDepth} hamle · {sim.fatalPaths} yol erken bitiyor</Text>
            <Text style={st.label}>KARARLARIN DAĞILIMI</Text>
            {Object.entries(sim.tally).map(([k, n]) => (
              <View key={k} style={st.barRow}>
                <Text style={st.barLabel}>{k}</Text>
                <View style={st.barTrack}><View style={[st.barFill, { width: `${Math.max(2, (n / sim.paths) * 100)}%` }]} /></View>
                <Text style={st.barNum}>%{Math.round((n / sim.paths) * 100)}</Text>
              </View>
            ))}
            <Text style={st.label}>KARAR KURALLARI</Text>
            {c.outcomes.map((o, i) => (
              <Text key={i} style={sim.byOutcome[i] ? st.stat : st.err}>{sim.byOutcome[i] ? "✓" : "✗ hiç ulaşılmıyor ·"} Kural {i + 1} {o.if ? `[${o.if}]` : "(koşulsuz)"}: {sim.byOutcome[i]} yol</Text>
            ))}
            {sim.unreachedSteps.length > 0 && <Text style={st.err}>Hiç oynanmayan adımlar: {sim.unreachedSteps.join(", ")}</Text>}
          </View>
        )}
      </Section>
      <View style={{ flexDirection: "row" }}><Btn label="▶ Davayı oyna" onPress={onPreview} disabled={errors.length > 0} /></View>
    </>
  );
}

/* ---------- JSON ---------- */
function JsonTab({ c, set }: TabProps) {
  const [text, setText] = useState(() => JSON.stringify(c, null, 2));
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Section title="JSON" hint="Davanın ham hâli. Buradan kopyalayıp saklayabilir ya da başka bir davayı yapıştırıp uygulayabilirsiniz.">
      <TextInput value={text} onChangeText={setText} multiline autoCapitalize="none" autoCorrect={false} style={st.json} />
      <Row>
        <SmallBtn label="Uygula" tone="accent" onPress={() => {
          try { const parsed = normalizeCase(JSON.parse(text)); set(parsed); setMsg("Uygulandı."); }
          catch (e) { setMsg("JSON okunamadı: " + (e as Error).message); }
        }} />
        <SmallBtn label="Güncel hâli yeniden yükle" onPress={() => { setText(JSON.stringify(c, null, 2)); setMsg(null); }} />
      </Row>
      {!!msg && <Text style={msg.startsWith("JSON") ? st.err : st.ok}>{msg}</Text>}
    </Section>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, width: "100%", maxWidth: 1100, alignSelf: "center" },
  head: { flexDirection: "row", alignItems: "flex-end", gap: 12, paddingHorizontal: 16, paddingTop: 14 },
  crumb: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: C.muted },
  title: { fontFamily: F.display, fontSize: 26, color: C.text },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" },
  warn: { fontFamily: F.body, fontSize: 14, color: C.bad, paddingHorizontal: 16, marginTop: 6 },
  warnInline: { fontFamily: F.body, fontSize: 14, color: C.bad },
  tabs: { gap: 6, paddingHorizontal: 16, paddingVertical: 12, alignItems: "center" },
  tab: { alignSelf: "center", borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  tabOn: { backgroundColor: C.brass, borderColor: C.brass },
  tabText: { fontFamily: F.bodyMed, fontSize: 14, color: C.text },
  tabTextOn: { color: C.brassInk },
  body: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  hint: { fontFamily: F.body, fontSize: 13, color: C.muted },
  label: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: C.muted },
  swatch: { width: 40, height: 40, borderRadius: 6, borderWidth: 1, borderColor: C.line, alignSelf: "center" },
  presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  preset: { flexGrow: 1, flexBasis: 220, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, backgroundColor: C.panel2, gap: 2 },
  presetGroup: { fontFamily: F.mono, fontSize: 9, letterSpacing: 1, color: C.muted },
  presetLabel: { fontFamily: F.bodyMed, fontSize: 14, color: C.text },
  lookWrap: { flexDirection: "row", flexWrap: "wrap", gap: 14, alignItems: "flex-start" },
  lookPreview: { width: 110, height: 138, backgroundColor: C.wall, borderRadius: 8, overflow: "hidden" },
  resp: { borderLeftWidth: 3, borderLeftColor: C.brassDim, paddingLeft: 10, gap: 8 },
  respTitle: { fontFamily: F.bodyBold, fontSize: 15, color: C.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chipBtn: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.panel2 },
  chipOn: { backgroundColor: C.brass, borderColor: C.brass },
  chipText: { fontFamily: F.body, fontSize: 13, color: C.text },
  ok: { fontFamily: F.bodyMed, fontSize: 15, color: C.good },
  err: { fontFamily: F.body, fontSize: 14, color: C.bad },
  stat: { fontFamily: F.body, fontSize: 14, color: C.textSoft },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: { fontFamily: F.mono, fontSize: 12, color: C.text, width: 150 },
  barTrack: { flex: 1, height: 10, backgroundColor: C.panel2, borderRadius: 5, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: C.brass },
  barNum: { fontFamily: F.mono, fontSize: 12, color: C.muted, width: 44, textAlign: "right" },
  json: { fontFamily: F.mono, fontSize: 12, color: C.text, backgroundColor: C.wallDeep, borderWidth: 1, borderColor: C.line, borderRadius: 6, padding: 10, minHeight: 420, textAlignVertical: "top" }
});
