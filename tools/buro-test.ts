// Büro: iki çalışan (iki cihaz) aynı büronun föylerini şifreli paylaşır. Sahte (bellekte) sunucu; gerçek Supabase'e gidilmez.
// Kural ve yetkilerin sunucu tarafı ayrıca gerçek Postgres'te denenir (tools/buro-sql-test.mjs, isteğe bağlı).
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */
const Module = require("module");
const path = require("path");
const yukle = Module._load;
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
  for (const k of Object.keys(require.cache)) if (k.startsWith(src)) delete require.cache[k];
  return { foy: require("../src/data/foy"), bulut: require("../src/data/foyBulut"), buro: require("../src/data/buro"), ad };
}
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("✗ " + m); } };

(async () => {
  oturumlar.A = "uid-a"; oturumlar.B = "uid-b"; oturumlar.C = "uid-c";
  // A: kurucu avukat. Kişisel eşitleme + büro.
  let A = cihaz("A");
  const f1 = A.foy.bosFoy({ muvekkil: "Uydurma Müvekkil", mahkeme: "Uydurma 1. Asliye Hukuk", esasNo: "2025/1" });
  await A.foy.foyKaydet(f1);
  await A.bulut.bulutKur("a-esitleme-sifresi");
  await A.buro.buroKur("Uydurma Hukuk Bürosu", "Av. A");
  const dA = await A.buro.buroDurumu();
  ok(dA.tur === "uye" && dA.anahtar && dA.b.ben.yetki === "yonetici", "büro kuruldu: " + dA.tur);
  const kod = await A.buro.davetOlustur(dA.b.id, { ad: "Stj. B", unvan: "Stajyer avukat", yetki: "yaz" });
  ok(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(kod), "davet kodu: " + kod);
  ok(!JSON.stringify(tablo.buro_davet).includes(kod.replace(/-/g, "")), "kod sunucuda yok");
  await A.bulut.esitle();
  ok(tablo.buro_foy.some(x => x.kayit_id === f1.id && x.tur === "foy") && !tablo.foy_bulut.some(x => x.kayit_id === f1.id), "föy büroya gitti, kişisel buluta değil");
  ok(!JSON.stringify(tablo.buro_foy).includes("Uydurma Müvekkil"), "sunucuda açık ad yok");

  // B: stajyer. Kendi hesabı, kendi eşitleme şifresi; davetle katılır.
  let B = cihaz("B");
  await B.bulut.bulutKur("b-esitleme-sifresi");
  let hata = ""; try { await B.buro.davetKabul("AAAA-BBBB-CCCC", "B"); } catch (e: any) { hata = e.message; }
  ok(/geçersiz/.test(hata), "yanlış kod");
  await B.buro.davetKabul(kod.toLowerCase().replace(/-/g, " "), "Stj. B");
  await B.bulut.esitle();
  let bListe = await B.foy.foyler();
  ok(bListe.some((f: any) => f.id === f1.id && f.muvekkil === "Uydurma Müvekkil"), "stajyer büro föyünü gördü");
  // B iş ekler ve A'ya atar; aynı anda A da aynı föye iş ekler (ikisi de kaybolmamalı).
  const fb = bListe.find((f: any) => f.id === f1.id);
  await B.foy.foyKaydet({ ...fb, gorevler: [...fb.gorevler, { id: "gB", metin: "Tanık listesi", bitti: false, kaynak: "elle", atanan: "uid-a", atananAd: "Av. A" }] });
  A = cihaz("A");
  const fa = (await A.foy.foyler()).find((f: any) => f.id === f1.id);
  await A.foy.foyKaydet({ ...fa, gorevler: [...fa.gorevler, { id: "gA", metin: "Bilirkişi itirazı", bitti: false, kaynak: "elle" }] });
  B = cihaz("B"); await B.bulut.esitle();
  A = cihaz("A"); await A.bulut.esitle();
  B = cihaz("B"); await B.bulut.esitle();
  const sonA = (await (cihaz("A")).foy.foyler()).find((f: any) => f.id === f1.id);
  const sonB = (await (cihaz("B")).foy.foyler()).find((f: any) => f.id === f1.id);
  ok(["gA", "gB"].every(id => sonA.gorevler.some((g: any) => g.id === id)) && ["gA", "gB"].every(id => sonB.gorevler.some((g: any) => g.id === id)), "aynı anda eklenen iki iş de kalır: A=" + sonA.gorevler.map((g: any) => g.id) + " B=" + sonB.gorevler.map((g: any) => g.id));
  ok(sonA.gorevler.find((g: any) => g.id === "gB")?.atanan === "uid-a", "atama korunur");

  // B (stajyer) föy silemez: silme gönderilmez, föy geri gelir.
  B = cihaz("B");
  await B.foy.foySil(sonB);
  await B.bulut.esitle();
  ok(!tablo.buro_foy.find(x => x.kayit_id === f1.id)?.silindi, "stajyerin silmesi büroya gitmedi");
  B = cihaz("B"); await B.bulut.esitle();
  ok((await B.foy.foyler()).some((f: any) => f.id === f1.id), "silinen föy stajyere geri geldi");

  // B'nin şahsi olmayan yeni föyü A'ya gider.
  const f2 = B.foy.bosFoy({ muvekkil: "İkinci Uydurma", esasNo: "2025/2" });
  await B.foy.foyKaydet(f2); await B.bulut.esitle();
  A = cihaz("A"); await A.bulut.esitle();
  ok((await A.foy.foyler()).some((f: any) => f.id === f2.id), "stajyerin föyü kurucuya geldi");

  // A, B'yi avukat yapar; sonra çıkarır: B artık büro föylerini çekemez, anahtarı cihazdan silinir.
  A = cihaz("A");
  await A.buro.uyeGuncelle(dA.b.id, "uid-b", { unvan: "Avukat", yetki: "sil" });
  B = cihaz("B");
  const dB = await B.buro.buroDurumu();
  ok(dB.tur === "uye" && dB.b.ben.unvan === "Avukat" && dB.b.uyeler.length === 2, "ünvan güncellendi");
  A = cihaz("A"); await A.buro.uyeCikar(dA.b.id, "uid-b");
  B = cihaz("B");
  const dB2 = await B.buro.buroDurumu();
  ok(dB2.tur === "yok" && !(await B.buro.buroAnahtari()), "çıkarılan çalışanın büro anahtarı silindi");

  // A'nın ikinci cihazı (A2): aynı hesap, eşitleme şifresiyle açınca büro anahtarı da gelir.
  aktif = "A2"; oturumlar.A2 = "uid-a";
  const A2 = cihaz("A2");
  ok(await A2.bulut.bulutAc("a-esitleme-sifresi"), "A2 eşitleme açıldı");
  const dA2 = await A2.buro.buroDurumu();
  ok(dA2.tur === "uye" && dA2.anahtar, "A2 büro anahtarını açtı");
  await A2.bulut.esitle();
  ok((await A2.foy.foyler()).length >= 2, "A2 büro föylerini gördü");

  if (fail) { console.log(`buro-test: ${fail} hata`); process.exit(1); }
  console.log("buro-test: tamam");
})().catch(e => { console.log("✗ " + (e?.stack || e)); process.exit(1); });
