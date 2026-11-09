// Föylerin bulut eşitlemesi (bilgisayar ↔ telefon). Uçtan uca şifreli: avukat bir "eşitleme şifresi" belirler; anahtar bu
// şifreden cihazda türetilir (PBKDF2) ve föyler cihazda AES-256-GCM ile şifrelenip gönderilir. Sunucu (supabase/surum17.sql:
// foy_bulut) yalnız şifreli veri, kayıt kimliği ve güncelleme zamanını görür; şifre ve anahtar hiçbir zaman gönderilmez.
// - Föyün künyesi, görevleri, notları ve değerlendirmesi "foy" kaydında gider; evrak yazıları ayrı "metin:<föy>" kaydında
//   (aynı uçtan uca şifreyle) gider. Bilgisayar eşitlemede indirip saklar; telefon yalnız gerektiğinde indirir.
// - Asıl evrak dosyaları (PDF, UDF…) gönderilmez; bilgisayarda kalır.
// - Şahsi dosyalar zaten şahsi şifreyle şifrelidir; buluta bu şifreli hâliyle, üstüne eşitleme anahtarıyla bir kez daha
//   şifrelenerek gider. Telefonda açmak için şahsi dosya şifresi de gerekir.
// - Çakışmada son değiştirilen kazanır (föyün "guncelleme" zamanı); ancak bu cihazda henüz gönderilmemiş işler ve evraklar
//   kaybolmaz, gelen föye eklenir (birlestir). Silinen föy diğer cihazlardan da silinir.
// - Büroya üyeyse (buro.ts, supabase/surum18.sql) şahsi olmayan föyler kişisel bulut yerine büro bulutunda (buro_foy), büro
//   anahtarıyla şifreli olarak eşitlenir; büronun bütün çalışanları görür. Şahsi dosyalar yine kişisel bulutta kalır.
import { supabase } from "./account";
import {
  ayarOku, ayarYaz, Foy, foyHaber, hamFoyler, hamFoyYaz, hamOzeller, hamOzelYaz, hamSil, kilitBilgisi, KilitBilgi, kilitBilgisiYaz, OzelKayit
} from "./foy";
import { Anahtar, b64, b64Coz, coz, hamAnahtar, hamTuret, kodla, metneCevir, rastgele, sifrele } from "./sifre";
import { buroAnahtari, buroYetkim } from "./buro";
import { buroDosyalariYukle } from "./buroDosya";

const DOGRULAMA = "celse-foy-bulut";
const TABLO = "foy_bulut", ANAHTAR_TABLO = "foy_bulut_anahtar";

interface Satir { kayit_id: string; tur: "foy" | "ozel" | "metin" | "kilit"; iv: string; veri: string; guncelleme: string; silindi: boolean; degisim?: string }
interface CihazAnahtari { uid: string; ham: Uint8Array }

export type BulutDurum =
  | { tur: "giris_yok" }
  | { tur: "kurulum_yok" }            // sunucuda 17. kurulum yapılmamış
  | { tur: "sifre_yok" }              // bu hesapta eşitleme şifresi hiç belirlenmemiş
  | { tur: "cihaz_kapali" }           // şifre var, bu cihazda açılmamış
  | { tur: "acik"; son?: string };

let anahtar: { uid: string; k: Anahtar } | null = null;

export async function oturum(): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user?.id || null;
}

export async function cihazAnahtari(uid: string): Promise<Anahtar | null> {
  if (anahtar?.uid === uid) return anahtar.k;
  const x = await ayarOku<CihazAnahtari>("bulutAnahtar");
  if (!x || x.uid !== uid || !(x.ham instanceof Uint8Array)) return null;
  const k = await hamAnahtar(x.ham);
  anahtar = { uid, k };
  return k;
}

export async function bulutDurumu(): Promise<BulutDurum> {
  const uid = await oturum();
  if (!uid) return { tur: "giris_yok" };
  const sb = supabase()!;
  const r = await sb.from(ANAHTAR_TABLO).select("kullanici_id").eq("kullanici_id", uid).maybeSingle();
  if (r.error) return { tur: "kurulum_yok" };
  if (!r.data) return { tur: "sifre_yok" };
  if (!(await cihazAnahtari(uid))) return { tur: "cihaz_kapali" };
  return { tur: "acik", son: await ayarOku<string>("bulutSon") };
}

/** İlk kez: eşitleme şifresini belirler (bu hesabın bütün cihazlarında aynı şifre kullanılır). */
export async function bulutKur(sifre: string) {
  if (sifre.length < 8) throw new Error("Eşitleme şifresi en az 8 karakter olmalı.");
  const uid = await oturum();
  if (!uid) throw new Error("Önce giriş yapın.");
  const tuz = rastgele(16);
  const ham = await hamTuret(sifre, tuz);
  const k = await hamAnahtar(ham);
  const d = await sifrele(k, kodla(DOGRULAMA));
  const r = await supabase()!.from(ANAHTAR_TABLO).insert({ kullanici_id: uid, tuz: b64(tuz), iv: b64(d.iv), dogrulama: b64(d.veri) });
  if (r.error) throw new Error(/duplicate|unique/i.test(r.error.message) ? "Bu hesapta eşitleme şifresi zaten var; “Bu cihazda aç” deyin." : r.error.message);
  await ayarYaz("bulutAnahtar", { uid, ham } as CihazAnahtari);
  anahtar = { uid, k };
}

/** Başka cihazda: aynı şifreyle eşitlemeyi açar. Yanlış şifrede false. */
export async function bulutAc(sifre: string): Promise<boolean> {
  const uid = await oturum();
  if (!uid) throw new Error("Önce giriş yapın.");
  const r = await supabase()!.from(ANAHTAR_TABLO).select("tuz, iv, dogrulama").eq("kullanici_id", uid).maybeSingle();
  if (r.error || !r.data) throw new Error("Bu hesapta eşitleme şifresi bulunamadı.");
  const ham = await hamTuret(sifre, b64Coz(r.data.tuz));
  const k = await hamAnahtar(ham);
  try {
    if (metneCevir(await coz(k, { iv: b64Coz(r.data.iv), veri: b64Coz(r.data.dogrulama).buffer as ArrayBuffer })) !== DOGRULAMA) return false;
  } catch { return false; }
  await ayarYaz("bulutAnahtar", { uid, ham } as CihazAnahtari);
  // Bu cihaz ilk kez eşitleniyor: her şey baştan çekilsin ve gönderilsin.
  await ayarYaz("bulutCekim", ""); await ayarYaz("bulutGonderilen", {});
  anahtar = { uid, k };
  return true;
}

/** Bu cihazda eşitlemeyi kapatır (föyler cihazda kalır; buluttakiler silinmez). */
export async function bulutCihazdaKapat() {
  anahtar = null;
  await ayarYaz("bulutAnahtar", null);
}

export async function paketle(k: Anahtar, x: unknown) {
  const s = await sifrele(k, kodla(JSON.stringify(x)));
  return { iv: b64(s.iv), veri: b64(s.veri) };
}
export async function ac<T>(k: Anahtar, r: { iv: string; veri: string }): Promise<T> {
  return JSON.parse(metneCevir(await coz(k, { iv: b64Coz(r.iv), veri: b64Coz(r.veri).buffer as ArrayBuffer }))) as T;
}

/** Föyün buluta giden hâli: evrak metinleri ayrı kayıtta (maskeli) gider; kodların karşılıkları (gerçek adlar) hiç gitmez. */
function foyKabugu(f: Foy): Foy {
  return { ...f, evraklar: f.evraklar.map(e => { const { kodlar: _k, maskeli: _m, ...g } = e; return { ...g, metin: "", bulutMetin: !!e.metin || !!e.bulutMetin }; }) };
}
/** Evrak yazıları ayrı "metin:<föy>" kaydında, föyün kendisi gibi uçtan uca şifreli gider. Eskiden yalnız kodlanmış (maskeli)
 *  hâl gidiyordu; kodlu hâlden geri çevirme kayıplı olduğu (tarihler ay-yıla iner, adlar kaybolur) ve öbür bilgisayarda toplu
 *  yükleme, föyleme ve evraktan okuma çalışmadığı için artık asıl yazı gider (t). Eski kayıtlarda değer maskeli metindir (string).
 *  Bu cihazda yazısı olmayan evrakın buluttaki değeri korunur (üzerine yazılıp silinmesin). */
type MetinDeger = string | { t: string };
function maskeliMetinler(f: Foy, uzak?: Record<string, MetinDeger>): Record<string, MetinDeger> {
  const out: Record<string, MetinDeger> = {};
  for (const e of f.evraklar) {
    if (e.metin && e.metin.trim()) out[e.id] = { t: e.metin };
    else if (e.bulutMetin && uzak?.[e.id]) out[e.id] = uzak[e.id];
  }
  return out;
}
const metinAc = (v: MetinDeger | undefined): { metin: string; maskeli?: string; kodlar?: Record<string, string> } | null => {
  if (!v) return null;
  return { metin: typeof v === "string" ? v : v.t || "" };
};
/** Evrak metni kaydını (büro ya da kişisel bulut) okur. */
async function uzakMetin(foyId: string, k: Anahtar, buroId?: string): Promise<Record<string, MetinDeger> | null> {
  const r = buroId
    ? await supabase()!.from(BURO_TABLO).select("iv, veri, silindi").eq("buro_id", buroId).eq("kayit_id", "metin:" + foyId).maybeSingle()
    : await supabase()!.from(TABLO).select("iv, veri, silindi").eq("kayit_id", "metin:" + foyId).maybeSingle();
  if (r.error || !r.data || r.data.silindi || !r.data.veri) return null;
  try { return await ac<Record<string, MetinDeger>>(k, r.data as { iv: string; veri: string }); } catch { return null; }
}
/** Gönderilecek metin paketi: bu cihazda yazısı olmayan evrak varsa buluttaki kayıt önce okunur, üzerine yazılıp silinmesin. */
async function metinPaketi(f: Foy, k: Anahtar, buroId?: string) {
  const eksik = f.evraklar.some(e => !e.metin && e.bulutMetin);
  return maskeliMetinler(f, eksik ? (await uzakMetin(f.id, k, buroId)) || undefined : undefined);
}
/** Bilgisayarda (tarayıcı): başka cihazdan gelen föylerin evrak yazısı buluttan indirilip bu cihazda saklanır (föyün
 *  güncelleme zamanı değişmez). Telefonda yapılmaz; orada yazı gerektiğinde indirilir. */
async function metinleriIndir(yerel: Map<string, Foy>, k: Anahtar, buroId?: string) {
  if (typeof indexedDB === "undefined") return;
  const eksikler = [...yerel.values()].filter(f => !f.ozel && f.evraklar.some(e => !e.metin && e.bulutMetin));
  for (const f of eksikler.slice(0, 300)) {
    const m = await uzakMetin(f.id, k, buroId).catch(() => null);
    if (!m) continue;
    let degisti = false;
    const evraklar = f.evraklar.map(e => {
      if (e.metin || !e.bulutMetin) return e;
      const a = metinAc(m[e.id]);
      if (!a || !a.metin.trim()) return e;
      degisti = true;
      return { ...e, metin: a.metin, ...(a.maskeli ? { maskeli: a.maskeli, kodlar: a.kodlar } : {}) };
    });
    if (degisti) { const y = { ...f, evraklar }; await hamFoyYaz(y); yerel.set(f.id, y); }
  }
}
/** İki sürümü birleştirir: yeni olan esastır; eskide olup yenide olmayan işler ve evraklar (silinmedikçe) eklenir, kapatılmış
 *  iş kapalı kalır, bu cihazdaki evrak metinleri korunur. Büroda iki kişi aynı föye aynı anda iş eklediğinde biri kaybolmaz. */
export function surumBirlestir(yeni: Foy, eski: Foy): Foy {
  const silinen = [...new Set([...(yeni.silinen || []), ...(eski.silinen || [])])].slice(-300);
  const sil = new Set(silinen);
  const gorevler = yeni.gorevler.filter(g => !sil.has(g.id)).map(g => { const o = eski.gorevler.find(y => y.id === g.id); return o?.bitti && !g.bitti ? o : g; });
  for (const g of eski.gorevler) if (!sil.has(g.id) && !gorevler.some(y => y.id === g.id)) gorevler.push(g);
  const evraklar = yeni.evraklar.filter(e => !sil.has(e.id));
  for (const e of eski.evraklar) if (!sil.has(e.id) && !evraklar.some(y => y.id === e.id)) evraklar.push(e);
  // Duruşma akışı, hesap kalemleri, tevkil avukatlar ve talepler de kimliğe göre birleşir. Duruşmada boş kalan kutu öbür
  // sürümde işaretliyse işaret korunur (biri "girildi" der, öbürü e-duruşma kararını işlerse ikisi de kalır).
  const birlestir = <T extends { id: string }>(a?: T[], b?: T[], tamamla?: (x: T, o: T) => T): T[] | undefined => {
    if (!a && !b) return undefined;
    const xs = (a || []).filter(x => !sil.has(x.id)).map(x => { const o = (b || []).find(y => y.id === x.id); return o && tamamla ? tamamla(x, o) : x; });
    for (const x of b || []) if (!sil.has(x.id) && !xs.some(y => y.id === x.id)) xs.push(x);
    return xs;
  };
  const durusmalar = birlestir(yeni.durusmalar, eski.durusmalar, (x, o) => ({ ...o, ...Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined)) }) as typeof x)
    ?.sort((a, b) => a.tarih.localeCompare(b.tarih));
  const kalemler = birlestir(yeni.hesap?.kalemler, eski.hesap?.kalemler);
  const ek = {
    ...(durusmalar ? { durusmalar } : {}),
    ...(kalemler ? { hesap: { ...(eski.hesap || {}), ...(yeni.hesap || {}), kalemler } } : {}),
    ...(yeni.tevkil || eski.tevkil ? { tevkil: birlestir(yeni.tevkil, eski.tevkil) } : {}),
    ...(yeni.talepler || eski.talepler ? { talepler: birlestir(yeni.talepler, eski.talepler) } : {})
  };
  return { ...yeni, gorevler, evraklar, ...ek, ...(silinen.length ? { silinen } : {}) };
}
const metinKoru = (f: Foy, yerel: Foy): Foy => ({ ...f, evraklar: f.evraklar.map(e => { const o = yerel.evraklar.find(y => y.id === e.id); return o && o.metin && !e.metin ? { ...e, metin: o.metin, maskeli: o.maskeli, kodlar: o.kodlar } : e; }) });
/** Gelen föyle bu cihazdakini karşılaştırır. Döner: yazılacak föy (ya da değişiklik yoksa null) ve yeniden gönderilmesi gerekip
 *  gerekmediği. Bu cihazda gönderilmemiş değişiklik varsa iki sürüm birleştirilir; yoksa yeni olan alınır. */
export function gelenFoy(uzak: Foy, yerel: Foy | undefined, gonderilmedi: boolean): { f: Foy | null; gonder: boolean } {
  if (!yerel) return { f: uzak, gonder: false };
  if (!gonderilmedi) return yerel.guncelleme >= uzak.guncelleme ? { f: null, gonder: false } : { f: metinKoru(uzak, yerel), gonder: false };
  if (uzak.guncelleme > yerel.guncelleme) {
    const b = metinKoru(surumBirlestir(uzak, yerel), yerel);
    const ekImza = (x: Foy) => JSON.stringify([x.durusmalar, x.hesap?.kalemler?.length, x.tevkil?.length, x.talepler?.length]);
    const fark = b.gorevler.length !== uzak.gorevler.length || b.evraklar.length !== uzak.evraklar.length || b.gorevler.some((g, i) => g !== uzak.gorevler[i]) || ekImza(b) !== ekImza(uzak);
    return { f: fark ? { ...b, guncelleme: new Date(Math.max(Date.now(), Date.parse(uzak.guncelleme) + 1)).toISOString() } : b, gonder: fark };
  }
  return { f: metinKoru(surumBirlestir(yerel, uzak), yerel), gonder: true };
}

const metinImzasi = (f: Foy) => { const x = f.evraklar.filter(e => e.metin).map(e => e.id + ":" + e.metin.length).join(","); return x ? "v2|" + x : ""; };

export interface EsitlemeSonucu { gelen: number; giden: number; /** büro bulutuna henüz yüklenmemiş asıl dosya sayısı */ dosyaBekleyen?: number }
let calisiyor: Promise<EsitlemeSonucu> | null = null;

/** Çeker, sonra gönderir. Aynı anda ikinci çağrı birincinin sonucunu bekler. */
export function esitle(): Promise<EsitlemeSonucu> {
  if (!calisiyor) calisiyor = esitleIc().finally(() => { calisiyor = null; });
  return calisiyor;
}

async function esitleIc() {
  const uid = await oturum();
  if (!uid) throw new Error("Eşitleme için giriş yapın.");
  const k = await cihazAnahtari(uid);
  if (!k) throw new Error("Bu cihazda eşitleme açık değil.");
  const sb = supabase()!;
  const gonderilen = (await ayarOku<Record<string, string>>("bulutGonderilen")) || {};
  let gelen = 0, giden = 0;

  // 1) Çek: son çekimden beri değişen kayıtlar.
  let cekim = (await ayarOku<string>("bulutCekim")) || "";
  const yerel = new Map((await hamFoyler()).map(f => [f.id, f] as const));
  const ozel = new Map((await hamOzeller()).map(x => [x.id, x] as const));
  // İlk sayfada iki dakikalık bindirme: aynı anda yazılan ve sonradan görünen kayıt kaçmasın (tekrar gelen kayıt zararsızdır).
  const onceki = cekim ? Date.parse(cekim) : NaN;
  let alt = cekim && !isNaN(onceki) ? new Date(onceki - 120000).toISOString() : cekim;
  for (;;) {
    let q = sb.from(TABLO).select("kayit_id, tur, iv, veri, guncelleme, silindi, degisim").neq("tur", "metin").order("degisim", { ascending: true }).limit(200);
    if (alt) q = q.gt("degisim", alt);
    const r = await q;
    if (r.error) throw new Error(r.error.message);
    const xs = (r.data || []) as Satir[];
    for (const x of xs) {
      cekim = x.degisim || cekim;
      const yerelZaman = yerel.get(x.kayit_id)?.guncelleme || ozel.get(x.kayit_id)?.guncelleme || "";
      if (x.tur === "kilit") {
        if (!x.silindi && !(await kilitBilgisi())) {
          const kb = await ac<{ tuz: string; iv: string; veri: string }>(k, x);
          await kilitBilgisiYaz({ tuz: b64Coz(kb.tuz), dogrulama: { iv: b64Coz(kb.iv), veri: b64Coz(kb.veri).buffer as ArrayBuffer } } as KilitBilgi);
        }
        gonderilen.kilit = "1";
        continue;
      }
      if (x.silindi) {
        if ((yerel.has(x.kayit_id) || ozel.has(x.kayit_id)) && yerelZaman <= x.guncelleme) { await hamSil(x.kayit_id); yerel.delete(x.kayit_id); ozel.delete(x.kayit_id); gelen++; }
        delete gonderilen[x.kayit_id];
        continue;
      }
      if (x.tur === "foy") {
        const eski = yerel.get(x.kayit_id);
        const gonderilmedi = !!eski && gonderilen[eski.id] !== eski.guncelleme;
        if (eski && !gonderilmedi && eski.guncelleme >= x.guncelleme) continue;
        const g = gelenFoy(await ac<Foy>(k, x), eski, gonderilmedi);
        if (g.f) { await hamFoyYaz(g.f); yerel.set(g.f.id, g.f); ozel.delete(g.f.id); }
        if (g.gonder) { gelen++; continue; } // birleşen föy bu eşitlemede geri gönderilir
      } else if (x.tur === "ozel") {
        if (yerelZaman && yerelZaman >= x.guncelleme) continue; // bizdeki daha yeni ya da aynı: gönderme adımı halleder
        const o = await ac<{ iv: string; veri: string; guncelleme: string }>(k, x);
        const kayit: OzelKayit = { id: x.kayit_id, guncelleme: o.guncelleme, iv: b64Coz(o.iv), veri: b64Coz(o.veri).buffer as ArrayBuffer };
        await hamOzelYaz(kayit); ozel.set(kayit.id, kayit); yerel.delete(kayit.id);
      }
      gonderilen[x.kayit_id] = x.guncelleme;
      gelen++;
    }
    if (xs.length < 200) break;
    alt = cekim;
  }
  await ayarYaz("bulutCekim", cekim);

  // 1b) Büro: şahsi olmayan föyler büro bulutunda eşitlenir.
  const buro = await buroAnahtari();
  if (!buro) await metinleriIndir(yerel, k).catch(() => {});
  let dosyaBekleyen = 0;
  if (buro) {
    const r = await buroEsitle(buro, yerel);
    gelen += r.gelen; giden += r.giden;
    // Asıl dosyalar (PDF, UDF, fotoğraf): her eşitlemede birkaç tane şifrelenip büro bulutuna yüklenir.
    const d = await buroDosyalariYukle(buro, yerel.values()).catch(() => null);
    dosyaBekleyen = d && !d.kurulumYok && !d.hata ? d.bekleyen : 0;
  }

  // 2) Gönder: bu cihazda değişenler (büroya üyeyken föyler büroya gider; burada yalnız şahsi dosyalar ve kilit).
  // Satırlar 200'lük paketler hâlinde gönderilir (binlerce föyde tek tek istek yerine); her paketten sonra ilerleme kaydedilir,
  // yarıda kalırsa bir sonraki eşitleme kaldığı yerden sürer.
  const metinGonderilen = (await ayarOku<Record<string, string>>("bulutMetinGonderilen")) || {};
  let bekleyen: Satir[] = [];
  const gonder = async () => {
    if (!bekleyen.length) return;
    const r = await sb.from(TABLO).upsert(bekleyen.map(x => ({ kullanici_id: uid, ...x })), { onConflict: "kullanici_id,kayit_id" });
    if (r.error) throw new Error(r.error.message);
    bekleyen = [];
    await ayarYaz("bulutGonderilen", gonderilen);
    await ayarYaz("bulutMetinGonderilen", metinGonderilen);
  };
  const yaz = async (satir: Satir) => { bekleyen.push(satir); if (bekleyen.length >= 200) await gonder(); };
  for (const f of buro ? [] : yerel.values()) {
    if (gonderilen[f.id] === f.guncelleme) continue;
    await yaz({ kayit_id: f.id, tur: "foy", ...(await paketle(k, foyKabugu(f))), guncelleme: f.guncelleme, silindi: false });
    const imza = metinImzasi(f);
    if (imza && metinGonderilen[f.id] !== imza) {
      await yaz({ kayit_id: "metin:" + f.id, tur: "metin", ...(await paketle(k, await metinPaketi(f, k))), guncelleme: f.guncelleme, silindi: false });
      metinGonderilen[f.id] = imza;
    }
    gonderilen[f.id] = f.guncelleme; giden++;
  }
  for (const x of ozel.values()) {
    const z = x.guncelleme || "";
    if (gonderilen[x.id] === z) continue;
    await yaz({ kayit_id: x.id, tur: "ozel", ...(await paketle(k, { iv: b64(x.iv), veri: b64(x.veri), guncelleme: z })), guncelleme: z, silindi: false });
    gonderilen[x.id] = z; giden++;
  }
  const kb = await kilitBilgisi();
  if (kb && gonderilen.kilit !== "1") {
    await yaz({ kayit_id: "kilit", tur: "kilit", ...(await paketle(k, { tuz: b64(kb.tuz), iv: b64(kb.dogrulama.iv), veri: b64(kb.dogrulama.veri) })), guncelleme: "", silindi: false });
    gonderilen.kilit = "1";
  }
  const silinen = buro ? {} : (await ayarOku<Record<string, string>>("bulutSilinen")) || {};
  for (const [id, zaman] of Object.entries(silinen)) {
    await yaz({ kayit_id: id, tur: "foy", iv: "", veri: "", guncelleme: zaman, silindi: true });
    await yaz({ kayit_id: "metin:" + id, tur: "metin", iv: "", veri: "", guncelleme: zaman, silindi: true });
    delete gonderilen[id]; delete metinGonderilen[id]; giden++;
  }
  await gonder();
  if (!buro) await ayarYaz("bulutSilinen", {});
  await ayarYaz("bulutGonderilen", gonderilen);
  await ayarYaz("bulutMetinGonderilen", metinGonderilen);
  const son = new Date().toISOString();
  await ayarYaz("bulutSon", son);
  if (gelen) foyHaber();
  return { gelen, giden, dosyaBekleyen };
}

const BURO_TABLO = "buro_foy";
/** Büro föylerini eşitler: büro anahtarıyla şifreli; önce çeker (birleştirerek), sonra bu cihazda değişenleri gönderir. */
async function buroEsitle(b: { buroId: string; k: Anahtar }, yerel: Map<string, Foy>): Promise<{ gelen: number; giden: number }> {
  const sb = supabase()!;
  const gonderilen = (await ayarOku<Record<string, string>>("buroGonderilen")) || {};
  const metinGonderilen = (await ayarOku<Record<string, string>>("buroMetinGonderilen")) || {};
  let gelen = 0, giden = 0;
  let cekim = (await ayarOku<string>("buroCekim")) || "";
  const onceki = cekim ? Date.parse(cekim) : NaN;
  let alt = cekim && !isNaN(onceki) ? new Date(onceki - 120000).toISOString() : cekim;
  for (;;) {
    let q = sb.from(BURO_TABLO).select("kayit_id, tur, iv, veri, guncelleme, silindi, degisim").eq("buro_id", b.buroId).eq("tur", "foy").order("degisim", { ascending: true }).limit(200);
    if (alt) q = q.gt("degisim", alt);
    const r = await q;
    if (r.error) throw new Error(r.error.message);
    const xs = (r.data || []) as Satir[];
    for (const x of xs) {
      cekim = x.degisim || cekim;
      const eski = yerel.get(x.kayit_id);
      if (x.silindi) {
        if (eski && eski.guncelleme <= x.guncelleme) { await hamSil(x.kayit_id); yerel.delete(x.kayit_id); gelen++; }
        delete gonderilen[x.kayit_id];
        continue;
      }
      const gonderilmedi = !!eski && gonderilen[eski.id] !== eski.guncelleme;
      if (eski && !gonderilmedi && eski.guncelleme >= x.guncelleme) continue;
      const g = gelenFoy(await ac<Foy>(b.k, x), eski, gonderilmedi);
      if (g.f) { await hamFoyYaz(g.f); yerel.set(g.f.id, g.f); }
      if (!g.gonder) gonderilen[x.kayit_id] = x.guncelleme;
      gelen++;
    }
    if (xs.length < 200) break;
    alt = cekim;
  }
  await ayarYaz("buroCekim", cekim);
  await metinleriIndir(yerel, b.k, b.buroId).catch(() => {});

  let bekleyen: Satir[] = [];
  const gonder = async () => {
    if (!bekleyen.length) return;
    const r = await sb.from(BURO_TABLO).upsert(bekleyen.map(x => ({ buro_id: b.buroId, ...x })), { onConflict: "buro_id,kayit_id" });
    if (r.error) throw new Error(r.error.message);
    bekleyen = [];
    await ayarYaz("buroGonderilen", gonderilen);
    await ayarYaz("buroMetinGonderilen", metinGonderilen);
  };
  const yaz = async (satir: Satir) => { bekleyen.push(satir); if (bekleyen.length >= 200) await gonder(); };
  for (const f of yerel.values()) {
    if (gonderilen[f.id] === f.guncelleme) continue;
    await yaz({ kayit_id: f.id, tur: "foy", ...(await paketle(b.k, foyKabugu(f))), guncelleme: f.guncelleme, silindi: false });
    const imza = metinImzasi(f);
    if (imza && metinGonderilen[f.id] !== imza) {
      await yaz({ kayit_id: "metin:" + f.id, tur: "metin", ...(await paketle(b.k, await metinPaketi(f, b.k, b.buroId))), guncelleme: f.guncelleme, silindi: false });
      metinGonderilen[f.id] = imza;
    }
    gonderilen[f.id] = f.guncelleme; giden++;
  }
  // Silinenler: yalnız silme yetkisi olan gönderir (sunucu da denetler); yetkisi yoksa büroda kalır, sonraki çekimde geri gelir.
  const silinen = (await ayarOku<Record<string, string>>("bulutSilinen")) || {};
  const silebilir = ["yonetici", "sil"].includes((await buroYetkim()) || "");
  if (Object.keys(silinen).length && silebilir) {
    for (const [id, zaman] of Object.entries(silinen)) {
      await yaz({ kayit_id: id, tur: "foy", iv: "", veri: "", guncelleme: zaman, silindi: true });
      await yaz({ kayit_id: "metin:" + id, tur: "metin", iv: "", veri: "", guncelleme: zaman, silindi: true });
      delete gonderilen[id]; delete metinGonderilen[id]; giden++;
    }
  }
  await gonder();
  await ayarYaz("bulutSilinen", {});
  // Yetkisiz silinen föy büroda duruyor: bir sonraki eşitlemede baştan çekilip geri gelsin.
  if (Object.keys(silinen).length && !silebilir) { await ayarYaz("buroCekim", ""); await ayarYaz("buroGonderilen", {}); }
  return { gelen, giden };
}

/** Evrak metni bu cihazda yoksa (telefon) buluttan maskeli hâlini getirir; föy değişmez, yalnız dönen kopya doldurulur. */
export async function metinleriGetir(f: Foy): Promise<Foy> {
  if (!f.evraklar.some(e => !e.metin && e.bulutMetin)) return f;
  const uid = await oturum();
  const k = uid ? await cihazAnahtari(uid) : null;
  if (!uid || !k) return f;
  const buro = f.ozel ? null : await buroAnahtari();
  const m = await uzakMetin(f.id, buro ? buro.k : k, buro?.buroId);
  if (!m) return f;
  return { ...f, evraklar: f.evraklar.map(e => { if (e.metin) return e; const a = metinAc(m[e.id]); return a ? { ...e, metin: a.metin, ...(a.maskeli ? { maskeli: a.maskeli, kodlar: a.kodlar } : {}) } : e; }) };
}
