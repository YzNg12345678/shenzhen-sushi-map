import { describe, expect, it } from "vitest";
import { opensLate, parseRanges } from "@/lib/openTime";
import { recommend } from "@/lib/recommend";
import { buildTaste } from "@/lib/taste";
import { FISH, fishMatches } from "@/lib/fish";
import { emptyData, emptyNote, parseBackup, type Checkin, type Poi } from "@/lib/types";

const poi = (id: string, o: Partial<Poi> = {}): Poi => ({ id, name: `店${id}`, lng: 114, lat: 22.5, fetchedAt: "2026-01-01T00:00:00Z", ...o });
const ctx = { notes: {}, checkins: [] };

describe("openTime", () => {
  it("解析跨午夜时间段", () => {
    expect(parseRanges("周一至周日 17:30-02:00")).toEqual([[1050, 1560]]);
    expect(opensLate("11:30-14:00 17:30-22:30")).toBe(true);
    expect(opensLate("11:00-21:00")).toBe(false);
  });
  it("未知时不猜", () => {
    expect(opensLate(undefined)).toBeUndefined();
    expect(opensLate("请电话咨询")).toBeUndefined();
  });
});

describe("recommend", () => {
  const pois = [
    poi("a", { rating: 4.8, cost: 600, openTime: "17:00-23:30", name: "某某鮨" }),
    poi("b", { rating: 4.2, cost: 120, openTime: "11:00-21:00" }),
    poi("c", { rating: 4.5, cost: 280 }),
    poi("d", {}),
  ];
  it("最多 3 家并带不同标签", () => {
    const r = recommend(pois, "solo", ctx);
    expect(r.length).toBeLessThanOrEqual(3);
    expect(new Set(r.map((x) => x.badge)).size).toBe(r.length);
    expect(r[0].badge).toBe("最匹配");
  });
  it("深夜只保留营业时间明确的店", () => {
    const r = recommend(pois, "late", ctx);
    expect(r.map((x) => x.poi.id)).toEqual(["a"]);
  });
  it("预算排除超预算店，未知人均保留但标注", () => {
    const r = recommend(pois, "budget", ctx, 300);
    expect(r.map((x) => x.poi.id)).not.toContain("a");
    expect(r.find((x) => x.poi.id === "d")?.reasons.some((x) => x.text.includes("未提供人均"))).toBe(true);
  });
  it("预算场景未填预算返回空", () => {
    expect(recommend(pois, "budget", ctx)).toEqual([]);
  });
  it("不再去的店被排除，且理由不含编造字段", () => {
    const notes = { a: { ...emptyNote(), revisit: "no" as const } };
    const r = recommend(pois, "omakase", { notes, checkins: [] });
    expect(r.map((x) => x.poi.id)).not.toContain("a");
  });
  it("结果稳定", () => {
    expect(recommend(pois, "date", ctx)).toEqual(recommend(pois, "date", ctx));
  });
});

const checkin = (i: number, pieces: [string, number][], overall = 4): Checkin => ({
  id: `c${i}`, date: "2026-01-01", shopId: "a", shopName: "店a", menu: "", pieces: pieces.map(([fish, rating]) => ({ fish, rating, note: "" })), overall, note: "",
});

describe("taste", () => {
  it("数据不足不下结论", () => {
    const t = buildTaste([checkin(1, [["鲣鱼", 5]])]);
    expect(t.enough).toBe(false);
    expect(t.statements).toEqual([]);
    expect(t.needMore).toContain("打卡");
  });
  it("足够时给出高分鱼种", () => {
    const t = buildTaste([
      checkin(1, [["鲣鱼", 5], ["鲈鱼", 2], ["鰤鱼", 4]]),
      checkin(2, [["鲣鱼", 5], ["鲈鱼", 2], ["海胆", 5]]),
      checkin(3, [["鲣鱼", 4], ["鲈鱼", 2]]),
    ]);
    expect(t.enough).toBe(true);
    expect(t.topFish[0].fish).toBe("鲣鱼");
    expect(t.lowFish[0].fish).toBe("鲈鱼");
    expect(t.topFish.map((f) => f.fish)).not.toContain("海胆");
  });
});

describe("fish", () => {
  it("每条都有来源，且数量不超过目标", () => {
    expect(FISH.length).toBeLessThan(40);
    for (const f of FISH) expect(f.source.url).toMatch(/^https:\/\//);
  });
  it("记录名匹配", () => {
    const f = FISH.find((x) => x.id === "buri")!;
    expect(fishMatches(f, "鰤鱼")).toBe(true);
    expect(fishMatches(f, "海胆")).toBe(false);
  });
});

describe("backup", () => {
  it("往返一致", () => {
    const d = { ...emptyData(), checkins: [checkin(1, [["鲣鱼", 5]])] };
    const r = parseBackup(JSON.stringify(d));
    expect(r.ok && r.data.checkins).toHaveLength(1);
  });
  it("拒绝坏文件", () => {
    expect(parseBackup("not json").ok).toBe(false);
    expect(parseBackup("{}").ok).toBe(false);
    expect(parseBackup(JSON.stringify({ schemaVersion: 99 })).ok).toBe(false);
    const bad = { ...emptyData(), checkins: [{ id: "x", date: "bad", shopName: "a", overall: 9 }] };
    const r = parseBackup(JSON.stringify(bad));
    expect(r.ok).toBe(false);
  });
});

describe("openTime 边界", () => {
  it("恰好 22:00 打烊不算深夜，22:01 之后才算", () => {
    expect(opensLate("11:00-22:00")).toBe(false);
    expect(opensLate("11:00-22:30")).toBe(true);
  });
  it("忽略非法时间", () => {
    expect(parseRanges("11:00-27:99")).toEqual([]);
    expect(opensLate("11:00-27:99")).toBeUndefined();
  });
});

describe("recommend 理由", () => {
  it("理由只引用可见字段：未知评分/人均不会被编造", () => {
    const r = recommend([poi("x", { name: "普通店" })], "solo", ctx);
    const texts = r[0].reasons.map((x) => x.text).join("|");
    expect(texts).toContain("未提供评分");
    expect(texts).not.toMatch(/高德评分 \d/);
    expect(texts).not.toContain("人均 ¥");
  });
  it("无特色字段时明说不代表风格特别", () => {
    const r = recommend([poi("x"), poi("y"), poi("z")], "solo", ctx);
    const t = r.find((p) => p.badge === "最有特色")!.reasons.map((x) => x.text).join("|");
    expect(t).toContain("没有可见的特色字段");
  });
  it("最稳妥理由给出实际已知字段数", () => {
    const r = recommend([poi("x", { rating: 4, cost: 100, address: "某路" }), poi("y")], "solo", ctx);
    const p = r.find((q) => q.badge === "最稳妥")!;
    expect(p.poi.id).toBe("y");
    expect(p.reasons.some((x) => x.text.includes("0 项"))).toBe(true);
    const r2 = recommend([poi("x", { rating: 4, cost: 100, address: "某路" })], "solo", ctx);
    expect(r2).toHaveLength(1);
  });
  it("特色理由只在确有名称关键词或用户填写时出现", () => {
    const notes = { x: { ...emptyNote(), chef: "某师傅" } };
    const r = recommend([poi("x", { rating: 4 }), poi("y", { rating: 5 }), poi("z", { rating: 4.5 })], "solo", { notes, checkins: [] });
    const t = r.find((p) => p.badge === "最有特色")!.reasons.map((x) => x.text).join("|");
    expect(t).toContain("你填写了师傅");
    expect(t).not.toContain("名称/类别含特色关键词");
  });
  it("用户记录理由标注来源并引用真实打卡均分", () => {
    const c = { ...checkin(1, [], 5), shopId: "x" };
    const r = recommend([poi("x", { rating: 4 })], "solo", { notes: {}, checkins: [c] });
    const u = r[0].reasons.find((x) => x.source === "你的记录");
    expect(u?.text).toContain("5.0");
  });
  it("想再去/收藏加分且有对应理由", () => {
    const notes = { x: { ...emptyNote(), favorite: true } };
    const r = recommend([poi("x", { rating: 4 })], "solo", { notes, checkins: [] });
    expect(r[0].reasons.some((x) => x.text === "你已收藏")).toBe(true);
  });
});

describe("taste 阈值", () => {
  it("均分 3.95 不得因四舍五入进入高分", () => {
    const cs = [
      checkin(1, [["甲", 4], ["甲", 4], ["乙", 5]]),
      checkin(2, [["甲", 4], ["甲", 4], ["乙", 5]]),
      checkin(3, [["甲", 4], ["甲", 4], ["乙", 5]]),
    ];
    // 甲 全 4 分：属高分；构造 3.95：19 个 4 + ... 改用精确边界
    expect(buildTaste(cs).topFish.map((f) => f.fish)).toContain("甲");
    const many = [{ fish: "丙", rating: 4 }, ...Array(19).fill({ fish: "丙", rating: 4 })];
    const low = [...many.slice(0, 19), { fish: "丙", rating: 3 }]; // 20 贯，均分 3.95
    const t = buildTaste([
      { ...checkin(1, []), pieces: low.map((p) => ({ ...p, note: "" })) },
      checkin(2, [["丁", 3]]),
      checkin(3, [["戊", 3]]),
    ]);
    expect(t.topFish.map((f) => f.fish)).not.toContain("丙");
  });
  it("单次记录的鱼种不下结论，2 次才计入", () => {
    const t = buildTaste([
      checkin(1, [["甲", 5], ["乙", 5], ["丙", 5], ["丁", 5]]),
      checkin(2, [["甲", 5], ["乙", 1], ["丙", 2], ["戊", 3]]),
      checkin(3, [["己", 3], ["庚", 3]]),
    ]);
    expect(t.topFish.map((f) => f.fish)).toEqual(["甲"]);
    expect(t.lowFish).toEqual([]);
  });
  it("空白鱼名被忽略；刚好阈值（2.5/4）计入", () => {
    const t = buildTaste([
      checkin(1, [[" ", 5], ["甲", 4], ["乙", 2]]),
      checkin(2, [["甲", 4], ["乙", 3], ["丙", 3]]),
      checkin(3, [["丙", 3], ["丁", 3], ["戊", 3]]),
    ]);
    expect(t.topFish.map((f) => f.fish)).toEqual(["甲"]);
    expect(t.lowFish.map((f) => f.fish)).toEqual(["乙"]);
  });
  it("无打卡不崩溃", () => {
    const t = buildTaste([]);
    expect(t.avgOverall).toBeNull();
    expect(t.enough).toBe(false);
  });
});

describe("fish 匹配", () => {
  it("单字不泛匹配", () => {
    for (const f of FISH) expect(fishMatches(f, "鱼")).toBe(false);
    expect(fishMatches(FISH[0], "")).toBe(false);
  });
  it("日文名可匹配，月份合法", () => {
    expect(fishMatches(FISH[0], "カツオ")).toBe(true);
    for (const f of FISH) for (const m of f.months) expect(m >= 1 && m <= 12).toBe(true);
  });
});

describe("backup 校验加强", () => {
  const base = () => JSON.parse(JSON.stringify(emptyData()));
  const ck = { id: "k", date: "2026-02-03", shopName: "a", overall: 4 };
  it("接受带默认值的最小打卡", () => {
    const d = { ...base(), checkins: [ck] };
    const r = parseBackup(JSON.stringify(d));
    expect(r.ok && r.data.checkins[0].pieces).toEqual([]);
  });
  it("拒绝不存在的日期", () => {
    for (const date of ["2026-02-30", "2026-13-01", "2026-00-10"])
      expect(parseBackup(JSON.stringify({ ...base(), checkins: [{ ...ck, date }] })).ok).toBe(false);
  });
  it("拒绝重复打卡 id、重复比较项、超过 3 家", () => {
    expect(parseBackup(JSON.stringify({ ...base(), checkins: [ck, ck] })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ ...base(), compare: ["a", "a"] })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ ...base(), compare: ["a", "b", "c", "d"] })).ok).toBe(false);
  });
  it("拒绝 poi 键名与 id 不一致、越界坐标、评分", () => {
    const p = poi("a");
    expect(parseBackup(JSON.stringify({ ...base(), pois: { b: p } })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ ...base(), pois: { a: { ...p, lat: 99 } } })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ ...base(), pois: { a: { ...p, rating: 6 } } })).ok).toBe(false);
  });
  it("拒绝数组/null/原始值/非整数评分", () => {
    for (const t of ["[]", "null", "42", '"x"', ""]) expect(parseBackup(t).ok).toBe(false);
    const pc = { ...ck, pieces: [{ fish: "甲", rating: 3.5 }] };
    expect(parseBackup(JSON.stringify({ ...base(), checkins: [pc] })).ok).toBe(false);
  });
  it("错误信息声明未修改，且不抛异常", () => {
    const r = parseBackup('{"schemaVersion":1,"checkins":"x"}');
    expect(!r.ok && r.error).toContain("未做任何修改");
  });
  it("__proto__ 键不会污染原型", () => {
    parseBackup('{"schemaVersion":1,"notes":{"__proto__":{"favorite":true}}}');
    expect(({} as Record<string, unknown>).favorite).toBeUndefined();
  });
});
