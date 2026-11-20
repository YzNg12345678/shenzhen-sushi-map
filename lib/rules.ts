import { nameHasAny } from "./match";
import type { AuditFile, Candidate } from "./schema";
import type { Poi } from "./types";

/**
 * 动态高德结果与静态清单共用的准入规则。顺序即优先级：
 *  1. 名称命中排除模式（普通日料/回转/放题/居酒屋/外卖…）：直接拒绝，优先级最高；
 *  2. 命中已审计候选：include 才可能进入；exclude/pending 一律拒绝并给出审计理由；
 *  3. 未命中任何审计候选：不论名字多像 Omakase，都不得进入主清单（“未审计”）；
 *  4. 命中 include 候选但类型明确非餐饮、或高德人均明确 < 300：拒绝（价格硬门槛）。
 */
export type PoiCode = "admitted" | "not-restaurant" | "excluded" | "pending" | "name-pattern" | "unreviewed" | "price-below-floor";
export interface PoiVerdict {
  admit: boolean;
  code: PoiCode;
  candidate?: Candidate;
  reason: string;
}

export function matchCandidate(poi: Pick<Poi, "name" | "type">, c: Candidate): boolean {
  if (!nameHasAny(poi.name, c.keywords)) return false;
  return !c.branchKeywords || nameHasAny(poi.name, c.branchKeywords);
}

export function matchedPatterns(name: string, audit: AuditFile): string[] {
  return audit.excludeNamePatterns.filter((p) => new RegExp(p.pattern, "i").test(name)).map((p) => p.label);
}

export function classifyPoi(poi: Poi, audit: AuditFile): PoiVerdict {
  const hit = audit.candidates.find((c) => matchCandidate(poi, c));
  // 名称命中排除模式（放题/回转/外卖/居酒屋…）永远优先：即使名字里带有已审计店名也拒绝。
  const pats = matchedPatterns(poi.name, audit);
  if (pats.length) return { admit: false, code: "name-pattern", candidate: hit, reason: `名称命中排除规则：${pats.join("、")}` };
  if (hit) {
    if (hit.decision === "exclude") return { admit: false, code: "excluded", candidate: hit, reason: `已审计排除：${hit.reason}` };
    if (hit.decision === "pending") return { admit: false, code: "pending", candidate: hit, reason: `待核实，不进入主清单：${hit.reason}` };
    // 高德有时把已审计门店归到“购物服务”等父类（POI 在商场内）；只要全名+分店限定都命中就按审计结论处理。
    // 但明确的非餐饮类（体育休闲、公司企业、住宿等）仍拒绝。
    if (poi.type && !/餐饮|购物/.test(poi.type)) return { admit: false, code: "not-restaurant", candidate: hit, reason: "高德类型不是餐饮/商场内餐饮" };
    if (poi.cost !== undefined && poi.cost < audit.priceFloor) {
      return { admit: false, code: "price-below-floor", candidate: hit, reason: `高德显示该门店人均 ${poi.cost} 元，低于 ${audit.priceFloor} 元门槛` };
    }
    return { admit: true, code: "admitted", candidate: hit, reason: hit.reason };
  }
  if (poi.type && !/餐饮|购物/.test(poi.type)) return { admit: false, code: "not-restaurant", reason: "高德类型不是餐饮服务" };
  return { admit: false, code: "unreviewed", reason: "未经过 Omakase 身份与价格审计，不进入主清单" };
}

export interface PoiSplit {
  admitted: { poi: Poi; candidate: Candidate }[];
  rejected: { poi: Poi; verdict: PoiVerdict }[];
}

export function splitPois(pois: Poi[], audit: AuditFile): PoiSplit {
  const out: PoiSplit = { admitted: [], rejected: [] };
  for (const poi of pois) {
    const v = classifyPoi(poi, audit);
    if (v.admit && v.candidate) out.admitted.push({ poi, candidate: v.candidate });
    else out.rejected.push({ poi, verdict: v });
  }
  return out;
}
