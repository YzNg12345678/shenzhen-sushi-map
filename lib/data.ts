import { z } from "zod";
import atlasJson from "@/data/atlas.json";
import auditJson from "@/data/audit.json";
import notesJson from "@/data/notes.json";
import sourcesAtlasJson from "@/data/sources.atlas.json";
import sourcesShopsJson from "@/data/sources.shops.json";
import { SOURCE_ID, atlasFileSchema, auditFileSchema, noteSchema, sourcesFileSchema, type AtlasFile, type AuditFile, type Note, type Source } from "./schema";

export interface ResolvedSource {
  id: string;
  label: string;
  url?: string;
  /** 来源强度说明，用于界面提示。 */
  tier: Source["tier"] | "用户内容";
  date?: string;
  publisher: string;
}

export interface Dataset {
  audit: AuditFile;
  atlas: AtlasFile;
  notes: Note[];
  sources: Map<string, ResolvedSource>;
}

const notesFile = z.object({ schemaVersion: z.literal(1), sourceGeneratedAt: z.string().nullable(), collectionNote: z.string(), notes: z.array(noteSchema) });

function collectSourceRefs(v: unknown, out: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x) => collectSourceRefs(x, out));
  else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      if (k === "sources" && Array.isArray(x)) out.push(...(x as string[]));
      else collectSourceRefs(x, out);
    }
  }
  return out;
}

/** 解析并交叉校验：schema、来源可解析、include 店的硬性条件。任何不一致直接抛错（构建/测试失败）。 */
export function buildDataset(raw: { audit: unknown; atlas: unknown; notes: unknown; sourceFiles: unknown[] }): Dataset {
  const audit = auditFileSchema.parse(raw.audit);
  const atlas = atlasFileSchema.parse(raw.atlas);
  const nf = notesFile.parse(raw.notes);
  const sources = new Map<string, ResolvedSource>();
  for (const n of nf.notes) {
    const id = `xhs:${n.noteId}`;
    if (sources.has(id)) throw new Error(`重复笔记 ${id}`);
    sources.set(id, { id, label: n.title, url: n.url, tier: "用户内容", date: n.publishedAt ?? undefined, publisher: "小红书用户笔记" });
  }
  for (const f of raw.sourceFiles) {
    for (const s of sourcesFileSchema.parse(f).sources) {
      if (sources.has(s.id)) throw new Error(`重复来源 ${s.id}`);
      sources.set(s.id, { id: s.id, label: s.title, url: s.url, tier: s.tier, date: s.publishedAt, publisher: s.publisher });
    }
  }
  for (const id of [...collectSourceRefs(audit), ...collectSourceRefs(atlas)]) {
    if (!SOURCE_ID.test(id) || !sources.has(id)) throw new Error(`引用了不存在的来源 ${id}`);
  }
  const ids = new Set<string>();
  for (const c of audit.candidates) {
    if (ids.has(c.id)) throw new Error(`重复候选 ${c.id}`);
    ids.add(c.id);
    if (c.decision === "include") {
      if (c.identity.result !== "pass" || c.price.result !== "pass" || !((c.price.perPersonMin ?? 0) >= audit.priceFloor) || !c.profile || !c.confidence) {
        throw new Error(`候选 ${c.id} 标为 include 但身份/价格/评价不合格`);
      }
      if (!["omakase-sushi", "omakase-other"].includes(c.category)) throw new Error(`候选 ${c.id} 类别不允许进入主清单`);
    }
    if (c.price.result === "fail" && c.decision !== "exclude") throw new Error(`候选 ${c.id} 人均不足 300 却未排除`);
  }
  const aid = new Set<string>();
  for (const a of atlas.items) {
    if (aid.has(a.id)) throw new Error(`重复图鉴条目 ${a.id}`);
    aid.add(a.id);
  }
  return { audit, atlas, notes: nf.notes, sources };
}

export const dataset: Dataset = buildDataset({
  audit: auditJson,
  atlas: atlasJson,
  notes: notesJson,
  sourceFiles: [sourcesShopsJson, sourcesAtlasJson],
});
export const { audit, atlas } = dataset;

export const resolveSource = (id: string): ResolvedSource => dataset.sources.get(id) ?? { id, label: id, tier: "用户内容", publisher: "未知" };
