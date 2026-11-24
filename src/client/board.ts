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
import { activeDrawer, closeAllDrawers, closeDrawer, dismissDrawer, drawerFocusTrap, toggleDrawer, type DrawerState, type DrawerSide } from './drawers'
import { attachFocusTrap } from './dialog-focus'
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
import { dueStateOf } from '../task-meta'
import { ConfirmDialog, StashDiffModal, type ConfirmState, type StashViewState } from './board/dialogs'
import { useBoardData } from './board/use-board-data'
import { useBoardActions } from './board/use-board-actions'
import {
  boardCta,
  boardStatus,
  boardStatusLabel,
  collectTags,
  diffBaseSha,
  filterProjectViews,
  mergeGateMissing,
  railEmptyKind,
  themeFor,
  type BoardFilter,
} from './model'
import { loadSavedViews, saveSavedViews } from './view-storage'
import {
  SAVED_VIEW_LIMIT,
  SAVED_VIEW_NAME_MAX,
  createSavedView,
  removeSavedView,
  sameViewState,
  upsertSavedView,
  type SavedView,
  type ViewState,
} from './saved-views'
import { stalledDays } from './staleness'
import { compareTaskOrder } from '../task-meta'
import { dependencyStatus, isDependencyDone, isSameProject } from '../task-deps'

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
  const [tagFilter, setTagFilter] = React.useState('')
  const [showArchived, setShowArchived] = React.useState(false)
  // Views are read lazily once per mount; storage failures read as "no views".
  const [savedViews, setSavedViews] = React.useState(() => loadSavedViews())
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
  // Runtime worktree dir: what a project without its own `dirName` inherits.
  const [configDirName, setConfigDirName] = React.useState('')
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
      .then((d: any) => {
        if (d && d.environment) setEnvironment(d.environment)
        if (d && d.config && d.config.dirName) setConfigDirName(String(d.config.dirName))
      })
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

  // Drawer state is derived once so the rail and inspector can never both be
  // open as sheets; the wide layout keeps its independent hide toggles.
  const drawerState: DrawerState = { railHidden, inspectorHidden }
  // The sheet that may contain Tab. `narrow` alone is not enough: only the
  // active sheet traps, and an open modal owns focus + Escape by itself.
  const drawerTrapSide = drawerFocusTrap(
    drawerState,
    narrow,
    !!selectedTask,
    !!(publishOpen || addOpen || confirm || stashView),
  )
  const drawerReturn = React.useRef(null as any)
  const setDrawers = (next: DrawerState) => {
    setRailHidden(next.railHidden)
    setInspectorHidden(next.inspectorHidden)
  }
  const toggleSide = (side: DrawerSide) => {
    if (narrow && activeDrawer(drawerState, narrow, !!selectedTask) === null) {
      drawerReturn.current = document.activeElement
    }
    setDrawers(toggleDrawer(drawerState, side, narrow))
  }
  const closeDrawers = () => setDrawers(closeAllDrawers(drawerState))
  // Picking a task from the rail sheet hands focus to the stage it reveals.
  const focusStage = React.useRef(false)
  // Focus moves into the open sheet (its close button) and returns to whatever
  // opened it; closing both restores the opener exactly once.
  React.useEffect(() => {
    if (!narrow) { drawerReturn.current = null; return }
    const side = activeDrawer({ railHidden, inspectorHidden }, narrow, !!selectedTask)
    if (!side) {
      const el: any = drawerReturn.current
      drawerReturn.current = null
      if (el && el.isConnected && typeof el.focus === 'function') el.focus()
      return
    }
    const root: any = rootRef.current
    const scope = root && root.querySelector(side === 'rail' ? '.dshwd-rail' : '.dshwd-inspector')
    const btn: any = scope && scope.querySelector('.dshwd-drawer-close')
    if (btn && typeof btn.focus === 'function') btn.focus()
  }, [narrow, railHidden, inspectorHidden, selectedTaskId])

  // Tab/Shift+Tab stay inside the active narrow sheet. Escape is intentionally
  // not handled here: the board keydown handler below closes the top drawer
  // once, and dialogs keep their own Escape/focus lifecycle.
  React.useEffect(() => {
    if (!drawerTrapSide) return undefined
    const root: any = rootRef.current
    const scope: any = root && root.querySelector(drawerTrapSide === 'rail' ? '.dshwd-rail' : '.dshwd-inspector')
    if (!scope) return undefined
    return attachFocusTrap({
      doc: document as any,
      root: scope,
      // The stage belongs to this board, so Tab there returns to the sheet;
      // host chat/widgets outside keep their own order.
      owns: (active: any) => !!root && typeof root.contains === 'function' && root.contains(active),
    })
  }, [drawerTrapSide])

  React.useEffect(() => {
    if (!focusStage.current) return
    focusStage.current = false
    const root: any = rootRef.current
    const btn: any = root && root.querySelector('.dshwd-stage .dshwd-topbar button')
    if (btn && typeof btn.focus === 'function') btn.focus()
  }, [selectedTaskId, tab])

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
        // Every overlay owns its own Escape/focus lifecycle (shared dialog
        // hook or the host modal), so the board must not close them twice.
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
      if (e.key === 'Escape' && narrow) {
        const next = dismissDrawer({ railHidden, inspectorHidden }, narrow, !!selectedTask)
        if (next.closed) { e.preventDefault(); setDrawers(next.state); return }
      }
      if (!typing && e.key === '[') { e.preventDefault(); toggleSide('rail'); return }
      if (!typing && e.key === ']') { e.preventDefault(); toggleSide('inspector'); return }
      if (e.key === 'Escape' && active === searchRef.current && query) setQuery('')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [query, publishOpen, addOpen, confirm, stashView, busy, selectedProjectId, views, narrow, railHidden, inspectorHidden, selectedTaskId])

  const selectTask = (id: string, projectId?: string) => {
    const found = views.flatMap((v: ProjectView) => v.tasks).find((x: TaskView) => x.task.id === id)
    const owner = projectId || (found ? found.task.projectId : '')
    setSelectedTaskId(id)
    if (owner) setSelectedProjectId(owner)
    setTab('overview')
    if (narrow && !railHidden) {
      drawerReturn.current = null
      focusStage.current = true
      setRailHidden(true)
    }
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

  // The active view is derived, never stored: any manual filter change falls
  // back to "custom" without extra state to keep in sync.
  const currentView: ViewState = React.useMemo(
    () => ({ query, filter, tag: tagFilter, showArchived }),
    [query, filter, tagFilter, showArchived],
  )
  const activeViewId = React.useMemo(() => {
    const match = savedViews.find((view: SavedView) => sameViewState(view, currentView))
    return match ? match.id : ''
  }, [savedViews, currentView])

  const applyView = (view: SavedView) => {
    setQuery(view.query)
    setFilter(view.filter)
    setTagFilter(view.tag)
    setShowArchived(view.showArchived)
  }

  // A full or disabled localStorage must not lose the view: it still applies
  // for this session, and the toast says the list will not survive a reload.
  const persistViews = (next: SavedView[], message: string) => {
    const stored = saveSavedViews(next)
    say(stored.ok ? message : String(t.savedViewSessionOnly), false)
  }

  const saveView = (name: string): { ok: true } | { ok: false; error: string } => {
    const created = createSavedView(currentView, name)
    if (!created.ok) {
      const error = created.reason === 'name-empty'
        ? String(t.savedViewNameEmpty)
        : created.reason === 'name-too-long'
          ? String(t.savedViewNameTooLong).replace('{n}', String(SAVED_VIEW_NAME_MAX))
          : String(t.savedViewStateInvalid)
      return { ok: false, error }
    }
    // Updating an existing name is always allowed; only a brand-new view needs
    // room in the list.
    const key = created.view.name.trim().toLowerCase()
    const updating = savedViews.some((view: SavedView) => view.id === created.view.id || view.name.trim().toLowerCase() === key)
    if (!updating && savedViews.length >= SAVED_VIEW_LIMIT) {
      return { ok: false, error: String(t.savedViewLimit).replace('{n}', String(SAVED_VIEW_LIMIT)) }
    }
    const next = upsertSavedView(savedViews, created.view)
    setSavedViews(next)
    persistViews(next, String(t.savedViewSaved).replace('{name}', created.view.name))
    return { ok: true }
  }

  const deleteView = (id: string) => {
    const target = savedViews.find((view: SavedView) => view.id === id)
    if (!target) return
    const next = removeSavedView(savedViews, id)
    setSavedViews(next)
    persistViews(next, String(t.savedViewDeleted).replace('{name}', target.name))
  }

  // Status drives both the Stage chip and the acceptance report label, so it is
  // resolved once before the action hook reads it.
  const archived = !!(selectedTask && selectedTask.task.archivedAt)
  const running = selectedTask ? runningOf(selectedTask.task) : false
  const pending = !!(selectedTask && selectedTask.task.sessionId && pendingMap[selectedTask.task.sessionId])
  const status = selectedTask ? boardStatus(selectedTask.snapshot.status, running) : null
  const statusKey = status ? status.key : ''
  const cta = selectedTask && status ? boardCta(status, !!selectedTask.task.sessionId) : null
  const statusLabel = status ? boardStatusLabel(t, status) : ''

  const actions = useBoardActions({
    t,
    remotes,
    selectedTask,
    selectedProjectId,
    projectOfTask,
    diff,
    statusLabel,
    views,
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
    mergeGateMissing: selectedTask ? mergeGateMissing(projectOfTask && projectOfTask.project, selectedTask.task, selectedTask.snapshot.status) : 0,
  }), [t, selectedTask, statusKey, running, pending, previewState, otherReviewing, projectOfTask])

  const baseSha = selectedTask
    ? diffBaseSha(selectedTask.task, selectedTask.snapshot, previewRef.current && previewRef.current.preview ? (previewRef.current.preview.expectedBase || null) : null)
    : ''
  const canArchive = !!(selectedTask && (selectedTask.snapshot.status === 'merged' || selectedTask.snapshot.status === 'cleaned' || archived))
  const archiveReason = selectedTask && !canArchive ? t.archiveMergedOnly : ''
  const archivedCount = views.reduce((n: number, v: ProjectView) => n + v.tasks.filter((x: TaskView) => x.task.archivedAt).length, 0)

  // One attention map feeds the rows, the filter counts and the summary bar, so
  // they can never disagree about what needs attention.
  const allViews: TaskView[] = React.useMemo(() => {
    const out: TaskView[] = []
    for (const view of views) for (const tv of view.tasks) out.push(tv)
    return out
  }, [views])
  const shownViews = React.useMemo(() => visibleProjectViews(views, showArchived), [views, showArchived])
  // Tag options come from every task, archived or not, so the dropdown does not
  // flicker while the archive toggle changes what the list shows.
  const tagOptions = React.useMemo(() => collectTags(views), [views])
  React.useEffect(() => {
    if (tagFilter && tagOptions.indexOf(tagFilter) < 0) setTagFilter('')
  }, [tagFilter, tagOptions])
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
        stalledDays: stalledDays(tv.task, tv.snapshot),
        // Overdue comes from the stored deadline; a task can be overdue and
        // stalled at the same time (they are separate categories).
        overdueDays: (() => {
          const due = dueStateOf(tv.task.dueAt)
          return due && due.kind === 'overdue' ? due.days : 0
        })(),
      }))
    }
    return map
  }, [allViews, pendingMap, sessionMap, healthMap, err])
  const attentionOf = React.useCallback((tv: TaskView) => attentionMap.get(tv.task.id) || EMPTY_ATTENTION, [attentionMap])
  // Dependencies are resolved against every task, archived or not, so a chip
  // never flaps while the archive toggle changes what the list shows.
  const taskLookup = React.useMemo(() => {
    const map = new Map<string, any>()
    for (const tv of allViews) map.set(tv.task.id, tv.task)
    return map
  }, [allViews])
  const depsOf = React.useCallback((task: any) => dependencyStatus(task, taskLookup), [taskLookup])
  const dependencyItems = React.useMemo(() => {
    if (!selectedTask) return undefined
    const ids: string[] = Array.isArray(selectedTask.task.dependsOn) ? selectedTask.task.dependsOn : []
    return ids.map((id) => {
      const dep = taskLookup.get(id)
      if (!dep) return { id, title: id, done: false, missing: true }
      return { id, title: String(dep.title || id), done: isDependencyDone(dep), missing: false }
    })
  }, [selectedTask, taskLookup])
  const dependencyOptions = React.useMemo(() => {
    if (!selectedTask) return undefined
    return allViews
      .filter((tv) => tv.task.id !== selectedTask.task.id
        && !tv.task.archivedAt
        && !tv.task.cleanedAt
        && isSameProject(selectedTask.task, tv.task))
      .slice()
      .sort((a, b) => compareTaskOrder(a.task, b.task))
      .map((tv) => ({ id: tv.task.id, title: String(tv.task.title || tv.task.id), done: isDependencyDone(tv.task) }))
  }, [allViews, selectedTask])
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
    tagFilter,
  )
  // Only an actually empty result may own the rail; a search or filter that
  // still matched rows must keep rendering them. While the first load is in
  // flight, show nothing rather than claiming there are no projects.
  const emptyKind = railEmptyKind(views, filtered, query, filter, loaded, tagFilter)

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
        tags: tagOptions,
        tagFilter,
        onTagFilter: setTagFilter,
        showArchived,
        archivedCount,
        theme,
        runningOf,
        pendingOf,
        healthOf,
        attentionOf,
        depsOf,
        counts,
        attentionTotal: counts.total,
        attentionStale: !!err,
        lastOkAt,
        emptyKind,
        loaded,
        savedViews,
        activeViewId,
        onApplyView: applyView,
        onSaveView: saveView,
        onDeleteView: deleteView,
        onQuery: setQuery,
        onFilter: setFilter,
        onToggleArchived: toggleArchived,
        onSelectTask: selectTask,
        onSelectProject: selectProject,
        onQuick: runQuick,
        onPublish: () => openPublish(),
        onPinTask: actions.runPin,
        onAddProject: () => setAddOpen(true),
        onToggleTheme: toggleTheme,
        searchRef,
        environment,
        narrow,
        onClose: closeDrawers,
      }),
      narrow && (railHidden === false || (inspectorHidden === false && !!selectedTask))
        ? h('button', {
          type: 'button',
          className: 'dshwd-scrim',
          'aria-label': t.close,
          tabIndex: -1,
          onClick: closeDrawers,
        })
        : null,

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
          onSaveMeta: actions.runSaveMeta,
          onTimer: actions.runTimer,
          metaBusy: !!busy,
          dependencyItems,
          dependencyOptions,
          onCopyReport: actions.runCopyReport,
          onDownloadReport: actions.runDownloadReport,
          // Any in-flight action freezes the snapshot the report would read.
          reportBusy: !!busy,
          onCopyHandover: actions.runCopyHandover,
          onDownloadHandover: actions.runDownloadHandover,
          handoverBusy: !!busy,
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
          onSendPrompt: actions.runPrompt,
          promptBusy: !!busy,
          baseSha,
          headSha,
          onToggleRail: () => toggleSide('rail'),
          onToggleInspector: () => toggleSide('inspector'),
          narrow,
          railHidden,
          inspectorHidden,
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
                cfg: configDirName ? { dirName: configDirName } : null,
                pendingMap,
                sessionMap,
                t,
                railHidden,
                inspectorHidden,
                narrow,
                onToggleRail: () => toggleSide('rail'),
                onToggleInspector: () => toggleSide('inspector'),
                notify: say,
                onChanged: refresh,
                onPublish: () => openPublish(selectedProject.project.id),
                onSelectTask: (id: string) => selectTask(id, selectedProject.project.id),
                onDeleted: refresh,
              })))
          : h('main', { className: 'dshwd-stage' },
            h('div', { className: 'dshwd-topbar' },
              h('div', { className: 'dshwd-topbar-left' },
                h('button', {
                  className: 'dshwd-btn dshwd-btn-ghost',
                  title: t.boardCollapseLeft,
                  'aria-label': t.boardCollapseLeft,
                  'aria-expanded': railHidden ? 'false' : 'true',
                  onClick: () => toggleSide('rail'),
                }, '◧'),
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
          pending: pendingOf(selectedTask.task),
          narrow,
          onClose: () => setDrawers(closeDrawer({ railHidden, inspectorHidden }, 'inspector')),
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
        configDirName,
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
      labelFor: confirm.labelFor,
      error: confirm.error,
      busy: !!busy,
      onCancel: () => setConfirm(null),
      onConfirm: (values: Record<string, boolean>) => {
        if (!confirm.run) return
        setBusy('confirm')
        Promise.resolve(confirm.run(values || {}))
          .then(() => setConfirm(null))
          .catch((e: any) => {
            // A 409 (new blocker, dirty tree) must not throw the dialog away:
            // the checks the user just ticked still describe what they wanted.
            const message = String((e && e.message) || t.failed)
            say(message, true)
            setConfirm((prev: any) => (prev ? Object.assign({}, prev, { error: message }) : prev))
          })
          .finally(() => setBusy(''))
      },
    }) : null,

    toast ? h('div', { className: 'dshwd-toast dshwd-show' + (toast.error ? ' dshwd-error' : ''), role: toast.error ? 'alert' : 'status' }, toast.message) : null)
}
