import { React, h } from './ui'
import { Icon } from './primitives'
import { cx } from './format'
import { filterModelGroups } from './model-filter'

export type ModelChoice = { provider: string; model: string; reasoningEffort?: string }

/**
 * Searchable model picker for the publish-task dialog's advanced options.
 *
 * Data comes from the host's session model catalog (`session.modelCatalog()`),
 * the same source the official conversation model dropdown reads, so the groups
 * are ordered and named identically. Like BranchCombobox the panel expands
 * in-flow; groups render a provider header followed by model rows.
 */
export function ModelCombobox(props: any) {
  const t = props.t
  const groups: any[] = Array.isArray(props.groups) ? props.groups : []
  const value: ModelChoice | null = props.value || null
  const onChange: (v: ModelChoice | null) => void = props.onChange
  const defaultSelection: ModelChoice | null = props.defaultSelection || null
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [active, setActive] = React.useState(0)
  const rootRef = React.useRef(null)
  const searchRef = React.useRef(null)
  const baseId = React.useRef(props.id || 'dshw-model-' + Math.random().toString(36).slice(2)).current
  const listId = baseId + '-list'

  const filtered = filterModelGroups(groups, query)
  const rows: any[] = []
  for (const g of filtered) {
    for (const m of g.models || []) {
      rows.push({ provider: g.id, providerName: g.name, model: m.id, modelName: m.name, reasoning: m.reasoning })
    }
  }

  const nameOf = (sel: any): string | null => {
    if (!sel) return null
    for (const g of groups) for (const m of g.models || []) {
      if (g.id === sel.provider && m.id === sel.model) return String(m.name || m.id)
    }
    return sel.model ? String(sel.model) : null
  }
  const selectedLabel = value ? nameOf(value) : (defaultSelection ? nameOf(defaultSelection) : '')

  React.useEffect(() => {
    if (!open) return
    const timer = window.requestAnimationFrame(() => {
      if (searchRef.current) (searchRef.current as any).focus()
    })
    return () => window.cancelAnimationFrame(timer)
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const onDoc = (e: any) => {
      const root: any = rootRef.current
      if (root && !root.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDoc, true)
    return () => document.removeEventListener('pointerdown', onDoc, true)
  }, [open])

  React.useEffect(() => { setActive(0) }, [query, open])

  const choose = (provider: string, model: string, reasoning: any) => {
    const effort = reasoning && typeof reasoning.defaultEffort === 'string' ? reasoning.defaultEffort : undefined
    onChange({ provider, model, ...(effort ? { reasoningEffort: effort } : {}) })
    setOpen(false)
    setQuery('')
  }
  const chooseDefault = () => {
    onChange(null)
    setOpen(false)
    setQuery('')
  }

  const onKeyDown = (e: any) => {
    if (e.key === 'Escape') {
      if (!open) return
      e.preventDefault()
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
      setActive((i: number) => Math.min(i + 1, Math.max(0, rows.length - 1)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i: number) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      const row = rows[active]
      if (row) choose(row.provider, row.model, row.reasoning)
    }
  }

  // Build the grouped option list while keeping a flat index for keyboard nav.
  const items: any[] = []
  let index = 0
  for (const g of filtered) {
    items.push(h('li', { key: 'group:' + g.id, className: 'dshw-model-group', role: 'presentation' }, g.name))
    for (const m of g.models || []) {
      const i = index++
      const isSelected = !!value && value.provider === g.id && value.model === m.id
      items.push(h('li', {
        key: g.id + ':' + m.id,
        id: baseId + '-opt-' + i,
        role: 'option',
        'aria-selected': isSelected ? 'true' : 'false',
        className: cx('dshw-combo-option',
          i === active && 'dshw-combo-option--active',
          isSelected && 'dshw-combo-option--selected'),
        onMouseEnter: () => setActive(i),
        onMouseDown: (e: any) => e.preventDefault(),
        onClick: () => choose(g.id, m.id, m.reasoning),
      },
        h('span', { className: 'dshw-combo-option-name' }, m.name || m.id),
        isSelected ? h(Icon, { name: 'check', className: 'dshw-combo-check' }) : null))
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
  }, props.extraProps || {}),
    h('span', { className: 'dshw-combo-value' }, selectedLabel || t.modelDefault),
    h(Icon, { name: 'chevronDown', className: 'dshw-combo-chevron' }))

  const panel = open
    ? h('div', { className: 'dshw-combo-panel' },
      h('div', { className: 'dshw-combo-search-wrap' },
        h('input', {
          ref: searchRef,
          type: 'text',
          className: 'dshw-input dshw-combo-search',
          placeholder: t.searchModels,
          value: query,
          autoComplete: 'off',
          spellCheck: false,
          role: 'searchbox',
          'aria-controls': listId,
          'aria-activedescendant': rows.length ? baseId + '-opt-' + active : undefined,
          onChange: (e: any) => setQuery(e.target.value),
          onKeyDown,
        }),
        query
          ? h('button', {
            type: 'button',
            className: 'dshw-combo-clear',
            'aria-label': t.clearSearch,
            onMouseDown: (e: any) => e.preventDefault(),
            onClick: () => {
              setQuery('')
              if (searchRef.current) (searchRef.current as any).focus()
            },
          }, h(Icon, { name: 'x' }))
          : null),
      h('button', {
        type: 'button',
        className: cx('dshw-model-default', !value && 'dshw-model-default--selected'),
        onMouseDown: (e: any) => e.preventDefault(),
        onClick: chooseDefault,
      },
        h('span', null, t.modelDefault),
        !value ? h(Icon, { name: 'check', className: 'dshw-combo-check' }) : null),
      h('ul', { className: 'dshw-combo-list', role: 'listbox', id: listId, 'aria-label': t.model },
        items.length ? items : h('li', { className: 'dshw-combo-empty', role: 'presentation' }, t.modelEmpty)))
    : null

  return h('div', { className: 'dshw-combo', ref: rootRef }, trigger, panel)
}
