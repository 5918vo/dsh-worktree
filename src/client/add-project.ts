import { React, h } from './ui'
import { appCtx, post } from './context'
import { useBranchInfo } from './hooks'
import { baseName } from './format'

export interface AddProjectModalProps {
  t: any
  onClose: () => void
  onAdded: (project: any) => void
}

/**
 * New-project dialog for the demo board. The board previously had no entry for
 * `projects/add`, which left a fresh install with no way past "add a project
 * first"; this dialog restores that path with the same field rules as the
 * backend (repo path, default base branch).
 */
export function AddProjectModal(props: AddProjectModalProps) {
  const { t } = props
  const remotes = appCtx && appCtx.remote
  const [repoPath, setRepoPath] = React.useState('')
  const [name, setName] = React.useState('')
  const [baseBranch, setBaseBranch] = React.useState('')
  const [picking, setPicking] = React.useState(false)
  const pickingRef = React.useRef(false)
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')
  const [fieldErrors, setFieldErrors] = React.useState({} as Record<string, string>)
  const submitRef = React.useRef(false)
  const rootRef = React.useRef(null)
  const restoreFocus = React.useRef(null as any)
  // Capture the opener during render, before autoFocus moves focus into the
  // dialog; an effect would already see the focused input.
  if (restoreFocus.current === null && typeof document !== 'undefined') restoreFocus.current = document.activeElement
  const branches = useBranchInfo(repoPath, 150)

  React.useEffect(() => {
    return () => {
      const el: any = restoreFocus.current
      if (el && typeof el.focus === 'function' && el.isConnected) el.focus()
    }
  }, [])

  React.useEffect(() => {
    const onKey = (e: any) => {
      if (e.key === 'Escape' && !busy) {
        e.stopPropagation()
        props.onClose()
        return
      }
      if (e.key !== 'Tab') return
      const root: any = rootRef.current
      if (!root) return
      const nodes = Array.from(root.querySelectorAll('input, select, textarea, button, [tabindex]:not([tabindex="-1"])'))
        .filter((el: any) => !el.disabled && el.getAttribute('aria-hidden') !== 'true')
      if (!nodes.length) return
      const first: any = nodes[0]
      const last: any = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [busy, props.onClose])

  React.useEffect(() => {
    setBaseBranch('')
    setFieldErrors((prev: any) => (prev.baseBranch ? Object.assign({}, prev, { baseBranch: '' }) : prev))
  }, [repoPath])

  React.useEffect(() => {
    const d = branches.data
    if (!d) return
    setBaseBranch(d.current || d.default || (d.branches && d.branches[0] && d.branches[0].name) || '')
  }, [branches.data])

  const pick = async () => {
    if (pickingRef.current) return
    setErr('')
    if (!remotes || !remotes.directoryPicker) {
      setErr(t.failed)
      return
    }
    pickingRef.current = true
    setPicking(true)
    try {
      const r: any = await remotes.directoryPicker.pick()
      if (r && r.ok && r.value) {
        setRepoPath(String(r.value))
      } else if (r && r.ok === false) {
        const detail = r.error && (r.error.message || r.error.code)
        if (detail) setErr(String(detail))
      }
    } catch (e: any) {
      setErr((e && e.message) || t.failed)
    } finally {
      pickingRef.current = false
      setPicking(false)
    }
  }

  const fromPointer = (e: any) => {
    if (e.button !== 0) return
    e.preventDefault()
    void pick()
  }

  const branchNames: string[] = ((branches.data && branches.data.branches) || [])
    .map((b: any) => (typeof b === 'string' ? b : b && b.name))
    .filter(Boolean)

  const submit = async () => {
    if (submitRef.current || busy || branches.status === 'loading') return
    setErr('')
    const next: Record<string, string> = {}
    if (!repoPath.trim()) next.repoPath = t.requiredField
    if (!baseBranch.trim()) next.baseBranch = t.requiredField
    setFieldErrors(next)
    if (next.repoPath) {
      const el = rootRef.current ? (rootRef.current as any).querySelector('#dshwd-add-repo') : null
      if (el) el.focus()
      return
    }
    if (next.baseBranch) {
      const el = rootRef.current ? (rootRef.current as any).querySelector('#dshwd-add-base') : null
      if (el) el.focus()
      return
    }
    submitRef.current = true
    setBusy(true)
    try {
      const r: any = await post('projects/add', {
        repoPath: repoPath.trim(),
        name: name.trim() || undefined,
        baseBranch: baseBranch.trim(),
      })
      props.onAdded(r && r.project)
    } catch (e: any) {
      setErr((e && e.message) || t.failed)
    } finally {
      submitRef.current = false
      setBusy(false)
    }
  }

  let branchControl: any
  if (!repoPath.trim()) {
    branchControl = h('div', { className: 'dshwd-hint' }, t.chooseDirFirst)
  } else if (branches.status === 'loading') {
    branchControl = h('input', { className: 'dshwd-input', value: '', placeholder: t.loadingBranches, disabled: true })
  } else if (branches.status === 'error') {
    branchControl = h('div', { style: { display: 'flex', gap: '6px' } },
      h('input', {
        id: 'dshwd-add-base',
        className: 'dshwd-input dshwd-mono',
        value: baseBranch,
        placeholder: t.baseBranch,
        'aria-required': 'true',
        'aria-invalid': fieldErrors.baseBranch ? 'true' : 'false',
        onChange: (e: any) => setBaseBranch(e.target.value),
      }),
      h('button', { className: 'dshwd-btn', title: t.retry, onClick: branches.retry }, '↻'))
  } else {
    branchControl = h('select', {
      id: 'dshwd-add-base',
      className: 'dshwd-select',
      value: baseBranch,
      'aria-required': 'true',
      'aria-invalid': fieldErrors.baseBranch ? 'true' : 'false',
      onChange: (e: any) => setBaseBranch(e.target.value),
    },
      branchNames.length
        ? branchNames.map((n) => h('option', { key: n, value: n }, n))
        : h('option', { value: '' }, t.baseBranch))
  }

  return h('div', {
    ref: rootRef,
    className: 'dshwd-modal-backdrop',
    onMouseDown: (e: any) => { if (e.target === e.currentTarget && !busy) props.onClose() },
  },
    h('div', { className: 'dshwd-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t.addProject },
      h('div', { className: 'dshwd-modal-head' },
        h('div', { className: 'dshwd-modal-title-group' },
          h('div', { className: 'dshwd-modal-title' }, t.addProject),
          h('span', { className: 'dshwd-modal-badge dshwd-mono' }, 'git repo')),
        h('button', { className: 'dshwd-btn dshwd-btn-ghost', title: t.close, disabled: busy, onClick: props.onClose }, '×')),

      h('div', { className: 'dshwd-modal-body' },
        h('div', { className: 'dshwd-hint' }, t.addProjectSub),

        h('label', { className: 'dshwd-field' },
          h('span', { className: 'dshwd-label' }, t.repoPath),
          h('div', { style: { display: 'flex', gap: '6px' } },
            h('input', {
              id: 'dshwd-add-repo',
              className: 'dshwd-input dshwd-mono',
              value: repoPath,
              placeholder: t.repoPathHint,
              autoFocus: true,
              autoComplete: 'off',
              'aria-required': 'true',
              'aria-invalid': fieldErrors.repoPath ? 'true' : 'false',
              onChange: (e: any) => {
                setRepoPath(e.target.value)
                if (fieldErrors.repoPath) setFieldErrors((prev: any) => Object.assign({}, prev, { repoPath: '' }))
              },
              onKeyDown: (e: any) => { if (e.key === 'Enter') { e.preventDefault(); void submit() } },
            }),
            h('button', {
              className: 'dshwd-btn',
              disabled: picking,
              onPointerDown: fromPointer,
              onClick: (e: any) => { if (e.detail === 0) void pick() },
            }, picking ? t.pickingDirectory : t.browse))),
        fieldErrors.repoPath ? h('div', { className: 'dshwd-alert', role: 'alert' }, fieldErrors.repoPath) : null,

        h('label', { className: 'dshwd-field' },
          h('span', { className: 'dshwd-label' }, t.projectName,
            h('span', { className: 'dshwd-label-hint' }, t.projectNameHint)),
          h('input', {
            className: 'dshwd-input',
            value: name,
            placeholder: baseName(repoPath) || t.projectName,
            autoComplete: 'off',
            onChange: (e: any) => setName(e.target.value),
          })),

        h('label', { className: 'dshwd-field' },
          h('span', { className: 'dshwd-label' }, t.defaultBase),
          branchControl),
        branches.status === 'error'
          ? h('div', { className: 'dshwd-hint' }, t.loadBranchesFailed)
          : null,
        fieldErrors.baseBranch ? h('div', { className: 'dshwd-alert', role: 'alert' }, fieldErrors.baseBranch) : null,
        err ? h('div', { className: 'dshwd-alert', role: 'alert' }, err) : null),

      h('div', { className: 'dshwd-modal-foot' },
        h('span', { className: 'dshwd-modal-foot-meta dshwd-mono' }, baseName(repoPath) || '—'),
        h('div', { className: 'dshwd-modal-foot-actions' },
          h('button', { className: 'dshwd-btn', disabled: busy, onClick: props.onClose }, t.cancel),
          h('button', {
            className: 'dshwd-btn dshwd-btn-cta',
            disabled: busy || !repoPath.trim() || !baseBranch.trim() || branches.status === 'loading',
            onClick: () => void submit(),
          }, busy ? t.loading : t.addProject)))))
}
