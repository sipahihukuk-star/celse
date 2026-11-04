// Yönetim paneli · "Duyuru ve mesajlar" ve "Hata bildirimleri" (supabase/surum9.sql).
// Gönderme tek yoldan yapılır: mesajGonder() (src/data/inbox.ts). E-posta ileride oraya eklenecek.
import { kbBar } from "../ui/KeyboardBar";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../data/account";
import { mesajGonder, ReportCategory, ReportStatus, setReportStatus } from "../data/inbox";
import { Chip } from "../ui/kit";
import { C, F } from "../ui/theme";
import { Area, Field, Row, Section, Seg, SmallBtn } from "./form";

const fmt = (iso: string) => new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
const notReady = (m: string) => /function|does not exist|schema cache|relation/i.test(m) ? "supabase/surum9.sql henüz çalıştırılmamış." : /Yetki yok|permission/i.test(m) ? "Bu hesap sunucuda yönetici değil." : m;

/* ---------- Duyuru ve mesajlar ---------- */

interface Person { id: string; ad_soyad: string; eposta: string }
interface Sent { id: string; kullanici_id: string | null; ad_soyad: string | null; eposta: string | null; baslik: string; metin: string; tur: string; ilgili_bildirim: number | null; created_at: string; okuyan: number }

export function MessagesPanel({ onClose }: { onClose: () => void }) {
  const [to, setTo] = useState<"herkes" | "kisi">("herkes");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Person[]>([]);
  const [person, setPerson] = useState<Person | null>(null);
  const [baslik, setBaslik] = useState("");
  const [metin, setMetin] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState<Sent[] | null>(null);
  const [del, setDel] = useState<string | null>(null);

  const loadSent = async () => {
    const sb = supabase();
    if (!sb) { setSent([]); setMsg("Sunucuya ulaşılamıyor."); return; }
    const { data, error } = await sb.rpc("yonetici_mesajlar", { p_sinir: 100 });
    if (error) { setMsg(notReady(error.message)); setSent([]); return; }
    setSent(((data || []) as any[]).map(r => ({ ...r, okuyan: Number(r.okuyan) || 0 })));
  };
  useEffect(() => { loadSent(); }, []);

  // Kişi arama (ad ya da e-posta; en az 2 harf).
  useEffect(() => {
    if (to !== "kisi" || q.trim().length < 2) { setFound([]); return; }
    const id = setTimeout(async () => {
      const sb = supabase(); if (!sb) return;
      const { data } = await sb.rpc("yonetici_kullanici_ara", { p_q: q.trim() });
      setFound((data || []) as Person[]);
    }, 300);
    return () => clearTimeout(id);
  }, [q, to]);

  const ready = baslik.trim().length > 0 && metin.trim().length > 0 && (to === "herkes" || !!person);
  const send = async () => {
    if (to === "herkes" && !confirm) { setConfirm(true); return; }
    setBusy(true); setMsg("");
    const r = await mesajGonder({ kime: to === "herkes" ? null : person!.id, baslik, metin, tur: to === "herkes" ? "duyuru" : "sistem" });
    setBusy(false); setConfirm(false);
    if (r.error) { setMsg("Gönderilemedi: " + notReady(r.error)); return; }
    setMsg(to === "herkes" ? "Duyuru gönderildi; bütün oyuncuların gelen kutusunda." : `Mesaj ${person!.ad_soyad} adlı üyenin gelen kutusuna gönderildi.`);
    setBaslik(""); setMetin(""); loadSent();
  };
  const remove = async (id: string) => {
    const sb = supabase(); if (!sb) return;
    const { error } = await sb.from("mesajlar").delete().eq("id", id);
    if (error) setMsg(error.message);
    setDel(null); loadSent();
  };

  return (
    <Section title="Duyuru ve mesajlar" hint="Oyuncuların gelen kutusuna duyuru (herkese) ya da tek bir üyeye mesaj gönderin. Oyuncular yeni mesajı uygulamayı açınca ya da birkaç dakika içinde görür. E-posta gönderimi henüz yok."
      right={<SmallBtn label="Kapat" onPress={onClose} />}>
      <Seg label="Alıcı" value={to} onChange={v => { setTo(v); setConfirm(false); }} options={[{ v: "herkes", label: "Herkese (duyuru)" }, { v: "kisi", label: "Bir üyeye" }]} />
      {to === "kisi" && (
        <View style={{ gap: 6 }}>
          {person ? (
            <View style={st.row}>
              <Chip label={`${person.ad_soyad} · ${person.eposta}`} color={C.p1} />
              <SmallBtn label="Değiştir" onPress={() => { setPerson(null); setQ(""); }} />
            </View>
          ) : (
            <>
              <TextInput {...kbBar} value={q} onChangeText={setQ} placeholder="Ara: ad soyad ya da e-posta (en az 2 harf)" placeholderTextColor={C.muted} style={st.search} autoCapitalize="none" />
              {found.map(p => (
                <Pressable key={p.id} accessibilityRole="button" onPress={() => { setPerson(p); setFound([]); }} style={({ pressed }) => [st.pick, pressed && { opacity: 0.7 }]}>
                  <Text style={st.pickT}>{p.ad_soyad || "(adsız)"}</Text><Text style={st.meta}>{p.eposta}</Text>
                </Pressable>
              ))}
              {q.trim().length >= 2 && !found.length && <Text style={st.meta}>Eşleşen üye yok.</Text>}
            </>
          )}
        </View>
      )}
      <Row><Field label="Başlık" value={baslik} onChange={setBaslik} placeholder="ör. Yeni Danıştay dosyaları eklendi" /></Row>
      <Area label="Metin" value={metin} onChange={setMetin} rows={5} />
      <View style={st.row}>
        <SmallBtn label={busy ? "Gönderiliyor…" : confirm ? "Evet, bütün oyunculara gönder" : to === "herkes" ? "Duyuruyu gönder" : "Mesajı gönder"} tone={confirm ? "danger" : "accent"} onPress={send} disabled={!ready || busy} />
        {confirm && <SmallBtn label="Vazgeç" onPress={() => setConfirm(false)} />}
        {!!msg && <Text style={st.meta}>{msg}</Text>}
      </View>

      <Text style={st.h}>Gönderilenler</Text>
      {sent === null ? <ActivityIndicator color={C.brass} /> : !sent.length ? <Text style={st.meta}>Henüz mesaj yok.</Text> : sent.map(m => (
        <View key={m.id} style={st.item}>
          <View style={st.row}>
            <Chip label={m.tur === "duyuru" ? "DUYURU" : m.tur === "yanit" ? "YANIT" : "MESAJ"} color={m.tur === "duyuru" ? C.p1 : m.tur === "yanit" ? C.good : C.brassDim} />
            <Text style={st.meta}>{m.kullanici_id ? `→ ${m.ad_soyad || "(silinmiş üye)"}${m.eposta ? " · " + m.eposta : ""}` : "→ herkes"}{m.ilgili_bildirim != null ? ` · bildirim #${m.ilgili_bildirim}` : ""}</Text>
            <View style={{ flex: 1 }} />
            <Text style={st.meta}>{fmt(m.created_at)} · {m.kullanici_id ? (m.okuyan ? "okundu" : "okunmadı") : `${m.okuyan} kişi okudu`}</Text>
          </View>
          <Text style={st.title}>{m.baslik}</Text>
          <Text style={st.body} numberOfLines={3}>{m.metin}</Text>
          <View style={st.row}>
            {del === m.id
              ? <><SmallBtn label="Evet, sil" tone="danger" onPress={() => remove(m.id)} /><SmallBtn label="Vazgeç" onPress={() => setDel(null)} /></>
              : <SmallBtn label="Sil" tone="danger" onPress={() => setDel(m.id)} />}
          </View>
        </View>
      ))}
    </Section>
  );
}

/* ---------- Hata bildirimleri ---------- */

interface Report {
  id: number; kullanici_id: string | null; ad_soyad: string | null; eposta: string | null; dava_id: string | null; adim: number | null;
  baglam: Record<string, any>; kategori: ReportCategory; aciklama: string; durum: ReportStatus; yanit: string | null; yanit_zamani: string | null; created_at: string;
}
const CAT: Record<ReportCategory, string> = { metin: "Metin / yazım", hukuki: "Hukuki hata", gorsel: "Görsel uyumsuzluk", teknik: "Teknik", diger: "Diğer" };
const DURUM: Record<ReportStatus, { label: string; color: string }> = {
  yeni: { label: "Yeni", color: C.bad }, inceleniyor: { label: "İnceleniyor", color: C.mid }, duzeltildi: { label: "Düzeltildi", color: C.good }, reddedildi: { label: "Reddedildi", color: C.muted }
};
const short = (s: string, n = 90) => (s.length > n ? s.slice(0, n).trim() + "…" : s);
const template = (r: Report, d: ReportStatus) => {
  const dosya = r.baglam?.dava ? `“${r.baglam.dava}” dosyasında ` : "";
  if (d === "duzeltildi") return { baslik: "Bildirdiğiniz hata düzeltildi", metin: `Bildirdiğiniz hata düzeltildi: ${dosya}${short(r.aciklama)}\n\nKatkınız için teşekkür ederiz. Düzeltme bir sonraki açılışta oyunda olacak.` };
  if (d === "reddedildi") return { baslik: "Hata bildiriminiz incelendi", metin: `${dosya}bildirdiğiniz konuyu (${short(r.aciklama, 60)}) inceledik; metnin bu hâliyle doğru olduğu sonucuna vardık.\n\nGerekçe: ` };
  if (d === "inceleniyor") return { baslik: "Hata bildiriminiz inceleniyor", metin: `${dosya}bildirdiğiniz konuyu inceliyoruz: ${short(r.aciklama)}\n\nSonucu yine buradan bildireceğiz.` };
  return { baslik: "Hata bildiriminiz", metin: "" };
};

export function ReportsPanel({ titles, onOpenCase, onClose }: { titles: Record<string, string>; onOpenCase: (id: string) => boolean; onClose: () => void }) {
  const [filter, setFilter] = useState<"hepsi" | ReportStatus>("yeni");
  const [rows, setRows] = useState<Report[] | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const load = async () => {
    const sb = supabase();
    if (!sb) { setErr("Sunucuya ulaşılamıyor."); setRows([]); return; }
    const { data, error } = await sb.rpc("yonetici_hata_listesi", { p_durum: filter === "hepsi" ? null : filter, p_sinir: 200 });
    if (error) { setErr(notReady(error.message)); setRows([]); return; }
    setErr(""); setRows(((data || []) as any[]).map(r => ({ ...r, id: Number(r.id), baglam: r.baglam || {} })));
  };
  useEffect(() => { setRows(null); load(); }, [filter]);

  return (
    <Section title="Hata bildirimleri" hint="Oyuncuların duruşma ekranından gönderdiği bildirimler. Durumu değiştirin; üye bildirimlerine yanıt yazarsanız oyuncunun gelen kutusuna düşer."
      right={<SmallBtn label="Kapat" onPress={onClose} />}>
      <Seg value={filter} onChange={setFilter} options={[{ v: "yeni", label: "Yeni" }, { v: "inceleniyor", label: "İnceleniyor" }, { v: "duzeltildi", label: "Düzeltildi" }, { v: "reddedildi", label: "Reddedildi" }, { v: "hepsi", label: "Hepsi" }]} />
      {!!err && <Text style={st.err}>{err}</Text>}
      {rows === null ? <ActivityIndicator color={C.brass} /> : !rows.length && !err ? <Text style={st.meta}>Bu durumda bildirim yok.</Text> : null}
      {(rows || []).map(r => <ReportItem key={r.id} r={r} title={r.dava_id ? titles[r.dava_id] : undefined} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} onOpenCase={onOpenCase} onChanged={load} />)}
    </Section>
  );
}

function ReportItem({ r, title, open, onToggle, onOpenCase, onChanged }: { r: Report; title?: string; open: boolean; onToggle: () => void; onOpenCase: (id: string) => boolean; onChanged: () => void }) {
  const [durum, setDurum] = useState<ReportStatus>(r.durum === "yeni" ? "duzeltildi" : r.durum);
  const [baslik, setBaslik] = useState(template(r, durum).baslik);
  const [metin, setMetin] = useState(template(r, durum).metin);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const b = r.baglam || {};
  const d = DURUM[r.durum] || DURUM.yeni;
  const pickDurum = (v: ReportStatus) => { setDurum(v); const tp = template(r, v); setBaslik(tp.baslik); setMetin(tp.metin); };
  const statusOnly = async (v: ReportStatus) => {
    setBusy(true); const res = await setReportStatus(r.id, v); setBusy(false);
    if (res.error) setMsg(notReady(res.error)); else onChanged();
  };
  const reply = async () => {
    setBusy(true); setMsg("");
    const res = await mesajGonder({ kime: r.kullanici_id, ilgiliBildirim: r.id, durum, baslik, metin, yanit: metin });
    setBusy(false);
    if (res.error) setMsg("Gönderilemedi: " + notReady(res.error)); else { setMsg("Yanıt gönderildi."); onChanged(); }
  };
  return (
    <View style={st.item}>
      <View style={st.row}>
        <Text style={st.idT}>#{r.id}</Text>
        <Chip label={d.label.toLocaleUpperCase("tr")} color={d.color} />
        <Chip label={CAT[r.kategori] || r.kategori} color={C.brassDim} />
        <View style={{ flex: 1 }} />
        <Text style={st.meta}>{fmt(r.created_at)}</Text>
      </View>
      <Text style={st.title} numberOfLines={1}>{title || b.dava || r.dava_id || "(dosya yok)"}{r.adim != null ? ` · adım ${r.adim + 1}` : ""}</Text>
      <Text style={st.meta}>{r.kullanici_id ? `${r.ad_soyad || "(adsız)"} · ${r.eposta || ""}` : "Misafir (yanıt iletilemez)"}</Text>
      <Text style={st.body}>{r.aciklama}</Text>
      <View style={st.ctx}>
        {!!b.satir && <Text style={st.ctxT} numberOfLines={open ? undefined : 2}>{b.konusan ? `${b.konusan}: ` : ""}“{b.satir}”</Text>}
        <Text style={st.ctxM}>{[r.dava_id, b.asama && `aşama ${b.asama}${b.satir_no != null ? ` · satır ${b.satir_no + 1}` : ""}`, b.surum, b.platform, b.dil, b.ekran, b.gorunum].filter(Boolean).join(" · ")}</Text>
      </View>
      {!!r.yanit && <Text style={st.answer}>Yanıt{r.yanit_zamani ? ` (${fmt(r.yanit_zamani)})` : ""}: {r.yanit}</Text>}
      <View style={st.row}>
        {!!r.dava_id && <SmallBtn label="Dosyayı düzenleyicide aç" onPress={() => { if (!onOpenCase(r.dava_id!)) setMsg("Bu kimlikte dosya bulunamadı."); }} />}
        {r.durum === "yeni" && <SmallBtn label="İnceleniyor yap" onPress={() => statusOnly("inceleniyor")} disabled={busy} />}
        <SmallBtn label={open ? "Yanıtı kapat" : r.kullanici_id ? "Durum ve yanıt" : "Durumu değiştir"} tone={open ? "plain" : "accent"} onPress={onToggle} />
        {!!msg && !open && <Text style={st.meta}>{msg}</Text>}
      </View>
      {open && (
        <View style={st.replyBox}>
          <Seg label="Yeni durum" value={durum} onChange={pickDurum} options={[{ v: "inceleniyor", label: "İnceleniyor" }, { v: "duzeltildi", label: "Düzeltildi" }, { v: "reddedildi", label: "Reddedildi" }, { v: "yeni", label: "Yeni" }]} />
          {r.kullanici_id ? (
            <>
              <Row><Field label="Başlık" value={baslik} onChange={setBaslik} /></Row>
              <Area label="Oyuncuya yanıt (gelen kutusuna düşer)" value={metin} onChange={setMetin} rows={5} />
            </>
          ) : <Text style={st.meta}>Misafir bildirimi: oyuncuya ulaşılamaz, yalnız durum kaydedilir.</Text>}
          <View style={st.row}>
            {r.kullanici_id && <SmallBtn label={busy ? "Gönderiliyor…" : "Durumu kaydet ve yanıtı gönder"} tone="accent" onPress={reply} disabled={busy || !metin.trim()} />}
            <SmallBtn label="Yalnız durumu kaydet" onPress={() => statusOnly(durum)} disabled={busy} />
            {!!msg && <Text style={st.meta}>{msg}</Text>}
          </View>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  search: { fontFamily: F.body, fontSize: 16, color: C.text, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  pick: { backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 9 },
  pickT: { fontFamily: F.bodyMed, fontSize: 15, color: C.text },
  h: { fontFamily: F.displayMed, fontSize: 16, color: C.text, marginTop: 8 },
  item: { backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, gap: 6 },
  idT: { fontFamily: F.monoBold, fontSize: 13, color: C.brass },
  title: { fontFamily: F.displayMed, fontSize: 16, color: C.text },
  body: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: C.textSoft },
  meta: { fontFamily: F.body, fontSize: 12, color: C.muted },
  err: { fontFamily: F.body, fontSize: 14, color: C.bad },
  ctx: { borderLeftWidth: 3, borderLeftColor: C.line, paddingLeft: 8, gap: 2 },
  ctxT: { fontFamily: F.bodyItalic, fontSize: 14, color: C.textSoft },
  ctxM: { fontFamily: F.mono, fontSize: 11, color: C.muted },
  answer: { fontFamily: F.body, fontSize: 13, color: C.good },
  replyBox: { gap: 8, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 }
});
