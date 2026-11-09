// Resmî hukuk kaynakları (danisma karar_ara, mevzuat_bul, belge_getir, mevzuat_yukle): Adalet Bakanlığı'nın emsal karar ve
// mevzuat servisi ile Celse'nin kanun arşivi (madde madde). Arama sözcüklerindeki föy adları kodlanır, sunucu kodları atar.
import { HukukKaynak } from "../data/beyan";
import { call } from "../data/danisma";
import { Foy, yeniId } from "../data/foy";
import { mask } from "../engine/mask";
import { ekAdlar } from "./foyEvrak";

export interface Karar { id: string; mahkeme: string; birim: string; esas: string; karar: string; tarih: string; kesinlesme?: string; url: string; bolum?: string }
export interface KanunMaddesi { no: string; kanun: string; durum: string; madde: string; baslik: string; metin: string; slug: string }
export interface MevzuatBelgesi { id: string; no: string; ad: string; tur: string; turKod: string; rgTarih: string; rgSayi: string; url: string }
type Sonuc<T> = ({ ok: true } & T) | { ok: false; hata: string; vars?: Record<string, string | number> };

export const MAHKEME_SECENEK = [
  { k: "", ad: "Bütün mahkemeler" }, { k: "YARGITAYKARARI", ad: "Yargıtay" }, { k: "DANISTAYKARAR", ad: "Danıştay" },
  { k: "ISTINAFHUKUK", ad: "Bölge adliye (istinaf)" }, { k: "YERELHUKUK", ad: "İlk derece (yerel) mahkeme" }, { k: "KYB", ad: "Kanun yararına bozma" }
];
export const MEVZUAT_TURU = [
  { k: "", ad: "Bütün mevzuat" }, { k: "KANUN", ad: "Kanun" }, { k: "KHK", ad: "Kanun hükmünde kararname (olağan ve olağanüstü)" }, { k: "CB_KARARNAME", ad: "Cumhurbaşkanlığı kararnamesi" },
  { k: "CB_YONETMELIK", ad: "Cumhurbaşkanlığı yönetmeliği" }, { k: "CB_KARAR", ad: "Cumhurbaşkanı kararı" }, { k: "CB_GENELGE", ad: "Cumhurbaşkanlığı genelgesi" },
  { k: "YONETMELIK", ad: "Yönetmelik (Bakanlar Kurulu)" }, { k: "TUZUK", ad: "Tüzük" }, { k: "KKY", ad: "Kurum ve kuruluş yönetmeliği" }, { k: "UY", ad: "Üniversite yönetmeliği" },
  { k: "TEBLIGLER", ad: "Tebliğ" }, { k: "MULGA", ad: "Mülga mevzuat" }
];

const kodla = (soz: string, f?: Foy | null) => mask(soz.trim(), { extra: f ? ekAdlar(f) : [] }).masked;
const bas = (x: string) => x.toLocaleLowerCase("tr").replace(/(^|[\s(“"'-])(\p{L})/gu, (_a, o, h) => o + h.toLocaleUpperCase("tr")).replace(/\b(Ve|İle|Veya|İçin|Hakkında|Dair|Ait|Bazı)\b/g, w => w.toLocaleLowerCase("tr"));

export async function kararAra(soz: string, s: { mahkeme?: string; birim?: string; bas?: string; son?: string; sayfa?: number; kaynak?: "arsiv" }, f?: Foy | null): Promise<Sonuc<{ kararlar: Karar[]; toplam: number }>> {
  const r = await call<{ kararlar: Karar[]; toplam: number }>("karar_ara", { soz: kodla(soz, f), ...s }, 60000);
  return r.ok ? { ok: true, kararlar: r.data.kararlar || [], toplam: r.data.toplam || 0 } : { ok: false, hata: r.error, vars: r.vars as Record<string, string | number> | undefined };
}
export async function mevzuatBul(soz: string, s: { tur?: string; mulga?: boolean; sayfa?: number }, f?: Foy | null): Promise<Sonuc<{ maddeler: KanunMaddesi[]; belgeler: MevzuatBelgesi[]; resmiHata?: string; arsivYok?: boolean }>> {
  const r = await call<{ maddeler: KanunMaddesi[]; belgeler: MevzuatBelgesi[]; resmiHata?: string; arsivYok?: boolean }>("mevzuat_bul", { soz: kodla(soz, f), ...s }, 60000);
  return r.ok ? { ok: true, maddeler: r.data.maddeler || [], belgeler: r.data.belgeler || [], resmiHata: r.data.resmiHata, arsivYok: r.data.arsivYok } : { ok: false, hata: r.error, vars: r.vars as Record<string, string | number> | undefined };
}
/** Belge metni; karar açılınca (meta ile) Celse içtihat arşivine de eklenir. */
export async function belgeGetir(kaynak: "karar" | "mevzuat", id: string, meta?: Partial<Karar>): Promise<Sonuc<{ metin: string; pdf: boolean; url: string }>> {
  const m = meta ? { mahkeme: (meta.mahkeme || "").replace(/\s*Kararı$/i, ""), birim: meta.birim, esas: meta.esas, karar: meta.karar, tarih: meta.tarih } : undefined;
  const r = await call<{ metin: string; pdf: boolean; url: string }>("belge_getir", { kaynak, id, meta: m }, 60000);
  return r.ok ? { ok: true, metin: r.data.metin || "", pdf: !!r.data.pdf, url: r.data.url } : { ok: false, hata: r.error, vars: r.vars as Record<string, string | number> | undefined };
}

export const kararKunye = (k: Karar) => [k.mahkeme.replace(/\s*Kararı$/i, ""), k.birim, k.esas ? k.esas + " E." : "", k.karar ? k.karar + " K." : "", k.tarih].filter(Boolean).join(", ");
export const maddeKunye = (m: KanunMaddesi) => `${m.no} sayılı ${bas(m.kanun)} m. ${m.madde}`;
export const belgeKunye = (b: MevzuatBelgesi) => `${b.no ? b.no + " sayılı " : ""}${bas(b.ad)}${b.rgTarih ? ` (RG ${b.rgTarih}${b.rgSayi ? "/" + b.rgSayi : ""})` : ""}`;

const simdi = () => new Date().toISOString();
export const kararKaynak = (k: Karar, ozet = ""): HukukKaynak => ({ id: yeniId("k"), tur: "ictihat", kunye: kararKunye(k), ozet, url: k.url, kaynak: "elle", tarih: simdi() });
export const maddeKaynak = (m: KanunMaddesi): HukukKaynak => ({ id: yeniId("k"), tur: "mevzuat", kunye: maddeKunye(m) + (m.baslik ? ` (${m.baslik})` : ""), ozet: "", alinti: m.metin.slice(0, 500) + (m.metin.length > 500 ? "…" : ""), kaynak: "elle", tarih: simdi() });
export const belgeKaynak = (b: MevzuatBelgesi): HukukKaynak => ({ id: yeniId("k"), tur: "mevzuat", kunye: belgeKunye(b), ozet: b.tur, url: b.url, kaynak: "elle", tarih: simdi() });

/** İçtihat arşivine yüklenecek temel kararlar: içtihadı birleştirme kararları (bütün yıllar), genel kurullar ve dava daireleri kurulları (son yıllar). */
export const ICTIHAT_PLANI = (yillar: number[]) => [
  { mahkeme: "YARGITAYKARARI", birim: "Büyük Genel Kurulu", ad: "Yargıtay İçtihadı Birleştirme Büyük Genel Kurulu", yillar: [0] },
  { mahkeme: "DANISTAYKARAR", birim: "İçtihatları Birleştirme Kurulu", ad: "Danıştay İçtihatları Birleştirme Kurulu", yillar: [0] },
  { mahkeme: "YARGITAYKARARI", birim: "Hukuk Genel Kurulu", ad: "Yargıtay Hukuk Genel Kurulu", yillar },
  { mahkeme: "YARGITAYKARARI", birim: "Ceza Genel Kurulu", ad: "Yargıtay Ceza Genel Kurulu", yillar },
  { mahkeme: "DANISTAYKARAR", birim: "İdare Dava Daireleri Kurulu", ad: "Danıştay İdare Dava Daireleri Kurulu", yillar },
  { mahkeme: "DANISTAYKARAR", birim: "Vergi Dava Daireleri Kurulu", ad: "Danıştay Vergi Dava Daireleri Kurulu", yillar }
];
export interface IctihatIlerleme { ad: string; yil: number; sayfa: number; toplam: number; eklenen: number; mesaj?: string }
/** Yönetici: temel kararları içtihat arşivine yükler. Kaldığı yer bu cihazda saklanır; durdurulup sürdürülebilir. */
export async function ictihatArsiviniYukle(plan: ReturnType<typeof ICTIHAT_PLANI>, ilerle: (x: IctihatIlerleme) => void, devam: () => boolean, kaldigi: { i: number; yi: number; sayfa: number }, kaydet: (k: { i: number; yi: number; sayfa: number }) => void): Promise<Sonuc<{ eklenen: number; dolu?: boolean }>> {
  let eklenen = 0;
  const bekle = (ms: number) => new Promise(r => setTimeout(r, ms));
  for (let i = kaldigi.i; i < plan.length; i++) {
    const p = plan[i];
    for (let yi = i === kaldigi.i ? kaldigi.yi : 0; yi < p.yillar.length; yi++) {
      let sayfa = i === kaldigi.i && yi === kaldigi.yi ? kaldigi.sayfa : 1;
      for (;;) {
        if (!devam()) return { ok: true, eklenen };
        const r = await call<{ sayfa: number; toplam: number; eklenen: number; bitti: boolean; yogun?: boolean; dolu?: boolean; mb?: number }>("ictihat_yukle", { mahkeme: p.mahkeme, birim: p.birim, yil: p.yillar[yi], sayfa }, 150000);
        if (!r.ok) {
          if (/yoğun|servis|503/.test(r.error)) { ilerle({ ad: p.ad, yil: p.yillar[yi], sayfa, toplam: 0, eklenen, mesaj: "Resmî servis yoğun; 30 saniye bekleniyor…" }); await bekle(30000); continue; }
          return { ok: false, hata: r.error, vars: r.vars as Record<string, string | number> | undefined };
        }
        if (r.data.dolu) return { ok: true, eklenen, dolu: true };
        eklenen += r.data.eklenen;
        ilerle({ ad: p.ad, yil: p.yillar[yi], sayfa, toplam: r.data.toplam, eklenen });
        if (r.data.yogun) { await bekle(30000); continue; }
        if (r.data.bitti) break;
        sayfa++;
        kaydet({ i, yi, sayfa });
      }
      kaydet({ i, yi: yi + 1, sayfa: 1 });
    }
    kaydet({ i: i + 1, yi: 0, sayfa: 1 });
  }
  return { ok: true, eklenen };
}

/** Yönetici: kanun arşivini baştan sona yükler / günceller (değişmeyenler atlanır). */
export async function mevzuatArsiviniYukle(ilerleme: (x: { islenen: number; toplam: number; degisen: number; madde: number; hatalar: string[] }) => void, zorla = false): Promise<Sonuc<{ degisen: number; madde: number; hatalar: string[] }>> {
  let bas = 0, degisen = 0, madde = 0;
  const hatalar: string[] = [];
  for (let tur = 0; tur < 400; tur++) {
    const r = await call<{ toplam: number; islenen: number; degisen: number; madde: number; bitti: boolean; sonraki: number; hatalar: string[] }>("mevzuat_yukle", { bas, adet: 8, zorla }, 150000);
    if (!r.ok) return { ok: false, hata: r.error, vars: r.vars as Record<string, string | number> | undefined };
    degisen += r.data.degisen; madde += r.data.madde; hatalar.push(...(r.data.hatalar || []));
    ilerleme({ islenen: r.data.islenen, toplam: r.data.toplam, degisen, madde, hatalar });
    if (r.data.bitti) break;
    bas = r.data.sonraki;
  }
  return { ok: true, degisen, madde, hatalar };
}
