// Yönetim paneli · Mevzuat arşivi (supabase/surum21.sql): yürürlükteki ve mülga bütün kanunlar, madde madde. Kaynak: Adalet
// Bakanlığı mevzuat servisinden günlük güncellenen açık veri deposu. "Güncelle" yalnız metni değişen kanunları yeniden yükler.
import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { supabase } from "../data/account";
import { ayarOku, ayarYaz } from "../data/foy";
import { ICTIHAT_PLANI, mevzuatArsiviniYukle, mevzuatTurleriniYukle } from "../ui/resmiKaynak";
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

/** İçtihat arşivi: yükleme SUNUCUDA zamanlanmış iş olarak yürür (surum23.sql); sayfayı açık tutmak gerekmez. */
const KAPSAM = [
  { k: "ibk", ad: "İçtihadı birleştirme kararları (Yargıtay ve Danıştay, hepsi)" },
  { k: "hgk", ad: "Yargıtay Hukuk Genel Kurulu" },
  { k: "cgk", ad: "Yargıtay Ceza Genel Kurulu" },
  { k: "iddk", ad: "Danıştay İdare Dava Daireleri Kurulu" },
  { k: "vddk", ad: "Danıştay Vergi Dava Daireleri Kurulu" }
];
type PlanOgesi = { mahkeme: string; birim: string; yil: number; ad: string };
function planKur(kapsam: string[], yilSay: number): PlanOgesi[] {
  const buYil = new Date().getFullYear();
  const yillar = Array.from({ length: yilSay }, (_x, i) => buYil - i);
  const temel = ICTIHAT_PLANI(yillar);
  const sec: Record<string, number[]> = { ibk: [0, 1], hgk: [2], cgk: [3], iddk: [4], vddk: [5] };
  const out: PlanOgesi[] = [];
  for (const k of kapsam) for (const i of sec[k] || []) for (const yil of temel[i].yillar) out.push({ mahkeme: temel[i].mahkeme, birim: temel[i].birim, yil, ad: temel[i].ad });
  return out;
}
type IsDurumu = { plan: PlanOgesi[]; i: number; sayfa: number; durum: string; sinir_mb: number; eklenen: number; son_hata: string; son_calisma: string | null; calisiyor_mu: boolean };
function IctihatArsivi() {
  const [d, setD] = useState<{ karar: number; yargitay: number; danistay: number; diger: number; mb: number; son: string | null } | null>(null);
  const [is, setIs] = useState<IsDurumu | null>(null);
  const [hata, setHata] = useState("");
  const [kapsam, setKapsam] = useState<string[]>(KAPSAM.map(x => x.k));
  const [yilSay, setYilSay] = useState(47);
  const [sinir, setSinir] = useState(300);
  const [bekle, setBekle] = useState(false);
  const yukleDurum = async () => {
    const sb = supabase(); if (!sb) return;
    const r = await sb.rpc("ictihat_durumu");
    if (r.error) setHata(/function|does not exist|404/i.test(r.error.message) ? "Önce supabase/surum22.sql çalıştırılmalı." : r.error.message);
    else setD((r.data || [])[0] || null);
    const j = await sb.rpc("ictihat_is_durumu");
    if (j.error) setHata(/function|does not exist|404/i.test(j.error.message) ? "Sunucuda yükleme için önce supabase/surum23.sql çalıştırılmalı." : j.error.message);
    else { const x = (j.data || [])[0] as IsDurumu | undefined; setIs(x || null); if (x && x.sinir_mb) setSinir(s => (x.durum === "calisiyor" ? x.sinir_mb : s)); }
  };
  useEffect(() => { yukleDurum(); const z = setInterval(yukleDurum, 15000); return () => clearInterval(z); }, []);
  const baslat = async (bastan: boolean) => {
    const sb = supabase(); if (!sb) return;
    setBekle(true); setHata("");
    const r = await sb.rpc("ictihat_is_baslat", { p_plan: planKur(kapsam, yilSay), p_sinir: sinir, p_bastan: bastan });
    if (r.error) setHata(r.error.message);
    await yukleDurum(); setBekle(false);
  };
  const durdur = async () => { const sb = supabase(); if (!sb) return; await sb.rpc("ictihat_is_durdur"); await yukleDurum(); };
  const simdiki = is && is.plan && is.plan[is.i];
  const DURUM: Record<string, string> = { calisiyor: "▶ Sunucuda yükleniyor", durdu: "⏸ Durdu", bitti: "✓ Plan bitti", dolu: "■ Arşiv sınırı doldu" };
  const sonCalisma = is?.son_calisma ? Math.round((Date.now() - new Date(is.son_calisma).getTime()) / 60000) : null;
  const plan = planKur(kapsam, yilSay);
  return (
    <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12, marginTop: 4 }}>
      <Text style={{ color: C.text, fontWeight: "700" }}>⚖ İçtihat arşivi</Text>
      <Text style={{ color: C.muted, fontSize: 12 }}>Bütün kararlar zaten canlı aranabilir; arşive hızlı arama ve yapay zekânın başvurması için yüklenir. Yükleme sunucuda kendi kendine yürür (sayfayı kapatabilirsiniz): resmî servis saatte yaklaşık 1.000 karara izin verir. Ayrıca beyan editöründeki “Künye doğrula” ile makale ve bloglardaki kararlar resmî serviste teyit edilip eklenir.</Text>
      {d && <Text style={{ color: C.text }}>{Number(d.karar).toLocaleString("tr-TR")} karar (Yargıtay {Number(d.yargitay).toLocaleString("tr-TR")}, Danıştay {Number(d.danistay).toLocaleString("tr-TR")}, diğer {Number(d.diger).toLocaleString("tr-TR")}) · {d.mb} MB{is ? " / sınır " + is.sinir_mb.toLocaleString("tr-TR") + " MB" : ""}</Text>}
      {is && <Text style={{ color: is.durum === "calisiyor" ? C.good : C.muted }}>{DURUM[is.durum] || is.durum}{is.plan?.length ? ` · ${Math.min(is.i, is.plan.length)} / ${is.plan.length} adım` : ""}{simdiki && is.durum === "calisiyor" ? ` · şimdi: ${simdiki.ad}${simdiki.yil ? " " + simdiki.yil : ""}, sayfa ${is.sayfa}` : ""} · bu planla {Number(is.eklenen).toLocaleString("tr-TR")} karar eklendi{sonCalisma !== null ? ` · son tur ${sonCalisma} dk önce` : ""}</Text>}
      {is && is.durum === "calisiyor" && sonCalisma !== null && sonCalisma > 5 && <Text style={{ color: C.bad, fontSize: 12 }}>Son 5 dakikada tur çalışmadı: danisma fonksiyonunda “Verify JWT” kapalı mı ve surum23.sql çalıştırıldı mı, kontrol edin.</Text>}
      {!!is?.son_hata && <Text style={{ color: C.mid, fontSize: 12 }}>Son not: {is.son_hata}</Text>}
      {!!hata && <Text style={{ color: C.bad }}>{hata}</Text>}
      <Text style={{ color: C.muted, fontSize: 12 }}>Kapsam</Text>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {KAPSAM.map(x => <SmallBtn key={x.k} label={(kapsam.includes(x.k) ? "☑ " : "☐ ") + x.ad} tone={kapsam.includes(x.k) ? "accent" : "plain"} onPress={() => setKapsam(k => (k.includes(x.k) ? k.filter(y => y !== x.k) : [...k, x.k]))} />)}
      </View>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Text style={{ color: C.muted, fontSize: 12 }}>Yıllar:</Text>
        {[[5, "Son 5 yıl"], [10, "Son 10 yıl"], [20, "Son 20 yıl"], [47, "Hepsi (1980'den)"]].map(([n, ad]) => <SmallBtn key={String(n)} label={String(ad)} tone={yilSay === n ? "accent" : "plain"} onPress={() => setYilSay(Number(n))} />)}
      </View>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Text style={{ color: C.muted, fontSize: 12 }}>Arşiv sınırı:</Text>
        {[[300, "300 MB (ücretsiz plan)"], [2000, "2 GB"], [6000, "6 GB (Pro plan)"]].map(([n, ad]) => <SmallBtn key={String(n)} label={String(ad)} tone={sinir === n ? "accent" : "plain"} onPress={() => setSinir(Number(n))} />)}
      </View>
      <Text style={{ color: C.muted, fontSize: 12 }}>Seçilen plan {plan.length} adım (her adım bir kurul ve yıl). 6 GB'a yaklaşık 250-300 bin karar sığar.</Text>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {is?.durum === "calisiyor"
          ? <SmallBtn label="⏸ Durdur" tone="danger" onPress={durdur} />
          : <SmallBtn label={bekle ? "…" : "▶ Sunucuda başlat / sürdür"} tone="accent" disabled={bekle || !plan.length} onPress={() => baslat(false)} />}
        {is?.durum !== "calisiyor" && !!is?.plan?.length && <SmallBtn label="↺ Baştan başlat" disabled={bekle || !plan.length} onPress={() => baslat(true)} />}
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
