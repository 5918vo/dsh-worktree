# 每日功能批次 · 2026-11-24 · v1.16.0

> 批次主题：**项目复盘与交接**（周期摘要、估算校准、执行顺序、交接摘要、回归感知）
>
> 一句话目标：让工作台不仅回答「现在有什么任务」，还能回答五个问题——**这一段时间发生了什么、估算准不准、接下来先做哪个、交给别人要交代什么、我离开期间变了什么**。
>
> 交付方式：一个 PR（`t3/daily-feature-batch-pipeline` → `master`），5 个功能同批验收。
>
> 分工：主线程负责方案、任务拆分、集成、验收、文档与 PR；5 个 `pi` 子 agent 分别负责 5 个功能的编码落地与测试。上一批次（1.15.0 工时 / 估算 / 依赖图 / 风险雷达 / 保存视图）的文档见 git 历史。
>
> 状态：方案已定稿，待实施 / 待验收（验收记录见第 10 节）。

## 0. 批次总览

| # | 功能 | 一句话价值 | 主要落点 |
| --- | --- | --- | --- |
| 1 | 项目周报 | 按 7 / 14 / 30 天窗口汇总项目变化、交付工时与点数，一键复制或下载 | 纯函数 / 项目详情 / 文案 |
| 2 | 估算校准 | 把估算点数与已记录工时放在一起，回答「1 点大约等于多少实际投入」 | 纯函数 / 项目详情 / 文案 |
| 3 | 关键路径与可开始任务 | 按依赖跳数找出最长链，并列出当前可立即开始的任务 | 纯函数 / 项目详情 / 文案 |
| 4 | 任务交接摘要 | 一键生成面向接手人或 Agent 的交接 Markdown：现状、缺口、前后依赖、下一步 | 纯函数 / 任务详情 / 动作 / 文案 |
| 5 | 自上次访问以来的变化 | 打开看板时提示离开期间的新建、合并、待验收、逾期与新增工时 | 纯函数 / localStorage / 左栏 / 文案 |

设计原则：

- **全部只读派生**：5 个功能都只读取已经在界面上的任务记录，不新增台账字段、不写任务记录、不请求 Git、不改变状态机、不改变排序和合并门禁。
- **纯函数优先**：窗口统计、校准、关键路径、交接文本、访问摘要都放在无 DOM 的纯模块里，客户端与测试共用同一套规则；所有涉及「现在」的函数都接受可注入的 `now`。
- **空态与异常数据是第一等场景**：空项目、旧记录、非法时间戳、缺失依赖、循环依赖、样本不足、localStorage 不可用都必须有明确文案，不出现 NaN / Infinity / 负数 / 死循环。
- **与既有功能分工明确**：周报是「时间窗口聚合」，不是第二份项目验收报告；交接摘要是「下一步与前后依赖」，不是第二份验收报告；关键路径是「依赖跳数」，不代表工期。
- **复用既有口径**：状态文案、验收进度、截止日期、停滞天数、工时格式化、依赖完成判定全部调用现有纯函数，不复制第二套规则。
- **不引入依赖、不新增路由**：不新增 npm 包、不新增 HTTP 路由、不新增模型字段；只新增客户端纯模块、卡片、按钮与文案。
- **文档即验收**：每个功能都必须有功能说明、动机、预期效果、收益、实现方案、验收标准和测试要点。

---

## 1. 项目周报（Project digest）

### 1.1 功能说明

项目详情新增「项目周报」卡片：

- 提供 `7 / 14 / 30` 天三种统计窗口，默认 7 天；窗口按本地日历日计算，包含今天。
- 汇总窗口内发生的变化：
  - 新建任务数、合并任务数、清理任务数、归档任务数。
  - 窗口内合并任务的累计工时（交付工时）与累计估算点数（交付点数）。
  - 有变化的去重任务数。
- 汇总当前状态（不受窗口限制，单独标注为「当前状态」）：
  - 开放任务数、当前逾期数、当前停滞数。
  - 全项目验收核对进度 `已核对 / 总数`。
- 列出窗口内最近的变化事件（默认最多 30 条，超出截断并提示），每条包含日期、事件类型、任务标题与当前状态；点击可跳到任务。
- 提供「复制周报」与「下载 .md」，两者共用同一份 Markdown；文件名 `digest-<slug>-<YYYYMMDD>-<HHmm>.md`。
- 窗口内没有任何变化时显示空态，但当前状态数字仍然展示。

### 1.2 为什么做

1.15.0 已经有项目验收报告和项目洞察：前者是「全量快照 + 逐任务明细」，后者是固定 7 天的吞吐与周期统计。两者都无法回答「最近两周这个项目交付了什么、投入了多少、验收走到哪」。当项目持续运行、任务每天增减时，用户需要一份**按时间窗口聚合**的短报告，用于周会、周报或自我复盘；手动从看板逐条数任务既慢又容易漏。

### 1.3 预期效果

- 打开项目详情，选择 7 / 14 / 30 天，立即看到窗口内的新建、合并、清理、归档数量与交付工时 / 点数。
- 复制或下载的 Markdown 包含窗口、项目元数据、窗口变化、当前状态和变化明细，不包含逐任务验收标准正文与 diff。
- 窗口边界严格按本地日历日：今天发生的事件一定在窗口内，窗口第一天零点之前的事件一定不在。
- 空项目、无变化窗口、非法时间戳、缺失合并时间都不会产生 NaN、负数或错误计数。
- 周报与项目验收报告的分工在界面提示与文档中写明，用户不会误以为二者是同一份内容。

### 1.4 收益

- **省时间**：不用逐条翻任务，一份周报直接回答「这段时间做了什么」。
- **可比较**：固定窗口与固定章节顺序，连续两周的周报可以直接对照。
- **可交付**：复制 / 下载即可贴到周会记录、PR 描述或交接文档。
- **零副作用**：纯派生，不写台账、不请求 Git、不改变任何任务状态。

### 1.5 实现方案

**纯函数模块**（新增 `src/client/project-digest.ts`）：

```ts
export const DIGEST_WINDOWS = [7, 14, 30] as const
export type DigestWindow = typeof DIGEST_WINDOWS[number]
export const DIGEST_WINDOW_DEFAULT: DigestWindow = 7
export const DIGEST_EVENT_LIMIT = 30

export type DigestEventKind = 'created' | 'merged' | 'cleaned' | 'archived'

export interface DigestEvent {
  taskId: string
  title: string
  /** Current snapshot status; the UI maps it with boardStatusLabel. */
  status: string
  kind: DigestEventKind
  at: number
}

export interface ProjectDigest {
  windowDays: DigestWindow
  /** Inclusive local midnight of the first day in the window. */
  start: number
  /** Exclusive local midnight after today. */
  end: number
  created: number
  merged: number
  cleaned: number
  archived: number
  /** Distinct tasks with at least one event in the window. */
  changed: number
  /** Sum of elapsed work on tasks merged in the window (ms). */
  deliveredWorkMs: number
  /** Sum of valid estimates on tasks merged in the window. */
  deliveredPoints: number
  /** Merged-in-window tasks carrying a valid estimate. */
  deliveredEstimated: number
  /** Current open tasks: not archived, status not merged / cleaned. */
  open: number
  overdueOpen: number
  stalledOpen: number
  acceptanceChecked: number
  acceptanceTotal: number
  events: DigestEvent[]
  truncated: boolean
}

export function isDigestWindow(value: unknown): value is DigestWindow
export function buildProjectDigest(
  views: TaskView[],
  windowDays?: unknown,
  now?: number,
): ProjectDigest

export interface ProjectDigestReportInput {
  project: Project
  digest: ProjectDigest
  t: Record<string, any>
  /** Localized status for one task view; the board and the report agree. */
  statusLabel: (view: TaskView) => string
  now?: number
}

export function buildProjectDigestReport(input: ProjectDigestReportInput): string
export function digestFilename(project: Project, now?: number): string
```

规则：

- `windowDays` 非法（不是 7 / 14 / 30 的数字或数字字符串）时回落到 7，不抛异常。
- 窗口边界：`end` 是「明天本地零点」；`start` 是「今天本地零点减去 `windowDays - 1` 天」。用 `new Date(y, m, d + offset)` 构造，跨月、跨年、DST 都按本地日历日处理。
- 事件时间只接受有限正数；`createdAt` / `mergedAt` / `cleanedAt` / `archivedAt` 缺失或非法时跳过该事件。事件必须满足 `start <= at < end`。
- 同一任务可以同时贡献多个事件（例如窗口内新建并合并）；`changed` 按任务 id 去重。
- `deliveredWorkMs` 只统计 `mergedAt` 在窗口内的任务，使用 `elapsedWorkMs(task, now)`（含正在运行的计时区间）；非有限 / 负数按 0。**工时是累计值，不能拆分到窗口内**，因此文案必须写「窗口内合并任务的累计工时」，不能写「窗口内新增工时」。
- `deliveredPoints` 只统计窗口内合并任务中 `parseEstimate` 合法的点数；非法 / 缺失按未估算处理；`deliveredEstimated` 是携带合法估算的任务数。
- 当前状态：`open` = 未归档且状态不是 `merged` / `cleaned`；`overdueOpen` 使用 `dueStateOf(task.dueAt, now)` 的 `overdue`；`stalledOpen` 使用 `stalledDays(task, snapshot, now) != null`。
- 验收进度：对全部任务调用 `criteria(task, snapshot.status)` 与 `criteriaProgress`，累加 `checked` / `total`；已合并 / 已清理任务按 `criteria` 的既有规则视为已核对。
- 事件排序：时间降序 → 任务标题（本地化前的原始字符串）升序 → 任务 id 升序 → 事件类型固定顺序，保证同一输入输出稳定。
- `events` 截取前 `DIGEST_EVENT_LIMIT` 条，`truncated = 总事件数 > events.length`。
- 报告章节固定为：标题、项目元数据（项目 / 仓库 / 基线 / 窗口 / 生成时间）、窗口变化、当前状态、变化明细、说明。**不输出逐任务验收标准、备注、diff、文件列表**，避免与项目验收报告重复。
- 报告中的工时使用 `formatWorkDuration(digest.deliveredWorkMs, workDurationUnits(t))`；没有交付工时时输出 `t.digestReportNoWork`。
- 报告中的事件行使用 `reportTimestamp(event.at)` 的 `YYYY-MM-DD` 部分 + 本地化事件类型 + 任务标题 + 状态。
- `digestFilename` 复用 `pad2` 与 `safeSlug`，格式 `digest-<slug>-<YYYYMMDD>-<HHmm>.md`。

**客户端**（`src/client/project-detail.ts`）：

- 在项目验收报告卡片之后新增「项目周报」卡片；卡片头右侧或卡片内提供窗口下拉（近 7 天 / 近 14 天 / 近 30 天），`aria-label` 为 `t.digestWindow`。
- 卡片内容：
  - 一行提示 `t.digestHint`，写明「时间窗口聚合；完整逐任务明细请用项目验收报告」。
  - 四个统计：新建 / 合并 / 清理 / 归档，使用现有 `Stat` 或紧凑计数样式。
  - 一行交付信息：交付工时、交付点数（含已估算任务数）。
  - 一行当前状态：开放 / 逾期 / 停滞 / 验收核对。
  - 变化明细列表：最多 8 条（UI 只展示最近 8 条，报告最多 30 条），每条是按钮，显示日期、事件类型、标题与状态，点击调用 `props.onSelectTask(taskId)`。
  - 空态：`t.digestEmpty` + `t.digestEmptyHint`。
  - 截断提示：`t.digestTruncated`。
  - 底部按钮：复制周报 / 下载 .md，复用 `copyText` / `downloadText`，失败用 `props.notify(..., true)`。
- 窗口选择用组件内 `React.useState<DigestWindow>(DIGEST_WINDOW_DEFAULT)`；每次渲染只读一次 `Date.now()`，保证窗口与统计共享同一个「今天」。
- 样式加到 `src/client/styles/workbench.ts` 的 `.dshwd-digest*` 作用域，复用现有 token；不引入新颜色体系。
- 不新增 HTTP 请求；所有数据来自 `props.view.tasks`。

**边界**：

- 不做自定义日期区间、不做按人 / 按标签分组、不做趋势图、不做 PDF。
- 不做「窗口内新增工时」：工时只有累计值，没有区间明细，文案不得暗示可拆分。
- 不替代项目验收报告；周报不输出逐任务验收正文。

### 1.6 验收标准

- [ ] 7 / 14 / 30 天窗口切换后，统计与事件列表同步变化；非法窗口值回落为 7。
- [ ] 窗口边界按本地日历日：今天的事件在窗口内，窗口第一天零点前的事件不在；跨月 / 跨年 / DST 不偏移。
- [ ] 新建 / 合并 / 清理 / 归档四类事件计数正确；同一任务多个事件不会让 `changed` 重复计数。
- [ ] 交付工时只统计窗口内合并任务的累计工时，计时中的区间被计入；非法字段不产生 NaN / 负数。
- [ ] 交付点数只统计合法估算；未估算任务不参与点数，但计入 `deliveredEstimated` 的分母口径。
- [ ] 当前开放 / 逾期 / 停滞与看板筛选口径一致；验收核对与任务详情一致。
- [ ] 空项目、无变化窗口、损坏时间戳、缺失快照都能渲染空态，不报错。
- [ ] 复制与下载内容完全一致；文件名符合 `digest-<slug>-<YYYYMMDD>-<HHmm>.md`。
- [ ] 周报不含逐任务验收正文、备注、diff 或文件列表。
- [ ] 中英文 locale key 完全一致，`npm run check:locale` 通过。

### 1.7 测试要点

- 新增 `test/client-project-digest.test.ts`：
  - 空项目：全 0、事件为空、`truncated` 为 false、`start < end`。
  - 窗口边界：今天零点、窗口第一天零点、窗口第一天前一毫秒、明天零点。
  - 7 / 14 / 30 天窗口的事件范围；非法窗口回落 7。
  - 同一任务窗口内新建并合并：`created` / `merged` 各 1，`changed` 为 1。
  - 合并任务工时：`workMs`、运行中计时、非法 `workMs`、负数；估算合法 / 非法。
  - 当前开放 / 逾期 / 停滞；归档、合并、清理的排除。
  - 验收核对：有标准 / 无标准 / 已合并任务。
  - 事件排序与截断：构造超过 30 条事件，验证 `events.length` 与 `truncated`。
  - 报告：包含窗口、四类计数、交付工时 / 点数、当前状态、事件行；不包含验收标准文本与备注文本。
  - `digestFilename` 的 slug、日期、时间与 fallback。
- 不修改现有测试文件；如确需扩展，只允许追加本功能用例并说明原因。

---

## 2. 估算校准（Estimate calibration）

### 2.1 功能说明

项目详情新增「估算校准」卡片：

- 只统计**同时具备合法估算与已记录工时**的任务；工时使用 `elapsedWorkMs`（含正在运行的计时区间）。
- 展示：
  - 样本数、总点数、总工时。
  - 每点平均工时与每点中位工时（样本数达到阈值才展示）。
  - 估算覆盖率与计时覆盖率：已估算任务数 / 有工时任务数 / 两者都有的任务数。
  - 最近样本列表（最多 5 条）：任务标题、点数、工时、每点工时；计时中标注「计时中」。
- 样本少于 `CALIBRATION_MIN_SAMPLES = 3` 时，不计算每点均值 / 中位，显示「样本不足（n/3）」；样本为 0 时显示空态与引导。
- 卡片只展示，不写入、不改变估算或工时，不参与排序。

### 2.2 为什么做

1.15.0 同时引入了「规模估算」和「工时计时」，但两者目前是两条平行数据：估算用于规划，工时用于记录，没有任何界面把它们放在一起。结果是估算无法被校准——用户不知道自己的 `3 点` 通常对应 2 小时还是 2 天，下一次估算仍然凭感觉。校准卡片把这两个字段接上，形成「估算 → 实际 → 修正下一次估算」的闭环。

### 2.3 预期效果

- 有足够样本时，用户能看到「1 点 ≈ 2 小时 15 分」这样的经验值，以及每点中位数，避免个别大任务拉偏平均。
- 样本不足时，界面明确说明还差几个样本，不展示可能误导的均值。
- 没有任何同时具备估算与工时的任务时，显示空态并提示先设置估算、再开始计时。
- 损坏的估算、负数工时、未来开始时间都被忽略，不出现 NaN / Infinity / 负数。
- 样本列表与汇总使用同一套过滤规则，数字可以互相核对。

### 2.4 收益

- **可校准**：第一次能回答「我们的 1 点大概等于多少实际投入」。
- **可规划**：下一批任务的估算有历史依据，而不是凭感觉。
- **抗异常**：中位数与样本阈值避免单个异常任务误导判断。
- **零副作用**：只读派生，不写台账、不改变任何字段。

### 2.5 实现方案

**纯函数模块**（新增 `src/client/estimate-calibration.ts`）：

```ts
export const CALIBRATION_MIN_SAMPLES = 3
export const CALIBRATION_SAMPLE_LIMIT = 5

export interface CalibrationSample {
  taskId: string
  title: string
  points: number
  workMs: number
  /** workMs / points; always finite and > 0 for a valid sample. */
  msPerPoint: number
  /** True while the task's timer is still running. */
  running: boolean
}

export interface EstimateCalibration {
  /** Tasks with a valid estimate and recorded work. */
  samples: number
  /** Sum of valid estimate points across samples. */
  points: number
  /** Sum of elapsed work across samples. */
  workMs: number
  /** workMs / points; null when samples < CALIBRATION_MIN_SAMPLES or points <= 0. */
  averageMsPerPoint: number | null
  /** Median of per-sample msPerPoint; null under the same threshold. */
  medianMsPerPoint: number | null
  /** Tasks with a valid estimate (denominator for coverage). */
  estimated: number
  /** Tasks with recorded work (denominator for coverage). */
  timed: number
  /** Tasks with both (the sample count, repeated for readability). */
  both: number
  /** Integer 0..100; null when no task has an estimate. */
  estimateCoveragePercent: number | null
  /** Integer 0..100; null when no task has recorded work. */
  timingCoveragePercent: number | null
  /** Newest / largest samples first, capped at CALIBRATION_SAMPLE_LIMIT. */
  recent: CalibrationSample[]
  /** Samples above the cap are still counted in the totals. */
  truncated: boolean
}

export function buildEstimateCalibration(
  views: TaskView[],
  now?: number,
): EstimateCalibration
```

规则：

- 估算：`parseEstimate(task.estimate)` 合法且非 `null` 才算已估算；非法 / 缺失按未估算。
- 工时：`elapsedWorkMs(task, now)`，只接受有限正数；0 表示没有已记录工时，不计入样本，也不计入 `timed`。
- 样本：`points > 0 && workMs > 0`。`msPerPoint = workMs / points`，必须有限且 > 0。
- 阈值：`samples < CALIBRATION_MIN_SAMPLES` 时 `averageMsPerPoint` 与 `medianMsPerPoint` 都为 `null`；达到阈值才计算。
- 平均值 = `workMs / points`；中位数 = 所有样本 `msPerPoint` 排序后的中位数（偶数个取中间两个的平均）。两者都做 `Math.round` 到整数毫秒，避免浮点尾差。
- 覆盖率：`estimateCoveragePercent = estimated / total`，`timingCoveragePercent = timed / total`，`total` 是传入视图数；没有任务时返回 `null`，不除零。整数 0..100。
- 样本排序：`msPerPoint` 降序 → 点数降序 → 标题升序 → id 升序；取前 `CALIBRATION_SAMPLE_LIMIT` 条。`truncated = samples > recent.length`。
- 不读取时钟以外的外部状态；`now` 可注入。
- 不写任何字段，不改变估算 / 工时。

**客户端**（`src/client/project-detail.ts`）：

- 在「项目洞察」卡片之后新增「估算校准」卡片；卡片头包含标题与一句 `t.calibrHint`。
- 统计行：
  - 样本数 `t.calibrSamples`。
  - 总点数 `t.calibrPoints`。
  - 总工时 `t.calibrWork`，使用 `formatWorkDuration(workMs, workDurationUnits(t))`。
  - 每点均值 / 中位：达到阈值时用 `formatWorkDuration`；不足时显示 `t.calibrNeedMore` 并填入 `{have}` / `{need}`。
- 覆盖率行：`t.calibrCoverage` 填入 `{estimated}` / `{timed}` / `{both}` / `{total}`。
- 样本列表：每条按钮或只读行，显示标题、点数、工时、每点工时；计时中追加 `t.taskWorkTimingSuffix`；点击可跳到任务。
- 空态：`samples === 0` 时显示 `t.calibrEmpty` + `t.calibrEmptyHint`，不渲染统计 0 值造成误解。
- 截断提示：`t.calibrTruncated`。
- 样式加到 `.dshwd-calibr*` 作用域，复用现有 token。

**边界**：

- 不做趋势、预测、置信区间、按标签 / 按人分组。
- 不把估算自动改写为实际工时；校准只展示，不写回。
- 不把工时拆分为区间；工时是累计值。
- 样本阈值固定为 3，不做用户配置；后续调整需同步文档与测试。

### 2.6 验收标准

- [ ] 没有估算或没有工时的任务不进入样本；两者都有的任务只计一次。
- [ ] 样本少于 3 时，均值与中位为 `null`，界面显示「样本不足（n/3）」。
- [ ] 达到 3 个样本时，均值与中位计算正确；偶数样本的中位取中间两个的平均。
- [ ] 运行中的计时被计入工时，样本标记「计时中」。
- [ ] 非法估算、负数 / NaN 工时、未来开始时间被忽略，不出现 NaN / Infinity / 负数。
- [ ] 空项目、全部未估算、全部未计时、全部合法四种情况都有正确空态或数字，不除零。
- [ ] 样本列表与汇总使用同一套过滤规则；截断提示正确。
- [ ] 不写台账、不改变估算 / 工时、不参与排序。
- [ ] 中英文 locale key 完全一致，`npm run check:locale` 通过。

### 2.7 测试要点

- 新增 `test/client-estimate-calibration.test.ts`：
  - 空项目：全 0、`null` 均值、空样本。
  - 只有估算 / 只有工时 / 两者都有：样本与覆盖率口径。
  - 1 个、2 个、3 个、4 个样本：阈值与中位数（偶数取平均）。
  - 平均与中位的取整；不同点数下的 `msPerPoint`。
  - 运行中计时：`workStartedAt` + `now` 计入，`running` 为 true。
  - 非法估算（0、4、字符串、布尔）、负数 / NaN 工时、未来开始时间。
  - 样本排序与截断：超过 5 个样本时 `recent.length` 与 `truncated`。
  - 覆盖率：无任务时 `null`，有任务时 0..100 整数。
- 不修改现有测试文件。

---

## 3. 关键路径与可开始任务（Critical path & ready queue）

### 3.1 功能说明

项目详情新增「关键路径」卡片：

- 按**依赖跳数**计算项目内最长的一条依赖链（从没有前置的任务到链尾），列出链上的任务顺序。
- 统计：
  - 关键路径长度（任务数）与链上任务。
  - 当前可立即开始的任务（开放、未归档、所有前置都已完成或没有前置）。
  - 被阻塞的开放任务数（至少一个前置未完成或缺失）。
  - 缺失前置数量。
- 可开始任务列表最多展示 5 条，按既有 `compareTaskOrder` 排序（置顶 → 优先级 → 创建时间倒序），点击可跳到任务。
- 没有依赖时明确提示「当前项目没有依赖，全部开放任务都可开始」，并列出前 5 个开放任务。
- 循环依赖、缺失前置、跨项目 id 等异常数据安全降级，不死循环、不伪造任务。
- 卡片只展示，不修改依赖、不改变任务状态、不阻塞合并。

### 3.2 为什么做

1.15.0 的依赖关系图解决了「看清结构」，但没有回答两个执行问题：**最长的一条链有多长、现在到底能开始哪些任务**。当项目有十几个任务时，用户仍然需要自己在图上数层数、逐个检查前置是否完成。关键路径卡片把依赖从「图」变成「顺序」和「可执行队列」，直接支持「今天先做哪个」的决策。

### 3.3 预期效果

- 打开项目详情就能看到一条明确的关键路径（例如 A → B → D → F），以及当前可立即开始的 3 个任务。
- 有前置未完成或缺失时，任务不会出现在「可开始」里，并计入「被阻塞」。
- 循环依赖不会导致页面卡死或崩溃；链计算跳过异常环，并给出提示。
- 无依赖项目、空项目、单任务项目都有清晰文案，不渲染空列表。
- 点击链上任务或可开始任务都能跳到任务详情；键盘可达。

### 3.4 收益

- **可执行**：从「知道有依赖」到「知道今天能开始什么」。
- **可解释**：最长链与阻塞数让排期讨论有共同依据。
- **安全**：复用既有依赖判定，异常数据有兜底，不写任何记录。
- **零成本**：不需要新增字段或服务端接口。

### 3.5 实现方案

**纯函数模块**（新增 `src/client/critical-path.ts`）：

```ts
export const CRITICAL_PATH_LIMIT = 5
/** Hard guard so abnormal data cannot make the DFS unbounded. */
export const CRITICAL_PATH_MAX_NODES = 500

export interface CriticalPathNode {
  id: string
  title: string
  /** Current snapshot status, for the UI's localized label. */
  status: string
  /** Number of prerequisite hops to this node (0 = no prerequisites). */
  depth: number
}

export interface CriticalPath {
  /** Longest chain, root -> leaf; empty when there is no task. */
  chain: CriticalPathNode[]
  /** Number of tasks on the chain (0 when empty). */
  length: number
  /** Open tasks whose prerequisites are all done (or absent), sorted and capped. */
  ready: CriticalPathNode[]
  /** Total ready tasks before the cap; the stat must not read `ready.length`. */
  readyTotal: number
  /** Open tasks with at least one unfinished or missing prerequisite. */
  blocked: number
  /** Missing prerequisite ids referenced by open tasks (deduped). */
  missing: number
  /** Open tasks considered for ready / blocked. */
  open: number
  /** True when more than CRITICAL_PATH_LIMIT ready tasks exist. */
  truncated: boolean
  /** Node ids that participate in a dependency cycle (safe display only). */
  cycles: string[]
  /** True when the node guard stopped the traversal. */
  capped: boolean
}

export function buildCriticalPath(views: TaskView[]): CriticalPath
```

规则：

- 输入是一个项目的 `TaskView[]`；只使用 `task.dependsOn`、`task.archivedAt`、`task.mergedAt`、`task.cleanedAt`、`snapshot.status`、`task.title`、`task.id`。
- 依赖完成判定复用 `isDependencyDone`（`mergedAt` 或 `cleanedAt` 存在）；缺失前置 = `dependsOn` 的 id 不在当前视图里。
- 开放任务 = 未归档且 `snapshot.status` 不是 `merged` / `cleaned`；`broken` 仍算开放，但在可开始列表中保留（它的 Git 异常由其他卡片提示）。
- 关键路径：
  - 对每个任务做 DFS，`depth(node) = 1 + max(depth(prereq))`，没有前置为 1。
  - 链是 depth 最大的任务回溯到根；depth 相同时按 `compareTaskOrder` 优先（置顶 → 优先级 → 创建时间倒序 → id），保证确定性。
  - 只沿当前视图中存在的依赖走；缺失 id 不参与链。
  - 用「访问中」集合检测环；遇到环时跳过该边，记录环上节点 id 到 `cycles`，继续遍历，不死循环。
  - 节点访问次数上限 `CRITICAL_PATH_MAX_NODES`；超过时停止扩展并置 `capped = true`。
- `ready`：开放任务且所有 `dependsOn` 都存在且 `isDependencyDone` 为 true（没有依赖也算 ready）；按 `compareTaskOrder` 排序；`truncated = ready.length > CRITICAL_PATH_LIMIT`，返回前 `CRITICAL_PATH_LIMIT` 条。
- `blocked`：开放任务中存在至少一个未完成或缺失前置的数量。
- `missing`：所有开放任务的 `dependsOn` 中，不在视图内的 id 去重数量。
- 所有计数为非负整数；空输入返回空链、0 计数、`capped = false`。
- 不读时钟、不请求网络、不写任何记录。

**客户端**（`src/client/project-detail.ts`）：

- 在「依赖关系图」卡片之后新增「关键路径」卡片；卡片头标题 `t.critPathTitle`，提示 `t.critPathHint`（明确「按依赖跳数，不代表工期」）。
- 统计行：关键路径长度、可开始数、被阻塞数、缺失前置数。
- 关键路径列表：按顺序显示 `第 N 步：标题` 的按钮，点击 `props.onSelectTask(id)`；空链显示 `t.critPathNoChain`。
- 可开始列表：最多 5 条按钮，显示标题与本地化状态（`boardStatusLabel(t, boardStatus(node.status, false))` 或项目详情已有的 `resolveStatus` 口径）；超过 5 条显示 `t.critPathTruncated`。
- 无依赖提示：项目有开放任务但没有任何依赖时显示 `t.critPathNoDeps`；没有可开始任务时显示 `t.critPathNoReady`。
- 循环提示：`cycles.length > 0` 时显示 `t.critPathCycle`，不只靠颜色。
- 空项目显示 `t.critPathEmpty`。
- 样式加到 `.dshwd-critpath*` 作用域，复用现有 token。

**边界**：

- 不计算工期、不按估算推算时间、不做甘特图；文案不得出现「预计完成时间」。
- 不做拖拽调整依赖、不做自动排期、不做资源分配。
- 不替代依赖关系图：图展示结构，卡片展示最长链与可执行队列。
- 跨项目 id 一律按缺失前置处理，不尝试解析其他项目。

### 3.6 验收标准

- [ ] 空项目、无依赖项目、单任务项目都能正确渲染，不报错、不出现空列表占位。
- [ ] 线性链、菱形依赖、多根节点、多个缺失前置都能正确计算 depth 与最长链。
- [ ] 循环依赖不死循环、不崩溃，`cycles` 非空并显示提示；链仍然可用。
- [ ] 已完成（合并 / 清理）的前置不阻塞；未完成、缺失前置计入 `blocked` / `missing`。
- [ ] 归档任务不出现在可开始列表；开放任务的 `broken` 状态仍可出现。
- [ ] 可开始任务按 `compareTaskOrder` 排序，超过 5 条截断并提示。
- [ ] 同一输入多次计算结果一致；无 NaN / 负数 / 负坐标。
- [ ] 点击链上任务与可开始任务都能跳转；键盘可达，有可访问名称。
- [ ] 不写台账、不改变依赖或状态、不请求网络。
- [ ] 中英文 locale key 完全一致，`npm run check:locale` 通过。

### 3.7 测试要点

- 新增 `test/client-critical-path.test.ts`：
  - 空项目：空链、0 计数、`capped` false。
  - 无依赖：所有开放任务 ready，最长链长度为 1。
  - 线性链 A→B→C：链顺序、length 3、ready 只有 A。
  - 菱形 A→B、A→C、B→D、C→D：最长链 3，depth 正确，ready 只有 A。
  - 多根 / 多前置：最长链选择确定性（相同 depth 时按 `compareTaskOrder`）。
  - 已完成前置（mergedAt / cleanedAt）不阻塞；未完成前置阻塞；缺失前置计入 missing。
  - 循环 A→B→A：不死循环，`cycles` 非空，结果仍返回。
  - 归档任务排除；`broken` 开放任务保留。
  - 超过 5 个 ready 任务：`ready.length === 5`、`truncated` true。
  - 节点上限：构造超过 500 个任务或长链，`capped` true 且不超时。
  - 确定性：同一输入两次输出深度相等。
- 不修改现有测试文件。

---

## 4. 任务交接摘要（Handover brief）

### 4.1 功能说明

任务详情「概览」新增「交接摘要」区块：

- 提供「复制交接摘要」与「下载 .md」两个按钮；两者共用同一份 Markdown。
- 摘要面向**接手的人或 Agent**，内容包括：
  - 任务元数据：项目、当前状态、任务分支、基线分支、worktree 路径、当前 HEAD、领先提交数、未提交改动数。
  - 规划字段：优先级、标签、截止日期、估算、累计工时（计时中标注）。
  - 备注（有则输出，保留换行）。
  - 前置任务（标题 + 完成 / 未完成 / 缺失）与后继任务（哪些任务依赖当前任务）。
  - 验收进度：`已核对 / 总数`，以及未核对项列表；无标准时说明。
  - 最近提交（最多 5 条，短 SHA + 标题）；无提交时说明。
  - 下一步建议：根据状态、归档、未完成前置推导；被前置阻塞时明确列出前置标题。
- 摘要不包含 diff 正文、文件列表、完整验收标准勾选明细（只列未核对项）——这些属于验收报告。
- 文件名 `handover-<id8>-<YYYYMMDD>-<HHmm>.md`。
- 只读生成，不写台账、不请求网络、不改变任务状态。

### 4.2 为什么做

当前验收报告面向「验收走查」：它输出改动文件、diff 统计、完整验收标准，适合判断「做完了没有」。但当任务要交给另一个人或另一个 Agent 继续时，接手者最需要的不是 diff，而是：现在处于什么状态、还差什么、依赖谁、谁依赖我、下一步该做什么。这些信息目前散落在任务详情、依赖列表、验收区块和 Git 快照里，交接只能靠口头或手动复制。交接摘要把这些信息压成一份可直接粘贴的 Markdown，降低上下文丢失和重复沟通。

### 4.3 预期效果

- 在任务详情点一次「复制交接摘要」，得到的文本可以直接贴到会话、PR 评论或交接文档。
- 摘要明确写出「下一步建议」，例如「继续开发，完成后提交并进入验收」「先完成前置任务：A、B」「切到主仓库验收，或直接合并」。
- 后继任务列表让接手者知道自己的改动会影响谁；没有后继时明确写「无后继任务」。
- 未核对验收项只列剩余项，不重复已核对项；全部核对时明确写「全部已核对」。
- 计时中、缺失快照、损坏时间戳、无提交、无备注都能安全输出，不出现 NaN / `undefined` / 空白章节。
- 复制与下载内容完全一致；文件名符合约定。

### 4.4 收益

- **降低交接成本**：一份文本覆盖状态、依赖、验收与下一步。
- **减少上下文丢失**：接手者不需要重新读任务详情和 Git 状态。
- **区分场景**：验收报告用于走查，交接摘要用于继续工作，各自更短更聚焦。
- **零副作用**：纯函数生成，不写台账、不触发 Git 操作。

### 4.5 实现方案

**纯函数模块**（新增 `src/client/handover.ts`）：

```ts
export interface HandoverDependency {
  id: string
  title: string
  done: boolean
  missing: boolean
}

export interface HandoverInput {
  task: WorktreeTask
  snapshot: TaskSnapshot
  /** All task views in the same project; used to derive dependents. */
  views: TaskView[]
  projectName: string
  /** Localized status label, matching the Stage chip. */
  statusLabel: string
  t: Record<string, any>
  now?: number
}

export function buildHandoverBrief(input: HandoverInput): string
export function handoverFilename(task: WorktreeTask, now?: number): string
```

规则：

- 前置任务：遍历 `task.dependsOn`，在 `views` 中查找；找到则 `done = isDependencyDone(task)`，找不到则 `missing = true`、`title = id`。
- 后继任务：`views` 中 `dependsOn` 包含当前任务 id 的任务；输出标题与当前状态（使用 `statusLabel` 回调或 `snapshot.status` 的本地化映射）。后继只读展示，不递归。
- 状态与下一步：
  - `task.archivedAt` → `t.handoverReportNextArchived`。
  - 否则按 `snapshot.status`：
    - `ready` → `t.handoverReportNextReady`
    - `developing` → `t.handoverReportNextDeveloping`
    - `review` / `reviewing` → `t.handoverReportNextReview`
    - `merged` → `t.handoverReportNextMerged`
    - `cleaned` → `t.handoverReportNextCleaned`
    - `broken` → `t.handoverReportNextBroken`
    - 其他 → `t.handoverReportNextReady`
  - 如果存在未完成或缺失的前置，在建议前追加 `t.handoverReportBlockedBy`，填入前置标题（逗号分隔）；状态建议仍保留在下一行，方便接手者知道后续动作。
- 验收：复用 `criteria(task, snapshot.status)` 与 `criteriaProgress`；只输出未核对项（`checked === false`），每项 `- [ ] 文本`；全部核对输出 `t.handoverReportAllChecked`；无标准输出 `t.handoverReportNoCriteria`。
- 工时：`workTimingText(t, task, now)`；估算：`parseEstimate`，合法输出 `t.taskEstimatePoints`，否则 `t.taskEstimateEmpty`；截止日期：`dueInputValue` / `t.reportDueNone`。
- 提交：`snapshot.worktree.commits` 前 5 条，输出短 SHA + 标题；无提交输出 `t.handoverReportNoCommits`。
- Git 数字：`snapshot.worktree.ahead`、`dirtyCount`、`branchHeadSha(task, snapshot)`；缺失按 0 / `—`，不出现 `undefined`。
- 章节顺序固定：标题、元数据、规划字段、备注、前置、后继、验收、最近提交、下一步建议、说明。
- 报告文本只使用 `t` 字典；不硬编码中文或英文。
- `handoverFilename` 复用 `pad2` 与任务 id8（参考 `report.ts` 的 `id8`），格式 `handover-<id8>-<YYYYMMDD>-<HHmm>.md`。
- 纯函数不读时钟（除默认 `now`）、不写文件、不请求网络。

**客户端**：

- `src/client/board/use-board-actions.ts`：
  - `UseBoardActionsArgs` 新增 `allViews: TaskView[]`（同一项目的全部任务视图；board 已持有 `allViews`）。
  - 新增 `handoverMarkdown(view)`：调用 `buildHandoverBrief({ task, snapshot, views: allViews, projectName, statusLabel, t })`。
  - 新增 `runCopyHandover()` / `runDownloadHandover()`：复用 `copyText` / `downloadText`，`setBusy('handover')`，成功 Toast 用 `t.handoverCopied` / `t.handoverDownloaded`，失败用 `t.reportFailed`。
  - 在返回值中导出两个方法。
- `src/client/board.ts`：
  - 调用 `useBoardActions` 时传入 `allViews`。
  - 给 `Stage` 传 `onCopyHandover`、`onDownloadHandover`、`handoverBusy: !!busy`。
- `src/client/stage.ts`：
  - `StageProps` 新增 `onCopyHandover?: () => void`、`onDownloadHandover?: () => void`、`handoverBusy?: boolean`。
  - 在 `Overview` 的 `TaskMetaSection` 之后、`TaskLifecycleSection` 之前新增 `HandoverSection`：标题 `t.handoverTitle`、提示 `t.handoverHint`、两个按钮；按钮有可访问名称，`handoverBusy` 时禁用并显示 `t.working`。
- 不新增 HTTP 路由，不写台账。

**边界**：

- 不做「自动发送到会话」；复制 / 下载由用户主动触发。
- 不做多人协作、评论、@提醒。
- 不包含 diff 正文与完整文件列表；这些仍在验收报告。
- 不把交接摘要写回任务备注或台账。

### 4.6 验收标准

- [ ] 复制与下载内容完全一致；文件名符合 `handover-<id8>-<YYYYMMDD>-<HHmm>.md`。
- [ ] 六种任务状态（ready / developing / review / merged / cleaned / broken）与归档状态都输出对应的下一步建议。
- [ ] 有未完成 / 缺失前置时，建议中列出前置标题；后继任务列表正确，无后继时明确说明。
- [ ] 验收区块只列未核对项；全部核对 / 无标准分别有明确文案。
- [ ] 运行中的计时被标注；非法工时 / 估算 / 截止日期不出现 NaN / `undefined`。
- [ ] 最近提交最多 5 条；无提交时明确说明；HEAD 缺失时显示 `—`。
- [ ] 备注保留换行；无备注时明确说明。
- [ ] 摘要不包含 diff 正文、文件列表或完整验收标准正文。
- [ ] 任务详情按钮键盘可达，忙时禁用，失败有 Toast。
- [ ] 中英文 locale key 完全一致，`npm run check:locale` 通过。

### 4.7 测试要点

- 新增 `test/client-handover.test.ts`：
  - 六种状态 + 归档的下一步建议。
  - 前置：全部完成 / 部分未完成 / 缺失 / 无前置。
  - 后继：有后继 / 无后继 / 后继状态文案。
  - 验收：无标准 / 部分核对 / 全部核对；只列未核对项。
  - 备注：单行 / 多行 / 空。
  - 工时：未计时 / 已计时 / 计时中；估算：合法 / 非法 / 缺失；截止日期：有 / 无。
  - 提交：0 条 / 3 条 / 6 条（只取 5 条）；HEAD 缺失。
  - 文件名：slug、日期、时间、fallback。
  - 文本不包含 `undefined` / `NaN` / `Infinity`。
- 不修改现有测试文件。

---

## 5. 自上次访问以来的变化（Visit digest）

### 5.1 功能说明

看板左栏在首次加载后显示一条可关闭的「自上次访问」摘要条：

- 内容：上次访问之后的新建任务数、合并任务数、当前待验收数、当前逾期数、新增工时；没有工时时省略工时项。
- 只有存在上次访问时间且确实有变化 / 有需要注意的任务时才显示；首次访问不显示。
- 摘要条提供关闭按钮；关闭只影响本次挂载，不写入「已读」状态。
- 所有数字来自当前任务视图与本地存储的上次访问时间，不请求服务端、不写任务台账。
- localStorage 不可用、内容损坏、时间戳在未来时安全降级为「不显示摘要」，看板其余功能不受影响。

### 5.2 为什么做

用户经常离开看板一段时间，回来时面对几十个任务，很难快速判断「我不在的时候发生了什么」。现有注意力筛选回答「现在哪些需要处理」，但没有时间维度：它不会告诉用户哪些任务是刚新建的、哪些是刚合并的、自己离开期间新增了多少工时。一个轻量的「自上次访问」摘要能在打开看板的第一屏回答这个问题，而不需要用户逐个筛选或翻时间线。

### 5.3 预期效果

- 离开一段时间后回到看板，左栏顶部出现一行摘要，例如「自上次访问：新建 2 · 合并 1 · 待验收 3 · 逾期 1 · 新增工时 1 小时 20 分」。
- 首次访问、刚清空浏览器存储、或上次访问时间在未来时，不显示摘要条，也不报错。
- 没有变化且没有待验收 / 逾期任务时，不显示摘要条，避免噪音。
- 关闭后本次挂载内不再出现；刷新页面后按新的上次访问时间重新计算。
- localStorage 被禁用或配额不足时，看板正常加载，只是不显示摘要。

### 5.4 收益

- **快速回归**：第一屏知道离开期间的变化，不用逐条翻任务。
- **时间维度**：补上注意力筛选缺少的「新近变化」视角。
- **低打扰**：只在有内容时出现，可一键关闭，不写「已读」状态。
- **零副作用**：只读派生 + 本地存储，不写台账、不请求网络。

### 5.5 实现方案

**纯函数模块**（新增 `src/client/visit-digest.ts`）：

```ts
export const VISIT_EVENT_LIMIT = 8

export type VisitEventKind = 'created' | 'merged' | 'cleaned' | 'archived'

export interface VisitEvent {
  taskId: string
  title: string
  kind: VisitEventKind
  at: number
}

export interface VisitDigest {
  /** Previous visit timestamp used for the diff. */
  since: number
  now: number
  created: number
  merged: number
  cleaned: number
  archived: number
  /** Current tasks waiting for acceptance (status review / reviewing). */
  review: number
  /** Current open tasks past their due date. */
  overdue: number
  /** Current open tasks considered stalled by the shared threshold. */
  stalled: number
  /** Work accumulated between `since` and `now` across all tasks (ms). */
  workMs: number
  /** Distinct tasks with at least one event since `since`. */
  changed: number
  events: VisitEvent[]
  truncated: boolean
}

export function buildVisitDigest(
  views: TaskView[],
  since: unknown,
  now?: number,
): VisitDigest | null
```

规则：

- `since` 只接受有限正数；缺失、非法、`since >= now` 时返回 `null`（首次访问 / 未来时间不显示）。
- 事件时间：`createdAt` / `mergedAt` / `cleanedAt` / `archivedAt` 满足 `since < at <= now`；非法时间跳过。
- 计数按事件类型累加；`changed` 按任务 id 去重。
- `review`：当前状态为 `review` 或 `reviewing` 且未归档的任务数（不要求发生在窗口内，文案是「待验收」而不是「新待验收」）。
- `overdue`：当前开放任务中 `dueStateOf(task.dueAt, now)` 为 `overdue` 的数量。
- `stalled`：当前开放任务中 `stalledDays(task, snapshot, now) != null` 的数量。
- `workMs`：对每个任务计算 `elapsedWorkMs(task, now) - elapsedWorkMs(task, since)`，只累加正数；时钟回拨或非法值按 0。**这是累计工时的增量，能正确反映运行中的计时区间在窗口内的部分**。
- 事件排序：时间降序 → 标题升序 → id 升序 → 类型固定顺序；截取前 `VISIT_EVENT_LIMIT` 条，`truncated` 标记。
- 返回 `null` 时调用方不显示摘要；返回对象即使所有计数为 0 也由调用方决定是否显示（建议：`changed + review + overdue + workMs === 0` 时不显示）。

**存储适配器**（新增 `src/client/visit-storage.ts`）：

```ts
export const LAST_VISIT_KEY = 'dshw-board:last-visit:v1'

/** Previous visit timestamp; null when missing, invalid or storage is unavailable. */
export function loadLastVisit(storage?: Storage | null): number | null

/** Persist the current visit; returns false when storage is unavailable or full. */
export function saveLastVisit(at: number, storage?: Storage | null): boolean
```

- `storage` 默认取 `window.localStorage`，但必须 `try/catch`；隐私模式 / 配额不足 / 被禁用时 `load` 返回 `null`、`save` 返回 `false`，不抛异常。
- 存储值使用 JSON `{ at: number }`；读取时校验有限正数，非法内容返回 `null`，不写回坏数据。
- key 带 `:v1`，与 `view-storage.ts` 的降级模式一致。

**客户端**（`src/client/board.ts` 与 `src/client/rail.ts`）：

- `board.ts`：
  - 新增 state `visitDigest`（`VisitDigest | null`）与 `visitDismissed`（boolean，或直接用 `visitDigest` 置空）。
  - 新增 `visitCaptured` ref；在 `loaded` 为 true 且尚未捕获时执行一次：
    1. `const now = Date.now()`。
    2. `const previous = loadLastVisit()`。
    3. `saveLastVisit(now)`（先算后写；写失败不影响摘要）。
    4. `previous == null` → 不显示。
    5. `const digest = buildVisitDigest(allViews, previous, now)`；`digest` 为 `null` 或 `digest.created + digest.merged + digest.review + digest.overdue + digest.workMs === 0` → 不显示；否则 `setVisitDigest(digest)`。只发生归档 / 清理时摘要行没有可展示的数字，保持安静。
  - 依赖数组使用 `[loaded, allViews]`，但 `visitCaptured` ref 保证每个挂载只执行一次；轮询刷新不会重置摘要。
  - 给 `Rail` 传 `visitDigest` 与 `onDismissVisit: () => setVisitDigest(null)`。
- `rail.ts`：
  - `RailProps` 新增 `visitDigest?: VisitDigest | null`、`onDismissVisit?: () => void`。
  - 在搜索 / 视图控件之后、注意力筛选之前渲染摘要条：
    - `role="status"`，`aria-label` 为 `t.visitTitle`。
    - 文本使用 `t.visitSummary` 填充 `{created}` / `{merged}` / `{review}` / `{overdue}` / `{work}`；`workMs` 为 0 时使用 `t.visitSummaryNoWork`。
    - 工时使用 `formatWorkDuration(digest.workMs, workDurationUnits(t))`。
    - 关闭按钮 `aria-label` 为 `t.visitDismiss`，点击调用 `onDismissVisit`。
  - 摘要条不改变任何筛选状态；不点击跳转，保持轻量。
- 样式加到 `.dshwd-visit*` 作用域，复用现有 token；窄屏不溢出，文本可换行。
- 多窗口语义（写进文档与注释）：同一浏览器同源窗口共享 localStorage；任一窗口挂载都会先计算自己的摘要、再更新上次访问时间。因此窗口 A 刷新后，窗口 B 下次刷新看到的是 A 之后的变化，这是有意为之的「最后一次打开看板之后的变化」语义。

**边界**：

- 不做跨设备 / 跨浏览器同步。
- 不做已读回执、通知中心、邮件或系统通知。
- 不写任务台账，不改变任务状态、排序或筛选。
- 不把摘要条做成可点击的筛选器；保持只读提示。

### 5.6 验收标准

- [ ] 首次访问（无存储值）不显示摘要条，并写入当前访问时间。
- [ ] 有上次访问时间且存在变化时，摘要条显示新建 / 合并 / 待验收 / 逾期 / 新增工时；无工时时使用无工时文案。
- [ ] 事件边界：`since` 之后、`now` 之前（含 `now`）的事件计入；`since` 当刻的事件不计入；未来时间戳忽略。
- [ ] 新增工时按 `elapsedWorkMs(now) - elapsedWorkMs(since)` 计算，运行中的计时正确；时钟回拨不产生负数。
- [ ] 没有变化且没有待验收 / 逾期时不显示摘要条。
- [ ] 摘要条可关闭；关闭只影响本次挂载。
- [ ] localStorage 不可用、内容损坏、值为未来时间时，看板正常加载，不抛异常、不显示坏数据。
- [ ] 摘要条 `role="status"`、关闭按钮有可访问名称、文本不只靠颜色表达；不使用 `aria-label` 覆盖可见摘要文本。
- [ ] 不写台账、不改变任务状态与筛选。
- [ ] 中英文 locale key 完全一致，`npm run check:locale` 通过。

### 5.7 测试要点

- 新增 `test/client-visit-digest.test.ts`：
  - `since` 为 null / 0 / 负数 / 非数字 / 未来时间：返回 null。
  - 边界：`since` 当刻、`since + 1`、`now`、`now + 1`。
  - 新建 / 合并 / 清理 / 归档计数；同一任务多事件时 `changed` 去重。
  - 待验收 / 逾期 / 停滞当前状态；归档 / 合并 / 清理排除。
  - 工时增量：无计时、已停止计时、运行中计时、跨 `since` 的区间、时钟回拨。
  - 事件排序、截断（超过 8 条）、`truncated`。
  - 空项目、全 0 摘要。
- 新增 `test/client-visit-storage.test.ts`：
  - 正常读写往返；无值返回 null；损坏 JSON / 非对象 / 非法 `at` 返回 null。
  - Storage 抛异常（getItem / setItem）时 load 返回 null、save 返回 false，不抛。
  - 配额不足（setItem 抛错）时 save 返回 false。
- 不修改现有测试文件。

---

## 6. 通用实现约定

1. **纯函数优先**：周报、校准、关键路径、交接文本、访问摘要都放在无 DOM 的纯模块里；客户端只负责取数、格式化与渲染。所有涉及「现在」的函数接受可注入的 `now`，测试不得依赖系统时钟。
2. **零写入**：本批次不新增台账字段、不调用 `Store` 写方法、不新增 HTTP 路由、不触发 Git。所有功能只读 `TaskView[]` / `TaskSnapshot` / `localStorage`。
3. **复用既有口径**：状态文案用 `boardStatusLabel` / `boardStatus`；验收用 `criteria` / `criteriaProgress`；截止日期用 `dueStateOf` / `dueInputValue`；停滞用 `stalledDays`；依赖完成用 `isDependencyDone`；工时用 `elapsedWorkMs` / `workTimingText` / `formatWorkDuration`；Markdown 用 `mdInline` / `mdCell` / `mdCodeCell` / `fill` / `reportTimestamp` / `safeSlug`。不要复制第二套规则。
4. **空态优先**：空项目、无变化、无样本、无依赖、无提交、无备注、localStorage 不可用都必须在实现前设计好文案与布局；不得出现 `NaN` / `Infinity` / `undefined` / 空白章节。
5. **文案**：所有新文案同时加入 `locale/zh.json` 与 `locale/en.json`，key 集合一致；`npm run check:locale` 必须通过。每个功能的 key 使用固定前缀：`digest*` / `calibr*` / `critPath*` / `handover*` / `visit*`，并插入到 locale 文件的不同锚点，降低 cherry-pick 冲突。
6. **可访问性**：窗口下拉、复制 / 下载按钮、摘要关闭按钮、链上任务 / 可开始任务按钮都必须有可访问名称；状态与提示用文本表达，不只靠颜色；摘要条使用 `role="status"`；错误用 `role="alert"`。
7. **不新增依赖**：不引入日期库、图表库、Markdown 库、状态管理库或 UI 库；继续使用现有原语与手写样式。
8. **文档同步由主线程完成**：实施者不要修改 `README.md`、`CHANGELOG.md`、`docs/`、`package.json`、`package-lock.json`、`feature.md`；这些由主线程在集成时统一更新到 1.16.0。
9. **最小 diff**：不重排现有代码、不重命名既有函数、不格式化整文件；共享文件只改本功能需要的行。共享文件包括 `src/client/project-detail.ts`、`src/client/stage.ts`、`src/client/board.ts`、`src/client/rail.ts`、`src/client/board/use-board-actions.ts`、`src/client/styles/workbench.ts`、locale 文件。
10. **测试**：每个功能至少一个新增测试文件，文件名按第 1–5 节指定；不要修改现有测试文件，除非确有必要并说明原因。测试使用固定 `now`，覆盖空态、边界、异常数据与确定性。
11. **实施边界**：每个子 agent 只实现自己负责的第 1–5 节之一；完成前运行 `npm run typecheck` 与 `npm test`（worktree 内 node_modules 缺失时先 `npm ci`），失败必须修复；最后只提交一次，并在结果中报告分支名、HEAD SHA、变更文件与测试数量。不要 push，不要创建 PR。
12. **报告一致性**：周报与交接摘要的复制 / 下载必须共用同一份纯函数文本；两份报告都必须使用当前界面语言，不得硬编码中文或英文。
13. **确定性**：所有排序在时间 / 分数相同时必须有 id 或标题兜底；同一输入多次输出必须深度相等。

---

## 7. 批次验收标准

- [ ] 5 个功能均可从项目详情或任务详情触发；空项目、旧记录、无新字段时，行为与 1.15.0 一致。
- [ ] 项目周报的 7 / 14 / 30 天窗口统计正确，边界按本地日历日，交付工时只统计窗口内合并任务的累计工时。
- [ ] 估算校准在样本少于 3 个时只展示样本与「样本不足」，达到阈值后均值 / 中位正确，运行中计时被计入。
- [ ] 关键路径按依赖跳数计算，线性链 / 菱形 / 多根 / 缺失前置 / 循环依赖都有确定结果，不死循环、不出现 NaN。
- [ ] 交接摘要在六种状态与归档下都给出正确的下一步建议，前置 / 后继 / 未核对验收项 / 最近提交完整，不含 diff 正文。
- [ ] 自上次访问摘要在首次访问、无变化、localStorage 不可用、时间戳损坏 / 未来时安全降级；新增工时按累计差计算。
- [ ] 五个功能都不写台账、不请求网络、不触发 Git、不改变任务状态 / 排序 / 合并门禁。
- [ ] 中英文 locale key 完全一致，`npm run check:locale` 通过。
- [ ] `npm run verify`（typecheck + locale + 测试 + 构建）通过，测试数量不少于当前基线的 **661** 项并有所增加（目标 700–760 项）。
- [ ] README、CHANGELOG、docs/frontend-design.md、docs/i18n-terminology.md、package.json、package-lock.json 由主线程更新到 1.16.0。
- [ ] 不引入新依赖；不新增 HTTP 路由；不新增模型字段。

---

## 8. 风险、边界与回滚

- **周报工时口径**：`workMs` 是累计值，没有区间明细，无法拆分「窗口内新增工时」。周报只展示「窗口内合并任务的累计工时」，文案不得暗示可按窗口拆分；需要窗口增量时使用功能 5 的访问摘要。
- **周报窗口边界**：本地日历日、DST、跨月 / 跨年都必须用 `new Date(y, m, d + offset)`；不得用固定 `86400000` 毫秒累加。
- **周报与项目报告重复**：周报不输出逐任务验收正文、备注、diff、文件列表；界面提示写明与项目验收报告的分工。
- **校准样本不足**：上线初期样本很可能为 0 或 1；少于 3 个样本不计算均值 / 中位，只显示样本与缺口，不做趋势推断。
- **校准异常值**：非法估算、负数 / NaN 工时、未来开始时间一律忽略；平均值与中位数取整，避免浮点尾差。
- **关键路径语义**：依赖只有结构没有工期，关键路径是「依赖跳数最长链」，不是耗时；文案与文档不得出现预计完成时间。节点上限与环检测必须有，异常数据不能死循环。
- **关键路径缺失依赖**：缺失 id 不计入链，但计入 `missing` 与 `blocked`；不伪造任务记录，不跨项目解析。
- **交接摘要与验收报告分工**：交接摘要聚焦「下一步、前置 / 后继、剩余验收项、最近提交」，不输出 diff 正文与完整文件列表；验收报告仍是走查入口。
- **交接摘要下一步建议是启发式**：根据状态与前置推导，不是权威指令；不自动执行任何动作。
- **访问摘要多窗口语义**：同源窗口共享 localStorage，任一窗口挂载都会更新上次访问时间；文档写明「最后一次打开看板之后的变化」，不承诺跨窗口合并。
- **访问摘要存储失败**：localStorage 可能被禁用、配额不足或内容损坏；读取失败返回 `null`，写入失败静默降级，不阻塞看板。
- **访问摘要时间异常**：`since` 在未来或非法时返回 `null`，不显示摘要；工时增量只累加正数，时钟回拨不产生负数。
- **集成冲突**：本批次预计在 `project-detail.ts`（功能 1 / 2 / 3）、`stage.ts` 与 `use-board-actions.ts`（功能 4）、`board.ts` 与 `rail.ts`（功能 5）以及 locale 文件产生 cherry-pick 冲突；主线程按「交接 → 校准 → 关键路径 → 周报 → 访问摘要」顺序集成，逐段保留双方新增内容，不重排无关代码。
- **回滚**：
  - 周报：移除卡片与 `project-digest.ts` 即可；无持久化影响。
  - 校准：移除卡片与 `estimate-calibration.ts` 即可；无持久化影响。
  - 关键路径：移除卡片与 `critical-path.ts` 即可；无持久化影响。
  - 交接摘要：移除区块、两个动作与 `handover.ts` 即可；无持久化影响。
  - 访问摘要：移除摘要条与 `visit-digest.ts` / `visit-storage.ts`，或删除 localStorage key 即可；不影响台账。
- **不做的事**：不做自定义日期区间 / 按人统计 / PDF、不做估算自动改写 / 趋势预测、不做工期推算 / 甘特图 / 自动排期、不做交接自动发送 / 评论 / @提醒、不做跨设备同步 / 通知中心。

---

## 9. 文件清单

| 文件 | 改动 |
| --- | --- |
| `src/client/project-digest.ts` | 新增：周报窗口统计、报告文本、文件名 |
| `src/client/estimate-calibration.ts` | 新增：估算校准样本、均值 / 中位、覆盖率 |
| `src/client/critical-path.ts` | 新增：依赖最长链、可开始 / 被阻塞 / 缺失统计 |
| `src/client/handover.ts` | 新增：交接摘要文本、下一步建议、文件名 |
| `src/client/visit-digest.ts` | 新增：自上次访问的变化统计 |
| `src/client/visit-storage.ts` | 新增：localStorage 上次访问时间适配器 |
| `src/client/project-detail.ts` | 新增周报卡片、估算校准卡片、关键路径卡片 |
| `src/client/stage.ts` | 新增交接摘要区块与两个按钮 |
| `src/client/board/use-board-actions.ts` | 新增 `allViews`、交接摘要复制 / 下载动作 |
| `src/client/board.ts` | 传 `allViews` 与交接动作；访问摘要状态与挂载捕获 |
| `src/client/rail.ts` | 新增自上次访问摘要条 |
| `src/client/styles/workbench.ts` | 新增 `.dshwd-digest*` / `.dshwd-calibr*` / `.dshwd-critpath*` / `.dshwd-visit*` 样式 |
| `locale/zh.json`、`locale/en.json` | 新增 `digest*` / `calibr*` / `critPath*` / `handover*` / `visit*` 文案（key 集合一致） |
| `test/client-project-digest.test.ts` | 新增：周报窗口、边界、报告文本 |
| `test/client-estimate-calibration.test.ts` | 新增：校准样本、阈值、中位、覆盖率 |
| `test/client-critical-path.test.ts` | 新增：最长链、ready / blocked / missing、环与上限 |
| `test/client-handover.test.ts` | 新增：交接文本、状态建议、依赖、文件名 |
| `test/client-visit-digest.test.ts` | 新增：访问摘要边界、工时增量、截断 |
| `test/client-visit-storage.test.ts` | 新增：存储读写、损坏、异常降级 |
| `README.md`、`CHANGELOG.md`、`docs/frontend-design.md`、`docs/i18n-terminology.md` | 主线程更新到 1.16.0 |
| `package.json`、`package-lock.json` | 主线程更新到 1.16.0 |

---

## 10. 验收记录

> 实施完成后由主线程填写。

### 10.1 实施来源

| 功能 | 子 agent 分支 | 子 agent HEAD | 集成提交 |
| --- | --- | --- | --- |
| 项目周报 | `t3/client-project-digest` | `074b05f0eb84dd961e7d2fe55ff0b079df09272f` | `6d59dca` |
| 估算校准 | `t3/estimate-calibration-feature` | `9bafc7715e62673493fc4a8ceb776438c888e43e` | `effe003` |
| 关键路径与可开始任务 | `t3/critical-path-ready-tasks` | `8e312eb736b2619a30f667c69730943f24880648` | `66bea48` |
| 任务交接摘要 | `t3/feat/handover-summary` | `41c26f4a938d396e8e61bec629cd5fd16420206f` | `41f7aa5` |
| 自上次访问以来的变化 | `t3/visit-digest-since-last-visit` | `5c4c8c0e9035483afb5b5f56f88539299890a518` | `1401f00` |

实际集成顺序：估算校准 → 关键路径 → 交接摘要 → 访问摘要 → 项目周报（估算校准先完成，先集成不冲突的卡片；其余按改动面从小到大）。

### 10.2 主线程复核修正

- **集成期修正（`e3cbed2`）**：关键路径 `CriticalPath` 新增 `readyTotal`，统计格显示截断前可开始任务总数，而不是 `ready.length`（最多 5）；访问摘要的显示条件改为 `created + merged + review + overdue + workMs === 0` 时隐藏，避免只发生归档 / 清理时出现「全 0」摘要条；移除访问摘要的 `aria-label`，让 `role="status"` 播报完整可见文本。
- **cherry-pick 后去重**：功能 1 与功能 2 都在 `project-detail.ts` 引入 `formatWorkDuration` / `workDurationUnits`，自动合并后出现重复 import；主线程删除重复行，`typecheck` 通过。
- **locale 合并**：功能 2 锚点 `insightsEmpty`、功能 3 锚点 `depGraphTruncated`、功能 4 锚点 `reportDownloaded`、功能 5 锚点 `savedViewDeleted`、功能 1 锚点 `projectReportDownloaded`；自动合并后中英各 973 个 key，`check:locale` 通过。
- **未改动子 agent 实现**：估算校准的阈值与中位口径、交接摘要的 `{deps}` 占位符、访问摘要的累计工时差均按规格保留；如后续统一术语，再同步文案与测试。

### 10.3 验证结果

- `npm run typecheck`：通过。
- `npm run check:locale`：通过，`zh=973 en=973`，客户端引用 742 个 key。
- `npm test`：756 项全部通过，0 失败；基线 661 项，净增 95 项。
- `npm run build`：通过，`dist/index.js`（196.8kb）与 `dist/client.js`（726.3kb）生成。
- `npm run verify`：通过（`typecheck` → `check:locale` → 756 项测试 → `build` 全链路 exit 0）；推送时 pre-push hook 会再跑一次完整 verify。

### 10.4 验收审批

待填。

### 10.5 PR

- 分支：`t3/daily-feature-batch-pipeline`
- PR：待填。
