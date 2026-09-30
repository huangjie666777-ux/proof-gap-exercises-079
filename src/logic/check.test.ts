import { describe, expect, it } from "vitest";
import { checkProof } from "./check";
import { ProofLine, initialProof, makeBox, makeLine } from "./proof";

function line(rule: Parameters<typeof makeLine>[0], text: string, refs: string[] = []) {
  const l = makeLine(rule, text);
  l.refs = refs;
  return l;
}

describe("规则检查", () => {
  it("前提与完成条件", () => {
    const s = initialProof(null, ["P"], "P");
    let r = checkProof(s);
    expect(r.complete).toBe(true);
    s.goalText = "Q";
    r = checkProof(s);
    expect(r.complete).toBe(false);
  });

  it("∧I / ∧E", () => {
    const s = initialProof(null, ["P ∧ Q"], "Q ∧ P");
    const p1 = s.root.children[0] as ProofLine;
    const l2 = line("andE", "Q", [p1.id]);
    const l3 = line("andE", "P", [p1.id]);
    const l4 = line("andI", "Q ∧ P", [l2.id, l3.id]);
    s.root.children.push(l2, l3, l4);
    const r = checkProof(s);
    expect(r.complete).toBe(true);
    // 顺序错误则失败
    l4.refs = [l3.id, l2.id];
    const r2 = checkProof(s);
    expect(r2.lineStatus.get(l4.id)?.state).toBe("error");
  });

  it("→E 与 →I（嵌套假设）", () => {
    const s = initialProof(null, [], "P → (Q → P)");
    const b1 = makeBox();
    (b1.children[0] as ProofLine).formulaText = "P";
    const b2 = makeBox();
    (b2.children[0] as ProofLine).formulaText = "Q";
    const reit = line("reit", "P", [b1.children[0].id]);
    b2.children.push(reit);
    b2.closed = true;
    b1.children.push(b2);
    const imp1 = line("impI", "Q → P", [b2.id]);
    b1.children.push(imp1);
    b1.closed = true;
    const imp2 = line("impI", "P → (Q → P)", [b1.id]);
    s.root.children.push(b1, imp2);
    const r = checkProof(s);
    expect(r.lineStatus.get(reit.id)?.state).toBe("ok");
    expect(r.complete).toBe(true);
  });

  it("∨E 分情况证明", () => {
    const s = initialProof(null, ["P ∨ Q", "P → R", "Q → R"], "R");
    const [d, i1, i2] = s.root.children as ProofLine[];
    const b1 = makeBox();
    (b1.children[0] as ProofLine).formulaText = "P";
    b1.children.push(line("impE", "R", [i1.id, b1.children[0].id]));
    b1.closed = true;
    const b2 = makeBox();
    (b2.children[0] as ProofLine).formulaText = "Q";
    b2.children.push(line("impE", "R", [i2.id, b2.children[0].id]));
    b2.closed = true;
    const ore = line("orE", "R", [d.id, b1.id, b2.id]);
    s.root.children.push(b1, b2, ore);
    const r = checkProof(s);
    expect(r.complete).toBe(true);
    // 两分支末行不同则失败
    (b2.children[1] as ProofLine).formulaText = "P";
    const r2 = checkProof(s);
    // 分支二内部 impE 不再合法，ore 依赖该分支而失效
    expect(r2.lineStatus.get(ore.id)?.state).toBe("dep");
    // 若分支内部合法但末行结论不同，则报规则错误
    (b2.children[1] as ProofLine).rule = "assumption";
    (b2.children[1] as ProofLine).refs = [];
    b2.children[1] = line("reit", "P", [d.id === "" ? "" : (s.root.children[0] as ProofLine).id]);
    (b2.children[1] as ProofLine).formulaText = "P ∨ Q";
    const r3 = checkProof(s);
    expect(r3.lineStatus.get(ore.id)?.state).toBe("error");
  });

  it("引用已关闭分支内部行被拒绝", () => {
    const s = initialProof(null, ["P"], "P");
    const b = makeBox();
    (b.children[0] as ProofLine).formulaText = "Q";
    b.closed = true;
    const bad = line("reit", "Q", [b.children[0].id]);
    s.root.children.push(b, bad);
    const r = checkProof(s);
    const st = r.lineStatus.get(bad.id);
    expect(st?.state).toBe("error");
    expect(st && st.state !== "ok" ? st.reason : "").toContain("不可见");
  });

  it("删除目标后引用报失效且不改指", () => {
    const s = initialProof(null, ["P"], "P");
    const p1 = s.root.children[0] as ProofLine;
    const l2 = line("reit", "P", [p1.id]);
    s.root.children.push(l2);
    expect(checkProof(s).complete).toBe(true);
    s.root.children.splice(0, 1); // 删除前提行
    const r = checkProof(s);
    const st = r.lineStatus.get(l2.id);
    expect(st?.state).toBe("error");
    expect(st && st.state !== "ok" ? st.reason : "").toContain("已失效");
    expect(l2.refs[0]).toBe(p1.id); // 绑定身份不变
  });

  it("依赖无效行会级联", () => {
    const s = initialProof(null, ["P"], "P ∧ P");
    const p1 = s.root.children[0] as ProofLine;
    const bad = line("andE", "P", [p1.id]); // P 不是合取式
    const dep = line("andI", "P ∧ P", [bad.id, bad.id]);
    s.root.children.push(bad, dep);
    const r = checkProof(s);
    expect(r.lineStatus.get(bad.id)?.state).toBe("error");
    expect(r.lineStatus.get(dep.id)?.state).toBe("dep");
  });

  it("编辑后旧成功状态立即撤销", () => {
    const s = initialProof(null, ["P"], "P");
    const p1 = s.root.children[0] as ProofLine;
    const l2 = line("reit", "P", [p1.id]);
    s.root.children.push(l2);
    expect(checkProof(s).complete).toBe(true);
    l2.formulaText = "Q";
    const r = checkProof(s);
    expect(r.complete).toBe(false);
    expect(r.lineStatus.get(l2.id)?.state).toBe("error");
  });

  it("未关闭分支不能完成", () => {
    const s = initialProof(null, [], "P → P");
    const b = makeBox();
    (b.children[0] as ProofLine).formulaText = "P";
    const imp = line("impI", "P → P", [b.id]);
    s.root.children.push(b, imp);
    const r = checkProof(s);
    expect(r.complete).toBe(false);
    const st = r.lineStatus.get(imp.id);
    expect(st?.state).toBe("error");
    b.closed = true;
    expect(checkProof(s).complete).toBe(true);
  });

  it("∨I 与语法错误报告", () => {
    const s = initialProof(null, ["P"], "P ∨ Q");
    const p1 = s.root.children[0] as ProofLine;
    const l2 = line("orI", "P ∨ Q", [p1.id]);
    const l3 = line("reit", "P ∧", [p1.id]);
    s.root.children.push(l2, l3);
    const r = checkProof(s);
    expect(r.lineStatus.get(l2.id)?.state).toBe("ok");
    const st3 = r.lineStatus.get(l3.id);
    expect(st3?.state).toBe("error");
    expect(st3 && st3.state !== "ok" ? st3.reason : "").toContain("语法错误");
  });
});
