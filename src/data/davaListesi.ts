// Dava listesi (rapor): mahkeme, dosya no, taraflar, aşama, sıradaki iş, yargılama süresi ve Tazminat Komisyonu durumu.
// Hukuk, ceza, idari dava, soruşturma, icra… bütün türler; şahsi dosyalar katılmaz. Excel'e aktarılabilir.
import type { Foy } from "./foy";
import { turBilgi } from "./foyTurleri";

const gunFark = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b.slice(0, 10) + "T00:00:00Z") - Date.parse(a.slice(0, 10) + "T00:00:00Z")) / 86400000));
const tarihYaz = (x?: string) => (x ? x.slice(0, 10).split("-").reverse().join(".") : "");

/** "3 yıl 4 ay" */
export function sureYaz(gun: number): string {
  const yil = Math.floor(gun / 365.25), ay = Math.floor((gun - yil * 365.25) / 30.44);
  if (!yil && !ay) return `${gun} gün`;
  return [yil ? `${yil} yıl` : "", ay ? `${ay} ay` : ""].filter(Boolean).join(" ");
}

export interface Sure { gun: number; metin: string; tahmini: boolean; bitmedi: boolean }
/** Yargılama süresi: açılıştan (yoksa föyün oluşturulduğu günden, tahmini) kapanışa ya da bugüne. */
export function yargilamaSuresi(f: Foy, bugun = new Date().toISOString().slice(0, 10)): Sure {
  const bas = f.acilis || f.olusturma.slice(0, 10);
  const bitmedi = f.durum !== "kapali";
  const son = bitmedi ? bugun : f.kapanis || f.guncelleme.slice(0, 10);
  const gun = gunFark(bas, son);
  return { gun, metin: sureYaz(gun), tahmini: !f.acilis || (!bitmedi && !f.kapanis), bitmedi };
}

/** Sıradaki iş: en yakın tarihli açık görev; yoksa duruşma; yoksa ilk açık görev. */
export function siradakiIs(f: Foy): { metin: string; tarih?: string } {
  const acik = f.gorevler.filter(g => !g.bitti);
  const tarihli = acik.filter(g => g.tarih).sort((a, b) => a.tarih!.localeCompare(b.tarih!));
  if (tarihli.length) return { metin: tarihli[0].metin, tarih: tarihli[0].tarih };
  if (f.durusma) return { metin: "Duruşma", tarih: f.durusma };
  if (acik.length) return { metin: acik[0].metin };
  return { metin: "" };
}

const KOMISYON = /TAZM[İI]NAT KOM[İI]SYONU/;
/** Tazminat Komisyonu: föye yazılan durum; yoksa bağlı (zincir ya da ilgili) bir Tazminat Komisyonu föyü varsa "başvuruldu". */
export function komisyonDurumu(f: Foy, byId: Map<string, Foy>): { durum: "yok" | "basvuruldu" | "sonuclandi"; tarih?: string; kaynak: "elle" | "bagli" | "yok" } {
  if (f.komisyon && f.komisyon.durum !== "yok") return { durum: f.komisyon.durum, tarih: f.komisyon.tarih, kaynak: "elle" };
  const bagli = [...(f.ilgiliIds || []), ...(f.oncekiId ? [f.oncekiId] : [])].map(id => byId.get(id)).filter(Boolean) as Foy[];
  for (const x of byId.values()) if (x.oncekiId === f.id) bagli.push(x);
  const k = bagli.find(x => KOMISYON.test((x.mahkeme || "").toLocaleUpperCase("tr")));
  if (k) return { durum: k.durum === "kapali" ? "sonuclandi" : "basvuruldu", tarih: k.acilis, kaynak: "bagli" };
  return { durum: f.komisyon?.durum || "yok", kaynak: f.komisyon ? "elle" : "yok" };
}
export const komisyonAdi = (d: "yok" | "basvuruldu" | "sonuclandi") => (d === "basvuruldu" ? "Başvuruldu" : d === "sonuclandi" ? "Sonuçlandı" : "Başvurulmadı");

/** Bu türde Tazminat Komisyonu sorulur mu (yargılama ya da soruşturma olan dosyalar). */
export const komisyonaUygun = (f: Foy) => ["hukuk", "ceza", "idari_dava", "sorusturma", "icra", "idari_sorusturma"].includes(f.tur || "hukuk") && !KOMISYON.test((f.mahkeme || "").toLocaleUpperCase("tr"));

export interface ListeSatir {
  f: Foy; tur: string; mahkeme: string; esasNo: string; taraflar: string; asama: string; sonrakiIs: string; sonrakiTarih?: string;
  acilis: string; sure: Sure; komisyon: ReturnType<typeof komisyonDurumu>;
}
export interface ListeSuzgec {
  tur: string; durum: "acik" | "kapali" | "hepsi"; enAzYil: number; komisyon: "hepsi" | "yok" | "var"; sirala: "sure" | "acilisEski" | "acilisYeni" | "mahkeme" | "is"; ara: string;
}
export function davaListesi(liste: Foy[], s: ListeSuzgec, bugun = new Date().toISOString().slice(0, 10)): ListeSatir[] {
  const buro = liste.filter(f => !f.ozel);
  const byId = new Map(buro.map(f => [f.id, f] as const));
  const q = s.ara.trim().toLocaleLowerCase("tr");
  const xs = buro
    .filter(f => s.tur === "hepsi" || (f.tur || "hukuk") === s.tur)
    .filter(f => s.durum === "hepsi" || f.durum === s.durum)
    .map(f => {
      const is = siradakiIs(f);
      return {
        f, tur: turBilgi(f.tur).ad, mahkeme: f.mahkeme, esasNo: f.esasNo,
        taraflar: [f.muvekkil, f.karsiTaraf].filter(Boolean).join(" – "),
        asama: f.asama || "", sonrakiIs: is.metin, sonrakiTarih: is.tarih,
        acilis: f.acilis || "", sure: yargilamaSuresi(f, bugun), komisyon: komisyonDurumu(f, byId)
      };
    })
    .filter(x => x.sure.gun >= s.enAzYil * 365.25)
    .filter(x => s.komisyon === "hepsi" || (s.komisyon === "var" ? x.komisyon.durum !== "yok" : x.komisyon.durum === "yok" && komisyonaUygun(x.f)))
    .filter(x => !q || [x.mahkeme, x.esasNo, x.taraflar, x.asama, x.sonrakiIs, x.f.davaTuru].join(" ").toLocaleLowerCase("tr").includes(q));
  const cmp: Record<ListeSuzgec["sirala"], (a: ListeSatir, b: ListeSatir) => number> = {
    sure: (a, b) => b.sure.gun - a.sure.gun,
    acilisEski: (a, b) => (a.acilis || "9999").localeCompare(b.acilis || "9999"),
    acilisYeni: (a, b) => (b.acilis || "").localeCompare(a.acilis || ""),
    mahkeme: (a, b) => a.mahkeme.localeCompare(b.mahkeme, "tr") || a.esasNo.localeCompare(b.esasNo),
    is: (a, b) => (a.sonrakiTarih || "9999").localeCompare(b.sonrakiTarih || "9999")
  };
  return xs.sort(cmp[s.sirala]);
}

/** Excel satırları (ilk satır başlık). */
export function listeTablosu(xs: ListeSatir[]): (string | number)[][] {
  return [
    ["Tür", "Mahkeme / merci", "Dosya no", "Müvekkil – karşı taraf", "Dava türü", "Aşama", "Sıradaki iş", "Sıradaki iş tarihi", "Açılış", "Yargılama süresi", "Süre (gün)", "Durum", "Tazminat Komisyonu", "Komisyon başvuru tarihi"],
    ...xs.map(x => [x.tur, x.mahkeme, x.esasNo, x.taraflar, x.f.davaTuru || "", x.asama, x.sonrakiIs, tarihYaz(x.sonrakiTarih), tarihYaz(x.acilis), x.sure.metin + (x.sure.tahmini ? " (tahmini)" : ""), x.sure.gun,
      x.f.durum === "kapali" ? "Kapalı" : "Açık", komisyonaUygun(x.f) || x.komisyon.durum !== "yok" ? komisyonAdi(x.komisyon.durum) : "", tarihYaz(x.komisyon.tarih)])
  ];
}
