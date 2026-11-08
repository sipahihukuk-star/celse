// Föylerin bulut eşitlemesi (bilgisayar ↔ telefon). Uçtan uca şifreli: avukat bir "eşitleme şifresi" belirler; anahtar bu
// şifreden cihazda türetilir (PBKDF2) ve föyler cihazda AES-256-GCM ile şifrelenip gönderilir. Sunucu (supabase/surum17.sql:
// foy_bulut) yalnız şifreli veri, kayıt kimliği ve güncelleme zamanını görür; şifre ve anahtar hiçbir zaman gönderilmez.
// - Föyün künyesi, görevleri, notları ve değerlendirmesi "foy" kaydında gider; evrak metinleri ayrı "metin:<föy>" kaydında
//   ve her evrak ayrı ayrı maskelenmiş (kişisel veriler kodlanmış) olarak gider. Telefon metni yalnız gerektiğinde indirir.
// - Asıl evrak dosyaları (PDF, UDF…) gönderilmez; bilgisayarda kalır.
// - Şahsi dosyalar zaten şahsi şifreyle şifrelidir; buluta bu şifreli hâliyle, üstüne eşitleme anahtarıyla bir kez daha
//   şifrelenerek gider. Telefonda açmak için şahsi dosya şifresi de gerekir.
// - Çakışmada son değiştirilen kazanır (föyün "guncelleme" zamanı). Silinen föy diğer cihazlardan da silinir.
import { mask } from "../engine/mask";
import { supabase } from "./account";
import {
  ayarOku, ayarYaz, Foy, foyHaber, hamFoyler, hamFoyYaz, hamOzeller, hamOzelYaz, hamSil, kilitBilgisi, KilitBilgi, kilitBilgisiYaz, OzelKayit
} from "./foy";
import { Anahtar, b64, b64Coz, coz, hamAnahtar, hamTuret, kodla, metneCevir, rastgele, sifrele } from "./sifre";

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

async function oturum(): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user?.id || null;
}

async function cihazAnahtari(uid: string): Promise<Anahtar | null> {
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

async function paketle(k: Anahtar, x: unknown) {
  const s = await sifrele(k, kodla(JSON.stringify(x)));
  return { iv: b64(s.iv), veri: b64(s.veri) };
}
async function ac<T>(k: Anahtar, r: { iv: string; veri: string }): Promise<T> {
  return JSON.parse(metneCevir(await coz(k, { iv: b64Coz(r.iv), veri: b64Coz(r.veri).buffer as ArrayBuffer }))) as T;
}
const ekAdlar = (f: Foy) => [f.muvekkil, f.karsiTaraf].map(x => (x || "").trim()).filter(x => x.length > 2);

/** Föyün buluta giden hâli: evrak metinleri ayrı kayıtta (maskeli) gider; kodların karşılıkları (gerçek adlar) hiç gitmez. */
function foyKabugu(f: Foy): Foy {
  return { ...f, evraklar: f.evraklar.map(e => { const { kodlar: _k, maskeli: _m, ...g } = e; return { ...g, metin: "", bulutMetin: !!e.metin || !!e.bulutMetin }; }) };
}
/** Her evrak ayrı ayrı maskelenir (gerçek adlar, numaralar, adresler kodlanır); cihazda hazır maskeli hâli varsa o kullanılır. */
function maskeliMetinler(f: Foy): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of f.evraklar) if (e.metin && e.metin.trim()) out[e.id] = e.maskeli || mask(e.metin, { extra: ekAdlar(f) }).masked;
  return out;
}
const metinImzasi = (f: Foy) => f.evraklar.filter(e => e.metin).map(e => e.id + ":" + e.metin.length).join(",");

let calisiyor: Promise<{ gelen: number; giden: number }> | null = null;

/** Çeker, sonra gönderir. Aynı anda ikinci çağrı birincinin sonucunu bekler. */
export function esitle(): Promise<{ gelen: number; giden: number }> {
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
      if (yerelZaman && yerelZaman >= x.guncelleme) continue; // bizdeki daha yeni ya da aynı: gönderme adımı halleder
      if (x.tur === "foy") {
        const f = await ac<Foy>(k, x);
        const eski = yerel.get(f.id);
        // Bu cihazdaki evrak metinleri korunur (bulutta metin ayrı ve maskeli durur).
        if (eski) f.evraklar = f.evraklar.map(e => { const o = eski.evraklar.find(y => y.id === e.id); return o && o.metin ? { ...e, metin: o.metin, maskeli: o.maskeli, kodlar: o.kodlar } : e; });
        await hamFoyYaz(f); yerel.set(f.id, f); ozel.delete(f.id);
      } else if (x.tur === "ozel") {
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

  // 2) Gönder: bu cihazda değişenler.
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
  for (const f of yerel.values()) {
    if (gonderilen[f.id] === f.guncelleme) continue;
    await yaz({ kayit_id: f.id, tur: "foy", ...(await paketle(k, foyKabugu(f))), guncelleme: f.guncelleme, silindi: false });
    const imza = metinImzasi(f);
    if (imza && metinGonderilen[f.id] !== imza) {
      await yaz({ kayit_id: "metin:" + f.id, tur: "metin", ...(await paketle(k, maskeliMetinler(f))), guncelleme: f.guncelleme, silindi: false });
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
  const silinen = (await ayarOku<Record<string, string>>("bulutSilinen")) || {};
  for (const [id, zaman] of Object.entries(silinen)) {
    await yaz({ kayit_id: id, tur: "foy", iv: "", veri: "", guncelleme: zaman, silindi: true });
    await yaz({ kayit_id: "metin:" + id, tur: "metin", iv: "", veri: "", guncelleme: zaman, silindi: true });
    delete gonderilen[id]; delete metinGonderilen[id]; giden++;
  }
  await gonder();
  await ayarYaz("bulutSilinen", {});
  await ayarYaz("bulutGonderilen", gonderilen);
  await ayarYaz("bulutMetinGonderilen", metinGonderilen);
  const son = new Date().toISOString();
  await ayarYaz("bulutSon", son);
  if (gelen) foyHaber();
  return { gelen, giden };
}

/** Evrak metni bu cihazda yoksa (telefon) buluttan maskeli hâlini getirir; föy değişmez, yalnız dönen kopya doldurulur. */
export async function metinleriGetir(f: Foy): Promise<Foy> {
  if (!f.evraklar.some(e => !e.metin && e.bulutMetin)) return f;
  const uid = await oturum();
  const k = uid ? await cihazAnahtari(uid) : null;
  if (!uid || !k) return f;
  const r = await supabase()!.from(TABLO).select("iv, veri, silindi").eq("kayit_id", "metin:" + f.id).maybeSingle();
  if (r.error || !r.data || r.data.silindi) return f;
  const m = await ac<Record<string, string>>(k, r.data as { iv: string; veri: string });
  return { ...f, evraklar: f.evraklar.map(e => (!e.metin && m[e.id] ? { ...e, metin: m[e.id] } : e)) };
}
