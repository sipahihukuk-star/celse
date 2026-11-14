// "Takibi yapay zekâyla hazırla" (icra_hazirla): uydurma bir bölge adliye ilamıyla, ağ taklit edilerek (gerçek sunucu ve
// yapay zekâ çağrılmaz). Gidenin kodlu olduğu (2. davalı dahil hiçbir ad, kimlik no, adres açık gitmez), en güçlü modelin
// istendiği, olmazsa ötekine düşüldüğü, cevabın cihazda açılıp doğrulandığı ve föye XML'e yetecek biçimde yazıldığı denenir.
import { readFileSync } from "fs";
import { join } from "path";
const ENV: Record<string, string> = { ANTHROPIC_API_KEY: "x", SUPABASE_URL: "https://t.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "s", SUPABASE_ANON_KEY: "a" };
(globalThis as Record<string, unknown>).Deno = { env: { get: (k: string) => ENV[k] }, serve: () => {} };
const istekler: Record<string, unknown>[] = [];
let modelCevabi: unknown = null;
let opusBozuk = false;
globalThis.fetch = (async (u: string | URL, o?: RequestInit) => {
  const url = String(u);
  const js = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { "Content-Type": "application/json" } });
  if (url.includes("/auth/v1/user")) return js({ id: "11111111-1111-1111-1111-111111111111" });
  if (url.includes("/rpc/")) return js(true);
  if (url.includes("api.anthropic.com")) {
    const b = JSON.parse(String(o?.body || "{}"));
    istekler.push(b);
    if (opusBozuk && b.model === "claude-opus-5-5") return js({ error: "overloaded" }, 529);
    return js(modelCevabi);
  }
  if (url.includes("ozel_yetkiler")) return js([{ evrak: true }]);
  return js([]);
}) as typeof fetch;

import { bosFoy, Foy } from "../src/data/foy";
import { islemisFaiz } from "../src/data/icra";
import { takipTalebiMetni, tumBorclular } from "../src/data/icra";
import { hukumKalemleri } from "../src/data/icraEvrak";
import { hazirlikAdlari, hazirlikCoz, hazirligiUygula, okumaKarsilastir } from "../src/data/icraHazirla";
import { icraSoruKaynagi } from "../src/data/icraSohbet";
import { talimatAyir } from "../src/data/icraTalimat";
import { uyapXml } from "../src/data/icraXml";

let fail = 0;
const ok = (c: unknown, m: string) => { if (c) console.log("✓ " + m); else { fail++; console.log("✗ " + m); } };
const { evrak } = talimatAyir(readFileSync(join(__dirname, "ornek/bam-ilam.txt"), "utf8"));
const istek = (b: Record<string, unknown>) => new Request("https://x/functions/v1/danisma", { method: "POST", headers: { authorization: "Bearer eyJ.test", apikey: "a" }, body: JSON.stringify(b) });

(async () => {
  // Föyde yalnız 1. davacı ve 1. davalı yazılı (2. davalı kurallı okumada kaçmış olsun).
  const f: Foy = { ...bosFoy({ tur: "icra", taraf: "davaci" }), muvekkil: "Ayşe Örnek Deneme", karsiTaraf: "Hayali Yılmaz",
    evraklar: [{ id: "e1", ad: "istinaf-karari.udf", boyut: evrak.length, eklenme: "2026-11-13T10:00:00Z", metin: evrak }] };
  const adlar = hazirlikAdlari(f);
  ok(adlar.some(x => /kurgu yılmaz/i.test(x)) && adlar.some(x => /mehmet deneme/i.test(x)), "evraktaki bütün taraflar kodlanacaklar listesinde: " + adlar.length);
  const k = icraSoruKaynagi(f, "Takibi hazırla", [], "", 110000, adlar);
  const giden = k.dosya + " " + k.soru;
  for (const gizli of ["AYŞE", "Ayşe", "MEHMET DENEME", "HAYALİ", "KURGU YILMAZ", "Kurgu Yılmaz", "11111111110", "22222222220", "33333333330", "44444444440", "Masal Cad", "Deneme Sok", "ÖRNEK AVUKAT", "BAŞKA VEKİL"])
    ok(!giden.includes(gizli), "açık gitmiyor: " + gizli.slice(0, 3) + "…");
  ok(giden.includes("35.000,00 TL") && /HÜKÜM/.test(giden), "tutar ve hüküm metni gidiyor");
  ok(/1 Haziran 2024–30 Temmuz 2026 %24; 31 Temmuz 2026 tarihinden itibaren %31/.test(k.dosya), "güncel yasal faiz dönemleri (7589 s. Kanun, %31) yapay zekâya gidiyor");
  const kod = (re: RegExp) => Object.entries(k.map).find(([, v]) => re.test(v))?.[0] || "";
  const kodT = (iso: string) => Object.entries(k.tarihler).find(([, v]) => v === iso)?.[0] || "";
  const [A1, A2, B1, B2] = [kod(/^ayşe örnek deneme$/i), kod(/^mehmet deneme$/i), kod(/^hayali yılmaz$/i), kod(/^kurgu yılmaz$/i)];
  ok(A1 && A2 && B1 && B2, "dört tarafın kodu var: " + [A1, A2, B1, B2].join(" "));
  const tc = (n: string) => Object.entries(k.map).find(([, v]) => v.replace(/\D/g, "") === n)?.[0] || n;
  const adr = kod(/Masal Cad/);

  // Sunucu: en güçlü model istenir; cevap kodlu JSON.
  const sonuc = {
    ozet: "İstinaf kararı esas alındı. " + A1 + " ve " + A2 + ", " + B1 + " ve " + B2 + "'den müteselsilen istiyor.",
    yol: "ilamli", mahiyet: "4045",
    ilam: { mahkeme: "İzmir Bölge Adliye Mahkemesi 20. Hukuk Dairesi", esasNo: kod(/^2025\/1456/) || "2025/1456", kararNo: kod(/^2026\/2210/) || "2026/2210", kararTarihi: kodT("2026-10-15"), kesinlesme: kodT("2026-10-15") },
    davaTarihi: "",
    alacaklilar: [{ ad: A1, kimlikNo: tc("11111111110"), adres: "" }, { ad: A2, kimlikNo: tc("22222222220"), adres: "" }],
    borclular: [{ ad: B1, kimlikNo: tc("33333333330"), adres: adr }, { ad: B2, kimlikNo: tc("44444444440"), adres: adr }],
    kalemler: [
      { ad: "Maddi tazminat", tutar: 35000, faizTuru: "yasal", faizBaslangic: kodT("2022-02-01"), alacakli: A1 + " ve " + A2, borclular: B1 + " ve " + B2 + " müteselsilen", dayanak: "BAM hüküm 2" },
      { ad: "Vekâlet ücreti", tutar: "10.000,00", faizTuru: "yasal", faizBaslangic: kodT("2026-10-15"), alacakli: A1 + " ve " + A2, borclular: B1 + " ve " + B2, dayanak: "BAM hüküm 3" },
      { ad: "Yargılama gideri", tutar: 2538, faizTuru: "uydurma", faizBaslangic: kodT("2026-10-15"), alacakli: A1, borclular: B1 + " ve " + B2, dayanak: "BAM hüküm 4" },
      { ad: "Hatalı", tutar: 0 }
    ],
    kontrol: ["Kesinleşme şerhini kontrol edin; [AD-99] kodu açılamadı."]
  };
  modelCevabi = { content: [{ type: "text", text: JSON.stringify(sonuc) }], stop_reason: "end_turn" };
  const { handle } = await import("../supabase/functions/danisma/index");
  let r = await handle(istek({ action: "icra_hazirla", dosya: k.dosya, talimat: "" }));
  let j = await r.json();
  ok(r.status === 200 && j.sonuc?.kalemler?.length === 4, "sunucu cevabı: " + r.status + " " + JSON.stringify(j).slice(0, 80));
  ok(istekler[0]?.model === "claude-opus-5-5", "en güçlü model istendi: " + istekler[0]?.model);
  ok(!JSON.stringify(istekler[0]).includes("44444444440") && !/KURGU YILMAZ/i.test(JSON.stringify(istekler[0])), "yapay zekâya giden istekte açık veri yok");
  // Akışlı istek (ağ geçidi süre sınırına takılmasın): gövde boşluklarla başlar, sonunda JSON.
  opusBozuk = true; istekler.length = 0;
  r = await handle(istek({ action: "icra_hazirla", dosya: k.dosya, talimat: "", akis: true }));
  j = JSON.parse((await r.text()).trim());
  ok(j.sonuc?.kalemler?.length === 4, "akışlı cevap çözüldü");
  ok(istekler.some(x => x.model === "claude-opus-5-5") && istekler.some(x => x.model === "claude-sonnet-5-5"), "en güçlü model cevap vermezse öteki modele düşüldü: " + istekler.map(x => x.model).join(","));
  opusBozuk = false;
  // "Yapay zekâya sor" (foy_sor) da akışlı: ağ geçidinin süre sınırına takılmasın (cevap hemen başlar).
  modelCevabi = { content: [{ type: "text", text: "Dosya ilk derece aşamasında." }], stop_reason: "end_turn" };
  r = await handle(istek({ action: "foy_sor", dosya: k.dosya, soru: "Bu dosya ne durumda?", gecmis: [], arama: false, akis: true }));
  const fsr = await r.text();
  ok(r.status === 200 && /^\s/.test(fsr) && JSON.parse(fsr.trim()).cevap === "Dosya ilk derece aşamasında.", "foy_sor akışlı cevap: " + fsr.trim().slice(0, 80));
  r = await handle(istek({ action: "icra_hazirla", dosya: "DAVALI 44444444440 kimlik nolu", talimat: "" }));
  ok(r.status === 422, "kodlanmamış kimlik no reddedildi: " + r.status);

  // Cihaz: kodlar açılır, doğrulanır.
  const h = hazirlikCoz(j.sonuc, k.map, k.tarihler);
  ok(h.alacaklilar.map(x => x.ad.toLocaleLowerCase("tr")).join("|") === "ayşe örnek deneme|mehmet deneme", "alacaklılar açıldı");
  ok(h.borclular.length === 2 && /kurgu yılmaz/i.test(h.borclular[1].ad) && h.borclular[1].kimlikNo === "44444444440", "2. borçlu kimlik no'suyla: " + h.borclular.map(x => x.ad).join(", "));
  ok(/Masal Cad/.test(h.borclular[1].adres || ""), "borçlu adresi açıldı");
  ok(h.kalemler.length === 3 && h.kalemler[1].tutar === 10000, "metin tutar sayıya çevrildi, sıfır tutarlı kalem atıldı");
  ok(h.kalemler[0].faizBaslangic === "2022-02-01" && h.kalemler[0].faizTuru === "yasal", "maddi tazminat: yasal faiz olay tarihinden");
  ok(h.kalemler[2].faizTuru === "yasal" && h.kalemler[2].faizBaslangic === "2026-10-15", "bilinmeyen faiz türü yasal sayıldı; gider karar tarihinden");
  ok(h.ilam?.kararTarihi === "2026-10-15" && h.ilam?.esasNo === "2025/1456" && h.yol === "ilamli" && h.mahiyet === "4045", "ilam bilgileri: " + JSON.stringify(h.ilam));
  ok(/kurgu yılmaz/i.test(h.kalemler[0].borclular || ""), "kalem kimden istendiğini söylüyor");

  // Celse'nin kendi okumasıyla karşılaştırma: tutar ve faiz tutuyor.
  const yerel = hukumKalemleri(evrak, "2026-10-15");
  ok(okumaKarsilastir(h, yerel).length === 0, "kurallı okumayla fark yok: " + JSON.stringify(okumaKarsilastir(h, yerel)));
  const farkli = { ...h, kalemler: [{ ...h.kalemler[0], tutar: 40000 }, h.kalemler[1], { ...h.kalemler[2], faizTuru: "avans" as const }] };
  const fk = okumaKarsilastir(farkli, yerel);
  ok(fk.some(x => x.tur === "fazla") && fk.some(x => x.tur === "eksik") && fk.some(x => x.tur === "faiz"), "farklar gösterilir: " + fk.map(x => x.tur).join(","));

  // Yasal faiz dönemlere bölünür: 01.06.2024'ten %24, 31.07.2026'dan %31.
  const fz = islemisFaiz(35000, "2022-02-01", "2026-11-13", "yasal");
  ok(fz.dilimler.map(d => d.bas + ":" + d.oran).join(",") === "2022-02-01:9,2024-06-01:24,2026-07-31:31" && fz.dilimler[2].gun === 105, "yasal faiz dilimleri %9, %24, %31: " + fz.dilimler.map(d => d.bas + ":" + d.oran));
  // Takibe yaz: XML'e yetecek her şey.
  const { ek, yazilan } = hazirligiUygula(f, h);
  const g = { ...f, ...ek } as Foy;
  ok(/ayşe/i.test(g.muvekkil) && g.muvekkilBilgi?.kimlikNo === "11111111110" && g.ekMuvekkiller?.length === 1, "alacaklılar künyeye");
  ok(/hayali/i.test(g.karsiTaraf) && g.icra?.ekBorclular?.length === 1 && /kurgu/i.test(g.icra.ekBorclular[0].ad) && g.ekKarsiTaraflar?.length === 1, "2. borçlu takibe ve künyeye");
  ok(tumBorclular(g, g.icra).length === 2, "takipte iki borçlu");
  ok(g.icra?.kalemler?.length === 3 && g.icra.kalemler[0].faizBaslangic === "2022-02-01" && g.icra.yol === "ilamli" && g.icra.mahiyet === "4045", "kalemler, yol, mahiyet yazıldı");
  ok(/borçlu: /.test(g.icra?.kalemler?.[0].ad || "") && /alacaklı: /.test(g.icra?.kalemler?.[2].ad || ""), "birden çok taraf varken kalem adında kimden kime: " + g.icra?.kalemler?.[0].ad);
  ok(!!g.icra?.yzHazirlik, "yapay zekâ hazırlığı işaretlendi (kurallı okuma tarafları değiştirmez)");
  ok(yazilan.includes("2 borçlu") && yazilan.includes("3 alacak kalemi"), "yazılanlar: " + yazilan.join(", "));
  const xml = uyapXml(g, g.icra!, { adSoyad: "Örnek Avukat", tcKimlikNo: "10000000146", baroNo: "1", tbbNo: "2", adres: "Hayal Mah." }, "2026-11-13");
  ok(/44444444440/.test(xml) && /33333333330/.test(xml) && /22222222220/.test(xml), "XML'de iki alacaklı ve iki borçlu");
  const tt = takipTalebiMetni(g, g.icra!, "2026-11-13");
  ok(/kurgu yılmaz/i.test(tt) && /35\.000,00/.test(tt), "takip talebinde 2. borçlu ve tutar");
  // Föyde önceden yazılı kimlik no / adres, yapay zekâ boş bıraktıysa korunur.
  const f2 = { ...f, muvekkilBilgi: { adres: "Önceden Yazılı Adres" } } as Foy;
  ok(hazirligiUygula(f2, h).ek.muvekkilBilgi?.adres === "Önceden Yazılı Adres", "boş kalan adres föydekinden korunur");

  console.log(fail ? `\n${fail} hata` : "\nicra hazırla: tamam");
  process.exit(fail ? 1 : 0);
})();
