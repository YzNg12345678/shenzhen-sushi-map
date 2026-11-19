import { z } from "zod";
import notesJson from "@/data/notes.json";
import shopsJson from "@/data/shops.json";

export const AXES = ["stability", "parents", "crossing"] as const;
export type Axis = (typeof AXES)[number];
export const AXIS_LABEL: Record<Axis, string> = { stability: "稳定性", parents: "带父母", crossing: "过关价值" };

const noteSchema = z.object({
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

const notesFile = z.object({
  schemaVersion: z.literal(1),
  sourceGeneratedAt: z.string().nullable(),
  collectionNote: z.string(),
  notes: z.array(noteSchema),
});

const evidenceSchema = z.object({
  noteId: z.string().min(1),
  axis: z.enum(AXES),
  polarity: z.enum(["pos", "neg"]),
  strength: z.enum(["strong", "weak"]),
  text: z.string().min(1),
});
export type Evidence = z.infer<typeof evidenceSchema>;

const curatedSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  keywords: z.array(z.string().min(1)).min(1),
  /** 笔记只涉及特定分店时，POI 名称还须含其中之一才算匹配。 */
  branchKeywords: z.array(z.string().min(1)).optional(),
  style: z.string().optional(),
  branch: z.string().optional(),
  seating: z.string().optional(),
  price: z.object({ set: z.string().optional(), drinks: z.string().optional(), extras: z.string().optional() }).optional(),
  evidence: z.array(evidenceSchema),
});
export type CuratedShop = z.infer<typeof curatedSchema>;

const shopsFile = z.object({
  schemaVersion: z.literal(1),
  dataVersion: z.string(),
  updatedAt: z.string(),
  shops: z.array(curatedSchema),
});

export interface Catalog {
  dataVersion: string;
  updatedAt: string;
  sourceGeneratedAt: string | null;
  notes: Note[];
  shops: CuratedShop[];
  noteById: Map<string, Note>;
  unmapped: Note[];
}

/** 解析并交叉校验：证据引用的笔记必须存在，门店 id 不重复。 */
export function buildCatalog(rawNotes: unknown, rawShops: unknown): Catalog {
  const nf = notesFile.parse(rawNotes);
  const sf = shopsFile.parse(rawShops);
  const noteById = new Map(nf.notes.map((n) => [n.noteId, n]));
  if (noteById.size !== nf.notes.length) throw new Error("notes.json 含重复 noteId");
  const ids = new Set<string>();
  const mapped = new Set<string>();
  for (const s of sf.shops) {
    if (ids.has(s.id)) throw new Error(`shops.json 含重复门店 id：${s.id}`);
    ids.add(s.id);
    for (const e of s.evidence) {
      if (!noteById.has(e.noteId)) throw new Error(`门店 ${s.id} 引用了不存在的笔记 ${e.noteId}`);
      mapped.add(e.noteId);
    }
  }
  return {
    dataVersion: sf.dataVersion,
    updatedAt: sf.updatedAt,
    sourceGeneratedAt: nf.sourceGeneratedAt,
    notes: nf.notes,
    shops: sf.shops,
    noteById,
    unmapped: nf.notes.filter((n) => !mapped.has(n.noteId)),
  };
}

export const catalog: Catalog = buildCatalog(notesJson, shopsJson);
