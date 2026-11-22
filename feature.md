# 功能说明：验收清单逐项勾选

- 日期：2026-11-22
- 目标版本：1.10.0
- 状态：待验收（随本 PR 提交）
- 涉及模块：任务模型 / Store / Runtime / HTTP API / 工作台 Stage / 合并确认 / 文案与样式

## 1. 一句话概述

把「验收标准」从发布时录入的一段只读文字，变成验收阶段可以逐项勾选、带进度、可持久化的核对清单，并在合并确认时提示尚未核对的项。

## 2. 背景与问题

发布任务时，用户可以从验收标准库勾选或手动补充 `acceptanceCriteria`。这些标准目前只有两个作用：

1. 发布弹窗里录入；
2. 任务详情「概览」中展示，且只在任务**已合并 / 已清理**后统一显示为完成（`src/client/model.ts` 的 `criteria()`）。

这带来三个实际问题：

- **验收标准与验收动作脱节**：真正进入 `review` 状态验收时，清单仍然是只读的，用户无法记录「这一条我核对过了」。
- **合并前没有遗漏提醒**：任务可以在清单一项未核对的情况下直接合并，验收标准无法起到把关作用。
- **核对过程落在产品之外**：用户只能另开文档或凭记忆逐条检查，任务结束后也看不出当时核对到什么程度。

验收标准是本插件「发布 → 开发 → 验收 → 合并」闭环里唯一描述“什么算完成”的数据，却恰好是闭环中唯一没有交互的一环。

## 3. 功能说明

### 3.1 逐项勾选

- 任务详情「概览」中的每条验收标准变为可点击的复选项。
- 点击一次标记为已核对，再点一次取消；状态立即持久化，刷新页面、重启 DSH、换端口打开都不丢失。
- 任务已合并 / 已清理时，清单保持只读并显示为全部完成（沿用现有语义，避免历史任务出现“未完成”的误导）。
- 正在执行验收切换、合并等操作时，勾选按钮禁用，避免与工作区操作并发。

### 3.2 进度展示

- 「验收标准」分区标题显示进度，例如 `验收标准 · 2/4`；全部核对后显示完成态。
- 合并确认弹窗新增一行「验收标准」进度；仍有未核对项时明确提示数量，但不阻止合并（是否合并由用户决定）。

### 3.3 数据与接口

- 任务记录新增可选字段 `checkedCriteria?: string[]`，保存已核对的标准文本。标准本身仍以 `acceptanceCriteria` 为准，勾选状态按文本取交集，天然容忍未来标准被移除。
- Store 新增原子方法 `setCriterionChecked(taskId, text, checked)`：在跨进程账本锁内读取最新任务、校验标准存在、更新并落盘，避免两个 DSH 进程同时勾选时互相覆盖。
- Runtime 新增 `setCriterionChecked(id, text, checked)`：校验参数并把 Store 的结果翻译成 `404`（任务不存在）或 `400`（该任务没有这条标准）。
- 新增 HTTP 路由 `POST /dsh-worktree/api/task/criteria`，请求体 `{ id, text, checked }`，沿用 `task/*` 的 token 校验与统一响应（返回最新 `view`）。

### 3.4 交互与可访问性

- 复选项使用 `button` + `role="checkbox"` + `aria-checked`，保留键盘 Tab / Space 操作与可见焦点环。
- 文案同时加入 `locale/zh.json` 与 `locale/en.json`，不引入第二份字典。
- 样式只改看板作用域（`src/client/styles/workbench.ts`），复用现有 `--ok` / `--accent` / `--line-strong` token，明暗主题一致。

## 4. 为什么现在做

- **闭环成本最低**：数据字段、发布入口、展示位置都已存在，只差“可写 + 进度 + 提醒”，不需要新页面或新概念。
- **收益直接**：它把“验收标准”从说明文字变成可执行动作，直接作用在每天最高频的验收 / 合并路径上。
- **风险可控**：只新增可选字段和一条 POST 路由，不改状态机、不改 Git 操作、不改合并门禁；旧任务记录无需迁移。
- **符合现有加固方向**：勾选写入走 Store 锁，与 1.9.3 的跨进程账本、原子会话绑定保持一致。

## 5. 预期效果

| 维度 | 预期 |
| --- | --- |
| 验收完整性 | 用户在合并前能看到“还有几项没核对”，减少漏验收 |
| 可追溯性 | 任务记录保留核对结果，事后能回答“当时按什么标准验收的” |
| 使用率 | 验收标准不再是一次性输入，发布时填写标准的动机更强 |
| 操作成本 | 每次核对一次点击，无额外弹窗、无额外页面 |

定性目标：让「验收标准」成为验收动作的一部分，而不是发布表单里的装饰项。

## 6. 收益

- **对用户**：验收时不用另开清单；合并前有一次明确的遗漏提示；历史任务可回看核对状态。
- **对团队 / 评审者**：验收标准与勾选结果随任务记录保存，评审时能区分“标准是什么”和“核对到哪一步”。
- **对插件**：补上验收闭环的最后一段交互；为后续“合并门禁可配置”“验收报告导出”留下数据基础。
- **对维护者**：改动集中在模型、Store、一条路由和一个组件，测试面清晰，回滚只需移除字段与路由。

## 7. 实现方案

### 7.1 数据模型（`src/models.ts`）

```ts
/** 已核对的验收标准文本；与 acceptanceCriteria 取交集后展示。 */
checkedCriteria?: string[]
```

### 7.2 Store（`src/store.ts`）

新增并导出结果类型：

```ts
export type CriterionResult =
  | { ok: true; task: WorktreeTask }
  | { ok: false; reason: 'missing' | 'unknown' }
```

`setCriterionChecked(taskId, text, checked)`：

1. `withLock` + `refreshTasks()`；
2. 任务不存在 → `missing`；
3. `normalizeCriteria(task.acceptanceCriteria)` 不包含 `text` → `unknown`；
4. 用 `Set` 增删后按原标准顺序写回 `checkedCriteria`（只保留仍存在的标准）；
5. `saveTasks()`，返回最新任务。

### 7.3 Runtime（`src/runtime/lifecycle.ts`、`src/runtime.ts`）

- `setCriterionChecked(ctx, id, text, checked)`：
  - 空文本 → `TaskError('验收标准不能为空')`；
  - Store 返回 `missing` → `TaskError('任务不存在：<id>', 404)`；
  - Store 返回 `unknown` → `TaskError('该任务没有这条验收标准', 400, 'unknown-criterion')`。
- `Runtime` 暴露同名方法，供 HTTP 路由调用。

### 7.4 HTTP（`src/http.ts`）

在现有 `act(...)` 注册区新增：

```ts
act('criteria', async (id, body) =>
  app.runtime.setCriterionChecked(id, String(body.text || ''), body.checked === true))
```

### 7.5 客户端派生（`src/client/model.ts`）

`criteria(task, status)`：

- `merged` / `cleaned` → 全部 `checked: true`（保持现状）；
- 其他状态 → `checked: (task.checkedCriteria || []).includes(text)`。

新增纯函数 `criteriaProgress(items)` 返回 `{ checked, total, missing }`，供概览与合并确认共用。

### 7.6 工作台（`src/client/stage.ts`、`src/client/board.ts`、`src/client/board/use-board-actions.ts`）

- `StageProps` 新增 `criteriaBusy?: boolean` 与 `onToggleCriterion?: (text, checked) => void`。
- `Overview`：可交互状态下把每条标准渲染为 `button[role=checkbox]`；只读状态保持现有静态勾选样式；标题带进度。
- `board.ts` 接线：`criteriaBusy: busy === 'criteria'`，`onToggleCriterion: actions.runCriterion`。
- `useBoardActions` 新增 `runCriterion(text, checked)`：`setBusy('criteria')` → `post('task/criteria', ...)` → 失败 Toast → `finally` 清 busy 并 `refresh()`；成功不弹 Toast，避免逐项勾选时刷屏。
- `runMerge`：在确认详情中加入验收清单进度；有未核对项时在 `body` 追加提示（不阻止合并）。

### 7.7 文案与样式

- `locale/zh.json` / `locale/en.json` 新增：
  - `boardCriteriaProgress`（`已核对 {n}/{total}`）
  - `boardCriteriaAllDone`（`全部核对完成`）
  - `boardCriteriaToggleHint`（`点击核对这一项`）
  - `boardMergeCriteriaMissing`（`还有 {n} 项验收标准未核对`）
- `src/client/styles/workbench.ts` 新增复选项按钮的 reset、hover 与 `focus-visible` 样式。

### 7.8 文档

- 本文件 `feature.md`：功能说明、原因、预期效果、收益、方案与验收标准。
- `README.md`：功能概览与工作台交互各补一条。
- `docs/frontend-design.md`：任务摘要 / 验收组件规范补充复选交互。
- `CHANGELOG.md`：新增 `1.10.0` 条目；`package.json` 版本升至 `1.10.0`。

## 8. 验收标准

- [ ] 发布时带验收标准的任务，在「概览」中每条标准可点击勾选 / 取消。
- [ ] 勾选后刷新页面、重新打开工作台，状态保持。
- [ ] 分区标题显示 `已核对 n/total`，全部核对后显示完成态。
- [ ] 已合并 / 已清理任务的清单只读且显示全部完成。
- [ ] 合并确认弹窗显示验收进度；存在未核对项时给出数量提示，且仍可合并。
- [ ] 勾选请求走 token 校验；未知任务返回 404，未知标准返回 400。
- [ ] 两个进程同时勾选不同标准时，两项结果都保留（Store 锁内读改写）。
- [ ] 明暗主题下复选项、hover 与焦点环显示正常，键盘可操作。
- [ ] `npm run verify`（typecheck + locale 检查 + 测试 + 构建）通过。
- [ ] `feature.md`、`README.md`、设计文档与 `CHANGELOG.md` 已更新。

## 9. 测试与验证计划

- **纯逻辑**：`criteria()` 在 `merged` / `cleaned` / `review` 下的勾选派生；`checkedCriteria` 与当前标准的交集；`criteriaProgress` 计数。
- **Store**：勾选、取消、未知标准、未知任务、重复勾选幂等、标准顺序保持。
- **HTTP**：发布带标准的任务 → `POST task/criteria` 勾选 → `GET tasks` 可见；无 token 403；未知任务 404；未知标准 400。
- **回归**：`npm run verify` 全量通过（现有 271 项基础上新增用例）。
- **人工**：在 DSH Web 中发布任务、勾选、刷新、打开合并确认，检查明暗主题与键盘操作。

## 10. 风险、边界与回滚

- **兼容性**：`checkedCriteria` 为可选字段，旧记录缺省视为全未核对；已合并 / 已清理任务沿用“全部完成”语义。
- **并发**：写入走 Store 跨进程锁；勾选粒度是单条标准，不做批量覆盖。
- **不阻断合并**：本版只提示不拦截，避免在未确认用户意图前改变既有合并行为；门禁化留作后续可配置项。
- **回滚**：移除路由与 UI 接线后，`checkedCriteria` 字段留在记录中也不影响旧版本读取。

## 11. 后续计划（不在本次范围）

- 合并门禁可配置：项目级开关「存在未核对项时禁止合并」。
- 发布时选择“标准模板”，自动带出常用验收项。
- 任务验收报告导出（Markdown）：标准、勾选结果、提交与 diff 摘要。
- Agent 在完成任务时给出逐条自检建议，用户仍需手动确认。
- `worktree_act` 增加 `criteria` 动作，供模型工具链路使用。

## 12. 文件清单

| 文件 | 改动 |
| --- | --- |
| `src/models.ts` | 新增 `checkedCriteria` 字段 |
| `src/store.ts` | 新增 `CriterionResult` 与 `setCriterionChecked` |
| `src/runtime/lifecycle.ts` | 新增 `setCriterionChecked` 校验与错误映射 |
| `src/runtime.ts` | 暴露 `setCriterionChecked` |
| `src/http.ts` | 新增 `task/criteria` 路由 |
| `src/client/model.ts` | `criteria()` 读取勾选状态；新增 `criteriaProgress` |
| `src/client/stage.ts` | 概览复选交互与进度 |
| `src/client/board.ts` | Stage 接线 |
| `src/client/board/use-board-actions.ts` | `runCriterion` 与合并确认提示 |
| `src/client/styles/workbench.ts` | 复选项交互样式 |
| `locale/zh.json`、`locale/en.json` | 新增 4 条文案 |
| `test/client-model.test.ts`、`test/criteria-checks.test.ts` | 新增 / 更新用例 |
| `README.md`、`docs/frontend-design.md`、`CHANGELOG.md`、`package.json` | 文档与版本 |
