import { React, h } from './ui'
import { appCtx, postLong, bindSession } from './context'
import { useBranchInfo } from './hooks'
import { uuid } from './format'
import type { ProjectView, TaskView } from '../models'

export interface PublishModalProps {
  t: any
  views: ProjectView[]
  initialProjectId: string
  parentId: string
  onClose: () => void
  onPublished: (task: any, project: any, warning?: string, continued?: boolean) => void
  onCheckPublished: () => Promise<TaskView | undefined>
}

export function PublishModal(props: PublishModalProps) {
  const { t } = props
  const initial = props.views.find((v) => v.project.id === props.initialProjectId) || props.views[0]
  const [projectId, setProjectId] = React.useState(initial ? initial.project.id : '')
  const view = props.views.find((v) => v.project.id === projectId) || initial
  const project = view ? view.project : null
  const [base, setBase] = React.useState(project ? project.baseBranch : '')
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [draft, setDraft] = React.useState('')
  const [criteriaList, setCriteriaList] = React.useState([] as string[])
  const [advanced, setAdvanced] = React.useState(false)
  const [branch, setBranch] = React.useState(project ? defaultBranch(project) : '')
  const [start, setStart] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')
  const [unknown, setUnknown] = React.useState(false)
  const titleRef = React.useRef(null)
  const branchInfo = useBranchInfo(project ? project.repoPath : '')
  const branches = branchInfo.data && Array.isArray(branchInfo.data.branches) ? branchInfo.data.branches : []
  const branchNames = branches.map((b: any) => typeof b === 'string' ? b : b && b.name).filter(Boolean)

  React.useEffect(() => {
    if (!project) return
    setBase(project.baseBranch)
    // Reset only when switching project; keep user's edits otherwise.
    setBranch(defaultBranch(project))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  React.useEffect(() => {
    const onKey = (e: any) => { if (e.key === 'Escape' && !busy) props.onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, props.onClose])

  const addCriterion = () => {
    const value = draft.trim()
    if (!value) return
    setCriteriaList((list: string[]) => list.includes(value) ? list : list.concat(value))
    setDraft('')
  }

  const submit = async () => {
    if (!project || !title.trim() || busy) return
    setBusy(true)
    setErr('')
    setUnknown(false)
    let task: any = null
    let warning = ''
    try {
      const payload: any = {
        projectId: project.id,
        baseBranch: base || project.baseBranch,
        title: title.trim(),
        description: description.trim(),
        branchName: advanced && branch.trim() ? branch.trim() : defaultBranch(project),
        acceptanceCriteria: criteriaList,
        start,
      }
      if (props.parentId) payload.parentId = props.parentId
      const result: any = await postLong('publish', payload)
      task = result && result.task ? result.task : result
      warning = String((result && result.warning) || '')
    } catch (e: any) {
      const message = String((e && e.message) || e || '')
      if (/timeout|timed out|aborted|unknown|network|fetch/i.test(message)) {
        setUnknown(true)
        setBusy(false)
        setErr(t.publishTimeout)
        return
      }
      setErr(message || t.failed)
      setBusy(false)
      return
    }
    let continued = false
    if (task && start) {
      try {
        await bindSession(appCtx && appCtx.remote, task, project.name, true)
        continued = true
      } catch (e: any) {
        warning = String((e && e.message) || e || '') || t.openSessionFailed
      }
    }
    setBusy(false)
    props.onPublished(task, project, warning, continued)
  }

  if (!project) {
    return modal(t, props, project, null, h('div', { className: 'dshwd-empty' },
      h('div', { className: 'dshwd-empty-title' }, t.noProjectsHint),
      h('div', { className: 'dshwd-hint' }, t.demoAddProjectFirst)),
    h('button', { className: 'dshwd-btn', onClick: props.onClose }, t.close))
  }

  return modal(t, props, project, submit,
    h('div', { className: 'dshwd-field-row-2' },
      field(t, t.demoProject, h('select', {
        className: 'dshwd-select',
        value: projectId,
        onChange: (e: any) => setProjectId(e.target.value),
      }, props.views.map((v: any) => h('option', { key: v.project.id, value: v.project.id }, v.project.name)))),
      field(t, t.baseBranch, h('div', { style: { display: 'flex', gap: '6px' } },
        branchNames.length
          ? h('select', { className: 'dshwd-select', value: base, onChange: (e: any) => setBase(e.target.value) },
            branchNames.map((name: string) => h('option', { key: name, value: name }, name)))
          : h('input', { className: 'dshwd-input dshwd-mono', value: base, onChange: (e: any) => setBase(e.target.value), placeholder: project.baseBranch }),
        branchInfo.status === 'error'
          ? h('button', { className: 'dshwd-btn', title: t.retry, onClick: branchInfo.retry }, '↻')
          : null))),

    field(t, t.taskTitle, h('input', {
      ref: titleRef,
      className: 'dshwd-input',
      value: title,
      autoFocus: true,
      placeholder: t.demoTitlePlaceholder,
      onChange: (e: any) => setTitle(e.target.value),
    })),

    field(t, t.taskDescription, h('textarea', {
      className: 'dshwd-textarea',
      value: description,
      placeholder: t.demoDescriptionPlaceholder,
      onChange: (e: any) => setDescription(e.target.value),
    })),

    field(t, t.acceptanceCriteria,
      h('div', { className: 'dshwd-criteria-box' },
        criteriaList.length
          ? h('div', { className: 'dshwd-criteria-items' }, criteriaList.map((item: string, i: number) => h('div', { key: i, className: 'dshwd-criteria-chip' },
            h('span', null, item),
            h('button', { className: 'dshwd-criteria-remove', title: t.delete, onClick: () => setCriteriaList((list: string[]) => list.filter((_: string, j: number) => j !== i)) }, '×'))))
          : null,
        h('div', { className: 'dshwd-criteria-add-row' },
          h('input', {
            className: 'dshwd-criteria-input',
            value: draft,
            placeholder: t.demoCriterionPlaceholder,
            onChange: (e: any) => setDraft(e.target.value),
            onKeyDown: (e: any) => {
              if (e.key === 'Enter') { e.preventDefault(); addCriterion() }
            },
          }),
          h('button', { className: 'dshwd-btn dshwd-btn-ghost', style: { height: '24px', fontSize: '11px' }, onClick: addCriterion }, '+ ', t.add)))),

    h('button', { className: 'dshwd-adv-toggle', onClick: () => setAdvanced((v: boolean) => !v) },
      advanced ? '▾ ' : '▸ ', t.demoAdvanced),
    advanced
      ? h('div', { className: 'dshwd-adv-panel dshwd-open' },
        field(t, t.demoCustomBranch, h('input', {
          className: 'dshwd-input dshwd-mono',
          value: branch,
          onChange: (e: any) => setBranch(e.target.value),
        })))
      : null,

    h('div', { className: 'dshwd-adv-panel dshwd-open' },
      h('div', { className: 'dshwd-switch-row' },
        h('div', null,
          h('div', { className: 'dshwd-switch-title' }, t.demoStartAfterPublish),
          h('div', { className: 'dshwd-switch-desc' }, t.demoStartAfterPublishHint)),
        h('label', { className: 'dshwd-switch' },
          h('input', { type: 'checkbox', checked: start, onChange: (e: any) => setStart(e.target.checked) }),
          h('span', { className: 'dshwd-slider' })))),

    err ? h('div', { className: 'dshwd-alert' }, err) : null,
    unknown ? h('div', { className: 'dshwd-alert dshwd-alert-info' },
      h('span', null, t.publishTimeoutHint),
      h('button', { className: 'dshwd-btn', onClick: check }, t.refreshed)) : null,

    busy
      ? h('div', { className: 'dshwd-hint' }, t.publishing)
      : null)

  async function check() {
    setBusy(true)
    const found = await props.onCheckPublished()
    setBusy(false)
    if (!found) {
      setErr(t.publishTimeoutHint)
      return
    }
    props.onPublished(found.task, project, '', false)
  }
}

function modal(t: any, props: PublishModalProps, project: any, onSubmit: (() => void) | null, ...children: any[]) {
  return h('div', { className: 'dshwd-modal-backdrop', onMouseDown: (e: any) => { if (e.target === e.currentTarget) props.onClose() } },
    h('div', { className: 'dshwd-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t.publishTitle },
      h('div', { className: 'dshwd-modal-head' },
        h('div', { className: 'dshwd-modal-title-group' },
          h('div', { className: 'dshwd-modal-title' }, t.publishTitle),
          h('span', { className: 'dshwd-modal-badge dshwd-mono' }, 'git worktree add')),
        h('button', { className: 'dshwd-btn dshwd-btn-ghost', title: t.close, onClick: props.onClose }, '×')),
      h('div', { className: 'dshwd-modal-body' }, children),
      h('div', { className: 'dshwd-modal-foot' },
        h('span', { className: 'dshwd-modal-foot-meta dshwd-mono' }, pathPreview(project)),
        h('div', { className: 'dshwd-modal-foot-actions' },
          h('button', { className: 'dshwd-btn', onClick: props.onClose }, t.cancel),
          onSubmit
            ? h('button', { className: 'dshwd-btn dshwd-btn-cta', onClick: onSubmit }, t.demoCreatePublish)
            : h('button', { className: 'dshwd-btn', onClick: props.onClose }, t.close))))
  )
}

function field(t: any, label: string, input: any) {
  return h('label', { className: 'dshwd-field' },
    h('span', { className: 'dshwd-label' }, label),
    input)
}

function defaultBranch(project: any) {
  const prefix = String(project.branchPrefix || 'task').replace(/\/+$/, '')
  return prefix + '/' + uuid().slice(0, 8)
}

function pathPreview(project: any) {
  if (!project) return ''
  return `${project.name} → ${project.dirName || '.dsh-worktrees'}/<auto>`
}
