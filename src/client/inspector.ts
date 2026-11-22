import { h } from './ui'
import type { TaskView } from '../models'
import { mergeSummary, mergeSummaryText, shortSha } from './model'
import { displayPath, pathParts } from './format'
import { readLive } from './live-session'
import { SYNC_BUSY, mergePreviewFiles, mergeRiskChip, previewFilesText, previewNoCheck, syncApplicable } from './review-surfaces'

export interface InspectorProps {
  t: any
  taskView: TaskView
  archived: boolean
  previewState: any
  /** Raw session projections `values`, when a live session is available. */
  live?: any
  baseSha: string
  headSha: string
  baseLabel: string
  busy: string
  canArchive: boolean
  archiveReason: string
  stashes: any[]
  partialRestore: any
  /** Whether the bound session is currently running a turn. */
  running: boolean
  /** Pending interaction kind while the session waits on the user. */
  pending: string
  /** Narrow container: the inspector is an overlay drawer and needs a close. */
  narrow?: boolean
  onClose?: () => void
  onCopy: (text: string) => void
  /** Send the base-sync instruction for the given preview files. */
  onSyncBaseline: (files: string[]) => void
  onArchive: () => void
  onUnarchive: () => void
  onCleanup: () => void
  onDelete: () => void
  onRestore: () => void
  onViewStash: (sha: string) => void
  onApplyStash: (sha: string) => void
  onDropStash: (sha: string) => void
}

export function Inspector(props: InspectorProps) {
  const { t, taskView } = props
  const task = taskView.task
  const snap = taskView.snapshot
  const state = props.previewState || { phase: 'idle' }
  const preview = state.phase === 'ready' ? state.preview : state.previous && state.previous.preview
  const error = state.phase === 'error' ? state.message : ''
  const merged = snap.status === 'merged' || snap.status === 'cleaned'
  const cleaned = snap.status === 'cleaned'
  // A busy or stashed task must not lose its worktree/record from under it.
  const agentBusy = props.running || !!props.pending
  const reviewing = snap.status === 'reviewing'
  const hasStashes = Array.isArray(props.stashes) && props.stashes.length > 0
  const summary = cleaned && !preview && state.phase !== 'checking' && state.phase !== 'error'
    ? { key: 'cleaned' as const, tone: 'neutral' as const }
    : merged && !preview && state.phase !== 'checking' && state.phase !== 'error'
      ? { key: 'merged' as const, tone: 'ok' as const }
      : mergeSummary(preview, state.phase, error)
  const dotClass = summary.tone === 'err' ? 'dshwd-text-err' : summary.tone === 'warn' ? 'dshwd-text-warn' : summary.tone === 'ok' ? 'dshwd-text-ok' : 'dshwd-text-muted'
  const dirty = Number(snap.worktree && snap.worktree.dirtyCount) || 0
  const blockers = preview && Array.isArray(preview.blockers) ? preview.blockers : []
  // Merge-preview extras: one risk chip, the files it is about, and the
  // base-sync escape hatch. All live inside the merge-check section so the
  // panel never stacks two near-identical warnings.
  const risk = mergeRiskChip(t, preview)
  const riskFiles = mergePreviewFiles(preview)
  const canSync = !merged && syncApplicable(preview)
  const syncing = props.busy === SYNC_BUSY
  const syncDisabled = !task.sessionId || props.running === true || props.busy !== ''
  const syncTitle = !task.sessionId ? t.syncNoSession : props.running === true ? t.acceptAgentRunning : undefined
  const riskNode = risk || canSync
    ? h('div', { style: { marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' } },
      risk
        ? h('span', { className: 'dshwd-chip' + (risk.tone === 'err' ? ' dshwd-err' : risk.tone === 'warn' ? ' dshwd-warn' : '') }, risk.label)
        : null,
      canSync
        ? h('button', {
          className: 'dshwd-btn dshwd-btn-ghost dshwd-btn-mini',
          disabled: syncDisabled,
          title: syncTitle,
          onClick: () => props.onSyncBaseline(riskFiles),
        }, syncing ? t.syncingBaseline : t.syncBaseline)
        : null)
    : null
  const worktree = displayPath(task.worktreePath)
  // The session can still be running in the base checkout (or another dir)
  // while the task is published; compare normalised paths so Windows casing
  // and trailing separators do not raise a false warning.
  const liveData = readLive(props.live)
  const liveCwd = liveData && liveData.cwd ? displayPath(liveData.cwd) : ''
  const normPath = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  const cwdOff = !!liveCwd && !!task.worktreePath && normPath(liveCwd) !== normPath(worktree)
  return h('aside', { className: 'dshwd-inspector' },
    props.narrow && props.onClose
      ? h('div', { className: 'dshwd-insp-narrow-head' },
        h('span', { className: 'dshwd-insp-narrow-title' }, t.boardInspector),
        h('button', {
          className: 'dshwd-btn dshwd-btn-ghost',
          title: t.close,
          'aria-label': t.close,
          onClick: props.onClose,
        }, '×'))
      : null,
    h('section', { className: 'dshwd-insp-sec' },
      h('div', { className: 'dshwd-insp-title' }, t.mergeCheck, h('span', { className: dotClass }, '●')),
      h('div', { style: { fontSize: '12px', color: summary.tone === 'err' ? 'var(--err)' : summary.tone === 'warn' ? 'var(--warn)' : 'var(--text-2)', lineHeight: '1.5' } },
        mergeSummaryText(t, summary)),
      h('div', { className: 'dshwd-kv', style: { marginTop: '8px' } },
        h('span', { className: 'dshwd-kv-k' }, t.boardTargetBase),
        h('span', { className: 'dshwd-kv-v dshwd-mono', title: props.baseSha }, `${props.baseLabel} @ ${shortSha(props.baseSha)}`)),
      h('div', { className: 'dshwd-kv' },
        h('span', { className: 'dshwd-kv-k' }, t.boardTaskHead),
        h('span', { className: 'dshwd-kv-v dshwd-mono', title: props.headSha }, shortSha(props.headSha))),
      // Blockers stay visible until they clear: a toast disappears before the
      // user can act on "repo dirty" / "agent running" and left them guessing.
      blockers.length
        ? h('div', { className: 'dshwd-blocker-box' },
          h('div', { className: 'dshwd-blocker-title' }, t.boardBlockersTitle),
          h('ul', { className: 'dshwd-blocker-list' }, blockers.map((b: any, i: number) => h('li', { key: (b && b.code) || i }, (b && b.message) || String(b)))))
        : null,
      riskNode,
      riskFiles.length
        ? h('div', { className: 'dshwd-hint', style: { marginTop: '6px', overflowWrap: 'anywhere' } }, t.mergePreviewFiles + '：' + previewFilesText(riskFiles))
        : null,
      previewNoCheck(preview)
        ? h('div', { className: 'dshwd-hint', style: { marginTop: '6px' } }, t.mergePreviewNoCheck)
        : null),

    h('section', { className: 'dshwd-insp-sec' },
      h('div', { className: 'dshwd-insp-title' }, t.techInfo),
      h('div', { className: 'dshwd-kv' },
        h('span', { className: 'dshwd-kv-k' }, t.branchLabel),
        h('span', { className: 'dshwd-kv-path-copy' },
          h('span', { className: 'dshwd-kv-v dshwd-mono', title: task.branch }, task.branch || '—'),
          task.branch
            ? h('button', {
              className: 'dshwd-btn dshwd-btn-ghost dshwd-btn-copy',
              title: t.copyBranch,
              'aria-label': t.copyBranch,
              onClick: () => props.onCopy(task.branch),
            }, '⧉')
            : null)),
      h('div', { className: 'dshwd-kv' },
        h('span', { className: 'dshwd-kv-k' }, t.session),
        h('span', { className: 'dshwd-kv-path-copy' },
          h('span', { className: 'dshwd-kv-v dshwd-mono', title: task.sessionId || '' }, task.sessionId || '—'),
          task.sessionId
            ? h('button', {
              className: 'dshwd-btn dshwd-btn-ghost dshwd-btn-copy',
              title: t.copySessionId,
              'aria-label': t.copySessionId,
              onClick: () => props.onCopy(String(task.sessionId)),
            }, '⧉')
            : null)),
      h('div', { className: 'dshwd-kv dshwd-kv-live', style: { alignItems: 'flex-start' } },
        h('span', { className: 'dshwd-kv-k' }, t.liveCwd),
        h('span', { className: 'dshwd-kv-live-value' },
          h('span', { className: 'dshwd-kv-v dshwd-mono dshwd-path-wrap', title: liveCwd || worktree },
            pathParts(liveCwd || worktree).map((seg, i) => h('span', { key: i }, seg, h('wbr')))),
          cwdOff ? h('span', { className: 'dshwd-chip dshwd-warn dshwd-chip-sm', title: t.liveCwdOff }, t.liveCwdOff) : null)),
      // One worktree path only (the row *is* the copy affordance). Segments wrap
      // at separators, so a long path breaks at directory boundaries.
      h('div', { className: 'dshwd-kv dshwd-kv-path', style: { alignItems: 'flex-start' } },
        h('span', { className: 'dshwd-kv-k' }, t.worktree),
        h('span', { className: 'dshwd-kv-path-copy' },
          h('span', { className: 'dshwd-kv-v dshwd-mono dshwd-path-wrap', title: cleaned ? '' : worktree },
            cleaned ? t.cleaned : pathParts(worktree).map((seg, i) => h('span', { key: i }, seg, h('wbr')))),
          cleaned
            ? null
            : h('button', {
              className: 'dshwd-btn dshwd-btn-ghost dshwd-btn-copy',
              title: t.copyWorktree,
              'aria-label': t.copyWorktree,
              onClick: () => props.onCopy(task.worktreePath),
            }, '⧉')))),

    h('section', { className: 'dshwd-insp-sec' },
      h('div', { className: 'dshwd-insp-title' }, t.lifecycle),
      h('div', { className: 'dshwd-kv' },
        h('span', { className: 'dshwd-kv-k' }, t.uncommitted),
        h('span', { className: 'dshwd-kv-v ' + (dirty ? 'dshwd-text-warn' : 'dshwd-text-ok') }, dirty ? `${dirty} ${t.changesUnit}` : t.clean)),
      props.partialRestore
        ? h('div', { className: 'dshwd-alert', style: { marginTop: '8px' } },
          h('div', null, props.partialRestore.reason || t.restoreFailed),
          h('button', {
            className: 'dshwd-btn',
            style: { marginTop: '6px' },
            disabled: props.busy !== '',
            onClick: props.onRestore,
          }, t.restoreOriginalBranch))
        : null,
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' } },
        h('button', {
          className: 'dshwd-btn',
          disabled: props.busy !== '' || (!props.canArchive && !props.archived),
          title: !props.canArchive && !props.archived ? props.archiveReason : undefined,
          onClick: props.archived ? props.onUnarchive : props.onArchive,
        }, props.archived ? t.unarchive : t.archive),
        h('button', {
          className: 'dshwd-btn dshwd-btn-danger',
          disabled: props.busy !== '' || snap.status === 'cleaned' || agentBusy || reviewing || hasStashes,
          title: props.running
            ? t.acceptAgentRunning
            : props.pending
              ? t.acceptAgentPending
              : reviewing
                ? t.reviewingBlockTitle
                : hasStashes ? t.stashBlocksLifecycle : undefined,
          onClick: props.onCleanup,
        }, t.cleanup),
        h('button', {
          className: 'dshwd-btn dshwd-btn-danger',
          disabled: props.busy !== '' || agentBusy || reviewing || hasStashes,
          title: props.running
            ? t.acceptAgentRunning
            : props.pending
              ? t.acceptAgentPending
              : reviewing
                ? t.reviewingBlockTitle
                : hasStashes ? t.stashBlocksLifecycle : undefined,
          onClick: props.onDelete,
        }, t.deleteRecord))),

    Array.isArray(props.stashes) && props.stashes.length
      ? h('section', { className: 'dshwd-insp-sec' },
        h('div', { className: 'dshwd-insp-title' }, t.stashSection),
        props.stashes.map((s: any, i: number) => h('div', { key: s.sha || i, className: 'dshwd-stash-card' },
          h('div', { className: 'dshwd-kv' },
            h('span', { className: 'dshwd-kv-k' }, s.source === 'merge' ? t.stashSourceMerge : t.stashSourceReview),
            h('span', { className: 'dshwd-kv-v dshwd-mono' }, String(s.sha || s.ref || '').slice(0, 8) || '—')),
          s.files && s.files.length
            ? h('div', { className: 'dshwd-hint', style: { overflowWrap: 'anywhere' } }, s.files.slice(0, 6).join('、'))
            : null,
          s.unverified
            ? h('div', { className: 'dshwd-hint dshwd-text-warn' }, t.stashUnverified)
            : null,
          h('div', { className: 'dshwd-stash-actions' },
            h('button', { className: 'dshwd-btn dshwd-btn-ghost', disabled: props.busy !== '', onClick: () => props.onViewStash(s.sha) }, t.stashViewFiles),
            h('button', { className: 'dshwd-btn dshwd-btn-ghost', disabled: props.busy !== '' || !s.sha || s.unverified, onClick: () => props.onApplyStash(s.sha) }, t.stashApply),
            h('button', { className: 'dshwd-btn dshwd-btn-ghost dshwd-text-err', disabled: props.busy !== '', onClick: () => props.onDropStash(s.sha) }, t.stashDrop)))))
      : null)
}
