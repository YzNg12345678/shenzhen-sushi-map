import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SHOTS = process.env.SHOT_DIR ?? "artifacts/screenshots";
const REPORT_DIR = process.env.REPORT_DIR ?? "artifacts/report";
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(REPORT_DIR, { recursive: true });

// 控制台/页面错误采集：产品错误必须为 0；第三方（高德等）可预期噪音单独归类并写入报告，不隐藏。
type Diag = { test: string; kind: string; text: string; url: string; class: "product" | "third-party" | "navigation-abort" | "third-party-unexpected" };
const diags: Diag[] = [];
const THIRD_PARTY = /(amap\.com|autonavi\.com|alicdn\.com|alipay)/i;
// 第三方 URL 的查询串（含 auth_key 等）一律脱敏后再入报告。
const redact = (t: string) => t.replace(/\?[^\s"']*/g, "?[REDACTED]");
function watch(page: Page, testName: string, expectedAbort = false) {
  const push = (kind: string, text: string, url: string) => {
    const third = THIRD_PARTY.test(url) || THIRD_PARTY.test(text);
    // 仅“高德瓦片请求被浏览器取消（ERR_ABORTED，地图平移/缩放时的正常现象）”算可预期噪音；其余第三方错误按未预期处理并使测试失败。
    // ERR_ABORTED 是浏览器主动取消（页面跳转/地图平移时的在途请求、预取），不是服务端或代码错误；单独归类 navigation-abort，不计入产品错误。
    const aborted = kind === "requestfailed" && /ERR_ABORTED/.test(text);
    const cls = aborted ? "navigation-abort" : !third ? "product" : "third-party-unexpected";
    diags.push({ test: testName, kind, text: redact(text).slice(0, 300), url: redact(url), class: cls });
  };
  page.on("pageerror", (e) => push("pageerror", e.message, page.url()));
  page.on("console", (m) => {
    if (m.type() === "error" && !(expectedAbort && /ERR_FAILED/.test(m.text()))) push("console.error", m.text(), m.location().url || page.url());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) push("http-" + r.status(), `${r.request().method()} ${r.url()}`, r.url());
  });
  page.on("requestfailed", (r) => {
    if (expectedAbort && /webapi\.amap\.com\/maps/.test(r.url())) return; // 本测试故意拦截的高德脚本请求
    push("requestfailed", `${r.failure()?.errorText ?? ""} ${r.url()}`, r.url());
  });
}
const productErrors = (testName: string) => diags.filter((d) => d.test === testName && d.class !== "navigation-abort");
test.afterAll(() => {
  const summary = {
    generatedAt: new Date().toISOString(),
    total: diags.length,
    product: diags.filter((d) => d.class === "product").length,
    thirdPartyUnexpected: diags.filter((d) => d.class === "third-party-unexpected").length,
    navigationAbort: diags.filter((d) => d.class === "navigation-abort").length,
    entries: diags,
  };
  fs.writeFileSync(path.join(REPORT_DIR, "console-errors.json"), JSON.stringify(summary, null, 2));
});
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });

const MAP_TIMEOUT = 90_000;

/** 等待高德地图出图、检索结束并出现卡片；返回店铺数。 */
async function ready(page: Page): Promise<number> {
  const count = page.getByTestId("count");
  await expect(count).toContainText(/共 \d+ 家/, { timeout: MAP_TIMEOUT });
  await expect(page.locator(".amap-layer, .amap-maps").first()).toBeAttached({ timeout: 30_000 });
  await expect(page.getByTestId("pin").first()).toBeAttached({ timeout: 30_000 });
  return Number(/共 (\d+) 家/.exec((await count.textContent()) ?? "")?.[1] ?? 0);
}
const cards = (page: Page) => page.getByTestId("shop-card");
const sheet = (page: Page) => page.getByTestId("shop-sheet");
const settings = (page: Page) => page.getByRole("dialog", { name: "设置与数据说明" });
const stored = (page: Page) => page.evaluate(() => window.localStorage.getItem("shenzhen-omakase-map:v2"));
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

const audit = JSON.parse(fs.readFileSync("data/audit.json", "utf8")) as { candidates: { id: string; name: string; decision: string; keywords: string[]; price: { perPersonMin?: number } }[] };
const included = audit.candidates.filter((c) => c.decision === "include");
const notIncluded = audit.candidates.filter((c) => c.decision !== "include");
const BANNED = ["每家店只回答三件事", "稳不稳", "带父母合不合适", "值不值得专程过关", "三轴"];

/** 每张卡片：店名、≥300 的价位、headline；不同店内容不同。 */
async function assertCards(page: Page) {
  const n = await cards(page).count();
  expect(n).toBeGreaterThan(0);
  const heads = new Set<string>();
  for (let i = 0; i < n; i++) {
    const c = cards(page).nth(i);
    expect(((await c.locator("h3").textContent()) ?? "").trim().length).toBeGreaterThan(1);
    const price = Number(/¥(\d+)/.exec((await c.getByTestId("card-price").textContent()) ?? "")?.[1]);
    expect(price).toBeGreaterThanOrEqual(300);
    heads.add((await c.locator(".shop-headline").textContent()) ?? "");
  }
  expect(heads.size).toBe(n);
  return n;
}
const noteBanned = async (page: Page) => { const t = await page.locator("body").innerText(); for (const b of BANNED) expect(t).not.toContain(b); };

test("桌面：首页只含合格 Omakase + 真实高德 + 搜索/筛选/空状态", async ({ page }) => {
  watch(page, "desktop-main");
  await page.goto("/");
  await expect(page).toHaveTitle("深圳 Omakase · 精选板前清单");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("精选板前清单");
  const total = await ready(page);
  expect(total).toBe(included.length);
  await assertCards(page);
  await noteBanned(page);
  // 卡片店名只能来自主清单；任何待核实/排除店都不得出现
  const body = await page.getByRole("region", { name: "店铺列表", exact: true }).innerText();
  for (const c of notIncluded) for (const k of c.keywords.filter((k) => k.length >= 3 && !included.some((i) => i.name.includes(k)))) expect(body).not.toContain(k);
  console.log(`[evidence] 主清单 ${total} 家，地图标记 ${await page.getByTestId("pin").count()} 个`);
  await page.waitForTimeout(3000);
  await shot(page, "desktop-01-home");

  // 搜索
  await page.locator("#q").fill(included[0].keywords[0]);
  await expect(cards(page)).toHaveCount(1);
  await page.locator("#q").fill("");
  // 筛选抽屉：价位
  await page.getByRole("button", { name: /^筛选/ }).click();
  const drawer = page.getByRole("dialog", { name: "筛选与排序" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: "¥300–499" }).click();
  await drawer.getByRole("button", { name: /^查看/ }).click();
  const mid = included.filter((c) => (c.price.perPersonMin ?? 0) >= 300 && (c.price.perPersonMin ?? 0) < 500).length;
  await expect(cards(page)).toHaveCount(mid);
  await expect(page.getByLabel("当前筛选条件")).toContainText("300");
  await shot(page, "desktop-02-filter");
  // 价位 ¥800 以上：与审计数据一致（没有则为诚实的空状态）
  await page.getByRole("button", { name: /^筛选/ }).click();
  await drawer.getByRole("button", { name: "¥800 以上" }).click();
  await drawer.getByRole("button", { name: /^查看/ }).click();
  await expect(cards(page)).toHaveCount(included.filter((c) => (c.price.perPersonMin ?? 0) >= 800).length);
  await page.getByLabel("当前筛选条件").getByRole("button", { name: "清除全部" }).click();
  await expect(cards(page)).toHaveCount(total);
  // 无结果
  await page.locator("#q").fill("不存在的店名zzz");
  await expect(page.getByTestId("empty")).toBeVisible();
  await expect(page.getByTestId("count")).toContainText("共 0 家");
  await shot(page, "desktop-03-empty");
  expect(productErrors("desktop-main")).toEqual([]);
});

test("桌面：详情逐店评价 + 来源 + 收藏/备注 + 导出/非法导入/清空/导入", async ({ page }) => {
  watch(page, "desktop-detail");
  await page.goto("/");
  await ready(page);
  await page.evaluate(() => window.localStorage.clear());
  // 每家店详情：字段齐全（有值或“待核实”）、来源链接、置信度、更新时间；店与店之间摘要不同
  const heads = new Set<string>();
  for (let i = 0; i < included.length; i++) {
    await cards(page).nth(i).locator("h3 button").click();
    const s = sheet(page);
    await expect(s).toBeVisible();
    for (const k of ["cuisine", "ingredients", "chef", "menu", "value", "space", "booking", "scenes"]) {
      const f = s.getByTestId(`field-${k}`);
      await expect(f).toBeVisible();
      expect(((await f.innerText()) ?? "").trim().length).toBeGreaterThan(4);
    }
    await expect(s.getByTestId("price-freshness")).toBeVisible();
    await expect(s.getByTestId("strengths")).toBeVisible();
    await expect(s.getByTestId("risks")).toBeVisible();
    await expect(s.getByTestId("confidence")).toContainText(/高|中|低/);
    await expect(s.getByTestId("updated-at")).toContainText(/\d{4}-\d{2}-\d{2}/);
    heads.add((await s.getByRole("heading", { level: 2 }).first().innerText()) + (await s.getByTestId("risks").innerText()));
    const links = s.getByRole("link", { name: /^(?!.*(高德地图|导航))/ });
    expect(await links.count()).toBeGreaterThan(0);
    await noteBanned(page);
    if (i === 0) await shot(page, "desktop-04-detail");
    await s.getByRole("button", { name: "关闭详情" }).click();
    await expect(sheet(page)).toHaveCount(0);
  }
  expect(heads.size).toBe(included.length);
  // 有未知字段时必须诚实标注
  await cards(page).nth(0).locator("h3 button").click();
  const unknowns = await sheet(page).locator(".tbd").count();
  console.log(`[evidence] 首店详情“待核实”标记 ${unknowns} 个`);
  const s = sheet(page);
  await s.getByRole("button", { name: "☆ 收藏" }).click();
  await s.getByRole("button", { name: "标记去过" }).click();
  await s.getByLabel("备注").fill("E2E：个人备注");
  expect(await stored(page)).toContain("E2E：个人备注");
  await page.reload();
  await ready(page);
  await expect(cards(page).first().locator("h3")).toContainText("★");
  await cards(page).first().locator("h3 button").click();
  await expect(sheet(page).getByLabel("备注")).toHaveValue("E2E：个人备注");
  await sheet(page).getByRole("button", { name: "关闭详情" }).click();
  await page.getByRole("button", { name: /^筛选/ }).click();
  await page.getByRole("dialog", { name: "筛选与排序" }).getByRole("button", { name: "仅看我的收藏与去过" }).click();
  await page.getByRole("dialog", { name: "筛选与排序" }).getByRole("button", { name: /^查看/ }).click();
  await expect(cards(page)).toHaveCount(1);
  await page.getByLabel("当前筛选条件").getByRole("button", { name: "清除全部" }).click();

  await page.getByRole("button", { name: "设置与数据说明" }).click();
  await expect(settings(page)).toBeVisible();
  const [dl] = await Promise.all([page.waitForEvent("download"), settings(page).getByRole("button", { name: "导出 JSON" }).click()]);
  const exportPath = path.join(REPORT_DIR, "export-sample.json");
  await dl.saveAs(exportPath);
  const exported = JSON.parse(fs.readFileSync(exportPath, "utf8"));
  expect(exported.schemaVersion).toBe(2);
  expect(JSON.stringify(exported)).toContain("E2E：个人备注");
  const bad = path.join(REPORT_DIR, "bad-import.tmp.json");
  fs.writeFileSync(bad, JSON.stringify({ schemaVersion: 2, shops: { x: { favorite: "yes" } } }));
  await settings(page).locator("#import-file").setInputFiles(bad);
  await expect(settings(page).getByRole("alert")).toContainText("未做任何修改");
  expect(await stored(page)).toContain("E2E：个人备注");
  fs.rmSync(bad);
  await settings(page).getByRole("button", { name: "清空…" }).click();
  await settings(page).getByRole("button", { name: "确认清空" }).click();
  await expect(settings(page)).toContainText("已清空");
  expect(JSON.parse((await stored(page)) ?? "{}").shops).toEqual({});
  await settings(page).locator("#import-file").setInputFiles(exportPath);
  await expect(settings(page)).toContainText("已导入");
  await settings(page).getByRole("button", { name: "关闭" }).click();
  await expect(cards(page).first().locator("h3")).toContainText("★");
  await page.evaluate(() => window.localStorage.clear());
  expect(productErrors("desktop-detail")).toEqual([]);
});

test("桌面：图鉴列表/筛选/详情 + 筛选依据页 + 动态高德拒绝计数", async ({ page }) => {
  watch(page, "desktop-atlas");
  const atlas = JSON.parse(fs.readFileSync("data/atlas.json", "utf8")) as { items: { id: string; zh: string; ja: string; category: string; season: { months: number[] } }[] };
  await page.goto("/atlas/");
  await expect(page).toHaveTitle("深圳 Omakase · 鱼种食材季节图鉴");
  await expect(page.getByTestId("season-disclaimer")).toContainText("而非保证");
  await expect(page.getByTestId("atlas-count")).toContainText(`共 ${atlas.items.length} 种`);
  await expect(page.getByTestId("atlas-card")).toHaveCount(atlas.items.length);
  await shot(page, "desktop-05-atlas-list");
  await page.locator("#aq").fill(atlas.items[0].ja);
  await expect(page.getByTestId("atlas-card").first()).toContainText(atlas.items[0].zh);
  await page.locator("#aq").fill("");
  const cat = atlas.items[0].category;
  await page.getByRole("button", { name: cat, exact: true }).click();
  await expect(page.getByTestId("atlas-card")).toHaveCount(atlas.items.filter((i) => i.category === cat).length);
  await page.getByRole("button", { name: "全部", exact: true }).click();
  await page.locator("#am").selectOption("7");
  const n7 = atlas.items.filter((i) => i.season.months.length === 0 || i.season.months.includes(7)).length;
  await expect(page.getByTestId("atlas-card")).toHaveCount(n7);
  await page.locator("#aq").fill("不存在的鱼zzz");
  await expect(page.getByTestId("atlas-empty")).toBeVisible();
  await page.locator("#aq").fill("");
  await page.locator("#am").selectOption("0");
  await page.getByTestId("atlas-card").first().getByRole("link").click();
  const d = page.getByTestId("atlas-detail");
  await expect(d).toBeVisible();
  await expect(page.getByTestId("season-note")).toBeVisible();
  await expect(d.getByRole("link").filter({ hasNot: page.locator("nav") }).first()).toBeVisible();
  await shot(page, "desktop-06-atlas-detail");
  await page.goto("/audit/");
  await expect(page).toHaveTitle("深圳 Omakase · 筛选依据");
  await expect(page.getByTestId("audit-rules")).toBeVisible();
  await expect(page.getByTestId("audit-candidate")).toHaveCount(audit.candidates.length);
  await expect(page.getByTestId("rejected-count")).toBeVisible({ timeout: 90_000 });
  const rej = await page.getByTestId("rejected-count").innerText();
  console.log(`[evidence] 高德动态检索被规则拒绝：${rej}`);
  await shot(page, "desktop-07-audit");
  await noOverflow(page);
  expect(productErrors("desktop-atlas")).toEqual([]);
});

test("错误与空状态：高德脚本不可用时已审计店铺仍可用、可重试恢复", async ({ page }) => {
  watch(page, "error-state", true);
  await page.route("https://webapi.amap.com/**", (r) => r.abort());
  await page.goto("/");
  await expect(page.getByRole("alert").filter({ hasText: "高德检索失败" })).toBeVisible({ timeout: 40_000 });
  await expect(cards(page).first()).toBeVisible();
  await expect(cards(page)).toHaveCount(included.length);
  await shot(page, "desktop-08-amap-error");
  await page.unroute("https://webapi.amap.com/**");
  await page.getByRole("button", { name: "重试加载地图" }).click();
  await page.getByRole("button", { name: "重新检索" }).click();
  await expect(page.getByTestId("count")).toContainText(/共 \d+ 家/, { timeout: MAP_TIMEOUT });
  await expect(page.getByTestId("pin").first()).toBeAttached({ timeout: 30_000 });
  await page.goto("/atlas/不存在-xyz/");
  expect(productErrors("error-state").filter((d) => !/404/.test(d.kind + d.text))).toEqual([]);
});

test("损坏的本地数据：另存副本并提示，不覆盖原数据", async ({ page }) => {
  watch(page, "corrupt-storage");
  await page.addInitScript(() => {
    if (!window.localStorage.getItem("shenzhen-omakase-map:v2")) window.localStorage.setItem("shenzhen-omakase-map:v2", "{broken");
  });
  await page.goto("/");
  await ready(page);
  await page.getByRole("button", { name: "设置与数据说明" }).click();
  await expect(settings(page).getByRole("alert")).toContainText("损坏副本");
  expect(await stored(page)).toBe("{broken");
  await page.evaluate(() => window.localStorage.clear());
  expect(productErrors("corrupt-storage")).toEqual([]);
});

test.describe("移动端 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("店铺主路径 + 触控目标 + 无横向溢出", async ({ page }) => {
    watch(page, "mobile-flow");
    await page.goto("/");
    await ready(page);
    await noOverflow(page);
    await page.waitForTimeout(3000);
    await shot(page, "mobile-01-home");
    for (const loc of [page.getByRole("button", { name: /^筛选/ }), page.getByRole("button", { name: "设置与数据说明" }), page.getByRole("link", { name: "图鉴", exact: true }), cards(page).first().locator("h3 button")]) {
      const b = await loc.boundingBox();
      expect(b!.height).toBeGreaterThanOrEqual(43.5);
    }
    await page.getByRole("button", { name: /^筛选/ }).click();
    const drawer = page.getByRole("dialog", { name: "筛选与排序" });
    await expect(drawer).toBeVisible();
    const db = await drawer.boundingBox();
    expect(db!.x + db!.width).toBeLessThanOrEqual(391);
    await drawer.getByRole("button", { name: "¥300–499" }).click();
    await shot(page, "mobile-02-filter");
    await drawer.getByRole("button", { name: /^查看/ }).click();
    await page.getByLabel("当前筛选条件").getByRole("button", { name: "清除全部" }).click();
    await cards(page).first().scrollIntoViewIfNeeded();
    await cards(page).first().locator("h3 button").click();
    const s = sheet(page);
    await expect(s).toBeVisible();
    const sb = await s.boundingBox();
    expect(sb!.y).toBeGreaterThanOrEqual(0);
    expect(sb!.x + sb!.width).toBeLessThanOrEqual(391);
    await expect(s.getByRole("button", { name: "关闭详情" })).toBeFocused();
    await shot(page, "mobile-03-detail");
    await s.getByTestId("detail-sources").scrollIntoViewIfNeeded();
    expect((await s.getByTestId("detail-sources").getByRole("link").first().boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
    await shot(page, "mobile-04-detail-sources");
    await s.getByRole("button", { name: "☆ 收藏" }).scrollIntoViewIfNeeded();
    await s.getByRole("button", { name: "☆ 收藏" }).click();
    await s.getByLabel("备注").fill("手机端备注");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toHaveCount(0);
    await page.reload();
    await ready(page);
    await expect(cards(page).first().locator("h3")).toContainText("★");
    await page.getByRole("button", { name: "设置与数据说明" }).click();
    const sbox = await settings(page).boundingBox();
    expect(sbox!.x).toBeGreaterThanOrEqual(0);
    expect(sbox!.x + sbox!.width).toBeLessThanOrEqual(391);
    await shot(page, "mobile-05-settings");
    await settings(page).getByRole("button", { name: "关闭" }).click();
    await page.evaluate(() => window.localStorage.clear());
    expect(productErrors("mobile-flow")).toEqual([]);
  });

  test("图鉴与筛选依据页：无溢出、可操作", async ({ page }) => {
    watch(page, "mobile-atlas");
    await page.goto("/atlas/");
    await noOverflow(page);
    await shot(page, "mobile-06-atlas-list");
    await page.locator("#aq").fill("鲷");
    await expect(page.getByTestId("atlas-count")).toContainText("共");
    for (const loc of [page.locator("#aq"), page.getByRole("button", { name: "全部", exact: true })]) expect((await loc.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
    await page.locator("#aq").fill("");
    await page.getByTestId("atlas-card").first().getByRole("link").click();
    await expect(page.getByTestId("atlas-detail")).toBeVisible();
    await noOverflow(page);
    await shot(page, "mobile-07-atlas-detail");
    await page.goto("/audit/");
    await expect(page.getByTestId("audit-rules")).toBeVisible();
    await noOverflow(page);
    await shot(page, "mobile-08-audit");
    await page.route("https://webapi.amap.com/**", (r) => r.abort());
    await page.goto("/");
    await expect(page.getByRole("alert").filter({ hasText: "高德检索失败" })).toBeVisible({ timeout: 40_000 });
    await noOverflow(page);
    await shot(page, "mobile-09-amap-error");
    expect(productErrors("mobile-atlas").filter((d) => !/amap|ERR_FAILED|aborted/i.test(d.text + d.url))).toEqual([]);
  });
});
