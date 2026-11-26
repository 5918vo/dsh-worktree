/**
 * Retro tab card: estimate calibration (P0 scaffold).
 *
 * The pure derivation lives in `estimate-calibration.ts`; this file only turns
 * its view model into the card markup. Keep the props contract stable — the
 * project detail mounts this component without knowing its internals.
 */
import { React, h } from './ui'
import { Card, CardHead } from './primitives'
import type { TaskView } from '../models'

export interface CalibrationCardProps {
  views: TaskView[]
  t: any
  /** One clock read for the whole card; the builder falls back to Date.now(). */
  now?: number
}

export function CalibrationCard(props: CalibrationCardProps) {
  const { t } = props
  return h(Card, { className: 'dshwd-retro-card' },
    h(CardHead, { icon: 'sliders', title: t.calibrationTitle }),
    h('div', { className: 'dshw-hint' }, t.calibrationEmpty))
}
