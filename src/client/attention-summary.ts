import { React, h } from './ui'
import { Icon } from './primitives'
import { CATEGORY_ORDER, categoryKey, severityOf } from './task-attention'

/**
 * Compact attention summary shown above the task list. It renders nothing when
 * there is nothing to report and no stale data. Counts come from the same
 * attention map as the filter and the rows, so the three can never disagree.
 *
 * Collapse is session-only and auto-expands when a new or more severe problem
 * appears (without stealing focus). aria-live announces only when the category
 * set or severity actually changes, not on every count tick.
 */
/**
 * Title text for one summary bar. Pure so the severity ladder is unit-testable:
 * stale wins, then the most severe present category, and a board where only
 * stalled tasks remain says so instead of claiming there is nothing.
 */
export function attentionSummaryTitle(
  t: any,
  counts: Record<string, number>,
  stale: boolean,
  time: string,
): string {
  const present = CATEGORY_ORDER.filter((category) => (counts[category] || 0) > 0)
  const severity = present.length ? severityOf(present[0]) : 0
  if (stale) return String(t.attentionStale).replace('{time}', time)
  if (severity >= 4) return String(t.attentionSummaryRecovery).replace('{n}', String(counts.recovery || 0))
  if (severity >= 3) return String(t.attentionSummaryBroken).replace('{n}', String(counts.broken || 0))
  if (severity >= 2) return String(t.attentionSummaryPending).replace('{n}', String(counts.pending || 0))
  if (Number(counts.review || 0) > 0) return String(t.attentionSummaryReview).replace('{n}', String(counts.review || 0))
  return String(t.attentionSummaryStalled).replace('{n}', String(counts.stalled || 0))
}

export function AttentionSummaryBar(props: any) {
  const t = props.t
  const counts: Record<string, number> = props.counts || {}
  const total = Number(props.total || 0)
  const stale = !!props.stale
  const present = CATEGORY_ORDER.filter((category) => (counts[category] || 0) > 0)
  const severity = present.length ? severityOf(present[0]) : 0
  const signature = present.join('|') + '#' + severity + '#' + total
  const time = props.lastOkAt ? formatTime(props.lastOkAt) : '—'
  const title = attentionSummaryTitle(t, counts, stale, time)

  const [collapsed, setCollapsed] = React.useState(false)
  const [announce, setAnnounce] = React.useState('')
  const prevCats = React.useRef('')
  const prevSev = React.useRef(0)
  const prevSig = React.useRef('')

  React.useEffect(() => {
    if (prevSig.current && signature !== prevSig.current) {
      const known = prevCats.current ? prevCats.current.split('|') : []
      const newCategory = present.some((category) => known.indexOf(category) < 0)
      if (severity > prevSev.current || newCategory) setCollapsed(false)
      setAnnounce(title)
    }
    prevCats.current = present.join('|')
    prevSev.current = severity
    prevSig.current = signature
  })

  if (!stale && total === 0) return null

  const iconName = stale ? 'clock' : severity >= 3 ? 'alert' : 'clock'
  const tone = stale ? 'neutral' : severity >= 3 ? 'error' : 'warn'

  return h('div', {
    className: 'dshwd-attbar dshwd-attbar-' + tone,
    role: 'status',
    'data-signature': signature,
  },
    h('span', { className: 'dshwd-attbar-icon' }, h(Icon, { name: iconName })),
    h('span', { className: 'dshwd-attbar-text', title }, title),
    !collapsed && !stale && present.length
      ? h('span', { className: 'dshwd-attbar-links' }, present.map((category) => h('button', {
        key: category,
        type: 'button',
        className: 'dshwd-attbar-link',
        onClick: () => props.onView && props.onView(category),
      }, t[categoryKey(category)] + ' ' + String(counts[category] || 0))))
      : null,
    !stale
      ? h('button', {
        type: 'button',
        className: 'dshwd-attbar-collapse',
        'aria-expanded': collapsed ? 'false' : 'true',
        title: collapsed ? t.expand : t.collapse,
        onClick: () => setCollapsed((value: boolean) => !value),
      }, collapsed ? t.expand : t.collapse)
      : null,
    h('span', { className: 'dshwd-sr-only', 'aria-live': 'polite' }, announce))
}

function formatTime(ts: number): string {
  try {
    const d = new Date(ts)
    const pad = (n: number) => String(n).padStart(2, '0')
    return pad(d.getHours()) + ':' + pad(d.getMinutes())
  } catch {
    return '—'
  }
}
