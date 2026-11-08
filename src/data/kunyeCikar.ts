// Evraktan künye çıkarma (cihazda, yapay zekâsız): UYAP evrakının başlığındaki mahkeme, esas no, taraflar, vekiller,
// kimlik numaraları, adresler, duruşma günü ve dava konusu; vekâletnamede noterlik, tarih ve yevmiye no. Gerçek adlar
// içerdiği için bu iş bilinçli olarak cihazda yapılır, metin hiçbir yere gönderilmez. Föyde yalnız BOŞ alanlar doldurulur.
import type { Foy, KarsiBilgi, MuvekkilBilgi } from "./foy";

export interface TarafOneri { ad: string; kimlikNo?: string; adres?: string; vekil?: string }
export interface KunyeOneri {
  mahkeme?: string; esasNo?: string; konu?: string; durusma?: string;
  birinci?: TarafOneri; ikinci?: TarafOneri;
  vekalet?: { noter?: string; tarih?: string; yevmiye?: string; kimlikNo?: string };
}

const BUYUK = "A-ZÇĞİÖŞÜÂÎÛ";
const tr = (s: string) => s.toLocaleLowerCase("tr");
/** "İZMİR 3. ASLİYE HUKUK MAHKEMESİ" → "İzmir 3. Asliye Hukuk Mahkemesi" (karışık yazılmışsa dokunmaz). */
export function basHarf(s: string) {
  const x = s.replace(/\s+/g, " ").trim();
  if (x !== x.toLocaleUpperCase("tr")) return x;
  // "A.Ş.", "LTD.", "ŞTİ." gibi kısaltmalar büyük kalır.
  return x.split(" ").map(w => (/^(VE|İLE|DA|DE)$/.test(w) ? tr(w) : /^([A-ZÇĞİÖŞÜ]\.)+$|^(LTD|ŞTİ|A\.Ş|T\.A\.Ş)\.?$/.test(w) ? w : w.slice(0, 1) + tr(w.slice(1)))).join(" ");
}

const BIRINCI = ["DAVACILAR", "DAVACI", "MÜŞTEKİ", "ŞİKAYETÇİ", "ŞİKÂYETÇİ", "KATILAN", "ALACAKLI", "BAŞVURUCU", "BAŞVURAN", "İTİRAZ EDEN", "İSTİNAF EDEN", "TEMYİZ EDEN"];
const IKINCI = ["DAVALILAR", "DAVALI", "ŞÜPHELİ", "SANIK", "BORÇLU", "KARŞI TARAF", "ALEYHİNE BAŞVURULAN", "KARŞI DAVALI"];
const ROLLER = [...BIRINCI, ...IKINCI].sort((a, b) => b.length - a.length);
const rolDeseni = new RegExp(`^\\s*(${ROLLER.join("|")})\\s*(VEKİLİ|VEKİLLERİ|MÜDAFİİ)?\\s*:\\s*(.*)$`, "i");

const tarihIso = (g: string, a: string, y: string, s?: string, d?: string) => {
  const yy = Number(y), aa = Number(a), gg = Number(g);
  if (aa < 1 || aa > 12 || gg < 1 || gg > 31 || yy < 2000 || yy > 2100) return undefined;
  const t = `${yy}-${String(aa).padStart(2, "0")}-${String(gg).padStart(2, "0")}`;
  return s && d ? `${t}T${String(Number(s)).padStart(2, "0")}:${d}` : t;
};

/** Taraf satırının geri kalanından ad, kimlik no ve adresi ayırır. */
function tarafAyir(kalan: string, sonraki: string): TarafOneri | undefined {
  const tum = kalan + " " + sonraki;
  const kimlik = tum.match(/(?:T\.?\s?C\.?|TCKN|Kimlik\s*No|V\.?\s?K\.?\s?N\.?|Vergi\s*No)\D{0,20}?(\d{10,11})\b/i)?.[1] || kalan.match(/(?:^|\D)(\d{11})(?:\D|$)/)?.[1];
  let ad = kalan.split(/\s[-–]\s|\(|,|\bT\.?\s?C\.?\s|\bTCKN\b|\bKimlik\b|\bAdres\b|\d/i)[0].replace(/[:;\s]+$/, "").trim();
  ad = ad.replace(/^(Av\.|Avukat)\s*/i, "").trim();
  if (ad.length < 3 || ad.split(/\s+/).length > 8) return undefined;
  // Adres: satırda adın (ve kimlik numarasının) ardından gelen kısım; satırda yoksa (rol satırı değilse) bir alttaki satır.
  const ADRES = /\b(?:Mah(?:\.|allesi)?|Cad(?:\.|desi)?|Sok(?:\.|ak)?|Sk\.|Bulv(?:\.|arı)?)\b/i;
  const temizle = (x: string) => x.replace(/\b(?:T\.?\s?C\.?|TCKN|Kimlik\s*No|Vergi\s*No|Adres(?:i)?)\s*[:.]?/gi, " ").replace(kimlik || "§§", " ")
    .split(/\s(?:VEKİLİ|VEKİLLERİ|MÜDAFİİ|DAVALI|DAVACI)\s*:/i)[0].replace(/^[\s\-–,:;]+|[\s\-–,:;]+$/g, "").replace(/\s+/g, " ");
  let adres: string | undefined;
  const kalanSonra = temizle(kalan.slice(kalan.toLocaleUpperCase("tr").indexOf(ad.toLocaleUpperCase("tr")) + ad.length));
  if (ADRES.test(kalanSonra)) adres = kalanSonra;
  else if (sonraki && ADRES.test(sonraki) && !rolDeseni.test(sonraki) && !/^\s*(VEKİLİ|VEKİLLERİ|MÜDAFİİ)\s*:/i.test(sonraki)) adres = temizle(sonraki);
  return { ad: basHarf(ad), kimlikNo: kimlik, adres: adres || undefined };
}

export function kunyeCikar(metin: string, simdi = new Date()): KunyeOneri {
  const o: KunyeOneri = {};
  const satirlar = metin.replace(/\r/g, "").split("\n").map(x => x.trim()).filter(Boolean);
  const bas = satirlar.slice(0, 60);
  // Mahkeme / savcılık / icra dairesi: başlıktaki ilk büyük harfli satır.
  const merci = new RegExp(`^(?:T\\.?\\s?C\\.?\\s+)?([${BUYUK}][${BUYUK}0-9 .]{2,60}(?:MAHKEMESİ|BAŞSAVCILIĞI|İCRA DAİRESİ|İCRA MÜDÜRLÜĞÜ|HUKUK DAİRESİ|CEZA DAİRESİ|ARABULUCULUK BÜROSU))(?=\\s|$)`);
  for (const x of bas) { const m = x.match(merci); if (m) { o.mahkeme = basHarf(m[1]); break; } }
  const esas = metin.match(/(?:ESAS\s*(?:NO|NUMARASI)?|DOSYA\s*NO|SORUŞTURMA\s*(?:NO|NUMARASI)|TAKİP\s*NO)\s*[:.]?\s*((?:19|20)\d{2}\s*\/\s*\d{1,7})/i)
    || metin.match(/\b((?:19|20)\d{2}\s*\/\s*\d{1,7})\s*(?:Esas|E\.)\b/);
  if (esas) o.esasNo = esas[1].replace(/\s+/g, "");
  // Taraflar ve vekilleri.
  let sonRol: "birinci" | "ikinci" | null = null;
  for (let i = 0; i < Math.min(satirlar.length, 120); i++) {
    const m = satirlar[i].match(rolDeseni);
    if (!m) continue;
    const rol = m[1].toLocaleUpperCase("tr").replace("ŞİKÂYETÇİ", "ŞİKAYETÇİ");
    const yan = BIRINCI.includes(rol) ? "birinci" : "ikinci";
    if (m[2]) {
      // "DAVACI VEKİLİ : Av. …"
      const v = tarafAyir(m[3], "")?.ad;
      if (v && o[yan] && !o[yan]!.vekil) o[yan]!.vekil = "Av. " + v;
      continue;
    }
    if (!o[yan]) { const t = tarafAyir(m[3], satirlar[i + 1] || ""); if (t) o[yan] = t; }
    sonRol = yan;
    // Hemen altındaki "VEKİLİ :" satırı bu tarafındır.
    const alt = satirlar[i + 1]?.match(/^\s*(VEKİLİ|VEKİLLERİ|MÜDAFİİ)\s*:\s*(.*)$/i) || satirlar[i + 2]?.match(/^\s*(VEKİLİ|VEKİLLERİ|MÜDAFİİ)\s*:\s*(.*)$/i);
    if (alt && o[yan] && !o[yan]!.vekil) { const v = tarafAyir(alt[2], "")?.ad; if (v) o[yan]!.vekil = "Av. " + v; }
  }
  void sonRol;
  // Dava konusu.
  const konu = metin.match(/^\s*(?:DAVA|DAVANIN KONUSU|KONU|SUÇ)\s*:\s*(.{3,140})$/im);
  if (konu) o.konu = basHarf(konu[1].replace(/\s+/g, " ").trim().replace(/[.;]$/, ""));
  // Duruşma günü: "duruşmanın 12/03/2027 günü saat 10:30'a bırakılmasına", "DURUŞMA TARİHİ : 12.03.2027 10:30".
  const durusmalar: string[] = [];
  const d1 = /(\d{1,2})[./](\d{1,2})[./](\d{4})\s*(?:günü|tarihinde|tarihli)?\s*(?:saat|saat:)?\s*(\d{1,2})[:.](\d{2})\s*['’]?\s*(?:[a-zçğıöşü]{0,3})\s*(?:bırakıl|ertelen|duruşma)/gi;
  const d2 = /DURUŞMA\s*(?:GÜNÜ|TARİHİ|SAATİ)?\s*[:]\s*(\d{1,2})[./](\d{1,2})[./](\d{4})(?:\s*(?:saat)?\s*(\d{1,2})[:.](\d{2}))?/gi;
  for (const re of [d1, d2]) for (const m of metin.matchAll(re)) { const x = tarihIso(m[1], m[2], m[3], m[4], m[5]); if (x) durusmalar.push(x); }
  const bugun = simdi.toISOString().slice(0, 10);
  const ileri = durusmalar.filter(x => x.slice(0, 10) >= bugun).sort();
  if (ileri.length) o.durusma = ileri[0];
  // Vekâletname.
  if (/VEK[AÂ]LETNAME/i.test(metin)) {
    const v: NonNullable<KunyeOneri["vekalet"]> = {};
    const noter = metin.match(new RegExp(`([${BUYUK}][${BUYUK}a-zçğıöşü]+\\s+\\d{1,3}\\s*\\.?\\s*NOTERL[İI]Ğ[İI])`, "i")) || metin.match(/([A-ZÇĞİÖŞÜa-zçğıöşü]+\s+\d{1,3}\.\s*Noterliği)/);
    if (noter) v.noter = basHarf(noter[1].replace(/\s+/g, " ").replace(/\s\./, "."));
    const yev = metin.match(/YEVM[İI]YE\s*(?:NO|NUMARASI)?\s*[:.]?\s*(\d{1,7})/i);
    if (yev) v.yevmiye = yev[1];
    const tar = metin.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
    if (tar) v.tarih = `${tar[1].padStart(2, "0")}.${tar[2].padStart(2, "0")}.${tar[3]}`;
    const kim = metin.match(/(?:T\.?\s?C\.?\s*(?:Kimlik)?\s*(?:No|Numaralı)?|Kimlik\s*No)\D{0,15}(\d{11})/i);
    if (kim) v.kimlikNo = kim[1];
    if (Object.keys(v).length) o.vekalet = v;
  }
  return o;
}

/** Öneriyi föyün BOŞ alanlarına yazar; neyin dolduğunu da söyler. Müvekkil, föydeki "davacı/davalı vekiliyiz" seçimine göre seçilir. */
export function kunyeyiDoldur(f: Foy, o: KunyeOneri): { ek: Partial<Foy>; dolan: string[] } {
  const ek: Partial<Foy> = {};
  const dolan: string[] = [];
  const bos = (x?: string) => !x || !x.trim();
  const biz = f.taraf === "davali" ? o.ikinci : o.birinci;
  const onlar = f.taraf === "davali" ? o.birinci : o.ikinci;
  if (bos(f.mahkeme) && o.mahkeme) { ek.mahkeme = o.mahkeme; dolan.push("mahkeme"); }
  if (bos(f.esasNo) && o.esasNo) { ek.esasNo = o.esasNo; dolan.push("esas no"); }
  if (bos(f.davaTuru) && o.konu) { ek.davaTuru = o.konu; dolan.push("konu"); }
  if (!f.durusma && o.durusma) { ek.durusma = o.durusma; dolan.push("duruşma"); }
  if (bos(f.muvekkil) && biz?.ad) { ek.muvekkil = biz.ad; dolan.push("müvekkil"); }
  if (bos(f.karsiTaraf) && onlar?.ad) { ek.karsiTaraf = onlar.ad; dolan.push("karşı taraf"); }
  const mb: MuvekkilBilgi = { ...(f.muvekkilBilgi || {}) };
  let mbDegisti = false;
  if (bos(mb.kimlikNo) && (biz?.kimlikNo || o.vekalet?.kimlikNo)) { mb.kimlikNo = biz?.kimlikNo || o.vekalet?.kimlikNo; mbDegisti = true; dolan.push("müvekkil kimlik no"); }
  if (bos(mb.adres) && biz?.adres) { mb.adres = biz.adres; mbDegisti = true; dolan.push("müvekkil adresi"); }
  if (bos(mb.vekaletname) && o.vekalet && (o.vekalet.noter || o.vekalet.yevmiye)) {
    mb.vekaletname = [o.vekalet.noter, o.vekalet.tarih, o.vekalet.yevmiye ? "yevmiye " + o.vekalet.yevmiye : ""].filter(Boolean).join(", ");
    mbDegisti = true; dolan.push("vekâletname");
  }
  if (mbDegisti) ek.muvekkilBilgi = mb;
  const kb: KarsiBilgi = { ...(f.karsiBilgi || {}) };
  let kbDegisti = false;
  if (bos(kb.kimlikNo) && onlar?.kimlikNo) { kb.kimlikNo = onlar.kimlikNo; kbDegisti = true; dolan.push("karşı taraf kimlik no"); }
  if (bos(kb.adres) && onlar?.adres) { kb.adres = onlar.adres; kbDegisti = true; dolan.push("karşı taraf adresi"); }
  if (bos(kb.vekil) && onlar?.vekil) { kb.vekil = onlar.vekil; kbDegisti = true; dolan.push("karşı taraf vekili"); }
  if (kbDegisti) ek.karsiBilgi = kb;
  return { ek, dolan };
}
