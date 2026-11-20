# 验收报告：深圳 Omakase（Kanban t_47733881，恢复卡 t_ba9397ec）

日期：2026-11-20/21　分支：`shenzhen-sushi-map/t_47733881-claude-code-omakase`　基线：8051d9344cf0834c04d73cf21fb74fa2cab0f404

## 1. 结果摘要
- 主清单 **2 家**（穗 Sushi Minoru、隐谷 Omakase 福田财富店）；待核实区 **22 家**（不计入主清单）；排除 **34 家**；候选共 58。数量少是刻意的：证据不足即不收录。
- 独立 QA 复核后降级：鮨嵐前海店（板前/一场制证据与引用页面不符）、齐武（身份仅一篇用户笔记）均移入待核实。
- 图鉴 **60 条 / 9 类 / 95 个来源**（官方/政府 37、权威媒体 1、百科/二手整理 57；行业机构 0——全すし連、Michelin、豊洲鱼种旬页均未取得可读页面）。
- 旧“三件事/三轴”框架已从代码、数据、文档删除（`tests/audit.test.ts` 扫描保证）。

## 2. 筛选规则与审计
规则 R1–R8、深圳 Omakase 特点研究、逐候选逐条检查、价格证据、身份证据、原因、来源、更新时间见 `artifacts/report/omakase-audit.md`（由 `scripts/build-report.mjs` 从 `data/audit.json` 确定性生成）；研究笔记 `research-shenzhen-omakase.md`。动态高德检索走 `lib/rules.ts`：名称命中排除模式（放题/回转/居酒屋/外卖…）优先拒绝；未审计 POI 一律不进主清单；命中 exclude/pending 候选拒绝；已入选候选需全名+分店限定都命中（不使用单字关键词），类型明确非餐饮或高德人均 <300 拒绝。真实 E2E：高德返回 70 个地点，2 个通过，68 个被拒绝。
真实高德事实快照 `artifacts/report/amap-probe.json`（51 个关键词，297 个 POI）。

## 3. 图鉴
`data/atlas.json`、`data/sources.atlas.json`；来源清单 `artifacts/report/atlas-sources.md`；研究笔记 `research-atlas-notes.md`。二次核对删改了第一轮无依据内容（如神奈川县日历月份、kuromaguro 数字、saba 九州冬季说法、wasabi 旬）。已知弱点：23→22 条无月份；10 条仅日文维基支撑；JNTO 页面为脚本渲染未能逐字核对，已撤回依赖。QA 低级别提示（madai 月份与说明、hotate 月份、kuromaguro 措辞不一致）未再修，记为限制。

## 4. 命令与真实结果
| 命令 | 结果 |
| --- | --- |
| `node scripts/validate-data.mjs` | 通过（58 候选、include=2；atlas 60 条） |
| `node scripts/build-report.mjs` | 通过，生成 omakase-audit.md / atlas-sources.md |
| `pnpm lint` | 0 error / 0 warning |
| `pnpm typecheck` | 通过 |
| `pnpm test` | 4 files, 127 tests passed |
| `pnpm build` | 通过（65 个静态页） |
| 真实高德 production E2E（`pnpm e2e`，生产服务 127.0.0.1:3617） | **7 passed**（桌面 5 + 移动 2） |

E2E 覆盖：主清单仅含合格店且价位 ≥300、每卡 headline 不同；搜索/筛选抽屉/空状态；每店详情 8 个字段 + 优势 + 风险 + 置信度 + 更新时间 + 来源链接；收藏/去过/备注跨刷新；导出、非法导入被拒、清空、导入恢复；图鉴列表/搜索/类别/月份/空状态/详情；筛选依据页与高德拒绝计数；高德脚本被拦截的错误态与重试恢复；损坏本地存储；390×844 无横向溢出、触控目标 ≥44px。console 报告 `console-errors.json`：真实流程无产品错误；其中 2 条 “product” 分类是故意访问不存在的图鉴路径产生的 404，2 条 third-party 是故意拦截高德脚本。

## 5. 截图（artifacts/screenshots/，已逐张查看关键页）
desktop-01-home、02-filter、03-empty、04-detail、05-atlas-list、06-atlas-detail、07-audit、08-amap-error；mobile-01-home、02-filter、03-detail、04-detail-sources、05-settings、06-atlas-list、07-atlas-detail、08-audit、09-amap-error。

## 6. 原生 named subagents
source_verification_agent（店铺审计，2 轮）、bibliography_agent（图鉴，2 轮）、frontend-developer（UI）、qa-expert（独立 QA，已返回完整报告）。QA 发现并已修复：B1 鮨嵐证据不符→降级；H1 高德类型“购物服务”误拒→规则放宽到全名+分店命中；H2 隐谷/穗引用错位与夸大→改写并补来源日期、重新分层；M1 排除模式可被候选名绕过→改为最优先；M2 触控目标→CSS；L2 404 标题；README/测试失败项。未修：L3 详情抽屉在高负载无头环境下较慢（机器负载 >20，非真机 GPU 测量）。

## 7. 限制
见 README“已知限制”。
