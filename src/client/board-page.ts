import { React, h, useStyles } from './ui'
import { Btn, Banner, Empty, Icon, IconBtn, Spinner, Toast } from './primitives'
import { AddProjectModal, PublishModal } from './modals'
import { PublishTargetModal, findPublishedTask, resolvePublishEntry } from './publish-flow'
import { useToast } from './hooks'
import { TaskDetail } from './task-detail'
import { TaskRow } from './task-row'
import { ProjectDetail } from './project-detail'
import { visibleProjectViews } from './board-data'
import { AttentionFilter } from './attention-filter'
import { AttentionSummaryBar } from './attention-summary'
import { RECOVERY_UI_READY, computeFilterCounts, deriveTaskAttention } from './task-attention'
import { appCtx, bindSession, getJson } from './context'
import { uuid } from './format'
import { pendingLabel } from './status'
import { boardStore, useBoardStore } from './store/board-store'

function useHostSessionStatus() {
  const [sessionMap, setSessionMap] = React.useState({} as Record<string, boolean>)
  const [pendingMap, setPendingMap] = React.useState({} as Record<string, string>)

  React.useEffect(() => {
    try {
      const svc = appCtx?.get?.('uiSession')
      if (!svc?.sessionStatus) return
      const sync = () => {
        try {
          const snap = svc.sessionStatus.getSnapshot()
          const nextPending: Record<string, string> = {}
          const nextRunning: Record<string, boolean> = {}
          for (const [id, st] of snap) {
            const kind = st?.pendingInteraction?.kind
            if (kind === 'approval' || kind === 'plan-review' || kind === 'question') nextPending[id] = kind
            nextRunning[id] = !!st?.running
          }
          setPendingMap(nextPending)
          setSessionMap(nextRunning)
        } catch { /* noop */ }
      }
      sync()
      return svc.sessionStatus.subscribe(sync)
    } catch {
      return undefined
    }
  }, [])

  return { sessionMap, pendingMap }
}

function projectColor(id: string): string {
  let n = 0
  for (let i = 0; i < id.length; i += 1) n = (n * 31 + id.charCodeAt(i)) | 0
  return ['blue', 'purple', 'green', 'orange'][Math.abs(n) % 4]
}

export function BoardPage(props: any) {
  const t = props.__t
  useStyles()

  const state = useBoardStore((s) => s)
  const { sessionMap, pendingMap } = useHostSessionStatus()
  const { toast, notify, dismiss } = useToast()

  const [publishFor, setPublishFor] = React.useState(null as any)
  const [publishParent, setPublishParent] = React.useState(null as any)
  const [publishEntryOpen, setPublishEntryOpen] = React.useState(false)
  const [publishEntryPending, setPublishEntryPending] = React.useState(false)
  const [publishDraft, setPublishDraft] = React.useState(null as any)
  const [projectModalOpen, setProjectModalOpen] = React.useState(false)
  const [detailFocus, setDetailFocus] = React.useState(null as any)

  const searchRef = React.useRef(null as any)
  const shellRef = React.useRef(null as any)
  const detailRef = React.useRef(null as any)
  const bindingRef = React.useRef(new Set<string>())
  const remotes = appCtx?.remote

  React.useEffect(() => {
    if (!remotes?.session || publishFor) return
    for (const pv of state.projectViews) {
      for (const v of pv.tasks) {
        const task = v.task
        if (task.sessionId || task.startOnBind === false || v.snapshot.status === 'cleaned') continue
        if (bindingRef.current.has(task.id)) continue
        bindingRef.current.add(task.id)
        bindSession(remotes, task, pv.project.name)
          .then(() => void boardStore.refresh(false, t))
          .catch(() => bindingRef.current.delete(task.id))
      }
    }
  }, [state.projectViews, remotes, publishFor])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (projectModalOpen || publishFor) return
      const active: any = document.activeElement
      const shell: any = shellRef.current
      if (!shell || !(active === shell || shell.contains(active))) return
      const typing = active && (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || active.isContentEditable)
      if (!typing && (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'))) {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'Escape' && active === searchRef.current && state.query) {
        boardStore.setQuery('')
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [state.query, projectModalOpen, publishFor])

  React.useEffect(() => {
    if (detailRef.current) detailRef.current.scrollTop = 0
  }, [state.selectedTaskId, state.selectedProjectId])

  const allTasks = state.projectViews.flatMap((pv) => pv.tasks)
  const attentionStale = !!state.error
  const attentionMap = new Map<string, any>()
  for (const v of allTasks) {
    attentionMap.set(v.task.id, deriveTaskAttention({
      task: v.task,
      snapshot: v.snapshot,
      pendingKind: v.task.sessionId ? pendingMap[v.task.sessionId] : null,
      running: v.task.sessionId ? !!sessionMap[v.task.sessionId] : null,
      health: null,
      repoLockLabel: state.repoBusy[v.task.repoPath] || '',
      stale: attentionStale,
    }))
  }
  const attnOf = (v: any) => attentionMap.get(v.task.id)
  const shownViews = visibleProjectViews(state.projectViews, state.showArchived)
  const archivedCount = allTasks.filter((v) => !!v.task.archivedAt).length
  const visibleTasks = shownViews.flatMap((pv) => pv.tasks)
  const filterCounts = computeFilterCounts(visibleTasks, allTasks, attnOf, RECOVERY_UI_READY)

  const selectedProject =
    shownViews.find((pv) => pv.project.id === state.selectedProjectId) ||
    state.projectViews.find((pv) => pv.project.id === state.selectedProjectId) ||
    null
  const selectedTask = allTasks.find((v) => v.task.id === state.selectedTaskId) || null

  const openTaskSession = (sessionId: string) => {
    try {
      const uiws = appCtx?.get?.('uiWorkspace')
      if (uiws && typeof uiws.openSession === 'function') {
        uiws.openSession(sessionId)
        return true
      }
    } catch { /* noop */ }
    return false
  }

  const createTaskSession = async (v: any) => {
    if (!remotes?.session) throw new Error(t.failed)
    const owner = state.projectViews.find((pv) => pv.project.id === v.task.projectId)
    const sessionId = await bindSession(remotes, v.task, owner?.project.name, true)
    if (!openTaskSession(sessionId)) boardStore.selectTask(v.task.id, owner?.project.id)
    return sessionId
  }

  const startBoundSession = async (v: any) => {
    if (!remotes?.session || !v.task.sessionId) throw new Error(t.failed)
    const text = String(v.task.firstPrompt || v.task.description || '').trim()
    if (!text) throw new Error(t.failed)
    const sent = await remotes.session.prompt({
      requestId: uuid(),
      sessionId: v.task.sessionId,
      mode: 'queue',
      content: [{ type: 'text', text }],
    })
    if (sent && sent.ok === false) throw new Error(String(sent.error?.message || t.failed))
    if (!openTaskSession(v.task.sessionId)) boardStore.selectTask(v.task.id, v.task.projectId)
    await boardStore.refresh(false, t)
  }

  const openPublishEntry = () => {
    const action = resolvePublishEntry(selectedProject?.project, state.projectViews.length)
    if (action === 'form') { setPublishParent(null); setPublishFor(selectedProject!.project); return }
    if (action === 'add') { setPublishEntryPending(true); setProjectModalOpen(true); return }
    setPublishEntryOpen(true)
  }

  const handleQuick = (action: string, view: any, projectId: string) => {
    if (action === 'handle' || action === 'open-session') {
      if (view.task.sessionId && !openTaskSession(view.task.sessionId)) notify(t.openSessionFailed, 'error')
      return
    }
    if (action === 'review' || action === 'recover') {
      boardStore.selectTask(view.task.id, projectId)
      setDetailFocus({ section: action === 'recover' ? 'recovery' : 'acceptance', token: Date.now() })
    }
  }

  const q = state.query.trim().toLowerCase()
  const filterActive = state.attentionFilter !== 'all'
  const baseViews = state.attentionFilter === 'recovery' ? visibleProjectViews(state.projectViews, true) : shownViews
  const filtered = baseViews.map((pv) => {
    const catTasks = filterActive
      ? pv.tasks.filter((v) => attnOf(v)?.categories.has(state.attentionFilter))
      : pv.tasks
    const nameHit = !q || pv.project.name.toLowerCase().includes(q) || pv.project.repoPath.toLowerCase().includes(q)
    const tasks = !q ? catTasks : catTasks.filter((v) => {
      const pending = v.task.sessionId ? pendingMap[v.task.sessionId] : null
      return nameHit
        || v.task.title.toLowerCase().includes(q)
        || (v.task.branch || '').toLowerCase().includes(q)
        || String(pendingLabel(t, pending) || '').toLowerCase().includes(q)
    })
    return { pv, tasks }
  }).filter((item) => item.tasks.length > 0 || (!q && !filterActive))

  const totalTasks = shownViews.reduce((sum, pv) => sum + pv.tasks.length, 0)

  const sidebar = h('section', { className: 'dshw-sidebar', 'aria-label': t.projects },
    state.env?.mergeTreeSupported === false
      ? h(Banner, { tone: 'warn', icon: 'alert', title: t.gitTooOldTitle }, t.gitTooOldHint)
      : null,
    h('header', { className: 'dshw-tree-head' },
      h('div', { className: 'dshw-search' },
        h(Icon, { name: 'search' }),
        h('input', {
          ref: searchRef,
          type: 'search',
          value: state.query,
          placeholder: t.search,
          autoComplete: 'off',
          'aria-label': t.search,
          onChange: (e: any) => boardStore.setQuery(e.target.value),
        })),
      h('div', { className: 'dshw-tree-tools' },
        h(AttentionFilter, { t, value: state.attentionFilter, counts: filterCounts, onChange: boardStore.setAttentionFilter }),
        h(Btn, { variant: 'primary', size: 'sm', icon: 'plus', onClick: openPublishEntry }, t.publish),
        h(IconBtn, {
          icon: 'refresh',
          label: t.refresh,
          disabled: state.refreshing,
          onClick: () => void boardStore.refresh(true, t).then(() => notify(t.refreshed)),
        }, state.refreshing ? h(Spinner) : null),
        archivedCount > 0
          ? h(IconBtn, {
            icon: 'archive',
            label: state.showArchived ? t.hideArchived : t.showArchived,
            className: state.showArchived ? 'dshw-icon-btn--on' : undefined,
            onClick: boardStore.toggleArchived,
          })
          : null,
        h(IconBtn, { icon: 'plus', label: t.addProject, onClick: () => setProjectModalOpen(true) }))),
    h('div', { className: 'dshw-tree-scroll' },
      !state.loaded
        ? h('div', { className: 'dshw-tree-empty' }, h(Spinner))
        : filtered.length === 0
          ? h('div', { className: 'dshw-tree-empty' },
            h(Icon, { name: state.projectViews.length === 0 ? 'folder' : 'search' }),
            h('p', null, state.projectViews.length === 0 ? t.noProjectsHint : t.noMatchHint),
            state.projectViews.length === 0
              ? h(Btn, { variant: 'primary', size: 'sm', icon: 'plus', onClick: () => setProjectModalOpen(true) }, t.addProject)
              : h(Btn, { size: 'sm', onClick: () => { boardStore.setQuery(''); boardStore.setAttentionFilter('all') } }, t.clearFilter))
          : h('div', { role: 'list' }, filtered.map(({ pv, tasks }) => {
            const isOpen = filterActive || !!q || !state.collapsed[pv.project.id]
            const activeProject = state.selectedProjectId === pv.project.id && !state.selectedTaskId
            return h('div', { key: pv.project.id, role: 'listitem' },
              h('div', { className: 'dshw-project' + (activeProject ? ' dshw-project--on' : ''), 'data-open': isOpen ? 'true' : 'false' },
                h('button', { className: 'dshw-project-toggle', type: 'button', onClick: () => boardStore.toggleCollapse(pv.project.id) }, h(Icon, { name: 'chevronDown' })),
                h('button', { className: 'dshw-project-select', type: 'button', title: pv.project.repoPath, onClick: () => boardStore.selectProject(pv.project.id) },
                  h('span', { className: 'dshw-folder-tile dshw-folder-tile--' + projectColor(pv.project.id) }, h(Icon, { name: 'folder' })),
                  h('span', { className: 'dshw-project-name' }, pv.project.name),
                  h('span', { className: 'dshw-project-count' }, String(tasks.length))),
                h('button', { className: 'dshw-project-add', type: 'button', title: t.addTask, onClick: () => { setPublishFor(pv.project); boardStore.selectProject(pv.project.id) } }, h(Icon, { name: 'plus' }))),
              isOpen
                ? tasks.length
                  ? h('div', { className: 'dshw-task-list', role: 'list' }, tasks.map((v) =>
                    h(TaskRow, {
                      key: v.task.id,
                      t,
                      view: v,
                      attention: attnOf(v),
                      active: state.selectedTaskId === v.task.id,
                      running: v.task.sessionId ? !!sessionMap[v.task.sessionId] : null,
                      pendingKind: v.task.sessionId ? pendingMap[v.task.sessionId] : null,
                      onSelect: (view: any) => boardStore.selectTask(view.task.id, pv.project.id),
                      onQuick: (action: string, view: any) => handleQuick(action, view, pv.project.id),
                    })))
                  : h('div', { className: 'dshw-tree-inline-empty' }, h('span', null, t.noTasks))
                : null)
          }))),
    h('footer', { className: 'dshw-tree-foot' },
      h('span', null, `${state.projectViews.length} ${t.projectUnit} · ${totalTasks} ${t.taskUnit}`),
      h('span', null, 'worktree')))

  const detailBody = selectedTask
    ? h(TaskDetail, {
      key: selectedTask.task.id,
      view: selectedTask,
      project: selectedProject?.project ?? null,
      running: selectedTask.task.sessionId ? !!sessionMap[selectedTask.task.sessionId] : null,
      pendingKind: selectedTask.task.sessionId ? pendingMap[selectedTask.task.sessionId] : null,
      t,
      notify,
      onChanged: () => boardStore.refresh(false, t),
      onOpenSession: selectedTask.task.sessionId ? () => openTaskSession(selectedTask.task.sessionId!) : undefined,
      onCreateSession: selectedTask.task.sessionId ? undefined : () => createTaskSession(selectedTask),
      onStartTask: selectedTask.task.sessionId ? () => startBoundSession(selectedTask) : undefined,
      parentView: selectedTask.task.parentId ? (allTasks.find((v) => v.task.id === selectedTask.task.parentId) || null) : null,
      followUps: allTasks.filter((v) => v.task.parentId === selectedTask.task.id),
      siblings: allTasks.filter((v) => v.task.id !== selectedTask.task.id && v.task.repoPath.toLowerCase() === selectedTask.task.repoPath.toLowerCase()),
      repoLockLabel: state.repoBusy[selectedTask.task.repoPath] || '',
      focusSection: detailFocus?.section,
      focusToken: detailFocus?.token,
      onRepoBusy: (active: boolean, label: string) => boardStore.setRepoBusy(selectedTask.task.repoPath, active, label),
      onContinue: () => { if (selectedProject) { setPublishParent({ view: selectedTask }); setPublishFor(selectedProject.project) } },
      onSelectTask: (id: string) => boardStore.selectTask(id),
    })
    : selectedProject
      ? h(ProjectDetail, {
        key: selectedProject.project.id,
        view: selectedProject,
        cfg: state.cfg,
        pendingMap,
        sessionMap,
        t,
        notify,
        onChanged: () => boardStore.refresh(false, t),
        onPublish: (project: any) => setPublishFor(project),
        onSelectTask: boardStore.selectTask,
        onDeleted: () => { boardStore.setShowDetail(false); void boardStore.refresh(false, t) },
      })
      : h(Empty, { title: t.selectTask, icon: 'file', className: 'dshw-detail-empty' })

  return h('div', { className: 'dshw-scope dshw-shell', ref: shellRef },
    h(AttentionSummaryBar, {
      t,
      counts: filterCounts,
      total: filterCounts.total,
      stale: attentionStale,
      lastOkAt: state.lastOkAt,
      onView: boardStore.setAttentionFilter,
    }),
    h('div', { className: 'dshw-app' + (state.showDetail ? ' dshw-app--detail' : '') },
      sidebar,
      h('main', { className: 'dshw-detail' },
        h('div', { className: 'dshw-detail-scroll', ref: detailRef },
          h('div', { className: 'dshw-detail-inner' },
            selectedTask || selectedProject
              ? h('div', { className: 'dshw-mobile-bar' }, h(Btn, { size: 'sm', icon: 'arrowLeft', onClick: () => boardStore.setShowDetail(false) }, t.backToList))
              : null,
            detailBody))),
      publishFor
        ? h(PublishModal, {
          t,
          project: publishFor,
          cfg: state.cfg,
          parentView: publishParent?.view,
          draft: publishDraft,
          onDraft: setPublishDraft,
          onBackToProject: () => { setPublishFor(null); setPublishParent(null); setPublishEntryOpen(true) },
          onCheckPublished: async (info: any) => {
            const d: any = await getJson('projects?includeArchived=1')
            const pv = (d?.projects || []).find((p: any) => p.project.id === info.projectId)
            return pv ? findPublishedTask(pv.tasks.map((v: any) => v.task), info) : null
          },
          onClose: () => { setPublishFor(null); setPublishParent(null) },
          onRefresh: () => void boardStore.refresh(false, t),
          onError: (msg: string) => notify(msg, 'error'),
          onPublished: (task: any, project: any, warning?: string) => {
            setPublishFor(null)
            setPublishParent(null)
            setPublishDraft(null)
            if (task?.id) boardStore.optimisticPublish(task, project?.id)
            void boardStore.refresh(false, t)
            notify(warning || String(t.published).replace('{branch}', task?.branch || ''), warning ? 'error' : 'ok')
          },
        })
        : null,
      publishEntryOpen
        ? h(PublishTargetModal, {
          t,
          projects: state.projectViews.map((pv) => pv.project),
          onPick: (project: any) => { setPublishEntryOpen(false); setPublishFor(project) },
          onAddProject: () => { setPublishEntryPending(true); setProjectModalOpen(true) },
          onClose: () => { setPublishEntryOpen(false); setPublishEntryPending(false) },
        })
        : null,
      projectModalOpen
        ? h(AddProjectModal, {
          t,
          onClose: () => setProjectModalOpen(false),
          onAdded: (project: any) => {
            setProjectModalOpen(false)
            if (project?.id) {
              boardStore.selectProject(project.id)
              notify(String(t.projectAdded).replace('{name}', project.name))
              if (publishEntryPending) {
                setPublishEntryPending(false)
                setPublishEntryOpen(false)
                setPublishFor(project)
              }
            }
            void boardStore.refresh(false, t)
          },
        })
        : null),
    h(Toast, { toast, onClose: dismiss }))
}

export function BoardIcon() {
  return h('svg', { viewBox: '0 0 24 24', width: 22, height: 22, 'aria-hidden': true, style: { color: 'currentColor' } },
    h('circle', { cx: 7, cy: 6, r: 3, fill: 'currentColor' }),
    h('circle', { cx: 7, cy: 18, r: 3, fill: 'currentColor' }),
    h('circle', { cx: 17, cy: 12, r: 3, fill: 'currentColor', opacity: 0.75 }),
    h('path', { d: 'M7 9v6', stroke: 'currentColor', strokeWidth: 2, fill: 'none', strokeLinecap: 'round' }),
    h('path', { d: 'M9.5 7.5c4 1.5 5.5 2.5 6.2 4', stroke: 'currentColor', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', opacity: 0.75 }))
}
