// Yönetim paneli · İstatistikler: oynanan davalar (ücretsiz / ücretli içerik), aktif kullanıcı, yeni üye, Pro abone,
// ödeme olayları, en çok oynanan davalar, oyun biçimleri ve üye başına kullanım tablosu (supabase/surum9.sql).
import { kbBar } from "../ui/KeyboardBar";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Chip } from "../ui/kit";
import { C, F } from "../ui/theme";
import { BarChart, fmtNum, HBars, LineChart, SERIES } from "./charts";
import { Section, Seg, SmallBtn } from "./form";
import { demoStats, loadStats, Stats, Unit, UserRow } from "./stats";

type Range = "7" | "30" | "90" | "12";
const MODE_LABEL: Record<string, string> = { kariyer: "Kariyer", solo: "Tek kişilik (antrenman)", duel: "Karşılıklı", tahkim: "Tahkim ve komisyonlar", antrenman: "Antrenman", bilinmiyor: "Bilinmiyor" };
const SRC_LABEL: Record<string, string> = { app_store: "App Store", google_play: "Google Play", manuel: "elle", revenuecat: "RevenueCat", test_store: "test", iyzico: "iyzico" };

const dayLabel = (iso: string, unit: Unit) => {
  const d = new Date(iso + "T12:00:00");
  return unit === "ay" ? d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" }) : d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
};
const dayLong = (iso: string, unit: Unit) => {
  const d = new Date(iso + "T12:00:00");
  return unit === "ay" ? d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" }) : d.toLocaleDateString("tr-TR", { weekday: "short", day: "numeric", month: "long" });
};
const ago = (iso: string | null) => {
  if (!iso) return "—";
  const m = (Date.now() - new Date(iso).getTime()) / 60000;
  return m < 60 ? `${Math.max(1, Math.round(m))} dk önce` : m < 1440 ? `${Math.round(m / 60)} sa önce` : m < 43200 ? `${Math.round(m / 1440)} gün önce` : new Date(iso).toLocaleDateString("tr-TR");
};
const pct = (a: number, b: number) => (b > 0 ? `%${Math.round((a / b) * 100)}` : "—");
const money = (v: number) => `$${v.toFixed(2).replace(".", ",")}`;

export function StatsPanel({ titles, onClose }: { titles: Record<string, string>; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const [unit, setUnit] = useState<Unit>("gun");
  const [range, setRange] = useState<Range>("30");
  const [data, setData] = useState<Stats | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"son" | "oyun">("son");
  const n = unit === "ay" ? 12 : Number(range);

  const load = async () => {
    setBusy(true);
    if (demo) { setData(demoStats(unit, n, Object.keys(titles))); setErr(""); setBusy(false); return; }
    const r = await loadStats(unit, n);
    setBusy(false);
    if (r.error) { setErr(r.error); setData(null); } else { setErr(""); setData(r.data!); }
  };
  useEffect(() => { load(); }, [unit, range, demo]);

  const points = useMemo(() => (data?.series || []).map(r => ({ label: dayLabel(r.donem, unit), long: dayLong(r.donem, unit) })), [data, unit]);
  const users = useMemo(() => {
    const all = (data?.users || []).filter(u => !q || `${u.ad_soyad} ${u.eposta}`.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr")));
    return sort === "oyun" ? [...all].sort((a, b) => b.oyun - a.oyun || (b.son_aktif || "").localeCompare(a.son_aktif || "")) : all;
  }, [data, q, sort]);

  const sm = data?.summary;
  const period = unit === "ay" ? "son 12 ay" : `son ${n} gün`;
  const cols = width >= 900 ? 4 : 2;

  return (
    <Section title="İstatistikler" hint="Oyun kullanımı, üyelik ve gelir. Dönemler İstanbul saatine göre; misafirler cihaz kimliğiyle sayılır. Yönetim panelinden yapılan önizlemeler sayılmaz."
      right={<SmallBtn label="Kapat" onPress={onClose} />}>
      <View style={st.controls}>
        <Seg value={unit} onChange={u => { setUnit(u); if (u === "ay") setRange("12"); else if (range === "12") setRange("30"); }}
          options={[{ v: "gun", label: "Gün" }, { v: "ay", label: "Ay" }]} />
        <Seg value={range} onChange={setRange}
          options={unit === "ay" ? [{ v: "12", label: "12 ay" }] : [{ v: "7", label: "7 gün" }, { v: "30", label: "30 gün" }, { v: "90", label: "90 gün" }]} />
        <View style={st.row}>
          <SmallBtn label="↻ Yenile" onPress={load} disabled={busy} />
          {(demo || !!err) && <SmallBtn label={demo ? "Gerçek veriye dön" : "Örnek veriyle göster"} tone={demo ? "accent" : "plain"} onPress={() => setDemo(!demo)} />}
          {busy && <ActivityIndicator color={C.brass} />}
          {data?.demo && <Chip label="ÖRNEK VERİ · GERÇEK DEĞİL" color={C.mid} />}
        </View>
      </View>
      {!!err && <Text style={st.err}>{err}</Text>}

      {sm && data && (
        <>
          <View style={st.tiles}>
            <Tile cols={cols} k="Oynanan dava" v={fmtNum(sm.oyun)} sub={`${period} · ${pct(sm.bitti, sm.oyun)} tamamlandı`} />
            <Tile cols={cols} k="Ücretli içerik payı" v={pct(sm.oyun_ucretli, sm.oyun)} sub={`${fmtNum(sm.oyun_ucretli)} Pro dosyası oynandı`} />
            <Tile cols={cols} k="Aktif kişi" v={fmtNum(sm.aktif)} sub={`${fmtNum(sm.aktif_uye)} üye · ${fmtNum(sm.misafir)} misafir cihaz`} />
            <Tile cols={cols} k="Yeni üye" v={fmtNum(sm.yeni_uye)} sub={`toplam ${fmtNum(sm.uye)} üye`} />
            <Tile cols={cols} k="Pro abone (şimdi)" v={fmtNum(sm.pro_aktif)} sub={Object.entries(sm.pro_kaynak).map(([k, v]) => `${SRC_LABEL[k] || k} ${v}`).join(" · ") || "—"} />
            <Tile cols={cols} k="Ödeme" v={fmtNum(sm.odeme)} sub={`${money(sm.gelir)} (mağaza fiyatı, USD) · test hariç`} />
            <Tile cols={cols} k="Pro ekranı görüldü" v={fmtNum(sm.paywall)} sub={`${fmtNum(sm.satin_alma)} satın alma · ${pct(sm.satin_alma, sm.paywall)}`} />
            <Tile cols={cols} k="Açık hata bildirimi" v={fmtNum(sm.hata_acik)} sub={`kredi bakiyesi ${fmtNum(sm.kredi_toplam)} · ${fmtNum(sm.danisma)} danışma`} />
          </View>

          <Card title="Oynanan davalar" hint="Başlatılan duruşmalar; turuncu: Celse Pro ile açılan içerik.">
            <BarChart points={points} values={data.series.map(r => [r.oyun_ucretsiz, r.oyun_ucretli])} names={["Ücretsiz", "Ücretli"]} />
          </Card>
          <View style={[st.grid, cols === 4 && { flexDirection: "row" }]}>
            <Card title="Aktif kişi" hint="O dönemde en az bir kez oynayan ya da uygulamayı kullanan." half={cols === 4}>
              <LineChart points={points} values={data.series.map(r => r.aktif)} name="Aktif" />
            </Card>
            <Card title="Yeni üye" half={cols === 4}>
              <BarChart points={points} values={data.series.map(r => [r.yeni_uye])} names={["Yeni üye"]} height={130} />
            </Card>
          </View>
          <View style={[st.grid, cols === 4 && { flexDirection: "row" }]}>
            <Card title="Pro abone" hint="Dönem sonunda aboneliği süren (yaklaşık; abonelik geçmişi tutulmuyor)." half={cols === 4}>
              <LineChart points={points} values={data.series.map(r => r.pro)} name="Pro abone" />
            </Card>
            <Card title="Ödeme olayları" hint="Mağaza bildirimleri (ilk alım, yenileme, kredi). Test (sandbox) olayları hariç." half={cols === 4}>
              <BarChart points={points} values={data.series.map(r => [r.odeme])} names={["Ödeme"]} height={130} />
              {data.series.some(r => r.odeme_test > 0) && <Text style={st.note}>Bu dönemde {data.series.reduce((a, r) => a + r.odeme_test, 0)} test (sandbox) ödemesi de var.</Text>}
            </Card>
          </View>

          <View style={[st.grid, cols === 4 && { flexDirection: "row" }]}>
            <Card title="En çok oynanan davalar" hint={period} half={cols === 4}>
              {data.cases.length ? (
                <HBars rows={data.cases.map(c => ({
                  label: titles[c.dava_id] || c.dava_id, value: c.oyun, tag: c.ucretli ? "PRO" : undefined,
                  sub: `${c.kisi} kişi · ${pct(c.bitti, c.oyun)} tamamlandı · ${pct(c.kazanilan, c.bitti)} kazanıldı${c.ort_puan != null ? ` · ort. ${Math.round(c.ort_puan)} puan` : ""}`
                }))} />
              ) : <Text style={st.note}>Bu dönemde oynanan dava yok.</Text>}
            </Card>
            <Card title="Oyun biçimi" hint={period} half={cols === 4}>
              {data.modes.length ? (
                <HBars color={SERIES[0]} rows={data.modes.map(m => ({
                  label: MODE_LABEL[m.mod] || m.mod, value: m.oyun,
                  sub: `${m.kisi} kişi · ${pct(m.bitti, m.oyun)} tamamlandı${m.ucretli ? ` · ${m.ucretli} ücretli` : ""}`
                }))} />
              ) : <Text style={st.note}>Bu dönemde oyun yok.</Text>}
            </Card>
          </View>

          <Card title="Üyeler" hint={`Oyun sayıları ${period} için; son etkinlik bütün zamanlar.`}>
            <View style={st.row}>
              <TextInput {...kbBar} value={q} onChangeText={setQ} placeholder="Ara: ad, e-posta…" placeholderTextColor={C.muted} style={st.search} />
              <Seg value={sort} onChange={setSort} options={[{ v: "son", label: "Son etkinlik" }, { v: "oyun", label: "Oyun sayısı" }]} />
            </View>
            <Text style={st.note}>{users.length} üye{users.length > 150 ? " · ilk 150 gösteriliyor" : ""}</Text>
            {width >= 700 ? <UserTable rows={users.slice(0, 150)} /> : <UserList rows={users.slice(0, 150)} />}
          </Card>
        </>
      )}
    </Section>
  );
}

function Tile({ k, v, sub, cols }: { k: string; v: string; sub?: string; cols: number }) {
  return (
    <View style={[st.tile, { flexBasis: cols === 4 ? "23%" : "46%" }]}>
      <Text style={st.tileK}>{k}</Text>
      <Text style={st.tileV}>{v}</Text>
      {!!sub && <Text style={st.tileS} numberOfLines={2}>{sub}</Text>}
    </View>
  );
}

function Card({ title, hint, children, half }: { title: string; hint?: string; children: React.ReactNode; half?: boolean }) {
  return (
    <View style={[st.card, half && { flex: 1, minWidth: 0 }]}>
      <Text style={st.cardT}>{title}</Text>
      {!!hint && <Text style={st.cardH}>{hint}</Text>}
      <View style={{ marginTop: 8 }}>{children}</View>
    </View>
  );
}

const COLS: { k: string; w: number; right?: boolean }[] = [
  { k: "Üye", w: 210 }, { k: "Oyun", w: 54, right: true }, { k: "Bitti", w: 50, right: true }, { k: "Ücretli", w: 60, right: true },
  { k: "Son etkinlik", w: 100 }, { k: "Pro", w: 92 }, { k: "Kredi", w: 50, right: true }, { k: "Kariyer", w: 92, right: true }
];
/** Telefonda: her üye iki satır (ad ve sayılar; e-posta ve durum). */
function UserList({ rows }: { rows: UserRow[] }) {
  return (
    <View>
      {rows.map(u => (
        <View key={u.kullanici_id} style={st.ur}>
          <View style={st.urTop}>
            <Text style={[st.tdName, { flex: 1, minWidth: 0 }]} numberOfLines={1}>{u.ad_soyad || "(adsız)"}</Text>
            <Text style={st.td}>{u.oyun}<Text style={st.tdSub}> oyun</Text></Text>
            <Text style={[st.tdSub, { width: 78, textAlign: "right" }]}>{ago(u.son_aktif)}</Text>
          </View>
          <View style={st.urTop}>
            <Text style={[st.tdSub, { flex: 1, minWidth: 0 }]} numberOfLines={1}>{u.eposta}</Text>
            {u.pro && <Text style={[st.tdSub, { color: C.good }]}>Pro · {SRC_LABEL[u.pro_kaynak || ""] || u.pro_kaynak}</Text>}
            {u.kredi > 0 && <Text style={st.tdSub}>{u.kredi} kredi</Text>}
            <Text style={st.tdSub}>{u.kariyer_dava} dava · {u.kariyer_puan} p</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function UserTable({ rows }: { rows: UserRow[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexDirection: "column" }}>
      <View style={[st.tr, st.th]}>
        {COLS.map(c => <Text key={c.k} style={[st.thT, { width: c.w }, c.right && { textAlign: "right" }]}>{c.k}</Text>)}
      </View>
      {rows.map(u => (
        <View key={u.kullanici_id} style={st.tr}>
          <View style={{ width: COLS[0].w }}>
            <Text style={st.tdName} numberOfLines={1}>{u.ad_soyad || "(adsız)"}</Text>
            <Text style={st.tdSub} numberOfLines={1}>{u.eposta}</Text>
          </View>
          <Text style={[st.td, { width: COLS[1].w, textAlign: "right" }]}>{u.oyun}</Text>
          <Text style={[st.td, { width: COLS[2].w, textAlign: "right" }]}>{u.bitti}</Text>
          <Text style={[st.td, { width: COLS[3].w, textAlign: "right" }]}>{u.ucretli}</Text>
          <Text style={[st.tdSub, { width: COLS[4].w }]}>{ago(u.son_aktif)}</Text>
          <View style={{ width: COLS[5].w }}>
            {u.pro ? <Text style={[st.td, { color: C.good }]}>✓ {SRC_LABEL[u.pro_kaynak || ""] || u.pro_kaynak}</Text> : <Text style={st.tdSub}>—</Text>}
          </View>
          <Text style={[st.td, { width: COLS[6].w, textAlign: "right" }]}>{u.kredi || "—"}</Text>
          <Text style={[st.tdSub, { width: COLS[7].w, textAlign: "right" }]}>{u.kariyer_dava} dava · {u.kariyer_puan}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  controls: { gap: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  err: { fontFamily: F.body, fontSize: 14, color: C.bad },
  note: { fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 4 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { flexGrow: 1, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, gap: 2 },
  tileK: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1, color: C.muted, textTransform: "uppercase" },
  tileV: { fontFamily: F.monoBold, fontSize: 24, color: C.text },
  tileS: { fontFamily: F.body, fontSize: 12, color: C.muted },
  grid: { gap: 10 },
  card: { backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 12 },
  cardT: { fontFamily: F.displayMed, fontSize: 16, color: C.text },
  cardH: { fontFamily: F.body, fontSize: 12, color: C.muted, marginTop: 2 },
  search: { flexGrow: 1, flexBasis: 200, fontFamily: F.body, fontSize: 15, color: C.text, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  ur: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line, gap: 2 },
  urTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  tr: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.line },
  th: { paddingVertical: 5 },
  thT: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1, color: C.muted, textTransform: "uppercase" },
  td: { fontFamily: F.mono, fontSize: 13, color: C.text },
  tdName: { fontFamily: F.bodyMed, fontSize: 14, color: C.text },
  tdSub: { fontFamily: F.body, fontSize: 12, color: C.muted }
});
