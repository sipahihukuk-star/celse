// Tekrarın önlenmesi: aynı dosya ikinci bir föy, aynı evrak ikinci bir kayıt olmasın. Bütün yükleme yolları (evrak klasörü /
// DavaTek, toplu evrak yükle, föye evrak ekle, UYAP dosya ve duruşma listesi, Excel aktarımı, föy birleştirme) bu kuralları
// kullanır:
//  • Aynı dosya: esas no aynı ("2024/0362 E." = "2024/362") ve merci çelişmiyor ("İzmir 6. Asliye Ticaret Mahkemesi Sayın
//    Hakimliği" = "İzmir 6 Asliye Ticaret"). Merci yazılı değilse ve bu numarada tek föy varsa o föydür.
//  • Aynı evrak: yazısı aynı (UDF ile PDF'i, başka adla ikinci kez indirilmişi), ya da yazısı okunamayan dosyada adı ve boyutu aynı.
//    Neredeyse aynı yazılarda (sayfa üstbilgisi farkı) bütün tarihler ve sayılar da aynı olmalı: aynı kalıptaki iki ayrı zabıt ya da
//    tebligat (tarihi, numarası farklı) tekrar sayılmaz.
// Her şey cihazda yapılır.
import type { Foy, FoyEvrak } from "./foy";
import { esasNorm, merciSade } from "./iliski";

/** Aynı dosyanın föyü (yoksa undefined). Şahsi föyler yalnız şahsilerle, büro föyleri büro föyleriyle karşılaştırılır. */
export function ayniFoyuBul(liste: Foy[], x: { mahkeme?: string; esasNo?: string; ozel?: boolean; haricId?: string }): Foy | undefined {
  const e = esasNorm(x.esasNo);
  if (!e) return undefined;
  const adaylar = liste.filter(f => f.id !== x.haricId && !!f.ozel === !!x.ozel && esasNorm(f.esasNo) === e);
  if (!adaylar.length) return undefined;
  const m = merciSade(x.mahkeme);
  const uy = (f: Foy) => { const k = merciSade(f.mahkeme); return !k || !m ? "bilinmiyor" : k === m || k.includes(m) || m.includes(k) ? "ayni" : "celisir"; };
  const ayni = adaylar.filter(f => uy(f) === "ayni");
  if (ayni.length) return ayni.sort((a, b) => b.evraklar.length - a.evraklar.length)[0];
  const bilinmiyor = adaylar.filter(f => uy(f) === "bilinmiyor");
  return bilinmiyor.length === 1 ? bilinmiyor[0] : undefined;
}

/** cyrb53: hızlı, çakışması çok düşük 53 bitlik özet. */
function ozet(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
const duzle = (m: string) => m.toLocaleLowerCase("tr").replace(/ı/g, "i").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\d]+/gu, " ").trim();

interface Iz { tam?: string; sayilar: string; kelime: number; kelimeler?: string[]; parcalar?: Set<string>; ad: string }
/** Üçlü kelime parçaları yalnız gerektiğinde (sayılar aynı, uzunluk yakın) hesaplanır. */
function parcalar(iz: Iz): Set<string> | undefined {
  if (!iz.parcalar && iz.kelimeler) { const p = new Set<string>(); const k = iz.kelimeler; for (let i = 0; i + 3 <= k.length; i++) p.add(k[i] + " " + k[i + 1] + " " + k[i + 2]); iz.parcalar = p; iz.kelimeler = undefined; }
  return iz.parcalar;
}
const onbellek = new Map<string, Iz>();
/** Evrakın izi (önbellekli; kimlik ve yazı uzunluğuyla anahtarlanır). */
function izi(e: { id?: string; ad: string; boyut: number; metin?: string }): Iz {
  const k = (e.id || "") + "|" + e.ad + "|" + e.boyut + "|" + (e.metin?.length || 0);
  const v = onbellek.get(k);
  if (v) return v;
  const d = duzle(e.metin || "");
  const kel = d ? d.split(" ") : [];
  const iz: Iz = {
    tam: d.length >= 120 ? ozet(d) : undefined,
    sayilar: (d.match(/\d+/g) || []).join(","),
    kelime: kel.length,
    ad: e.ad.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim() + "|" + e.boyut
  };
  if (kel.length >= 40) iz.kelimeler = kel.slice(0, 2500);
  if (onbellek.size > 5000) onbellek.clear();
  onbellek.set(k, iz);
  return iz;
}

/** İki evrak aynı mı (yukarıdaki kurallar)? */
export function ayniEvrakMi(a: { id?: string; ad: string; boyut: number; metin?: string }, b: { id?: string; ad: string; boyut: number; metin?: string }): boolean {
  const x = izi(a), y = izi(b);
  if (x.tam && y.tam) {
    if (x.tam === y.tam) return true;
    // Neredeyse aynı: sayılar birebir aynı, uzunluk yakın, üçlü kelime parçalarının %95'i ortak.
    if (x.sayilar !== y.sayilar || x.kelime < 40 || y.kelime < 40) return false;
    if (Math.abs(x.kelime - y.kelime) > Math.max(x.kelime, y.kelime) * 0.05) return false;
    const px = parcalar(x), py = parcalar(y);
    if (!px || !py) return false;
    let ortak = 0;
    for (const p of px) if (py.has(p)) ortak++;
    return ortak / (px.size + py.size - ortak) >= 0.95;
  }
  // Yazısı okunamayan (taranmış görüntü vb.): ad ve boyut.
  return !x.tam && !y.tam && x.ad === y.ad;
}

/** Listede bu evrakın bir eşi var mı? */
export const esiVar = (liste: FoyEvrak[], e: { id?: string; ad: string; boyut: number; metin?: string }) => liste.find(x => x.id !== e.id && ayniEvrakMi(x, e));

/** Föydeki tekrar eden evrak: her tekrar kümesinde yazısı olan, en önce eklenen kalır; ötekiler döner. */
export function tekrarEdenEvrak(f: Foy): FoyEvrak[] {
  const sirali = [...f.evraklar].sort((a, b) => Number(!!b.metin.trim()) - Number(!!a.metin.trim()) || (a.eklenme || "").localeCompare(b.eklenme || ""));
  const kalan: FoyEvrak[] = [], tekrar: FoyEvrak[] = [];
  for (const e of sirali) (kalan.some(k => ayniEvrakMi(k, e)) ? tekrar : kalan).push(e);
  return tekrar;
}
