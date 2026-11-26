/**
 * Retro tab card: 12-week activity heatmap.
 *
 * The pure calendar derivation lives in `project-activity.ts`; this file only
 * renders it. Keep the props contract stable — the project detail mounts this
 * component without knowing its internals.
 */
import { React, h } from './ui'
import { Card, CardHead } from './primitives'
import { fill } from './markdown'
import { buildProjectActivity } from './project-activity'
import type { TaskView } from '../models'

export interface ActivityCardProps {
  views: TaskView[]
  t: any
  /** One clock read for the whole grid; the builder falls back to Date.now(). */
  now?: number
}

/** Monday-first weekday labels, matching the builder's weekday 0..6. */
const WEEKDAY_KEYS = [
  'activityMon',
  'activityTue',
  'activityWed',
  'activityThu',
  'activityFri',
  'activitySat',
  'activitySun',
]

const INTENSITY_LEVELS = [0, 1, 2, 3, 4]

export function ActivityCard(props: ActivityCardProps) {
  const { t, views, now } = props
  const activity = buildProjectActivity(views, now)

  const cells = activity.days.map((day) => {
    const tone = day.future
      ? ' dshwd-heatmap-cell--future'
      : day.total > 0
        ? ' dshwd-heatmap-cell--l' + day.intensity
        : ''
    const tip = fill(t.activityDayTip, {
      date: day.dateKey,
      created: day.created,
      merged: day.merged,
      updated: day.updated,
    })
    return h('div', {
      key: day.dateKey,
      className: 'dshwd-heatmap-cell' + tone,
      title: tip,
      'aria-label': tip,
      role: 'img',
    })
  })

  const weekdays = WEEKDAY_KEYS.map((key) => h('div', { key }, t[key]))

  const legend = h('div', {
    key: 'legend',
    className: 'dshwd-heatmap-legend',
    'aria-label': t.activityLegend,
    role: 'img',
  },
    h('span', null, t.activityLess),
    INTENSITY_LEVELS.map((level) => h('span', {
      key: 'l' + level,
      className: 'dshwd-heatmap-cell' + (level > 0 ? ' dshwd-heatmap-cell--l' + level : ''),
      'aria-hidden': 'true',
    })),
    h('span', null, t.activityMore))

  return h(Card, { className: 'dshwd-retro-card dshwd-retro-card--wide' },
    h(CardHead, { icon: 'grid', title: t.activityTitle }),
    h('div', { className: 'dshw-hint' }, t.activityHint),
    activity.total === 0
      ? h('div', { className: 'dshw-hint' }, t.activityEmpty)
      : [
        h('div', { key: 'total', className: 'dshw-hint' }, fill(t.activityTotal, { n: activity.total })),
        h('div', { key: 'grid', className: 'dshwd-heatmap-wrap' },
          h('div', { className: 'dshwd-heatmap-weekdays', 'aria-hidden': 'true' }, weekdays),
          h('div', { className: 'dshwd-heatmap' }, cells)),
        legend,
      ])
}
