// Beyan editörünün yapay zekâ çağrıları. Föy, taslak ve kaynaklar BİRLİKTE kodlanır (aynı kişi her yerde aynı kodla);
// dönen gövde cihazda gerçek adlarla açılır. Kaynak aramada konu da föyün adları kodlanarak gider.
import { atif, Beyan, beyanTuru, HukukKaynak } from "../data/beyan";
import { call } from "../data/danisma";
import { Foy, yeniId } from "../data/foy";
import { turBilgi } from "../data/foyTurleri";
import { mask, unmask } from "../engine/mask";
import { ekAdlar, foySoruKaynagi } from "./foyEvrak";

type Sonuc<T> = ({ ok: true } & T) | { ok: false; hata: string; vars?: Record<string, string | number> };
const SIZINTI = /(?<!\d[.,]?)[1-9]\d{10}(?![.,]?\d)|\bTR\s?\d{2}(?:\s?\d{4}){5}|[\w.+-]+@[\w-]+\.[\w.]+/i;

/** Beyan gövdesini yazdırır ya da var olan gövdeyi talimata göre düzelttirir. */
export async function beyanYazdir(f: Foy, b: Beyan, talimat: string, duzelt: boolean): Promise<Sonuc<{ metin: string }>> {
  const kaynakMetni = (b.kaynaklar || []).map((x, i) => `${i + 1}. [${x.tur === "ictihat" ? "İçtihat" : x.tur === "mevzuat" ? "Mevzuat" : "Doktrin"}${x.kaynak === "genel" ? ", genel bilgi" : ""}] ${atif(x)}${x.url ? " <" + x.url + ">" : ""}`).join("\n");
  // Taslak ve kaynaklar föyle aynı kodlamaya girsin diye "geçmiş" olarak verilir (soru = taslak, cevap = kaynaklar).
  const k = foySoruKaynagi(f, talimat.trim() || "-", [{ soru: duzelt ? b.metin || "-" : "-", cevap: kaynakMetni || "-" }], turBilgi(f.tur).ad);
  const taslak = duzelt ? (k.gecmis[0]?.soru || "") : "", kaynaklar = kaynakMetni ? (k.gecmis[0]?.cevap || "") : "";
  if (SIZINTI.test(k.dosya + " " + k.soru + " " + taslak + " " + kaynaklar)) return { ok: false, hata: "Dosyada ya da taslakta gizlenmemiş kişisel veri (kimlik no, IBAN ya da e-posta) kalmış olabilir; gönderilmedi. Bu bilgiyi çıkarın." };
  const konu = mask(b.konu || "", { extra: ekAdlar(f) }).masked;
  const bt = beyanTuru(b.tur);
  const r = await call<{ metin: string }>("beyan_yaz", { dosya: k.dosya, tur: b.tur, cerceve: bt.cerceve, klasor: bt.klasor, konu, talimat: k.soru === "-" ? "" : k.soru, taslak: taslak === "-" ? "" : taslak, kaynaklar: kaynaklar === "-" ? "" : kaynaklar, arama: true }, 240000);
  if (!r.ok) return { ok: false, hata: r.error, vars: r.vars as Record<string, string | number> | undefined };
  return { ok: true, metin: unmask(r.data.metin || "", k.map).trim() };
}

/** İçtihat, mevzuat ya da doktrin arar; yalnız aramada gerçekten bulunan kaynaklar döner (sunucu eler). */
export async function kaynakBul(tur: HukukKaynak["tur"], konu: string, f?: Foy | null): Promise<Sonuc<{ kaynaklar: HukukKaynak[]; genel: string }>> {
  const ek = f ? ekAdlar(f) : [];
  const kodlu = mask(konu.trim(), { extra: ek }).masked;
  const baglam = f ? mask([turBilgi(f.tur).ad, f.davaTuru, f.asama ? "aşama " + f.asama : "", f.taraf === "davali" ? "biz davalı/sanık/borçlu tarafıyız" : "biz davacı/başvuran/alacaklı tarafıyız"].filter(Boolean).join(", "), { extra: ek }).masked : "";
  if (SIZINTI.test(kodlu)) return { ok: false, hata: "Konuda kimlik no, IBAN ya da e-posta var; çıkarıp yeniden arayın." };
  const r = await call<{ kaynaklar: { kunye: string; ozet: string; alinti?: string; url: string }[]; genel?: string }>("kaynak_ara", { tur, konu: kodlu, baglam }, 180000);
  if (!r.ok) return { ok: false, hata: r.error, vars: r.vars as Record<string, string | number> | undefined };
  const simdi = new Date().toISOString();
  return {
    ok: true,
    kaynaklar: (r.data.kaynaklar || []).map(x => ({ id: yeniId("k"), tur, kunye: x.kunye, ozet: x.ozet, alinti: x.alinti || undefined, url: x.url, kaynak: "yz" as const, tarih: simdi })),
    genel: r.data.genel || ""
  };
}
