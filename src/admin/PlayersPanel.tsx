// Yönetim paneli · Oyuncular: üyeleri görme, arama ve seçilen kişiye ücretsiz (manuel) erişim verme ya da kaldırma;
// "Derdini anlat" kredisi ekleme/düşme ve "Evrakla duruşma provası" iznini açma/kapatma (supabase/surum14.sql).
// Yetki sunucudadır: yalnızca yoneticiler tablosundaki hesap profilleri görebilir ve "manuel" abonelik yazabilir (supabase/surum3.sql).
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../data/account";
import { Chip } from "../ui/kit";
import { C, F } from "../ui/theme";
import { Section, SmallBtn } from "./form";

interface Row { id: string; ad_soyad: string; eposta: string; telefon: string; olusturma: string; bitis?: string; kaynak?: string; kredi: number; evrak: boolean }

const FOREVER = "2099-12-31T23:59:59Z";
const fmt = (d: string) => new Date(d).toLocaleDateString("tr-TR");

export function PlayersPanel({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [kurulum14, setKurulum14] = useState(true);

  const load = async () => {
    const sb = supabase();
    if (!sb) { setErr("Sunucuya ulaşılamıyor."); setRows([]); return; }
    const [p, a, k, y] = await Promise.all([
      sb.from("profiller").select("id, ad_soyad, eposta, telefon, olusturma").order("olusturma", { ascending: false }).limit(1000),
      sb.from("abonelikler").select("kullanici_id, bitis, kaynak"),
      sb.from("derdini_kredi").select("kullanici_id, kredi"),
      sb.from("ozel_yetkiler").select("kullanici_id, evrak")
    ]);
    setKurulum14(!y.error);
    if (p.error) { setErr(p.error.message.includes("permission") ? "Bu hesap yönetici değil ya da supabase/surum3.sql henüz çalıştırılmadı." : p.error.message); setRows([]); return; }
    const sub = new Map((a.data || []).map((x: any) => [x.kullanici_id, x]));
    const kr = new Map((k.data || []).map((x: any) => [x.kullanici_id, Number(x.kredi) || 0]));
    const ev = new Map((y.data || []).map((x: any) => [x.kullanici_id, x.evrak === true]));
    setRows((p.data || []).map((r: any) => ({ ...r, bitis: sub.get(r.id)?.bitis, kaynak: sub.get(r.id)?.kaynak, kredi: kr.get(r.id) || 0, evrak: !!ev.get(r.id) })));
    setErr("");
  };
  useEffect(() => { load(); }, []);

  const grant = async (r: Row, until: string | null) => {
    const sb = supabase(); if (!sb) return;
    setBusy(r.id);
    const res = until
      ? await sb.from("abonelikler").upsert({ kullanici_id: r.id, bitis: until, kaynak: "manuel", guncelleme: new Date().toISOString() })
      : await sb.from("abonelikler").delete().eq("kullanici_id", r.id);
    if (res.error) setErr(res.error.message);
    await load();
    setBusy(null);
  };
  const kredi = async (r: Row, n: number) => {
    const sb = supabase(); if (!sb) return;
    setBusy(r.id);
    const res = await sb.rpc("yonetici_kredi_ver", { p_kullanici: r.id, p_miktar: n });
    if (res.error) setErr(res.error.message.includes("function") ? "Önce supabase/surum14.sql çalıştırılmalı." : res.error.message);
    await load(); setBusy(null);
  };
  const evrak = async (r: Row, acik: boolean) => {
    const sb = supabase(); if (!sb) return;
    setBusy(r.id);
    const res = await sb.rpc("yonetici_evrak_yetki", { p_kullanici: r.id, p_acik: acik });
    if (res.error) setErr(res.error.message.includes("function") ? "Önce supabase/surum14.sql çalıştırılmalı." : res.error.message);
    await load(); setBusy(null);
  };
  const plus = (months: number) => { const d = new Date(); d.setMonth(d.getMonth() + months); return d.toISOString(); };

  const shown = (rows || []).filter(r => !q || `${r.ad_soyad} ${r.eposta} ${r.telefon}`.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr")));
  const active = (r: Row) => !!r.bitis && new Date(r.bitis) > new Date();

  return (
    <Section title="Oyuncular" hint="Üyeleri görün; seçtiğiniz kişiye ücretsiz tam erişim (Pro), Derdini anlat kredisi ya da Evrakla duruşma provası izni verin. Mağaza ya da iyzico ile alınmış abonelikler burada yalnızca görüntülenir."
      right={<SmallBtn label="Kapat" onPress={onClose} />}>
      <TextInput value={q} onChangeText={setQ} placeholder="Ara: ad, e-posta, telefon…" placeholderTextColor={C.muted} style={st.search} />
      {rows === null ? <ActivityIndicator color={C.brass} /> : (
        <Text style={st.meta}>{rows.length} üye · {rows.filter(active).length} tam erişimli · {rows.filter(r => r.kredi > 0).length} kredili · {rows.filter(r => r.evrak).length} evrak provası izinli</Text>
      )}
      {!kurulum14 && <Text style={st.err}>Kredi ve evrak provası düğmeleri için önce supabase/surum14.sql çalıştırılmalı.</Text>}
      {!!err && <Text style={st.err}>{err}</Text>}
      {shown.slice(0, 200).map(r => (
        <View key={r.id} style={st.item}>
          <View style={{ flex: 1, minWidth: 220, gap: 2 }}>
            <Text style={st.name}>{r.ad_soyad || "(adsız)"}</Text>
            <Text style={st.meta}>{r.eposta} · {r.telefon} · üyelik {fmt(r.olusturma)}</Text>
            <View style={st.row}>
              {active(r)
                ? <Chip label={`${r.kaynak === "manuel" ? "ÜCRETSİZ ERİŞİM" : "ABONE"} · ${r.bitis === FOREVER || (r.bitis || "").startsWith("2099") ? "SÜRESİZ" : fmt(r.bitis!) + "'E KADAR"}`} color={C.good} />
                : <Chip label="ÜCRETSİZ SÜRÜM" color={C.muted} />}
              <Chip label={`DERDİNİ ANLAT · ${r.kredi} KREDİ`} color={r.kredi > 0 ? C.brass : C.muted} />
              {r.evrak && <Chip label="EVRAK PROVASI AÇIK" color={C.good} />}
            </View>
          </View>
          {busy !== r.id && kurulum14 && (
            <View style={[st.row, { width: "100%" }]}>
              <Text style={st.meta}>Derdini anlat kredisi:</Text>
              <SmallBtn label="+1" onPress={() => kredi(r, 1)} />
              <SmallBtn label="+3" onPress={() => kredi(r, 3)} />
              <SmallBtn label="+10" onPress={() => kredi(r, 10)} />
              {r.kredi > 0 && <SmallBtn label="−1" tone="danger" onPress={() => kredi(r, -1)} />}
              <Text style={[st.meta, { marginLeft: 8 }]}>Evrakla duruşma provası:</Text>
              {r.evrak ? <SmallBtn label="İzni kapat" tone="danger" onPress={() => evrak(r, false)} /> : <SmallBtn label="İzin ver" tone="accent" onPress={() => evrak(r, true)} />}
            </View>
          )}
          <View style={st.row}>
            {busy === r.id ? <ActivityIndicator color={C.brass} /> : (r.kaynak && r.kaynak !== "manuel" && active(r)) ? <Text style={st.meta}>Ücretli abonelik</Text> : (
              <>
                <SmallBtn label="1 ay" onPress={() => grant(r, plus(1))} />
                <SmallBtn label="1 yıl" onPress={() => grant(r, plus(12))} />
                <SmallBtn label="Süresiz" tone="accent" onPress={() => grant(r, FOREVER)} />
                {active(r) && <SmallBtn label="Erişimi kaldır" tone="danger" onPress={() => grant(r, null)} />}
              </>
            )}
          </View>
        </View>
      ))}
    </Section>
  );
}

const st = StyleSheet.create({
  search: { fontFamily: F.body, fontSize: 16, color: C.text, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  item: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10 },
  name: { fontFamily: F.displayMed, fontSize: 17, color: C.text },
  meta: { fontFamily: F.body, fontSize: 13, color: C.muted },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  err: { fontFamily: F.body, fontSize: 14, color: C.bad }
});
