import { React, h } from './ui'
import { Btn, Checkbox, Field, Icon, Modal, Spinner, BranchCombobox, TextInput } from './primitives'
import { ModelCombobox } from './model-picker'
import { useBranchInfo } from './hooks'
import { appCtx, bindSession, getJson, post, postLong, withTimeout } from './context'
import { baseName, cx } from './format'
import { normalizeCriteria, parseCriteriaText } from '../criteria'

function isValidBranchName(value: string): boolean {
  if (!value) return true
  const ok = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(value)
  return ok && !value.includes('..') && !value.includes('@{') && !value.endsWith('/') && !value.endsWith('.') && !value.endsWith('.lock')
}

function usePublishSubmit(opts: {
  t: any
  project: any
  onRefresh: () => void
  onCheckPublished?: (info: any) => Promise<any>
  onPublished: (task: any, project: any, warning?: string, continued?: boolean) => void
}) {
  const { t, project } = opts
  const remotes = appCtx?.remote
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')
  const [unknown, setUnknown] = React.useState(false)
  const lockRef = React.useRef(false)

  const submit = async (payload: any, start: boolean, continued: boolean) => {
    if (lockRef.current || busy) return
    lockRef.current = true
    setBusy(true)
    setErr('')
    try {
      const r = await withTimeout(postLong('publish', payload), 30_000, t.publishTimeout)
      let publishedTask = r.task
      if (start && remotes?.session) {
        try {
          const sessionId = await withTimeout(bindSession(remotes, r.task, project.name, start), 60_000, t.bindTimeout)
          if (sessionId) publishedTask = { ...r.task, sessionId }
        } catch (e: any) {
          opts.onPublished(r.task, project, e?.message || t.failed, continued)
          return
        }
      }
      opts.onPublished(publishedTask, project, undefined, continued)
    } catch (e: any) {
      if (e?.timeout) setUnknown(true)
      setErr(e?.message || (e?.timeout ? t.publishTimeout : t.failed))
      opts.onRefresh()
    } finally {
      lockRef.current = false
      setBusy(false)
    }
  }

  const reconcile = async (info: { projectId: string; branchName: string; title: string }) => {
    if (busy) return
    setBusy(true)
    setErr('')
    try {
      const found = opts.onCheckPublished ? await opts.onCheckPublished(info) : null
      if (found) opts.onPublished(found, project)
      else setErr(t.publishResultNotFound)
    } catch (e: any) {
      setErr(e?.message || t.failed)
    } finally {
      setBusy(false)
    }
  }

  return { busy, err, unknown, submit, reconcile }
}

export function AddProjectModal(props: { t: any; onClose: () => void; onAdded: (project: any) => void }) {
  const t = props.t
  const remotes = appCtx?.remote
  const [repoPath, setRepoPath] = React.useState('')
  const [name, setName] = React.useState('')
  const [baseBranch, setBaseBranch] = React.useState('')
  const [picking, setPicking] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')
  const branches = useBranchInfo(repoPath, 150)

  React.useEffect(() => {
    if (!branches.data) return
    const d = branches.data
    setBaseBranch(d.current || d.default || d.branches?.[0]?.name || '')
  }, [branches.data])

  const browse = async () => {
    if (picking || !remotes?.directoryPicker) return
    setPicking(true)
    setErr('')
    try {
      const r = await remotes.directoryPicker.pick()
      if (r?.ok && r.value) {
        setRepoPath(String(r.value))
        setBaseBranch('')
      }
    } catch (e: any) {
      setErr(e?.message || t.failed)
    } finally {
      setPicking(false)
    }
  }

  const submit = async (e: any) => {
    e.preventDefault()
    if (busy || !repoPath.trim() || !baseBranch.trim()) return
    setBusy(true)
    setErr('')
    try {
      const r = await post('projects/add', {
        repoPath: repoPath.trim(),
        name: name.trim() || undefined,
        baseBranch: baseBranch.trim(),
      })
      props.onAdded(r.project)
    } catch (error: any) {
      setErr(error?.message || t.failed)
    } finally {
      setBusy(false)
    }
  }

  return h(Modal, {
    t,
    title: t.addProject,
    subtitle: t.addProjectSub,
    icon: 'folder',
    size: 'lg',
    busy,
    onClose: props.onClose,
    footer: [
      h(Btn, { key: 'cancel', onClick: props.onClose, disabled: busy }, t.cancel),
      h(Btn, { key: 'ok', variant: 'primary', type: 'submit', form: 'dshw-add-project-form', disabled: busy || !repoPath.trim() || !baseBranch.trim() },
        busy ? h(Spinner) : null, t.addProject),
    ],
  },
    h('form', { id: 'dshw-add-project-form', onSubmit: submit },
      h('div', { className: 'dshw-form-section' },
        h(Field, { id: 'dshw-add-repo', label: t.repoPath },
          h('div', { className: 'dshw-field-inline' },
            h(TextInput, { value: repoPath, placeholder: t.repoPathHint, autoFocus: true, onChange: (e: any) => { setRepoPath(e.target.value); setBaseBranch('') } }),
            h(Btn, { icon: 'folder', disabled: picking, onClick: browse }, picking ? t.pickingDirectory : t.browse))),
        h(Field, { id: 'dshw-add-name', label: t.projectName, hint: t.projectNameHint },
          h(TextInput, { value: name, placeholder: baseName(repoPath) || t.projectName, onChange: (e: any) => setName(e.target.value) })),
        h(Field, { id: 'dshw-add-base', label: t.defaultBase },
          branches.status === 'loading'
            ? h('div', { className: 'dshw-select-loading' }, h(Spinner), h('span', null, t.loadingBranches))
            : branches.data
              ? h(BranchCombobox, { t, value: baseBranch, onChange: setBaseBranch, branchInfo: branches.data, id: 'dshw-add-base' })
              : h(TextInput, { value: baseBranch, placeholder: t.baseBranch, onChange: (e: any) => setBaseBranch(e.target.value) }))),
      err ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err)) : null))
}

export function PublishModal(props: any) {
  const { t, project, cfg = {}, parentView, draft = {} } = props
  const parentTask = parentView?.task || null
  const branches = useBranchInfo(project.repoPath)

  const [title, setTitle] = React.useState(draft.title ?? (parentTask ? `${parentTask.title}${t.continueTitleSuffix}` : ''))
  const [description, setDescription] = React.useState(draft.description ?? '')
  const [baseBranch, setBaseBranch] = React.useState(parentTask?.baseBranch || project.baseBranch || '')
  const [branchName, setBranchName] = React.useState(draft.branchName ?? '')
  const [start, setStart] = React.useState(true)
  const [asPlain, setAsPlain] = React.useState(false)
  const [carryLeftover] = React.useState(false)
  const [manualCriteria, setManualCriteria] = React.useState(draft.manualCriteria ?? '')
  const [pickedCriteria, setPickedCriteria] = React.useState(Array.isArray(draft.pickedCriteria) ? draft.pickedCriteria : [])
  const [criteriaLibrary, setCriteriaLibrary] = React.useState([] as string[])
  const [modelCatalog, setModelCatalog] = React.useState(null as any)
  const [modelChoice, setModelChoice] = React.useState(null as any)
  const [fieldErrors, setFieldErrors] = React.useState({} as Record<string, string>)

  const { busy, err, unknown, submit, reconcile } = usePublishSubmit(props)

  React.useEffect(() => {
    props.onDraft?.({ title, description, manualCriteria, pickedCriteria, branchName })
  }, [title, description, manualCriteria, pickedCriteria.join('|'), branchName])

  React.useEffect(() => {
    getJson('acceptance-criteria').then((d: any) => setCriteriaLibrary(Array.isArray(d.items) ? d.items : [])).catch(() => {})
    appCtx?.remote?.session?.modelCatalog?.().then((r: any) => { if (r?.ok && r.value) setModelCatalog(r.value) }).catch(() => {})
  }, [])

  React.useEffect(() => {
    if (branches.data && !baseBranch) {
      setBaseBranch(branches.data.current || branches.data.default || branches.data.branches?.[0]?.name || '')
    }
  }, [branches.data])

  const handleSubmit = (e: any) => {
    e.preventDefault()
    const nextErr: Record<string, string> = {}
    if (!title.trim()) nextErr.title = t.requiredField
    if (!description.trim()) nextErr.description = t.requiredField
    if (!isValidBranchName(branchName.trim())) nextErr.branchName = t.branchInvalid
    setFieldErrors(nextErr)
    if (Object.keys(nextErr).length) return

    void submit({
      projectId: project.id,
      baseBranch: baseBranch || undefined,
      title: title.trim(),
      description,
      branchName: branchName.trim() || undefined,
      model: modelChoice || undefined,
      acceptanceCriteria: normalizeCriteria([...pickedCriteria, ...parseCriteriaText(manualCriteria)]),
      ...(parentTask && !asPlain ? { parentId: parentTask.id, carryLeftover } : {}),
      start,
    }, start, !!(parentTask && !asPlain))
  }

  return h(Modal, {
    t,
    title: parentTask && !asPlain ? t.continueTask : t.publish,
    icon: 'play',
    size: 'lg',
    busy,
    onClose: props.onClose,
    footer: [
      props.onBackToProject && !parentTask ? h(Btn, { key: 'back', disabled: busy, onClick: props.onBackToProject }, t.backToProject) : null,
      h(Btn, { key: 'cancel', onClick: props.onClose, disabled: busy }, t.cancel),
      unknown
        ? h(Btn, { key: 'check', variant: 'primary', disabled: busy, onClick: () => void reconcile({ projectId: project.id, branchName: branchName.trim(), title: title.trim() }) }, t.refreshConfirm)
        : h(Btn, { key: 'ok', variant: 'primary', type: 'submit', form: 'dshw-publish-form', disabled: busy }, busy ? h(Spinner) : null, busy ? t.publishing : t.publish),
    ].filter(Boolean),
  },
    h('form', { id: 'dshw-publish-form', onSubmit: handleSubmit },
      h('div', { className: 'dshw-form-section' },
        h('div', { className: 'dshw-form-section__title' }, project.name),
        h(Field, { id: 'dshw-publish-title', label: t.taskTitle, error: fieldErrors.title },
          h('input', {
            id: 'dshw-publish-title',
            className: cx('dshw-input', fieldErrors.title && 'dshw-invalid'),
            value: title,
            placeholder: t.taskTitle,
            onChange: (e: any) => setTitle(e.target.value),
          })),
        h(Field, { id: 'dshw-publish-desc', label: t.taskDescription, error: fieldErrors.description },
          h('textarea', {
            id: 'dshw-publish-desc',
            className: cx('dshw-textarea', fieldErrors.description && 'dshw-invalid'),
            rows: 5,
            value: description,
            placeholder: t.taskDescription,
            onChange: (e: any) => setDescription(e.target.value),
          })),
        parentTask
          ? h(Checkbox, { checked: asPlain, onChange: setAsPlain, label: t.publishAsPlain })
          : null),
      h('div', { className: 'dshw-form-section' },
        h('div', { className: 'dshw-form-section__title' }, t.advanced || '高级配置'),
        h(Field, { id: 'dshw-publish-base', label: t.baseBranch },
          branches.data
            ? h(BranchCombobox, { t, value: baseBranch, onChange: setBaseBranch, branchInfo: branches.data, id: 'dshw-publish-base' })
            : h(TextInput, { value: baseBranch, onChange: (e: any) => setBaseBranch(e.target.value) })),
        h(Field, { id: 'dshw-publish-branch', label: t.branchName, error: fieldErrors.branchName },
          h(TextInput, { value: branchName, placeholder: `${project.branchPrefix || cfg.branchPrefix || 'dsh-wt/'}<id8>`, onChange: (e: any) => setBranchName(e.target.value) })),
        modelCatalog
          ? h(Field, { id: 'dshw-publish-model', label: t.model || '模型' },
            h(ModelCombobox, { t, catalog: modelCatalog, value: modelChoice, onChange: setModelChoice }))
          : null,
        criteriaLibrary.length
          ? h('div', { className: 'dshw-criteria-picks' }, criteriaLibrary.map((item: string) =>
            h(Checkbox, {
              key: item,
              checked: pickedCriteria.includes(item),
              onChange: () => setPickedCriteria((prev: string[]) => prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]),
              label: item,
            })))
          : null,
        h(Field, { id: 'dshw-publish-criteria', label: t.acceptanceCriteria || '验收标准' },
          h('textarea', { className: 'dshw-textarea', rows: 2, value: manualCriteria, onChange: (e: any) => setManualCriteria(e.target.value) })),
        h(Checkbox, { checked: start, onChange: setStart, label: t.startNow || '发布后立即启动会话' })),
      err ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err)) : null))
}
