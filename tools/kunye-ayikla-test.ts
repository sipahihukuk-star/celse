// Karar künyesi ayıklama: makale / blog dilinde yazılmış künyelerden mahkeme, daire, esas ve karar numarası.
import { kunyeleriAyikla, kunyeYaz } from "../src/data/kunyeAyikla";
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const metin = `Nitekim Yargıtay 9. HD, 2019/1234 E., 2020/567 K. sayılı kararında işçinin fazla çalışma alacağı ele alınmıştır.
Yargıtay Hukuk Genel Kurulu'nun 15.03.2017 tarihli, E. 2015/123, K. 2017/456 sayılı kararı da aynı yöndedir (bkz. Yargıtay HGK 2015/123 E., 2017/456 K.).
Danıştay 6. Daire, E: 2019/123, K: 2020/45 kararında imar planı iptal edilmiştir. Danıştay İDDK 2018/2222 E. , 2021/3333 K.
Yargıtay 12. Ceza Dairesi'nin 2021/00789 Esas, 2022/1011 Karar sayılı ilamı. YİBK 2019/1 E., 2020/2 K.
Ayrıca 2023/55 esas sayılı dosya (mahkemesi yazılmamış) ile 15/2020 gibi sayılar künye değildir.`;
const xs = kunyeleriAyikla(metin);
const yaz = xs.map(kunyeYaz);
const bekle = [
  "Yargıtay 9. Hukuk Dairesi, E. 2019/1234, K. 2020/567",
  "Yargıtay Hukuk Genel Kurulu, E. 2015/123, K. 2017/456",
  "Danıştay 6. Daire, E. 2019/123, K. 2020/45",
  "Danıştay İdare Dava Daireleri Kurulu, E. 2018/2222, K. 2021/3333",
  "Yargıtay 12. Ceza Dairesi, E. 2021/789, K. 2022/1011",
  "Yargıtay Büyük Genel Kurulu, E. 2019/1, K. 2020/2"
];
ok(JSON.stringify(yaz) === JSON.stringify(bekle), "künyeler:\n  " + yaz.join("\n  "));
ok(xs.every(x => x.metin.length > 10), "künyenin geçtiği metin");
ok(kunyeleriAyikla("Yargıtay 3. HD 2024/77 E.").map(kunyeYaz)[0] === "Yargıtay 3. Hukuk Dairesi, E. 2024/77", "karar numarasız künye");
if (fail) { console.log(`kunye-ayikla-test: ${fail} hata`); process.exit(1); }
console.log("kunye-ayikla-test: tamam");
