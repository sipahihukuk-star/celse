// Vekâletname okuma (bu cihazda, kurallarla; yapay zekâya gitmez): vekil edenler (ad / unvan, kimlik ya da vergi no, adres),
// vekiller (avukatlar), noterlik, yevmiye no, tarih ve özel yetkiler (ahzu kabz, sulh, feragat, ibra…) çıkarılır.
// Bir vekâletnamede birden çok vekil eden varsa her biri ayrı müvekkil olur. Okunamayanlar avukata gösterilir; tahmin yazılmaz.
import { tcknGecerli } from "../engine/mask";

export interface VekilEden { ad: string; kimlikNo?: string; vergiNo?: string; adres?: string; sirket?: boolean }
export interface Vekalet {
  vekilEdenler: VekilEden[];
  vekiller: string[];
  noterlik?: string;
  yevmiyeNo?: string;
  /** YYYY-AA-GG */
  tarih?: string;
  ozelYetkiler: string[];
  /** "Genel dava vekâletnamesi" ya da "Özel vekâletname" */
  kapsam?: string;
  /** okunamayan / şüpheli yerler */
  uyarilar: string[];
}

const UP = "A-ZÇĞİÖŞÜÂÎÛ";
const LOW = "a-zçğıöşüâîû";
const trUp = (x: string) => x.toLocaleUpperCase("tr");
const bosluk = (x: string) => x.replace(/[ \t ]+/g, " ").trim();
const AY: Record<string, string> = { ocak: "01", şubat: "02", mart: "03", nisan: "04", mayıs: "05", haziran: "06", temmuz: "07", ağustos: "08", eylül: "09", ekim: "10", kasım: "11", aralık: "12" };

/** Ad / unvan olamayacak sözcükler (vekâletname kalıbı). */
const YASAK = /^(?:VEKALETNAME|VEKÂLETNAME|VEK[İI]L|VEK[İI]L EDEN|ASIL|T\.?C\.?|NOTER|NOTERL[İI]Ğ[İI]|YEVM[İI]YE|TAR[İI]H|ADRES|K[İI]ML[İI]K|TÜRK[İI]YE|CUMHUR[İI]YET[İI]|BAŞKATİP|KAT[İI]P|İMZA|ONAY|SAYFA|SURET[İI]|ASLININ)$/;
const SIRKET = /\b(?:L[İI]M[İI]TED|ANON[İI]M|KOLEKT[İI]F|KOOPERAT[İI]F[İI]?|LTD\.?|A\.?\s?Ş\.?|ŞT[İI]\.?|ŞİRKETİ|DERNEĞ[İI]|VAKFI|BELEDİYESİ|BAŞKANLIĞI)\b/i;

/** Büyük harfli 2-5 sözcüklük ad: "AYŞE ÖRNEK DENEME", "Ayşe Örnek Deneme" (baş harfleri büyük). */
function adMi(x: string): boolean {
  const s = bosluk(x).replace(/[,.;:]+$/, "");
  if (s.length < 5 || s.length > 80 || /\d/.test(s)) return false;
  const w = s.split(" ");
  if (w.length < 2 || w.length > 6) return false;
  if (w.some(y => YASAK.test(trUp(y)))) return false;
  return w.every(y => new RegExp(`^[${UP}][${UP}${LOW}'’.-]*$`).test(y));
}
/** "ayşe ÖRNEK deneme" → "Ayşe Örnek Deneme" (şirket unvanları olduğu gibi kalır). */
export function adDuzelt(x: string): string {
  const s = bosluk(x).replace(/[,;:]+$/, "");
  if (SIRKET.test(s)) return s;
  return s.split(" ").map(w => (w.length <= 1 ? trUp(w) : trUp(w[0]) + w.slice(1).toLocaleLowerCase("tr"))).join(" ");
}
function tarihBul(x: string): string | undefined {
  let m = x.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = x.match(new RegExp(`\\b(\\d{1,2})\\s+(${Object.keys(AY).join("|")})\\s+(\\d{4})`, "i"));
  if (m) return `${m[3]}-${AY[m[2].toLocaleLowerCase("tr")]}-${m[1].padStart(2, "0")}`;
  return undefined;
}
/** Kimlik numarasının yakınındaki adres: "… adresinde mukim / oturan / ikamet eden" ya da "Adres: …". */
function adresBul(parca: string, ad?: string): string | undefined {
  // Kişinin adından sonrası aranır (adın kendisi adrese karışmasın).
  if (ad) { const i = trUp(parca).indexOf(trUp(ad)); if (i >= 0) parca = parca.slice(i + ad.length); }
  const etiket = parca.match(/ADRES[İI]?\s*[:：]\s*([^\n]{8,160})/i);
  if (etiket) return temizAdres(etiket[1]);
  const m = parca.match(new RegExp(`([^\\n]{8,180}?)\\s+adres(?:in)?de\\s+(?:mukim|oturan|ikamet|sakin)`, "i"));
  if (m) {
    // Kimlik numarasından ya da "olan / oğlu / kızı" gibi sözcüklerden sonrası adrestir.
    const s = m[1].replace(/^.*?(?:\d{10,11}\)?|\bolan|\boğlu|\bkızı|\bnumaralı|\bno'?lu)\s*,?\s*/i, "");
    return temizAdres(s);
  }
  return undefined;
}
const temizAdres = (x: string) => {
  const s = bosluk(x).replace(/\s*(?:adres(?:in)?de\s+(?:mukim|oturan|ikamet eden|sakin)).*$/i, "")
    .replace(/\s+(?:VEK[İI]L\b|Av\.|AVUKAT|Avukat|Yukarıda|YUKARIDA|İmza|NOTERL).*$/, "").replace(/^[,;:\s-]+|[,;:\s-]+$/g, "");
  return s.length >= 8 ? s.slice(0, 200) : undefined;
};

const YETKILER: [RegExp, string][] = [
  [/ahz[uü]\s*kabz|ahzu\s*kabza|ahz[\s-]*u\s*kabz/i, "Ahzu kabz (para almak)"],
  [/sulh/i, "Sulh"],
  [/feragat/i, "Davadan feragat"],
  [/kabul(?:e)?\b|davayı\s+kabul/i, "Davayı kabul"],
  [/ibra/i, "İbra"],
  [/hakem/i, "Hakem tayini"],
  [/yemin\s+(?:teklif|eda|red)/i, "Yemin teklifi / reddi"],
  [/tevkil|başka(?:sını)?\s+vekil/i, "Başkasını tevkil"],
  [/azl/i, "Azil"],
  [/icra\s+(?:takib|dairesi)|haciz/i, "İcra takibi ve haciz"],
  [/tahliye/i, "Tahliye"],
  [/boşanma/i, "Boşanma (özel yetki)"],
  [/şikayet|şikâyet|suç\s+duyurusu|katılma|müdahil/i, "Ceza: şikâyet, katılma"],
  [/temyiz|istinaf|kanun\s+yolu/i, "Kanun yollarına başvuru"],
  [/arabulucu/i, "Arabuluculuk"],
  [/tapu|ipotek|ferağ/i, "Tapu işlemleri"],
  [/tebliğ\s+almaya|tebellüğ/i, "Tebligat almak"]
];

export function vekaletOku(metin: string): Vekalet {
  const ham = metin.replace(/\r/g, "");
  const tek = ham.replace(/\n+/g, "\n");
  const duz = bosluk(tek.replace(/\n/g, " "));
  const uyarilar: string[] = [];

  // Noterlik, yevmiye, tarih
  const noterM = duz.match(new RegExp(`([${UP}][${UP}${LOW}]+(?:\\s+[${UP}][${UP}${LOW}]+)?)\\s+(\\d{1,3})\\s*\\.?\\s*NOTERL[İIı]Ğ[İIı]`, "i"));
  const noterlik = noterM ? `${adDuzelt(noterM[1])} ${noterM[2]}. Noterliği` : undefined;
  const yevM = duz.match(/YEVM[İIı]YE\s*(?:NO|NUMARASI|N0)?\s*[:.]?\s*(\d{1,7})/i) || duz.match(/(\d{1,7})\s*YEVM[İIı]YE/i);
  const yevmiyeNo = yevM?.[1];
  let tarih: string | undefined;
  const tarihEtiket = duz.match(/(?:TAR[İIı]H[İI]?|DÜZENLEME\s+TAR[İI]H[İI])\s*[:.]?\s*([^\s]{0,3}\d{1,2}[./-]\d{1,2}[./-]\d{4}|\d{1,2}\s+\p{L}+\s+\d{4})/iu);
  if (tarihEtiket) tarih = tarihBul(tarihEtiket[1]);
  if (!tarih && yevM && yevM.index !== undefined) tarih = tarihBul(duz.slice(Math.max(0, yevM.index - 120), yevM.index + 160));
  if (!tarih) tarih = tarihBul(duz);

  // Vekiller (avukatlar): "Av. Ad Soyad", "Avukat Ad Soyad", "… Barosu avukatlarından Ad Soyad"
  const vekiller = new Set<string>();
  for (const m of duz.matchAll(new RegExp(`(?:\\bAv\\.|\\bAVUKAT|\\bAvukat|avukatlarından)\\s+([${UP}][${UP}${LOW}]+(?:\\s+[${UP}][${UP}${LOW}]+){1,3})`, "g"))) {
    const ad = m[1].split(/\s+(?:ve|ile|olarak|vekil|Barosu|BAROSU|İzmir|İZMİR)\b/)[0];
    if (adMi(ad)) vekiller.add(adDuzelt(ad));
  }
  const vekilMi = (ad: string) => [...vekiller].some(v => trUp(v) === trUp(ad));

  // Vekil edenler
  const edenler: VekilEden[] = [];
  const ekle = (x: VekilEden) => {
    if (!x.ad || vekilMi(x.ad)) return;
    const k = x.kimlikNo || x.vergiNo;
    const var_ = edenler.find(y => (k && (y.kimlikNo === k || y.vergiNo === k)) || trUp(y.ad) === trUp(x.ad));
    if (var_) { var_.kimlikNo ||= x.kimlikNo; var_.vergiNo ||= x.vergiNo; var_.adres ||= x.adres; if (trUp(var_.ad) !== trUp(x.ad) && x.ad.length > var_.ad.length && k) var_.ad = x.ad; return; }
    edenler.push(x);
  };

  // 1) Etiketli: "VEKİL EDEN : AD SOYAD", "VEKALET VEREN:", "MÜVEKKİL:", "ASİL:"
  const etiketRe = /^\s*(?:\d+\s*[-.)]\s*)?(?:VEK[İIı]L\s+EDEN(?:LER)?|VEKALET\s*VEREN(?:LER)?|VEKÂLET\s*VEREN(?:LER)?|MÜVEKK[İIı]L(?:LER)?|AS[İIı]L)\s*(?:\d+\s*)?[:：]\s*(.*)$/i;
  const satirlar = tek.split("\n");
  for (let i = 0; i < satirlar.length; i++) {
    const m = satirlar[i].match(etiketRe);
    if (!m) continue;
    const blok = [m[1], satirlar[i + 1] || "", satirlar[i + 2] || ""].join("\n");
    const parcalar = (m[1].trim() ? m[1] : satirlar[i + 1] || "").split(new RegExp(`\\s+(?=\\d+\\s*[-.)]\\s*[${UP}])`));
    for (const p of parcalar) {
      const temiz = bosluk(p.replace(/^\d+\s*[-.)]\s*/, "").replace(/\(.*$/, "").replace(/\s*[-–,]\s*(?:T\.?\s?C\.?|TCKN|K[İI]ML[İI]K|VERG[İI]).*$/i, ""));
      const ad = temiz.split(/\s+(?:adresinde|olan|oğlu|kızı|doğumlu)\b/i)[0];
      if (!(adMi(ad) || SIRKET.test(ad))) continue;
      const kendi = p.match(/\b(\d{11})\b/)?.[1];
      const tc = kendi || (parcalar.length > 1 ? undefined : blok.match(/(?:T\.?\s?C\.?\s*(?:K[İI]ML[İI]K)?\s*(?:NO|NUMARASI)?|TCKN|K[İI]ML[İI]K\s*NO)\s*[:.]?\s*(\d{11})/i)?.[1] || blok.match(/\b(\d{11})\b/)?.[1]);
      const vergi = blok.match(/VERG[İI]\s*(?:K[İI]ML[İI]K)?\s*(?:NO|NUMARASI)\s*[:.]?\s*(\d{10})/i)?.[1];
      ekle({ ad: adDuzelt(ad), kimlikNo: tc && tcknGecerli(tc) ? tc : undefined, vergiNo: vergi, adres: adresBul(blok, parcalar.length > 1 ? undefined : ad), sirket: SIRKET.test(ad) || undefined });
    }
  }

  // 2) Kimlik numarasının çevresi: "T.C. Kimlik No: 1234… olan AYŞE ÖRNEK" ya da "AYŞE ÖRNEK (T.C. 1234…)"
  for (const m of duz.matchAll(/\b(\d{11})\b/g)) {
    const tc = m[1];
    if (!tcknGecerli(tc) || m.index === undefined) continue;
    if (edenler.some(x => x.kimlikNo === tc)) continue;
    const once = duz.slice(Math.max(0, m.index - 140), m.index);
    const sonra = duz.slice(m.index + 11, m.index + 260);
    // Avukatın kimlik numarası (vekil bölümünde) atlanır.
    if (/(?:Av\.|AVUKAT|Avukat|Barosu|BAROSU|sicil)[^.]{0,80}$/.test(once)) continue;
    const adSonra = sonra.match(new RegExp(`^\\s*\\)?\\s*(?:olan|numaralı|no'?lu)?\\s*,?\\s*([${UP}][${UP}${LOW}'’-]+(?:\\s+[${UP}][${UP}${LOW}'’-]+){1,4})`));
    const adOnce = once.match(new RegExp(`([${UP}][${UP}${LOW}'’-]+(?:\\s+[${UP}][${UP}${LOW}'’-]+){1,4})\\s*[,(]?\\s*(?:T\\.?\\s?C\\.?|TCKN|K[İIı]ML[İIı]K)[^\\d]{0,30}$`));
    let ad = "";
    for (const aday of [adOnce?.[1], adSonra?.[1]]) {
      if (!aday) continue;
      const a = aday.split(/\s+(?:adresinde|olan|oğlu|kızı|doğumlu|T\.?C\.?|TCKN|Kimlik|KİMLİK|ve|VE)\b/)[0];
      if (adMi(a)) { ad = a; break; }
    }
    if (!ad) { uyarilar.push("Kimlik numarası bulunan bir kişinin adı okunamadı"); continue; }
    // Şirket adına imzalayan yetkili (müdür, temsilci) müvekkil değildir; şirket bulunursa çıkarılır.
    const yetkili = /(?:adına|müdürü|yetkilisi|temsilcisi|temsilen)\s.{0,60}$/i.test(once);
    ekle({ ad: adDuzelt(ad), kimlikNo: tc, adres: adresBul(duz.slice(Math.max(0, m.index - 20), m.index + 300), ad), ...(yetkili ? { yetkili: true } : {}) } as VekilEden);
  }

  // 3) Şirket: "… LİMİTED ŞİRKETİ (Vergi No: …)" ve vekâletnamede kimlik no'su olmayan unvan
  for (const m of duz.matchAll(new RegExp(`([${UP}][${UP}${LOW}0-9&.'’ -]{3,90}?(?:LİMİTED\\s+ŞİRKETİ|ANONİM\\s+ŞİRKETİ|LTD\\.?\\s*ŞTİ\\.?|A\\.\\s?Ş\\.))`, "g"))) {
    const ad = bosluk(m[1]).replace(/^(?:VEK[İI]L\s+EDEN|ASIL|MÜVEKK[İI]L)\s*[:：]?\s*/i, "").replace(/^.*\b(?:bulunan|olan|unvanlı|ünvanlı|merkezli)\s+/i, "");
    if (ad.length < 6 || /noterli/i.test(ad)) continue;
    const yak = duz.slice(m.index || 0, (m.index || 0) + ad.length + 160);
    const vergi = yak.match(/VERG[İI]\s*(?:K[İI]ML[İI]K)?\s*(?:NO|NUMARASI)\s*[:.]?\s*(\d{10})/i)?.[1];
    if (edenler.some(x => x.sirket && trUp(x.ad) === trUp(ad))) continue;
    ekle({ ad, vergiNo: vergi, sirket: true, adres: adresBul(yak) });
  }

  // Şirket varsa adına imzalayan yetkililer müvekkil sayılmaz.
  const sirketVar = edenler.some(x => x.sirket);
  const sonuc = edenler.filter(x => !(sirketVar && (x as VekilEden & { yetkili?: boolean }).yetkili)).map(x => { const { yetkili: _y, ...y } = x as VekilEden & { yetkili?: boolean }; return y; });
  edenler.length = 0; edenler.push(...sonuc);
  if (!edenler.length) uyarilar.push("Vekil eden okunamadı");
  if (!noterlik) uyarilar.push("Noterlik okunamadı");
  if (!yevmiyeNo) uyarilar.push("Yevmiye no okunamadı");

  const ozelYetkiler = YETKILER.filter(([re]) => re.test(duz)).map(([, ad]) => ad);
  const kapsam = /bilumum|tüm\s+dava|her\s+türlü\s+dava|genel\s+dava/i.test(duz) ? "Genel dava vekâletnamesi" : /özel\s+vekalet|özel\s+vekâlet/i.test(duz) ? "Özel vekâletname" : undefined;
  return { vekilEdenler: edenler.slice(0, 20), vekiller: [...vekiller].slice(0, 10), noterlik, yevmiyeNo, tarih, ozelYetkiler, kapsam, uyarilar };
}

/** Vekâletnamenin künyedeki kısa yazımı: "İzmir 5. Noterliği, 12.03.2026, yevmiye 12345". */
export function vekaletKunye(v: Pick<Vekalet, "noterlik" | "tarih" | "yevmiyeNo">): string {
  return [v.noterlik, v.tarih ? v.tarih.split("-").reverse().join(".") : "", v.yevmiyeNo ? "yevmiye " + v.yevmiyeNo : ""].filter(Boolean).join(", ");
}
