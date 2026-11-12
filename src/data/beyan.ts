import { adlarUzun, tumKarsiTaraflar, tumMuvekkiller } from "./foy";
// Beyan editörü: föyden beyan / dilekçe taslağı. Başlık (merci, dosya no, taraflar, vekil, konu) cihazda föyden kurulur;
// gövdeyi yapay zekâ kodlanmış föyden yazar (beyanCagri.ts), avukat düzeltir. Taslaklar föyde saklanır (büroda eşitlenir).
// Çıktı avukatın seçtiği biçimde: UYAP UDF, Word (.docx) ya da PDF (yazdırma penceresinden).
// İçtihat, mevzuat ve doktrin kaynakları (HukukKaynak) beyana eklenir ve kütüphanede (bu cihazda) saklanır.
import { strToU8, zipSync } from "fflate";
import type { Foy } from "./foy";

export interface HukukKaynak {
  id: string;
  tur: "ictihat" | "mevzuat" | "doktrin";
  /** "Yargıtay 9. HD, 2023/1234 E., 2024/567 K., 12.03.2024" ya da "HMK m. 281" ya da "Yazar, Eser, s. 45" */
  kunye: string;
  /** kısa özet / ilgili ilke */
  ozet: string;
  /** kısa alıntı (birkaç cümle) */
  alinti?: string;
  url?: string;
  /** yz: yapay zekâ resmî sitelerde buldu; genel: yapay zekânın genel bilgisi (kaynak gösterilmedi); elle: avukat ekledi */
  kaynak: "yz" | "genel" | "elle";
  tarih: string;
  /** İçtihatta künyenin resmî serviste aranma sonucu: dogru (esas ve karar no birebir tuttu; resmî metin arşivde), yok (bulunamadı). */
  dogrulama?: "dogru" | "yok";
  resmiUrl?: string;
}

export interface Beyan {
  id: string; olusturma: string; guncelleme: string;
  tur: string; konu: string;
  /** gövde (başlık ve imza hariç) */
  metin: string;
  /** beyana eklenen kaynaklar */
  kaynaklar?: HukukKaynak[];
  /** son verilen talimat */
  talimat?: string;
  /** resmî formun alanları (resmiForm.ts): hangi form ve alan değerleri (yalnız cihazda / şifreli eşitlemede) */
  form?: { id: string; alanlar: Record<string, string> };
}

// Beyan klasörü: belge türleri klasörlere ayrılır. Her türün çerçevesi (başlık ve imza biçimi) ayrıdır:
// mahkeme (merciye hitap, dosya no, taraflar), basvuru (kurum ya da komisyona hitap, başvuran), sozlesme (yalnız başlık; taraflar ve
// imzaları gövdede), ihtarname (keşideci / muhatap, noter şerhi), rapor (bilirkişi raporu), serbest (çerçevesiz).
export type Cerceve = "mahkeme" | "basvuru" | "sozlesme" | "ihtarname" | "rapor" | "serbest";
export interface BeyanTuru { ad: string; cerceve: Cerceve; hitap?: string; taraf?: [string, string]; konu?: string; form?: string }
export interface BeyanKlasoru { ad: string; turler: BeyanTuru[] }
const M = (ad: string, konu?: string, hitap?: string): BeyanTuru => ({ ad, cerceve: "mahkeme", konu, hitap });
const B = (ad: string, hitap: string, konu?: string, taraf: [string, string] = ["BAŞVURAN", "KARŞI TARAF"], form?: string): BeyanTuru => ({ ad, cerceve: "basvuru", hitap, konu, taraf, form });
const S = (ad: string): BeyanTuru => ({ ad, cerceve: "sozlesme" });
const I = (ad: string, konu?: string): BeyanTuru => ({ ad, cerceve: "ihtarname", konu });
export const BEYAN_KLASORLERI: BeyanKlasoru[] = [
  { ad: "Dilekçeler", turler: [
    M("Dava dilekçesi", "… istemli dava dilekçesidir."), M("Cevap dilekçesi", "Dava dilekçesine karşı cevaplarımızın sunulmasıdır."),
    M("Cevaba cevap (replik)", "Cevap dilekçesine karşı cevaplarımızın sunulmasıdır."), M("İkinci cevap (düplik)", "Cevaba cevap dilekçesine karşı beyanlarımızın sunulmasıdır."),
    M("Beyan dilekçesi", "Beyanlarımızın sunulmasıdır."), M("Bilirkişi raporuna itiraz", "Bilirkişi raporuna itirazlarımızın sunulmasıdır."),
    M("Delil listesi ve tanık bildirimi", "Delillerimizin ve tanıklarımızın bildirilmesidir."), M("Ara karara karşı beyan", "Ara karara ilişkin beyanlarımızın sunulmasıdır."),
    M("Islah dilekçesi", "Islah talebimizin sunulmasıdır."), M("İhtiyati tedbir talebi", "İhtiyati tedbir kararı verilmesi talebidir."),
    M("İhtiyati haciz talebi", "İhtiyati haciz kararı verilmesi talebidir."), M("Delil tespiti talebi", "Delil tespiti yapılması talebidir."),
    M("Davaya müdahale talebi", "Davaya fer'i müdahil olarak katılma talebidir."), M("Feragat / kabul dilekçesi", "Feragat / kabul beyanımızın sunulmasıdır."),
    M("Mazeret dilekçesi", "Mazeretimizin bildirilmesi ve duruşmanın ertelenmesi talebidir."), M("E-duruşma talebi", "Duruşmaya e-duruşma yoluyla katılma talebimizdir."), M("Duruşmada sözlü beyan notu"),
    M("Yargılamanın yenilenmesi talebi", "Yargılamanın yenilenmesi talebidir.")
  ] },
  { ad: "Kanun yolları", turler: [
    M("İstinaf dilekçesi", "Kararın kaldırılması istemiyle istinaf sebeplerimizin sunulmasıdır."), M("İstinafa cevap", "İstinaf dilekçesine karşı cevaplarımızın sunulmasıdır."),
    M("Temyiz dilekçesi", "Kararın bozulması istemiyle temyiz sebeplerimizin sunulmasıdır."), M("Temyize cevap", "Temyiz dilekçesine karşı cevaplarımızın sunulmasıdır."),
    M("Kanun yararına bozma talebi", "Kanun yararına bozma yoluna başvurulması talebidir.", "ADALET BAKANLIĞI'NA"), M("İtiraz (CMK 268)", "Karara itirazlarımızın sunulmasıdır.")
  ] },
  { ad: "Ceza", turler: [
    { ...M("Şikâyet dilekçesi / suç duyurusu", "Şüpheli hakkında şikâyet ve suç duyurusudur.", "{IL} CUMHURİYET BAŞSAVCILIĞI'NA"), taraf: ["MÜŞTEKİ", "ŞÜPHELİ"] },
    M("Esas hakkında mütalaaya karşı savunma", "Esas hakkındaki mütalaaya karşı savunmamızın sunulmasıdır."),
    M("Tutukluluğa itiraz / tahliye talebi", "Tutukluluğa itiraz ve tahliye talebidir."),
    { ...M("Kovuşturmaya yer olmadığına itiraz", "Kovuşturmaya yer olmadığına dair karara itirazımızdır.", "{IL} SULH CEZA HÂKİMLİĞİ'NE"), taraf: ["İTİRAZ EDEN", "ŞÜPHELİ"] },
    M("Katılma talebi", "Kamu davasına katılma talebimizdir."), M("Savunma dilekçesi", "Savunmamızın sunulmasıdır.")
  ] },
  { ad: "İcra", turler: [
    M("Takip talebi açıklaması", "İcra takibi talebimizdir."), M("Ödeme emrine itiraz", "Ödeme emrine itirazımızdır."), M("İcra mahkemesine şikâyet", "İcra işlemine karşı şikâyetimizdir."),
    M("İtirazın kaldırılması talebi", "Borçlunun itirazının kaldırılması talebidir."), M("Haciz talebi", "Haciz yapılması talebidir."), M("Satış talebi", "Haczedilen malın satışı talebidir."),
    M("Tehiri icra talebi", "İcranın geri bırakılması talebidir."), M("Menfi tespit / istirdat dava dilekçesi", "Borçlu olmadığımızın tespiti / ödenenin iadesi istemidir.")
  ] },
  { ad: "İdari", turler: [
    B("İdareye başvuru (İYUK 10-11)", "… BAKANLIĞI'NA / BAŞKANLIĞI'NA", "İdari işlemin geri alınması / talebimizin karşılanması istemidir."),
    M("İptal davası dilekçesi", "İdari işlemin iptali ve yürütmenin durdurulması istemidir."), M("Tam yargı davası dilekçesi", "İdari eylem / işlemden doğan zararın tazmini istemidir."),
    M("Yürütmenin durdurulması talebi", "Yürütmenin durdurulması talebidir."), B("Bilgi edinme başvurusu", "… BAŞKANLIĞI'NA", "4982 sayılı Kanun uyarınca bilgi edinme başvurusudur.")
  ] },
  { ad: "Arabuluculuk", turler: [
    B("Arabuluculuk başvurusu", "{IL} ADLİYESİ ARABULUCULUK BÜROSU'NA", "Arabuluculuk yoluyla çözülmesi talebidir.", ["BAŞVURAN", "KARŞI TARAF"], "arabuluculuk"),
    { ad: "Arabuluculuk toplantısı notu (talepler ve sınırlar)", cerceve: "serbest" }, S("Arabuluculuk anlaşma belgesi taslağı"),
    { ad: "Son tutanak sonrası dava hazırlık notu", cerceve: "serbest" }
  ] },
  { ad: "Uzlaştırma", turler: [
    B("Uzlaştırma teklifine cevap", "SAYIN UZLAŞTIRMACI", "Uzlaştırma teklifine ilişkin beyanımızdır.", ["MÜŞTEKİ / ŞÜPHELİ", "KARŞI TARAF"]),
    B("Edim teklifi", "SAYIN UZLAŞTIRMACI", "Uzlaşma için edim teklifimizdir.", ["ŞÜPHELİ", "MÜŞTEKİ"]), M("Uzlaşma raporuna itiraz", "Uzlaştırma raporuna itirazlarımızdır.")
  ] },
  { ad: "Komisyon ve kurum başvuruları", turler: [
    B("Sigorta Tahkim Komisyonu başvurusu", "SİGORTA TAHKİM KOMİSYONU BAŞKANLIĞI'NA", "Uyuşmazlığın tahkim yoluyla çözümü istemidir.", ["BAŞVURAN", "SİGORTA KURULUŞU"], "stk"),
    B("İnsan Hakları Tazminat Komisyonu başvurusu", "İNSAN HAKLARI TAZMİNAT KOMİSYONU BAŞKANLIĞI'NA", "Makul sürede yargılanmama / kararın geç icrası nedeniyle tazminat istemidir.", ["BAŞVURAN", "İLGİLİ İDARE"], "ihtk"),
    B("Tüketici hakem heyeti başvurusu", "{IL} TÜKETİCİ HAKEM HEYETİ BAŞKANLIĞI'NA", "Tüketici uyuşmazlığının çözümü istemidir.", ["TÜKETİCİ", "SATICI / SAĞLAYICI"], "thh"),
    B("Kamu Denetçiliği Kurumu şikâyeti", "KAMU DENETÇİLİĞİ KURUMU BAŞKANLIĞI'NA", "İdarenin eylem ve işlemine ilişkin şikâyettir.", ["ŞİKÂYETÇİ", "İLGİLİ İDARE"], "kdk"),
    B("KVKK şikâyeti", "KİŞİSEL VERİLERİ KORUMA KURULU BAŞKANLIĞI'NA", "6698 sayılı Kanun kapsamında şikâyettir.", ["İLGİLİ KİŞİ", "VERİ SORUMLUSU"], "kvkk"),
    B("Baro / disiplin şikâyeti", "… BAROSU BAŞKANLIĞI'NA", "Şikâyetimizin sunulmasıdır.", ["ŞİKÂYETÇİ", "ŞİKÂYET EDİLEN"])
  ] },
  { ad: "Anayasa Mahkemesi", turler: [
    B("Bireysel başvuru (olaylar ve ihlal iddiaları)", "ANAYASA MAHKEMESİ BAŞKANLIĞI'NA", "Anayasa'nın … maddesinde güvence altına alınan hakkın ihlali iddiasıyla bireysel başvurudur.", ["BAŞVURUCU", "İLGİLİ"], "aym"),
    B("Bireysel başvuruda tedbir talebi", "ANAYASA MAHKEMESİ BAŞKANLIĞI'NA", "İçtüzük 73. madde uyarınca tedbir talebidir.", ["BAŞVURUCU", "İLGİLİ"]),
    B("Bakanlık görüşüne karşı beyan", "ANAYASA MAHKEMESİ BAŞKANLIĞI'NA", "Adalet Bakanlığı görüşüne karşı beyanlarımızdır.", ["BAŞVURUCU", "İLGİLİ"])
  ] },
  { ad: "Avrupa İnsan Hakları Mahkemesi", turler: [
    B("AİHM başvurusu (olaylar, ihlaller, iç hukuk yolları)", "AVRUPA İNSAN HAKLARI MAHKEMESİ'NE", "Sözleşme'nin … maddesinin ihlali iddiasıyla başvurudur.", ["BAŞVURUCU", "DAVALI DEVLET (TÜRKİYE)"], "aihm"),
    B("Hükümet görüşüne karşı beyan (observations)", "AVRUPA İNSAN HAKLARI MAHKEMESİ'NE", "Hükümet görüşüne karşı beyanlarımızdır.", ["BAŞVURUCU", "DAVALI DEVLET (TÜRKİYE)"]),
    B("Hakkaniyete uygun tazmin talebi", "AVRUPA İNSAN HAKLARI MAHKEMESİ'NE", "Sözleşme'nin 41. maddesi uyarınca tazmin talebimizdir.", ["BAŞVURUCU", "DAVALI DEVLET (TÜRKİYE)"])
  ] },
  { ad: "Sözleşmeler", turler: [
    S("Avukatlık ücret sözleşmesi"), S("Kira sözleşmesi"), S("Satış sözleşmesi"), S("Hizmet sözleşmesi"), S("İş sözleşmesi"), S("Gizlilik sözleşmesi"),
    S("Sulh ve ibra sözleşmesi"), S("Anlaşmalı boşanma protokolü"), S("Ortaklık / hisse devri sözleşmesi"), S("Protokol (genel)")
  ] },
  { ad: "İhtarname", turler: [
    I("Ödeme ihtarı", "Alacağın ödenmesi ihtarıdır."), I("Kira tahliye / temerrüt ihtarı", "Kira bedelinin ödenmesi ve tahliye ihtarıdır."), I("Fesih bildirimi", "Sözleşmenin feshinin bildirilmesidir."),
    I("Ayıp ihbarı", "Ayıp ihbarıdır."), I("Genel ihtarname")
  ] },
  { ad: "Bilirkişi", turler: [
    { ad: "Bilirkişi raporu", cerceve: "rapor", konu: "Mahkemenizce sorulan hususlar hakkında rapordur." }, { ad: "Bilirkişi ek raporu", cerceve: "rapor", konu: "İtirazlar üzerine ek rapordur." },
    M("Uzman görüşü (taraf bilirkişi mütalaası)", "Uzman görüşümüzün sunulmasıdır.")
  ] },
  { ad: "Serbest", turler: [{ ad: "Serbest beyan", cerceve: "serbest" }, { ad: "Hukuki mütalaa (görüş)", cerceve: "serbest" }, { ad: "Müvekkile bilgilendirme yazısı", cerceve: "serbest" }] }
];
export const BEYAN_TURLERI = BEYAN_KLASORLERI.flatMap(k => k.turler.map(x => x.ad));
const ESKI_AD: Record<string, string> = { "Şikâyet / suç duyurusu": "Şikâyet dilekçesi / suç duyurusu", "İcra takibine itiraz / şikâyet": "Ödeme emrine itiraz", "İdari başvuru / itiraz": "İdareye başvuru (İYUK 10-11)" };
/** Türün tanımı (eski kayıtlardaki adlar da tanınır; bilinmeyen tür mahkeme çerçevesiyle yazılır). */
export function beyanTuru(ad: string): BeyanTuru & { klasor: string } {
  const a = ESKI_AD[ad] || ad;
  for (const k of BEYAN_KLASORLERI) for (const x of k.turler) if (x.ad === a) return { ...x, klasor: k.ad };
  return { ad, cerceve: "mahkeme", klasor: "Dilekçeler" };
}


/** Föy türüne göre tarafların sıfatı: [bizim taraf, karşı taraf]. */
export function tarafAdlari(f: Pick<Foy, "tur" | "taraf">): [string, string] {
  const biz = f.taraf !== "davali";
  switch (f.tur) {
    case "icra": return biz ? ["ALACAKLI", "BORÇLU"] : ["BORÇLU", "ALACAKLI"];
    case "sorusturma": return biz ? ["MÜŞTEKİ", "ŞÜPHELİ"] : ["ŞÜPHELİ", "MÜŞTEKİ"];
    case "ceza": case "ozel_ceza": return biz ? ["KATILAN", "SANIK"] : ["SANIK", "KATILAN"];
    case "idari_dava": return biz ? ["DAVACI", "DAVALI İDARE"] : ["DAVALI İDARE", "DAVACI"];
    case "idari_basvuru": case "kurum_basvuru": case "tazminat_komisyonu": case "bireysel_basvuru": return ["BAŞVURAN", "KARŞI TARAF"];
    default: return biz ? ["DAVACI", "DAVALI"] : ["DAVALI", "DAVACI"];
  }
}

const buyuk = (x: string) => x.toLocaleUpperCase("tr");
/** "İzmir 2. Asliye Hukuk Mahkemesi" → "İZMİR 2. ASLİYE HUKUK MAHKEMESİ'NE" (son ünlüye göre -NE / -NA). */
export function merciyeHitap(merci: string): string {
  const m = merci.trim();
  if (!m) return "… MAHKEMESİ'NE";
  if (/['’](NE|NA|YE|YA)$/i.test(m)) return buyuk(m);
  const unlu = (m.toLocaleLowerCase("tr").match(/[aeıioöuü]/g) || ["e"]).pop()!;
  return buyuk(m) + ("aıou".includes(unlu) ? "'NA" : "'NE");
}

export interface BaslikBilgi { vekil?: string; tarih?: string }

/** Merciden il adı: "İzmir 2. Asliye Hukuk Mahkemesi" → "İZMİR". */
export const merciIli = (merci: string) => { const m = (merci || "").trim().match(/^([A-ZÇĞİÖŞÜ][a-zçğıöşü]+)\s/); return m ? buyuk(m[1]) : "…"; };

/** Beyanın başlığı ve imza bölümü (türün çerçevesine göre); föyden. imza: sağa yaslanacak son satır sayısı. */
export function beyanCercevesi(f: Foy, b: Pick<Beyan, "konu"> & { tur?: string }, k: BaslikBilgi = {}): { ust: string[]; alt: string[]; imza: number; ortaBaslik: boolean } {
  const tr = beyanTuru(b.tur || "Beyan dilekçesi");
  const [biz0, karsi0] = tarafAdlari(f);
  const [biz, karsi] = tr.taraf || [biz0, karsi0];
  const no = f.esasNo ? f.esasNo + (/^(hukuk|ceza|idari_dava|bilirkisi_gorev)$/.test(f.tur || "hukuk") && !/esas|e\.?$/i.test(f.esasNo) ? " Esas" : "") : "";
  const sat = (e: string, d: string) => `${(e + " ").padEnd(16, " ")}: ${d}`;
  const vekil = k.vekil ? "Av. " + k.vekil.replace(/^Av\.?\s*/i, "") : "Av. …";
  const tarih = k.tarih || new Date().toLocaleDateString("tr-TR");
  const sifat = (x: string) => x.split(/\s*\/\s*/)[0].charAt(0) + x.split(/\s*\/\s*/)[0].slice(1).toLocaleLowerCase("tr");
  const hitap = tr.hitap ? tr.hitap.replace("{IL}", merciIli(f.mahkeme)) : merciyeHitap(f.mahkeme);
  const konu = b.konu ? [sat("KONU", b.konu)] : [];
  switch (tr.cerceve) {
    case "sozlesme":
      return { ust: [buyuk(tr.ad.replace(/\s*taslağı$/i, "")), ""], alt: [], imza: 0, ortaBaslik: true };
    case "serbest":
      return { ust: [], alt: [], imza: 0, ortaBaslik: false };
    case "ihtarname":
      return {
        ust: ["İHTARNAME", "", sat("KEŞİDECİ", (adlarUzun(tumMuvekkiller(f)) || "…")), sat("VEKİLİ", vekil), sat("MUHATAP", (adlarUzun(tumKarsiTaraflar(f)) || "…")), ...konu, ""],
        alt: ["", "Sayın Noter; işbu ihtarnamenin bir suretinin muhataba tebliğini, bir suretinin dairenizde saklanmasını ve tebliğ şerhli bir suretinin tarafımıza verilmesini rica ederiz.", "", tarih, "Keşideci Vekili", vekil],
        imza: 3, ortaBaslik: true
      };
    case "rapor":
      return {
        ust: [merciyeHitap(f.mahkeme), "", ...(no ? [sat("DOSYA NO", no)] : []), sat(biz0, (adlarUzun(tumMuvekkiller(f)) || "…")), sat(karsi0, (adlarUzun(tumKarsiTaraflar(f)) || "…")), ...(b.konu ? [sat("RAPOR KONUSU", b.konu)] : []), ""],
        alt: ["", "Bilgilerinize saygıyla sunulur.", tarih, "Bilirkişi", vekil], imza: 3, ortaBaslik: true
      };
    case "basvuru":
      return {
        ust: [hitap, "", ...(no && !/AVRUPA|ANAYASA/.test(hitap) ? [sat("DOSYA NO", no)] : []), sat(biz, (adlarUzun(tumMuvekkiller(f)) || "…")), sat("VEKİLİ", vekil), ...(f.karsiTaraf || /DEVLET/.test(karsi) ? [sat(karsi, /DEVLET/.test(karsi) ? "Türkiye Cumhuriyeti" : f.karsiTaraf)] : []), ...konu, ""],
        alt: ["", "Saygılarımızla.", tarih, `${sifat(biz)} Vekili`, vekil], imza: 4, ortaBaslik: true
      };
    default:
      return {
        ust: [hitap, "", ...(no ? [sat("DOSYA NO", no)] : []), sat(biz, (adlarUzun(tumMuvekkiller(f)) || "…")), sat("VEKİLİ", vekil), sat(karsi, (adlarUzun(tumKarsiTaraflar(f)) || "…")), ...konu, ""],
        alt: ["", "Saygılarımızla.", tarih, `${sifat(biz)} Vekili`, vekil], imza: 4, ortaBaslik: true
      };
  }
}

/** E-duruşma talep dilekçesinin gövdesi (hazır metin; yapay zekâ gerekmez). tarih: "YYYY-AA-GG" ya da "YYYY-AA-GGTSS:DD". */
export function eDurusmaTalebi(tarih: string): Beyan {
  const g = tarih.slice(0, 10).split("-").reverse().join(".");
  const saat = tarih.length > 10 ? " saat " + tarih.slice(11, 16) : "";
  const n = new Date().toISOString();
  return {
    id: "by-e-" + tarih.replace(/\D/g, ""), olusturma: n, guncelleme: n, tur: "E-duruşma talebi",
    konu: `${g} tarihli duruşmaya e-duruşma yoluyla katılma talebimizdir.`,
    metin: [
      "AÇIKLAMALAR",
      `1- Yukarıda numarası yazılı dosyanın ${g}${saat} için belirlenen duruşmasına, 6100 sayılı Hukuk Muhakemeleri Kanunu'nun 149. maddesi ve ilgili mevzuat uyarınca, UYAP Avukat Portal üzerinden e-duruşma (ses ve görüntü nakli) yoluyla katılmak istiyoruz.`,
      "2- E-duruşma için gerekli teknik altyapı tarafımızca sağlanmıştır.",
      "",
      "HUKUKİ NEDENLER : HMK m. 149 ve ilgili mevzuat.",
      "",
      "SONUÇ VE İSTEM",
      `Yukarıda açıklanan nedenlerle, ${g} tarihli duruşmaya e-duruşma yoluyla katılmamıza izin verilmesini saygıyla arz ve talep ederiz.`
    ].join("\n")
  };
}

/** Kaynakların beyana yazılacak atıf satırı. */
export const atif = (x: HukukKaynak) => x.kunye + (x.alinti ? `: "${x.alinti}"` : x.ozet ? ` (${x.ozet})` : "");

export function tamMetin(f: Foy, b: Beyan, k: BaslikBilgi = {}): string {
  const c = beyanCercevesi(f, b, k);
  return [...c.ust, b.metin.trim(), ...c.alt].join("\n");
}
/** Çıktı biçim bilgisi (imza satırı sayısı, ilk satır ortalı mı). */
export const ciktiBicimi = (f: Foy, b: Beyan, k: BaslikBilgi = {}) => { const c = beyanCercevesi(f, b, k); return { imza: c.imza, ortaBaslik: c.ortaBaslik }; };

// ── Çıktılar ──────────────────────────────────────────────────────────────────────────────────────────
const xml = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const BASLIK_SATIRI = /^[A-ZÇĞİÖŞÜ0-9 .,'’()/-]{4,}:?$/;

/** UYAP Doküman Editörü biçimi (UDF): zip içinde content.xml; metin tek CDATA, paragraflar ofsetle biçimlenir.
 *  Hitap satırı ortalı ve kalın, ana başlıklar (AÇIKLAMALAR, SONUÇ VE İSTEM…) kalın, gövde iki yana yaslı, imza sağda. */
export function udfOlustur(metin: string, imzaSatiri = 4, ortaBaslik = true): Uint8Array {
  const satirlar = metin.replace(/\r\n?/g, "\n").split("\n");
  let ofset = 0;
  const paragraflar = satirlar.map((s, i) => {
    const uzunluk = s.length + 1;
    const ilk = i === 0 && ortaBaslik, imza = imzaSatiri > 0 && i >= satirlar.length - imzaSatiri, baslik = BASLIK_SATIRI.test(s.trim()) && s.trim().length < 60;
    const hiza = ilk ? 1 : imza ? 2 : baslik || /^\S.{0,15}\s*:/.test(s) ? 0 : 3;
    const p = `<paragraph Alignment="${hiza}" LeftIndent="0.0" RightIndent="0.0" SpaceAbove="0.0" SpaceBelow="0.0" LineSpacing="0.5"><content family="Times New Roman" size="12"${ilk || baslik ? ' bold="true"' : ""} startOffset="${ofset}" length="${uzunluk}" /></paragraph>`;
    ofset += uzunluk;
    return p;
  });
  const govde = satirlar.join("\n") + "\n";
  const icerik = `<?xml version="1.0" encoding="UTF-8" ?>
<template format_id="1.8">
<content><![CDATA[${govde.replace(/\]\]>/g, "]]]]><![CDATA[>")}]]></content>
<properties><pageFormat mediaSizeName="1" leftMargin="70.875" rightMargin="70.875" topMargin="56.7" bottomMargin="56.7" paperOrientation="1" headerFOffset="20.0" footerFOffset="20.0" /></properties>
<elements resolver="hvl-default">
${paragraflar.join("\n")}
</elements>
<styles><style name="default" description="Geçerli" family="Dialog" size="12" bold="false" italic="false" foreground="-13421773" FONT_ATTRIBUTE_KEY="javax.swing.plaf.FontUIResource[family=Dialog,name=Dialog,style=plain,size=12]" /><style name="hvl-default" family="Times New Roman" size="12" description="Gövde" /></styles>
</template>
`;
  return zipSync({ "content.xml": strToU8(icerik) }, { level: 6 });
}

/** Word (.docx): Times New Roman 12, hitap ortalı kalın, başlıklar kalın, gövde iki yana yaslı, imza sağda. */
export function docxOlustur(metin: string, imzaSatiri = 4, ortaBaslik = true): Uint8Array {
  const satirlar = metin.replace(/\r\n?/g, "\n").split("\n");
  const p = satirlar.map((s, i) => {
    const ilk = i === 0 && ortaBaslik, imza = imzaSatiri > 0 && i >= satirlar.length - imzaSatiri, baslik = BASLIK_SATIRI.test(s.trim()) && s.trim().length < 60;
    const hiza = ilk ? "center" : imza ? "right" : baslik || /^\S.{0,15}\s*:/.test(s) ? "left" : "both";
    const r = s ? `<w:r><w:rPr>${ilk || baslik ? "<w:b/>" : ""}</w:rPr><w:t xml:space="preserve">${xml(s)}</w:t></w:r>` : "";
    return `<w:p><w:pPr><w:jc w:val="${hiza}"/><w:spacing w:after="0" w:line="360" w:lineRule="auto"/></w:pPr>${r}</w:p>`;
  }).join("");
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${p}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1418" w:bottom="1134" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const stil = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="tr-TR"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;
  return zipSync({
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`),
    "word/_rels/document.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "word/document.xml": strToU8(doc),
    "word/styles.xml": strToU8(stil)
  });
}

/** Yazdırma (PDF olarak kaydet) için sade HTML sayfası. */
export function beyanHtml(metin: string, baslik: string, imzaSatiri = 4, ortaBaslik = true): string {
  const satirlar = metin.replace(/\r\n?/g, "\n").split("\n");
  const p = satirlar.map((s, i) => {
    const ilk = i === 0 && ortaBaslik, imza = imzaSatiri > 0 && i >= satirlar.length - imzaSatiri, b = BASLIK_SATIRI.test(s.trim()) && s.trim().length < 60;
    const hiza = ilk ? "center" : imza ? "right" : b || /^\S.{0,15}\s*:/.test(s) ? "left" : "justify";
    return `<p style="text-align:${hiza};${ilk || b ? "font-weight:bold;" : ""}white-space:pre-wrap;margin:0;min-height:1.5em">${xml(s)}</p>`;
  }).join("");
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${xml(baslik)}</title><style>@page{size:A4;margin:2cm 2.5cm}body{font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:1.5;color:#000;background:#fff}</style></head><body>${p}</body></html>`;
}

/** Dosya adı: "2024-1111 Bilirkişi raporuna itiraz 09.11.2026". */
export function beyanDosyaAdi(f: Foy, b: Beyan, uzanti: string): string {
  const ad = [f.esasNo.replace(/[\\/:*?"<>|]/g, "-"), b.tur, new Date(b.guncelleme).toLocaleDateString("tr-TR")].filter(Boolean).join(" ");
  return ad.replace(/\s+/g, " ").trim() + "." + uzanti;
}
