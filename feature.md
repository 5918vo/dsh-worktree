# 每日功能批次 · 2026-11-26 · v1.16.0

> 批次主题：**计划校准与吞吐复盘**（工时预算、估算校准、任务复制、活动热力图、每周摘要）
>
> 一句话目标：在 1.15.0 已经能回答「花了多久、有多大、哪里有风险」之后，继续回答五个新问题——**预算守住了吗、估算准不准、重复任务能不能一键复用、最近的工作节奏如何、这一周的成果怎么快速汇报**。
>
> 交付方式：一个 PR（`t3/daily-5-feature-batch` → `master`），5 个功能同批验收。
>
> 分工：主线程负责方案、任务拆分、P0 脚手架、集成、验收、文档与 PR；5 个 `pi` 子 agent 分别负责 5 个功能的编码落地与测试。上一批次（1.15.0 工时 / 规模 / 依赖图 / 风险雷达 / 保存视图）的文档见 git 历史。
>
> 状态：已验收（2026-11-26，验收记录见第 10 节）。

## 0. 批次总览

| # | 功能 | 一句话价值 | 主要落点 |
| --- | --- | --- | --- |
| 1 | 工时预算 | 给任务设计划投入上限，接近与超出时主动提示，并进入风险雷达 | 模型 / 纯函数 / Store / HTTP / 工具 / 任务信息 / 左栏 / 风险 / 报告 |
| 2 | 估算校准 | 用已记录工时反推「每个估算点约等于多少小时」，让下一轮估算有据可依 | 纯函数 / 复盘页 / 文案 |
| 3 | 复制任务 | 从现有任务一键生成发布草稿，保留描述、验收标准、标签、优先级与估算 | 纯函数 / 任务详情 / 发布弹窗 |
| 4 | 活动热力图 | 最近 12 周按天着色的日历热力图，直观看新建、合并与更新节奏 | 纯函数 / 复盘页 / 文案 |
| 5 | 每周摘要 | 最近 7 天的投入、完成与风险一键生成可复制 / 下载的 Markdown 周报 | 纯函数 / 复盘页 / 文案 |

设计原则：

- **能派生就不新增状态**：校准、热力图、周报全部由现有任务字段与时间戳派生，不写台账、不请求 Git、不新增轮询；只有工时预算需要新增一个可选字段。
- **可选字段、旧台账零迁移**：`workBudgetHours` 可选；没有该字段的旧任务按「未设预算」处理，读取、排序、状态推导、合并与清理行为都不变。
- **预算只是计划，不是门禁**：超预算不会阻止任何 Git 操作、不会改变任务状态，只影响展示、左栏告警、风险排序与报告。
- **复制只复制「意图」**：复制任务只带走标题、描述、验收标准、标签、优先级与估算；会话、分支、worktree、状态、合并记录、截止日期都不复制，避免把运行时状态误当成新任务的事实。
- **本地日历优先**：热力图、周报、预算展示都按浏览器本地日历日计算；所有涉及「现在」的纯函数接受可注入的 `now`，测试不依赖系统时钟。
- **默认不打扰**：未设预算不显示告警，没有校准样本显示空态，没有活动显示空态，不弹通知、不自动创建任务。
- **不引入依赖、不新增路由**：不新增 npm 包；预算复用 `publish` 与 `task/meta`，其余四个功能都是纯客户端派生。
- **文档即验收**：每个功能都必须有功能说明、动机、预期效果、收益、实现方案、验收标准和测试要点。

---

## 1. 工时预算（Work budget）

### 1.1 功能说明

任务详情「任务信息」在「工时」行之后新增「工时预算」一行：

- 未设置时显示「未设置」；已设置时显示预算时长与已用进度，例如「预算 4 小时 · 已用 3 小时 15 分（81%）」。
- 达到预算 80% 显示「接近预算」；超过 100% 显示「超预算 1 小时 20 分」，并使用告警色。
- 任务详情提供预算输入框（小时，步进 0.25，范围 0.25–1000）；空值表示清除预算。
- 左栏任务行在超预算时显示「超预算 …」告警 chip；该告警与现有「计时中 / 逾期 / 停滞 / 等待前置」等告警共用同一套「每行只显示一个最紧急告警」的规则。
- 项目风险雷达对超预算的开放任务加分，并给出「超出工时预算」原因。
- 单任务验收报告新增「工时预算」行；项目验收报告任务表新增「工时预算」列，逐任务输出预算与超出量。
- 模型工具：`worktree_publish` 支持 `budget_hours`；`worktree_act` 的 `meta` 动作支持 `budget_hours`；任务 briefing 返回 `workBudgetHours`。

预算是**计划字段**，不是计时器：它不会自动开始/停止计时，也不会因为会话运行而消耗；只有用户手工计时产生的工时才会被计入。

### 1.2 为什么做

1.15.0 已经能记录实际工时，但工时只有「事后统计」价值，缺少「事前计划」与「事中提醒」：

1. **没有上限就没有偏差信号**：用户能知道一个任务做了 6 小时，但不知道原计划是 2 小时还是 8 小时，无法判断是否该介入。
2. **估算点与时间脱节**：`1/2/3/5/8` 点是相对规模，不能直接当预算；不设预算时，团队无法把「点数」翻译成「本次可投入多少小时」。
3. **风险雷达缺少投入维度**：现有风险只看逾期、停滞、阻塞、验收缺口；一个已经花掉原计划三倍时间的任务，在雷达上和刚开工时没有区别。
4. **报告缺少计划上下文**：验收报告有实际工时，却没有「计划多少」，交接人无法判断这次投入是否偏离预期。

### 1.3 预期效果

- 用户在任务详情填一次预算，之后每次开始/停止计时都能看到进度；超过 80% 出现「接近预算」，超过 100% 出现「超预算」。
- 预算跨刷新、跨窗口、跨 DSH 重启保留；两个窗口同时编辑预算时以账本锁内的最后一次写入为准。
- 非法输入（0、负数、4.333 小时以外的越界值、布尔、对象、NaN、Infinity、超过 1000 小时）被拒绝，原预算不变。
- 旧任务（没有 `workBudgetHours`）显示「未设置」，不出现 `NaN`、负数、`Infinity` 或 `undefined`。
- 报告中的预算、已用与超出量与界面完全一致；复制/下载后可直接贴到 PR 或周报。
- 超预算不会阻止合并、清理、归档或删除；它只是提示与排序信号。

### 1.4 收益

- **可计划**：任务第一次有了「计划投入」这一列，能和实际工时直接对照。
- **可预警**：不必等到验收才发现投入失控，80% 与 100% 两个节点就能提醒。
- **可校准**：预算与第 2 节估算校准配合，逐步建立「1 点 ≈ 多少小时」的团队经验值。
- **可交接**：报告自带计划与实际，接手的 Agent 或人不需要再问「这个任务原本打算做多久」。
- **低风险**：字段可选、不参与状态机、不阻塞 Git，旧台账完全不受影响。

### 1.5 实现方案

**模型字段**（`src/models.ts`）：

```ts
/** Optional planned work budget in hours; absent means no budget. */
workBudgetHours?: number
```

字段可选，旧记录不需要迁移；读取时按「无预算」处理。

**纯函数模块**（新增 `src/task-budget.ts`）：

```ts
export const BUDGET_MIN_HOURS = 0.25
export const BUDGET_MAX_HOURS = 1000

export type BudgetParse = { ok: true; value: number | null } | { ok: false }

/** Hours input -> normalized hours (2 decimals) or null to clear. */
export function parseWorkBudgetHours(value: unknown): BudgetParse

/** Valid budget in milliseconds, or null when unset/invalid. */
export function workBudgetMsOf(task: { workBudgetHours?: unknown } | null | undefined): number | null

export interface WorkBudgetProgress {
  budgetMs: number
  spentMs: number
  percent: number
  state: 'under' | 'near' | 'over'
  remainingMs: number
  overMs: number
}

/** Budget + elapsed work; null when the task has no valid budget. */
export function workBudgetProgress(task, now?: number): WorkBudgetProgress | null

/** Trim trailing zeros: 4, 4.5, 0.25. */
export function budgetHoursText(hours: number): string
```

规则：

- `null` / `undefined` / `''` 表示清除；数字或数字字符串按小时解析；布尔、对象、数组、`NaN`、`Infinity`、0、负数、小于 0.25 或大于 1000 均拒绝。
- 合法值四舍五入到 2 位小数；`workBudgetMsOf` 只在预算合法时返回 `hours * 3600000`，否则 `null`。
- `workBudgetProgress` 复用 `src/task-timer.ts` 的 `elapsedWorkMs`，包含正在运行的计时区间；`percent` 可超过 100；`state` 在 `percent >= 80` 时为 `near`，超过 100% 或已用大于预算时为 `over`；`remainingMs` 不小于 0，`overMs` 不小于 0。
- 时钟回拨、未来开始时间、损坏字段都按 0 处理，不产生负数。

**Store**（`src/store.ts`）：

- `TaskMetaPatch` 增加 `workBudgetHours?: unknown`；`TaskMetaResult` 增加 `budget-invalid`。
- `updateTaskMeta` 在写入前统一校验；合法值写入，`null` 删除字段；非法值不修改任务并返回 `budget-invalid`。
- 与其他元数据在同一把跨进程账本锁内完成读取、校验、写入，避免两个窗口互相覆盖。

**发布**（`src/runtime/projects.ts`、`src/runtime/types.ts`）：

- `PublishInput` 增加 `workBudgetHours?: unknown`。
- 在创建项目、分支、worktree 之前校验；非法值直接 400，不留下半发布任务。
- 合法非空值写入新任务。

**HTTP 与工具**：

- `POST publish` 接受 `workBudgetHours`；`POST task/meta` 只在请求体真正带该键时透传（缺席不清除）。
- `worktree_publish` 新增 `budget_hours`；`worktree_act` 的 `meta` 新增 `budget_hours`（`null` / 空串清除）；briefing 返回 `workBudgetHours`。
- `runtime.updateTaskMeta` 把 `budget-invalid` 映射为「工时预算需在 0.25 到 1000 小时之间」。

**界面与报告**：

- `src/client/stage.ts`：只读任务信息显示预算与进度；可编辑状态提供小时输入框，失焦或 Enter 保存，空值清除，本地拦截非法值。
- `src/client/rail.ts` + `rail-summary.ts`：超预算时生成 `budget` 告警，参与「每行一个最紧急告警」排序（位于停滞之后、验收缺口之前）。
- `src/client/project-risk.ts`：新增 `budget` 风险原因，超预算的开放任务 +2 分。
- `src/client/report.ts`：单任务报告新增「工时预算」行。
- `src/client/project-report.ts`：项目报告任务表新增「工时预算」列。
- 所有新文案同时加入 `locale/zh.json` 与 `locale/en.json`。

### 1.6 验收标准

- [ ] 发布、`task/meta`、模型工具三个入口都能设置 / 清除预算；非法值在落盘前被拒绝。
- [ ] 预算为 0.25 / 1000 小时可用；0.24 / 1000.01 被拒绝；4.333 小时规范为 4.33。
- [ ] 未计时任务的预算显示「未设置 / 0%」，开始计时后进度随时间增长。
- [ ] 80% 显示「接近预算」，超过 100% 显示「超预算」与超出时长。
- [ ] 超预算任务出现在风险雷达中，原因为「超出工时预算」，分值为 +2。
- [ ] 单任务报告与项目报告输出预算；英文界面不出现中文单位。
- [ ] 旧记录无预算字段时行为与 1.15.0 完全一致。
- [ ] 超预算不阻止合并 / 清理 / 归档 / 删除。

### 1.7 测试要点

- 纯函数：清除、边界、四舍五入、非法类型、运行中计时、时钟回拨、`percent` / `remainingMs` / `overMs`、无预算返回 `null`。
- Store：设置、清除、非法值不落盘、未带键不清除、两个 Store 实例串行写入。
- HTTP / 工具：`publish` 与 `task/meta` 透传；非法值 400；briefing 返回字段。
- 客户端：阶段信息行、左栏告警、风险原因、两个报告输出。

---

## 2. 估算校准（Estimate calibration）

### 2.1 功能说明

项目详情新增「复盘」页签，其中第一张卡片是「估算校准」：

- 样本：同时具备合法估算点数与已记录工时的任务（包含正在计时的区间）。
- 指标：样本数、累计点数、累计工时、每个估算点约等于多少小时、置信度（样本少 / 可参考 / 较可靠）、估算覆盖率。
- 明细：按偏差绝对值排序列出最多 5 个任务，显示估算点数、实际工时、相对平均值的偏差百分比；偏差在 ±5% 内显示「接近均值」。
- 建议：为未估算任务设置预算时，可按「每点约 N 小时」估算。
- 空态：没有样本时说明「任务需要同时有估算和已记录工时」，不显示 0 或假数据。

### 2.2 为什么做

1. **点数不是时间**：`1/2/3/5/8` 点是相对规模，新成员或新项目无法凭点数安排时间；1.15.0 积累的实际工时为校准提供了第一份数据。
2. **估算是拍脑袋的**：没有校准，点数只会越来越随意；有了「每点约 N 小时」，下一轮估算可以更接近真实投入。
3. **偏差需要可见**：只给平均值不够，用户还需要看到哪些任务显著高于/低于均值，才能判断是估算偏小、范围蔓延，还是计时口径问题。
4. **校准必须低打扰**：它应该是项目复盘页的一张只读卡片，而不是强制填写或自动修改估算。

### 2.3 预期效果

- 有 3 个样本时置信度为「可参考」，6 个及以上为「较可靠」；少于 3 个为「样本少」。
- 运行中的计时会实时计入样本工时；刷新后仍然一致。
- 损坏字段、0 工时、非法估算、未来时间戳被忽略，不出现 `NaN`、`Infinity` 或负数。
- 卡片不修改任何任务、不写 localStorage、不请求 Git。
- 切换项目或刷新后，同一批数据得到同一结果（`now` 注入可复现）。

### 2.4 收益

- **可校准**：从「点数凭感觉」升级为「点数有历史换算率」。
- **可解释**：偏差明细让复盘有具体对象，而不是只看一个平均数。
- **可计划**：第 1 节的预算可以直接参考「每点约 N 小时」。
- **零风险**：纯派生、只读，不影响状态机、排序或 Git 行为。

### 2.5 实现方案

**纯函数模块**（新增 `src/client/estimate-calibration.ts`）：

```ts
export interface CalibrationSample {
  taskId: string
  title: string
  estimate: number
  workMs: number
  hours: number
  expectedHours: number
  variancePercent: number
}

export interface EstimateCalibration {
  samples: CalibrationSample[]
  sampleCount: number
  totalPoints: number
  totalWorkMs: number
  hoursPerPoint: number | null
  confidence: 'low' | 'medium' | 'high'
  estimatedTasks: number
  totalTasks: number
  coveragePercent: number | null
}

export function buildEstimateCalibration(views: TaskView[], now?: number): EstimateCalibration
```

规则：

- 样本条件：`parseEstimate` 合法且非 `null`，`elapsedWorkMs(task, now) > 0`。
- `hoursPerPoint = totalWorkMs / totalPoints / 3600000`；样本为空时为 `null`。
- 每个样本的 `expectedHours = estimate * hoursPerPoint`；`variancePercent` 四舍五入到整数，`expectedHours <= 0` 时为 0。
- 样本按 `|variancePercent|` 降序、工时降序、`taskId` 升序排列。
- 置信度：`sampleCount >= 6` 高，`>= 3` 中，否则低。
- 覆盖率：`estimatedTasks / totalTasks * 100` 四舍五入；无任务时为 `null`。
- 所有非法/缺失/未来时间戳安全忽略；纯函数不修改入参。

**卡片**（`src/client/retro-calibration.ts`）：

- 使用 P0 预置的 `Card`、`CardHead`、`dshwd-retro-card`、`dshwd-calib-*` 样式与 locale 键。
- 无样本显示空态；有样本显示指标、置信度、覆盖率、最多 5 行明细与建议。
- 工时格式化复用 `formatWorkDuration` + `workDurationUnits`，英文界面不出现中文单位。

### 2.6 验收标准

- [ ] 有估算无工时、无估算有工时、非法估算、0 工时都不进入样本。
- [ ] 运行中计时计入样本，刷新后结果一致。
- [ ] 0/2/3/5/6 个样本分别得到低/低/中/中/高置信度。
- [ ] 偏差正负、排序、接近均值阈值正确，不出现 `NaN`。
- [ ] 空项目与空样本显示空态，不报错。
- [ ] 卡片只读，不写台账、不改任务、不请求 Git。

### 2.7 测试要点

- 空输入、非数组、损坏字段、未来时间戳。
- 总点数 / 总工时 / `hoursPerPoint` / 方差 / 排序。
- 置信度边界、覆盖率、`now` 注入。
- 运行中计时与时钟回拨。
- 纯函数不修改入参。

---

## 3. 复制任务（Duplicate task）

### 3.1 功能说明

任务详情右栏生命周期区新增「复制任务」按钮：

- 点击后打开发布弹窗，并预填一份「副本草稿」：标题加「（副本）」后缀，描述、验收标准、标签、优先级与估算照搬。
- 不复制：会话、绑定、分支、worktree、状态、提交、合并记录、截止日期、备注（备注可能包含上一任务的上下文，默认不带）。
- 分支名留空，由发布流程按 Hash 规则自动生成；用户仍需在发布弹窗中确认项目、基线分支和最终标题。
- 若当前已有一份未保存的发布草稿，不覆盖它：提示「请先保存或丢弃当前发布草稿」，避免静默丢失用户输入。

### 3.2 为什么做

1. **重复任务很常见**：同一类修复、同一个模块的后续改动、周期性验收，往往需要复制上一次的描述与验收标准。
2. **发布模板不够用**：模板是抽象预设，无法带上「某个真实任务」的描述、标签、优先级与估算；手工重填既慢又容易漏。
3. **需要低风险**：复制不是克隆运行时状态，而是生成一份可编辑的发布草稿；用户仍然走完整的发布确认流程。

### 3.3 预期效果

- 一次点击即可得到预填草稿；标题带副本后缀，描述、验收标准、标签、优先级、估算与源任务一致。
- 截止日期、分支、会话、状态不进入草稿；不会出现「副本自动继承已合并状态」。
- 取消发布不会产生任何任务；原任务不受影响。
- 已存在脏草稿时不会覆盖，用户会看到明确提示。
- 验收标准为空、标签缺失、估算非法、优先级异常时，草稿安全降级，不出现 `undefined` 文本。

### 3.4 收益

- **省时**：重复任务从「重填一遍」变成「确认一下」。
- **一致**：验收标准和描述沿用上一任务，减少遗漏。
- **安全**：只复制展示字段，不复制运行时状态；用户仍然确认发布参数。
- **可发现**：放在任务详情右栏，和归档、清理等生命周期动作同一区域。

### 3.5 实现方案

**纯函数模块**（新增 `src/client/task-clone.ts`）：

```ts
export function cloneTaskDraft(task: WorktreeTask, copySuffix: string): PublishDraft
```

规则：

- 标题：`trim(title) + suffix`；标题已以 suffix 结尾时不重复追加；空标题只保留后缀。
- 描述原样复制。
- 验收标准：`normalizeCriteria` 去空、去重后用换行拼接进 `manualCriteria`；`pickedCriteria` 为空，避免假设标准库一定包含这些文本。
- 标签：数组用 `', '` 拼接成草稿的原始文本字段。
- 优先级：仅 `low` / `high` 保留，其余回落 `normal`。
- 估算：仅 `1/2/3/5/8` 保留为字符串，其余为空。
- `dueAt`、`branchName` 固定为空；不复制会话、状态、提交、备注。
- 纯函数，不修改源任务。

**界面与接线**：

- `src/client/inspector.ts` 增加可选 `onClone` 回调与「复制任务」按钮（只有回调存在时渲染）。
- `src/client/board.ts` / `use-board-actions.ts` 提供 `cloneTask(task)`：构建草稿；若已有脏草稿则提示 `cloneDraftBusy`，否则写入 `publishDraft` 并打开发布弹窗。
- 发布弹窗继续复用现有 `initialPublishForm`、模板、验收标准库与脏草稿确认逻辑，不改变其语义。

### 3.6 验收标准

- [ ] 复制后标题带后缀，已带后缀不重复。
- [ ] 描述、验收标准、标签、优先级、估算正确进入草稿。
- [ ] 截止日期、分支、会话、状态、提交、备注不进入草稿。
- [ ] 非法标签 / 优先级 / 估算安全降级，不出现 `undefined` 文本。
- [ ] 已有脏草稿时不覆盖，并给出提示。
- [ ] 取消发布不产生任务；原任务完全不变。
- [ ] 纯函数不修改源任务。

### 3.7 测试要点

- 完整字段复制、后缀去重、空标题。
- 验收标准去空 / 去重 / 换行。
- 非法标签、优先级、估算、缺失字段。
- `dueAt` / `branchName` 清空；运行态字段不复制。
- 纯函数不修改入参。

---

## 4. 活动热力图（Activity heatmap）

### 4.1 功能说明

项目详情「复盘」页签新增「活动热力图」卡片：

- 最近 12 周、按周一到周日对齐的日历网格，共 84 个格子。
- 每个格子是一天，统计当天的「新建 / 合并 / 更新」事件总数，并按相对最忙一天分 0–4 级着色。
- 悬停 / 聚焦显示当天明细：日期、新建数、合并数、更新数。
- 提供「少 → 多」图例；今天之后的格子隐藏。
- 近 12 周没有任何活动时显示空态。

### 4.2 为什么做

1. **7 天洞察太短**：现有项目洞察只有最近 7 天的双柱图，看不到一个迭代或一个月的节奏。
2. **节奏比总数更有信息**：同样 20 个任务，均匀分布和集中爆发代表不同的产能与风险；日历热力图能一眼看出断档与高峰。
3. **日批工作流需要复盘**：本仓库按「每日功能批次」推进，12 周热力图能直观看到每天的发布、合并与更新密度。
4. **不需要新数据**：`createdAt`、`mergedAt`、`updatedAt` 已经在台账里，纯派生即可。

### 4.3 预期效果

- 网格始终 12 列 × 7 行，周一位于每列第一格；跨月、跨年、DST 切换都不会错位。
- 当天有事件时格子按强度着色；没有事件时保持弱底色；未来日期不显示。
- 同一任务的新建、合并、更新可以落在同一天或不同天，计数互不覆盖。
- 损坏、负数、未来时间戳被忽略，不出现 `NaN` 或负数强度。
- 卡片只读，不写台账、不请求 Git、不改变任何任务状态。

### 4.4 收益

- **看见节奏**：断档、连续高产、发布集中期一目了然。
- **辅助排期**：结合第 5 节周报，可以判断下一批任务该加量还是减量。
- **零成本**：无新字段、无新接口、无轮询。
- **可比**：同一项目不同时间段的截图可以直接对比。

### 4.5 实现方案

**纯函数模块**（新增 `src/client/project-activity.ts`）：

```ts
export const ACTIVITY_WEEKS = 12

export interface ActivityDay {
  dateKey: string
  start: number
  offset: number
  weekday: number
  week: number
  created: number
  merged: number
  updated: number
  total: number
  intensity: 0 | 1 | 2 | 3 | 4
  future: boolean
}

export interface ProjectActivity {
  days: ActivityDay[]
  weeks: number
  total: number
  max: number
  start: number
  end: number
}

export function buildProjectActivity(views: TaskView[], now?: number): ProjectActivity
```

规则：

- 先用本地 Y/M/D 求「今天所在周的周一」的本地午夜（`weekday = (getDay() + 6) % 7`），再往前 11 周得到网格起点；84 天到本周日。
- 每天用 `new Date(y, m, d + offset)` 生成本地午夜；判断时间戳归属用 `[day.start, nextDay.start)`，不使用 UTC 日边界。
- 事件：`createdAt` → created，`mergedAt` → merged，`updatedAt` → updated；同一任务可贡献多个事件。
- 今天之后的格子 `future = true`，计数为 0，渲染时隐藏。
- 强度：`max = 0` 时全 0；否则 `total/max <= 0.25 / 0.5 / 0.75 / 1` 对应 1/2/3/4；非 0 日至少 1 级。
- 非法 `now` 回落到 `Date.now()`；纯函数不修改入参。

**卡片**（`src/client/retro-activity.ts`）：

- 使用 P0 预置的 `dshwd-heatmap-*` 样式与 locale 键；星期标签使用 `t.activityMon` … `t.activitySun`。
- 工具提示 / `aria-label` 使用 `t.activityDayTip`，日期为 `YYYY-MM-DD`。
- 图例使用 `t.activityLess`、`t.activityMore` 与 5 个示例格子。
- 空态使用 `t.activityEmpty`。

### 4.6 验收标准

- [ ] 网格 12 列 × 7 行、84 格，周一在每列第一格。
- [ ] 本地午夜边界正确；UTC 与本地跨日时落在本地日。
- [ ] 跨月、跨年周对齐正确；DST 切换不丢天、不重复天。
- [ ] 未来格子隐藏且计数为 0。
- [ ] 新建、合并、更新同日计数正确；强度 0–4 正确。
- [ ] 空项目、损坏字段、负数/未来时间戳不报错、不出现 `NaN`。
- [ ] 卡片只读，不写台账、不请求 Git。

### 4.7 测试要点

- 84 天、周一对齐、跨年（12 月/1 月）与本地午夜 vs UTC。
- 未来格子、同日多事件、无效时间戳。
- 强度分级与 `max = 0`。
- `now` 注入使同一任务移动日期桶。
- 空输入 / 非数组安全。

---

## 5. 每周摘要（Weekly digest）

### 5.1 功能说明

项目详情「复盘」页签新增「每周摘要」卡片：

- 统计最近 7 个本地日历日：新建任务、合并任务、记录工时、完成估算点、阻塞任务、7 天内到期、停滞任务。
- 展示 7 个指标卡；无活动时显示空态。
- 提供「复制周报」「下载周报」两个按钮，生成完整 Markdown：项目元数据、统计区间、摘要、任务明细表。
- 文件名 `project-<slug>-weekly-<YYYYMMDD>-<HHmm>.md`，与项目验收报告可区分。
- 周报只包含窗口内有活动的任务；每行输出状态、工时、估算、截止与标签。

### 5.2 为什么做

1. **项目报告是快照，不是周期总结**：现有项目验收报告覆盖全部任务，适合交接，但不适合每天/每周站会快速说明「这一周做了什么」。
2. **手工汇总浪费时间**：新建、合并、工时、阻塞、到期分散在不同界面，手工整理容易漏项。
3. **口径需要统一**：周报由纯函数生成，复制和下载共用同一份文本，避免两个入口数字不一致。
4. **复盘闭环**：配合估算校准与热力图，周报把「投入—完成—风险」串成一份可归档的记录。

### 5.3 预期效果

- 点击一次即可复制或下载最近 7 天周报；窗口边界按本地日历日计算。
- 第 6 天的事件算在窗口内，第 7 天及更早、明天及以后不算。
- 工时包含正在运行的计时；数值使用当前界面语言单位。
- 无活动时生成一份带「本周期没有活动」的 Markdown，而不是空白或报错。
- 损坏时间戳、非法估算、缺失依赖安全忽略，不出现 `NaN`。
- 复制/下载成功与失败都有明确提示；不写任务台账。

### 5.4 收益

- **省时间**：站会/周报从手工汇总变成一键导出。
- **口径一致**：复制和下载共用同一份 Markdown，数字不会互相矛盾。
- **可归档**：周报可以直接贴到 PR、Issue、群聊或交接文档。
- **可复盘**：与热力图、校准卡片组合，形成「节奏—估算—成果」的复盘页。

### 5.5 实现方案

**纯函数模块**（新增 `src/client/project-weekly.ts`）：

```ts
export const WEEKLY_DAYS = 7

export interface WeeklyStats {
  newTasks: number
  mergedTasks: number
  workMs: number
  completedEstimatePoints: number
  blocked: number
  dueSoon: number
  stale: number
}

export interface WeeklyDigest {
  markdown: string
  filename: string
  rangeStart: number
  rangeEnd: number
  stats: WeeklyStats
  activeCount: number
}

export function buildWeeklyDigest(input: WeeklyDigestInput): WeeklyDigest
export function weeklyDigestFilename(project: Project, now?: number): string
```

规则：

- 窗口 = 最近 7 个本地日历日（含今天）：`rangeStart` 为今天本地午夜减 6 天，`rangeEnd` 为明天本地午夜（开区间）。
- 活跃任务：`createdAt` / `mergedAt` / `updatedAt` 任一落在窗口内；无效/负/未来时间戳忽略。
- `newTasks` / `mergedTasks` 按对应时间戳计数；`completedEstimatePoints` 为窗口内合并任务的合法估算之和。
- `workMs` 为窗口内活跃任务的当前累计工时（含运行中计时）；这是「当前累计」口径，不是逐日明细，文档与卡片都按此说明。
- `blocked` 使用 `dependencyStatus` 的 `blocked`（缺失前置不算阻塞）；`dueSoon` 用 `dueDayOffset` 的 0–7 天；`stale` 用 `stalledDays > 0`。
- 开放任务：无归档/合并/清理时间戳，且状态不是 `merged` / `cleaned`。
- Markdown 使用 `markdown.ts` 的转义与表格辅助函数；任务明细按最近活动倒序，最多 30 条。
- 文件名使用 `safeSlug` 与本地时间；`now` 可注入，非法值回落。

**卡片**（`src/client/retro-weekly.ts`）：

- 使用 P0 预置的 `dshwd-weekly-*` 样式与 locale 键。
- 指标卡显示 7 个统计值；工时使用本地化时长。
- 复制 / 下载按钮复用 `copyText` / `downloadText`，通过 `props.notify` 报告结果。
- 按钮点击期间禁用，避免重复生成。

### 5.6 验收标准

- [ ] 窗口边界正确：第 6 天算、第 7 天不算、明天不算。
- [ ] 新建 / 合并 / 工时 / 完成估算点 / 阻塞 / 到期 / 停滞口径正确。
- [ ] 运行中计时计入工时；非法时间戳不产生 `NaN`。
- [ ] 无活动时生成空周报并显示空态。
- [ ] Markdown 标题、区间、摘要、任务表、转义正确；复制与下载文本一致。
- [ ] 文件名带 `weekly` 与本地时间，slug 对中文项目名安全。
- [ ] 不写台账、不请求 Git、不改变任务状态。

### 5.7 测试要点

- 空窗口、窗口边界、跨月/跨年。
- 七项统计与 `activeCount`。
- 运行中计时、损坏时间戳、未来时间戳。
- Markdown 转义、表格、文件名、`now` 注入。
- 纯函数不修改入参。

---

## 6. 通用实现约定

1. **纯函数优先**：估算校准、复制草稿、热力图、周报都放在无 DOM 的纯模块里；服务端、客户端与测试共用同一套规则。所有涉及「现在」的函数接受可注入的 `now`。
2. **可选字段、零迁移**：只有 `workBudgetHours` 是新字段；旧记录读取为「未设预算」，排序、状态、Git 行为不变。
3. **原子写**：预算走 `Store.updateTaskMeta` 的 `withLock` + `refreshTasks` + 校验 + `saveTasks`；HTTP / Runtime 只做校验与错误映射。
4. **派生视图不写状态**：校准、热力图、周报不写台账、不写 localStorage、不请求 Git。
5. **复制只复制展示字段**：不复制会话、分支、worktree、状态、提交、合并记录、截止日期、备注；发布仍走完整确认流程。
6. **本地日历**：热力图与周报按浏览器本地日计算；热力图使用 `Date.UTC(y,m,d)` 求星期偏移，日边界仍用本地午夜。
7. **文案**：所有新文案同时加入 `locale/zh.json` 与 `locale/en.json`，key 集合一致；`npm run check:locale` 必须通过。
8. **可访问性**：热力图格子有 `role="img"` 与可读的 `aria-label`；图表同时提供文字图例；复制/下载按钮有明确名称、忙碌时禁用；周报空态有文字说明。
9. **不新增依赖、不新增路由**：不引入日期库、图表库或状态管理库；预算复用 `publish` 与 `task/meta`。
10. **文件所有权**：P0 由主线程统一写共享文件（复盘页签、样式、locale、风险文案）；实现 agent 只写各自纯模块、卡片、测试与明确分配的接线文件，不重排无关代码。
11. **测试**：每个功能至少一个新增测试文件；不依赖系统时钟；纯函数覆盖边界与损坏数据；主线程最后运行完整 `npm run verify`。
12. **文档同步由主线程完成**：实施者不修改 `README.md`、`CHANGELOG.md`、`docs/`、`package.json`、`package-lock.json`、`feature.md`。

---

## 7. 批次验收标准

- [x] 5 个功能均可从 UI 或模型工具触发；未设预算 / 无样本 / 无活动时，行为与 1.15.0 一致。
- [x] `workBudgetHours` 在发布、`task/meta`、模型工具三条入口下都能设置 / 清除；非法值被拒绝且不落盘。
- [x] 预算进度、接近/超出提示、左栏告警、风险原因、单任务报告与项目报告口径一致。
- [x] 复制任务保留描述、验收标准、标签、优先级与估算；不复制运行态；脏草稿不覆盖。
- [x] 热力图 12 周 × 7 天、周一对齐、本地日边界、跨年、未来格子正确；不出现 `NaN`。
- [x] 周报窗口边界、七项统计、Markdown 内容与文件名正确；复制/下载一致。
- [x] 旧任务记录（无新字段）加载不报错，排序与状态不变。
- [x] `npm run check:locale` 通过；中英文 key 完全一致（各 953 个）。
- [x] `npm run verify`（typecheck + locale + 测试 + 构建）通过，测试数量较 1.15.0 基线（697 项）增加 69 项至 766 项。
- [x] README、CHANGELOG、docs/frontend-design.md、docs/i18n-terminology.md、package.json、package-lock.json 更新到 1.16.0。
- [x] 不引入新依赖；不新增 HTTP 路由。

---

## 8. 风险、边界与回滚

- **预算字段兼容**：`workBudgetHours` 可选；旧版本忽略新字段；读取时按无预算处理；清空即删除字段。
- **预算时钟异常**：系统时钟回拨、未来开始时间、损坏字段按 0 / 未计时处理；不产生负数或 `Infinity`。
- **预算并发**：设置/清除在账本锁内完成；两个窗口同时编辑以最后一次成功写入为准；非法值不覆盖原值。
- **预算语义**：预算不是门禁，不阻止合并/清理/归档/删除；不自动开始/停止计时。
- **校准样本偏差**：手工计时可能漏记/多记；样本少时置信度低；卡片只给建议，不自动修改估算或预算。
- **校准运行中计时**：正在计时的任务按当前累计值进入样本；停止后结果会变化，属于预期。
- **复制风险**：用户可能重复发布；发布弹窗仍需确认标题/项目/分支；复制不带运行时状态，不产生自动任务。
- **脏草稿冲突**：已有未保存草稿时不覆盖，提示用户先保存或丢弃，避免丢失输入。
- **热力图时区**：按浏览器本地日计算；跨时区使用同一台账会得到不同日桶，这是本地日历语义，不是数据错误。
- **热力图强度**：强度是相对最忙一天的比例，不是绝对值；最忙一天变化时其他格子的等级会变化，属于预期。
- **周报工时口径**：`workMs` 是窗口内活跃任务的当前累计工时，不是逐日拆分；没有逐日工时时不伪造拆分。
- **周报边界**：窗口按本地午夜开区间；跨 DST 使用本地日期构造，不按 86,400,000 毫秒硬算。
- **集成冲突**：本批次共享文件集中在 `project-detail.ts`、`styles/workbench.ts`、locale 与预算相关的 `store.ts` / `http.ts` / `tools.ts`；主线程统一写共享文件，实现 agent 只写分配文件。
- **回滚**：
  - 预算：移除任务信息行、左栏告警、风险原因与报告行列即可；字段留在记录中不影响旧版本。
  - 校准 / 热力图 / 周报：删除复盘页签对应卡片与纯模块即可；不涉及台账迁移。
  - 复制任务：移除右栏按钮与草稿构建即可；不影响发布流程。
- **不做的事**：不做自动计时/番茄钟、不做计费/成本、不做自定义点数/多人估算、不做逐日工时明细、不做热力图缩放/导出图片、不做周报定时发送/邮件、不做复制运行时状态或自动发布。

---

## 9. 文件清单

| 文件 | 改动 |
| --- | --- |
| `src/task-budget.ts` | 新增：预算解析、毫秒换算、进度与状态纯函数 |
| `src/models.ts` | `WorktreeTask` 增加可选 `workBudgetHours` |
| `src/store.ts` | `TaskMetaPatch` 增加 `workBudgetHours`；`TaskMetaResult` 增加 `budget-invalid`；锁内校验与清除 |
| `src/runtime/types.ts` | `PublishInput` 增加 `workBudgetHours` |
| `src/runtime/projects.ts` | 发布前校验并写入预算 |
| `src/runtime.ts` | `budget-invalid` 错误映射 |
| `src/http.ts` | `publish` / `task/meta` 透传预算 |
| `src/tools.ts` | `worktree_publish` / `worktree_act meta` 预算参数；briefing 字段 |
| `src/client/stage.ts` | 任务信息预算行与编辑输入 |
| `src/client/rail.ts` | 超预算告警输入 |
| `src/client/rail-summary.ts` | `budget` 告警排序、文案与图标 |
| `src/client/project-risk.ts` | `budget` 风险原因与权重 |
| `src/client/report.ts` | 单任务报告预算行 |
| `src/client/project-report.ts` | 项目报告预算列 |
| `src/client/board/use-board-actions.ts` | 元数据 patch 类型扩展 |
| `src/client/estimate-calibration.ts` | 新增：校准纯函数 |
| `src/client/retro-calibration.ts` | 新增 / 实现：校准卡片 |
| `src/client/task-clone.ts` | 新增：复制草稿纯函数 |
| `src/client/inspector.ts` | 新增「复制任务」按钮与可选回调 |
| `src/client/board.ts` | 复制草稿接线（主线程） |
| `src/client/project-activity.ts` | 新增：12 周热力图纯函数 |
| `src/client/retro-activity.ts` | 新增 / 实现：热力图卡片 |
| `src/client/project-weekly.ts` | 新增：周报统计与 Markdown 纯函数 |
| `src/client/retro-weekly.ts` | 新增 / 实现：周报卡片与复制/下载 |
| `src/client/project-detail.ts` | 新增「复盘」页签、三张卡片与预算风险文案 |
| `src/client/styles/workbench.ts` | 复盘网格、热力图、校准表、周报指标样式 |
| `locale/zh.json`、`locale/en.json` | 新增文案（key 集合一致） |
| `test/task-budget.test.ts` | 新增：预算纯函数用例 |
| `test/task-budget-store.test.ts` | 新增：预算 Store 用例 |
| `test/client-estimate-calibration.test.ts` | 新增：校准纯函数用例 |
| `test/client-task-clone.test.ts` | 新增：复制草稿用例 |
| `test/client-project-activity.test.ts` | 新增：热力图纯函数用例 |
| `test/client-project-weekly.test.ts` | 新增：周报纯函数用例 |
| `README.md`、`CHANGELOG.md`、`docs/frontend-design.md`、`docs/i18n-terminology.md` | 主线程更新到 1.16.0 |
| `package.json`、`package-lock.json` | 主线程更新到 1.16.0 |

---

## 10. 验收记录

**验收日期**：2026-11-26 · 版本 `1.16.0`

### 10.1 自动校验

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 类型 | `npm run typecheck` | 通过，无错误 |
| 文案 | `npm run check:locale` | 通过：zh=953 / en=953，引用的 key 全部存在 |
| 测试 | `npm test` | 通过：766 / 766（基线 697，新增 69 项） |
| 构建 | `npm run build` | 通过 |
| 汇总 | `npm run verify` | 通过 |

### 10.2 功能验收

- **工时预算**：`workBudgetHours` 经发布、`task/meta`、模型工具三条入口设置 / 清除一致；非法值（越界、非数字、布尔）被拒绝且不落盘；任务信息、左栏 chip、风险原因、单任务报告与项目报告使用同一 `workBudgetProgress` 口径；未设预算的任务完全保持 1.15.0 行为。
- **估算校准**：同时有估算与工时的任务进入样本；每点耗时按 `totalWorkMs / totalPoints` 计算；样本 0 / 3 / 6 对应低 / 中 / 高置信度；运行中的计时计入；无样本显示空态，不写台账。
- **复制任务**：草稿保留标题（加副本后缀）、描述、验收标准、标签、优先级与估算；截止日期、分支、会话、状态、备注不进入草稿；已有脏草稿时不覆盖并提示；取消发布不产生任务。
- **活动热力图**：84 格按周一对齐，本地日边界分桶；跨月 / 跨年 / DST 不丢天；未来格子隐藏；三类事件计数与悬停提示正确；损坏 / 负值 / 未来时间戳不产生 `NaN`。
- **每周摘要**：窗口为本地午夜开区间（6 天前 00:00 ~ 明天 00:00）；七项统计与 Markdown 表格一致；复制与下载共用同一份文本；文件名 `project-<slug>-weekly-<YYYYMMDD>-<HHmm>.md`；空周期输出「无活动」而不报错。

### 10.3 已知边界

- 预算不是门禁：超预算不阻止合并、清理、归档或删除，也不做自动计时 / 成本核算。
- 校准只反映已手工计时的样本，样本少时置信度低；卡片只给建议，不自动改写估算或预算。
- 热力图与周报按浏览器本地日历日分桶，跨时区共用台账会得到不同日桶；周报工时是窗口内活跃任务的当前累计值，不按天拆分；任务明细最多 30 行，统计项不受截断影响。
- 复制任务是生成发布草稿，不是克隆运行态；副本仍需走完整发布确认。

### 10.4 交付

- 分支：`t3/daily-5-feature-batch`
- PR：[#35](https://github.com/5918vo/dsh-worktree/pull/35)
- 版本：`package.json` / `package-lock.json` 已升至 `1.16.0`
- 不新增依赖，不新增 HTTP 路由。
