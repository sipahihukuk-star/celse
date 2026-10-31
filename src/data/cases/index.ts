// Yeni dava eklemek için: JSON dosyasını bu klasöre koyun ve aşağıdaki listeye ekleyin.
import { normalizeCase } from "../../engine/engine";
import { CaseFile } from "../../engine/types";
import dEskiBorc from "./d-eski-borc.json";
import dTayin from "./d-tayin.json";
import dPerformans from "./d-performans.json";
import eskiBorc from "./eski-borc.json";
import geceAramasi from "./gece-aramasi.json";
import sozluFesih from "./sozlu-fesih.json";
import uzakAdliye from "./uzak-adliye.json";
import yargitayDurusma from "./yargitay-durusma.json";
import aihmBuyukDaire from "./aihm-buyuk-daire.json";
import ucmYargilama from "./ucm-yargilama.json";
import danistayYonetmelik from "./danistay-yonetmelik.json";
import danistayAceleKamulastirma from "./danistay-acele-kamulastirma.json";
import danistayCedBoruHatti from "./danistay-ced-boru-hatti.json";
import danistayImtiyaz from "./danistay-imtiyaz.json";
import danistayVergiTeblig from "./danistay-vergi-teblig.json";
import aymBireyselTutukluluk from "./aym-bireysel-tutukluluk.json";
import aymBireyselMulkiyet from "./aym-bireysel-mulkiyet.json";
import aymBireyselGerekce from "./aym-bireysel-gerekce.json";
import aymIptalSozluAciklama from "./aym-iptal-sozlu-aciklama.json";
import aymYuceDivan from "./aym-yuce-divan.json";
import sayistayFazlaHakedis from "./sayistay-fazla-hakedis.json";
import sayistayFazlaMesai from "./sayistay-fazla-mesai.json";
import sayistayDusukKira from "./sayistay-dusuk-kira.json";
import sayistayTemsilAgirlama from "./sayistay-temsil-agirlama.json";
import sayistayYargilamaninIadesi from "./sayistay-yargilamanin-iadesi.json";
import isEvlilikKidem from "./is-evlilik-kidem.json";
import isYillikIzin from "./is-yillik-izin.json";
import isUcretHakliFesih from "./is-ucret-hakli-fesih.json";
import isFazlaMesai from "./is-fazla-mesai.json";
import isKazasiTazminat from "./is-kazasi-tazminat.json";
import aihmMakulSure from "./aihm-makul-sure.json";
import aihmIfadeGazeteci from "./aihm-ifade-gazeteci.json";
import aihmIsyeriGozetim from "./aihm-isyeri-gozetim.json";
import ucmTamamlayicilik from "./ucm-tamamlayicilik.json";
import ucmUstSorumlulugu from "./ucm-ust-sorumlulugu.json";
import borcAyipliArac from "./borc-ayipli-arac.json";
import borcKefaletSekli from "./borc-kefalet-sekli.json";
import borcDevrilenAgac from "./borc-devrilen-agac.json";
import borcCezaKosulu from "./borc-ceza-kosulu.json";
import borcYanlisEft from "./borc-yanlis-eft.json";
import kiraDepozito from "./kira-depozito.json";
import tuketiciAyipliBuzdolabi from "./tuketici-ayipli-buzdolabi.json";
import tuketiciCaymaHakki from "./tuketici-cayma-hakki.json";
import kiraBedelTespiti from "./kira-bedel-tespiti.json";
import kiraTahliyeTaahhudu from "./kira-tahliye-taahhudu.json";

export const CASES = [dEskiBorc, dTayin, dPerformans, eskiBorc, geceAramasi, sozluFesih, uzakAdliye, yargitayDurusma, aihmBuyukDaire, ucmYargilama,
  danistayYonetmelik, danistayAceleKamulastirma, danistayCedBoruHatti, danistayImtiyaz, danistayVergiTeblig,
  aymBireyselTutukluluk, aymBireyselMulkiyet, aymBireyselGerekce, aymIptalSozluAciklama, aymYuceDivan,
  sayistayFazlaHakedis, sayistayFazlaMesai, sayistayDusukKira, sayistayTemsilAgirlama, sayistayYargilamaninIadesi,
  isEvlilikKidem,
  isYillikIzin,
  isUcretHakliFesih,
  isFazlaMesai,
  isKazasiTazminat,
  aihmMakulSure,
  aihmIfadeGazeteci,
  aihmIsyeriGozetim,
  ucmTamamlayicilik,
  ucmUstSorumlulugu,
  borcAyipliArac,
  borcKefaletSekli,
  borcDevrilenAgac,
  borcCezaKosulu,
  borcYanlisEft,
  kiraDepozito,
  tuketiciAyipliBuzdolabi,
  tuketiciCaymaHakki,
  kiraBedelTespiti,
  kiraTahliyeTaahhudu].map(c => normalizeCase(c as unknown as CaseFile));
export const DUEL_CASES = CASES.filter(c => c.mode === "duel");
export const SOLO_CASES = CASES.filter(c => c.mode === "solo");
export const caseById = (id: string) => CASES.find(c => c.id === id)!;
