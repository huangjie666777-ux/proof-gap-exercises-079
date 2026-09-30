import { CheckResult } from "../logic/check";
import { REF_COUNT, RULE_INFO } from "../logic/exercises";
import {
  Numbering,
  ProofBox,
  ProofLine,
  ProofState,
  RuleId,
} from "../logic/proof";

export interface ProofActions {
  updateLine(id: string, patch: Partial<Pick<ProofLine, "formulaText" | "rule">>): void;
  setRef(lineId: string, slot: number, raw: string): void;
  addLineAfter(boxId: string, index: number): void;
  addBoxAfter(boxId: string, index: number): void;
  deleteNode(id: string): void;
  toggleBox(id: string): void;
}

export interface Ctx {
  state: ProofState;
  check: CheckResult;
  numbering: Numbering;
  actions: ProofActions;
}

function slotExpectsBox(rule: RuleId, slot: number): boolean {
  if (rule === "impI") return true;
  if (rule === "orE") return slot > 0;
  return false;
}

function jumpTo(id: string | undefined) {
  if (!id) return;
  const el = document.getElementById("node-" + id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 1200);
  }
}

function RefSlot(props: { ctx: Ctx; line: ProofLine; slot: number }) {
  const { ctx, line, slot } = props;
  const id = line.refs[slot];
  const expectsBox = slotExpectsBox(line.rule, slot);
  let text = "";
  let dead = false;
  if (id) {
    const n = ctx.numbering.lineNumber.get(id);
    if (n !== undefined) text = String(n);
    else {
      const r = ctx.numbering.boxRange.get(id);
      if (r) text = r.first + "-" + r.last;
      else {
        text = "失效";
        dead = true;
      }
    }
  }
  return (
    <span className="ref-slot">
      <input
        className={"ref-input" + (dead ? " dead" : "")}
        value={text}
        placeholder={expectsBox ? "分支" : "行号"}
        title={expectsBox ? "输入分支首行行号后回车绑定" : "输入行号后回车绑定；点击 ↗ 定位"}
        onChange={(e) => ctx.actions.setRef(line.id, slot, e.target.value)}
      />
      {id && !dead && (
        <button className="jump" title="定位到引用目标" onClick={() => jumpTo(id)}>
          ↗
        </button>
      )}
    </span>
  );
}

function LineRow(props: { line: ProofLine; box: ProofBox; index: number; ctx: Ctx }) {
  const { line, box, index, ctx } = props;
  const status = ctx.check.lineStatus.get(line.id);
  const num = ctx.numbering.lineNumber.get(line.id);
  const refCount = REF_COUNT[line.rule];
  const parseErr = ctx.check.parseErrors.get(line.id);
  const stateName = status?.state ?? "error";
  return (
    <div className={"line-row status-" + stateName} id={"node-" + line.id}>
      <span className="lineno">{num}</span>
      <span className="formula-cell">
        <input
          className={"formula-input" + (parseErr ? " parse-error" : "")}
          value={line.formulaText}
          placeholder="公式，如 P ∧ (Q → R)"
          onChange={(e) => ctx.actions.updateLine(line.id, { formulaText: e.target.value })}
        />
        {parseErr && (
          <span className="parse-marker" style={{ paddingLeft: parseErr.pos + "ch" }}>
            ▲ 第 {parseErr.pos + 1} 字符
          </span>
        )}
      </span>
      <select
        className="rule-select"
        value={line.rule}
        onChange={(e) => ctx.actions.updateLine(line.id, { rule: e.target.value as RuleId })}
      >
        {RULE_INFO.map((r) => (
          <option key={r.id} value={r.id}>
            {r.symbol} {r.name}
          </option>
        ))}
      </select>
      <span className="refs">
        {Array.from({ length: refCount }, (_, i) => (
          <RefSlot key={i} ctx={ctx} line={line} slot={i} />
        ))}
      </span>
      <span className={"badge " + stateName} title={status && status.state !== "ok" ? status.reason : "有效"}>
        {stateName === "ok" ? "✓" : stateName === "dep" ? "⛓" : "✗"}
      </span>
      {status && status.state !== "ok" && <span className="reason">{status.reason}</span>}
      <span className="row-actions">
        <button title="在下方新增推导行" onClick={() => ctx.actions.addLineAfter(box.id, index)}>+行</button>
        <button title="在下方开启假设分支" onClick={() => ctx.actions.addBoxAfter(box.id, index)}>+分支</button>
        <button title="删除本行" onClick={() => ctx.actions.deleteNode(line.id)}>删</button>
      </span>
    </div>
  );
}

function BoxView(props: { box: ProofBox; index: number; ctx: Ctx; isRoot?: boolean }) {
  const { box, index, ctx, isRoot } = props;
  const range = ctx.numbering.boxRange.get(box.id);
  const status = ctx.check.boxStatus.get(box.id);
  return (
    <div className={"box" + (isRoot ? " root" : "") + (box.closed ? " closed" : "")} id={"node-" + box.id}>
      {!isRoot && (
        <div className="box-header">
          <span className="box-title">
            假设分支 {range ? range.first + "–" + range.last : ""}
            {box.closed ? "（已关闭）" : "（开放）"}
          </span>
          {status && status.state !== "ok" && (
            <span className="badge error" title={status.reason}>✗</span>
          )}
          <span className="row-actions">
            <button onClick={() => ctx.actions.toggleBox(box.id)}>{box.closed ? "重新打开" : "关闭分支"}</button>
            <button onClick={() => ctx.actions.deleteNode(box.id)}>删除分支</button>
          </span>
        </div>
      )}
      <div className="box-body">
        {box.children.map((child, i) =>
          child.kind === "line" ? (
            <LineRow key={child.id} line={child} box={box} index={i} ctx={ctx} />
          ) : (
            <BoxView key={child.id} box={child} index={i} ctx={ctx} />
          )
        )}
        {box.children.length === 0 && <div className="empty">（空分支）</div>}
      </div>
      <div className="box-footer">
        <button onClick={() => ctx.actions.addLineAfter(box.id, box.children.length - 1)}>+行</button>
        <button onClick={() => ctx.actions.addBoxAfter(box.id, box.children.length - 1)}>+分支</button>
      </div>
    </div>
  );
}

export function ProofView(props: { state: ProofState; check: CheckResult; numbering: Numbering; actions: ProofActions }) {
  const ctx: Ctx = { state: props.state, check: props.check, numbering: props.numbering, actions: props.actions };
  return <BoxView box={props.state.root} index={0} ctx={ctx} isRoot />;
}
