import { expect, test, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SHOTS = process.env.SHOT_DIR ?? "docs/screenshots";
fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });
// 顶部导航链接：品牌链接“深圳寿司地图”也含“寿司地图”，必须限定在主导航内并精确匹配。
const nav = (page: Page, name: string) => page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name, exact: true });
const firstCard = (page: Page) => page.locator("article.card").first();

async function waitPois(page: Page): Promise<number> {
  const status = page.getByTestId("poi-status");
  await expect(status).toBeVisible({ timeout: 60_000 });
  const t = (await status.textContent()) ?? "";
  const n = Number(/检索到 (\d+) 家/.exec(t)?.[1] ?? 0);
  expect(n).toBeGreaterThan(0);
  return n;
}

// 每张卡片：店名非空；评分/人均为数字或“未知”，绝不为空。
async function assertCardFacts(cards: Locator): Promise<number> {
  const n = await cards.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const c = cards.nth(i);
    const name = ((await c.locator("h3 button").textContent()) ?? "").trim();
    expect(name.length, `第 ${i + 1} 张卡片店名为空`).toBeGreaterThan(0);
    const rating = ((await c.locator("dl.facts div").filter({ has: c.page().locator("dt", { hasText: /^评分$/ }) }).locator("dd").textContent()) ?? "").trim();
    const cost = ((await c.locator("dl.facts div").filter({ has: c.page().locator("dt", { hasText: /^人均$/ }) }).locator("dd").textContent()) ?? "").trim();
    expect(rating, `${name} 评分`).toMatch(/^(\d+(\.\d+)?|未知)$/);
    expect(cost, `${name} 人均`).toMatch(/^(¥\d+(\.\d+)?|\d+(\.\d+)?|未知)$/);
  }
  return n;
}

test("真实高德：选店→详情→护照→刷新→导出→清空→导入", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // 1. 首页 + 地图 + 真实检索
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "今天怎么吃？" })).toBeVisible();
  const total = await waitPois(page);
  await expect(page.locator(".amap-layer, .amap-maps").first()).toBeAttached({ timeout: 30_000 });
  await expect(page.getByTestId("pin").first()).toBeAttached({ timeout: 30_000 });
  const pinCount = await page.getByTestId("pin").count();
  console.log(`[evidence] 高德实时检索深圳寿司店 ${total} 家，地图标记 ${pinCount} 个`);
  expect(pinCount).toBeGreaterThan(0);
  await shot(page, "01-home-map");

  // 键盘：Tab 进入单选组（roving tabindex），方向键移动焦点并同时选中
  const sceneGroup = page.getByRole("radiogroup", { name: "用餐场景" });
  const radios = sceneGroup.getByRole("radio");
  await nav(page, "寿司护照").focus();
  for (let i = 0; i < 5 && !(await radios.first().evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(radios.first()).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(radios.nth(1)).toBeFocused();
  await expect(radios.nth(1)).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("ArrowRight");
  await expect(radios.nth(2)).toBeFocused();
  await expect(radios.nth(2)).toHaveAttribute("aria-checked", "true");
  await expect(radios.nth(1)).toHaveAttribute("aria-checked", "false");
  await page.keyboard.press("ArrowLeft");
  await expect(radios.nth(1)).toBeFocused();
  await expect(radios.nth(1)).toHaveAttribute("aria-checked", "true");
  await expect(radios.nth(2)).toHaveAttribute("aria-checked", "false");

  // 2. 场景推荐
  await page.getByRole("radiogroup", { name: "用餐场景" }).getByRole("radio", { name: /约会/ }).click();
  const results = page.getByTestId("results");
  await expect(results.getByText(/^最匹配/).first()).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /^已为你选出 \d+ 家推荐$/ })).toBeAttached();
  const cards = await results.locator("article.card").count();
  console.log(`[evidence] 约会场景推荐 ${cards} 家`);
  expect(cards).toBeGreaterThan(0);
  expect(cards).toBeLessThanOrEqual(3);
  // 推荐卡片：店名/评分/人均齐全，徽章互不相同
  await assertCardFacts(results.locator("article.card"));
  const badges = (await results.locator("article.card .badge").allTextContents()).map((t) => t.trim());
  expect(badges).toHaveLength(cards);
  expect(badges.every((b) => b.length > 0)).toBe(true);
  expect(new Set(badges).size).toBe(badges.length);
  await shot(page, "02-scene-recommend");

  // 预算场景
  await page.getByRole("radiogroup", { name: "用餐场景" }).getByRole("radio", { name: /指定预算/ }).click();
  await page.getByLabel("每人预算上限（元）").fill("400");
  await expect(results.getByRole("heading", { name: "指定预算推荐" })).toBeVisible();

  // 3. 地图页：搜索 / 筛选 / 联动
  await nav(page, "寿司地图").click();
  await waitPois(page);
  await page.getByLabel("搜索店名/关键词").fill("鮨");
  await page.getByRole("button", { name: "搜索高德" }).click();
  await expect(page.getByTestId("poi-status")).toContainText("“鮨”", { timeout: 60_000 });
  const filterText = await page.getByTestId("filter-count").textContent();
  console.log(`[evidence] 搜索“鮨”：${filterText}`);
  const districtOptions = await page.locator("#district option").count();
  if (districtOptions > 1) await page.locator("#district").selectOption({ index: 1 });
  await expect(firstCard(page)).toBeVisible();
  await assertCardFacts(page.locator("article.card"));
  const firstName = (await firstCard(page).locator("h3 button").textContent()) ?? "";
  await firstCard(page).locator("h3 button").click();
  await expect(firstCard(page)).toHaveClass(/card-sel/);
  await shot(page, "03-map-list-filter");

  // 4. 详情
  await firstCard(page).getByRole("link", { name: "详情与补充" }).click();
  await expect(page.getByRole("heading", { level: 1, name: firstName, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /高德提供的信息/ })).toBeVisible();
  await page.getByLabel("流派", { exact: true }).fill("测试流派");
  await page.getByRole("button", { name: "☆ 收藏" }).click();
  await page.getByRole("button", { name: "标记去过" }).click();
  await page.getByLabel("复访意愿").selectOption("yes");
  await shot(page, "04-shop-detail");

  // 5. 护照
  await page.getByRole("link", { name: "写一条打卡" }).click();
  await expect(page.getByRole("heading", { name: "新增打卡" })).toBeVisible();
  await expect(page.getByLabel("店名", { exact: true })).toHaveValue(firstName);
  await page.getByLabel("套餐/菜单", { exact: true }).fill("测试套餐");
  await page.getByLabel("鱼种", { exact: true }).fill("鲣鱼");
  await page.getByRole("button", { name: "添加这一贯" }).click();
  await page.getByLabel("鱼种", { exact: true }).fill("鲈鱼");
  await page.getByRole("button", { name: "添加这一贯" }).click();
  await page.getByLabel("备注", { exact: true }).fill("E2E 备注");
  await page.getByRole("button", { name: "保存打卡" }).click();
  await expect(page.getByTestId("checkin")).toHaveCount(1);
  await expect(page.getByText("数据还不足以下结论")).toBeVisible();
  await shot(page, "05-passport");

  // 刷新后仍在
  await page.reload();
  await expect(page.getByTestId("checkin")).toHaveCount(1);
  await expect(page.getByTestId("checkin")).toContainText("测试套餐");

  // 编辑
  await page.getByTestId("checkin").first().getByRole("button", { name: /^编辑/ }).click();
  await page.getByLabel("总评（1–5）").selectOption("5");
  await page.getByRole("button", { name: "保存打卡" }).click();
  await expect(page.getByTestId("checkin")).toContainText("总评 5/5");

  // 季节页
  await nav(page, "鱼种季节").click();
  await expect(page.getByRole("note").filter({ hasText: /资料收录进度/ })).toBeVisible();
  await page.locator("#month").selectOption("4");
  await page.getByRole("button", { name: /鲣鱼/ }).first().click();
  await expect(page.getByRole("region", { name: /鲣鱼 相关记录/ })).toContainText(firstName);
  await shot(page, "06-season");

  // 比较
  await nav(page, "寿司地图").click();
  await waitPois(page);
  const available = await page.getByRole("button", { name: "加入比较" }).count();
  const toAdd = Math.min(available, 3);
  for (let i = 0; i < toAdd; i++) await page.getByRole("button", { name: "加入比较" }).nth(0).click();
  if (available > 3) {
    await page.getByRole("button", { name: "加入比较" }).nth(0).click();
    await expect(page.getByRole("alert").filter({ hasText: "最多同时比较 3 家" })).toBeVisible();
  }
  await page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: /^比较/ }).click();
  await expect(page.getByRole("heading", { name: `店铺比较（${toAdd}/3）` })).toBeVisible();
  await shot(page, "07-compare");

  // 6. 数据：导出 → 错误文件 → 清空 → 导入
  await nav(page, "数据管理").click();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "导出 JSON" }).click()]);
  const file = path.join(process.env.TMPDIR ?? "/tmp", "sushi-backup-e2e.json");
  await dl.saveAs(file);
  const exported = JSON.parse(fs.readFileSync(file, "utf8"));
  expect(exported.schemaVersion).toBe(1);
  expect(exported.checkins).toHaveLength(1);
  await shot(page, "08-data");

  const bad = path.join(process.env.TMPDIR ?? "/tmp", "sushi-bad-e2e.json");
  fs.writeFileSync(bad, JSON.stringify({ schemaVersion: 1, checkins: [{ id: "x", date: "坏", shopName: "x", overall: 9 }] }));
  await page.getByLabel("选择备份文件（.json）").setInputFiles(bad);
  await expect(page.getByTestId("data-msg")).toContainText("校验失败");
  await expect(page.getByText(/当前数据：1 条打卡/)).toBeVisible();

  await page.getByRole("button", { name: /清空所有个人数据/ }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("alertdialog").getByRole("button", { name: "取消" }).click();
  await expect(page.getByText(/当前数据：1 条打卡/)).toBeVisible();
  await page.getByRole("button", { name: /清空所有个人数据/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "确认清空" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByText(/当前数据：0 条打卡/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/当前数据：0 条打卡/)).toBeVisible();

  await page.getByLabel("选择备份文件（.json）").setInputFiles(file);
  await page.getByRole("button", { name: "确认导入并替换当前数据" }).click();
  await expect(page.getByText(/当前数据：1 条打卡/)).toBeVisible();
  await nav(page, "寿司护照").click();
  await expect(page.getByTestId("checkin")).toContainText("测试套餐");
  await nav(page, "寿司地图").click();
  await waitPois(page);

  expect(errors).toEqual([]);
});

test("地图加载失败可恢复且不白屏", async ({ page }) => {
  await page.route("https://webapi.amap.com/**", (r) => r.abort());
  await page.goto("/map");
  await expect(page.getByRole("heading", { name: "深圳寿司地图" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: /无法加载高德地图脚本/ }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "重试加载地图" })).toBeVisible();
  await expect(page.getByRole("button", { name: "重新检索" })).toBeVisible();
});

// 移动端 390x844：稳定文件名 mobile-01..04。<=900px 有列表/地图切换，未激活的面板隐藏，截图地图前须点“地图”。
test.describe("移动端截图", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("首页/推荐/地图/详情", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const toggle = async (name: "列表" | "地图") => {
      await page.getByRole("group", { name: "手机端视图切换" }).getByRole("button", { name: new RegExp(`^${name}`) }).click();
    };

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "今天怎么吃？" })).toBeVisible();
    await waitPois(page);
    await shot(page, "mobile-01-home");

    await page.getByRole("radiogroup", { name: "用餐场景" }).getByRole("radio", { name: /约会/ }).click();
    const results = page.getByTestId("results");
    await expect(results.getByText(/^最匹配/).first()).toBeVisible();
    await results.scrollIntoViewIfNeeded();
    await shot(page, "mobile-02-recommend");

    await nav(page, "寿司地图").click();
    await waitPois(page);
    await toggle("地图");
    await expect(page.getByTestId("pin").first()).toBeAttached({ timeout: 30_000 });
    await shot(page, "mobile-03-map");

    await toggle("列表");
    await expect(page.getByRole("group", { name: "手机端视图切换" }).getByRole("button", { name: /^列表/ })).toHaveAttribute("aria-pressed", "true");
    await expect(firstCard(page)).toBeVisible();
    await assertCardFacts(page.locator("article.card"));
    const name = ((await firstCard(page).locator("h3 button").textContent()) ?? "").trim();
    await firstCard(page).getByRole("link", { name: "详情与补充" }).click();
    await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible();
    await shot(page, "mobile-04-detail");

    expect(errors).toEqual([]);
  });
});
