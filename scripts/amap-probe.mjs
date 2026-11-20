// 用真实高德 JS API（PlaceSearch）核对候选店的事实字段（名称/地址/类型/人均 cost），写入 artifacts/report/amap-probe.json。
// 用法：node --env-file=.env.local scripts/amap-probe.mjs [queries.txt]   （凭据只从环境变量读取，不输出）
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const key = process.env.NEXT_PUBLIC_AMAP_JS_KEY, sec = process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE;
if (!key || !sec) throw new Error("缺少高德 JS 凭据环境变量");
const file = process.argv[2] ?? new URL("./amap-probe-queries.txt", import.meta.url).pathname;
const queries = readFileSync(file, "utf8").split("\n").map((s) => s.trim()).filter((s) => s && !s.startsWith("#"));
const origin = process.env.PROBE_ORIGIN ?? "http://127.0.0.1:3417";
const browser = await chromium.launch({ args: ["--no-sandbox"], executablePath: process.env.E2E_CHROMIUM_PATH || undefined });
const page = await browser.newPage();
await page.route(`${origin}/probe`, (r) => r.fulfill({ contentType: "text/html", body: "<!doctype html><html><body>probe</body></html>" }));
await page.goto(`${origin}/probe`);
await page.evaluate(({ key, sec }) => new Promise((res, rej) => {
  window._AMapSecurityConfig = { securityJsCode: sec };
  const s = document.createElement("script");
  s.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&plugin=AMap.PlaceSearch`;
  s.onload = res; s.onerror = () => rej(new Error("amap load failed")); document.head.appendChild(s);
}), { key, sec });
const out = [];
for (const q of queries) {
  const r = await page.evaluate((q) => new Promise((resolve) => {
    const ps = new window.AMap.PlaceSearch({ city: "深圳", citylimit: true, pageSize: 25, extensions: "all" });
    ps.search(q, (status, result) => {
      if (status !== "complete") return resolve({ status, pois: [] });
      resolve({ status, pois: (result.poiList?.pois ?? []).map((p) => ({ id: p.id, name: p.name, type: p.type, address: p.address, adname: p.adname, business_area: p.business_area, cost: p.cost ?? p.biz_ext?.cost ?? null, rating: p.rating ?? p.biz_ext?.rating ?? null, tel: p.tel || null })) });
    });
  }), q);
  out.push({ query: q, status: r.status, count: r.pois.length, pois: r.pois });
  await new Promise((r) => setTimeout(r, 700));
}
await browser.close();
mkdirSync("artifacts/report", { recursive: true });
writeFileSync("artifacts/report/amap-probe.json", JSON.stringify({ checkedAt: new Date().toISOString(), note: "高德 JS API PlaceSearch（city=深圳, extensions=all）原始检索摘录；cost 为高德返回的人均，可能缺失或不准。", queries: out }, null, 1));
console.log(out.map((o) => `${o.query}: ${o.status} ${o.count}`).join("\n"));
