import { useEffect, useMemo, useState } from "react";
import { checkProof } from "./logic/check";
import { EXERCISES, RULE_INFO } from "./logic/exercises";
import { ParseError, parseFormula } from "./logic/formula";
import {
  ProofLine,
  ProofState,
  computeNumbering,
  initialProof,
  locate,
  makeBox,
  makeLine,
} from "./logic/proof";
import { ProofActions, ProofView } from "./components/ProofView";

const STORAGE_KEY = "nd-proof-state-v1";

function cloneState(s: ProofState): ProofState {
  return JSON.parse(JSON.stringify(s)) as ProofState;
}

function loadSaved(): ProofState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProofState;
    if (!parsed.root || !Array.isArray(parsed.premises)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function App() {
  const [state, setState] = useState<ProofState>(() => loadSaved() ?? initialProof(EXERCISES[0].id, EXERCISES[0].premises, EXERCISES[0].goal));
  const [showRules, setShowRules] = useState(false);
  const [customPremises, setCustomPremises] = useState("");
  const [customGoal, setCustomGoal] = useState("");
  const [setupError, setSetupError] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const check = useMemo(() => checkProof(state), [state]);
  const numbering = useMemo(() => computeNumbering(state.root), [state]);

  const mutate = (fn: (s: ProofState) => void) => {
    setState((prev) => {
      const next = cloneState(prev);
      fn(next);
      return next;
    });
  };

  const actions: ProofActions = {
    updateLine(id, patch) {
      mutate((s) => {
        const loc = locate(s.root, id);
        if (loc && loc.node.kind === "line") Object.assign(loc.node, patch);
      });
    },
    setRef(lineId, slot, raw) {
      const trimmed = raw.trim();
      mutate((s) => {
        const loc = locate(s.root, lineId);
        if (!loc || loc.node.kind !== "line") return;
        const line = loc.node as ProofLine;
        while (line.refs.length <= slot) line.refs.push("");
        if (trimmed === "") {
          line.refs[slot] = "";
          return;
        }
        const expectsBox =
          line.rule === "impI" || (line.rule === "orE" && slot > 0);
        if (expectsBox) {
          for (const [id, r] of numbering.boxRange) {
            if (String(r.first) === trimmed && id !== s.root.id) {
              line.refs[slot] = id;
              return;
            }
          }
        } else {
          for (const [id, num] of numbering.lineNumber) {
            if (String(num) === trimmed) {
              line.refs[slot] = id;
              return;
            }
          }
        }
        line.refs[slot] = "invalid:" + trimmed; // 无法解析，校验时报失效
      });
    },
    addLineAfter(boxId, index) {
      mutate((s) => {
        const loc = locate(s.root, boxId);
        if (!loc || loc.node.kind !== "box") return;
        loc.node.children.splice(index + 1, 0, makeLine("reit"));
      });
    },
    addBoxAfter(boxId, index) {
      mutate((s) => {
        const loc = locate(s.root, boxId);
        if (!loc || loc.node.kind !== "box") return;
        loc.node.children.splice(index + 1, 0, makeBox());
      });
    },
    deleteNode(id) {
      mutate((s) => {
        const loc = locate(s.root, id);
        if (!loc) return;
        loc.parent.children.splice(loc.index, 1);
      });
    },
    toggleBox(id) {
      mutate((s) => {
        const loc = locate(s.root, id);
        if (loc && loc.node.kind === "box") loc.node.closed = !loc.node.closed;
      });
    },
  };

  const startExercise = (id: string) => {
    const ex = EXERCISES.find((e) => e.id === id);
    if (!ex) return;
    setState(initialProof(ex.id, ex.premises, ex.goal));
  };

  const startCustom = () => {
    const premises = customPremises
      .split(/[;；\n]/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    try {
      for (const p of premises) parseFormula(p);
      if (!customGoal.trim()) throw new ParseError("目标不能为空", 0);
      parseFormula(customGoal);
    } catch (e) {
      setSetupError(e instanceof ParseError ? "第 " + (e.pos + 1) + " 个字符：" + e.message : "公式无法解析");
      return;
    }
    setSetupError("");
    setState(initialProof(null, premises, customGoal.trim()));
  };

  const reset = () => {
    setState((prev) => initialProof(prev.exerciseId, prev.premises, prev.goalText));
  };

  const goalError = useMemo(() => {
    try {
      parseFormula(state.goalText);
      return "";
    } catch (e) {
      return e instanceof ParseError ? "目标语法错误（第 " + (e.pos + 1) + " 字符）：" + e.message : "目标语法错误";
    }
  }, [state.goalText]);

  return (
    <main>
      <h1>自然演绎证明练习</h1>

      <section className="panel">
        <h2>练习</h2>
        <div className="exercise-bar">
          <select value={state.exerciseId ?? "custom"} onChange={(e) => startExercise(e.target.value)}>
            {EXERCISES.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title}
              </option>
            ))}
            <option value="custom">自定义…</option>
          </select>
          <button onClick={reset}>重置本题</button>
          <button onClick={() => setShowRules((v) => !v)}>{showRules ? "隐藏规则速查" : "规则速查"}</button>
        </div>
        {state.exerciseId && (
          <p className="desc">{EXERCISES.find((e) => e.id === state.exerciseId)?.description}</p>
        )}
        <details className="custom-setup" open={state.exerciseId === null}>
          <summary>自定义题目（前提用分号或换行分隔）</summary>
          <input
            value={customPremises}
            placeholder="前提，如 P → Q; P"
            onChange={(e) => setCustomPremises(e.target.value)}
          />
          <input value={customGoal} placeholder="目标，如 Q" onChange={(e) => setCustomGoal(e.target.value)} />
          <button onClick={startCustom}>开始自定义练习</button>
          {setupError && <span className="error-text">{setupError}</span>}
        </details>
        <p className="goal-line">
          <strong>前提：</strong>
          {state.premises.length ? state.premises.join("，") : "（无）"}
          {"　"}
          <strong>目标：</strong>
          <input
            className="goal-input"
            value={state.goalText}
            onChange={(e) => mutate((s) => void (s.goalText = e.target.value))}
          />
          {goalError && <span className="error-text">{goalError}</span>}
        </p>
      </section>

      {showRules && (
        <section className="panel rules">
          <h2>规则速查</h2>
          <table>
            <thead>
              <tr><th>规则</th><th>记号</th><th>说明</th><th>引用</th></tr>
            </thead>
            <tbody>
              {RULE_INFO.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.symbol}</td>
                  <td>{r.hint}</td>
                  <td>{r.refs}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">
            语法：原子为大写字母串；联结词 ∧ ∨ →（也接受 &amp; | 和 -&gt;），优先级 ∧ &gt; ∨ &gt; →，→ 右结合，其余左结合；可用圆括号。公式按语法树比较，逻辑等价不算相同。
          </p>
        </section>
      )}

      {check.complete && <div className="complete">🎉 证明完成！顶层结论与目标一致，所有步骤均合法。</div>}

      <section className="panel">
        <h2>证明</h2>
        <ProofView state={state} check={check} numbering={numbering} actions={actions} />
      </section>
    </main>
  );
}
