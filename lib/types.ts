import { z } from "zod";

export const SCHEMA_VERSION = 1;

/** 高德返回的店铺事实。缺失字段一律为 undefined，界面显示“未知”。 */
export const poiSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  address: z.string().optional(),
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  tel: z.string().optional(),
  district: z.string().optional(),
  businessArea: z.string().optional(),
  type: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  cost: z.number().min(0).optional(),
  openTime: z.string().optional(),
  fetchedAt: z.string(),
});
export type Poi = z.infer<typeof poiSchema>;

export const VINEGAR = ["unknown", "red", "white", "mixed"] as const;
export const REVISIT = ["unset", "yes", "maybe", "no"] as const;
export const RESERVATION = ["unknown", "easy", "normal", "hard"] as const;

export const shopNoteSchema = z.object({
  favorite: z.boolean().default(false),
  visited: z.boolean().default(false),
  revisit: z.enum(REVISIT).default("unset"),
  style: z.string().max(200).default(""),
  vinegar: z.enum(VINEGAR).default("unknown"),
  aging: z.string().max(200).default(""),
  chef: z.string().max(200).default(""),
  seating: z.string().max(200).default(""),
  setMenu: z.string().max(400).default(""),
  reservation: z.enum(RESERVATION).default("unknown"),
  privateNote: z.string().max(4000).default(""),
});
export type ShopNote = z.infer<typeof shopNoteSchema>;

export const pieceSchema = z.object({
  fish: z.string().min(1).max(60),
  rating: z.number().int().min(1).max(5),
  note: z.string().max(500).default(""),
});
export type Piece = z.infer<typeof pieceSchema>;

function isRealDate(s: string): boolean {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export const checkinSchema = z.object({
  id: z.string().min(1),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(isRealDate, "不是真实存在的日期"),
  shopId: z.string().default(""),
  shopName: z.string().min(1).max(100),
  menu: z.string().max(400).default(""),
  price: z.number().min(0).optional(),
  pieces: z.array(pieceSchema).max(80).default([]),
  overall: z.number().int().min(1).max(5),
  note: z.string().max(4000).default(""),
});
export type Checkin = z.infer<typeof checkinSchema>;

export const appDataSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  exportedAt: z.string().optional(),
  notes: z.record(z.string(), shopNoteSchema).default({}),
  pois: z.record(z.string(), poiSchema).default({}),
  checkins: z.array(checkinSchema).default([]),
  compare: z.array(z.string()).max(3).default([]),
}).superRefine((d, ctx) => {
  for (const [key, poi] of Object.entries(d.pois)) {
    if (poi.id !== key) ctx.addIssue({ code: "custom", path: ["pois", key, "id"], message: "与键名不一致" });
  }
  const seen = new Set<string>();
  d.checkins.forEach((c, i) => {
    if (seen.has(c.id)) ctx.addIssue({ code: "custom", path: ["checkins", i, "id"], message: "打卡 id 重复" });
    seen.add(c.id);
  });
  if (new Set(d.compare).size !== d.compare.length)
    ctx.addIssue({ code: "custom", path: ["compare"], message: "比较列表含重复项" });
});
export type AppData = z.infer<typeof appDataSchema>;

export const emptyNote = (): ShopNote => shopNoteSchema.parse({});
export const emptyData = (): AppData => ({
  schemaVersion: SCHEMA_VERSION,
  notes: {},
  pois: {},
  checkins: [],
  compare: [],
});

export type ParseResult = { ok: true; data: AppData } | { ok: false; error: string };

/** 校验导入文本；任何错误都不会产生副作用。 */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "文件不是有效的 JSON，未做任何修改。" };
  }
  if (typeof raw !== "object" || raw === null || !("schemaVersion" in raw)) {
    return { ok: false, error: "缺少 schemaVersion，不是本应用的备份文件，未做任何修改。" };
  }
  if (Array.isArray(raw)) return { ok: false, error: "备份文件格式不正确（应为对象），未做任何修改。" };
  const v = (raw as { schemaVersion: unknown }).schemaVersion;
  if (v !== SCHEMA_VERSION) {
    return { ok: false, error: `不支持的 schemaVersion：${String(v)}（当前支持 ${SCHEMA_VERSION}），未做任何修改。` };
  }
  const res = appDataSchema.safeParse(raw);
  if (!res.success) {
    const issue = res.error.issues[0];
    return { ok: false, error: `备份内容校验失败：${issue.path.join(".") || "根"} ${issue.message}，未做任何修改。` };
  }
  return { ok: true, data: res.data };
}
