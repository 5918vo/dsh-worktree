/**
 * Retro tab card: weekly digest (P0 scaffold).
 *
 * The Markdown builder lives in `project-weekly.ts`; this file only wires the
 * copy / download buttons and renders the summary. Keep the props contract
 * stable — the project detail mounts this component without knowing its
 * internals.
 */
import { React, h } from './ui'
import { Card, CardHead } from './primitives'
import type { Project, TaskView } from '../models'

export interface WeeklyCardProps {
  project: Project
  views: TaskView[]
  t: any
  /** Localized status for one task view, shared with the project report. */
  statusLabel: (view: TaskView) => string
  /** Board toast hook; cards do not own a Toast of their own. */
  notify?: (message: string, tone?: string) => void
  /** One clock read for range and filename; the builder falls back to Date.now(). */
  now?: number
}

export function WeeklyCard(props: WeeklyCardProps) {
  const { t } = props
  return h(Card, { className: 'dshwd-retro-card dshwd-retro-card--wide' },
    h(CardHead, { icon: 'file', title: t.weeklyTitle }),
    h('div', { className: 'dshw-hint' }, t.weeklyNoActivity))
}
