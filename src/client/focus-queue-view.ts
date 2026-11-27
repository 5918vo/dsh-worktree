/**
 * Focus queue dialog: up to ten actionable tasks, each row a jump target.
 *
 * The dialog only explains and navigates; it never changes a status, a sort
 * order or a filter. It reuses the shared Modal primitive for the portal,
 * focus trap, Escape handling and focus return.
 */

import { React, h } from './ui'
import { Modal } from './primitives'
import { fill } from './markdown'
import type { FocusQueue, FocusReason } from './focus-queue'

export interface FocusQueueDialogProps {
  t: any
  queue: FocusQueue
  onClose: () => void
  onSelectTask: (taskId: string, projectId: string) => void
}

/** One localized label per reason chip; `n` fills the number templates. */
export function focusReasonLabel(t: any, reason: FocusReason): string {
  switch (reason && reason.code) {
    case 'pending': return String(t.focusReasonPending)
    case 'overdue': return fill(t.focusReasonOverdue, { n: reason.n == null ? 0 : reason.n })
    case 'due-today': return String(t.focusReasonDueToday)
    case 'due-soon': return String(t.focusReasonDueSoon)
    case 'review': return String(t.focusReasonReview)
    case 'high-priority': return String(t.focusReasonHighPriority)
    case 'stalled': return fill(t.focusReasonStalled, { n: reason.n == null ? 0 : reason.n })
    case 'unblocks': return fill(t.focusReasonUnblocks, { n: reason.n == null ? 0 : reason.n })
    case 'risk': return fill(t.focusReasonRisk, { n: reason.n == null ? 0 : reason.n })
    default: return ''
  }
}

export function FocusQueueDialog(props: FocusQueueDialogProps) {
  const { t, queue } = props
  const count = (template: any, n: number) => fill(template, { n })

  const empty = queue.total === 0
    ? { title: t.focusEmptyNone, hint: t.focusEmptyNoneHint }
    : queue.ready === 0 && queue.waiting > 0
      ? { title: t.focusEmptyWaiting, hint: t.focusEmptyWaitingHint }
      : null

  return h(Modal, {
    t,
    title: t.focusTitle,
    subtitle: t.focusSubtitle,
    icon: 'circle',
    size: 'lg',
    onClose: props.onClose,
    footer: [
      h('span', { key: 'meta', className: 'dshwd-focus-foot-meta' }, count(t.focusCountTotal, queue.total)),
      h('button', {
        key: 'close',
        type: 'button',
        className: 'dshwd-btn',
        onClick: props.onClose,
      }, t.close),
    ],
    children: [
      h('div', { key: 'counts', className: 'dshwd-focus-counts' },
        h('span', { className: 'dshwd-focus-count dshwd-focus-count--ready' }, count(t.focusCountReady, queue.ready)),
        h('span', { className: 'dshwd-focus-count dshwd-focus-count--waiting' }, count(t.focusCountWaiting, queue.waiting)),
        h('span', { className: 'dshwd-focus-count dshwd-focus-count--total' }, count(t.focusCountTotal, queue.total))),

      empty
        ? h('div', { key: 'empty', className: 'dshwd-focus-empty', role: 'status' },
          h('div', { className: 'dshwd-focus-empty-title' }, empty.title),
          h('div', { className: 'dshwd-focus-empty-hint' }, empty.hint))
        : h('div', { key: 'list', className: 'dshwd-focus-list', role: 'group', 'aria-label': t.focusTitle },
          queue.items.map((item, index) => {
            const reasons = item.reasons.map((reason) => focusReasonLabel(t, reason)).filter(Boolean)
            const rank = index + 1
            const label = fill(t.focusItemLabel, {
              rank,
              title: item.title,
              project: item.projectName,
            }) + (reasons.length ? ' · ' + reasons.join(' · ') : '')
            return h('button', {
              key: item.taskId,
              type: 'button',
              className: 'dshwd-focus-row',
              'aria-label': label,
              title: label,
              onClick: () => {
                // Close first: the task detail must not fight the dialog for focus.
                props.onClose()
                props.onSelectTask(item.taskId, item.projectId)
              },
            },
              h('span', { className: 'dshwd-focus-rank dshwd-mono', 'aria-hidden': 'true' }, String(rank)),
              h('span', { className: 'dshwd-focus-main' },
                h('span', { className: 'dshwd-focus-title' }, item.title),
                h('span', { className: 'dshwd-focus-project' }, item.projectName)),
              h('span', {
                className: 'dshwd-focus-score dshwd-mono',
                'aria-hidden': 'true',
                title: fill(t.focusScoreTitle, { n: item.score }),
              }, String(item.score)),
              h('span', { className: 'dshwd-focus-reasons' },
                reasons.map((reason: string, i: number) => h('span', { key: i, className: 'dshwd-focus-chip' }, reason))))
          })),
    ],
  })
}
