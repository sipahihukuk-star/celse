// Yönetim paneli · Oyuncular: üyeleri görme, arama ve seçilen kişiye ücretsiz (manuel) erişim verme ya da kaldırma;
// "Derdini anlat" kredisi ekleme/düşme ve "Evrakla duruşma provası" iznini açma/kapatma (supabase/surum14.sql).
// Panel üç yüze ayrıdır: seçili yüzde yalnız o yüzü açık olan kişiler ve o yüzün düğmeleri görünür; her kişinin hangi yüzleri
// kullanabileceği buradan açılıp kapatılır (supabase/surum16.sql). Üç yüzü açık kişi üç yerde, tek yüzü açık kişi tek yerde görünür.
// Yetki sunucudadır: yalnızca yoneticiler tablosundaki hesap profilleri görebilir ve "manuel" abonelik yazabilir (supabase/surum3.sql).
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../data/account";
import { Chip } from "../ui/kit";
import { C, F } from "../ui/theme";
import { Section, SmallBtn } from "./form";
import { HOME_PAGES, HomePage, yuzAdi } from "../ui/homePage";

interface Avukat { bitis: string; kaynak: string; aylik: number; kalan: number; donem_sonu: string }
interface Row { id: string; ad_soyad: string; eposta: string; telefon: string; olusturma: string; bitis?: string; kaynak?: string; kredi: number; evrak: boolean; avukat?: Avukat; yuzler: HomePage[] }

const FOREVER = "2099-12-31T23:59:59Z";
const fmt = (d: string) => new Date(d).toLocaleDateString("tr-TR");

export function PlayersPanel({ onClose, yuz }: { onClose: () => void; /** seçili yüz; yoksa herkes ve bütün düğmeler */ yuz?: HomePage }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  // Her tuşun sonucu o kişinin kartında yazar (başarılıysa yeşil, hata varsa kırmızı); hata yalnız listenin tepesinde kalınca görünmüyordu.
  const [sonuc, setSonuc] = useState<Record<string, { ok: boolean; t: string }>>({});
  const bildir = (r: Row, error: { message: string } | null, ok: string, kurulum?: string) =>
    setSonuc(x => ({ ...x, [r.id]: error ? { ok: false, t: "İşlem yapılamadı: " + (kurulum && error.message.includes("function") ? kurulum : error.message) } : { ok: true, t: "✓ " + ok } }));
  const [kurulum14, setKurulum14] = useState(true);
  const [kurulum15, setKurulum15] = useState(true);
  const [kurulum16, setKurulum16] = useState(true);

  const load = async () => {
    const sb = supabase();
    if (!sb) { setErr("Sunucuya ulaşılamıyor."); setRows([]); return; }
    const [p, a, k, y] = await Promise.all([
      sb.from("profiller").select("id, ad_soyad, eposta, telefon, olusturma").order("olusturma", { ascending: false }).limit(1000),
      sb.from("abonelikler").select("kullanici_id, bitis, kaynak"),
      sb.from("derdini_kredi").select("kullanici_id, kredi"),
      sb.from("ozel_yetkiler").select("kullanici_id, evrak, yuzler")
    ]);
    // yuzler sütunu 16. kurulumla gelir; yoksa eski sorguyla okunur ve herkes üç yüzde görünür.
    let yv: any = y;
    if (y.error) { yv = await sb.from("ozel_yetkiler").select("kullanici_id, evrak"); setKurulum16(false); } else setKurulum16(true);
    const av = await sb.rpc("yonetici_avukat_listesi");
    setKurulum15(!av.error);
    const avm = new Map(((av.data as any[]) || []).map((x: any) => [x.kullanici_id, x as Avukat]));
    setKurulum14(!yv.error);
    if (p.error) { setErr(p.error.message.includes("permission") ? "Bu hesap yönetici değil ya da supabase/surum3.sql henüz çalıştırılmadı." : p.error.message); setRows([]); return; }
    const sub = new Map((a.data || []).map((x: any) => [x.kullanici_id, x]));
    const kr = new Map((k.data || []).map((x: any) => [x.kullanici_id, Number(x.kredi) || 0]));
    const ev = new Map((yv.data || []).map((x: any) => [x.kullanici_id, x.evrak === true]));
    const yz = new Map((yv.data || []).map((x: any) => [x.kullanici_id, Array.isArray(x.yuzler) && x.yuzler.length ? HOME_PAGES.filter(h => x.yuzler.includes(h)) : [...HOME_PAGES]]));
    setRows((p.data || []).map((r: any) => ({ ...r, bitis: sub.get(r.id)?.bitis, kaynak: sub.get(r.id)?.kaynak, kredi: kr.get(r.id) || 0, evrak: !!ev.get(r.id), avukat: avm.get(r.id), yuzler: yz.get(r.id) || [...HOME_PAGES] })));
    setErr("");
  };
  useEffect(() => { load(); }, []);

  const grant = async (r: Row, until: string | null) => {
    const sb = supabase(); if (!sb) return;
    setBusy(r.id);
    const res = until
      ? await sb.from("abonelikler").upsert({ kullanici_id: r.id, bitis: until, kaynak: "manuel", guncelleme: new Date().toISOString() })
      : await sb.from("abonelikler").delete().eq("kullanici_id", r.id);
    bildir(r, res.error, until ? `Oyunun tam erişimi ${until === FOREVER ? "süresiz" : fmt(until) + " tarihine kadar"} açıldı.` : "Oyunun ücretsiz erişimi kaldırıldı.");
    await load();
    setBusy(null);
  };
  const kredi = async (r: Row, n: number) => {
    const sb = supabase(); if (!sb) return;
    setBusy(r.id);
    const res = await sb.rpc("yonetici_kredi_ver", { p_kullanici: r.id, p_miktar: n });
    bildir(r, res.error, `Derdini anlat kredisi ${n > 0 ? n + " artırıldı" : -n + " azaltıldı"}.`, "önce supabase/surum14.sql çalıştırılmalı.");
    await load(); setBusy(null);
  };
  const evrak = async (r: Row, acik: boolean) => {
    const sb = supabase(); if (!sb) return;
    setBusy(r.id);
    const res = await sb.rpc("yonetici_evrak_yetki", { p_kullanici: r.id, p_acik: acik });
    bildir(r, res.error, acik ? "Evrakla duruşma provası sınırsız olarak açıldı." : "Evrakla duruşma provası izni kapatıldı.", "önce supabase/surum14.sql çalıştırılmalı.");
    await load(); setBusy(null);
  };
  const avukatPaket = async (r: Row, bitis: string | null) => {
    const sb = supabase(); if (!sb) return;
    setBusy(r.id);
    const res = await sb.rpc("yonetici_avukat_paket", { p_kullanici: r.id, p_bitis: bitis });
    bildir(r, res.error, bitis ? `Celse Avukat paketi ${fmt(bitis)} tarihine kadar açıldı (ayda 160 kredi). Kişi uygulamayı kapatıp açınca evrak bölümü açılır.` : "Celse Avukat paketi kaldırıldı.", "önce supabase/surum15.sql çalıştırılmalı.");
    await load(); setBusy(null);
  };
  const avukatKredi = async (r: Row, n: number) => {
    const sb = supabase(); if (!sb) return;
    setBusy(r.id);
    const res = await sb.rpc("yonetici_avukat_kredi", { p_kullanici: r.id, p_miktar: n });
    bildir(r, res.error, `Bu ayın avukat kredisine ${n} eklendi.`);
    await load(); setBusy(null);
  };
  const yuzDegistir = async (r: Row, h: HomePage) => {
    const sb = supabase(); if (!sb) return;
    const yeni = r.yuzler.includes(h) ? r.yuzler.filter(x => x !== h) : HOME_PAGES.filter(x => x === h || r.yuzler.includes(x));
    if (!yeni.length) { setSonuc(x => ({ ...x, [r.id]: { ok: false, t: "En az bir yüz açık kalmalı." } })); return; }
    setBusy(r.id);
    const res = await sb.rpc("yonetici_yuz_yetki", { p_kullanici: r.id, p_yuzler: yeni });
    bildir(r, res.error, `${yuzAdi(h)} ${r.yuzler.includes(h) ? "kapatıldı" : "açıldı"}. Açık yüzler: ${yeni.map(yuzAdi).join(", ")}. Kişi uygulamayı kapatıp açınca değişir.`, "önce supabase/surum16.sql çalıştırılmalı.");
    await load(); setBusy(null);
  };
  const avukatAktif = (r: Row) => !!r.avukat && new Date(r.avukat.bitis) > new Date();
  const plus = (months: number) => { const d = new Date(); d.setMonth(d.getMonth() + months); return d.toISOString(); };

  const yuzde = (rows || []).filter(r => !yuz || r.yuzler.includes(yuz));
  const goster = (h: HomePage) => !yuz || yuz === h;
  const shown = yuzde.filter(r => !q || `${r.ad_soyad} ${r.eposta} ${r.telefon}`.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr")));
  const active = (r: Row) => !!r.bitis && new Date(r.bitis) > new Date();

  return (
    <Section title={yuz ? `Oyuncular · ${yuzAdi(yuz)}` : "Oyuncular"} hint={yuz === "takip" ? "Dava takibini kullanabilen üyeler: Celse Avukat paketi ve açık yüzler." : yuz === "danisma" ? "Derdini anlat'ı kullanabilen üyeler: kredi, evrakla duruşma provası izni, Celse Avukat paketi ve açık yüzler." : yuz === "oyun" ? "Kariyer ve oyunu kullanabilen üyeler: ücretsiz tam erişim (Pro) ve açık yüzler." : "Üyeleri görün; seçtiğiniz kişiye ücretsiz tam erişim (Pro), Derdini anlat kredisi ya da Evrakla duruşma provası izni verin. Mağaza ya da iyzico ile alınmış abonelikler burada yalnızca görüntülenir."}
      right={<SmallBtn label="Kapat" onPress={onClose} />}>
      <TextInput value={q} onChangeText={setQ} placeholder="Ara: ad, e-posta, telefon…" placeholderTextColor={C.muted} style={st.search} />
      {rows === null ? <ActivityIndicator color={C.brass} /> : (
        <Text style={st.meta}>{yuz ? `${yuzde.length} / ${rows.length} üye bu yüzde · ` : `${rows.length} üye · `} {yuzde.filter(active).length} tam erişimli · {yuzde.filter(r => r.kredi > 0).length} kredili · {yuzde.filter(r => r.evrak).length} evrak provası izinli · {yuzde.filter(avukatAktif).length} avukat paketli</Text>
      )}
      {!kurulum16 && <Text style={st.err}>Kişi başına yüz açıp kapatmak için önce supabase/surum16.sql çalıştırılmalı.</Text>}
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
              {r.yuzler.length < 3 && <Chip label={"YALNIZ " + r.yuzler.map(h => yuzAdi(h).toLocaleUpperCase("tr")).join(" + ")} color={C.p2} />}
              {avukatAktif(r) && <Chip label={`CELSE AVUKAT · ${r.avukat!.kalan}/${r.avukat!.aylik} KREDİ · ${r.avukat!.kaynak === "manuel" ? "ÜCRETSİZ" : "ABONE"} · ${fmt(r.avukat!.bitis)}'E KADAR`} color={C.good} />}
            </View>
          </View>
          {busy !== r.id && kurulum16 && (
            <View style={[st.row, { width: "100%" }]}>
              <Text style={st.meta}>Açık yüzler:</Text>
              {HOME_PAGES.map(h => <SmallBtn key={h} label={(r.yuzler.includes(h) ? "✓ " : "✕ ") + yuzAdi(h)} tone={r.yuzler.includes(h) ? "accent" : "plain"} onPress={() => yuzDegistir(r, h)} />)}
            </View>
          )}
          {busy !== r.id && kurulum14 && goster("danisma") && (
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
          {busy !== r.id && kurulum15 && (goster("takip") || goster("danisma")) && (
            <View style={[st.row, { width: "100%" }]}>
              <Text style={st.meta}>Celse Avukat paketi:</Text>
              {r.avukat && r.avukat.kaynak !== "manuel" && avukatAktif(r) ? <Text style={st.meta}>Ücretli abonelik</Text> : (
                <>
                  <SmallBtn label="1 ay" onPress={() => avukatPaket(r, plus(1))} />
                  <SmallBtn label="1 yıl" onPress={() => avukatPaket(r, plus(12))} />
                  {avukatAktif(r) && <SmallBtn label="Kaldır" tone="danger" onPress={() => avukatPaket(r, null)} />}
                </>
              )}
              {avukatAktif(r) && <SmallBtn label="+20 kredi (bu ay)" onPress={() => avukatKredi(r, 20)} />}
            </View>
          )}
          {busy !== r.id && !!sonuc[r.id] && <Text style={[st.sonuc, { color: sonuc[r.id].ok ? C.good : C.bad }]}>{sonuc[r.id].t}</Text>}
          {busy === r.id && <ActivityIndicator color={C.brass} />}
          {busy !== r.id && goster("oyun") && <View style={st.row}>
            <Text style={st.meta}>Oyun (Pro):</Text>
            {(r.kaynak && r.kaynak !== "manuel" && active(r)) ? <Text style={st.meta}>Ücretli abonelik</Text> : (
              <>
                <SmallBtn label="1 ay" onPress={() => grant(r, plus(1))} />
                <SmallBtn label="1 yıl" onPress={() => grant(r, plus(12))} />
                <SmallBtn label="Süresiz" tone="accent" onPress={() => grant(r, FOREVER)} />
                {active(r) && <SmallBtn label="Erişimi kaldır" tone="danger" onPress={() => grant(r, null)} />}
              </>
            )}
          </View>}
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
  err: { fontFamily: F.body, fontSize: 14, color: C.bad },
  sonuc: { fontFamily: F.bodyBold, fontSize: 14, width: "100%" }
});
