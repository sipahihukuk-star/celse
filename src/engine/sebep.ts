// Kanun yolu dilekçesinin sebep şıkkı: ilk derecedeki doğru hamlenin hukuki kuralından kısa ve yarıda kesilmemiş bir metin.
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
