export type RuleId =
  | "premise"
  | "assumption"
  | "reit"
  | "andI"
  | "andE"
  | "orI"
  | "orE"
  | "impI"
  | "impE";

export interface ProofLine {
  kind: "line";
  id: string;
  formulaText: string;
  rule: RuleId;
  refs: string[]; // 绑定到行/分支的稳定 id
}

export interface ProofBox {
  kind: "box";
  id: string;
  closed: boolean;
  children: ProofNode[];
}

export type ProofNode = ProofLine | ProofBox;

export interface Exercise {
  id: string;
  title: string;
  description?: string;
  premises: string[];
  goal: string;
}

export interface ProofState {
  exerciseId: string | null; // null 表示自定义
  premises: string[];
  goalText: string;
  root: ProofBox;
}

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return prefix + "_" + Date.now().toString(36) + "_" + counter;
}

export function makeLine(rule: RuleId = "reit", formulaText = ""): ProofLine {
  return { kind: "line", id: newId("L"), formulaText, rule, refs: [] };
}

export function makeBox(): ProofBox {
  const box: ProofBox = { kind: "box", id: newId("B"), closed: false, children: [] };
  box.children.push(makeLine("assumption"));
  return box;
}

export function initialProof(exerciseId: string | null, premises: string[], goalText: string): ProofState {
  const root: ProofBox = { kind: "box", id: newId("B"), closed: false, children: [] };
  for (const p of premises) {
    root.children.push(makeLine("premise", p));
  }
  return { exerciseId, premises: [...premises], goalText, root };
}

// ---------- 行号 ----------

export interface Numbering {
  lineNumber: Map<string, number>;
  boxRange: Map<string, { first: number; last: number }>;
  order: string[];
}

export function computeNumbering(root: ProofBox): Numbering {
  const lineNumber = new Map<string, number>();
  const boxRange = new Map<string, { first: number; last: number }>();
  const order: string[] = [];
  let n = 0;
  const walk = (box: ProofBox) => {
    const first = n + 1;
    let last = n;
    for (const child of box.children) {
      if (child.kind === "line") {
        n++;
        lineNumber.set(child.id, n);
        order.push(child.id);
        last = n;
      } else {
        walk(child);
        last = boxRange.get(child.id)!.last;
      }
    }
    boxRange.set(box.id, { first, last });
  };
  walk(root);
  return { lineNumber, boxRange, order };
}

// ---------- 查找 ----------

export interface Located {
  node: ProofNode;
  parent: ProofBox;
  index: number;
  ancestors: ProofBox[]; // 从 root 到 parent
}

export function locate(root: ProofBox, id: string): Located | null {
  const dfs = (box: ProofBox, ancestors: ProofBox[]): Located | null => {
    for (let i = 0; i < box.children.length; i++) {
      const child = box.children[i];
      if (child.id === id) return { node: child, parent: box, index: i, ancestors };
      if (child.kind === "box") {
        const found = dfs(child, [...ancestors, box]);
        if (found) return found;
      }
    }
    return null;
  };
  return dfs(root, []);
}

// ---------- 可见性 ----------

/**
 * 判断目标 id（行或分支）是否可在 fromId 所在位置被引用。
 * 目标必须出现在 fromId 之前，且是 fromId 所在分支或其某个祖先分支的
 * 直接子节点；分支内部的行对外部位置不可见。
 */
export function isVisibleFrom(root: ProofBox, targetId: string, fromId: string): boolean {
  const target = locate(root, targetId);
  const from = locate(root, fromId);
  if (!target || !from) return false;
  const numbering = computeNumbering(root);
  const posOf = (loc: Located): number =>
    loc.node.kind === "line"
      ? numbering.lineNumber.get(loc.node.id)!
      : numbering.boxRange.get(loc.node.id)!.first;
  if (posOf(target) >= posOf(from)) return false;
  const containers = [...from.ancestors, from.parent];
  return containers.includes(target.parent);
}

/** 分支是否为 fromId 所在分支中、位于其之前、且已关闭的直接子分支 */
export function isClosedChildBoxBefore(root: ProofBox, boxId: string, fromId: string): boolean {
  const box = locate(root, boxId);
  const from = locate(root, fromId);
  if (!box || !from || box.node.kind !== "box") return false;
  if (!box.node.closed) return false;
  if (box.parent !== from.parent) return false;
  const numbering = computeNumbering(root);
  const boxFirst = numbering.boxRange.get(boxId)!.first;
  const fromPos =
    from.node.kind === "line"
      ? numbering.lineNumber.get(from.node.id)!
      : numbering.boxRange.get(from.node.id)!.first;
  return boxFirst < fromPos;
}

export function firstLine(box: ProofBox): ProofLine | null {
  const first = box.children[0];
  return first && first.kind === "line" ? first : null;
}

export function lastLine(box: ProofBox): ProofLine | null {
  for (let i = box.children.length - 1; i >= 0; i--) {
    if (box.children[i].kind === "line") return box.children[i] as ProofLine;
  }
  return null;
}
