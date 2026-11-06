// Telefonda PDF, TIF ve fotoğraf okuma: görünmez bir WebView içinde çalışan sayfa (src/ui/EvrakOkuyucu.native.tsx).
// Web'deki src/ui/evrakOku.ts ile aynı yöntem ve aynı sabit sürümlü kütüphaneler (pdf.js, UTIF, Tesseract Türkçe).
// Dosya telefonun içinde, bu sayfada okunur; hiçbir sunucuya gönderilmez. Kütüphaneler ve Türkçe dil dosyası ilk kullanımda iner.
// Mesajlaşma: uygulama {id, tur: "pdf" | "tif" | "resim", ad, b64} gönderir; sayfa {id, ilerleme} ve sonunda {id, metin} ya da {id, hata} döner.

export const EVRAK_OKUYUCU_HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
var CDN = {
  pdf: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
  pdfWorker: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js",
  pako: "https://cdn.jsdelivr.net/npm/pako@1.0.11/dist/pako.min.js",
  utif: "https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.js",
  tess: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js",
  tessWorker: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
  tessCore: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1",
  tessLang: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/tur/4.0.0_best_int"
};
function gonder(o) { window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
var yuklenen = {};
function betik(url) {
  if (!yuklenen[url]) yuklenen[url] = new Promise(function (ok, hata) {
    var s = document.createElement("script"); s.src = url; s.crossOrigin = "anonymous";
    s.onload = function () { ok(); };
    s.onerror = function () { delete yuklenen[url]; hata(new Error("Okuma kütüphanesi indirilemedi. İnternet bağlantınızı denetleyin.")); };
    document.head.appendChild(s);
  });
  return yuklenen[url];
}
var isci = null;
function ocrIscisi(ilerle) {
  if (!isci) {
    isci = (async function () {
      ilerle("Yazı tanıma hazırlanıyor (Türkçe dil dosyası ilk seferde iner)…");
      await betik(CDN.tess);
      return Tesseract.createWorker("tur", 1, { workerPath: CDN.tessWorker, corePath: CDN.tessCore, langPath: CDN.tessLang });
    })();
    isci.catch(function () { isci = null; });
  }
  return isci;
}
async function ocr(c, ilerle) { var w = await ocrIscisi(ilerle); var r = await w.recognize(c); return String((r.data && r.data.text) || ""); }
function bayt(b64) { var s = atob(b64), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }

async function pdfMetni(bytes, ilerle) {
  await betik(CDN.pdf);
  pdfjsLib.GlobalWorkerOptions.workerSrc = CDN.pdfWorker;
  var doc = await pdfjsLib.getDocument({ data: bytes }).promise, out = [];
  for (var i = 1; i <= doc.numPages; i++) {
    ilerle("PDF okunuyor: sayfa " + i + " / " + doc.numPages);
    var page = await doc.getPage(i), tc = await page.getTextContent();
    var metin = tc.items.map(function (it) { return (it.str || "") + (it.hasEOL ? "\\n" : ""); }).join("").trim();
    if (metin.replace(/\\s/g, "").length < 40) {
      ilerle("Taranmış sayfa, yazı tanıma: sayfa " + i + " / " + doc.numPages);
      var vp = page.getViewport({ scale: 2 }), c = document.createElement("canvas");
      c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
      await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      metin = (await ocr(c, ilerle)).trim();
    }
    out.push(metin);
  }
  return out.filter(Boolean).join("\\n\\n");
}
async function tifMetni(bytes, ilerle) {
  await betik(CDN.pako); await betik(CDN.utif);
  var buf = bytes.buffer, ifds = UTIF.decode(buf).filter(function (f) { return f.t256 && f.t257; }), out = [];
  if (!ifds.length) throw new Error("TIF dosyasında sayfa bulunamadı.");
  for (var i = 0; i < ifds.length; i++) {
    ilerle("TIF, yazı tanıma: sayfa " + (i + 1) + " / " + ifds.length);
    var f = ifds[i]; UTIF.decodeImage(buf, f);
    var rgba = UTIF.toRGBA8(f), c = document.createElement("canvas");
    c.width = f.width; c.height = f.height;
    c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(rgba), f.width, f.height), 0, 0);
    out.push((await ocr(c, ilerle)).trim());
  }
  return out.filter(Boolean).join("\\n\\n");
}
async function resimMetni(bytes, ad, ilerle) {
  ilerle("Fotoğraf, yazı tanıma…");
  var bmp = await createImageBitmap(new Blob([bytes], { type: /\\.png$/i.test(ad) ? "image/png" : "image/jpeg" }));
  var olcek = Math.min(1, 3000 / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas");
  c.width = Math.round(bmp.width * olcek); c.height = Math.round(bmp.height * olcek);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return (await ocr(c, ilerle)).trim();
}
async function oku(m) {
  var ilerle = function (t) { gonder({ id: m.id, ilerleme: t }); };
  try {
    var b = bayt(m.b64);
    var metin = m.tur === "pdf" ? await pdfMetni(b, ilerle) : m.tur === "tif" ? await tifMetni(b, ilerle) : await resimMetni(b, m.ad, ilerle);
    gonder({ id: m.id, metin: metin });
  } catch (e) { gonder({ id: m.id, hata: String((e && e.message) || e) }); }
}
function al(ev) { try { var m = JSON.parse(ev.data); if (m && m.id && m.b64) oku(m); } catch (e) {} }
window.addEventListener("message", al);
document.addEventListener("message", al);
gonder({ hazir: true });
</script></body></html>`;
