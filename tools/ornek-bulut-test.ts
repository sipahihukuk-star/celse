// Dilekçe örneklerinin cihazlar arası eşitlenmesi (sahte, bellekte sunucu; gerçek Supabase'e gidilmez; uydurma metin).
/* eslint-disable @typescript-eslint/no-explicit-any */
const { IDBFactory } = require("fake-indexeddb");
(globalThis as any).indexedDB = new IDBFactory();
import { ayarYaz } from "../src/data/foy";
import { ornekEkle, ornekler, ornekSil } from "../src/data/dilekceOrnek";
import { ornekleriEsitle } from "../src/data/ornekBulut";
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };

const satirlar: any[] = [];
let saat = Date.parse("2026-11-12T10:00:00Z");
const sb: any = {
  from: () => {
    const f: any[] = []; let lim = 1000;
    const q: any = {
      select: () => q, eq: (k: string, v: any) => { f.push((r: any) => r[k] === v); return q; }, like: (k: string, v: string) => { const p = v.replace("%", ""); f.push((r: any) => String(r[k]).startsWith(p)); return q; },
      order: () => q, limit: (n: number) => { lim = n; return q; }, gt: (k: string, v: string) => { f.push((r: any) => r[k] > v); return q; },
      then: (res: any) => res({ data: satirlar.filter(r => f.every(g => g(r))).sort((a, b) => a.degisim.localeCompare(b.degisim)).slice(0, lim), error: null }),
      upsert: async (xs: any[]) => { for (const x of xs) { const i = satirlar.findIndex(r => r.kullanici_id === x.kullanici_id && r.kayit_id === x.kayit_id); const y = { ...x, degisim: new Date(saat += 1000).toISOString() }; if (i >= 0) satirlar[i] = y; else satirlar.push(y); } return { error: null }; }
    };
    return q;
  }
};
const paketle = async (_k: any, x: unknown) => ({ iv: "iv", veri: JSON.stringify(x) });
const ac = async <T,>(_k: any, r: { veri: string }) => JSON.parse(r.veri) as T;
const metin = "KONU: Bilirkişi raporuna itirazlarımızın sunulmasıdır. Sayın mahkemenizce alınan bilirkişi raporu hesap yöntemi bakımından eksik ve hatalıdır; itirazlarımız aşağıda sunulmuştur. Saygılarımızla arz ederiz.";

(async () => {
  // A cihazı: örnek ekler, eşitler.
  const o = await ornekEkle({ ad: "itiraz.udf", metin });
  await ornekleriEsitle(sb, "u1", {} as any, paketle, ac);
  ok(satirlar.length === 1 && satirlar[0].kayit_id === "ornek:" + o.id && satirlar[0].tur === "metin" && !/Bilirkişi raporuna itirazlarımızın/.test(satirlar[0].iv), "örnek sunucuya gider: " + satirlar.length);
  const ikinci = await ornekleriEsitle(sb, "u1", {} as any, paketle, ac);
  ok(ikinci.giden === 0, "değişmeyen örnek yeniden gönderilmez");
  // B cihazı (yerel boş): örneği çeker.
  await ayarYaz("dilekceOrnekleri", []); await ayarYaz("ornekGonderilen", {}); await ayarYaz("ornekCekim", "");
  const b = await ornekleriEsitle(sb, "u1", {} as any, paketle, ac);
  const xs = await ornekler();
  ok(b.gelen === 1 && xs.length === 1 && xs[0].id === o.id && xs[0].metin.includes("bilirkişi"), "öteki cihaz örneği alır: " + JSON.stringify(b));
  // B'de silinir → sunucuda silindi işareti; A (örnek hâlâ yerelde) eşitleyince silinir.
  await ornekSil(o.id);
  await ornekleriEsitle(sb, "u1", {} as any, paketle, ac);
  ok(satirlar.find(r => r.kayit_id === "ornek:" + o.id)?.silindi === true, "silme sunucuya gider");
  await ayarYaz("dilekceOrnekleri", xs); await ayarYaz("ornekGonderilen", { [o.id]: xs[0].guncelleme }); await ayarYaz("ornekCekim", "");
  await ornekleriEsitle(sb, "u1", {} as any, paketle, ac);
  ok((await ornekler()).length === 0, "silinen örnek öteki cihazdan da kalkar");
  if (fail) { console.log(`ornek-bulut-test: ${fail} hata`); process.exit(1); }
  console.log("ornek-bulut-test: tamam");
})();
