// Eşitleme kurallarını (src/data/syncCore.ts) sahte depolama ve sahte sunucuyla dener.
//   npx tsx tools/synctest.ts
import { createSync, metaKey, Row, Snapshot } from "../src/data/syncCore";

let failures = 0;
const ok = (c: unknown, m: string) => { if (c) console.log(`✓ ${m}`); else { failures++; console.log(`✗ ${m}`); } };

/* ---------- sahte dünya ---------- */
let clock = 1_000_000;
const store = new Map<string, string>();
const storage = { getItem: async (k: string) => store.get(k) ?? null, setItem: async (k: string, v: string) => { store.set(k, v); } };
let acc: { id: string; mode: string } | null = null;
let online = true;
const server = new Map<string, Row>();
let calls = 0;
/** her istekte oturum sahibiyle istenen satır aynı mı (RLS'nin yapacağını burada da denetleriz) */
let crossWrites = 0;
const hook: { beforeUpdate?: () => void } = {};
const iso = () => new Date(clock).toISOString();
const remote = {
  async get(uid: string) { calls++; if (!online) throw new Error("ağ yok"); if (acc?.id !== uid) crossWrites++; const r = server.get(uid); return r ? JSON.parse(JSON.stringify(r)) : null; },
  async insert(uid: string, veri: Snapshot) {
    calls++; if (!online) throw new Error("ağ yok"); if (acc?.id !== uid) crossWrites++;
    if (server.has(uid)) return null;
    const r = { veri: JSON.parse(JSON.stringify(veri)), surum: 1, guncelleme: iso() }; server.set(uid, r); return { surum: 1, guncelleme: r.guncelleme };
  },
  async update(uid: string, veri: Snapshot, surum: number) {
    calls++; if (!online) throw new Error("ağ yok"); if (acc?.id !== uid) crossWrites++;
    hook.beforeUpdate?.(); hook.beforeUpdate = undefined;
    const r = server.get(uid); if (!r || r.surum !== surum) return null;
    const n = { veri: JSON.parse(JSON.stringify(veri)), surum: r.surum + 1, guncelleme: iso() }; server.set(uid, n); return { surum: n.surum, guncelleme: n.guncelleme };
  }
};
const K = { buro: (u: string) => `celse-buro-v1:${u}`, dosya: (u: string) => `celse-dosya-v1:${u}`, kar: (u: string) => `celse-karakter-v1:${u}` };
const get = (k: string) => { const v = store.get(k); return v ? JSON.parse(v) : null; };
const readLocal = async (u: string): Promise<Snapshot> => ({ buro: get(K.buro(u)), dosya: get(K.dosya(u)), karakter: get(K.kar(u)) ? { avatar: get(K.kar(u)).avatar } : null });
const writeLocal = async (u: string, s: Snapshot) => {
  for (const [k, v] of [[K.buro(u), s.buro], [K.dosya(u), s.dosya]] as const) { if (v) store.set(k, JSON.stringify(v)); else store.delete(k); }
  if (s.karakter) store.set(K.kar(u), JSON.stringify({ avatar: s.karakter.avatar, traits: {}, text: "" }));
};
const office = (month: number, extra: Record<string, unknown> = {}) => ({ name: "Büro", city: "izmir", avatar: "av-erkek-38", cash: 150000, month, secretary: false, ledger: [], ...extra });
const flow = (closed: number) => ({ offers: [], active: [], closed: Object.fromEntries(Array.from({ length: closed }, (_, i) => [`d${i}`, { won: true, score: 70, month: i }])), declined: {}, focus: [], seen: [], dealtFor: -1, src: {}, side: {}, specialty: [] });
const meta = (u: string) => get(metaKey(u));

function reset() { store.clear(); server.clear(); acc = null; online = true; calls = 0; crossWrites = 0; clock = 1_000_000; }
function make() { return createSync({ storage, account: () => acc, remote: () => remote, readLocal, writeLocal, now: () => clock, delay: 5, retry: 1000 }); }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function settle(s: ReturnType<typeof make>) { for (let i = 0; i < 4; i++) { await sleep(15); await s.idle(); } }
/** yerel kaydı uygulamanın yaptığı gibi değiştirir ve haber verir */
function localSave(s: ReturnType<typeof make>, u: string, key: "buro" | "dosya", v: unknown) { store.set(K[key](u), JSON.stringify(v)); s.onLocalChange(u); }
const A = "aaaa", B = "bbbb";

(async () => {
  console.log("— Misafir ve cihaz profili");
  reset(); { const s = make(); store.set(K.buro("misafir"), JSON.stringify(office(4))); s.onAccount(); s.onLocalChange("misafir"); await settle(s);
    ok(calls === 0 && server.size === 0, "misafirde sunucuya hiç gidilmez");
    acc = { id: "yerel-1", mode: "local" }; s.onAccount(); s.onLocalChange("yerel-1"); await settle(s);
    ok(calls === 0, "cihaz profilinde (sunucu yok) eşitleme yapılmaz"); }

  console.log("— Sunucuda satır yok");
  reset(); { const s = make(); store.set(K.buro(A), JSON.stringify(office(5))); store.set(K.dosya(A), JSON.stringify(flow(3)));
    acc = { id: A, mode: "server" }; s.onAccount(); await settle(s);
    ok((server.get(A)?.veri.buro as { month: number })?.month === 5, "cihazdaki eski ilerleme sunucuya yüklenir");
    ok(meta(A)?.surum === 1 && meta(A)?.kirli === false && meta(A)?.sahip === A, "eşitleme bilgisi hesap kimliğiyle saklanır"); }
  reset(); { const s = make(); acc = { id: A, mode: "server" }; s.onAccount(); await settle(s);
    ok(server.size === 0 && meta(A)?.surum === 0, "cihazda da yoksa bir şey yazılmaz"); }

  console.log("— Bu cihazda ilk giriş, ikisinde de ilerleme var");
  reset(); { const s = make(); server.set(A, { veri: { buro: office(7), dosya: flow(9), karakter: null }, surum: 4, guncelleme: iso() });
    store.set(K.buro(A), JSON.stringify(office(2)));
    acc = { id: A, mode: "server" }; s.onAccount(); await settle(s);
    ok(get(K.buro(A)).month === 7 && server.get(A)!.surum === 4, "sunucudaki ilerleme fazlaysa o alınır");
    ok(get(K.dosya(A)) && Object.keys(get(K.dosya(A)).closed).length === 9, "dosya akışı da sunucudan gelir"); }
  reset(); { const s = make(); server.set(A, { veri: { buro: office(7), dosya: flow(9), karakter: null }, surum: 4, guncelleme: iso() });
    store.set(K.buro(A), JSON.stringify(office(9))); store.set(K.dosya(A), JSON.stringify(flow(2)));
    acc = { id: A, mode: "server" }; s.onAccount(); await settle(s);
    ok((server.get(A)!.veri.buro as { month: number }).month === 9 && server.get(A)!.surum === 5, "cihazdaki ilerleme (ay) fazlaysa sunucuya yazılır");
    ok(meta(A).surum === 5 && !meta(A).kirli, "gönderimden sonra sürüm güncellenir"); }
  reset(); { const s = make(); server.set(A, { veri: { buro: office(7, { cash: 1 }), dosya: flow(4), karakter: null }, surum: 2, guncelleme: iso() });
    store.set(K.buro(A), JSON.stringify(office(7, { cash: 999999 }))); store.set(K.dosya(A), JSON.stringify(flow(4)));
    acc = { id: A, mode: "server" }; s.onAccount(); await settle(s);
    ok(get(K.buro(A)).cash === 1 && server.get(A)!.surum === 2, "eşit ilerlemede sunucudaki kalır (belirli kural)"); }
  reset(); { const s = make(); const snap = { buro: office(3), dosya: flow(1), karakter: null };
    server.set(A, { veri: JSON.parse(JSON.stringify(snap)), surum: 3, guncelleme: iso() });
    store.set(K.buro(A), JSON.stringify(snap.buro)); store.set(K.dosya(A), JSON.stringify(snap.dosya));
    acc = { id: A, mode: "server" }; s.onAccount(); await settle(s);
    ok(server.get(A)!.surum === 3 && meta(A).surum === 3, "aynıysa yazılmaz, sürüm hatırlanır"); }

  console.log("— Değişikliklerin gönderilmesi ve alınması");
  reset(); { const s = make(); acc = { id: A, mode: "server" }; s.onAccount(); await settle(s);
    localSave(s, A, "buro", office(0)); localSave(s, A, "dosya", flow(0)); localSave(s, A, "buro", office(1));
    const before = calls; await settle(s);
    ok((server.get(A)?.veri.buro as { month: number })?.month === 1, "yerel değişiklik birkaç saniye içinde gönderilir");
    ok(calls - before === 1, "art arda değişiklikler tek gönderimde birleşir");
    // başka cihaz yazdı
    clock += 60_000; server.set(A, { veri: { buro: office(6), dosya: flow(5), karakter: { avatar: "av-kadin-32" } }, surum: server.get(A)!.surum + 1, guncelleme: iso() });
    clock += 5_000; s.onForeground(); await settle(s);
    ok(get(K.buro(A)).month === 6 && get(K.kar(A))?.avatar === "av-kadin-32", "uygulama öne gelince başka cihazdaki değişiklik alınır");
    // iki taraf da değişti: sunucu daha yeni
    localSave(s, A, "buro", office(10)); s.onAccount(); // zamanlayıcı çalışmadan önce
    online = false; await settle(s); online = true; // gönderim ağ yokken başarısız oldu, kirli kaldı
    ok(meta(A).kirli === true && get(K.buro(A)).month === 10, "ağ yokken değişiklik cihazda kalır, hata çıkmaz");
    clock += 10_000; server.set(A, { veri: { buro: office(20), dosya: flow(5), karakter: null }, surum: server.get(A)!.surum + 1, guncelleme: iso() });
    clock += 5_000; s.onForeground(); await settle(s);
    ok(get(K.buro(A)).month === 20, "ikisi de değiştiyse son yazan kazanır (sunucu daha yeni)");
    clock += 5_000; server.set(A, { veri: { buro: office(21), dosya: flow(5), karakter: null }, surum: server.get(A)!.surum + 1, guncelleme: iso() });
    clock += 5_000; localSave(s, A, "buro", office(30)); online = false; await settle(s); online = true;
    clock += 5_000; s.onForeground(); await settle(s);
    ok((server.get(A)!.veri.buro as { month: number }).month === 30 && get(K.buro(A)).month === 30, "ikisi de değiştiyse son yazan kazanır (cihaz daha yeni)"); }

  console.log("— Gönderim sırasında başka cihaz araya girer (iyimser kilit)");
  reset(); { const s = make(); server.set(A, { veri: { buro: office(1), dosya: null, karakter: null }, surum: 1, guncelleme: iso() });
    store.set(K.buro(A), JSON.stringify(office(1))); acc = { id: A, mode: "server" }; s.onAccount(); await settle(s);
    clock += 1000; localSave(s, A, "buro", office(2));
    hook.beforeUpdate = () => { clock += 10; server.set(A, { veri: { buro: office(8), dosya: null, karakter: null }, surum: 2, guncelleme: new Date(clock - 20_000).toISOString() }); };
    await settle(s);
    ok(server.get(A)!.surum === 3 && (server.get(A)!.veri.buro as { month: number }).month === 2, "sürüm tutmayınca yeniden çekilir; cihaz daha yeniyse yeniden yazılır"); }

  console.log("— Hesap değiştirme");
  reset(); { const s = make(); store.set(K.buro(A), JSON.stringify(office(12))); store.set(K.dosya(A), JSON.stringify(flow(8)));
    acc = { id: A, mode: "server" }; s.onAccount(); await settle(s);
    localSave(s, A, "buro", office(13)); // gönderilmeden çıkış
    acc = null; s.onAccount(); await settle(s);
    ok(get(K.buro(A)).month === 13, "çıkışta cihazdaki kayıt silinmez");
    server.set(B, { veri: { buro: office(1, { city: "van" }), dosya: flow(0), karakter: null }, surum: 1, guncelleme: iso() });
    acc = { id: B, mode: "server" }; s.onAccount(); await settle(s);
    ok(get(K.buro(B)).city === "van" && get(K.buro(A)).month === 13, "B girince B'nin sunucu verisi gelir, A'nınki cihazda kalır");
    ok((server.get(B)!.veri.buro as { month: number }).month === 1 && server.get(B)!.surum === 1, "A'nın verisi B'ye yazılmaz");
    ok((server.get(A)!.veri.buro as { month: number }).month === 12, "B oturumundayken A'nın bekleyen değişikliği gönderilmez");
    ok(crossWrites === 0, "hiçbir istek oturumdaki hesaptan başkası adına yapılmaz");
    acc = { id: A, mode: "server" }; s.onAccount(); await settle(s);
    ok((server.get(A)!.veri.buro as { month: number }).month === 13, "A yeniden girince bekleyen değişikliği gönderilir"); }
  reset(); { const s = make(); store.set(K.buro(A), JSON.stringify(office(12)));
    store.set(metaKey(B), JSON.stringify({ sahip: A, surum: 9, guncelleme: null, kirli: true, zaman: 1 }));
    acc = { id: B, mode: "server" }; s.onAccount(); await settle(s);
    ok(server.size === 0 && !get(K.buro(B)), "B'nin sunucusu ve cihazı boşsa A'nın verisi yüklenmez; sahibi uymayan eşitleme bilgisi yok sayılır"); }

  console.log("— Çevrim dışı açılış");
  reset(); { const s = make(); store.set(K.buro(A), JSON.stringify(office(3))); online = false;
    acc = { id: A, mode: "server" }; s.onAccount(); await settle(s);
    localSave(s, A, "buro", office(4)); await settle(s);
    ok(get(K.buro(A)).month === 4 && server.size === 0, "sunucuya ulaşılamazsa oyun cihazda sürer");
    ok(meta(A).surum === null, "hiç eşitlenmemiş olarak işaretli kalır (ilk giriş kuralı korunur)");
    server.set(A, { veri: { buro: office(9), dosya: null, karakter: null }, surum: 1, guncelleme: iso() });
    online = true; clock += 5_000; s.onForeground(); await settle(s);
    ok(get(K.buro(A)).month === 9, "bağlantı gelince ilk giriş kuralı uygulanır (ilerlemesi fazla olan kalır)"); }

  console.log(failures ? `\n${failures} hata` : "\nEşitleme denemelerinin hepsi geçti.");
  process.exit(failures ? 1 : 0);
})();
