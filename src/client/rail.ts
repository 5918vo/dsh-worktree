import { h } from './ui'
import { relTime, taskStamp } from './format'
import type { ProjectView, TaskView } from '../models'
import { boardBranch, boardStat, boardStatus, boardStatusLabel, type BoardFilter, type BoardTheme } from './model'

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
  onQuery: (value: string) => void
  onFilter: (filter: BoardFilter) => void
  onToggleArchived: () => void
  onSelectTask: (taskId: string, projectId: string) => void
  onSelectProject: (projectId: string) => void
  onPublish: () => void
  onAddProject: () => void
  onToggleTheme: () => void
  searchRef: any
}

export function Rail(props: RailProps) {
  const { t } = props
  const totalTasks = props.views.reduce((n, view) => n + view.tasks.length, 0)
  const totalRepos = props.views.length
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
      h('div', { className: 'dshwd-pills' },
        pill(t, 'all', t.all, props),
        pill(t, 'review', t.boardWaitingReview, props),
        pill(t, 'developing', t.running, props)),
      props.archivedCount > 0 || props.showArchived
        ? h('div', { style: { display: 'flex', justifyContent: 'flex-end' } },
          h('button', {
            className: 'dshwd-btn dshwd-btn-ghost',
            style: { height: '22px', fontSize: '11px', padding: '0 6px' },
            'aria-pressed': props.showArchived,
            title: String(t.archiveToggleTitle).replace('{n}', String(props.archivedCount)),
            onClick: props.onToggleArchived,
          }, props.showArchived ? t.hideArchived : t.showArchived,
            h('span', { className: 'dshwd-mono', style: { marginLeft: '5px', color: 'var(--text-3)' } }, String(props.archivedCount))))
        : null),

    h('div', { className: 'dshwd-rail-list' },
      props.views.length
        ? props.views.map((view) => h('div', { key: view.project.id },
          h('button', {
            className: 'dshwd-group-head',
            title: t.boardOpenProject,
            onClick: () => props.onSelectProject(view.project.id),
          },
            h('span', null, view.project.name),
            h('span', { className: 'dshwd-mono' }, String(view.tasks.length))),
          view.tasks.length
            ? view.tasks.map((tv) => taskRow(t, tv, view, props))
            : h('div', { className: 'dshwd-hint', style: { padding: '0 8px 8px 24px', fontSize: '11px' } }, t.noTasks)))
        : h('div', { className: 'dshwd-empty', style: { minHeight: '160px' } },
          h('div', { className: 'dshwd-empty-title' }, props.query ? t.boardNoMatches : t.noTasks),
          h('div', { className: 'dshwd-hint' }, props.query ? t.boardClearSearch : t.noProjectsHint),
          !props.query && props.projectCount === 0
            ? h('button', { className: 'dshwd-btn dshwd-btn-cta', onClick: props.onAddProject }, t.addProject)
            : null)),

    h('div', { className: 'dshwd-rail-foot' },
      h('span', { className: 'dshwd-mono', style: { fontSize: '11px', color: 'var(--text-3)' } }, `${totalRepos} repos · ${totalTasks} tasks`),
      h('button', { className: 'dshwd-btn dshwd-btn-ghost', style: { height: '24px', fontSize: '11px' }, onClick: props.onToggleTheme },
        props.theme === 'dark' ? t.boardThemeLight : t.boardThemeDark)))
}

function pill(t: any, filter: BoardFilter, label: string, props: RailProps) {
  return h('button', {
    key: filter,
    className: 'dshwd-pill' + (props.filter === filter ? ' dshwd-active' : ''),
    'aria-pressed': props.filter === filter,
    onClick: () => props.onFilter(filter),
  }, label)
}

function taskRow(t: any, tv: TaskView, view: ProjectView, props: RailProps) {
  const task = tv.task
  const running = props.runningOf(task)
  const status = boardStatus(tv.snapshot.status, running)
  return h('div', {
    key: task.id,
    className: 'dshwd-item' + (props.selectedTaskId === task.id ? ' dshwd-active' : ''),
    role: 'button',
    tabIndex: 0,
    onClick: () => props.onSelectTask(task.id, view.project.id),
    onKeyDown: (e: any) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        props.onSelectTask(task.id, view.project.id)
      }
    },
  },
    h('div', { className: 'dshwd-item-row1' },
      h('span', { className: 'dshwd-dot dshwd-' + status.dot, 'aria-hidden': 'true' }),
      h('span', { className: 'dshwd-item-title' }, task.title),
      h('span', { className: 'dshwd-item-stat dshwd-mono' }, boardStat(tv.snapshot))),
    h('div', { className: 'dshwd-item-row2' },
      h('span', { className: 'dshwd-mono' }, boardBranch(task.branch)),
      h('span', null, task.archivedAt ? t.archived : relTime(taskStamp(task, tv.snapshot), t))))
}
