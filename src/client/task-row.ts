import { React, h } from './ui'
import { Icon } from './primitives'
import { postMergeLabel, statusMeta } from './status'
import { quickActionKey } from './task-attention'

/**
 * One task row, rendered as the compact two-line item from demo.html:
 *   row1: status dot · title (ellipsis) · stat (↑ahead)
 *   row2: short branch · status label
 * The whole row selects the task; a single quick action appears on hover.
 * Extra alert kinds live behind a small "more" disclosure so nothing is lost.
 */
export function TaskRow(props: any) {
  const t = props.t
  const view = props.view
  const task = view.task
  const snap = view.snapshot
  const attention = props.attention

  const status = String(snap.status || '')
  const running = props.running
  const effective = running === true ? 'developing' : status
  const base = statusMeta(t, running === true ? 'developing' : status, null)
  const ahead = Number((snap.worktree && snap.worktree.ahead) || 0)
  const dirty = Number((snap.worktree && snap.worktree.dirtyCount) || 0)

  const dotClass = effective === 'review'
    ? 'dshw-dot--warn'
    : effective === 'merged'
      ? 'dshw-dot--success'
      : effective === 'developing' || effective === 'reviewing'
        ? 'dshw-dot--brand dshw-dot--pulse'
        : effective === 'broken' || effective === 'error'
          ? 'dshw-dot--error'
          : 'dshw-dot--neutral'

  const stat = ahead > 0 ? '↑' + ahead : dirty > 0 ? dirty + '•' : ''
  const branch = String(task.branch || '').replace(/^dsh-wt\//, '')

  const alertText = (kind: string): string => {
    if (kind === 'recovery') return t.attentionRecovery
    if (kind === 'pending') {
      if (props.pendingKind === 'question') return t.pendingQuestion
      if (props.pendingKind === 'plan-review') return t.pendingPlanReview
      return t.pendingApproval
    }
    if (kind === 'broken') return t.broken
    if (kind === 'post-merge') return postMergeLabel(t, Number((snap && snap.postMergeAhead) || 0))
    if (kind === 'session') return props.health && props.health.kind === 'error' ? t.sessionError : t.sessionInterrupted
    return ''
  }
  const alertIcon = (kind: string): string => {
    if (kind === 'broken' || kind === 'recovery') return 'alert'
    if (kind === 'pending') return 'clock'
    if (kind === 'post-merge') return 'merge'
    return 'circle'
  }

  const [moreOpen, setMoreOpen] = React.useState(false)
  const moreRef = React.useRef(null)
  React.useEffect(() => {
    if (!moreOpen) return undefined
    const onPointer = (e: any) => {
      const root: any = moreRef.current
      if (root && !root.contains(e.target)) setMoreOpen(false)
    }
    document.addEventListener('pointerdown', onPointer, true)
    return () => document.removeEventListener('pointerdown', onPointer, true)
  }, [moreOpen])

  const extraAlerts: string[] = (attention && attention.extraAlerts) || []
  const quick = attention && attention.quickAction
  const quickLabel = quick ? t[quickActionKey(quick)] : ''
  const quickIcon = quick === 'handle' ? 'message' : quick === 'review' ? 'checkCircle' : quick === 'recover' ? 'archiveRestore' : 'external'

  return h('div', {
    className: 'dshw-item' + (props.active ? ' dshw-item--on' : ''),
    role: 'listitem',
    'data-task-id': task.id,
  },
    h('button', {
      type: 'button',
      className: 'dshw-item-hit',
      onClick: () => props.onSelect && props.onSelect(view),
      title: task.title,
      'aria-label': task.title,
      'aria-current': props.active ? 'true' : undefined,
    },
      h('div', { className: 'dshw-item-row1' },
        h('span', { className: 'dshw-dot ' + dotClass }),
        h('span', { className: 'dshw-item-title' }, task.title),
        stat ? h('span', { className: 'dshw-item-stat mono' }, stat) : null),
      h('div', { className: 'dshw-item-row2 mono' },
        h('span', { className: 'dshw-item-branch' }, branch || '—'),
        h('span', { className: 'dshw-item-status' }, base.label))),
    quick
      ? h('button', {
        type: 'button',
        className: 'dshw-item-quick',
        title: quickLabel,
        'aria-label': quickLabel + '：' + task.title,
        onClick: (e: any) => { e.stopPropagation(); props.onQuick && props.onQuick(quick, view) },
      }, h(Icon, { name: quickIcon }))
      : null,
    extraAlerts.length
      ? h('button', {
        type: 'button',
        className: 'dshw-item-more',
        title: t.moreStates,
        'aria-label': t.moreStates + '：' + task.title,
        'aria-expanded': moreOpen ? 'true' : 'false',
        onClick: (e: any) => { e.stopPropagation(); setMoreOpen((v: boolean) => !v) },
      }, h(Icon, { name: 'more' }))
      : null,
    extraAlerts.length && moreOpen
      ? h('div', { ref: moreRef, className: 'dshw-item-popover', role: 'group', 'aria-label': t.moreStates },
        extraAlerts.map((kind: string, i: number) => h('div', { key: i, className: 'dshw-trow-pop-item' },
          h(Icon, { name: alertIcon(kind), className: 'dshw-trow-pop-ico' }),
          h('span', null, alertText(kind)))))
      : null)
}
