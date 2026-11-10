import { React, h, useStyles } from './ui'
import { Btn, Banner, Chip, Dot, Empty, Icon, IconBtn, Modal, Spinner, Toast } from './primitives'
import { AddProjectModal, PublishModal } from './modals'
import { PublishTargetModal, findPublishedTask, resolvePublishEntry } from './publish-flow'
import { useToast } from './hooks'
import { TaskDetail } from './task-detail'
import { TaskRow } from './task-row'
import { ProjectDetail } from './project-detail'
import { upsertPublishedTask, visibleProjectViews } from './board-data'
import { AttentionFilter } from './attention-filter'
import { AttentionSummaryBar } from './attention-summary'
import { RECOVERY_UI_READY, computeFilterCounts, deriveTaskAttention } from './task-attention'
import { appCtx, bindSession, getJson, post, postLong } from './context'
import { uuid } from './format'
import { STATUS_TONE, pendingLabel, postMergeLabel, resolveStatus, statusMeta } from './status'
import { buildHistoryEntries } from './timeline'

export function BoardPage(props: any) {
    const t = props.__t
    useStyles()
    const [projectViews, setProjectViews] = React.useState([])
    const [cfg, setCfg] = React.useState(null)
    const [env, setEnv] = React.useState(null)
    const [loaded, setLoaded] = React.useState(false)
    const [refreshing, setRefreshing] = React.useState(false)
    const [err, setErr] = React.useState('')
    const [query, setQuery] = React.useState('')
    const [attentionFilter, setAttentionFilter] = React.useState('all')
    const [lastOkAt, setLastOkAt] = React.useState(0)
    // Archived tasks are hidden from the sidebar by default; this toggle reveals
    // them so they can be reviewed or restored.
    const [showArchived, setShowArchived] = React.useState(false)
    const [selectedProjectId, setSelectedProjectId] = React.useState('')
    const [selectedTaskId, setSelectedTaskId] = React.useState('')
    const [detailFocus, setDetailFocus] = React.useState(null as any)
    const [showDetail, setShowDetail] = React.useState(false)
    const [collapsed, setCollapsed] = React.useState({})
    const [publishFor, setPublishFor] = React.useState(null)
    const [publishParent, setPublishParent] = React.useState(null)
    const [publishEntryOpen, setPublishEntryOpen] = React.useState(false)
    const [publishEntryPending, setPublishEntryPending] = React.useState(false)
    const [publishDraft, setPublishDraft] = React.useState(null)
    const [partialNotice, setPartialNotice] = React.useState(null as any)
    const [cleanupPredecessor, setCleanupPredecessor] = React.useState(null)
    const [repoBusy, setRepoBusy] = React.useState({} as Record<string, string>)
    const [taskBusy, setTaskBusy] = React.useState({} as Record<string, string>)
    const [predecessorBusy, setPredecessorBusy] = React.useState(false)
    const [predecessorErr, setPredecessorErr] = React.useState('')
    const [predecessorForce, setPredecessorForce] = React.useState(false)
    const [projectModalOpen, setProjectModalOpen] = React.useState(false)
    const [sessionMap, setSessionMap] = React.useState({})
    const [pendingMap, setPendingMap] = React.useState({})
    const { toast, notify, dismiss } = useToast()
    const bindingRef = React.useRef(new Set<string>())
    const searchRef = React.useRef(null)
    const detailRef = React.useRef(null)
    const listTitleRef = React.useRef(null)
    const shellRef = React.useRef(null)
    const failuresRef = React.useRef(0)
    const onlineRef = React.useRef(true)
    // Monotonic id so a slow, older poll response cannot overwrite a newer
    // refresh (e.g. the one fired right after publishing a task).
    const refreshSeqRef = React.useRef(0)

    const remotes = appCtx && appCtx.remote

    const refresh = React.useCallback(async (manual?: boolean) => {
      const seq = ++refreshSeqRef.current
      if (manual) setRefreshing(true)
      try {
        // Fetch archived rows too: the board filters them locally so the
        // "show archived" toggle is instant and a selected archived task stays
        // resolvable after its archive action refresh.
        const d = await getJson('projects?includeArchived=1')
        if (seq !== refreshSeqRef.current) return
        const list: any[] = d.projects || []
        setProjectViews(list)
        setSelectedTaskId((prev: string) => (prev && list.some((pv: any) => pv.tasks.some((v: any) => v.task.id === prev)) ? prev : ''))
        setSelectedProjectId((prev: string) => {
          if (prev && list.some((pv: any) => pv.project.id === prev)) return prev
          return list.length ? list[0].project.id : ''
        })
        failuresRef.current = 0
        onlineRef.current = true
        setLastOkAt(Date.now())
        setErr('')
      } catch (e: any) {
        if (seq !== refreshSeqRef.current) return
        failuresRef.current += 1
        onlineRef.current = false
        const message = String((e && e.message) || '')
        const offline = !navigator.onLine || /failed to fetch|networkerror|load failed|network request failed|abort|timed out/i.test(message)
        setErr(offline ? t.connectionLost : message || t.loadFailed)
      } finally {
        if (seq === refreshSeqRef.current) setLoaded(true)
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

    // Polling pauses while the tab is hidden; refresh the moment the user comes
    // back so returning to the page always shows current data without needing a
    // full re-mount.
    React.useEffect(() => {
      const onShow = () => {
        if (document.hidden) return
        void refresh()
      }
      window.addEventListener('focus', onShow)
      document.addEventListener('visibilitychange', onShow)
      return () => {
        window.removeEventListener('focus', onShow)
        document.removeEventListener('visibilitychange', onShow)
      }
    }, [refresh])

    React.useEffect(() => {
      getJson('config').then((d: any) => { setCfg(d.config); if (d.environment) setEnv(d.environment) }).catch(() => {})
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
    // Unified attention derivation — the single source for filter counts, the
    // summary bar and each task row (so the three can never drift).
    const attentionStale = !!err
    const attentionMap = new Map<string, any>()
    for (const v of allTasks) {
      attentionMap.set(v.task.id, deriveTaskAttention({
        task: v.task,
        snapshot: v.snapshot,
        pendingKind: v.task.sessionId ? pendingMap[v.task.sessionId] : null,
        running: v.task.sessionId ? !!sessionMap[v.task.sessionId] : null,
        health: v.task.sessionId ? sessionHealth[v.task.sessionId] : null,
        stale: attentionStale,
      }))
    }
    const attnOf = (v: any) => attentionMap.get(v.task.id)
    // Sidebar/detail rows with archived tasks hidden unless the toggle is on.
    const shownViews: any[] = visibleProjectViews(projectViews, showArchived)
    const archivedCount = allTasks.filter((v: any) => !!v.task.archivedAt).length
    const visibleTasks = shownViews.flatMap((pv: any) => pv.tasks)
    const filterCounts = computeFilterCounts(visibleTasks, allTasks, attnOf, RECOVERY_UI_READY)
    // Look up the selected project from the visible rows so its overview counts
    // match the sidebar; fall back to the full list for an archived-only project.
    const selectedProject =
      shownViews.find((pv: any) => pv.project.id === selectedProjectId)
      || projectViews.find((pv: any) => pv.project.id === selectedProjectId)
      || null
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

    /** Open the publish dialog prefilled to continue from a merged task. */
    const openContinue = (view: any) => {
      const owner = projectViews.find((pv: any) => pv.tasks.some((v: any) => v.task.id === view.task.id))
        || projectViews.find((pv: any) => pv.project.id === view.task.projectId)
        || projectViews.find((pv: any) => pv.project.repoPath === view.task.repoPath)
      const project = owner ? owner.project : (selectedProject ? selectedProject.project : null)
      if (!project) return
      setPublishParent({ view })
      setPublishFor(project)
      selectProject(project.id)
    }

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
      const sessionId = await bindSession(remotes, v.task, owner && owner.project.name, true)
      if (!openTaskSession(sessionId)) selectTask(v.task.id, owner && owner.project.id)
      return sessionId
    }

    /** Repair an already-bound but blank session (old publishes never sent the first prompt). */
    const startBoundSession = async (v: any) => {
      if (!remotes || !remotes.session || !v.task.sessionId) throw new Error(t.failed)
      const text = String(v.task.firstPrompt || v.task.description || '').trim()
      if (!text) throw new Error(t.failed)
      const sent = await remotes.session.prompt({
        requestId: uuid(),
        sessionId: v.task.sessionId,
        mode: 'queue',
        content: [{ type: 'text', text }],
      })
      if (sent && sent.ok === false) {
        const msg = sent.error && (sent.error.message || sent.error.code) ? sent.error.message || sent.error.code : t.failed
        throw new Error(String(msg))
      }
      if (!openTaskSession(v.task.sessionId)) selectTask(v.task.id, v.task.projectId)
      await refresh()
    }

    const afterChange = async () => {
      await refresh()
    }

    /** Archive / restore a finished task straight from the left tree. */
    const toggleArchive = async (v: any) => {
      const task = v.task
      const archiving = !task.archivedAt
      if (taskBusy[task.id]) return
      setTaskBusy((prev: Record<string, string>) => ({ ...prev, [task.id]: archiving ? 'archive' : 'unarchive' }))
      try {
        await post(archiving ? 'task/archive' : 'task/unarchive', { id: task.id })
        notify(archiving ? t.archiveDone : t.unarchiveDone)
        await refresh()
      } catch (e: any) {
        notify((e && e.message) || t.failed, 'error')
      } finally {
        setTaskBusy((prev: Record<string, string>) => {
          const next = { ...prev }
          delete next[task.id]
          return next
        })
      }
    }

    // Repo-level git action lock: while one task of a repo runs a git operation,
    // every task of that repo shows its buttons disabled with the action label.
    const repoActionBusy = (repoPath: string, active: boolean, label: string) => {
      if (!repoPath) return
      setRepoBusy((prev: Record<string, string>) => {
        const next = Object.assign({}, prev)
        if (active) next[repoPath] = label || '…'
        else delete next[repoPath]
        return next
      })
    }

    // Text "publish" entry: use the selected task/project; otherwise ask which
    // project (never guess). With no projects, guide to adding one first.
    const openPublishEntry = () => {
      const action = resolvePublishEntry(selectedProject && selectedProject.project, projectViews.length)
      if (action === 'form') { setPublishParent(null); setPublishFor((selectedProject as any).project); return }
      if (action === 'add') { setPublishEntryPending(true); setProjectModalOpen(true); return }
      setPublishEntryOpen(true)
    }
    /** Reconcile an unknown-result publish by looking for the task after refresh. */
    const checkPublished = async (info: any) => {
      const d: any = await getJson('projects?includeArchived=1')
      const list: any[] = (d && d.projects) || []
      setProjectViews(list)
      const pv = list.find((p: any) => p.project.id === info.projectId)
      if (!pv) return null
      return findPublishedTask(pv.tasks.map((v: any) => v.task), info)
    }

    // Row quick action: navigation only. "去处理/打开会话" opens the native
    // session; "查看验收/继续恢复" selects the task and focuses a detail section.
    const handleQuick = (action: string, view: any, projectId: string) => {
      if (action === 'handle' || action === 'open-session') {
        if (view.task.sessionId && !openTaskSession(view.task.sessionId)) notify(t.openSessionFailed, 'error')
        return
      }
      if (action === 'review' || action === 'recover') {
        selectTask(view.task.id, projectId)
        setDetailFocus({ section: action === 'recover' ? 'recovery' : 'acceptance', token: Date.now() })
      }
    }

    const projectColor = (id: string) => {      let n = 0
      for (let i = 0; i < id.length; i += 1) n = (n * 31 + id.charCodeAt(i)) | 0
      return ['blue', 'purple', 'green', 'orange'][Math.abs(n) % 4]
    }

    const q = query.trim().toLowerCase()
    const filterActive = attentionFilter !== 'all'
    // The recovery view also shows archived affected tasks (per spec).
    const baseViews = attentionFilter === 'recovery' ? visibleProjectViews(projectViews, true) : shownViews
    const filtered = baseViews.map((pv: any) => {
      const catTasks = filterActive
        ? pv.tasks.filter((v: any) => { const a = attnOf(v); return !!a && a.categories.has(attentionFilter as any) })
        : pv.tasks
      const nameHit = !q || pv.project.name.toLowerCase().includes(q) || pv.project.repoPath.toLowerCase().includes(q)
      const tasks = !q ? catTasks : catTasks.filter((v: any) => {
        const pending = v.task.sessionId && pendingMap[v.task.sessionId]
        return nameHit
          || String(v.task.title).toLowerCase().includes(q)
          || String(v.task.branch || '').toLowerCase().includes(q)
          || String(pendingLabel(t, pending) || '').toLowerCase().includes(q)
      })
      return { pv, nameHit, tasks }
    }).filter((item: any) => item.tasks.length > 0 || (!q && !filterActive))

    const totalTasks = shownViews.reduce((sum: number, pv: any) => sum + pv.tasks.length, 0)
    const selectedHidden = !!(selectedTask && filterActive && (() => {
      const a = selectedTask ? attnOf(selectedTask) : null
      return !a || !a.categories.has(attentionFilter as any)
    })())

    const projectRow = (item: any) => {
      const pv = item.pv
      const isOpen = filterActive || q ? true : !collapsed[pv.project.id]
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
              const health = v.task.sessionId ? sessionHealth[v.task.sessionId] : null
              return h(TaskRow, {
                key: v.task.id,
                t,
                view: v,
                attention: attnOf(v),
                active: selectedTaskId === v.task.id,
                running,
                pendingKind,
                health,
                onSelect: (view: any) => selectTask(view.task.id, pv.project.id),
                onQuick: (action: string, view: any) => handleQuick(action, view, pv.project.id),
              })
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
          : filterActive
            ? h('div', { className: 'dshw-tree-empty' },
              h('div', { className: 'dshw-empty-icon' }, h(Icon, { name: 'alert' })),
              h('h3', null, t.attentionEmptyTitle),
              h('p', null, t.attentionEmptyHint),
              h('div', { className: 'dshw-inline', style: { gap: '8px' } },
                h(Btn, { size: 'sm', onClick: () => setAttentionFilter('all') }, t.clearFilter),
                q ? h(Btn, { size: 'sm', onClick: () => { setAttentionFilter('all'); setQuery('') } }, t.resetSearchFilter) : null))
            : h('div', { className: 'dshw-tree-empty' },
              h('div', { className: 'dshw-empty-icon' }, h(Icon, { name: 'search' })),
              h('h3', null, t.noMatch),
              h('p', null, t.noMatchHint),
              h(Btn, { size: 'sm', onClick: () => setQuery('') }, t.clearSearch))
        : h('div', { role: 'list', 'aria-label': t.projects }, filtered.map(projectRow))

    const treeNode = h('section', { className: 'dshw-sidebar', 'aria-label': t.projects },
      env && env.mergeTreeSupported === false
        ? h(Banner, { tone: 'warn', icon: 'alert', title: t.gitTooOldTitle }, t.gitTooOldHint)
        : null,
      env && env.longPaths === false
        ? h(Banner, { tone: 'warn', icon: 'alert', title: t.longPathsTitle }, t.longPathsHint)
        : null,
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
        h('div', { className: 'dshw-tree-tools' },
          h(AttentionFilter, {
            t,
            value: attentionFilter,
            counts: filterCounts,
            onChange: (next: string) => setAttentionFilter(next),
          }),
          h(Btn, { variant: 'primary', size: 'sm', icon: 'plus', onClick: () => openPublishEntry() }, t.publish),
          h(IconBtn, {
            icon: 'refresh',
            label: t.refresh,
            disabled: refreshing,
            onClick: () => { void refresh(true).then(() => notify(t.refreshed)) },
          }, refreshing ? h(Spinner) : null),
          archivedCount > 0
            ? h(IconBtn, {
              icon: 'archive',
              label: showArchived ? t.hideArchived : t.showArchived,
              title: String(t.archiveToggleTitle).replace('{n}', String(archivedCount)),
              'aria-pressed': showArchived ? 'true' : 'false',
              className: showArchived ? 'dshw-icon-btn--on' : undefined,
              onClick: () => setShowArchived((value: boolean) => !value),
            })
            : null,
          h(IconBtn, { icon: 'plus', label: t.addProject, onClick: () => setProjectModalOpen(true) }))),
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
      h('div', { className: 'dshw-tree-scroll' },
        h('h2', { ref: listTitleRef, tabIndex: -1, className: 'dshw-sr-only', id: 'dshw-task-list-title' }, t.projects),
        selectedHidden
          ? h('div', { className: 'dshw-tree-notice', role: 'status' },
            h(Icon, { name: 'alert' }),
            h('span', null, t.currentTaskFilteredOut),
            h('button', { type: 'button', className: 'dshw-link-btn', onClick: () => setAttentionFilter('all') }, t.clearFilter))
          : null,
        treeBody),
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
        onStartTask: selectedTask.task.sessionId ? () => startBoundSession(selectedTask) : undefined,
        parentView: selectedTask.task.parentId ? (allTasks.find((v: any) => v.task.id === selectedTask.task.parentId) || null) : null,
        followUps: allTasks.filter((v: any) => v.task.parentId === selectedTask.task.id),
        siblings: allTasks.filter((v: any) => v.task.id !== selectedTask.task.id && String(v.task.repoPath).toLowerCase() === String(selectedTask.task.repoPath).toLowerCase()),
        repoLockLabel: repoBusy[selectedTask.task.repoPath] || '',
        focusSection: detailFocus ? detailFocus.section : undefined,
        focusToken: detailFocus ? detailFocus.token : undefined,
        onRepoBusy: (active: boolean, label: string) => repoActionBusy(selectedTask.task.repoPath, active, label),
        onContinue: () => openContinue(selectedTask),
        onSelectTask: (id: string) => selectTask(id),
      })
    } else if (selectedProject) {
      detailBody = h(ProjectDetail, {
        key: selectedProject.project.id,
        view: selectedProject,
        cfg,
        pendingMap,
        sessionMap,
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

    const partialBanner = partialNotice && selectedTask && partialNotice.taskId === selectedTask.task.id
      ? h(Banner, {
        tone: 'warn',
        icon: 'alert',
        title: t.publishPartialTitle,
        actions: h('div', { className: 'dshw-inline', style: { gap: '8px' } },
          !selectedTask.task.sessionId
            ? h(Btn, { size: 'sm', onClick: () => { void createTaskSession(selectedTask) } }, t.createSession)
            : null,
          h(Btn, { size: 'sm', onClick: () => setPartialNotice(null) }, t.close)),
      }, partialNotice.message)
      : null

    const detailNode = h('main', { className: 'dshw-detail' },
      h('div', { className: 'dshw-detail-scroll', ref: detailRef },
        h('div', { className: 'dshw-detail-inner' }, mobileBar, partialBanner),
        detailBody))

    const runPredecessorCleanup = async () => {
      if (!cleanupPredecessor || predecessorBusy) return
      setPredecessorBusy(true)
      setPredecessorErr('')
      try {
        await postLong('task/cleanup', { id: cleanupPredecessor.task.id, force: predecessorForce, deleteBranch: false })
        setCleanupPredecessor(null)
        setPredecessorForce(false)
        notify(t.cleanupPredecessorDone)
        await refresh()
      } catch (e: any) {
        setPredecessorErr((e && e.message) || t.failed)
      } finally {
        setPredecessorBusy(false)
      }
    }

    const modalNode = [
      publishFor
        ? h(PublishModal, {
          key: 'pub',
          t,
          project: publishFor,
          cfg,
          parentView: publishParent ? publishParent.view : undefined,
          draft: publishDraft,
          onDraft: (draft: any) => setPublishDraft(draft),
          onBackToProject: () => { setPublishFor(null); setPublishParent(null); setPublishEntryOpen(true) },
          onCheckPublished: checkPublished,
          onClose: () => { setPublishFor(null); setPublishParent(null) },
          onRefresh: () => { void refresh() },
          onError: (message: string) => notify(message, 'error'),
          onPublished: (task: any, project: any, warning?: string, continued?: boolean) => {
            const predecessor = continued && publishParent ? publishParent.view : null
            setPublishFor(null)
            setPublishParent(null)
            setPublishDraft(null)
            if (project && project.id) setSelectedProjectId(project.id)
            if (task && task.id) setSelectedTaskId(task.id)
            setShowDetail(true)
            // Reflect the new task in the left tree right away instead of waiting
            // for the async refresh, which can race with a slow poll or briefly
            // fail. `refresh()` below reconciles this provisional row with the
            // real Git-derived snapshot.
            if (task && task.id) {
              const status = task.sessionId ? 'developing' : 'ready'
              setProjectViews((prev: any[]) => upsertPublishedTask(prev, task, project && project.id, status))
            }
            void refresh()
            // Offer (never force) to clean the predecessor's worktree once its
            // continuation is published.
            if (predecessor && predecessor.snapshot && predecessor.snapshot.worktree && predecessor.snapshot.worktree.exists) {
              setCleanupPredecessor(predecessor)
            }
            notify(warning || String(t.published).replace('{branch}', task && task.branch ? task.branch : ''), warning ? 'error' : 'ok')
            if (warning && task && task.id) setPartialNotice({ taskId: task.id, message: warning })
            else setPartialNotice(null)
          },
        })
        : null,
      publishEntryOpen
        ? h(PublishTargetModal, {
          key: 'pick',
          t,
          projects: projectViews.map((pv: any) => pv.project),
          onPick: (project: any) => { setPublishEntryOpen(false); setPublishFor(project) },
          onAddProject: () => { setPublishEntryPending(true); setProjectModalOpen(true) },
          onClose: () => { setPublishEntryOpen(false); setPublishEntryPending(false) },
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
            if (publishEntryPending && project && project.id) {
              setPublishEntryPending(false)
              setPublishEntryOpen(false)
              setPublishFor(project)
            }
            void refresh()
          },
        })
        : null,
      cleanupPredecessor
        ? h(Modal, {
          key: 'pred',
          t,
          title: t.cleanupPredecessorTitle,
          subtitle: t.cleanupPredecessorSub,
          icon: 'trash',
          tone: 'danger',
          size: 'sm',
          busy: predecessorBusy,
          onClose: () => { if (!predecessorBusy) { setCleanupPredecessor(null); setPredecessorForce(false); setPredecessorErr('') } },
          footer: [
            h(Btn, { key: 'c', onClick: () => { setCleanupPredecessor(null); setPredecessorForce(false); setPredecessorErr('') }, disabled: predecessorBusy, 'data-autofocus': true }, t.keepWorktree),
            h(Btn, { key: 'ok', variant: 'danger', disabled: predecessorBusy, onClick: () => void runPredecessorCleanup() }, predecessorBusy ? h(Spinner) : null, predecessorBusy ? t.cleaning : t.cleanup),
          ],
        },
          h('div', { className: 'dshw-danger-list' },
            h('div', { className: 'dshw-danger-title' }, h(Icon, { name: 'alert' }), t.cleanupPredecessorSub),
            h('div', { className: 'dshw-danger-item' }, h(Icon, { name: 'folder' }), h('span', null, cleanupPredecessor.task.worktreePath))),
          h('div', { className: 'dshw-hint' }, t.cleanupPredecessorHint),
          (cleanupPredecessor.snapshot.worktree.dirtyCount || 0) > 0
            ? h('label', { className: 'dshw-check' },
              h('input', { type: 'checkbox', checked: predecessorForce, onChange: (e: any) => setPredecessorForce(e.target.checked) }),
              h('span', { className: 'dshw-check-copy' }, t.cleanupPredecessorForce,
                h('small', null, String(t.cleanupPredecessorDirty).replace('{n}', String(cleanupPredecessor.snapshot.worktree.dirtyCount || 0)))))
            : null,
          predecessorErr ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, predecessorErr)) : null)
        : null,
    ]

    return h('div', { className: 'dshw-scope dshw-shell' + (showDetail ? ' dshw-shell--detail' : ''), ref: shellRef },
      h(AttentionSummaryBar, {
        t,
        counts: filterCounts,
        total: filterCounts.total,
        stale: attentionStale,
        lastOkAt,
        onView: (category: string) => {
          setAttentionFilter(category)
          window.requestAnimationFrame(() => {
            const el: any = listTitleRef.current
            if (el) el.focus()
          })
        },
      }),
      h('div', { className: 'dshw-app' + (showDetail ? ' dshw-app--detail' : '') }, treeNode, detailNode, modalNode),
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

