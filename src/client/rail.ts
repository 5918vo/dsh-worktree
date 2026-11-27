import { React, h } from './ui'
import { Icon } from './primitives'
import { pad2, relTime, taskStamp } from './format'
import { railStatsText } from './model'
import type { ProjectView, TaskView } from '../models'
import { boardBranch, boardStat, boardStatTitle, boardStatus, boardStatusLabel, criteria, criteriaProgress, type BoardFilter, type BoardTheme } from './model'
import { dueStateOf, parseEstimate } from '../task-meta'
import { isWorkTiming } from '../task-timer'
import { useDialogFocus } from './dialog-focus'
import type { SavedView } from './saved-views'
import { AttentionFilter } from './attention-filter'
import { AttentionSummaryBar } from './attention-summary'
import { quickActionKey, type QuickAction, type SessionHealth, type TaskAttention } from './task-attention'
import { environmentWarnings, type EnvironmentInfo } from './environment'
import { railRowSignals, signalIcon, type RailSignal } from './rail-summary'
import type { DependencyStatus } from '../task-deps'

export type RailEmptyKind = '' | 'search' | 'tag' | 'filter' | 'no-projects' | 'no-tasks'

export interface RailProps {
  t: any
  views: ProjectView[]
  projectCount: number
  selectedTaskId: string
  selectedProjectId: string
  query: string
  filter: BoardFilter
  /** Tag options available in the current task set; empty hides the filter. */
  tags?: string[]
  tagFilter?: string
  onTagFilter?: (tag: string) => void
  showArchived: boolean
  archivedCount: number
  theme: BoardTheme
  runningOf: (task: any) => boolean
  pendingOf: (task: any) => string
  healthOf: (task: any) => SessionHealth | null
  attentionOf: (view: TaskView) => TaskAttention
  /** Prerequisite state of a task; omitted hides the "waiting on" chip. */
  depsOf?: (task: any) => DependencyStatus
  counts: Record<string, number>
  attentionTotal: number
  attentionStale: boolean
  /** Focus queue: rows shown (max 10), ready / waiting / open counts. */
  focusCount?: number
  focusReady?: number
  focusWaiting?: number
  focusTotal?: number
  onOpenFocus?: () => void
  lastOkAt: number
  emptyKind: RailEmptyKind
  /** False until the first project fetch lands; the foot shows placeholders. */
  loaded?: boolean
  /** Saved filter views, oldest first; empty still shows the "custom" option. */
  savedViews?: SavedView[]
  /** Id of the saved view matching the current filters; '' means custom. */
  activeViewId?: string
  onApplyView?: (view: SavedView) => void
  onSaveView?: (name: string) => { ok: true } | { ok: false; error: string }
  onDeleteView?: (id: string) => void
  onQuery: (value: string) => void
  onFilter: (filter: BoardFilter) => void
  onToggleArchived: () => void
  onSelectTask: (taskId: string, projectId: string) => void
  onSelectProject: (projectId: string) => void
  /** True when the stage shows the cross-project portfolio. */
  overviewActive?: boolean
  onSelectOverview: () => void
  onQuick: (action: QuickAction, view: TaskView, projectId: string) => void
  onPublish: () => void
  onAddProject: () => void
  onPinTask: (taskId: string, pinned: boolean) => void
  onToggleTheme: () => void
  searchRef: any
  /** Host capabilities from `GET config`; absent while loading or after failure. */
  environment?: EnvironmentInfo | null
  /** Narrow container: the rail is an overlay sheet with its own close control. */
  narrow?: boolean
  onClose?: () => void
}

export function Rail(props: RailProps) {
  const { t } = props
  const totalTasks = props.views.reduce((n, view) => n + view.tasks.length, 0)
  const totalRepos = props.views.length
  const [moreOpen, setMoreOpen] = React.useState('')
  const moreBtnRef = React.useRef(null as any)
  const [viewOpen, setViewOpen] = React.useState(false)
  const activeViewId = props.activeViewId || ''
  const savedViews = props.savedViews || []

  React.useEffect(() => {
    if (!moreOpen) return undefined
    const onPointer = (e: any) => {
      const root: any = moreBtnRef.current
      const wrap = root && root.closest ? root.closest('.dshwd-item') : null
      if (wrap && !wrap.contains(e.target)) setMoreOpen('')
    }
    document.addEventListener('pointerdown', onPointer, true)
    return () => document.removeEventListener('pointerdown', onPointer, true)
  }, [moreOpen])

  return h(React.Fragment, null,
    h('aside', {
    className: 'dshwd-rail',
    'aria-label': t.boardRailLabel,
    ...(props.narrow ? { role: 'dialog', 'aria-modal': 'true' } : null),
  },
    props.narrow && props.onClose
      ? h('div', { className: 'dshwd-drawer-head' },
        h('span', { className: 'dshwd-drawer-title' }, t.boardRailLabel),
        h('button', {
          className: 'dshwd-btn dshwd-btn-ghost dshwd-drawer-close',
          title: t.close,
          'aria-label': t.close,
          onClick: props.onClose,
        }, '×'))
      : null,
    h('div', { className: 'dshwd-rail-top' },
      h('div', { className: 'dshwd-logo' },
        h('span', { className: 'dshwd-logo-mark' }, 'W'),
        h('span', null, 'Worktree')),
      h('div', { style: { display: 'flex', gap: '4px', alignItems: 'center' } },
        h('button', {
          className: 'dshwd-btn dshwd-btn-ghost',
          style: { height: '25px', padding: '0 7px', fontSize: '11.5px' },
          title: t.addProject,
          'aria-label': t.addProject,
          onClick: props.onAddProject,
        }, '⊞'),
        h('button', { className: 'dshwd-btn dshwd-btn-cta', style: { height: '25px', padding: '0 9px', fontSize: '11.5px' }, title: String(t.boardPublishShortcut), onClick: props.onPublish }, '+ ', t.publish))),

    h('div', { className: 'dshwd-overview-row' },
      h('button', {
        type: 'button',
        className: 'dshwd-btn dshwd-btn-ghost dshwd-overview-btn',
        'aria-pressed': props.overviewActive ? 'true' : 'false',
        title: t.portfolioTitle,
        'aria-label': t.portfolioTitle,
        onClick: props.onSelectOverview,
      }, h(Icon, { name: 'grid' }), h('span', null, t.portfolioTitle))),

    h('div', { className: 'dshwd-rail-controls' },
      environmentWarnings(props.environment).map((kind) => h('div', {
        key: kind,
        className: 'dshwd-notice dshwd-alert dshwd-alert-warn',
        role: 'status',
      },
        h('div', { className: 'dshwd-notice-text' },
          h('div', { className: 'dshwd-notice-title' }, kind === 'git' ? props.t.gitTooOldTitle : props.t.longPathsTitle),
          h('div', { className: 'dshwd-hint' }, kind === 'git' ? props.t.gitTooOldHint : props.t.longPathsHint)))),
      h('div', { className: 'dshwd-search-wrap' },
        h('input', {
          ref: props.searchRef,
          className: 'dshwd-search',
          value: props.query,
          placeholder: t.boardSearch,
          'aria-label': t.boardSearch,
          'aria-description': t.searchSyntaxHint,
          title: t.searchSyntaxHint,
          onInput: (e: any) => props.onQuery(e.target.value),
        }),
        h('span', { className: 'dshwd-search-kbd dshwd-mono' }, '/')),
      props.query ? null : h('div', { className: 'dshwd-search-hint' }, t.searchSyntaxHint),
      h('div', { className: 'dshwd-view-row' },
        h('div', { className: 'dshwd-view-pick' },
          h('select', {
            className: 'dshwd-view-select',
            value: activeViewId,
            'aria-label': t.savedViewSelect,
            title: t.savedViewSelect,
            onChange: (e: any) => {
              const view = savedViews.find((item) => item.id === e.target.value)
              if (view && props.onApplyView) props.onApplyView(view)
            },
          },
            h('option', { value: '' }, t.savedViewCustom),
            savedViews.map((view) => h('option', { key: view.id, value: view.id }, view.name)))),
        h('button', {
          type: 'button',
          className: 'dshwd-btn dshwd-btn-ghost dshwd-view-btn',
          title: t.savedViewSave,
          'aria-label': t.savedViewSave,
          onClick: () => setViewOpen(true),
        }, t.savedViewSave),
        activeViewId
          ? h('button', {
            type: 'button',
            className: 'dshwd-btn dshwd-btn-ghost dshwd-view-delete',
            title: t.savedViewDelete,
            'aria-label': t.savedViewDelete,
            onClick: () => { if (props.onDeleteView) props.onDeleteView(activeViewId) },
          }, h(Icon, { name: 'trash' }))
          : null),
      props.tags && props.tags.length
        ? h('div', { className: 'dshwd-tag-filter-wrap' },
          h('select', {
            className: 'dshwd-tag-filter',
            value: props.tagFilter || '',
            'aria-label': t.taskTagFilter,
            title: t.taskTagFilter,
            onChange: (e: any) => { if (props.onTagFilter) props.onTagFilter(e.target.value) },
          },
            h('option', { value: '' }, t.taskTagAll),
            props.tags.map((tag) => h('option', { key: tag, value: tag }, '#' + tag))))
        : null,
      h('div', { className: 'dshwd-rail-tools' },
        h(AttentionFilter, { t, value: props.filter, counts: props.counts, onChange: props.onFilter }),
        props.archivedCount > 0 || props.showArchived
          ? h('button', {
            className: 'dshwd-btn dshwd-btn-ghost dshwd-archive-toggle',
            'aria-pressed': props.showArchived,
            title: String(t.archiveToggleTitle).replace('{n}', String(props.archivedCount)),
            onClick: props.onToggleArchived,
          }, props.showArchived ? t.hideArchived : t.showArchived,
            h('span', { className: 'dshwd-mono', style: { marginLeft: '5px', color: 'var(--text-3)' } }, String(props.archivedCount)))
          : null)),

    h(AttentionSummaryBar, {
      t,
      counts: summaryCounts(props),
      total: props.attentionTotal,
      stale: props.attentionStale,
      lastOkAt: props.lastOkAt,
      onView: props.onFilter,
    }),

    props.focusTotal && props.focusTotal > 0
      ? h('button', {
        type: 'button',
        className: 'dshwd-focus-entry',
        'aria-haspopup': 'dialog',
        'aria-label': String(t.focusEntryLabel).replace('{n}', String(props.focusReady || 0)),
        title: t.focusEntryTitle,
        onClick: props.onOpenFocus,
      },
        h('span', { className: 'dshwd-focus-entry-icon', 'aria-hidden': 'true' }, h(Icon, { name: 'circle' })),
        h('span', { className: 'dshwd-focus-entry-text' }, t.focusTitle),
        h('span', { className: 'dshwd-focus-entry-count dshwd-mono' }, String(props.focusCount || 0)))
      : null,

    h('div', { className: 'dshwd-rail-list' },
      props.emptyKind === 'no-projects'
        ? h('div', { className: 'dshwd-empty', style: { minHeight: '160px' } },
          h('div', { className: 'dshwd-empty-title' }, t.noProjects),
          h('div', { className: 'dshwd-hint' }, t.noProjectsHint),
          props.projectCount === 0
            ? h('button', { className: 'dshwd-btn dshwd-btn-cta', onClick: props.onAddProject }, t.addProject)
            : null)
        : props.emptyKind === 'search'
          ? h('div', { className: 'dshwd-empty', style: { minHeight: '160px' } },
            h('div', { className: 'dshwd-empty-title' }, t.boardNoMatches),
            h('div', { className: 'dshwd-hint' }, t.boardClearSearch),
            h('button', { className: 'dshwd-btn dshwd-btn-ghost', onClick: () => props.onQuery('') }, t.boardClearSearch))
          : props.emptyKind === 'tag'
            ? h('div', { className: 'dshwd-empty', style: { minHeight: '160px' } },
              h('div', { className: 'dshwd-empty-title' }, t.taskTagNoMatch),
              h('div', { className: 'dshwd-hint' }, t.taskTagNoMatchHint),
              h('button', { className: 'dshwd-btn dshwd-btn-ghost', onClick: () => props.onTagFilter && props.onTagFilter('') }, t.taskTagAll))
            : props.emptyKind === 'filter'
              ? h('div', { className: 'dshwd-empty', style: { minHeight: '160px' } },
                h('div', { className: 'dshwd-empty-title' }, t.attentionEmptyTitle),
                h('div', { className: 'dshwd-hint' }, t.attentionEmptyHint),
                h('button', { className: 'dshwd-btn dshwd-btn-ghost', onClick: () => props.onFilter('all') }, t.attentionAll))
              : props.views.map((view) => h('div', { key: view.project.id },
              h('button', {
                className: 'dshwd-group-head',
                title: t.boardOpenProject,
                onClick: () => props.onSelectProject(view.project.id),
              },
                h('span', null, view.project.name),
                h('span', { className: 'dshwd-mono' }, String(view.tasks.length))),
              view.tasks.length
                ? view.tasks.map((tv) => taskRow(t, tv, view, props, moreOpen, setMoreOpen, moreBtnRef))
                : h('div', { className: 'dshwd-hint', style: { padding: '0 8px 8px 24px', fontSize: '11px' } }, t.noTasks)))),

    h('div', { className: 'dshwd-rail-foot' },
      h('span', { className: 'dshwd-mono', style: { fontSize: '11px', color: 'var(--text-3)' } },
        props.loaded === false ? '—' : railStatsText(t, totalRepos, totalTasks)),
      h('button', {
        className: 'dshwd-btn dshwd-btn-ghost',
        style: { height: '24px', fontSize: '11px' },
        // The switch only restyles this panel; the host chrome keeps its own theme.
        title: (props.theme === 'dark' ? t.boardThemeLight : t.boardThemeDark) + ' · ' + t.boardThemeScope,
        'aria-label': (props.theme === 'dark' ? t.boardThemeLight : t.boardThemeDark) + ' · ' + t.boardThemeScope,
        onClick: props.onToggleTheme,
      }, props.theme === 'dark' ? t.boardThemeLight : t.boardThemeDark))),
    viewOpen
      ? h(SaveViewDialog, {
        t,
        onSave: (name: string) => (props.onSaveView
          ? props.onSaveView(name)
          : { ok: false, error: String(t.savedViewSaveFailed) }),
        onClose: () => setViewOpen(false),
      })
      : null)
}

interface SaveViewDialogProps {
  t: Record<string, any>
  onSave: (name: string) => { ok: true } | { ok: false; error: string }
  onClose: () => void
}

/** Lightweight shell shared with the board's confirm dialogs (board-scoped CSS). */
function SaveViewDialog(props: SaveViewDialogProps) {
  const { t } = props
  const [name, setName] = React.useState('')
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const rootRef = React.useRef(null as any)
  const inputRef = React.useRef(null as any)
  const busyRef = React.useRef(false)
  busyRef.current = busy
  // Initial focus, Tab trap, Escape and focus restore to the opener.
  useDialogFocus({ rootRef, initialRef: inputRef, busyRef, onClose: props.onClose })
  const inputId = 'dshwd-view-name'
  const errorId = 'dshwd-view-name-error'

  const submit = () => {
    if (busy) return
    setBusy(true)
    setError('')
    let result: { ok: true } | { ok: false; error: string }
    try {
      result = props.onSave(name)
    } finally {
      setBusy(false)
    }
    if (result.ok) props.onClose()
    else setError(result.error)
  }

  return h('div', {
    className: 'dshwd-modal-backdrop',
    onMouseDown: (e: any) => {
      if (e.target === e.currentTarget && !busy) props.onClose()
    },
  },
    h('div', {
      ref: rootRef,
      className: 'dshwd-modal dshwd-modal-sm',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': inputId + '-title',
      tabIndex: -1,
    },
      h('div', { className: 'dshwd-modal-head' },
        h('div', { className: 'dshwd-modal-title', id: inputId + '-title' }, t.savedViewDialogTitle),
        h('button', {
          type: 'button',
          className: 'dshwd-btn dshwd-btn-ghost',
          title: t.close,
          'aria-label': t.close,
          disabled: busy,
          onClick: props.onClose,
        }, '×')),
      h('div', { className: 'dshwd-modal-body' },
        h('label', { className: 'dshwd-field' },
          h('span', { className: 'dshwd-label' },
            h('span', { className: 'dshwd-label-text' }, t.savedViewNameLabel)),
          h('input', {
            ref: inputRef,
            id: inputId,
            className: 'dshwd-input' + (error ? ' dshwd-invalid' : ''),
            value: name,
            placeholder: t.savedViewNamePlaceholder,
            'aria-invalid': error ? 'true' : 'false',
            'aria-describedby': error ? errorId : undefined,
            onInput: (e: any) => setName(e.target.value),
            onKeyDown: (e: any) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              }
            },
          })),
        h('div', { className: 'dshwd-hint' }, t.savedViewDialogHint),
        error ? h('div', { className: 'dshwd-alert', role: 'alert', id: errorId }, error) : null),
      h('div', { className: 'dshwd-modal-foot' },
        h('span', { className: 'dshwd-modal-foot-meta' }),
        h('div', { className: 'dshwd-modal-foot-actions' },
          h('button', { type: 'button', className: 'dshwd-btn', disabled: busy, onClick: props.onClose }, t.cancel),
          h('button', { type: 'button', className: 'dshwd-btn dshwd-btn-cta', disabled: busy, onClick: submit },
            busy ? t.savedViewSaving : t.savedViewSaveAction)))))
}

/** The bar reports every category with a count, even when the list is filtered. */
function summaryCounts(props: RailProps): Record<string, number> {
  return props.counts || {}
}

const QUICK_ICON: Record<QuickAction, string> = {
  recover: 'refresh',
  handle: 'message',
  review: 'checkCircle',
  'open-session': 'terminal',
}

function taskRow(
  t: any,
  tv: TaskView,
  view: ProjectView,
  props: RailProps,
  moreOpen: string,
  setMoreOpen: (id: string) => void,
  moreBtnRef: any,
) {
  const task = tv.task
  const running = props.runningOf(task)
  const status = boardStatus(tv.snapshot.status, running)
  const pendingKind = props.pendingOf(task)
  const health = props.healthOf(task)
  const attention = props.attentionOf(tv)
  const active = props.selectedTaskId === task.id
  const open = moreOpen === task.id
  const quick = attention.quickAction

  // One alarm per row: the most urgent signal wins the second chip and every
  // other one waits in "more states". Static metadata (tags, estimate, a plain
  // priority, a far-off deadline) is not an alarm and lives in the stage meta
  // block; structured search still finds tasks by tag and priority.
  const estimate = parseEstimate(task.estimate)
  const deps = props.depsOf ? props.depsOf(task) : null
  const due = dueStateOf(task.dueAt)
  const startedAt = isWorkTiming(task) ? new Date(Number(task.workStartedAt)) : null
  const signals = railRowSignals({
    t,
    statusLabel: boardStatusLabel(t, status),
    statusTone: status.chip || '',
    pendingKind,
    taskStatus: tv.snapshot.status,
    health,
    running,
    attention,
    deps,
    due,
    criteria: criteriaProgress(criteria(task, tv.snapshot.status)),
    estimate: estimate.ok && estimate.value != null ? estimate.value : null,
    timerClock: startedAt ? pad2(startedAt.getHours()) + ':' + pad2(startedAt.getMinutes()) : '',
    postMergeAhead: Number((tv.snapshot && tv.snapshot.postMergeAhead) || 0),
    tags: task.tags,
    priority: task.priority,
  })
  const chips = signals.lead ? [signals.status, signals.lead] : [signals.status]
  const moreCount = signals.more.length

  return h('div', {
    key: task.id,
    className: 'dshwd-item' + (active ? ' dshwd-active' : '') + (open ? ' dshwd-item-more-open' : ''),
  },
    h('button', {
      type: 'button',
      className: 'dshwd-item-main',
      'aria-current': active ? 'true' : 'false',
      onClick: () => props.onSelectTask(task.id, view.project.id),
    },
      h('div', { className: 'dshwd-item-row1' },
        h('span', { className: 'dshwd-dot dshwd-' + status.dot, 'aria-hidden': 'true' }),
        task.pinnedAt ? h('span', { className: 'dshwd-pin-mark', 'aria-hidden': 'true' }, h(Icon, { name: 'pin' })) : null,
        h('span', { className: 'dshwd-item-title' }, task.title),
        h('span', { className: 'dshwd-item-stat dshwd-mono', title: boardStatTitle(t, tv.snapshot) }, boardStat(tv.snapshot))),
      h('div', { className: 'dshwd-item-row2' },
        h('span', { className: 'dshwd-mono' }, boardBranch(task.branch)),
        h('span', null, task.archivedAt ? t.archived : relTime(taskStamp(task, tv.snapshot), t))),
      h('div', { className: 'dshwd-item-chips' }, chips.map((signal: RailSignal) =>
        h('span', {
          key: signal.kind,
          className: 'dshwd-chip' + (signal.tone ? ' dshwd-' + signal.tone : ''),
          title: signal.title || signal.label,
        }, signal.label)))),

    h('div', { className: 'dshwd-item-actions' },
      h('button', {
        type: 'button',
        className: 'dshwd-item-action dshwd-pin' + (task.pinnedAt ? ' dshwd-item-action-on' : ''),
        title: task.pinnedAt ? t.unpinTask : t.pinTask,
        'aria-label': (task.pinnedAt ? t.unpinTask : t.pinTask) + (active ? ' · ' + task.title : ''),
        'aria-pressed': task.pinnedAt ? 'true' : 'false',
        onClick: () => props.onPinTask(task.id, !task.pinnedAt),
      }, h(Icon, { name: 'pin' })),
      moreCount
        ? h('button', {
          ref: open ? moreBtnRef : undefined,
          type: 'button',
          className: 'dshwd-item-action' + (open ? ' dshwd-item-action-on' : ''),
          title: t.moreStates,
          'aria-label': t.moreStates + ' · ' + String(moreCount) + (active ? ' · ' + task.title : ''),
          'aria-expanded': open ? 'true' : 'false',
          onClick: () => setMoreOpen(open ? '' : task.id),
          onKeyDown: (e: any) => {
            if (e.key === 'Escape' && open) {
              e.preventDefault()
              e.stopPropagation()
              setMoreOpen('')
              if (moreBtnRef.current) moreBtnRef.current.focus()
            }
          },
        }, h(Icon, { name: 'more' }))
        : null,
      quick
        ? h('button', {
          type: 'button',
          className: 'dshwd-item-action' + (quick === 'handle' ? ' dshwd-item-action-cta' : ''),
          title: t[quickActionKey(quick)],
          'aria-label': t[quickActionKey(quick)] + ' · ' + task.title,
          onClick: () => props.onQuick(quick, tv, view.project.id),
        }, h(Icon, { name: QUICK_ICON[quick] }))
        : null),

    open
      ? h('div', { className: 'dshwd-more', role: 'group', 'aria-label': t.moreStates },
        h('div', { className: 'dshwd-more-head' }, t.moreStates),
        signals.more.map((signal: RailSignal) => h('div', { key: signal.kind, className: 'dshwd-more-item' + (signal.tone === 'err' ? ' dshwd-more-item-err' : '') },
          h(Icon, { name: signalIcon(signal.kind) }),
          h('span', { title: signal.title }, signal.label))))
      : null)
}
