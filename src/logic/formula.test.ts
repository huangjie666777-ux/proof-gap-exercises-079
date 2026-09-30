import { describe, expect, it } from "vitest";
import { ParseError, formatFormula, formulaEqual, parseFormula } from "./formula";

describe("parseFormula", () => {
  it("解析原子与联结词", () => {
    expect(parseFormula("P")).toEqual({ kind: "atom", name: "P" });
    expect(parseFormula("ABC")).toEqual({ kind: "atom", name: "ABC" });
    expect(formatFormula(parseFormula("P ∧ Q"))).toBe("P ∧ Q");
  });
  it("优先级 ∧ > ∨ > →", () => {
    expect(formatFormula(parseFormula("P ∨ Q ∧ R"))).toBe("P ∨ Q ∧ R");
    expect(formatFormula(parseFormula("P ∧ Q → R"))).toBe("P ∧ Q → R");
    const f = parseFormula("P ∨ Q ∧ R");
    expect(f.kind).toBe("or");
  });
  it("→ 右结合，其余左结合", () => {
    expect(formatFormula(parseFormula("P → Q → R"))).toBe("P → Q → R");
    const f = parseFormula("P → Q → R");
    expect(f.kind === "imp" && f.right.kind === "imp").toBe(true);
    const a = parseFormula("P ∧ Q ∧ R");
    expect(a.kind === "and" && a.left.kind === "and").toBe(true);
  });
  it("圆括号改变结构", () => {
    expect(formatFormula(parseFormula("(P ∨ Q) ∧ R"))).toBe("(P ∨ Q) ∧ R");
    expect(formulaEqual(parseFormula("(P)"), parseFormula("P"))).toBe(true);
  });
  it("不把逻辑等价当作相同", () => {
    expect(formulaEqual(parseFormula("P ∧ Q"), parseFormula("Q ∧ P"))).toBe(false);
    expect(formulaEqual(parseFormula("P"), parseFormula("P ∧ P"))).toBe(false);
  });
  it("语法错误定位字符", () => {
    try {
      parseFormula("P ∧ ");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      expect((e as ParseError).pos).toBe(4);
    }
    try {
      parseFormula("P ) Q");
      expect.unreachable();
    } catch (e) {
      expect((e as ParseError).pos).toBe(2);
    }
    try {
      parseFormula("P & Q1");
      expect.unreachable();
    } catch (e) {
      expect((e as ParseError).pos).toBe(5);
    }
  });
  it("ASCII 替代符号", () => {
    expect(formatFormula(parseFormula("P -> Q & R"))).toBe("P → Q ∧ R");
  });
});
