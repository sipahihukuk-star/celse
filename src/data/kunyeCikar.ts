// Evraktan künye çıkarma (cihazda, yapay zekâsız): UYAP evrakının başlığındaki mahkeme, esas no, taraflar, vekiller,
// kimlik numaraları, adresler, duruşma günü ve dava konusu; vekâletnamede noterlik, tarih ve yevmiye no. Gerçek adlar
// içerdiği için bu iş bilinçli olarak cihazda yapılır, metin hiçbir yere gönderilmez. Föyde yalnız BOŞ alanlar doldurulur.
import type { Foy, KarsiBilgi, MuvekkilBilgi } from "./foy";

export interface TarafOneri { ad: string; kimlikNo?: string; adres?: string; vekil?: string }
export interface KunyeOneri {
  mahkeme?: string; esasNo?: string; konu?: string; durusma?: string;
  /** UYAP dosya türü ("CBS Soruşturma Dosyası", "Hukuk Dava Dosyası", "İcra Dosyası"…): föy türü tahmini için */
  dosyaTuru?: string;
  /** dava / başvuru / soruşturma / takip tarihi (YYYY-AA-GG) */
  acilis?: string;
  /** evrakın kendi tarihi (karar, tutanak, dilekçe tarihi; YYYY-AA-GG): föyde evrak bu tarihe göre sıralanır */
  belgeTarihi?: string;
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
  return x.split(" ").map(w => (/^(VE|İLE|DA|DE)$/.test(w) ? tr(w) : /^([A-ZÇĞİÖŞÜ]\.)+$|^(A\.Ş|T\.A\.Ş)\.?$/.test(w) ? w : /^LTD\.?$/.test(w) ? "Ltd." : /^ŞTİ\.?$/.test(w) ? "Şti." : w.slice(0, 1) + tr(w.slice(1)))).join(" ");
}

const BIRINCI = ["DAVACILAR", "DAVACI", "MÜŞTEKİ", "ŞİKAYETÇİ", "ŞİKÂYETÇİ", "KATILAN", "ALACAKLI", "BAŞVURUCU", "BAŞVURAN", "İTİRAZ EDEN", "İSTİNAF EDEN", "TEMYİZ EDEN", "KEŞİDECİ", "İHTAR EDEN",
  "SUÇ DUYURUSUNDA BULUNAN", "SUÇTAN ZARAR GÖREN", "MAĞDUR", "MAĞDURLAR", "ŞİKAYET EDEN", "ŞİKÂYET EDEN", "İHBAR EDEN", "MÜDAHİL", "BAŞVURUCULAR", "ALACAKLILAR", "MÜŞTEKİLER"];
const IKINCI = ["DAVALILAR", "DAVALI", "ŞÜPHELİ", "SANIK", "BORÇLU", "KARŞI TARAF", "ALEYHİNE BAŞVURULAN", "KARŞI DAVALI", "MUHATAP", "İHTAR EDİLEN",
  "ŞÜPHELİLER", "SANIKLAR", "BORÇLULAR", "ŞİKAYET EDİLEN", "ŞİKÂYET EDİLEN", "ŞİKAYET OLUNAN", "HAKKINDA ŞİKAYETTE BULUNULAN", "KARŞI TARAFLAR"];
const ROLLER = [...BIRINCI, ...IKINCI].sort((a, b) => b.length - a.length);
// Ayraç iki nokta ya da (PDF ve taramada sütun olarak dizilmiş başlıklarda) sekme / birden çok boşluk.
// "DAVALI (KARŞI DAVACI) :" gibi parantezli rol de olur.
const rolDeseni = new RegExp(`^\\s*(${ROLLER.join("|")})(?:\\s*\\([^)\\n]{1,30}\\))?\\s*(VEKİLİ|VEKİLLERİ|MÜDAFİİ)?(?:\\s*\\([^)\\n]{1,30}\\))?(?:\\s*:|\\t|\\s{2,})\\s*(.*)$`, "i");
const vekilDeseni = /^\s*(VEKİLİ|VEKİLLERİ|MÜDAFİİ)(?:\s*:|\t|\s{2,})\s*(.*)$/i;
/** UYAP tablolarında tarafın türü sütunu; ad değildir. */
const TIP_HUCRE = /^(KİŞİ|KURUM|GERÇEK KİŞİ|TÜZEL KİŞİ|ŞİRKET|ŞAHIS|SANAL KİŞİ|TÜZEL|GERÇEK|-|—)$/i;
const hucreler = (x: string) => x.split(/\t|\s{2,}/).map(c => c.trim()).filter(Boolean);
/** "Birim : …", "Dosya No    2024/12" ya da etiket bir satırda, değeri altındaki satırda (UYAP dosya bilgisi çıktısı). */
function etiket(satirlar: string[], adlar: string[], gecerli: (v: string) => boolean = v => v.length > 1): string | undefined {
  const re = new RegExp(`^\\s*(?:${adlar.join("|")})\\s*(?::|\\t|\\s{2,})\\s*(.+)$`);
  const yalniz = new RegExp(`^\\s*(?:${adlar.join("|")})\\s*:?\\s*$`);
  for (let i = 0; i < Math.min(satirlar.length, 150); i++) {
    const u = satirlar[i].toLocaleUpperCase("tr");
    const m = u.match(re);
    if (m) { const v = satirlar[i].slice(satirlar[i].length - m[1].length).trim(); const ilk = hucreler(v)[0] || v; if (gecerli(ilk)) return ilk; }
    if (yalniz.test(u) && satirlar[i + 1] && gecerli(satirlar[i + 1].trim())) return satirlar[i + 1].trim();
  }
  return undefined;
}
const ESAS_DEGER = /^((?:19|20)\d{2}\s*\/\s*\d{1,7})/;

/** Küçük harfle yazılmış başlık ("Davacı : …") da tanınsın: Türkçe büyük harfe çevirip bakılır. */
const rolBul = (x: string) => x.match(rolDeseni) || x.toLocaleUpperCase("tr").match(rolDeseni);

const tarihIso = (g: string, a: string, y: string, s?: string, d?: string) => {
  const yy = Number(y), aa = Number(a), gg = Number(g);
  if (aa < 1 || aa > 12 || gg < 1 || gg > 31 || yy < 2000 || yy > 2100) return undefined;
  const t = `${yy}-${String(aa).padStart(2, "0")}-${String(gg).padStart(2, "0")}`;
  return s && d ? `${t}T${String(Number(s)).padStart(2, "0")}:${d}` : t;
};

/** Taraf satırının geri kalanından ad, kimlik no ve adresi ayırır. */
function tarafAyir(kalan0: string, sonraki: string): TarafOneri | undefined {
  // Numaralı taraflar ("1- AYŞE ÖRNEK 2- ALİ ÖRNEK"): ilki alınır.
  const kalan = kalan0.replace(/^\s*1\s*[-.)]\s*/, "").split(/\s+2\s*[-.)]\s+/)[0];
  const tum = kalan + " " + sonraki;
  const kimlik = tum.match(/(?:T\.?\s?C\.?|TCKN|Kimlik\s*No|V\.?\s?K\.?\s?N\.?|Vergi\s*No)\D{0,20}?(\d{10,11})\b/i)?.[1] || kalan.match(/(?:^|\D)(\d{11})(?:\D|$)/)?.[1]
    // Şirket ve kurumlarda etiketsiz 10 haneli vergi no
    || (/(?:A\.?\s?Ş\.?|LTD|ŞTİ|ŞİRKETİ|KOOPERATİF)/i.test(kalan) ? kalan.match(/(?:^|\D)(\d{10})(?:\D|$)/)?.[1] : undefined);
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
  // Satır sonu olmadan yazılmış başlıklar ("DAVACI : … VEKİLİ : … DAVALI : …") satırlara ayrılır.
  const rolHepsi = [...ROLLER, "VEKİLİ", "VEKİLLERİ", "MÜDAFİİ", "KONU", "DAVA", "SUÇ", "ESAS NO", "DOSYA NO", "SORUŞTURMA NO"].sort((a, b) => b.length - a.length).join("|");
  const duz = metin.replace(/\r/g, "").replace(new RegExp(`[ \\t]{2,}(?=(?:${rolHepsi})[ \\t]*:)`, "g"), "\n").replace(new RegExp(`([^\\n])\\s+(?=(?:${rolHepsi.replace(/\b(DAVA|SUÇ|KONU)\|/g, "")})[ \\t]*:)`, "g"), "$1\n");
  const ham = duz.split("\n").map(x => x.trim()).filter(Boolean);
  // Etiket, iki nokta ve değer ayrı satırlara düşmüşse (UDF / Word tablosu: "DAVALI" / ":" / "AYŞE ÖRNEK") birleştirilir.
  const ETIKET_TEK = new RegExp(`^(?:${rolHepsi})(?:\\s*\\([^)]{1,30}\\))?$`, "i");
  const satirlar: string[] = [];
  for (let i = 0; i < ham.length; i++) {
    const x = ham[i];
    if (ETIKET_TEK.test(x.toLocaleUpperCase("tr")) && /^:/.test(ham[i + 1] || "")) {
      let deger = ham[i + 1].replace(/^:\s*/, "");
      let j = i + 1;
      if (!deger && ham[i + 2] && !ETIKET_TEK.test(ham[i + 2].toLocaleUpperCase("tr"))) { deger = ham[i + 2]; j = i + 2; }
      satirlar.push(`${x} : ${deger}`); i = j; continue;
    }
    satirlar.push(x);
  }
  const bas = satirlar.slice(0, 60);
  // Mahkeme / savcılık / icra dairesi: başlıktaki ilk büyük harfli satır.
  const merci = new RegExp(`^(?:T\\.?\\s?C\\.?\\s+)?([${BUYUK}][${BUYUK}0-9 .]{2,60}(?:MAHKEMESİ|HAKİMLİĞİ|SAVCILIĞI|İCRA DAİRESİ|İCRA MÜDÜRLÜĞÜ|HUKUK DAİRESİ|CEZA DAİRESİ|DAVA DAİRESİ|ARABULUCULUK BÜROSU|ARABULUCULUK MERKEZİ|KOMİSYONU BAŞKANLIĞI|KOMİSYONU|HAKEM HEYETİ|DİSİPLİN KURULU|BAROSU BAŞKANLIĞI|DANIŞTAY|YARGITAY))(?:['’]?(?:NE|NA|YE|YA))?(?=[\\s,.]|$)`);
  // Dilekçe başlığı "… MAHKEMESİ'NE" de olur; "NÖBETÇİ" mahkeme henüz belli olmayan mahkemedir, alınmaz.
  const etiketsiz = (x: string) => x.replace(/^\s*(?:BİRİM ADI|BİRİM|MAHKEME ADI|MAHKEME|DAİRE|MERCİ|Birim Adı|Birim|Mahkeme Adı|Mahkeme|Daire|Merci)\s*(?::|\t|\s{2,})\s*/, "");
  for (const x0 of bas) { const x = etiketsiz(x0); const m = x.match(merci) || x.toLocaleUpperCase("tr").match(merci); if (m && !/NÖBETÇİ/.test(m[1])) { o.mahkeme = basHarf(m[1].replace(/(MAHKEMESİ)\s+(?:SAYIN\s+)?(?:HAKİMLİĞİ|BAŞKANLIĞI)$/i, "$1")); break; } }
  if (!o.mahkeme) { const b = etiket(bas, ["BİRİM ADI", "BİRİM", "MAHKEME ADI", "MAHKEMESİ", "MAHKEME", "DAİRE", "MERCİ", "SAVCILIK"], v => v.length > 4 && !/^\d/.test(v)); if (b) o.mahkeme = basHarf(b); }
  const esas = metin.match(/(?:ESAS\s*(?:NO|NUMARASI)?|DOSYA\s*(?:NO|NUMARASI|NUMARA)|SORUŞTURMA\s*(?:NO|NUMARASI)|TAKİP\s*NO|BÜRO\s*(?:NO|NUMARASI)|ARABULUCULUK\s*(?:NO|NUMARASI)|BAŞVURU\s*(?:NO|NUMARASI))\s*[:.]?\s*((?:19|20)\d{2}\s*\/\s*\d{1,7})/i)
    || metin.match(/\b((?:19|20)\d{2}\s*\/\s*\d{1,7})\s*(?:Esas\b|E\.)/);
  if (esas) o.esasNo = esas[1].replace(/\s+/g, "");
  if (!o.esasNo) { const e = etiket(satirlar, ["DOSYA NO", "DOSYA NUMARASI", "ESAS NO", "ESAS NUMARASI", "SORUŞTURMA NO", "TAKİP NO", "BAŞVURU NO"], v => ESAS_DEGER.test(v)); if (e) o.esasNo = e.match(ESAS_DEGER)![1].replace(/\s+/g, ""); }
  const dt = etiket(satirlar, ["DOSYA TÜRÜ", "DOSYA TİPİ", "DOSYA TURU"]) || metin.toLocaleUpperCase("tr").match(/\b((?:CBS|C\.?B\.?S\.?)\s+SORUŞTURMA|HUKUK\s+DAVA|CEZA\s+DAVA|İDARE\s+DAVA|İDARİ\s+DAVA|VERGİ\s+DAVA|İCRA|ARABULUCULUK|TAZMİNAT\s+KOMİSYONU|İSTİNAF|TEMYİZ|TALİMAT|SATIŞ\s+MEMURLUĞU)\s+DOSYASI\b/i)?.[0];
  if (dt) o.dosyaTuru = basHarf(dt.replace(/\s+/g, " ").trim());
  // Taraflar ve vekilleri.
  let sonRol: "birinci" | "ikinci" | null = null;
  for (let i = 0; i < Math.min(satirlar.length, 120); i++) {
    const m = rolBul(satirlar[i]);
    if (!m) continue;
    // Tablo satırı ("Davacı   Kişi   AD SOYAD   Av. VEKİL"): hücrelere bölünür.
    if (!m[2] && /\t|\s{2,}/.test(m[3].trim())) {
      const rol0 = m[1].toLocaleUpperCase("tr").replace("ŞİKÂYETÇİ", "ŞİKAYETÇİ");
      const yan0 = BIRINCI.includes(rol0) ? "birinci" : "ikinci";
      const hs = hucreler(m[3]).filter(c => !TIP_HUCRE.test(c));
      const adH = hs.find(c => !/^(AV\.|AVUKAT)/i.test(c) && !/^\d+$/.test(c));
      const vekH = hs.find(c => /^(AV\.|AVUKAT)/i.test(c));
      if (adH && !o[yan0]) { const t = tarafAyir(adH, ""); if (t) o[yan0] = t; }
      if (vekH && o[yan0] && !o[yan0]!.vekil) { const v = tarafAyir(vekH, "")?.ad; if (v) o[yan0]!.vekil = "Av. " + v; }
      continue;
    }
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
    const alt = satirlar[i + 1]?.toLocaleUpperCase("tr").match(vekilDeseni) || satirlar[i + 2]?.toLocaleUpperCase("tr").match(vekilDeseni);
    if (alt && o[yan] && !o[yan]!.vekil) { const v = tarafAyir(alt[2], "")?.ad; if (v) o[yan]!.vekil = "Av. " + v; }
  }
  void sonRol;
  // Rolün sonda ya da ortada olduğu tablo satırları ("AD SOYAD   Davacı   Av. …").
  if (!o.birinci || !o.ikinci) for (const x of satirlar.slice(0, 150)) {
    const hs = hucreler(x);
    if (hs.length < 2) continue;
    const ri = hs.findIndex(c => ROLLER.includes(c.toLocaleUpperCase("tr").replace("ŞİKÂYETÇİ", "ŞİKAYETÇİ")));
    if (ri < 0) continue;
    const rol = hs[ri].toLocaleUpperCase("tr").replace("ŞİKÂYETÇİ", "ŞİKAYETÇİ");
    const yan = BIRINCI.includes(rol) ? "birinci" : "ikinci";
    if (o[yan]) continue;
    const digerleri = hs.filter((c, j) => j !== ri && !TIP_HUCRE.test(c) && !/^\d+$/.test(c));
    const adH = digerleri.find(c => !/^(AV\.|AVUKAT)/i.test(c)), vekH = digerleri.find(c => /^(AV\.|AVUKAT)/i.test(c));
    const t = adH ? tarafAyir(adH, "") : undefined;
    if (t) { o[yan] = t; if (vekH) { const v = tarafAyir(vekH, "")?.ad; if (v) t.vekil = "Av. " + v; } }
  }
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
  // Açılış tarihi: gerekçeli karar ve tutanak başlığındaki "DAVA TARİHİ", "BAŞVURU TARİHİ", "SUÇ TARİHİ" değil "SORUŞTURMA" / "TAKİP" tarihi.
  const ac = metin.match(/(?:DAVA|BAŞVURU|SORUŞTURMA|TAKİP|İHBAR|ŞİKAYET|ŞİKÂYET)\s*(?:AÇILIŞ\s*)?TARİHİ\s*[:]?\s*(\d{1,2})[./](\d{1,2})[./](\d{4})/i);
  if (ac) { const x = tarihIso(ac[1], ac[2], ac[3]); if (x) o.acilis = x; }
  if (!o.acilis) { const a = etiket(satirlar, ["AÇILIŞ TARİHİ", "DOSYA AÇILIŞ TARİHİ", "KAYIT TARİHİ", "DOSYA KAYIT TARİHİ"], v => /^\d{1,2}[./]\d{1,2}[./]\d{4}/.test(v)); const d = a?.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/); if (d) { const x = tarihIso(d[1], d[2], d[3]); if (x) o.acilis = x; } }
  // Evrakın kendi tarihi: "KARAR TARİHİ", "TUTANAK TARİHİ", "Tarih :" ya da başlıktaki/sondaki ilk tarih.
  const bt = metin.match(/(?:KARAR|TUTANAK|RAPOR|DİLEKÇE|TEBLİĞ|DÜZENLEME)\s*TARİHİ\s*[:]\s*(\d{1,2})[./](\d{1,2})[./](\d{4})/i)
    || metin.match(/(?:^|\n)\s*TARİH\s*[:]\s*(\d{1,2})[./](\d{1,2})[./](\d{4})/i)
    || satirlar.slice(0, 25).join("\n").match(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/)
    || satirlar.slice(-12).join("\n").match(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/);
  if (bt) { const x = tarihIso(bt[1], bt[2], bt[3]); if (x) o.belgeTarihi = x; }
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
/** Vekil adında bizim avukatlarımızdan biri geçiyor mu (soyadı ve adın ilk harfleriyle). */
export function bizimVekil(vekil: string | undefined, adlar: string[]): boolean {
  if (!vekil) return false;
  const v = " " + vekil.toLocaleUpperCase("tr").replace(/[^A-ZÇĞİÖŞÜ ]/g, " ") + " ";
  return adlar.some(a => { const p = a.toLocaleUpperCase("tr").replace(/^AV\.?\s*/, "").replace(/[^A-ZÇĞİÖŞÜ ]/g, " ").split(/\s+/).filter(w => w.length >= 3); const soy = p[p.length - 1]; return !!soy && v.includes(" " + soy + " ") && (p.length < 2 || v.includes(" " + p[0] + " ")); });
}
/** Dilekçenin konusu (beyan, cevap, itiraz…) davanın konusu değildir. */
const DILEKCE_KONUSU = /beyan|cevap|itiraz|rapor|talep|dilekçe|karşı|istinaf|temyiz|ıslah|tanık|delil|süre|mazeret|harç|masraf/i;

export function kunyeyiDoldur(f: Foy, o: KunyeOneri, bizimAdlar: string[] = []): { ek: Partial<Foy>; dolan: string[] } {
  const ek: Partial<Foy> = {};
  const dolan: string[] = [];
  const bos = (x?: string) => !x || !x.trim();
  // Hangi tarafın vekiliyiz: evraktaki vekil adlarında kendi adımız geçiyorsa oradan; yoksa föydeki seçimden.
  const bizIkinci = bizimVekil(o.ikinci?.vekil, bizimAdlar) && !bizimVekil(o.birinci?.vekil, bizimAdlar);
  const bizBirinci = bizimVekil(o.birinci?.vekil, bizimAdlar) && !bizimVekil(o.ikinci?.vekil, bizimAdlar);
  // Föyde müvekkil adı yazılıysa ve evrakta taraflardan biri o ise taraf oradan anlaşılır (karşı tarafa müvekkilin adı yazılmasın).
  const sade = (x?: string) => (x || "").toLocaleUpperCase("tr").replace(/[^A-ZÇĞİÖŞÜ ]/g, " ").replace(/\s+/g, " ").trim();
  const m = sade(f.muvekkil);
  const uy = (x?: string) => { const a = sade(x); return m.length > 4 && !!a && (a.includes(m) || m.includes(a)); };
  const mBirinci = uy(o.birinci?.ad) && !uy(o.ikinci?.ad), mIkinci = uy(o.ikinci?.ad) && !uy(o.birinci?.ad);
  const davali = bizIkinci ? true : bizBirinci ? false : mIkinci ? true : mBirinci ? false : f.taraf === "davali";
  if ((bizIkinci || bizBirinci || mBirinci || mIkinci) && (f.taraf === "davali") !== davali && f.taraf !== undefined) { ek.taraf = davali ? "davali" : "davaci"; dolan.push(davali ? "davalı vekiliyiz" : "davacı vekiliyiz"); }
  const biz = davali ? o.ikinci : o.birinci;
  const onlar = davali ? o.birinci : o.ikinci;
  // İcra föyünde merci icra dairesi, no takip no'sudur: ilamın (mahkeme kararının) mahkemesi ve esas no'su buraya yazılmaz
  // (ilam bilgileri icra bölümüne gider).
  const icraDisi = f.tur === "icra" && !!o.mahkeme && !/icra/i.test(o.mahkeme);
  if (bos(f.mahkeme) && o.mahkeme && !icraDisi) { ek.mahkeme = o.mahkeme; dolan.push(f.tur === "icra" ? "icra dairesi" : "mahkeme"); }
  if (bos(f.esasNo) && o.esasNo && !icraDisi) { ek.esasNo = o.esasNo; dolan.push(f.tur === "icra" ? "takip no" : "esas no"); }
  if (bos(f.davaTuru) && o.konu && !DILEKCE_KONUSU.test(o.konu)) { ek.davaTuru = o.konu; dolan.push("konu"); }
  if (!f.durusma && o.durusma) { ek.durusma = o.durusma; dolan.push("duruşma"); }
  if (!f.acilis && o.acilis) { ek.acilis = o.acilis; dolan.push("açılış tarihi"); }
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
  if (bos(mb.vekil) && biz?.vekil) { mb.vekil = biz.vekil; mbDegisti = true; dolan.push("müvekkil vekili"); }
  if (mbDegisti) ek.muvekkilBilgi = mb;
  const kb: KarsiBilgi = { ...(f.karsiBilgi || {}) };
  let kbDegisti = false;
  if (bos(kb.kimlikNo) && onlar?.kimlikNo) { kb.kimlikNo = onlar.kimlikNo; kbDegisti = true; dolan.push("karşı taraf kimlik no"); }
  if (bos(kb.adres) && onlar?.adres) { kb.adres = onlar.adres; kbDegisti = true; dolan.push("karşı taraf adresi"); }
  if (bos(kb.vekil) && onlar?.vekil) { kb.vekil = onlar.vekil; kbDegisti = true; dolan.push("karşı taraf vekili"); }
  if (kbDegisti) ek.karsiBilgi = kb;
  return { ek, dolan };
}

// Yapı iskeleti: okunamayan evrakın düzenini kişisel bilgi göstermeden incelemek için. Bilinen hukuk ve başlık sözcükleri kalır,
// öteki her sözcük □ olur, rakamlar 9 olur. Ad, adres ve numara görünmez; satır ve sütun düzeni görünür.
const SOZLUK = new Set([...ROLLER.flatMap(r => r.split(" ")), "T.C.", "TC", "BİRİM", "ADI", "SOYADI", "UNVANI", "DOSYA", "NO", "NUMARASI", "TÜRÜ", "TİPİ", "DURUMU", "AÇILIŞ", "KAYIT", "TARİHİ",
  "ESAS", "KARAR", "TARAF", "TARAFLAR", "TARAFLARI", "TARAFI", "ROL", "ROLÜ", "VEKİL", "VEKİLİ", "VEKİLLERİ", "KİŞİ", "KURUM", "GERÇEK", "TÜZEL", "MAHKEMESİ", "MAHKEME", "HUKUK", "CEZA", "ASLİYE",
  "AĞIR", "SULH", "İŞ", "İCRA", "DAİRESİ", "MÜDÜRLÜĞÜ", "CUMHURİYET", "BAŞSAVCILIĞI", "SAVCILIĞI", "CBS", "SORUŞTURMA", "SORUŞTURMASI", "DAVA", "DAVASI", "DOSYASI", "İDARE", "VERGİ", "AÇIK",
  "KAPALI", "SAYFA", "TARİH", "KONU", "SUÇ", "SUÇU", "BİLGİLERİ", "BİLGİSİ", "DETAY", "EVRAK", "LİSTESİ", "AİLE", "TÜKETİCİ", "TİCARET", "ARABULUCULUK", "BÜROSU", "KOMİSYONU", "BAŞKANLIĞI",
  "TAZMİNAT", "ADALET", "BAKANLIĞI", "UYAP", "BİLİŞİM", "SİSTEMİ", "TAKİP", "TÜR", "TÜRÜ", "YOLU", "İLAMLI", "İLAMSIZ", "DURUŞMA", "SAAT", "HAKİM", "KATİP", "ZABIT", "TUTANAĞI", "VE", "İLE", "AV.", "AVUKAT",
  "ADRES", "ADRESİ", "KİMLİK", "VERGİ", "MERCİ", "GÖNDERİLEN", "GÖNDEREN", "ALAN", "TEBLİĞ", "İSTİNAF", "TEMYİZ", "DAİRE", "BÖLGE", "ADLİYE", "BİLİRKİŞİ", "RAPORU", "DİLEKÇE", "DİLEKÇESİ", "CEVAP"]);
export function yapiIskeleti(metin: string, satir = 20): string {
  return metin.split("\n").filter(x => x.trim()).slice(0, satir).map(x => x.replace(/\t/g, " ⇥ ").replace(/[^\s⇥]+/g, w => {
    const cip = w.toLocaleUpperCase("tr").replace(/[:;,()]+$/, "");
    if (SOZLUK.has(cip) || SOZLUK.has(cip.replace(/\.$/, ""))) return w;
    return w.replace(/\d/g, "9").replace(/\p{L}+/gu, "□");
  }).replace(/(□[ ]?){3,}/g, "□□□ ")).join("\n");
}
