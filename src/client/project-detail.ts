import { React, h } from './ui'
import { Btn, BranchCombobox, Checkbox, Field, Icon, Modal, Spinner, TextInput } from './primitives'
import { useBranchInfo } from './hooks'
import { post, postLong } from './context'
import { copyText, relTime } from './format'

export function ProjectDetail(props: any) {
  const { view, cfg = {}, t, notify, onChanged, onPublish, onSelectTask, onDeleted } = props
  const project = view.project
  const stats = view.stats || { tasks: 0, byStatus: {}, running: 0 }
  const tasks: any[] = view.tasks || []

  const branches = useBranchInfo(project.repoPath)
  const [name, setName] = React.useState(project.name || '')
  const [baseBranch, setBaseBranch] = React.useState(project.baseBranch || '')
  const [dirName, setDirName] = React.useState(project.dirName || '')
  const [branchPrefix, setBranchPrefix] = React.useState(project.branchPrefix || '')
  const [saving, setSaving] = React.useState(false)
  const [delOpen, setDelOpen] = React.useState(false)
  const [withTasks, setWithTasks] = React.useState(false)
  const [withWorktrees, setWithWorktrees] = React.useState(true)
  const [deleting, setDeleting] = React.useState(false)
  const [delErr, setDelErr] = React.useState('')

  React.useEffect(() => {
    setName(project.name || '')
    setBaseBranch(project.baseBranch || '')
    setDirName(project.dirName || '')
    setBranchPrefix(project.branchPrefix || '')
  }, [project.id, project.name, project.baseBranch, project.dirName, project.branchPrefix])

  const dirty =
    name.trim() !== (project.name || '') ||
    baseBranch.trim() !== (project.baseBranch || '') ||
    dirName.trim() !== (project.dirName || '') ||
    branchPrefix.trim() !== (project.branchPrefix || '')

  const save = async (e: any) => {
    e.preventDefault()
    if (saving || !dirty) return
    setSaving(true)
    try {
      await post('projects/update', {
        id: project.id,
        name: name.trim(),
        baseBranch: baseBranch.trim(),
        dirName: dirName.trim(),
        branchPrefix: branchPrefix.trim(),
      })
      notify(t.saved || '已保存')
      await onChanged?.()
    } catch (err: any) {
      notify(err?.message || t.failed, 'error')
    } finally {
      setSaving(false)
    }
  }

  const runDelete = async () => {
    if (deleting) return
    setDeleting(true)
    setDelErr('')
    try {
      await postLong('projects/delete', { id: project.id, withTasks, withWorktrees })
      setDelOpen(false)
      notify(t.deleted || '项目已删除')
      onDeleted?.()
    } catch (err: any) {
      setDelErr(err?.message || t.failed)
    } finally {
      setDeleting(false)
    }
  }

  const statCards = [
    { label: t.totalTasks || '全部任务', value: stats.tasks || 0, tone: 'neutral' },
    { label: t.statusDeveloping || '开发中', value: stats.running || 0, tone: 'info' },
    { label: t.statusReview || '待验收', value: (stats.byStatus?.review || 0) + (stats.byStatus?.reviewing || 0), tone: 'warn' },
    { label: t.statusMerged || '已合并', value: stats.byStatus?.merged || 0, tone: 'ok' },
  ]

  return h('div', { className: 'dshw-detail-inner dshw-proj-detail' },
    h('header', { className: 'dshw-detail-head' },
      h('div', { className: 'dshw-detail-title-wrap' },
        h('div', { className: 'dshw-detail-kicker' },
          h(Icon, { name: 'folder' }),
          h('span', null, t.projects || '项目'),
          h('span', { className: 'dshw-sep' }, '·'),
          h('span', null, `${t.baseBranch || '基线'}: ${project.baseBranch || '—'}`)),
        h('h1', { className: 'dshw-detail-title' }, project.name),
        h('div', { className: 'dshw-detail-path' },
          h('code', null, project.repoPath),
          h('button', {
            type: 'button',
            className: 'dshw-link-btn',
            onClick: () => void copyText(project.repoPath).then((ok) => ok && notify(t.copied || '已复制')),
          }, h(Icon, { name: 'copy' })))),
      h('div', { className: 'dshw-detail-actions' },
        h(Btn, { variant: 'primary', icon: 'plus', onClick: () => onPublish?.(project) }, t.publish || '发布任务'),
        h(Btn, { variant: 'danger', icon: 'trash', onClick: () => { setDelErr(''); setDelOpen(true) } }, t.delete || '删除'))),

    h('section', { className: 'dshw-stat-grid' },
      statCards.map((c) => h('div', { key: c.label, className: `dshw-stat-card dshw-stat-card--${c.tone}` },
        h('div', { className: 'dshw-stat-card__val' }, String(c.value)),
        h('div', { className: 'dshw-stat-card__label' }, c.label)))),

    h('section', { className: 'dshw-card' },
      h('div', { className: 'dshw-card__head' },
        h('h2', null, t.tasks || '任务列表'),
        h('span', { className: 'dshw-muted' }, `${tasks.length} ${t.taskUnit || '项'}`)),
      tasks.length === 0
        ? h('div', { className: 'dshw-card__empty' }, t.noTasks || '暂无任务')
        : h('div', { className: 'dshw-mini-list' }, tasks.slice(0, 12).map((v) =>
          h('button', {
            key: v.task.id,
            type: 'button',
            className: 'dshw-mini-row',
            onClick: () => onSelectTask?.(v.task.id, project.id),
          },
            h('span', { className: `dshw-badge dshw-badge--${v.snapshot.status}` }, v.snapshot.status),
            h('span', { className: 'dshw-mini-row__title' }, v.task.title),
            h('code', { className: 'dshw-mini-row__branch' }, v.task.branch),
            h('span', { className: 'dshw-mini-row__time' }, relTime(v.task.updatedAt, t)))))),

    h('form', { className: 'dshw-card', onSubmit: save },
      h('div', { className: 'dshw-card__head' },
        h('h2', null, t.projectSettings || '项目配置'),
        h(Btn, { variant: 'primary', size: 'sm', type: 'submit', disabled: !dirty || saving }, saving ? h(Spinner) : null, t.save || '保存')),
      h('div', { className: 'dshw-form-grid' },
        h(Field, { id: 'dshw-proj-name', label: t.projectName || '项目名称' },
          h(TextInput, { value: name, onChange: (e: any) => setName(e.target.value) })),
        h(Field, { id: 'dshw-proj-base', label: t.defaultBase || '默认基线分支' },
          branches.data
            ? h(BranchCombobox, { t, value: baseBranch, onChange: setBaseBranch, branchInfo: branches.data, id: 'dshw-proj-base' })
            : h(TextInput, { value: baseBranch, onChange: (e: any) => setBaseBranch(e.target.value) })),
        h(Field, { id: 'dshw-proj-dir', label: t.worktreeDir || 'Worktree 目录名' },
          h(TextInput, { value: dirName, placeholder: cfg.dirName || '.dsh-worktrees', onChange: (e: any) => setDirName(e.target.value) })),
        h(Field, { id: 'dshw-proj-prefix', label: t.branchPrefix || '分支前缀' },
          h(TextInput, { value: branchPrefix, placeholder: cfg.branchPrefix || 'dsh-wt/', onChange: (e: any) => setBranchPrefix(e.target.value) })))),

    delOpen
      ? h(Modal, {
        t,
        title: t.deleteProject || '删除项目',
        icon: 'trash',
        tone: 'danger',
        size: 'sm',
        busy: deleting,
        onClose: () => { if (!deleting) setDelOpen(false) },
        footer: [
          h(Btn, { key: 'c', onClick: () => setDelOpen(false), disabled: deleting }, t.cancel || '取消'),
          h(Btn, { key: 'ok', variant: 'danger', disabled: deleting, onClick: () => void runDelete() }, deleting ? h(Spinner) : null, t.delete || '确认删除'),
        ],
      },
        h('p', { className: 'dshw-muted' }, `${project.name} (${project.repoPath})`),
        tasks.length > 0
          ? h(Checkbox, { checked: withTasks, onChange: setWithTasks, label: `${t.deleteWithTasks || '同时删除项目下所有任务'} (${tasks.length})` })
          : null,
        tasks.length > 0 && withTasks
          ? h(Checkbox, { checked: withWorktrees, onChange: setWithWorktrees, label: t.deleteWithWorktrees || '一并清理磁盘上的 Worktree 目录' })
          : null,
        delErr ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, delErr)) : null)
      : null)
}
