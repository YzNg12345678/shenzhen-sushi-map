import type { Checkin, Poi, ShopNote } from "./types";
import { opensLate } from "./openTime";

export type SceneId = "solo" | "date" | "treat" | "late" | "omakase" | "budget";

export interface Scene {
  id: SceneId;
  label: string;
  hint: string;
  rule: string;
}

export const SCENES: Scene[] = [
  { id: "solo", label: "一人吃", hint: "想安静吃一顿", rule: "偏好人均较低且高德评分较高的店；人均未知会被扣分。" },
  { id: "date", label: "约会", hint: "两个人好好吃", rule: "偏好高德评分高、人均处于中等区间（¥150–600）的店。" },
  { id: "treat", label: "请客", hint: "要拿得出手", rule: "偏好高德评分高、人均 ¥250 以上的店；评分或人均未知会被扣分。" },
  { id: "late", label: "深夜", hint: "晚上 22 点后还想吃", rule: "仅保留高德营业时间明确显示营业到 22:00 之后的店；营业时间未知的店不会入选。" },
  { id: "omakase", label: "初次 omakase", hint: "第一次试廊前/无菜单", rule: "名称或类别含 omakase/おまかせ/板前/割烹/鮨/无菜单 等字样的店加分，人均较高加分，你去过的店减分。" },
  { id: "budget", label: "指定预算", hint: "每人不超过…", rule: "排除高德人均高于预算的店；人均未知的店保留但扣分。" },
];

export type Badge = "最匹配" | "最稳妥" | "最有特色";

export interface Pick {
  poi: Poi;
  badge: Badge;
  score: number;
  reasons: { text: string; source: "高德" | "你的记录" | "推导" }[];
}

const FEATURE_RE = /omakase|おまかせ|板前|割烹|鮨|鮓|无菜单|無菜單|无菜单|廊前|怀石|懐石|江户前|江戸前/i;

interface Ctx {
  notes: Record<string, ShopNote>;
  checkins: Checkin[];
}

function userAvg(poi: Poi, checkins: Checkin[]): { avg: number; n: number } | null {
  const rs = checkins.filter((c) => c.shopId === poi.id).map((c) => c.overall);
  return rs.length ? { avg: rs.reduce((a, b) => a + b, 0) / rs.length, n: rs.length } : null;
}

interface Scored {
  poi: Poi;
  score: number;
  stable: number;
  feature: number;
  known: number;
  reasons: Pick["reasons"];
}

function featureHits(poi: Poi, note: ShopNote | undefined): number {
  let h = FEATURE_RE.test(`${poi.name} ${poi.type ?? ""}`) ? 2 : 0;
  if (note) h += [note.style, note.chef, note.aging, note.setMenu].filter(Boolean).length;
  return h;
}

function scoreOne(poi: Poi, scene: SceneId, budget: number | undefined, ctx: Ctx): Scored | null {
  const note = ctx.notes[poi.id];
  if (note?.revisit === "no") return null;
  const reasons: Pick["reasons"] = [];
  let score = 0;
  const { rating, cost } = poi;

  if (scene === "late") {
    const late = opensLate(poi.openTime);
    if (late !== true) return null;
    reasons.push({ text: `高德营业时间：${poi.openTime}，显示营业到 22:00 之后`, source: "高德" });
    score += 2;
  }
  if (scene === "budget") {
    if (budget === undefined || !(budget > 0)) return null;
    if (cost !== undefined && cost > budget) return null;
    if (cost !== undefined) {
      reasons.push({ text: `高德人均 ¥${cost}，不超过预算 ¥${budget}`, source: "高德" });
      score += 2;
    } else {
      reasons.push({ text: "高德未提供人均，无法确认是否在预算内", source: "高德" });
      score -= 1;
    }
  }
  if (rating !== undefined) {
    score += rating;
    reasons.push({ text: `高德评分 ${rating}`, source: "高德" });
  } else {
    score -= 1;
    reasons.push({ text: "高德未提供评分（未知）", source: "高德" });
  }

  if (scene === "solo") {
    if (cost !== undefined) {
      score += cost <= 300 ? 1.5 : 0;
      reasons.push({ text: `高德人均 ¥${cost}`, source: "高德" });
    } else score -= 0.5;
  } else if (scene === "date") {
    if (cost !== undefined) {
      if (cost >= 150 && cost <= 600) {
        score += 1.5;
        reasons.push({ text: `高德人均 ¥${cost}，处于约会中等区间`, source: "推导" });
      }
    }
  } else if (scene === "treat") {
    if (cost !== undefined && cost >= 250) {
      score += 1.5;
      reasons.push({ text: `高德人均 ¥${cost}，达到请客档位（≥¥250）`, source: "推导" });
    } else if (cost === undefined) score -= 0.5;
  } else if (scene === "omakase") {
    if (FEATURE_RE.test(`${poi.name} ${poi.type ?? ""}`)) {
      score += 2;
      reasons.push({ text: "名称/类别含 omakase 相关字样", source: "高德" });
    }
    if (cost !== undefined && cost >= 300) {
      score += 1;
      reasons.push({ text: `高德人均 ¥${cost}`, source: "高德" });
    }
    if (note?.visited) {
      score -= 1.5;
      reasons.push({ text: "你标记过去过（初次体验已扣分）", source: "你的记录" });
    }
  }

  let stable = rating ?? 0;
  const known = [poi.rating, poi.cost, poi.openTime, poi.tel, poi.address].filter((x) => x !== undefined && x !== "").length;
  stable += known * 0.3;
  const ua = userAvg(poi, ctx.checkins);
  if (ua) {
    score += ua.avg - 3;
    stable += ua.avg;
    reasons.push({ text: `你的打卡总评均分 ${ua.avg.toFixed(1)}（${ua.n} 次）`, source: "你的记录" });
  }
  if (note?.favorite) {
    score += 1;
    stable += 1;
    reasons.push({ text: "你已收藏", source: "你的记录" });
  }
  if (note?.revisit === "yes") {
    score += 1;
    stable += 1.5;
    reasons.push({ text: "你标记了想复访", source: "你的记录" });
  }
  return { poi, score, stable, feature: featureHits(poi, note), known, reasons };
}

/** 确定性推荐：硬条件过滤 → 评分 → 最多 3 家，标注最匹配/最稳妥/最有特色。 */
export function recommend(pois: Poi[], scene: SceneId, ctx: Ctx, budget?: number): Pick[] {
  const scored = pois.map((p) => scoreOne(p, scene, budget, ctx)).filter((s): s is Scored => s !== null);
  const picks: Pick[] = [];
  const left = [...scored];
  const take = (sorter: (a: Scored, b: Scored) => number, badge: Badge, extra?: (s: Scored) => string) => {
    if (!left.length) return;
    left.sort(sorter);
    const s = left.shift()!;
    const reasons = [...s.reasons];
    if (extra) reasons.push({ text: extra(s), source: "推导" });
    picks.push({ poi: s.poi, badge, score: Math.round(s.score * 10) / 10, reasons });
  };
  take((a, b) => b.score - a.score, "最匹配", () => "综合评分在候选中最高（规则见上方说明）");
  take((a, b) => b.stable - a.stable || b.score - a.score, "最稳妥", (s) => `高德已提供评分/人均/营业时间/电话/地址中的 ${s.known} 项，按评分与信息完整度排序`);
  take(
    (a, b) => b.feature - a.feature || b.score - a.score,
    "最有特色",
    (s) => {
      if (s.feature === 0) return "候选中没有可见的特色字段，按综合分顺位给出，不代表风格特别";
      const parts: string[] = [];
      if (FEATURE_RE.test(`${s.poi.name} ${s.poi.type ?? ""}`)) parts.push("名称/类别含特色关键词");
      const n = ctx.notes[s.poi.id];
      const filled = n ? [n.style && "流派", n.chef && "师傅", n.aging && "熟成", n.setMenu && "套餐"].filter(Boolean) : [];
      if (filled.length) parts.push(`你填写了${filled.join("、")}`);
      return parts.join("；");
    },
  );
  return picks;
}
