// Dava dosyalarının şeması. Davalar src/data/cases/*.json içinde bu biçimde tutulur.

/** Bayrak ifadesi: "zaman && !kesme", "ispat || usul", "(a && b) || !c" */
export type Expr = string;

export type Side = "p1" | "p2";
export type Winner = Side | "draw";
export type Scene = "office" | "court";

/** Düz metin ya da koşullu parçaların birleşimi. */
export type Text = string | { if?: Expr; text: string }[];

export interface Line {
  /** narr = anlatıcı; p1/p2 = oyuncular; diğerleri cast içindeki karakterler (judge, opp, pros, client) */
  who: string;
  text: string;
  if?: Expr;
}

export interface Look {
  kind: "robe" | "civil" | "back";
  collar?: "hakim" | "avukat";
  skin: string;
  hair: string;
  style?: "short" | "long" | "bun" | "bald" | "curly";
  beard?: boolean;
  glasses?: boolean;
  shirt?: string;
  inner?: string;
  /** cübbe ve yaka rengini özelleştirmek için (ör. yüksek mahkemeler) */
  robe?: string;
  collarColor?: string;
}

export interface CastMember {
  name?: string;
  /** isim plakasının rengi */
  np?: "red" | "green" | "civil";
  look: Look;
  /** "business": şirket ya da kurum adına gelen biri; fotoğraflı sahnede takım elbiseli bir yüz alır (castFaces EXEC). */
  attire?: "business";
}

export interface Fatal {
  label?: string;
  hukum: string;
  summary: string;
}

export interface Choice {
  text: string;
  /** seçeneğin görünmesi için koşul */
  if?: Expr;
  /** puan etkisi; olumlu doğru hamle */
  delta: number;
  /** seçilince açılan bayraklar */
  set?: string[];
  law?: string;
  /** açıklama; boşsa geri bildirim ekranı gösterilmez (ör. müvekkil görüşmesindeki sorular) */
  note?: Text;
  reply?: Line[];
  /** davayı hemen bitiren hamle; seçen taraf kaybeder */
  fatal?: Fatal;
  /** serbest cevap adımında bu sonucun alt puan sınırı (0–100). Sonuçlar yüksekten düşüğe denenir. */
  min?: number;
  /** dilekçe kuran adımlarda: bu seçeneğin dilekçeye yazdığı cümle (önizlemede adımın `section` başlığı altında görünür) */
  doc?: string;
}

/** Serbest cevapta çevrimdışı puanlama için kavram grubu: terimlerden biri geçerse ağırlık kadar puan. */
export interface KeywordGroup { terms: string[]; weight?: number }

/** Delil çantasındaki belge, kanun maddesi ya da beyan. */
export interface EvidenceItem {
  id: string;
  title: string;
  desc: string;
  type: "belge" | "kanun" | "beyan";
  law?: string;
  /** çantaya girmesi için koşul (ör. müvekkil görüşmesinde ortaya çıkan delil) */
  if?: Expr;
}

/** Delil sunulduğunda ya da itiraz edilmediğinde olacaklar. */
export interface EvidenceResponse {
  delta: number;
  note: Text;
  set?: string[];
  law?: string;
  reply?: Line[];
}

export interface Step {
  /** choice: klasik seçenekler (varsayılan) · evidence: çantadan delil sunma · interview: müvekkil görüşmesi
   *  · free: oyuncu cevabını kendisi yazar ya da söyler; puanına göre `choices` içindeki sonuçlardan biri uygulanır */
  kind?: "choice" | "evidence" | "interview" | "free" | "date" | "dilekce";
  /** free: iyi bir cevabın içermesi gerekenler (yapay zekâ değerlendiricisine verilir) */
  rubric?: string;
  /** free: yapay zekâ yokken kullanılan kavram grupları */
  keywords?: KeywordGroup[];
  /** free: örnek iyi cevap (geri bildirimde gösterilir) */
  model?: string;
  side: Side;
  scene: Scene;
  if?: Expr;
  lines: Line[];
  prompt: string;
  /** (JSON'da delil adımı için boş bırakılabilir; yüklenirken tamamlanır) choice adımı: seçenekler; interview adımı: sorulabilecek sorular (yanıt reply ile verilir) */
  choices: Choice[];
  /** evidence: itiraz edilen beyan (ekranda vurgulanır) */
  statement?: Line;
  /** evidence: doğru delillerin kimlikleri */
  correct?: string[];
  /** evidence: doğru delil sunulduğunda */
  hit?: EvidenceResponse;
  /** evidence: yanlış delil sunulduğunda (varsayılan) */
  miss?: EvidenceResponse;
  /** evidence: belirli deliller için özel sonuç */
  responses?: Record<string, EvidenceResponse>;
  /** evidence: itiraz etmeden geçildiğinde */
  pass?: EvidenceResponse;
  /** interview: en fazla kaç soru sorulabileceği */
  limit?: number;
  /** date: oyuncu kanun yolu süresinin son gününü yazar. Sonuçlar (choices) `min` ile seçilir: 100 doğru gün, 50 süreden önceki bir gün, 0 süre geçmiş. */
  deadline?: DeadlineRule;
  /** dilekçe kuran adım: seçilen seçeneğin `doc` cümlesi (free adımda oyuncunun yazdığı metin) bu başlık altına yazılır */
  section?: string;
  /** dilekce: önizlenen dilekçenin başlığı ve künyesi; içerik önceki adımların `section`/`doc` kayıtlarından kurulur */
  paper?: { title: string; meta?: { k: string; v: string }[]; sign?: string };
}

/** Kanun yolu süresi: tebliğ tarihi ve süre. Son gün tatile rastlarsa izleyen iş günü (HMK m.93, CMK m.39, İYUK m.8). */
export interface DeadlineRule {
  /** kararın (ya da karşı taraf dilekçesinin) tebliğ tarihi, GG.AA.YYYY */
  teblig: string;
  /** süre: gün ya da hafta */
  days?: number;
  weeks?: number;
  /** dayanak, ör. "HMK m.345" */
  law: string;
  /** ne için: "istinaf dilekçesi", "cevap dilekçesi" ... */
  what?: string;
}

/** Kanun yolu açısından uyuşmazlığın niteliği; kanunYolu() bunlarla istinaf ve temyizin açık olup olmadığına bakar. */
export interface KesinlikData {
  /** HMK / İİK: uyuşmazlığın (kanun yoluna konu kısmın) değeri, TL */
  deger?: number;
  /** parasal sınırın hangi yılın tutarıyla karşılaştırılacağı (dava açılış yılı; HMK ek m.1) */
  yil?: number;
  /** İYUK m.46/1: kararı temyize açan bent (ör. "a" düzenleyici işlem, "d" meslekten / kamu görevinden çıkarma, "g" imar planı) */
  iyukBent?: string;
  /** İYUK m.46/2-a: tek hâkimle verilen karar (daire yeniden karar verse de temyiz yok) */
  tekHakim?: boolean;
  /** İYUK m.20/A ivedi yargılama: istinaf yok, doğrudan Danıştay'da temyiz */
  ivedi?: boolean;
  /** kanunda kesin olduğu yazılı karar: kısa gerekçe */
  kesin?: string;
}

/** Ceza hükmünün kanun yolu açısından niteliği (CMK m.272/3, m.286/2). */
export interface PenaltyInfo {
  /** hükmolunan hapis cezası, ay */
  hapisAy?: number;
  /** yalnız adli para cezası, TL */
  adliParaTL?: number;
  beraat?: boolean;
  /** beraat hükümlerinde suçun kanundaki üst sınırı: adli para cezası gün sayısı (CMK m.272/3-b) */
  ustSinirGun?: number;
}

export interface Outcome {
  if?: Expr;
  winner: Winner;
  stamp?: string;
  label?: string;
  noCourt?: boolean;
  hukum: Text;
  summary: Text;
  /** kanun yolu: bu kararla dosya kesinleşir; gerekçesi (ör. "İYUK m.45/6: m.46 dışındaki daire kararları kesindir") */
  kesin?: string;
  /** kanun yoluna başvurmakta hukuki yarar yok (ör. talebin tamamı kabul edildi); gerekçesi */
  yarar?: string;
  /** kanun yolu aşamasında dairenin kararının türü (sonraki kanun yolunun açık olup olmadığına etki eder) */
  karar?: "ret" | "duzeltme" | "kaldirma" | "gonderme" | "onama" | "bozma";
  /** ceza davasında hükmün niteliği (istinaf / temyiz kesinlik denetimi için) */
  ceza?: PenaltyInfo;
  /** hukuk davasında kanun yoluna konu aleyhe kısmın değeri, TL (yoksa dosyadaki kanunYolu.deger) */
  deger?: number;
}

export type AppealKind = "istinaf" | "cevap" | "temyiz";

/** Kanun yolu rejimi: hukuk (HMK), icra hukuk (İİK), ceza (CMK), idari yargı (İYUK). */
export type Regime = "hmk" | "iik" | "cmk" | "iyuk";

/** Kanun yolu aşaması: istinaf ya da temyiz incelemesi. Ana dosyanın künyesi, kadrosu ve belgeleri devralınır;
 *  burada yazılanlar onların üstüne yazar. Oyun motoru bunu sıradan bir tek kişilik dosya olarak oynar (appealCase). */
export interface AppealStage {
  court: string;
  courtShort?: string;
  esas?: string;
  kararTarihi?: string;
  bench?: { judges: number; title?: string };
  inscription?: string | null;
  /** oyuncunun bu aşamadaki rolü (ör. "Davacı (işçi) vekili · istinaf eden") */
  role?: string;
  /** karşı tarafın rolü */
  oppRole?: string;
  teaser?: string;
  /** eklenen ya da değişen kişiler (ör. daire başkanı, BAM savcısı) */
  cast?: Record<string, CastMember>;
  courtCast?: string[];
  intro: Line[];
  docs?: { t: string; d: string }[];
  evidence?: EvidenceItem[];
  steps: Step[];
  outcomes: Outcome[];
}

/** İlk derece kararından sonraki kanun yolları. Yazılmayan aşama için motor temel (otomatik) bir yol üretir. */
export interface AppealBlock {
  /** oyuncu kaybettiğinde (ya da kısmen kaybettiğinde) kendi istinafı */
  istinaf?: AppealStage;
  /** oyuncu kazandığında karşı tarafın istinafına cevap dilekçesi */
  cevap?: AppealStage;
  /** istinaf incelemesinden sonra sonuç hâlâ aleyhteyse temyiz */
  temyiz?: AppealStage;
  /** kapalı aşamalar (ör. ["temyiz"]); true: bu dosyada kanun yolu oynatılmaz */
  off?: boolean | AppealKind[];
}

export interface CaseFile {
  id: string;
  mode: "duel" | "solo";
  title: string;
  area: string;
  court: string;
  courtShort: string;
  esas: string;
  kararTarihi: string;
  color: string;
  teaser: string;
  sides: Record<Side, { role: string; short: string }>;
  cast: Record<string, CastMember>;
  /** tek kişilik davalarda duruşma salonunda kimlerin bulunduğu */
  courtCast?: string[];
  /** mahkeme heyeti: kürsüdeki hâkim sayısı (1, 3, 5, 7, 15, 17 ...) */
  /** Kariyer modundaki yeri. level yazılmazsa mahkemeden çıkarılır; order bölüm içindeki sırayı belirler; off: true kariyerde gösterilmez. */
  career?: { level?: number; order?: number; off?: boolean };
  /** Zorluk: basit (maddi hukuk ağırlıklı), orta (bir usul tuzağı), zor (usul tuzakları merkezde). */
  difficulty?: "basit" | "orta" | "zor";
  /** İcra takibi gibi aşamalı (süreç takipli) dosya */
  process?: boolean;
  bench?: { judges: number; title?: string };
  /** salonun görünümü */
  room?: "yerel" | "yuksek" | "uluslararasi" | "tahkim";
  /** Tahkim ve komisyon dosyalarında yer: icc, istac, lcia, uncitral, cas, tff, ihtk, sigorta */
  forum?: "icc" | "istac" | "lcia" | "uncitral" | "cas" | "tff" | "ihtk" | "sigorta" | "baro";
  /** hâkimin arkasındaki yazı; null ise yazı yok */
  inscription?: string | null;
  /** delil çantası */
  evidence?: EvidenceItem[];
  intro: Line[];
  docs: { t: string; d: string }[];
  steps: Step[];
  /** sırayla denenir; ilk tutan kural karardır, sonuncusu koşulsuz olmalı */
  outcomes: Outcome[];
  /** istinaf / temyiz aşamaları (isteğe bağlı; yazılmayan aşama için temel yol üretilir) */
  appeal?: AppealBlock;
  /** kesinlik denetimi için uyuşmazlığın değeri ve niteliği */
  kanunYolu?: KesinlikData;
  /** kanun yolu aşamasından üretilmiş dosyada: ana dava, aşama, temel (otomatik) yol mu, kariyer seviyesi */
  appealOf?: {
    id: string; kind: AppealKind; basic: boolean; level: number; regime?: Regime;
    /** Kanun yolu aşamasında ilk derecedeki kişilerle aynı kalanlar: aşamadaki rol → ilk derecedeki rol (yüz ve ses aynı kalır). */
    same?: Record<string, string>;
    /** oyuncunun ilk derecedeki tarafı */
    side?: Side;
    /** ilk derece karşılıklı (duel) davaydı */
    baseDuel?: boolean;
    /** ilk derece dosyası (yalnız bellekte; kaydedilmez) */
    base?: CaseFile;
  };
}

export interface Player {
  name: string;
  ai: boolean;
  /** internet üzerinden bağlı rakip (hamleleri sunucudan gelir) */
  remote?: boolean;
  level?: "easy" | "hard";
}
