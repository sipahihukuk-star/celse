// Ödeme bildirimi (Supabase Edge Function, Deno) · RevenueCat webhook'u.
// RevenueCat her satın alma, yenileme, iptal ve bitişte buraya POST eder; abonelik "abonelikler" tablosuna,
// "Derdini anlat" kredisi "derdini_kredi" tablosuna yazılır (surum7.sql'deki odeme_olayi_isle işleviyle, tek işlemde).
// Aynı olay iki kez gelirse (RevenueCat yeniden dener) ikincisi "odeme_olaylari" tablosu sayesinde yok sayılır.
// RevenueCat'teki kullanıcı kimliği (app_user_id) Supabase kullanıcı kimliğidir; uygulama girişte Purchases.logIn ile bağlar.
//
// Kurulum:
//  - Gizli anahtarlar (Supabase > Edge Functions > Secrets): REVENUECAT_WEBHOOK_AUTH (RevenueCat'te webhook'a yazılan
//    "Authorization header" değerinin aynısı). SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY Supabase'de hazır gelir.
//  - Fonksiyon JWT doğrulaması KAPALI kurulmalı (RevenueCat Supabase oturumu göndermez):
//    "supabase functions deploy odeme --no-verify-jwt" ya da panelde "Verify JWT" kapalı.
//  - RevenueCat > Integrations > Webhooks: adres https://<proje>.supabase.co/functions/v1/odeme, Authorization: aynı gizli değer.
// Not: panele yapıştırılırken bozulmasın diye kodda ters tırnak (şablon dizgisi) kullanılmadı.

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

// Uygulamadaki purchaseIds.ts ile aynı: tüketilebilir ürün → kredi.
const CREDITS: Record<string, number> = { celse_derdini_anlat_1: 1, celse_derdini_anlat_3: 3 };
const PRO_PRODUCTS = ["celse_pro_aylik", "celse_pro_yillik"];
const PRO_ENTITLEMENT = "themiscode_i_nc_pro"; // RevenueCat yetki kimliği (src/data/purchaseIds.ts ile aynı)

// RevenueCat mağaza adı → abonelikler.kaynak
const KAYNAK: Record<string, string> = {
  APP_STORE: "app_store", MAC_APP_STORE: "app_store", PLAY_STORE: "google_play", TEST_STORE: "test_store"
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Sabit sürede karşılaştırma (gizli değeri zamanlamayla tahmin etmeyi zorlaştırır).
function same(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] || 0) ^ (y[i] || 0);
  return d === 0;
}
const bare = (s: string) => s.replace(/^Bearer\s+/i, "").trim();

// Olaydaki Supabase kullanıcısı: anonim ($RCAnonymousID:) kimlikler atlanır; takma adlarda (aliases) da aranır.
function userOf(ev: Record<string, unknown>): string | null {
  const ids = [ev.app_user_id, ev.original_app_user_id, ...((ev.aliases as unknown[]) || [])].map(x => String(x || ""));
  return ids.find(id => id && !id.startsWith("$RCAnonymousID:") && UUID.test(id)) || null;
}

async function apply(p: Record<string, unknown>) {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY yok");
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  // Eski (JWT) servis anahtarı Authorization'da da gider; yeni sb_secret_ anahtarı yalnız apikey başlığında.
  if (key.startsWith("eyJ")) headers.Authorization = "Bearer " + key;
  const r = await fetch(url + "/rest/v1/rpc/odeme_olayi_isle", { method: "POST", headers: headers, body: JSON.stringify(p) });
  if (!r.ok) throw new Error("veritabanı " + r.status + " " + (await r.text()).slice(0, 300));
  return await r.json();
}

Deno.serve(async req => {
  if (req.method !== "POST") return json({ error: "yalnız POST" }, 405);
  const secret = Deno.env.get("REVENUECAT_WEBHOOK_AUTH") || "";
  if (!secret) return json({ error: "REVENUECAT_WEBHOOK_AUTH kurulmadı" }, 501);
  if (!same(bare(req.headers.get("authorization") || ""), bare(secret))) return json({ error: "yetki yok" }, 401);

  let ev: Record<string, unknown>;
  try { ev = ((await req.json()) || {}).event || {}; } catch (_e) { return json({ error: "geçersiz gövde" }, 400); }
  const tur = String(ev.type || "");
  const olay = String(ev.id || "");
  if (!olay || !tur) return json({ error: "olay kimliği yok" }, 400);
  if (tur === "TEST") return json({ ok: true, not: "deneme olayı" });

  const kullanici = userOf(ev);
  // Anonim satın alma Supabase hesabına bağlanamaz; 200 dönülür ki RevenueCat yeniden denemesin
  // (oyuncu giriş yapınca logIn ile birleşir ve RevenueCat yeni olaylar gönderir).
  if (!kullanici) return json({ ok: true, not: "anonim kullanıcı atlandı" });

  // Google Play abonelikleri "urun:temelplan" biçiminde gelir (ör. celse_pro_aylik:aylik); yalnız ürün kısmı kullanılır.
  const urun = String(ev.new_product_id || ev.product_id || "").split(":")[0];
  const ents = ((ev.entitlement_ids as unknown[]) || []).map(String);
  const pro = PRO_PRODUCTS.indexOf(urun) >= 0 || PRO_PRODUCTS.indexOf(String(ev.product_id || "").split(":")[0]) >= 0 || ents.indexOf(PRO_ENTITLEMENT) >= 0;
  const kredi = CREDITS[String(ev.product_id || "")] || 0;
  const exp = Number(ev.expiration_at_ms) || 0;
  const now = Date.now();

  let bitis: string | null = null, yenilenecek: boolean | null = null, krediFark = 0;
  switch (tur) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "PRODUCT_CHANGE":
    case "UNCANCELLATION":
    case "SUBSCRIPTION_EXTENDED":
      if (pro && exp) { bitis = new Date(exp).toISOString(); yenilenecek = true; }
      break;
    case "CANCELLATION":
      // Otomatik yenileme kapandı: dönem sonuna kadar Pro sürer. İade (CUSTOMER_SUPPORT) ise RevenueCat
      // bitişi iade anına çeker. Tüketilebilir ürün iadesinde kredi geri alınır.
      if (kredi) krediFark = -kredi;
      else if (pro) { bitis = new Date(exp || now).toISOString(); yenilenecek = false; }
      break;
    case "BILLING_ISSUE":
      // Ödeme alınamadı: mağazanın ek süresi varsa expiration_at_ms onu gösterir; yoksa dönem sonu korunur.
      if (pro && exp) { bitis = new Date(exp).toISOString(); yenilenecek = false; }
      break;
    case "EXPIRATION":
      if (pro) { bitis = new Date(Math.min(exp || now, now)).toISOString(); yenilenecek = false; }
      break;
    case "NON_RENEWING_PURCHASE":
      if (kredi) krediFark = kredi;
      else if (pro && exp) { bitis = new Date(exp).toISOString(); yenilenecek = false; }
      break;
    default:
      break; // TRANSFER, SUBSCRIPTION_PAUSED vb.: yalnız kaydedilir
  }

  try {
    const sonuc = await apply({
      p_olay_id: olay, p_tur: tur, p_kullanici: kullanici, p_urun: urun || null,
      p_kaynak: KAYNAK[String(ev.store || "")] || "revenuecat", p_ortam: String(ev.environment || "") || null,
      p_bitis: bitis, p_yenilenecek: yenilenecek, p_kredi: krediFark, p_ham: ev
    });
    return json({ ok: true, sonuc: sonuc });
  } catch (e) {
    // 500: RevenueCat olayı daha sonra yeniden gönderir.
    return json({ error: String(e) }, 500);
  }
});
