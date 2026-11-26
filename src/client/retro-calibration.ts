/**
 * Retro tab card: estimate calibration.
 *
 * The pure derivation lives in `estimate-calibration.ts`; this file only turns
 * its view model into the card markup. Keep the props contract stable — the
 * project detail mounts this component without knowing its internals.
 */
import { React, h } from './ui'
import { Card, CardHead } from './primitives'
import { fill } from './markdown'
import { formatWorkDuration } from '../task-timer'
import { workDurationUnits } from './work-format'
import type { TaskView } from '../models'
import { buildEstimateCalibration, type CalibrationSample } from './estimate-calibration'

export interface CalibrationCardProps {
  views: TaskView[]
  t: any
  /** One clock read for the whole card; the builder falls back to Date.now(). */
  now?: number
}

/** Confidence chip copy and tone, keyed by the builder's confidence level. */
const CONFIDENCE_KEYS: Record<string, string> = {
  low: 'calibrationConfidenceLow',
  medium: 'calibrationConfidenceMedium',
  high: 'calibrationConfidenceHigh',
}

const CONFIDENCE_TONES: Record<string, string> = {
  low: 'dshwd-weak',
  medium: 'dshwd-accent',
  high: 'dshwd-ok',
}

const TABLE_LIMIT = 5

/** A near-average sample is within ±5%; anything else names the direction. */
const ON_TARGET_PERCENT = 5

/** Variance text and tone for one sample; negative means under the average. */
function varianceCell(t: any, sample: CalibrationSample) {
  const percent = sample.variancePercent
  const abs = Math.abs(percent)
  if (abs <= ON_TARGET_PERCENT) {
    return h('td', { className: 'dshwd-mono' }, t.calibrationOnTarget)
  }
  const over = percent > 0
  return h('td', { className: 'dshwd-mono dshwd-calib-variance--' + (over ? 'over' : 'under') },
    over
      ? fill(t.calibrationOver, { percent: abs })
      : fill(t.calibrationUnder, { percent: abs }))
}

export function CalibrationCard(props: CalibrationCardProps) {
  const { t } = props
  const data = buildEstimateCalibration(props.views, props.now)
  const units = workDurationUnits(t)

  const head = h(CardHead, { icon: 'sliders', title: t.calibrationTitle })
  const hint = h('div', { className: 'dshw-hint' }, t.calibrationHint)

  if (data.sampleCount === 0 || data.hoursPerPoint == null) {
    return h(Card, { className: 'dshwd-retro-card' },
      head,
      hint,
      h('div', { className: 'dshw-hint' }, t.calibrationEmpty))
  }

  const perPoint = data.hoursPerPoint.toFixed(1)
  const totalWork = formatWorkDuration(data.totalWorkMs, units)
  const confidenceText = t[CONFIDENCE_KEYS[data.confidence]]
  const coverage = data.coveragePercent == null
    ? data.estimatedTasks + '/' + data.totalTasks
    : data.estimatedTasks + '/' + data.totalTasks + ' · ' + data.coveragePercent + '%'

  const figures = h('div', { className: 'dshwd-calib-figures' },
    h('div', { className: 'dshwd-calib-figure' },
      h('div', { className: 'dshwd-calib-figure-num' }, perPoint),
      h('div', { className: 'dshwd-calib-figure-label' }, fill(t.calibrationPerPoint, { h: perPoint }))),
    h('div', { className: 'dshwd-calib-figure' },
      h('div', { className: 'dshwd-calib-figure-num' }, data.sampleCount),
      h('div', { className: 'dshwd-calib-figure-label' }, fill(t.calibrationSamples, { n: data.sampleCount }))),
    h('div', { className: 'dshwd-calib-figure' },
      h('div', { className: 'dshwd-calib-figure-num' }, totalWork),
      h('div', { className: 'dshwd-calib-figure-label' },
        fill(t.calibrationTotal, { points: data.totalPoints, work: totalWork }))))

  const rows = data.samples.slice(0, TABLE_LIMIT).map((sample, index) => h('tr', { key: sample.taskId + ':' + index },
    h('td', { className: 'dshwd-calib-task', title: sample.title }, sample.title),
    h('td', { className: 'dshwd-mono' }, fill(t.calibrationPoints, { n: sample.estimate })),
    h('td', { className: 'dshwd-mono' }, formatWorkDuration(sample.workMs, units)),
    varianceCell(t, sample)))

  const table = h('table', { className: 'dshwd-calib-table' },
    h('thead', null,
      h('tr', null,
        h('th', null, t.calibrationTask),
        h('th', { className: 'dshwd-mono' }, t.calibrationEstimate),
        h('th', { className: 'dshwd-mono' }, t.calibrationActual),
        h('th', { className: 'dshwd-mono' }, t.calibrationVariance))),
    h('tbody', null, rows))

  return h(Card, { className: 'dshwd-retro-card' },
    head,
    hint,
    figures,
    h('div', { className: 'dshwd-calib-confidence' },
      h('span', { className: 'dshwd-chip ' + CONFIDENCE_TONES[data.confidence] }, confidenceText)),
    h('div', { className: 'dshw-hint' }, coverage),
    table,
    h('div', { className: 'dshw-hint' }, fill(t.calibrationSuggestion, { h: perPoint })))
}
