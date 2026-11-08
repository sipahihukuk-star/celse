// Kanun yolu dilekçesinin sebep şıkkı: ilk derecedeki doğru hamlenin hukuki kuralından kısa ve yarıda kesilmemiş bir metin.
import type { KeywordGroup, Step } from "./types";
/** Kanun yolu sebebinin kısa metni. Şık metni yarıda kesilip "…" ile bitmez:
 *  1) Doğru seçimin açıklamasından (note) oyuncuya hitap etmeyen ilk hukuki kural cümlesi alınır ("Doğru." gibi baş kısmı atılır);
 *     ilk derecedeki hamle metni ("…başvurun", "…isteyin") kanun yolunda sebep olarak okunmaz.
 *  2) Uygun cümle yoksa hamle metni kullanılır.
 *  3) Uzunsa cümle ya da noktalı virgül sınırından kısaltılır; sınır yoksa tam bırakılır. */
export function sebepMetni(issue: { text: string; note?: string }, n: number): { kisa: string; tam: string } {
  const cumleler = (x: string) => x.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ0-9“"(])/).map(c => c.trim()).filter(Boolean);
  const hitap = /(sınız|siniz|sunuz|sünüz|ınız|iniz|unuz|ünüz|ınızı|inizi|nızın|nizin|yorsunuz)\b|\b(siz|size|sizin|sizi)\b/i;
  const not = (issue.note || "").replace(/^\s*(doğru|güçlü|yerinde|isabetli|en iyi|çok iyi|harika|tam isabet)[^.!]{0,40}[.!]\s*/i, "");
  // Sondaki kanun maddesi parantezi şıkta tekrar olur ("… (TBK m.227/1)"): baştaki "X yönünden" zaten söylüyor.
  const sade = (c: string) => c.replace(/\s*\((?:[^()]*\bm\.\s?\d[^()]*|[^()]*\bs\.K\.[^()]*)\)\s*([.!?]?)$/, "$1").replace(/[.]+$/, "").trim();
  const adaylar = cumleler(not).filter(c => c.length >= 40 && !hitap.test(c) && !/^(ama|ancak|fakat|bu yüzden|bu nedenle|örneğin)\b/i.test(c)).map(sade);
  // İlk kural cümlesi sığıyorsa o; sığmıyorsa ilk iki aday arasından kısa olanı (çoğu açıklamada asıl kural ilk iki cümlededir).
  const kural = adaylar.length ? (adaylar[0].length <= n ? adaylar[0] : [...adaylar.slice(0, 2)].sort((x, y) => x.length - y.length)[0]) : undefined;
  const tam = (kural || issue.text).replace(/\s+/g, " ").trim().replace(/[.]+$/, "");
  if (tam.length <= n) return { kisa: tam, tam };
  // Cümle sınırı, yoksa noktalı virgül sınırı; ilk parça çok kısa değilse.
  for (const re of [/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ])/, /;\s+/]) {
    const parca = tam.split(re);
    let out = parca[0];
    for (let i = 1; i < parca.length && (out + " " + parca[i]).length <= n; i++) out += (re.source.startsWith(";") ? "; " : " ") + parca[i];
    if (parca.length > 1 && out.length >= Math.min(60, n * 0.5) && out.length <= n * 1.25) return { kisa: out.replace(/[.;,:]+$/, ""), tam };
  }
  return { kisa: tam, tam };
}


/** Kanun yolu sebebi artık oyuncunun kendi yazdığı (ya da söylediği) metindir: şıklardan seçilmez.
 *  Yapay zekâ değerlendiricisi metni `rubric`e göre puanlar; çevrimdışıyken `keywords` kullanılır.
 *  Yazılan metin dilekçe önizlemesinde `section` başlığı altına girer. */
export function yaziliSebep(o: {
  kind: "istinaf" | "temyiz" | "cevap" | "itiraz"; ad: string; law: string; kural: string; head: string; section: string; kurum: string; issue: { text: string };
}): Step {
  const cevap = o.kind === "cevap";
  const kural = o.kural.replace(/[.]+$/, "");
  const rubric = (cevap
    ? [`İyi bir cevap dilekçesi şunları içerir: (1) Karşı tarafın başvurusuna karşı ilk derece kararının ${o.law} yönünden neden isabetli olduğunu somut olarak gösterir. Uyuşmazlığın kilit kuralı: ${kural}.`,
       "(2) Mahkemenin bu kuralı olaya doğru uyguladığını, dosyadaki olgu ve delillerle bağlantı kurarak anlatır.",
       `(3) Dayandığı kanun maddesini (en az ${o.law}) anar.`,
       "(4) Yeni savunma ya da yeni delil ileri sürmez; gerekçesiz \"karar usul ve yasaya uygundur\" demekle yetinmez."]
    : [`İyi bir ${o.ad} sebebi şunları içerir: (1) Kararın hangi yönden hukuka aykırı olduğunu somut olarak gösterir. Uyuşmazlığın kilit kuralı: ${kural}.`,
       "(2) İlk derece mahkemesinin bu kuralı olaya nasıl yanlış uyguladığını ya da hangi olguyu, delili değerlendirmediğini anlatır.",
       `(3) Dayandığı kanun maddesini (en az ${o.law}) anar.`,
       "(4) Yalnız yargılamada ileri sürülen olgu ve delillere dayanır; yeni delil getirmez, \"karar hakkaniyete aykırıdır\" gibi genel bir itirazla, karşı vekilin ya da hâkimin üslubuyla yetinmez.",
       "Değerlendirmede ağırlık (1) ve (2)'dedir; kural doğru tespit edilip olaya bağlanmışsa madde numarasındaki küçük eksik puanı çok düşürmez."]).join(" ");
  const model = cevap
    ? `${o.head}${kural}. İlk derece mahkemesi bu kuralı dosyadaki olgulara doğru uygulamıştır; karşı tarafın ${o.ad} sebepleri bu değerlendirmeyi çürütmemektedir.`
    : `${o.head}${kural}. İlk derece mahkemesi bu kuralı olaya yanlış uygulamış, dosyadaki ilgili olgu ve delilleri bu yönden değerlendirmemiştir; karar bu nedenle hukuka aykırıdır.`;
  // Çevrimdışı puanlama: madde numarası ve kuralın ayırt edici kelimeleri.
  const madde = (o.law.match(/m\.\s?\d+(?:\/\d+)?/gi) || []).map(x => x.replace(/\s/g, ""));
  const kelimeler = [...new Set(kural.toLocaleLowerCase("tr").replace(/[^a-zçğıöşü\s]/g, " ").split(/\s+/).filter(w => w.length >= 7))]
    .sort((a, b) => b.length - a.length).slice(0, 4);
  const keywords: KeywordGroup[] = [
    ...(madde.length ? [{ terms: [...madde, ...madde.map(m => m.replace(/^m\./i, "madde "))], weight: 2 }] : []),
    ...kelimeler.map(w => ({ terms: [w.slice(0, Math.max(6, w.length - 3))], weight: 1 })),
    { terms: cevap ? ["isabetli", "doğru uygula", "yerinde"] : ["hukuka aykırı", "yanlış uygula", "değerlendirme", "eksik inceleme"], weight: 1 }
  ];
  const ozet = cevap ? `kararın ${o.law} yönünden isabetli olduğu` : `kararın ${o.law} yönünden hukuka aykırılığı`;
  return {
    kind: "free", side: "p1", scene: "office", section: o.section, lines: [],
    prompt: cevap ? "Cevabınızı kendi cümlelerinizle yazın: karar neden isabetli, karşı tarafın sebepleri neden yerinde değil?"
      : `${o.ad.charAt(0).toLocaleUpperCase("tr") + o.ad.slice(1)} sebebinizi kendi cümlelerinizle yazın: karar hangi yönden hukuka aykırı, mahkeme neyi yanlış değerlendirdi?`,
    rubric, keywords, model,
    choices: [
      { text: "Güçlü sebep", min: 70, delta: 20, set: ["sebep"], law: o.law,
        note: `Güçlü. ${ozet.charAt(0).toLocaleUpperCase("tr") + ozet.slice(1)} somut olarak gösterildi; ${o.kurum} bu yönden inceleme yapacak.` },
      { text: "Yeterli sebep", min: 40, delta: 8, set: ["sebep"], law: o.law,
        note: `Yerinde ama eksik. Dilekçenin merkezinde ${ozet} olmalı. Kilit kural: ${kural}. Kuralı olaya bağlayıp mahkemenin neyi yanlış değerlendirdiğini daha açık yazmalıydınız.` },
      { text: "Zayıf sebep", delta: -10, law: o.law,
        note: `Sebep somut değil. Uyuşmazlığın kilit meselesi ${o.law}: ${kural}. Kanun yolu dilekçesinde kararın bu yönden neden ${cevap ? "isabetli" : "hukuka aykırı"} olduğunu, yargılamadaki olgu ve delillere dayanarak göstermelisiniz; genel itiraz, yeni delil ya da üslup eleştirisi ${o.kurum} için yeterli değildir.` }
    ]
  };
}
