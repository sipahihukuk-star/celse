// Bayrak ifadeleri için küçük ayrıştırıcı: ! && || ( ) ve bayrak adları.
// eval kullanılmaz; dava dosyası yazarı yalnızca bu dilbilgisini kullanabilir.

export type Flags = Record<string, boolean>;
type Node =
  | { t: "id"; name: string }
  | { t: "not"; a: Node }
  | { t: "and" | "or"; a: Node; b: Node }
  | { t: "lit"; v: boolean };

const cache = new Map<string, Node>();

function tokenize(src: string): string[] {
  const out: string[] = [];
  const re = /\s*(&&|\|\||!|\(|\)|[\p{L}_][\p{L}\p{N}_]*)/uy;
  let i = 0;
  while (i < src.length) {
    if (/\s/.test(src[i])) { i++; continue; }
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) throw new Error(`İfade hatası: "${src}" içinde ${i + 1}. karakter tanınmadı`);
    out.push(m[1]);
    i = re.lastIndex;
  }
  return out;
}

export function parse(src: string): Node {
  const hit = cache.get(src);
  if (hit) return hit;
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const take = (tok?: string) => {
    const t = toks[p++];
    if (tok && t !== tok) throw new Error(`İfade hatası: "${src}" içinde "${tok}" bekleniyordu`);
    return t;
  };
  const orExp = (): Node => {
    let a = andExp();
    while (peek() === "||") { take(); a = { t: "or", a, b: andExp() }; }
    return a;
  };
  const andExp = (): Node => {
    let a = notExp();
    while (peek() === "&&") { take(); a = { t: "and", a, b: notExp() }; }
    return a;
  };
  const notExp = (): Node => {
    if (peek() === "!") { take(); return { t: "not", a: notExp() }; }
    if (peek() === "(") { take(); const n = orExp(); take(")"); return n; }
    const tok = take();
    if (tok === undefined || tok === "&&" || tok === "||" || tok === ")") throw new Error(`İfade hatası: "${src}" eksik`);
    if (tok === "true" || tok === "false") return { t: "lit", v: tok === "true" };
    return { t: "id", name: tok };
  };
  const node = orExp();
  if (p !== toks.length) throw new Error(`İfade hatası: "${src}" fazla parça içeriyor`);
  cache.set(src, node);
  return node;
}

function run(n: Node, f: Flags): boolean {
  switch (n.t) {
    case "id": return !!f[n.name];
    case "lit": return n.v;
    case "not": return !run(n.a, f);
    case "and": return run(n.a, f) && run(n.b, f);
    case "or": return run(n.a, f) || run(n.b, f);
  }
}

/** Koşul yoksa doğru kabul edilir. */
export function test(expr: string | undefined, flags: Flags): boolean {
  return expr ? run(parse(expr), flags) : true;
}

/** İfadede geçen bayrak adları (doğrulama için). */
export function names(expr: string): string[] {
  const out = new Set<string>();
  const walk = (n: Node): void => {
    if (n.t === "id") out.add(n.name);
    else if (n.t === "not") walk(n.a);
    else if (n.t === "and" || n.t === "or") { walk(n.a); walk(n.b); }
  };
  walk(parse(expr));
  return [...out];
}
