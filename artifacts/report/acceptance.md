# 验收报告：深圳 Omakase（Kanban t_47733881，恢复卡 t_ba9397ec）

日期：2026-11-20/21　分支：`shenzhen-sushi-map/t_47733881-claude-code-omakase`　基线：8051d9344cf0834c04d73cf21fb74fa2cab0f404

## 1. 结果摘要
- 主清单 **2 家**（穗 Sushi Minoru、隐谷 Omakase 福田财富店）；待核实区 **22 家**（不计入主清单）；排除 **34 家**；候选共 58。数量少是刻意的：证据不足即不收录。
- 独立 QA 复核后降级：鮨嵐前海店（板前/一场制证据与引用页面不符）、齐武（身份仅一篇用户笔记）均移入待核实。
- 图鉴 **57 条 / 9 类 / 98 个来源**（官方/政府 48、权威媒体/出版物 2、百科/二手整理 48；行业机构 0——全すし連、Michelin、豊洲鱼种旬页均未取得可读页面）。每条至少有一个非百科来源（单测保证），旬月份只采用一手来源。复核后删除 ishidai、caviar、unagi 三条（一手来源只能支撑极少内容，不为凑数保留）。
- 旧“三件事/三轴”框架已从代码、数据、文档删除（`tests/audit.test.ts` 扫描保证）。

## 2. 筛选规则与审计
规则 R1–R8、深圳 Omakase 特点研究、逐候选逐条检查、价格证据、身份证据、原因、来源、更新时间见 `artifacts/report/omakase-audit.md`（由 `scripts/build-report.mjs` 从 `data/audit.json` 确定性生成）；研究笔记 `research-shenzhen-omakase.md`。动态高德检索走 `lib/rules.ts`：名称命中排除模式（放题/回转/居酒屋/外卖…）优先拒绝；未审计 POI 一律不进主清单；命中 exclude/pending 候选拒绝；已入选候选需全名+分店限定都命中（不使用单字关键词），类型明确非餐饮或高德人均 <300 拒绝。真实 E2E：高德返回 70 个地点，2 个通过，68 个被拒绝。
真实高德事实快照 `artifacts/report/amap-probe.json`（51 个关键词，297 个 POI）。

## 3. 图鉴
`data/atlas.json`、`data/sources.atlas.json`；来源清单 `artifacts/report/atlas-sources.md`；研究笔记 `research-atlas-notes.md`。QA 指出的不一致已修：madai 月份改为只取一手来源（JETRO、长崎市、岛根县），说明与月份一致；hotate 月份改为 []（各产地漁期不同）；kuromaguro 月份用北海道庁“秋至初冬”与水产厅产卵期，措辞与月份一致。原“仅日文维基”10 条逐条补一手来源（農水省 aff/GI、水産庁、各县水试等）并删除无依据的月份/技法/风味断言。仍存在的限制：鳥貝、烏賊、数の子、煮切り、赤酢的风味与技法写“来源未载”；部分非月份的识别/用法叙述仍引用日文维基（界面标“百科/二手整理”）。

## 4. 命令与真实结果
| 命令 | 结果 |
| --- | --- |
| `node scripts/validate-data.mjs` | 通过（58 候选、include=2；atlas 60 条） |
| `node scripts/build-report.mjs` | 通过，生成 omakase-audit.md / atlas-sources.md |
| `pnpm lint` | 0 error / 0 warning |
| `pnpm typecheck` | 通过 |
| `pnpm test` | 4 files, **128 tests passed** |
| `pnpm build` | 通过（65 个静态页） |
| 真实高德 production E2E（`pnpm e2e`，生产服务 127.0.0.1:3617） | **7 passed**（桌面 5 + 移动 2） |

E2E 覆盖：主清单仅含合格店且价位 ≥300、每卡 headline 不同；搜索/筛选抽屉/空状态；每店详情 8 个字段 + 优势 + 风险 + 置信度 + 更新时间 + 来源链接；收藏/去过/备注跨刷新；导出、非法导入被拒、清空、导入恢复；图鉴列表/搜索/类别/月份/空状态/详情；筛选依据页与高德拒绝计数；高德脚本被拦截的错误态与重试恢复；损坏本地存储；390×844 无横向溢出、触控目标 ≥44px。console 报告 `console-errors.json`：真实流程无产品错误；其中 2 条 “product” 分类是故意访问不存在的图鉴路径产生的 404，2 条 third-party 是故意拦截高德脚本。

## 5. 截图逐张检查（全部 23 张，已逐张目视检查；`artifacts/screenshots/`）
本地真实高德 E2E 生成 17 张，公网读回生成 6 张。检查项：布局、截断/遮挡、横向溢出、错误态/空状态、视口。

| 截图 | 视口 | 结论 |
| --- | --- | --- |
| desktop-01-home | 1360×900 | 左栏清单 + 右侧高德地图 2 个标记，无截断/遮挡；价格时效红字清晰；无溢出 |
| desktop-02-filter | 1360×900 | 筛选“¥300–499”已应用：标签 + “清除全部”，列表 2 家，布局正常 |
| desktop-03-empty | 1360×900 | 搜索无结果：虚线空状态 + “清除筛选”，计数“共 0 家”，无遮挡 |
| desktop-04-detail | 1360×900 | 右侧详情面板 + 遮罩；“待核实”斜体虚线、来源 chip 标层级与日期；无截断 |
| desktop-05-atlas-list | 1360×900 | 免责声明常驻；类别/月份筛选；三列卡片含 12 月季节条；无溢出 |
| desktop-06-atlas-detail | 1360×900 | 真鲷：旬与供应差异说明块、季节条、面包屑；文字不截断 |
| desktop-07-audit | 1360×900 | 筛选依据：特点研究 + 来源 chip；版本/更新时间显示；无溢出 |
| desktop-08-amap-error | 1360×900 | 高德被拦截：地图区错误 + “重试加载地图”，左侧告警 + “重新检索”，清单仍可浏览 |
| mobile-01-home | 390×844 | 首屏含标题、导航、搜索、地图（2 标记）与首家卡片；无横向溢出 |
| mobile-02-filter | 390×844 | 底部筛选抽屉：分组按钮 ≥44px、“清除全部/查看 2 家”固定，无截断 |
| mobile-03-detail | 390×844 | 全屏详情，来源 chip 换行正常，无溢出 |
| mobile-04-detail-sources | 390×844 | 高德人均、来源编号列表、收藏/备注区；链接目标 ≥44px |
| mobile-05-settings | 390×844 | 设置对话框在视口内；已删除过时的“未映射素材”区块，数据说明与关闭按钮可见 |
| mobile-06-atlas-list | 390×844 | 免责声明、搜索、类别换行按钮，无溢出 |
| mobile-07-atlas-detail | 390×844 | 真鲷详情：季节条与差异说明块完整显示 |
| mobile-08-audit | 390×844 | 筛选依据：标题、特点与来源 chip 纵向堆叠，无溢出 |
| mobile-09-amap-error | 390×844 | 错误态：地图区提示 + 重试按钮，列表告警，无溢出 |
| public-desktop-01-home | 1360×900 | 线上首页：2 家、2 标记，与本地一致 |
| public-desktop-02-detail | 1360×900 | 线上详情面板，字段与来源 chip 正常 |
| public-desktop-03-atlas | 1360×900 | 线上图鉴搜索“鲷”→ 2 种，计数与“清除筛选”正常 |
| public-mobile-390x844-01-home | 390×844 | 线上移动首页：地图 2 标记，无溢出 |
| public-mobile-390x844-02-detail | 390×844 | 线上移动详情：来源 chip 与“待核实”正常 |
| public-mobile-390x844-03-atlas | 390×844 | 线上移动图鉴：免责声明、搜索“鲷”、类别按钮正常 |

检查中发现并已修复：mobile-01 曾出现“有 1 项高德检索失败”（限流）→ 检索重试由 1 次增至 3 次递增退避；mobile-05 设置里存在过时的“未映射素材”区块 → 删除；desktop-02 原本是空状态 → 改为展示有结果的“¥300–499”筛选；隐谷/穗价格来源过期 → 卡片与详情显示价格时效提醒。

## 6. 原生 named subagents
source_verification_agent（店铺审计，2 轮）、bibliography_agent（图鉴，2 轮）、frontend-developer（UI）、qa-expert（独立 QA，已返回完整报告）。QA 发现并已修复：B1 鮨嵐证据不符→降级；H1 高德类型“购物服务”误拒→规则放宽到全名+分店命中；H2 隐谷/穗引用错位与夸大→改写并补来源日期、重新分层；M1 排除模式可被候选名绕过→改为最优先；M2 触控目标→CSS；L2 404 标题；README/测试失败项。未修：L3 详情抽屉在高负载无头环境下较慢（机器负载 >20，非真机 GPU 测量）。

## 7. 限制
见 README“已知限制”。

## 8. 发布与公网验收（最终）
- 业务提交 `aeb9befa010810383a4d2aaf724877b1607132f4` 合入 canonical main 并推送 origin/main（后续仅文档提交）。
- 静态导出（`GITHUB_ACTIONS=true`）发布到 gh-pages：`54ce9db214e0dd48957d16da8fdeedaf3ea56dbf`；GitHub Pages 状态 `built`（该 commit）。
- 公网 https://yzng12345678.github.io/shenzhen-sushi-map/ 用真实桌面与 390×844 浏览器验证（`scripts/public-verify.mjs` → `artifacts/report/public-verify.json`）：标题“深圳 Omakase · 精选板前清单”；主清单 2 家，价位 ¥480 / ¥400 起（均 ≥300）；真实高德地图 2 个标记；详情 8 个评价字段 + 优势/风险/置信度 + 来源链接；图鉴 57 种、搜索可用、详情含旬与供应差异说明；无横向溢出；无旧框架文案；页面错误 0。
- 一场制/预约规则：两家入选店的 R3 均为“待核实”（unknown），隐谷预约字段显示“待核实”；价格时效：隐谷最新有日期的价格来源 2022-04、穗 2024-04，均在卡片与详情标注。
