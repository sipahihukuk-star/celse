// Kişilerin tahmini cinsiyeti (fotoğraf ve ses seçimi için): önce ada, yoksa görünüme bakılır.
import { CaseFile, Look } from "../engine/types";

export const FEMALE = new Set(("ayşe fatma zeynep elif emine hatice merve selin derya esra gül nur seda özlem aslı burcu ebru pınar sevgi canan leyla melek nazlı sibel tuğba " +
  "yasemin gamze didem filiz hande ipek meltem nesrin sevim şule ülkü zehra gülay gülsüm hülya nermin sevda songül feride nilüfer dilek ayten hacer " +
  "esma büşra kübra sema şeyma tülay yeliz aylin ceren cansu damla ezgi gizem irem melis nazan oya pelin serap sinem tuba tülin aysel nurcan gönül " +
  "berna eda sevil şükran hilal neslihan sena ece buket duygu nihan mine nevin perihan saadet sultan şerife zübeyde ayla birsen figen gülşen hale " +
  "lale meryem müge nalan nihal reyhan rukiye saliha semra sevinç şenay türkan yıldız zerrin zuhal fadime gülten necla nuray tülin halide naciye").split(" "));

export const firstName = (name?: string) => (name || "").replace(/^(Av\.|Dr\.|Prof\.)\s*/i, "").split(/[\s·]+/)[0]?.toLocaleLowerCase("tr") || "";
export function isFemale(look?: Look, name?: string): boolean {
  if (FEMALE.has(firstName(name))) return true;
  if (look?.beard || look?.style === "bald") return false;
  return look?.style === "long" || look?.style === "bun";
}

/** Hâkim cübbesinin yaka rengi (Hâkim ve Savcıların Resmî Kıyafet Yönetmeliği m.4): ceza kırmızı, hukuk yeşil, idari yargı gri.
 *  Yargıtay, Danıştay, Anayasa Mahkemesi ve uluslararası mahkemeler kendi cübbeleriyle (asıl görsel) kalır. */
export function robeOf(c: CaseFile): "" | "-yesil" | "-gri" {
  const ct = c.court;
  if (c.room === "uluslararasi" || /Yargıtay|Danıştay|Anayasa|İnsan Hakları|Uluslararası/.test(ct)) return "";
  if (/Ceza/.test(ct)) return "";
  if (/İdare|Vergi|İdari/.test(ct)) return "-gri";
  return "-yesil";
}

/* ---------- Taraf teşkili: her avukatın yanında duran asıl taraf ---------- */

/** Taraf olmayan (tanık, bilirkişi, savcı, uzlaştırmacı...) kadro üyeleri. */
const NON_PARTY_ROLES = new Set(["judge", "p1", "p2", "opp", "pros", "savci", "partner", "senior", "mentor", "uzl", "dinleyici", "expert", "witness", "tanik", "denetci", "uzman", "analist", "mubasir", "katip"]);
const NON_PARTY_LABEL = /tanık|bilirkişi|uzlaştırmacı|savcı|raportör|denetçi|toksikolog|analist|arka sıra|uzman/i;
const STOP = new Set(["vekili", "vekilleri", "vekil", "müdafii", "müdafileri", "temsilcisi", "temsilcileri", "eden", "ve", "ek", "taraf", "karşı", "şirket", "şirketi", "şirketin", "görüş", "bildiren", "olarak", "itiraz", "temyiz", "tekrar"]);
const PARTY_WORD = /davalı|davacı|katılan|müşteki|mağdur|kiraya veren|kiracı|alacaklı|borçlu|işveren|başvuran|başvurucu|sanık|şüpheli/i;
// İsim çekim ekleri: "alıcının", "davalının", "kulübün", "işverene" gibi biçimler kökle eşleşsin.
const CASE_SUFFIX = /^(n?[ıiuü]n|n?[ıiuü]|y?[ae]|[dt][ae]n?|n[ae]|s[ıiuü]n?|l[ae]r[ıiuü]?n?)$/;

const words = (s: string) => s.toLocaleLowerCase("tr").split(/[^a-zçğıöşüâîûéèëäå]+/).filter(w => w.length >= 3 && !STOP.has(w));
function wordMatch(t: string, s: string) {
  if (t === s) return true;
  const soft = s.replace(/p$/, "b").replace(/ç$/, "c").replace(/t$/, "d").replace(/k$/, "ğ");
  for (const st of [s, soft]) if (t.startsWith(st) && CASE_SUFFIX.test(t.slice(st.length))) return true;
  return false;
}
function score(label: string, role: string) {
  const sw = words(role);
  return words(label).filter(t => sw.some(s => wordMatch(t, s))).length;
}

/** Duruşmada avukatların yanında duran taraflar. left: oyuncunun (p1) tarafı, right: karşı taraf.
 *  Kadroda taraf yoksa yapay bir anahtar döner ("party_p1", "party_p2", "karsi"); yüzü cast() atar.
 *  Devlet ya da idare temsilcisinin kendisi taraf olduğundan onun yanına kimse konmaz. */
export function partiesOf(c: CaseFile): { left?: string; right?: string } {
  const cand = Object.entries(c.cast).filter(([r, m]) => !NON_PARTY_ROLES.has(r) && m.look?.kind !== "robe" && !NON_PARTY_LABEL.test(m.name || ""));
  // Devlet, idare ya da spor kuruluşu: vekili/temsilcisi kurumu temsil eder, yanına ayrıca bir kişi konmaz.
  const rep = (role: string) => /temsilci|idare|bakanlı|vergi dairesi|belediye|federasyon|uefa|fifa|komite|birliği|kurum|hazine/i.test(role);
  if (c.mode === "duel") {
    const side: Record<"p1" | "p2", string | undefined> = { p1: undefined, p2: undefined };
    const rest: string[] = [];
    for (const [r, m] of cand) {
      const a = score(m.name || "", c.sides.p1.role), b = score(m.name || "", c.sides.p2.role);
      const s = a > b ? "p1" : b > a ? "p2" : null;
      if (s && !side[s]) side[s] = r; else if (!s) rest.push(r);
    }
    // Eşleşmeyen kişi, dosyalar oyuncunun tarafından yazıldığı için önce onun tarafına (müvekkil) konur.
    if (!side.p1 && c.cast.client && side.p2 !== "client") side.p1 = "client";
    if (!side.p1 && rest.length) side.p1 = rest.shift();
    return {
      left: side.p1 || (rep(c.sides.p1.role) ? undefined : "party_p1"),
      right: side.p2 || (rep(c.sides.p2.role) ? undefined : "party_p2")
    };
  }
  const left = c.cast.client ? "client" : undefined;
  const other = cand.find(([r, m]) => r !== "client" && PARTY_WORD.test(m.name || "") && score(m.name || "", c.sides.p1.role) === 0);
  // Yüksek mahkemeler, idari yargı ve uluslararası mahkemelerde karşı taraf kurumdur ya da duruşmaya yalnız vekili gelir.
  const inst = c.room === "uluslararasi" || c.room === "yuksek" || /Yargıtay|Danıştay|Anayasa|Sayıştay|İnsan Hakları|Uluslararası|İdare|Vergi/.test(c.court);
  return { left, right: other ? other[0] : c.courtCast?.includes("opp") && !inst ? "karsi" : undefined };
}
