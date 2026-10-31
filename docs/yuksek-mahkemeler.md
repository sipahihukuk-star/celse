# Yüksek mahkemeler: heyet ve duruşma usulü

Oyundaki yüksek mahkeme dosyaları bu notlara göre kurgulanır. Her bilginin yanında kaynağı ve doğrulanıp doğrulanmadığı yazılıdır.

## Anayasa Mahkemesi

### Heyet
- **Üye sayısı:** 15 üye.
- **Genel Kurul:** Başkanın ya da belirleyeceği başkanvekilinin başkanlığında **en az on üye** ile toplanır (6216 s.K. m.21/1). İptal ve itiraz davalarına ve Yüce Divan yargılamasına Genel Kurul bakar (6216 s.K. m.21/2-a).
- **Bölümler:** İki bölüm vardır. Bölümler bir başkanvekilinin başkanlığında **dört üyenin katılımıyla** toplanır, yani heyet 5 kişidir (6216 s.K. m.22/1).
- **Oyundaki karşılığı:** Bölüm duruşmaları `bench.judges = 5`, Genel Kurul ve Yüce Divan `bench.judges = 15` (tam kadro) ile çizilir.

### Bireysel başvuru (6216 s.K. m.45–51)
- **Başvuru yolları:** Bütün yargısal başvuru yolları önceden tüketilmiş olmalıdır (m.45/2).
- **Süre:** Yolların tüketilmesinden, başvuru yolu yoksa ihlalin öğrenilmesinden itibaren **otuz gün** (m.47/5).
- **Kabul edilebilirlik:** Komisyonlarca incelenir. Anayasal önemi olmayan, önemli zarar doğurmayan ya da açıkça dayanaktan yoksun başvurular kabul edilemez bulunabilir (m.48).
- **Esas incelemesi:** Bölümler yapar. Başvuru Adalet Bakanlığına bildirilir; Bakanlık gerekli gördüğünde yazılı görüş verir (m.49/1-2).
- **Duruşma:** Mahkeme incelemeyi dosya üzerinden yapar, ama **gerekli görürse duruşma yapılmasına da karar verebilir** (m.49/4). Uygulamada nadirdir; oyunda bu istisnai durum canlandırılır.
- **İhlal kararı:** İhlal bir mahkeme kararından kaynaklanıyorsa dosya **yeniden yargılama** için ilgili mahkemeye gönderilir. Yeniden yargılamada hukuki yarar yoksa **tazminata** hükmedilebilir (m.50).
- **Kötüye kullanma:** Hakkını açıkça kötüye kullanan başvurucuya disiplin para cezası verilebilir (m.51).

### İptal davası ve Yüce Divan
- **İptal ve itiraz davaları:** Mahkeme kural olarak dosya üzerinden inceler. Gerekli gördüğünde ilgililerin **sözlü açıklamalarını** dinleyebilir (Anayasa m.149). *Madde metni bu araştırmada birincil kaynaktan açılamadı; kontrol edin.*
- **Yüce Divan:** Cumhurbaşkanı, TBMM Başkanı, Cumhurbaşkanı yardımcıları ve bakanlar, yüksek mahkemelerin başkan ve üyeleri gibi kişiler **görevleriyle ilgili suçlardan** Yüce Divanda yargılanır (Anayasa m.148). Yargılama Genel Kurulca yapılır. Savcılık görevini **Yargıtay Cumhuriyet Başsavcısı** ya da Cumhuriyet Başsavcıvekilinin yaptığı bilinmektedir; *bu hüküm de bu araştırmada birincil kaynaktan doğrulanamadı.*

## Danıştay

### Heyet
- **Daireler:** Dokuzu dava, biri idari olmak üzere on daire vardır (2575 s.K. m.13/1).
- **Heyetin toplanması:** Daire heyetleri **bir başkan ve dört üyenin** katılımıyla toplanır, salt çoğunlukla karar verir. Müzakereler gizlidir (2575 s.K. m.13/2). Heyet 5 kişidir.
- **Vergi daireleri:** 3., 4., 7. ve 9. daireler vergi dava dairesidir (2575 s.K. m.27).
- **Kurullar:** İdari Dava Daireleri Kurulu en az 15, Vergi Dava Daireleri Kurulu en az 11 üyeyle toplanır (2575 s.K. m.17/3).

### İlk derece mahkemesi olarak baktığı davalar (2575 s.K. m.24/1)
- Cumhurbaşkanı kararları.
- Cumhurbaşkanlığı kararnameleri dışındaki düzenleyici işlemler.
- Bakanlıklar ve kamu kurumlarınca çıkarılan, ülke çapında uygulanacak düzenleyici işlemler.
- Birden çok idare ya da vergi mahkemesinin yetki alanına giren işler.
- Kamu hizmetleriyle ilgili imtiyaz şartlaşma ve sözleşmelerinden doğan idari davalar.

### Duruşma ve savcı
- **Duruşma:** Danıştay ile idare ve vergi mahkemelerinde iptal davalarında ve belirli tutarı aşan tam yargı davalarında **taraflardan birinin isteği üzerine duruşma yapılır** (İYUK m.17/1). İstek dava dilekçesinde, cevap ya da savunmada yapılır (m.17/3). Temyizde duruşma, tarafın istemine ve Danıştayın kararına bağlıdır (m.17/2). Danıştay kendiliğinden de duruşmaya karar verebilir. Davetiyeler duruşmadan en az otuz gün önce gönderilir.
- **Danıştay savcısı:** İlk derece olarak bakılan dosyalarda esas hakkında bir ay içinde gerekçeli ve yazılı düşünce verir. Daire gerekli görürse düşüncesini **sözlü olarak da açıklar** (2575 s.K. m.60–61).
- **Davayla ilgili diğer kurallar:** Dava açma süresi kural olarak altmış gündür (İYUK m.7). Yürütmenin durdurulması için işlemin açıkça hukuka aykırı olması ve uygulanması hâlinde telafisi güç ya da imkânsız zarar doğması gerekir (İYUK m.27).

## Sayıştay

### Heyet
- **Daireler:** Her daire bir başkan ve altı üyeden oluşur.
- **Yargılama heyeti:** Yargılamalar **bir başkan ve dört üye** ile yapılır; hüküm ve kararlar oy çokluğuyla verilir. Oylama en kıdemsiz üyeden başlar, çekimser oy kullanılamaz. Heyet 5 kişidir.

### Hesap yargılaması
- **Yargılamaya esas rapor:** Denetçi kamu zararı tespit ederse sorgu düzenler, sorumluların savunmasını alır ve raporu hazırlar. Rapor olmadan hesap yargılaması yapılamaz.
- **Savcı:** Rapor Başsavcılığa gönderilir; Başsavcılığın yazılı görüşü rapora eklenir. Yargılama sırasında savcı hazır bulunur ve görüşünü açıklar.
- **Duruşma:** Sorumlular **savunmalarında ya da dilekçelerinde belirterek duruşma talep edebilir.** Talep hâlinde sorumlular ve vekilleri davet edilir. Bildirim görüşme gününden en az üç gün önce yapılır. **Hiçbiri gelmezse yargılamaya rapor üzerinden devam edilir.**
- **Kimler bulunur:** Heyet, raportör olarak görevlendirilen denetçi, savcı, sorumlular ve vekilleri. Görüşmeleri daire başkanı yönetir.
- **Ahizler:** Paranın ödendiği kişiler dilekçeyle başvurur ve daire kabul ederse fer'i müdahil olarak katılır.
- **Kararlar:**
  - Hesap ve işlemlerin mevzuata uygunluğuna.
  - Kamu zararının sorumlulardan **tazminine.** Tutara hüküm tarihinden itibaren kanuni faiz işler, tahsil İİK'ya göre yapılır.
  - Kamu zararı oluşmadığından **ilişilecek bir husus bulunmadığına.**
  - Gerekli hususların ilgili mercilere bildirilmesine.
- **Kamu zararı:** Kamu görevlilerinin kasıt, kusur ya da ihmallerinden kaynaklanan mevzuata aykırı karar, işlem ya da eylemleri sonucunda kamu kaynağında artışa engel ya da azalışa neden olunmasıdır (5018 s.K. m.71). Harcama yetkilisi, gerçekleştirme görevlisi ve muhasebe yetkilisinin sorumlulukları ayrıdır (5018 s.K. m.31–33, m.61).

### Kanun yolları
- **Temyiz:** Temyiz Kuruluna yapılır. Süre ilamın tebliğinden itibaren **altmış gündür.** Taraflar isterse ya da Kurul gerekli görürse duruşma yapılır, taraflara ikişer kez söz verilir. Temyiz Kurulu kararları kesindir.
- **Karar düzeltme:** Tebliğden itibaren **on beş gün** içinde, bir kez istenebilir.
- **Yargılamanın iadesi:** İlamın tebliğinden itibaren **beş yıl** içinde istenebilir. Sebepleri arasında hesapta maddi hata, hükme etki eden belgede sahtecilik ve sonradan ortaya çıkan belge vardır. İstem ilamın icrasını durdurmaz.

## Kaynaklar
- [Sayıştay Yargısı, T.C. Sayıştay Başkanlığı](https://www.sayistay.gov.tr/pages/64-sayistay-yargisi)
- [2575 sayılı Danıştay Kanunu, mevzuat.gov.tr](https://www.mevzuat.gov.tr/MevzuatMetin/1.5.2575.pdf)
- [İYUK m.17 ve Danıştay kararları](https://barandogan.av.tr/blog/mevzuat/iyuk-madde-17-durusma.html)
- [6216 sayılı Kanun, Lexpera konsolide metin](https://www.lexpera.com.tr/mevzuat/kanunlar/anayasa-mahkemesinin-kurulusu-ve-yargilama-usulleri-hakkinda-kanun-6216)
- [6216 sayılı Kanun m.45–51, İstanbul Bilgi Üniversitesi İnsan Hakları Merkezi](https://insanhaklarimerkezi.bilgi.edu.tr/media/uploads/2016/02/16/Any_Mah_Kurulus_Kanunu_Ilgili_Maddeler.pdf)
