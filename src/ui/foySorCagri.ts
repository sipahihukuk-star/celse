// Föy hakkında yapay zekâya soru: dosya cihazda kodlanır, kodlu hâli gider, cevap gerçek adlarla açılır (föy ekranı ve sesli asistan).
import { call } from "../data/danisma";
import { Foy, yeniId, YzSoru } from "../data/foy";
import { turBilgi } from "../data/foyTurleri";
import { faizOranMetni } from "../data/icra";
import { unmask } from "../engine/mask";
import { foySoruKaynagi } from "./foyEvrak";

const SIZINTI = /(?<!\d[.,]?)[1-9]\d{10}(?![.,]?\d)|\bTR\s?\d{2}(?:\s?\d{4}){5}|[\w.+-]+@[\w-]+\.[\w.]+/i;

export async function foyaSor(f: Foy, soru: string): Promise<{ ok: true; yeni: YzSoru } | { ok: false; hata: string; vars?: Record<string, string | number> }> {
  const gecmis = (f.yzSohbet || []).slice(-4).map(y => ({ soru: y.soru, cevap: y.cevap }));
  const k = foySoruKaynagi(f, soru.trim(), gecmis, turBilgi(f.tur).ad);
  if (SIZINTI.test(k.dosya + " " + k.soru)) return { ok: false, hata: "Dosyada gizlenmemiş kişisel veri (kimlik no, IBAN ya da e-posta) kalmış olabilir; soru gönderilmedi. Notlardan ya da evraktan bu bilgiyi çıkarın." };
  const r = await call<{ cevap: string; kaynaklar?: { baslik: string; url: string }[] }>("foy_sor", { dosya: k.dosya + "\n\n" + faizOranMetni(), soru: k.soru, gecmis: k.gecmis, arama: true, akis: true }, 300000);
  if (!r.ok) return { ok: false, hata: r.error, vars: r.vars as Record<string, string | number> | undefined };
  return { ok: true, yeni: { id: yeniId("s"), tarih: new Date().toISOString(), soru: soru.trim(), cevap: unmask(r.data.cevap || "", k.map).trim(), kaynaklar: r.data.kaynaklar || [] } };
}
