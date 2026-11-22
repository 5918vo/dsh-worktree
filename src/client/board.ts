/**
 * Workbench board shell: three-zone layout (Rail / Stage / Inspector),
 * theme & container responsiveness, keyboard shortcuts, and modal coordination.
 * Data polling lives in `./board/use-board-data`, actions in `./board/use-board-actions`,
 * and confirmation/stash dialogs in `./board/dialogs`.
 */

import { React, h, useStyles } from './ui'
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
import { ConfirmDialog, StashDiffModal, type ConfirmState, type StashViewState } from './board/dialogs'
import { useBoardData } from './board/use-board-data'
import { useBoardActions } from './board/use-board-actions'
import {
  boardCta,
  boardStatus,
  diffBaseSha,
  filterViews,
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
  const say = (message: string, error = false) => {
    setToast({ message, error })
    setNotice(error ? { message } : null)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    // Failures need time to read; successes can stay brief.
    toastTimer.current = setTimeout(() => setToast(null), error ? 6000 : 2400)
  }

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
    entries,
    entriesReady,
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
    setPublishProjectId(projectId || selectedProjectId || (views[0] && views[0].project.id) || '')
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
    say,
    refresh,
  })

  const archived = !!(selectedTask && selectedTask.task.archivedAt)
  const cta = selectedTask
    ? boardCta(boardStatus(selectedTask.snapshot.status, runningOf(selectedTask.task)), !!selectedTask.task.sessionId)
    : null
  const baseSha = selectedTask
    ? diffBaseSha(selectedTask.task, selectedTask.snapshot, previewRef.current && previewRef.current.preview ? (previewRef.current.preview.expectedBase || null) : null)
    : ''
  const canArchive = !!(selectedTask && (selectedTask.snapshot.status === 'merged' || selectedTask.snapshot.status === 'cleaned' || archived))
  const archiveReason = selectedTask && !canArchive ? t.archiveMergedOnly : ''
  const archivedCount = views.reduce((n: number, v: ProjectView) => n + v.tasks.filter((x: TaskView) => x.task.archivedAt).length, 0)
  const filtered = filterViews(visibleProjectViews(views, showArchived), filter, query, runningOf)

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
        onQuery: setQuery,
        onFilter: setFilter,
        onToggleArchived: toggleArchived,
        onSelectTask: selectTask,
        onSelectProject: selectProject,
        onPublish: () => openPublish(),
        onAddProject: () => setAddOpen(true),
        onToggleTheme: toggleTheme,
        searchRef,
      }),

      selectedTask && projectOfTask && cta
        ? h(Stage, {
          t,
          taskView: selectedTask,
          projectName: projectOfTask.project.name,
          running: runningOf(selectedTask.task),
          tab,
          onTab: setTab,
          ctas: cta,
          disabledActions: busy ? { merge: t.working, checkout: t.working, back: t.working, cleanup: t.working, open: t.working, create: t.working, start: t.working, retry: t.working, continue: t.working } : {},
          onAction: actions.runAction,
          entries,
          entriesReady,
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
          baseSha,
          headSha,
          baseLabel: selectedTask.task.baseBranch,
          busy,
          canArchive,
          archiveReason,
          stashes: selectedTask.task.pendingStashes || [],
          partialRestore,
          narrow,
          onClose: () => setInspectorHidden(true),
          onCopy: (text: string) => { copyText(text); say(t.copied) },
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
        onClose: () => setPublishOpen(false),
        onPublished: (task: any, project: any, warning?: string, continued?: boolean) => {
          setPublishOpen(false)
          if (task) {
            setViews((prev: ProjectView[]) => upsertPublishedTask(prev, task, project.id, continued ? 'developing' : 'ready'))
            setSelectedTaskId(task.id)
            setSelectedProjectId(project.id)
            setTab('overview')
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
        onClose: () => setAddOpen(false),
        onAdded: (project: any) => {
          setAddOpen(false)
          if (project) {
            setSelectedProjectId(project.id)
            setSelectedTaskId('')
            say(String(t.projectAdded).replace('{name}', project.name || ''))
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
