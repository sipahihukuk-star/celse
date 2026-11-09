// Sesli asistan: söylenen cümleden ne istendiği bu cihazda (kurallarla) anlaşılır ve sesli okunacak cevap yazılır.
// Hiçbir şey sunucuya gitmez. Yazan işler (iş ekleme, kapatma) önce sesli onay ister; iş, numara söylenmeden kapanmaz.
import { siradakiIs } from "./davaListesi";
import type { Foy, Gorev, GorevKapanis } from "./foy";
import { FoyTur, turBilgi } from "./foyTurleri";
import { bugunStr, duzeySayilari, isListesi, uyariDuzeyi } from "./isTakibi";

export type Bekleyen =
  | { tip: "ekle"; foyId: string; metin: string; tarih?: string }
  | { tip: "kapatNo"; foyId: string; gorevId: string }
  | { tip: "kapatOnay"; foyId: string; gorevId: string; no: string }
  | { tip: "foySec"; adaylar: string[]; sonra?: "durum" | "ekle"; metin?: string; tarih?: string }
  | { tip: "yeniDava"; adim: "dava" | "muvekkil" | "karsi" | "tarih" | "onay"; v: YeniDava };
/** Henüz açılmamış dava: föy açılır, "Dava aç" işi yapılacaklara yazılır. */
export interface YeniDava { tur: FoyTur; dava?: string; muvekkil?: string; karsi?: string; tarih?: string }
export interface Baglam { foyId?: string; bekleyen?: Bekleyen }
export type Eylem =
  | { tip: "ekle"; foyId: string; gorev: Gorev }
  | { tip: "kapat"; foyId: string; gorevId: string; kapanis: GorevKapanis }
  | { tip: "ac"; foyId: string }
  | { tip: "yeniDava"; foy: { tur: FoyTur; muvekkil: string; karsiTaraf: string; davaTuru: string }; gorev: Gorev }
  | { tip: "isler" }
  | { tip: "yzSor"; foyId: string; soru: string };
export interface Cevap { metin: string; baglam: Baglam; eylem?: Eylem }

const AYLAR = ["ocak", "şubat", "mart", "nisan", "mayıs", "haziran", "temmuz", "ağustos", "eylül", "ekim", "kasım", "aralık"];
const GUNLER = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const SAYI: Record<string, number> = { bir: 1, iki: 2, üç: 3, dört: 4, beş: 5, altı: 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10, onbeş: 15, yirmi: 20, otuz: 30 };

const kucuk = (x: string) => x.toLocaleLowerCase("tr");
const iso = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
const gunEkle = (bugun: string, n: number) => iso(new Date(Date.parse(bugun + "T00:00:00Z") + n * 86400000));
/** "11 Kasım Çarşamba" */
export function tarihSoyle(x: string): string {
  const d = new Date(x.slice(0, 10) + "T00:00:00Z");
  return `${d.getUTCDate()} ${AYLAR[d.getUTCMonth()].replace(/^./, c => c.toLocaleUpperCase("tr"))} ${GUNLER[d.getUTCDay()]}`;
}
const gunSoyle = (n: number) => (n === 0 ? "bugün" : n === 1 ? "yarın" : n === -1 ? "dün" : n > 0 ? `${n} gün sonra` : `${-n} gün önce`);
/** Rakamlar tek tek okunur ki yanlış duyulan numara fark edilsin: "4 0 1 2". */
export const rakamRakam = (no: string) => no.split("").join(" ");

/** Söylenen tarih: bugün, yarın, öbür gün, "3 gün sonra", "2 hafta sonra", "15 Kasım", "15 Kasım 2027", "15.11.2026". */
export function sesliTarih(metin: string, bugun = bugunStr()): { tarih?: string; kalan: string } {
  const m = kucuk(metin);
  const dene = (re: RegExp, f: (x: RegExpMatchArray) => string | undefined) => { const x = m.match(re); if (!x) return; const t = f(x); return t ? { tarih: t, kalan: m.replace(x[0], " ").replace(/\s+/g, " ").trim() } : undefined; };
  const sayi = (x: string) => (/^\d+$/.test(x) ? Number(x) : SAYI[x]);
  return dene(/(?:son gün(?:ü)?\s*)?(\d{1,2})[./](\d{1,2})[./](\d{4})/, x => `${x[3]}-${x[2].padStart(2, "0")}-${x[1].padStart(2, "0")}`)
    || dene(new RegExp(`(?:son gün(?:ü)?\\s*)?(\\d{1,2})\\s+(${AYLAR.join("|")})[a-zçğıöşü']*(?:\\s+(\\d{4}))?`), x => {
      const ay = AYLAR.indexOf(x[2]) + 1;
      let yil = x[3] ? Number(x[3]) : Number(bugun.slice(0, 4));
      let t = `${yil}-${String(ay).padStart(2, "0")}-${x[1].padStart(2, "0")}`;
      if (!x[3] && t < bugun) { yil++; t = `${yil}-${String(ay).padStart(2, "0")}-${x[1].padStart(2, "0")}`; }
      return t;
    })
    || dene(/(?:son gün(?:ü)?\s*)?(\d+|bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on|onbeş|yirmi|otuz)\s+(gün|hafta|ay)\s+(sonra|içinde)/, x => { const n = sayi(x[1]); return n ? gunEkle(bugun, x[2] === "gün" ? n : x[2] === "hafta" ? n * 7 : n * 30) : undefined; })
    || dene(/(?:son gün(?:ü)?\s*)?(öbür gün|yarından sonra)/, () => gunEkle(bugun, 2))
    || dene(/(?:son gün(?:ü)?\s*)?yarın/, () => gunEkle(bugun, 1))
    || dene(/(?:son gün(?:ü)?\s*)?bugün/, () => bugun)
    || { kalan: m };
}

// ── Föy bulma ─────────────────────────────────────────────────────────────────────────────────────────
const DOLGU = new Set(["dosya", "dosyası", "dosyasının", "dosyasına", "dosyasında", "dosyasını", "dosyayı", "föy", "föyü", "föyünü", "durumu", "durum", "nedir", "ne", "nasıl", "var", "mı", "mi", "mu", "sırada", "sıradaki", "iş", "işi", "işini", "ekle", "kapat", "bu", "şu", "bana", "söyle", "anlat", "oku", "aç", "göster", "lütfen", "hangi", "aşamada", "aşaması", "olan", "ile", "ve", "de", "da", "için", "yeni", "görev", "son", "gün", "günü", "esas", "numaralı", "no", "olarak", "kim", "kimin", "dava", "davası", "davasının", "davasına", "mahkemesi", "mahkemesindeki", "hukuk", "asliye", "ceza", "icra", "dairesi", "müdürlüğü"]);
const kelimeler = (x: string) => kucuk(x).replace(/[^\p{L}\d/ ]/gu, " ").split(/\s+/).filter(Boolean);
const tutar = (t: string, w: string) => { const kok = t.slice(0, Math.max(4, t.length - 4)); return w.startsWith(kok) || (w.length >= 4 && t.startsWith(w)); };

export function foyBul(liste: Foy[], soz: string): Foy[] {
  const s = kucuk(soz).replace(/(\d{4})\s*(?:bölü|\/|-)\s*(\d+)/g, "$1/$2");
  const nolar = s.match(/\d{4}\/\d+/g) || [];
  const toks = kelimeler(s).filter(x => !DOLGU.has(x) && !/^\d+$/.test(x) && !x.includes("/") && x.length >= 3);
  const puanli = liste.filter(f => !f.ozel).map(f => {
    let p = 0;
    if (nolar.some(n => f.esasNo.replace(/\s/g, "").toLocaleLowerCase("tr").includes(n))) p += 6;
    const kisi = kelimeler(f.muvekkil + " " + f.karsiTaraf), yer = kelimeler(f.mahkeme + " " + f.davaTuru);
    for (const t of toks) { if (kisi.some(w => tutar(t, w))) p += 3; else if (yer.some(w => tutar(t, w))) p += 1; }
    return { f, p };
  }).filter(x => x.p >= 3).sort((a, b) => b.p - a.p || (a.f.durum === "acik" ? 0 : 1) - (b.f.durum === "acik" ? 0 : 1));
  if (!puanli.length) return [];
  const en = puanli[0].p;
  return puanli.filter(x => x.p === en).map(x => x.f).slice(0, 5);
}
const foyAdi = (f: Foy) => [f.muvekkil || "müvekkil yazılmamış", f.karsiTaraf ? "karşı taraf " + f.karsiTaraf : ""].filter(Boolean).join(", ");
const foyKisa = (f: Foy) => [f.muvekkil || f.karsiTaraf, f.mahkeme, f.esasNo.replace("/", " bölü ")].filter(Boolean).join(", ") || "adsız dosya";

/** Föyün sesli durumu. */
export function foyDurumu(f: Foy, bugun = bugunStr()): string {
  const tb = turBilgi(f.tur);
  const p: string[] = [`${foyAdi(f)}. ${tb.ad}${f.mahkeme ? ", " + f.mahkeme : ""}${f.esasNo ? ", " + f.esasNo.replace("/", " bölü ") : ""}.`];
  if (f.durum === "kapali") p.push("Dosya kapalı.");
  if (f.asama) p.push(`Aşama: ${f.asama}.`);
  if (f.durusma && f.durusma >= bugun) { const g = Math.round((Date.parse(f.durusma) - Date.parse(bugun)) / 86400000); p.push(`Duruşma ${tarihSoyle(f.durusma)}, ${gunSoyle(g)}.`); }
  const acik = f.gorevler.filter(g => !g.bitti);
  if (acik.length) {
    const s = siradakiIs(f);
    p.push(`${acik.length} açık iş var. Sıradaki: ${s.metin}${s.tarih ? ", son gün " + tarihSoyle(s.tarih) : ""}.`);
    const gec = acik.filter(g => uyariDuzeyi(g, f, bugun).duzey === "gecikti").length;
    if (gec) p.push(`Bunlardan ${gec} tanesi gecikti.`);
  } else p.push("Açık iş yok.");
  if (f.degerlendirme?.ozet) p.push("Son değerlendirme: " + f.degerlendirme.ozet.slice(0, 300));
  return p.join(" ");
}

const ozetSoyle = (liste: Foy[], bugun: string, yalniz?: "gecikti") => {
  const n = duzeySayilari(liste, bugun);
  const xs = isListesi(liste, { gorunum: "acik", duzey: yalniz || "acil", tur: "hepsi", ara: "" }, bugun);
  const bas = [n.gecikti ? `${n.gecikti} gecikmiş` : "", n.bugun ? `${n.bugun} son günü bugün olan` : "", n.acil ? `${n.acil} acil` : "", !yalniz && n.uyari ? `${n.uyari} bu hafta biten` : ""].filter(Boolean);
  if (!bas.length) return yalniz ? "Gecikmiş iş yok." : "Gecikmiş ya da acil iş yok. " + (n.dikkat ? `${n.dikkat} işin son günü iki hafta içinde.` : "Önümüzdeki iki haftada son günü olan iş görünmüyor.");
  const ilk = xs.slice(0, 3).map((x, i) => `${i + 1}: ${x.g.metin}, ${x.f.muvekkil || x.f.mahkeme || "adsız dosya"}, ${x.u.metin}`);
  return `${bas.join(", ")} iş var. ${ilk.length ? "İlk " + ilk.length + " iş. " + ilk.join(". ") + "." : ""}${xs.length > 3 ? ` Toplam ${xs.length}; geri kalanı Yapılacaklar ekranında.` : ""}`;
};

const durusmaSoyle = (liste: Foy[], bugun: string, gun: number) => {
  const son = gunEkle(bugun, gun);
  const xs = liste.filter(f => !f.ozel && f.durum === "acik" && f.durusma && f.durusma.slice(0, 10) >= bugun && f.durusma.slice(0, 10) <= son).sort((a, b) => a.durusma!.localeCompare(b.durusma!));
  const ne = gun === 0 ? "bugün" : gun === 1 ? "bugün ve yarın" : `önümüzdeki ${gun} günde`;
  if (!xs.length) return `${ne.replace(/^./, c => c.toLocaleUpperCase("tr"))} duruşma görünmüyor.`;
  return `${ne.replace(/^./, c => c.toLocaleUpperCase("tr"))} ${xs.length} duruşma var. ` + xs.slice(0, 6).map(f => `${tarihSoyle(f.durusma!)}${f.durusma!.length > 10 ? " saat " + f.durusma!.slice(11, 16) : ""}: ${foyKisa(f)}`).join(". ") + (xs.length > 6 ? ". Diğerleri ekranda." : ".");
};

/** Söylenen sözden dosya türü. */
export function turSoz(m: string): FoyTur {
  if (/tazminat komisyon/.test(m)) return "tazminat_komisyonu";
  if (/anayasa|aihm|avrupa insan|bireysel başvuru/.test(m)) return "bireysel_basvuru";
  if (/icra|takip/.test(m)) return "icra";
  if (/suç duyuru|şikâyet|şikayet|soruşturma/.test(m)) return "sorusturma";
  if (/arabulucu/.test(m)) return "arabuluculuk";
  if (/idar[ei]|iptal davası|vergi mahkeme|tam yargı/.test(m)) return "idari_dava";
  if (/ceza davası/.test(m)) return "ceza";
  return "hukuk";
}
/** "boşanma davası", "işe iade davası", "kira alacağı için icra takibi" → konu. */
function davaSoz(m: string): string | undefined {
  const x = m.match(/(?:yeni\s+)?(?:bir\s+)?((?:[a-zçğıöşüâî]+\s+){0,3}(?:davası|takibi|başvurusu|duyurusu|soruşturması))/);
  let d = x?.[1].trim();
  while (d && /^(yeni|bir|dava|dosya|aç|açacağım|açılacak|için|kaydet|kayıt)\s+/.test(d)) d = d.replace(/^\S+\s+/, "");
  return d && !/^(davası|takibi|başvurusu)$/.test(d) ? d : undefined;
}
const buyukHarf = (x: string) => x.trim().split(/\s+/).map(w => (/^([a-zçğıöşü]\.)+$/.test(w) ? w.toLocaleUpperCase("tr") : w.charAt(0).toLocaleUpperCase("tr") + w.slice(1))).join(" ");
const GEC = /^(geç|yok|bilmiyorum|sonra|boş|belli değil|atla)(\s|$)/;

function yeniDavaSor(v: YeniDava, foyId?: string): Cevap {
  const b = (adim: "dava" | "muvekkil" | "karsi" | "tarih" | "onay"): Baglam => ({ foyId, bekleyen: { tip: "yeniDava", adim, v } });
  if (!v.dava) return { metin: "Hangi dava? Örneğin boşanma davası, işe iade davası, icra takibi.", baglam: b("dava") };
  if (v.muvekkil === undefined) return { metin: "Müvekkilin adı ne? Bilmiyorsanız geç deyin.", baglam: b("muvekkil") };
  if (v.karsi === undefined) return { metin: "Karşı taraf kim? Bilmiyorsanız geç deyin.", baglam: b("karsi") };
  if (v.tarih === undefined) return { metin: "Davayı en geç ne zamana kadar açmalısınız? Örneğin 20 Kasım ya da iki hafta sonra. Süre yoksa geç deyin.", baglam: b("tarih") };
  const kim = [v.muvekkil ? "müvekkil " + v.muvekkil : "", v.karsi ? "karşı taraf " + v.karsi : ""].filter(Boolean).join(", ");
  return { metin: `Yeni ${turBilgi(v.tur).ad.toLocaleLowerCase("tr")} föyü açayım: ${v.dava}${kim ? ", " + kim : ""}. Yapılacaklara "Dava aç: ${v.dava}" işini${v.tarih ? ", son gün " + tarihSoyle(v.tarih) + " olarak" : ", son gün olmadan"} yazayım mı?`, baglam: b("onay") };
}

const YARDIM = "Şunları sorabilirsiniz: bugün ne var; gecikmiş işler; bu hafta duruşmalar; bir dosyanın durumu, örneğin Yılmaz dosyası ne durumda; iş eklemek için: Yılmaz dosyasına iş ekle, bilirkişi raporuna itiraz, son gün 15 Kasım; iş kapatmak için: bilirkişi işini kapat, numara 4 0 1 2; yeni dava kaydetmek için: yeni dava aç, boşanma davası; dosyayı yapay zekâya sormak için: Yılmaz dosyası için yapay zekâya sor, sırada ne var; tüm işleri oku; ve dosyayı aç.";
const EVET = /^(evet|onaylıyorum|onayla|tamam|olur|doğru|aynen|ekle|kapat)(\s|$|[,.!])/;
const HAYIR = /^(hayır|iptal|vazgeç|vazgeçtim|yanlış|dur)(\s|$|[,.!])/;
const SIRA: Record<string, number> = { birinci: 0, ilk: 0, "1": 0, ikinci: 1, "2": 1, üçüncü: 2, "3": 2, dördüncü: 3, "4": 3, beşinci: 4, "5": 4 };

/** İş emri numarası: "numara 4 0 1 2", "evrak no IE 2026 871". Boşluklu rakamlar birleştirilir. */
export function soylenenNo(metin: string): string | undefined {
  const m = kucuk(metin);
  const x = m.match(/(?:iş emri|evrak|makbuz|barkod|belge)?\s*(?:numarası|numara|no)\s*:?\s*([a-zçğıöşü]{0,3}[\d\s\-/]{3,})/) || m.match(/^\s*([a-zçğıöşü]{0,3}\s?[\d][\d\s\-/]{2,})\s*$/);
  if (!x) return;
  const no = x[1].replace(/\s+/g, "").replace(/-+$/, "").toLocaleUpperCase("tr");
  return no.replace(/\D/g, "").length >= 3 ? no : undefined;
}

function isBul(f: Foy, soz: string): Gorev[] {
  const acik = f.gorevler.filter(g => !g.bitti);
  const toks = kelimeler(soz).filter(x => !DOLGU.has(x) && x.length >= 3 && !/^\d+$/.test(x) && !["numara", "numarası", "numarayla", "tamamlandı", "bitti", "yapıldı"].includes(x));
  const p = acik.map(g => ({ g, p: toks.filter(t => kelimeler(g.metin).some(w => tutar(t, w))).length })).filter(x => x.p > 0).sort((a, b) => b.p - a.p);
  if (p.length) return p.filter(x => x.p === p[0].p).map(x => x.g);
  return acik.length === 1 ? acik : [];
}

/** Söyleneni işler. */
export function sesliKomut(soz: string, liste: Foy[], b: Baglam, bugun = bugunStr()): Cevap {
  const m = kucuk(soz).trim().replace(/[.!?]+$/, "");
  const byId = new Map(liste.map(f => [f.id, f] as const));
  const bag = b.foyId ? byId.get(b.foyId) : undefined;
  const cevap = (metin: string, baglam: Baglam = { foyId: b.foyId }, eylem?: Eylem): Cevap => ({ metin, baglam, eylem });

  // Bekleyen soru varsa önce o cevaplanır.
  const bk = b.bekleyen;
  if (bk && HAYIR.test(m)) return cevap("Tamam, vazgeçtim.");
  if (bk?.tip === "ekle" && EVET.test(m)) {
    const g: Gorev = { id: "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), metin: bk.metin, tarih: bk.tarih, bitti: false, kaynak: "elle", eklenme: bugun };
    return cevap(`Eklendi: ${bk.metin}.`, { foyId: bk.foyId }, { tip: "ekle", foyId: bk.foyId, gorev: g });
  }
  if (bk?.tip === "kapatOnay" && EVET.test(m)) {
    const g = byId.get(bk.foyId)?.gorevler.find(x => x.id === bk.gorevId);
    return cevap(`Kapatıldı: ${g?.metin || "iş"}, numara ${rakamRakam(bk.no)}.`, { foyId: bk.foyId }, { tip: "kapat", foyId: bk.foyId, gorevId: bk.gorevId, kapanis: { tarih: bugun, no: bk.no, kaynak: "elle" } });
  }
  if (bk?.tip === "kapatNo") {
    const no = soylenenNo(m) || soylenenNo("numara " + m);
    if (no) return cevap(`Numara ${rakamRakam(no)}. Doğru mu? Evet derseniz kapatırım.`, { foyId: bk.foyId, bekleyen: { tip: "kapatOnay", foyId: bk.foyId, gorevId: bk.gorevId, no } });
    return cevap("Numarayı anlayamadım. Rakamları tek tek söyleyin ya da vazgeç deyin.", b);
  }
  if (bk?.tip === "yeniDava") {
    const v = { ...bk.v };
    const ham = soz.trim().replace(/[.!?]+$/, "");
    const gec = GEC.test(m);
    if (bk.adim === "onay") {
      if (!EVET.test(m)) return cevap("Evet ya da vazgeç deyin.", b);
      const g: Gorev = { id: "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), metin: "Dava aç: " + v.dava, tarih: v.tarih || undefined, bitti: false, kaynak: "elle", eklenme: bugun };
      return cevap(`Föy açıldı ve "Dava aç: ${v.dava}" yapılacaklara yazıldı.`, {}, { tip: "yeniDava", foy: { tur: v.tur, muvekkil: v.muvekkil || "", karsiTaraf: v.karsi || "", davaTuru: v.dava || "" }, gorev: g });
    }
    if (bk.adim === "dava") { if (gec) v.dava = "dava"; else { v.dava = davaSoz(m) || ham; v.tur = turSoz(m); } }
    if (bk.adim === "muvekkil") v.muvekkil = gec ? "" : buyukHarf(ham.replace(/^(müvekkil(im)?|adı)\s+/i, ""));
    if (bk.adim === "karsi") v.karsi = gec ? "" : buyukHarf(ham.replace(/^(karşı taraf)\s+/i, ""));
    if (bk.adim === "tarih") { if (gec) v.tarih = ""; else { const t = sesliTarih(m, bugun).tarih; if (!t) return cevap("Tarihi anlayamadım. Örneğin 20 Kasım, yarın ya da iki hafta sonra deyin; süre yoksa geç deyin.", b); v.tarih = t; } }
    return yeniDavaSor(v, b.foyId);
  }
  if (bk?.tip === "foySec") {
    const k = Object.keys(SIRA).find(x => new RegExp(`(^|\\s)${x}(\\s|$)`).test(m));
    const f = k !== undefined ? byId.get(bk.adaylar[SIRA[k]]) : undefined;
    if (f) {
      if (bk.sonra === "ekle" && bk.metin) return ekleSor(f, bk.metin, bk.tarih);
      return cevap(foyDurumu(f, bugun), { foyId: f.id });
    }
  }

  if (/^(yardım|neler yapabilirsin|ne sorabilirim|komutlar)/.test(m)) return cevap(YARDIM);

  // Yapay zekâya sor: "Yılmaz dosyası için yapay zekâya sor, itiraz süresi ne zaman doluyor" / "bu dosyayı yapay zekâya sor".
  const yz = m.match(/^(.*?)\s*(?:için\s+|hakkında\s+)?yapay\s*zek[âa]ya\s+sor(?:ar mısın)?\s*[:,]?\s*(.*)$/);
  if (yz) {
    const once = yz[1].trim(), soru = yz[2].trim() || "Bu dosya ne durumda, nerede kaldık, sırada ne var, mevzuata göre hangi yollar açık?";
    const ad = once ? foyBul(liste, once) : [];
    const f = ad.length === 1 ? ad[0] : !once || /bu dosya/.test(once) ? bag : undefined;
    if (!f && ad.length > 1) return secSor(ad, "durum");
    if (!f) return cevap("Hangi dosya için sorayım? Örneğin: Yılmaz dosyası için yapay zekâya sor, itiraz süresi ne zaman doluyor.");
    return cevap(`${foyKisa(f)} dosyasını yapay zekâya soruyorum; yarım dakika kadar sürebilir.`, { foyId: f.id }, { tip: "yzSor", foyId: f.id, soru });
  }
  if (/yapılacaklar(ı)?\s+(ekranını\s+)?(aç|göster)/.test(m)) return cevap("Yapılacaklar açılıyor.", { foyId: b.foyId }, { tip: "isler" });

  // Yeni dava (henüz açılmamış): föy açılır, "Dava aç" işi yapılacaklara yazılır. Eksik bilgiler tek tek sorulur.
  if (/yeni\s+(\S+\s+){0,2}(dava|dosya|takib|takip|başvuru|duyuru|föy)/.test(m) || /dava\s+açaca(ğım|z)|dava\s+açılacak/.test(m)) {
    const { tarih, kalan } = sesliTarih(m, bugun);
    return yeniDavaSor({ tur: turSoz(kalan), dava: davaSoz(kalan), tarih }, b.foyId);
  }
  // Bütün açık işler
  if (/(tüm|bütün)\s+işle|işleri\s+(oku|listele|say)|yapılacakları\s+oku/.test(m)) {
    const xs = isListesi(liste, { gorunum: "acik", duzey: "hepsi", tur: "hepsi", ara: "" }, bugun);
    if (!xs.length) return cevap("Açık iş yok.");
    return cevap(`${xs.length} açık iş var. ` + xs.slice(0, 10).map((x, i) => `${i + 1}: ${x.g.metin}, ${x.f.muvekkil || x.f.mahkeme || "adsız dosya"}, ${x.u.metin}`).join(". ") + (xs.length > 10 ? ". Geri kalanı Yapılacaklar ekranında." : "."));
  }

  // İş ekle
  if (/(iş|görev|yapılacak)\s+ekle|hatırlat|not al/.test(m)) {
    const { tarih, kalan } = sesliTarih(m, bugun);
    const [once, sonra = ""] = kalan.split(/\s*(?:iş|görev|yapılacak)\s+ekle\s*:?\s*|\s*hatırlat\s*:?\s*|\s*not al\s*:?\s*/);
    const metin = sonra.replace(/\s*(son gün(ü)?|kadar)\s*$/, "").trim();
    if (!metin) return cevap("Hangi işi ekleyeyim? Örneğin: Yılmaz dosyasına iş ekle, bilirkişi raporuna itiraz, son gün 15 Kasım.");
    const adaylar = once.trim() ? foyBul(liste, once) : [];
    const f = adaylar.length === 1 ? adaylar[0] : !once.trim() || /bu dosya/.test(once) ? bag : undefined;
    if (!f && adaylar.length > 1) return secSor(adaylar, "ekle", metin, tarih);
    if (!f) return cevap("Hangi dosyaya ekleyeyim? Müvekkilin adını ya da dosya numarasını söyleyin, örneğin: Yılmaz dosyasına iş ekle, ...");
    return ekleSor(f, metin, tarih);
  }

  // İş kapat
  if (/(kapat|tamamlandı|bitti|yapıldı)/.test(m) && !/dosya(yı)?\s+kapat/.test(m)) {
    const no = soylenenNo(m);
    const adaylar = foyBul(liste, m.split(/numara|no\b/)[0]);
    const foylar = adaylar.length ? adaylar : bag ? [bag] : liste.filter(f => !f.ozel);
    const isler = foylar.flatMap(f => isBul(f, m.split(/numara|no\b/)[0]).map(g => ({ f, g })));
    if (!isler.length) return cevap("Hangi işi kapatacağımı bulamadım. İşin adından bir kelime ve dosyayı söyleyin, örneğin: Yılmaz dosyasında bilirkişi işini kapat.");
    if (isler.length > 1) return cevap(`${isler.length} iş buldum: ${isler.slice(0, 3).map(x => x.g.metin + ", " + (x.f.muvekkil || x.f.mahkeme)).join("; ")}. Hangisi? Dosyayı da söyleyin.`);
    const { f, g } = isler[0];
    if (!no) return cevap(`${g.metin} işi, ${foyKisa(f)}. Bu iş numara olmadan kapanmaz. İş emri ya da evrak numarasını söyleyin.`, { foyId: f.id, bekleyen: { tip: "kapatNo", foyId: f.id, gorevId: g.id } });
    return cevap(`${g.metin} işini ${rakamRakam(no)} numarasıyla kapatıyorum. Doğru mu?`, { foyId: f.id, bekleyen: { tip: "kapatOnay", foyId: f.id, gorevId: g.id, no } });
  }

  if (/gecik/.test(m)) return cevap(ozetSoyle(liste, bugun, "gecikti"));
  if (/duruşma/.test(m) && !foyBul(liste, m.replace(/duruşma\S*/g, "")).length) {
    const gun = /bugün/.test(m) ? 0 : /yarın/.test(m) ? 1 : /bu hafta|haftaya/.test(m) ? 7 : /bu ay/.test(m) ? 30 : 14;
    return cevap(durusmaSoyle(liste, bugun, gun));
  }
  if (/(bugün|ne var|yapılacak|işlerim|neler|acil|özet)/.test(m) && !foyBul(liste, m).length) return cevap(ozetSoyle(liste, bugun));

  // Dosyayı aç
  if (/(^|\s)(aç|göster)(\s|$)/.test(m)) {
    const ad = foyBul(liste, m);
    const f = ad.length === 1 ? ad[0] : !ad.length ? bag : undefined;
    if (f) return cevap(`${foyKisa(f)} açılıyor.`, { foyId: f.id }, { tip: "ac", foyId: f.id });
    if (ad.length > 1) return secSor(ad, "durum");
  }
  if (/sırada(ki)?\s+(ne|iş)|ne durumda|durumu/.test(m) && bag && !foyBul(liste, m).length) return cevap(foyDurumu(bag, bugun), { foyId: bag.id });

  const ad = foyBul(liste, m);
  if (ad.length === 1) return cevap(foyDurumu(ad[0], bugun), { foyId: ad[0].id });
  if (ad.length > 1) return secSor(ad, "durum");
  return cevap("Anlayamadım. Yardım derseniz neler sorabileceğinizi söylerim.", { foyId: b.foyId });

  function ekleSor(f: Foy, metin: string, tarih?: string): Cevap {
    return cevap(`${foyKisa(f)} dosyasına "${metin}" işini${tarih ? ", son gün " + tarihSoyle(tarih) + " olarak" : ", son gün olmadan"} ekleyeyim mi?`, { foyId: f.id, bekleyen: { tip: "ekle", foyId: f.id, metin, tarih } });
  }
  function secSor(xs: Foy[], sonra: "durum" | "ekle", metin?: string, tarih?: string): Cevap {
    const s = xs.slice(0, 5);
    return cevap(`${xs.length} dosya buldum. ${s.map((f, i) => `${["Birinci", "İkinci", "Üçüncü", "Dördüncü", "Beşinci"][i]}: ${foyKisa(f)}`).join(". ")}. Hangisi?`, { foyId: b.foyId, bekleyen: { tip: "foySec", adaylar: s.map(f => f.id), sonra, metin, tarih } });
  }
}
