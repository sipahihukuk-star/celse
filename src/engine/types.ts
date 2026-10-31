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
}

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
  /** choice: klasik seçenekler (varsayılan) · evidence: çantadan delil sunma · interview: müvekkil görüşmesi */
  kind?: "choice" | "evidence" | "interview";
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
}

export interface Outcome {
  if?: Expr;
  winner: Winner;
  stamp?: string;
  label?: string;
  noCourt?: boolean;
  hukum: Text;
  summary: Text;
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
  bench?: { judges: number; title?: string };
  /** salonun görünümü */
  room?: "yerel" | "yuksek" | "uluslararasi";
  /** hâkimin arkasındaki yazı; null ise yazı yok */
  inscription?: string | null;
  /** delil çantası */
  evidence?: EvidenceItem[];
  intro: Line[];
  docs: { t: string; d: string }[];
  steps: Step[];
  /** sırayla denenir; ilk tutan kural karardır, sonuncusu koşulsuz olmalı */
  outcomes: Outcome[];
}

export interface Player {
  name: string;
  ai: boolean;
  level?: "easy" | "hard";
}
