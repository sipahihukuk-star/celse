// Seslendirme (Supabase Edge Function, Deno): bir satırı Google Cloud Text-to-Speech ile seslendirir.
// Her (ses, metin) çifti yalnızca bir kez üretilir ve "ses" deposunda saklanır; sonraki isteklerde hazır dosyanın adresi döner.
// Gerekli gizli anahtar: GOOGLE_TTS_KEY (Supabase > Edge Functions > Secrets). Google anahtarı uygulamaya hiç gitmez.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
// Ses bulunamazsa düşülecek WaveNet sesleri (kadın / erkek).
const FALLBACK_F = "tr-TR-Wavenet-A", FALLBACK_M = "tr-TR-Wavenet-B";
const MALE = /Charon|Orus|Fenrir|Iapetus|Algenib|Schedar|Puck|Achird|Algieba|Alnilam|Enceladus|Rasalgethi|Sadachbia|Sadaltager|Umbriel|Zubenelgenubi|Wavenet-B|Wavenet-E/;

// Sunucu anahtarı: eski projelerde SUPABASE_SERVICE_ROLE_KEY, yeni anahtar düzeninde SUPABASE_SECRET_KEYS (JSON).
function serviceKey(): string {
  const old = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (old) return old;
  try { const all = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"); return all.default || Object.values(all)[0] as string; } catch { return ""; }
}

async function sha(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

let lastError = "";
async function synth(text: string, name: string) {
  const r = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize?key=" + Deno.env.get("GOOGLE_TTS_KEY"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: { text }, voice: { languageCode: name.slice(0, 5), name }, audioConfig: { audioEncoding: "MP3", sampleRateHertz: 24000 } })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.audioContent) {
    lastError = name + ": " + r.status + " " + ((j.error && j.error.message) || "");
    console.error("Google TTS", lastError);
    return null;
  }
  return Uint8Array.from(atob(j.audioContent), c => c.charCodeAt(0));
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!Deno.env.get("GOOGLE_TTS_KEY")) return json({ error: "seslendirme kurulmadı" }, 501);
  try {
    const b = await req.json();
    const text = String(b.text || "").trim().slice(0, 900);
    const voice = String(b.voice || "");
    if (!text || !/^(tr-TR|en-US|es-ES|fr-FR|de-DE)-[A-Za-z0-9-]+$/.test(voice)) return json({ error: "geçersiz istek" }, 400);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey());
    const path = voice + "/" + (await sha(voice + "|" + text)) + ".mp3";
    const url = sb.storage.from("ses").getPublicUrl(path).data.publicUrl;
    const head = await fetch(url, { method: "HEAD" });
    if (head.ok) return json({ url });

    // Yedek ses yalnız Türkçe için; diğer dillerde aynı adlı Chirp3 sesi kullanılır.
    const audio = (await synth(text, voice)) || (voice.startsWith("tr-TR") ? await synth(text, MALE.test(voice) ? FALLBACK_M : FALLBACK_F) : null);
    if (!audio) return json({ error: "seslendirilemedi", google: lastError }, 502);
    const up = await sb.storage.from("ses").upload(path, audio, { contentType: "audio/mpeg", upsert: true });
    if (up.error) return json({ error: up.error.message }, 500);
    return json({ url });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
