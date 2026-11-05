// Evrak maskeleme motoru: kişisel verileri cihazda (telefon ya da tarayıcı) rol ve tür kodlarına çevirir; genel yapay zekâya yalnız
// kodlanmış metin gider. Kodların gerçek karşılıkları (map) cihazda kalır; yapay zekânın cevabı unmask() ile geri çevrilir.
// React Native'e bağımlı değildir: telefonda, web'de ve Node'da (testler) aynı kod çalışır.
//
// Ne yapar:
//  - Taraflar: "DAVACI :", "DAVALI VEKİLİ :", "SANIK :" gibi başlık satırlarındaki kişiler rol koduna çevrilir ([DAVACI],
//    [DAVALI VEKİLİ], [SANIK-2]); kişinin adı metnin her yerinde (çekim ekleriyle) aynı koda döner. Kamu kurumları açık kalır.
//  - Öteki kişiler: ad sözlüğündeki bir adı büyük harfli bir ya da iki sözcük izliyorsa [KİŞİ-n]; "Av." ile başlayanlar [AVUKAT-n].
//  - Numaralar: TC kimlik (kontrol hanesiyle), vergi no, IBAN, telefon, e-posta, plaka, esas/karar/soruşturma numaraları,
//    sicil/başvuru/dosya numaraları, 7 haneden uzun ayraçsız sayılar.
//  - Yerler: adres satırları, il adıyla birlikte geçen mahkeme, daire, icra dairesi ve noterlikler (tür korunur: [İDARE MAHKEMESİ-1]),
//    cezaevi, kışla ve birlik adları, il adları. Şirket unvanları [ŞİRKET-n].
//  - Tarihler: gün atılır, ay ve yıl kalır ("[Ekim 2026]"): süre ve sıra değerlendirmesi mümkün kalır, kişi daralmaz.
//  - Korunanlar: Yargıtay, Danıştay, Anayasa Mahkemesi ve AİHM emsal kararlarının künyeleri (kamuya açıktır, hukuki değerlendirme için gerekir),
//    kanun numaraları ve maddeler, para tutarları.
//  - Elle düzeltme: extra (ayrıca maskelenecek ifadeler) ve allow (maskelenmeyecek değerler).
import { ADLAR, ILLER, KURUM, SIRKET } from "./sozluk";

export type Kind = "taraf" | "kisi" | "avukat" | "kimlik" | "iletisim" | "adres" | "yer" | "mahkeme" | "dosya" | "numara" | "sirket" | "kurum" | "elle";
export interface Entity { code: string; kind: Kind; value: string; count: number }
export interface MaskResult { masked: string; entities: Entity[]; map: Record<string, string> }
export interface MaskOptions { extra?: string[]; allow?: string[] }

const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const UP = "A-ZÇĞİÖŞÜÂÎÛ", LOW = "a-zçğıöşüâîû";
const W = `[${UP}${LOW}]`;
/** Türkçe çekim ekleri (kesme işaretiyle): "'in", "'a", "'dan" … */
const EK = `(?:['’](?:${W}{1,6}))?`;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const trUp = (s: string) => s.toLocaleUpperCase("tr");
const trLow = (s: string) => s.toLocaleLowerCase("tr");

/** TC kimlik numarasının kontrol haneleri. */
export function tcknGecerli(s: string): boolean {
  if (!/^[1-9]\d{10}$/.test(s)) return false;
  const d = s.split("").map(Number);
  const t = (d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7]);
  if (((t % 10) + 10) % 10 !== d[9]) return false;
  return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
}

const ROLLER = ["DAVACILAR", "DAVALILAR", "DAVACI", "DAVALI", "VEKİLLERİ", "VEKİLİ", "MÜŞTEKİ", "MÜŞTEKİLER", "ŞİKAYETÇİ", "ŞİKÂYETÇİ", "ŞÜPHELİ", "ŞÜPHELİLER",
  "SANIK", "SANIKLAR", "KATILAN", "KATILANLAR", "MÜDAFİİ", "MÜDAFİLERİ", "ALACAKLI", "BORÇLU", "BAŞVURUCU", "BAŞVURAN", "İTİRAZ EDEN", "KARŞI TARAF",
  "TANIK", "TANIKLAR", "MAKTUL", "MAĞDUR", "MÜVEKKİL", "İHBAR OLUNAN", "FERİ MÜDAHİL", "ÜÇÜNCÜ KİŞİ", "TEMYİZ EDEN", "İSTİNAF EDEN", "DAVACI VEKİLİ", "DAVALI VEKİLİ"];

/** Emsal karar künyeleri ve korunan ifadeler: maskelemeden önce yer tutucuya alınır. */
const KORU = [
  // Yargıtay / Danıştay daireleri ve kurulları: "Yargıtay 4. Hukuk Dairesi'nin E. 2015/386, K. 2015/14940", "Danıştay, 13. Daire, E. 2018/3269, K. 2023/6335, T. 27.12.2023"
  new RegExp(`(?:Yargıtay|Danıştay|Uyuşmazlık Mahkemesi|Bölge Adliye Mahkemesi|Bölge İdare Mahkemesi)[^\\n]{0,80}?(?:E\\.|Esas)\\s?:?\\s?(?:19|20)\\d{2}/\\d+(?:[,\\s]+(?:K\\.|Karar)\\s?:?\\s?(?:19|20)\\d{2}/\\d+)?(?:[,\\s]+T\\.\\s?\\d{1,2}[./]\\d{1,2}[./]\\d{4})?`, "g"),
  // Anayasa Mahkemesi bireysel başvuru ve norm denetimi: "B. 2018/22072, T. 11/03/2021", "2020/50 E. ve 2025/47 K."
  new RegExp(`(?:Anayasa Mahkemesi|AYM)[^\\n]{0,40}?(?:B\\.\\s?(?:No:?\\s?)?(?:19|20)\\d{2}/\\d+|(?:19|20)\\d{2}/\\d+\\s?E\\.[^\\n]{0,10}?(?:19|20)\\d{2}/\\d+\\s?K\\.)(?:[,\\s]+T\\.\\s?\\d{1,2}[./]\\d{1,2}[./]\\d{4})?`, "g"),
  /\bB\.\s?(?:No:?\s?)?(?:19|20)\d{2}\/\d{3,6}(?:,\s?T\.\s?\d{1,2}[./]\d{1,2}[./]\d{4})?/g,
  // AİHM: "… / Türkiye, no. 12345/18", "Başvuru No: 12345/18"
  /\b[A-ZÇĞİÖŞÜ][\wçğıöşüÇĞİÖŞÜ.]+(?: ve Diğerleri)?\s?\/\s?Türkiye(?:,\s?(?:no\.|B\.\s?No:?)\s?\d+\/\d{2})?/g,
  // Kanunlar: "2577 sayılı", "677 sayılı KHK", "m. 30/4"
  /\b\d{3,4}\s(?:sayılı|s\.)\s?[\wçğıöşüÇĞİÖŞÜ.]*/g,
  /\bm\.\s?\d+(?:\/\d+)?(?:-[a-zçğıöşü])?/g
];

/** Mahkeme ve daire türleri (il + sıra numarasıyla geçince il ve numara gizlenir, tür kalır). */
const MAHKEME = "(?:Asliye Hukuk|Asliye Ceza|Asliye Ticaret|Ağır Ceza|Sulh Hukuk|Sulh Ceza Hâkimliği|Sulh Ceza|İdare|Vergi|İş|Aile|Tüketici|İcra Hukuk|İcra Ceza|Kadastro|Fikri ve Sınai Haklar Hukuk|Çocuk|Çocuk Ağır Ceza|İnfaz Hâkimliği|İcra) (?:Mahkemesi|Dairesi|Müdürlüğü|Hâkimliği)|İcra Dairesi|İcra Müdürlüğü|Noterliği|İnfaz Hâkimliği|Sulh Ceza Hâkimliği";
const AD_RE = [...ADLAR].sort((a, b) => b.length - a.length).flatMap(a => [a[0].toLocaleUpperCase("tr") + a.slice(1), a.toLocaleUpperCase("tr")]).map(esc).join("|");
const IL = `(?:${ILLER.map(esc).join("|")}|${ILLER.map(i => esc(trUp(i))).join("|")})`;

export function mask(text: string, opts: MaskOptions = {}): MaskResult {
  const allow = new Set((opts.allow || []).map(a => a.trim()).filter(Boolean));
  const map: Record<string, string> = {};
  const byValue = new Map<string, string>();
  const counts = new Map<string, number>();
  const kinds = new Map<string, Kind>();
  const seq = new Map<string, number>();
  const codeFor = (kind: Kind, label: string, value: string, numbered = true) => {
    const key = trLow(value.replace(/\s+/g, " ").trim());
    const hit = byValue.get(key);
    if (hit) return hit;
    const n = (seq.get(label) || 0) + 1;
    seq.set(label, n);
    const code = numbered || n > 1 ? `[${label}-${n}]` : `[${label}]`;
    // İlk kez numarasız verilen rolün ikinci kişisi gelirse ilk kişi de numaralı yazılır ("[DAVACI]" → yalnız tek kişide).
    map[code] = value.trim(); byValue.set(key, code); kinds.set(code, kind);
    return code;
  };
  let t = text.replace(/\r\n?/g, "\n");

  // 0) Korunan ifadeler yer tutucuya alınır.
  const kept: string[] = [];
  for (const re of KORU) t = t.replace(re, m => { kept.push(m); return `\u0000${kept.length - 1}\u0000`; });

  const put = (re: RegExp, f: (m: string, ...g: string[]) => string | null) => {
    t = t.replace(re, (...args) => {
      const m = args[0] as string;
      if (allow.has(m.trim())) return m;
      const out = f(m, ...(args.slice(1, -2) as string[]));
      return out == null ? m : out;
    });
  };
  const count = (code: string) => counts.set(code, (counts.get(code) || 0) + 1);

  // 1) Taraflar: başlık satırları ("DAVACI : Ad SOYAD (T.C. Kimlik No: …)").
  const people: { value: string; code: string }[] = [];
  let lastRole = "";
  const roleRe = new RegExp(`^[ \\t]*(${ROLLER.map(esc).join("|")})[ \\t]*:[ \\t]*(.+)$`, "gm");
  t = t.replace(roleRe, (line, role: string, rest: string) => {
    const r = trUp(role).replace("ŞİKÂYETÇİ", "ŞİKAYETÇİ");
    const isVekil = /VEKİL|MÜDAFİ/.test(r);
    const roleName = isVekil && !/DAVACI|DAVALI/.test(r) && lastRole ? `${lastRole.replace(/LAR$|LER$/, "")} ${r.replace(/LERİ$/, "İ")}` : r.replace(/LAR$|LER$/, "");
    if (!isVekil) lastRole = r.replace(/ VEKİLİ$/, "");
    const names = rest.replace(/\(.*?\)/g, " ").split(/,|\s+ve\s+|;/).map(x => x.replace(/^\s*(Av\.|Avukat|Dr\.|Prof\.)\s*/i, "").replace(/[:\s]+$/, "").trim()).filter(Boolean);
    let out = line;
    for (const nm of names) {
      if (allow.has(nm) || nm.length < 3) continue;
      // Satırın geri kalanındaki adres, numara ve unvan kişi adı sayılmaz (adres ayrıca maskelenir).
      if (/\d|\/|\b(?:Mah|Mahallesi|Cad|Caddesi|Sk|Sok|Sokak|Bulv|Apt|Kat|No|Daire|Tel|Adres)\b/i.test(nm)) continue;
      if (nm.split(/\s+/).length > 6 || !nm.split(/\s+/).every(w => new RegExp(`^[${UP}]`).test(w))) continue;
      if (KURUM.test(nm) && !SIRKET.test(nm)) continue;
      const kind: Kind = SIRKET.test(nm) ? "sirket" : "taraf";
      const label = kind === "sirket" ? "ŞİRKET" : roleName;
      const code = codeFor(kind, label, nm, names.length > 1);
      people.push({ value: nm, code });
      out = out.replace(nm, code);
    }
    return out;
  });
  // Rolü tek kişi olan taraf numarasız kalır: [DAVACI]; iki kişi varsa [DAVACI-1], [DAVACI-2].
  for (const [label, n] of seq) if (n === 1) {
    const numbered = `[${label}-1]`;
    if (map[numbered] && kinds.get(numbered) === "taraf") {
      const v = map[numbered]; delete map[numbered]; map[`[${label}]`] = v; kinds.set(`[${label}]`, "taraf");
      byValue.set(trLow(v), `[${label}]`);
      t = t.split(numbered).join(`[${label}]`);
      people.forEach(p => { if (p.code === numbered) p.code = `[${label}]`; });
    }
  }
  // Tarafların adı metnin her yerinde: tam ad (büyük-küçük harf farkıyla) ve tek başına soyadı ya da adı.
  for (const p of people) {
    if (kinds.get(p.code) === "sirket") { put(new RegExp(`${esc(p.value)}${EK}`, "g"), m => { count(p.code); return p.code + suffixOf(m, p.value); }); continue; }
    const parts = p.value.split(/\s+/);
    const variants = new Set([p.value, trUp(p.value), parts.map(x => x[0] + trLow(x.slice(1))).join(" ")]);
    for (const v of variants) put(new RegExp(`(?<![${UP}${LOW}])${esc(v)}${EK}`, "g"), m => { count(p.code); return p.code + suffixOf(m, v); });
    for (const part of parts) {
      if (part.length < 2 || (part.length < 3 && part !== trUp(part))) continue;
      for (const v of new Set([part, trUp(part), part[0] + trLow(part.slice(1))])) {
        if (v.length < 3 && v !== trUp(v)) continue;
        put(new RegExp(`(?<![${UP}${LOW}\\[])${esc(v)}(?![${LOW}${UP}])${EK}`, "g"), m => { count(p.code); return p.code + suffixOf(m, v); });
      }
    }
  }

  // 2) Elle eklenen ifadeler.
  for (const x of opts.extra || []) {
    const v = x.trim();
    if (v.length < 2) continue;
    put(new RegExp(`${esc(v)}${EK}`, "g"), m => { const c = codeFor("elle", "GİZLİ", v); count(c); return c + suffixOf(m, v); });
  }

  // 3) Adres satırları (numaralardan önce: kapı ve kat numaraları adresle birlikte gider).
  // "Adres:" etiketli satır tümüyle; metin içinde ise sokak/cadde öbeği (öncesindeki ve sonrasındaki büyük harfli sözcükler, No/Kat/Daire ve numaralar).
  put(/((?:Adres|Adresi|ADRES|ADRESİ|İkametgah|İkamet Adresi|Tebligat Adresi)\s*:\s*)([^\n]+)/g, (_m, a, v) => {
    if (/^\[[^\]]+\]$/.test(v.trim())) return null;
    const c = codeFor("adres", "ADRES", v.trim()); count(c); return a + c;
  });
  const TOK = `(?:[${UP}][${UP}${LOW}]*\\.?(?:/[${UP}][${UP}${LOW}]+)?|No:?|Kat:?|Daire:?|D:|\\d+(?:/[\\d${UP}${LOW}]+)?)`;
  const ISARET = `(?:Mah\\.|Mahallesi|Cad\\.|Caddesi|Sok\\.|Sk\\.|Sokak|Sokağı|Bulv?\\.|Bulvarı|Apt\\.|Apartmanı|Sitesi|Blok)`;
  put(new RegExp(`(?<![${UP}${LOW}\\d\\[])(?:${TOK}[ ,]{1,2}){1,5}${ISARET}(?:[ ,]{1,2}${TOK}){0,10}`, "g"), m => {
    const tail = m.match(/[ ,]+$/)?.[0] || "";
    const v = m.slice(0, m.length - tail.length).replace(/[,]$/, "");
    const c = codeFor("adres", "ADRES", v); count(c); return c + m.slice(v.length);
  });

  // 3b) Numaralar.
  put(/\bTR\s?\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/gi, m => { const c = codeFor("kimlik", "IBAN", m); count(c); return c; });
  put(/(?<!\d)\d{11}(?!\d)/g, m => (tcknGecerli(m) ? (() => { const c = codeFor("kimlik", "TCKN", m); count(c); return c; })() : null));
  put(/(Vergi (?:Kimlik )?(?:No|Numarası)\s*:?\s*)(\d{10})\b/gi, (_m, a, n) => { const c = codeFor("kimlik", "VKN", n); count(c); return a + c; });
  put(/(?<!\d)(?:(?:\+90\s?|0\s?)?\(?5\d{2}\)?|(?:\+90\s?|0\s?)\(?[2-4]\d{2}\)?)\s?\d{3}\s?\d{2}\s?\d{2}(?!\d)/g, m => { const c = codeFor("iletisim", "TELEFON", m); count(c); return c; });
  put(/[\w.+-]+@[\w-]+\.[\w.]+/g, m => { const c = codeFor("iletisim", "E-POSTA", m); count(c); return c; });
  put(/\b(0[1-9]|[1-7]\d|8[01])\s?[A-Z]{1,3}\s?\d{2,4}\b/g, m => { const c = codeFor("kimlik", "PLAKA", m); count(c); return c; });
  put(/((?:DETSİS|UETS|KEP|MERSİS|Sicil|Başvuru|Dosya|Kayıt|Abone|Müşteri|Poliçe|Hesap|Protokol|Tutanak|Seri|Pasaport|sicil|başvuru|dosya|kayıt|abone|müşteri|poliçe|hesap|protokol|tutanak|seri|pasaport)\s?(?:No|no|Numarası|numarası|Nosu|nosu)?\s*[:.]?\s*)([A-Z0-9][\w\-/.]{3,30})(?=[\s,;)]|$)/g,
    (_m, a, n) => (/\d/.test(n) ? (() => { const c = codeFor("numara", "NO", n.trim()); count(c); return a + c; })() : null));
  put(/\b(\d{3,})(\s(?:yevmiye|Yevmiye|sıra|Sıra))/g, (_m, n, rest) => { const c = codeFor("numara", "NO", n); count(c); return c + rest; });
  put(/(?<![\d.,])\d{7,}(?![\d.,])/g, m => { const c = codeFor("numara", "NO", m); count(c); return c; });

  // 4) Esas, karar, soruşturma numaraları (korunan emsaller dışında).
  put(/\b(?:19|20)\d{2}\s?\/\s?\d{1,7}(?:\s?(?:E\.|K\.|Esas|Karar|D\.\s?İş|Talimat|Soruşturma|Hz\.|Değişik İş|Müt\.))?/g, m => { const c = codeFor("dosya", "ESAS", m); count(c); return c; });

  // 5) Yerler: adres satırları, mahkemeler, cezaevi, kışla ve birlik, il adları.
  put(new RegExp(`${IL}\\s+(\\d+)\\.\\s+(${MAHKEME}|${trUp(MAHKEME)})${EK}`, "g"), (m, _n, type) => {
    const label = trUp(type.replace(/(Mahkemesi|Dairesi|Müdürlüğü|Hâkimliği|Noterliği)/i, "$1"));
    const c = codeFor("mahkeme", label, m.replace(/['’].*$/, "")); count(c); return c + suffixOf(m, m.replace(/['’].*$/, ""));
  });
  put(new RegExp(`(?:${IL}\\s+)?(?:\\d+\\s(?:Nolu|No'lu|Numaralı)\\s)?[A-Z]?\\s?(?:Tipi\\s)?(?:Kapalı|Açık|Yüksek Güvenlikli)?\\s?Ceza İnfaz Kurumu`, "g"), m => {
    if (/^\s*Ceza İnfaz Kurumu$/.test(m)) return null;
    const c = codeFor("yer", "CEZA İNFAZ KURUMU", m.trim()); count(c); return c;
  });
  put(/(?:\d+\.\s+)?(?:Motorlu |Mekanize |Zırhlı |Komando |Topçu |Jandarma )*(?:Piyade |Hava |Deniz )?(?:Tümeni|Tugayı|Alayı?|Alay Komutanlığı|Tabur(?:u)?|Bölük|Kol Karargahı|Karakol Komutanlığı)(?:[,\s]+(?:\d+\.\s+)?(?:Motorlu |Mekanize |Piyade )*(?:Tümeni|Tugayı|Alay Komutanlığı|Alayı|Tabur(?:u)?|Bölük|Kol Karargahı))*/g, m => {
    if (!/\d/.test(m)) return null;
    const c = codeFor("yer", "BİRLİK", m.trim()); count(c); return c;
  });
  put(/[A-ZÇĞİÖŞÜ][\wçğıöşü]+ Kışlası/g, m => { const c = codeFor("yer", "KIŞLA", m); count(c); return c; });
  put(new RegExp(`(?<![${UP}${LOW}\\[])${IL}(?![${LOW}])${EK}`, "g"), m => {
    const base = m.replace(/['’].*$/, "");
    const c = codeFor("yer", "İL", trUp(base[0]) + trLow(base.slice(1))); count(c); return c + suffixOf(m, base);
  });

  // 6) Şirketler ve öteki kişiler.
  put(new RegExp(`(?:[${UP}][${W.slice(1, -1)}&.'’-]*\\s){1,6}(?:A\\.\\s?Ş\\.|Anonim Şirketi|Ltd\\.?\\s?Şti\\.|Limited Şirketi|Holding|Kooperatifi)`, "g"), m => {
    if (KURUM.test(m) && !/A\.\s?Ş\.|Şti/.test(m)) return null;
    const c = codeFor("sirket", "ŞİRKET", m.trim()); count(c); return c;
  });
  put(new RegExp(`\\b(?:Av\\.|Avukat)\\s+([${UP}][${LOW}${UP}]+(?:\\s[${UP}][${LOW}${UP}]+){1,2})${EK}`, "g"), (m, nm) => {
    const c = codeFor("avukat", "AVUKAT", nm); count(c); return "Av. " + c + suffixOf(m, m.replace(/['’].*$/, ""));
  });
  put(new RegExp(`(?<![${UP}${LOW}\\[])(${AD_RE})((?:\\s[${UP}][${LOW}]+){0,1}\\s[${UP}][${UP}${LOW}]+)${EK}`, "g"), (m, first) => {
    if (!ADLAR.has(trLow(first))) return null;
    const base = m.replace(/['’].*$/, "");
    if (KURUM.test(base)) return null;
    const c = codeFor("kisi", "KİŞİ", base); count(c); return c + suffixOf(m, base);
  });

  // 7) Tarihler: gün atılır, ay ve yıl kalır.
  put(/\b(\d{1,2})[./](\d{1,2})[./]((?:19|20)\d{2})\b/g, (_m, _d, mo, y) => (+mo >= 1 && +mo <= 12 ? `[${AYLAR[+mo - 1]} ${y}]` : null));
  put(new RegExp(`\\b\\d{1,2}\\s(${AYLAR.join("|")})\\s((?:19|20)\\d{2})\\b`, "g"), (_m, ay, y) => `[${ay} ${y}]`);

  // 8) Korunanlar geri konur.
  t = t.replace(/\u0000(\d+)\u0000/g, (_m, i) => kept[+i]);

  const entities: Entity[] = Object.keys(map).map(code => ({ code, kind: kinds.get(code) || "elle", value: map[code], count: Math.max(1, counts.get(code) || 0) }));
  return { masked: t, entities, map };
}

/** Eşleşmenin, değerin ardından gelen çekim eki ("'in"). */
function suffixOf(m: string, value: string): string {
  return m.length > value.length ? m.slice(value.length) : "";
}

/** Kodlu metni gerçek değerlere geri çevirir (yalnız cihazda). */
export function unmask(text: string, map: Record<string, string>): string {
  return text.replace(/\[[^\]\n]{1,40}\]/g, code => (code in map ? map[code] : code));
}

/** Maskelenmiş metinde kişisel veri izi kalmış mı: denetim için. */
export function leaks(masked: string, values: string[]): string[] {
  const low = trLow(masked);
  return values.filter(v => v.length >= 3 && low.includes(trLow(v)));
}
