# DeepSeek Worktree 任务插件

`@5318vo/dsh-worktree` · v1.14.0 · 最后更新：2026-11-23

每个任务对应一个真实的 DSH 会话。发布任务时创建独立的 Git worktree 和任务分支，会话以 worktree 为工作目录出现在左侧工作区。任务对话、审批、追问、中止和继续均使用 DSH 原生能力，工作台负责发布、查看状态和验收。

## 文档

- [前端设计说明](docs/frontend-design.md)：布局、视觉系统、组件、交互、可访问性和验收清单。
- [更新日志](CHANGELOG.md)：各版本新增、变更与修复记录。

## 功能概览

- **项目级任务看板**：按项目分组展示任务、运行状态、待审批事项和 Git 状态。
- **真实 worktree 隔离**：默认每个任务使用 `~/.dsh/worktrees/<项目名>/<id8>`，与 T3 Code 一样放在仓库外，不污染主仓库工作区；设为相对目录名时仍支持旧的仓库内布局。
- **Hash 任务分支**：自动生成 `<branchPrefix><id8>`，例如 `dsh-wt/b92e5f2a`，不把中文标题写进分支名。
- **会话一体化**：任务详情可直接打开已有会话，没有会话时可创建会话。
- **完整验收流程**：切到主仓库验收、返回原分支、直接合并、清理 worktree、删除记录。
- **验收清单逐项勾选**：待验收任务的每条验收标准可点击核对 / 取消，进度随任务记录持久化，并在概览标题与合并确认中显示。
- **项目级合并门禁**：项目可开启「验收标准未全部核对时禁止合并」；开启后合并预检与执行都会以 `criteria-incomplete` 拦截，并给出还差几项。没有验收标准的任务不受影响。
- **发布模板**：设置页维护可复用的发布模板（名称、标题、描述、验收标准），发布弹窗选择后自动填充，验收标准只采用库中已有条目，其余进入手动标准。
- **任务置顶**：左栏任务行可置顶 / 取消置顶，置顶任务始终排在项目分组最前，其后按优先级、再按创建时间倒序。
- **任务标签**：发布弹窗与任务详情都可维护标签（最多 8 个、每个 24 字符，中英文逗号分隔并自动去重）；左栏可按标签筛选，任务行显示标签 chip，搜索同时命中标签。
- **任务优先级**：`low` / `normal` / `high` 三档，发布与详情都可选择；高优先级显示告警色 chip，列表按「置顶 → 优先级 → 创建时间倒序」统一排序。
- **任务备注**：任务详情提供带字数计数的备注区（最长 2000 字符，空串即清除），搜索命中备注，报告会带上备注内容。
- **任务截止日期**：发布高级区与任务详情都可设置本地日历日截止日期；逾期任务进入「逾期」筛选，行内显示「逾期 N 天 / 今天到期 / N 天后到期」，验收报告同步输出截止日期。
- **前置任务依赖**：任务详情可添加同项目任务作为前置（最多 8 个，服务端校验缺失 / 自依赖 / 跨项目 / 循环依赖）；未完成前置在行内显示「等待 N 项前置」，前置合并或清理后自动解除。
- **项目洞察**：项目详情根据已有时间戳展示平均 / 中位周期、近 7 天新建与合并、验收核对率、最久未完成天数，以及最近 7 天双柱吞吐图。
- **结构化搜索**：左栏搜索支持 `tag:` / `priority:` / `status:` 组合条件（含空格用引号），纯文本、标签下拉与注意力筛选继续叠加生效。
- **任务生命周期时间线**：概览与验收报告把发布、置顶、合并、清理、归档与最近更新按时间串成一条线，已合并任务显示「发布 → 合并 N 天」。
- **停滞任务检测**：待开始 / 待验收 / 验收中超过 3 天、进行中超过 7 天没有活动（含提交）即标记为停滞，进入「停滞」筛选并在行内显示「停滞 N 天」；已合并 / 已清理 / 异常 / 已归档任务不参与判定。
- **项目验收报告**：项目详情一键复制或下载整项目 Markdown 报告，包含项目元数据、状态统计、任务表与逐任务验收 / 备注，文件名 `project-<slug>-<YYYYMMDD>-<HHmm>.md`。
- **会话快捷指令**：实时会话提供「继续 / 跑测试 / 总结进展 / 提交改动」四个快捷 chip 和指令输入框，`Ctrl/Cmd+Enter` 发送；运行中的会话自动排队，等待审批 / 回答时禁用。
- **验收查看改动**：任务处于「待验收 / 验收中」时，任务详情展示相对基线分支的改动文件列表与逐文件 diff，包含已提交、未提交和未跟踪文件。
- **验收报告复制与下载**：「验收标准」分区标题右侧提供「复制报告」「下载 .md」，把任务信息、验收进度、提交、改动文件汇总和工作区状态导出为当前界面语言的 Markdown，适合贴到 PR 或走查记录里；报告只含文件路径与行数统计，不含 diff 正文。
- **安全的危险操作**：清理和合并会展示确认信息；删除分支、强制清理只在对应操作可用时出现。
- **响应式工作台**：宽屏 Rail / Stage / Inspector 三栏，窄屏收起左栏并把右栏变为覆盖式抽屉。
- **可访问表单**：字段标签关联、必填校验、加载/失败/重试状态、弹窗焦点圈定和 Escape 关闭。
- **统一控件**：按钮、标签、状态点、输入框、复选框、弹窗和 Toast 直接复用宿主共享的 UI 原语，与 DSH 其余界面保持同一套外观与交互。

## 使用流程

```text
新增项目
  └─ 选择 Git 仓库目录 → 读取分支 → 确认默认基线分支

发布任务
  └─ POST publish
       ├─ 创建任务分支 <branchPrefix><id8>
       ├─ 创建 worktree ~/.dsh/worktrees/<项目名>/<id8>
       ├─ （仅仓库内布局）写入 .git/info/exclude
       └─ 记录任务台账

绑定会话
  └─ POST bind/claim           ← 先原子占位，另一个窗口拿不到就不得开工
       ├─ remote.session.create({ workspaceId, cwd: worktree })（回报的 cwd 必须是该 worktree）
       ├─ 重命名 / 选模型 / 发送首个 prompt
       └─ POST bind（带 lease）  ← 记录 sessionId 与「会话归属哪个 DSH 实例」
            └─ 失败时释放占位并删除刚建的会话，避免孤儿

开发与验收
  └─ 原生对话 / 审批 / 追问
       ├─ 切到主仓库验收
       ├─ 返回原分支
       ├─ 直接合并
       └─ 清理 worktree / 删除记录
```

## 新增项目

新增项目弹窗只包含必要内容：

- 目标目录
- 浏览目录
- 项目名称
- 默认基线分支

行为说明：

- 目录输入框下的历史目录列表已移除，不再在弹窗里显示 `recents`。
- 工作台启动时不再为新增项目弹窗请求历史目录；设置页仍保留「最近目录」。
- 目录选择器使用同步锁，避免重复点击触发多个系统对话框；鼠标按下即可触发，键盘仍可通过按钮操作。
- 切换目录会立即清空旧基线分支，避免把上一个仓库的分支带到新项目。
- 默认基线分支为必填项。分支加载期间或分支为空时，不允许提交。
- 分支加载失败会显示错误和重试入口，也可手动输入分支名。
- 分支加载完成后自动选择当前分支或仓库默认分支。

## 任务分支命名

自动生成：

```text
<branchPrefix><id8>
```

示例：

```text
dsh-wt/b92e5f2a
```

规则：

- 默认前缀为 `dsh-wt/`，可在全局配置或项目设置里修改。
- `id8` 为任务 UUID 去掉连字符后的前 8 位。
- 自动分支不使用任务标题，不会生成中文 slug。
- 自定义任务分支只允许英文、数字、点、下划线和斜杠。
- 中文或包含非法字符的分支名会返回 `400`，不会创建 worktree。
- 历史上已经存在的中文分支不会被自动重命名，避免破坏已有 worktree 和合并关系。

## 任务提示词

新建任务统一生成提示词，包含：

- worktree 与主仓库的读写边界，主仓库只读
- 开始前用 `git rev-parse --show-toplevel` / `git branch --show-current` 自检
- 分阶段 commit、禁止切换分支/rebase/push/fetch/pull
- 禁止主动同步基线；即使发现基线有新提交，也只写进总结
- 仅在用户明确要求时执行 `git merge <base>`，冲突先问用户，失败用 `git merge --abort` 恢复
- 完成后汇总改动、提交、验证、冲突处理与遗留风险

## 状态推导

状态以 Git 和会话绑定情况为准：

```text
cleaned
  → broken
  → merged       merge-base --is-ancestor
  → reviewing    主仓库停在验收提交（detached HEAD）
  → review       worktree 有领先提交或未提交改动
  → developing   已绑定会话
  → ready        已创建分支和 worktree，尚未绑定会话
```

界面状态色：

| 状态 | 颜色语义 |
| --- | --- |
| 待开始 / 已清理 | Neutral |
| 进行中 / 验收中 | Brand |
| 待验收 | Warning |
| 已合并 | Success |
| 待审批 / 待回答 | Warning |
| 异常 / 操作失败 | Error |

Git 状态与会话状态分开显示：`review` 只表示 worktree 有待验收的提交或改动；如果最近一轮 `turn/end` 的原因是 `interrupted` 或 `error`，任务行和详情会额外显示「会话中断」/「会话异常」提示，验收操作仍按 Git 状态决定。

已合并的任务如果在旧分支上又出现新提交，状态仍为「已合并」，并附加「已合并 · 之后有 N 个新提交」标记：可以「再次合并」作为补丁路径，或「派生后续任务」新建后续任务。

## 工作台与交互

- 看板按参考原型的 「Rail / Stage / Inspector」 三栏组织：左栏 `272px`、中栏自适应、右栏 `284px`。
- 左栏 Rail：Logo、新增项目（`⊞`）、发布任务、搜索、状态过滤 pills（全部 / 待验收 / 进行中）、按项目分组的任务列表，底部显示仓库/任务计数和明暗主题切换；无项目时列表内直接给出「新增项目」按钮。
- 中栏 Stage：顶部面包屑（项目 / 任务分支 → 基线）和左右栏折叠按钮；标题区显示任务名、状态 chip、`基线..HEAD` 与更新时间、主/次操作；下方为「概览 / 实时会话 / 代码改动」三个标签页。
- 右栏 Inspector：合并预检结论、目标基线、任务 HEAD、技术信息（分支、会话 ID、worktree、路径）、生命周期操作（归档/取消归档、清理、删除记录）以及待处理暂存区。
- 待处理暂存区逐条列出 `pendingStashes`：可查看 patch、恢复回工作区或丢弃；未处理暂存会阻止清理和删除记录，后端返回 409 时这里就是解除阻塞的入口。
- 清理弹窗支持「强制」（存在未提交改动时）和「同时删除分支 / 强制删除未合并分支」；合并后自动切回原分支失败时，Inspector 显示「切回原分支」恢复入口。
- 左右两栏均可折叠；未选中任务或选中项目时右栏自动收起，中栏显示项目详情。
- 点击项目分组头部查看项目详情，点击任务项选中任务；任务项两层显示标题 + 状态/统计，以及分支 + 最近提交时间。
- 搜索按项目名、任务标题、分支和状态过滤；`/` 或 `Ctrl/Cmd+K` 聚焦搜索，`Esc` 清空。搜索框支持 `tag:前端`、`priority:high`、`status:review` 等结构化 token，多个标签取 AND，多个优先级 / 状态取 OR；未知或非法 token 回落为纯文本，空查询时的提示行说明语法；带空格的值用引号包裹，但没有快照的任务不会满足 `status:` 条件。
- 任务行在状态、优先级与标签 chip 之外，还会显示截止日期（逾期 / 今天 / 3 天内）与「等待 N 项前置」chip；两者都是派生展示，不改变状态、排序或合并门禁。
- 项目详情提供任务总数、进行中、待验收、已合并统计，并把待审批任务汇总为可跳转提示。
- 任务「概览」标签集中展示任务摘要与验收操作，「实时会话」展示会话时间线，「代码改动」展示待验收 diff；技术信息与危险操作固定在右栏。
- 概览中的验收标准可逐项点击核对：标题显示「已核对 n/total」，全部核对后显示完成态；勾选状态写入任务记录，刷新或重启后保持。已合并 / 已清理任务保持只读并显示全部完成。合并确认弹窗会列出验收进度；项目开启合并门禁时，未核对项会同时阻止合并并提示还差几项。
- 「验收标准」标题右侧的「复制报告」把 Markdown 报告写入剪贴板，「下载 .md」保存为 `acceptance-<id8>-<YYYYMMDD>-<HHmm>.md`；两者内容完全一致，复制或写入失败以 Toast 报错，任一操作进行中时两个按钮禁用。
- 左栏任务行提供置顶按钮（`aria-pressed`），置顶任务显示图钉标记并固定在分组顶部；重复置顶保留首次时间，不会因为再点一次而重新排序。
- 搜索下方在有标签时出现「按标签筛选」下拉，选项来自当前看板的全部标签（忽略大小写去重、按字母序）；任务行显示最多 2 个 `#tag` chip 与 `+N`，悬停可看完整列表。筛选无匹配时左栏给出说明和「全部标签」入口，不会只剩空白。
- 任务行按优先级显示 chip：高优先级为告警色，低优先级为弱化色，普通优先级不显示；项目分组与发布后的增量列表都使用同一套排序规则。
- 任务「概览」在描述与验收标准之间新增「任务信息」：标签可编辑（保存前校验数量与长度）、优先级选择后立即保存、备注输入框带 `n/2000` 计数并在切换任务时重置；截止日期使用日期输入并可清除；前置任务可添加 / 移除，未完成前置与缺失前置分别提示。没有保存回调时保持只读展示。
- 任务「概览」的「任务信息」之后是「任务生命周期时间线」：发布、置顶、合并（带短 SHA）、清理、归档与最近更新按时间升序排列；已合并任务显示发布到合并的天数，报告中也包含同一章节。
- 停滞任务在行内显示「停滞 N 天」，并进入「停滞」筛选与汇总条；当看板只剩停滞任务时，汇总条使用停滞专属文案而不是「待验收」。
- 逾期任务进入「逾期」筛选与汇总条；只有逾期任务时汇总条使用逾期专属文案。逾期天数按本地日历日计算，与截止日期输入保持同一口径。
- 项目详情新增「项目洞察」卡片：四项统计（平均周期 / 近 7 天合并 / 验收核对率 / 最久未完成）与最近 7 天新建、合并双柱图，全部由已有任务时间戳派生，不额外请求 Git 或写入记录。
- 项目详情新增「项目验收报告」卡片：复制与下载共用同一份纯函数输出，报告按「置顶 → 优先级 → 创建时间」排序，验收标准用 `[x]` / `[ ]` 标记，空项目 / 无标准 / 无备注都有本地化说明。
- 实时会话底部提供快捷指令：chip 只负责填充输入框，发送前可修改；`Ctrl/Cmd+Enter` 或「发送」提交。会话运行中提示「指令会排队执行」，等待审批 / 回答时输入区禁用并说明原因。
- 发布弹窗支持选择项目/基线、标题与描述（均必填）、从全局验收标准库勾选 + 手动补充、高级选项里的自定义分支与模型选择；提交中禁用关闭与重复提交。续作任务会预填「原标题（续）」和原合并目标，并可选择「作为普通任务发布」或带上合并后新增的提交。
- 「切到主仓库验收」仅在任务进入待验收（`review`）后可用；待开始、进行中（`developing`）时在概览页说明原因，避免在开发完成前进入验收。
- 已合并任务详情的主操作为「派生后续任务」，「打开会话」降为次级；点击后打开发布弹窗并预填标题（原标题加「（续）」）、**基线为原任务的合并目标**和「关联前序任务」说明，描述留空由用户填写新需求。
- 继续任务总是用**新任务 ID 生成新分支**（不复用旧分支），起点是创建时该基线的最新本地提交；默认基线取原任务实际合并到的分支，不因项目默认基线后来变化而静默替换。
- 发布弹窗允许更换基线，但发布前会校验所选基线是否包含前序已合并成果；不包含时提示「所选基线未包含前序成果，请选择原合并目标，或改为普通任务」，并提供「作为普通任务发布」选项。
- 已合并任务分支在合并后又有新提交时，详情显示「已合并 · 之后有 N 个新提交」：可「再次合并」作为补丁；继续时弹窗会显式让用户选择「仅基于已合并成果继续」或「迁移合并后的新增改动」，不会悄悄带入。
- 后续任务会记录 `parentId`，详情中展示前序任务与后续任务的链接；发布成功后可选择清理前序任务的 worktree（默认不清理）。
- 主/次操作由任务状态和是否已有会话决定（例如待验收显示「切到主仓库验收 / 直接合并」，进行中显示「查看日志 / 打开会话」），同一时刻只出现一个验收方向。
- 合并前会重新调用 `task/merge-preflight`，并用这次预检返回的 `tipSha` / `baseSha` 作为合并的 SHA 锁；主仓库有未提交改动、预计冲突或主仓库不在基线分支时，失败原因以 Toast 展示。插件不会悄悄切换用户的分支，也不会丢弃未提交改动。
- 同一主仓库任一 Git 操作执行期间，当前任务的验收按钮显示「处理中」并禁用，避免重复提交；后端在执行前仍会用 Git 状态再校验一次。
- 实时会话按行展示每步的标签（`THINK` / `AGENT` 等）、标题和摘要，最多保留最近 60 条；完整内容通过「打开原生会话」查看。
- 合并、清理、删除任务、删除项目和清空最近目录均使用页面内确认弹窗，展示分支、路径和未提交改动。
- 右栏 Inspector 持续展示合并预检结论：基线有新提交时显示「基线已更新」，两边改到同一文件时提示重叠文件，`git merge-tree` 预检到真实冲突时提示「预计冲突」，但不改变任务状态。
- 合并前会再次预检，并带上 `expectedTip` / `expectedBase` 防止基线在确认期间被移动。
- 「让 Agent 同步基线」只在用户点击后向会话发送预设消息，插件不会自动向会话插入提醒；是否同步由用户决定。
- 自动合并失败时执行 `git merge --abort`，在弹窗中列出冲突文件和处理方式。
- 删除项目时默认勾选「同时删除 worktree 文件夹」：删除任务记录后会强制移除磁盘上的 worktree 目录；取消勾选则仅移除记录。仓库与分支本身不会被删除。
- 复制会话 ID、分支或路径后会给出 Toast 反馈；刷新状态有独立进行中状态。
- 任务详情和项目设置按 ID 重置状态，避免切换任务或项目后残留表单值、强制清理或删除分支选项。
- 勾选「创建后立即开始」的任务会在绑定会话后立即发送首条指令；历史遗留的空会话任务在详情显示「启动任务」，可补发首条指令。
- 表单字段必须具备可访问名称，必填项显示明确错误。
- 弹窗支持 `aria-modal`、Tab 焦点圈定、Escape 关闭和关闭后焦点恢复。
- 支持 `prefers-reduced-motion`。
- 看板按**自身容器宽度**响应（容器查询，而非视口）：≤ `980px` 时左栏收至 `248px`、右栏默认收起并以覆盖式抽屉展开；≤ `620px` 时左栏收至 `208px`。页面缩放或宿主侧栏变化时布局仍按可用宽度自适应。

## 配色

看板新界面（WorkbenchBoardPage）使用 `src/client/styles.ts` 的 `WORKBENCH_CSS`：在 `.dshw-board` 作用域内定义 `--bg-*`、`--text-*`、`--line`、`--accent`、`--ok/--warn/--err` 等 token，明暗两套由 `[data-theme="light"]` 切换。
项目详情与设置页仍使用 `src/client/palette.ts` 的 `PALETTE.light` / `PALETTE.dark` 生成 `--dshw-*` CSS 变量。

- 修改看板配色只需改 `WORKBENCH_CSS` 顶部的两组 token；改设置页/项目详情配色只需改 `PALETTE`。
- 看板主题由 `.dshw-board[data-theme]` 控制并持久化到 `dshw-board:theme`；项目详情/设置页跟随宿主 `dshw-dark` 类。
- 状态色、终端面板、Toast、阴影和焦点环同样来自配色表。
- 控件自身的配色由共享原语的 `--dsw-*` token 提供；`--dshw-*` 只负责看板自有布局、状态色和回落控件。

## 代码结构

客户端按职责拆分，`src/client.ts` 只负责宿主模块注册和 slot 接线：

```text
src/client.ts                 # factory、locale 注册、slots
src/client/
├─ ui.ts                      # 宿主 React 代理、h、useStyles
├─ context.ts                 # appCtx、token、请求、bindSession
├─ palette.ts                 # 项目详情/设置页明暗色板
├─ styles.ts                  # 项目详情/设置页 CSS + 看板 WORKBENCH_CSS
├─ i18n.ts                    # 直接引用 locale/*.json
├─ icons.ts
├─ format.ts                  # 时间、路径、文本、diff、复制、下载
├─ markdown.ts               # 报告共用的 Markdown 转义、占位符、时间戳、slug
├─ report.ts                  # 验收报告 Markdown 纯函数
├─ project-report.ts         # 项目验收报告 Markdown 纯函数
├─ staleness.ts              # 停滞任务判定（阈值、最近活动、停滞天数）
├─ search-query.ts            # 结构化搜索解析与匹配纯函数
├─ project-insights.ts        # 项目周期 / 吞吐 / 验收覆盖率纯函数
├─ task-lifecycle.ts          # 任务生命周期事件纯函数
├─ quick-prompts.ts           # 会话快捷指令文本与禁用原因
├─ timeline.ts                # 会话时间线与稳定 key
├─ status.ts                  # 状态到 tone / 文案的映射
├─ primitives.ts              # 原语适配器（Button/Tag/StateDot/Input/Checkbox/Modal/Toast）
├─ hooks.ts                   # useBranchInfo、useToast
├─ board-data.ts              # 项目/任务视图派生
├─ merge-preview.ts           # 合并预检控制器
├─ project-detail.ts          # 项目详情（Stage 中显示）
├─ settings-page.ts
├─ board.ts                   # WorkbenchBoardPage、WorkbenchBoardIcon、数据轮询（按参考原型 1:1）
├─ rail.ts                    # 左栏：搜索/过滤/项目任务列表/主题
├─ stage.ts                   # 中栏：面包屑、标题、标签页、概览/会话/diff
├─ inspector.ts               # 右栏：合并预检、技术信息、生命周期
├─ publish.ts                 # 发布任务弹窗
├─ add-project.ts             # 新增项目弹窗
├─ actions.ts                 # 打开/创建会话、启动任务
└─ model.ts                   # 状态、CTA、过滤与格式化派生
```

宿主侧的 `src/task-meta.ts`（标签 / 优先级 / 截止日期）与 `src/task-deps.ts`（前置依赖校验与派生）不依赖 React，供宿主、客户端与测试共用。

约定：

- 宿主通过 `factory(require)` 注入 React，组件不要直接 `import React from 'react'`，统一从 `src/client/ui.ts` 读取代理。
- 看板新颜色/样式只改 `src/client/styles.ts`；项目详情与设置页只改 `src/client/palette.ts` 和 `src/client/styles.ts`。
- 新文案同时加入 `locale/en.json` 和 `locale/zh.json`，`src/client/i18n.ts` 不再维护第二份字典。
- 新请求统一走 `src/client/context.ts` 的 `getJson` / `post`，它们带 token 刷新和 12s 超时。
- 看板（`src/client/`）按参考原型自绘 `dshwd-*` 控件，操作结果用 `board.ts` 内的轻量 Toast 状态；项目详情和设置页沿用 `useToast` + `Toast`。
- 项目详情和设置页的控件走 `src/client/primitives.ts`：它转调宿主共享的 `@deepseek-ai/dsh-client-ui-primitives`。该模块在浏览器构建里保持 external，由 `factory(require)` 注入；宿主缺少它时自动回落到本地实现。

## HTTP API

前缀：`/dsh-worktree/api`，同源请求。

```text
POST session
GET  config
GET  recents
POST recents/clear
GET  branches?path=
GET  templates
POST templates/save
POST templates/delete
POST publish
GET  projects
POST projects/add
POST projects/update
POST projects/delete
GET  tasks
POST bind
POST task/checkout
POST task/back
POST task/merge
POST task/merge-preview
POST task/cleanup
POST task/delete
POST task/pin
POST task/meta
```

- `publish`、`projects/*`、`tasks`、`bind`、`bind/claim`、`bind/release`、`session/reset`、`recents`、`recents/clear`、`task/*`、`templates/save`、`templates/delete` 需要 `x-dsh-worktree-token`。
- `recents` 返回 `{ dirs }`，内容是绝对路径，因此和任务列表一样需要 token；`recents/clear` 返回 `{ ok: true }`。
- `bind/claim` 请求体 `{ id, owner }`，返回 `{ lease, expiresAt }`；已有未过期的占位时返回 409 `lease-held`，任务已绑定会话时返回 409 `task-bound`，任务不存在返回 404。`owner` 是客户端窗口标识，同一 owner 重试是幂等的。
- `bind` 可带 `lease`（`bind/claim` 拿到的那张）；租约不匹配返回 409 `lease-lost`，此时客户端不得把已经建好的会话挂到任务上。`bind/release` 请求体 `{ id, lease }`，用于放弃占位。
- `session/reset` 请求体 `{ id }` 是人工逃生口：宿主无法确认会话是否还在运行时，清掉绑定让任务重新可用（供 `session/disposed` 事件丢失或另一个窗口崩溃后使用）。
- `templates` 只读接口返回全部发布模板；保存与删除在 Store 的跨进程锁内读改写，响应始终是完整的 `{ templates }` 列表。
- `projects/update` 可带 `mergeGate: 'off' | 'criteria'`；其他取值返回 400。
- `task/pin` 请求体 `{ id, pinned }`，只写入展示字段 `pinnedAt`，不改变任务状态与 Git。
- `task/meta` 请求体 `{ id, tags?, priority?, notes?, dueAt?, dependsOn? }`：只处理实际出现的键，`tags: []` / `priority: 'normal'` / `notes: ''` / `dueAt: null` / `dependsOn: []` 才是清空；标签、备注、日期格式、依赖数量 / 自依赖 / 跨项目 / 循环依赖不合法时返回 400，任务不存在返回 404。
- `publish` 可带 `dueAt`（`YYYY-MM-DD` 或毫秒时间戳）；服务端归一到本地日历日零点，非法值返回 400。`dependsOn` 不在发布时接受，任务创建后在详情中维护。
- `session` 用于申请工作台 token；`config`、`recents`、`branches` 是本地查询接口。
- `cleanup` 可带 `force`、`deleteBranch`。
- `publish` 未传 `branchName` 时使用 Hash 命名规则。
- `publish` 可带 `parentId`：从已合并任务派生后续任务，校验前序任务已合并且其合并时的分支尖端在基线历史中；不满足时返回 400/404。
- `task/merge-preview` 使用 `git merge-tree --write-tree` 做无工作区副作用的合并预检，返回 `baseAhead`、`overlapFiles`、`conflictFiles`；Git 低于 2.38 时返回 `supported: false`，只提示文件重叠。

## 多窗口与并发安全

任务台账由多个 DSH 窗口共享，下面每条都是「宁可拒绝，也不猜」的显式约束。

### 台账写入

- 所有写入都在 `<stateDir>/.store.lock` 的跨进程锁内完成：`open(..., 'wx')` 原子创建 + owner token 校验，释放时只删除自己 token 对应的锁。等待超时不再「无锁照写」，而是抛 `StoreError`（HTTP 503），调用方看到的是明确失败。
- 等锁用 `Atomics.wait` 停放线程，不忙等烧 CPU。**已知边界**：Store 的公开 API 是同步的（宿主从同步路径调用），所以最长会阻塞事件循环 `lockWaitMs`（默认 2s），这是「保持同步 API + 绝不无锁写」的折中；锁内只做台账级的小读写。
- 崩溃留下的锁：`pid` 已死或时间戳超过 30s 才判定为 stale，用临时文件重命名接管，接管后再校验内容，不会删掉仍被人正常持有的锁。
- 写盘是「唯一临时文件 + rename」，失败重试 5 次后抛 `StoreError`（HTTP 500），不会退回「就地写一半」。读到坏文件时把原始字节另存为 `<file>.corrupt-<ts>`（每个进程每个文件只保留一份），并通过 `store.warnings()` 与日志报出，不会静默清空。

### 会话绑定与 Agent 状态

- 绑定分两步：先 `bind/claim` 原子占位（租约默认 60s），再创建会话、发 prompt，最后带租约 `bind`。第二个窗口拿不到占位就不能开工；租约被接手后原窗口 `bind` 得到 409 `lease-lost`，客户端会删掉自己刚建的会话。
- 会话必须建在任务的 worktree 上：`session.create` 回报的 `cwd` 与 `task.worktreePath` 不一致时，先丢弃该会话再退回 `{ cwd }` 创建；仍不一致则直接失败，不会悄悄在主仓库里开发。
- Agent 状态是**三态**：`running` / `idle` / `unknown`。看不到某个会话的 Agent **不等于**它没在跑——运行它的窗口可能是另一个 DSH 进程。因此合并、切分支、清理、删除任务/项目在状态不确定时一律拒绝（409 `agent-unknown`），并给出「结束会话 / 在运行它的窗口确认空闲 / 解除会话绑定」的恢复指引。
- 跨实例可见性靠每个进程的心跳文件（`<stateDir>/instances/<instanceId>.json`，每 3s 一次，含 `pid`、`host`、`running[]`）。会话结束（`session/disposed`）、手动解除绑定、成功绑定都会立刻广播，不用等心跳周期。
- 恢复路径：
  - 正常结束会话 → 事件清掉绑定；
  - 窗口崩溃 → 心跳超过 30s 或 `pid` 已消失即视为死亡，不再阻塞；
  - 仍无法确认（对端刚崩，或对端是旧版本不带 `running`）→ 人工 `session/reset` 清绑定，之后可正常合并。
- 绑定、解除、接管都在同一把台账锁内完成并记录 `sessionOwner`（`instanceId` + `pid`），所以「哪个窗口拥有这个会话」是可审计的事实，不需要猜。

### 删除与发布

- `projects/delete` 与 `task/delete` 走同一套门禁：仓库锁 → 主仓库无未完成 git 操作（409 `repo-in-progress`）→ 每个任务 Agent 空闲 → 不在验收/切换状态 → 无未处理 stash。
- worktree 逐个删除并记账：部分失败时保留失败任务的记录（避免台账指向已删除目录），返回 409 `partial-delete` 并列出失败项；修好后重试同一调用即可收尾。
- 发布时若目标目录已被占用（残留目录或手工拷贝），改用同名前缀加随机后缀的兄弟目录；`git worktree add` 失败时只清理刚建的空壳目录，然后如实报错。

## 模型工具

```text
worktree_projects {}
worktree_publish { repository, base_branch?, title, task, branch_name?, parent_id?, start?, tags?, priority?, due_at? }
worktree_tasks   {}
worktree_act     { id, action, force?, delete_branch?, tags?, priority?, notes?, due_at?, depends_on? }
```

`worktree_projects` 列出已登记的项目（仓库路径、默认基线分支、任务数与状态分布），`worktree_publish` 的 `project_id` 就取自这里。

`due_at` 接受 `YYYY-MM-DD` 或毫秒时间戳，写入时统一归一到本地日历日零点；`worktree_act` 的 `meta` 动作传 `null` 或空串清除。

`worktree_act.action` 取值：

```text
checkout | back | merge | cleanup | delete | pin | unpin | meta
```

## 配置

Host 配置位于 `cordis.patch.yml`：

```yaml
- insert:
    - id: deepseek-worktree
      name: '@5318vo/dsh-worktree'
      config:
        dirName: "~/.dsh/worktrees"
        branchPrefix: dsh-wt/
        gitPath: git
```

`dirName` 支持两种模式：

- `~` 或绝对路径（默认 `~/.dsh/worktrees`）：worktree 放在仓库外，路径为 `<根目录>/<项目名>/<id8>`，与 T3 Code 的布局一致；不会写 `.git/info/exclude`。
- 相对路径（例如旧的 `.dsh-worktrees`）：保持原有仓库内布局 `<repo>/<dirName>/<id8>`，并幂等写入 `.git/info/exclude`。

项目级设置可以覆盖 `dirName` 和 `branchPrefix`。修改默认值只影响此后发布的任务，已有任务的绝对 worktree 路径不变。

项目、任务和最近目录统一保存在：

```text
~/.dsh/worktree-tasks
```

该目录与 DSH profile、`dsh web` 端口无关。同一台机器上的多个 DSH 实例会读取同一份任务台账，并通过 `.store.lock` 做读改写，避免一个端口看不到另一个端口新建的项目或任务。

首次加载新版本时会迁移旧的 profile 目录和 `DSH_WORKTREE_STATE_DIR` 目录，迁移完成后写入 `.migrated-v2` 标记；旧目录保留，不再重复导入。相同 `repoPath` 的重复项目会自动合并到任务历史最多的那个项目。

发布任务使用同步提交锁；UI 发布由客户端绑定会话，HTTP 发布不会触发工作台自动绑定，避免重复创建同一任务的会话。

## 构建与安装

```bash
npm install
npm run typecheck
npm run build
```

产物：

```text
dist/index.js    Host 插件
dist/client.js   Web 客户端
```

客户端源码在 `src/client/`，构建时由 esbuild 统一打包进 `dist/client.js`；`locale/*.json` 同时供客户端与宿主使用。

在 DSH Web 中通过 Plugins → 安装外部 bundle，源可以是 npm 包名或本地路径：

```text
@5318vo/dsh-worktree
```

或本地开发路径：

```text
C:\Users\liang\dsh-worktree
```

未开启 HMR 时，需要重启 DSH 或重新加载页面。

## 发布

公共 npm 包名为 `@5318vo/dsh-worktree`，`publishConfig.access` 已设为 `public`。

### 打 tag 自动发布（推荐）

仓库自带 `.github/workflows/publish.yml`：推送 `v*` tag 后自动在 GitHub Actions 里跑 `npm ci` → tag 与 `package.json` 版本校验 → `npm run verify` → `npm publish --provenance`。

```bash
npm version patch   # 或 minor / major，同时生成 vX.Y.Z tag 和版本提交
git push --follow-tags
```

- 发布前需在仓库 Settings → Secrets and variables → Actions 里配置 `NPM_TOKEN`：npm 上的 **Granular Access Token**，Packages 权限选 `@5318vo/dsh-worktree` 的 **Read and write**；若账号开了 2FA，token 必须是可绕过 OTP 的类型（Granular 默认支持，Classic 需选 Automation）。
- tag 与 `package.json` 版本不一致会直接失败，不会误发。
- 也可在 Actions 里手动 `Publish to npm` → Run workflow，默认 **dry-run**（只校验 tarball，不上传），把 `dry_run` 改成 false 才会真正发布。
- `--provenance` 依赖公开仓库 + `id-token: write`，npm 页面会显示构建来源；仓库若转私有需去掉该参数。

### 本地手动发布

```bash
npm login
npm run typecheck
npm run pack:check   # 预览 tarball 内容
npm run publish:dry  # 发布 dry-run
npm publish
```

- `prepublishOnly` 会在发布前执行 `typecheck` 和 `build`。
- 发布内容由 `files` 白名单控制：`dist`、`cordis.patch.yml`、`locale`、`icon.svg`、`README.md`、`CHANGELOG.md`、`LICENSE`。
- 包名变更时需同步 `cordis.patch.yml` 和 `src/client.ts` 的 `MODULE_ID`。

## 自动化测试

仓库内置一套基于 Node 内置测试运行器（`node --test`）的自动化测试，用于在每次改动后回归主流程，避免「新建任务后无法执行」或出现未捕获异常。

```bash
npm install
npm test            # 构建测试产物并运行全部用例
npm run typecheck   # 源码类型检查
npm run build       # 生产构建
```

- 测试源码位于 `test/**/*.test.ts`，由 `scripts/test.mjs` 用 esbuild（与生产构建同一工具）打包到 `.test-dist/` 后执行，无需额外的测试依赖。
- 用例分层：
  - 纯逻辑单元测试：`config`、`store`、状态推导 `statusOf`，以及客户端 `format` / `report` / `timeline` / `status`。
  - 客户端主流程：`bindSession` 创建会话、发送首条指令并绑定任务；首条指令或会话创建失败时**不落库绑定**，保证任务仍可重新启动。
  - Git 生命周期集成测试（真实临时仓库）：发布（worktree + hash 分支）、绑定、状态推导、验收切换/切回、合并、清理与分支删除。
  - HTTP 端到端：启动真实 host 插件并捕获路由，用带 token 的请求走完 发布 → 绑定 → 提交 → 合并 → 清理 全链路，同时覆盖 403 / 400 / 404 等错误分支。
  - 冒烟测试：`apply()` 能注册全部模型工具和 HTTP 路由，客户端 `factory().apply()` 能注册全部 slot，加载不抛异常。
- 集成/冒烟测试通过 `bootHost(..., { stateDir })` 注入临时 `Store`，任务台账写到临时目录，测试结束随临时根目录一起删除，**不会**污染真实的 `~/.dsh/worktree-tasks`（`state-isolation.test.ts` 对此有回归保护）。
- 建议在 CI 或提交前执行 `npm test`；新增功能时补充对应用例，尤其覆盖任务发布与执行链路。

## 开发验证

本次版本已实际验证：

- `npm run typecheck`
- `npm run build`
- the agent harness Web 中加载 Worktree 工作台
- 三栏布局、左右栏折叠和 980px 以下右栏抽屉
- 工作台搜索过滤、无结果空状态和清除搜索
- 项目概览统计与待处理提示
- 新增项目弹窗：目录选择单次触发、分支必填、加载中禁止提交、历史目录已移除
- 任务详情：任务摘要、实时会话时间线（思考 / 工具调用 / 工具结果 / 助手输出）、验收禁用原因、Worktree/主仓库信息
- 清理 worktree、删除记录及确认弹窗
- 分支 Hash 命名：中文标题创建任务实际得到 `dsh-wt/<id8>`
- 中文自定义分支名返回 `400`
- 弹窗焦点、必填校验和 Escape 关闭
- 临时任务创建、清理、分支删除和记录删除

当前已包含自动化测试套件（见上文「自动化测试」），浏览器交互测试用于补充视觉与可访问性验收。

本次结构重构后额外验证：

- `npm run typecheck`
- `npm run build`
- React SSR 渲染冒烟：任务详情、项目详情、设置页、新增项目弹窗、发布任务弹窗、看板页和侧栏图标均通过
- 时间线稳定 key 检查：追加新事件后旧行 ID 不变
- 构建产物 slot 注册检查：`settings.section`、`sidebar.panellist`、`main`
- `dsh web` + 浏览器验证：勾选「创建后立即开始」的发布实际执行首条指令并产生提交；空会话任务显示「启动任务」


## 设计要点

- 验收采用 detached HEAD：切到验收时主仓库停在任务分支当时的提交（记录在 `reviewSha`），不在任务分支上，因此不受「任务分支已被 worktree 检出」影响，也不需要 `--ignore-other-worktrees`。验收固定的是这个 SHA，期间任务分支的新提交不会改变正在验收的内容；「返回原分支」按记录的原引用恢复。
- `checkout`、`merge`、`back` 前拒绝主仓库中已跟踪文件的未提交改动；未跟踪文件不再阻止操作，真实冲突仍由 `git` 拒绝。清理 worktree 时仍统计未跟踪文件。
- `checkout` 会记录 `originalBranch`，供验收后切回。
- 默认 worktree 位于仓库外：`~/.dsh/worktrees/<项目名>/<id8>`；项目名会被规范成安全的单层目录名。配置为相对目录名时使用 `<repo>/<dirName>/<id8>`，并幂等写入 `.git/info/exclude` 的 `/<dirName>/`。
- 会话被删除后，host 通过 `session/disposed` 解绑，看板可重新创建会话，不会自动重启旧会话。
- 插件不接管会话内容，Agent 的审批、追问和中止继续均使用 DSH 原生能力。
- 截止日期按本地日历日存储（本地零点毫秒）；跨时区使用同一台账时日期可能相差一天，这是「按本地日历」语义的已知边界。
- 前置任务依赖是建议性关系：只影响详情与左栏提示，不阻止合并、清理或会话操作，也不参与排序。
- 项目洞察与生命周期时间线都是纯派生视图，不写任务记录；异常时间戳会被忽略或钳制，不会出现负周期。

## 已知限制

- 工作台的项目、任务选择和筛选只保存在插件状态里，没有写进 URL。宿主刷新页面会回到新会话首页，需要重新打开「Worktree 任务」再找回任务；这是宿主的插件路由限制，插件侧无法拦截刷新，重启后也没有可恢复的入口。
