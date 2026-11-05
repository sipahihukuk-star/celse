// Komisyon ve kurul kararlarına itiraz: baro disiplin kurulu → TBB Disiplin Kurulu, İnsan Hakları Tazminat Komisyonu →
// Ankara Bölge İdare Mahkemesi, Sigorta Tahkim Komisyonu → İtiraz Hakem Heyeti (→ tutar yeterse Yargıtay).
// Mahkeme kanun yolları gibi bir aşama dosyası üretilir (appeal.ts · appealCase), ama merci, süre, dilekçe ve karar metinleri
// forumun kendi kurallarına göre yazılır. Spor ve milletlerarası tahkimde olağan bir itiraz yolu yoktur; kapalı gerekçesi döner.
// Süreler ve parasal sınırlar: DOĞRULAYIN (aşağıdaki tablolar).
import { fmtDate, lastDay, longDate, suggestTeblig } from "./deadline";
import { GameState } from "./engine";
import { AppealKind, AppealStage, CaseFile, Choice, Outcome, Side, Step } from "./types";

export interface ForumWay {
  /** itirazı inceleyen merci */
  court: string;
  courtShort: string;
  /** dilekçenin verildiği yer (kararı veren kurul ya da komisyon) */
  via: string;
  /** "itiraz" ya da "temyiz" */
  name: string;
  days: number;
  law: string;
  rejectLaw: string;
  judges: number;
  benchTitle: string;
  /** merci başkanının sahnedeki adı */
  head: string;
  /** isteğe bağlı duruşmanın dayanağı; yoksa inceleme dosya üzerinden */
  durusma?: string;
  /** dosyanın nasıl incelendiği (anlatım) */
  incele: string;
  /** dilekçenin nereye verileceğine ilişkin doğru seçenek ve yanlışlar */
  merciOk: string;
  merciWrong: { text: string; doc: string; law: string; note: string }[];
  /** kabul ve ret kararlarının hüküm metni */
  kabul: { stamp: string; karar: NonNullable<Outcome["karar"]>; hukum: string };
  ret: { stamp: string; karar: NonNullable<Outcome["karar"]>; hukum: string; kesin?: string };
  /** karara karşı sonraki yol açık mı (yalnız sigorta tahkiminde Yargıtay) */
  next?: "temyiz";
  note?: string;
}

/** Sigorta Tahkim Komisyonu parasal sınırları (5684 s.K. m.30/12): başvuru tarihine göre. DOĞRULAYIN; her yıl güncellenir. */
export const SIGORTA_SINIR: Record<number, { itiraz: number; temyiz: number }> = {
  2025: { itiraz: 28_000, temyiz: 300_000 },
  2026: { itiraz: 35_000, temyiz: 383_000 }
};

const tl = (n: number) => n.toLocaleString("tr-TR") + " TL";
const yearOf = (c: CaseFile) => +(c.kararTarihi || "").slice(-4) || new Date().getFullYear();

/** Forum kararına karşı yol: açık ise güzergâh, kapalı ise gerekçe; forum değilse null. */
export function forumWay(c: CaseFile, kind: AppealKind): ForumWay | { closed: string } | null {
  if (!c.forum) return null;
  const f = c.forum;
  if (f === "baro") {
    if (/Türkiye Barolar Birliği/.test(c.court)) return { closed: "Av.K. m.157: TBB Disiplin Kurulunun itiraz üzerine verdiği uyarma, kınama ve para cezası kararları kesindir; diğer kararlar Adalet Bakanlığının onayıyla kesinleşir. Kesinleşen karara karşı ancak idari yargıda iptal davası açılabilir." };
    if (kind === "temyiz") return { closed: "Disiplin kurulu kararlarına karşı temyiz yolu yoktur; itiraz mercii TBB Disiplin Kuruludur." };
    return {
      court: "Türkiye Barolar Birliği Disiplin Kurulu", courtShort: "TBB DİSİPLİN KURULU", via: c.court.replace(/\s*·.*$/, ""), name: "itiraz",
      days: 30, law: "Av.K. m.157", rejectLaw: "Av.K. m.157", judges: 5, benchTitle: "Kurul Başkanı ve dört üye", head: "TBB Disiplin Kurulu Başkanı",
      durusma: "Av.K. m.157 (işten ya da meslekten çıkarmada istem üzerine ya da kendiliğinden)",
      incele: "TBB Disiplin Kurulu itirazı kural olarak dosya üzerinden inceler; işten ya da meslekten çıkarmaya ilişkin kararlarda istem üzerine ya da kendiliğinden duruşma yapabilir. Duruşmada önce itiraz eden dinlenir; son söz hakkında kovuşturma yapılanındır.",
      merciOk: "TBB Disiplin Kuruluna hitaben, kararı veren baroya verin; baro dosyayı Birliğe gönderir.",
      merciWrong: [
        { text: "Doğrudan idare mahkemesinde disiplin kararının iptali için dava açın.", doc: "İDARE MAHKEMESİ BAŞKANLIĞINA", law: "Av.K. m.157; İYUK m.14",
          note: "Baro disiplin kurulu kararı itirazla kesinleşmeden yargı yoluna gidilmez; önce TBB Disiplin Kuruluna itiraz edilir." },
        { text: "Kararı veren disiplin kuruluna, kararını yeniden gözden geçirmesi için dilekçe verin.", doc: "BARO DİSİPLİN KURULU BAŞKANLIĞINA\n(Yeniden inceleme)", law: "Av.K. m.157",
          note: "Kurul verdiği kararı kendisi değiştiremez; yol, üst kurula itirazdır." }
      ],
      kabul: { stamp: "KALDIRMA", karar: "kaldirma", hukum: `İtirazın KABULÜ ile ${c.court.replace(/\s*·.*$/, "")} kararının KALDIRILMASINA ve esas hakkında yeniden karar verilmesine` },
      ret: { stamp: "ONAMA", karar: "onama", hukum: `İtirazın REDDİ ile ${c.court.replace(/\s*·.*$/, "")} kararının ONANMASINA`,
        kesin: "Av.K. m.157: itiraz üzerine verilen uyarma, kınama ve para cezası kararları kesindir; işten ve meslekten çıkarma kararları Adalet Bakanlığının onayıyla kesinleşir." }
    };
  }
  if (f === "ihtk") {
    if (kind === "temyiz") return { closed: "6384 s.K. m.7/4: Komisyon kararlarına itiraz üzerine Ankara Bölge İdare Mahkemesinin verdiği kararlar kesindir. Ardından Anayasa Mahkemesine bireysel başvuru yolu açıktır." };
    return {
      court: "Ankara Bölge İdare Mahkemesi İdari Dava Dairesi", courtShort: "ANKARA BİM · İDARİ DAVA DAİRESİ", via: "İnsan Hakları Tazminat Komisyonu", name: "itiraz",
      days: 15, law: "6384 s.K. m.7/4", rejectLaw: "6384 s.K. m.7/4", judges: 3, benchTitle: "Daire Başkanı ve iki üye", head: "Daire Başkanı",
      incele: "Bölge idare mahkemesi itirazı öncelikle ve dosya üzerinden inceler; üç ay içinde karar verir. Verdiği karar kesindir.",
      merciOk: "Ankara Bölge İdare Mahkemesine hitaben, Komisyon aracılığıyla verin.",
      merciWrong: [
        { text: "Komisyon kararı kesin olduğundan doğrudan Anayasa Mahkemesine bireysel başvuru yapın.", doc: "ANAYASA MAHKEMESİ BAŞKANLIĞINA", law: "6216 s.K. m.45/2; 6384 s.K. m.7/4",
          note: "Bireysel başvuru olağan yollar tüketildikten sonra yapılır; Komisyon kararına karşı önce bölge idare mahkemesine itiraz edilir." },
        { text: "Komisyon kararının bozulması için doğrudan Danıştay'a temyiz dilekçesi verin.", doc: "DANIŞTAY BAŞKANLIĞINA", law: "6384 s.K. m.7/4",
          note: "Kanun itiraz merciini Ankara Bölge İdare Mahkemesi olarak belirlemiştir; Danıştay'a temyiz yolu yoktur." }
      ],
      kabul: { stamp: "KABUL", karar: "kaldirma", hukum: "İtirazın KABULÜ ile İnsan Hakları Tazminat Komisyonu kararının KALDIRILMASINA ve müracaat hakkında yeniden karar verilmesine" },
      ret: { stamp: "RET", karar: "ret", hukum: "İtirazın REDDİNE", kesin: "6384 s.K. m.7/4: itiraz üzerine verilen karar kesindir." }
    };
  }
  if (f === "sigorta") {
    const y = yearOf(c), lim = SIGORTA_SINIR[y], value = c.kanunYolu?.deger;
    if (kind === "temyiz") {
      if (value != null && lim && value <= lim.temyiz) return { closed: `5684 s.K. m.30/12: değeri ${tl(lim.temyiz)} geçmeyen uyuşmazlıklarda itiraz hakem heyeti kararı kesindir (${y}; uyuşmazlık değeri ${tl(value)}).` };
      return {
        court: "Yargıtay Hukuk Dairesi", courtShort: "YARGITAY · HUKUK DAİRESİ", via: "Sigorta Tahkim Komisyonu İtiraz Hakem Heyeti", name: "temyiz",
        days: 14, law: "5684 s.K. m.30/12; HMK m.361", rejectLaw: "HMK m.366", judges: 5, benchTitle: "Daire Başkanı ve dört üye", head: "Daire Başkanı",
        incele: "Yargıtay itiraz hakem heyeti kararını dosya üzerinden inceler; onar ya da bozar.",
        merciOk: "Yargıtay'a gönderilmek üzere, kararı veren Sigorta Tahkim Komisyonuna verin.",
        merciWrong: [
          { text: "İtiraz hakem heyetine ikinci kez itiraz edin.", doc: "SİGORTA TAHKİM KOMİSYONU\nİTİRAZ HAKEM HEYETİNE", law: "5684 s.K. m.30/12",
            note: "Hakem kararına bir kez itiraz edilir; itiraz hakem heyeti kararına karşı yol, tutar yetiyorsa Yargıtay'dır." },
          { text: "Asliye ticaret mahkemesinde hakem kararının iptali için dava açın.", doc: "ASLİYE TİCARET MAHKEMESİNE", law: "5684 s.K. m.30/12",
            note: "Sigorta tahkiminde kanun yolu kanunda düzenlenmiştir: itiraz ve tutar yetiyorsa temyiz. Ayrıca iptal davası yolu yoktur." }
        ],
        kabul: { stamp: "BOZMA", karar: "bozma", hukum: "Temyiz isteminin KABULÜ ile İtiraz Hakem Heyeti kararının BOZULMASINA" },
        ret: { stamp: "ONAMA", karar: "onama", hukum: "Temyiz isteminin REDDİ ile İtiraz Hakem Heyeti kararının ONANMASINA", kesin: "Temyiz incelemesi sonunda verilen onama kararıyla hüküm kesinleşti." },
        note: value == null ? "Uyuşmazlık değeri dosyada yazılı değil; temyiz sınırı denetlenmedi." : undefined
      };
    }
    if (value != null && lim && value < lim.itiraz) return { closed: `5684 s.K. m.30/12: değeri ${tl(lim.itiraz)} altında kalan uyuşmazlıklarda hakem kararı kesindir (${y}; uyuşmazlık değeri ${tl(value)}).` };
    return {
      court: "Sigorta Tahkim Komisyonu İtiraz Hakem Heyeti", courtShort: "İTİRAZ HAKEM HEYETİ", via: "Sigorta Tahkim Komisyonu", name: "itiraz",
      days: 10, law: "5684 s.K. m.30/12", rejectLaw: "5684 s.K. m.30/12", judges: 3, benchTitle: "Heyet Başkanı ve iki hakem", head: "İtiraz Hakem Heyeti Başkanı",
      incele: "İtiraz hakem heyeti dosya üzerinden inceler; itiraz kararın icrasını durdurur. Adli tatil bu süreyi uzatmaz.",
      merciOk: "İtiraz hakem heyetine hitaben, Sigorta Tahkim Komisyonuna verin.",
      merciWrong: [
        { text: "Hakem kararına karşı doğrudan Yargıtay'a temyiz dilekçesi verin.", doc: "YARGITAY BAŞKANLIĞINA", law: "5684 s.K. m.30/12",
          note: "Önce itiraz hakem heyetine itiraz edilir; temyiz, tutar yetiyorsa itiraz hakem heyetinin kararına karşıdır." },
        { text: "Asliye ticaret mahkemesinde aynı talep için yeniden dava açın.", doc: "ASLİYE TİCARET MAHKEMESİNE", law: "5684 s.K. m.30/12",
          note: "Hakem kararı ilam niteliğindedir; aynı uyuşmazlık için mahkemede yeniden dava açılamaz. Yol itirazdır." }
      ],
      kabul: { stamp: "KABUL", karar: "kaldirma", hukum: "İtirazın KABULÜ ile uyuşmazlık hakem kararının KALDIRILMASINA ve yeniden karar verilmesine" },
      ret: { stamp: "RET", karar: "ret", hukum: "İtirazın REDDİNE" },
      next: "temyiz",
      note: value == null ? `Uyuşmazlık değeri dosyada yazılı değil; itiraz sınırı (${lim ? tl(lim.itiraz) : "yılın sınırı"}) denetlenmedi.` : undefined
    };
  }
  if (f === "tff") return { closed: "Anayasa m.59/3: sporun yönetimi ve disiplinine ilişkin Tahkim Kurulu kararları kesindir. Alacak gibi diğer uyuşmazlıklarda yalnız sınırlı sebeplerle iptal davası açılabilir (5894 s.K. m.6/6)." };
  return { closed: "Hakem kararına karşı olağan bir itiraz yolu yoktur; yalnız kanunda sayılan sınırlı sebeplerle, tahkim yerinin mahkemesinde iptal davası açılabilir." };
}

const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n)).replace(/[,;:]$/, "") + "…");

/** Forum aşaması: süre → merci → sebep → talep → (duruşma istemi) → dilekçe → (duruşma) → karar. */
export function forumStage(base: CaseFile, kind: AppealKind, side: Side, w: ForumWay, issue: { law: string; text: string }, baseHukum: string, dat: (s: string) => string, prev?: { c: CaseFile; game: GameState }): AppealStage {
  const cevap = kind === "cevap", temyiz = kind === "temyiz";
  const prevDate = prev?.c.kararTarihi || base.kararTarihi;
  const teblig = suggestTeblig(prevDate, { days: w.days, law: w.law }, undefined, cevap ? 20 : 12);
  const calc = lastDay({ days: w.days, law: w.law, teblig });
  const Name = w.name[0].toLocaleUpperCase("tr") + w.name.slice(1);
  const what = cevap ? `${w.name}a cevap dilekçesi` : `${w.name} dilekçesi`;
  const decided = temyiz ? (prev?.c.court || w.via) : base.court.replace(/\s*·.*$/, "");

  const intro = [
    { who: "narr", text: cevap
      ? `${decided} ${base.kararTarihi} tarihli kararıyla uyuşmazlığı müvekkiliniz lehine sonuçlandırdı. Karşı taraf karara itiraz etti.`
      : `${decided} ${prevDate} tarihli kararıyla müvekkiliniz aleyhine karar verdi.${baseHukum ? ` “${clip(baseHukum, 170)}”` : ""}` },
    { who: "narr", text: cevap ? `İtiraz dilekçesi size ${fmtDate(calc.teblig)} tarihinde tebliğ edildi. Cevabınızı hazırlayacaksınız.` : `Karar size ${fmtDate(calc.teblig)} tarihinde tebliğ edildi. ${Name} dilekçenizi hazırlayacaksınız.` },
    { who: "narr", text: w.incele }
  ];

  const date: Step = {
    kind: "date", side: "p1", scene: "office", lines: [], deadline: { days: w.days, law: w.law, what, teblig },
    prompt: `${what[0].toLocaleUpperCase("tr") + what.slice(1)} için son gün hangisi? Tebliğ: ${longDate(calc.teblig)}. Son günü yazın.`,
    choices: [
      { text: "Doğru gün", min: 100, delta: 10, set: ["sure"], law: w.law, note: "Süreyi doğru hesapladınız." },
      { text: "Erken gün", min: 50, delta: -5, set: ["sure"], law: w.law, note: "Dilekçe yine süresinde verilir; ama son günü yanlış hesapladınız." },
      cevap
        ? { text: "Süre geçti", min: 0, delta: -15, set: ["gec"], law: w.law, note: "Cevap süresini kaçırdınız; itiraz sizin cevabınız olmadan incelenir." }
        : { text: "Süre geçti", min: 0, delta: -25, law: w.law, note: "Süre kaçtı; süresinden sonra yapılan itiraz reddedilir.",
            fatal: { label: "SONUÇ:", hukum: `${Name} süresinde yapılmadığından REDDİNE karar verildi.`,
              summary: `${w.law} uyarınca süre ${calc.label} olup son gün ${longDate(calc.last)} idi. Karar bu yönden kesinleşti.` } }
    ]
  };

  const viaUp = w.via.toLocaleUpperCase("tr"), courtUp = w.court.toLocaleUpperCase("tr");
  const merci: Step = {
    side: "p1", scene: "office", section: "MERCİ", lines: [], prompt: `${cevap ? "Cevap dilekçesini" : "Dilekçeyi"} kime hitaben yazacak, nereye vereceksiniz?`,
    choices: [
      { text: w.merciOk, delta: 10, set: ["merci"], law: w.law, doc: `${dat(viaUp)}\nGönderilmek üzere\n${dat(courtUp)}`,
        note: `Doğru. Dilekçe ${w.via} aracılığıyla ${w.court} önüne gelir.` },
      ...w.merciWrong.map(m => ({ text: m.text, delta: -10, law: m.law, doc: m.doc, note: m.note }))
    ]
  };

  const sebepTitle = cevap ? "CEVAPLARIMIZ" : `${w.name.toLocaleUpperCase("tr")} SEBEPLERİ`;
  const ground = cevap ? `Karar ${issue.law} yönünden isabetlidir: ${issue.text}` : `${issue.law} yönünden hukuka aykırılık: ${issue.text}`;
  const wrongs: Choice[] = [
    { text: "Kararın hakkaniyete aykırı olduğunu, hangi yönden hukuka aykırı bulunduğunu göstermeden genel bir itirazla belirtmek.", delta: -10, law: w.law,
      doc: "Karar hakkaniyete aykırıdır; kaldırılması gerekir.", note: "Gerekçesiz bir itiraz mercii ikna etmez; sebep somut olarak gösterilmeli." },
    { text: "Karşı tarafın yargılamadaki üslubunu ve tutanağa geçmemiş sözlerini dilekçenin ana sebebi yapmak; heyet bunu dikkate alır.", delta: -5,
      doc: "Karşı tarafın üslubu müvekkilimizi etkilemiştir.", note: "Üslup ve tutanağa geçmeyen sözler kararın hukuka aykırılığını göstermez." }
  ];
  const longest = Math.max(...wrongs.map(x => x.text.length));
  const sebep: Step = {
    side: "p1", scene: "office", section: sebepTitle, lines: [], prompt: cevap ? "Cevabınızın merkezine neyi koyacaksınız?" : `${Name} sebebiniz ne olacak?`,
    choices: [
      { text: clip(ground, Math.floor(longest * 1.1)), delta: 20, set: ["sebep"], law: issue.law, doc: ground + ".",
        note: cevap ? `Doğru. Kararın dayandığı değerlendirmeyi (${issue.law}) savundunuz.` : `Doğru. Kararı uyuşmazlığın kilit meselesinden (${issue.law}) eleştirdiniz.` },
      ...wrongs
    ]
  };

  const talep: Step = {
    side: "p1", scene: "office", section: "SONUÇ VE İSTEM", lines: [], prompt: "Sonuç ve isteminizi nasıl yazacaksınız?",
    choices: [
      cevap
        ? { text: `Karşı tarafın ${w.name} başvurusunun reddine ve kararın aynen korunmasına.`, delta: 10, set: ["talep"], law: w.law, doc: `Karşı tarafın ${w.name} başvurusunun reddine karar verilmesini talep ederiz.`, note: "Doğru talep." }
        : { text: `${decided} kararının kaldırılmasına ve müvekkil lehine yeniden karar verilmesine.`, delta: 10, set: ["talep"], law: w.law, doc: `${decided} kararının kaldırılmasına ve müvekkil lehine yeniden karar verilmesine karar verilmesini talep ederiz.`,
            note: `Doğru. ${w.court} kararı yerinde bulmazsa kaldırıp yeniden karar verebilir.` },
      { text: "Karar nedeniyle uğranılan zararın karşı taraftan tazminat olarak alınmasına karar verilmesine.", delta: -10, law: w.law, doc: "Uğranılan zararın tazminine karar verilmesini talep ederiz.",
        note: `${w.court} kararın yerinde olup olmadığını inceler; ayrıca tazminata hükmetmez.` },
      { text: "Kararın yalnız gerekçesinin düzeltilmesine, sonucunun ise olduğu gibi bırakılmasına.", delta: -5, law: w.law, doc: "Kararın gerekçesinin düzeltilmesine karar verilmesini talep ederiz.",
        note: cevap ? "Gerekçe düzeltmesi karşı tarafın itirazını karşılamaz." : "Gerekçe düzeltmesi aleyhinize olan sonucu ortadan kaldırmaz." }
    ]
  };

  const steps: Step[] = [date, merci, sebep, talep];
  if (w.durusma) steps.push({
    side: "p1", scene: "office", section: "SONUÇ VE İSTEM", lines: [], prompt: "İncelemenin duruşmalı mı, duruşmasız mı yapılmasını istiyorsunuz?",
    choices: [
      { text: "Duruşmasız: dosya üzerinden inceleme yeterli; dilekçem sebeplerimi tam olarak anlatıyor.", delta: 0, set: ["durusmasiz"], law: w.durusma,
        doc: "İncelemenin dosya üzerinden yapılmasını talep ederiz.", note: "İtiraz kural olarak dosya üzerinden incelenir; dilekçeniz tek sözünüz olur." },
      { text: "Duruşmalı: duruşma yapılmasını ve sözlü açıklama hakkı tanınmasını talep etmek.", delta: 0, set: ["durusma"], law: w.durusma,
        doc: "Duruşma yapılmasını ve sözlü açıklamalarımızın dinlenmesini talep ederiz.", note: "Kurul uygun görürse duruşma açar; dilekçede yazmadığınız yeni bir sebebi duruşmada ileri süremezsiniz." }
    ] });
  steps.push({
    kind: "dilekce", side: "p1", scene: "office", lines: [{ who: "narr", text: "Dilekçeniz hazır. Sunmadan önce son bir kez okuyun." }],
    prompt: "Dilekçeyi gözden geçirin.", choices: [],
    paper: { title: cevap ? `${w.name.toLocaleUpperCase("tr")}A CEVAP DİLEKÇESİ` : `${w.name.toLocaleUpperCase("tr")} DİLEKÇESİ`,
      meta: [
        { k: "Dosya", v: base.esas },
        { k: cevap ? "Cevap veren" : temyiz ? "Temyiz eden" : "İtiraz eden", v: base.sides[side].role.replace(/ vekili.*$/, "") },
        { k: "Karşı taraf", v: base.sides[side === "p1" ? "p2" : "p1"].role.replace(/ vekili.*$/, "") },
        { k: "Kararın tebliği", v: fmtDate(calc.teblig) },
        { k: "Karar", v: `${decided} · ${prevDate}` }
      ], sign: base.sides[side].role } });
  if (w.durusma) steps.push({
    if: "durusma", side: "p1", scene: "court",
    lines: [{ who: "narr", text: "Kurul istem üzerine duruşma açtı." }, { who: "judge", text: cevap ? "İtiraz eden dinlendi. Cevap veren vekil, beyanlarınız?" : "Duruşmayı açıyorum. İtiraz eden önce dinlenir. Vekil, sebeplerinizi kısaca özetleyin." }],
    prompt: "Kurula ne söyleyeceksiniz?",
    choices: [
      { text: "Dilekçedeki sebebe bağlı kalıp kararın neden yerinde olmadığını ya da olduğunu kısa ve somut anlatmak.", delta: 15, set: ["sozlu"], law: w.law,
        note: "Doğru. Sözlü açıklama dilekçedeki sebebi özetler; yeni sebep getirmez.", reply: [{ who: "judge", text: "Beyanlarınız tutanağa geçti." }] },
      { text: "Müvekkilin mesleki geçmişini ve yaşadığı mağduriyeti, hukuki dayanak göstermeden duygusal bir dille anlatmak.", delta: -5,
        note: "Kurul mağduriyeti anlar; ama karar hukuki değerlendirmeyle verilir.", reply: [{ who: "judge", text: "Lütfen dilekçenizdeki sebeplere dönün." }] },
      { text: "Dilekçede yazmadığınız yeni bir olayı ve yeni bir sebebi duruşmada ilk kez ileri sürüp kurulu şaşırtmak.", delta: -10, law: w.law,
        note: "Dilekçede bildirilmeyen sebebi duruşmada ilk kez ileri sürmek karşı tarafın savunma hakkını zedeler ve kurulu ikna etmez.", reply: [{ who: "opp", text: "Bu husus dilekçede yok; dikkate alınmamasını talep ediyoruz." }] }
    ] });

  const tail = "; oy birliğiyle karar verildi.";
  const won = w.durusma ? "sebep && (talep || sozlu)" : "sebep && talep";
  const outcomes: Outcome[] = cevap ? [
    { if: won, winner: "p1", stamp: w.ret.stamp, karar: w.ret.karar, label: "KARAR:", hukum: `Karşı tarafın ${w.name} başvurusunun REDDİNE${w.ret.karar === "onama" ? ", kararın ONANMASINA" : ""}${tail}`,
      summary: [{ text: `${w.court}, kararın ${issue.law} yönünden yerinde olduğunu kabul etti; karar müvekkil lehine korundu.` }] },
    { winner: "p2", stamp: w.kabul.stamp, karar: w.kabul.karar, label: "KARAR:", hukum: `Karşı tarafın ${w.name} başvurusunun KABULÜ ile kararın KALDIRILMASINA${tail}`,
      summary: [{ text: `${w.court} karşı tarafın sebeplerini yerinde buldu.` }, { if: "!sebep", text: ` Cevabınız kararın dayandığı değerlendirmeyi (${issue.law}) savunmadı.` }] }
  ] : [
    { if: won, winner: "p1", stamp: w.kabul.stamp, karar: w.kabul.karar, label: "KARAR:", hukum: `${w.kabul.hukum}${tail}`,
      summary: [{ text: `${w.court}, kararı ${issue.law} yönünden yerinde bulmadı.` }, { if: "!merci", text: " Dilekçenin yanlış yere yöneltilmesi sonucu değiştirmedi; ama süre riski yarattı." }] },
    { winner: "p2", stamp: w.ret.stamp, karar: w.ret.karar, label: "KARAR:", hukum: `${w.ret.hukum}${tail}`, ...(w.ret.kesin ? { kesin: w.ret.kesin } : {}),
      summary: [{ if: "!sebep", text: `Dilekçe uyuşmazlığın kilit meselesine (${issue.law}) dayanmadı.` },
        { if: "sebep", text: `Doğru sebebi gösterdiniz; ama sonuç ve isteminiz bu sebebi ${w.court} önüne taşıyamadı.` }] }
  ];

  return { court: w.court, courtShort: w.courtShort, bench: { judges: w.judges, title: w.benchTitle }, intro, steps, outcomes,
    role: `${base.sides[side].role} · ${cevap ? `${w.name}a cevap veren` : temyiz ? "temyiz eden" : "itiraz eden"}` };
}
