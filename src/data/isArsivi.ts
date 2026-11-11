// İş arşivi: süresi geçen ve tamamlanan işler bir yerde birikir. Saklama süresi avukatın seçimiyle 1 ay – 1 yıl; süresi dolan
// kayıtlar ya kendiliğinden silinir ya da önce avukata (Excel dosyası olarak) gönderilip sonra silinir.
//  • Süresi geçmiş, açık: son günü geçmiş ama kapatılmamış iş (yaklaşanlar listesinden çıkar, burada durur).
//  • Süresi geçti, kapandı: yapılmadan anlamını yitiren iş (ör. duruşma günü geçmiş e-duruşma talebi).
//  • Tamamlanan: kapatılmış iş.
import type { Foy, Gorev } from "./foy";

export type ArsivTur = "gecmis_acik" | "gecmis_kapandi" | "tamamlandi";
export const ARSIV_AD: Record<ArsivTur, string> = { gecmis_acik: "Süresi geçmiş (açık)", gecmis_kapandi: "Süresi geçti, kapandı", tamamlandi: "Tamamlandı" };
export interface ArsivSatir { f: Foy; g: Gorev; tur: ArsivTur; gun: string }
export const SAKLAMA_AY = [1, 3, 6, 12];
export interface ArsivAyar { ay: number; mod: "gonder" | "sil" }
export const ARSIV_VARSAYILAN: ArsivAyar = { ay: 12, mod: "gonder" };

/** Arşivdeki işler (şahsi föyler hariç), en yeni önce. */
export function arsivListesi(liste: Foy[], bugun: string): ArsivSatir[] {
  const out: ArsivSatir[] = [];
  for (const f of liste) {
    if (f.ozel) continue;
    for (const g of f.gorevler || []) {
      if (g.bitti) out.push({ f, g, tur: g.kapanis?.sureGecti ? "gecmis_kapandi" : "tamamlandi", gun: (g.kapanis?.tarih || g.tarih || g.eklenme || f.guncelleme).slice(0, 10) });
      else if (g.tarih && g.tarih.slice(0, 10) < bugun) out.push({ f, g, tur: "gecmis_acik", gun: g.tarih.slice(0, 10) });
    }
  }
  return out.sort((a, b) => b.gun.localeCompare(a.gun));
}

/** Saklama sınırı: bugünden ay kadar önce (YYYY-AA-GG). */
export function sinirGunu(bugun: string, ay: number): string {
  const [y, a, g] = bugun.split("-").map(Number);
  const d = new Date(Date.UTC(y, a - 1 - ay, g));
  return d.toISOString().slice(0, 10);
}

/** Saklama süresi dolmuş arşiv kayıtları. */
export const suresiDolanlar = (liste: Foy[], ay: number, bugun: string) => { const s = sinirGunu(bugun, ay); return arsivListesi(liste, bugun).filter(x => x.gun < s); };

/** Verilen kayıtları föylerden siler; değişen föyler döner. */
export function arsivdenSil(satirlar: ArsivSatir[]): Foy[] {
  const m = new Map<string, { f: Foy; ids: Set<string> }>();
  for (const x of satirlar) { const k = m.get(x.f.id) || { f: x.f, ids: new Set<string>() }; k.ids.add(x.g.id); m.set(x.f.id, k); }
  return [...m.values()].map(({ f, ids }) => ({ ...f, gorevler: f.gorevler.filter(g => !ids.has(g.id)) }));
}

/** Excel satırları (ilk satır başlık). */
export function arsivTablosu(xs: ArsivSatir[]): (string | number)[][] {
  const tr = (x?: string) => (x ? x.slice(0, 10).split("-").reverse().join(".") : "");
  return [
    ["Durum", "İş", "Müvekkil – karşı taraf", "Mahkeme / merci", "Dosya no", "Eklenme", "Son gün", "Kapanış", "Kapanış notu / evrak no"],
    ...xs.map(x => [ARSIV_AD[x.tur], x.g.metin, [x.f.muvekkil, x.f.karsiTaraf].filter(Boolean).join(" – "), x.f.mahkeme || "", x.f.esasNo || "", tr(x.g.eklenme), tr(x.g.tarih), tr(x.g.kapanis?.tarih), x.g.kapanis?.no || ""])
  ];
}
