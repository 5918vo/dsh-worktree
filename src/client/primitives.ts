import { React, h } from './ui'
import { ICONS } from './icons'
import { copyText, cx, uuid } from './format'

let modalScrollLocks = 0
let bodyOverflowBeforeLock = ''

export function Icon(props: any) {
    const shapes = ICONS[props.name] || []
    return h(
      'svg',
      { className: cx('dshw-ico', props.className), viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' },
      shapes.map((shape: any, i: number) => h(shape[0], Object.assign({ key: i }, shape[1]))),
    )
  }

export function Spinner() {
    return h('span', { className: 'dshw-spinner', 'aria-hidden': 'true' })
  }

export function Btn(props: any) {
    const { variant, size, icon, className, children, ...rest } = props
    return h(
      'button',
      Object.assign({ type: 'button', className: cx('dshw-btn', variant ? 'dshw-btn--' + variant : '', size ? 'dshw-btn--' + size : '', className) }, rest),
      icon ? h(Icon, { name: icon }) : null,
      children,
    )
  }

export function IconBtn(props: any) {
    const { size, className, icon, label, children, ...rest } = props
    return h(
      'button',
      Object.assign({ type: 'button', className: cx('dshw-icon-btn', size === 'sm' && 'dshw-icon-btn--sm', className), title: label, 'aria-label': label }, rest),
      children || h(Icon, { name: icon }),
    )
  }

export function Chip(props: any) {
    return h('span', { className: cx('dshw-chip', 'dshw-chip--' + (props.tone || 'neutral'), props.small && 'dshw-chip--sm', props.className) }, props.children)
  }

export function Dot(props: any) {
    return h('span', { className: cx('dshw-dot', 'dshw-dot--' + (props.tone || 'neutral'), props.pulse && 'dshw-dot--pulse'), 'aria-hidden': 'true' })
  }

export function CopyBtn(props: any) {
    const run = () => {
      void copyText(String(props.text || '')).then((ok) => {
        props.notify(ok ? props.t.copied : props.t.copyFailed, ok ? 'ok' : 'error')
      })
    }
    return h('button', { type: 'button', className: 'dshw-copy-btn', title: props.label, 'aria-label': props.label, onClick: run }, h(Icon, { name: 'copy' }))
  }

export function KV(props: any) {
    return h('div', { className: 'dshw-kv-row' },
      h('span', { className: 'dshw-kv-k' }, props.label),
      h('div', { className: 'dshw-kv-v' }, props.children))
  }

export function Card(props: any) {
    return h('section', { className: cx('dshw-card', props.danger && 'dshw-card--danger', props.className) }, props.children)
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

export type ModalProps = {
    t: any
    title: any
    subtitle?: any
    icon?: string
    tone?: 'brand' | 'danger' | 'warn'
    size?: 'sm' | 'lg'
    busy?: boolean
    onClose: () => void
    footer?: any
    children: any
  }

  /* Remember the control that opened a modal (pointerdown outside any dialog), so focus
   * can return there even when focus already moved to <body> by the time the modal closes. */
  let lastModalOpener: any = null
  if (typeof document !== 'undefined' && !(window as any).__dshwOpenerTracker) {
    ;(window as any).__dshwOpenerTracker = true
    document.addEventListener('pointerdown', (e: any) => {
      const el = e && e.target && e.target.closest ? e.target.closest('button,a[href],[role="button"]') : null
      if (el && !el.closest('[role="dialog"]')) lastModalOpener = el
    }, true)
  }

export function Modal(props: ModalProps) {
    const t = props.t
    const dialogRef = React.useRef(null)
    // Capture the opener during render: React's autoFocus would already have moved focus by the time the effect runs.
    const previousRef = React.useRef(typeof document !== 'undefined' ? document.activeElement : null)
    const titleId = React.useRef('dshw-modal-title-' + uuid()).current
    const busyRef = React.useRef(!!props.busy)
    const closeRef = React.useRef(props.onClose)
    busyRef.current = !!props.busy
    closeRef.current = props.onClose

    React.useEffect(() => {
      const previous = previousRef.current
      const node: any = dialogRef.current
      if (modalScrollLocks === 0) {
        bodyOverflowBeforeLock = document.body.style.overflow
        document.body.style.overflow = 'hidden'
      }
      modalScrollLocks += 1
      const focusables = () => {
        if (!node) return [] as any[]
        return (Array.from(node.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')) as any[])
          .filter((el: any) => el.getClientRects().length > 0 && el.getAttribute('aria-hidden') !== 'true')
      }
      const focusTimer = window.requestAnimationFrame(() => {
        const preferred = node && node.querySelector('[data-autofocus]')
        const firstControl = node && node.querySelector('input:not([disabled]),select:not([disabled]),textarea:not([disabled])')
        const activeInside = node && node.contains(document.activeElement)
        if (!activeInside) (preferred || firstControl || focusables()[0] || node)?.focus()
      })
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !busyRef.current) {
          e.preventDefault()
          closeRef.current()
          return
        }
        if (e.key !== 'Tab') return
        const items = focusables()
        if (!items.length) {
          e.preventDefault()
          node?.focus()
          return
        }
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && (document.activeElement === first || !node?.contains(document.activeElement))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
      document.addEventListener('keydown', onKeyDown)
      return () => {
        window.cancelAnimationFrame(focusTimer)
        document.removeEventListener('keydown', onKeyDown)
        modalScrollLocks = Math.max(0, modalScrollLocks - 1)
        if (modalScrollLocks === 0) document.body.style.overflow = bodyOverflowBeforeLock
        const returnTo = previous && previous !== document.body && previous.isConnected
          ? previous
          : lastModalOpener && lastModalOpener.isConnected
            ? lastModalOpener
            : null
        if (returnTo && typeof returnTo.focus === 'function') {
          // Defer past the host's own modal teardown, which may move focus to <body>.
          window.requestAnimationFrame(() => {
            window.setTimeout(() => {
              try {
                returnTo.focus({ preventScroll: true })
              } catch {
                returnTo.focus()
              }
            }, 60)
          })
        }
      }
    }, [])

    return h('div', {
      className: 'dshw-modal-layer',
      onMouseDown: (e: any) => {
        if (e.target === e.currentTarget && !props.busy) props.onClose()
      },
    },
      h('div', {
        ref: dialogRef,
        className: cx('dshw-modal', props.size === 'sm' && 'dshw-modal--sm', props.size === 'lg' && 'dshw-modal--lg'),
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': titleId,
        'aria-busy': props.busy ? 'true' : undefined,
        tabIndex: -1,
      },
        h('div', { className: 'dshw-modal-head' },
          props.icon ? h('div', { className: cx('dshw-modal-icon', props.tone && 'dshw-modal-icon--' + props.tone) }, h(Icon, { name: props.icon })) : null,
          h('div', { className: 'dshw-modal-head-copy' },
            h('h2', { className: 'dshw-modal-title', id: titleId }, props.title),
            props.subtitle ? h('p', { className: 'dshw-modal-sub' }, props.subtitle) : null),
          h('button', { type: 'button', className: 'dshw-modal-close', onClick: props.onClose, disabled: props.busy, 'aria-label': t.close }, h(Icon, { name: 'x' }))),
        h('div', { className: 'dshw-modal-body' }, props.children),
        props.footer ? h('div', { className: 'dshw-modal-foot' }, props.footer) : null))
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

  /** Native <select> for a branch list: the OS renders the popup, so it can never be misplaced. */
export function branchSelect(t: any, value: string, onChange: (v: string) => void, branchInfo: any, extraProps?: any) {
    const list: any[] = (branchInfo && branchInfo.branches) || []
    const known = list.some((b: any) => b.name === value)
    return h('select', Object.assign({ className: 'dshw-input', value: value, onChange: (e: any) => onChange(e.target.value) }, extraProps || {}),
      !value ? h('option', { value: '', disabled: true }, t.baseBranch) : null,
      value && !known ? h('option', { value }, value) : null,
      list.map((b: any) => h('option', { key: b.name, value: b.name }, b.name + (b.current ? '  ●' : ''))))
  }


export function Toast(props: { toast: any }) {
  const toast = props.toast
  return h('div', {
    className: 'dshw-toast' + (toast ? ' dshw-toast--show' : ''),
    role: toast && toast.kind === 'error' ? 'alert' : 'status',
    'aria-live': toast && toast.kind === 'error' ? 'assertive' : 'polite',
  },
    toast ? [h(Icon, { key: 'i', name: toast.kind === 'error' ? 'alert' : 'checkCircle' }), h('span', { key: 's' }, toast.message)] : null)
}
