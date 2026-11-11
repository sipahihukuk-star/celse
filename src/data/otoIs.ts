// Kendiliğinden açılan işler (föy föy, yapılacaklar listesine düşer):
//  • E-duruşma: hukuk davasında ileri tarihli her duruşma için "E-duruşma talep et". Duruşma hapındaki "e" kutusunda kabul ya da
//    red işaretlenmedikçe iş listeden çıkmaz (elle kapatılsa da yeniden açılır). Talep edildiyse iş "sonucunu işaretleyin" olur.
//  • Künye: açık föyde müvekkil, karşı taraf, mahkeme ya da dosya no yoksa "Künyeyi tamamlayın". Hepsi yazılınca kendiliğinden kapanır.
// İş kimlikleri sabittir (oto-e-<duruşma>, oto-kunye): aynı föy iki cihazda eşitlenince iş çoğalmaz.
import { bugunGun, dTur, Durusma, E_TALEP_GUN, EDurum, eSorulur, gunEkle, icraMi } from "./durusma";
import type { Foy, Gorev } from "./foy";
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
  // Duruşması geçmiş ya da silinmiş e-duruşma işi: kapanmışsa kayıt olarak kalır, açıksa kalkar.
  for (const [id, g] of [...kalan]) if (id.startsWith("oto-e-")) { kalan.delete(id); if (g.bitti) yeni.push(g); }

  // Künye
  const eksik = kunyeEksikleri(f);
  const ke = kalan.get(KUNYE_IS);
  kalan.delete(KUNYE_IS);
  if (acik && eksik.length && !(f.silinen || []).includes(KUNYE_IS)) {
    const metin = `Künyeyi tamamlayın: ${eksik.join(", ")} yok`;
    yeni.push(ke && !ke.bitti && ke.metin === metin ? ke : { ...(ke || { eklenme: bugun }), id: KUNYE_IS, metin, bitti: false, kapanis: undefined, kaynak: "oto" });
  } else if (ke) {
    if (ke.bitti) yeni.push(ke);
    else if (!eksik.length) yeni.push({ ...ke, metin: "Künyeyi tamamlayın", bitti: true, kapanis: kapanis("Künye tamamlandı") });
    // kapalı föyde açık kalan künye işi kalkar
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
