import { z } from "zod";

export const SCHEMA_VERSION = 2;

/** 高德返回的店铺事实。缺失字段一律为 undefined，界面显示“待核实”。 */
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

/** 个人状态：只含收藏 / 去过 / 备注。键为店铺 key（见 lib/shops.ts）。 */
export const shopStateSchema = z.object({
  favorite: z.boolean().default(false),
  visited: z.boolean().default(false),
  note: z.string().max(4000).default(""),
});
export type ShopState = z.infer<typeof shopStateSchema>;

export const appDataSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  exportedAt: z.string().optional(),
  shops: z.record(z.string().min(1), shopStateSchema).default({}),
});
export type AppData = z.infer<typeof appDataSchema>;

export const emptyState = (): ShopState => shopStateSchema.parse({});
export const emptyData = (): AppData => ({ schemaVersion: SCHEMA_VERSION, shops: {} });

export type ParseResult = { ok: true; data: AppData } | { ok: false; error: string };

/** 旧版（v1，“深圳寿司地图”）备份：只迁移收藏/去过/私人备注，其余字段丢弃。 */
function migrateV1(raw: Record<string, unknown>): AppData {
  const out = emptyData();
  const notes = raw.notes && typeof raw.notes === "object" ? (raw.notes as Record<string, Record<string, unknown>>) : {};
  for (const [id, n] of Object.entries(notes)) {
    if (!id || !n || typeof n !== "object") continue;
    const s = shopStateSchema.safeParse({ favorite: n.favorite === true, visited: n.visited === true, note: typeof n.privateNote === "string" ? n.privateNote.slice(0, 4000) : "" });
    if (s.success && (s.data.favorite || s.data.visited || s.data.note)) out.shops[`amap:${id}`] = s.data;
  }
  return out;
}

/** 校验导入文本；任何错误都不会产生副作用。 */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "文件不是有效的 JSON，未做任何修改。" };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "备份文件格式不正确（应为对象），未做任何修改。" };
  }
  if (!("schemaVersion" in raw)) return { ok: false, error: "缺少 schemaVersion，不是本应用的备份文件，未做任何修改。" };
  const v = (raw as { schemaVersion: unknown }).schemaVersion;
  if (v === 1) return { ok: true, data: migrateV1(raw as Record<string, unknown>) };
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
