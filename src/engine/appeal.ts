// Kanun yolları: istinaf, karşı tarafın istinafına cevap ve temyiz. Arayüzden bağımsızdır.
//
// Tasarım: bir kanun yolu aşaması, ana davadan türetilen sıradan bir tek kişilik dava dosyasıdır (appealCase). Oyun
// motoru, ekranlar, doğrulama ve yol oynatıcı (simulate) onu başka hiçbir değişiklik gerektirmeden oynatır. Aşamanın
// içeriği dosyadaki `appeal` bloğundan gelir; yazılmamışsa davanın kendi hukuki meselesinden temel (otomatik) bir yol
// üretilir: süre (oyuncu son günü yazar) → dilekçe (merci, sebep, talep, önizleme) → kısa duruşma → dairenin kararı.
// Kanun yolunun açık olup olmadığını kanunYolu() söyler (kesinlik: parasal sınır, ceza türü, kanunda kesin kararlar).
import { lastDay, longDate, parseDate, fmtDate, addDays, suggestTeblig } from "./deadline";
import { GameState, kindOf, normalizeCase, other, verdict } from "./engine";
import { test } from "./expr";
import { CMK_SINIR, PARASAL_SINIR } from "./sinirlar";
import { forumStage, forumWay, ForumWay } from "./forumAppeal";
import { AppealKind, AppealStage, CaseFile, CastMember, Choice, DeadlineRule, Outcome, Regime, Side, Step, Winner } from "./types";

/* ---------- Rejim ve derece ---------- */

export function regimeOf(c: CaseFile): Regime {
  const k = c.court || "";
  if (/Ceza/.test(k) && !/Tazminat Komisyonu/.test(k)) return "cmk";
  if (/İdare Mahkemesi|Vergi Mahkemesi|Bölge İdare|Danıştay/.test(k)) return "iyuk";
  if (/İcra Hukuk/.test(k)) return "iik";
  return "hmk";
}

/** Mahkemenin derecesi: ilk derece, bölge (istinaf), yüksek (temyiz) ya da kanun yolu oynatılmayan (AYM, AİHM, tahkim ...). */
export function tierOf(c: CaseFile): "ilk" | "bolge" | "yuksek" | "yok" {
  const k = c.court || "";
  if (c.room === "tahkim" || c.room === "uluslararasi" || c.forum) return "yok";
  if (/Anayasa|Yüce Divan|İnsan Hakları|Uluslararası|Sayıştay|Ceza Mahkemesi ·/.test(k)) return "yok";
  if (/Yargıtay|Danıştay/.test(k)) return "yuksek";
  if (/Bölge Adliye|Bölge İdare/.test(k)) return "bolge";
  return "ilk";
}

/** Mahkemenin kariyer seviyesi (career.ts'teki levelOf ile uyumlu, kaba): kanun yolu puanının çarpanı için. */
export const courtLevel = (court: string) => (/Yargıtay|Danıştay|Sayıştay/.test(court) ? 3 : /Bölge|Ağır Ceza|İdare Mahkemesi|Vergi Mahkemesi/.test(court) ? 2 : 1);

/** Bölge adliye / bölge idare mahkemesinin bulunduğu iller. Listede olmayan ilde ad il belirtilmeden yazılır. DOĞRULAYIN. */
const BOLGE_ILLERI = ["Adana", "Ankara", "Antalya", "Bursa", "Diyarbakır", "Erzurum", "Gaziantep", "İstanbul", "İzmir", "Kayseri", "Konya", "Samsun", "Sakarya", "Trabzon", "Van"];
const cityOf = (court: string) => { const w = (court.match(/^([^\d·]+?)\s+\d+\./)?.[1] || "").split(" ")[0]; return BOLGE_ILLERI.includes(w) ? w : ""; };

/** Türkçe yönelme hâli: "Mahkemesi" → "Mahkemesine", "Yargıtay" → "Yargıtay'a". */
export function dative(s: string): string {
  const v = (s.toLocaleLowerCase("tr").match(/[aeıioöuü](?=[^aeıioöuü]*$)/) || ["e"])[0];
  const front = "eiöü".includes(v);
  const last = s.slice(-1).toLocaleLowerCase("tr");
  const vowelEnd = "aeıioöuü".includes(last);
  const up = s === s.toLocaleUpperCase("tr") && /[A-ZÇĞİÖŞÜ]/.test(s);
  const suf = (vowelEnd ? "n" : "") + (front ? "e" : "a");
  const proper = /Yargıtay|Danıştay$/.test(s) && !vowelEnd;
  const out = proper ? `'${front ? "e" : "a"}` : suf;
  return s + (up ? out.toLocaleUpperCase("tr") : out);
}

/* ---------- Kanun yolu güzergâhı ---------- */

export interface Route {
  kind: AppealKind;
  /** başvurunun incelendiği mahkeme / daire */
  court: string;
  courtShort: string;
  /** dilekçenin verildiği (aracı) mahkeme */
  via: string;
  rule: Omit<DeadlineRule, "teblig">;
  /** süre geçince dilekçeyi reddeden hüküm */
  rejectLaw: string;
  judges: number;
  benchTitle: string;
}

const RULES: Record<Regime, Record<AppealKind, Omit<DeadlineRule, "teblig">>> = {
  hmk: { istinaf: { weeks: 2, law: "HMK m.345", what: "istinaf dilekçesi" }, cevap: { weeks: 2, law: "HMK m.347", what: "cevap dilekçesi" }, temyiz: { weeks: 2, law: "HMK m.361", what: "temyiz dilekçesi" } },
  // İİK m.363 ve m.364: 7499 s.K. ile 1.6.2024'ten sonraki kararlarda süre tebliğden itibaren iki hafta (önceden on gün).
  iik: { istinaf: { weeks: 2, law: "İİK m.363", what: "istinaf dilekçesi" }, cevap: { weeks: 2, law: "HMK m.347 (İİK m.366)", what: "cevap dilekçesi" }, temyiz: { weeks: 2, law: "İİK m.364", what: "temyiz dilekçesi" } },
  // CMK m.273 ve m.291: 7499 s.K. ile süre, hükmün gerekçesiyle tebliğinden itibaren iki hafta (önceden yedi gün).
  cmk: { istinaf: { weeks: 2, law: "CMK m.273", what: "istinaf dilekçesi" }, cevap: { weeks: 2, law: "CMK m.277", what: "cevap dilekçesi" }, temyiz: { weeks: 2, law: "CMK m.291", what: "temyiz dilekçesi" } },
  iyuk: { istinaf: { days: 30, law: "İYUK m.45", what: "istinaf dilekçesi" }, cevap: { days: 30, law: "İYUK m.45/2, m.48", what: "cevap dilekçesi" }, temyiz: { days: 30, law: "İYUK m.46", what: "temyiz dilekçesi" } }
};
const REJECT: Record<Regime, { istinaf: string; temyiz: string }> = {
  hmk: { istinaf: "HMK m.346", temyiz: "HMK m.366" }, iik: { istinaf: "HMK m.346 (İİK m.366)", temyiz: "HMK m.366" },
  cmk: { istinaf: "CMK m.276", temyiz: "CMK m.296" }, iyuk: { istinaf: "İYUK m.45/2, m.48", temyiz: "İYUK m.48" }
};

/** Ana davanın bölge mahkemesi (istinaf) ve yüksek mahkeme (temyiz) güzergâhı. */
export function routeOf(base: CaseFile, kind: AppealKind): Route {
  const reg = regimeOf(base), tier = tierOf(base), city = cityOf(base.court);
  const vergi = /Vergi/.test(base.court);
  const bolge = reg === "iyuk" ? `${city ? city + " " : ""}Bölge İdare Mahkemesi ${vergi ? "Vergi" : "İdari"} Dava Dairesi`
    : `${city ? city + " " : ""}Bölge Adliye Mahkemesi ${reg === "cmk" ? "Ceza" : "Hukuk"} Dairesi`;
  const yuksek = reg === "iyuk" ? "Danıştay Dava Dairesi" : reg === "cmk" ? "Yargıtay Ceza Dairesi" : "Yargıtay Hukuk Dairesi";
  if (kind === "temyiz") {
    const via = tier === "bolge" ? base.court : base.appeal?.istinaf?.court || bolge;
    return { kind, court: yuksek, courtShort: reg === "iyuk" ? "DANIŞTAY · DAVA DAİRESİ" : `YARGITAY · ${reg === "cmk" ? "CEZA" : "HUKUK"} DAİRESİ`, via, rule: RULES[reg].temyiz, rejectLaw: REJECT[reg].temyiz, judges: 5, benchTitle: "Daire Başkanı ve dört üye" };
  }
  const court = (kind === "istinaf" ? base.appeal?.istinaf?.court : base.appeal?.cevap?.court) || bolge;
  return { kind, court, courtShort: reg === "iyuk" ? "BÖLGE İDARE · DAVA DAİRESİ" : `BAM · ${reg === "cmk" ? "CEZA" : "HUKUK"} DAİRESİ`, via: base.court, rule: RULES[reg][kind], rejectLaw: REJECT[reg].istinaf, judges: 3, benchTitle: "Daire Başkanı ve iki üye" };
}

/* ---------- Kesinlik ---------- */

/** open: false → reason; yarar: karar kesin değil, ama başvurmakta hukuki yarar yok */
export type Way = { open: true; note?: string } | { open: false; reason: string; yarar?: boolean };
export interface WayCheck { istinaf: Way; temyiz: Way }

const tl = (n: number) => n.toLocaleString("tr-TR") + " TL";

/**
 * Kanun yolu açık mı? Ana dava ve (varsa) kararın kuralı (outcome) ile istinaf aşamasının kararına (stage) bakar.
 * Parasal sınırlar sinirlar.ts'tedir; tutar girilmemişse sınır uygulanmaz ve not düşülür.
 */
export function kanunYolu(c: CaseFile, opts: { outcome?: Outcome; stage?: Outcome } = {}): WayCheck {
  const reg = regimeOf(c), tier = tierOf(c), d = c.kanunYolu || {};
  const o = opts.outcome, st = opts.stage;
  const year = d.yil || +(c.kararTarihi || "").slice(-4) || new Date().getFullYear();
  const lim = PARASAL_SINIR[year];
  const value = st?.deger ?? o?.deger ?? d.deger;
  const unknown = (what: string) => (value != null && lim && (lim as any)[what] == null ? `${year} yılı parasal sınırı tanımlı değil (sinirlar.ts); sınır denetimi yapılmadı.` : undefined);
  const no = (reason: string): Way => ({ open: false, reason });

  let istinaf: Way;
  if (tier !== "ilk") istinaf = no(tier === "bolge" ? "Bu karar zaten istinaf incelemesinde verildi." : "Bu mahkemenin kararına karşı istinaf yolu yoktur.");
  else if (d.kesin) istinaf = no(d.kesin);
  else if (o?.kesin) istinaf = no(o.kesin);
  else if (o?.yarar) istinaf = { open: false, reason: o.yarar, yarar: true };
  else if (reg === "iyuk" && d.ivedi) istinaf = no("İYUK m.20/A: ivedi yargılama usulüne tabi davalarda istinaf yolu yoktur; karar doğrudan Danıştay'da temyiz edilir.");
  else if ((reg === "hmk" || reg === "iik") && value != null && lim && (reg === "hmk" ? lim.hmkIstinaf : lim.iikIstinaf) != null && value <= (reg === "hmk" ? lim.hmkIstinaf! : lim.iikIstinaf!))
    istinaf = no(`${reg === "hmk" ? "HMK m.341/2" : "İİK m.363/1"}: değeri ${tl(reg === "hmk" ? lim.hmkIstinaf! : lim.iikIstinaf!)} geçmeyen ${reg === "hmk" ? "malvarlığı davalarına" : "icra mahkemesi işlerine"} ilişkin kararlar kesindir (${year}; uyuşmazlık değeri ${tl(value)}).`);
  else if (reg === "cmk" && o?.ceza?.adliParaTL != null && !o.ceza.hapisAy && o.ceza.adliParaTL <= CMK_SINIR.istinafAdliParaTL)
    istinaf = no(`CMK m.272/3-a: hükümde sonuç olarak belirlenen ${tl(CMK_SINIR.istinafAdliParaTL)} dahil adli para cezasına ilişkin hükümler kesindir.`);
  else if (reg === "cmk" && o?.ceza?.beraat && o.ceza.ustSinirGun != null && o.ceza.ustSinirGun <= CMK_SINIR.istinafBeraatUstSinirGun)
    istinaf = no(`CMK m.272/3-b: üst sınırı ${CMK_SINIR.istinafBeraatUstSinirGun} günü geçmeyen adli para cezasını gerektiren suçlardan beraat hükümleri kesindir.`);
  else istinaf = { open: true, note: reg === "hmk" || reg === "iik" ? unknown(reg === "hmk" ? "hmkIstinaf" : "iikIstinaf") : undefined };

  let temyiz: Way;
  const ceza = st?.ceza || o?.ceza;
  if (tier === "yuksek" || tier === "yok") temyiz = no("Bu mahkemenin kararına karşı olağan kanun yolu yoktur.");
  else if (st?.kesin) temyiz = no(st.kesin);
  else if (d.kesin) temyiz = no(d.kesin);
  else if (st?.karar === "gonderme" && reg !== "cmk") temyiz = no(reg === "iyuk" ? "İYUK m.45/5: görev, yetki ya da hâkimin reddi nedeniyle verilen kaldırma ve gönderme kararları kesindir." : "HMK m.353/1-a: esası incelenmeden verilen kaldırma ve gönderme kararları kesindir.");
  else if (reg === "hmk" || reg === "iik") {
    const L = reg === "hmk" ? lim?.hmkTemyiz : lim?.iikTemyiz;
    temyiz = value != null && L != null && value <= L
      ? no(`${reg === "hmk" ? "HMK m.362/1-a" : "İİK m.364/1"}: değeri ${tl(L)} geçmeyen davalarda bölge adliye mahkemesi kararları kesindir (${year}; uyuşmazlık değeri ${tl(value)}).`)
      : { open: true, note: unknown(reg === "hmk" ? "hmkTemyiz" : "iikTemyiz") };
  } else if (reg === "cmk") {
    const ac = /Ağır Ceza/.test(c.court) || (tier === "bolge" && !/Asliye/.test(JSON.stringify(c.docs)));
    if (ceza?.hapisAy != null) temyiz = ceza.hapisAy <= CMK_SINIR.temyizHapisAy
      ? no(`CMK m.286/2-a: ilk derece mahkemesince verilen ${CMK_SINIR.temyizHapisAy / 12} yıl veya daha az hapis cezalarına ilişkin bölge adliye mahkemesi hükümleri temyiz edilemez.`)
      : { open: true };
    else if (ceza?.adliParaTL != null || ceza?.beraat) temyiz = ac ? { open: true } : no("CMK m.286/2: bu nitelikteki hükümlere ilişkin bölge adliye mahkemesi kararları temyiz edilemez.");
    else temyiz = ac ? { open: true, note: "Hükmün türü dosyada yazılı değil; ağır ceza dosyası olduğu için temyiz açık kabul edildi." }
      : no("CMK m.286/2: asliye ceza mahkemesinin hükümlerine ilişkin bölge adliye kararlarının çoğu (ör. beş yıl veya daha az hapis) temyiz edilemez; bu dosyada temyiz kapalı kabul edildi.");
  } else {
    // İYUK: m.46/1'de sayılan davalar ile dairenin kaldırıp yeniden karar verdiği (m.46/2) davalar temyize açık; diğerleri kesin (m.45/6).
    const amount = value != null && lim?.iyukTemyiz != null && value > lim.iyukTemyiz;
    if (d.iyukBent || amount) temyiz = { open: true, note: d.iyukBent ? `İYUK m.46/1-${d.iyukBent}` : "İYUK m.46/1-b" };
    else if (st?.karar === "kaldirma" && !d.tekHakim) temyiz = { open: true, note: "İYUK m.46/2: daire ilk derece kararını kaldırıp yeniden karar verdi." };
    else temyiz = no(d.tekHakim && st?.karar === "kaldirma" ? "İYUK m.46/2-a: tek hâkimle çözümlenen davalarda dairenin yeniden verdiği karar da kesindir."
      : "İYUK m.45/6: m.46'da sayılan davalar dışında bölge idare mahkemesinin istinaf üzerine verdiği kararlar kesindir.");
  }
  return { istinaf, temyiz };
}

/** Forum yolunun Route biçimi (karar ekranı ve aşama dosyası için). */
export function forumRoute(w: ForumWay, kind: AppealKind): Route {
  return { kind, court: w.court, courtShort: w.courtShort, via: w.via, rule: { ...(w.months ? { months: w.months } : { days: w.days }), law: w.law, what: kind === "cevap" ? (w.cevapWhat || `${w.name}a cevap dilekçesi`) : (w.what || `${w.name} dilekçesi`) },
    rejectLaw: w.rejectLaw, judges: w.judges, benchTitle: w.benchTitle };
}

/* ---------- Sıradaki kanun yolu ---------- */

export interface NextAppeal {
  /** oyuncunun başlatabileceği aşama */
  offer?: { kind: AppealKind; route: Route; basic: boolean; note?: string; /** komisyon ve kurullarda düğme metni ("İtiraz et") */ label?: string };
  /** kanun yolu kapalı: "Bu karar kesindir: …" (yarar: hukuki yarar yok) */
  closed?: { kind: AppealKind; reason: string; yarar?: boolean };
}

const offIn = (c: CaseFile, k: AppealKind) => c.appeal?.off === true || (Array.isArray(c.appeal?.off) && c.appeal!.off.includes(k));
const matched = (c: CaseFile, g: GameState) => (g.fatal ? undefined : c.outcomes.find(o => test(o.if, g.flags)));

/** Oynanan dosyanın (ana dava ya da kanun yolu aşaması) kararından sonra açık olan kanun yolu.
 *  base: ana dava; side: oyuncunun ana davadaki tarafı; baseGame: ilk derece oyunu (aşamadan sonra temyiz için). */
export function nextAppeal(played: CaseFile, game: GameState, base: CaseFile, side: Side, baseGame?: GameState, winner?: Winner): NextAppeal {
  if (offIn(base, "istinaf") && offIn(base, "temyiz") && offIn(base, "cevap")) return {};
  if (game.fatal) return {};
  const v = { ...verdict(played, game), ...(winner ? { winner } : {}) };
  // Komisyon ve kurul kararları: itiraz (ve sigorta tahkiminde tutar yeterse Yargıtay'a temyiz).
  if (base.forum || forumWay(base, "istinaf")) {
    if (played.appealOf) {
      if (played.appealOf.kind === "temyiz" || v.winner === "p1") return {};
      const first = forumWay(base, "istinaf");
      if (!first || "closed" in first || first.next !== "temyiz") return {};
      const t = forumWay(base, "temyiz");
      if (!t) return {};
      if ("closed" in t) return { closed: { kind: "temyiz", reason: t.closed } };
      return { offer: { kind: "temyiz", route: forumRoute(t, "temyiz"), basic: true, note: t.note, label: "Temyize başvur" } };
    }
    if (base.mode === "duel" && v.winner === "draw") return {};
    const adverse = v.winner !== side, kind: AppealKind = adverse ? "istinaf" : "cevap";
    const fw = forumWay(base, kind);
    if (!fw || (!("closed" in fw) && fw.noCevap && kind === "cevap")) return {};
    if ("closed" in fw) return { closed: { kind, reason: fw.closed } };
    return { offer: { kind, route: forumRoute(fw, kind), basic: true, note: fw.note, label: adverse ? fw.button || `${fw.name[0].toLocaleUpperCase("tr")}${fw.name.slice(1)} et` : fw.cevapButton || `Karşı tarafın ${fw.name}ına cevap ver` } };
  }
  const baseOutcome = baseGame ? matched(base, baseGame) : played === base ? matched(base, game) : undefined;
  if (played.appealOf) {
    const kind = played.appealOf.kind;
    if (kind === "temyiz" || v.winner === "p1") return {};
    const st = matched(played, game);
    const w = kanunYolu(base, { outcome: baseOutcome, stage: st }).temyiz;
    if (!w.open) return { closed: { kind: "temyiz", reason: w.reason } };
    if (offIn(base, "temyiz")) return {};
    return { offer: { kind: "temyiz", route: routeOf(base, "temyiz"), basic: !base.appeal?.temyiz || side !== "p1", note: w.note } };
  }
  if (base.mode === "duel" && v.winner === "draw") return {};
  const tier = tierOf(base);
  const adverse = v.winner !== side;
  if (tier === "ilk") {
    const w = kanunYolu(base, { outcome: baseOutcome }).istinaf;
    const kind: AppealKind = adverse ? "istinaf" : "cevap";
    if (!w.open) return { closed: { kind, reason: w.reason, yarar: w.yarar } };
    if (offIn(base, kind)) return {};
    return { offer: { kind, route: routeOf(base, kind), basic: !base.appeal?.[kind] || side !== "p1", note: w.note } };
  }
  if (tier === "bolge" && adverse) {
    const w = kanunYolu(base, { outcome: baseOutcome }).temyiz;
    if (!w.open) return { closed: { kind: "temyiz", reason: w.reason } };
    if (offIn(base, "temyiz")) return {};
    return { offer: { kind: "temyiz", route: routeOf(base, "temyiz"), basic: !base.appeal?.temyiz || side !== "p1", note: w.note } };
  }
  return {};
}

/* ---------- Aşamanın dosyaya dönüştürülmesi ---------- */

const GENERIC_OPP: CastMember = { name: "Av. Selim Akın · Karşı taraf vekili", np: "green", look: { kind: "robe", collar: "avukat", skin: "#d2a079", hair: "#3a3a3a", style: "short", glasses: true } };

/** Ana davadan kanun yolu aşamasının dosyası. Elle yazılmış aşama (base.appeal[kind]) temel yolun yerine geçer.
 *  Elle yazılmış aşamalarda oyuncu ana davanın p1 tarafıdır; karşılıklı davada p2 tarafındaki oyuncuya temel yol oynatılır. */
export function appealCase(base: CaseFile, kind: AppealKind, ctx: { side?: Side; baseGame?: GameState; prev?: { c: CaseFile; game: GameState } } = {}): CaseFile {
  const side = ctx.side || "p1";
  const reg = regimeOf(base);
  const fw = forumWay(base, kind);
  if (fw && "closed" in fw || (!fw && base.forum)) throw new Error(`${base.id}: bu karara karşı ${kind} yolu yok`);
  const way = fw as ForumWay | null;
  const hand = side === "p1" && !way ? base.appeal?.[kind] : undefined;
  const stage = way ? forumStage(base, kind, side, way, keyIssue(base, side, ctx.baseGame, kind === "cevap"), ctx.baseGame ? safeHukum(base, ctx.baseGame) : "", dative, ctx.prev)
    : hand ? withHearingChoice(hand, kind, reg) : genericStage(base, kind, side, ctx.baseGame, ctx.prev);
  const route = way ? forumRoute(way, kind) : routeOf(base, kind);
  const mine = base.sides[side], theirs = base.sides[other(side)];
  const cast: Record<string, CastMember> = {};
  Object.entries(base.cast).forEach(([k, m]) => { if (k !== "p1" && k !== "p2") cast[k] = m; });
  // İlk derecedeki kişiler kanun yolunda da aynı kişilerdir (müvekkil, karşı taraf, tanıklar, karşı vekil): yüzleri ve sesleri değişmez.
  // Hâkim ve savcı üst mahkemenin kişileridir; onlar yenidir.
  const same: Record<string, string> = {};
  Object.keys(cast).forEach(k => { if (k !== "judge" && k !== "pros") same[k] = k; });
  if (base.mode === "duel" && base.cast[other(side)]) {
    // Karşılıklı davada karşı vekil öbür oyuncuydu: aynı kişi (aynı yüz), ada bağlı olmayan bir etiketle.
    cast.opp = { ...base.cast[other(side)], name: `${theirs.role.replace(/ vekili.*$/, "")} vekili` };
    same.opp = other(side);
  } else if (!cast.opp) cast.opp = { ...GENERIC_OPP, name: `Av. Selim Akın · ${theirs.role.replace(/ vekili.*$/, "")} vekili` };
  same.p1 = base.mode === "duel" ? side : "p1";
  same.party_p1 = `party_${side}`; same.party_p2 = `party_${other(side)}`;
  if (cast.judge) cast.judge = { ...cast.judge, name: way ? way.head : "Daire Başkanı" };
  if (cast.pros) cast.pros = { ...cast.pros, name: kind === "temyiz" ? "Yargıtay Cumhuriyet Savcısı" : "Cumhuriyet Savcısı" };
  Object.assign(cast, stage.cast || {});
  // Elle yazılmış aşama bir kişiyi başka biriyle değiştirdiyse (ad farklı) o kişi yeni sayılır.
  Object.keys(stage.cast || {}).forEach(k => { const b = same[k] && base.cast[same[k]]; if (b && b.name !== cast[k].name) delete same[k]; });
  const courtCast = stage.courtCast || ["judge", "you", "opp", ...(cast.pros && reg === "cmk" ? ["pros"] : []), ...(cast.client && kind !== "temyiz" ? ["client"] : [])];
  const level = Math.min(5, Math.max(courtLevel(stage.court), (base.career?.level || courtLevel(base.court)) + 1));
  const out = normalizeCase({
    id: `${base.id}~${kind}`, mode: "solo", title: base.title, area: base.area, color: base.color, difficulty: base.difficulty,
    court: stage.court, courtShort: stage.courtShort || route.courtShort,
    esas: stage.esas || stageEsas(base, kind), kararTarihi: stage.kararTarihi || stageDate(base, kind),
    teaser: stage.teaser || base.teaser,
    sides: { p1: { role: stage.role || roleFor(mine.role, kind), short: "Siz" }, p2: { role: stage.oppRole || theirs.role, short: "Karşı taraf" } },
    cast, courtCast, bench: stage.bench || { judges: route.judges, title: route.benchTitle }, room: way ? base.room || "tahkim" : "yuksek", ...(way && base.forum ? { forum: base.forum } : {}),
    inscription: stage.inscription === undefined ? base.inscription ?? "ADALET MÜLKÜN TEMELİDİR" : stage.inscription,
    evidence: stage.evidence, intro: stage.intro, docs: stage.docs || base.docs, steps: stage.steps,
    outcomes: stage.outcomes.map(o => ({ noCourt: true, ...o })),
    career: { off: true }, kanunYolu: base.kanunYolu,
    appealOf: { id: base.id, kind, basic: !hand, level, regime: way ? undefined : reg, same, baseDuel: base.mode === "duel", side }
  });
  if (out.appealOf) Object.defineProperty(out.appealOf, "base", { value: base, enumerable: false, configurable: true, writable: true });
  return out;
}

const roleFor = (role: string, kind: AppealKind) => `${role} · ${kind === "cevap" ? "istinafa cevap veren" : kind === "temyiz" ? "temyiz eden" : "istinaf eden"}`;
function stageEsas(base: CaseFile, kind: AppealKind) {
  const y = +(base.kararTarihi || "").slice(-4) || 2027;
  let h = 0; for (const ch of base.id + kind) h = (h * 31 + ch.charCodeAt(0)) % 9000;
  return `${y}/${1000 + h} Esas`;
}
function stageDate(base: CaseFile, kind: AppealKind) {
  const d = parseDate(base.kararTarihi) || parseDate("01.03.2027")!;
  let x = addDays(d, kind === "temyiz" ? 300 : 150);
  while (x.getUTCDay() === 0 || x.getUTCDay() === 6) x = addDays(x, 1);
  return fmtDate(x);
}

/* ---------- Dilekçe önizlemesi ---------- */

export interface Petition { title: string; meta: { k: string; v: string }[]; sections: { title: string; lines: string[] }[]; sign?: string }

/** Önizleme adımına kadar dilekçeye yazılanlar: her bölüm, adımların `section` başlığıyla ve seçilen cümlelerle. */
export function petitionOf(c: CaseFile, game: GameState, stepIdx: number): Petition {
  const st = c.steps[stepIdx];
  const sections: Petition["sections"] = [];
  game.log.forEach(e => {
    if (!e.doc || !e.doc.text) return;
    const s = sections.find(x => x.title === e.doc!.section);
    if (s) s.lines.push(e.doc.text); else sections.push({ title: e.doc.section, lines: [e.doc.text] });
  });
  return { title: st.paper?.title || "DİLEKÇE", meta: st.paper?.meta || [], sections, sign: st.paper?.sign };
}

/* ---------- Temel (otomatik) yol ---------- */

const W: Record<AppealKind, string> = { istinaf: "İstinaf", cevap: "İstinafa cevap", temyiz: "Temyiz" };

/** Ana davadaki kilit hukuki mesele: oyuncunun kaçırdığı (ya da kazandığı davada dayandığı) en değerli hamle. */
export function keyIssue(base: CaseFile, side: Side, game?: GameState, won = false): { law: string; text: string } {
  const cand = base.steps.map(s => {
    if (s.side !== side || !["choice", "evidence"].includes(kindOf(s))) return null;
    const pool = kindOf(s) === "evidence" ? (s.hit ? [{ text: s.statement ? `Karşı tarafın “${s.statement.text.slice(0, 90)}…” beyanı dosyadaki belgeyle çürütülmüştür` : "Karşı tarafın beyanı dosyadaki belgeyle çürütülmüştür", delta: s.hit.delta, law: s.hit.law } as Choice] : []) : s.choices;
    const best = [...pool].sort((a, b) => b.delta - a.delta)[0];
    if (!best || best.delta < 10 || !best.law) return null;
    const played = game?.log.find(e => e.prompt === s.prompt);
    return { best, missed: !!played && played.delta < best.delta, pickedBest: !!played && played.delta >= best.delta };
  }).filter(Boolean) as { best: Choice; missed: boolean; pickedBest: boolean }[];
  const pick = (won ? cand.filter(x => x.pickedBest) : cand.filter(x => x.missed)).sort((a, b) => b.best.delta - a.best.delta)[0]
    || [...cand].sort((a, b) => b.best.delta - a.best.delta)[0];
  if (!pick) return { law: base.area.split("·").pop()!.trim(), text: `İlk derece mahkemesi ${base.area.split("·").pop()!.trim().toLocaleLowerCase("tr")} konusunda dosyadaki delilleri hatalı değerlendirmiştir` };
  return { law: pick.best.law!, text: pick.best.text.replace(/\s+/g, " ").trim() };
}

const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n)).replace(/[,;:]$/, "") + "…");

/** Temel yol: davanın kendi hukuki meselesinden kısa bir kanun yolu aşaması. */
/** Duruşma istemi adımı: üst mahkeme incelemesi çoğunlukla dosya üzerinden yapılır; oyuncu duruşmalı ya da duruşmasız seçer.
 *  Duruşmasız seçilirse duruşma (salon) adımları atlanır ve karar dilekçeye göre verilir. */
function durusmaStep(kind: AppealKind, reg: Regime): Step {
  const durusmaLaw = kind === "temyiz" ? { hmk: "HMK m.369", iik: "HMK m.369", cmk: "CMK m.299", iyuk: "İYUK m.17" }[reg] : { hmk: "HMK m.353, m.356", iik: "HMK m.353, m.356", cmk: "CMK m.280-281", iyuk: "İYUK m.17" }[reg];
  return { side: "p1", scene: "office", section: "SONUÇ VE İSTEM", lines: [], prompt: "İncelemenin duruşmalı mı, duruşmasız mı yapılmasını istiyorsunuz?",
    choices: [
      { text: "Duruşmasız: dosya üzerinden inceleme yeterli; dilekçem sebeplerimi tam olarak anlatıyor.", delta: 0, set: ["durusmasiz"], law: durusmaLaw,
        doc: "İncelemenin dosya üzerinden yapılmasını talep ederiz.",
        note: kind === "temyiz"
          ? "Temyiz incelemesi kural olarak dosya üzerinden yapılır; duruşma yalnız kanunun aradığı hâllerde istem üzerine açılır."
          : "Üst mahkeme incelemesinin büyük bölümü dosya üzerinden yapılır; daire dilekçenize ve dosyaya bakarak karar verir. Sözlü açıklama hakkınız olmaz; dilekçeniz tek sözünüz olur." },
      { text: "Duruşmalı: duruşma yapılmasını ve sözlü açıklama hakkı tanınmasını talep etmek.", delta: 0, set: ["durusma"], law: durusmaLaw,
        doc: "Duruşma yapılmasını ve sözlü açıklamalarımızın dinlenmesini talep ederiz.",
        note: kind === "temyiz"
          ? "Temyizde duruşma istemi kanunun aradığı hâllerde kabul edilir; açılırsa sebeplerinizi sözlü olarak özetlersiniz."
          : "Daire duruşma açarsa vekiller sözlü açıklama yapar; dilekçede yazmadığınız yeni bir sebebi duruşmada ileri süremezsiniz." }
    ] };
}

/** Elle yazılmış aşamaya duruşma istemi sorusunu ekler: dilekçe önizlemesinden önce sorulur, sonraki salon adımları yalnız duruşma istenirse oynanır. */
function withHearingChoice(stage: AppealStage, kind: AppealKind, reg: Regime): AppealStage {
  const i = stage.steps.findIndex(st => st.kind === "dilekce");
  if (i < 0 || stage.steps.some(st => st.choices?.some(ch => ch.set?.includes("durusma")))) return stage;
  const steps = stage.steps.map((st, j) => j > i && st.scene === "court" ? { ...st, if: st.if ? `durusma && (${st.if})` : "durusma" } : st);
  steps.splice(i, 0, durusmaStep(kind, reg));
  return { ...stage, steps };
}

export function genericStage(base: CaseFile, kind: AppealKind, side: Side, baseGame?: GameState, prev?: { c: CaseFile; game: GameState }): AppealStage {
  const reg = regimeOf(base), fromBolge = tierOf(base) === "bolge";
  const route = { ...routeOf(base, kind), ...(kind === "temyiz" && prev ? { via: prev.c.court } : {}) };
  const mine = base.sides[side];
  const won = kind === "cevap";
  const issue = keyIssue(base, side, baseGame, won);
  const prevCourt = kind === "temyiz" ? (prev?.c.court || route.via) : base.court;
  const prevDate = kind === "temyiz" ? (prev?.c.kararTarihi || (fromBolge ? base.kararTarihi : stageDate(base, "istinaf"))) : base.kararTarihi;
  const teblig = suggestTeblig(prevDate, route.rule, reg, kind === "cevap" ? 34 : 16);
  const calc = lastDay({ ...route.rule, teblig }, reg);
  const firstHukum = baseGame ? safeHukum(base, baseGame) : "";
  const prevHukum = prev ? safeHukum(prev.c, prev.game) : fromBolge ? firstHukum : "";
  const kurum = reg === "iyuk" ? (kind === "temyiz" ? "Danıştay" : "bölge idare mahkemesi") : kind === "temyiz" ? "Yargıtay" : "bölge adliye mahkemesi";
  const sebepTitle = kind === "cevap" ? "CEVAPLARIMIZ" : kind === "temyiz" ? "TEMYİZ SEBEPLERİ" : "İSTİNAF SEBEPLERİ";
  const yasak = reg === "hmk" || reg === "iik" ? "HMK m.357" : reg === "cmk" ? "CMK m.280" : "İYUK m.45";
  const sayi = { hmk: "HMK m.353", iik: "HMK m.353 (İİK m.366)", cmk: "CMK m.280", iyuk: "İYUK m.45" }[reg];
  const temyizLaw = { hmk: "HMK m.369-371", iik: "HMK m.369-371 (İİK m.366)", cmk: "CMK m.288, m.302", iyuk: "İYUK m.49" }[reg];

  const intro = [
    { who: "narr", text: kind === "cevap"
      ? `${base.court} ${base.kararTarihi} tarihli kararıyla davayı müvekkiliniz lehine sonuçlandırdı.${firstHukum ? ` Hüküm: “${clip(firstHukum, 170)}”` : ""} Karşı taraf kararı istinaf etti.`
      : kind === "temyiz"
        ? `${prevCourt} ${prevDate} tarihli kararıyla istinaf incelemesini müvekkiliniz aleyhine sonuçlandırdı.${prevHukum ? ` “${clip(prevHukum, 170)}”` : ""}`
        : `${base.court} ${base.kararTarihi} tarihli kararıyla müvekkiliniz aleyhine hüküm kurdu.${firstHukum ? ` “${clip(firstHukum, 170)}”` : ""}` },
    { who: "narr", text: kind === "cevap" ? `Karşı tarafın istinaf dilekçesi size ${fmtDate(calc.teblig)} tarihinde tebliğ edildi. Cevap dilekçenizi hazırlayacaksınız.`
      : `Gerekçeli karar size ${fmtDate(calc.teblig)} tarihinde tebliğ edildi. ${kind === "temyiz" ? "Temyiz" : "İstinaf"} dilekçenizi hazırlayacaksınız.` },
    { who: "narr", text: "Bu aşama dosyanın kendi hukuki meselesinden otomatik kurulan temel bir kanun yolu aşamasıdır." }
  ];

  const lateFatal = kind !== "cevap";
  const date: Step = {
    kind: "date", side: "p1", scene: "office", lines: [],
    deadline: { ...route.rule, teblig },
    prompt: `${route.rule.what![0].toLocaleUpperCase("tr") + route.rule.what!.slice(1)} için son gün hangisi? Tebliğ: ${longDate(calc.teblig)}. Son günü yazın.`,
    choices: [
      { text: "Doğru gün", min: 100, delta: 10, set: ["sure"], law: route.rule.law, note: "Süreyi doğru hesapladınız." },
      { text: "Erken gün", min: 50, delta: -5, set: ["sure"], law: route.rule.law, note: "Dilekçe yine süresinde verilir; ama son günü yanlış hesapladınız. Bir avukatın süreyi gününe kadar bilmesi gerekir." },
      lateFatal
        ? { text: "Süre geçti", min: 0, delta: -25, law: `${route.rule.law}, ${route.rejectLaw}`,
            note: "Süre kaçtı. Süreden sonra verilen dilekçe, kararı veren mahkemece reddedilir.",
            fatal: { label: "SONUÇ:", hukum: `${W[kind]} dilekçesinin süresinde verilmediğinden REDDİNE karar verildi.`,
              summary: `${route.rule.law} uyarınca süre ${calc.label} olup son gün ${longDate(calc.last)} idi. Süreden sonra verilen dilekçe reddedilir (${route.rejectLaw}). Karar bu yönden kesinleşti.` } }
        : { text: "Süre geçti", min: 0, delta: -15, set: ["gec"], law: route.rule.law,
            note: "Cevap süresini kaçırdınız. Cevap dilekçesi verilmese de inceleme yapılır, ama daire karşı tarafın sebeplerini sizin cevabınız olmadan değerlendirir." }
    ]
  };

  const viaUp = route.via.toLocaleUpperCase("tr"), courtUp = route.court.toLocaleUpperCase("tr");
  const merci: Step = {
    side: "p1", scene: "office", section: "MERCİ", lines: [],
    prompt: `${kind === "cevap" ? "Cevap dilekçesini" : "Dilekçeyi"} kime hitaben yazacak, nereye vereceksiniz?`,
    choices: [
      { text: `${dative(route.court)} gönderilmek üzere, kararı veren ${dative(route.via)} verin.`, delta: 10, set: ["merci"], doc: `${dative(viaUp)}\nGönderilmek üzere\n${dative(courtUp)}`,
        law: kind === "temyiz" ? ({ hmk: "HMK m.364", iik: "HMK m.364", cmk: "CMK m.291", iyuk: "İYUK m.48" }[reg]) : ({ hmk: "HMK m.342-344", iik: "HMK m.342-344", cmk: "CMK m.273", iyuk: "İYUK m.45/2" }[reg]),
        note: `Doğru. Dilekçe kararı veren mahkemeye verilir; dosya incelenmek üzere ${kurum} gönderilir.` },
      kind === "temyiz"
        ? { text: `Temyizden önce Anayasa Mahkemesi'ne bireysel başvuru yapın; ${kurum} sonra karar verir.`, delta: -10, doc: "ANAYASA MAHKEMESİ BAŞKANLIĞINA",
            law: "6216 s.K. m.45/2", note: "Bireysel başvuru ancak olağan kanun yolları tüketildikten sonra yapılabilir (6216 s.K. m.45/2). Önce temyiz." }
        : { text: `İlk derece kararı olduğu için doğrudan ${reg === "iyuk" ? "Danıştay'a" : "Yargıtay'a"} temyiz dilekçesi verin, daha etkilidir.`, delta: -10, doc: reg === "iyuk" ? "DANIŞTAY BAŞKANLIĞINA" : "YARGITAY BAŞKANLIĞINA",
            law: reg === "iyuk" ? "İYUK m.45, m.46" : reg === "cmk" ? "CMK m.272, m.286" : "HMK m.341, m.361",
            note: "İlk derece kararına karşı yol istinaftır; temyiz, bölge mahkemesinin istinaf üzerine verdiği kararlara karşı açılır. Yanlış adlandırılan dilekçe uygulamada istinaf sayılabilir; ama bu bir avukatın yapmaması gereken bir hatadır." },
      { text: `Kararı veren ${dative(route.via)}, kararını yeniden gözden geçirmesi için itiraz dilekçesi verin.`, delta: -10, doc: `${dative(viaUp)}\n(İtiraz)`,
        law: reg === "cmk" ? "CMK m.267" : "HMK m.294", note: "Hükmü veren mahkeme verdiği nihai kararı kendisi değiştiremez; itiraz bu karara karşı bir yol değildir. Yol, üst mahkemeye başvurudur." }
    ]
  };

  const groundRaw = kind === "cevap" ? `İlk derece kararı ${issue.law} yönünden isabetlidir: ${issue.text}` : `${issue.law} yönünden hukuka aykırılık: ${issue.text}`;
  const wrongs: Choice[] = [
    (reg === "hmk" || reg === "iik")
      ? { text: "İlk derecede hiç bildirilmeyen yeni tanıkları ve yeni belgeleri dilekçeye ekleyip olayı baştan ispat edeceğimizi yazmak.", delta: -10, law: "HMK m.357",
          doc: "Yargılamada bildirilmeyen yeni tanıklarımızın dinlenmesini ve ekli yeni belgelerin incelenmesini talep ederiz.",
          note: "Kanun yolunda, ilk derecede ileri sürülmeyen iddia ve savunmalar dinlenmez, yeni delile dayanılamaz (HMK m.357; kendiliğinden göz önünde tutulacak hususlar ve mücbir sebep hariç)." }
      : { text: "Mahkeme başkanının duruşmadaki sert üslubunu, hükmü etkileyen bir usul hatası göstermeden dilekçenin merkezine koymak.", delta: -5, law: sayi,
          doc: "Duruşmada mahkeme başkanı müvekkilimize karşı sert bir üslup kullanmıştır.",
          note: "Üslup, hükmün hukuka aykırılığını göstermez. Daire, kararın hangi yönden usule ya da yasaya aykırı olduğunu görmek ister." },
    { text: `Kararın adalete ve hakkaniyete aykırı olduğunu, hangi yönden hukuka aykırı bulunduğunu göstermeden genel bir itirazla belirtmek.`, delta: -10,
      law: reg === "hmk" || reg === "iik" ? "HMK m.342/2-ç, m.355" : sayi,
      doc: "Karar adalete ve hakkaniyete aykırıdır; kaldırılması gerekir.",
      note: "Gerekçesiz bir itiraz daireyi ikna etmez. Dilekçede sebep ve gerekçe somut olarak gösterilmeli; hukuk yargılamasında inceleme de kural olarak dilekçedeki sebeplerle sınırlıdır (HMK m.355)." },
    { text: "Karşı taraf vekilinin duruşmadaki tavrını ve tutanağa geçmemiş sözlerini dilekçenin ana sebebi yapmak; heyet bunu dikkate alır.", delta: -5,
      doc: "Karşı taraf vekilinin duruşmadaki tavrı müvekkilimizi etkilemiştir.",
      note: "Tutanağa geçmeyen bir söz ve karşı vekilin tavrı, kararın hukuka aykırılığını göstermez." }
  ];
  const longest = Math.max(...wrongs.map(w => w.text.length));
  const sebep: Step = {
    side: "p1", scene: "office", section: sebepTitle, lines: [],
    prompt: kind === "cevap" ? "Cevap dilekçenizin merkezine neyi koyacaksınız?" : `${kind === "temyiz" ? "Temyiz" : "İstinaf"} sebebiniz ne olacak?`,
    choices: [
      { text: clip(groundRaw, Math.floor(longest * 1.1)), delta: 20, set: ["sebep"], law: issue.law, doc: groundRaw + ".",
        note: kind === "cevap" ? `Doğru. Kararın dayandığı hukuki değerlendirmeyi (${issue.law}) savunarak karşı tarafın sebeplerini karşıladınız.`
          : `Doğru. Kararı, davanın kilit hukuki meselesinden (${issue.law}) eleştirdiniz; ${kurum} bu yönden inceleme yapacak.` },
      ...(kind === "cevap" ? wrongs.map(w => w.law === "HMK m.357"
        ? { ...w, text: "İlk derecede ileri sürmediğimiz yeni bir savunmayı ve yeni belgeleri cevap dilekçesinde ilk kez ileri sürmek.", doc: "İlk derecede ileri sürmediğimiz yeni savunmamızı ve ekli belgeleri sunarız." }
        : w.doc!.startsWith("Karar adalete") ? { ...w, text: "Kararın doğru olduğunu, karşı tarafın sebeplerine tek tek cevap vermeden ve gerekçe göstermeden kısaca belirtmek.", doc: "İlk derece kararı usul ve yasaya uygundur.",
            note: "Karşı tarafın sebeplerine cevap vermeyen bir dilekçe daireye yardımcı olmaz; kararın neden doğru olduğunu hukuki dayanağıyla göstermelisiniz." } : w) : wrongs)
    ]
  };

  const talepOk: Record<AppealKind, Choice> = {
    istinaf: { text: reg === "cmk" ? "Hükmün kaldırılmasına, duruşma açılarak sanık lehine yeniden hüküm kurulmasına." : "İlk derece kararının kaldırılmasına ve yeniden esas hakkında müvekkil lehine karar verilmesine.",
      delta: 10, set: ["talep"], law: reg === "cmk" ? "CMK m.280" : reg === "iyuk" ? "İYUK m.45/4" : "HMK m.353/1-b-2",
      note: reg === "cmk" ? "Doğru. Daire duruşma açıp ilk derece hükmünü kaldırarak yeniden hüküm kurabilir (CMK m.280)." : "Doğru. Daire, kararı hukuka aykırı bulursa kaldırır ve davanın esası hakkında yeniden karar verir." },
    cevap: { text: "Karşı tarafın istinaf başvurusunun esastan reddine ve ilk derece kararının aynen korunmasına.", delta: 10, set: ["talep"],
      law: reg === "cmk" ? "CMK m.280/1-a" : reg === "iyuk" ? "İYUK m.45/3" : "HMK m.353/1-b-1", note: "Doğru talep: istinaf başvurusunun esastan reddi." },
    temyiz: { text: `${prevCourt.split(" ").slice(-2).join(" ")} kararının bozulmasına ve dosyanın yeniden incelenmek üzere gönderilmesine.`, delta: 10, set: ["talep"],
      law: temyizLaw, note: `Doğru. Temyiz incelemesinde ${kurum} kararı onar ya da bozar; esas hakkında kural olarak yeniden yargılama yapmaz.` }
  };
  const talepWrong: Choice[] = [
    { text: "Dosyanın yargılamanın yenilenmesi yoluyla, aynı mahkemede baştan görülmesine karar verilmesine.", delta: -10, law: reg === "cmk" ? "CMK m.311" : reg === "iyuk" ? "İYUK m.53" : "HMK m.374-375",
      note: "Yargılamanın yenilenmesi, kesinleşmiş kararlara karşı sınırlı sebeplerle açılan olağanüstü bir yoldur; kanun yolu dilekçesinin talebi olamaz." },
    { text: "Kararı veren hâkimin değiştirilmesine ve dosyanın başka bir yer mahkemesine nakline karar verilmesine.", delta: -10, law: reg === "cmk" ? "CMK m.24" : "HMK m.36",
      note: "Hâkimin reddi ve davanın nakli ayrı kurumlardır; somut bir sebep olmadan kanun yolunda istenemez ve kararın hukuka aykırılığını gidermez." },
    kind === "cevap"
      ? { text: "İstinaf başvurusunun kabulüne, ancak kararın gerekçesinin müvekkil lehine düzeltilerek onanmasına.", delta: -5,
          note: "Cevap veren taraf olarak istinaf başvurusunun reddini istemelisiniz; başvurunun kabulünü istemek kendi kazanımınızı tartışmaya açar." }
      : { text: "Kararın düzeltilerek onanmasına; böylece hiç değilse yargılama giderleri azalır.", delta: -5,
          note: "Düzelterek onama ya da düzelterek esastan ret kararın sonucunu korur; aleyhinize olan hükmü ortadan kaldırmaz." }
  ];
  const talep: Step = { side: "p1", scene: "office", section: "SONUÇ VE İSTEM", lines: [], prompt: "Sonuç ve isteminizi nasıl yazacaksınız?",
    choices: [talepOk[kind], ...talepWrong].map(ch => ({ ...ch, doc: ch.text })) };

  const durusma = durusmaStep(kind, reg);

  const paper: Step = {
    kind: "dilekce", side: "p1", scene: "office", lines: [{ who: "narr", text: "Dilekçeniz hazır. Sunmadan önce son bir kez okuyun." }],
    prompt: "Dilekçeyi gözden geçirin.", choices: [],
    paper: { title: kind === "cevap" ? "İSTİNAF DİLEKÇESİNE CEVAP" : kind === "temyiz" ? "TEMYİZ DİLEKÇESİ" : "İSTİNAF DİLEKÇESİ",
      meta: [
        { k: "Dosya", v: base.esas },
        { k: kind === "cevap" ? "Cevap veren" : kind === "temyiz" ? "Temyiz eden" : "İstinaf eden", v: mine.role.replace(/ vekili.*$/, "") },
        { k: "Karşı taraf", v: base.sides[other(side)].role.replace(/ vekili.*$/, "") },
        { k: kind === "cevap" ? "İstinaf dilekçesinin tebliği" : "Kararın tebliği", v: fmtDate(calc.teblig) },
        { k: "Karar", v: `${prevCourt} · ${prevDate}` }
      ], sign: mine.role } };

  const pros = reg === "cmk" && !!base.cast.pros;
  const hearing: Step = {
    if: "durusma", side: "p1", scene: "court",
    lines: [
      ...(kind === "temyiz"
        ? [{ who: "narr", text: `Dosya temyiz incelemesi için heyetin önünde. Duruşma yalnız kanunun aradığı hâllerde istem üzerine yapılır (${{ hmk: "HMK m.369", iik: "HMK m.369", cmk: "CMK m.299", iyuk: "İYUK m.17" }[reg]}); yapılmazsa daire dosya üzerinden karar verir. Bu aşama, vekilin sebeplerini heyete özetlediği kısa bir oturumla canlandırılıyor.` }]
        : reg === "iyuk" ? [{ who: "narr", text: "İstinaf dilekçesinde duruşma istendi; daire taraf vekillerini dinlemek için duruşma yaptı (İYUK m.17)." }] : []),
      { who: "judge", text: kind === "cevap" ? "Duruşmayı açıyorum. İstinaf eden vekil sebeplerini açıkladı. Cevap veren vekil, beyanlarınız?" : kind === "temyiz" ? "Duruşmayı açıyorum. Vekil, temyiz sebeplerinizi kısaca özetleyin." : "Duruşmayı açıyorum. İstinaf eden vekil, sebeplerinizi kısaca açıklayın." }
    ],
    prompt: "Daireye ne söyleyeceksiniz?",
    choices: [
      { text: "Dilekçedeki sebebe bağlı kalıp hukuka aykırılığı ve bunun kararın sonucuna etkisini kısa ve somut anlatmak.", delta: 15, set: ["sozlu"], law: sayi,
        note: "Doğru. Üst mahkeme duruşmasında vekil, dilekçesindeki sebepleri özetler ve kararın sonucunu nasıl etkilediğini gösterir.",
        reply: [{ who: "judge", text: "Beyanlarınız tutanağa geçti." }] },
      { text: "Müvekkilin yaşadığı mağduriyeti ve kararın adaletsizliğini, hukuki dayanak göstermeden duygusal bir dille anlatmak.", delta: -5,
        note: "Heyet mağduriyeti anlar; ama karar hukuka aykırılık üzerinden verilir. Dilekçedeki sebebi özetlemeniz gerekirdi.",
        reply: [{ who: "judge", text: "Sayın vekil, lütfen dilekçenizdeki sebeplere dönün." }] },
      { text: "Dilekçede yazmadığınız yeni bir vakıayı ve yeni bir sebebi duruşmada ilk kez ileri sürüp heyeti şaşırtmak.", delta: -10, law: yasak,
        note: reg === "hmk" || reg === "iik" ? "İnceleme dilekçedeki sebeplerle sınırlıdır (HMK m.355); ilk derecede ileri sürülmeyen vakıa dinlenmez (HMK m.357)." : "Dilekçede bildirilmeyen yeni bir vakıayı duruşmada ilk kez ileri sürmek karşı tarafın savunma hakkını zedeler ve heyeti ikna etmez.",
        reply: [{ who: pros ? "pros" : "opp", text: "Bu husus dilekçede yok; dikkate alınmamasını talep ediyoruz." }] }
    ]
  };

  const lawWin = { hmk: "HMK m.353/1-b-2", iik: "HMK m.353/1-b-2", cmk: "CMK m.280/2", iyuk: "İYUK m.45/4" }[reg];
  const lawRet = { hmk: "HMK m.353/1-b-1", iik: "HMK m.353/1-b-1", cmk: "CMK m.280/1-a", iyuk: "İYUK m.45/3" }[reg];
  let outcomes: Outcome[];
  if (kind === "istinaf") outcomes = [
    { if: "sebep && (talep || sozlu)", winner: "p1", stamp: "KALDIRMA", karar: "kaldirma", label: "HÜKÜM:",
      hukum: `İstinaf başvurusunun KABULÜ ile ${base.court} kararının ${lawWin} uyarınca KALDIRILMASINA, ${reg === "cmk" ? "Dairemizce yapılan duruşma sonunda sanık hakkında yeniden hüküm kurulmasına" : "davanın yeniden esas hakkında karar verilerek müvekkil lehine sonuçlandırılmasına"}; oy birliğiyle karar verildi.`,
      summary: [{ text: `Daire, ilk derece kararını ${issue.law} yönünden isabetsiz buldu.` }, { if: "!merci", text: " Dilekçenin yanlış merciye yöneltilmesi sonucu değiştirmedi; ama süre riski yarattı." }, { if: "!talep", text: " Talebiniz eksikti; daire hukuka aykırılığı kendiliğinden gözeterek karar verdi." }] },
    { winner: "p2", stamp: "ESASTAN RET", karar: "ret", label: "HÜKÜM:",
      hukum: `İstinaf başvurusunun ${lawRet} uyarınca ESASTAN REDDİNE; oy birliğiyle karar verildi.`,
      summary: [{ if: "!sebep", text: `Dilekçe dosyadaki kilit meseleye (${issue.law}) dayanmadı; daire ilk derece kararında kaldırmayı gerektiren bir hukuka aykırılık görmedi.` },
        { if: "sebep && durusma", text: `Doğru sebebi gösterdiniz; ama talebiniz de duruşmadaki beyanınız da bu sebebi daireye taşıyamadı.` },
        { if: "sebep && !durusma", text: `Doğru sebebi gösterdiniz; ama sonuç ve isteminiz bu sebebi daireye taşıyamadı. Dosya üzerinden incelemede dilekçe tek sözünüzdür.` }] }
  ];
  else if (kind === "cevap") outcomes = [
    { if: "sebep && (talep || sozlu)", winner: "p1", stamp: "ESASTAN RET", karar: "ret", label: "HÜKÜM:",
      hukum: `Karşı tarafın istinaf başvurusunun ${lawRet} uyarınca ESASTAN REDDİNE; oy birliğiyle karar verildi.`,
      summary: [{ text: `Daire, ilk derece kararının ${issue.law} yönünden isabetli olduğunu kabul etti; karar müvekkil lehine korundu.` }, { if: "gec", text: " Cevap süresini kaçırmanıza rağmen kararın gerekçesi yeterince güçlüydü." }] },
    { winner: "p2", stamp: "KALDIRMA", karar: "kaldirma", label: "HÜKÜM:",
      hukum: `Karşı tarafın istinaf başvurusunun KABULÜ ile ${base.court} kararının ${lawWin} uyarınca KALDIRILMASINA ve yeniden hüküm kurulmasına; oy birliğiyle karar verildi.`,
      summary: [{ text: "Daire karşı tarafın sebeplerini yerinde buldu; ilk derecede kazandığınız karar kaldırıldı." }, { if: "!sebep", text: ` Cevabınız kararın dayandığı hukuki değerlendirmeyi (${issue.law}) savunmadı.` }, { if: "gec", text: " Cevap dilekçesini de süresinde vermediniz." }] }
  ];
  else outcomes = [
    { if: "sebep && (talep || sozlu)", winner: "p1", stamp: "BOZMA", karar: "bozma", label: "HÜKÜM:",
      hukum: `Temyiz isteminin KABULÜ ile ${prevCourt} kararının ${temyizLaw} uyarınca BOZULMASINA, dosyanın yeniden incelenmek ve karar verilmek üzere gönderilmesine; oy birliğiyle karar verildi.`,
      summary: [{ text: `${kurum[0].toLocaleUpperCase("tr") + kurum.slice(1)}, ${issue.law} yönünden kararı hukuka aykırı buldu.` }] },
    { winner: "p2", stamp: "ONAMA", karar: "onama", label: "HÜKÜM:", kesin: "Temyiz incelemesi sonunda verilen onama kararıyla hüküm kesinleşti.",
      hukum: `Temyiz isteminin REDDİ ile ${prevCourt} kararının ONANMASINA; oy birliğiyle kesin olarak karar verildi.`,
      summary: [{ if: "!sebep", text: `Temyiz dilekçesi dosyanın kilit meselesine (${issue.law}) dayanmadı.` }, { if: "sebep", text: "Doğru sebebi gösterdiniz; ama heyet kararın sonucunu etkileyecek bir hukuka aykırılık görmedi." }] }
  ];
  return { court: route.court, courtShort: route.courtShort, intro, steps: [date, merci, sebep, talep, durusma, paper, hearing], outcomes };
}

function safeHukum(c: CaseFile, g: GameState) { try { return verdict(c, g).hukum.replace(/\s+/g, " ").trim(); } catch { return ""; } }

/** Dosyadaki bütün kanun yolu aşamalarını (elle yazılmış ve temel) üretip döndürür; doğrulama ve testler için. */
export function allStages(base: CaseFile): CaseFile[] {
  if (base.forum || forumWay(base, "istinaf")) return (["istinaf", "cevap", "temyiz"] as AppealKind[]).filter(k => { const w = forumWay(base, k); return !!w && !("closed" in w) && !(k === "cevap" && w.noCevap) && (k !== "temyiz" || base.forum === "sigorta"); })
    .map(k => appealCase(base, k, { side: "p1" }));
  const tier = tierOf(base);
  const kinds: AppealKind[] = tier === "ilk" ? ["istinaf", "cevap", "temyiz"] : tier === "bolge" ? ["temyiz"] : [];
  return kinds.filter(k => !offIn(base, k)).map(k => appealCase(base, k, { side: "p1" }));
}

/** Elle yazılmış ve temel bütün aşamaların motor denetimi: hata listesi (dosya kimliğiyle). */
export function validateAppeals(base: CaseFile, validate: (c: CaseFile) => string[]): string[] {
  const errs: string[] = [];
  for (const k of ["istinaf", "cevap", "temyiz"] as AppealKind[]) {
    const hand = base.appeal?.[k];
    if (!hand) continue;
    if (!hand.court) errs.push(`appeal.${k}: mahkeme (court) yazılmalı`);
    if (!hand.steps?.length) errs.push(`appeal.${k}: en az bir adım olmalı`);
    if (!hand.outcomes?.length) errs.push(`appeal.${k}: en az bir karar kuralı olmalı`);
    if (!hand.steps?.some(s => s.kind === "date")) errs.push(`appeal.${k}: süre adımı (kind: "date") olmalı; oyuncu son günü yazar`);
    if (!hand.steps?.some(s => s.kind === "dilekce")) errs.push(`appeal.${k}: dilekçe önizlemesi (kind: "dilekce") olmalı`);
  }
  if (errs.length) return errs;
  for (const s of allStages(base)) validate(s).forEach(e => errs.push(`${s.appealOf!.kind}${s.appealOf!.basic ? " (temel)" : ""}: ${e}`));
  return errs;
}
