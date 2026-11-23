# 每日功能批次 · 2026-11-23 · v1.15.0

> 批次主题：**执行节奏与风险可视化**（工时、规模、依赖、风险、视图）
>
> 一句话目标：让任务不仅「能被记录和找到」，还能回答五个问题——**花了多久、有多大、先做哪个、哪里有风险、常用筛选怎么一键回来**。
>
> 交付方式：一个 PR（`t3/daily-five-feature-pipeline` → `master`），5 个功能同批验收。
>
> 分工：主线程负责方案、任务拆分、集成、验收、文档与 PR；5 个 `pi` 子 agent 分别负责 5 个功能的编码落地与测试。上一批次（1.14.0 截止日期 / 依赖 / 洞察 / 结构化搜索 / 时间线）的文档见 git 历史。
>
> 状态：已实施 / 已验收（验收记录见第 10 节）。

## 0. 批次总览

| # | 功能 | 一句话价值 | 主要落点 |
| --- | --- | --- | --- |
| 1 | 任务工时计时 | 一键记录每个任务的实际投入时长，为估算校准和交接提供数据 | 模型 / Store / HTTP / 工具 / 任务信息 / 左栏 / 报告 |
| 2 | 任务规模估算与项目负载 | 用 `1/2/3/5/8` 点估算任务，项目详情看到进行中负载与估算覆盖率 | 模型 / 元数据 / Store / HTTP / 工具 / 发布 / 任务信息 / 左栏 / 项目洞察 / 报告 |
| 3 | 依赖关系图 | 把前置依赖画成分层 DAG，直观看执行顺序、阻塞链与缺失依赖 | 纯函数 / 项目详情 / SVG / 文案 |
| 4 | 项目风险雷达 | 按逾期、停滞、阻塞、验收缺口给开放任务打分，列出最该处理的几项 | 纯函数 / 项目详情 / 文案 |
| 5 | 保存的筛选视图 | 把搜索、注意力筛选、标签与归档开关存成命名视图，一键恢复 | 纯函数 / localStorage / 左栏 / 看板 / 文案 |

设计原则：

- **全部字段可选，旧台账零迁移**：`workMs`、`workStartedAt`、`estimate` 都是可选字段；没有这些字段的旧任务按「未计时 / 未估算」处理，读取、排序、状态推导都不变。
- **服务端时间**：工时开始 / 停止的时间戳由服务端在账本锁内写入，客户端不提交时间，避免多窗口时钟漂移和伪造。
- **纯函数优先**：工时计算、规模校验、依赖图布局、风险评分、视图序列化都放在无 DOM 的纯模块里，服务端、客户端与测试共用同一套规则；所有涉及「现在」的函数都接受可注入的 `now`。
- **元数据统一走一个原子入口**：规模估算继续复用 `Store.updateTaskMeta` 与 `POST task/meta`，在跨进程账本锁内读改写；工时因为要写服务端时间，单独走 `Store` 的计时方法，但同样在锁内完成。
- **不改变任务状态机**：新功能只增加展示字段、派生视图、编辑入口和客户端本地状态，不改变 `statusOf` 的任何分支，也不改变 Git / 会话行为。
- **默认不打扰**：没有计时不显示计时行，没有估算不显示点数 chip，没有依赖不显示依赖图，没有风险不显示风险条目，没有保存视图时下拉只显示「自定义」。
- **不引入依赖、只新增一个路由**：不新增 npm 包；只新增 `POST task/timer`，其余只扩展 `publish` 与 `task/meta` 的可选字段。
- **文档即验收**：每个功能都必须有功能说明、动机、预期效果、收益、实现方案、验收标准和测试要点。

---

## 1. 任务工时计时（Work timer）

### 1.1 功能说明

任务详情「任务信息」新增「工时」一行：

- 显示累计已记录时长，例如「2 小时 15 分」「45 分」「不足 1 分」；从未计时显示「未记录」。
- 提供「开始计时 / 停止计时」按钮；计时中显示「计时中」状态和当前累计时长（每 30 秒刷新一次显示，不产生额外请求）。
- 左栏任务行在计时中显示「计时中」chip，切换任务或刷新页面后仍能看到。
- 单任务验收报告新增「工时」行；项目验收报告的任务表新增「工时」列，逐任务详情也输出同一口径。
- 计时是**手动**的：插件不会根据会话运行状态自动开始或停止，避免把「Agent 在跑」误当成「人在投入」。已合并 / 已清理 / 已归档任务不能开始新计时，但允许停止正在跑的计时，保证最后一次投入能落账。

### 1.2 为什么做

当前任务台账记录了创建、更新、合并、清理等事件时间，但无法回答「这个任务实际花了多久」。对并行 Agent 工作流来说，这个缺口有三个直接后果：

1. **估算没有校准依据**：下一批任务的规模只能凭感觉，无法用历史实际投入修正。
2. **交接和验收缺少成本上下文**：报告里有分支、提交、改动文件，却没有「这项工作投入了多少」。
3. **多任务并行时感知失真**：任务切换频繁，人很难凭记忆还原每个任务的实际投入。

### 1.3 预期效果

- 用户在任务详情点一次「开始计时」，做别的事，回来点「停止计时」，累计时长自动落账。
- 重复点「开始计时」不会重复计时；停止后再开始会在原累计值上继续累加。
- 计时跨刷新、跨窗口、跨 DSH 重启保留；两个窗口同时操作时以账本锁内的结果为准。
- 系统时钟回拨、字段损坏、旧记录缺少字段时，显示 0 或忽略异常值，不出现负数、NaN、`Infinity`。
- 报告中的工时与界面完全一致，复制 / 下载后可直接贴到 PR 或周报。

### 1.4 收益

- **可度量**：第一次有「实际投入」这一列数据，能回答「时间去哪了」。
- **可校准**：与功能 2 的规模估算配合，逐步建立「1 点大约等于多少实际时间」的团队经验值。
- **可交接**：验收报告自带成本上下文，接手的 Agent 或人不需要再问「这个任务重不重」。
- **低打扰**：不自动计时、不弹提醒、不写会话，只在用户主动点击时记录。

### 1.5 实现方案

**模型字段**（`src/models.ts`）：

```ts
/** 累计已记录的主动工时（毫秒）；从未停止过计时则不存在。 */
workMs?: number
/** 当前计时的开始时间（毫秒）；不存在表示未计时。 */
workStartedAt?: number
```

两个字段都可选，旧记录不需要迁移。读取时按「0 / 未计时」处理。

**纯函数模块**（新增 `src/task-timer.ts`）：

```ts
export interface TimerSnapshot { workMs?: unknown; workStartedAt?: unknown }

/** 累计毫秒：已记录 + 正在跑的区间；异常值按 0 处理，时钟回拨不产生负数。 */
export function elapsedWorkMs(task: TimerSnapshot, now?: number): number

/** 开始计时：已在计时则返回原值；返回要写入的字段。 */
export function startWorkTimer(task: TimerSnapshot, now?: number): { workMs: number; workStartedAt: number }

/** 停止计时：未计时则原样返回；时钟回拨时本段按 0 计。 */
export function stopWorkTimer(task: TimerSnapshot, now?: number): { workMs: number; workStartedAt?: undefined }

/** 人类可读时长：`不足 1 分` / `45 分` / `2 小时 15 分` / `3 天 4 小时`。 */
export function formatWorkDuration(ms: unknown): string
```

规则：

- `workMs` 只接受有限非负数；`workStartedAt` 只接受有限正数，未来时间按「刚开始」处理（区间为 0）。
- 停止时 `added = max(0, now - workStartedAt)`；累计值使用安全整数上限，溢出时截断到 `Number.MAX_SAFE_INTEGER`。
- `formatWorkDuration` 对 0、负数、NaN、Infinity 统一返回「未记录」或「不足 1 分」，由调用方决定；不产生 `NaN` 文本。
- 纯函数不修改入参，返回新的字段值；Store 负责写入。

**Store**（`src/store.ts`）：

```ts
export type TimerResult =
  | { ok: true; task: WorktreeTask }
  | { ok: false; reason: 'missing' | 'closed' }

startTaskTimer(taskId: string, now?: number): TimerResult
stopTaskTimer(taskId: string, now?: number): TimerResult
```

- 在 `withLock` 内 `refreshTasks()`、取任务、计算、写入、`saveTasks()`。
- 开始：任务不存在返回 `missing`；`merged` / `cleaned` / `archivedAt` 存在返回 `closed`；已在计时则不写盘、直接返回当前任务（幂等）。
- 停止：任务不存在返回 `missing`；未计时则不写盘、直接返回；计时中则累加并删除 `workStartedAt`。
- 写入成功时更新 `updatedAt = now`，让「最近活动」反映计时操作；不改变任何状态字段。

**Runtime / HTTP / 工具**：

- `src/runtime.ts` 新增 `startTaskTimer(id)` / `stopTaskTimer(id)`：`missing` → 404「任务不存在」，`closed` → 400「已合并 / 已清理 / 已归档的任务不能开始计时」。
- 新增 `POST task/timer`，请求体 `{ id, action: 'start' | 'stop' }`；`action` 非法返回 400；成功返回 `{ ok: true, view }`。
- `worktree_act` 的 `action` 枚举新增 `timer`，并新增参数 `timer_action: 'start' | 'stop'`；`action === 'timer'` 时必须提供合法 `timer_action`。
- 任务 briefing 增加 `workMs`、`workStartedAt`（只读展示，工具侧不需要新动作）。

**客户端**：

- `src/client/stage.ts`：在「任务信息」网格中新增「工时」行。只读模式显示格式化时长与「计时中」；编辑模式显示时长、开始 / 停止按钮。计时中时用 `setInterval` 每 30 秒触发一次重渲染（卸载时清理），不请求服务端。按钮有可访问名称（包含任务标题），运行状态用 `role="status"` 文本表达，不只靠颜色。
- `src/client/board.ts`：把 `onTimer` 回调传给 `Stage`，内部 `post('task/timer', { id, action })`，成功后 `refresh()`；失败交给现有 Toast。
- `src/client/rail.ts`：任务行在 `workStartedAt` 存在时显示「计时中」chip，title 说明「从 HH:mm 开始计时」。
- `src/client/report.ts`：在截止日期之后输出「工时」行；计时中标注「计时中」。
- `src/client/project-report.ts`：任务表新增「工时」列；逐任务详情输出「工时」行。
- `src/client/format.ts` 如需复用时长格式化，直接引用 `task-timer.ts`，不要复制第二套规则。

**边界**：

- 不做自动开始 / 自动停止、不做番茄钟、不做按人统计、不做计费。
- 不做时间区间明细（只存累计值 + 当前开始时间），避免每次开始 / 停止都追加数组导致台账膨胀。
- 计时状态不进入注意力分类，不改变筛选和排序；只在行内显示 chip。
- 归档任务停止计时仍会更新 `updatedAt`，这是有意的：最后一次投入需要落账。

### 1.6 验收标准

- [ ] 旧任务（无 `workMs` / `workStartedAt`）加载不报错，显示「未记录」，状态与排序不变。
- [ ] 开始 → 停止 → 再开始 → 再停止，累计值等于两段之和；重复开始、重复停止不重复计数。
- [ ] 计时跨刷新、跨 DSH 重启保留；两个窗口同时操作时不会互相覆盖（账本锁内读改写）。
- [ ] 系统时钟回拨、`workStartedAt` 为未来时间、字段为字符串 / NaN 时，界面不出现负数、NaN、Infinity。
- [ ] `merged` / `cleaned` / 已归档任务开始计时返回 400，停止计时仍可用；错误信息为中文且前端可直接展示。
- [ ] 左栏计时中 chip、任务信息行、单任务报告、项目报告四处口径一致。
- [ ] 中英文 locale key 完全一致，`npm run check:locale` 通过。
- [ ] `npm run typecheck` 与 `npm test` 通过，测试数量增加。

### 1.7 测试要点

- 新增 `test/task-timer.test.ts`：开始 / 停止 / 幂等 / 时钟回拨 / 未来时间 / 非法字段 / 安全整数截断 / 时长格式化边界（0、59 秒、1 分、59 分、1 小时、25 小时、多天）。
- 新增 `test/task-timer-store.test.ts`：临时目录 Store，验证开始 / 停止持久化、重复操作不写盘、关闭状态拒绝开始、停止仍可用、重启后读回。
- 扩展 `test/http-flow.test.ts`：`task/timer` 成功、未认证、未知任务 404、非法 action 400、关闭任务 400。
- 扩展 `test/tools-act.test.ts`：`worktree_act` 的 `timer` 动作与参数校验。
- 扩展 `test/client-report.test.ts` 与 `test/client-project-report.test.ts`：工时行 / 列与计时中标注。

---

## 2. 任务规模估算与项目负载（Estimate + workload）

### 2.1 功能说明

任务新增可选「规模估算」，取值为 `1 / 2 / 3 / 5 / 8` 点（相对大小，不是小时）：

- 发布任务的高级选项可选择估算；任务详情「任务信息」可随时修改或清除。
- 左栏任务行显示 `3 点` 之类的 chip；未估算不显示。
- 项目洞察新增负载口径：进行中任务的估算点数总和、已估算任务数、估算覆盖率（已估算 / 进行中）。
- 单任务报告输出估算；项目报告任务表新增「估算」列。
- 估算只用于规划和展示，不参与排序、不改变状态、不阻塞合并。

### 2.2 为什么做

1.14.0 已经让任务能说明「什么时候要」（截止日期）和「先做哪个」（前置依赖），但还缺少「有多大」。没有规模，项目详情只能看到任务数量，无法判断进行中的工作是否已经超出可承载范围；也无法把「估算」和「实际工时」放在一起校准。

### 2.3 预期效果

- 用户可以在发布时或事后给任务一个 1/2/3/5/8 的相对大小，清除即回到「未估算」。
- 项目详情能看到「进行中 8 个任务 · 已估算 5 个 · 共 21 点」，一眼判断负载和估算覆盖率。
- 报告与界面口径一致；非法值在提交前或服务端被拒绝，不会写进台账。
- 旧任务、空项目、全部未估算的项目都能正常显示，不出现 NaN 或除零。

### 2.4 收益

- **可规划**：用点数而不是任务数衡量负载，避免「大任务和小任务都算 1」。
- **可校准**：与功能 1 的工时结合，逐步形成「1 点约等于多少实际投入」的经验值。
- **可沟通**：报告里的估算列让交接、周报和排期有共同语言。
- **零迁移**：字段可选，旧台账不需要任何迁移脚本。

### 2.5 实现方案

**模型与元数据**：

- `src/task-meta.ts`：

```ts
export const TASK_ESTIMATES = [1, 2, 3, 5, 8] as const
export type TaskEstimate = typeof TASK_ESTIMATES[number]

/** 合法值 → 写入；null / 空串 → 清除；其他 → invalid。 */
export function parseEstimate(value: unknown):
  | { ok: true; value: TaskEstimate | null }
  | { ok: false }
```

规则：数字或数字字符串 `1/2/3/5/8` 合法；`null`、`''`（trim 后）表示清除；`0`、负数、`4`、`true`、`'high'` 等非法。不要接受浮点数（`3.0` 字符串按 3 处理可以，但 `3.5` 非法）。

- `src/models.ts`：`WorktreeTask` 新增 `estimate?: TaskEstimate`。
- `src/store.ts`：`TaskMetaPatch` 新增 `estimate?: unknown`；`updateTaskMeta` 在写入前统一校验，新增失败原因 `estimate-invalid`；显式清除时删除字段，不写 `undefined`。
- `src/runtime.ts`：`estimate-invalid` → 400「规模估算只能是 1、2、3、5 或 8 点」。
- `src/runtime/types.ts`：`PublishInput` 新增 `estimate?: unknown`。
- `src/runtime/projects.ts`：发布前解析估算；非法值在创建分支 / worktree 之前返回 400；合法值写入任务记录。
- `src/http.ts`：`publish` 接受 `estimate`；`task/meta` 透传 `estimate`。
- `src/tools.ts`：`worktree_publish` 新增 `estimate`；`worktree_act` 的 `meta` 接受 `estimate`；briefing 返回 `estimate`。

**客户端**：

- `src/client/publish-state.ts`：草稿增加 `estimate`，切换项目 / 模板 / 续作时按现有规则重置或保留。
- `src/client/publish.ts`：高级选项新增「规模估算」下拉（未估算 / 1 / 2 / 3 / 5 / 8），提交前校验。
- `src/client/stage.ts`：任务信息新增「规模估算」行；编辑模式用下拉，选择后立即保存（与优先级一致），清除选项写 `null`。
- `src/client/rail.ts`：任务行显示 `3 点` chip；未估算不显示。
- `src/client/project-insights.ts`：扩展 `ProjectInsights`：

```ts
/** 进行中任务（未归档、未合并、未清理）的估算点数总和。 */
openEstimatePoints: number
/** 进行中且已估算的任务数。 */
estimatedOpen: number
/** 进行中但未估算的任务数。 */
unestimatedOpen: number
/** 已估算 / 进行中，整数 0..100；没有进行中任务时为 null。 */
estimateCoveragePercent: number | null
```

  只统计合法估算值；非法 / 缺失按未估算处理；进行中口径与 `open` 完全一致。
- `src/client/project-detail.ts`：项目洞察卡片增加一行负载提示，例如「进行中 8 个 · 已估算 5 个 · 共 21 点」；没有进行中任务时显示「暂无进行中任务」。
- `src/client/report.ts`：单任务报告输出「规模估算」行（未估算显示「未估算」）。
- `src/client/project-report.ts`：任务表新增「估算」列，逐任务详情输出同一口径。

**边界**：

- 估算不是工期承诺，不做开始 / 结束日期推算，不做资源排班。
- 不参与排序：继续使用 `compareTaskOrder`，估算不进入排序键。
- 不做自定义点数、不做多人估算 / 投票、不做故事点历史。
- 项目负载只统计进行中任务；已合并 / 已清理 / 已归档任务不计入当前负载，但报告仍保留其估算值。

### 2.6 验收标准

- [ ] 旧任务（无 `estimate`）加载不报错，显示「未估算」，排序与状态不变。
- [ ] 发布、任务详情、`task/meta`、模型工具四条入口都能设置和清除估算；非法值被拒绝且不写入。
- [ ] 清除后字段被删除（不是写 `null` / `undefined`），重新读取仍为未估算。
- [ ] 项目洞察的负载只统计进行中任务；空项目、全部未估算、全部已估算三种情况都不出现 NaN / 除零。
- [ ] 左栏 chip、任务信息、单任务报告、项目报告四处口径一致。
- [ ] 中英文 locale key 完全一致，`npm run check:locale` 通过。
- [ ] `npm run typecheck` 与 `npm test` 通过，测试数量增加。

### 2.7 测试要点

- 扩展 `test/task-meta.test.ts`：`parseEstimate` 的合法值、数字字符串、清除、非法值、浮点 / 布尔 / 对象。
- 新增 `test/task-estimate-store.test.ts`：`updateTaskMeta` 设置 / 清除 / 非法拒绝 / 不影响其他字段 / 旧记录兼容。
- 扩展 `test/http-flow.test.ts`：`publish` 与 `task/meta` 的估算字段、非法值 400。
- 扩展 `test/client-project-insights.test.ts`：进行中口径、已估算 / 未估算计数、覆盖率、空项目、归档 / 合并 / 清理排除。
- 扩展 `test/client-report.test.ts` 与 `test/client-project-report.test.ts`：估算行 / 列。
- 扩展 `test/client-publish-state.test.ts`：草稿估算字段的初始化与重置。
- 扩展 `test/tools-act.test.ts`：发布与 meta 的估算参数。

---

## 3. 依赖关系图（Dependency graph）

### 3.1 功能说明

项目详情新增「依赖关系图」卡片：

- 把项目内任务的前置依赖画成分层有向图：每一层是「可以同时开始」的任务，箭头从前置任务指向后继任务。
- 已完成（合并 / 清理）任务弱化显示；未完成、被阻塞、缺失的前置有明确图例。
- 缺失的前置任务（已被删除或 id 对不上）以「缺失节点」显示，不让边凭空消失。
- 点击节点可跳到该任务详情；键盘用户可通过卡片下方的「按层任务列表」按钮完成同样操作。
- 没有依赖时显示空态说明，不渲染空 SVG；任务过多时最多展示 60 个真实任务，并提示已截断。

### 3.2 为什么做

1.14.0 的依赖是「点对点」的：任务行显示「等待 N 项前置」，任务详情列出前置，但用户看不到整个项目的执行顺序。当项目有 10–20 个任务时，人很难在脑中还原「哪些能并行、哪些在等、哪个是关键路径」。一张分层图能把依赖从「字段」变成「可读的结构」。

### 3.3 预期效果

- 打开项目详情就能看到任务分成几层、每层有哪些任务、箭头指向哪里。
- 缺失依赖、循环依赖（异常数据）不会让页面卡死或报错，而是用图例和提示说明。
- 点击 / 键盘操作都能从图跳到任务；空项目、无依赖项目有明确空态。
- 图形完全由已有任务记录派生，不请求 Git、不写台账、不改变任何状态。

### 3.4 收益

- **看清顺序**：分层布局直接回答「先做哪个、哪些可以并行」。
- **发现阻塞**：缺失前置、未完成前置、循环依赖在图上可见，减少「以为能开始、其实在等」。
- **降低沟通成本**：截图即可说明执行计划，不需要逐条念依赖。
- **零副作用**：纯派生视图，不引入新的持久化字段和后台任务。

### 3.5 实现方案

**纯函数模块**（新增 `src/client/dependency-graph.ts`）：

```ts
export const DEP_GRAPH_LIMIT = 60

export interface DepGraphNode {
  id: string
  title: string
  /** 任务快照状态；缺失节点为 'missing'。 */
  status: string
  done: boolean
  archived: boolean
  missing: boolean
  layer: number
  x: number
  y: number
  width: number
  height: number
  /** 该节点缺失的前置 id（仅真实任务）。 */
  missingDeps: string[]
}

export interface DepGraphEdge {
  from: string
  to: string
  /** 指向缺失节点的边。 */
  missing: boolean
  /** 异常数据形成的环上的边。 */
  cycle: boolean
}

export interface DepGraphLayer { index: number; nodeIds: string[] }

export interface DependencyGraph {
  nodes: DepGraphNode[]
  edges: DepGraphEdge[]
  layers: DepGraphLayer[]
  width: number
  height: number
  truncated: boolean
  cycles: string[][]
  total: number
  shown: number
}

export function buildDependencyGraph(views: TaskView[]): DependencyGraph
```

规则：

- 输入是**一个项目**的 `TaskView[]`（调用方传入项目详情的 `v.tasks`）；模块不关心项目边界，但服务端已保证依赖同项目。
- 真实任务按 `compareTaskOrder` 排序后截取前 `DEP_GRAPH_LIMIT` 个；`total` 是原始任务数，`shown` 是真实节点数，`truncated = total > shown`。
- 对每个真实任务的 `dependsOn`：目标存在 → 正常边；目标不存在 → 创建缺失节点（每个缺失 id 一个，标题用 id，`missing: true`），边标记 `missing`。
- 分层：Kahn 拓扑，`layer(node) = max(layer(prereq)) + 1`，无前置为 0。遇到环时，剩余节点放到当前最大层 + 1，环上的边标记 `cycle`，`cycles` 记录环上的节点 id；算法必须有迭代上限，异常数据不能死循环。
- 节点内顺序：同层按 `compareTaskOrder`，缺失节点排最后；最终用 id 兜底，保证同一输入输出稳定。
- 布局：固定 `NODE_W = 168`、`NODE_H = 40`、`GAP_X = 28`、`GAP_Y = 12`；`x = layer * (NODE_W + GAP_X)`，`y = index * (NODE_H + GAP_Y)`；不同层可做垂直居中偏移，但必须确定性、不出现负坐标。
- `width` / `height` 至少为 1，空图返回 0 节点、0 边、空层、宽高为 0，调用方据此显示空态。
- 不读时钟、不请求网络、不写任何记录。

**客户端**（`src/client/project-detail.ts`）：

- 在「项目洞察」卡片之后新增「依赖关系图」卡片；卡片头包含标题和图例（未完成 / 已完成 / 缺失 / 循环）。
- SVG：`viewBox="0 0 width height"`，`role="img"`，`aria-label` 用一句摘要（层数、任务数、缺失数、是否有环）；SVG 本身 `aria-hidden="true"`，真正的可访问入口是下方的按层列表。
- 节点：`<g>` + `<rect>` + 截断标题（超出宽度用省略号，`title` 给完整标题）；已完成节点弱化；缺失节点虚线边框；点击调用 `props.onSelectTask?.(id)`（项目详情已有该 prop）。键盘用户通过按层列表的按钮跳转。
- 边：从源节点右侧中点到目标节点左侧中点的三次贝塞尔曲线；缺失边虚线，循环边告警色。边不承载文字。
- 按层列表：每层一个分组，标题「第 N 层」，层内任务按钮显示标题与状态；按钮有可访问名称。
- 空态：项目没有任务 → 「暂无任务」；有任务但没有依赖 → 「当前项目还没有任务依赖」；截断时显示「仅展示前 60 个任务」。
- 样式加到 `src/client/styles/workbench.ts` 的 `.dshwd-depgraph*` 作用域，使用现有 token，不引入新颜色体系。

**边界**：

- 不做拖拽编辑、不做依赖图上的增删依赖（依赖仍在任务详情维护）。
- 不做跨项目依赖（服务端已禁止）；跨项目 id 一律按缺失处理。
- 不做关键路径耗时计算、不做自动排期。
- 图只展示结构，不替代任务详情里的依赖编辑。

### 3.6 验收标准

- [ ] 空项目、无依赖项目、单任务项目都能正常渲染空态，不报错、不出现空 SVG 占位。
- [ ] 线性链、菱形依赖、多根节点、多个缺失前置都能正确分层；同一输入多次渲染结果一致。
- [ ] 异常循环数据不会死循环或崩溃，环上的边有标记，页面给出提示。
- [ ] 已完成 / 已归档 / 缺失节点有可区分的视觉与文字说明，不只靠颜色。
- [ ] 点击节点和按层列表按钮都能选中对应任务；键盘可达，焦点可见。
- [ ] 超过 60 个任务时截断并提示，`total` / `shown` 正确。
- [ ] 不发起网络请求、不写台账、不改变任务状态与排序。
- [ ] 中英文 locale key 完全一致，`npm run check:locale` 通过。

### 3.7 测试要点

- 新增 `test/client-dependency-graph.test.ts`：
  - 无任务 / 无依赖 / 单链 / 菱形 / 多根 / 多前置。
  - 缺失依赖生成缺失节点与缺失边。
  - 循环数据：不死循环、`cycles` 非空、环边标记、节点仍全部输出。
  - 已完成 / 已归档节点标记正确。
  - 截断：61 个任务只输出 60 个真实节点，`truncated` 为 true。
  - 确定性：同一输入两次输出深度相等；宽高非负、无 NaN。
- 扩展 `test/client-report.test.ts` 或项目详情相关测试（如有）：图数据不影响报告输出（纯派生，不应改变现有文本）。

---

## 4. 项目风险雷达（Risk radar）

### 4.1 功能说明

项目详情新增「风险雷达」卡片：

- 对项目内**开放任务**（未归档、未合并、未清理）计算风险分，分为高 / 中 / 低三档。
- 风险因子：逾期、临近截止、停滞、被未完成前置阻塞、待验收但验收标准未核对、Git 状态异常（`broken`）。
- 卡片显示三档计数和「最该处理的 5 项」，每项列出任务标题、风险分和命中的原因；点击可跳到任务。
- 没有开放任务或没有任何风险信号时显示空态；风险分是启发式提示，不阻止任何操作、不改变任务状态。

### 4.2 为什么做

现有注意力分类（待处理 / 逾期 / 停滞 / 恢复 / 异常）是**看板级**的离散分类，回答「哪些任务需要看一眼」；项目详情已经有统计和洞察，回答「项目整体怎么样」。但项目负责人还需要一个**排序**：在 20 个开放任务里，今天最该先处理哪 3 个？风险雷达把多个信号合成一个可排序的分数，并解释「为什么它排前面」。

### 4.3 预期效果

- 打开项目详情，先看到高风险 / 中风险数量，再看到前 5 项及原因。
- 逾期且停滞、被前置阻塞、待验收但验收没核对等组合信号能被识别，而不是只显示单一分类。
- 已合并 / 已清理 / 已归档任务不参与评分；异常时间戳、缺失依赖、空验收标准不会产生 NaN 或误报。
- 评分完全由已有字段派生，不请求 Git、不写记录、不自动改优先级。

### 4.4 收益

- **可排序**：从「知道有风险」到「知道先处理哪个」。
- **可解释**：每个分数都带原因，用户能判断是误报还是真问题。
- **可组合**：把截止日期、停滞、依赖、验收、Git 异常串起来，避免用户逐个筛选。
- **零副作用**：纯派生，不新增字段、不改变状态机、不触发任何写操作。

### 4.5 实现方案

**纯函数模块**（新增 `src/client/project-risk.ts`）：

```ts
export type RiskLevel = 'high' | 'medium' | 'low' | 'none'

export type RiskReasonCode =
  | 'broken'
  | 'overdue'
  | 'due-soon'
  | 'stalled'
  | 'blocked'
  | 'criteria'

export interface RiskReason {
  code: RiskReasonCode
  /** 逾期天数 / 停滞天数 / 阻塞数量 / 未核对项数；无数字时省略。 */
  n?: number
}

export interface RiskItem {
  taskId: string
  title: string
  score: number
  level: RiskLevel
  reasons: RiskReason[]
}

export interface ProjectRisk {
  items: RiskItem[]
  high: number
  medium: number
  low: number
  /** 开放任务数（参与评分的总数）。 */
  open: number
  /** 分数降序的前 5 项。 */
  top: RiskItem[]
}

export function buildProjectRisk(views: TaskView[], now?: number): ProjectRisk
```

评分规则（可微调，但必须写进测试）：

| 因子 | 条件 | 分值 |
| --- | --- | --- |
| `broken` | 快照状态为 `broken` | +4 |
| `overdue` | 截止日期已过 | +3，另外每满 7 天 +1，最多再 +2 |
| `due-soon` | 今天 / 3 天内到期且未逾期 | +1 |
| `stalled` | 停滞天数 > 0（复用 `staleness.ts` 阈值） | +2 |
| `blocked` | 存在未完成或缺失的前置 | +2（多个前置不叠加） |
| `criteria` | 状态为 `review` / `reviewing` 且验收标准未全部核对 | +1 |

- 分数上限 10；`high >= 5`、`medium >= 3`、`low >= 1`、`none = 0`。
- 排除：`archivedAt` 存在、状态 `merged` / `cleaned` 的任务不参与评分。
- 复用现有纯函数：`dueStateOf`（`src/task-meta.ts`）、`stalledDays`（`src/client/staleness.ts`）、`dependencyStatus` / `isDependencyDone`（`src/task-deps.ts`）、`criteria` / `criteriaProgress`（`src/client/model.ts`）。不要复制阈值或判定逻辑。
- 排序：分数降序 → 截止日期升序（无截止排后）→ 创建时间升序 → id 字典序；保证稳定。
- `now` 可注入；非法 / 未来时间戳按缺失处理，不产生负数。

**客户端**（`src/client/project-detail.ts`）：

- 在「项目洞察」之后（依赖图之前或之后均可，最终顺序由主线程集成时统一）新增「风险雷达」卡片。
- 卡片头：标题 + 一句说明「按逾期、停滞、阻塞、验收缺口综合排序，不改变任务状态」。
- 三个统计块：高风险 / 中风险 / 低风险数量；`open` 为 0 时显示「暂无开放任务」。
- 前 5 项列表：标题、`score`、原因标签（本地化），点击 / 键盘激活调用 `props.onSelectTask?.(id)`。
- 原因文案由 locale 提供，使用 `fill` 替换数字；没有数字的原因不显示占位。
- 空态：无开放任务 → 「暂无开放任务」；有开放任务但 `high + medium + low === 0` → 「当前没有明显风险信号」。
- 样式加到 `src/client/styles/workbench.ts` 的 `.dshwd-risk*` 作用域，复用现有 warn / err token。

**边界**：

- 分数是启发式排序，不是 SLA、不是承诺、不是自动决策；文档中明确说明。
- 不自动修改优先级、不自动归档、不自动发通知。
- 不读取 Git 实时状态之外的新数据；`broken` 直接使用快照状态。
- 与看板注意力分类并存：注意力是全局筛选，风险雷达是项目内排序，两者可以同时使用。

### 4.6 验收标准

- [ ] 空项目、无开放任务、无风险项目都能正常显示空态，不出现 NaN。
- [ ] 每个风险因子单独命中时分数正确；组合命中时按上限截断；高 / 中 / 低分档与计数一致。
- [ ] 已合并 / 已清理 / 已归档任务不参与评分；缺失依赖、空验收标准、异常时间戳不会误报或崩溃。
- [ ] 前 5 项排序稳定，原因文案本地化，点击 / 键盘可跳到任务。
- [ ] 不写台账、不请求网络、不改变任务状态、排序或优先级。
- [ ] 中英文 locale key 完全一致，`npm run check:locale` 通过。

### 4.7 测试要点

- 新增 `test/client-project-risk.test.ts`：
  - 单因子：`broken`、逾期（含 7 天 / 14 天封顶）、临近截止、停滞、阻塞、验收缺口。
  - 组合因子与 10 分上限；`high` / `medium` / `low` 分档边界（4/5、2/3、0/1）。
  - 排除归档 / 合并 / 清理；缺失前置、空标准、异常时间戳。
  - 排序稳定性与 `top` 截断；空输入；`now` 注入。
- 扩展 `test/client-project-insights.test.ts` 如复用统计口径，确保两卡片不互相影响（只读派生）。

---

## 5. 保存的筛选视图（Saved views）

### 5.1 功能说明

左栏新增「视图」下拉：

- 可以把当前的搜索文本、注意力筛选、标签筛选和「显示已归档」开关保存为一个命名视图（最多 20 个，名称最长 40 字符）。
- 选择视图即可一次性恢复这四项状态；手动修改任一条件后，下拉回到「自定义」，不会悄悄覆盖已保存的视图。
- 同名保存视为更新该视图（保留原 id 和创建时间）；可删除当前视图。
- 视图保存在浏览器 `localStorage`（key `dshw-board:saved-views:v1`），刷新、重启浏览器后仍在；不写入任务台账，不同步到其他机器。
- 损坏的存储内容、超限、空名称、非法筛选值都被安全处理：忽略坏条目、给出明确错误，不阻塞看板。

### 5.2 为什么做

看板已经有搜索语法、标签筛选、注意力筛选和归档开关，但每次重新打开工作台都要重新组合一遍。对每天使用同一套筛选（例如「待验收 + 高优先级标签」「逾期 + 停滞」「我的项目 + 未归档」）的用户，这是一笔重复成本。1.14.0 明确把「保存搜索视图」列为不做的事，本批次补上这个缺口，同时保持纯客户端、零服务端风险。

### 5.3 预期效果

- 用户保存一次「逾期 + 前端标签」视图，之后下拉一键恢复，搜索框、筛选按钮、标签下拉、归档开关同时到位。
- 保存后刷新页面仍在；同一浏览器的多个窗口共享（localStorage 同源）；换机器不同步，文档中说明。
- 存储损坏、配额不足、名称非法时，看板仍可用，用户看到可理解的提示。
- 视图不会自动更新任务集合：它保存的是筛选条件，不是任务快照；任务变化后重新应用即可。

### 5.4 收益

- **省时间**：常用筛选从「四次操作」变成「一次选择」。
- **可复用**：把个人工作流固化下来，减少记忆负担。
- **零服务端风险**：不新增路由、不写台账、不改任务状态，失败也只影响本机视图。
- **可回滚**：删除 localStorage key 即完全恢复原状。

### 5.5 实现方案

**纯函数模块**（新增 `src/client/saved-views.ts`）：

```ts
export const SAVED_VIEW_LIMIT = 20
export const SAVED_VIEW_NAME_MAX = 40

export interface ViewState {
  query: string
  filter: BoardFilter
  tag: string
  showArchived: boolean
}

export interface SavedView extends ViewState {
  id: string
  name: string
  createdAt: number
}

export function normalizeViewName(value: unknown): string | null
export function isViewState(value: unknown): value is ViewState
export function createSavedView(
  state: ViewState,
  name: unknown,
  options?: { now?: number; id?: string },
): { ok: true; view: SavedView } | { ok: false; reason: 'name-empty' | 'name-too-long' | 'limit' | 'state-invalid' }
export function sanitizeSavedViews(raw: unknown): SavedView[]
export function parseSavedViews(text: string | null): SavedView[]
export function serializeSavedViews(views: SavedView[]): string
export function sameViewState(view: SavedView, state: ViewState): boolean
export function upsertSavedView(views: SavedView[], view: SavedView): SavedView[]
export function removeSavedView(views: SavedView[], id: string): SavedView[]
```

规则：

- `BoardFilter` 的合法值从 `src/client/model.ts` 新导出的 `BOARD_FILTERS` 读取（`all` + 全部 `AttentionCategory`），不要在 `saved-views.ts` 手写第二份列表；`isBoardFilter` 一并导出，Rail 与校验共用。
- 名称：`String(value).trim()`，空 → `name-empty`，超过 40 字符 → `name-too-long`；不做大小写转换，但同名判断忽略大小写和首尾空白。
- `query` / `tag` 截断到合理长度（query 最多 200 字符，tag 最多 24 字符），避免存储膨胀；`showArchived` 必须是布尔值，否则该条目丢弃。
- `sanitizeSavedViews`：非数组 → `[]`；逐条校验，丢弃坏条目；id 去重（保留第一条）；按 `createdAt` 升序后截取前 20 条；`createdAt` 非法按 0。
- `parseSavedViews`：`try/catch` JSON 解析，任何异常返回 `[]`，不抛给调用方。
- `createSavedView`：未提供 id 时用 `view-<now base36>-<随机后缀>`；`limit` 只有在 `views` 已满时由调用方判断（纯函数不持有列表时可不返回该原因，具体以实现为准，但 UI 必须限制 20 个）。
- `upsertSavedView`：同 id 替换；否则按名称忽略大小写查重，命中则替换内容但保留 id / createdAt；都未命中则追加；最后截取 20 条。
- `sameViewState`：四项严格相等（query 按 trim 后比较，filter / tag / showArchived 精确比较）；用于判断「当前是否仍是某个已保存视图」。
- 不依赖 React、不直接访问 `window`；存储适配器单独一层，便于测试。

**存储适配器**（新增 `src/client/view-storage.ts`）：

```ts
export const SAVED_VIEWS_KEY = 'dshw-board:saved-views:v1'

export function loadSavedViews(storage?: Storage | null): SavedView[]
export function saveSavedViews(views: SavedView[], storage?: Storage | null): { ok: true } | { ok: false; error: string }
```

- `storage` 默认取 `window.localStorage`，但用 `try/catch` 包裹：隐私模式 / 配额不足 / 被禁用时返回空列表或 `{ ok: false }`，不抛异常。
- 读取时调用 `parseSavedViews`；写入时 `serializeSavedViews`，失败返回可展示的错误。

**看板与左栏**：

- `src/client/board.ts`：
  - 初始化 `savedViews`（惰性 `useState` 从 `loadSavedViews()` 读取）。
  - 派生当前视图状态 `{ query, filter, tag: tagFilter, showArchived }`；用 `savedViews.find(v => sameViewState(v, state))` 得到 `activeViewId`，不额外维护「激活 id」状态，手动修改后自动回到自定义。
  - `applyView(view)`：依次 `setQuery` / `setFilter` / `setTagFilter` / `setShowArchived`；如果视图里的标签已不存在，现有 effect 会自动清空标签筛选，不额外处理。
  - `saveView(name)`：`createSavedView` → `upsertSavedView` → 持久化 → 成功 Toast；失败（空名 / 超长 / 存储失败）返回错误给对话框。
  - `deleteView(id)`：`removeSavedView` → 持久化 → Toast。
  - 把 `savedViews`、`activeViewId`、`onApplyView`、`onSaveView`、`onDeleteView` 传给 `Rail`。
- `src/client/rail.ts`：
  - 搜索框下方新增一行：`<select>`（选项「自定义」+ 保存的视图名称，`aria-label` 为「保存的视图」）、「保存视图」按钮；当前有激活视图时显示「删除视图」按钮。
  - 保存对话框使用现有 `Modal` 原语（或与宿主一致的轻量对话框）：名称输入、保存 / 取消、空名与超长错误 `role="alert"`、保存中禁用、Escape 关闭、关闭后焦点回到「保存视图」按钮。
  - 视图下拉为空时只显示「自定义」，不显示空分组。
- `src/client/styles/workbench.ts`：新增 `.dshwd-view-*` 样式，复用现有控件高度与 token。

**边界**：

- 视图只保存筛选条件，不保存选中任务、不保存滚动位置、不保存任务快照。
- 不做跨设备同步、不做服务端共享、不做视图排序拖拽。
- 不做「视图自动更新」：任务集合变化后，视图按当前条件重新过滤。
- localStorage 不可用时，视图功能降级为「本会话内存」还是完全隐藏？本批次选择**仍可用但提示无法持久化**：保存成功后在内存中生效，Toast 说明「仅本次会话有效」。实现时若判断复杂，可退化为禁用保存并提示，但不得抛异常。

### 5.6 验收标准

- [ ] 保存视图后，搜索、注意力筛选、标签、归档开关四项状态一次恢复；手动修改任一项后下拉显示「自定义」。
- [ ] 同名保存更新原视图（id / 创建时间不变），不同名追加；最多 20 个，超出时给出明确提示。
- [ ] 刷新页面、重启浏览器后视图仍在；损坏 JSON、非数组、坏条目、重复 id 不导致看板崩溃。
- [ ] 空名称、超长名称、非法筛选值被拒绝或丢弃，错误可读；不写入坏数据。
- [ ] localStorage 不可用 / 配额不足时不抛异常，看板其余功能正常。
- [ ] 视图下拉、保存对话框、删除按钮键盘可达，有可访问名称，Escape 关闭并恢复焦点。
- [ ] 不新增 HTTP 路由、不写台账、不改变任务状态与排序。
- [ ] 中英文 locale key 完全一致，`npm run check:locale` 通过。

### 5.7 测试要点

- 新增 `test/client-saved-views.test.ts`：
  - `normalizeViewName` 空 / 空白 / 超长 / 正常。
  - `isViewState` 合法 / 缺字段 / 非法 filter / 非布尔 showArchived。
  - `createSavedView` 成功 / 空名 / 超长 / 非法状态 / 注入 now 与 id。
  - `sanitizeSavedViews` 非数组 / 坏条目 / 重复 id / 超 20 条 / 非法 createdAt。
  - `parseSavedViews` 损坏 JSON / `null` / 空串；`serializeSavedViews` 往返。
  - `sameViewState` 四项相等 / 任一不同 / query trim。
  - `upsertSavedView` 同 id 替换 / 同名更新保留 id / 新增 / 截断；`removeSavedView` 删除 / 不存在。
- 新增 `test/client-view-storage.test.ts`：用内存 Storage mock 验证读取 / 写入 / 抛异常降级 / 损坏内容。
- 扩展 `test/client-model.test.ts`：`BOARD_FILTERS` 覆盖全部 `AttentionCategory` 且无重复。

---

## 6. 通用实现约定

1. **共享纯函数优先**：工时、规模、依赖图、风险、视图都放在无 DOM 的纯模块里；服务端与客户端共用同一套规则，不要在多个文件复制。所有涉及「现在」的函数接受可注入的 `now`。
2. **原子写**：所有任务字段写操作走 Store 的 `withLock` + `refreshTasks` + `saveTasks`；HTTP / Runtime 只做校验与错误映射。工时的开始 / 停止也必须走同一把账本锁。
3. **可选字段**：不写 `undefined` 键；清空即删除字段（沿用 `putTask` / `setTaskPinned` / `updateTaskMeta` 的约定）。旧记录读取时按「未计时 / 未估算」处理。
4. **错误语义**：校验失败 400，任务不存在 404，关闭任务开始计时 400；错误信息使用中文，前端直接展示。
5. **排序唯一入口**：继续使用 `compareTaskOrder`；估算、工时、风险分都不参与排序。
6. **文案**：所有新文案同时加入 `locale/zh.json` 与 `locale/en.json`，key 集合一致；`npm run check:locale` 必须通过。
7. **可访问性**：计时按钮、估算下拉、视图下拉、保存对话框、依赖图按层列表、风险跳转按钮都必须有可访问名称；错误用 `role="alert"`；保存中禁用；不引入仅靠颜色表达的状态。
8. **不新增依赖**：不引入日期库、图表库、DAG 库、状态管理库或 UI 库；继续使用现有原语与手写样式。只新增 `POST task/timer` 一个路由。
9. **文档同步由主线程完成**：实施者不要修改 `README.md`、`CHANGELOG.md`、`docs/`、`package.json`、`package-lock.json`、`feature.md`；这些由主线程在集成时统一更新到 1.15.0。
10. **最小 diff**：不重排现有代码、不重命名既有函数、不格式化整文件；共享文件只改本功能需要的行。
11. **测试**：每个功能至少一个新增测试文件；必要时扩展已有测试。不要复制已有断言，不要依赖系统时钟（使用可注入的 `now`）。新增测试文件名按第 1–5 节指定，避免与现有文件重名。
12. **实施边界**：每个子 agent 只实现自己负责的第 1–5 节之一；完成前运行 `npm run typecheck` 与 `npm test`（node_modules 缺失时先 `npm ci`），失败必须修复；最后只提交一次，并在结果中报告分支名、HEAD SHA、变更文件与测试数量。不要 push，不要创建 PR。

---

## 7. 批次验收标准

- [x] 5 个功能均可从 UI 或模型工具触发；未计时 / 未估算 / 无依赖 / 无风险 / 未保存视图时，行为与 1.14.0 一致。
- [x] `workMs` / `workStartedAt` 在开始、停止、刷新、重启、双实例场景下不丢失、不重复计数、不出现负数。
- [x] `estimate` 在发布、详情编辑、`task/meta`、模型工具四条入口下都能设置 / 清除；非法值被拒绝。
- [x] 依赖关系图在空项目、旧记录、缺失依赖、循环异常数据下不报错、不死循环、不出现 NaN。
- [x] 风险雷达在空项目、旧记录、异常时间戳、缺失依赖、空验收标准下不报错、不出现 NaN / 负分。
- [x] 保存视图在损坏 localStorage、超限、空名称、非法筛选值下不阻塞看板；四项筛选一次恢复。
- [x] 截止日期、依赖、估算、工时、注意力筛选、标签筛选、归档开关互相兼容；组合结果正确。
- [x] 旧任务记录（无新字段）加载不报错，排序与状态不变。
- [x] `npm run check:locale` 通过；中英文 key 完全一致。
- [x] `npm run verify`（typecheck + locale + 测试 + 构建）通过，测试数量不少于当前基线的 **560** 项并有所增加（目标 600–640 项；实际 645 项）。
- [x] README、CHANGELOG、docs/frontend-design.md、docs/i18n-terminology.md、package.json、package-lock.json 由主线程更新到 1.15.0。
- [x] 不引入新依赖；只新增 `task/timer` 路由；现有接口语义只做可选字段扩展。

---

## 8. 风险、边界与回滚

- **工时字段兼容**：`workMs` / `workStartedAt` 全部可选；读取时不假设存在；旧版本看到新字段会忽略，不影响状态机。
- **工时时钟异常**：系统时钟回拨、未来时间、字段损坏都按 0 / 未计时处理；不做自动纠正，不写负数。
- **工时并发**：开始 / 停止在账本锁内完成，两个窗口同时点只会有一个生效；重复开始 / 停止幂等，不重复计数。
- **工时语义**：只记录用户主动开始到停止的区间，不推断「Agent 在跑 = 人在投入」；不做自动开始 / 停止。
- **估算兼容**：`estimate` 可选；清除即删除字段；旧版本忽略；估算不参与排序、不阻塞合并。
- **估算校验**：服务端在创建分支 / worktree 之前校验发布参数；`task/meta` 在锁内校验，非法值不落盘。
- **依赖图异常数据**：循环、缺失、跨项目 id 都按「安全展示」处理；算法有迭代上限；缺失节点不伪造任务记录。
- **依赖图规模**：最多 60 个真实节点，超出截断并提示；不做虚拟滚动。
- **风险评分口径**：分值是启发式排序，不是 SLA；权重写在文档与测试中，后续调整需同步更新测试与文案。
- **风险与注意力并存**：注意力是看板级筛选，风险是项目内排序；两者不互相写入，不互相阻塞。
- **视图存储**：localStorage 可能被禁用、配额不足或内容损坏；读取失败返回空列表，写入失败给出提示；不把坏数据写回。
- **视图共享**：同一浏览器同源窗口共享 localStorage；跨设备 / 跨机器不同步；不写入任务台账，不参与服务端并发控制。
- **集成冲突**：本批次预计在 `stage.ts`、`rail.ts`、`project-detail.ts`、`store.ts`、`http.ts`、`tools.ts` 与 locale 文件产生 cherry-pick 冲突；主线程按功能顺序集成，逐段保留双方新增内容，不重排无关代码。
- **回滚**：
  - 工时：移除任务信息行、左栏 chip 与报告行即可；字段留在记录中不影响旧版本。
  - 估算：移除发布 / 详情 / 洞察 / 报告入口即可；字段留在记录中不影响旧版本。
  - 依赖图：移除卡片与 `dependency-graph.ts` 即可。
  - 风险雷达：移除卡片与 `project-risk.ts` 即可。
  - 保存视图：移除下拉与对话框，或删除 localStorage key 即可；不影响台账。
- **不做的事**：不做自动计时 / 番茄钟 / 计费、不做自定义点数 / 多人估算、不做依赖图拖拽编辑 / 关键路径耗时、不做风险自动处置 / 通知、不做视图跨设备同步 / 任务快照。

---

## 9. 文件清单

| 文件 | 改动 |
| --- | --- |
| `src/task-timer.ts` | 新增：工时纯函数（累计、开始、停止、格式化） |
| `src/task-meta.ts` | 新增：`TASK_ESTIMATES` / `TaskEstimate` / `parseEstimate` |
| `src/models.ts` | `WorktreeTask` 增加 `workMs` / `workStartedAt` / `estimate` |
| `src/store.ts` | `TaskMetaPatch` 增加 `estimate`；新增 `startTaskTimer` / `stopTaskTimer`；`TimerResult` |
| `src/runtime.ts` | 工时动作与 `estimate-invalid` 错误映射 |
| `src/runtime/types.ts` | `PublishInput` 增加 `estimate` |
| `src/runtime/projects.ts` | 发布时校验并写入 `estimate` |
| `src/http.ts` | 新增 `task/timer`；`publish` / `task/meta` 透传 `estimate` |
| `src/tools.ts` | `worktree_publish` 增加 `estimate`；`worktree_act` 增加 `timer` 动作与 `meta` 估算 |
| `src/client/model.ts` | 导出 `BOARD_FILTERS` / `isBoardFilter`（视图校验共用） |
| `src/client/publish-state.ts` | 草稿增加 `estimate` |
| `src/client/publish.ts` | 高级区规模估算下拉 |
| `src/client/stage.ts` | 任务信息增加工时行与规模估算行；计时 30 秒刷新 |
| `src/client/work-format.ts` | 新增：把当前语言字典映射为工时单位模板（界面与报告共用） |
| `src/client/rail.ts` | 计时中 chip、估算 chip、保存视图下拉 / 对话框 |
| `src/client/board.ts` | 计时回调、保存视图状态与持久化接线 |
| `src/client/project-insights.ts` | 负载口径（进行中点数 / 已估算 / 覆盖率） |
| `src/client/project-detail.ts` | 洞察卡片负载提示、依赖图卡片、风险雷达卡片 |
| `src/client/dependency-graph.ts` | 新增：依赖图分层布局纯函数 |
| `src/client/project-risk.ts` | 新增：风险评分纯函数 |
| `src/client/saved-views.ts` | 新增：视图校验 / 序列化纯函数 |
| `src/client/view-storage.ts` | 新增：localStorage 适配器 |
| `src/client/report.ts` | 单任务报告增加工时 / 估算 |
| `src/client/project-report.ts` | 项目报告增加工时 / 估算列与逐任务行 |
| `src/client/styles/workbench.ts` | 依赖图、风险雷达、保存视图样式 |
| `locale/zh.json`、`locale/en.json` | 新增文案（key 集合一致） |
| `test/task-timer.test.ts` | 新增：工时纯函数用例 |
| `test/task-timer-store.test.ts` | 新增：工时 Store 用例 |
| `test/task-estimate-store.test.ts` | 新增：估算 Store 用例 |
| `test/client-dependency-graph.test.ts` | 新增：依赖图布局用例 |
| `test/client-project-risk.test.ts` | 新增：风险评分用例 |
| `test/client-saved-views.test.ts` | 新增：视图纯函数用例 |
| `test/client-view-storage.test.ts` | 新增：存储适配器用例 |
| `test/task-meta.test.ts` | 扩展：估算解析 |
| `test/http-flow.test.ts` | 扩展：`task/timer`、估算字段 |
| `test/tools-act.test.ts` | 扩展：计时动作、估算参数 |
| `test/client-project-insights.test.ts` | 扩展：负载口径 |
| `test/client-publish-state.test.ts` | 扩展：草稿估算 |
| `test/client-report.test.ts` | 扩展：工时 / 估算行 |
| `test/client-project-report.test.ts` | 扩展：工时 / 估算列 |
| `test/client-model.test.ts` | 扩展：`BOARD_FILTERS` |
| `README.md`、`CHANGELOG.md`、`docs/frontend-design.md`、`docs/i18n-terminology.md` | 主线程更新到 1.15.0 |
| `package.json`、`package-lock.json` | 主线程更新到 1.15.0 |

---

## 10. 验收记录

- **状态**：已实施，主线程集成与验收通过。

### 10.1 实施来源

| 功能 | 子 agent 分支 | 子 agent HEAD | 集成提交 |
| --- | --- | --- | --- |
| 工时计时 | `t3/task-work-timer` | `195c133d5f92d6fb6cf8c5f60535cb5e0fc8c77b` | `557c266fe755775c1e31df6c83cc9674de824f3e` |
| 规模估算与负载 | `t3/task-estimate-load` | `f0031f53524a1c03af97f6d450cac5fb6c6ad178` | `5046cb3927eb97ebf154b8f68624badf627449f5` |
| 依赖关系图 | `t3/dependency-graph` | `5e391e9de90af621cb2fc5dae6fe03774a678ee4` | `92fa563f5c96d61e6ecabdd68e6e8859ef55119c` |
| 风险雷达 | `t3/project-risk-radar` | `b0fa9e18ac6e41e6f4da50c807daa9b70f438976` | `87326ad9d5243dd185512080192dc6a520929e34` |
| 保存的筛选视图 | `t3/saved-filter-views` | `392afb0cd6084650846597657fca9337c7885523` | `71150e23e45d9f3f7a8d647f81f6958a534db239` |

集成顺序按改动面从小到大（依赖图 → 估算 → 视图 → 风险 → 工时），每个子 agent 只交一个提交；主线程逐个 `cherry-pick`，冲突处保留双方字段与渲染分支。

### 10.2 主线程复核修正

- **共享模型**：`src/models.ts` 同时保留 `estimate` 与 `workMs` / `workStartedAt`；旧记录不迁移。
- **Store**：`src/store.ts` 的 task-meta 导入同时保留 `parseEstimate` 与 `isWorkTiming` / `startWorkTimer` / `stopWorkTimer`；计时开始 / 停止都在 `withLock` 内完成，重复操作不写账本，关闭任务拒绝开始但允许停止。
- **工具层**：`src/tools.ts` 的 briefing 同时返回 `estimate`、`workMs`、`workStartedAt`；`worktree_act` 同时接受 `estimate` 与 `timer_action`，`timer` 动作校验参数并映射 400 / 404。
- **任务信息与左栏**：`stage.ts` 与 `rail.ts` 的导入合并估算、计时与保存视图依赖；任务信息保留「估算 → 截止 → 工时」顺序，左栏同时显示计时 chip、估算 chip 与保存视图下拉。
- **报告**：单任务报告同时输出「规模估算」与「工时」行；项目报告任务表列顺序统一为 `序号 / 状态 / 任务 / 分支 / 验收 / 优先级 / 估算 / 截止 / 工时 / 标签 / 最近活动`，表头、分隔行、数据行与每任务详情同步调整。
- **测试**：`test/http-flow.test.ts` 拼接估算与计时的 publish / meta / timer 用例；`test/client-project-report.test.ts` 的期望表头与行数据加入估算 / 工时两列，并修正前缀匹配顺序。
- **文案**：locale 自动合并后统一为 `zh=855` / `en=855`；`docs/i18n-terminology.md` 的键名与占位符按实际 locale 修正（`taskWorkEmpty` / `taskWorkTiming` / `taskEstimateEmpty` / `depGraphHasCycle` / `riskRadar` / `savedViewSelect` 等，移除不存在的 `{points}`）。
- **独立复核修正（英文工时单位）**：复核发现英文报告仍输出中文「分 / 小时 / 天」。`formatWorkDuration` 改为接受 `WorkDurationUnits` 模板，新增 `src/client/work-format.ts` 把当前字典映射为模板；新增 7 个 locale 键（`taskWorkUnderMinute` / `taskWorkMinutes` / `taskWorkHours` / `taskWorkHoursMinutes` / `taskWorkDays` / `taskWorkDaysHours` / `taskWorkTimingSuffix`），界面与两份报告共用。英文报告现在输出 `45 min` / `2 h 15 m (Timing)`，并有单任务与项目报告双侧测试。
- **独立复核修正（依赖图可访问性）**：依赖图 SVG 原同时带 `role="img"` / `aria-label` 与 `aria-hidden="true"`，语义矛盾；改为纯装饰 SVG（仅 `aria-hidden`），图摘要移到卡片可见提示行，键盘与读屏入口仍是下方按层任务列表。
- 复核提出的其余 nit（保存视图对话框同步 busy 状态、项目详情纯函数未 memo、`upsertSavedView` 对纯空白名字的回退）不影响正确性或性能，留待后续清理。

### 10.3 验证结果

- `npm run typecheck`：通过。
- `npm run check:locale`：通过，`zh=855 en=855`，客户端引用 625 个键。
- `npm test`：645 项全部通过，0 失败；基线 560 项，净增 85 项。
- `npm run build`：通过，`dist/index.js` 与 `dist/client.js`（649.5kb）生成。
- `npm run verify`：通过（typecheck + locale + 645 项测试 + 构建）。
- 集成提交后工作区无冲突标记，`git diff --check` 无空白错误。

### 10.4 验收审批

- 独立 reviewer：`delegate_task` + `role: review`，模型 `mm/workbuddy/glm-5.3[1m]`（实际运行 `mm/workbuddy/glm-5.3`），只读，不共享主线程推理。
- 复核结论：**可合并**，未发现 blocker / major；1 个 minor（英文报告工时单位仍为中文）已在合并前修复，1 个可访问性 nit（依赖图 SVG 语义矛盾）已修复，其余 3 个 nit 记录在 10.2 并留待后续。
- reviewer 在复核时独立运行 `typecheck`、`check:locale`、643 项测试、构建与 `git diff --check`，并对风险雷达、依赖图、保存视图、工时格式化做了定向验证；修复后主线程复跑 `npm run verify`，645 项测试通过。

### 10.5 PR

- 分支：`t3/daily-five-feature-pipeline`
- PR：https://github.com/5918vo/dsh-worktree/pull/30
