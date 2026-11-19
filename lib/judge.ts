import { AXIS_LABEL, type Axis, type Catalog, type Evidence } from "./catalog";

export type Level = "高" | "中" | "低" | "待核实";

export interface AxisResult {
  axis: Axis;
  level: Level;
  /** 参与判断的来源笔记数（去重）。 */
  sources: number;
  /** 最近一篇来源的发布日期。 */
  latest: string | null;
  disputed: boolean;
  /** 可读的判定理由。 */
  reason: string;
  evidence: JudgedEvidence[];
}

export interface JudgedEvidence extends Evidence {
  /** 过旧（超过 365 天）的证据一律按“弱”处理。 */
  stale: boolean;
  publishedAt: string | null;
}

const DAY = 86_400_000;
export const STALE_DAYS = 365;

/**
 * 三轴规则（高/中/低/待核实，不产生总分）：
 * - 无强证据 → 待核实（只有弱证据时仅展示，不下结论）。
 * - 强负面且没有任何正面（含弱正面）→ 低；强负面但有正面 → 中（有争议）。
 * - 强正面 ≥2 条、且没有任何负面 → 高；否则 → 中。
 * - 单一来源的正面最高只到“中”；强负面在没有正面时即判“低”（家庭聚餐宁可保守）。
 * - 超过 365 天的证据按“弱”处理；点赞/收藏量不参与。
 */
export function judgeAxis(axis: Axis, evidence: Evidence[], notes: Catalog["noteById"], asOf: string): AxisResult {
  const judged: JudgedEvidence[] = evidence
    .filter((e) => e.axis === axis)
    .map((e) => {
      const published = notes.get(e.noteId)?.publishedAt ?? null;
      const age = published ? (Date.parse(asOf) - Date.parse(published)) / DAY : Infinity;
      const stale = !(age <= STALE_DAYS);
      return { ...e, strength: stale ? "weak" : e.strength, stale, publishedAt: published };
    });
  const strongPos = new Set(judged.filter((e) => e.strength === "strong" && e.polarity === "pos").map((e) => e.noteId)).size;
  const strongNeg = new Set(judged.filter((e) => e.strength === "strong" && e.polarity === "neg").map((e) => e.noteId)).size;
  const anyPos = judged.some((e) => e.polarity === "pos");
  const anyNeg = judged.some((e) => e.polarity === "neg");
  const sources = new Set(judged.map((e) => e.noteId)).size;
  const dates = judged.map((e) => e.publishedAt).filter((d): d is string => Boolean(d)).sort();
  const latest = dates.length ? dates[dates.length - 1] : null;
  const disputed = anyPos && anyNeg;

  let level: Level;
  let reason: string;
  if (judged.length === 0) {
    level = "待核实";
    reason = "素材里没有相关信息。";
  } else if (strongPos + strongNeg === 0) {
    level = "待核实";
    reason = `只有旁证或较早的零散说法（${sources} 篇来源），不足以下结论。`;
  } else if (strongNeg > 0 && !anyPos) {
    level = "低";
    reason = `有 ${strongNeg} 篇详细的负面反馈，且没有正面说法抵消；家庭聚餐按保守处理。`;
  } else if (strongNeg > 0) {
    level = "中";
    reason = "既有详细的负面反馈，也有正面说法，存在分歧。";
  } else if (strongPos >= 2 && !anyNeg) {
    level = "高";
    reason = `${strongPos} 篇详细的近期正面记述，且没有负面说法。`;
  } else if (strongPos >= 2) {
    level = "中";
    reason = `有 ${strongPos} 篇详细的正面记述，但也有负面说法，故不给“高”。`;
  } else {
    level = "中";
    reason = anyNeg ? "仅 1 篇详细正面记述，且有负面说法。" : "仅 1 篇详细正面记述，单一来源最高给“中”。";
  }
  return { axis, level, sources, latest, disputed, reason, evidence: judged };
}

export type VerdictId = "cross" | "parents" | "onway" | "regular" | "unstable" | "unknown";
export interface Verdict {
  id: VerdictId;
  label: string;
  reason: string;
}

/** 由三轴结果推出的结论标签，规则固定且可解释。 */
export function judgeVerdict(s: AxisResult, p: AxisResult, c: AxisResult): Verdict {
  const stableOk = s.level === "高" || s.level === "中";
  if (s.level === "低") return { id: "unstable", label: "近期状态不稳", reason: "稳定性为“低”。" };
  if (c.level === "高" && stableOk) return { id: "cross", label: "值得专程过关", reason: "过关价值为“高”且稳定性不低。" };
  if (p.level === "高" && stableOk) return { id: "parents", label: "带父母优先", reason: "带父母为“高”且稳定性不低。" };
  if (c.level === "中" && stableOk) return { id: "onway", label: "顺路可以吃", reason: "过关价值为“中”且稳定性不低。" };
  if (p.level === "低" && stableOk) return { id: "regular", label: "熟客尝新", reason: "带父母为“低”，更适合自己或熟客前往。" };
  const rs = [s, p, c];
  const known = rs.filter((r) => r.level !== "待核实").map((r) => `${AXIS_LABEL[r.axis]}${r.level}`);
  const unknown = rs.filter((r) => r.level === "待核实").map((r) => AXIS_LABEL[r.axis]);
  const parts = [known.length ? `已知：${known.join("、")}` : "", unknown.length ? `${unknown.join("、")}尚缺证据` : ""].filter(Boolean);
  return { id: "unknown", label: "资料不足，暂不下结论", reason: `${parts.join("；")}，不足以给出带家人过关的结论。` };
}
