// Yönetim paneli: giriş, dava listesi, yeni dava sihirbazı, içe aktarma ve düzenleyici.
import { SamplesPanel } from "./SamplesPanel";
import { DIFFICULTY, levelOf } from "../data/career";
import { setAdminPreview } from "../data/subscription";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useDavalar } from "../data/davalar";
import { normalizeCase, validateCase } from "../engine/engine";
import { CaseFile } from "../engine/types";
import { Btn, Chip } from "../ui/kit";
import { C, F } from "../ui/theme";
import { AuditPanel, GeneratePanel } from "./AiPanels";
import { PlayersPanel } from "./PlayersPanel";
import { TranslatePanel } from "./TranslatePanel";
import { SettingsPanel } from "./SettingsPanel";
import { StatsPanel, YuzIstat } from "./StatsPanel";
import { TakipIstat } from "./TakipIstat";
import { MevzuatArsivi } from "./MevzuatArsivi";
import { MessagesPanel, ReportsPanel } from "./InboxPanels";
import CaseEditor from "./CaseEditor";
import { Field, Row, Section, Seg, SmallBtn } from "./form";
import { VisualAuditPanel } from "./VisualAuditPanel";
import { DuzeltmeSohbeti } from "./DuzeltmeSohbeti";
import { blankCase, CourtPreset, PRESETS } from "./presets";
import { clearPin, getPin, resetAdminCache, serverAdmin, setPin, Status, store, StoredCase } from "./store";
import { onAccountChange } from "../data/account";
import { useInnerBack } from "../ui/innerBack";
import { FloatingNav, useFloatingNav } from "../ui/FloatingNav";
import { HomePage, useGorunenYuzler, useHomePage, yuzAdi } from "../ui/homePage";

interface Props { onExit: () => void; onPreview: (c: CaseFile) => void; /** Derdini anlat yüzü: evrak provası */ onEvrak?: () => void; /** Dava takibi yüzü: föyler */ onFoy?: () => void }

type Entry = { c: CaseFile; status: Status | "yerlesik"; updatedAt?: string; builtIn: boolean; overridden: boolean };

// Oturum boyunca bir kez PIN sorulur (önizlemeden dönüşte tekrar sorulmaz).
let sessionUnlocked = false;

export default function AdminScreen(props: Props) {
  const { onExit } = props;
  const [unlocked, setUnlocked] = useState(sessionUnlocked);
  if (!unlocked) return <PinGate onOk={() => { sessionUnlocked = true; setAdminPreview(true); setUnlocked(true); }} onExit={onExit} />;
  return <AdminHome {...props} />;
}

/* ---------- Giriş ---------- */
function PinGate({ onOk, onExit }: { onOk: () => void; onExit: () => void }) {
  const [stored, setStored] = useState<string | null | undefined>(undefined);
  const [a, setA] = useState(""), [b, setB] = useState(""), [err, setErr] = useState("");
  useEffect(() => { getPin().then(setStored); }, []);
  if (stored === undefined) return <View style={st.center} />;
  const creating = stored === null;
  const submit = async () => {
    if (creating) {
      if (!/^\d{4,8}$/.test(a)) return setErr("PIN 4 ile 8 rakam arasında olmalı.");
      if (a !== b) return setErr("İki PIN aynı değil.");
      await setPin(a); onOk();
    } else {
      if (a === stored) onOk(); else setErr("PIN yanlış.");
    }
  };
  return (
    <View style={st.center}>
      <View style={st.gate}>
        <Text style={st.gateTitle}>Yönetim paneli</Text>
        <Text style={st.gateText}>{creating ? "İlk girişte bu cihaz için bir PIN belirleyin." : "Devam etmek için PIN'inizi girin."}</Text>
        <TextInput value={a} onChangeText={t => { setA(t); setErr(""); }} placeholder="PIN" placeholderTextColor={C.muted} secureTextEntry keyboardType="number-pad" style={st.pin} onSubmitEditing={submit} />
        {creating && <TextInput value={b} onChangeText={t => { setB(t); setErr(""); }} placeholder="PIN (tekrar)" placeholderTextColor={C.muted} secureTextEntry keyboardType="number-pad" style={st.pin} onSubmitEditing={submit} />}
        {!!err && <Text style={st.err}>{err}</Text>}
        <View style={st.gateActions}>
          <Btn kind="ghost" label="Vazgeç" onPress={onExit} />
          <Btn label={creating ? "PIN'i kaydet ve gir" : "Giriş"} onPress={submit} />
        </View>
        {!creating && (
          <Pressable accessibilityRole="button" onPress={async () => {
            // PIN yalnızca bu cihazda tutulur; sunucuda yönetici olarak giriş yapmış kişi onu sıfırlayıp yenisini belirleyebilir.
            resetAdminCache();
            if (await serverAdmin()) { await clearPin(); setStored(null); setA(""); setB(""); setErr(""); }
            else setErr("PIN'i sıfırlamak için önce oyunda yönetici hesabınızla giriş yapın (şifrenizi unuttuysanız Giriş yap › Şifremi unuttum).");
          }}><Text style={st.forgot}>PIN'imi unuttum</Text></Pressable>
        )}
        <Text style={st.gateNote}>Bu PIN yalnızca bu cihazı korur. Unutursanız yönetici hesabınızla giriş yapıp "PIN'imi unuttum" ile yenisini belirleyebilirsiniz.</Text>
      </View>
    </View>
  );
}

/* ---------- Liste ---------- */
function AdminHome({ onExit, onPreview, onEvrak, onFoy }: Props) {
  const [stored, setStored] = useState<StoredCase[]>([]);
  const CASES = useDavalar();
  const [editing, setEditing] = useState<{ c: CaseFile; status: Entry["status"]; isNew: boolean } | null>(null);
  const [wizard, setWizard] = useState(false);
  const [importing, setImporting] = useState(false);
  const [q, setQ] = useState("");
  const [modeF, setModeF] = useState<"hepsi" | "solo" | "duel">("hepsi");
  const [statusF, setStatusF] = useState<"hepsi" | "yayinda" | "taslak" | "yerlesik">("hepsi");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [ai, setAi] = useState<"" | "denetim" | "uretim" | "oyuncular" | "ceviri" | "ayarlar" | "istatistik" | "mesajlar" | "hatalar" | "ornek" | "gorsel" | "sohbet" | "mevzuat">("");
  const [isServerAdmin, setServerAdmin] = useState<boolean | null>(null);
  // Yönetim paneli de ön yüz gibi üç yüze ayrılır: ortak araçlar (istatistik, oyuncular, mesajlar…) üçünde, diğerleri ilgili yüzde.
  const [yuzler] = useGorunenYuzler();
  const [anaYuz] = useHomePage();
  const [yuz, setYuzRaw] = useState<HomePage>(anaYuz);
  const setYuz = (h: HomePage) => { setYuzRaw(h); setAi(""); setWizard(false); setImporting(false); };
  const yuzNe = yuzler.includes(yuz) ? yuz : yuzler[0];
  const reload = () => store.list().then(setStored);
  // Tarayıcının geri düğmesi / Android geri tuşu: önce açık olan alt sayfayı kapatır (düzenleyici, panel, yeni dava, içe aktarma).
  useInnerBack(!!ai, () => setAi(""));
  useInnerBack(wizard, () => setWizard(false));
  useInnerBack(importing, () => setImporting(false));
  useInnerBack(!!editing, () => { setEditing(null); reload(); });
  const nav = useFloatingNav();
  // Dava listesi sayfa sayfa gösterilir: sayfa başına 5, 10, 25, 50 ya da 100 dosya (tercih bu tarayıcıda hatırlanır).
  const [perPage, setPerPageRaw] = useState<number>(() => { try { const v = Number(globalThis.localStorage?.getItem("celse-yonetim-sayfa")); return [5, 10, 25, 50, 100].includes(v) ? v : 25; } catch { return 25; } });
  const setPerPage = (n: number) => { setPerPageRaw(n); setPage(0); try { globalThis.localStorage?.setItem("celse-yonetim-sayfa", String(n)); } catch { /* yok say */ } };
  const [page, setPage] = useState(0);
  const listY = React.useRef(0);
  useEffect(() => { setPage(0); }, [q, modeF, statusF]);
  // Yönetici denetimi oturum yüklendikten sonra ve hesap her değiştiğinde yeniden yapılır (sayfa oturumdan önce açılırsa
  // ilk denetim "yönetici değil" sonucunu önbelleğe alıyordu).
  useEffect(() => {
    const check = () => { resetAdminCache(); serverAdmin().then(v => { setServerAdmin(v); reload(); }); };
    reload(); check();
    return onAccountChange(check);
  }, []);

  const entries: Entry[] = useMemo(() => {
    const byId = new Map(stored.map(s => [s.case.id, s]));
    const list: Entry[] = CASES.map(b => {
      const s = byId.get(b.id);
      return s ? { c: s.case, status: s.status, updatedAt: s.updatedAt, builtIn: true, overridden: true } : { c: b, status: "yerlesik", builtIn: true, overridden: false };
    });
    stored.filter(s => !CASES.some(b => b.id === s.case.id)).forEach(s => list.unshift({ c: s.case, status: s.status, updatedAt: s.updatedAt, builtIn: false, overridden: false }));
    return list;
  }, [stored, CASES]);

  const shown = entries.filter(e =>
    (modeF === "hepsi" || e.c.mode === modeF) &&
    (statusF === "hepsi" || e.status === statusF) &&
    (!q || `${e.c.title} ${e.c.court} ${e.c.area} ${e.c.id}`.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr"))));

  const pages = Math.max(1, Math.ceil(shown.length / perPage));
  const cur = Math.min(page, pages - 1);
  const pageItems = shown.slice(cur * perPage, cur * perPage + perPage);
  const goPage = (p: number) => { setPage(Math.max(0, Math.min(pages - 1, p))); nav.ref.current?.scrollTo({ y: Math.max(0, listY.current - 8), animated: false }); };
  const Pager = ({ size }: { size?: boolean }) => (
    <View style={st.pager}>
      {size && <Seg label="Sayfada gösterilecek dosya" value={String(perPage)} onChange={v => setPerPage(Number(v))} options={[5, 10, 25, 50, 100].map(n => ({ v: String(n), label: `${n}'li` }))} />}
      <View style={st.pagerNav}>
        <SmallBtn label="« İlk" onPress={() => goPage(0)} />
        <SmallBtn label="‹ Önceki" onPress={() => goPage(cur - 1)} />
        <Text style={st.pagerT}>Sayfa {cur + 1} / {pages} · {shown.length ? `${cur * perPage + 1}–${Math.min(shown.length, (cur + 1) * perPage)}` : 0} / {shown.length} dava</Text>
        <SmallBtn label="Sonraki ›" onPress={() => goPage(cur + 1)} />
        <SmallBtn label="Son »" onPress={() => goPage(pages - 1)} />
      </View>
    </View>
  );

  const counts = { toplam: entries.length, yayinda: entries.filter(e => e.status === "yayinda").length, taslak: entries.filter(e => e.status === "taslak").length };
  const takenIds = entries.map(e => e.c.id);
  const titles = useMemo(() => Object.fromEntries(entries.map(e => [e.c.id, e.c.title])), [entries]);

  if (editing) {
    return (
      <CaseEditor initial={editing.c} status={editing.status} isNew={editing.isNew} takenIds={takenIds}
        onClose={() => { setEditing(null); reload(); }}
        onPreview={onPreview}
        onSave={async (c, status) => { await store.save(c, status); setEditing({ c, status, isNew: false }); reload(); }} />
    );
  }

  return (
    <View style={{ flex: 1 }}>
    <ScrollView ref={nav.ref} onScroll={nav.onScroll} scrollEventThrottle={64} contentContainerStyle={st.wrap} keyboardShouldPersistTaps="handled">
      <View style={st.head}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Text style={st.crumb}>CELSE · YÖNETİM · {yuzAdi(yuzNe).toLocaleUpperCase("tr")}</Text>
          <Text style={st.title}>{yuzNe === "oyun" ? "Dava dosyaları" : yuzAdi(yuzNe)}</Text>
          {yuzNe === "oyun" && <Text style={st.sub}>{counts.toplam} dava · {counts.yayinda} yayında · {counts.taslak} taslak</Text>}
        </View>
      </View>
      {yuzler.length > 1 && (
        <View style={st.yuzBar} accessibilityRole="tablist">
          {yuzler.map(h => (
            <SmallBtn key={h} label={yuzAdi(h)} tone={yuzNe === h ? "accent" : "plain"} onPress={() => setYuz(h)} />
          ))}
        </View>
      )}
      <View style={[st.headActions, { justifyContent: "flex-start" }]}>
        <SmallBtn label="‹ Ön sayfaya dön" onPress={onExit} />
        <Text style={st.grupT}>ORTAK</Text>
        <SmallBtn label="📊 İstatistikler" tone={ai === "istatistik" ? "accent" : "plain"} onPress={() => setAi(ai === "istatistik" ? "" : "istatistik")} />
        <SmallBtn label={yuzNe === "oyun" ? "👤 Oyuncular" : "👤 Kullanıcılar"} tone={ai === "oyuncular" ? "accent" : "plain"} onPress={() => setAi(ai === "oyuncular" ? "" : "oyuncular")} />
        <SmallBtn label="✉️ Duyuru ve mesajlar" tone={ai === "mesajlar" ? "accent" : "plain"} onPress={() => setAi(ai === "mesajlar" ? "" : "mesajlar")} />
        {yuzNe !== "takip" && <SmallBtn label="⚑ Hata bildirimleri" tone={ai === "hatalar" ? "accent" : "plain"} onPress={() => setAi(ai === "hatalar" ? "" : "hatalar")} />}
        {yuzNe === "oyun" && <SmallBtn label="💬 Düzeltme sohbeti" tone={ai === "sohbet" ? "accent" : "plain"} onPress={() => setAi(ai === "sohbet" ? "" : "sohbet")} />}
        <SmallBtn label="⚙️ Ayarlar" tone={ai === "ayarlar" ? "accent" : "plain"} onPress={() => setAi(ai === "ayarlar" ? "" : "ayarlar")} />
      </View>
      <View style={[st.headActions, { justifyContent: "flex-start" }]}>
        <Text style={st.grupT}>{yuzAdi(yuzNe).toLocaleUpperCase("tr")}</Text>
        {yuzNe === "danisma" && <SmallBtn label="📂 Örnek olaylar" tone={ai === "ornek" ? "accent" : "plain"} onPress={() => setAi(ai === "ornek" ? "" : "ornek")} />}
        {yuzNe === "danisma" && !!onEvrak && <SmallBtn label="📄 Evrakla duruşma provası" onPress={onEvrak} />}
        {yuzNe === "takip" && !!onFoy && <SmallBtn label="📁 Föylerim" onPress={onFoy} />}
        {yuzNe === "takip" && <SmallBtn label="📚 Mevzuat ve içtihat arşivi" tone={ai === "mevzuat" ? "accent" : "plain"} onPress={() => setAi(ai === "mevzuat" ? "" : "mevzuat")} />}
        {yuzNe === "oyun" && <>
          <SmallBtn label="🎭 Görsel denetim" tone={ai === "gorsel" ? "accent" : "plain"} onPress={() => setAi(ai === "gorsel" ? "" : "gorsel")} />
          <SmallBtn label="🔍 Yapay zekâ denetimi" tone={ai === "denetim" ? "accent" : "plain"} onPress={() => setAi(ai === "denetim" ? "" : "denetim")} />
          <SmallBtn label="✨ Yapay zekâ ile üret" tone={ai === "uretim" ? "accent" : "plain"} onPress={() => setAi(ai === "uretim" ? "" : "uretim")} />
          <SmallBtn label="🌐 Çeviriler" tone={ai === "ceviri" ? "accent" : "plain"} onPress={() => setAi(ai === "ceviri" ? "" : "ceviri")} />
          <SmallBtn label="JSON içe aktar" onPress={() => setImporting(!importing)} />
          <SmallBtn label="+ Yeni dava" tone="accent" onPress={() => setWizard(!wizard)} />
        </>}
      </View>
      {yuzNe === "takip" && <Text style={st.sub}>Föyler avukatın cihazında ve bulutta uçtan uca şifreli durur; sunucuda föy içeriği okunamaz. Kimin dava takibini kullanabileceğini “Kullanıcılar”daki Celse Avukat paketi ve “Ayarlar”daki satış anahtarı belirler. İstatistikler yalnız sayıdır: kullanıcı, büro, eşitleme, yapay zekâ kullanımı.</Text>}
      {yuzNe === "danisma" && <Text style={st.sub}>Derdini anlat kredileri ve evrak provası izinleri “Kullanıcılar”da; örnek dosyaya dönüştürülecek olaylar “Örnek olaylar”da.</Text>}

      <Text style={[st.sub, { fontSize: 13 }, isServerAdmin === false && { color: C.bad }]}>
        {isServerAdmin === null ? "Sunucu yetkisi denetleniyor…"
          : isServerAdmin ? (yuzNe === "oyun" ? "Sunucu: yönetici ✓ · Yayınladığınız dosyalar bütün oyunculara gider; yapay zekâ araçları açık." : "Sunucu: yönetici ✓ · Kullanıcı bilgileri ve istatistikler açık.")
          : "Sunucu: bu hesap yönetici değil ya da sunucuya ulaşılamıyor. Değişiklikler yalnızca bu cihazda kalır; yapay zekâ araçları çalışmaz. (Yönetici hesabınızla “Giriş yap” ile girin.)"}
      </Text>

      {ai === "istatistik" && (yuzNe === "oyun" ? <StatsPanel titles={titles} onClose={() => setAi("")} /> : yuzNe === "takip" ? <TakipIstat onClose={() => setAi("")} /> : <YuzIstat yuz={yuzNe} onClose={() => setAi("")} />)}
      {ai === "mesajlar" && <MessagesPanel onClose={() => setAi("")} />}
      {ai === "mevzuat" && <MevzuatArsivi onClose={() => setAi("")} />}
      {ai === "hatalar" && <ReportsPanel titles={titles} onClose={() => setAi("")}
        onOpenCase={id => { const e = entries.find(x => x.c.id === id); if (!e) return false; setEditing({ c: e.c, status: e.status, isNew: false }); return true; }} />}
      {ai === "ornek" && <SamplesPanel onClose={() => setAi("")} />}
      {ai === "oyuncular" && <PlayersPanel yuz={yuzNe} onClose={() => setAi("")} />}
      {ai === "ayarlar" && <SettingsPanel onClose={() => setAi("")} />}
      {ai === "ceviri" && <TranslatePanel cases={entries.map(e => e.c)} onClose={() => setAi("")} />}
      {ai === "sohbet" && <DuzeltmeSohbeti entries={entries} onSaved={reload} onClose={() => setAi("")} />}
      {ai === "gorsel" && <VisualAuditPanel cases={entries.map(e => e.c)} onClose={() => setAi("")}
        onOpenCase={id => { const e = entries.find(x => x.c.id === id); if (e) setEditing({ c: e.c, status: e.status, isNew: false }); }} />}
      {ai === "denetim" && <AuditPanel entries={entries} onSaved={reload} onPreview={onPreview} onClose={() => setAi("")} />}
      {ai === "uretim" && <GeneratePanel takenIds={takenIds} onSaved={reload} onPreview={onPreview} onClose={() => setAi("")}
        onEdit={c => { setAi(""); setEditing({ c, status: "taslak", isNew: false }); }} />}

      {wizard && <NewCaseWizard takenIds={takenIds} onCancel={() => setWizard(false)} onCreate={c => { setWizard(false); setEditing({ c, status: "taslak", isNew: true }); }} />}
      {importing && <ImportBox takenIds={takenIds} onDone={() => { setImporting(false); reload(); }} />}

      {yuzNe === "oyun" && <>
      <View style={st.filters}>
        <TextInput value={q} onChangeText={setQ} placeholder="Ara: başlık, mahkeme, alan…" placeholderTextColor={C.muted} style={st.search} />
        <Seg value={modeF} onChange={setModeF} options={[{ v: "hepsi", label: "Tüm modlar" }, { v: "solo", label: "Tek kişilik" }, { v: "duel", label: "Karşılıklı" }]} />
        <Seg value={statusF} onChange={setStatusF} options={[{ v: "hepsi", label: "Tüm durumlar" }, { v: "yayinda", label: "Yayında" }, { v: "taslak", label: "Taslak" }, { v: "yerlesik", label: "Uygulamayla gelen" }]} />
      </View>

      <View style={{ gap: 8 }} onLayout={ev => { listY.current = ev.nativeEvent.layout.y; }}>
        <Pager size />
        {pageItems.map(e => {
          const errs = validateCase(e.c).length;
          return (
            <View key={e.c.id} style={st.row}>
              <View style={[st.colorBar, { backgroundColor: e.c.color }]} />
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <View style={st.rowTop}>
                  <Text style={st.rowTitle} numberOfLines={1}>{e.c.title}</Text>
                  <Chip label={e.status === "yayinda" ? "YAYINDA" : e.status === "taslak" ? "TASLAK" : "UYGULAMAYLA GELEN"} color={e.status === "yayinda" ? C.good : e.status === "taslak" ? C.brass : C.muted} />
                  <Chip label={e.c.mode === "duel" ? "KARŞILIKLI" : "TEK KİŞİLİK"} color={C.p1} />
                  {errs > 0 && <Chip label={`${errs} HATA`} color={C.bad} />}
                  {e.overridden && <Chip label="DÜZENLENMİŞ" color={C.p2} />}
                </View>
                <Text style={st.rowMeta} numberOfLines={1}>{e.c.court} · {e.c.area} · {e.c.steps.length} adım{e.c.bench && e.c.bench.judges > 1 ? ` · ${e.c.bench.judges} hâkim` : ""}{e.c.difficulty ? ` · ${DIFFICULTY[e.c.difficulty].label}` : ""}{e.c.mode === "solo" ? (e.c.career?.off ? " · kariyer dışı" : ` · Kariyer ${levelOf(e.c)}${e.c.career?.order ? "." + e.c.career.order : ""}`) : ""}</Text>
                {e.updatedAt && <Text style={st.rowDate}>Son değişiklik: {new Date(e.updatedAt).toLocaleString("tr-TR")}</Text>}
              </View>
              <View style={st.rowActions}>
                <SmallBtn label="Düzenle" tone="accent" onPress={() => setEditing({ c: e.c, status: e.status, isNew: false })} />
                <SmallBtn label="▶ Oyna" onPress={() => onPreview(e.c)} disabled={errs > 0} />
                <SmallBtn label="Çoğalt" onPress={() => {
                  let id = `${e.c.id}-kopya`, n = 2; while (takenIds.includes(id)) id = `${e.c.id}-kopya-${n++}`;
                  setEditing({ c: { ...e.c, id, title: `${e.c.title} (kopya)` }, status: "taslak", isNew: true });
                }} />
                {e.status === "yayinda" && <SmallBtn label="Taslağa al" onPress={async () => { await store.save(e.c, "taslak"); reload(); }} />}
                {e.status === "taslak" && errs === 0 && <SmallBtn label="Yayınla" onPress={async () => { await store.save(e.c, "yayinda"); reload(); }} />}
                {(e.status === "yayinda" || e.status === "taslak") && (
                  confirmDel === e.c.id
                    ? <SmallBtn label={e.builtIn ? "Evet, ilk hâline dön" : "Evet, sil"} tone="danger" onPress={async () => { await store.remove(e.c.id); setConfirmDel(null); reload(); }} />
                    : <SmallBtn label={e.builtIn ? "Değişiklikleri geri al" : "Sil"} tone="danger" onPress={() => setConfirmDel(e.c.id)} />
                )}
              </View>
            </View>
          );
        })}
        {shown.length === 0 && <Text style={st.sub}>Bu filtreye uyan dava yok.</Text>}
        {pageItems.length > 4 && <Pager />}
      </View>

      <Section title="Nasıl çalışır?">
        <Text style={st.help}>• <Text style={st.helpB}>Taslak:</Text> Yalnızca bu panelde görünür; “Oyna” ile denenebilir.</Text>
        <Text style={st.help}>• <Text style={st.helpB}>Yayında:</Text> Oyunun dosya dolabında görünür. Hata içeren dava yayınlanamaz.</Text>
        <Text style={st.help}>• <Text style={st.helpB}>Uygulamayla gelen:</Text> Uygulamanın içindeki davalar. Düzenleyip yayınlarsanız sizin sürümünüz geçerli olur; “Değişiklikleri geri al” ile ilk hâline döner.</Text>
        <Text style={st.help}>• <Text style={st.helpB}>Saklama:</Text> Sunucuda yönetici olarak girdiyseniz dosyalar sunucuda saklanır ve yayındakiler bütün oyunculara gider; değilse yalnızca bu cihazda kalır.</Text>
        <Text style={st.help}>• <Text style={st.helpB}>Yapay zekâ denetimi:</Text> Dosyaları hukuki doğruluk, puanlama, tutarlılık ve yazım yönünden inceler. Bulunan sorunlar listelenir; yalnızca seçip onayladığınız düzeltmeler uygulanır, dosya motorla sınanır ve onayınızla yayınlanır.</Text>
        <Text style={st.help}>• <Text style={st.helpB}>Yapay zekâ ile üret:</Text> Branş, mahkeme, zorluk ve konu seçerek yeni dosya yazdırırsınız. Dosya taslak olarak kaydedilir; oynayıp beğenirseniz yayınlarsınız.</Text>
      </Section>
      </>}
    </ScrollView>
    <FloatingNav nav={nav} onBack={ai ? () => setAi("") : onExit} backLabel={ai ? "‹ Panelleri kapat" : "‹ Ön sayfaya dön"} />
    </View>
  );
}

/* ---------- Yeni dava sihirbazı ---------- */
function NewCaseWizard({ takenIds, onCancel, onCreate }: { takenIds: string[]; onCancel: () => void; onCreate: (c: CaseFile) => void }) {
  const [mode, setMode] = useState<"solo" | "duel">("solo");
  const [preset, setPreset] = useState<CourtPreset>(PRESETS[0]);
  const [id, setId] = useState("");
  const clash = takenIds.includes(id);
  const groups = [...new Set(PRESETS.map(p => p.group))];
  return (
    <Section title="Yeni dava" hint="Mod ve mahkemeyi seçin. Dava, düzenlemeye hazır bir taslak olarak açılır.">
      <Seg label="Mod" value={mode} onChange={setMode} options={[{ v: "solo", label: "Tek kişilik" }, { v: "duel", label: "Karşılıklı duruşma" }]} />
      {groups.map(g => (
        <View key={g} style={{ gap: 6 }}>
          <Text style={st.label}>{g.toLocaleUpperCase("tr")}</Text>
          <View style={st.presetGrid}>
            {PRESETS.filter(p => p.group === g).map(p => (
              <Pressable key={p.key} onPress={() => setPreset(p)} style={[st.preset, preset.key === p.key && st.presetOn]} accessibilityRole="radio" accessibilityState={{ checked: preset.key === p.key }}>
                <Text style={[st.presetLabel, preset.key === p.key && { color: C.brassInk }]}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      <Row>
        <Field label="Kimlik" value={id} onChange={v => setId(v.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} mono placeholder="ör. danistay-ihale-iptali" hint={clash ? "Bu kimlik kullanılıyor." : "Küçük harf, rakam ve tire."} />
      </Row>
      <Row>
        <SmallBtn label="Vazgeç" onPress={onCancel} />
        <SmallBtn label="Taslağı oluştur" tone="accent" disabled={!id || clash} onPress={() => onCreate(blankCase(id, mode, preset))} />
      </Row>
    </Section>
  );
}

/* ---------- JSON içe aktarma ---------- */
function ImportBox({ takenIds, onDone }: { takenIds: string[]; onDone: () => void }) {
  const [text, setText] = useState("");
  const [report, setReport] = useState<string[]>([]);
  const run = async () => {
    const out: string[] = [];
    try {
      const raw = JSON.parse(text);
      const list: CaseFile[] = (Array.isArray(raw) ? raw : [raw]).map(normalizeCase);
      for (const c of list) {
        const errs = validateCase(c);
        await store.save(c, "taslak");
        out.push(`${errs.length ? "⚠" : "✓"} ${c.id}${takenIds.includes(c.id) ? " (mevcut davanın yerine taslak olarak)" : ""}${errs.length ? ` · ${errs.length} hata, Denetim sekmesine bakın` : ""}`);
      }
      out.push("Davalar taslak olarak kaydedildi. Kontrol edip yayınlayabilirsiniz.");
    } catch (e) { out.push("JSON okunamadı: " + (e as Error).message); }
    setReport(out);
  };
  return (
    <Section title="JSON içe aktar" hint="Tek bir dava ya da dava listesi yapıştırın. İçe aktarılan davalar taslak olarak kaydedilir.">
      <TextInput value={text} onChangeText={setText} multiline placeholder='{"id": "...", "title": "...", ...}' placeholderTextColor={C.muted} style={st.json} autoCapitalize="none" autoCorrect={false} />
      <Row>
        <SmallBtn label="İçe aktar" tone="accent" onPress={run} disabled={!text.trim()} />
        <SmallBtn label="Kapat" onPress={onDone} />
      </Row>
      {report.map((r, i) => <Text key={i} style={r.startsWith("JSON") ? st.err : st.help}>{r}</Text>)}
    </Section>
  );
}

const st = StyleSheet.create({
  pager: { gap: 8, paddingVertical: 4 },
  pagerNav: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  pagerT: { fontFamily: F.bodyMed, fontSize: 13, color: C.muted },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  gate: { width: "100%", maxWidth: 420, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 22, gap: 10 },
  gateTitle: { fontFamily: F.display, fontSize: 26, color: C.brass },
  gateText: { fontFamily: F.body, fontSize: 16, color: C.text },
  forgot: { fontFamily: F.bodyMed, fontSize: 14, color: C.p1, textAlign: "center", padding: 6 },
  gateNote: { fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 6 },
  gateActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
  pin: { fontFamily: F.mono, fontSize: 20, letterSpacing: 6, color: C.text, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10 },
  err: { fontFamily: F.body, fontSize: 14, color: C.bad },
  wrap: { width: "100%", maxWidth: 1100, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 18, gap: 14 },
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: 12 },
  headActions: { flexDirection: "row", flexWrap: "wrap", gap: 6, flexShrink: 1, alignItems: "center" },
  yuzBar: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line, marginBottom: 4 },
  grupT: { fontFamily: F.mono, fontSize: 11, letterSpacing: 2, color: C.muted, marginLeft: 6 },
  crumb: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: C.muted },
  title: { fontFamily: F.display, fontSize: 30, color: C.brass },
  sub: { fontFamily: F.body, fontSize: 15, color: C.muted },
  filters: { gap: 8 },
  search: { fontFamily: F.body, fontSize: 16, color: C.text, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 10 },
  colorBar: { width: 6, alignSelf: "stretch", borderRadius: 3 },
  rowTop: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  rowTitle: { fontFamily: F.displayMed, fontSize: 18, color: C.text, flexShrink: 1 },
  rowMeta: { fontFamily: F.body, fontSize: 14, color: C.muted },
  rowDate: { fontFamily: F.mono, fontSize: 11, color: C.muted },
  rowActions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  help: { fontFamily: F.body, fontSize: 15, color: C.textSoft, lineHeight: 22 },
  helpB: { fontFamily: F.bodyBold, color: C.text },
  label: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: C.muted },
  presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  preset: { flexGrow: 1, flexBasis: 220, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, backgroundColor: C.panel2 },
  presetOn: { backgroundColor: C.brass, borderColor: C.brass },
  presetLabel: { fontFamily: F.bodyMed, fontSize: 14, color: C.text },
  json: { fontFamily: F.mono, fontSize: 12, color: C.text, backgroundColor: C.wallDeep, borderWidth: 1, borderColor: C.line, borderRadius: 6, padding: 10, minHeight: 160, textAlignVertical: "top" }
});
