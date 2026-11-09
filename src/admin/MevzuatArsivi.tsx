// Yönetim paneli · Mevzuat arşivi (supabase/surum21.sql): yürürlükteki ve mülga bütün kanunlar, madde madde. Kaynak: Adalet
// Bakanlığı mevzuat servisinden günlük güncellenen açık veri deposu. "Güncelle" yalnız metni değişen kanunları yeniden yükler.
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { supabase } from "../data/account";
import { mevzuatArsiviniYukle } from "../ui/resmiKaynak";
import { C } from "../ui/theme";
import { Section, SmallBtn } from "./form";

export function MevzuatArsivi({ onClose }: { onClose: () => void }) {
  const [d, setD] = useState<{ kanun: number; mulga: number; madde: number; son: string | null } | null>(null);
  const [is, setIs] = useState<{ islenen: number; toplam: number; degisen: number; madde: number; hatalar: string[] } | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState("");
  const yukleDurum = async () => {
    const sb = supabase(); if (!sb) return;
    const r = await sb.rpc("mevzuat_durumu");
    if (r.error) setHata(/function|does not exist|404/i.test(r.error.message) ? "Önce supabase/surum21.sql çalıştırılmalı." : r.error.message);
    else setD((r.data || [])[0] || null);
  };
  useEffect(() => { yukleDurum(); }, []);
  const baslat = async (zorla: boolean) => {
    setCalisiyor(true); setHata("");
    try {
      const r = await mevzuatArsiviniYukle(setIs, zorla);
      if (!r.ok) setHata(r.hata);
      await yukleDurum();
    } finally { setCalisiyor(false); }
  };
  return (
    <Section title="📚 Mevzuat arşivi" hint="Yürürlükteki ve mülga bütün kanunlar madde madde aranır (beyan editörü, İçtihat-mevzuat paneli, yapay zekâ). KHK, yönetmelik, tüzük, genelge ve kararlar ayrıca resmî servisten canlı aranır." right={<SmallBtn label="Kapat" onPress={onClose} />}>
      <View style={{ gap: 8 }}>
        {d && <Text style={{ color: C.text }}>Yürürlükte {d.kanun} kanun · mülga {d.mulga} · {Number(d.madde).toLocaleString("tr-TR")} madde{d.son ? " · son güncelleme " + new Date(d.son).toLocaleString("tr-TR") : ""}</Text>}
        {!!hata && <Text style={{ color: C.bad }}>{hata}</Text>}
        {is && <Text style={{ color: C.muted }}>{calisiyor ? "Yükleniyor: " : "Bitti: "}{is.islenen} / {is.toplam} kanun tarandı · {is.degisen} kanun yüklendi · {is.madde.toLocaleString("tr-TR")} madde{is.hatalar.length ? " · " + is.hatalar.length + " hata" : ""}</Text>}
        {is && !!is.hatalar.length && <Text style={{ color: C.bad, fontSize: 12 }}>{is.hatalar.slice(0, 5).join("\n")}</Text>}
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <SmallBtn label={calisiyor ? "Yükleniyor… (sayfayı kapatmayın)" : d && d.kanun ? "↻ Güncelle (değişenler)" : "⬇ Arşivi yükle"} tone="accent" disabled={calisiyor} onPress={() => baslat(false)} />
          {!!d?.kanun && <SmallBtn label="Hepsini yeniden yükle" disabled={calisiyor} onPress={() => baslat(true)} />}
        </View>
        <Text style={{ color: C.muted, fontSize: 12 }}>İlk yükleme 1.000'i aşkın kanun için 10-20 dakika sürer; sonraki güncellemeler yalnız değişen kanunları alır. Haftada bir güncellemek yeterlidir.</Text>
      </View>
    </Section>
  );
}
