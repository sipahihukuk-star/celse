// Büro föy numarası: her föye türüne göre sıra numarası verilir (H-1, H-2 … hukuk; C-1 … ceza; İ-1 … icra). Numara bir kez
// verilir ve değişmez (föy silinse de öteki numaralar kaymaz). Eski föylere açılış sırasıyla verilir.
import type { Foy } from "./foy";

const ON_EK: Record<string, string> = {
  hukuk: "H", ceza: "C", icra: "İ", idari_dava: "İD", sorusturma: "S", arabuluculuk: "A", idari_sorusturma: "İS", bireysel_basvuru: "AYM",
  tazminat_komisyonu: "TK", baro: "B", ozel_ceza: "ÖC", bilirkisi_gorev: "BG", arabulucu_gorev: "AG", danismanlik: "D", sozlesme: "SÖ"
};
export const foyNoOnEki = (tur?: string) => ON_EK[tur || "hukuk"] || "D";
const sayi = (no?: string) => { const m = (no || "").match(/-(\d+)$/); return m ? Number(m[1]) : 0; };

/** Numarası olmayan föylere numara verir; değişen föyler döner (şahsi föyler de kendi aralarında aynı sırayla). */
export function foyNolariVer(liste: Foy[]): Foy[] {
  const enBuyuk = new Map<string, number>();
  for (const f of liste) if (f.foyNo) { const p = f.foyNo.replace(/-\d+$/, ""); enBuyuk.set(p, Math.max(enBuyuk.get(p) || 0, sayi(f.foyNo))); }
  const out: Foy[] = [];
  for (const f of [...liste].filter(x => !x.foyNo).sort((a, b) => (a.acilis || a.olusturma || "").localeCompare(b.acilis || b.olusturma || "") || a.id.localeCompare(b.id))) {
    const p = foyNoOnEki(f.tur);
    const n = (enBuyuk.get(p) || 0) + 1;
    enBuyuk.set(p, n);
    out.push({ ...f, foyNo: `${p}-${n}` });
  }
  return out;
}
