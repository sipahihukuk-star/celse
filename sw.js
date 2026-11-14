// Celse'nin bilgisayara uygulama olarak kurulabilmesi ve internet kapalıyken de açılıp evrak okuyabilmesi için servis çalışanı.
// - Sayfa açılışı (navigasyon): önce ağ, ağ yoksa son açılan sayfa.
// - Uygulamanın kendi derlenmiş dosyaları (/_expo/static, /assets, simgeler): önbellekten, arkada yenilenir.
// - Evrak okuma kütüphaneleri (pdf.js, yazı tanıma ve Türkçe dil dosyası; cdn.jsdelivr.net): ilk inişte önbelleğe alınır.
// Sunucu, yapay zekâ ve kişisel veri istekleri hiç ellenmez; hiçbir kişisel veri önbelleğe alınmaz.
const KABUK = "celse-kabuk-2";
const DOSYA = "celse-dosya-2";
const KUTUPHANE = "celse-kutuphane-1";
const KUTUPHANELER = [/^https:\/\/cdn\.jsdelivr\.net\/npm\/(pdfjs-dist|pako|utif|tesseract\.js|tesseract\.js-core|@tesseract\.js-data)@/];
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  const tut = new Set([KABUK, DOSYA, KUTUPHANE]);
  for (const k of await caches.keys()) if (!tut.has(k)) await caches.delete(k);
  await self.clients.claim();
})()));
const onbellektenSonraAg = (ad, req) => caches.open(ad).then(c => c.match(req).then(var_ => {
  const ag = fetch(req).then(r => { if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone()).catch(() => {}); return r; });
  return var_ || ag;
}));
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(r => { const kopya = r.clone(); caches.open(KABUK).then(c => c.put("./", kopya)).catch(() => {}); return r; })
        .catch(() => caches.match("./").then(r => r || new Response("Celse: internet bağlantısı yok.", { headers: { "Content-Type": "text/plain; charset=utf-8" } })))
    );
    return;
  }
  const u = new URL(req.url);
  if (u.origin === self.location.origin && (/\/_expo\/static\//.test(u.pathname) || /\/assets\//.test(u.pathname) || /\.(png|ico|webmanifest|ttf|otf|woff2?)$/.test(u.pathname))) {
    e.respondWith(onbellektenSonraAg(DOSYA, req));
    return;
  }
  if (KUTUPHANELER.some(r => r.test(req.url))) {
    // Sürümü sabit kütüphane dosyaları: önbellekte varsa ağa hiç gidilmez.
    e.respondWith(caches.open(KUTUPHANE).then(c => c.match(req).then(var_ => var_ || fetch(req).then(r => { if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone()).catch(() => {}); return r; }))));
  }
});
