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

## 2. 单位规则

- 未提交改动：中文用「处」（如「3 处未提交改动」），不用「个」。
- 提交：中文「个领先提交」；英文 "{n} commit(s) ahead"。
- 文件：中文「个文件」；英文 "{n} file(s)"。
- 目录/任务：中文「个目录」「个任务」。

## 3. 占位符规则

- 插值一律使用 `{n}`（数量）、`{name}`、`{base}`、`{branch}`、`{files}` 等具名占位符。
- 验收报告使用 `{title}`（任务标题）、`{n}`/`{total}`（已核对 / 总数）、`{files}`/`{add}`/`{del}`（文件数与行数），中英两侧集合必须一致。
- `duration` 从历史 `{s}` 统一为 `{n}`（代码已同步替换逻辑，避免插值失败）。
- 任何模板必须同时在中英两边保留相同占位符集合。

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
