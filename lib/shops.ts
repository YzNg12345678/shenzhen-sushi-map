import { audit as defaultAudit } from "./data";
import { splitPois, type PoiSplit } from "./rules";
import { nameHasAny, normName as norm } from "./match";
import { portDistances, type PortDistance } from "./ports";
import type { AuditFile, Candidate } from "./schema";
import type { Poi, ShopState } from "./types";
import { emptyState } from "./types";

export interface ShopView {
  /** 个人状态键：`<候选id>@<高德id>` / `<候选id>`（高德未返回位置）。 */
  key: string;
  name: string;
  candidate: Candidate;
  poi?: Poi;
  ports: PortDistance[];
  /** 审计价格下限（元/位），用于价位筛选与排序；一定 ≥ 300。 */
  priceMin: number;
  /** 高德人均与审计价是否不同口径（仅展示，不参与判断）。 */
  district?: string;
}

/** 主清单：只来自 decision=include 的审计候选；动态高德 POI 必须通过同一规则（lib/rules.ts）。 */
export function includedCandidates(audit: AuditFile = defaultAudit): Candidate[] {
  return audit.candidates.filter((c) => c.decision === "include");
}

function view(c: Candidate, poi?: Poi, multi = false): ShopView {
  return {
    key: poi ? `${c.id}@${poi.id}` : c.id,
    name: multi && poi ? poi.name : c.name,
    candidate: c,
    poi,
    ports: poi ? portDistances(poi) : [],
    priceMin: c.price.perPersonMin as number,
    district: poi?.district,
  };
}

export interface BuiltShops {
  shops: ShopView[];
  split: PoiSplit;
}

/** 合并审计通过的门店与（已过规则的）高德 POI。同一门店多个分店 POI 各出一张卡。 */
export function buildShops(pois: Poi[], audit: AuditFile = defaultAudit): BuiltShops {
  const split = splitPois(pois, audit);
  const shops: ShopView[] = [];
  for (const c of includedCandidates(audit)) {
    const hits = split.admitted.filter((a) => a.candidate.id === c.id);
    if (hits.length === 0) shops.push(view(c));
    else for (const h of hits) shops.push(view(c, h.poi, hits.length > 1));
  }
  shops.sort((a, b) => a.name.localeCompare(b.name, "zh"));
  return { shops, split };
}

/** 读取个人状态；兼容门店 id 键。 */
export function stateOf(shops: Record<string, ShopState>, v: ShopView): ShopState {
  const keys = [v.key, v.poi ? `amap:${v.poi.id}` : "", v.candidate.id];
  for (const k of keys) if (k && shops[k]) return shops[k];
  if (!v.poi) {
    const alt = Object.keys(shops).find((k) => k.startsWith(`${v.candidate.id}@`));
    if (alt) return shops[alt];
  }
  return emptyState();
}

export type PriceBand = "any" | "300-499" | "500-799" | "800+";
export const PRICE_BANDS: { value: PriceBand; label: string }[] = [
  { value: "any", label: "价位不限" },
  { value: "300-499", label: "¥300–499" },
  { value: "500-799", label: "¥500–799" },
  { value: "800+", label: "¥800 以上" },
];
export type KindFilter = "any" | "omakase-sushi" | "omakase-other";
export const KINDS: { value: KindFilter; label: string }[] = [
  { value: "any", label: "类型不限" },
  { value: "omakase-sushi", label: "板前寿司" },
  { value: "omakase-other", label: "其他主厨发办" },
];
export type SortKey = "name" | "price-asc" | "price-desc" | "confidence";
export const SORTS: { value: SortKey; label: string }[] = [
  { value: "name", label: "按店名" },
  { value: "price-asc", label: "价位由低到高" },
  { value: "price-desc", label: "价位由高到低" },
  { value: "confidence", label: "资料置信度" },
];

export interface Filters {
  query: string;
  price: PriceBand;
  kind: KindFilter;
  district: string; // "any" 或行政区名
  confidence: "any" | "高" | "中" | "低";
  mine: boolean;
  sort: SortKey;
}
export const defaultFilters = (): Filters => ({ query: "", price: "any", kind: "any", district: "any", confidence: "any", mine: false, sort: "name" });
export const isFiltered = (f: Filters): boolean => f.query !== "" || f.price !== "any" || f.kind !== "any" || f.district !== "any" || f.confidence !== "any" || f.mine;

const RANK = { 高: 0, 中: 1, 低: 2 } as const;

export function filterShops(list: ShopView[], f: Filters, shops: Record<string, ShopState>): ShopView[] {
  const q = norm(f.query);
  const out = list.filter((v) => {
    const c = v.candidate;
    if (q) {
      const hay = norm([v.name, c.name, c.keywords.join(" "), c.branchNote ?? "", v.poi?.district ?? "", v.poi?.businessArea ?? "", v.poi?.address ?? "", c.profile?.headline.text ?? "", c.profile?.cuisine?.text ?? "", c.profile?.ingredients?.text ?? ""].join(" "));
      if (!hay.includes(q) && !nameHasAny(hay, [f.query])) return false;
    }
    const p = v.priceMin;
    if (f.price === "300-499" && !(p >= 300 && p < 500)) return false;
    if (f.price === "500-799" && !(p >= 500 && p < 800)) return false;
    if (f.price === "800+" && !(p >= 800)) return false;
    if (f.kind !== "any" && c.category !== f.kind) return false;
    if (f.district !== "any" && v.district !== f.district) return false;
    if (f.confidence !== "any" && c.confidence?.level !== f.confidence) return false;
    if (f.mine) {
      const st = stateOf(shops, v);
      if (!st.favorite && !st.visited) return false;
    }
    return true;
  });
  const by: Record<SortKey, (a: ShopView, b: ShopView) => number> = {
    name: (a, b) => a.name.localeCompare(b.name, "zh"),
    "price-asc": (a, b) => a.priceMin - b.priceMin,
    "price-desc": (a, b) => b.priceMin - a.priceMin,
    confidence: (a, b) => RANK[a.candidate.confidence?.level ?? "低"] - RANK[b.candidate.confidence?.level ?? "低"],
  };
  return out.sort(by[f.sort] ?? by.name);
}

/** 可选的行政区（来自当前通过规则的店）。 */
export const districtsOf = (list: ShopView[]): string[] => [...new Set(list.map((v) => v.district).filter((d): d is string => Boolean(d)))].sort((a, b) => a.localeCompare(b, "zh"));
