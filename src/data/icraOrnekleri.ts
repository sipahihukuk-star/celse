// İcra ve İflas Kanunu Yönetmeliği (RG 11.04.2005) m. 19'daki örnekler: takip talebi (Örnek 1), icra emirleri (Örnek 2–6, 44),
// ödeme emirleri (Örnek 7–13), tahliye emri (Örnek 14) ve takip sonrası sık kullanılanlar. Her örneğin içeriği Yönetmelik
// m. 20–36'ya göre; süreler İİK'daki sürelerdir. Borçluya gidecek emri icra dairesi UYAP'ta düzenler; buradaki metinler
// avukatın kontrolü, müvekkile açıklama ve dosyaya not içindir (taslak).
import type { Foy } from "./foy";
import { emirOrnegi, IcraBilgi, icraHesapla, takipTalebiMetni, tl } from "./icra";

export type OrnekTur = "takip_talebi" | "icra_emri" | "odeme_emri" | "tahliye_emri" | "takip_sonrasi";
export interface IcraOrnegi {
  no: string; ad: string; tur: OrnekTur; madde: string; kanun: string;
  /** borçlunun süreleri (gün) */
  odeme?: number; itiraz?: number; malBeyani?: number; tahliye?: number;
  /** emirde borçluya yapılacak ihtarlar (Yönetmelik maddesindeki sırayla, sade dille) */
  ihtarlar: string[];
}

const MAL_BEYANI = (gun: number) => `Bu emrin tebliğinden itibaren ${gun} gün içinde İİK m. 74 uyarınca mal beyanında bulunmanız; bulunmazsanız İİK m. 337 uyarınca tazyik hapsi ile, gerçeğe aykırı beyanda bulunursanız İİK m. 338 uyarınca hapis cezası ile cezalandırılacağınız.`;
const ADRES = "Yurt içinde bir adres göstermeniz; adresinizi değiştirip bildirmezseniz tebligatın bilinen son adresinize yapılacağı (Tebligat Kanunu m. 35).";

export const ICRA_ORNEKLERI: IcraOrnegi[] = [
  { no: "1", ad: "İcra tutanağı ve takip talebi", tur: "takip_talebi", madde: "Yön. m. 19/a, 20, 21", kanun: "İİK m. 58", ihtarlar: [] },
  { no: "2", ad: "Taşınır teslimi / taşınmaz tahliye ve teslimi icra emri (ilamlı)", tur: "icra_emri", madde: "Yön. m. 23", kanun: "İİK m. 24, 26", tahliye: 7, ihtarlar: [
    "İlamda yazılı taşınırı teslim etmeniz ya da taşınmazı tahliye ve teslim etmeniz için bu emrin tebliğinden itibaren 7 gün süre verildiği.",
    "Bu süre içinde teslim ya da tahliye etmezseniz İİK m. 24 ve 26 uyarınca zorla yerine getirileceği.",
    "Teslimi istenen taşınır elinizde bulunmazsa, ilamda yazılı değeri (yazılı değilse haciz sırasındaki rayiç değeri) yeniden emre gerek olmadan haciz yoluyla tahsil edileceği."] },
  { no: "3", ad: "Çocuk teslimi / çocukla kişisel ilişki kurulması icra emri", tur: "icra_emri", madde: "Yön. m. 24", kanun: "İİK m. 25, 25/a, 341", tahliye: 7, ihtarlar: [
    "Çocuğu bu emrin tebliğinden itibaren 7 gün içinde teslim etmeniz; etmezseniz İİK m. 341 uyarınca cezalandırılacağınız ve İİK m. 25 uyarınca zorla teslim alınacağı.",
    "Kişisel ilişki kurulmasına engel olmamanız; engel olursanız İİK m. 25/a ve 341 hükümlerinin uygulanacağı."] },
  { no: "4", ad: "Bir işin yapılması ya da yapılmaması icra emri (ilamlı)", tur: "icra_emri", madde: "Yön. m. 25", kanun: "İİK m. 28, 30, 343", ihtarlar: [
    "İlamda yazılı işi ilamın ya da icra müdürünün belirlediği süre içinde yapmanız (ya da yapmamanız).",
    "Yapmazsanız işin İİK m. 30 uyarınca masrafı sizden alınarak yaptırılacağı; işi bizzat yapmanız gerekiyorsa ya da yapmama emrine aykırı davranırsanız İİK m. 343 uyarınca cezalandırılacağınız."] },
  { no: "5", ad: "Para borcu ya da teminat verilmesi icra emri (ilamlı)", tur: "icra_emri", madde: "Yön. m. 26", kanun: "İİK m. 32, 33, 74", odeme: 7, malBeyani: 7, ihtarlar: [
    "Yukarıda yazılı borcu ve takip giderlerini bu emrin tebliğinden itibaren 7 gün içinde icra dairesinin banka hesabına ödemeniz (teminat verilmesine dair ilamda teminatı göstermeniz).",
    "Bu süre içinde icra mahkemesinden, Yargıtay'dan ya da bölge adliye mahkemesinden veya yargılamanın yenilenmesi yoluyla icranın geri bırakılmasına ya da ertelenmesine dair bir karar getirmezseniz cebri icraya devam olunacağı (İİK m. 33, 36).",
    MAL_BEYANI(7)] },
  { no: "6", ad: "İpoteğin paraya çevrilmesi icra emri (ilam niteliğinde belge)", tur: "icra_emri", madde: "Yön. m. 27", kanun: "İİK m. 149", odeme: 30, ihtarlar: [
    "Borcu bu emrin tebliğinden itibaren 30 gün içinde icra dairesinin banka hesabına ödemeniz.",
    "Bu süre içinde ödemez ve icra mahkemesinden icranın geri bırakılmasına dair bir karar getirmezseniz alacaklının ipotekli taşınmazın satışını isteyebileceği (İİK m. 149, 149/a).",
    "Taşınmaz üçüncü kişiye aitse emrin malik üçüncü kişiye de tebliğ edileceği."] },
  { no: "7", ad: "İlamsız takipte ödeme emri (genel haciz yolu)", tur: "odeme_emri", madde: "Yön. m. 29", kanun: "İİK m. 60–62, 74", odeme: 7, itiraz: 7, malBeyani: 7, ihtarlar: [
    "Borcu ve takip giderlerini bu emrin tebliğinden itibaren 7 gün içinde icra dairesinin banka hesabına ödemeniz.",
    "Takibe dayanak belgedeki imza size ait değilse bunu ayrıca ve açıkça 7 gün içinde bildirmeniz; bildirmezseniz belgenin takip bakımından sizden çıkmış sayılacağı (İİK m. 63, 68/a).",
    "Borcun tamamına ya da bir kısmına itirazınız varsa 7 gün içinde sebepleriyle icra dairesine bildirmeniz; kısmi itirazda itiraz ettiğiniz kısmı ve miktarı açıkça göstermeniz, göstermezseniz itiraz etmemiş sayılacağınız (İİK m. 62).",
    MAL_BEYANI(7), ADRES,
    "Süresinde ödemez ve itiraz etmezseniz cebri icraya devam olunacağı (İİK m. 60)."] },
  { no: "8", ad: "Taşınır rehninin paraya çevrilmesi ödeme emri", tur: "odeme_emri", madde: "Yön. m. 30", kanun: "İİK m. 145, 146", odeme: 15, itiraz: 7, ihtarlar: [
    "Borca ya da rehin hakkına itirazınızı bu emrin tebliğinden itibaren 7 gün içinde bildirmeniz; bildirmezseniz rehin hakkının varlığını artık tartışamayacağınız.",
    "Borcu 15 gün içinde ödemeniz; itiraz etmez ve ödemezseniz rehinli malın satılacağı (İİK m. 146).",
    "Yalnız rehin hakkına itiraz ederseniz alacaklının haciz yoluyla takibe devam edebileceği."] },
  { no: "9", ad: "İpoteğin paraya çevrilmesi ödeme emri", tur: "odeme_emri", madde: "Yön. m. 31", kanun: "İİK m. 148, 149/a", odeme: 30, itiraz: 7, ihtarlar: [
    "Borca itirazınızı bu emrin tebliğinden itibaren 7 gün içinde bildirmeniz; süresinde itiraz etmezseniz ipotek hakkına artık itiraz edemeyeceğiniz.",
    "Borcu 30 gün içinde ödemeniz; itiraz etmez ve ödemezseniz alacaklının ipotekli taşınmazın satışını isteyebileceği."] },
  { no: "10", ad: "Kambiyo senetlerine dayalı haciz yolu ödeme emri", tur: "odeme_emri", madde: "Yön. m. 32", kanun: "İİK m. 167–170/a, 74", odeme: 10, itiraz: 5, malBeyani: 10, ihtarlar: [
    "Borcu ve takip giderlerini bu emrin tebliğinden itibaren 10 gün içinde icra dairesinin banka hesabına ödemeniz.",
    "Senet kambiyo senedi niteliğinde değilse 5 gün içinde icra mahkemesine şikâyet etmeniz (İİK m. 170/a).",
    "Senetteki imza size ait değilse 5 gün içinde ayrı bir dilekçeyle icra mahkemesine bildirmeniz; bildirmezseniz senedin takip bakımından sizden çıkmış sayılacağı; imzanızı kötüniyetle inkâr ederseniz alacağın %10'u oranında para cezasına mahkûm edileceğiniz (İİK m. 170).",
    "Borca, zamanaşımına ve yetkiye itirazlarınızı 5 gün içinde sebepleriyle icra mahkemesine bildirmeniz; itirazın takibi kendiliğinden durdurmayacağı (İİK m. 168, 169, 169/a).",
    MAL_BEYANI(10), ADRES] },
  { no: "11", ad: "İflas yoluyla adi takipte ödeme emri", tur: "odeme_emri", madde: "Yön. m. 33", kanun: "İİK m. 155, 156", odeme: 7, itiraz: 7, ihtarlar: [
    "Borcu bu emrin tebliğinden itibaren 7 gün içinde ödemeniz; borcun olmadığına ya da iflasa tabi olmadığınıza dair itirazınızı aynı sürede bildirmeniz.",
    "Ödemez ve itiraz etmezseniz alacaklının ticaret mahkemesinden iflasınızı isteyebileceği; konkordato talep etme hakkınız bulunduğu."] },
  { no: "12", ad: "Kambiyo senetlerine dayalı iflas yolu ödeme emri", tur: "odeme_emri", madde: "Yön. m. 34", kanun: "İİK m. 171, 172", odeme: 5, itiraz: 5, ihtarlar: [
    "Borcu bu emrin tebliğinden itibaren 5 gün içinde ödemeniz; itiraz ve şikâyetlerinizi aynı sürede sebepleriyle bildirmeniz.",
    "Ödemez ve itiraz etmezseniz alacaklının ticaret mahkemesinden iflasınızı isteyebileceği; itiraz ederseniz alacaklının itirazın kaldırılmasını ve iflasınızı isteyebileceği."] },
  { no: "13", ad: "Adi kira ve hasılat kiralarına ait takipte ödeme emri", tur: "odeme_emri", madde: "Yön. m. 35", kanun: "İİK m. 269, 269/a", odeme: 30, itiraz: 7, malBeyani: 7, ihtarlar: [
    "Kira sözleşmesine ya da kira bedeline itirazınızı bu emrin tebliğinden itibaren 7 gün içinde bildirmeniz; sözleşmeyi açıkça inkâr etmezseniz kabul etmiş sayılacağınız (İİK m. 269).",
    "Kira bedelini 30 gün içinde ödemeniz (TBK m. 315); ödemezseniz alacaklının icra mahkemesinden taşınmazdan tahliyenizi isteyebileceği (İİK m. 269/a).",
    MAL_BEYANI(7)] },
  { no: "14", ad: "Kira süresi bitiminde tahliye emri (yazılı sözleşme)", tur: "tahliye_emri", madde: "Yön. m. 36", kanun: "İİK m. 272–274", itiraz: 7, tahliye: 15, ihtarlar: [
    "Sözleşmenin uzatıldığına ya da yenilendiğine dair itirazınızı bu emrin tebliğinden itibaren 7 gün içinde bildirmeniz.",
    "İtiraz etmezseniz taşınmazı tebliğden itibaren 15 gün içinde tahliye ve teslim etmeniz; etmezseniz zorla tahliye edileceği (İİK m. 273)."] },
  { no: "44", ad: "Taşınır rehninin paraya çevrilmesi icra emri (ilamlı)", tur: "icra_emri", madde: "Yön. m. 28", kanun: "İİK m. 145", odeme: 7, ihtarlar: [
    "Borcu bu emrin tebliğinden itibaren 7 gün içinde icra dairesinin banka hesabına ödemeniz.",
    "Ödemez ve icranın geri bırakılmasına dair bir karar getirmezseniz alacaklının rehinli malın satışını isteyebileceği; rehin üçüncü kişiye aitse emrin ona da tebliğ edileceği."] },
  { no: "18", ad: "İtiraz belgesi", tur: "takip_sonrasi", madde: "Yön. m. 19/r", kanun: "İİK m. 62, 67, 68", ihtarlar: [] },
  { no: "20", ad: "Birinci haciz ihbarnamesi (89/1)", tur: "takip_sonrasi", madde: "Yön. m. 19/t", kanun: "İİK m. 89/1", ihtarlar: [] },
  { no: "21", ad: "İkinci haciz ihbarnamesi (89/2)", tur: "takip_sonrasi", madde: "Yön. m. 19/u", kanun: "İİK m. 89/2", ihtarlar: [] },
  { no: "21a", ad: "Üçüncü haciz ihbarnamesi (89/3, bildirim)", tur: "takip_sonrasi", madde: "Yön. m. 19/ü", kanun: "İİK m. 89/3", ihtarlar: [] },
  { no: "28", ad: "Borç ödemeden aciz vesikası", tur: "takip_sonrasi", madde: "Yön. m. 19", kanun: "İİK m. 105, 143", ihtarlar: [] }
];

export const ORNEK_TUR_AD: Record<OrnekTur, string> = { takip_talebi: "Takip talebi", icra_emri: "İcra emri", odeme_emri: "Ödeme emri", tahliye_emri: "Tahliye emri", takip_sonrasi: "Takip sonrası" };
export const ornek = (no: string) => ICRA_ORNEKLERI.find(x => x.no === no);

export { emirOrnegi };

const tarihYaz = (x?: string) => (x ? x.slice(0, 10).split("-").reverse().join(".") : "…");

/**
 * Örnek metni: Örnek 1 takip talebinin tamamı; emir örneklerinde dosyanın bilgileriyle doldurulmuş emir taslağı
 * (başlık, taraflar, dayanak, alacak tablosu, süreler ve ihtarlar).
 */
export function ornekMetni(no: string, f: Foy, b: IcraBilgi, opt: { vekil?: string; bugun?: string } = {}): string {
  const o = ornek(no);
  if (!o) return "";
  const bugun = opt.bugun || new Date().toISOString().slice(0, 10);
  if (o.tur === "takip_talebi") return takipTalebiMetni(f, b, bugun, opt.vekil);
  const h = icraHesapla(b, bugun);
  const pb = b.paraBirimi || "TL";
  const m = f.muvekkilBilgi || {}, k = f.karsiBilgi || {};
  const kisi = (ad?: string, kimlik?: string, adres?: string) => [ad || "…", kimlik ? `(T.C./V.K.N. ${kimlik})` : "", adres ? `– ${adres}` : ""].filter(Boolean).join(" ");
  const alacaklilar = [kisi(f.muvekkil, m.kimlikNo, m.adres), ...(f.ekMuvekkiller || []).filter(x => x.ad.trim()).map(x => kisi(x.ad, x.kimlikNo, x.adres))];
  const borclular = [kisi(f.karsiTaraf, k.kimlikNo, k.adres), ...(b.ekBorclular || []).filter(x => x.ad.trim()).map(x => kisi(x.ad, x.kimlikNo, x.adres))];
  const s: string[] = [];
  s.push("T.C.", (f.mahkeme || "… İCRA DAİRESİ").toLocaleUpperCase("tr"), `DOSYA NO: ${f.esasNo || "…"}`, "", `ÖRNEK NO: ${o.no}`, o.ad.toLocaleUpperCase("tr"), "");
  s.push(alacaklilar.length > 1 ? "ALACAKLILAR :" : `ALACAKLI : ${alacaklilar[0]}`);
  if (alacaklilar.length > 1) alacaklilar.forEach((x, i) => s.push(`  ${i + 1}) ${x}`));
  s.push(`VEKİLİ : ${opt.vekil ? "Av. " + opt.vekil.replace(/^av\.?\s*/i, "") : "…"}`);
  s.push(borclular.length > 1 ? "BORÇLULAR :" : `BORÇLU : ${borclular[0]}`);
  if (borclular.length > 1) borclular.forEach((x, i) => s.push(`  ${i + 1}) ${x}`));
  const dayanak = b.yol === "ilamli" ? `${b.ilam?.mahkeme || "…"}'nin ${b.ilam?.esasNo || "…"} esas ve ${b.ilam?.kararNo || "…"} karar sayılı ${tarihYaz(b.ilam?.kararTarihi)} tarihli ilamı`
    : b.yol === "kambiyo" ? `${b.senet?.tur === "cek" ? "Çek" : b.senet?.tur === "police" ? "Poliçe" : "Bono"} (vade ${tarihYaz(b.senet?.vade)})`
    : b.yol === "kira" ? `${tarihYaz(b.kira?.sozlesmeTarihi)} tarihli kira sözleşmesi` : (b.belge || "…");
  s.push(`TAKİBİN DAYANAĞI : ${dayanak}`, "", "ALACAK :");
  h.kalemler.forEach((x, i) => s.push(`  ${i + 1}) ${x.k.ad}: ${tl(x.k.tutar || 0, pb)}${x.faiz ? ` + işlemiş faiz ${tl(x.faiz, pb)}` : ""}${x.k.faizBaslangic ? ` (faiz başlangıcı ${tarihYaz(x.k.faizBaslangic)})` : ""}`));
  for (const e of h.ek) s.push(`  • ${e.ad}: ${tl(e.tutar, pb)}`);
  if (h.masraf) s.push(`  • Takip öncesi masraflar: ${tl(h.masraf, pb)}`);
  s.push(`TOPLAM : ${tl(h.toplam, pb)}`);
  if (b.icraVekaletYazma !== true && h.vekalet.ucret) s.push(`İcra vekâlet ücreti (AAÜT): ${tl(h.vekalet.ucret)} (ödeme süresinde ödenirse ${tl(h.vekalet.ucDortte)})`);
  s.push("Takip tarihinden itibaren her kalem için kendi faiz türüyle işleyecek faiz, takip giderleri ve vekâlet ücreti.", "");
  const sure = [o.odeme ? `ödeme ${o.odeme} gün` : "", o.itiraz ? `itiraz ${o.itiraz} gün` : "", o.malBeyani ? `mal beyanı ${o.malBeyani} gün` : "", o.tahliye ? `teslim / tahliye ${o.tahliye} gün` : ""].filter(Boolean).join(" · ");
  if (sure) s.push(`SÜRELER : ${sure} (tebliğden itibaren)`);
  s.push("BORÇLUYA İHTARLAR :");
  o.ihtarlar.forEach((x, i) => s.push(`${i + 1}- ${x}`));
  s.push("", `Dayanak: İcra ve İflas Kanunu Yönetmeliği ${o.madde}; ${o.kanun}.`,
    "Not: Bu metin Celse'nin hazırladığı taslaktır; borçluya gönderilecek emri icra dairesi UYAP'ta düzenler. Kontrol ve müvekkile bilgi içindir.");
  return s.join("\n");
}
