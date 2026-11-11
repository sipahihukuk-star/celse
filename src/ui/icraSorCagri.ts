// İcra takibi sohbetinin sunucu çağrısı (kodlama ve açma: data/icraSohbet.ts).
import { call } from "../data/danisma";
import { Foy } from "../data/foy";
import { FaizTuru, TakipYolu } from "../data/icra";
import { ac, FAIZLER, IcraDegisiklik, icraSoruKaynagi, IcraSohbetSatiri, SIZINTI, YOLLAR } from "../data/icraSohbet";
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
        const bas = ac(String(x.faizBaslangic || ""), k.map, k.tarihler, true).trim();
        return { ad: ac(String(x.ad || "Alacak"), k.map, k.tarihler).slice(0, 80), tutar: Math.round((tutar || 0) * 100) / 100, faizTuru: fz, faizBaslangic: /^\d{4}-\d{2}-\d{2}$/.test(bas) ? bas : undefined };
      }).filter(x => x.tutar > 0).slice(0, 30);
    }
    if (!degisiklik.taraf && !degisiklik.yol && !degisiklik.kalemler) degisiklik = undefined;
  }
  return { ok: true, satir, degisiklik };
}

