// Oyuncu durumunun cihazlar arasında eşitlenmesi: kurallar ve akış (React Native'den bağımsız; tools/synctest.ts ile denenir).
// Bağlantı ve depolama dışarıdan verilir (sync.ts gerçek AsyncStorage ve Supabase ile kurar).
//
// Eşitlenen: büro (office.ts), dosya akışı (flow.ts) ve karakterin seçilen yüzü (character.ts). Sunucuda tek satır:
// oyuncu_durumu (kullanici_id, veri, surum, guncelleme) — supabase/surum12.sql. surum ve guncelleme sunucuda damgalanır.
//
// Çatışma kuralı:
// 1. Sunucuda satır yoksa: cihazda ilerleme varsa yüklenir, yoksa bir şey yapılmaz.
// 2. Bu cihaz bu hesapla daha önce hiç eşitlenmediyse (ilk giriş):
//    cihazda ilerleme yoksa sunucudaki alınır; ikisi aynıysa bir şey yapılmaz; farklıysa İLERLEMESİ FAZLA olan kalır.
//    İlerleme sırasıyla karşılaştırılır: büro var mı, büronun ayı, kapanan dosya sayısı, kazanılan dava, masadaki dosya,
//    karakter var mı. Cihazdaki ancak kesin olarak fazlaysa kalır; eşitlikte sunucudaki alınır.
// 3. Daha önce eşitlendiyse: sunucu son eşitlemeden beri değişmediyse yerel değişiklik gönderilir.
//    Sunucu başka cihazdan değiştiyse: yerelde gönderilmemiş değişiklik yoksa sunucudaki alınır; varsa SON YAZAN KAZANIR
//    (yerel son değişiklik zamanı ile sunucunun guncelleme zamanı karşılaştırılır, eşitlikte sunucu).
// Gönderim iyimser kilitle yapılır: güncelleme "surum = bilinen sürüm" koşuluyla yazılır; tutmazsa yeniden çekilip kural uygulanır.
// Hesap ayrımı: her hesabın cihaz kaydı kendi anahtarındadır ve eşitleme bilgisi (sahip) hesap kimliğiyle saklanır.
// Bir hesabın cihaz kaydı hiçbir zaman başka hesaba gönderilmez; çıkışta cihazdaki kayıt silinmez.
// Hata ve bağlantı yokluğu sessizdir: yerel kayıt kalır, sonraki değişiklikte ya da uygulama öne gelince yeniden denenir.

export interface Snapshot { buro: unknown | null; dosya: unknown | null; karakter: { avatar: string } | null }
export interface Row { veri: Snapshot; surum: number; guncelleme: string }
/** surum: null = bu cihaz bu hesapla hiç eşitlenmedi; 0 = eşitlendi, sunucuda satır yok. */
export interface Meta { sahip: string; surum: number | null; guncelleme: string | null; kirli: boolean; zaman: number }

export interface Remote {
  /** satır yoksa null; hata olursa fırlatır */
  get(uid: string): Promise<Row | null>;
  /** satır zaten varsa null */
  insert(uid: string, veri: Snapshot): Promise<{ surum: number; guncelleme: string } | null>;
  /** sürüm tutmazsa (başka cihaz yazmış) null */
  update(uid: string, veri: Snapshot, surum: number): Promise<{ surum: number; guncelleme: string } | null>;
}
export interface Storage { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void> }
export interface Deps {
  storage: Storage;
  account(): { id: string; mode: string } | null;
  remote(): Remote | null;
  readLocal(uid: string): Promise<Snapshot>;
  writeLocal(uid: string, s: Snapshot): Promise<void>;
  now?: () => number;
  /** değişiklikten sonra gönderim gecikmesi (ms) */
  delay?: number;
  /** hatadan sonra yeniden deneme için en az bekleme (ms) */
  retry?: number;
}

export const metaKey = (uid: string) => `celse-esitleme-v1:${uid}`;
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Sunucudan gelen veriyi güvenli biçime getirir. */
export function cleanSnapshot(v: unknown): Snapshot {
  const o = obj(v) ? v : {};
  const k = o.karakter;
  return {
    buro: obj(o.buro) ? o.buro : null,
    dosya: obj(o.dosya) ? o.dosya : null,
    karakter: obj(k) && typeof k.avatar === "string" ? { avatar: k.avatar } : null
  };
}

const flowOf = (s: Snapshot) => (obj(s.dosya) ? s.dosya : {}) as { closed?: Record<string, unknown>; active?: unknown[]; offers?: unknown[]; focus?: unknown[]; specialty?: unknown[] };
const len = (a: unknown) => (Array.isArray(a) ? a.length : 0);

export function hasData(s: Snapshot): boolean {
  const f = flowOf(s);
  return !!s.buro || !!s.karakter || Object.keys(obj(f.closed) ? f.closed : {}).length > 0
    || len(f.active) > 0 || len(f.offers) > 0 || len(f.focus) > 0 || len(f.specialty) > 0;
}

/** İlerleme ölçüsü (sırayla karşılaştırılır). */
export function progressOf(s: Snapshot): number[] {
  const b = (obj(s.buro) ? s.buro : null) as { month?: number; wins?: number } | null;
  const f = flowOf(s);
  return [b ? 1 : 0, Number(b?.month) || 0, Object.keys(obj(f.closed) ? f.closed : {}).length, Number(b?.wins) || 0, len(f.active), s.karakter ? 1 : 0];
}
export function compareProgress(a: Snapshot, b: Snapshot): number {
  const x = progressOf(a), y = progressOf(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}

/** Anahtar sırasından bağımsız karşılaştırma. */
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (obj(v)) return Object.keys(v).sort().reduce((o, k) => { if (v[k] !== undefined) o[k] = canon(v[k]); return o; }, {} as Record<string, unknown>);
  return v;
}
export const sameSnapshot = (a: Snapshot, b: Snapshot) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

export type Action = "push" | "apply" | "none";
/** Çatışma kuralı (yukarıdaki açıklama). localTime: yerel son değişikliğin zamanı (ms). */
export function decide(local: Snapshot, server: Row | null, meta: Meta | null, dirty: boolean, localTime: number): Action {
  if (!server) return hasData(local) ? "push" : "none";
  if (!meta || meta.surum === null) {
    if (!hasData(local)) return "apply";
    if (sameSnapshot(local, server.veri)) return "none";
    return compareProgress(local, server.veri) > 0 ? "push" : "apply";
  }
  if (server.surum === meta.surum) return dirty ? "push" : "none";
  if (!dirty) return "apply";
  const st = Date.parse(server.guncelleme);
  return Number.isFinite(st) && localTime <= st ? "apply" : "push";
}

export function createSync(d: Deps) {
  const now = d.now || (() => Date.now());
  const delay = d.delay ?? 3000, retry = d.retry ?? 30000;
  /** eşitlenen (giriş yapmış, sunucu) hesap */
  let active: string | null = null;
  /** bu oturumda sunucudan başarıyla çekilen hesap: gönderim ancak çekildikten sonra yapılır */
  let pulledFor: string | null = null;
  let lastFail = 0, lastPull = 0;
  /** her yerel değişiklikte artar (çekme sırasında olan değişikliği kaçırmamak için) */
  let seq = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<unknown> = Promise.resolve();
  /** işlemler sırayla çalışır (çekme, gönderme ve değişiklik kaydı birbirine karışmaz) */
  const run = <T>(f: () => Promise<T>): Promise<T | undefined> => {
    const p = chain.then(f).catch(() => undefined);
    chain = p;
    return p;
  };

  async function readMeta(uid: string): Promise<Meta | null> {
    try {
      const m = JSON.parse((await d.storage.getItem(metaKey(uid))) || "null");
      return obj(m) && m.sahip === uid ? (m as unknown as Meta) : null;
    } catch { return null; }
  }
  async function writeMeta(m: Meta) { try { await d.storage.setItem(metaKey(m.sahip), JSON.stringify(m)); } catch { /* yok say */ } }

  const isActive = (uid: string) => {
    const a = d.account();
    return active === uid && !!a && a.mode === "server" && a.id === uid;
  };

  async function pull(uid: string, depth = 0): Promise<void> {
    const r = d.remote();
    if (!r || !isActive(uid)) return;
    const seq0 = seq;
    let server: Row | null;
    try {
      const row = await r.get(uid);
      server = row ? { surum: Number(row.surum) || 0, guncelleme: String(row.guncelleme), veri: cleanSnapshot(row.veri) } : null;
    } catch { lastFail = now(); return; }
    lastPull = now();
    if (!isActive(uid)) return;
    const local = await d.readLocal(uid);
    const meta = await readMeta(uid);
    const changedNow = seq !== seq0;
    const dirty = !!meta?.kirli || changedNow;
    const localTime = changedNow ? now() : meta?.zaman || 0;
    const act = decide(local, server, meta, dirty, localTime);
    if (act === "apply" && server) {
      await d.writeLocal(uid, server.veri);
      await writeMeta({ sahip: uid, surum: server.surum, guncelleme: server.guncelleme, kirli: false, zaman: now() });
    } else if (act === "push") {
      await writeMeta({ sahip: uid, surum: server ? server.surum : 0, guncelleme: server?.guncelleme || null, kirli: true, zaman: localTime || now() });
    } else {
      await writeMeta({ sahip: uid, surum: server ? server.surum : 0, guncelleme: server?.guncelleme || null, kirli: false, zaman: meta?.zaman || 0 });
    }
    pulledFor = uid;
    if (act === "push") await push(uid, depth);
  }

  async function push(uid: string, depth = 0): Promise<void> {
    const r = d.remote();
    if (!r || !isActive(uid)) return;
    if (pulledFor !== uid) { if (depth < 2) await pull(uid, depth + 1); return; }
    const meta = await readMeta(uid);
    if (!meta?.kirli) return;
    const seq0 = seq;
    const veri = await d.readLocal(uid);
    let res: { surum: number; guncelleme: string } | null;
    try {
      res = meta.surum ? await r.update(uid, veri, meta.surum) : await r.insert(uid, veri);
    } catch { lastFail = now(); return; }
    if (!res) {
      // Başka cihaz araya girmiş: yeniden çek, kuralı uygula.
      pulledFor = null;
      if (depth < 2) await pull(uid, depth + 1);
      return;
    }
    const still = seq !== seq0;
    await writeMeta({ sahip: uid, surum: Number(res.surum) || 0, guncelleme: String(res.guncelleme), kirli: still, zaman: still ? now() : meta.zaman });
    if (still) schedule(uid);
  }

  function schedule(uid: string) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; run(() => push(uid)); }, delay);
  }

  return {
    /** hesap değişince çağrılır: yeni sunucu hesabında sunucudan çeker */
    onAccount() {
      const a = d.account();
      const uid = a && a.mode === "server" ? a.id : null;
      if (uid === active) return;
      if (timer) { clearTimeout(timer); timer = null; }
      active = uid; pulledFor = null;
      if (uid) run(() => pull(uid));
    },
    /** office/flow/character kaydedince (syncBus) çağrılır */
    onLocalChange(owner: string) {
      if (owner !== active) return;
      seq++;
      const uid = owner;
      run(async () => {
        const m = (await readMeta(uid)) || { sahip: uid, surum: null, guncelleme: null, kirli: false, zaman: 0 };
        await writeMeta({ ...m, kirli: true, zaman: now() });
      });
      schedule(uid);
    },
    /** bekleyen gönderimi hemen yapar (arka plana geçerken, çıkıştan önce) */
    flush(): Promise<unknown> {
      const uid = active;
      if (timer) { clearTimeout(timer); timer = null; }
      if (!uid) return chain;
      return run(() => push(uid));
    },
    /** uygulama öne gelince: başka cihazdaki değişiklikleri alır (sık çekmez; hatadan sonra bekler) */
    onForeground() {
      const uid = active;
      if (!uid) return;
      run(async () => {
        const t = now();
        if (t - lastPull < retry || t - lastFail < retry) return;
        await pull(uid);
      });
    },
    /** testler için: sıradaki bütün işler bitince çözülür */
    idle: () => chain,
    state: () => ({ active, pulledFor })
  };
}
