import { React, h } from './ui'
import { Icon } from './primitives'
import { RECOVERY_UI_READY, categoryKey } from './task-attention'

export type AttentionFilterValue = 'all' | 'pending' | 'review' | 'recovery' | 'broken'

/**
 * Filter button + in-flow panel for the project tree. Keyboard accessible:
 * ArrowUp/Down move, Enter selects, Escape closes only the panel, outside click
 * closes. The panel is rendered absolutely under the button so it is not clipped
 * by the scroll container.
 */
export function AttentionFilter(props: any) {
  const t = props.t
  const value: AttentionFilterValue = props.value || 'all'
  const counts: Record<string, number> = props.counts || {}
  const options: AttentionFilterValue[] = ['all', 'pending', 'review']
  if (RECOVERY_UI_READY) options.push('recovery')
  options.push('broken')

  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState(() => Math.max(0, options.indexOf(value)))
  const rootRef = React.useRef(null)
  const btnRef = React.useRef(null)

  React.useEffect(() => {
    if (!open) return undefined
    const onPointer = (e: any) => {
      const root: any = rootRef.current
      if (root && !root.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer, true)
    return () => document.removeEventListener('pointerdown', onPointer, true)
  }, [open])

  React.useEffect(() => {
    if (open) setActive(Math.max(0, options.indexOf(value)))
  }, [open])

  const choose = (option: AttentionFilterValue) => {
    setOpen(false)
    if (option !== value && props.onChange) props.onChange(option)
    window.requestAnimationFrame(() => { if (btnRef.current) (btnRef.current as any).focus() })
  }

  const onKeyDown = (e: any) => {
    if (e.key === 'Escape') {
      if (!open) return
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      if (btnRef.current) (btnRef.current as any).focus()
      return
    }
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i: number) => Math.min(i + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i: number) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const option = options[active]
      if (option) choose(option)
    }
  }

  const currentLabel = t[categoryKey(value)]
  const total = counts.total || 0

  return h('div', { className: 'dshw-attention-filter', ref: rootRef },
    h('button', {
      ref: btnRef,
      type: 'button',
      className: 'dshw-attention-filter__btn' + (value !== 'all' ? ' dshw-attention-filter__btn--on' : ''),
      'aria-haspopup': 'listbox',
      'aria-expanded': open ? 'true' : 'false',
      'aria-label': total > 0 ? currentLabel + ' · ' + String(total) : currentLabel,
      onClick: () => setOpen((o: boolean) => !o),
      onKeyDown,
    },
      h(Icon, { name: 'sliders' }),
      h('span', { className: 'dshw-attention-filter__label' }, currentLabel),
      total > 0 ? h('span', { className: 'dshw-attention-filter__count' }, String(total)) : null,
      h(Icon, { name: 'chevronDown', className: 'dshw-attention-filter__chev' })),
    open
      ? h('ul', {
        className: 'dshw-attention-panel',
        role: 'listbox',
        'aria-label': t.attentionFilterTitle,
        tabIndex: -1,
        onKeyDown,
      }, options.map((option, i) => {
        const selected = option === value
        const count = option === 'all' ? (counts.all || 0) : (counts[option] || 0)
        return h('li', {
          key: option,
          role: 'option',
          'aria-selected': selected ? 'true' : 'false',
          className: 'dshw-attention-option'
            + (selected ? ' dshw-attention-option--on' : '')
            + (i === active ? ' dshw-attention-option--active' : '')
            + (option === 'recovery' || option === 'broken' ? ' dshw-attention-option--danger' : ''),
          onMouseEnter: () => setActive(i),
          onMouseDown: (e: any) => e.preventDefault(),
          onClick: () => choose(option),
        },
          h(Icon, {
            name: option === 'recovery' || option === 'broken' ? 'alert' : option === 'pending' || option === 'review' ? 'clock' : 'layers',
            className: 'dshw-attention-option__ico',
          }),
          h('span', { className: 'dshw-attention-option__label' }, t[categoryKey(option)]),
          h('span', { className: 'dshw-attention-option__count' }, String(count)),
          selected ? h(Icon, { name: 'check', className: 'dshw-attention-option__check' }) : null)
      }))
      : null)
}
