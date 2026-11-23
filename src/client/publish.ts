import { React, h } from './ui'
import { appCtx, getJson, postLong, bindSession } from './context'
import { useBranchInfo } from './hooks'
import { normalizeCriteria, parseCriteriaText } from '../criteria'
import { parseDueAt, parseTagText, validateTags } from '../task-meta'
import { applyPublishTemplate, branchChoices, initialPublishForm, publishDraftDirty, type PublishCheckInfo, type PublishDraft } from './publish-state'
import { worktreePreviewRoot } from '../worktree-layout'
import { useDialogFocus } from './dialog-focus'
import type { ProjectView, TaskView, TaskTemplate } from '../models'

/** Stable ids so a field error is announced as the field's description. */
const FIELD_ERROR_ID: Record<string, string> = {
  title: 'dshwd-publish-err-title',
  description: 'dshwd-publish-err-description',
  branch: 'dshwd-publish-err-branch',
  tags: 'dshwd-publish-err-tags',
  dueAt: 'dshwd-publish-err-due-at',
}

export interface PublishModalProps {
  t: any
  views: ProjectView[]
  initialProjectId: string
  parentId: string
  parentView: TaskView | null
  /** In-session draft restored when the modal is reopened. */
  draft?: any
  /** Persist (or clear, with null) the draft in the parent's session state. */
  onDraft?: (draft: any | null) => void
  onClose: () => void
  onPublished: (task: any, project: any, warning?: string, continued?: boolean) => void
  onCheckPublished: (info: PublishCheckInfo) => Promise<TaskView | undefined>
}

type ModelRow = { provider: string; providerName: string; model: string; modelName: string; reasoningEffort?: string }

export function PublishModal(props: PublishModalProps) {
  const { t } = props
  const remotes = appCtx && appCtx.remote
  const initial = props.views.find((v) => v.project.id === props.initialProjectId) || props.views[0]
  const parentTask = props.parentView && props.parentView.task ? props.parentView.task : null
  const parentAhead = Number(props.parentView && props.parentView.snapshot && props.parentView.snapshot.postMergeAhead) || 0

  const form0Ref = React.useRef(null as PublishDraft | null)
  if (form0Ref.current === null) {
    form0Ref.current = initialPublishForm(
      props.draft,
      parentTask ? String(parentTask.title) + String(t.continueTitleSuffix) : '',
    )
  }
  const form0 = form0Ref.current

  const [projectId, setProjectId] = React.useState(initial ? initial.project.id : '')
  const view = props.views.find((v) => v.project.id === projectId) || initial
  const project = view ? view.project : null
  // Continuing always starts from the predecessor's real merge target.
  const [base, setBase] = React.useState(parentTask ? parentTask.baseBranch : project ? project.baseBranch : '')
  const [title, setTitle] = React.useState(form0.title)
  const [description, setDescription] = React.useState(form0.description)
  // A restored branch, tag or non-normal priority means the advanced panel was
  // in use; reopen it so the draft is visibly applied instead of looking like a
  // silent override.
  const [advanced, setAdvanced] = React.useState(
    !!form0.branchName || !!form0.tags || form0.priority !== 'normal' || !!form0.dueAt,
  )
  const [branch, setBranch] = React.useState(form0.branchName)
  const [start, setStart] = React.useState(true)
  const [asPlain, setAsPlain] = React.useState(false)
  const [carryLeftover, setCarryLeftover] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')
  const [fieldErrors, setFieldErrors] = React.useState({} as Record<string, string>)
  const markRequired = (key: string, value: string) => {
    if (String(value || '').trim()) return
    setFieldErrors((prev: Record<string, string>) => Object.assign({}, prev, { [key]: t.requiredField }))
  }
  const [unknown, setUnknown] = React.useState(false)
  const [closeConfirm, setCloseConfirm] = React.useState(false)
  const [library, setLibrary] = React.useState([] as string[])
  const [templates, setTemplates] = React.useState([] as TaskTemplate[])
  const [templateId, setTemplateId] = React.useState('')
  const [picked, setPicked] = React.useState(form0.pickedCriteria)
  const [manual, setManual] = React.useState(form0.manualCriteria)
  const [models, setModels] = React.useState([] as ModelRow[])
  const [modelKey, setModelKey] = React.useState('')
  const [modelError, setModelError] = React.useState('')
  const [tags, setTags] = React.useState(form0.tags)
  const [priority, setPriority] = React.useState(form0.priority)
  const [dueAt, setDueAt] = React.useState(form0.dueAt)
  const [showAllBranches, setShowAllBranches] = React.useState(false)

  const titleRef = React.useRef(null)
  const rootRef = React.useRef(null)
  const keepRef = React.useRef(null)
  // Capture the opener during render, before autoFocus moves focus into the
  // dialog; an effect would already see the focused input.
  const submitRef = React.useRef(false)
  // Read through a ref: the parent passes a fresh onDraft closure each render,
  // and depending on it would re-emit (and re-render) in a loop.
  const onDraftRef = React.useRef(props.onDraft)
  onDraftRef.current = props.onDraft
  const closeRef = React.useRef(() => {})
  const branchInfo = useBranchInfo(project ? project.repoPath : '')
  const branches = branchInfo.data && Array.isArray(branchInfo.data.branches) ? branchInfo.data.branches : []
  const branchNames = branches.map((b: any) => (typeof b === 'string' ? b : b && b.name)).filter(Boolean)

  React.useEffect(() => {
    getJson('acceptance-criteria')
      .then((d: any) => setLibrary(Array.isArray(d.items) ? d.items.map(String) : []))
      .catch(() => {})
    getJson('templates')
      .then((d: any) => setTemplates(Array.isArray(d.templates) ? d.templates : []))
      .catch(() => {})
  }, [])

  // Applying a template replaces the fields it owns and nothing else: project,
  // base, custom branch, model and start options stay exactly as chosen.
  const applyTemplate = (id: string) => {
    setTemplateId(id)
    const item = templates.find((x: TaskTemplate) => x.id === id)
    if (!item) return
    const next = applyPublishTemplate(item, library)
    // Replace unconditionally: switching templates must not leave the previous
    // template's title/description behind.
    setTitle(next.title)
    setDescription(next.description)
    setPicked(next.picked)
    setManual(next.manual)
    clearField('title')
    clearField('description')
  }

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

  // The first render already seeded base/branch from the draft; resetting on
  // mount would wipe a restored custom branch name before it is visible.
  const mountedRef = React.useRef(false)
  React.useEffect(() => {
    if (!project) return
    if (!mountedRef.current) { mountedRef.current = true; return }
    // 续作发布（parentId）时 base 必须保持前序任务的真实合并目标；
    // 项目下拉已 disabled，projectId 不会变，这个重置只会把基线改回项目默认值。
    if (parentTask) return
    setBase(project.baseBranch)
    setBranch('')
    setShowAllBranches(false)
  }, [projectId])

  const currentForm = (): PublishDraft => ({ title, description, manualCriteria: manual, pickedCriteria: picked, branchName: branch, tags, priority, dueAt })
  const dirty = publishDraftDirty(form0, currentForm())
  const handleClose = () => {
    if (busy) return
    // The banner itself is dismissible: Escape or the X first puts it away.
    if (closeConfirm) { setCloseConfirm(false); return }
    if (dirty) { setCloseConfirm(true); return }
    props.onClose()
  }
  closeRef.current = handleClose
  // The discard banner is a second layer: focus belongs to it, not to the
  // background form the user was just typing in.
  React.useEffect(() => {
    if (!closeConfirm) return
    const el: any = keepRef.current
    if (el && typeof el.focus === 'function') el.focus()
  }, [closeConfirm])
  const keepDraftAndClose = () => {
    if (onDraftRef.current) onDraftRef.current(currentForm())
    props.onClose()
  }
  const discardAndClose = () => {
    if (onDraftRef.current) onDraftRef.current(null)
    props.onClose()
  }

  // Persist on every form change, but not on mount: an untouched form should
  // not create a draft that outlives the defaults it was opened with.
  const changedOnce = React.useRef(false)
  React.useEffect(() => {
    if (!changedOnce.current) { changedOnce.current = true; return }
    if (onDraftRef.current) onDraftRef.current(currentForm())
  }, [title, description, manual, picked, branch, tags, priority, dueAt])

  // Shared dialog behaviour: initial focus on the title field, a real Tab
  // loop, Escape only when idle, and focus returned to the opener on unmount.
  const busyRef = React.useRef(busy)
  busyRef.current = busy
  useDialogFocus({ rootRef, initialRef: titleRef, busyRef, onClose: () => closeRef.current() })

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
    // Parse here so the request and the hint agree; an invalid tag set never
    // reaches the server.
    const tagList = parseTagText(tags)
    const tagCheck = validateTags(tagList)
    if (!tagCheck.ok) next.tags = tagCheck.error === 'too-many' ? t.taskTagsTooMany : t.taskTagsTooLong
    // An unparsable date never reaches the server; empty means "no deadline".
    const due = dueAt.trim() ? parseDueAt(dueAt) : { ok: true as const, value: null }
    if (!due.ok) next.dueAt = t.taskDueInvalid
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
        ...(tagList.length ? { tags: tagList } : {}),
        ...(priority && priority !== 'normal' ? { priority } : {}),
        ...(due.ok && due.value !== null ? { dueAt: due.value } : {}),
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
    setErr('')
    const found = await props.onCheckPublished({
      projectId: project ? project.id : '',
      branchName: advanced ? branch.trim() : '',
      title: title.trim(),
    })
    setBusy(false)
    if (!found) {
      setErr(t.publishResultNotFound)
      return
    }
    props.onPublished(found.task, project, '', false)
  }

  if (!project) {
    return modal(t, project, null, busy, start, handleClose, rootRef, h('div', { className: 'dshwd-empty' },
      h('div', { className: 'dshwd-empty-title' }, t.noProjectsHint),
      h('div', { className: 'dshwd-hint' }, t.boardAddProjectFirst)),
    h('button', { className: 'dshwd-btn', onClick: handleClose }, t.close))
  }

  const branchPlaceholder = `${project.branchPrefix || 'dsh-wt/'}<id8>`
  // 后端可接受任意已存在的分支；加载到的列表不含当前 base 时补一个选项，
  // 否则 <select> 会显示成第一个分支（＝悄悄改掉续作目标）。
  const choices = branchChoices(baseBranchesRaw(branchNames, base), base)
  const baseBranches = showAllBranches ? choices.primary.concat(choices.rest) : choices.primary
  const hiddenBranches = choices.rest.length

  return modal(t, project, submit, busy, start, handleClose, rootRef,
    closeConfirm
      ? h('div', { className: 'dshwd-notice dshwd-alert dshwd-alert-warn', role: 'alert' },
        h('div', { className: 'dshwd-notice-text' },
          h('div', { className: 'dshwd-notice-title' }, t.draftConfirmTitle),
          h('div', { className: 'dshwd-hint' }, t.draftConfirmHint)),
        h('div', { className: 'dshwd-notice-actions' },
          h('button', { className: 'dshwd-btn', disabled: busy, onClick: keepDraftAndClose, ref: keepRef }, t.draftKeep),
          h('button', { className: 'dshwd-btn dshwd-btn-danger', disabled: busy, onClick: discardAndClose }, t.draftDiscard)))
      : null,

    h('div', { className: 'dshwd-field-row-2' },
      field(t, t.boardProject, h('select', {
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
          }, baseBranches.map((name: string) => h('option', { key: name, value: name }, name)))
          : h('input', {
            className: 'dshwd-input dshwd-mono',
            value: base,
            disabled: busy,
            onChange: (e: any) => setBase(e.target.value),
            placeholder: project.baseBranch,
          }),
        branchInfo.status === 'error'
          ? h('button', { className: 'dshwd-btn', title: t.retry, disabled: busy, onClick: branchInfo.retry }, '↻')
          : null)),
      hiddenBranches > 0 || showAllBranches
        ? h('button', {
          className: 'dshwd-btn dshwd-btn-ghost',
          disabled: busy,
          onClick: () => setShowAllBranches((v: boolean) => !v),
        }, showAllBranches ? t.hideOtherBranches : String(t.showAllBranches).replace('{n}', String(hiddenBranches)))
        : null,
      branchInfo.status === 'error'
        ? h('div', { className: 'dshwd-hint dshwd-text-warn' }, t.loadBranchesFailed)
        : null,
      hiddenBranches || showAllBranches
        ? h('button', {
          className: 'dshwd-btn dshwd-btn-ghost dshwd-btn-mini',
          disabled: busy,
          onClick: () => setShowAllBranches((v: boolean) => !v),
        }, showAllBranches ? t.hideOtherBranches : String(t.showAllBranches).replace('{n}', String(hiddenBranches)))
        : null),

    parentTask && !asPlain
      ? h('div', { className: 'dshwd-alert dshwd-alert-info' },
        h('span', null, String(t.boardContinueHint).replace('{branch}', parentTask.baseBranch || '—')))
      : null,

    field(t, t.taskTitle, h('input', {
      'aria-required': 'true',
      onBlur: () => markRequired('title', title),
      ref: titleRef,
      className: 'dshwd-input' + (fieldErrors.title ? ' dshwd-invalid' : ''),
      value: title,
      autoFocus: true,
      disabled: busy,
      placeholder: t.boardTitlePlaceholder,
      'aria-invalid': fieldErrors.title ? 'true' : 'false',
      'aria-describedby': fieldErrors.title ? FIELD_ERROR_ID.title : undefined,
      onChange: (e: any) => { setTitle(e.target.value); clearField('title') },
    }), true),
    fieldErrors.title ? h('div', { className: 'dshwd-alert', role: 'alert', id: FIELD_ERROR_ID.title }, fieldErrors.title) : null,

    templates.length
      ? field(t, t.template, h('select', {
        className: 'dshwd-select',
        value: templateId,
        disabled: busy,
        onChange: (e: any) => applyTemplate(e.target.value),
      },
      h('option', { value: '' }, t.templateSelect),
      templates.map((item: TaskTemplate) => h('option', { key: item.id, value: item.id }, item.name))))
      : h('div', { className: 'dshwd-hint' }, t.templateEmpty),

    field(t, t.taskDescription, h('textarea', {
      'aria-required': 'true',
      onBlur: () => markRequired('description', description),
      className: 'dshwd-textarea' + (fieldErrors.description ? ' dshwd-invalid' : ''),
      value: description,
      disabled: busy,
      placeholder: t.boardDescriptionPlaceholder,
      'aria-invalid': fieldErrors.description ? 'true' : 'false',
      'aria-describedby': fieldErrors.description ? FIELD_ERROR_ID.description : undefined,
      onChange: (e: any) => { setDescription(e.target.value); clearField('description') },
    }), true),
    fieldErrors.description ? h('div', { className: 'dshwd-alert', role: 'alert', id: FIELD_ERROR_ID.description }, fieldErrors.description) : null,

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
              'aria-label': t.delete + ' · ' + item,
              disabled: busy,
              onClick: () => setPicked((list: string[]) => list.filter((x: string) => x !== item)),
            }, '×'))))
          : null,
        h('textarea', {
          className: 'dshwd-textarea',
          value: manual,
          disabled: busy,
          rows: 2,
          placeholder: t.boardCriterionPlaceholder,
          onChange: (e: any) => setManual(e.target.value),
          // The placeholder promises Enter adds an item; parse the same way the
          // submit path does so typing and submitting cannot disagree.
          onKeyDown: (e: any) => {
            if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent && e.nativeEvent.isComposing) return
            e.preventDefault()
            const items = parseCriteriaText(manual)
            if (!items.length) return
            setPicked((list: string[]) => {
              const next = list.slice()
              for (const item of items) if (!next.includes(item)) next.push(item)
              return next
            })
            setManual('')
          },
        }))),

    h('button', { className: 'dshwd-adv-toggle', disabled: busy, onClick: () => setAdvanced((v: boolean) => !v) },
      advanced ? '▾ ' : '▸ ', t.boardAdvanced),
    advanced
      ? h('div', { className: 'dshwd-adv-panel dshwd-open' },
        field(t, t.boardCustomBranch, h('input', {
          className: 'dshwd-input dshwd-mono' + (fieldErrors.branch ? ' dshwd-invalid' : ''),
          value: branch,
          disabled: busy,
          placeholder: branchPlaceholder,
          'aria-invalid': fieldErrors.branch ? 'true' : 'false',
          'aria-describedby': fieldErrors.branch ? FIELD_ERROR_ID.branch : undefined,
          onChange: (e: any) => { setBranch(e.target.value); clearField('branch') },
        })),
        fieldErrors.branch ? h('div', { className: 'dshwd-alert', role: 'alert', id: FIELD_ERROR_ID.branch }, fieldErrors.branch) : null,
        field(t, t.model, models.length
          ? h('select', {
            className: 'dshwd-select',
            value: modelKey,
            disabled: busy,
            onChange: (e: any) => setModelKey(e.target.value),
          },
            h('option', { value: '' }, t.modelDefault),
            models.map((m: ModelRow, i: number) => h('option', { key: m.provider + ':' + m.model, value: String(i) }, `${m.providerName} · ${m.modelName}`)))
          : h('div', { className: 'dshwd-hint' }, modelError || t.loading)),
        field(t, t.taskTags, h('input', {
          className: 'dshwd-input' + (fieldErrors.tags ? ' dshwd-invalid' : ''),
          value: tags,
          disabled: busy,
          placeholder: t.taskTagsPlaceholder,
          'aria-invalid': fieldErrors.tags ? 'true' : 'false',
          'aria-describedby': fieldErrors.tags ? FIELD_ERROR_ID.tags : undefined,
          onChange: (e: any) => { setTags(e.target.value); clearField('tags') },
        })),
        h('div', { className: 'dshwd-hint' }, t.taskTagsHint),
        fieldErrors.tags ? h('div', { className: 'dshwd-alert', role: 'alert', id: FIELD_ERROR_ID.tags }, fieldErrors.tags) : null,
        field(t, t.taskPriority, h('select', {
          className: 'dshwd-select',
          value: priority,
          disabled: busy,
          onChange: (e: any) => setPriority(e.target.value),
        },
          h('option', { value: 'low' }, t.priorityLow),
          h('option', { value: 'normal' }, t.priorityNormal),
          h('option', { value: 'high' }, t.priorityHigh))),
        field(t, t.taskDue, h('input', {
          type: 'date',
          className: 'dshwd-input' + (fieldErrors.dueAt ? ' dshwd-invalid' : ''),
          value: dueAt,
          disabled: busy,
          'aria-label': t.taskDue,
          'aria-invalid': fieldErrors.dueAt ? 'true' : 'false',
          'aria-describedby': fieldErrors.dueAt ? FIELD_ERROR_ID.dueAt : undefined,
          onChange: (e: any) => { setDueAt(e.target.value); clearField('dueAt') },
        })),
        fieldErrors.dueAt ? h('div', { className: 'dshwd-alert', role: 'alert', id: FIELD_ERROR_ID.dueAt }, fieldErrors.dueAt) : null)
      : null,

    parentTask
      ? h('label', { className: 'dshwd-check-row' },
        h('input', { type: 'checkbox', checked: asPlain, disabled: busy, onChange: (e: any) => setAsPlain(e.target.checked) }),
        h('span', { className: 'dshwd-check-label' }, t.boardPublishAsPlain))
      : null,
    parentTask && !asPlain && parentAhead > 0
      ? h('label', { className: 'dshwd-check-row' },
        h('input', { type: 'checkbox', checked: carryLeftover, disabled: busy, onChange: (e: any) => setCarryLeftover(e.target.checked) }),
        h('span', { className: 'dshwd-check-label' }, String(t.boardCarryLeftover).replace('{n}', String(parentAhead))))
      : null,

    h('div', { className: 'dshwd-adv-panel dshwd-open' },
      h('div', { className: 'dshwd-switch-row' },
        h('div', null,
          h('div', { className: 'dshwd-switch-title' }, t.boardStartAfterPublish),
          h('div', { className: 'dshwd-switch-desc' }, t.boardStartAfterPublishHint)),
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

function modal(t: any, project: any, onSubmit: (() => void) | null, busy: boolean, start: boolean, onClose: () => void, rootRef: any, ...children: any[]) {
  const close = () => { if (!busy) onClose() }
  return h('div', {
    className: 'dshwd-modal-backdrop',
    onMouseDown: (e: any) => { if (e.target === e.currentTarget) close() },
  },
    h('div', { className: 'dshwd-modal', ref: rootRef, role: 'dialog', 'aria-modal': 'true', 'aria-label': t.publishTitle, tabIndex: -1 },
      h('div', { className: 'dshwd-modal-head' },
        h('div', { className: 'dshwd-modal-title-group' },
          h('div', { className: 'dshwd-modal-title' }, t.publishTitle),
          h('span', { className: 'dshwd-modal-badge dshwd-mono' }, 'git worktree add')),
        h('button', {
          className: 'dshwd-btn dshwd-btn-ghost',
          title: t.close,
          'aria-label': t.close,
          disabled: busy,
          onClick: close,
        }, '×')),
      h('div', { className: 'dshwd-modal-body' }, children),
      h('div', { className: 'dshwd-modal-foot' },
        // With auto-start off nothing is launched, so neither the button nor the
        // footer may promise a session: show the path being created instead.
        h('span', { className: 'dshwd-modal-foot-meta dshwd-mono' }, pathPreview(project)),
        h('div', { className: 'dshwd-modal-foot-actions' },
          h('button', { className: 'dshwd-btn', disabled: busy, onClick: close }, t.cancel),
          onSubmit
            ? h('button', { className: 'dshwd-btn dshwd-btn-cta', disabled: busy, onClick: onSubmit }, busy ? t.publishing : (start ? t.boardCreatePublish : t.boardCreateTask))
            : h('button', { className: 'dshwd-btn', disabled: busy, onClick: close }, t.close))))
  )
}

function field(t: any, label: string, input: any, required = false) {
  return h('label', { className: 'dshwd-field' },
    h('span', { className: 'dshwd-label' },
      h('span', { className: 'dshwd-label-text' }, label,
        required ? h('span', { className: 'dshwd-required', 'aria-hidden': 'true' }, ' *') : null)),
    input)
}

/** Keep the selected base visible even when the fetched list omitted it. */
function baseBranchesRaw(names: string[], base: string): string[] {
  if (!names.length) return names
  return base && !names.includes(base) ? [base, ...names] : names
}

function validBranch(value: string) {
  if (!value) return true
  const ok = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(value)
  if (!ok || value.includes('..') || value.includes('@{') || value.endsWith('/') || value.endsWith('.') || value.endsWith('.lock')) return false
  return true
}

function pathPreview(project: any) {
  if (!project) return ''
  return `${project.name} → ${worktreePreviewRoot(project)}/<auto>`
}

/** Footer path without the "→ worktree" arrow that reads as "will start". */

