import { expect, test, type Locator, type Page } from "@playwright/test";
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
const cardByName = (page: Page, name: string | RegExp) => cards(page).filter({ has: page.locator("h3", { hasText: name }) }).first();
const sheet = (page: Page) => page.getByTestId("shop-sheet");
const settings = (page: Page) => page.getByRole("dialog", { name: "设置与数据说明" });
const stored = (page: Page) => page.evaluate(() => window.localStorage.getItem("shenzhen-omakase-map:v2"));

// 每张卡片必须有店名、三轴徽章（高/中/低/待核实）、人均行、来源数与日期，绝不为空。
async function assertCards(page: Page, max = 12) {
  const all = cards(page);
  const n = Math.min(await all.count(), max);
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const c = all.nth(i);
    expect(((await c.locator("h3").textContent()) ?? "").trim().length).toBeGreaterThan(1);
    for (const axis of ["stability", "parents", "crossing"]) await expect(c.getByTestId(`axis-${axis}`)).toHaveText(/(高|中|低|待核实)$/);
    await expect(c.getByTestId("card-price")).toContainText("人均：");
    await expect(c).toContainText(/\d+ 篇来源 · 资料 /);
  }
}

test("桌面：首页理解度 + 真实高德地图 + 搜索/筛选 + 空状态", async ({ page }) => {
  watch(page, "desktop-main");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("深圳 Omakase 跨境家庭选店地图");
  await expect(page.getByText("常住香港、熟悉 Omakase、会带伴侣或父母来深圳的你")).toBeVisible();
  for (const t of ["① 稳不稳", "② 带父母合不合适", "③ 值不值得专程过关"]) await expect(page.getByText(t)).toBeVisible();
  const total = await ready(page);
  console.log(`[evidence] 高德实时检索 + 已整理门店共 ${total} 家，地图标记 ${await page.getByTestId("pin").count()} 个`);
  expect(total).toBeGreaterThan(20);
  // 一级板块只有：地图、搜索/筛选、列表、详情抽屉、设置；不应再有旧导航。
  await expect(page.getByRole("navigation")).toHaveCount(0);
  for (const old of ["寿司护照", "鱼种季节", "比较"]) await expect(page.getByRole("link", { name: old })).toHaveCount(0);
  await assertCards(page);
  await page.waitForTimeout(3000);
  await shot(page, "desktop-01-home");

  // 搜索
  await page.getByLabel("搜索店名、商圈、口岸").fill("植庭");
  await expect(cards(page).first()).toContainText("植庭");
  const zhiting = await cards(page).count();
  for (let i = 0; i < zhiting; i++) await expect(cards(page).nth(i)).toContainText("植庭");
  await page.getByLabel("搜索店名、商圈、口岸").fill("");

  // 筛选：近期稳定=高
  await page.getByRole("button", { name: "近期稳定 高" }).click();
  await expect(page.getByRole("button", { name: "近期稳定 高" })).toHaveAttribute("aria-pressed", "true");
  await expect(cards(page).first()).toBeVisible();
  const n = await cards(page).count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) await expect(cards(page).nth(i).getByTestId("axis-stability")).toContainText("高");
  expect(n).toBeLessThan(total);
  console.log(`[evidence] 近期稳定=高：${n} 家（筛选前 ${total}）`);
  await shot(page, "desktop-02-filter");
  // 带父母=高：植庭有两篇详细正面记述
  await page.getByRole("button", { name: "近期稳定 高" }).click();
  await page.getByRole("button", { name: "带父母 高" }).click();
  await expect(cardByName(page, "植庭")).toBeVisible();
  await expect(cardByName(page, "植庭").getByTestId("axis-parents")).toContainText("高");
  await expect(cardByName(page, "植庭")).toContainText("带父母优先");
  // 过关价值=高：素材没有任何店有足够证据 → 诚实的空状态
  await page.getByRole("button", { name: "带父母 高" }).click();
  await page.getByRole("button", { name: "值得过关 高" }).click();
  await expect(page.getByTestId("empty")).toContainText("没有符合条件的店");
  await expect(cards(page)).toHaveCount(0);
  await shot(page, "desktop-03-empty");
  await page.getByRole("button", { name: "清除全部筛选" }).click();
  await expect(page.getByRole("button", { name: "值得过关 高" })).toHaveAttribute("aria-pressed", "false");
  await expect(cards(page).first()).toBeVisible();
  // 人均 / 口岸
  await page.getByLabel("人均", { exact: true }).selectOption("gt600");
  await expect(cardByName(page, "齐武")).toBeVisible();
  await page.getByLabel("人均", { exact: true }).selectOption("any");
  await page.getByLabel("口岸", { exact: true }).selectOption("szbay");
  await expect(cards(page).first()).toContainText("近深圳湾口岸");
  await page.getByLabel("口岸", { exact: true }).selectOption("any");
  // 无结果搜索
  await page.getByLabel("搜索店名、商圈、口岸").fill("不存在的店名zzz");
  await expect(page.getByTestId("empty")).toBeVisible();
  await expect(page.getByTestId("count")).toContainText("共 0 家");
  expect(productErrors("desktop-main")).toEqual([]);
});

test("桌面：详情抽屉 + 来源 + 收藏/去过/备注跨刷新 + 导出/清空/导入", async ({ page }) => {
  watch(page, "desktop-detail");
  await page.goto("/");
  await ready(page);
  await page.evaluate(() => window.localStorage.clear());
  const card = cardByName(page, "植庭");
  await expect(card).toBeVisible();
  await card.locator("h3 button").click();
  const s = sheet(page);
  await expect(s).toBeVisible();
  await expect(s.getByRole("heading", { level: 2 })).toContainText("植庭");
  // 三轴逐项可解释：等级 + 来源数 + 最近日期 + 理由
  for (const axis of ["stability", "parents", "crossing"]) {
    const row = page.getByTestId(`detail-axis-${axis}`);
    await expect(row).toContainText(/(高|中|低|待核实)/);
    await expect(row).toContainText(/\d+ 篇来源 · 最近 /);
  }
  await expect(page.getByTestId("detail-axis-parents")).toContainText("高");
  await expect(page.getByTestId("detail-axis-crossing")).toContainText("待核实");
  await expect(page.getByTestId("detail-price")).toContainText("最终人均");
  await expect(s).toContainText("信息可能变化，请预约时复核");
  await expect(s.getByText("待核实").first()).toBeVisible();
  // 来源链接：仅摘要+链接，指向小红书笔记，新窗口、无令牌
  const links = page.getByTestId("detail-sources").getByRole("link");
  expect(await links.count()).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < (await links.count()); i++) {
    const l = links.nth(i);
    await expect(l).toHaveAttribute("href", /^https:\/\/www\.xiaohongshu\.com\/explore\/[0-9a-f]+$/);
    await expect(l).toHaveAttribute("target", "_blank");
    await expect(l).toHaveAttribute("rel", /noopener/);
  }
  // 高德命中该店时：有口岸直线距离，且明确是估算
  if (await page.getByTestId("detail-ports").count()) await expect(s).toContainText("仅按坐标直线距离估算");
  await shot(page, "desktop-04-detail");

  // 收藏 / 去过 / 备注，跨刷新保留
  await s.getByRole("button", { name: "☆ 收藏" }).click();
  await s.getByRole("button", { name: "标记去过" }).click();
  await s.getByLabel("备注").fill("E2E：和父母去过，座位舒服");
  expect(await stored(page)).toContain("E2E：和父母去过");
  await page.reload();
  await ready(page);
  const again = cardByName(page, "植庭");
  await expect(again.locator("h3")).toContainText("★");
  await expect(again.locator("h3")).toContainText("✓");
  await again.locator("h3 button").click();
  await expect(sheet(page).getByLabel("备注")).toHaveValue("E2E：和父母去过，座位舒服");
  await expect(sheet(page).getByRole("button", { name: "★ 已收藏" })).toHaveAttribute("aria-pressed", "true");
  // “我的收藏/去过”筛选只剩这一家
  await sheet(page).getByRole("button", { name: "关闭详情" }).click();
  await page.getByRole("button", { name: "我的收藏/去过" }).click();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("植庭");
  await page.getByRole("button", { name: "我的收藏/去过" }).click();

  // 设置：数据说明 + 导出
  await page.getByRole("button", { name: "设置与数据说明" }).click();
  await expect(settings(page)).toBeVisible();
  await expect(settings(page)).toContainText("小红书 30 篇笔记");
  await expect(page.getByTestId("unmapped").getByRole("link")).toHaveCount(5);
  await shot(page, "desktop-05-settings");
  const [dl] = await Promise.all([page.waitForEvent("download"), settings(page).getByRole("button", { name: "导出 JSON" }).click()]);
  const exportPath = path.join(REPORT_DIR, "export-sample.json");
  await dl.saveAs(exportPath);
  const exported = JSON.parse(fs.readFileSync(exportPath, "utf8"));
  expect(exported.schemaVersion).toBe(2);
  expect(JSON.stringify(exported)).toContain("E2E：和父母去过");
  // 非法导入：被拒绝，数据不变
  const bad = path.join(REPORT_DIR, "bad-import.tmp.json");
  fs.writeFileSync(bad, JSON.stringify({ schemaVersion: 2, shops: { x: { favorite: "yes" } } }));
  await settings(page).locator("#import-file").setInputFiles(bad);
  await expect(settings(page).getByRole("alert")).toContainText("未做任何修改");
  expect(await stored(page)).toContain("E2E：和父母去过");
  fs.rmSync(bad);
  // 清空（二次确认）
  await settings(page).getByRole("button", { name: "清空…" }).click();
  await settings(page).getByRole("button", { name: "确认清空" }).click();
  await expect(settings(page)).toContainText("已清空");
  expect(JSON.parse((await stored(page)) ?? "{}").shops).toEqual({});
  await settings(page).getByRole("button", { name: "关闭" }).click();
  await expect(cardByName(page, "植庭").locator("h3")).not.toContainText("★");
  // 导入刚才导出的文件：恢复，且刷新后仍在
  await page.getByRole("button", { name: "设置与数据说明" }).click();
  await settings(page).locator("#import-file").setInputFiles(exportPath);
  await expect(settings(page)).toContainText("已导入");
  await settings(page).getByRole("button", { name: "关闭" }).click();
  await expect(cardByName(page, "植庭").locator("h3")).toContainText("★");
  await page.reload();
  await ready(page);
  await expect(cardByName(page, "植庭").locator("h3")).toContainText("★");
  await page.evaluate(() => window.localStorage.clear());
  expect(productErrors("desktop-detail")).toEqual([]);
});

test("错误与空状态：高德脚本不可用时列表仍可用、可重试恢复", async ({ page }) => {
  watch(page, "error-state", true);
  await page.route("https://webapi.amap.com/**", (r) => r.abort());
  await page.goto("/");
  await expect(page.getByRole("alert").filter({ hasText: "地图暂时无法显示" })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole("alert").filter({ hasText: "高德检索失败" })).toBeVisible({ timeout: 40_000 });
  // 已整理的门店仍可浏览，只是没有位置
  await expect(cards(page).first()).toBeVisible();
  await expect(cardByName(page, "植庭")).toContainText("位置待核实");
  await cardByName(page, "植庭").locator("h3 button").click();
  await expect(page.getByTestId("detail-axis-parents")).toContainText("高");
  await expect(sheet(page)).toContainText("暂未取得位置");
  await shot(page, "desktop-06-amap-error");
  await sheet(page).getByRole("button", { name: "关闭详情" }).click();
  await page.unroute("https://webapi.amap.com/**");
  await page.getByRole("button", { name: "重试加载地图" }).click();
  await page.getByRole("button", { name: "重新检索" }).click();
  await expect(page.getByTestId("count")).toContainText(/共 \d+ 家/, { timeout: MAP_TIMEOUT });
  await expect(page.getByTestId("pin").first()).toBeAttached({ timeout: 30_000 });
  expect(productErrors("error-state")).toEqual([]);
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
  expect(await page.evaluate(() => Object.keys(window.localStorage).filter((k) => k.includes(":corrupt-")).length)).toBe(1);
  await page.evaluate(() => window.localStorage.clear());
  expect(productErrors("corrupt-storage")).toEqual([]);
});

// 移动端 390x844：主路径 首页 → 筛选 → 卡片 → 详情抽屉 → 收藏 → 设置。
test.describe("移动端 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("主路径", async ({ page }) => {
    watch(page, "mobile-flow");
    await page.goto("/");
    // 首屏无需滚动即可看到：标题、目标人群、三判断、搜索、一排筛选、地图
    const inFirstScreen = async (loc: Locator) => {
      const b = await loc.boundingBox();
      expect(b).not.toBeNull();
      expect(b!.y + b!.height).toBeLessThanOrEqual(844);
    };
    await inFirstScreen(page.getByRole("heading", { level: 1 }));
    await inFirstScreen(page.getByText("常住香港、熟悉 Omakase、会带伴侣或父母来深圳的你"));
    for (const t of ["① 稳不稳", "② 带父母合不合适", "③ 值不值得专程过关"]) await inFirstScreen(page.getByText(t));
    await inFirstScreen(page.getByLabel("搜索店名、商圈、口岸"));
    await inFirstScreen(page.getByRole("button", { name: "近期稳定 高" }));
    await ready(page);
    const map = await page.locator(".map-pane").boundingBox();
    expect(map!.y).toBeLessThan(500);
    expect(map!.height).toBeGreaterThan(200);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.waitForTimeout(3000);
    await shot(page, "mobile-01-home");

    // 触控目标 ≥ 44px
    for (const loc of [page.getByRole("button", { name: "带父母 高" }), page.getByRole("button", { name: /设置/ }), cards(page).first().getByRole("button", { name: "详情", exact: true })]) {
      const b = await loc.boundingBox();
      expect(b!.height).toBeGreaterThanOrEqual(43.5);
    }
    // 筛选
    await page.getByRole("button", { name: "近期稳定 高" }).click();
    await expect(cards(page).first().getByTestId("axis-stability")).toContainText("高");
    await shot(page, "mobile-02-filter");
    await page.getByRole("button", { name: "近期稳定 高" }).click();

    // 点卡片 → 详情抽屉（在视口内，可滚动，可关闭）
    const card = cardByName(page, "植庭");
    await card.scrollIntoViewIfNeeded();
    await card.locator("h3 button").click();
    const s = sheet(page);
    await expect(s).toBeVisible();
    const sb = await s.boundingBox();
    expect(sb!.y).toBeGreaterThanOrEqual(0);
    expect(sb!.y + sb!.height).toBeLessThanOrEqual(845);
    await expect(s.getByRole("button", { name: "关闭详情" })).toBeFocused();
    await page.waitForTimeout(1500);
    await shot(page, "mobile-03-detail");
    await s.getByText("来源（小红书，仅摘要与链接）").scrollIntoViewIfNeeded();
    await expect(s.getByTestId("detail-sources").getByRole("link").first()).toBeVisible();
    await shot(page, "mobile-04-detail-sources");
    await s.getByRole("button", { name: "☆ 收藏" }).scrollIntoViewIfNeeded();
    await s.getByRole("button", { name: "☆ 收藏" }).click();
    await s.getByLabel("备注").fill("手机端备注");
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toHaveCount(0);
    await page.reload();
    await ready(page);
    await expect(cardByName(page, "植庭").locator("h3")).toContainText("★");

    // 设置
    await page.getByRole("button", { name: /设置/ }).click();
    await expect(settings(page)).toBeVisible();
    const sbox = await settings(page).boundingBox();
    expect(sbox!.x).toBeGreaterThanOrEqual(0);
    expect(sbox!.x + sbox!.width).toBeLessThanOrEqual(391);
    await shot(page, "mobile-05-settings");
    await settings(page).getByRole("button", { name: "关闭" }).click();
    await expect(settings(page)).toBeHidden();
    await page.evaluate(() => window.localStorage.clear());
    expect(productErrors("mobile-flow")).toEqual([]);
  });
});
