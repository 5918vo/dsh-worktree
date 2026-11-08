import { React, h, useStyles } from './ui'
import { Btn, Chip, Dot, Empty, Icon, IconBtn, Spinner, Toast } from './primitives'
import { AddProjectModal, PublishModal } from './modals'
import { useToast } from './hooks'
import { TaskDetail } from './task-detail'
import { ProjectDetail } from './project-detail'
import { appCtx, bindSession, getJson } from './context'
import { STATUS_TONE, pendingLabel, statusMeta } from './status'
import { buildHistoryEntries } from './timeline'

export function BoardPage(props: any) {
    const t = props.__t
    useStyles()
    const [projectViews, setProjectViews] = React.useState([])
    const [cfg, setCfg] = React.useState(null)
    const [loaded, setLoaded] = React.useState(false)
    const [refreshing, setRefreshing] = React.useState(false)
    const [err, setErr] = React.useState('')
    const [query, setQuery] = React.useState('')
    const [selectedProjectId, setSelectedProjectId] = React.useState('')
    const [selectedTaskId, setSelectedTaskId] = React.useState('')
    const [showDetail, setShowDetail] = React.useState(false)
    const [collapsed, setCollapsed] = React.useState({})
    const [publishFor, setPublishFor] = React.useState(null)
    const [projectModalOpen, setProjectModalOpen] = React.useState(false)
    const [sessionMap, setSessionMap] = React.useState({})
    const [pendingMap, setPendingMap] = React.useState({})
    const { toast, notify } = useToast()
    const bindingRef = React.useRef(new Set<string>())
    const searchRef = React.useRef(null)
    const detailRef = React.useRef(null)
    const shellRef = React.useRef(null)
    const failuresRef = React.useRef(0)
    const onlineRef = React.useRef(true)

    const remotes = appCtx && appCtx.remote

    const refresh = React.useCallback(async (manual?: boolean) => {
      if (manual) setRefreshing(true)
      try {
        const d = await getJson('projects')
        const list: any[] = d.projects || []
        setProjectViews(list)
        setSelectedTaskId((prev: string) => (prev && list.some((pv: any) => pv.tasks.some((v: any) => v.task.id === prev)) ? prev : ''))
        setSelectedProjectId((prev: string) => {
          if (prev && list.some((pv: any) => pv.project.id === prev)) return prev
          return list.length ? list[0].project.id : ''
        })
        failuresRef.current = 0
        onlineRef.current = true
        setErr('')
      } catch (e: any) {
        failuresRef.current += 1
        onlineRef.current = false
        const message = String((e && e.message) || '')
        const offline = !navigator.onLine || /failed to fetch|networkerror|load failed|network request failed|abort|timed out/i.test(message)
        setErr(offline ? t.connectionLost : message || t.loadFailed)
      } finally {
        setLoaded(true)
        if (manual) setRefreshing(false)
      }
    }, [])

    React.useEffect(() => {
      let cancelled = false
      let timer: any = null
      const tick = async () => {
        if (cancelled) return
        if (!document.hidden) await refresh()
        if (cancelled) return
        const failures = failuresRef.current
        const delay = failures ? Math.min(30000, 4000 * Math.pow(2, Math.min(failures, 3))) : 4000
        timer = window.setTimeout(tick, delay)
      }
      void tick()
      return () => {
        cancelled = true
        if (timer) window.clearTimeout(timer)
      }
    }, [refresh])

    React.useEffect(() => {
      getJson('config').then((d: any) => setCfg(d.config)).catch(() => {})
    }, [])

    // Auto-bind tasks published from tools (no session yet, start requested).
    React.useEffect(() => {
      try {
        if (!remotes || !remotes.session) return
        // A UI publish binds its own session; never let the poll race create a
        // second one while the publish modal is still working.
        if (publishFor) return
        for (const pv of projectViews) {
          for (const v of pv.tasks) {
            const task = v.task
            if (task.sessionId || task.startOnBind === false || v.snapshot.status === 'cleaned') continue
            if (bindingRef.current.has(task.id)) continue
            bindingRef.current.add(task.id)
            bindSession(remotes, task, pv.project.name)
              .then(() => { void refresh() })
              .catch(() => { bindingRef.current.delete(task.id) })
          }
        }
      } catch {
        /* remote service not ready */
      }
    }, [projectViews, remotes, refresh, publishFor])

    // Pending user interactions (approval / plan-review / question) per session —
    // the same source the sidebar's 等待审批 badge uses.
    React.useEffect(() => {
      try {
        const svc = appCtx && appCtx.get && appCtx.get('uiSession')
        if (!svc || !svc.sessionStatus) return
        const apply = () => {
          try {
            const snap = svc.sessionStatus.getSnapshot()
            const next: any = {}
            const running: any = {}
            for (const [id, st] of snap) {
              const kind = st && st.pendingInteraction && st.pendingInteraction.kind
              if (kind === 'approval' || kind === 'plan-review' || kind === 'question') next[id] = kind
              running[id] = !!(st && st.running)
            }
            setPendingMap(next)
            setSessionMap(running)
          } catch {
            /* noop */
          }
        }
        apply()
        const off = svc.sessionStatus.subscribe(apply)
        return () => {
          try {
            off()
          } catch {
            /* noop */
          }
        }
      } catch {
        /* uiSession not available */
      }
    }, [])

    // Last turn outcome per task session: an interrupted/failed run is a
    // session problem, not a Git problem, so it is surfaced next to the status.
    const [sessionHealth, setSessionHealth] = React.useState({} as Record<string, { kind: string; message?: string }>)
    const healthRef = React.useRef(sessionHealth)
    healthRef.current = sessionHealth
    const sessionIdsKey = React.useMemo(
      () => projectViews.flatMap((pv: any) => pv.tasks.map((v: any) => v.task.sessionId).filter(Boolean)).sort().join('|'),
      [projectViews],
    )
    React.useEffect(() => {
      const remote = remotes
      const ids = sessionIdsKey ? sessionIdsKey.split('|') : []
      if (!remote || !remote.session || !ids.length) {
        setSessionHealth({})
        return
      }
      let cancelled = false
      const pull = async () => {
        if (!onlineRef.current) return
        const next: Record<string, { kind: string; message?: string }> = {}
        await Promise.all(ids.map(async (sessionId: string) => {
          try {
            const stream = await remote.session.follow({
              address: { kind: 'session', sessionId },
              maxMessages: 1,
            })
            const iterator = stream && typeof stream[Symbol.asyncIterator] === 'function' ? stream[Symbol.asyncIterator]() : null
            if (!iterator) return
            let frame: any = null
            try {
              const first: any = await Promise.race([
                iterator.next(),
                new Promise((resolve) => setTimeout(() => resolve(null), 2000)),
              ])
              frame = first && first.done !== true ? first.value : null
            } finally {
              if (typeof iterator.return === 'function') {
                try {
                  await iterator.return()
                } catch {
                  /* stream already closed */
                }
              }
            }
            const events = frame && Array.isArray(frame.records) ? frame.records.map((r: any) => r.event || r).filter(Boolean) : []
            let lastEnd: any = null
            for (const event of events) if (event.type === 'turn/end') lastEnd = event
            const reason = lastEnd && lastEnd.data && lastEnd.data.reason
            const kind = reason && (reason.kind || reason.type)
            if (kind === 'interrupted') next[sessionId] = { kind: 'interrupted' }
            else if (kind === 'error' || kind === 'failed') next[sessionId] = { kind: 'error', message: reason.message || reason.error || '' }
          } catch {
            const previous = healthRef.current[sessionId]
            if (previous) next[sessionId] = previous
          }
        }))
        if (!cancelled) setSessionHealth(next)
      }
      void pull()
      const timer = setInterval(() => {
        if (!document.hidden) void pull()
      }, 12000)
      return () => {
        cancelled = true
        clearInterval(timer)
      }
    }, [sessionIdsKey, remotes])

    React.useEffect(() => {
      const onDocClick = (e: any) => {
        document.querySelectorAll('.dshw-menu[open]').forEach((menu: any) => {
          if (!menu.contains(e.target)) menu.removeAttribute('open')
        })
      }
      document.addEventListener('click', onDocClick)
      return () => document.removeEventListener('click', onDocClick)
    }, [])

    const runningOf = (task: any): boolean | null => {
      if (!task.sessionId) return null
      return !!sessionMap[task.sessionId]
    }

    const allTasks = projectViews.flatMap((pv: any) => pv.tasks)
    const selectedProject = projectViews.find((pv: any) => pv.project.id === selectedProjectId) || null
    const selectedTask = allTasks.find((v: any) => v.task.id === selectedTaskId) || null

    // Live session projections for the selected task's conversation (polled).
    const liveSessionId = selectedTask && selectedTask.task.sessionId ? String(selectedTask.task.sessionId) : ''
    const liveWorktreePath = selectedTask && selectedTask.task.worktreePath ? String(selectedTask.task.worktreePath) : ''
    const [live, setLive] = React.useState(null)
    const remotesRef = React.useRef(remotes)
    React.useEffect(() => {
      remotesRef.current = remotes
    })
    React.useEffect(() => {
      const remote = remotesRef.current
      if (!remote || !liveSessionId) {
        setLive(null)
        return
      }
      let cancelled = false
      const pull = async () => {
        if (!onlineRef.current) return
        try {
          const r = await remote.session.projections({ sessionId: liveSessionId })
          if (!cancelled && r && r.ok && r.value && r.value.values) setLive({ sessionId: liveSessionId, values: r.value.values })
        } catch {
          /* keep last */
        }
      }
      pull()
      const timer = setInterval(pull, 4000)
      return () => {
        cancelled = true
        clearInterval(timer)
      }
    }, [liveSessionId])
    const liveValues = live && live.sessionId === liveSessionId ? live.values : null

    // Full session timeline (reasoning, tool calls and results) for the live console.
    const [history, setHistory] = React.useState(null)
    React.useEffect(() => {
      const remote = remotesRef.current
      if (!remote || !remote.session || !liveSessionId) {
        setHistory(null)
        return
      }
      let cancelled = false
      const pull = async () => {
        if (!onlineRef.current) return
        try {
          const stream = await remote.session.follow({
            address: { kind: 'session', sessionId: liveSessionId },
            maxMessages: 24,
          })
          const iterator = stream && typeof stream[Symbol.asyncIterator] === 'function' ? stream[Symbol.asyncIterator]() : null
          if (!iterator) return
          let frame: any = null
          try {
            const first: any = await Promise.race([
              iterator.next(),
              new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
            ])
            frame = first && first.done !== true ? first.value : null
          } finally {
            if (typeof iterator.return === 'function') {
              try {
                await iterator.return()
              } catch {
                /* stream already closed */
              }
            }
          }
          if (cancelled || !frame || !Array.isArray(frame.records)) return
          setHistory({ sessionId: liveSessionId, entries: buildHistoryEntries(frame.records, 240, t, liveWorktreePath) })
        } catch {
          /* keep the last readable timeline */
        }
      }
      void pull()
      const timer = setInterval(() => {
        if (!document.hidden) void pull()
      }, 4000)
      return () => {
        cancelled = true
        clearInterval(timer)
      }
    }, [liveSessionId, liveWorktreePath])
    const historyEntries = history && history.sessionId === liveSessionId ? history.entries : null

    React.useEffect(() => {
      if (detailRef.current) detailRef.current.scrollTop = 0
    }, [selectedTaskId, selectedProjectId])

    // Keyboard: "/" or Ctrl/Cmd+K focuses search; Escape clears it.
    React.useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (projectModalOpen || publishFor) return
        const active: any = document.activeElement
        const shell: any = shellRef.current
        // Never hijack shortcuts typed into the host UI (chat composer, etc.).
        if (!shell || !(active === shell || shell.contains(active))) return
        const typing = active && (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || active.isContentEditable)
        if (!typing && (e.key === '/' || ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k'))) {
          e.preventDefault()
          if (searchRef.current) (searchRef.current as any).focus()
          return
        }
        if (e.key === 'Escape') {
          const openMenu: any = document.querySelector('.dshw-menu[open]')
          if (openMenu) {
            e.preventDefault()
            const summary = openMenu.querySelector('summary')
            openMenu.removeAttribute('open')
            if (summary) summary.focus()
            return
          }
        }
        if (e.key === 'Escape' && active === searchRef.current && query) {
          setQuery('')
        }
      }
      document.addEventListener('keydown', onKey)
      return () => document.removeEventListener('keydown', onKey)
    }, [query, projectModalOpen, publishFor])

    const selectProject = (id: string) => {
      setSelectedProjectId(id)
      setSelectedTaskId('')
      setShowDetail(true)
      setCollapsed((c: any) => ({ ...c, [id]: false }))
    }
    const selectTask = (id: string, projectId?: string) => {
      const found = allTasks.find((v: any) => v.task.id === id)
      const owner = projectId
        || (found && found.task.projectId)
        || (found ? ((projectViews.find((pv: any) => pv.tasks.some((v: any) => v.task.id === id)) || {}).project || {}).id : '')
        || ''
      setSelectedTaskId(id)
      setSelectedProjectId(owner)
      setShowDetail(true)
      if (owner) setCollapsed((c: any) => ({ ...c, [owner]: false }))
    }
    const toggleCollapse = (id: string) => setCollapsed((c: any) => ({ ...c, [id]: !c[id] }))

    /** Jump to the task's conversation in the left workspace (native navigation). */
    const openTaskSession = (sessionId: string) => {
      try {
        const uiws = appCtx && appCtx.get && appCtx.get('uiWorkspace')
        if (uiws && typeof uiws.openSession === 'function') {
          uiws.openSession(sessionId)
          return true
        }
      } catch {
        /* fall through to the in-board detail */
      }
      return false
    }
    const createTaskSession = async (v: any) => {
      if (!remotes || !remotes.session) throw new Error(t.failed)
      const owner = projectViews.find((pv: any) => pv.project.id === v.task.projectId)
        || projectViews.find((pv: any) => pv.project.repoPath === v.task.repoPath)
      const sessionId = await bindSession(remotes, v.task, owner && owner.project.name)
      if (!openTaskSession(sessionId)) selectTask(v.task.id, owner && owner.project.id)
      return sessionId
    }

    const afterChange = async () => {
      await refresh()
    }

    const projectColor = (id: string) => {
      let n = 0
      for (let i = 0; i < id.length; i += 1) n = (n * 31 + id.charCodeAt(i)) | 0
      return ['blue', 'purple', 'green', 'orange'][Math.abs(n) % 4]
    }

    const q = query.trim().toLowerCase()
    const filtered = projectViews.map((pv: any) => {
      const nameHit = !q || pv.project.name.toLowerCase().includes(q) || pv.project.repoPath.toLowerCase().includes(q)
      const tasks = nameHit
        ? pv.tasks
        : pv.tasks.filter((v: any) => {
          const pending = v.task.sessionId && pendingMap[v.task.sessionId]
          return String(v.task.title).toLowerCase().includes(q)
            || String(v.task.branch || '').toLowerCase().includes(q)
            || String(pendingLabel(t, pending) || '').toLowerCase().includes(q)
        })
      return { pv, nameHit, tasks }
    }).filter((item: any) => !q || item.nameHit || item.tasks.length > 0)

    const totalTasks = projectViews.reduce((sum: number, pv: any) => sum + pv.tasks.length, 0)

    const projectRow = (item: any) => {
      const pv = item.pv
      const isOpen = q ? true : !collapsed[pv.project.id]
      const activeProject = selectedProjectId === pv.project.id && !selectedTaskId
      const color = projectColor(pv.project.id)
      return h('div', { key: pv.project.id, role: 'listitem' },
        h('div', { className: 'dshw-project' + (activeProject ? ' dshw-project--on' : ''), 'data-open': isOpen ? 'true' : 'false' },
          h('button', {
            className: 'dshw-project-toggle',
            type: 'button',
            'aria-expanded': isOpen,
            'aria-label': (isOpen ? t.collapse : t.expand) + ': ' + pv.project.name,
            onClick: () => toggleCollapse(pv.project.id),
          }, h(Icon, { name: 'chevronDown' })),
          h('button', {
            className: 'dshw-project-select',
            type: 'button',
            title: pv.project.repoPath,
            'aria-current': activeProject ? 'true' : undefined,
            onClick: () => selectProject(pv.project.id),
          },
            h('span', { className: 'dshw-folder-tile dshw-folder-tile--' + color }, h(Icon, { name: 'folder' })),
            h('span', { className: 'dshw-project-name' }, pv.project.name),
            h('span', { className: 'dshw-project-count' }, String(item.tasks.length))),
          h('button', {
            className: 'dshw-project-add',
            type: 'button',
            title: t.addTask,
            'aria-label': t.addTask + ': ' + pv.project.name,
            onClick: () => { setPublishFor(pv.project); selectProject(pv.project.id) },
          }, h(Icon, { name: 'plus' }))),
        isOpen
          ? item.tasks.length
            ? h('div', { className: 'dshw-task-list', role: 'list' }, item.tasks.map((v: any) => {
              const pendingKind = v.task.sessionId ? pendingMap[v.task.sessionId] : null
              const running = runningOf(v.task)
              const active = selectedTaskId === v.task.id
              const meta = statusMeta(t, v.snapshot.status, pendingKind)
              const health = v.task.sessionId ? sessionHealth[v.task.sessionId] : null
              const healthActive = !!health && !running
              const dotTone = meta.pending && !meta.note ? 'warn' : healthActive ? (health.kind === 'error' ? 'error' : 'warn') : STATUS_TONE[v.snapshot.status] || 'neutral'
              const bound = !!v.task.sessionId
              return h('div', { key: v.task.id, role: 'listitem', className: 'dshw-task' + (active ? ' dshw-task--on' : '') },
                h('button', {
                  className: 'dshw-task-select',
                  type: 'button',
                  onClick: () => selectTask(v.task.id, pv.project.id),
                  title: v.task.title,
                  'aria-current': active ? 'true' : undefined,
                },
                  h(Dot, { tone: dotTone, pulse: meta.pending }),
                  h('span', { className: 'dshw-task-main' },
                    h('span', { className: 'dshw-task-title' }, v.task.title),
                    h('span', { className: 'dshw-task-meta' },
                      h(Chip, { tone: meta.tone, small: true }, meta.label),
                      meta.note ? h(Chip, { tone: 'warn', small: true }, meta.note) : null,
                      healthActive
                        ? h(Chip, { tone: health.kind === 'error' ? 'error' : 'warn', small: true }, health.kind === 'error' ? t.sessionError : t.sessionInterrupted)
                        : null,
                      v.snapshot.worktree.ahead > 0
                        ? h('span', { className: 'dshw-task-count', title: v.snapshot.worktree.ahead + ' ' + t.commitsAhead },
                          h(Icon, { name: 'arrowUp' }), v.snapshot.worktree.ahead)
                        : null,
                      v.snapshot.worktree.dirtyCount > 0
                        ? h('span', { className: 'dshw-task-count', title: v.snapshot.worktree.dirtyCount + ' ' + t.dirty }, '±' + v.snapshot.worktree.dirtyCount)
                        : null))),
                h('button', {
                  className: 'dshw-task-open',
                  type: 'button',
                  title: bound ? t.openSessionBtn : t.noSession,
                  'aria-label': (bound ? t.openSessionBtn : t.noSession) + ': ' + v.task.title,
                  disabled: !bound,
                  onClick: () => { if (bound && !openTaskSession(v.task.sessionId)) notify(t.openSessionFailed, 'error') },
                }, h(Icon, { name: 'external' })))
            }))
            : h('div', { className: 'dshw-tree-inline-empty' },
              h('span', null, t.noTasks),
              q ? null : h('button', { type: 'button', className: 'dshw-link-btn', onClick: () => { setPublishFor(pv.project); selectProject(pv.project.id) } }, t.addTask))
          : null)
    }

    const treeBody = !loaded
      ? h('div', { 'aria-hidden': 'true' },
        [0, 1, 2].map((group) => h('div', { key: 'g' + group },
          h('div', { className: 'dshw-sk-project' },
            h('span', { className: 'dshw-sk-line', style: { width: '12px', height: '12px', borderRadius: '4px' } }),
            h('span', { className: 'dshw-sk-line', style: { width: '22px', height: '22px', borderRadius: '6px' } }),
            h('span', { className: 'dshw-sk-line', style: { width: [92, 74, 108][group] + 'px' } }),
            h('span', { className: 'dshw-sk-line', style: { width: '18px', height: '16px', marginLeft: 'auto', borderRadius: '99px' } })),
          [0, 1, 2].map((row) => h('div', { key: 'r' + row, className: 'dshw-sk-task' },
            h('span', { className: 'dshw-sk-line', style: { width: '7px', height: '7px', borderRadius: '50%' } }),
            h('span', { className: 'dshw-sk-line', style: { width: [120, 156, 96][row] + 'px' } }),
            h('span', { className: 'dshw-sk-line dshw-sk-line--sm', style: { width: '44px', marginLeft: 'auto' } }))))))
      : filtered.length === 0
        ? projectViews.length === 0
          ? h('div', { className: 'dshw-tree-empty' },
            h('div', { className: 'dshw-empty-icon' }, h(Icon, { name: 'folder' })),
            h('h3', null, t.noProjects),
            h('p', null, t.noProjectsHint),
            h(Btn, { variant: 'primary', size: 'sm', icon: 'plus', onClick: () => setProjectModalOpen(true) }, t.addProject))
          : h('div', { className: 'dshw-tree-empty' },
            h('div', { className: 'dshw-empty-icon' }, h(Icon, { name: 'search' })),
            h('h3', null, t.noMatch),
            h('p', null, t.noMatchHint),
            h(Btn, { size: 'sm', onClick: () => setQuery('') }, t.clearSearch))
        : h('div', { role: 'list', 'aria-label': t.projects }, filtered.map(projectRow))

    const treeNode = h('section', { className: 'dshw-sidebar', 'aria-label': t.projects },
      h('header', { className: 'dshw-tree-head' },
        h('div', { className: 'dshw-search' },
          h(Icon, { name: 'search' }),
          h('input', {
            ref: searchRef,
            type: 'search',
            value: query,
            placeholder: t.search,
            autoComplete: 'off',
            'aria-label': t.search,
            onChange: (e: any) => setQuery(e.target.value),
          })),
        h(IconBtn, {
          icon: 'refresh',
          label: t.refresh,
          disabled: refreshing,
          onClick: () => { void refresh(true).then(() => notify(t.refreshed)) },
        }, refreshing ? h(Spinner) : null),
        h(IconBtn, { icon: 'plus', label: t.addProject, onClick: () => setProjectModalOpen(true) })),
      err
        ? projectViews.length
          ? h('div', { className: 'dshw-tree-status', role: 'status' },
            h(Spinner),
            h('span', null, t.reconnecting),
            h('button', { type: 'button', className: 'dshw-link-btn', onClick: () => void refresh(true) }, t.retry))
          : h('div', { style: { padding: '0 10px 8px' } },
            h('div', { className: 'dshw-err', role: 'alert' },
              h(Icon, { name: 'alert' }),
              h('span', null, err),
              h('span', { className: 'dshw-inline', style: { marginLeft: '4px' } },
                h('button', { type: 'button', className: 'dshw-link-btn', onClick: () => void refresh(true) }, t.retry),
                h('button', { type: 'button', className: 'dshw-link-btn', onClick: () => window.location.reload() }, t.reload))))
        : null,
      h('div', { className: 'dshw-tree-scroll' }, treeBody),
      h('footer', { className: 'dshw-tree-foot' },
        h('span', null, projectViews.length + ' ' + t.projectUnit + ' · ' + totalTasks + ' ' + t.taskUnit),
        h('span', { className: 'dshw-tree-tag' }, 'worktree')))

    const mobileBar = selectedTask || selectedProject
      ? h('div', { className: 'dshw-mobile-bar' },
        h(Btn, { size: 'sm', icon: 'arrowLeft', onClick: () => setShowDetail(false) }, t.backToList))
      : null

    let detailBody: any
    if (selectedTask) {
      detailBody = h(TaskDetail, {
        key: selectedTask.task.id,
        view: selectedTask,
        project: selectedProject ? selectedProject.project : null,
        running: runningOf(selectedTask.task),
        pendingKind: selectedTask.task.sessionId ? pendingMap[selectedTask.task.sessionId] : null,
        health: selectedTask.task.sessionId ? sessionHealth[selectedTask.task.sessionId] : null,
        live: liveValues,
        history: historyEntries,
        t,
        notify,
        onChanged: afterChange,
        onOpenSession: selectedTask.task.sessionId ? () => openTaskSession(selectedTask.task.sessionId) : undefined,
        onCreateSession: selectedTask.task.sessionId ? undefined : () => createTaskSession(selectedTask),
      })
    } else if (selectedProject) {
      detailBody = h(ProjectDetail, {
        key: selectedProject.project.id,
        view: selectedProject,
        cfg,
        pendingMap,
        t,
        notify,
        onChanged: afterChange,
        onPublish: (project: any) => setPublishFor(project),
        onSelectTask: selectTask,
        onDeleted: () => {
          setSelectedProjectId('')
          setSelectedTaskId('')
          setShowDetail(false)
          void refresh()
        },
      })
    } else {
      detailBody = h(Empty, { title: t.selectTask, icon: 'file', className: 'dshw-detail-empty' })
    }

    const detailNode = h('main', { className: 'dshw-detail' },
      h('div', { className: 'dshw-detail-scroll', ref: detailRef },
        h('div', { className: 'dshw-detail-inner' }, mobileBar),
        detailBody))

    const modalNode = [
      publishFor
        ? h(PublishModal, {
          key: 'pub',
          t,
          project: publishFor,
          cfg,
          onClose: () => setPublishFor(null),
          onRefresh: () => { void refresh() },
          onError: (message: string) => notify(message, 'error'),
          onPublished: (task: any, project: any, warning?: string) => {
            setPublishFor(null)
            if (project && project.id) setSelectedProjectId(project.id)
            if (task && task.id) setSelectedTaskId(task.id)
            setShowDetail(true)
            void refresh()
            notify(warning || String(t.published).replace('{branch}', task && task.branch ? task.branch : ''), warning ? 'error' : 'ok')
          },
        })
        : null,
      projectModalOpen
        ? h(AddProjectModal, {
          key: 'proj',
          t,
          onClose: () => setProjectModalOpen(false),
          onAdded: (project: any) => {
            setProjectModalOpen(false)
            if (project && project.id) {
              setSelectedProjectId(project.id)
              setSelectedTaskId('')
              setShowDetail(true)
              notify(String(t.projectAdded).replace('{name}', project.name))
            }
            void refresh()
          },
        })
        : null,
    ]

    return h('div', { className: 'dshw-scope dshw-shell', ref: shellRef },
      h('div', { className: 'dshw-app' + (showDetail ? ' dshw-app--detail' : '') }, treeNode, detailNode, modalNode),
      h(Toast, { toast }))
  }

export function BoardIcon() {
    return h('svg', { viewBox: '0 0 24 24', width: 22, height: 22, 'aria-hidden': true, style: { color: 'currentColor' } },
      h('circle', { cx: 7, cy: 6, r: 3, fill: 'currentColor' }),
      h('circle', { cx: 7, cy: 18, r: 3, fill: 'currentColor' }),
      h('circle', { cx: 17, cy: 12, r: 3, fill: 'currentColor', opacity: 0.75 }),
      h('path', { d: 'M7 9v6', stroke: 'currentColor', strokeWidth: 2, fill: 'none', strokeLinecap: 'round' }),
      h('path', { d: 'M9.5 7.5c4 1.5 5.5 2.5 6.2 4', stroke: 'currentColor', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', opacity: 0.75 }))
  }

