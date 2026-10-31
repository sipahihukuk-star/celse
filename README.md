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
src/ui/                      ekranlar ve çizimler
  useCourt.ts                duruşma akışı (satır → seçenek → geri bildirim)
  GameScreen.tsx  Stage.tsx  Character.tsx  VerdictScreen.tsx  MenuScreens.tsx
tools/simulate.ts            tüm yolları oynatan test
```

## Yeni dava ekleme

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

Hazır örnek dosyalar: **Uzak Adliye** (tek hâkim), **Eksik Müdafi** (Yargıtay, 5 üye), **Strazburg** (AİHM Büyük Daire, 17 yargıç), **Lahey** (UCM Yargılama Dairesi, 3 yargıç).
