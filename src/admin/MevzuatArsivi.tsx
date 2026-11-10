// Yönetim paneli · Mevzuat arşivi (supabase/surum21.sql): yürürlükteki ve mülga bütün kanunlar, madde madde. Kaynak: Adalet
// Bakanlığı mevzuat servisinden günlük güncellenen açık veri deposu. "Güncelle" yalnız metni değişen kanunları yeniden yükler.
import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { supabase } from "../data/account";
import { ayarOku, ayarYaz } from "../data/foy";
import { ICTIHAT_PLANI, ictihatArsiviniYukle, IctihatIlerleme, mevzuatArsiviniYukle, mevzuatTurleriniYukle } from "../ui/resmiKaynak";
import { C } from "../ui/theme";
import { Section, SmallBtn } from "./form";

/** Diğer mevzuat arşivi: KHK, CB kararname / yönetmelik / genelge, tüzük (tamamı); yönetmelik ve tebliğ açıldıkça eklenir. */
function DigerMevzuat() {
  const [d, setD] = useState<{ tur: string; adet: number; mb: number }[] | null>(null);
  const [is, setIs] = useState<{ ad: string; sayfa: number; toplam: number; eklenen: number; mesaj?: string } | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState("");
  const devam = useRef(false);
  const yukleDurum = async () => {
    const sb = supabase(); if (!sb) return;
    const r = await sb.rpc("mevzuat_belge_durumu");
    if (r.error) setHata(/function|does not exist|404/i.test(r.error.message) ? "Önce supabase/surum22.sql çalıştırılmalı." : r.error.message);
    else { setHata(""); setD(r.data || []); }
  };
  useEffect(() => { yukleDurum(); }, []);
  const baslat = async () => {
    const k = (await ayarOku<{ i: number; sayfa: number }>("mevzuatTurYukleme")) || { i: 0, sayfa: 1 };
    devam.current = true; setCalisiyor(true); setHata("");
    try {
      const r = await mevzuatTurleriniYukle(setIs, () => devam.current, k, y => { ayarYaz("mevzuatTurYukleme", y); });
      if (!r.ok) setHata(r.hata); else if (r.dolu) setHata("Mevzuat arşivi 250 MB sınırına ulaştı; yükleme durdu.");
      await yukleDurum();
    } finally { setCalisiyor(false); devam.current = false; }
  };
  const AD: Record<string, string> = { KHK: "KHK", CB_KARARNAME: "CB kararnamesi", TUZUK: "Tüzük", CB_YONETMELIK: "CB yönetmeliği", CB_GENELGE: "CB genelgesi", YONETMELIK: "Yönetmelik", KKY: "Kurum yönetmeliği", UY: "Üniversite yönetmeliği", TEBLIGLER: "Tebliğ", CB_KARAR: "CB kararı" };
  return (
    <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12, marginTop: 4 }}>
      <Text style={{ color: C.text, fontWeight: "700" }}>📜 Diğer mevzuat</Text>
      <Text style={{ color: C.muted, fontSize: 12 }}>KHK'ların (olağan ve olağanüstü), Cumhurbaşkanlığı kararname, yönetmelik ve genelgelerinin ve tüzüklerin tamamı arşive yüklenir. Yönetmelik ve tebliğler on binlerce olduğundan canlı aranır; Celse'de açılan her biri arşive eklenir.</Text>
      {d && <Text style={{ color: C.text }}>{d.length ? d.map(x => (AD[x.tur] || x.tur) + " " + Number(x.adet).toLocaleString("tr-TR")).join(" · ") + " · " + d.reduce((t, x) => t + Number(x.mb), 0).toFixed(1) + " MB" : "Arşiv boş."}</Text>}
      {!!hata && <Text style={{ color: C.bad }}>{hata}</Text>}
      {is && <Text style={{ color: C.muted }}>{calisiyor ? "Yükleniyor: " : "Son durum: "}{is.ad} · sayfa {is.sayfa}{is.toplam ? " / " + Math.ceil(is.toplam / 10) : ""} · bu oturumda {is.eklenen} belge eklendi{is.mesaj ? " · " + is.mesaj : ""}</Text>}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {calisiyor ? <SmallBtn label="Durdur" tone="danger" onPress={() => { devam.current = false; }} /> : <SmallBtn label="⬇ KHK, CB kararname, tüzük… yükle / sürdür" tone="accent" onPress={baslat} />}
      </View>
    </View>
  );
}

/** İçtihat arşivi: temel kararların (İBK, genel kurullar, dava daireleri kurulları) resmî servisten yüklenmesi; durdurulup sürdürülebilir. */
function IctihatArsivi() {
  const [d, setD] = useState<{ karar: number; yargitay: number; danistay: number; diger: number; mb: number; son: string | null } | null>(null);
  const [is, setIs] = useState<IctihatIlerleme | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState("");
  const [yilSay, setYilSay] = useState(3);
  const devam = useRef(false);
  const yukleDurum = async () => {
    const sb = supabase(); if (!sb) return;
    const r = await sb.rpc("ictihat_durumu");
    if (r.error) setHata(/function|does not exist|404/i.test(r.error.message) ? "Önce supabase/surum22.sql çalıştırılmalı." : r.error.message);
    else { setHata(""); setD((r.data || [])[0] || null); }
  };
  useEffect(() => { yukleDurum(); }, []);
  const baslat = async () => {
    const buYil = new Date().getFullYear();
    const plan = ICTIHAT_PLANI(Array.from({ length: yilSay }, (_x, i) => buYil - i));
    const kaldigi = (await ayarOku<{ i: number; yi: number; sayfa: number; yilSay: number }>("ictihatYukleme")) || { i: 0, yi: 0, sayfa: 1, yilSay };
    const k = kaldigi.yilSay === yilSay ? kaldigi : { i: 0, yi: 0, sayfa: 1, yilSay };
    devam.current = true; setCalisiyor(true); setHata("");
    try {
      const r = await ictihatArsiviniYukle(plan, x => { setIs(x); }, () => devam.current, k, y => { ayarYaz("ictihatYukleme", { ...y, yilSay }); });
      if (!r.ok) setHata(r.hata);
      else if (r.dolu) setHata("Arşiv 300 MB sınırına ulaştı; yükleme durdu. Daha fazlası için Supabase planı büyütülmeli.");
      await yukleDurum();
    } finally { setCalisiyor(false); devam.current = false; }
  };
  return (
    <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12, marginTop: 4 }}>
      <Text style={{ color: C.text, fontWeight: "700" }}>⚖ İçtihat arşivi</Text>
      <Text style={{ color: C.muted, fontSize: 12 }}>Bütün kararlar zaten canlı aranabilir. Arşive, hızlı ve çevrim dışı aranabilsin diye temel kararlar yüklenir: Yargıtay ve Danıştay içtihadı birleştirme kararlarının hepsi; Yargıtay Hukuk ve Ceza Genel Kurulu, Danıştay İdare ve Vergi Dava Daireleri Kurulu kararları (seçilen son yıllar). Celse'de açılan her karar da arşive eklenir. Resmî servis kısa sürede az isteğe izin verdiği için saatte yaklaşık 1.000 karar yüklenir; sayfayı açık bırakın, durdurup sonra kaldığı yerden sürdürebilirsiniz.</Text>
      {d && <Text style={{ color: C.text }}>{Number(d.karar).toLocaleString("tr-TR")} karar (Yargıtay {Number(d.yargitay).toLocaleString("tr-TR")}, Danıştay {Number(d.danistay).toLocaleString("tr-TR")}, diğer {Number(d.diger).toLocaleString("tr-TR")}) · {d.mb} MB</Text>}
      {!!hata && <Text style={{ color: C.bad }}>{hata}</Text>}
      {is && <Text style={{ color: C.muted }}>{calisiyor ? "Yükleniyor: " : "Son durum: "}{is.ad}{is.yil ? " " + is.yil : ""} · sayfa {is.sayfa}{is.toplam ? " / " + Math.ceil(is.toplam / 10) : ""} · bu oturumda {is.eklenen} karar eklendi{is.mesaj ? " · " + is.mesaj : ""}</Text>}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {[1, 3, 5].map(n => <SmallBtn key={n} label={"Son " + n + " yıl"} tone={yilSay === n ? "accent" : "plain"} disabled={calisiyor} onPress={() => setYilSay(n)} />)}
        {calisiyor
          ? <SmallBtn label="Durdur" tone="danger" onPress={() => { devam.current = false; }} />
          : <SmallBtn label="⬇ Temel kararları yükle / sürdür" tone="accent" onPress={baslat} />}
      </View>
    </View>
  );
}

export function MevzuatArsivi({ onClose }: { onClose: () => void }) {
  const [d, setD] = useState<{ kanun: number; mulga: number; madde: number; son: string | null } | null>(null);
  const [is, setIs] = useState<{ islenen: number; toplam: number; degisen: number; madde: number; hatalar: string[] } | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState("");
  const [gecen, setGecen] = useState(0);
  useEffect(() => {
    if (!calisiyor) return;
    const bas = Date.now(); setGecen(0);
    const z = setInterval(() => setGecen(Math.round((Date.now() - bas) / 1000)), 1000);
    return () => clearInterval(z);
  }, [calisiyor]);
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
    <Section title="📚 Mevzuat ve içtihat arşivi" hint="Yürürlükteki ve mülga bütün kanunlar madde madde aranır (beyan editörü, İçtihat-mevzuat paneli, yapay zekâ). KHK, yönetmelik, tüzük, genelge ve kararlar ayrıca resmî servisten canlı aranır." right={<SmallBtn label="Kapat" onPress={onClose} />}>
      <View style={{ gap: 8 }}>
        {d && <Text style={{ color: C.text }}>Yürürlükte {d.kanun} kanun · mülga {d.mulga} · {Number(d.madde).toLocaleString("tr-TR")} madde{d.son ? " · son güncelleme " + new Date(d.son).toLocaleString("tr-TR") : ""}</Text>}
        {!!hata && <Text style={{ color: C.bad }}>{hata}</Text>}
        {calisiyor && <Text style={{ color: C.muted }}>Geçen süre {Math.floor(gecen / 60)}:{String(gecen % 60).padStart(2, "0")}{is && !is.toplam ? " · ilk kanunlar alınıyor (ilk cevap 1-2 dakika sürebilir)…" : ""}</Text>}
        {is && !!is.toplam && <Text style={{ color: C.muted }}>{calisiyor ? "Yükleniyor: " : "Bitti: "}{is.islenen} / {is.toplam} kanun tarandı · {is.degisen} kanun yüklendi · {is.madde.toLocaleString("tr-TR")} madde{is.hatalar.length ? " · " + is.hatalar.length + " hata" : ""}</Text>}
        {is && !!is.hatalar.length && <Text style={{ color: C.bad, fontSize: 12 }}>{is.hatalar.slice(0, 5).join("\n")}</Text>}
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <SmallBtn label={calisiyor ? "Yükleniyor… (sayfayı kapatmayın)" : d && d.kanun ? "↻ Güncelle (değişenler)" : "⬇ Arşivi yükle"} tone="accent" disabled={calisiyor} onPress={() => baslat(false)} />
          {!!d?.kanun && <SmallBtn label="Hepsini yeniden yükle" disabled={calisiyor} onPress={() => baslat(true)} />}
        </View>
        <Text style={{ color: C.muted, fontSize: 12 }}>İlk yükleme 1.000'i aşkın kanun için 10-20 dakika sürer; sonraki güncellemeler yalnız değişen kanunları alır. Haftada bir güncellemek yeterlidir.</Text>
        <DigerMevzuat />
        <IctihatArsivi />
      </View>
    </Section>
  );
}
