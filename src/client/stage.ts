import { React, h } from './ui'
import { relTime } from './format'
import type { TaskDiff, TaskView } from '../models'
import { criteria, demoStatus, demoStatusLabel, diffCount, diffHeadSha, diffLineKind, shortSha, type DemoAction, type DemoCta } from './model'
import type { TimelineEntry } from './timeline'

export type DemoTab = 'overview' | 'live' | 'diff'

export interface StageProps {
  t: any
  taskView: TaskView
  projectName: string
  running: boolean
  tab: DemoTab
  onTab: (tab: DemoTab) => void
  ctas: DemoCta
  disabledActions: Record<string, string | undefined>
  onAction: (action: DemoAction) => void
  entries: TimelineEntry[]
  entriesReady: boolean
  sessionId: string
  onOpenSession: () => void
  onStartSession: () => void
  diff: TaskDiff | null
  diffLoading: boolean
  diffError: string
  onRetryDiff: () => void
  baseSha: string
  headSha: string
  onToggleRail: () => void
  onToggleInspector: () => void
}

export function Stage(props: StageProps) {
  const { t, taskView, ctas } = props
  const task = taskView.task
  const status = demoStatus(taskView.snapshot.status, props.running)
  const updated = taskView.snapshot.worktree.lastCommitAt || task.updatedAt || task.createdAt
  const count = diffCount(props.diff)
  return h('main', { className: 'dshwd-stage' },
    h('div', { className: 'dshwd-topbar' },
      h('div', { className: 'dshwd-topbar-left' },
        h('button', { className: 'dshwd-btn dshwd-btn-ghost', title: t.demoCollapseLeft, onClick: props.onToggleRail }, '◧'),
        h('div', { className: 'dshwd-breadcrumb' },
          h('span', null, props.projectName),
          h('span', null, '/'),
          h('strong', { className: 'dshwd-mono' }, task.branch || '—'),
          h('span', null, '→'),
          h('span', { className: 'dshwd-mono' }, task.baseBranch))),
      h('div', { className: 'dshwd-topbar-right' },
        h('button', { className: 'dshwd-btn dshwd-btn-ghost', title: t.demoCollapseRight, onClick: props.onToggleInspector }, '◨ ', t.demoInspector))),

    h('header', { className: 'dshwd-stage-head' },
      h('div', { className: 'dshwd-stage-title-row' },
        h('div', { style: { minWidth: '0' } },
          h('h1', { className: 'dshwd-stage-title' }, task.title),
          h('div', { className: 'dshwd-stage-sub' },
            h('span', { className: 'dshwd-chip ' + (status.chip ? 'dshwd-' + status.chip : '') },
              h('span', { className: 'dshwd-dot dshwd-' + status.dot, style: { width: '5px', height: '5px' } }),
              demoStatusLabel(t, status)),
            h('span', { className: 'dshwd-mono', style: { color: 'var(--text-3)', fontSize: '11px' } },
              `${shortSha(props.baseSha)}..${shortSha(props.headSha)} · ${relTime(updated, t)}`))),
        h('div', { style: { display: 'flex', gap: '8px', flexShrink: '0' } },
          ctas.secondary ? actionButton(t, ctas.secondary.action, ctas.secondary.label, props, false) : null,
          actionButton(t, ctas.primary.action, ctas.primary.label, props, true))),

      h('nav', { className: 'dshwd-tabs' },
        tabButton('overview', t.demoOverviewTab, props),
        tabButton('live', t.liveSession, props),
        h('button', {
          key: 'diff',
          className: 'dshwd-tab' + (props.tab === 'diff' ? ' dshwd-active' : ''),
          onClick: () => props.onTab('diff'),
        }, t.codeChanges, h('span', { className: 'dshwd-mono', style: { fontSize: '11px', color: 'var(--text-3)' } }, String(count))))),

    h('div', { className: 'dshwd-stage-body' },
      props.tab === 'overview' ? h(Overview, props)
        : props.tab === 'live' ? h(Live, props)
          : h(Diff, props)))
}

function tabButton(tab: DemoTab, label: string, props: StageProps) {
  return h('button', {
    key: tab,
    className: 'dshwd-tab' + (props.tab === tab ? ' dshwd-active' : ''),
    onClick: () => props.onTab(tab),
  }, label)
}

function actionButton(t: any, action: DemoAction, labelKey: string, props: StageProps, primary: boolean) {
  if (action === 'none') {
    return h('button', { key: 'none', className: 'dshwd-btn' + (primary ? ' dshwd-btn-cta' : ''), disabled: true }, t[labelKey])
  }
  const disabled = props.disabledActions[action]
  return h('button', {
    key: action,
    className: 'dshwd-btn' + (primary ? ' dshwd-btn-cta' : ''),
    disabled: !!disabled,
    title: disabled || undefined,
    onClick: () => { if (!disabled) props.onAction(action) },
  }, t[labelKey])
}

function Overview(props: StageProps) {
  const { t } = props
  const items = criteria(props.taskView.task, props.taskView.snapshot.status)
  return h('div', { className: 'dshwd-measure' },
    h('section', { className: 'dshwd-block' },
      h('div', { className: 'dshwd-block-label' }, t.taskDescription),
      h('div', { className: 'dshwd-prose' }, props.taskView.task.description || '—')),
    h('section', { className: 'dshwd-block' },
      h('div', { className: 'dshwd-block-label' }, t.acceptanceCriteria),
      items.length
        ? h('div', { className: 'dshwd-check-list' }, items.map((item, i) => h('div', { key: i, className: 'dshwd-check-item' },
          h('span', { className: 'dshwd-check-box' + (item.checked ? '' : ' dshwd-todo'), 'aria-hidden': 'true' }, item.checked ? '✓' : ''),
          h('span', null, item.text))))
        : h('div', { className: 'dshwd-hint' }, t.demoNoCriteria)))
}

function Live(props: StageProps) {
  const { t } = props
  const bodyRef = React.useRef(null)
  React.useEffect(() => {
    const el: any = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [props.entries.length, props.sessionId])
  return h('div', { className: 'dshwd-measure' },
    h('div', { className: 'dshwd-stream' },
      h('div', { className: 'dshwd-stream-head' },
        h('span', { className: 'dshwd-mono' }, `SESSION · ${props.sessionId || '—'}`),
        props.sessionId
          ? h('button', { className: 'dshwd-btn dshwd-btn-ghost', style: { height: '22px', fontSize: '11px' }, onClick: props.onOpenSession }, t.demoOpenNative, ' ↗')
          : null),
      h('div', { ref: bodyRef, className: 'dshwd-stream-body', style: { maxHeight: '56vh', overflowY: 'auto' } },
        !props.sessionId
          ? h('div', { className: 'dshwd-empty', style: { minHeight: '160px' } },
            h('div', { className: 'dshwd-empty-title' }, t.noSession),
            h('div', { className: 'dshwd-hint' }, t.demoNoSessionHint),
            h('button', { className: 'dshwd-btn dshwd-btn-cta', onClick: props.onStartSession }, t.startAgent))
          : !props.entriesReady
            ? h('div', { className: 'dshwd-hint' }, t.loading)
            : props.entries.length
              ? props.entries.slice(-60).map((entry) => h('div', { className: 'dshwd-log-row', key: entry.id },
                h('span', { className: 'dshwd-log-tag dshwd-mono' }, entry.kind === 'think' ? 'THINK' : String(entry.kind || 'agent').toUpperCase()),
                h('div', { className: 'dshwd-log-main' },
                  h('strong', null, entry.title || '—'),
                  entry.detail ? h('p', null, entry.detail) : null)))
              : h('div', { className: 'dshwd-hint' }, t.demoNoActivity))))
}

function Diff(props: StageProps) {
  const { t } = props
  if (props.diffError) {
    return h('div', { className: 'dshwd-alert' }, props.diffError,
      h('button', { className: 'dshwd-btn', onClick: props.onRetryDiff }, t.retry))
  }
  if (props.diffLoading && !props.diff) return h('div', { className: 'dshwd-hint' }, t.loading)
  if (!props.diff) return h('div', { className: 'dshwd-empty' }, h('div', { className: 'dshwd-empty-title' }, t.demoNoDiff))
  if (!props.diff.files || !props.diff.files.length) {
    return h('div', { className: 'dshwd-empty' }, h('div', { className: 'dshwd-empty-title' }, t.demoNoDiff), h('div', { className: 'dshwd-hint' }, t.demoNoDiffHint))
  }
  return h('div', { className: 'dshwd-measure', style: { maxWidth: '960px' } },
    props.diff.files.map((file, i) => h('div', { className: 'dshwd-diff-box', key: file.path + i },
      h('div', { className: 'dshwd-diff-head' },
        h('span', { className: 'dshwd-mono' }, file.path),
        h('span', { className: 'dshwd-mono' }, `+${file.additions} -${file.deletions}`)),
      h('pre', { style: { margin: 0 } },
        String(file.patch || '').split('\n').map((line, j) => h('div', {
          key: j,
          className: 'dshwd-diff-line dshwd-' + diffLineKind(line),
        }, line || ' '))))),
    props.diff.truncated
      ? h('div', { className: 'dshwd-hint' }, props.diff.reason || t.demoDiffTruncated)
      : null)
}
