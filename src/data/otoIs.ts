// Kendiliğinden açılan işler (föy föy, yapılacaklar listesine düşer):
//  • E-duruşma: hukuk davasında ileri tarihli her duruşma için "E-duruşma talep et". Duruşma hapındaki "e" kutusunda kabul ya da
//    red işaretlenmedikçe iş listeden çıkmaz (elle kapatılsa da yeniden açılır). Talep edildiyse iş "sonucunu işaretleyin" olur.
//  • Künye: açık föyde müvekkil, karşı taraf, mahkeme ya da dosya no yoksa "Künyeyi tamamlayın". Hepsi yazılınca kendiliğinden kapanır.
//  • Tutanak: günü geçmiş duruşma / keşfin tutanağı föyde yoksa "Duruşma tutanağını tarayıp föye ekleyin" (gecikmiş, kırmızı).
//  • Ara karar: yeni eklenen tutanak / ara kararda bizim tarafa verilen görevler (evrakIs.ts).
// İş kimlikleri sabittir (oto-e-<duruşma>, oto-kunye): aynı föy iki cihazda eşitlenince iş çoğalmaz.
import { bugunGun, dTur, Durusma, E_TALEP_GUN, EDurum, eSorulur, gunEkle, icraMi } from "./durusma";
import type { Foy, Gorev } from "./foy";
import { evrakOku } from "./evrakIs";
import type { FoyTur } from "./foyTurleri";

const KUNYE_TAM: FoyTur[] = ["hukuk", "ceza", "idari_dava", "icra", "sorusturma", "arabuluculuk", "idari_sorusturma", "bireysel_basvuru", "tazminat_komisyonu", "baro", "ozel_ceza"];
const KARSI_GEREKIR: FoyTur[] = ["hukuk", "ceza", "idari_dava", "icra", "sorusturma", "arabuluculuk"];
const MUVEKKILSIZ: FoyTur[] = ["bilirkisi_gorev", "arabulucu_gorev"];
const bos = (x?: string) => !x || !x.trim();

/** Künyede eksik olan temel bilgiler (föy türüne göre). */
export function kunyeEksikleri(f: Foy): string[] {
  const tur = f.tur || "hukuk";
  const out: string[] = [];
  if (!MUVEKKILSIZ.includes(tur) && bos(f.muvekkil)) out.push("müvekkil");
  if (KARSI_GEREKIR.includes(tur) && bos(f.karsiTaraf)) out.push("karşı taraf");
  if (KUNYE_TAM.includes(tur) && bos(f.mahkeme)) out.push(tur === "icra" ? "icra dairesi" : tur === "sorusturma" ? "savcılık" : "mahkeme");
  if (KUNYE_TAM.includes(tur) && bos(f.esasNo)) out.push(tur === "icra" ? "takip no" : "dosya no");
  return out;
}

const trGun = (x: string) => x.slice(0, 10).split("-").reverse().join(".") + (x.length > 10 ? " " + x.slice(11, 16) : "");
const KARAR_ADI: Record<EDurum, string> = { kabul: "kabul edildi", red: "reddedildi", istenmeyecek: "istenmeyecek", talep: "talep edildi" };
export const eIsId = (d: Durusma) => "oto-e-" + d.id;
export const KUNYE_IS = "oto-kunye";
export const tutanakIsId = (d: Durusma) => "oto-t-" + d.id;
/** Tutanak işi açılan geçmiş duruşmalar (eski aktarılmış duruşmalar için iş yığılmasın). */
export const TUTANAK_GUN = 45;
/** Ara karar işleri yalnız bu kadar gün içinde föye eklenen evraktan çıkar. */
export const YENI_EVRAK_GUN = 10;
/** Evraktan iş çıkarma bu günden sonra föye eklenen evrak için çalışır (eski aktarımlardan iş yağmasın). */
export const EVRAK_IS_BASLANGIC = "2026-11-13";
/** Evrakın kendi tarihi (oturum / yazı tarihi) föye eklendiği günden en çok bu kadar eski olabilir; eski yılların ara kararı iş olmaz. */
export const EVRAK_TAZE_GUN = 30;
/** Evrak hem yakında föye eklenmiş hem kendi tarihi yeni mi (eski yılların tutanağı değil)? */
export function evrakTaze(e: { eklenme?: string }, belge?: string): boolean {
  const ekl = (e.eklenme || "").slice(0, 10);
  return ekl >= EVRAK_IS_BASLANGIC && !!belge && belge <= gunEkle(ekl, 1) && belge >= gunEkle(ekl, -EVRAK_TAZE_GUN);
}
export interface EvrakIsAdayi { id: string; foyId: string; evrakId: string; evrakAd: string; metin: string; tarih?: string; eski: boolean }
/** Evraktan çıkan, henüz ne iş listesinde ne de reddedilmiş olan iş adayları. hepsi: föydeki bütün evrak (yoksa yalnız son
 *  günlerde eklenen). Eski tarihli evraktan çıkanlar "eski" işaretlidir (varsayılan seçili gelmez). */
export function evrakIsAdaylari(f: Foy, bugun = bugunGun(), hepsi = false): EvrakIsAdayi[] {
  const taraf = f.taraf === "davali" ? "davali" : "davaci";
  const var_ = new Set([...(f.gorevler || []).map(g => g.id), ...(f.silinen || [])]);
  const sinir = gunEkle(bugun, -YENI_EVRAK_GUN);
  const out: EvrakIsAdayi[] = [];
  for (const e of f.evraklar || []) {
    const ekl = (e.eklenme || "").slice(0, 10);
    if (!hepsi && (ekl < sinir || ekl < EVRAK_IS_BASLANGIC)) continue;
    const o = evrakOku(e, taraf);
    o.isler.forEach((x, i) => {
      const id = "oto-ak-" + e.id + "-" + i;
      if (var_.has(id)) return;
      out.push({ id, foyId: f.id, evrakId: e.id, evrakAd: e.ad, metin: x.metin, tarih: x.tarih, eski: !evrakTaze(e, o.belge) });
    });
  }
  return out;
}
/** Onaylanan adaylar işe dönüşür; seçilmeyenler bir daha sorulmaz. */
export function adaylariUygula(f: Foy, secilen: { id: string; metin: string; tarih?: string }[], reddedilen: string[], bugun = bugunGun()): Partial<Foy> {
  const yeni: Gorev[] = secilen.filter(x => !(f.gorevler || []).some(g => g.id === x.id)).map(x => ({ id: x.id, metin: x.metin, tarih: x.tarih, bitti: false, kaynak: "evrak", eklenme: bugun, onayli: true }));
  return { gorevler: [...(f.gorevler || []), ...yeni], silinen: [...(f.silinen || []), ...reddedilen].slice(-300) };
}
/** Bu iş kendiliğinden açılan e-duruşma işi mi? (duruşma kimliğini verir) */
export const eIsDurusma = (g: Gorev) => (g.id.startsWith("oto-e-") ? g.id.slice(6) : undefined);

/** Olması gereken kendiliğinden işler; föydeki işler bunlara göre güncellenir. Değişiklik yoksa null. */
export function otoIsleriEsitle(f: Foy, bugun = bugunGun()): Gorev[] | null {
  const acik = f.durum !== "kapali";
  const xs = f.gorevler || [];
  const yeni: Gorev[] = [];
  const kalan = new Map(xs.map(g => [g.id, g]));
  const kapanis = (no: string) => ({ tarih: bugun, no, kaynak: "elle" as const });

  // E-duruşma
  const eVar = acik && eSorulur(f) && !icraMi(f);
  const duruslar = eVar ? (f.durusmalar || []).filter(d => dTur(d) === "durusma" && d.tarih.slice(0, 10) >= bugun) : [];
  for (const d of duruslar) {
    const id = eIsId(d), eski = kalan.get(id);
    kalan.delete(id);
    const karar = d.e === "kabul" || d.e === "red" || d.e === "istenmeyecek";
    const metin = d.e === "talep" ? `E-duruşma talebinin sonucunu işaretleyin (${trGun(d.tarih)} duruşması): kabul ya da red` : `E-duruşma talep et (${trGun(d.tarih)} duruşması)`;
    const tarih = d.e === "talep" ? gunEkle(d.tarih.slice(0, 10), -2) : gunEkle(d.tarih.slice(0, 10), -E_TALEP_GUN);
    if (!eski) { if (!karar) yeni.push({ id, metin, tarih, bitti: false, kaynak: "oto", eklenme: bugun }); continue; }
    if (karar) {
      yeni.push(eski.bitti && eski.kapanis ? eski : { ...eski, bitti: true, kapanis: kapanis("E-duruşma " + KARAR_ADI[d.e!]) });
    } else {
      // Kabul ya da red işaretlenmedikçe açık kalır.
      yeni.push(eski.bitti || eski.metin !== metin || eski.tarih !== tarih ? { ...eski, metin, tarih, bitti: false, kapanis: undefined } : eski);
    }
  }
  // Duruşma günü geçmiş e-duruşma işi açıksa "süresi geçti" diye kapanır (arşive düşer); duruşması silinmişse açık iş kalkar;
  // kapanmış iş kayıt olarak kalır.
  for (const [id, g] of [...kalan]) if (id.startsWith("oto-e-")) {
    kalan.delete(id);
    if (g.bitti) { yeni.push(g); continue; }
    const d = (f.durusmalar || []).find(x => x.id === id.slice(6));
    if (d && d.tarih.slice(0, 10) < bugun) yeni.push({ ...g, bitti: true, kapanis: { tarih: bugun, no: "Süresi geçti: duruşma günü geçti", kaynak: "elle", sureGecti: true } });
  }

  // Künye
  const eksik = kunyeEksikleri(f);
  const ke = kalan.get(KUNYE_IS);
  kalan.delete(KUNYE_IS);
  if (ke?.bitti && eksik.length) yeni.push(ke); // elle kapatıldıysa kapalı kalır
  else if (acik && eksik.length && !(f.silinen || []).includes(KUNYE_IS)) {
    const metin = `Künyeyi tamamlayın: ${eksik.join(", ")} yok`;
    yeni.push(ke && !ke.bitti && ke.metin === metin ? ke : { ...(ke || { eklenme: bugun }), id: KUNYE_IS, metin, bitti: false, kapanis: undefined, kaynak: "oto" });
  } else if (ke) {
    if (ke.bitti) yeni.push(ke);
    else if (!eksik.length) yeni.push({ ...ke, metin: "Künyeyi tamamlayın", bitti: true, kapanis: kapanis("Künye tamamlandı") });
    // kapalı föyde açık kalan künye işi kalkar
  }

  // Duruşma / keşif tutanağı: günü geçmiş (son 45 gün) ve o günün tutanağı föyde yoksa "tarayın" işi, duruşma gününe tarihli
  // (gecikmiş) açılır; tutanak eklenince kendiliğinden kapanır.
  const taraf = f.taraf === "davali" ? "davali" : "davaci";
  const silinen = new Set(f.silinen || []);
  const oturumlar = new Set((f.evraklar || []).map(e => evrakOku(e, taraf).oturum).filter(Boolean) as string[]);
  if (acik && !icraMi(f)) {
    const sinir = gunEkle(bugun, -TUTANAK_GUN);
    for (const d of f.durusmalar || []) {
      const tur = dTur(d);
      if (tur !== "durusma" && tur !== "kesif") continue;
      const gun = d.tarih.slice(0, 10);
      if (gun >= bugun || gun < sinir) continue;
      const id = tutanakIsId(d), eski = kalan.get(id);
      kalan.delete(id);
      const var_ = oturumlar.has(gun);
      if (eski) { yeni.push(var_ && !eski.bitti ? { ...eski, bitti: true, kapanis: kapanis("Tutanak föye eklendi") } : eski); continue; }
      if (var_ || silinen.has(id)) continue;
      yeni.push({ id, metin: `${tur === "kesif" ? "Keşif" : "Duruşma"} tutanağını tarayıp föye ekleyin (${trGun(d.tarih)} ${tur === "kesif" ? "keşfi" : "duruşması"})`, tarih: gun, bitti: false, kaynak: "oto", eklenme: bugun });
    }
  }

  // Ara karar ve resmî yazı işleri artık kendiliğinden eklenmez: avukat "Yapılacak işleri çıkar" ile görüp onaylar
  // (evrakIsAdaylari). Daha önce kendiliğinden eklenmiş, yapılmamış ve eski tarihli evraktan çıkmış işler kaldırılır.
  for (const [id, g] of [...kalan]) if (id.startsWith("oto-ak-")) {
    if (g.bitti || g.onayli) continue;
    const e = (f.evraklar || []).find(x => id.startsWith("oto-ak-" + x.id + "-"));
    if (!e || !evrakTaze(e, evrakOku(e, taraf).belge)) kalan.delete(id);
  }

  // Öteki işler olduğu gibi; sıra korunur, yeni açılan kendiliğinden işler sona eklenir.
  const yeniMap = new Map(yeni.map(g => [g.id, g]));
  const sonuc = [...xs.filter(g => kalan.has(g.id) || yeniMap.has(g.id)).map(g => yeniMap.get(g.id) || g), ...yeni.filter(g => !xs.some(x => x.id === g.id))];
  const ayni = sonuc.length === xs.length && sonuc.every(g => xs.includes(g));
  return ayni ? null : sonuc;
}

/** Duruşma hapındaki "e" kutusu (ve iş listesindeki düğmeler): kabul / red; aynı karara ikinci basış kararı kaldırır. */
export function eKarar(f: Foy, durusmaId: string, karar: "kabul" | "red", bugun = bugunGun()): Partial<Foy> {
  const durusmalar = (f.durusmalar || []).map(d => (d.id !== durusmaId ? d : d.e === karar ? { ...d, e: undefined, eKarar: undefined } : { ...d, e: karar, eKarar: bugun }));
  const y = { ...f, durusmalar };
  return { durusmalar, gorevler: otoIsleriEsitle(y, bugun) || f.gorevler };
}

/** Duruşmalar sekmesinden e-duruşma durumu: talep edildi, istenmeyecek, kabul, red ya da sorulmadı (undefined). İşler de güncellenir. */
export function eDurumYaz(f: Foy, durusmaId: string, durum: EDurum | undefined, bugun = bugunGun()): Partial<Foy> {
  const durusmalar = (f.durusmalar || []).map(d => (d.id !== durusmaId ? d : {
    ...d, e: durum,
    eTalep: durum === "talep" || durum === "kabul" || durum === "red" ? d.eTalep || bugun : durum ? d.eTalep : undefined,
    eKarar: durum === "kabul" || durum === "red" ? (d.e === durum && d.eKarar ? d.eKarar : bugun) : undefined
  }));
  return { durusmalar, gorevler: otoIsleriEsitle({ ...f, durusmalar }, bugun) || f.gorevler };
}
