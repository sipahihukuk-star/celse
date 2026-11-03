// Gizlilik politikası ve hesap silme sayfalarını uygulamadaki aydınlatma metninden üretir (mağazaların istediği adresler):
//   https://sipahihukuk-star.github.io/celse/gizlilik.html · .../hesap-silme.html
// Çalıştırma: npx tsx tools/privacy.ts
import { writeFileSync } from "fs";
import { KVKK_BASLIK, KVKK_METNI, VERI_SORUMLUSU as V } from "../src/legal/kvkk";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const para = (p: string) => { const i = p.indexOf(":"); return i > 0 && i < 40 ? `<p><b>${esc(p.slice(0, i + 1))}</b>${esc(p.slice(i + 1))}</p>` : `<p>${esc(p)}</p>`; };

const EN = [
  `Data controller: Themiscode Inc. (represented by its developer, Att. Yüksel Sipahi), ${V.adres}, ${V.eposta}. Personal data in the Celse app ("App") is processed in accordance with Turkish Law No. 6698 on the Protection of Personal Data (KVKK).`,
  "Data we process: name and surname, phone number, e-mail address, your password (stored only in irreversibly hashed form), your game progress (cases played, results, scores) and the answers you write or dictate in free-answer steps.",
  "Purposes: creating and managing your account, verifying your identity, keeping your progress across devices, evaluating your free answers, informing you about the service and meeting legal obligations.",
  "Legal grounds: performance of a contract (KVKK Art. 5/2-c), legal obligations (Art. 5/2-ç) and legitimate interest (Art. 5/2-f).",
  "Transfers: data may be transferred to the cloud and AI providers we use (hosting and accounts: Supabase; evaluation of free answers: Anthropic; text-to-speech: Google Cloud), whose servers may be located abroad (KVKK Art. 9). Your name, phone number and e-mail are never sent with your answers.",
  "Leaderboard: only if you choose to join, other players see your name as \"Att. First L.\" (surname initial only), your title, your office city, your chosen character image and your game points; your phone and e-mail are never shown. This is based on your explicit consent (KVKK Art. 5/1); you can leave at any time and your leaderboard entry is then deleted. The self-description you write when creating a character stays on your device and is never sent to our servers.",
  "Usage statistics and error reports: to improve the App we record usage events pseudonymously - which cases are started and finished, game mode, case score, views of the Pro screen and purchases - together with the app version and platform. These records contain no name, phone number or e-mail; we use your member number if you are signed in, otherwise a random identifier generated on your device, and only the administrator can access them. Error reports you send from the hearing screen (the type you choose, your description and the current case, step, on-screen text, version, platform and language) are kept to fix the error and to reply to you in your in-app inbox. When you delete your account these records are detached from your member number and become anonymous (KVKK Art. 5/2-f, legitimate interest).",
  `Your rights (KVKK Art. 11): you may ask whether your data is processed, request information, correction, deletion or destruction, object, and claim compensation. Send requests to ${V.eposta}.`,
  "Retention: data is kept for as long as your account exists and for the periods required by law, then deleted, destroyed or anonymised.",
  `Account deletion: you can permanently delete your account at any time in the App under Account > "Delete my account"; your profile, career and game records are deleted with it. If you cannot access the App, e-mail ${V.eposta} from the address you registered with; requests are completed within 30 days.`,
  "Children: the App is not directed to anyone under 18 and we do not knowingly collect data from minors.",
  "Advertising and tracking: the App shows no ads; your data is not used for advertising, sold, or shared with third parties for advertising."
];

const page = (title: string, body: string) => `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>
:root{color-scheme:light dark;--bg:#fbf7f7;--fg:#1c0a0f;--mut:#6b4a52;--acc:#8c1d2f}
@media (prefers-color-scheme:dark){:root{--bg:#1c0a0f;--fg:#f4ecee;--mut:#c79aa3;--acc:#e7a3ae}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 -apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:32px 16px 64px}h1{color:var(--acc);font-size:26px;margin:0 0 4px}h2{color:var(--acc);font-size:20px;margin-top:40px}
.m{color:var(--mut);font-size:14px}a{color:var(--acc)}hr{border:0;border-top:1px solid var(--mut);opacity:.3;margin:32px 0}
</style></head><body><main>${body}</main></body></html>`;

const date = "4 Kasım 2026";
writeFileSync("public/gizlilik.html", page("Celse · Gizlilik Politikası", `
<h1>Celse · Gizlilik Politikası</h1><p class="m">${KVKK_BASLIK} · Son güncelleme: ${date}</p>
${KVKK_METNI.map(para).join("\n")}
<hr><h2 lang="en">Privacy Policy (English)</h2><p class="m">Last updated: 4 November 2026</p>
${EN.map(para).join("\n")}`));

writeFileSync("public/hesap-silme.html", page("Celse · Hesap silme", `
<h1>Celse · Hesabınızı silme</h1><p class="m">Geliştirici: Themiscode Inc.</p>
<p><b>Uygulamadan:</b> Celse'yi açın → giriş ekranında "Hesap" → <b>"Hesabımı sil"</b> → onaylayın. Üyeliğiniz, kariyeriniz, büronuz ve oyun kayıtlarınız hemen ve kalıcı olarak silinir.</p>
<p><b>E-postayla:</b> Uygulamaya erişemiyorsanız üye olduğunuz e-posta adresinden <a href="mailto:${V.eposta}?subject=Celse%20hesap%20silme">${V.eposta}</a> adresine "Celse hesabımı silin" yazın. Talebiniz en geç 30 gün içinde sonuçlandırılır.</p>
<p><b>Silinen veriler:</b> ad soyad, telefon, e-posta, şifre, kariyer ve oyun sonuçları, büro kayıtları, çevrim içi maç kayıtları. Yasal saklama yükümlülüğü olan kayıtlar (varsa ödeme kayıtları) yalnızca ilgili mevzuatta öngörülen süre boyunca saklanır.</p>
<hr><h2 lang="en">Deleting your account (English)</h2>
<p><b>In the app:</b> open Celse → "Account" on the home screen → <b>"Delete my account"</b> → confirm. Your account, career and game records are deleted immediately and permanently.</p>
<p><b>By e-mail:</b> if you cannot access the app, write to <a href="mailto:${V.eposta}">${V.eposta}</a> from your registered address. Requests are completed within 30 days.</p>`));
console.log("gizlilik.html ve hesap-silme.html yazıldı");
