# 每日功能批次 · 2026-11-27 · v1.16.0

> 批次主题：**全局视野与工作闭环**（总览、焦点、复制、交接、校准）
>
> 一句话目标：让工作台从「能看见每个任务」再进一步，回答五个新问题——**哪个项目最需要我、现在先做哪件事、同样的活怎么快速再来一次、怎么把任务交给下一个 Agent、估算和实际投入差多少**。
>
> 交付方式：一个 PR（`t3/daily-five-features-v116` → `master`），5 个功能同批验收。
>
> 分工：主线程负责方案、接口约定、任务拆分、集成、验收、文档与 PR；5 个 `pi` 子 agent 分别负责 5 个功能的编码落地与测试。上一批次（1.15.0 工时 / 估算 / 依赖图 / 风险雷达 / 保存视图）的文档见 git 历史。
>
> 状态：方案已定，待实施。

## 0. 批次总览

| # | 功能 | 一句话价值 | 主要落点 |
| --- | --- | --- | --- |
| 1 | 跨项目总览 | 未选中任务时展示所有项目的负载、关注、逾期、阻塞、近 7 天节奏与风险 | 纯函数 / 看板空态 / 左栏 / 样式 |
| 2 | 今日焦点 | 跨项目排出一份「现在先做什么」的行动队列，并说明为什么排在前面 | 纯函数 / 直栏入口 / 对话框 / 样式 |
| 3 | 任务复制 | 一键用现有任务的描述、验收标准、标签、优先级、估算预填发布表单 | 发布草稿 / 发布弹窗 / 任务详情 / 看板 |
| 4 | 交接简报 | 生成面向下一个 Agent 或同事的 Markdown：目标、进度、代码现状、下一步、注意事项 | 纯函数 / 任务详情 / 看板动作 |
| 5 | 估算校准 | 用已完成任务的估算点数与实际工时，回答「1 点大约等于多少小时」 | 项目洞察 / 项目详情 / 样式 |

设计原则：

- **全部客户端派生，零服务端变更**：本批次不新增 HTTP 路由、不修改任务台账字段、不引入新依赖；所有数据都来自 `GET projects` / `GET task` 已返回的任务、快照和 diff。
- **纯函数优先**：总览聚合、焦点排序、复制草稿、交接文档、估算校准都放在无 DOM 的纯模块里，所有涉及「现在」的函数接受可注入的 `now`，服务端、客户端与测试共用同一套规则。
- **不改变状态机与排序**：新功能只增加派生视图、导出文本与发布预填，不改变 `statusOf`、`compareTaskOrder`、注意力分类或合并门禁。
- **默认不打扰**：没有项目时总览给添加项目入口；没有可执行任务时焦点对话框给空态；没有已完成样本时校准只显示一句空态提示；没有可复制内容时按钮不出现。
- **复用既有口径**：总览复用项目洞察与风险雷达；焦点复用风险雷达的分值作为基础分；交接简报复用验收报告的 Markdown 助手与任务字段口径；校准复用 `elapsedWorkMs` 与 `parseEstimate`。
- **文档即验收**：每个功能都必须有功能说明、动机、预期效果、收益、实现方案、验收标准和测试要点。

---

## 1. 跨项目总览（Portfolio overview）

### 1.1 功能说明

看板在**没有选中任务、也没有选中项目**时，不再显示「请选择任务」的空占位，而是显示「总览」页面：

- 顶部是全局统计：项目数、进行中任务、需要关注、逾期、等待验收、近 7 天合并、进行中估算点数。
- 中部是项目列表：每个项目一行，显示项目名、仓库路径、进行中、需要关注、逾期、阻塞、待验收、近 7 天合并、风险（高 / 中）。
- 点击项目行打开该项目的项目详情；项目详情和任务详情仍然是原来的页面。
- 项目列表下方是最近 7 个本地日历日的新建 / 合并双柱图，口径与项目洞察一致。
- 左栏顶部新增「总览」入口；从任何项目或任务返回总览时，清空当前选中项。
- 没有任何项目时，总览显示空态和「添加项目」按钮，而不是一句「请选择任务」。

总览是**只读派生页**：不请求新接口、不写台账、不改变任务状态和看板排序。

### 1.2 为什么做

工作台目前的最小导航单位是「项目」：左栏按项目分组，点项目看项目详情，点任务看任务详情。项目一多，用户必须先扫一遍左栏，才能知道哪个项目最需要处理；而左栏的注意力汇总只给全局计数，不能按项目下钻。

1.15.0 已经提供了项目洞察、风险雷达、依赖图、工时和估算，但这些信息都锁在单个项目详情里。跨项目工作时，缺少一个「先看哪个项目」的入口。

### 1.3 预期效果

- 打开工作台或按「总览」后，第一屏就能看到所有项目的负载与风险，不需要逐个点开。
- 项目行按「需要关注 → 逾期 → 阻塞 → 进行中 → 名称」排序，最需要处理的项目自然排在最前。
- 点击任一项目行进入项目详情；从项目详情返回总览后，总览状态仍在。
- 空项目、旧任务、异常时间戳、缺失字段都不会让总览出现 `NaN`、负数或空白表格。
- 窄屏下总览与现有 Stage / ProjectDetail 一样响应式：左栏变为抽屉，总览内容可滚动。

### 1.4 收益

- **可导航**：把「哪个项目最需要我」变成一个可点击的列表，而不是靠记忆和扫视。
- **可比较**：项目之间的进行中、逾期、阻塞、风险、近 7 天合并放在同一张表里，避免单项目视角的偏差。
- **可下钻**：总览只做汇总，点击后仍然进入已有的项目详情，不引入第二套项目页面。
- **零维护**：所有数字都是现有任务字段的派生结果，不需要新增同步任务或后台聚合。

### 1.5 实现方案

**新增纯函数模块** `src/client/portfolio.ts`：

```ts
import type { ProjectView, TaskView } from '../models'

export interface PortfolioProject {
  projectId: string
  name: string
  repoPath: string
  /** 未归档、未合并、未清理的任务。 */
  open: number
  /** 至少命中一个注意力分类的任务；依赖看板传入的实时注意力。 */
  attention: number
  overdue: number
  /** 有未完成或缺失前置的开放任务数。 */
  blocked: number
  /** review / reviewing。 */
  review: number
  mergedLast7: number
  highRisk: number
  mediumRisk: number
  /** 开放任务中有效估算点数的总和。 */
  estimatePoints: number
  /** 最久未完成的开放任务天数；没有开放任务为 null。 */
  oldestOpenDays: number | null
}

export interface PortfolioDay {
  /** -6 .. 0，0 表示今天。 */
  offset: number
  /** 本地日历日零点，用于 tooltip。 */
  start: number
  created: number
  merged: number
}

export interface PortfolioTotals {
  projects: number
  open: number
  attention: number
  overdue: number
  blocked: number
  review: number
  mergedLast7: number
  highRisk: number
  mediumRisk: number
  estimatePoints: number
}

export interface PortfolioSummary {
  projects: PortfolioProject[]
  /** 按「注意力 → 逾期 → 阻塞 → 进行中 → 名称 → id」排序。 */
  ranked: PortfolioProject[]
  totals: PortfolioTotals
  daily: PortfolioDay[]
}

export interface PortfolioInput {
  views: ProjectView[]
  /**
   * 看板已经算好的实时注意力。省略时 `attention` 记 0：总览不做第二套
   * 注意力推导，避免和直栏、任务行漂移。
   */
  attentionOf?: (view: TaskView) => { categories: Set<string> } | null
  now?: number
}

/** 7 个本地日历日；与项目洞察的窗口一致。 */
export const PORTFOLIO_DAYS = 7

export function buildPortfolio(input: PortfolioInput): PortfolioSummary
```

规则：

- **开放任务**：`!archivedAt && status !== 'merged' && status !== 'cleaned'`；`broken` 算开放。
- **逾期**：`dueStateOf(task.dueAt, at)` 返回 `overdue`。
- **阻塞**：先用全部任务建立 `Map<id, task>`，再对每个开放任务调用 `dependencyStatus(task, lookup)`；`open.length + missing.length > 0` 记一次。
- **风险**：复用 `buildProjectRisk(view.tasks, at)`，`high` / `medium` 取计数；不要在总览里另写评分。
- **估算**：复用 `parseEstimate`；只累加开放任务的有效值。
- **近 7 天合并**：`mergedAt` 落在 7 个本地日历日窗口内；未来时间、非法时间忽略。`daily` 的 created / merged 两个事件独立计数，同一任务同日创建并合并会在两根柱子上各记一次。
- **最新活动**：`oldestOpenDays` 使用 `createdAt`，未来创建时间按 0 天处理；不要产生负数。
- **无样本**：空项目返回全 0、`oldestOpenDays: null`、`daily` 仍有 7 个零桶。
- **不修改入参**：所有排序在副本上完成。

**新增视图** `src/client/portfolio-view.ts`：

```ts
export interface PortfolioViewProps {
  t: any
  views: ProjectView[]
  attentionOf: (view: TaskView) => { categories: Set<string> } | null
  railHidden: boolean
  narrow: boolean
  onToggleRail: () => void
  onSelectProject: (projectId: string) => void
  onPublish: () => void
  onAddProject: () => void
}

export function PortfolioView(props: PortfolioViewProps): any
```

- 顶部栏沿用 Stage / ProjectDetail 的 `.dshwd-topbar` 结构与左栏折叠按钮；面包屑显示「总览」。
- 统计卡复用现有 `.dshw-stats` / `.dshw-stat` 原语的视觉语言；不要新造一套卡片样式。
- 项目表使用真实 `<table>` 或语义化的行按钮列表。每一行必须是可点击按钮，`aria-label` 包含项目名与关键计数；不要只在整行上绑定 `onClick` 而没有键盘入口。
- 风险列显示「高 N · 中 M」；两者都为 0 时显示弱化文案。
- 近 7 天柱图复用 `dshwd-insights-*` 样式或新增 `dshwd-portfolio-*` 样式；每根柱子有 `title` 和 `aria-label`，不能只靠颜色。
- 空态：`views.length === 0` 时显示标题、说明和「添加项目」按钮；不要显示空表格。
- 窄屏：项目表可以横向滚动，但不能撑破 Stage；所有文本允许换行或省略，`title` 保留完整值。

**看板接线** `src/client/board.ts`：

- `selectProject` / `selectTask` 保持原样；新增 `selectOverview = () => { setSelectedTaskId(''); setSelectedProjectId('') }`。
- 在「既没有 `selectedTask` 也没有 `selectedProject`」的分支里：`loaded && !err` 时渲染 `PortfolioView`；`!loaded` 或 `err` 时保留现有的加载 / 错误 / 重试界面。
- 传入 `views`（未过滤的完整项目视图，而不是搜索过滤后的 `filtered`）、`attentionOf`、`onSelectProject`、`onPublish: () => openPublish()`、`onAddProject: () => setAddOpen(true)`。
- 总览页不渲染 Inspector；现有 `!selectedTask` 的 class 已经会隐藏右栏。

**左栏** `src/client/rail.ts`：

- `RailProps` 新增 `overviewActive?: boolean` 与 `onSelectOverview: () => void`。
- 在顶部 logo 行或搜索框上方增加一个紧凑的「总览」按钮；`aria-pressed` 表示当前是否在总览页，键盘可达。
- 点击只调用 `onSelectOverview`，不改变搜索、筛选、标签和归档开关。

**样式** `src/client/styles/workbench.ts`：

- 新增 `.dshwd-portfolio-*` 样式；复用现有 token、间距、圆角、表头颜色和窄屏断点。
- 表格在窄屏允许横向滚动；不要引入固定像素宽度或新的字体。

**边界**：

- 总览不显示任务列表，不替代左栏；它只做项目级汇总。
- 不做项目排序拖拽、不做自定义列、不做导出。
- 不请求 Git、不请求新接口、不写 localStorage。
- 不把 `filtered`（搜索 / 标签 / 注意力过滤后的视图）传给总览，否则总览会跟着左栏筛选变化而失真。

### 1.6 验收标准

- [ ] 首次打开工作台、未选中任何项目 / 任务时显示总览，而不是「请选择任务」。
- [ ] 点击任一项目行进入项目详情；点击左栏「总览」返回总览并清空选中项。
- [ ] 全局统计与各项目行数字一致：进行中、关注、逾期、阻塞、待验收、近 7 天合并、风险、估算点数。
- [ ] 空项目、全部已合并 / 已清理 / 已归档项目、异常时间戳、字符串字段不产生 `NaN`、负数或崩溃。
- [ ] 旧任务（无 `dueAt` / `estimate` / `dependsOn`）正常参与统计，按 0 / 未设置处理。
- [ ] 总览不改变任务状态、排序、筛选或左栏计数。
- [ ] 中英文 locale key 完全一致，`npm run check:locale` 通过。
- [ ] 窄屏下总览可滚动、项目行可点击、左栏抽屉正常开关。

### 1.7 测试要点

新增 `test/client-portfolio.test.ts`：

- 空视图：全 0、7 个零桶、`ranked` 为空。
- 混合状态：ready / developing / review / merged / cleaned / broken 的 open 计数。
- 归档任务不计入 open，但仍参与近 7 天活动。
- 逾期、今天、未来、非法 `dueAt` 的计数。
- 阻塞：未完成前置、缺失前置各记一次；已完成前置不计。
- 注意力回调返回多个分类时只计一次任务；省略回调时 attention 为 0。
- 风险计数与 `buildProjectRisk` 一致。
- 有效 / 非法 / 非数字 `estimate` 的点数累加。
- 近 7 天窗口边界（本地日历日、未来时间、6 天前 / 8 天前）。
- `ranked` 排序：注意力优先，其次逾期、阻塞、进行中、名称。
- 无 `NaN` / `Infinity` / 负数。

---

## 2. 今日焦点（Focus queue）

### 2.1 功能说明

左栏新增「今日焦点」入口，显示当前跨项目可执行任务的数量；点击打开对话框，列出最多 10 个**现在最值得处理**的任务：

- 每行显示任务标题、所属项目、排名、以及 1–3 个原因 chip（例如「逾期 2 天」「今天到期」「待验收」「高优先级」「完成可解锁 3 项」「风险分 6」「等待回答」）。
- 点击一行关闭对话框并打开该任务详情。
- 对话框顶部显示「N 个可立即推进 · M 个等待前置 · 共 K 个开放任务」；没有可执行任务时显示空态。
- 被未完成 / 缺失前置阻塞的任务**不进入行动列表**，只计入「等待前置」，避免把不能开工的任务排在最前。
- 「今日焦点」只做提示和跳转，不改变看板排序、注意力筛选或任务状态。

### 2.2 为什么做

1.15.0 的风险雷达回答「哪里有风险」，注意力汇总回答「有多少件事需要关注」，但两者都不是行动队列：

- 风险雷达按项目内风险分排序，会把「阻塞中、暂时做不了」的任务排在前面。
- 注意力汇总只给分类计数，用户仍要自己扫列表决定先做哪个。
- 跨项目工作时，用户需要在多个项目之间反复比较截止日期、优先级、前置依赖和验收状态。

缺少一个把「紧急度 + 可执行性 + 杠杆」合在一起的跨项目视图。

### 2.3 预期效果

- 用户点开「今日焦点」，第一行就是最该处理的任务；原因可读，不需要再逐个打开任务判断。
- 有前置未完成的任务不会占据行动列表，只在「等待前置」计数里出现。
- 等待回答的任务、待验收任务、高优先级任务、临近截止任务能稳定排到前面。
- 全部任务关闭或没有开放任务时，入口隐藏；有开放但全部被阻塞时，对话框显示「等待前置」空态，而不是空白列表。
- 任务字段缺失、时间戳异常、估算 / 依赖数据损坏时，排序仍然稳定，不出现 `NaN`。

### 2.4 收益

- **可行动**：从「知道有风险」到「知道先做哪一件」，减少选择成本。
- **跨项目**：不必先定位项目，再在项目里找任务。
- **有解释**：每个排名都带原因，用户能判断是否认同，而不是接受黑盒排序。
- **零副作用**：不写台账、不改状态、不动看板顺序，随时可忽略。

### 2.5 实现方案

**新增纯函数模块** `src/client/focus-queue.ts`：

```ts
import type { ProjectView, TaskView } from '../models'

export type FocusReasonCode =
  | 'pending'
  | 'overdue'
  | 'due-today'
  | 'due-soon'
  | 'review'
  | 'high-priority'
  | 'stalled'
  | 'unblocks'
  | 'risk'

export interface FocusReason {
  code: FocusReasonCode
  /** 逾期 / 停滞天数、解锁数量或风险分；没有数字时省略。 */
  n?: number
}

export interface FocusItem {
  taskId: string
  projectId: string
  projectName: string
  title: string
  score: number
  reasons: FocusReason[]
}

export interface FocusQueue {
  /** 可执行任务，已排序并截断到 FOCUS_LIMIT。 */
  items: FocusItem[]
  /** 没有未完成 / 缺失前置的开放任务数。 */
  ready: number
  /** 有未完成 / 缺失前置的开放任务数（不进入 items）。 */
  waiting: number
  /** 全部开放任务数。 */
  total: number
}

export interface FocusInput {
  views: ProjectView[]
  /** 看板实时注意力；用于识别「等待回答」。省略时不做 pending 加权。 */
  attentionOf?: (view: TaskView) => { categories: Set<string> } | null
  now?: number
}

export const FOCUS_LIMIT = 10
export const FOCUS_SCORE_MAX = 12

export function buildFocusQueue(input: FocusInput): FocusQueue
```

规则：

- **候选**：开放任务（`!archivedAt && status !== 'merged' && status !== 'cleaned'`），`broken` 也参与（它需要先恢复）。
- **等待前置**：用全部任务建立 lookup，对每个候选调用 `dependencyStatus(task, lookup)`；`open.length + missing.length > 0` 计入 `waiting` 并从 `items` 排除。
- **基础分**：对每个项目调用一次 `buildProjectRisk(project.tasks, at)`，建立 `taskId -> score` 映射；候选的基础分就是风险雷达分值（0..10）。**不要另写一套风险评分**。
- **行动加权**（在基础分上加，最后 `Math.min(FOCUS_SCORE_MAX, score)`）：
  - `pending` 注意力分类：+3；
  - 状态 `review` / `reviewing`：+2；
  - `priority === 'high'`：+2；
  - 已置顶（`pinnedAt` 有效）：+1；
  - 该任务完成后可解锁的开放任务数 `unblocks`：+`Math.min(2, unblocks)`。
- **原因 chip**：从字段派生并按固定顺序输出，最多保留 3 个：
  1. `pending`（等待回答）
  2. `overdue` / `due-today` / `due-soon`
  3. `review`
  4. `high-priority`
  5. `stalled`
  6. `unblocks`
  7. `risk`（当基础分 > 0 且前面没有原因时补一个）
- **排序**：score 降序 → 有效 `dueAt` 升序（无截止排最后）→ 优先级 high > normal > low → `createdAt` 升序（更早的排前）→ taskId 升序，保证稳定可测。
- **计数**：`ready = total - waiting`；`total` 是全部开放任务。
- **异常**：负数 / 非有限 / 未来时间戳按「无」处理；阻塞依赖的 lookup 覆盖全部任务（含已归档），以便把「已完成 / 缺失」区分开。
- **不修改入参**，不写状态。

**视图** `src/client/focus-queue-view.ts`：

```ts
export interface FocusQueueDialogProps {
  t: any
  queue: FocusQueue
  onClose: () => void
  onSelectTask: (taskId: string, projectId: string) => void
}

export function FocusQueueDialog(props: FocusQueueDialogProps): any
```

- 使用现有 `Modal` 原语（`src/client/primitives`）获得焦点圈定、Escape 关闭和焦点返回；`size: 'lg'`。
- 标题「今日焦点」，副标题说明排序口径；正文顶部显示 ready / waiting / total 三个计数。
- 列表每行是 `<button>`，包含排名、标题、项目名、原因 chip；`aria-label` 由标题、项目名和原因组成。
- 空态分两种：`total === 0`（没有开放任务）与 `ready === 0 && waiting > 0`（全部等待前置）；两种文案都要有。
- 底部只有「关闭」按钮；点击任务行先 `onClose()` 再 `onSelectTask()`，避免对话框和任务详情同时抢焦点。

**看板接线** `src/client/board.ts`：

- 新增 `focusOpen` 状态。
- `const focus = React.useMemo(() => buildFocusQueue({ views: allViews, attentionOf, now: Date.now() }), [allViews, attentionMap])`；`attentionOf` 依赖 `attentionMap`，不要写成每次渲染新建的函数。
- 左栏传入 `focusCount: focus.items.length`、`focusReady`、`focusWaiting`、`focusTotal`、`onOpenFocus: () => setFocusOpen(true)`。
- 渲染 `focusOpen ? h(FocusQueueDialog, { t, queue: focus, onClose: () => setFocusOpen(false), onSelectTask: (id, projectId) => { setFocusOpen(false); selectTask(id, projectId) } }) : null`。
- 不要复用 `busy` 禁用焦点入口：打开对话框是纯本地操作。

**左栏** `src/client/rail.ts`：

- `RailProps` 新增 `focusCount?: number`、`focusReady?: number`、`focusWaiting?: number`、`focusTotal?: number`、`onOpenFocus?: () => void`。
- 在注意力汇总条下方渲染「今日焦点」按钮：图标 + 文案 + 计数徽标；`aria-haspopup="dialog"`，`aria-label` 包含可执行数量。
- `focusTotal > 0` 时显示；没有开放任务时隐藏，避免空入口。
- 不要改变左栏现有的筛选、搜索或任务行布局。

**样式** `src/client/styles/workbench.ts`：

- 新增 `.dshwd-focus-entry`、`.dshwd-focus-*` 样式；复用现有按钮高度、chip、对话框间距和 token。
- 原因 chip 允许换行；窄屏下列表行纵向排列，不能横向撑破。

**边界**：

- 不做自动执行、不做通知、不做定时刷新；用户打开时按当前快照计算。
- 不做手动排序、不做「稍后处理」、不写 localStorage。
- 与风险雷达的分工写进文档：风险雷达是项目内的风险清单（含阻塞），今日焦点是跨项目的行动队列（排除阻塞、强调可执行性与杠杆）。
- 与注意力汇总的分工：汇总条是分类计数，焦点是任务级排序；两者共用注意力回调，不各自维护分类。

### 2.6 验收标准

- [ ] 有开放任务时左栏显示「今日焦点」入口与数量；点击打开对话框，列出最多 10 项。
- [ ] 有未完成 / 缺失前置的任务不进入列表，只增加「等待前置」计数。
- [ ] 逾期、今天到期、待验收、高优先级、等待回答、可解锁多任务的任务能按规则排到前面，原因 chip 可读。
- [ ] 点击任务行关闭对话框并打开对应任务；焦点返回左栏入口。
- [ ] 没有开放任务时入口隐藏；全部被阻塞时对话框显示等待前置空态。
- [ ] 旧任务、非法时间戳、缺失依赖、异常估算不产生 `NaN` 或崩溃。
- [ ] 不改变看板排序、注意力筛选和任务状态；不写台账、不请求新接口。
- [ ] 中英文 locale key 完全一致，`npm run check:locale` 通过。

### 2.7 测试要点

新增 `test/client-focus-queue.test.ts`：

- 空视图 / 全部关闭任务：`items` 为空，计数为 0。
- 开放任务计数：ready / waiting / total。
- 未完成前置、缺失前置、已完成前置、跨项目前置。
- 风险基础分复用：同一任务在风险雷达中的分值成为焦点基础分。
- pending / review / high priority / pinned / unblocks 的加权与上限。
- 原因顺序与去重；没有其他原因时补 `risk`。
- 排序：分数相同按截止、优先级、创建时间、id 稳定排序。
- 截断到 10 项，但计数不受截断影响。
- 非法 `dueAt`、未来时间、负数、字符串字段。
- 注意力回调缺失时的行为。

---

## 3. 任务复制（Duplicate task）

### 3.1 功能说明

任务详情（`Stage`）顶部操作区新增「复制为新任务」按钮：

- 点击后在当前项目下打开发布弹窗，并用当前任务预填：
  - 标题、描述；
  - 验收标准（全部放入手动标准文本框，每行一条）；
  - 标签、优先级、规模估算；
  - 基线分支（沿用任务原来的 `baseBranch`）。
- **不复制**：任务分支名（新任务必须自动生成新分支）、截止日期（旧截止日期可能已过期）、备注、会话、验收勾选状态、前置依赖。
- 发布弹窗仍然是原来的发布流程：用户可改标题、补充标准、选择是否立即启动会话，确认后走 `POST publish`。
- 对已合并 / 已清理 / 已归档任务同样可用，便于重复性工作一键再来一次。

### 3.2 为什么做

当前发布任务需要从头填写标题、描述、验收标准和标签。日常批次、回归任务、同一功能在不同项目复刻时，大量内容与上一个任务相同；手工复制既慢又容易漏掉验收标准。

工作台已有「前序任务续作」入口，但续作解决的是「接着做」，不是「照同样规格再做一个」。两者场景不同，入口也不应混用。

### 3.3 预期效果

- 点击一次，发布表单已经带好描述、验收标准、标签、优先级、估算和基线；用户只需确认或微调。
- 新任务使用新的自动分支，不会覆盖或复用原任务分支。
- 不把旧截止日期带进新任务，避免新任务一创建就逾期。
- 关闭发布弹窗后，普通「发布任务」入口不会残留复制草稿。
- 原任务没有任何字段时，复制仍能打开一个空白发布表单，不报错。

### 3.4 收益

- **省时**：重复性任务从「重新填一遍」变成「确认一下」。
- **一致性**：验收标准和描述沿用原任务，减少漏项。
- **低风险**：只复用发布弹窗和现有 `POST publish`，不新增接口、不写台账、不改状态机。
- **可预期**：分支、截止日期、依赖等「一次性」字段明确不复制，避免隐式继承。

### 3.5 实现方案

**发布草稿** `src/client/publish-state.ts`：

```ts
import type { WorktreeTask } from '../models'

export interface PublishDraft {
  // ...现有字段保持不变
  /** 复制任务时沿用的基线分支；'' 表示使用项目默认基线。 */
  baseBranch?: string
}

/**
 * 从现有任务生成发布草稿。
 * - 标题 / 描述 / 验收标准 / 标签 / 优先级 / 估算 / 基线沿用；
 * - 分支名、截止日期、备注、勾选状态、依赖不复制。
 * - 字段缺失或非法时按「未设置」处理，不抛异常。
 */
export function draftFromTask(task: WorktreeTask): PublishDraft
```

- `initialPublishForm` 增加 `baseBranch: String(d.baseBranch || '')`。
- `publishDraftDirty` 比较 `baseBranch`（空串与 `undefined` 视为相同）。
- `draftFromTask` 的验收标准取 `task.acceptanceCriteria` 原始列表（去空、去重，使用 `normalizeCriteria`），全部放进 `manualCriteria`，`pickedCriteria: []`；不要读取 `checkedCriteria`。
- 标签用 `task.tags.join(', ')`；优先级只接受 `low` / `high`，其余回落 `normal`；估算只接受 `TASK_ESTIMATES` 中的值，转成字符串；`dueAt: ''`、`branchName: ''`。
- 不复制 `notes`。

**发布弹窗** `src/client/publish.ts`：

- 初始 `base` 改为：
  ```ts
  const [base, setBase] = React.useState(
    parentTask ? parentTask.baseBranch : (form0.baseBranch || (project ? project.baseBranch : '')),
  )
  ```
- `currentForm()` 增加 `baseBranch: base`。
- 现有 `projectId` 变化时重置 `base` 的 effect 保持原样：复制草稿只在首次挂载时生效；用户切换项目后回到项目默认基线。
- 高级区展开条件不需要因为 `baseBranch` 改变；基线在基础区可见。

**任务详情** `src/client/stage.ts`：

- `StageProps` 新增 `onDuplicate?: () => void`。
- 在顶部操作区、CTA 按钮之前渲染一个 ghost 按钮：
  ```tsx
  h('button', {
    type: 'button',
    className: 'dshwd-btn dshwd-btn-ghost',
    title: t.taskDuplicateHint,
    'aria-label': t.taskDuplicate + ' · ' + task.title,
    onClick: () => props.onDuplicate && props.onDuplicate(),
  }, h(Icon, { name: 'copy' }), h('span', { className: 'dshwd-btn-label' }, t.taskDuplicate))
  ```
- 只在 `onDuplicate` 存在时渲染；不改变现有 CTA 的禁用逻辑。

**看板** `src/client/board.ts`：

- `openPublish` 签名改为：
  ```ts
  const openPublish = (projectId?: string, parentId = '', draft: any = null) => {
    // ...现有 projectId / parentId 逻辑
    setPublishDraft(draft)
    setPublishOpen(true)
  }
  ```
  **必须显式 `setPublishDraft(draft)`**：这样普通发布（第三参数默认 `null`）会清掉上一次未提交的复制草稿，避免草稿泄漏。
- 新增：
  ```ts
  const duplicateTask = (tv: TaskView) => {
    openPublish(tv.task.projectId || selectedProjectId, '', draftFromTask(tv.task))
  }
  ```
- 给 `Stage` 传 `onDuplicate: selectedTask ? () => duplicateTask(selectedTask) : undefined`。
- `useBoardActions` 的 `openPublish` 类型保持 `(projectId?: string, parentId?: string) => void` 即可（第三参数可选），续作调用行为不变。

**边界**：

- 不新增接口；仍然使用现有 `POST publish`。
- 不复制旧分支名，不允许两个任务共用同一个 worktree。
- 不复制截止日期；如果用户需要，可在发布弹窗重新选择。
- 不复制备注、会话绑定、验收勾选、前置依赖、置顶、工时。
- 复制动作本身不写台账；只有在用户确认发布后才创建任务。

### 3.6 验收标准

- [ ] 任意状态的任务详情都能看到「复制为新任务」按钮，点击打开发布弹窗。
- [ ] 标题、描述、验收标准、标签、优先级、估算、基线被正确预填；分支为空并自动生成。
- [ ] 截止日期、备注、勾选状态、依赖、会话不被复制。
- [ ] 关闭复制弹窗后，普通「发布任务」不再带出复制草稿。
- [ ] 用户切换项目后，基线回到新项目的默认值，不会把旧项目基线带到新项目。
- [ ] 原任务字段缺失 / 非法时，复制弹窗仍可打开并允许手动填写。
- [ ] 中英文 locale key 完全一致，`npm run check:locale` 通过。

### 3.7 测试要点

新增 `test/client-duplicate-task.test.ts`（或在 `test/client-publish-state.test.ts` 扩展）：

- `draftFromTask` 完整任务：标题、描述、标准、标签、优先级、估算、基线。
- 空任务 / 缺字段 / 非法优先级 / 非法估算 / 重复标准。
- 不复制 `dueAt`、`branchName`、`notes`、`checkedCriteria`。
- `initialPublishForm` 恢复 `baseBranch`；`publishDraftDirty` 对 base 变化敏感、对空串与 `undefined` 不敏感。
- 连续两次普通发布不会复用复制草稿（可由看板逻辑或纯函数测试覆盖；至少在测试里断言 `openPublish` 的草稿参数默认清空的行为约定）。
- 发布弹窗初始 base 使用草稿基线（纯函数或静态渲染测试均可）。

---

## 4. 交接简报（Handoff brief）

### 4.1 功能说明

任务详情「概览」新增「交接简报」区块：

- 说明文字：生成面向下一个 Agent 或同事的 Markdown，包含目标、当前进度、代码现状、下一步建议和注意事项。
- 「复制交接简报」按钮：把当前任务、快照和已加载的 diff 汇总成 Markdown 写入剪贴板，并给出成功 / 失败 Toast。
- 简报是**面向未来**的交接文档，不是验收存档：
  - 验收报告（已有）回答「这个任务做了什么、验收是否通过、改了哪些文件」；
  - 交接简报回答「接手的人现在要做什么、从哪里继续、有哪些坑」。
- 不下载文件，只复制；不写入任务台账；不请求新接口。

### 4.2 为什么做

这个插件的核心场景是多个 Agent / 多个人接力处理同一个 worktree。当前已有验收报告，但它偏重「事后存档」：以验收标准和改动清单为主，缺少「下一步怎么做」的行动指引。

实际交接时，接手方最需要知道的是：

1. 任务目标是什么；
2. 现在做到哪一步，哪些验收标准还没完成；
3. 代码在哪个分支 / worktree，HEAD 是什么，有没有未提交改动或 stash；
4. 前置任务是否完成；
5. 下一步应该启动、继续、验收还是合并；
6. 有哪些历史坑（备注、post-merge 提交、验收基于旧提交等）。

这些信息分散在任务详情、验收报告、Inspector 和 diff 中，手工整理容易遗漏。

### 4.3 预期效果

- 点击一次，得到一份可以直接贴给下一个 Agent 或同事的 Markdown。
- 简报中的状态、分支、HEAD、验收进度、依赖状态与界面完全一致。
- 没有 diff、没有提交、没有会话、没有验收标准时，简报仍然可读，并明确说明缺什么。
- 已合并 / 已清理 / 已归档任务也能生成简报，用于复盘或后续任务交接。
- 交接简报与验收报告共享字段口径，不会出现两份文档对同一任务给出不同数字。

### 4.4 收益

- **可接力**：把「口头交接」变成结构化文档，减少上下文丢失。
- **可复用**：直接粘贴到新 Agent 的提示词、PR 描述或聊天中。
- **可审计**：简报包含生成时间、HEAD、状态和未完成项，方便回溯。
- **低维护**：复用现有任务字段、报告助手和 diff 状态，不新增数据源。

### 4.5 实现方案

**新增纯函数模块** `src/client/handoff.ts`：

```ts
import type { TaskDiff, TaskSnapshot, WorktreeTask } from '../models'

export interface HandoffInput {
  task: WorktreeTask
  snapshot: TaskSnapshot
  /** 已加载的 diff；未加载或加载失败时传 null。 */
  diff: TaskDiff | null
  /** 全部任务，用于解析前置任务的完成 / 缺失状态；省略时按未知处理。 */
  tasks?: WorktreeTask[]
  projectName: string
  statusLabel: string
  t: Record<string, any>
  now?: number
}

/** 生成面向接手方的 Markdown 交接简报。纯函数，不读时钟（除非未传 now）。 */
export function buildHandoffBrief(input: HandoffInput): string
```

**输出结构**（章节标题全部来自 locale，英文界面输出英文标题）：

```md
# 交接简报：<title>

- 项目：<projectName>
- 任务分支：`<branch>`
- 基线分支：`<baseBranch>`
- 工作区：`<worktreePath>`
- 状态：<statusLabel>
- 当前提交：`<head sha>`（无法解析时 —）
- 会话：`<sessionId>` / 尚未绑定会话
- 生成时间：YYYY-MM-DD HH:mm

## 任务目标
<description 或 —>

## 当前进度
- 验收标准：N/M（未全部完成时列出未勾选项）
- 前置任务：已完成 / 仍有 N 项未完成：a、b / 有 N 项缺失
- 规模估算 / 工时 / 截止日期（按现有字段，缺失显示未设置）

## 代码现状
- 最近提交（最多 5 条，短 SHA + subject）
- 改动概览：N 个文件 · +A / -D；列最多 10 个文件路径与增删行数
- 未提交改动：N；待恢复 stash：N

## 下一步建议
- 按状态与未完成项派生的 1–4 条行动建议

## 注意事项
- 任务备注
- post-merge 提交、验收基于旧提交、stash、前置缺失等风险
- 没有内容时写「暂无特别注意事项」
```

**复用与口径**：

- Markdown 转义复用 `mdInline` / `mdBlock` / `mdCodeCell` / `reportTimestamp` / `fill`（`src/client/markdown.ts`）。
- 验收标准复用 `criteria(task, snapshot.status)` / `criteriaProgress`（`src/client/model.ts`），与界面和验收报告一致。
- 截止日期、估算复用 `dueInputValue` / `dueStateOf` / `parseEstimate`（`src/task-meta.ts`）。
- 工时复用 `workTimingText(t, task, now)`（`src/client/work-format.ts`）。
- HEAD 复用 `branchHeadSha(task, snapshot)`（`src/client/model.ts`）。
- 前置状态复用 `dependencyStatus(task, lookup)`（`src/task-deps.ts`）；lookup 由 `tasks` 构建，包含已归档任务。
- 最近提交取 `snapshot.worktree.commits` 最后 5 条；diff 只输出文件路径与增删行数，**不输出 diff 正文**。
- 不要在 `handoff.ts` 里复制报告里的日期格式化、状态映射或验收进度逻辑；需要时先抽公共助手，或直接复用上述函数。
- 与验收报告的分工写进代码注释：`report.ts` = 验收存档，`handoff.ts` = 面向接手方的行动交接。

**下一步建议派生规则**（按顺序，去重，最多 4 条）：

1. 有未完成 / 缺失前置：先完成前置任务（列出标题）。
2. 状态 `broken`：先修复工作区异常，再继续。
3. 状态 `ready` 且无会话：创建会话并开始开发。
4. 状态 `developing` / `reviewing`：继续开发并提交改动；`reviewing` 额外提示主仓库正在验收状态。
5. 状态 `review`：进入验收，核对验收标准并检查代码改动。
6. 验收标准有未勾选项：列出还差 N 条。
7. 状态 `merged` 且 `postMergeAhead > 0`：分支在合并后又有提交，需要再次合并。
8. 状态 `merged` / `cleaned`：任务已合并，可按需清理 worktree 或创建后续任务。
9. 没有可派生建议时：写「暂无额外建议，按任务描述继续」。

**视图** `src/client/stage.ts`：

- `StageProps` 新增 `onCopyHandoff?: () => void` 与 `handoffBusy?: boolean`。
- 在 `Overview` 中新增 `HandoffSection`，位置在 `TaskMetaSection` 之后、`TaskLifecycleSection` 之前：
  - 标题 `t.handoffTitle`；
  - 说明 `t.handoffHint`；
  - 右侧「复制交接简报」按钮（ghost / mini），`disabled` 为 `handoffBusy`，`aria-label` 包含任务标题；
  - 没有 `onCopyHandoff` 时不渲染按钮，但区块仍可显示说明（SSR / 测试友好）。
- 不要改动验收标准区块现有的复制 / 下载报告按钮。

**看板与动作** `src/client/board.ts`、`src/client/board/use-board-actions.ts`：

- `UseBoardActionsArgs` 新增 `tasks: WorktreeTask[]`（由 board 传入 `allViews.map((tv) => tv.task)`）。
- 新增 `runCopyHandoff`：
  ```ts
  async function runCopyHandoff() {
    if (!selectedTask || busy) return
    setBusy('handoff')
    try {
      const text = buildHandoffBrief({
        task: selectedTask.task,
        snapshot: selectedTask.snapshot,
        diff,
        tasks,
        projectName: projectOfTask ? projectOfTask.project.name : '',
        statusLabel,
        t,
      })
      if (!(await copyText(text))) throw new Error(t.handoffCopyFailed)
      say(t.handoffCopied)
    } catch (e: any) {
      say(String((e && e.message) || t.handoffCopyFailed), true)
    } finally {
      setBusy('')
    }
  }
  ```
- 返回值新增 `runCopyHandoff`；board 给 Stage 传 `onCopyHandoff: actions.runCopyHandoff`、`handoffBusy: !!busy`。

**样式** `src/client/styles/workbench.ts`：

- 新增少量 `.dshwd-handoff-*` 样式即可；优先复用现有 `.dshwd-block` / `.dshwd-block-head` / `.dshwd-block-actions`。

**边界**：

- 不下载 `.md` 文件（验收报告已有下载；交接简报以复制为主）。
- 不包含 diff 正文、不包含会话消息、不包含 token 用量。
- 不自动发送给任何人；复制后由用户决定去向。
- 不改变任务状态，不写台账，不请求 Git。

### 4.6 验收标准

- [ ] 任意状态的任务详情都能看到「交接简报」区块和复制按钮（`onCopyHandoff` 存在时）。
- [ ] 复制出的 Markdown 包含目标、当前进度、代码现状、下一步建议、注意事项五个部分。
- [ ] 验收标准、依赖、公式 / 估算 / 截止日期、工时、HEAD、提交、diff 概览与界面一致。
- [ ] 无 diff、无提交、无会话、无验收标准、无备注时，简报仍有可读的兜底文案。
- [ ] 已合并 / 已清理任务、post-merge 提交、review 基于旧提交、pending stash 等边界都有对应提示。
- [ ] 复制成功 / 失败都有 Toast；失败不会清空任务或改变界面状态。
- [ ] 中英文 locale key 完全一致，`npm run check:locale` 通过。

### 4.7 测试要点

新增 `test/client-handoff.test.ts`：

- 完整任务：五个章节、元数据、验收进度、提交、diff 概览。
- 无 diff / 无提交 / 无验收标准 / 无备注 / 无会话的兜底。
- 前置任务：未完成、缺失、已完成三种状态。
- 状态分支：ready、developing、reviewing、review、merged、cleaned、broken 的下一步建议。
- post-merge 提交、review 基于旧提交、pending stash 的注意事项。
- Markdown 转义：标题 / 描述 / 备注中的反引号、竖线、换行不会破坏结构。
- 英文 locale 输出的标题和下一步建议不出现中文。
- `now` 注入后生成时间稳定；非法时间戳不产生 `NaN`。
- 与验收报告共享字段口径的断言（同一任务的关键字段在两份文本中一致）。

---

## 5. 估算校准（Estimate calibration）

### 5.1 功能说明

项目洞察新增「估算校准」：

- 对**已合并（含已清理但有合并记录）**、同时具备有效 `estimate` 和已记录 `workMs` 的任务，计算：
  - 样本数、总点数、总工时；
  - 加权「每点小时数」= 总工时 / 总点数；
  - 每个任务「每点小时数」的中位数；
  - 按 1 / 2 / 3 / 5 / 8 点分桶的样本数、总工时与平均工时。
- 项目洞察卡片显示一行摘要，例如「估算校准：基于 4 个已完成任务，1 点约等于 2.3 小时」。
- 摘要下方用可展开的明细列出各点数的样本与平均工时；没有样本时显示一句空态提示。
- 校准是**描述性统计**，不是承诺：样本少、工时由用户手动记录、任务之间不可直接比较，界面文案必须说明这一点。

### 5.2 为什么做

1.15.0 同时引入了「规模估算（1/2/3/5/8 点）」和「手动工时」两个字段，但两者目前各自展示：洞察里有估算覆盖率和进行中点数，报告里有工时，却没有把「估了多少」和「实际花了多少」放在一起。

结果是：

- 估算仍然无法校准：用户不知道 1 点大概等于多少实际投入。
- 工时数据只用于展示累计值，没有形成可复用的经验。
- 项目洞察缺少一个「工作质量」视角：吞吐和周期说明快不快，校准说明估得准不准。

### 5.3 预期效果

- 有足够样本时，项目详情直接告诉用户「本项目 1 点约等于 X 小时」，并给出样本量和中位数，避免平均值被极端值误导。
- 按点数分桶后，用户能看到 1 点任务和 8 点任务的平均投入是否线性。
- 没有样本、样本很少、只有估算没有工时、只有工时没有估算时，都有清晰文案，不出现除零、`NaN`、`Infinity`。
- 进行中任务的计时不会被当成已完成样本；只有已合并任务参与校准。
- 旧任务（无新字段）不受影响，洞察其余指标保持不变。

### 5.4 收益

- **可校准**：把估算从「相对大小」变成可以和实际投入对照的数据。
- **可解释**：中位数与分桶避免单一平均值误导；样本量直接展示，避免过度解读。
- **可复用**：为下一批任务的点数选择提供依据，也为项目之间的估算文化提供共同语言。
- **零迁移**：只读取已有可选字段，不新增模型字段、不写台账。

### 5.5 实现方案

**扩展** `src/client/project-insights.ts`：

```ts
import { TASK_ESTIMATES } from '../task-meta'
import { elapsedWorkMs } from '../task-timer'

export interface CalibrationBucket {
  points: number
  samples: number
  workMs: number
  hours: number
  /** 该点数样本的平均小时数；没有样本为 null。 */
  averageHours: number | null
}

export interface EstimateCalibration {
  /** 同时具备有效估算和正工时的已合并任务数。 */
  samples: number
  /** 这些任务的估算点数总和。 */
  points: number
  workMs: number
  hours: number
  /** 加权每点小时数 = hours / points；没有样本或点数为 0 时为 null。 */
  hoursPerPoint: number | null
  /** 每个任务 hours / points 的中位数；没有样本时为 null。 */
  medianHoursPerPoint: number | null
  /** 固定包含 1 / 2 / 3 / 5 / 8 五个桶，没有样本的桶也保留。 */
  buckets: CalibrationBucket[]
}

export interface ProjectInsights {
  // ...现有字段保持不变
  calibration: EstimateCalibration
}
```

规则：

- **样本条件**：`mergedAt` 是有效正数，或 `snapshot.status === 'merged'`；**并且** `parseEstimate(task.estimate)` 返回有效值；**并且** `elapsedWorkMs(task, at) > 0`。
  - `cleaned` 状态只有在 `mergedAt` 有效时参与；没有合并记录的清理任务不参与。
  - 正在计时但未合并的任务不参与。
- `hours = workMs / 3_600_000`；所有对外数值保留 1 位小数（`Math.round(x * 10) / 10`）。
- `hoursPerPoint` 用加权值（总工时 / 总点数），不要用「每任务比值的平均」。
- `medianHoursPerPoint` 用每任务 `hours / points` 的中位数；偶数个样本取中间两个的平均。
- **分桶**：`TASK_ESTIMATES`（1/2/3/5/8）每桶统计样本、总工时、平均工时；没有样本的桶 `averageHours: null`。
- **异常**：`workMs` / `estimate` 非法、负数、`NaN`、`Infinity` 一律按无样本处理；`elapsedWorkMs` 已经处理时钟回拨和未来时间，不要重复实现。
- **上限**：累加时对 `Number.MAX_SAFE_INTEGER` 做保护；不要让超大值变成 `Infinity`。
- **不修改入参**，不读时钟（`now` 仍由 `buildProjectInsights` 注入）。

**项目详情** `src/client/project-detail.ts`：

- 在现有洞察卡片的负载提示之后、7 天柱图之前增加校准区域：
  - `insights.calibration.samples > 0`：
    - 一行摘要：`fill(t.insightsCalibration, { samples, hours: hoursPerPoint.toFixed(1) })`；
    - 一个 `<details>`：summary 为 `t.insightsCalibrationDetail`，内部列出 `buckets.filter(b => b.samples > 0)`，每行 `fill(t.insightsCalibrationBucket, { points, samples, hours: averageHours.toFixed(1) })`；
    - 一行中位数提示：`fill(t.insightsCalibrationMedian, { hours: medianHoursPerPoint.toFixed(1) })`。
  - `insights.calibration.samples === 0 && insights.merged > 0`：显示 `t.insightsCalibrationEmpty` 一句提示。
  - `insights.merged === 0`：不显示校准区域，避免新项目出现无意义空态。
- 明细使用语义化列表或表格，键盘可展开；不要只靠颜色区分。
- 所有数字必须来自 `calibration`，不要在视图里重新计算。

**样式** `src/client/styles/workbench.ts`：

- 新增 `.dshwd-calibration*` 少量样式；复用洞察卡片现有间距、字号和颜色 token。

**边界**：

- 不做预测、不做自动估算建议、不把校准值写回任务。
- 不把进行中计时、未合并任务、没有工时记录的任务算进样本。
- 不在项目之间自动比较；只展示当前项目的统计。
- 不做统计显著性检验；文案必须说明「样本有限，仅供参考」。

### 5.6 验收标准

- [ ] 已合并且有估算 + 工时的任务参与校准；进行中、未合并、已清理但无合并记录的任务不参与。
- [ ] `hoursPerPoint` 为加权值，`medianHoursPerPoint` 为中位数；两者在样本为 0 时为 `null`。
- [ ] 分桶固定包含 1/2/3/5/8，样本为 0 的桶不出现在明细中但保留在数据里。
- [ ] 没有样本时，已有合并任务的项目显示空态提示；没有合并任务的项目不显示校准区域。
- [ ] 非法 `estimate` / `workMs` / 时间戳不产生 `NaN`、`Infinity` 或负数。
- [ ] 洞察现有指标（周期、吞吐、覆盖率、负载）不受影响。
- [ ] 中英文 locale key 完全一致，`npm run check:locale` 通过。

### 5.7 测试要点

扩展 `test/client-project-insights.test.ts`（或新增 `test/client-estimate-calibration.test.ts`，但优先扩展现有文件）：

- 无样本：`samples: 0`、`hoursPerPoint: null`、`medianHoursPerPoint: null`、5 个零桶。
- 单样本：加权与中位数相同。
- 多样本、不同点数：加权值与中位数的区别。
- 分桶统计正确；无样本桶的平均为 `null`。
- 进行中任务、未合并任务、已清理但无合并记录的任务不参与。
- 非法估算（0、4、字符串）、非法工时（负数、`NaN`、`Infinity`）、未来时间戳。
- 计时中任务（合并状态下允许停止计时）使用 `elapsedWorkMs` 的当前值。
- 数值舍入与安全整数上限。
- 旧任务（无新字段）返回全零校准，洞察其余字段不变。

---

## 6. 通用实现约定

1. **纯函数优先**：总览、焦点、复制草稿、交接简报、校准全部放在无 DOM 的纯模块里；服务端与客户端共用同一套规则，不要在多个文件复制。所有涉及「现在」的函数接受可注入的 `now`。
2. **零服务端变更**：本批次不新增 HTTP 路由、不修改 `WorktreeTask` 字段、不改 Store / Runtime / HTTP / tools。若实现中发现必须改服务端，先停下来报告，不要自行扩大范围。
3. **不改变状态机与排序**：继续使用 `compareTaskOrder`；总览、焦点、校准都不参与看板排序，不改变注意力分类、筛选或合并门禁。
4. **复用现有助手**：日期用 `task-meta`，工时用 `task-timer` / `work-format`，Markdown 用 `markdown.ts`，验收用 `model.ts` 的 `criteria` / `criteriaProgress`，依赖用 `task-deps`，风险用 `project-risk`。不要另起一套口径。
5. **文案**：所有新文案同时加入 `locale/zh.json` 与 `locale/en.json`，key 集合一致；`npm run check:locale` 必须通过。每个功能的 key 使用本规格给出的前缀（`portfolio*` / `focus*` / `taskDuplicate*` / `handoff*` / `insightsCalibration*`），避免重名。
6. **可访问性**：所有新按钮必须有可访问名称；对话框使用现有 `Modal` 或 `useDialogFocus` 获得焦点圈定与 Escape 关闭；状态不能只靠颜色表达；项目行、焦点行必须有键盘入口。
7. **不新增依赖**：不引入图表库、日期库、状态管理库或 UI 库；继续使用现有原语、手写样式和 SVG / DOM。
8. **最小 diff**：不重排现有代码、不重命名既有函数、不格式化整文件；共享文件只改本功能需要的行。
9. **文档同步由主线程完成**：实施者不要修改 `README.md`、`CHANGELOG.md`、`docs/`、`package.json`、`package-lock.json`、`feature.md`；这些由主线程在集成时统一更新到 1.16.0。
10. **测试**：每个功能至少一个新增测试文件；必要时扩展已有测试。不要依赖系统时钟（使用可注入的 `now`）；测试文件名按第 1–5 节指定，避免与现有文件重名。
11. **实施边界**：每个子 agent 只实现自己负责的第 1–5 节之一；完成前运行 `npm run typecheck` 与 `npm test`（node_modules 缺失时先 `npm ci`），失败必须修复；最后只提交一次，并在结果中报告分支名、HEAD SHA、变更文件与测试数量。不要 push，不要创建 PR。
12. **读取源码时以实际文件为准**：工具输出里如果出现 `{{SECRET_*}}` 形式的占位符，那是读取管道的脱敏显示，不是源码内容；不要把它写进代码、测试或文档。

---

## 7. 批次验收标准

- [ ] 5 个功能均可从 UI 触发：总览、今日焦点、复制任务、复制交接简报、估算校准。
- [ ] 总览在首次打开、返回总览、空项目、全关闭任务、异常数据下不崩溃、不出现 NaN。
- [ ] 今日焦点在有阻塞 / 无阻塞 / 空项目 / 异常数据下排序稳定；不进入阻塞任务；不改变看板顺序。
- [ ] 任务复制预填正确，分支 / 截止 / 备注 / 依赖不复制；普通发布不残留复制草稿。
- [ ] 交接简报五个章节完整，边界数据有兜底，与验收报告口径一致。
- [ ] 估算校准样本条件正确，加权值 / 中位数 / 分桶正确，空态与异常数据安全。
- [ ] 旧任务记录（无新字段）加载不报错，现有排序、筛选、报告、合并流程不变。
- [ ] `npm run check:locale` 通过；中英文 key 完全一致。
- [ ] `npm run verify`（typecheck + locale + 测试 + 构建）通过；测试数量不少于当前基线的 **697** 项并有所增加（目标 760–800 项）。
- [ ] README、CHANGELOG、docs/frontend-design.md、docs/i18n-terminology.md、package.json、package-lock.json 由主线程更新到 1.16.0。
- [ ] 不引入新依赖；不新增服务端路由；现有接口语义不变。

---

## 8. 风险、边界与回滚

- **总览空态替换**：看板原先的「请选择任务」占位被总览替换；必须保留加载中 / 错误 / 重试状态，不能把连接失败伪装成空项目。
- **总览数据源**：必须使用未过滤的完整 `views`；使用 `filtered` 会让总览随搜索 / 标签筛选变化，产生「总览只统计了当前筛选结果」的误解。
- **总览性能**：每个项目调用一次 `buildProjectRisk`；项目数很多时仍是 O(任务数)，不做额外轮询。用 `useMemo` 缓存。
- **焦点与风险雷达重叠**：焦点复用风险雷达分值作为基础分，不另写评分；焦点排除阻塞任务并增加行动加权，风险雷达保留阻塞任务与风险等级。两者都不改变看板排序。
- **焦点与注意力汇总重叠**：汇总条给分类计数，焦点给任务级排序；共用 `attentionOf`，不要各自推导分类。
- **复制草稿泄漏**：`openPublish` 必须显式设置草稿（默认 `null`）；复制后关闭弹窗再点普通发布，不能带出旧草稿。
- **复制基线**：草稿基线只在首次挂载生效；用户切换项目后回到项目默认基线，避免把旧项目分支带到新项目。
- **复制不复制截止日期**：旧截止日期可能已过期；这是一项有意的产品决定，文档与文案要说明。
- **交接简报口径漂移**：必须复用 `criteria` / `dueStateOf` / `parseEstimate` / `workTimingText` / `branchHeadSha` / `dependencyStatus`；不要复制报告里的格式化逻辑。若需要新助手，先抽公共函数并补测试。
- **交接简报体积**：只输出文件路径与增删行数，不输出 diff 正文；提交最多 5 条，文件最多 10 条，避免剪贴板内容过大。
- **校准样本偏差**：工时是手动记录，样本可能很少且不随机；文案必须写「样本有限，仅供参考」，不得把校准值当作承诺或绩效指标。
- **校准数值安全**：总工时、总点数、每点小时数都要防除零、防 `NaN`、防 `Infinity`、防安全整数溢出。
- **集成冲突**：本批次预计在 `board.ts`、`rail.ts`、`stage.ts`、`project-detail.ts`、`styles/workbench.ts` 与两份 locale 文件产生 cherry-pick 冲突；主线程按「校准 → 复制 → 交接 → 焦点 → 总览」的顺序集成，逐段保留双方新增内容，不重排无关代码。
- **回滚**：
  - 总览：移除空态分支与 `portfolio-view.ts` / `portfolio.ts` 即可，其他页面不受影响。
  - 焦点：移除左栏入口与对话框；纯函数模块可独立删除。
  - 复制：移除按钮与 `draftFromTask`；发布弹窗的 `baseBranch` 字段可保留（可选、默认空）。
  - 交接：移除 Stage 区块与 `handoff.ts`；报告功能不变。
  - 校准：移除洞察卡片区域与 `calibration` 字段；其余洞察指标不变。
- **不做的事**：不做项目排序拖拽、不做焦点手动排序 / 稍后处理 / 通知、不做跨任务批量复制、不做交接简报自动发送、不做估算预测 / 自动建议 / 绩效统计。

---

## 9. 文件清单

| 文件 | 改动 |
| --- | --- |
| `src/client/portfolio.ts` | 新增：跨项目总览聚合纯函数 |
| `src/client/portfolio-view.ts` | 新增：总览页面视图 |
| `src/client/focus-queue.ts` | 新增：跨项目今日焦点排序纯函数 |
| `src/client/focus-queue-view.ts` | 新增：今日焦点对话框 |
| `src/client/handoff.ts` | 新增：交接简报 Markdown 生成纯函数 |
| `src/client/publish-state.ts` | `PublishDraft` 增加 `baseBranch`；新增 `draftFromTask` |
| `src/client/publish.ts` | 初始基线支持草稿；`currentForm` 带上基线 |
| `src/client/stage.ts` | 新增复制按钮、交接简报区块与对应 props |
| `src/client/board.ts` | 总览空态、焦点状态与对话框、复制预填、交接动作接线 |
| `src/client/board/use-board-actions.ts` | 新增 `runCopyHandoff`；接收全部任务 |
| `src/client/rail.ts` | 新增「总览」与「今日焦点」入口 |
| `src/client/project-insights.ts` | 新增 `EstimateCalibration` 与 `calibration` 字段 |
| `src/client/project-detail.ts` | 洞察卡片增加估算校准区域 |
| `src/client/styles/workbench.ts` | 总览、焦点、交接、校准样式 |
| `locale/zh.json`、`locale/en.json` | 新文案（key 集合一致） |
| `test/client-portfolio.test.ts` | 新增：总览聚合用例 |
| `test/client-focus-queue.test.ts` | 新增：焦点排序用例 |
| `test/client-duplicate-task.test.ts` | 新增：复制草稿用例 |
| `test/client-handoff.test.ts` | 新增：交接简报文例 |
| `test/client-project-insights.test.ts` | 扩展：估算校准用例 |
| `README.md`、`CHANGELOG.md`、`docs/frontend-design.md`、`docs/i18n-terminology.md` | 主线程更新到 1.16.0 |
| `package.json`、`package-lock.json` | 主线程更新到 1.16.0 |

---

## 10. 验收记录

- **状态**：五个功能已集成，待独立复核与 PR。

### 10.1 实施来源

| 功能 | 子 agent 分支 | 子 agent HEAD | 集成提交 |
| --- | --- | --- | --- |
| 跨项目总览 | `t3/portfolio-overview` | `332a177` | `c71c97e` |
| 今日焦点 | `t3/focus-queue` | `3d8e080` | `c8d64ec` |
| 任务复制 | `t3/duplicate-task` | `144fc0f` | `e0ed660` |
| 交接简报 | `t3/handoff-brief` | `61c744e` | `f2ec53f` |
| 估算校准 | `t3/estimate-calibration` | `f2f1b97` | `b2d0714` |

### 10.2 主线程复核修正

- locale 冲突：总览 39 个与交接简报 40 个 `portfolio*` / `handoff*` key 追加在同一位置，手工合并并把总览末项补上逗号；中英 key 数与占位符集合保持一致。
- 今日焦点：把 `focusOpen` 补进看板全局快捷键的屏蔽条件与依赖数组，避免对话框打开时 `n`、`/`、`[`、`]` 仍从背后触发发布、搜索或栏目开关。
- 跨项目总览：按 1.5 / 1.6 验收口径补「近 7 天合并」项目列与全局统计，并同步 `portfolioRowLabel`、grid 列宽与中英文案（`ede74e6`）。
- 交接简报：`diffReasonText` 仅提升为导出以复用原因文案，不复制实现。

### 10.3 验证结果

- `npm run typecheck` 通过；`npm run check:locale` 通过（zh=en=969，引用 key 全部存在）。
- `npm test` 已在中途集成点验证：功能 5 子分支 707；集成 5+1 后 721、再加 3 后 734、再加 4 后 757、再加 2 后 773，全部通过；基线 697，本批次新增 76 条。
- `npm run verify` 通过：typecheck、check:locale、`npm test` 773/773、`npm run build` 均无错误。

### 10.4 验收审批

- 独立 reviewer（`delegate_task` + `role: review`，magpie `mm/workbuddy/glm-5.3`）：**可提交 PR**，无 BLOCKER / MAJOR。
- 复核确认五个功能均满足 feature.md 1–5 的验收标准；服务端、任务模型、HTTP 路由与新依赖均未改动。
- MINOR 处理：`mdInline` 已折叠空白，备注多行不会破坏列表（不成立）；总览「需要关注」与左栏筛选计数的差异已在 `docs/frontend-design.md` 6.17 注明；总览 memo 化与视图层渲染测试列为可选优化，不在本批次范围内。

### 10.5 PR

- 待实施后填写。
