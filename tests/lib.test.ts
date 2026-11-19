import { describe, expect, it } from "vitest";
import { buildCatalog, catalog, type Evidence } from "@/lib/catalog";
import { judgeAxis, judgeVerdict } from "@/lib/judge";
import { distanceKm, portDistances, PORTS } from "@/lib/ports";
import { buildShops, defaultFilters, filterShops, matchesCurated, stateOf } from "@/lib/shops";
import { emptyData, parseBackup, type Poi } from "@/lib/types";
import { looksLikeOmakase, mapPoi } from "@/lib/amap";

const poi = (id: string, o: Partial<Poi> = {}): Poi => ({ id, name: `店${id}`, lng: 114.06, lat: 22.53, type: "餐饮服务;外国餐厅;日本料理", fetchedAt: "2026-11-20T00:00:00Z", ...o });
const notes = new Map<string, unknown>([
  ["n1", { noteId: "n1", publishedAt: "2026-10-01" }],
  ["n2", { noteId: "n2", publishedAt: "2026-09-01" }],
  ["old", { noteId: "old", publishedAt: "2025-01-01" }],
] as [string, unknown][]);
const ev = (noteId: string, polarity: "pos" | "neg", strength: "strong" | "weak", axis: Evidence["axis"] = "stability"): Evidence => ({ noteId, axis, polarity, strength, text: "t" });
const J = (e: Evidence[], axis: Evidence["axis"] = "stability") => judgeAxis(axis, e, notes as never, "2026-11-20");

describe("judgeAxis", () => {
  it("无证据 / 只有弱证据 → 待核实", () => {
    expect(J([]).level).toBe("待核实");
    expect(J([ev("n1", "pos", "weak")]).level).toBe("待核实");
  });
  it("单一强正面 → 中；两篇强正面 → 高；有负面不给高", () => {
    expect(J([ev("n1", "pos", "strong")]).level).toBe("中");
    expect(J([ev("n1", "pos", "strong"), ev("n2", "pos", "strong")]).level).toBe("高");
    expect(J([ev("n1", "pos", "strong"), ev("n2", "pos", "strong"), ev("n2", "neg", "weak")]).level).toBe("中");
  });
  it("强负面：无正面 → 低；有正面 → 中且标分歧", () => {
    expect(J([ev("n1", "neg", "strong")]).level).toBe("低");
    const r = J([ev("n1", "neg", "strong"), ev("n2", "pos", "weak")]);
    expect(r.level).toBe("中");
    expect(r.disputed).toBe(true);
  });
  it("超过 365 天的强证据降为旁证", () => {
    const r = J([ev("old", "pos", "strong"), ev("n1", "pos", "strong")]);
    expect(r.level).toBe("中");
    expect(r.evidence.find((e) => e.noteId === "old")?.stale).toBe(true);
  });
  it("只统计所属轴，并给出来源数与最近日期", () => {
    const r = J([ev("n1", "pos", "strong"), ev("n2", "pos", "weak"), ev("n2", "pos", "strong", "parents")]);
    expect(r.sources).toBe(2);
    expect(r.latest).toBe("2026-10-01");
  });
});

describe("judgeVerdict", () => {
  const r = (level: "高" | "中" | "低" | "待核实") => ({ ...J([]), level });
  it("按固定规则给结论", () => {
    expect(judgeVerdict(r("低"), r("高"), r("高")).id).toBe("unstable");
    expect(judgeVerdict(r("中"), r("高"), r("高")).id).toBe("cross");
    expect(judgeVerdict(r("中"), r("高"), r("待核实")).id).toBe("parents");
    expect(judgeVerdict(r("高"), r("待核实"), r("中")).id).toBe("onway");
    expect(judgeVerdict(r("高"), r("低"), r("待核实")).id).toBe("regular");
    expect(judgeVerdict(r("高"), r("待核实"), r("待核实")).id).toBe("unknown");
    expect(judgeVerdict(r("待核实"), r("高"), r("高")).id).toBe("unknown");
  });
});

describe("catalog（真实素材）", () => {
  it("30 篇笔记，来源链接不含查询参数/令牌", () => {
    expect(catalog.notes).toHaveLength(30);
    for (const n of catalog.notes) {
      expect(n.url).toMatch(/^https:\/\/www\.xiaohongshu\.com\/explore\/[0-9a-f]+$/);
      expect(n.summary.length).toBeGreaterThan(5);
    }
  });
  it("未映射素材必须写明原因；其余都被某家店引用", () => {
    expect(catalog.unmapped.length).toBeGreaterThan(0);
    for (const n of catalog.unmapped) expect(n.unmappedReason).toBeTruthy();
    expect(catalog.notes.length - catalog.unmapped.length).toBeGreaterThanOrEqual(20);
  });
  it("引用不存在的笔记会报错", () => {
    const raw = { schemaVersion: 1, sourceGeneratedAt: null, collectionNote: "", notes: [] };
    const shops = { schemaVersion: 1, dataVersion: "x", updatedAt: "2026-01-01", shops: [{ id: "a", name: "A", keywords: ["a"], evidence: [{ noteId: "zz", axis: "stability", polarity: "pos", strength: "weak", text: "t" }] }] };
    expect(() => buildCatalog(raw, shops)).toThrow(/不存在/);
  });
  it("真实数据的几个关键结论", () => {
    const shops = buildShops([]);
    const by = (id: string) => shops.find((s) => s.key === id)!;
    expect(by("jianglong").axes.stability.level).toBe("高");
    expect(by("jianglong").axes.crossing.level).toBe("待核实");
    expect(by("zhiting").axes.parents.level).toBe("高");
    expect(by("zhiting").verdict.id).toBe("parents");
    expect(by("qiwu").axes.parents.level).toBe("低");
    expect(by("qiwu").hasNegative).toBe(true);
    expect(by("xiaoshi").axes.stability.disputed).toBe(true);
  });
});

describe("buildShops / filterShops", () => {
  const pois = [poi("a", { name: "匠龙Omakase（福田店）", cost: 260 }), poi("b", { name: "匠龍 大悦城店", lng: 113.95, lat: 22.52 }), poi("c", { name: "某某鮨", cost: 700 }), poi("d", { name: "匠龙文具", type: "购物服务;文化用品店" })];
  const shops = buildShops(pois);
  it("同一门店命中多个分店时各出一张卡并共享证据，非餐饮不匹配", () => {
    const jl = shops.filter((s) => s.curated?.id === "jianglong");
    expect(jl.map((s) => s.poi?.id).sort()).toEqual(["a", "b"]);
    expect(jl.every((s) => s.axes.stability.level === "高")).toBe(true);
    expect(matchesCurated(pois[3], catalog.shops.find((s) => s.id === "jianglong")!)).toBe(false);
  });
  it("未命中的整理门店仍显示（无定位），仅高德的店无证据", () => {
    expect(shops.some((s) => s.key === "zhiting" && !s.poi)).toBe(true);
    const c = shops.find((s) => s.key === "amap:c")!;
    expect(c.sources).toBe(0);
    expect(c.verdict.id).toBe("unknown");
    expect(c.axes.parents.level).toBe("待核实");
  });
  it("筛选：高/人均/口岸/搜索/我的", () => {
    const run = (o: Partial<ReturnType<typeof defaultFilters>>, st = {}) => filterShops(shops, { ...defaultFilters(), ...o }, st);
    expect(run({ stable: true }).every((s) => s.axes.stability.level === "高")).toBe(true);
    expect(run({ crossing: true })).toHaveLength(0);
    expect(run({ price: "gt600" }).map((s) => s.key).sort()).toEqual(["amap:c", "qiwu"]);
    expect(run({ price: "lt300" }).every((s) => (s.priceNum ?? 999) < 300)).toBe(true);
    expect(run({ port: "szbay" }).map((s) => s.poi?.id)).toEqual(["b"]);
    expect(run({ query: "福田店" }).map((s) => s.poi?.id)).toEqual(["a"]);
    expect(run({ mine: true })).toHaveLength(0);
    const mine = run({ mine: true }, { "amap:c": { favorite: true, visited: false, note: "" } });
    expect(mine.map((s) => s.key)).toEqual(["amap:c"]);
  });
  it("个人状态兼容旧键", () => {
    const v = shops.find((s) => s.key === "amap:c")!;
    expect(stateOf({ "amap:c": { favorite: true, visited: false, note: "n" } }, v).note).toBe("n");
    expect(stateOf({}, v)).toEqual({ favorite: false, visited: false, note: "" });
  });
});

describe("ports", () => {
  it("距离合理且由近到远", () => {
    expect(distanceKm(PORTS[0], PORTS[0])).toBe(0);
    const d = portDistances({ lng: 113.95, lat: 22.5 });
    expect(d[0].port.id).toBe("szbay");
    expect(d[0].km).toBeLessThan(d[1].km);
  });
});

describe("amap 映射", () => {
  it("缺失字段保持 undefined，不编造", () => {
    const p = mapPoi({ id: "1", name: "x", location: { lng: 114, lat: 22.5 }, rating: [], cost: "", tel: "[]" });
    expect(p).toMatchObject({ id: "1", name: "x" });
    expect(p?.rating).toBeUndefined();
    expect(p?.cost).toBeUndefined();
    expect(p?.tel).toBeUndefined();
    expect(mapPoi({ id: "1", name: "x" })).toBeNull();
  });
  it("发现结果过滤：只保留像 Omakase/寿司的店", () => {
    expect(looksLikeOmakase(poi("1", { name: "某某鮨" }))).toBe(true);
    expect(looksLikeOmakase(poi("2", { name: "老王面馆", type: "餐饮服务;中餐厅" }))).toBe(false);
  });
});

describe("parseBackup", () => {
  it("v2 通过校验；错误输入都被拒绝", () => {
    expect(parseBackup(JSON.stringify(emptyData())).ok).toBe(true);
    for (const bad of ["{", "[]", "null", "{}", JSON.stringify({ schemaVersion: 9 }), JSON.stringify({ schemaVersion: 2, shops: { a: { favorite: "x" } } })]) {
      expect(parseBackup(bad).ok).toBe(false);
    }
  });
  it("v1 只迁移收藏/去过/备注", () => {
    const r = parseBackup(JSON.stringify({ schemaVersion: 1, notes: { p: { favorite: true, privateNote: "n", style: "x" }, q: {} }, checkins: [{}] }));
    expect(r.ok && r.data.shops).toEqual({ "amap:p": { favorite: true, visited: false, note: "n" } });
  });
});

describe("stateOf 回退", () => {
  it("高德未命中时读取任一分店键的个人记录", () => {
    const v = buildShops([]).find((s) => s.key === "zhiting")!;
    expect(stateOf({ "zhiting@123": { favorite: true, visited: false, note: "分店" } }, v).note).toBe("分店");
  });
});

describe("judgeAxis 边界", () => {
  it("365 天内算强、超过算旁证；缺日期按旁证", () => {
    const n = new Map<string, unknown>([["a", { publishedAt: "2025-11-20" }], ["b", { publishedAt: "2025-11-19" }], ["c", { publishedAt: null }]]);
    const run = (id: string) => judgeAxis("stability", [ev(id, "pos", "strong")], n as never, "2026-11-20").evidence[0].stale;
    expect(run("a")).toBe(false);
    expect(run("b")).toBe(true);
    expect(run("c")).toBe(true);
  });
  it("同一篇笔记的两条强正面只算 1 个来源，不能给高", () => {
    expect(J([ev("n1", "pos", "strong"), ev("n1", "pos", "strong")]).level).toBe("中");
  });
});
