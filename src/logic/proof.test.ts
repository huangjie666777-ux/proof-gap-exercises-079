import { describe, expect, it } from "vitest";
import {
  computeNumbering,
  initialProof,
  isClosedChildBoxBefore,
  isVisibleFrom,
  makeBox,
  makeLine,
} from "./proof";

function sample() {
  const s = initialProof(null, ["P"], "Q");
  const l1 = s.root.children[0]; // 前提行 1
  const l2 = makeLine("reit", "P"); // 行 2
  const box = makeBox(); // 行 3（假设）
  const inner = makeLine("reit", "P"); // 行 4
  box.children.push(inner);
  const l5 = makeLine("impI", "P → P"); // 行 5
  s.root.children.push(l2, box, l5);
  return { s, l1, l2, box, inner, l5 };
}

describe("编号与可见性", () => {
  it("行号按显示顺序自动更新", () => {
    const { s, l1, l2, box, inner, l5 } = sample();
    const n = computeNumbering(s.root);
    expect(n.lineNumber.get(l1.id)).toBe(1);
    expect(n.lineNumber.get(l2.id)).toBe(2);
    expect(n.lineNumber.get(box.children[0].id)).toBe(3);
    expect(n.lineNumber.get(inner.id)).toBe(4);
    expect(n.lineNumber.get(l5.id)).toBe(5);
    expect(n.boxRange.get(box.id)).toEqual({ first: 3, last: 4 });
    // 删除一行后重新编号
    s.root.children.splice(1, 1);
    const n2 = computeNumbering(s.root);
    expect(n2.lineNumber.get(inner.id)).toBe(3);
    expect(n2.lineNumber.get(l5.id)).toBe(4);
  });
  it("分支内部可见外部行，外部不可见分支内部行", () => {
    const { s, l2, box, inner, l5 } = sample();
    expect(isVisibleFrom(s.root, l2.id, inner.id)).toBe(true);
    expect(isVisibleFrom(s.root, inner.id, l5.id)).toBe(false);
    expect(isVisibleFrom(s.root, box.children[0].id, l5.id)).toBe(false);
  });
  it("不能引用自己或之后的行", () => {
    const { s, l2, l5 } = sample();
    expect(isVisibleFrom(s.root, l5.id, l2.id)).toBe(false);
    expect(isVisibleFrom(s.root, l2.id, l2.id)).toBe(false);
  });
  it("已关闭直接子分支可被 →I 类引用", () => {
    const { s, box, l5 } = sample();
    expect(isClosedChildBoxBefore(s.root, box.id, l5.id)).toBe(false);
    box.closed = true;
    expect(isClosedChildBoxBefore(s.root, box.id, l5.id)).toBe(true);
    // 嵌套分支不算直接子分支
    const inner2 = makeBox();
    inner2.closed = true;
    box.children.push(inner2);
    expect(isClosedChildBoxBefore(s.root, inner2.id, l5.id)).toBe(false);
  });
});
