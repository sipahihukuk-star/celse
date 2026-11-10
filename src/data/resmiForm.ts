// Resmî formlar. Üç çeşit:
//  - docx: kurumun kendi Word formu (Tazminat Komisyonu başvuru dilekçeleri) olduğu gibi alınır, alanları doldurulur.
//  - cevrimici: başvuru kurumun kendi sitesine yazılır (Sigorta Tahkim Komisyonu online başvuru, AYM e-başvuru). Celse her alanın
//    içeriğini sitedeki sırayla hazırlar; avukat "Kopyala" ile alan alan yapıştırır. Yazdırılabilir bir nüsha da çıkar.
// Alanlar föyden (taraflar, merci, numara, tarihler, müvekkil bilgileri) ve vekil bilgilerinden önceden dolar; açıklama alanı
// beyan editöründe yazılan metindir. Değerler yalnız cihazda kalır (beyanla birlikte şifreli eşitlenir), yapay zekâya gitmez.
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { Beyan } from "./beyan";
import type { Foy } from "./foy";

export interface FormAlani { k: string; etiket: string; bolum?: string; cok?: boolean; ipucu?: string; secenek?: string[] }
export interface ResmiForm {
  id: string; ad: string; kisa: string;
  /** hangi beyan türlerinde önerilir */
  turler: string[];
  tip: "docx" | "cevrimici";
  /** docx için şablon (public/formlar) */
  dosya?: string;
  /** çevrimiçi başvuru adresi */
  site?: string;
  aciklama: string;
  alanlar: FormAlani[];
}
export interface VekilKunye { ad?: string; tc?: string; baro?: string; baroNo?: string; tbbNo?: string; adres?: string; telefon?: string; eposta?: string }

const TAZMINAT = "İnsan Hakları Tazminat Komisyonu başvurusu";
const BASVURUCU: FormAlani[] = [
  { k: "basvurucuSayisi", etiket: "Başvurucu sayısı", bolum: "Genel bilgiler" },
  { k: "basvuruTarihi", etiket: "Başvuru tarihi", bolum: "Genel bilgiler" },
  { k: "adSoyad", etiket: "Adı soyadı", bolum: "Müracaat eden" },
  { k: "tc", etiket: "T.C. kimlik numarası", bolum: "Müracaat eden" },
  { k: "dogum", etiket: "Doğum yeri ve tarihi", bolum: "Müracaat eden" },
  { k: "adres", etiket: "Yazışma adresi", bolum: "Müracaat eden" },
  { k: "telefon", etiket: "Telefon", bolum: "Müracaat eden" },
  { k: "vekilAd", etiket: "Vekilin adı soyadı", bolum: "Vekil" },
  { k: "vekilAdres", etiket: "Vekilin yazışma adresi", bolum: "Vekil" },
  { k: "vekilBaro", etiket: "Baro ve baro sicil no", bolum: "Vekil" },
  { k: "vekilTelefon", etiket: "Vekilin telefonu", bolum: "Vekil" },
  { k: "vekilEposta", etiket: "Vekilin e-posta adresi", bolum: "Vekil" }
];
const YEREL: FormAlani[] = [
  { k: "mahkeme", etiket: "Mahkemenin adı", bolum: "Yerel mahkeme" },
  { k: "acilis", etiket: "Davanın açıldığı tarih", bolum: "Yerel mahkeme" },
  { k: "esasKarar", etiket: "Esas ve karar no", bolum: "Yerel mahkeme" },
  { k: "kesinlesme", etiket: "Kesinleşme tarihi", bolum: "Yerel mahkeme" }
];
const ACIKLAMA: FormAlani = { k: "aciklamalar", etiket: "Açıklamalar", bolum: "Açıklamalar", cok: true, ipucu: "Beyan editöründe yazılan metin buraya girer." };

export const FORMLAR: ResmiForm[] = [
  { id: "tazminat-dogrudan", ad: "Tazminat Komisyonu başvuru dilekçesi (doğrudan başvuru)", kisa: "Doğrudan başvuru", turler: [TAZMINAT], tip: "docx", dosya: "tazminat-dogrudan.docx",
    aciklama: "Makul sürede yargılanmama ya da kesinleşmiş kararın geç / hiç icra edilmemesi için Adalet Bakanlığı Tazminat Komisyonu'na doğrudan başvuru (6384 s. Kanun).",
    alanlar: [...BASVURUCU, ...YEREL, ACIKLAMA] },
  { id: "tazminat-aym", ad: "Tazminat Komisyonu başvuru dilekçesi (AYM'den gelenler)", kisa: "AYM'den gelen", turler: [TAZMINAT], tip: "docx", dosya: "tazminat-aym.docx",
    aciklama: "Anayasa Mahkemesi'nin Komisyon'u işaret eden kabul edilemezlik kararından sonra yapılan başvuru.",
    alanlar: [...BASVURUCU, ...YEREL, { k: "aymTarih", etiket: "AYM başvuru tarihi", bolum: "Anayasa Mahkemesi" }, { k: "aymNo", etiket: "AYM başvuru no", bolum: "Anayasa Mahkemesi" }, ACIKLAMA] },
  { id: "tazminat-aihm", ad: "Tazminat Komisyonu başvuru dilekçesi (AİHM'den gelenler)", kisa: "AİHM'den gelen", turler: [TAZMINAT], tip: "docx", dosya: "tazminat-aihm.docx",
    aciklama: "AİHM'nin Komisyon'u işaret eden kabul edilemezlik kararından sonra yapılan başvuru.",
    alanlar: [...BASVURUCU, ...YEREL, { k: "aihmTarih", etiket: "AİHM başvuru tarihi", bolum: "AİHM" }, { k: "aihmNo", etiket: "AİHM başvuru no", bolum: "AİHM" }, ACIKLAMA] },
  { id: "tazminat-cmk", ad: "Tazminat Komisyonu başvuru dilekçesi (CMK koruma tedbirleri)", kisa: "CMK koruma tedbiri", turler: [TAZMINAT], tip: "docx", dosya: "tazminat-cmk.docx",
    aciklama: "CMK 141/e, f ve l kapsamında koruma tedbirleri nedeniyle tazminat (KYOK ya da beraat kesinleştikten sonra).",
    alanlar: [...BASVURUCU, { k: "cmk141", etiket: "CMK 141. madde bendi", bolum: "CMK 141", secenek: ["141/e", "141/f", "141/l"], ipucu: "Birden çoksa virgülle: 141/e, 141/f" },
      { k: "mahkeme", etiket: "Mahkeme / savcılık adı", bolum: "Yerel mahkeme ya da savcılık" }, { k: "acilis", etiket: "Davanın / soruşturmanın açıldığı tarih", bolum: "Yerel mahkeme ya da savcılık" },
      { k: "esasKarar", etiket: "Esas ve karar no", bolum: "Yerel mahkeme ya da savcılık" }, { k: "kesinlesme", etiket: "Kesinleşme tarihi", bolum: "Yerel mahkeme ya da savcılık" }, ACIKLAMA] },
  { id: "aym-bb", ad: "Anayasa Mahkemesi bireysel başvuru formu", kisa: "AYM bireysel başvuru", turler: ["Bireysel başvuru (olaylar ve ihlal iddiaları)", "Bireysel başvuruda tedbir talebi"], tip: "cevrimici",
    site: "https://www.anayasa.gov.tr/tr/bireysel-basvuru/",
    aciklama: "Formun bölümleri (İçtüzük 59) sırasıyla hazırlanır: UYAP üzerinden e-başvuruda alanlara kopyalayıp yapıştırın ya da yazdırılabilir nüshayı indirin.",
    alanlar: [
      { k: "basvurucuSayisi", etiket: "A. Başvurucu sayısı", bolum: "I. Genel bilgiler" }, { k: "basvuruTarihi", etiket: "B. Başvuru tarihi", bolum: "I. Genel bilgiler" },
      { k: "digerBasvuru", etiket: "C. Devam eden başka başvuru numarası", bolum: "I. Genel bilgiler" },
      { k: "dizi", etiket: "D. Başvuru dizi pusulası (belgeler tarih sırasıyla)", bolum: "I. Genel bilgiler", cok: true, ipucu: "Her satıra bir belge: 1- 12.01.2024 tarihli dava dilekçesi" },
      { k: "tc", etiket: "T.C. kimlik numarası", bolum: "II. Başvurucu (gerçek kişi)" }, { k: "ad", etiket: "Adı", bolum: "II. Başvurucu (gerçek kişi)" }, { k: "soyad", etiket: "Soyadı", bolum: "II. Başvurucu (gerçek kişi)" },
      { k: "anne", etiket: "Anne adı", bolum: "II. Başvurucu (gerçek kişi)" }, { k: "baba", etiket: "Baba adı", bolum: "II. Başvurucu (gerçek kişi)" }, { k: "dogumTarihi", etiket: "Doğum tarihi", bolum: "II. Başvurucu (gerçek kişi)" },
      { k: "cinsiyet", etiket: "Cinsiyeti", bolum: "II. Başvurucu (gerçek kişi)" }, { k: "uyruk", etiket: "Uyruğu", bolum: "II. Başvurucu (gerçek kişi)" }, { k: "meslek", etiket: "Mesleği", bolum: "II. Başvurucu (gerçek kişi)" },
      { k: "telefon", etiket: "Telefon numaraları", bolum: "II. Başvurucu (gerçek kişi)" }, { k: "eposta", etiket: "Elektronik posta adresi", bolum: "II. Başvurucu (gerçek kişi)" }, { k: "adres", etiket: "Adresi", bolum: "II. Başvurucu (gerçek kişi)" },
      { k: "vekilAd", etiket: "Avukatın adı", bolum: "III. Temsilci (avukat)" }, { k: "vekilSoyad", etiket: "Avukatın soyadı", bolum: "III. Temsilci (avukat)" },
      { k: "vekilBaroAd", etiket: "Kayıtlı olduğu baro", bolum: "III. Temsilci (avukat)" }, { k: "vekilSicil", etiket: "Baro sicil numarası", bolum: "III. Temsilci (avukat)" },
      { k: "vekilTelefon", etiket: "Telefon numaraları", bolum: "III. Temsilci (avukat)" }, { k: "vekilEposta", etiket: "Elektronik posta adresi", bolum: "III. Temsilci (avukat)" }, { k: "vekilAdres", etiket: "Adresi", bolum: "III. Temsilci (avukat)" },
      { k: "olaylar", etiket: "A. Olaylar ve başvuru yollarının tüketilmesi (tarih sırasıyla)", bolum: "IV. Açıklamalar", cok: true, ipucu: "Her satıra: GG.AA.YYYY – olay. Beyan editöründeki metin buraya girer." },
      { k: "nihaiMerci", etiket: "B.1 Nihai kararı veren mahkeme / merci / makam", bolum: "IV. Açıklamalar" }, { k: "nihaiKarar", etiket: "B.2 Kararın tarih ve sayısı", bolum: "IV. Açıklamalar" },
      { k: "teblig", etiket: "B.3 Tebliğ veya öğrenme tarihi", bolum: "IV. Açıklamalar" },
      { k: "haklar", etiket: "C. İhlal edilen haklar ve gerekçeleri (her hak ayrı)", bolum: "IV. Açıklamalar", cok: true, ipucu: "Örn. Adil yargılanma hakkı (Anayasa m. 36) – gerekçeli karar hakkı: …" },
      { k: "mazeret", etiket: "A. Mazeret (süre geçtiyse; başlangıç–bitiş tarihi ve açıklama)", bolum: "V. Diğer bilgiler", cok: true },
      { k: "tedbir", etiket: "B. Tedbir talebi ve nedenleri", bolum: "V. Diğer bilgiler", cok: true },
      { k: "gizlilik", etiket: "C. Kimliğin gizli tutulması talebi ve gerekçesi", bolum: "V. Diğer bilgiler", cok: true },
      { k: "adliYardim", etiket: "D. Adli yardım talebi ve dayanak belgeler", bolum: "V. Diğer bilgiler", cok: true },
      { k: "sonuc", etiket: "Sonuç talepleri", bolum: "VI. Sonuç talepleri", cok: true },
      { k: "imzaTarih", etiket: "Tarih", bolum: "VII. Beyan ve imza" }, { k: "imzaAd", etiket: "Ad soyad", bolum: "VII. Beyan ve imza" }
    ] },
  { id: "stk", ad: "Sigorta Tahkim Komisyonu online başvurusu", kisa: "STK online başvuru", turler: ["Sigorta Tahkim Komisyonu başvurusu"], tip: "cevrimici",
    site: "https://www.sigortatahkim.org/",
    aciklama: "Başvuru Komisyon'un sitesinde e-Devlet doğrulamasıyla yapılır; form yoktur. Celse her alanın içeriğini sitedeki sırayla hazırlar, alan alan kopyalayıp yapıştırın. Önce sigorta kuruluşuna yazılı başvurulmuş ve cevap alınmamış ya da olumsuz cevap alınmış olmalıdır.",
    alanlar: [
      { k: "sifat", etiket: "Başvuruyu yapan sıfatı", bolum: "Başvuruyu yapan", secenek: ["Gerçek kişi", "Tüzel kişi"] },
      { k: "kimlikNo", etiket: "Kimlik numarası (başvuru sahibinin T.C. / vergi no)", bolum: "Başvuruyu yapan" },
      { k: "vekilMi", etiket: "Başvuru sahibi vekili misiniz?", bolum: "Başvuruyu yapan", secenek: ["Evet", "Hayır"] },
      { k: "ad", etiket: "Adı", bolum: "Başvuru sahibi" }, { k: "soyad", etiket: "Soyadı", bolum: "Başvuru sahibi" }, { k: "ogrenim", etiket: "Öğrenim durumu", bolum: "Başvuru sahibi" },
      { k: "adres", etiket: "Adres", bolum: "Başvuru sahibi" }, { k: "il", etiket: "İl", bolum: "Başvuru sahibi" }, { k: "ilce", etiket: "İlçe", bolum: "Başvuru sahibi" },
      { k: "telefon", etiket: "Telefon", bolum: "Başvuru sahibi" }, { k: "eposta", etiket: "E-posta", bolum: "Başvuru sahibi" },
      { k: "vekilAd", etiket: "Vekilin adı soyadı", bolum: "Vekil" }, { k: "vekilTc", etiket: "Vekilin T.C. kimlik no", bolum: "Vekil" }, { k: "vekilBaro", etiket: "Baro ve sicil no", bolum: "Vekil" },
      { k: "vekilAdres", etiket: "Vekilin adresi", bolum: "Vekil" }, { k: "vekilTelefon", etiket: "Vekilin telefonu", bolum: "Vekil" }, { k: "vekilEposta", etiket: "Vekilin e-postası", bolum: "Vekil" },
      { k: "sigortaKurulusu", etiket: "Başvurulan sigorta kuruluşu", bolum: "Uyuşmazlık" }, { k: "brans", etiket: "Sigorta branşı / poliçe türü", bolum: "Uyuşmazlık", ipucu: "Örn. Zorunlu Mali Sorumluluk (Trafik), Kasko, Hayat" },
      { k: "policeNo", etiket: "Poliçe numarası", bolum: "Uyuşmazlık" }, { k: "hasarNo", etiket: "Hasar / dosya numarası", bolum: "Uyuşmazlık" }, { k: "olayTarihi", etiket: "Olay / hasar tarihi", bolum: "Uyuşmazlık" },
      { k: "sirketBasvuru", etiket: "Sigorta kuruluşuna başvuru tarihi ve sonucu", bolum: "Uyuşmazlık", ipucu: "Örn. 12.03.2026 tarihinde başvuruldu; 15 gün içinde cevap verilmedi / 02.04.2026 tarihli yazıyla reddedildi" },
      { k: "talepTutari", etiket: "Talep edilen tutar (TL)", bolum: "Uyuşmazlık" },
      { k: "uyusmazlikKonusu", etiket: "Uyuşmazlık konusu (kısa)", bolum: "Uyuşmazlık" },
      { k: "aciklamalar", etiket: "Uyuşmazlığın açıklaması ve talep", bolum: "Uyuşmazlık", cok: true, ipucu: "Beyan editöründeki metin buraya girer." },
      { k: "ekler", etiket: "Eklenecek belgeler", bolum: "Belgeler", cok: true, ipucu: "Her satıra bir belge: poliçe, sigorta kuruluşuna başvuru ve cevabı, ekspertiz raporu, vekâletname, başvuru ücreti dekontu…" }
    ] }
];

export const turFormlari = (tur: string) => FORMLAR.filter(f => f.turler.includes(tur));
export const formBul = (id: string) => FORMLAR.find(f => f.id === id);

const trTarih = (x?: string) => { const m = (x || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}.${m[2]}.${m[1]}` : x || ""; };
const bugunTr = (d = new Date()) => d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
const adBol = (x: string) => { const p = (x || "").trim().split(/\s+/); return { ad: p.slice(0, -1).join(" ") || p[0] || "", soyad: p.length > 1 ? p[p.length - 1] : "" }; };

/** Föyden, beyandan ve vekil bilgilerinden önceden doldurulan değerler. Avukatın elle yazdıkları (kayıtlı) bunların üstüne gelir. */
export function formOnDoldur(form: ResmiForm, f: Foy, b: Pick<Beyan, "metin">, v: VekilKunye, kayitli: Record<string, string> = {}): Record<string, string> {
  const mb = f.muvekkilBilgi || {};
  const kisi = adBol(f.muvekkil || ""), vk = adBol(v.ad || "");
  const baroSicil = [v.baro, v.baroNo].filter(Boolean).join(" · ");
  const o: Record<string, string> = {
    basvurucuSayisi: "1", basvuruTarihi: bugunTr(), imzaTarih: bugunTr(),
    adSoyad: f.muvekkil || "", ad: kisi.ad, soyad: kisi.soyad, tc: mb.kimlikNo || "", kimlikNo: mb.kimlikNo || "",
    adres: mb.adres || "", telefon: mb.telefon || "", eposta: mb.eposta || "",
    vekilAd: form.id === "aym-bb" ? vk.ad : v.ad || "", vekilSoyad: vk.soyad, vekilAdres: v.adres || "", vekilBaro: baroSicil, vekilBaroAd: v.baro || "", vekilSicil: v.baroNo || "",
    vekilTelefon: v.telefon || "", vekilEposta: v.eposta || "", vekilTc: v.tc || "",
    mahkeme: f.mahkeme || "", acilis: trTarih(f.acilis), esasKarar: f.esasNo ? f.esasNo + " E." : "", kesinlesme: trTarih(f.kapanis),
    aymNo: "", aihmNo: "", nihaiMerci: f.mahkeme || "",
    sifat: "Gerçek kişi", vekilMi: v.ad ? "Evet" : "Hayır", sigortaKurulusu: f.karsiTaraf || "",
    aciklamalar: b.metin || "", olaylar: b.metin || "", imzaAd: form.id === "aym-bb" ? v.ad || f.muvekkil || "" : v.ad || ""
  };
  const out: Record<string, string> = {};
  for (const a of form.alanlar) out[a.k] = kayitli[a.k] !== undefined ? kayitli[a.k] : o[a.k] || "";
  return out;
}

/** Çevrimiçi form ya da yazdırılabilir nüsha için bölüm bölüm düz metin. */
export function formMetni(form: ResmiForm, d: Record<string, string>): string {
  const satir: string[] = [form.ad.toLocaleUpperCase("tr"), ""];
  let bolum = "";
  for (const a of form.alanlar) {
    if (a.bolum && a.bolum !== bolum) { bolum = a.bolum; satir.push("", bolum.toLocaleUpperCase("tr")); }
    const v = (d[a.k] || "").trim();
    if (a.cok) { satir.push(a.etiket + ":"); satir.push(v || "-"); }
    else satir.push(`${a.etiket}: ${v || "-"}`);
  }
  if (form.id === "aym-bb") satir.push("", "Başvuru formunda belirtilen bilgilerde ve başvuruyla ilgili koşullarda herhangi bir değişiklik olduğunda bunu Mahkemeye bildireceğimi beyan ederim.", "", "İmza");
  return satir.join("\n").replace(/\n{3,}/g, "\n\n");
}

/* ---------- Word formunun doldurulması ---------- */
const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unesc = (x: string) => x.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const metni = (p: string) => unesc([...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map(m => m[1]).join("")).replace(/\s+/g, " ").trim();
/** Paragrafın son koşusunun biçimi; kalın ve altı çizili kaldırılır (değer düz yazılsın). */
function sonBicim(p: string): string {
  const govde = p.includes("</w:pPr>") ? p.slice(p.indexOf("</w:pPr>")) : p;
  const xs = [...govde.matchAll(/<w:rPr>([\s\S]*?)<\/w:rPr>/g)];
  const r = xs.length ? xs[xs.length - 1][1] : "";
  return r.replace(/<w:b(?:Cs)?(?:\s[^>]*)?\/>/g, "").replace(/<w:u(?:\s[^>]*)?\/>/g, "").replace(/<w:noProof\/>/g, "");
}
const kosu = (bicim: string, x: string) => `<w:r>${bicim ? `<w:rPr>${bicim}</w:rPr>` : ""}<w:t xml:space="preserve">${esc(x)}</w:t></w:r>`;
const ekle = (p: string, x: string) => p.replace(/<\/w:p>$/, kosu(sonBicim(p), " " + x) + "</w:p>");
/** Paragrafın bütün yazısını tek metinle değiştirir (sekmeler ve biçim kalır). */
function yeniden(p: string, x: string): string {
  let ilk = true;
  return p.replace(/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>/g, () => { if (!ilk) return "<w:t></w:t>"; ilk = false; return `<w:t xml:space="preserve">${esc(x)}</w:t>`; });
}
const ACIK_PARAGRAF = (x: string) => `<w:p><w:pPr><w:spacing w:after="120" w:line="360" w:lineRule="auto"/><w:ind w:left="360" w:firstLine="708"/><w:jc w:val="both"/></w:pPr>${kosu('<w:sz w:val="22"/>', x)}</w:p>`;

const ETIKETLER: { re: RegExp; k: string[] }[] = [
  { re: /^ADI – SOYADI\s*:$/, k: ["adSoyad"] },
  { re: /^T\.C\. KİMLİK NUMARASI\s*:$/, k: ["tc"] },
  { re: /^DOĞUM YERİ ve TARİHİ\s*:$/, k: ["dogum"] },
  { re: /^YAZIŞMA ADRESİ\s*:$/, k: ["adres", "vekilAdres"] },
  { re: /^TELEFON\s*:$/, k: ["telefon", "vekilTelefon"] },
  { re: /^ADI SOYADI\s*:$/, k: ["vekilAd"] },
  { re: /^BARO ve BARO SİCİL NO\s*:$/, k: ["vekilBaro"] },
  { re: /^E-POSTA ADRESİ\s*:$/, k: ["vekilEposta"] },
  { re: /^(MAHKEMENİN ADI|MAHKEME\/SAVCILIK ADI)\s*:$/, k: ["mahkeme"] },
  { re: /^(DAVANIN AÇILDIĞI TARİH|DAVANIN\/SORUŞTURMANIN AÇILDIĞI TARİH)\s*:$/, k: ["acilis"] },
  { re: /^ESAS ve KARAR NO\s*:$/, k: ["esasKarar"] },
  { re: /^KESİNLEŞME TARİHİ\s*:$/, k: ["kesinlesme"] },
  { re: /^AYM BAŞVURU TARİHİ\s*:$/, k: ["aymTarih"] },
  { re: /^AYM BAŞVURU NO\s*:$/, k: ["aymNo"] },
  { re: /^AİHM BAŞVURU TARİHİ\s*:$/, k: ["aihmTarih"] },
  { re: /^AİHM BAŞVURU NO\s*:$/, k: ["aihmNo"] }
];

/** Kurumun Word formunu (şablon) değerlerle doldurur; biçim ve düzen aynen kalır. */
export function docxFormDoldur(sablon: Uint8Array, form: ResmiForm, d: Record<string, string>): Uint8Array {
  const z = unzipSync(sablon);
  const xml = strFromU8(z["word/document.xml"]);
  const parcalar: string[] = [];
  const ps: { bas: number; son: number; p: string }[] = [];
  for (const m of xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)) ps.push({ bas: m.index!, son: m.index! + m[0].length, p: m[0] });
  const sayac: Record<string, number> = {};
  const yeni = ps.map(x => x.p);
  const tek = (v: string) => v.replace(/\s*\n\s*/g, ", ").trim();
  let aciklamaBas = -1, sonucBas = -1;
  ps.forEach((x, i) => {
    const t = metni(x.p);
    if (t === "AÇIKLAMALAR") aciklamaBas = i;
    if (/^SONUÇ ve TALEP$/i.test(t)) sonucBas = i;
    if (/^Başvurucu Sayısı:$/.test(t) && ps[i + 1]) yeni[i + 1] = ekle(ps[i + 1].p, d.basvurucuSayisi || "");
    if (/^Başvuru Tarihi:$/.test(t) && ps[i + 1]) yeni[i + 1] = ekle(ps[i + 1].p, d.basvuruTarihi || "");
    for (const e of ETIKETLER) {
      if (!e.re.test(t)) continue;
      const n = sayac[e.re.source] = (sayac[e.re.source] || 0) + 1;
      const k = e.k[Math.min(n, e.k.length) - 1];
      if (d[k]?.trim()) yeni[i] = ekle(x.p, tek(d[k]));
    }
    const m = t.match(/^141\/([efl])$/);
    if (m && d.cmk141) yeni[i] = ekle(x.p, new RegExp("141\\/" + m[1] + "\\b").test(d.cmk141) ? "☒ (işaretlendi)" : "");
    if (/^Müracaat eden/.test(t) && /\.\.[.…]+/.test(t)) {
      yeni[i] = yeniden(x.p, form.id === "tazminat-cmk" ? `Müracaat eden ${d.adSoyad || "…"} vekili${d.vekilAd ? " Av. " + d.vekilAd : ""}` : `Müracaat eden ${d.adSoyad || "…"} vekili`);
    }
    if (/^Av\.$/.test(t) && d.vekilAd) yeni[i] = yeniden(x.p, "Av. " + d.vekilAd);
  });
  // Açıklamalar: başlıktan sonraki boş satırların yerine metin paragrafları (biri boş kalır).
  if (aciklamaBas >= 0 && (d.aciklamalar || "").trim()) {
    const bitis = sonucBas > aciklamaBas ? sonucBas : aciklamaBas + 1;
    const bos = Array.from({ length: bitis - aciklamaBas - 1 }, (_x, j) => aciklamaBas + 1 + j).filter(j => !metni(ps[j].p));
    const satirlar = d.aciklamalar.replace(/\r\n?/g, "\n").split(/\n+/).map(x => x.trim()).filter(Boolean);
    if (bos.length) {
      yeni[bos[0]] = satirlar.map(ACIK_PARAGRAF).join("");
      for (const j of bos.slice(1, -1)) yeni[j] = "";
    } else yeni[aciklamaBas] = yeni[aciklamaBas] + satirlar.map(ACIK_PARAGRAF).join("");
  }
  let son = 0;
  ps.forEach((x, i) => { parcalar.push(xml.slice(son, x.bas), yeni[i]); son = x.son; });
  parcalar.push(xml.slice(son));
  z["word/document.xml"] = strToU8(parcalar.join(""));
  return zipSync(z);
}
