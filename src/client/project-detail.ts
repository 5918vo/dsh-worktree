import { React, h } from './ui'
import { Banner, Btn, Card, CardHead, Checkbox, CopyBtn, Icon, KV, MenuItem, Modal, Spinner, Stat, BranchCombobox, TextInput } from './primitives'
import { useBranchInfo } from './hooks'
import { post } from './context'
import { copyText, cx, relTime } from './format'
import { resolveStatus } from './status'

export function ProjectDetail(props: any) {
    const t = props.t
    const v = props.view
    const project = v.project
    const cfg = props.cfg || {}
    const [name, setName] = React.useState(project.name)
    const [baseBranch, setBaseBranch] = React.useState(project.baseBranch || '')
    const [dirName, setDirName] = React.useState(project.dirName || '')
    const [branchPrefix, setBranchPrefix] = React.useState(project.branchPrefix || '')
    const branches = useBranchInfo(project.repoPath)
    const [deleteOpen, setDeleteOpen] = React.useState(false)
    const [withTasks, setWithTasks] = React.useState(false)
    const [withWorktrees, setWithWorktrees] = React.useState(true)
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
    const counts = { total: v.tasks.length, active: 0, review: 0, merged: 0 }
    for (const item of v.tasks) {
      const status = resolveStatus(item.snapshot.status, isRunning(item.task))
      if (status === 'developing' || status === 'reviewing') counts.active += 1
      else if (status === 'review') counts.review += 1
      else if (status === 'merged') counts.merged += 1
    }
    const pendingTasks = v.tasks.filter((item: any) => item.task.sessionId && props.pendingMap && props.pendingMap[item.task.sessionId])
    const firstPending = pendingTasks[0]
    const brokenTasks = v.tasks.filter((item: any) => resolveStatus(item.snapshot.status, isRunning(item.task)) === 'broken')
    const attentionCount = pendingTasks.length + brokenTasks.length
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
        })
        setMsg(t.saved)
        if (saveTimer.current) window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(() => setMsg(''), 3200)
      })
    }

    React.useEffect(() => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }, [])

    const remove = () => {
      void act('del', async () => {
        await post('projects/delete', { id: project.id, withTasks, withWorktrees: withTasks && withWorktrees })
        setDeleteOpen(false)
        props.onDeleted()
        props.notify(String(t.projectDeleted).replace('{name}', project.name))
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

    const deleteModal = deleteOpen
      ? h(Modal, {
        t,
        title: t.deleteProjectTitle,
        subtitle: project.name,
        icon: 'trash',
        tone: 'danger',
        size: 'sm',
        busy: busy === 'del',
        onClose: () => { if (busy !== 'del') setDeleteOpen(false) },
        footer: [
          h(Btn, { key: 'c', onClick: () => setDeleteOpen(false), disabled: busy === 'del', 'data-modal-autofocus': true }, t.cancel),
          h(Btn, {
            key: 'ok',
            variant: 'danger',
            disabled: busy === 'del' || (counts.total > 0 && !withTasks) || reviewingTasks.length > 0,
            onClick: remove,
          }, busy === 'del' ? h(Spinner) : null, busy === 'del' ? t.deleting : t.deleteProjectConfirm),
        ],
      },
        counts.total > 0
          ? h(Banner, { tone: 'warn', icon: 'alert', title: String(t.deleteProjectWarning).replace('{n}', String(counts.total)) }, t.deleteProjectWarningHint)
          : h(Banner, { tone: 'info', icon: 'info' }, t.deleteProjectWarningHint),
        reviewingTasks.length
          ? h(Banner, { tone: 'warn', icon: 'alert', title: t.reviewingBlockTitle }, t.reviewingBlockHint)
          : null,
        h('div', { className: 'dshw-info-table' },
          h(KV, { label: t.deleteProjectBase }, h('span', { className: 'dshw-mono' }, project.baseBranch))),
        counts.total > 0
          ? h(Checkbox, {
            className: 'dshw-check',
            checked: withTasks,
            onChange: (next: boolean) => setWithTasks(next),
            label: h('span', { className: 'dshw-check-copy' }, t.withTasks),
          })
          : null,
        counts.total > 0
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
          ? h('button', { type: 'button', className: 'dshw-btn dshw-btn--ghost dshw-btn--sm', title: props.railHidden ? t.expand : t.collapse, 'aria-label': props.railHidden ? t.expand : t.collapse, onClick: () => props.onToggleRail() }, '◧')
          : null,
        h('div', { className: 'dshw-breadcrumb' },
          h(Icon, { name: 'folder' }),
          h('strong', null, project.name),
          h('span', null, '/'),
          h('span', { className: 'dshw-mono' }, project.repoPath))),
      h('div', { className: 'dshw-topbar-right' },
        h('span', { className: 'dshw-mono', style: { fontSize: '11px', color: 'var(--dshw-text-3)' } }, counts.total + ' ' + t.taskUnit),
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
              h(MenuItem, { icon: 'copy', onClick: () => { void copyText(project.repoPath).then((ok) => props.notify(ok ? t.copied : t.copyFailed, ok ? 'ok' : 'error')) } }, t.copyRepoPath),
              h('div', { className: 'dshw-menu-sep' }),
              h(MenuItem, { icon: 'trash', danger: true, onClick: () => setDeleteOpen(true) }, t.deleteProject))))),
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
          h(Stat, { label: t.attentionStat, value: attentionCount, icon: 'alert', tone: 'warn' }),
          h(Stat, { label: t.activeTasks, value: counts.active, icon: 'terminal', tone: 'brand' }),
          h(Stat, { label: t.reviewTasks, value: counts.review, icon: 'clock', tone: 'warn' }),
          h(Stat, { label: t.mergedTasks, value: counts.merged, icon: 'branch', tone: 'success' })),
        pendingTasks.length
          ? h('div', { className: 'dshw-attention' },
            h(Icon, { name: 'clock' }),
            h('span', null, String(t.attention).replace('{n}', String(pendingTasks.length))),
            firstPending
              ? h('button', { type: 'button', className: 'dshw-link-btn', onClick: () => props.onSelectTask(firstPending.task.id, project.id) }, t.view)
              : null)
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
                    placeholder: '.dsh-worktrees',
                    onChange: (e: any) => setDirName(e.target.value),
                  }),
                  h('div', { className: 'dshw-hint' }, t.worktreeDirHint)))),
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
        h(Btn, { variant: 'danger', icon: 'trash', disabled: busy !== '' || reviewingTasks.length > 0, onClick: () => setDeleteOpen(true) }, t.deleteProject)))

    return h('div', { className: 'dshw-detail-inner dshw-stage-grid' },
      h('div', { className: 'dshw-stage' }, topbar, stageHead, tab === 'settings' ? settingsBody : overviewBody),
      inspector,
      deleteModal)
  }


