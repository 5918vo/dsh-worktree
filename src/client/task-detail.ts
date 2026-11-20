import { React, h } from './ui'
import { Banner, Btn, Checkbox, Icon, Modal, Spinner } from './primitives'
import { getJson, post, postLong } from './context'
import { copyText, relTime } from './format'
import { createPreviewController, shouldPollPreview } from './merge-preview'

type DetailTab = 'overview' | 'diff' | 'commits'

export function TaskDetail(props: any) {
  const {
    view, running, pendingKind, t, notify,
    onChanged, onOpenSession, onCreateSession, onStartTask,
    parentView, followUps = [], repoLockLabel, onRepoBusy, onContinue, onSelectTask,
  } = props

  const task = view.task
  const snap = view.snapshot
  const wt = snap.worktree || {}
  const repo = snap.repo || {}
  const status: string = snap.status

  const [tab, setTab] = React.useState('overview' as DetailTab)
  const [busyAction, setBusyAction] = React.useState('')
  const [diffState, setDiffState] = React.useState({ loading: false, data: null as any, error: '' })
  const [activeFile, setActiveFile] = React.useState('')
  const [previewState, setPreviewState] = React.useState({ phase: 'idle' } as any)

  const [mergeOpen, setMergeOpen] = React.useState(false)
  const [mergePreflight, setMergePreflight] = React.useState(null as any)
  const [mergeSwitchBase, setMergeSwitchBase] = React.useState(true)
  const [mergeRestoreAfter, setMergeRestoreAfter] = React.useState(true)
  const [mergeDirtyStash, setMergeDirtyStash] = React.useState(false)

  const [cleanupOpen, setCleanupOpen] = React.useState(false)
  const [cleanupForce, setCleanupForce] = React.useState(false)
  const [cleanupBranch, setCleanupBranch] = React.useState(false)
  const [cleanupForceBranch, setCleanupForceBranch] = React.useState(false)

  const [switchModal, setSwitchModal] = React.useState(null as null | { kind: 'checkout' | 'back'; pre: any })

  const locked = !!repoLockLabel || !!busyAction

  const previewCtrlRef = React.useRef(null as any)
  React.useEffect(() => {
    const ctrl = createPreviewController({
      taskId: task.id,
      request: (force) => post('task/merge-preview', { id: task.id, force }).then((r: any) => r.preview),
    })
    previewCtrlRef.current = ctrl
    const off = ctrl.subscribe(setPreviewState)
    if (shouldPollPreview({ status, branchExists: snap.branchExists, ahead: wt.ahead, postMergeAhead: snap.postMergeAhead, repoBusy: !!repoLockLabel })) {
      void ctrl.load({ force: false })
    }
    return () => { off(); ctrl.dispose() }
  }, [task.id, wt.ahead, snap.postMergeAhead, snap.branchExists])

  const loadDiff = React.useCallback(async () => {
    setDiffState({ loading: true, data: null, error: '' })
    try {
      const r = await getJson('task/diff?id=' + encodeURIComponent(task.id))
      const files = r?.diff?.files || []
      setDiffState({ loading: false, data: r.diff, error: '' })
      if (files.length) setActiveFile((prev: string) => prev || files[0].path)
    } catch (e: any) {
      setDiffState({ loading: false, data: null, error: e?.message || t.failed })
    }
  }, [task.id])

  React.useEffect(() => {
    if (tab === 'diff' && !diffState.data && !diffState.loading) void loadDiff()
  }, [tab, loadDiff])

  const runGitAction = async (label: string, path: string, payload: any, okMsg: string) => {
    if (locked) return
    setBusyAction(label)
    onRepoBusy?.(true, label)
    try {
      const res = await postLong(path, payload)
      if (res?.warning) notify(res.warning, 'error')
      else if (res?.partial?.restoreFailed) notify(`${okMsg}（切回原分支失败：${res.partial.reason}）`, 'error')
      else notify(okMsg)
      await onChanged?.()
      return res
    } catch (e: any) {
      notify(e?.message || t.failed, 'error')
      throw e
    } finally {
      setBusyAction('')
      onRepoBusy?.(false, '')
    }
  }

  const triggerSwitch = async (kind: 'checkout' | 'back') => {
    if (locked) return
    setBusyAction(kind)
    try {
      const r = await post(`task/${kind}-preflight`, { id: task.id })
      const pre = r.preflight
      if (pre && !pre.safe) {
        setSwitchModal({ kind, pre })
        setBusyAction('')
        return
      }
      setBusyAction('')
      await runGitAction(
        kind === 'checkout' ? (t.checkout || '验收切换') : (t.back || '切回原分支'),
        `task/${kind}`,
        { id: task.id, expectedSha: pre?.targetSha || undefined },
        kind === 'checkout' ? (t.checkoutDone || '已切换到验收提交') : (t.backDone || '已切回原分支'),
      )
    } catch (e: any) {
      setBusyAction('')
      notify(e?.message || t.failed, 'error')
    }
  }

  const confirmSwitchStrategy = async (strategy: 'stash' | 'discard') => {
    if (!switchModal) return
    const { kind, pre } = switchModal
    setSwitchModal(null)
    await runGitAction(
      kind === 'checkout' ? '验收切换' : '切回原分支',
      `task/${kind}`,
      { id: task.id, strategy, expectedSha: pre?.targetSha || undefined },
      kind === 'checkout' ? '已切换到验收提交' : '已切回原分支',
    )
  }

  const openMergeModal = async () => {
    setMergeOpen(true)
    setMergePreflight(null)
    setMergeDirtyStash(false)
    try {
      const r = await post('task/merge-preflight', { id: task.id, switchToBase: mergeSwitchBase, restoreAfter: mergeRestoreAfter })
      setMergePreflight(r.preflight)
    } catch (e: any) {
      notify(e?.message || t.failed, 'error')
      setMergeOpen(false)
    }
  }

  const executeMerge = async () => {
    if (!mergePreflight) return
    try {
      await runGitAction('合并', 'task/merge', {
        id: task.id,
        switchToBase: mergeSwitchBase,
        restoreAfter: mergeRestoreAfter,
        expectedTip: mergePreflight.tipSha || undefined,
        expectedBase: mergePreflight.baseSha || undefined,
        dirtyStrategy: mergeDirtyStash ? 'stash' : 'refuse',
      }, t.mergedDone || '已合并到基线分支')
      setMergeOpen(false)
    } catch { /* 已 toast */ }
  }

  const executeCleanup = async () => {
    try {
      await runGitAction('清理', 'task/cleanup', {
        id: task.id,
        force: cleanupForce,
        deleteBranch: cleanupBranch,
        forceDeleteBranch: cleanupForceBranch,
      }, t.cleanupDone || '已清理 Worktree')
      setCleanupOpen(false)
    } catch { /* 已 toast */ }
  }

  const pendingStashes: any[] = Array.isArray(task.pendingStashes) ? task.pendingStashes : []
  const preview = previewState.phase === 'ready' ? previewState.preview : previewState.previous?.preview

  const renderDiffTab = () => {
    if (diffState.loading) return h('div', { className: 'dshw-card dshw-center' }, h(Spinner), h('span', null, t.loading || '加载差异中…'))
    if (diffState.error) return h(Banner, { tone: 'error', icon: 'alert', title: t.loadFailed || '加载失败' }, diffState.error)
    const files: any[] = diffState.data?.files || []
    if (!files.length) return h('div', { className: 'dshw-card dshw-card__empty' }, t.noChanges || '暂无代码变更')
    const current = files.find((f) => f.path === activeFile) || files[0]
    return h('div', { className: 'dshw-diff-layout' },
      h('aside', { className: 'dshw-diff-files' },
        h('div', { className: 'dshw-diff-summary' },
          h('span', null, `${files.length} 个文件`),
          h('span', { className: 'dshw-diff-add' }, `+${diffState.data.totalAdditions}`),
          h('span', { className: 'dshw-diff-del' }, `-${diffState.data.totalDeletions}`)),
        files.map((f) => h('button', {
          key: f.path,
          type: 'button',
          className: 'dshw-diff-file' + (f.path === current.path ? ' dshw-diff-file--on' : ''),
          onClick: () => setActiveFile(f.path),
        },
          h('span', { className: `dshw-file-tag dshw-file-tag--${f.status}` }, f.status[0].toUpperCase()),
          h('span', { className: 'dshw-diff-file__path', title: f.path }, f.path),
          h('span', { className: 'dshw-diff-file__stat' }, `+${f.additions}/-${f.deletions}`)))),
      h('div', { className: 'dshw-diff-patch' },
        h('div', { className: 'dshw-diff-patch__head' },
          h('code', null, current.path),
          h(Btn, { size: 'sm', icon: 'refresh', onClick: () => void loadDiff() }, t.refresh || '刷新')),
        h('pre', { className: 'dshw-code-block' },
          String(current.patch || '').split('\n').map((line, i) => {
            const cls = line.startsWith('+') && !line.startsWith('+++') ? 'dshw-line--add'
              : line.startsWith('-') && !line.startsWith('---') ? 'dshw-line--del'
                : line.startsWith('@@') ? 'dshw-line--hunk' : ''
            return h('div', { key: i, className: cls }, line || ' ')
          }))))
  }

  return h('div', { className: 'dshw-detail-inner dshw-task-detail' },
    h('header', { className: 'dshw-detail-head' },
      h('div', { className: 'dshw-detail-title-wrap' },
        h('div', { className: 'dshw-detail-kicker' },
          h('span', { className: `dshw-badge dshw-badge--${status}` }, status),
          running ? h('span', { className: 'dshw-badge dshw-badge--info' }, 'Agent 运行中') : null,
          pendingKind ? h('span', { className: 'dshw-badge dshw-badge--warn' }, `等待处理: ${pendingKind}`) : null,
          h('code', null, task.branch),
          h('span', { className: 'dshw-sep' }, '→'),
          h('code', null, task.baseBranch)),
        h('h1', { className: 'dshw-detail-title' }, task.title),
        h('div', { className: 'dshw-detail-path' },
          h('code', null, task.worktreePath),
          h('button', { type: 'button', className: 'dshw-link-btn', onClick: () => void copyText(task.worktreePath).then((ok) => ok && notify('已复制路径')) }, h(Icon, { name: 'copy' })))),
      h('div', { className: 'dshw-detail-actions' },
        task.sessionId
          ? h(Btn, { variant: 'primary', icon: 'external', onClick: onOpenSession }, t.openSession || '打开会话')
          : onCreateSession
            ? h(Btn, { variant: 'primary', icon: 'play', onClick: () => void onCreateSession() }, t.createSession || '启动会话')
            : null,
        status === 'reviewing'
          ? h(Btn, { icon: 'arrowLeft', disabled: locked, onClick: () => void triggerSwitch('back') }, t.back || '切回原分支')
          : status === 'review'
            ? h(Btn, { icon: 'check', disabled: locked, onClick: () => void triggerSwitch('checkout') }, t.checkout || '切换验收')
            : null,
        status !== 'merged' && status !== 'cleaned' && (wt.ahead || 0) > 0
          ? h(Btn, { variant: 'primary', icon: 'merge', disabled: locked, onClick: () => void openMergeModal() }, t.merge || '合并到基线')
          : null,
        status === 'merged' && onContinue
          ? h(Btn, { icon: 'branch', onClick: onContinue }, t.continueTask || '基于此任务续作')
          : null,
        !task.cleanedAt
          ? h(Btn, { icon: 'trash', disabled: locked, onClick: () => setCleanupOpen(true) }, t.cleanup || '清理')
          : null,
        (status === 'merged' || status === 'cleaned')
          ? h(Btn, {
            icon: task.archivedAt ? 'archiveRestore' : 'archive',
            disabled: locked,
            onClick: () => void runGitAction('归档', task.archivedAt ? 'task/unarchive' : 'task/archive', { id: task.id }, task.archivedAt ? '已取消归档' : '已归档'),
          }, task.archivedAt ? '取消归档' : '归档')
          : null)),

    repoLockLabel ? h(Banner, { tone: 'warn', icon: 'clock', title: `主仓库锁定中：${repoLockLabel}` }, '请等待当前 Git 操作完成后再执行其他变更。') : null,
    snap.error ? h(Banner, { tone: 'error', icon: 'alert', title: 'Git 状态读取异常' }, snap.error) : null,
    task.pendingOp?.mergeCommit
      ? h(Banner, {
        tone: 'warn',
        icon: 'alert',
        title: '合并已提交，但尚未切回原分支',
        actions: h(Btn, { size: 'sm', variant: 'primary', disabled: locked, onClick: () => void runGitAction('恢复原分支', 'task/merge-restore', { id: task.id }, '已恢复原分支') }, '立即恢复原分支'),
      }, `原分支：${task.pendingOp.originalRef?.branch || task.pendingOp.originalRef?.sha || '未知'}`)
      : null,
    preview?.conflict
      ? h(Banner, { tone: 'error', icon: 'alert', title: `与基线 ${task.baseBranch} 存在合并冲突` },
        (preview.conflictFiles || []).join('、') || '请先在 worktree 内合并基线解决冲突。')
      : null,
    pendingStashes.length > 0
      ? h(Banner, {
        tone: 'warn',
        icon: 'database',
        title: `有 ${pendingStashes.length} 条待处理暂存 (Stash)`,
        actions: h('div', { className: 'dshw-inline', style: { gap: '6px' } },
          h(Btn, { size: 'sm', disabled: locked, onClick: () => void runGitAction('恢复暂存', 'task/stash', { id: task.id, action: 'apply' }, '已应用暂存') }, '应用暂存'),
          h(Btn, { size: 'sm', variant: 'danger', disabled: locked, onClick: () => void runGitAction('丢弃暂存', 'task/stash', { id: task.id, action: 'drop' }, '已丢弃暂存') }, '丢弃')),
      }, pendingStashes.map((s) => `${s.source}: ${s.files?.length || 0} 个文件`).join(' · '))
      : null,

    h('nav', { className: 'dshw-tabs', role: 'tablist' },
      ([
        ['overview', t.overview || '概览'],
        ['diff', `${t.changes || '代码变更'}${wt.dirtyCount ? ` (${wt.dirtyCount} 未提交)` : ''}`],
        ['commits', `${t.commits || '提交记录'} (${wt.ahead || 0})`],
      ] as Array<[DetailTab, string]>).map(([id, label]) =>
        h('button', {
          key: id,
          type: 'button',
          role: 'tab',
          'aria-selected': tab === id ? 'true' : 'false',
          className: 'dshw-tab' + (tab === id ? ' dshw-tab--on' : ''),
          onClick: () => setTab(id),
        }, label))),

    tab === 'overview'
      ? h('div', { className: 'dshw-stack' },
        h('section', { className: 'dshw-stat-grid' },
          h('div', { className: 'dshw-stat-card' }, h('div', { className: 'dshw-stat-card__val' }, String(wt.ahead || 0)), h('div', { className: 'dshw-stat-card__label' }, '领先基线提交')),
          h('div', { className: 'dshw-stat-card' }, h('div', { className: 'dshw-stat-card__val' }, String(wt.dirtyCount || 0)), h('div', { className: 'dshw-stat-card__label' }, 'Worktree 未提交')),
          h('div', { className: 'dshw-stat-card' }, h('div', { className: 'dshw-stat-card__val' }, repo.currentBranch || 'DETACHED'), h('div', { className: 'dshw-stat-card__label' }, '主仓库当前分支')),
          h('div', { className: 'dshw-stat-card' }, h('div', { className: 'dshw-stat-card__val' }, relTime(wt.lastCommitAt || task.updatedAt, t)), h('div', { className: 'dshw-stat-card__label' }, '最近更新'))),
        h('section', { className: 'dshw-card' },
          h('div', { className: 'dshw-card__head' }, h('h2', null, t.taskDescription || '任务描述')),
          h('div', { className: 'dshw-prose' }, task.description)),
        task.acceptanceCriteria?.length
          ? h('section', { className: 'dshw-card' },
            h('div', { className: 'dshw-card__head' }, h('h2', null, t.acceptanceCriteria || '验收标准')),
            h('ul', { className: 'dshw-criteria-list' }, task.acceptanceCriteria.map((c: string) => h('li', { key: c }, c))))
          : null,
        (parentView || followUps.length > 0)
          ? h('section', { className: 'dshw-card' },
            h('div', { className: 'dshw-card__head' }, h('h2', null, '任务关联')),
            parentView
              ? h('div', { className: 'dshw-rel-row' },
                h('span', { className: 'dshw-muted' }, '前序任务：'),
                h('button', { type: 'button', className: 'dshw-link-btn', onClick: () => onSelectTask?.(parentView.task.id) }, parentView.task.title))
              : null,
            followUps.map((f: any) => h('div', { key: f.task.id, className: 'dshw-rel-row' },
              h('span', { className: 'dshw-muted' }, '续作任务：'),
              h('button', { type: 'button', className: 'dshw-link-btn', onClick: () => onSelectTask?.(f.task.id) }, f.task.title))))
          : null,
        task.sessionId && onStartTask
          ? h('div', { className: 'dshw-footer-util' },
            h('button', { type: 'button', className: 'dshw-link-btn', onClick: () => void onStartTask() }, '重新发送首条任务指令'))
          : null)
      : tab === 'diff'
        ? renderDiffTab()
        : h('section', { className: 'dshw-card' },
          (wt.commits || []).length === 0
            ? h('div', { className: 'dshw-card__empty' }, '暂无领先基线的提交')
            : h('div', { className: 'dshw-mini-list' }, (wt.commits || []).map((c: any) =>
              h('div', { key: c.hash, className: 'dshw-commit-row' },
                h('code', { className: 'dshw-commit-hash' }, c.hash),
                h('span', { className: 'dshw-commit-msg' }, c.subject))))),

    mergeOpen
      ? h(Modal, {
        t,
        title: `合并到 ${task.baseBranch}`,
        icon: 'merge',
        size: 'md',
        busy: !!busyAction,
        onClose: () => { if (!busyAction) setMergeOpen(false) },
        footer: [
          h(Btn, { key: 'c', onClick: () => setMergeOpen(false), disabled: !!busyAction }, t.cancel || '取消'),
          h(Btn, {
            key: 'ok',
            variant: 'primary',
            disabled: !!busyAction || !mergePreflight || (!mergePreflight.canMerge && !(mergeDirtyStash && mergePreflight.blockers.every((b: any) => b.code === 'dirty-blocks-switch'))),
            onClick: () => void executeMerge(),
          }, busyAction ? h(Spinner) : null, t.merge || '确认合并'),
        ],
      },
        !mergePreflight
          ? h('div', { className: 'dshw-center' }, h(Spinner), h('span', null, '正在进行合并预检…'))
          : h('div', { className: 'dshw-stack' },
            mergePreflight.blockers.map((b: any) =>
              h(Banner, { key: b.code, tone: b.code === 'dirty-blocks-switch' ? 'warn' : 'error', icon: 'alert', title: b.code }, b.message)),
            h(Checkbox, { checked: mergeSwitchBase, onChange: setMergeSwitchBase, label: `自动切到基线分支 ${task.baseBranch} 后合并` }),
            h(Checkbox, { checked: mergeRestoreAfter, onChange: setMergeRestoreAfter, label: '合并完成后切回原分支' }),
            mergePreflight.blockers.some((b: any) => b.code === 'dirty-blocks-switch')
              ? h(Checkbox, { checked: mergeDirtyStash, onChange: setMergeDirtyStash, label: '自动将阻挡切换的主仓库改动暂存到 Stash' })
              : null))
      : null,

    switchModal
      ? h(Modal, {
        t,
        title: '主仓库存在阻挡切换的改动',
        icon: 'alert',
        tone: 'warn',
        size: 'sm',
        onClose: () => setSwitchModal(null),
        footer: [
          h(Btn, { key: 'c', onClick: () => setSwitchModal(null) }, '取消'),
          h(Btn, { key: 'd', variant: 'danger', onClick: () => void confirmSwitchStrategy('discard') }, '放弃改动并切换'),
          h(Btn, { key: 's', variant: 'primary', onClick: () => void confirmSwitchStrategy('stash') }, '暂存后切换'),
        ],
      },
        h('p', { className: 'dshw-muted' }, `以下 ${switchModal.pre.obstacles.length} 个文件会阻止切换：`),
        h('ul', { className: 'dshw-criteria-list' }, switchModal.pre.obstacles.slice(0, 10).map((o: any) => h('li', { key: o.path }, o.path))))
      : null,

    cleanupOpen
      ? h(Modal, {
        t,
        title: t.cleanup || '清理 Worktree',
        icon: 'trash',
        tone: 'danger',
        size: 'sm',
        busy: !!busyAction,
        onClose: () => { if (!busyAction) setCleanupOpen(false) },
        footer: [
          h(Btn, { key: 'c', onClick: () => setCleanupOpen(false), disabled: !!busyAction }, t.cancel || '取消'),
          h(Btn, { key: 'ok', variant: 'danger', disabled: !!busyAction, onClick: () => void executeCleanup() }, busyAction ? h(Spinner) : null, '确认清理'),
        ],
      },
        h('div', { className: 'dshw-stack' },
          h('code', null, task.worktreePath),
          h(Checkbox, { checked: cleanupForce, onChange: setCleanupForce, label: '强制移除（忽略未提交改动）' }),
          h(Checkbox, { checked: cleanupBranch, onChange: setCleanupBranch, label: `同时删除分支 ${task.branch}` }),
          cleanupBranch ? h(Checkbox, { checked: cleanupForceBranch, onChange: setCleanupForceBranch, label: '强制删除未合并分支（不可恢复）' }) : null))
      : null)
}
