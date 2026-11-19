import { AXES, catalog, type Axis, type Catalog, type CuratedShop, type Evidence } from "./catalog";
import { judgeAxis, judgeVerdict, type AxisResult, type Verdict } from "./judge";
import { nameHasAny, normName as norm } from "./match";
import { portDistances, type PortDistance } from "./ports";
import type { Poi, ShopState } from "./types";
import { emptyState } from "./types";

export interface ShopView {
  /** 个人状态键：`<门店id>@<高德id>` / `<门店id>`（无定位） / `amap:<高德id>`（仅高德）。 */
  key: string;
  name: string;
  curated?: CuratedShop;
  poi?: Poi;
  axes: Record<Axis, AxisResult>;
  verdict: Verdict;
  /** 去重后的来源笔记数与最近发布日期。 */
  sources: number;
  latest: string | null;
  ports: PortDistance[];
  /** 用于人均筛选的数字（素材套餐价取最低数字，否则高德人均）。 */
  priceNum?: number;
  priceFrom?: "素材" | "高德";
  /** 是否含有负面说法（任一轴）。 */
  hasNegative: boolean;
}


export function matchesCurated(poi: Poi, shop: CuratedShop): boolean {
  if (poi.type && !/餐饮/.test(poi.type)) return false;
  if (!nameHasAny(poi.name, shop.keywords)) return false;
  return !shop.branchKeywords || nameHasAny(poi.name, shop.branchKeywords);
}

function priceOf(shop: CuratedShop | undefined, poi: Poi | undefined): Pick<ShopView, "priceNum" | "priceFrom"> {
  const m = shop?.price?.set?.match(/\d{3,4}/);
  if (m) return { priceNum: Number(m[0]), priceFrom: "素材" };
  if (poi?.cost) return { priceNum: poi.cost, priceFrom: "高德" };
  return {};
}

function view(key: string, name: string, cat: Catalog, curated?: CuratedShop, poi?: Poi): ShopView {
  const ev: Evidence[] = curated?.evidence ?? [];
  const axes = Object.fromEntries(AXES.map((a) => [a, judgeAxis(a, ev, cat.noteById, cat.updatedAt)])) as Record<Axis, AxisResult>;
  const all = Object.values(axes);
  const dates = all.map((a) => a.latest).filter((d): d is string => Boolean(d)).sort();
  return {
    key,
    name,
    curated,
    poi,
    axes,
    verdict: judgeVerdict(axes.stability, axes.parents, axes.crossing),
    sources: new Set(ev.map((e) => e.noteId)).size,
    latest: dates.length ? dates[dates.length - 1] : null,
    ports: poi ? portDistances(poi) : [],
    hasNegative: ev.some((e) => e.polarity === "neg"),
    ...priceOf(curated, poi),
  };
}

/** 合并整理好的门店与高德 POI。同一门店命中多个 POI（分店）时各出一张卡，证据共享并提示分店待核实。 */
export function buildShops(pois: Poi[], cat: Catalog = catalog): ShopView[] {
  const used = new Set<string>();
  const out: ShopView[] = [];
  for (const shop of cat.shops) {
    const hits = pois.filter((p) => matchesCurated(p, shop));
    if (hits.length === 0) {
      out.push(view(shop.id, shop.name, cat, shop));
      continue;
    }
    for (const p of hits) {
      used.add(p.id);
      out.push(view(`${shop.id}@${p.id}`, hits.length > 1 ? p.name : shop.name, cat, shop, p));
    }
  }
  for (const p of pois) if (!used.has(p.id)) out.push(view(`amap:${p.id}`, p.name, cat, undefined, p));
  return out.sort((a, b) => b.sources - a.sources || a.name.localeCompare(b.name, "zh"));
}

/** 读取个人状态；兼容旧键（`amap:<id>`、门店 id）。 */
export function stateOf(shops: Record<string, ShopState>, v: ShopView): ShopState {
  const keys = [v.key, v.poi ? `amap:${v.poi.id}` : "", v.curated?.id ?? ""];
  for (const k of keys) if (k && shops[k]) return shops[k];
  // 高德未命中时（无 POI），回退到该店任一分店键，避免检索失败时个人记录“消失”。
  if (!v.poi && v.curated) {
    const alt = Object.keys(shops).find((k) => k.startsWith(`${v.curated!.id}@`));
    if (alt) return shops[alt];
  }
  return emptyState();
}

export type PriceBand = "any" | "lt300" | "300-600" | "gt600";
export interface Filters {
  query: string;
  parents: boolean;
  crossing: boolean;
  stable: boolean;
  price: PriceBand;
  port: "any" | "futian" | "szbay" | "luohu";
  mine: boolean;
}
export const defaultFilters = (): Filters => ({ query: "", parents: false, crossing: false, stable: false, price: "any", port: "any", mine: false });

export function filterShops(list: ShopView[], f: Filters, shops: Record<string, ShopState>): ShopView[] {
  const q = norm(f.query);
  return list.filter((v) => {
    if (q) {
      const hay = norm([v.name, v.curated?.keywords.join(" ") ?? "", v.poi?.district ?? "", v.poi?.businessArea ?? "", v.poi?.address ?? "", v.ports[0]?.port.name ?? "", v.curated?.branch ?? ""].join(" "));
      if (!hay.includes(q)) return false;
    }
    if (f.parents && v.axes.parents.level !== "高") return false;
    if (f.crossing && v.axes.crossing.level !== "高") return false;
    if (f.stable && v.axes.stability.level !== "高") return false;
    if (f.price !== "any") {
      const n = v.priceNum;
      if (n === undefined) return false;
      if (f.price === "lt300" && !(n < 300)) return false;
      if (f.price === "300-600" && !(n >= 300 && n <= 600)) return false;
      if (f.price === "gt600" && !(n > 600)) return false;
    }
    if (f.port !== "any" && v.ports[0]?.port.id !== f.port) return false;
    if (f.mine) {
      const st = stateOf(shops, v);
      if (!st.favorite && !st.visited) return false;
    }
    return true;
  });
}
