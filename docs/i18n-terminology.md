# 前端术语与本地化规范（i18n）

`@5318vo/dsh-worktree` · 维护：前端

本文统一中英文术语、单位与占位符，避免同一概念在不同页面/语言里用词漂移。所有文案位于 `locale/zh.json` 与 `locale/en.json`，两者 key 必须完全一致（CI: `npm run check:locale`）。

## 1. 核心术语表

| 概念 | 中文 | English | 说明 / key 示例 |
| --- | --- | --- | --- |
| 验收（动作/流程） | 验收 | review / acceptance | 动作「验收」用 review（如 `reviewing` 验收中）；「验收标准」固定 acceptance criteria |
| 验收标准 | 验收标准 | acceptance criteria | `acceptanceCriteria` / `acceptanceLibrary` |
| 验收报告 | 验收报告 | acceptance report | `reportTitle`（“验收报告：{title}” / "Acceptance report: {title}"）；导出文件 `acceptance-<id8>-<YYYYMMDD>-<HHmm>.md` |
| 复制报告 | 复制报告 | Copy report | `reportCopy`；成功 `reportCopied` |
| 下载 .md | 下载 .md | Download .md | `reportDownload`；成功 `reportDownloaded`，失败统一 `reportFailed` |
| 待验收 | 待验收 | Ready for review | `review`（任务状态）；统计 `reviewTasks` 同为 "Ready for review" |
| 待处理 | 待处理 | pending | 待审批/计划待审/待回答统称 pending |
| 待审批 | 待审批 | Waiting approval | `pendingApproval` |
| 计划待审 | 计划待审 | Plan review | `pendingPlanReview` |
| 待回答 | 待回答 | Waiting answer | `pendingQuestion` |
| 任务分支 | 任务分支 | task branch | 自动分支 `<prefix><id8>` |
| 基线分支 | 基线分支 | base branch | `baseBranch` |
| 主仓库 | 主仓库 | main repo | `mainRepo` |
| worktree | worktree / 工作树 | worktree | 中英统一保留 worktree，不译为「工作树」 |
| 合并回基线 | 合并回基线 | Merge into base | `merge` |
| 切回原分支 | 切回原分支 | Switch back | `back` |
| 清理 worktree | 清理 worktree | Clean worktree | `cleanup` |
| 归档 | 归档 | Archive | `archive` / `archived` |
| 会话 | 会话 | session | `session` / `openSessionBtn` |
| 执行清单 | 执行清单 | Todos | `liveTodos`（工具标签同为 "Todos"，不再用 "Tasks"） |
| 处理（待处理时按钮） | 去处理 | Respond | `handlePending`（不再用 "Review"，避免与状态 review 混淆） |
| 任务信息 | 任务信息 | Task info | `taskInfo`；标签 / 优先级 / 备注三个字段的容器 |
| 标签 | 标签 | tag | `taskTags`；行内 chip `#tag`，筛选 `taskTagFilter`，全部 `taskTagAll` |
| 优先级 | 优先级 | priority | `taskPriority`；三档 `priorityHigh` / `priorityNormal` / `priorityLow`，普通为默认且不落盘 |
| 备注 | 备注 | notes | `taskNotes`；计数 `n/2000`，报告章节 `reportNotes`，空值 `taskNoNotes` |
| 截止日期 | 截止日期 | due date | `taskDue`；行内 `taskDueOverdue` / `taskDueToday` / `taskDueSoon`，报告 `reportDue`，无值 `reportDueNone`；输入与展示统一 `YYYY-MM-DD` |
| 逾期 | 逾期 | overdue | `attentionOverdue`；汇总 `attentionSummaryOverdue`，分类键 `overdue`，与「停滞」是并列分类 |
| 前置任务 | 前置任务 | dependencies | `taskDeps`；行内「等待 {n} 项前置」`taskDepsBlocked`，服务端错误 `taskDepsCycle` / `taskDepsMissing` / `taskDepsCrossProject` 等 |
| 项目洞察 | 项目洞察 | project insights | `insightsTitle`；周期 `insightsCycleMedian`、吞吐 `insightsMerged7d`、验收核对率 `insightsAcceptance`、空态 `insightsEmpty` |
| 任务时间线 | 任务时间线 | task timeline | `taskLifecycle`；事件 `lifecycleCreated` / `lifecyclePinned` / `lifecycleMerged` / `lifecycleCleaned` / `lifecycleArchived` / `lifecycleUpdated`，周期 `lifecycleCycle` |
| 结构化搜索 | 结构化搜索 | structured search | `searchSyntaxHint`；语法 `tag:` / `priority:` / `status:`，解析器 `src/client/search-query.ts` |
| 停滞 | 停滞 | stalled | `attentionStalled`；行内「停滞 {n} 天」`attentionStalledDays`，汇总 `attentionSummaryStalled` |
| 项目验收报告 | 项目验收报告 | project acceptance report | `projectReport`；文件名 `project-<slug>-<YYYYMMDD>-<HHmm>.md`，与单任务 `acceptance report` 区分 |
| 工时 | 工时 | work time | `taskWork`；未记录 `taskWorkEmpty`，计时中 `taskWorkTiming`，按钮 `taskWorkStart` / `taskWorkStop`；单位模板 `taskWorkUnderMinute` / `taskWorkMinutes` / `taskWorkHours` / `taskWorkHoursMinutes` / `taskWorkDays` / `taskWorkDaysHours`，计时中后缀 `taskWorkTimingSuffix`；报告复用这些键 |
| 规模估算 | 规模估算 | estimate | `taskEstimate`；点数 `{n} 点` / "{n} pt"，下拉空选项 `taskEstimateEmpty` / `taskEstimatePoints`；项目负载 `insightsWorkload` |
| 依赖关系图 | 依赖关系图 | dependency graph | `depGraphTitle`；层 `depGraphLayer`，缺失 `depGraphMissing`，循环 `depGraphHasCycle` / `depGraphNoCycle` / `depGraphCycles`，截断 `depGraphTruncated` |
| 风险雷达 | 风险雷达 | risk radar | `riskRadar`；高 / 中 / 低 `riskHigh` / `riskMedium` / `riskLow`，原因 `riskReasonOverdue` 等 |
| 保存的视图 | 保存的视图 | saved views | `savedViewSelect`；自定义 `savedViewCustom`，保存 `savedViewSave`，删除 `savedViewDelete`，保存失败 `savedViewSaveFailed`，仅本次会话 `savedViewSessionOnly` |
| 项目周报 | 项目周报 | project digest | `digestTitle`；窗口 `digestWindowDays`，四类变化 `digestCreated` / `digestMerged` / `digestCleaned` / `digestArchived`，交付工时 `digestDeliveredWork`，文件名 `digest-<slug>-<YYYYMMDD>-<HHmm>.md` |
| 估算校准 | 估算校准 | estimate calibration | `calibrTitle`；样本 `calibrSamples`，每点均值 / 中位 `calibrAverage` / `calibrMedian`，样本不足 `calibrNeedMore`，覆盖率 `calibrCoverage` |
| 关键路径 | 关键路径 | critical path | `critPathTitle`；可开始 `critPathReady`，被阻塞 `critPathBlocked`，缺失前置 `critPathMissing`，循环 `critPathCycle`；只表达依赖跳数，不代表工期 |
| 可开始任务 | 可开始任务 | ready to start | `critPathReady` / `critPathReadyList`；指前置都已完成或没有前置的开放任务 |
| 交接摘要 | 交接摘要 | handover brief | `handoverTitle`；下一步 `handoverSectionNext`，前置 / 后继 `handoverSectionDeps` / `handoverSectionDependents`，文件名 `handover-<id8>-<YYYYMMDD>-<HHmm>.md` |
| 自上次访问 | 自上次访问 | since your last visit | `visitTitle`；摘要 `visitSummary` / `visitSummaryNoWork`，关闭 `visitDismiss`；localStorage key `dshw-board:last-visit:v1` |
| 交付工时 | 交付工时 | delivered work | `digestDeliveredWork`；只指窗口内合并任务的累计工时，不是窗口内新增工时 |
| 新增工时 | 新增工时 | work added | `visitSummary` 的 `{work}`；按累计工时在两次访问之间的增量计算 |

## 2. 单位规则

- 未提交改动：中文用「处」（如「3 处未提交改动」），不用「个」。
- 提交：中文「个领先提交」；英文 "{n} commit(s) ahead"。
- 文件：中文「个文件」；英文 "{n} file(s)"。
- 目录/任务：中文「个目录」「个任务」。
- 标签 / 备注：长度限制用「个字符」，不写「位」；标签数量用「个」。
- 日期：截止日期输入与报告统一 `YYYY-MM-DD`，按本地日历日解释；不写「MM/DD」或相对日期。
- 天数：逾期、剩余、停滞与周期统一用「天」；英文用 day(s)，不写 d。
- 工时：中文用「小时」「分」，英文用 h / m；小于 1 分统一「不足 1 分」/ "under 1 min"，不显示秒。
- 规模：中文用「点」，英文用 "pt"；只允许 `1/2/3/5/8`，不写小数。
- 每点工时：中文「每点 {duration}」，英文 "{duration} per point"；不要写成「点均」或 "points/hour"。
- 风险分：中文「{n} 分」，英文 "{n} pts"；分数只作排序提示，不写百分比。
- 关键路径长度：中文「{n} 个任务」，英文 "{n} task(s)"；不写「工期」「预计完成」。

## 3. 占位符规则

- 插值一律使用 `{n}`（数量）、`{name}`、`{base}`、`{branch}`、`{files}` 等具名占位符。
- 验收报告使用 `{title}`（任务标题）、`{n}`/`{total}`（已核对 / 总数）、`{files}`/`{add}`/`{del}`（文件数与行数），中英两侧集合必须一致。
- `duration` 从历史 `{s}` 统一为 `{n}`（代码已同步替换逻辑，避免插值失败）。
- 任何模板必须同时在中英两边保留相同占位符集合。
- 工时 / 估算 / 风险新增占位符：`{n}`（时长数字、点数、分数、数量）、`{titles}`（阻塞任务标题）；中英两侧必须一致，不使用 `{hours}` 与 `{minutes}` 两套写法。
- 周报 / 校准 / 关键路径 / 交接 / 访问摘要新增占位符：`{created}`、`{merged}`、`{cleaned}`、`{archived}`、`{review}`、`{overdue}`、`{work}`、`{points}`、`{estimated}`、`{checked}`、`{total}`、`{shown}`、`{have}`、`{need}`、`{deps}`；中英两侧必须一致，不新增同义占位符。
- 交接摘要的阻塞前置使用 `{deps}`（当前实现）；若后续统一为 `{titles}`，必须同步修改中英文案与测试。

## 4. 英文复数

- 计数类英文文案采用复数安全写法（如 "{n} file(s)"、"{n} task(s) need attention"），避免出现 "1 projects"。
- 新增计数文案时优先选择可同时覆盖 1 与多数的写法。

## 5. 已处理的本地化问题（本轮）

- 补 `reconnecting`（此前缺失导致空白）。
- `pickDict` 增加回退链：当前语言 → 另一语言 → key 名，缺失不再显示空白。
- `reviewTasks` 英文改为 "Ready for review"。
- 清空最近目录成功改用 `recentsCleared`（不再复用按钮文案）。
- `handlePending` → "Respond"；`toolTodos` → "Todos"；`liveLastPrompt` → "Last activity"。
- `duration` 占位符 `{s}` → `{n}`；`cleanupDirtyGone` 中文单位「个」→「处」。
- 删除评审确认废弃的 key（confirmDelete/confirmMerge/confirmCleanup/liveQueued/liveSubagents/livePerms/liveTurns/liveTurnN/onBranch/tasksUnit/detail/description/mergeCleanHint）。

## 6. CI

```bash
npm run check:locale
```

- 失败条件：代码引用了但中/英缺失的 key；中英 key 集合不一致。
- 告警（不失败）：疑似未被引用的 key（部分通过动态状态取值使用，需人工确认）。
