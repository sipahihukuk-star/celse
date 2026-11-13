// "📝 Başvuru yap": avukatın (ya da arabulucu / bilirkişi olarak) yapacağı başvurular tek yerde. Her başvuru türünün kısa
// açıklaması, hazırlanması gerekenler, açılacak föy türü ve kullanılacak araçlar (dilekçe / belge yazma, icra takibi,
// talepler) burada tanımlıdır. Föyün kendisinde yalnız gelen evrakla (UYAP'tan indirilen, yüklenen) ilgili bölümler kalır.
import type { FoyTur } from "./foyTurleri";

export interface BasvuruTuru {
  k: string;
  ad: string;
  /** bir satırlık açıklama */
  aciklama: string;
  /** başvuru bu türde föy olarak tutulur */
  foyTur: FoyTur;
  /** bu türdeki öteki föyler de seçilebilir (ör. talep: bütün dava föyleri) */
  foyTurleri?: FoyTur[];
  /** dilekçe / belge editöründe ilk açılacak tür (beyan.ts) */
  beyanTur?: string;
  /** hazırlanması gerekenler (kontrol listesi) */
  gerekenler: string[];
  /** icra takibi hazırlama ekranı */
  icra?: boolean;
  /** Talepler (ihtiyati haciz, tedbir, delil tespiti, adli yardım) */
  talep?: boolean;
}

export const BASVURULAR: BasvuruTuru[] = [
  { k: "icra", ad: "⚖ İcra takibi aç", aciklama: "İlamlı, ilamsız, kambiyo, kira ya da rehinli takip; UYAP XML'i hazırlanır.", foyTur: "icra", icra: true, beyanTur: "Takip talebi açıklaması",
    gerekenler: ["Dayanak belge: ilam, çek / senet, kira sözleşmesi ya da fatura", "Vekâletname", "Alacaklıların ve borçluların kimlik no ve adresleri", "Ödemenin yapılacağı IBAN", "Alacak kalemleri, faiz türü ve başlangıç tarihi"] },
  { k: "dava", ad: "🏛 Dava aç", aciklama: "Asliye hukuk, iş, tüketici, aile, ticaret, sulh hukuk davası.", foyTur: "hukuk", beyanTur: "Dava dilekçesi",
    gerekenler: ["Vekâletname", "Dava şartı arabuluculuksa son tutanak", "Tarafların kimlik ve adres bilgileri", "Deliller (belgeler, tanık listesi)", "Dava değeri ve harç"] },
  { k: "arabuluculuk", ad: "🤝 Arabuluculuğa başvur", aciklama: "Dava şartı ya da ihtiyari arabuluculuk başvurusu (müvekkil adına).", foyTur: "arabuluculuk", beyanTur: "Arabuluculuk başvurusu",
    gerekenler: ["Başvuranın ve karşı tarafın kimlik / unvan, adres ve telefon bilgileri", "Vekâletname", "Uyuşmazlığın konusu ve talep tutarı", "Uyuşmazlık türü (iş, ticari, tüketici, kira, ortaklığın giderilmesi…)", "Varsa sözleşme, fatura, ihtarname, bordro gibi belgeler"] },
  { k: "suc_duyurusu", ad: "🚨 Suç duyurusunda bulun", aciklama: "Cumhuriyet başsavcılığına şikâyet ya da suç duyurusu.", foyTur: "sorusturma", beyanTur: "Şikâyet dilekçesi / suç duyurusu",
    gerekenler: ["Olay tarihi ve yeri; şikâyete bağlı suçlarda öğrenme tarihi (6 aylık şikâyet süresi)", "Şüpheli bilgileri (biliniyorsa)", "Deliller (belge, görüntü, tanık)", "Vekâletname"] },
  { k: "idari_basvuru", ad: "📨 İdareye başvur", aciklama: "İdareye başvuru, itiraz ya da bilgi edinme.", foyTur: "idari_basvuru", beyanTur: "İdareye başvuru (İYUK 10-11)",
    gerekenler: ["Başvurulacak idare ve konu", "İlgili işlem ya da talep", "Vekâletname", "Ekler (belgeler)"] },
  { k: "idari_dava", ad: "🏢 İdari dava aç", aciklama: "İdare ve vergi mahkemelerinde iptal ya da tam yargı davası.", foyTur: "idari_dava", beyanTur: "İptal davası dilekçesi",
    gerekenler: ["Dava konusu işlem ve tebliğ tarihi (dava açma süresi genel olarak 60 gün, vergi davalarında 30 gün)", "Varsa idareye başvuru ve cevabı (İYUK m.10-11)", "Vekâletname", "Yürütmenin durdurulması isteniyorsa gerekçesi"] },
  { k: "talep", ad: "📌 Görülen davada talep", aciklama: "İhtiyati haciz, ihtiyati tedbir, delil tespiti, adli yardım, yürütmeyi durdurma.", foyTur: "hukuk", foyTurleri: ["hukuk", "idari_dava", "ceza", "icra"], talep: true, beyanTur: "İhtiyati haciz talebi",
    gerekenler: ["Talebin dayanağı ve aciliyeti", "Teminat (ihtiyati haciz ve tedbirde)", "Deliller"] },
  { k: "ceza", ad: "🛡 Ceza davasında savunma / katılma", aciklama: "Sanık müdafiliği ya da katılan vekilliği; savunma, katılma, itiraz dilekçeleri.", foyTur: "ceza", beyanTur: "Savunma dilekçesi",
    gerekenler: ["İddianame ve tensip zaptı", "Vekâletname", "Duruşma günü", "Deliller ve tanıklar"] },
  { k: "aym", ad: "🇹🇷 Anayasa Mahkemesine başvur", aciklama: "Bireysel başvuru: kesin karardan sonra hak ihlali iddiası.", foyTur: "bireysel_basvuru", beyanTur: "Bireysel başvuru (olaylar ve ihlal iddiaları)",
    gerekenler: ["Kesin karar ve öğrenme / tebliğ tarihi (başvuru süresi 30 gün)", "Bireysel başvuru formu", "Vekâletname", "Başvuru harcı ya da adli yardım talebi", "Başvuru yollarının tüketildiğini gösteren belgeler"] },
  { k: "aihm", ad: "🇪🇺 AİHM'e başvur", aciklama: "Avrupa İnsan Hakları Mahkemesi başvurusu (iç hukuk yolları tükendikten sonra).", foyTur: "bireysel_basvuru", beyanTur: "AİHM başvurusu (olaylar, ihlaller, iç hukuk yolları)",
    gerekenler: ["Son iç hukuk kararı ve tebliğ tarihi (başvuru süresi 4 ay)", "AİHM başvuru formu", "AİHM formatında vekâletname", "İç hukuk yollarının tüketildiğini gösteren kararlar"] },
  { k: "tazminat", ad: "💶 Tazminat Komisyonuna başvur", aciklama: "6384 s. Kanun: makul sürede yargılanma, kararın geç ya da eksik icrası.", foyTur: "tazminat_komisyonu", beyanTur: "İnsan Hakları Tazminat Komisyonu başvurusu",
    gerekenler: ["Uzun süren dosyanın künyesi ve tarihleri", "Başvuru dilekçesi (komisyonun örneği)", "Vekâletname", "Varsa AYM ya da AİHM'den gelen karar"] },
  { k: "kurum", ad: "🏦 Kuruma / komisyona başvur", aciklama: "Banka, sigorta, SGK, Sigorta Tahkim Komisyonu, tüketici hakem heyeti, KVKK…", foyTur: "kurum_basvuru", beyanTur: "Tüketici hakem heyeti başvurusu",
    gerekenler: ["Başvurulacak kurum ve konu", "Sözleşme, poliçe, fatura ya da yazışmalar", "Vekâletname", "Talep tutarı"] },
  { k: "disiplin", ad: "📋 Disiplin soruşturması", aciklama: "Memur, hekim, öğretmen, işçi, avukat (baro)… hakkında disiplin ya da ön inceleme; savunma.", foyTur: "idari_sorusturma", beyanTur: "Savunma dilekçesi",
    gerekenler: ["Savunma istem yazısı ve tebliğ tarihi (savunma süresi)", "Soruşturma konusu ve deliller", "Vekâletname", "Varsa tanıklar"] },
  { k: "sozlesme", ad: "📄 Sözleşme hazırla / incele", aciklama: "Kira, satış, hizmet, iş, ücret sözleşmesi, protokol.", foyTur: "sozlesme", beyanTur: "Protokol (genel)",
    gerekenler: ["Tarafların kimlik / unvan ve adres bilgileri", "Sözleşmenin konusu, bedeli ve süresi", "Varsa önceki sözleşme ya da taslak"] },
  { k: "danisma", ad: "💬 Hukuki danışma / görüş", aciklama: "Dava ya da başvurudan önce görüşme, değerlendirme ve hukuki mütalaa.", foyTur: "danisma", beyanTur: "Hukuki mütalaa (görüş)",
    gerekenler: ["Müvekkilin anlattığı olay ve belgeler", "Sorulan hukuki soru", "Süreler (zamanaşımı, hak düşürücü süre)"] },
  { k: "arabulucu_gorev", ad: "📑 Arabulucu olarak belge hazırla", aciklama: "Arabulucu sıfatıyla yürüttüğünüz dosyada tutanak ve anlaşma belgesi.", foyTur: "arabulucu_gorev", beyanTur: "Arabuluculuk anlaşma belgesi taslağı",
    gerekenler: ["Büro no ve görevlendirme", "Tarafların ve vekillerin bilgileri", "Toplantı tarihleri ve katılanlar", "Anlaşma şartları ya da anlaşamama nedeni", "Arabuluculuk ücreti (Arabuluculuk Asgari Ücret Tarifesi)"] },
  { k: "bilirkisi", ad: "🔎 Bilirkişi raporu hazırla", aciklama: "Bilirkişi olarak görevlendirildiğiniz dosyada rapor ve ek rapor.", foyTur: "bilirkisi_gorev", beyanTur: "Bilirkişi raporu",
    gerekenler: ["Görevlendirme yazısı ve mahkemenin sorduğu hususlar", "Dosya kapsamı (dilekçeler, deliller, önceki raporlar)", "İnceleme / keşif tarihi", "Rapor teslim süresi"] }
];

export const basvuruBul = (k?: string) => BASVURULAR.find(x => x.k === k);

/** Föyün türüne göre "Başvuru yap"ta açılacak başvuru (föyün içindeki "📝 Başvuru ve dilekçeler" düğmesi için). */
export function foyBasvurusu(tur: FoyTur): BasvuruTuru {
  return BASVURULAR.find(x => x.foyTur === tur && !x.talep) || BASVURULAR.find(x => x.k === "talep")!;
}
