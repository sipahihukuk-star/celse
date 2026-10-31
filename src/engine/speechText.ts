// Seslendirmeden önce metindeki hukuki kısaltmaları ve işaretleri okunur hâle getirir. Saf fonksiyonlar (test edilebilir).

export const ABBR: [string, string][] = [
  ["AİHS", "Avrupa İnsan Hakları Sözleşmesi"], ["AİHM", "Avrupa İnsan Hakları Mahkemesi"], ["AYM", "Anayasa Mahkemesi"],
  ["UCM", "Uluslararası Ceza Mahkemesi"], ["TBK", "Türk Borçlar Kanunu"], ["TMK", "Türk Medeni Kanunu"],
  ["TTK", "Türk Ticaret Kanunu"], ["TCK", "Türk Ceza Kanunu"], ["CMK", "Ceza Muhakemesi Kanunu"],
  ["HMK", "Hukuk Muhakemeleri Kanunu"], ["İİK", "İcra ve İflas Kanunu"], ["İYUK", "İdari Yargılama Usulü Kanunu"],
  ["TKHK", "Tüketicinin Korunması Hakkında Kanun"], ["KVKK", "Kişisel Verilerin Korunması Kanunu"],
  ["VUK", "Vergi Usul Kanunu"], ["AAÜT", "Avukatlık Asgari Ücret Tarifesi"], ["HAGB", "hükmün açıklanmasının geri bırakılması"],
  ["BAM", "Bölge Adliye Mahkemesi"], ["HSK", "Hâkimler ve Savcılar Kurulu"], ["SGK", "Sosyal Güvenlik Kurumu"],
  ["İşK", "İş Kanunu"], ["İş K.", "İş Kanunu"], ["AY", "Anayasa"], ["ECHR", "Avrupa İnsan Hakları Sözleşmesi"]
];
const BACK = "aıou", VOWELS = "aeıioöuü";
const lastVowel = (s: string) => { for (let i = s.length - 1; i >= 0; i--) { const ch = s[i].toLocaleLowerCase("tr"); if (VOWELS.includes(ch)) return ch; } return "e"; };

/** Kısaltmaya eklenmiş eki ("TBK'nın") açılmış kelimeye ünlü uyumuyla uydurur ("Kanunu'nun"). */
export function harmonize(word: string, suffix: string) {
  const v = lastVowel(word);
  const endsVowel = VOWELS.includes(word[word.length - 1].toLocaleLowerCase("tr"));
  let sfx = suffix;
  // Tamlama ("Borçlar Kanunu", "Anayasa Mahkemesi"): iyelik ekinden sonra hâl ekleri "n" ile bağlanır
  // (Kanunu'na, Mahkemesi'nde, Sözleşmesi'nden); "ile" eki "y" ile.
  if (/\s/.test(word) && /[ıiuü]$/.test(word)) {
    const core = sfx.replace(/^[nyş]?/, m => (/^[nyş][aeıiuü]/.test(sfx) ? "" : m));
    if (/^l[ae]/.test(core)) sfx = "y" + core;
    else if (/^(n[ıiuü]n|[ıiuü]n)/.test(sfx)) sfx = "n" + sfx.replace(/^n/, "");
    else if (/^[aeıiuüdt]/.test(core)) sfx = "n" + core.replace(/^t/, "d");
    else sfx = core;
    return vowelHarmony(v, sfx);
  }
  // Kaynaştırma ünsüzü: kelime ünsüzle bitiyorsa düşer (nın → ın, ya → a, sı → ı).
  if (!endsVowel && /^[nys][aeıiuü]/.test(sfx)) sfx = sfx.slice(1);
  // Ünsüzle biten kelimede belirtme/yönelme eki ünlüyle başlamalı; ünlüyle bitende kaynaştırma eklenir.
  if (endsVowel && /^[aeıiuü]/.test(sfx)) sfx = (/^[ıiuü]n$/.test(sfx) ? "n" : "y") + sfx;
  let out = vowelHarmony(v, sfx);
  // Sert ünsüz benzeşmesi: "Kanun" + "da" doğru, sert ünsüzle bitende d → t.
  if (/[çfhkpsşt]$/i.test(word)) out = out.replace(/^d/, "t");
  return out;
}

function vowelHarmony(v: string, sfx: string) {
  let out = "";
  for (const ch of sfx) {
    if ("ae".includes(ch)) { const n = BACK.includes(v) ? "a" : "e"; out += n; v = n; }
    else if ("ıiuü".includes(ch)) { const n = "aı".includes(v) ? "ı" : "ei".includes(v) ? "i" : "ou".includes(v) ? "u" : "ü"; out += n; v = n; }
    else out += ch;
  }
  return out;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ABBR_RE = new RegExp(`(^|[^A-Za-zÇĞİÖŞÜçğıöşü])(${ABBR.map(a => esc(a[0])).sort((a, b) => b.length - a.length).join("|")})(?:['’]([a-zçğıöşü]+))?(?![A-Za-zÇĞİÖŞÜçğıöşü])`, "g");
const ABBR_MAP = new Map(ABBR);

export function expandForSpeech(text: string): string {
  let t = text;
  t = t.replace(ABBR_RE, (_m, pre, ab, sfx) => {
    const full = ABBR_MAP.get(ab)!;
    return pre + full + (sfx ? harmonize(full, sfx) : "");
  });
  t = t
    .replace(/\bmd?\.\s*(\d+)\s*\/\s*(\d+)(?:\s*[-–]\s*([a-zçğıöşü]))?/gi, (_m, a, b, c) => `madde ${a}, fıkra ${b}${c ? `, bent ${c}` : ""}`)
    .replace(/\bmd?\.\s*(\d+)/gi, "madde $1")
    .replace(/(\d+)\s*\.\s*madde/gi, "$1. madde")
    .replace(/\bf\.\s*(\d+)/g, "fıkra $1")
    .replace(/\bbent\s*\(?([a-zçğıöşü])\)?/g, "bent $1")
    .replace(/\bAv\.\s*/g, "Avukat ")
    .replace(/\bDr\.\s*/g, "Doktor ")
    .replace(/\bProf\.\s*/g, "Profesör ")
    .replace(/\bDoç\.\s*/g, "Doçent ")
    .replace(/\bvb\./g, "ve benzeri")
    .replace(/\bvs\./g, "vesaire")
    .replace(/\bNo\s*:\s*/g, "numara ")
    .replace(/%\s*(\d+)/g, "yüzde $1")
    .replace(/(\d)\s*TL\b/g, "$1 lira")
    .replace(/\bTL\b/g, "lira")
    .replace(/(\d{4})\/(\d+)\s*E\./g, "$1 / $2 esas")
    .replace(/(\d{4})\/(\d+)\s*K\./g, "$1 / $2 karar")
    .replace(/§/g, "paragraf ")
    .replace(/[“”«»]/g, "\"");
  return t;
}

