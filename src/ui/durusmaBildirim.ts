// Duruşma ve e-duruşma bildirimleri. Bildirim bu cihazda hesaplanır; dosya bilgisi sunucuya gitmez.
// Alıcı: büroda yöneticiler ve dosyanın sorumlusu (ya da föyde açık işi atanan çalışan); büro yoksa kullanıcının kendisi.
//  - Telefon: her konu için son günden 3 gün önce başlayarak her sabah 09:00'da (geçmişse ertesi sabahtan itibaren bir hafta)
//    yerel bildirim kurulur. Föyler değiştikçe plan yenilenir: kutu işaretlenince o konunun bildirimleri kalkar.
//    Yerel bildirim modülü telefondaki uygulama sürümünde yoksa (eski sürüm) sessizce geçilir.
//  - Bilgisayar (tarayıcı): bildirim izni verildiyse Celse her gün ilk açıldığında bekleyen konuları bildirir.
import { Platform } from "react-native";
import { buroUyeleri } from "../data/buro";
import { banaAit, DurusmaUyari, tumDurusmaUyarilari } from "../data/durusma";
import { Foy, foyBaslik, tarihYaz } from "../data/foy";

type Bildirimler = typeof import("expo-notifications");
let modul: Bildirimler | null | undefined;
function bildirimModulu(): Bildirimler | null {
  if (modul !== undefined) return modul;
  if (Platform.OS === "web") return (modul = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    modul = require("expo-notifications") as Bildirimler;
    modul.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
  } catch { modul = null; }
  return modul;
}

async function benimUyarilarim(liste: Foy[]): Promise<DurusmaUyari[]> {
  const b = await buroUyeleri().catch(() => ({ ben: undefined, uyeler: [] as { kullanici_id: string; yetki: string }[] }));
  const benU = b.uyeler.find(u => u.kullanici_id === b.ben);
  const ben = benU ? { uid: benU.kullanici_id, yonetici: benU.yetki === "yonetici" } : null;
  return tumDurusmaUyarilari(liste).filter(u => banaAit(u.f, ben));
}
const govde = (u: DurusmaUyari) => `${foyBaslik(u.f)}${u.d ? " · " + tarihYaz(u.d.tarih) : ""}: ${u.metin}`;

let sonPlan = "";
/** Telefonda yerel bildirimleri yeniden kurar (en çok 60). */
export async function telefonBildirimPlanla(liste: Foy[]) {
  const N = bildirimModulu();
  if (!N) return;
  try {
    const us = await benimUyarilarim(liste);
    const plan: { tarih: Date; baslik: string; govde: string }[] = [];
    const simdi = new Date();
    for (const u of us) {
      const son = new Date(u.sonGun + "T09:00:00");
      const ilk = u.bas ? new Date(u.bas + "T09:00:00") : new Date(son.getTime() - 3 * 86400000);
      const bas = ilk > simdi ? ilk : new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate() + (simdi.getHours() >= 9 ? 1 : 0), 9, 0, 0);
      const bit = son > bas ? son : new Date(bas.getTime() + 6 * 86400000);
      for (let d = new Date(bas); d <= bit && plan.length < 60; d = new Date(d.getTime() + 86400000))
        plan.push({ tarih: d, baslik: u.tur === "eKarar" ? "Celse · E-duruşma kararı yok" : u.kalan < 0 ? "Celse · Gecikti" : "Celse · Duruşma", govde: govde(u) });
    }
    const imza = JSON.stringify(plan.map(p => [p.tarih.getTime(), p.govde]));
    if (imza === sonPlan) return;
    sonPlan = imza;
    await N.cancelAllScheduledNotificationsAsync();
    if (!plan.length) return;
    const izin = await N.getPermissionsAsync();
    if (!izin.granted && !(await N.requestPermissionsAsync()).granted) return;
    if (Platform.OS === "android") await N.setNotificationChannelAsync("durusma", { name: "Duruşma ve e-duruşma", importance: N.AndroidImportance.HIGH });
    for (const p of plan.sort((a, b) => a.tarih.getTime() - b.tarih.getTime()).slice(0, 60))
      await N.scheduleNotificationAsync({ content: { title: p.baslik, body: p.govde }, trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: p.tarih, channelId: "durusma" } });
  } catch { /* bildirim kurulamazsa uygulama çalışmaya devam eder */ }
}

/** Tarayıcıda günde bir kez: bekleyen duruşma konuları. */
export async function webDurusmaBildirimi(liste: Foy[]) {
  try {
    const N = (globalThis as unknown as { Notification?: { permission: string; new (b: string, o: object): unknown } }).Notification;
    if (!N || N.permission !== "granted") return;
    const d = new Date(), bugun = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    // Duruşmaya iki gün ya da daha az kalmışken e-duruşma kararı yoksa: üç saatte bir yeniden bildirilir.
    const acil = (await benimUyarilarim(liste)).filter(u => u.tur === "eKarar" && u.kalan <= 0);
    const sonAcil = Number(globalThis.localStorage?.getItem("celse-edurusma-acil") || 0);
    if (acil.length && Date.now() - sonAcil > 3 * 3600000) {
      globalThis.localStorage?.setItem("celse-edurusma-acil", String(Date.now()));
      new N("Celse · E-duruşma kararı yok!", { body: acil.slice(0, 4).map(govde).join("\n") });
    }
    if (globalThis.localStorage?.getItem("celse-durusma-bildirim-gun") === bugun) return;
    const us = await benimUyarilarim(liste);
    if (!us.length) return;
    globalThis.localStorage?.setItem("celse-durusma-bildirim-gun", bugun);
    new N("Celse · Duruşma ve e-duruşma", { body: us.slice(0, 4).map(govde).join("\n") + (us.length > 4 ? `\n+${us.length - 4} konu daha` : "") });
  } catch { /* bildirim yoksa geç */ }
}
