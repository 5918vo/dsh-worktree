import { React, h } from './ui'
import { Icon } from './primitives'
import { RECOVERY_UI_READY, categoryKey } from './task-attention'
import type { BoardFilter } from './model'

/**
 * Filter button + in-flow panel for the worktree rail. Keyboard accessible:
 * ArrowUp/Down move, Enter selects, Escape closes only the panel, an outside
 * pointerdown closes it. The panel is absolutely positioned under the button so
 * the scroll container never clips it.
 */
export function AttentionFilter(props: any) {
  const t = props.t
  const value: BoardFilter = props.value || 'all'
  const counts: Record<string, number> = props.counts || {}
  const options: BoardFilter[] = ['all', 'pending', 'review']
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

  const choose = (option: BoardFilter) => {
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

  return h('div', { className: 'dshwd-filter', ref: rootRef },
    h('button', {
      ref: btnRef,
      type: 'button',
      className: 'dshwd-filter-btn' + (value !== 'all' ? ' dshwd-filter-btn-on' : ''),
      'aria-haspopup': 'listbox',
      'aria-expanded': open ? 'true' : 'false',
      'aria-label': total > 0 ? currentLabel + ' · ' + String(total) : currentLabel,
      title: t.attentionFilterTitle,
      onClick: () => setOpen((o: boolean) => !o),
      onKeyDown,
    },
      h(Icon, { name: 'sliders' }),
      h('span', { className: 'dshwd-filter-label' }, currentLabel),
      total > 0 ? h('span', { className: 'dshwd-filter-count' }, String(total)) : null,
      h(Icon, { name: 'chevronDown', className: 'dshwd-filter-chev' })),
    open
      ? h('ul', {
        className: 'dshwd-filter-panel',
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
          className: 'dshwd-filter-option'
            + (selected ? ' dshwd-filter-option-on' : '')
            + (i === active ? ' dshwd-filter-option-active' : '')
            + (option === 'recovery' || option === 'broken' ? ' dshwd-filter-option-danger' : ''),
          onMouseEnter: () => setActive(i),
          onMouseDown: (e: any) => e.preventDefault(),
          onClick: () => choose(option),
        },
          h(Icon, {
            name: option === 'recovery' || option === 'broken' ? 'alert' : option === 'pending' || option === 'review' ? 'clock' : 'layers',
            className: 'dshwd-filter-ico',
          }),
          h('span', { className: 'dshwd-filter-option-label' }, t[categoryKey(option)]),
          h('span', { className: 'dshwd-filter-option-count' }, String(count)),
          selected ? h(Icon, { name: 'check', className: 'dshwd-filter-check' }) : null)
      }))
      : null)
}
