import { primOf, React, h } from './ui'
import { ICONS } from './icons'
import { copyText, cx, uuid } from './format'
import { filterBranches } from './branch-filter'

/* ------------------------------------------------------------------ *
 * Adapters over @deepseek-ai/dsh-client-ui-primitives.
 *
 * The host ships the shared control set as a static module, so every atom
 * below delegates to it and only keeps the board-specific layout on top.
 * When an older host has no primitives module, `primOf()` returns undefined
 * and the atom falls back to a plain markup equivalent.
 * ------------------------------------------------------------------ */

/** Board icon name -> shared icon component. Unmapped names keep the local sprite. */
const ICON_MAP: Record<string, string> = {
  alert: 'IconWarningOutlineRegular',
  archive: 'IconArchiveOutlineRegular',
  archiveRestore: 'IconUnarchiveOutlineRegular',
  arrowLeft: 'IconChevronLeftOutlineRegular',
  arrowUp: 'IconRightUpOutlineRegular',
  branch: 'IconBranchOutlineRegular',
  check: 'IconCheckOutlineRegular',
  checkCircle: 'IconCheckCircleOutlineRegular',
  chevronDown: 'IconChevronDownOutlineRegular',
  circle: 'IconGoalOutlineRegular',
  clock: 'IconClockOutlineRegular',
  copy: 'IconCopyOutlineRegular',
  database: 'IconDatabaseOutlineRegular',
  file: 'IconCodeOutlineRegular',
  folder: 'IconFolderOpenOutlineRegular',
  grid: 'IconFlatListOutlineRegular',
  info: 'IconInfoOutlineRegular',
  layers: 'IconWorkspaceTreeOutlineRegular',
  merge: 'IconCompareSplitOutlineRegular',
  message: 'IconNewChatOutlineRegular',
  more: 'IconEllipsisOutlineRegular',
  play: 'IconPlayOutlineRegular',
  plus: 'IconPlusOutlineRegular',
  refresh: 'IconRefreshOutlineRegular',
  search: 'IconSearchOutlineRegular',
  settings: 'IconSettingsOutlineRegular',
  sliders: 'IconSlidersTwoOutlineRegular',
  terminal: 'IconCompactOutlineRegular',
  trash: 'IconTrashOutlineRegular',
  x: 'IconCloseOutlineRegular',
  xCircle: 'IconCloseCircleFillRegular',
}

export function Icon(props: any) {
  const shared = primOf(ICON_MAP[props.name] || '')
  const className = cx('dshw-ico', props.className)
  if (shared) return h(shared, { className, size: props.size })
  const shapes = ICONS[props.name] || []
  return h(
    'svg',
    { className: cx(className, 'dshw-ico-sprite'), viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' },
    shapes.map((shape: any, i: number) => h(shape[0], Object.assign({ key: i }, shape[1]))),
  )
}

export function Spinner() {
  const StateDot = primOf('StateDot')
  if (StateDot) return h(StateDot, { state: 'ongoing', size: 14, className: 'dshw-spinner' })
  return h('span', { className: 'dshw-spinner dshw-spinner--ring', 'aria-hidden': 'true' })
}

const BUTTON_VARIANT: Record<string, string> = {
  primary: 'primary',
  danger: 'outline',
  ghost: 'ghost',
  outline: 'outline',
  toolbar: 'toolbar',
}

export function Btn(props: any) {
  const { variant, size, icon, className, children, ...rest } = props
  const Button = primOf('Button')
  const extra = cx(variant === 'danger' && 'dshw-btn-danger', size === 'lg' && 'dshw-btn-lg', className)
  if (Button) {
    return h(Button, Object.assign({
      variant: BUTTON_VARIANT[variant] || 'outline',
      size: size === 'sm' ? 'sm' : 'md',
      className: extra || undefined,
      icon: icon ? h(Icon, { name: icon }) : undefined,
    }, rest), children)
  }
  return h(
    'button',
    Object.assign({ type: 'button', className: cx('dshw-btn', variant ? 'dshw-btn--' + variant : '', size ? 'dshw-btn--' + size : '', className) }, rest),
    icon ? h(Icon, { name: icon }) : null,
    children,
  )
}

export function IconBtn(props: any) {
  const { size, className, icon, label, children, ...rest } = props
  const Button = primOf('Button')
  const extra = cx('dshw-icon-btn', size === 'sm' && 'dshw-icon-btn--sm', className)
  if (Button) {
    return h(Button, Object.assign({
      variant: 'ghost',
      size: size === 'sm' ? 'sm' : 'md',
      className: extra,
      'aria-label': label,
      title: label,
    }, rest), children || h(Icon, { name: icon }))
  }
  return h(
    'button',
    Object.assign({ type: 'button', className: extra, title: label, 'aria-label': label }, rest),
    children || h(Icon, { name: icon }),
  )
}

const TAG_TONE: Record<string, string> = {
  brand: 'info',
  neutral: 'neutral',
  warn: 'warning',
  success: 'success',
  error: 'danger',
  purple: 'info',
}

export function Chip(props: any) {
  const Tag = primOf('Tag')
  const extra = cx(props.small && 'dshw-tag--sm', props.className)
  if (Tag) return h(Tag, { tone: TAG_TONE[props.tone || 'neutral'] || 'neutral', className: extra || undefined }, props.children)
  return h('span', { className: cx('dshw-chip', 'dshw-chip--' + (props.tone || 'neutral'), props.small && 'dshw-chip--sm', props.className) }, props.children)
}

const DOT_STATE: Record<string, string> = {
  brand: 'ongoing',
  neutral: 'idle',
  success: 'done',
  warn: 'warning',
  error: 'error',
}

export function Dot(props: any) {
  const StateDot = primOf('StateDot')
  if (StateDot) {
    const state = props.pulse ? 'ongoing' : DOT_STATE[props.tone || 'neutral'] || 'idle'
    return h(StateDot, { state, className: props.className })
  }
  return h('span', { className: cx('dshw-dot', 'dshw-dot--' + (props.tone || 'neutral'), props.pulse && 'dshw-dot--pulse'), 'aria-hidden': 'true' })
}

export function CopyBtn(props: any) {
  const run = () => {
    void copyText(String(props.text || '')).then((ok) => {
      props.notify(ok ? props.t.copied : props.t.copyFailed, ok ? 'ok' : 'error')
    })
  }
  return h(IconBtn, { className: 'dshw-copy-btn', icon: 'copy', label: props.label, onClick: run })
}

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
        h('h2', { className: 'dshw-modal-title', id: titleId }, props.title),
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
 * Searchable base-branch picker used by the publish-task dialog and every other
 * base-branch field. A native <select> cannot filter its options reliably across
 * browsers, so this is a small ARIA combobox: the trigger shows the current
 * selection and opens a panel with a filter input plus a keyboard-navigable list.
 * The panel is rendered in-flow (below the field) instead of floating, so a long
 * branch list can never be clipped by the modal body's scroll container.
 */
export function BranchCombobox(props: any) {
  const { t, value, onChange, branchInfo, ...rest } = props
  const Input = primOf('Input')
  const list: any[] = (branchInfo && branchInfo.branches) || []
  const selected: string = value || ''
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [active, setActive] = React.useState(0)
  const rootRef = React.useRef(null)
  const searchRef = React.useRef(null)
  const baseId = React.useRef(rest.id || 'dshw-combo-' + uuid()).current
  const listId = baseId + '-list'
  const searchId = baseId + '-search'

  // Include a synthetic option when the chosen branch is not in the loaded list
  // (e.g. a continue-task base that has since been removed), mirroring the old select.
  const known = list.some((b: any) => b && b.name === selected)
  const options: any[] = selected && !known ? [{ name: selected, current: false } as any].concat(list) : list
  const filtered = filterBranches(options, query)

  React.useEffect(() => {
    if (!open) return
    const timer = window.requestAnimationFrame(() => {
      if (searchRef.current) (searchRef.current as any).focus()
    })
    return () => window.cancelAnimationFrame(timer)
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const onDocPointer = (e: any) => {
      const root: any = rootRef.current
      if (root && !root.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointer, true)
    return () => document.removeEventListener('pointerdown', onDocPointer, true)
  }, [open])

  React.useEffect(() => {
    setActive(0)
  }, [query, open])

  const commit = (name: string) => {
    if (!name) return
    onChange(name)
    setOpen(false)
    setQuery('')
  }

  const move = (delta: number) => {
    setActive((i: number) => {
      if (!filtered.length) return 0
      return Math.min(Math.max(i + delta, 0), filtered.length - 1)
    })
  }

  const onKeyDown = (e: any) => {
    if (e.key === 'Escape') {
      if (!open) return
      e.preventDefault()
      // Close only the panel; keep the modal itself open.
      e.stopPropagation()
      setOpen(false)
      return
    }
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      const opt = filtered[active]
      if (opt && opt.name) commit(opt.name)
      return
    }
  }

  const trigger = h('button', Object.assign({
    type: 'button',
    className: cx('dshw-input dshw-combo-trigger', open && 'dshw-combo-trigger--open'),
    role: 'combobox',
    'aria-haspopup': 'listbox',
    'aria-expanded': open ? 'true' : 'false',
    'aria-controls': open ? listId : undefined,
    onClick: () => setOpen((o: boolean) => !o),
    onKeyDown,
  }, rest),
    h('span', { className: 'dshw-combo-value' }, selected || t.baseBranch),
    h(Icon, { name: 'chevronDown', className: 'dshw-combo-chevron' }))

  const searchProps = {
    ref: searchRef,
    id: searchId,
    type: 'text',
    className: 'dshw-input dshw-combo-search',
    placeholder: t.filterBranches,
    value: query,
    autoComplete: 'off',
    spellCheck: false,
    role: 'searchbox',
    'aria-controls': listId,
    'aria-activedescendant': filtered.length ? baseId + '-opt-' + active : undefined,
    onChange: (e: any) => setQuery(e.target.value),
    onKeyDown,
  }

  const panel = open
    ? h('div', { className: 'dshw-combo-panel' },
      h('div', { className: 'dshw-combo-search-wrap' },
        Input ? h(Input, Object.assign({ className: 'dshw-input-wrap' }, searchProps)) : h('input', searchProps),
        query
          ? h(IconBtn, {
            className: 'dshw-combo-clear',
            icon: 'x',
            size: 'sm',
            label: t.clearSearch,
            onMouseDown: (e: any) => e.preventDefault(),
            onClick: () => {
              setQuery('')
              if (searchRef.current) (searchRef.current as any).focus()
            },
          })
          : null),
      h('ul', { className: 'dshw-combo-list', role: 'listbox', id: listId, 'aria-label': t.baseBranch },
        filtered.length
          ? filtered.map((b: any, i: number) => h('li', {
            key: b.name + ':' + i,
            id: baseId + '-opt-' + i,
            role: 'option',
            'aria-selected': b.name === selected ? 'true' : 'false',
            className: cx('dshw-combo-option',
              i === active && 'dshw-combo-option--active',
              b.name === selected && 'dshw-combo-option--selected'),
            onMouseEnter: () => setActive(i),
            onMouseDown: (e: any) => e.preventDefault(),
            onClick: () => commit(b.name),
          },
            h('span', { className: 'dshw-combo-option-name' }, b.name),
            b.current ? h('span', { className: 'dshw-combo-tag' }, t.currentBranch) : null,
            b.name === selected ? h(Icon, { name: 'check', className: 'dshw-combo-check' }) : null))
          : h('li', { className: 'dshw-combo-empty', role: 'presentation' }, t.noBranchMatch)))
    : null

  return h('div', { className: 'dshw-combo', ref: rootRef }, trigger, panel)
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
