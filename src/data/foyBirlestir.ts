// İki kez açılmış föyü tek föyde birleştirir. Daha dolu (evrakı çok, daha önce açılmış) föy kalır; ötekinin evrakı, işleri,
// duruşmaları, beyanları, notları ve boş alanları ona taşınır; öteki föy silinir. Başka föylerdeki "devamı" ve "ilgili"
// bağlantıları kalan föye çevrilir. Asıl evrak dosyaları aynı kimlikle durduğu için taşınmaz, olduğu yerde kalır.
import { Foy, FoyEvrak, foyGetir, foyKaydet, foyler, foySil } from "./foy";
import { ayniEvrakMi } from "./tekillik";

const doluluk = (f: Foy) => f.evraklar.length * 10 + f.gorevler.length * 3 + (f.durusmalar?.length || 0) * 3 + (f.beyanlar?.length || 0) * 3 + (f.notlar.trim() ? 2 : 0)
  + ["muvekkil", "karsiTaraf", "mahkeme", "esasNo", "davaTuru"].filter(k => String((f as unknown as Record<string, unknown>)[k] || "").trim()).length;

/** Hangisinin kalacağı: daha dolu olan; eşitse daha önce açılan. */
export function kalacakFoy(a: Foy, b: Foy): [Foy, Foy] {
  const fa = doluluk(a), fb = doluluk(b);
  if (fa !== fb) return fa > fb ? [a, b] : [b, a];
  return (a.olusturma || "") <= (b.olusturma || "") ? [a, b] : [b, a];
}

const evrakAnahtari = (e: FoyEvrak) => `${e.ad.toLocaleLowerCase("tr")}|${e.boyut}`;
function birlesikListe<T extends { id: string }>(a: T[] | undefined, b: T[] | undefined, ayni?: (x: T, y: T) => boolean): T[] | undefined {
  if (!a?.length && !b?.length) return a;
  const out = [...(a || [])];
  for (const y of b || []) if (!out.some(x => x.id === y.id || (ayni ? ayni(x, y) : false))) out.push(y);
  return out;
}

/** Saf birleştirme (kaydetmeden): kalan föyün yeni hâli. */
export function foylariBirlestir(kalan: Foy, giden: Foy): Foy {
  const k = kalan as unknown as Record<string, unknown>, g = giden as unknown as Record<string, unknown>;
  const f: Record<string, unknown> = { ...k };
  // Boş alanlar ötekinden dolar.
  for (const alan of ["muvekkil", "karsiTaraf", "mahkeme", "esasNo", "davaTuru", "asama", "acilis", "kapanis", "durusma", "sorumlu", "icra", "komisyon", "degerlendirme", "hesap", "muvekkilBilgi", "karsiBilgi"]) {
    const v = k[alan];
    if ((v === undefined || v === null || (typeof v === "string" && !v.trim())) && g[alan] !== undefined && g[alan] !== "") f[alan] = g[alan];
  }
  if (!kalan.oncekiId && giden.oncekiId && giden.oncekiId !== kalan.id) f.oncekiId = giden.oncekiId;
  const ilgili = [...new Set([...(kalan.ilgiliIds || []), ...(giden.ilgiliIds || [])])].filter(x => x !== kalan.id && x !== giden.id);
  f.ilgiliIds = ilgili.length ? ilgili : undefined;
  f.evraklar = birlesikListe(kalan.evraklar, giden.evraklar, (x, y) => evrakAnahtari(x) === evrakAnahtari(y) || ayniEvrakMi(x, y)) || [];
  f.gorevler = birlesikListe(kalan.gorevler, giden.gorevler, (x, y) => x.metin.trim() === y.metin.trim() && (x.tarih || "") === (y.tarih || "")) || [];
  f.beyanlar = birlesikListe(kalan.beyanlar, giden.beyanlar);
  f.durusmalar = birlesikListe(kalan.durusmalar as ({ id: string } & object)[] | undefined, giden.durusmalar as ({ id: string } & object)[] | undefined,
    (x, y) => (x as { tarih?: string }).tarih === (y as { tarih?: string }).tarih);
  f.talepler = birlesikListe(kalan.talepler as ({ id: string } & object)[] | undefined, giden.talepler as ({ id: string } & object)[] | undefined);
  f.tevkil = birlesikListe(kalan.tevkil as ({ id: string } & object)[] | undefined, giden.tevkil as ({ id: string } & object)[] | undefined);
  f.yzSohbet = kalan.yzSohbet?.length ? kalan.yzSohbet : giden.yzSohbet;
  const n1 = kalan.notlar.trim(), n2 = giden.notlar.trim();
  f.notlar = n2 && n2 !== n1 && !n1.includes(n2) ? (n1 ? n1 + "\n\n" : "") + n2 : kalan.notlar;
  if (giden.durum === "acik") f.durum = "acik";
  f.guncelleme = new Date().toISOString();
  return f as unknown as Foy;
}

/** Birleştirir, kaydeder, öteki föyü siler, bağlantıları çevirir. Şahsi ile büro föyü birleştirilmez. */
export async function foyBirlestir(aId: string, bId: string, baglantiCevir = true): Promise<Foy> {
  const a = await foyGetir(aId), b = await foyGetir(bId);
  if (!a || !b) throw new Error("Föylerden biri bulunamadı.");
  if (!!a.ozel !== !!b.ozel) throw new Error("Şahsi dosya ile büro dosyası birleştirilemez.");
  const [kalan, giden] = kalacakFoy(a, b);
  const yeni = foylariBirlestir(kalan, giden);
  await foyKaydet(yeni);
  // Öteki föyü silerken evrak dosyaları silinmesin: taşınan evrakın asıl dosyası aynı kimlikle durur.
  await foySil({ ...giden, evraklar: giden.evraklar.filter(e => !yeni.evraklar.some(x => x.id === e.id)) });
  if (baglantiCevir) await baglantilariCevir(new Map([[giden.id, yeni.id]]));
  return yeni;
}

/** Silinen föylere işaret eden "devamı" ve "ilgili" bağlantılarını kalan föylere çevirir (toplu birleştirmede bir kez). */
export async function baglantilariCevir(harita: Map<string, string>): Promise<number> {
  let n = 0;
  const cevir = (id: string) => { let x = id; for (let i = 0; i < 10 && harita.has(x); i++) x = harita.get(x)!; return x; };
  for (const x of await foyler()) {
    const once = x.oncekiId && harita.has(x.oncekiId), ilgili = (x.ilgiliIds || []).some(y => harita.has(y));
    if (!once && !ilgili) continue;
    const yeniOnce = once ? cevir(x.oncekiId!) : x.oncekiId;
    await foyKaydet({ ...x, oncekiId: yeniOnce === x.id ? undefined : yeniOnce, ilgiliIds: ilgili ? [...new Set((x.ilgiliIds || []).map(cevir))].filter(y => y !== x.id) : x.ilgiliIds });
    n++;
  }
  return n;
}
