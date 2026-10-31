// Avukatın özel hayatı: kişisel giderler (ev kirası, geçim), aile, araba, ev, büro çalışanları ve zamanla çıkan olaylar.
// Her ay sonunda (bir dava bitince ya da "ayı kapat" denince) koşulu tutan bir olay çıkabilir; oyuncu seçer,
// seçimin tek seferlik ve aylık gideri olur. Tutarlar 2027 için oyun içi yaklaşık değerlerdir.
import { CITIES } from "./office";

export interface Child { name: string; born: number }
export interface Loan { text: string; monthly: number; until: number }
export interface Life {
  /** kişisel ev kirası (yıllık artışla güncellenir) */
  homeRent: number;
  /** temel geçim (gıda, faturalar, ulaşım…) */
  living: number;
  owner: boolean;
  married: boolean;
  marriedAt?: number;
  divorced?: boolean;
  /** ayrılıktan sonra ödenen nafaka */
  alimony?: number;
  children: Child[];
  car?: "yok" | "kredili" | "ikinci-el";
  transport: number;
  loans: Loan[];
  stajyer: boolean;
  katip: boolean;
  /** evlilikte gerilim (0–100): çok çalışma ve borç artırır, tatil ve ilgi azaltır */
  strain: number;
  /** ertelenen olayların tekrar sorulacağı ay */
  snooze: Record<string, number>;
  done: string[];
  /** kasanın arka arkaya eksi kaldığı ay sayısı */
  redMonths: number;
}

export const STAJYER = 22000, KATIP = 35000;

export function newLife(city: string): Life {
  const c = CITIES.find(x => x.id === city) || CITIES[0];
  return {
    homeRent: Math.max(20000, Math.round((c.rent * 0.8) / 1000) * 1000), living: 40000, owner: false, married: false,
    children: [], transport: 4000, loans: [], stajyer: false, katip: false, strain: 0, snooze: {}, done: [], redMonths: 0
  };
}

/** Bir çocuğun aylık gideri yaşına göre: bebeklik, kreş, okul. */
export function childCost(ch: Child, month: number) {
  const age = month - ch.born;
  if (age < 0) return 0;
  if (age < 36) return 15000;
  if (age < 72) return 22000;
  return 28000;
}

export function personalCosts(l: Life, month: number) {
  const items: { text: string; amount: number }[] = [];
  if (!l.owner) items.push({ text: "Ev kirası", amount: l.homeRent });
  items.push({ text: "Geçim (gıda, fatura, giyim)", amount: l.living + (l.married ? 20000 : 0) });
  items.push({ text: l.car && l.car !== "yok" ? "Araba (yakıt, sigorta, bakım)" : "Ulaşım", amount: l.transport });
  l.children.forEach(ch => items.push({ text: `${ch.name} (${Math.max(0, Math.floor((month - ch.born) / 12))} yaş)`, amount: childCost(ch, month) }));
  l.loans.filter(x => x.until >= month).forEach(x => items.push({ text: x.text, amount: x.monthly }));
  if (l.alimony) items.push({ text: "Nafaka", amount: l.alimony });
  return { items, total: items.reduce((n, i) => n + i.amount, 0) };
}

export function staffCosts(l: Life) {
  const items: { text: string; amount: number }[] = [];
  if (l.stajyer) items.push({ text: "Stajyer avukat", amount: STAJYER });
  if (l.katip) items.push({ text: "Büro katibi", amount: KATIP });
  return items;
}

/** Takvim: 1. ay Ocak 2027. */
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
export const dateOf = (month: number) => `${AYLAR[(Math.max(1, month) - 1) % 12]} ${2027 + Math.floor((Math.max(1, month) - 1) / 12)}`;

/* ---------- Olaylar ---------- */

export interface Ctx { life: Life; month: number; cash: number; casesThisYear: number }
export interface Choice {
  label: string;
  note?: string;
  /** tek seferlik tutar (eksi: harcama) */
  once?: number;
  /** seçilebilmesi için kasada olması gereken en az tutar */
  needCash?: number;
  apply?: (l: Life, month: number) => Life;
  /** "sonra" seçilirse kaç ay sonra yeniden sorulur */
  snooze?: number;
}
export interface LifeEvent { id: string; title: string; text: (c: Ctx) => string; when: (c: Ctx) => boolean; choices: (c: Ctx) => Choice[]; repeat?: boolean }

const CHILD_NAMES = ["Deniz", "Ada", "Kerem", "Elif", "Yusuf", "Zeynep", "Mert", "Defne"];

export const EVENTS: LifeEvent[] = [
  {
    id: "araba", title: "Araba ihtiyacı",
    text: () => "Adliye, icra daireleri ve cezaevi görüşmeleri arasında toplu taşımayla yetişmek zorlaştı. Bir araç almayı düşünüyorsunuz.",
    when: c => c.month >= 3 && !c.life.car,
    choices: () => [
      { label: "Krediyle sıfır araç", note: "Peşinat 300.000 TL, 36 ay boyunca ayda 28.000 TL; yakıt ve bakım ayda 9.000 TL.", once: -300000, needCash: 300000,
        apply: (l, m) => ({ ...l, car: "kredili", transport: 9000, loans: [...l.loans, { text: "Taşıt kredisi", monthly: 28000, until: m + 36 }] }) },
      { label: "İkinci el, peşin", note: "650.000 TL peşin; yakıt ve bakım ayda 11.000 TL.", once: -650000, needCash: 650000,
        apply: l => ({ ...l, car: "ikinci-el", transport: 11000 }) },
      { label: "Şimdilik almayacağım", note: "Taksi ve toplu taşıma ayda 7.000 TL'ye çıkıyor.", apply: l => ({ ...l, car: "yok", transport: 7000 }) }
    ]
  },
  {
    id: "stajyer", title: "Stajyer avukat başvurusu",
    text: () => "Baroya kayıtlı bir stajyer, stajının avukatlık kısmını büronuzda yapmak istiyor. Dilekçe taslakları ve kalem işlerinde yardımcı olabilir.",
    when: c => c.month >= 4 && !c.life.stajyer,
    choices: () => [
      { label: "Kabul et", note: `Ayda ${STAJYER.toLocaleString("tr-TR")} TL. Her ay masanıza bir dosya fazla gelir.`, apply: l => ({ ...l, stajyer: true }) },
      { label: "Şimdilik hayır", snooze: 6 }
    ], repeat: true
  },
  {
    id: "evlilik", title: "Evlilik",
    text: () => "Uzun süredir birlikte olduğunuz kişi evlilik konusunu açtı. Ailelerle tanışma faslı da çoktan geçti.",
    when: c => c.month >= 6 && !c.life.married && !c.life.divorced,
    choices: () => [
      { label: "Evlenelim", note: "Düğün ve ev kurulumu 350.000 TL; hane geçimi ayda 20.000 TL artar.", once: -350000,
        apply: (l, m) => ({ ...l, married: true, marriedAt: m, strain: 0 }) },
      { label: "Biraz daha bekleyelim", note: "Konu altı ay sonra yeniden açılır.", snooze: 6 }
    ], repeat: true
  },
  {
    id: "cocuk", title: "Çocuk",
    text: c => c.life.children.length ? "Eşiniz ikinci bir çocuk istiyor." : "Eşinizle çocuk sahibi olmayı konuşuyorsunuz.",
    when: c => c.life.married && c.month >= (c.life.marriedAt || 0) + 8 && c.life.children.length < 2,
    choices: c => [
      { label: "Evet", note: "Doğum ve hazırlık 90.000 TL; çocuğun aylık gideri bebeklikte 15.000, kreşte 22.000, okulda 28.000 TL.", once: -90000,
        apply: (l, m) => ({ ...l, children: [...l.children, { name: CHILD_NAMES[(m + l.children.length) % CHILD_NAMES.length], born: m + 1 }] }) },
      { label: "Şimdi değil", note: "Bir yıl sonra yeniden konuşulur.", snooze: 12 }
    ], repeat: true
  },
  {
    id: "kira-artisi", title: "Ev sahibinden kira artışı",
    text: c => `Kira sözleşmenizin yılı doldu. Ev sahibi kirayı artırmak istiyor (şu an ${c.life.homeRent.toLocaleString("tr-TR")} TL).`,
    when: c => !c.life.owner && c.month > 1 && c.month % 12 === 0,
    choices: () => [
      { label: "TÜFE oranında artışı kabul et", note: "Konut kirası artışı on iki aylık TÜFE ortalamasını geçemez (TBK m.344); oyunda %30.", apply: l => ({ ...l, homeRent: Math.round((l.homeRent * 1.3) / 500) * 500 }) },
      { label: "Daha küçük bir eve taşın", note: "Nakliye ve depozito 60.000 TL; kira %15 düşer.", once: -60000, apply: l => ({ ...l, homeRent: Math.round((l.homeRent * 0.85) / 500) * 500 }) }
    ], repeat: true
  },
  {
    id: "katip", title: "Deneyimli büro katibi",
    text: () => "Adliyede yıllarca çalışmış bir büro katibi iş arıyor. İcra takibi ve tebligat işlerini çok iyi biliyor.",
    when: c => c.month >= 8 && !c.life.katip,
    choices: () => [
      { label: "İşe al", note: `Ayda ${KATIP.toLocaleString("tr-TR")} TL. İcra dosyalarında ücretiniz %15 artar ve her ay bir dosya fazla gelir.`, apply: l => ({ ...l, katip: true }) },
      { label: "Hayır", snooze: 8 }
    ], repeat: true
  },
  {
    id: "ev-al", title: "Konut kredisi",
    text: () => "Bankanız avukatlara özel konut kredisi kampanyası yapıyor. Kira ödemek yerine kendi evinizin taksitlerini ödeyebilirsiniz.",
    when: c => c.month >= 12 && !c.life.owner,
    choices: () => [
      { label: "Ev al", note: "Peşinat 1.200.000 TL; 120 ay boyunca ayda 55.000 TL taksit. Kira ödemesi biter.", once: -1200000, needCash: 1200000,
        apply: (l, m) => ({ ...l, owner: true, loans: [...l.loans, { text: "Konut kredisi", monthly: 55000, until: m + 120 }] }) },
      { label: "Kirada devam", snooze: 12 }
    ], repeat: true
  },
  {
    id: "eleman-cikar", title: "Kasa ekside",
    text: () => "Üç aydır kasanız eksi. Kredi kartı ve kredili mevduat faizleri birikiyor. Bir çalışanı çıkarmanız gerekebilir.",
    when: c => c.life.redMonths >= 3 && (c.life.stajyer || c.life.katip),
    choices: c => [
      ...(c.life.katip ? [{ label: "Katibi çıkar", note: "İhbar süresi ücreti ve kıdem tazminatı 70.000 TL.", once: -70000, apply: (l: Life) => ({ ...l, katip: false }) }] : []),
      ...(c.life.stajyer ? [{ label: "Stajyerle yollarınızı ayırın", apply: (l: Life) => ({ ...l, stajyer: false }) }] : []),
      { label: "Kimseyi çıkarma, borçlan", note: "İhtiyaç kredisi: bugün 200.000 TL, 24 ay boyunca ayda 12.500 TL.", once: 200000,
        apply: (l, m) => ({ ...l, loans: [...l.loans, { text: "İhtiyaç kredisi", monthly: 12500, until: m + 24 }] }) }
    ], repeat: true
  },
  {
    id: "evlilik-gerilim", title: "Evde gerilim",
    text: c => `Eşiniz son aylarda neredeyse hiç evde olmadığınızdan yakınıyor${c.life.redMonths ? "; para sıkıntısı da tartışmaları artırıyor" : ""}.`,
    when: c => c.life.married && c.life.strain >= 60,
    choices: () => [
      { label: "Bir hafta tatile çıkalım", note: "80.000 TL; ilişki düzelir.", once: -80000, apply: l => ({ ...l, strain: 10 }) },
      { label: "Aile danışmanına gidelim", note: "Altı ay boyunca ayda 6.000 TL.", apply: (l, m) => ({ ...l, strain: 30, loans: [...l.loans, { text: "Aile danışmanlığı", monthly: 6000, until: m + 6 }] }) },
      { label: "İşim böyle, idare etsin", note: "Gerilim sürer.", apply: l => ({ ...l, strain: l.strain + 15 }) }
    ], repeat: true
  },
  {
    id: "bosanma", title: "Boşanma",
    text: () => "Eşiniz anlaşmalı boşanmak istediğini söyledi. Edinilmiş mallara katılma rejiminde birikimlerin yarısı paylaşılacak.",
    when: c => c.life.married && c.life.strain >= 95,
    choices: c => [
      { label: "Anlaşmalı boşanma", note: `Kasadaki birikimin yarısı ve avukatlık gideri; ${c.life.children.length ? "çocuk başına ayda 12.000 TL iştirak nafakası" : "nafaka yok"}.`,
        once: -Math.max(40000, Math.round(Math.max(0, c.cash) / 2)),
        apply: l => ({ ...l, married: false, divorced: true, strain: 0, alimony: l.children.length * 12000 }) },
      { label: "Son bir şans: birlikte terapi", note: "Ayda 8.000 TL, bir yıl.", apply: (l, m) => ({ ...l, strain: 50, loans: [...l.loans, { text: "Çift terapisi", monthly: 8000, until: m + 12 }] }) }
    ]
  },
  {
    id: "araba-ariza", title: "Arabanız arızalandı",
    text: () => "Duruşmaya giderken arabanın şanzımanı arızalandı.",
    when: c => !!c.life.car && c.life.car !== "yok" && c.month % 9 === 5,
    choices: () => [{ label: "Tamir ettir", note: "45.000 TL.", once: -45000 }], repeat: true
  }
];

/** Bu ay sorulacak olay (en fazla bir tane). */
export function dueEvent(c: Ctx): LifeEvent | null {
  for (const e of EVENTS) {
    if (!e.repeat && c.life.done.includes(e.id)) continue;
    if ((c.life.snooze[e.id] || 0) > c.month) continue;
    if (e.when(c)) return e;
  }
  return null;
}

/** Bir ayın sonunda hayatın kendi kendine değişen kısmı: eksi ay sayısı ve evlilikteki gerilim. */
export function ageLife(l: Life, cash: number, casesThisMonth: number): Life {
  return {
    ...l,
    redMonths: cash < 0 ? l.redMonths + 1 : 0,
    strain: l.married ? Math.max(0, Math.min(100, l.strain + (casesThisMonth > 1 ? 12 : 4) + (cash < 0 ? 8 : -3) - (l.stajyer ? 2 : 0) - (l.katip ? 3 : 0))) : 0
  };
}
