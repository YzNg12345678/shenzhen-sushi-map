#!/usr/bin/env node
// 把 shared 素材目录里的 web-dataset.json 同步为 data/notes.json（只读输入）。
// - 只保留来源可追溯的元数据：标题、去掉查询参数的链接、发布/采集日期、标签。
// - 不复制正文、评论、互动量；互动量不是质量证据。
// - 已有笔记的人工字段（summary、unmappedReason）原样保留，新笔记 summary=""（待人工整理）；门店映射在 data/shops.json 的 evidence 中维护。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = process.argv[2] ?? "/Users/recovery/hermes-workspace/shared/xhs-collection/shenzhen-omakase-map/web-dataset.json";
const out = resolve(root, "data/notes.json");

const incoming = JSON.parse(readFileSync(src, "utf8"));
const prev = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : { notes: [] };
const manual = new Map(prev.notes.map((n) => [n.noteId, n]));

const cleanUrl = (id) => `https://www.xiaohongshu.com/explore/${id}`;
const day = (s) => (typeof s === "string" ? s.slice(0, 10) : null);

const notes = incoming.notes.map((n) => {
  const old = manual.get(n.note_id);
  return {
    noteId: n.note_id,
    title: n.title,
    url: cleanUrl(n.note_id),
    publishedAt: day(n.upload_time),
    collectedAt: day(n.collected_at),
    tags: n.tags ?? [],
    summary: old?.summary ?? "",
    ...(old?.unmappedReason ? { unmappedReason: old.unmappedReason } : {}),
  };
});
// 保留已不在最新素材中的旧笔记，避免静默丢失已整理内容。
for (const old of prev.notes) if (!notes.some((n) => n.noteId === old.noteId)) notes.push(old);

const doc = {
  schemaVersion: 1,
  sourceGeneratedAt: incoming.generated_at ?? null,
  collectionNote: "素材仍在持续采集；数量以 notes.length 为准。互动量不作为质量证据，故不收录。",
  notes,
};
writeFileSync(out, JSON.stringify(doc, null, 2) + "\n");
console.log(`synced ${notes.length} notes (${notes.filter((n) => n.summary).length} summarized)`);
