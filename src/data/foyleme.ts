// Föyleme sohbetinin sunucu çağrısı; kodlama foylemeKod.ts'de (cihazda, yan etkisiz).
import { call } from "./danisma";
import type { FoyleIslem } from "./foylemeKod";
export { geriAc, kodlaDurum } from "./foylemeKod";
export type { FoyleIslem, Kodlama } from "./foylemeKod";

export async function foyleSor(durum: string, mesaj: string, gecmis: string[]) {
  return call<{ cevap: string; islemler: FoyleIslem[] }>("foyle", { durum, mesaj, gecmis: gecmis.slice(-12) }, 90000);
}
