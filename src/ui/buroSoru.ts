// Büroya sor çağrısı: kaynak cihazda hazırlanıp kodlanır (buroSoruKaynak), danisma "genel_sor" ile sorulur, cevap cihazda açılır.
import { call } from "../data/danisma";
import { Foy } from "../data/foy";
import { unmask } from "../engine/mask";
import { buroSoruKaynagi } from "./buroSoruKaynak";

const SIZINTI = /(?<!\d[.,]?)[1-9]\d{10}(?![.,]?\d)|\bTR\s?\d{2}(?:\s?\d{4}){5}|[\w.+-]+@[\w-]+\.[\w.]+/i;

// Konuşmanın son birkaç sorusu cihazda (bellekte) tutulur; ekran değişse de sürer.
const sohbet: { soru: string; cevap: string }[] = [];

export async function buroyaSor(liste: Foy[], soru: string): Promise<{ ok: true; cevap: string; kaynaklar: { baslik: string; url: string }[] } | { ok: false; hata: string; vars?: Record<string, string | number> }> {
  const k = buroSoruKaynagi(liste, soru.trim(), sohbet.slice(-3));
  if (!k.dosya) return { ok: false, hata: "Henüz föy yok. Föy ekleyince bütün dosyalarınız hakkında soru sorabilirsiniz." };
  if (SIZINTI.test(k.buro + " " + k.soru)) return { ok: false, hata: "Dosyalarda gizlenmemiş kişisel veri (kimlik no, IBAN ya da e-posta) kalmış olabilir; soru gönderilmedi. Notlardan ya da işlerden bu bilgiyi çıkarın." };
  const r = await call<{ cevap: string; kaynaklar?: { baslik: string; url: string }[] }>("genel_sor", { buro: k.buro, soru: k.soru, gecmis: k.gecmis }, 180000);
  if (!r.ok) return { ok: false, hata: r.error, vars: r.vars as Record<string, string | number> | undefined };
  const cevap = unmask(r.data.cevap || "", k.map).trim();
  sohbet.push({ soru: soru.trim(), cevap }); if (sohbet.length > 6) sohbet.shift();
  return { ok: true, cevap, kaynaklar: r.data.kaynaklar || [] };
}
