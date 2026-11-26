/**
 * Retro tab card: 12-week activity heatmap (P0 scaffold).
 *
 * The pure calendar derivation lives in `project-activity.ts`; this file only
 * renders it. Keep the props contract stable — the project detail mounts this
 * component without knowing its internals.
 */
import { React, h } from './ui'
import { Card, CardHead } from './primitives'
import type { TaskView } from '../models'

export interface ActivityCardProps {
  views: TaskView[]
  t: any
  /** One clock read for the whole grid; the builder falls back to Date.now(). */
  now?: number
}

export function ActivityCard(props: ActivityCardProps) {
  const { t } = props
  return h(Card, { className: 'dshwd-retro-card dshwd-retro-card--wide' },
    h(CardHead, { icon: 'grid', title: t.activityTitle }),
    h('div', { className: 'dshw-hint' }, t.activityEmpty))
}
