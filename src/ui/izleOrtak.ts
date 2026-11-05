// "Duruşmayı izle" ortak parçaları: kadro (yüzler ve sesler), rol adları, sahne başlıkları, adımlar, sesli kayıt/video parçaları
// ve tutanak metni. Ekrandaki oynatıcı (DanismaWatch), MP3 ve video (izleVideo) aynı bilgiyi kullanır.
// Sahneler oyunun kendi sahnesiyle çizilir: senaryodan oyundaki gibi bir dava dosyası (CaseFile) kurulur, yüzler oyunun havuzlarından
// (castFaces) gelir; büro görüşmesi oyundaki görüşme odası, duruşma o mahkeme türünün oyundaki salonudur (stageLayout).
// Eğitim amaçlı canlandırmadır, hukuki görüş değildir; karakterler gerçek avukat değildir.
import type { Danisma, Kim, SahneTur, Senaryo } from "../data/danisma";
import { alanAdi } from "../data/danisma";
import type { CaseFile, Look, Scene } from "../engine/types";
import { locale, t } from "../i18n";
import { castFaces, faceFemale, hash, LAWYER } from "./castFaces";
import { nameGender } from "./castText";
import type { PhotoKey } from "./photos";
import { Speaker, voiceOf } from "./voice";

export const UYARI_KISA = "Eğitim amaçlı canlandırmadır, hukuki görüş değildir. Oyuncular/karakterler gerçek avukat değildir.";

export interface Kadro {
  /** Senaryodan kurulan, oyundaki gibi dava dosyası (yalnız sahne çizimi için: kadro, mahkeme, salon). */
  c: CaseFile;
  /** Sahnedeki yüzler (oyunun kadro anahtarlarıyla: p1, opp, judge, client, karşı taraf, kâtip...). */
  faces: Record<string, PhotoKey>;
  /** Karşı tarafın kadrodaki anahtarı ("karsiTaraf"; karşı taraf savcıysa "savci"). */
  kt: string;
  /** Konuşanların yüzü. */
  yuz: Record<Kim, PhotoKey>;
  /** Her konuşanın sesi (bulut sesi adı farklı olacak biçimde seçilir; cinsiyet yüze uyar). */
  ses: Record<Kim | "narr", Speaker>;
}

/* ---------- cinsiyet: metinden, yoksa danışmaya bağlı sabit bir seçim ---------- */
const L = "a-zçğıöşüâîû";
const w = (re: string) => new RegExp(`(^|[^${L}])(${re})(?=[^${L}]|$)`, "g");
const KADIN_BEN = w("kocam(ın|la|dan|a|ı|ız)?|eski kocam\\S*|hamile(yim|yken|ydim)?|gebe(yim|yken|liğim\\S*)?|lohusa\\S*|doğum izn\\S*|doğum yaptı\\S*|annesiyim|anne olarak|kadın olarak|bir kadınım|kızlık soyad\\S*");
const ERKEK_BEN = w("karım(ın|la|dan|a|ı)?|eski karım\\S*|hanımım\\S*|babasıyım|baba olarak|erkek olarak|bir erkeğim|askerlik\\S*|askere|askerde\\S*");
const say = (re: RegExp, x: string) => (x.toLocaleLowerCase("tr").match(re) || []).length;
/** Satırlardaki hitaplar: "… Hanım", "hanımefendi" ya da "… Bey", "beyefendi". */
const hitap = (x: string) => ({ f: say(w("hanım(efendi)?(ın|a|ı|la|cığım)?"), x), m: say(w("bey(efendi)?(in|e|i|le)?"), x) });
const karar = (f: number, m: number): boolean | undefined => (f > m ? true : m > f ? false : undefined);

/** Karşı tarafı anlatan ipuçları. Akrabalık sözleri ("kocam", "eski karım") olay ve karşı taraf kutusunda, genel sözler
 *  ("adam", "kadın", "… Bey", "… Hanım") yalnız karşı tarafın argümanları kutusunda aranır (olayda tanık ya da danışan için de geçebilir). */
const KARSI_ERKEK_AKRABA = w("kocam(ın|la|dan|a|ı)?|eski kocam\\S*|eski eşim olan adam");
const KARSI_KADIN_AKRABA = w("karım(ın|la|dan|a|ı)?|eski karım\\S*");
const KARSI_ERKEK = w("adam(ın|a|ı)?|bey(in|e|i)?|beyefendi");
const KARSI_KADIN = w("kadın(ın|a|ı)?|hanım(ın|a|ı)?|hanımefendi");

/** Danışanın (biz) ve karşı tarafın cinsiyeti: görüşmede avukatın hitabı, danışma metnindeki birinci tekil ipuçları
 *  ("kocam", "hamileyken", "karım", "askerlik"), karşı tarafın rol adı ("eşi", "baba") ve danışanın karşı taraf için yazdıkları.
 *  Anlaşılmazsa undefined. bizBilinen: danışanın cinsiyeti karakterinden ya da hesabından biliniyorsa (eş davasında karşı taraf öbürüdür). */
export function tarafCinsiyeti(s: Senaryo, d: Danisma, bizBilinen?: boolean): { biz?: boolean; karsi?: boolean } {
  const satir = (tur: SahneTur, kim: Kim) => s.sahneler.filter(x => x.tur === tur).flatMap(x => x.satirlar).filter(l => l.kim === kim).map(l => l.metin).join(" ");
  const hb = hitap(satir("gorusme_biz", "bizAvukat")), hk = hitap(satir("gorusme_karsi", "karsiAvukat"));
  const benim = [d.olay, d.talep, d.deliller, ...s.sahneler.flatMap(x => x.satirlar).filter(l => l.kim === "biz").map(l => l.metin)].join(" ");
  // Danışanın kendi metni (birinci tekil ipuçları) avukatın hitabından önce gelir: hitabı model yazar, metni danışan.
  const biz = karar(say(KADIN_BEN, benim), say(ERKEK_BEN, benim)) ?? karar(hb.f, hb.m);
  const rol = (s.roller?.karsiTaraf || "").toLocaleLowerCase("tr");
  const bilinen = bizBilinen ?? biz;
  let karsi: boolean | undefined;
  if (w("kadın(ı)?|anne(si)?|kız(ı|kardeş\\S*)?|karı(sı)?|hanım(ı)?").test(rol)) karsi = true;
  else if (w("erkek|baba(sı)?|koca(sı)?|oğul|oğlu|bey(i)?").test(rol)) karsi = false;
  else if (bilinen !== undefined && w("eş(i|im|iniz)?|davalı eş|davacı eş").test(rol)) karsi = !bilinen;
  if (karsi === undefined) {
    const hepsi = [d.karsi, d.olay].join(" ");
    karsi = karar(say(KARSI_KADIN_AKRABA, hepsi), say(KARSI_ERKEK_AKRABA, hepsi)) ?? karar(say(KARSI_KADIN, d.karsi || ""), say(KARSI_ERKEK, d.karsi || "")) ?? karar(hk.f, hk.m);
  }
  return { biz, karsi };
}

/** Danışanın (sahnedeki "Siz") cinsiyeti, bu sırayla: oyuncunun seçtiği karakter, büronun karakteri, hesaptaki ad (kadın ve erkek
 *  adları listesi), danışma metnindeki ipuçları. true kadın, false erkek, undefined bilinmiyor. */
export function danisanKadinMi(o: { karakter?: string | null; buro?: string | null; ad?: string | null }, s?: Senaryo, d?: Danisma): boolean | undefined {
  for (const a of [o.karakter, o.buro]) if (a && /^av-(kadin|erkek)/.test(a)) return faceFemale(a);
  const g = nameGender(o.ad || undefined);
  if (g) return g === "f";
  return s && d ? tarafCinsiyeti(s, d).biz : undefined;
}
/** Sunucuya giden kısa biçim ("k" / "e"). */
export const cinsKodu = (kadin?: boolean) => (kadin === undefined ? undefined : kadin ? "k" as const : "e" as const);

/** Karşı taraf bir şirket ya da kurum mu (işveren, sigorta, banka, idare...). Öyleyse takım elbiseli bir yetkili gelir. */
export const kurumMu = (x: string) => /şirket|a\.ş|ltd|holding|işveren|sigorta|banka|finans|kurum|idare|belediye|bakanlı|müdürlüğ|başkanlığ|üniversite|hastane|okul|kooperatif|vakıf|dernek|yönetim|yetkili|temsilci|mağaza|satıcı|üretici|firma|ticaret|market|operatör|kargo|otel|acente|fabrika|işletme/i.test(x);

const look = (female: boolean, kind: Look["kind"]): Look => ({ kind, skin: "#d9a982", hair: "#2e2a28", style: female ? "long" : "short" });

/** Senaryodan oyundaki gibi bir dava dosyası: mahkeme ve salon, heyet, kadro (danışan müvekkil, karşı taraf, iki vekil, hâkim;
 *  ceza mahkemesinde savcı). Adlar yalnız yüz seçimi içindir; ekrandaki etiketler kimAdi/kimKisa'dan gelir. */
export function izleDosyasi(s: Senaryo, d: Danisma, g: { avukat: boolean; karsiAvukat: boolean; hakim: boolean; biz: boolean; karsi: boolean; savci: boolean }): { c: CaseFile; kt: string } {
  const r = s.roller || ({} as Senaryo["roller"]);
  const mahkeme = s.mahkeme || t("Mahkeme");
  const davaci = s.taraf !== "davali";
  const tahkim = /Tahkim|Hakem/i.test(mahkeme) && !/Asliye|Ticaret Mahkemesi/.test(mahkeme);
  const yuksek = /Yargıtay|Danıştay|Sayıştay|Bölge/.test(mahkeme);
  const heyet = /Ağır Ceza|Bölge|Yargıtay|Danıştay|Sayıştay|Anayasa|Tahkim|Hakem|Komisyon|Kurul/i.test(mahkeme) ? 3 : 1;
  const ceza = /Ceza/.test(mahkeme);
  const ktSavci = /savcı/i.test(r.karsiTaraf || "");
  const kt = ktSavci ? "savci" : "karsiTaraf";
  const ktAd = r.karsiTaraf || t("Karşı taraf");
  const cast: CaseFile["cast"] = {
    judge: { name: r.hakim || t("Hâkim"), np: "red", look: look(g.hakim, "robe") },
    p1: { look: look(g.avukat, "robe") },
    opp: { name: r.karsiAvukat || (davaci ? "Davalı vekili" : "Davacı vekili"), np: "green", look: look(g.karsiAvukat, "robe") },
    client: { name: "Müvekkil", np: "civil", look: look(g.biz, "civil") },
    // Karşı taraf, karşı vekilin yanında durur: taraf sıfatı (davalı/davacı) adına eklenir ki taraf teşkilinde yerini bulsun.
    [kt]: ktSavci
      ? { name: ktAd, np: "red", look: look(g.karsi, "robe") }
      : { name: `${ktAd} · ${davaci ? "Davalı" : "Davacı"}`, np: "civil", look: look(g.karsi, "civil"), ...(kurumMu(`${ktAd} ${d.karsi || ""}`) ? { attire: "business" as const } : {}) }
  };
  // Ceza mahkemesinde savcı kürsüde oturur (oyundaki ceza duruşmalarındaki gibi); karşı taraf savcıysa o oturur.
  if (ceza && !ktSavci) cast.pros = { name: "Cumhuriyet Savcısı", np: "red", look: look(g.savci, "robe") };
  const c: CaseFile = {
    id: `danisma:${d.id}`, mode: "solo", title: t("Duruşmayı izle"), area: alanAdi(d.alan), court: mahkeme,
    courtShort: `${mahkeme} · ${t("temsilî")}`, esas: "", kararTarihi: "", color: "#7b1e2e", teaser: "",
    sides: { p1: { role: davaci ? "Davacı vekili" : "Davalı vekili", short: davaci ? "Davacı" : "Davalı" }, p2: { role: ktAd, short: ktAd } },
    cast, courtCast: ["opp"], bench: { judges: heyet },
    room: tahkim ? "tahkim" : yuksek ? "yuksek" : undefined,
    // Türkiye'deki hakem heyetleri ve komisyonlar toplantı salonunda (bg-komisyon); öbür tahkimler Türk hakemlerle tahkim salonunda.
    forum: tahkim ? (/Sigorta/.test(mahkeme) ? "sigorta" : /Komisyon|Heyet|Kurul/.test(mahkeme) ? "ihtk" : "istac") : undefined,
    intro: [], docs: [], steps: [], outcomes: []
  };
  return { c, kt };
}

/** Danışmaya bağlı sabit kadro: aynı danışma her açılışta aynı yüzleri ve sesleri kullanır.
 *  bizKadin: danışanın cinsiyeti (danisanKadinMi: karakter, büro, hesap adı); verilmezse metindeki ipuçlarından, o da yoksa sabit seçim. */
export function kadro(d: Danisma, s: Senaryo, bizKadin?: boolean): Kadro {
  const id = d.id;
  const h = hash(id);
  const bizF = (h & 1) === 1;
  // Danışanın avukatı (eski sürümdeki seçimle aynı); karşı avukat ayırt edilsin diye öbür cinsiyetten.
  const bizAvukat = (bizF ? LAWYER.f : LAWYER.m)[(h >>> 3) % (bizF ? LAWYER.f : LAWYER.m).length];
  const cins = tarafCinsiyeti(s, d, bizKadin);
  const { c, kt } = izleDosyasi(s, d, {
    avukat: bizF, karsiAvukat: !bizF, hakim: ((h >>> 2) & 1) === 1, savci: ((h >>> 13) & 1) === 1,
    biz: bizKadin ?? cins.biz ?? ((h >>> 15) & 1) === 1, karsi: cins.karsi ?? ((h >>> 16) & 1) === 1
  });
  const faces = castFaces(c, bizAvukat as Parameters<typeof castFaces>[1], bizF);
  const yuz: Kadro["yuz"] = { bizAvukat: faces.p1, karsiAvukat: faces.opp, hakim: faces.judge, biz: faces.client, karsiTaraf: faces[kt] };
  const ses = { narr: { id: "narr", role: "narr", female: true } } as Kadro["ses"];
  const kullanilan = new Set<string>();
  for (const k of ["hakim", "bizAvukat", "karsiAvukat", "biz", "karsiTaraf"] as Kim[]) {
    let sp: Speaker = { id: `danisma:${id}:${k}`, role: k === "hakim" ? "judge" : k, female: faceFemale(yuz[k]) };
    // Aynı cinsiyetten iki kişi aynı sesle konuşmasın: kimlik ekiyle başka bir ses denenir.
    for (let i = 1; i < 30 && kullanilan.has(voiceOf(sp)); i++) sp = { ...sp, id: `danisma:${id}:${k}:${i}` };
    kullanilan.add(voiceOf(sp));
    ses[k] = sp;
  }
  return { c, faces, kt, yuz, ses };
}

/** Sahnenin oyundaki karşılığı: büro mu salon mu, kimin bakışından, konuşan hangi kadro anahtarı.
 *  Karşı tarafın görüşmesi karşı vekilin bürosudur: oyundaki görüşme odası, bakış karşı vekilin; karşı taraf masanın karşısında oturur.
 *  (Oda aynalanmaz: duvardaki ruhsatnamenin yazısı ters görünüyordu.) */
export interface Gorunum { scene: Scene; faces: Record<string, PhotoKey>; key: Record<Kim, string> }
export function gorunum(k: Kadro, tur: SahneTur): Gorunum {
  if (tur === "gorusme_karsi") {
    const f = k.faces;
    return {
      scene: "office",
      faces: { ...f, client: f[k.kt], [k.kt]: f.client, p1: f.opp, opp: f.p1 },
      key: { karsiAvukat: "p1", karsiTaraf: "client", biz: k.kt, bizAvukat: "opp", hakim: "judge" }
    };
  }
  return {
    scene: tur === "gorusme_biz" ? "office" : "court", faces: k.faces,
    key: { bizAvukat: "p1", karsiAvukat: "opp", hakim: "judge", biz: "client", karsiTaraf: k.kt }
  };
}

const tarafAdi = (s: Senaryo, biz: boolean) => ((s.taraf === "davaci") === biz ? t("davacı") : t("davalı"));

/** Konuşanın tam adı (konuşma balonunda ve tutanakta). */
export function kimAdi(kim: Kim, s: Senaryo) {
  const r = s.roller || ({} as Senaryo["roller"]);
  if (kim === "biz") return t("Siz ({taraf})", { taraf: tarafAdi(s, true) });
  if (kim === "karsiTaraf") return r.karsiTaraf || t("Karşı taraf");
  if (kim === "hakim") return r.hakim || t("Hâkim");
  if (kim === "bizAvukat") return `${r.bizAvukat || (s.taraf === "davaci" ? t("Davacı vekili") : t("Davalı vekili"))} · ${t("sizin avukatınız")}`;
  return `${r.karsiAvukat || (s.taraf === "davaci" ? t("Davalı vekili") : t("Davacı vekili"))} · ${t("karşı taraf")}`;
}

/** Sahnede kişinin üstündeki kısa ad. */
export function kimKisa(kim: Kim, s: Senaryo) {
  if (kim === "biz") return t("Siz ({taraf})", { taraf: tarafAdi(s, true) });
  if (kim === "karsiTaraf") return s.roller?.karsiTaraf || t("Karşı taraf");
  if (kim === "hakim") return s.roller?.hakim || t("Hâkim");
  if (kim === "bizAvukat") return t("Avukatınız");
  return t("Karşı taraf avukatı");
}

export function sahneBaslik(tur: SahneTur, s: Senaryo) {
  // Avukat oyuncunun kaydı: numarasız başlıklar (karşı tarafın görüşmesi yoktur).
  if (s.oyuncu) {
    if (tur === "gorusme_biz") return { baslik: t("Büro görüşmesi"), alt: t("Avukat oyuncu ({ad}) sizinle görüşüyor.", { ad: s.oyuncu }) };
    if (tur === "durusma") return { baslik: t("Duruşma"), alt: `${s.mahkeme || t("Mahkeme")} · ${t("avukat oyuncunun duruşması")}` };
    if (tur === "karar") return { baslik: t("Karar"), alt: t("Hâkimin eğitim amaçlı kararı.") };
  }
  if (tur === "gorusme_biz") return { baslik: t("1. Görüşme — sizin avukatınız"), alt: t("Avukatınız sizi bürosunda dinliyor ve sorular soruyor.") };
  if (tur === "gorusme_karsi") return { baslik: t("2. Görüşme — karşı taraf"), alt: t("Karşı tarafın avukatı, {rol} ile görüşüyor.", { rol: kimKisa("karsiTaraf", s) }) };
  if (tur === "durusma") return { baslik: t("3. Duruşma"), alt: `${s.mahkeme || t("Mahkeme")} · ${t("temsilî duruşma")}` };
  return { baslik: t("4. Karar"), alt: t("Hâkimin gerekçeli kararı (eğitim amaçlı).") };
}

export type Adim = { k: "kart"; si: number } | { k: "satir"; si: number; li: number };
export function adimlar(s: Senaryo): Adim[] {
  const out: Adim[] = [];
  s.sahneler.forEach((sh, si) => { out.push({ k: "kart", si }); sh.satirlar.forEach((_, li) => out.push({ k: "satir", si, li })); });
  return out;
}

/** Sesli kayıt ve video parçaları: başta uyarı, her sahnenin başında anlatıcının okuduğu başlık, sonra satırlar.
 *  ara: önceki parçadan sonra konacak sessizlik (0 yok, 1 kısa, 2 uzun; sunucudaki ARA_MS ile aynı). */
export interface Parca { adim: Adim | null; metin: string; speaker: Speaker; ara: number }
export const ARA_SN = [0, 0.45, 1.2];
export function parcalar(s: Senaryo, k: Kadro): Parca[] {
  const out: Parca[] = [{ adim: null, metin: t(UYARI_KISA), speaker: k.ses.narr, ara: 0 }];
  for (const a of adimlar(s)) {
    const sh = s.sahneler[a.si];
    if (a.k === "kart") { const b = sahneBaslik(sh.tur, s); out.push({ adim: a, metin: `${b.baslik}. ${b.alt}`, speaker: k.ses.narr, ara: 2 }); }
    else { const l = sh.satirlar[a.li]; out.push({ adim: a, metin: l.metin, speaker: k.ses[l.kim], ara: 1 }); }
  }
  return out;
}

/* ---------- tutanak ve yazdırma (ikincil seçenek) ---------- */
export function ozetMetni(s: Senaryo, d: Danisma) {
  const L: string[] = [];
  L.push(t("Celse · Duruşmayı izle"), `${t(alanAdi(d.alan))} · ${new Date(d.created_at).toLocaleDateString(locale())}`, "", t(UYARI_KISA), "");
  L.push(t("Olay özeti").toLocaleUpperCase(locale()), s.ozet || d.olay, "");
  for (const sh of s.sahneler) {
    L.push(sahneBaslik(sh.tur, s).baslik.toLocaleUpperCase(locale()));
    for (const l of sh.satirlar) L.push(sh.tur === "karar" ? l.metin : `${kimAdi(l.kim, s)}: ${l.metin}`);
    L.push("");
  }
  if (s.uyari) L.push(s.uyari);
  return L.join("\n");
}

const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function ozetHtml(s: Senaryo, d: Danisma) {
  const sahne = s.sahneler.map(sh => {
    const satir = sh.tur === "karar"
      ? sh.satirlar.map(l => `<p>${esc(l.metin)}</p>`).join("")
      : sh.satirlar.map(l => `<p class="l"><b>${esc(kimAdi(l.kim, s))}:</b> ${esc(l.metin)}</p>`).join("");
    return `<h2>${esc(sahneBaslik(sh.tur, s).baslik)}</h2>${sh.tur === "karar" ? `<div class="karar">${satir}</div>` : satir}`;
  }).join("");
  return `<!doctype html><html lang="${esc(locale().slice(0, 2))}"><head><meta charset="utf-8"><title>${esc(t("Celse · Duruşmayı izle"))}</title>
<style>body{font:13pt/1.5 Georgia,serif;color:#111;max-width:720px;margin:24px auto;padding:0 16px}h1{font-size:20pt;margin:0}h2{font-size:14pt;margin:22px 0 6px;border-bottom:1px solid #999}
.m{color:#555;font:10pt sans-serif}.u{border:1px solid #7b1e2e;padding:8px 10px;font:10.5pt sans-serif;margin:12px 0}.l{margin:4px 0}.karar{border-left:3px solid #7b1e2e;padding-left:10px}</style></head>
<body><h1>${esc(t("Celse · Duruşmayı izle"))}</h1><div class="m">${esc(t(alanAdi(d.alan)))} · ${esc(new Date(d.created_at).toLocaleDateString(locale()))}</div>
<div class="u">${esc(t(UYARI_KISA))}</div><h2>${esc(t("Olay özeti"))}</h2><p>${esc(s.ozet || d.olay)}</p>${sahne}
<div class="u">${esc(s.uyari || t(UYARI_KISA))}</div></body></html>`;
}
