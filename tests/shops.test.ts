import { describe, expect, it } from "vitest";
import { audit } from "@/lib/data";
import { buildShops, defaultFilters, filterShops, includedCandidates, isFiltered, stateOf } from "@/lib/shops";
import { mapPoi, looksLikeOmakase } from "@/lib/amap";
import { portDistances } from "@/lib/ports";
import type { Poi, ShopState } from "@/lib/types";

const poi = (id: string, name: string, o: Partial<Poi> = {}): Poi => ({ id, name, lng: 114.06, lat: 22.53, district: "福田区", type: "餐饮服务;外国餐厅;日本料理", fetchedAt: "2026-11-20T00:00:00Z", ...o });
const inc = includedCandidates(audit);

describe("buildShops / filterShops", () => {
  it("没有高德结果时，主清单仍是全部 include 候选（无位置）", () => {
    const { shops } = buildShops([]);
    expect(shops).toHaveLength(inc.length);
    expect(shops.every((s) => s.poi === undefined && s.priceMin >= 300)).toBe(true);
  });
  it("高德 POI 命中 include 候选时合并位置；分店各出一张卡", () => {
    const c = inc[0];
    const n = c.keywords[0] + (c.branchKeywords?.[0] ?? "");
    const { shops, split } = buildShops([poi("a1", n + "一店"), poi("a2", n + "二店", { district: "南山区" })]);
    const mine = shops.filter((s) => s.candidate.id === c.id);
    expect(mine).toHaveLength(2);
    expect(split.admitted.length).toBeGreaterThanOrEqual(2);
    expect(new Set(mine.map((s) => s.key)).size).toBe(2);
  });
  it("搜索：店名/关键词；无结果返回空", () => {
    const { shops } = buildShops([]);
    const c = inc[0];
    expect(filterShops(shops, { ...defaultFilters(), query: c.keywords[0] }, {}).map((s) => s.candidate.id)).toContain(c.id);
    expect(filterShops(shops, { ...defaultFilters(), query: "zzzz不存在" }, {})).toEqual([]);
  });
  it("价位筛选只会返回 ≥300 且落在对应档位的店；排序可用", () => {
    const { shops } = buildShops([]);
    for (const band of ["300-499", "500-799", "800+"] as const) {
      for (const s of filterShops(shops, { ...defaultFilters(), price: band }, {})) {
        const p = s.priceMin;
        expect(band === "300-499" ? p >= 300 && p < 500 : band === "500-799" ? p >= 500 && p < 800 : p >= 800).toBe(true);
      }
    }
    const asc = filterShops(shops, { ...defaultFilters(), sort: "price-asc" }, {}).map((s) => s.priceMin);
    expect([...asc].sort((a, b) => a - b)).toEqual(asc);
  });
  it("我的收藏/去过筛选与个人状态读取", () => {
    const { shops } = buildShops([]);
    const st: Record<string, ShopState> = { [shops[0].key]: { favorite: true, visited: false, note: "n" } };
    const r = filterShops(shops, { ...defaultFilters(), mine: true }, st);
    expect(r.map((s) => s.key)).toEqual([shops[0].key]);
    expect(stateOf(st, shops[0]).note).toBe("n");
    expect(stateOf({}, shops[0]).favorite).toBe(false);
  });
  it("isFiltered", () => {
    expect(isFiltered(defaultFilters())).toBe(false);
    expect(isFiltered({ ...defaultFilters(), query: "a" })).toBe(true);
  });
});

describe("高德映射与口岸距离", () => {
  it("mapPoi 缺失字段保持 undefined", () => {
    const p = mapPoi({ id: "1", name: "x", location: { lng: 114, lat: 22.5 }, cost: [], rating: "" });
    expect(p?.cost).toBeUndefined();
    expect(p?.rating).toBeUndefined();
    expect(mapPoi({ id: "1", name: "x" })).toBeNull();
  });
  it("looksLikeOmakase 与口岸排序", () => {
    expect(looksLikeOmakase(poi("1", "某某 Omakase"))).toBe(true);
    expect(looksLikeOmakase(poi("1", "海底捞"))).toBe(false);
    expect(portDistances({ lng: 114.07, lat: 22.516 })[0].port.id).toBe("futian");
  });
});
