# Celse

Türk hukukuna dayalı, görsel bir duruşma oyunu. Tek kod tabanından **iOS**, **Android** ve **web** için çalışır (Expo + React Native + TypeScript).

- **Karşılıklı duruşma:** Aynı davada iki vekil sırayla hamle yapar. Bir oyuncunun seçimi, karşı tarafa gelecek soruyu değiştirir. Arkadaşla aynı cihazda ya da bilgisayara karşı (Çaylak / Usta) oynanır.
- **Tek kişilik dosyalar:** Oyuncu tek bir rolü üstlenir; karşı taraf ve hâkim senaryoya göre konuşur.

## Çalıştırma

```bash
npm install
npx expo start        # QR kodunu telefondaki Expo Go uygulamasıyla okutun
npm run web           # tarayıcıda açar
```

Kullanılan paketlerin hepsi (react-native-svg, expo-linear-gradient, AsyncStorage, expo-font) Expo Go'da hazır bulunur; geliştirme sırasında ayrı bir derleme gerekmez.

## Komutlar

- **`npm test`:** Bütün davalardaki bütün seçim yollarını oynatır (şu an yaklaşık 900 yol). Dava dosyalarını doğrular ve her yolun bir kararla bittiğini denetler. Yeni dava ekledikten sonra mutlaka çalıştırın.
- **`npm run typecheck`:** TypeScript denetimi.
- **`npm run export:web`:** Web sürümünü `dist/` klasörüne derler. Bu klasör Netlify, Vercel, GitHub Pages gibi herhangi bir statik barındırmaya yüklenebilir.

## Mağazalara çıkış

Paket kimlikleri `app.json` içinde `io.github.mehmetsafabakir.celse` olarak ayarlı. Derleme ve gönderim Expo'nun bulut hizmetiyle yapılır; bilgisayarda Xcode ya da Android Studio gerekmez:

```bash
npx eas-cli@latest build --platform android
npx eas-cli@latest build --platform ios
npx eas-cli@latest submit --platform android
```

Uygulama simgesi ve açılış görseli şu an Expo şablonununki; yayından önce `assets/` içindeki görselleri değiştirin.

## Proje yapısı

```
App.tsx                      ekranlar arası geçiş, yazı tipleri
src/data/cases/*.json        DAVALAR (yalnızca veri)
src/data/cases/index.ts      dava listesi
src/engine/                  oyun kuralları — arayüzden bağımsız
  types.ts                   dava dosyası şeması
  expr.ts                    koşul dili ("zaman && !kesme")
  engine.ts                  akış, puan, karar, bilgisayar rakip, doğrulama
  simulate.ts                bütün yolları oynatan denetim (test ve yönetim paneli)
src/data/career.ts           kariyer bölümleri, kilit kuralları, ilerleme kaydı
src/data/useCases.ts         uygulamayla gelen + yönetimden yayımlanan davaları birleştirir
src/admin/                   yönetim paneli
  AdminScreen.tsx            PIN, dava listesi, yeni dava sihirbazı, JSON içe aktarma
  CaseEditor.tsx             sekmeli dava düzenleyici ve denetim
  presets.ts                 mahkeme şablonları (heyet, salon, kürsü yazısı)
  store.ts                   içerik deposu (şimdilik cihazda; Supabase'e taşınacak)
docs/yuksek-mahkemeler.md    yüksek mahkeme usulleri ve kaynakları
src/ui/                      ekranlar ve çizimler
  useCourt.ts                duruşma akışı (satır → seçenek → geri bildirim)
  GameScreen.tsx  Stage.tsx  Character.tsx  VerdictScreen.tsx  MenuScreens.tsx
tools/simulate.ts            tüm yolları oynatan test
```

## Yönetim paneli

Ana ekrandaki **Yönetim paneli ›** bağlantısıyla açılır. İlk girişte bir PIN belirlenir; PIN cihazda saklanır ve oturum boyunca bir kez sorulur.

- **Dava listesi:** Uygulamayla gelen ve panelden eklenen bütün davalar. Başlık, mahkeme ya da alana göre arama; mod (tek kişilik / karşılıklı) ve durum (yayında / taslak / uygulamayla gelen) süzgeçleri.
- **Yeni dava:** Mod ve mahkeme şablonu seçilir (17 şablon: asliye, iş, ağır ceza, idare, BAM, Yargıtay, Danıştay, Sayıştay, AYM Bölüm ve Genel Kurul, Yüce Divan, AİHM Komite/Daire/Büyük Daire, UCM Yargılama/Temyiz). Şablon heyet sayısını, salonu, kürsü yazısını ve başkanın cübbesini kendisi ayarlar.
- **Düzenleyici sekmeleri:** Genel, Karakterler (canlı önizlemeli), Açılış ve belgeler, Delil çantası, Adımlar (seçenekli / müvekkil görüşmesi / delil çantası), Kararlar, Denetim, JSON.
- **Denetim:** Davanın bütün yollarını oynatır; hangi kararın kaç yolla verildiğini, hiç ulaşılamayan adımları ve hataları gösterir. Hatalı dava yayımlanamaz.
- **Oyna (önizleme):** Davayı kaydetmeden oynatır; karar ekranından panele dönülür.
- **Taslak / Yayınla:** Taslak oyuncuya görünmez. Yayımlanan dava oyunun listesine girer; uygulamayla gelen bir davayla aynı kimliği taşıyorsa onun yerine geçer ("Değişiklikleri geri al" ile asıl hâline dönülür).
- **Çoğalt, Sil, JSON içe aktar:** Tek dava ya da dava dizisi JSON olarak yapıştırılabilir; içe aktarılanlar taslak olarak kaydedilir.

- **Saklama:** Sunucuda yönetici olarak tanımlı hesapla girilmişse dosyalar Supabase'deki `dosyalar` tablosunda tutulur; yayındakileri bütün oyuncular görür (büro masası dahil). Yönetici değilse ya da sunucu yoksa cihazda (AsyncStorage) kalır. Kurulum: `supabase/yonetim.sql` bir kez çalıştırılır, ardından yönetici e-postası `yoneticiler` tablosuna eklenir (dosyanın başındaki satır).
- **Yapay zekâ denetimi:** Dosyalar (tek tek ya da toplu) yapay zekâya inceletilir: hukuki hata, puanlama, tutarlılık, dil ve motorun bulduğu yapısal sorunlar. Her sorun önem derecesi, yeri, açıklaması ve önerilen düzeltmeyle (şimdiki / yeni değer) listelenir. Yönetici seçtiği düzeltmeleri uygular; dosya motorla yeniden sınanır, "Onayla ve yayınla" ile yayına girer. Raporlar `denetimler` tablosunda saklanır.
- **Yapay zekâ ile üret:** Mod, branş, mahkeme şablonu, zorluk, adım sayısı ve isteğe bağlı konu seçilir. Üretim iki aşamalıdır (iskelet + adım planı, sonra adımlar) ve motor sorun bulursa yapay zekâ en fazla iki tur onarır. Sonuç taslak olarak kaydedilir.
- Yapay zekâ çağrıları `quick-worker` (supabase/functions/yz) fonksiyonunun `yonetim` kipinden geçer; bu kip yalnız `yonetici_mi()` doğru dönen hesaba açıktır. Komutlar ve yardımcılar: `src/admin/ai.ts`, `src/admin/aiCore.ts`, ekranlar: `src/admin/AiPanels.tsx`.

## Kariyer modu

Oyuncu genç avukat olarak tek hâkimli yerel mahkemelerde başlar ve kazandıkça yükselir. Kurallar `src/data/career.ts` içindedir.

- **Bölümler:** 1. Adliyede ilk yıl (sulh, asliye, iş) → 2. Heyetli mahkemeler (ağır ceza, idare/vergi, bölge adliye) → 3. Yüksek yargı (Yargıtay, Danıştay, Sayıştay) → 4. Anayasa Mahkemesi → 5. Uluslararası mahkemeler (AİHM, UCM).
- **Bölüm açılması:** Bir bölümün davalarının yüzde 60'ı (en çok 4) kazanılınca sonraki bölüm açılır. Davası olmayan bölüm "Yakında" görünür ve atlanır.
- **Bölüm içi sıra:** Davalar sırayla açılır; bir dava oynanınca (kazanılsın ya da kaybedilsin) sıradaki açılır.
- **Zorluk:** `"difficulty": "basit" | "orta" | "zor"`. Bölüm içinde önce basit, sonra orta, sonra zor davalar gelir. Basit davalarda kilit kararlar maddi hukuka dayanır; orta davalarda bir usul tuzağı vardır; zor davalarda usul merkezdedir.
- **Unvan ve itibar:** Unvan açılan en yüksek bölümden gelir (Genç avukat → Avukat → Kıdemli avukat → Anayasa avukatı → Uluslararası avukat). İtibar, kazanılan davaların en iyi puanlarının toplamıdır.
- **Serbest liste:** "Tek kişilik dosyalar" listesinde kariyerde henüz açılmamış davalar kilitli görünür.
- **Davanın yeri:** Dava dosyasında `"career": { "level": 3, "order": 2 }`. `level` yazılmazsa mahkemeden çıkarılır; `"off": true` davayı kariyer dışında tutar. Yönetim panelinde Genel sekmesindeki "Kariyer" bölümünden ayarlanır.

## Üyelik ve kariyer kaydı

- **Sunucu (Supabase):** `src/config.ts` içine proje adresi ve anon anahtar yazılınca gerçek üyelik açılır: ad soyad, telefon, e-posta, şifre ve KVKK onayı. Profiller `profiller`, kariyer `kariyer` tablosunda tutulur; herkes yalnızca kendi satırlarını görür (RLS). Şema: `supabase/schema.sql`.
- **Cihazlar arası eşitleme:** Giriş yapan oyuncunun bürosu, dosya akışı ve seçtiği karakter yüzü `oyuncu_durumu` tablosunda tek satır olarak tutulur (`supabase/surum12.sql`, `src/data/sync.ts`); iPhone, Android ve web aynı durumu görür. Açılışta ve girişte sunucudan çekilir, değişiklikten 3 sn sonra ve uygulama arka plana geçerken gönderilir. Çatışma kuralı `src/data/syncCore.ts` başında yazılıdır (ilk girişte ilerlemesi fazla olan, sonra son yazan kazanır); denemeler `tools/synctest.ts` (`npm test`). Karakter tarifi cihazda kalır. Misafir eşitlenmez; çıkışta cihazdaki kayıt silinmez, başka hesaba da gönderilmez.
- **Cihaz modu:** Sunucu ayarlı değilken aynı cihazda birden çok oyuncu oluşturulabilir; her birinin kariyeri ayrı anahtarda tutulur.
- **KVKK:** Aydınlatma metni taslağı `src/legal/kvkk.ts` içindedir; veri sorumlusu bilgileri yayından önce doldurulmalıdır.

## Seslendirme

Oyun ekranındaki 🔊 düğmesiyle açılır. Kod: `src/ui/voice.ts`. Sıradaki üç satır, oyuncu okurken arka planda seslendirilip indirilir.

- **Bulut sesleri:** Supabase'de `seslendir` fonksiyonu `GOOGLE_TTS_KEY` gizli anahtarıyla kuruluysa satırlar Google Cloud Text-to-Speech ile seslendirilir. Her (ses, metin) çifti bir kez üretilip `ses` deposunda saklanır; sonraki oynayışlarda hazır dosya çalınır. Karakterlere kadın/erkek ses listesinden sabit bir ses atanır (`CLOUD_VOICES`, `src/config.ts`); oyuncunun sesi bütün davalarda aynıdır.
- **Cihaz sesi:** Sunucu yoksa `expo-speech`. Cihazdaki Türkçe seslerden cinsiyete uygun olan seçilir, her karaktere ayrı ton verilir.
- **Kısaltmalar:** Okunmadan önce açılır: "TBK m.147" → "Türk Borçlar Kanunu madde 147", "CMK'da" → "Ceza Muhakemesi Kanununda" (ekler ünlü uyumuna göre). Kod: `src/engine/speechText.ts`, örnekler: `npx tsx tools/speech-test.ts`. Serbest cevap puanlamasında da aynı açılım kullanılır; oyuncu "Türk Borçlar Kanunu madde 147" dese de "TBK m.147" sayılır.

## Tahkim ve komisyonlar

Ana ekrandaki **Tahkim ve komisyonlar** bölümü: milletlerarası ticari tahkim (ICC, ISTAC, LCIA, UNCITRAL), spor tahkimi (CAS, TFF Tahkim Kurulu), İnsan Hakları Tazminat Komisyonu ve Sigorta Tahkim Komisyonu dosyaları (`src/data/cases/th-*.json`, `room: "tahkim"`, `forum`). Hepsi karşılıklıdır; kararı yapay zekâ hakem verir. Her forumun rehberi (hangi olaylarda başvurulur, süreç, karar, karara karşı yol) `src/data/forums.ts` içindedir. Milletlerarası forumlar Cenevre'deki tahkim salonunda (bg-tahkim), Türkiye'deki kurullar Ankara'daki toplantı salonunda (bg-komisyon) görülür; hakemler takım elbiselidir (`ar-*`). Tahkimde mübaşir ve kâtip yoktur.

## İnternet üzerinden oyun

Karşılıklı bir dava seçilip "İnternet üzerinden" denince davet kodu oluşur (`eslesmeler` tablosu, `supabase/surum3.sql`). Rakip kodla ya da açık davetler listesinden katılır. İki cihaz aynı motoru çalıştırır; yalnız hamleler (seçenek, serbest cevap puanı) sunucuya yazılır ve sırayla uygulanır (`src/data/online.ts`, `useCourt`'taki `OnlineLink`). Son sözler iki cihazda ayrı yazılır, kurucu cihaz yapay zekâ kararını ister ve satıra yazar; iki taraf aynı kararı görür. Farklı dillerdeki iki oyuncu aynı dosyayı oynayabilir (çeviriler yapıyı değiştirmez).

## Yönetici: oyuncular ve ücretsiz erişim

Panelde **👤 Oyuncular**: üyeler (ad, e-posta, telefon, üyelik tarihi) ve abonelik durumu; seçilen kişiye 1 ay, 1 yıl ya da süresiz ücretsiz erişim (abonelikler tablosuna `kaynak: "manuel"`), "Erişimi kaldır". Yetki sunucudadır (`yonetici_mi()`).

## Diller

Arayüz Türkçe, İngilizce, İspanyolca, Fransızca ve Almanca (`src/i18n`): `t("Türkçe metin")` seçili dilin sözlüğünden çevirir. Türk hukuku dosyaları Türkçe kalır; tahkim dosyalarının çevirileri `public/ceviri/<dil>/<id>.json` ya da sunucudaki `ceviriler` tablosundan yüklenir (`src/i18n/cases.ts`); yapısı asıl dosyayla aynı değilse Türkçesi açılır. Panelde **🌐 Çeviriler** yalnız metin alanlarını parça parça yapay zekâya çevirtip saklar. Seslendirme seçili dilin Chirp3 sesleriyle yapılır; yapay zekâ hakem kararı ve geri bildirimi oyuncunun dilinde yazar.

## Cübbe renkleri

Avukat cübbesinde boyun çevresindeki yaka kırmızı, aşağı inen şeritler yeşildir. Hâkim cübbesinde yaka ve şeritler mahkemeye göre değişir (Hâkim ve Savcıların Resmî Kıyafet Yönetmeliği m.4): ceza mahkemeleri ve savcılar kırmızı, hukuk mahkemeleri yeşil, idari yargı gri. Yargıtay, Danıştay, Anayasa Mahkemesi ve uluslararası mahkemeler kendi görselleriyle kalır. Görseller `tools/cubbe.py` ile üretilir (`mouth2.py` her çalıştırıldığında ardından bu betik de çalıştırılmalı); seçim `src/ui/people.ts` içindeki `robeOf` ile yapılır.

## Ağız hareketi

Ağız kareleri: kapalı, açık ("a"), yuvarlak ("o, u"), yayvan ("e, i": açık kare basık çizilir), yarı açık (ünsüzler: açık kare yarı saydam). Kareler konuşulan satırın harflerinden sırayla üretilir (`visemes` · PhotoStage) ve konuşma hızında oynatılır: seslendirme açıkken ses sürdükçe, kapalıyken satırın okunma süresince.

Gerçekçi görünümde konuşan karakterin ağzı açılıp kapanır (kapalı → açık → yuvarlak, hece ritminde). Her karakter için Higgsfield'da (gpt_image_2_5) aynı fotoğrafın "konuşurken" iki düzenlemesi üretildi (`tools/mouth-src/<anahtar>-a.jpg` açık, `-o.jpg` yuvarlak); `tools/mouth2.py` yalnızca ağız-çene bölgesini yüz işaretleriyle (dlib 68 nokta) asıl kesit fotoğrafa hizalar, rengini eşitler ve yumuşak kenarlı yama olarak `assets/gercek/agiz/` altına yazar; konumlar `src/ui/mouths.ts`. Yeni karakter eklenince bu iki düzenleme üretilip betik yeniden çalıştırılır.

## Fon müziği

Giriş ekranında "Fon müziği" ile açılıp kapanır (varsayılan kapalı). Sakin bir piyano döngüsüdür (`tools/muzik.py` ile üretilir, `assets/muzik/fon.mp3`); satır seslendirilirken kısılır. Kod: `src/ui/music.ts`.

## Büro masası (kariyer)

Kariyer bir büro yönetimidir. Oyuncu karakterini (7 avukat fotoğrafı), büronun adını ve şehrini (16 il) seçer, 150.000 TL sermayeyle başlar. Kod: `src/data/office.ts`, `src/data/flow.ts`, `src/data/life.ts`, `src/ui/DeskScreen.tsx`, `src/ui/OfficeScreen.tsx`.

- **Gelen dosyalar:** Her ay büroya üç dosya teklif edilir (stajyer ve katip her biri bir fazla). Kabul edilen dosya masaya konur (en çok 3); geri çevrilen altı ay gelmez, bekletilen teklif bir ay sonra düşer. Duruşması biten dosya masadan kalkar, ücreti kasaya girer, ay kapanır.
- **Branşlar:** Borçlar ve Kira, Ticaret, İcra ve İflas, İş, Ceza, Aile ve Miras, İdare ve Vergi, Anayasa ve İnsan Hakları (`src/data/branches.ts`, davanın `area` önekinden). Bir branş, o branştan ilk dosya gelince açılır. Kazanılan her dosya o branştan gelme ağırlığını artırır, kaybedilen azaltır. Oyuncu branşlara odaklanabilir; o zaman yalnız onlardan dosya gelir. Zorluk zamanla artar: ilk aylarda basit dosyalar ağırlıklıdır.
- **Ücret:** Müvekkil dosyasında basamağa ve şehre göre vekâlet ücreti; kazanınca ikna puanına göre prim, kaybedince peşin kısım. CMK görevlendirmesi ve adli yardım sabit ücretlidir. Her ay ayrıca rutin büro işleri geliri vardır (itibar, yani kazanılan dava sayısı, ve çalışanlarla artar).
- **Giderler:** Büro (kira, ofis, baro aidatı, mali müşavir, sekreter, stajyer, katip) ve kişisel (ev kirası, geçim, ulaşım ya da araba, çocuklar, krediler, nafaka). Kişisel gider en az 60.000 TL/ay.
- **Hayat olayları:** Ay sonlarında koşulu tutan bir olay çıkar ve masada karar beklenir: araba, stajyer, evlilik, çocuk, yıllık kira artışı (TBK m.344), katip, konut kredisi, kasa ekside eleman çıkarma ya da borçlanma, evde gerilim ve boşanma, araba arızası. Seçimlerin tek seferlik ve aylık etkisi vardır; takvim Ocak 2027'de başlar.
- **Kariyer haritası:** Bölümler (yerelden uluslararasına) ve unvan aynen sürer; bir bölümdeki dosyalar ancak bölüm açılınca teklif edilir. Haritadan ya da serbest listeden oynanan davalar alıştırmadır, kasaya dokunmaz.
- Tutarlar oyun içi yaklaşık değerlerdir.

## Serbest cevap (yazılı / sesli)

`"kind": "free"` adımında oyuncu cevabını kendisi yazar ya da mikrofona söyler (web'de tarayıcının konuşma tanıması, telefonda klavye dikte).
- **`rubric`:** İyi bir cevabın içermesi gerekenler. Supabase'deki `degerlendir` fonksiyonu cevabı bu ölçütle Claude'a gönderir; 0–100 puan ve kısa geri bildirim döner.
- **`keywords`:** Sunucu yokken ya da cevap gelmezse kullanılan kavram grupları (`{ "terms": ["yazılı"], "weight": 2 }`).
- **`model`:** Geri bildirimde gösterilen örnek cevap.
- **`choices`:** Puan bantları; her birinde `min` (alt sınır), `delta`, `set`, `note`. En az birinin `min` değeri 0 olmalı.

Örnek: Sözlü Fesih davasının "fesih usulü" adımı.

## Yıllık abonelik

- **Ücretsiz kısım:** Kariyer sırasındaki ilk 5 dava (`FREE_CASES`, `src/data/subscription.ts`). Diğer bütün davalar ve karşılıklı duruşma abonelikle açılır; kilitli davaya basınca abonelik ekranı çıkar.
- **Abonelik kaydı:** Supabase `abonelikler` tablosu (`bitis`, `kaynak`). Oyuncu yalnızca okuyabilir; satırları ödeme bildirimleri yazar: telefonda App Store / Google Play (RevenueCat üzerinden), web'de iyzico.
- **İçerik denetimi:** Yönetim paneline PIN ile girildiğinde o oturumda bütün içerik açılır.
- **Fiyat (KDV dahil):** Yıllık 5.000 TL, aylık 520 TL (`PLANS`). Yıllık plan 12 aylık ödemeye göre yaklaşık %20 avantajlıdır.

## Yeni dava ekleme (kod yoluyla)

1. `src/data/cases/` içine yeni bir JSON dosyası koyun (en kolayı mevcut bir davayı kopyalamak).
2. `src/data/cases/index.ts` içindeki listeye ekleyin.
3. `npm test` çalıştırın. Hatalı bir koşul, tanımsız bir konuşmacı ya da hiç açılmayan bir bayrak varsa test adım adım söyler.

### Dava dosyasının parçaları

- **`mode`:** `"duel"` (karşılıklı) ya da `"solo"` (tek kişilik).
- **`sides`:** `p1` ve `p2` tarafları; ör. Davacı vekili ve Davalı vekili. Tek kişilik davada oyuncu her zaman `p1`'dir.
- **`cast`:** Hâkim ve diğer karakterlerin görünüşü. Karşılıklı davada `p1` ve `p2` avukatların görünüşünü de içerir.
- **`intro`, `docs`:** Açılış anlatımı ve dosyadaki belgeler.
- **`steps`:** Sırayla oynanan adımlar. Her adımda `side` (kimin sırası), `scene` (`office` ya da `court`), isteğe bağlı `if` koşulu, `lines` (konuşmalar), `prompt` (soru) ve 2–4 `choices` (seçenek) bulunur.
- **`choices`:** Her seçenekte `text`, `delta` (puan etkisi), `set` (açtığı bayraklar), `law` (madde), `note` (açıklama) ve isteğe bağlı `reply` (seçimden sonraki konuşmalar) ile `fatal` (davayı hemen bitiren hata) bulunur.
- **`outcomes`:** Karar kuralları. Yukarıdan aşağı denenir, koşulu tutan ilk kural karardır. Sonuncusu koşulsuz olmalıdır.

### Koşul dili

Bayraklar seçeneklerin `set` alanıyla açılır. Koşullarda `&&` (ve), `||` (veya), `!` (değil) ve parantez kullanılır:

```json
{ "if": "zaman && !kesme", "winner": "p2", "hukum": "Davanın REDDİNE,", "summary": "..." }
```

Bir metnin yalnızca belirli durumlarda görünmesi için parçalara bölünebilir:

```json
"note": [
  { "text": "Kısmi ödeme zamanaşımını keser (TBK m.154/1)." },
  { "if": "!dekont", "text": " Ödemeyi dava dilekçesinde anlatmamıştınız." }
]
```

`flags` içinde `end` adlı bayrak açılırsa dava o seçimden sonra hemen karara gider (ör. arabuluculukta anlaşma).

## Adım türleri

Her adımda `kind` alanı adımın nasıl oynanacağını belirler. Yazılmazsa klasik seçenekli adım kabul edilir.

- **`choice` (varsayılan):** 2–6 seçenek. Bir seçeneğe `"if"` yazılırsa yalnızca o koşulda görünür. Örneğin `"if": "makbuz"` yazılan talimat, makbuz bulunmadıysa hiç çıkmaz.
- **`interview` (müvekkil görüşmesi):** `choices` sorulabilecek soruların listesidir, `limit` kaç soru sorulabileceğini belirler. Her sorunun cevabı `reply` ile verilir. Soru bir bayrak açabilir (`"set": ["makbuz"]`); açılan bayrak, çantadaki gizli bir delili görünür kılar.
- **`evidence` (delil çantası ve itiraz):** Karşı tarafın beyanı `statement` alanına yazılır. Oyuncu bu beyana çantadan bir delil sunarak itiraz eder.
  - **`correct`:** Doğru delillerin kimlikleri.
  - **`hit`:** Doğru delil sunulunca olacaklar.
  - **`responses`:** Belirli bir delil sunulunca olacaklar (örneğin "doğru madde ama belge gerekiyordu" açıklaması).
  - **`miss`:** Diğer bütün yanlış deliller için varsayılan sonuç.
  - **`pass`:** Oyuncu itiraz etmeden geçerse olacaklar.

## Delil çantası

Davanın `evidence` listesi çantadaki belgeleri, kanun maddelerini ve beyanları tanımlar:

```json
{ "id": "ev_makbuz", "type": "belge", "title": "Elden ödeme makbuzları", "desc": "...", "if": "makbuz" }
```

`if` alanı olan delil, o bayrak açılana kadar çantada görünmez.

## Mahkeme heyeti ve salon

- **`bench`:** Kürsüdeki hâkim sayısı. Örneğin `{ "judges": 5, "title": "Daire Başkanı ve dört üye" }`. Yediden fazla hâkim iki sıra hâlinde çizilir. Başkan, `cast.judge` ile tanımlanan kişidir; diğer üyeler onun cübbesini taşır.
- **`room`:** Salonun görünümü: `yerel`, `yuksek` ya da `uluslararasi`.
- **`inscription`:** Kürsünün arkasındaki yazı. `null` verilirse yazı çıkmaz.
- **Cübbe renkleri:** `look.robe` ve `look.collarColor` alanlarıyla her mahkeme için ayrı ayrı ayarlanabilir.

Hazır örnek dosyalar: **Uzak Adliye** (tek hâkim), **Eksik Müdafi** (Yargıtay, 5 üye), **Strazburg** (AİHM Büyük Daire, 17 yargıç), **Lahey** (UCM Yargılama Dairesi, 3 yargıç), beşer Anayasa Mahkemesi (`aym-*`), Danıştay (`danistay-*`) ve Sayıştay (`sayistay-*`) davası.
