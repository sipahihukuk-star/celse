// Evraktan doğan işler (cihazda, kurallarla):
//  • Duruşma tutanağı: duruşma / keşif günü geçmiş ve o günün tutanağı föye eklenmemişse "Duruşma tutanağını tarayın" işi
//    duruşma gününe tarihli (yani gecikmiş, kırmızı) açılır; tutanak föye eklenince kendiliğinden kapanır.
//  • Ara karar: föye yeni eklenen tutanak ya da ara kararda bizim tarafa (ya da taraflara) verilen görevler ("davacı vekiline
//    bilirkişi ücretini yatırması için 2 hafta kesin süre verilmesine") ayrı ayrı iş olur; son gün süreden hesaplanır.
// Okunan evrak önbellekte tutulur (her föy değişikliğinde bütün evrak yeniden okunmaz).
import { evrakDurusmaOku } from "./durusma";
import type { FoyEvrak } from "./foy";

export interface AraKararIsi { metin: string; tarih?: string }
interface Okunan { oturum?: string; isler: AraKararIsi[] }
const onbellek = new Map<string, Okunan>();

const SAYI: Record<string, number> = { BİR: 1, İKİ: 2, ÜÇ: 3, DÖRT: 4, BEŞ: 5, ALTI: 6, YEDİ: 7, SEKİZ: 8, DOKUZ: 9, ON: 10, ONBEŞ: 15, YİRMİ: 20, OTUZ: 30, KIRKBEŞ: 45, ALTMIŞ: 60 };
const gunEkle = (iso: string, n: number) => { const d = new Date(iso.slice(0, 10) + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const BIZ_HITAP: Record<"davaci" | "davali", RegExp> = {
  davaci: /DAVACI(?:LAR)?\s*(?:-\s*KARŞI DAVALI\s*)?(?:VEKİL(?:İ|LERİ)NE|TARAFA|YA|LARA|\b)|KATILAN|MÜŞTEKİ|ALACAKLI|TARAF(?:LAR)?(?:A|IN)?\s*VEKİLLERİNE|TARAFLARA|HER İKİ TARAF|TARAF VEKİLLERİNE/,
  davali: /DAVALI(?:LAR)?\s*(?:-\s*KARŞI DAVACI\s*)?(?:VEKİL(?:İ|LERİ)NE|TARAFA|YA|LARA|\b)|SANIK|MÜDAFİ|BORÇLU|TARAF(?:LAR)?(?:A|IN)?\s*VEKİLLERİNE|TARAFLARA|HER İKİ TARAF|TARAF VEKİLLERİNE/
};
const EYLEM = /SÜRE VERİL|SÜRE VERİLDİ|KESİN SÜRE|İHTARINA|İHTAR EDİL|BİLDİRMESİNE|SUNMASINA|SUNULMASINA|YATIRMASINA|YATIRILMASINA|İBRAZINA|İBRAZ ETMESİNE|TAMAMLAMASINA|TAMAMLANMASINA|AÇIKLAMASINA|GETİRMESİNE|HAZIR ETMESİNE|HAZIR EDİLMESİNE|BEYANDA BULUNMASINA|BEYAN DİLEKÇESİ|ISLAH|DEPO ETMESİNE|DELİL LİSTESİ|TANIK LİSTESİ|ADRES(?:İNİN)? BİLDİRİL/;

/** Tutanak / ara kararın "ara karar" kısmından bizim tarafa düşen işler. */
export function araKararIsleri(metin: string, taraf: "davaci" | "davali", baz?: string, eklenme?: string): AraKararIsi[] {
  const duz = metin.replace(/\s+/g, " ");
  const u = duz.toLocaleUpperCase("tr");
  const bas = u.search(/ARA KARAR\s*:?|GEREĞİ DÜŞÜNÜLDÜ|GEREĞİ DÜŞÜNÜLDÜ\s*:/);
  if (bas < 0) return [];
  const son = (() => { const k = u.slice(bas + 20).search(/\b(KATİP|KÂTİP|HAKİM|HÂKİM|BAŞKAN|ÜYE)\s+\d|E-İMZALIDIR|AÇIKÇA OKUNUP/); return k >= 0 ? bas + 20 + k : u.length; })();
  const bolum = duz.slice(bas, son), ub = u.slice(bas, son);
  // Maddeler: "1-", "2)" numaralarıyla; numara yoksa fiilden sonraki virgül ve noktalı virgülle.
  const sinirlar = [...ub.matchAll(/(?:^|\s)(\d{1,2})\s*[-.)]\s*(?=\p{Lu})/gu)].map(m => (m.index || 0));
  const parcalar = sinirlar.length >= 2 ? sinirlar.map((b, i) => bolum.slice(b, sinirlar[i + 1] ?? bolum.length)) : bolum.split(/(?<=(?:MESİNE|MASINA|MESİ|MASI|RİLDİ|NMASINA|NMESİNE|İNE|INA)[,;])\s+/i);
  const out: AraKararIsi[] = [];
  for (const p0 of parcalar) {
    const p = p0.replace(/^\s*(?:ARA KARAR\s*:?|GEREĞİ DÜŞÜNÜLDÜ\s*:?)\s*/i, "").replace(/^\s*\d{1,2}\s*[-.)]\s*/, "").trim();
    const up = p.toLocaleUpperCase("tr");
    if (!EYLEM.test(up) || !BIZ_HITAP[taraf].test(up)) continue;
    // Yalnız karşı tarafa verilen görev (bizim taraf anılmıyorsa) atlanır.
    const karsi = taraf === "davaci" ? /DAVALI(?:LAR)? (?:VEKİL|TARAF)/ : /DAVACI(?:LAR)? (?:VEKİL|TARAF)/;
    const biz = taraf === "davaci" ? /DAVACI|TARAFLAR|TARAF VEKİLLERİ|HER İKİ/ : /DAVALI|TARAFLAR|TARAF VEKİLLERİ|HER İKİ/;
    if (karsi.test(up) && !biz.test(up)) continue;
    let tarih: string | undefined;
    const sure = up.match(/(\d{1,3}|BİR|İKİ|ÜÇ|DÖRT|BEŞ|ALTI|YEDİ|SEKİZ|DOKUZ|ON|ONBEŞ|YİRMİ|OTUZ)\s*(?:\(\s*\w+\s*\)\s*)?(GÜN|HAFTA|AY)/);
    const temel = /TEBLİĞ/.test(up) ? (eklenme || baz) : (baz || eklenme);
    if (sure && temel) {
      const n = /^\d+$/.test(sure[1]) ? Number(sure[1]) : SAYI[sure[1]] || 0;
      if (n) tarih = gunEkle(temel, sure[2] === "GÜN" ? n : sure[2] === "HAFTA" ? n * 7 : n * 30);
    }
    const kisa = p.length > 240 ? p.slice(0, 237).replace(/\s+\S*$/, "") + "…" : p;
    out.push({ metin: "Ara karar: " + kisa.replace(/[,;.]+$/, ""), tarih });
  }
  return out.slice(0, 8);
}

/** Evrakın tutanak günü ve ara karar işleri (önbellekli). */
export function evrakOku(e: FoyEvrak, taraf: "davaci" | "davali"): Okunan {
  const k = e.id + "|" + e.metin.length + "|" + taraf;
  const v = onbellek.get(k);
  if (v) return v;
  let o: Okunan = { isler: [] };
  if (e.metin.trim()) {
    const b = evrakDurusmaOku(e.metin, taraf);
    const baz = b.oturum?.tarih?.slice(0, 10) || b.belgeTarihi;
    o = { oturum: b.oturum?.tarih?.slice(0, 10), isler: araKararIsleri(e.metin, taraf, baz, e.eklenme?.slice(0, 10)) };
  }
  if (onbellek.size > 4000) onbellek.clear();
  onbellek.set(k, o);
  return o;
}
