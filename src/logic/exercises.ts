import { Exercise, RuleId } from "./proof";

export const EXERCISES: Exercise[] = [
  {
    id: "ex-and-comm",
    title: "合取的交换",
    description: "练习合取消去与合取引入。",
    premises: ["P ∧ Q"],
    goal: "Q ∧ P",
  },
  {
    id: "ex-mp",
    title: "假言推理",
    description: "练习蕴含消去（→E）。",
    premises: ["P → Q", "P"],
    goal: "Q",
  },
  {
    id: "ex-imp-i",
    title: "蕴含引入（嵌套假设）",
    description: "需要开启假设分支并在其中再嵌套假设，最后用 →I 关闭。",
    premises: [],
    goal: "P → (Q → P)",
  },
  {
    id: "ex-or-e",
    title: "分情况证明（析取消去）",
    description: "对析取式分别开启两个假设分支，得到同一结论后用 ∨E。",
    premises: ["P ∨ Q", "P → R", "Q → R"],
    goal: "R",
  },
  {
    id: "ex-mixed",
    title: "综合：分配与推导",
    description: "综合使用 ∧、∨、→ 各条规则。",
    premises: ["P ∧ (Q ∨ R)"],
    goal: "(P ∧ Q) ∨ (P ∧ R)",
  },
];

export const RULE_INFO: { id: RuleId; name: string; symbol: string; hint: string; refs: string }[] = [
  { id: "premise", name: "前提", symbol: "Prem", hint: "直接引用题目给出的前提（仅限顶层）。", refs: "无" },
  { id: "assumption", name: "假设", symbol: "Asm", hint: "假设分支的首行，仅在该分支内部有效。", refs: "无" },
  { id: "reit", name: "重申", symbol: "R", hint: "照抄一个先前可见的公式。", refs: "1 个可见行" },
  { id: "andI", name: "合取引入", symbol: "∧I", hint: "由 A 与 B 推出 A ∧ B。", refs: "2 个可见行" },
  { id: "andE", name: "合取消去", symbol: "∧E", hint: "由 A ∧ B 推出 A 或 B。", refs: "1 个可见行" },
  { id: "orI", name: "析取引入", symbol: "∨I", hint: "由 A 推出 A ∨ B 或 B ∨ A。", refs: "1 个可见行" },
  { id: "orE", name: "析取消去", symbol: "∨E", hint: "由 A ∨ B、从 A 推出 C 的分支、从 B 推出 C 的分支，推出 C。", refs: "1 个可见行 + 2 个已关闭直接子分支" },
  { id: "impI", name: "蕴含引入", symbol: "→I", hint: "由假设 A 推出 B 的分支，推出 A → B。", refs: "1 个已关闭直接子分支" },
  { id: "impE", name: "蕴含消去", symbol: "→E", hint: "由 A → B 与 A 推出 B。", refs: "2 个可见行" },
];

export const REF_COUNT: Record<RuleId, number> = {
  premise: 0,
  assumption: 0,
  reit: 1,
  andI: 2,
  andE: 1,
  orI: 1,
  orE: 3,
  impI: 1,
  impE: 2,
};
