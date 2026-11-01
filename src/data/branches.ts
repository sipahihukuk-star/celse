// Dosyaların branşları. Branş, davanın "area" önekinden ve mahkemesinden çıkarılır.
import { CaseFile } from "../engine/types";

export type Branch = "borclar" | "ticaret" | "icra" | "is" | "ceza" | "aile" | "idare" | "anayasa" | "tahkim";
export const BRANCHES: { id: Branch; label: string; icon: string }[] = [
  { id: "borclar", label: "Borçlar ve Kira", icon: "📜" },
  { id: "ticaret", label: "Ticaret", icon: "🏢" },
  { id: "icra", label: "İcra ve İflas", icon: "📑" },
  { id: "is", label: "İş Hukuku", icon: "🛠️" },
  { id: "ceza", label: "Ceza", icon: "⚖️" },
  { id: "aile", label: "Aile ve Miras", icon: "🏠" },
  { id: "idare", label: "İdare ve Vergi", icon: "🏛️" },
  { id: "anayasa", label: "Anayasa ve İnsan Hakları", icon: "🕊️" },
  { id: "tahkim", label: "Tahkim ve Spor Hukuku", icon: "🌐" }
];
export const branchLabel = (b: Branch) => BRANCHES.find(x => x.id === b)!.label;

export function branchOf(c: CaseFile): Branch {
  const a = (c.area || "").toLocaleLowerCase("tr");
  const court = (c.court || "").toLocaleLowerCase("tr");
  // Sigorta tahkimi ticaret hukukunun (TTK 6. Kitap), tazminat komisyonu insan haklarının alanıdır.
  if (c.forum === "sigorta") return "ticaret";
  if (c.forum === "ihtk") return "anayasa";
  if (c.forum) return "tahkim";
  if (/^icra/.test(a) || /icra hukuk/.test(court)) return "icra";
  if (/^ticaret|^şirketler|^kıymetli evrak|^rekabet/.test(a) || /asliye ticaret/.test(court)) return "ticaret";
  if (/^anayasa|^aihm|^uluslararası|insan hakları/.test(a)) return "anayasa";
  if (/^iş hukuku|^sosyal güvenlik/.test(a) || /iş mahkemesi/.test(court)) return "is";
  if (/^aile|^miras/.test(a) || /aile mahkemesi/.test(court)) return "aile";
  if (/^idare|^imar|^vergi|^kamu ihale|^danıştay|^sayıştay/.test(a) || /idare mahkemesi|vergi mahkemesi|danıştay|sayıştay/.test(court)) return "idare";
  if (/^ceza/.test(a) || /ceza/.test(court)) return "ceza";
  if (/muvazaa|miras|tenkis|saklı pay/.test(a)) return "aile";
  return "borclar";
}
