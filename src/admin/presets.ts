// Mahkeme şablonları: yeni dava açarken heyet, salon ve kürsü yazısı bunlardan gelir.
// Heyet sayıları docs/yuksek-mahkemeler.md'deki araştırmaya dayanır.
import { CaseFile, Look } from "../engine/types";

export interface CourtPreset {
  key: string;
  group: "Yerel mahkemeler" | "Kanun yolu ve yüksek mahkemeler" | "Uluslararası mahkemeler";
  label: string;
  court: string;
  courtShort: string;
  judges: number;
  benchTitle?: string;
  room: NonNullable<CaseFile["room"]>;
  inscription: string | null;
  judgeLook: Look;
  judgeName: string;
}

const TR_JUDGE: Look = { kind: "robe", collar: "hakim", skin: "#d9a982", hair: "#6b6b70", style: "short", glasses: true };
const AY = "ADALET MÜLKÜN TEMELİDİR";

export const PRESETS: CourtPreset[] = [
  { key: "asliye-hukuk", group: "Yerel mahkemeler", label: "Asliye / Sulh Hukuk (tek hâkim)", court: "İzmir 1. Asliye Hukuk Mahkemesi", courtShort: "1. ASLİYE HUKUK", judges: 1, room: "yerel", inscription: AY, judgeLook: TR_JUDGE, judgeName: "Hâkim" },
  { key: "is", group: "Yerel mahkemeler", label: "İş Mahkemesi (tek hâkim)", court: "İzmir 1. İş Mahkemesi", courtShort: "1. İŞ MAHKEMESİ", judges: 1, room: "yerel", inscription: AY, judgeLook: TR_JUDGE, judgeName: "Hâkim" },
  { key: "asliye-ceza", group: "Yerel mahkemeler", label: "Asliye Ceza (tek hâkim)", court: "İzmir 1. Asliye Ceza Mahkemesi", courtShort: "1. ASLİYE CEZA", judges: 1, room: "yerel", inscription: AY, judgeLook: TR_JUDGE, judgeName: "Hâkim" },
  { key: "agir-ceza", group: "Yerel mahkemeler", label: "Ağır Ceza (başkan ve iki üye)", court: "İzmir 1. Ağır Ceza Mahkemesi", courtShort: "1. AĞIR CEZA", judges: 3, benchTitle: "Mahkeme Başkanı ve iki üye", room: "yerel", inscription: AY, judgeLook: TR_JUDGE, judgeName: "Mahkeme Başkanı" },
  { key: "idare", group: "Yerel mahkemeler", label: "İdare / Vergi Mahkemesi (başkan ve iki üye)", court: "İzmir 1. İdare Mahkemesi", courtShort: "1. İDARE MAHKEMESİ", judges: 3, benchTitle: "Mahkeme Başkanı ve iki üye", room: "yerel", inscription: AY, judgeLook: TR_JUDGE, judgeName: "Mahkeme Başkanı" },
  { key: "bam", group: "Kanun yolu ve yüksek mahkemeler", label: "Bölge Adliye / İdare Mahkemesi dairesi (3)", court: "İzmir Bölge Adliye Mahkemesi 1. Hukuk Dairesi", courtShort: "BAM · 1. HUKUK DAİRESİ", judges: 3, benchTitle: "Daire Başkanı ve iki üye", room: "yuksek", inscription: AY, judgeLook: TR_JUDGE, judgeName: "Daire Başkanı" },
  { key: "yargitay", group: "Kanun yolu ve yüksek mahkemeler", label: "Yargıtay dairesi (başkan ve dört üye)", court: "Yargıtay Ceza Dairesi", courtShort: "YARGITAY · CEZA DAİRESİ", judges: 5, benchTitle: "Daire Başkanı ve dört üye", room: "yuksek", inscription: AY, judgeLook: TR_JUDGE, judgeName: "Daire Başkanı" },
  { key: "danistay", group: "Kanun yolu ve yüksek mahkemeler", label: "Danıştay dairesi (başkan ve dört üye)", court: "Danıştay 10. Daire", courtShort: "DANIŞTAY · 10. DAİRE", judges: 5, benchTitle: "Daire Başkanı ve dört üye", room: "yuksek", inscription: AY, judgeLook: TR_JUDGE, judgeName: "Daire Başkanı" },
  { key: "sayistay", group: "Kanun yolu ve yüksek mahkemeler", label: "Sayıştay dairesi (başkan ve dört üye)", court: "Sayıştay 3. Daire", courtShort: "SAYIŞTAY · 3. DAİRE", judges: 5, benchTitle: "Daire Başkanı ve dört üye", room: "yuksek", inscription: null, judgeLook: TR_JUDGE, judgeName: "Daire Başkanı" },
  { key: "aym-bolum", group: "Kanun yolu ve yüksek mahkemeler", label: "Anayasa Mahkemesi Bölüm (başkanvekili ve dört üye)", court: "Anayasa Mahkemesi · Birinci Bölüm", courtShort: "ANAYASA MAHKEMESİ · BİRİNCİ BÖLÜM", judges: 5, benchTitle: "Bölüm: başkanvekili ve dört üye", room: "yuksek", inscription: AY, judgeLook: TR_JUDGE, judgeName: "Bölüm Başkanı" },
  { key: "aym-genel-kurul", group: "Kanun yolu ve yüksek mahkemeler", label: "Anayasa Mahkemesi Genel Kurul (15)", court: "Anayasa Mahkemesi · Genel Kurul", courtShort: "ANAYASA MAHKEMESİ · GENEL KURUL", judges: 15, benchTitle: "Genel Kurul", room: "yuksek", inscription: AY, judgeLook: TR_JUDGE, judgeName: "Başkan" },
  { key: "yuce-divan", group: "Kanun yolu ve yüksek mahkemeler", label: "Yüce Divan (Anayasa Mahkemesi Genel Kurulu, 15)", court: "Yüce Divan", courtShort: "YÜCE DİVAN", judges: 15, benchTitle: "Yüce Divan sıfatıyla Genel Kurul", room: "yuksek", inscription: AY, judgeLook: TR_JUDGE, judgeName: "Başkan" },
  { key: "aihm-komite", group: "Uluslararası mahkemeler", label: "AİHM Komite (3)", court: "Avrupa İnsan Hakları Mahkemesi · Komite", courtShort: "AİHM · KOMİTE", judges: 3, benchTitle: "Üç yargıçlı komite", room: "uluslararasi", inscription: null, judgeLook: { kind: "robe", skin: "#e8c09c", hair: "#6b6b70", style: "short", glasses: true, robe: "#1b1d24", collarColor: "#3a6fb0" }, judgeName: "Başkan" },
  { key: "aihm-daire", group: "Uluslararası mahkemeler", label: "AİHM Daire (7)", court: "Avrupa İnsan Hakları Mahkemesi · Daire", courtShort: "AİHM · DAİRE", judges: 7, benchTitle: "Daire: başkan ve altı yargıç", room: "uluslararasi", inscription: null, judgeLook: { kind: "robe", skin: "#e8c09c", hair: "#6b6b70", style: "short", glasses: true, robe: "#1b1d24", collarColor: "#3a6fb0" }, judgeName: "Daire Başkanı" },
  { key: "aihm-buyuk", group: "Uluslararası mahkemeler", label: "AİHM Büyük Daire (17)", court: "Avrupa İnsan Hakları Mahkemesi · Büyük Daire", courtShort: "AİHM · BÜYÜK DAİRE", judges: 17, benchTitle: "Büyük Daire: başkan ve on altı yargıç", room: "uluslararasi", inscription: null, judgeLook: { kind: "robe", skin: "#e8c09c", hair: "#6b6b70", style: "short", glasses: true, robe: "#1b1d24", collarColor: "#3a6fb0" }, judgeName: "Mahkeme Başkanı" },
  { key: "ucm-yargilama", group: "Uluslararası mahkemeler", label: "UCM Yargılama Dairesi (3)", court: "Uluslararası Ceza Mahkemesi · Yargılama Dairesi", courtShort: "UCM · YARGILAMA DAİRESİ", judges: 3, benchTitle: "Başkan yargıç ve iki yargıç", room: "uluslararasi", inscription: null, judgeLook: { kind: "robe", skin: "#b88560", hair: "#151515", style: "short", robe: "#1f2b45", collarColor: "#e8e4da" }, judgeName: "Başkan Yargıç" },
  { key: "ucm-temyiz", group: "Uluslararası mahkemeler", label: "UCM Temyiz Dairesi (5)", court: "Uluslararası Ceza Mahkemesi · Temyiz Dairesi", courtShort: "UCM · TEMYİZ DAİRESİ", judges: 5, benchTitle: "Temyiz Dairesi: beş yargıç", room: "uluslararasi", inscription: null, judgeLook: { kind: "robe", skin: "#b88560", hair: "#151515", style: "short", robe: "#1f2b45", collarColor: "#e8e4da" }, judgeName: "Başkan Yargıç" }
];

/** Şablonu davaya uygular: heyet, salon, kürsü yazısı ve başkanın görünüşü. */
export function applyPreset(c: CaseFile, p: CourtPreset): CaseFile {
  // İstinaf cümlesi yalnızca ilk derece yerel mahkemelerde anlamlıdır; diğerlerinde kapatılır.
  const local = p.group === "Yerel mahkemeler";
  return {
    ...c,
    outcomes: c.outcomes.map(o => ({ ...o, noCourt: local ? o.noCourt : true })),
    court: p.court, courtShort: p.courtShort,
    bench: { judges: p.judges, title: p.benchTitle },
    room: p.room, inscription: p.inscription,
    cast: { ...c.cast, judge: { ...(c.cast.judge || {}), name: p.judgeName, np: "red", look: p.judgeLook } }
  };
}

/** Boş ama geçerli yeni dava. */
export function blankCase(id: string, mode: "solo" | "duel", preset: CourtPreset): CaseFile {
  const base: CaseFile = {
    id, mode, title: "Yeni dava", area: "Hukuk alanı · Konu", court: "", courtShort: "", esas: "2027/1 Esas", kararTarihi: "01.01.2027",
    color: "#36536b", teaser: "Davanın kısa tanıtımı.",
    sides: mode === "duel"
      ? { p1: { role: "Davacı vekili", short: "Davacı" }, p2: { role: "Davalı vekili", short: "Davalı" } }
      : { p1: { role: "Davacı vekili", short: "Siz" }, p2: { role: "Karşı taraf", short: "Karşı taraf" } },
    cast: mode === "duel"
      ? { judge: { name: "Hâkim", np: "red", look: TR_JUDGE },
          p1: { look: { kind: "robe", collar: "avukat", skin: "#dcae86", hair: "#3a2a20", style: "short" } },
          p2: { look: { kind: "robe", collar: "avukat", skin: "#e6bd98", hair: "#2b1d17", style: "long" } } }
      : { judge: { name: "Hâkim", np: "red", look: TR_JUDGE },
          opp: { name: "Karşı taraf vekili", np: "green", look: { kind: "robe", collar: "avukat", skin: "#c99670", hair: "#3a3a3a", style: "short" } },
          client: { name: "Müvekkil", np: "civil", look: { kind: "civil", skin: "#d6a57c", hair: "#1e1612", style: "short", shirt: "#4a4f57", inner: "#c9c4b8" } } },
    courtCast: mode === "solo" ? ["judge", "you", "opp"] : undefined,
    intro: [{ who: "narr", text: "Olayın kısa anlatımı." }],
    docs: [{ t: "Dava dilekçesi", d: "Belgenin kısa açıklaması." }],
    steps: [{
      kind: "choice", side: "p1", scene: "court", lines: [{ who: "judge", text: "Duruşmayı açıyorum." }],
      prompt: "Ne yapacaksınız?",
      choices: [
        { text: "Doğru hamle", delta: 20, set: ["dogru"], note: "Neden doğru olduğunu yazın." },
        { text: "Yanlış hamle", delta: -10, note: "Neden yanlış olduğunu yazın." }
      ]
    }],
    outcomes: [
      { if: "dogru", winner: "p1", hukum: "Davanın KABULÜNE,", summary: "Kazanma gerekçesi." },
      { winner: "p2", hukum: "Davanın REDDİNE,", summary: "Kaybetme gerekçesi." }
    ]
  };
  return applyPreset(base, preset);
}
