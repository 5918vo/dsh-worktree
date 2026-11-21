import { React, h } from './ui'
import { appCtx, getJson, postLong, bindSession } from './context'
import { useBranchInfo } from './hooks'
import { normalizeCriteria, parseCriteriaText } from '../criteria'
import type { ProjectView, TaskView } from '../models'

export interface PublishModalProps {
  t: any
  views: ProjectView[]
  initialProjectId: string
  parentId: string
  parentView: TaskView | null
  onClose: () => void
  onPublished: (task: any, project: any, warning?: string, continued?: boolean) => void
  onCheckPublished: () => Promise<TaskView | undefined>
}

type ModelRow = { provider: string; providerName: string; model: string; modelName: string; reasoningEffort?: string }

export function PublishModal(props: PublishModalProps) {
  const { t } = props
  const remotes = appCtx && appCtx.remote
  const initial = props.views.find((v) => v.project.id === props.initialProjectId) || props.views[0]
  const parentTask = props.parentView && props.parentView.task ? props.parentView.task : null
  const parentAhead = Number(props.parentView && props.parentView.snapshot && props.parentView.snapshot.postMergeAhead) || 0

  const [projectId, setProjectId] = React.useState(initial ? initial.project.id : '')
  const view = props.views.find((v) => v.project.id === projectId) || initial
  const project = view ? view.project : null
  // Continuing always starts from the predecessor's real merge target.
  const [base, setBase] = React.useState(parentTask ? parentTask.baseBranch : project ? project.baseBranch : '')
  const [title, setTitle] = React.useState(parentTask ? String(parentTask.title) + String(t.continueTitleSuffix) : '')
  const [description, setDescription] = React.useState('')
  const [advanced, setAdvanced] = React.useState(false)
  const [branch, setBranch] = React.useState('')
  const [start, setStart] = React.useState(true)
  const [asPlain, setAsPlain] = React.useState(false)
  const [carryLeftover, setCarryLeftover] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')
  const [fieldErrors, setFieldErrors] = React.useState({} as Record<string, string>)
  const [unknown, setUnknown] = React.useState(false)
  const [library, setLibrary] = React.useState([] as string[])
  const [picked, setPicked] = React.useState([] as string[])
  const [manual, setManual] = React.useState('')
  const [models, setModels] = React.useState([] as ModelRow[])
  const [modelKey, setModelKey] = React.useState('')
  const [modelError, setModelError] = React.useState('')

  const titleRef = React.useRef(null)
  const rootRef = React.useRef(null)
  const restoreFocus = React.useRef(null as any)
  // Capture the opener during render, before autoFocus moves focus into the
  // dialog; an effect would already see the focused input.
  if (restoreFocus.current === null && typeof document !== 'undefined') restoreFocus.current = document.activeElement
  const submitRef = React.useRef(false)
  const branchInfo = useBranchInfo(project ? project.repoPath : '')
  const branches = branchInfo.data && Array.isArray(branchInfo.data.branches) ? branchInfo.data.branches : []
  const branchNames = branches.map((b: any) => (typeof b === 'string' ? b : b && b.name)).filter(Boolean)

  React.useEffect(() => {
    return () => {
      const el: any = restoreFocus.current
      if (el && typeof el.focus === 'function' && el.isConnected) el.focus()
    }
  }, [])

  React.useEffect(() => {
    getJson('acceptance-criteria')
      .then((d: any) => setLibrary(Array.isArray(d.items) ? d.items.map(String) : []))
      .catch(() => {})
  }, [])

  // Model list comes from the host's session catalog — the same source the
  // official conversation model dropdown reads.
  React.useEffect(() => {
    if (!remotes || !remotes.session || typeof remotes.session.modelCatalog !== 'function') {
      setModelError(t.modelUnavailable)
      return
    }
    let cancelled = false
    remotes.session.modelCatalog()
      .then((r: any) => {
        if (cancelled) return
        if (!r || !r.ok || !r.value) {
          setModelError((r && r.error && (r.error.message || r.error.code)) || t.loadFailed)
          return
        }
        const rows: ModelRow[] = []
        // The host returns { default, routableProviders, groups }; older builds
        // returned the group list directly.
        const catalog: any = r.value
        const groups: any[] = Array.isArray(catalog) ? catalog : (catalog && Array.isArray(catalog.groups) ? catalog.groups : [])
        for (const g of groups) {
          for (const m of Array.isArray(g.models) ? g.models : []) {
            rows.push({
              provider: String(g.id),
              providerName: String(g.name || g.id),
              model: String(m.id),
              modelName: String(m.name || m.id),
              reasoningEffort: m.reasoning && typeof m.reasoning.defaultEffort === 'string' ? m.reasoning.defaultEffort : undefined,
            })
          }
        }
        setModels(rows)
        if (!rows.length) setModelError(t.modelUnavailable)
      })
      .catch((e: any) => { if (!cancelled) setModelError((e && e.message) || t.loadFailed) })
    return () => { cancelled = true }
  }, [])

  React.useEffect(() => {
    if (!project) return
    setBase(project.baseBranch)
    setBranch('')
  }, [projectId])

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
        .filter((el: any) => !el.disabled)
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

  const toggleCriterion = (item: string) => {
    setPicked((list: string[]) => (list.includes(item) ? list.filter((x: string) => x !== item) : list.concat(item)))
  }

  const chosenModel = (() => {
    if (!modelKey) return undefined
    const i = Number(modelKey)
    const row = models[i]
    if (!row) return undefined
    return { provider: row.provider, model: row.model, ...(row.reasoningEffort ? { reasoningEffort: row.reasoningEffort } : {}) }
  })()

  const submit = async () => {
    if (submitRef.current || busy || !project) return
    setErr('')
    setUnknown(false)
    const next: Record<string, string> = {}
    if (!title.trim()) next.title = t.requiredField
    if (!description.trim()) next.description = t.requiredField
    if (advanced && branch.trim() && !validBranch(branch.trim())) next.branch = t.branchInvalid
    setFieldErrors(next)
    if (next.title && titleRef.current) (titleRef.current as any).focus()
    if (Object.keys(next).length) return

    submitRef.current = true
    setBusy(true)
    let task: any = null
    let warning = ''
    try {
      const payload: any = {
        projectId: project.id,
        baseBranch: base || project.baseBranch,
        title: title.trim(),
        description,
        // Only send an explicit branch when the user typed one; otherwise the
        // backend applies the project's configured prefix (dsh-wt/<id8>).
        ...(advanced && branch.trim() ? { branchName: branch.trim() } : {}),
        acceptanceCriteria: normalizeCriteria([...picked, ...parseCriteriaText(manual)]),
        ...(chosenModel ? { model: chosenModel } : {}),
        ...(parentTask && !asPlain ? { parentId: parentTask.id, carryLeftover } : {}),
        start,
      }
      const result: any = await postLong('publish', payload)
      task = result && result.task ? result.task : result
      warning = String((result && result.warning) || '')
    } catch (e: any) {
      const message = String((e && e.message) || e || '')
      if (/timeout|timed out|aborted|unknown|network|fetch/i.test(message)) {
        setUnknown(true)
        setBusy(false)
        submitRef.current = false
        setErr(t.publishTimeout)
        return
      }
      setErr(message || t.failed)
      setBusy(false)
      submitRef.current = false
      return
    }
    let continued = false
    if (task && start) {
      try {
        await bindSession(appCtx && appCtx.remote, task, project.name, true)
        continued = !!parentTask && !asPlain
      } catch (e: any) {
        warning = String((e && e.message) || e || '') || t.openSessionFailed
      }
    }
    submitRef.current = false
    setBusy(false)
    props.onPublished(task, project, warning, continued)
  }

  async function check() {
    if (busy) return
    setBusy(true)
    const found = await props.onCheckPublished()
    setBusy(false)
    if (!found) {
      setErr(t.publishTimeoutHint)
      return
    }
    props.onPublished(found.task, project, '', false)
  }

  if (!project) {
    return modal(t, props, project, null, busy, h('div', { className: 'dshwd-empty' },
      h('div', { className: 'dshwd-empty-title' }, t.noProjectsHint),
      h('div', { className: 'dshwd-hint' }, t.demoAddProjectFirst)),
    h('button', { className: 'dshwd-btn', onClick: props.onClose }, t.close))
  }

  const branchPlaceholder = `${project.branchPrefix || 'dsh-wt/'}<id8>`

  return modal(t, props, project, submit, busy,
    h('div', { className: 'dshwd-field-row-2' },
      field(t, t.demoProject, h('select', {
        className: 'dshwd-select',
        value: projectId,
        disabled: !!parentTask || busy,
        onChange: (e: any) => setProjectId(e.target.value),
      }, props.views.map((v: any) => h('option', { key: v.project.id, value: v.project.id }, v.project.name)))),
      field(t, t.baseBranch, h('div', { style: { display: 'flex', gap: '6px' } },
        branchNames.length
          ? h('select', {
            className: 'dshwd-select',
            value: base,
            disabled: busy,
            onChange: (e: any) => setBase(e.target.value),
          }, branchNames.map((name: string) => h('option', { key: name, value: name }, name)))
          : h('input', {
            className: 'dshwd-input dshwd-mono',
            value: base,
            disabled: busy,
            onChange: (e: any) => setBase(e.target.value),
            placeholder: project.baseBranch,
          }),
        branchInfo.status === 'error'
          ? h('button', { className: 'dshwd-btn', title: t.retry, disabled: busy, onClick: branchInfo.retry }, '↻')
          : null))),

    parentTask && !asPlain
      ? h('div', { className: 'dshwd-alert dshwd-alert-info' },
        h('span', null, String(t.demoContinueHint).replace('{branch}', parentTask.baseBranch || '—')))
      : null,

    field(t, t.taskTitle, h('input', {
      ref: titleRef,
      className: 'dshwd-input' + (fieldErrors.title ? ' dshwd-invalid' : ''),
      value: title,
      autoFocus: true,
      disabled: busy,
      placeholder: t.demoTitlePlaceholder,
      'aria-invalid': fieldErrors.title ? 'true' : 'false',
      onChange: (e: any) => { setTitle(e.target.value); clearField('title') },
    })),
    fieldErrors.title ? h('div', { className: 'dshwd-alert', role: 'alert' }, fieldErrors.title) : null,

    field(t, t.taskDescription, h('textarea', {
      className: 'dshwd-textarea' + (fieldErrors.description ? ' dshwd-invalid' : ''),
      value: description,
      disabled: busy,
      placeholder: t.demoDescriptionPlaceholder,
      'aria-invalid': fieldErrors.description ? 'true' : 'false',
      onChange: (e: any) => { setDescription(e.target.value); clearField('description') },
    })),
    fieldErrors.description ? h('div', { className: 'dshwd-alert', role: 'alert' }, fieldErrors.description) : null,

    field(t, t.acceptanceCriteria,
      h('div', { className: 'dshwd-criteria-box' },
        library.length
          ? h('div', { className: 'dshwd-criteria-library' }, library.map((item: string) => h('label', { key: item, className: 'dshwd-check-row' },
            h('input', {
              type: 'checkbox',
              checked: picked.includes(item),
              disabled: busy,
              onChange: () => toggleCriterion(item),
            }),
            h('span', { className: 'dshwd-check-label' }, item))))
          : null,
        picked.length
          ? h('div', { className: 'dshwd-criteria-items' }, picked.map((item: string, i: number) => h('div', { key: i, className: 'dshwd-criteria-chip' },
            h('span', null, item),
            h('button', {
              className: 'dshwd-criteria-remove',
              title: t.delete,
              disabled: busy,
              onClick: () => setPicked((list: string[]) => list.filter((x: string) => x !== item)),
            }, '×'))))
          : null,
        h('textarea', {
          className: 'dshwd-textarea',
          value: manual,
          disabled: busy,
          rows: 2,
          placeholder: t.demoCriterionPlaceholder,
          onChange: (e: any) => setManual(e.target.value),
        }))),

    h('button', { className: 'dshwd-adv-toggle', disabled: busy, onClick: () => setAdvanced((v: boolean) => !v) },
      advanced ? '▾ ' : '▸ ', t.demoAdvanced),
    advanced
      ? h('div', { className: 'dshwd-adv-panel dshwd-open' },
        field(t, t.demoCustomBranch, h('input', {
          className: 'dshwd-input dshwd-mono' + (fieldErrors.branch ? ' dshwd-invalid' : ''),
          value: branch,
          disabled: busy,
          placeholder: branchPlaceholder,
          'aria-invalid': fieldErrors.branch ? 'true' : 'false',
          onChange: (e: any) => { setBranch(e.target.value); clearField('branch') },
        })),
        fieldErrors.branch ? h('div', { className: 'dshwd-alert', role: 'alert' }, fieldErrors.branch) : null,
        field(t, t.model, models.length
          ? h('select', {
            className: 'dshwd-select',
            value: modelKey,
            disabled: busy,
            onChange: (e: any) => setModelKey(e.target.value),
          },
            h('option', { value: '' }, t.modelDefault),
            models.map((m: ModelRow, i: number) => h('option', { key: m.provider + ':' + m.model, value: String(i) }, `${m.providerName} · ${m.modelName}`)))
          : h('div', { className: 'dshwd-hint' }, modelError || t.loading)))
      : null,

    parentTask
      ? h('label', { className: 'dshwd-check-row' },
        h('input', { type: 'checkbox', checked: asPlain, disabled: busy, onChange: (e: any) => setAsPlain(e.target.checked) }),
        h('span', { className: 'dshwd-check-label' }, t.demoPublishAsPlain))
      : null,
    parentTask && !asPlain && parentAhead > 0
      ? h('label', { className: 'dshwd-check-row' },
        h('input', { type: 'checkbox', checked: carryLeftover, disabled: busy, onChange: (e: any) => setCarryLeftover(e.target.checked) }),
        h('span', { className: 'dshwd-check-label' }, String(t.demoCarryLeftover).replace('{n}', String(parentAhead))))
      : null,

    h('div', { className: 'dshwd-adv-panel dshwd-open' },
      h('div', { className: 'dshwd-switch-row' },
        h('div', null,
          h('div', { className: 'dshwd-switch-title' }, t.demoStartAfterPublish),
          h('div', { className: 'dshwd-switch-desc' }, t.demoStartAfterPublishHint)),
        h('label', { className: 'dshwd-switch' },
          h('input', { type: 'checkbox', checked: start, disabled: busy, onChange: (e: any) => setStart(e.target.checked) }),
          h('span', { className: 'dshwd-slider' })))),

    err ? h('div', { className: 'dshwd-alert', role: 'alert' }, err) : null,
    unknown ? h('div', { className: 'dshwd-alert dshwd-alert-info' },
      h('span', null, t.publishTimeoutHint),
      h('button', { className: 'dshwd-btn', disabled: busy, onClick: () => void check() }, t.refreshed)) : null,

    busy ? h('div', { className: 'dshwd-hint' }, t.publishing) : null)

  function clearField(name: string) {
    setFieldErrors((prev: any) => (prev[name] ? Object.assign({}, prev, { [name]: '' }) : prev))
  }
}

function modal(t: any, props: PublishModalProps, project: any, onSubmit: (() => void) | null, busy: boolean, ...children: any[]) {
  const close = () => { if (!busy) props.onClose() }
  return h('div', {
    className: 'dshwd-modal-backdrop',
    onMouseDown: (e: any) => { if (e.target === e.currentTarget) close() },
  },
    h('div', { className: 'dshwd-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t.publishTitle },
      h('div', { className: 'dshwd-modal-head' },
        h('div', { className: 'dshwd-modal-title-group' },
          h('div', { className: 'dshwd-modal-title' }, t.publishTitle),
          h('span', { className: 'dshwd-modal-badge dshwd-mono' }, 'git worktree add')),
        h('button', { className: 'dshwd-btn dshwd-btn-ghost', title: t.close, disabled: busy, onClick: close }, '×')),
      h('div', { className: 'dshwd-modal-body' }, children),
      h('div', { className: 'dshwd-modal-foot' },
        h('span', { className: 'dshwd-modal-foot-meta dshwd-mono' }, pathPreview(project)),
        h('div', { className: 'dshwd-modal-foot-actions' },
          h('button', { className: 'dshwd-btn', disabled: busy, onClick: close }, t.cancel),
          onSubmit
            ? h('button', { className: 'dshwd-btn dshwd-btn-cta', disabled: busy, onClick: onSubmit }, busy ? t.publishing : t.demoCreatePublish)
            : h('button', { className: 'dshwd-btn', disabled: busy, onClick: close }, t.close))))
  )
}

function field(t: any, label: string, input: any) {
  return h('label', { className: 'dshwd-field' },
    h('span', { className: 'dshwd-label' }, label),
    input)
}

function validBranch(value: string) {
  if (!value) return true
  const ok = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(value)
  if (!ok || value.includes('..') || value.includes('@{') || value.endsWith('/') || value.endsWith('.') || value.endsWith('.lock')) return false
  return true
}

function pathPreview(project: any) {
  if (!project) return ''
  return `${project.name} → ${project.dirName || '.dsh-worktrees'}/<auto>`
}
