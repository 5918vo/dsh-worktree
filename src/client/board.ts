/**
 * Workbench board shell: three-zone layout (Rail / Stage / Inspector),
 * theme & container responsiveness, keyboard shortcuts, and modal coordination.
 * Data polling lives in `./board/use-board-data`, actions in `./board/use-board-actions`,
 * and confirmation/stash dialogs in `./board/dialogs`.
 */

import { React, h, useStyles } from './ui'
import { getJson } from './context'
import { upsertPublishedTask, visibleProjectViews } from './board-data'
import { copyText } from './format'
import { ProjectDetail } from './project-detail'
import type { ProjectView, TaskView } from '../models'
import { WORKBENCH_CSS } from './styles'
import { Rail } from './rail'
import { Stage, type BoardTab } from './stage'
import { Inspector } from './inspector'
import { PublishModal } from './publish'
import { AddProjectModal } from './add-project'
import { openNativeSession } from './actions'
import { pendingLabel } from './status'
import {
  EMPTY_ATTENTION,
  computeFilterCounts,
  deriveTaskAttention,
  type QuickAction,
  type TaskAttention,
} from './task-attention'
import { deriveActionGate } from './action-gate'
import { ConfirmDialog, StashDiffModal, type ConfirmState, type StashViewState } from './board/dialogs'
import { useBoardData } from './board/use-board-data'
import { useBoardActions } from './board/use-board-actions'
import {
  boardCta,
  boardStatus,
  diffBaseSha,
  filterProjectViews,
  railEmptyKind,
  themeFor,
  type BoardFilter,
} from './model'

const THEME_KEY = 'dshw-board:theme'
let boardStyleEl: HTMLStyleElement | null = null
let boardStyleRefs = 0

export function WorkbenchBoardIcon() {
  return h('svg', { viewBox: '0 0 24 24', width: 22, height: 22, 'aria-hidden': true, style: { color: 'currentColor' } },
    h('rect', { x: 3, y: 4, width: 4, height: 16, rx: 1.5, fill: 'currentColor', opacity: 0.5 }),
    h('rect', { x: 9, y: 4, width: 12, height: 7, rx: 1.5, fill: 'currentColor' }),
    h('rect', { x: 9, y: 13, width: 12, height: 7, rx: 1.5, fill: 'currentColor', opacity: 0.75 }))
}

export interface WorkbenchBoardPageProps {
  __t: Record<string, any>
}

export function WorkbenchBoardPage(props: WorkbenchBoardPageProps) {
  const t = props.__t
  useStyles()
  React.useEffect(() => {
    boardStyleRefs += 1
    if (!boardStyleEl || !boardStyleEl.isConnected) {
      boardStyleEl = document.createElement('style')
      boardStyleEl.setAttribute('data-dshw-board', '1')
      boardStyleEl.textContent = WORKBENCH_CSS
      document.head.appendChild(boardStyleEl)
    }
    return () => {
      boardStyleRefs = Math.max(0, boardStyleRefs - 1)
      if (boardStyleRefs === 0 && boardStyleEl) {
        try {
          boardStyleEl.remove()
        } catch {
          /* noop */
        }
        boardStyleEl = null
      }
    }
  }, [])

  const [query, setQuery] = React.useState('')
  const [filter, setFilter] = React.useState('all' as BoardFilter)
  const [showArchived, setShowArchived] = React.useState(false)
  const [selectedTaskId, setSelectedTaskId] = React.useState('')
  const [selectedProjectId, setSelectedProjectId] = React.useState('')
  const [tab, setTab] = React.useState('overview' as BoardTab)
  const [railHidden, setRailHidden] = React.useState(false)
  const [inspectorHidden, setInspectorHidden] = React.useState(false)
  const [compact, setCompact] = React.useState(false)
  const [busy, setBusy] = React.useState('')
  const [publishOpen, setPublishOpen] = React.useState(false)
  const [publishDraft, setPublishDraft] = React.useState(null as any)
  const [partialNotice, setPartialNotice] = React.useState(null as { taskId: string; message: string } | null)
  const [environment, setEnvironment] = React.useState(null as any)
  const [addOpen, setAddOpen] = React.useState(false)
  const [publishProjectId, setPublishProjectId] = React.useState('')
  const [publishParentId, setPublishParentId] = React.useState('')
  const [confirm, setConfirm] = React.useState(null as ConfirmState | null)
  const [stashView, setStashView] = React.useState(null as StashViewState | null)
  const [partialRestore, setPartialRestore] = React.useState(null as { restoreFailed: boolean; reason: string } | null)
  const [toast, setToast] = React.useState(null as { message: string; error?: boolean } | null)
  const [notice, setNotice] = React.useState(null as { message: string } | null)
  const [narrow, setNarrow] = React.useState(false)
  const [theme, setTheme] = React.useState(() => {
    let stored = ''
    try { stored = localStorage.getItem(THEME_KEY) || '' } catch { /* storage may be disabled */ }
    const hostDark = (() => {
      try {
        return document.documentElement.classList.contains('dshw-dark')
          || (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      } catch { return true }
    })()
    return themeFor(stored, hostDark, hostDark)
  })

  const rootRef = React.useRef(null as HTMLDivElement | null)
  const compactRef = React.useRef(false)
  const narrowRef = React.useRef(false)
  const searchRef = React.useRef(null as HTMLInputElement | null)
  const toastTimer = React.useRef(null as ReturnType<typeof setTimeout> | null)

  // An error toast vanishes in 6s; the same text also becomes a sticky inline
  // banner so a refused merge/checkout stays readable after the toast is gone.
  // `sticky:false` opts out when the same text is already pinned elsewhere.
  const say = (message: string, error = false, sticky = error) => {
    setToast({ message, error })
    setNotice(sticky ? { message } : null)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    // Failures need time to read; successes can stay brief.
    toastTimer.current = setTimeout(() => setToast(null), error ? 6000 : 2400)
  }

  // Host capabilities are read once: they explain a merge pre-check or deep
  // worktree path that may fail, and never change during a session.
  React.useEffect(() => {
    getJson('config')
      .then((d: any) => { if (d && d.environment) setEnvironment(d.environment) })
      .catch(() => {})
  }, [])

  const data = useBoardData({
    t,
    showArchived,
    selectedTaskId,
    selectedProjectId,
    setSelectedTaskId,
    setSelectedProjectId,
  })
  const {
    views,
    setViews,
    loaded,
    err,
    remotes,
    sessionMap,
    pendingMap,
    healthMap,
    lastOkAt,
    entries,
    entriesReady,
    live,
    sessionId,
    diff,
    diffLoading,
    diffError,
    headSha,
    retryDiff,
    previewState,
    previewRef,
    selectedTask,
    selectedProject,
    projectOfTask,
    runningOf,
    refresh,
    checkPublished,
  } = data

  // The board lives beside the host sidebar, so its own width is narrower than
  // the viewport (and shrinks when the page is zoomed). Drive the compact
  // layout from the container, never from window.innerWidth.
  React.useLayoutEffect(() => {
    const el = rootRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const apply = (width: number) => {
      const next = width <= 980
      const nextNarrow = width <= 720
      if (nextNarrow !== narrowRef.current) {
        narrowRef.current = nextNarrow
        setNarrow(nextNarrow)
      }
      if (next === compactRef.current) return
      compactRef.current = next
      setCompact(next)
    }
    apply(el.getBoundingClientRect().width)
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) apply(entry.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // The inspector is a drawer in compact mode: close it while narrow, but put
  // it back when the container widens again — the hide state belongs to the
  // breakpoint, not to the user's choice.
  React.useEffect(() => {
    setInspectorHidden(compact)
  }, [compact])

  // Below ~720px the board is a single column: the rail becomes a full-width
  // overlay, so start with it closed (the stage/task view is the point).
  React.useEffect(() => {
    setRailHidden(narrow)
  }, [narrow])

  // The banner explains the action the user just attempted; it must not follow
  // them to another task.
  React.useEffect(() => {
    setNotice(null)
  }, [selectedTaskId])

  const openPublish = (projectId?: string, parentId = '') => {
    // Prefer what the user is looking at now; `views` is ordered by recent
    // activity, so its first entry is the "last used" project and must not win
    // over the current selection.
    const taskProjectId = selectedTask && selectedTask.task.projectId ? selectedTask.task.projectId : ''
    setPublishProjectId(projectId || selectedProjectId || taskProjectId || (views[0] && views[0].project.id) || '')
    setPublishParentId(parentId)
    setPublishOpen(true)
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (publishOpen || addOpen || confirm || stashView) {
        // Publish and add-project own their Escape handling so a submit in
        // flight cannot be dismissed from here.
        if (e.key === 'Escape' && !busy) {
          if (confirm) setConfirm(null)
          if (stashView) setStashView(null)
        }
        return
      }
      const root = rootRef.current
      const active = document.activeElement as HTMLElement | null
      // Do not steal keys from the host's chat composer or any other widget.
      if (root && active && active !== document.body && !root.contains(active)) return
      const typing = active && (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || active.isContentEditable)
      if (!typing && (e.key === '/' || ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k'))) {
        e.preventDefault()
        if (searchRef.current) searchRef.current.focus()
        return
      }
      if (!typing && !e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'n') { e.preventDefault(); openPublish(); return }
      if (!typing && e.key === '[') { e.preventDefault(); setRailHidden((v: boolean) => !v); return }
      if (!typing && e.key === ']') { e.preventDefault(); setInspectorHidden((v: boolean) => !v); return }
      if (e.key === 'Escape' && active === searchRef.current && query) setQuery('')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [query, publishOpen, addOpen, confirm, stashView, busy, selectedProjectId, views])

  const selectTask = (id: string, projectId?: string) => {
    const found = views.flatMap((v: ProjectView) => v.tasks).find((x: TaskView) => x.task.id === id)
    const owner = projectId || (found ? found.task.projectId : '')
    setSelectedTaskId(id)
    if (owner) setSelectedProjectId(owner)
    setTab('overview')
  }
  const selectProject = (id: string) => {
    setSelectedProjectId(id)
    setSelectedTaskId('')
  }
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try { localStorage.setItem(THEME_KEY, next) } catch { /* noop */ }
  }
  const toggleArchived = () => {
    // Hiding archived rows also drops an archived selection so the stage does
    // not keep showing a task the rail just concealed.
    if (showArchived && selectedTask && selectedTask.task.archivedAt) {
      setSelectedProjectId(selectedTask.task.projectId)
      setSelectedTaskId('')
    }
    setShowArchived((v: boolean) => !v)
  }

  const actions = useBoardActions({
    t,
    remotes,
    selectedTask,
    selectedProjectId,
    projectOfTask,
    busy,
    setBusy,
    setConfirm,
    setStashView,
    setPartialRestore,
    setSelectedTaskId,
    setTab,
    openPublish,
    previewState,
    say,
    refresh,
  })

  const archived = !!(selectedTask && selectedTask.task.archivedAt)
  const running = selectedTask ? runningOf(selectedTask.task) : false
  const pending = !!(selectedTask && selectedTask.task.sessionId && pendingMap[selectedTask.task.sessionId])
  const status = selectedTask ? boardStatus(selectedTask.snapshot.status, running) : null
  const statusKey = status ? status.key : ''
  const cta = selectedTask && status ? boardCta(status, !!selectedTask.task.sessionId) : null

  // Another uncleaned task the main repo is currently accepting blocks
  // checkout, because switching away would drop its review context. The stage
  // is not on the task branch in that state, so "this task" cannot be itself.
  const otherReviewing = React.useMemo(() => {
    if (!selectedTask) return null
    const self = selectedTask.task
    const snap = selectedTask.snapshot
    const onTaskBranch = (!!self.reviewSha && !!snap.repo.headSha && self.reviewSha === snap.repo.headSha)
      || (!!self.branch && snap.repo.currentBranch === self.branch)
    if (onTaskBranch) return null
    for (const view of views) {
      for (const tv of view.tasks) {
        const task = tv.task
        if (!task || task.id === self.id || task.cleanedAt) continue
        if ((task.branch && task.branch === snap.repo.currentBranch)
          || (task.reviewSha && snap.repo.headSha && task.reviewSha === snap.repo.headSha)) return tv
      }
    }
    return null
  }, [views, selectedTask])

  const actionGate = React.useMemo(() => deriveActionGate({
    t,
    task: selectedTask ? selectedTask.task : null,
    snapshot: selectedTask ? selectedTask.snapshot : null,
    status: statusKey,
    running,
    pending,
    previewState,
    otherReviewing,
  }), [t, selectedTask, statusKey, running, pending, previewState, otherReviewing])
  const baseSha = selectedTask
    ? diffBaseSha(selectedTask.task, selectedTask.snapshot, previewRef.current && previewRef.current.preview ? (previewRef.current.preview.expectedBase || null) : null)
    : ''
  const canArchive = !!(selectedTask && (selectedTask.snapshot.status === 'merged' || selectedTask.snapshot.status === 'cleaned' || archived))
  const archiveReason = selectedTask && !canArchive ? t.archiveMergedOnly : ''
  const archivedCount = views.reduce((n: number, v: ProjectView) => n + v.tasks.filter((x: TaskView) => x.task.archivedAt).length, 0)

  // One attention map feeds the rows, the filter counts and the summary bar, so
  // they can never disagree about what needs attention.
  const allViews = React.useMemo(() => {
    const out: TaskView[] = []
    for (const view of views) for (const tv of view.tasks) out.push(tv)
    return out
  }, [views])
  const shownViews = React.useMemo(() => visibleProjectViews(views, showArchived), [views, showArchived])
  const pendingOf = (task: any) => task && task.sessionId ? (pendingMap[task.sessionId] || '') : ''
  const healthOf = (task: any) => task && task.sessionId ? (healthMap[task.sessionId] || null) : null
  const attentionMap = React.useMemo(() => {
    const map = new Map<string, TaskAttention>()
    for (const tv of allViews) {
      const sid = tv.task.sessionId ? String(tv.task.sessionId) : ''
      map.set(tv.task.id, deriveTaskAttention({
        task: tv.task,
        snapshot: tv.snapshot,
        pendingKind: sid ? pendingMap[sid] : '',
        running: sid ? !!sessionMap[sid] : false,
        health: sid ? healthMap[sid] || null : null,
        stale: !!err,
      }))
    }
    return map
  }, [allViews, pendingMap, sessionMap, healthMap, err])
  const attentionOf = React.useCallback((tv: TaskView) => attentionMap.get(tv.task.id) || EMPTY_ATTENTION, [attentionMap])
  const visibleTasks = React.useMemo(() => {
    const out: TaskView[] = []
    for (const view of shownViews) for (const tv of view.tasks) out.push(tv)
    return out
  }, [shownViews])
  // Recovery also counts (and shows) archived tasks: they must be repaired too.
  const counts = computeFilterCounts(visibleTasks, allViews, attentionOf)
  const filtered = filterProjectViews(
    filter === 'recovery' ? visibleProjectViews(views, true) : shownViews,
    filter,
    query,
    attentionOf,
    (task: any) => pendingLabel(t, pendingOf(task)),
  )
  // Only an actually empty result may own the rail; a search or filter that
  // still matched rows must keep rendering them.
  const emptyKind = railEmptyKind(views, filtered, query, filter)

  const runQuick = (action: QuickAction, tv: TaskView, projectId: string) => {
    if (action === 'handle' || action === 'open-session') {
      const sid = tv.task.sessionId ? String(tv.task.sessionId) : ''
      if (!sid || !openNativeSession(sid)) say(t.openSessionFailed, true)
      return
    }
    selectTask(tv.task.id, projectId)
  }

  return h('div', { ref: rootRef, className: 'dshw-board', 'data-theme': theme },
    h('div', {
      className: 'dshwd-app'
        + (railHidden ? ' dshwd-hide-left' : '')
        + (inspectorHidden || !selectedTask ? ' dshwd-hide-right' : ''),
    },
      h(Rail, {
        t,
        views: filtered,
        projectCount: views.length,
        selectedTaskId,
        selectedProjectId,
        query,
        filter,
        showArchived,
        archivedCount,
        theme,
        runningOf,
        pendingOf,
        healthOf,
        attentionOf,
        counts,
        attentionTotal: counts.total,
        attentionStale: !!err,
        lastOkAt,
        emptyKind,
        onQuery: setQuery,
        onFilter: setFilter,
        onToggleArchived: toggleArchived,
        onSelectTask: selectTask,
        onSelectProject: selectProject,
        onQuick: runQuick,
        onPublish: () => openPublish(),
        onAddProject: () => setAddOpen(true),
        onToggleTheme: toggleTheme,
        searchRef,
        environment,
      }),

      selectedTask && projectOfTask && cta
        ? h(Stage, {
          t,
          taskView: selectedTask,
          projectName: projectOfTask.project.name,
          running: runningOf(selectedTask.task),
          pendingKind: selectedTask.task.sessionId ? pendingMap[selectedTask.task.sessionId] || '' : '',
          health: selectedTask.task.sessionId ? healthMap[selectedTask.task.sessionId] || null : null,
          tab,
          onTab: setTab,
          ctas: cta,
          disabledActions: busy ? { merge: t.working, checkout: t.working, back: t.working, cleanup: t.working, open: t.working, create: t.working, start: t.working, retry: t.working, continue: t.working } : actionGate.disabled,
          actionReasons: actionGate.reasons,
          onAction: actions.runAction,
          criteriaBusy: !!busy,
          onToggleCriterion: actions.runCriterion,
          entries,
          entriesReady,
          live,
          sessionId,
          onOpenSession: () => { if (!openNativeSession(sessionId)) say(t.openSessionFailed, true) },
          onStartSession: () => actions.runAction(selectedTask.task.sessionId ? 'open' : 'start'),
          diff,
          diffLoading,
          diffError,
          onRetryDiff: retryDiff,
          baseSha,
          headSha,
          onToggleRail: () => setRailHidden((v: boolean) => !v),
          onToggleInspector: () => setInspectorHidden((v: boolean) => !v),
          narrow,
          notice,
          onDismissNotice: () => setNotice(null),
          partial: partialNotice && selectedTask && partialNotice.taskId === selectedTask.task.id ? partialNotice : null,
          onDismissPartial: () => setPartialNotice(null),
          onBackToList: () => setSelectedTaskId(''),
        })
        : selectedProject
          ? h('div', { className: 'dshwd-management' },
            h('div', { className: 'dshw-scope' + (theme === 'dark' ? ' dshw-dark' : ''), style: { height: '100%' } },
              h(ProjectDetail, {
                view: selectedProject,
                cfg: null,
                pendingMap,
                sessionMap,
                t,
                railHidden,
                inspectorHidden,
                narrow,
                onToggleRail: () => setRailHidden((v: boolean) => !v),
                onToggleInspector: () => setInspectorHidden((v: boolean) => !v),
                notify: say,
                onChanged: refresh,
                onPublish: () => openPublish(selectedProject.project.id),
                onSelectTask: (id: string) => selectTask(id, selectedProject.project.id),
                onDeleted: refresh,
              })))
          : h('main', { className: 'dshwd-stage' },
            h('div', { className: 'dshwd-topbar' },
              h('div', { className: 'dshwd-topbar-left' },
                h('button', { className: 'dshwd-btn dshwd-btn-ghost', onClick: () => setRailHidden((v: boolean) => !v) }, '◧'),
                h('span', { className: 'dshwd-breadcrumb' }, err || (loaded ? t.boardSelectTask : t.loading)))),
            h('div', { className: 'dshwd-empty', style: { flex: '1' } },
              h('div', { className: 'dshwd-empty-title' }, err ? t.connectionLost : loaded ? t.boardSelectTask : t.loading),
              h('div', { className: 'dshwd-hint' }, err ? err : t.boardSelectTaskHint),
              err ? h('button', { className: 'dshwd-btn', onClick: () => void refresh(true) }, t.retry) : null)),

      selectedTask
        ? h(Inspector, {
          t,
          taskView: selectedTask,
          archived,
          previewState,
          live,
          mergeReasons: actionGate.reasons.merge || [],
          baseSha,
          headSha,
          baseLabel: selectedTask.task.baseBranch,
          busy,
          canArchive,
          archiveReason,
          stashes: selectedTask.task.pendingStashes || [],
          partialRestore,
          running: runningOf(selectedTask.task),
          narrow,
          onClose: () => setInspectorHidden(true),
          onCopy: (text: string) => { copyText(text); say(t.copied) },
          onSyncBaseline: actions.runSyncBaseline,
          onArchive: () => actions.archiveTask(false),
          onUnarchive: () => actions.archiveTask(true),
          onCleanup: actions.runCleanup,
          onDelete: actions.runDeleteTask,
          onRestore: actions.runMergeRestore,
          onViewStash: (sha: string) => void actions.viewStash(sha),
          onApplyStash: actions.applyStash,
          onDropStash: actions.dropStash,
        })
        : null),

    publishOpen
      ? h(PublishModal, {
        t,
        views,
        initialProjectId: publishProjectId,
        parentId: publishParentId,
        parentView: publishParentId ? views.flatMap((v: ProjectView) => v.tasks).find((tv: TaskView) => tv.task.id === publishParentId) || null : null,
        draft: publishDraft,
        onDraft: (draft: any) => setPublishDraft(draft),
        onClose: () => setPublishOpen(false),
        onPublished: (task: any, project: any, warning?: string, continued?: boolean) => {
          setPublishOpen(false)
          setPublishDraft(null)
          if (task) {
            setViews((prev: ProjectView[]) => upsertPublishedTask(prev, task, project.id, continued ? 'developing' : 'ready'))
            setSelectedTaskId(task.id)
            setSelectedProjectId(project.id)
            setTab('overview')
            // A warning means the worktree exists but the session/start step
            // only partly succeeded: keep it visible for this task instead of
            // letting it vanish with the toast.
            setPartialNotice(warning ? { taskId: String(task.id), message: warning } : null)
          } else {
            setPartialNotice(null)
          }
          say(warning || t.published)
          void refresh()
        },
        onCheckPublished: checkPublished,
      })
      : null,

    addOpen
      ? h(AddProjectModal, {
        t,
        projects: views.map((v: any) => v.project),
        onClose: () => setAddOpen(false),
        onAdded: (project: any, existing?: boolean) => {
          setAddOpen(false)
          if (project) {
            setSelectedProjectId(project.id)
            setSelectedTaskId('')
            const copy = existing ? t.projectExistsOpened : t.projectAdded
            say(String(copy).replace('{name}', project.name || ''))
          }
          void refresh()
        },
      })
      : null,

    stashView ? h(StashDiffModal, { t, stashView, onClose: () => setStashView(null) }) : null,

    confirm ? h(ConfirmDialog, {
      t,
      title: confirm.title,
      body: confirm.body,
      details: confirm.details,
      pre: confirm.pre,
      label: confirm.label,
      danger: !!confirm.danger,
      checks: confirm.checks || [],
      busy: !!busy,
      onCancel: () => setConfirm(null),
      onConfirm: (values: Record<string, boolean>) => {
        if (!confirm.run) return
        setBusy('confirm')
        Promise.resolve(confirm.run(values || {}))
          .catch((e: any) => say(String((e && e.message) || t.failed), true))
          .finally(() => { setBusy(''); setConfirm(null) })
      },
    }) : null,

    toast ? h('div', { className: 'dshwd-toast dshwd-show' + (toast.error ? ' dshwd-error' : ''), role: toast.error ? 'alert' : 'status' }, toast.message) : null)
}
