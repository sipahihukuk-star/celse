// Maskeleme sözlükleri: yaygın Türkçe adlar ve il adları. Ad sözlüğü, metinde taraf olarak yazılmamış kişileri (tanık, hâkim,
// bilirkişi, üçüncü kişi) yakalamak içindir: sözlükteki bir adı büyük harfle başlayan bir ya da iki sözcük izliyorsa kişi adı sayılır.
// Liste tam değildir; kaçan adları avukat onay ekranında elle ekler.

const ERKEK = `Abdullah Abdurrahman Adem Adil Adnan Ahmet Akın Ali Alp Alper Alperen Arda Arif Aslan Atakan Atilla Ayhan Aziz Bahadır Baran
Barış Battal Batuhan Bayram Bekir Berat Berk Berkay Bilal Bora Bülent Burak Burhan Cafer Can Celal Cem Cemal Cemil Cengiz Cihan Coşkun
Cumali Cüneyt Çağatay Çağlar Çetin Davut Deniz Doğan Doğukan Durmuş Ece Efe Ekrem Emin Emir Emirhan Emrah Emre Ender Engin Enes Enver
Erdal Erdem Erdoğan Eren Erhan Erkan Ersin Ertan Ertuğrul Eyüp Fatih Faruk Fehmi Ferhat Ferit Fethi Fevzi Fikret Furkan Gökhan Gökay
Güray Gürkan Hakan Halil Hamdi Hamza Hasan Haydar Hayri Hikmet Hilmi Hüseyin Hüsnü İbrahim İhsan İlhan İlker İlyas İrfan İsa İsmail
İsmet İzzet Kadir Kamil Kaan Kemal Kenan Kerem Kerim Koray Kudret Levent Mahir Mahmut Mehmet Melih Mert Mesut Metin Mithat Muammer
Muhammed Muharrem Murat Musa Mustafa Muzaffer Necati Necdet Necip Nedim Nevzat Nihat Nuri Nurettin Oğuz Oğuzhan Okan Onur Orhan Osman
Ozan Ömer Önder Özcan Özgür Özkan Polat Ramazan Rasim Recep Refik Remzi Reşat Rıza Rıdvan Sabri Sadık Sait Salih Sami Sarp Sebahattin
Sedat Selahattin Selami Selçuk Selim Semih Serdar Serhat Serkan Sezai Sezer Sinan Suat Süleyman Şahin Şükrü Şenol Şevket Tahir Talha
Tamer Tanju Taner Tarık Tayfun Tayyip Tekin Tolga Tuncay Tuncer Turan Turgay Turgut Tuğrul Tunahan Uğur Ufuk Umut Ümit Vedat Veli Volkan
Yahya Yakup Yasin Yaşar Yavuz Yılmaz Yiğit Yunus Yusuf Yüksel Zafer Zeki Ziya`;

const KADIN = `Adalet Ahu Aleyna Arzu Asiye Aslı Aybüke Ayça Aydan Ayfer Aygül Ayla Aylin Ayse Ayşe Ayşegül Aysel Aysun Ayten Bahar Banu Begüm
Belgin Berna Betül Beyza Burcu Büşra Canan Cansu Ceren Cemile Damla Defne Derya Dilan Dilek Dilara Duygu Ebru Ece Eda Elif Elçin Emel
Emine Esin Esma Esra Ezgi Fadime Fatma Fatoş Feride Fidan Filiz Funda Gamze Gizem Gonca Gökçe Gönül Gül Gülay Gülcan Gülşen Gülten
Hacer Hale Halime Hande Hanife Hatice Havva Hayriye Hilal Hülya Irmak Işıl Hümeyra İlknur İpek İrem Kader Kevser Kübra Lale Leyla
Makbule Medine Melek Melike Meltem Melis Merve Meryem Mine Müge Münevver Nalan Nazlı Nergis Neslihan Nesrin Nevin Nihal Nilay Nilgün
Nur Nuray Nurcan Nurgül Nurhan Oya Özge Özlem Pelin Pınar Rabia Rukiye Saadet Sabiha Seda Sedef Selda Selin Selma Semra Serap Serpil
Sevda Sevgi Sevil Sevim Sevinç Sibel Simge Songül Suna Şenay Şerife Şeyma Şükran Tuba Tuğba Tülay Tülin Türkan Ümran Ümmühan Yasemin
Yeliz Yeşim Yıldız Zehra Zeliha Zerrin Zeynep Züleyha`;

export const ADLAR = new Set((ERKEK + " " + KADIN).split(/\s+/).filter(Boolean).map(a => a.toLocaleLowerCase("tr")));

export const ILLER = `Adana Adıyaman Afyonkarahisar Ağrı Aksaray Amasya Ankara Antalya Ardahan Artvin Aydın Balıkesir Bartın Batman Bayburt Bilecik
Bingöl Bitlis Bolu Burdur Bursa Çanakkale Çankırı Çorum Denizli Diyarbakır Düzce Edirne Elazığ Erzincan Erzurum Eskişehir Gaziantep
Giresun Gümüşhane Hakkari Hatay Iğdır Isparta İstanbul İzmir Kahramanmaraş Karabük Karaman Kars Kastamonu Kayseri Kırıkkale Kırklareli
Kırşehir Kilis Kocaeli Konya Kütahya Malatya Manisa Mardin Mersin Muğla Muş Nevşehir Niğde Ordu Osmaniye Rize Sakarya Samsun Siirt
Sinop Sivas Şanlıurfa Şırnak Tekirdağ Tokat Trabzon Tunceli Uşak Van Yalova Yozgat Zonguldak`.split(/\s+/).filter(Boolean);

/** Kişi değil kurum: kamu kurumu ve tüzel kişi adlarında geçen sözcükler (maskelenmez; şirketler ayrıca kodlanır). */
export const KURUM = /Bakanlığı|Bakanlık|Başkanlığı|Müdürlüğü|Belediye|Hazine|Kurumu|Kurulu|Üniversitesi|Valiliği|Kaymakamlığı|Başsavcılığı|Savcılığı|Genel Müdürlük|Cumhurbaşkanlığı|Komutanlığı|Odası|Barosu|Birliği|Bankası/;
export const SIRKET = /A\.\s?Ş\.|Anonim Şirketi|Ltd\.?\s?Şti\.|Limited Şirketi|Holding|Kooperatifi/;
