// Yönetim panelinin yapay zekâ araçları: dava dosyası denetimi (hata bulma + önerilen düzeltme) ve talep üzerine dosya üretimi.
// Model çağrıları sunucudaki yapay zekâ fonksiyonunun "yonetim" kipinden geçer; bu kip yalnızca sunucuda yönetici
// olarak tanımlı hesaba açıktır (supabase/yonetim.sql). Anahtar hiçbir zaman uygulamaya gelmez.
// Modelin önerdiği her değişiklik uygulanmadan önce yöneticiye gösterilir; uygulandıktan sonra dosya oyun motoruyla
// (doğrulama + bütün yolların oynatılması) yeniden sınanır.
import { AI_FUNCTION, serverReady, SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";
import { getAccessToken } from "../data/account";
import { CASES } from "../data/cases";
import { normalizeCase } from "../engine/engine";
import { CaseFile } from "../engine/types";
import { AiError, applyOps, AuditReport, engineCheck, extractJson, flatten, Issue } from "./aiCore";
import { CourtPreset } from "./presets";
export * from "./aiCore";

type ModelKind = "derin" | "hizli";

/** Sunucudaki modele yönetici olarak soru sorar; modelin yazdığı metni döndürür. */
export async function askAdmin(sistem: string, istek: string, opt: { model?: ModelKind; azami?: number } = {}): Promise<{ text: string; cut: boolean }> {
  if (!serverReady()) throw new AiError("Sunucuya ulaşılamıyor. İnternet bağlantısını kontrol edin.");
  const token = await getAccessToken();
  if (!token) throw new AiError("Yapay zekâ araçları için oyuna yönetici hesabınızla giriş yapın (Giriş yap).");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 170000);
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/${AI_FUNCTION}`, {
      method: "POST", signal: ctrl.signal,
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mode: "yonetim", sistem, istek, model: opt.model || "derin", azami: opt.azami || 6000 })
    });
    const j = await r.json().catch(() => ({} as any));
    if (r.status === 403) throw new AiError("Bu hesap sunucuda yönetici olarak tanımlı değil.");
    if (r.status === 501) throw new AiError("Yapay zekâ anahtarı sunucuda kurulu değil.");
    if (!r.ok) throw new AiError(j.error ? `Sunucu: ${String(j.error).slice(0, 200)}` : `Sunucu hatası (${r.status}).`);
    if (typeof j.text !== "string") throw new AiError("Sunucudaki yapay zekâ fonksiyonu eski sürüm. quick-worker fonksiyonunu GitHub'daki yeni koduyla güncelleyin.");
    return { text: j.text, cut: j.stop === "max_tokens" };
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new AiError("Yapay zekâ zamanında yanıt vermedi. Tekrar deneyin.");
    throw e;
  } finally { clearTimeout(timer); }
}

/* ---------- Denetim ---------- */

const TODAY = "Kasım 2026";

const AUDIT_SYSTEM = [
  "Sen Türk hukukunda uzman, titiz bir hâkim ve bir avukatlık eğitim oyununun baş editörüsün. Oyunda avukat adayları dava dosyalarını oynar; her hamlenin puanı, kanun dayanağı ve açıklaması vardır. Hatalı bir açıklama oyuncuya yanlış hukuk öğretir; bu yüzden işin çok önemli.",
  "Sana bir dava dosyası, 'alan.yolu = değer' satırları hâlinde verilecek. Görevin dosyadaki HATALARI bulmak ve her biri için düzeltme önermek.",
  "Aranacak hatalar:",
  "1) hukuk: yanlış, eksik ya da yürürlükten kalkmış kanun maddesi; yanlış süre, zamanaşımı, hak düşürücü süre; yanlış görevli/yetkili mahkeme veya yargı yolu; yanlış usul (dava şartı arabuluculuk, ihtiyati tedbir, kanun yolu süresi vb.); yerleşik Yargıtay/Danıştay/AYM içtihadına açıkça aykırı açıklama; maddenin içeriğinin yanlış aktarılması.",
  "2) puan: hukuken doğru hamleye eksi (delta<0) ya da yanlış hamleye artı puan; açıklama (note) ile puanın çelişmesi; 'fatal' (davayı hemen kaybettiren) hamlenin gerçekte davayı kaybettirmemesi ya da tersi; delil adımında doğru delilin 'correct' listesinde olmaması.",
  "3) tutarlilik: tarih, tutar, isim, mahkeme, taraf rolü bilgilerinin belgeler, konuşmalar ve karar metinleri arasında çelişmesi; karar metninin (outcomes) bayraklarla ve oynanan yolla uyuşmaması.",
  "4) dil: yazım, noktalama ve dil bilgisi hataları; anlamı bozan cümleler.",
  "5) yapi: sana ayrıca 'motor denetimi' sonuçları verilirse (oyun motorunun bulduğu yapısal hatalar), bunları da düzelt.",
  "Kurallar:",
  "- Yalnızca gerçek ve somut hataları bildir. Üslup tercihi, 'şöyle daha iyi olur' türü öneri yazma.",
  "- Emin olmadığın hukuki noktayı 'dusuk' önemle ve gerekçesini yazarak bildir.",
  "- Mevzuatı bugünkü (" + TODAY + ") hâliyle değerlendir. Dosyadaki olay tarihleri ileri bir yıl (ör. 2027) olabilir; bu oyun kurgusudur, hata sayma.",
  "- Düzeltmeyi yalnızca verilen yolları kullanarak 'islemler' listesiyle ver. Yollar sıfırdan sayar (steps.0 birinci adımdır). 'yer' alanını insan için 1'den sayarak yaz (ör. '2. adım, 3. seçenek').",
  "- islem: 'degistir' (alanın yeni TAM değerini yaz; metnin yalnız bir kelimesi değişse bile bütün metni yaz), 'ekle' (diziye öğe ekler; yol eklenecek konumu gösterir, ör. steps.1.choices.4), 'sil' (öğeyi ya da alanı siler).",
  "- Düzeltmelerin oyunu bozmamalı: var olan bayrak (set) ve koşul (if) adlarını değiştirme; yeni bayrak eklersen onu kullanan bir koşul da ekle.",
  "- Karar metinleri ve açıklamalar Türkçe, sade ve mahkeme diline uygun olsun.",
  "Yanıtın YALNIZCA şu JSON olsun, öncesinde ya da sonrasında hiçbir şey yazma:",
  '{"ozet": "dosya hakkında bir-iki cümlelik genel değerlendirme", "sorunlar": [{"onem": "yuksek|orta|dusuk", "tur": "hukuk|puan|tutarlilik|dil|yapi", "yer": "...", "sorun": "...", "oneri": "...", "islemler": [{"islem": "degistir", "yol": "steps.1.choices.2.note", "deger": "..."}]}]}',
  "Hata yoksa 'sorunlar' boş liste olsun."
].join("\n");

export async function auditCase(c: CaseFile, onStage?: (s: string) => void): Promise<AuditReport> {
  const motor = engineCheck(c);
  onStage?.("Yapay zekâ dosyayı inceliyor…");
  const istek = [
    `Dosya: ${c.title} (${c.id}) · ${c.area} · ${c.court} · ${c.mode === "duel" ? "karşılıklı duruşma (p1 ve p2 iki oyuncu)" : "tek kişilik (oyuncu p1)"}`,
    motor.length ? "Motor denetimi sonuçları:\n" + motor.map(m => "- " + m).join("\n") : "Motor denetimi: yapısal hata yok.",
    "Alanlar:",
    flatten(c)
  ].join("\n\n");
  const { text, cut } = await askAdmin(AUDIT_SYSTEM, istek, { model: "derin", azami: 8000 });
  const j = extractJson<{ ozet?: string; sorunlar?: Issue[] }>(text);
  const sorunlar = (j.sorunlar || []).filter(s => s && s.sorun).map(s => ({ ...s, islemler: Array.isArray(s.islemler) ? s.islemler : [], durum: "bekliyor" as const }));
  return {
    davaId: c.id, baslik: c.title, tarih: new Date().toISOString(), motor,
    ozet: (j.ozet || "") + (cut ? " (Yanıt uzunluk sınırında kesildi; dosyayı bir kez daha denetlemek iyi olur.)" : ""),
    sorunlar
  };
}

/* ---------- Üretim ---------- */

export interface GenRequest {
  mode: "solo" | "duel";
  branch: string;          // ör. "Ticaret"
  preset: CourtPreset;
  difficulty: "basit" | "orta" | "zor";
  topic: string;           // isteğe bağlı konu
  steps: number;           // 4–6
}

const FORMAT = [
  "DOSYA BİÇİMİ (JSON):",
  "- Kök: id, mode ('solo'|'duel'), title (2-4 kelimelik çarpıcı başlık), area ('Alan · Konu'; ilk kelime branşı belirtir: Borçlar Hukuku, Kira Hukuku, Ticaret Hukuku, Kıymetli Evrak, İcra Hukuku, İş Hukuku, Ceza Hukuku, Ceza Muhakemesi, Aile Hukuku, Miras Hukuku, İdare Hukuku, Vergi Hukuku, Anayasa Hukuku, AİHM...), court (il ve numarasıyla tam mahkeme adı), courtShort (BÜYÜK HARF kısa ad, ör. '3. SULH HUKUK'), esas ('2027/412 Esas'), kararTarihi ('14.07.2027'), color (koyu bir renk, '#5a6b3a' gibi), teaser (1-2 cümle, merak uyandıran), difficulty, sides, cast, courtCast, intro, docs, evidence, steps, outcomes.",
  "- sides: {p1: {role, short}, p2: {role, short}}. Tek kişilikte oyuncu p1'dir: p1.short 'Siz', p2.short 'Karşı taraf'. Karşılıklıda short'lar 'Davacı'/'Davalı' gibi.",
  "- cast: konuşan herkes. Anahtarlar: judge (her zaman), opp (karşı taraf avukatı; karşılıklıda gerekmez), client (müvekkil), pros (savcı; ceza davalarında), gerekirse witness, expert gibi. Her biri {name, np, look}. np: hâkim ve savcı 'red', avukat 'green', sivil 'civil'. look: {kind: 'robe'|'civil', collar: 'hakim'|'avukat' (cübbeliyse), skin: '#e8c09c', hair: '#2a2220', style: 'short'|'long'|'bun'|'bald'|'curly', beard?: true, glasses?: true, shirt?: '#hex' (sivilse), inner?: '#hex'}. name örnekleri: 'Hâkim', 'Av. Selim Arıkan · Davalı vekili', 'Ceren Yalçın · Müvekkil'.",
  "- courtCast (yalnız tek kişilik): duruşmada görünenler, ör. ['judge','you','opp'] ya da ['judge','you','opp','client'] ya da ceza davasında ['judge','you','pros','client'].",
  "- Line: {who, text, if?}. who: 'narr' (anlatıcı), 'p1', 'p2' ya da cast anahtarı. Her who cast'te tanımlı olmalı.",
  "- intro: 3-5 satırlık açılış (anlatıcı + müvekkil). docs: 3-6 belge [{t: başlık, d: içerik}] (tarih, tutar, imza gibi ayrıntılarla).",
  "- evidence (delil çantası): [{id: 'ev_...' ya da 'law_...', type: 'belge'|'kanun'|'beyan', title, desc, law?, if?}]. 'if' yazılan delil, o bayrak açılana kadar görünmez (ör. müvekkil görüşmesinde ortaya çıkan makbuz). Delil adımı varsa en az 4 delil olsun; bazıları yanıltıcı.",
  "- Step: {kind?, side: 'p1'|'p2', scene: 'office'|'court', if?, lines: Line[], prompt: soru, choices: Choice[]}.",
  "  kind yoksa 'choice': 3-4 seçenek. 'interview' (müvekkil görüşmesi, scene 'office'): choices sorulabilecek 4-5 sorudur, limit: kaç soru sorulabileceği (ör. 3); her sorunun cevabı reply ile verilir, note boş bırakılır, delta 0-10; bir soru 'set' ile gizli bir delili açabilir.",
  "  'evidence' (itiraz adımı, scene 'court'): statement: karşı tarafın itiraz edilecek beyanı (Line), prompt, correct: doğru delil kimlikleri, hit: {delta, note, set?, reply?}, responses: {delilId: {delta, note}} (yakın ama eksik deliller için), miss: {delta, note} (diğer yanlışlar), pass: {delta, note} (itiraz etmeden geçerse). choices boş liste olabilir.",
  "  'free' (oyuncu cevabı kendisi yazar): rubric: iyi cevabın içermesi gerekenler, keywords: [{terms: ['...'], weight: 30}], model: örnek iyi cevap, choices: puana göre sonuçlar, her birinde min (alt puan sınırı; biri 0 olmalı), delta, note, set.",
  "- Choice: {text (seçenek metni, harf yazma), delta (puan), set?: ['bayrak'], law?: 'TBK m.147 · HMK m.26', note (neden doğru/yanlış: madde ve açıklama), reply?: Line[] (seçimden sonraki konuşmalar), fatal?: {label?, hukum, summary} (davayı o anda kaybettiren ağır usul hatası; ör. süre kaçırma, görevsiz mahkeme), if?: koşul}.",
  "- Puanlar: tam doğru +15..+25, kısmen doğru +5..+10, etkisiz 0, hatalı -10..-25. Her adımda bir doğru seçenek olsun; yanlış seçenekler inandırıcı ve öğretici olsun (gerçek uygulamadaki yaygın hatalar).",
  "- Bayraklar: küçük harf, Türkçe karaktersiz kısa adlar ('zaman', 'tutanakOK'). Koşullarda && || ! ve parantez kullanılır. 'end' bayrağı davayı hemen karara götürür.",
  "- outcomes: yukarıdan aşağı denenen karar kuralları [{if?, winner: 'p1'|'p2'|'draw', stamp?, hukum, summary}]. Sonuncusu koşulsuz olmalı. hukum mahkeme diliyle hüküm fıkrası ('Davanın KABULÜ ile ...,'), summary oyuncuya neden kazandığını/kaybettiğini anlatır. Kısmi kazanç için stamp: 'KISMEN KAZANDINIZ'. hukum ve summary koşullu parçalardan oluşabilir: [{text}, {if, text}].",
  "- Her bayrak bir koşulda kullanılmalı; her koşuldaki bayrağı açan bir seçenek bulunmalı."
].join("\n");

const GEN_RULES = [
  "Sen Türk hukukunda uzman bir hâkim ve bir avukatlık eğitim oyunu için dava dosyası yazan usta bir senaristsin.",
  "Dosyalar gerçekçi, yürürlükteki Türk hukukuna (" + TODAY + ") tam uygun ve öğretici olmalı. Kanun maddelerini doğru numarayla ver; emin olmadığın madde numarasını yazma, kavramı anlat.",
  "Olay Türkiye'de geçer; isimler, şehirler, tutarlar gerçekçi olsun (2027 yılı fiyatları). Her dosyada en az bir usul noktası (süre, görev, yetki, dava şartı, ispat yükü, delil) bulunsun; zorluk 'zor' ise usul tuzakları merkezde olsun.",
  "Dil: sade, akıcı Türkçe; konuşmalar karakterin ağzından doğal olsun.",
  FORMAT
].join("\n\n");

function example(mode: "solo" | "duel"): string {
  const pick = mode === "solo" ? CASES.find(c => c.id === "kira-depozito") : [...CASES].filter(c => c.mode === "duel").sort((a, b) => JSON.stringify(a).length - JSON.stringify(b).length)[0];
  return JSON.stringify(pick || CASES[0]);
}

const slug = (s: string) => s.toLocaleLowerCase("tr").replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

interface Plan { kind?: string; side: string; scene: string; ozet: string; acar?: string[]; kosul?: string | null }

export interface GenResult { c: CaseFile; problems: string[]; log: string[] }

export async function generateCase(req: GenRequest, takenIds: string[], onStage: (s: string) => void): Promise<GenResult> {
  const log: string[] = [];
  const say = (s: string) => { log.push(s); onStage(s); };
  const p = req.preset;
  const want = [
    `Mod: ${req.mode === "solo" ? "tek kişilik (oyuncu p1, tek avukat)" : "karşılıklı duruşma (p1 ve p2 iki oyuncu sırayla oynar; adımların yarısı p1, yarısı p2)"}`,
    `Branş: ${req.branch}`,
    `Mahkeme türü: ${p.label}${p.judges > 1 ? ` · heyet ${p.judges} hâkim` : ""}. Branşa uygun somut mahkemeyi sen seç (ör. Asliye Ticaret, Sulh Hukuk, İcra Hukuk, Aile, Tüketici...).`,
    `Zorluk: ${req.difficulty}`,
    req.topic.trim() ? `Konu / istek: ${req.topic.trim()}` : "Konu: sen seç; mevcut dosyalardan farklı, uygulamada sık görülen bir uyuşmazlık olsun.",
    `Adım sayısı: ${req.steps}${req.mode === "solo" ? " (ilk adım büroda: müvekkil görüşmesi ya da dilekçe; sonra duruşma; en az bir delil (evidence) adımı)" : ""}`
  ].join("\n");

  // 1) İskelet: adımlar hariç her şey + adım planı.
  say("1/3 · Olay, belgeler ve karar kuralları yazılıyor…");
  const s1 = await askAdmin(GEN_RULES, [
    "İSTEK:", want, "",
    "Bu aşamada dosyanın 'steps' DIŞINDAKİ bütün alanlarını yaz ve 'steps' yerine bir 'plan' ver:",
    "plan: [{kind: 'choice'|'interview'|'evidence'|'free', side, scene, ozet: 'adımda ne olacak, doğru hamle ne', acar: ['bu adımda açılabilecek bayraklar'], kosul: null ya da 'adımın görünme koşulu'}]",
    "outcomes yalnızca plandaki bayrakları kullanmalı. Delil adımı varsa 'evidence' listesini şimdi yaz. id alanını 'gecici' yaz.",
    "Yanıtın yalnızca JSON olsun.", "",
    "ÖRNEK DOSYA (biçim için; içeriğini kopyalama):", example(req.mode)
  ].join("\n"), { model: "derin", azami: 7000 });
  const skel = extractJson<any>(s1.text);
  if (!Array.isArray(skel.plan) || !skel.plan.length) throw new AiError("Yapay zekâ adım planı vermedi. Tekrar deneyin.");
  const plan: Plan[] = skel.plan.slice(0, 8);

  // 2) Adımlar: ikişer ikişer, aynı anda yazılır.
  say(`2/3 · ${plan.length} adım yazılıyor…`);
  const head = { ...skel }; delete head.plan;
  const groups: number[][] = [];
  for (let i = 0; i < plan.length; i += 2) groups.push([i, i + 1].filter(k => k < plan.length));
  const parts = await Promise.all(groups.map(async g => {
    const r = await askAdmin(GEN_RULES, [
      "Aşağıdaki dosyanın adım planındaki " + g.map(i => i + 1).join(" ve ") + ". adımları tam JSON olarak yaz.",
      "Plana sadık kal: kind, side, scene, açılan bayrak adları ve koşullar aynı olsun. Seçeneklerin note alanlarında kanun maddesi ve açıklama olsun. Konuşmalar önceki adımlarla tutarlı olsun.",
      'Yanıtın yalnızca şu JSON olsun: {"steps": [ ... ]}', "",
      "DOSYA (adımlar hariç):", JSON.stringify(head), "",
      "PLAN:", JSON.stringify(plan.map((x, i) => ({ no: i + 1, ...x })))
    ].join("\n"), { model: "derin", azami: 7000 });
    const j = extractJson<any>(r.text);
    return (Array.isArray(j) ? j : j.steps || []) as any[];
  }));
  const steps = parts.flat();

  // 3) Birleştir, motorla sına, gerekirse onar.
  let id = `yz-${slug(head.title || req.branch)}`, n = 2;
  while (takenIds.includes(id)) id = `yz-${slug(head.title || req.branch)}-${n++}`;
  let c: CaseFile = normalizeCase({
    ...head, id, mode: req.mode, difficulty: req.difficulty, steps,
    bench: { judges: p.judges, title: p.benchTitle }, room: p.room, inscription: p.inscription,
    cast: { ...head.cast, judge: { ...(head.cast?.judge || {}), np: "red", look: head.cast?.judge?.look || p.judgeLook } }
  } as CaseFile);
  say("3/3 · Oyun motoruyla sınanıyor…");
  let problems = engineCheck(c);
  for (let round = 1; problems.length && round <= 2; round++) {
    say(`Motor ${problems.length} sorun buldu; yapay zekâ onarıyor (${round}. tur)…`);
    const r = await askAdmin(AUDIT_SYSTEM, [
      `Dosya: ${c.title} (${c.id}) · yeni üretildi. Yalnızca motor denetiminin bulduğu yapısal hataları düzelt; ayrıca gördüğün açık hukuki hataları da düzeltebilirsin.`,
      "Motor denetimi sonuçları:\n" + problems.map(m => "- " + m).join("\n"),
      "Alanlar:", flatten(c)
    ].join("\n\n"), { model: "derin", azami: 6000 });
    const j = extractJson<{ sorunlar?: Issue[] }>(r.text);
    try { c = normalizeCase(applyOps(c, (j.sorunlar || []).flatMap(s => s.islemler || []))); } catch (e) { say("Onarım uygulanamadı: " + (e as Error).message); break; }
    problems = engineCheck(c);
  }
  say(problems.length ? `Dosya üretildi ama ${problems.length} yapısal sorun kaldı; düzenleyicide bakın.` : "Dosya üretildi ve bütün yolları sorunsuz oynandı.");
  return { c, problems, log };
}
