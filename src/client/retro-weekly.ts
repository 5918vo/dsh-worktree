/**
 * Retro tab card: weekly digest.
 *
 * The Markdown builder lives in `project-weekly.ts`; this file only renders the
 * stats and wires the copy / download buttons. Keep the props contract stable —
 * the project detail mounts this component without knowing its internals.
 */
import { React, h } from './ui'
import { Btn, Card, CardHead } from './primitives'
import { copyText, downloadText } from './format'
import { formatWorkDuration } from '../task-timer'
import { workDurationUnits } from './work-format'
import { buildWeeklyDigest } from './project-weekly'
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

type Busy = '' | 'copy' | 'download'

export function WeeklyCard(props: WeeklyCardProps) {
  const { project, views, t, statusLabel, notify, now } = props
  const [busy, setBusy] = React.useState('' as Busy)
  // A ref guard flips before the state update lands, so a double click in the
  // same tick cannot run the action twice.
  const guard = React.useRef(false)

  // One digest per render pass: the stats, the Markdown and the file name must
  // describe the same instant, so they all come from one builder call.
  const digest = React.useMemo(
    () => buildWeeklyDigest({ project, views, t, statusLabel, now }),
    [project, views, t, statusLabel, now],
  )

  const build = () => buildWeeklyDigest({ project, views, t, statusLabel, now })
  // The board's toast takes a boolean "error" flag while this props contract
  // keeps `tone` a string; widen at the call so both stay unchanged.
  const fail = (e: any) => {
    if (notify) (notify as any)(String((e && e.message) || t.weeklyFailed), true)
  }

  const copy = async () => {
    if (guard.current) return
    guard.current = true
    setBusy('copy')
    try {
      const ok = await copyText(build().markdown)
      if (!ok) throw new Error(String(t.weeklyFailed))
      if (notify) notify(t.weeklyCopied)
    } catch (e: any) {
      fail(e)
    } finally {
      guard.current = false
      setBusy('')
    }
  }

  const download = () => {
    if (guard.current) return
    guard.current = true
    setBusy('download')
    try {
      const current = build()
      if (!downloadText(current.markdown, current.filename)) throw new Error(String(t.weeklyFailed))
      if (notify) notify(t.weeklyDownloaded)
    } catch (e: any) {
      fail(e)
    } finally {
      guard.current = false
      setBusy('')
    }
  }

  const stats = digest.stats
  const units = workDurationUnits(t)
  const rows = [
    { key: 'new', value: String(stats.newTasks), label: t.weeklyNewTasks },
    { key: 'merged', value: String(stats.mergedTasks), label: t.weeklyMergedTasks },
    { key: 'work', value: formatWorkDuration(stats.workMs, units), label: t.weeklyWork },
    { key: 'estimate', value: String(stats.completedEstimatePoints), label: t.weeklyEstimatesDone },
    { key: 'blocked', value: String(stats.blocked), label: t.weeklyBlocked },
    { key: 'due', value: String(stats.dueSoon), label: t.weeklyDueSoon },
    { key: 'stale', value: String(stats.stale), label: t.weeklyStale },
  ]

  return h(Card, { className: 'dshwd-retro-card dshwd-retro-card--wide' },
    h(CardHead, { icon: 'file', title: t.weeklyTitle }),
    h('div', { className: 'dshw-hint' }, t.weeklyHint),
    h('div', { className: 'dshwd-weekly-stats' },
      rows.map((row) => h('div', { key: row.key, className: 'dshwd-weekly-stat' },
        h('div', { className: 'dshwd-weekly-stat-num' }, row.value),
        h('div', { className: 'dshwd-weekly-stat-label' }, row.label)))),
    digest.activeCount === 0
      ? h('div', { className: 'dshw-hint' }, t.weeklyEmpty)
      : null,
    // The actions stay enabled on an empty week: the buttons still produce a
    // valid digest that says "no activity", which is the honest report.
    h('div', { className: 'dshwd-weekly-actions' },
      h(Btn, {
        variant: 'ghost',
        size: 'sm',
        icon: 'copy',
        disabled: busy !== '',
        onClick: () => { void copy() },
      }, t.weeklyCopy),
      h(Btn, {
        variant: 'ghost',
        size: 'sm',
        icon: 'file',
        disabled: busy !== '',
        onClick: download,
      }, t.weeklyDownload)))
}
