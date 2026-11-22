# 每日功能批次 · 2026-11-22 · v1.11.0

> 批次主题：**验收收口与日常效率**
>
> 交付方式：一个 PR（`t3/daily-feature-batch-planning` → `master`），5 个功能同批验收。
>
> 分工：主线程负责方案、任务拆分、验收与 PR；`pi` 负责编码落地。上一批次（1.10.0 验收清单逐项勾选）的文档见 git 历史（`021f8ce`）。

## 0. 批次总览

| # | 功能 | 一句话价值 | 主要落点 |
| --- | --- | --- | --- |
| 1 | 项目级合并门禁 | 验收标准没核对完，可以按项目配置禁止合并 | 模型 / 项目设置 / 合并预检 / 工作台 |
| 2 | 验收报告导出 | 一键生成可复制的 Markdown 验收报告，留痕可追溯 | 客户端纯函数 / 任务概览 / 剪贴板与下载 |
| 3 | 发布模板 | 常用任务的标题、描述、验收标准一键填入 | Store / HTTP / 设置页 / 发布弹窗 |
| 4 | 任务置顶 | 重要任务固定在项目分组顶部 | 模型 / Store / HTTP / 左栏 |
| 5 | 会话快捷指令 | 在工作台直接给任务会话发追问指令 | 客户端纯函数 / 实时会话 / 指令输入 |

设计原则：

- **不改变既有状态机**：任务状态仍由 Git 与会话绑定推导，本批次只增加策略、派生展示和操作入口。
- **写操作走 Store 锁**：模板、置顶、门禁配置都通过 Store 的跨进程读改写，两个 DSH 实例不会互相覆盖。
- **默认不打扰**：合并门禁默认关闭；没有验收标准的任务不受门禁影响；发布模板为空时不显示模板选择。
- **可回滚**：新增字段全部可选，旧任务记录、旧项目记录无需迁移；移除路由与 UI 后旧记录仍可读。

---

## 1. 项目级合并门禁（`mergeGate`）

### 1.1 功能说明

项目设置新增「合并门禁」选项：

- `off`（默认）：保持现状，验收标准只提示、不阻止合并。
- `criteria`：任务存在验收标准且仍有未核对项时，禁止通过工作台合并；全部核对后自动放行。

门禁只作用于「合并」动作，不影响「切到主仓库验收」「返回原分支」「清理」「归档」等其他操作。已合并任务再次合并补丁时不受门禁限制（`task.mergedAt` 已存在）。

### 1.2 为什么做

1.10.0 把验收标准变成了可逐项勾选的清单，但合并确认里只提示「还有 N 项未核对」，仍然可以直接合并。对于希望把验收标准当作准入条件的团队，提示不够；对于不需要门禁的用户，强制拦截又会改变既有行为。做成项目级开关可以同时满足两类用户。

### 1.3 预期效果

- 开启门禁的项目：合并按钮在清单未完成时禁用，按钮 `title` 与 Stage 顶部阻塞列表说明原因；即使绕过 UI 调用接口，后端返回 `412 criteria-incomplete`。
- 关闭门禁的项目：行为与 1.10.0 完全一致。
- 没有验收标准的任务：无论开关如何都不受影响。

### 1.4 收益

- **对用户**：把「验收标准」从提醒升级为可选的准入规则，减少漏验收。
- **对团队**：项目级配置比任务级配置更容易统一，不需要每个任务单独设置。
- **对插件**：补上验收闭环的「门禁」一环，为后续更多策略（如必须通过测试、必须有人复核）留下同一套 blocker 机制。
- **风险可控**：默认关闭；后端只是新增一个 blocker code，不改变合并流程本身。

### 1.5 实现方案

#### 数据模型（`src/models.ts`）

```ts
export interface Project {
  // ...
  /** 合并门禁：off（默认）或 criteria（存在未核对验收标准时禁止合并）。 */
  mergeGate?: 'off' | 'criteria'
}
```

#### 项目更新（`src/runtime/projects.ts`、`src/runtime.ts`、`src/http.ts`）

- `Runtime.updateProject` 的 patch 类型增加 `mergeGate?: 'off' | 'criteria'`。
- 校验：只接受 `'off'` / `'criteria'`，其他值抛 `TaskError('合并门禁取值无效', 400)`。
- `POST projects/update` 透传 `body.mergeGate`。

#### 合并预检（`src/runtime/merge.ts`）

在 `buildMergePreflight` 中、任务基础校验之后增加：

```ts
const project = task.projectId ? ctx.store.getProject(task.projectId) : undefined
if (!task.mergedAt && project?.mergeGate === 'criteria') {
  const standard = normalizeCriteria(task.acceptanceCriteria)
  const marked = new Set(task.checkedCriteria || [])
  const missing = standard.filter((item) => !marked.has(item)).length
  if (missing > 0) {
    push('criteria-incomplete', `还有 ${missing} 项验收标准未核对；请先在概览中逐项核对，或关闭该项目的合并门禁`)
  }
}
```

- `missing === 0`（含没有标准）时不产生 blocker。
- `mergeTask` 会在锁内重跑预检，`criteria-incomplete` 属于 hard blocker，自然返回 `412`；不需要在合并流程里重复判断。
- `worktree_act` 的 `merge` 路径复用同一预检，工具调用同样被拦截。

#### 客户端门禁派生（`src/client/model.ts`）

新增纯函数，供按钮禁用、阻塞列表与合并确认共用：

```ts
export function mergeGateMissing(project: any, task: WorktreeTask, status: TaskStatus): number {
  if (!project || project.mergeGate !== 'criteria') return 0
  if (status === 'merged' || status === 'cleaned') return 0
  return criteriaProgress(criteria(task, status)).missing
}
```

#### 操作门禁（`src/client/action-gate.ts`、`src/client/board.ts`）

- `ActionGateInput` 增加 `mergeGateMissing?: number`。
- 在 merge 分支中，若 `mergeGateMissing > 0`，向 `merge` 追加 `fill(t.mergeGateBlocked, 'n', ...)`。
- `board.ts` 用 `projectOfTask?.project`、选中任务与快照状态计算并传入。

#### 合并确认（`src/client/board/use-board-actions.ts`）

`runMerge` 在发预检请求前先检查门禁；有未核对项时直接 Toast 提示并返回，避免无意义的 Git 预检：

```ts
const gateMissing = mergeGateMissing(projectOfTask?.project, task, snap.status)
if (gateMissing > 0) {
  say(String(t.mergeGateBlocked).replace('{n}', String(gateMissing)), true)
  return
}
```

#### 项目设置（`src/client/project-detail.ts`）

- 新增 `mergeGate` 状态，初值 `project.mergeGate === 'criteria'`。
- 设置页增加一行复选框/开关：「验收标准未全部核对时禁止合并」。
- 保存时提交 `mergeGate: mergeGateOn ? 'criteria' : 'off'`。
- 说明文案：门禁只影响合并，不影响验收；无验收标准的任务不受影响。

#### 文案（`locale/zh.json`、`locale/en.json`）

- `mergeGate`：合并门禁
- `mergeGateHint`：开启后，任务仍有未核对的验收标准时会禁止合并；没有验收标准的任务不受影响。
- `mergeGateCriteria`：验收标准未全部核对时禁止合并
- `mergeGateBlocked`：还有 {n} 项验收标准未核对，项目已开启合并门禁

### 1.6 验收标准

- [x] 项目设置可开启/关闭合并门禁，刷新后保持。
- [x] 开启门禁 + 有未核对标准：合并按钮禁用，Stage 顶部与按钮 `title` 说明原因。
- [x] 全部核对后：按钮恢复可用，合并成功。
- [x] 任务没有验收标准：门禁不阻止合并。
- [x] 直接调用 `task/merge`：返回 `412` 且 `code` 为 `criteria-incomplete`。
- [x] 已合并任务的「再次合并」不受门禁影响。
- [x] 关闭门禁的项目行为与 1.10.0 一致。

---

## 2. 验收报告导出（Markdown）

> **实现说明（合并后）**：本功能已由 PR #21（`6798a66`）先行落地，最终实现见附录 A。入口位于「验收标准」分区标题右侧，文件名为 `acceptance-<id8>-<YYYYMMDD>-<HHmm>.md`，文件状态与 diff 失败原因均本地化；本节 2.1 与 2.5 为原始方案，保留用于对照。

### 2.1 功能说明

任务概览新增「验收报告」区块，提供两个动作：

- **复制 Markdown**：把当前任务的验收信息生成 Markdown 并写入剪贴板。
- **下载 .md**：下载为 `acceptance-<id8>-<YYYYMMDD>-<HHmm>.md`。

报告包含：任务标题与 ID、状态、任务分支与基线、worktree 路径、更新时间、合并信息、验收标准逐项勾选、相对基线的提交、改动文件统计（不含完整 patch）、未提交改动与待处理暂存数量。

### 2.2 为什么做

验收结果目前只存在于看板里：验收标准、提交、改动文件、合并信息分散在概览、代码改动、右栏三个区域。用户要把验收结论发给同事、贴进 PR 或留档时，只能手工拼。报告导出把「当时按什么标准验收、验收了什么、改了什么」一次带走，补上可追溯性。

### 2.3 预期效果

- 任意状态的任务都能生成报告；已合并/已清理任务按「全部核对」语义输出。
- 报告中的文件统计与「代码改动」标签一致；diff 不可用时明确写出原因，不伪造数据。
- 复制失败与下载行为有明确反馈。

### 2.4 收益

- **对用户**：验收结论可直接进入 PR 描述、周报或交付文档，减少手工整理。
- **对团队/评审者**：报告自带标准与勾选结果，能区分「标准是什么」和「核对到哪一步」。
- **对插件**：验收闭环产生可导出的产物，为后续「验收报告归档」「按报告生成发布说明」留下基础。
- **成本低**：只读现有任务记录、快照与 diff，不新增 Git 命令、不改状态。

### 2.5 实现方案

#### 纯函数模块（`src/client/report.ts`）

```ts
export interface ReportInput {
  task: WorktreeTask
  snapshot: TaskSnapshot
  diff?: TaskDiff | null
  t: Record<string, any>
  generatedAt?: number
}

export function buildAcceptanceReport(input: ReportInput): string
export function reportFileName(task: WorktreeTask, now?: number): string
```

报告结构（Markdown）：

```md
# 验收报告：<标题>

- 任务 ID：`<id>`
- 状态：<本地化状态>
- 任务分支：`<branch>` → 基线 ` <baseBranch> `
- Worktree：`<worktreePath>`
- 更新时间：<ISO 时间>
- 合并：<时间 / 合并提交 / 合并分支尖端>（仅已合并任务）
- 验收标准：n/total 已核对

## 验收标准

- [x] 已核对项
- [x] 未核对项

## 提交（相对基线）

- `abc1234` 提交说明

## 改动文件

| 文件 | 状态 | 新增 | 删除 |
| --- | --- | --- | --- |
| `src/a.ts` | modified | 12 | 3 |

合计：+12 -3

## 备注

- worktree 未提交改动：0
- 待处理暂存：0

> 本报告由 Worktree 看板生成；状态来自 Git 与任务记录。
```

规则：

- 验收标准使用 `criteria(task, snapshot.status)`，与概览完全同源；已合并/已清理显示全部勾选。
- 提交使用 `snapshot.worktree.commits`（最近 20 条）；没有时写「无提交记录」。
- 文件表使用 `diff.files`，只输出路径、状态、增删行数；`diff.truncated` 时追加提示。
- `diff` 为空或带 `reason` 时写「改动统计不可用：<reason>」，不生成空表。
- 文件路径中的 `|` 转义为 `\|`。
- 所有文案走 `t`，`locale/zh.json` 与 `locale/en.json` 同时补齐。

#### 下载与复制（`src/client/format.ts`、`src/client/stage.ts`、`src/client/board.ts`）

- `format.ts` 新增 `downloadTextFile(name, text)`：Blob + 临时 `<a download>`，完成后回收 object URL。
- `board.ts` 用 `React.useMemo` 生成 `reportText` 与 `reportFileName`，传给 Stage。
- Stage 概览新增报告区块：两个按钮分别调用 `copyText` 与 `downloadTextFile`；结果通过现有 `say` Toast 反馈。
- 新增 Stage props：`reportText?: string`、`reportFileName?: string`、`onCopyReport?: () => void`、`onDownloadReport?: () => void`。

#### 文案

`acceptanceReport`、`copyReport`、`downloadReport`、`reportCopied`、`reportCopyFailed`、`reportDownloaded`、`reportTitle`、`reportTaskId`、`reportStatus`、`reportBranch`、`reportWorktree`、`reportUpdated`、`reportMerged`、`reportCriteria`、`reportCriteriaProgress`、`reportCommits`、`reportFiles`、`reportFile`、`reportTotals`、`reportNotes`、`reportUncommitted`、`reportPendingStashes`、`reportNoCriteria`、`reportNoCommits`、`reportNoFiles`、`reportDiffUnavailable`、`reportTruncated`、`reportFooter`。

### 2.6 验收标准

- [x] 有验收标准的任务：报告逐项输出 `[x]` / `[ ]`，进度数字正确。
- [x] 已合并 / 已清理任务：报告按全部核对输出。
- [x] 无验收标准：报告写「无验收标准」，不出现空列表。
- [x] 有提交与 diff：报告包含提交列表、文件统计与合计。
- [x] diff 不可用：报告写明原因，不伪造文件表。
- [x] 复制成功 / 失败都有 Toast；下载文件名符合 `acceptance-<id8>-<YYYYMMDD>-<HHmm>.md`。
- [x] 中英文 locale 均包含全部报告文案。

---

## 3. 发布模板（`TaskTemplate`）

### 3.1 功能说明

新增全局「发布模板」：保存常用的标题、描述与验收标准；发布任务时从模板下拉选择，一键填入表单，再按需修改。

- 设置页可新建、编辑、删除模板。
- 发布弹窗顶部显示模板选择；选择后填充标题、描述和验收标准。
- 模板不绑定项目或基线，避免复制到其他项目时把分支带错。

### 3.2 为什么做

很多任务是重复类型：修 bug、补文档、加测试、发版检查。每次发布都要重新写标题、描述和验收标准，既慢又容易漏项。现有验收标准库只能复用「标准」，不能复用「整张发布表单」。

### 3.3 预期效果

- 选择模板后，标题、描述、验收标准一次填好；仍可自由修改。
- 模板中的标准如果在标准库中，显示为可勾选项；不在库中的自动进入手动补充区，不丢内容。
- 删除模板不影响已经发布的任务。

### 3.4 收益

- **对用户**：常规任务从「每次重写」变成「选模板 + 改两处」。
- **对团队**：把任务描述与验收标准沉淀为可复用资产，减少口径差异。
- **对插件**：与验收标准库形成「模板 → 发布 → 验收」的连续能力。
- **风险低**：模板只影响发布弹窗的初始值，不改变发布接口的校验与执行。

### 3.5 实现方案

#### 模型（`src/models.ts`）

```ts
export interface TaskTemplate {
  id: string
  name: string
  title: string
  description: string
  criteria: string[]
  createdAt: number
  updatedAt?: number
}
```

#### Store（`src/store.ts`）

- 新文件 `templates.json`，保存模板数组。
- `load()` / `flush()` / `dispose()` 同步刷新。
- 新方法（均在 `withLock` 内 refresh → 修改 → save）：

```ts
export type TemplateResult =
  | { ok: true; item: TaskTemplate; templates: TaskTemplate[] }
  | { ok: false; reason: 'missing' }

listTemplates(): TaskTemplate[]
saveTemplate(input: { id?: string; name: string; title?: string; description?: string; criteria?: string[] }): TemplateResult
deleteTemplate(id: string): TaskTemplate[]
```

- `name` 为空时由 Runtime 拒绝；Store 只保存已规范化数据。
- `criteria` 使用 `normalizeCriteria`。
- 列表按 `createdAt` 倒序（新建的在前）。
- 更新时保留原 `createdAt`，写入 `updatedAt`。

#### Runtime（`src/runtime.ts`）

```ts
listTaskTemplates(): TaskTemplate[]
saveTaskTemplate(input: { id?: string; name: string; title?: string; description?: string; criteria?: string[] }): TaskTemplate[]
deleteTaskTemplate(id: string): TaskTemplate[]
```

- `name.trim()` 为空 → `TaskError('模板名称不能为空')`。
- 带 `id` 但模板不存在 → `TaskError('模板不存在：<id>', 404)`。
- 其余字段 `String(...)` 兜底，`criteria` 走 `normalizeCriteria`。

#### HTTP（`src/http.ts`）

```text
GET  templates
POST templates/save    { id?, name, title?, description?, criteria? }
POST templates/delete  { id }
```

- `GET` 与 `acceptance-criteria` 一样是本地只读查询，不要求 token。
- 两个 `POST` 要求 token，返回 `{ templates }`。
- `TaskError` 映射原有状态码。

#### 设置页（`src/client/settings-page.ts`）

- 新增「发布模板」Card：
  - 列表：模板名称、标题、编辑与删除按钮。
  - 编辑区：名称、标题、描述、验收标准（每行一条）。
  - 保存 / 取消；保存成功后刷新列表并清空编辑态。
  - 删除后刷新列表；删除前使用现有确认弹窗（或与验收标准库一致的低风险直接删除 + Toast，二选一，优先复用现有 Modal）。
- 复用现有 `Card`、`CardHead`、`TextInput`、`Btn`、`IconBtn` 与 `dshw-criteria-*` 样式，不新增第二套视觉。

#### 发布弹窗（`src/client/publish.ts`、`src/client/publish-state.ts`）

- 新增纯函数：

```ts
export function applyPublishTemplate(
  template: TaskTemplate,
  library: string[],
): { title: string; description: string; picked: string[]; manual: string }
```

  - `picked = template.criteria.filter((item) => library.includes(item))`
  - `manual = template.criteria.filter((item) => !library.includes(item)).join('\n')`
  - `title` / `description` 原样返回。

- 弹窗挂载时并行请求 `acceptance-criteria` 与 `templates`。
- 顶部新增模板选择（无模板时不渲染选择，只显示「可在设置页创建模板」的提示）。
- 选择模板后调用 `applyPublishTemplate`，写入标题、描述、`picked`、`manual`。
- 模板选择不改变项目、基线、自定义分支、模型与「发布后启动」开关。
- 用户修改任一字段后，模板选择仍保留（只表示来源，不反向覆盖）。

#### 文案

`templates`、`template`、`templateHint`、`templateEmpty`、`templateName`、`templateTitle`、`templateDescription`、`templateCriteria`、`templateSave`、`templateSaved`、`templateDelete`、`templateDeleted`、`templateEdit`、`templateNew`、`templateCancel`、`templateDeleteConfirm`、`templateNameRequired`。

### 3.6 验收标准

- [x] 设置页可新建、编辑、删除模板；刷新后保持。
- [x] 模板名称为空时保存被拒绝并提示。
- [x] 发布弹窗选择模板后标题、描述、验收标准被填充。
- [x] 模板标准不在标准库时进入手动补充区，发布后仍作为验收标准保存。
- [x] 切换项目/基线不会被模板改写。
- [x] 两个 Store 实例交替保存模板时结果都保留（锁内读改写）。
- [x] 无 token 调用 `templates/save` 返回 403。

---

## 4. 任务置顶（`pinnedAt`）

### 4.1 功能说明

任务行新增「置顶 / 取消置顶」动作。置顶任务在所属项目分组内始终排在最前，并显示置顶标记。

### 4.2 为什么做

看板按创建时间倒序排列。正在盯的、等待评审的、需要每天跟进的任务，一旦有新任务发布就会被挤下去。用户需要一个不改变任务状态、也不改变 Git 状态的轻量排序手段。

### 4.3 预期效果

- 置顶任务在项目分组顶部，按置顶时间倒序；未置顶任务仍按创建时间倒序。
- 刷新、重启、换端口打开后保持。
- 取消置顶后回到正常排序。

### 4.4 收益

- **对用户**：把注意力固定在当前最重要的任务上，减少滚动和搜索。
- **对插件**：置顶是纯展示元数据，不影响状态推导与生命周期，风险低。
- **对工具链路**：`worktree_act` 支持 pin/unpin，Agent 也能整理看板。

### 4.5 实现方案

#### 模型（`src/models.ts`）

```ts
export interface WorktreeTask {
  // ...
  /** 置顶时间；存在时任务在项目分组内置顶。 */
  pinnedAt?: number
}
```

#### Store（`src/store.ts`）

```ts
export type PinResult =
  | { ok: true; task: WorktreeTask }
  | { ok: false; reason: 'missing' }

setTaskPinned(taskId: string, pinned: boolean): PinResult
```

- `withLock` → `refreshTasks()` → 任务不存在返回 `missing`。
- `pinned` 为真且 `pinnedAt` 为空时写入 `Date.now()`；为假时删除字段。
- 写入 `updatedAt`，`saveTasks()`。

#### Runtime / HTTP / 工具

- `Runtime.setTaskPinned(id, pinned)` 映射 `missing` → `TaskError('任务不存在：<id>', 404)`。
- `POST task/pin` 走现有 `act(...)`，请求体 `{ id, pinned }`，返回最新 `view`。
- `worktree_act` 的 `action` 枚举增加 `pin` / `unpin`，分别调用 `setTaskPinned(id, true/false)`。

#### 排序

- `src/runtime/projects.ts` 的 `projectViews` 排序改为：
  `(pinnedAt 倒序) → (createdAt 倒序)`。
- `src/client/board-data.ts` 的 `upsertPublishedTask` 使用同一规则，避免发布后短暂回到旧顺序。

#### 左栏（`src/client/rail.ts`、`src/client/board.ts`、`src/client/icons.ts`）

- `ICONS` 增加 `pin` 图标。
- 任务行操作区增加置顶按钮：`aria-pressed`、`title` 为「置顶 / 取消置顶」，置顶时使用强调色。
- 置顶任务在标题前显示一个小型置顶标记（可用同一图标 + `aria-hidden`），未置顶不显示。
- `RailProps` 增加 `onPinTask: (taskId: string, pinned: boolean) => void`。
- `board.ts` 传入 `actions.runPin`。

#### 操作（`src/client/board/use-board-actions.ts`）

```ts
async function runPin(taskId: string, pinned: boolean) {
  if (busy) return
  setBusy('pin')
  try {
    await post('task/pin', { id: taskId, pinned })
    say(pinned ? t.taskPinned : t.taskUnpinned)
  } catch (e: any) {
    say(String((e && e.message) || t.failed), true)
  } finally {
    setBusy('')
    void refresh()
  }
}
```

#### 文案

`pinTask`、`unpinTask`、`taskPinned`、`taskUnpinned`、`pinned`。

### 4.6 验收标准

- [x] 置顶后任务移动到项目分组顶部，取消后回到创建时间顺序。
- [x] 刷新页面、重新打开工作台后保持。
- [x] 多个置顶任务按置顶时间倒序。
- [x] `task/pin` 无 token 返回 403，未知任务返回 404。
- [x] `worktree_act` 的 `pin` / `unpin` 可用。
- [x] 置顶不影响任务状态、合并、清理与 diff。

---

## 5. 会话快捷指令（Quick Prompts）

### 5.1 功能说明

任务「实时会话」标签新增指令输入区：

- 四个快捷指令：继续完成、修复验证、总结进度、整理提交。
- 点击快捷指令把文本填入输入框，可编辑后再发送；也可直接输入任意指令。
- 发送走宿主 `session.prompt`（queue 模式），不新建会话、不改变任务绑定。

### 5.2 为什么做

看板目前能看会话时间线，但发现问题时只能「打开原生会话」再输入。用户在验收时最常说的是「继续」「把失败的测试修一下」「总结一下」，这些动作在看板里就能完成，没必要跳转。

### 5.3 预期效果

- 有会话的任务可直接发送指令；会话运行中时指令排队，并明确提示。
- 会话等待审批 / 回答时禁止发送，提示先去原生会话处理。
- 没有绑定会话时显示原有「启动会话」入口，不显示指令区。
- 发送成功有 Toast，输入框清空；失败保留文本并提示。

### 5.4 收益

- **对用户**：在看板内完成「看进度 → 追问 → 继续验收」的闭环，减少页面切换。
- **对插件**：看板从只读仪表盘变成可操作的控制面，提升日活与留存。
- **对团队**：快捷指令把常用跟进话术标准化，减少反复输入。
- **风险低**：复用现有会话 prompt 通道，不新增写 Git 的操作。

### 5.5 实现方案

#### 纯函数模块（`src/client/quick-prompts.ts`）

```ts
export type QuickPromptKey = 'continue' | 'tests' | 'summary' | 'commit'

export interface QuickPrompt {
  key: QuickPromptKey
  /** locale key for the chip label */
  label: string
}

export const QUICK_PROMPTS: QuickPrompt[]

/** Build the instruction text; `{title}` is filled with the task title. */
export function quickPromptText(key: QuickPromptKey, task: { title: string }): string

export type QuickPromptBlock = '' | 'no-session' | 'pending' | 'busy'

export function quickPromptDisabledReason(input: {
  hasSession: boolean
  pendingKind?: string
  busy?: boolean
}): QuickPromptBlock

export function quickPromptReasonKey(reason: QuickPromptBlock): string
```

指令文本：

- `continue`：`请继续完成「{title}」的剩余工作；开始前先检查当前 diff 与验收标准，完成后按阶段提交。`
- `tests`：`请运行项目的验证命令，修复失败项并重新验证；不要修改与失败无关的代码。`
- `summary`：`请总结当前进展：已完成的改动、未完成项、风险与下一步；不要修改代码。`
- `commit`：`请检查工作区改动，按逻辑分组提交，写清楚每个提交的目的；不要合并或推送分支。`

#### 实时会话 UI（`src/client/stage.ts`）

- `StageProps` 增加 `onSendPrompt?: (text: string) => Promise<void>` 与 `promptBusy?: boolean`。
- `Live` 组件在日志下方增加指令区（仅 `props.sessionId` 存在时渲染）：
  - 快捷指令 chips（点击填入输入框）。
  - `<textarea>`，placeholder「给会话发一条指令…」，`Ctrl/Cmd+Enter` 发送。
  - 发送按钮；禁用条件由 `quickPromptDisabledReason` 决定。
  - 状态提示：无会话 / 等待处理 / 处理中 / 会话运行中指令将排队。
- 发送成功后清空输入框；失败保留内容。

#### 看板接线（`src/client/board.ts`、`src/client/board/use-board-actions.ts`）

- `runPrompt(text)`：
  - 未选中任务或没有 `sessionId` → 抛错；
  - `busy` 非空 → 抛错；
  - `setBusy('prompt')` → `sendSessionPrompt(remotes, sessionId, text)` → `say(t.quickPromptSent)`；
  - 失败 Toast 后继续抛出，交给输入区保留文本；
  - `finally` 清 busy。
- Board 传 `onSendPrompt: actions.runPrompt`、`promptBusy: !!busy`（任一全局操作进行中都禁用，与 `runPrompt` 的 busy 拒绝逻辑保持一致）。

#### 样式（`src/client/styles/workbench.ts`）

- 新增 `.dshwd-prompt`、`.dshwd-prompt-chips`、`.dshwd-prompt-chip`、`.dshwd-prompt-box`、`.dshwd-prompt-foot`。
- 复用现有颜色 token 与按钮高度，明暗主题一致；输入区获得焦点时使用现有 `focus-visible` 外环。

#### 文案

`quickPromptTitle`、`quickPromptContinue`、`quickPromptTests`、`quickPromptSummary`、`quickPromptCommit`、`quickPromptPlaceholder`、`quickPromptSend`、`quickPromptSent`、`quickPromptNoSession`、`quickPromptPending`、`quickPromptBusy`、`quickPromptQueued`。

### 5.6 验收标准

- [x] 有会话任务显示指令区；无会话任务不显示。
- [x] 四个快捷指令点击后填入对应文本，可编辑后发送。
- [x] 发送成功：Toast、输入框清空、会话时间线在下一轮轮询出现新指令。
- [x] 发送失败：Toast、输入框保留文本。
- [x] 等待审批 / 回答时发送按钮禁用并说明原因。
- [x] 会话运行中允许发送并提示「指令将排队」。
- [x] `Ctrl/Cmd+Enter` 可发送，纯键盘可完成操作。

---

## 6. 通用实现约定

- **中英文同步**：所有新文案同时加入 `locale/zh.json` 与 `locale/en.json`，`npm run check:locale` 必须通过。
- **测试**：每个功能至少覆盖纯逻辑 + Store + HTTP 中的两层；客户端纯函数测试放在 `test/client-*.test.ts`。
- **版本**：`package.json` 与 `package-lock.json` 升到 `1.11.0`。
- **文档**：
  - `README.md`：功能概览、工作台交互、HTTP API、模型工具各补对应条目。
  - `CHANGELOG.md`：新增 `1.11.0` 条目，按「新增 / 接口 / 测试」分组。
  - `docs/frontend-design.md`：补充合并门禁、验收报告、发布模板、置顶、快捷指令的交互说明。
- **代码风格**：沿用现有模块边界与命名；纯逻辑放独立文件，React 组件只做展示与接线。
- **安全**：所有写接口沿用 `task/*` 的 token 校验与同源检查；不新增任意文件读写入口。
- **并发**：模板、置顶、门禁配置的写操作必须在 Store 的跨进程锁内读改写。
- **向后兼容**：`mergeGate`、`pinnedAt`、`TaskTemplate` 均为新增可选数据；旧记录无需迁移，旧版本读取时忽略新字段。

## 7. 批次验收标准

- [x] 5 个功能按本文档完成，界面文案中英文齐全。
- [x] `npm run verify` 全部通过（typecheck + locale + 测试 + 构建）。
- [x] 新增测试覆盖：合并门禁预检/拒绝、验收报告内容、模板 Store/HTTP、置顶 Store/HTTP/排序、快捷指令纯逻辑。
- [x] `feature.md`、`README.md`、`CHANGELOG.md`、`docs/frontend-design.md` 已更新。
- [x] 不改变既有任务状态机、合并流程与 Git 安全边界。
- [ ] 改动以单个 PR 提交到 `master`，PR 描述包含 5 个功能摘要与验证结果（本提交推送后创建）。

## 8. 风险、边界与回滚

| 风险 | 处理 |
| --- | --- |
| 门禁误伤没有验收标准的任务 | 只在 `acceptanceCriteria` 非空且存在未核对项时拦截 |
| 门禁阻止「再次合并」 | `task.mergedAt` 存在时跳过门禁 |
| 模板标准不在标准库导致丢失 | 自动放入手动补充区，发布时仍保存 |
| 模板选择覆盖用户已填内容 | 只在用户主动选择模板时填充，之后可自由修改 |
| 置顶影响状态 | `pinnedAt` 只参与排序，不参与 `statusOf` 或任何 Git 判断 |
| 快捷指令误发 | 快捷 chip 只填入不直接发送；发送按钮与 Ctrl/Cmd+Enter 才提交 |
| 多进程写冲突 | 模板/置顶/项目配置全部走 Store 锁 |
| 回滚 | 删除新增路由与 UI；保留的 `mergeGate` / `pinnedAt` / 模板文件不影响旧版本读取 |

## 9. 文件清单

| 文件 | 改动 |
| --- | --- |
| `src/models.ts` | `Project.mergeGate`、`WorktreeTask.pinnedAt`、`TaskTemplate` |
| `src/store.ts` | 模板 CRUD、`setTaskPinned`、templates 文件读写 |
| `src/runtime.ts` | 模板方法、`setTaskPinned`、`updateProject` 类型 |
| `src/runtime/projects.ts` | 门禁字段校验、置顶排序 |
| `src/runtime/merge.ts` | `criteria-incomplete` 预检 blocker |
| `src/http.ts` | `templates*`、`task/pin`、`projects/update` 透传 |
| `src/tools.ts` | `worktree_act` 增加 `pin` / `unpin` |
| `src/client/report.ts` | 验收报告 Markdown 与文件名纯函数（PR #21 实现） |
| `src/client/quick-prompts.ts` | 快捷指令纯函数 |
| `src/client/publish-state.ts` | `applyPublishTemplate` |
| `src/client/model.ts` | `mergeGateMissing` |
| `src/client/action-gate.ts` | 门禁 blocker 原因 |
| `src/client/board.ts` | 门禁计算、置顶与指令接线 |
| `src/client/board/use-board-actions.ts` | `runMerge` 门禁检查、报告复制/下载、`runPin`、`runPrompt` |
| `src/client/board-data.ts` | 发布后置顶排序 |
| `src/client/rail.ts` | 置顶按钮与标记 |
| `src/client/stage.ts` | 验收报告按钮、快捷指令输入区 |
| `src/client/publish.ts` | 模板选择与填充 |
| `src/client/settings-page.ts` | 模板管理 |
| `src/client/project-detail.ts` | 合并门禁开关 |
| `src/client/icons.ts` | `pin` 图标 |
| `src/client/styles/workbench.ts` | 置顶、报告、指令区样式 |
| `src/client/styles/legacy.ts` | 设置页发布模板样式 |
| `locale/zh.json`、`locale/en.json` | 新增文案 |
| `test/*.test.ts` | 5 个功能的测试（报告测试采用 PR #21 版本） |
| `README.md`、`CHANGELOG.md`、`docs/frontend-design.md`、`docs/i18n-terminology.md`、`package.json`、`package-lock.json` | 文档与版本 |

## 10. 验收记录（2026-11-22）

### 自动化验证

- `npm run verify`：`tsc --noEmit` + 中英文 locale 校验 + **338 个测试全部通过** + `dist/index.js` / `dist/client.js` 构建成功。
- 新增测试与功能对应：

| 功能 | 测试文件 | 覆盖点 |
| --- | --- | --- |
| 项目合并门禁 | `test/merge-gate.test.ts` | 预检阻断、`merge` 拒绝、无标准放行、关闭门禁、未知值 400、已合并跳过 |
| 验收报告导出 | `test/client-report.test.ts`（PR #21 版本） | 文件名规则、元信息与可选行、标准三态、五种文件状态、截断、三种 diff 失败原因、工作区计数、中英文占位符与 key 一致性、Stage 按钮渲染 |
| 发布模板 | `test/templates.test.ts` | 模板拆分、Store CRUD/锁/多实例、排序稳定、Runtime 校验、HTTP token |
| 任务置顶 | `test/task-pin.test.ts` | 置顶时间戳幂等、取消、排序、发布后排序、HTTP 403/404 |
| 会话快捷指令 | `test/client-quick-prompts.test.ts` | chip 顺序、指令文本、禁用原因、locale key 映射 |

### 人工复核与修复

主线程逐文件复核后端（Store 锁内读改写、门禁预检、HTTP token 校验、模型工具）与客户端（门禁原因、报告生成、模板填充、置顶排序、快捷指令接线）。复核发现并修复 4 处问题：

1. 设置页模板样式误放在 `src/client/styles/workbench.ts`，而设置页使用 legacy 样式表，导致模板管理界面无样式 → 移入 `src/client/styles/legacy.ts`。
2. `promptBusy` 仅在 `busy === 'prompt'` 时为真，其他全局操作进行中按钮仍可点击但 `runPrompt` 会拒绝 → 改为 `!!busy`。
3. 切换模板时仅在字段非空时覆盖，会残留上一个模板的标题/描述 → 改为无条件覆盖。
4. 设置页模板标准 chip 的尺寸类名写成不存在的 `dshw-chip-sm` → 改为 `dshw-chip--sm`。

### 合并 PR #21 的处理

`origin/master` 在本批次开发期间合并了 PR #21（`6798a66`「验收报告复制与下载」），与本批次第 2 节功能重叠。合并处理：

- 采用 PR #21 的 `src/client/report.ts`、`test/client-report.test.ts` 与 Stage 按钮实现（`acceptance-<id8>-<YYYYMMDD>-<HHmm>.md`、本地化文件状态与 diff 失败原因）。
- 移除本批次早期的 `reportText` / `reportFileName` / `downloadTextFile` 接线，避免出现两套报告按钮和两种文件名。
- 其余 4 个功能（合并门禁、发布模板、置顶、快捷指令）保持本批次实现；`use-board-actions.ts` 同时保留 PR #21 的报告动作与本批次的 `runPin` / `runPrompt` / 门禁检查。
- `feature.md` 保留本批次 5 功能正文，附录 A 收录 PR #21 的完整功能说明。

第二次合并 `origin/master`（`f87f063`，含 PR #7–#17 的看板修复与 PR #20）时，`board.ts`、`use-board-actions.ts`、`publish-state.ts`、`publish.ts`、`stage.ts` 按功能取并集：保留上游的 `railEmptyKind`、`branchChoices`、`commitRangeText`、`switchConfirmText`、`cleanupPrimaryLabel` 等，同时保留本批次的门禁、模板、置顶、快捷指令与报告接线。

### 说明

- 本批次未做浏览器端 E2E 点击验收；Toast、剪贴板、下载、`Ctrl/Cmd+Enter`、按钮禁用态等交互项通过代码走查与纯函数测试确认。
- 任务状态机、合并流程与 Git 安全边界未改动；所有新增字段均为可选，旧记录无需迁移。
- PR #22 已创建；合并 `origin/master` 后以 merge commit 更新，描述包含 5 个功能摘要与验证结果。


---

# 附录 A：验收报告复制与下载（PR #21 已合并实现）

> 本附录为 PR #21（`6798a66`）先行合并的功能说明，最终实现以本附录为准。本批次第 2 节保留原始方案与收益分析；入口位置、文件名、报告字段与测试覆盖面均已按附录实现。

# 功能说明：验收报告复制与下载

- 日期：2026-11-22
- 目标版本：1.11.0
- 状态：待验收（随本 PR 提交）
- 涉及模块：客户端报告生成 / 任务概览交互 / 文案 / 测试 / 文档

## 1. 一句话概述

把任务详情里已经可勾选的验收清单、提交记录和改动统计，一键整理成一份 Markdown 验收报告，可复制到剪贴板或下载为 `.md` 文件。

## 2. 背景与问题

1.10.0 让验收标准可以逐项勾选，任务记录里已经同时保存了「标准是什么」和「核对到哪一步」。但这些信息仍然只存在于工作台内部：

- **验收结果带不走**：要把验收结论发到 PR、issue、群聊或交接文档，用户只能手工复制标题、分支、提交和文件列表，过程繁琐且容易漏项。
- **合并前的判断难以复盘**：合并确认弹窗会提示未核对项，但合并完成后没有一个稳定的文本快照，事后无法快速回答「当时按什么标准验收、核对了多少、改了哪些文件」。
- **报告格式取决于个人**：不同用户整理的验收信息结构不一致，评审者需要反复确认信息是否齐全。

验收标准、勾选状态、提交列表和逐文件统计都已经在客户端内存里（任务快照 + 已加载的 diff），只差一个把它们组织成可交付文本的出口。

## 3. 功能说明

### 3.1 报告入口

- 任务详情「概览」标签的「验收标准」分区标题右侧新增两个操作：
  - **复制报告**：把 Markdown 文本写入剪贴板，成功后 Toast 提示；剪贴板权限不可用时回退到隐藏 `textarea` 复制，仍失败则给出错误提示。
  - **下载 .md**：通过 `Blob` + 临时 `<a download>` 下载 Markdown 文件，成功后 Toast 提示。
- 两个操作对所有状态的任务可用（待开始、进行中、待验收、已合并、已清理、异常），方便在任意阶段导出当前记录。
- 任一 Git 操作或验收勾选进行中时按钮禁用，避免与工作区操作并发造成快照不一致。
- 按钮是原生 `button`，有可见焦点环和可读文案，键盘可直接操作。

### 3.2 报告内容

报告使用当前界面语言（中文 / English）生成，结构固定：

```markdown
# 验收报告：<任务标题>

- 项目：<项目名>
- 任务分支：`<branch>`
- 基线分支：`<baseBranch>`
- 状态：<状态文案>
- 任务 HEAD：`<sha>`
- 合并提交：`<sha>`（已合并时有）
- 会话：`<sessionId>`（已绑定时有）
- 生成时间：2026-11-22 20:30

## 任务描述
<description>

## 验收标准
- [x] 已核对的标准
- [ ] 未核对的标准
进度：已核对 1/2

## 提交
- `abc1234` 提交标题

## 改动文件
| 文件 | 变更 | + | - |
| --- | --- | --- | --- |
| `src/a.ts` | 修改 | 10 | 2 |
合计：1 个文件，+10 -2

## 工作区
- 未提交改动：0
- 待恢复暂存：0
```

规则：

- 验收标准最多原样列全，`checkedCriteria` 与当前标准取交集；已合并 / 已清理任务沿用概览页语义，显示为全部完成，避免报告与界面互相矛盾。
- 任务没有验收标准时写「暂无验收标准」，不输出空列表。
- 提交列表使用任务快照中的领先提交；没有提交时写「暂无提交」。提交标题中的换行压成空格，保证一行一个条目。
- 改动文件表只列路径、变更类型和增删行数，**不包含 diff 正文**：报告保持可读、体量可控，也避免把大段代码或敏感内容复制到外部。
- 文件路径中的 `|`、换行按 Markdown 表格规则转义；路径使用反引号包裹。
- diff 被截断时追加说明；worktree 已清理、找不到合并基点或读取失败时，仍生成其余部分，并在「改动文件」处写明不可用原因。
- 报告末尾附工作区状态：未提交改动数量、待恢复暂存数量，便于评审者判断验收时工作区是否干净。

### 3.3 文件命名

```text
acceptance-<id8>-<YYYYMMDD>-<HHmm>.md
```

- `id8` 为任务 UUID 去掉连字符后的前 8 位。
- 时间取浏览器本地时间，补零；文件名只含 ASCII 字母、数字和连字符，兼容 Windows / macOS。
- 同一分钟内重复下载会覆盖同名文件，由浏览器自行处理；报告内容以生成时刻为准。

### 3.4 数据来源与边界

- 完全在客户端生成，不新增 HTTP 路由、不写任务记录、不触发 Git 操作。
- 使用当前已加载的任务快照和 diff；打开任务后 diff 已由现有逻辑预取，点击报告按钮时不需要额外等待。
- 任务 HEAD 复用 `branchHeadSha()`：验收中固定为 `reviewSha`，其余状态取分支尖端，和 Stage 标题显示一致。
- 状态文案复用看板状态映射；运行中的任务显示为「执行中」，其余按生命周期状态显示。

## 4. 为什么现在做

- **承接 1.10.0 的验收闭环**：勾选让标准可执行，报告让执行结果可交付，两步合起来才构成完整的验收记录。
- **成本最低**：所有数据已在客户端，新增的是一个纯函数和两个按钮，不需要新 API、新存储或迁移。
- **收益直接**：复制一次即可粘贴到 PR 描述、issue、群聊或交接文档，省掉人工整理标题、分支、提交和文件列表。
- **风险可控**：不改状态机、不改 Git 操作、不改权限；报告失败不影响任务本身。

## 5. 预期效果

| 维度 | 预期 |
| --- | --- |
| 验收记录 | 合并前后都能一键导出结构化验收信息 |
| 沟通成本 | 评审者不必追问分支、提交和改动范围 |
| 可追溯性 | 报告包含核对进度与工作区状态，能回答「当时怎么验收的」 |
| 操作成本 | 两次点击内完成复制或下载，无弹窗、无新页面 |

定性目标：让验收结果从「界面里的状态」变成「可以带走的交付物」。

## 6. 收益

- **对用户**：验收完成后直接复制报告，粘贴到 PR / issue / 交接文档，不用手抄。
- **对团队 / 评审者**：报告结构统一，包含标准、进度、提交、改动文件和工作区状态，评审信息一次齐全。
- **对插件**：补上验收闭环的「导出」一环；为后续服务端报告接口、报告模板和验收报告归档留下纯函数基础。
- **对维护者**：改动集中在客户端一个新模块、两个按钮和文案，测试以纯函数为主，回滚只需移除入口和模块。

## 7. 实现方案

### 7.1 新增 `src/client/report.ts`

导出：

```ts
export interface ReportInput {
  task: WorktreeTask
  snapshot: TaskSnapshot
  diff: TaskDiff | null
  projectName: string
  statusLabel: string
  t: Record<string, any>
  now?: number
}

export function reportFilename(task: WorktreeTask, now?: number): string
export function buildAcceptanceReport(input: ReportInput): string
```

要求：

- `buildAcceptanceReport` 是纯函数，不访问 DOM、不发请求，便于单测。
- 复用 `src/client/model.ts` 的 `criteria()`、`criteriaProgress()`、`branchHeadSha()`。
- 复用 `src/client/format.ts` 的 `pad2()`；新增内部 `mdCell()` / `mdInline()` 处理表格转义。
- 状态文案由调用方传入，避免在报告模块里重复状态映射。
- diff 不可用原因由 `TaskDiff.reason` 映射到文案 key；未知原因回退到通用失败文案。

### 7.2 `src/client/stage.ts`

- `StageProps` 新增：

```ts
onCopyReport?: () => void
onDownloadReport?: () => void
reportBusy?: boolean
```

- 「验收标准」分区标题改为左右布局：左侧保留「验收标准 · 进度」，右侧渲染两个 ghost mini 按钮（复制报告 / 下载 .md）；回调缺失时不渲染按钮（保持 SSR / 测试兼容）。
- 按钮在 `reportBusy` 时禁用，`title` 使用现有 `t.working`。
- 新增样式类 `.dshwd-block-head` / `.dshwd-block-actions`，只改 `src/client/styles/workbench.ts`，复用现有间距和按钮类。

### 7.3 `src/client/board/use-board-actions.ts`

新增 `runCopyReport` / `runDownloadReport`：

1. `busy` 时直接返回；`setBusy('report')`。
2. 用 `selectedTask`、`diff`、`projectOfTask`、`statusLabel` 调用 `buildAcceptanceReport`。
3. 复制：`copyText(markdown)`；失败抛错。
4. 下载：`Blob` + `URL.createObjectURL` + 临时 `<a>`，`download=reportFilename(...)`；结束后 `revokeObjectURL`。
5. 成功 / 失败用 `say()` 提示；`finally` 清 busy。

`UseBoardActionsArgs` 新增 `diff: TaskDiff | null` 与 `statusLabel: string`。

### 7.4 `src/client/board.ts`

- 把 `data.diff` 和已计算的状态文案传入 `useBoardActions`。
- 给 `Stage` 接线：

```ts
reportBusy: busy === 'report',
onCopyReport: actions.runCopyReport,
onDownloadReport: actions.runDownloadReport,
```

- 状态文案使用 `boardStatusLabel(t, status)`，与 Stage 标题 chip 保持一致。

### 7.5 文案

`locale/zh.json`、`locale/en.json` 同步新增（key 集合必须一致）：

- 入口与结果：`reportCopy`、`reportDownload`、`reportCopied`、`reportDownloaded`、`reportFailed`
- 报告字段：`reportTitle`、`reportProject`、`reportTaskBranch`、`reportBaseBranch`、`reportStatus`、`reportHead`、`reportMergedCommit`、`reportSession`、`reportGeneratedAt`、`reportCommits`、`reportNoCommits`、`reportFiles`、`reportFile`、`reportChange`、`reportTotals`、`reportNoFiles`、`reportProgress`、`reportWorkspace`、`reportUncommitted`、`reportStashes`、`reportTruncated`
- 文件变更类型：`reportStatusAdded`、`reportStatusModified`、`reportStatusDeleted`、`reportStatusRenamed`、`reportStatusUntracked`
- diff 不可用：`reportNoDiff`、`reportDiffWorktreeMissing`、`reportDiffNoMergeBase`、`reportDiffError`

占位符沿用 `{n}`、`{total}` 约定；`reportTotals` 同时包含文件数、增、删三个占位符。

### 7.6 文档与版本

- `README.md`：功能概览与工作台交互各补一条；版本号与最后更新日期改为 1.11.0 / 2026-11-22。
- `docs/frontend-design.md`：概览结构、验收标准组件说明和验收清单补报告入口。
- `docs/i18n-terminology.md`：术语表补「验收报告 / Acceptance report」。
- `CHANGELOG.md`：新增 `1.11.0` 条目。
- `package.json` 与 `package-lock.json`：版本升至 `1.11.0`。

## 8. 验收标准

- [ ] 任务详情「概览」的验收标准分区显示「复制报告」「下载 .md」两个入口，所有任务状态均可用。
- [ ] 点击「复制报告」后剪贴板内容为完整 Markdown；成功 Toast 提示，失败时给出错误提示。
- [ ] 点击「下载 .md」生成 `acceptance-<id8>-<YYYYMMDD>-<HHmm>.md`，内容与复制一致，UTF-8 编码。
- [ ] 报告包含元数据、任务描述、验收标准与核对进度、提交、改动文件表、合计、工作区状态。
- [ ] 已核对 / 未核对标准正确输出为 `[x]` / `[ ]`；已合并 / 已清理任务与概览一致显示全部完成。
- [ ] 无验收标准、无提交、无 diff、diff 截断、worktree 已清理时，报告仍可生成并给出对应说明。
- [ ] 文件路径中的 `|` 和换行被正确转义，表格不会错列。
- [ ] 报告不包含 diff 正文；文件数遵循现有 diff 上限。
- [ ] 任一操作进行中时报告按钮禁用；按钮可键盘操作、有可见焦点环。
- [ ] 中英文文案 key 完全一致，`npm run check:locale` 通过。
- [ ] `npm run verify`（typecheck + locale 检查 + 测试 + 构建）通过。
- [ ] `feature.md`、`README.md`、`docs/frontend-design.md`、`docs/i18n-terminology.md`、`CHANGELOG.md` 已更新，版本为 1.11.0。

## 9. 测试与验证计划

- **纯函数单测** `test/client-report.test.ts`：
  - 标准与勾选状态：部分核对、全部核对、无标准。
  - 已合并 / 已清理：全部显示完成。
  - 元数据：项目、分支、基线、状态、HEAD、合并提交、会话、生成时间。
  - 提交：多条、空列表；标题换行与 Markdown 特殊字符。
  - 改动文件：新增 / 修改 / 删除 / 重命名 / 未跟踪、路径含 `|`、空列表、截断标记。
  - diff 不可用：worktree-missing / no-merge-base / error 三种 reason。
  - 工作区：未提交改动、待恢复暂存。
  - 文件名：id8 提取、补零、只含安全字符、同一分钟稳定。
- **回归**：`npm run verify` 全量通过；现有 281 项基础上新增用例。
- **人工**：在 DSH Web 中打开不同状态任务，复制与下载报告，检查中英文、明暗主题、窄屏和键盘操作。

## 10. 风险、边界与回滚

- **剪贴板权限**：浏览器拒绝时回退到 `execCommand('copy')`；仍失败则只提示，不改变任务状态。
- **下载被拦截**：`Blob` 下载失败时 Toast 报错；不依赖宿主额外能力。
- **内容体量**：报告不包含 diff 正文，文件列表沿用 diff 的 300 个文件上限，提交列表来自快照；不会生成超大文本。
- **敏感信息**：报告由用户显式触发，只在本地生成；复制或下载后是否外发由用户决定。
- **语义一致性**：已合并 / 已清理任务沿用概览的「全部完成」语义；原始勾选数据仍保留在任务记录中。
- **回滚**：移除两个按钮和 `report.ts` 即可；不涉及存储字段、路由或 Git 状态。

## 11. 后续计划（不在本次范围）

- 服务端报告接口与模型工具 `worktree_report`，供自动化流程直接获取报告。
- 报告可选包含逐文件 diff 摘要或完整 patch。
- 项目级报告模板：自定义章节顺序与固定说明。
- 将报告归档到任务记录，支持历史版本对比。
- 导出 HTML / PDF 版本。

## 12. 文件清单

| 文件 | 改动 |
| --- | --- |
| `src/client/report.ts` | 新增报告生成、文件名与 Markdown 转义纯函数 |
| `src/client/stage.ts` | 概览验收分区标题与报告入口 |
| `src/client/board/use-board-actions.ts` | 复制 / 下载动作与 busy 处理 |
| `src/client/board.ts` | 传入 diff、状态文案并接线 |
| `src/client/styles/workbench.ts` | 分区标题左右布局样式 |
| `locale/zh.json`、`locale/en.json` | 新增报告与文件状态文案 |
| `test/client-report.test.ts` | 新增纯函数用例 |
| `README.md`、`docs/frontend-design.md`、`docs/i18n-terminology.md`、`CHANGELOG.md`、`package.json`、`package-lock.json` | 文档与版本 |
