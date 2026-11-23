import { React, h } from './ui'
import { Icon } from './primitives'
import { relTime, taskStamp } from './format'
import { railStatsText } from './model'
import type { ProjectView, TaskView } from '../models'
import { boardBranch, boardStat, boardStatTitle, boardStatus, boardStatusLabel, type BoardFilter, type BoardTheme } from './model'
import { dueStateOf } from '../task-meta'
import { pendingLabel, postMergeLabel } from './status'
import { AttentionFilter } from './attention-filter'
import { AttentionSummaryBar } from './attention-summary'
import { quickActionKey, type QuickAction, type SessionHealth, type TaskAttention } from './task-attention'
import { environmentWarnings, type EnvironmentInfo } from './environment'
import { fill } from './markdown'
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
  lastOkAt: number
  emptyKind: RailEmptyKind
  /** False until the first project fetch lands; the foot shows placeholders. */
  loaded?: boolean
  onQuery: (value: string) => void
  onFilter: (filter: BoardFilter) => void
  onToggleArchived: () => void
  onSelectTask: (taskId: string, projectId: string) => void
  onSelectProject: (projectId: string) => void
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

  return h('aside', {
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
      }, props.theme === 'dark' ? t.boardThemeLight : t.boardThemeDark)))
}

/** The bar reports every category with a count, even when the list is filtered. */
function summaryCounts(props: RailProps): Record<string, number> {
  return props.counts || {}
}

function chip(label: string, tone: string, title?: string) {
  return h('span', { className: 'dshwd-chip dshwd-chip-sm' + (tone ? ' dshwd-' + tone : ''), title: title || label }, label)
}

const QUICK_ICON: Record<QuickAction, string> = {
  recover: 'refresh',
  handle: 'message',
  review: 'checkCircle',
  'open-session': 'terminal',
}

/** Alert copy shared by the row chip and the "more states" popover. */
function alertText(t: any, kind: string, tv: TaskView, pendingKind: string, health: SessionHealth | null, stalledDays?: number): string {
  switch (kind) {
    case 'recovery': return t.attentionRecovery
    case 'pending': return pendingLabel(t, pendingKind)
    case 'broken': return t.attentionBroken
    case 'stalled': return String(t.attentionStalledDays).replace('{n}', String(stalledDays || 0))
    case 'post-merge': return postMergeLabel(t, Number((tv.snapshot && tv.snapshot.postMergeAhead) || 0))
    case 'session':
      if (!health) return t.sessionIdle
      return health.kind === 'interrupted' ? t.sessionInterrupted : t.sessionError
    default: return ''
  }
}

function alertTone(kind: string): string {
  if (kind === 'broken' || kind === 'session') return 'err'
  return 'warn'
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
  const extras = attention.extraAlerts.filter((kind) => kind !== 'pending' && !(kind === 'session' && health))
  const open = moreOpen === task.id
  const quick = attention.quickAction

  const chips = [chip(pendingKind ? pendingLabel(t, pendingKind) : boardStatusLabel(t, status), pendingKind ? 'warn' : status.chip)]
  if (task.sessionId && !pendingKind) {
    // A new turn makes an earlier failure historical: show the live state.
    if (health && !running) {
      chips.push(chip(
        health.kind === 'interrupted' ? t.sessionInterrupted : t.sessionError,
        health.kind === 'interrupted' ? 'warn' : 'err',
        (health.kind === 'interrupted' ? t.sessionInterruptedHint : t.sessionErrorHint) + (health.message ? ' · ' + health.message : ''),
      ))
    } else {
      chips.push(chip(running ? t.sessionRunning : t.sessionIdle, running ? 'accent' : ''))
    }
  }
  const primary = attention.primaryAlert
  if (task.priority === 'high') chips.push(chip(t.priorityHigh, 'warn'))
  else if (task.priority === 'low') chips.push(chip(t.priorityLow, 'weak'))
  // Advisory only: a blocked task keeps its status and sort order.
  const deps = props.depsOf ? props.depsOf(task) : null
  if (deps && deps.blocked) {
    chips.push(chip(fill(t.taskDepsBlocked, { n: deps.open.length }), 'warn', deps.open.map((item) => item.title).join(', ')))
  }
  // Deadline chip: overdue is an error tone, today/soon a warning. Later dates
  // stay out of the row so a far-off deadline does not add noise.
  const due = dueStateOf(task.dueAt)
  if (due && due.kind === 'overdue') {
    chips.push(chip(String(t.taskDueOverdue).replace('{n}', String(due.days)), 'err', t.taskDueHint))
  } else if (due && due.kind === 'today') {
    chips.push(chip(t.taskDueToday, 'warn', t.taskDueHint))
  } else if (due && due.kind === 'soon') {
    chips.push(chip(String(t.taskDueSoon).replace('{n}', String(due.days)), 'warn', t.taskDueHint))
  }
  // Two tags at most: the row stays one line; the full list lives in the title
  // and in "+N" so nothing is lost.
  const tags: string[] = Array.isArray(task.tags) ? task.tags : []
  const tagsTitle = tags.join(', ')
  if (tags.length) {
    chips.push(chip(tags.slice(0, 2).map((tag) => '#' + tag).join(' '), 'tag', tagsTitle))
    if (tags.length > 2) chips.push(chip('+' + String(tags.length - 2), 'tag', tagsTitle))
  }
  if (primary && primary !== 'pending' && primary !== 'session') {
    chips.push(chip(alertText(t, primary, tv, pendingKind, health, attention.stalledDays), alertTone(primary)))
  }

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
      h('div', { className: 'dshwd-item-chips' }, chips)),

    h('div', { className: 'dshwd-item-actions' },
      h('button', {
        type: 'button',
        className: 'dshwd-item-action dshwd-pin' + (task.pinnedAt ? ' dshwd-item-action-on' : ''),
        title: task.pinnedAt ? t.unpinTask : t.pinTask,
        'aria-label': (task.pinnedAt ? t.unpinTask : t.pinTask) + (active ? ' · ' + task.title : ''),
        'aria-pressed': task.pinnedAt ? 'true' : 'false',
        onClick: () => props.onPinTask(task.id, !task.pinnedAt),
      }, h(Icon, { name: 'pin' })),
      extras.length
        ? h('button', {
          ref: open ? moreBtnRef : undefined,
          type: 'button',
          className: 'dshwd-item-action' + (open ? ' dshwd-item-action-on' : ''),
          title: t.moreStates,
          'aria-label': t.moreStates + (active ? ' · ' + task.title : ''),
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
        extras.map((kind) => h('div', { key: kind, className: 'dshwd-more-item' + (kind === 'broken' || kind === 'session' ? ' dshwd-more-item-err' : '') },
          h(Icon, { name: kind === 'broken' || kind === 'session' ? 'alert' : 'clock' }),
          h('span', null, alertText(t, kind, tv, pendingKind, health, attention.stalledDays)))))
      : null)
}
