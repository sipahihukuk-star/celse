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

export const CASES = [dEskiBorc, dTayin, dPerformans, eskiBorc, geceAramasi, sozluFesih, uzakAdliye, yargitayDurusma, aihmBuyukDaire, ucmYargilama,
  aymBireyselTutukluluk, aymBireyselMulkiyet, aymBireyselGerekce, aymIptalSozluAciklama, aymYuceDivan,
  sayistayFazlaHakedis, sayistayFazlaMesai, sayistayDusukKira, sayistayTemsilAgirlama, sayistayYargilamaninIadesi].map(c => normalizeCase(c as unknown as CaseFile));
export const DUEL_CASES = CASES.filter(c => c.mode === "duel");
export const SOLO_CASES = CASES.filter(c => c.mode === "solo");
export const caseById = (id: string) => CASES.find(c => c.id === id)!;
