import { React, h } from './ui'
import { fmtK, pad2, relTime, taskStamp } from './format'
import type { TaskDiff, TaskView } from '../models'
import { criteria, boardStatus, boardStatusLabel, diffCount, diffHeadSha, diffLineKind, shortSha, type BoardAction, type BoardCta } from './model'
import { pendingLabel } from './status'
import type { SessionHealth } from './task-attention'
import { fallbackEntries, type TimelineEntry } from './timeline'
import { entryTag, entryTitle, liveStatsText, modelLabel, pressurePercent, readLive, stepStatusLabel, tokenSummary } from './live-session'
import { postMergeCount, reviewStaleCount } from './review-surfaces'

export type BoardTab = 'overview' | 'live' | 'diff'

export interface StageProps {
  t: any
  taskView: TaskView
  projectName: string
  running: boolean
  /** Pending interaction kind when the session is waiting on the user. */
  pendingKind?: string
  /** How the session's last turn ended, when it did not end cleanly. */
  health?: SessionHealth | null
  tab: BoardTab
  onTab: (tab: BoardTab) => void
  ctas: BoardCta
  disabledActions: Record<string, string | undefined>
  onAction: (action: BoardAction) => void
  entries: TimelineEntry[]
  entriesReady: boolean
  /** Raw session projections `values` for the selected session, when available. */
  live?: any
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
  /** Narrow container: labelled back-to-list entry, rail is an overlay. */
  narrow?: boolean
  notice?: { message: string } | null
  onDismissNotice?: () => void
  onBackToList?: () => void
}

export function Stage(props: StageProps) {
  const { t, taskView, ctas } = props
  const task = taskView.task
  const status = boardStatus(taskView.snapshot.status, props.running)
  const pendingKind = props.pendingKind || ''
  // While a fresh turn runs, the previous turn's failure is history, not state.
  const health = props.health && !props.running ? props.health : null
  const sessionTone = health ? (health.kind === 'interrupted' ? 'warn' : 'err') : props.running ? 'accent' : ''
  const sessionLabel = health
    ? (health.kind === 'interrupted' ? t.sessionInterrupted : t.sessionError)
    : props.running ? t.sessionRunning : t.sessionIdle
  const updated = taskStamp(task, taskView.snapshot)
  const count = diffCount(props.diff)
  // A merged task whose branch kept moving still deserves a way forward; a
  // review pinned to an old commit needs a warning. Both can be true at once.
  const postMerge = postMergeCount(taskView.snapshot)
  const reviewStale = reviewStaleCount(status.key, taskView.snapshot)
  const cleanedNow = taskView.snapshot.status === 'cleaned'
  return h('main', { className: 'dshwd-stage' },
    h('div', { className: 'dshwd-topbar' },
      h('div', { className: 'dshwd-topbar-left' },
        props.narrow
          ? h('button', { className: 'dshwd-btn dshwd-btn-ghost', title: t.backToList, onClick: props.onBackToList || props.onToggleRail }, '‹ ', t.backToList)
          : h('button', { className: 'dshwd-btn dshwd-btn-ghost', title: t.boardCollapseLeft, onClick: props.onToggleRail }, '◧'),
        h('div', { className: 'dshwd-breadcrumb' },
          h('span', null, props.projectName),
          h('span', null, '/'),
          h('strong', { className: 'dshwd-mono' }, task.branch || '—'),
          h('span', null, '→'),
          h('span', { className: 'dshwd-mono' }, task.baseBranch))),
      h('div', { className: 'dshwd-topbar-right' },
        h('button', { className: 'dshwd-btn dshwd-btn-ghost', title: t.boardCollapseRight, onClick: props.onToggleInspector }, '◨ ', t.boardInspector))),

    h('header', { className: 'dshwd-stage-head' },
      h('div', { className: 'dshwd-stage-title-row' },
        h('div', { style: { minWidth: '0' } },
          h('h1', { className: 'dshwd-stage-title' }, task.title),
          h('div', { className: 'dshwd-stage-sub' },
            h('span', { className: 'dshwd-chip ' + (status.chip ? 'dshwd-' + status.chip : '') },
              h('span', { className: 'dshwd-dot dshwd-' + status.dot, style: { width: '5px', height: '5px' } }),
              boardStatusLabel(t, status)),
            pendingKind
              ? h('span', { className: 'dshwd-chip dshwd-warn' }, pendingLabel(t, pendingKind))
              : null,
            task.sessionId
              ? h('span', {
                className: 'dshwd-chip' + (sessionTone ? ' dshwd-' + sessionTone : ''),
                title: health
                  ? (health.kind === 'interrupted' ? t.sessionInterruptedHint : t.sessionErrorHint) + (health.message ? ' · ' + health.message : '')
                  : undefined,
              }, sessionLabel)
              : null,
            pendingKind && task.sessionId
              ? h('button', {
                className: 'dshwd-btn dshwd-btn-ghost dshwd-btn-mini',
                title: t.handlePending,
                onClick: props.onOpenSession,
              }, t.handlePending)
              : null,
            h('span', { className: 'dshwd-mono', style: { color: 'var(--text-3)', fontSize: '11px' } },
              `${shortSha(props.baseSha)}..${shortSha(props.headSha)} · ${relTime(updated, t)}`))),
        h('div', { style: { display: 'flex', gap: '8px', flexShrink: '0' } },
          ctas.secondary ? actionButton(t, ctas.secondary.action, ctas.secondary.label, props, false) : null,
          actionButton(t, ctas.primary.action, ctas.primary.label, props, true))),

      h('nav', { className: 'dshwd-tabs' },
        tabButton('overview', t.boardOverviewTab, props),
        tabButton('live', t.liveSession, props),
        h('button', {
          key: 'diff',
          className: 'dshwd-tab' + (props.tab === 'diff' ? ' dshwd-active' : ''),
          onClick: () => props.onTab('diff'),
        }, t.codeChanges, h('span', { className: 'dshwd-mono', style: { fontSize: '11px', color: 'var(--text-3)' } }, String(count))))),

    h('div', { className: 'dshwd-stage-body' },
      postMerge > 0
        ? h('div', { className: 'dshwd-notice dshwd-alert dshwd-alert-warn' },
          h('div', { className: 'dshwd-notice-text' },
            h('div', { className: 'dshwd-notice-title' }, String(t.postMergeTitle).replace('{n}', String(postMerge))),
            h('div', { className: 'dshwd-hint' }, String(t.postMergeHint).replace('{n}', String(postMerge)))),
          // A cleaned task has no worktree to merge from; offer no dead action.
          cleanedNow
            ? null
            : h('div', { className: 'dshwd-notice-actions' },
              actionButton(t, 'merge', 'mergeAgain', props, false),
              actionButton(t, 'continue', 'continueTask', props, false)))
        : null,
      reviewStale > 0
        ? h('div', { className: 'dshwd-notice dshwd-alert dshwd-alert-warn' },
          h('div', { className: 'dshwd-notice-text' },
            h('div', { className: 'dshwd-notice-title' }, t.reviewStaleTitle),
            h('div', { className: 'dshwd-hint' }, String(t.reviewStaleHint).replace('{n}', String(reviewStale)))))
        : null,
      // Errors from checkout/merge/cleanup keep living here after the toast is
      // gone, so a refused action stays explainable.
      props.notice
        ? h('div', { className: 'dshwd-notice dshwd-alert', role: 'alert' },
          h('span', { className: 'dshwd-notice-text' }, props.notice.message),
          h('button', {
            className: 'dshwd-btn dshwd-btn-ghost dshwd-btn-copy',
            title: t.close,
            'aria-label': t.close,
            onClick: props.onDismissNotice,
          }, '×'))
        : null,
      props.tab === 'overview' ? h(Overview, props)
        : props.tab === 'live' ? h(Live, props)
          : h(Diff, props)))
}

function tabButton(tab: BoardTab, label: string, props: StageProps) {
  return h('button', {
    key: tab,
    className: 'dshwd-tab' + (props.tab === tab ? ' dshwd-active' : ''),
    onClick: () => props.onTab(tab),
  }, label)
}

function actionButton(t: any, action: BoardAction, labelKey: string, props: StageProps, primary: boolean) {
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
        : h('div', { className: 'dshwd-hint' }, t.boardNoCriteria)))
}

function Live(props: StageProps) {
  const { t } = props
  const bodyRef = React.useRef(null)
  const live = readLive(props.live)
  const [showAll, setShowAll] = React.useState(false)
  React.useEffect(() => { setShowAll(false) }, [props.sessionId])
  React.useEffect(() => {
    const el: any = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [props.entries.length, props.sessionId])

  if (!props.sessionId) {
    return h('div', { className: 'dshwd-measure' },
      h('div', { className: 'dshwd-stream' },
        h('div', { className: 'dshwd-stream-head' }, h('span', { className: 'dshwd-mono' }, 'SESSION · —')),
        h('div', { className: 'dshwd-empty', style: { minHeight: '160px' } },
          h('div', { className: 'dshwd-empty-title' }, t.noSession),
          h('div', { className: 'dshwd-hint' }, t.boardNoSessionHint),
          h('button', { className: 'dshwd-btn dshwd-btn-cta', onClick: props.onStartSession }, t.startAgent))))
  }

  // Live projections can lag behind the timeline; fall back to the timeline's
  // own turn outline so the panel is never blank while data arrives.
  const history = props.entries.length ? props.entries : fallbackEntries(live ? live.turns : [])
  const historySteps = new Set(history.map((entry) => entry.stepKey).filter(Boolean)).size
  const modelText = modelLabel(live && live.model) || history.find((entry) => entry.model)?.model || '—'
  const statsText = live || historySteps ? liveStatsText(live && live.stats, historySteps, t) : '—'
  const tokenText = tokenSummary(live && live.tokens, t)
  const todos = (live && live.todos) || []
  const pct = pressurePercent(live && live.pressure)
  const cache = live && live.tokens ? fmtK(live.tokens.cacheReadTokens) : null
  const RECENT_STEPS = 5
  const visible = showAll ? history : history.slice(-RECENT_STEPS)
  const offset = showAll ? 0 : Math.max(0, history.length - RECENT_STEPS)

  return h('div', { className: 'dshwd-measure' },
    h('div', { className: 'dshwd-live-bar' },
      h('span', { className: 'dshwd-live-stat' }, h('span', { className: 'dshwd-live-bar-k' }, t.liveModel), h('strong', { className: 'dshwd-mono', title: modelText }, modelText)),
      h('span', { className: 'dshwd-live-stat dshwd-mono' }, statsText),
      tokenText ? h('span', { className: 'dshwd-live-stat dshwd-mono' }, tokenText) : null,
      h('span', { className: 'dshwd-live-bar-grow' }),
      history.length > RECENT_STEPS
        ? h('button', {
          className: 'dshwd-btn dshwd-btn-ghost dshwd-btn-mini',
          onClick: () => setShowAll((v: boolean) => !v),
        }, showAll ? t.collapseAll : String(t.showRecentSteps).replace('{n}', String(RECENT_STEPS)))
        : null,
      h('button', { className: 'dshwd-btn dshwd-btn-ghost dshwd-btn-mini', onClick: props.onOpenSession }, t.openInSession, ' ↗')),

    h('div', { className: 'dshwd-live-grid' },
      h('div', { ref: bodyRef, className: 'dshwd-live-log' },
        !props.entriesReady
          ? h('div', { className: 'dshwd-hint' }, t.loading)
          : visible.length
            ? visible.map((entry, index) => h('details', { key: entry.id || index, className: 'dshwd-step dshwd-step--' + entry.kind },
              h('summary', { className: 'dshwd-step-head' },
                h('span', { className: 'dshwd-step-gutter dshwd-mono' }, pad2(offset + index + 1)),
                h('span', { className: 'dshwd-step-tag' }, entryTag(entry, t)),
                h('span', { className: 'dshwd-step-title', title: entry.detail || entryTitle(entry, t) }, entryTitle(entry, t)),
                entry.meta ? h('span', { className: 'dshwd-step-meta dshwd-mono' }, entry.meta) : null,
                entry.status
                  ? h('span', {
                    className: 'dshwd-step-status ' + (entry.status === 'error' ? 'dshwd-text-err' : entry.status === 'running' ? 'dshwd-text-warn' : 'dshwd-text-ok'),
                  }, stepStatusLabel(entry.status, t))
                  : null),
              h('div', { className: 'dshwd-step-body' }, entry.detail || '—')))
            : h('div', { className: 'dshwd-step' },
              h('div', { className: 'dshwd-step-head' },
                h('span', { className: 'dshwd-step-gutter dshwd-mono' }, '—'),
                h('span', { className: 'dshwd-step-title' }, t.noTurns)))),

      h('div', { className: 'dshwd-live-side' },
        h('div', { className: 'dshwd-live-side-block' },
          h('div', { className: 'dshwd-live-side-title' }, t.liveTodos),
          todos.length
            ? h('ul', { className: 'dshwd-todo-mini' }, todos.slice(0, 10).map((todo: any, i: number) => {
              const done = !!todo && todo.status === 'completed'
              return h('li', { key: i, className: done ? 'dshwd-done' : '' },
                h('span', { className: 'dshwd-todo-mark', 'aria-hidden': 'true' }, done ? '✓' : ''),
                h('span', null, String((todo && todo.content) || '')))
            }))
            : h('div', { className: 'dshwd-hint' }, '—')),
        h('div', { className: 'dshwd-live-side-block' },
          h('div', { className: 'dshwd-live-side-title' }, t.livePressure),
          h('div', { className: 'dshwd-meter-row' },
            h('span', { className: 'dshwd-mono' }, pct === null ? '—' : pct + '%'),
            h('span', { className: 'dshwd-hint' }, cache ? cache + ' ' + t.liveTokensCache : '')),
          h('div', { className: 'dshwd-meter', role: 'img', 'aria-label': t.livePressure + ' ' + (pct === null ? '—' : pct + '%') },
            h('i', { style: { width: (pct === null ? 0 : pct) + '%' } }))))))
}

function Diff(props: StageProps) {
  const { t } = props
  if (props.diffError) {
    return h('div', { className: 'dshwd-alert' }, props.diffError,
      h('button', { className: 'dshwd-btn', onClick: props.onRetryDiff }, t.retry))
  }
  if (props.diffLoading && !props.diff) return h('div', { className: 'dshwd-hint' }, t.loading)
  if (!props.diff) return h('div', { className: 'dshwd-empty' }, h('div', { className: 'dshwd-empty-title' }, t.boardNoDiff))
  if (!props.diff.files || !props.diff.files.length) {
    return h('div', { className: 'dshwd-empty' }, h('div', { className: 'dshwd-empty-title' }, t.boardNoDiff), h('div', { className: 'dshwd-hint' }, t.boardNoDiffHint))
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
      ? h('div', { className: 'dshwd-hint' }, props.diff.reason || t.boardDiffTruncated)
      : null)
}
