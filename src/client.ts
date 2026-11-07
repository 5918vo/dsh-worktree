/** Client half: workbench board (task list + detail) + publish form + settings page. */

export const MODULE_ID = '@local/dsh-deepseek-worktree'

type Req = (m: string) => any

const FALLBACK = {
  en: {
    title: 'Worktree Tasks',
    publish: 'Publish task',
    repoPath: 'Target directory',
    repoPathHint: 'Repository directory',
    browse: 'Browse…',
    pickingDirectory: 'Choosing…',
    baseBranch: 'Base branch',
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
    liveTodos: 'Agent todos',
    liveTurns: 'Turns',
    liveTurnN: 'Turn {n}',
    liveTurnEmpty: 'No turns yet',
    liveQueued: 'Queued msgs',
    liveSubagents: 'Subagents',
    livePerms: 'Access',
    liveLastPrompt: 'Last prompt',
    liveStats: '{turns} turns · {steps} steps',
    pendingApproval: 'Waiting approval',
    pendingPlanReview: 'Plan review',
    pendingQuestion: 'Waiting answer',
    projects: 'Projects',
    addProject: 'Add project',
    addTask: '+ Task',
    projectDetail: 'Project',
    overview: 'Overview',
    projectSettings: 'Project settings',
    projectName: 'Name',
    defaultBase: 'Default base branch',
    worktreeDirName: 'Worktree dir name',
    gitPath: 'Git',
    branchPrefix: 'Branch prefix',
    save: 'Save',
    saved: 'Saved',
    deleteProject: 'Delete project',
    withTasks: 'Also delete its tasks',
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
    checkout: 'Switch to task branch for review',
    back: 'Switch back',
    merge: 'Merge into base',
    cleanup: 'Remove worktree',
    deleteRecord: 'Delete record',
    deleteBranch: 'Also delete branch',
    force: 'Force',
    dirty: 'uncommitted changes',
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
  },
  zh: {
    title: 'Worktree 任务',
    publish: '发布任务',
    repoPath: '目标目录',
    repoPathHint: '仓库目录',
    browse: '浏览…',
    pickingDirectory: '选择中…',
    baseBranch: '基线分支',
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
    pendingApproval: '待审批',
    pendingPlanReview: '计划待审',
    pendingQuestion: '待回答',
    projects: '项目',
    addProject: '新增项目',
    addTask: '＋任务',
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
  },
}

function pickDict(locale: any): (typeof FALLBACK)['zh'] {
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
  return (String(lang).toLowerCase().startsWith('en') ? FALLBACK.en : FALLBACK.zh) as unknown as (typeof FALLBACK)['zh']
}

const CSS = `
:where(.dshw-app,.dshw-settings){font-family:inherit;color:var(--dsw-alias-label-primary);-webkit-font-smoothing:antialiased}
.dshw-app,.dshw-app *,.dshw-modal,.dshw-modal *,.dshw-settings,.dshw-settings *{box-sizing:border-box}
.dshw-app{
  --wt-surface:var(--dsw-specific-input-major,var(--dsw-alias-bg-layer-1));
  --wt-nested:color-mix(in srgb,var(--dsw-alias-label-primary) 4%,transparent);
  --wt-sep:color-mix(in srgb,var(--dsw-alias-label-primary) 9%,transparent);
  --wt-hover:color-mix(in srgb,var(--dsw-alias-label-primary) 4%,transparent);
  --wt-selected:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent);
  --wt-edge:color-mix(in srgb,var(--dsw-alias-label-primary) 11%,transparent);
  --wt-page:color-mix(in srgb,var(--dsw-alias-label-primary) 3%,transparent);
  --wt-rail:color-mix(in srgb,var(--dsw-alias-label-primary) 5%,transparent);
display:flex;height:100%;min-height:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px}
.dshw-list{width:340px;flex:0 0 340px;display:flex;flex-direction:column;border-right:1px solid var(--wt-edge);background:var(--wt-rail);min-height:0}
.dshw-head{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:50px;padding:8px 12px;border-bottom:1px solid var(--wt-sep);background:var(--wt-rail);font-size:13px;font-weight:600}
.dshw-head-title{display:flex;align-items:center;gap:8px;min-width:0}
.dshw-mini{height:26px;min-width:26px;padding:0 8px;display:inline-flex;align-items:center;justify-content:center;background:transparent;border:1px solid transparent;border-radius:8px;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:13px;transition:background .15s,color .15s,border-color .15s}
.dshw-mini:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l1)}
.dshw-mini:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dshw-scroll{overflow:auto;flex:1;min-height:0;padding:6px}
.dshw-sec{font-size:11px;font-weight:600;letter-spacing:.02em;color:var(--dsw-alias-label-secondary);padding:10px 10px 5px}
.dshw-card{display:block;width:100%;text-align:left;padding:9px 10px;border:1px solid transparent;border-radius:10px;background:none;color:inherit;cursor:pointer;font:inherit;transition:background .12s,border-color .12s}
.dshw-card:hover{background:var(--dsw-alias-bg-layer-2)}
.dshw-card--on{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1)}
.dshw-card-top{display:flex;align-items:center;gap:8px}
.dshw-cname{flex:1;font-size:13px;font-weight:600;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshw-csub{font-size:11px;color:var(--dsw-alias-label-secondary);line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px}
.dshw-chip{flex:0 0 auto;font-size:10px;font-weight:600;padding:2px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2)}
.dshw-chip--run{color:var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary));border-color:currentColor}
.dshw-chip--warn{color:var(--dsw-alias-state-warn-primary);border-color:currentColor}
.dshw-chip--err{color:var(--dsw-alias-state-error-primary);border-color:currentColor}
.dshw-chip--danger{color:var(--dsw-alias-state-error-primary);border-color:currentColor;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent);font-weight:600}
.dshw-chip--ok{color:var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary));border-color:currentColor}
.dshw-dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:var(--dsw-alias-border-l2)}
.dshw-dot--run{background:var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary));box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary)) 18%,transparent)}
.dshw-dot--pending{background:var(--dsw-alias-state-warn-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-warn-primary) 22%,transparent);animation:dshw-pulse 1.2s ease-in-out infinite}
@keyframes dshw-pulse{0%,100%{opacity:1}50%{opacity:.45}}
.dshw-dot--off{background:color-mix(in srgb,var(--dsw-alias-label-secondary) 55%,transparent)}
.dshw-pane{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0;background:var(--wt-page)}
.dshw-pane-head{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:50px;padding:8px 16px;border-bottom:1px solid var(--wt-sep);background:var(--wt-page);font-size:13px;font-weight:600}
.dshw-pane-body{flex:1;overflow:auto;min-height:0;padding:16px 20px}
.dshw-block{background:var(--dsw-specific-input-major,var(--dsw-alias-bg-layer-1));border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:12px 14px;margin:0 0 14px;box-shadow:var(--dsw-elevation-soft,0 1px 3px rgba(0,0,0,.05))}
.dshw-block h4{margin:0 0 8px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary);letter-spacing:.02em}
.dshw-kv{display:grid;grid-template-columns:120px 1fr;gap:4px 12px;font-size:12px;align-items:baseline}
.dshw-kv .dshw-k{color:var(--dsw-alias-label-secondary)}
.dshw-kv .dshw-v{word-break:break-all}
.dshw-desc{white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-primary)}
.dshw-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
.dshw-btn{height:30px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;cursor:pointer;font:inherit;font-size:12px}
.dshw-btn:hover{border-color:var(--dsw-alias-brand-primary)}
.dshw-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dshw-btn--primary{height:30px;background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#4176e6));color:var(--dsw-alias-label-primary-inverted,#fff);border:0;border-radius:8px;padding:0 14px;cursor:pointer;font:inherit;font-size:12px;font-weight:600}
.dshw-btn--primary:hover{filter:brightness(1.06)}
.dshw-btn--primary:disabled{opacity:.55;cursor:default}
.dshw-btn--danger{color:var(--dsw-alias-state-error-primary)}
.dshw-btn:disabled{opacity:.55;cursor:default}
.dshw-commits{margin:0;padding:0;list-style:none;font-size:12px;display:flex;flex-direction:column;gap:4px}
.dshw-commits li{display:flex;gap:8px;align-items:baseline}
.dshw-hash{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-secondary);flex:0 0 auto}
.dshw-err{color:var(--dsw-alias-state-error-primary);font-size:12px}
.dshw-hint{color:var(--dsw-alias-label-secondary);font-size:12px;margin:2px 0}
.dshw-empty{color:var(--dsw-alias-label-secondary);padding:28px 16px;text-align:center;font-size:12px}
.dshw-modal-backdrop{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.32)}
.dshw-modal{width:min(640px,92vw);max-height:84vh;display:flex;flex-direction:column;background:var(--dsw-specific-input-major,var(--dsw-alias-bg-overlay));border:.5px solid var(--dsw-alias-settings-card-stroke,var(--dsw-alias-border-l2));border-radius:var(--dsw-radius-panel,28px);box-shadow:var(--dsw-elevation-soft,0 16px 48px rgba(0,0,0,.28));overflow:hidden}
.dshw-modal-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.dshw-modal-head h3{margin:0;font-size:15px;font-weight:600}
.dshw-modal-body{padding:16px 18px;overflow:auto;display:flex;flex-direction:column;gap:12px}
.dshw-field{display:flex;flex-direction:column;gap:5px}
.dshw-field>label{font-size:12px;font-weight:600}
.dshw-input{width:100%;box-sizing:border-box;background:var(--wt-nested);color:var(--dsw-alias-label-primary);border:1px solid transparent;border-radius:10px;padding:7px 10px;font:inherit;font-size:13px;min-height:34px;transition:border-color .15s}
.dshw-input:hover{border-color:var(--wt-edge)}
.dshw-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.dshw-input::placeholder{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}
.dshw-input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
textarea.dshw-input{min-height:110px;resize:vertical;line-height:1.6;padding:9px 10px}
select.dshw-input{height:34px;appearance:none;-webkit-appearance:none;padding-right:26px;cursor:pointer;color-scheme:light;background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23888' fill='none' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;text-overflow:ellipsis}
.dshw-dark select.dshw-input{color-scheme:dark}
select.dshw-input option{background:var(--wt-surface);color:var(--dsw-alias-label-primary)}
.dshw-check{display:flex;align-items:center;gap:8px;font-size:12px}
.dshw-settings{padding:3px 0;color:var(--dsw-alias-label-primary);font-size:13px}
.dshw-settings h3{margin:0 0 4px;font-size:15px;font-weight:600}
.dshw-settings .dshw-hint{margin-bottom:14px}
.dshw-grp{background:var(--dsw-alias-settings-card-fill,var(--dsw-alias-bg-layer-1));border:.5px solid var(--dsw-alias-settings-card-stroke,var(--dsw-alias-border-l1));border-radius:var(--dsw-radius-xl,20px);padding:12px 14px;margin:14px 0;display:flex;flex-direction:column;gap:12px}
.dshw-scroll::-webkit-scrollbar{width:10px}
.dshw-scroll::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l2);border-radius:8px;border:3px solid transparent;background-clip:content-box}
.dshw-proj{display:flex;align-items:center;gap:6px;width:100%;text-align:left;padding:8px 12px 8px 10px;border:1px solid transparent;border-radius:10px;background:none;color:inherit;cursor:pointer;font:inherit;transition:background .12s,border-color .12s}
.dshw-proj:hover{background:var(--wt-hover)}
.dshw-proj--on{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-brand-primary)}
.dshw-proj-name{flex:1;font-size:13px;font-weight:600;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshw-badge{flex:0 0 auto;font-size:10px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:1px 7px}
.dshw-caret{flex:0 0 auto;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;border:0;background:none;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:10px;padding:0}
.dshw-caret:hover{color:var(--dsw-alias-label-primary)}
.dshw-addtask{flex:0 0 auto;height:22px;padding:0 8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:7px;cursor:pointer;font:inherit;font-size:11px}
.dshw-addtask:hover{border-color:var(--dsw-alias-brand-primary)}
.dshw-taskrow{display:flex;align-items:center;gap:7px;width:100%;text-align:left;padding:6px 10px 6px 26px;border:1px solid transparent;border-radius:9px;background:none;color:inherit;cursor:pointer;font:inherit;transition:background .12s,border-color .12s}
.dshw-taskrow:hover{background:var(--wt-hover)}
.dshw-taskrow--on{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-brand-primary)}
.dshw-taskrow-title{flex:1;min-width:0;font-size:12px;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshw-tree{padding:0 4px 6px}
.dshw-pressure{height:6px;border-radius:999px;background:var(--wt-nested);overflow:hidden;flex:1;max-width:260px}
.dshw-pressure>span{display:block;height:100%;border-radius:999px;background:var(--dsw-alias-brand-primary,var(--dsw-alias-state-success-primary));transition:width .4s}
.dshw-pressure>span.dshw-pressure--warn{background:var(--dsw-alias-state-warn-primary)}
.dshw-todos{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px;font-size:12px}
.dshw-todos li{display:flex;gap:7px;align-items:baseline;line-height:1.5}
.dshw-todos .dshw-todo-ico{flex:0 0 auto;color:var(--dsw-alias-label-secondary);font-size:11px}
.dshw-todos li.dshw-todo--doing .dshw-todo-ico{color:var(--dsw-alias-brand-primary,var(--dsw-alias-state-business-primary))}
.dshw-todos li.dshw-todo--doing .dshw-todo-text{font-weight:600}
.dshw-todos li.dshw-todo--done .dshw-todo-text{text-decoration:line-through;color:var(--dsw-alias-label-secondary)}
.dshw-turn{border-top:1px solid var(--dsw-alias-border-l1);padding:6px 0 0;margin-top:6px;font-size:12px}
.dshw-turn:first-of-type{border-top:0;padding-top:0;margin-top:0}
.dshw-turn-head{cursor:pointer;display:flex;gap:8px;align-items:baseline;background:none;border:0;color:inherit;font:inherit;width:100%;text-align:left;padding:2px 0}
.dshw-turn-head:hover .dshw-turn-prompt{color:var(--dsw-alias-label-primary)}
.dshw-turn-n{flex:0 0 auto;color:var(--dsw-alias-label-secondary);font-size:11px}
.dshw-turn-prompt{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary)}
.dshw-turn-resp{margin:4px 0 0;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word;line-height:1.6;background:var(--wt-nested);border-radius:8px;padding:6px 8px}
.dshw-group{background:var(--wt-surface);border:1px solid var(--wt-edge);border-radius:12px;margin:16px 0 0;overflow:hidden}
.dshw-group-title{font-size:11px;font-weight:600;letter-spacing:.05em;color:var(--dsw-alias-label-secondary);margin:0;padding:10px 14px;background:var(--wt-nested);border-bottom:1px solid var(--wt-sep)}
.dshw-row{display:flex;gap:12px;padding:9px 14px;align-items:baseline;min-width:0}
.dshw-row + .dshw-row{border-top:1px solid var(--wt-sep)}
.dshw-row-tag{flex:0 0 auto;font-size:11px;color:var(--dsw-alias-label-secondary);min-width:64px}
.dshw-row-v{flex:1;min-width:0;font-size:12px;line-height:1.55;word-break:break-all;display:flex;flex-wrap:wrap;gap:6px;align-items:center;color:var(--dsw-alias-label-primary)}
.dshw-rows{padding:4px 0}

/* Refactored workbench layout and interaction states */
.dshw-shell{height:100%;min-height:0;container-name:dshw;container-type:inline-size;background:var(--dsw-alias-bg-base)}
.dshw-app{display:grid;grid-template-columns:320px minmax(0,1fr);width:100%;overflow:hidden}
.dshw-list{width:auto;min-width:0;flex:none}
.dshw-head{min-height:56px;padding:9px 12px}
.dshw-scroll{padding:8px 8px 16px}
.dshw-chip--run{color:var(--dsw-alias-brand-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 55%,transparent);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 9%,transparent)}
.dshw-dot--run{background:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,transparent)}
.dshw-dot--pending{background:var(--dsw-alias-state-warn-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-warn-primary) 18%,transparent)}
.dshw-pane-head{min-height:56px;padding:9px 18px}
.dshw-pane-heading{display:flex;align-items:center;gap:8px;min-width:0;flex:1}
.dshw-pane-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}
.dshw-pane-body{padding:20px 24px 36px}
.dshw-detail{width:min(100%,960px);margin:0 auto}
.dshw-mini.dshw-pane-back{display:none}
.dshw-btn,.dshw-btn--primary,.dshw-mini,.dshw-icon-btn{min-height:32px;border:1px solid transparent;border-radius:8px;font:inherit;font-size:12px;cursor:pointer;transition:background .14s,border-color .14s,color .14s,opacity .14s}
.dshw-btn{padding:0 12px;background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary)}
.dshw-btn:hover{border-color:var(--dsw-alias-brand-primary);background:var(--wt-hover)}
.dshw-btn--primary{padding:0 14px;background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#4176e6));color:var(--dsw-alias-label-primary-inverted,#fff);border-color:transparent;font-weight:600}
.dshw-btn--primary:hover{filter:brightness(1.06)}
.dshw-btn--danger{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 45%,var(--dsw-alias-border-l1));background:transparent}
.dshw-btn--danger:hover{border-color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,transparent)}
.dshw-btn:disabled,.dshw-btn--primary:disabled,.dshw-mini:disabled,.dshw-icon-btn:disabled{opacity:.5;cursor:default;filter:none}
.dshw-mini,.dshw-icon-btn{width:32px;min-width:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;background:transparent;color:var(--dsw-alias-label-secondary)}
.dshw-mini:hover,.dshw-icon-btn:hover{background:var(--wt-hover);border-color:var(--wt-edge);color:var(--dsw-alias-label-primary)}
.dshw-text-btn{display:inline;padding:0;border:0;background:none;color:var(--dsw-alias-brand-primary);font:inherit;font-size:inherit;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.dshw-app :is(button,input,select,textarea,[tabindex]):focus-visible,.dshw-modal :is(button,input,select,textarea,[tabindex]):focus-visible,.dshw-settings :is(button,input,select,textarea,[tabindex]):focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dshw-proj{display:grid;grid-template-columns:32px minmax(0,1fr) auto;align-items:center;gap:4px;padding:3px 6px;cursor:default}
.dshw-proj:hover{background:var(--wt-hover)}
.dshw-proj--on{background:var(--wt-selected);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 60%,var(--wt-edge));box-shadow:inset 3px 0 0 var(--dsw-alias-brand-primary)}
.dshw-proj-select{display:flex;align-items:center;gap:8px;min-width:0;width:100%;padding:7px 4px;border:0;border-radius:6px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.dshw-proj-name{flex:1;display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600;line-height:1.4}
.dshw-badge{flex:0 0 auto;font-size:11px;min-width:24px;text-align:center;padding:2px 7px}
.dshw-caret{width:32px;height:32px;font-size:12px;border-radius:7px}
.dshw-caret:hover{background:var(--wt-hover);color:var(--dsw-alias-label-primary)}
.dshw-addtask{min-height:28px;height:28px;padding:0 9px;font-size:12px;border-radius:7px}
.dshw-addtask:hover{background:var(--wt-hover)}
.dshw-tree{display:flex;flex-direction:column;gap:2px;padding:2px 2px 10px}
.dshw-task{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:stretch;border:1px solid transparent;border-radius:9px;background:none;transition:background .12s,border-color .12s}
.dshw-task:hover{background:var(--wt-hover)}
.dshw-task--on{background:var(--wt-selected);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 55%,var(--wt-edge));box-shadow:inset 3px 0 0 var(--dsw-alias-brand-primary)}
.dshw-task-select{min-width:0;padding:8px 6px 8px 29px;border:0;border-radius:9px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.dshw-task-select:only-child{grid-column:1/-1}
.dshw-task-top{display:flex;align-items:center;gap:7px;min-width:0}
.dshw-task-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:1.45}
.dshw-task-meta{display:flex;flex-wrap:wrap;align-items:center;gap:5px 8px;margin-top:5px;padding-left:15px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.4}
.dshw-task-meta .dshw-chip{font-size:11px;padding:2px 7px}
.dshw-task-open{align-self:center;margin-right:4px;color:var(--dsw-alias-label-secondary)}
.dshw-summary{background:var(--wt-surface);border:1px solid var(--wt-edge);border-radius:12px;padding:16px}
.dshw-summary-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.dshw-summary-copy{min-width:0;flex:1}
.dshw-summary-label{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:11px;font-weight:600;letter-spacing:.05em;color:var(--dsw-alias-label-secondary);text-transform:uppercase}
.dshw-summary .dshw-desc{font-size:13px;line-height:1.7}
.dshw-summary-actions{display:flex;flex:0 0 auto;flex-wrap:wrap;gap:8px;justify-content:flex-end}
.dshw-group{border-radius:12px;margin-top:14px}
.dshw-group-title{font-size:12px;letter-spacing:.02em;padding:11px 14px}
.dshw-group--danger{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 38%,var(--wt-edge))}
.dshw-group--danger>.dshw-group-title{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 7%,var(--wt-nested))}
.dshw-row{display:grid;grid-template-columns:minmax(88px,120px) minmax(0,1fr);gap:10px;padding:10px 14px;align-items:baseline}
.dshw-row-v{font-size:13px;line-height:1.55;word-break:normal;overflow-wrap:anywhere}
.dshw-row-v:only-child{grid-column:1/-1}
.dshw-row-tag{font-size:12px;line-height:1.55;min-width:0}
.dshw-row--stack{display:flex;flex-direction:column;align-items:stretch;gap:6px}
.dshw-feedback{margin-top:12px;padding:10px 12px;border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 7%,transparent);border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 28%,transparent);font-size:12px;line-height:1.5}
.dshw-feedback--ok{color:var(--dsw-alias-state-success-primary,var(--dsw-alias-label-primary));background:color-mix(in srgb,var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary)) 7%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary)) 28%,transparent)}
.dshw-empty{display:flex;flex-direction:column;align-items:center;gap:12px;padding:36px 20px;font-size:13px;line-height:1.6}
.dshw-form{display:grid;gap:14px;padding:14px}
.dshw-form .dshw-actions{justify-content:flex-end;margin-top:2px}
.dshw-field>label{font-size:12px;font-weight:600;line-height:1.4}
.dshw-field-required{color:var(--dsw-alias-state-error-primary);margin-left:2px}
.dshw-field-error{margin:1px 0 0;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:1.45}
.dshw-field-hint{margin:1px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.45}
.dshw-input-group{display:flex;align-items:center;gap:8px}
.dshw-input-group .dshw-input{flex:1;min-width:0}
.dshw-modal{width:min(680px,calc(100vw - 32px));max-height:min(84vh,760px);border-radius:14px}
.dshw-modal-head{padding:15px 18px}
.dshw-modal-head h3{font-size:16px;line-height:1.4}
.dshw-modal-body{padding:18px;gap:14px}
.dshw-modal-foot{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--wt-sep);background:var(--wt-nested)}
.dshw-check{min-height:30px;cursor:pointer}
.dshw-recents-list{margin:0;padding:0;list-style:none;display:grid;gap:1px}
.dshw-recents-list li{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:8px 14px;color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
.dshw-recents-list li+li{border-top:1px solid var(--wt-sep)}
.dshw-grp-title{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.dshw-grp{padding:14px}
.dshw-settings{max-width:860px}
.dshw-turn-head{min-height:30px;padding:4px 0}
.dshw-todos li{font-size:12px}
.dshw-todo-text{min-width:0;overflow-wrap:anywhere}
.dshw-turn-resp{overflow-wrap:anywhere}
.dshw-head-actions{display:flex;align-items:center;gap:4px;flex:0 0 auto}
.dshw-live-row{display:flex;align-items:center;gap:8px;width:100%}
.dshw-token-list{display:flex;flex-wrap:wrap;gap:4px 12px}
.dshw-inline{display:inline-flex;align-items:center;gap:8px}
.dshw-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}
@container dshw (max-width: 860px){
  .dshw-app{grid-template-columns:268px minmax(0,1fr)}
  .dshw-pane-body{padding:16px 18px 28px}
  .dshw-row{grid-template-columns:minmax(76px,100px) minmax(0,1fr)}
}
@container dshw (max-width: 620px){
  .dshw-app{grid-template-columns:minmax(0,1fr)}
  .dshw-app--detail .dshw-list,.dshw-app:not(.dshw-app--detail) .dshw-pane{display:none}
  .dshw-list{border-right:0}
  .dshw-mini.dshw-pane-back{display:inline-flex}
  .dshw-mini.dshw-pane-close{display:none}
  .dshw-pane-head{padding:9px 12px}
  .dshw-pane-body{padding:14px 12px 28px}
  .dshw-head{min-height:52px}
  .dshw-summary{padding:14px}
  .dshw-summary-top{flex-direction:column}
  .dshw-summary-actions{width:100%;justify-content:stretch}
  .dshw-summary-actions .dshw-btn--primary{width:100%}
}
@container dshw (max-width: 420px){
  .dshw-row{display:block;padding:10px 12px}
  .dshw-row-tag{margin-bottom:3px}
  .dshw-row+.dshw-row{border-top:1px solid var(--wt-sep)}
  .dshw-proj{grid-template-columns:30px minmax(0,1fr) auto}
  .dshw-proj .dshw-addtask{grid-column:2/-1;justify-self:start;margin:0 0 4px 4px}
  .dshw-modal{width:calc(100vw - 20px);max-height:calc(100vh - 20px)}
}
@supports not (color: color-mix(in srgb, white, black)){
  .dshw-app{--wt-nested:var(--dsw-alias-bg-layer-2);--wt-sep:var(--dsw-alias-border-l1);--wt-hover:var(--dsw-alias-bg-layer-2);--wt-selected:var(--dsw-alias-bg-layer-2);--wt-edge:var(--dsw-alias-border-l1);--wt-page:var(--dsw-alias-bg-base);--wt-rail:var(--dsw-alias-bg-layer-1)}
}
@media (prefers-reduced-motion: reduce){
  .dshw-app *,.dshw-modal *,.dshw-settings *{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important;animation-iteration-count:1!important}
}
`

function fmtTime(ts: number | null | undefined): string {
  if (!ts) return '—'
  const d = new Date(ts)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff >= 0 && diff < 60_000) return '<1m'
  if (diff >= 0 && diff < 3600_000) return Math.floor(diff / 60_000) + 'm'
  if (diff >= 0 && diff < 86400_000) return Math.floor(diff / 3600_000) + 'h'
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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

function statusTone(status: string): string {
  if (status === 'developing' || status === 'reviewing') return 'dshw-chip--run'
  if (status === 'review') return 'dshw-chip--warn'
  if (status === 'merged') return 'dshw-chip--ok'
  if (status === 'ready' || status === 'cleaned') return ''
  return 'dshw-chip--err'
}

/** factory(require) is called by window.__ModuleLoader__ with a module resolver. */
export function factory(require: Req) {
  ;(window as any).__dshwStage = (window as any).__dshwStage || []; (window as any).__dshwStage.push('factory-entered')
  try { console.log('[dshw] factory entered') } catch {}

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

  /** Native <select> for a branch list: the OS renders the popup, so it can never be misplaced. */
  function branchSelect(t: any, value: string, onChange: (v: string) => void, branchInfo: any, extraProps?: any) {
    const list: any[] = (branchInfo && branchInfo.branches) || []
    const known = list.some((b: any) => b.name === value)
    return h('select', Object.assign({ className: 'dshw-input', value: value, onChange: (e: any) => onChange(e.target.value) }, extraProps || {}),
      !value ? h('option', { value: '', disabled: true }, t.baseBranch) : null,
      value && !known ? h('option', { value }, value) : null,
      list.map((b: any) => h('option', { key: b.name, value: b.name }, b.name + (b.current ? '  ●' : ''))))
  }

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

  function StatusChip(props: { status: string; running: boolean | null; t: any }) {
    const t = props.t
    if (props.running) return h('span', { className: 'dshw-chip dshw-chip--run' }, t.sessionRunning)
    const label = (t as any)[props.status] || props.status
    return h('span', { className: 'dshw-chip ' + statusTone(props.status) }, label)
  }

  function Modal(props: { t: any; title: any; busy?: boolean; onClose: () => void; actions?: any; children: any }) {
    const dialogRef = React.useRef(null)
    const titleId = React.useRef('dshw-modal-title-' + uuid()).current
    const busyRef = React.useRef(!!props.busy)
    const closeRef = React.useRef(props.onClose)
    busyRef.current = !!props.busy
    closeRef.current = props.onClose

    React.useEffect(() => {
      const previous = document.activeElement as HTMLElement | null
      const node = dialogRef.current
      const focusables = () => {
        if (!node) return [] as HTMLElement[]
        return (Array.from(node.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')) as HTMLElement[])
          .filter((el: HTMLElement) => el.getClientRects().length > 0)
      }
      const focusTimer = window.requestAnimationFrame(() => {
        const preferred = node && node.querySelector('input:not([disabled]),select:not([disabled]),textarea:not([disabled])')
        const activeInside = node && node.contains(document.activeElement)
        if (!activeInside) (preferred || focusables()[0] || node)?.focus()
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
        if (e.shiftKey && document.activeElement === first) {
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
        if (previous && typeof previous.focus === 'function') window.requestAnimationFrame(() => previous.focus())
      }
    }, [])

    return h('div', { className: 'dshw-modal-backdrop', onClick: (e: any) => { if (e.target === e.currentTarget && !props.busy) props.onClose() } },
      h('div', {
        ref: dialogRef,
        className: 'dshw-modal',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': titleId,
        'aria-busy': props.busy ? 'true' : undefined,
        tabIndex: -1,
      },
        h('div', { className: 'dshw-modal-head' },
          h('h3', { id: titleId }, props.title),
          h('button', { className: 'dshw-mini', onClick: props.onClose, disabled: props.busy, 'aria-label': props.t.close }, '✕')),
        h('div', { className: 'dshw-modal-body' }, props.children),
        props.actions ? h('div', { className: 'dshw-modal-foot' }, props.actions) : null))
  }

  function Field(props: { id: string; label: any; required?: boolean; hint?: any; error?: any; children: any }) {
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
      h('label', { htmlFor: props.id }, props.label, props.required ? h('span', { className: 'dshw-field-required', 'aria-hidden': 'true' }, ' *') : null),
      control,
      props.hint ? h('div', { className: 'dshw-field-hint', id: hintId }, props.hint) : null,
      props.error ? h('div', { className: 'dshw-field-error', id: errorId, role: 'alert' }, props.error) : null)
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
          .then((data: any) => { if (!cancelled) setState({ status: 'success', data, error: '' }) })
          .catch((e: any) => { if (!cancelled) setState({ status: 'error', data: null, error: (e && e.message) || '' }) })
      }, delay)
      return () => {
        cancelled = true
        clearTimeout(timer)
      }
    }, [repoPath, delay, attempt])
    return Object.assign({}, state, { retry: () => setAttempt((n: number) => n + 1) })
  }

  /** Publish form, prefilled from the owning project. */
  ;(window as any).__dshwStage = (window as any).__dshwStage || []; (window as any).__dshwStage.push("stage-A-publish")
  function PublishModal(props: { t: any; project: any; onClose: () => void; onPublished: () => void }) {
    const t = props.t
    const remotes = appCtx && appCtx.remote
    const project = props.project
    const branches = useBranchInfo(project.repoPath)
    const [baseBranch, setBaseBranch] = React.useState(project.baseBranch || '')
    const [branchName, setBranchName] = React.useState('')
    const [title, setTitle] = React.useState('')
    const [description, setDescription] = React.useState('')
    const [start, setStart] = React.useState(true)
    const [busy, setBusy] = React.useState(false)
    const [err, setErr] = React.useState('')
    const [fieldErrors, setFieldErrors] = React.useState({} as any)

    React.useEffect(() => {
      const d = branches.data
      if (!d) return
      setBaseBranch((prev: string) => prev || d.current || d.default || (d.branches && d.branches[0] && d.branches[0].name) || '')
    }, [branches.data])

    const clearFieldError = (name: string) => {
      setFieldErrors((prev: any) => (prev[name] ? Object.assign({}, prev, { [name]: '' }) : prev))
    }

    const submit = async () => {
      if (busy) return
      setErr('')
      const next: any = {}
      if (!title.trim()) next.title = t.requiredField
      if (!description.trim()) next.description = t.requiredField
      setFieldErrors(next)
      if (Object.keys(next).length) {
        const firstId = next.title ? 'dshw-publish-title' : 'dshw-publish-description'
        window.requestAnimationFrame(() => document.getElementById(firstId)?.focus())
        return
      }
      setBusy(true)
      try {
        const r = await post('publish', {
          projectId: project.id,
          baseBranch: baseBranch || undefined,
          title: title.trim(),
          description,
          branchName: branchName.trim() || undefined,
          start,
        })
        const task = r.task
        if (start && remotes && remotes.session) {
          try {
            await bindSession(remotes, task, project.name)
          } catch (e: any) {
            setErr((e && e.message) || t.failed)
            setBusy(false)
            props.onPublished()
            return
          }
        }
        setBusy(false)
        props.onPublished()
        props.onClose()
      } catch (e: any) {
        setErr((e && e.message) || t.failed)
        setBusy(false)
      }
    }

    const branchHint = branches.status === 'loading'
      ? t.loadingBranches
      : branches.status === 'error'
        ? h('span', null, t.loadBranchesFailed, ' ', h('button', { type: 'button', className: 'dshw-text-btn', onClick: branches.retry }, t.retry))
        : null
    const branchControl = branches.data
      ? branchSelect(t, baseBranch, setBaseBranch, branches.data)
      : h('input', { className: 'dshw-input', value: baseBranch, onChange: (e: any) => setBaseBranch(e.target.value), placeholder: t.baseBranch })
    const actions = [
      h('button', { key: 'cancel', className: 'dshw-btn', type: 'button', onClick: props.onClose, disabled: busy }, t.cancel),
      h('button', { key: 'submit', className: 'dshw-btn--primary', type: 'button', onClick: submit, disabled: busy }, busy ? t.publishing : t.publish),
    ]

    return h(Modal, { t, title: t.publish + ' · ' + project.name, busy, onClose: props.onClose, actions },
      h('div', { className: 'dshw-field' },
        h('label', null, t.repoPath),
        h('div', { className: 'dshw-field-hint dshw-mono' }, project.repoPath)),
      h(Field, { id: 'dshw-publish-base', label: t.baseBranch, hint: branchHint }, branchControl),
      h(Field, { id: 'dshw-publish-branch', label: t.branchName },
        h('input', { className: 'dshw-input', value: branchName, placeholder: t.branchNameHint, onChange: (e: any) => setBranchName(e.target.value) })),
      h(Field, { id: 'dshw-publish-title', label: t.taskTitle, required: true, error: fieldErrors.title },
        h('input', { className: 'dshw-input', value: title, autoFocus: true, 'aria-invalid': fieldErrors.title ? 'true' : undefined, onChange: (e: any) => { setTitle(e.target.value); clearFieldError('title') } })),
      h(Field, { id: 'dshw-publish-description', label: t.taskDescription, required: true, error: fieldErrors.description },
        h('textarea', { className: 'dshw-input', value: description, 'aria-invalid': fieldErrors.description ? 'true' : undefined, onChange: (e: any) => { setDescription(e.target.value); clearFieldError('description') } })),
      h('label', { className: 'dshw-check' },
        h('input', { type: 'checkbox', checked: start, onChange: (e: any) => setStart(e.target.checked) }),
        t.startNow),
      err ? h('div', { className: 'dshw-feedback', role: 'alert' }, err) : null)
  }

  /** Add-project form: pick a repo directory, name it, choose the default base branch. */
  function ProjectModal(props: { t: any; onClose: () => void; onAdded: () => void }) {
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
        } else if (r && r.ok === false) setErr(r.error && (r.error.message || r.error.code) ? String(r.error.message || r.error.code) : t.failed)
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
      if (busy) return
      setErr('')
      const next: any = {}
      if (!repoPath.trim()) next.repoPath = t.requiredField
      if (!baseBranch.trim()) next.baseBranch = t.requiredField
      setFieldErrors(next)
      if (Object.keys(next).length) {
        const id = next.repoPath ? 'dshw-project-repo' : 'dshw-project-base'
        window.requestAnimationFrame(() => document.getElementById(id)?.focus())
        return
      }
      setBusy(true)
      try {
        await post('projects/add', {
          repoPath: repoPath.trim(),
          name: name.trim() || undefined,
          baseBranch: baseBranch.trim(),
        })
        setBusy(false)
        props.onAdded()
        props.onClose()
      } catch (e: any) {
        setErr((e && e.message) || t.failed)
        setBusy(false)
      }
    }

    const branchHint = !repoPath.trim()
      ? null
      : branches.status === 'loading'
        ? t.loadingBranches
        : branches.status === 'error'
          ? h('span', null, t.loadBranchesFailed, ' ', h('button', { type: 'button', className: 'dshw-text-btn', onClick: branches.retry }, t.retry))
          : null
    const branchControl = branches.data
      ? branchSelect(t, baseBranch, chooseBase, branches.data)
      : h('input', { className: 'dshw-input', value: baseBranch, onChange: (e: any) => chooseBase(e.target.value), placeholder: t.baseBranch })
    const branchMissing = !!repoPath.trim() && !baseBranch.trim()
    const actions = [
      h('button', { key: 'cancel', className: 'dshw-btn', type: 'button', onClick: props.onClose, disabled: busy }, t.cancel),
      h('button', { key: 'submit', className: 'dshw-btn--primary', type: 'button', onClick: submit, disabled: busy || branchMissing }, busy ? t.addProject + '…' : t.addProject),
    ]

    return h(Modal, { t, title: t.addProject, busy, onClose: props.onClose, actions },
      h('div', { className: 'dshw-field' },
        h('label', { htmlFor: 'dshw-project-repo' }, t.repoPath, h('span', { className: 'dshw-field-required', 'aria-hidden': 'true' }, ' *')),
        h('div', { className: 'dshw-input-group' },
          h('input', {
            id: 'dshw-project-repo',
            className: 'dshw-input',
            value: repoPath,
            placeholder: t.repoPathHint,
            autoFocus: true,
            'aria-required': 'true',
            'aria-invalid': fieldErrors.repoPath ? 'true' : undefined,
            'aria-describedby': fieldErrors.repoPath ? 'dshw-project-repo-error' : undefined,
            onChange: (e: any) => { setRepoPath(e.target.value); setBaseBranch(''); if (fieldErrors.repoPath) setFieldErrors({}) },
          }),
          h('button', {
            type: 'button',
            className: 'dshw-btn',
            disabled: picking,
            'aria-busy': picking ? 'true' : undefined,
            onPointerDown: browseFromPointer,
            onClick: (e: any) => { if (e.detail === 0) void browse() },
          }, picking ? t.pickingDirectory : t.browse)),
        fieldErrors.repoPath ? h('div', { className: 'dshw-field-error', id: 'dshw-project-repo-error', role: 'alert' }, fieldErrors.repoPath) : null),
      h(Field, { id: 'dshw-project-name', label: t.projectName },
        h('input', { className: 'dshw-input', value: name, placeholder: baseName(repoPath) || t.projectName, onChange: (e: any) => setName(e.target.value) })),
      h(Field, { id: 'dshw-project-base', label: t.defaultBase, required: true, hint: branchHint, error: fieldErrors.baseBranch }, branchControl),
      err ? h('div', { className: 'dshw-feedback', role: 'alert' }, err) : null)
  }


  /** Right pane for a selected project: detail, editable settings, add-task, delete. */
  ;(window as any).__dshwStage = (window as any).__dshwStage || []; (window as any).__dshwStage.push("stage-B-pane")
  /** One row inside a group; the group draws hairline separators between rows. */
  function Row(key: string, value: any, label?: string) {
    return h('div', { className: 'dshw-row', key, title: label },
      label ? h('span', { className: 'dshw-row-tag' }, label) : null,
      h('div', { className: 'dshw-row-v' }, value))
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

  const todoCls = (status: string) => (status === 'in_progress' ? 'dshw-todo--doing' : status === 'completed' ? 'dshw-todo--done' : '')

  function LiveRows(props: { t: any; live: any; running: boolean | null; task: any; pendingKind?: string | null }) {
    const t = props.t
    const L = props.live
    const [expanded, setExpanded] = React.useState(null)
    if (!L) return [Row('lv-none', '—')]
    const model = jp(L.modelSelection)
    const cwd = jp(L.workingDirectory)
    const pressure = jp(L.contextPressure)
    const tokens = jp(L.tokenUsage)
    const stats = jp(L.sessionStats)
    const todos = jp(L.todos)
    const turns = jp(L.turnOutline)
    const inbox = jp(L.inbox)
    const subs = jp(L.subagentCatalog)
    const perms = jp(L.permissions)
    const meta = jp(L.sessionListMetadata)
    const questions = jp(L.userQuestions)
    const nextModel = model && model.next ? (model.next.provider + '/' + model.next.model) : null
    const cwdOff = cwd && props.task && String(cwd).toLowerCase() !== String(props.task.worktreePath).toLowerCase()
    const pct = pressure && pressure.contextWindow ? Math.min(100, Math.round(((pressure.projectedTokens || 0) / pressure.contextWindow) * 100)) : null
    const queued = inbox ? (inbox['next-turn'] || []).length + (inbox['next-step'] || []).length : 0
    const fmtK = (n: any) => (typeof n === 'number' && n > 0 ? (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n)) : null)
    const pendingLabel = props.pendingKind
      ? (t as any)['pending' + (props.pendingKind === 'approval' ? 'Approval' : props.pendingKind === 'plan-review' ? 'PlanReview' : 'Question')]
      : null
    const rows: any[] = []
    rows.push(Row('lv-status',
      props.pendingKind
        ? h('span', { className: 'dshw-chip dshw-chip--warn' }, pendingLabel)
        : props.running
          ? h('span', { className: 'dshw-chip dshw-chip--run' }, t.sessionRunning)
          : h('span', { className: 'dshw-chip' }, t.sessionIdle)))
    if (meta && meta.lastPromptAt) rows.push(Row('lv-act', fmtTime(meta.lastPromptAt), t.liveLastPrompt))
    if (nextModel) rows.push(Row('lv-model', nextModel, t.liveModel))
    if (perms && perms.currentValue) rows.push(Row('lv-perm', String(perms.currentValue), t.livePerms))
    if (cwd) rows.push(Row('lv-cwd', h('span', null, String(cwd), cwdOff ? h('span', { className: 'dshw-chip dshw-chip--warn' }, t.liveCwdOff) : null), t.liveCwd))
    if (pct !== null) rows.push(Row('lv-ctx', h('div', { className: 'dshw-live-row' },
      h('div', { className: 'dshw-pressure' }, h('span', { className: pct > 80 ? 'dshw-pressure--warn' : '', style: { width: pct + '%' } })),
      h('span', { className: 'dshw-hint' }, pct + '%')), t.livePressure))
    if (tokens && (fmtK(tokens.uncachedInputTokens) || fmtK(tokens.outputTokens)))
      rows.push(Row('lv-token', h('span', { className: 'dshw-token-list' },
        fmtK(tokens.uncachedInputTokens) ? h('span', null, t.liveTokensIn + ' ' + fmtK(tokens.uncachedInputTokens)) : null,
        fmtK(tokens.outputTokens) ? h('span', null, t.liveTokensOut + ' ' + fmtK(tokens.outputTokens)) : null,
        fmtK(tokens.cacheReadTokens) ? h('span', null, t.liveTokensCache + ' ' + fmtK(tokens.cacheReadTokens)) : null), t.liveTokens))
    if (stats && (stats.turns || stats.steps))
      rows.push(Row('lv-stats', (t.liveStats || '').replace('{turns}', String(stats.turns || 0)).replace('{steps}', String(stats.steps || 0))))
    if (queued > 0) rows.push(Row('lv-q', String(queued), t.liveQueued))
    if (Array.isArray(subs) && subs.length > 0) rows.push(Row('lv-subs', String(subs.length), t.liveSubagents))
    if (questions && Array.isArray(questions.active) && questions.active.length > 0)
      rows.push(Row('lv-q2', h('span', { className: 'dshw-chip dshw-chip--warn' }, t.pendingQuestion), t.pendingQuestion))
    if (Array.isArray(todos) && todos.length > 0) {
      rows.push(h('div', { key: 'todos', className: 'dshw-row' },
        h('span', { className: 'dshw-row-tag' }, t.liveTodos),
        h('div', { className: 'dshw-row-v' },
          h('ul', { className: 'dshw-todos' },
            todos.map((td: any, i: number) => {
              const ico = td.status === 'in_progress' ? '▸' : td.status === 'completed' ? '✓' : '○'
              return h('li', { key: i, className: todoCls(td.status) },
                h('span', { className: 'dshw-todo-ico', 'aria-hidden': 'true' }, ico),
                h('span', { className: 'dshw-todo-text' }, String(td.content)))
            })))))
    }
    if (Array.isArray(turns) && turns.length > 0) {
      rows.push(h('div', { key: 'turns', className: 'dshw-row dshw-row--stack' },
        h('span', { className: 'dshw-row-tag' }, t.liveTurns),
        turns.slice(-5).map((tr: any) => {
          const isOpen = expanded === tr.turn
          const responseId = 'dshw-turn-response-' + String(tr.turn)
          const promptText = String(tr.prompt || '').replace(/\s+/g, ' ')
          return h('div', { key: tr.turn, className: 'dshw-turn' },
            h('button', {
              className: 'dshw-turn-head',
              'aria-expanded': isOpen,
              'aria-controls': responseId,
              onClick: () => setExpanded(isOpen ? null : tr.turn),
            },
              h('span', { className: 'dshw-turn-n' }, (t.liveTurnN || '').replace('{n}', String(tr.turn))),
              h('span', { className: 'dshw-turn-prompt' }, promptText.slice(0, 90) + (promptText.length > 90 ? '…' : ''))),
            isOpen && tr.response ? h('div', { className: 'dshw-turn-resp', id: responseId }, String(tr.response).length > 800 ? String(tr.response).slice(0, 800) + '…' : String(tr.response)) : null)
        })))
    }
    return rows
  }

  function DetailPane(props: { view: any; running: boolean | null; t: any; onChanged: () => void; onOpenSession?: () => boolean | void; onCreateSession?: () => Promise<any> | any; pendingKind?: string | null; live?: any }) {
    const t = props.t
    const v = props.view
    const task = v.task
    const snap = v.snapshot
    const [busy, setBusy] = React.useState('')
    const [err, setErr] = React.useState('')
    const [delBranch, setDelBranch] = React.useState(false)
    const [force, setForce] = React.useState(false)

    const act = async (name: string, fn: () => Promise<any>) => {
      if (busy) return
      setBusy(name)
      setErr('')
      try {
        await fn()
        await props.onChanged()
      } catch (e: any) {
        setErr((e && e.message) || t.failed)
      } finally {
        setBusy('')
      }
    }
    const act_ = (name: string, path: string, body: any) => act(name, () => post(path, Object.assign({ id: task.id }, body)))
    const busyLabel = (name: string, label: string) => (busy === name ? label + '…' : label)

    const canCheckout = snap.status === 'ready' || snap.status === 'developing' || snap.status === 'review'
    const canBack = !!task.originalBranch && snap.status !== 'cleaned'
    const canMerge = snap.status !== 'cleaned' && snap.status !== 'merged' && snap.worktree.exists
    const canCleanup = snap.status !== 'cleaned'
    const dirtyChip = (n: number) => h('span', { className: 'dshw-chip dshw-chip--warn' }, n + ' ' + t.dirty)
    const pendingLabel = props.pendingKind
      ? (t as any)['pending' + (props.pendingKind === 'approval' ? 'Approval' : props.pendingKind === 'plan-review' ? 'PlanReview' : 'Question')]
      : null
    const statusNode = props.pendingKind
      ? h('span', { className: 'dshw-chip dshw-chip--warn' }, pendingLabel)
      : h(StatusChip, { status: snap.status, running: props.running, t })
    const sessionAction = task.sessionId
      ? props.onOpenSession
        ? h('button', {
          className: 'dshw-btn--primary',
          type: 'button',
          onClick: () => {
            const opened = props.onOpenSession?.()
            if (opened === false) setErr(t.openSessionFailed)
          },
        }, t.openSessionBtn)
        : null
      : canCleanup && props.onCreateSession
        ? h('button', { className: 'dshw-btn--primary', type: 'button', disabled: busy !== '', onClick: () => void act('session', props.onCreateSession as any) }, busyLabel('session', t.createSession))
        : null

    const liveRows = LiveRows({ t, live: props.live, running: props.running, task, pendingKind: props.pendingKind })
    const cleanupMessage = [
      t.confirmCleanup,
      task.branch ? task.branch : snap.worktree.branch,
      task.worktreePath,
      snap.worktree.dirtyCount > 0 ? snap.worktree.dirtyCount + ' ' + t.dirty : t.clean,
      delBranch ? t.deleteBranch : '',
    ].filter(Boolean).join('\n')

    return h('div', { className: 'dshw-detail' },
      h('section', { className: 'dshw-summary', 'aria-label': t.description },
        h('div', { className: 'dshw-summary-top' },
          h('div', { className: 'dshw-summary-copy' },
            h('div', { className: 'dshw-summary-label' },
              h('span', null, t.description),
              statusNode),
            h('div', { className: 'dshw-desc' }, task.description || '—')),
          sessionAction ? h('div', { className: 'dshw-summary-actions' }, sessionAction) : null)),
      err ? h('div', { className: 'dshw-feedback', role: 'alert' }, err) : null,
      h('div', { className: 'dshw-group' },
        h('div', { className: 'dshw-group-title' }, t.live),
        h('div', { className: 'dshw-rows' }, liveRows)),
      h('div', { className: 'dshw-group' },
        h('div', { className: 'dshw-group-title' }, t.session),
        h('div', { className: 'dshw-rows' },
          task.sessionId
            ? [
              Row('s-id', task.sessionId, t.sessionId),
              Row('s-status', h('span', { className: 'dshw-inline' },
                h('span', { className: 'dshw-dot ' + (props.pendingKind ? 'dshw-dot--pending' : props.running ? 'dshw-dot--run' : 'dshw-dot--off') }),
                props.pendingKind ? pendingLabel : props.running ? t.sessionRunning : t.sessionIdle), t.status),
            ]
            : [Row('s-none', h('span', { className: 'dshw-hint' }, t.noSession))])),
      h('div', { className: 'dshw-group' },
        h('div', { className: 'dshw-group-title' }, t.operations),
        h('div', { className: 'dshw-rows' },
          h('div', { className: 'dshw-row' },
            h('div', { className: 'dshw-row-v' },
              h('div', { className: 'dshw-actions' },
                canCheckout ? h('button', { className: 'dshw-btn', type: 'button', disabled: busy !== '', onClick: () => void act_('checkout', 'task/checkout', {}) }, busyLabel('checkout', t.checkout)) : null,
                canBack ? h('button', { className: 'dshw-btn', type: 'button', disabled: busy !== '', onClick: () => void act_('back', 'task/back', {}) }, busyLabel('back', t.back)) : null,
                canMerge ? h('button', {
                  className: 'dshw-btn',
                  type: 'button',
                  disabled: busy !== '',
                  onClick: () => {
                    if (window.confirm(t.confirmMerge + '\n' + (task.branch || snap.worktree.branch) + ' → ' + task.baseBranch)) void act_('merge', 'task/merge', {})
                  },
                }, busyLabel('merge', t.merge)) : null))))),
      h('div', { className: 'dshw-group' },
        h('div', { className: 'dshw-group-title' }, t.worktree),
        h('div', { className: 'dshw-rows' },
          Row('wt-path', task.worktreePath, t.path),
          Row('wt-branch', snap.worktree.branch || '—', t.currentBranch),
          Row('wt-ahead', h('span', null,
            String(snap.worktree.ahead),
            snap.worktree.dirtyCount > 0 ? dirtyChip(snap.worktree.dirtyCount) : null,
            snap.worktree.dirtyCount === 0 && snap.worktree.exists ? h('span', { className: 'dshw-hint' }, t.clean) : null), t.commitsAhead),
          Row('wt-base', task.baseBranch, t.baseBranch),
          Row('wt-git', snap.merged ? t.mergedFlag : snap.branchExists ? (snap.worktree.exists ? '—' : t.branchMissing) : t.branchMissing, t.status))),
      h('div', { className: 'dshw-group' },
        h('div', { className: 'dshw-group-title' }, t.mainRepo),
        h('div', { className: 'dshw-rows' },
          Row('repo-path', task.repoPath, t.repoPath),
          Row('repo-branch', snap.repo.currentBranch || '—', t.currentBranch),
          task.originalBranch ? Row('repo-orig', task.originalBranch, t.originalBranch) : null,
          snap.repo.dirtyCount > 0 ? Row('repo-dirty', dirtyChip(snap.repo.dirtyCount)) : null)),
      h('div', { className: 'dshw-group dshw-group--danger' },
        h('div', { className: 'dshw-group-title' }, t.dangerZone),
        h('div', { className: 'dshw-rows' },
          h('div', { className: 'dshw-row dshw-row--stack' },
            h('div', { className: 'dshw-actions' },
              canCleanup ? h('button', {
                className: 'dshw-btn dshw-btn--danger',
                type: 'button',
                disabled: busy !== '',
                onClick: () => {
                  if (window.confirm(cleanupMessage)) void act_('cleanup', 'task/cleanup', { force, deleteBranch: delBranch })
                },
              }, busyLabel('cleanup', t.cleanup)) : null,
              h('button', {
                className: 'dshw-btn dshw-btn--danger',
                type: 'button',
                disabled: busy !== '',
                onClick: () => { if (window.confirm(t.confirmDelete)) void act_('delete', 'task/delete', {}) },
              }, busyLabel('delete', t.deleteRecord))),
            canCleanup ? h('div', { className: 'dshw-actions' },
              h('label', { className: 'dshw-check' }, h('input', { type: 'checkbox', checked: force, onChange: (e: any) => setForce(e.target.checked) }), t.force),
              h('label', { className: 'dshw-check' }, h('input', { type: 'checkbox', checked: delBranch, onChange: (e: any) => setDelBranch(e.target.checked) }), t.deleteBranch)) : null))))
  }

  function ProjectPane(props: { view: any; t: any; onChanged: () => void }) {
    const t = props.t
    const v = props.view
    const project = v.project
    const [name, setName] = React.useState(project.name)
    const [baseBranch, setBaseBranch] = React.useState(project.baseBranch || '')
    const [dirName, setDirName] = React.useState(project.dirName || '')
    const [branchPrefix, setBranchPrefix] = React.useState(project.branchPrefix || '')
    const branches = useBranchInfo(project.repoPath)
    const [withTasks, setWithTasks] = React.useState(false)
    const [busy, setBusy] = React.useState('')
    const [msg, setMsg] = React.useState('')
    const [err, setErr] = React.useState('')

    const act = async (label: string, fn: () => Promise<any>) => {
      if (busy) return
      setBusy(label)
      setErr('')
      setMsg('')
      try {
        await fn()
        await props.onChanged()
      } catch (e: any) {
        setErr((e && e.message) || t.failed)
      } finally {
        setBusy('')
      }
    }

    const save = () => act('save', async () => {
      await post('projects/update', {
        id: project.id,
        name,
        baseBranch,
        dirName,
        branchPrefix,
      }, )
      setMsg(t.saved)
    })

    const remove = () => act('del', async () => {
      await post('projects/delete', { id: project.id, withTasks }, )
    })

    const statusLine = Object.entries(v.stats.byStatus).map(([k, n]) => ((t as any)[k] || k) + ' ' + n).join(' · ')
    const branchHint = branches.status === 'loading'
      ? t.loadingBranches
      : branches.status === 'error'
        ? h('span', null, t.loadBranchesFailed, ' ', h('button', { type: 'button', className: 'dshw-text-btn', onClick: branches.retry }, t.retry))
        : null
    const branchControl = branches.data
      ? branchSelect(t, baseBranch, setBaseBranch, branches.data)
      : h('input', { className: 'dshw-input', value: baseBranch, onChange: (e: any) => setBaseBranch(e.target.value), placeholder: t.baseBranch })

    return h('div', { className: 'dshw-detail' },
      h('div', { className: 'dshw-group' },
        h('div', { className: 'dshw-group-title' }, t.overview),
        h('div', { className: 'dshw-rows' },
          Row('pj-path', project.repoPath, t.repoPath),
          Row('pj-base', project.baseBranch || '—', t.defaultBase),
          Row('pj-tasks', String(v.stats.tasks) + (statusLine ? ' · ' + statusLine : ''), t.tasksUnit),
          Row('pj-dir', project.dirName || '.dsh-worktrees', t.worktreeDirName))),
      h('div', { className: 'dshw-group' },
        h('div', { className: 'dshw-group-title' }, t.projectSettings),
        h('div', { className: 'dshw-form' },
          h(Field, { id: 'dshw-project-settings-name', label: t.projectName },
            h('input', { className: 'dshw-input', value: name, onChange: (e: any) => setName(e.target.value) })),
          h(Field, { id: 'dshw-project-settings-base', label: t.defaultBase, hint: branchHint }, branchControl),
          h(Field, { id: 'dshw-project-settings-dir', label: t.worktreeDirName },
            h('input', { className: 'dshw-input', value: dirName, placeholder: '.dsh-worktrees', onChange: (e: any) => setDirName(e.target.value) })),
          h(Field, { id: 'dshw-project-settings-prefix', label: t.branchPrefix },
            h('input', { className: 'dshw-input', value: branchPrefix, placeholder: 'dsh-wt/', onChange: (e: any) => setBranchPrefix(e.target.value) })),
          h('div', { className: 'dshw-actions' },
            h('button', { className: 'dshw-btn--primary', type: 'button', disabled: busy !== '', onClick: save }, busy === 'save' ? t.saving : t.save)),
          msg ? h('div', { className: 'dshw-feedback dshw-feedback--ok', role: 'status' }, msg) : null),
        err && busy === '' ? h('div', { className: 'dshw-feedback', role: 'alert' }, err) : null),
      h('div', { className: 'dshw-group dshw-group--danger' },
        h('div', { className: 'dshw-group-title' }, t.deleteProject),
        h('div', { className: 'dshw-form' },
          h('div', { className: 'dshw-actions' },
            h('button', {
              className: 'dshw-btn dshw-btn--danger',
              type: 'button',
              disabled: busy !== '',
              onClick: () => {
                const message = t.deleteProject + ': ' + project.name + (withTasks ? '\n' + t.withTasks : '')
                if (window.confirm(message)) void remove()
              },
            }, busy === 'del' ? t.deleteProject + '…' : t.deleteProject),
            v.stats.tasks > 0 ? h('label', { className: 'dshw-check' },
              h('input', { type: 'checkbox', checked: withTasks, onChange: (e: any) => setWithTasks(e.target.checked) }),
              t.withTasks) : null))))
  }

  function BoardPage(props: any) {
    const t = props.__t
    useStyles()
    const [projectViews, setProjectViews] = React.useState([])
    const [loaded, setLoaded] = React.useState(false)
    const [err, setErr] = React.useState('')
    const [selectedProjectId, setSelectedProjectId] = React.useState('')
    const [selectedTaskId, setSelectedTaskId] = React.useState('')
    const [collapsed, setCollapsed] = React.useState({})
    const [publishFor, setPublishFor] = React.useState(null)
    const [projectModalOpen, setProjectModalOpen] = React.useState(false)
    const [sessionMap, setSessionMap] = React.useState({})
    const [pendingMap, setPendingMap] = React.useState({})
    const bindingRef = React.useRef(new Set())

    const remotes = appCtx && appCtx.remote

    // Debug/testing hook: lets the page inspect the Remote face (kept intentionally).
    try {
      ;(window as any).__dshwRemote = remotes
      const uiwsProbe = appCtx && appCtx.get && appCtx.get('uiWorkspace')
      ;(window as any).__dshwUiws = uiwsProbe
      ;(window as any).__dshwOpenSession = (id: string) => {
        const svc = (window as any).__dshwUiws
        if (!svc || typeof svc.openSession !== 'function') return { err: 'no uiWorkspace' }
        try {
          svc.openSession(id)
          return { ok: true }
        } catch (e: any) {
          return { err: String((e && (e.stack || e.message)) || e).slice(0, 400) }
        }
      }
    } catch {
      /* noop */
    }

    const refresh = React.useCallback(async () => {
      try {
        const d = await getJson('projects')
        setProjectViews(d.projects || [])
        setErr('')
      } catch (e: any) {
        setErr((e && e.message) || t.loadFailed)
      } finally {
        setLoaded(true)
      }
    }, [])

    React.useEffect(() => {
      refresh()
      const timer = setInterval(() => { void refresh() }, 4000)
      return () => clearInterval(timer)
    }, [refresh])

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
    }, [projectViews, remotes, refresh])

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
      const remotes = remotesRef.current
      if (!remotes || !liveSessionId) {
        setLive(null)
        return
      }
      let c = false
      const pull = async () => {
        try {
          const r = await remotes.session.projections({ sessionId: liveSessionId })
          if (!c && r && r.ok && r.value && r.value.values) setLive({ sessionId: liveSessionId, values: r.value.values })
        } catch {
          /* keep last */
        }
      }
      pull()
      const timer = setInterval(pull, 4000)
      return () => {
        c = true
        clearInterval(timer)
      }
    }, [liveSessionId])
    const liveValues = live && live.sessionId === liveSessionId ? live.values : null

    const selectProject = (id: string) => {
      setSelectedProjectId(id)
      setSelectedTaskId('')
      setCollapsed((c: any) => ({ ...c, [id]: false }))
    }
    const selectTask = (id: string) => {
      setSelectedTaskId(id)
      setSelectedProjectId('')
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
      if (!openTaskSession(sessionId)) selectTask(v.task.id)
      return sessionId
    }

    const afterChange = async () => {
      await refresh()
    }

    const projectRow = (pv: any) => {
      const isOpen = !collapsed[pv.project.id]
      const activeProject = selectedProjectId === pv.project.id && !selectedTaskId
      return h('div', { key: pv.project.id },
        h('div', { className: 'dshw-proj' + (activeProject ? ' dshw-proj--on' : '') },
          h('button', {
            className: 'dshw-caret',
            type: 'button',
            'aria-expanded': isOpen,
            'aria-label': (isOpen ? t.collapse : t.expand) + ': ' + pv.project.name,
            onClick: () => toggleCollapse(pv.project.id),
          }, isOpen ? '▾' : '▸'),
          h('button', {
            className: 'dshw-proj-select',
            type: 'button',
            title: pv.project.repoPath,
            'aria-current': activeProject ? 'true' : undefined,
            onClick: () => selectProject(pv.project.id),
          },
            h('span', { className: 'dshw-proj-name' }, pv.project.name),
            h('span', { className: 'dshw-badge' }, String(pv.stats.tasks))),
          h('button', {
            className: 'dshw-addtask',
            type: 'button',
            title: t.addTask,
            onClick: () => { setPublishFor(pv.project); selectProject(pv.project.id) },
          }, t.addTask)),
        isOpen && pv.tasks.length ? h('div', { className: 'dshw-tree' },
          pv.tasks.map((v: any) => {
            const pendingKind = v.task.sessionId ? pendingMap[v.task.sessionId] : null
            const running = runningOf(v.task)
            const active = selectedTaskId === v.task.id
            return h('div', {
              key: v.task.id,
              className: 'dshw-task' + (active ? ' dshw-task--on' : ''),
            },
              h('button', {
                className: 'dshw-task-select',
                type: 'button',
                onClick: () => selectTask(v.task.id),
                title: v.task.title,
                'aria-current': active ? 'true' : undefined,
              },
                h('span', { className: 'dshw-task-top' },
                  v.task.sessionId ? h('span', { className: 'dshw-dot ' + (pendingKind ? 'dshw-dot--pending' : running ? 'dshw-dot--run' : 'dshw-dot--off'), 'aria-hidden': 'true' }) : null,
                  h('span', { className: 'dshw-task-title' }, v.task.title)),
                h('span', { className: 'dshw-task-meta' },
                  pendingKind
                    ? h('span', { className: 'dshw-chip dshw-chip--warn' }, (t as any)['pending' + (pendingKind === 'approval' ? 'Approval' : pendingKind === 'plan-review' ? 'PlanReview' : 'Question')] || pendingKind)
                    : h(StatusChip, { status: v.snapshot.status, running, t }),
                  v.snapshot.worktree.ahead > 0 ? h('span', null, v.snapshot.worktree.ahead + ' ' + t.commitsAhead) : null,
                  v.snapshot.worktree.dirtyCount > 0 ? h('span', null, v.snapshot.worktree.dirtyCount + ' ' + t.dirty) : null)),
              v.task.sessionId ? h('button', {
                className: 'dshw-icon-btn dshw-task-open',
                type: 'button',
                title: t.openSessionBtn,
                'aria-label': t.openSessionBtn + ': ' + v.task.title,
                onClick: () => { openTaskSession(v.task.sessionId) },
              }, '↗') : null)
          })) : null)
    }

    const listNode = h('div', { className: 'dshw-list' },
      h('div', { className: 'dshw-head' },
        h('div', { className: 'dshw-head-title' },
          h('svg', { viewBox: '0 0 64 64', width: 20, height: 20, 'aria-hidden': true },
            h('g', { fill: 'none', stroke: 'currentColor', strokeWidth: 5, strokeLinecap: 'round' },
              h('circle', { cx: 20, cy: 18, r: 7 }),
              h('circle', { cx: 20, cy: 46, r: 7 }),
              h('circle', { cx: 45, cy: 32, r: 7 }),
              h('path', { d: 'M20 25v14' }),
              h('path', { d: 'M26 21c9 2 13 5 15 8' }))),
          h('span', null, t.title)),
        h('div', { className: 'dshw-head-actions' },
          h('button', { className: 'dshw-mini', type: 'button', title: t.refresh, 'aria-label': t.refresh, onClick: () => { void refresh() } }, '⟳'),
          h('button', { className: 'dshw-btn--primary', type: 'button', onClick: () => setProjectModalOpen(true) }, t.addProject))),
      err ? h('div', { className: 'dshw-feedback', role: 'alert' }, err) : null,
      h('div', { className: 'dshw-scroll' },
        !loaded ? h('div', { className: 'dshw-empty' }, t.loading)
          : projectViews.length === 0
            ? h('div', { className: 'dshw-empty' },
              h('span', null, t.noProjects),
              h('button', { className: 'dshw-btn--primary', type: 'button', onClick: () => setProjectModalOpen(true) }, t.addProject))
            : projectViews.map(projectRow)))

    const rightTitle = selectedTask ? selectedTask.task.title : selectedProject ? selectedProject.project.name : t.detail
    const rightClose = () => {
      setSelectedTaskId('')
      setSelectedProjectId('')
    }
    const paneNode = h('div', { className: 'dshw-pane' },
      h('div', { className: 'dshw-pane-head' },
        h('div', { className: 'dshw-pane-heading' },
          selectedTask || selectedProject ? h('button', {
            className: 'dshw-mini dshw-pane-back',
            type: 'button',
            onClick: rightClose,
            'aria-label': t.backToList,
            title: t.backToList,
          }, '←') : null,
          h('span', { className: 'dshw-pane-title', title: rightTitle }, rightTitle)),
        selectedTask || selectedProject ? h('button', { className: 'dshw-mini dshw-pane-close', type: 'button', onClick: rightClose, 'aria-label': t.close }, '✕') : null),
      h('div', { className: 'dshw-pane-body' },
        selectedTask
          ? h(DetailPane, {
            key: selectedTask.task.id,
            view: selectedTask,
            running: runningOf(selectedTask.task),
            t,
            onChanged: afterChange,
            onOpenSession: selectedTask.task.sessionId ? () => openTaskSession(selectedTask.task.sessionId) : undefined,
            onCreateSession: selectedTask.task.sessionId ? undefined : () => createTaskSession(selectedTask),
            pendingKind: selectedTask.task.sessionId ? pendingMap[selectedTask.task.sessionId] : null,
            live: liveValues,
          })
          : selectedProject
            ? h(ProjectPane, {
              key: selectedProject.project.id,
              view: selectedProject,
              t,
              onChanged: afterChange,
            })
            : h('div', { className: 'dshw-empty' }, t.selectTask)))

    const modalNode = [
      publishFor ? h(PublishModal, { key: 'pub', t, project: publishFor, onClose: () => setPublishFor(null), onPublished: () => { setPublishFor(null); void refresh() } }) : null,
      projectModalOpen ? h(ProjectModal, { key: 'proj', t, onClose: () => setProjectModalOpen(false), onAdded: () => { void refresh() } }) : null,
    ]

    return h('div', { className: 'dshw-shell' },
      h('div', { className: 'dshw-app' + (selectedTask || selectedProject ? ' dshw-app--detail' : '') }, listNode, paneNode, modalNode))
  }

  function SettingsPage(props: any) {
    const t = props.__t
    useStyles()
    const [cfg, setCfg] = React.useState(null)
    const [recents, setRecents] = React.useState([])
    const [clearing, setClearing] = React.useState(false)
    const [err, setErr] = React.useState('')
    React.useEffect(() => {
      getJson('config').then((d: any) => setCfg(d.config)).catch((e: any) => setErr((e && e.message) || t.loadFailed))
      getJson('recents').then((d: any) => setRecents(d.dirs || [])).catch(() => {})
    }, [])
    const clearRecents = async () => {
      if (clearing) return
      setClearing(true)
      setErr('')
      try {
        await post('recents/clear', {})
        setRecents([])
      } catch (e: any) {
        setErr((e && e.message) || t.failed)
      } finally {
        setClearing(false)
      }
    }
    return h('div', { className: 'dshw-settings' },
      h('h3', null, t.title),
      err ? h('div', { className: 'dshw-feedback', role: 'alert' }, err) : null,
      h('div', { className: 'dshw-grp' },
        h('div', { className: 'dshw-grp-title' }, t.config),
        h('div', { className: 'dshw-kv' },
          h('span', { className: 'dshw-k' }, t.worktreeDirName), h('span', { className: 'dshw-v' }, cfg ? String(cfg.dirName) : '…'),
          h('span', { className: 'dshw-k' }, t.branchPrefix), h('span', { className: 'dshw-v' }, cfg ? String(cfg.branchPrefix) : '…'),
          h('span', { className: 'dshw-k' }, t.gitPath), h('span', { className: 'dshw-v' }, cfg ? String(cfg.gitPath) : '…'))),
      h('div', { className: 'dshw-grp' },
        h('div', { className: 'dshw-grp-title' },
          h('span', null, t.recents),
          h('button', { className: 'dshw-btn', type: 'button', disabled: clearing || recents.length === 0, onClick: () => void clearRecents() }, clearing ? t.loading : t.clearRecents)),
        recents.length
          ? h('ul', { className: 'dshw-recents-list' }, recents.map((d: string) => h('li', { key: d, title: d }, d)))
          : h('div', { className: 'dshw-hint' }, '—')))
  }

  function BoardIcon() {
    return h('svg', { viewBox: '0 0 24 24', width: 22, height: 22, 'aria-hidden': true, style: { color: 'currentColor' } },
      h('circle', { cx: 7, cy: 6, r: 3, fill: 'currentColor' }),
      h('circle', { cx: 7, cy: 18, r: 3, fill: 'currentColor' }),
      h('circle', { cx: 17, cy: 12, r: 3, fill: 'currentColor', opacity: 0.75 }),
      h('path', { d: 'M7 9v6', stroke: 'currentColor', strokeWidth: 2, fill: 'none', strokeLinecap: 'round' }),
      h('path', { d: 'M9.5 7.5c4 1.5 5.5 2.5 6.2 4', stroke: 'currentColor', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', opacity: 0.75 }))
  }

  try { console.log('[dshw] factory reached main return') } catch {}
  ;(window as any).__dshwStage = (window as any).__dshwStage || []; (window as any).__dshwStage.push('factory-returning')
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
        const dbg = (msg: string) => {
          try {
            const w = window as any
            w.__dshwApply = w.__dshwApply || { registered: [], errs: [] }
            if (msg.startsWith('!')) w.__dshwApply.errs.push(msg.slice(1))
            else w.__dshwApply.registered.push(msg)
          } catch {
            /* noop */
          }
        }
        const reg = (slot: string, make: () => any, label: string) => {
          try {
            offs.push(ctx.slots.inject(slot, make))
            dbg(label)
          } catch (e: any) {
            dbg('!' + label + ': ' + ((e && (e.stack || e.message)) || String(e)))
          }
        }
        reg('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'deepseek-worktree-settings', order: 61, label: dict.title }, withT(SettingsPage)), 'settings.section')
        reg('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'worktree-board', order: 41, label: dict.title }, withT(BoardIcon)), 'sidebar.panellist')
        reg('main', function* () { yield ctx.slots.register({ name: 'main', key: 'worktree-board', label: dict.title }, withT(BoardPage)) }, 'main')
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
