// Faiz oranlarının güncel tutulması: sunucu her sabah TCMB'nin resmî tablolarını denetler (danisma "faiz_guncelle",
// supabase/surum24.sql) ve faiz_oran tablosuna yazar. Uygulama açılışta bu tabloyu okur; icra.ts'deki dönemsel tablolara
// (avans, TTK 1530) yeni dönemleri ekler. İnternet yoksa son okunan oranlar bu cihazdan kullanılır.
// Yasal faiz: 7589 s. Kanun'dan sonra (31.07.2026) TCMB reeskont oranının %80'i; her yıl 31 Aralık'taki reeskont oranına göre,
// 30 Haziran'daki oran 5 puan ya da daha çok ayrışırsa yılın ikinci yarısında o oranın %80'i. Bu dönemler reeskont
// tablosundan hesaplanır ve "hesaplandı" diye işaretlenir.
import { useEffect, useState } from "react";
import { supabase } from "./account";
import { ayarOku, ayarYaz } from "./foy";
import { AVANS, TTK1530, YASAL } from "./icra";
import { faizOranlariniUygula, FaizSatiri } from "./faizTablo";
export type { FaizSatiri } from "./faizTablo";

export interface FaizDurumu { son?: string; not?: string; eklenen: number; hesaplanan: string[]; sonAvans?: [string, number]; sonYasal?: [string, number]; sonTtk?: [string, number] }

let durum: FaizDurumu = { eklenen: 0, hesaplanan: [], sonAvans: AVANS[AVANS.length - 1], sonYasal: YASAL[YASAL.length - 1], sonTtk: TTK1530[TTK1530.length - 1] };
let surum = 0;
let yukleniyor: Promise<void> | null = null;
const dinleyen = new Set<() => void>();

/** Gelen satırları uygular ve ekranda gösterilecek durumu günceller. */
function uygula(satirlar: FaizSatiri[]) {
  const r = faizOranlariniUygula(satirlar);
  durum = { ...durum, eklenen: durum.eklenen + r.n, hesaplanan: r.hesaplanan, sonAvans: AVANS[AVANS.length - 1], sonYasal: YASAL[YASAL.length - 1], sonTtk: TTK1530[TTK1530.length - 1] };
}

/** Sunucudan son oranları okur (önce bu cihazdaki son kopya). Bir kez çalışır. */
export function faizOranlariniYukle(): Promise<void> {
  if (yukleniyor) return yukleniyor;
  yukleniyor = (async () => {
    const yerel = await ayarOku<{ satirlar: FaizSatiri[]; son?: string; not?: string }>("faizOranlari").catch(() => null);
    if (yerel?.satirlar?.length) { uygula(yerel.satirlar); durum = { ...durum, son: yerel.son, not: yerel.not }; surum++; dinleyen.forEach(f => f()); }
    const sb = supabase();
    if (!sb) return;
    try {
      const [o, k] = await Promise.all([
        sb.from("faiz_oran").select("tur,bas,oran").gte("bas", "2024-01-01").order("bas"),
        sb.from("faiz_kontrol").select("son,aciklama").eq("id", 1).maybeSingle()
      ]);
      if (o.error || !o.data) return;
      const satirlar = o.data as FaizSatiri[];
      uygula(satirlar);
      const kk = k.data as { son?: string; aciklama?: string } | null;
      durum = { ...durum, son: kk?.son || undefined, not: kk?.aciklama || undefined };
      await ayarYaz("faizOranlari", { satirlar, son: durum.son, not: durum.not }).catch(() => {});
      surum++; dinleyen.forEach(f => f());
    } catch { /* tablo yoksa (surum24.sql çalıştırılmadıysa) Celse'deki oranlar kullanılır */ }
  })();
  return yukleniyor;
}

/** Faiz oranlarını yükler; yeni oran gelince ekran yeniden hesaplar (dönen sürüm useMemo bağımlılığına konur). */
export function useFaizOranlari(): { surum: number; durum: FaizDurumu } {
  const [, yenile] = useState(0);
  useEffect(() => { const f = () => yenile(x => x + 1); dinleyen.add(f); faizOranlariniYukle(); return () => { dinleyen.delete(f); }; }, []);
  return { surum, durum };
}
