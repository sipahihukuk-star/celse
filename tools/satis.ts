// Web satışı (iyzico üye işyeri) için istenen yasal sayfaları src/legal/satis.ts'teki metinden üretir:
//   public/satis-sozlesmesi.html · on-bilgilendirme.html · iade.html · teslimat.html · iletisim.html · fiyatlar.html
// Görünüm public/gizlilik.html ile aynıdır (tools/privacy.ts). Her sayfanın altında bütün yasal sayfalara bağlantı ve
// ödeme logoları (iyzico ile öde, Visa, Mastercard; dış görsel çekilmez, satır içi SVG) bulunur.
// Expo, public/ klasörünü web dışa aktarımına (dist/) kopyalar; tools/deploy-pages.sh dist'i yayımlar.
// Çalıştırma: npx tsx tools/satis.ts
import { writeFileSync } from "fs";
import { Belge, BELGELER, Blok, FIYATLAR, SON_GUNCELLEME, URUNLER, DANISMA_UYARI, SATICI } from "../src/legal/satis";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Yer tutucular ("[DOLDURULACAK: …]") sarı işaretle gösterilir. */
const metin = (s: string) => esc(s).replace(/\[DOLDURULACAK:[^\]]*\]/g, m => `<mark class="ph">${m}</mark>`).replace(/\n/g, "<br>");
const etiketli = (b: string | [string, string]) => typeof b === "string" ? metin(b) : `<b>${metin(b[0])}:</b> ${metin(b[1])}`;

function blok(b: Blok): string {
  if (typeof b === "string" || Array.isArray(b)) return `<p>${etiketli(b)}</p>`;
  if ("liste" in b) return `<ul>${b.liste.map(x => `<li>${etiketli(x)}</li>`).join("")}</ul>`;
  return `<div class="not">${metin(b.not)}</div>`;
}

const SAYFALAR: [string, string][] = [
  ["fiyatlar.html", "Fiyatlar"],
  ...BELGELER.filter(b => b.dosya !== "iletisim.html").map(b => [b.dosya, b.kisaAd] as [string, string]),
  ["gizlilik.html", "Gizlilik ve KVKK"],
  ["iletisim.html", "İletişim"]
];

// Basit rozetler: resmî logo dosyaları iyzico üye işyeri panelinden alınıp public/ altına konulabilir.
const ROZETLER = `<div class="pay" aria-label="Ödeme yöntemleri">
<svg role="img" aria-label="iyzico ile öde" width="118" height="32" viewBox="0 0 118 32"><rect width="118" height="32" rx="6" fill="#1e64ff"/><text x="59" y="21" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="14" font-weight="700" fill="#fff">iyzico ile öde</text></svg>
<svg role="img" aria-label="Visa" width="64" height="32" viewBox="0 0 64 32"><rect width="64" height="32" rx="6" fill="#fff" stroke="#d9d9d9"/><text x="32" y="22" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="17" font-weight="900" font-style="italic" fill="#1a1f71" letter-spacing="1">VISA</text></svg>
<svg role="img" aria-label="Mastercard" width="64" height="32" viewBox="0 0 64 32"><rect width="64" height="32" rx="6" fill="#fff" stroke="#d9d9d9"/><circle cx="26" cy="16" r="10" fill="#eb001b"/><circle cx="38" cy="16" r="10" fill="#f79e1b"/><path d="M32 8a10 10 0 0 1 0 16a10 10 0 0 1 0-16z" fill="#ff5f00"/></svg>
</div>`;

const footer = (aktif: string) => `<footer><nav>${SAYFALAR.map(([f, ad]) => f === aktif ? `<b>${esc(ad)}</b>` : `<a href="./${f}">${esc(ad)}</a>`).join(" · ")}</nav>
${ROZETLER}
<p class="m">${metin(SATICI.unvan)} · ${esc(SATICI.adres)} · <a href="mailto:${SATICI.eposta}">${SATICI.eposta}</a><br>Ödemeler iyzico güvencesiyle alınır; kart bilgileriniz Celse sunucularında saklanmaz. <a href="./">Celse'ye dön</a></p></footer>`;

const page = (dosya: string, title: string, body: string) => `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>
:root{color-scheme:light dark;--bg:#fbf7f7;--fg:#1c0a0f;--mut:#6b4a52;--acc:#8c1d2f;--panel:#f3eaeb;--ph:#fff1a8}
@media (prefers-color-scheme:dark){:root{--bg:#1c0a0f;--fg:#f4ecee;--mut:#c79aa3;--acc:#e7a3ae;--panel:#2a1118;--ph:#5c4a00}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 -apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:32px 16px 64px}h1{color:var(--acc);font-size:26px;margin:0 0 4px}h2{color:var(--acc);font-size:20px;margin-top:40px}
.m{color:var(--mut);font-size:14px}a{color:var(--acc)}hr{border:0;border-top:1px solid var(--mut);opacity:.3;margin:32px 0}
ul{padding-left:22px}li{margin:6px 0}mark.ph{background:var(--ph);color:inherit;padding:0 3px;border-radius:3px}
.not{background:var(--panel);border-left:3px solid var(--acc);padding:12px 14px;margin:16px 0;border-radius:4px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin:24px 0}
.card{background:var(--panel);border-radius:12px;padding:18px}.card h3{margin:0 0 4px;font-size:17px}
.price{font-size:26px;font-weight:700;color:var(--acc)}.price small{font-size:14px;font-weight:400;color:var(--mut)}
footer{border-top:1px solid color-mix(in srgb,var(--mut) 30%,transparent);margin-top:48px;padding-top:20px;font-size:14px}
footer nav{line-height:2}.pay{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
</style></head><body><main>${body}
${footer(dosya)}</main></body></html>`;

const yazdir = (b: Belge) => page(b.dosya, `Celse · ${b.baslik}`, `
<h1>${esc(b.baslik)}</h1><p class="m">Celse · Son güncelleme: ${SON_GUNCELLEME}</p>
${b.giris ? `<p>${metin(b.giris)}</p>` : ""}
${b.bolumler.map(s => `<h2>${esc(s.baslik)}</h2>\n${s.bloklar.map(blok).join("\n")}`).join("\n")}`);

const out: Record<string, string> = {};
for (const b of BELGELER) out[b.dosya] = yazdir(b);

const kart = (u: typeof URUNLER[number]) => `<div class="card"><h3>${esc(u.ad)}</h3>
<div class="price">${esc(u.fiyatMetni)}${u.donem ? ` <small>/ ${u.donem}</small>` : ""}</div><div class="m">KDV dahil${u.tur === "abonelik" ? " · otomatik yenilenir, istediğiniz an iptal" : " · tek seferlik"}</div>
<p>${metin(u.kisa)}</p><ul>${u.icerik.map(x => `<li>${metin(x)}</li>`).join("")}</ul></div>`;

out[FIYATLAR.dosya] = page(FIYATLAR.dosya, "Celse · Fiyatlar", `
<h1>${esc(FIYATLAR.baslik)}</h1><p class="m">Son güncelleme: ${SON_GUNCELLEME}</p>
<p>${metin(FIYATLAR.giris)}</p>
<h2>Celse Pro</h2><div class="grid">${URUNLER.filter(u => u.tur === "abonelik").map(kart).join("")}</div>
<h2>Derdini Anlat</h2><div class="not">${metin(DANISMA_UYARI)}</div><div class="grid">${URUNLER.filter(u => u.tur === "kredi").map(kart).join("")}</div>
<h2>Nasıl satın alınır?</h2><p>${metin(FIYATLAR.satinAl)} <a href="./">Celse'yi aç</a></p>
<ul>${FIYATLAR.notlar.map(n => `<li>${metin(n)}</li>`).join("")}</ul>
<p>Satın almadan önce <a href="./on-bilgilendirme.html">Ön Bilgilendirme Formu</a>, <a href="./satis-sozlesmesi.html">Mesafeli Satış Sözleşmesi</a> ve <a href="./iade.html">İade ve Cayma Hakkı Politikası</a>'nı okuyun.</p>`);

const eksik = new Set<string>();
for (const [f, html] of Object.entries(out)) {
  writeFileSync(`public/${f}`, html);
  for (const m of html.matchAll(/\[DOLDURULACAK:[^\]]*\]/g)) eksik.add(m[0].replace(/&quot;/g, "\""));
}
console.log(`yazıldı: ${Object.keys(out).map(f => "public/" + f).join(", ")}`);
if (eksik.size) console.log(`\nYayımdan önce doldurulacak ${eksik.size} yer tutucu:\n- ${[...eksik].join("\n- ")}`);
