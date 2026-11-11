// Oyunun yerleşik dava dosyaları (yaklaşık 4 MB) ilk açılışta indirilmez: dava takibi ve danışma ekranları bunlara
// hiç ihtiyaç duymaz. Oyun listesi, kariyer ya da yönetim paneli ilk kez gerektiğinde ayrı dosya olarak arkadan yüklenir.
import { useEffect, useState } from "react";
import type { CaseFile } from "../engine/types";

let yuklu: CaseFile[] | null = null;
let soz: Promise<CaseFile[]> | null = null;
const dinleyen = new Set<() => void>();

/** Yerleşik davaları yükler (bir kez). */
export function davalariYukle(): Promise<CaseFile[]> {
  if (!soz) {
    soz = import("./cases").then(m => { yuklu = m.CASES; dinleyen.forEach(f => f()); return yuklu; })
      .catch(e => { soz = null; throw e; });
  }
  return soz;
}
/** Yüklendiyse davalar, yoksa boş liste (yükleme bitince useDavalar yeniden çizer). */
export const yukluDavalar = (): CaseFile[] => yuklu || [];

/** Yerleşik davalar; arkadan yüklenir. gecikme: açılışta önce asıl ekran gelsin diye yüklemeyi biraz geciktirir (ms). */
export function useDavalar(gecikme = 0): CaseFile[] {
  const [, yenile] = useState(0);
  useEffect(() => {
    const f = () => yenile(x => x + 1);
    dinleyen.add(f);
    let z: ReturnType<typeof setTimeout> | undefined;
    if (!yuklu) { if (gecikme > 0) z = setTimeout(() => { davalariYukle().catch(() => {}); }, gecikme); else davalariYukle().catch(() => {}); }
    return () => { dinleyen.delete(f); if (z) clearTimeout(z); };
  }, [gecikme]);
  return yukluDavalar();
}
