import { React, h } from './ui'
import { Icon } from './primitives'

/**
 * Compact attention summary above the two-column board. It renders nothing when
 * there is nothing to report and no stale data. Counts come from the same
 * attention map as the filter/rows. Collapse is session-only and auto-expands
 * when a new or more severe problem appears (without stealing focus).
 */
export function AttentionSummaryBar(props: any) {
  const t = props.t
  const counts: Record<string, number> = props.counts || {}
  const total = Number(props.total || 0)
  const stale = !!props.stale
  const present = ['recovery', 'pending', 'broken'].filter((c) => (counts[c] || 0) > 0)
  const severity = (counts.recovery || 0) > 0 ? 4 : (counts.broken || 0) > 0 ? 3 : (counts.pending || 0) > 0 ? 2 : 0
  const signature = present.join('|') + '#' + severity + '#' + total
  const time = props.lastOkAt ? formatTime(props.lastOkAt) : '—'
  const title = stale
    ? String(t.attentionStale).replace('{time}', time)
    : severity >= 4
      ? String(t.attentionSummaryRecovery).replace('{n}', String(counts.recovery || 0))
      : severity >= 3
        ? String(t.attentionSummaryBroken).replace('{n}', String(counts.broken || 0))
        : String(t.attentionSummaryPending).replace('{n}', String(counts.pending || 0))

  const [collapsed, setCollapsed] = React.useState(false)
  const [announce, setAnnounce] = React.useState('')
  const prevCats = React.useRef('')
  const prevSev = React.useRef(0)
  const prevSig = React.useRef('')

  React.useEffect(() => {
    if (prevSig.current && signature !== prevSig.current) {
      const newCategory = present.some((c) => !prevCats.current.split('|').includes(c))
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
  const links = stale ? [] : present

  return h('div', { className: 'dshw-attention-bar dshw-attention-bar--' + tone, role: 'status', 'data-signature': signature },
    h('span', { className: 'dshw-attention-bar__icon' }, h(Icon, { name: iconName })),
    h('span', { className: 'dshw-attention-bar__text' }, title),
    !collapsed && links.length
      ? h('span', { className: 'dshw-attention-bar__links' }, links.map((cat) => h('button', {
        key: cat,
        type: 'button',
        className: 'dshw-link-btn',
        onClick: () => props.onView && props.onView(cat),
      }, t[cat === 'recovery' ? 'attentionViewRecovery' : cat === 'pending' ? 'attentionViewPending' : 'attentionViewBroken'])))
      : null,
    !stale
      ? h('button', {
        type: 'button',
        className: 'dshw-attention-bar__collapse',
        'aria-expanded': collapsed ? 'false' : 'true',
        onClick: () => setCollapsed((v: boolean) => !v),
      }, collapsed ? t.expand : t.collapse)
      : null,
    h('span', { className: 'dshw-sr-only', 'aria-live': 'polite' }, announce))
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
