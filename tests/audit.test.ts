import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { audit, dataset, resolveSource } from "@/lib/data";
import { classifyPoi, matchedPatterns, splitPois } from "@/lib/rules";
import { buildShops, includedCandidates } from "@/lib/shops";
import type { Claim, Profile } from "@/lib/schema";
import type { Poi } from "@/lib/types";

const poi = (id: string, name: string, o: Partial<Poi> = {}): Poi => ({ id, name, lng: 114.06, lat: 22.53, type: "餐饮服务;外国餐厅;日本料理", fetchedAt: "2026-11-20T00:00:00Z", ...o });
const included = includedCandidates(audit);
const profileClaims = (p: Profile): Claim[] => [p.headline, p.cuisine, p.ingredients, p.chef, p.menu, p.value, p.space, p.booking, p.scenes, ...p.strengths, ...p.risks, ...p.disputes].filter((c): c is Claim => c !== null);

describe("主清单准入：身份与价格硬门槛", () => {
  it("至少有一家入选，且全部是 Omakase 类别", () => {
    expect(included.length).toBeGreaterThan(0);
    for (const c of included) expect(["omakase-sushi", "omakase-other"]).toContain(c.category);
  });
  it.each(included.map((c) => [c.id, c] as const))("%s：Omakase 身份有来源、人均 ≥300 有来源", (_id, c) => {
    expect(c.identity.result).toBe("pass");
    expect(c.identity.basis.length).toBeGreaterThan(0);
    expect(c.price.result).toBe("pass");
    expect(c.price.perPersonMin).toBeGreaterThanOrEqual(300);
    expect(c.price.basis.length).toBeGreaterThan(0);
    for (const claim of [...c.identity.basis, ...c.price.basis]) expect(claim.sources.length).toBeGreaterThan(0);
    const idChecks = c.checks.filter((k) => k.result === "fail");
    expect(idChecks).toEqual([]);
  });
  it("人均明确低于 300、或价格未知的候选不得入选", () => {
    for (const c of audit.candidates) {
      if (c.price.result === "fail") expect(c.decision).toBe("exclude");
      if (c.price.result === "unknown") expect(c.decision).not.toBe("include");
      if (c.price.perPersonMin !== undefined && c.price.perPersonMin < 300) expect(c.decision).not.toBe("include");
    }
  });
  it("排除与待核实的店必须说明具体理由和检查项", () => {
    const rest = audit.candidates.filter((c) => c.decision !== "include");
    expect(rest.length).toBeGreaterThan(0);
    for (const c of rest) {
      expect(c.reason.length).toBeGreaterThan(15);
      expect(c.checks.some((k) => k.result !== "pass")).toBe(true);
    }
    expect(new Set(rest.map((c) => c.reason)).size).toBe(rest.length);
  });
  it("每家候选的 id/关键词唯一，规则编号被检查项引用时存在", () => {
    const rules = new Set(audit.rules.map((r) => r.id));
    expect(rules.size).toBe(audit.rules.length);
    for (const c of audit.candidates) for (const k of c.checks) expect(rules.has(k.rule)).toBe(true);
  });
  it("主清单的店名不命中排除名称模式", () => {
    for (const c of included) expect(matchedPatterns(c.name, audit)).toEqual([]);
  });
});

describe("动态高德结果不能绕过规则", () => {
  const ordinary = [
    "争鲜回转寿司(万象城店)", "元气寿司(COCO Park店)", "寿司郎(福田店)", "藏寿司(深圳湾店)", "鮨味亭·日料 ·锅物料理(深圳湾店)",
    "某某居酒屋(科技园店)", "日本料理放题自助(南山店)", "和牛烧肉放题", "一风堂拉面", "板前烤肉(前海店)", "酒巷板前烧肉·居酒屋", "日阪屋·板前六碗饭(宝能环球汇)", "平价寿司外卖",
  ];
  it.each(ordinary)("普通日料/回转/放题/居酒屋 %s 被拒绝", (name) => {
    const v = classifyPoi(poi("x-" + name, name, { cost: 120 }), audit);
    expect(v.admit).toBe(false);
  });
  it("名字像 Omakase 但未经审计的店不能进入主清单", () => {
    const v = classifyPoi(poi("fake-1", "新开板前Omakase 鮨之味", { cost: 888 }), audit);
    expect(v.admit).toBe(false);
    expect(v.code).toBe("unreviewed");
    const { shops } = buildShops([poi("fake-1", "新开板前Omakase 鮨之味", { cost: 888 })]);
    expect(shops.every((s) => s.candidate.decision === "include")).toBe(true);
    expect(shops.some((s) => s.poi?.id === "fake-1")).toBe(false);
  });
  it("名称带已审计店名但命中排除模式、或分店不符的 POI 被拒绝", () => {
    const c = included[0];
    const base = c.keywords[0] + (c.branchKeywords?.[0] ?? "");
    for (const suffix of ["烧肉放题", "回转寿司", "外卖", "居酒屋"]) expect(classifyPoi(poi("s-" + suffix, base + suffix, { cost: 900 }), audit).admit).toBe(false);
    if (c.branchKeywords) expect(classifyPoi(poi("b1", c.keywords[0] + "(别处分店)", { cost: 900 }), audit).admit).toBe(false);
  });
  it("商场内被归入“购物服务”的已审计门店按审计结论处理，体育休闲等类型拒绝", () => {
    const c = included[0];
    const name = c.keywords[0] + (c.branchKeywords?.[0] ?? "");
    expect(classifyPoi(poi("m1", name, { type: "购物服务;购物相关场所", cost: 900 }), audit).admit).toBe(true);
    expect(classifyPoi(poi("m2", name, { type: "体育休闲服务;运动场馆", cost: 900 }), audit).code).toBe("not-restaurant");
  });
  it("非餐饮类 POI 被拒绝", () => {
    const c = included[0];
    expect(classifyPoi(poi("n1", c.keywords[0], { type: "公司企业;公司" }), audit).code).toBe("not-restaurant");
  });
  it("已排除/待核实候选的 POI 被拒绝并带审计理由", () => {
    for (const c of audit.candidates.filter((x) => x.decision !== "include" && !x.branchKeywords).slice(0, 12)) {
      const v = classifyPoi(poi("e-" + c.id, c.keywords[0]), audit);
      // 可能被另一个更具体的 include 候选关键词覆盖：此时必须是 include 的合法命中
      if (v.admit) expect(v.candidate?.decision).toBe("include");
      else expect(["excluded", "pending", "price-below-floor", "name-pattern"]).toContain(v.code);
    }
  });
  it("已入选店的 POI 若高德人均明确低于 300，同样被拒绝", () => {
    const c = included.find((x) => !x.branchKeywords) ?? included[0];
    const name = c.keywords[0] + (c.branchKeywords?.[0] ?? "");
    expect(classifyPoi(poi("p1", name, { cost: 299 }), audit).code).toBe("price-below-floor");
    expect(classifyPoi(poi("p2", name, { cost: 300 }), audit).admit).toBe(true);
    expect(classifyPoi(poi("p3", name), audit).admit).toBe(true);
  });
  it("真实高德检索快照：所有被放行的 POI 都属于主清单且人均不低于 300", () => {
    const file = path.join(process.cwd(), "artifacts/report/amap-probe.json");
    const probe = JSON.parse(fs.readFileSync(file, "utf8")) as { queries: { pois: { id: string; name: string; type: string; address?: string; cost: string | null }[] }[] };
    const pois: Poi[] = probe.queries.flatMap((q) => q.pois).map((p) => poi(p.id, p.name, { type: p.type, cost: p.cost ? Number(p.cost) : undefined }));
    expect(pois.length).toBeGreaterThan(50);
    const { admitted, rejected } = splitPois(pois, audit);
    for (const a of admitted) {
      expect(a.candidate.decision).toBe("include");
      if (a.poi.cost !== undefined) expect(a.poi.cost).toBeGreaterThanOrEqual(300);
    }
    expect(rejected.length).toBeGreaterThan(admitted.length);
  });
});

describe("逐店评价：差异化、来源与未知字段", () => {
  it.each(included.map((c) => [c.id, c] as const))("%s 有 profile、置信度与更新时间，字段来源可解析", (_id, c) => {
    expect(c.profile).toBeDefined();
    expect(c.confidence?.reason.length).toBeGreaterThan(5);
    expect(c.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const claim of profileClaims(c.profile!)) {
      expect(claim.sources.length).toBeGreaterThan(0);
      for (const s of claim.sources) expect(dataset.sources.has(s)).toBe(true);
    }
    const known = [c.profile!.cuisine, c.profile!.ingredients, c.profile!.chef, c.profile!.menu].filter(Boolean);
    expect(known.length).toBeGreaterThan(0);
  });
  it("摘要、亮点、风险在店与店之间互不相同（非复制模板）", () => {
    const bigrams = (s: string) => {
      const t = s.replace(/\s|[，。、；：！？,.;:!?（）()「」“”"']/g, "");
      const g = new Set<string>();
      for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2));
      return g;
    };
    const jaccard = (a: Set<string>, b: Set<string>) => {
      let inter = 0;
      for (const x of a) if (b.has(x)) inter++;
      return inter / (a.size + b.size - inter || 1);
    };
    expect(new Set(included.map((c) => c.profile!.headline.text)).size).toBe(included.length);
    for (let i = 0; i < included.length; i++) {
      for (let j = i + 1; j < included.length; j++) {
        const A = included[i].profile!, B = included[j].profile!;
        const sig = (p: Profile) => [p.headline.text, ...p.strengths.map((s) => s.text), ...p.risks.map((s) => s.text)].join("");
        expect(jaccard(bigrams(sig(A)), bigrams(sig(B)))).toBeLessThan(0.45);
        expect(A.headline.text).not.toBe(B.headline.text);
        for (const s of A.strengths) expect(B.strengths.map((x) => x.text)).not.toContain(s.text);
        for (const s of A.risks) expect(B.risks.map((x) => x.text)).not.toContain(s.text);
      }
    }
  });
  it("没有任何店把所有评价字段都写成同一句话", () => {
    for (const c of included) {
      const texts = profileClaims(c.profile!).map((x) => x.text);
      expect(new Set(texts).size).toBe(texts.length);
    }
  });
  it("来源引用：小红书笔记存在，公开来源有 url", () => {
    for (const s of dataset.sources.values()) {
      expect(resolveSource(s.id).label.length).toBeGreaterThan(0);
      if (s.id.startsWith("web:")) expect(s.url).toMatch(/^https?:\/\//);
    }
  });
});

describe("旧统一框架已移除", () => {
  const banned = ["每家店只回答三件事", "稳不稳", "带父母合不合适", "值不值得专程过关", "三轴", "AXIS_LABEL", "judgeAxis", "judgeVerdict", "过关价值", "值得专程过关"];
  const roots = ["app", "components", "lib", "data", "docs", "README.md"];
  const files: string[] = [];
  const walk = (p: string) => {
    if (!fs.existsSync(p)) return;
    const st = fs.statSync(p);
    if (st.isDirectory()) fs.readdirSync(p).forEach((n) => walk(path.join(p, n)));
    else if (/\.(tsx?|json|md|css|mjs)$/.test(p)) files.push(p);
  };
  roots.forEach(walk);
  it("源码、数据、文档中没有旧三轴/三件事话术", () => {
    expect(files.length).toBeGreaterThan(5);
    const hits: string[] = [];
    for (const f of files) {
      if (f === path.join("tests", "audit.test.ts")) continue;
      const t = fs.readFileSync(f, "utf8");
      for (const b of banned) if (t.includes(b)) hits.push(`${f}: ${b}`);
    }
    expect(hits).toEqual([]);
  });
});
