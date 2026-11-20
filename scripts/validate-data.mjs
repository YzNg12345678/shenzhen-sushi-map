// 用法：node scripts/validate-data.mjs [audit|atlas|all]
// 校验 data/audit.json、data/atlas.json 是否符合 lib/schema.ts，并交叉检查来源 id 均可解析。
import { readFileSync, existsSync } from "node:fs";
import { auditFileSchema, atlasFileSchema, sourcesFileSchema, noteSchema } from "../lib/schema.ts";

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), "utf8"));
const which = process.argv[2] ?? "all";
const errors = [];
const ids = new Set();
for (const n of read("data/notes.json").notes) { noteSchema.parse(n); ids.add(`xhs:${n.noteId}`); }
for (const f of ["data/sources.shops.json", "data/sources.atlas.json"]) {
  if (!existsSync(new URL(`../${f}`, import.meta.url))) continue;
  const r = sourcesFileSchema.safeParse(read(f));
  if (!r.success) errors.push(`${f}: ${r.error.issues.slice(0, 8).map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  else for (const s of r.data.sources) { if (ids.has(s.id)) errors.push(`${f}: 重复来源 id ${s.id}`); ids.add(s.id); }
}
const refs = (obj, out = []) => { if (Array.isArray(obj)) obj.forEach((x) => refs(x, out)); else if (obj && typeof obj === "object") { for (const [k, v] of Object.entries(obj)) { if (k === "sources" && Array.isArray(v)) out.push(...v); else refs(v, out); } } return out; };
if (which === "audit" || which === "all") {
  if (existsSync(new URL("../data/audit.json", import.meta.url))) {
    const r = auditFileSchema.safeParse(read("data/audit.json"));
    if (!r.success) errors.push("audit.json: " + r.error.issues.slice(0, 12).map((i) => `${i.path.join(".")} ${i.message}`).join("; "));
    else {
      for (const s of refs(r.data)) if (!ids.has(s)) errors.push(`audit.json: 未知来源 ${s}`);
      for (const c of r.data.candidates) {
        if (c.decision === "include") {
          if (c.identity.result !== "pass" || c.price.result !== "pass" || !(c.price.perPersonMin >= 300) || !c.profile || !c.confidence) errors.push(`include 不合格: ${c.id}`);
        }
        if (c.price.result === "fail" && c.decision !== "exclude") errors.push(`价格不足却未排除: ${c.id}`);
      }
      console.log(`audit ok: ${r.data.candidates.length} 候选, include=${r.data.candidates.filter((c) => c.decision === "include").length}`);
    }
  } else console.log("audit.json 尚不存在");
}
if (which === "atlas" || which === "all") {
  if (existsSync(new URL("../data/atlas.json", import.meta.url))) {
    const r = atlasFileSchema.safeParse(read("data/atlas.json"));
    if (!r.success) errors.push("atlas.json: " + r.error.issues.slice(0, 12).map((i) => `${i.path.join(".")} ${i.message}`).join("; "));
    else {
      for (const s of refs(r.data)) if (!ids.has(s)) errors.push(`atlas.json: 未知来源 ${s}`);
      console.log(`atlas ok: ${r.data.items.length} 条`);
    }
  } else console.log("atlas.json 尚不存在");
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("validate-data 通过");
