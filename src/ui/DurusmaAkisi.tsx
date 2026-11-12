// Föyün başındaki duruşma şeridi: her duruşma küçük bir hap. Hapta iki kutu: duruşmaya girildi mi (☐ / ✓ / ✗; dokununca
// sırayla değişir) ve e-duruşma kutusu ("E-duruşma: ?", "kabul ✓", "red ✗", "talep edildi ⏳", "istenmeyecek"). Mahkeme ya da
// dosya numarası değiştiyse araya küçük bir "↳ yeni mahkeme · yeni no" etiketi girer. En üstte tek satır özet: sorun yoksa
// yeşil "Her şey işlendi ✓". Hapa basınca altında ayrıntı açılır (açılır kutularla). Az yer kaplar; eski duruşmalar katlanır.
import { beyanDosyaAdi, ciktiBicimi, eDurusmaTalebi, tamMetin, udfOlustur } from "../data/beyan";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { buroUyeleri, Uye } from "../data/buro";
import { dTur, DTur, DTUR_AD, DTUR_SIMGE, girildiSoru, gunTurleri, icraMi, Durusma, durusmaEkle, durusmaOzeti, durusmaSirala, durusmaUyarilari, EDurum, eSorulur, evraktanDurusma, Girildi, kunyeDurusmasi, durusmaDuzeni, yerDegisti, bugunGun, E_TALEP_GUN } from "../data/durusma";
import { ayarOku, Foy, silineniNotEt, tarihCoz, tarihYaz } from "../data/foy";
import { t } from "../i18n";
import { Acilir } from "./Acilir";
import { indir, s } from "./foyStil";
import { Btn } from "./kit";
import { C } from "./theme";
import { eKarar } from "../data/otoIs";

const GOSTER = 6;
const kisaTarih = (x: string) => `${x.slice(8, 10)}.${x.slice(5, 7)}.${x.slice(2, 4)}${x.length > 10 ? " " + x.slice(11, 16) : ""}`;
const E_SIMGE: Record<EDurum | "yok", { s: string; renk: string; ad: string }> = {
  yok: { s: "E-duruşma: ?", renk: C.mid, ad: "E-duruşma sorulmadı" },
  istenmeyecek: { s: "E-duruşma: istenmeyecek", renk: C.muted, ad: "E-duruşma istenmeyecek" },
  talep: { s: "E-duruşma: talep edildi ⏳", renk: C.mid, ad: "E-duruşma talep edildi, karar bekleniyor" },
  kabul: { s: "E-duruşma: kabul ✓", renk: C.good, ad: "E-duruşma kabul edildi" },
  red: { s: "E-duruşma: red ✗", renk: C.bad, ad: "E-duruşma reddedildi" }
};
const SONRAKI_GIRILDI: Record<string, Girildi | undefined> = { "": "evet", evet: "hayir", hayir: undefined };

/** E-duruşma kutusu: tıklama (dokunma) kabul, sağ tık (telefonda basılı tutma) red; aynı karara ikinci basış kararı kaldırır. */
function EKutu({ ad, onKabul, onRed, children }: { ad: string; onKabul: () => void; onRed: () => void; children: React.ReactNode }) {
  const ref = useRef<React.ElementRef<typeof Pressable>>(null);
  const red = useRef(onRed); red.current = onRed;
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const el = ref.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    const f = (e: MouseEvent) => { e.preventDefault(); red.current(); };
    el.addEventListener("contextmenu", f);
    return () => el.removeEventListener("contextmenu", f);
  }, []);
  return (
    <Pressable ref={ref} onPress={onKabul} onLongPress={Platform.OS === "web" ? undefined : onRed} delayLongPress={450} hitSlop={6}
      accessibilityLabel={ad + " · " + t("dokunun: kabul, sağ tık ya da basılı tutun: red")}
      {...(Platform.OS === "web" ? { title: t("Sol tık: e-duruşma kabul · Sağ tık: red") } as object : {})}>
      {children}
    </Pressable>
  );
}

export function DurusmaAkisi({ f, degistir, okumaVar }: { f: Foy; degistir: (ek: Partial<Foy>) => void; okumaVar: boolean }) {
  const [secili, setSecili] = useState<string | null>(null);
  const [hepsi, setHepsi] = useState(false);
  const [yeni, setYeni] = useState("");
  const turler = gunTurleri(f);
  const [yeniTur, setYeniTur] = useState<DTur>(turler[0]);
  const baslik = icraMi(f) ? t("Haciz ve keşif günleri") : t("Duruşma ve keşifler");
  const [mesaj, setMesaj] = useState("");
  const [uyeler, setUyeler] = useState<Uye[]>([]);
  const bugun = bugunGun();
  const [benAd, setBenAd] = useState("");
  useEffect(() => {
    buroUyeleri().then(x => { setUyeler(x.uyeler); const b = x.uyeler.find(u => u.kullanici_id === x.ben); if (b?.ad) setBenAd(b.ad); }).catch(() => {});
    ayarOku<string>("beyanVekil").then(v => { if (v) setBenAd(a => a || v); }).catch(() => {});
  }, []);
  // E-duruşma talep dilekçesi: föyden hazır UDF; föyün beyan taslaklarına da kaydedilir.
  const talepDilekcesi = async (d: Durusma) => {
    const vekil = (await ayarOku<string>("beyanVekil").catch(() => "")) || "";
    const b = eDurusmaTalebi(d.tarih);
    const fy = { ...f, mahkeme: d.mahkeme || f.mahkeme, esasNo: d.esasNo || f.esasNo };
    const metin = tamMetin(fy, b, { vekil });
    const cb = ciktiBicimi(fy, b, { vekil });
    indir(beyanDosyaAdi(fy, b, "udf"), new Blob([udfOlustur(metin, cb.imza, cb.ortaBaslik) as BlobPart], { type: "application/octet-stream" }));
    degistir({ beyanlar: [b, ...(f.beyanlar || []).filter(x => x.id !== b.id)].slice(0, 50) });
    setMesaj(vekil ? t("Dilekçe indirildi ve föyün beyanlarına kaydedildi. UYAP'tan gönderince “Talebi UYAP'tan gönderdim”e basın.") : t("Dilekçe indirildi. İmzadaki vekil adı için Beyan editöründe bir kez vekil adınızı yazın."));
  };
  // Künyedeki "sonraki duruşma" akışta yoksa eklenir.
  useEffect(() => { const xs = kunyeDurusmasi(f); if (xs) degistir({ durusmalar: xs }); }, [f.durusma]);

  const xs = useMemo(() => durusmaSirala(f.durusmalar || []), [f.durusmalar]);
  const uyarilar = useMemo(() => durusmaUyarilari(f, bugun), [f, bugun]);
  // Gün ekleme satırı istenince açılır (ekranda yer kaplamasın); uyarılar başlıktaki özetle ve Yapılacaklar'daki işlerle gösterilir.
  const [ekleAcik, setEkleAcik] = useState(false);
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
    const liste = durusmaEkle(f, tarih, yeniTur === "durusma" ? {} : { tur: yeniTur });
    const ileri = liste.filter(x => x.tarih.slice(0, 10) >= bugun && dTur(x) === "durusma");
    degistir({ durusmalar: liste, ...(ileri.length ? { durusma: ileri[0].tarih } : {}) });
    setYeni(""); setMesaj(""); setEkleAcik(false);
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
          <Text style={[s.body, { color: C.text, fontWeight: "700" }]}>{icraMi(f) ? "📌" : "⚖"} {baslik}</Text>
          <Text style={[s.hint, { flex: 1 }]}>{icraMi(f) ? t("henüz haciz ya da keşif günü yok") : t("henüz duruşma ya da keşif günü yok")}</Text>
        </View>
        {durusmaDuzeni(f) === "talepli" && <Text style={s.hint}>{t("Bu tür dosyada duruşma her celsede olmaz; yalnız talep ya da karar üzerine (çoğu zaman bir kez) yapılır. Duruşma günü verilirse buraya ekleyin.")}</Text>}
        {ekleAcik
          ? <EkleSatiri yeni={yeni} setYeni={setYeni} ekle={ekle} tur={yeniTur} turler={turler} setTur={setYeniTur} evraktan={okumaVar ? evraktan : undefined} />
          : <Pressable onPress={() => setEkleAcik(true)} accessibilityRole="button"><Text style={s.link}>{icraMi(f) ? t("+ Haciz / keşif günü ekle") : t("+ Duruşma / keşif günü ekle")}</Text></Pressable>}
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
        <Text style={[s.body, { color: C.text, fontWeight: "700" }]}>{icraMi(f) ? "📌" : "⚖"} {baslik}</Text>
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
                  <Text style={{ color: gecmis ? C.textSoft : C.text, fontSize: 12, fontWeight: "700" }}>{dTur(d) !== "durusma" || icraMi(f) ? DTUR_SIMGE[dTur(d)] + " " + t(DTUR_AD[dTur(d)]) + " " : ""}{kisaTarih(d.tarih)}</Text>
                </Pressable>
                <Pressable onPress={() => dGuncelle(d, { girildi: SONRAKI_GIRILDI[d.girildi || ""] })} hitSlop={6} accessibilityRole="checkbox"
                  accessibilityState={{ checked: d.girildi === "evet" }} accessibilityLabel={t("Duruşmaya girildi mi")}
                  style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, alignItems: "center", justifyContent: "center",
                    borderColor: d.girildi === "evet" ? C.good : d.girildi === "hayir" ? C.bad : gecmis ? C.mid : C.muted,
                    backgroundColor: d.girildi === "evet" ? C.good : d.girildi === "hayir" ? C.bad : "transparent" }}>
                  {!!d.girildi && <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12, lineHeight: 14 }}>{d.girildi === "evet" ? "✓" : "✗"}</Text>}
                </Pressable>
                {esor && dTur(d) === "durusma" && (
                  <EKutu ad={t(e.ad)} onKabul={() => degistir(eKarar(f, d.id, "kabul"))} onRed={() => degistir(eKarar(f, d.id, "red"))}>
                    <View style={{ borderWidth: 1, borderColor: d.e ? e.renk : gecmis ? C.line : e.renk, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 }}>
                      <Text style={{ color: d.e ? e.renk : gecmis ? C.muted : e.renk, fontSize: 12, fontWeight: "800" }}>{t(e.s)}</Text>
                    </View>
                  </EKutu>
                )}
              </View>
            </React.Fragment>
          );
        })}
      </View>

      {sec && (
        <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
            <Acilir etiket={t("Tür")} secili={dTur(sec)} genislik={140} onSec={k => dGuncelle(sec, { tur: k === "durusma" ? undefined : k as DTur, ...(k !== "durusma" ? { e: undefined } : {}) })}
              secenekler={[...new Set([...turler, dTur(sec)])].map(k => ({ k, ad: DTUR_SIMGE[k] + " " + t(DTUR_AD[k]) }))} />
            <Acilir etiket={t(girildiSoru(dTur(sec)))} secili={sec.girildi || "-"} genislik={180} onSec={k => dGuncelle(sec, { girildi: k === "-" ? undefined : k as Girildi })}
              secenekler={[{ k: "-", ad: t("İşaretlenmedi") }, { k: "evet", ad: "✓ " + (dTur(sec) === "kesif" ? t("Katılındı") : dTur(sec) === "haciz" ? t("Gidildi") : t("Girildi")) }, { k: "hayir", ad: "✗ " + (dTur(sec) === "kesif" ? t("Katılınmadı") : dTur(sec) === "haciz" ? t("Gidilmedi") : t("Girilmedi")) }]} />
            {esor && dTur(sec) === "durusma" && <Acilir etiket={t("E-duruşma")} secili={sec.e || "-"} genislik={230}
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
          {esor && dTur(sec) === "durusma" && sec.tarih.slice(0, 10) >= bugun && (
            <View style={{ gap: 6, borderWidth: 1, borderColor: sec.e === "kabul" ? C.good : sec.e === "red" ? C.bad : sec.e === "talep" ? C.mid : C.line, borderRadius: 8, padding: 8 }}>
              <Text style={[s.hint, { color: C.text, fontWeight: "700" }]}>{t("E-duruşma")}: {t(E_SIMGE[sec.e || "yok"].ad)}{sec.eTalepEden ? " · " + t("talep eden: {k}", { k: sec.eTalepEden }) : ""}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(!sec.e || sec.e === "istenmeyecek") && <>
                  {Platform.OS === "web" && <Btn kind="secondary" label={t("📝 Talep dilekçesini indir (UYAP UDF)")} onPress={() => talepDilekcesi(sec)} />}
                  <Btn label={t("✓ Talebi UYAP'tan gönderdim")} onPress={() => dGuncelle(sec, { e: "talep", eTalep: bugun, eTalepEden: benAd || undefined })} />
                </>}
                {sec.e === "talep" && <>
                  <Btn label={t("✓ Kabul edildi")} onPress={() => dGuncelle(sec, { e: "kabul", eKarar: bugun })} />
                  <Btn kind="secondary" label={t("✗ Reddedildi")} onPress={() => dGuncelle(sec, { e: "red", eKarar: bugun })} />
                </>}
              </View>
              {sec.e === "talep" && <Text style={s.hint}>{t("Karar gelene kadar her gün hatırlatılır; duruşmaya iki gün kala karar yoksa acil uyarı ve bildirim gelir. Ret gelirse duruşmaya girecek kişiyi ayarlayın.")}</Text>}
              {sec.e === "red" && <Text style={[s.hint, { color: C.bad }]}>{t("E-duruşma reddedildi: duruşmaya bizzat ya da tevkille girilecek.")}</Text>}
            </View>
          )}
          <Text style={s.hint}>
            {[sec.eTalep ? t("e-duruşma talebi {d}", { d: tarihYaz(sec.eTalep) }) : "", sec.eKarar ? t("karar {d}", { d: tarihYaz(sec.eKarar) }) : "",
              !sec.e && esor && sec.tarih.slice(0, 10) >= bugun ? t("Talep için son gün sayılan tarih: duruşmadan {n} gün önce.", { n: E_TALEP_GUN }) : "",
              sec.kaynak === "evrak" ? t("evraktan okundu") : ""].filter(Boolean).join(" · ")}
          </Text>
          <View style={s.row}><Btn kind="ghost" label={t("Bu duruşmayı sil")} onPress={() => dGuncelle(sec, null)} /><Btn kind="ghost" label={t("Kapat")} onPress={() => setSecili(null)} /></View>
        </View>
      )}

      {ekleAcik
          ? <EkleSatiri yeni={yeni} setYeni={setYeni} ekle={ekle} tur={yeniTur} turler={turler} setTur={setYeniTur} evraktan={okumaVar ? evraktan : undefined} />
          : <Pressable onPress={() => setEkleAcik(true)} accessibilityRole="button"><Text style={s.link}>{icraMi(f) ? t("+ Haciz / keşif günü ekle") : t("+ Duruşma / keşif günü ekle")}</Text></Pressable>}
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

function EkleSatiri({ yeni, setYeni, ekle, evraktan, tur, turler, setTur }: { yeni: string; setYeni: (v: string) => void; ekle: () => void; evraktan?: () => void; tur: DTur; turler: DTur[]; setTur: (x: DTur) => void }) {
  return (
    <View style={[s.row, { alignItems: "center", gap: 6 }]}>
      <Pressable onPress={() => setTur(turler[(turler.indexOf(tur) + 1) % turler.length])} accessibilityRole="button" accessibilityLabel={t("Tür: {x}", { x: t(DTUR_AD[tur]) })}
        style={{ borderWidth: 1, borderColor: C.brassDim, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }}>
        <Text style={{ color: C.text, fontSize: 13, fontWeight: "700" }}>{DTUR_SIMGE[tur] + " " + t(DTUR_AD[tur])} ⇄</Text>
      </Pressable>
      <TextInput value={yeni} onChangeText={setYeni} onSubmitEditing={ekle} placeholder={t("+ {x} günü: 18.12.2026 10:30", { x: t(DTUR_AD[tur]).toLocaleLowerCase("tr") })} placeholderTextColor={C.muted} style={[s.inputTek, { flex: 1, minWidth: 180, paddingVertical: 6 }]} />
      <Btn kind="secondary" label={t("Ekle")} onPress={ekle} disabled={!yeni.trim()} />
      {evraktan && <Btn kind="ghost" label={t("Evraktan oku")} onPress={evraktan} />}
    </View>
  );
}
