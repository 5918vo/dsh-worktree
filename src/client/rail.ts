import { React, h } from './ui'
import { Icon } from './primitives'
import { relTime, taskStamp } from './format'
import type { ProjectView, TaskView } from '../models'
import { boardBranch, boardStat, boardStatus, boardStatusLabel, type BoardFilter, type BoardTheme } from './model'
import { pendingLabel, postMergeLabel } from './status'
import { AttentionFilter } from './attention-filter'
import { AttentionSummaryBar } from './attention-summary'
import { quickActionKey, type QuickAction, type SessionHealth, type TaskAttention } from './task-attention'
import { environmentWarnings, type EnvironmentInfo } from './environment'

export type RailEmptyKind = '' | 'search' | 'filter' | 'no-projects' | 'no-tasks'

export interface RailProps {
  t: any
  views: ProjectView[]
  projectCount: number
  selectedTaskId: string
  selectedProjectId: string
  query: string
  filter: BoardFilter
  showArchived: boolean
  archivedCount: number
  theme: BoardTheme
  runningOf: (task: any) => boolean
  pendingOf: (task: any) => string
  healthOf: (task: any) => SessionHealth | null
  attentionOf: (view: TaskView) => TaskAttention
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
  onToggleTheme: () => void
  searchRef: any
  /** Host capabilities from `GET config`; absent while loading or after failure. */
  environment?: EnvironmentInfo | null
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

  return h('aside', { className: 'dshwd-rail' },
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
          onInput: (e: any) => props.onQuery(e.target.value),
        }),
        h('span', { className: 'dshwd-search-kbd dshwd-mono' }, '/')),
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
        props.loaded === false ? '—' : `${totalRepos} repos · ${totalTasks} tasks`),
      h('button', { className: 'dshwd-btn dshwd-btn-ghost', style: { height: '24px', fontSize: '11px' }, onClick: props.onToggleTheme },
        props.theme === 'dark' ? t.boardThemeLight : t.boardThemeDark)))
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
function alertText(t: any, kind: string, tv: TaskView, pendingKind: string, health: SessionHealth | null): string {
  switch (kind) {
    case 'recovery': return t.attentionRecovery
    case 'pending': return pendingLabel(t, pendingKind)
    case 'broken': return t.attentionBroken
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
  if (primary && primary !== 'pending' && primary !== 'session') {
    chips.push(chip(alertText(t, primary, tv, pendingKind, health), alertTone(primary)))
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
        h('span', { className: 'dshwd-item-title' }, task.title),
        h('span', { className: 'dshwd-item-stat dshwd-mono' }, boardStat(tv.snapshot))),
      h('div', { className: 'dshwd-item-row2' },
        h('span', { className: 'dshwd-mono' }, boardBranch(task.branch)),
        h('span', null, task.archivedAt ? t.archived : relTime(taskStamp(task, tv.snapshot), t))),
      h('div', { className: 'dshwd-item-chips' }, chips)),

    h('div', { className: 'dshwd-item-actions' },
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
          h('span', null, alertText(t, kind, tv, pendingKind, health)))))
      : null)
}
