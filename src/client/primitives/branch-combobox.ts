/**
 * Searchable ARIA combobox for selecting a repository base branch.
 * Rendered in-flow below the trigger so long branch lists are never clipped by
 * modal scroll containers.
 */

import { primOf, React, h } from '../ui'
import { cx, uuid } from '../format'
import { filterBranches } from '../branch-filter'
import { Icon, IconBtn } from './controls'

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
