import type { PoiCode } from "../rules";
import type { ShopView } from "../shops";
import type { Candidate, Category, Check, Claim, Rule } from "../schema";

export const TBD = "待核实";

export const CATEGORY_LABEL: Record<Category, string> = {
  "omakase-sushi": "板前寿司 Omakase",
  "omakase-other": "其他主厨发办",
  "regular-japanese": "普通日料",
  izakaya: "居酒屋",
  kaiten: "回转寿司",
  buffet: "放题 / 自助",
  "regular-sushi": "普通寿司店",
  "other-cuisine": "其他菜系",
  unknown: "类别未定",
};

export const RULE_KIND_LABEL: Record<Rule["kind"], string> = { include: "纳入", exclude: "排除", price: "价位", evidence: "证据" };
export const CHECK_LABEL: Record<Check["result"], { text: string; mark: string }> = {
  pass: { text: "通过", mark: "✓" },
  fail: { text: "未通过", mark: "✕" },
  unknown: { text: "待核实", mark: "?" },
};
export const DECISION_LABEL: Record<Candidate["decision"], string> = { include: "主清单", pending: "待核实区（不计入主清单）", exclude: "已排除" };

export const POI_CODE_LABEL: Record<PoiCode, string> = {
  admitted: "通过审核",
  "not-restaurant": "非餐饮类地点",
  excluded: "命中已排除的审计结论",
  pending: "命中待核实候选（不计入主清单）",
  "name-pattern": "名称命中排除模式（普通日料、回转、放题等）",
  unreviewed: "尚未审计（身份与价位均未核实）",
  "price-below-floor": "高德人均低于 ¥300 门槛",
};

/** 去掉小数后的“x.x km”。 */
export const kmText = (km: number): string => `${km.toFixed(1)} km`;

/** 距离最近口岸：仅作事实小字，不做价值判断。 */
export function nearestPortText(v: Pick<ShopView, "ports">): string | null {
  const p = v.ports[0];
  return p ? `距离最近口岸：${p.port.name}（直线距离估算约 ${kmText(p.km)}）` : null;
}

export const amapMarkerUrl = (v: Pick<ShopView, "poi" | "name">): string | null =>
  v.poi ? `https://uri.amap.com/marker?position=${v.poi.lng},${v.poi.lat}&name=${encodeURIComponent(v.name)}` : null;

export const priceText = (v: Pick<ShopView, "priceMin" | "candidate">): string => `¥${v.priceMin} 起 · ${v.candidate.price.label}`;

/** 一个店铺里出现过的全部来源 id（去重，保持出现顺序）。 */
export function shopSourceIds(c: Candidate): string[] {
  const ids: string[] = [];
  const add = (cl: Claim | null | undefined) => cl?.sources.forEach((s) => ids.push(s));
  const p = c.profile;
  if (p) {
    add(p.headline);
    for (const k of ["cuisine", "ingredients", "chef", "menu", "value", "space", "booking", "scenes"] as const) add(p[k]);
    [...p.strengths, ...p.risks, ...p.disputes].forEach(add);
  }
  c.price.basis.forEach(add);
  c.identity.basis.forEach(add);
  c.checks.forEach((k) => k.sources.forEach((s) => ids.push(s)));
  return [...new Set(ids)];
}

export const isXhs = (id: string): boolean => id.startsWith("xhs:");
export const XHS_NOTE = "小红书用户笔记，仅作一手体验参考";
