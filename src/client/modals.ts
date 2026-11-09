import { React, h } from './ui'
import { Btn, Field, Icon, Modal, Spinner, branchSelect, BranchCombobox } from './primitives'
import { useBranchInfo } from './hooks'
import { appCtx, bindSession, post, withTimeout } from './context'
import { baseName, cx } from './format'

export function AddProjectModal(props: { t: any; onClose: () => void; onAdded: (project: any) => void }) {
    const t = props.t
    const remotes = appCtx && appCtx.remote
    const [repoPath, setRepoPath] = React.useState('')
    const [name, setName] = React.useState('')
    const [baseBranch, setBaseBranch] = React.useState('')
    const branches = useBranchInfo(repoPath, 150)
    const [picking, setPicking] = React.useState(false)
    const pickingRef = React.useRef(false)
    const [busy, setBusy] = React.useState(false)
    const [err, setErr] = React.useState('')
    const [fieldErrors, setFieldErrors] = React.useState({} as any)
    const submitRef = React.useRef(false)

    const browse = async () => {
      if (pickingRef.current) return
      setErr('')
      if (!remotes || !remotes.directoryPicker) {
        setErr(t.failed)
        return
      }
      pickingRef.current = true
      setPicking(true)
      try {
        const r = await remotes.directoryPicker.pick()
        if (r && r.ok && r.value) {
          setRepoPath(String(r.value))
          setBaseBranch('')
          setFieldErrors((prev: any) => Object.assign({}, prev, { repoPath: '', baseBranch: '' }))
        } else if (r && r.ok === false) {
          setErr(r.error && (r.error.message || r.error.code) ? String(r.error.message || r.error.code) : t.failed)
        }
      } catch (e: any) {
        setErr((e && e.message) || t.failed)
      } finally {
        pickingRef.current = false
        setPicking(false)
      }
    }
    const browseFromPointer = (e: any) => {
      if (e.button !== 0) return
      e.preventDefault()
      void browse()
    }

    React.useEffect(() => {
      setBaseBranch('')
      setFieldErrors((prev: any) => (prev.baseBranch ? Object.assign({}, prev, { baseBranch: '' }) : prev))
    }, [repoPath])

    React.useEffect(() => {
      const d = branches.data
      if (!d) return
      setBaseBranch(d.current || d.default || (d.branches && d.branches[0] && d.branches[0].name) || '')
      setFieldErrors((prev: any) => (prev.baseBranch ? Object.assign({}, prev, { baseBranch: '' }) : prev))
    }, [branches.data])

    const chooseBase = (value: string) => {
      setBaseBranch(value)
      setFieldErrors((prev: any) => (prev.baseBranch ? Object.assign({}, prev, { baseBranch: '' }) : prev))
    }

    const submit = async () => {
      if (submitRef.current || busy || branches.status === 'loading') return
      setErr('')
      const next: any = {}
      if (!repoPath.trim()) next.repoPath = t.requiredField
      if (!baseBranch.trim()) next.baseBranch = t.requiredField
      setFieldErrors(next)
      if (Object.keys(next).length) {
        const id = next.repoPath ? 'dshw-add-repo' : 'dshw-add-base'
        window.requestAnimationFrame(() => document.getElementById(id)?.focus())
        return
      }
      submitRef.current = true
      setBusy(true)
      try {
        const r = await post('projects/add', {
          repoPath: repoPath.trim(),
          name: name.trim() || undefined,
          baseBranch: baseBranch.trim(),
        })
        props.onAdded(r.project)
      } catch (e: any) {
        setErr((e && e.message) || t.failed)
      } finally {
        submitRef.current = false
        setBusy(false)
      }
    }

    let branchControl: any
    let branchHint: any = null
    let branchError: any = fieldErrors.baseBranch
    if (!repoPath.trim()) {
      branchControl = h('div', { className: 'dshw-select-loading' }, h('span', null, t.chooseDirFirst))
      branchHint = null
    } else if (branches.status === 'loading') {
      branchControl = h('div', { className: 'dshw-select-loading' }, h(Spinner), h('span', null, t.loadingBranches))
      branchHint = null
    } else if (branches.status === 'error') {
      branchControl = h('input', {
        className: 'dshw-input',
        id: 'dshw-add-base',
        value: baseBranch,
        placeholder: t.baseBranch,
        autoComplete: 'off',
        'aria-required': 'true',
        'aria-invalid': fieldErrors.baseBranch ? 'true' : 'false',
        'aria-describedby': fieldErrors.baseBranch ? 'dshw-add-base-error' : undefined,
        onChange: (e: any) => chooseBase(e.target.value),
      })
      branchHint = h('span', null, t.loadBranchesFailed, ' ',
        h('button', { type: 'button', className: 'dshw-link-btn', onClick: branches.retry }, t.retry))
    } else {
      branchControl = branchSelect(t, baseBranch, chooseBase, branches.data, {
        id: 'dshw-add-base',
        'aria-required': 'true',
        'aria-invalid': fieldErrors.baseBranch ? 'true' : 'false',
        'aria-describedby': fieldErrors.baseBranch ? 'dshw-add-base-error' : undefined,
      })
      branchHint = null
    }

    const cannotSubmit = busy || !repoPath.trim() || !baseBranch.trim() || branches.status === 'loading'

    const footer = [
      h(Btn, { key: 'cancel', onClick: props.onClose, disabled: busy }, t.cancel),
      h(Btn, {
        key: 'submit',
        variant: 'primary',
        type: 'submit',
        form: 'dshw-add-project-form',
        disabled: cannotSubmit,
        'aria-busy': busy ? 'true' : undefined,
      }, busy ? h(Spinner) : null, t.addProject),
    ]

    return h(Modal, {
      t,
      title: t.addProject,
      subtitle: t.addProjectSub,
      icon: 'folder',
      size: 'lg',
      busy,
      onClose: props.onClose,
      footer,
    },
      h('form', {
        id: 'dshw-add-project-form',
        onSubmit: (e: any) => { e.preventDefault(); void submit() },
      },
      h('div', { className: 'dshw-field' },
        h('label', { className: 'dshw-field-label', htmlFor: 'dshw-add-repo' },
          t.repoPath,
          h('span', { className: 'dshw-req', 'aria-hidden': 'true' }, '*')),
        h('div', { className: 'dshw-field-inline' },
          h('input', {
            id: 'dshw-add-repo',
            className: cx('dshw-input', fieldErrors.repoPath && 'dshw-invalid'),
            value: repoPath,
            placeholder: t.repoPathHint,
            autoFocus: true,
            autoComplete: 'off',
            'aria-required': 'true',
            'aria-invalid': fieldErrors.repoPath ? 'true' : 'false',
            'aria-describedby': fieldErrors.repoPath ? 'dshw-add-repo-error' : undefined,
            onChange: (e: any) => {
              setRepoPath(e.target.value)
              setBaseBranch('')
              if (fieldErrors.repoPath) setFieldErrors({})
            },
          }),
          h(Btn, {
            icon: 'folder',
            disabled: picking,
            'aria-busy': picking ? 'true' : undefined,
            onPointerDown: browseFromPointer,
            onClick: (e: any) => { if (e.detail === 0) void browse() },
          }, picking ? t.pickingDirectory : t.browse)),
        fieldErrors.repoPath
          ? h('div', { className: 'dshw-err', id: 'dshw-add-repo-error', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, fieldErrors.repoPath))
          : null),
      h(Field, { id: 'dshw-add-name', label: t.projectName, hint: t.projectNameHint },
        h('input', {
          className: 'dshw-input',
          value: name,
          placeholder: baseName(repoPath) || t.projectName,
          autoComplete: 'off',
          onChange: (e: any) => setName(e.target.value),
        })),
      h('div', { className: 'dshw-field' },
        h('label', { className: 'dshw-field-label', htmlFor: 'dshw-add-base' },
          t.defaultBase,
          h('span', { className: 'dshw-req', 'aria-hidden': 'true' }, '*')),
        branchControl,
        branchHint ? h('div', { className: 'dshw-hint' }, branchHint) : null,
        branchError
          ? h('div', { className: 'dshw-err', id: 'dshw-add-base-error', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, branchError))
          : null),
      err ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err)) : null))
  }

export function PublishModal(props: { t: any; project: any; cfg: any; parentView?: any; onClose: () => void; onRefresh: () => void; onError: (message: string) => void; onPublished: (task: any, project: any, warning?: string, continued?: boolean) => void }) {
    const t = props.t
    const remotes = appCtx && appCtx.remote
    const project = props.project
    const cfg = props.cfg || {}
    const parentTask = props.parentView && props.parentView.task ? props.parentView.task : null
    const parentAhead = (props.parentView && props.parentView.snapshot && props.parentView.snapshot.postMergeAhead) || 0
    const branches = useBranchInfo(project.repoPath)
    // Continue tasks default to the predecessor's actual merge target, never the
    // project default (which may have moved since the merge).
    const [baseBranch, setBaseBranch] = React.useState(parentTask ? (parentTask.baseBranch || project.baseBranch || '') : (project.baseBranch || ''))
    const [branchName, setBranchName] = React.useState('')
    const [title, setTitle] = React.useState(parentTask ? String(parentTask.title) + String(t.continueTitleSuffix) : '')
    const [description, setDescription] = React.useState('')
    const [carryLeftover, setCarryLeftover] = React.useState(false)
    const [asPlain, setAsPlain] = React.useState(false)
    const [start, setStart] = React.useState(true)
    const [busy, setBusy] = React.useState(false)
    const [err, setErr] = React.useState('')
    const [fieldErrors, setFieldErrors] = React.useState({} as any)
    const advancedRef = React.useRef(null)
    const submitRef = React.useRef(false)

    React.useEffect(() => {
      const d = branches.data
      if (!d) return
      setBaseBranch((prev: string) => prev || d.current || d.default || (d.branches && d.branches[0] && d.branches[0].name) || '')
    }, [branches.data])

    const clearFieldError = (name: string) => {
      setFieldErrors((prev: any) => (prev[name] ? Object.assign({}, prev, { [name]: '' }) : prev))
    }

    const prefix = project.branchPrefix || cfg.branchPrefix || 'dsh-wt/'
    const dirName = project.dirName || cfg.dirName || '.dsh-worktrees'
    const pattern = prefix + '<id8>'
    const wtPattern = project.repoPath.replace(/\\/g, '/').replace(/\/+$/, '') + '/' + dirName + '/<id8>'

    const validBranch = (value: string) => {
      if (!value) return true
      const ok = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(value)
      if (!ok || value.includes('..') || value.includes('@{') || value.endsWith('/') || value.endsWith('.') || value.endsWith('.lock')) return false
      return true
    }

    const submit = async () => {
      if (submitRef.current || busy) return
      setErr('')
      const next: any = {}
      if (!title.trim()) next.title = t.requiredField
      if (!description.trim()) next.description = t.requiredField
      if (!validBranch(branchName.trim())) next.branchName = t.branchInvalid
      setFieldErrors(next)
      if (Object.keys(next).length) {
        const firstId = next.title ? 'dshw-publish-title' : next.description ? 'dshw-publish-description' : 'dshw-publish-branch'
        if (next.branchName && advancedRef.current) (advancedRef.current as any).open = true
        window.requestAnimationFrame(() => document.getElementById(firstId)?.focus())
        return
      }
      submitRef.current = true
      setBusy(true)
      try {
        const r = await withTimeout(post('publish', {
          projectId: project.id,
          baseBranch: baseBranch || undefined,
          title: title.trim(),
          description,
          branchName: branchName.trim() || undefined,
          ...(parentTask && !asPlain ? { parentId: parentTask.id, carryLeftover } : {}),
          start,
        }), 30000, t.publishTimeout)
        const task = r.task
        let publishedTask = task
        if (start && remotes && remotes.session) {
          try {
            const sessionId = await withTimeout(bindSession(remotes, task, project.name, start), 60000, t.bindTimeout)
            // Carry the freshly bound session id so the board's optimistic row
            // shows the correct status and an active "open session" entry before
            // the follow-up refresh lands.
            if (sessionId) publishedTask = Object.assign({}, task, { sessionId })
          } catch (e: any) {
            props.onPublished(task, project, (e && e.message) || t.failed, !!(parentTask && !asPlain))
            return
          }
        }
        props.onPublished(publishedTask, project, undefined, !!(parentTask && !asPlain))
      } catch (e: any) {
        if (e && (e as any).timeout) {
          // The request may have reached the server; reconcile the board instead of trapping the user.
          props.onRefresh()
          props.onError((e && e.message) || t.failed)
          props.onClose()
        } else {
          setErr((e && e.message) || t.failed)
          props.onRefresh()
        }
      } finally {
        submitRef.current = false
        setBusy(false)
      }
    }

    const branchHint = branches.status === 'loading'
      ? t.loadingBranches
      : branches.status === 'error'
        ? h('span', null, t.loadBranchesFailed, ' ', h('button', { type: 'button', className: 'dshw-link-btn', onClick: branches.retry }, t.retry))
        : null
    const branchControl = branches.data
      ? h(BranchCombobox, { t, value: baseBranch, onChange: setBaseBranch, branchInfo: branches.data, id: 'dshw-publish-base' })
      : h('input', { id: 'dshw-publish-base', className: 'dshw-input', value: baseBranch, onChange: (e: any) => setBaseBranch(e.target.value), placeholder: t.baseBranch })

    const footer = [
      h(Btn, { key: 'cancel', onClick: props.onClose, disabled: busy }, t.cancel),
      h(Btn, {
        key: 'submit',
        variant: 'primary',
        type: 'submit',
        form: 'dshw-publish-form',
        disabled: busy,
        'aria-busy': busy ? 'true' : undefined,
      }, busy ? h(Spinner) : null, busy ? t.publishing : t.publish),
    ]

    return h(Modal, {
      t,
      title: parentTask && !asPlain ? t.continueTask : t.publish,
      subtitle: project.name,
      icon: 'play',
      size: 'lg',
      busy,
      onClose: props.onClose,
      footer,
    },
      h('form', {
        id: 'dshw-publish-form',
        onSubmit: (e: any) => { e.preventDefault(); void submit() },
      },
      h('div', { className: 'dshw-form-rows' },
        h('div', { className: 'dshw-form-row' },
          h('label', null, t.projects),
          h('div', { className: 'dshw-readonly-box' },
            h('span', { className: 'dshw-folder-tile dshw-folder-tile--blue' }, h(Icon, { name: 'folder' })),
            h('span', { className: 'dshw-nowrap' }, project.name))),
        parentTask
          ? h('div', { className: 'dshw-form-row' },
            h('label', null, t.parentTask),
            h('div', null,
              h('div', { className: 'dshw-readonly-box' },
                h('span', { className: 'dshw-folder-tile dshw-folder-tile--purple' }, h(Icon, { name: 'branch' })),
                h('span', { className: 'dshw-nowrap' }, parentTask.title)),
              h('div', { className: 'dshw-hint' }, String(t.parentTaskMerged).replace('{base}', parentTask.baseBranch || '—')),
              h('label', { className: 'dshw-check' },
                h('input', { type: 'checkbox', checked: asPlain, onChange: (e: any) => setAsPlain(e.target.checked) }),
                h('span', { className: 'dshw-check-copy' }, t.publishAsPlain)),
              parentAhead > 0 && !asPlain
                ? h('div', null,
                  h('div', { className: 'dshw-choice-group', role: 'radiogroup', style: { marginTop: '6px' } },
                    h('label', { className: 'dshw-choice' },
                      h('input', { type: 'radio', name: 'dshw-continue-carry', checked: !carryLeftover, onChange: () => setCarryLeftover(false) }),
                      h('span', null, t.continueMergedOnly)),
                    h('label', { className: 'dshw-choice' },
                      h('input', { type: 'radio', name: 'dshw-continue-carry', checked: carryLeftover, onChange: () => setCarryLeftover(true) }),
                      h('span', null, t.continueCarry))),
                  h('div', { className: 'dshw-hint' }, carryLeftover
                    ? String(t.continueCarryHint).replace('{n}', String(parentAhead))
                    : t.continueMergedOnlyHint))
                : null))
          : null,
        h('div', { className: 'dshw-form-row' },
          h('label', { htmlFor: 'dshw-publish-title' }, t.taskTitle, h('span', { className: 'dshw-req', 'aria-hidden': 'true' }, '*')),
          h('div', null,
            h('input', {
              id: 'dshw-publish-title',
              className: cx('dshw-input', fieldErrors.title && 'dshw-invalid'),
              value: title,
              placeholder: t.taskTitle,
              autoComplete: 'off',
              'aria-required': 'true',
              'aria-invalid': fieldErrors.title ? 'true' : 'false',
              'aria-describedby': fieldErrors.title ? 'dshw-publish-title-error' : undefined,
              onChange: (e: any) => { setTitle(e.target.value); clearFieldError('title') },
            }),
            fieldErrors.title
              ? h('div', { className: 'dshw-err', id: 'dshw-publish-title-error', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, fieldErrors.title))
              : null)),
        h('div', { className: 'dshw-form-row' },
          h('label', { htmlFor: 'dshw-publish-description' }, t.taskDescription, h('span', { className: 'dshw-req', 'aria-hidden': 'true' }, '*')),
          h('div', null,
            h('textarea', {
              id: 'dshw-publish-description',
              className: cx('dshw-input', fieldErrors.description && 'dshw-invalid'),
              value: description,
              rows: 4,
              placeholder: t.taskDescription,
              'aria-required': 'true',
              'aria-invalid': fieldErrors.description ? 'true' : 'false',
              'aria-describedby': fieldErrors.description ? 'dshw-publish-description-error' : undefined,
              onChange: (e: any) => { setDescription(e.target.value); clearFieldError('description') },
            }),
            fieldErrors.description
              ? h('div', { className: 'dshw-err', id: 'dshw-publish-description-error', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, fieldErrors.description))
              : null)),
        h('div', { className: 'dshw-form-row' },
          h('label', { htmlFor: 'dshw-publish-base' }, t.baseBranch),
          h('div', null,
            branchControl,
            branchHint ? h('div', { className: 'dshw-hint' }, branchHint) : null,
            parentTask && !asPlain && baseBranch && parentTask.baseBranch && baseBranch !== parentTask.baseBranch
              ? h('div', { className: 'dshw-hint' }, String(t.baseNotMergeTarget).replace('{base}', parentTask.baseBranch))
              : null)),
        h('div', { className: 'dshw-form-row' },
          h('span', { className: 'dshw-form-label', id: 'dshw-publish-start-label' }, t.startNow),
          h('div', null,
            h('div', {
              className: 'dshw-choice-group',
              role: 'radiogroup',
              'aria-labelledby': 'dshw-publish-start-label',
              'aria-describedby': 'dshw-publish-start-hint',
            },
              h('label', { className: 'dshw-choice' },
                h('input', {
                  type: 'radio',
                  name: 'dshw-publish-start',
                  value: 'yes',
                  checked: start,
                  onChange: () => setStart(true),
                }),
                h('span', null, t.yes)),
              h('label', { className: 'dshw-choice' },
                h('input', {
                  type: 'radio',
                  name: 'dshw-publish-start',
                  value: 'no',
                  checked: !start,
                  onChange: () => setStart(false),
                }),
                h('span', null, t.no))),
            h('div', { className: 'dshw-hint', id: 'dshw-publish-start-hint' }, t.startNowHint)))),
      h('details', { className: 'dshw-advanced', ref: advancedRef },
        h('summary', null, h(Icon, { name: 'chevronDown' }), t.advanced),
        h('div', { className: 'dshw-advanced-body' },
          h('div', { className: 'dshw-field' },
            h('label', { className: 'dshw-field-label', htmlFor: 'dshw-publish-branch' }, t.branchName),
            h('input', {
              id: 'dshw-publish-branch',
              className: cx('dshw-input dshw-mono', fieldErrors.branchName && 'dshw-invalid'),
              value: branchName,
              placeholder: t.branchNameHint,
              autoComplete: 'off',
              spellCheck: false,
              'aria-invalid': fieldErrors.branchName ? 'true' : 'false',
              'aria-describedby': fieldErrors.branchName ? 'dshw-publish-branch-error' : undefined,
              onChange: (e: any) => { setBranchName(e.target.value); clearFieldError('branchName') },
            }),
            fieldErrors.branchName
              ? h('div', { className: 'dshw-err', id: 'dshw-publish-branch-error', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, fieldErrors.branchName))
              : null))),
      h('div', { className: 'dshw-hint', style: { margin: '-3px 0 10px' } },
        t.branchRule.replace('{pattern}', pattern)),
      h('div', { className: 'dshw-preview' },
        h('span', { className: 'dshw-preview-label' }, t.preview),
        h('span', { className: 'dshw-preview-item' }, h('span', null, t.previewBranch), h('code', { className: 'dshw-mono' }, branchName.trim() || pattern)),
        h('span', { className: 'dshw-sep' }, '·'),
        h('span', { className: 'dshw-preview-item' }, h('span', null, t.previewDir), h('code', { className: 'dshw-mono' }, wtPattern))),
      err ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err)) : null))
  }
