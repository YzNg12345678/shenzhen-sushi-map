# 来源项目审查

## 1. renting-app

位置：`/Users/recovery/hermes-workspace/repos/renting-app`

可直接借鉴：

- `apps/web/` 的 Next.js 16、React 19、TypeScript、Tailwind、TanStack Query、React Hook Form、Zod、Vitest、Playwright 组合。
- `components/bearing/area-map.tsx` 的 MapLibre 地图生命周期、标记、弹窗、范围图层和测试方式；寿司项目需替换为高德地图或适配中国可用底图。
- `RecommendationsClient.tsx` 的推荐排序、硬条件排除、候选对比和解释性文案结构。
- `features/search-profile/schema.ts` 的 Zod 表单校验模式。
- “确定性评分负责排序，AI 只解释与提取”的边界。
- `XHS_ALL_IN_ONE/` 可用于理解小红书数据结构和采集流程，但不并入新项目运行时；采集继续复用现有独立 spider-xhs 入口。

不复用：

- 伦敦租房领域模型、GIS 数据、通勤/犯罪/租金评分。
- FastAPI、PostgreSQL、离线空间 ETL；个人自用首版不需要后端和数据库。
- 现有界面文案和租房信息架构。

风险：

- 项目本身约 3.2 GB，含 node_modules、构建缓存和数据文件；不得整库复制到新项目。
- 该目录目前不是 Git 仓库，应视为来源资产，不作为寿司项目的开发基线。

## 2. boxseek

位置：`/Users/recovery/hermes-workspace/repos/boxseek`

可直接借鉴：

- `packages/vision/` 的 Provider 抽象、严格 JSON Schema 校验、失败纠错重试、Mock Provider 和测试结构。
- `scripts/eval-recognition.ts` / `eval/` 的“固定样本 + 人工标注 + 指标报告”评估方式，可改造成小红书笔记字段提取评估。
- `packages/shared/` 的共享 Zod Schema、归一化和同义词思路。
- `apps/mobile/src/lib/outbox.ts` 的本地优先、顺序重放和幂等思想；首版网站只取理念，用 localStorage，不复制移动端实现。

不复用：

- Expo/React Native 移动端、手机号登录、PostgreSQL、Redis、MinIO、BullMQ、S3、二维码、视觉识别和离线照片队列。
- 搬家箱子领域模型及物品检索逻辑。

风险：

- 仓库带有大量未提交修改，不能把当前工作树直接当模板或覆盖其历史。
- 项目约 811 MB，含 node_modules 和原生移动端资产；只参考少量独立模块。

## 合并结论

新项目不做两套代码的机械拼接。采用：

1. renting-app 的 Web 地图、推荐、比较和测试模式。
2. boxseek 的结构化提取 Provider、Schema 校验、Mock 与评估模式。
3. 新建干净仓库独立实现，来源项目保留为只读参考，避免把无关依赖和历史债务带入。
