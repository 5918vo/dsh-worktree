import { React, h } from './ui'
import { Banner, Btn, Card, CardHead, Checkbox, CopyBtn, Icon, KV, MenuItem, Modal, Spinner, Stat, BranchCombobox, TextInput } from './primitives'
import { useBranchInfo } from './hooks'
import { post } from './context'
import { copyText, cx, relTime } from './format'
import { resolveStatus, pendingLabel } from './status'
import { DEFAULT_WORKTREE_DIR } from '../worktree-layout'

export function ProjectDetail(props: any) {
    const t = props.t
    const v = props.view
    const project = v.project
    const cfg = props.cfg || {}
    const [name, setName] = React.useState(project.name)
    const [baseBranch, setBaseBranch] = React.useState(project.baseBranch || '')
    const [dirName, setDirName] = React.useState(project.dirName || '')
    const [branchPrefix, setBranchPrefix] = React.useState(project.branchPrefix || '')
    // Opt-in gate: only an explicit 'criteria' blocks merges; absent means off.
    const [mergeGateOn, setMergeGateOn] = React.useState(project.mergeGate === 'criteria')
    const branches = useBranchInfo(project.repoPath)
    const [deleteTarget, setDeleteTarget] = React.useState(null as { id: string; name: string; baseBranch: string; total: number } | null)
    const [withTasks, setWithTasks] = React.useState(false)
    const [withWorktrees, setWithWorktrees] = React.useState(false)
    const [busy, setBusy] = React.useState('')
    const [msg, setMsg] = React.useState('')
    const [err, setErr] = React.useState('')
    const [nameError, setNameError] = React.useState('')
    const [tab, setTab] = React.useState('overview')
    const saveTimer = React.useRef(null)
    const actionRef = React.useRef(false)

    // The overview must agree with the sidebar. A Git-derived `review` on a
    // still-running session is really "in progress", so resolve the live
    // session state before bucketing tasks.
    const isRunning = (task: any) => !!(task && task.sessionId && props.sessionMap && props.sessionMap[task.sessionId])
    // A task belongs to exactly one bucket. "Needs attention" used to include
    // every pending session, which could also sit in "in progress" — the same
    // task was counted twice. Broken/pending wins over the status bucket.
    const bucketOf = (item: any): 'attention' | 'active' | 'review' | 'merged' | 'other' => {
      const status = resolveStatus(item.snapshot.status, isRunning(item.task))
      const pending = !!(item.task.sessionId && props.pendingMap && props.pendingMap[item.task.sessionId])
      if (status === 'broken' || pending) return 'attention'
      if (status === 'developing' || status === 'reviewing') return 'active'
      if (status === 'review') return 'review'
      if (status === 'merged') return 'merged'
      return 'other'
    }
    const counts = { total: v.tasks.length, attention: 0, active: 0, review: 0, merged: 0 }
    for (const item of v.tasks) {
      const bucket = bucketOf(item)
      if (bucket !== 'other') counts[bucket] += 1
    }
    // Same bucket as the stat above, so the banner and the number never disagree.
    const attentionTasks = v.tasks.filter((item: any) => bucketOf(item) === 'attention')
    // Every waiting prompt, not just the first: one project can hold several.
    const pendingTasks = v.tasks.filter((item: any) => !!(item.task.sessionId && props.pendingMap && props.pendingMap[item.task.sessionId]))
    const reviewingTasks = v.tasks.filter((item: any) => item.snapshot.status === 'reviewing')

    const act = async (label: string, fn: () => Promise<any>) => {
      if (actionRef.current || busy) return
      actionRef.current = true
      setBusy(label)
      setErr('')
      setMsg('')
      try {
        await fn()
        await props.onChanged()
      } catch (e: any) {
        setErr((e && e.message) || t.failed)
      } finally {
        actionRef.current = false
        setBusy('')
      }
    }

    const save = () => {
      if (busy) return
      if (!name.trim()) {
        setNameError(t.requiredField)
        window.requestAnimationFrame(() => document.getElementById('dshw-project-name')?.focus())
        return
      }
      setNameError('')
      void act('save', async () => {
        await post('projects/update', {
          id: project.id,
          name: name.trim(),
          baseBranch,
          dirName,
          branchPrefix,
          mergeGate: mergeGateOn ? 'criteria' : 'off',
        })
        setMsg(t.saved)
        if (saveTimer.current) window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(() => setMsg(''), 3200)
      })
    }

    React.useEffect(() => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }, [])

    const openDelete = () => {
      // Snapshot the identity being deleted: the detail view keeps re-rendering
      // from live props, and a project switch must not retarget the open panel.
      setDeleteTarget({ id: project.id, name: project.name, baseBranch: project.baseBranch || '', total: counts.total })
      setWithTasks(false)
      // Removing folders is destructive and cannot be undone; keep it opt-in.
      setWithWorktrees(false)
      setErr('')
    }
    const closeDelete = () => {
      if (busy === 'del') return
      setDeleteTarget(null)
      setErr('')
    }

    const remove = () => {
      const target = deleteTarget
      if (!target) return
      void act('del', async () => {
        await post('projects/delete', { id: target.id, withTasks, withWorktrees: withTasks && withWorktrees })
        setDeleteTarget(null)
        props.onDeleted()
        props.notify(String(t.projectDeleted).replace('{name}', target.name))
      })
    }

    const branchHint = branches.status === 'loading'
      ? t.loadingBranches
      : branches.status === 'error'
        ? h('span', null, t.loadBranchesFailed, ' ',
          h('button', { type: 'button', className: 'dshw-link-btn', onClick: branches.retry }, t.retry))
        : null
    const branchControl = branches.data
      ? h(BranchCombobox, { t, value: baseBranch, onChange: setBaseBranch, branchInfo: branches.data, id: 'dshw-project-base' })
      : h(TextInput, { id: 'dshw-project-base', value: baseBranch, onChange: (e: any) => setBaseBranch(e.target.value), placeholder: t.baseBranch })

    const deleteModal = deleteTarget
      ? h(Modal, {
        t,
        title: t.deleteProjectTitle,
        subtitle: deleteTarget.name,
        icon: 'trash',
        tone: 'danger',
        size: 'sm',
        busy: busy === 'del',
        onClose: closeDelete,
        footer: [
          h(Btn, { key: 'c', onClick: closeDelete, disabled: busy === 'del', 'data-modal-autofocus': true }, t.cancel),
          h(Btn, {
            key: 'ok',
            variant: 'danger',
            disabled: busy === 'del' || (deleteTarget.total > 0 && !withTasks) || reviewingTasks.length > 0,
            onClick: remove,
          }, busy === 'del' ? h(Spinner) : null, busy === 'del' ? t.deleting : t.deleteProjectConfirm),
        ],
      },
        deleteTarget.total > 0
          ? h(Banner, { tone: 'warn', icon: 'alert', title: String(t.deleteProjectWarning).replace('{n}', String(deleteTarget.total)) }, t.deleteProjectWarningHint)
          : h(Banner, { tone: 'info', icon: 'info' }, t.deleteProjectEmptyHint),
        reviewingTasks.length
          ? h(Banner, { tone: 'warn', icon: 'alert', title: t.reviewingBlockTitle }, t.reviewingBlockHint)
          : null,
        h('div', { className: 'dshw-info-table' },
          h(KV, { label: t.deleteProjectBase }, h('span', { className: 'dshw-mono' }, deleteTarget.baseBranch))),
        deleteTarget.total > 0
          ? h(Checkbox, {
            className: 'dshw-check',
            checked: withTasks,
            onChange: (next: boolean) => setWithTasks(next),
            label: h('span', { className: 'dshw-check-copy' }, t.withTasks),
          })
          : null,
        deleteTarget.total > 0
          ? h(Checkbox, {
            className: 'dshw-check',
            checked: withWorktrees,
            disabled: !withTasks,
            onChange: (next: boolean) => setWithWorktrees(next),
            label: h('span', { className: 'dshw-check-copy' }, t.withWorktrees, h('small', { id: 'dshw-delete-worktrees-hint' }, t.withWorktreesHint)),
          })
          : null,
        err ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err)) : null)
      : null

    const tabBtn = (key: string, label: any) => h('button', {
      type: 'button',
      className: 'dshw-tab' + (tab === key ? ' dshw-tab--on' : ''),
      onClick: () => setTab(key),
    }, label)

    const topbar = h('div', { className: 'dshw-topbar' },
      h('div', { className: 'dshw-topbar-left' },
        props.onToggleRail
          ? h('button', { type: 'button', className: 'dshw-btn dshw-btn--ghost dshw-btn--sm', title: props.railHidden ? t.expand : t.collapse, 'aria-label': props.railHidden ? t.expand : t.collapse, onClick: () => props.onToggleRail() },
            props.narrow
              ? [h('span', { key: 'i', 'aria-hidden': 'true' }, '‹'), h('span', { key: 't', className: 'dshwd-btn-label' }, t.backToList)]
              : '◧')
          : null,
        h('div', { className: 'dshw-breadcrumb' },
          h(Icon, { name: 'folder' }),
          h('strong', null, project.name),
          h('span', null, '/'),
          h('span', { className: 'dshw-mono' }, project.repoPath))),
      h('div', { className: 'dshw-topbar-right' },
        h('span', { className: 'dshw-mono dshwd-topbar-count', style: { fontSize: '11px', color: 'var(--dshw-text-3)' } }, counts.total + ' ' + t.taskUnit),
        props.onToggleInspector
          ? h('button', { type: 'button', className: 'dshw-btn dshw-btn--ghost dshw-btn--sm', title: props.inspectorHidden ? t.expand : t.collapse, 'aria-label': t.collapse, onClick: () => props.onToggleInspector() }, '◨')
          : null))

    const stageHead = h('header', { className: 'dshw-stage-head' },
      h('div', { className: 'dshw-stage-title-row' },
        h('div', { style: { minWidth: 0 } },
          h('h1', { className: 'dshw-stage-title' }, project.name),
          h('div', { className: 'dshw-stage-sub' },
            h('span', { className: 'dshw-mono' }, project.repoPath),
            h(CopyBtn, { text: project.repoPath, label: t.copyRepoPath, t, notify: props.notify }))),
        h('div', { style: { display: 'flex', gap: '8px', flexShrink: 0 } },
          h(Btn, { icon: 'play', onClick: () => props.onPublish(project) }, t.publish),
          h('details', { className: 'dshw-menu' },
            h('summary', { className: 'dshw-icon-btn', 'aria-label': t.operations, title: t.operations }, h(Icon, { name: 'more' })),
            h('div', { className: 'dshw-menu-pop' },
              h(MenuItem, { icon: 'plus', onClick: () => props.onPublish(project) }, t.publish),
              h(MenuItem, { icon: 'copy', onClick: () => { void copyText(project.repoPath).then((ok) => props.notify(ok ? t.copied : t.copyFailed, ok ? 'ok' : 'error')) } }, t.copyRepoPath))))),
      h('nav', { className: 'dshw-tabs' },
        tabBtn('overview', t.overview),
        tabBtn('settings', t.projectSettings)))

    const recent = v.tasks.slice()
      .sort((a: any, b: any) => ((b.task.updatedAt || b.task.createdAt || 0) - (a.task.updatedAt || a.task.createdAt || 0)))
      .slice(0, 6)

    const overviewBody = h('div', { className: 'dshw-stage-body' },
      h('div', { className: 'dshw-measure' },
        err ? h('div', { className: 'dshw-err', role: 'alert', style: { marginBottom: '16px' } }, h(Icon, { name: 'alert' }), h('span', null, err)) : null,
        h('div', { className: 'dshw-stats' },
          h(Stat, { label: t.attentionStat, value: counts.attention, icon: 'alert', tone: 'warn' }),
          h(Stat, { label: t.activeTasks, value: counts.active, icon: 'terminal', tone: 'brand' }),
          h(Stat, { label: t.reviewTasks, value: counts.review, icon: 'clock', tone: 'warn' }),
          h(Stat, { label: t.mergedTasks, value: counts.merged, icon: 'branch', tone: 'success' })),
        attentionTasks.length
          ? h('div', { className: 'dshw-attention' },
            h(Icon, { name: 'clock' }),
            h('span', null, String(t.attention).replace('{n}', String(attentionTasks.length))),
            pendingTasks.length
              ? h('button', { type: 'button', className: 'dshw-link-btn', onClick: () => props.onSelectTask(pendingTasks[0].task.id, project.id) }, t.view)
              : null)
          : null,
        pendingTasks.length
          ? h(Card, null,
            h(CardHead, { icon: 'message', title: t.attentionPending }),
            h('div', { className: 'dshw-acts' }, pendingTasks.map((item: any) => h('button', {
              key: item.task.id,
              type: 'button',
              className: 'dshw-act-row',
              onClick: () => props.onSelectTask(item.task.id, project.id),
            },
              h('span', { className: 'dshw-act-dot dshw-act-dot--review' }),
              h('span', { className: 'dshw-act-title' }, item.task.title),
              h('span', { className: 'dshw-act-time dshw-mono' }, pendingLabel(t, props.pendingMap[item.task.sessionId]))))))
          : null,
        h(Card, null,
          h(CardHead, { title: t.lastActivity }),
          recent.length
            ? h('div', { className: 'dshw-acts' }, recent.map((item: any) => {
              const st = resolveStatus(item.snapshot.status, isRunning(item.task))
              return h('button', {
                key: item.task.id,
                type: 'button',
                className: 'dshw-act-row',
                onClick: () => props.onSelectTask(item.task.id, project.id),
              },
                h('span', { className: 'dshw-act-dot dshw-act-dot--' + st }),
                h('span', { className: 'dshw-act-title' }, item.task.title),
                h('span', { className: 'dshw-act-time dshw-mono' }, relTime(item.task.updatedAt || item.task.createdAt, t)))
            }))
            : h('div', { className: 'dshw-hint' }, t.noTasks))))

    const settingsBody = h('div', { className: 'dshw-stage-body' },
      h('div', { className: 'dshw-measure' },
        h(Card, null,
          h(CardHead, { icon: 'sliders', title: t.projectSettings }),
          h('p', { className: 'dshw-card-sub' }, t.projectSettingsHint),
          h('form', { onSubmit: (e: any) => { e.preventDefault(); save() } },
            h('div', { className: 'dshw-form-rows' },
              h('div', { className: 'dshw-form-row' },
                h('label', { htmlFor: 'dshw-project-name' }, t.projectName),
                h('div', null,
                  h('input', {
                    id: 'dshw-project-name',
                    className: cx('dshw-input', nameError && 'dshw-invalid'),
                    value: name,
                    'aria-invalid': nameError ? 'true' : 'false',
                    'aria-describedby': nameError ? 'dshw-project-name-error' : undefined,
                    onChange: (e: any) => { setName(e.target.value); setNameError('') },
                  }),
                  nameError ? h('div', { className: 'dshw-err', id: 'dshw-project-name-error', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, nameError)) : null)),
              h('div', { className: 'dshw-form-row' },
                h('label', { htmlFor: 'dshw-project-base' }, t.defaultBase),
                h('div', null,
                  branchControl,
                  branchHint ? h('div', { className: 'dshw-hint' }, branchHint) : null)),
              h('div', { className: 'dshw-form-row' },
                h('label', { htmlFor: 'dshw-project-prefix' }, t.branchPrefix),
                h('div', null,
                  h('input', {
                    id: 'dshw-project-prefix',
                    className: 'dshw-input dshw-mono',
                    value: branchPrefix,
                    placeholder: 'dsh-wt/',
                    onChange: (e: any) => setBranchPrefix(e.target.value),
                  }),
                  h('div', { className: 'dshw-hint' }, t.branchPrefixHint))),
              h('div', { className: 'dshw-form-row' },
                h('label', { htmlFor: 'dshw-project-dir' }, t.worktreeDirName),
                h('div', null,
                  h('input', {
                    id: 'dshw-project-dir',
                    className: 'dshw-input dshw-mono',
                    value: dirName,
                    placeholder: cfg.dirName || DEFAULT_WORKTREE_DIR,
                    onChange: (e: any) => setDirName(e.target.value),
                  }),
                  h('div', { className: 'dshw-hint' }, t.worktreeDirHint))),
              h('div', { className: 'dshw-form-row' },
                h('div', { className: 'dshw-form-label' }, t.mergeGate),
                h('div', null,
                  h(Checkbox, {
                    className: 'dshw-check',
                    checked: mergeGateOn,
                    onChange: (next: boolean) => setMergeGateOn(next),
                    label: h('span', { className: 'dshw-check-copy' }, t.mergeGateCriteria),
                  }),
                  h('div', { className: 'dshw-hint' }, t.mergeGateHint)))),
            h('div', { className: 'dshw-form-foot' },
              h(Btn, { variant: 'primary', type: 'submit', disabled: busy !== '' }, busy === 'save' ? h(Spinner) : null, busy === 'save' ? t.saving : t.save),
              h('span', { className: 'dshw-save-state', role: 'status' }, msg ? [h(Icon, { key: 'i', name: 'check' }), h('span', { key: 's' }, msg)] : null)),
            err ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err)) : null))))

    const inspector = h('aside', { className: 'dshw-inspector' },
      h(Card, { danger: true },
        h(CardHead, { icon: 'alert', title: t.deleteProject }),
        h('p', { className: 'dshw-card-sub' }, t.deleteProjectCardHint),
        reviewingTasks.length
          ? h('div', { className: 'dshw-hint', style: { marginBottom: '8px' } }, h(Icon, { name: 'alert' }), h('span', null, t.reviewingBlockHint))
          : null,
        h(Btn, { variant: 'danger', icon: 'trash', disabled: busy !== '' || reviewingTasks.length > 0, onClick: openDelete }, t.deleteProject)))

    return h('div', { className: 'dshw-detail-inner dshw-stage-grid' },
      h('div', { className: 'dshw-stage' }, topbar, stageHead, tab === 'settings' ? settingsBody : overviewBody),
      inspector,
      deleteModal)
  }


