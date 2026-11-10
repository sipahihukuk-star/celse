// danisma resmî hukuk kaynakları (ağ taklit edilir; gerçek sunucu, bedesten ve GitHub çağrılmaz; metinler uydurmadır):
// karar araması (mahkeme türü, daire, tarih), kodların aramadan çıkması, mevzuat araması (arşiv + resmî), kısaltmayla madde
// ("HMK 281"), belge metni (HTML → düz metin, önbellek), 429'da bir kez yeniden deneme, kanun arşivinin maddelere ayrılarak
// yüklenmesi ve değişmeyen kanunun atlanması, yönetici olmayanın yükleyememesi.
const ENV: Record<string, string> = { ANTHROPIC_API_KEY: "x", SUPABASE_URL: "https://t.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "s", SUPABASE_ANON_KEY: "a" };
(globalThis as Record<string, unknown>).Deno = { env: { get: (k: string) => ENV[k] }, serve: () => {} };
type Cagri = { url: string; method: string; body: string };
const cagrilar: Cagri[] = [];
let yonetici = true, bedesten429 = 0;
const onbellek = new Map<string, unknown>();
const kanunlar = new Map<string, Record<string, unknown>>();
const maddeler: Record<string, unknown>[] = [];
const arsiv = new Map<string, Record<string, unknown>>();
const mbelge = new Map<string, Record<string, unknown>>();
const MD = `# DENEME KANUNU (No. 9999)

> Resmî kaynak: https://mevzuat.adalet.gov.tr/mevzuat/1

---

DENEME KANUNU

Kanun
Numarası : 9999

Kabul
Tarihi : 12/1/2011

BİRİNCİ BÖLÜM

Genel Hükümler

Amaç

MADDE 1-
(1) Bu Kanunun amacı
denemedir.

Bilirkişi raporuna
itiraz

MADDE 2-
(1) Taraflar, raporun tebliğinden
itibaren iki hafta içinde itiraz edebilir.

(2) Ek süre verilebilir.

İKİNCİ BÖLÜM

Son Hükümler

GEÇİCİ MADDE 1-
(1) Geçiş hükmü.
`;
let isSirada = true;
let isPlan: Record<string, unknown>[] = [{ mahkeme: "YARGITAYKARARI", birim: "Hukuk Genel Kurulu", yil: 2025 }];
const UZUN = "Uydurma karar metni. ".repeat(60);
const js = (x: unknown, st = 200) => new Response(JSON.stringify(x), { status: st, headers: { "Content-Type": "application/json" } });
globalThis.fetch = (async (u: string | URL, o?: RequestInit) => {
  const url = decodeURIComponent(String(u)), method = o?.method || "GET", body = String(o?.body || "");
  cagrilar.push({ url, method, body });
  if (url.includes("/auth/v1/user")) return js({ id: "11111111-1111-1111-1111-111111111111" });
  if (url.includes("/rpc/yonetici_mi")) return js(yonetici);
  if (url.includes("/rpc/mevzuat_madde_getir")) { const a = JSON.parse(body); return js(a.p_no === "6100" && a.p_madde === "281" ? [{ slug: "6100-hmk", no: "6100", ad: "HUKUK MUHAKEMELERİ KANUNU", durum: "yururlukte", madde: "281", baslik: "Bilirkişi raporuna itiraz", metin: "(1) Taraflar..." }] : []); }
  if (url.includes("/rpc/mevzuat_ara")) return js([{ slug: "6100-hmk", no: "6100", ad: "HUKUK MUHAKEMELERİ KANUNU", durum: "yururlukte", madde: "281", baslik: "Bilirkişi raporuna itiraz", metin: "(1) Taraflar...", puan: 0.5 }]);
  if (url.includes("/rpc/mevzuat_belge_durumu")) return js([{ tur: "KHK", adet: mbelge.size, mb: 1 }]);
  if (url.includes("/rpc/mevzuat_belge_ara")) return js([...mbelge.values()].map(x => ({ ...x, bolum: "… «hal» …" })));
  if (url.includes("/rest/v1/mevzuat_belge")) {
    if (method === "GET") { const id = url.match(/id=eq\.([^&]+)/)?.[1]; if (id) return js(mbelge.has(id) ? [mbelge.get(id)] : []); const ids = (url.match(/id=in\.\((.*)\)/)?.[1] || "").split(",").map(x => x.replace(/"/g, "")); return js(ids.filter(x => mbelge.has(x)).map(id => ({ id }))); }
    const r = JSON.parse(body); if (!mbelge.has(r.id)) mbelge.set(r.id, r); return new Response(null, { status: 201 });
  }
  if (url.includes("/rpc/ictihat_durumu")) return js([{ karar: arsiv.size, mb: 1 }]);
  if (url.includes("/rpc/ictihat_ara")) return js([...arsiv.values()].map(x => ({ ...x, bolum: "… «bilirkişi» …", puan: 1 })));
  if (url.includes("/rpc/ictihat_is_anahtar")) return js(JSON.parse(body).p_anahtar === "gizli-anahtar-0123456789abcdef");
  if (url.includes("/rpc/ictihat_is_al")) return js(isSirada ? [{ plan: isPlan, i: 0, sayfa: 1, sinir_mb: 300 }] : []);
  if (url.includes("/rpc/")) return js(true);
  // HUDOC (AİHM) ve AYM karar bilgi bankası taklitleri
  if (url.includes("hudoc.echr.coe.int/app/query/results")) {
    const tek = /appno:"12345\/10"/.test(url);
    return js({ resultcount: tek ? 2 : 2, results: (tek ? [{ itemid: "001-900", docname: "CASE OF DENEME v. TURKEY", appno: "12345/10", kpdate: "2015-03-10T00:00:00", languageisocode: "ENG", doctypebranch: "CHAMBER" }, { itemid: "001-901", docname: "DENEME / TÜRKİYE DAVASI", appno: "12345/10", kpdate: "2015-03-10T00:00:00", languageisocode: "TUR", doctypebranch: "CHAMBER" }]
      : [{ itemid: "001-111", docname: "ÖRNEK / TÜRKİYE DAVASI", appno: "1111/11", kpdate: "2020-01-02T00:00:00", languageisocode: "TUR", doctypebranch: "GRANDCHAMBER" }, { itemid: "001-112", docname: "BAŞKA / FRANSA DAVASI", appno: "2222/12", kpdate: "2019-05-06T00:00:00", languageisocode: "TUR", doctypebranch: "CHAMBER" }]).map(c => ({ columns: c })) });
  }
  if (url.includes("hudoc.echr.coe.int/app/conversion")) return new Response("<div><p>" + UZUN + "</p></div>", { status: 200 });
  if (url.includes("kararlarbilgibankasi.anayasa.gov.tr/BB/2016/14951")) return new Response("<html><title>Ayşe Örnek Başvurusu</title><body><p>Karar Tarihi: 12/3/2020</p><p>" + UZUN + "</p></body></html>", { status: 200 });
  if (url.includes("kararlarbilgibankasi.anayasa.gov.tr/BB/")) return new Response("", { status: 404 });
  if (url.includes("kararlarbilgibankasi.anayasa.gov.tr/?page=")) return new Response(url.endsWith("page=1") ? '<a href="/BB/2016/14951">x</a> <a href="/BB/2016/14951">x</a> 1 Karar' : "", { status: 200 });
  if (url.includes("/rest/v1/ictihat_karar")) {
    if (method === "GET") { const id = url.match(/id=eq\.([^&]+)/)?.[1]; if (id) return js(arsiv.has(id) ? [arsiv.get(id)] : []); const ids = (url.match(/id=in\.\((.*)\)/)?.[1] || "").split(",").map(x => x.replace(/"/g, "")); return js(ids.filter(x => arsiv.has(x)).map(id => ({ id }))); }
    const r = JSON.parse(body); if (!arsiv.has(r.id)) arsiv.set(r.id, r); return new Response(null, { status: 201 });
  }
  if (url.includes("/rest/v1/hukuk_onbellek")) {
    if (method === "GET") { const k = url.match(/anahtar=eq\.(.+?)&select/)?.[1] || ""; return js(onbellek.has(k) ? [{ veri: onbellek.get(k), tarih: new Date().toISOString() }] : []); }
    const r = JSON.parse(body); onbellek.set(r.anahtar, r.veri); return new Response(null, { status: 201 });
  }
  if (url.includes("/rest/v1/mevzuat_kanun")) {
    if (method === "GET") return js([...kanunlar.values()].map(k => ({ slug: k.slug, sha: k.sha })));
    if (method === "POST") { const r = JSON.parse(body); kanunlar.set(r.slug, { ...(kanunlar.get(r.slug) || {}), ...r }); return new Response(null, { status: 201 }); }
    if (method === "PATCH") { const s = url.match(/slug=eq\.([^&]+)/)?.[1] || ""; kanunlar.set(s, { ...(kanunlar.get(s) || {}), ...JSON.parse(body) }); return new Response(null, { status: 204 }); }
  }
  if (url.includes("/rest/v1/mevzuat_madde")) {
    if (method === "DELETE") { const s = url.match(/slug=eq\.([^&]+)/)?.[1]; for (let i = maddeler.length - 1; i >= 0; i--) if (maddeler[i].slug === s) maddeler.splice(i, 1); return new Response(null, { status: 204 }); }
    maddeler.push(...JSON.parse(body)); return new Response(null, { status: 201 });
  }
  if (url.includes("raw.githubusercontent.com") && url.endsWith("indeks.json")) return js({ documents: [{ law_number: "9999", title: "DENEME KANUNU", type: "KANUN", path: "kanunlar/9999-deneme-kanunu", source_mevzuat_id: "1", content_sha256: "abc" }, { law_number: "765", title: "ESKİ KANUNUN YÜRÜRLÜKTEN KALDIRILMIŞ HÜKÜMLERİ", type: "MULGA", path: "kanunlar/765-eski", source_mevzuat_id: "2", content_sha256: "def" }] });
  if (url.includes("raw.githubusercontent.com")) return new Response(MD, { status: 200 });
  if (url.includes("bedesten.adalet.gov.tr")) {
    const h = (o?.headers || {}) as Record<string, string>;
    if (h.AdaletApplicationName !== "UyapMevzuat") return js({}, 400);
    if (bedesten429 > 0) { bedesten429--; return js({}, 429); }
    if (url.endsWith("/emsal-karar/searchDocuments")) return js({ data: { emsalKararList: [{ documentId: "1001", itemType: { name: "YARGITAYKARARI", description: "Yargıtay Kararı" }, birimAdi: "9. Hukuk Dairesi", esasNo: "2023/1", kararNo: "2024/2", kararTarihiStr: "12.03.2024", kararTarihi: "2024-03-12T00:00:00Z" }], total: 1, start: 0 }, metadata: { FMTY: "SUCCESS" } });
    if (url.endsWith("/emsal-karar/getDocumentContent")) return js({ data: { content: Buffer.from("<html><body><p>T.C.</p><p>YARGITAY</p><p>Davac&#305; vekili &amp; davalı</p></body></html>").toString("base64"), mimeType: "text/html", version: 1 }, metadata: { FMTY: "SUCCESS" } });
    if (url.endsWith("/mevzuat/getDocumentContent")) return js({ data: { content: Buffer.from("<p>OLAĞANÜSTÜ HAL KAPSAMINDA</p><p>Madde 1- Tedbirler.</p>").toString("base64"), mimeType: "text/html" }, metadata: { FMTY: "SUCCESS" } });
    if (url.endsWith("/mevzuat/searchDocuments")) return js({ data: { mevzuatList: [{ mevzuatId: "500", mevzuatNo: "696", mevzuatAdi: "OLAĞANÜSTÜ HAL KAPSAMINDA ... KANUN HÜKMÜNDE KARARNAME", mevzuatTur: { name: "KHK", description: "Kanun Hükmünde Kararname" }, resmiGazeteTarihi: "2017-12-24T00:00:00", resmiGazeteSayisi: "30280" }], total: 1 }, metadata: { FMTY: "SUCCESS" } });
  }
  return js([]);
}) as typeof fetch;

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };
const istek = (b: Record<string, unknown>) => new Request("https://x/functions/v1/danisma", { method: "POST", headers: { authorization: "Bearer eyJ.test", apikey: "a" }, body: JSON.stringify(b) });
const son = (p: string) => [...cagrilar].reverse().find(c => c.url.includes(p));

(async () => {
  const { handle } = await import("../supabase/functions/danisma/index");
  // Karar araması
  let r = await handle(istek({ action: "karar_ara", soz: "[GİZLİ-1] bilirkişi raporuna itiraz süresi", mahkeme: "YARGITAYKARARI", birim: "9. Hukuk Dairesi", bas: "2020-01-01" }));
  let j = await r.json();
  ok(r.status === 200 && j.kararlar.length === 1 && j.kararlar[0].url === "https://mevzuat.adalet.gov.tr/ictihat/1001" && j.kararlar[0].birim === "9. Hukuk Dairesi", "karar listesi: " + JSON.stringify(j).slice(0, 200));
  const gov = JSON.parse(son("/emsal-karar/searchDocuments")!.body);
  ok(gov.data.phrase === "bilirkişi raporuna itiraz süresi" && gov.data.itemTypeList.join() === "YARGITAYKARARI" && gov.data.birimAdi === "9. Hukuk Dairesi" && /^2020-01-01T/.test(gov.data.kararTarihiStart) && gov.applicationName === "UyapMevzuat", "istek gövdesi, kod aramadan çıktı: " + JSON.stringify(gov));
  const n = cagrilar.length;
  r = await handle(istek({ action: "karar_ara", soz: "[GİZLİ-1] bilirkişi raporuna itiraz süresi", mahkeme: "YARGITAYKARARI", birim: "9. Hukuk Dairesi", bas: "2020-01-01" }));
  ok(!cagrilar.slice(n).some(c => c.url.includes("bedesten")), "aynı arama önbellekten");
  r = await handle(istek({ action: "karar_ara", soz: "kira tespiti" }));
  ok(JSON.parse(son("/emsal-karar/searchDocuments")!.body).data.itemTypeList.length === 5, "mahkeme seçilmezse beş tür");
  bedesten429 = 1;
  r = await handle(istek({ action: "karar_ara", soz: "ıslah zamanaşımı" }));
  ok(r.status === 200, "429'da bir kez yeniden dener");
  bedesten429 = 2;
  r = await handle(istek({ action: "karar_ara", soz: "tapu iptal tescil" }));
  ok(r.status === 503 && /yoğun/.test((await r.json()).error), "iki kez 429: yoğun uyarısı");
  r = await handle(istek({ action: "karar_ara", soz: "10000000146 numaralı" }));
  ok(r.status === 422, "kimlik no reddedilir");
  // Belge
  r = await handle(istek({ action: "belge_getir", kaynak: "karar", id: "1001" }));
  j = await r.json();
  ok(/YARGITAY/.test(j.metin) && /Davacı vekili & davalı/.test(j.metin) && !/</.test(j.metin), "HTML düz metne: " + JSON.stringify(j.metin));
  // Mevzuat
  r = await handle(istek({ action: "mevzuat_bul", soz: "HMK 281" }));
  j = await r.json();
  ok(j.maddeler.length === 1 && j.maddeler[0].madde === "281" && JSON.parse(son("/rpc/mevzuat_madde_getir")!.body).p_no === "6100", "kısaltmayla madde: " + JSON.stringify(j.maddeler));
  ok(j.belgeler.length === 1 && j.belgeler[0].tur === "Kanun Hükmünde Kararname" && j.belgeler[0].rgTarih === "24.12.2017", "resmî mevzuat (KHK)");
  r = await handle(istek({ action: "mevzuat_bul", soz: "olağanüstü hal", tur: "KHK" }));
  j = await r.json();
  ok(!j.maddeler.length && JSON.parse(son("/mevzuat/searchDocuments")!.body).data.mevzuatTurList.join() === "KHK", "tür KHK: arşiv atlanır, resmî tür süzgeci");
  r = await handle(istek({ action: "mevzuat_bul", soz: "Türk Medeni Kanunu m. 166" }));
  ok(JSON.parse(son("/rpc/mevzuat_ara")!.body).p_soz === "Türk Medeni Kanunu m. 166", "bulunamayan madde: tam metin araması");
  // Arşiv yükleme
  yonetici = false;
  r = await handle(istek({ action: "mevzuat_yukle", bas: 0 }));
  ok(r.status === 403, "yönetici olmayan yükleyemez");
  yonetici = true;
  r = await handle(istek({ action: "mevzuat_yukle", bas: 0, adet: 8 }));
  j = await r.json();
  ok(j.bitti && j.degisen === 2 && j.toplam === 2, "iki kanun yüklendi: " + JSON.stringify(j));
  const d = maddeler.filter(x => x.slug === "9999-deneme-kanunu");
  ok(d.length === 3 && d[1].madde === "2" && d[1].baslik === "Bilirkişi raporuna itiraz" && d[1].metin === "(1) Taraflar, raporun tebliğinden itibaren iki hafta içinde itiraz edebilir.\n(2) Ek süre verilebilir.", "maddeler ve başlık: " + JSON.stringify(d[1]));
  ok(d[2].madde === "Geçici 1" && !/BÖLÜM|Son Hükümler/.test(String(d[1].metin)), "geçici madde, bölüm başlığı metne karışmaz");
  ok(kanunlar.get("9999-deneme-kanunu")?.sha === "abc" && kanunlar.get("9999-deneme-kanunu")?.durum === "yururlukte" && kanunlar.get("765-eski")?.durum === "mulga" && kanunlar.get("9999-deneme-kanunu")?.kabul === "2011-01-12", "künye, yürürlük, mülga");
  const m0 = cagrilar.filter(c => c.url.includes("raw.githubusercontent.com") && c.url.endsWith("metin.md")).length;
  r = await handle(istek({ action: "mevzuat_yukle", bas: 0 }));
  j = await r.json();
  ok(j.degisen === 0 && cagrilar.filter(c => c.url.includes("raw.githubusercontent.com") && c.url.endsWith("metin.md")).length === m0, "değişmeyen kanun atlanır");
  // İçtihat arşivi: açılan karar meta ile arşive girer, sonra arşivden okunur (servise gidilmez)
  r = await handle(istek({ action: "belge_getir", kaynak: "karar", id: "2002", meta: { mahkeme: "Yargıtay", birim: "9. Hukuk Dairesi", esas: "2023/5", karar: "2024/6", tarih: "12.03.2024" } }));
  ok(arsiv.get("2002")?.tarih === "2024-03-12" && arsiv.get("2002")?.birim === "9. Hukuk Dairesi" && arsiv.get("2002")?.kaynak === "acilan", "açılan karar arşive: " + JSON.stringify(arsiv.get("2002")).slice(0, 160));
  const n2 = cagrilar.length;
  r = await handle(istek({ action: "belge_getir", kaynak: "karar", id: "2002" }));
  j = await r.json();
  ok(j.arsiv && /YARGITAY/.test(j.metin) && !cagrilar.slice(n2).some(c => c.url.includes("bedesten")), "arşivdeki karar servise gitmeden");
  r = await handle(istek({ action: "karar_ara", soz: "bilirkişi", kaynak: "arsiv", mahkeme: "YARGITAYKARARI" }));
  j = await r.json();
  ok(j.arsiv && j.kararlar.length === 1 && j.kararlar[0].tarih === "12.03.2024" && /bilirkişi/.test(j.kararlar[0].bolum) && JSON.parse(son("/rpc/ictihat_ara")!.body).p_mahkeme === "Yargıtay", "arşivde arama: " + JSON.stringify(j).slice(0, 200));
  yonetici = false;
  r = await handle(istek({ action: "ictihat_yukle", mahkeme: "YARGITAYKARARI", birim: "Hukuk Genel Kurulu", yil: 2025, sayfa: 1 }));
  ok(r.status === 403, "içtihat yükleme yalnız yönetici");
  yonetici = true;
  r = await handle(istek({ action: "ictihat_yukle", mahkeme: "YARGITAYKARARI", birim: "Hukuk Genel Kurulu", yil: 2025, sayfa: 1 }));
  j = await r.json();
  const ara = JSON.parse(son("/emsal-karar/searchDocuments")!.body);
  ok(j.eklenen === 1 && j.bitti && arsiv.get("1001")?.kaynak === "yukleme" && arsiv.get("1001")?.mahkeme === "Yargıtay" && ara.data.birimAdi === "Hukuk Genel Kurulu" && /^2025-01-01/.test(ara.data.kararTarihiStart), "temel karar yüklendi: " + JSON.stringify(j) + " " + JSON.stringify(arsiv.get("1001")).slice(0, 120));
  r = await handle(istek({ action: "ictihat_yukle", mahkeme: "YARGITAYKARARI", birim: "Hukuk Genel Kurulu", yil: 2025, sayfa: 1 }));
  j = await r.json();
  ok(j.eklenen === 0 && j.atlanan === 1, "arşivdeki karar yeniden alınmaz");
  // Sunucuda zamanlanmış iş: anahtarsız çağrı reddedilir; anahtarla plan işlenir, ilerleme kaydedilir, iş biter.
  r = await handle(new Request("https://x/functions/v1/danisma", { method: "POST", body: JSON.stringify({ action: "ictihat_is" }) }));
  ok(r.status === 403, "zamanlanmış iş anahtarsız reddedilir");
  r = await handle(new Request("https://x/functions/v1/danisma", { method: "POST", headers: { "x-celse-is": "gizli-anahtar-0123456789abcdef" }, body: JSON.stringify({ action: "ictihat_is" }) }));
  j = await r.json();
  const kay = JSON.parse(son("/rpc/ictihat_is_kaydet")!.body), birak = JSON.parse(son("/rpc/ictihat_is_birak")!.body);
  ok(j.durum === "bitti" && kay.p_i === 1 && kay.p_sayfa === 1 && birak.p_durum === "bitti", "zamanlanmış iş planı bitirir: " + JSON.stringify(j) + " " + JSON.stringify(birak));
  // Zamanlanmış işte AİHM Türkçe çeviriler ve AYM bireysel başvuru adımları
  isPlan = [{ mahkeme: "AIHM_TR", birim: "", yil: 0 }, { mahkeme: "AYM_BB", birim: "", yil: 0 }];
  r = await handle(new Request("https://x/functions/v1/danisma", { method: "POST", headers: { "x-celse-is": "gizli-anahtar-0123456789abcdef" }, body: JSON.stringify({ action: "ictihat_is" }) }));
  j = await r.json();
  ok(j.durum === "bitti" && arsiv.get("aihm:001-111")?.mahkeme === "AİHM" && arsiv.get("aihm:001-111")?.esas === "1111/11" && arsiv.has("aihm:001-112") && arsiv.get("aym:BB/2016/14951")?.tarih === "2020-03-12", "AİHM ve AYM yüklemesi: " + JSON.stringify(j) + " " + [...arsiv.keys()].join(","));
  arsiv.delete("aym:BB/2016/14951");
  isSirada = false;
  r = await handle(new Request("https://x/functions/v1/danisma", { method: "POST", headers: { "x-celse-is": "gizli-anahtar-0123456789abcdef" }, body: JSON.stringify({ action: "ictihat_is" }) }));
  ok((await r.json()).bos === true, "sırada iş yoksa boş döner");
  // Karar doğrulama: künye birebir tutarsa resmî metin arşive; tutmazsa "yok".
  arsiv.delete("1001");
  r = await handle(istek({ action: "karar_dogrula", kunyeler: [{ mahkeme: "YARGITAYKARARI", birim: "9. Hukuk Dairesi", esas: "2023/1", karar: "2024/2" }, { mahkeme: "YARGITAYKARARI", birim: "9. Hukuk Dairesi", esas: "2023/999", karar: "2024/2" }] }));
  j = await r.json();
  ok(j.sonuc?.[0]?.durum === "dogru" && j.sonuc[0].id === "1001" && arsiv.get("1001")?.kaynak === "dogrulama" && j.sonuc[1]?.durum === "yok", "karar doğrulama: " + JSON.stringify(j).slice(0, 300));
  ok(JSON.parse(son("/emsal-karar/searchDocuments")!.body).data.phrase === "2024/2", "esas, sonra karar no ile aranır");
  // AYM ve AİHM künyesi doğrulama
  r = await handle(istek({ action: "karar_dogrula", kunyeler: [{ mahkeme: "AYM_BB", birim: "Bireysel Başvuru", esas: "2016/14951", karar: "" }, { mahkeme: "AYM_BB", birim: "", esas: "2016/99999", karar: "" }, { mahkeme: "AIHM", birim: "", esas: "12345/10", karar: "" }] }));
  j = await r.json();
  ok(j.sonuc?.[0]?.durum === "dogru" && arsiv.has("aym:BB/2016/14951") && j.sonuc[1]?.durum === "yok" && j.sonuc[2]?.durum === "dogru" && j.sonuc[2].id === "aihm:001-901", "AYM / AİHM doğrulama (Türkçe çeviri önce): " + JSON.stringify(j).slice(0, 400));
  // Diğer mevzuat arşivi
  r = await handle(istek({ action: "mevzuat_tur_yukle", tur: "KHK", sayfa: 1 }));
  j = await r.json();
  ok(j.eklenen === 1 && j.bitti && mbelge.get("500")?.tur === "KHK" && mbelge.get("500")?.rg_tarih === "2017-12-24" && mbelge.get("500")?.kaynak === "yukleme", "KHK arşive yüklendi: " + JSON.stringify(j) + " " + String(JSON.stringify(mbelge.get("500"))).slice(0, 160));
  ok(!JSON.parse(son("/mevzuat/searchDocuments")!.body).data.phrase && JSON.parse(son("/mevzuat/searchDocuments")!.body).data.mevzuatTurList[0] === "KHK", "türün bütün belgeleri listelenir");
  r = await handle(istek({ action: "mevzuat_bul", soz: "olağanüstü hal", tur: "KHK" }));
  j = await r.json();
  ok(j.arsivBelgeler?.length === 1 && j.arsivBelgeler[0].arsiv && j.arsivBelgeler[0].turKod === "KHK", "aramada arşiv belgeleri: " + JSON.stringify(j.arsivBelgeler));
  const n3 = cagrilar.length;
  r = await handle(istek({ action: "belge_getir", kaynak: "mevzuat", id: "500" }));
  j = await r.json();
  ok(j.arsiv && !cagrilar.slice(n3).some(c => c.url.includes("bedesten")), "arşivdeki mevzuat servise gitmeden");
  yonetici = false;
  r = await handle(istek({ action: "mevzuat_tur_yukle", tur: "KHK", sayfa: 1 }));
  ok(r.status === 403, "mevzuat yükleme yalnız yönetici");
  yonetici = true;
  if (fail) { console.log(`hukuk-kaynak-test: ${fail} hata`); process.exit(1); }
  console.log("hukuk-kaynak-test: tamam");
})();
