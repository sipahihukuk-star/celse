// Kişilerin tahmini cinsiyeti (fotoğraf ve ses seçimi için): önce ada, yoksa görünüme bakılır.
import { Look } from "../engine/types";

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
