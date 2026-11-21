import { h } from './ui'
import { relTime } from './format'
import type { ProjectView, TaskView } from '../models'
import { demoBranch, demoStat, demoStatus, demoStatusLabel, type DemoFilter, type DemoTheme } from './model'

export interface RailProps {
  t: any
  views: ProjectView[]
  selectedTaskId: string
  selectedProjectId: string
  query: string
  filter: DemoFilter
  theme: DemoTheme
  runningOf: (task: any) => boolean
  onQuery: (value: string) => void
  onFilter: (filter: DemoFilter) => void
  onSelectTask: (taskId: string, projectId: string) => void
  onSelectProject: (projectId: string) => void
  onPublish: () => void
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
      h('button', { className: 'dshwd-btn dshwd-btn-cta', style: { height: '25px', padding: '0 9px', fontSize: '11.5px' }, title: String(t.demoPublishShortcut), onClick: props.onPublish }, '+ ', t.publish)),

    h('div', { className: 'dshwd-rail-controls' },
      h('div', { className: 'dshwd-search-wrap' },
        h('input', {
          ref: props.searchRef,
          className: 'dshwd-search',
          value: props.query,
          placeholder: t.demoSearch,
          'aria-label': t.demoSearch,
          onInput: (e: any) => props.onQuery(e.target.value),
        }),
        h('span', { className: 'dshwd-search-kbd dshwd-mono' }, '/')),
      h('div', { className: 'dshwd-pills' },
        pill(t, 'all', t.all, props),
        pill(t, 'review', t.demoWaitingReview, props),
        pill(t, 'developing', t.running, props))),

    h('div', { className: 'dshwd-rail-list' },
      props.views.length
        ? props.views.map((view) => h('div', { key: view.project.id },
          h('button', {
            className: 'dshwd-group-head',
            title: t.demoOpenProject,
            onClick: () => props.onSelectProject(view.project.id),
          },
            h('span', null, view.project.name),
            h('span', { className: 'dshwd-mono' }, String(view.tasks.length))),
          view.tasks.map((tv) => taskRow(t, tv, view, props))))
        : h('div', { className: 'dshwd-empty', style: { minHeight: '160px' } },
          h('div', { className: 'dshwd-empty-title' }, props.query ? t.demoNoMatches : t.noTasks),
          h('div', { className: 'dshwd-hint' }, props.query ? t.demoClearSearch : t.noProjectsHint))),

    h('div', { className: 'dshwd-rail-foot' },
      h('span', { className: 'dshwd-mono', style: { fontSize: '11px', color: 'var(--text-3)' } }, `${totalRepos} repos · ${totalTasks} tasks`),
      h('button', { className: 'dshwd-btn dshwd-btn-ghost', style: { height: '24px', fontSize: '11px' }, onClick: props.onToggleTheme },
        props.theme === 'dark' ? t.demoThemeLight : t.demoThemeDark)))
}

function pill(t: any, filter: DemoFilter, label: string, props: RailProps) {
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
  const status = demoStatus(tv.snapshot.status, running)
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
      h('span', { className: 'dshwd-item-stat dshwd-mono' }, demoStat(tv.snapshot))),
    h('div', { className: 'dshwd-item-row2' },
      h('span', { className: 'dshwd-mono' }, demoBranch(task.branch)),
      h('span', null, relTime(tv.snapshot.worktree.lastCommitAt, t))))
}
