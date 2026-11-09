// Föyün başındaki duruşma şeridi: her duruşma küçük bir hap. Hapta iki kutu: duruşmaya girildi mi (☐ / ✓ / ✗; dokununca
// sırayla değişir) ve e-duruşma (e? sorulmadı · e– istenmeyecek · e⏳ talep edildi · e✓ kabul · e✗ red). Mahkeme ya da
// dosya numarası değiştiyse araya küçük bir "↳ yeni mahkeme · yeni no" etiketi girer. En üstte tek satır özet: sorun yoksa
// yeşil "Her şey işlendi ✓". Hapa basınca altında ayrıntı açılır (açılır kutularla). Az yer kaplar; eski duruşmalar katlanır.
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { buroUyeleri, Uye } from "../data/buro";
import { dTur, DTur, Durusma, durusmaEkle, durusmaOzeti, durusmaSirala, durusmaUyarilari, EDurum, eSorulur, evraktanDurusma, Girildi, kunyeDurusmasi, yerDegisti, bugunGun, E_TALEP_GUN } from "../data/durusma";
import { Foy, silineniNotEt, tarihCoz, tarihYaz } from "../data/foy";
import { t } from "../i18n";
import { Acilir } from "./Acilir";
import { s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";

const GOSTER = 6;
const kisaTarih = (x: string) => `${x.slice(8, 10)}.${x.slice(5, 7)}.${x.slice(2, 4)}${x.length > 10 ? " " + x.slice(11, 16) : ""}`;
const E_SIMGE: Record<EDurum | "yok", { s: string; renk: string; ad: string }> = {
  yok: { s: "e?", renk: C.mid, ad: "E-duruşma sorulmadı" },
  istenmeyecek: { s: "e–", renk: C.muted, ad: "E-duruşma istenmeyecek" },
  talep: { s: "e⏳", renk: C.mid, ad: "E-duruşma talep edildi, karar bekleniyor" },
  kabul: { s: "e✓", renk: C.good, ad: "E-duruşma kabul edildi" },
  red: { s: "e✗", renk: C.bad, ad: "E-duruşma reddedildi" }
};
const SONRAKI_GIRILDI: Record<string, Girildi | undefined> = { "": "evet", evet: "hayir", hayir: undefined };

export function DurusmaAkisi({ f, degistir, okumaVar }: { f: Foy; degistir: (ek: Partial<Foy>) => void; okumaVar: boolean }) {
  const [secili, setSecili] = useState<string | null>(null);
  const [hepsi, setHepsi] = useState(false);
  const [yeni, setYeni] = useState("");
  const [yeniTur, setYeniTur] = useState<DTur>("durusma");
  const [mesaj, setMesaj] = useState("");
  const [uyeler, setUyeler] = useState<Uye[]>([]);
  const bugun = bugunGun();
  useEffect(() => { buroUyeleri().then(x => setUyeler(x.uyeler)).catch(() => {}); }, []);
  // Künyedeki "sonraki duruşma" akışta yoksa eklenir.
  useEffect(() => { const xs = kunyeDurusmasi(f); if (xs) degistir({ durusmalar: xs }); }, [f.durusma]);

  const xs = useMemo(() => durusmaSirala(f.durusmalar || []), [f.durusmalar]);
  const uyarilar = useMemo(() => durusmaUyarilari(f, bugun), [f, bugun]);
  const ozet = durusmaOzeti(f, bugun);
  const esor = eSorulur(f);
  const dGuncelle = (d: Durusma, ek: Partial<Durusma> | null) => {
    if (!ek) { degistir({ durusmalar: xs.filter(x => x.id !== d.id), silinen: silineniNotEt(f, [d.id]) }); setSecili(null); return; }
    const y = { ...d, ...ek };
    // Akıştaki en ileri duruşma künyedeki "sonraki duruşma" ile aynı tutulur.
    const liste = durusmaSirala(xs.map(x => (x.id === d.id ? y : x)));
    const ileri = liste.filter(x => x.tarih.slice(0, 10) >= bugun && dTur(x) === "durusma");
    degistir({ durusmalar: liste, ...(ek.tarih && ileri.length ? { durusma: ileri[0].tarih } : {}) });
  };
  const ekle = () => {
    const tarih = tarihCoz(yeni);
    if (!tarih) { setMesaj(t("Tarihi 18.12.2026 ya da 18.12.2026 10:30 biçiminde yazın.")); return; }
    const liste = durusmaEkle(f, tarih, yeniTur === "kesif" ? { tur: "kesif" } : {});
    const ileri = liste.filter(x => x.tarih.slice(0, 10) >= bugun && dTur(x) === "durusma");
    degistir({ durusmalar: liste, ...(ileri.length ? { durusma: ileri[0].tarih } : {}) });
    setYeni(""); setMesaj("");
  };
  const evraktan = () => {
    const r = evraktanDurusma(f, f.evraklar);
    if (r.degisen.length) degistir({ durusmalar: r.durusmalar });
    setMesaj(r.degisen.length ? t("Evraktan işlendi: {x}. Kontrol edin.", { x: r.degisen.join(", ") }) : t("Evrakta yeni duruşma bilgisi bulunamadı (elle işaretlenen kutulara dokunulmaz)."));
  };

  if (!xs.length && !f.durusma) {
    return (
      <View style={[s.card, { paddingVertical: 10, gap: 8 }]}>
        <View style={[s.row, { alignItems: "center" }]}>
          <Text style={[s.body, { color: C.text, fontWeight: "700" }]}>⚖ {t("Duruşma ve keşifler")}</Text>
          <Text style={[s.hint, { flex: 1 }]}>{t("henüz duruşma ya da keşif günü yok")}</Text>
        </View>
        <EkleSatiri yeni={yeni} setYeni={setYeni} ekle={ekle} tur={yeniTur} setTur={setYeniTur} evraktan={okumaVar ? evraktan : undefined} />
        {!!mesaj && <Text style={[s.hint, { color: C.brass }]}>{mesaj}</Text>}
      </View>
    );
  }

  const gizlenen = hepsi ? 0 : Math.max(0, xs.length - GOSTER);
  const gorunen = xs.slice(gizlenen);
  const sec = secili ? xs.find(x => x.id === secili) : undefined;
  const sorunlu = new Set(uyarilar.map(u => u.d?.id).filter(Boolean) as string[]);
  return (
    <View style={[s.card, { paddingVertical: 10, gap: 8, borderColor: ozet.iyi ? C.good + "88" : C.mid }]}>
      <View style={[s.row, { alignItems: "center" }]}>
        <Text style={[s.body, { color: C.text, fontWeight: "700" }]}>⚖ {t("Duruşma ve keşifler")}</Text>
        <Text style={[s.hint, { flex: 1, color: ozet.iyi ? C.good : C.mid, fontWeight: "700" }]} numberOfLines={2}>{t(ozet.metin)}</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {gizlenen > 0 && <Pressable onPress={() => setHepsi(true)} style={hapStil(C.line)}><Text style={s.hint}>{t("+{n} önceki", { n: gizlenen })}</Text></Pressable>}
        {gorunen.map((d, i) => {
          const onceki = i === 0 ? xs[gizlenen - 1] : gorunen[i - 1];
          const yer = yerDegisti(onceki, d);
          const gecmis = d.tarih.slice(0, 10) < bugun, bugunMu = d.tarih.slice(0, 10) === bugun;
          const e = E_SIMGE[d.e || "yok"];
          const renk = sorunlu.has(d.id) ? C.mid : secili === d.id ? C.brass : C.line;
          return (
            <React.Fragment key={d.id}>
              {!!yer && <Text style={{ color: C.brassDim, fontSize: 11, fontWeight: "700" }}>↳ {yer}</Text>}
              <View style={[hapStil(renk), bugunMu && { backgroundColor: C.bordo }]}>
                <Pressable onPress={() => setSecili(secili === d.id ? null : d.id)} accessibilityRole="button" accessibilityLabel={t("Duruşma {d} ayrıntısı", { d: tarihYaz(d.tarih) })}>
                  <Text style={{ color: gecmis ? C.textSoft : C.text, fontSize: 12, fontWeight: "700" }}>{dTur(d) === "kesif" ? "🔍 " + t("Keşif") + " " : ""}{kisaTarih(d.tarih)}</Text>
                </Pressable>
                <Pressable onPress={() => dGuncelle(d, { girildi: SONRAKI_GIRILDI[d.girildi || ""] })} hitSlop={6} accessibilityRole="checkbox"
                  accessibilityState={{ checked: d.girildi === "evet" }} accessibilityLabel={t("Duruşmaya girildi mi")}
                  style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, alignItems: "center", justifyContent: "center",
                    borderColor: d.girildi === "evet" ? C.good : d.girildi === "hayir" ? C.bad : gecmis ? C.mid : C.muted,
                    backgroundColor: d.girildi === "evet" ? C.good : d.girildi === "hayir" ? C.bad : "transparent" }}>
                  {!!d.girildi && <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12, lineHeight: 14 }}>{d.girildi === "evet" ? "✓" : "✗"}</Text>}
                </Pressable>
                {(esor || !!d.e) && dTur(d) === "durusma" && (
                  <Pressable onPress={() => setSecili(secili === d.id ? null : d.id)} hitSlop={6} accessibilityLabel={t(e.ad)}>
                    <Text style={{ color: d.e ? e.renk : gecmis ? C.muted : e.renk, fontSize: 12, fontWeight: "800" }}>{e.s}</Text>
                  </Pressable>
                )}
              </View>
            </React.Fragment>
          );
        })}
      </View>

      {sec && (
        <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
            <Acilir etiket={t("Tür")} secili={dTur(sec)} genislik={140} onSec={k => dGuncelle(sec, { tur: k === "kesif" ? "kesif" : undefined, ...(k === "kesif" ? { e: undefined } : {}) })}
              secenekler={[{ k: "durusma", ad: "⚖ " + t("Duruşma") }, { k: "kesif", ad: "🔍 " + t("Keşif") }]} />
            <Acilir etiket={dTur(sec) === "kesif" ? t("Keşfe katılındı mı?") : t("Duruşmaya girildi mi?")} secili={sec.girildi || "-"} genislik={180} onSec={k => dGuncelle(sec, { girildi: k === "-" ? undefined : k as Girildi })}
              secenekler={[{ k: "-", ad: t("İşaretlenmedi") }, { k: "evet", ad: "✓ " + (dTur(sec) === "kesif" ? t("Katılındı") : t("Girildi")) }, { k: "hayir", ad: "✗ " + (dTur(sec) === "kesif" ? t("Katılınmadı") : t("Girilmedi")) }]} />
            {(esor || !!sec.e) && dTur(sec) === "durusma" && <Acilir etiket={t("E-duruşma")} secili={sec.e || "-"} genislik={230}
              onSec={k => dGuncelle(sec, { e: k === "-" ? undefined : k as EDurum, ...(k === "talep" && !sec.eTalep ? { eTalep: bugun } : {}), ...((k === "kabul" || k === "red") && !sec.eKarar ? { eKarar: bugun } : {}) })}
              secenekler={[{ k: "-", ad: t("Henüz karar verilmedi") }, { k: "istenmeyecek", ad: t("Talep edilmeyecek") }, { k: "talep", ad: "⏳ " + t("Talep edildi, karar bekleniyor") }, { k: "kabul", ad: "✓ " + t("Kabul edildi") }, { k: "red", ad: "✗ " + t("Reddedildi") }]} />}
            {uyeler.length > 1 && <Acilir etiket={t("Bu dosyanın sorumlusu")} secili={f.sorumlu?.id || "-"} genislik={200}
              onSec={k => { const u = uyeler.find(x => x.kullanici_id === k); degistir({ sorumlu: u ? { id: u.kullanici_id, ad: u.ad } : undefined }); }}
              secenekler={[{ k: "-", ad: t("Yalnız yöneticiler") }, ...uyeler.map(u => ({ k: u.kullanici_id, ad: `${u.ad} · ${t(u.unvan)}` }))]} />}
            {!!f.tevkil?.length && <Acilir etiket={t("Tevkilen giren avukat")} genislik={210}
              secili={f.tevkil.find(x => x.durusmalar?.includes(sec.id))?.id || "-"}
              onSec={k => degistir({ tevkil: f.tevkil!.map(x => ({ ...x, durusmalar: x.id === k ? [...new Set([...(x.durusmalar || []), sec.id])] : (x.durusmalar || []).filter(y => y !== sec.id) })) })}
              secenekler={[{ k: "-", ad: t("Yok (kendimiz girdik)") }, ...f.tevkil.map(x => ({ k: x.id, ad: x.ad }))]} />}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }} key={sec.id}>
            <Alan etiket={t("Gün ve saat")} deger={tarihYaz(sec.tarih)} genislik={150} onDegis={v => { const d = tarihCoz(v); if (d) dGuncelle(sec, { tarih: d }); }} />
            <Alan etiket={t("Mahkeme (değiştiyse)")} deger={sec.mahkeme || ""} genislik={240} onDegis={v => dGuncelle(sec, { mahkeme: v.trim() || undefined })} />
            <Alan etiket={t("Esas no (değiştiyse)")} deger={sec.esasNo || ""} genislik={130} onDegis={v => dGuncelle(sec, { esasNo: v.trim() || undefined })} />
            <Alan etiket={t("Not")} deger={sec.not || ""} genislik={220} onDegis={v => dGuncelle(sec, { not: v || undefined })} />
          </View>
          <Text style={s.hint}>
            {[sec.eTalep ? t("e-duruşma talebi {d}", { d: tarihYaz(sec.eTalep) }) : "", sec.eKarar ? t("karar {d}", { d: tarihYaz(sec.eKarar) }) : "",
              !sec.e && esor && sec.tarih.slice(0, 10) >= bugun ? t("Talep için son gün sayılan tarih: duruşmadan {n} gün önce.", { n: E_TALEP_GUN }) : "",
              sec.kaynak === "evrak" ? t("evraktan okundu") : ""].filter(Boolean).join(" · ")}
          </Text>
          <View style={s.row}><Btn kind="ghost" label={t("Bu duruşmayı sil")} onPress={() => dGuncelle(sec, null)} /><Btn kind="ghost" label={t("Kapat")} onPress={() => setSecili(null)} /></View>
        </View>
      )}

      {uyarilar.length > 0 && !sec && (
        <View style={{ gap: 2 }}>
          {uyarilar.slice(0, 3).map((u, i) => (
            <Pressable key={i} onPress={() => u.d && setSecili(u.d.id)}>
              <Text style={[s.hint, { color: u.duzey === "gecikti" || u.duzey === "bugun" || u.duzey === "acil" ? C.bad : C.mid }]}>
                • {u.d ? kisaTarih(u.d.tarih) + ": " : ""}{t(u.metin)}{u.kalan > 0 ? " · " + t("son güne {n} gün", { n: u.kalan }) : u.kalan === 0 ? " · " + t("bugün") : ""}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <EkleSatiri yeni={yeni} setYeni={setYeni} ekle={ekle} tur={yeniTur} setTur={setYeniTur} evraktan={okumaVar ? evraktan : undefined} />
      {!!mesaj && <Text style={[s.hint, { color: C.brass }]}>{mesaj}</Text>}
    </View>
  );
}

const hapStil = (renk: string) => ({ flexDirection: "row" as const, alignItems: "center" as const, gap: 6, borderWidth: 1, borderColor: renk, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.panel2 });

/** Yazarken değil, kutudan çıkınca (ya da Enter'da) kaydedilir: yarım yazılmış tarih akışı karıştırmasın. */
function Alan({ etiket, deger, genislik, onDegis }: { etiket: string; deger: string; genislik: number; onDegis: (v: string) => void }) {
  const [v, setV] = useState(deger);
  const bitir = () => { if (v !== deger) onDegis(v); };
  return (
    <View style={{ gap: 4, width: genislik, flexGrow: 1 }}>
      <Text style={{ color: C.muted, fontSize: 11, letterSpacing: 0.5 }}>{etiket}</Text>
      <TextInput value={v} onChangeText={setV} onBlur={bitir} onSubmitEditing={bitir} placeholderTextColor={C.muted} style={[s.inputTek, { paddingVertical: 6 }]} />
    </View>
  );
}

function EkleSatiri({ yeni, setYeni, ekle, evraktan, tur, setTur }: { yeni: string; setYeni: (v: string) => void; ekle: () => void; evraktan?: () => void; tur: DTur; setTur: (x: DTur) => void }) {
  return (
    <View style={[s.row, { alignItems: "center", gap: 6 }]}>
      <Pressable onPress={() => setTur(tur === "durusma" ? "kesif" : "durusma")} accessibilityRole="button" accessibilityLabel={t("Tür: {x}", { x: tur === "kesif" ? t("Keşif") : t("Duruşma") })}
        style={{ borderWidth: 1, borderColor: C.brassDim, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }}>
        <Text style={{ color: C.text, fontSize: 13, fontWeight: "700" }}>{tur === "kesif" ? "🔍 " + t("Keşif") : "⚖ " + t("Duruşma")} ⇄</Text>
      </Pressable>
      <TextInput value={yeni} onChangeText={setYeni} onSubmitEditing={ekle} placeholder={tur === "kesif" ? t("+ keşif günü: 18.12.2026 10:30") : t("+ duruşma günü: 18.12.2026 10:30")} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1, minWidth: 180, paddingVertical: 6 }]} />
      <Btn kind="secondary" label={t("Ekle")} onPress={ekle} disabled={!yeni.trim()} />
      {evraktan && <Btn kind="ghost" label={t("Evraktan oku")} onPress={evraktan} />}
    </View>
  );
}
