# -*- coding: utf-8 -*-
"""
Generate a structured inventory of the @5318vo/dsh-worktree frontend.

Produces (single source of truth -> three formats):
  docs/frontend-ui-inventory.md
  docs/frontend-ui-inventory.json
  docs/frontend-ui-inventory.xlsx

Data is hand-curated from src/client/*.ts, src/client.ts and locale/{zh,en}.json.
Run:  python scripts/gen_frontend_ui_inventory.py
"""
import json
import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")

ELEMENT_HEADERS = ["元素", "类型", "文案 / 语义 key", "交互 / 行为", "状态 / 条件"]


def sec(title, headers, rows):
    return {"title": title, "headers": headers, "rows": rows}


# --------------------------------------------------------------------------
# PAGES  (group = page | modal)
# --------------------------------------------------------------------------
PAGES = []

# ============================ 工作台（左侧项目树） ============================
PAGES.append({
    "id": "board-tree",
    "group": "page",
    "title": "工作台 · 左侧项目树（Worktree 任务）",
    "route": "宿主 main slot → BoardPage（左栏）",
    "layout": [
        "主布局 CSS Grid：grid-template-columns: 320px minmax(0, 1fr)；左栏固定 320px，右栏自适应。",
        "左栏自身为纵向三段：header（搜索 + 工具按钮）/ scroll（项目与任务树，独立滚动）/ footer（统计 + worktree 标签）。",
        "容器宽度 ≤860px：左栏收窄到 268px；≤620px：单栏，列表与详情二选一（详情出现返回条）。",
        "行结构：项目行=折叠按钮 + 主体按钮 + 发布按钮；任务行=主选择按钮 + 打开会话按钮（+ 终态归档按钮）。",
    ],
    "sections": [
        sec("头部区（tree-head）", ELEMENT_HEADERS, [
            ["搜索框", "输入框 input[type=search]", "占位符：搜索项目、任务或分支（search）",
             "输入即实时过滤：项目名、仓库路径、任务标题、分支名、待处理状态；按 `/` 或 Ctrl/Cmd+K 聚焦（仅当焦点在插件内）；Esc 清空",
             "无提交按钮；空结果切到「没有匹配的项目」空态"],
            ["刷新按钮", "图标按钮 IconBtn（refresh）", "aria-label / title：刷新（refresh）",
             "点击手动刷新；执行中显示旋转 Spinner；完成后 Toast「已刷新任务状态」（refreshed）", "刷新中禁用"],
            ["显示/隐藏已归档切换", "图标按钮 IconBtn（archive）", "显示已归档 / 隐藏已归档（showArchived / hideArchived）；title：已归档 {n} 个任务，点击切换显示（archiveToggleTitle）",
             "切换左侧列表是否显示已归档任务；aria-pressed 同步", "仅当存在已归档任务时出现"],
            ["新增项目按钮", "图标按钮 IconBtn（plus）", "aria-label / title：新增项目（addProject）",
             "打开「新增项目」弹窗", "常驻"],
        ]),
        sec("连接 / 错误状态条", ELEMENT_HEADERS, [
            ["断线重连条", "状态条 role=status", "「重新连接中…」（reconnecting；注：该 key 在 locale/zh.json、en.json 中缺失，实际会回退为空）",
             "轮询自动恢复；提供「重试」（retry）链接", "已有项目且刷新失败时"],
            ["加载失败提示", "错误提示 role=alert",
             "错误文案：连接已断开，请重试，或从 DSH 启动地址重新打开工作台。（connectionLost）／加载失败（loadFailed）",
             "「重试」（retry）重新拉取；「重新加载」（reload）整页刷新", "无项目且刷新失败时"],
        ]),
        sec("项目行（项目树节点）", ELEMENT_HEADERS, [
            ["折叠按钮", "按钮 project-toggle", "aria-label：展开 / 折叠：{项目名}（expand / collapse）",
             "展开或收起该项目的任务列表；aria-expanded 同步", "搜索态自动全部展开"],
            ["项目主体按钮", "按钮 project-select", "内容：文件夹色块（四色循环）+ 项目名 + 任务数；title=仓库路径",
             "点击选中项目，右侧切到项目详情", "选中时整行高亮；折叠时仍显示"],
            ["发布任务按钮", "图标按钮 project-add（plus）", "title / aria-label：发布任务（addTask）：{项目名}",
             "打开该项目的「发布任务」弹窗并选中该项目", "常驻"],
        ]),
        sec("任务行", ELEMENT_HEADERS, [
            ["任务主选择按钮", "按钮 task-select", "状态圆点 + 任务标题 + 元信息区；title=完整标题",
             "点击选中任务，右侧切到任务详情", "圆点/文字颜色见状态色"],
            ["· 状态 chip", "Chip", "待开始（ready）/ 进行中（developing）/ 验收中（reviewing）/ 待验收（review）/"
             "已合并（merged）/ 已清理（cleaned）/ 异常（broken）", "只读", "由 Git + 会话状态推导（resolveStatus）"],
            ["· 待处理 chip", "Chip warn", "待审批（pendingApproval）/ 计划待审（pendingPlanReview）/ 待回答（pendingQuestion）", "只读", "会话有待处理交互时"],
            ["· 已归档 chip", "Chip neutral", "已归档（archived）", "只读", "任务已归档"],
            ["· 合并后新增提交 chip", "Chip warn", "已合并 · 之后有 {n} 个新提交（postMergeBadge）", "只读", "合并后分支又有新提交"],
            ["· 会话健康 chip", "Chip warn / error", "会话中断（sessionInterrupted）/ 会话异常（sessionError）",
             "只读", "最近一轮 turn/end 为 interrupted / error|failed 且当前未运行"],
            ["· 领先提交数", "文本", "↑ {n}（title：{n} 个领先提交 commitsAhead）", "只读", "ahead > 0"],
            ["· 未提交改动数", "文本", "±{n}（title：{n} 处未提交改动 dirty）", "只读", "dirtyCount > 0"],
            ["打开会话按钮", "图标按钮 task-open（external）",
             "title / aria-label：打开会话（openSessionBtn）：{标题}；无会话显示：未创建会话（noSession）",
             "调用原生 uiWorkspace.openSession 打开会话；失败 Toast「无法打开会话」（openSessionFailed）", "无会话时禁用"],
            ["归档 / 取消归档按钮", "图标按钮（archive / archiveRestore）",
             "title / aria-label：归档（archive）/ 取消归档（unarchive）：{标题}",
             "直接归档或恢复；成功 Toast「任务已归档 / 已取消归档」", "仅 merged / cleaned 终态任务；处理中显示 Spinner"],
        ]),
        sec("空 / 加载状态", ELEMENT_HEADERS, [
            ["加载骨架屏", "骨架占位（aria-hidden）", "无文字", "首屏加载时显示", "loaded=false"],
            ["无项目空态", "空状态 Empty", "标题：暂无项目（noProjects）；说明：选择一个 Git 仓库，开始发布 worktree 任务。（noProjectsHint）；按钮：新增项目（addProject）",
             "点击按钮打开「新增项目」弹窗", "无任何项目"],
            ["搜索无结果空态", "空状态 Empty", "标题：没有匹配的项目（noMatch）；说明：换个关键词，或清除搜索查看全部项目。（noMatchHint）；按钮：清除搜索（clearSearch）",
             "清除搜索词并恢复全部项目", "有项目但过滤结果为空"],
            ["项目下无任务", "内联空态", "暂无任务（noTasks）；链接：发布任务（addTask）",
             "点击链接打开发布弹窗", "展开的项目无任务；搜索态不显示该链接"],
        ]),
        sec("底部栏（tree-foot）", ELEMENT_HEADERS, [
            ["统计文本", "文本", "{项目数} 个项目 · {任务数} 个任务（projectUnit / taskUnit）", "只读", "常驻"],
            ["标签", "文本", "worktree", "只读", "常驻"],
        ]),
    ],
})

# ============================ 工作台右侧详情容器 ============================
PAGES.append({
    "id": "board-detail",
    "group": "page",
    "title": "工作台 · 右侧详情容器（detail）",
    "route": "宿主 main slot → BoardPage（右栏）",
    "layout": [
        "右栏为 main.dshw-detail，内部 .dshw-detail-scroll 独立滚动；内容套在 .dshw-detail-inner 内并限制 960px 阅读宽度。",
        "切换任务/项目时详情滚动位置回到顶部。",
        "≤620px 容器：单栏模式，列表与详情二选一；选中项时顶部出现「返回项目列表」横条。",
        "路由：有选中任务 → 任务详情；否则有选中项目 → 项目详情；否则空态。",
    ],
    "sections": [
        sec("容器与路由", ELEMENT_HEADERS, [
            ["详情滚动容器", "main > .dshw-detail-scroll > .dshw-detail-inner", "内容宽度上限 960px", "独立滚动；切换选中项时回到顶部", "常驻"],
            ["移动端返回条", "横条 + 按钮 sm（arrowLeft）", "返回项目列表（backToList）", "返回左侧列表（隐藏详情）", "仅窄屏单栏且存在选中项时"],
            ["空态", "空状态 Empty（file）", "未选择任务（selectTask）", "只读", "无任务且无项目选中"],
        ]),
    ],
})

# ============================ 任务详情 ============================
PAGES.append({
    "id": "task-detail",
    "group": "page",
    "title": "任务详情（TaskDetail）",
    "route": "右栏（BoardPage 渲染 TaskDetail）",
    "layout": [
        "纵向堆叠的卡片流：Hero → 验收标准 → 横幅（未开始/待处理/健康/预览/合并后/同步失败）→ 实时会话 → 改动文件 → 会话信息 → 任务关系 → 验收操作 → Worktree/主仓库 → 归档 → 危险操作。",
        "Hero 为两列：左侧面包屑/标题/描述/元信息，右侧主操作 + 最近活动；窄屏换行。",
        "实时会话为卡片：顶栏（模型/统计/token）+ 左右两栏（日志主区 + 侧栏执行清单/上下文）；≤1100px 侧栏移到日志下方。",
        "改动文件、Worktree/主仓库、验收操作等均使用卡片 + 键值行；≤420px 键值行改为上下排列。",
    ],
    "sections": [
        sec("3.1 顶部 Hero 卡", ELEMENT_HEADERS, [
            ["面包屑", "文本（folder 图标）", "项目名 / 分支名（无项目时用仓库路径）", "只读", "常驻"],
            ["任务标题", "h1", "{任务标题}", "只读", "常驻"],
            ["任务描述", "段落", "{任务描述}", "只读", "有描述时"],
            ["元信息胶囊", "Chip / pill", "状态 chip、待处理 chip、已归档 chip、合并预览 chip（预计冲突 / 基线更新）、↑{n} 领先提交、±{n} 未提交改动",
             "只读", "按数据出现"],
            ["主操作（primary）", "按钮 lg primary",
             "按状态：基于此任务继续（continueTask）／已清理（cleaned，禁用）／启动任务（startTask→startingTask）／打开会话（openSessionBtn）／创建会话（createSession→creatingSession）",
             "点击执行对应动作（打开/创建会话、启动任务、继续建任务）", "唯一视觉主操作；见状态判定"],
            ["次操作（续做任务）", "按钮 lg", "打开会话（openSessionBtn）", "打开原生会话", "「基于此任务继续」为主操作且有会话时"],
            ["最近活动", "文本 hint", "最近活动 · {相对时间}（lastActivity；刚刚/ {n} 分钟前 / {n} 小时前 / {n} 天前，>7 天显示 M/D HH:mm）",
             "只读", "有 sessionId 与 updatedAt"],
            ["错误条", "错误提示 role=alert", "{错误信息}（操作失败 failed）", "只读", "操作失败"],
        ]),
        sec("3.2 验收期间的暂存卡（reviewStash）", ELEMENT_HEADERS, [
            ["卡头", "CardHead（archive）", "验收期间的暂存（reviewStashTitle）", "只读", "task.reviewStash 存在时（切回分支时自动暂存了未提交改动）"],
            ["说明", "文本 hint", "切回分支时暂存了未提交改动（{ref}）。可以恢复到当前分支或丢弃。（reviewStashNotice）", "只读", "常驻"],
            ["恢复到当前分支", "按钮（archiveRestore）", "恢复到当前分支（reviewStashApply）", "apply 暂存；成功 Toast「已恢复暂存」（reviewStashApplied）", "处理中禁用"],
            ["丢弃暂存", "按钮 danger（trash）", "丢弃暂存（reviewStashDrop）", "drop 暂存；成功 Toast「已丢弃暂存」（reviewStashDropped）", "处理中禁用"],
        ]),
        sec("3.3 验收标准卡", ELEMENT_HEADERS, [
            ["卡头", "CardHead（checkCircle）", "验收标准（acceptanceCriteria）", "只读", "任务含验收标准"],
            ["标准列表", "ul", "每条：勾图标 + 文本", "只读", "常驻"],
        ]),
        sec("3.4 横幅 / 提示区", ELEMENT_HEADERS, [
            ["未开始横幅", "Banner warn", "标题：会话尚未开始（taskNotStarted）；说明：任务已创建，但第一条指令没有执行。点击开始继续。（taskNotStartedHint）",
             "主操作因此变为「启动任务」", "已绑定但会话为空（blank）且未运行"],
            ["待处理横幅", "Banner warn", "标题：待审批 / 计划待审 / 待回答；说明：会话正在等待你的处理，打开会话后可以继续执行。（pendingHint）；按钮：去处理（handlePending）",
             "点击打开会话", "存在待处理交互"],
            ["会话健康横幅", "Banner warn / error", "标题：会话中断 / 会话异常；说明：sessionInterruptedHint / sessionErrorHint 或错误消息；按钮：去处理（handlePending）",
             "打开会话", "最近一轮 interrupted / error 且未运行"],
            ["合并预览横幅", "Banner warn / error",
             "标题：基线有更新（mergePreviewOverlapTitle）/ 预计无法自动合并（mergePreviewConflictTitle）；说明 + 文件列表；按钮：让 Agent 同步基线（syncBaseline→syncingBaseline）",
             "向当前会话发送同步基线指令（无会话禁用）", "基线领先且存在重叠 / 冲突"],
            ["合并后新增提交横幅", "Banner warn", "标题：已合并 · 之后有 {n} 个新提交（postMergeTitle）；说明：postMergeHint；按钮：再次合并（mergeAgain）+ 基于此任务继续（continueTask）",
             "再次合并打开合并弹窗 / 继续打开发布弹窗", "postMergeAhead > 0"],
            ["状态同步失败横幅", "Banner error", "标题：状态同步失败（statusSyncFailed）+ 错误；按钮：重试（retry）", "重新拉取状态", "snap.error 存在"],
        ]),
        sec("3.5 实时会话卡（LiveCard）", ELEMENT_HEADERS, [
            ["卡头", "CardHead（terminal）", "标题：实时会话（liveSession）；右侧状态：待处理 / 工作中 / 空闲（pendingLabel / sessionRunning / sessionIdle）+ 状态圆点", "只读", "有会话时显示状态"],
            ["未创建会话空态", "空状态", "「未创建会话」（noSession）+「创建后会在这里显示实时对话、执行清单和上下文占用。」（noSessionHint）", "只读", "无 sessionId"],
            ["控制台顶栏", "文本", "{模型} / {轮次·步数 liveStats 或 步数 liveStepsOnly}；右侧 token：输入 / 输出（liveTokensIn / liveTokensOut）", "只读", "控制台常驻"],
            ["日志行（每步）", "details / summary", "序号 + 类型标签 + 标题 + 变更统计（+N -M）+ 状态（已完成/执行失败/执行中 stepDone/stepFailed/stepRunning）+ 展开箭头",
             "点击行展开完整内容；日志自动滚到底，用户上滚后暂停自动跟随", "有对话时"],
            ["· 类型标签", "文本", "你（roleUser）/ 助手（roleAssistant）/ 思考（roleThinking，标题显示「持续了 {时长}」duration）", "只读", "按消息类型"],
            ["· 工具标签", "文本", "终端 toolTerminal / 读取 toolRead / 编辑 toolEdit / 查找 toolFind / 切换目录 toolCd / 清单 toolTodos / 提问 toolQuestion / 工具 toolGeneric", "只读", "按工具名映射"],
            ["· 工具结果摘要", "文本", "读取完成 · {行} 行 · {字符} 字符（resultRead）/ 匹配 {n} 个文件（resultMatch）/ 写入完成（resultWrite）/ 内容：{n} 字符（contentSize）", "只读", "工具结果"],
            ["无对话", "文本", "还没有对话记录（noTurns）", "只读", "entries 为空"],
            ["执行清单侧栏", "列表", "标题：执行清单（liveTodos）；每项勾/圈图标 + 内容；最多 10 条", "只读", "有 todos"],
            ["上下文侧栏", "进度条", "标题：上下文（livePressure）；百分比 + 缓存读（liveTokensCache）", "只读", "常驻"],
        ]),
        sec("3.6 改动文件卡（DiffCard）", ELEMENT_HEADERS, [
            ["卡头", "CardHead（file）", "标题：改动文件（changedFiles）；右侧：{n} 个文件（diffFiles）+ +新增/-删除 汇总；按钮：全部展开/全部折叠（expandAll/collapseAll）、复制 diff（copyDiff）、刷新（refresh）",
             "展开/折叠所有文件；复制 diff；刷新重新拉取（加载中 Spinner）", "仅 review / reviewing / 合并后新增提交时显示"],
            ["文件行", "按钮 diff-file-head", "状态字母 chip（A 增 / M 改 / D 删 / R 重命名 / U 未跟踪）+ 路径（重命名显示 ← 原路径）+ +N -M（二进制显示「二进制文件」diffBinary）+ 展开箭头",
             "点击展开该文件 unified diff；≤5 个文件时默认全部展开", "有改动文件"],
            ["状态文案", "文本 / 提示", "正在加载改动…（diffLoading）/ 错误（role=alert）/ 无法获取改动：{原因}（diffUnavailable + diffReasonMissing / diffReasonNoBase / diffReasonError）/ 相对基线分支没有改动。（diffEmpty）/ 改动较大，仅显示部分内容。（diffTruncated）",
             "只读", "按加载 / 错误 / 空 / 截断状态"],
        ]),
        sec("3.7 会话信息卡", ELEMENT_HEADERS, [
            ["卡头", "CardHead（message）", "会话信息（sessionInfo）", "只读", "有 sessionId"],
            ["会话 ID 行", "KV + 复制按钮", "会话 ID（sessionId）+ 复制会话 ID（copySessionId）", "点击复制；Toast「已复制 / 复制失败」", "常驻"],
            ["工作目录行", "KV + chip + 复制按钮", "工作目录（liveCwd）+ 复制 worktree 路径（copyWorktree）；不一致时 chip「尚未切换到 worktree」（liveCwdOff）", "点击复制", "常驻"],
        ]),
        sec("3.8 任务关系卡", ELEMENT_HEADERS, [
            ["卡头", "CardHead（branch）", "任务关系（relatedTasks）", "只读", "有前序或后续任务"],
            ["关联前序任务", "KV + 链接按钮", "关联前序任务（parentTask）+ 前序标题（点击跳转）+ 状态 chip", "点击跳转到前序任务详情", "存在 parentId"],
            ["后续任务", "KV + 链接按钮", "后续任务（followUps）+ 各后续标题 + 状态 chip", "点击跳转", "存在后续任务"],
        ]),
        sec("3.9 验收操作卡", ELEMENT_HEADERS, [
            ["卡头", "CardHead（checkCircle）", "标题：验收操作（acceptance）；右侧：主仓库 · {基线分支}", "只读", "存在任一验收动作"],
            ["切到任务分支验收", "按钮（branch）", "切到任务分支验收（checkout）", "先请求 checkout 预检：安全则直接切换；主仓库有未提交改动时弹出「切换分支冲突处理」弹窗（暂存 / 放弃后切换）", "按条件显示 / 禁用"],
            ["切回原分支 / 切到基线分支", "按钮（arrowLeft）", "切回原分支（back）/ 切到基线分支（switchToBase）", "先请求 back 预检：安全则直接切换；有未提交改动时弹出「切换分支冲突处理」弹窗", "主仓库当前检出任务分支时显示"],
            ["合并回基线 / 切到基线分支并合并", "按钮（merge）", "合并回基线（merge）/ 切到基线分支并合并（mergeSwitchToBase）", "打开合并确认弹窗", "按条件显示 / 禁用"],
            ["禁用原因列表", "文本 role=status", "见「验收禁用原因」集合；部分带「切到该任务」（acceptReviewOther）按钮", "只读 / 可跳转", "按钮不可用时展示原因"],
        ]),
        sec("3.10 Worktree / 主仓库卡", ELEMENT_HEADERS, [
            ["卡头", "CardHead（branch）", "标题：Worktree / 主仓库；异常时右侧 chip：异常 / 分支不存在", "只读", "常驻"],
            ["Worktree 分区", "分区标签 + KV", "路径（path）+ 复制 worktree 路径；当前分支（currentBranch）+ 复制分支名；已清理时显示「worktree 目录已删除，此路径仅作记录。」（worktreeRemovedHint）", "复制", "常驻"],
            ["主仓库分区", "分区标签 + KV", "仓库路径（repoPath）+ 复制仓库路径；当前分支（currentBranch）；验收前分支（originalBranch）；未提交改动（uncommitted）", "复制", "常驻"],
            ["状态 chip", "Chip", "工作区干净（clean）/ 已清理（cleaned）/ 异常（broken）/ 已合并进基线（mergedFlag）/ 分支不存在（branchMissing）", "只读", "按 worktree 状态"],
        ]),
        sec("3.11 归档卡", ELEMENT_HEADERS, [
            ["卡头", "CardHead（archive）", "标题：归档（archiveSection）+ 已归档 chip", "只读", "merged / cleaned 任务"],
            ["说明", "文本", "archiveHintOff / archiveHintOn", "只读", "常驻"],
            ["归档 / 取消归档按钮", "按钮", "归档（archive）/ 取消归档（unarchive）", "执行归档；Toast「任务已归档 / 已取消归档」", "按归档状态切换"],
        ]),
        sec("3.12 危险操作卡", ELEMENT_HEADERS, [
            ["卡头", "CardHead（alert, danger）", "危险操作（dangerZone）", "只读", "常驻"],
            ["说明", "文本", "cleanupHint", "只读", "常驻"],
            ["清理 worktree", "按钮 danger（trash）", "清理 worktree（cleanup）；已清理时显示「已清理」（cleaned）且禁用", "打开清理弹窗", "cleaned 时禁用"],
            ["删除记录", "按钮 danger（xCircle）", "删除记录（deleteRecord）", "打开删除任务弹窗", "常驻"],
        ]),
        sec("验收禁用原因（按钮下方文案）", ["key", "文案", "附带动作"], [
            ["acceptBusy", "正在执行：{action}", "—"],
            ["acceptanceHintMerged", "任务已合并进基线，可以清理 worktree。", "—"],
            ["acceptanceHintBroken / snap.error", "worktree 状态异常，修复后再执行验收操作。", "—"],
            ["acceptNoCommits", "还没有可验收的提交", "—"],
            ["acceptWorktreeDirtyCommit", "worktree 有 {n} 处未提交改动，请先让 Agent 提交", "—"],
            ["acceptInProgress", "主仓库有未完成的合并或变基，请先处理", "—"],
            ["acceptOtherReviewing", "任务「{task}」正在验收，请先切回", "切到该任务（acceptReviewOther）"],
            ["acceptAgentRunning", "Agent 正在运行，请等本轮结束再操作", "—"],
            ["acceptMergeReviewing", "请先切回原分支再合并", "—"],
            ["acceptNotOnBase", "主仓库当前在 {branch} 分支，请先切到基线分支", "—"],
            ["acceptanceHintDirty", "worktree 有 {n} 处未提交改动，合并与切换前需要先提交或暂存。", "—"],
            ["acceptanceHintRepoDirty（合并时）", "主仓库有 {n} 处未提交改动，切换分支前需要先提交或暂存。", "—"],
            ["mergePreviewConflictHint", "基线有新提交，且与任务改动存在冲突。建议先让 Agent 同步基线。", "让 Agent 同步基线"],
            ["mergePreviewChecking", "正在预检冲突…", "—"],
            ["mergePrecheckBlocked", "无法完成合并前冲突预检，已阻止合并；请重试或升级 Git。", "—"],
        ]),
    ],
})

# ============================ 弹窗 ============================
PAGES.append({
    "id": "modal-add-project", "group": "modal", "title": "弹窗 · 新增项目（AddProjectModal）",
    "route": "左侧「新增项目」/ 空态按钮触发",
    "layout": ["Modal 尺寸 lg（.dshw-modal--lg），居中浮层 + 遮罩；头部标题/副标题 + 右上关闭；正文表单 + 固定 footer 操作区。",
               "目标目录与「浏览」按钮同行（dshw-field-inline）；基线分支为内置就地展开组合框（不被弹窗滚动裁剪）。",
               "≤420px 容器：弹窗接近全宽。"],
    "sections": [sec("字段与操作", ELEMENT_HEADERS, [
        ["标题", "Modal 头部", "新增项目（addProject）；副标题：选择一个 Git 仓库，读取分支并设置默认基线。（addProjectSub）；图标 folder", "只读", "打开即显示"],
        ["目标目录 *", "输入框 + 浏览按钮", "占位：仓库目录（repoPathHint）；按钮：浏览…（browse）/ 选择中…（pickingDirectory）", "打开系统目录选择器（同步锁防重复）；切换目录清空基线并重载分支", "必填；空提示「此项不能为空」（requiredField）"],
        ["项目名称", "输入框", "占位：目录名或「项目名称」（projectName）；提示：只影响看板显示，不会改写仓库。（projectNameHint）", "可选", "—"],
        ["默认基线分支 *", "BranchCombobox / 输入框", "占位：基线分支（baseBranch）；未选目录：选择目录后加载分支（chooseDirFirst）；加载中：正在加载分支…（loadingBranches）；失败：分支加载失败，可以手动输入分支或重试。（loadBranchesFailed）+ 重试（retry）",
         "从当前/默认分支回填；可搜索过滤；失败可手动输入", "必填；加载中禁用提交"],
        ["取消 / 新增项目", "Modal footer 按钮", "取消（cancel）/ 新增项目（addProject，primary，submit）", "取消关闭；提交新增并回调选中新项目", "提交中 Spinner + 禁用"],
        ["错误提示", "role=alert", "{err}", "只读", "请求失败"],
    ])],
})

PAGES.append({
    "id": "modal-publish", "group": "modal", "title": "弹窗 · 发布任务 / 基于此任务继续（PublishModal）",
    "route": "项目行「发布任务」/ 项目详情「发布任务」/ 任务详情「基于此任务继续」触发",
    "layout": ["Modal 尺寸 lg；头部标题（发布任务 或 基于此任务继续）+ 图标 play；正文为逐行表单（dshw-form-row：左标签 + 右控件）+ 可折叠「高级选项」+ 固定 footer。",
               "基线分支与模型均为就地展开组合框；高级选项为 details 折叠区。"],
    "sections": [sec("字段与操作", ELEMENT_HEADERS, [
        ["标题", "Modal 头部", "发布任务（publish）或 基于此任务继续（continueTask）；图标 play", "只读", "据入口切换"],
        ["项目", "只读框", "文件夹图标 + 项目名", "只读", "常驻"],
        ["关联前序任务（仅续做）", "只读框 + 复选框 + 单选组", "前序标题；提示：前序任务已合并到 {base}（parentTaskMerged）；复选框：作为普通任务发布（不关联前序任务）（publishAsPlain）；有未合并提交时单选：仅基于已合并成果继续（continueMergedOnly）/ 迁移合并后的新增改动（continueCarry）+ 提示（continueMergedOnlyHint / continueCarryHint）",
         "勾选「作为普通任务发布」取消关联；单选决定是否带入前序分支新提交", "仅从已合并任务继续时出现"],
        ["标题 *", "输入框", "占位：标题（taskTitle）", "必填", "空提示 requiredField"],
        ["任务描述 *", "多行文本 textarea", "占位：任务描述（taskDescription）", "必填", "空提示 requiredField"],
        ["验收标准", "复选列表 + 多行文本", "从标准库勾选（criteriaPickHint）；手动补充占位：每行一条验收标准（acceptanceCriteriaPlaceholder）；提示：acceptanceCriteriaHint", "勾选库项与手动行合并；空行/重复保存前丢弃", "可选"],
        ["基线分支", "BranchCombobox / 输入框", "占位：基线分支；加载/失败提示同新增项目；续做且基线≠前序合并目标时提示 baseNotMergeTarget", "可搜索过滤", "—"],
        ["立即执行", "单选组（是 / 否）", "是（yes）/ 否（no）；提示：startNowHint", "选「是」绑定后立即发送首条指令；「否」保持待开始", "默认「是」"],
        ["高级选项 · 模型", "ModelCombobox", "默认：默认模型（modelDefault）；搜索占位：搜索模型…（searchModels）；空：暂无可用模型（modelEmpty）；不可用：当前环境不支持模型选择（modelUnavailable）；提示：modelHint",
         "按名称/ID 过滤，↑↓ 选择，回车确认，可切回默认模型", "可选；不选使用默认模型"],
        ["高级选项 · 任务分支", "输入框 mono", "占位：自动生成（Hash）（branchNameHint）", "仅 ASCII 字母/数字/点/下划线/斜杠", "非法提示 branchInvalid"],
        ["分支规则提示", "文本 hint", "任务分支规则：留空自动生成 {pattern}；仅限 ASCII 字母、数字、点、下划线和斜杠。（branchRule）", "只读", "常驻"],
        ["取消 / 发布任务", "Modal footer 按钮", "取消（cancel）/ 发布任务（publish → publishing，primary，submit）", "提交发布；成功刷新看板并选中新任务", "提交中 Spinner + 禁用"],
        ["错误提示", "role=alert", "{err} / 超时 publishTimeout / 绑定超时 bindTimeout", "只读", "请求失败"],
    ])],
})

PAGES.append({
    "id": "modal-merge", "group": "modal", "title": "弹窗 · 合并确认（合并回基线）",
    "route": "任务详情「合并回基线 / 切到基线分支并合并」触发",
    "layout": ["Modal 尺寸 sm；头部标题「合并到 {base}」+ 副标题；正文信息表 + 可选横幅 + 验收标准列表 + 预览状态；固定 footer（取消 / 确认合并）。",
               "危险/不可合并状态以 Banner 形式在正文内提示。"],
    "sections": [sec("内容与操作", ELEMENT_HEADERS, [
        ["标题", "Modal 头部", "合并到 {base}（mergeTitle）；副标题：将任务分支的提交合并到基线分支。（mergeSub）；图标 merge", "只读", "打开即显示"],
        ["信息表", "KV 列表", "分支（branchLabel）/ 基线分支（baseBranch）/ 领先基线的提交（commits）/ 未提交改动（uncommitted 或 工作区干净 clean）", "只读", "常驻"],
        ["切换提示", "Banner info + 复选框", "主仓库当前在 {branch}，合并前会先切换到基线 {base}。（mergeSwitchNotice）；复选框：合并后切回 {branch}（mergeRestoreAfter）", "勾选决定合并后是否切回原分支", "主仓库不在基线时"],
        ["验收标准", "列表", "验收标准（acceptanceCriteria）逐条展示", "只读（仅供核对，不作门槛）", "任务含标准时"],
        ["冲突预览", "Banner + 状态", "正在预检冲突…（mergePreviewChecking）；风险 Banner（预计冲突/基线更新 + 文件 + 让 Agent 同步基线 syncBaseline）", "同步按钮向会话发指令", "基线领先时"],
        ["风险提示", "Banner", "acceptNotOnBase / acceptAgentRunning / mergeDirtyTitle + mergeDirtyHint", "只读", "对应条件命中"],
        ["取消 / 确认合并", "Modal footer 按钮", "取消（cancel，autofocus）/ 确认合并（mergeConfirm → merging，primary）", "执行 no-ff 合并；成功后关闭并刷新；带仓库级忙碌锁", "冲突/脏/Agent 运行等条件下禁用"],
        ["错误提示", "role=alert", "{err}", "只读", "合并失败"],
    ])],
})

PAGES.append({
    "id": "modal-cleanup", "group": "modal", "title": "弹窗 · 清理 worktree",
    "route": "任务详情「清理 worktree」触发",
    "layout": ["Modal 尺寸 sm、tone danger；危险列表（标题 + 路径 + 改动说明）+ 选项复选框；固定 footer（取消 / 清理 worktree）。"],
    "sections": [sec("内容与操作", ELEMENT_HEADERS, [
        ["标题", "Modal 头部", "清理 worktree（cleanupTitle）；副标题：清理指定的 worktree 及其相关文件。（cleanupSub）；图标 trash；danger", "只读", "打开即显示"],
        ["危险列表", "列表", "标题：以下内容将被永久删除，且无法恢复：（cleanupDangerTitle）；worktree 路径；{n} 个未提交改动将丢失（cleanupDirtyGone）或 工作区干净，没有未提交改动（cleanupCleanNote）", "只读", "常驻"],
        ["强制清理", "复选框", "强制（force）；说明：即使存在未提交的改动也执行清理。（cleanupForceHint）", "勾选允许强删", "无未提交改动时禁用"],
        ["同时删除分支", "复选框", "同时删除分支（deleteBranch）；说明：清理完成后，一并删除对应的本地分支。（cleanupBranchHint）", "勾选一并删本地分支", "可选"],
        ["取消 / 清理 worktree", "Modal footer 按钮", "取消（cancel，autofocus）/ 清理 worktree（cleanup → cleaning，danger）", "执行清理；成功 Toast「worktree 已清理 / worktree 与分支已清理」", "执行中禁用"],
        ["错误提示", "role=alert", "{err}", "只读", "失败"],
    ])],
})

PAGES.append({
    "id": "modal-delete-task", "group": "modal", "title": "弹窗 · 删除任务记录",
    "route": "任务详情「删除记录」触发",
    "layout": ["Modal 尺寸 sm、tone danger；顶部不可撤销警告 Banner + 信息表 + 说明；固定 footer（取消 / 删除记录）。"],
    "sections": [sec("内容与操作", ELEMENT_HEADERS, [
        ["标题", "Modal 头部", "删除任务记录（deleteTaskTitle）；副标题：任务标题；图标 trash；danger", "只读", "打开即显示"],
        ["警告", "Banner error", "此操作不可撤销（deleteTaskWarning）；任务记录会从看板移除，但 worktree 与分支不会被删除。（deleteTaskWarningHint）", "只读", "常驻"],
        ["信息表", "KV 列表", "分支（branchLabel）/ Worktree（未清理时）/ 状态（status）", "只读", "常驻"],
        ["说明", "文本 hint", "如果还需要保留代码，请先合并，再删除记录。（deleteTaskHint）", "只读", "常驻"],
        ["取消 / 删除记录", "Modal footer 按钮", "取消（cancel，autofocus）/ 删除记录（deleteRecordConfirm → deleting，danger）", "执行删除；成功 Toast「任务记录已删除」", "执行中禁用"],
        ["错误提示", "role=alert", "{err}", "只读", "失败"],
    ])],
})

PAGES.append({
    "id": "modal-delete-project", "group": "modal", "title": "弹窗 · 删除项目",
    "route": "项目详情「删除项目」触发",
    "layout": ["Modal 尺寸 sm、tone danger；任务数警告 Banner + 信息表 + 两个复选框；固定 footer（取消 / 删除项目）。"],
    "sections": [sec("内容与操作", ELEMENT_HEADERS, [
        ["标题", "Modal 头部", "删除项目（deleteProjectTitle）；副标题：项目名；图标 trash；danger", "只读", "打开即显示"],
        ["警告", "Banner warn / info", "有任务：项目下还有 {n} 条任务记录（deleteProjectWarning）+ 需要同时删除这些任务记录才能移除项目…（deleteProjectWarningHint）；无任务：info 提示 deleteProjectWarningHint", "只读", "按任务数"],
        ["信息表", "KV 列表", "仓库路径（repoPath）/ 任务记录（deleteProjectRecords）{n} 个任务 / 默认基线（deleteProjectBase）", "只读", "常驻"],
        ["连同任务一起删除", "复选框", "连同任务一起删除（withTasks）", "必须勾选才能删除有任务的项目", "有任务时出现"],
        ["同时删除 worktree 文件夹", "复选框", "同时删除 worktree 文件夹（withWorktrees）；说明：强制删除磁盘上的 worktree 目录，未提交的改动会一并丢失。（withWorktreesHint）", "勾选连同磁盘目录删除", "「连同任务」未勾时禁用"],
        ["取消 / 删除项目", "Modal footer 按钮", "取消（cancel，autofocus）/ 删除项目（deleteProjectConfirm → deleting，danger）", "执行删除；Toast「项目「{name}」已删除」", "有任务未勾「连同任务」时禁用"],
        ["错误提示", "role=alert", "{err}", "只读", "失败"],
    ])],
})

PAGES.append({
    "id": "modal-cleanup-predecessor", "group": "modal", "title": "弹窗 · 清理前序任务的 worktree（发布续做后）",
    "route": "发布后续任务成功后，前序 worktree 仍存在时弹出",
    "layout": ["Modal 尺寸 sm、tone danger；危险列表 + 可选强制清理复选框；固定 footer（保留 / 清理 worktree）。"],
    "sections": [sec("内容与操作", ELEMENT_HEADERS, [
        ["标题", "Modal 头部", "清理前序任务的 worktree（cleanupPredecessorTitle）；副标题：前序任务已合并，可以清理它的 worktree 以释放空间。（cleanupPredecessorSub）；图标 trash；danger", "只读", "打开即显示"],
        ["危险列表", "列表", "标题：cleanupPredecessorSub；前序 worktree 路径", "只读", "常驻"],
        ["说明", "文本 hint", "只删除 worktree 目录，不删除分支和已有提交。（cleanupPredecessorHint）", "只读", "常驻"],
        ["强制清理", "复选框", "强制清理（cleanupPredecessorForce）；说明：前序 worktree 有 {n} 处未提交改动，强制清理会丢失这些改动。（cleanupPredecessorDirty）", "勾选允许强删", "无未提交改动时不显示"],
        ["保留 / 清理", "Modal footer 按钮", "保留（keepWorktree，autofocus）/ 清理 worktree（cleanup → cleaning，danger）", "保留则不清理；清理后 Toast「前序 worktree 已清理」", "执行中禁用"],
        ["错误提示", "role=alert", "{err}", "只读", "失败"],
    ])],
})

PAGES.append({
    "id": "modal-clear-recents", "group": "modal", "title": "弹窗 · 清空最近目录（设置页）",
    "route": "设置页「清空最近目录」触发",
    "layout": ["Modal 尺寸 sm、tone danger；危险列表（{n} 个目录）+ 说明；固定 footer（取消 / 清空最近目录）。"],
    "sections": [sec("内容与操作", ELEMENT_HEADERS, [
        ["标题", "Modal 头部", "清空最近目录（clearRecentsTitle）；副标题：将从设置页移除最近使用的仓库目录。（clearRecentsSub）；图标 trash；danger", "只读", "打开即显示"],
        ["危险列表", "列表", "标题：以下 {n} 个目录会从列表移除：（clearRecentsDanger）；逐条目录路径", "只读", "常驻"],
        ["说明", "文本 hint", "磁盘上的目录和仓库不会被删除，只清空这份列表。（clearRecentsHint）", "只读", "常驻"],
        ["取消 / 清空", "Modal footer 按钮", "取消（cancel，autofocus）/ 清空最近目录（clearRecents → deleting，danger）", "执行清空；Toast「清空最近目录」", "执行中禁用"],
        ["错误提示", "role=alert", "{err}", "只读", "失败"],
    ])],
})

PAGES.append({
    "id": "modal-switch-conflict", "group": "modal", "title": "弹窗 · 切换分支冲突处理（switchModal）",
    "route": "任务详情「切到任务分支验收 / 切回原分支」预检发现主仓库有未提交改动时",
    "layout": ["Modal 尺寸 sm、tone warn；头部标题为动作名（切到任务分支验收 / 切回原分支）；正文告警 + 阻塞文件列表（可滚动，max-height 200px）+ 固定 footer 三按钮。"],
    "sections": [sec("内容与操作", ELEMENT_HEADERS, [
        ["标题", "Modal 头部", "标题：切到任务分支验收（checkout）或 切回原分支（back）；副标题：主仓库有未提交改动，直接切换会被 Git 拒绝。（switchConflictSub）；图标 alert；warn", "只读", "checkout / back 预检不安全（safe=false）时"],
        ["告警", "文本", "以下 {n} 个文件会阻止切换，请选择处理方式：（switchConflictHint）", "只读", "常驻"],
        ["阻塞文件列表", "列表", "每个文件路径；未跟踪文件显示 chip「未跟踪」（switchUntracked）", "只读", "列表可滚动"],
        ["取消 / 暂存后切换 / 放弃改动后切换", "Modal footer 按钮", "取消（cancel，autofocus）/ 暂存后切换（switchStash，primary）/ 放弃改动后切换（switchDiscard，danger）", "stash：先暂存未提交改动再切换；discard：放弃改动后切换；成功后关闭", "执行中禁用"],
        ["错误提示", "role=alert", "{err}", "只读", "失败"],
    ])],
})

# ============================ 项目详情 ============================
PAGES.append({
    "id": "project-detail", "group": "page", "title": "项目详情（ProjectDetail）",
    "route": "左侧项目主体按钮 / 选中项目时（右栏）",
    "layout": ["纵向卡片流：页头 → 概览卡（4 统计 + 待处理提示 + 键值）→ 项目设置卡（表单）→ 删除项目卡。",
        "页头为横向：图标 + 标题/副信息 + 右侧操作（发布任务 + 更多操作菜单）。",
        "概览统计 4 卡网格；≤700px 容器变为两列。"],
    "sections": [
        sec("页头（page-head）", ELEMENT_HEADERS, [
            ["图标 + 项目名", "文本（folder 图标）", "项目名（h1）", "只读", "常驻"],
            ["仓库路径", "文本 + 复制按钮", "仓库路径 + 复制仓库路径（copyRepoPath）", "点击复制；Toast 已复制/复制失败", "常驻"],
            ["任务数", "文本", "· {n} 个任务（taskUnit）", "只读", "常驻"],
            ["发布任务按钮", "按钮（play）", "发布任务（publish）", "打开该项目发布任务弹窗", "常驻"],
            ["更多操作菜单", "details/summary（more）", "aria-label / title：操作（operations）", "点击展开下拉菜单", "常驻"],
            ["· 菜单项：发布任务", "MenuItem（plus）", "发布任务（publish）", "打开发布弹窗", "菜单内"],
            ["· 菜单项：复制仓库路径", "MenuItem（copy）", "复制仓库路径（copyRepoPath）", "复制并 Toast", "菜单内"],
            ["· 菜单项：删除项目", "MenuItem（trash, danger）", "删除项目（deleteProject）", "打开删除项目弹窗", "菜单内（分隔线之下）"],
        ]),
        sec("概览卡（overview）", ELEMENT_HEADERS, [
            ["卡头", "CardHead（grid）", "概览（overview）+ 右侧：按 Git 与会话状态推导（overviewHint）", "只读", "常驻"],
            ["统计卡 ×4", "Stat", "任务总数（totalTasks）/ 进行中（activeTasks）/ 待验收（reviewTasks）/ 已合并（mergedTasks）", "只读", "常驻"],
            ["待处理提示", "行 + 链接", "{n} 个任务等待处理（attention）+ 查看（view）", "点击查看跳转首个待处理任务", "有 pending 任务时"],
            ["键值", "KV 列表", "仓库路径（+复制）/ 默认基线分支（defaultBase）/ 分支前缀（branchPrefix, code）/ Worktree 目录（worktreeDirName, code）", "复制仓库路径", "常驻"],
        ]),
        sec("项目设置卡（project settings）", ELEMENT_HEADERS, [
            ["卡头", "CardHead（sliders）", "项目设置（projectSettings）+ 说明：覆盖全局的分支与 worktree 命名规则，只影响此后发布的任务。（projectSettingsHint）", "只读", "常驻"],
            ["项目名称", "输入框", "项目名称（projectName）+ 提示：只影响看板显示，不会改写仓库。（projectNameHint）", "编辑", "必填（空提示 requiredField）"],
            ["默认基线分支", "BranchCombobox", "默认基线分支（defaultBase）+ 加载/失败提示", "可搜索过滤", "—"],
            ["分支前缀", "输入框 mono", "分支前缀（branchPrefix）+ 提示：自动分支为前缀加 8 位任务 ID。（branchPrefixHint）", "编辑", "占位 dsh-wt/"],
            ["Worktree 目录", "输入框 mono", "Worktree 目录（worktreeDirName）+ 提示：相对仓库根目录，并写入 .git/info/exclude。（worktreeDirHint）", "编辑", "占位 .dsh-worktrees"],
            ["保存", "按钮 primary（submit）", "保存（save → saving）", "提交保存；成功右侧显示「已保存」（saved）约 3.2s", "保存中 Spinner + 禁用"],
            ["错误提示", "role=alert", "{err}", "只读", "失败"],
        ]),
        sec("删除项目卡", ELEMENT_HEADERS, [
            ["卡头", "CardHead（alert, danger）", "删除项目（deleteProject）", "只读", "常驻"],
            ["说明", "文本", "删除后，项目配置与任务记录会从工作台移除；仓库和提交不会被删除。（deleteProjectCardHint）", "只读", "常驻"],
            ["删除项目按钮", "按钮 danger（trash）", "删除项目（deleteProject）", "打开删除项目弹窗", "处理中禁用"],
        ]),
    ],
})

# ============================ 设置页 ============================
PAGES.append({
    "id": "settings", "group": "page", "title": "设置页（SettingsPage，settings.section）",
    "route": "宿主设置区 settings.section",
    "layout": ["外层可滚动（overflow:auto）；内容纵向卡片流：页头 → 验收标准库 → 最近目录 → 配置。",
        "验收标准库：输入 + 添加按钮一行，下方列表逐行（勾图标 + 文本 + 移除按钮）。",
        "最近目录：逐行（文件夹图标 + 路径 + 复制），底部危险行放置清空按钮。"],
    "sections": [
        sec("页头", ELEMENT_HEADERS, [
            ["图标 + 标题", "文本（settings 图标）", "标题：Worktree 任务（title）；说明：全局配置与最近使用的仓库目录。（settingsSub）", "只读", "常驻"],
        ]),
        sec("验收标准库卡", ELEMENT_HEADERS, [
            ["卡头", "CardHead（checkCircle）", "验收标准库（acceptanceLibrary）+ 说明：在这里维护可复用的验收标准；发布任务时可勾选，也可临时手动补充。（acceptanceLibraryHint）", "只读", "常驻"],
            ["添加行", "输入框 + 按钮", "输入占位：输入一条验收标准（criterionInputPlaceholder）；按钮：添加（addCriterion，primary）", "Enter 或点添加提交；成功 Toast「已添加验收标准」", "输入为空或处理中禁用"],
            ["标准列表行", "行 + 移除按钮", "勾图标 + 文本 + 移除（x，aria 移除 removeCriterion）", "点击移除；Toast「已移除验收标准」", "有标准时"],
            ["空态", "文本 hint", "暂无验收标准，先在上方添加一条。（acceptanceLibraryEmpty）", "只读", "无标准"],
        ]),
        sec("最近目录卡", ELEMENT_HEADERS, [
            ["卡头", "CardHead（clock）", "最近目录（recents）+ 右侧：{n} 个目录（dirUnit）", "只读", "常驻"],
            ["目录行", "行 + 复制按钮", "文件夹图标 + 路径 + 复制路径（copyPath）", "点击复制；Toast 已复制/复制失败", "有目录时"],
            ["空态", "文本 hint", "暂无最近目录。（recentsEmpty）", "只读", "无目录"],
            ["说明", "文本 hint", "新增项目弹窗不会展示这些目录，这里仅供快速复制与清理。（recentsHint）", "只读", "常驻"],
            ["危险行", "行 + 按钮 danger", "清空后不会删除磁盘上的目录，只会从列表中移除。（clearRecentsShortHint）+ 清空最近目录（clearRecents）", "打开清空最近目录弹窗", "无目录时禁用"],
        ]),
        sec("配置卡", ELEMENT_HEADERS, [
            ["卡头", "CardHead（sliders）", "配置（config）+ 说明：由宿主配置提供，只读。（configHint）", "只读", "常驻"],
            ["键值", "KV 列表", "Worktree 目录（worktreeDirName）/ 分支前缀（branchPrefix）/ Git（gitPath），均为只读 code", "只读", "常驻"],
        ]),
    ],
})

# ============================ 布局与响应式（全局） ============================
LAYOUT_SECTIONS = [
    sec("主布局（工作台）", ["项目", "规则"], [
        ["Grid", "grid-template-columns: 320px minmax(0, 1fr)；左栏 320px，右栏自适应"],
        ["右侧阅读宽度", "详情内容限制 960px（.dshw-detail-inner），避免宽屏键值行无限拉伸"],
        ["滚动", "外层 height:100%、min-height:0；列表与详情分别滚动，页面不承担双滚动"],
        ["溢出处理", "标题/路径用 min-width:0 + 省略/换行；路径、分支、会话 ID 等用等宽字体并 overflow-wrap:anywhere"],
        ["切换重置", "切换任务或项目时详情滚动位置回到顶部"],
    ]),
    sec("容器断点（@container dshw，按插件自身宽度而非视口）", ["容器宽度", "行为"], [
        ["> 860px", "双栏，左栏 320px"],
        ["≤ 860px", "双栏，左栏缩至 268px，详情内边距收紧"],
        ["≤ 700px", "概览统计两列；实时会话侧栏改为上下排列"],
        ["≤ 620px", "单栏：列表与详情二选一，详情显示「返回项目列表」按钮"],
        ["≤ 420px", "键值行改为上下排列；项目行新增按钮换行；弹窗接近全宽"],
    ]),
    sec("卡片与浮层", ["组件", "规则"], [
        ["卡片", "圆角 12px；普通图标按钮 32×32；紧凑按钮最低 27px"],
        ["按钮 / 输入框", "圆角 8px；输入框、下拉框最小高度 36px"],
        ["弹窗", "圆角 14px；居中浮层 + 遮罩；footer 与正文分离固定"],
        ["阴影", "只用于浮层与卡片层级，不叠加装饰性阴影"],
        ["动效", "常规过渡 120–150ms；待处理圆点可轻微脉冲；prefers-reduced-motion 下关闭"],
        ["字体", "继承宿主字体；基础字号 13px；标题/主操作 600–650 字重；正文 13px、辅助 12px、摘要 11px"],
    ]),
    sec("区域结构（信息架构）", ["区域", "内容"], [
        ["左侧项目树", "搜索 / 刷新 / 新增项目；项目行（折叠、选中、任务数、发布）；任务行（选中、状态、领先/改动、打开会话、归档）"],
        ["右侧详情 · 任务", "任务摘要、会话、改动文件、会话信息、验收操作、Worktree/主仓库、归档、危险操作"],
        ["右侧详情 · 项目", "页头、发布任务、更多操作、概览统计、待处理提示、项目设置、删除项目"],
        ["设置页", "验收标准库、最近目录、只读全局配置"],
    ]),
]

# ============================ 全局交互 ============================
INTERACTION_SECTIONS = [
    sec("快捷键", ["快捷键", "作用", "生效条件"], [
        ["/", "聚焦搜索框", "焦点位于插件内部，且不在输入框中"],
        ["Ctrl/Cmd + K", "聚焦搜索框", "同上；不劫持宿主聊天输入"],
        ["Esc", "清空搜索 / 关闭已展开的下拉菜单 / 关闭弹窗（忙碌时禁止关闭）", "对应上下文"],
        ["Tab / Shift+Tab", "在弹窗内循环焦点", "弹窗打开时"],
        ["↑ / ↓ / Enter", "组合框（分支 / 模型）键盘导航与选择", "下拉面板展开时；Esc 只关列表不关弹窗"],
    ]),
    sec("弹窗通用行为（Modal）", ["行为", "说明"], [
        ["ARIA", "role=dialog、aria-modal=true、aria-labelledby 指向标题"],
        ["初始焦点", "优先 data-autofocus，否则首个表单控件，否则首个可聚焦元素"],
        ["焦点圈定", "Tab / Shift+Tab 在弹窗内循环"],
        ["关闭", "Esc 关闭；点遮罩关闭；忙碌（busy）时均禁止关闭"],
        ["焦点恢复", "关闭后焦点恢复到触发元素（60ms 后延迟恢复）"],
        ["滚动锁定", "打开时锁定 body 滚动，支持多层计数"],
        ["错误显示", "操作失败错误显示在当前弹窗内（role=alert）"],
    ]),
    sec("组合框（BranchCombobox / ModelCombobox）", ["行为", "说明"], [
        ["展开方式", "面板在字段下方就地展开，避免被弹窗滚动容器裁剪"],
        ["搜索", "输入即过滤（大小写不敏感）；清空按钮复位"],
        ["键盘", "↑↓ 移动，Enter 选择，Esc 只关闭列表"],
        ["分支标记", "当前分支显示「当前分支」标签；无匹配显示「没有匹配的分支」"],
        ["模型标记", "含「默认模型」项；无匹配显示「暂无可用模型」"],
    ]),
    sec("轮询与刷新", ["对象", "频率 / 规则"], [
        ["工作台项目视图", "每 4 秒刷新；页面不可见时暂停；失败指数退避（最长 30s）；窗口重新聚焦立即刷新"],
        ["任务合并预检", "任务详情每 15 秒请求 task/merge-preview"],
        ["会话投影", "选中任务会话每 4 秒拉取一次"],
        ["会话健康", "每 12 秒拉取各绑定会话最近一轮结束原因"],
        ["手动刷新", "独立进行中状态，完成后 Toast「已刷新任务状态」"],
    ]),
    sec("Toast 与异步反馈", ["项目", "说明"], [
        ["位置 / 语义", "底部居中；role=status（成功）/ role=alert（错误）；aria-live polite / assertive"],
        ["时长", "约 2.8s 自动消失，不阻塞操作"],
        ["典型文案", "已复制 / 复制失败 / 已刷新任务状态 / 会话已创建并绑定 worktree / 已合并到 {base} / worktree 已清理 / 任务记录已删除 / 项目「{name}」已删除 / 项目「{name}」已新增 / 任务已发布 · {branch} / 任务已归档 / 已取消归档 / 已添加验收标准 / 已移除验收标准 / 已发送同步基线指令"],
    ]),
]

STATUS_ROWS = [
    ["待开始 ready", "neutral", "「待开始」"],
    ["已清理 cleaned", "neutral", "「已清理」"],
    ["进行中 developing", "brand", "「进行中」"],
    ["验收中 reviewing", "brand", "「验收中」"],
    ["待验收 review", "warn", "「待验收」"],
    ["已合并 merged", "success", "「已合并」"],
    ["异常 broken", "error", "「异常」"],
    ["待审批 / 计划待审 / 待回答", "warn", "pending chip（第二 chip）"],
    ["操作失败", "error", "错误 Banner / Toast"],
]
STATUS_SECTION = sec("状态 tone 映射（STATUS_TONE）", ["状态", "Tone", "呈现"], STATUS_ROWS)


def read_locale(name):
    with open(os.path.join(ROOT, "locale", name), "r", encoding="utf-8") as f:
        return json.load(f)


# --------------------------------------------------------------------------
# Markdown
# --------------------------------------------------------------------------
def md_escape(text):
    s = "" if text is None else str(text)
    s = s.replace("\\", "\\\\").replace("|", "\\|").replace("\r", "")
    return s.replace("\n", "<br>")


def render_md():
    zh = read_locale("zh.json")
    en = read_locale("en.json")
    L = []
    L.append("# dsh-worktree 前端 UI 结构化清单")
    L.append("")
    L.append("`@5318vo/dsh-worktree` · 基于 `src/client/*.ts`、`src/client.ts`、`locale/zh.json`、`locale/en.json` 整理。")
    L.append("")
    L.append("> 约定：**文案 / 语义 key** 一栏中，括号内是 `locale/*.json` 的 key（如 `publish` = 发布任务 / Publish task）。"
             "所有可见文案均来自 locale，不在组件内硬编码。布局规则见第 7 节与各页「布局」说明。")
    L.append("")
    L.append("## 0. 页面与挂载点总览")
    L.append("")
    L.append("| # | 页面 / 界面 | 宿主挂载点 | 组件 |")
    L.append("| --- | --- | --- | --- |")
    L.append("| 1 | 工作台（Worktree 任务） | `main` slot（key=worktree-board） | BoardPage |")
    L.append("| 2 | 侧栏入口图标 | `sidebar.panellist`（id=worktree-board） | BoardIcon |")
    L.append("| 3 | 设置页 | `settings.section`（id=deepseek-worktree-settings） | SettingsPage |")
    L.append("")
    L.append("工作台内部再由右侧详情容器路由到「任务详情」「项目详情」；共 9 个弹窗。")
    L.append("")

    page_idx = 0
    for page in PAGES:
        if page["group"] != "page":
            continue
        page_idx += 1
        L.append("## %d. %s" % (page_idx, page["title"]))
        L.append("")
        if page.get("route"):
            L.append("**路由 / 入口**：%s" % md_escape(page["route"]))
            L.append("")
        if page.get("layout"):
            L.append("**布局**：")
            L.append("")
            for item in page["layout"]:
                L.append("- %s" % item)
            L.append("")
        for s in page["sections"]:
            L.append("### %s" % s["title"])
            L.append("")
            L.append("| " + " | ".join(s["headers"]) + " |")
            L.append("| " + " | ".join("---" for _ in s["headers"]) + " |")
            for row in s["rows"]:
                L.append("| " + " | ".join(md_escape(c) for c in row) + " |")
            L.append("")

    # modals
    modal_idx = 0
    L.append("## %d. 弹窗清单（Modal）" % (page_idx + 1))
    L.append("")
    L.append("所有弹窗复用统一 `Modal` 组件：`role=dialog`、`aria-modal`、焦点圈定、Esc 关闭（忙碌时禁止）、关闭后焦点恢复；footer 与正文分离。")
    L.append("")
    for page in PAGES:
        if page["group"] != "modal":
            continue
        modal_idx += 1
        L.append("### 6.%d %s" % (modal_idx, page["title"].split("·", 1)[-1].strip()))
        L.append("")
        if page.get("route"):
            L.append("**入口**：%s" % md_escape(page["route"]))
            L.append("")
        if page.get("layout"):
            L.append("**布局**：")
            L.append("")
            for item in page["layout"]:
                L.append("- %s" % item)
            L.append("")
        for s in page["sections"]:
            L.append("| " + " | ".join(s["headers"]) + " |")
            L.append("| " + " | ".join("---" for _ in s["headers"]) + " |")
            for row in s["rows"]:
                L.append("| " + " | ".join(md_escape(c) for c in row) + " |")
            L.append("")

    # layout
    L.append("## %d. 布局与响应式" % (page_idx + 2))
    L.append("")
    for s in LAYOUT_SECTIONS:
        L.append("### %s" % s["title"])
        L.append("")
        L.append("| " + " | ".join(s["headers"]) + " |")
        L.append("| " + " | ".join("---" for _ in s["headers"]) + " |")
        for row in s["rows"]:
            L.append("| " + " | ".join(md_escape(c) for c in row) + " |")
        L.append("")

    # interactions
    L.append("## %d. 全局交互与通用行为" % (page_idx + 3))
    L.append("")
    for s in INTERACTION_SECTIONS:
        L.append("### %s" % s["title"])
        L.append("")
        L.append("| " + " | ".join(s["headers"]) + " |")
        L.append("| " + " | ".join("---" for _ in s["headers"]) + " |")
        for row in s["rows"]:
            L.append("| " + " | ".join(md_escape(c) for c in row) + " |")
        L.append("")

    # status
    L.append("## %d. 状态与配色语义" % (page_idx + 4))
    L.append("")
    L.append("| " + " | ".join(STATUS_SECTION["headers"]) + " |")
    L.append("| " + " | ".join("---" for _ in STATUS_SECTION["headers"]) + " |")
    for row in STATUS_SECTION["rows"]:
        L.append("| " + " | ".join(md_escape(c) for c in row) + " |")
    L.append("")
    L.append("> 全部颜色集中在 `src/client/palette.ts` 的 `PALETTE`（明/暗两套），禁止在样式或组件内写死颜色；状态色由 `STATUS_TONE` 统一映射。")
    L.append("")

    # locale appendix
    L.append("## %d. 附录：完整文案字典（中英对照，%d 条）" % (page_idx + 5, len(zh)))
    L.append("")
    L.append("| key | 中文 | English |")
    L.append("| --- | --- | --- |")
    for k, v in zh.items():
        L.append("| %s | %s | %s |" % (md_escape(k), md_escape(v), md_escape(en.get(k, ""))))
    L.append("")

    # known gaps
    L.append("## %d. 已知缺口 / 备注" % (page_idx + 6))
    L.append("")
    L.append("- `t.reconnecting`（「重新连接中…」）在 `src/client/board-page.ts` 中被引用，但 `locale/zh.json`、`locale/en.json` 均无该 key，实际会显示为空。")
    L.append("- 分支切换（checkout / back）改为先调用预检接口：安全时直接切换；主仓库有未提交改动时弹出「切换分支冲突处理」弹窗，可选择「暂存后切换」或「放弃改动后切换」。")
    L.append("- `locale` 中存在少量当前组件未直接引用的 key（如 liveModel / liveTurns / liveTurnN / liveQueued / liveSubagents / livePerms / preview / previewBranch / previewDir / confirmDelete / confirmMerge / confirmCleanup / detail / description / session / onBranch / acceptReviewOther 等），保留为兼容/未来使用。")
    L.append("")
    return "\n".join(L)


# --------------------------------------------------------------------------
# JSON
# --------------------------------------------------------------------------
def render_json():
    zh = read_locale("zh.json")
    en = read_locale("en.json")
    return {
        "plugin": "@5318vo/dsh-worktree",
        "generatedFrom": ["src/client/*.ts", "src/client.ts", "locale/zh.json", "locale/en.json"],
        "conventions": {
            "labelKey": "locale key in parentheses",
            "layoutAndBreakpoints": "section layout",
        },
        "mountPoints": [
            {"surface": "工作台", "slot": "main", "key": "worktree-board", "component": "BoardPage"},
            {"surface": "侧栏入口", "slot": "sidebar.panellist", "id": "worktree-board", "component": "BoardIcon"},
            {"surface": "设置页", "slot": "settings.section", "id": "deepseek-worktree-settings", "component": "SettingsPage"},
        ],
        "pages": PAGES,
        "layout": LAYOUT_SECTIONS,
        "interactions": INTERACTION_SECTIONS,
        "statusTones": STATUS_SECTION,
        "locale": {"zh": zh, "en": en},
    }


# --------------------------------------------------------------------------
# XLSX
# --------------------------------------------------------------------------
THIN = Side(style="thin", color="D6DBE3")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
HEAD_FILL = PatternFill("solid", fgColor="2563EB")
HEAD_FONT = Font(color="FFFFFF", bold=True, size=10)
TITLE_FONT = Font(bold=True, size=13, color="1F2937")
WRAP = Alignment(wrap_text=True, vertical="top")
TOP = Alignment(vertical="top")


def style_sheet(ws, headers, rows, widths):
    ws.append(headers)
    for c in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=c)
        cell.fill = HEAD_FILL
        cell.font = HEAD_FONT
        cell.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
        cell.border = BORDER
    for row in rows:
        ws.append(["" if v is None else str(v) for v in row])
    for r in range(2, ws.max_row + 1):
        for c in range(1, len(headers) + 1):
            cell = ws.cell(row=r, column=c)
            cell.alignment = WRAP
            cell.border = BORDER
            cell.font = Font(size=9)
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A2"


def write_blocks(ws, blocks):
    """Heterogeneous sections: each block = 类别标题行 + 表头行 + 数据行."""
    for blk in blocks:
        ncol = len(blk["headers"])
        ws.append([blk["title"]] + [""] * (ncol - 1))
        title_row = ws.max_row
        ws.merge_cells(start_row=title_row, start_column=1, end_row=title_row, end_column=max(ncol, 1))
        c = ws.cell(row=title_row, column=1)
        c.font = Font(bold=True, size=10, color="1F2937")
        c.fill = PatternFill("solid", fgColor="E8EEFB")
        ws.append(blk["headers"])
        hr = ws.max_row
        for i in range(1, ncol + 1):
            hc = ws.cell(row=hr, column=i)
            hc.fill = HEAD_FILL
            hc.font = HEAD_FONT
            hc.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
            hc.border = BORDER
        for row in blk["rows"]:
            ws.append(["" if v is None else str(v) for v in row])
            r = ws.max_row
            for i in range(1, ncol + 1):
                dc = ws.cell(row=r, column=i)
                dc.alignment = WRAP
                dc.border = BORDER
                dc.font = Font(size=9)
        ws.append([])


def render_xlsx(path):
    zh = read_locale("zh.json")
    en = read_locale("en.json")
    wb = Workbook()

    # --- 概览 ---
    ws = wb.active
    ws.title = "概览"
    ws["A1"] = "@5318vo/dsh-worktree 前端 UI 结构化清单"
    ws["A1"].font = TITLE_FONT
    ws["A2"] = "基于 src/client/*.ts、src/client.ts、locale/zh.json、locale/en.json 整理"
    ws["A2"].font = Font(size=9, color="6B7280")
    rows = []
    rows.append(["工作台（Worktree 任务）", "main slot / BoardPage", "左侧项目树 + 右侧详情（任务/项目）"])
    rows.append(["项目详情", "右栏 / ProjectDetail", "页头、概览、设置、删除"])
    rows.append(["任务详情", "右栏 / TaskDetail", "Hero、实时会话、改动文件、验收、危险操作等"])
    rows.append(["设置页", "settings.section / SettingsPage", "验收标准库、最近目录、只读配置"])
    rows.append(["弹窗", "Modal", "新增项目、发布任务、合并、清理、删除任务、删除项目、清理前序、清空最近目录（+1 未渲染切换预检）"])
    rows.append(["快捷键", "全局", "/、Ctrl/Cmd+K、Esc、Tab、↑↓ Enter"])
    style_sheet(ws, ["界面", "挂载 / 组件", "内容"], rows, [26, 40, 70])
    ws["A1"].alignment = TOP

    # --- 页面与元素 ---
    ws = wb.create_sheet("页面与元素")
    rows = []
    for p in PAGES:
        if p["group"] != "page":
            continue
        for s in p["sections"]:
            for r in s["rows"]:
                rows.append([p["title"], s["title"]] + list(r))
    style_sheet(ws, ["页面", "分区", "元素", "类型", "文案 / 语义 key", "交互 / 行为", "状态 / 条件"], rows,
                [22, 22, 20, 20, 46, 44, 26])

    # --- 弹窗 ---
    ws = wb.create_sheet("弹窗")
    rows = []
    for p in PAGES:
        if p["group"] != "modal":
            continue
        for s in p["sections"]:
            for r in s["rows"]:
                rows.append([p["title"], s["title"]] + list(r))
    style_sheet(ws, ["弹窗", "分区", "元素", "类型", "文案 / 语义 key", "交互 / 行为", "状态 / 条件"], rows,
                [30, 14, 20, 20, 50, 44, 26])

    # --- 布局 ---
    ws = wb.create_sheet("布局")
    rows = []
    for s in LAYOUT_SECTIONS:
        for r in s["rows"]:
            rows.append([s["title"]] + list(r))
    style_sheet(ws, ["布局类别", "项目", "规则"], rows, [22, 26, 90])

    # --- 交互（异构分区，用分块写法） ---
    ws = wb.create_sheet("全局交互")
    write_blocks(ws, INTERACTION_SECTIONS)
    for i, w in enumerate([26, 30, 70, 34], start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

    # --- 状态 ---
    ws = wb.create_sheet("状态与配色")
    style_sheet(ws, STATUS_SECTION["headers"], STATUS_SECTION["rows"], [30, 14, 40])

    # --- 文案字典 ---
    ws = wb.create_sheet("文案字典")
    rows = [[k, v, en.get(k, "")] for k, v in zh.items()]
    style_sheet(ws, ["key", "中文", "English"], rows, [30, 60, 60])

    wb.save(path)


def main():
    os.makedirs(DOCS, exist_ok=True)
    md = render_md()
    with open(os.path.join(DOCS, "frontend-ui-inventory.md"), "w", encoding="utf-8") as f:
        f.write(md)
    data = render_json()
    with open(os.path.join(DOCS, "frontend-ui-inventory.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    render_xlsx(os.path.join(DOCS, "frontend-ui-inventory.xlsx"))
    print("OK: md/json/xlsx written to", DOCS)


if __name__ == "__main__":
    main()
