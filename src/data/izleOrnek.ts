// "Duruşmayı izle" örnek senaryosu: yalnız geliştirme önizlemesi için (web'de adres ?izle-ornek ile açılır; sunucuya gitmez).
// Uydurma ve anonim bir iş hukuku olayıdır; kişi, şirket ya da dosya numarası içermez.
import type { Danisma, Senaryo } from "./danisma";

export const ORNEK_SENARYO: Senaryo = {
  taraf: "davaci",
  mahkeme: "İş Mahkemesi",
  ozet: "Davacı, yaklaşık altı yıldır çalıştığı işyerinden 2026 Ekim ayında sözlü olarak çıkarıldığını, kıdem ve ihbar tazminatının ödenmediğini söylüyor. İşveren, işçinin izinsiz olarak işe gelmediğini ve sözleşmenin bu nedenle haklı olarak feshedildiğini ileri sürüyor. Davacının elinde bordrolar, SGK hizmet dökümü ve iki iş arkadaşının tanıklığı var. Arabuluculuk görüşmesi anlaşmasızlıkla sonuçlanmış.",
  roller: { bizAvukat: "Davacı vekili", karsiAvukat: "Davalı vekili", hakim: "Hâkim", karsiTaraf: "İşveren şirket yetkilisi" },
  sahneler: [
    {
      tur: "gorusme_biz",
      satirlar: [
        { kim: "bizAvukat", metin: "Hoş geldiniz. Önce olayı baştan, kendi cümlelerinizle anlatır mısınız? İşe ne zaman girdiniz, ne zaman ve nasıl çıkarıldınız?" },
        { kim: "biz", metin: "2020 başında işe girdim. Geçen ay müdür beni odasına çağırdı ve yarından itibaren gelmememi söyledi. Elime yazılı hiçbir şey vermediler." },
        { kim: "bizAvukat", metin: "Sizden yazılı savunma istendi mi, ya da devamsızlık tutanağı imzalatıldı mı?" },
        { kim: "biz", metin: "Hayır, hiçbir şey imzalamadım. Sadece bir gün hastaneye gittim, raporum da var." },
        { kim: "bizAvukat", metin: "Bu önemli. İşveren devamsızlık iddia ediyorsa bunu tutanak ve kayıtlarla ispat etmesi gerekir. Raporunuzu ve bordrolarınızı mutlaka saklayın." },
        { kim: "biz", metin: "Çıkarıldığım gün yanımda iki iş arkadaşım vardı, olanları gördüler." },
        { kim: "bizAvukat", metin: "Tanıklarınız da değerli. Dava açmadan önce arabulucuya başvurmak zorunludur; siz bunu yapmışsınız, son tutanağı bana getirin." },
        { kim: "bizAvukat", metin: "Kıdem ve ihbar tazminatı ile ödenmeyen alacaklarınız için dava açmayı değerlendireceğiz. Süreleri kaçırmamak için vakit kaybetmeden hareket etmeliyiz." }
      ]
    },
    {
      tur: "gorusme_karsi",
      satirlar: [
        { kim: "karsiAvukat", metin: "Çalışanınızla iş ilişkisi nasıl sona erdi? Elinizdeki belgeleri birlikte gözden geçirelim." },
        { kim: "karsiTaraf", metin: "Son aylarda birkaç kez haber vermeden işe gelmedi. Biz de artık çalışmak istemediğini düşündük." },
        { kim: "karsiAvukat", metin: "Gelmediği günler için devamsızlık tutanağı tuttunuz mu? İmzalayan tanıklar var mı?" },
        { kim: "karsiTaraf", metin: "Tutanağımız yok ama puantaj kayıtlarında o günler boş görünüyor." },
        { kim: "karsiAvukat", metin: "Tutanak ve yazılı savunma istenmemiş olması bizim için bir risk. Puantaj kayıtlarını ve giriş-çıkış kayıtlarını eksiksiz toplayalım." },
        { kim: "karsiTaraf", metin: "Bir de rapor aldığını söylüyormuş, o günden haberimiz yoktu." },
        { kim: "karsiAvukat", metin: "Savunmamızı haklı fesih üzerine kuracağız; ancak raporlu gün devamsızlık sayılmayabilir. Uzlaşma ihtimalini de açık tutalım." }
      ]
    },
    {
      tur: "durusma",
      satirlar: [
        { kim: "hakim", metin: "Celse açıldı. Taraf vekilleri hazır. Davacı vekili, davanızı kısaca özetler misiniz?" },
        { kim: "bizAvukat", metin: "Müvekkilim yaklaşık altı yıl çalıştıktan sonra sözlü olarak işten çıkarılmıştır. Fesih yazılı yapılmamış, savunması alınmamıştır. Kıdem ve ihbar tazminatının tahsilini talep ediyoruz." },
        { kim: "hakim", metin: "Davalı vekili, savunmanız nedir?" },
        { kim: "karsiAvukat", metin: "Davacı birden fazla gün mazeretsiz olarak işe gelmemiştir. İş sözleşmesi bu nedenle haklı olarak feshedilmiştir; davanın reddini talep ediyoruz." },
        { kim: "hakim", metin: "Devamsızlık iddiasına ilişkin tutanak ya da yazılı ihtar var mı?" },
        { kim: "karsiAvukat", metin: "Tutanak tutulmamıştır; ancak puantaj kayıtlarını sunacağız." },
        { kim: "bizAvukat", metin: "Puantaj kayıtları işverenin tek taraflı belgesidir. Ayrıca müvekkilimin o günlerden birinde hastane raporu bulunmaktadır; raporu dosyaya sunuyoruz." },
        { kim: "hakim", metin: "Davacı, işten çıkarıldığınız gün ne oldu, kısaca anlatır mısınız?" },
        { kim: "biz", metin: "Müdür beni odasına çağırdı ve ertesi günden itibaren gelmememi söyledi. Yanımda iki iş arkadaşım vardı." },
        { kim: "hakim", metin: "Şirket yetkilisi, bu konuda söylemek istediğiniz bir şey var mı?" },
        { kim: "karsiTaraf", metin: "Kimseyi kapı dışarı etmedik. Kendisi işe gelmeyi bıraktı." },
        { kim: "bizAvukat", metin: "Olayı gören iki tanığımızın dinlenmesini ve alacakların hesabı için bilirkişi incelemesi yapılmasını talep ediyoruz." },
        { kim: "karsiAvukat", metin: "Tanıkların davacının çalışma arkadaşı olduğunu, beyanlarının bu yönüyle değerlendirilmesi gerektiğini belirtiyoruz." },
        { kim: "hakim", metin: "Tarafların tanıkları bir sonraki celsede dinlenecek; SGK kayıtları getirtilecek, ardından dosya hesap bilirkişisine verilecektir." }
      ]
    },
    {
      tur: "karar",
      satirlar: [
        { kim: "hakim", metin: "Bu, eğitim amaçlı bir canlandırmadır; gerçek bir mahkeme kararı ya da hukuki görüş değildir." },
        { kim: "hakim", metin: "Dosyanın bu hâliyle sonuç büyük ölçüde feshin nasıl gerçekleştiğinin ispatına bağlıdır. Devamsızlık tutanağı ve yazılı savunma bulunmaması işveren açısından ciddi bir zayıflıktır; raporlu gün de devamsızlık sayılmayabilir. Tanık beyanları fesih bildirimini doğrularsa kıdem ve ihbar tazminatı taleplerinin kabulü değerlendirilebilir." },
        { kim: "hakim", metin: "Buna karşılık puantaj ve giriş-çıkış kayıtları birden fazla mazeretsiz devamsızlığı gösterirse haklı fesih savunması güç kazanabilir. Sonuç, tanıkların anlatımına ve bilirkişi raporuna bağlıdır. Somut işiniz için bir avukata danışın." }
      ]
    }
  ],
  uyari: "Eğitim amaçlı canlandırmadır, hukuki görüş değildir (1136 sayılı Avukatlık Kanunu m.35). Somut işiniz için bir avukata danışın."
};

export const ORNEK_DANISMA: Danisma = {
  id: "00000000-0000-4000-8000-000000000000", alan: "is", olay: ORNEK_SENARYO.ozet, deliller: "", karsi: "", talep: "", durum: "hazir",
  degerlendirme: null, canlandirma: null, senaryo: ORNEK_SENARYO, takip: [], kalan_takip: 0, created_at: "2026-11-04T10:00:00.000Z"
};
