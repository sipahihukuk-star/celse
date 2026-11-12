// İş arşivi kartı (Föylerim ana sayfası): süresi geçen ve tamamlanan işler burada birikir. Saklama süresi 1 ay – 1 yıl; süresi
// dolanlar avukatın seçimine göre ya kendiliğinden silinir ya da önce Excel dosyası olarak ona gönderilir (telefonda paylaşım
// penceresinden e-posta / WhatsApp'a, bilgisayarda indirme), sonra silinir.
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { ayarOku, ayarYaz, Foy, foyBaslik, foylerKaydet } from "../data/foy";
import { ARSIV_AD, ARSIV_VARSAYILAN, ArsivAyar, arsivdenSil, arsivListesi, ArsivSatir, arsivTablosu, ArsivTur, SAKLAMA_AY, suresiDolanlar } from "../data/isArsivi";
import { bugunStr } from "../data/isTakibi";
import { xlsxYaz } from "../data/xlsxYaz";
import { t } from "../i18n";
import { Acilir } from "./Acilir";
import { indir, s } from "./foyStil";
import { Katlanir } from "./Katlanir";
import { Sayfali } from "./Sayfalama";
import { Btn } from "./kit";
import { C } from "./theme";

const RENK: Record<ArsivTur, string> = { gecmis_acik: C.bad, gecmis_kapandi: C.mid, tamamlandi: C.good };
const trTarih = (x?: string) => (x ? x.slice(0, 10).split("-").reverse().join(".") : "");

/** Kayıtları Excel dosyası olarak avukata verir: paylaşım penceresi varsa (telefon) oradan, yoksa indirme. */
async function gonder(xs: ArsivSatir[], ad: string): Promise<boolean> {
  const b = xlsxYaz("İş arşivi", arsivTablosu(xs), [20, 46, 34, 30, 12, 11, 11, 11, 30]);
  const blob = new Blob([b as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  try {
    const nav = globalThis.navigator as Navigator & { canShare?: (d: unknown) => boolean };
    const dosya = typeof File !== "undefined" ? new File([blob], ad, { type: blob.type }) : null;
    if (Platform.OS === "web" && dosya && nav?.share && nav.canShare?.({ files: [dosya] }) && /Android|iPhone|iPad/i.test(nav.userAgent)) {
      await nav.share({ files: [dosya], title: t("Celse iş arşivi") });
      return true;
    }
  } catch (e) { if ((e as Error)?.name === "AbortError") return false; }
  indir(ad, blob);
  return true;
}

export function IsArsivi({ liste, onAc, zorla }: { liste: Foy[]; onAc: (id: string) => void; zorla?: boolean }) {
  const bugun = bugunStr();
  const [ayar, setAyar] = useState<ArsivAyar>(ARSIV_VARSAYILAN);
  const [hazir, setHazir] = useState(false);
  const [goster, setGoster] = useState<"hepsi" | ArsivTur>("hepsi");
  const [mesaj, setMesaj] = useState("");
  useEffect(() => { ayarOku<ArsivAyar>("isArsivi").then(a => { if (a?.ay) setAyar(a); }).catch(() => {}).finally(() => setHazir(true)); }, []);
  const ayarDegis = (ek: Partial<ArsivAyar>) => { const y = { ...ayar, ...ek }; setAyar(y); ayarYaz("isArsivi", y).catch(() => {}); };
  const arsiv = useMemo(() => arsivListesi(liste, bugun), [liste, bugun]);
  const dolan = useMemo(() => suresiDolanlar(liste, ayar.ay, bugun), [liste, ayar.ay, bugun]);
  // "Kendiliğinden sil" seçiliyse süresi dolanlar sessizce silinir.
  useEffect(() => {
    if (!hazir || ayar.mod !== "sil" || !dolan.length) return;
    foylerKaydet(arsivdenSil(dolan)).then(() => setMesaj(t("Saklama süresi dolan {n} kayıt silindi.", { n: dolan.length }))).catch(() => {});
  }, [hazir, ayar.mod, dolan.length]);

  const sayi = (k: ArsivTur) => arsiv.filter(x => x.tur === k).length;
  const gorunen = arsiv.filter(x => goster === "hepsi" || x.tur === goster);
  const gonderSil = async (sil: boolean) => {
    if (sil && !(await gonder(dolan, `celse-is-arsivi-silinenler-${bugun}.xlsx`))) return;
    await foylerKaydet(arsivdenSil(dolan));
    setMesaj(sil ? t("{n} kayıt size gönderildi ve arşivden silindi.", { n: dolan.length }) : t("{n} kayıt silindi.", { n: dolan.length }));
  };
  if (!arsiv.length && !mesaj) return null;

  return (
    <Katlanir anahtar="is-arsivi" zorla={zorla} baslik={t("🗄 Arşiv: süresi geçenler ve tamamlananlar")}
      ozet={t("{a} süresi geçmiş · {b} süresi geçip kapanan · {c} tamamlanan", { a: sayi("gecmis_acik"), b: sayi("gecmis_kapandi"), c: sayi("tamamlandi") })}>
      <Text style={s.hint}>{t("Son günü geçen işler yaklaşanlardan çıkıp burada durur; yapılmadan anlamını yitiren işler (ör. duruşma günü geçmiş e-duruşma talebi) “süresi geçti” diye kapanır. Kayıtlar seçtiğiniz süre kadar saklanır.")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
        <Acilir etiket={t("Saklama süresi")} secili={String(ayar.ay)} genislik={150} onSec={k => ayarDegis({ ay: Number(k) })}
          secenekler={SAKLAMA_AY.map(a => ({ k: String(a), ad: a === 12 ? t("1 yıl") : t("{n} ay", { n: a }) }))} />
        <Acilir etiket={t("Süresi dolanlar")} secili={ayar.mod} genislik={260} onSec={k => ayarDegis({ mod: k as ArsivAyar["mod"] })}
          secenekler={[{ k: "gonder", ad: t("Önce bana gönder, sonra sil") }, { k: "sil", ad: t("Kendiliğinden sil") }]} />
        <Acilir etiket={t("Göster")} secili={goster} genislik={220} onSec={k => setGoster(k as "hepsi" | ArsivTur)}
          secenekler={[{ k: "hepsi", ad: t("Hepsi ({n})", { n: arsiv.length }) }, ...(["gecmis_acik", "gecmis_kapandi", "tamamlandi"] as ArsivTur[]).map(k => ({ k, ad: t(ARSIV_AD[k]) + " (" + sayi(k) + ")" }))]} />
      </View>
      {ayar.mod === "gonder" && dolan.length > 0 && (
        <View style={{ gap: 6, borderWidth: 1, borderColor: C.mid, borderRadius: 8, padding: 8 }}>
          <Text style={[s.body, { fontWeight: "700", color: C.mid }]}>{t("{n} kaydın saklama süresi ({a}) doldu.", { n: dolan.length, a: ayar.ay === 12 ? t("1 yıl") : t("{n} ay", { n: ayar.ay }) })}</Text>
          <View style={[s.row, { gap: 8, flexWrap: "wrap" }]}>
            <Btn label={t("📤 Bana gönder ve sil")} onPress={() => gonderSil(true)} />
            <Btn kind="ghost" label={t("Göndermeden sil")} onPress={() => gonderSil(false)} />
          </View>
        </View>
      )}
      <View style={[s.row, { gap: 8, alignItems: "center", flexWrap: "wrap" }]}>
        <Btn kind="secondary" label={t("📤 Arşivi bana gönder (.xlsx)")} disabled={!gorunen.length} onPress={async () => { if (await gonder(gorunen, `celse-is-arsivi-${bugun}.xlsx`)) setMesaj(t("{n} kayıt Excel dosyası olarak hazırlandı.", { n: gorunen.length })); }} />
      </View>
      {!!mesaj && <Text style={[s.hint, { color: C.good }]}>{mesaj}</Text>}
      <Sayfali anahtar="is-arsivi" xs={gorunen} varsayilan={10} sifirla={[goster]} satir={x => (
        <Pressable key={x.f.id + x.g.id} onPress={() => onAc(x.f.id)} style={({ pressed }) => [s.yak, pressed && { opacity: 0.8 }]}>
          <Text style={[s.yakTarih, { color: RENK[x.tur] }]}>{trTarih(x.gun)}{"\n"}<Text style={[s.hint, { color: RENK[x.tur] }]}>{t(ARSIV_AD[x.tur])}</Text></Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.fileT, x.g.bitti && { color: C.textSoft }]}>{x.g.bitti ? "☑ " : "☐ "}{x.g.metin}</Text>
            <Text style={s.hint} numberOfLines={1}>{foyBaslik(x.f)} · {x.f.mahkeme} {x.f.esasNo}{x.g.kapanis?.no && !x.g.kapanis.sureGecti ? " · " + x.g.kapanis.no : ""}</Text>
          </View>
        </Pressable>
      )} />
    </Katlanir>
  );
}
