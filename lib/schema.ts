import { z } from "zod";

/**
 * 数据契约（schemaVersion 3）。所有“事实性”字段都是 Claim：必须带 ≥1 个来源 id；
 * 没有来源支持的字段一律写 null（界面显示“待核实”），不得用空话填充。
 *
 * 来源 id 命名：
 *   xhs:<noteId>   → data/notes.json 中的小红书笔记（只用摘要，互动量不作为质量证据）
 *   web:<slug>     → data/sources.json 中的公开来源
 *   amap:<slug>    → data/sources.json 中的高德事实核对记录
 */
export const SOURCE_ID = /^(xhs|web|amap):[A-Za-z0-9_.\-]+$/;
export const sourceId = z.string().regex(SOURCE_ID, "来源 id 必须形如 xhs:<noteId> / web:<slug> / amap:<slug>");

export const claimSchema = z.object({
  text: z.string().min(6),
  sources: z.array(sourceId).min(1),
  /** 该说法对应来源的日期（YYYY-MM-DD 或 YYYY-MM），用于展示时效。 */
  asOf: z.string().optional(),
});
export type Claim = z.infer<typeof claimSchema>;
export const claimOrNull = claimSchema.nullable();

export const sourceSchema = z.object({
  id: sourceId,
  kind: z.enum(["web", "amap"]),
  title: z.string().min(2),
  publisher: z.string().min(2),
  url: z.string().url().optional(),
  publishedAt: z.string().optional(),
  accessedAt: z.string(),
  /** 来源类型：用于告诉读者证据强度。 */
  tier: z.enum(["官方/政府", "行业机构", "权威媒体/出版物", "商家自述", "地图平台", "百科/二手整理"]),
  /** 一句话说明这条来源支撑了什么。 */
  supports: z.string().min(4),
});
export type Source = z.infer<typeof sourceSchema>;

export const noteSchema = z.object({
  noteId: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url(),
  publishedAt: z.string().nullable(),
  collectedAt: z.string().nullable(),
  tags: z.array(z.string()),
  summary: z.string(),
  unmappedReason: z.string().optional(),
});
export type Note = z.infer<typeof noteSchema>;

/* ───────────── 筛选规则与候选审计 ───────────── */

export const ruleSchema = z.object({
  id: z.string().regex(/^R\d+$/),
  kind: z.enum(["include", "exclude", "price", "evidence"]),
  title: z.string().min(2),
  text: z.string().min(10),
});
export type Rule = z.infer<typeof ruleSchema>;

export const checkSchema = z.object({
  rule: z.string().regex(/^R\d+$/),
  result: z.enum(["pass", "fail", "unknown"]),
  note: z.string().min(4),
  sources: z.array(sourceId).default([]),
});
export type Check = z.infer<typeof checkSchema>;

/** 店铺类别（审计结论）。只有 “omakase” 与 “omakase-adjacent” 可能进入主清单，且 adjacent 需逐店论证。 */
export const CATEGORIES = [
  "omakase-sushi",      // 板前 Omakase 寿司
  "omakase-other",      // 非寿司的主厨发办（板前割烹/怀石/日法等），须有主厨发办 + 板前证据
  "regular-japanese",   // 普通日料
  "izakaya",            // 居酒屋
  "kaiten",             // 回转寿司
  "buffet",             // 放题 / 自助
  "regular-sushi",      // 普通寿司店 / 外卖寿司
  "other-cuisine",      // 其他非 Omakase
  "unknown",
] as const;
export const categorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof categorySchema>;

export const priceSchema = z.object({
  /** pass=有来源证明人均≥300；fail=明确<300；unknown=无法核实。 */
  result: z.enum(["pass", "fail", "unknown"]),
  /** 用于门槛判断的“每位”数字：优先套餐起步价/人均中位数；未知则缺省。 */
  perPersonMin: z.number().positive().optional(),
  perPersonMax: z.number().positive().optional(),
  /** 展示文案，例如“套餐 680 / 980 元每位（来源日期见证据）”。 */
  label: z.string().min(2),
  basis: z.array(claimSchema).default([]),
});
export type PriceAudit = z.infer<typeof priceSchema>;

/** 逐店精细评价。只允许来源支持的内容；null = 待核实。 */
export const profileSchema = z.object({
  /** 一句话定位：必须是这家店独有的描述，禁止模板话术。 */
  headline: claimSchema,
  cuisine: claimOrNull,         // 料理风格/流派
  ingredients: claimOrNull,     // 招牌食材与技法
  chef: claimOrNull,            // 主厨/出品节奏
  menu: claimOrNull,            // 套餐与加点
  value: claimOrNull,           // 价位与价值
  space: claimOrNull,           // 座位 / 氛围 / 服务
  booking: claimOrNull,         // 预约难度
  scenes: claimOrNull,          // 适合场景
  strengths: z.array(claimSchema), // 突出优势
  risks: z.array(claimSchema),     // 真实风险 / 争议
  disputes: z.array(claimSchema).default([]), // 来源之间互相矛盾的地方
});
export type Profile = z.infer<typeof profileSchema>;

export const PROFILE_FIELDS: { key: Exclude<keyof Profile, "headline" | "strengths" | "risks" | "disputes">; label: string }[] = [
  { key: "cuisine", label: "料理风格 / 流派" },
  { key: "ingredients", label: "招牌食材与技法" },
  { key: "chef", label: "主厨与出品节奏" },
  { key: "menu", label: "套餐与加点" },
  { key: "value", label: "价位与价值" },
  { key: "space", label: "座位 · 氛围 · 服务" },
  { key: "booking", label: "预约难度" },
  { key: "scenes", label: "适合场景" },
];

export const confidenceSchema = z.object({
  level: z.enum(["高", "中", "低"]),
  reason: z.string().min(6),
});

export const candidateSchema = z.object({
  id: z.string().regex(/^[a-z0-9\-]+$/),
  name: z.string().min(1),
  /** 别名/简称/日文名，用于匹配高德 POI 与小红书笔记。 */
  keywords: z.array(z.string().min(1)).min(1),
  /** 分店限定：POI 名称须同时含其中之一。 */
  branchKeywords: z.array(z.string().min(1)).optional(),
  /** 已知分店/门店位置说明（来自来源）。 */
  branchNote: z.string().optional(),
  category: categorySchema,
  decision: z.enum(["include", "exclude", "pending"]),
  /** 逐条规则检查；include 必须含 identity 与 price 两类 pass。 */
  checks: z.array(checkSchema).min(1),
  /** Omakase 身份结论与证据。 */
  identity: z.object({ result: z.enum(["pass", "fail", "unknown"]), basis: z.array(claimSchema) }),
  price: priceSchema,
  /** 面向读者的纳入/排除/待核实理由，必须逐店具体。 */
  reason: z.string().min(12),
  /** 高德事实字段（来自真实检索核对）；未知为 null。 */
  amapFacts: z.object({ checkedAt: z.string(), found: z.boolean(), name: z.string().optional(), address: z.string().optional(), cost: z.number().optional(), note: z.string().optional() }).nullable().default(null),
  /** 仅 include 必填。 */
  profile: profileSchema.optional(),
  confidence: confidenceSchema.optional(),
  updatedAt: z.string(),
});
export type Candidate = z.infer<typeof candidateSchema>;

export const auditFileSchema = z.object({
  schemaVersion: z.literal(3),
  dataVersion: z.string(),
  updatedAt: z.string(),
  /** 价格硬门槛（元/位）。 */
  priceFloor: z.literal(300),
  /** 深圳 Omakase 实际特点的研究摘要（带来源）。 */
  characteristics: z.array(claimSchema).min(3),
  rules: z.array(ruleSchema).min(6),
  /** 动态高德检索中要拒绝的名称/类型模式（普通日料、回转、放题、居酒屋等），正则字符串。 */
  excludeNamePatterns: z.array(z.object({ pattern: z.string(), label: z.string() })).min(5),
  candidates: z.array(candidateSchema).min(10),
});
export type AuditFile = z.infer<typeof auditFileSchema>;

/* ───────────── 图鉴 ───────────── */

export const ATLAS_CATEGORIES = ["白身鱼", "青背・光物", "赤身・金枪鱼", "其他鱼类", "贝类", "甲壳类", "头足类", "海胆・鱼卵", "配料・调味"] as const;
export const atlasCategorySchema = z.enum(ATLAS_CATEGORIES);
export type AtlasCategory = z.infer<typeof atlasCategorySchema>;

export const atlasItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9\-]+$/),
  zh: z.string().min(1),
  ja: z.string().min(1),          // 日文名 / 寿司店常用名（可含假名读音）
  aliases: z.array(z.string()).default([]),
  category: atlasCategorySchema,
  /** 旬：months 为 1–12；空数组表示“全年/不以旬论”，此时必须写 seasonNote。 */
  season: z.object({
    months: z.array(z.number().int().min(1).max(12)),
    /** 必须说明地域/养殖/冷冻/供应差异；月份不是绝对保证。 */
    note: z.string().min(12),
  }),
  flavor: z.string().min(6),       // 风味与口感
  techniques: z.array(z.string().min(2)).min(1), // 常见处理 / 熟成 / 醋渍 / 炙烧 / 煮切…
  omakaseRole: z.string().min(6),  // 在 Omakase 套餐中的角色
  tips: z.string().min(6),         // 识别或食用要点
  sources: z.array(sourceId).min(1),
});
export type AtlasItem = z.infer<typeof atlasItemSchema>;

export const atlasFileSchema = z.object({
  schemaVersion: z.literal(1),
  dataVersion: z.string(),
  updatedAt: z.string(),
  /** 页面顶部必须展示的季节免责声明。 */
  seasonDisclaimer: z.string().min(20),
  items: z.array(atlasItemSchema).min(30),
});
export type AtlasFile = z.infer<typeof atlasFileSchema>;

export const sourcesFileSchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  sources: z.array(sourceSchema),
});
