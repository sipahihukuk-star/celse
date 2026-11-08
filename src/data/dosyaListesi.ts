// UYAP dosya listesi çıktısı (Avukat Portal "Dosya Sorgulama" sonucu PDF olarak indirilmiş ya da taranmış): her satır bir dosya
// (Birim · Dosya No · Dosya Türü · Dosya Durumu · Açılış Tarihi). Bu bir evrak değil, dosya listesidir: her satır bir föy olur
// (Excel listesi aktarımıyla aynı). Okuma cihazda yapılır; hiçbir şey gönderilmez.
import { bosFoy, Foy } from "./foy";
import { turTahmin } from "./foyTurleri";
import { basHarf } from "./kunyeCikar";

const ESAS = /\b((?:19|20)\d{2})\s*\/\s*(\d{1,7})\b/;
const TARIH = /\b(\d{1,2})[./](\d{1,2})[./]((?:19|20)\d{2})\b/;
const MERCI_SON = /(MAHKEMESİ|HAKİMLİĞİ|BAŞSAVCILIĞI|SAVCILIĞI|İCRA DAİRESİ|İCRA MÜDÜRLÜĞÜ|HUKUK DAİRESİ|CEZA DAİRESİ|DAVA DAİRESİ|KOMİSYONU BAŞKANLIĞI|KOMİSYONU|ARABULUCULUK BÜROSU|HAKEM HEYETİ|DANIŞTAY|YARGITAY)/;
const DUR = /^(AÇIK|KAPALI|KAPANMIŞ|DERDEST|\d+|(?:19|20)\d{2}\/\d+|\d{1,2}[./]\d{1,2}[./]\d{4}|DOSYASI|DOSYA|NO|BİRİM|[-–|•])$/;

function merciBul(u: string): string | undefined {
  const m = u.match(MERCI_SON);
  if (!m || m.index === undefined) return undefined;
  // Anahtar sözcükten geriye doğru en çok 7 sözcük: numara, tarih, durum ya da tür sözcüğüne gelince durulur.
  const once = u.slice(0, m.index).split(/\s+/).filter(Boolean);
  const al: string[] = [];
  for (let i = once.length - 1; i >= 0 && al.length < 7; i--) { if (DUR.test(once[i]) && !/^\d{1,2}\.$/.test(once[i])) break; al.unshift(once[i]); }
  const x = [...al, m[1]].join(" ").replace(/^[|•\-–\s]+/, "").trim();
  return x.length > 6 ? x : undefined;
}

export interface ListeSatiri { mahkeme?: string; esasNo: string; dosyaTuru?: string; kapali: boolean; acilis?: string }

/** Metin bir dosya listesiyse satırlarını döner; değilse null (tek dosyaya ait evrak). */
export function dosyaListesiOku(metin: string): ListeSatiri[] | null {
  const satirlar = metin.split("\n").map(x => x.replace(/\s+/g, " ").trim()).filter(Boolean);
  const out: ListeSatiri[] = [];
  for (let i = 0; i < satirlar.length; i++) {
    const x = satirlar[i], u = x.toLocaleUpperCase("tr");
    const e = u.match(ESAS);
    if (!e || x.length > 220) continue;
    // Birim adı bazen satıra sığmaz, bir üst ya da alt satıra taşar.
    let mahkeme = merciBul(u);
    if (!mahkeme) for (const j of [i - 1, i + 1]) { const y = satirlar[j]?.toLocaleUpperCase("tr"); if (y && !ESAS.test(y)) { mahkeme = merciBul(y); if (mahkeme) break; } }
    const tur = u.match(/((?:[A-ZÇĞİÖŞÜ.]+\s+){0,2}[A-ZÇĞİÖŞÜ.]+)\s+DOSYASI\b/)?.[1];
    if (!mahkeme && !tur) continue;
    const t = u.replace(ESAS, " ").match(TARIH);
    const acilis = t ? `${t[3]}-${t[2].padStart(2, "0")}-${t[1].padStart(2, "0")}` : undefined;
    out.push({ mahkeme: mahkeme ? basHarf(mahkeme) : undefined, esasNo: `${e[1]}/${e[2]}`, dosyaTuru: tur ? basHarf(tur + " DOSYASI") : undefined, kapali: /\b(KAPALI|KAPANMIŞ)\b/.test(u), acilis });
  }
  // Liste sayılması için: en az 3 ayrı dosya ve satırların önemli kısmı dosya satırı (kararda geçen birkaç atıf liste değildir).
  const tek = new Map(out.map(r => [(r.mahkeme || "") + "|" + r.esasNo, r]));
  if (tek.size < 3 || out.length < satirlar.length * 0.2) return null;
  return [...tek.values()];
}

export function listedenFoyler(metin: string, kaynak: string): Foy[] {
  const xs = dosyaListesiOku(metin);
  if (!xs) return [];
  return xs.map(r => bosFoy({
    tur: (r.dosyaTuru && turTahmin(r.dosyaTuru)) || turTahmin(r.mahkeme || "") || "hukuk",
    mahkeme: r.mahkeme || "", esasNo: r.esasNo, acilis: r.acilis, durum: r.kapali ? "kapali" : "acik",
    notlar: `UYAP dosya listesinden aktarıldı (${kaynak})${r.dosyaTuru ? " · " + r.dosyaTuru : ""}.`
  }));
}
