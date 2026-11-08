// Web: PDF, TIF ve fotoğraf evrakını tarayıcıda (cihazda) metne çevirir. Hiçbir dosya sunucuya gönderilmez.
// - PDF: metin katmanı varsa doğrudan okunur (pdf.js); sayfa taranmışsa (metin yoksa) sayfa görüntüye çizilip yazı tanımayla okunur.
// - TIF (UYAP'tan inen taranmış evrak, çok sayfalı olabilir) ve JPG/PNG: görüntü çözülüp yazı tanımayla (Tesseract, Türkçe) okunur.
// Kütüphaneler yalnız bu türden bir dosya seçildiğinde, sürümü sabitlenmiş CDN adreslerinden bir kez indirilir; uygulamayı ağırlaştırmaz.
// Türkçe yazı tanıma dil dosyası ilk kullanımda iner (yaklaşık 10 MB) ve tarayıcı önbelleğinde kalır.

const CDN = {
  pdf: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
  pdfWorker: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js",
  pako: "https://cdn.jsdelivr.net/npm/pako@1.0.11/dist/pako.min.js",
  utif: "https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.js",
  tess: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js",
  tessWorker: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
  tessCore: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1",
  tessLang: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/tur/4.0.0_best_int"
};

export type Ilerleme = (mesaj: string) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const W = () => window as Any;

const yuklenen = new Map<string, Promise<void>>();
function betik(url: string): Promise<void> {
  let p = yuklenen.get(url);
  if (!p) {
    p = new Promise<void>((ok, hata) => {
      const s = document.createElement("script");
      s.src = url; s.async = true; s.crossOrigin = "anonymous";
      s.onload = () => ok();
      s.onerror = () => { yuklenen.delete(url); hata(new Error("Okuma kütüphanesi indirilemedi. İnternet bağlantınızı denetleyin.")); };
      document.head.appendChild(s);
    });
    yuklenen.set(url, p);
  }
  return p;
}

let isci: Promise<Any> | null = null;
async function ocrIscisi(ilerle: Ilerleme): Promise<Any> {
  if (!isci) {
    isci = (async () => {
      ilerle("Yazı tanıma hazırlanıyor (Türkçe dil dosyası ilk seferde iner)…");
      await betik(CDN.tess);
      return W().Tesseract.createWorker("tur", 1, { workerPath: CDN.tessWorker, corePath: CDN.tessCore, langPath: CDN.tessLang });
    })();
    isci.catch(() => { isci = null; });
  }
  return isci;
}
async function ocr(kaynak: HTMLCanvasElement, ilerle: Ilerleme): Promise<string> {
  const w = await ocrIscisi(ilerle);
  const { data } = await w.recognize(kaynak);
  return String(data?.text || "");
}

/** İnternet kapalıyken de okuyabilmek için okuma kütüphanelerini ve Türkçe dil dosyasını bir kez indirir (servis çalışanı ve
 *  yazı tanıma kütüphanesi bunları bilgisayarda saklar). Kişisel veri içermez. */
export async function cevrimdisiHazirla(ilerle: Ilerleme): Promise<void> {
  ilerle("PDF okuyucu indiriliyor…");
  await betik(CDN.pdf);
  await fetch(CDN.pdfWorker).catch(() => {});
  ilerle("TIF okuyucu indiriliyor…");
  await betik(CDN.pako); await betik(CDN.utif);
  ilerle("Yazı tanıma ve Türkçe dil dosyası indiriliyor (bir kez, birkaç dakika sürebilir)…");
  await ocrIscisi(ilerle);
}

/** PDF: önce metin katmanı; boş sayfalar yazı tanımayla. */
export async function pdfMetni(bytes: Uint8Array, ilerle: Ilerleme): Promise<string> {
  await betik(CDN.pdf);
  const pdfjs = W().pdfjsLib;
  pdfjs.GlobalWorkerOptions.workerSrc = CDN.pdfWorker;
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const sayfalar: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    ilerle(`PDF okunuyor: sayfa ${i} / ${doc.numPages}`);
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    let metin = (tc.items as Any[]).map(it => (it.str || "") + (it.hasEOL ? "\n" : "")).join("").replace(/[ \t]+\n/g, "\n").trim();
    if (metin.replace(/\s/g, "").length < 40) {

      ilerle(`Taranmış sayfa, yazı tanıma: sayfa ${i} / ${doc.numPages}`);
      const vp = page.getViewport({ scale: 2.2 });
      const c = document.createElement("canvas");
      c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
      await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      metin = (await ocr(c, ilerle)).trim();
    }
    sayfalar.push(metin);
  }
  await doc.destroy?.();
  return sayfalar.filter(Boolean).join("\n\n");
}

/** TIF: her sayfa (IFD) çözülür ve yazı tanımayla okunur. */
export async function tifMetni(bytes: Uint8Array, ilerle: Ilerleme): Promise<string> {
  await betik(CDN.pako);
  await betik(CDN.utif);
  const UTIF = W().UTIF;
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const ifds = (UTIF.decode(buf) as Any[]).filter(f => f.t256 && f.t257);
  if (!ifds.length) throw new Error("TIF dosyasında sayfa bulunamadı.");
  const sayfalar: string[] = [];
  for (let i = 0; i < ifds.length; i++) {
    ilerle(`TIF, yazı tanıma: sayfa ${i + 1} / ${ifds.length}`);
    const f = ifds[i];
    UTIF.decodeImage(buf, f);
    const rgba = UTIF.toRGBA8(f) as Uint8Array;
    const c = document.createElement("canvas");
    c.width = f.width; c.height = f.height;
    c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(rgba), f.width, f.height), 0, 0);
    sayfalar.push((await ocr(c, ilerle)).trim());
  }
  return sayfalar.filter(Boolean).join("\n\n");
}

/** JPG / PNG (telefonla çekilmiş evrak fotoğrafı). */
export async function resimMetni(bytes: Uint8Array, ad: string, ilerle: Ilerleme): Promise<string> {
  ilerle("Fotoğraf, yazı tanıma…");
  const tip = /\.png$/i.test(ad) ? "image/png" : "image/jpeg";
  const bmp = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: tip }));
  const c = document.createElement("canvas");
  c.width = bmp.width; c.height = bmp.height;
  c.getContext("2d")!.drawImage(bmp, 0, 0);
  return (await ocr(c, ilerle)).trim();
}
