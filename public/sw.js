// Celse'nin bilgisayara uygulama olarak kurulabilmesi için en küçük servis çalışanı.
// Yalnız sayfa açılışlarını (navigasyon) karşılar: her zaman ağdan alır, ağ yoksa son açılan sayfayı gösterir.
// Öteki istekler (sunucu, yapay zekâ, dosyalar) hiç ellenmez; hiçbir kişisel veri önbelleğe alınmaz.
const ONBELLEK = "celse-kabuk-1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(
    fetch(e.request)
      .then(r => { const kopya = r.clone(); caches.open(ONBELLEK).then(c => c.put("./", kopya)).catch(() => {}); return r; })
      .catch(() => caches.match("./").then(r => r || new Response("Celse: internet bağlantısı yok.", { headers: { "Content-Type": "text/plain; charset=utf-8" } })))
  );
});
