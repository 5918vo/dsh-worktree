/**
 * Modal shell adapter over @deepseek-ai/dsh-client-ui-primitives with fallback.
 */

import { primOf, React, h } from '../ui'
import { cx, uuid } from '../format'
import { Icon, IconBtn } from './controls'

export type ModalProps = {
  t: any
  title: any
  subtitle?: any
  badge?: string
  icon?: string
  tone?: 'brand' | 'danger' | 'warn'
  size?: 'sm' | 'lg'
  busy?: boolean
  onClose: () => void
  footer?: any
  children: any
}

/**
 * The shared Modal owns the portal, backdrop, focus trap, Esc and focus return.
 * `headless` keeps the board's own header/footer layout. A busy dialog simply
 * refuses every close request, which also disables Esc and backdrop clicks.
 */
export function Modal(props: ModalProps) {
  const t = props.t
  const ModalShell = primOf('Modal')
  const titleId = React.useRef('dshw-modal-title-' + uuid()).current
  const busyRef = React.useRef(!!props.busy)
  busyRef.current = !!props.busy
  const requestClose = () => {
    if (!busyRef.current) props.onClose()
  }

  const dialogClass = cx('dshw-modal', props.size === 'sm' && 'dshw-modal--sm', props.size === 'lg' && 'dshw-modal--lg')
  const body = [
    h('div', { className: 'dshw-modal-head', key: 'head' },
      props.icon ? h('div', { className: cx('dshw-modal-icon', props.tone && 'dshw-modal-icon--' + props.tone) }, h(Icon, { name: props.icon })) : null,
      h('div', { className: 'dshw-modal-head-copy' },
        h('div', { className: 'dshw-modal-title-group' },
          h('h2', { className: 'dshw-modal-title', id: titleId }, props.title),
          props.badge ? h('span', { className: 'dshw-modal-badge mono' }, props.badge) : null),
        props.subtitle ? h('p', { className: 'dshw-modal-sub' }, props.subtitle) : null),
      h(IconBtn, { className: 'dshw-modal-close', icon: 'x', label: t.close, onClick: requestClose, disabled: !!props.busy })),
    h('div', { className: 'dshw-modal-body', key: 'body' }, props.children),
    props.footer ? h('div', { className: 'dshw-modal-foot', key: 'foot' }, props.footer) : null,
  ]

  if (ModalShell) {
    return h(ModalShell, {
      open: true,
      headless: true,
      onClose: requestClose,
      closeLabel: t.close,
      title: typeof props.title === 'string' ? props.title : undefined,
      className: dialogClass,
    }, body)
  }

  // Fallback for hosts without the primitives module: same layout, minimal Esc.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || busyRef.current) return
      e.preventDefault()
      props.onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
  return h('div', {
    className: 'dshw-modal-layer',
    onMouseDown: (e: any) => {
      if (e.target === e.currentTarget) requestClose()
    },
  }, h('div', { className: dialogClass, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabIndex: -1 }, body))
}
