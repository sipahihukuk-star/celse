// Faiz tablolarına sunucudan gelen dönemleri ekleme ve 7589 s. Kanun yasal faiz hesabı (saf; ağ ve ekran yok).
import { AVANS, TTK1530, YASAL } from "./icra";

export interface FaizSatiri { tur: "reeskont" | "avans" | "ttk1530" | "yasal"; bas: string; oran: number }
const r2 = (x: number) => Math.round(x * 100) / 100;

/** Tabloya yeni dönemleri ekler (aynı başlangıçlı satır varsa oranı günceller); eklenen sayısını döner. */
export function tabloyaEkle(tablo: [string, number][], xs: { bas: string; oran: number }[]): number {
  let n = 0;
  for (const x of xs) {
    const i = tablo.findIndex(t => t[0] === x.bas);
    if (i >= 0) { if (tablo[i][1] !== x.oran) { tablo[i][1] = x.oran; n++; } continue; }
    tablo.push([x.bas, x.oran]); n++;
  }
  if (n) tablo.sort((a, b) => a[0].localeCompare(b[0]));
  return n;
}
const oranGunde = (tablo: [string, number][], gun: string) => { let o: number | undefined; for (const [b, r] of tablo) { if (b <= gun) o = r; else break; } return o; };

/** Reeskont oranlarından 7589 s. Kanun sonrası yasal faiz dönemleri (bugüne kadar). */
export function yasalTuret(reeskont: [string, number][], bugun: string): { bas: string; oran: number }[] {
  const out: { bas: string; oran: number }[] = [];
  const yil = Number(bugun.slice(0, 4));
  for (let y = 2027; y <= yil; y++) {
    const aralik = oranGunde(reeskont, `${y - 1}-12-31`);
    if (aralik === undefined) continue;
    out.push({ bas: `${y}-01-01`, oran: r2(aralik * 0.8) });
    const haziran = oranGunde(reeskont, `${y}-06-30`);
    if (`${y}-07-01` <= bugun && haziran !== undefined && Math.abs(haziran - aralik) >= 5) out.push({ bas: `${y}-07-01`, oran: r2(haziran * 0.8) });
  }
  return out;
}

/** Gelen satırları tablolara ekler; eklenen / değişen dönem sayısını ve reeskonttan hesaplanan yasal faiz dönemlerini döner. */
export function faizOranlariniUygula(satirlar: FaizSatiri[], bugun = new Date().toISOString().slice(0, 10)): { n: number; hesaplanan: string[] } {
  const al = (t: FaizSatiri["tur"]) => satirlar.filter(x => x.tur === t).map(x => ({ bas: x.bas, oran: Number(x.oran) })).filter(x => x.oran > 0);
  let n = tabloyaEkle(AVANS, al("avans")) + tabloyaEkle(TTK1530, al("ttk1530"));
  const sunucuYasal = al("yasal");
  const reeskont = al("reeskont").sort((a, b) => a.bas.localeCompare(b.bas)).map(x => [x.bas, x.oran] as [string, number]);
  // 7589 s. Kanun'la belirlenen ilk dönem (31.07.2026, %31) Celse'de yazılı; sonrası reeskonttan hesaplanır.
  const turetilen = yasalTuret(reeskont, bugun).filter(x => x.bas > "2026-07-31" && !sunucuYasal.some(y => y.bas === x.bas));
  n += tabloyaEkle(YASAL, [...sunucuYasal, ...turetilen]);
  return { n, hesaplanan: turetilen.map(x => x.bas) };
}
