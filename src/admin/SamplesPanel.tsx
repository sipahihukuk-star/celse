// Yönetim paneli · Örnek olaylar: "Derdini anlat" kullanıcılarının, anonimleştirilerek örnek dava dosyası hazırlanmasına
// muvafakat ettiği olaylar (supabase/surum10.sql · admin_ornek_danismalar). Kullanıcı kimliği gösterilmez.
// Bir olayı dosyaya dönüştürmeden önce kalan kişisel bilgileri (ad, yer, tarih ayrıntısı) kendiniz değiştirin.
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { supabase } from "../data/account";
import { C, F } from "../ui/theme";
import { Section, SmallBtn } from "./form";

interface Row { id: string; alan: string; olay: string; deliller: string; karsi: string; talep: string; degerlendirme: string | null; created_at: string }

const fmt = (iso: string) => new Date(iso).toLocaleDateString("tr-TR", { dateStyle: "medium" });

export function SamplesPanel({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const sb = supabase();
    if (!sb) { setRows([]); setErr("Sunucu bağlantısı yok."); return; }
    sb.rpc("admin_ornek_danismalar", { p_sinir: 300 }).then(({ data, error }) => {
      if (error) { setRows([]); setErr(/function|does not exist|schema cache/i.test(error.message) ? "supabase/surum10.sql henüz çalıştırılmamış." : /Yetki/i.test(error.message) ? "Bu hesap sunucuda yönetici değil." : error.message); return; }
      setRows((data || []) as Row[]);
    });
  }, []);

  const metin = (r: Row) => [
    "Hukuk alanı: " + r.alan, "", "Somut olay:", r.olay, "", "Deliller ve ek bilgiler:", r.deliller, "",
    "Karşı tarafın argümanları:", r.karsi, "", "Talep:", r.talep
  ].join("\n");
  const copy = async (r: Row) => {
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) await navigator.clipboard.writeText(metin(r));
      setCopied(r.id);
    } catch { setCopied(""); }
  };

  return (
    <Section title="Örnek olaylar" hint="Kullanıcıların, kişisel bilgilerden arındırılarak örnek dava dosyası hazırlanmasına muvafakat ettiği danışmalar. Dosyaya dönüştürmeden önce olaydaki ad, yer ve tarih ayrıntılarını değiştirin; kullanıcı danışmasını silerse olay buradan da kalkar."
      right={<SmallBtn label="Kapat" onPress={onClose} />}>
      {rows === null ? <ActivityIndicator color={C.brass} />
        : err ? <Text style={[st.meta, { color: C.bad }]}>{err}</Text>
        : !rows.length ? <Text style={st.meta}>Henüz izin verilmiş olay yok.</Text>
        : rows.map(r => (
          <View key={r.id} style={st.item}>
            <Text style={st.head}>{r.alan.toLocaleUpperCase("tr")} · {fmt(r.created_at)}</Text>
            <Text style={st.body} numberOfLines={open === r.id ? undefined : 4}>{r.olay}</Text>
            {open === r.id && <>
              <Text style={st.lbl}>Deliller ve ek bilgiler</Text><Text style={st.body}>{r.deliller}</Text>
              <Text style={st.lbl}>Karşı tarafın argümanları</Text><Text style={st.body}>{r.karsi}</Text>
              <Text style={st.lbl}>Talep</Text><Text style={st.body}>{r.talep}</Text>
            </>}
            <View style={st.row}>
              <SmallBtn label={open === r.id ? "Kısalt" : "Tamamını göster"} onPress={() => setOpen(open === r.id ? null : r.id)} />
              {Platform.OS === "web" && <SmallBtn label={copied === r.id ? "Kopyalandı ✓" : "Metni kopyala"} onPress={() => copy(r)} />}
            </View>
          </View>
        ))}
    </Section>
  );
}

const st = StyleSheet.create({
  item: { gap: 6, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10 },
  head: { fontFamily: F.mono, fontSize: 12, letterSpacing: 1, color: C.brass },
  lbl: { fontFamily: F.bodyBold, fontSize: 13, color: C.muted, marginTop: 4 },
  body: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: C.text },
  meta: { fontFamily: F.body, fontSize: 13, color: C.muted },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 }
});
