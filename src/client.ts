/** Client half: workbench board (task tree + detail) + publish form + settings page. */

export const MODULE_ID = '@5318vo/dsh-worktree'

type Req = (m: string) => any

const FALLBACK: Record<string, any> = {
  en: {
    title: 'Worktree Tasks',
    publish: 'Publish task',
    repoPath: 'Target directory',
    repoPathHint: 'Repository directory',
    browse: 'Browse…',
    pickingDirectory: 'Choosing…',
    baseBranch: 'Base branch',
    chooseDirFirst: 'Choose a directory to load branches',
    loadingBranches: 'Loading branches…',
    branchName: 'Task branch',
    branchNameHint: 'Auto (hash)',
    taskTitle: 'Title',
    taskDescription: 'Task description',
    startNow: 'Start immediately after creation',
    publishing: 'Publishing…',
    openSessionBtn: 'Open session',
    live: 'Live',
    liveModel: 'Model',
    liveCwd: 'Working dir',
    liveCwdOff: 'Not switched to the worktree yet',
    livePressure: 'Context',
    liveTokens: 'Tokens',
    liveTokensIn: 'in',
    liveTokensOut: 'out',
    liveTokensCache: 'cached',
    liveTodos: 'Todos',
    liveTurns: 'Turns',
    liveTurnN: 'Turn {n}',
    liveTurnEmpty: 'No turns yet',
    liveQueued: 'Queued msgs',
    liveSubagents: 'Subagents',
    livePerms: 'Access',
    liveLastPrompt: 'Last prompt',
    liveStats: '{turns} turns · {steps} steps',
    liveStepsOnly: '{steps} steps',
    roleUser: 'You',
    roleAssistant: 'Agent',
    roleThinking: 'Think',
    roleTool: 'Tool',
    roleResult: 'Result',
    roleError: 'Error',
    duration: 'Lasted {s}',
    stepDone: 'Done',
    stepFailed: 'Failed',
    stepRunning: 'Running',
    toolTerminal: 'Terminal',
    toolRead: 'Read',
    toolEdit: 'Edit',
    toolFind: 'Find',
    toolCd: 'Cd',
    toolTodos: 'Tasks',
    toolQuestion: 'Question',
    toolGeneric: 'Tool',
    pendingApproval: 'Waiting approval',
    pendingPlanReview: 'Plan review',
    pendingQuestion: 'Waiting answer',
    pendingHint: 'The session is waiting for you. Open it to continue.',
    sessionInterrupted: 'Session interrupted',
    sessionError: 'Session error',
    sessionInterruptedHint: 'The last run of this session was interrupted. The worktree may still contain unfinished changes.',
    sessionErrorHint: 'The last run of this session failed. Open the session to inspect the error.',
    projects: 'Projects',
    addProject: 'Add project',
    addTask: 'Publish task',
    projectDetail: 'Project',
    overview: 'Overview',
    projectSettings: 'Project settings',
    projectName: 'Name',
    defaultBase: 'Default base branch',
    worktreeDirName: 'Worktree directory',
    gitPath: 'Git',
    branchPrefix: 'Branch prefix',
    save: 'Save',
    saved: 'Saved',
    deleteProject: 'Delete project',
    withTasks: 'Also delete task records',
    tasksUnit: 'Tasks',
    noProjects: 'No projects',
    developing: 'In progress',
    review: 'Ready for review',
    reviewing: 'Reviewing',
    merged: 'Merged',
    cleaned: 'Cleaned',
    broken: 'Broken',
    noTasks: 'No tasks',
    noSession: 'No session yet',
    createSession: 'Create session',
    checkout: 'Switch to task branch',
    back: 'Switch back',
    merge: 'Merge into base',
    cleanup: 'Clean worktree',
    deleteRecord: 'Delete record',
    deleteBranch: 'Also delete branch',
    force: 'Force',
    dirty: 'uncommitted changes',
    uncommitted: 'Uncommitted changes',
    changesUnit: 'files',
    clean: 'Working tree clean',
    commitsAhead: 'commits ahead',
    openSessionFailed: 'Could not open session',
    confirmDelete: 'Delete this task record?',
    config: 'Config',
    recents: 'Recent directories',
    clearRecents: 'Clear recents',
    loading: 'Loading…',
    loadFailed: 'Load failed',
    failed: 'Operation failed',
    publishTimeout: 'Publish timed out — refresh the board to confirm whether the task was created',
    bindTimeout: 'Task created, but session creation timed out — open or create the session from the board later',
    handlePending: 'Review',
    close: 'Close',
    refresh: 'Refresh',
    detail: 'Task detail',
    description: 'Description',
    worktree: 'Worktree',
    mainRepo: 'Main repo',
    currentBranch: 'Current branch',
    originalBranch: 'Branch before review',
    session: 'Session',
    sessionRunning: 'Working',
    sessionIdle: 'Idle',
    mergedFlag: 'Merged into base',
    branchMissing: 'Branch missing',
    onBranch: 'Main repo is on this branch',
    commits: 'Commits ahead of base',
    selectTask: 'No task selected',
    ready: 'Ready',
    path: 'Path',
    status: 'Status',
    sessionId: 'Session ID',
    operations: 'Actions',
    dangerZone: 'Danger zone',
    creatingSession: 'Creating session…',
    saving: 'Saving…',
    confirmMerge: 'Merge this task branch into its base branch?',
    confirmCleanup: 'Remove this worktree? Review the branch and uncommitted changes before continuing.',
    backToList: 'Back to projects',
    retry: 'Retry',
    loadBranchesFailed: 'Could not load branches. You can enter a branch manually or retry.',
    requiredField: 'This field is required',
    cancel: 'Cancel',
    expand: 'Expand',
    collapse: 'Collapse',

    search: 'Search projects, tasks or branches',
    noProjectsHint: 'Choose a Git repository to start publishing worktree tasks.',
    noMatch: 'No matching projects',
    noMatchHint: 'Try another keyword, or clear the search to see everything.',
    clearSearch: 'Clear search',
    projectUnit: 'projects',
    taskUnit: 'tasks',
    dirUnit: 'directories',
    addProjectSub: 'Choose a Git repository, load its branches and set a default base.',
    totalTasks: 'Total tasks',
    activeTasks: 'In progress',
    reviewTasks: 'Ready',
    mergedTasks: 'Merged',
    overviewHint: 'Derived from Git and session state',
    attention: '{n} tasks need attention',
    view: 'View',
    lastActivity: 'Last activity',
    justNow: 'just now',
    minutesAgo: '{n} min ago',
    hoursAgo: '{n} h ago',
    daysAgo: '{n} d ago',
    liveSession: 'Live session',
    sessionInfo: 'Session',
    noSessionHint: 'Create a session to see live turns, todos and context usage here.',
    noTurns: 'No turns yet',
    acceptance: 'Review actions',
    acceptanceHintClean: 'The worktree has been cleaned; review actions are unavailable.',
    acceptanceHintMerged: 'Merged into the base branch. You can clean the worktree now.',
    acceptanceHintBroken: 'The worktree state is broken. Fix it before reviewing.',
    acceptanceHintDirty: '{n} uncommitted changes. Commit or stash before switching or merging.',
    acceptanceHintRepoDirty: 'The main repo has {n} uncommitted changes. Commit or stash them before switching branches.',
    acceptanceHintNoAhead: 'No commits ahead of the base yet.',
    acceptanceHintCheckedOut: 'The main repo is on the task branch. Switch back when done.',
    acceptanceHintDefault: 'Switching and merging check the working tree first.',
    cleanupHint: 'Cleaning removes the worktree directory. Deleting a record only hides it from the board.',
    mergeTitle: 'Merge into {base}',
    mergeSub: 'Merge the task branch commits into the base branch.',
    mergeCleanHint: 'Make sure the code passed required checks and has no conflicts.',
    mergeDirtyTitle: 'Uncommitted changes in the worktree',
    mergeDirtyHint: 'Commit or stash them before merging.',
    cleanupTitle: 'Clean worktree',
    cleanupSub: 'Remove the worktree and its files.',
    cleanupDangerTitle: 'These will be permanently deleted:',
    cleanupDirtyGone: '{n} uncommitted changes will be lost',
    cleanupCleanNote: 'Working tree is clean',
    worktreeRemovedHint: 'The worktree directory was removed. The path is kept for reference.',
    cleanupForceHint: 'Clean even when uncommitted changes exist.',
    cleanupBranchHint: 'Delete the local branch after cleaning.',
    deleteTaskTitle: 'Delete task record',
    deleteTaskWarning: 'This cannot be undone',
    deleteTaskWarningHint: 'The record is removed from the board; the worktree and branch stay on disk.',
    deleteTaskHint: 'Merge first if you still need the code.',
    deleteProjectTitle: 'Delete project',
    deleteProjectWarning: 'The project still has {n} task records',
    deleteProjectWarningHint: 'Delete them together to remove the project. The repository, worktrees and commits stay on disk.',
    deleteProjectCardHint: 'Removing a project hides its configuration and task records from the board. The repository, worktrees and commits stay on disk.',
    deleteProjectRecords: 'Task records',
    deleteProjectBase: 'Default base',
    clearRecentsTitle: 'Clear recent directories',
    clearRecentsSub: 'Remove recent repository directories from settings.',
    clearRecentsDanger: 'These {n} directories will be removed:',
    clearRecentsHint: 'Directories and repositories on disk are not deleted.',
    copied: 'Copied',
    copyFailed: 'Copy failed, select manually',
    refreshed: 'Task status refreshed',
    sessionCreated: 'Session created and bound to the worktree',
    mergeDone: 'Merged into {base}',
    cleanupDone: 'Worktree cleaned',
    cleanupDoneBranch: 'Worktree and branch cleaned',
    recordDeleted: 'Task record deleted',
    projectDeleted: 'Project "{name}" deleted',
    projectAdded: 'Project "{name}" added',
    published: 'Task published · {branch}',
    branchRule: 'Leave empty to auto-generate {pattern}. ASCII letters, digits, dot, underscore and slash only.',
    branchInvalid: 'Use ASCII letters, digits, dot, underscore and slash only.',
    advanced: 'Advanced',
    preview: 'Preview',
    previewBranch: 'Branch',
    previewDir: 'Directory',
    projectSettingsHint: 'Override branch and worktree naming. Applies to future tasks only.',
    projectNameHint: 'Display name only; the repository is untouched.',
    worktreeDirHint: 'Relative to the repository root; added to .git/info/exclude.',
    branchPrefixHint: 'Auto branches use the prefix plus the 8-character task ID.',
    statusSyncFailed: 'Status sync failed',
    mergeConfirm: 'Merge',
    deleteRecordConfirm: 'Delete record',
    deleteProjectConfirm: 'Delete project',
    settingsSub: 'Global configuration and recent repository directories.',
    configHint: 'Provided by the host configuration; read-only.',
    recentsHint: 'Not shown in the add-project dialog. Kept for quick reference and cleanup.',
    recentsEmpty: 'No recent directories.',
    clearRecentsShortHint: 'Clearing only removes this list; directories on disk stay.',
    merging: 'Merging…',
    cleaning: 'Cleaning…',
    deleting: 'Deleting…',
    copyRepoPath: 'Copy repository path',
    copyBranch: 'Copy branch name',
    copyPath: 'Copy path',
    copySessionId: 'Copy session ID',
    copyWorktree: 'Copy worktree path',
    branchLabel: 'Branch',
  },
  zh: {
    title: 'Worktree 任务',
    publish: '发布任务',
    repoPath: '目标目录',
    repoPathHint: '仓库目录',
    browse: '浏览…',
    pickingDirectory: '选择中…',
    baseBranch: '基线分支',
    chooseDirFirst: '选择目录后加载分支',
    loadingBranches: '正在加载分支…',
    branchName: '任务分支',
    branchNameHint: '自动生成（Hash）',
    taskTitle: '标题',
    taskDescription: '任务描述',
    startNow: '创建后立即开始',
    publishing: '发布中…',
    openSessionBtn: '打开会话',
    live: '实时',
    liveModel: '模型',
    liveCwd: '工作目录',
    liveCwdOff: '尚未切换到 worktree',
    livePressure: '上下文',
    liveTokens: 'Token',
    liveTokensIn: '输入',
    liveTokensOut: '输出',
    liveTokensCache: '缓存读',
    liveTodos: '执行清单',
    liveTurns: '轮次',
    liveTurnN: '第{n}轮',
    liveTurnEmpty: '暂无轮次',
    liveQueued: '排队消息',
    liveSubagents: '子代理',
    livePerms: '访问模式',
    liveLastPrompt: '最近活动',
    liveStats: '{turns} 轮 · {steps} 步',
    liveStepsOnly: '{steps} 步',
    roleUser: '你',
    roleAssistant: '助手',
    roleThinking: '思考',
    roleTool: '工具',
    roleResult: '结果',
    roleError: '错误',
    duration: '持续了 {s}',
    stepDone: '已完成',
    stepFailed: '执行失败',
    stepRunning: '执行中',
    toolTerminal: '终端',
    toolRead: '读取',
    toolEdit: '编辑',
    toolFind: '查找',
    toolCd: '切换目录',
    toolTodos: '清单',
    toolQuestion: '提问',
    toolGeneric: '工具',
    pendingApproval: '待审批',
    pendingPlanReview: '计划待审',
    pendingQuestion: '待回答',
    pendingHint: '会话正在等待你的处理，打开会话后可以继续执行。',
    sessionInterrupted: '会话中断',
    sessionError: '会话异常',
    sessionInterruptedHint: '该会话上次运行被中断，工作区可能还有未完成的改动。',
    sessionErrorHint: '该会话上次运行失败，请打开会话查看错误。',
    projects: '项目',
    addProject: '新增项目',
    addTask: '发布任务',
    projectDetail: '项目详情',
    overview: '概览',
    projectSettings: '项目设置',
    projectName: '项目名称',
    defaultBase: '默认基线分支',
    worktreeDirName: 'Worktree 目录',
    gitPath: 'Git',
    branchPrefix: '分支前缀',
    save: '保存',
    saved: '已保存',
    deleteProject: '删除项目',
    withTasks: '连同任务一起删除',
    tasksUnit: '任务',
    noProjects: '暂无项目',
    developing: '进行中',
    review: '待验收',
    reviewing: '验收中',
    merged: '已合并',
    cleaned: '已清理',
    broken: '异常',
    noTasks: '暂无任务',
    noSession: '未创建会话',
    createSession: '创建会话',
    checkout: '切到任务分支验收',
    back: '切回原分支',
    merge: '合并回基线',
    cleanup: '清理 worktree',
    deleteRecord: '删除记录',
    deleteBranch: '同时删除分支',
    force: '强制',
    dirty: '处未提交改动',
    uncommitted: '未提交改动',
    changesUnit: '处',
    clean: '工作区干净',
    commitsAhead: '个领先提交',
    openSessionFailed: '无法打开会话',
    confirmDelete: '删除这条任务记录？',
    config: '配置',
    recents: '最近目录',
    clearRecents: '清空最近目录',
    loading: '加载中…',
    loadFailed: '加载失败',
    failed: '操作失败',
    publishTimeout: '发布请求超时，请刷新看板确认任务是否已创建',
    bindTimeout: '任务已创建，但会话创建超时；请稍后在看板中打开或创建会话',
    handlePending: '去处理',
    close: '关闭',
    refresh: '刷新',
    detail: '任务详情',
    description: '描述',
    worktree: 'Worktree',
    mainRepo: '主仓库',
    currentBranch: '当前分支',
    originalBranch: '验收前分支',
    session: '会话',
    sessionRunning: '工作中',
    sessionIdle: '空闲',
    mergedFlag: '已合并进基线',
    branchMissing: '分支不存在',
    onBranch: '主仓库正检出该分支',
    commits: '领先基线的提交',
    selectTask: '未选择任务',
    ready: '待开始',
    path: '路径',
    status: '状态',
    sessionId: '会话 ID',
    operations: '操作',
    dangerZone: '危险操作',
    creatingSession: '正在创建会话…',
    saving: '正在保存…',
    confirmMerge: '确定将任务分支合并回基线分支吗？',
    confirmCleanup: '确定清理这个 worktree 吗？请先确认分支和未提交改动。',
    backToList: '返回项目列表',
    retry: '重试',
    loadBranchesFailed: '分支加载失败，可以手动输入分支或重试。',
    requiredField: '此项不能为空',
    cancel: '取消',
    expand: '展开',
    collapse: '折叠',

    search: '搜索项目、任务或分支',
    noProjectsHint: '选择一个 Git 仓库，开始发布 worktree 任务。',
    noMatch: '没有匹配的项目',
    noMatchHint: '换个关键词，或清除搜索查看全部项目。',
    clearSearch: '清除搜索',
    projectUnit: '个项目',
    taskUnit: '个任务',
    dirUnit: '个目录',
    addProjectSub: '选择一个 Git 仓库，读取分支并设置默认基线。',
    totalTasks: '任务总数',
    activeTasks: '进行中',
    reviewTasks: '待验收',
    mergedTasks: '已合并',
    overviewHint: '按 Git 与会话状态推导',
    attention: '{n} 个任务等待处理',
    view: '查看',
    lastActivity: '最近活动',
    justNow: '刚刚',
    minutesAgo: '{n} 分钟前',
    hoursAgo: '{n} 小时前',
    daysAgo: '{n} 天前',
    liveSession: '实时会话',
    sessionInfo: '会话信息',
    noSessionHint: '创建后会在这里显示实时对话、执行清单和上下文占用。',
    noTurns: '还没有对话记录',
    acceptance: '验收操作',
    acceptanceHintClean: 'worktree 已清理，验收操作不可用。',
    acceptanceHintMerged: '任务已合并进基线，可以清理 worktree。',
    acceptanceHintBroken: 'worktree 状态异常，修复后再执行验收操作。',
    acceptanceHintDirty: 'worktree 有 {n} 处未提交改动，合并与切换前需要先提交或暂存。',
    acceptanceHintRepoDirty: '主仓库有 {n} 处未提交改动，切换分支前需要先提交或暂存。',
    acceptanceHintNoAhead: '还没有领先基线的提交，完成开发后再合并。',
    acceptanceHintCheckedOut: '主仓库当前检出任务分支，验收完成后可切回原分支。',
    acceptanceHintDefault: '切换与合并前会检查工作区；有未提交改动时会拒绝执行。',
    cleanupHint: '清理会删除 worktree 目录；删除记录只移除看板条目，不会删除仓库中的提交。',
    mergeTitle: '合并到 {base}',
    mergeSub: '将任务分支的提交合并到基线分支。',
    mergeCleanHint: '合并前请确认代码已通过所需的检查，并且没有冲突。',
    mergeDirtyTitle: 'worktree 有未提交改动',
    mergeDirtyHint: '先提交或暂存改动，再执行合并。',
    cleanupTitle: '清理 worktree',
    cleanupSub: '清理指定的 worktree 及其相关文件。',
    cleanupDangerTitle: '以下内容将被永久删除，且无法恢复：',
    cleanupDirtyGone: '{n} 个未提交改动将丢失',
    cleanupCleanNote: '工作区干净，没有未提交改动',
    worktreeRemovedHint: 'worktree 目录已删除，此路径仅作记录。',
    cleanupForceHint: '即使存在未提交的改动也执行清理。',
    cleanupBranchHint: '清理完成后，一并删除对应的本地分支。',
    deleteTaskTitle: '删除任务记录',
    deleteTaskWarning: '此操作不可撤销',
    deleteTaskWarningHint: '任务记录会从看板移除，但 worktree 与分支不会被删除。',
    deleteTaskHint: '如果还需要保留代码，请先合并，再删除记录。',
    deleteProjectTitle: '删除项目',
    deleteProjectWarning: '项目下还有 {n} 条任务记录',
    deleteProjectWarningHint: '需要同时删除这些任务记录才能移除项目。磁盘上的仓库、worktree 和提交不会被删除。',
    deleteProjectCardHint: '删除后，项目配置与任务记录会从工作台移除；磁盘上的仓库、worktree 和提交不会被删除。',
    deleteProjectRecords: '任务记录',
    deleteProjectBase: '默认基线',
    clearRecentsTitle: '清空最近目录',
    clearRecentsSub: '将从设置页移除最近使用的仓库目录。',
    clearRecentsDanger: '以下 {n} 个目录会从列表移除：',
    clearRecentsHint: '磁盘上的目录和仓库不会被删除，只清空这份列表。',
    copied: '已复制',
    copyFailed: '复制失败，请手动选择',
    refreshed: '已刷新任务状态',
    sessionCreated: '会话已创建并绑定 worktree',
    mergeDone: '已合并到 {base}',
    cleanupDone: 'worktree 已清理',
    cleanupDoneBranch: 'worktree 与分支已清理',
    recordDeleted: '任务记录已删除',
    projectDeleted: '项目「{name}」已删除',
    projectAdded: '项目「{name}」已新增',
    published: '任务已发布 · {branch}',
    branchRule: '任务分支规则：留空自动生成 {pattern}；仅限 ASCII 字母、数字、点、下划线和斜杠。',
    branchInvalid: '只能使用 ASCII 字母、数字、点、下划线和斜杠。',
    advanced: '高级选项',
    preview: '预览',
    previewBranch: '分支',
    previewDir: '目录',
    projectSettingsHint: '覆盖全局的分支与 worktree 命名规则，只影响此后发布的任务。',
    projectNameHint: '只影响看板显示，不会改写仓库。',
    worktreeDirHint: '相对仓库根目录，并写入 .git/info/exclude。',
    branchPrefixHint: '自动分支为前缀加 8 位任务 ID。',
    statusSyncFailed: '状态同步失败',
    mergeConfirm: '确认合并',
    deleteRecordConfirm: '删除记录',
    deleteProjectConfirm: '删除项目',
    settingsSub: '全局配置与最近使用的仓库目录。',
    configHint: '由宿主配置提供，只读。',
    recentsHint: '新增项目弹窗不会展示这些目录，这里仅供快速复制与清理。',
    recentsEmpty: '暂无最近目录。',
    clearRecentsShortHint: '清空后不会删除磁盘上的目录，只会从列表中移除。',
    merging: '正在合并…',
    cleaning: '正在清理…',
    deleting: '正在删除…',
    copyRepoPath: '复制仓库路径',
    copyBranch: '复制分支名',
    copyPath: '复制路径',
    copySessionId: '复制会话 ID',
    copyWorktree: '复制 worktree 路径',
    branchLabel: '分支',
  },
}

function pickDict(locale: any): any {
  let lang = ''
  try {
    if (typeof locale === 'string') lang = locale
    else if (locale && typeof locale === 'object') {
      const cur = typeof locale.current === 'function' ? locale.current() : undefined
      lang = String(cur ?? locale.locale ?? locale.language ?? locale.code ?? '')
    }
  } catch {
    lang = ''
  }
  return String(lang).toLowerCase().startsWith('en') ? FALLBACK.en : FALLBACK.zh
}

/* --------------------------------------------------------------------------
 * Palette — the single source of truth for every colour in the workbench.
 *
 * To re-skin the plugin, edit only this object. Every rule below consumes
 * --dshw-* variables generated from these tokens; no colour literals should
 * appear in any other part of the stylesheet.
 * ------------------------------------------------------------------------ */

const PALETTE = {
  light: {
    bg: '#f4f6fa',
    surface: '#ffffff',
    surface2: '#f7f9fc',
    surface3: '#edf1f7',
    treeBg: '#fbfcfe',

    border: '#e4e8f0',
    borderSoft: '#eef1f6',
    borderStrong: '#d3d9e5',

    text: '#171b26',
    text2: '#5b6478',
    text3: '#727b8e',

    brand: '#2563eb',
    brandStrong: '#1d4ed8',
    brandSoft: '#eaf0ff',
    brandBorder: '#c9d8ff',
    onBrand: '#ffffff',

    success: '#15803d',
    successSoft: '#e8f7ee',
    successBorder: '#bfe8cf',

    warn: '#b45309',
    warnSoft: '#fff4e2',
    warnBorder: '#f4dcb4',

    danger: '#dc2626',
    dangerSoft: '#fdecec',
    dangerBorder: '#f3c3c3',

    purple: '#7c5cff',
    purpleSoft: '#f1ecff',
    purpleBorder: '#dcd3ff',

    folderBlueBg: '#e9f0ff',
    folderBlueFg: '#2f6bff',
    folderPurpleBg: '#f1ecff',
    folderPurpleFg: '#7c5cff',
    folderGreenBg: '#e7f7ee',
    folderGreenFg: '#16a34a',
    folderOrangeBg: '#fff2e0',
    folderOrangeFg: '#d97706',

    shadow: '0 1px 2px rgba(16,24,40,.045),0 1px 3px rgba(16,24,40,.04)',
    shadowLg: '0 26px 64px -18px rgba(15,23,42,.34)',
    brandShadow: '0 1px 2px rgba(47,107,255,.32)',
    focusRing: '0 0 0 3px rgba(47,107,255,.22)',

    overlay: 'rgba(13,20,35,.56)',
    toastBg: '#1b2230',
    toastFg: '#f8fafc',

    termBg: '#101722',
    termBorder: '#1e2939',
    termText: '#c6d0de',
    termMuted: '#8fa0b8',
    termBar: '#8fa0b8',
    termGutter: '#3d4a60',
    termUser: '#8fb4ff',
    termTool: '#79d3a5',
    termWarn: '#f3c268',
    termError: '#ff8a8a',

    meterFrom: '#3f7dff',
    meterTo: '#79d3a5',

    selectArrow:
      'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238b93a6\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")',
  },
  dark: {
    bg: '#0b0e14',
    surface: '#12161f',
    surface2: '#181d28',
    surface3: '#212734',
    treeBg: '#0f131b',

    border: '#232a38',
    borderSoft: '#1c2230',
    borderStrong: '#303849',

    text: '#edf1f7',
    text2: '#a6aebe',
    text3: '#8c96a8',

    brand: '#5c8dff',
    brandStrong: '#7aa4ff',
    brandSoft: '#17264a',
    brandBorder: '#2a4272',
    onBrand: '#ffffff',

    success: '#3ddc97',
    successSoft: '#102b22',
    successBorder: '#1e4a39',

    warn: '#f0b354',
    warnSoft: '#2b2112',
    warnBorder: '#4a391b',

    danger: '#ff7b7b',
    dangerSoft: '#2e1519',
    dangerBorder: '#5a252b',

    purple: '#a78bfa',
    purpleSoft: '#241d3d',
    purpleBorder: '#3b3260',

    folderBlueBg: '#17264a',
    folderBlueFg: '#7ea6ff',
    folderPurpleBg: '#241d3d',
    folderPurpleFg: '#b09aff',
    folderGreenBg: '#12271d',
    folderGreenFg: '#49d793',
    folderOrangeBg: '#2c2114',
    folderOrangeFg: '#f0b354',

    shadow: '0 1px 2px rgba(0,0,0,.35)',
    shadowLg: '0 30px 72px -22px rgba(0,0,0,.8)',
    brandShadow: '0 1px 2px rgba(92,141,255,.35)',
    focusRing: '0 0 0 3px rgba(92,141,255,.28)',

    overlay: 'rgba(0,0,0,.62)',
    toastBg: '#eef2f9',
    toastFg: '#11151c',

    termBg: '#070a10',
    termBorder: '#1b2331',
    termText: '#cfd8e6',
    termMuted: '#8b9ab0',
    termBar: '#8b9ab0',
    termGutter: '#39465c',
    termUser: '#8fb4ff',
    termTool: '#79d3a5',
    termWarn: '#f3c268',
    termError: '#ff8a8a',

    meterFrom: '#3f7dff',
    meterTo: '#79d3a5',

    selectArrow:
      'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23788294\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")',
  },
}

function paletteVars(p: Record<string, string>): string {
  return Object.keys(p)
    .map((key) => {
      const name = key
        .replace(/([A-Z])/g, '-$1')
        .replace(/([a-zA-Z])(\d)/g, '$1-$2')
        .toLowerCase()
      return '--dshw-' + name + ':' + p[key] + ';'
    })
    .join('')
}

const CSS = `
.dshw-scope{${paletteVars(PALETTE.light)}}
.dshw-dark .dshw-scope{${paletteVars(PALETTE.dark)}}

.dshw-scope, .dshw-scope *, .dshw-scope *::before, .dshw-scope *::after{box-sizing:border-box}
.dshw-scope{font-family:inherit;color:var(--dshw-text);font-size:13px;line-height:1.55;-webkit-font-smoothing:antialiased}
.dshw-scope :where(button, input, select, textarea){font:inherit;color:inherit}
.dshw-scope button{cursor:pointer}
.dshw-scope button:disabled{cursor:not-allowed}
.dshw-scope a{color:var(--dshw-brand)}
.dshw-scope h1, .dshw-scope h2, .dshw-scope h3, .dshw-scope h4, .dshw-scope p{margin:0}
.dshw-scope ul, .dshw-scope ol{margin:0;padding:0;list-style:none}
.dshw-scope [hidden]{display:none!important}
.dshw-scope code, .dshw-scope .dshw-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.dshw-scope code{font-size:11.5px;padding:1px 5px;border-radius:5px;background:var(--dshw-surface-2);border:1px solid var(--dshw-border);overflow-wrap:anywhere}
.dshw-scope ::selection{background:var(--dshw-brand-soft);color:var(--dshw-text)}
.dshw-scope :focus-visible{outline:2px solid var(--dshw-brand);outline-offset:2px}
.dshw-scope *{scrollbar-width:thin;scrollbar-color:var(--dshw-border-strong) transparent}
.dshw-scope ::-webkit-scrollbar{width:10px;height:10px}
.dshw-scope ::-webkit-scrollbar-track{background:transparent}
.dshw-scope ::-webkit-scrollbar-thumb{background:var(--dshw-border-strong);border-radius:99px;border:3px solid transparent;background-clip:content-box}
.dshw-scope ::-webkit-scrollbar-thumb:hover{background:var(--dshw-text-3);background-clip:content-box}

.dshw-ico{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;flex:none;display:block}

/* shell ------------------------------------------------------------------ */
.dshw-shell{position:relative;height:100%;min-height:0;container-type:inline-size;container-name:dshw;background:var(--dshw-bg);color:var(--dshw-text);overflow:hidden}
.dshw-app{display:grid;grid-template-columns:320px minmax(0,1fr);height:100%;min-height:0;background:var(--dshw-bg)}

/* tree ------------------------------------------------------------------- */
.dshw-tree{display:flex;flex-direction:column;min-width:0;min-height:0;background:var(--dshw-tree-bg);border-right:1px solid var(--dshw-border)}
.dshw-tree-head{display:flex;align-items:center;gap:6px;padding:12px 10px 10px;flex:none}
.dshw-search{position:relative;flex:1;min-width:0}
.dshw-search>.dshw-ico{position:absolute;left:9px;top:50%;transform:translateY(-50%);width:15px;height:15px;color:var(--dshw-text-3);pointer-events:none}
.dshw-search input{width:100%;height:33px;border:1px solid var(--dshw-border);border-radius:8px;background:var(--dshw-surface);padding:0 10px 0 31px;font-size:12.5px;color:var(--dshw-text);transition:border-color .14s,box-shadow .14s}
.dshw-search input::placeholder{color:var(--dshw-text-3)}
.dshw-search input:hover{border-color:var(--dshw-border-strong)}
.dshw-search input:focus{outline:none;border-color:var(--dshw-brand);box-shadow:var(--dshw-focus-ring)}
.dshw-tree-scroll{flex:1;min-height:0;overflow:auto;padding:2px 8px 18px}
.dshw-tree-foot{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 13px;border-top:1px solid var(--dshw-border);font-size:10.5px;color:var(--dshw-text-3);background:var(--dshw-tree-bg)}
.dshw-tree-tag{border:1px solid var(--dshw-border);border-radius:999px;padding:1px 6px;background:var(--dshw-surface);font-size:9.5px;letter-spacing:.02em}

/* project row ------------------------------------------------------------ */
.dshw-project{display:flex;align-items:center;gap:1px;margin-top:5px;padding:2px 1px;border-radius:8px;transition:background .12s}
.dshw-project:hover{background:var(--dshw-surface-2)}
.dshw-project--on{background:var(--dshw-brand-soft);box-shadow:inset 2px 0 0 var(--dshw-brand),inset 0 0 0 1px var(--dshw-brand-border)}
.dshw-project--on .dshw-project-count{background:var(--dshw-surface);border-color:var(--dshw-brand-border);color:var(--dshw-brand)}
.dshw-project-toggle{width:22px;height:28px;flex:none;border:0;background:transparent;color:var(--dshw-text-3);display:grid;place-items:center;border-radius:6px;padding:0}
.dshw-project-toggle:hover{color:var(--dshw-text)}
.dshw-project-toggle .dshw-ico{width:14px;height:14px;transition:transform .16s ease}
.dshw-project[data-open="false"] .dshw-project-toggle .dshw-ico{transform:rotate(-90deg)}
.dshw-project-select{flex:1;min-width:0;display:flex;align-items:center;gap:8px;border:0;background:transparent;text-align:left;padding:4px 2px;border-radius:7px;color:inherit}
.dshw-folder-tile{width:22px;height:22px;border-radius:6px;display:grid;place-items:center;flex:none}
.dshw-folder-tile .dshw-ico{width:13px;height:13px}
.dshw-folder-tile--blue{background:var(--dshw-folder-blue-bg);color:var(--dshw-folder-blue-fg)}
.dshw-folder-tile--purple{background:var(--dshw-folder-purple-bg);color:var(--dshw-folder-purple-fg)}
.dshw-folder-tile--green{background:var(--dshw-folder-green-bg);color:var(--dshw-folder-green-fg)}
.dshw-folder-tile--orange{background:var(--dshw-folder-orange-bg);color:var(--dshw-folder-orange-fg)}
.dshw-project-name{font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.dshw-project-count{margin-left:auto;flex:none;min-width:18px;height:17px;padding:0 5px;border-radius:999px;display:grid;place-items:center;background:var(--dshw-surface);border:1px solid var(--dshw-border);font-size:10px;color:var(--dshw-text-3);font-variant-numeric:tabular-nums}
.dshw-project-add{width:24px;height:24px;flex:none;border:0;background:transparent;color:var(--dshw-text-3);border-radius:6px;display:grid;place-items:center;opacity:.55;padding:0;transition:opacity .12s,background .12s,color .12s}
.dshw-project-add .dshw-ico{width:14px;height:14px}
.dshw-project:hover .dshw-project-add, .dshw-project--on .dshw-project-add, .dshw-project-add:focus-visible{opacity:1}
.dshw-project-add:hover{background:var(--dshw-brand-soft);color:var(--dshw-brand)}

/* task rows -------------------------------------------------------------- */
.dshw-task{display:flex;align-items:stretch;margin:1px 0 1px 22px;border-radius:8px;transition:background .12s,box-shadow .12s}
.dshw-task:hover{background:var(--dshw-surface-2)}
.dshw-task--on{background:var(--dshw-brand-soft);box-shadow:inset 2px 0 0 var(--dshw-brand),inset 0 0 0 1px var(--dshw-brand-border)}
.dshw-task-select{flex:1;min-width:0;display:flex;align-items:flex-start;gap:8px;border:0;background:transparent;text-align:left;padding:7px 3px 7px 8px;border-radius:8px 0 0 8px;color:inherit}
.dshw-task-select .dshw-dot{margin-top:5px}
.dshw-task-main{min-width:0;flex:1}
.dshw-task-title{display:block;font-size:12.5px;font-weight:500;color:var(--dshw-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px}
.dshw-task--on .dshw-task-title{font-weight:600}
.dshw-task-meta{display:flex;align-items:center;gap:6px;min-width:0;white-space:nowrap}
.dshw-task-count{display:inline-flex;align-items:center;gap:2px;font-size:10px;color:var(--dshw-text-3);font-variant-numeric:tabular-nums}
.dshw-task-count .dshw-ico{width:10px;height:10px;stroke-width:2}
.dshw-task-open{width:27px;flex:none;border:0;background:transparent;color:var(--dshw-text-3);border-radius:0 8px 8px 0;display:grid;place-items:center;opacity:.55;padding:0;transition:opacity .12s,color .12s}
.dshw-task:hover .dshw-task-open, .dshw-task--on .dshw-task-open, .dshw-task-open:focus-visible{opacity:1}
.dshw-task-open:hover{color:var(--dshw-brand)}
.dshw-task-open:disabled{opacity:0!important;color:var(--dshw-text-3)}
.dshw-task-open .dshw-ico{width:14px;height:14px}
.dshw-tree-inline-empty{padding:8px 8px 10px 30px;display:flex;align-items:center;gap:8px;font-size:11px;color:var(--dshw-text-3)}
.dshw-link-btn{border:0;background:transparent;color:var(--dshw-brand);font-size:inherit;font-weight:600;padding:0;border-radius:4px}
.dshw-link-btn:hover{text-decoration:underline}
.dshw-tree-empty{padding:44px 18px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:9px}
.dshw-tree-empty h3{font-size:13px;color:var(--dshw-text)}
.dshw-tree-empty .dshw-empty-icon{width:52px;height:52px;border-radius:14px}
.dshw-tree-empty .dshw-btn{margin-top:8px}
.dshw-tree-empty p{font-size:11.5px;color:var(--dshw-text-3);line-height:1.6;margin-bottom:4px}

/* skeleton --------------------------------------------------------------- */
.dshw-sk-project{display:flex;align-items:center;gap:8px;padding:10px 6px}
.dshw-sk-task{display:flex;align-items:center;gap:9px;padding:7px 6px 7px 30px}
.dshw-sk-line{height:8px;border-radius:5px;background:linear-gradient(90deg,var(--dshw-surface-3) 25%,var(--dshw-surface-2) 37%,var(--dshw-surface-3) 63%);background-size:400% 100%;animation:dshw-shimmer 1.5s ease-in-out infinite}
.dshw-sk-line--sm{height:6px}
@keyframes dshw-shimmer{0%{background-position:100% 0}100%{background-position:0 0}}

/* detail ----------------------------------------------------------------- */
.dshw-detail{min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:var(--dshw-bg)}
.dshw-detail-scroll{flex:1;min-height:0;overflow:auto;padding:22px 26px 44px}
.dshw-detail-inner{width:100%;max-width:960px;margin:0 auto}
.dshw-mobile-bar{display:none;max-width:960px;margin:0 auto 10px}
.dshw-mobile-bar .dshw-btn{display:inline-flex}

/* page head -------------------------------------------------------------- */
.dshw-page-head{display:flex;align-items:flex-start;gap:14px;margin-bottom:16px}
.dshw-page-icon{width:44px;height:44px;border-radius:11px;display:grid;place-items:center;flex:none;background:var(--dshw-brand-soft);color:var(--dshw-brand);border:1px solid var(--dshw-brand-border)}
.dshw-page-icon .dshw-ico{width:21px;height:21px}
.dshw-page-icon--folder{background:var(--dshw-folder-blue-bg);border-color:var(--dshw-brand-border);color:var(--dshw-folder-blue-fg)}
.dshw-page-head-copy{min-width:0;flex:1}
.dshw-page-head h1{font-size:20px;line-height:1.3;font-weight:650;letter-spacing:-.01em;overflow-wrap:anywhere}
.dshw-page-sub{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:5px;font-size:12px;color:var(--dshw-text-3);min-width:0}
.dshw-page-sub .dshw-mono{font-size:11.5px;overflow-wrap:anywhere}
.dshw-page-sub .dshw-sep{color:var(--dshw-border-strong)}
.dshw-page-actions{margin-left:auto;display:flex;align-items:center;gap:8px;flex:none}

/* cards ------------------------------------------------------------------ */
.dshw-card{background:var(--dshw-surface);border:1px solid var(--dshw-border);border-radius:12px;padding:16px 18px;margin-bottom:14px;box-shadow:var(--dshw-shadow)}
.dshw-card-head{display:flex;align-items:center;gap:8px;min-height:24px;margin-bottom:12px}
.dshw-card-head>.dshw-ico{width:16px;height:16px;color:var(--dshw-text-3)}
.dshw-card-title{font-size:13px;font-weight:650;letter-spacing:.01em}
.dshw-card-head .dshw-right{margin-left:auto;display:flex;align-items:center;gap:8px}
.dshw-card-sub{font-size:12px;color:var(--dshw-text-2);line-height:1.65;margin:-4px 0 12px;max-width:76ch}
.dshw-card--danger{border-color:var(--dshw-danger-border)}
.dshw-card--danger .dshw-card-head>.dshw-ico{color:var(--dshw-danger)}
.dshw-card--danger .dshw-card-title{color:var(--dshw-danger)}

/* task hero -------------------------------------------------------------- */
.dshw-hero{padding:18px 20px}
.dshw-hero-top{display:flex;gap:22px;align-items:flex-start}
.dshw-hero-copy{min-width:0;flex:1}
.dshw-hero-crumb{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px;color:var(--dshw-text-3);margin-bottom:9px}
.dshw-hero-crumb .dshw-ico{width:13px;height:13px}
.dshw-hero-crumb .dshw-mono{font-size:10.5px;color:var(--dshw-text-2);background:var(--dshw-surface-2);border:1px solid var(--dshw-border);padding:1px 6px;border-radius:5px}
.dshw-hero h1{font-size:20px;line-height:1.35;font-weight:650;letter-spacing:-.012em;margin-bottom:7px;overflow-wrap:anywhere}
.dshw-hero-desc{font-size:13px;line-height:1.7;color:var(--dshw-text-2);max-width:74ch;white-space:pre-wrap;overflow-wrap:anywhere}
.dshw-hero-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:14px}
.dshw-meta-pill{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 8px;border:1px solid var(--dshw-border);border-radius:7px;background:var(--dshw-surface-2);font-size:11px;color:var(--dshw-text-2);max-width:100%}
.dshw-meta-pill .dshw-ico{width:13px;height:13px;color:var(--dshw-text-3)}
.dshw-meta-pill .dshw-mono{font-size:10.5px;color:var(--dshw-text-2);border:0;background:transparent;padding:0}
.dshw-meta-pill--warn{background:var(--dshw-warn-soft);border-color:var(--dshw-warn-border);color:var(--dshw-warn)}
.dshw-meta-pill--warn .dshw-ico{color:var(--dshw-warn)}
.dshw-hero-action{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:8px;padding-top:2px}
.dshw-hero-action .dshw-hint{max-width:220px;text-align:right;margin:0}

/* buttons ---------------------------------------------------------------- */
.dshw-btn{height:32px;padding:0 12px;display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--dshw-border-strong);border-radius:8px;background:var(--dshw-surface);color:var(--dshw-text);font-size:12.5px;font-weight:500;line-height:1;transition:background .14s,border-color .14s,color .14s,box-shadow .14s;white-space:nowrap;cursor:pointer}
.dshw-btn .dshw-ico{width:15px;height:15px}
.dshw-btn:hover{background:var(--dshw-surface-2);border-color:var(--dshw-text-3)}
.dshw-btn:active{transform:translateY(.5px)}
.dshw-btn:disabled{opacity:.45;transform:none}
.dshw-btn:disabled:hover{background:var(--dshw-surface);border-color:var(--dshw-border-strong)}
.dshw-btn--primary{background:var(--dshw-brand);border-color:var(--dshw-brand);color:var(--dshw-on-brand);font-weight:600;box-shadow:var(--dshw-brand-shadow)}
.dshw-btn--primary:hover{background:var(--dshw-brand-strong);border-color:var(--dshw-brand-strong)}
.dshw-btn--primary:disabled:hover{background:var(--dshw-brand);border-color:var(--dshw-brand)}
.dshw-btn--danger{color:var(--dshw-danger);border-color:color-mix(in srgb,var(--dshw-danger) 38%,var(--dshw-border));background:var(--dshw-surface)}
.dshw-btn--danger:hover{background:var(--dshw-danger-soft);border-color:var(--dshw-danger);color:var(--dshw-danger)}
.dshw-btn--danger:disabled:hover{background:var(--dshw-surface);border-color:color-mix(in srgb,var(--dshw-danger) 38%,var(--dshw-border))}
.dshw-btn--lg{height:38px;padding:0 16px;font-size:13px;border-radius:8px}
.dshw-btn--lg .dshw-ico{width:16px;height:16px}
.dshw-btn--sm{height:28px;padding:0 9px;font-size:12px;border-radius:7px}
.dshw-btn--sm .dshw-ico{width:13px;height:13px}
.dshw-btn--ghost{border-color:transparent;background:transparent;color:var(--dshw-text-2)}
.dshw-btn--ghost:hover{background:var(--dshw-surface-2);border-color:var(--dshw-border)}
.dshw-icon-btn{width:32px;height:32px;flex:none;display:grid;place-items:center;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--dshw-text-2);transition:background .14s,color .14s,border-color .14s;padding:0}
.dshw-icon-btn .dshw-ico{width:16px;height:16px}
.dshw-icon-btn:hover{background:var(--dshw-surface-2);color:var(--dshw-text);border-color:var(--dshw-border)}
.dshw-icon-btn--sm{width:27px;height:27px;border-radius:7px}
.dshw-icon-btn--sm .dshw-ico{width:14px;height:14px}
.dshw-spinner{width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:dshw-spin .7s linear infinite;flex:none;display:inline-block}
@keyframes dshw-spin{to{transform:rotate(360deg)}}

/* chips & dots ----------------------------------------------------------- */
.dshw-chip{display:inline-flex;align-items:center;gap:5px;height:21px;padding:0 8px;border-radius:999px;border:1px solid transparent;font-size:10.5px;font-weight:600;line-height:1;white-space:nowrap}
.dshw-chip--brand{color:var(--dshw-brand-strong);background:var(--dshw-brand-soft);border-color:var(--dshw-brand-border)}
.dshw-chip--warn{color:var(--dshw-warn);background:var(--dshw-warn-soft);border-color:var(--dshw-warn-border)}
.dshw-chip--success{color:var(--dshw-success);background:var(--dshw-success-soft);border-color:var(--dshw-success-border)}
.dshw-chip--error{color:var(--dshw-danger);background:var(--dshw-danger-soft);border-color:var(--dshw-danger-border)}
.dshw-chip--neutral{color:var(--dshw-text-2);background:var(--dshw-surface-2);border-color:var(--dshw-border)}
.dshw-chip--purple{color:var(--dshw-purple);background:var(--dshw-purple-soft);border-color:var(--dshw-purple-border)}
.dshw-chip--sm{height:18px;font-size:10px;padding:0 6px}
.dshw-chip .dshw-dot{width:5px;height:5px;box-shadow:none}
.dshw-dot{width:7px;height:7px;border-radius:50%;background:var(--dshw-text-3);flex:none;display:inline-block}
.dshw-dot--brand{background:var(--dshw-brand);box-shadow:0 0 0 3px var(--dshw-brand-soft)}
.dshw-dot--warn{background:var(--dshw-warn);box-shadow:0 0 0 3px var(--dshw-warn-soft)}
.dshw-dot--success{background:var(--dshw-success);box-shadow:0 0 0 3px var(--dshw-success-soft)}
.dshw-dot--error{background:var(--dshw-danger);box-shadow:0 0 0 3px var(--dshw-danger-soft)}
.dshw-dot--neutral{background:var(--dshw-text-3);box-shadow:0 0 0 3px var(--dshw-surface-3)}
.dshw-dot--pulse{background:var(--dshw-warn);box-shadow:0 0 0 3px var(--dshw-warn-soft)}
@media (prefers-reduced-motion:no-preference){
  .dshw-dot--pulse{animation:dshw-soft-pulse 2.4s ease-in-out infinite}
}
@keyframes dshw-soft-pulse{0%,100%{box-shadow:0 0 0 3px var(--dshw-warn-soft)}50%{box-shadow:0 0 0 5px color-mix(in srgb,var(--dshw-warn) 14%,transparent)}}

/* banners ---------------------------------------------------------------- */
.dshw-banner{display:flex;gap:9px;align-items:flex-start;padding:11px 12px;border-radius:9px;font-size:12px;line-height:1.6;border:1px solid transparent;margin-bottom:14px}
.dshw-banner .dshw-ico{width:15px;height:15px;margin-top:2px}
.dshw-banner strong{display:block;font-weight:650;margin-bottom:1px}
.dshw-banner-copy{min-width:0;flex:1}
.dshw-banner-actions{margin-left:auto;display:flex;gap:6px;flex:none;align-items:center}
.dshw-banner--info{background:var(--dshw-brand-soft);border-color:var(--dshw-brand-border);color:var(--dshw-text-2)}
.dshw-banner--info>.dshw-ico{color:var(--dshw-brand)}
.dshw-banner--warn{background:var(--dshw-warn-soft);border-color:var(--dshw-warn-border);color:var(--dshw-text)}
.dshw-banner--warn>.dshw-ico{color:var(--dshw-warn)}
.dshw-banner--error{background:var(--dshw-danger-soft);border-color:var(--dshw-danger-border);color:var(--dshw-text)}
.dshw-banner--error>.dshw-ico{color:var(--dshw-danger)}

/* live console ----------------------------------------------------------- */
.dshw-live-state{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--dshw-success)}
.dshw-live-state--idle{color:var(--dshw-text-3)}
.dshw-live-state--pending{color:var(--dshw-warn)}
.dshw-live-state .dshw-dot{width:6px;height:6px;box-shadow:none}
.dshw-console{background:var(--dshw-term-bg);border:1px solid var(--dshw-term-border);border-radius:10px;overflow:hidden;color:var(--dshw-term-text)}
.dshw-console-bar{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid var(--dshw-term-border);color:var(--dshw-term-bar);font-size:11px;min-width:0;overflow:hidden}
.dshw-console-bar>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshw-console-bar .dshw-ico{width:14px;height:14px;color:var(--dshw-term-tool)}
.dshw-console-bar .dshw-sep{color:var(--dshw-term-gutter)}
.dshw-console-bar .dshw-grow{flex:1}
.dshw-console-bar .dshw-tok{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:var(--dshw-term-muted)}
.dshw-console-grid{display:grid;grid-template-columns:minmax(0,1fr) 216px}
.dshw-console-log{padding:9px 0;max-height:320px;overflow:auto}
.dshw-term-row{display:flex;gap:9px;padding:3px 12px 3px 0}
.dshw-term-gutter{width:28px;flex:none;text-align:right;color:var(--dshw-term-gutter);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;line-height:1.75;user-select:none}
.dshw-term-text{min-width:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.75;overflow-wrap:anywhere;color:var(--dshw-term-text);white-space:pre-wrap}
.dshw-term-tag{flex:none;width:30px;text-align:right;font-size:9px;line-height:2.15;color:var(--dshw-term-gutter);user-select:none}
.dshw-term-user .dshw-term-text{color:var(--dshw-term-user)}
.dshw-term-user .dshw-term-tag{color:var(--dshw-term-user)}
.dshw-term-think .dshw-term-text{color:var(--dshw-term-muted);font-style:italic}
.dshw-term-think .dshw-term-tag{color:var(--dshw-term-muted)}
.dshw-term-tool .dshw-term-text{color:var(--dshw-term-tool)}
.dshw-term-tool .dshw-term-tag{color:var(--dshw-term-tool)}
.dshw-term-result .dshw-term-text{color:var(--dshw-term-muted)}
.dshw-term-result .dshw-term-tag{color:var(--dshw-term-gutter)}
.dshw-term-agent .dshw-term-tag{color:var(--dshw-term-text)}
.dshw-term-warn .dshw-term-text{color:var(--dshw-term-warn)}
.dshw-term-error .dshw-term-text,.dshw-term-error .dshw-term-tag{color:var(--dshw-term-error)}

/* collapsed session timeline --------------------------------------------- */
.dshw-step{border-top:1px solid color-mix(in srgb,var(--dshw-term-text) 9%,transparent)}
.dshw-step:first-child{border-top:0}
.dshw-step>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;min-width:0;min-height:28px;padding:3px 10px 3px 0;color:var(--dshw-term-text)}
.dshw-step>summary::-webkit-details-marker{display:none}
.dshw-step>summary:hover{background:color-mix(in srgb,var(--dshw-term-text) 5%,transparent)}
.dshw-step>summary:focus-visible{outline:2px solid var(--dshw-brand);outline-offset:-2px}
.dshw-step-gutter{width:28px;flex:none;text-align:right;color:var(--dshw-term-gutter);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;user-select:none}
.dshw-step-tag{width:34px;flex:none;text-align:right;font-size:9px;line-height:1.6;color:var(--dshw-term-muted);user-select:none;white-space:nowrap}
.dshw-step-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;color:var(--dshw-term-text)}
.dshw-step-meta{flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px;color:var(--dshw-term-tool);white-space:nowrap}
.dshw-step-status{flex:none;font-size:9px;color:var(--dshw-term-muted);white-space:nowrap}
.dshw-step-status--ok{color:var(--dshw-term-tool)}
.dshw-step-status--error{color:var(--dshw-term-error)}
.dshw-step-chevron{width:12px;height:12px;flex:none;color:var(--dshw-term-gutter);transform:rotate(-90deg);transition:transform .12s}
.dshw-step[open] .dshw-step-chevron{transform:rotate(0)}
.dshw-step-body{margin:0 10px 8px 37px;padding:8px 10px;border-radius:6px;background:color-mix(in srgb,var(--dshw-term-text) 7%,transparent);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--dshw-term-text);max-height:240px;overflow:auto}
.dshw-step--think .dshw-step-tag,.dshw-step--think .dshw-step-title{color:var(--dshw-term-muted);font-style:italic}
.dshw-step--user .dshw-step-tag{color:var(--dshw-term-user)}
.dshw-step--tool .dshw-step-tag{color:var(--dshw-term-tool)}
.dshw-step--agent .dshw-step-tag{color:var(--dshw-term-text)}
.dshw-console-side{border-left:1px solid var(--dshw-term-border);padding:10px 12px 12px;display:flex;flex-direction:column;gap:11px;font-size:10.5px;color:var(--dshw-term-muted)}
.dshw-side-title{font-size:10px;font-weight:600;color:var(--dshw-term-text);letter-spacing:.02em;margin-bottom:6px}
.dshw-todo-mini li{display:flex;gap:6px;align-items:flex-start;line-height:1.45;margin-bottom:4px;color:var(--dshw-term-muted)}
.dshw-todo-mini .dshw-ico{width:11px;height:11px;margin-top:1px;flex:none}
.dshw-todo-mini .dshw-done{color:var(--dshw-term-gutter);text-decoration:line-through}
.dshw-todo-mini .dshw-done .dshw-ico{color:var(--dshw-term-tool)}
.dshw-meter-row{display:flex;justify-content:space-between;gap:8px;margin-bottom:5px;font-size:10px;color:var(--dshw-term-muted)}
.dshw-meter{height:4px;border-radius:99px;background:color-mix(in srgb,var(--dshw-term-text) 12%,transparent);overflow:hidden}
.dshw-meter i{display:block;height:100%;width:var(--v,0%);border-radius:99px;background:linear-gradient(90deg,var(--dshw-meter-from),var(--dshw-meter-to))}
.dshw-live-empty{border:1px dashed var(--dshw-border-strong);background:var(--dshw-surface-2);border-radius:10px;padding:18px;text-align:center;font-size:12px;color:var(--dshw-text-3)}
.dshw-live-empty strong{display:block;color:var(--dshw-text);font-size:12.5px;margin-bottom:3px;font-weight:600}

/* key / value ------------------------------------------------------------ */
.dshw-kv{display:flex;flex-direction:column;min-width:0}
.dshw-kv-row{display:grid;grid-template-columns:108px minmax(0,1fr);gap:12px;align-items:start;padding:7px 0;border-top:1px solid var(--dshw-border-soft);min-width:0}
.dshw-kv-row:first-child{border-top:0}
.dshw-kv-k{font-size:12px;color:var(--dshw-text-3);padding-top:1px}
.dshw-kv-v{min-width:0;display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12.5px;color:var(--dshw-text);overflow-wrap:anywhere}
.dshw-kv-v .dshw-mono{font-size:11.5px;color:var(--dshw-text-2)}
.dshw-copy-btn{width:24px;height:24px;flex:none;display:inline-grid;place-items:center;border:0;border-radius:6px;background:transparent;color:var(--dshw-text-3);padding:0;transition:background .12s,color .12s}
.dshw-copy-btn .dshw-ico{width:13px;height:13px}
.dshw-copy-btn:hover{background:var(--dshw-surface-2);color:var(--dshw-text)}
.dshw-git-section+.dshw-git-section{margin-top:12px;padding-top:4px}
.dshw-section-label{display:flex;align-items:center;gap:6px;font-size:10.5px;font-weight:650;color:var(--dshw-text-3);letter-spacing:.03em;margin:2px 0}
.dshw-section-label .dshw-ico{width:13px;height:13px}
.dshw-nowrap{white-space:nowrap}

/* actions ---------------------------------------------------------------- */
.dshw-action-grid{display:flex;gap:8px;flex-wrap:wrap}
.dshw-action-grid>.dshw-btn{flex:1 1 150px}
.dshw-card .dshw-hint{margin-top:9px;font-size:11px;color:var(--dshw-text-3);line-height:1.6}
.dshw-card .dshw-hint .dshw-ico{display:inline-block;vertical-align:-2px;width:12px;height:12px;margin-right:3px}

/* stats ------------------------------------------------------------------ */
.dshw-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}
.dshw-stat{display:flex;align-items:center;gap:10px;padding:11px 12px;background:var(--dshw-surface-2);border:1px solid var(--dshw-border);border-radius:10px;min-width:0}
.dshw-stat-ico{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;flex:none}
.dshw-stat-ico .dshw-ico{width:16px;height:16px}
.dshw-stat-ico--blue{background:var(--dshw-brand-soft);color:var(--dshw-brand)}
.dshw-stat-ico--green{background:var(--dshw-success-soft);color:var(--dshw-success)}
.dshw-stat-ico--amber{background:var(--dshw-warn-soft);color:var(--dshw-warn)}
.dshw-stat-ico--purple{background:var(--dshw-purple-soft);color:var(--dshw-purple)}
.dshw-stat-body{min-width:0}
.dshw-stat-num{font-size:18px;font-weight:700;line-height:1.15;font-variant-numeric:tabular-nums}
.dshw-stat-label{font-size:10.5px;color:var(--dshw-text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dshw-attention{display:flex;align-items:center;gap:8px;padding:8px 10px;margin:0 0 12px;background:var(--dshw-warn-soft);border:1px solid var(--dshw-warn-border);border-radius:8px;font-size:11.5px;color:var(--dshw-text-2)}
.dshw-attention .dshw-ico{width:14px;height:14px;color:var(--dshw-warn)}
.dshw-attention .dshw-link-btn{margin-left:auto}

/* forms ------------------------------------------------------------------ */
.dshw-form-rows{display:flex;flex-direction:column;gap:13px}
.dshw-form-row{display:grid;grid-template-columns:96px minmax(0,1fr);gap:12px;align-items:start}
.dshw-form-row>label{padding-top:9px;font-size:12px;color:var(--dshw-text-2);font-weight:600}
.dshw-form-foot{display:flex;align-items:center;gap:10px;margin-top:16px;padding-top:13px;border-top:1px solid var(--dshw-border-soft)}
.dshw-save-state{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--dshw-success);font-weight:600;min-height:18px}
.dshw-save-state .dshw-ico{width:13px;height:13px}
.dshw-field{margin-bottom:14px;min-width:0}
.dshw-field:last-child{margin-bottom:0}
.dshw-field-label{display:block;font-size:12px;font-weight:600;color:var(--dshw-text-2);margin-bottom:6px}
.dshw-req{color:var(--dshw-danger);margin-left:3px}
.dshw-input, .dshw-scope select.dshw-input, .dshw-scope textarea.dshw-input{width:100%;min-height:36px;border:1px solid var(--dshw-border-strong);border-radius:8px;background:var(--dshw-surface);padding:8px 10px;font-size:12.5px;color:var(--dshw-text);transition:border-color .14s,box-shadow .14s,background .14s}
.dshw-input::placeholder{color:var(--dshw-text-3)}
.dshw-input:hover{border-color:var(--dshw-text-3)}
.dshw-input:focus{outline:none;border-color:var(--dshw-brand);box-shadow:var(--dshw-focus-ring)}
.dshw-scope textarea.dshw-input{min-height:86px;resize:vertical;line-height:1.6}
.dshw-scope select.dshw-input{appearance:none;-webkit-appearance:none;padding-right:34px;cursor:pointer;background-image:var(--dshw-select-arrow);background-repeat:no-repeat;background-position:right 10px center;text-overflow:ellipsis;color-scheme:light}
.dshw-dark .dshw-scope select.dshw-input{color-scheme:dark}
.dshw-scope select.dshw-input:disabled{opacity:.6;cursor:not-allowed}
.dshw-input.dshw-invalid{border-color:var(--dshw-danger);box-shadow:0 0 0 3px var(--dshw-danger-soft)}
.dshw-hint{font-size:11px;color:var(--dshw-text-3);line-height:1.55;margin-top:5px}
.dshw-err{display:flex;align-items:flex-start;gap:5px;font-size:11.5px;color:var(--dshw-danger);margin-top:6px;line-height:1.5}
.dshw-err .dshw-ico{width:13px;height:13px;margin-top:1px}
.dshw-err .dshw-link-btn{color:var(--dshw-danger);text-decoration:underline;font-weight:500;margin-left:2px}
.dshw-field-inline{display:flex;gap:8px;align-items:stretch}
.dshw-field-inline .dshw-input{flex:1;min-width:0}
.dshw-field-inline .dshw-btn{height:36px;flex:none}
.dshw-readonly-box{display:flex;align-items:center;gap:8px;min-height:36px;padding:7px 10px;border:1px solid var(--dshw-border);border-radius:8px;background:var(--dshw-surface-2);font-size:12.5px;font-weight:600;color:var(--dshw-text)}
.dshw-readonly-box .dshw-folder-tile{width:20px;height:20px}
.dshw-select-loading{display:flex;align-items:center;gap:8px;min-height:36px;padding:8px 10px;border:1px solid var(--dshw-border-strong);border-radius:8px;background:var(--dshw-surface-2);font-size:12.5px;color:var(--dshw-text-3)}
.dshw-select-loading .dshw-spinner{width:13px;height:13px;color:var(--dshw-text-3)}
.dshw-check{display:flex;align-items:flex-start;gap:9px;font-size:12.5px;cursor:pointer;color:var(--dshw-text)}
.dshw-check input{width:15px;height:15px;margin:1px 0 0;accent-color:var(--dshw-brand);flex:none;cursor:pointer}
.dshw-check-copy{min-width:0}
.dshw-check small{display:block;font-size:11px;color:var(--dshw-text-3);margin-top:2px;line-height:1.5}
.dshw-check+.dshw-check{margin-top:10px}
.dshw-check:has(input:disabled){opacity:.55}

/* menus ------------------------------------------------------------------ */
.dshw-menu{position:relative;flex:none}
.dshw-menu>summary{list-style:none;cursor:pointer}
.dshw-menu>summary::-webkit-details-marker{display:none}
.dshw-menu-pop{position:absolute;right:0;top:calc(100% + 6px);z-index:30;min-width:190px;background:var(--dshw-surface);border:1px solid var(--dshw-border);border-radius:10px;box-shadow:var(--dshw-shadow-lg);padding:5px}
.dshw-menu-item{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:0;background:transparent;border-radius:7px;padding:8px 9px;font-size:12.5px;color:var(--dshw-text)}
.dshw-menu-item .dshw-ico{width:14px;height:14px;color:var(--dshw-text-3)}
.dshw-menu-item:hover{background:var(--dshw-surface-2)}
.dshw-menu-item--danger{color:var(--dshw-danger)}
.dshw-menu-item--danger .dshw-ico{color:var(--dshw-danger)}
.dshw-menu-sep{height:1px;background:var(--dshw-border);margin:5px 4px}

/* empty ------------------------------------------------------------------ */
.dshw-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:72px 24px;gap:9px;min-height:320px}
.dshw-empty-icon{width:64px;height:64px;border-radius:18px;display:grid;place-items:center;background:var(--dshw-brand-soft);color:var(--dshw-brand);margin-bottom:4px}
.dshw-empty-icon .dshw-ico{width:28px;height:28px}
.dshw-empty h2{font-size:15px;font-weight:600;color:var(--dshw-text)}
.dshw-empty p{font-size:12px;color:var(--dshw-text-3);line-height:1.7;max-width:48ch}
.dshw-empty .dshw-btn{margin-top:8px}
.dshw-detail-empty{padding-top:96px}

/* settings --------------------------------------------------------------- */
.dshw-settings{padding:22px 26px 44px;max-width:960px;margin:0 auto;min-height:100%;background:var(--dshw-bg)}
.dshw-recent-list{display:flex;flex-direction:column}
.dshw-recent-row{display:flex;align-items:center;gap:10px;padding:9px 4px;border-top:1px solid var(--dshw-border-soft)}
.dshw-recent-row:first-child{border-top:0}
.dshw-recent-row>.dshw-ico{width:15px;height:15px;color:var(--dshw-text-3)}
.dshw-recent-main{flex:1;min-width:0}
.dshw-recent-path{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--dshw-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dshw-danger-row{display:flex;align-items:center;gap:10px;margin-top:12px;padding:9px 11px;background:var(--dshw-danger-soft);border:1px solid var(--dshw-danger-border);border-radius:8px;font-size:11.5px;color:var(--dshw-text-2)}
.dshw-danger-row>.dshw-ico{width:14px;height:14px;color:var(--dshw-danger)}
.dshw-danger-row .dshw-btn{margin-left:auto}

/* modal ------------------------------------------------------------------ */
.dshw-modal-layer{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--dshw-overlay);animation:dshw-fade-in .14s ease-out}
.dshw-modal{width:min(620px,100%);max-height:min(84vh,760px);display:flex;flex-direction:column;background:var(--dshw-surface);border:1px solid var(--dshw-border);border-radius:14px;box-shadow:var(--dshw-shadow-lg);overflow:hidden;animation:dshw-modal-in .16s ease-out}
.dshw-modal--sm{width:min(560px,100%)}
.dshw-modal--lg{width:min(680px,100%)}
@keyframes dshw-fade-in{from{opacity:0}to{opacity:1}}
@keyframes dshw-modal-in{from{opacity:0;transform:translateY(8px) scale(.988)}to{opacity:1;transform:none}}
.dshw-modal-head{display:flex;align-items:flex-start;gap:11px;padding:17px 20px 14px;border-bottom:1px solid var(--dshw-border-soft);flex:none}
.dshw-modal-icon{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;flex:none;background:var(--dshw-brand-soft);color:var(--dshw-brand);border:1px solid var(--dshw-brand-border)}
.dshw-modal-icon .dshw-ico{width:17px;height:17px}
.dshw-modal-icon--danger{background:var(--dshw-danger-soft);color:var(--dshw-danger);border-color:var(--dshw-danger-border)}
.dshw-modal-icon--warn{background:var(--dshw-warn-soft);color:var(--dshw-warn);border-color:var(--dshw-warn-border)}
.dshw-modal-head-copy{min-width:0;flex:1;padding-top:1px}
.dshw-modal-title{font-size:15.5px;font-weight:650;line-height:1.35;letter-spacing:-.005em}
.dshw-modal-sub{font-size:11.5px;color:var(--dshw-text-3);line-height:1.55;margin-top:3px}
.dshw-modal-close{width:30px;height:30px;flex:none;display:grid;place-items:center;border:1px solid transparent;background:transparent;color:var(--dshw-text-3);border-radius:8px;margin:-2px -5px 0 0;padding:0}
.dshw-modal-close:hover{background:var(--dshw-surface-2);color:var(--dshw-text)}
.dshw-modal-close .dshw-ico{width:16px;height:16px}
.dshw-modal-body{padding:17px 20px 18px;overflow:auto;flex:1;min-height:0}
.dshw-modal-foot{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:13px 20px;border-top:1px solid var(--dshw-border-soft);background:var(--dshw-surface);flex:none}

/* modal internals -------------------------------------------------------- */
.dshw-advanced{border:1px solid var(--dshw-brand-border);border-radius:10px;margin:4px 0 12px;background:color-mix(in srgb,var(--dshw-brand-soft) 62%,var(--dshw-surface));padding:0 12px}
.dshw-advanced>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:7px;padding:10px 0;font-size:12.5px;font-weight:600;color:var(--dshw-text)}
.dshw-advanced>summary::-webkit-details-marker{display:none}
.dshw-advanced>summary .dshw-ico{width:14px;height:14px;color:var(--dshw-text-2);transition:transform .16s}
.dshw-advanced[open]>summary .dshw-ico{transform:rotate(180deg)}
.dshw-advanced-body{padding:2px 0 13px}
.dshw-preview{display:flex;align-items:center;gap:9px;flex-wrap:wrap;border:1px solid var(--dshw-border);background:var(--dshw-surface-2);border-radius:8px;padding:8px 11px;font-size:11px;color:var(--dshw-text-3);margin-top:2px}
.dshw-preview .dshw-preview-label{font-weight:600;flex:none}
.dshw-preview-item{display:inline-flex;align-items:center;gap:5px;min-width:0;max-width:100%}
.dshw-preview .dshw-mono{font-size:10.5px;color:var(--dshw-text-2);overflow-wrap:anywhere;min-width:0}
.dshw-preview .dshw-sep{color:var(--dshw-border-strong)}
.dshw-info-table{border:1px solid var(--dshw-border);background:var(--dshw-surface-2);border-radius:9px;padding:3px 11px;margin-bottom:15px}
.dshw-info-table .dshw-kv-row{grid-template-columns:88px minmax(0,1fr);border-top:1px solid var(--dshw-border-soft)}
.dshw-info-table .dshw-kv-row:first-child{border-top:0}
.dshw-danger-list{background:var(--dshw-warn-soft);border:1px solid var(--dshw-warn-border);border-radius:10px;padding:11px 12px;margin:11px 0 14px}
.dshw-danger-list .dshw-danger-title{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--dshw-warn)}
.dshw-danger-list .dshw-danger-title .dshw-ico{width:14px;height:14px}
.dshw-danger-item{display:flex;align-items:flex-start;gap:7px;margin-top:7px;padding:7px 9px;background:var(--dshw-surface);border:1px solid var(--dshw-border);border-radius:7px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;line-height:1.5;color:var(--dshw-text-2);overflow-wrap:anywhere}
.dshw-danger-item .dshw-ico{width:12px;height:12px;margin-top:1px;color:var(--dshw-text-3)}

/* toast ------------------------------------------------------------------ */
.dshw-toast{position:fixed;left:50%;bottom:26px;z-index:2147483001;display:flex;align-items:center;gap:8px;padding:9px 14px;background:var(--dshw-toast-bg);color:var(--dshw-toast-fg);border-radius:9px;font-size:12.5px;font-weight:500;box-shadow:var(--dshw-shadow-lg);transform:translate(-50%,14px);opacity:0;pointer-events:none;transition:opacity .18s ease,transform .18s ease;max-width:min(92vw,560px)}
.dshw-toast--show{opacity:1;transform:translate(-50%,0)}
.dshw-toast .dshw-ico{width:15px;height:15px;flex:none}

/* responsive ------------------------------------------------------------- */
@container dshw (max-width:860px){
  .dshw-app{grid-template-columns:268px minmax(0,1fr)}
  .dshw-detail-scroll{padding:18px 18px 36px}
}
@container dshw (max-width:1100px){
  .dshw-console-grid{grid-template-columns:1fr}
  .dshw-console-side{border-left:0;border-top:1px solid var(--dshw-term-border);flex-direction:row;flex-wrap:wrap;gap:14px}
  .dshw-console-side>.dshw-side-block{flex:1 1 160px}
}
@container dshw (max-width:700px){
  .dshw-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
  .dshw-console-grid{grid-template-columns:1fr}
  .dshw-console-side{border-left:0;border-top:1px solid var(--dshw-term-border);flex-direction:row;flex-wrap:wrap;gap:14px}
  .dshw-console-side>.dshw-side-block{flex:1 1 150px}
}
@container dshw (max-width:620px){
  .dshw-app{display:block}
  .dshw-tree{width:100%;height:100%;border-right:0}
  .dshw-detail{display:none;height:100%}
  .dshw-app--detail .dshw-tree{display:none}
  .dshw-app--detail .dshw-detail{display:flex}
  .dshw-detail-scroll{padding:14px 14px 36px}
  .dshw-mobile-bar{display:flex;align-items:center;gap:8px;margin:-4px 0 10px;padding:4px 0 8px;position:sticky;top:0;z-index:4;background:var(--dshw-bg);border-bottom:1px solid var(--dshw-border)}
  .dshw-hero-top{flex-direction:column;gap:14px}
  .dshw-hero-action{width:100%;align-items:stretch}
  .dshw-hero-action .dshw-btn{width:100%}
  .dshw-hero-action .dshw-hint{max-width:none;text-align:left}
  .dshw-page-head{flex-wrap:wrap}
  .dshw-page-actions{margin-left:0;width:100%;justify-content:flex-end}
  .dshw-action-grid>.dshw-btn{flex:1 1 100%}
}
@container dshw (max-width:420px){
  .dshw-detail-scroll{padding:10px 10px 32px}
  .dshw-kv-row{grid-template-columns:1fr;gap:2px;padding:8px 0}
  .dshw-kv-k{font-size:10.5px}
  .dshw-kv-v{font-size:12.5px}
  .dshw-form-row{grid-template-columns:1fr;gap:4px}
  .dshw-form-row>label{padding-top:0}
  .dshw-card{padding:13px;border-radius:10px}
  .dshw-hero{padding:14px}
  .dshw-hero h1{font-size:18px}
  .dshw-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
  .dshw-task{margin-left:12px}
  .dshw-page-head h1{font-size:18px}
  .dshw-project{flex-wrap:wrap;gap:2px}
  .dshw-project-select{flex:1 1 calc(100% - 28px)}
  .dshw-tree-inline-empty .dshw-link-btn{display:none}
  .dshw-project-add{order:4;display:inline-flex;align-items:center;justify-content:center;gap:3px;width:auto;height:22px;padding:0 7px;margin-left:26px;opacity:1;border-radius:6px;color:var(--dshw-text-3)}
  .dshw-project-add .dshw-ico{width:12px;height:12px}
}

@media (max-width:520px){
  .dshw-modal-layer{padding:10px;align-items:flex-end}
  .dshw-modal{max-height:94dvh;border-radius:14px 14px 12px 12px}
  .dshw-modal-head{padding:15px 16px 12px}
  .dshw-modal-body{padding:15px 16px 16px}
  .dshw-modal-foot{padding:12px 16px}
}

@supports not (color: color-mix(in srgb, white, black)){
  .dshw-advanced{background:var(--dshw-brand-soft)}
  .dshw-meter{background:var(--dshw-term-border)}
}

@media (prefers-reduced-motion:reduce){
  .dshw-scope *, .dshw-scope *::before, .dshw-scope *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}
  .dshw-sk-line{animation:none;background:var(--dshw-surface-3)}
}
`

/* --------------------------------------------------------------------------
 * Small utilities
 * ------------------------------------------------------------------------ */

const pad2 = (n: number) => String(n).padStart(2, '0')

function relTime(ts: number | null | undefined, t: any): string {
  if (!ts) return '—'
  const diff = Date.now() - ts
  if (diff >= 0 && diff < 60_000) return t.justNow
  if (diff >= 0 && diff < 3_600_000) return String(t.minutesAgo).replace('{n}', String(Math.floor(diff / 60_000)))
  if (diff >= 0 && diff < 86_400_000) return String(t.hoursAgo).replace('{n}', String(Math.floor(diff / 3_600_000)))
  if (diff >= 0 && diff < 7 * 86_400_000) return String(t.daysAgo).replace('{n}', String(Math.floor(diff / 86_400_000)))
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function baseName(p: string): string {
  const norm = String(p || '').replace(/[\\/]+$/, '')
  const idx = Math.max(norm.lastIndexOf('/'), norm.lastIndexOf('\\'))
  return idx >= 0 ? norm.slice(idx + 1) : norm
}

function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {
    /* noop */
  }
  return 'req-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const cx = (...parts: any[]) => parts.filter(Boolean).join(' ')

const STATUS_TONE: Record<string, string> = {
  ready: 'neutral',
  cleaned: 'neutral',
  developing: 'brand',
  reviewing: 'brand',
  review: 'warn',
  merged: 'success',
  broken: 'error',
}

function pendingLabel(t: any, kind: string | null | undefined): string {
  if (!kind) return ''
  if (kind === 'approval') return t.pendingApproval
  if (kind === 'plan-review') return t.pendingPlanReview
  if (kind === 'question') return t.pendingQuestion
  return t.pendingApproval
}

function statusMeta(t: any, status: string, pendingKind?: string | null) {
  const terminal = status === 'merged' || status === 'cleaned'
  if (pendingKind && !terminal) return { label: pendingLabel(t, pendingKind), tone: 'warn', pending: true }
  return {
    label: (t as any)[status] || status,
    tone: STATUS_TONE[status] || 'neutral',
    // Terminal states keep their lifecycle label; pending is shown as a second chip.
    pending: !!pendingKind,
    note: pendingKind ? pendingLabel(t, pendingKind) : '',
  }
}

function jp(v: any): any {
  if (v === undefined || v === null) return null
  if (typeof v !== 'string') return v
  try {
    return JSON.parse(v)
  } catch {
    return null
  }
}

function fmtK(n: any): string | null {
  if (typeof n !== 'number' || !(n > 0)) return null
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n)
}

/** Visible text of a DSH message content array. */
function contentText(content: any): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (block && typeof block.text === 'string' && block.text.trim()) parts.push(block.text)
  }
  return parts.join('\n')
}

function clipText(value: any, max: number): string {
  const text = String(value == null ? '' : value).replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim()
  return text.length > max ? text.slice(0, max) + '…' : text
}

/** Keep tool output informative without dumping whole files into the console. */
function summarizeResult(name: string | undefined, raw: string): string {
  const text = clipText(raw, 4000)
  if (!name) return text
  if (name === 'read') {
    const lines = text ? text.split('\n').length : 0
    return '读取完成 · ' + lines + ' 行 · ' + text.length + ' 字符'
  }
  if (name === 'glob') {
    const items = text.split('\n').map((item) => item.trim()).filter(Boolean)
    return '匹配 ' + items.length + ' 个文件' + (items.length ? '\n' + items.slice(0, 3).join('\n') + (items.length > 3 ? '\n…' : '') : '')
  }
  if (name === 'write') return '写入完成'
  return text
}

type TimelineEntry = {
  id: string
  kind: 'user' | 'think' | 'agent' | 'tool'
  title: string
  detail: string
  tool?: string
  status?: 'ok' | 'error' | 'running'
  durationMs?: number
  meta?: string
  stepKey?: string
  model?: string
}

function firstLine(value: any, max = 140): string {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim()
  return text.length > max ? text.slice(0, max) + '…' : text
}

function parentDir(value: any): string {
  const path = String(value || '').replace(/[\\/]+$/, '')
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return index > 0 ? path.slice(0, index) : ''
}

/** Short directory hint for a file row; the worktree root itself adds no signal. */
function dirLabel(value: any): string {
  const parent = parentDir(value)
  if (!parent) return ''
  if (/[\\/]\.dsh-worktrees[\\/][^\\/]+$/.test(parent)) return ''
  return baseName(parent) + '/'
}

function parseArgs(raw: any): any {
  if (raw && typeof raw === 'object') return raw
  if (typeof raw !== 'string') return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Rough added/removed line counts for the edit header. */
function diffCounts(meta: any): string | null {
  const diff = meta && Array.isArray(meta.diffs) ? meta.diffs[0] : null
  if (!diff) return null
  const oldText = typeof diff.oldText === 'string' ? diff.oldText : ''
  const newText = typeof diff.newText === 'string' ? diff.newText : ''
  if (!oldText && !newText) return null
  const counts = new Map<string, number>()
  for (const line of oldText.split('\n').slice(0, 4000)) counts.set(line, (counts.get(line) || 0) + 1)
  let added = 0
  for (const line of newText.split('\n').slice(0, 4000)) {
    const count = counts.get(line) || 0
    if (count > 0) counts.set(line, count - 1)
    else added += 1
  }
  let removed = 0
  for (const count of counts.values()) removed += count
  return '+' + added + ' -' + removed
}

function toolTitle(name: string, args: any): string {
  if (!args || typeof args !== 'object') return firstLine(name)
  const path = args.file_path || args.path || ''
  if ((name === 'read' || name === 'write' || name === 'edit' || name === 'multi_edit') && path) {
    return baseName(path) + (dirLabel(path) ? ' · ' + dirLabel(path) : '')
  }
  if (name === 'pwsh' || name === 'shell' || name === 'terminal') return firstLine(args.command, 180)
  if (name === 'glob' || name === 'grep' || name === 'search') return firstLine(args.pattern || args.query, 180)
  if (name === 'working_directory') return firstLine(args.cd, 180)
  if (name === 'todo_write' || name === 'todowrite') {
    const todos = Array.isArray(args.todos) ? args.todos.map((todo: any) => todo && todo.content).filter(Boolean) : []
    return firstLine(todos.join(' / ') || '更新执行清单')
  }
  if (name === 'ask_user_question') return firstLine(args.question || args.header, 180)
  if (args.command) return firstLine(args.command, 180)
  if (path) return firstLine(path, 180)
  return firstLine(JSON.stringify(args), 180)
}

function toolDetail(name: string, args: any): string {
  if (!args || typeof args !== 'object') return ''
  const path = args.file_path || args.path || ''
  if (name === 'pwsh' || name === 'shell' || name === 'terminal') return clipText(args.command, 2000)
  if (name === 'read') return clipText(path, 2000)
  if (name === 'write' || name === 'edit' || name === 'multi_edit') {
    const lines = [path]
    if (typeof args.content === 'string') lines.push('内容：' + args.content.length + ' 字符')
    return lines.filter(Boolean).join('\n')
  }
  if (name === 'glob' || name === 'grep' || name === 'search') return clipText(args.pattern || args.query, 2000)
  if (name === 'working_directory') return clipText(args.cd, 2000)
  return clipText(JSON.stringify(args), 2000)
}

function fmtDuration(ms: number | undefined): string | null {
  if (typeof ms !== 'number' || ms < 0) return null
  const total = Math.max(1, Math.round(ms / 1000))
  if (total < 60) return total + ' 秒'
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return minutes + ' 分' + (seconds ? ' ' + seconds + ' 秒' : '')
}

/**
 * Turn DSH session history records into a collapsed timeline. Thinking blocks
 * and tool calls each become one row; a tool call and its result are paired so
 * the row can show success/failure and expand to the command + output.
 */
function buildHistoryEntries(records: any[], limit = 240): TimelineEntry[] {
  const entries: TimelineEntry[] = []
  const stepStarts = new Map<string, number>()
  const stepDurations = new Map<string, number>()
  const thinkDurationUsed = new Set<string>()
  const pending = new Map<string, { entry: TimelineEntry; time: number }>()
  let n = 0
  const add = (entry: Omit<TimelineEntry, 'id'>): TimelineEntry => {
    const next: TimelineEntry = Object.assign({ id: 'e' + (n += 1) }, entry)
    entries.push(next)
    return next
  }

  for (const record of records || []) {
    const event = record && (record.event || record)
    if (!event || !event.type) continue
    const data = event.data || {}
    const stepKey = data.turn != null && data.step != null ? data.turn + ':' + data.step : undefined
    const time = typeof event.time === 'number' ? event.time : 0

    if (event.type === 'step/start' && stepKey) {
      stepStarts.set(stepKey, time)
      continue
    }
    if (event.type === 'step/end' && stepKey) {
      const start = stepStarts.get(stepKey)
      if (start && time > start) stepDurations.set(stepKey, time - start)
      continue
    }

    if (event.type === 'user/message') {
      const source = data.source && data.source.kind
      // Runtime context, skill catalogs and clock snapshots are injected as
      // user messages; only the human prompt belongs in the console.
      if (source && source !== 'user') continue
      const text = clipText(contentText(data.content), 4000)
      if (text) add({ kind: 'user', stepKey, title: firstLine(text), detail: text })
      continue
    }

    if (event.type === 'assistant/message') {
      const message = data.message || {}
      const source = message.source || {}
      const model = source.provider && source.model ? source.provider + '/' + source.model : (typeof source.model === 'string' ? source.model : undefined)
      for (const block of Array.isArray(message.content) ? message.content : []) {
        if (!block) continue
        if (block.type === 'reasoning' && block.text) {
          const text = clipText(block.text, 4000)
          add({ kind: 'think', stepKey, title: '', detail: text, model })
        } else if (block.type === 'text' && block.text) {
          const text = clipText(block.text, 4000)
          add({ kind: 'agent', stepKey, title: firstLine(text), detail: text, model })
        }
      }
      continue
    }

    if (event.type === 'tool/call') {
      const name = String(data.name || 'tool')
      const args = parseArgs(data.arguments)
      const entry = add({
        kind: 'tool',
        tool: name,
        stepKey,
        title: toolTitle(name, args),
        detail: toolDetail(name, args),
        status: 'running',
      })
      if (data.callId) pending.set(String(data.callId), { entry, time })
      continue
    }

    if (event.type === 'tool/result') {
      const message = data.message || {}
      const callId = (message.source && message.source.callId) || message.toolCallId || data.callId
      const found = callId ? pending.get(String(callId)) : undefined
      const raw = contentText(message.content)
      const isError = message.isError === true || !!data.error
      if (found) {
        found.entry.status = isError ? 'error' : 'ok'
        found.entry.meta = diffCounts(data.meta) || found.entry.meta
        const result = isError ? clipText(raw, 2000) : summarizeResult(found.entry.tool, raw)
        found.entry.detail = [found.entry.detail, result].filter(Boolean).join('\n\n')
        if (time && found.time) found.entry.durationMs = time - found.time
      } else if (raw) {
        add({
          kind: 'tool',
          tool: 'result',
          stepKey,
          title: firstLine(raw),
          detail: clipText(raw, 2000),
          status: isError ? 'error' : 'ok',
        })
      }
    }
  }

  for (const entry of entries) {
    if (entry.kind !== 'think' || !entry.stepKey || thinkDurationUsed.has(entry.stepKey)) continue
    const duration = stepDurations.get(entry.stepKey)
    if (duration) {
      entry.durationMs = duration
      thinkDurationUsed.add(entry.stepKey)
    }
  }

  return entries.slice(-limit)
}

function fallbackEntries(turns: any[], limit = 40): TimelineEntry[] {
  const entries: TimelineEntry[] = []
  let n = 0
  for (const turn of (turns || []).slice(-6)) {
    if (!turn) continue
    if (turn.prompt) {
      const text = clipText(turn.prompt, 2000)
      entries.push({ id: 'fu' + (n += 1), kind: 'user', title: firstLine(text), detail: text })
    }
    if (turn.response) {
      const text = clipText(turn.response, 2000)
      entries.push({ id: 'fa' + (n += 1), kind: 'agent', title: firstLine(text), detail: text })
    }
  }
  return entries.slice(-limit)
}

function fallbackCopy(text: string): boolean {
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '-1000px'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}

function copyText(text: string): Promise<boolean> {
  if (!text) return Promise.resolve(false)
  const clip = (navigator as any)?.clipboard
  if (clip && typeof clip.writeText === 'function') {
    return clip.writeText(text).then(() => true, () => fallbackCopy(text))
  }
  return Promise.resolve(fallbackCopy(text))
}

/* --------------------------------------------------------------------------
 * Icon set (single inline sprite, no extra dependency)
 * ------------------------------------------------------------------------ */

const ICONS: Record<string, any[]> = {
  layers: [
    ['path', { d: 'm12 3 9 5-9 5-9-5 9-5Z' }],
    ['path', { d: 'm3 12 9 5 9-5' }],
    ['path', { d: 'm3 16 9 5 9-5' }],
  ],
  folder: [['path', { d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z' }]],
  branch: [
    ['line', { x1: 6, y1: 3, x2: 6, y2: 15 }],
    ['circle', { cx: 18, cy: 6, r: 3 }],
    ['circle', { cx: 6, cy: 18, r: 3 }],
    ['path', { d: 'M18 9a9 9 0 0 1-9 9' }],
  ],
  merge: [
    ['circle', { cx: 18, cy: 18, r: 3 }],
    ['circle', { cx: 6, cy: 6, r: 3 }],
    ['path', { d: 'M6 9a6 6 0 0 0 6 6h3' }],
  ],
  grid: [
    ['rect', { x: 3, y: 3, width: 7, height: 7, rx: 1.6 }],
    ['rect', { x: 14, y: 3, width: 7, height: 7, rx: 1.6 }],
    ['rect', { x: 3, y: 14, width: 7, height: 7, rx: 1.6 }],
    ['rect', { x: 14, y: 14, width: 7, height: 7, rx: 1.6 }],
  ],
  settings: [
    ['circle', { cx: 12, cy: 12, r: 3 }],
    ['path', { d: 'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z' }],
  ],
  search: [
    ['circle', { cx: 11, cy: 11, r: 7 }],
    ['path', { d: 'm20 20-3.5-3.5' }],
  ],
  plus: [['path', { d: 'M12 5v14M5 12h14' }]],
  chevronDown: [['path', { d: 'm6 9 6 6 6-6' }]],
  arrowLeft: [
    ['path', { d: 'M19 12H5' }],
    ['path', { d: 'm11 18-6-6 6-6' }],
  ],
  arrowUp: [
    ['path', { d: 'M12 19V5' }],
    ['path', { d: 'm6 11 6-6 6 6' }],
  ],
  external: [
    ['path', { d: 'M14 4h6v6' }],
    ['path', { d: 'M20 4 11 13' }],
    ['path', { d: 'M18 14v5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7.5A1.5 1.5 0 0 1 5 6h5' }],
  ],
  copy: [
    ['rect', { x: 9, y: 9, width: 12, height: 12, rx: 2 }],
    ['path', { d: 'M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1' }],
  ],
  alert: [
    ['path', { d: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z' }],
    ['line', { x1: 12, y1: 9, x2: 12, y2: 13 }],
    ['line', { x1: 12, y1: 17, x2: 12.01, y2: 17 }],
  ],
  trash: [
    ['path', { d: 'M3 6h18' }],
    ['path', { d: 'M8 6V4h8v2' }],
    ['path', { d: 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6' }],
    ['path', { d: 'M10 11v6M14 11v6' }],
  ],
  check: [['path', { d: 'm5 12 4.5 4.5L19 7' }]],
  checkCircle: [
    ['circle', { cx: 12, cy: 12, r: 9 }],
    ['path', { d: 'm8.5 12 2.5 2.5 4.5-5' }],
  ],
  x: [['path', { d: 'M6 6l12 12M18 6 6 18' }]],
  xCircle: [
    ['circle', { cx: 12, cy: 12, r: 9 }],
    ['path', { d: 'm9 9 6 6M15 9l-6 6' }],
  ],
  clock: [
    ['circle', { cx: 12, cy: 12, r: 9 }],
    ['path', { d: 'M12 7v5l3 2' }],
  ],
  terminal: [
    ['rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }],
    ['path', { d: 'm7 9 3 3-3 3' }],
    ['path', { d: 'M13 15h4' }],
  ],
  message: [['path', { d: 'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l2-3a8.5 8.5 0 1 1 15-5.5Z' }]],
  file: [
    ['path', { d: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z' }],
    ['path', { d: 'M14 3v6h6' }],
    ['path', { d: 'M8 13h8M8 17h5' }],
  ],
  refresh: [
    ['path', { d: 'M3 12a9 9 0 1 0 3-6.7L3 8' }],
    ['path', { d: 'M3 3v5h5' }],
  ],
  more: [
    ['circle', { cx: 5, cy: 12, r: 1.4, fill: 'currentColor', stroke: 'none' }],
    ['circle', { cx: 12, cy: 12, r: 1.4, fill: 'currentColor', stroke: 'none' }],
    ['circle', { cx: 19, cy: 12, r: 1.4, fill: 'currentColor', stroke: 'none' }],
  ],
  circle: [['circle', { cx: 12, cy: 12, r: 8 }]],
  play: [['path', { d: 'm8 5 11 7-11 7Z' }]],
  info: [
    ['circle', { cx: 12, cy: 12, r: 9 }],
    ['path', { d: 'M12 11v5M12 8h.01' }],
  ],
  sliders: [
    ['path', { d: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2' }],
    ['circle', { cx: 16, cy: 6, r: 2 }],
    ['circle', { cx: 10, cy: 12, r: 2 }],
    ['circle', { cx: 16, cy: 18, r: 2 }],
  ],
  database: [
    ['ellipse', { cx: 12, cy: 5, rx: 8, ry: 3 }],
    ['path', { d: 'M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5' }],
    ['path', { d: 'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3' }],
  ],
}

/** factory(require) is called by window.__ModuleLoader__ with a module resolver. */
export function factory(require: Req) {
  let appCtx: any = null
  const React = require('react')
  const h = React.createElement

  const api = (p: string) => `/dsh-worktree/api/${p}`

  // Board-wide auth token, auto-refreshed on 401/403 (e.g. after a host restart).
  let boardToken: string | null = null
  async function fetchBoardToken(): Promise<string> {
    const r = await sendJsonRaw('session', { sessionId: 'worktree-board' }, 'POST')
    boardToken = String(r.token || '')
    return boardToken
  }
  async function withToken<T>(fn: (token: string) => Promise<T>): Promise<T> {
    const token = boardToken || (await fetchBoardToken())
    try {
      return await fn(token)
    } catch (e: any) {
      if (e && (e.status === 401 || e.status === 403)) {
        boardToken = null
        const fresh = await fetchBoardToken()
        return fn(fresh)
      }
      throw e
    }
  }

  /** Reject a pending request after `ms` so a lost response cannot lock a modal forever. */
  function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let settled = false
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        reject(Object.assign(new Error(message), { timeout: true, code: 'timeout' }))
      }, ms)
      p.then(
        (v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v) } },
        (e) => { if (!settled) { settled = true; clearTimeout(timer); reject(e) } },
      )
    })
  }
  async function getJson(path: string) {
    return withToken((token) =>
      fetch(api(path), { headers: { 'x-dsh-worktree-token': token } }).then(async (res) => {
        if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status), { status: res.status })
        return res.json()
      }),
    )
  }
  async function sendJsonRaw(path: string, body: any, method: string) {
    const res = await fetch(api(path), { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw Object.assign(new Error(data.error || data.message || 'HTTP ' + res.status), { status: res.status })
    return data
  }
  async function sendJson(path: string, body: any, method: string) {
    return withToken((token) =>
      fetch(api(path), { method, headers: { 'content-type': 'application/json', 'x-dsh-worktree-token': token }, body: JSON.stringify(body || {}) }).then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw Object.assign(new Error(data.error || data.message || 'HTTP ' + res.status), { status: res.status })
        return data
      }),
    )
  }
  const post = (path: string, body: any) => sendJson(path, body, 'POST')

  let styleRefs = 0
  let sharedStyleEl: any = null

  function useStyles() {
    React.useEffect(() => {
      styleRefs += 1
      if (!sharedStyleEl || !sharedStyleEl.isConnected) {
        sharedStyleEl = document.createElement('style')
        sharedStyleEl.setAttribute('data-dshw', '1')
        sharedStyleEl.textContent = CSS
        document.head.appendChild(sharedStyleEl)
      }
      // Native <select> popups are painted by the OS: tell it which scheme to use.
      const applyScheme = () => {
        const probeEl = document.createElement('span')
        probeEl.style.cssText = 'position:fixed;left:-9999px;top:0;color:var(--dsw-alias-label-primary,#000)'
        document.body.appendChild(probeEl)
        const rgb = getComputedStyle(probeEl).color.match(/\d+/g)
        probeEl.remove()
        const lum = rgb ? (Number(rgb[0]) * 299 + Number(rgb[1]) * 587 + Number(rgb[2]) * 114) / 1000 : 0
        document.documentElement.classList.toggle('dshw-dark', lum > 140)
      }
      applyScheme()
      const mo = new MutationObserver(applyScheme)
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] })
      mo.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] })
      const timer = window.setInterval(applyScheme, 4000)
      return () => {
        mo.disconnect()
        window.clearInterval(timer)
        styleRefs = Math.max(0, styleRefs - 1)
        if (styleRefs === 0 && sharedStyleEl) {
          try {
            sharedStyleEl.remove()
          } catch {
            /* noop */
          }
          sharedStyleEl = null
        }
      }
    }, [])
  }

  /**
   * Create the DSH conversation for a task and optionally kick it off.
   * The session lands in the project's workspace (created idempotently over
   * the main repo) so the sidebar groups it under the project instead of
   * 未分组; the first prompt tells the agent to cd into the worktree.
   * Falls back to a cwd-bound session when the workspace call fails.
   */
  async function bindSession(remotes: any, task: any, projectTitle?: string): Promise<string> {
    let workspaceId: string | undefined
    try {
      const w = await remotes.workspace.create({ path: task.repoPath })
      if (w && w.ok && w.value) {
        const ws = w.value.workspace ?? w.value
        workspaceId = String(ws.workspaceId ?? ws.id ?? '')
        if (projectTitle && workspaceId && typeof remotes.workspace.rename === 'function') {
          try {
            await remotes.workspace.rename({ workspaceId, title: projectTitle })
          } catch {
            /* best effort */
          }
        }
      }
    } catch {
      /* fall back below */
    }
    const created = workspaceId
      ? await remotes.session.create({ workspaceId })
      : await remotes.session.create({ cwd: task.worktreePath })
    if (!created.ok) {
      const msg = created.error && (created.error.message || created.error.code) ? created.error.message || created.error.code : 'session create failed'
      throw new Error(String(msg))
    }
    const sessionId = String(created.value.sessionId)
    try {
      await remotes.session.rename({ sessionId, title: task.title })
    } catch {
      /* best effort */
    }
    if (task.startOnBind !== false && task.firstPrompt) {
      const tz = (() => {
        try {
          return Intl.DateTimeFormat().resolvedOptions().timeZone || ''
        } catch {
          return ''
        }
      })()
      const sent = await remotes.session.prompt({
        requestId: uuid(),
        sessionId,
        mode: 'queue',
        content: [{ type: 'text', text: task.firstPrompt }],
        ...(tz ? { clientTimeZone: tz } : {}),
      })
      if (sent && sent.ok === false) {
        const msg = sent.error && (sent.error.message || sent.error.code) ? sent.error.message || sent.error.code : 'prompt failed'
        await post('bind', { id: task.id, sessionId }).catch(() => {})
        throw new Error(String(msg))
      }
    }
    await post('bind', { id: task.id, sessionId })
    return sessionId
  }

  /* ----------------------------------------------------------------------
   * Primitives
   * -------------------------------------------------------------------- */

  function Icon(props: any) {
    const shapes = ICONS[props.name] || []
    return h(
      'svg',
      { className: cx('dshw-ico', props.className), viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' },
      shapes.map((shape: any, i: number) => h(shape[0], Object.assign({ key: i }, shape[1]))),
    )
  }

  function Spinner() {
    return h('span', { className: 'dshw-spinner', 'aria-hidden': 'true' })
  }

  function Btn(props: any) {
    const { variant, size, icon, className, children, ...rest } = props
    return h(
      'button',
      Object.assign({ type: 'button', className: cx('dshw-btn', variant ? 'dshw-btn--' + variant : '', size ? 'dshw-btn--' + size : '', className) }, rest),
      icon ? h(Icon, { name: icon }) : null,
      children,
    )
  }

  function IconBtn(props: any) {
    const { size, className, icon, label, children, ...rest } = props
    return h(
      'button',
      Object.assign({ type: 'button', className: cx('dshw-icon-btn', size === 'sm' && 'dshw-icon-btn--sm', className), title: label, 'aria-label': label }, rest),
      children || h(Icon, { name: icon }),
    )
  }

  function Chip(props: any) {
    return h('span', { className: cx('dshw-chip', 'dshw-chip--' + (props.tone || 'neutral'), props.small && 'dshw-chip--sm', props.className) }, props.children)
  }

  function Dot(props: any) {
    return h('span', { className: cx('dshw-dot', 'dshw-dot--' + (props.tone || 'neutral'), props.pulse && 'dshw-dot--pulse'), 'aria-hidden': 'true' })
  }

  function CopyBtn(props: any) {
    const run = () => {
      void copyText(String(props.text || '')).then((ok) => {
        props.notify(ok ? props.t.copied : props.t.copyFailed, ok ? 'ok' : 'error')
      })
    }
    return h('button', { type: 'button', className: 'dshw-copy-btn', title: props.label, 'aria-label': props.label, onClick: run }, h(Icon, { name: 'copy' }))
  }

  function KV(props: any) {
    return h('div', { className: 'dshw-kv-row' },
      h('span', { className: 'dshw-kv-k' }, props.label),
      h('div', { className: 'dshw-kv-v' }, props.children))
  }

  function Card(props: any) {
    return h('section', { className: cx('dshw-card', props.danger && 'dshw-card--danger', props.className) }, props.children)
  }

  function CardHead(props: any) {
    return h('div', { className: 'dshw-card-head' },
      props.icon ? h(Icon, { name: props.icon }) : null,
      h('span', { className: 'dshw-card-title' }, props.title),
      props.right ? h('span', { className: 'dshw-right' }, props.right) : null)
  }

  function Banner(props: any) {
    const tone = props.tone || 'info'
    return h('div', { className: 'dshw-banner dshw-banner--' + tone, role: props.role || (tone === 'error' ? 'alert' : undefined) },
      h(Icon, { name: props.icon || (tone === 'error' ? 'alert' : tone === 'warn' ? 'clock' : 'info') }),
      h('div', { className: 'dshw-banner-copy' },
        props.title ? h('strong', null, props.title) : null,
        h('div', null, props.children)),
      props.actions ? h('div', { className: 'dshw-banner-actions' }, props.actions) : null)
  }

  function Empty(props: any) {
    return h('div', { className: cx('dshw-empty', props.className) },
      h('div', { className: 'dshw-empty-icon' }, h(Icon, { name: props.icon || 'file' })),
      h('h2', null, props.title),
      props.children ? h('p', null, props.children) : null,
      props.action || null)
  }

  function Stat(props: any) {
    return h('div', { className: 'dshw-stat' },
      h('div', { className: 'dshw-stat-ico dshw-stat-ico--' + props.tone }, h(Icon, { name: props.icon })),
      h('div', { className: 'dshw-stat-body' },
        h('div', { className: 'dshw-stat-num' }, props.value),
        h('div', { className: 'dshw-stat-label' }, props.label)))
  }

  function MenuItem(props: any) {
    return h('button', {
      type: 'button',
      className: cx('dshw-menu-item', props.danger && 'dshw-menu-item--danger'),
      onClick: (e: any) => {
        const menu = e.currentTarget.closest('details')
        if (menu) menu.removeAttribute('open')
        if (props.onClick) props.onClick(e)
      },
    },
      props.icon ? h(Icon, { name: props.icon }) : null,
      h('span', null, props.children))
  }

  type ModalProps = {
    t: any
    title: any
    subtitle?: any
    icon?: string
    tone?: 'brand' | 'danger' | 'warn'
    size?: 'sm' | 'lg'
    busy?: boolean
    onClose: () => void
    footer?: any
    children: any
  }

  /* Remember the control that opened a modal (pointerdown outside any dialog), so focus
   * can return there even when focus already moved to <body> by the time the modal closes. */
  let lastModalOpener: any = null
  if (typeof document !== 'undefined' && !(window as any).__dshwOpenerTracker) {
    ;(window as any).__dshwOpenerTracker = true
    document.addEventListener('pointerdown', (e: any) => {
      const el = e && e.target && e.target.closest ? e.target.closest('button,a[href],[role="button"]') : null
      if (el && !el.closest('[role="dialog"]')) lastModalOpener = el
    }, true)
  }

  function Modal(props: ModalProps) {
    const t = props.t
    const dialogRef = React.useRef(null)
    // Capture the opener during render: React's autoFocus would already have moved focus by the time the effect runs.
    const previousRef = React.useRef(typeof document !== 'undefined' ? document.activeElement : null)
    const titleId = React.useRef('dshw-modal-title-' + uuid()).current
    const busyRef = React.useRef(!!props.busy)
    const closeRef = React.useRef(props.onClose)
    busyRef.current = !!props.busy
    closeRef.current = props.onClose

    React.useEffect(() => {
      const previous = previousRef.current
      const node: any = dialogRef.current
      const focusables = () => {
        if (!node) return [] as any[]
        return (Array.from(node.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')) as any[])
          .filter((el: any) => el.getClientRects().length > 0 && el.getAttribute('aria-hidden') !== 'true')
      }
      const focusTimer = window.requestAnimationFrame(() => {
        const preferred = node && node.querySelector('[data-autofocus]')
        const firstControl = node && node.querySelector('input:not([disabled]),select:not([disabled]),textarea:not([disabled])')
        const activeInside = node && node.contains(document.activeElement)
        if (!activeInside) (preferred || firstControl || focusables()[0] || node)?.focus()
      })
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !busyRef.current) {
          e.preventDefault()
          closeRef.current()
          return
        }
        if (e.key !== 'Tab') return
        const items = focusables()
        if (!items.length) {
          e.preventDefault()
          node?.focus()
          return
        }
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && (document.activeElement === first || !node?.contains(document.activeElement))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
      document.addEventListener('keydown', onKeyDown)
      return () => {
        window.cancelAnimationFrame(focusTimer)
        document.removeEventListener('keydown', onKeyDown)
        const returnTo = previous && previous !== document.body && previous.isConnected
          ? previous
          : lastModalOpener && lastModalOpener.isConnected
            ? lastModalOpener
            : null
        if (returnTo && typeof returnTo.focus === 'function') {
          // Defer past the host's own modal teardown, which may move focus to <body>.
          window.requestAnimationFrame(() => {
            window.setTimeout(() => {
              try {
                returnTo.focus({ preventScroll: true })
              } catch {
                returnTo.focus()
              }
            }, 60)
          })
        }
      }
    }, [])

    return h('div', {
      className: 'dshw-modal-layer',
      onMouseDown: (e: any) => {
        if (e.target === e.currentTarget && !props.busy) props.onClose()
      },
    },
      h('div', {
        ref: dialogRef,
        className: cx('dshw-modal', props.size === 'sm' && 'dshw-modal--sm', props.size === 'lg' && 'dshw-modal--lg'),
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': titleId,
        'aria-busy': props.busy ? 'true' : undefined,
        tabIndex: -1,
      },
        h('div', { className: 'dshw-modal-head' },
          props.icon ? h('div', { className: cx('dshw-modal-icon', props.tone && 'dshw-modal-icon--' + props.tone) }, h(Icon, { name: props.icon })) : null,
          h('div', { className: 'dshw-modal-head-copy' },
            h('h2', { className: 'dshw-modal-title', id: titleId }, props.title),
            props.subtitle ? h('p', { className: 'dshw-modal-sub' }, props.subtitle) : null),
          h('button', { type: 'button', className: 'dshw-modal-close', onClick: props.onClose, disabled: props.busy, 'aria-label': t.close }, h(Icon, { name: 'x' }))),
        h('div', { className: 'dshw-modal-body' }, props.children),
        props.footer ? h('div', { className: 'dshw-modal-foot' }, props.footer) : null))
  }

  function Field(props: any) {
    const errorId = props.id + '-error'
    const hintId = props.id + '-hint'
    const describedBy = [props.hint ? hintId : '', props.error ? errorId : ''].filter(Boolean).join(' ') || undefined
    const control = React.cloneElement(React.Children.only(props.children), {
      id: props.id,
      'aria-required': props.required ? 'true' : undefined,
      'aria-invalid': props.error ? 'true' : undefined,
      'aria-describedby': describedBy,
    })
    return h('div', { className: 'dshw-field' },
      h('label', { className: 'dshw-field-label', htmlFor: props.id },
        props.label,
        props.required ? h('span', { className: 'dshw-req', 'aria-hidden': 'true' }, '*') : null),
      control,
      props.hint ? h('div', { className: 'dshw-hint', id: hintId }, props.hint) : null,
      props.error ? h('div', { className: 'dshw-err', id: errorId, role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, props.error)) : null)
  }

  /** Native <select> for a branch list: the OS renders the popup, so it can never be misplaced. */
  function branchSelect(t: any, value: string, onChange: (v: string) => void, branchInfo: any, extraProps?: any) {
    const list: any[] = (branchInfo && branchInfo.branches) || []
    const known = list.some((b: any) => b.name === value)
    return h('select', Object.assign({ className: 'dshw-input', value: value, onChange: (e: any) => onChange(e.target.value) }, extraProps || {}),
      !value ? h('option', { value: '', disabled: true }, t.baseBranch) : null,
      value && !known ? h('option', { value }, value) : null,
      list.map((b: any) => h('option', { key: b.name, value: b.name }, b.name + (b.current ? '  ●' : ''))))
  }

  /** Shared: fetch branch info for a repo path. Throws so callers can offer retry. */
  async function fetchBranches(dir: string) {
    return await getJson('branches?path=' + encodeURIComponent(dir))
  }

  function useBranchInfo(repoPath: string, delay = 0) {
    const [state, setState] = React.useState({ status: 'idle', data: null, error: '' } as any)
    const [attempt, setAttempt] = React.useState(0)
    React.useEffect(() => {
      const dir = String(repoPath || '').trim()
      if (!dir) {
        setState({ status: 'idle', data: null, error: '' })
        return
      }
      let cancelled = false
      setState({ status: 'loading', data: null, error: '' })
      const timer = setTimeout(() => {
        fetchBranches(dir)
          .then((data: any) => {
            if (cancelled) return
            // A non-repository (or unborn repo) answers 200 with an empty list; treat it as a load failure
            // so the UI can offer the documented error + retry instead of an empty dropdown.
            const list = data && Array.isArray(data.branches) ? data.branches : []
            if (!list.length) setState({ status: 'error', data: null, error: 'empty' })
            else setState({ status: 'success', data, error: '' })
          })
          .catch((e: any) => { if (!cancelled) setState({ status: 'error', data: null, error: (e && e.message) || '' }) })
      }, delay)
      return () => {
        cancelled = true
        clearTimeout(timer)
      }
    }, [repoPath, delay, attempt])
    return Object.assign({}, state, { retry: () => setAttempt((n: number) => n + 1) })
  }

  /* ----------------------------------------------------------------------
   * Modals
   * -------------------------------------------------------------------- */

  function AddProjectModal(props: { t: any; onClose: () => void; onAdded: (project: any) => void }) {
    const t = props.t
    const remotes = appCtx && appCtx.remote
    const [repoPath, setRepoPath] = React.useState('')
    const [name, setName] = React.useState('')
    const [baseBranch, setBaseBranch] = React.useState('')
    const branches = useBranchInfo(repoPath, 150)
    const [picking, setPicking] = React.useState(false)
    const pickingRef = React.useRef(false)
    const [busy, setBusy] = React.useState(false)
    const [err, setErr] = React.useState('')
    const [fieldErrors, setFieldErrors] = React.useState({} as any)
    const submitRef = React.useRef(false)

    const browse = async () => {
      if (pickingRef.current) return
      setErr('')
      if (!remotes || !remotes.directoryPicker) {
        setErr(t.failed)
        return
      }
      pickingRef.current = true
      setPicking(true)
      try {
        const r = await remotes.directoryPicker.pick()
        if (r && r.ok && r.value) {
          setRepoPath(String(r.value))
          setBaseBranch('')
          setFieldErrors((prev: any) => Object.assign({}, prev, { repoPath: '', baseBranch: '' }))
        } else if (r && r.ok === false) {
          setErr(r.error && (r.error.message || r.error.code) ? String(r.error.message || r.error.code) : t.failed)
        }
      } catch (e: any) {
        setErr((e && e.message) || t.failed)
      } finally {
        pickingRef.current = false
        setPicking(false)
      }
    }
    const browseFromPointer = (e: any) => {
      if (e.button !== 0) return
      e.preventDefault()
      void browse()
    }

    React.useEffect(() => {
      setBaseBranch('')
      setFieldErrors((prev: any) => (prev.baseBranch ? Object.assign({}, prev, { baseBranch: '' }) : prev))
    }, [repoPath])

    React.useEffect(() => {
      const d = branches.data
      if (!d) return
      setBaseBranch(d.current || d.default || (d.branches && d.branches[0] && d.branches[0].name) || '')
      setFieldErrors((prev: any) => (prev.baseBranch ? Object.assign({}, prev, { baseBranch: '' }) : prev))
    }, [branches.data])

    const chooseBase = (value: string) => {
      setBaseBranch(value)
      setFieldErrors((prev: any) => (prev.baseBranch ? Object.assign({}, prev, { baseBranch: '' }) : prev))
    }

    const submit = async () => {
      if (submitRef.current || busy) return
      setErr('')
      const next: any = {}
      if (!repoPath.trim()) next.repoPath = t.requiredField
      if (!baseBranch.trim()) next.baseBranch = t.requiredField
      setFieldErrors(next)
      if (Object.keys(next).length) {
        const id = next.repoPath ? 'dshw-add-repo' : 'dshw-add-base'
        window.requestAnimationFrame(() => document.getElementById(id)?.focus())
        return
      }
      submitRef.current = true
      setBusy(true)
      try {
        const r = await post('projects/add', {
          repoPath: repoPath.trim(),
          name: name.trim() || undefined,
          baseBranch: baseBranch.trim(),
        })
        props.onAdded(r.project)
      } catch (e: any) {
        setErr((e && e.message) || t.failed)
      } finally {
        submitRef.current = false
        setBusy(false)
      }
    }

    let branchControl: any
    let branchHint: any = null
    let branchError: any = fieldErrors.baseBranch
    if (!repoPath.trim()) {
      branchControl = h('div', { className: 'dshw-select-loading' }, h('span', null, t.chooseDirFirst))
      branchHint = null
    } else if (branches.status === 'loading') {
      branchControl = h('div', { className: 'dshw-select-loading' }, h(Spinner), h('span', null, t.loadingBranches))
      branchHint = null
    } else if (branches.status === 'error') {
      branchControl = h('input', {
        className: 'dshw-input',
        id: 'dshw-add-base',
        value: baseBranch,
        placeholder: t.baseBranch,
        autoComplete: 'off',
        'aria-required': 'true',
        'aria-invalid': fieldErrors.baseBranch ? 'true' : 'false',
        onChange: (e: any) => chooseBase(e.target.value),
      })
      branchHint = h('span', null, t.loadBranchesFailed, ' ',
        h('button', { type: 'button', className: 'dshw-link-btn', onClick: branches.retry }, t.retry))
    } else {
      branchControl = branchSelect(t, baseBranch, chooseBase, branches.data, {
        id: 'dshw-add-base',
        'aria-required': 'true',
        'aria-invalid': fieldErrors.baseBranch ? 'true' : 'false',
      })
      branchHint = null
    }

    const cannotSubmit = busy || !repoPath.trim() || !baseBranch.trim() || branches.status === 'loading'

    const footer = [
      h(Btn, { key: 'cancel', onClick: props.onClose, disabled: busy }, t.cancel),
      h(Btn, {
        key: 'submit',
        variant: 'primary',
        onClick: submit,
        disabled: cannotSubmit,
        'aria-busy': busy ? 'true' : undefined,
      }, busy ? h(Spinner) : null, t.addProject),
    ]

    return h(Modal, {
      t,
      title: t.addProject,
      subtitle: t.addProjectSub,
      icon: 'folder',
      size: 'lg',
      busy,
      onClose: props.onClose,
      footer,
    },
      h('div', { className: 'dshw-field' },
        h('label', { className: 'dshw-field-label', htmlFor: 'dshw-add-repo' },
          t.repoPath,
          h('span', { className: 'dshw-req', 'aria-hidden': 'true' }, '*')),
        h('div', { className: 'dshw-field-inline' },
          h('input', {
            id: 'dshw-add-repo',
            className: cx('dshw-input', fieldErrors.repoPath && 'dshw-invalid'),
            value: repoPath,
            placeholder: t.repoPathHint,
            autoFocus: true,
            autoComplete: 'off',
            'aria-required': 'true',
            'aria-invalid': fieldErrors.repoPath ? 'true' : 'false',
            'aria-describedby': fieldErrors.repoPath ? 'dshw-add-repo-error' : undefined,
            onChange: (e: any) => {
              setRepoPath(e.target.value)
              setBaseBranch('')
              if (fieldErrors.repoPath) setFieldErrors({})
            },
          }),
          h(Btn, {
            icon: 'folder',
            disabled: picking,
            'aria-busy': picking ? 'true' : undefined,
            onPointerDown: browseFromPointer,
            onClick: (e: any) => { if (e.detail === 0) void browse() },
          }, picking ? t.pickingDirectory : t.browse)),
        fieldErrors.repoPath
          ? h('div', { className: 'dshw-err', id: 'dshw-add-repo-error', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, fieldErrors.repoPath))
          : null),
      h(Field, { id: 'dshw-add-name', label: t.projectName, hint: t.projectNameHint },
        h('input', {
          className: 'dshw-input',
          value: name,
          placeholder: baseName(repoPath) || t.projectName,
          autoComplete: 'off',
          onChange: (e: any) => setName(e.target.value),
        })),
      h('div', { className: 'dshw-field' },
        h('label', { className: 'dshw-field-label', htmlFor: 'dshw-add-base' },
          t.defaultBase,
          h('span', { className: 'dshw-req', 'aria-hidden': 'true' }, '*')),
        branchControl,
        branchHint ? h('div', { className: 'dshw-hint' }, branchHint) : null,
        branchError
          ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, branchError))
          : null),
      err ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err)) : null)
  }

  function PublishModal(props: { t: any; project: any; cfg: any; onClose: () => void; onRefresh: () => void; onError: (message: string) => void; onPublished: (task: any, project: any, warning?: string) => void }) {
    const t = props.t
    const remotes = appCtx && appCtx.remote
    const project = props.project
    const cfg = props.cfg || {}
    const branches = useBranchInfo(project.repoPath)
    const [baseBranch, setBaseBranch] = React.useState(project.baseBranch || '')
    const [branchName, setBranchName] = React.useState('')
    const [title, setTitle] = React.useState('')
    const [description, setDescription] = React.useState('')
    const [start, setStart] = React.useState(true)
    const [busy, setBusy] = React.useState(false)
    const [err, setErr] = React.useState('')
    const [fieldErrors, setFieldErrors] = React.useState({} as any)
    const advancedRef = React.useRef(null)
    const submitRef = React.useRef(false)

    React.useEffect(() => {
      const d = branches.data
      if (!d) return
      setBaseBranch((prev: string) => prev || d.current || d.default || (d.branches && d.branches[0] && d.branches[0].name) || '')
    }, [branches.data])

    const clearFieldError = (name: string) => {
      setFieldErrors((prev: any) => (prev[name] ? Object.assign({}, prev, { [name]: '' }) : prev))
    }

    const prefix = project.branchPrefix || cfg.branchPrefix || 'dsh-wt/'
    const dirName = project.dirName || cfg.dirName || '.dsh-worktrees'
    const pattern = prefix + '<id8>'
    const wtPattern = project.repoPath + '\\' + dirName + '\\<id8>'

    const validBranch = (value: string) => {
      if (!value) return true
      const ok = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(value)
      if (!ok || value.includes('..') || value.includes('@{') || value.endsWith('/') || value.endsWith('.') || value.endsWith('.lock')) return false
      return true
    }

    const submit = async () => {
      if (submitRef.current || busy) return
      setErr('')
      const next: any = {}
      if (!title.trim()) next.title = t.requiredField
      if (!description.trim()) next.description = t.requiredField
      if (!validBranch(branchName.trim())) next.branchName = t.branchInvalid
      setFieldErrors(next)
      if (Object.keys(next).length) {
        const firstId = next.title ? 'dshw-publish-title' : next.description ? 'dshw-publish-description' : 'dshw-publish-branch'
        if (next.branchName && advancedRef.current) (advancedRef.current as any).open = true
        window.requestAnimationFrame(() => document.getElementById(firstId)?.focus())
        return
      }
      submitRef.current = true
      setBusy(true)
      try {
        const r = await withTimeout(post('publish', {
          projectId: project.id,
          baseBranch: baseBranch || undefined,
          title: title.trim(),
          description,
          branchName: branchName.trim() || undefined,
          start,
        }), 30000, t.publishTimeout)
        const task = r.task
        if (start && remotes && remotes.session) {
          try {
            await withTimeout(bindSession(remotes, task, project.name), 60000, t.bindTimeout)
          } catch (e: any) {
            props.onPublished(task, project, (e && e.message) || t.failed)
            return
          }
        }
        props.onPublished(task, project)
      } catch (e: any) {
        if (e && (e as any).timeout) {
          // The request may have reached the server; reconcile the board instead of trapping the user.
          props.onRefresh()
          props.onError((e && e.message) || t.failed)
          props.onClose()
        } else {
          setErr((e && e.message) || t.failed)
          props.onRefresh()
        }
      } finally {
        submitRef.current = false
        setBusy(false)
      }
    }

    const branchHint = branches.status === 'loading'
      ? t.loadingBranches
      : branches.status === 'error'
        ? h('span', null, t.loadBranchesFailed, ' ', h('button', { type: 'button', className: 'dshw-link-btn', onClick: branches.retry }, t.retry))
        : null
    const branchControl = branches.data
      ? branchSelect(t, baseBranch, setBaseBranch, branches.data, { id: 'dshw-publish-base' })
      : h('input', { id: 'dshw-publish-base', className: 'dshw-input', value: baseBranch, onChange: (e: any) => setBaseBranch(e.target.value), placeholder: t.baseBranch })

    const footer = [
      h(Btn, { key: 'cancel', onClick: props.onClose, disabled: busy }, t.cancel),
      h(Btn, {
        key: 'submit',
        variant: 'primary',
        onClick: submit,
        disabled: busy,
        'aria-busy': busy ? 'true' : undefined,
      }, busy ? h(Spinner) : null, busy ? t.publishing : t.publish),
    ]

    return h(Modal, {
      t,
      title: t.publish,
      subtitle: project.name,
      icon: 'play',
      size: 'lg',
      busy,
      onClose: props.onClose,
      footer,
    },
      h('div', { className: 'dshw-form-rows' },
        h('div', { className: 'dshw-form-row' },
          h('label', null, t.projects),
          h('div', { className: 'dshw-readonly-box' },
            h('span', { className: 'dshw-folder-tile dshw-folder-tile--blue' }, h(Icon, { name: 'folder' })),
            h('span', { className: 'dshw-nowrap' }, project.name))),
        h('div', { className: 'dshw-form-row' },
          h('label', { htmlFor: 'dshw-publish-title' }, t.taskTitle, h('span', { className: 'dshw-req', 'aria-hidden': 'true' }, '*')),
          h('div', null,
            h('input', {
              id: 'dshw-publish-title',
              className: cx('dshw-input', fieldErrors.title && 'dshw-invalid'),
              value: title,
              placeholder: t.taskTitle,
              autoComplete: 'off',
              'aria-required': 'true',
              'aria-invalid': fieldErrors.title ? 'true' : 'false',
              'aria-describedby': fieldErrors.title ? 'dshw-publish-title-error' : undefined,
              onChange: (e: any) => { setTitle(e.target.value); clearFieldError('title') },
            }),
            fieldErrors.title
              ? h('div', { className: 'dshw-err', id: 'dshw-publish-title-error', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, fieldErrors.title))
              : null)),
        h('div', { className: 'dshw-form-row' },
          h('label', { htmlFor: 'dshw-publish-description' }, t.taskDescription, h('span', { className: 'dshw-req', 'aria-hidden': 'true' }, '*')),
          h('div', null,
            h('textarea', {
              id: 'dshw-publish-description',
              className: cx('dshw-input', fieldErrors.description && 'dshw-invalid'),
              value: description,
              rows: 4,
              placeholder: t.taskDescription,
              'aria-required': 'true',
              'aria-invalid': fieldErrors.description ? 'true' : 'false',
              'aria-describedby': fieldErrors.description ? 'dshw-publish-description-error' : undefined,
              onChange: (e: any) => { setDescription(e.target.value); clearFieldError('description') },
            }),
            fieldErrors.description
              ? h('div', { className: 'dshw-err', id: 'dshw-publish-description-error', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, fieldErrors.description))
              : null)),
        h('div', { className: 'dshw-form-row' },
          h('label', { htmlFor: 'dshw-publish-base' }, t.baseBranch),
          h('div', null,
            branchControl,
            branchHint ? h('div', { className: 'dshw-hint' }, branchHint) : null))),
      h('details', { className: 'dshw-advanced', ref: advancedRef },
        h('summary', null, h(Icon, { name: 'chevronDown' }), t.advanced),
        h('div', { className: 'dshw-advanced-body' },
          h('div', { className: 'dshw-field' },
            h('label', { className: 'dshw-field-label', htmlFor: 'dshw-publish-branch' }, t.branchName),
            h('input', {
              id: 'dshw-publish-branch',
              className: cx('dshw-input dshw-mono', fieldErrors.branchName && 'dshw-invalid'),
              value: branchName,
              placeholder: t.branchNameHint,
              autoComplete: 'off',
              spellCheck: false,
              'aria-invalid': fieldErrors.branchName ? 'true' : 'false',
              onChange: (e: any) => { setBranchName(e.target.value); clearFieldError('branchName') },
            }),
            fieldErrors.branchName
              ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, fieldErrors.branchName))
              : null),
          h('label', { className: 'dshw-check', style: { marginTop: '12px' } },
            h('input', { type: 'checkbox', checked: start, onChange: (e: any) => setStart(e.target.checked) }),
            h('span', { className: 'dshw-check-copy' }, t.startNow)))),
      h('div', { className: 'dshw-hint', style: { margin: '-3px 0 10px' } },
        t.branchRule.replace('{pattern}', pattern)),
      h('div', { className: 'dshw-preview' },
        h('span', { className: 'dshw-preview-label' }, t.preview),
        h('span', { className: 'dshw-preview-item' }, h('span', null, t.previewBranch), h('code', { className: 'dshw-mono' }, branchName.trim() || pattern)),
        h('span', { className: 'dshw-sep' }, '·'),
        h('span', { className: 'dshw-preview-item' }, h('span', null, t.previewDir), h('code', { className: 'dshw-mono' }, wtPattern))),
      err ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err)) : null)
  }

  /* ----------------------------------------------------------------------
   * Task detail
   * -------------------------------------------------------------------- */

  function readLive(live: any) {
    if (!live) return null
    return {
      model: jp(live.modelSelection),
      cwd: jp(live.workingDirectory),
      pressure: jp(live.contextPressure),
      tokens: jp(live.tokenUsage),
      stats: jp(live.sessionStats),
      todos: jp(live.todos) || [],
      turns: jp(live.turnOutline) || [],
      meta: jp(live.sessionListMetadata),
      perms: jp(live.permissions),
    }
  }

  function modelLabel(model: any): string | null {
    if (!model) return null
    const pick = model.next || model.current
    if (!pick) return null
    if (typeof pick === 'string') return pick
    if (pick.provider && pick.model) return pick.provider + '/' + pick.model
    if (pick.model) return String(pick.model)
    return null
  }

  function LiveCard(props: { t: any; task: any; running: boolean | null; pendingKind?: string | null; live?: any; history?: any }) {
    const t = props.t
    const live = readLive(props.live)
    const logRef = React.useRef(null)
    const stickRef = React.useRef(true)
    React.useEffect(() => {
      const el: any = logRef.current
      if (el && stickRef.current) el.scrollTop = el.scrollHeight
    }, [props.history, props.live, props.task.sessionId])
    const stateLabel = props.pendingKind ? pendingLabel(t, props.pendingKind) : props.running ? t.sessionRunning : t.sessionIdle
    const stateTone = props.pendingKind ? 'warn' : props.running ? 'success' : 'neutral'

    const head = h(CardHead, {
      icon: 'terminal',
      title: t.liveSession,
      right: h('span', { className: cx('dshw-live-state', !props.pendingKind && !props.running && 'dshw-live-state--idle', props.pendingKind && 'dshw-live-state--pending') },
        h(Dot, { tone: stateTone, pulse: !!props.pendingKind }),
        stateLabel),
    })

    if (!props.task.sessionId) {
      return h(Card, null, head,
        h('div', { className: 'dshw-live-empty' },
          h('strong', null, t.noSession),
          t.noSessionHint))
    }

    const model = modelLabel(live && live.model)
    const tokens = live && live.tokens
    const stats = live && live.stats
    const pressure = live && live.pressure
    const todos = (live && live.todos) || []
    const pct = pressure && pressure.contextWindow
      ? Math.max(0, Math.min(100, Math.round(((pressure.projectedTokens || 0) / pressure.contextWindow) * 100)))
      : null

    const fromHistory = Array.isArray(props.history) ? props.history : null
    const entries: TimelineEntry[] = fromHistory && fromHistory.length
      ? fromHistory
      : fallbackEntries((live && live.turns) || [])
    const modelText = model || entries.find((entry) => entry.model)?.model || '—'
    const historySteps = new Set(entries.map((entry) => entry.stepKey).filter(Boolean)).size
    const statsText = stats
      ? String(t.liveStats).replace('{turns}', String(stats.turns || 0)).replace('{steps}', String(stats.steps || 0))
      : historySteps
        ? String(t.liveStepsOnly).replace('{steps}', String(historySteps))
        : '—'
    const toolTag = (name?: string) => {
      if (!name) return t.toolGeneric
      if (name === 'pwsh' || name === 'shell' || name === 'terminal') return t.toolTerminal
      if (name === 'read') return t.toolRead
      if (name === 'write' || name === 'edit' || name === 'multi_edit') return t.toolEdit
      if (name === 'glob' || name === 'grep' || name === 'search') return t.toolFind
      if (name === 'working_directory') return t.toolCd
      if (name === 'todo_write' || name === 'todowrite') return t.toolTodos
      if (name === 'ask_user_question') return t.toolQuestion
      return name
    }
    const durationLabel = (ms: number | undefined) => {
      const duration = fmtDuration(ms)
      return duration ? String(t.duration).replace('{s}', duration) : ''
    }
    const statusLabel = (status?: string) => (status === 'error' ? t.stepFailed : status === 'running' ? t.stepRunning : t.stepDone)

    const tokenText = tokens
      ? [fmtK(tokens.uncachedInputTokens) ? fmtK(tokens.uncachedInputTokens) + ' ' + t.liveTokensIn : '', fmtK(tokens.outputTokens) ? fmtK(tokens.outputTokens) + ' ' + t.liveTokensOut : ''].filter(Boolean).join(' · ')
      : ''

    return h(Card, null, head,
      h('div', { className: 'dshw-console' },
        h('div', { className: 'dshw-console-bar' },
          h(Dot, { tone: stateTone, pulse: !!props.pendingKind }),
          h('span', null, modelText),
          h('span', { className: 'dshw-sep' }, '/'),
          h('span', null, statsText),
          h('span', { className: 'dshw-grow' }),
          tokenText ? h('span', { className: 'dshw-tok' }, tokenText) : null),
        h('div', { className: 'dshw-console-grid' },
          h('div', {
            className: 'dshw-console-log',
            ref: logRef,
            onScroll: (e: any) => {
              const el = e.currentTarget
              stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 32
            },
          },
            entries.length
              ? entries.map((entry, index) => {
                const tag = entry.kind === 'think' ? t.roleThinking : entry.kind === 'user' ? t.roleUser : entry.kind === 'agent' ? t.roleAssistant : toolTag(entry.tool)
                const title = entry.kind === 'think' ? (durationLabel(entry.durationMs) || firstLine(entry.detail)) : (entry.title || '—')
                const status = entry.kind === 'tool' ? statusLabel(entry.status) : ''
                const statusClass = entry.status === 'error' ? 'dshw-step-status--error' : entry.status === 'running' ? '' : 'dshw-step-status--ok'
                return h('details', { key: entry.id || index, className: 'dshw-step dshw-step--' + entry.kind },
                  h('summary', { className: 'dshw-step-head' },
                    h('span', { className: 'dshw-step-gutter' }, pad2(index + 1)),
                    h('span', { className: 'dshw-step-tag' }, tag),
                    h('span', { className: 'dshw-step-title', title: entry.detail ? clipText(entry.detail, 500) : title }, title),
                    entry.meta ? h('span', { className: 'dshw-step-meta' }, entry.meta) : null,
                    status ? h('span', { className: 'dshw-step-status ' + statusClass }, status) : null,
                    h(Icon, { name: 'chevronDown', className: 'dshw-step-chevron' })),
                  h('div', { className: 'dshw-step-body' }, entry.detail || '—'))
              })
              : h('div', { className: 'dshw-step' },
                h('div', { className: 'dshw-step-head' },
                  h('span', { className: 'dshw-step-gutter' }, '—'),
                  h('span', { className: 'dshw-step-title' }, t.noTurns)))),
          h('div', { className: 'dshw-console-side' },
            h('div', { className: 'dshw-side-block' },
              h('div', { className: 'dshw-side-title' }, t.liveTodos),
              todos.length
                ? h('ul', { className: 'dshw-todo-mini' }, todos.slice(0, 10).map((todo: any, i: number) => {
                  const done = todo.status === 'completed'
                  return h('li', { key: i, className: done ? 'dshw-done' : '' },
                    h(Icon, { name: done ? 'checkCircle' : 'circle' }),
                    h('span', null, String(todo.content)))
                }))
                : h('div', { className: 'dshw-hint', style: { color: 'var(--dshw-term-muted)' } }, '—')),
            h('div', { className: 'dshw-side-block' },
              h('div', { className: 'dshw-side-title' }, t.livePressure),
              h('div', { className: 'dshw-meter-row' },
                h('span', null, pct === null ? '—' : pct + '%'),
                h('span', null, tokens && fmtK(tokens.cacheReadTokens) ? fmtK(tokens.cacheReadTokens) + ' ' + t.liveTokensCache : '')),
              h('div', { className: 'dshw-meter' }, h('i', { style: { '--v': (pct === null ? 0 : pct) + '%' } })))))))
  }

  function TaskDetail(props: any) {
    const t = props.t
    const v = props.view
    const task = v.task
    const snap = v.snapshot
    const project = props.project
    const [busy, setBusy] = React.useState('')
    const [err, setErr] = React.useState('')
    const [mergeOpen, setMergeOpen] = React.useState(false)
    const [cleanupOpen, setCleanupOpen] = React.useState(false)
    const [deleteOpen, setDeleteOpen] = React.useState(false)
    const [force, setForce] = React.useState(false)
    const [delBranch, setDelBranch] = React.useState(false)
    const actionRef = React.useRef(false)

    const meta = statusMeta(t, snap.status, props.pendingKind)
    const liveData = readLive(props.live)
    const modelText = modelLabel(liveData && liveData.model) || '—'
    const liveCwd = liveData && liveData.cwd ? String(liveData.cwd) : ''
    const cwdOff = !!liveCwd && !!task.worktreePath && liveCwd.toLowerCase() !== String(task.worktreePath).toLowerCase()
    const cleaned = snap.status === 'cleaned'
    const merged = snap.status === 'merged'
    const broken = snap.status === 'broken'
    const checkedOut = snap.status === 'reviewing'
    const dirty = snap.worktree.dirtyCount
    const repoDirty = snap.repo.dirtyCount
    const health = props.health
    const healthActive = !!health && !props.running
    const ahead = snap.worktree.ahead
    const branch = task.branch || snap.worktree.branch || ''

    const act = async (key: string, success: string, fn: () => Promise<any>): Promise<boolean> => {
      if (actionRef.current || busy) return false
      actionRef.current = true
      setBusy(key)
      setErr('')
      try {
        await fn()
        await props.onChanged()
        props.notify(success)
        return true
      } catch (e: any) {
        setErr((e && e.message) || t.failed)
        return false
      } finally {
        actionRef.current = false
        setBusy('')
      }
    }
    const actPost = (key: string, path: string, body: any, success: string) =>
      act(key, success, () => post(path, Object.assign({ id: task.id }, body)))
    const busyLabel = (key: string, label: string, working: string) => (busy === key ? working : label)

    const primary = cleaned
      ? h(Btn, { variant: 'primary', size: 'lg', icon: 'trash', disabled: true }, t.cleaned)
      : task.sessionId
        ? h(Btn, {
          variant: 'primary',
          size: 'lg',
          icon: 'external',
          disabled: !props.onOpenSession,
          onClick: () => {
            const opened = props.onOpenSession && props.onOpenSession()
            if (opened === false) props.notify(t.openSessionFailed, 'error')
          },
        }, t.openSessionBtn)
        : h(Btn, {
          variant: 'primary',
          size: 'lg',
          icon: busy === 'session' ? undefined : 'message',
          disabled: !props.onCreateSession || busy !== '',
          onClick: () => {
            if (!props.onCreateSession) return
            void act('session', t.sessionCreated, () => Promise.resolve(props.onCreateSession()))
          },
        }, busy === 'session' ? h(Spinner) : null, busyLabel('session', t.createSession, t.creatingSession))

    const lastActivity = task.sessionId && task.updatedAt ? t.lastActivity + ' · ' + relTime(task.updatedAt, t) : ''

    const pendingNode = props.pendingKind
      ? h(Banner, {
        tone: 'warn',
        icon: 'clock',
        title: pendingLabel(t, props.pendingKind),
        actions: task.sessionId
          ? h(Btn, { size: 'sm', onClick: () => props.onOpenSession && props.onOpenSession() }, t.handlePending)
          : null,
      }, t.pendingHint)
      : null

    const errorNode = snap.error
      ? h(Banner, {
        tone: 'error',
        icon: 'alert',
        title: t.statusSyncFailed,
        actions: h(Btn, { size: 'sm', icon: 'refresh', onClick: () => void props.onChanged() }, t.retry),
      }, snap.error)
      : null

    const healthNode = healthActive
      ? h(Banner, {
        tone: health.kind === 'error' ? 'error' : 'warn',
        icon: 'alert',
        title: health.kind === 'error' ? t.sessionError : t.sessionInterrupted,
        actions: task.sessionId && props.onOpenSession
          ? h(Btn, { size: 'sm', onClick: () => props.onOpenSession && props.onOpenSession() }, t.handlePending)
          : null,
      }, health.message || (health.kind === 'error' ? t.sessionErrorHint : t.sessionInterruptedHint))
      : null

    const disabled = cleaned || merged
    const checkoutDisabled = disabled || checkedOut || broken || dirty > 0 || repoDirty > 0 || !snap.worktree.exists
    // "Switch back" is only meaningful while the main repo is away from the recorded branch.
    const onOriginalBranch = !!task.originalBranch && snap.repo.currentBranch === task.originalBranch
    const backDisabled = !task.originalBranch || cleaned || merged || onOriginalBranch
    const mergeDisabled = disabled || dirty > 0 || ahead === 0 || !snap.worktree.exists
    const checkoutTitle = checkedOut
      ? t.onBranch
      : dirty > 0
        ? t.acceptanceHintDirty.replace('{n}', String(dirty))
        : repoDirty > 0
          ? t.acceptanceHintRepoDirty.replace('{n}', String(repoDirty))
          : broken
            ? t.acceptanceHintBroken
            : t.checkout
    const mergeTitle = ahead === 0 ? t.acceptanceHintNoAhead : dirty > 0 ? t.acceptanceHintDirty.replace('{n}', String(dirty)) : t.merge

    let acceptanceHint = t.acceptanceHintDefault
    if (cleaned) acceptanceHint = t.acceptanceHintClean
    else if (merged) acceptanceHint = t.acceptanceHintMerged
    else if (broken) acceptanceHint = t.acceptanceHintBroken
    else if (dirty > 0) acceptanceHint = t.acceptanceHintDirty.replace('{n}', String(dirty))
    else if (repoDirty > 0) acceptanceHint = t.acceptanceHintRepoDirty.replace('{n}', String(repoDirty))
    else if (ahead === 0) acceptanceHint = t.acceptanceHintNoAhead
    else if (checkedOut) acceptanceHint = t.acceptanceHintCheckedOut

    const worktreeState = cleaned
      ? { label: t.cleaned, tone: 'neutral' }
      : broken
        ? { label: t.broken, tone: 'error' }
        : merged
          ? { label: t.mergedFlag, tone: 'success' }
          : snap.worktree.exists
            ? { label: t.clean, tone: 'success' }
            : { label: t.branchMissing, tone: 'error' }

    const mergeModal = mergeOpen
      ? h(Modal, {
        t,
        title: String(t.mergeTitle).replace('{base}', task.baseBranch),
        subtitle: t.mergeSub,
        icon: 'merge',
        size: 'sm',
        busy: busy === 'merge',
        onClose: () => { if (busy !== 'merge') setMergeOpen(false) },
        footer: [
          h(Btn, { key: 'c', onClick: () => setMergeOpen(false), disabled: busy === 'merge', 'data-autofocus': true }, t.cancel),
          h(Btn, {
            key: 'ok',
            variant: 'primary',
            disabled: busy === 'merge' || dirty > 0,
            onClick: () => {
              void act('merge', String(t.mergeDone).replace('{base}', task.baseBranch), () => post('task/merge', { id: task.id }))
                .then((ok) => { if (ok) setMergeOpen(false) })
            },
          }, busy === 'merge' ? h(Spinner) : null, busy === 'merge' ? t.merging : t.mergeConfirm),
        ],
      },
        h('div', { className: 'dshw-info-table' },
          h(KV, { label: t.branchLabel }, h('span', { className: 'dshw-mono' }, branch)),
          h(KV, { label: t.baseBranch }, h('span', { className: 'dshw-mono' }, task.baseBranch)),
          h(KV, { label: t.commits }, String(ahead)),
          h(KV, { label: t.uncommitted }, dirty > 0 ? h(Chip, { tone: 'warn', small: true }, dirty + ' ' + t.changesUnit) : h('span', { className: 'dshw-hint', style: { margin: 0 } }, t.clean))),
        dirty > 0
          ? h(Banner, { tone: 'warn', icon: 'alert', title: t.mergeDirtyTitle }, t.mergeDirtyHint)
          : h(Banner, { tone: 'info', icon: 'info' }, t.mergeCleanHint),
        err ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err)) : null)
      : null

    const cleanupModal = cleanupOpen
      ? h(Modal, {
        t,
        title: t.cleanupTitle,
        subtitle: t.cleanupSub,
        icon: 'trash',
        tone: 'danger',
        size: 'sm',
        busy: busy === 'cleanup',
        onClose: () => { if (busy !== 'cleanup') setCleanupOpen(false) },
        footer: [
          h(Btn, { key: 'c', onClick: () => setCleanupOpen(false), disabled: busy === 'cleanup', 'data-autofocus': true }, t.cancel),
          h(Btn, {
            key: 'ok',
            variant: 'danger',
            disabled: busy === 'cleanup',
            onClick: () => {
              void act('cleanup', delBranch ? t.cleanupDoneBranch : t.cleanupDone, () => post('task/cleanup', { id: task.id, force, deleteBranch: delBranch }))
                .then((ok) => { if (ok) setCleanupOpen(false) })
            },
          }, busy === 'cleanup' ? h(Spinner) : null, busy === 'cleanup' ? t.cleaning : t.cleanup),
        ],
      },
        h('div', { className: 'dshw-danger-list' },
          h('div', { className: 'dshw-danger-title' }, h(Icon, { name: 'alert' }), t.cleanupDangerTitle),
          h('div', { className: 'dshw-danger-item' }, h(Icon, { name: 'folder' }), h('span', null, task.worktreePath)),
          h('div', { className: 'dshw-danger-item' }, h(Icon, { name: 'file' }), h('span', null,
            dirty > 0 ? String(t.cleanupDirtyGone).replace('{n}', String(dirty)) : t.cleanupCleanNote))),
        h('label', { className: 'dshw-check' },
          h('input', {
            type: 'checkbox',
            checked: force,
            disabled: dirty === 0,
            'aria-label': t.force,
            'aria-describedby': 'dshw-cleanup-force-hint',
            onChange: (e: any) => setForce(e.target.checked),
          }),
          h('span', { className: 'dshw-check-copy' }, t.force, h('small', { id: 'dshw-cleanup-force-hint' }, t.cleanupForceHint))),
        h('label', { className: 'dshw-check' },
          h('input', {
            type: 'checkbox',
            checked: delBranch,
            'aria-label': t.deleteBranch,
            'aria-describedby': 'dshw-cleanup-branch-hint',
            onChange: (e: any) => setDelBranch(e.target.checked),
          }),
          h('span', { className: 'dshw-check-copy' }, t.deleteBranch, h('small', { id: 'dshw-cleanup-branch-hint' }, t.cleanupBranchHint))),
        err ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err)) : null)
      : null

    const deleteModal = deleteOpen
      ? h(Modal, {
        t,
        title: t.deleteTaskTitle,
        subtitle: task.title,
        icon: 'trash',
        tone: 'danger',
        size: 'sm',
        busy: busy === 'delete',
        onClose: () => { if (busy !== 'delete') setDeleteOpen(false) },
        footer: [
          h(Btn, { key: 'c', onClick: () => setDeleteOpen(false), disabled: busy === 'delete', 'data-autofocus': true }, t.cancel),
          h(Btn, {
            key: 'ok',
            variant: 'danger',
            disabled: busy === 'delete',
            onClick: () => {
              void act('delete', t.recordDeleted, () => post('task/delete', { id: task.id }))
                .then((ok) => { if (ok) setDeleteOpen(false) })
            },
          }, busy === 'delete' ? h(Spinner) : null, busy === 'delete' ? t.deleting : t.deleteRecordConfirm),
        ],
      },
        h(Banner, { tone: 'error', icon: 'alert', title: t.deleteTaskWarning }, t.deleteTaskWarningHint),
        h('div', { className: 'dshw-info-table' },
          h(KV, { label: t.branchLabel }, h('span', { className: 'dshw-mono' }, branch)),
          cleaned
            ? null
            : h(KV, { label: t.worktree }, h('span', { className: 'dshw-mono' }, task.worktreePath)),
          h(KV, { label: t.status },
            h('span', { className: 'dshw-inline' },
              h(Chip, { tone: meta.tone, small: true }, meta.label),
              meta.note ? h(Chip, { tone: 'warn', small: true }, meta.note) : null))),
        h('div', { className: 'dshw-hint' }, t.deleteTaskHint),
        err ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err)) : null)
      : null

    return h('div', { className: 'dshw-detail-inner' },
      h('article', { className: 'dshw-card dshw-hero' },
        h('div', { className: 'dshw-hero-top' },
          h('div', { className: 'dshw-hero-copy' },
            h('div', { className: 'dshw-hero-crumb' },
              h(Icon, { name: 'folder' }),
              h('span', null, project ? project.name : task.repoPath),
              h('span', null, '/'),
              h('span', { className: 'dshw-mono' }, branch)),
            h('h1', null, task.title),
            h('p', { className: 'dshw-hero-desc' }, task.description || '—'),
            h('div', { className: 'dshw-hero-meta' },
              h(Chip, { tone: meta.tone }, meta.label),
              meta.note ? h(Chip, { tone: 'warn' }, meta.note) : null,
              healthActive
                ? h(Chip, { tone: health.kind === 'error' ? 'error' : 'warn' }, health.kind === 'error' ? t.sessionError : t.sessionInterrupted)
                : null,
              h('span', { className: 'dshw-meta-pill' }, h(Icon, { name: 'branch' }), h('span', { className: 'dshw-mono' }, branch)),
              h('span', { className: 'dshw-meta-pill' }, h(Icon, { name: 'arrowUp' }), ahead + ' ' + t.commitsAhead),
              dirty > 0
                ? h('span', { className: 'dshw-meta-pill dshw-meta-pill--warn' }, h(Icon, { name: 'alert' }), dirty + ' ' + t.dirty)
                : null)),
          h('div', { className: 'dshw-hero-action' },
            primary,
            h('span', { className: 'dshw-hint' }, lastActivity))),
        err ? h('div', { className: 'dshw-err', role: 'alert', style: { marginTop: '12px' } }, h(Icon, { name: 'alert' }), h('span', null, err)) : null),
      pendingNode,
      healthNode,
      errorNode,
      h(LiveCard, { t, task, running: props.running, pendingKind: props.pendingKind, live: props.live, history: props.history }),
      h(Card, null,
        h(CardHead, {
          icon: 'message',
          title: t.sessionInfo,
          right: task.sessionId ? h(Chip, { tone: meta.tone, small: true }, meta.label) : h(Chip, { tone: 'neutral', small: true }, t.noSession),
        }),
        task.sessionId
          ? h('div', { className: 'dshw-kv' }, [
            h(KV, { key: 'sid', label: t.sessionId },
              h('span', { className: 'dshw-mono' }, task.sessionId),
              h(CopyBtn, { text: task.sessionId, label: t.copySessionId, t, notify: props.notify })),
            h(KV, { key: 'st', label: t.status },
              h('span', { className: 'dshw-inline' },
                h(Dot, { tone: props.pendingKind ? 'warn' : props.running ? 'brand' : 'neutral', pulse: !!props.pendingKind }),
                h('span', null, props.pendingKind ? pendingLabel(t, props.pendingKind) : props.running ? t.sessionRunning : t.sessionIdle))),
            h(KV, { key: 'model', label: t.liveModel }, h('span', null, modelText)),
            h(KV, { key: 'cwd', label: t.liveCwd },
              h('span', { className: 'dshw-mono' }, liveCwd || task.worktreePath),
              cwdOff ? h(Chip, { tone: 'warn', small: true }, t.liveCwdOff) : null,
              h(CopyBtn, { text: liveCwd || task.worktreePath, label: t.copyWorktree, t, notify: props.notify })),
            h(KV, { key: 'act', label: t.lastActivity }, h('span', null, relTime(task.updatedAt, t))),
          ])
          : h('div', { className: 'dshw-hint', style: { margin: 0 } }, t.noSessionHint)),
      h(Card, null,
        h(CardHead, {
          icon: 'checkCircle',
          title: t.acceptance,
          right: h('span', { className: 'dshw-hint', style: { margin: 0 } }, t.mainRepo + ' · ' + task.baseBranch),
        }),
        h('div', { className: 'dshw-action-grid' },
          h(Btn, {
            icon: 'branch',
            disabled: checkoutDisabled || busy !== '',
            title: checkoutTitle,
            onClick: () => void actPost('checkout', 'task/checkout', {}, t.checkout),
          }, busy === 'checkout' ? h(Spinner) : null, checkedOut ? t.onBranch : t.checkout),
          h(Btn, {
            icon: 'arrowLeft',
            disabled: backDisabled || busy !== '',
            onClick: () => void actPost('back', 'task/back', {}, t.back),
          }, busy === 'back' ? h(Spinner) : null, t.back),
          h(Btn, {
            icon: 'merge',
            disabled: mergeDisabled || busy !== '',
            title: mergeTitle,
            onClick: () => setMergeOpen(true),
          }, t.merge)),
        h('div', { className: 'dshw-hint' }, h(Icon, { name: 'info' }), acceptanceHint)),
      h(Card, null,
        h(CardHead, {
          icon: 'branch',
          title: t.worktree + ' / ' + t.mainRepo,
          right: h(Chip, { tone: worktreeState.tone, small: true }, worktreeState.label),
        }),
        h('div', { className: 'dshw-git-section' },
          h('div', { className: 'dshw-section-label' }, h(Icon, { name: 'folder' }), t.worktree),
          h('div', { className: 'dshw-kv' },
            h(KV, { label: t.path },
              h('span', { className: 'dshw-mono' }, task.worktreePath),
              h(CopyBtn, { text: task.worktreePath, label: t.copyWorktree, t, notify: props.notify })),
            cleaned
              ? h('div', { className: 'dshw-hint', style: { margin: 0 } }, t.worktreeRemovedHint)
              : [
                h(KV, { key: 'wt-branch', label: t.currentBranch },
                  h('span', { className: 'dshw-mono' }, snap.worktree.branch || '—'),
                  h(CopyBtn, { text: snap.worktree.branch || '', label: t.copyBranch, t, notify: props.notify })),
                h(KV, { key: 'wt-ahead', label: t.commits }, ahead + ' ' + t.commitsAhead),
                h(KV, { key: 'wt-dirty', label: t.uncommitted }, dirty > 0 ? h(Chip, { tone: 'warn', small: true }, dirty + ' ' + t.changesUnit) : h('span', { className: 'dshw-hint', style: { margin: 0 } }, t.clean)),
              ])),
        h('div', { className: 'dshw-git-section' },
          h('div', { className: 'dshw-section-label' }, h(Icon, { name: 'database' }), t.mainRepo),
          h('div', { className: 'dshw-kv' },
            h(KV, { label: t.repoPath },
              h('span', { className: 'dshw-mono' }, task.repoPath),
              h(CopyBtn, { text: task.repoPath, label: t.copyRepoPath, t, notify: props.notify })),
            h(KV, { label: t.currentBranch }, h('span', { className: 'dshw-mono' }, snap.repo.currentBranch || '—')),
            task.originalBranch ? h(KV, { label: t.originalBranch }, h('span', { className: 'dshw-mono' }, task.originalBranch)) : null,
            snap.repo.dirtyCount > 0
              ? h(KV, { label: t.uncommitted }, h(Chip, { tone: 'warn', small: true }, snap.repo.dirtyCount + ' ' + t.changesUnit))
              : null))),
      h(Card, { danger: true },
        h(CardHead, { icon: 'alert', title: t.dangerZone }),
        h('p', { className: 'dshw-card-sub' }, t.cleanupHint),
        h('div', { className: 'dshw-action-grid' },
          h(Btn, {
            variant: 'danger',
            icon: 'trash',
            disabled: cleaned || busy !== '',
            onClick: () => setCleanupOpen(true),
          }, cleaned ? t.cleaned : t.cleanup),
          h(Btn, {
            variant: 'danger',
            icon: 'xCircle',
            disabled: busy !== '',
            onClick: () => setDeleteOpen(true),
          }, t.deleteRecord))),
      mergeModal,
      cleanupModal,
      deleteModal)
  }

  /* ----------------------------------------------------------------------
   * Project detail
   * -------------------------------------------------------------------- */

  function ProjectDetail(props: any) {
    const t = props.t
    const v = props.view
    const project = v.project
    const cfg = props.cfg || {}
    const [name, setName] = React.useState(project.name)
    const [baseBranch, setBaseBranch] = React.useState(project.baseBranch || '')
    const [dirName, setDirName] = React.useState(project.dirName || '')
    const [branchPrefix, setBranchPrefix] = React.useState(project.branchPrefix || '')
    const branches = useBranchInfo(project.repoPath)
    const [deleteOpen, setDeleteOpen] = React.useState(false)
    const [withTasks, setWithTasks] = React.useState(false)
    const [busy, setBusy] = React.useState('')
    const [msg, setMsg] = React.useState('')
    const [err, setErr] = React.useState('')
    const [nameError, setNameError] = React.useState('')
    const saveTimer = React.useRef(null)
    const actionRef = React.useRef(false)

    const counts = {
      total: v.stats.tasks,
      active: (v.stats.byStatus.developing || 0) + (v.stats.byStatus.reviewing || 0),
      review: v.stats.byStatus.review || 0,
      merged: v.stats.byStatus.merged || 0,
    }
    const pendingTasks = v.tasks.filter((item: any) => item.task.sessionId && props.pendingMap && props.pendingMap[item.task.sessionId])
    const firstPending = pendingTasks[0]

    const act = async (label: string, fn: () => Promise<any>) => {
      if (actionRef.current || busy) return
      actionRef.current = true
      setBusy(label)
      setErr('')
      setMsg('')
      try {
        await fn()
        await props.onChanged()
      } catch (e: any) {
        setErr((e && e.message) || t.failed)
      } finally {
        actionRef.current = false
        setBusy('')
      }
    }

    const save = () => {
      if (busy) return
      if (!name.trim()) {
        setNameError(t.requiredField)
        window.requestAnimationFrame(() => document.getElementById('dshw-project-name')?.focus())
        return
      }
      setNameError('')
      void act('save', async () => {
        await post('projects/update', {
          id: project.id,
          name: name.trim(),
          baseBranch,
          dirName,
          branchPrefix,
        })
        setMsg(t.saved)
        if (saveTimer.current) window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(() => setMsg(''), 3200)
      })
    }

    React.useEffect(() => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }, [])

    const remove = () => {
      void act('del', async () => {
        await post('projects/delete', { id: project.id, withTasks })
        setDeleteOpen(false)
        props.onDeleted()
        props.notify(String(t.projectDeleted).replace('{name}', project.name))
      })
    }

    const branchHint = branches.status === 'loading'
      ? t.loadingBranches
      : branches.status === 'error'
        ? h('span', null, t.loadBranchesFailed, ' ',
          h('button', { type: 'button', className: 'dshw-link-btn', onClick: branches.retry }, t.retry))
        : null
    const branchControl = branches.data
      ? branchSelect(t, baseBranch, setBaseBranch, branches.data, { id: 'dshw-project-base' })
      : h('input', { id: 'dshw-project-base', className: 'dshw-input', value: baseBranch, onChange: (e: any) => setBaseBranch(e.target.value), placeholder: t.baseBranch })

    const deleteModal = deleteOpen
      ? h(Modal, {
        t,
        title: t.deleteProjectTitle,
        subtitle: project.name,
        icon: 'trash',
        tone: 'danger',
        size: 'sm',
        busy: busy === 'del',
        onClose: () => { if (busy !== 'del') setDeleteOpen(false) },
        footer: [
          h(Btn, { key: 'c', onClick: () => setDeleteOpen(false), disabled: busy === 'del', 'data-autofocus': true }, t.cancel),
          h(Btn, {
            key: 'ok',
            variant: 'danger',
            disabled: busy === 'del' || (counts.total > 0 && !withTasks),
            onClick: remove,
          }, busy === 'del' ? h(Spinner) : null, busy === 'del' ? t.deleting : t.deleteProjectConfirm),
        ],
      },
        counts.total > 0
          ? h(Banner, { tone: 'warn', icon: 'alert', title: String(t.deleteProjectWarning).replace('{n}', String(counts.total)) }, t.deleteProjectWarningHint)
          : h(Banner, { tone: 'info', icon: 'info' }, t.deleteProjectWarningHint),
        h('div', { className: 'dshw-info-table' },
          h(KV, { label: t.repoPath }, h('span', { className: 'dshw-mono' }, project.repoPath)),
          h(KV, { label: t.deleteProjectRecords }, counts.total + ' ' + t.taskUnit),
          h(KV, { label: t.deleteProjectBase }, h('span', { className: 'dshw-mono' }, project.baseBranch))),
        counts.total > 0
          ? h('label', { className: 'dshw-check' },
            h('input', { type: 'checkbox', checked: withTasks, onChange: (e: any) => setWithTasks(e.target.checked) }),
            h('span', { className: 'dshw-check-copy' }, t.withTasks))
          : null,
        err ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err)) : null)
      : null

    return h('div', { className: 'dshw-detail-inner' },
      h('div', { className: 'dshw-page-head' },
        h('div', { className: 'dshw-page-icon dshw-page-icon--folder' }, h(Icon, { name: 'folder' })),
        h('div', { className: 'dshw-page-head-copy' },
          h('h1', null, project.name),
          h('div', { className: 'dshw-page-sub' },
            h('span', { className: 'dshw-mono' }, project.repoPath),
            h(CopyBtn, { text: project.repoPath, label: t.copyRepoPath, t, notify: props.notify }),
            h('span', { className: 'dshw-sep' }, '·'),
            h('span', null, counts.total + ' ' + t.taskUnit))),
        h('div', { className: 'dshw-page-actions' },
          h(Btn, { icon: 'play', onClick: () => props.onPublish(project) }, t.publish),
          h('details', { className: 'dshw-menu' },
            h('summary', { className: 'dshw-icon-btn', 'aria-label': t.operations, title: t.operations }, h(Icon, { name: 'more' })),
            h('div', { className: 'dshw-menu-pop' },
              h(MenuItem, { icon: 'plus', onClick: () => props.onPublish(project) }, t.publish),
              h(MenuItem, { icon: 'copy', onClick: () => { void copyText(project.repoPath).then((ok) => props.notify(ok ? t.copied : t.copyFailed, ok ? 'ok' : 'error')) } }, t.copyRepoPath),
              h('div', { className: 'dshw-menu-sep' }),
              h(MenuItem, { icon: 'trash', danger: true, onClick: () => setDeleteOpen(true) }, t.deleteProject))))),
      h(Card, null,
        h(CardHead, { icon: 'grid', title: t.overview, right: h('span', { className: 'dshw-hint', style: { margin: 0 } }, t.overviewHint) }),
        h('div', { className: 'dshw-stats' },
          h(Stat, { label: t.totalTasks, value: counts.total, icon: 'file', tone: 'blue' }),
          h(Stat, { label: t.activeTasks, value: counts.active, icon: 'terminal', tone: 'green' }),
          h(Stat, { label: t.reviewTasks, value: counts.review, icon: 'clock', tone: 'amber' }),
          h(Stat, { label: t.mergedTasks, value: counts.merged, icon: 'branch', tone: 'purple' })),
        pendingTasks.length
          ? h('div', { className: 'dshw-attention' },
            h(Icon, { name: 'clock' }),
            h('span', null, String(t.attention).replace('{n}', String(pendingTasks.length))),
            firstPending
              ? h('button', { type: 'button', className: 'dshw-link-btn', onClick: () => props.onSelectTask(firstPending.task.id, project.id) }, t.view)
              : null)
          : null,
        h('div', { className: 'dshw-kv' },
          h(KV, { label: t.repoPath },
            h('span', { className: 'dshw-mono' }, project.repoPath),
            h(CopyBtn, { text: project.repoPath, label: t.copyRepoPath, t, notify: props.notify })),
          h(KV, { label: t.defaultBase }, h('span', { className: 'dshw-meta-pill', style: { height: '22px' } }, h(Icon, { name: 'branch' }), h('span', { className: 'dshw-mono' }, project.baseBranch))),
          h(KV, { label: t.branchPrefix }, h('code', null, project.branchPrefix || cfg.branchPrefix || 'dsh-wt/')),
          h(KV, { label: t.worktreeDirName }, h('code', null, project.dirName || cfg.dirName || '.dsh-worktrees')))),
      h(Card, null,
        h(CardHead, { icon: 'sliders', title: t.projectSettings }),
        h('p', { className: 'dshw-card-sub' }, t.projectSettingsHint),
        h('form', { onSubmit: (e: any) => { e.preventDefault(); save() } },
          h('div', { className: 'dshw-form-rows' },
            h('div', { className: 'dshw-form-row' },
              h('label', { htmlFor: 'dshw-project-name' }, t.projectName),
              h('div', null,
                h('input', {
                  id: 'dshw-project-name',
                  className: cx('dshw-input', nameError && 'dshw-invalid'),
                  value: name,
                  'aria-invalid': nameError ? 'true' : 'false',
                  onChange: (e: any) => { setName(e.target.value); setNameError('') },
                }),
                h('div', { className: 'dshw-hint' }, t.projectNameHint),
                nameError ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, nameError)) : null)),
            h('div', { className: 'dshw-form-row' },
              h('label', { htmlFor: 'dshw-project-base' }, t.defaultBase),
              h('div', null,
                branchControl,
                branchHint ? h('div', { className: 'dshw-hint' }, branchHint) : null)),
            h('div', { className: 'dshw-form-row' },
              h('label', { htmlFor: 'dshw-project-prefix' }, t.branchPrefix),
              h('div', null,
                h('input', {
                  id: 'dshw-project-prefix',
                  className: 'dshw-input dshw-mono',
                  value: branchPrefix,
                  placeholder: 'dsh-wt/',
                  onChange: (e: any) => setBranchPrefix(e.target.value),
                }),
                h('div', { className: 'dshw-hint' }, t.branchPrefixHint))),
            h('div', { className: 'dshw-form-row' },
              h('label', { htmlFor: 'dshw-project-dir' }, t.worktreeDirName),
              h('div', null,
                h('input', {
                  id: 'dshw-project-dir',
                  className: 'dshw-input dshw-mono',
                  value: dirName,
                  placeholder: '.dsh-worktrees',
                  onChange: (e: any) => setDirName(e.target.value),
                }),
                h('div', { className: 'dshw-hint' }, t.worktreeDirHint)))),
          h('div', { className: 'dshw-form-foot' },
            h(Btn, { variant: 'primary', type: 'submit', disabled: busy !== '' }, busy === 'save' ? h(Spinner) : null, busy === 'save' ? t.saving : t.save),
            h('span', { className: 'dshw-save-state', role: 'status' }, msg ? [h(Icon, { key: 'i', name: 'check' }), h('span', { key: 's' }, msg)] : null)),
          err ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err)) : null)),
      h(Card, { danger: true },
        h(CardHead, { icon: 'alert', title: t.deleteProject }),
        h('p', { className: 'dshw-card-sub' }, t.deleteProjectCardHint),
        h(Btn, { variant: 'danger', icon: 'trash', disabled: busy !== '', onClick: () => setDeleteOpen(true) }, t.deleteProject)),
      deleteModal)
  }

  /* ----------------------------------------------------------------------
   * Settings page
   * -------------------------------------------------------------------- */

  function SettingsPage(props: any) {
    const t = props.__t
    useStyles()
    const [cfg, setCfg] = React.useState(null)
    const [recents, setRecents] = React.useState([])
    const [clearing, setClearing] = React.useState(false)
    const [clearOpen, setClearOpen] = React.useState(false)
    const [err, setErr] = React.useState('')
    const [toast, setToast] = React.useState(null)
    const toastTimer = React.useRef(null)
    const clearRef = React.useRef(false)

    const notify = (message: string, kind?: string) => {
      setToast({ message, kind: kind || 'ok' })
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
      toastTimer.current = window.setTimeout(() => setToast(null), 2800)
    }

    React.useEffect(() => {
      getJson('config').then((d: any) => setCfg(d.config)).catch((e: any) => setErr((e && e.message) || t.loadFailed))
      getJson('recents').then((d: any) => setRecents(d.dirs || [])).catch(() => {})
    }, [])

    React.useEffect(() => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }, [])

    const clearRecents = async () => {
      if (clearRef.current || clearing) return
      clearRef.current = true
      setClearing(true)
      setErr('')
      try {
        await post('recents/clear', {})
        setRecents([])
        setClearOpen(false)
        notify(t.clearRecents)
      } catch (e: any) {
        setErr((e && e.message) || t.failed)
      } finally {
        clearRef.current = false
        setClearing(false)
      }
    }

    const clearModal = clearOpen
      ? h(Modal, {
        t,
        title: t.clearRecentsTitle,
        subtitle: t.clearRecentsSub,
        icon: 'trash',
        tone: 'danger',
        size: 'sm',
        busy: clearing,
        onClose: () => { if (!clearing) setClearOpen(false) },
        footer: [
          h(Btn, { key: 'c', onClick: () => setClearOpen(false), disabled: clearing, 'data-autofocus': true }, t.cancel),
          h(Btn, { key: 'ok', variant: 'danger', disabled: clearing, onClick: () => void clearRecents() },
            clearing ? h(Spinner) : null, clearing ? t.deleting : t.clearRecents),
        ],
      },
        h('div', { className: 'dshw-danger-list' },
          h('div', { className: 'dshw-danger-title' }, h(Icon, { name: 'alert' }), String(t.clearRecentsDanger).replace('{n}', String(recents.length))),
          recents.map((dir: string) => h('div', { key: dir, className: 'dshw-danger-item' }, h(Icon, { name: 'folder' }), h('span', null, dir)))),
        h('div', { className: 'dshw-hint' }, t.clearRecentsHint),
        err ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err)) : null)
      : null

    return h('div', { className: 'dshw-scope dshw-shell', style: { overflow: 'auto' } },
      h('div', { className: 'dshw-settings' },
        h('div', { className: 'dshw-page-head' },
          h('div', { className: 'dshw-page-icon' }, h(Icon, { name: 'settings' })),
          h('div', { className: 'dshw-page-head-copy' },
            h('h1', null, t.title),
            h('div', { className: 'dshw-page-sub' }, t.settingsSub))),
        err ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err)) : null,
        h(Card, null,
          h(CardHead, {
            icon: 'clock',
            title: t.recents,
            right: h('span', { className: 'dshw-hint', style: { margin: 0 } }, recents.length + ' ' + t.dirUnit),
          }),
          recents.length
            ? h('div', { className: 'dshw-recent-list' }, recents.map((dir: string) =>
              h('div', { key: dir, className: 'dshw-recent-row' },
                h(Icon, { name: 'folder' }),
                h('div', { className: 'dshw-recent-main' },
                  h('div', { className: 'dshw-recent-path', title: dir }, dir)),
                h(IconBtn, {
                  size: 'sm',
                  icon: 'copy',
                  label: t.copyPath,
                  onClick: () => { void copyText(dir).then((ok) => notify(ok ? t.copied : t.copyFailed, ok ? 'ok' : 'error')) },
                }))))
            : h('div', { className: 'dshw-hint' }, t.recentsEmpty),
          h('div', { className: 'dshw-hint', style: { marginTop: '10px' } }, t.recentsHint),
          h('div', { className: 'dshw-danger-row' },
            h(Icon, { name: 'trash' }),
            h('span', null, t.clearRecentsShortHint),
            h(Btn, {
              size: 'sm',
              variant: 'danger',
              disabled: recents.length === 0,
              onClick: () => setClearOpen(true),
            }, t.clearRecents))),
        h(Card, null,
          h(CardHead, { icon: 'sliders', title: t.config }),
          h('p', { className: 'dshw-card-sub' }, t.configHint),
          h('div', { className: 'dshw-kv' },
            h(KV, { label: t.worktreeDirName }, h('code', null, cfg ? String(cfg.dirName) : '…')),
            h(KV, { label: t.branchPrefix }, h('code', null, cfg ? String(cfg.branchPrefix) : '…')),
            h(KV, { label: t.gitPath }, h('code', null, cfg ? String(cfg.gitPath) : '…')))),
        clearModal),
      h('div', { className: 'dshw-toast' + (toast ? ' dshw-toast--show' : ''), role: 'status', 'aria-live': 'polite' },
        toast ? [h(Icon, { key: 'i', name: toast.kind === 'error' ? 'alert' : 'checkCircle' }), h('span', { key: 's' }, toast.message)] : null))
  }

  /* ----------------------------------------------------------------------
   * Board page
   * -------------------------------------------------------------------- */

  function BoardPage(props: any) {
    const t = props.__t
    useStyles()
    const [projectViews, setProjectViews] = React.useState([])
    const [cfg, setCfg] = React.useState(null)
    const [loaded, setLoaded] = React.useState(false)
    const [refreshing, setRefreshing] = React.useState(false)
    const [err, setErr] = React.useState('')
    const [query, setQuery] = React.useState('')
    const [selectedProjectId, setSelectedProjectId] = React.useState('')
    const [selectedTaskId, setSelectedTaskId] = React.useState('')
    const [showDetail, setShowDetail] = React.useState(false)
    const [collapsed, setCollapsed] = React.useState({})
    const [publishFor, setPublishFor] = React.useState(null)
    const [projectModalOpen, setProjectModalOpen] = React.useState(false)
    const [sessionMap, setSessionMap] = React.useState({})
    const [pendingMap, setPendingMap] = React.useState({})
    const [toast, setToast] = React.useState(null)
    const bindingRef = React.useRef(new Set<string>())
    const searchRef = React.useRef(null)
    const detailRef = React.useRef(null)
    const shellRef = React.useRef(null)
    const toastTimer = React.useRef(null)

    const remotes = appCtx && appCtx.remote

    const notify = (message: string, kind?: string) => {
      setToast({ message, kind: kind || 'ok' })
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
      toastTimer.current = window.setTimeout(() => setToast(null), 2800)
    }

    React.useEffect(() => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }, [])

    const refresh = React.useCallback(async (manual?: boolean) => {
      if (manual) setRefreshing(true)
      try {
        const d = await getJson('projects')
        const list: any[] = d.projects || []
        setProjectViews(list)
        setSelectedTaskId((prev: string) => (prev && list.some((pv: any) => pv.tasks.some((v: any) => v.task.id === prev)) ? prev : ''))
        setSelectedProjectId((prev: string) => {
          if (prev && list.some((pv: any) => pv.project.id === prev)) return prev
          return list.length ? list[0].project.id : ''
        })
        setErr('')
      } catch (e: any) {
        setErr((e && e.message) || t.loadFailed)
      } finally {
        setLoaded(true)
        if (manual) setRefreshing(false)
      }
    }, [])

    React.useEffect(() => {
      void refresh()
      const timer = setInterval(() => {
        if (document.hidden) return
        void refresh()
      }, 4000)
      return () => clearInterval(timer)
    }, [refresh])

    React.useEffect(() => {
      getJson('config').then((d: any) => setCfg(d.config)).catch(() => {})
    }, [])

    // Live session state for the dots (remote events + one initial list).
    React.useEffect(() => {
      if (!remotes) return
      const apply = () => {
        try {
          void Promise.resolve(remotes.session.list({})).then((r: any) => {
            if (!r || r.ok === false || !r.value) return
            const next: any = {}
            for (const item of r.value.items || []) next[item.sessionId] = { running: !!item.running, updatedAt: item.updatedAt }
            setSessionMap(next)
          }).catch(() => {})
        } catch {
          /* noop */
        }
      }
      apply()
      const offs: Array<() => void> = []
      for (const ev of ['api-session/status', 'api-session/activity', 'api-session/added', 'api-session/removed']) {
        try {
          offs.push(remotes.$on(ev, apply))
        } catch {
          /* noop */
        }
      }
      const timer = setInterval(apply, 15000)
      return () => {
        for (const off of offs) {
          try {
            off()
          } catch {
            /* noop */
          }
        }
        clearInterval(timer)
      }
    }, [remotes])

    // Auto-bind tasks published from tools (no session yet, start requested).
    React.useEffect(() => {
      try {
        if (!remotes || !remotes.session) return
        // A UI publish binds its own session; never let the poll race create a
        // second one while the publish modal is still working.
        if (publishFor) return
        for (const pv of projectViews) {
          for (const v of pv.tasks) {
            const task = v.task
            if (task.sessionId || task.startOnBind === false || v.snapshot.status === 'cleaned') continue
            if (bindingRef.current.has(task.id)) continue
            bindingRef.current.add(task.id)
            bindSession(remotes, task, pv.project.name)
              .then(() => { void refresh() })
              .catch(() => { bindingRef.current.delete(task.id) })
          }
        }
      } catch {
        /* remote service not ready */
      }
    }, [projectViews, remotes, refresh, publishFor])

    // Pending user interactions (approval / plan-review / question) per session —
    // the same source the sidebar's 等待审批 badge uses.
    React.useEffect(() => {
      try {
        const svc = appCtx && appCtx.get && appCtx.get('uiSession')
        if (!svc || !svc.sessionStatus) return
        const apply = () => {
          try {
            const snap = svc.sessionStatus.getSnapshot()
            const next: any = {}
            for (const [id, st] of snap) {
              const kind = st && st.pendingInteraction && st.pendingInteraction.kind
              if (kind === 'approval' || kind === 'plan-review' || kind === 'question') next[id] = kind
            }
            setPendingMap(next)
          } catch {
            /* noop */
          }
        }
        apply()
        const off = svc.sessionStatus.subscribe(apply)
        return () => {
          try {
            off()
          } catch {
            /* noop */
          }
        }
      } catch {
        /* uiSession not available */
      }
    }, [])

    // Last turn outcome per task session: an interrupted/failed run is a
    // session problem, not a Git problem, so it is surfaced next to the status.
    const [sessionHealth, setSessionHealth] = React.useState({} as Record<string, { kind: string; message?: string }>)
    const healthRef = React.useRef(sessionHealth)
    healthRef.current = sessionHealth
    const sessionIdsKey = React.useMemo(
      () => projectViews.flatMap((pv: any) => pv.tasks.map((v: any) => v.task.sessionId).filter(Boolean)).sort().join('|'),
      [projectViews],
    )
    React.useEffect(() => {
      const remote = remotes
      const ids = sessionIdsKey ? sessionIdsKey.split('|') : []
      if (!remote || !remote.session || !ids.length) {
        setSessionHealth({})
        return
      }
      let cancelled = false
      const pull = async () => {
        const next: Record<string, { kind: string; message?: string }> = {}
        await Promise.all(ids.map(async (sessionId: string) => {
          try {
            const stream = await remote.session.follow({
              address: { kind: 'session', sessionId },
              maxMessages: 1,
            })
            const iterator = stream && typeof stream[Symbol.asyncIterator] === 'function' ? stream[Symbol.asyncIterator]() : null
            if (!iterator) return
            let frame: any = null
            try {
              const first: any = await Promise.race([
                iterator.next(),
                new Promise((resolve) => setTimeout(() => resolve(null), 2000)),
              ])
              frame = first && first.done !== true ? first.value : null
            } finally {
              if (typeof iterator.return === 'function') {
                try {
                  await iterator.return()
                } catch {
                  /* stream already closed */
                }
              }
            }
            const events = frame && Array.isArray(frame.records) ? frame.records.map((r: any) => r.event || r).filter(Boolean) : []
            let lastEnd: any = null
            for (const event of events) if (event.type === 'turn/end') lastEnd = event
            const reason = lastEnd && lastEnd.data && lastEnd.data.reason
            const kind = reason && (reason.kind || reason.type)
            if (kind === 'interrupted') next[sessionId] = { kind: 'interrupted' }
            else if (kind === 'error' || kind === 'failed') next[sessionId] = { kind: 'error', message: reason.message || reason.error || '' }
          } catch {
            const previous = healthRef.current[sessionId]
            if (previous) next[sessionId] = previous
          }
        }))
        if (!cancelled) setSessionHealth(next)
      }
      void pull()
      const timer = setInterval(() => {
        if (!document.hidden) void pull()
      }, 12000)
      return () => {
        cancelled = true
        clearInterval(timer)
      }
    }, [sessionIdsKey, remotes])

    React.useEffect(() => {
      const onDocClick = (e: any) => {
        document.querySelectorAll('.dshw-menu[open]').forEach((menu: any) => {
          if (!menu.contains(e.target)) menu.removeAttribute('open')
        })
      }
      document.addEventListener('click', onDocClick)
      return () => document.removeEventListener('click', onDocClick)
    }, [])

    const runningOf = (task: any): boolean | null => {
      if (!task.sessionId) return null
      const s = sessionMap[task.sessionId]
      return s ? !!s.running : false
    }

    const allTasks = projectViews.flatMap((pv: any) => pv.tasks)
    const selectedProject = projectViews.find((pv: any) => pv.project.id === selectedProjectId) || null
    const selectedTask = allTasks.find((v: any) => v.task.id === selectedTaskId) || null

    // Live session projections for the selected task's conversation (polled).
    const liveSessionId = selectedTask && selectedTask.task.sessionId ? String(selectedTask.task.sessionId) : ''
    const [live, setLive] = React.useState(null)
    const remotesRef = React.useRef(remotes)
    React.useEffect(() => {
      remotesRef.current = remotes
    })
    React.useEffect(() => {
      const remote = remotesRef.current
      if (!remote || !liveSessionId) {
        setLive(null)
        return
      }
      let cancelled = false
      const pull = async () => {
        try {
          const r = await remote.session.projections({ sessionId: liveSessionId })
          if (!cancelled && r && r.ok && r.value && r.value.values) setLive({ sessionId: liveSessionId, values: r.value.values })
        } catch {
          /* keep last */
        }
      }
      pull()
      const timer = setInterval(pull, 4000)
      return () => {
        cancelled = true
        clearInterval(timer)
      }
    }, [liveSessionId])
    const liveValues = live && live.sessionId === liveSessionId ? live.values : null

    // Full session timeline (reasoning, tool calls and results) for the live console.
    const [history, setHistory] = React.useState(null)
    React.useEffect(() => {
      const remote = remotesRef.current
      if (!remote || !remote.session || !liveSessionId) {
        setHistory(null)
        return
      }
      let cancelled = false
      const pull = async () => {
        try {
          const stream = await remote.session.follow({
            address: { kind: 'session', sessionId: liveSessionId },
            maxMessages: 24,
          })
          const iterator = stream && typeof stream[Symbol.asyncIterator] === 'function' ? stream[Symbol.asyncIterator]() : null
          if (!iterator) return
          let frame: any = null
          try {
            const first: any = await Promise.race([
              iterator.next(),
              new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
            ])
            frame = first && first.done !== true ? first.value : null
          } finally {
            if (typeof iterator.return === 'function') {
              try {
                await iterator.return()
              } catch {
                /* stream already closed */
              }
            }
          }
          if (cancelled || !frame || !Array.isArray(frame.records)) return
          setHistory({ sessionId: liveSessionId, entries: buildHistoryEntries(frame.records, 240) })
        } catch {
          /* keep the last readable timeline */
        }
      }
      void pull()
      const timer = setInterval(() => {
        if (!document.hidden) void pull()
      }, 4000)
      return () => {
        cancelled = true
        clearInterval(timer)
      }
    }, [liveSessionId])
    const historyEntries = history && history.sessionId === liveSessionId ? history.entries : null

    React.useEffect(() => {
      if (detailRef.current) detailRef.current.scrollTop = 0
    }, [selectedTaskId, selectedProjectId])

    // Keyboard: "/" or Ctrl/Cmd+K focuses search; Escape clears it.
    React.useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (projectModalOpen || publishFor) return
        const active: any = document.activeElement
        const shell: any = shellRef.current
        // Never hijack shortcuts typed into the host UI (chat composer, etc.).
        if (!shell || !(active === shell || shell.contains(active))) return
        const typing = active && (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || active.isContentEditable)
        if (!typing && (e.key === '/' || ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k'))) {
          e.preventDefault()
          if (searchRef.current) (searchRef.current as any).focus()
          return
        }
        if (e.key === 'Escape' && active === searchRef.current && query) {
          setQuery('')
        }
      }
      document.addEventListener('keydown', onKey)
      return () => document.removeEventListener('keydown', onKey)
    }, [query, projectModalOpen, publishFor])

    const selectProject = (id: string) => {
      setSelectedProjectId(id)
      setSelectedTaskId('')
      setShowDetail(true)
      setCollapsed((c: any) => ({ ...c, [id]: false }))
    }
    const selectTask = (id: string, projectId?: string) => {
      const found = allTasks.find((v: any) => v.task.id === id)
      const owner = projectId
        || (found && found.task.projectId)
        || (found ? ((projectViews.find((pv: any) => pv.tasks.some((v: any) => v.task.id === id)) || {}).project || {}).id : '')
        || ''
      setSelectedTaskId(id)
      setSelectedProjectId(owner)
      setShowDetail(true)
      if (owner) setCollapsed((c: any) => ({ ...c, [owner]: false }))
    }
    const toggleCollapse = (id: string) => setCollapsed((c: any) => ({ ...c, [id]: !c[id] }))

    /** Jump to the task's conversation in the left workspace (native navigation). */
    const openTaskSession = (sessionId: string) => {
      try {
        const uiws = appCtx && appCtx.get && appCtx.get('uiWorkspace')
        if (uiws && typeof uiws.openSession === 'function') {
          uiws.openSession(sessionId)
          return true
        }
      } catch {
        /* fall through to the in-board detail */
      }
      return false
    }
    const createTaskSession = async (v: any) => {
      if (!remotes || !remotes.session) throw new Error(t.failed)
      const owner = projectViews.find((pv: any) => pv.project.id === v.task.projectId)
        || projectViews.find((pv: any) => pv.project.repoPath === v.task.repoPath)
      const sessionId = await bindSession(remotes, v.task, owner && owner.project.name)
      if (!openTaskSession(sessionId)) selectTask(v.task.id, owner && owner.project.id)
      return sessionId
    }

    const afterChange = async () => {
      await refresh()
    }

    const projectColor = (id: string) => {
      let n = 0
      for (let i = 0; i < id.length; i += 1) n = (n * 31 + id.charCodeAt(i)) | 0
      return ['blue', 'purple', 'green', 'orange'][Math.abs(n) % 4]
    }

    const q = query.trim().toLowerCase()
    const filtered = projectViews.map((pv: any) => {
      const nameHit = !q || pv.project.name.toLowerCase().includes(q) || pv.project.repoPath.toLowerCase().includes(q)
      const tasks = nameHit
        ? pv.tasks
        : pv.tasks.filter((v: any) => {
          const pending = v.task.sessionId && pendingMap[v.task.sessionId]
          return String(v.task.title).toLowerCase().includes(q)
            || String(v.task.branch || '').toLowerCase().includes(q)
            || String(pendingLabel(t, pending) || '').toLowerCase().includes(q)
        })
      return { pv, nameHit, tasks }
    }).filter((item: any) => !q || item.nameHit || item.tasks.length > 0)

    const totalTasks = projectViews.reduce((sum: number, pv: any) => sum + pv.tasks.length, 0)

    const projectRow = (item: any) => {
      const pv = item.pv
      const isOpen = q ? true : !collapsed[pv.project.id]
      const activeProject = selectedProjectId === pv.project.id && !selectedTaskId
      const color = projectColor(pv.project.id)
      return h('div', { key: pv.project.id },
        h('div', { className: 'dshw-project' + (activeProject ? ' dshw-project--on' : ''), 'data-open': isOpen ? 'true' : 'false' },
          h('button', {
            className: 'dshw-project-toggle',
            type: 'button',
            'aria-expanded': isOpen,
            'aria-label': (isOpen ? t.collapse : t.expand) + ': ' + pv.project.name,
            onClick: () => toggleCollapse(pv.project.id),
          }, h(Icon, { name: 'chevronDown' })),
          h('button', {
            className: 'dshw-project-select',
            type: 'button',
            title: pv.project.repoPath,
            'aria-current': activeProject ? 'true' : undefined,
            onClick: () => selectProject(pv.project.id),
          },
            h('span', { className: 'dshw-folder-tile dshw-folder-tile--' + color }, h(Icon, { name: 'folder' })),
            h('span', { className: 'dshw-project-name' }, pv.project.name),
            h('span', { className: 'dshw-project-count' }, String(item.tasks.length))),
          h('button', {
            className: 'dshw-project-add',
            type: 'button',
            title: t.addTask,
            'aria-label': t.addTask + ': ' + pv.project.name,
            onClick: () => { setPublishFor(pv.project); selectProject(pv.project.id) },
          }, h(Icon, { name: 'plus' }))),
        isOpen
          ? item.tasks.length
            ? h('div', { className: 'dshw-tree' }, item.tasks.map((v: any) => {
              const pendingKind = v.task.sessionId ? pendingMap[v.task.sessionId] : null
              const running = runningOf(v.task)
              const active = selectedTaskId === v.task.id
              const meta = statusMeta(t, v.snapshot.status, pendingKind)
              const health = v.task.sessionId ? sessionHealth[v.task.sessionId] : null
              const healthActive = !!health && !running
              const dotTone = meta.pending && !meta.note ? 'warn' : healthActive ? (health.kind === 'error' ? 'error' : 'warn') : STATUS_TONE[v.snapshot.status] || 'neutral'
              const bound = !!v.task.sessionId
              return h('div', { key: v.task.id, className: 'dshw-task' + (active ? ' dshw-task--on' : '') },
                h('button', {
                  className: 'dshw-task-select',
                  type: 'button',
                  onClick: () => selectTask(v.task.id, pv.project.id),
                  title: v.task.title,
                  'aria-current': active ? 'true' : undefined,
                },
                  h(Dot, { tone: dotTone, pulse: meta.pending }),
                  h('span', { className: 'dshw-task-main' },
                    h('span', { className: 'dshw-task-title' }, v.task.title),
                    h('span', { className: 'dshw-task-meta' },
                      h(Chip, { tone: meta.tone, small: true }, meta.label),
                      meta.note ? h(Chip, { tone: 'warn', small: true }, meta.note) : null,
                      healthActive
                        ? h(Chip, { tone: health.kind === 'error' ? 'error' : 'warn', small: true }, health.kind === 'error' ? t.sessionError : t.sessionInterrupted)
                        : null,
                      v.snapshot.worktree.ahead > 0
                        ? h('span', { className: 'dshw-task-count', title: v.snapshot.worktree.ahead + ' ' + t.commitsAhead },
                          h(Icon, { name: 'arrowUp' }), v.snapshot.worktree.ahead)
                        : null,
                      v.snapshot.worktree.dirtyCount > 0
                        ? h('span', { className: 'dshw-task-count', title: v.snapshot.worktree.dirtyCount + ' ' + t.dirty }, '±' + v.snapshot.worktree.dirtyCount)
                        : null))),
                h('button', {
                  className: 'dshw-task-open',
                  type: 'button',
                  title: bound ? t.openSessionBtn : t.noSession,
                  'aria-label': (bound ? t.openSessionBtn : t.noSession) + ': ' + v.task.title,
                  disabled: !bound,
                  onClick: () => { if (bound && !openTaskSession(v.task.sessionId)) notify(t.openSessionFailed, 'error') },
                }, h(Icon, { name: 'external' })))
            }))
            : h('div', { className: 'dshw-tree-inline-empty' },
              h('span', null, t.noTasks),
              q ? null : h('button', { type: 'button', className: 'dshw-link-btn', onClick: () => { setPublishFor(pv.project); selectProject(pv.project.id) } }, t.addTask))
          : null)
    }

    const treeBody = !loaded
      ? h('div', { 'aria-hidden': 'true' },
        [0, 1, 2].map((group) => h('div', { key: 'g' + group },
          h('div', { className: 'dshw-sk-project' },
            h('span', { className: 'dshw-sk-line', style: { width: '12px', height: '12px', borderRadius: '4px' } }),
            h('span', { className: 'dshw-sk-line', style: { width: '22px', height: '22px', borderRadius: '6px' } }),
            h('span', { className: 'dshw-sk-line', style: { width: [92, 74, 108][group] + 'px' } }),
            h('span', { className: 'dshw-sk-line', style: { width: '18px', height: '16px', marginLeft: 'auto', borderRadius: '99px' } })),
          [0, 1, 2].map((row) => h('div', { key: 'r' + row, className: 'dshw-sk-task' },
            h('span', { className: 'dshw-sk-line', style: { width: '7px', height: '7px', borderRadius: '50%' } }),
            h('span', { className: 'dshw-sk-line', style: { width: [120, 156, 96][row] + 'px' } }),
            h('span', { className: 'dshw-sk-line dshw-sk-line--sm', style: { width: '44px', marginLeft: 'auto' } }))))))
      : filtered.length === 0
        ? projectViews.length === 0
          ? h('div', { className: 'dshw-tree-empty' },
            h('div', { className: 'dshw-empty-icon' }, h(Icon, { name: 'folder' })),
            h('h3', null, t.noProjects),
            h('p', null, t.noProjectsHint),
            h(Btn, { variant: 'primary', size: 'sm', icon: 'plus', onClick: () => setProjectModalOpen(true) }, t.addProject))
          : h('div', { className: 'dshw-tree-empty' },
            h('div', { className: 'dshw-empty-icon' }, h(Icon, { name: 'search' })),
            h('h3', null, t.noMatch),
            h('p', null, t.noMatchHint),
            h(Btn, { size: 'sm', onClick: () => setQuery('') }, t.clearSearch))
        : filtered.map(projectRow)

    const treeNode = h('section', { className: 'dshw-tree', 'aria-label': t.projects },
      h('header', { className: 'dshw-tree-head' },
        h('div', { className: 'dshw-search' },
          h(Icon, { name: 'search' }),
          h('input', {
            ref: searchRef,
            type: 'search',
            value: query,
            placeholder: t.search,
            autoComplete: 'off',
            'aria-label': t.search,
            onChange: (e: any) => setQuery(e.target.value),
          })),
        h(IconBtn, {
          icon: 'refresh',
          label: t.refresh,
          disabled: refreshing,
          onClick: () => { void refresh(true).then(() => notify(t.refreshed)) },
        }, refreshing ? h(Spinner) : null),
        h(IconBtn, { icon: 'plus', label: t.addProject, onClick: () => setProjectModalOpen(true) })),
      err ? h('div', { style: { padding: '0 10px 8px' } },
        h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err))) : null,
      h('div', { className: 'dshw-tree-scroll' }, treeBody),
      h('footer', { className: 'dshw-tree-foot' },
        h('span', null, projectViews.length + ' ' + t.projectUnit + ' · ' + totalTasks + ' ' + t.taskUnit),
        h('span', { className: 'dshw-tree-tag' }, 'worktree')))

    const mobileBar = selectedTask || selectedProject
      ? h('div', { className: 'dshw-mobile-bar' },
        h(Btn, { size: 'sm', icon: 'arrowLeft', onClick: () => setShowDetail(false) }, t.backToList))
      : null

    let detailBody: any
    if (selectedTask) {
      detailBody = h(TaskDetail, {
        key: selectedTask.task.id,
        view: selectedTask,
        project: selectedProject ? selectedProject.project : null,
        running: runningOf(selectedTask.task),
        pendingKind: selectedTask.task.sessionId ? pendingMap[selectedTask.task.sessionId] : null,
        health: selectedTask.task.sessionId ? sessionHealth[selectedTask.task.sessionId] : null,
        live: liveValues,
        history: historyEntries,
        t,
        notify,
        onChanged: afterChange,
        onOpenSession: selectedTask.task.sessionId ? () => openTaskSession(selectedTask.task.sessionId) : undefined,
        onCreateSession: selectedTask.task.sessionId ? undefined : () => createTaskSession(selectedTask),
      })
    } else if (selectedProject) {
      detailBody = h(ProjectDetail, {
        key: selectedProject.project.id,
        view: selectedProject,
        cfg,
        pendingMap,
        t,
        notify,
        onChanged: afterChange,
        onPublish: (project: any) => setPublishFor(project),
        onSelectTask: selectTask,
        onDeleted: () => {
          setSelectedProjectId('')
          setSelectedTaskId('')
          setShowDetail(false)
          void refresh()
        },
      })
    } else {
      detailBody = h(Empty, { title: t.selectTask, icon: 'file', className: 'dshw-detail-empty' })
    }

    const detailNode = h('main', { className: 'dshw-detail' },
      h('div', { className: 'dshw-detail-scroll', ref: detailRef },
        h('div', { className: 'dshw-detail-inner' }, mobileBar),
        detailBody))

    const modalNode = [
      publishFor
        ? h(PublishModal, {
          key: 'pub',
          t,
          project: publishFor,
          cfg,
          onClose: () => setPublishFor(null),
          onRefresh: () => { void refresh() },
          onError: (message: string) => notify(message, 'error'),
          onPublished: (task: any, project: any, warning?: string) => {
            setPublishFor(null)
            if (project && project.id) setSelectedProjectId(project.id)
            if (task && task.id) setSelectedTaskId(task.id)
            setShowDetail(true)
            void refresh()
            notify(warning || String(t.published).replace('{branch}', task && task.branch ? task.branch : ''), warning ? 'error' : 'ok')
          },
        })
        : null,
      projectModalOpen
        ? h(AddProjectModal, {
          key: 'proj',
          t,
          onClose: () => setProjectModalOpen(false),
          onAdded: (project: any) => {
            setProjectModalOpen(false)
            if (project && project.id) {
              setSelectedProjectId(project.id)
              setSelectedTaskId('')
              setShowDetail(true)
              notify(String(t.projectAdded).replace('{name}', project.name))
            }
            void refresh()
          },
        })
        : null,
    ]

    return h('div', { className: 'dshw-scope dshw-shell', ref: shellRef },
      h('div', { className: 'dshw-app' + (showDetail ? ' dshw-app--detail' : '') }, treeNode, detailNode, modalNode),
      h('div', { className: 'dshw-toast' + (toast ? ' dshw-toast--show' : ''), role: 'status', 'aria-live': 'polite' },
        toast ? [h(Icon, { key: 'i', name: toast.kind === 'error' ? 'alert' : 'checkCircle' }), h('span', { key: 's' }, toast.message)] : null))
  }

  function BoardIcon() {
    return h('svg', { viewBox: '0 0 24 24', width: 22, height: 22, 'aria-hidden': true, style: { color: 'currentColor' } },
      h('circle', { cx: 7, cy: 6, r: 3, fill: 'currentColor' }),
      h('circle', { cx: 7, cy: 18, r: 3, fill: 'currentColor' }),
      h('circle', { cx: 17, cy: 12, r: 3, fill: 'currentColor', opacity: 0.75 }),
      h('path', { d: 'M7 9v6', stroke: 'currentColor', strokeWidth: 2, fill: 'none', strokeLinecap: 'round' }),
      h('path', { d: 'M9.5 7.5c4 1.5 5.5 2.5 6.2 4', stroke: 'currentColor', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', opacity: 0.75 }))
  }

  return {
    inject: ['slots', 'locale', 'remote', 'remote.session', 'remote.directoryPicker', 'remote.workspace', 'uiSession'],
    apply(ctx: any) {
      appCtx = ctx
      let dict = FALLBACK.zh
      try {
        const locale = ctx.get ? ctx.get('locale') : undefined
        dict = pickDict(locale)
        if (locale && typeof locale.register === 'function') {
          try {
            locale.register(MODULE_ID, { en: FALLBACK.en, zh: FALLBACK.zh })
          } catch {
            /* noop */
          }
        }
      } catch {
        /* noop */
      }
      const withT = (C: any) => (props: any) => h(C, Object.assign({}, props, { __t: dict }))
      ctx.effect(() => {
        const offs: Array<() => void> = []
        const reg = (slot: string, make: () => any) => {
          try {
            offs.push(ctx.slots.inject(slot, make))
          } catch {
            /* slot not available */
          }
        }
        reg('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'deepseek-worktree-settings', order: 61, label: dict.title }, withT(SettingsPage)))
        reg('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'worktree-board', order: 41, label: dict.title }, withT(BoardIcon)))
        reg('main', function* () { yield ctx.slots.register({ name: 'main', key: 'worktree-board', label: dict.title }, withT(BoardPage)) })
        return () => {
          for (const off of offs) {
            try {
              off()
            } catch {
              /* noop */
            }
          }
        }
      }, 'deepseek-worktree: slots')
    },
  }
}
