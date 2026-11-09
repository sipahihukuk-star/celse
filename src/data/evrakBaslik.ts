// Evrak başlığı: föye giren her evrakın neye ait olduğu dışarıdan görünsün. Başlık evrakın türü ve konusundan
// (dilekçede KONU satırı, kararda hüküm, ara kararda sonraki duruşma), "ait" satırı föyün künyesinden (merci, dosya no,
// taraflar) kurulur. İndirilen dosyanın adı da bu başlıkla verilir. Hepsi cihazda; hiçbir şey gönderilmez.
import type { Foy, FoyEvrak } from "./foy";
import { turBilgi } from "./foyTurleri";

const tr = (x?: string) => (x ? x.slice(0, 10).split("-").reverse().join(".") : "");
const kisalt = (x: string, n: number) => (x.length > n ? x.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : x);
const ust = (x: string) => x.toLocaleUpperCase("tr");

const HUKUM: [RegExp, string][] = [
  [/İSTİNAF BAŞVURUSUNUN ESASTAN REDD[İI]NE/, "İstinaf başvurusu esastan ret"],
  [/BOZULMASINA/, "Bozma"],
  [/ONANMASINA/, "Onama"],
  [/KISMEN KABUL/, "Kısmen kabul"],
  [/DAVANIN KABUL[ÜU]NE|TALEB[İI]N KABUL[ÜU]NE|İT[İI]RAZIN KABUL[ÜU]NE/, "Kabul"],
  [/DAVANIN REDD[İI]NE|TALEB[İI]N REDD[İI]NE|İT[İI]RAZIN REDD[İI]NE/, "Ret"],
  [/BERAAT[İI]NE/, "Beraat"],
  [/HÜKMÜN AÇIKLANMASININ GER[İI] BIRAKILMASINA/, "HAGB"],
  [/MAHKUM[İI]YET[İI]NE|CEZALANDIRILMASINA/, "Mahkûmiyet"],
  [/KOVUŞTURMAYA YER OLMADIĞINA/, "Kovuşturmaya yer olmadığı (KYOK)"],
  [/DÜŞMES[İI]NE/, "Düşme"],
  [/GÖREVS[İI]ZL[İI]K/, "Görevsizlik"],
  [/YETK[İI]S[İI]ZL[İI]K/, "Yetkisizlik"]
];

/** Evrakın içeriğinden kısa konu (yoksa boş). */
export function konuCikar(metin: string, tur?: string): string {
  const m = (metin || "").slice(0, 40000);
  if (!m.trim()) return "";
  const k = m.match(/(?:^|\n)\s*KONU\s*[:：]\s*([^\n]{4,300})/i);
  if (k) return kisalt(k[1].replace(/\s+/g, " ").trim().replace(/[.;,]+$/, ""), 110);
  const U = ust(m);
  const hb = U.lastIndexOf("HÜKÜM") >= 0 ? U.slice(U.lastIndexOf("HÜKÜM")) : /karar|ilam|iddianame|takipsizlik|kyok/i.test(tur || "") ? U : "";
  if (hb) for (const [re, ad] of HUKUM) if (re.test(hb)) return ad;
  const d = U.match(/DURUŞMAN[İI]N\s+(\d{1,2}[./]\d{1,2}[./]\d{4})/) || U.match(/(?:SONRAK[İI] )?DURUŞMA (?:TAR[İI]H[İI]|GÜNÜ)\s*[:：]?\s*(\d{1,2}[./]\d{1,2}[./]\d{4})/);
  if (d) return "Sonraki duruşma " + d[1].replace(/\//g, ".");
  const ist = U.match(/(B[İI]L[İI]RK[İI]Ş[İI] RAPORUNA|İSTİNAF|TEMY[İI]Z|CEVAP|REPL[İI]K|DUPL[İI]K|İT[İI]RAZ|BEYAN) D[İI]LEKÇES[İI]/);
  if (ist) return ist[0].charAt(0) + ist[0].slice(1).toLocaleLowerCase("tr");
  return "";
}

export interface EvrakBasligi { baslik: string; ait: string; dosyaAdi: string }
/** Evrakın üstünde görünen başlık, neye ait olduğu ve indirilecek dosya adı. */
export function evrakBasligi(f: Foy, e: FoyEvrak): EvrakBasligi {
  const konu = e.konu ?? konuCikar(e.metin, e.tur);
  const tur = e.tur && e.tur !== "Diğer" ? e.tur : "Evrak";
  const baslik = [tur, konu && konu.toLocaleLowerCase("tr") !== tur.toLocaleLowerCase("tr") ? konu : "", e.tarih ? tr(e.tarih) : ""].filter(Boolean).join(" · ");
  const taraf = [f.muvekkil, f.karsiTaraf].filter(Boolean).join(" – ");
  const ait = [turBilgi(f.tur).ad, [f.mahkeme, f.esasNo].filter(Boolean).join(" "), taraf].filter(Boolean).join(" · ");
  const uzanti = (e.ad.match(/\.[A-Za-z0-9]{2,5}$/) || [""])[0];
  const ad = [e.tarih || e.eklenme.slice(0, 10), tur, konu, f.esasNo.replace(/\//g, "-"), f.muvekkil.split(/\s+/).slice(-1)[0] || ""]
    .filter(Boolean).join(" ").replace(/[\\/:*?"<>|\n\r\t]+/g, " ").replace(/\s+/g, " ").trim();
  return { baslik, ait, dosyaAdi: kisalt(ad, 120).replace(/…$/, "") + uzanti };
}
