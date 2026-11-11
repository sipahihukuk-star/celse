// İşçilik alacağında brütten nete: ilamda brüt yazılı alacağın icra takibinde net istenmesi için. Kesintiler alacağın
// niteliğine göre değişir:
//  • Ücret ve ücret niteliğindeki alacaklar (fazla mesai, yıllık izin, UBGT, hafta tatili, prim, ikramiye): SGK işçi payı %14,
//    işsizlik sigortası işçi payı %1, gelir vergisi (matrah: brüt − SGK − işsizlik), damga vergisi binde 7,59.
//  • İhbar tazminatı (ve kötüniyet tazminatı): sigorta primi kesilmez; gelir vergisi + damga vergisi.
//  • Kıdem tazminatı: gelir vergisinden istisna (GVK m.25/7, tavan içinde); yalnız damga vergisi.
// Gelir vergisi oranı yıl içindeki toplam matraha göre %15–%40 arası değişir; kesin hesap bordro gerektirir, burada seçilen
// tek oranla yaklaşık hesaplanır. Asgari ücret istisnası dikkate alınmaz.
export type BrutTur = "ucret" | "ihbar" | "kidem";
export const BRUT_TURLER: { k: BrutTur; ad: string }[] = [
  { k: "ucret", ad: "Ücret niteliğinde (fazla mesai, yıllık izin, UBGT, hafta tatili, prim): SGK + işsizlik + gelir + damga" },
  { k: "ihbar", ad: "İhbar / kötüniyet tazminatı: gelir + damga vergisi" },
  { k: "kidem", ad: "Kıdem tazminatı: yalnız damga vergisi" }
];
export const GV_ORANLARI = [15, 20, 27, 35, 40];
export const SGK_ISCI = 14, ISSIZLIK_ISCI = 1, DAMGA_BINDE = 7.59;

const r2 = (x: number) => Math.round(x * 100) / 100;

/** Kalemin adından tahmin: "Kıdem tazminatı" → kıdem, "İhbar…" → ihbar, öteki işçilik alacakları ücret niteliğinde. */
export function brutTurTahmin(ad: string): BrutTur {
  const x = ad.toLocaleLowerCase("tr");
  return /kıdem|kidem/.test(x) ? "kidem" : /ihbar|kötü ?niyet|kotu ?niyet/.test(x) ? "ihbar" : "ucret";
}

export interface BrutNetSonuc { brut: number; net: number; kesintiler: { ad: string; tutar: number }[] }
export function brutNet(brut: number, tur: BrutTur, gvOrani = 15): BrutNetSonuc {
  const kesintiler: { ad: string; tutar: number }[] = [];
  let matrah = brut;
  if (tur === "ucret") {
    const sgk = r2(brut * SGK_ISCI / 100), iss = r2(brut * ISSIZLIK_ISCI / 100);
    kesintiler.push({ ad: `SGK işçi payı (%${SGK_ISCI})`, tutar: sgk }, { ad: `İşsizlik sigortası işçi payı (%${ISSIZLIK_ISCI})`, tutar: iss });
    matrah = brut - sgk - iss;
  }
  if (tur !== "kidem") kesintiler.push({ ad: `Gelir vergisi (%${gvOrani})`, tutar: r2(matrah * gvOrani / 100) });
  kesintiler.push({ ad: "Damga vergisi (binde 7,59)", tutar: r2(brut * DAMGA_BINDE / 1000) });
  return { brut, net: r2(brut - kesintiler.reduce((a, k) => a + k.tutar, 0)), kesintiler };
}
