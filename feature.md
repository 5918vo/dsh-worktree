# 每日功能批次 · 2026-11-22 · v1.13.0

> 批次主题：**任务编排与验收审计**（把任务从「一条记录」变成可组织、可交接、可批量验收的交付单元）
>
> 交付方式：一个 PR（`t3/daily-five-features-pr-workflow` → `master`），5 个功能同批验收。
>
> 分工：主线程负责方案、任务拆分、验收与 PR；`pi` 负责编码落地。上一批次（1.12.0 仓库外 worktree）的文档见 git 历史。
>
> 状态：已实施 / 已验收（验收记录见第 10 节）。

## 0. 批次总览

| # | 功能 | 一句话价值 | 主要落点 |
| --- | --- | --- | --- |
| 1 | 任务标签 | 用标签给任务做跨项目分组，并按标签筛选、搜索 | 模型 / Store / HTTP / 发布弹窗 / 左栏 / 概览 |
| 2 | 任务优先级 | 高优先级任务排在前面，发布和详情都能设置 | 模型 / Store / 排序 / 发布弹窗 / 左栏 / 概览 |
| 3 | 任务备注 | 给任务留验收备注和交接说明，并写进验收报告 | 模型 / Store / HTTP / 概览 / 验收报告 |
| 4 | 项目验收报告 | 项目维度一键复制 / 下载批量验收 Markdown | 纯函数 / 项目详情 / 文案 |
| 5 | 停滞任务检测 | 自动识别长期没动静的任务，并加入「停滞」筛选 | 纯函数 / 注意力分类 / 左栏 / 汇总条 |

设计原则：

- **全部字段可选，旧台账零迁移**：`tags`、`priority`、`notes` 都是可选字段；没有这些字段的旧任务按「无标签 / 普通优先级 / 无备注」处理。
- **元数据统一走一个原子入口**：标签、优先级、备注共用 `Store.updateTaskMeta` 与 `POST task/meta`，在跨进程账本锁内读改写，两个 DSH 实例不会互相覆盖。
- **不改变任务状态机**：新功能只增加展示字段、派生视图和操作入口，不改变 `statusOf` 的任何分支，也不改变 Git / 会话行为。
- **默认不打扰**：没有标签时不显示标签筛选；优先级为普通时不显示 chip；没有备注时不显示备注区；停滞阈值内不产生任何提示。
- **文档即验收**：每个功能都必须有功能说明、动机、预期效果、收益、实现方案、验收标准和测试要点。

---

## 1. 任务标签（`tags`）

### 1.1 功能说明

任务新增最多 8 个标签，每个标签最多 24 个字符。标签可用在三个地方：

1. **发布任务**：高级选项增加「标签」输入框，逗号分隔；发布后写入任务记录。
2. **任务详情**：概览新增「任务信息」分区，显示标签 chips，并提供「编辑标签」入口；可增删后保存。
3. **左栏**：搜索框下方出现标签筛选下拉（只在存在标签时显示），选中后只显示包含该标签的任务；任务行显示最多 2 个标签 chip（超出显示 `+N`），搜索框也会命中标签文本。

标签会进入单任务验收报告和项目验收报告，便于交接。

### 1.2 为什么做

任务看板已经能按项目分组、按状态/注意力筛选，但用户经常需要跨项目组织任务，例如「今天这批」「需要产品确认」「等待上游」。用项目或状态都无法表达这类横向分组；如果写进标题或描述，又无法结构化筛选。标签是成本最低、最符合直觉的横向组织方式，也为后续按批次统计、保存视图留下数据基础。

### 1.3 预期效果

- 发布时填写 `前端, 紧急`，任务记录保存为 `["前端", "紧急"]`；重复标签、空标签、前后空格、开头的 `#` 会被规范化。
- 左栏标签下拉只列出当前任务集中真实存在的标签；选中「前端」后，只显示带该标签的任务，其他项目分组若一条都不匹配则隐藏。
- 任务行显示标签 chip；标签很多时显示前 2 个和 `+N`，`title` 展示完整列表。
- 详情页可以编辑标签；保存后左栏、详情、筛选选项立即刷新，刷新页面后仍保留。
- 搜索 `紧急` 能命中标签为「紧急」的任务。
- 超过 8 个标签或单个标签超过 24 个字符时，发布会返回 `400`；详情编辑时内联报错，不写入记录。

### 1.4 收益

- **对用户**：跨项目按主题组织任务，不再靠标题关键字猜。
- **对团队**：标签是可交接的上下文，验收报告会带上标签，评审者能看出任务属于哪一批。
- **对插件**：补上「任务组织」维度，后续可以在标签上做批量操作、保存筛选视图和批次统计。
- **风险可控**：纯展示字段，不参与状态推导；不填标签时行为与 1.12.0 完全一致。

### 1.5 实现方案

#### 1.5.1 共享规范化 `src/task-meta.ts`（新增）

```ts
export const TAG_LIMIT = 8
export const TAG_MAX_LENGTH = 24
export const NOTES_MAX_LENGTH = 2000

export type TaskPriority = 'low' | 'normal' | 'high'

/** 逗号/中文逗号分隔 -> 规范化标签；去空、去 # 前缀、折叠空白、大小写不敏感去重。 */
export function parseTagText(text: string): string[]

/** 数组 / 字符串 / 其他 -> 规范化标签；非数组非字符串返回 []。 */
export function normalizeTags(values: unknown): string[]

/** 校验规范化后的标签；空数组合法。 */
export function validateTags(tags: string[]): { ok: true } | { ok: false; error: 'too-many' | 'too-long' }

/** 优先级规范化：'low' | 'normal' | 'high'；''/null/undefined 归一为 'normal'。 */
export function normalizePriority(value: unknown): TaskPriority | undefined

/** 优先级排序权重：high=2, normal=1, low=0。 */
export function priorityRank(task: { priority?: string }): number

/** 统一排序：置顶优先 -> 优先级高到低 -> 创建时间新到旧。 */
export function compareTaskOrder(a: any, b: any): number
```

要求：

- `parseTagText` 同时接受英文逗号 `,` 和中文逗号 `，`；每项 `trim()`、去掉开头的 `#`、把连续空白折叠成一个空格；空项丢弃。
- 去重使用 `toLowerCase()` 作为 key，但保留第一次出现的原始大小写。
- `normalizeTags` 对数组逐项调用 `parseTagText` 后合并去重；不抛异常。
- `compareTaskOrder` 的优先级顺序必须是 **置顶 > 高 > 普通 > 低 > 创建时间倒序**；没有 `pinnedAt` 视为 0。
- 该模块在宿主端与客户端共用，不依赖 DOM / Node API。

#### 1.5.2 数据模型（`src/models.ts`）

```ts
export interface WorktreeTask {
  // ...
  /** 自由标签；规范化后最多 8 个，单个最多 24 字符。 */
  tags?: string[]
  // ...
}
```

#### 1.5.3 Store（`src/store.ts`）

新增原子方法，与 `setCriterionChecked` / `setTaskPinned` 相同的锁内读改写模式：

```ts
export type TaskMetaPatch = {
  tags?: unknown
  priority?: unknown
  notes?: unknown
}

export type TaskMetaResult =
  | { ok: true; task: WorktreeTask }
  | { ok: false; reason: 'missing' | 'tags-too-many' | 'tags-too-long' | 'priority-invalid' | 'notes-too-long' }

updateTaskMeta(taskId: string, patch: TaskMetaPatch): TaskMetaResult
```

规则：

- `withLock` 内先 `refreshTasks()` 再取任务；任务不存在返回 `missing`。
- **只处理 patch 中真实存在的键**（用 `Object.prototype.hasOwnProperty` 判断），未传的字段保持不变。
- `tags`：`normalizeTags(patch.tags)`；校验失败返回对应 reason；空数组时 `delete task.tags`，否则赋值。
- `priority`：`normalizePriority(patch.priority)`；无法识别返回 `priority-invalid`；`'normal'` 时 `delete task.priority`，否则赋值。
- `notes`：`String(patch.notes ?? '').trim()`；超过 `NOTES_MAX_LENGTH` 返回 `notes-too-long`；空字符串时 `delete task.notes`。
- 至少有一个有效字段被处理时才更新 `updatedAt` 并 `saveTasks()`；无字段的调用直接返回当前任务，不刷新时间。
- 返回值是锁内最新任务对象。

#### 1.5.4 Runtime（`src/runtime.ts`）

```ts
updateTaskMeta(id: string, patch: { tags?: unknown; priority?: unknown; notes?: unknown }): WorktreeTask
```

- `missing` → `TaskError('任务不存在：' + id, 404)`。
- `tags-too-many` → `TaskError('标签最多 8 个', 400)`。
- `tags-too-long` → `TaskError('单个标签最多 24 个字符', 400)`。
- `priority-invalid` → `TaskError('优先级只能是 low、normal 或 high', 400)`。
- `notes-too-long` → `TaskError('备注最多 2000 个字符', 400)`。

#### 1.5.5 HTTP（`src/http.ts`）

- 通过现有 `act()` 注册 `task/meta`：

```ts
act('meta', async (id, body) => app.runtime.updateTaskMeta(id, {
  tags: body.tags,
  priority: body.priority,
  notes: body.notes,
}))
```

- 请求体 `{ id, tags?, priority?, notes? }`；`tags` 为字符串数组，`notes` 为字符串，`priority` 为 `'low' | 'normal' | 'high'`（空字符串或 `'normal'` 表示清除）。
- 继续沿用 `act` 的 token 校验和 `{ ok: true, view }` 响应。
- `POST publish` 接受可选的 `tags`、`priority`；校验失败返回 400，且必须在创建 worktree 之前完成校验（不能留下半成品）。

#### 1.5.6 发布（`src/runtime/types.ts`、`src/runtime/projects.ts`）

`PublishInput` 增加：

```ts
tags?: string[]
priority?: TaskPriority
```

`publishTask` 在标题/描述校验之后、`ensureProject` / Git 操作之前：

```ts
const tags = normalizeTags(input.tags || [])
const tagCheck = validateTags(tags)
if (!tagCheck.ok) throw new TaskError(tagCheck.error === 'too-many' ? '标签最多 8 个' : '单个标签最多 24 个字符')
const priority = normalizePriority(input.priority)
if (input.priority !== undefined && priority === undefined) throw new TaskError('优先级只能是 low、normal 或 high')
```

创建任务记录时只在有值时写入 `tags`、`priority`（`priority === 'normal'` 不写字段）。

#### 1.5.7 发布弹窗（`src/client/publish.ts`、`src/client/publish-state.ts`）

- `PublishDraft` 增加 `tags: string`、`priority: '' | 'low' | 'normal' | 'high'`。
- `initialPublishForm` 读取并规范化 draft；`publishDraftDirty` 比较这两个字段；`currentForm()` 与持久化 effect 都包含它们。
- 高级选项在「模型」之后增加：
  - 标签输入框：使用 `t.taskTags` / `t.taskTagsPlaceholder` / `t.taskTagsHint`，逗号分隔。
  - 优先级下拉：`t.taskPriority`，选项 `t.priorityLow` / `t.priorityNormal` / `t.priorityHigh`，默认「普通」。
- 提交前用 `parseTagText` + `validateTags` 校验；错误写入 `fieldErrors.tags` 并内联展示，不发送请求。
- 请求体只在有标签时带 `tags`，只在非普通优先级时带 `priority`。

#### 1.5.8 任务详情（`src/client/stage.ts`、`src/client/board.ts`、`src/client/board/use-board-actions.ts`）

- `StageProps` 增加：

```ts
onSaveMeta?: (patch: { tags?: string[]; priority?: string; notes?: string }) => Promise<void>
metaBusy?: boolean
```

- Overview 在「任务描述」与「验收标准」之间新增「任务信息」分区：
  - 标签：chips；`onSaveMeta` 存在时显示「编辑标签」按钮。编辑态为输入框 + 保存 / 取消；保存前用共享校验，内联报错；成功后退出编辑态。
  - 优先级：下拉选择（低 / 普通 / 高），变更时立即调用 `onSaveMeta({ priority })`；失败时保留旧值并等待下一次刷新。
  - 备注：该功能的编辑区在第 3 节描述，和标签放在同一分区。
  - 无回调时（SSR / 测试）只读渲染，不显示编辑入口。
- Board 新增 `runSaveMeta`：

```ts
async function runSaveMeta(patch) {
  if (!selectedTask || busy) throw new Error(t.failed)
  setBusy('meta')
  try {
    await post('task/meta', { id: selectedTask.task.id, ...patch })
    await refresh()
  } catch (e) {
    say(String((e && e.message) || t.failed), true)
    throw e
  } finally {
    setBusy('')
  }
}
```

- 把 `onSaveMeta` / `metaBusy: !!busy` 传给 Stage。

#### 1.5.9 左栏标签筛选（`src/client/model.ts`、`src/client/rail.ts`、`src/client/board.ts`）

- `model.ts` 新增纯函数：

```ts
export function collectTags(views: ProjectView[]): string[]
```

按出现顺序去重（大小写不敏感），返回按 `localeCompare` 排序的标签；空标签忽略。

- `filterProjectViews` 增加可选最后一个参数 `tag?: string`：`tag` 为空或未传时行为不变；非空时任务必须 `task.tags` 包含该标签；搜索字段增加 `tags.join(' ')` 与 `notes`。
- Board：
  - `const [tagFilter, setTagFilter] = React.useState('')`。
  - `const tagOptions = React.useMemo(() => collectTags(allViews), [allViews])`。
  - 用 effect 在 `tagFilter` 不再存在于 `tagOptions` 时重置为空。
  - 调用 `filterProjectViews(..., tagFilter)`，`tagFilter` 进入依赖。
  - 给 `Rail` 传 `tags: tagOptions`、`tagFilter`、`onTagFilter: setTagFilter`。
- Rail 在搜索框下渲染标签筛选（仅 `tags.length > 0`）：

```tsx
<select className="dshwd-tag-filter" value={tagFilter} aria-label={t.taskTagFilter} onChange=...>
  <option value="">{t.taskTagAll}</option>
  {tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
</select>
```

- 任务行新增 chips：
  - 高优先级：`chip(t.priorityHigh, 'warn')`；低优先级：`chip(t.priorityLow, '')`；普通不显示。
  - 标签：最多 2 个 `#标签`，其余合并为 `+N`，`title` 为完整标签列表。
- 样式只改 `src/client/styles/workbench.ts`：`.dshwd-tag-filter` 复用搜索框尺寸和边框；标签 chip 复用 `.dshwd-chip`。

#### 1.5.10 模型工具（`src/tools.ts`）

- `worktree_publish` 参数增加：
  - `tags`: `{ type: 'array', items: { type: 'string' }, description: '可选任务标签，最多 8 个。' }`
  - `priority`: `{ type: 'string', enum: ['low', 'normal', 'high'], description: '可选任务优先级。' }`
- 透传到 `app.runtime.publish`。
- `worktree_tasks` 的 `brief()` 输出增加 `tags` 与 `priority`（没有时分别为 `[]` 与 `'normal'`）。

#### 1.5.11 验收报告

- 单任务验收报告元数据增加「标签」一行；没有标签显示 `—`。
- 项目验收报告任务表增加「标签」列；任务详情块也列出标签。

### 1.6 验收标准

- [ ] 发布时填写标签后，任务记录包含规范化后的 `tags`，刷新后仍在。
- [ ] 重复标签、空标签、`#` 前缀、中英文逗号混用都会被正确规范化。
- [ ] 第 9 个标签或超过 24 字符的标签被拒绝（发布 400 / 详情内联报错）。
- [ ] 左栏只在存在标签时显示标签筛选；选择后只显示匹配任务，清空后恢复。
- [ ] 标签筛选无匹配时显示专用空态和「全部标签」清除入口，不出现空白列表。
- [ ] 任务行显示最多 2 个标签 chip 和 `+N`；`title` 能看到完整标签。
- [ ] 搜索能命中标签文本和备注文本。
- [ ] 详情页可以编辑标签并保存，保存后左栏筛选选项与报告内容同步更新。
- [ ] 单任务报告和项目报告都包含标签。
- [ ] 没有标签的旧任务行为不变。

### 1.7 测试要点

- `test/task-meta.test.ts`：`parseTagText` 中英文逗号 / 空白 / `#` / 大小写去重 / 空输入；`normalizeTags` 数组与非法输入；`validateTags` 边界（8 个通过、9 个失败、24 字符通过、25 字符失败）。
- `test/store.test.ts`：`updateTaskMeta` 只改传入字段、清空 tags / priority / notes、任务不存在、落盘重载、双实例可见。
- `test/http-flow.test.ts`：`task/meta` 成功、无 token、未知任务、非法优先级、超长备注；`publish` 带 tags/priority 与非法值 400。
- `test/client-model.test.ts`：`collectTags` 去重排序；`filterProjectViews` 标签过滤与搜索命中 tags/notes；`railEmptyKind` 标签空态优先级；`compareTaskOrder` 排序。
- `test/client-publish-state.test.ts`：draft 保存/恢复 tags/priority；dirty 判定。
- `test/client-report.test.ts`：报告包含标签与备注。

---

## 2. 任务优先级（`priority`）

### 2.1 功能说明

任务新增可选优先级：`low` / `normal` / `high`，默认 `normal`（记录中不写字段）。优先级用于任务排序和视觉提示：

- **排序**：置顶任务仍最前；同置顶状态下，`high` → `normal` → `low`；同优先级按创建时间倒序。
- **展示**：左栏任务行显示「高优先级」chip（warning 色）；低优先级显示弱化 chip；普通不显示。
- **设置**：发布弹窗高级选项可设；任务详情「任务信息」分区可改；模型工具发布时可传。

优先级与置顶是两件事：置顶是「我必须先看到」，优先级是「这件事本身更重要」。两者同时存在时置顶优先。

### 2.2 为什么做

当前左栏排序只有置顶和创建时间。任务一多，最近创建的低价值任务会压住真正重要的任务；只靠置顶又会让所有重要任务都变成「置顶」，失去区分度。优先级提供一个比置顶轻、比创建时间有意义的排序维度，并且可以在发布时就表达，不需要事后手工调整。

### 2.3 预期效果

- 新发布任务默认普通优先级，排序与 1.12.0 完全一致。
- 设为高优先级的任务排在普通任务之前；多个高优先级任务之间仍按创建时间倒序。
- 置顶任务仍然排在高优先级任务之前。
- 左栏和详情都能看到/修改优先级；修改后无需刷新页面即可重排（`refresh()` 后）。
- 非法优先级（例如 `urgent`）返回 400，不写入记录。

### 2.4 收益

- **对用户**：重要任务不再被新任务淹没；发布时一次表达，减少事后整理。
- **对团队**：优先级是验收顺序的显式信号，项目报告会带上优先级。
- **对插件**：排序规则集中到共享 `compareTaskOrder`，服务端与客户端不会各排各的。
- **风险可控**：无优先级时等同于普通，不改状态机。

### 2.5 实现方案

- 模型：`WorktreeTask.priority?: TaskPriority`。
- 共享：`src/task-meta.ts` 的 `normalizePriority` / `priorityRank` / `compareTaskOrder`。
- 排序：
  - `src/runtime/projects.ts` 的 `projectViews` 中 `b.tasks.sort(compareTaskOrder)`。
  - `src/client/board-data.ts` 的 `upsertPublishedTask` 使用同一个 `compareTaskOrder`。
- Store / Runtime / HTTP：复用第 1 节的 `updateTaskMeta` 与 `task/meta`。
- 发布：`PublishInput.priority`，校验与写入规则同第 1 节。
- 客户端：
  - `publish-state.ts` 的 `PublishDraft.priority`。
  - Stage「任务信息」分区的优先级下拉。
  - Rail 任务行高/低优先级 chip。
- 报告：单任务报告元数据增加「优先级」；项目报告任务表增加「优先级」列。
- 工具：`worktree_publish.priority`、`worktree_act` 的 `meta` 动作（见第 3 节）。

### 2.6 验收标准

- [ ] 发布时选择高优先级，任务记录写入 `priority: 'high'`；选择普通不写字段。
- [ ] 左栏排序为置顶优先，然后高 > 普通 > 低，再按创建时间倒序。
- [ ] 服务端 `projectViews` 与客户端发布后增量插入使用同一顺序。
- [ ] 左栏任务行显示高优先级 / 低优先级 chip，普通不显示。
- [ ] 详情页可修改优先级，保存后列表顺序更新。
- [ ] 非法值返回 400，任务记录不变。
- [ ] 报告包含优先级。
- [ ] 旧任务（无 `priority`）按普通处理，排序与旧版本一致。

### 2.7 测试要点

- `test/task-meta.test.ts`：`normalizePriority` / `priorityRank` / `compareTaskOrder`（置顶、优先级、时间）。
- `test/store.test.ts`：设置 / 清除 / 非法优先级。
- `test/runtime-git.test.ts` 或 `test/http-flow.test.ts`：发布带优先级、视图排序。
- `test/client-board-data.test.ts`：增量插入后的顺序。
- `test/client-publish-state.test.ts`：草稿优先级。

---

## 3. 任务备注（`notes`）

### 3.1 功能说明

任务新增一段可选备注（最多 2000 字符），用于记录验收时的判断、交接说明、阻塞原因或后续动作：

- **详情页**：「任务信息」分区提供多行备注编辑框，保存后持久化；显示字符计数。
- **搜索**：任务搜索会命中备注文本。
- **验收报告**：单任务报告新增「备注」章节；项目报告在每个任务块中输出备注。
- **模型工具**：`worktree_act` 新增 `meta` 动作，可设置备注。

备注是纯文本，不解析 Markdown 结构；报告里按原文保留换行。

### 3.2 为什么做

验收信息通常散落在对话、提交信息和口头说明里。任务一旦合并或清理，事后很难回答「当时为什么这样验收」「还有什么遗留风险」。备注字段让用户把这类上下文留在任务记录上，并且跟着验收报告一起导出。相比新增评论系统，单段备注实现小、可回滚，已经能覆盖大部分交接场景。

### 3.3 预期效果

- 在详情页输入备注并保存，刷新、重启 DSH、换端口打开都不丢失。
- 超过 2000 字符时保存失败并提示，不截断用户内容。
- 清空备注并保存后，记录中移除该字段，报告显示「无备注」。
- 搜索备注中的关键字能命中任务。
- 报告包含备注原文；没有备注时给出明确的「无」而不是空白。

### 3.4 收益

- **对用户**：验收判断和遗留风险有地方可写，不必翻会话。
- **对团队**：备注随报告导出，评审者能看到上下文。
- **对插件**：为后续评论 / 活动流留下最小可用的文本字段。
- **风险可控**：单字段、长度受限、不参与状态推导。

### 3.5 实现方案

- 模型：`WorktreeTask.notes?: string`。
- 共享：`NOTES_MAX_LENGTH = 2000`。
- Store：`updateTaskMeta` 处理 `notes`，trim 后为空则删除字段。
- Runtime / HTTP：同第 1 节；`task/meta` 接受 `notes`。
- 详情页：Overview「任务信息」分区内渲染备注卡片：
  - 只读态显示备注（保留换行）；无备注显示 `t.taskNoNotes`。
  - `onSaveMeta` 存在时显示 textarea + 保存按钮；`maxLength={NOTES_MAX_LENGTH}`；字符计数 `n/2000`。
  - 保存中禁用；成功后退出编辑态并刷新；失败保留输入并显示错误。
  - 切换任务时按 task id 重置草稿。
- 搜索：`filterProjectViews` 的搜索字段增加 `task.notes`。
- 报告：
  - 单任务报告新增 `## 备注` 章节（无备注写「无备注」）。
  - 项目报告任务块输出备注；表格不展开长备注。
- 工具：`worktree_act` 增加 `action: 'meta'`，参数 `tags?`、`priority?`、`notes?`；动作描述说明是更新任务元数据，不改变状态。

### 3.6 验收标准

- [ ] 详情页可编辑并保存备注，刷新后仍在。
- [ ] 2000 字符边界：2000 通过，2001 拒绝。
- [ ] 清空备注后字段被移除，报告显示无备注。
- [ ] 搜索命中备注。
- [ ] 单任务报告有备注章节；项目报告任务块包含备注。
- [ ] `worktree_act { action: 'meta', notes }` 生效。
- [ ] 无备注旧任务行为不变。

### 3.7 测试要点

- `test/store.test.ts`：备注保存 / 清空 / 超长 / 只改备注不影响 tags/priority。
- `test/http-flow.test.ts`：`task/meta` 备注、超长 400。
- `test/client-report.test.ts`：备注章节 / 无备注。
- `test/client-project-report.test.ts`（新增）：任务块备注。
- `test/tools-act.test.ts`：`meta` 动作。

---

## 4. 项目验收报告

### 4.1 功能说明

项目详情页新增「项目验收报告」卡片，提供「复制报告」「下载 .md」两个入口，把当前项目的任务汇总成一份 Markdown：

- **项目元数据**：项目名、仓库路径、基线分支、合并门禁、生成时间。
- **统计**：任务总数、各状态数量（使用当前界面语言的状态文案）。
- **任务表**：序号、状态、任务标题、任务分支、验收进度、优先级、标签、最近活动。
- **逐任务块**：状态、分支 / 基线、合并提交、验收标准逐项 `[x]` / `[ ]`、备注。
- **空项目**：仍生成报告，明确写「暂无任务」。
- 文件名：`project-<slug>-<YYYYMMDD>-<HHmm>.md`；`slug` 取项目名中的 ASCII 字母数字，转小写并用 `-` 连接，最多 32 字符；为空时退回项目 id 前 8 位或 `project`。
- 报告只在本地生成，不请求服务端，不包含 diff 正文。

### 4.2 为什么做

单任务验收报告解决「一个任务怎么验收」，但每个批次通常有多条任务，评审者需要逐个点开、逐个复制。项目验收报告把一组任务的验收进度、分支、合并提交和备注汇总到一份文档，适合直接贴到 PR 描述、批次验收记录或交接文档。它复用现有快照数据与报告纯函数，成本低、收益直接。

### 4.3 预期效果

- 在项目详情点击「复制报告」，剪贴板得到完整 Markdown；成功 / 失败都有提示。
- 点击「下载 .md」得到文件名稳定的 Markdown 文件，内容与复制一致。
- 报告中的任务顺序与左栏一致（置顶 > 优先级 > 创建时间）。
- 已归档任务是否出现取决于当前项目详情看到的数据；如果出现，状态旁标注「已归档」。
- 中英文界面生成各自语言的报告；所有章节在数据缺失时都有降级文案。

### 4.4 收益

- **对用户**：一次操作导出整批任务的验收信息，不再逐个复制。
- **对团队**：批次验收记录结构统一，评审者能快速看到哪些任务已完成、哪些还差验收项。
- **对插件**：与单任务报告共享 Markdown 工具和验收语义，形成「任务 / 项目」两级报告。
- **风险可控**：纯客户端、只读、无新增存储字段；下载/复制失败只提示，不改变任务状态。

### 4.5 实现方案

#### 4.5.1 抽出 Markdown 工具 `src/client/markdown.ts`（新增）

从 `src/client/report.ts` 抽出以下纯函数，行为保持不变，并让 `report.ts` 改为从新模块导入：

```ts
export function oneLine(value: any): string
export function mdInline(value: any): string
export function mdCell(value: any): string
export function mdCodeCell(value: any): string
export function fill(template: any, values: Record<string, string | number>): string
export function reportTimestamp(now?: number): string   // YYYY-MM-DD HH:mm
export function safeSlug(value: any, fallback: string): string
```

要求：

- 字符级行为必须与现有实现一致（反引号、竖线转义、空白折叠）。
- `reportTimestamp` 使用本地时间，补零规则与 `reportFilename` 一致。
- `safeSlug` 只保留 `[0-9A-Za-z]`，转小写，连续非法字符折叠为 `-`，去掉首尾 `-`，截断 32 字符。

#### 4.5.2 新增 `src/client/project-report.ts`

```ts
export interface ProjectReportInput {
  project: Project
  views: TaskView[]
  t: Record<string, any>
  /** 当前界面语言的状态文案，例如「待验收」「已合并」。 */
  statusLabel: (view: TaskView) => string
  now?: number
}

export function projectReportFilename(project: Project, now?: number): string
export function buildProjectReport(input: ProjectReportInput): string
```

实现要求：

- 纯函数，不访问 DOM / 网络；`now` 可注入。
- 章节固定顺序：标题、项目元数据、状态统计、任务表、逐任务详情、备注说明。
- 任务按 `compareTaskOrder` 排序（与左栏一致）。
- 表格单元格用 `mdCell` / `mdCodeCell`；标题、分支、标签中的 `|` 和换行必须转义，不能撑破表格。
- 验收进度使用 `criteria()` / `criteriaProgress()`；已合并 / 已清理任务按现有语义显示全部完成。
- 备注只放在逐任务块，避免表格过长；没有备注写 `t.projectReportNoNotes`。
- 没有任务时输出 `t.projectReportEmpty`，其余章节仍然存在。
- 文件名使用 `safeSlug(project.name, id8(project.id) || 'project')`。

#### 4.5.3 下载辅助 `src/client/format.ts`

新增：

```ts
/** 触发浏览器下载文本文件；不支持 Blob/URL 时返回 false。 */
export function downloadText(text: string, filename: string): boolean
```

- 使用 `Blob` + `URL.createObjectURL` + 临时 `<a download>`，结束后延迟 `revokeObjectURL`。
- 单任务报告下载改为调用该函数，避免复制粘贴两套实现；行为保持不变（失败提示 `t.reportFailed`）。

#### 4.5.4 项目详情（`src/client/project-detail.ts`）

- 在 Overview 的「最近活动」卡片之前新增 `Card`：

```
[图标 file] 项目验收报告
说明：把当前项目的任务、验收进度、分支与备注导出为 Markdown。
[复制报告] [下载 .md]
```

- 使用项目详情已有的 `isRunning`、`resolveStatus`、`boardStatusLabel` 计算 `statusLabel`。
- 用 `busy === 'report'` 禁用两个按钮；复制成功提示 `t.projectReportCopied`，下载成功提示 `t.projectReportDownloaded`，失败统一 `t.reportFailed`。
- 报告数据使用 `v.tasks`（当前项目详情可见任务）。

#### 4.5.5 文案

`locale/zh.json` / `locale/en.json` 同步新增，key 集合必须一致：

- 入口与结果：`projectReport`、`projectReportHint`、`projectReportCopy`、`projectReportDownload`、`projectReportCopied`、`projectReportDownloaded`
- 报告字段：`projectReportTitle`、`projectReportProject`、`projectReportRepo`、`projectReportBase`、`projectReportMergeGate`、`projectReportGeneratedAt`、`projectReportSummary`、`projectReportTotal`、`projectReportStatusCount`、`projectReportTasks`、`projectReportEmpty`、`projectReportNoCriteria`、`projectReportNoNotes`、`projectReportArchived`
- 任务表列名：`projectReportColNo`、`projectReportColStatus`、`projectReportColTask`、`projectReportColBranch`、`projectReportColProgress`、`projectReportColPriority`、`projectReportColTags`、`projectReportColActivity`
- 逐任务块：`projectReportTaskHead`、`projectReportMergedCommit`、`projectReportHead`
- 合并门禁值：`mergeGateOff`（如已有同义 key 可复用）

占位符沿用 `{n}` / `{total}` / `{name}` 约定。

### 4.6 验收标准

- [ ] 项目详情显示「项目验收报告」卡片，复制 / 下载均可用。
- [ ] 复制内容为完整 Markdown，包含元数据、统计、任务表、逐任务验收项和备注。
- [ ] 下载文件名为 `project-<slug>-<YYYYMMDD>-<HHmm>.md`，内容与复制一致。
- [ ] 任务顺序与左栏一致；已归档任务（如果出现在数据中）有标注。
- [ ] 无任务、无验收标准、无备注时报告仍可生成，并给出降级文案。
- [ ] 标题 / 分支 / 标签中的 `|`、换行、反引号不会破坏表格。
- [ ] 中英文报告均可生成，`npm run check:locale` 通过。
- [ ] 报告不包含 diff 正文，不发起额外网络请求。
- [ ] 单任务报告行为不变，现有测试全部通过。

### 4.7 测试要点

- `test/client-project-report.test.ts`（新增）：
  - 元数据、统计、任务表、逐任务块。
  - 空项目、无标准、无备注。
  - 已合并 / 已清理进度。
  - `|`、换行、反引号转义。
  - 排序与 `compareTaskOrder` 一致。
  - 文件名 slug、补零、同一分钟稳定。
- `test/client-report.test.ts`：确认抽出 `markdown.ts` 后原有断言不变；新增备注 / 标签 / 优先级断言。
- 下载辅助单测可通过注入 fake document/URL 或仅在项目报告中测纯函数；至少保证不支持 Blob 时返回 false。

---

## 5. 停滞任务检测（Stalled）

### 5.1 功能说明

根据任务最近一次活动时间，识别「长期没有动静」的任务，并在左栏与注意力汇总中展示：

- 计算口径：`lastActivity = max(task.updatedAt, task.createdAt, snapshot.worktree.lastCommitAt)`。
- 阈值（天）：

| 状态 | 阈值 | 说明 |
| --- | --- | --- |
| `ready` | 3 | 已建 worktree 但一直没绑会话 |
| `developing` | 7 | 有会话但长期没有提交 / 记录更新 |
| `review` | 3 | 已可验收但长期没人处理 |
| `reviewing` | 3 | 停在验收切换状态 |
| `merged` / `cleaned` / `broken` | 不检测 | 已结束或状态不可信 |
| 已归档 | 不检测 | 用户已主动隐藏 |

- 展示：
  - 左栏注意力筛选新增「停滞」选项，带数量。
  - 任务行显示「停滞 N 天」chip（warning 色），`title` 给出最后活动时间。
  - 顶部注意力汇总条把停滞计入总数；当只有停滞任务时，文案显示「N 个任务停滞」。
- 停滞是派生视图，不写入任务记录，不改状态，不发送通知。

### 5.2 为什么做

看板能显示「进行中 / 待验收」，但无法区分「今天刚更新」和「两周没人碰」。批次任务一多，停滞任务会安静地堆在列表里，直到有人想起来。用现有时间字段做纯派生检测，不需要新增存储或后台任务，就能把这类任务主动推到注意力视图里。

### 5.3 预期效果

- 一个 8 天没有提交、没有更新的进行中任务，左栏出现「停滞 8 天」chip，并计入「停滞」筛选。
- 3 天没有绑定会话的待开始任务被标记；刚发布的任务不会被误报。
- 已合并、已清理、异常、已归档任务永远不会被标记。
- 修改标签 / 优先级 / 备注 / 验收勾选会更新 `updatedAt`，因此会重置停滞计时（这是有意的「有活动」信号）。
- 阈值固定为常量，不在本批次做项目级配置。

### 5.4 收益

- **对用户**：不用逐个点开就能发现被遗忘的任务。
- **对团队**：批次验收前先清理停滞项，减少「以为在做、其实没人做」。
- **对插件**：注意力模型从「会话/合并状态」扩展到「时间维度」，为后续 SLA / 提醒留下纯函数基础。
- **风险可控**：纯派生、无存储字段、无后台任务；阈值保守，默认不打扰。

### 5.5 实现方案

#### 5.5.1 新增纯函数 `src/client/staleness.ts`

```ts
export const STALLED_DAY_MS = 86_400_000
export const STALLED_THRESHOLDS: Record<'ready' | 'developing' | 'review' | 'reviewing', number> = {
  ready: 3,
  developing: 7,
  review: 3,
  reviewing: 3,
}

/**
 * 返回停滞天数（>= 阈值时），否则 null。
 * 已归档 / merged / cleaned / broken 一律返回 null。
 */
export function stalledDays(
  task: WorktreeTask,
  snapshot: TaskSnapshot,
  now: number = Date.now(),
): number | null
```

要求：

- `lastActivity` 取三个时间戳的最大值；缺失按 0 处理。
- `days = Math.floor((now - lastActivity) / STALLED_DAY_MS)`；`days >= threshold` 时返回 `days`，否则 `null`。
- `now < lastActivity`（时钟回拨）时返回 `null`。
- 状态从 `snapshot.status` 读取；`task.archivedAt` 存在时直接返回 `null`。

#### 5.5.2 注意力模型（`src/client/task-attention.ts`）

- `AttentionCategory` 增加 `'stalled'`；`AlertKind` 增加 `'stalled'`。
- `AttentionInput` 增加 `stalledDays?: number | null`。
- `TaskAttention` 增加 `stalledDays?: number`，供行内文案使用。
- `deriveTaskAttention`：
  - 若 `stalledDays` 是正数，`categories.add('stalled')`，`alerts.push('stalled')`。
  - `ALERT_PRIORITY` 调整为 `['recovery', 'pending', 'broken', 'stalled', 'post-merge', 'session']`。
  - 返回对象带上 `stalledDays`。
- `SEVERITY`：`stalled: 1`（与 review 同级，低于 pending/broken/recovery）。
- `CATEGORY_ORDER`：`['recovery', 'broken', 'pending', 'review', 'stalled']`。
- `categoryKey` 增加 `stalled: 'attentionStalled'`。
- `summarizeAttention` 的 counts 初始化增加 `stalled: 0`。
- `computeFilterCounts`：
  - counts 增加 `stalled`。
  - `total` 的去重集合包含 `stalled` 类别（与 pending/review/broken 一样）。

#### 5.5.3 汇总条（`src/client/attention-summary.ts`）

- 标题选择增加停滞分支：
  - `severity >= 2` 仍优先 pending / broken / recovery。
  - `severity === 1` 时：`counts.review > 0` 用 review 文案，否则用 `attentionSummaryStalled`。
- `present` 来自 `CATEGORY_ORDER`，停滞会出现在链接列表。
- 只有停滞任务时汇总条仍然显示（`total > 0`）。

#### 5.5.4 筛选与行内展示（`src/client/attention-filter.ts`、`src/client/rail.ts`、`src/client/board.ts`）

- `AttentionFilter` 的 options 增加 `'stalled'`（放在 `review` 之后、`recovery` 之前）；图标 `clock`，不使用 danger 样式。
- Board 在构建 `attentionMap` 时传入：

```ts
stalledDays: stalledDays(tv.task, tv.snapshot),
```

- Rail 的 `alertText` 增加 `'stalled'` 分支：

```ts
case 'stalled': return String(t.attentionStalledDays).replace('{n}', String(/* days */))
```

- 行内 chip 由现有 `primary` 逻辑自动渲染；`title` 可附加最后活动时间。
- 不需要新增 CSS；复用现有 warning chip。

#### 5.5.5 文案

- `attentionStalled`（筛选/汇总标签）
- `attentionSummaryStalled`（汇总条标题，`{n}`）
- `attentionStalledDays`（行内 chip，`{n}`）
- `attentionStalledHint`（可选，title 说明最后活动时间）

### 5.6 验收标准

- [ ] `ready` 3 天、`developing` 7 天、`review` / `reviewing` 3 天以上被标记；阈值内不标记。
- [ ] 最近提交时间晚于 `updatedAt` 时，以最近提交为准。
- [ ] 已合并 / 已清理 / 异常 / 已归档任务不标记。
- [ ] 左栏筛选出现「停滞」并显示正确数量；选中后只显示停滞任务。
- [ ] 任务行显示「停滞 N 天」chip。
- [ ] 汇总条计入停滞总数；只有停滞时文案正确。
- [ ] 修改元数据 / 勾选验收项会更新 `updatedAt`，从而重置计时。
- [ ] 不新增存储字段，不改状态机。

### 5.7 测试要点

- `test/client-staleness.test.ts`（新增）：三种状态阈值、边界（正好 3/7 天）、最近提交、时钟回拨、归档 / 合并 / 清理 / 异常。
- `test/client-task-attention.test.ts`：`stalledDays` 产生类别与 alert；优先级顺序；counts / total 去重；`categoryKey`。
- `test/client-model.test.ts` 或筛选测试：停滞筛选计数。
- `test/client-attention-summary`（若存在）/ 纯函数断言：只有停滞时的标题。

---

## 6. 通用实现约定

1. **共享纯函数优先**：标签 / 优先级 / 排序 / 停滞 / Markdown 都放在无 DOM 的纯模块里，服务端与客户端共用；不要在多个文件复制规则。
2. **原子写**：所有任务字段写操作走 Store 的 `withLock` + `refresh` + `save`；HTTP / Runtime 只做校验与错误映射。
3. **可选字段**：不写 `undefined` 键；清空即删除字段（沿用 `putTask` / `setTaskPinned` 的约定）。
4. **错误语义**：校验失败 400，任务不存在 404；错误信息使用中文，前端直接展示。
5. **排序唯一入口**：`compareTaskOrder` 同时用于服务端 `projectViews` 和客户端 `upsertPublishedTask`；不要各自写 sort。
6. **文案**：所有新文案同时加入 `locale/zh.json` 与 `locale/en.json`，key 集合一致；`check-locale` 必须通过。
7. **可访问性**：标签筛选 `<select>` 有 `aria-label`；编辑控件有标签；错误用 `role="alert"`；保存中禁用；不引入仅靠颜色表达的状态。
8. **不新增依赖**：不引入日期库、Markdown 库或 UI 库；继续使用现有原语与手写样式。
9. **文档同步**：README、CHANGELOG、docs/frontend-design.md、docs/i18n-terminology.md 与版本号同步到 1.13.0。
10. **feature.md 由主线程维护**：实施者只阅读本文件，不重写第 0–9 节；可以在第 10 节追加实施记录，但主线程会最终核对。

## 7. 批次验收标准

- [ ] 5 个功能均可从 UI 或模型工具触发，且无标签 / 无优先级 / 无备注 / 无停滞时行为与 1.12.0 一致。
- [ ] `tags`、`priority`、`notes` 三个字段在发布、详情编辑、刷新、重启、双实例场景下不丢失、不互相覆盖。
- [ ] 左栏标签筛选、停滞筛选、搜索（标签 / 备注）、优先级排序互相兼容；组合筛选结果正确。
- [ ] 单任务验收报告与项目验收报告都包含新元数据；Markdown 表格不被特殊字符破坏。
- [ ] 旧任务记录（无新字段）加载不报错，排序与状态不变。
- [ ] `npm run check:locale` 通过；中英文 key 完全一致。
- [ ] `npm run verify`（typecheck + locale + 测试 + 构建）通过，测试数量不少于 1.12.0 的 338 项并有所增加。
- [ ] README、CHANGELOG、docs/frontend-design.md、docs/i18n-terminology.md、package.json、package-lock.json 更新到 1.13.0。
- [ ] 不引入新依赖，不改变现有 HTTP 接口语义（只新增 `task/meta` 与可选字段）。

## 8. 风险、边界与回滚

- **旧记录兼容**：三个新字段全部可选；读取时不假设存在；清空用删除字段而不是写 `null`。
- **双实例并发**：`updateTaskMeta` 在锁内刷新后只改自己的字段，避免把另一实例刚写的 sessionId / mergedAt 覆盖掉。
- **搜索性能**：标签和备注只是字符串 includes，任务量在本地台账规模内；不新增索引。
- **停滞误报**：阈值保守；`updatedAt` 在元数据 / 勾选 / 置顶等操作时更新，视为活动；已归档和已结束状态不检测。
- **报告体量**：项目报告不包含 diff 正文；备注最长 2000 字符，任务数量按项目实际规模；仍建议在文档中提示大项目报告可能较长。
- **Markdown 注入**：报告是用户本地生成并复制的文本，不渲染为 HTML；表格转义防止结构破坏。
- **回滚**：
  - 标签 / 优先级：移除 UI 与排序逻辑即可，字段留在记录中不影响旧版本。
  - 备注：移除编辑区与报告章节即可。
  - 项目报告：移除卡片与 `project-report.ts` 即可。
  - 停滞：移除 `stalled` 分类与纯函数即可，不涉及存储。
- **不做的事**：不做标签重命名 / 批量标签、不做优先级通知、不做项目级停滞阈值配置、不做服务端报告接口、不做备注历史版本。

## 9. 文件清单

| 文件 | 改动 |
| --- | --- |
| `src/task-meta.ts` | 新增标签 / 优先级 / 排序纯函数 |
| `src/models.ts` | `WorktreeTask` 增加 `tags` / `priority` / `notes` |
| `src/store.ts` | 新增 `updateTaskMeta` 与结果类型 |
| `src/runtime.ts` | 新增 `updateTaskMeta` 并映射错误 |
| `src/runtime/types.ts` | `PublishInput` 增加 `tags` / `priority` |
| `src/runtime/projects.ts` | 发布校验与写入；`projectViews` 使用 `compareTaskOrder` |
| `src/http.ts` | 新增 `task/meta`；`publish` 透传字段 |
| `src/tools.ts` | 发布参数、`worktree_act` 的 `meta` 动作、`brief` 输出 |
| `src/client/publish-state.ts` | draft 增加 tags / priority |
| `src/client/publish.ts` | 高级选项标签 / 优先级与校验 |
| `src/client/stage.ts` | 「任务信息」分区（标签 / 优先级 / 备注） |
| `src/client/rail.ts` | 标签筛选、标签与优先级 chips、停滞 chip |
| `src/client/board.ts` | tagFilter、停滞输入、meta 保存接线、项目报告状态 |
| `src/client/board/use-board-actions.ts` | `runSaveMeta` |
| `src/client/model.ts` | `collectTags`、标签过滤、搜索字段 |
| `src/client/board-data.ts` | 使用 `compareTaskOrder` |
| `src/client/task-attention.ts` | `stalled` 分类与计数 |
| `src/client/attention-filter.ts` | 停滞筛选项 |
| `src/client/attention-summary.ts` | 停滞汇总文案 |
| `src/client/staleness.ts` | 新增停滞纯函数 |
| `src/client/markdown.ts` | 新增共享 Markdown 工具 |
| `src/client/report.ts` | 复用 markdown；增加标签 / 优先级 / 备注 |
| `src/client/project-report.ts` | 新增项目验收报告纯函数 |
| `src/client/project-detail.ts` | 项目验收报告卡片与复制 / 下载 |
| `src/client/format.ts` | `downloadText` |
| `src/client/styles/workbench.ts` | 标签筛选与任务信息分区样式 |
| `locale/zh.json`、`locale/en.json` | 新增文案 |
| `test/task-meta.test.ts` | 新增纯函数用例 |
| `test/client-staleness.test.ts` | 新增停滞用例 |
| `test/client-project-report.test.ts` | 新增项目报告用例 |
| `test/store.test.ts` | `updateTaskMeta` 用例 |
| `test/http-flow.test.ts` | `task/meta` 与发布字段用例 |
| `test/client-model.test.ts` | 标签过滤 / 搜索 / 排序用例 |
| `test/client-publish-state.test.ts` | draft 用例 |
| `test/client-report.test.ts` | 报告新字段用例 |
| `test/client-task-attention.test.ts` | 停滞分类 / 计数用例 |
| `test/tools-act.test.ts` | `meta` 动作用例 |
| `README.md`、`CHANGELOG.md`、`docs/frontend-design.md`、`docs/i18n-terminology.md` | 文档与版本 |
| `package.json`、`package-lock.json` | 版本 1.13.0 |

## 10. 验收记录

- **实施提交**：`c87a873` feat: 每日功能批次 v1.13.0（标签 / 优先级 / 备注 / 项目验收报告 / 停滞检测）。
- **验收复核与修复**：主线程逐项复核后补充以下修正——备注在单任务 / 项目报告中保留换行；发布弹窗恢复标签或非普通优先级时自动展开高级选项；标签筛选零匹配时显示专用空态与清除入口；项目报告「最近活动」纳入 worktree 最新提交时间；项目报告下载增加防重入；窄容器下任务信息行改为上下布局；优先级下拉在保存期间保持选中值。
- **验证**：`npm run verify` 通过（typecheck + locale zh/en 各 723 键 + 408 tests / 0 fail + build 成功，`dist/index.js` 159.6kb、`dist/client.js` 524.0kb）。
- **测试数量**：408（1.12.0 为 338，新增 70）。
- **遗留**：无已知阻塞。项目报告体量随任务数增长，长项目建议直接下载 `.md` 查看。
- **PR**：待创建后补充编号与链接。
