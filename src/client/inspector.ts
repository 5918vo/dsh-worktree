import { h } from './ui'
import type { TaskView } from '../models'
import { mergeSummary, mergeSummaryText, shortSha } from './model'

export interface InspectorProps {
  t: any
  taskView: TaskView
  archived: boolean
  previewState: any
  baseSha: string
  headSha: string
  baseLabel: string
  busy: string
  canArchive: boolean
  archiveReason: string
  onCopy: (text: string) => void
  onArchive: () => void
  onUnarchive: () => void
  onCleanup: () => void
}

export function Inspector(props: InspectorProps) {
  const { t, taskView } = props
  const task = taskView.task
  const snap = taskView.snapshot
  const state = props.previewState || { phase: 'idle' }
  const preview = state.phase === 'ready' ? state.preview : state.previous && state.previous.preview
  const error = state.phase === 'error' ? state.message : ''
  const merged = snap.status === 'merged' || snap.status === 'cleaned'
  const summary = merged && !preview && state.phase !== 'checking' && state.phase !== 'error'
    ? { key: 'merged' as const, tone: 'ok' as const }
    : mergeSummary(preview, state.phase, error)
  const dotClass = summary.tone === 'err' ? 'dshwd-text-err' : summary.tone === 'warn' ? 'dshwd-text-warn' : summary.tone === 'ok' ? 'dshwd-text-ok' : 'dshwd-text-muted'
  const dirty = Number(snap.worktree && snap.worktree.dirtyCount) || 0
  return h('aside', { className: 'dshwd-inspector' },
    h('section', { className: 'dshwd-insp-sec' },
      h('div', { className: 'dshwd-insp-title' }, t.mergeCheck, h('span', { className: dotClass }, '●')),
      h('div', { style: { fontSize: '12px', color: summary.tone === 'err' ? 'var(--err)' : summary.tone === 'warn' ? 'var(--warn)' : 'var(--text-2)', lineHeight: '1.5' } },
        mergeSummaryText(t, summary)),
      h('div', { className: 'dshwd-kv', style: { marginTop: '8px' } },
        h('span', { className: 'dshwd-kv-k' }, t.demoTargetBase),
        h('span', { className: 'dshwd-kv-v dshwd-mono', title: props.baseSha }, `${props.baseLabel} @ ${shortSha(props.baseSha)}`)),
      h('div', { className: 'dshwd-kv' },
        h('span', { className: 'dshwd-kv-k' }, t.demoTaskHead),
        h('span', { className: 'dshwd-kv-v dshwd-mono', title: props.headSha }, shortSha(props.headSha))),
      preview && Array.isArray(preview.conflictFiles) && preview.conflictFiles.length
        ? h('div', { className: 'dshwd-hint', style: { marginTop: '6px', overflowWrap: 'anywhere' } }, t.demoFiles + '：' + preview.conflictFiles.slice(0, 8).join('、'))
        : null),

    h('section', { className: 'dshwd-insp-sec' },
      h('div', { className: 'dshwd-insp-title' }, t.techInfo),
      h('div', { className: 'dshwd-kv' },
        h('span', { className: 'dshwd-kv-k' }, t.branchLabel),
        h('span', { className: 'dshwd-kv-v dshwd-mono', title: task.branch }, task.branch || '—')),
      h('div', { className: 'dshwd-kv' },
        h('span', { className: 'dshwd-kv-k' }, t.session),
        h('span', { className: 'dshwd-kv-v dshwd-mono', title: task.sessionId || '' }, task.sessionId || '—')),
      h('div', { className: 'dshwd-kv', style: { alignItems: 'flex-start' } },
        h('span', { className: 'dshwd-kv-k' }, t.worktree),
        h('span', { className: 'dshwd-kv-v dshwd-mono', title: task.worktreePath, style: { whiteSpace: 'normal', overflowWrap: 'anywhere', textAlign: 'right' } }, task.worktreePath || '—')),
      h('div', { className: 'dshwd-path-box dshwd-mono', title: t.demoCopyPath, onClick: () => props.onCopy(task.worktreePath) }, task.worktreePath || '—')),

    h('section', { className: 'dshwd-insp-sec' },
      h('div', { className: 'dshwd-insp-title' }, t.lifecycle),
      h('div', { className: 'dshwd-kv' },
        h('span', { className: 'dshwd-kv-k' }, t.uncommitted),
        h('span', { className: 'dshwd-kv-v ' + (dirty ? 'dshwd-text-warn' : 'dshwd-text-ok') }, dirty ? `${dirty} ${t.changesUnit}` : t.clean)),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' } },
        h('button', {
          className: 'dshwd-btn',
          disabled: props.busy !== '' || (!props.canArchive && !props.archived),
          title: !props.canArchive && !props.archived ? props.archiveReason : undefined,
          onClick: props.archived ? props.onUnarchive : props.onArchive,
        }, props.archived ? t.unarchive : t.archive),
        h('button', {
          className: 'dshwd-btn dshwd-btn-danger',
          disabled: props.busy !== '' || snap.status === 'cleaned',
          onClick: props.onCleanup,
        }, t.cleanup))))
}
