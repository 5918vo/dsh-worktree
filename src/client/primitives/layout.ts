/**
 * Layout, feedback, and form-field primitives shared across settings and project views.
 */

import { primOf, React, h } from '../ui'
import { cx } from '../format'
import { Icon } from './controls'

export function KV(props: any) {
  return h('div', { className: 'dshw-kv-row' },
    h('span', { className: 'dshw-kv-k' }, props.label),
    h('div', { className: 'dshw-kv-v' }, props.children))
}

export function Card(props: any) {
  const { danger, className, children, ...rest } = props
  return h('section', Object.assign({ className: cx('dshw-card', danger && 'dshw-card--danger', className) }, rest), children)
}

export function CardHead(props: any) {
  return h('div', { className: 'dshw-card-head' },
    props.icon ? h(Icon, { name: props.icon }) : null,
    h('h2', { className: 'dshw-card-title' }, props.title),
    props.right ? h('span', { className: 'dshw-right' }, props.right) : null)
}

export function Banner(props: any) {
  const tone = props.tone || 'info'
  return h('div', { className: 'dshw-banner dshw-banner--' + tone, role: props.role || (tone === 'error' ? 'alert' : undefined) },
    h(Icon, { name: props.icon || (tone === 'error' ? 'alert' : tone === 'warn' ? 'clock' : 'info') }),
    h('div', { className: 'dshw-banner-copy' },
      props.title ? h('strong', null, props.title) : null,
      h('div', null, props.children)),
    props.actions ? h('div', { className: 'dshw-banner-actions' }, props.actions) : null)
}

export function Empty(props: any) {
  return h('div', { className: cx('dshw-empty', props.className) },
    h('div', { className: 'dshw-empty-icon' }, h(Icon, { name: props.icon || 'file' })),
    h('h2', null, props.title),
    props.children ? h('p', null, props.children) : null,
    props.action || null)
}

export function Stat(props: any) {
  return h('div', { className: 'dshw-stat' },
    h('div', { className: 'dshw-stat-ico dshw-stat-ico--' + props.tone }, h(Icon, { name: props.icon })),
    h('div', { className: 'dshw-stat-body' },
      h('div', { className: 'dshw-stat-num' }, props.value),
      h('div', { className: 'dshw-stat-label' }, props.label)))
}

export function MenuItem(props: any) {
  return h('button', {
    type: 'button',
    className: cx('dshw-menu-item', props.danger && 'dshw-menu-item--danger'),
    onClick: (e: any) => {
      const menu = e.currentTarget.closest('details')
      if (menu) menu.removeAttribute('open')
      if (props.onClick) props.onClick(e)
    },
  },
    props.icon ? h(Icon, { name: props.icon }) : null,
    h('span', null, props.children))
}

export function Field(props: any) {
  const errorId = props.id + '-error'
  const hintId = props.id + '-hint'
  const describedBy = [props.hint ? hintId : '', props.error ? errorId : ''].filter(Boolean).join(' ') || undefined
  const control = React.cloneElement(React.Children.only(props.children), {
    id: props.id,
    'aria-required': props.required ? 'true' : undefined,
    'aria-invalid': props.error ? 'true' : undefined,
    'aria-describedby': describedBy,
  })
  return h('div', { className: 'dshw-field' },
    h('label', { className: 'dshw-field-label', htmlFor: props.id },
      props.label,
      props.required ? h('span', { className: 'dshw-req', 'aria-hidden': 'true' }, '*') : null),
    control,
    props.hint ? h('div', { className: 'dshw-hint', id: hintId }, props.hint) : null,
    props.error ? h('div', { className: 'dshw-err', id: errorId, role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, props.error)) : null)
}

/**
 * The shared Toast runs its own hold + fade lifecycle, so the caller only has to
 * mount it with a fresh key and clear the state from `onDone`.
 */
export function Toast(props: { toast: any; onClose?: () => void }) {
  const toast = props.toast
  const ToastShell = primOf('Toast')
  if (!toast) return null
  const error = toast.kind === 'error'
  if (ToastShell) {
    return h(ToastShell, {
      key: String(toast.seq ?? toast.message),
      text: String(toast.message || ''),
      tone: error ? 'error' : 'success',
      holdMs: error ? 6500 : 2800,
      onDone: props.onClose,
    })
  }
  return h('div', {
    className: 'dshw-toast dshw-toast--show',
    role: error ? 'alert' : 'status',
    'aria-live': error ? 'assertive' : 'polite',
    onClick: props.onClose,
    style: { cursor: 'pointer' },
  }, h(Icon, { name: error ? 'alert' : 'checkCircle' }), h('span', null, toast.message))
}
