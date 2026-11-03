// Yönetim paneli · İstatistikler: sunucudaki özet işlevlerini (supabase/surum9.sql, istat_...) okur.
// İşlevler yalnız yönetici hesabında çalışır; sunucu yoksa panel örnek veriyle önizlenebilir.
import { supabase } from "../data/account";

export type Unit = "gun" | "ay";
export interface SeriesRow {
  donem: string; oyun_ucretsiz: number; oyun_ucretli: number; bitti: number; kazanilan: number; birakilan: number;
  aktif: number; yeni_uye: number; pro: number; odeme: number; odeme_test: number; gelir: number; paywall: number; danisma: number;
}
export interface Summary {
  uye: number; yeni_uye: number; pro_aktif: number; pro_kaynak: Record<string, number>; kredi_toplam: number;
  aktif: number; aktif_uye: number; misafir: number; oyun: number; oyun_ucretli: number; bitti: number; kazanilan: number;
  paywall: number; satin_alma: number; danisma: number; odeme: number; gelir: number; hata_acik: number;
}
export interface CaseRow { dava_id: string; oyun: number; bitti: number; kazanilan: number; ort_puan: number | null; kisi: number; ucretli: boolean }
export interface ModeRow { mod: string; oyun: number; bitti: number; ucretli: number; kisi: number }
export interface UserRow {
  kullanici_id: string; ad_soyad: string; eposta: string; uyelik: string; oyun: number; bitti: number; ucretli: number;
  son_aktif: string | null; pro: boolean; pro_bitis: string | null; pro_kaynak: string | null; kredi: number; kariyer_dava: number; kariyer_puan: number;
}
export interface Stats { series: SeriesRow[]; summary: Summary; cases: CaseRow[]; modes: ModeRow[]; users: UserRow[]; demo?: boolean }

const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const numRow = <T extends object>(r: any, keys: (keyof T)[]): T => { const o: any = { ...r }; keys.forEach(k => { o[k] = num(r[k]); }); return o; };

/** Bir dönem seçimi: günlükte 7, 30 ya da 90 gün; aylıkta 12 ay. */
export async function loadStats(unit: Unit, n: number): Promise<{ data?: Stats; error?: string }> {
  const sb = supabase();
  if (!sb) return { error: "Sunucuya ulaşılamıyor." };
  const days = unit === "ay" ? 366 : n;
  try {
    const [s, o, c, m, u] = await Promise.all([
      sb.rpc("istat_seri", { p_birim: unit, p_adet: n }),
      sb.rpc("istat_ozet", { p_gun: days }),
      sb.rpc("istat_davalar", { p_gun: days, p_sinir: 15 }),
      sb.rpc("istat_modlar", { p_gun: days }),
      sb.rpc("istat_kullanicilar", { p_gun: days })
    ]);
    const err = s.error || o.error || c.error || m.error || u.error;
    if (err) {
      const msg = err.message || "";
      return { error: /Yetki yok/.test(msg) ? "Bu hesap sunucuda yönetici değil." : /function|does not exist|schema cache/i.test(msg) ? "İstatistik işlevleri yok: supabase/surum9.sql henüz çalıştırılmamış." : msg };
    }
    const S: (keyof SeriesRow)[] = ["oyun_ucretsiz", "oyun_ucretli", "bitti", "kazanilan", "birakilan", "aktif", "yeni_uye", "pro", "odeme", "odeme_test", "gelir", "paywall", "danisma"];
    const sum = (o.data || {}) as any;
    return {
      data: {
        series: ((s.data || []) as any[]).map(r => numRow<SeriesRow>(r, S)),
        summary: { ...sum, pro_kaynak: sum.pro_kaynak || {}, ...Object.fromEntries(["uye", "yeni_uye", "pro_aktif", "kredi_toplam", "aktif", "aktif_uye", "misafir", "oyun", "oyun_ucretli", "bitti", "kazanilan", "paywall", "satin_alma", "danisma", "odeme", "gelir", "hata_acik"].map(k => [k, num(sum[k])])) },
        cases: ((c.data || []) as any[]).map(r => ({ ...numRow<CaseRow>(r, ["oyun", "bitti", "kazanilan", "kisi"]), ort_puan: r.ort_puan == null ? null : Number(r.ort_puan) })),
        modes: ((m.data || []) as any[]).map(r => numRow<ModeRow>(r, ["oyun", "bitti", "ucretli", "kisi"])),
        users: ((u.data || []) as any[]).map(r => numRow<UserRow>(r, ["oyun", "bitti", "ucretli", "kredi", "kariyer_dava", "kariyer_puan"]))
      }
    };
  } catch (e) { return { error: (e as Error).message || "Sunucuya ulaşılamıyor." }; }
}

/** Sunucu yokken paneli denemek için tutarlı örnek veri (gerçek değildir; ekranda "ÖRNEK VERİ" yazar). */
export function demoStats(unit: Unit, n: number, caseIds: string[]): Stats {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const today = new Date();
  const series: SeriesRow[] = Array.from({ length: n }, (_, i) => {
    const d = new Date(today);
    if (unit === "ay") { d.setDate(1); d.setMonth(d.getMonth() - (n - 1 - i)); } else d.setDate(d.getDate() - (n - 1 - i));
    const k = unit === "ay" ? 26 : 1, trend = 0.6 + (i / n) * 0.8, wk = unit === "gun" && [0, 6].includes(d.getDay()) ? 1.35 : 1;
    const free = Math.round((18 + rnd() * 14) * trend * wk * k), paid = Math.round((3 + rnd() * 6) * trend * trend * wk * k);
    const bitti = Math.round((free + paid) * (0.62 + rnd() * 0.2));
    return {
      donem: d.toISOString().slice(0, 10), oyun_ucretsiz: free, oyun_ucretli: paid, bitti, kazanilan: Math.round(bitti * 0.55), birakilan: Math.round((free + paid - bitti) * 0.7),
      aktif: Math.round((free + paid) * (0.45 + rnd() * 0.1) / (unit === "ay" ? 3 : 1)), yeni_uye: Math.round((2 + rnd() * 4) * trend * k),
      pro: Math.round(8 + i * (unit === "ay" ? 4 : 0.35) + rnd() * 2), odeme: Math.round(rnd() * 2.2 * k), odeme_test: 0, gelir: 0, paywall: Math.round((4 + rnd() * 6) * k), danisma: Math.round(rnd() * 1.5 * k)
    };
  });
  series.forEach(r => { r.gelir = Math.round(r.odeme * 4.2 * 100) / 100; });
  const t = (f: (r: SeriesRow) => number) => series.reduce((s, r) => s + f(r), 0);
  const names = ["Ayşe Yılmaz", "Mehmet Demir", "Zeynep Kaya", "Can Öztürk", "Elif Şahin", "Burak Aydın", "Selin Arslan", "Emre Koç", "Deniz Çelik", "Merve Kurt", "Okan Polat", "Ceren Aksoy"];
  const users: UserRow[] = names.map((nm, i) => {
    const last = new Date(Date.now() - i * i * 3600000 * 5).toISOString();
    return {
      kullanici_id: `demo-${i}`, ad_soyad: nm, eposta: nm.toLocaleLowerCase("tr").replace(/ /g, ".").replace(/[çğıöşü]/g, ch => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" } as any)[ch]) + "@ornek.com",
      uyelik: new Date(Date.now() - (i + 3) * 86400000 * 4).toISOString(), oyun: Math.max(0, 40 - i * 3 - Math.round(rnd() * 4)), bitti: Math.max(0, 30 - i * 3), ucretli: i % 3 === 0 ? 8 - i / 2 : 0,
      son_aktif: last, pro: i % 3 === 0, pro_bitis: i % 3 === 0 ? new Date(Date.now() + 20 * 86400000).toISOString() : null, pro_kaynak: i % 3 === 0 ? (i === 0 ? "manuel" : "app_store") : null,
      kredi: i % 4 === 1 ? 2 : 0, kariyer_dava: Math.max(0, 14 - i), kariyer_puan: Math.max(0, 900 - i * 70)
    };
  });
  const ids = caseIds.length ? caseIds : ["ornek-dava"];
  const cases: CaseRow[] = ids.slice(0, 10).map((id, i) => {
    const oyun = Math.round((120 - i * 10) * (0.8 + rnd() * 0.3)), bitti = Math.round(oyun * 0.7);
    return { dava_id: id, oyun, bitti, kazanilan: Math.round(bitti * (0.4 + rnd() * 0.3)), ort_puan: Math.round(55 + rnd() * 25), kisi: Math.round(oyun * 0.6), ucretli: i % 3 === 2 };
  });
  const tot = t(r => r.oyun_ucretsiz + r.oyun_ucretli);
  const modes: ModeRow[] = [["kariyer", 0.48], ["solo", 0.27], ["duel", 0.15], ["tahkim", 0.1]].map(([m, f]) => ({ mod: m as string, oyun: Math.round(tot * (f as number)), bitti: Math.round(tot * (f as number) * 0.7), ucretli: m === "kariyer" ? Math.round(t(r => r.oyun_ucretli) * 0.8) : 0, kisi: Math.round(tot * (f as number) * 0.3) }));
  return {
    demo: true, series, cases, modes, users,
    summary: {
      uye: 412, yeni_uye: t(r => r.yeni_uye), pro_aktif: series[series.length - 1].pro, pro_kaynak: { app_store: 21, google_play: 9, manuel: 3 }, kredi_toplam: 17,
      aktif: Math.round(t(r => r.aktif) * (unit === "ay" ? 0.6 : 0.35)), aktif_uye: 160, misafir: 74, oyun: tot, oyun_ucretli: t(r => r.oyun_ucretli), bitti: t(r => r.bitti), kazanilan: t(r => r.kazanilan),
      paywall: t(r => r.paywall), satin_alma: t(r => r.odeme), danisma: t(r => r.danisma), odeme: t(r => r.odeme), gelir: Math.round(t(r => r.gelir) * 100) / 100, hata_acik: 4
    }
  };
}
