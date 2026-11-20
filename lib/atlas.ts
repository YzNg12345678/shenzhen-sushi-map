import { atlas as defaultAtlas } from "./data";
import { normName } from "./match";
import { ATLAS_CATEGORIES, type AtlasCategory, type AtlasFile, type AtlasItem } from "./schema";

export interface AtlasFilters {
  query: string;
  category: "any" | AtlasCategory;
  /** 0 = 不限；1–12 = 该月属于常见旬或全年供应。 */
  month: number;
}
export const defaultAtlasFilters = (): AtlasFilters => ({ query: "", category: "any", month: 0 });
export { ATLAS_CATEGORIES };

/** 当月是否属于参考旬。不以旬论（months 为空）的条目在任何月份都返回 "all"。 */
export function seasonStatus(item: AtlasItem, month: number): "peak" | "all" | "off" {
  if (item.season.months.length === 0) return "all";
  return item.season.months.includes(month) ? "peak" : "off";
}

export function filterAtlas(items: AtlasItem[], f: AtlasFilters): AtlasItem[] {
  const q = normName(f.query);
  return items.filter((it) => {
    if (f.category !== "any" && it.category !== f.category) return false;
    if (f.month && seasonStatus(it, f.month) === "off") return false;
    if (q) {
      const hay = normName([it.zh, it.ja, ...it.aliases, it.category, it.flavor, it.techniques.join(" "), it.omakaseRole].join(" "));
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export const monthsLabel = (months: number[]): string => {
  if (months.length === 0) return "不以旬论";
  const s = [...months].sort((a, b) => a - b);
  const runs: number[][] = [];
  for (const m of s) {
    const last = runs[runs.length - 1];
    if (last && m === last[last.length - 1] + 1) last.push(m);
    else runs.push([m]);
  }
  return runs.map((r) => (r.length === 1 ? `${r[0]}月` : `${r[0]}–${r[r.length - 1]}月`)).join("、");
};

export const atlasById = (id: string, a: AtlasFile = defaultAtlas) => a.items.find((x) => x.id === id);
