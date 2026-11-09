// Yapılacaklar takibi: bütün föylerdeki işler tek listede. Uyarı son gün gelince değil, gün geçtikçe artar:
// kalan gün azaldıkça ve eklenmeden son güne kadarki sürenin büyük kısmı geçtikçe düzey yükselir; son günü
// yazılmamış işler de bekledikçe uyarır. İş, iş emri / evrak numarası olmadan kapanmaz; numara görselden okunabilir.
import type { Foy, Gorev } from "./foy";

export type Duzey = "gecikti" | "bugun" | "acil" | "uyari" | "dikkat" | "sakin" | "tarihsiz";
export const DUZEY_SIRA: Duzey[] = ["gecikti", "bugun", "acil", "uyari", "dikkat", "sakin", "tarihsiz"];
export const DUZEY_AD: Record<Duzey, string> = {
  gecikti: "Gecikti", bugun: "Son gün bugün", acil: "Acil (3 gün ve az)", uyari: "Uyarı (bu hafta)", dikkat: "Dikkat (2 hafta)", sakin: "Zamanı var", tarihsiz: "Son günü yok"
};

const gun = (x: string) => Date.parse(x.slice(0, 10) + "T00:00:00Z");
const fark = (a: string, b: string) => Math.round((gun(b) - gun(a)) / 86400000);
export const bugunStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export interface Uyari { duzey: Duzey; kalan?: number; gecen: number; oran?: number; metin: string }
/** İşin uyarı düzeyi. Kalan gün: 14+ sakin, 8–14 dikkat, 4–7 uyarı, 1–3 acil, 0 bugün, eksi gecikti.
 * Sürenin yarısı geçince en az "dikkat", dörtte üçü geçince en az "uyarı". Son günü yoksa 14 gün bekleyince
 * "dikkat", 30 gün bekleyince "uyarı". */
export function uyariDuzeyi(g: Gorev, f: Foy, bugun = bugunStr()): Uyari {
  const eklenme = (g.eklenme || f.olusturma || bugun).slice(0, 10);
  const gecen = Math.max(0, fark(eklenme, bugun));
  if (!g.tarih) {
    const duzey: Duzey = gecen >= 30 ? "uyari" : gecen >= 14 ? "dikkat" : "tarihsiz";
    return { duzey, gecen, metin: gecen >= 14 ? `${gecen} gündür bekliyor, son gün yazılmamış` : "son gün yazılmamış" };
  }
  const kalan = fark(bugun, g.tarih);
  const toplam = Math.max(1, fark(eklenme, g.tarih));
  const oran = kalan <= 0 ? 1 : Math.min(1, gecen / toplam);
  let duzey: Duzey = kalan < 0 ? "gecikti" : kalan === 0 ? "bugun" : kalan <= 3 ? "acil" : kalan <= 7 ? "uyari" : kalan <= 14 ? "dikkat" : "sakin";
  const yuksel = (d: Duzey) => { if (DUZEY_SIRA.indexOf(d) < DUZEY_SIRA.indexOf(duzey)) duzey = d; };
  if (oran >= 0.75) yuksel("uyari"); else if (oran >= 0.5) yuksel("dikkat");
  const yuzde = Math.round(oran * 100);
  const metin = kalan < 0 ? `${-kalan} gün gecikti` : kalan === 0 ? "son gün bugün" : `son güne ${kalan} gün` + (yuzde >= 50 ? ` · sürenin %${yuzde}'i geçti` : "");
  return { duzey, kalan, gecen, oran, metin };
}

export interface IsSatir { f: Foy; g: Gorev; u: Uyari }
/** kisi: "hepsi", "yok" (kimseye atanmamış) ya da çalışanın kullanıcı kimliği */
export interface IsSuzgec { gorunum: "acik" | "kapali" | "hepsi"; duzey: "hepsi" | "acil" | "hafta" | "gecikti" | Duzey; tur: string; ara: string; kisi?: string }

/** Bütün föylerdeki işler; açıklar uyarı düzeyine, sonra son güne göre sıralanır. Şahsi föyler dahil değil. */
export function isListesi(liste: Foy[], s: IsSuzgec, bugun = bugunStr()): IsSatir[] {
  const q = s.ara.trim().toLocaleLowerCase("tr");
  const xs: IsSatir[] = [];
  for (const f of liste) {
    if (f.ozel) continue;
    if (s.tur !== "hepsi" && (f.tur || "hukuk") !== s.tur) continue;
    for (const g of f.gorevler) {
      if (s.gorunum === "acik" && g.bitti || s.gorunum === "kapali" && !g.bitti) continue;
      if (s.kisi && s.kisi !== "hepsi" && (s.kisi === "yok" ? !!g.atanan : g.atanan !== s.kisi)) continue;
      const u = uyariDuzeyi(g, f, bugun);
      if (!g.bitti && s.duzey !== "hepsi") {
        const i = DUZEY_SIRA.indexOf(u.duzey);
        const ok = s.duzey === "acil" ? i <= 2 : s.duzey === "hafta" ? i <= 3 : s.duzey === u.duzey;
        if (!ok) continue;
      }
      if (q && ![g.metin, f.muvekkil, f.karsiTaraf, f.mahkeme, f.esasNo, g.kapanis?.no || "", g.atananAd || ""].join(" ").toLocaleLowerCase("tr").includes(q)) continue;
      xs.push({ f, g, u });
    }
  }
  return xs.sort((a, b) => {
    if (a.g.bitti !== b.g.bitti) return a.g.bitti ? 1 : -1;
    if (a.g.bitti) return (b.g.kapanis?.tarih || "").localeCompare(a.g.kapanis?.tarih || "");
    return DUZEY_SIRA.indexOf(a.u.duzey) - DUZEY_SIRA.indexOf(b.u.duzey) || (a.g.tarih || "9999").localeCompare(b.g.tarih || "9999");
  });
}

/** Açık işlerin düzeylere göre sayısı. */
export function duzeySayilari(liste: Foy[], bugun = bugunStr()): Record<Duzey, number> {
  const n = Object.fromEntries(DUZEY_SIRA.map(d => [d, 0])) as Record<Duzey, number>;
  for (const f of liste) if (!f.ozel) for (const g of f.gorevler) if (!g.bitti) n[uyariDuzeyi(g, f, bugun).duzey]++;
  return n;
}

// ── İş emri / evrak numarası: görselden (yazı tanıma çıktısından) bulunur ──────────────────────────────
const ETIKET = /(İŞ\s*EMR[İI]|EVRAK|BELGE|[İI]ŞLEM|MAKBUZ|BARKOD|REFERANS|GÖNDER[İI]M?|TAK[İI]P|BAŞVURU|KAYIT|SIRA|ONAY|TALEP|DEKONT)\s*(N[O0]\.?|NUMARASI|ID|KODU)?\s*[:.\-=]?\s*([A-Z0-9][A-Z0-9\-\/.]{3,30})/gu;
const ETIKET_PUAN: Record<string, number> = { "İŞ EMRİ": 10, "İŞ EMRI": 10, EVRAK: 8, BELGE: 7, İŞLEM: 7, ISLEM: 7, MAKBUZ: 6, BARKOD: 6, REFERANS: 6, ONAY: 5, DEKONT: 5, KAYIT: 4, BAŞVURU: 4, TALEP: 4, GÖNDERİ: 4, GÖNDERİM: 4, TAKİP: 3, TAKIP: 3, SIRA: 2 };

export interface NoAday { no: string; etiket: string; puan: number }
/** Yazı tanıma çıktısında iş emri / evrak numarası adayları; en olası önce. TC kimlik no gibi 11 haneli sayılar alınmaz. */
export function isEmriAdaylari(metin: string): NoAday[] {
  const m = metin.toLocaleUpperCase("tr");
  const adaylar = new Map<string, NoAday>();
  const duzelt = (x: string) => {
    const v = x.replace(/[.\-\/]+$/, "");
    // Çoğunlukla rakam olan değerde yazı tanımanın O/I/l/S karışıklığı düzeltilir.
    const rakam = (v.match(/\d/g) || []).length;
    return /^[\dOILS]+$/.test(v) && rakam >= v.length * 0.6 ? v.replace(/O/g, "0").replace(/[IL]/g, "1").replace(/S/g, "5") : v;
  };
  const uygun = (v: string) => /\d{3,}/.test(v) && !/^\d{11}$/.test(v) && !/^\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}$/.test(v) && !/^(19|20)\d{2}\/\d+$/.test(v);
  const ekle = (no: string, etiket: string, puan: number) => {
    const o = adaylar.get(no);
    if (!o || o.puan < puan) adaylar.set(no, { no, etiket, puan });
  };
  for (const x of m.matchAll(ETIKET)) {
    const v = duzelt(x[3]);
    if (!uygun(v)) continue;
    const e = x[1].replace(/\s+/g, " ");
    ekle(v, x[1].replace(/\s+/g, " ") + (x[2] ? " " + x[2] : ""), (ETIKET_PUAN[e] || 3) + (x[2] ? 2 : 0));
  }
  // Etiketsiz uzun numaralar (7+ hane) zayıf aday olarak eklenir.
  for (const x of m.matchAll(/(?<![\d\/.])\d{7,20}(?![\d\/])/g)) if (uygun(x[0])) ekle(x[0], "", 1);
  return [...adaylar.values()].sort((a, b) => b.puan - a.puan || b.no.length - a.no.length).slice(0, 6);
}

/** Excel satırları (ilk satır başlık). */
export function isTablosu(xs: IsSatir[]): (string | number)[][] {
  const tr = (x?: string) => (x ? x.slice(0, 10).split("-").reverse().join(".") : "");
  return [
    ["İş", "Müvekkil – karşı taraf", "Mahkeme / merci", "Dosya no", "Eklenme", "Son gün", "Uyarı", "Durum", "Kapanış tarihi", "İş emri / evrak no", "Atanan"],
    ...xs.map(x => [x.g.metin, [x.f.muvekkil, x.f.karsiTaraf].filter(Boolean).join(" – "), x.f.mahkeme, x.f.esasNo, tr(x.g.eklenme || x.f.olusturma), tr(x.g.tarih),
      x.g.bitti ? "" : DUZEY_AD[x.u.duzey] + " – " + x.u.metin, x.g.bitti ? "Kapandı" : "Açık", tr(x.g.kapanis?.tarih), x.g.kapanis?.no || (x.g.bitti ? "(numarasız kapatılmış)" : ""), x.g.atananAd || ""])
  ];
}
