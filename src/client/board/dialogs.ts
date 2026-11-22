/**
 * Typed confirmation and stash-diff modal components for the workbench board.
 */

import { React, h } from '../ui'

export interface ConfirmCheck {
  key: string
  label: string
  hint?: string
  checked?: boolean
  disabled?: boolean
  dependsOn?: string
}

export interface ConfirmState {
  title: string
  body: string
  /** Structured facts (branch, baseline, commits...) shown above the checks. */
  details?: ConfirmDetail[]
  label: string
  danger?: boolean
  checks?: ConfirmCheck[]
  run: (values: Record<string, boolean>) => Promise<void> | void
}

export interface ConfirmDetail {
  label: string
  value: string
  mono?: boolean
}

export interface StashViewState {
  sha: string
  patch: string
  loading: boolean
  error: string
}

export interface ConfirmDialogProps {
  t: Record<string, any>
  title: string
  body: string
  details?: ConfirmDetail[]
  label: string
  danger?: boolean
  checks?: ConfirmCheck[]
  busy: boolean
  onCancel: () => void
  onConfirm: (values: Record<string, boolean>) => void
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  const { t } = props
  const checks: ConfirmCheck[] = Array.isArray(props.checks) ? props.checks : []
  const [values, setValues] = React.useState(() => {
    const init: Record<string, boolean> = {}
    for (const c of checks) init[c.key] = !!c.checked
    return init
  })
  const enabled = (c: ConfirmCheck) => !c.dependsOn || !!values[c.dependsOn]
  const toggle = (c: ConfirmCheck) =>
    setValues((prev: Record<string, boolean>) => Object.assign({}, prev, { [c.key]: !prev[c.key] }))

  return h('div', {
    className: 'dshwd-modal-backdrop',
    onMouseDown: (e: MouseEvent) => {
      if (e.target === e.currentTarget && !props.busy) props.onCancel()
    },
  },
  h('div', { className: 'dshwd-modal dshwd-modal-sm', role: 'dialog', 'aria-modal': 'true', 'aria-label': props.title },
    h('div', { className: 'dshwd-modal-head' },
      h('div', { className: 'dshwd-modal-title' }, props.title),
      h('button', { className: 'dshwd-btn dshwd-btn-ghost', onClick: props.onCancel, disabled: props.busy }, '×')),
    h('div', { className: 'dshwd-modal-body' },
      h('div', { className: 'dshwd-prose', style: { fontSize: '12.5px' } }, props.body),
      Array.isArray(props.details) && props.details.length
        ? h('div', { className: 'dshwd-confirm-details' }, props.details.map((d, i) => h('div', { key: i, className: 'dshwd-kv' },
          h('span', { className: 'dshwd-kv-k' }, d.label),
          h('span', { className: 'dshwd-kv-v' + (d.mono ? ' dshwd-mono' : ''), title: d.value }, d.value))))
        : null,
      checks.length
        ? h('div', { className: 'dshwd-check-list' }, checks.map((c) => {
          const allowed = enabled(c) && !c.disabled
          return h('label', { key: c.key, className: 'dshwd-check-row', style: allowed ? undefined : { opacity: 0.55 } },
            h('input', {
              type: 'checkbox',
              checked: !!(values[c.key] && allowed),
              disabled: !allowed || props.busy,
              onChange: () => toggle(c),
            }),
            h('span', null,
              h('span', { className: 'dshwd-check-label' }, c.label),
              c.hint ? h('span', { className: 'dshwd-check-hint' }, c.hint) : null))
        }))
        : null),
    h('div', { className: 'dshwd-modal-foot' },
      h('span', { className: 'dshwd-modal-foot-meta' }),
      h('div', { className: 'dshwd-modal-foot-actions' },
        h('button', { className: 'dshwd-btn', disabled: props.busy, onClick: props.onCancel }, t.cancel),
        h('button', {
          className: 'dshwd-btn ' + (props.danger ? 'dshwd-btn-danger' : 'dshwd-btn-cta'),
          disabled: props.busy,
          onClick: () => props.onConfirm(values),
        }, props.busy ? t.working : props.label)))))
}

export interface StashDiffModalProps {
  t: Record<string, any>
  stashView: StashViewState
  onClose: () => void
}

export function StashDiffModal(props: StashDiffModalProps) {
  const { t, stashView, onClose } = props
  return h('div', {
    className: 'dshwd-modal-backdrop',
    onMouseDown: (e: MouseEvent) => {
      if (e.target === e.currentTarget) onClose()
    },
  },
  h('div', { className: 'dshwd-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t.stashViewTitle },
    h('div', { className: 'dshwd-modal-head' },
      h('div', { className: 'dshwd-modal-title-group' },
        h('div', { className: 'dshwd-modal-title' }, t.stashViewTitle),
        h('span', { className: 'dshwd-modal-badge dshwd-mono' }, String(stashView.sha || '').slice(0, 8) || 'stash')),
      h('button', { className: 'dshwd-btn dshwd-btn-ghost', title: t.close, onClick: onClose }, '×')),
    h('div', { className: 'dshwd-modal-body' },
      stashView.loading
        ? h('div', { className: 'dshwd-hint' }, t.loading)
        : stashView.error
          ? h('div', { className: 'dshwd-alert' }, stashView.error)
          : h('pre', { className: 'dshwd-diff-pre', style: { maxHeight: '60vh', overflow: 'auto', margin: 0 } }, stashView.patch || t.demoNoDiff)),
    h('div', { className: 'dshwd-modal-foot' },
      h('span', { className: 'dshwd-modal-foot-meta' }),
      h('div', { className: 'dshwd-modal-foot-actions' },
        h('button', { className: 'dshwd-btn', onClick: onClose }, t.close)))))
}
