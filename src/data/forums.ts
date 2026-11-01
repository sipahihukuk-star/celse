// Tahkim ve komisyon rehberi: hangi uyuşmazlıklarda başvurulur, yargılama nasıl yürür, karar nasıl verilir, karara karşı yol.
// Oyunda "Tahkim ve komisyonlar" ekranında her forumun başında gösterilir.
export type ForumId = "icc" | "istac" | "lcia" | "uncitral" | "cas" | "tff" | "ihtk" | "sigorta";

export interface Forum {
  id: ForumId;
  name: string;
  short: string;
  group: "Milletlerarası ticari tahkim" | "Spor tahkimi" | "Komisyonlar";
  olaylar: string[];
  surec: string[];
  karar: string;
  yol: string;
}

export const FORUMS: Forum[] = [
  {
    id: "icc", group: "Milletlerarası ticari tahkim", short: "ICC",
    name: "ICC Uluslararası Tahkim Divanı (Paris)",
    olaylar: [
      "Sözleşmesinde ICC tahkim şartı bulunan uluslararası ticari uyuşmazlıklar: mal satımı (CISG), inşaat (FIDIC), distribütörlük ve acentelik, ortak girişim, lisans ve know-how, enerji tedariki.",
      "Tahkim şartının geçerliliği ve kapsamı, hakemin yetkisi (yetki itirazı), ihtiyati tedbir ve acil durum hakemi talepleri."
    ],
    surec: [
      "Tahkim talebi ve cevap; tek ya da üç hakemli heyetin oluşması (Divan atar ya da onaylar).",
      "Görev Belgesi (Terms of Reference) ve usul takvimi; yazılı beyanlar, belge ibrazı (çoğu zaman IBA Delil Kuralları), tanık ve bilirkişi dinlenen duruşma.",
      "Karar taslağı Divan tarafından biçim yönünden incelenir; acil durum hakemi ve belirli tutarın altında hızlandırılmış usul vardır."
    ],
    karar: "Hakem kararı kesin ve bağlayıcıdır; taraflar esastan itiraz edemez. Heyet sözleşmeyi, seçilen hukuku ve ticari teamülleri uygular; masrafları ve vekâlet giderlerini de paylaştırır.",
    yol: "Yalnızca tahkim yerinde iptal davası (Türkiye'de tahkim yeri olan milletlerarası tahkimde 4686 s. MTK m.15'teki sınırlı sebepler). Başka bir ülkede icrası için New York Sözleşmesi uyarınca tanıma ve tenfiz; ret sebepleri m.V ile sınırlıdır."
  },
  {
    id: "istac", group: "Milletlerarası ticari tahkim", short: "ISTAC",
    name: "İstanbul Tahkim Merkezi (ISTAC)",
    olaylar: [
      "Sözleşmesinde ISTAC şartı bulunan ulusal ya da milletlerarası ticari uyuşmazlıklar: inşaat, enerji, satım, şirket ortaklığı, finans.",
      "Acil hakem ve hızlandırılmış tahkim talepleri."
    ],
    surec: [
      "ISTAC Tahkim Kuralları: tahkim talebi, cevap, hakem seçimi ve onayı, usul toplantısı, yazılı beyanlar, delil ve duruşma.",
      "Milletlerarası unsur varsa ve tahkim yeri Türkiye ise 4686 sayılı Milletlerarası Tahkim Kanunu, yoksa HMK'nın tahkim hükümleri (m.407 vd.) uygulanır."
    ],
    karar: "Hakem kararı taraflar için bağlayıcıdır ve esastan denetlenmez.",
    yol: "Türkiye'de verilen karara karşı yalnızca iptal davası (MTK m.15 ya da HMK m.439'daki sınırlı sebepler: geçersiz tahkim anlaşması, savunma hakkının ihlali, yetki aşımı, kamu düzenine aykırılık vb.). Yabancı ülkede icra için New York Sözleşmesi."
  },
  {
    id: "lcia", group: "Milletlerarası ticari tahkim", short: "LCIA",
    name: "Londra Uluslararası Tahkim Mahkemesi (LCIA)",
    olaylar: ["LCIA şartı taşıyan uluslararası ticari, finans ve deniz ticareti uyuşmazlıkları."],
    surec: ["LCIA Kuralları: talep ve cevap, LCIA Mahkemesince hakem atanması, yazılı beyanlar, delil ve duruşma; hakemin reddi ve acil tedbir mekanizmaları."],
    karar: "Kesin ve bağlayıcı karar; gerekçeli ve yazılı.",
    yol: "Tahkim yeri İngiltere ise 1996 Tahkim Kanunu uyarınca sınırlı itirazlar; başka ülkede New York Sözleşmesi ile tenfiz."
  },
  {
    id: "uncitral", group: "Milletlerarası ticari tahkim", short: "UNCITRAL",
    name: "UNCITRAL Tahkim Kuralları (kurumsal olmayan / ad hoc tahkim)",
    olaylar: ["Tarafların bir kuruma bağlı olmadan UNCITRAL Kurallarını seçtiği ticari uyuşmazlıklar; deniz ticareti ve enerji sözleşmelerinde yaygındır."],
    surec: ["Hakemleri taraflar seçer, anlaşamazlarsa atama makamı belirler; usulü hakem heyeti kurallar çerçevesinde yürütür."],
    karar: "Bağlayıcı hakem kararı.",
    yol: "Tahkim yerinin hukukuna göre iptal davası; tenfiz için New York Sözleşmesi."
  },
  {
    id: "cas", group: "Spor tahkimi", short: "CAS",
    name: "Spor Tahkim Mahkemesi (CAS, Lozan)",
    olaylar: [
      "FIFA, UEFA ve diğer uluslararası federasyon kararlarına karşı temyiz: sözleşme feshi ve tazminat (FIFA RSTP m.17), yetiştirme tazminatı ve dayanışma katkısı, transfer ve tescil.",
      "Doping cezaları (WADA Kodu), şike ve müsabaka manipülasyonu, uygunluk ve vatandaşlık değişikliği, olimpiyat oyunlarında ad hoc bölüm."
    ],
    surec: [
      "Olağan usul (sözleşmeye dayalı uyuşmazlıklar) ve temyiz usulü (federasyon kararlarına karşı).",
      "Temyiz süresi, federasyon düzenlemesinde başka süre yoksa kararın tebliğinden itibaren 21 gündür (CAS Kodu R49).",
      "Panel olayları ve hukuku yeniden inceler (de novo, R57); duruşma yapılabilir; tanık ve bilirkişi dinlenir."
    ],
    karar: "Panel federasyon kuralları ile uygulanacak hukuku (çoğu zaman İsviçre hukuku) uygular. Şike ve doping davalarında ispat ölçütü “rahat kanaat” (comfortable satisfaction) olarak anılır.",
    yol: "İsviçre Federal Mahkemesine yalnızca sınırlı sebeplerle iptal başvurusu (İsviçre MÖHUK m.190)."
  },
  {
    id: "tff", group: "Spor tahkimi", short: "TFF TK",
    name: "TFF Tahkim Kurulu",
    olaylar: [
      "Profesyonel Futbol Disiplin Kurulu (PFDK) ve Amatör Disiplin Kurulu cezalarına itiraz: saha olayları, taraftar olayları, seyircisiz oynama, para cezası.",
      "Uyuşmazlık Çözüm Kurulu (UÇK) kararlarına itiraz: oyuncu-kulüp alacakları, haklı fesih, menajer komisyonu.",
      "Kulüp lisansı, tescil ve transfer, müsabaka tescili ile ilgili federasyon kararları."
    ],
    surec: [
      "İtiraz, federasyon talimatlarında öngörülen kısa süre içinde yazılı olarak yapılır; Kurul dosya üzerinden ya da duruşmalı inceler.",
      "Hakem kararlarının ve oyun kurallarının uygulanması (saha içi takdir) kural olarak denetlenmez; hukuk kuralına aykırılık denetlenir."
    ],
    karar: "Anayasa m.59/3 uyarınca spor federasyonlarının sporun yönetimi ve disipliniyle ilgili kararlarına karşı ancak zorunlu tahkim yoluna gidilebilir; Tahkim Kurulu kararları kesindir.",
    yol: "Hiçbir yargı merciine başvurulamaz; ancak temel hak ihlali iddiasıyla Anayasa Mahkemesine bireysel başvuru yapılabileceği kabul edilmektedir."
  },
  {
    id: "ihtk", group: "Komisyonlar", short: "İHTK",
    name: "İnsan Hakları Tazminat Komisyonu (Adalet Bakanlığı)",
    olaylar: [
      "Ceza soruşturması ve kovuşturmaları ile hukuk ve idari yargı davalarının makul sürede sonuçlandırılmaması: 7499 sayılı Kanunla (2024) yargılama sürerken ya da kesin kararın öğrenilmesinden itibaren bir ay içinde doğrudan müracaat edilebilir.",
      "Mahkeme kararlarının geç ya da eksik icra edilmesi veya hiç icra edilmemesi: Anayasa Mahkemesi ve AİHM'den Komisyona yönlendirilen başvurular.",
      "Geçmişte genişletilen alanlar (2014, AİHM'de bekleyen başvurular için): kamulaştırma ve irtifak davalarında uzun yargılama ve enflasyon nedeniyle değer kaybı; ceza infaz kurumunda disiplin cezası itirazlarında savunma hakkının kısıtlanması, Türkçe olmayan mektupların ve yayınların engellenmesi."
    ],
    surec: [
      "Komisyon Adalet Bakanlığında görevli dokuz hâkim ve savcıdan oluşur, üçer kişilik heyetlerle çalışır; inceleme dosya üzerinden yapılır, ilgili yargı dosyası ve idarenin görüşü getirtilir.",
      "Komisyon dokuz ay içinde karar verir; tazminat belirlenirken AİHM ve Anayasa Mahkemesinin benzer başvurulardaki ölçütleri esas alınır. Doğrudan makul süre müracaatında yalnızca manevi tazminata hükmedilir."
    ],
    karar: "Komisyon ihlali tespit ederse başvurana tazminat ödenmesine karar verir; görev alanı dışındaki ya da süresinde yapılmayan başvuruları reddeder.",
    yol: "Komisyon kararına karşı tebliğden itibaren on beş gün içinde, Komisyon aracılığıyla Ankara Bölge İdare Mahkemesine itiraz edilir; bu karar kesindir. Ardından Anayasa Mahkemesine bireysel başvuru yolu açıktır."
  },
  {
    id: "sigorta", group: "Komisyonlar", short: "STK",
    name: "Sigorta Tahkim Komisyonu",
    olaylar: [
      "Sigortalı, lehtar ya da zarar gören ile Komisyona üye sigorta kuruluşu arasındaki uyuşmazlıklar: kasko, trafik sigortası (değer kaybı, destekten yoksun kalma), konut ve yangın, sağlık, hayat ve kredi hayat, nakliyat, mesleki sorumluluk, DASK, tarım sigortası.",
      "Tazminatın reddi, eksik ödenmesi, istisna ve muafiyet tartışmaları, beyan yükümlülüğünün ihlali."
    ],
    surec: [
      "Önce sigorta kuruluşuna yazılı başvuru yapılır; şirket reddederse ya da 15 gün içinde cevap vermezse Komisyona başvurulur (5684 s.K. m.30).",
      "Uyuşmazlık hakem heyeti dosyayı inceler, gerekirse bilirkişi raporu alır; HMK hükümleri uygulanır. Karar başvurudan itibaren dört ay içinde verilir."
    ],
    karar: "Hakem kararı ilam niteliğindedir; tazminat, faiz, yargılama gideri ve vekâlet ücretine hükmedilir.",
    yol: "Belirli tutarın üzerindeki uyuşmazlıklarda karara karşı tebliğden itibaren 10 gün içinde itiraz hakem heyetine bir kez itiraz; daha yüksek tutarlarda itiraz kararına karşı Yargıtay'a temyiz. Sınırlar her yıl güncellenir (21.05.2025'ten itibaren itiraz 28.000 TL ve üzeri, temyiz 300.000 TL üzeri)."
  }
];

export const forumOf = (id?: string) => FORUMS.find(f => f.id === id);
