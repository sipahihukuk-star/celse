// Kanun yolu sınırları ve tatiller: her yıl güncellenmesi gereken bütün sayılar YALNIZCA bu dosyada durur.
//
// GÜNCELLEME (her yıl Ocak): HMK ek m.1 ve İİK / İYUK'taki parasal sınırlar, Vergi Usul Kanunu uyarınca ilan edilen
// yeniden değerleme oranıyla her yıl artar. Resmî tutarı Resmî Gazete / Yargıtay ve Danıştay duyurularından alın ve
// ilgili yılın satırına yazın. `null` = tutar girilmemiş: oyun bu sınırı uygulamaz ("parasal sınır doğrulanmadı" der).
// 7550 s.K. (2025) ile HMK ek m.1/2: sınırda DAVANIN AÇILDIĞI TARİHTEKİ tutar esas alınır (dosyada kanunYolu.yil).
//
// Tutarlar burada bilerek boş bırakıldı: kaynağı doğrulanmamış bir rakam oyuncuya yanlış hukuk öğretir.

export interface YearLimits {
  /** HMK m.341/2: bu tutarı geçmeyen malvarlığı davalarındaki ilk derece kararları kesindir (istinafa kapalı). */
  hmkIstinaf: number | null;
  /** HMK m.362/1-a: bu tutarı geçmeyen davalardaki bölge adliye kararları temyiz edilemez. */
  hmkTemyiz: number | null;
  /** İİK m.363/1: bu tutarı geçmeyen icra mahkemesi kararları kesindir. */
  iikIstinaf: number | null;
  /** İİK m.364/1: bölge adliye mahkemesi hukuk dairesinin bu tutarı geçmeyen kararları temyiz edilemez. */
  iikTemyiz: number | null;
  /** İYUK m.46/1-b: konusu bu tutarı aşan vergi, tam yargı ve idari işlem davalarında daire kararı temyize açıktır. */
  iyukTemyiz: number | null;
}

/** Yıl → sınırlar. DOĞRULAYIN: ikincil kaynaklarda 2026 için farklı rakamlar dolaşıyor; resmî ilana göre girin. */
export const PARASAL_SINIR: Record<number, YearLimits> = {
  2025: { hmkIstinaf: null, hmkTemyiz: null, iikIstinaf: null, iikTemyiz: null, iyukTemyiz: null },
  2026: { hmkIstinaf: null, hmkTemyiz: null, iikIstinaf: null, iikTemyiz: null, iyukTemyiz: null },
  2027: { hmkIstinaf: null, hmkTemyiz: null, iikIstinaf: null, iikTemyiz: null, iyukTemyiz: null }
};

/** CMK m.272/3 ve m.286/2: ceza kanun yolu sınırları. Bunlar yeniden değerlemeye bağlı değildir; metni değişirse güncelleyin. */
export const CMK_SINIR = {
  /** CMK m.272/3-a: hükümde sonuç olarak belirlenen bu tutar dahil adli para cezasına ilişkin hükümler istinafa kapalı. DOĞRULAYIN. */
  istinafAdliParaTL: 3000,
  /** CMK m.272/3-b: üst sınırı bu günü geçmeyen adli para cezasını gerektiren suçlardan beraat hükümleri istinafa kapalı. */
  istinafBeraatUstSinirGun: 500,
  /** CMK m.286/2-a: ilk derece mahkemesince verilen bu süre (ay) veya daha az hapis cezalarına ilişkin BAM hükümleri temyize kapalı. DOĞRULAYIN. */
  temyizHapisAy: 60
};

/** Sabit resmî tatiller (AA-GG). 28 Ekim öğleden sonra ve dini bayram arifeleri yarım gündür; süre hesabında tam gün sayılmaz. */
export const SABIT_TATIL = ["01-01", "04-23", "05-01", "05-19", "07-15", "08-30", "10-29"];

/** Dini bayramlar (YYYY-AA-GG, arife hariç). DOĞRULAYIN: Diyanet takvimine göre; 2028 tarihleri yaklaşık. */
export const BAYRAMLAR: string[] = [
  // 2025: Ramazan 30 Mart–1 Nisan, Kurban 6–9 Haziran
  "2025-03-30", "2025-03-31", "2025-04-01", "2025-06-06", "2025-06-07", "2025-06-08", "2025-06-09",
  // 2026: Ramazan 20–22 Mart, Kurban 27–30 Mayıs
  "2026-03-20", "2026-03-21", "2026-03-22", "2026-05-27", "2026-05-28", "2026-05-29", "2026-05-30",
  // 2027: Ramazan 9–11 Mart, Kurban 16–19 Mayıs
  "2027-03-09", "2027-03-10", "2027-03-11", "2027-05-16", "2027-05-17", "2027-05-18", "2027-05-19",
  // 2028: Ramazan 26–28 Şubat, Kurban 4–7 Mayıs (yaklaşık)
  "2028-02-26", "2028-02-27", "2028-02-28", "2028-05-04", "2028-05-05", "2028-05-06", "2028-05-07"
];

/** Adli tatil (HMK m.102; İYUK m.61; CMK m.331): 20 Temmuz – 31 Ağustos. Tatile rastlayan sürenin uzayacağı gün sayısı
 *  rejime göre: HMK m.104 ve İYUK m.62 bir hafta, CMK m.331/4 üç gün. Adli tatilde görülen işler (HMK m.103) ayrıca değerlendirilmez.
 *  İcra hukuk (İİK) için uzama girilmedi: DOĞRULAYIN. Oyun içi senaryolarda tebliğ tarihleri adli tatile denk getirilmez. */
export const ADLI_TATIL = { from: "07-20", to: "08-31", uzama: { hmk: 7, iyuk: 7, cmk: 3 } as Record<string, number | undefined> };
