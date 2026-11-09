// Avukatın özel hayatı: kişisel giderler (ev kirası, geçim), aile, araba, ev, büro çalışanları ve zamanla çıkan olaylar.
// Her ay sonunda (bir dava bitince ya da "ayı kapat" denince) koşulu tutan bir olay çıkabilir; oyuncu seçer,
// seçimin tek seferlik ve aylık gideri olur. Tutarlar 2027 için oyun içi yaklaşık değerlerdir.
import { t } from "../i18n";
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
  /** ortak bürodaki masadan kendi bürosuna geçti mi */
  ownOffice?: boolean;
  /** tamamlanan eğitimler: "en", "fr", "yl", "dr" */
  degrees?: string[];
  /** süren eğitimler */
  study?: { id: string; until: number }[];
  /** aileden en son borç alınan ay */
  familyLoanAt?: number;
  /** giderlerin genç avukata göre yeniden ayarlandığı sürüm */
  v2?: boolean;
  /** en son hayat olayının sorulduğu ay (olaylar arasında en az birkaç ay geçer) */
  lastEventAt?: number;
  /** her olayın en son sorulduğu ay (aynı olay üst üste gelmesin, sıra hepsine gelsin) */
  sorulan?: Record<string, number>;
}

/* ---------- Mesleki gelişim ---------- */

export interface Edu { id: "en" | "fr" | "yl" | "dr"; label: string; months: number; monthly: number; needs?: string; slow?: boolean; gain: string }
export const EDU: Edu[] = [
  { id: "en", label: "İngilizce hukuk dili kursu", months: 6, monthly: 6000,
    gain: "Uluslararası mahkeme ve tahkim dosyalarında İngilizce savunmanız ek puan alır, bu dosyalarda ücretiniz %10 artar." },
  { id: "fr", label: "Fransızca hukuk dili kursu", months: 6, monthly: 6000,
    gain: "AİHM ve UCM dosyalarında Fransızca savunmanız ek puan alır, bu dosyalarda ücretiniz %10 artar." },
  { id: "yl", label: "Tezli yüksek lisans", months: 18, monthly: 5000, slow: true,
    gain: "Okurken ayda bir dosya eksik gelir. Bitince vekâlet ücretleriniz %10, rutin büro geliriniz %15 artar." },
  { id: "dr", label: "Doktora", months: 30, monthly: 6500, needs: "yl", slow: true,
    gain: "Okurken ayda bir dosya eksik gelir. Bitince ücretleriniz toplam %20 artar ve yüksek yargı bölümleri bir dava erken açılır." }
];
export const hasDegree = (l: Life | undefined, id: string) => !!l?.degrees?.includes(id);
export const studying = (l: Life | undefined) => (l?.study || []);

/** Eski kayıtlardaki yüksek giderleri genç avukata uygun düzeye çeker (bir kez). */
export function migrateLife(l: Life, city: string): Life {
  if (l.v2) return l;
  const fresh = newLife(city);
  return { ...l, v2: true, homeRent: l.owner ? l.homeRent : Math.min(l.homeRent, fresh.homeRent), living: Math.min(l.living, fresh.living), transport: Math.min(l.transport, l.car && l.car !== "yok" ? l.transport : fresh.transport) };
}

export const STAJYER = 22000, KATIP = 35000;

export function newLife(city: string): Life {
  const c = CITIES.find(x => x.id === city) || CITIES[0];
  // Mesleğe yeni başlayan avukat: küçük bir kiralık ev, sade bir geçim, toplu taşıma.
  return {
    homeRent: Math.max(9000, Math.round((c.rent * 0.5) / 500) * 500), living: 17000, owner: false, married: false,
    children: [], transport: 2500, loans: [], stajyer: false, katip: false, strain: 0, snooze: {}, done: [], redMonths: 0, v2: true,
    degrees: [], study: []
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
  (l.study || []).forEach(x => { const e = EDU.find(d => d.id === x.id); if (e) items.push({ text: `${e.label} (harç ve kurs ücreti)`, amount: e.monthly }); });
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
/** Ekranda gösterilir (saklanmaz); ay adı seçili dile çevrilir. */
export const dateOf = (month: number) => `${t(AYLAR[(Math.max(1, month) - 1) % 12])} ${2027 + Math.floor((Math.max(1, month) - 1) / 12)}`;

/* ---------- Olaylar ---------- */

export interface Ctx { life: Life; month: number; cash: number; casesThisYear: number; wins?: number }
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
    id: "borc", title: "Ay sonunda kasa eksi",
    // Olay metinleri ve notlar yalnızca ekranda gösterilir; değişkenli olanlar burada çevrilir, başlık ve seçenek adları (defterde saklanır) ekranda.
    text: c => t("Giderleri karşılayamadınız; kasa {kasa} TL. Ayı çıkarmak için bir yerden para bulmanız gerekiyor. Eksi bakiyeye her ay %4,5 faiz işler.", { kasa: Math.round(c.cash).toLocaleString("tr-TR") }),
    when: c => c.cash < 0,
    choices: c => [
      ...(c.month - (c.life.familyLoanAt ?? -99) >= 12 ? [{ label: "Ailenizden borç isteyin", note: "Bugün 60.000 TL; faizsiz, 10 ay boyunca ayda 6.000 TL geri ödersiniz. Aile yılda bir kez yardım edebilir.", once: 60000,
        apply: (l: Life, m: number) => ({ ...l, familyLoanAt: m, loans: [...l.loans, { text: "Aileye borç", monthly: 6000, until: m + 10 }] }) }] : []),
      { label: "Bir meslektaşınızdan borç alın", note: "Bugün 30.000 TL; 6 ay boyunca ayda 5.500 TL (küçük bir fark ekleyerek) ödersiniz.", once: 30000,
        apply: (l, m) => ({ ...l, loans: [...l.loans, { text: "Meslektaşa borç", monthly: 5500, until: m + 6 }] }) },
      { label: "Bankadan ihtiyaç kredisi", note: "Bugün 150.000 TL; 18 ay boyunca ayda 11.900 TL taksit.", once: 150000,
        apply: (l, m) => ({ ...l, loans: [...l.loans, { text: "İhtiyaç kredisi", monthly: 11900, until: m + 18 }] }) },
      { label: "Kredili mevduatla idare edin", note: "Borç almazsınız; eksi bakiyeye her ay %4,5 faiz işler. İki ay sonra yeniden sorulur.", snooze: 2 }
    ], repeat: true
  },
  {
    id: "kendi-buro", title: "Kendi büronuz",
    text: () => "Ortak bürodaki masanız artık dar geliyor. Adliyeye yakın, kendi tabelanızı asabileceğiniz bir büro boşalmış.",
    when: c => (c.wins || 0) >= 5 && !c.life.ownOffice,
    choices: () => [
      { label: "Kendi büronuzu açın", note: "Depozito ve mobilya 120.000 TL. Tam büro kirası ödersiniz; ücretleriniz %10 artar ve her ay bir dosya fazla gelir.", once: -120000, needCash: 120000,
        apply: l => ({ ...l, ownOffice: true }) },
      { label: "Ortak büroda kalın", note: "Altı ay sonra yeniden sorulur.", snooze: 6 }
    ], repeat: true
  },
  {
    id: "araba", title: "Araba ihtiyacı",
    text: () => "Adliye, icra daireleri ve cezaevi görüşmeleri arasında toplu taşımayla yetişmek zorlaştı. Bir araç almayı düşünüyorsunuz.",
    when: c => c.month >= 6 && !c.life.car,
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
    when: c => c.month >= 7 && !c.life.stajyer,
    choices: () => [
      { label: "Kabul et", note: t("Ayda {tutar} TL. Her ay masanıza bir dosya fazla gelir.", { tutar: STAJYER.toLocaleString("tr-TR") }), apply: l => ({ ...l, stajyer: true }) },
      { label: "Şimdilik hayır", snooze: 6 }
    ], repeat: true
  },
  {
    id: "evlilik", title: "Evlilik",
    text: () => "Uzun süredir birlikte olduğunuz kişi evlilik konusunu açtı. Ailelerle tanışma faslı da çoktan geçti.",
    // Evlilik mesleğin ilk yıllarında hemen gelmez: en az bir buçuk yıl ve birkaç kazanılmış dava.
    when: c => c.month >= 18 && (c.wins || 0) >= 3 && !c.life.married && !c.life.divorced,
    choices: () => [
      { label: "Evlenelim", note: "Düğün ve ev kurulumu 350.000 TL; hane geçimi ayda 20.000 TL artar.", once: -350000,
        apply: (l, m) => ({ ...l, married: true, marriedAt: m, strain: 0 }) },
      { label: "Biraz daha bekleyelim", note: "Konu bir yıl sonra yeniden açılır.", snooze: 12 }
    ], repeat: true
  },
  {
    id: "cocuk", title: "Çocuk",
    text: c => c.life.children.length ? "Eşiniz ikinci bir çocuk istiyor." : "Eşinizle çocuk sahibi olmayı konuşuyorsunuz.",
    // İlk çocuk evlilikten en az bir buçuk yıl, ikincisi ilk çocuktan en az iki buçuk yıl sonra konuşulur.
    when: c => c.life.married && c.month >= (c.life.marriedAt || 0) + 18 && c.life.children.length < 2
      && (!c.life.children.length || c.month >= c.life.children[c.life.children.length - 1].born + 30),
    choices: c => [
      { label: "Evet", note: "Doğum ve hazırlık 90.000 TL; çocuğun aylık gideri bebeklikte 15.000, kreşte 22.000, okulda 28.000 TL.", once: -90000,
        apply: (l, m) => ({ ...l, children: [...l.children, { name: CHILD_NAMES[(m + l.children.length) % CHILD_NAMES.length], born: m + 1 }] }) },
      { label: "Şimdi değil", note: "Bir buçuk yıl sonra yeniden konuşulur.", snooze: 18 }
    ], repeat: true
  },
  {
    id: "kira-artisi", title: "Ev sahibinden kira artışı",
    text: c => t("Kira sözleşmenizin yılı doldu. Ev sahibi kirayı artırmak istiyor (şu an {tutar} TL).", { tutar: c.life.homeRent.toLocaleString("tr-TR") }),
    when: c => !c.life.owner && c.month > 1 && c.month % 12 === 0,
    choices: () => [
      { label: "TÜFE oranında artışı kabul et", note: "Konut kirası artışı on iki aylık TÜFE ortalamasını geçemez (TBK m.344); oyunda %30.", apply: l => ({ ...l, homeRent: Math.round((l.homeRent * 1.3) / 500) * 500 }) },
      { label: "Daha küçük bir eve taşın", note: "Nakliye ve depozito 60.000 TL; kira %15 düşer.", once: -60000, apply: l => ({ ...l, homeRent: Math.round((l.homeRent * 0.85) / 500) * 500 }) }
    ], repeat: true
  },
  {
    id: "katip", title: "Deneyimli büro katibi",
    text: () => "Adliyede yıllarca çalışmış bir büro katibi iş arıyor. İcra takibi ve tebligat işlerini çok iyi biliyor.",
    when: c => c.month >= 12 && !c.life.katip,
    choices: () => [
      { label: "İşe al", note: t("Ayda {tutar} TL. İcra dosyalarında ücretiniz %15 artar ve her ay bir dosya fazla gelir.", { tutar: KATIP.toLocaleString("tr-TR") }), apply: l => ({ ...l, katip: true }) },
      { label: "Hayır", snooze: 10 }
    ], repeat: true
  },
  {
    id: "ev-al", title: "Konut kredisi",
    text: () => "Bankanız avukatlara özel konut kredisi kampanyası yapıyor. Kira ödemek yerine kendi evinizin taksitlerini ödeyebilirsiniz.",
    when: c => c.month >= 24 && !c.life.owner,
    choices: () => [
      { label: "Ev al", note: "Peşinat 1.200.000 TL; 120 ay boyunca ayda 55.000 TL taksit. Kira ödemesi biter.", once: -1200000, needCash: 1200000,
        apply: (l, m) => ({ ...l, owner: true, loans: [...l.loans, { text: "Konut kredisi", monthly: 55000, until: m + 120 }] }) },
      { label: "Kirada devam", snooze: 18 }
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
    text: c => c.life.redMonths ? t("Eşiniz son aylarda neredeyse hiç evde olmadığınızdan yakınıyor; para sıkıntısı da tartışmaları artırıyor.") : t("Eşiniz son aylarda neredeyse hiç evde olmadığınızdan yakınıyor."),
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
      { label: "Anlaşmalı boşanma", note: c.life.children.length ? t("Kasadaki birikimin yarısı ve avukatlık gideri; çocuk başına ayda 12.000 TL iştirak nafakası.") : t("Kasadaki birikimin yarısı ve avukatlık gideri; nafaka yok."),
        once: -Math.max(40000, Math.round(Math.max(0, c.cash) / 2)),
        apply: l => ({ ...l, married: false, divorced: true, strain: 0, alimony: l.children.length * 12000 }) },
      { label: "Son bir şans: birlikte terapi", note: "Ayda 8.000 TL, bir yıl.", apply: (l, m) => ({ ...l, strain: 50, loans: [...l.loans, { text: "Çift terapisi", monthly: 8000, until: m + 12 }] }) }
    ]
  },
  // ── İlerleyen yıllarda çıkan sıkıntılar (her ay değil; ayına göre ara sıra) ──
  {
    id: "ucret-odenmiyor", title: "Müvekkil ücreti ödemiyor",
    text: () => "Davasını kazandığınız bir müvekkil, sözleşmedeki vekâlet ücretinin kalan kısmını ödemiyor; telefonlarınıza da çıkmıyor.",
    when: c => c.month >= 10 && (c.wins || 0) >= 2 && sans(c, "ucret-odenmiyor", 0.25),
    choices: () => [
      { label: "Ücret alacağı için icra takibi başlatın", note: "Takip masrafı düşüldükten sonra 40.000 TL tahsil edilir (Av.K. m.39 hapis hakkı da var).", once: 40000, snooze: 12 },
      { label: "Bir kez daha konuşun, indirim yapın", note: "Müvekkil 25.000 TL öder; ilişki bozulmaz.", once: 25000, snooze: 12 },
      { label: "Peşine düşmeyin", note: "Alacak kaybolur.", snooze: 12 }
    ], repeat: true
  },
  {
    id: "baro-sikayet", title: "Baroya şikâyet",
    text: () => "Kaybedilen bir davanın karşı tarafı, sizi “duruşmada hakaret etti” diye baroya şikâyet etmiş. Disiplin kurulu savunmanızı istiyor.",
    when: c => c.month >= 14 && sans(c, "baro-sikayet", 0.15),
    choices: () => [
      { label: "Savunmayı kendiniz yazın", note: "Tutanakları ve tanık beyanlarını toplamak için birkaç gece geç saate kadar çalışırsınız; evde gerilim artar.", apply: l => ({ ...l, strain: l.married ? Math.min(100, l.strain + 10) : l.strain }), snooze: 12 },
      { label: "Kıdemli bir meslektaştan destek alın", note: "Savunma ücreti 20.000 TL; şikâyet kovuşturmaya yer olmadığı kararıyla kapanır.", once: -20000, snooze: 12 }
    ], repeat: true
  },
  {
    id: "vergi", title: "Vergi dairesinden yazı",
    text: () => "Vergi dairesi, geçen yılın serbest meslek makbuzlarıyla banka hareketleriniz arasında fark görmüş; açıklama istiyor.",
    when: c => c.month >= 16 && c.month % 12 >= 3 && c.month % 12 <= 5 && sans(c, "vergi", 0.4),
    choices: () => [
      { label: "Mali müşavirle düzeltme beyannamesi verin", note: "Fark vergisi ve müşavir ücreti 30.000 TL; ceza indirimi uygulanır.", once: -30000, snooze: 12 },
      { label: "Belgelerle itiraz edin", note: "Masraf 6.000 TL; belgeleriniz tamsa mesele kapanır, değilse bir yıl sonra yeniden gelir.", once: -6000, snooze: 12 }
    ], repeat: true
  },
  {
    id: "buro-hasar", title: "Büroda su baskını",
    text: () => "Üst kattaki tesisat patladı; büronun tavanından su geldi, dosya dolabının alt rafları ıslandı.",
    when: c => c.month >= 12 && sans(c, "buro-hasar", 0.08),
    choices: () => [
      { label: "Hemen tamir ettirip dosyaları kurtarın", note: "Tadilat ve dosyaların kurutulması 35.000 TL; masrafı üst kat komşusundan isteyebilirsiniz (TBK m.49).", once: -35000, snooze: 12 },
      { label: "Komşunun sigortasına başvurun", note: "Masrafın çoğunu sigorta öder; sizden 10.000 TL çıkar ama iki hafta düzensiz çalışırsınız.", once: -10000, snooze: 12 }
    ], repeat: true
  },
  {
    id: "ebeveyn", title: "Ailenizin bakıma ihtiyacı var",
    text: () => "Memleketteki anneniz yalnız yaşamakta zorlanıyor; günlük işlerine yardım edecek birine ihtiyacı var.",
    when: c => c.month >= 30 && sans(c, "ebeveyn", 0.12),
    choices: () => [
      { label: "Yarı zamanlı bakıcı tutun", note: "Bir yıl boyunca ayda 15.000 TL.", apply: (l, m) => ({ ...l, loans: [...l.loans, { text: "Annenize bakıcı", monthly: 15000, until: m + 12 }] }), snooze: 12 },
      { label: "Hafta sonları siz gidin", note: "Para çıkmaz ama yorulursunuz; evde gerilim artar.", apply: l => ({ ...l, strain: l.married ? Math.min(100, l.strain + 15) : l.strain }), snooze: 12 }
    ]
  },
  {
    id: "yorgunluk", title: "Yorgunluk",
    text: () => "Aylardır hafta sonu da dosya çalışıyorsunuz. Sabahları güçlükle kalkıyor, duruşma saatlerini karıştırmaya başlıyorsunuz.",
    when: c => c.month >= 20 && sans(c, "yorgunluk", 0.1),
    choices: () => [
      { label: "İki hafta izin yapın", note: "Kaçan iş ve tatil 50.000 TL; evdeki gerilim de azalır.", once: -50000, apply: l => ({ ...l, strain: Math.max(0, l.strain - 20) }), snooze: 12 },
      { label: "Devam edin", note: "Bir şey olmaz gibi görünür; evde gerilim artar.", apply: l => ({ ...l, strain: l.married ? Math.min(100, l.strain + 10) : l.strain }), snooze: 8 }
    ], repeat: true
  },
  {
    id: "stajyer-bitti", title: "Stajyeriniz ruhsat aldı",
    text: () => "Stajyeriniz stajını tamamlayıp ruhsatını aldı. Büronuzda avukat olarak kalmak istiyor.",
    when: c => c.life.stajyer && c.month >= 20 && sans(c, "stajyer-bitti", 0.15),
    choices: () => [
      { label: "Ücretli avukat olarak işe alın", note: "Ayda 40.000 TL; her ay masanıza bir dosya fazla gelmeye devam eder.", apply: (l, m) => ({ ...l, loans: [...l.loans, { text: "Çalışan avukat ücreti", monthly: 40000 - STAJYER, until: m + 600 }] }), snooze: 12 },
      { label: "Teşekkür edip uğurlayın", note: "Stajyer ayrılır; yeni bir stajyer başvurusu ileride gelebilir.", apply: l => ({ ...l, stajyer: false }), snooze: 12 }
    ]
  },
  {
    id: "araba-ariza", title: "Arabanız arızalandı",
    text: () => "Duruşmaya giderken arabanın şanzımanı arızalandı.",
    when: c => !!c.life.car && c.life.car !== "yok" && c.month % 9 === 5,
    choices: () => [{ label: "Tamir ettir", note: "45.000 TL.", once: -45000 }], repeat: true
  }
];

/** Olayların ara sıra çıkması için aya ve olaya göre sabit (kayıt yeniden yüklenince değişmeyen) bir şans. */
export function sans(c: Ctx, id: string, oran: number): boolean {
  let h = 2166136261;
  for (const ch of id + ":" + c.month) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000 < oran;
}

/** Ertelenemeyen olaylar (para sıkıntısı, boşanma): araya ay koyma kuralına takılmaz. */
const ACIL = new Set(["borc", "eleman-cikar", "bosanma"]);
/** İki hayat olayı arasında en az bu kadar ay geçer; hayat davalardan hızlı akmaz. */
export const OLAY_ARASI = 3;

/** Bu ay sorulacak olay (en fazla bir tane). Acil olanlar her ay; diğerleri son olaydan en az OLAY_ARASI ay sonra. */
export function dueEvent(c: Ctx): LifeEvent | null {
  const sakin = c.month - (c.life.lastEventAt ?? -99) >= OLAY_ARASI;
  const uygun = EVENTS.filter(e => {
    if (!e.repeat && c.life.done.includes(e.id)) return false;
    if ((c.life.snooze[e.id] || 0) > c.month) return false;
    if (!ACIL.has(e.id) && !sakin) return false;
    return e.when(c);
  });
  const acil = uygun.find(e => ACIL.has(e.id));
  if (acil) return acil;
  // En uzun süredir sorulmayan olay önce gelir; hiç sorulmamışlar en önde (aynı öneri üst üste gelmez).
  const son = (e: LifeEvent) => c.life.sorulan?.[e.id] ?? -999;
  return uygun.sort((a, b) => son(a) - son(b))[0] || null;
}

/** Bir ayın sonunda hayatın kendi kendine değişen kısmı: eksi ay sayısı ve evlilikteki gerilim. */
export function ageLife(l: Life, cash: number, casesThisMonth: number): Life {
  return {
    ...l,
    redMonths: cash < 0 ? l.redMonths + 1 : 0,
    strain: l.married ? Math.max(0, Math.min(100, l.strain + (casesThisMonth > 1 ? 12 : 4) + (cash < 0 ? 8 : -3) - (l.stajyer ? 2 : 0) - (l.katip ? 3 : 0))) : 0
  };
}
