// "Derdini anlat": eğitim amaçlı danışma canlandırması (hukuki görüş değildir, Av. K. m.35).
// Bütün model çağrıları sunucudaki "danisma" fonksiyonunda yapılır (supabase/functions/danisma); uygulama yalnız formu,
// dili ve oturum anahtarını gönderir. Geçmiş danışmalar "danismalar" tablosundan okunur (oyuncu yalnız kendi satırlarını görür ve siler).
import { logUsage } from "./usage";
import { DANISMA_FUNCTION, SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";
import { getLang } from "../i18n";
import { getAccessToken, supabase } from "./account";

/** Hukuk alanları (sunucudaki ALANLAR ile aynı kimlikler). */
export const ALANLAR: { id: string; label: string }[] = [
  { id: "aile", label: "Aile" }, { id: "is", label: "İş" }, { id: "icra", label: "İcra-iflas" }, { id: "kira", label: "Kira / borçlar" },
  { id: "ticaret", label: "Ticaret" }, { id: "ceza", label: "Ceza" }, { id: "idare", label: "İdare" }, { id: "tuketici", label: "Tüketici" },
  { id: "miras", label: "Miras" }, { id: "diger", label: "Diğer" }
];
export const alanAdi = (id: string) => ALANLAR.find(a => a.id === id)?.label || id;

export type Kutu = "olay" | "deliller" | "karsi" | "talep";
export const KUTULAR: Kutu[] = ["olay", "deliller", "karsi", "talep"];
/** Asgari uzunluk (karakter); sunucu da aynısını denetler. */
export const ASGARI: Record<Kutu, number> = { olay: 40, deliller: 40, karsi: 40, talep: 20 };
export const AZAMI = 6000;
export const TAKIP_HAKKI = 5;

export interface DanismaForm { alan: string; olay: string; deliller: string; karsi: string; talep: string }
export const BOS_FORM: DanismaForm = { alan: "", olay: "", deliller: "", karsi: "", talep: "" };

/** T.C. kimlik numarasına benzeyen 11 haneli sayı var mı? (Uyarı için; sunucu ayrıca gizler.) */
export const kimlikNoVar = (s: string) => /(^|[^0-9])[1-9]\d{10}(?![0-9])/.test(s);

/** Kutu kutu eksikler (Türkçe kaynak metin; ekranda t() ile çevrilir). Boşsa form tamamdır. */
export function formHatalari(f: DanismaForm): Partial<Record<Kutu | "alan", string>> {
  const e: Partial<Record<Kutu | "alan", string>> = {};
  if (!ALANLAR.some(a => a.id === f.alan)) e.alan = "Hukuk alanını seçin.";
  for (const k of KUTULAR) {
    const n = f[k].trim().length;
    if (!n) e[k] = "Bu alan zorunlu.";
    else if (n < ASGARI[k]) e[k] = "En az {n} karakter yazın (şu an {m}).";
    else if (f[k].length > AZAMI) e[k] = "En çok {n} karakter yazabilirsiniz.";
    else if (kimlikNoVar(f[k])) e[k] = "T.C. kimlik numarası gibi görünen bir sayı var; lütfen silin.";
  }
  return e;
}

export interface Soru { kutu: Kutu; soru: string }
export interface KontrolSonucu { yeterli: boolean; sorular: Soru[]; onay?: string; uygunsuz?: boolean; neden?: string }
export interface Degerlendirme { nitelik: string; guclu: string; zayif: string; deliller: string; savunma: string; yollar: string; kapanis: string; uyari?: string; metin?: string }
export interface Satir { rol: "hakim" | "davaci" | "davali"; ad?: string; metin: string }
export interface Canlandirma { taraf: "davaci" | "davali"; satirlar: Satir[]; degerlendirme: string; uyari?: string }
export interface Takip { soru: string; cevap: string }
export interface Danisma {
  id: string; alan: string; olay: string; deliller: string; karsi: string; talep: string; durum: string;
  degerlendirme: Degerlendirme | null; canlandirma: Canlandirma | null; takip: Takip[]; kalan_takip: number; created_at: string;
}

/** Sunucu cevabı: ok değilse error Türkçe kaynak metindir (ekranda t() ile çevrilir). */
export type Cevap<T> = { ok: true; data: T } | { ok: false; error: string; vars?: Record<string, string>; status?: number; iade?: boolean };

const HATA: Record<string, string> = {
  "kredi yok": "Krediniz kalmadı.",
  "giriş gerekli": "Önce giriş yapın.",
  "çok fazla istek": "Çok fazla istek gönderildi. Biraz sonra yeniden deneyin.",
  "takip hakkı kalmadı": "Bu danışmadaki takip sorusu hakkınız doldu.",
  "önce eksik bilgi denetimi": "Önce eksik bilgi denetimini tamamlayın.",
  "yapay zekâ kurulmadı": "Danışma hizmeti henüz açılmadı.",
  "danışma bulunamadı": "Danışma bulunamadı.",
  "değerlendirme yapılamadı": "Değerlendirme şu an yapılamadı."
};

async function call<T>(action: string, body: Record<string, unknown>): Promise<Cevap<T>> {
  if (!supabase() || !SUPABASE_URL) return { ok: false, error: "Sunucuya şu an ulaşılamıyor." };
  const token = await getAccessToken();
  if (!token) return { ok: false, error: "Önce giriş yapın." };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120000);
    const r = await fetch(`${SUPABASE_URL}/functions/v1/${DANISMA_FUNCTION}`, {
      method: "POST", signal: ctrl.signal,
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, dil: getLang(), ...body })
    });
    clearTimeout(timer);
    const j = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true, data: j as T };
    if (j?.ret) return { ok: false, status: r.status, iade: true, error: "Bu istek değerlendirilemedi: {neden}", vars: { neden: String(j.ret) } };
    if (j?.uygunsuz) return { ok: false, status: r.status, error: "Bu istek değerlendirilemedi: {neden}", vars: { neden: String(j.neden || "") } };
    const e = String(j?.error || "");
    return { ok: false, status: r.status, iade: !!j?.iade, error: HATA[e] || (r.status === 400 ? "Formdaki bilgiler eksik." : "Sunucu şu an cevap veremedi. Biraz sonra yeniden deneyin.") };
  } catch {
    return { ok: false, error: "Bağlantı kurulamadı. İnternet bağlantınızı kontrol edin." };
  }
}

export const kontrolEt = (form: DanismaForm) => call<KontrolSonucu>("kontrol", { form });
export const degerlendir = async (form: DanismaForm, onay: string) => {
  const r = await call<{ id: string; degerlendirme: Degerlendirme; kalan_takip: number }>("degerlendir", { form, onay });
  if (r.ok) logUsage("danisma", { ucretli: true });
  return r;
};
export const canlandir = (id: string, taraf: "davaci" | "davali") => call<{ canlandirma: Canlandirma }>("canlandir", { id, taraf });
export const takipSor = (id: string, soru: string) => call<{ soru: string; cevap: string; kalan_takip: number }>("takip", { id, soru });

/** Sorulara verilen cevaplar ilgili kutunun sonuna eklenir. */
export function cevaplariEkle(f: DanismaForm, sorular: Soru[], cevaplar: string[], etiket: { soru: string; cevap: string }): DanismaForm {
  const out = { ...f };
  sorular.forEach((s, i) => {
    const c = (cevaplar[i] || "").trim();
    if (!c) return;
    out[s.kutu] = `${out[s.kutu].trim()}\n\n${etiket.soru}: ${s.soru}\n${etiket.cevap}: ${c}`.slice(0, AZAMI);
  });
  return out;
}

const parse = <T,>(s: unknown): T | null => {
  if (!s) return null;
  if (typeof s !== "string") return s as T;
  try { return JSON.parse(s) as T; } catch { return { metin: s } as unknown as T; }
};

export async function listDanismalar(): Promise<Danisma[]> {
  const sb = supabase();
  if (!sb) return [];
  const { data, error } = await sb.from("danismalar")
    .select("id, alan, olay, deliller, karsi, talep, durum, degerlendirme, canlandirma, takip, kalan_takip, created_at")
    .eq("durum", "hazir").order("created_at", { ascending: false }).limit(50);
  if (error || !data) return [];
  return data.map((r: Record<string, unknown>) => ({
    ...(r as unknown as Danisma),
    degerlendirme: parse<Degerlendirme>(r.degerlendirme), canlandirma: parse<Canlandirma>(r.canlandirma),
    takip: Array.isArray(r.takip) ? (r.takip as Takip[]) : []
  }));
}

export async function deleteDanisma(id: string): Promise<boolean> {
  const sb = supabase();
  if (!sb) return false;
  const { error } = await sb.from("danismalar").delete().eq("id", id);
  return !error;
}
