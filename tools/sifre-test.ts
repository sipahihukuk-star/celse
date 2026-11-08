// Şifreleme uyumluluğu: tarayıcı (WebCrypto) ile telefon (saf JavaScript) aynı anahtarı türetir ve birbirinin şifresini açar.
import { anahtarTuret, coz, hamAnahtar, hamTuret, kodla, metneCevir, sifrele, sifreTestSaf, b64, b64Coz } from "../src/data/sifre";
const ok = (c: boolean, m: string) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) process.exitCode = 1; };
(async () => {
  const metin = "Şahsi dosya: İğneada 🙂 ağaç ÇÖŞÜ";
  const tuz = new Uint8Array(16).map((_, i) => i);
  const T = (globalThis as any).TextEncoder, D = (globalThis as any).TextDecoder;
  (globalThis as any).TextEncoder = undefined; (globalThis as any).TextDecoder = undefined;
  const e1 = kodla(metin); (globalThis as any).TextEncoder = T; const e2 = kodla(metin);
  ok(b64(e1) === b64(e2), "UTF-8 kodlayıcı tarayıcıyla aynı");
  ok(metneCevir(e2) === metin, "UTF-8 çözücü (yedek) doğru"); (globalThis as any).TextDecoder = D;
  ok(b64Coz(b64(e2)).length === e2.length && b64(b64Coz(b64(e2))) === b64(e2), "base64 gidiş-dönüş");
  const hamWeb = await hamTuret("sifre1234", tuz, 1000);
  sifreTestSaf(true); const hamSaf = await hamTuret("sifre1234", tuz, 1000);
  ok(b64(hamWeb) === b64(hamSaf), "PBKDF2: WebCrypto ve saf JS aynı anahtar");
  const kSaf = await anahtarTuret("sifre1234", tuz, 1000);
  const x = await sifrele(kSaf, kodla(metin));
  sifreTestSaf(false); const kWeb = await anahtarTuret("sifre1234", tuz, 1000);
  ok(metneCevir(await coz(kWeb, x)) === metin, "telefonda şifrelenen tarayıcıda açılıyor");
  const y = await sifrele(await hamAnahtar(hamWeb), kodla(metin));
  sifreTestSaf(true); ok(metneCevir(await coz(await hamAnahtar(hamWeb), y)) === metin, "tarayıcıda şifrelenen telefonda açılıyor");
  let hata = false; try { await coz(await anahtarTuret("yanlis", tuz, 1000), y); } catch { hata = true; }
  ok(hata, "yanlış şifre açamıyor");
})();
