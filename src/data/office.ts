// Büro yönetimi: oyuncunun karakteri, büro şehri, kasa, aylık giderler ve dava gelirleri.
// Her dava oyunda bir ay sürer; dava bitince ücret kasaya girer, ay sonu giderleri düşülür.
// Tutarlar oyun içi yaklaşık değerlerdir (resmî tarife değildir).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { CaseFile, Side } from "../engine/types";
import { getLang, t } from "../i18n";
import { currentAccount, onAccountChange } from "./account";
import { levelOf } from "./career";
import { branchOf } from "./branches";
import { ageLife, Choice, dueEvent, EDU, EVENTS, hasDegree, Life, migrateLife, newLife, personalCosts, staffCosts } from "./life";
import { markChanged } from "./syncBus";

export interface City { id: string; name: string; rent: number; fee: number; note: string }
/** rent: aylık büro kirası (TL) · fee: vekâlet ücreti çarpanı (büyük şehirde ücret ve iş hacmi yüksek, kira da yüksek) */
export const CITIES: City[] = [
  { id: "istanbul", name: "İstanbul", rent: 45000, fee: 1.4, note: "En yüksek ücretler, en pahalı kira, en çetin rekabet." },
  { id: "ankara", name: "Ankara", rent: 30000, fee: 1.25, note: "Yüksek yargı ve bakanlıklar burada; idare davaları bol." },
  { id: "izmir", name: "İzmir", rent: 32000, fee: 1.25, note: "Ticaret ve iş davaları güçlü, kira yüksek." },
  { id: "bursa", name: "Bursa", rent: 22000, fee: 1.1, note: "Sanayi şehri: iş ve ticaret davaları." },
  { id: "antalya", name: "Antalya", rent: 25000, fee: 1.1, note: "Turizm, kira ve tüketici uyuşmazlıkları." },
  { id: "kocaeli", name: "Kocaeli", rent: 20000, fee: 1.05, note: "Fabrikalar ve iş kazası davaları." },
  { id: "adana", name: "Adana", rent: 16000, fee: 0.95, note: "Tarım ve ticaret; ceza davaları yoğun." },
  { id: "konya", name: "Konya", rent: 16000, fee: 0.95, note: "Geniş il, düşük kira, sadık müvekkiller." },
  { id: "gaziantep", name: "Gaziantep", rent: 15000, fee: 0.95, note: "Hızla büyüyen ticaret merkezi." },
  { id: "kayseri", name: "Kayseri", rent: 14000, fee: 0.9, note: "Esnaf ve ticaret davaları." },
  { id: "eskisehir", name: "Eskişehir", rent: 15000, fee: 0.9, note: "Üniversite şehri, kira davaları bol." },
  { id: "samsun", name: "Samsun", rent: 14000, fee: 0.9, note: "Karadeniz'in adliye merkezi." },
  { id: "trabzon", name: "Trabzon", rent: 14000, fee: 0.85, note: "Bölge adliye mahkemesi burada." },
  { id: "diyarbakir", name: "Diyarbakır", rent: 12000, fee: 0.85, note: "CMK görevlendirmeleri sık, kira düşük." },
  { id: "erzurum", name: "Erzurum", rent: 11000, fee: 0.8, note: "Bölge adliye mahkemesi var; düşük gider." },
  { id: "van", name: "Van", rent: 10000, fee: 0.8, note: "En düşük gider; adli yardım işleri bol." }
];

/** Oyuncunun seçebileceği avukat karakterleri (gerçekçi görünüm fotoğrafları). */
export const AVATARS = ["av-erkek-38", "av-kadin-32", "av-erkek-58", "av-kadin-52", "av-erkek-25", "av-kadin-25", "av-kadin-basortulu",
  "av-erkek-32", "av-kadin-28", "av-erkek-46", "av-kadin-41", "av-erkek-27", "av-kadin-35", "av-erkek-66", "av-kadin-61",
  "av-erkek-28-gozluk", "av-erkek-30-sari", "av-erkek-42-biyik", "av-erkek-45-kel", "av-erkek-52-sakal", "av-erkek-62-kel", "av-kadin-26-sari", "av-kadin-28-gozluk", "av-kadin-30-kivircik", "av-kadin-48-basortulu", "av-kadin-58-topuz"] as const;
export type Avatar = typeof AVATARS[number];

export interface Ledger { ay: number; text: string; amount: number }
export interface Office {
  name: string;
  city: string;
  avatar: Avatar;
  cash: number;
  /** oyunda geçen ay sayısı */
  month: number;
  secretary: boolean;
  ledger: Ledger[];
  /** özel hayat ve büro çalışanları (eski kayıtlarda yok; ilk okumada oluşturulur) */
  life?: Life;
  /** bu ay cevaplanması gereken hayat olayı */
  pendingEvent?: string;
  /** büronun kazandığı dava sayısı (itibar: rutin işleri artırır) */
  wins?: number;
  /** Bir defalık düzeltme yapıldı: eski kuralda kaybedilen davalarda ücretin yalnız %40'ı ödenmişti. */
  ucretDuzeltmesi?: boolean;
  /** Kanun yolu ödemeleri, dosya başına: son ödenen sonuç (kazanıldı mı), ödenen aşamalar, alınan karşı taraf vekâlet ücreti. */
  kanunYolu?: Record<string, { won: boolean; asamalar: string[]; karsi: number }>;
}

/** Duruşmaya çıkmayan rutin işler (danışmanlık, ihtarname, sözleşme, icra takipleri): itibar ve çalışanlarla artar. */
export function routineIncome(o: Office) {
  const city = CITIES.find(c => c.id === o.city) || CITIES[0];
  const base = 12000 + 3000 * Math.min(o.wins || 0, 20) + (o.life?.stajyer ? 10000 : 0) + (o.life?.katip ? 15000 : 0) + (o.life?.ownOffice ? 8000 : 0);
  const edu = hasDegree(o.life, "yl") ? 1.15 : 1;
  return Math.round((base * city.fee * edu) / 500) * 500;
}

export const START_CASH = 150000;
/** Genç avukat ortak bir büroda masa kiralayarak başlar; giderler buna göre düşüktür. Kendi bürosuna geçince artar. */
export const FIXED = { ofis: 3000, ofisTam: 7000, baro: 1500, muhasebe: 2000 };
export const SECRETARY = 30000;
export const DESK_SHARE = 0.35;

export function monthlyCost(o: Office) {
  const city = CITIES.find(c => c.id === o.city) || CITIES[0];
  const own = !!o.life?.ownOffice;
  const items = [
    own ? { text: "Büro kirası", amount: city.rent } : { text: "Ortak büroda masa kirası", amount: Math.round((city.rent * DESK_SHARE) / 500) * 500 },
    { text: "Elektrik, su, internet, kırtasiye", amount: own ? FIXED.ofisTam : FIXED.ofis },
    { text: "Baro aidatı ve mesleki sigorta", amount: FIXED.baro },
    { text: "Mali müşavir", amount: FIXED.muhasebe }
  ];
  if (o.secretary) items.push({ text: "Sekreter maaşı", amount: SECRETARY });
  if (o.life) items.push(...staffCosts(o.life));
  return { items, total: items.reduce((n, i) => n + i.amount, 0) };
}

/* ---------- Davanın büroya geliş biçimi ve ücreti ---------- */

export type Source = "muvekkil" | "cmk" | "adli";
const hash = (s: string) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/** Baro üzerinden gelebilecek iş: müdafilik (CMK) ya da ilk derecede güçsüz tarafın vekilliği (adli yardım).
 *  Karşılıklı dosyada hangi tarafın vekili olunacağını da söyler. */
export function publicRole(c: CaseFile): { src: "cmk" | "adli"; side: Side } | null {
  if (c.room === "tahkim" || levelOf(c) > 2) return null;
  const sides: Side[] = c.mode === "duel" ? ["p1", "p2"] : ["p1"];
  for (const sd of sides) if (/müdafi/i.test(c.sides[sd].role)) return { src: "cmk", side: sd };
  if (levelOf(c) === 1) for (const sd of sides) if (/davacı|kiracı|işçi|mirasçı|borçlu|katılan|mağdur|zarar gören|eş vekili|anne|baba/i.test(c.sides[sd].role) && !/idare|bakanlı|şirket/i.test(c.sides[sd].role)) return { src: "adli", side: sd };
  return null;
}

/** Karşılıklı dosyada büronun alacağı taraf: kurum temsilcisi olan taraf (Bakanlık, idare, federasyon) alınmaz. */
export function careerSide(c: CaseFile): Side {
  if (c.mode !== "duel") return "p1";
  const inst = (sd: Side) => /temsilci|bakanlı|idare|vergi dairesi|federasyon|uefa|komite|birliği/i.test(c.sides[sd].role);
  if (inst("p1")) return "p2";
  if (inst("p2")) return "p1";
  return hash(c.id + "taraf") % 2 ? "p2" : "p1";
}

/** Ceza davalarında sanık müdafiliği çoğu zaman CMK görevlendirmesiyle, bazı hukuk davaları adli yardımla gelir. */
export function sourceOf(c: CaseFile): Source {
  const role = c.sides.p1.role.toLocaleLowerCase("tr");
  const h = hash(c.id) % 100;
  if (/müdafi/.test(role) && levelOf(c) <= 2) return h < 55 ? "cmk" : "muvekkil";
  if (levelOf(c) === 1 && /davacı|kiracı|işçi|mirasçı|borçlu/.test(role)) return h < 25 ? "adli" : "muvekkil";
  return "muvekkil";
}
export const SOURCE_LABEL: Record<Source, string> = { muvekkil: "Müvekkil", cmk: "CMK görevlendirmesi", adli: "Adli yardım" };

/** Vekâlet ücreti: seviye arttıkça yükselir; şehir çarpanı uygulanır. CMK ve adli yardımda ücret sabittir ve sonuca bağlı değildir. */
/** Uluslararası mahkeme ya da milletlerarası tahkim dosyası mı (yabancı dilde savunma yapılabilir). */
export const isIntl = (c: CaseFile) => levelOf(c) === 5 || ["icc", "lcia", "uncitral", "cas"].includes(c.forum || "");

export function feeFor(c: CaseFile, o: Office, won: boolean, score: number, opt?: { src?: Source; spec?: boolean }) {
  const src = opt?.src || sourceOf(c);
  const city = CITIES.find(x => x.id === o.city) || CITIES[0];
  if (src === "cmk") return { amount: levelOf(c) >= 2 ? 22000 : 15000, text: "CMK ücreti (baro aracılığıyla, sonuçtan bağımsız)" };
  if (src === "adli") return { amount: 15000, text: "Adli yardım ücreti (baro aracılığıyla, sonuçtan bağımsız)" };
  const base = [0, 60000, 110000, 180000, 260000, 350000][levelOf(c)] || 60000;
  const katip = o.life?.katip && branchOf(c) === "icra" ? 1.15 : 1;
  const edu = hasDegree(o.life, "dr") ? 1.2 : hasDegree(o.life, "yl") ? 1.1 : 1;
  const lang = isIntl(c) && (hasDegree(o.life, "en") || hasDegree(o.life, "fr")) ? 1.1 : 1;
  const mult = (o.secretary ? 1.1 : 1) * katip * edu * lang * (opt?.spec ? 1.15 : 1) * (o.life?.ownOffice ? 1.1 : 1);
  const full = Math.round((base * city.fee * mult) / 500) * 500;
  // Avukat, dava kazanılsa da kaybedilse de ücretini alır (Avukatlık Asgari Ücret Tarifesi; yargılama giderlerini de
  // müvekkil öder). Kaybetmek büronun gelirini düşürmez; kazanınca sözleşmedeki başarı primi eklenir.
  if (won) {
    const bonus = Math.round((full * Math.max(0, score - 60)) / 100 / 500) * 500;
    return { amount: full + bonus, text: bonus ? `Vekâlet ücreti ve başarı primi (ikna ${score})` : "Vekâlet ücreti" };
  }
  return { amount: full, text: "Vekâlet ücreti (sonuçtan bağımsız)" };
}

/* ---------- Kayıt ---------- */

/** Her hesabın bürosu ayrı anahtarda (oturum yoksa "misafir"); giriş yapan hesapta sunucuyla eşitlenir (sync.ts). */
const keyFor = (owner = currentAccount()?.id) => `celse-buro-v1:${owner || "misafir"}`;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(f => f());
onAccountChange(emit);

export async function loadOffice(): Promise<Office | null> {
  try {
    const v = await AsyncStorage.getItem(keyFor());
    if (!v) return null;
    let o: Office = JSON.parse(v);
    o.life = migrateLife(o.life || newLife(o.city), o.city);
    if (!o.ucretDuzeltmesi) { o = ucretiDuzelt(o); await save(o); }
    return o;
  } catch { return null; }
}

const ESKI_KAYIP = "Peşin alınan ücret (dava kaybedildi)";
/** Bir defalık düzeltme: eski kuralda kaybedilen davada ücretin yalnız %40'ı ("peşin") kasaya girmişti. Artık ücret
 *  sonuçtan bağımsız ödendiği için her böyle kayıt için eksik kalan %60 (peşin tutarın 1,5 katı) kasaya eklenir. */
export function ucretiDuzelt(o: Office): Office {
  const eksik = o.ledger.filter(l => l.amount > 0 && l.text.includes(ESKI_KAYIP))
    .reduce((t, l) => t + Math.round((l.amount * 1.5) / 500) * 500, 0);
  if (eksik <= 0) return { ...o, ucretDuzeltmesi: true };
  const n = o.ledger.filter(l => l.amount > 0 && l.text.includes(ESKI_KAYIP)).length;
  return {
    ...o, cash: o.cash + eksik, ucretDuzeltmesi: true,
    ledger: [...o.ledger, { ay: o.month, text: `Düzeltme: kaybedilen ${n} davada eksik ödenen vekâlet ücreti (ücret sonuçtan bağımsız)`, amount: eksik }]
  };
}
async function save(o: Office | null) {
  const owner = currentAccount()?.id;
  try { if (o) await AsyncStorage.setItem(keyFor(owner), JSON.stringify(o)); else await AsyncStorage.removeItem(keyFor(owner)); } catch { /* yok say */ }
  emit();
  markChanged(owner);
}

/** Eşitleme için: belirli hesabın cihazdaki bürosu (olduğu gibi, dönüştürülmeden). */
export async function readOfficeFor(owner: string): Promise<Office | null> {
  try { const v = await AsyncStorage.getItem(keyFor(owner)); return v ? JSON.parse(v) : null; } catch { return null; }
}
/** Eşitleme için: sunucudan gelen büroyu yazar; yerel değişiklik sayılmaz (yeniden gönderilmez). Ekranlar yeniden çizilir. */
export async function writeOfficeFor(owner: string, o: Office | null) {
  try { if (o) await AsyncStorage.setItem(keyFor(owner), JSON.stringify(o)); else await AsyncStorage.removeItem(keyFor(owner)); } catch { /* yok say */ }
  if (currentAccount()?.id === owner) emit();
}

export async function openOffice(name: string, city: string, avatar: Avatar) {
  await save({ name, city, avatar, cash: START_CASH, month: 0, secretary: false, life: newLife(city), ledger: [{ ay: 0, text: "Kuruluş sermayesi", amount: START_CASH }] });
}
export async function updateOffice(patch: Partial<Office>) {
  const o = await loadOffice(); if (o) await save({ ...o, ...patch });
}
export async function closeOffice() { await save(null); }

/** Ayın kapanışı: gelirler kasaya girer, büro ve kişisel giderler düşülür, hayat ilerler ve varsa bir olay çıkar. */
export async function closeMonth(income: { text: string; amount: number }[], casesThisMonth: number) {
  const o = await loadOffice();
  if (!o) return null;
  const life = o.life || newLife(o.city);
  const month = o.month + 1;
  const office = monthlyCost(o);
  const personal = personalCosts(life, month);
  income = [...income, { text: "Rutin büro işleri (danışmanlık, ihtarname, sözleşme)", amount: routineIncome(o) }];
  const inc = income.reduce((n, i) => n + i.amount, 0);
  // Kredili mevduat: ay başında eksi olan bakiyeye faiz işler.
  const kmh = o.cash < 0 ? Math.round((-o.cash * 0.045) / 100) * 100 : 0;
  const cash = o.cash + inc - office.total - personal.total - kmh;
  // Süresi dolan eğitimler tamamlanır.
  const done = (life.study || []).filter(x => x.until <= month);
  const graduated = done.map(x => EDU.find(e => e.id === x.id)?.label || x.id);
  const lifeEdu: Life = done.length ? { ...life, study: (life.study || []).filter(x => x.until > month), degrees: [...(life.degrees || []), ...done.map(x => x.id)] } : life;
  const ledger = [...o.ledger,
    ...income.map(i => ({ ay: month, ...i })),
    { ay: month, text: "Büro giderleri", amount: -office.total },
    { ay: month, text: "Kişisel giderler", amount: -personal.total },
    ...(kmh ? [{ ay: month, text: "Kredili mevduat faizi", amount: -kmh }] : []),
    ...graduated.map(g => ({ ay: month, text: `Tamamlandı: ${g}`, amount: 0 }))].slice(-80);
  const aged = ageLife(lifeEdu, cash, casesThisMonth);
  const ev = o.pendingEvent ? null : dueEvent({ life: aged, month, cash, casesThisYear: 0, wins: o.wins || 0 });
  await save({ ...o, cash, month, ledger, life: aged, pendingEvent: o.pendingEvent || ev?.id });
  return { income: inc, office: office.total, personal: personal.total, cash, month, event: ev?.title, kmh, graduated };
}

/** Mesleki gelişim: kursa ya da lisansüstü programa kayıt. Ücret her ay kişisel giderlere eklenir. */
export async function enroll(id: string) {
  const o = await loadOffice();
  if (!o || !o.life) return;
  const e = EDU.find(x => x.id === id);
  if (!e || hasDegree(o.life, id) || (o.life.study || []).some(x => x.id === id) || (e.needs && !hasDegree(o.life, e.needs))) return;
  const life = { ...o.life, study: [...(o.life.study || []), { id, until: o.month + e.months }] };
  await save({ ...o, life, ledger: [...o.ledger, { ay: o.month, text: `Kayıt: ${e.label}`, amount: 0 }].slice(-80) });
}

/** Dava bitince: ücret kasaya girer ve ay kapanır. */
export async function settleCase(c: CaseFile, won: boolean, score: number, opt?: { src?: Source; spec?: boolean }) {
  const o = await loadOffice();
  if (!o) return null;
  const fee = feeFor(c, o, won, score, opt);
  if (won) await save({ ...o, wins: (o.wins || 0) + 1 });
  const r = await closeMonth([{ text: `${c.title}: ${fee.text}`, amount: fee.amount }], 1);
  return r && { ...r, fee, source: opt?.src || sourceOf(c) };
}

/** Kanun yolu sonucu büroya yansır (ay kapanmaz; kanun yolu ayrı bir iştir):
 *  · her aşama için kanun yolu vekâlet ücreti (sonuçtan bağımsız);
 *  · ilk derecede kaybedilip kanun yolunda lehe dönen dosyada başarı primi ve karşı tarafa yükletilen vekâlet ücreti
 *    (Av.K. m.164/5: avukata aittir);
 *  · lehe dönmüş karar üst mahkemede yeniden aleyhe dönerse alınan karşı vekâlet ücreti iade edilir.
 *  Aynı aşama ikinci kez oynanırsa (tekrar) yeniden ödenmez. */
export async function kanunYoluOdemesi(x: { base: CaseFile; asama: string; mahkeme: string; baseWon: boolean; baseScore: number; wonNow: boolean; src?: Source; spec?: boolean }) {
  const o = await loadOffice();
  if (!o) return null;
  const kayit = o.kanunYolu?.[x.base.id] || { won: x.baseWon, asamalar: [], karsi: 0 };
  if (kayit.asamalar.includes(x.asama)) return null;
  const src = x.src || sourceOf(x.base);
  const kalemler: { text: string; amount: number }[] = [];
  let karsi = kayit.karsi;
  if (src === "cmk" || src === "adli") {
    kalemler.push({ text: `${x.base.title}: kanun yolu ücreti (baro aracılığıyla)`, amount: 8000 });
  } else {
    const tam = feeFor(x.base, o, true, 60, { src, spec: x.spec }).amount;
    kalemler.push({ text: `${x.base.title}: ${x.mahkeme} aşaması vekâlet ücreti`, amount: Math.round((tam * 0.2) / 500) * 500 });
    if (!kayit.won && x.wonNow) {
      const prim = feeFor(x.base, o, true, x.baseScore, { src, spec: x.spec }).amount - feeFor(x.base, o, false, x.baseScore, { src, spec: x.spec }).amount;
      if (prim > 0) kalemler.push({ text: `${x.base.title}: başarı primi (karar ${x.mahkeme} kararıyla lehe döndü)`, amount: prim });
      const kv = Math.round((tam * 0.3) / 500) * 500;
      kalemler.push({ text: `${x.base.title}: karşı tarafa yükletilen vekâlet ücreti (Av.K. m.164/5)`, amount: kv });
      karsi += kv;
    } else if (kayit.won && !x.wonNow && karsi > 0) {
      kalemler.push({ text: `${x.base.title}: lehe hükmedilen karşı vekâlet ücretinin iadesi (karar ${x.mahkeme} kararıyla aleyhe döndü)`, amount: -karsi });
      karsi = 0;
    }
  }
  const toplam = kalemler.reduce((t, k) => t + k.amount, 0);
  const ledger = [...o.ledger, ...kalemler.map(k => ({ ay: o.month, text: k.text, amount: k.amount }))].slice(-200);
  await save({ ...o, cash: o.cash + toplam, ledger, wins: (o.wins || 0) + (!kayit.won && x.wonNow ? 1 : 0),
    kanunYolu: { ...(o.kanunYolu || {}), [x.base.id]: { won: x.wonNow, asamalar: [...kayit.asamalar, x.asama], karsi } } });
  return { kalemler, toplam, kasa: o.cash + toplam };
}

/** Bekleyen hayat olayının seçenekleri (o anki duruma göre). */
export function eventChoices(o: Office): { title: string; text: string; choices: (Choice & { disabled?: boolean })[] } | null {
  if (!o.pendingEvent || !o.life) return null;
  const e = EVENTS.find(x => x.id === o.pendingEvent);
  if (!e) return null;
  const ctx = { life: o.life, month: o.month, cash: o.cash, casesThisYear: 0, wins: o.wins || 0 };
  return { title: e.title, text: e.text(ctx), choices: e.choices(ctx).map(ch => ({ ...ch, disabled: !!ch.needCash && o.cash < ch.needCash })) };
}

export async function resolveEvent(idx: number) {
  const o = await loadOffice();
  if (!o || !o.pendingEvent || !o.life) return;
  const e = EVENTS.find(x => x.id === o.pendingEvent);
  if (!e) { await save({ ...o, pendingEvent: undefined }); return; }
  const ctx = { life: o.life, month: o.month, cash: o.cash, casesThisYear: 0, wins: o.wins || 0 };
  const ch = e.choices(ctx)[idx];
  if (!ch || (ch.needCash && o.cash < ch.needCash)) return;
  let life = ch.apply ? ch.apply(o.life, o.month) : o.life;
  life = { ...life, lastEventAt: o.month, sorulan: { ...(life.sorulan || {}), [e.id]: o.month }, done: life.done.includes(e.id) ? life.done : [...life.done, e.id],
    snooze: { ...life.snooze, [e.id]: o.month + (ch.snooze || (e.repeat ? 1 : 0)) } };
  const ledger = ch.once ? [...o.ledger, { ay: o.month, text: `${e.title}: ${ch.label}`, amount: ch.once }].slice(-80) : o.ledger;
  await save({ ...o, life, cash: o.cash + (ch.once || 0), ledger, pendingEvent: undefined });
}

export function useOffice(): { office: Office | null; ready: boolean } {
  const [s, setS] = useState<{ office: Office | null; ready: boolean }>({ office: null, ready: false });
  useEffect(() => {
    const load = () => { loadOffice().then(office => setS({ office, ready: true })); };
    load(); listeners.add(load);
    return () => { listeners.delete(load); };
  }, []);
  return s;
}

/** Hesap defteri ve gider kalemleri Türkçe saklanır (cihazdaki kayıtlar değişmesin); ekranda seçili dile çevrilir.
 *  Sabit metinler doğrudan, kalıplı olanlar (çocuk yaşı, eğitim, "Başlık: kalem") parçalanarak çevrilir. */
export function lineText(s: string): string {
  if (getLang() === "tr" || !s) return s;
  if (t(s) !== s) return t(s);
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^Vekâlet ücreti ve başarı primi \(ikna (\d+)\)$/))) return t("Vekâlet ücreti ve başarı primi (ikna {n})", { n: m[1] });
  if ((m = s.match(/^(.+) \(harç ve kurs ücreti\)$/))) return t("{ad} (harç ve kurs ücreti)", { ad: t(m[1]) });
  if ((m = s.match(/^(.+) \((\d+) yaş\)$/))) return t("{ad} ({n} yaş)", { ad: m[1], n: m[2] });
  if ((m = s.match(/^Tamamlandı: (.+)$/))) return t("Tamamlandı: {ad}", { ad: t(m[1]) });
  if ((m = s.match(/^Kayıt: (.+)$/))) return t("Kayıt: {ad}", { ad: t(m[1]) });
  // "Dava adı: ücret kalemi" ya da "Olay: seçim": sağ taraf bilinen bir kalemse iki parça ayrı çevrilir.
  for (let i = s.indexOf(": "); i > 0; i = s.indexOf(": ", i + 2)) {
    const right = s.slice(i + 2), r = lineText(right);
    if (r !== right) return `${t(s.slice(0, i))}: ${r}`;
  }
  return s;
}

export const tl = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("tr-TR")} TL`;
