// Metin ile duruşma fotoğrafları arasındaki tutarlılık denetimi.
//
//   npm run tutarlilik                          → bütün davalar; özet ekrana, ayrıntı TSV'ye
//   npx tsx tools/tutarlilik.ts dosya.json ...  → yalnızca verilen dosyalar
//   --tsv <yol>   TSV'nin yazılacağı yer (varsayılan: geçici klasörde celse-tutarlilik.tsv)
//   --ham         oyuncuya hitabı uyarlamadan (oyundaki uyarlama devre dışıymış gibi) denetle
//
// Kategoriler:
//   a  hitap / cinsiyetli anış ile o kişinin yüzü çelişiyor (oyuncu dışındaki roller; "Derya Bey" gibi metin hataları da)
//   b  metinde yazan yaş (22 yaşında, genç, yaşlı) ile yüzün yaşı uyuşmuyor
//   c  konuşan ya da seslenilen kişinin sahnede yüzü yok
//   d  oyuncunun avukatına sabit cinsiyetle hitap (oyuncunun karakteri öbür cinsiyetteyse yanlış) ya da kime yöneldiği belirsiz avukat hitabı
import "./stub-assets";
import fs from "fs";
import os from "os";
import path from "path";
import { normalizeCase } from "../src/engine/engine";
import { CaseFile } from "../src/engine/types";
import { adaptPlayerAddress, forEachText, Gender, nameGender, Ref, scanCase } from "../src/ui/castText";
import { castFaces, faceAge, faceFemale, speakerVisible, writtenInOffice } from "../src/ui/castFaces";

const argv = process.argv.slice(2);
const flag = (f: string) => { const i = argv.indexOf(f); if (i < 0) return undefined; argv.splice(i, 1); return true; };
const opt = (f: string) => { const i = argv.indexOf(f); if (i < 0) return undefined; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const ham = flag("--ham");
const tsvPath = opt("--tsv") || path.join(os.tmpdir(), "celse-tutarlilik.tsv");
const dir = path.join(__dirname, "../src/data/cases");
const files = argv.length ? argv : fs.readdirSync(dir).filter(f => f.endsWith(".json")).map(f => path.join(dir, f));

type Row = { cat: "a" | "b" | "c" | "d"; id: string; role: string; where: string; who: string; problem: string; text: string };
const rows: Row[] = [];
const clip = (r: Ref) => {
  const a = Math.max(0, r.index - 40), b = Math.min(r.text.length, r.index + r.match.length + 40);
  return (a > 0 ? "…" : "") + r.text.slice(a, b).replace(/\s+/g, " ") + (b < r.text.length ? "…" : "");
};
const G = (g?: Gender) => (g === "f" ? "kadın" : g === "m" ? "erkek" : "?");
const unknownNames = new Map<string, string>();
let written = 0;
const samples: string[] = [];
const clipAt = (t: string, i: number) => t.slice(Math.max(0, i - 10), i + 50).replace(/\s+/g, " ");

for (const file of files) {
  const c: CaseFile = normalizeCase(JSON.parse(fs.readFileSync(file, "utf8")));
  const refs = scanCase(c);
  const faces = castFaces(c, null, false);
  const add = (cat: Row["cat"], r: Ref | null, role: string, problem: string, extra?: Partial<Row>) =>
    rows.push({ cat, id: c.id, role, where: r?.ctx.path || "", who: r?.ctx.who || "", problem, text: r ? clip(r) : "", ...extra });

  for (const [role, m] of Object.entries(c.cast)) {
    if (m.name && !nameGender(m.name) && /^[A-ZÇĞİÖŞÜ][a-zçğıöşü]+ [A-ZÇĞİÖŞÜ]/.test(m.name.replace(/^(Av\.|Dr\.|Dt\.|Ecz\.)\s*/, ""))) unknownNames.set(m.name.split("·")[0].trim(), `${c.id}:${role}`);
  }

  // a — oyuncu dışındaki rollere cinsiyetli hitap
  for (const r of refs) {
    if (r.kind !== "addr" && r.kind !== "gender") continue;
    if (r.tkind === "name" && r.offstage) {
      const ng = nameGender(r.title);
      if (ng && ng !== r.g) add("a", r, "-", `metin hatası: "${r.match}" (${r.title} ${G(ng)} adı)`);
      continue;
    }
    if (!r.role || r.ambiguous) continue;
    if (r.role === "p1") continue;
    const ng = nameGender(c.cast[r.role]?.name);
    if (ng && ng !== r.g) { add("a", r, r.role, `metin hatası: "${r.match}" ama ad ${G(ng)} adı (${c.cast[r.role].name})`); continue; }
    const face = faces[r.role];
    if (!face) continue;
    const fg: Gender = faceFemale(face) ? "f" : "m";
    if (fg !== r.g) add("a", r, r.role, `"${r.match}" → ${G(r.g)}, yüz ${face} (${G(fg)})`);
  }

  // b — yaş
  for (const r of refs) {
    if (r.kind !== "age" || !r.role || r.age === undefined) continue;
    if (r.role === "p1" && c.mode === "solo") continue; // oyuncunun kendi yüzü
    const face = faces[r.role], fa = faceAge(face);
    if (!face || fa === undefined) continue;
    const tol = r.ageWord ? 14 : 12;
    if (Math.abs(fa - r.age) > tol) add("b", r, r.role, `metinde ${r.ageWord ? `"${r.match}" (~${r.age})` : r.age} yaş, yüz ${face} (~${fa})`);
  }

  // c — konuşan ya da seslenilen kişinin yüzü yok
  const seenSpeaker = new Set<string>();
  for (const r of refs) {
    if (r.kind === "vocative" && !r.role && !r.ambiguous) add("c", r, "-", `"${r.match}" diye seslenilen kişi kadroda/sahnede yok`);
    if (r.kind === "addr" && (r.tkind === "pros" || r.tkind === "role") && !r.role && !r.ambiguous) add("c", r, "-", `"${r.match}" diye hitap edilen kişi kadroda/sahnede yok`);
  }
  const lineSpeakers: { who: string; scene: "office" | "court"; where: string; text: string }[] = [];
  const walkLines = (ls: { who: string; text: string }[] | undefined, scene: "office" | "court", where: string) => ls?.forEach((l, i) => lineSpeakers.push({ who: l.who, scene, where: `${where}[${i}]`, text: l.text }));
  walkLines(c.intro, "office", "intro");
  c.steps.forEach((st, si) => {
    const sc = st.scene || "court", P = `steps[${si}]`;
    walkLines(st.lines, sc, `${P}.lines`);
    st.choices.forEach((ch, ci) => walkLines(ch.reply, sc, `${P}.choices[${ci}].reply`));
    for (const k of ["hit", "miss", "pass"] as const) walkLines(st[k]?.reply, sc, `${P}.${k}.reply`);
    Object.entries(st.responses || {}).forEach(([k, r]) => walkLines(r.reply, sc, `${P}.responses.${k}.reply`));
  });
  for (const l of lineSpeakers) {
    if (speakerVisible(c, faces, l.scene, l.who)) continue;
    if (l.scene === "office" && writtenInOffice(l.who)) { written++; continue; }
    const key = `${l.who}@${l.scene}`;
    if (seenSpeaker.has(key)) continue;
    seenSpeaker.add(key);
    const n = lineSpeakers.filter(x => x.who === l.who && x.scene === l.scene).length;
    rows.push({ cat: "c", id: c.id, role: l.who, where: l.where, who: l.who, problem: `${l.who} ${l.scene === "office" ? "büroda" : "salonda"} konuşuyor (${n} satır) ama yüzü çizilmiyor${faces[l.who] ? "" : " (yüzü de yok)"}`, text: l.text.slice(0, 90) });
  }

  // d — oyuncunun avukatına hitap
  const p1Refs = (cc: CaseFile) => scanCase(cc).filter(r => r.kind === "addr" && r.tkind === "lawyer" && (r.role === "p1" || r.ambiguous));
  if (ham) {
    for (const r of p1Refs(c)) add("d", r, r.role || "?", r.ambiguous ? `belirsiz avukat hitabı "${r.match}" (oyuncu mu karşı vekil mi?)` : `oyuncuya sabit hitap "${r.match}": ${r.g === "f" ? "erkek" : "kadın"} karakterde yanlış`);
  } else {
    // Oyundaki uyarlama asıl metin üzerinden karar verir; burada her iki cinsiyet için uyarlanmış metne bakılır.
    const refs = p1Refs(c);
    for (const female of [true, false]) {
      if (!refs.length) break;
      const adapted = new Map<string, string>();
      forEachText(adaptPlayerAddress(c, female), (t, ctx) => adapted.set(ctx.path, t));
      for (const r of refs) {
        const t = adapted.get(r.ctx.path) || "";
        const title = r.match.replace(/\s+(Hanım|Bey|hanım|bey)\S*$/, "");
        const wrong = new RegExp(`${title.replace(/[.]/g, "\\.")}\\s+${female ? "[Bb]ey" : "[Hh]anım"}`);
        if (r.ambiguous ? t.includes(r.match) : wrong.test(t))
          add("d", r, r.role || "?", `${r.ambiguous ? "belirsiz hitap uyarlanamadı" : "uyarlamadan sonra da yanlış"}: "${r.match}" (${female ? "kadın" : "erkek"} karakter)`);
        else if (female) samples.push(`${c.id} · ${r.ctx.path}: "${r.match}" → kadın: "${clipAt(t, r.index)}" · erkek: "${clipAt((() => { let x = ""; forEachText(adaptPlayerAddress(c, false), (tt, cc) => { if (cc.path === r.ctx.path) x = tt; }); return x; })(), r.index)}"`);
      }
    }
  }
}

// Özet
const cats: Record<Row["cat"], string> = { a: "cinsiyet: hitap/anış ↔ yüz", b: "yaş: metin ↔ yüz", c: "sahnede yüzü olmayan konuşan/seslenilen", d: "oyuncuya sabit cinsiyetli ya da belirsiz avukat hitabı" };
console.log(`Tutarlılık denetimi — ${files.length} dosya${ham ? " (uyarlamasız)" : ""}`);
for (const k of Object.keys(cats) as Row["cat"][]) {
  const rs = rows.filter(r => r.cat === k);
  const byCase = new Map<string, number>();
  rs.forEach(r => byCase.set(r.id, (byCase.get(r.id) || 0) + 1));
  console.log(`  ${k}) ${cats[k]}: ${rs.length} (${byCase.size} dosya)`);
}
console.log(`  toplam: ${rows.length}`);
console.log(`  (bilgi: büro sahnesinde hâkim/karşı vekil/savcı satırı ${written} — yazılı beyan sayıldı, çizilmesi beklenmez)`);
const top = (k: Row["cat"]) => rows.filter(r => r.cat === k).slice(0, 12);
for (const k of Object.keys(cats) as Row["cat"][]) {
  const t = top(k);
  if (!t.length) continue;
  console.log(`\n[${k}] ${cats[k]}`);
  for (const r of t) console.log(`  ${r.id} · ${r.where || "-"} · ${r.problem}${r.text ? `\n      ${r.text}` : ""}`);
}
if (samples.length) console.log(`\nOyuncuya hitabın uyarlanması (${samples.length}):\n  ` + samples.join("\n  "));
if (unknownNames.size) console.log(`\nCinsiyeti adından anlaşılmayan ${unknownNames.size} kişi (görünüş/hitap karar verir): ${[...unknownNames.keys()].join(", ")}`);

fs.mkdirSync(path.dirname(tsvPath), { recursive: true });
const esc = (s: string) => s.replace(/[\t\n\r]+/g, " ");
fs.writeFileSync(tsvPath, ["kategori\tdava\trol\tyer\tkonuşan\tsorun\tmetin", ...rows.map(r => [r.cat, r.id, r.role, r.where, r.who, r.problem, r.text].map(esc).join("\t"))].join("\n") + "\n");
console.log(`\nTSV: ${tsvPath} (${rows.length} satır)`);
