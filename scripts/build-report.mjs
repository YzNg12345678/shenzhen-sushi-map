// 由 data/*.json 确定性生成审计报告与图鉴来源清单（不含时间戳，重复运行输出一致）。
// 用法：node scripts/build-report.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { auditFileSchema, atlasFileSchema, sourcesFileSchema, noteSchema } from "../lib/schema.ts";

const rd = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), "utf8"));
const audit = auditFileSchema.parse(rd("data/audit.json"));
const atlas = atlasFileSchema.parse(rd("data/atlas.json"));
const notes = new Map(rd("data/notes.json").notes.map((n) => [`xhs:${noteSchema.parse(n).noteId}`, n]));
const srcs = new Map();
for (const f of ["data/sources.shops.json", "data/sources.atlas.json"]) if (existsSync(new URL(`../${f}`, import.meta.url))) for (const s of sourcesFileSchema.parse(rd(f)).sources) srcs.set(s.id, s);
const label = (id) => {
  if (notes.has(id)) { const n = notes.get(id); return `[${n.title.replace(/\s+/g, " ")}](${n.url}) · 小红书用户笔记 ${n.publishedAt ?? ""}`; }
  const s = srcs.get(id); return s ? `[${s.title}](${s.url ?? "#"}) · ${s.publisher} · ${s.tier}` : id;
};
const claims = (arr) => (arr.length ? arr.map((c) => `  - ${c.text}${c.asOf ? `（${c.asOf}）` : ""}\n    - 来源：${c.sources.map(label).join("；")}`).join("\n") : "  - （无）");
const RES = { pass: "通过", fail: "不通过", unknown: "未知" };
const DEC = { include: "纳入主清单", exclude: "排除", pending: "待核实（不计入主清单）" };
const by = (d) => audit.candidates.filter((c) => c.decision === d);

let m = `# 深圳 Omakase 筛选审计报告\n\n- 数据版本：${audit.dataVersion}\n- 数据更新时间：${audit.updatedAt}\n- 价格硬门槛：每位 ¥${audit.priceFloor} 起（明确低于门槛排除；价格未知且无法核实达到门槛，不得进入主清单）\n- 候选 ${audit.candidates.length} 家：纳入 ${by("include").length}、待核实 ${by("pending").length}、排除 ${by("exclude").length}\n- 互动量（点赞/收藏/评论）不作为任何质量或准入证据。\n\n## 1. 深圳 Omakase 的实际特点（研究摘要）\n\n${claims(audit.characteristics)}\n\n## 2. 纳入 / 排除规则\n\n${audit.rules.map((r) => `- **${r.id}（${r.kind}）${r.title}**：${r.text}`).join("\n")}\n\n动态高德检索结果与静态清单使用同一规则（\`lib/rules.ts\`）：未经审计的 POI 一律不进入主清单；名称命中下列模式的直接拒绝并记录原因。\n\n${audit.excludeNamePatterns.map((p) => `- \`${p.pattern}\` → ${p.label}`).join("\n")}\n\n## 3. 汇总表\n\n| 候选 | 类别 | 结论 | 身份 | 价格 | 每位下限 | 更新 |\n| --- | --- | --- | --- | --- | --- | --- |\n${audit.candidates.map((c) => `| ${c.name} | ${c.category} | ${DEC[c.decision]} | ${RES[c.identity.result]} | ${RES[c.price.result]} | ${c.price.perPersonMin ? "¥" + c.price.perPersonMin : "—"} | ${c.updatedAt} |`).join("\n")}\n`;
for (const d of ["include", "pending", "exclude"]) {
  m += `\n## ${d === "include" ? "4" : d === "pending" ? "5" : "6"}. ${DEC[d]}（${by(d).length}）\n`;
  for (const c of by(d)) {
    m += `\n### ${c.name}\n\n- 别名/匹配关键词：${c.keywords.join("、")}${c.branchKeywords ? `；分店限定：${c.branchKeywords.join("、")}` : ""}\n- 类别：${c.category}；结论：**${DEC[c.decision]}**；更新：${c.updatedAt}\n- 理由：${c.reason}\n- 价格：${RES[c.price.result]} · ${c.price.label}\n${claims(c.price.basis)}\n- Omakase 身份：${RES[c.identity.result]}\n${claims(c.identity.basis)}\n- 高德核对：${c.amapFacts ? `${c.amapFacts.found ? "命中" : "未命中"}${c.amapFacts.name ? ` ${c.amapFacts.name}` : ""}${c.amapFacts.address ? `｜${c.amapFacts.address}` : ""}${c.amapFacts.cost !== undefined ? `｜高德人均 ${c.amapFacts.cost}` : ""}${c.amapFacts.note ? `｜${c.amapFacts.note}` : ""}（${c.amapFacts.checkedAt}）` : "未核对"}\n- 逐条规则：\n${c.checks.map((k) => `  - ${k.rule}：${RES[k.result]} — ${k.note}${k.sources.length ? `（来源：${k.sources.join("、")}）` : ""}`).join("\n")}\n`;
    if (c.confidence) m += `- 资料置信度：${c.confidence.level} — ${c.confidence.reason}\n`;
  }
}
writeFileSync(new URL("../artifacts/report/omakase-audit.md", import.meta.url), m);

const used = new Map();
for (const it of atlas.items) for (const s of it.sources) (used.get(s) ?? used.set(s, []).get(s)).push(it.zh);
const tiers = {};
let a = `# 图鉴来源清单\n\n- 图鉴数据版本：${atlas.dataVersion}；更新：${atlas.updatedAt}\n- 条目 ${atlas.items.length}，类别 ${new Set(atlas.items.map((i) => i.category)).size}，引用来源 ${used.size}\n- 季节免责：${atlas.seasonDisclaimer}\n\n## 来源明细\n\n`;
for (const [id, names] of [...used].sort((x, y) => x[0].localeCompare(y[0]))) {
  const s = srcs.get(id); if (s) tiers[s.tier] = (tiers[s.tier] ?? 0) + 1;
  a += `- **${id}** — ${s ? `[${s.title}](${s.url})｜${s.publisher}｜${s.tier}｜访问 ${s.accessedAt}${s.publishedAt ? `｜发布 ${s.publishedAt}` : ""}\n  - 支撑：${s.supports}` : "（未登记）"}\n  - 被条目引用（${names.length}）：${names.join("、")}\n`;
}
a += `\n## 来源分级统计\n\n${Object.entries(tiers).map(([k, v]) => `- ${k}：${v}`).join("\n")}\n\n## 条目一览\n\n| 类别 | 中文名 | 日文名/常用名 | 参考旬 | 来源数 |\n| --- | --- | --- | --- | --- |\n${atlas.items.map((i) => `| ${i.category} | ${i.zh} | ${i.ja} | ${i.season.months.length ? i.season.months.join("、") + "月" : "不以旬论"} | ${i.sources.length} |`).join("\n")}\n`;
writeFileSync(new URL("../artifacts/report/atlas-sources.md", import.meta.url), a);
console.log("reports written");
