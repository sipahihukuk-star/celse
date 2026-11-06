// Etkin evrak oturumu: "Evrakla duruşma provası"ndan açılan oyun ya da canlandırma sürerken kodların gerçek karşılıkları (map)
// burada durur. Cihazdan çıkan her metin buradan geçer: yapay zekâ puanlamasına giden metin yeniden kodlanır, bulut seslendirmesine
// giden metinde adlar rol adıyla okunur. Böylece ekranda gerçek adlar görünür, hiçbir sunucuya gitmez.
import { geriKodla } from "./index";

let aktif: Record<string, string> | null = null;
export function setAktifMaske(map: Record<string, string> | null) { aktif = map && Object.keys(map).length ? map : null; }
export const aktifMaske = () => aktif;
/** Sunucudaki yapay zekâya giden metin. */
export const disariGiden = (s: string) => (aktif && s ? geriKodla(s, aktif, "kod") : s);
/** Seslendirmeye giden metin. */
export const sesliOkunan = (s: string) => (aktif && s ? geriKodla(s, aktif, "ses") : s);
