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
