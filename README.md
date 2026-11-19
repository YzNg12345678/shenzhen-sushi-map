# 深圳寿司地图

个人自用的寿司版 Letterboxd：解决“今天去哪吃”和“吃过什么”。无登录、无后端、无社区、无评论、无付费排序。

- **今天怎么吃**（`/`）：选场景（一人吃 / 约会 / 请客 / 深夜 / 初次 omakase / 指定预算），从高德实时检索结果里最多推荐 3 家（最匹配 / 最稳妥 / 最有特色）。理由只引用高德字段和你自己的记录，并标明来源。
- **寿司地图**（`/map`）：高德 JS API 2.0 地图 + 等价列表，支持搜索、区域、人均上限、排序、只看收藏/去过。
- **店铺详情**（`/shop?id=…`）：高德实际返回的字段（未返回显示“未知”）+ 你补充的流派、赤酢/白酢、熟成、师傅、座位、套餐、预约难度、私人备注、收藏/去过/复访意愿。
- **寿司护照**（`/passport`）：打卡增删改（日期、店铺、套餐、逐贯评分、总评、备注），数据足够（≥3 次打卡、≥8 贯评分）才生成口味画像。
- **鱼种季节**（`/season`）：数据在 `lib/fish.ts`，只收录有来源的条目，其余标“待补充”；可从鱼种查看个人记录。
- **比较**（`/compare`）：最多 3 家横向对比。
- **数据管理**（`/data`）：完整 JSON 导出/导入（含 `schemaVersion` 校验）、二次确认清空。

数据标注：**高德**＝高德返回的事实；**你填写**＝个人记录；**推导**＝本应用按公开规则算出的建议，不是客观评价。

## 安装

要求 Node.js ≥ 20，包管理器固定为 **pnpm**（已提交 `pnpm-lock.yaml`）。

```bash
pnpm install --frozen-lockfile
```

## 环境配置

复制 `.env.example` 为 `.env.local`（已被 Git 忽略，权限建议 600），填入：

- `NEXT_PUBLIC_AMAP_JS_KEY`：高德 JS API 2.0 Key
- `NEXT_PUBLIC_AMAP_SECURITY_JS_CODE`：对应安全密钥（securityJsCode）

也可运行 `scripts/configure-amap-js.sh` 隐式输入。详见 `docs/amap-config.md`。高德控制台需为 JS Key 配置本机来源白名单。**不要提交或截图真实凭据。** 地图与 POI 检索全部在浏览器通过 JS API（`AMap.PlaceSearch`）完成，不需要 Web 服务 Key。

注意：`NEXT_PUBLIC_*` 在构建时内联，修改 `.env.local` 后需重新构建。

## 开发

```bash
pnpm dev          # 默认端口 3417，可用 PORT=xxxx 覆盖
pnpm lint
pnpm typecheck
pnpm test         # Vitest 单元测试
```

## 生产构建与启动

```bash
pnpm build
pnpm start        # 默认 3417；PORT=4000 pnpm start 可换端口
```

## 浏览器端到端测试（真实高德，不使用 mock）

先按上面方式启动生产服务，再让 Playwright 连接它：

```bash
pnpm exec playwright install chromium   # 首次
E2E_BASE_URL=http://127.0.0.1:3417 pnpm e2e
```

覆盖：首页加载、创建地图、真实检索深圳寿司店、场景推荐、详情、写入护照、刷新保留、导出、坏文件导入被拒、二次确认清空、导入恢复。截图写入 `artifacts/screenshots/`（不含凭据）；console/page error 报告写入 `artifacts/report/console-errors.json`（URL 查询串已脱敏，产品错误须为 0）。

## 数据备份与恢复

所有个人数据保存在浏览器 localStorage（键 `shenzhen-sushi-map:v1`），换浏览器、清缓存或使用无痕窗口都会丢失，请定期备份。

1. 打开 **数据管理** → **导出 JSON**，得到 `shenzhen-sushi-backup-日期.json`。
2. 恢复：**数据管理** → 选择备份文件。应用先校验 `schemaVersion` 与全部字段，通过后点“确认导入并替换当前数据”；校验失败会给出原因，现有数据不受影响。
3. 清空：点“清空所有个人数据…”后还需在确认框里点“确认清空”。

## 文档

- `docs/mvp-plan.md`、`docs/source-review.md`：方案与来源审查
- `docs/amap-config.md`：高德凭据配置

## 隐私与已知限制

- 个人数据只存在本机浏览器 localStorage，不上传任何服务；唯一外部请求是高德 JS API（地图与 POI 检索）。
- 环境变量名：`NEXT_PUBLIC_AMAP_JS_KEY=<你的 JS Key>`、`NEXT_PUBLIC_AMAP_SECURITY_JS_CODE=<你的安全密钥>`；真实值只放 `.env.local`。
- 因为 JS Key 会内联到前端，必须在高德控制台设置域名/来源白名单。
- 店铺事实完全来自高德实时检索，检索上限内的结果可能不全；缺失字段显示“未知/待补充”。
- 清缓存/换浏览器会丢失数据，请用“数据管理”定期导出。
- E2E 依赖真实高德网络与额度；若端口 3417 已被占用，请用 `PORT` 与 `E2E_BASE_URL` 指定其他端口。
