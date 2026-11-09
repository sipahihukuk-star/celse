// danisma kaynak_ara ve beyan_yaz (ağ taklit edilir; gerçek sunucu ve yapay zekâ çağrılmaz, veriler uydurmadır):
// aramada gerçekten bulunmayan bağlantılı (uydurma) kaynak elenir; doktrinde genel özet döner; kodlanmamış kimlik no reddedilir.
const ENV: Record<string, string> = { ANTHROPIC_API_KEY: "x", SUPABASE_URL: "https://t.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "s", SUPABASE_ANON_KEY: "a" };
(globalThis as Record<string, unknown>).Deno = { env: { get: (k: string) => ENV[k] }, serve: () => {} };
let sonIstek: Record<string, unknown> | null = null;
let modelCevabi: unknown = null;
globalThis.fetch = (async (u: string | URL, o?: RequestInit) => {
  const url = String(u);
  const js = (x: unknown) => new Response(JSON.stringify(x), { status: 200, headers: { "Content-Type": "application/json" } });
  if (url.includes("/auth/v1/user")) return js({ id: "11111111-1111-1111-1111-111111111111" });
  if (url.includes("/rpc/yonetici_mi")) return js(true);
  if (url.includes("/rpc/")) return js(true);
  if (url.includes("api.anthropic.com")) { sonIstek = JSON.parse(String(o?.body || "{}")); return js(modelCevabi); }
  return js([]);
}) as typeof fetch;

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const istek = (b: Record<string, unknown>) => new Request("https://x/functions/v1/danisma", { method: "POST", headers: { authorization: "Bearer eyJ.test", apikey: "a" }, body: JSON.stringify(b) });

(async () => {
  const { handle } = await import("../supabase/functions/danisma/index");
  const A = "https://karararama.yargitay.gov.tr/karar/12345";
  modelCevabi = { content: [
    { type: "server_tool_use", id: "t1", name: "web_search", input: { query: "bilirkişi raporuna itiraz süresi" } },
    { type: "web_search_tool_result", tool_use_id: "t1", content: [{ type: "web_search_result", url: A, title: "Yargıtay kararı" }] },
    { type: "text", text: "Buldum.\n{\"kaynaklar\": [{\"kunye\": \"Yargıtay 9. HD, 2020/1 E., 2020/2 K.\", \"ozet\": \"İki haftalık süre.\", \"alinti\": \"\", \"url\": \"" + A + "\"}, {\"kunye\": \"Yargıtay 3. HD, 2099/9 E.\", \"ozet\": \"Uydurma.\", \"url\": \"https://karararama.yargitay.gov.tr/karar/99999\"}], \"genel\": \"\"}" }
  ] };
  let r = await handle(istek({ action: "kaynak_ara", tur: "ictihat", konu: "bilirkişi raporuna itiraz süresi, [GİZLİ-1] dosyası" }));
  let j = await r.json();
  ok(r.status === 200 && j.kaynaklar.length === 1 && j.kaynaklar[0].url === A, "uydurma kaynak elenir: " + JSON.stringify(j).slice(0, 200));
  const tools = (sonIstek as { tools?: { allowed_domains: string[] }[] } | null)?.tools;
  ok(!!tools && tools[0].allowed_domains.includes("karararama.yargitay.gov.tr") && !tools[0].allowed_domains.includes("dergipark.org.tr"), "içtihatta yalnız karar siteleri");

  modelCevabi = { content: [{ type: "text", text: "{\"kaynaklar\": [], \"genel\": \"Doktrinde baskın görüş...\"}" }] };
  r = await handle(istek({ action: "kaynak_ara", tur: "doktrin", konu: "ıslahın sınırları" }));
  j = await r.json();
  ok(j.kaynaklar.length === 0 && /baskın görüş/.test(j.genel), "doktrin genel özet");
  ok(((sonIstek as { tools?: { allowed_domains: string[] }[] }).tools || [])[0].allowed_domains.includes("dergipark.org.tr"), "doktrinde DergiPark");

  r = await handle(istek({ action: "kaynak_ara", tur: "mevzuat", konu: "müvekkil 10000000146 kimlik" }));
  ok(r.status === 422, "kodlanmamış kimlik no reddedilir: " + r.status);

  modelCevabi = { content: [{ type: "text", text: "Yukarıda numarası yazılı dosyada beyanlarımızı sunarız.\nAÇIKLAMALAR\n1- [GİZLİ-1] ..." }] };
  r = await handle(istek({ action: "beyan_yaz", dosya: "=== KÜNYE ===\nDosya türü: Hukuk", tur: "Bilirkişi raporuna itiraz", talimat: "kusur oranına itiraz et", kaynaklar: "Yargıtay 9. HD, 2020/1 E." }));
  j = await r.json();
  ok(r.status === 200 && /AÇIKLAMALAR/.test(j.metin), "beyan gövdesi döner");
  const m = (sonIstek as { messages: { content: string }[]; system: string }).messages[0].content;
  ok(/Bilirkişi raporuna itiraz/.test(m) && /kusur oranına itiraz et/.test(m) && /Yargıtay 9\. HD/.test(m), "talimat, tür ve kaynaklar modele gider");
  if (fail) { console.log(`kaynak-ara-test: ${fail} hata`); process.exit(1); }
  console.log("kaynak-ara-test: tamam");
})();
