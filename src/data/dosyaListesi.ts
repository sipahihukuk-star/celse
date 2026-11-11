// UYAP dosya listesi çıktısı (Avukat Portal "Dosya Sorgulama" sonucu PDF olarak indirilmiş ya da taranmış): her satır bir dosya
// (Birim · Dosya No · Dosya Türü · Dosya Durumu · Açılış Tarihi). Bu bir evrak değil, dosya listesidir: her satır bir föy olur
// (Excel listesi aktarımıyla aynı). Okuma cihazda yapılır; hiçbir şey gönderilmez.
import { bosFoy, Foy } from "./foy";
import { turTahmin } from "./foyTurleri";
import { basHarf } from "./kunyeCikar";

const ESAS = /\b((?:19|20)\d{2})\s*\/\s*(\d{1,7})\b/;
const TARIH = /\b(\d{1,2})[./](\d{1,2})[./]((?:19|20)\d{2})\b/;
const MERCI_SON = /(MAHKEMESİ|HAKİMLİĞİ|HÂKİMLİĞİ|SATIŞ MEMURLUĞU|BAŞSAVCILIĞI|SAVCILIĞI|İCRA DAİRESİ|İCRA MÜDÜRLÜĞÜ|HUKUK DAİRESİ|CEZA DAİRESİ|DAVA DAİRESİ|KOMİSYONU BAŞKANLIĞI|KOMİSYONU|ARABULUCULUK BÜROSU|HAKEM HEYETİ|DANIŞTAY|YARGITAY)/;
const DUR = /^(AÇIK|KAPALI|KAPANMIŞ|DERDEST|\d+|(?:19|20)\d{2}\/\d+|\d{1,2}[./]\d{1,2}[./]\d{4}|DOSYASI|DOSYA|NO|BİRİM|[-–|•])$/;

/** Büyük harfli satırda merci adı (… MAHKEMESİ, … İCRA DAİRESİ …). */
export function merciBul(u: string): string | undefined {
  const m = u.match(MERCI_SON);
  if (!m || m.index === undefined) return undefined;
  // Anahtar sözcükten geriye doğru en çok 7 sözcük: numara, tarih, durum ya da tür sözcüğüne gelince durulur.
  const once = u.slice(0, m.index).split(/\s+/).filter(Boolean);
  const al: string[] = [];
  for (let i = once.length - 1; i >= 0 && al.length < 7; i--) { if (DUR.test(once[i]) && !/^\d{1,2}\.$/.test(once[i])) break; al.unshift(once[i]); }
  const x = [...al, m[1]].join(" ").replace(/^[|•\-–\s]+/, "").trim();
  return x.length > 6 ? x : undefined;
}

/** İcra ceza mahkemesi dosyaları (İİK 331 vd. suçlar: mal beyanında bulunmama, taahhüdü ihlal, karşılıksız…): ceza davası
 * türünde, dava türü "İcra ceza"; çoğu zaman bir icra takibinin devamıdır. */
export const ICRA_CEZA = "İcra ceza (İİK 331 vd.)";
export const icraCezaMi = (...xs: (string | undefined)[]) => /İCRA CEZA/.test(xs.filter(Boolean).join(" ").toLocaleUpperCase("tr"));

export interface ListeSatiri { mahkeme?: string; esasNo: string; dosyaTuru?: string; kapali: boolean; acilis?: string; satir: string }

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
    out.push({ mahkeme: mahkeme ? basHarf(mahkeme) : undefined, esasNo: `${e[1]}/${e[2]}`, dosyaTuru: tur ? basHarf(tur + " DOSYASI") : undefined, kapali: /\b(KAPALI|KAPANMIŞ)\b/.test(u), acilis, satir: x });
  }
  // Liste sayılması için: en az 3 ayrı dosya ve satırların önemli kısmı dosya satırı (kararda geçen birkaç atıf liste değildir).
  const tek = new Map(out.map(r => [(r.mahkeme || "") + "|" + r.esasNo, r]));
  // Tek satırlık UYAP çıktısı da (başlığında "Dosya Durumu", "Açılış Tarihi" gibi sütunlar olan) listedir.
  const baslikli = /DOSYA\s+DURUMU|AÇILIŞ\s+TARİHİ|DOSYA\s+TÜRÜ|BİRİM\s+ADI/.test(metin.toLocaleUpperCase("tr")) && satirlar.length <= 40;
  if ((tek.size < 3 && !(baslikli && tek.size >= 1)) || out.length < satirlar.length * 0.2 && !baslikli) return null;
  return [...tek.values()];
}

export function listedenFoyler(metin: string, kaynak: string): Foy[] {
  const xs = dosyaListesiOku(metin);
  if (!xs) return [];
  return xs.map(r => {
    // Satış memurluğu sulh hukuktan (ortaklığın giderilmesi) ya da icradan gelir: satırın kendisine de bakılır.
    const satis = /SATIŞ MEMURLUĞU/.test(((r.mahkeme || "") + " " + (r.dosyaTuru || "")).toLocaleUpperCase("tr"));
    const tur = (satis ? turTahmin(r.dosyaTuru || "", r.mahkeme || "", r.satir) : (r.dosyaTuru && turTahmin(r.dosyaTuru)) || turTahmin(r.mahkeme || "")) || "hukuk";
    return bosFoy({
    tur, davaTuru: satis ? (tur === "icra" ? "Satış (icra satışı)" : "Satış (ortaklığın giderilmesi – sulh hukuk)") : icraCezaMi(r.mahkeme, r.dosyaTuru) ? ICRA_CEZA : "",
    mahkeme: r.mahkeme || "", esasNo: r.esasNo, acilis: r.acilis, durum: r.kapali ? "kapali" : "acik",
    notlar: `UYAP dosya listesinden aktarıldı (${kaynak})${r.dosyaTuru ? " · " + r.dosyaTuru : ""}.`
    });
  });
}

/** Daha önce UYAP listesinden aktarılmış föylerin türünü yeni kurallarla yeniden belirler. Yalnız türü listeden geldiği gibi
 * duran (notlarında aktarma notu olan, evrakı olmayan) föyler; avukatın elle değiştirdiği tür değişmez (tahmin aynı türü verir). */
export function turDuzeltmeleri(liste: Foy[]): { f: Foy; tur: Foy["tur"] & string; davaTuru: string }[] {
  const out: { f: Foy; tur: Foy["tur"] & string; davaTuru: string }[] = [];
  for (const f of liste) {
    const n = (f.notlar || "").match(/UYAP dosya listesinden aktarıldı \([^)]*\)(?: · ([^.\n]+))?\./);
    if (!n || f.evraklar.length) continue;
    const dosyaTuru = n[1] || "";
    // İcra ceza dosyası: tür ceza, dava türü boşsa "İcra ceza" yazılır.
    if (icraCezaMi(f.mahkeme, dosyaTuru)) {
      if (!f.davaTuru && (f.tur || "hukuk") === "ceza") out.push({ f, tur: "ceza", davaTuru: ICRA_CEZA });
      else if ((f.tur || "hukuk") === "hukuk") out.push({ f, tur: "ceza", davaTuru: f.davaTuru || ICRA_CEZA });
      continue;
    }
    const satis = /SATIŞ MEMURLUĞU/.test((f.mahkeme + " " + dosyaTuru).toLocaleUpperCase("tr"));
    const tur = (satis ? turTahmin(dosyaTuru, f.mahkeme) : (dosyaTuru && turTahmin(dosyaTuru)) || turTahmin(f.mahkeme)) || "hukuk";
    // Yalnız varsayılan "hukuk" olarak açılmış föyler düzeltilir (öteki türler zaten tanınmıştı).
    // Varsayılan "hukuk" olarak açılmış föyler; Tazminat Komisyonu ve AYM/AİHM dosyaları önceki düzeltmede "idari başvuru" olmuş olabilir.
    const yeniTurler = tur === "tazminat_komisyonu" || tur === "bireysel_basvuru";
    if (!((f.tur || "hukuk") === "hukuk" || (yeniTurler && f.tur === "idari_basvuru")) || tur === "hukuk" && !satis) continue;
    if (tur === (f.tur || "hukuk") && !(satis && !f.davaTuru)) continue;
    out.push({ f, tur, davaTuru: satis ? (tur === "icra" ? "Satış (icra satışı)" : "Satış (ortaklığın giderilmesi – sulh hukuk)") : "" });
  }
  return out;
}
