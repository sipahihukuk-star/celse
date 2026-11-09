// Büro ve çalışanlar: avukat, stajyer avukat, katip… kendi hesaplarıyla büroya katılır, büronun föylerini ve kendilerine
// atanan işleri görür. Sunucu: supabase/surum18.sql.
// Şifreleme: büro kurulurken kurucunun cihazında rastgele bir büro anahtarı üretilir. Her üyede bu anahtar, üyenin kendi
// eşitleme anahtarıyla şifrelenip buro_uye satırında durur (üyenin öbür cihazları da açabilsin). Davet kodu tek kullanımlıktır:
// büro anahtarı koddan türetilen anahtarla şifrelenip davete konur; sunucuda kodun yalnız özeti vardır, kod hiç gönderilmez.
// Yetkiler sunucuda da uygulanır (yonetici: çalışan yönetir ve siler; sil: yazar ve siler; yaz: yazar, silemez).
import { sha256 } from "@noble/hashes/sha2.js";
import { supabase } from "./account";
import { ayarOku, ayarYaz } from "./foy";
import { ac, cihazAnahtari, oturum, paketle } from "./foyBulut";
import { Anahtar, b64, b64Coz, coz, hamAnahtar, hamTuret, kodla, metneCevir, rastgele, sifrele } from "./sifre";

export type Yetki = "yonetici" | "sil" | "yaz";
export const UNVANLAR: { ad: string; yetki: Yetki }[] = [
  { ad: "Kurucu avukat", yetki: "yonetici" }, { ad: "Ortak avukat", yetki: "yonetici" }, { ad: "Avukat", yetki: "sil" },
  { ad: "Stajyer avukat", yetki: "yaz" }, { ad: "Katip", yetki: "yaz" }, { ad: "Sekreter", yetki: "yaz" },
  { ad: "Büro müdürü", yetki: "yaz" }, { ad: "Muhasebe", yetki: "yaz" }, { ad: "Arabulucu", yetki: "yaz" }, { ad: "Danışman", yetki: "yaz" }
];
export const YETKI_AD: Record<Yetki, string> = { yonetici: "Yönetici: çalışan ekler, çıkarır, föy siler", sil: "Föy yazar ve siler", yaz: "Föy yazar, silemez" };
export const unvanYetkisi = (unvan: string): Yetki => UNVANLAR.find(x => x.ad === unvan)?.yetki || "yaz";

export interface Uye { kullanici_id: string; ad: string; unvan: string; yetki: Yetki; katilma: string }
export interface Davet { id: string; ad: string; unvan: string; yetki: Yetki; son: string }
export interface BuroBilgi { id: string; ad: string; kurucu: string; ben: Uye; uyeler: Uye[]; davetler: Davet[] }
export type BuroDurum = { tur: "giris_yok" } | { tur: "kurulum_yok" } | { tur: "esitleme_yok" } | { tur: "yok" } | { tur: "uye"; b: BuroBilgi; anahtar: boolean };

interface CihazBuro { uid: string; buroId: string; ham: Uint8Array }
let onbellek: { uid: string; buroId: string; k: Anahtar } | null = null;

// ── Davet kodu ────────────────────────────────────────────────────────────────────────────────────────
const ALFABE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // karışan harfler (O/0, I/1) yok
/** 12 karakter, 60 bit: "K7PD-3QXM-W2HA". */
export function davetKoduUret(): string {
  const r = rastgele(12);
  const k = Array.from(r, x => ALFABE[x % 32]).join("");
  return `${k.slice(0, 4)}-${k.slice(4, 8)}-${k.slice(8, 12)}`;
}
export const kodNormal = (k: string) => k.toLocaleUpperCase("en").replace(/[^A-Z0-9]/g, "").slice(0, 12);
const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
export const kodOzet = (k: string) => hex(sha256(kodla("celse-buro-davet:" + kodNormal(k))));

// ── Yerel önbellek ────────────────────────────────────────────────────────────────────────────────────
/** Bu cihazdaki büro anahtarı; yoksa ve üyelik satırında (kişisel anahtarla şifreli) varsa açılıp saklanır. */
export async function buroAnahtari(): Promise<{ buroId: string; k: Anahtar } | null> {
  const uid = await oturum();
  if (!uid) return null;
  if (onbellek?.uid === uid) return onbellek;
  const x = await ayarOku<CihazBuro>("buroAnahtar");
  if (x && x.uid === uid && x.ham instanceof Uint8Array) { onbellek = { uid, buroId: x.buroId, k: await hamAnahtar(x.ham) }; return onbellek; }
  return null;
}
async function anahtarSakla(uid: string, buroId: string, ham: Uint8Array) {
  await ayarYaz("buroAnahtar", { uid, buroId, ham } as CihazBuro);
  // Büro föyleri ilk kez: baştan çekilsin ve gönderilsin.
  await ayarYaz("buroCekim", ""); await ayarYaz("buroGonderilen", {}); await ayarYaz("buroMetinGonderilen", {});
  onbellek = { uid, buroId, k: await hamAnahtar(ham) };
}
async function anahtarUnut() { onbellek = null; await ayarYaz("buroAnahtar", null); await ayarYaz("buroUyeler", null); }
/** Çevrim dışında da görünsün diye üye listesi ve kendi yetkim cihazda tutulur. */
export async function buroUyeleri(): Promise<{ ben?: string; uyeler: Uye[] }> { return (await ayarOku<{ ben?: string; uyeler: Uye[] }>("buroUyeler")) || { uyeler: [] }; }
export async function buroYetkim(): Promise<Yetki | null> {
  const x = await buroUyeleri();
  return x.uyeler.find(u => u.kullanici_id === x.ben)?.yetki || null;
}

// ── Sunucu ────────────────────────────────────────────────────────────────────────────────────────────
export async function buroDurumu(): Promise<BuroDurum> {
  const uid = await oturum();
  if (!uid) return { tur: "giris_yok" };
  const sb = supabase()!;
  const m = await sb.from("buro_uye").select("buro_id").eq("kullanici_id", uid).maybeSingle();
  if (m.error) return { tur: /buro_uye|does not exist|schema cache/i.test(m.error.message) ? "kurulum_yok" : "yok" };
  if (!m.data) {
    if (onbellek || (await ayarOku("buroAnahtar"))) await anahtarUnut(); // çıkarılmış
    if (!(await cihazAnahtari(uid))) return { tur: "esitleme_yok" };
    return { tur: "yok" };
  }
  const buroId = m.data.buro_id as string;
  const [b, u] = await Promise.all([
    sb.from("buro").select("id, ad, kurucu").eq("id", buroId).single(),
    sb.from("buro_uye").select("kullanici_id, ad, unvan, yetki, katilma, anahtar_iv, anahtar_veri").eq("buro_id", buroId).order("katilma")
  ]);
  if (b.error || u.error) throw new Error((b.error || u.error)!.message);
  const satirlar = (u.data || []) as (Uye & { anahtar_iv: string; anahtar_veri: string })[];
  const benS = satirlar.find(x => x.kullanici_id === uid)!;
  const uyeler: Uye[] = satirlar.map(({ anahtar_iv: _i, anahtar_veri: _v, ...x }) => x);
  const ben = uyeler.find(x => x.kullanici_id === uid)!;
  let davetler: Davet[] = [];
  if (ben.yetki === "yonetici") {
    const d = await sb.from("buro_davet").select("id, ad, unvan, yetki, son").eq("buro_id", buroId).order("olusturma");
    davetler = ((d.data || []) as Davet[]).filter(x => x.son > new Date().toISOString());
  }
  await ayarYaz("buroUyeler", { ben: uid, uyeler });
  // Bu cihazda büro anahtarı yoksa: kişisel eşitleme anahtarıyla üyelik satırından açılır.
  let anahtar = !!(await buroAnahtari()) && onbellek?.buroId === buroId;
  if (!anahtar && benS.anahtar_veri) {
    const k = await cihazAnahtari(uid);
    if (k) {
      try { const ham = b64Coz(await ac<string>(k, { iv: benS.anahtar_iv, veri: benS.anahtar_veri })); await anahtarSakla(uid, buroId, ham); anahtar = true; } catch { /* eşitleme şifresi değişmiş */ }
    }
  }
  return { tur: "uye", b: { id: buroId, ad: b.data.ad, kurucu: b.data.kurucu, ben, uyeler, davetler }, anahtar };
}

async function kisiselAnahtar(): Promise<{ uid: string; k: Anahtar }> {
  const uid = await oturum();
  if (!uid) throw new Error("Önce giriş yapın.");
  const k = await cihazAnahtari(uid);
  if (!k) throw new Error("Önce bu cihazda bulut eşitlemesini açın (Föylerim > Bulut eşitlemesi).");
  return { uid, k };
}

/** Büro kurar: büro anahtarı üretilir, kurucunun kişisel anahtarıyla şifrelenip saklanır. */
export async function buroKur(ad: string, benimAdim: string) {
  const { uid, k } = await kisiselAnahtar();
  const ham = rastgele(32);
  const p = await paketle(k, b64(ham));
  const r = await supabase()!.rpc("buro_kur", { p_ad: ad.trim(), p_benim_adim: benimAdim.trim(), p_anahtar_iv: p.iv, p_anahtar_veri: p.veri });
  if (r.error) throw new Error(r.error.message);
  await anahtarSakla(uid, r.data as string, ham);
}

/** Davet: büro anahtarı davet kodundan türetilen anahtarla şifrelenir; kod bir kez gösterilir. */
export async function davetOlustur(buroId: string, d: { ad: string; unvan: string; yetki: Yetki }): Promise<string> {
  const b = await buroAnahtari();
  const ham = await buroHam();
  if (!b || !ham) throw new Error("Bu cihazda büro anahtarı yok.");
  const kod = davetKoduUret();
  const tuz = rastgele(16);
  const dk = await hamAnahtar(await hamTuret(kodNormal(kod), tuz));
  const s = await sifrele(dk, kodla(b64(ham)));
  const r = await supabase()!.from("buro_davet").insert({ buro_id: buroId, kod_ozet: kodOzet(kod), ad: d.ad.trim(), unvan: d.unvan, yetki: d.yetki, tuz: b64(tuz), iv: b64(s.iv), veri: b64(s.veri) });
  if (r.error) throw new Error(r.error.message);
  return kod;
}
async function buroHam(): Promise<Uint8Array | null> {
  const x = await ayarOku<CihazBuro>("buroAnahtar");
  return x?.ham instanceof Uint8Array ? x.ham : null;
}
export async function davetIptal(id: string) {
  const r = await supabase()!.from("buro_davet").delete().eq("id", id);
  if (r.error) throw new Error(r.error.message);
}

/** Davetle katılma: kod sunucuya gitmez (yalnız özeti); büro anahtarı kodla açılır, kişisel anahtarla şifrelenip saklanır. */
export async function davetKabul(kod: string, ad: string) {
  if (kodNormal(kod).length !== 12) throw new Error("Davet kodu 12 karakterdir (ör. K7PD-3QXM-W2HA).");
  const { uid, k } = await kisiselAnahtar();
  const sb = supabase()!;
  const r = await sb.rpc("buro_davet_kabul", { p_kod_ozet: kodOzet(kod), p_ad: ad.trim() });
  if (r.error) throw new Error(r.error.message);
  const d = r.data as { buro_id: string; tuz: string; iv: string; veri: string };
  const dk = await hamAnahtar(await hamTuret(kodNormal(kod), b64Coz(d.tuz)));
  const ham = b64Coz(metneCevir(await coz(dk, { iv: b64Coz(d.iv), veri: b64Coz(d.veri).buffer as ArrayBuffer })));
  const p = await paketle(k, b64(ham));
  const u = await sb.from("buro_uye").update({ anahtar_iv: p.iv, anahtar_veri: p.veri }).eq("buro_id", d.buro_id).eq("kullanici_id", uid);
  if (u.error) throw new Error(u.error.message);
  await anahtarSakla(uid, d.buro_id, ham);
}

export async function uyeGuncelle(buroId: string, uid: string, ek: { unvan?: string; yetki?: Yetki }) {
  const r = await supabase()!.from("buro_uye").update(ek).eq("buro_id", buroId).eq("kullanici_id", uid);
  if (r.error) throw new Error(r.error.message);
}
export async function uyeCikar(buroId: string, uid: string) {
  const r = await supabase()!.from("buro_uye").delete().eq("buro_id", buroId).eq("kullanici_id", uid);
  if (r.error) throw new Error(r.error.message);
}
/** Bürodan ayrılır: büro anahtarı bu cihazdan silinir. Föyler bu cihazda kalır; bundan sonra kişisel bulutla eşitlenir. */
export async function burodanAyril(buroId: string) {
  const uid = await oturum();
  if (!uid) throw new Error("Önce giriş yapın.");
  await uyeCikar(buroId, uid);
  await anahtarUnut();
  await ayarYaz("bulutGonderilen", {});
}
