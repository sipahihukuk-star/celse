// Büro asıl dosyaları: kurucunun bilgisayarındaki PDF şifrelenip büro bulutuna gider, sekreter açınca iner ve çözülür. Sahte (bellekte) sunucu; gerçek Supabase'e gidilmez.
// Kural ve yetkilerin sunucu tarafı ayrıca gerçek Postgres'te denenir (tools/buro-sql-test.mjs, isteğe bağlı).
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */
const Module = require("module");
const path = require("path");
const yukle = Module._load;
const { IDBFactory } = require("fake-indexeddb");
const idb: Record<string, unknown> = {};
const kova = new Map<string, Uint8Array>();
let aktif = "A";
const depolar: Record<string, Map<string, string>> = {};
const oturumlar: Record<string, string> = {};
// ── Sahte sunucu ──
const tablo: Record<string, any[]> = { foy_bulut: [], foy_bulut_anahtar: [], buro: [], buro_uye: [], buro_davet: [], buro_foy: [] };
let saat = Date.parse("2026-11-09T10:00:00Z");
const anlik = () => new Date(saat += 1000).toISOString();
function sorgu(uid: string, ad: string) {
  const f: ((x: any) => boolean)[] = [];
  let sira: [string, boolean] | null = null, sinir = 1e9, tek: "" | "may" | "single" = "", islem: any = { t: "select" };
  const uye = (b: string) => tablo.buro_uye.find(x => x.buro_id === b && x.kullanici_id === uid);
  const gorur = (x: any) => ad.startsWith("buro_foy") || ad === "buro_davet" || ad === "buro_uye" ? !!uye(x.buro_id) : ad === "buro" ? !!uye(x.id) : x.kullanici_id === undefined || x.kullanici_id === uid;
  const q: any = {
    select() { return q; }, eq(c: string, v: any) { f.push(x => x[c] === v); return q; }, neq(c: string, v: any) { f.push(x => x[c] !== v); return q; },
    gt(c: string, v: any) { f.push(x => x[c] > v); return q; }, order(c: string, o?: any) { sira = [c, o?.ascending !== false]; return q; }, limit(n: number) { sinir = n; return q; },
    maybeSingle() { tek = "may"; return q; }, single() { tek = "single"; return q; },
    insert(o: any) { islem = { t: "insert", o }; return q; }, upsert(rows: any[], o: any) { islem = { t: "upsert", rows, keys: o.onConflict.split(",") }; return q; },
    update(o: any) { islem = { t: "update", o }; return q; }, delete() { islem = { t: "delete" }; return q; },
    then(ok: any, no: any) { return Promise.resolve(calistir()).then(ok, no); }
  };
  function calistir(): any {
    const T = tablo[ad];
    if (islem.t === "insert") { for (const o of [].concat(islem.o)) T.push({ id: "id" + Math.random(), son: new Date(saat + 7 * 864e5).toISOString(), olusturma: anlik(), ...(o as any) }); return { data: null, error: null }; }
    if (islem.t === "upsert") {
      for (const r of islem.rows) {
        if (ad === "buro_foy") { const u = uye(r.buro_id); if (!u) return { error: { message: "row-level security" } }; if (r.silindi && !["yonetici", "sil"].includes(u.yetki)) return { error: { message: "Bu ünvanın föy silme yetkisi yok." } }; }
        const i = T.findIndex(x => islem.keys.every((k: string) => x[k] === r[k]));
        const y = { ...r, degisim: anlik(), yazan: uid };
        if (i >= 0) T[i] = y; else T.push(y);
      }
      return { data: null, error: null };
    }
    let xs = T.filter(gorur).filter(x => f.every(g => g(x)));
    if (islem.t === "update") { xs.forEach(x => Object.assign(x, islem.o)); return { data: null, error: null }; }
    if (islem.t === "delete") { tablo[ad] = T.filter(x => !xs.includes(x)); return { data: null, error: null }; }
    if (sira) { const [c, a] = sira; xs = [...xs].sort((p, r) => (p[c] < r[c] ? -1 : p[c] > r[c] ? 1 : 0) * (a ? 1 : -1)); }
    xs = xs.slice(0, sinir).map(x => ({ ...x }));
    return tek ? { data: xs[0] || null, error: tek === "single" && !xs[0] ? { message: "yok" } : null } : { data: xs, error: null };
  }
  return q;
}
const sahte = () => {
  const uid = oturumlar[aktif];
  return {
    auth: { getSession: async () => ({ data: { session: { user: { id: uid } } } }) },
    from: (t: string) => sorgu(uid, t),
    storage: { from: (k: string) => ({
      upload: async (yol: string, b: Blob) => { const bu = tablo.buro_uye.find(x => x.kullanici_id === uid && yol.startsWith(x.buro_id + "/")); if (k !== "buro-evrak" || !bu) return { error: { message: "new row violates row-level security policy" } }; kova.set(yol, new Uint8Array(await b.arrayBuffer())); return { error: null }; },
      download: async (yol: string) => { const bu = tablo.buro_uye.find(x => x.kullanici_id === uid && yol.startsWith(x.buro_id + "/")); const v = kova.get(yol); return bu && v ? { data: new Blob([v]), error: null } : { data: null, error: { message: "Object not found" } }; },
      remove: async (yollar: string[]) => { for (const y of yollar) kova.delete(y); return { error: null }; }
    }) },
    rpc: async (fn: string, a: any) => {
      if (fn === "buro_kur") {
        const id = "buro-" + Math.random().toString(36).slice(2);
        tablo.buro.push({ id, ad: a.p_ad, kurucu: uid });
        tablo.buro_uye.push({ buro_id: id, kullanici_id: uid, ad: a.p_benim_adim, unvan: "Kurucu avukat", yetki: "yonetici", anahtar_iv: a.p_anahtar_iv, anahtar_veri: a.p_anahtar_veri, katilma: anlik() });
        return { data: id, error: null };
      }
      if (fn === "buro_davet_kabul") {
        const d = tablo.buro_davet.find(x => x.kod_ozet === a.p_kod_ozet);
        if (!d) return { data: null, error: { message: "Davet kodu geçersiz ya da süresi dolmuş." } };
        tablo.buro_uye.push({ buro_id: d.buro_id, kullanici_id: uid, ad: a.p_ad || d.ad, unvan: d.unvan, yetki: d.yetki, anahtar_iv: "", anahtar_veri: "", katilma: anlik() });
        tablo.buro_davet = tablo.buro_davet.filter(x => x !== d);
        return { data: { buro_id: d.buro_id, tuz: d.tuz, iv: d.iv, veri: d.veri, unvan: d.unvan, yetki: d.yetki }, error: null };
      }
      return { data: null, error: { message: "yok: " + fn } };
    }
  };
};
Module._load = function (req: string, parent: any, ...a: any[]) {
  if (req === "@react-native-async-storage/async-storage") {
    const m = (depolar[aktif] = depolar[aktif] || new Map());
    return { default: { getItem: async (k: string) => m.get(k) ?? null, setItem: async (k: string, v: string) => { m.set(k, v); }, removeItem: async (k: string) => { m.delete(k); } }, __esModule: true };
  }
  if (req === "./account") return { supabase: sahte };
  if (/^(react-native|@react-native|expo|@expo)/.test(req)) return new Proxy({}, { get: () => () => ({}) });
  return yukle.call(this, req, parent, ...a);
};
const src = path.join(__dirname, "../src/");
function cihaz(ad: string) {
  aktif = ad;
  (globalThis as any).indexedDB = idb[ad] = idb[ad] || new IDBFactory();
  for (const k of Object.keys(require.cache)) if (k.startsWith(src)) delete require.cache[k];
  return { foy: require("../src/data/foy"), bulut: require("../src/data/foyBulut"), buro: require("../src/data/buro"), ad };
}
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };

(async () => {
  oturumlar.A = "uid-a"; oturumlar.S = "uid-s";
  let A = cihaz("A");
  const f1 = A.foy.bosFoy({ muvekkil: "Uydurma Müvekkil", mahkeme: "Uydurma 1. Asliye Hukuk", esasNo: "2025/1", evraklar: [{ id: "e1", ad: "karar.pdf", boyut: 20, eklenme: "2026-11-01T00:00:00Z", metin: "uydurma karar metni" }] });
  await A.foy.foyKaydet(f1);
  const pdf = new Blob([new TextEncoder().encode("%PDF-1.4 uydurma içerik")], { type: "application/pdf" });
  await A.foy.dosyaYaz("e1", pdf);
  await A.bulut.bulutKur("a-esitleme-sifresi");
  await A.buro.buroKur("Uydurma Hukuk Bürosu", "Av. A");
  const dA = await A.buro.buroDurumu();
  const kod = await A.buro.davetOlustur(dA.b.id, { ad: "Sekreter S", unvan: "Sekreter", yetki: "yaz" });
  const r = await A.bulut.esitle();
  ok(kova.size === 1 && [...kova.keys()][0] === dA.b.id + "/e1" && r.dosyaBekleyen === 0, "asıl dosya yüklendi: " + [...kova.keys()]);
  ok(!new TextDecoder().decode([...kova.values()][0]).includes("PDF"), "bulutta şifreli");
  // Sekreter
  let S = cihaz("S");
  await S.bulut.bulutKur("s-esitleme-sifresi");
  await S.buro.davetKabul(kod, "Sekreter S");
  await S.bulut.esitle();
  ok(!(await S.foy.dosyaOku("e1")), "sekreterin cihazında başta dosya yok");
  const { asilDosya } = require("../src/data/buroDosya");
  const b = await asilDosya("e1", "karar.pdf");
  ok(!!b && (await b.text()).includes("%PDF-1.4 uydurma") && b.type === "application/pdf", "sekreter açınca indi ve çözüldü");
  ok(!!(await S.foy.dosyaOku("e1")), "sekreterin cihazında saklandı");
  // Evrak silinince buluttaki dosya da kalkar
  A = cihaz("A");
  const fa = (await A.foy.foyler()).find((f: any) => f.id === f1.id);
  await A.foy.foyKaydet({ ...fa, evraklar: [], silinen: ["e1"] });
  await A.bulut.esitle();
  ok(kova.size === 0, "silinen evrakın dosyası buluttan kalktı");
  // Çok sayıda dosya: her eşitlemede sınırlı sayıda gider, kalan bekler
  const cok = A.foy.bosFoy({ muvekkil: "Çok Evraklı", evraklar: Array.from({ length: 20 }, (_, i) => ({ id: "c" + i, ad: "c" + i + ".pdf", boyut: 1, eklenme: "2026-11-01T00:00:00Z", metin: "x" })) });
  await A.foy.foyKaydet(cok);
  for (let i = 0; i < 20; i++) await A.foy.dosyaYaz("c" + i, new Blob([new Uint8Array([i])]));
  const r1 = await A.bulut.esitle();
  ok(kova.size === 15 && r1.dosyaBekleyen === 5, "ilk turda 15 dosya, 5 bekliyor: " + kova.size + "/" + r1.dosyaBekleyen);
  const r2 = await A.bulut.esitle();
  ok(kova.size === 20 && r2.dosyaBekleyen === 0, "ikinci turda tamamı");
  if (fail) { console.log(`buro-dosya-test: ${fail} hata`); process.exit(1); }
  console.log("buro-dosya-test: tamam");
})().catch(e => { console.log("✗ " + (e?.stack || e)); process.exit(1); });
