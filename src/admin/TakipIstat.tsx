// Yönetim paneli · Dava takibi istatistikleri (supabase/surum19.sql: istat_takip). Yalnız sayılar: kullanıcı, avukat paketi,
// bulut eşitlemesi, buluttaki föy, büro ve ünvanlar, yapay zekâ kullanımı. Föylerin içeriği şifrelidir; burada yoktur.
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { supabase } from "../data/account";
import { C, F } from "../ui/theme";
import { BarChart, fmtNum, HBars } from "./charts";
import { Section, Seg, SmallBtn } from "./form";

interface V {
  kullanici: number; avukat_aktif: number; avukat_ucretli: number; esitleme: number; bulut_foy: number; bulut_kisi: number; aktif_kisi: number; degisen_foy: number;
  buro: number; buro_cok: number; buro_uye: number; buro_foy: number; davet_bekleyen: number;
  unvanlar: Record<string, number>; yz: Record<string, number>; yz_kisi: Record<string, number>; yz_gunluk: { gun: string; n: number }[];
}
const YZ_AD: Record<string, string> = {
  foy_sor: "Föye yapay zekâya sor", foyle: "Toplu yüklemede föyleme sohbeti", evrak: "Dosya ne durumda / evrak değerlendirmesi",
  evrak_derle: "Büyük dosya derleme", evrak_izle: "Evrakla duruşma provası (izle)", evrak_oyna: "Evrakla duruşma provası (oyna)"
};

export function TakipIstat({ onClose }: { onClose: () => void }) {
  const { width } = useWindowDimensions();
  const [gun, setGun] = useState<"7" | "30" | "90" | "365">("30");
  const [v, setV] = useState<V | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const sb = supabase();
    if (!sb) { setErr("Sunucuya ulaşılamıyor."); return; }
    setBusy(true);
    const r = await sb.rpc("istat_takip", { p_gun: Number(gun) });
    setBusy(false);
    if (r.error) { setErr(/function|schema cache/.test(r.error.message) ? "Bu istatistikler için önce supabase/surum19.sql çalıştırılmalı." : r.error.message); setV(null); return; }
    setErr(""); setV(r.data as V);
  };
  useEffect(() => { load(); }, [gun]);
  const cols = width >= 900 ? 4 : 2;
  const n = (x: number | undefined) => fmtNum(Number(x) || 0);
  const donem = `son ${gun} gün`;
  const yzToplam = v ? Object.entries(v.yz || {}).filter(([k]) => k in YZ_AD).reduce((a, [, x]) => a + Number(x), 0) : 0;
  const yzGunluk = v?.yz_gunluk || [];
  return (
    <Section title="İstatistikler · Dava takibi" hint="Yalnız sayılar: föylerin, evrakın ve soruların içeriği uçtan uca şifrelidir ya da hiç saklanmaz." right={<SmallBtn label="Kapat" onPress={onClose} />}>
      <View style={st.row}>
        <Seg value={gun} onChange={setGun} options={[{ v: "7", label: "7 gün" }, { v: "30", label: "30 gün" }, { v: "90", label: "90 gün" }, { v: "365", label: "1 yıl" }]} />
        <SmallBtn label="↻ Yenile" onPress={load} disabled={busy} />
        {busy && <ActivityIndicator color={C.brass} />}
      </View>
      {!!err && <Text style={st.err}>{err}</Text>}
      {!!v && (
        <>
          <Text style={st.grup}>KULLANICILAR</Text>
          <View style={st.tiles}>
            <Tile cols={cols} k="Celse Avukat paketi" v={n(v.avukat_aktif)} sub={`${n(v.avukat_ucretli)} ücretli · ${n(v.avukat_aktif - v.avukat_ucretli)} ücretsiz · toplam üye ${n(v.kullanici)}`} />
            <Tile cols={cols} k="Bulut eşitlemesi açık" v={n(v.esitleme)} sub={`${n(v.bulut_kisi)} kişinin kişisel bulutunda föy var`} />
            <Tile cols={cols} k="Etkin kullanıcı" v={n(v.aktif_kisi)} sub={`${donem} içinde föy eşitleyen`} />
            <Tile cols={cols} k="Değişen föy" v={n(v.degisen_foy)} sub={`${donem} · kişisel ve büro bulutu`} />
          </View>
          <Text style={st.grup}>BÜROLAR</Text>
          <View style={st.tiles}>
            <Tile cols={cols} k="Büro" v={n(v.buro)} sub={`${n(v.buro_cok)} büroda birden çok çalışan`} />
            <Tile cols={cols} k="Büro çalışanı" v={n(v.buro_uye)} sub={`bekleyen davet: ${n(v.davet_bekleyen)}`} />
            <Tile cols={cols} k="Buluttaki föy" v={n(v.bulut_foy + v.buro_foy)} sub={`${n(v.bulut_foy)} kişisel · ${n(v.buro_foy)} büro`} />
            <Tile cols={cols} k="Yapay zekâ isteği" v={n(yzToplam)} sub={`${donem} · föye sor: ${n(v.yz?.foy_sor)}`} />
          </View>
          {Object.keys(v.unvanlar || {}).length > 0 && (
            <View style={st.card}>
              <Text style={st.cardT}>Ünvanlara göre çalışanlar</Text>
              <HBars rows={Object.entries(v.unvanlar).sort((a, b) => b[1] - a[1]).map(([k, x]) => ({ label: k, value: Number(x) }))} />
            </View>
          )}
          <View style={st.card}>
            <Text style={st.cardT}>Yapay zekâ kullanımı ({donem})</Text>
            <Text style={st.cardH}>İşlem başına istek sayısı ve kullanan kişi. Sorular ve cevaplar sunucuda saklanmaz.</Text>
            {Object.keys(YZ_AD).some(k => v.yz?.[k])
              ? <HBars rows={Object.keys(YZ_AD).filter(k => v.yz?.[k]).map(k => ({ label: YZ_AD[k], sub: `${n(v.yz_kisi?.[k])} kişi`, value: Number(v.yz[k]) }))} />
              : <Text style={st.cardH}>Bu dönemde istek yok (sayım 19. kurulumla başlar).</Text>}
          </View>
          {yzGunluk.length > 1 && (
            <View style={st.card}>
              <Text style={st.cardT}>Günlük yapay zekâ isteği</Text>
              <BarChart points={yzGunluk.map(x => ({ label: x.gun.slice(8, 10) + "." + x.gun.slice(5, 7), long: x.gun.split("-").reverse().join(".") }))} values={yzGunluk.map(x => [Number(x.n)])} names={["İstek"]} />
            </View>
          )}
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

const st = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  err: { fontFamily: F.body, fontSize: 14, color: C.bad },
  grup: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: C.brass, marginTop: 6 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { flexGrow: 1, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, gap: 2 },
  tileK: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1, color: C.muted, textTransform: "uppercase" },
  tileV: { fontFamily: F.monoBold, fontSize: 24, color: C.text },
  tileS: { fontFamily: F.body, fontSize: 12, color: C.muted },
  card: { backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 12, gap: 8 },
  cardT: { fontFamily: F.displayMed, fontSize: 16, color: C.text },
  cardH: { fontFamily: F.body, fontSize: 12, color: C.muted }
});
