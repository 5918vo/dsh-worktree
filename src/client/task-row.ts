import { React, h } from './ui'
import { Chip, Icon } from './primitives'
import { postMergeLabel, resolveStatus, statusMeta } from './status'
import { quickActionKey } from './task-attention'

/**
 * One task row: a selectable three-line content area, an optional focusable
 * "more status" disclosure, and a single fixed quick action. No buttons are
 * nested; every part is a sibling control.
 */
export function TaskRow(props: any) {
  const t = props.t
  const view = props.view
  const task = view.task
  const snap = view.snapshot
  const attention = props.attention
  const running = props.running
  const pendingKind = props.pendingKind
  const health = props.health

  const effectiveStatus = resolveStatus(snap.status, running)
  const base = statusMeta(t, effectiveStatus, null)
  const ahead = Number((snap.worktree && snap.worktree.ahead) || 0)
  const dirty = Number((snap.worktree && snap.worktree.dirtyCount) || 0)
  const postMerge = Number(snap.postMergeAhead || 0)

  const alertText = (kind: string): string => {
    if (kind === 'recovery') return t.attentionRecovery
    if (kind === 'pending') {
      if (pendingKind === 'question') return t.pendingQuestion
      if (pendingKind === 'plan-review') return t.pendingPlanReview
      return t.pendingApproval
    }
    if (kind === 'broken') return t.broken
    if (kind === 'post-merge') return postMergeLabel(t, postMerge)
    if (kind === 'session') return health && health.kind === 'error' ? t.sessionError : t.sessionInterrupted
    return ''
  }
  const alertTone = (kind: string): string => {
    if (kind === 'broken' || kind === 'recovery') return 'error'
    if (kind === 'session') return health && health.kind === 'error' ? 'error' : 'warn'
    return 'warn'
  }
  const alertIcon = (kind: string): string => {
    if (kind === 'broken' || kind === 'recovery') return 'alert'
    if (kind === 'pending') return 'clock'
    if (kind === 'post-merge') return 'merge'
    return 'circle'
  }

  const [moreOpen, setMoreOpen] = React.useState(false)
  const moreRef = React.useRef(null)
  const moreBtnRef = React.useRef(null)
  React.useEffect(() => {
    if (!moreOpen) return undefined
    const onPointer = (e: any) => {
      const root: any = moreRef.current
      if (root && !root.contains(e.target)) setMoreOpen(false)
    }
    document.addEventListener('pointerdown', onPointer, true)
    return () => document.removeEventListener('pointerdown', onPointer, true)
  }, [moreOpen])
  const onMoreKey = (e: any) => {
    if (e.key === 'Escape' && moreOpen) {
      e.preventDefault()
      setMoreOpen(false)
      if (moreBtnRef.current) (moreBtnRef.current as any).focus()
    }
  }

  const extraAlerts: string[] = (attention && attention.extraAlerts) || []
  const quick = attention && attention.quickAction
  const quickLabel = quick ? t[quickActionKey(quick)] : ''
  const quickIcon = quick === 'handle' ? 'message' : quick === 'review' ? 'checkCircle' : quick === 'recover' ? 'archiveRestore' : 'external'

  return h('div', {
    className: 'dshw-trow' + (props.active ? ' dshw-trow--on' : ''),
    role: 'listitem',
    'data-task-id': task.id,
  },
    h('button', {
      type: 'button',
      className: 'dshw-trow-content',
      onClick: () => props.onSelect && props.onSelect(view),
      title: task.title,
      'aria-label': task.title,
      'aria-current': props.active ? 'true' : undefined,
    },
      h('span', { className: 'dshw-trow-title' }, task.title),
      h('span', { className: 'dshw-trow-meta' },
        h(Chip, { tone: base.tone, small: true }, base.label),
        attention && attention.primaryAlert ? h(Chip, { tone: alertTone(attention.primaryAlert), small: true }, alertText(attention.primaryAlert)) : null),
      h('span', { className: 'dshw-trow-counts' },
        ahead > 0 ? h('span', { className: 'dshw-trow-count', title: ahead + ' ' + t.commitsAhead }, h(Icon, { name: 'arrowUp' }), String(ahead)) : null,
        dirty > 0 ? h('span', { className: 'dshw-trow-count', title: dirty + ' ' + t.changedFilesCount }, h(Icon, { name: 'file' }), String(t.changedFilesCount).replace('{n}', String(dirty))) : null)),
    extraAlerts.length
      ? h('button', {
        ref: moreBtnRef,
        type: 'button',
        className: 'dshw-trow-more',
        title: t.moreStates,
        'aria-label': t.moreStates + '：' + task.title,
        'aria-expanded': moreOpen ? 'true' : 'false',
        onClick: () => setMoreOpen((value: boolean) => !value),
        onKeyDown: onMoreKey,
      }, h(Icon, { name: 'more' }))
      : null,
    quick
      ? h('button', {
        type: 'button',
        className: 'dshw-trow-quick',
        title: quickLabel,
        'aria-label': quickLabel + '：' + task.title,
        onClick: () => props.onQuick && props.onQuick(quick, view),
      }, h(Icon, { name: quickIcon }), h('span', { className: 'dshw-trow-quick-label' }, quickLabel))
      : null,
    extraAlerts.length && moreOpen
      ? h('div', { ref: moreRef, className: 'dshw-trow-popover', role: 'group', 'aria-label': t.moreStates },
        extraAlerts.map((kind: string, i: number) => h('div', { key: i, className: 'dshw-trow-pop-item' },
          h(Icon, { name: alertIcon(kind), className: 'dshw-trow-pop-ico' }),
          h('span', null, alertText(kind)))))
      : null)
}
