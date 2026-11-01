// Yönetim paneli · Oyuncular: üyeleri görme, arama ve seçilen kişiye ücretsiz (manuel) erişim verme ya da kaldırma.
// Yetki sunucudadır: yalnızca yoneticiler tablosundaki hesap profilleri görebilir ve "manuel" abonelik yazabilir (supabase/surum3.sql).
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../data/account";
import { Chip } from "../ui/kit";
import { C, F } from "../ui/theme";
import { Section, SmallBtn } from "./form";

interface Row { id: string; ad_soyad: string; eposta: string; telefon: string; olusturma: string; bitis?: string; kaynak?: string }

const FOREVER = "2099-12-31T23:59:59Z";
const fmt = (d: string) => new Date(d).toLocaleDateString("tr-TR");

export function PlayersPanel({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const sb = supabase();
    if (!sb) { setErr("Sunucuya ulaşılamıyor."); setRows([]); return; }
    const [p, a] = await Promise.all([
      sb.from("profiller").select("id, ad_soyad, eposta, telefon, olusturma").order("olusturma", { ascending: false }).limit(1000),
      sb.from("abonelikler").select("kullanici_id, bitis, kaynak")
    ]);
    if (p.error) { setErr(p.error.message.includes("permission") ? "Bu hesap yönetici değil ya da supabase/surum3.sql henüz çalıştırılmadı." : p.error.message); setRows([]); return; }
    const sub = new Map((a.data || []).map((x: any) => [x.kullanici_id, x]));
    setRows((p.data || []).map((r: any) => ({ ...r, bitis: sub.get(r.id)?.bitis, kaynak: sub.get(r.id)?.kaynak })));
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
  const plus = (months: number) => { const d = new Date(); d.setMonth(d.getMonth() + months); return d.toISOString(); };

  const shown = (rows || []).filter(r => !q || `${r.ad_soyad} ${r.eposta} ${r.telefon}`.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr")));
  const active = (r: Row) => !!r.bitis && new Date(r.bitis) > new Date();

  return (
    <Section title="Oyuncular" hint="Üyeleri görün; seçtiğiniz kişiye ücretsiz tam erişim verin (abonelik gibi çalışır). Mağaza ya da iyzico ile alınmış abonelikler burada yalnızca görüntülenir."
      right={<SmallBtn label="Kapat" onPress={onClose} />}>
      <TextInput value={q} onChangeText={setQ} placeholder="Ara: ad, e-posta, telefon…" placeholderTextColor={C.muted} style={st.search} />
      {rows === null ? <ActivityIndicator color={C.brass} /> : (
        <Text style={st.meta}>{rows.length} üye · {rows.filter(active).length} tam erişimli</Text>
      )}
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
            </View>
          </View>
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
