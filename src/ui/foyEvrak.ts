// Föy evrakının işlenmesi: dosya cihazda okunur (taranmışsa yazısı da burada çıkarılır), türü ve önemi belirlenir,
// evrak TEK BAŞINA kodlanır (her evrakın kendi kod listesi cihazda kalır) ve asıl dosya bu cihazda saklanır.
// "Dosya ne durumda?" için önemli evraktan, sınıra sığacak kadar seçilip birlikte kodlanan metin hazırlanır.
import { konuCikar } from "../data/evrakBaslik";
import { dosyaYaz, Foy, FoyEvrak, yeniId } from "../data/foy";
import { evrakSinifla, turBilgi } from "../data/foyTurleri";
import { kunyeCikar } from "../data/kunyeCikar";
import { hareketEkle } from "../data/evrakHareket";
import { mask } from "../engine/mask";
import { DOGRUDAN_SINIR } from "../engine/mask/derleme";
import { evrakMetni, evrakTanisi, gercekTur } from "../engine/mask/readers";

export type Kaynak = { ad: string; bytes: Uint8Array; blob?: Blob; yol?: string };

/** Föyün bilinen adları her evrakta mutlaka kodlansın. */
// Müvekkil ve karşı taraf adı; şirketlerde unvan eki olmadan geçen kısa adı da (ör. "Örnek Sigorta A.Ş." → "Örnek Sigorta") kodlanır.
const SIRKET_EKI = /\s+(A\.?\s?Ş\.?|ANONİM ŞİRKETİ|Anonim Şirketi|LTD\.?\s?ŞTİ\.?|Ltd\.?\s?Şti\.?|LİMİTED ŞİRKETİ|Limited Şirketi|ve Tic\.?.*|VE TİC\.?.*|San\.?\s?ve\s?Tic\.?.*)$/;
export const ekAdlar = (f: Foy) => {
  const xs = [f.muvekkil, f.karsiTaraf].map(x => (x || "").trim()).filter(x => x.length > 2);
  for (const x of [...xs]) { const k = x.replace(SIRKET_EKI, "").trim(); if (k !== x && k.length > 4) xs.push(k); }
  return xs;
};

/** Evrakın türünü, önemini ve kodlu hâlini (yeniden) hesaplar. Avukatın elle seçtiği tür ve önem korunur. */
export function evrakHazirla(f: Foy, e: FoyEvrak, yeniden = false): FoyEvrak {
  const s = evrakSinifla(e.ad, e.metin);
  const m = e.metin.trim() ? mask(e.metin, { extra: ekAdlar(f) }) : null;
  // Evrakın kendi tarihi (karar, tutanak, dilekçe): föyde kronolojik sıra için.
  const tarih = e.tarih || (e.metin.trim() ? kunyeCikar(e.metin.slice(0, 20000)).belgeTarihi : undefined);
  const tur = yeniden || !e.tur ? s.tur : e.tur;
  return { ...e, tur, onemli: yeniden || e.onemli === undefined ? s.onemli : e.onemli, maskeli: m?.masked, kodlar: m?.map, tarih, konu: yeniden || e.konu === undefined ? konuCikar(e.metin, tur) : e.konu };
}

/** Dosyanın yazısını cihazda çıkarır (taranmış PDF, TIF ve fotoğraf için yazı tanıma dahil). */
export async function evrakMetniOku(k: Kaynak, ilerle: (m: string) => void): Promise<{ metin: string; okunamadi?: string } | { hata: string }> {
  // Tür uzantıdan değil içerikten bulunur (uzantısı yanlış ya da eksik dosyalar da okunsun).
  const tur = gercekTur(k.ad, k.bytes);
  const tani = () => { try { return " [" + evrakTanisi(k.ad, k.bytes) + "]"; } catch { return ""; } };
  if (!k.bytes.length) return { metin: "", okunamadi: "dosya boş (0 bayt) ya da bu bilgisayarda açılamadı" };
  if (!tur || tur === "zip") return { metin: "", okunamadi: "bu dosya türü okunamıyor" + tani() };
  try {
    let metin: string;
    if (tur === "pdf" || tur === "tif" || tur === "resim") {
      const oku = await import("./evrakOku");
      metin = tur === "pdf" ? await oku.pdfMetni(k.bytes, ilerle) : tur === "tif" ? await oku.tifMetni(k.bytes, ilerle) : await oku.resimMetni(k.bytes, k.ad, ilerle);
    } else {
      ilerle("okunuyor");
      metin = evrakMetni(k.ad, k.bytes);
    }
    if (!metin.trim()) return { metin: "", okunamadi: (tur === "pdf" || tur === "tif" || tur === "resim" ? "yazı tanıma sayfada yazı bulamadı (görüntü çok soluk ya da boş olabilir)" : "dosyada yazı yok") + tani() };
    return { metin };
  } catch (e) { return { metin: "", okunamadi: String((e as Error).message || e) + tani() }; }
}

/** Okunmuş dosyayı föyün evrakı yapar: tür, önem, kodlama; asıl dosya cihazda saklanır (özel föyde şifreli). */
export async function evrakOlustur(f: Foy, k: Kaynak, okunan: { metin: string; okunamadi?: string }, anahtar?: string): Promise<FoyEvrak> {
  const e = evrakHazirla(f, { id: yeniId("ev"), ad: k.ad, boyut: k.bytes.length, eklenme: new Date().toISOString(), metin: okunan.metin, okunamadi: okunan.okunamadi, kaynak: k.yol });
  try { await dosyaYaz(e.id, k.blob || new Blob([k.bytes as BlobPart]), !!f.ozel); } catch { /* asıl dosya saklanamazsa metin yine durur */ }
  // Evrak hareketleri: gelen evrak hangi föye girdi (okunamadıysa da föyde durur; yazısı yoktur).
  hareketEkle({ yon: "gelen", ad: k.ad, sonuc: "foy", kaynak: anahtar ? "Evrak klasörü: " + (k.yol || k.ad) : k.yol || "Yükleme", foyId: f.id, foyAd: foyKisaAd(f),
    not: okunan.okunamadi ? "yazısı okunamadı: " + okunan.okunamadi : undefined, anahtar }).catch(() => {});
  return e;
}
/** Hareket kaydında föyün kısa adı: TÜR · merci · numara · müvekkil. */
export const foyKisaAd = (f: Foy) => [turBilgi(f.tur).kisa, f.mahkeme, f.esasNo, f.muvekkil || f.karsiTaraf].filter(Boolean).join(" · ");

/** Dosyayı okur ve föyün evrakı yapar. */
export async function evrakOkuVeHazirla(f: Foy, k: Kaynak, ilerle: (m: string) => void): Promise<FoyEvrak | { hata: string }> {
  const o = await evrakMetniOku(k, ilerle);
  return "hata" in o ? o : evrakOlustur(f, k, o);
}

// Durum sorusunda önce bunlar okunur.
const ONCELIK = ["Gerekçeli karar", "Karar", "Bilirkişi raporu", "Ara karar", "Duruşma tutanağı", "İddianame", "Kovuşturmaya yer olmadığı kararı",
  "Arabuluculuk tutanağı", "İstinaf / temyiz dilekçesi", "Ödeme emri", "Dava dilekçesi", "Cevap dilekçesi", "Savunma", "İfade / sorgu tutanağı", "Dilekçe", "Diğer"];

/** Önemli evraktan, kodlandıktan sonra sınıra sığacak kadarını seçer (öncelikli türler ve en yeniler önce). */
export function durumKaynagi(f: Foy): { metin: string; map: Record<string, string>; kullanilan: FoyEvrak[]; disarida: FoyEvrak[] } {
  const onemli = f.evraklar.filter(e => e.onemli !== false && e.metin.trim());
  const sira = [...onemli].sort((a, b) => {
    const pa = ONCELIK.indexOf(a.tur || "Diğer"), pb = ONCELIK.indexOf(b.tur || "Diğer");
    return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb) || b.eklenme.localeCompare(a.eklenme);
  });
  const secilen: FoyEvrak[] = [];
  let toplam = 0;
  for (const e of sira) {
    const n = e.metin.length + 80;
    if (toplam + n > DOGRUDAN_SINIR * 0.92) continue;
    secilen.push(e); toplam += n;
  }
  // Belgeler tarih sırasıyla birleştirilir; hepsi birlikte kodlanır ki aynı kişi her belgede aynı kodla görünsün.
  secilen.sort((a, b) => a.eklenme.localeCompare(b.eklenme));
  const ham = secilen.map((e, i) => `=== Evrak ${i + 1} · ${e.tur || "Diğer"}: ${e.ad.replace(/\.[^.]+$/, "")} ===\n${e.metin}`).join("\n\n");
  const m = mask(ham, { extra: ekAdlar(f) });
  return { metin: m.masked, map: m.map, kullanilan: secilen, disarida: sira.filter(e => !secilen.includes(e)) };
}

/** "Yapay zekâya sor" için dosyanın kodlanmış hâli: künye, işler, notlar, son değerlendirme, önceki sorular, soru ve önemli
 *  evrak (en çok ~60.000 harf) tek seferde kodlanır; aynı kişi her yerde aynı kodla görünür. Dönen cevap map ile açılır. */
export function foySoruKaynagi(f: Foy, soru: string, gecmis: { soru: string; cevap: string }[], tur: string, sinir = 60000):
  { dosya: string; soru: string; gecmis: { soru: string; cevap: string }[]; map: Record<string, string>; evrakSay: number } {
  // YYYY-AA-GG: kodlama gg.aa.yyyy tarihlerini aya indirir; süre hesabı için gün gerekir.
  const tr = (x?: string) => (x ? x.slice(0, 10) : "");
  const kunye = [
    "=== KÜNYE ===",
    "Dosya türü: " + tur + (f.davaTuru ? " · " + f.davaTuru : ""),
    "Bizim taraf: " + (f.taraf === "davali" ? "davalı / sanık / borçlu tarafı" : "davacı / başvuran / alacaklı tarafı"),
    "Merci: " + (f.mahkeme || "yazılmamış") + (f.esasNo ? " · dosya no " + f.esasNo : ""),
    "Müvekkil: " + (f.muvekkil || "yazılmamış") + (f.karsiTaraf ? " · karşı taraf: " + f.karsiTaraf : ""),
    "Açılış: " + (tr(f.acilis) || "yazılmamış") + " · aşama: " + (f.asama || "yazılmamış") + " · durum: " + (f.durum === "kapali" ? "kapalı" + (f.kapanis ? " (" + tr(f.kapanis) + ")" : "") : "açık"),
    f.durusma ? "Sıradaki duruşma: " + tr(f.durusma) + (f.durusma.length > 10 ? " " + f.durusma.slice(11, 16) : "") : "",
    "=== YAPILACAK İŞLER ===",
    ...(f.gorevler.length ? f.gorevler.slice(-30).map(g => "- " + g.metin + (g.tarih ? " (son gün " + tr(g.tarih) + ")" : "") + (g.bitti ? " [tamamlandı" + (g.kapanis ? " " + tr(g.kapanis.tarih) : "") + "]" : " [açık]")) : ["(iş yok)"]),
    f.notlar.trim() ? "=== AVUKATIN NOTLARI ===\n" + f.notlar.trim().slice(0, 3000) : "",
    f.degerlendirme?.ozet ? "=== SON DEĞERLENDİRME (" + tr(f.degerlendirme.tarih) + ") ===\n" + f.degerlendirme.ozet + (f.degerlendirme.sureler.length ? "\nSüreler: " + f.degerlendirme.sureler.join("; ") : "") : "",
    "=== EVRAK LİSTESİ ===",
    ...(f.evraklar.length ? [...f.evraklar].sort((a, b) => (a.tarih || a.eklenme).localeCompare(b.tarih || b.eklenme)).slice(-60).map(e => "- " + (e.tur || "Evrak") + (e.konu ? ": " + e.konu : "") + " · " + tr(e.tarih || e.eklenme)) : ["(evrak yok)"])
  ].filter(Boolean).join("\n");
  const onemli = f.evraklar.filter(e => e.onemli !== false && e.metin.trim())
    .sort((a, b) => { const pa = ONCELIK.indexOf(a.tur || "Diğer"), pb = ONCELIK.indexOf(b.tur || "Diğer"); return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb) || b.eklenme.localeCompare(a.eklenme); });
  const secilen: FoyEvrak[] = [];
  let toplam = 0;
  for (const e of onemli) { const n = Math.min(e.metin.length, 20000) + 80; if (toplam + n > sinir) continue; secilen.push(e); toplam += n; }
  secilen.sort((a, b) => (a.tarih || a.eklenme).localeCompare(b.tarih || b.eklenme));
  const evrak = secilen.map((e, i) => "=== Evrak " + (i + 1) + " · " + (e.tur || "Diğer") + " · " + tr(e.tarih || e.eklenme) + " ===\n" + e.metin.slice(0, 20000)).join("\n\n");
  const AYRAC = "\n\u241E\u241E\n";
  const parcalar = [kunye + (evrak ? "\n\n=== ÖNEMLİ EVRAKIN METNİ ===\n" + evrak : ""), soru, ...gecmis.flatMap(x => [x.soru, x.cevap])];
  const m = mask(parcalar.join(AYRAC), { extra: ekAdlar(f) });
  const k = m.masked.split(AYRAC.trim()).map(x => x.trim());
  const gk: { soru: string; cevap: string }[] = [];
  for (let i = 2; i + 1 < k.length; i += 2) gk.push({ soru: k[i], cevap: k[i + 1] });
  return { dosya: k[0], soru: k[1] || soru, gecmis: gk, map: m.map, evrakSay: secilen.length };
}
