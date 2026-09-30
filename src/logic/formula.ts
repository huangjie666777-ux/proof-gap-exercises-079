export type Formula =
  | { kind: "atom"; name: string }
  | { kind: "and" | "or" | "imp"; left: Formula; right: Formula };

export class ParseError extends Error {
  pos: number;
  constructor(message: string, pos: number) {
    super(message);
    this.pos = pos;
  }
}

type Token =
  | { type: "atom"; name: string; pos: number }
  | { type: "and" | "or" | "imp" | "lparen" | "rparen"; pos: number };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === " " || ch === "\t" || ch === "\n") { i++; continue; }
    if (ch >= "A" && ch <= "Z") {
      let j = i;
      while (j < input.length && input[j] >= "A" && input[j] <= "Z") j++;
      tokens.push({ type: "atom", name: input.slice(i, j), pos: i });
      i = j;
      continue;
    }
    if (ch === "\u2227" || ch === "&") tokens.push({ type: "and", pos: i });
    else if (ch === "\u2228" || ch === "|") tokens.push({ type: "or", pos: i });
    else if (ch === "\u2192") tokens.push({ type: "imp", pos: i });
    else if (ch === "-" && input[i + 1] === ">") { tokens.push({ type: "imp", pos: i }); i++; }
    else if (ch === "(") tokens.push({ type: "lparen", pos: i });
    else if (ch === ")") tokens.push({ type: "rparen", pos: i });
    else throw new ParseError(`无法识别的字符 '${ch}'`, i);
    i++;
  }
  return tokens;
}

export function parseFormula(input: string): Formula {
  const tokens = tokenize(input);
  let idx = 0;
  const peek = () => tokens[idx];
  const fail = (msg: string, pos: number): never => { throw new ParseError(msg, pos); };

  function parseImp(): Formula {
    const left = parseOr();
    if (peek()?.type === "imp") {
      idx++;
      const right = parseImp(); // 右结合
      return { kind: "imp", left, right };
    }
    return left;
  }
  function parseOr(): Formula {
    let left = parseAnd();
    while (peek()?.type === "or") {
      idx++;
      left = { kind: "or", left, right: parseAnd() };
    }
    return left;
  }
  function parseAnd(): Formula {
    let left = parseAtom();
    while (peek()?.type === "and") {
      idx++;
      left = { kind: "and", left, right: parseAtom() };
    }
    return left;
  }
  function parseAtom(): Formula {
    const t = peek();
    if (!t) fail("公式意外结束", input.length);
    if (t.type === "atom") { idx++; return { kind: "atom", name: t.name }; }
    if (t.type === "lparen") {
      idx++;
      const inner = parseImp();
      const close = peek();
      if (!close || close.type !== "rparen") fail("缺少右括号 )", close ? close.pos : input.length);
      idx++;
      return inner;
    }
    return fail("此处应为原子命题或 '('", t.pos);
  }

  if (tokens.length === 0) fail("公式为空", 0);
  const result = parseImp();
  const rest = peek();
  if (rest) fail("此处存在多余内容", rest.pos);
  return result;
}

export function formulaEqual(a: Formula, b: Formula): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "atom" && b.kind === "atom") return a.name === b.name;
  if (a.kind !== "atom" && b.kind !== "atom") {
    return formulaEqual(a.left, b.left) && formulaEqual(a.right, b.right);
  }
  return false;
}

const prec = { atom: 3, and: 2, or: 1, imp: 0 } as const;

export function formatFormula(f: Formula): string {
  switch (f.kind) {
    case "atom": return f.name;
    case "and": return `${fmtSide(f.left, f)} \u2227 ${fmtSide(f.right, f)}`;
    case "or": return `${fmtSide(f.left, f)} \u2228 ${fmtSide(f.right, f)}`;
    case "imp": return `${fmtSide(f.left, f)} \u2192 ${fmtSide(f.right, f, true)}`;
  }
}

function fmtSide(f: Formula, parent: Formula, isImpRight = false): string {
  const need =
    prec[f.kind] < prec[parent.kind] ||
    (parent.kind === "imp" && f.kind === "imp" && !isImpRight);
  const s = formatFormula(f);
  return need ? `(${s})` : s;
}
