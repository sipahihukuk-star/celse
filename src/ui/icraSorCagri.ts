// İcra takibi sohbetinin sunucu çağrısı (kodlama ve açma: data/icraSohbet.ts).
import { call } from "../data/danisma";
import { Foy } from "../data/foy";
import { FaizTuru, MAHIYETLER, TakipYolu } from "../data/icra";
import { hazirlikAdlari, hazirlikCoz, IcraHazirlik } from "../data/icraHazirla";
import type { TalimatAlanlari } from "../data/icraTalimat";
import { ac, FAIZLER, IcraDegisiklik, isoCikar, icraSoruKaynagi, IcraSohbetSatiri, SIZINTI, YOLLAR } from "../data/icraSohbet";
export { degisiklikOzeti } from "../data/icraSohbet";
export type { IcraDegisiklik, IcraSohbetSatiri } from "../data/icraSohbet";

export async function icraSor(f: Foy, soru: string, yapistirilan = ""): Promise<{ ok: true; satir: IcraSohbetSatiri; degisiklik?: IcraDegisiklik } | { ok: false; hata: string; vars?: Record<string, string | number> }> {
  const gecmis = f.icra?.sohbet || [];
  const k = icraSoruKaynagi(f, soru.trim(), gecmis, yapistirilan);
  if (SIZINTI.test(k.dosya + " " + k.soru)) return { ok: false, hata: "Metinde gizlenmemiş kişisel veri (kimlik no, IBAN ya da e-posta) kalmış olabilir; gönderilmedi. Bu bilgiyi metinden çıkarın." };
  const r = await call<{ cevap?: string; degisiklik?: Record<string, unknown> | null }>("icra_sor", { dosya: k.dosya, soru: k.soru, gecmis: k.gecmis }, 180000);
  if (!r.ok) return { ok: false, hata: r.error, vars: r.vars as Record<string, string | number> | undefined };
  const cevap = ac(String(r.data.cevap || ""), k.map, k.tarihler).trim();
  const satir: IcraSohbetSatiri = { soru: soru.trim(), cevap: cevap || "(boş cevap)", tarih: new Date().toISOString() };
  const d = r.data.degisiklik;
  let degisiklik: IcraDegisiklik | undefined;
  if (d && typeof d === "object") {
    degisiklik = {};
    if (d.taraf === "davaci" || d.taraf === "davali") degisiklik.taraf = d.taraf;
    if (typeof d.yol === "string" && YOLLAR.includes(d.yol as TakipYolu)) degisiklik.yol = d.yol as TakipYolu;
    if (Array.isArray(d.kalemler)) {
      degisiklik.kalemler = (d.kalemler as Record<string, unknown>[]).map(x => {
        const tutar = typeof x.tutar === "number" ? x.tutar : Number(String(x.tutar || "").replace(/\./g, "").replace(",", "."));
        const fz = FAIZLER.includes(x.faizTuru as FaizTuru) ? (x.faizTuru as FaizTuru) : "yasal";
        const bas = isoCikar(ac(String(x.faizBaslangic || ""), k.map, k.tarihler, true));
        const oran = Number(String(x.oran ?? "").replace(",", "."));
        // Sabit oran yalnız sözleşme / mevduat faizinde; yasal, avans ve TTK 1530'da Celse dönemsel tabloyu uygular.
        return { ad: ac(String(x.ad || "Alacak"), k.map, k.tarihler).slice(0, 80), tutar: Math.round((tutar || 0) * 100) / 100, faizTuru: fz, faizBaslangic: fz === "yok" ? undefined : bas, ...((fz === "sozlesme" || fz === "mevduat") && oran > 0 && oran < 200 ? { oran } : {}) };
      }).filter(x => x.tutar > 0).slice(0, 30);
    }
    // Takip formunun kutuları: kodlar cihazda gerçek değerlerine açılır; tarihler YYYY-AA-GG olur.
    const metinA = (x: unknown, n = 300) => (typeof x === "string" && x.trim() ? ac(x, k.map, k.tarihler).trim().slice(0, n) : undefined);
    const tarihA = (x: unknown) => { const v = typeof x === "string" ? ac(x, k.map, k.tarihler, true).trim() : ""; return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined; };
    const al: TalimatAlanlari = {};
    const ic = metinA(d.icraDairesi, 120); if (ic && /icra/i.test(ic)) al.icraDairesi = ic;
    if (d.ilam && typeof d.ilam === "object") {
      const il = d.ilam as Record<string, unknown>;
      const x = { mahkeme: metinA(il.mahkeme, 160), esasNo: metinA(il.esasNo, 30), kararNo: metinA(il.kararNo, 30), kararTarihi: tarihA(il.kararTarihi), kesinlesme: tarihA(il.kesinlesme) };
      const dolu = Object.fromEntries(Object.entries(x).filter(([, v]) => v));
      if (Object.keys(dolu).length) al.ilam = dolu;
    }
    const tt = tarihA(d.takipTarihi); if (tt) al.takipTarihi = tt;
    if (typeof d.mahiyet === "string" && MAHIYETLER.some(m => m.kod === d.mahiyet)) al.mahiyet = d.mahiyet;
    if (d.paraBirimi === "TL" || d.paraBirimi === "USD" || d.paraBirimi === "EUR" || d.paraBirimi === "GBP") al.paraBirimi = d.paraBirimi;
    if (Array.isArray(d.masraflar)) { const ms = (d.masraflar as Record<string, unknown>[]).map(m => ({ ad: metinA(m.ad, 80) || "Masraf", tutar: typeof m.tutar === "number" ? m.tutar : Number(String(m.tutar || "").replace(/\./g, "").replace(",", ".")) })).filter(m => m.tutar > 0).slice(0, 20); if (ms.length) al.masraflar = ms; }
    const nt = metinA(d.not, 600); if (nt) al.not = nt;
    if (Array.isArray(d.taraflar)) {
      const ks = (d.taraflar as Record<string, unknown>[]).map(x => ({ rol: (x.rol === "alacakli" ? "alacakli" : "borclu") as "alacakli" | "borclu", ad: metinA(x.ad, 160), kimlikNo: metinA(x.kimlikNo, 20)?.replace(/\D/g, "") || undefined, adres: metinA(x.adres, 300) }))
        .filter(x => x.ad || x.kimlikNo || x.adres).slice(0, 10);
      if (ks.length) al.kisiBilgi = ks;
    }
    if (Object.keys(al).length) degisiklik.alanlar = al;
    if (!degisiklik.taraf && !degisiklik.yol && !degisiklik.kalemler && !degisiklik.alanlar) degisiklik = undefined;
  }
  return { ok: true, satir, degisiklik };
}


export async function icraHazirla(f: Foy, talimat = ""): Promise<{ ok: true; h: IcraHazirlik } | { ok: false; hata: string; vars?: Record<string, string | number>; status?: number }> {
  const k = icraSoruKaynagi(f, talimat.trim() || "Takibi hazırla", [], "", 110000, hazirlikAdlari(f));
  if (SIZINTI.test(k.dosya + " " + k.soru)) return { ok: false, hata: "Metinde gizlenmemiş kişisel veri (kimlik no, IBAN ya da e-posta) kalmış olabilir; gönderilmedi. Bu bilgiyi metinden çıkarın." };
  const r = await call<{ sonuc?: Record<string, unknown> }>("icra_hazirla", { dosya: k.dosya, talimat: talimat.trim() ? k.soru : "", akis: true }, 300000);
  if (!r.ok) return { ok: false, hata: r.error, vars: r.vars as Record<string, string | number> | undefined, status: r.status };
  return { ok: true, h: hazirlikCoz(r.data.sonuc || {}, k.map, k.tarihler) };
}
