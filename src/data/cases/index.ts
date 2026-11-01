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
import agirYagmaGonulluVazgecme from "./agir-yagma-gonullu-vazgecme.json";
import agirUyusturucuTicaret from "./agir-uyusturucu-ticaret.json";
import agirOldurmeyeTesebbus from "./agir-oldurmeye-tesebbus.json";
import agirBilisimDolandiricilik from "./agir-bilisim-dolandiricilik.json";
import agirMudafisizIfade from "./agir-mudafisiz-ifade.json";
import cezaBasitYaralamaSikayet from "./ceza-basit-yaralama-sikayet.json";
import cezaHirsizlikEtkinPismanlik from "./ceza-hirsizlik-etkin-pismanlik.json";
import icraHaczedilmezlik from "./icra-haczedilmezlik.json";
import cezaMesruMudafaa from "./ceza-mesru-mudafaa.json";
import cezaHakaretHagb from "./ceza-hakaret-hagb.json";
import aileAnlasmaliBosanma from "./aile-anlasmali-bosanma.json";
import aileNafakaArtirim from "./aile-nafaka-artirim.json";
import mirasRed from "./miras-red.json";
import aileMalRejimi from "./aile-mal-rejimi.json";
import mirasTenkis from "./miras-tenkis.json";
import idareDisiplinSavunma from "./idare-disiplin-savunma.json";
import idareImarParaCezasi from "./idare-imar-para-cezasi.json";
import vergiSahteFatura from "./vergi-sahte-fatura.json";
import idareTamYargiCukur from "./idare-tam-yargi-cukur.json";
import idareIhaleIvedi from "./idare-ihale-ivedi.json";
import yargitayHaksizTahrik from "./yargitay-haksiz-tahrik.json";
import yargitayMurisMuvazaasi from "./yargitay-muris-muvazaasi.json";
import yargitayEkSavunma from "./yargitay-ek-savunma.json";
import yargitayDestektenYoksun from "./yargitay-destekten-yoksun.json";
import yargitayBilincliTaksir from "./yargitay-bilincli-taksir.json";
import bamYeniDelilYasagi from "./bam-yeni-delil-yasagi.json";
import bamKatilmaYoluylaIstinaf from "./bam-katilma-yoluyla-istinaf.json";
import bamCezaAleyheBozma from "./bam-ceza-aleyhe-bozma.json";
import bamIslahIstinafta from "./bam-islah-istinafta.json";
import bamKaldiripGonderme from "./bam-kaldirip-gonderme.json";
import dkDevamsizlikFesih from "./dk-devamsizlik-fesih.json";
import dkFazlaCalisma from "./dk-fazla-calisma.json";
import dkBosanmaKusur from "./dk-bosanma-kusur.json";
import dkVelayetDegisikligi from "./dk-velayet-degisikligi.json";
import dkYoksullukNafakasi from "./dk-yoksulluk-nafakasi.json";
import dkMemurAtama from "./dk-memur-atama.json";
import dkVergiZiyai from "./dk-vergi-ziyai.json";
import dkIstinafKira from "./dk-istinaf-kira.json";
import dkYargitayDolandiricilik from "./dk-yargitay-dolandiricilik.json";
import dkAymIfade from "./dk-aym-ifade.json";
import dkKiraTemerrut from "./dk-kira-temerrut.json";
import dkTasanInsaat from "./dk-tasan-insaat.json";
import dkTrafikTazminat from "./dk-trafik-tazminat.json";
import dkEserAyip from "./dk-eser-ayip.json";
import dkCekMenfiTespit from "./dk-cek-menfi-tespit.json";
import dkTehdit from "./dk-tehdit.json";
import dkKonutDokunulmazligi from "./dk-konut-dokunulmazligi.json";
import dkGuveniKotuye from "./dk-guveni-kotuye.json";
import dkTaksirleYaralama from "./dk-taksirle-yaralama.json";
import dkAgirYaralamaTahrik from "./dk-agir-yaralama-tahrik.json";
import ticaretCekIbraz from "./ticaret-cek-ibraz.json";
import ticaretHaksizRekabet from "./ticaret-haksiz-rekabet.json";
import ticaretCariHesap from "./ticaret-cari-hesap.json";
import ticaretTasimaHasar from "./ticaret-tasima-hasar.json";
import ticaretGenelKurulIptal from "./ticaret-genel-kurul-iptal.json";
import ticaretLimitedCikma from "./ticaret-limited-cikma.json";
import icraItirazinKaldirilmasi from "./icra-itirazin-kaldirilmasi.json";
import icraItirazinIptali from "./icra-itirazin-iptali.json";
import icraKambiyoSenedi from "./icra-kambiyo-senedi.json";
import icraKiraTahliye from "./icra-kira-tahliye.json";
import icraIstihkak from "./icra-istihkak.json";
import icraIhaleninFeshi from "./icra-ihalenin-feshi.json";
import icraMenfiTespit from "./icra-menfi-tespit.json";
import icraIlamliTakip from "./icra-ilamli-takip.json";
import thCasAntrenor from "./th-cas-antrenor.json";
import thCasDopingTakviye from "./th-cas-doping-takviye.json";
import thCasHakliSebep from "./th-cas-hakli-sebep.json";
import thCasOlimpiyatUyruk from "./th-cas-olimpiyat-uyruk.json";
import thCasSikeUefa from "./th-cas-sike-uefa.json";
import thCasYetistirme from "./th-cas-yetistirme.json";
import thIccAcilHakem from "./th-icc-acil-hakem.json";
import thIccBelgeIbrazi from "./th-icc-belge-ibrazi.json";
import thIccCisgAyip from "./th-icc-cisg-ayip.json";
import thIccCokluTaraf from "./th-icc-coklu-taraf.json";
import thIccFaizDoviz from "./th-icc-faiz-doviz.json";
import thIccFidicGecikme from "./th-icc-fidic-gecikme.json";
import thIccMucbirSebep from "./th-icc-mucbir-sebep.json";
import thIhtkCezaMakulSure from "./th-ihtk-ceza-makul-sure.json";
import thIhtkDisiplinSavunma from "./th-ihtk-disiplin-savunma.json";
import thIhtkEksikIcra from "./th-ihtk-eksik-icra.json";
import thIhtkGecIcra from "./th-ihtk-gec-icra.json";
import thIhtkGorevDisiSure from "./th-ihtk-gorev-disi-sure.json";
import thIhtkIdariMakulSure from "./th-ihtk-idari-makul-sure.json";
import thIhtkIscilikMakulSure from "./th-ihtk-iscilik-makul-sure.json";
import thIhtkKamulastirmaDegerKaybi from "./th-ihtk-kamulastirma-deger-kaybi.json";
import thIstacDistributorPortfoy from "./th-istac-distributor-portfoy.json";
import thIstacFiyatRevizyonu from "./th-istac-fiyat-revizyonu.json";
import thIstacIptalEkRapor from "./th-istac-iptal-ek-rapor.json";
import thIstacJvCikmaz from "./th-istac-jv-cikmaz.json";
import thIstacKompetenz from "./th-istac-kompetenz.json";
import thLciaDemuraj from "./th-lcia-demuraj.json";
import thLciaHakemReddi from "./th-lcia-hakem-reddi.json";
import thSigortaDaskMuafiyet from "./th-sigorta-dask-muafiyet.json";
import thSigortaIsverenIsKazasi from "./th-sigorta-isveren-is-kazasi.json";
import thSigortaItirazKesinlik from "./th-sigorta-itiraz-kesinlik.json";
import thSigortaKaskoAlkol from "./th-sigorta-kasko-alkol.json";
import thSigortaKonutSu from "./th-sigorta-konut-su.json";
import thSigortaKrediHayat from "./th-sigorta-kredi-hayat.json";
import thSigortaMeslekiTalepEsasli from "./th-sigorta-mesleki-talep-esasli.json";
import thSigortaNakliyatAmbalaj from "./th-sigorta-nakliyat-ambalaj.json";
import thSigortaRucuKusur from "./th-sigorta-rucu-kusur.json";
import thSigortaSaglikMenisku from "./th-sigorta-saglik-menisku.json";
import thSigortaTarimDolu from "./th-sigorta-tarim-dolu.json";
import thSigortaTrafikDeger from "./th-sigorta-trafik-deger.json";
import thSigortaTrafikDestek from "./th-sigorta-trafik-destek.json";
import thSigortaYanginEksik from "./th-sigorta-yangin-eksik.json";
import thTffKulupLisans from "./th-tff-kulup-lisans.json";
import thTffMenajerKomisyon from "./th-tff-menajer-komisyon.json";
import thTffPfdkSeyircisiz from "./th-tff-pfdk-seyircisiz.json";
import thTffTescilItc from "./th-tff-tescil-itc.json";
import thTffUckHakliFesih from "./th-tff-uck-hakli-fesih.json";
import thTffVarTescil from "./th-tff-var-tescil.json";
import thUncitralKnowHow from "./th-uncitral-know-how.json";
import thUncitralTenfizViyana from "./th-uncitral-tenfiz-viyana.json";

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
  kiraTahliyeTaahhudu,
  agirYagmaGonulluVazgecme,
  agirUyusturucuTicaret,
  agirOldurmeyeTesebbus,
  agirBilisimDolandiricilik,
  agirMudafisizIfade,
  cezaBasitYaralamaSikayet,
  cezaHirsizlikEtkinPismanlik,
  icraHaczedilmezlik,
  cezaMesruMudafaa,
  cezaHakaretHagb,
  aileAnlasmaliBosanma,
  aileNafakaArtirim,
  mirasRed,
  aileMalRejimi,
  mirasTenkis,
  idareDisiplinSavunma,
  idareImarParaCezasi,
  vergiSahteFatura,
  idareTamYargiCukur,
  idareIhaleIvedi,
  yargitayHaksizTahrik,
  yargitayMurisMuvazaasi,
  yargitayEkSavunma,
  yargitayDestektenYoksun,
  yargitayBilincliTaksir,
  bamYeniDelilYasagi,
  bamKatilmaYoluylaIstinaf,
  bamCezaAleyheBozma,
  bamIslahIstinafta,
  bamKaldiripGonderme,
  dkDevamsizlikFesih,
  dkFazlaCalisma,
  dkBosanmaKusur,
  dkVelayetDegisikligi,
  dkYoksullukNafakasi,
  dkMemurAtama,
  dkVergiZiyai,
  dkIstinafKira,
  dkYargitayDolandiricilik,
  dkAymIfade,
  dkKiraTemerrut,
  dkTasanInsaat,
  dkTrafikTazminat,
  dkEserAyip,
  dkCekMenfiTespit,
  dkTehdit,
  dkKonutDokunulmazligi,
  dkGuveniKotuye,
  dkTaksirleYaralama,
  dkAgirYaralamaTahrik,
  ticaretCekIbraz,
  ticaretHaksizRekabet,
  ticaretCariHesap,
  ticaretTasimaHasar,
  ticaretGenelKurulIptal,
  ticaretLimitedCikma,
  icraItirazinKaldirilmasi,
  icraItirazinIptali,
  icraKambiyoSenedi,
  icraKiraTahliye,
  icraIstihkak,
  icraIhaleninFeshi,
  icraMenfiTespit,
  icraIlamliTakip,
  thCasAntrenor,
  thCasDopingTakviye,
  thCasHakliSebep,
  thCasOlimpiyatUyruk,
  thCasSikeUefa,
  thCasYetistirme,
  thIccAcilHakem,
  thIccBelgeIbrazi,
  thIccCisgAyip,
  thIccCokluTaraf,
  thIccFaizDoviz,
  thIccFidicGecikme,
  thIccMucbirSebep,
  thIhtkCezaMakulSure,
  thIhtkDisiplinSavunma,
  thIhtkEksikIcra,
  thIhtkGecIcra,
  thIhtkGorevDisiSure,
  thIhtkIdariMakulSure,
  thIhtkIscilikMakulSure,
  thIhtkKamulastirmaDegerKaybi,
  thIstacDistributorPortfoy,
  thIstacFiyatRevizyonu,
  thIstacIptalEkRapor,
  thIstacJvCikmaz,
  thIstacKompetenz,
  thLciaDemuraj,
  thLciaHakemReddi,
  thSigortaDaskMuafiyet,
  thSigortaIsverenIsKazasi,
  thSigortaItirazKesinlik,
  thSigortaKaskoAlkol,
  thSigortaKonutSu,
  thSigortaKrediHayat,
  thSigortaMeslekiTalepEsasli,
  thSigortaNakliyatAmbalaj,
  thSigortaRucuKusur,
  thSigortaSaglikMenisku,
  thSigortaTarimDolu,
  thSigortaTrafikDeger,
  thSigortaTrafikDestek,
  thSigortaYanginEksik,
  thTffKulupLisans,
  thTffMenajerKomisyon,
  thTffPfdkSeyircisiz,
  thTffTescilItc,
  thTffUckHakliFesih,
  thTffVarTescil,
  thUncitralKnowHow,
  thUncitralTenfizViyana].map(c => normalizeCase(c as unknown as CaseFile));
export const DUEL_CASES = CASES.filter(c => c.mode === "duel");
export const SOLO_CASES = CASES.filter(c => c.mode === "solo");
export const caseById = (id: string) => CASES.find(c => c.id === id)!;
