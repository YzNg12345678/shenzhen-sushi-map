import { describe, expect, it } from "vitest";
import { atlas, dataset } from "@/lib/data";
import { ATLAS_CATEGORIES, defaultAtlasFilters, filterAtlas, monthsLabel, seasonStatus } from "@/lib/atlas";

describe("图鉴数据", () => {
  it("条目数量与类别覆盖", () => {
    expect(atlas.items.length).toBeGreaterThanOrEqual(30);
    const cats = new Set(atlas.items.map((i) => i.category));
    for (const c of ATLAS_CATEGORIES) expect(cats.has(c), `缺少类别 ${c}`).toBe(true);
  });
  it.each(atlas.items.map((i) => [i.id, i] as const))("%s 必填字段、季节差异说明与来源完整", (_id, it) => {
    expect(it.zh.length).toBeGreaterThan(0);
    expect(it.ja.length).toBeGreaterThan(0);
    expect(it.flavor.length).toBeGreaterThan(5);
    expect(it.techniques.length).toBeGreaterThan(0);
    expect(it.omakaseRole.length).toBeGreaterThan(5);
    expect(it.tips.length).toBeGreaterThan(5);
    expect(it.season.note.length).toBeGreaterThanOrEqual(12);
    expect(it.season.note).toMatch(/产地|地域|养殖|冷冻|进口|供应|海域|渔|个体|年份|批次|规格|县|各地|因店|不以旬论|差异|分歧|北海道|关东|品种/);
    for (const m of it.season.months) expect(m >= 1 && m <= 12).toBe(true);
    expect(it.sources.length).toBeGreaterThan(0);
    for (const s of it.sources) expect(dataset.sources.has(s)).toBe(true);
  });
  it("季节免责声明明确月份不是保证", () => {
    expect(atlas.seasonDisclaimer).toMatch(/不是|并非|不保证|不代表|而非/);
  });
  it("所有被引用的公开来源有标题/发布者/url/访问日期，图鉴来源清单不含未使用项", () => {
    const used = new Set(atlas.items.flatMap((i) => i.sources));
    expect(used.size).toBeGreaterThan(3);
    for (const id of used) {
      const s = dataset.sources.get(id)!;
      expect(s.label.length).toBeGreaterThan(1);
      expect(s.url).toMatch(/^https?:\/\//);
    }
  });
});

describe("图鉴检索与筛选", () => {
  const first = atlas.items[0];
  it("按中文名、日文名、别名检索", () => {
    expect(filterAtlas(atlas.items, { ...defaultAtlasFilters(), query: first.zh }).map((i) => i.id)).toContain(first.id);
    expect(filterAtlas(atlas.items, { ...defaultAtlasFilters(), query: first.ja }).map((i) => i.id)).toContain(first.id);
  });
  it("按类别与月份筛选；不以旬论的条目在任意月份保留", () => {
    const cat = first.category;
    const r = filterAtlas(atlas.items, { ...defaultAtlasFilters(), category: cat });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((i) => i.category === cat)).toBe(true);
    for (let m = 1; m <= 12; m++) {
      for (const it of filterAtlas(atlas.items, { ...defaultAtlasFilters(), month: m })) expect(["peak", "all"]).toContain(seasonStatus(it, m));
    }
    const allYear = atlas.items.filter((i) => i.season.months.length === 0);
    for (const it of allYear) expect(filterAtlas(atlas.items, { ...defaultAtlasFilters(), month: 7 })).toContain(it);
  });
  it("无结果返回空数组；monthsLabel 合并连续月份", () => {
    expect(filterAtlas(atlas.items, { ...defaultAtlasFilters(), query: "不存在的鱼zzzz" })).toEqual([]);
    expect(monthsLabel([11, 12, 1, 2, 5])).toBe("1–2月、5月、11–12月");
    expect(monthsLabel([])).toBe("不以旬论");
  });
});
