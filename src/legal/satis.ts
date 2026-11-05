// Web satışı (iyzico) için yasal metinler: Mesafeli Satış Sözleşmesi, Ön Bilgilendirme Formu, İade ve Cayma Hakkı
// Politikası, Teslimat ve Hizmet Sunumu, İletişim ve Fiyatlar. tools/satis.ts bunları public/*.html olarak yazar.
// Dayanak: 6502 sayılı TKHK (m.48 mesafeli sözleşmeler, m.52 abonelik), Mesafeli Sözleşmeler Yönetmeliği (RG 27.11.2014/29188;
// RG 23.08.2022/31932 ve RG 24.05.2025/32909 değişiklikleriyle), Abonelik Sözleşmeleri Yönetmeliği (RG 24.01.2015/29246),
// 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun (m.3-4).
//
// "[DOLDURULACAK: …]" ile başlayan her ifade yayımdan önce yetkili tarafından doldurulur; sayfalarda sarı işaretle görünür
// ve tools/satis.ts çalışınca listelenir. Metinler TASLAKTIR; yayımdan önce hukuki gözden geçirme gerekir.
import { VERI_SORUMLUSU as V } from "./kvkk";
import { PRODUCTS } from "../data/purchaseIds";

export const SON_GUNCELLEME = "5 Kasım 2026";

/** Satıcı / hizmet sağlayıcı tanıtıcı bilgileri (6563 s. ETK m.3; Mesafeli Sözleşmeler Yönetmeliği m.5/1-b, c). */
export const SATICI = {
  unvan: "SİPAHİ YAZILIM PROJE GELİŞTİRME DANIŞMANLIK İNŞAAT TAAHHÜT SANAYİ VE TİCARET LİMİTED ŞİRKETİ",
  marka: "Celse",
  adres: "Kahramanlar Mah. 1395 Sk. No: 10/A, Konak / İzmir",
  eposta: V.eposta,
  telefon: "0 (505) 887 00 58",
  mersis: "0771034813700012",
  vergi: "Kordon Vergi Dairesi · 7710348137",
  sicil: "İzmir Ticaret Sicil Müdürlüğü · 193107",
  web: "https://celse.themiscode.com/"
};

/** Ödeme kuruluşu (6493 sayılı Kanun kapsamında lisanslı). */
export const ODEME_KURULUSU = "İyzi Ödeme ve Elektronik Para Hizmetleri A.Ş. (iyzico)";

/** Danışma ürünlerinde her yerde aynen kullanılan uyarı (1136 sayılı Avukatlık Kanunu m.35). */
export const DANISMA_UYARI =
  "\"Derdini Anlat\" eğitim amaçlı canlandırmadır, hukuki görüş değildir (1136 sayılı Avukatlık Kanunu m.35). Avukatlık hizmeti, hukuki danışmanlık ya da vekâlet ilişkisi kurmaz; somut uyuşmazlığınız için bir avukata başvurmanız gerekir.";

export type UrunTuru = "abonelik" | "kredi";
export interface Urun {
  id: string;
  ad: string;
  tur: UrunTuru;
  /** KDV dahil fiyat (TL) */
  fiyat: number;
  /** "149,99 TL" biçimi */
  fiyatMetni: string;
  /** abonelikte ödeme dönemi */
  donem?: "ay" | "yıl";
  kredi?: number;
  kisa: string;
  icerik: string[];
}

const tl = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TL";

export const URUNLER: Urun[] = [
  {
    id: PRODUCTS.aylik, ad: "Celse Pro Aylık", tur: "abonelik", fiyat: 149.99, fiyatMetni: tl(149.99), donem: "ay",
    kisa: "Aylık ödenen, siz iptal edene kadar her ay yenilenen Pro üyeliği.",
    icerik: [
      "Ücretsiz ilk kariyer bölümünden (\"Adliyede ilk yıl\") sonraki bütün kariyer bölümleri",
      "Büro masasındaki bütün dosyalar ve antrenmanda bütün davalar",
      "Aynı hesapla web, iPhone ve Android'de geçerli",
      "İstediğiniz an iptal; ödenen dönemin sonuna kadar Pro açık kalır"
    ]
  },
  {
    id: PRODUCTS.yillik, ad: "Celse Pro Yıllık", tur: "abonelik", fiyat: 999.99, fiyatMetni: tl(999.99), donem: "yıl",
    kisa: "Yıllık ödenen, siz iptal edene kadar her yıl yenilenen Pro üyeliği (aylık karşılığı yaklaşık " + tl(999.99 / 12) + ").",
    icerik: [
      "Celse Pro Aylık'taki bütün içerik",
      "Tek ödemeyle 12 ay",
      "Yenilemeden önce e-postayla hatırlatma",
      "İstediğiniz an iptal; ödenen dönemin sonuna kadar Pro açık kalır"
    ]
  },
  {
    id: PRODUCTS.derdini1, ad: "Derdini Anlat · 1 danışma kredisi", tur: "kredi", fiyat: 149.99, fiyatMetni: tl(149.99), kredi: 1,
    kisa: "Bir olay için eğitim amaçlı yapay zekâ değerlendirmesi ve duruşma canlandırması.",
    icerik: [
      "Yazdığınız olay için yapılandırılmış eğitim amaçlı değerlendirme",
      "Kısa duruşma canlandırması ve \"Duruşmayı izle\" görsel canlandırması",
      "Aynı kredi içinde en çok 5 takip sorusu",
      "Değerlendirme teknik nedenle üretilemezse kredi kendiliğinden iade edilir"
    ]
  },
  {
    id: PRODUCTS.derdini3, ad: "Derdini Anlat · 3 danışma kredisi", tur: "kredi", fiyat: 349.99, fiyatMetni: tl(349.99), kredi: 3,
    kisa: "Üç ayrı olay için danışma kredisi (kredi başına yaklaşık " + tl(349.99 / 3) + ").",
    icerik: [
      "1 kredilik paketteki her şey, üç ayrı danışma için",
      "Krediler hesabınızda kullanılana kadar saklanır",
      "Celse Pro'dan bağımsızdır; Pro üyeliği gerektirmez"
    ]
  }
];

// ---------- Metin yapısı ----------
/** Paragraf; [etiket, metin] biçiminde verilirse etiket kalın yazılır; {liste} madde listesidir. */
export type Blok = string | [string, string] | { liste: (string | [string, string])[] } | { not: string };
export interface Bolum { baslik: string; bloklar: Blok[] }
export interface Belge { dosya: string; baslik: string; kisaAd: string; giris?: string; bolumler: Bolum[] }

const S = SATICI;
const saticiBlok: Blok = {
  liste: [
    ["Unvan", S.unvan],
    ["Adres", S.adres],
    ["E-posta", S.eposta],
    ["Telefon", S.telefon],
    ["MERSİS no", S.mersis],
    ["Ticaret sicil no", S.sicil],
    ["Vergi dairesi / no", S.vergi],
    ["İnternet sitesi", S.web]
  ]
};

const urunListesi: Blok = {
  liste: URUNLER.map(u => [u.ad, `${u.fiyatMetni}${u.donem ? " / " + u.donem : ""} (KDV dahil). ${u.kisa}`] as [string, string])
};

/** Ödeme adımında, sipariş butonundan önce gösterilecek onay kutuları. Hiçbiri önceden işaretli olamaz. */
export const ODEME_ONAYLARI: { id: string; zorunlu: boolean; urun: "hepsi" | UrunTuru; metin: string }[] = [
  {
    id: "on_bilgilendirme", zorunlu: true, urun: "hepsi",
    metin: "Ön Bilgilendirme Formu'nu ve Mesafeli Satış Sözleşmesi'ni okudum; bilgilendirildiğimi ve sözleşmeyi elektronik ortamda kabul ettiğimi onaylıyorum."
  },
  {
    id: "aninda_ifa", zorunlu: true, urun: "hepsi",
    metin: "Satın aldığım dijital içeriğin ve hizmetin ifasına, ödemem onaylandığı anda, 14 günlük cayma süresi dolmadan başlanmasını açıkça istiyorum. İfaya başlandığında cayma hakkımı kaybedeceğimi biliyorum (Mesafeli Sözleşmeler Yönetmeliği m.15/1-ğ ve h). Danışma kredilerinde bu sonuç, kredi kullanıldığında doğar."
  },
  {
    id: "otomatik_yenileme", zorunlu: true, urun: "abonelik",
    metin: "Celse Pro aboneliğimin ben iptal edene kadar her dönem sonunda aynı süreyle yenileneceğini ve dönem ücretinin, önceden bildirilmiş bir fiyat değişikliği yoksa aynı tutarla, kayıtlı kartımdan alınacağını; aboneliği istediğim an Hesap > Abonelik bölümünden ya da e-postayla iptal edebileceğimi biliyorum."
  },
  {
    id: "danisma_uyari", zorunlu: true, urun: "kredi",
    metin: "\"Derdini Anlat\"ın eğitim amaçlı canlandırma olduğunu, hukuki görüş olmadığını (1136 sayılı Avukatlık Kanunu m.35) ve avukatlık hizmeti yerine geçmediğini biliyorum."
  }
];
/** Sipariş butonunun metni: ödeme yükümlülüğü doğduğunu açıkça belirtmelidir. */
export const SIPARIS_BUTONU = "Siparişi onayla ve öde";

const onayListesi: Blok = { liste: ODEME_ONAYLARI.map(o => o.metin) };

// ---------- Mesafeli Satış Sözleşmesi ----------
export const MESAFELI_SATIS: Belge = {
  dosya: "satis-sozlesmesi.html", kisaAd: "Mesafeli Satış Sözleşmesi", baslik: "Mesafeli Satış Sözleşmesi",
  giris: "Bu sözleşme, Celse internet sitesi üzerinden elektronik ortamda satın alınan dijital içerik ve hizmetlere ilişkindir. Ön Bilgilendirme Formu ve İade ve Cayma Hakkı Politikası bu sözleşmenin ayrılmaz parçasıdır. Siparişinize özgü bilgileri (ürün, fiyat, sipariş tarihi, alıcı bilgileri) içeren bir örnek, ödemeden sonra e-posta adresinize gönderilir.",
  bolumler: [
    { baslik: "1. Taraflar", bloklar: [
      ["Satıcı / hizmet sağlayıcı", "Aşağıda bilgileri yer alan şirket (\"Satıcı\")."], saticiBlok,
      ["Alıcı / tüketici", "Celse hesabıyla giriş yaparak sipariş veren ve sipariş sırasında adı soyadı ile e-posta adresini bildiren gerçek kişi (\"Alıcı\"). Alıcı'nın bilgileri, siparişe özgü sözleşme örneğinde yer alır."]
    ] },
    { baslik: "2. Konu ve uygulanacak hukuk", bloklar: [
      "Bu sözleşmenin konusu, Alıcı'nın Satıcı'ya ait Celse avukatlık oyununda (\"Uygulama\") 4. maddede belirtilen dijital içerik ve hizmetleri elektronik ortamda satın alması ile tarafların hak ve yükümlülükleridir.",
      "Sözleşmeye 6502 sayılı Tüketicinin Korunması Hakkında Kanun, Mesafeli Sözleşmeler Yönetmeliği, Abonelik Sözleşmeleri Yönetmeliği, 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ve ilgili mevzuat uygulanır. Bu sözleşmenin hiçbir hükmü, Alıcı'nın kanundan doğan haklarını kısıtlayacak biçimde yorumlanamaz."
    ] },
    { baslik: "3. Tanımlar", bloklar: [{ liste: [
      ["Hesap", "Alıcı'nın Uygulama'ya giriş yaptığı, satın alımların bağlandığı kişisel üyelik."],
      ["Celse Pro", "Uygulama'nın ücretsiz ilk kariyer bölümünden sonraki bütün oyun içeriğini açan abonelik."],
      ["Dönem", "Celse Pro Aylık için bir ay, Celse Pro Yıllık için bir yıl; ücret her dönemin başında peşin alınır."],
      ["Danışma kredisi", "\"Derdini Anlat\" bölümünde bir olay için eğitim amaçlı değerlendirme ve canlandırma almaya yarayan kullanım hakkı."],
      ["Ödeme kuruluşu", `${ODEME_KURULUSU}; kart ödemelerine aracılık eden lisanslı ödeme kuruluşu.`],
      ["Kalıcı veri saklayıcısı", "E-posta gibi, bilgiyi değiştirmeden saklamaya ve sonradan erişmeye imkân veren araç."]
    ] }] },
    { baslik: "4. Ürünler ve fiyatlar", bloklar: [
      urunListesi,
      "Fiyatlar Türk lirası olup KDV dahil toplam fiyattır; ayrıca kargo, teslimat ya da başka bir ücret alınmaz. Alıcı'nın ödeyeceği tutar, sipariş butonuna basmadan önce ödeme sayfasında gösterilen tutardır. Kartı veren bankanın uyguladığı kur farkı, yurt dışı işlem ücreti gibi masraflar Satıcı'nın bilgisi ve sorumluluğu dışındadır."
    ] },
    { baslik: "5. Sözleşmenin kurulması", bloklar: [
      "Sözleşme şu adımlarla elektronik ortamda kurulur (6563 s. ETK m.3/1-b):",
      { liste: [
        "Alıcı Celse hesabıyla giriş yapar ve ürünü seçer.",
        "Ödeme sayfasında sipariş özeti, Ön Bilgilendirme Formu ve bu sözleşme gösterilir. Alıcı, sipariş butonuna basmadan önce ürünü ve fatura bilgilerini kontrol edip düzeltebilir; dönüp ürün seçimini değiştirebilir.",
        "Alıcı, önceden işaretlenmemiş onay kutularını kendisi işaretler (12. madde).",
        `Alıcı "${SIPARIS_BUTONU}" butonuna basar; bu butona basmak ödeme yükümlülüğü doğurur.`,
        "Kart bilgileri ödeme kuruluşunun güvenli sayfasında girilir; banka gerekli görürse 3D Secure doğrulaması yapılır.",
        "Ödeme onaylanınca sözleşme kurulmuş olur; Satıcı siparişi gecikmeksizin e-postayla teyit eder (6563 s. ETK m.4)."
      ] },
      "Sözleşme metni Satıcı tarafından saklanır. Alıcı, kendisine e-postayla gönderilen örneği saklayabilir; güncel genel metne her zaman bu sayfadan, siparişine özgü örneğe ise e-posta adresi üzerinden bize yazarak ulaşabilir. Sözleşme Türkçe kurulur."
    ] },
    { baslik: "6. Ödeme ve fatura", bloklar: [
      `Ödemeler ${ODEME_KURULUSU} altyapısıyla, Visa ve Mastercard logolu banka ve kredi kartlarıyla tek çekim olarak alınır. Kart bilgileri Satıcı'nın sunucularında saklanmaz; abonelik yenilemeleri için gerekli kart kaydı, Alıcı'nın onayıyla ödeme kuruluşu tarafından saklanır.`,
      "Her ödeme için Alıcı adına elektronik fatura (e-Arşiv) düzenlenir ve e-posta adresine gönderilir."
    ] },
    { baslik: "7. Hizmetin sunulması (teslimat)", bloklar: [
      "Ürünler dijitaldir; fiziksel teslimat veya kargo yoktur. Ödeme onaylandığında Celse Pro ya da danışma kredisi Alıcı'nın hesabına tanımlanır ve aynı hesapla giriş yapılan web sitesinde ve mobil uygulamada kullanılabilir. Tanımlama çoğunlukla birkaç saniye, en geç birkaç dakika sürer. Ayrıntılar Teslimat ve Hizmet Sunumu sayfasındadır."
    ] },
    { baslik: "8. Celse Pro aboneliği, yenileme ve iptal", bloklar: [
      ["Süre", "Celse Pro, belirsiz süreli bir abonelik sözleşmesidir. Ücret, seçilen plana göre aylık ya da yıllık dönemler hâlinde, her dönemin başında peşin alınır. Alıcı aboneliği sona erdirmedikçe, her dönemin sonunda yeni dönemin ücreti kayıtlı karttan alınır."],
      ["İptal (fesih)", "Alıcı aboneliğini gerekçe göstermeksizin ve hiçbir cezai şart ya da ek ücret ödemeksizin istediği zaman sona erdirebilir. İptal, Uygulama'da Hesap > Abonelik bölümünden ya da kayıtlı e-posta adresinden yazarak yapılır; aboneliğin başlatıldığı yöntemden daha zor bir yöntem istenmez. İptal bildirimi, ulaştığı tarihten itibaren en geç yedi gün içinde işleme alınır ve Alıcı'ya e-postayla teyit edilir."],
      ["İptalin sonucu", "İptal edilen abonelik yenilenmez ve bundan sonra ücret alınmaz. Ödemesi yapılmış dönem için Celse Pro dönem sonuna kadar açık kalır. İçinde bulunulan dönemin ücreti, İade ve Cayma Hakkı Politikası'nda belirtilen ve mevzuatın zorunlu kıldığı hâller dışında iade edilmez."],
      ["Yenileme bildirimi", "Yıllık abonelikte yenileme tarihinden en az yedi gün önce Alıcı'ya yenileme tarihi, tutarı ve iptal yolu e-postayla hatırlatılır. Her yenileme ödemesinden sonra ödeme bilgisi ve fatura e-postayla gönderilir."],
      ["Fiyat değişikliği", "Abonelik ücretinde yapılacak bir değişiklik, değişikliğin uygulanacağı ilk yenilemeden en az 30 gün önce Alıcı'ya e-postayla bildirilir. Alıcı yeni fiyatı kabul etmezse aboneliğini yenilemeden önce ücretsiz olarak iptal edebilir. Bildirim yapılmadan yenileme yüksek fiyatla yapılmaz."],
      ["Ödeme alınamazsa", "Yenileme ücreti karttan alınamazsa ödeme birkaç gün içinde tekrar denenir ve Alıcı bilgilendirilir. Ödeme alınamazsa Celse Pro kapanır; Alıcı'nın ilerlemesi silinmez ve ücretsiz bölüm oynanabilir."]
    ] },
    { baslik: "9. Derdini Anlat danışma kredileri", bloklar: [
      { not: DANISMA_UYARI },
      "Bir danışma kredisi, bir olay için şunları kapsar: Alıcı'nın yazdığı olay, deliller, karşı tarafın argümanları ve talebi üzerinden yapay zekâ ile üretilen eğitim amaçlı değerlendirme; bir kez üretilen kısa duruşma canlandırması ve \"Duruşmayı izle\" görsel canlandırması; değerlendirmeden sonra en çok 5 takip sorusu.",
      "Kredi, Alıcı danışmayı değerlendirmeye gönderdiğinde düşülür. Değerlendirme teknik bir nedenle üretilemezse ya da istek reddedilirse kredi kendiliğinden hesaba iade edilir. Kredilerin kullanım süresi sınırı yoktur; hesap açık kaldığı sürece kullanılabilir. Hesap silinirse kullanılmamış krediler de silinir; bu nedenle Alıcı hesabını silmeden önce kullanılmamış kredileri için bize yazabilir.",
      "Değerlendirme yapay zekâ ile otomatik üretilir; eksik, hatalı ya da güncel olmayan bilgi içerebilir ve somut olaya ilişkin hukuki sonuç doğurmaz. Satıcı ile Alıcı arasında avukat-müvekkil ilişkisi kurulmaz. Alıcı, gerçek kişi adı, kimlik numarası ve benzeri kişisel verileri yazmamakla yükümlüdür (bkz. Gizlilik ve KVKK)."
    ] },
    { baslik: "10. Cayma hakkı", bloklar: [
      "Mesafeli sözleşmelerde tüketicinin 14 günlük cayma hakkı vardır. Ancak elektronik ortamda anında ifa edilen hizmetlerde, tüketiciye anında teslim edilen gayrimaddi mallarda ve cayma süresi dolmadan tüketicinin onayıyla ifasına başlanan hizmetlerde cayma hakkı kullanılamaz (Mesafeli Sözleşmeler Yönetmeliği m.15/1-ğ ve h).",
      "Celse Pro'da içerik ödeme onaylandığı anda açıldığından, Alıcı'nın ödeme adımındaki açık onayıyla cayma hakkı sona erer. Danışma kredilerinde ise, hiçbir kredisi kullanılmamış paket için 14 gün içinde cayma hakkı kullanılabilir; kredi kullanıldığında o krediye ilişkin cayma hakkı sona erer. Ayrıntılar ve cayma formu İade ve Cayma Hakkı Politikası'ndadır."
    ] },
    { baslik: "11. Tarafların hak ve yükümlülükleri", bloklar: [
      ["Alıcı", "18 yaşını doldurduğunu ve verdiği bilgilerin doğru olduğunu beyan eder. Satın alımlar kişiseldir; hesap ve şifre başkasıyla paylaşılamaz, satılamaz, devredilemez. Alıcı, Uygulama'yı tersine mühendislik, otomatik veri çekme, güvenlik önlemlerini aşma veya hukuka aykırı amaçlarla kullanamaz."],
      ["Satıcı", "Hizmeti ayıpsız, sözleşmeye ve tanıtımına uygun sunmakla yükümlüdür. Satıcı oyuna yeni dava ve içerik ekleyebilir, içerikleri hukuki güncellemelere göre düzeltebilir. Celse Pro'nun esaslı niteliğini Alıcı aleyhine değiştiren bir düzenleme önceden bildirilir; Alıcı bu durumda aboneliğini sona erdirebilir ve ödenmiş ancak kullanılmamış süreye ilişkin bedelin iadesini isteyebilir."],
      ["Fikrî haklar", "Uygulama'daki metin, görsel, ses ve yazılımın hakları Satıcı'ya veya lisans verenlerine aittir. Satın alma, yalnızca kişisel ve ticari olmayan kullanım hakkı verir."]
    ] },
    { baslik: "12. Ödeme adımında alınan onaylar", bloklar: [
      "Ödeme sayfasında, sipariş butonundan önce aşağıdaki onay kutuları önceden işaretlenmemiş olarak gösterilir; zorunlu kutular işaretlenmeden sipariş verilemez:",
      onayListesi
    ] },
    { baslik: "13. Ayıplı hizmet ve teknik arızalar", bloklar: [
      "Hizmetin ayıplı olması hâlinde Alıcı'nın 6502 sayılı Kanun'un 15. maddesindeki seçimlik hakları (hizmetin yeniden görülmesi, ücretten indirim, ücretsiz onarım veya sözleşmeden dönme) saklıdır.",
      "Satıcı'dan kaynaklanan bir arıza nedeniyle satın alınan içerik veya hizmet kullanılamazsa Satıcı arızayı en kısa sürede giderir. Arıza süresi ve etkisine göre Alıcı'ya ücretsiz süre uzatımı, kredi iadesi veya ücret iadesi seçeneği sunulur; talepler tek tek değerlendirilir."
    ] },
    { baslik: "14. Sözleşmenin sona ermesi", bloklar: [
      "Sözleşme, Alıcı'nın aboneliği iptal etmesiyle dönem sonunda, hesabını silmesiyle ya da Alıcı'nın bu sözleşmeye ağır aykırılığı hâlinde Satıcı'nın yazılı bildirimiyle sona erer. Satıcı hizmeti tamamen sona erdirirse bunu en az 30 gün önce bildirir ve ödenmiş ancak kullanılmamış süre ile kullanılmamış kredilerin bedelini iade eder."
    ] },
    { baslik: "15. Mücbir sebep", bloklar: [
      "Doğal afet, savaş, salgın, genel internet veya enerji kesintisi, hizmet sağlayıcılarının tarafların kontrolü dışındaki kesintileri ve yetkili makamların kararları gibi öngörülemeyen hâllerde tarafların yükümlülükleri bu hâl süresince askıya alınır. Bu süre içinde kullanılamayan abonelik süresi için Alıcı'nın kanuni hakları saklıdır."
    ] },
    { baslik: "16. Kişisel veriler", bloklar: [
      "Alıcı'nın kişisel verileri 6698 sayılı Kişisel Verilerin Korunması Kanunu'na uygun olarak, Gizlilik Politikası ve KVKK Aydınlatma Metni'nde açıklandığı biçimde işlenir. Ödeme işlemi için gerekli veriler ödeme kuruluşu ile paylaşılır."
    ] },
    { baslik: "17. Uyuşmazlıkların çözümü", bloklar: [
      "Alıcı şikâyetlerini önce bize iletebilir (İletişim sayfası). Uyuşmazlıklarda, Ticaret Bakanlığı'nca her yıl ilan edilen parasal sınırlar içinde Alıcı'nın yerleşim yerindeki veya tüketici işleminin yapıldığı yerdeki tüketici hakem heyetine (e-Devlet üzerinden de) başvurulabilir. Bu sınırların üzerindeki uyuşmazlıklarda, kanunda öngörülen hâllerde dava açılmadan önce arabulucuya başvurulması zorunludur (6502 s. Kanun m.73/A); dava, tüketici mahkemesinde ve Alıcı'nın yerleşim yeri mahkemesinde de açılabilir (6502 s. Kanun m.68 ve m.73)."
    ] },
    { baslik: "18. Delil ve yürürlük", bloklar: [
      "Uyuşmazlıklarda Satıcı'nın ödeme, sipariş ve sistem kayıtları delil olarak kullanılabilir; Alıcı'nın aksini ispat hakkı saklıdır.",
      "Bu sözleşme, Alıcı'nın ödeme adımındaki elektronik onayı ve ödemenin onaylanmasıyla yürürlüğe girer. Bu metindeki değişiklikler, değişiklikten önce kurulmuş sözleşmeleri Alıcı aleyhine etkilemez; abonelikte uygulanacak değişiklikler 8. maddeye göre önceden bildirilir."
    ] }
  ]
};

// ---------- Ön Bilgilendirme Formu (Mesafeli Sözleşmeler Yönetmeliği m.5) ----------
export const ON_BILGILENDIRME: Belge = {
  dosya: "on-bilgilendirme.html", kisaAd: "Ön Bilgilendirme Formu", baslik: "Ön Bilgilendirme Formu",
  giris: "Bu form, 6502 sayılı Tüketicinin Korunması Hakkında Kanun'un 48. maddesi ve Mesafeli Sözleşmeler Yönetmeliği'nin 5. maddesi uyarınca sözleşme kurulmadan önce bilginize sunulur. Ödeme sayfasında siparişinize özgü ürün, tutar ve tarih bilgileriyle birlikte yeniden gösterilir ve okuduğunuzu onaylamanız istenir (Yönetmelik m.6).",
  bolumler: [
    { baslik: "1. Satıcı / hizmet sağlayıcı", bloklar: [saticiBlok, "Cayma bildirimleri ve şikâyetler yukarıdaki e-posta ve adrese yapılabilir."] },
    { baslik: "2. Ürünlerin temel nitelikleri", bloklar: [
      ["Celse Pro (Aylık / Yıllık)", "Celse avukatlık oyununda ücretsiz ilk kariyer bölümünden sonraki bütün kariyer bölümlerini, büro masasındaki bütün dosyaları ve antrenmandaki bütün davaları açan dijital içerik aboneliği. Aynı hesapla web, iPhone ve Android'de geçerlidir. Belirsiz sürelidir; ücret seçilen plana göre aylık ya da yıllık peşin alınır ve iptal edilene kadar her dönem yenilenir."],
      ["Derdini Anlat danışma kredisi (1 / 3)", "Yazdığınız bir olay için yapay zekâ ile üretilen eğitim amaçlı değerlendirme, kısa duruşma canlandırması, \"Duruşmayı izle\" görsel canlandırması ve en çok 5 takip sorusu. Celse Pro'dan bağımsızdır."],
      { not: DANISMA_UYARI }
    ] },
    { baslik: "3. Toplam fiyat", bloklar: [
      urunListesi,
      "Fiyatlara KDV dahildir; teslimat, kargo veya başka bir ücret yoktur. Abonelikte aynı tutar her dönem başında alınır; fiyat değişikliği en az 30 gün önce bildirilir."
    ] },
    { baslik: "4. Ödeme, ifa ve teslimat", bloklar: [
      ["Ödeme", `Visa veya Mastercard logolu banka ya da kredi kartıyla, ${ODEME_KURULUSU} altyapısıyla tek çekim. Kart bilgileriniz bizde saklanmaz.`],
      ["İfa", "Ödeme onaylandığında Pro ya da kredi hesabınıza anında tanımlanır; fiziksel teslimat yoktur. Taahhüt edilen ifa süresi ödeme onayından itibaren en geç 24 saattir; bu sürede tanımlanmazsa bize yazın."],
      ["Teknik koşullar", "İnternet bağlantısı ve Celse hesabıyla giriş gerekir. Web sürümü Chrome, Safari, Edge ve Firefox'un güncel sürümlerinde; mobil uygulama güncel iOS ve Android sürümlerinde çalışır. İçeriğe yalnızca hesabınızla erişilir; hesap paylaşımı teknik olarak sınırlanabilir."],
      ["Şikâyetler", "Şikâyetlerinizi e-postayla iletebilirsiniz; en geç 15 gün içinde yanıtlanır."]
    ] },
    { baslik: "5. Cayma hakkı ve kullanılamayacağı hâller", bloklar: [
      "Mesafeli sözleşmelerde 14 günlük cayma hakkınız vardır. Ancak elektronik ortamda anında ifa edilen hizmetler ve anında teslim edilen gayrimaddi mallar ile cayma süresi dolmadan onayınızla ifasına başlanan hizmetlerde cayma hakkı kullanılamaz (Mesafeli Sözleşmeler Yönetmeliği m.15/1-ğ ve h).",
      ["Celse Pro", "İçerik ödeme onayıyla anında açılır. Ödeme adımında ifaya hemen başlanmasını açıkça onayladığınızda cayma hakkınızı kaybedersiniz. Bu onayı vermeden Pro satın alınamaz."],
      ["Danışma kredileri", "Hiçbir kredisi kullanılmamış paket için, satın alma tarihinden itibaren 14 gün içinde gerekçe göstermeden cayabilirsiniz. Kredi danışma için kullanıldığında, yani değerlendirmeye gönderildiğinde, o krediye ilişkin cayma hakkınız sona erer. Kısmen kullanılmış 3'lü pakette kullanılmamış krediler için cayma hâlinde, paket bedelinin kullanılmamış kredilere düşen kısmı iade edilir."],
      ["Kullanım", "Cayma bildirimini süresi içinde e-postayla ya da İade ve Cayma Hakkı Politikası'ndaki formu göndererek yapabilirsiniz. İade, bildirimin bize ulaşmasından itibaren 14 gün içinde ödemede kullandığınız kartla yapılır; sizden masraf alınmaz."]
    ] },
    { baslik: "6. Aboneliğin sona erdirilmesi", bloklar: [
      "Celse Pro aboneliğinizi gerekçe göstermeden, cezai şart ya da ek ücret ödemeden istediğiniz an Hesap > Abonelik bölümünden ya da e-postayla iptal edebilirsiniz. İptalden sonra ücret alınmaz; ödenmiş dönemin sonuna kadar Pro açık kalır. İçinde bulunulan dönemin ücreti, mevzuatın zorunlu kıldığı hâller, teknik arızalar ve hatalı çekimler dışında iade edilmez. Yıllık abonelikte yenilemeden en az 7 gün önce hatırlatma e-postası gönderilir."
    ] },
    { baslik: "7. Uygulama mağazası satın alımları", bloklar: [
      "Celse Pro ve danışma kredileri mobil uygulamada App Store (Apple) veya Google Play üzerinden de satın alınabilir. Bu satın alımlarda ödemeyi ilgili mağaza alır; yenileme, iptal ve iade o mağazanın kendi koşullarına göre ve o mağaza üzerinden yapılır. Kanundan doğan haklarınız saklıdır."
    ] },
    { baslik: "8. Teminat", bloklar: ["Sizden herhangi bir teminat, depozito veya güvence bedeli istenmez."] },
    { baslik: "9. Uyuşmazlıklar", bloklar: [
      "Uyuşmazlıklarda Ticaret Bakanlığı'nca her yıl ilan edilen parasal sınırlar içinde yerleşim yerinizdeki veya işlemi yaptığınız yerdeki tüketici hakem heyetine, bu sınırların üzerindeki uyuşmazlıklarda kanunda öngörülen hâllerde önce arabulucuya, ardından tüketici mahkemesine başvurabilirsiniz (6502 s. Kanun m.68, m.73, m.73/A)."
    ] },
    { baslik: "10. Elektronik ticaret bilgileri (6563 s. ETK m.3)", bloklar: [{ liste: [
      ["Sözleşmenin kurulma adımları", "Ürün seçimi → sipariş özeti ve bu formun gösterilmesi → onay kutuları → \"" + SIPARIS_BUTONU + "\" → ödeme kuruluşunun güvenli ödeme sayfası → e-postayla teyit."],
      ["Veri girişi hatalarının düzeltilmesi", "Sipariş butonuna basmadan önce sipariş özetinde ürünü ve bilgilerinizi görüp değiştirebilirsiniz; ödeme sayfasından geri dönebilirsiniz."],
      ["Sözleşme metninin saklanması", "Sözleşme Satıcı tarafından saklanır ve siparişe özgü örneği e-posta adresinize gönderilir; güncel genel metin Mesafeli Satış Sözleşmesi sayfasında yayımlanır."],
      ["Gizlilik kuralları", "Gizlilik Politikası ve KVKK Aydınlatma Metni'nde açıklanmıştır."],
      ["Dil", "Sözleşme Türkçe kurulur."]
    ] }] }
  ]
};

// ---------- İade ve Cayma Hakkı Politikası ----------
export const IADE: Belge = {
  dosya: "iade.html", kisaAd: "İade ve Cayma Hakkı", baslik: "İade ve Cayma Hakkı Politikası",
  giris: "Bu politika, Celse internet sitesinde iyzico ile yapılan satın alımlara uygulanır. App Store ve Google Play satın alımları için 7. bölüme bakın.",
  bolumler: [
    { baslik: "1. Cayma hakkı", bloklar: [
      "Mesafeli sözleşmelerde tüketici, 14 gün içinde gerekçe göstermeden ve cezai şart ödemeden sözleşmeden cayabilir (6502 s. Kanun m.48/4; Mesafeli Sözleşmeler Yönetmeliği m.9). Hizmetlerde bu süre sözleşmenin kurulduğu gün başlar."
    ] },
    { baslik: "2. Dijital içerikte cayma hakkının istisnası", bloklar: [
      "Mesafeli Sözleşmeler Yönetmeliği m.15/1 uyarınca, (ğ) elektronik ortamda anında ifa edilen hizmetler veya tüketiciye anında teslim edilen gayrimaddi mallar ile (h) cayma hakkı süresi sona ermeden önce tüketicinin onayı ile ifasına başlanan hizmetlere ilişkin sözleşmelerde cayma hakkı kullanılamaz.",
      ["Celse Pro", "Pro içeriği ödeme onaylandığı anda hesabınızda açılır. Ödeme adımında, ifaya cayma süresi dolmadan hemen başlanmasını açıkça istediğinizi ve bu nedenle cayma hakkınızı kaybedeceğinizi bildiğinizi onaylarsınız. Bu onay kutusu önceden işaretli değildir ve işaretlenmeden satın alma yapılamaz. Onay verildikten sonra Celse Pro için cayma hakkı kullanılamaz."],
      ["Onayın kaydı", "Onayınız tarih ve saatiyle kaydedilir ve sipariş teyidi e-postasında da yer alır."]
    ] },
    { baslik: "3. Danışma kredilerinde cayma", bloklar: [
      "Krediler hesabınıza anında yüklenir, ancak danışma hizmeti krediyi kullandığınızda başlar. Bu nedenle:",
      { liste: [
        "Hiçbir kredisi kullanılmamış paket için satın alma tarihinden itibaren 14 gün içinde cayabilirsiniz; ödediğiniz tutarın tamamı iade edilir.",
        "Bir krediyi danışma için kullandığınızda (olayı değerlendirmeye gönderdiğinizde), o krediye ilişkin hizmetin ifasına onayınızla başlanmış olur ve o kredi için cayma hakkı sona erer (m.15/1-h).",
        "3'lü pakette bir veya iki kredi kullanılmışsa, 14 gün içinde kullanılmamış krediler için cayabilirsiniz; paket bedelinin kullanılmamış kredilere düşen kısmı (kredi başına paket bedelinin üçte biri) iade edilir.",
        "Değerlendirme teknik bir nedenle üretilemez ya da istek reddedilirse kredi kendiliğinden hesabınıza geri yüklenir; bu kredi kullanılmamış sayılır."
      ] }
    ] },
    { baslik: "4. Aboneliğin iptali", bloklar: [
      "Celse Pro aboneliğinizi gerekçe göstermeden, cezai şart veya ek ücret ödemeden istediğiniz an iptal edebilirsiniz (6502 s. Kanun m.52; Abonelik Sözleşmeleri Yönetmeliği m.22-24):",
      { liste: [
        ["Uygulamadan", "Hesap > Abonelik > \"Aboneliği iptal et\"."],
        ["E-postayla", `Kayıtlı e-posta adresinizden ${S.eposta} adresine "Celse Pro aboneliğimi iptal edin" yazmanız yeterlidir.`]
      ] },
      "İptal en geç 7 gün içinde işleme alınır ve e-postayla teyit edilir. İptalden sonra yenileme yapılmaz ve ücret alınmaz. Ödemesi yapılmış dönemin sonuna kadar Pro açık kalır; ilerlemeniz silinmez."
    ] },
    { baslik: "5. Abonelik ücretlerinin iadesi", bloklar: [
      "Abonelik iptal edildiğinde, içinde bulunulan dönemin ücreti iade edilmez ve Pro dönem sonuna kadar kullanılmaya devam eder. Bu kural aşağıdaki hâlleri ve mevzuatın zorunlu kıldığı diğer iadeleri etkilemez:",
      { liste: [
        ["Mevzuattan doğan iadeler", "Aboneliğin dönem bitmeden derhâl sona erdirilmesini açıkça istemeniz hâlinde, Abonelik Sözleşmeleri Yönetmeliği'nin iade hükümleri (m.25) uyarınca iadesi gereken bir tutar varsa bu tutar mevzuattaki süre içinde kesintisiz iade edilir."],
        ["Satıcıdan kaynaklanan değişiklik", "Pro'nun esaslı niteliğini aleyhinize değiştiren bir düzenleme veya hizmetin tamamen sona erdirilmesi hâlinde ödenmiş ancak kullanılmamış sürenin bedeli iade edilir."],
        ["Fiyat değişikliği", "Önceden bildirilmeyen bir fiyatla yenileme yapılmışsa aradaki fark ya da isteğinize göre yenileme bedelinin tamamı iade edilir."],
        ["Teknik arızalar", "Bizden kaynaklanan bir arıza nedeniyle Pro uzun süre kullanılamazsa, arızanın süresi ve etkisine göre ücretsiz süre uzatımı ya da kısmi veya tam iade yapılır."],
        ["Ayıplı hizmet", "6502 s. Kanun m.15'teki seçimlik haklarınız (yeniden ifa, ücretten indirim, sözleşmeden dönme) saklıdır."]
      ] },
      "Teknik arıza ve hatalı çekim talepleri tek tek incelenir ve en geç 15 gün içinde yanıtlanır."
    ] },
    { baslik: "6. Hatalı veya mükerrer çekimler", bloklar: [
      "Aynı satın alma için birden fazla çekim, gösterilenden farklı tutarda çekim, iptalden sonra yapılan yenileme çekimi ya da sizin yapmadığınız bir satın alma gibi hatalı çekimleri bize bildirin. Hatalı çekim tespit edildiğinde tutarın tamamı, tespitten itibaren en geç 14 gün içinde ödemede kullanılan karta iade edilir. Bankanıza itiraz etme hakkınız saklıdır."
    ] },
    { baslik: "7. App Store ve Google Play satın alımları", bloklar: [
      "Mobil uygulamada App Store (Apple) veya Google Play üzerinden yapılan satın alımlarda ödemeyi ilgili mağaza alır ve bu satın alımların ödeme, yenileme, iptal ve iade işlemleri mağazanın kendi koşullarına tabidir. Bu satın alımlarda:",
      { liste: [
        ["Apple", "Aboneliği iPhone'da Ayarlar > Apple Kimliği > Abonelikler bölümünden iptal edebilir, iade talebini Apple'ın \"Sorun bildir\" (reportaproblem.apple.com) sayfasından iletebilirsiniz."],
        ["Google Play", "Aboneliği Google Play > Ödemeler ve abonelikler bölümünden iptal edebilir, iade talebini Google Play iade politikasına göre Google'a iletebilirsiniz."]
      ] },
      "Mağaza satın alımlarının iadesini Satıcı yapamaz; ancak hizmetle ilgili sorunlarınızda bize yazabilirsiniz. Kanundan doğan haklarınız saklıdır."
    ] },
    { baslik: "8. Başvuru ve iade yöntemi", bloklar: [
      `Cayma ve iade taleplerinizi kayıtlı e-posta adresinizden ${S.eposta} adresine veya ${S.adres} adresine yazılı olarak iletebilirsiniz. Cayma bildiriminin süre içinde gönderilmiş olması yeterlidir. Talebinizde ad soyadınızı, hesabınızın e-posta adresini, sipariş tarihini ve ürünü belirtin.`,
      "Kabul edilen iadeler, cayma bildiriminin bize ulaşmasından itibaren en geç 14 gün içinde (Yönetmelik m.12), ödemede kullandığınız kartla ve sizden hiçbir masraf alınmadan yapılır. İadenin hesabınıza yansıma süresi bankanıza bağlıdır. İade edilen ürün hesabınızdan kaldırılır."
    ] },
    { baslik: "9. Cayma formu", bloklar: [
      "Bu formu doldurup e-postayla göndermeniz yeterlidir; formu kullanmak zorunlu değildir (Mesafeli Sözleşmeler Yönetmeliği eki örnek form).",
      { not: `Kime: ${S.unvan}, ${S.adres}, ${S.eposta}\n\nBu formla aşağıdaki dijital ürünün satışına ilişkin sözleşmeden cayma hakkımı kullandığımı bildiririm.\n\nÜrün: …………\nSipariş tarihi: …………\nTüketicinin adı soyadı: …………\nHesabın e-posta adresi: …………\nTüketicinin adresi: …………\nTarih: …………\nİmza (yalnızca kâğıtla gönderiliyorsa): …………` }
    ] }
  ]
};

// ---------- Teslimat ve Hizmet Sunumu ----------
export const TESLIMAT: Belge = {
  dosya: "teslimat.html", kisaAd: "Teslimat ve Hizmet Sunumu", baslik: "Teslimat ve Hizmet Sunumu",
  giris: "Celse'de satılan bütün ürünler dijitaldir. Fiziksel ürün, kargo veya teslimat ücreti yoktur.",
  bolumler: [
    { baslik: "1. Teslimat yöntemi ve süresi", bloklar: [
      "Ödemeniz onaylandığı anda satın aldığınız ürün Celse hesabınıza tanımlanır:",
      { liste: [
        ["Celse Pro", "Bütün kariyer bölümleri, büro masasındaki bütün dosyalar ve antrenmandaki bütün davalar açılır."],
        ["Danışma kredisi", "Kredi sayınız \"Derdini Anlat\" bölümünde görünür."]
      ] },
      "Tanımlama çoğunlukla birkaç saniye, en geç birkaç dakika sürer. Taahhüt ettiğimiz en uzun ifa süresi ödeme onayından itibaren 24 saattir. Bu süre içinde ürün hesabınızda görünmezse bize yazın; sorunu gideremezsek ödediğiniz tutarın tamamını en geç 14 gün içinde iade ederiz (Mesafeli Sözleşmeler Yönetmeliği m.16-17)."
    ] },
    { baslik: "2. Ürüne erişim", bloklar: [
      `Satın aldığınız ürün hesabınıza bağlıdır. Aynı hesapla web sitesinde (${S.web}) ve iPhone ya da Android uygulamasında giriş yaptığınız her cihazda kullanılabilir. Telefonu değiştirmeniz veya uygulamayı yeniden yüklemeniz satın alımı etkilemez.`,
      "Sipariş teyidi, fatura ve abonelik bildirimleri hesabınızın e-posta adresine gönderilir."
    ] },
    { baslik: "3. Teknik gereksinimler", bloklar: [{ liste: [
      "İnternet bağlantısı ve Celse hesabıyla giriş",
      "Web: Chrome, Safari, Edge veya Firefox'un güncel sürümü",
      "Mobil: güncel iOS veya Android sürümü",
      "Sesli anlatım için cihaz hoparlörü ya da kulaklık (isteğe bağlı)"
    ] }] },
    { baslik: "4. Hizmetin sürekliliği", bloklar: [
      "Hizmeti kesintisiz sunmaya çalışırız. Planlı bakım çalışmaları mümkün olduğunca önceden duyurulur ve kısa tutulur. Bizden kaynaklanan uzun süreli kesintilerde İade ve Cayma Hakkı Politikası'nın 5. bölümü uygulanır."
    ] },
    { baslik: "5. Derdini Anlat hizmetinin sunumu", bloklar: [
      "Olayınızı formdaki alanlara yazıp gönderdiğinizde değerlendirme genellikle birkaç dakika içinde ekrana gelir ve \"Derdini Anlat > Geçmiş\" bölümünde saklanır. Duruşma canlandırması ve takip soruları aynı kredi içinde verilir.",
      { not: DANISMA_UYARI }
    ] }
  ]
};

// ---------- İletişim ----------
export const ILETISIM: Belge = {
  dosya: "iletisim.html", kisaAd: "İletişim", baslik: "İletişim",
  giris: "Celse, aşağıda bilgileri yer alan şirket tarafından geliştirilir ve satılır.",
  bolumler: [
    { baslik: "Şirket bilgileri", bloklar: [saticiBlok] },
    { baslik: "Bize ulaşın", bloklar: [
      ["Satış, abonelik ve iade", `${S.eposta} · e-postanızda hesabınızın e-posta adresini ve sipariş tarihini belirtin.`],
      ["Cayma bildirimi", `${S.eposta} veya ${S.adres} (İade ve Cayma Hakkı Politikası'ndaki formla ya da serbest yazıyla).`],
      ["Kişisel veriler (KVKK m.11)", `${S.eposta}`],
      ["Yanıt süresi", "Talepleriniz en geç 15 gün içinde yanıtlanır; abonelik iptalleri en geç 7 gün içinde işleme alınır."]
    ] },
    { baslik: "Tüketici başvuru yolları", bloklar: [
      "Şikâyetinize çözüm bulamazsak, Ticaret Bakanlığı'nca ilan edilen parasal sınırlar içinde tüketici hakem heyetine (e-Devlet üzerinden de), bu sınırların üzerindeki uyuşmazlıklarda arabuluculuk ve tüketici mahkemesine başvurabilirsiniz."
    ] }
  ]
};

/** fiyatlar.html'deki açıklamalar. */
export const FIYATLAR = {
  dosya: "fiyatlar.html", kisaAd: "Fiyatlar", baslik: "Celse Pro ve Derdini Anlat fiyatları",
  giris: "Kariyerin ilk bölümü (\"Adliyede ilk yıl\"), tahkim bölümü ve karşılıklı duruşma ücretsizdir. Celse Pro ile bütün kariyer açılır; Derdini Anlat ayrı satılan danışma kredileriyle kullanılır.",
  notlar: [
    "Bütün fiyatlar Türk lirasıdır ve KDV dahildir. Teslimat ücreti yoktur; ürünler ödeme onaylandığında hesabınıza anında tanımlanır.",
    "Celse Pro, siz iptal edene kadar her dönem sonunda yenilenen bir aboneliktir. İstediğiniz an iptal edebilirsiniz; ödenen dönemin sonuna kadar Pro açık kalır.",
    "Dijital içerik anında ifa edildiğinden, ödeme adımında onay vermenizle Celse Pro için cayma hakkı sona erer. Kullanılmamış danışma kredilerinde 14 gün içinde cayma hakkınız vardır. Ayrıntılar İade ve Cayma Hakkı Politikası'ndadır.",
    "Mobil uygulamada App Store veya Google Play üzerinden yapılan satın alımlarda fiyat, mağazanın gösterdiği fiyattır ve iade mağazanın koşullarına tabidir."
  ],
  satinAl: "Satın almak için Celse'ye hesabınızla giriş yapın ve Celse Pro ya da Derdini Anlat ekranını açın."
};

export const BELGELER: Belge[] = [MESAFELI_SATIS, ON_BILGILENDIRME, IADE, TESLIMAT, ILETISIM];
