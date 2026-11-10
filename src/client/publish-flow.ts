import { React, h } from './ui'
import { Btn, Icon, Modal } from './primitives'

/** Decide what the text publish entry should do next. */
export function resolvePublishEntry(selectedProject: any, projectCount: number): 'form' | 'picker' | 'add' {
  if (selectedProject) return 'form'
  if (!projectCount || projectCount <= 0) return 'add'
  return 'picker'
}

/** Match a published task after an unknown-result timeout (branch then title). */
export function findPublishedTask(tasks: any[], info: { branchName?: string; title?: string }): any | null {
  const list = Array.isArray(tasks) ? tasks : []
  const branch = info && info.branchName ? String(info.branchName) : ''
  const title = info && info.title ? String(info.title) : ''
  return list.find((task) => (branch && task.branch === branch) || (!branch && title && task.title === title)) || null
}

/**
 * Step 1 of the text "publish" entry when no project/task is selected: pick the
 * target project. Reuses the same PublishModal afterwards; never guesses.
 */
export function PublishTargetModal(props: any) {
  const t = props.t
  const projects: any[] = Array.isArray(props.projects) ? props.projects : []
  const [query, setQuery] = React.useState('')
  const q = query.trim().toLowerCase()
  const filtered = !q
    ? projects
    : projects.filter((p) =>
      String(p.name || '').toLowerCase().includes(q) || String(p.repoPath || '').toLowerCase().includes(q))

  return h(Modal, {
    t,
    title: t.selectProjectTitle,
    subtitle: t.selectProjectHint,
    icon: 'folder',
    size: 'lg',
    busy: false,
    onClose: props.onClose,
    footer: [
      projects.length
        ? h(Btn, { key: 'add', icon: 'plus', onClick: () => props.onAddProject && props.onAddProject() }, t.addProject)
        : h(Btn, { key: 'add', variant: 'primary', icon: 'plus', onClick: () => props.onAddProject && props.onAddProject() }, t.addProject),
      h(Btn, { key: 'cancel', onClick: props.onClose, 'data-autofocus': true }, t.cancel),
    ],
  },
    projects.length
      ? h('div', null,
        h('input', {
          className: 'dshw-input',
          value: query,
          placeholder: t.selectProjectSearch,
          autoComplete: 'off',
          'data-autofocus': true,
          onChange: (e: any) => setQuery(e.target.value),
        }),
        filtered.length
          ? h('div', { className: 'dshw-pick-list', role: 'list' }, filtered.map((project: any) =>
            h('button', {
              key: project.id,
              type: 'button',
              className: 'dshw-pick-item',
              onClick: () => props.onPick && props.onPick(project),
            },
              h('span', { className: 'dshw-folder-tile dshw-folder-tile--blue' }, h(Icon, { name: 'folder' })),
              h('span', { className: 'dshw-pick-main' },
                h('span', { className: 'dshw-pick-name' }, project.name),
                h('span', { className: 'dshw-pick-path' }, project.repoPath)))))
          : h('div', { className: 'dshw-hint', style: { marginTop: '10px' } }, t.selectProjectEmpty))
      : h('div', { className: 'dshw-tree-empty' },
        h('div', { className: 'dshw-empty-icon' }, h(Icon, { name: 'folder' })),
        h('h3', null, t.noProjects),
        h('p', null, t.selectProjectNoProjectHint)))
}
