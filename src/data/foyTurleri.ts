// Föy türleri: her dosya bir türdür (hukuk davası, ceza soruşturması, arabuluculuk, idari başvuru…). Türler birbirine
// dönüşebilir ve zincir kurar: hukuki danışma → arabuluculuk → hukuk davası → icra; suç duyurusu (soruşturma) → ceza davası;
// idari başvuru → idari dava. Her türden dosya "şahsi dosya" olarak açılabilir (avukatın kendi boşanma, kira, ücret alacağı, ceza,
// baro dosyaları…): şahsi dosyalar ayrı şifreyle kilitli ve şifreli saklanır. Tür kilidi belirlemez; avukat seçer.

export type FoyTur =
  | "danisma" | "arabuluculuk" | "sorusturma" | "ceza" | "hukuk" | "idari_basvuru" | "idari_dava" | "idari_sorusturma"
  | "icra" | "kurum_basvuru" | "sozlesme" | "ozel_ceza" | "baro" | "arabulucu_gorev" | "bilirkisi_gorev" | "tazminat_komisyonu" | "bireysel_basvuru"
  /** müvekkil kartı (vekâletnameden): dava dosyası değildir; Föyler'de değil "Müvekkillerim"de görünür */
  | "muvekkil";

export interface TurBilgi {
  tur: FoyTur; ad: string; kisa: string; aciklama: string;
  /** künyedeki "Mahkeme" ve "Esas no" alanlarının bu türdeki adı */
  merci: string; no: string; merciOrnek: string;
  /** tarafların adı: [bizim taraf, karşı taraf] */
  taraflar: [string, string];
  asamalar: string[];
  /** bu dosya hangi türlere dönüşebilir (devamı açılabilir) */
  sonraki: FoyTur[];
  /** eski kayıtlar için: menüde ve tür seçiminde gösterilmez */
  eski?: boolean;
}

export const TURLER: TurBilgi[] = [
  { tur: "danisma", ad: "Hukuki danışma", kisa: "DANIŞMA", aciklama: "Dava ya da başvurudan önceki görüşme ve değerlendirme.", merci: "Konu", no: "Kayıt no", merciOrnek: "Kira tespiti görüşmesi",
    taraflar: ["Danışan", "Karşı taraf"], asamalar: ["Görüşme", "İnceleme", "Görüş verildi"], sonraki: ["arabuluculuk", "sorusturma", "hukuk", "idari_basvuru", "icra", "kurum_basvuru", "sozlesme"] },
  { tur: "arabuluculuk", ad: "Arabuluculuk", kisa: "ARABULUCULUK", aciklama: "Dava şartı ya da ihtiyari arabuluculuk başvurusu.", merci: "Arabuluculuk bürosu / arabulucu", no: "Büro no", merciOrnek: "İzmir Arabuluculuk Bürosu",
    taraflar: ["Başvurucu", "Karşı taraf"], asamalar: ["Başvuru", "Toplantı", "Anlaşma", "Anlaşamama"], sonraki: ["hukuk", "icra"] },
  { tur: "sorusturma", ad: "Ceza soruşturması (suç duyurusu)", kisa: "SORUŞTURMA", aciklama: "Suç duyurusu ya da şikâyetle başlayan soruşturma.", merci: "Cumhuriyet başsavcılığı", no: "Soruşturma no", merciOrnek: "İzmir Cumhuriyet Başsavcılığı",
    taraflar: ["Müşteki / şüpheli", "Karşı taraf"], asamalar: ["Suç duyurusu", "Soruşturma", "İddianame", "Kovuşturmaya yer yok", "İtiraz"], sonraki: ["ceza"] },
  { tur: "ceza", ad: "Ceza davası", kisa: "CEZA DAVASI", aciklama: "İddianamenin kabulüyle başlayan kovuşturma.", merci: "Mahkeme", no: "Esas no", merciOrnek: "İzmir 5. Asliye Ceza Mahkemesi",
    taraflar: ["Katılan / sanık", "Karşı taraf"], asamalar: ["Tensip", "Duruşma", "Karar", "İstinaf", "Temyiz", "Kesinleşti"], sonraki: ["tazminat_komisyonu", "bireysel_basvuru"] },
  { tur: "hukuk", ad: "Hukuk davası", kisa: "HUKUK DAVASI", aciklama: "Asliye hukuk, iş, tüketici, aile, ticaret, sulh hukuk davaları.", merci: "Mahkeme", no: "Esas no", merciOrnek: "İzmir 3. Asliye Hukuk Mahkemesi",
    taraflar: ["Davacı / davalı", "Karşı taraf"], asamalar: ["Dilekçeler", "Ön inceleme", "Tahkikat", "Bilirkişi", "Karar", "İstinaf", "Temyiz", "Kesinleşti"], sonraki: ["icra", "tazminat_komisyonu", "bireysel_basvuru"] },
  { tur: "idari_basvuru", ad: "İdari başvuru", kisa: "İDARİ BAŞVURU", aciklama: "İdareye başvuru, itiraz ya da bilgi edinme.", merci: "İdare", no: "Başvuru / evrak no", merciOrnek: "Karşıyaka Belediyesi",
    taraflar: ["Başvurucu", "İdare"], asamalar: ["Başvuru", "Cevap bekleniyor", "Ret / zımni ret", "Kabul"], sonraki: ["idari_dava"] },
  { tur: "idari_dava", ad: "İdari dava", kisa: "İDARİ DAVA", aciklama: "İdare ve vergi mahkemelerindeki iptal ve tam yargı davaları.", merci: "Mahkeme", no: "Esas no", merciOrnek: "İzmir 2. İdare Mahkemesi",
    taraflar: ["Davacı", "Davalı idare"], asamalar: ["Dava açıldı", "Savunma", "Bilirkişi / keşif", "Karar", "İstinaf", "Temyiz", "Kesinleşti"], sonraki: ["tazminat_komisyonu", "bireysel_basvuru"] },
  { tur: "tazminat_komisyonu", ad: "Tazminat Komisyonu başvurusu", kisa: "TAZMİNAT KOMİSYONU", aciklama: "Adalet Bakanlığı İnsan Hakları Tazminat Komisyonu (6384 s. Kanun): makul sürede yargılanma, kararın geç ya da eksik icrası.", merci: "Komisyon", no: "Başvuru no", merciOrnek: "Adalet Bakanlığı Tazminat Komisyonu Başkanlığı",
    taraflar: ["Başvurucu", "Bakanlık"], asamalar: ["Başvuru", "İnceleme", "Karar", "İtiraz (Bölge İdare Mahkemesi)", "Kesinleşti", "Ödeme"], sonraki: ["idari_dava", "bireysel_basvuru"] },
  { tur: "bireysel_basvuru", ad: "Bireysel başvuru (AYM / AİHM)", kisa: "BİREYSEL BAŞVURU", aciklama: "Anayasa Mahkemesi bireysel başvurusu ya da Avrupa İnsan Hakları Mahkemesi başvurusu.", merci: "Mahkeme", no: "Başvuru no", merciOrnek: "Anayasa Mahkemesi / AİHM",
    taraflar: ["Başvurucu", "Devlet"], asamalar: ["Başvuru", "Kabul edilebilirlik", "Hükümete bildirim", "Görüş / cevap", "Karar", "Kesinleşti", "Ödeme / yeniden yargılama"], sonraki: ["bireysel_basvuru"] },
  { tur: "idari_sorusturma", ad: "Disiplin soruşturması", kisa: "DİSİPLİN SORUŞTURMASI", aciklama: "Memur, hekim, öğretmen, işçi (4857), avukat (baro), noter, mali müşavir… hakkında disiplin ya da ön inceleme.", merci: "Kurum / meslek kuruluşu / işveren", no: "Soruşturma no", merciOrnek: "İl Sağlık Müdürlüğü",
    taraflar: ["Hakkında soruşturma yapılan", "Kurum / işveren"], asamalar: ["Soruşturma", "Savunma", "Disiplin kararı", "İtiraz"], sonraki: ["idari_dava", "hukuk"] },
  { tur: "icra", ad: "İcra takibi", kisa: "İCRA", aciklama: "İlamlı, ilamsız ya da rehinli takip.", merci: "İcra dairesi", no: "Takip no", merciOrnek: "İzmir 12. İcra Dairesi",
    taraflar: ["Alacaklı / borçlu", "Karşı taraf"], asamalar: ["Takip başlatıldı", "Ödeme emri", "İtiraz", "Haciz", "Satış", "Tahsil"], sonraki: ["hukuk", "ceza"] },
  { tur: "kurum_basvuru", ad: "Kurum / banka başvurusu", kisa: "KURUM BAŞVURUSU", aciklama: "Banka, sigorta, SGK, tüketici hakem heyeti gibi kurumlara başvuru.", merci: "Kurum", no: "Başvuru no", merciOrnek: "… Bankası A.Ş.",
    taraflar: ["Başvurucu", "Kurum"], asamalar: ["Başvuru", "Cevap bekleniyor", "Sonuçlandı"], sonraki: ["arabuluculuk", "hukuk", "idari_dava"] },
  { tur: "sozlesme", ad: "Sözleşme", kisa: "SÖZLEŞME", aciklama: "Hazırlanan ya da incelenen sözleşme.", merci: "Sözleşme konusu", no: "Sözleşme no", merciOrnek: "Kira sözleşmesi",
    taraflar: ["Müvekkil", "Karşı taraf"], asamalar: ["Taslak", "Müzakere", "İmzalandı", "İhtilaf"], sonraki: ["arabuluculuk", "hukuk", "icra"] },
  { tur: "baro", ad: "Baro soruşturması", kisa: "BARO", aciklama: "Avukat hakkında baro disiplin soruşturması.", merci: "Baro", no: "Dosya no", merciOrnek: "İzmir Barosu",
    taraflar: ["Hakkında soruşturma yapılan", "Şikâyetçi"], asamalar: ["Şikâyet", "Disiplin soruşturması", "Disiplin kurulu", "Karar", "İtiraz"], sonraki: ["idari_dava"], eski: true },
  { tur: "ozel_ceza", ad: "Kişisel ceza soruşturması", kisa: "CEZA", aciklama: "Eski kayıt: kişisel ceza soruşturması.", merci: "Savcılık / mahkeme", no: "Dosya no", merciOrnek: "",
    taraflar: ["Ben", "Karşı taraf"], asamalar: ["Soruşturma", "Kovuşturma", "Karar"], sonraki: ["ceza"], eski: true },
  { tur: "arabulucu_gorev", ad: "Arabulucu olarak görev", kisa: "ARABULUCU GÖREVİ", aciklama: "Avukatın arabulucu olarak yürüttüğü dosya.", merci: "Arabuluculuk bürosu", no: "Büro / arabuluculuk no", merciOrnek: "İzmir Arabuluculuk Bürosu",
    taraflar: ["Başvurucu", "Diğer taraf"], asamalar: ["Görevlendirme", "Taraflara ulaşma", "Toplantı", "Anlaşma", "Anlaşamama", "Ücret tahsil edildi"], sonraki: [] },
  { tur: "bilirkisi_gorev", ad: "Bilirkişi olarak görev", kisa: "BİLİRKİŞİ GÖREVİ", aciklama: "Avukatın bilirkişi olarak rapor yazdığı dosya.", merci: "Mahkeme / savcılık", no: "Esas / soruşturma no", merciOrnek: "İzmir 3. Asliye Hukuk Mahkemesi",
    taraflar: ["Davacı", "Davalı"], asamalar: ["Görevlendirme", "İnceleme / keşif", "Rapor yazımı", "Rapor teslim edildi", "Ek rapor", "Ücret tahsil edildi"], sonraki: [] },
  // Müvekkil kartı: tür seçiminde ve dosya listelerinde görünmez (eski: true), "Müvekkillerim" sekmesinde tutulur.
  { tur: "muvekkil", ad: "Müvekkil kartı", kisa: "MÜVEKKİL", aciklama: "Vekâletnameden oluşturulan müvekkil kaydı.", merci: "Noterlik", no: "Yevmiye no", merciOrnek: "İzmir 5. Noterliği",
    taraflar: ["Müvekkil", ""], asamalar: ["Vekâlet var", "Vekâlet sona erdi"], sonraki: [], eski: true }
];

export const turBilgi = (t?: FoyTur): TurBilgi => TURLER.find(x => x.tur === (t || "hukuk")) || TURLER[4];
/** Menüde ve tür seçiminde gösterilen türler. */
export const SECILIR_TURLER = TURLER.filter(x => !x.eski);
/** Eski sürümde kilitli açılan türler (eski kayıtlar şahsi kalsın diye). */
export const ozelTur = (t?: FoyTur) => t === "ozel_ceza";

/** Yeni davada "hangi dava": avukat listeden seçer ya da kendisi yazar (föyde "Konu" alanına yazılır). */
export const DAVA_TURLERI: Partial<Record<FoyTur, string[]>> = {
  hukuk: ["Boşanma", "Nafaka / velayet", "Mal rejimi tasfiyesi", "Kira (tahliye / tespit)", "Alacak", "İtirazın iptali", "Menfi tespit / istirdat",
    "Maddi ve manevi tazminat", "Trafik kazası tazminatı", "İşçilik alacakları", "İşe iade", "Tüketici", "Ticari (şirket, çek, senet)",
    "Avukatlık ücreti alacağı", "Miras / tenkis", "Ortaklığın giderilmesi", "Tapu iptal ve tescil", "Kamulaştırma", "Sigorta", "Hizmet tespiti (SGK)"],
  ceza: ["İcra ceza (İİK 331 vd.)", "Dolandırıcılık", "Güveni kötüye kullanma", "Hırsızlık", "Hakaret", "Tehdit", "Kasten yaralama", "Taksirle yaralama / öldürme",
    "Uyuşturucu", "Konut dokunulmazlığı", "Kişisel verilerin ihlali", "Resmî belgede sahtecilik", "Karşılıksız çek", "Trafik güvenliği", "Bilişim suçları"],
  idari_sorusturma: ["Avukat (baro disiplin)", "Devlet memuru (657 s. DMK)", "Hekim / sağlık çalışanı", "Öğretmen", "Akademisyen / öğrenci (YÖK)", "İşçi (4857 s. İş Kanunu, işyeri disiplini)",
    "Kamu işçisi", "Polis / bekçi", "Asker (TSK disiplin)", "Hâkim / savcı (HSK)", "Noter", "Mali müşavir / SMMM", "Mühendis / mimar odası",
    "Eczacı", "Sporcu / kulüp (federasyon disiplin)", "Ön inceleme (4483 s. Kanun)"],
  baro: ["Disiplin soruşturması", "Meslek kurallarına aykırılık", "Ücret uyuşmazlığı şikâyeti", "Levhadan silinme"],
  sorusturma: ["Dolandırıcılık", "Güveni kötüye kullanma", "Hırsızlık", "Hakaret", "Tehdit", "Kasten yaralama", "Taksirle yaralama / öldürme",
    "Uyuşturucu", "Kişisel verilerin ihlali", "Resmî belgede sahtecilik", "Bilişim suçları", "Görevi kötüye kullanma"],
  idari_dava: ["İptal davası", "Tam yargı davası", "Vergi davası", "Disiplin cezasının iptali", "İmar / yıkım kararı", "Atama / görevden alma",
    "İhale", "Kamulaştırmasız el atma", "İdari para cezası"]
};

/** "Yeni giriş" menüsü: avukatın işe başladığı belge ya da işlem. */
export interface Giris { ad: string; aciklama: string; tur?: FoyTur; secenek?: FoyTur[]; evrakaEkle?: string }
export const GIRISLER: Giris[] = [
  { ad: "Yeni dava / soruşturma", aciklama: "Hukuk, ceza ya da idari dava; ceza soruşturması", secenek: ["hukuk", "ceza", "idari_dava", "sorusturma"] },
  { ad: "Tazminat Komisyonu / AYM / AİHM", aciklama: "İnsan Hakları Tazminat Komisyonu, Anayasa Mahkemesi bireysel başvuru, Avrupa İnsan Hakları Mahkemesi", secenek: ["tazminat_komisyonu", "bireysel_basvuru"] },
  { ad: "Suç duyurusu", aciklama: "Savcılığa şikâyet ya da ihbar", tur: "sorusturma" },
  { ad: "Arabuluculuk başvurusu", aciklama: "Dava şartı ya da ihtiyari", tur: "arabuluculuk" },
  { ad: "Bilirkişi raporu", aciklama: "Var olan föye rapor ekle", evrakaEkle: "Bilirkişi raporu" },
  { ad: "İdari başvuru / disiplin", aciklama: "İdareye başvuru, itiraz; disiplin soruşturması (memur, hekim, işçi, avukat…)", secenek: ["idari_basvuru", "idari_sorusturma"] },
  { ad: "Kurum / banka başvurusu", aciklama: "Banka, sigorta, SGK, hakem heyeti", tur: "kurum_basvuru" },
  { ad: "İcra takibi", aciklama: "İlamlı, ilamsız, rehinli", tur: "icra" },
  { ad: "Sözleşme", aciklama: "Hazırlama ya da inceleme", tur: "sozlesme" },
  { ad: "Hukuki danışma", aciklama: "Davadan ya da başvurudan önce", tur: "danisma" },
  { ad: "Arabulucu ya da bilirkişi olarak görev", aciklama: "Sizin arabulucu ya da bilirkişi olduğunuz dosyalar", secenek: ["arabulucu_gorev", "bilirkisi_gorev"] }
];

const sade = (s: string) => s.toLocaleLowerCase("tr").replace(/â/g, "a").replace(/î/g, "i").replace(/û/g, "u").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c");

/** Mahkeme, dava türü ya da elle yazılmış "dosya türü"nden föy türünü tahmin eder (toplu aktarma ve DavaTek için). */
export function turTahmin(...metinler: string[]): FoyTur | undefined {
  const m = sade(metinler.filter(Boolean).join(" "));
  if (!m.trim()) return undefined;
  if (/baro/.test(m) && /sorustur|disiplin|sikayet/.test(m)) return "idari_sorusturma";
  if (/arabulucu/.test(m)) return "arabuluculuk";
  if (/tazminat komisyonu|insan haklari tazminat/.test(m)) return "tazminat_komisyonu";
  if (/anayasa mahkemesi|bireysel basvuru|aihm|avrupa insan haklari|european court|strasbourg|strazburg/.test(m)) return "bireysel_basvuru";
  if (/cbs sorusturma|sorusturma dosyasi/.test(m)) return "sorusturma";
  // Başta (künye / merci) açıkça yazan mahkeme ve daire, metindeki "disiplin", "şikâyet" gibi sözcüklerden önce gelir:
  // ör. işçinin disiplin cezasına karşı açılan davada bölge adliye hukuk dairesi dosyası hukuk davasıdır.
  const bas = m.slice(0, 400);
  if (/bolge adliye mahkemesi.{0,40}ceza dairesi|yargitay.{0,30}ceza dairesi|agir ceza mahkemesi|asliye ceza mahkemesi|sulh ceza hakimligi|cocuk (agir )?ceza mahkemesi/.test(bas)) return "ceza";
  if (/bolge adliye mahkemesi.{0,40}hukuk dairesi|yargitay.{0,30}hukuk dairesi|asliye hukuk mahkemesi|sulh hukuk mahkemesi|is mahkemesi|aile mahkemesi|tuketici mahkemesi|asliye ticaret mahkemesi|kadastro mahkemesi|fikri ve sinai haklar/.test(bas)) return "hukuk";
  if (/bolge idare mahkemesi|idare mahkemesi|vergi mahkemesi|danistay/.test(bas)) return "idari_dava";
  // Satış memurluğu iki kaynaktan gelir: sulh hukuk mahkemesinin ortaklığın giderilmesi (izale-i şuyu) kararıyla satış ya da icra
  // satışı. Kaynak yazıyorsa ona göre; yazmıyorsa sulh hukuk sayılır (satış memurlukları sulh hukuk mahkemelerine bağlıdır).
  if (/satis memurlugu/.test(m)) return /icra dairesi|icra mud|icra dosyasi|haciz|takip/.test(m) && !/sulh hukuk|ortakligin giderilmesi|izale/.test(m) ? "icra" : "hukuk";
  if (/sulh ceza hakimligi|infaz hakimligi/.test(m)) return "ceza";
  if (/idare dava|idari dava dosyasi|vergi dava/.test(m)) return "idari_dava";
  if (/ceza dava/.test(m)) return "ceza";
  if (/icra dairesi|icra mud|icra dosyasi|takip/.test(m) && !/mahkeme|hukuk dava/.test(m)) return "icra";
  if (/bassavcilig|savcilig|sorusturma no|suc duyuru|sikayet/.test(m)) return "sorusturma";
  if (/agir ceza|asliye ceza|sulh ceza|cocuk mahkemesi|ceza mahkemesi|ceza davasi/.test(m)) return "ceza";
  if (/idare mahkemesi|vergi mahkemesi|danistay|bolge idare|idari dava|iptal davasi|tam yargi/.test(m)) return "idari_dava";
  if (/disiplin|idari sorusturma|on inceleme/.test(m)) return "idari_sorusturma";
  if (/belediye|valilig|kaymakamlig|bakanlig|mudurlugu|idari basvuru|bilgi edinme/.test(m)) return "idari_basvuru";
  if (/banka|sigorta|sgk|hakem heyeti|kurum basvuru/.test(m)) return "kurum_basvuru";
  if (/sozlesme/.test(m) && !/mahkeme/.test(m)) return "sozlesme";
  if (/danisma|gorusme/.test(m) && !/mahkeme/.test(m)) return "danisma";
  if (/mahkeme|hukuk|is mahkemesi|tuketici|aile|ticaret|kadastro/.test(m)) return "hukuk";
  return undefined;
}

// ---------- evrak sınıflandırma (cihazda, yapay zekâsız) ----------
// Belgenin başlığına ve dosya adına bakarak türünü ve önemini belirler. Avukat ekranda değiştirebilir.
// Önemli evrak "Dosya ne durumda?" sorusunun kaynağıdır; tebligat, makbuz, vekâletname gibi evrak önemsiz sayılır.
type Kural = [string, RegExp | ((m: string) => boolean), boolean];
const KURALLAR: Kural[] = [
  ["Gerekçeli karar", /gerekceli karar/, true],
  // Ücret sözleşmesi ve yetki belgesi büronun kendi kaydıdır: yapay zekâ değerlendirmesine gönderilmez (önemsiz sayılır).
  ["Vekâlet ücreti sözleşmesi", /(avukatlik|vekalet) ucreti? sozlesme|ucret sozlesmesi/, false],
  ["Yetki belgesi", /^.{0,400}yetki belgesi/s, false],
  // Mahkemeye / makama hitapla başlayan ve KONU satırı olan metin bir dilekçedir (içinde "bilirkişi raporu" geçse de).
  ["Dilekçe", m => /\bkonu\s*:/.test(m) && /(mahkemesi ?'?ne|baskanligina|hakimligine|savciligina|mudurlugune|dairesine)\b/.test(m.slice(0, 300))
    && !/istinaf|temyiz|dava dilekce|cevap dilekce|cevaba cevap|replik|duplik|savunma/.test(m), true],
  ["Bilirkişi raporu", /bilirkisi( ek)? rapor|bilirkisi heyeti|kok rapor/, true],
  ["İddianame", /iddianame/, true],
  ["Kovuşturmaya yer olmadığı kararı", /kovusturmaya yer olmadig|\bkyok\b/, true],
  ["Ara karar", /ara karar|tensip/, true],
  ["Duruşma tutanağı", /durusma tutanag|celse tutanag|kesif tutanag/, true],
  ["İfade / sorgu tutanağı", /ifade tutanag|sorgu tutanag|beyan tutanag/, true],
  ["Arabuluculuk tutanağı", /arabuluculuk son tutanag|anlasma belgesi|anlasamama|arabuluculuk tutanag/, true],
  // Karar başlığı: "KARAR NO" ve hâkim ya da başkan adı (dilekçelerin başında hâkim adı geçmez).
  ["Karar", m => /karar no/.test(m) && /\bhakim\b|\bbaskan\b/.test(m), true],
  ["İstinaf / temyiz dilekçesi", /istinaf (basvuru )?dilekce|temyiz dilekce|istinaf layiha|temyiz layiha/, true],
  ["Dava dilekçesi", /dava dilekce|ihtiyati tedbir talepli/, true],
  ["Cevap dilekçesi", /cevap dilekce|cevaba cevap|ikinci cevap|replik|duplik/, true],
  ["Ödeme emri", /odeme emri|icra emri/, true],
  ["Savunma", /savunma (dilekce|yazisi)/, true],
  ["Karar", /kisa karar|\bhukum\b/, true],
  ["Dilekçe", /dilekce|layiha/, true],
  ["Tebligat", /tebligat|teblig mazbata|mazbata|\bteblig\b/, false],
  ["Müzekkere / yazı cevabı", /muzekkere|yazi cevab|cevabi yazi|ust yazi/, false],
  ["Harç / masraf", /\bharc|makbuz|tahsilat|gider avans|vezne|masraf/, false],
  ["Vekâletname", /vekaletname/, false]
];

export function evrakSinifla(ad: string, metin: string): { tur: string; onemli: boolean } {
  const bas = sade((metin || "").slice(0, 900));
  const dosya = sade(ad.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
  for (const kaynak of [bas, dosya]) {
    for (const [tur, k, onemli] of KURALLAR) if (typeof k === "function" ? k(kaynak) : k.test(kaynak)) return { tur, onemli };
  }
  // Tanınmayan evrak önemli sayılır: yanlışlıkla dışarıda kalmasın.
  return { tur: "Diğer", onemli: true };
}
export const EVRAK_TURLERI = [...new Set(KURALLAR.map(k => k[0])), "Diğer"];
