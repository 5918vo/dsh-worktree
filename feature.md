# 每日功能批次 · 2026-11-23 · v1.14.0

> 批次主题：**任务规划、检索、度量与追溯**（让任务在「发布之后」也能被安排时间、说明依赖、按条件找到、用数据回看、按时间复盘）
>
> 交付方式：一个 PR（`t3/daily-5-feature-pipeline` → `master`），5 个功能同批验收。
>
> 分工：主线程负责方案、任务拆分、集成、验收、文档与 PR；5 个 `pi` 子 agent 分别负责 5 个功能的编码落地与测试。上一批次（1.13.0 标签 / 优先级 / 备注 / 项目报告 / 停滞检测）的文档见 git 历史。
>
> 状态：已规划 / 实施中（验收记录见第 10 节）。

## 0. 批次总览

| # | 功能 | 一句话价值 | 主要落点 |
| --- | --- | --- | --- |
| 1 | 任务截止日期 | 给任务一个「什么时候要」，逾期自动进入注意力视图 | 模型 / Store / HTTP / 发布弹窗 / 任务信息 / 左栏 / 注意力 / 报告 |
| 2 | 前置任务依赖 | 标明「先做哪个」，未完成的前置任务在行内与详情中可见 | 模型 / Store / HTTP / 任务信息 / 左栏 / 工具 |
| 3 | 项目洞察 | 用已有时间戳算出周期、吞吐与验收核对率 | 纯函数 / 项目详情 / 文案 |
| 4 | 结构化搜索 | 用 `tag:` / `priority:` / `status:` 精确找任务，纯文本搜索不变 | 纯函数 / 左栏模型 / 搜索框 / 文案 |
| 5 | 任务生命周期时间线 | 把发布、置顶、合并、清理、归档、最近更新串成一条可复盘的时间线 | 纯函数 / 概览 / 验收报告 / 文案 |

设计原则：

- **全部字段可选，旧台账零迁移**：`dueAt`、`dependsOn` 都是可选字段；没有这些字段的旧任务按「无截止日期 / 无前置任务」处理。
- **元数据统一走一个原子入口**：截止日期与前置依赖继续复用 `Store.updateTaskMeta` 与 `POST task/meta`，在跨进程账本锁内读改写，两个 DSH 实例不会互相覆盖。
- **不改变任务状态机**：新功能只增加展示字段、派生视图和编辑入口，不改变 `statusOf` 的任何分支，也不改变 Git / 会话行为。
- **默认不打扰**：没有截止日期不显示 chip，没有前置任务不显示依赖行，没有结构化 token 时搜索行为与 1.13.0 完全一致。
- **不引入依赖、不加新路由**：不新增 npm 包，不新增 HTTP 路由；只扩展 `task/meta` 与 `publish` 的可选字段。
- **文档即验收**：每个功能都必须有功能说明、动机、预期效果、收益、实现方案、验收标准和测试要点。

---

## 1. 任务截止日期（`dueAt`）

### 1.1 功能说明

任务新增可选截止日期。语义是**本地日历日**，存储为当天本地零点的毫秒时间戳。入口与展示：

1. **发布任务**：高级选项新增「截止日期」`<input type="date">`；发布成功写入任务。
2. **任务详情**：「任务信息」分区新增「截止日期」行，可设置、修改、清除；写入后左栏立即刷新。
3. **左栏任务行**：逾期显示「逾期 N 天」（err 色），今天到期显示「今天到期」（warn 色），未来 1–3 天显示「N 天后到期」（warn 色），更远不显示 chip。
4. **注意力视图**：逾期任务进入新的「逾期」分类与筛选，并计入顶部汇总条的计数；**不产生重复的 alert chip**（行内 chip 已直接显示）。
5. **验收报告**：单任务报告与项目验收报告都输出截止日期；逾期时附带「逾期 N 天」。
6. **模型工具**：`worktree_publish` 接受 `due_at`（`YYYY-MM-DD`），`worktree_act` 的 `meta` 动作接受 `due_at`（`null` / 空串清除）。

### 1.2 为什么做

现有看板能回答「任务在哪个状态、有没有会话、有没有提交」，但回答不了「这批任务里哪个最晚必须交付」。标签和优先级表达的是分类与轻重，不是时间；停滞检测只能事后发现「很久没动」，不能提前提醒「明天到期」。截止日期是最小、最通用、最容易被用户理解的时间维度，并且可以完全复用现有元数据写入链路，不需要后台任务或通知系统。

### 1.3 预期效果

- 今天 2026-11-23，任务截止 2026-11-20：行内显示「逾期 3 天」，左栏筛选「逾期」计数 +1，顶部汇总条显示「N 个任务逾期」。
- 任务截止 2026-11-23：行内显示「今天到期」，不计入逾期。
- 任务截止 2026-11-25：行内显示「2 天后到期」，不计入逾期。
- 任务截止 2026-12-10：不显示截止 chip，但详情与报告仍能查到日期。
- 没有 `dueAt` 的任务：行为与 1.13.0 完全一致，不出现任何占位 chip。
- 清除截止日期后 `dueAt` 键被删除（不是写 `null`），刷新页面仍为空。
- 非法值（`2026-02-30`、`not-a-date`、负数）返回 400，且不写入记录。

### 1.4 收益

- **对用户**：发布时就能约定交付日，左栏直接看到「今天到期 / 已逾期」，不用逐个点开。
- **对团队**：验收报告带截止日期，交接时能说明时间承诺；逾期任务进入注意力筛选，批次收尾前可以先处理逾期项。
- **对插件**：注意力模型从「会话 / 合并 / 停滞」扩展到「计划时间」，为后续到期提醒、日历视图留下纯函数基础。
- **风险可控**：纯展示字段 + 派生视图，不参与状态推导；不设置截止日期时零行为变化。

### 1.5 实现方案

#### 1.5.1 共享纯函数（`src/task-meta.ts`）

新增以下导出，全部不依赖 DOM / Node API：

```ts
export const DUE_SOON_DAYS = 3

export type DueParse = { ok: true; value: number | null } | { ok: false }

/** 本地日历日的零点（毫秒）。非有限数返回 0。 */
export function startOfLocalDay(value: number): number

/**
 * 解析截止日期。
 * - null / undefined / '' -> { ok: true, value: null }（表示清除）
 * - number：有限且 > 0 -> 归一到本地零点；否则 ok: false
 * - 'YYYY-MM-DD'：按本地日历解析并回读校验（2026-02-30 必须失败）
 * - 其他字符串：Date.parse 后归一到本地零点；NaN -> ok: false
 */
export function parseDueAt(value: unknown): DueParse

/** dueAt 与 now 的日历日差（due - today）。非法输入返回 null。 */
export function dueDayOffset(dueAt: number | null | undefined, now?: number): number | null

export type DueKind = 'overdue' | 'today' | 'soon' | 'later'
export interface DueState {
  kind: DueKind
  /** 逾期时为逾期天数（正数）；未到期时为距今天数。 */
  days: number
}

/** 派生展示状态；没有截止日期或非法值返回 null。 */
export function dueStateOf(dueAt: number | null | undefined, now?: number): DueState | null

/** `<input type="date">` 的值：本地 YYYY-MM-DD；空值返回 ''。 */
export function dueInputValue(dueAt: number | null | undefined): string
```

规则：

- 日历日差用「本地年月日 -> `Date.UTC` -> 除以 86400000」计算，避免夏令时导致的 23/25 小时误差。
- `dueStateOf`：offset `< 0` -> `overdue`，`days = -offset`；`0` -> `today`；`1..DUE_SOON_DAYS` -> `soon`；其余 -> `later`。
- `dueInputValue` 必须补零；非法值返回 `''`。
- 不修改 `compareTaskOrder`：截止日期不改变排序。

#### 1.5.2 数据模型（`src/models.ts`）

```ts
export interface WorktreeTask {
  // ...
  /** 可选截止日期：本地日历日零点的毫秒时间戳。 */
  dueAt?: number
}
```

#### 1.5.3 Store（`src/store.ts`）

- `TaskMetaPatch` 增加 `dueAt?: unknown`。
- `TaskMetaResult` 的失败原因增加 `'due-invalid'`。
- `updateTaskMeta` 内：
  - `has('dueAt')` 时调用 `parseDueAt(patch.dueAt)`；`ok: false` 返回 `{ ok: false, reason: 'due-invalid' }`。
  - `value === null` 时 `delete task.dueAt`，否则 `task.dueAt = value`。
  - 与现有字段一致：只有实际处理了字段才更新 `updatedAt` 并 `saveTasks()`。
  - 校验失败时不能留下半写入状态（沿用现有「先全部归一化 / 校验，再写记录」的结构）。

#### 1.5.4 Runtime / HTTP / 工具

- `src/runtime.ts` 的 `updateTaskMeta` 错误映射增加：
  - `due-invalid` -> `截止日期无效`，HTTP 400。
- `src/http.ts` 的 `act('meta')` 增加：
  ```ts
  if (Object.prototype.hasOwnProperty.call(body, 'dueAt')) patch.dueAt = body.dueAt
  ```
- `src/tools.ts`：
  - `worktree_publish` 参数增加 `due_at`（string，`YYYY-MM-DD`），透传到 `runtime.publish`。
  - `worktree_act` 参数增加 `due_at`（string 或 null），`meta` 动作映射为 `patch.dueAt`。
  - `brief()` 输出增加 `dueAt: Number(v.task.dueAt) || 0`（没有时为 0）。

#### 1.5.5 Runtime 发布（`src/runtime/types.ts`、`src/runtime/projects.ts`）

- `PublishInput` 增加 `dueAt?: number | string | null`。
- `publishTask` 内用 `parseDueAt` 校验；非法时抛出 `TaskError('截止日期无效', 400)`（与现有校验风格一致）；合法且非空时写入 `task.dueAt`。

#### 1.5.6 发布弹窗（`src/client/publish-state.ts`、`src/client/publish.ts`）

- `PublishDraft` 增加 `dueAt: string`（`<input type="date">` 的值，`''` 表示未设置）。
- `initialPublishForm`：`dueAt: String(d.dueAt || '')`；`publishDraftDirty` 比较该字段。
- `publish.ts`：
  - 读取 `form0.dueAt`，增加 `const [dueAt, setDueAt] = React.useState(form0.dueAt)`。
  - 高级区在标签 / 优先级之后增加「截止日期」日期输入；`aria-label` 使用 `t.taskDue`。
  - `currentForm()` 带上 `dueAt`。
  - 提交前用 `parseDueAt` 校验；失败时 `fieldErrors.dueAt = t.taskDueInvalid`，并在输入框下用 `role="alert"` 展示。
  - 请求体只在 `dueAt` 非空时带 `dueAt`（传规范化后的数字或原始 `YYYY-MM-DD` 均可，服务端会归一）。
  - `advanced` 初始展开条件增加 `!!form0.dueAt`；`applyPublishTemplate` 不带截止日期（模板不覆盖时间承诺）。
  - 恢复草稿时 `initialPublishForm` 已覆盖；切换项目 / 基线不重置日期。

#### 1.5.7 任务信息（`src/client/stage.ts`）

- `StageProps.onSaveMeta` 的 patch 类型增加 `dueAt?: number | null`。
- **只读模式**（无 `onSaveMeta`）：新增一行「截止日期」，显示 `dueInputValue(task.dueAt)` 与状态 chip（逾期 / 今天 / N 天后）；未设置显示 `t.taskDueEmpty`。
- **编辑模式**：
  - 新增一行「截止日期」：`<input type="date">` + 「清除」按钮。
  - 本地状态 `dueDraft`、`dueError`；切换任务时从 `task.dueAt` 重置。
  - 选择日期后立即保存：`parseDueAt(value)` 成功则 `save({ dueAt: parsed.value })`；失败则内联报错且不保存。
  - 清除时 `save({ dueAt: null })`。
  - 保存中禁用输入；保存失败时恢复原值（与优先级下拉一致）。
  - 空值不写 `undefined` 键。
- 布局沿用现有 `dshwd-meta-row` / `dshwd-meta-label` / `dshwd-meta-value`，不加新 CSS。

#### 1.5.8 左栏与注意力（`src/client/rail.ts`、`src/client/task-attention.ts`、`src/client/attention-filter.ts`、`src/client/attention-summary.ts`、`src/client/board.ts`）

- `rail.ts` 任务行在状态 / 优先级 chip 之后增加截止 chip：
  - `overdue`：`t.taskDueOverdue`（`{n}` = 天数），`err` tone；
  - `today`：`t.taskDueToday`，`warn` tone；
  - `soon`：`t.taskDueSoon`（`{n}`），`warn` tone；
  - `later` / 无值：不显示。
  - chip 的 `title` 使用 `t.taskDueHint`。
  - 不要在 `alertText` 里再加一遍，避免和通用 alert chip 重复。
- `task-attention.ts`：
  - `AttentionCategory` 增加 `'overdue'`；
  - `AttentionInput` 增加 `overdueDays?: number | null`；
  - `deriveTaskAttention`：`Math.floor(Number(input.overdueDays) || 0) > 0` 时 `categories.add('overdue')`；**不新增 AlertKind**，不 push alert；
  - `SEVERITY` 增加 `overdue: 2`；
  - `CATEGORY_ORDER` 调整为 `['recovery', 'broken', 'pending', 'overdue', 'review', 'stalled']`；
  - `categoryKey` 增加 `overdue: 'attentionOverdue'`；
  - `summarizeAttention` 的 counts 初始化增加 `overdue: 0`；
  - `computeFilterCounts` 的 counts 增加 `overdue`，`hurting` 列表加入 `'overdue'`（计入 `total`）。
- `attention-filter.ts`：`options` 在 `'pending'` 之后插入 `'overdue'`；图标用 `clock`；不使用 danger 样式。
- `attention-summary.ts`：`severity >= 2` 分支改为：
  ```ts
  if (severity >= 2) {
    if (Number(counts.pending || 0) > 0) return pending 文案
    return String(t.attentionSummaryOverdue).replace('{n}', String(counts.overdue || 0))
  }
  ```
  这样「只有逾期」时不会误用「待处理」文案。
- `board.ts`：构建 `attentionMap` 时传入：
  ```ts
  const due = dueStateOf(tv.task.dueAt)
  overdueDays: due && due.kind === 'overdue' ? due.days : 0
  ```
  逾期任务仍然可以被停滞分类同时命中；两类计数都应正确（去重只影响 `total`）。

#### 1.5.9 验收报告（`src/client/report.ts`、`src/client/project-report.ts`）

- 单任务报告元数据区增加：
  - `- 截止日期: YYYY-MM-DD`；无值输出 `t.reportDueNone`；
  - 逾期时追加 `（t.reportDueOverdue，{n}）`。
- 项目报告任务表增加「截止」列（放在「优先级」之后），值为 `YYYY-MM-DD` 或 `—`；逐任务块增加 `- 截止日期: ...`。
- 报告不因为截止日期为空而少输出章节；保持现有「固定顺序、缺失给降级文案」原则。

#### 1.5.10 文案（`locale/zh.json`、`locale/en.json`）

至少新增（中英文 key 集合必须一致）：

| key | 中文 | English |
| --- | --- | --- |
| `taskDue` | 截止日期 | Due date |
| `taskDueEmpty` | 未设置截止日期 | No due date |
| `taskDueClear` | 清除 | Clear |
| `taskDueInvalid` | 截止日期无效 | Invalid due date |
| `taskDueHint` | 按本地日历日计算；逾期任务会进入「逾期」筛选。 | Calculated in local calendar days; overdue tasks appear in the Overdue filter. |
| `taskDueOverdue` | 逾期 {n} 天 | Overdue by {n}d |
| `taskDueToday` | 今天到期 | Due today |
| `taskDueSoon` | {n} 天后到期 | Due in {n}d |
| `attentionOverdue` | 逾期 | Overdue |
| `attentionSummaryOverdue` | {n} 个任务逾期 | {n} overdue |
| `reportDue` | 截止日期 | Due date |
| `reportDueNone` | 未设置 | Not set |
| `reportDueOverdue` | 逾期 {n} 天 | Overdue by {n}d |
| `projectReportColDue` | 截止 | Due |

### 1.6 验收标准

- [ ] 发布弹窗高级区可设置截止日期；发布后任务详情与左栏立即可见。
- [ ] 任务详情可设置、修改、清除截止日期；刷新页面、重启 DSH 后保持。
- [ ] 逾期 1 天 / 3 天、今天到期、未来 1–3 天、未来更远、无截止日期，六种情况的 chip 文案与颜色符合 1.3。
- [ ] 「逾期」筛选项出现且计数正确；选中后只显示逾期任务；汇总条在只有逾期任务时显示逾期文案。
- [ ] 逾期任务同时停滞时，两个筛选都命中，`total` 不重复计数。
- [ ] 非法日期返回 400；清除后 `dueAt` 键被删除。
- [ ] 单任务报告与项目报告都包含截止日期，输出可读且不破坏 Markdown 表格。
- [ ] 截止日期不改变排序、不改变任务状态、不改变合并门禁。
- [ ] 中英文 key 完全一致，`npm run check:locale` 通过。

### 1.7 测试要点

- `test/task-meta.test.ts`（扩展）：`parseDueAt` 的 null / 空串 / 数字 / `YYYY-MM-DD` / 非法日期 / 非法字符串；`dueDayOffset` 跨月、跨年、夏令时边界；`dueStateOf` 五种状态；`dueInputValue` 补零。
- `test/store.test.ts`（扩展）：设置、覆盖、清除 `dueAt`；非法值不写入；与其他 meta 字段部分更新互不覆盖。
- `test/http-flow.test.ts`（扩展）：`task/meta` 设置 / 清除 / 非法 400；`publish` 带 `dueAt`。
- `test/client-publish-state.test.ts`（扩展）：`dueAt` 初始值、脏检查。
- `test/client-task-attention.test.ts`（扩展）：`overdueDays` 产生分类；计数去重；`categoryKey`。
- `test/client-attention-summary`（如存在，扩展）：只有逾期时的标题。
- `test/client-report.test.ts` / `test/client-project-report.test.ts`（扩展）：有值 / 无值 / 逾期三种输出。
- 新文件优先：如现有测试结构不便扩展，可新增 `test/client-due.test.ts`，但不要复制已有断言。

---

## 2. 前置任务依赖（`dependsOn`）

### 2.1 功能说明

任务可以声明「必须先完成的前置任务」。语义是**建议性依赖**，只做展示与提示，不阻止合并、不改变状态机。入口与展示：

1. **任务详情**：「任务信息」分区新增「前置任务」行：
   - 无依赖：显示「无前置任务」；
   - 有依赖：显示前置任务的标题 chip，已完成（已合并 / 已清理）显示完成标记；
   - 编辑模式：可添加同项目任务作为前置，也可逐个移除；
   - 存在未完成前置时，行内提示「等待 N 项前置」。
2. **左栏任务行**：存在未完成前置时显示「等待 N 项前置」chip（warn 色），`title` 列出前置任务标题。
3. **模型工具**：`worktree_act` 的 `meta` 动作接受 `depends_on`（字符串数组，`[]` 清除）；`brief()` 输出 `dependsOn`。
4. 本批次**不做**依赖关系图、不做合并阻断、不做自动会话提醒；依赖变化只写任务记录。

### 2.2 为什么做

一个批次里的任务经常有先后关系：先改接口，再做页面；先修基础问题，再补体验。现在这种关系只存在于聊天记录或标题里，看板无法表达。用户只能靠记忆判断「这个任务现在能不能验收」，批次一多就容易先合并后置任务，最后返工。把依赖写成结构化字段后，至少能在左栏与详情里明确「还在等谁」，为后续做依赖图、合并门禁和自动提醒留下数据基础。

### 2.3 预期效果

- 任务 B 依赖任务 A，A 仍在进行中：B 行内显示「等待 1 项前置」，详情显示 A 的标题与未完成标记。
- A 合并后：B 的 chip 消失，详情显示 A 已完成。
- A 被清理（`cleanedAt`）也视为完成，避免依赖永久阻塞。
- A 被删除：B 的依赖显示为「已删除」，不再计入「等待 N 项」；不报错、不影响 B 的其他字段。
- 尝试把自己设为前置、依赖其他项目任务、依赖不存在的任务、形成循环依赖、超过 8 个前置：返回 400，且不写入。
- 未设置依赖的任务：行为与 1.13.0 完全一致。

### 2.4 收益

- **对用户**：一眼看出任务为什么还不能开始或验收，减少「先做后置任务」的返工。
- **对团队**：交接时依赖关系是结构化上下文，不再依赖记忆。
- **对插件**：补上「任务之间」的维度，后续可以扩展依赖图、合并前检查、自动排队。
- **风险可控**：纯展示字段，不阻断任何 Git 操作；校验集中在 Store 锁内，旧记录零迁移。

### 2.5 实现方案

#### 2.5.1 共享纯函数（`src/task-deps.ts`，新增）

宿主端、客户端与测试共用，不依赖 DOM / Node API：

```ts
export const DEPENDENCY_LIMIT = 8

export type DependencyIssue =
  | 'too-many'
  | 'invalid'
  | 'self'
  | 'missing'
  | 'cross-project'
  | 'cycle'

/** 接受数组或逗号 / 空白分隔字符串；去空、去重，保留首次顺序。 */
export function normalizeDependencyIds(values: unknown): string[]

/** 前置任务视为完成：已有 mergedAt 或 cleanedAt。 */
export function isDependencyDone(task: any): boolean

export interface DependencyValidationInput {
  taskId: string
  projectId?: string
  repoPath?: string
  ids: string[]
  tasks: Array<{
    id: string
    projectId?: string
    repoPath?: string
    dependsOn?: string[]
    mergedAt?: number
    cleanedAt?: number
    archivedAt?: number
  }>
}

/**
 * 校验一组依赖 id。
 * - 数量超过 DEPENDENCY_LIMIT -> too-many
 * - 包含自己 -> self
 * - 任一 id 不存在 -> missing
 * - 任一前置与当前任务不同项目 -> cross-project
 * - 加入后形成环 -> cycle
 */
export function validateDependencyIds(
  input: DependencyValidationInput,
): { ok: true } | { ok: false; error: DependencyIssue }

export interface DependencyOpenItem {
  id: string
  title: string
  done: boolean
}

export interface DependencyStatus {
  /** 记录中存在的依赖总数（不含缺失 id）。 */
  total: number
  done: number
  /** 尚未完成的前置任务。 */
  open: DependencyOpenItem[]
  /** 记录中存在、但任务已不存在的 id。 */
  missing: string[]
  /** open.length > 0。缺失 id 不算阻塞。 */
  blocked: boolean
}

/**
 * 根据任务记录查找表派生展示状态。lookup 的值至少包含 id / title /
 * mergedAt / cleanedAt。缺失 id 放进 missing，不阻塞。
 */
export function dependencyStatus(task: any, lookup: Map<string, any>): DependencyStatus
```

规则：

- `normalizeDependencyIds` 对非数组非字符串返回 `[]`；字符串按 `/[,\s]+/` 切分；每项 `trim()`；空项丢弃；去重。
- 项目一致性：两边 `projectId` 都非空时比较 `projectId`；否则两边 `repoPath` 都非空时比较 `repoPath`；都缺失时放行（兼容旧记录）。
- 环检测：用 `tasks` 构建 `id -> dependsOn` 邻接表，把当前任务的边替换为 `ids`，从 `taskId` 做 DFS；遇到已访问节点即视为有环。
- `dependencyStatus` 中 `total` 只统计 lookup 里存在的依赖；`missing` 只展示、不阻塞。
- 同一个 id 重复出现只算一次。

#### 2.5.2 数据模型（`src/models.ts`）

```ts
export interface WorktreeTask {
  // ...
  /** 可选前置任务 id 列表（同一项目，最多 8 个）。 */
  dependsOn?: string[]
}
```

#### 2.5.3 Store（`src/store.ts`）

- `TaskMetaPatch` 增加 `dependsOn?: unknown`。
- `TaskMetaResult` 的失败原因增加：
  `'deps-too-many' | 'deps-self' | 'deps-missing' | 'deps-cross-project' | 'deps-cycle'`。
- `updateTaskMeta` 内：
  - `has('dependsOn')` 时 `normalizeDependencyIds`；
  - `[]` -> `delete task.dependsOn`；
  - 非空 -> 调用 `validateDependencyIds`（传入当前任务、`this.tasks` 全量记录、拟写入的 ids）；失败映射到对应 reason；
  - 校验全部通过后才写记录、更新 `updatedAt`、`saveTasks()`。
- 依赖任务被删除时不做全表清理：其他任务的 `dependsOn` 保留旧 id，运行时按 missing 展示。文档中注明这是有意的宽容策略。

#### 2.5.4 Runtime / HTTP / 工具

- `src/runtime.ts` 的 `updateTaskMeta` 错误映射增加：
  - `deps-too-many` -> `前置任务最多 8 个`
  - `deps-self` -> `不能依赖自己`
  - `deps-missing` -> `前置任务不存在`
  - `deps-cross-project` -> `只能依赖同一项目的任务`
  - `deps-cycle` -> `不能形成循环依赖`
  全部 HTTP 400。
- `src/http.ts` 的 `act('meta')` 增加：
  ```ts
  if (Object.prototype.hasOwnProperty.call(body, 'dependsOn')) patch.dependsOn = body.dependsOn
  ```
- `src/tools.ts`：
  - `worktree_act` 参数增加 `depends_on`（array of string），`meta` 动作映射为 `patch.dependsOn`；
  - `brief()` 输出 `dependsOn: Array.isArray(v.task.dependsOn) ? v.task.dependsOn : []`。
- 发布接口本批次不接受 `dependsOn`：依赖在任务创建后通过详情设置。

#### 2.5.5 任务信息（`src/client/stage.ts`）

- `StageProps.onSaveMeta` 的 patch 类型增加 `dependsOn?: string[]`。
- 新增两个只读 prop（由 board 计算，测试可省略）：
  ```ts
  /** 当前任务的前置任务（含完成状态），按 dependsOn 顺序。 */
  dependencyItems?: Array<{ id: string; title: string; done: boolean; missing?: boolean }>
  /** 可添加为前置的同项目任务（排除自己与已归档）。 */
  dependencyOptions?: Array<{ id: string; title: string; done: boolean }>
  ```
- 只读模式：新增「前置任务」行；无依赖显示 `t.taskDepsEmpty`；有依赖显示标题 chip（完成加 `✓`，缺失显示 `t.taskDepsMissing`）；存在未完成项时行内显示 `t.taskDepsWaitingHint`（`{n}` 与 `{titles}`）。
- 编辑模式：
  - 已选依赖 chip 右侧提供移除按钮（`aria-label` 带任务标题）；
  - 「添加前置任务」`<select>`：默认空 option，选项为 `dependencyOptions` 中尚未选择的任务；选择后立即 `save({ dependsOn: [...ids, chosen] })`；成功后清空 select；
  - 移除时 `save({ dependsOn: ids.filter(id => id !== removed) })`；
  - 保存中禁用；保存失败时保持原值（下一次轮询会回填）。
- 不新增图标 / CSS；复用 `dshwd-chip`、`dshwd-meta-*`、`dshwd-select`。

#### 2.5.6 左栏（`src/client/rail.ts`、`src/client/board.ts`）

- `RailProps` 增加可选：
  ```ts
  depsOf?: (task: any) => DependencyStatus
  ```
- 任务行在截止 chip 之后（或优先级之后）：
  - `status.blocked` 时显示 `chip(fill(t.taskDepsBlocked, { n: status.open.length }), 'warn', titles)`；
  - `titles` = `status.open.map(item => item.title).join(', ')`；
  - 没有 `depsOf` 或没有未完成项时不显示。
- `board.ts`：
  - 构建 `const taskLookup = new Map(allViews.map(tv => [tv.task.id, tv.task]))`；
  - `const depsOf = React.useCallback((task: any) => dependencyStatus(task, taskLookup), [taskLookup])`；
  - 传给 `Rail`；并给 `Stage` 计算：
    - `dependencyItems`：当前任务 `dependsOn` 的逐项查找（缺失项 `missing: true`）；
    - `dependencyOptions`：同一项目、不同 id、未归档的任务，按 `compareTaskOrder` 排序。

#### 2.5.7 文案（`locale/zh.json`、`locale/en.json`）

至少新增：

| key | 中文 | English |
| --- | --- | --- |
| `taskDeps` | 前置任务 | Depends on |
| `taskDepsEmpty` | 无前置任务 | No dependencies |
| `taskDepsAdd` | 添加前置任务 | Add dependency |
| `taskDepsRemove` | 移除前置任务 | Remove dependency |
| `taskDepsBlocked` | 等待 {n} 项前置 | Waiting on {n} |
| `taskDepsDone` | 已完成 | Done |
| `taskDepsOpen` | 未完成 | Open |
| `taskDepsMissing` | 已删除 | Missing |
| `taskDepsHint` | 只能依赖同一项目的任务；前置全部合并或清理后解除等待。 | Only tasks in the same project; a dependency clears when it is merged or cleaned. |
| `taskDepsWaitingHint` | 还有 {n} 项未完成：{titles} | Still waiting on {n}: {titles} |
| `taskDepsAllDone` | 前置任务已全部完成 | All dependencies are done |
| `taskDepsTooMany` | 前置任务最多 8 个 | At most 8 dependencies |
| `taskDepsSelf` | 不能依赖自己 | A task cannot depend on itself |
| `taskDepsCycle` | 不能形成循环依赖 | Circular dependencies are not allowed |
| `taskDepsCrossProject` | 只能依赖同一项目的任务 | Dependencies must share the project |

### 2.6 验收标准

- [ ] 任务详情可添加 / 移除前置任务；刷新、重启后保持。
- [ ] 前置任务进行中时，详情与左栏都显示等待提示；前置合并或清理后提示消失。
- [ ] 前置任务被删除时显示「已删除」，且不阻塞。
- [ ] 自己 / 缺失 id / 跨项目 / 环路 / 超过 8 个全部返回 400，记录不变。
- [ ] 未设置依赖时详情与左栏行为与 1.13.0 一致。
- [ ] 依赖不改变排序、状态、合并门禁与 Git 操作。
- [ ] 中英文 key 一致，`check:locale` 通过。

### 2.7 测试要点

- 新增 `test/task-deps.test.ts`：
  - normalize：数组 / 字符串 / 混合 / 去重 / 空值；
  - validate：正常、too-many、self、missing、cross-project（projectId 与 repoPath 两条路径）、直接环、间接环、合法链；
  - `isDependencyDone`：mergedAt / cleanedAt / 进行中；
  - `dependencyStatus`：完成数、open、missing、blocked、顺序。
- `test/store.test.ts`（扩展）：设置 / 清空 / 非法依赖 / 两个 Store 实例并发更新不同字段不互相覆盖。
- `test/http-flow.test.ts`（扩展）：`task/meta` 的 `dependsOn` 成功与各类 400。
- `test/tools-act.test.ts`（扩展）：`worktree_act` 的 `depends_on` 透传与 brief 输出。

---

## 3. 项目洞察（`project-insights`）

### 3.1 功能说明

项目详情新增「项目洞察」卡片，用**已有时间戳**计算并展示：

- 平均 / 中位周期：`mergedAt - createdAt` 的天数（仅已合并任务）。
- 近 7 天新建数与合并数。
- 验收核对率：所有带验收标准的任务中，已核对条数 / 总条数。
- 最久未完成任务：从创建到现在的天数。
- 最近 7 天的每日新建 / 合并柱状条（纯 CSS，不引入图表库）。
- 统计口径只看任务记录与快照，不额外请求 Git，不写任何状态。

### 3.2 为什么做

看板能显示「现在有多少任务」，但无法回答「这个项目最近交付效率如何」「验收清单真的在核对吗」「有没有任务拖了很久」。项目验收报告是导出物，不适合日常扫一眼。用已有字段做纯函数统计，不需要新增存储或后台任务，就能把项目健康度变成常驻卡片。

### 3.3 预期效果

- 一个有 5 个已合并任务的项目：显示平均周期、中位周期（有样本时）、近 7 天新建 / 合并数。
- 没有已合并任务：周期显示 `—`，不显示 `0 天`。
- 没有验收标准：验收核对率显示 `—`。
- 没有未完成任务：最久未完成显示 `—`。
- 空项目：卡片显示降级文案，不报错。
- 已归档任务计入历史合并统计，但不计入「未完成」。
- 未来时间戳、缺失时间戳、`mergedAt < createdAt` 的异常记录被忽略，不产生负周期。

### 3.4 收益

- **对用户**：不用导出报告就能看到项目节奏与积压。
- **对团队**：验收核对率暴露「有标准但没人勾」的流程问题。
- **对插件**：建立纯函数统计层，后续可以做跨项目总览、周报和趋势图。
- **风险可控**：纯派生、无存储、无网络、无新依赖。

### 3.5 实现方案

#### 3.5.1 新增纯函数 `src/client/project-insights.ts`

```ts
import type { TaskView } from '../models'

export const INSIGHTS_DAYS = 7

export interface InsightDay {
  /** 相对今天的天数：-6 .. 0，0 表示今天。 */
  offset: number
  /** 当地零点时间戳，用于 tooltip。 */
  start: number
  created: number
  merged: number
}

export interface ProjectInsights {
  total: number
  open: number
  merged: number
  archived: number
  createdLast7: number
  mergedLast7: number
  /** 参与周期统计的已合并任务数。 */
  cycleSamples: number
  cycleMedianDays: number | null
  cycleAverageDays: number | null
  acceptanceChecked: number
  acceptanceTotal: number
  /** 0..100 的整数；没有标准时为 null。 */
  acceptancePercent: number | null
  oldestOpenDays: number | null
  statusCounts: Record<string, number>
  /** 最近 7 个本地日历日，按时间升序。 */
  daily: InsightDay[]
}

export function buildProjectInsights(views: TaskView[], now?: number): ProjectInsights
```

规则：

- `total` = `views.length`（含归档）。
- `archived` = 有 `archivedAt` 的任务数。
- `merged` = `snapshot.status === 'merged'` 或存在 `task.mergedAt`。
- `open` = 未归档、且状态不是 `merged` / `cleaned` 的任务数（`broken` 也算未完成）。
- 周期样本：`mergedAt` 与 `createdAt` 都是有限正数且 `mergedAt >= createdAt`；天数为毫秒差 / 86400000，保留 1 位小数；中位数按排序后取中间（偶数个取平均）。
- 近 7 天：以 `now` 的本地日历日为准，构造 `offset = -6..0` 的 7 个桶；`createdAt` 落在桶内的计入 `created`，`mergedAt` 落在桶内的计入 `merged`。桶边界用本地零点，避免时区漂移。
- 验收核对：对每个任务调用现有 `criteria(task, snapshot.status)` 与 `criteriaProgress(items)`，累加 `checked` 与 `total`；`acceptancePercent = total ? Math.round(checked / total * 100) : null`。
- `oldestOpenDays`：`open` 任务中 `now - createdAt` 的最大天数（向下取整）；没有 open 返回 null。
- 所有非法 / 未来时间戳按 0 或忽略处理，不抛异常。
- 不导入 `task-meta.ts` 的截止日期函数，保持该功能独立。

#### 3.5.2 项目详情卡片（`src/client/project-detail.ts`）

- 在现有统计卡片之后、项目验收报告卡片之前插入：
  ```ts
  h(Card, null,
    h(CardHead, { icon: 'grid', title: t.projectInsights }),
    ...统计与每日柱状条)
  ```
- 统计使用现有 `Stat` 原语，四项：
  - `t.insightsCycle`：有样本时 `t.insightsCycleValue`（`{n}` 保留 1 位小数），否则 `t.insightsNoData`；
  - `t.insightsMerged7`：数字；
  - `t.insightsAcceptance`：百分比或 `t.insightsNoData`；
  - `t.insightsOldest`：天数或 `t.insightsNoData`。
- 每日柱状条：
  - 容器 `dshwd-insights-days`，7 个 `dshwd-insights-day`；
  - 每格两根细柱（新建 / 合并），高度按 7 天内最大值归一；全 0 时高度为 0（不显示假数据）；
  - 每格 `title` 使用 `t.insightsDailyTip`（`{date}` / `{created}` / `{merged}`），`aria-label` 同文案；
  - 日期用本地 `M/D` 格式，`dshw-mono`；
  - 图例使用 `t.insightsCreated` / `t.insightsMerged`。
- 空项目：仍渲染卡片，统计为 0 / `—`，每日柱状条为空；不隐藏卡片（与报告卡片保持一致）。
- 计算使用 `buildProjectInsights(v.tasks, Date.now())`；`Date.now()` 只在渲染时取一次，避免同一次渲染内桶边界漂移。
- 新增少量 CSS 到 `src/client/styles/workbench.ts`，只使用现有 CSS 变量（`--line`、`--accent`、`--ok`、`--text-3` 等）。

#### 3.5.3 文案

| key | 中文 | English |
| --- | --- | --- |
| `projectInsights` | 项目洞察 | Project insights |
| `insightsCycle` | 平均周期 | Avg cycle |
| `insightsCycleValue` | {n} 天 | {n} days |
| `insightsNoData` | — | — |
| `insightsMerged7` | 近 7 天合并 | Merged in 7d |
| `insightsCreated` | 新建 | Created |
| `insightsMerged` | 合并 | Merged |
| `insightsAcceptance` | 验收核对率 | Criteria checked |
| `insightsOldest` | 最久未完成 | Oldest open |
| `insightsOldestValue` | {n} 天 | {n} days |
| `insightsAcceptanceValue` | {n}% | {n}% |
| `insightsDaily` | 最近 7 天 | Last 7 days |
| `insightsDailyTip` | {date}：新建 {created} · 合并 {merged} | {date}: created {created} · merged {merged} |
| `insightsEmpty` | 还没有任务数据 | No task data yet |

### 3.6 验收标准

- [ ] 卡片在项目详情中显示，四项统计与 7 天柱状条均可读。
- [ ] 空项目、无合并任务、无验收标准、无未完成任务都有降级文案，不出现 NaN / Infinity / 负值。
- [ ] 周期统计只包含有效已合并任务；中位数偶数样本正确。
- [ ] 近 7 天桶边界按本地日历日，今天的数据计入最后一桶。
- [ ] 归档任务计入历史合并与吞吐，不计入未完成。
- [ ] 不发起任何网络请求，不新增依赖，不写任务记录。
- [ ] 中英文 key 一致，`check:locale` 通过。

### 3.7 测试要点

- 新增 `test/client-project-insights.test.ts`：
  - 空项目；单任务；多任务；
  - 周期平均 / 中位数（奇数、偶数）、异常 `mergedAt < createdAt`；
  - 近 7 天边界（今天、6 天前、7 天前排除）；
  - 验收核对率（无标准、部分、全部）；
  - 最久未完成（含归档排除）；
  - 未来时间戳与缺失字段。
- `test/client-project-report.test.ts` 不需要改（本功能不碰报告）。

---

## 4. 结构化搜索（`search-query`）

### 4.1 功能说明

左栏搜索框在保留纯文本模糊搜索的基础上，支持结构化 token：

```text
tag:前端                    # 必须包含标签「前端」（大小写不敏感）
tag:"需要设计"              # 引号包住含空格的值
priority:high               # low / normal / high，可重复，多个取 OR
status:review               # ready / developing / review / reviewing / merged / cleaned / broken，可重复，多个取 OR
登录 修复 tag:紧急          # 纯文本 + 结构化条件同时生效
```

- 多个 `tag:` 之间取 **AND**（必须同时包含）；多个 `priority:` / `status:` 之间取 **OR**。
- 不同类别之间取 **AND**。
- 纯文本仍然匹配项目名、任务标题、分支、标签、备注与待处理状态。
- 未知 key（如 `foo:bar`）按纯文本处理，不报错。
- 已知 key 但值非法（如 `priority:urgent`）按纯文本处理，并在解析结果中标记，便于测试；不弹错误。
- 搜索框下方增加一行弱提示，说明支持的语法；空查询时不显示额外结果变化。

### 4.2 为什么做

标签、优先级、状态都已经存在，但用户只能通过下拉逐个筛选，不能组合表达「待验收的高优先级前端任务」。纯文本搜索又无法区分「标签里包含 high」和「优先级是 high」。加一层很薄的查询语法，不新增 UI 控件、不新增存储，就能把已有字段变成可组合的查询条件，并为保存视图、命令面板留下解析基础。

### 4.3 预期效果

- 输入 `tag:前端 priority:high`：只显示同时带「前端」标签且优先级为高的任务；项目名匹配不会绕过条件。
- 输入 `tag:"需要设计"`：标签值带空格也能精确匹配。
- 输入 `tag:前端 tag:紧急`：只显示同时带两个标签的任务。
- 输入 `status:merged`：只显示已合并任务（即使当前注意力筛选是「全部」）。
- 输入 `登录`：行为与 1.13.0 的纯文本搜索完全一致。
- 输入 `priority:urgent`：没有任务匹配（按纯文本），清空搜索后恢复。
- 标签下拉与注意力筛选仍然叠加生效。

### 4.4 收益

- **对用户**：用一行查询组合已有字段，不用在多个下拉之间来回切换。
- **对团队**：查询语法可以写进文档、交接说明和未来保存视图。
- **对插件**：搜索从「字符串包含」升级为「可扩展查询 AST」，后续可以加 `due:`、`blocked:`、`is:` 等。
- **风险可控**：纯客户端纯函数，未使用 token 时行为不变。

### 4.5 实现方案

#### 4.5.1 新增纯函数 `src/client/search-query.ts`

```ts
import type { TaskPriority } from '../task-meta'

export type SearchStatus =
  | 'ready' | 'developing' | 'review' | 'reviewing' | 'merged' | 'cleaned' | 'broken'

export interface ParsedSearchQuery {
  /** 去掉结构化 token 后剩余的纯文本（多段用单个空格连接）。 */
  text: string
  /** 需要全部命中的标签（小写比较）。 */
  tags: string[]
  priorities: TaskPriority[]
  statuses: SearchStatus[]
  /** 已知 key 但值非法的原始 token；仍会作为纯文本参与匹配。 */
  invalid: string[]
}

/** 空值 / 非字符串返回全空的查询。 */
export function parseSearchQuery(raw: unknown): ParsedSearchQuery

/** 是否包含任何有效结构化条件。 */
export function hasStructuredFilters(query: ParsedSearchQuery): boolean

/**
 * 任务是否命中查询。
 * - text 非空时，调用方传入的 extraFields 参与大小写不敏感包含匹配；
 * - 标签按小写精确比较，多个标签 AND；
 * - 优先级、状态多个值 OR；
 * - invalid token 已并入 text，不单独处理。
 */
export function matchesStructuredQuery(
  query: ParsedSearchQuery,
  task: any,
  snapshot: any,
  extraFields?: Array<string | null | undefined>,
): boolean
```

解析规则：

- 扫描输入，支持双引号值：`tag:"foo bar"`；未闭合引号时把剩余内容当作值。
- 支持的 key（大小写不敏感）：`tag` / `tags`、`priority` / `prio`、`status`。
- `tag:` 值用现有 `parseTagText` 归一化（去 `#`、折叠空白）；空值丢弃。
- `priority:` 只接受 `low` / `normal` / `high`；非法进 `invalid` 并保留原文到 `text`。
- `status:` 只接受上述 7 个状态；非法同上。
- 纯文本按空白切分后重新用单个空格连接；引号只用于结构化值，不作为文本保留。
- 解析器必须容错：`undefined`、数字、超长字符串都不能抛异常。

匹配规则：

- 标签：任务 `task.tags` 按小写集合判断，`query.tags` 的每一项都必须存在。
- 优先级：`task.priority || 'normal'`，命中任一即可。
- 状态：`snapshot.status` 命中任一即可；`snapshot` 缺失时状态条件不命中（但纯文本仍可命中）。
- 纯文本：沿用 `matchesSearch` 的大小写不敏感包含匹配，字段为调用方传入的 `extraFields`；调用方负责把 title / branch / tags / notes / pending 文本传进来。
- 空查询返回 true。

#### 4.5.2 左栏过滤（`src/client/model.ts`）

`filterProjectViews` 改为：

1. `const parsed = parseSearchQuery(query)`；
2. `const text = parsed.text`；
3. `keepEmpty` 条件保持 `filter === 'all' && !text && !parsed.tags.length && !parsed.priorities.length && !parsed.statuses.length && !wantedTag`（invalid token 已在 text 中，因此非空查询不会保留空项目）；
4. `projectHit` 只在 `text` 非空时计算；
5. 每个任务依次检查：标签下拉、注意力筛选、`matchesStructuredQuery(parsed, task, snapshot, [title, branch, tags, notes, pendingText])`；
6. 纯文本命中规则：如果 `text` 为空直接通过；否则 `projectHit || matchesSearch(text, fields)`；
7. 原有 `matchesSearch` 保持不变，供其他调用方复用。

注意：`filterProjectViews` 的签名不变，避免改动大量调用方；解析在函数内部完成。

#### 4.5.3 搜索框（`src/client/rail.ts`、`src/client/styles/workbench.ts`）

- 输入框增加 `title={t.searchSyntaxHint}` 与 `aria-description={t.searchSyntaxHint}`（若宿主不支持 `aria-description` 也不报错）。
- 搜索框下方增加一行弱提示：
  ```ts
  h('div', { className: 'dshwd-search-hint' }, t.searchSyntaxHint)
  ```
  只在 `props.query` 为空时显示，避免占用有查询时的视觉空间；点击提示不改变输入。
- 新增 `.dshwd-search-hint` 样式：小字号、`var(--text-3)`、省略号（长文案不撑破 272px 左栏）。
- 不新增按钮、不新增弹层。

#### 4.5.4 文案

| key | 中文 | English |
| --- | --- | --- |
| `searchSyntaxHint` | 支持 tag:前端 priority:high status:review；含空格用引号，如 tag:"需要设计"。 | Try tag:frontend priority:high status:review; quote values with spaces, e.g. tag:"needs design". |

`boardSearch` 保持原文案不变，避免破坏现有测试。

### 4.6 验收标准

- [ ] 纯文本搜索行为与 1.13.0 完全一致。
- [ ] `tag:` 单个 / 多个（AND）、引号空格值、大小写不敏感均正确。
- [ ] `priority:` / `status:` 多值 OR，非法值不崩溃。
- [ ] 结构化条件与标签下拉、注意力筛选叠加生效。
- [ ] 只含结构化条件时，项目名匹配不会把所有任务放行。
- [ ] 未知 key 按纯文本处理；空查询显示全部。
- [ ] 搜索提示在空查询时可见、窄栏不溢出；中英文 key 一致。

### 4.7 测试要点

- 新增 `test/client-search-query.test.ts`：
  - 解析：空值、纯文本、单 token、多 token、引号、未闭合引号、大小写 key、非法值、未知 key、重复 token；
  - 匹配：标签 AND、优先级 OR、状态 OR、组合 AND、缺失 snapshot、缺失 tags。
- `test/client-model.test.ts`（扩展）：
  - `filterProjectViews` 的结构化过滤；
  - 项目名命中但结构化条件不满足时不放行；
  - 空查询 / 纯文本 / 标签下拉 / 注意力组合。
- 现有 `boardNoMatches` 空态相关断言不应改变。

---

## 5. 任务生命周期时间线（`task-lifecycle`）

### 5.1 功能说明

把任务记录里已有的时间戳整理成一条按时间升序的生命周期：

- 发布（`createdAt`）
- 置顶（`pinnedAt`）
- 合并到基线（`mergedAt`，附带合并提交短 SHA）
- 清理 worktree（`cleanedAt`）
- 归档（`archivedAt`）
- 最近更新（`updatedAt`，只在明显晚于其他事件时出现，避免每次轮询都多一条「刚刚」）

展示位置：

1. **任务概览**：在「任务信息」之后新增「任务时间线」分区，纵向列表显示事件名、相对时间与可选提交号。
2. **验收报告**：单任务报告新增「任务时间线」章节；每条事件输出本地时间（`YYYY-MM-DD HH:mm`）。
3. **周期说明**：如果任务已合并，时间线顶部或底部显示「发布 → 合并 N 天」。
4. 纯派生视图，不新增存储字段、不改变状态机、不发送任何请求。

### 5.2 为什么做

任务记录里已经有发布、置顶、合并、清理、归档、更新时间，但界面上只有零散的「最近活动」和报告里的几个字段。验收或交接时，用户需要回答「这个任务放了多久」「什么时候合并的」「合并之后有没有再动过」。把这些时间戳按顺序排成一条线，成本极低，却能把「任务的一生」直接讲清楚，也为后续活动日志（记录每次状态变更）留下展示层基础。

### 5.3 预期效果

- 刚发布的任务：只有「发布」与「最近更新」（若更新时间明显更晚）。
- 置顶后：出现「置顶」；合并后出现「合并到基线」与短 SHA；清理后出现「清理 worktree」。
- 时间线严格按时间升序；同一时间戳按固定事件顺序排列，不闪烁。
- 已合并任务显示周期「发布 → 合并 N 天」。
- 缺失 / 非法时间戳不产生空行；没有事件时显示降级文案（理论上 `createdAt` 总会存在）。
- 报告中的时间线使用本地时间，与界面一致。

### 5.4 收益

- **对用户**：一眼看懂任务从发布到合并 / 清理的节奏。
- **对团队**：报告自带时间线，评审者不用再翻提交记录推断。
- **对插件**：建立统一的生命周期事件模型，后续可以扩展为完整活动日志。
- **风险可控**：纯派生、无存储、无网络、无新依赖。

### 5.5 实现方案

#### 5.5.1 新增纯函数 `src/client/task-lifecycle.ts`

注意：不要修改现有的 `src/client/timeline.ts`（实时会话时间线），新模块单独命名。

```ts
export type LifecycleKind =
  | 'created' | 'pinned' | 'merged' | 'cleaned' | 'archived' | 'updated'

export interface LifecycleEvent {
  kind: LifecycleKind
  at: number
  /** 合并事件附带的提交短 SHA（7 位）；其他事件没有。 */
  commit?: string
}

/** 按时间升序返回事件；非法 / 缺失时间戳被忽略。 */
export function buildTaskLifecycle(task: any): LifecycleEvent[]

/** 发布到合并的天数（保留 1 位小数）；没有有效合并时间返回 null。 */
export function lifecycleCycleDays(task: any): number | null

/** 事件对应的 locale key。 */
export function lifecycleLabelKey(kind: LifecycleKind): string
```

规则：

- 固定时间戳来源：`createdAt`、`pinnedAt`、`mergedAt`、`cleanedAt`、`archivedAt`、`updatedAt`。
- 只接受有限且 `> 0` 的时间戳。
- `updatedAt`：仅当它比其余所有已包含事件的最大时间至少晚 1000ms 时才加入；否则忽略，避免「最近更新」与「合并」同一时刻重复。
- 排序：`at` 升序；相同时按 `created -> pinned -> merged -> cleaned -> archived -> updated` 的固定顺序。
- `merged` 的 `commit`：`task.mergedCommit` 的字符串前 7 位（没有则不填）。
- `lifecycleCycleDays`：`mergedAt >= createdAt` 时返回 `(mergedAt - createdAt) / 86400000`，保留 1 位小数；否则 null。
- `lifecycleLabelKey` 返回 `lifecycleCreated` 等 key。
- 不依赖 DOM、不依赖 locale 文案本身。

#### 5.5.2 任务概览（`src/client/stage.ts`）

- 在 `Overview` 中、`TaskMetaSection` 之后插入：
  ```ts
  h(TaskLifecycleSection, props)
  ```
- `TaskLifecycleSection`：
  - `const events = buildTaskLifecycle(task)`；
  - 分区标题 `t.taskLifecycle`；
  - 已合并时标题右侧显示 `t.lifecycleCycle`（`{n}` = `lifecycleCycleDays`，1 位小数）；
  - 纵向列表：每条事件一个圆点 + 事件名 + 相对时间（`relTime(event.at, t)`），合并事件追加 `shortSha(event.commit)`；
  - 事件的 `title` 使用完整本地时间（`new Date(at).toLocaleString()`）；
  - 空列表显示 `t.lifecycleEmpty`；
  - 复用 `dshwd-block`、`dshwd-chip`，新增少量 `dshwd-lifecycle*` CSS。
- 不新增交互（不可点击、不可编辑）。

#### 5.5.3 验收报告（`src/client/report.ts`）

- 在「备注」章节之后、「提交」章节之前增加：
  ```md
  ## 任务时间线
  - YYYY-MM-DD HH:mm · 发布任务
  ...
  ```
- 使用 `reportTimestamp(event.at)`；合并事件追加 `(短 SHA)`。
- 已合并时追加一行 `t.lifecycleCycle`。
- 没有事件时输出 `t.lifecycleEmpty`。
- 不改变现有章节顺序与降级行为（只插入新章节）。

#### 5.5.4 样式（`src/client/styles/workbench.ts`）

- 新增 `.dshwd-lifecycle`、`.dshwd-lifecycle-item`、`.dshwd-lifecycle-dot`、`.dshwd-lifecycle-label`、`.dshwd-lifecycle-time`。
- 使用现有 CSS 变量；左侧竖线用 `border-left`；圆点用伪元素或小 `span`。
- 支持明暗主题；不引入动画。

#### 5.5.5 文案

| key | 中文 | English |
| --- | --- | --- |
| `taskLifecycle` | 任务时间线 | Task timeline |
| `lifecycleCreated` | 发布任务 | Task published |
| `lifecyclePinned` | 置顶任务 | Pinned |
| `lifecycleMerged` | 合并到基线 | Merged into base |
| `lifecycleCleaned` | 清理 worktree | Worktree cleaned |
| `lifecycleArchived` | 归档任务 | Archived |
| `lifecycleUpdated` | 最近更新 | Last updated |
| `lifecycleEmpty` | 暂无时间线记录 | No timeline yet |
| `lifecycleCycle` | 发布 → 合并 {n} 天 | Published → merged in {n} days |
| `reportLifecycle` | 任务时间线 | Task timeline |

### 5.6 验收标准

- [ ] 概览显示时间线，事件顺序、文案、时间正确；合并事件带短 SHA。
- [ ] `updatedAt` 只在明显晚于其他事件时出现，不因轮询重复。
- [ ] 已合并任务显示周期天数；未合并不显示。
- [ ] 单任务报告包含时间线章节，时间格式与界面一致（本地时间）。
- [ ] 时间线不改变任务状态、不发请求、不新增存储字段。
- [ ] 中英文 key 一致，`check:locale` 通过。

### 5.7 测试要点

- 新增 `test/client-task-lifecycle.test.ts`：
  - 只有 `createdAt`；
  - 全部时间戳；
  - `updatedAt` 早于 / 等于 / 明显晚于其他事件；
  - 非法 / 缺失 / 负数时间戳；
  - 同一时刻的固定排序；
  - `lifecycleCycleDays` 正常 / 缺失 / `mergedAt < createdAt`；
  - `lifecycleLabelKey` 全覆盖。
- `test/client-report.test.ts`（扩展）：时间线章节、合并短 SHA、空事件降级。
- 不修改 `test/client-timeline.test.ts`（实时会话时间线）。

---

## 6. 通用实现约定

1. **共享纯函数优先**：截止日期、依赖、洞察、搜索、生命周期都放在无 DOM 的纯模块里；服务端与客户端共用同一套规则，不要在多个文件复制。
2. **原子写**：所有任务字段写操作走 Store 的 `withLock` + `refresh` + `save`；HTTP / Runtime 只做校验与错误映射。
3. **可选字段**：不写 `undefined` 键；清空即删除字段（沿用 `putTask` / `setTaskPinned` / `updateTaskMeta` 的约定）。
4. **错误语义**：校验失败 400，任务不存在 404；错误信息使用中文，前端直接展示。
5. **排序唯一入口**：继续使用 `compareTaskOrder`；截止日期与依赖不参与排序。
6. **文案**：所有新文案同时加入 `locale/zh.json` 与 `locale/en.json`，key 集合一致；`check-locale` 必须通过。
7. **可访问性**：日期输入、依赖下拉、移除按钮必须有可访问名称；错误用 `role="alert"`；保存中禁用；不引入仅靠颜色表达的状态。
8. **不新增依赖**：不引入日期库、Markdown 库、图表库或 UI 库；继续使用现有原语与手写样式。
9. **文档同步由主线程完成**：实施者不要修改 `README.md`、`CHANGELOG.md`、`docs/`、`package.json`、`package-lock.json`、`feature.md`；这些由主线程在集成时统一更新到 1.14.0。
10. **最小 diff**：不重排现有代码、不重命名既有函数、不格式化整文件；共享文件只改本功能需要的行。
11. **测试**：每个功能至少一个新增测试文件；必要时扩展已有测试。不要复制已有断言，不要依赖系统时钟（使用可注入的 `now`）。
12. **实施边界**：每个子 agent 只实现自己负责的第 1–5 节之一；完成前运行 `npm run typecheck` 与 `npm test`（node_modules 缺失时先 `npm ci`），失败必须修复；最后只提交一次，并在结果中报告分支名、HEAD SHA、变更文件与测试数量。

## 7. 批次验收标准

- [ ] 5 个功能均可从 UI 或模型工具触发；未设置截止日期 / 未设置依赖 / 未使用搜索语法时行为与 1.13.0 一致。
- [ ] `dueAt`、`dependsOn` 在发布、详情编辑、刷新、重启、双实例场景下不丢失、不互相覆盖。
- [ ] 截止日期、依赖、结构化搜索、注意力筛选、标签筛选、归档开关互相兼容；组合结果正确。
- [ ] 项目洞察与生命周期时间线在空项目、旧记录、异常时间戳下不报错、不出现 NaN / 负值。
- [ ] 旧任务记录（无新字段）加载不报错，排序与状态不变。
- [ ] `npm run check:locale` 通过；中英文 key 完全一致。
- [ ] `npm run verify`（typecheck + locale + 测试 + 构建）通过，测试数量不少于 1.13.0 的 408 项并有所增加。
- [ ] README、CHANGELOG、docs/frontend-design.md、docs/i18n-terminology.md、package.json、package-lock.json 由主线程更新到 1.14.0。
- [ ] 不引入新依赖，不新增 HTTP 路由，不改变现有接口语义（只扩展 `task/meta` 与 `publish` 的可选字段）。

## 8. 风险、边界与回滚

- **旧记录兼容**：`dueAt`、`dependsOn` 全部可选；读取时不假设存在；清空用删除字段而不是写 `null`。
- **双实例并发**：截止日期与依赖继续走 `updateTaskMeta` 的锁内读改写，只改传入的字段，避免覆盖另一实例刚写的会话 / 合并字段。
- **依赖删除**：依赖任务被删除后，其他任务保留旧 id；UI 显示「已删除」且不阻塞，不自动清理，避免在未持有全部上下文时改写其他任务。
- **循环依赖**：Store 在锁内做 DFS；客户端只做展示，不自行判断是否允许。
- **日期时区**：`dueAt` 统一存本地日历日零点；跨时区迁移机器的用户可能看到日期漂移一天，这是「按本地日历」语义的已知边界，文档中注明。
- **搜索性能**：解析与匹配都是线性字符串操作，任务量在本地台账规模内；不新增索引。
- **洞察口径**：周期只统计 `mergedAt - createdAt`，不扣除等待验收时间；这是有意的最小口径，后续可扩展。
- **时间线重复**：`updatedAt` 只在明显晚于其他事件时出现，避免轮询噪声。
- **回滚**：
  - 截止日期：移除 UI 与注意力分类即可，字段留在记录中不影响旧版本。
  - 依赖：移除详情行、左栏 chip 与校验即可，字段留在记录中不影响旧版本。
  - 洞察：移除卡片与 `project-insights.ts` 即可。
  - 搜索：删除语法解析，恢复 `matchesSearch` 纯文本行为即可。
  - 时间线：移除分区与报告章节即可。
- **不做的事**：不做到期通知 / 日历视图、不做依赖图 / 合并阻断、不做跨项目依赖、不做保存搜索视图、不做完整状态变更日志。

## 9. 文件清单

| 文件 | 改动 |
| --- | --- |
| `src/task-meta.ts` | 截止日期纯函数 |
| `src/task-deps.ts` | 新增依赖纯函数 |
| `src/models.ts` | `WorktreeTask` 增加 `dueAt` / `dependsOn` |
| `src/store.ts` | `TaskMetaPatch` / `TaskMetaResult` / `updateTaskMeta` 扩展 |
| `src/runtime.ts` | 元数据错误映射 |
| `src/runtime/types.ts` | `PublishInput` 增加 `dueAt` |
| `src/runtime/projects.ts` | 发布时校验并写入 `dueAt` |
| `src/http.ts` | `task/meta` 透传 `dueAt` / `dependsOn` |
| `src/tools.ts` | 发布 / meta / brief 支持截止日期与依赖 |
| `src/client/publish-state.ts` | 草稿增加 `dueAt` |
| `src/client/publish.ts` | 高级区截止日期与校验 |
| `src/client/stage.ts` | 任务信息增加截止日期 / 前置任务；概览增加生命周期时间线 |
| `src/client/rail.ts` | 截止 / 依赖 chip；搜索语法提示 |
| `src/client/model.ts` | 结构化搜索接入 `filterProjectViews` |
| `src/client/search-query.ts` | 新增搜索解析与匹配纯函数 |
| `src/client/task-attention.ts` | `overdue` 分类与计数 |
| `src/client/attention-filter.ts` | 逾期筛选项 |
| `src/client/attention-summary.ts` | 逾期汇总文案 |
| `src/client/board.ts` | 逾期输入、依赖查找、Stage / Rail props |
| `src/client/board-data.ts` | 如搜索空态需要，透传查询（仅在必要时） |
| `src/client/project-insights.ts` | 新增项目洞察纯函数 |
| `src/client/project-detail.ts` | 项目洞察卡片 |
| `src/client/task-lifecycle.ts` | 新增生命周期纯函数 |
| `src/client/report.ts` | 单任务报告增加截止日期与时间线 |
| `src/client/project-report.ts` | 项目报告增加截止日期列与逐任务截止行 |
| `src/client/styles/workbench.ts` | 搜索提示 / 洞察柱状 / 时间线样式 |
| `locale/zh.json`、`locale/en.json` | 新增文案 |
| `test/task-meta.test.ts` | 截止日期用例 |
| `test/task-deps.test.ts` | 新增依赖用例 |
| `test/client-search-query.test.ts` | 新增搜索语法用例 |
| `test/client-project-insights.test.ts` | 新增洞察用例 |
| `test/client-task-lifecycle.test.ts` | 新增生命周期用例 |
| `test/store.test.ts` | `updateTaskMeta` 新字段用例 |
| `test/http-flow.test.ts` | `task/meta` / `publish` 新字段用例 |
| `test/client-model.test.ts` | 结构化搜索过滤用例 |
| `test/client-publish-state.test.ts` | 草稿截止日期用例 |
| `test/client-task-attention.test.ts` | 逾期分类 / 计数用例 |
| `test/client-report.test.ts` | 报告截止日期 / 时间线用例 |
| `test/client-project-report.test.ts` | 项目报告截止列用例 |
| `test/tools-act.test.ts` | 工具元数据用例 |
| `README.md`、`CHANGELOG.md`、`docs/frontend-design.md`、`docs/i18n-terminology.md` | 主线程更新到 1.14.0 |
| `package.json`、`package-lock.json` | 主线程更新到 1.14.0 |

## 10. 验收记录

- **状态**：5 个功能已全部实现并集成，`npm run verify` 通过；等待独立复核与 PR。

### 10.1 实施来源

| 功能 | 子 agent 分支 | 子 agent HEAD | 集成提交 |
| --- | --- | --- | --- |
| 截止日期 | `t3/task-due-dates-overdue-reminders` | `97579eb` | `f859567` |
| 前置依赖 | `t3/bd6f4b94` | `9c1473b` | `bad4e8c` |
| 项目洞察 | `t3/project-insights-cycle-stats` | `1c85f6d` | `a65da1d` |
| 结构化搜索 | `t3/046189c9` | `63775a9` | `f0bfd64` |
| 任务时间线 | `t3/task-lifecycle-timeline` | `00e2b75` | `c1b7e3b` |

所有子 agent 均从规划提交 `e74dfa1` 切出独立 worktree，各自只提交一次；主线程按顺序 cherry-pick 并解决 locale、`stage.ts`、`rail.ts`、`store.ts`、`http.ts`、`tools.ts` 与报告模块的集成冲突。

### 10.2 主线程复核修正

- `search-query.ts` 原先回引 `model.ts` 造成模块循环，改为模块内纯文本匹配（`1485894`）。
- 集成冲突合并时同时保留依赖与截止日期的字段链路：`Store.updateTaskMeta` 先校验全部字段再写入，`runtime` 错误映射、HTTP `task/meta` 与 `worktree_act` 同时接受 `dueAt` / `dependsOn`。
- `stage.ts` 只读与编辑两种模式同时渲染截止日期行与前置任务行；`rail.ts` 同时渲染截止 chip 与「等待 N 项前置」chip。
- 补全 README / CHANGELOG / `docs/frontend-design.md` / `docs/i18n-terminology.md`，版本升至 1.14.0（`cd094d3`）。
- 独立复核后修正：模型工具 `due_at` 不再强制 `String`，并允许 `number`，与 HTTP 的毫秒时间戳口径一致；前置任务候选排除已清理任务；README 补充时间戳与 `status:` 快照语义。

### 10.3 验证结果

- `npm run typecheck`：通过。
- `npm run check:locale`：`zh=778 en=778`，客户端引用 547 个 key，全部存在。
- `npm test`：**483 通过 / 0 失败**（基线 408，新增 75 项）。
- `npm run build`：`dist/index.js` 166.5kb，`dist/client.js` 562.0kb。
- `npm run verify`：以上四项全部通过。

### 10.4 验收审批

- 用户要求使用 `advisor` 审批。当前会话经 magpie 网关连接，官方 `advisor_20260301` 服务端工具未被网关转发，`advisor` 返回 `failed: unavailable`（本次再次确认）。
- 按用户全局约定改用独立模型复核：`delegate_task` + `role: review` + provider `magpie` / model `mm/workbuddy/glm-5.3[1m]`，只读审查，不改代码。
- 复核结论：**APPROVE**，0 个阻塞问题；5 条非阻塞建议中采纳 3 条（工具 `due_at` 数字透传、README `status:` 语义、前置候选排除已清理任务），其余 2 条（`depFailureText` 中文关键词耦合、引号内逗号仍按标签分隔）保留为已知边界，不影响交付。

### 10.5 PR

- 分支：`t3/daily-5-feature-pipeline`
- PR：待创建（创建后回填编号与链接）。
