// Müvekkillerim: her müvekkil bir "müvekkil kartı" föyüdür (tür "muvekkil"); bilgileri vekâletnameden okunur (vekaletOku.ts).
// Toplu yüklemede her vekâletnamedeki her vekil eden ayrı müvekkil olur; aynı kişi (kimlik / vergi no ya da aynı ad) birden
// çok vekâletnamede geçiyorsa tek kartta birleşir. Kartlar dava dosyası değildir: Föyler'de, iş listesinde, bağlantı
// önerilerinde görünmez. Dava föylerindeki eksik müvekkil bilgileri (kimlik no, adres, vekâletname) kartlardan tamamlanabilir.
import { bosFoy, Foy, FoyEvrak } from "./foy";
import { adDuzelt, Vekalet, VekilEden, vekaletKunye } from "./vekaletOku";

export const MUVEKKIL = "muvekkil" as const;
export const muvekkilMi = (f: Foy) => f.tur === MUVEKKIL;

/** Ad karşılaştırması: büyük harf, yalnız harf ve rakam. */
export const sadeAd = (x?: string) => (x || "").toLocaleUpperCase("tr").replace(/[^A-ZÇĞİÖŞÜ0-9 ]/g, " ").replace(/\s+/g, " ").trim();
/** Müvekkilin anahtarı: kimlik / vergi no, yoksa adı. */
export const muvekkilAnahtari = (ad: string, kimlikNo?: string) => (kimlikNo && /^\d{10,11}$/.test(kimlikNo) ? "no:" + kimlikNo : "ad:" + sadeAd(ad));
export const kartAnahtari = (f: Foy) => muvekkilAnahtari(f.muvekkil, f.muvekkilBilgi?.kimlikNo);

/** Bir vekâletnamedeki bir vekil edenden müvekkil kartı. */
export function vekaletKarti(ve: VekilEden, v: Vekalet, evrak?: FoyEvrak, simdi = new Date().toISOString()): Foy {
  return bosFoy({
    tur: MUVEKKIL,
    muvekkil: ve.sirket ? ve.ad : adDuzelt(ve.ad),
    mahkeme: v.noterlik || "",
    esasNo: v.yevmiyeNo || "",
    muvekkilBilgi: {
      kimlikNo: ve.kimlikNo || ve.vergiNo,
      adres: ve.adres,
      vekaletname: vekaletKunye(v),
      vekil: v.vekiller.join(", ") || undefined,
      ek: [v.kapsam, v.ozelYetkiler.length ? "Özel yetkiler: " + v.ozelYetkiler.join(", ") : ""].filter(Boolean).join(". ") || undefined
    },
    evraklar: evrak ? [evrak] : [],
    olusturma: simdi, guncelleme: simdi
  });
}

/** Aynı müvekkilin yeni vekâletnamesi: boş alanlar doldurulur, vekâletname evrakı eklenir; daha yeni tarihli vekâlet künyeyi günceller. */
export function kartBirlestir(eski: Foy, yeni: Foy): Foy {
  const eb = eski.muvekkilBilgi || {}, yb = yeni.muvekkilBilgi || {};
  const tarih = (x?: string) => (x || "").match(/(\d{2})\.(\d{2})\.(\d{4})/)?.slice(1).reverse().join("-") || "";
  const yeniDahaYeni = tarih(yb.vekaletname) > tarih(eb.vekaletname);
  const evraklar = [...eski.evraklar, ...yeni.evraklar.filter(e => !eski.evraklar.some(x => x.ad === e.ad && x.boyut === e.boyut))];
  return {
    ...eski,
    muvekkil: eski.muvekkil || yeni.muvekkil,
    mahkeme: yeniDahaYeni && yeni.mahkeme ? yeni.mahkeme : eski.mahkeme || yeni.mahkeme,
    esasNo: yeniDahaYeni && yeni.esasNo ? yeni.esasNo : eski.esasNo || yeni.esasNo,
    muvekkilBilgi: {
      ...eb,
      kimlikNo: eb.kimlikNo || yb.kimlikNo,
      adres: eb.adres || yb.adres,
      vekaletname: yeniDahaYeni ? yb.vekaletname : eb.vekaletname || yb.vekaletname,
      vekil: eb.vekil || yb.vekil,
      ek: yeniDahaYeni ? yb.ek || eb.ek : eb.ek || yb.ek
    },
    evraklar,
    guncelleme: new Date().toISOString()
  };
}

export interface OkunanVekalet { kaynak: string; vekalet: Vekalet; evrak?: FoyEvrak }
/** Okunan vekâletnamelerden kartlar: yeni olanlar ve var olan kartlarla birleşenler; vekil edeni okunamayanlar ayrıca. */
export function vekaletlerdenKartlar(okunanlar: OkunanVekalet[], mevcut: Foy[]): { yeni: Foy[]; guncel: Foy[]; okunamayan: string[] } {
  const varOlan = new Map(mevcut.filter(muvekkilMi).map(f => [kartAnahtari(f), f] as const));
  // Kimlik no'suz eski kartlar adlarıyla da bulunsun.
  for (const f of mevcut.filter(muvekkilMi)) varOlan.set("ad:" + sadeAd(f.muvekkil), varOlan.get("ad:" + sadeAd(f.muvekkil)) || f);
  const yeni = new Map<string, Foy>();
  const guncel = new Map<string, Foy>();
  const okunamayan: string[] = [];
  for (const o of okunanlar) {
    if (!o.vekalet.vekilEdenler.length) { okunamayan.push(o.kaynak); continue; }
    for (const ve of o.vekalet.vekilEdenler) {
      const kart = vekaletKarti(ve, o.vekalet, o.evrak);
      const a = kartAnahtari(kart), aAd = "ad:" + sadeAd(kart.muvekkil);
      const v = guncel.get(a) || varOlan.get(a) || (a.startsWith("ad:") ? undefined : guncel.get(aAd) || varOlan.get(aAd));
      // Var olan kartla aynı kişi: kimlik no'su farklı ve ikisi de doluysa aynı ad başka kişidir.
      if (v && !(v.muvekkilBilgi?.kimlikNo && kart.muvekkilBilgi?.kimlikNo && v.muvekkilBilgi.kimlikNo !== kart.muvekkilBilgi.kimlikNo)) { guncel.set(kartAnahtari(v), kartBirlestir(v, kart)); continue; }
      const y = yeni.get(a);
      yeni.set(a, y ? kartBirlestir(y, kart) : kart);
    }
  }
  return { yeni: [...yeni.values()], guncel: [...guncel.values()], okunamayan };
}

/** Müvekkilin dava dosyaları: aynı kimlik no ya da aynı ad (müvekkil ya da öteki müvekkiller arasında). */
export function kartDosyalari(kart: Foy, dosyalar: Foy[]): Foy[] {
  const no = kart.muvekkilBilgi?.kimlikNo, ad = sadeAd(kart.muvekkil);
  return dosyalar.filter(f => !muvekkilMi(f) && (
    (no && (f.muvekkilBilgi?.kimlikNo === no || (f.ekMuvekkiller || []).some(x => x.kimlikNo === no))) ||
    (ad && (sadeAd(f.muvekkil) === ad || (f.ekMuvekkiller || []).some(x => sadeAd(x.ad) === ad)))));
}

/** Dava föylerindeki eksik müvekkil bilgilerini kartlardan tamamlar (yalnız boş alanlar; yazılmış olan değişmez). */
export function dosyalariTamamla(kartlar: Foy[], dosyalar: Foy[]): Foy[] {
  const noIle = new Map<string, Foy>(), adIle = new Map<string, Foy | null>();
  for (const k of kartlar.filter(muvekkilMi)) {
    if (k.muvekkilBilgi?.kimlikNo) noIle.set(k.muvekkilBilgi.kimlikNo, k);
    const a = sadeAd(k.muvekkil);
    // Aynı adlı iki kart varsa adla eşleştirme yapılmaz (yanlış kişiye yazılmasın).
    adIle.set(a, adIle.has(a) ? null : k);
  }
  const out: Foy[] = [];
  for (const f of dosyalar) {
    if (muvekkilMi(f) || !f.muvekkil.trim()) continue;
    const mb = f.muvekkilBilgi || {};
    const k = (mb.kimlikNo && noIle.get(mb.kimlikNo)) || adIle.get(sadeAd(f.muvekkil));
    if (!k) continue;
    const kb = k.muvekkilBilgi || {};
    const ek = { kimlikNo: mb.kimlikNo || kb.kimlikNo, adres: mb.adres || kb.adres, vekaletname: mb.vekaletname || kb.vekaletname, telefon: mb.telefon || kb.telefon, eposta: mb.eposta || kb.eposta };
    if ((Object.keys(ek) as (keyof typeof ek)[]).every(x => (ek[x] || "") === (mb[x] || ""))) continue;
    out.push({ ...f, muvekkilBilgi: { ...mb, ...ek }, guncelleme: new Date().toISOString() });
  }
  return out;
}
