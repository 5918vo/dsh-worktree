/**
 * Atomic UI control adapters over @deepseek-ai/dsh-client-ui-primitives
 * with plain-markup fallbacks for older hosts.
 */

import { primOf, h } from '../ui'
import { ICONS } from '../icons'
import { copyText, cx } from '../format'

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

/**
 * Single-line text field. The shared Input wraps its native input in a span that
 * carries the className, so board styling stays on the wrapper.
 */
export function TextInput(props: any) {
  const { className, ...rest } = props
  const Input = primOf('Input')
  if (Input) return h(Input, Object.assign({ className: 'dshw-input-field' }, rest))
  return h('input', Object.assign({ className: cx('dshw-input', className) }, rest))
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

/**
 * Checkbox row. The shared control owns the native input and the label pairing;
 * `label` is the rich content the board puts beside the box.
 */
export function Checkbox(props: any) {
  const CheckboxShell = primOf('Checkbox')
  if (CheckboxShell) {
    return h(CheckboxShell, {
      className: props.className,
      checked: !!props.checked,
      disabled: !!props.disabled,
      title: props.title,
      label: props.label,
      onChange: props.onChange,
    })
  }
  return h('label', { className: cx('dshw-check', props.className), title: props.title },
    h('input', {
      type: 'checkbox',
      checked: !!props.checked,
      disabled: !!props.disabled,
      onChange: (e: any) => props.onChange(e.target.checked),
    }),
    props.label)
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
