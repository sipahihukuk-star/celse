// Kısaltma açılışı örnekleri: npx tsx tools/speech-test.ts
import { expandForSpeech } from "../src/engine/speechText";
const samples = [
  "TBK m.147 uyarınca beş yıllık zamanaşımı uygulanır.",
  "TBK'nın 344. maddesi kira artışını sınırlar.",
  "İş K. m.19/1 yazılı bildirim ister; İşK'ya göre savunma alınmalı.",
  "CMK'da tutuklama, CMK m.100 ile düzenlenir. AY m.38'e aykırı.",
  "Dava HMK'ya göre basit yargılamaya tabidir, İİK m.68/1 uyarınca itiraz kaldırılır.",
  "AİHM'e bireysel başvuru, AİHS m.6/1 ihlali iddiası. Av. Selin Kaya %20 indirim istedi: 45.000 TL.",
  "2023/415 E. sayılı dosya; AYM'nin kararı."
];
for (const s of samples) console.log("•", s, "\n  →", expandForSpeech(s));
for (const s of ["TBK'da", "TBK'dan", "TBK'yı", "TBK'yla", "AY'ya", "AY'da", "AYM'ye", "AİHS'nin", "TKHK'ya", "HAGB'ye"]) console.log(s, "→", expandForSpeech(s));
import { keywordScore } from "../src/engine/evaluate";
const g = [{ terms: ["TBK m.147"], weight: 1 }, { terms: ["İş K. m.19"], weight: 1 }];
console.log(keywordScore("Türk Borçlar Kanunu madde 147 ve İş Kanunu 19. maddesi gereği", g));
