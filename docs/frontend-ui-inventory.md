# dsh-worktree 前端 UI 结构化清单

`@5318vo/dsh-worktree` · 基于 `src/client/*.ts`、`src/client.ts`、`locale/zh.json`、`locale/en.json` 整理。

> 约定：**文案 / 语义 key** 一栏中，括号内是 `locale/*.json` 的 key（如 `publish` = 发布任务 / Publish task）。所有可见文案均来自 locale，不在组件内硬编码。布局规则见第 7 节与各页「布局」说明。

## 0. 页面与挂载点总览

| # | 页面 / 界面 | 宿主挂载点 | 组件 |
| --- | --- | --- | --- |
| 1 | 工作台（Worktree 任务） | `main` slot（key=worktree-board） | BoardPage |
| 2 | 侧栏入口图标 | `sidebar.panellist`（id=worktree-board） | BoardIcon |
| 3 | 设置页 | `settings.section`（id=deepseek-worktree-settings） | SettingsPage |

工作台内部再由右侧详情容器路由到「任务详情」「项目详情」；共 9 个弹窗。

## 1. 工作台 · 左侧项目树（Worktree 任务）

**路由 / 入口**：宿主 main slot → BoardPage（左栏）

**布局**：

- 主布局 CSS Grid：grid-template-columns: 320px minmax(0, 1fr)；左栏固定 320px，右栏自适应。
- 左栏自身为纵向三段：header（搜索 + 工具按钮）/ scroll（项目与任务树，独立滚动）/ footer（统计 + worktree 标签）。
- 容器宽度 ≤860px：左栏收窄到 268px；≤620px：单栏，列表与详情二选一（详情出现返回条）。
- 行结构：项目行=折叠按钮 + 主体按钮 + 发布按钮；任务行=主选择按钮 + 打开会话按钮（+ 终态归档按钮）。

### 头部区（tree-head）

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 搜索框 | 输入框 input[type=search] | 占位符：搜索项目、任务或分支（search） | 输入即实时过滤：项目名、仓库路径、任务标题、分支名、待处理状态；按 `/` 或 Ctrl/Cmd+K 聚焦（仅当焦点在插件内）；Esc 清空 | 无提交按钮；空结果切到「没有匹配的项目」空态 |
| 刷新按钮 | 图标按钮 IconBtn（refresh） | aria-label / title：刷新（refresh） | 点击手动刷新；执行中显示旋转 Spinner；完成后 Toast「已刷新任务状态」（refreshed） | 刷新中禁用 |
| 显示/隐藏已归档切换 | 图标按钮 IconBtn（archive） | 显示已归档 / 隐藏已归档（showArchived / hideArchived）；title：已归档 {n} 个任务，点击切换显示（archiveToggleTitle） | 切换左侧列表是否显示已归档任务；aria-pressed 同步 | 仅当存在已归档任务时出现 |
| 新增项目按钮 | 图标按钮 IconBtn（plus） | aria-label / title：新增项目（addProject） | 打开「新增项目」弹窗 | 常驻 |

### 连接 / 错误状态条

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 断线重连条 | 状态条 role=status | 「重新连接中…」（reconnecting；注：该 key 在 locale/zh.json、en.json 中缺失，实际会回退为空） | 轮询自动恢复；提供「重试」（retry）链接 | 已有项目且刷新失败时 |
| 加载失败提示 | 错误提示 role=alert | 错误文案：连接已断开，请重试，或从 DSH 启动地址重新打开工作台。（connectionLost）／加载失败（loadFailed） | 「重试」（retry）重新拉取；「重新加载」（reload）整页刷新 | 无项目且刷新失败时 |

### 项目行（项目树节点）

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 折叠按钮 | 按钮 project-toggle | aria-label：展开 / 折叠：{项目名}（expand / collapse） | 展开或收起该项目的任务列表；aria-expanded 同步 | 搜索态自动全部展开 |
| 项目主体按钮 | 按钮 project-select | 内容：文件夹色块（四色循环）+ 项目名 + 任务数；title=仓库路径 | 点击选中项目，右侧切到项目详情 | 选中时整行高亮；折叠时仍显示 |
| 发布任务按钮 | 图标按钮 project-add（plus） | title / aria-label：发布任务（addTask）：{项目名} | 打开该项目的「发布任务」弹窗并选中该项目 | 常驻 |

### 任务行

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 任务主选择按钮 | 按钮 task-select | 状态圆点 + 任务标题 + 元信息区；title=完整标题 | 点击选中任务，右侧切到任务详情 | 圆点/文字颜色见状态色 |
| · 状态 chip | Chip | 待开始（ready）/ 进行中（developing）/ 验收中（reviewing）/ 待验收（review）/已合并（merged）/ 已清理（cleaned）/ 异常（broken） | 只读 | 由 Git + 会话状态推导（resolveStatus） |
| · 待处理 chip | Chip warn | 待审批（pendingApproval）/ 计划待审（pendingPlanReview）/ 待回答（pendingQuestion） | 只读 | 会话有待处理交互时 |
| · 已归档 chip | Chip neutral | 已归档（archived） | 只读 | 任务已归档 |
| · 合并后新增提交 chip | Chip warn | 已合并 · 之后有 {n} 个新提交（postMergeBadge） | 只读 | 合并后分支又有新提交 |
| · 会话健康 chip | Chip warn / error | 会话中断（sessionInterrupted）/ 会话异常（sessionError） | 只读 | 最近一轮 turn/end 为 interrupted / error\|failed 且当前未运行 |
| · 领先提交数 | 文本 | ↑ {n}（title：{n} 个领先提交 commitsAhead） | 只读 | ahead > 0 |
| · 未提交改动数 | 文本 | ±{n}（title：{n} 处未提交改动 dirty） | 只读 | dirtyCount > 0 |
| 打开会话按钮 | 图标按钮 task-open（external） | title / aria-label：打开会话（openSessionBtn）：{标题}；无会话显示：未创建会话（noSession） | 调用原生 uiWorkspace.openSession 打开会话；失败 Toast「无法打开会话」（openSessionFailed） | 无会话时禁用 |
| 归档 / 取消归档按钮 | 图标按钮（archive / archiveRestore） | title / aria-label：归档（archive）/ 取消归档（unarchive）：{标题} | 直接归档或恢复；成功 Toast「任务已归档 / 已取消归档」 | 仅 merged / cleaned 终态任务；处理中显示 Spinner |

### 空 / 加载状态

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 加载骨架屏 | 骨架占位（aria-hidden） | 无文字 | 首屏加载时显示 | loaded=false |
| 无项目空态 | 空状态 Empty | 标题：暂无项目（noProjects）；说明：选择一个 Git 仓库，开始发布 worktree 任务。（noProjectsHint）；按钮：新增项目（addProject） | 点击按钮打开「新增项目」弹窗 | 无任何项目 |
| 搜索无结果空态 | 空状态 Empty | 标题：没有匹配的项目（noMatch）；说明：换个关键词，或清除搜索查看全部项目。（noMatchHint）；按钮：清除搜索（clearSearch） | 清除搜索词并恢复全部项目 | 有项目但过滤结果为空 |
| 项目下无任务 | 内联空态 | 暂无任务（noTasks）；链接：发布任务（addTask） | 点击链接打开发布弹窗 | 展开的项目无任务；搜索态不显示该链接 |

### 底部栏（tree-foot）

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 统计文本 | 文本 | {项目数} 个项目 · {任务数} 个任务（projectUnit / taskUnit） | 只读 | 常驻 |
| 标签 | 文本 | worktree | 只读 | 常驻 |

## 2. 工作台 · 右侧详情容器（detail）

**路由 / 入口**：宿主 main slot → BoardPage（右栏）

**布局**：

- 右栏为 main.dshw-detail，内部 .dshw-detail-scroll 独立滚动；内容套在 .dshw-detail-inner 内并限制 960px 阅读宽度。
- 切换任务/项目时详情滚动位置回到顶部。
- ≤620px 容器：单栏模式，列表与详情二选一；选中项时顶部出现「返回项目列表」横条。
- 路由：有选中任务 → 任务详情；否则有选中项目 → 项目详情；否则空态。

### 容器与路由

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 详情滚动容器 | main > .dshw-detail-scroll > .dshw-detail-inner | 内容宽度上限 960px | 独立滚动；切换选中项时回到顶部 | 常驻 |
| 移动端返回条 | 横条 + 按钮 sm（arrowLeft） | 返回项目列表（backToList） | 返回左侧列表（隐藏详情） | 仅窄屏单栏且存在选中项时 |
| 空态 | 空状态 Empty（file） | 未选择任务（selectTask） | 只读 | 无任务且无项目选中 |

## 3. 任务详情（TaskDetail）

**路由 / 入口**：右栏（BoardPage 渲染 TaskDetail）

**布局**：

- 纵向堆叠的卡片流：Hero → 验收标准 → 横幅（未开始/待处理/健康/预览/合并后/同步失败）→ 实时会话 → 改动文件 → 会话信息 → 任务关系 → 验收操作 → Worktree/主仓库 → 归档 → 危险操作。
- Hero 为两列：左侧面包屑/标题/描述/元信息，右侧主操作 + 最近活动；窄屏换行。
- 实时会话为卡片：顶栏（模型/统计/token）+ 左右两栏（日志主区 + 侧栏执行清单/上下文）；≤1100px 侧栏移到日志下方。
- 改动文件、Worktree/主仓库、验收操作等均使用卡片 + 键值行；≤420px 键值行改为上下排列。

### 3.1 顶部 Hero 卡

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 面包屑 | 文本（folder 图标） | 项目名 / 分支名（无项目时用仓库路径） | 只读 | 常驻 |
| 任务标题 | h1 | {任务标题} | 只读 | 常驻 |
| 任务描述 | 段落 | {任务描述} | 只读 | 有描述时 |
| 元信息胶囊 | Chip / pill | 状态 chip、待处理 chip、已归档 chip、合并预览 chip（预计冲突 / 基线更新）、↑{n} 领先提交、±{n} 未提交改动 | 只读 | 按数据出现 |
| 主操作（primary） | 按钮 lg primary | 按状态：基于此任务继续（continueTask）／已清理（cleaned，禁用）／启动任务（startTask→startingTask）／打开会话（openSessionBtn）／创建会话（createSession→creatingSession） | 点击执行对应动作（打开/创建会话、启动任务、继续建任务） | 唯一视觉主操作；见状态判定 |
| 次操作（续做任务） | 按钮 lg | 打开会话（openSessionBtn） | 打开原生会话 | 「基于此任务继续」为主操作且有会话时 |
| 最近活动 | 文本 hint | 最近活动 · {相对时间}（lastActivity；刚刚/ {n} 分钟前 / {n} 小时前 / {n} 天前，>7 天显示 M/D HH:mm） | 只读 | 有 sessionId 与 updatedAt |
| 错误条 | 错误提示 role=alert | {错误信息}（操作失败 failed） | 只读 | 操作失败 |

### 3.2 验收期间的暂存卡（reviewStash）

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 卡头 | CardHead（archive） | 验收期间的暂存（reviewStashTitle） | 只读 | task.reviewStash 存在时（切回分支时自动暂存了未提交改动） |
| 说明 | 文本 hint | 切回分支时暂存了未提交改动（{ref}）。可以恢复到当前分支或丢弃。（reviewStashNotice） | 只读 | 常驻 |
| 恢复到当前分支 | 按钮（archiveRestore） | 恢复到当前分支（reviewStashApply） | apply 暂存；成功 Toast「已恢复暂存」（reviewStashApplied） | 处理中禁用 |
| 丢弃暂存 | 按钮 danger（trash） | 丢弃暂存（reviewStashDrop） | drop 暂存；成功 Toast「已丢弃暂存」（reviewStashDropped） | 处理中禁用 |

### 3.3 验收标准卡

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 卡头 | CardHead（checkCircle） | 验收标准（acceptanceCriteria） | 只读 | 任务含验收标准 |
| 标准列表 | ul | 每条：勾图标 + 文本 | 只读 | 常驻 |

### 3.4 横幅 / 提示区

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 未开始横幅 | Banner warn | 标题：会话尚未开始（taskNotStarted）；说明：任务已创建，但第一条指令没有执行。点击开始继续。（taskNotStartedHint） | 主操作因此变为「启动任务」 | 已绑定但会话为空（blank）且未运行 |
| 待处理横幅 | Banner warn | 标题：待审批 / 计划待审 / 待回答；说明：会话正在等待你的处理，打开会话后可以继续执行。（pendingHint）；按钮：去处理（handlePending） | 点击打开会话 | 存在待处理交互 |
| 会话健康横幅 | Banner warn / error | 标题：会话中断 / 会话异常；说明：sessionInterruptedHint / sessionErrorHint 或错误消息；按钮：去处理（handlePending） | 打开会话 | 最近一轮 interrupted / error 且未运行 |
| 合并预览横幅 | Banner warn / error | 标题：基线有更新（mergePreviewOverlapTitle）/ 预计无法自动合并（mergePreviewConflictTitle）；说明 + 文件列表；按钮：让 Agent 同步基线（syncBaseline→syncingBaseline） | 向当前会话发送同步基线指令（无会话禁用） | 基线领先且存在重叠 / 冲突 |
| 合并后新增提交横幅 | Banner warn | 标题：已合并 · 之后有 {n} 个新提交（postMergeTitle）；说明：postMergeHint；按钮：再次合并（mergeAgain）+ 基于此任务继续（continueTask） | 再次合并打开合并弹窗 / 继续打开发布弹窗 | postMergeAhead > 0 |
| 状态同步失败横幅 | Banner error | 标题：状态同步失败（statusSyncFailed）+ 错误；按钮：重试（retry） | 重新拉取状态 | snap.error 存在 |

### 3.5 实时会话卡（LiveCard）

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 卡头 | CardHead（terminal） | 标题：实时会话（liveSession）；右侧状态：待处理 / 工作中 / 空闲（pendingLabel / sessionRunning / sessionIdle）+ 状态圆点 | 只读 | 有会话时显示状态 |
| 未创建会话空态 | 空状态 | 「未创建会话」（noSession）+「创建后会在这里显示实时对话、执行清单和上下文占用。」（noSessionHint） | 只读 | 无 sessionId |
| 控制台顶栏 | 文本 | {模型} / {轮次·步数 liveStats 或 步数 liveStepsOnly}；右侧 token：输入 / 输出（liveTokensIn / liveTokensOut） | 只读 | 控制台常驻 |
| 日志行（每步） | details / summary | 序号 + 类型标签 + 标题 + 变更统计（+N -M）+ 状态（已完成/执行失败/执行中 stepDone/stepFailed/stepRunning）+ 展开箭头 | 点击行展开完整内容；日志自动滚到底，用户上滚后暂停自动跟随 | 有对话时 |
| · 类型标签 | 文本 | 你（roleUser）/ 助手（roleAssistant）/ 思考（roleThinking，标题显示「持续了 {时长}」duration） | 只读 | 按消息类型 |
| · 工具标签 | 文本 | 终端 toolTerminal / 读取 toolRead / 编辑 toolEdit / 查找 toolFind / 切换目录 toolCd / 清单 toolTodos / 提问 toolQuestion / 工具 toolGeneric | 只读 | 按工具名映射 |
| · 工具结果摘要 | 文本 | 读取完成 · {行} 行 · {字符} 字符（resultRead）/ 匹配 {n} 个文件（resultMatch）/ 写入完成（resultWrite）/ 内容：{n} 字符（contentSize） | 只读 | 工具结果 |
| 无对话 | 文本 | 还没有对话记录（noTurns） | 只读 | entries 为空 |
| 执行清单侧栏 | 列表 | 标题：执行清单（liveTodos）；每项勾/圈图标 + 内容；最多 10 条 | 只读 | 有 todos |
| 上下文侧栏 | 进度条 | 标题：上下文（livePressure）；百分比 + 缓存读（liveTokensCache） | 只读 | 常驻 |

### 3.6 改动文件卡（DiffCard）

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 卡头 | CardHead（file） | 标题：改动文件（changedFiles）；右侧：{n} 个文件（diffFiles）+ +新增/-删除 汇总；按钮：全部展开/全部折叠（expandAll/collapseAll）、复制 diff（copyDiff）、刷新（refresh） | 展开/折叠所有文件；复制 diff；刷新重新拉取（加载中 Spinner） | 仅 review / reviewing / 合并后新增提交时显示 |
| 文件行 | 按钮 diff-file-head | 状态字母 chip（A 增 / M 改 / D 删 / R 重命名 / U 未跟踪）+ 路径（重命名显示 ← 原路径）+ +N -M（二进制显示「二进制文件」diffBinary）+ 展开箭头 | 点击展开该文件 unified diff；≤5 个文件时默认全部展开 | 有改动文件 |
| 状态文案 | 文本 / 提示 | 正在加载改动…（diffLoading）/ 错误（role=alert）/ 无法获取改动：{原因}（diffUnavailable + diffReasonMissing / diffReasonNoBase / diffReasonError）/ 相对基线分支没有改动。（diffEmpty）/ 改动较大，仅显示部分内容。（diffTruncated） | 只读 | 按加载 / 错误 / 空 / 截断状态 |

### 3.7 会话信息卡

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 卡头 | CardHead（message） | 会话信息（sessionInfo） | 只读 | 有 sessionId |
| 会话 ID 行 | KV + 复制按钮 | 会话 ID（sessionId）+ 复制会话 ID（copySessionId） | 点击复制；Toast「已复制 / 复制失败」 | 常驻 |
| 工作目录行 | KV + chip + 复制按钮 | 工作目录（liveCwd）+ 复制 worktree 路径（copyWorktree）；不一致时 chip「尚未切换到 worktree」（liveCwdOff） | 点击复制 | 常驻 |

### 3.8 任务关系卡

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 卡头 | CardHead（branch） | 任务关系（relatedTasks） | 只读 | 有前序或后续任务 |
| 关联前序任务 | KV + 链接按钮 | 关联前序任务（parentTask）+ 前序标题（点击跳转）+ 状态 chip | 点击跳转到前序任务详情 | 存在 parentId |
| 后续任务 | KV + 链接按钮 | 后续任务（followUps）+ 各后续标题 + 状态 chip | 点击跳转 | 存在后续任务 |

### 3.9 验收操作卡

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 卡头 | CardHead（checkCircle） | 标题：验收操作（acceptance）；右侧：主仓库 · {基线分支} | 只读 | 存在任一验收动作 |
| 切到任务分支验收 | 按钮（branch） | 切到任务分支验收（checkout） | 先请求 checkout 预检：安全则直接切换；主仓库有未提交改动时弹出「切换分支冲突处理」弹窗（暂存 / 放弃后切换） | 按条件显示 / 禁用 |
| 切回原分支 / 切到基线分支 | 按钮（arrowLeft） | 切回原分支（back）/ 切到基线分支（switchToBase） | 先请求 back 预检：安全则直接切换；有未提交改动时弹出「切换分支冲突处理」弹窗 | 主仓库当前检出任务分支时显示 |
| 合并回基线 / 切到基线分支并合并 | 按钮（merge） | 合并回基线（merge）/ 切到基线分支并合并（mergeSwitchToBase） | 打开合并确认弹窗 | 按条件显示 / 禁用 |
| 禁用原因列表 | 文本 role=status | 见「验收禁用原因」集合；部分带「切到该任务」（acceptReviewOther）按钮 | 只读 / 可跳转 | 按钮不可用时展示原因 |

### 3.10 Worktree / 主仓库卡

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 卡头 | CardHead（branch） | 标题：Worktree / 主仓库；异常时右侧 chip：异常 / 分支不存在 | 只读 | 常驻 |
| Worktree 分区 | 分区标签 + KV | 路径（path）+ 复制 worktree 路径；当前分支（currentBranch）+ 复制分支名；已清理时显示「worktree 目录已删除，此路径仅作记录。」（worktreeRemovedHint） | 复制 | 常驻 |
| 主仓库分区 | 分区标签 + KV | 仓库路径（repoPath）+ 复制仓库路径；当前分支（currentBranch）；验收前分支（originalBranch）；未提交改动（uncommitted） | 复制 | 常驻 |
| 状态 chip | Chip | 工作区干净（clean）/ 已清理（cleaned）/ 异常（broken）/ 已合并进基线（mergedFlag）/ 分支不存在（branchMissing） | 只读 | 按 worktree 状态 |

### 3.11 归档卡

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 卡头 | CardHead（archive） | 标题：归档（archiveSection）+ 已归档 chip | 只读 | merged / cleaned 任务 |
| 说明 | 文本 | archiveHintOff / archiveHintOn | 只读 | 常驻 |
| 归档 / 取消归档按钮 | 按钮 | 归档（archive）/ 取消归档（unarchive） | 执行归档；Toast「任务已归档 / 已取消归档」 | 按归档状态切换 |

### 3.12 危险操作卡

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 卡头 | CardHead（alert, danger） | 危险操作（dangerZone） | 只读 | 常驻 |
| 说明 | 文本 | cleanupHint | 只读 | 常驻 |
| 清理 worktree | 按钮 danger（trash） | 清理 worktree（cleanup）；已清理时显示「已清理」（cleaned）且禁用 | 打开清理弹窗 | cleaned 时禁用 |
| 删除记录 | 按钮 danger（xCircle） | 删除记录（deleteRecord） | 打开删除任务弹窗 | 常驻 |

### 验收禁用原因（按钮下方文案）

| key | 文案 | 附带动作 |
| --- | --- | --- |
| acceptBusy | 正在执行：{action} | — |
| acceptanceHintMerged | 任务已合并进基线，可以清理 worktree。 | — |
| acceptanceHintBroken / snap.error | worktree 状态异常，修复后再执行验收操作。 | — |
| acceptNoCommits | 还没有可验收的提交 | — |
| acceptWorktreeDirtyCommit | worktree 有 {n} 处未提交改动，请先让 Agent 提交 | — |
| acceptInProgress | 主仓库有未完成的合并或变基，请先处理 | — |
| acceptOtherReviewing | 任务「{task}」正在验收，请先切回 | 切到该任务（acceptReviewOther） |
| acceptAgentRunning | Agent 正在运行，请等本轮结束再操作 | — |
| acceptMergeReviewing | 请先切回原分支再合并 | — |
| acceptNotOnBase | 主仓库当前在 {branch} 分支，请先切到基线分支 | — |
| acceptanceHintDirty | worktree 有 {n} 处未提交改动，合并与切换前需要先提交或暂存。 | — |
| acceptanceHintRepoDirty（合并时） | 主仓库有 {n} 处未提交改动，切换分支前需要先提交或暂存。 | — |
| mergePreviewConflictHint | 基线有新提交，且与任务改动存在冲突。建议先让 Agent 同步基线。 | 让 Agent 同步基线 |
| mergePreviewChecking | 正在预检冲突… | — |
| mergePrecheckBlocked | 无法完成合并前冲突预检，已阻止合并；请重试或升级 Git。 | — |

## 4. 项目详情（ProjectDetail）

**路由 / 入口**：左侧项目主体按钮 / 选中项目时（右栏）

**布局**：

- 纵向卡片流：页头 → 概览卡（4 统计 + 待处理提示 + 键值）→ 项目设置卡（表单）→ 删除项目卡。
- 页头为横向：图标 + 标题/副信息 + 右侧操作（发布任务 + 更多操作菜单）。
- 概览统计 4 卡网格；≤700px 容器变为两列。

### 页头（page-head）

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 图标 + 项目名 | 文本（folder 图标） | 项目名（h1） | 只读 | 常驻 |
| 仓库路径 | 文本 + 复制按钮 | 仓库路径 + 复制仓库路径（copyRepoPath） | 点击复制；Toast 已复制/复制失败 | 常驻 |
| 任务数 | 文本 | · {n} 个任务（taskUnit） | 只读 | 常驻 |
| 发布任务按钮 | 按钮（play） | 发布任务（publish） | 打开该项目发布任务弹窗 | 常驻 |
| 更多操作菜单 | details/summary（more） | aria-label / title：操作（operations） | 点击展开下拉菜单 | 常驻 |
| · 菜单项：发布任务 | MenuItem（plus） | 发布任务（publish） | 打开发布弹窗 | 菜单内 |
| · 菜单项：复制仓库路径 | MenuItem（copy） | 复制仓库路径（copyRepoPath） | 复制并 Toast | 菜单内 |
| · 菜单项：删除项目 | MenuItem（trash, danger） | 删除项目（deleteProject） | 打开删除项目弹窗 | 菜单内（分隔线之下） |

### 概览卡（overview）

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 卡头 | CardHead（grid） | 概览（overview）+ 右侧：按 Git 与会话状态推导（overviewHint） | 只读 | 常驻 |
| 统计卡 ×4 | Stat | 任务总数（totalTasks）/ 进行中（activeTasks）/ 待验收（reviewTasks）/ 已合并（mergedTasks） | 只读 | 常驻 |
| 待处理提示 | 行 + 链接 | {n} 个任务等待处理（attention）+ 查看（view） | 点击查看跳转首个待处理任务 | 有 pending 任务时 |
| 键值 | KV 列表 | 仓库路径（+复制）/ 默认基线分支（defaultBase）/ 分支前缀（branchPrefix, code）/ Worktree 目录（worktreeDirName, code） | 复制仓库路径 | 常驻 |

### 项目设置卡（project settings）

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 卡头 | CardHead（sliders） | 项目设置（projectSettings）+ 说明：覆盖全局的分支与 worktree 命名规则，只影响此后发布的任务。（projectSettingsHint） | 只读 | 常驻 |
| 项目名称 | 输入框 | 项目名称（projectName）+ 提示：只影响看板显示，不会改写仓库。（projectNameHint） | 编辑 | 必填（空提示 requiredField） |
| 默认基线分支 | BranchCombobox | 默认基线分支（defaultBase）+ 加载/失败提示 | 可搜索过滤 | — |
| 分支前缀 | 输入框 mono | 分支前缀（branchPrefix）+ 提示：自动分支为前缀加 8 位任务 ID。（branchPrefixHint） | 编辑 | 占位 dsh-wt/ |
| Worktree 目录 | 输入框 mono | Worktree 目录（worktreeDirName）+ 提示：相对仓库根目录，并写入 .git/info/exclude。（worktreeDirHint） | 编辑 | 占位 .dsh-worktrees |
| 保存 | 按钮 primary（submit） | 保存（save → saving） | 提交保存；成功右侧显示「已保存」（saved）约 3.2s | 保存中 Spinner + 禁用 |
| 错误提示 | role=alert | {err} | 只读 | 失败 |

### 删除项目卡

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 卡头 | CardHead（alert, danger） | 删除项目（deleteProject） | 只读 | 常驻 |
| 说明 | 文本 | 删除后，项目配置与任务记录会从工作台移除；仓库和提交不会被删除。（deleteProjectCardHint） | 只读 | 常驻 |
| 删除项目按钮 | 按钮 danger（trash） | 删除项目（deleteProject） | 打开删除项目弹窗 | 处理中禁用 |

## 5. 设置页（SettingsPage，settings.section）

**路由 / 入口**：宿主设置区 settings.section

**布局**：

- 外层可滚动（overflow:auto）；内容纵向卡片流：页头 → 验收标准库 → 最近目录 → 配置。
- 验收标准库：输入 + 添加按钮一行，下方列表逐行（勾图标 + 文本 + 移除按钮）。
- 最近目录：逐行（文件夹图标 + 路径 + 复制），底部危险行放置清空按钮。

### 页头

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 图标 + 标题 | 文本（settings 图标） | 标题：Worktree 任务（title）；说明：全局配置与最近使用的仓库目录。（settingsSub） | 只读 | 常驻 |

### 验收标准库卡

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 卡头 | CardHead（checkCircle） | 验收标准库（acceptanceLibrary）+ 说明：在这里维护可复用的验收标准；发布任务时可勾选，也可临时手动补充。（acceptanceLibraryHint） | 只读 | 常驻 |
| 添加行 | 输入框 + 按钮 | 输入占位：输入一条验收标准（criterionInputPlaceholder）；按钮：添加（addCriterion，primary） | Enter 或点添加提交；成功 Toast「已添加验收标准」 | 输入为空或处理中禁用 |
| 标准列表行 | 行 + 移除按钮 | 勾图标 + 文本 + 移除（x，aria 移除 removeCriterion） | 点击移除；Toast「已移除验收标准」 | 有标准时 |
| 空态 | 文本 hint | 暂无验收标准，先在上方添加一条。（acceptanceLibraryEmpty） | 只读 | 无标准 |

### 最近目录卡

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 卡头 | CardHead（clock） | 最近目录（recents）+ 右侧：{n} 个目录（dirUnit） | 只读 | 常驻 |
| 目录行 | 行 + 复制按钮 | 文件夹图标 + 路径 + 复制路径（copyPath） | 点击复制；Toast 已复制/复制失败 | 有目录时 |
| 空态 | 文本 hint | 暂无最近目录。（recentsEmpty） | 只读 | 无目录 |
| 说明 | 文本 hint | 新增项目弹窗不会展示这些目录，这里仅供快速复制与清理。（recentsHint） | 只读 | 常驻 |
| 危险行 | 行 + 按钮 danger | 清空后不会删除磁盘上的目录，只会从列表中移除。（clearRecentsShortHint）+ 清空最近目录（clearRecents） | 打开清空最近目录弹窗 | 无目录时禁用 |

### 配置卡

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 卡头 | CardHead（sliders） | 配置（config）+ 说明：由宿主配置提供，只读。（configHint） | 只读 | 常驻 |
| 键值 | KV 列表 | Worktree 目录（worktreeDirName）/ 分支前缀（branchPrefix）/ Git（gitPath），均为只读 code | 只读 | 常驻 |

## 6. 弹窗清单（Modal）

所有弹窗复用统一 `Modal` 组件：`role=dialog`、`aria-modal`、焦点圈定、Esc 关闭（忙碌时禁止）、关闭后焦点恢复；footer 与正文分离。

### 6.1 新增项目（AddProjectModal）

**入口**：左侧「新增项目」/ 空态按钮触发

**布局**：

- Modal 尺寸 lg（.dshw-modal--lg），居中浮层 + 遮罩；头部标题/副标题 + 右上关闭；正文表单 + 固定 footer 操作区。
- 目标目录与「浏览」按钮同行（dshw-field-inline）；基线分支为内置就地展开组合框（不被弹窗滚动裁剪）。
- ≤420px 容器：弹窗接近全宽。

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 标题 | Modal 头部 | 新增项目（addProject）；副标题：选择一个 Git 仓库，读取分支并设置默认基线。（addProjectSub）；图标 folder | 只读 | 打开即显示 |
| 目标目录 * | 输入框 + 浏览按钮 | 占位：仓库目录（repoPathHint）；按钮：浏览…（browse）/ 选择中…（pickingDirectory） | 打开系统目录选择器（同步锁防重复）；切换目录清空基线并重载分支 | 必填；空提示「此项不能为空」（requiredField） |
| 项目名称 | 输入框 | 占位：目录名或「项目名称」（projectName）；提示：只影响看板显示，不会改写仓库。（projectNameHint） | 可选 | — |
| 默认基线分支 * | BranchCombobox / 输入框 | 占位：基线分支（baseBranch）；未选目录：选择目录后加载分支（chooseDirFirst）；加载中：正在加载分支…（loadingBranches）；失败：分支加载失败，可以手动输入分支或重试。（loadBranchesFailed）+ 重试（retry） | 从当前/默认分支回填；可搜索过滤；失败可手动输入 | 必填；加载中禁用提交 |
| 取消 / 新增项目 | Modal footer 按钮 | 取消（cancel）/ 新增项目（addProject，primary，submit） | 取消关闭；提交新增并回调选中新项目 | 提交中 Spinner + 禁用 |
| 错误提示 | role=alert | {err} | 只读 | 请求失败 |

### 6.2 发布任务 / 基于此任务继续（PublishModal）

**入口**：项目行「发布任务」/ 项目详情「发布任务」/ 任务详情「基于此任务继续」触发

**布局**：

- Modal 尺寸 lg；头部标题（发布任务 或 基于此任务继续）+ 图标 play；正文为逐行表单（dshw-form-row：左标签 + 右控件）+ 可折叠「高级选项」+ 固定 footer。
- 基线分支与模型均为就地展开组合框；高级选项为 details 折叠区。

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 标题 | Modal 头部 | 发布任务（publish）或 基于此任务继续（continueTask）；图标 play | 只读 | 据入口切换 |
| 项目 | 只读框 | 文件夹图标 + 项目名 | 只读 | 常驻 |
| 关联前序任务（仅续做） | 只读框 + 复选框 + 单选组 | 前序标题；提示：前序任务已合并到 {base}（parentTaskMerged）；复选框：作为普通任务发布（不关联前序任务）（publishAsPlain）；有未合并提交时单选：仅基于已合并成果继续（continueMergedOnly）/ 迁移合并后的新增改动（continueCarry）+ 提示（continueMergedOnlyHint / continueCarryHint） | 勾选「作为普通任务发布」取消关联；单选决定是否带入前序分支新提交 | 仅从已合并任务继续时出现 |
| 标题 * | 输入框 | 占位：标题（taskTitle） | 必填 | 空提示 requiredField |
| 任务描述 * | 多行文本 textarea | 占位：任务描述（taskDescription） | 必填 | 空提示 requiredField |
| 验收标准 | 复选列表 + 多行文本 | 从标准库勾选（criteriaPickHint）；手动补充占位：每行一条验收标准（acceptanceCriteriaPlaceholder）；提示：acceptanceCriteriaHint | 勾选库项与手动行合并；空行/重复保存前丢弃 | 可选 |
| 基线分支 | BranchCombobox / 输入框 | 占位：基线分支；加载/失败提示同新增项目；续做且基线≠前序合并目标时提示 baseNotMergeTarget | 可搜索过滤 | — |
| 立即执行 | 单选组（是 / 否） | 是（yes）/ 否（no）；提示：startNowHint | 选「是」绑定后立即发送首条指令；「否」保持待开始 | 默认「是」 |
| 高级选项 · 模型 | ModelCombobox | 默认：默认模型（modelDefault）；搜索占位：搜索模型…（searchModels）；空：暂无可用模型（modelEmpty）；不可用：当前环境不支持模型选择（modelUnavailable）；提示：modelHint | 按名称/ID 过滤，↑↓ 选择，回车确认，可切回默认模型 | 可选；不选使用默认模型 |
| 高级选项 · 任务分支 | 输入框 mono | 占位：自动生成（Hash）（branchNameHint） | 仅 ASCII 字母/数字/点/下划线/斜杠 | 非法提示 branchInvalid |
| 分支规则提示 | 文本 hint | 任务分支规则：留空自动生成 {pattern}；仅限 ASCII 字母、数字、点、下划线和斜杠。（branchRule） | 只读 | 常驻 |
| 取消 / 发布任务 | Modal footer 按钮 | 取消（cancel）/ 发布任务（publish → publishing，primary，submit） | 提交发布；成功刷新看板并选中新任务 | 提交中 Spinner + 禁用 |
| 错误提示 | role=alert | {err} / 超时 publishTimeout / 绑定超时 bindTimeout | 只读 | 请求失败 |

### 6.3 合并确认（合并回基线）

**入口**：任务详情「合并回基线 / 切到基线分支并合并」触发

**布局**：

- Modal 尺寸 sm；头部标题「合并到 {base}」+ 副标题；正文信息表 + 可选横幅 + 验收标准列表 + 预览状态；固定 footer（取消 / 确认合并）。
- 危险/不可合并状态以 Banner 形式在正文内提示。

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 标题 | Modal 头部 | 合并到 {base}（mergeTitle）；副标题：将任务分支的提交合并到基线分支。（mergeSub）；图标 merge | 只读 | 打开即显示 |
| 信息表 | KV 列表 | 分支（branchLabel）/ 基线分支（baseBranch）/ 领先基线的提交（commits）/ 未提交改动（uncommitted 或 工作区干净 clean） | 只读 | 常驻 |
| 切换提示 | Banner info + 复选框 | 主仓库当前在 {branch}，合并前会先切换到基线 {base}。（mergeSwitchNotice）；复选框：合并后切回 {branch}（mergeRestoreAfter） | 勾选决定合并后是否切回原分支 | 主仓库不在基线时 |
| 验收标准 | 列表 | 验收标准（acceptanceCriteria）逐条展示 | 只读（仅供核对，不作门槛） | 任务含标准时 |
| 冲突预览 | Banner + 状态 | 正在预检冲突…（mergePreviewChecking）；风险 Banner（预计冲突/基线更新 + 文件 + 让 Agent 同步基线 syncBaseline） | 同步按钮向会话发指令 | 基线领先时 |
| 风险提示 | Banner | acceptNotOnBase / acceptAgentRunning / mergeDirtyTitle + mergeDirtyHint | 只读 | 对应条件命中 |
| 取消 / 确认合并 | Modal footer 按钮 | 取消（cancel，autofocus）/ 确认合并（mergeConfirm → merging，primary） | 执行 no-ff 合并；成功后关闭并刷新；带仓库级忙碌锁 | 冲突/脏/Agent 运行等条件下禁用 |
| 错误提示 | role=alert | {err} | 只读 | 合并失败 |

### 6.4 清理 worktree

**入口**：任务详情「清理 worktree」触发

**布局**：

- Modal 尺寸 sm、tone danger；危险列表（标题 + 路径 + 改动说明）+ 选项复选框；固定 footer（取消 / 清理 worktree）。

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 标题 | Modal 头部 | 清理 worktree（cleanupTitle）；副标题：清理指定的 worktree 及其相关文件。（cleanupSub）；图标 trash；danger | 只读 | 打开即显示 |
| 危险列表 | 列表 | 标题：以下内容将被永久删除，且无法恢复：（cleanupDangerTitle）；worktree 路径；{n} 个未提交改动将丢失（cleanupDirtyGone）或 工作区干净，没有未提交改动（cleanupCleanNote） | 只读 | 常驻 |
| 强制清理 | 复选框 | 强制（force）；说明：即使存在未提交的改动也执行清理。（cleanupForceHint） | 勾选允许强删 | 无未提交改动时禁用 |
| 同时删除分支 | 复选框 | 同时删除分支（deleteBranch）；说明：清理完成后，一并删除对应的本地分支。（cleanupBranchHint） | 勾选一并删本地分支 | 可选 |
| 取消 / 清理 worktree | Modal footer 按钮 | 取消（cancel，autofocus）/ 清理 worktree（cleanup → cleaning，danger） | 执行清理；成功 Toast「worktree 已清理 / worktree 与分支已清理」 | 执行中禁用 |
| 错误提示 | role=alert | {err} | 只读 | 失败 |

### 6.5 删除任务记录

**入口**：任务详情「删除记录」触发

**布局**：

- Modal 尺寸 sm、tone danger；顶部不可撤销警告 Banner + 信息表 + 说明；固定 footer（取消 / 删除记录）。

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 标题 | Modal 头部 | 删除任务记录（deleteTaskTitle）；副标题：任务标题；图标 trash；danger | 只读 | 打开即显示 |
| 警告 | Banner error | 此操作不可撤销（deleteTaskWarning）；任务记录会从看板移除，但 worktree 与分支不会被删除。（deleteTaskWarningHint） | 只读 | 常驻 |
| 信息表 | KV 列表 | 分支（branchLabel）/ Worktree（未清理时）/ 状态（status） | 只读 | 常驻 |
| 说明 | 文本 hint | 如果还需要保留代码，请先合并，再删除记录。（deleteTaskHint） | 只读 | 常驻 |
| 取消 / 删除记录 | Modal footer 按钮 | 取消（cancel，autofocus）/ 删除记录（deleteRecordConfirm → deleting，danger） | 执行删除；成功 Toast「任务记录已删除」 | 执行中禁用 |
| 错误提示 | role=alert | {err} | 只读 | 失败 |

### 6.6 删除项目

**入口**：项目详情「删除项目」触发

**布局**：

- Modal 尺寸 sm、tone danger；任务数警告 Banner + 信息表 + 两个复选框；固定 footer（取消 / 删除项目）。

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 标题 | Modal 头部 | 删除项目（deleteProjectTitle）；副标题：项目名；图标 trash；danger | 只读 | 打开即显示 |
| 警告 | Banner warn / info | 有任务：项目下还有 {n} 条任务记录（deleteProjectWarning）+ 需要同时删除这些任务记录才能移除项目…（deleteProjectWarningHint）；无任务：info 提示 deleteProjectWarningHint | 只读 | 按任务数 |
| 信息表 | KV 列表 | 仓库路径（repoPath）/ 任务记录（deleteProjectRecords）{n} 个任务 / 默认基线（deleteProjectBase） | 只读 | 常驻 |
| 连同任务一起删除 | 复选框 | 连同任务一起删除（withTasks） | 必须勾选才能删除有任务的项目 | 有任务时出现 |
| 同时删除 worktree 文件夹 | 复选框 | 同时删除 worktree 文件夹（withWorktrees）；说明：强制删除磁盘上的 worktree 目录，未提交的改动会一并丢失。（withWorktreesHint） | 勾选连同磁盘目录删除 | 「连同任务」未勾时禁用 |
| 取消 / 删除项目 | Modal footer 按钮 | 取消（cancel，autofocus）/ 删除项目（deleteProjectConfirm → deleting，danger） | 执行删除；Toast「项目「{name}」已删除」 | 有任务未勾「连同任务」时禁用 |
| 错误提示 | role=alert | {err} | 只读 | 失败 |

### 6.7 清理前序任务的 worktree（发布续做后）

**入口**：发布后续任务成功后，前序 worktree 仍存在时弹出

**布局**：

- Modal 尺寸 sm、tone danger；危险列表 + 可选强制清理复选框；固定 footer（保留 / 清理 worktree）。

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 标题 | Modal 头部 | 清理前序任务的 worktree（cleanupPredecessorTitle）；副标题：前序任务已合并，可以清理它的 worktree 以释放空间。（cleanupPredecessorSub）；图标 trash；danger | 只读 | 打开即显示 |
| 危险列表 | 列表 | 标题：cleanupPredecessorSub；前序 worktree 路径 | 只读 | 常驻 |
| 说明 | 文本 hint | 只删除 worktree 目录，不删除分支和已有提交。（cleanupPredecessorHint） | 只读 | 常驻 |
| 强制清理 | 复选框 | 强制清理（cleanupPredecessorForce）；说明：前序 worktree 有 {n} 处未提交改动，强制清理会丢失这些改动。（cleanupPredecessorDirty） | 勾选允许强删 | 无未提交改动时不显示 |
| 保留 / 清理 | Modal footer 按钮 | 保留（keepWorktree，autofocus）/ 清理 worktree（cleanup → cleaning，danger） | 保留则不清理；清理后 Toast「前序 worktree 已清理」 | 执行中禁用 |
| 错误提示 | role=alert | {err} | 只读 | 失败 |

### 6.8 清空最近目录（设置页）

**入口**：设置页「清空最近目录」触发

**布局**：

- Modal 尺寸 sm、tone danger；危险列表（{n} 个目录）+ 说明；固定 footer（取消 / 清空最近目录）。

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 标题 | Modal 头部 | 清空最近目录（clearRecentsTitle）；副标题：将从设置页移除最近使用的仓库目录。（clearRecentsSub）；图标 trash；danger | 只读 | 打开即显示 |
| 危险列表 | 列表 | 标题：以下 {n} 个目录会从列表移除：（clearRecentsDanger）；逐条目录路径 | 只读 | 常驻 |
| 说明 | 文本 hint | 磁盘上的目录和仓库不会被删除，只清空这份列表。（clearRecentsHint） | 只读 | 常驻 |
| 取消 / 清空 | Modal footer 按钮 | 取消（cancel，autofocus）/ 清空最近目录（clearRecents → deleting，danger） | 执行清空；Toast「清空最近目录」 | 执行中禁用 |
| 错误提示 | role=alert | {err} | 只读 | 失败 |

### 6.9 切换分支冲突处理（switchModal）

**入口**：任务详情「切到任务分支验收 / 切回原分支」预检发现主仓库有未提交改动时

**布局**：

- Modal 尺寸 sm、tone warn；头部标题为动作名（切到任务分支验收 / 切回原分支）；正文告警 + 阻塞文件列表（可滚动，max-height 200px）+ 固定 footer 三按钮。

| 元素 | 类型 | 文案 / 语义 key | 交互 / 行为 | 状态 / 条件 |
| --- | --- | --- | --- | --- |
| 标题 | Modal 头部 | 标题：切到任务分支验收（checkout）或 切回原分支（back）；副标题：主仓库有未提交改动，直接切换会被 Git 拒绝。（switchConflictSub）；图标 alert；warn | 只读 | checkout / back 预检不安全（safe=false）时 |
| 告警 | 文本 | 以下 {n} 个文件会阻止切换，请选择处理方式：（switchConflictHint） | 只读 | 常驻 |
| 阻塞文件列表 | 列表 | 每个文件路径；未跟踪文件显示 chip「未跟踪」（switchUntracked） | 只读 | 列表可滚动 |
| 取消 / 暂存后切换 / 放弃改动后切换 | Modal footer 按钮 | 取消（cancel，autofocus）/ 暂存后切换（switchStash，primary）/ 放弃改动后切换（switchDiscard，danger） | stash：先暂存未提交改动再切换；discard：放弃改动后切换；成功后关闭 | 执行中禁用 |
| 错误提示 | role=alert | {err} | 只读 | 失败 |

## 7. 布局与响应式

### 主布局（工作台）

| 项目 | 规则 |
| --- | --- |
| Grid | grid-template-columns: 320px minmax(0, 1fr)；左栏 320px，右栏自适应 |
| 右侧阅读宽度 | 详情内容限制 960px（.dshw-detail-inner），避免宽屏键值行无限拉伸 |
| 滚动 | 外层 height:100%、min-height:0；列表与详情分别滚动，页面不承担双滚动 |
| 溢出处理 | 标题/路径用 min-width:0 + 省略/换行；路径、分支、会话 ID 等用等宽字体并 overflow-wrap:anywhere |
| 切换重置 | 切换任务或项目时详情滚动位置回到顶部 |

### 容器断点（@container dshw，按插件自身宽度而非视口）

| 容器宽度 | 行为 |
| --- | --- |
| > 860px | 双栏，左栏 320px |
| ≤ 860px | 双栏，左栏缩至 268px，详情内边距收紧 |
| ≤ 700px | 概览统计两列；实时会话侧栏改为上下排列 |
| ≤ 620px | 单栏：列表与详情二选一，详情显示「返回项目列表」按钮 |
| ≤ 420px | 键值行改为上下排列；项目行新增按钮换行；弹窗接近全宽 |

### 卡片与浮层

| 组件 | 规则 |
| --- | --- |
| 卡片 | 圆角 12px；普通图标按钮 32×32；紧凑按钮最低 27px |
| 按钮 / 输入框 | 圆角 8px；输入框、下拉框最小高度 36px |
| 弹窗 | 圆角 14px；居中浮层 + 遮罩；footer 与正文分离固定 |
| 阴影 | 只用于浮层与卡片层级，不叠加装饰性阴影 |
| 动效 | 常规过渡 120–150ms；待处理圆点可轻微脉冲；prefers-reduced-motion 下关闭 |
| 字体 | 继承宿主字体；基础字号 13px；标题/主操作 600–650 字重；正文 13px、辅助 12px、摘要 11px |

### 区域结构（信息架构）

| 区域 | 内容 |
| --- | --- |
| 左侧项目树 | 搜索 / 刷新 / 新增项目；项目行（折叠、选中、任务数、发布）；任务行（选中、状态、领先/改动、打开会话、归档） |
| 右侧详情 · 任务 | 任务摘要、会话、改动文件、会话信息、验收操作、Worktree/主仓库、归档、危险操作 |
| 右侧详情 · 项目 | 页头、发布任务、更多操作、概览统计、待处理提示、项目设置、删除项目 |
| 设置页 | 验收标准库、最近目录、只读全局配置 |

## 8. 全局交互与通用行为

### 快捷键

| 快捷键 | 作用 | 生效条件 |
| --- | --- | --- |
| / | 聚焦搜索框 | 焦点位于插件内部，且不在输入框中 |
| Ctrl/Cmd + K | 聚焦搜索框 | 同上；不劫持宿主聊天输入 |
| Esc | 清空搜索 / 关闭已展开的下拉菜单 / 关闭弹窗（忙碌时禁止关闭） | 对应上下文 |
| Tab / Shift+Tab | 在弹窗内循环焦点 | 弹窗打开时 |
| ↑ / ↓ / Enter | 组合框（分支 / 模型）键盘导航与选择 | 下拉面板展开时；Esc 只关列表不关弹窗 |

### 弹窗通用行为（Modal）

| 行为 | 说明 |
| --- | --- |
| ARIA | role=dialog、aria-modal=true、aria-labelledby 指向标题 |
| 初始焦点 | 优先 data-autofocus，否则首个表单控件，否则首个可聚焦元素 |
| 焦点圈定 | Tab / Shift+Tab 在弹窗内循环 |
| 关闭 | Esc 关闭；点遮罩关闭；忙碌（busy）时均禁止关闭 |
| 焦点恢复 | 关闭后焦点恢复到触发元素（60ms 后延迟恢复） |
| 滚动锁定 | 打开时锁定 body 滚动，支持多层计数 |
| 错误显示 | 操作失败错误显示在当前弹窗内（role=alert） |

### 组合框（BranchCombobox / ModelCombobox）

| 行为 | 说明 |
| --- | --- |
| 展开方式 | 面板在字段下方就地展开，避免被弹窗滚动容器裁剪 |
| 搜索 | 输入即过滤（大小写不敏感）；清空按钮复位 |
| 键盘 | ↑↓ 移动，Enter 选择，Esc 只关闭列表 |
| 分支标记 | 当前分支显示「当前分支」标签；无匹配显示「没有匹配的分支」 |
| 模型标记 | 含「默认模型」项；无匹配显示「暂无可用模型」 |

### 轮询与刷新

| 对象 | 频率 / 规则 |
| --- | --- |
| 工作台项目视图 | 每 4 秒刷新；页面不可见时暂停；失败指数退避（最长 30s）；窗口重新聚焦立即刷新 |
| 任务合并预检 | 任务详情每 15 秒请求 task/merge-preview |
| 会话投影 | 选中任务会话每 4 秒拉取一次 |
| 会话健康 | 每 12 秒拉取各绑定会话最近一轮结束原因 |
| 手动刷新 | 独立进行中状态，完成后 Toast「已刷新任务状态」 |

### Toast 与异步反馈

| 项目 | 说明 |
| --- | --- |
| 位置 / 语义 | 底部居中；role=status（成功）/ role=alert（错误）；aria-live polite / assertive |
| 时长 | 约 2.8s 自动消失，不阻塞操作 |
| 典型文案 | 已复制 / 复制失败 / 已刷新任务状态 / 会话已创建并绑定 worktree / 已合并到 {base} / worktree 已清理 / 任务记录已删除 / 项目「{name}」已删除 / 项目「{name}」已新增 / 任务已发布 · {branch} / 任务已归档 / 已取消归档 / 已添加验收标准 / 已移除验收标准 / 已发送同步基线指令 |

## 9. 状态与配色语义

| 状态 | Tone | 呈现 |
| --- | --- | --- |
| 待开始 ready | neutral | 「待开始」 |
| 已清理 cleaned | neutral | 「已清理」 |
| 进行中 developing | brand | 「进行中」 |
| 验收中 reviewing | brand | 「验收中」 |
| 待验收 review | warn | 「待验收」 |
| 已合并 merged | success | 「已合并」 |
| 异常 broken | error | 「异常」 |
| 待审批 / 计划待审 / 待回答 | warn | pending chip（第二 chip） |
| 操作失败 | error | 错误 Banner / Toast |

> 全部颜色集中在 `src/client/palette.ts` 的 `PALETTE`（明/暗两套），禁止在样式或组件内写死颜色；状态色由 `STATUS_TONE` 统一映射。

## 10. 附录：完整文案字典（中英对照，375 条）

| key | 中文 | English |
| --- | --- | --- |
| title | Worktree 任务 | Worktree Tasks |
| publish | 发布任务 | Publish task |
| repoPath | 目标目录 | Target directory |
| repoPathHint | 仓库目录 | Repository directory |
| browse | 浏览… | Browse… |
| pickingDirectory | 选择中… | Choosing… |
| baseBranch | 基线分支 | Base branch |
| filterBranches | 筛选分支… | Filter branches… |
| noBranchMatch | 没有匹配的分支 | No matching branches |
| model | 模型 | Model |
| modelHint | 选择任务会话使用的模型；不选则使用默认模型。 | Model used by the task session. Leave empty to use the default. |
| modelDefault | 默认模型 | Default model |
| searchModels | 搜索模型… | Search models… |
| modelEmpty | 暂无可用模型 | No models available |
| modelUnavailable | 当前环境不支持模型选择 | Model selection is unavailable in this environment |
| acceptanceCriteria | 验收标准 | Acceptance criteria |
| acceptanceCriteriaHint | 每行一条可检查的结果，例如：窄屏下返回列表后保留选中项。 | One checkable result per line, e.g. keep the selected item after returning to the list on narrow screens. |
| acceptanceCriteriaPlaceholder | 每行一条验收标准 | One acceptance criterion per line |
| acceptanceLibrary | 验收标准库 | Acceptance criteria library |
| acceptanceLibraryHint | 在这里维护可复用的验收标准；发布任务时可勾选，也可临时手动补充。 | Maintain reusable acceptance criteria here; pick them when publishing, or add one-off items manually. |
| acceptanceLibraryEmpty | 暂无验收标准，先在上方添加一条。 | No acceptance criteria yet. Add one above. |
| criteriaPickHint | 从标准库勾选，或在下方手动补充。 | Pick from the library, or add extra items below. |
| addCriterion | 添加 | Add |
| removeCriterion | 移除 | Remove |
| criterionInputPlaceholder | 输入一条验收标准 | Enter one acceptance criterion |
| criterionAdded | 已添加验收标准 | Acceptance criterion added |
| criterionRemoved | 已移除验收标准 | Acceptance criterion removed |
| chooseDirFirst | 选择目录后加载分支 | Choose a directory to load branches |
| loadingBranches | 正在加载分支… | Loading branches… |
| branchName | 任务分支 | Task branch |
| branchNameHint | 自动生成（Hash） | Auto (hash) |
| taskTitle | 标题 | Title |
| taskDescription | 任务描述 | Task description |
| startNow | 立即执行 | Run immediately after creation |
| yes | 是 | Yes |
| no | 否 | No |
| publishing | 发布中… | Publishing… |
| openSessionBtn | 打开会话 | Open session |
| live | 实时 | Live |
| liveModel | 模型 | Model |
| liveCwd | 工作目录 | Working dir |
| liveCwdOff | 尚未切换到 worktree | Not switched to the worktree yet |
| livePressure | 上下文 | Context |
| liveTokens | Token | Tokens |
| liveTokensIn | 输入 | in |
| liveTokensOut | 输出 | out |
| liveTokensCache | 缓存读 | cached |
| liveTodos | 执行清单 | Todos |
| liveTurns | 轮次 | Turns |
| liveTurnN | 第{n}轮 | Turn {n} |
| liveTurnEmpty | 暂无轮次 | No turns yet |
| liveQueued | 排队消息 | Queued msgs |
| liveSubagents | 子代理 | Subagents |
| livePerms | 访问模式 | Access |
| liveLastPrompt | 最近活动 | Last prompt |
| liveStats | {turns} 轮 · {steps} 步 | {turns} turns · {steps} steps |
| liveStepsOnly | {steps} 步 | {steps} steps |
| roleUser | 你 | You |
| roleAssistant | 助手 | Agent |
| roleThinking | 思考 | Think |
| roleTool | 工具 | Tool |
| roleResult | 结果 | Result |
| roleError | 错误 | Error |
| duration | 持续了 {s} | Lasted {s} |
| stepDone | 已完成 | Done |
| stepFailed | 执行失败 | Failed |
| stepRunning | 执行中 | Running |
| toolTerminal | 终端 | Terminal |
| toolRead | 读取 | Read |
| toolEdit | 编辑 | Edit |
| toolFind | 查找 | Find |
| toolCd | 切换目录 | Cd |
| toolTodos | 清单 | Tasks |
| toolQuestion | 提问 | Question |
| toolGeneric | 工具 | Tool |
| pendingApproval | 待审批 | Waiting approval |
| pendingPlanReview | 计划待审 | Plan review |
| pendingQuestion | 待回答 | Waiting answer |
| pendingHint | 会话正在等待你的处理，打开会话后可以继续执行。 | The session is waiting for you. Open it to continue. |
| sessionInterrupted | 会话中断 | Session interrupted |
| sessionError | 会话异常 | Session error |
| sessionInterruptedHint | 该会话上次运行被中断，工作区可能还有未完成的改动。 | The last run of this session was interrupted. The worktree may still contain unfinished changes. |
| sessionErrorHint | 该会话上次运行失败，请打开会话查看错误。 | The last run of this session failed. Open the session to inspect the error. |
| projects | 项目 | Projects |
| addProject | 新增项目 | Add project |
| addTask | 发布任务 | Publish task |
| projectDetail | 项目详情 | Project |
| overview | 概览 | Overview |
| projectSettings | 项目设置 | Project settings |
| projectName | 项目名称 | Name |
| defaultBase | 默认基线分支 | Default base branch |
| worktreeDirName | Worktree 目录 | Worktree directory |
| gitPath | Git | Git |
| branchPrefix | 分支前缀 | Branch prefix |
| save | 保存 | Save |
| saved | 已保存 | Saved |
| deleteProject | 删除项目 | Delete project |
| withTasks | 连同任务一起删除 | Also delete task records |
| withWorktrees | 同时删除 worktree 文件夹 | Also delete worktree folders |
| tasksUnit | 任务 | Tasks |
| noProjects | 暂无项目 | No projects |
| developing | 进行中 | In progress |
| review | 待验收 | Ready for review |
| reviewing | 验收中 | Reviewing |
| merged | 已合并 | Merged |
| cleaned | 已清理 | Cleaned |
| broken | 异常 | Broken |
| noTasks | 暂无任务 | No tasks |
| noSession | 未创建会话 | No session yet |
| createSession | 创建会话 | Create session |
| checkout | 切到任务分支验收 | Switch to task branch |
| back | 切回原分支 | Switch back |
| merge | 合并回基线 | Merge into base |
| cleanup | 清理 worktree | Clean worktree |
| deleteRecord | 删除记录 | Delete record |
| deleteBranch | 同时删除分支 | Also delete branch |
| force | 强制 | Force |
| dirty | 处未提交改动 | uncommitted changes |
| uncommitted | 未提交改动 | Uncommitted changes |
| changesUnit | 处 | files |
| clean | 工作区干净 | Working tree clean |
| commitsAhead | 个领先提交 | commits ahead |
| openSessionFailed | 无法打开会话 | Could not open session |
| confirmDelete | 删除这条任务记录？ | Delete this task record? |
| config | 配置 | Config |
| recents | 最近目录 | Recent directories |
| clearRecents | 清空最近目录 | Clear recents |
| loading | 加载中… | Loading… |
| loadFailed | 加载失败 | Load failed |
| connectionLost | 连接已断开，请重试，或从 DSH 启动地址重新打开工作台。 | Connection lost. Retry, or reopen the workbench from the DSH launch URL. |
| reload | 重新加载 | Reload |
| failed | 操作失败 | Operation failed |
| publishTimeout | 发布请求超时，请刷新看板确认任务是否已创建 | Publish timed out — refresh the board to confirm whether the task was created |
| bindTimeout | 任务已创建，但会话创建超时；请稍后在看板中打开或创建会话 | Task created, but session creation timed out — open or create the session from the board later |
| handlePending | 去处理 | Review |
| close | 关闭 | Close |
| refresh | 刷新 | Refresh |
| detail | 任务详情 | Task detail |
| description | 描述 | Description |
| worktree | Worktree | Worktree |
| mainRepo | 主仓库 | Main repo |
| currentBranch | 当前分支 | Current branch |
| originalBranch | 验收前分支 | Branch before review |
| session | 会话 | Session |
| sessionRunning | 工作中 | Working |
| sessionIdle | 空闲 | Idle |
| mergedFlag | 已合并进基线 | Merged into base |
| branchMissing | 分支不存在 | Branch missing |
| onBranch | 主仓库正检出该分支 | Main repo is on this branch |
| commits | 领先基线的提交 | Commits ahead of base |
| selectTask | 未选择任务 | No task selected |
| ready | 待开始 | Ready |
| path | 路径 | Path |
| status | 状态 | Status |
| sessionId | 会话 ID | Session ID |
| operations | 操作 | Actions |
| dangerZone | 危险操作 | Danger zone |
| creatingSession | 正在创建会话… | Creating session… |
| saving | 正在保存… | Saving… |
| confirmMerge | 确定将任务分支合并回基线分支吗？ | Merge this task branch into its base branch? |
| confirmCleanup | 确定清理这个 worktree 吗？请先确认分支和未提交改动。 | Remove this worktree? Review the branch and uncommitted changes before continuing. |
| backToList | 返回项目列表 | Back to projects |
| retry | 重试 | Retry |
| loadBranchesFailed | 分支加载失败，可以手动输入分支或重试。 | Could not load branches. You can enter a branch manually or retry. |
| requiredField | 此项不能为空 | This field is required |
| cancel | 取消 | Cancel |
| expand | 展开 | Expand |
| collapse | 折叠 | Collapse |
| search | 搜索项目、任务或分支 | Search projects, tasks or branches |
| noProjectsHint | 选择一个 Git 仓库，开始发布 worktree 任务。 | Choose a Git repository to start publishing worktree tasks. |
| noMatch | 没有匹配的项目 | No matching projects |
| noMatchHint | 换个关键词，或清除搜索查看全部项目。 | Try another keyword, or clear the search to see everything. |
| clearSearch | 清除搜索 | Clear search |
| projectUnit | 个项目 | projects |
| taskUnit | 个任务 | tasks |
| dirUnit | 个目录 | directories |
| addProjectSub | 选择一个 Git 仓库，读取分支并设置默认基线。 | Choose a Git repository, load its branches and set a default base. |
| totalTasks | 任务总数 | Total tasks |
| activeTasks | 进行中 | In progress |
| reviewTasks | 待验收 | Ready |
| mergedTasks | 已合并 | Merged |
| overviewHint | 按 Git 与会话状态推导 | Derived from Git and session state |
| attention | {n} 个任务等待处理 | {n} tasks need attention |
| view | 查看 | View |
| lastActivity | 最近活动 | Last activity |
| justNow | 刚刚 | just now |
| minutesAgo | {n} 分钟前 | {n} min ago |
| hoursAgo | {n} 小时前 | {n} h ago |
| daysAgo | {n} 天前 | {n} d ago |
| liveSession | 实时会话 | Live session |
| sessionInfo | 会话信息 | Session |
| noSessionHint | 创建后会在这里显示实时对话、执行清单和上下文占用。 | Create a session to see live turns, todos and context usage here. |
| noTurns | 还没有对话记录 | No turns yet |
| acceptance | 验收操作 | Review actions |
| acceptanceHintClean | worktree 已清理，验收操作不可用。 | The worktree has been cleaned; review actions are unavailable. |
| acceptanceHintMerged | 任务已合并进基线，可以清理 worktree。 | Merged into the base branch. You can clean the worktree now. |
| acceptanceHintBroken | worktree 状态异常，修复后再执行验收操作。 | The worktree state is broken. Fix it before reviewing. |
| acceptanceHintDeveloping | 任务进行中，完成开发后才能切到任务分支验收。 | Task is in progress. Finish development before switching to the task branch. |
| acceptanceHintNotStarted | 任务尚未开始，完成开发后才能切到任务分支验收。 | Task hasn't started yet. Finish development before switching to the task branch. |
| acceptanceHintDirty | worktree 有 {n} 处未提交改动，合并与切换前需要先提交或暂存。 | {n} uncommitted changes. Commit or stash before switching or merging. |
| acceptanceHintRepoDirty | 主仓库有 {n} 处未提交改动，切换分支前需要先提交或暂存。 | The main repo has {n} uncommitted changes. Commit or stash them before switching branches. |
| acceptanceHintNoAhead | 还没有领先基线的提交，完成开发后再合并。 | No commits ahead of the base yet. |
| acceptanceHintCheckedOut | 主仓库当前检出任务分支，验收完成后可切回原分支。 | The main repo is on the task branch. Switch back when done. |
| acceptanceHintDefault | 切换与合并前会检查工作区；有未提交改动时会拒绝执行。 | Switching and merging check the working tree first. |
| cleanupHint | 清理会删除 worktree 目录；删除记录只移除看板条目，不会删除仓库中的提交。 | Cleaning removes the worktree directory. Deleting a record only hides it from the board. |
| mergeTitle | 合并到 {base} | Merge into {base} |
| mergeSub | 将任务分支的提交合并到基线分支。 | Merge the task branch commits into the base branch. |
| mergeCleanHint | 合并前请确认代码已通过所需的检查，并且没有冲突。 | Make sure the code passed required checks and has no conflicts. |
| mergeDirtyTitle | worktree 有未提交改动 | Uncommitted changes in the worktree |
| mergeDirtyHint | 先提交或暂存改动，再执行合并。 | Commit or stash them before merging. |
| cleanupTitle | 清理 worktree | Clean worktree |
| cleanupSub | 清理指定的 worktree 及其相关文件。 | Remove the worktree and its files. |
| cleanupDangerTitle | 以下内容将被永久删除，且无法恢复： | These will be permanently deleted: |
| cleanupDirtyGone | {n} 个未提交改动将丢失 | {n} uncommitted changes will be lost |
| cleanupCleanNote | 工作区干净，没有未提交改动 | Working tree is clean |
| worktreeRemovedHint | worktree 目录已删除，此路径仅作记录。 | The worktree directory was removed. The path is kept for reference. |
| cleanupForceHint | 即使存在未提交的改动也执行清理。 | Clean even when uncommitted changes exist. |
| cleanupBranchHint | 清理完成后，一并删除对应的本地分支。 | Delete the local branch after cleaning. |
| deleteTaskTitle | 删除任务记录 | Delete task record |
| deleteTaskWarning | 此操作不可撤销 | This cannot be undone |
| deleteTaskWarningHint | 任务记录会从看板移除，但 worktree 与分支不会被删除。 | The record is removed from the board; the worktree and branch stay on disk. |
| deleteTaskHint | 如果还需要保留代码，请先合并，再删除记录。 | Merge first if you still need the code. |
| deleteProjectTitle | 删除项目 | Delete project |
| deleteProjectWarning | 项目下还有 {n} 条任务记录 | The project still has {n} task records |
| deleteProjectWarningHint | 需要同时删除这些任务记录才能移除项目。仓库和提交不会被删除。 | Delete them together to remove the project. The repository and commits stay on disk. |
| deleteProjectCardHint | 删除后，项目配置与任务记录会从工作台移除；仓库和提交不会被删除。 | Removing a project hides its configuration and task records from the board. The repository and commits stay on disk. |
| withWorktreesHint | 强制删除磁盘上的 worktree 目录，未提交的改动会一并丢失。 | Force-remove the worktree folders on disk; uncommitted changes are lost. |
| deleteProjectRecords | 任务记录 | Task records |
| deleteProjectBase | 默认基线 | Default base |
| clearRecentsTitle | 清空最近目录 | Clear recent directories |
| clearRecentsSub | 将从设置页移除最近使用的仓库目录。 | Remove recent repository directories from settings. |
| clearRecentsDanger | 以下 {n} 个目录会从列表移除： | These {n} directories will be removed: |
| clearRecentsHint | 磁盘上的目录和仓库不会被删除，只清空这份列表。 | Directories and repositories on disk are not deleted. |
| copied | 已复制 | Copied |
| copyFailed | 复制失败，请手动选择 | Copy failed, select manually |
| refreshed | 已刷新任务状态 | Task status refreshed |
| sessionCreated | 会话已创建并绑定 worktree | Session created and bound to the worktree |
| mergeDone | 已合并到 {base} | Merged into {base} |
| cleanupDone | worktree 已清理 | Worktree cleaned |
| cleanupDoneBranch | worktree 与分支已清理 | Worktree and branch cleaned |
| recordDeleted | 任务记录已删除 | Task record deleted |
| projectDeleted | 项目「{name}」已删除 | Project "{name}" deleted |
| projectAdded | 项目「{name}」已新增 | Project "{name}" added |
| published | 任务已发布 · {branch} | Task published · {branch} |
| branchRule | 任务分支规则：留空自动生成 {pattern}；仅限 ASCII 字母、数字、点、下划线和斜杠。 | Leave empty to auto-generate {pattern}. ASCII letters, digits, dot, underscore and slash only. |
| branchInvalid | 只能使用 ASCII 字母、数字、点、下划线和斜杠。 | Use ASCII letters, digits, dot, underscore and slash only. |
| advanced | 高级选项 | Advanced |
| preview | 预览 | Preview |
| previewBranch | 分支 | Branch |
| previewDir | 目录 | Directory |
| projectSettingsHint | 覆盖全局的分支与 worktree 命名规则，只影响此后发布的任务。 | Override branch and worktree naming. Applies to future tasks only. |
| projectNameHint | 只影响看板显示，不会改写仓库。 | Display name only; the repository is untouched. |
| worktreeDirHint | 相对仓库根目录，并写入 .git/info/exclude。 | Relative to the repository root; added to .git/info/exclude. |
| branchPrefixHint | 自动分支为前缀加 8 位任务 ID。 | Auto branches use the prefix plus the 8-character task ID. |
| statusSyncFailed | 状态同步失败 | Status sync failed |
| mergeConfirm | 确认合并 | Merge |
| mergeSwitchToBase | 切到基线分支并合并 | Switch to base and merge |
| mergeSwitchNotice | 主仓库当前在 {branch}，合并前会先切换到基线 {base}。 | The main repo is on {branch}; it will switch to base {base} before merging. |
| mergeRestoreAfter | 合并后切回 {branch} | Switch back to {branch} after merging |
| switchConflictSub | 主仓库有未提交改动，直接切换会被 Git 拒绝。 | Uncommitted changes in the main repo would make Git reject the switch. |
| switchConflictHint | 以下 {n} 个文件会阻止切换，请选择处理方式： | These {n} files block the switch; choose how to handle them: |
| switchStash | 暂存后切换 | Stash, then switch |
| switchDiscard | 放弃改动后切换 | Discard changes, then switch |
| switchUntracked | 未跟踪 | untracked |
| reviewStashTitle | 验收期间的暂存 | Stash from acceptance review |
| reviewStashNotice | 切回分支时暂存了未提交改动（{ref}）。可以恢复到当前分支或丢弃。 | Uncommitted changes were stashed when switching back ({ref}). Restore them onto the current branch or drop them. |
| reviewStashApply | 恢复到当前分支 | Restore to current branch |
| reviewStashDrop | 丢弃暂存 | Drop stash |
| reviewStashApplied | 已恢复暂存 | Stash restored |
| reviewStashDropped | 已丢弃暂存 | Stash dropped |
| deleteRecordConfirm | 删除记录 | Delete record |
| deleteProjectConfirm | 删除项目 | Delete project |
| settingsSub | 全局配置与最近使用的仓库目录。 | Global configuration and recent repository directories. |
| configHint | 由宿主配置提供，只读。 | Provided by the host configuration; read-only. |
| recentsHint | 新增项目弹窗不会展示这些目录，这里仅供快速复制与清理。 | Not shown in the add-project dialog. Kept for quick reference and cleanup. |
| recentsEmpty | 暂无最近目录。 | No recent directories. |
| clearRecentsShortHint | 清空后不会删除磁盘上的目录，只会从列表中移除。 | Clearing only removes this list; directories on disk stay. |
| merging | 正在合并… | Merging… |
| cleaning | 正在清理… | Cleaning… |
| deleting | 正在删除… | Deleting… |
| copyRepoPath | 复制仓库路径 | Copy repository path |
| copyBranch | 复制分支名 | Copy branch name |
| copyPath | 复制路径 | Copy path |
| copySessionId | 复制会话 ID | Copy session ID |
| copyWorktree | 复制 worktree 路径 | Copy worktree path |
| branchLabel | 分支 | Branch |
| resultRead | 读取完成 · {lines} 行 · {chars} 字符 | Read · {lines} lines · {chars} chars |
| resultMatch | 匹配 {n} 个文件 | Matched {n} files |
| resultWrite | 写入完成 | Write complete |
| todoUpdate | 更新执行清单 | Update todos |
| contentSize | 内容：{n} 字符 | Content: {n} chars |
| durationSec | {n} 秒 | {n}s |
| durationMin | {n} 分 | {n}m |
| durationMinSec | {m} 分 {s} 秒 | {m}m {s}s |
| taskNotStarted | 会话尚未开始 | Session not started |
| taskNotStartedHint | 任务已创建，但第一条指令没有执行。点击开始继续。 | The task was published, but its first instruction never ran. Start it to continue. |
| startTask | 启动任务 | Start task |
| startingTask | 正在启动… | Starting… |
| taskStarted | 任务已开始 | Task started |
| changedFiles | 改动文件 | Changed files |
| diffFiles | {n} 个文件 | {n} files |
| diffLoading | 正在加载改动… | Loading changes… |
| diffEmpty | 相对基线分支没有改动。 | No changes against the base branch. |
| diffBinary | 二进制文件 | Binary |
| diffTruncated | 改动较大，仅显示部分内容。 | Changes are large — showing a trimmed diff. |
| diffUnavailable | 无法获取改动：{reason} | Changes unavailable: {reason} |
| diffReasonMissing | worktree 与分支均不存在 | the worktree and branch no longer exist |
| diffReasonNoBase | 没有共同基线提交 | no common base commit |
| diffReasonError | 读取 git 失败 | failed to read git |
| copyDiff | 复制 diff | Copy diff |
| expandAll | 全部展开 | Expand all |
| collapseAll | 全部折叠 | Collapse all |
| startNowHint | 选择「是」时立即创建会话并发送任务描述；选择「否」则任务保持待开始状态。 | Choosing Yes creates the session and sends the task description right away. Choosing No keeps the task ready to start later. |
| mergePreviewChecking | 正在预检冲突… | Checking conflicts… |
| mergePreviewBaseAhead | 基线已更新 · {n} 个提交 | Base updated · {n} commits |
| mergePreviewOverlap | 基线已更新 · {n} 个文件重叠 | Base updated · {n} overlapping files |
| mergePreviewConflict | 预计冲突 · {n} 个文件 | Predicted conflict · {n} files |
| mergePreviewConflictTitle | 预计无法自动合并 | Cannot merge automatically |
| mergePreviewOverlapTitle | 基线有更新 | Base has new commits |
| mergePreviewConflictHint | 基线有新提交，且与任务改动存在冲突。建议先让 Agent 同步基线。 | The base has new commits that conflict with this task. Sync the base in the session first. |
| mergePreviewOverlapHint | 两边都修改了以下文件。Git 可能可以自动合并，但需要留意冲突风险。 | Both sides changed these files. Git may merge them automatically, but review the risk. |
| mergePreviewNoCheck | 当前 Git 版本不支持冲突预检，仅提示文件重叠。 | This Git version cannot pre-check conflicts; only file overlap is shown. |
| mergePrecheckBlocked | 无法完成合并前冲突预检，已阻止合并；请重试或升级 Git。 | Could not complete the conflict pre-check, so merging is blocked. Retry or upgrade Git. |
| mergePreviewFiles | 文件 | Files |
| syncBaseline | 让 Agent 同步基线 | Sync base in session |
| syncingBaseline | 正在发送同步指令… | Sending sync request… |
| continueTask | 基于此任务继续 | Continue from this task |
| continueTitleSuffix | （续） |  (cont.) |
| parentTask | 关联前序任务 | Continues from |
| parentTaskMerged | 前序任务已合并到 {base} | Previous task merged into {base} |
| carryNote | 前序分支还有 {n} 个未合并提交，将在首条指令中由 Agent 带入 | {n} newer commits on the previous branch will be carried in by the agent |
| postMergeBadge | 已合并 · 之后有 {n} 个新提交 | Merged · {n} new commits after |
| postMergeTitle | 已合并 · 之后有 {n} 个新提交 | Merged · {n} new commits after |
| postMergeHint | 该任务已合并，但分支上又出现了 {n} 个未合并提交。可以再次合并作为补丁，或基于此任务新建后续任务。 | This task is merged, but its branch has {n} newer unmerged commits. Merge again as a patch, or start a follow-up task. |
| mergeAgain | 再次合并 | Merge again |
| relatedTasks | 任务关系 | Task relations |
| followUps | 后续任务 | Follow-up tasks |
| acceptanceHintPostMerge | 该任务已合并，分支上还有 {n} 个新提交待处理：可再次合并，或基于此任务继续。 | Merged, but the branch has {n} newer commits: merge again as a patch, or continue from this task. |
| cleanupPredecessorTitle | 清理前序任务的 worktree | Clean the previous task's worktree |
| cleanupPredecessorSub | 前序任务已合并，可以清理它的 worktree 以释放空间。 | The previous task is merged; its worktree can be cleaned to free space. |
| cleanupPredecessorHint | 只删除 worktree 目录，不删除分支和已有提交。 | Only the worktree directory is removed; the branch and commits stay. |
| cleanupPredecessorDirty | 前序 worktree 有 {n} 处未提交改动，强制清理会丢失这些改动。 | The previous worktree has {n} uncommitted changes; force clean will discard them. |
| cleanupPredecessorForce | 强制清理 | Force clean |
| keepWorktree | 保留 | Keep |
| cleanupPredecessorDone | 前序 worktree 已清理 | Previous worktree cleaned |
| switchToBase | 切到基线分支 | Switch to base branch |
| acceptMergeReviewing | 请先切回原分支再合并 | Switch back before merging |
| acceptNotOnBase | 主仓库当前在 {branch} 分支，请先切到基线分支 | Main repo is on {branch}; switch to the base branch first |
| acceptInProgress | 主仓库有未完成的合并或变基，请先处理 | The main repo has an unfinished merge/rebase; resolve it first |
| acceptAgentRunning | Agent 正在运行，请等本轮结束再操作 | The agent is running; wait for this turn to finish |
| acceptOtherReviewing | 任务「{task}」正在验收，请先切回 | Task "{task}" is being reviewed; switch back first |
| acceptReviewOther | 切到该任务 | Go to that task |
| acceptBusy | 正在执行：{action} | Running: {action} |
| acceptWorktreeDirtyCommit | worktree 有 {n} 处未提交改动，请先让 Agent 提交 | The worktree has {n} uncommitted changes; ask the agent to commit first |
| acceptNoCommits | 还没有可验收的提交 | No commits to review yet |
| continueMergedOnly | 仅基于已合并成果继续 | Continue from merged results only |
| continueCarry | 迁移合并后的新增改动 | Migrate the post-merge changes |
| continueMergedOnlyHint | 忽略前序分支合并后的新提交；它们仍留在旧分支，不会进入新任务。 | Ignore commits added to the old branch after the merge; they stay on the old branch. |
| continueCarryHint | 会把前序分支合并后的 {n} 个新提交列进首条指令，由 Agent 用 cherry-pick 带入并处理冲突。 | List the {n} post-merge commits in the first prompt and let the agent cherry-pick them in. |
| publishAsPlain | 作为普通任务发布（不关联前序任务） | Publish as a normal task (not linked to the previous task) |
| baseNotMergeTarget | 所选基线不是前序任务的合并目标 {base}；发布时会校验它是否包含前序成果。 | This base is not the previous task's merge target {base}; publishing will verify it contains the merged results. |
| syncPromptSent | 已发送同步基线指令 | Sync request sent |
| syncNoSession | 先创建会话后才能同步基线 | Create a session before syncing the base |
| syncPrompt | 请同步基线：在 worktree 内把本地 {base} 合并进 {branch}。<br>工作台预检结果：{files}。<br>按提示词中“同步基线”的规则处理，完成后告诉我冲突文件和解决方式。 | Please sync the base: merge local {base} into {branch} inside the worktree.<br>Workbench pre-check: {files}.<br>Follow the "sync base" rules in your task prompt, then tell me the conflict files and how they were resolved. |
| archive | 归档 | Archive |
| unarchive | 取消归档 | Unarchive |
| archived | 已归档 | Archived |
| archiveSection | 归档 | Archive |
| archiveHintOff | 归档后，该任务会从左侧列表默认隐藏；需要时可在侧栏切换「显示已归档」查看。 | Archiving hides this task from the left list by default. Use "Show archived" in the sidebar to see it again. |
| archiveHintOn | 该任务已归档，默认从左侧列表隐藏。取消归档后会重新出现在列表中。 | This task is archived and hidden from the default list. Unarchiving puts it back. |
| archiveDone | 任务已归档 | Task archived |
| unarchiveDone | 已取消归档 | Task unarchived |
| showArchived | 显示已归档 | Show archived |
| hideArchived | 隐藏已归档 | Hide archived |
| archiveToggleTitle | 已归档 {n} 个任务，点击切换显示 | {n} archived tasks — click to toggle |

## 11. 已知缺口 / 备注

- `t.reconnecting`（「重新连接中…」）在 `src/client/board-page.ts` 中被引用，但 `locale/zh.json`、`locale/en.json` 均无该 key，实际会显示为空。
- 分支切换（checkout / back）改为先调用预检接口：安全时直接切换；主仓库有未提交改动时弹出「切换分支冲突处理」弹窗，可选择「暂存后切换」或「放弃改动后切换」。
- `locale` 中存在少量当前组件未直接引用的 key（如 liveModel / liveTurns / liveTurnN / liveQueued / liveSubagents / livePerms / preview / previewBranch / previewDir / confirmDelete / confirmMerge / confirmCleanup / detail / description / session / onBranch / acceptReviewOther 等），保留为兼容/未来使用。
