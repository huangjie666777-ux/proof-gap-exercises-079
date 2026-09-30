import { Formula, ParseError, formulaEqual, parseFormula } from "./formula";
import {
  ProofBox,
  ProofLine,
  ProofState,
  firstLine,
  isClosedChildBoxBefore,
  isVisibleFrom,
  lastLine,
  locate,
} from "./proof";

export type LineStatus =
  | { state: "ok" }
  | { state: "error"; reason: string }
  | { state: "dep"; reason: string };

export interface CheckResult {
  lineStatus: Map<string, LineStatus>;
  boxStatus: Map<string, LineStatus>;
  formulas: Map<string, Formula>;
  parseErrors: Map<string, ParseError>;
  complete: boolean;
}

export function checkProof(state: ProofState): CheckResult {
  const lineStatus = new Map<string, LineStatus>();
  const boxStatus = new Map<string, LineStatus>();
  const formulas = new Map<string, Formula>();
  const parseErrors = new Map<string, ParseError>();

  const parseLine = (line: ProofLine): Formula | null => {
    try {
      const f = parseFormula(line.formulaText);
      formulas.set(line.id, f);
      return f;
    } catch (e) {
      if (e instanceof ParseError) parseErrors.set(line.id, e);
      return null;
    }
  };

  const goal = (() => {
    try {
      return parseFormula(state.goalText);
    } catch {
      return null;
    }
  })();

  const refLine = (line: ProofLine, i: number): { line: ProofLine; formula: Formula } | { error: LineStatus } => {
    const label = "第 " + (i + 1) + " 个引用";
    const id = line.refs[i];
    if (!id) return { error: { state: "error", reason: "缺少" + label } };
    const loc = locate(state.root, id);
    if (!loc) return { error: { state: "error", reason: label + "已失效（目标行/分支已被删除）" } };
    if (loc.node.kind !== "line") return { error: { state: "error", reason: label + "应指向一个证明行" } };
    if (!isVisibleFrom(state.root, id, line.id))
      return { error: { state: "error", reason: label + "不可见：只能引用先前可见行，不能引用已关闭或嵌套分支内部" } };
    const status = lineStatus.get(loc.node.id);
    if (status && status.state !== "ok")
      return { error: { state: "dep", reason: label + "所依赖的行无效" } };
    const f = formulas.get(loc.node.id);
    if (!f) return { error: { state: "dep", reason: label + "所依赖的行公式无效" } };
    return { line: loc.node as ProofLine, formula: f };
  };

  const refClosedBox = (line: ProofLine, i: number): { box: ProofBox } | { error: LineStatus } => {
    const label = "第 " + (i + 1) + " 个引用";
    const id = line.refs[i];
    if (!id) return { error: { state: "error", reason: "缺少" + label } };
    const loc = locate(state.root, id);
    if (!loc) return { error: { state: "error", reason: label + "已失效（目标分支已被删除）" } };
    if (loc.node.kind !== "box") return { error: { state: "error", reason: label + "应指向一个假设分支" } };
    if (!isClosedChildBoxBefore(state.root, id, line.id))
      return { error: { state: "error", reason: label + "必须是本层之前已关闭的直接子分支" } };
    const status = boxStatus.get(loc.node.id);
    if (status && status.state !== "ok")
      return { error: { state: "dep", reason: label + "所依赖的分支内部存在无效步骤" } };
    return { box: loc.node as ProofBox };
  };

  const fail = (reason: string): LineStatus => ({ state: "error", reason });

  const checkLine = (line: ProofLine, box: ProofBox, isRoot: boolean): LineStatus => {
    const f = parseLine(line);
    if (!f) {
      const pe = parseErrors.get(line.id);
      return fail(pe ? "公式语法错误（第 " + (pe.pos + 1) + " 个字符）：" + pe.message : "公式语法错误");
    }
    const isFirstInBox = box.children[0]?.id === line.id;
    switch (line.rule) {
      case "premise":
        if (!isRoot) return fail("前提只能出现在最顶层");
        return { state: "ok" };
      case "assumption":
        if (isRoot) return fail("假设必须位于某个假设分支的首行");
        if (!isFirstInBox) return fail("假设必须是所在分支的首行");
        return { state: "ok" };
      case "reit": {
        const r = refLine(line, 0);
        if ("error" in r) return r.error;
        if (!formulaEqual(r.formula, f)) return fail("重申的公式须与被引用行完全相同（按语法树比较）");
        return { state: "ok" };
      }
      case "andI": {
        const a = refLine(line, 0);
        if ("error" in a) return a.error;
        const b = refLine(line, 1);
        if ("error" in b) return b.error;
        if (f.kind !== "and") return fail("合取引入的结论须为 ∧ 公式");
        if (!formulaEqual(f.left, a.formula) || !formulaEqual(f.right, b.formula))
          return fail("结论须恰好由两个引用按顺序合取而成");
        return { state: "ok" };
      }
      case "andE": {
        const a = refLine(line, 0);
        if ("error" in a) return a.error;
        if (a.formula.kind !== "and") return fail("被引用行须为 ∧ 公式");
        if (!formulaEqual(a.formula.left, f) && !formulaEqual(a.formula.right, f))
          return fail("结论须为被引用合取式的某一合取项");
        return { state: "ok" };
      }
      case "orI": {
        const a = refLine(line, 0);
        if ("error" in a) return a.error;
        if (f.kind !== "or") return fail("析取引入的结论须为 ∨ 公式");
        if (!formulaEqual(f.left, a.formula) && !formulaEqual(f.right, a.formula))
          return fail("被引用行须为结论析取式的某一析取项");
        return { state: "ok" };
      }
      case "orE": {
        const d = refLine(line, 0);
        if ("error" in d) return d.error;
        if (d.formula.kind !== "or") return fail("第一个引用须为 ∨ 公式");
        const b1 = refClosedBox(line, 1);
        if ("error" in b1) return b1.error;
        const b2 = refClosedBox(line, 2);
        if ("error" in b2) return b2.error;
        if (b1.box.id === b2.box.id) return fail("两个分支必须是不同的分支");
        const h1 = firstLine(b1.box);
        const h2 = firstLine(b2.box);
        const c1 = lastLine(b1.box);
        const c2 = lastLine(b2.box);
        if (!h1 || !h2 || !c1 || !c2) return fail("分支不能为空");
        const hf1 = formulas.get(h1.id);
        const hf2 = formulas.get(h2.id);
        const cf1 = formulas.get(c1.id);
        const cf2 = formulas.get(c2.id);
        if (!hf1 || !hf2 || !cf1 || !cf2) return { state: "dep", reason: "分支内存在无法解析的公式" };
        if (!formulaEqual(hf1, d.formula.left)) return fail("第一个分支的首行须为析取式左项");
        if (!formulaEqual(hf2, d.formula.right)) return fail("第二个分支的首行须为析取式右项");
        if (!formulaEqual(cf1, cf2)) return fail("两个分支的末行结论必须相同");
        if (!formulaEqual(cf1, f)) return fail("结论须与两个分支的末行相同");
        return { state: "ok" };
      }
      case "impI": {
        const b = refClosedBox(line, 0);
        if ("error" in b) return b.error;
        const h = firstLine(b.box);
        const c = lastLine(b.box);
        if (!h || !c) return fail("分支不能为空");
        const hf = formulas.get(h.id);
        const cf = formulas.get(c.id);
        if (!hf || !cf) return { state: "dep", reason: "分支内存在无法解析的公式" };
        if (f.kind !== "imp") return fail("蕴含引入的结论须为 → 公式");
        if (!formulaEqual(f.left, hf)) return fail("结论前件须等于分支首行假设");
        if (!formulaEqual(f.right, cf)) return fail("结论后件须等于分支末行");
        return { state: "ok" };
      }
      case "impE": {
        const a = refLine(line, 0);
        if ("error" in a) return a.error;
        const b = refLine(line, 1);
        if ("error" in b) return b.error;
        if (a.formula.kind !== "imp") return fail("第一个引用须为 → 公式");
        if (!formulaEqual(a.formula.left, b.formula)) return fail("第二个引用须等于蕴含式的前件");
        if (!formulaEqual(a.formula.right, f)) return fail("结论须等于蕴含式的后件");
        return { state: "ok" };
      }
    }
  };

  const checkBox = (box: ProofBox, isRoot: boolean): LineStatus => {
    let bad = false;
    for (const child of box.children) {
      if (child.kind === "line") {
        const s = checkLine(child, box, isRoot);
        lineStatus.set(child.id, s);
        if (s.state !== "ok") bad = true;
      } else {
        const s = checkBox(child, false);
        boxStatus.set(child.id, s);
        if (s.state !== "ok") bad = true;
      }
    }
    return bad ? { state: "error", reason: "分支内存在无效步骤" } : { state: "ok" };
  };

  const rootStatus = checkBox(state.root, true);

  let allClosed = true;
  const walkClosed = (box: ProofBox) => {
    for (const c of box.children) {
      if (c.kind === "box") {
        if (!c.closed) allClosed = false;
        walkClosed(c);
      }
    }
  };
  walkClosed(state.root);

  const topLast = lastLine(state.root);
  const topFormula = topLast ? formulas.get(topLast.id) : undefined;
  const complete =
    rootStatus.state === "ok" &&
    allClosed &&
    !!goal &&
    !!topFormula &&
    formulaEqual(topFormula, goal);

  return { lineStatus, boxStatus, formulas, parseErrors, complete };
}
