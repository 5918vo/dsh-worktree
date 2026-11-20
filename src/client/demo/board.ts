import { React, h, useStyles } from '../ui'
import { appCtx, getJson, post, postLong, bindSession } from '../context'
import { upsertPublishedTask, visibleProjectViews } from '../board-data'
import { createPreviewController, shouldPollPreview } from '../merge-preview'
import { buildHistoryEntries } from '../timeline'
import { copyText } from '../format'
import { ProjectDetail } from '../project-detail'
import type { ProjectView, TaskDiff, TaskView } from '../../models'
import { DEMO_CSS } from './styles'
import { Rail } from './rail'
import { Stage, type DemoTab } from './stage'
import { Inspector } from './inspector'
import { PublishModal } from './publish'
import { openNativeSession, startTask } from './actions'
import {
  demoCta,
  demoStatus,
  diffBaseSha,
  diffHeadSha,
  filterViews,
  themeFor,
  type DemoAction,
  type DemoFilter,
  type DemoTheme,
} from './model'

const THEME_KEY = 'dshw-demo:theme'
let demoStyleEl: any = null

export function DemoBoardIcon() {
  return h('svg', { viewBox: '0 0 24 24', width: 22, height: 22, 'aria-hidden': true, style: { color: 'currentColor' } },
    h('rect', { x: 3, y: 4, width: 4, height: 16, rx: 1.5, fill: 'currentColor', opacity: 0.5 }),
    h('rect', { x: 9, y: 4, width: 12, height: 7, rx: 1.5, fill: 'currentColor' }),
    h('rect', { x: 9, y: 13, width: 12, height: 7, rx: 1.5, fill: 'currentColor', opacity: 0.75 }))
}

export function DemoBoardPage(props: any) {
  const t = props.__t
  useStyles()
  React.useEffect(() => {
    if (!demoStyleEl || !demoStyleEl.isConnected) {
      demoStyleEl = document.createElement('style')
      demoStyleEl.setAttribute('data-dshw-demo', '1')
      demoStyleEl.textContent = DEMO_CSS
      document.head.appendChild(demoStyleEl)
    }
  }, [])

  const [views, setViews] = React.useState([] as ProjectView[])
  const [loaded, setLoaded] = React.useState(false)
  const [err, setErr] = React.useState('')
  const [query, setQuery] = React.useState('')
  const [filter, setFilter] = React.useState('all' as DemoFilter)
  const [selectedTaskId, setSelectedTaskId] = React.useState('')
  const [selectedProjectId, setSelectedProjectId] = React.useState('')
  const [tab, setTab] = React.useState('overview' as DemoTab)
  const [railHidden, setRailHidden] = React.useState(false)
  const [inspectorHidden, setInspectorHidden] = React.useState(false)
  const [sessionMap, setSessionMap] = React.useState({} as Record<string, boolean>)
  const [pendingMap, setPendingMap] = React.useState({} as Record<string, string>)
  const [entries, setEntries] = React.useState([] as any[])
  const [entriesReady, setEntriesReady] = React.useState(false)
  const [diff, setDiff] = React.useState(null as TaskDiff | null)
  const [diffLoading, setDiffLoading] = React.useState(false)
  const [diffError, setDiffError] = React.useState('')
  const [diffTick, setDiffTick] = React.useState(0)
  const [previewState, setPreviewState] = React.useState({ phase: 'idle' } as any)
  const [busy, setBusy] = React.useState('')
  const [publishOpen, setPublishOpen] = React.useState(false)
  const [publishProjectId, setPublishProjectId] = React.useState('')
  const [publishParentId, setPublishParentId] = React.useState('')
  const [confirm, setConfirm] = React.useState(null)
  const [toast, setToast] = React.useState(null as { message: string; error?: boolean } | null)
  const [theme, setTheme] = React.useState(() => {
    let stored = ''
    try { stored = localStorage.getItem(THEME_KEY) || '' } catch { /* storage may be disabled */ }
    const hostDark = (() => {
      try {
        return document.documentElement.classList.contains('dshw-dark')
          || (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      } catch { return true }
    })()
    return themeFor(stored, hostDark, hostDark)
  })

  const rootRef = React.useRef(null)
  const searchRef = React.useRef(null)
  const refreshSeq = React.useRef(0)
  const failures = React.useRef(0)
  const online = React.useRef(true)
  const toastTimer = React.useRef(null)
  const bindingRef = React.useRef(new Set<string>())
  const remotes = appCtx && appCtx.remote
  const remotesRef = React.useRef(remotes)
  remotesRef.current = remotes
  const selectedTask = views.flatMap((v: any) => v.tasks).find((v: any) => v.task.id === selectedTaskId) || null
  const selectedProject = views.find((v: any) => v.project.id === selectedProjectId) || null
  const projectOfTask = selectedTask
    ? views.find((v: any) => v.tasks.some((x: any) => x.task.id === selectedTask.task.id)) || selectedProject
    : selectedProject

  const say = (message: string, error = false) => {
    setToast({ message, error })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }

  const refresh = React.useCallback(async (manual?: boolean) => {
    const seq = ++refreshSeq.current
    try {
      const d: any = await getJson('projects?includeArchived=1')
      if (seq !== refreshSeq.current) return
      const list: ProjectView[] = d.projects || []
      setViews(list)
      failures.current = 0
      online.current = true
      setErr('')
      setLoaded(true)
      setSelectedTaskId((prev: string) => prev && list.some((v: any) => v.tasks.some((x: any) => x.task.id === prev && !x.task.archivedAt)) ? prev : '')
      setSelectedProjectId((prev: string) => {
        if (prev && list.some((v: any) => v.project.id === prev)) return prev
        return list.length ? list[0].project.id : ''
      })
    } catch (e: any) {
      if (seq !== refreshSeq.current) return
      failures.current += 1
      online.current = false
      setErr(String((e && e.message) || t.loadFailed))
      setLoaded(true)
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    let timer: any = null
    const tick = async () => {
      if (cancelled) return
      if (!document.hidden) await refresh()
      if (cancelled) return
      const delay = failures.current ? Math.min(30000, 4000 * Math.pow(2, Math.min(failures.current, 3))) : 4000
      timer = window.setTimeout(tick, delay)
    }
    void tick()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [refresh])

  React.useEffect(() => {
    const onShow = () => { if (!document.hidden) void refresh() }
    window.addEventListener('focus', onShow)
    document.addEventListener('visibilitychange', onShow)
    return () => {
      window.removeEventListener('focus', onShow)
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [refresh])

  // First paint selects the first task so the demo's three-zone layout is visible.
  const initialSelect = React.useRef(false)
  React.useEffect(() => {
    if (initialSelect.current || !loaded) return
    initialSelect.current = true
    if (!selectedTaskId) {
      const visible = visibleProjectViews(views, false)
      const project = selectedProjectId ? visible.find((v: any) => v.project.id === selectedProjectId) : null
      const first = project && project.tasks.length ? project : visible.find((v: any) => v.tasks.length)
      if (first) {
        setSelectedTaskId(first.tasks[0].task.id)
        setSelectedProjectId(first.project.id)
      }
    }
  }, [loaded, views, selectedTaskId, selectedProjectId])

  React.useEffect(() => {
    try {
      const svc = appCtx && appCtx.get ? appCtx.get('uiSession') : null
      if (!svc || !svc.sessionStatus) return
      const apply = () => {
        const snap = svc.sessionStatus.getSnapshot()
        const running: Record<string, boolean> = {}
        const pending: Record<string, string> = {}
        for (const [id, st] of snap) {
          running[id] = !!(st && st.running)
          const kind = st && st.pendingInteraction && st.pendingInteraction.kind
          if (kind) pending[id] = kind
        }
        setSessionMap(running)
        setPendingMap(pending)
      }
      apply()
      const off = svc.sessionStatus.subscribe(apply)
      return () => { try { off() } catch { /* noop */ } }
    } catch { /* uiSession unavailable */ }
  }, [])

  const runningOf = (task: any) => task && task.sessionId ? !!sessionMap[task.sessionId] : false

  // Auto-bind tasks published by tools (start requested, no session yet).
  React.useEffect(() => {
    const remote: any = remotesRef.current
    if (!remote || !remote.session) return
    for (const view of views) {
      for (const tv of view.tasks) {
        const task = tv.task
        if (task.archivedAt || task.sessionId || task.startOnBind === false || tv.snapshot.status === 'cleaned') continue
        if (bindingRef.current.has(task.id)) continue
        bindingRef.current.add(task.id)
        bindSession(remote, task, view.project.name)
          .then(() => { void refresh() })
          .catch(() => { bindingRef.current.delete(task.id) })
      }
    }
  }, [views, refresh])

  const sessionId = selectedTask && selectedTask.task.sessionId ? String(selectedTask.task.sessionId) : ''
  React.useEffect(() => {
    const remote: any = remotesRef.current
    if (!sessionId || !remote || !remote.session) { setEntries([]); setEntriesReady(true); return }
    let cancelled = false
    setEntriesReady(false)
    const pull = async () => {
      if (!online.current) { setEntriesReady(true); return }
      try {
        const stream: any = await Promise.race([
          remote.session.follow({ address: { kind: 'session', sessionId }, maxMessages: 24 }),
          new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
        ])
        if (!stream) { setEntriesReady(true); return }
        const iterator = stream && typeof stream[Symbol.asyncIterator] === 'function' ? stream[Symbol.asyncIterator]() : null
        if (!iterator) { setEntriesReady(true); return }
        let frame: any = null
        try {
          const first: any = await Promise.race([iterator.next(), new Promise((r) => setTimeout(() => r(null), 2500))])
          frame = first && first.done !== true ? first.value : null
        } finally {
          if (typeof iterator.return === 'function') { try { await iterator.return() } catch { /* closed */ } }
        }
        if (cancelled) return
        if (!frame || !Array.isArray(frame.records)) { setEntriesReady(true); return }
        setEntries(buildHistoryEntries(frame.records, 240, t, selectedTask ? selectedTask.task.worktreePath : ''))
        setEntriesReady(true)
      } catch {
        /* keep last readable timeline, but never leave the loading state on */
        if (!cancelled) setEntriesReady(true)
      }
    }
    void pull()
    const timer = setInterval(() => { if (!document.hidden) void pull() }, 4000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [sessionId, selectedTask && selectedTask.task.id])

  // Diff is versioned by HEAD, so a commit refresh invalidates the fetched patch.
  const headSha = selectedTask ? diffHeadSha(selectedTask.task, selectedTask.snapshot) : ''
  React.useEffect(() => {
    if (!selectedTask) { setDiff(null); setDiffError(''); setDiffLoading(false); return }
    let cancelled = false
    setDiff(null)
    setDiffLoading(true)
    setDiffError('')
    getJson('task/diff?id=' + encodeURIComponent(selectedTask.task.id))
      .then((d: any) => {
        if (cancelled) return
        setDiff(d && d.diff ? d.diff : null)
        setDiffLoading(false)
      })
      .catch((e: any) => {
        if (cancelled) return
        setDiffError(String((e && e.message) || t.loadFailed))
        setDiffLoading(false)
      })
    return () => { cancelled = true }
  }, [selectedTask && selectedTask.task.id, headSha, diffTick])

  // Merge preflight for the inspector. Poll only while the task can still move.
  const previewRef = React.useRef(null)
  React.useEffect(() => {
    previewRef.current = null
    if (!selectedTask) { setPreviewState({ phase: 'idle' }); return }
    const snap = selectedTask.snapshot
    const controller = createPreviewController({
      taskId: selectedTask.task.id,
      request: (force: boolean) => post('task/merge-preview', { id: selectedTask.task.id, force }).then((r: any) => (r && r.preview) || null),
    })
    const off = controller.subscribe((state: any) => {
      previewRef.current = state
      setPreviewState(state)
    })
    if (shouldPollPreview({
      status: snap.status,
      branchExists: snap.branchExists,
      ahead: snap.worktree.ahead,
      postMergeAhead: snap.postMergeAhead,
      repoBusy: false,
    })) void controller.load()
    return () => { try { off() } catch { /* noop */ }; controller.dispose() }
  }, [selectedTask && selectedTask.task.id, selectedTask && selectedTask.snapshot.status, selectedTask && selectedTask.snapshot.branchExists, selectedTask && selectedTask.snapshot.worktree.ahead, selectedTask && selectedTask.snapshot.postMergeAhead])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (publishOpen || confirm) {
        if (e.key === 'Escape' && !busy) { setPublishOpen(false); setConfirm(null) }
        return
      }
      const root: any = rootRef.current
      const active: any = document.activeElement
      // Do not steal keys from the host's chat composer or any other widget.
      if (root && active && active !== document.body && !root.contains(active)) return
      const typing = active && (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || active.isContentEditable)
      if (!typing && (e.key === '/' || ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k'))) {
        e.preventDefault()
        if (searchRef.current) (searchRef.current as any).focus()
        return
      }
      if (!typing && e.key.toLowerCase() === 'n') { e.preventDefault(); openPublish(); return }
      if (!typing && e.key === '[') { e.preventDefault(); setRailHidden((v: boolean) => !v); return }
      if (!typing && e.key === ']') { e.preventDefault(); setInspectorHidden((v: boolean) => !v); return }
      if (e.key === 'Escape' && active === searchRef.current && query) setQuery('')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [query, publishOpen, confirm, busy])

  const selectTask = (id: string, projectId?: string) => {
    const found = views.flatMap((v: any) => v.tasks).find((x: any) => x.task.id === id)
    const owner = projectId || (found ? found.task.projectId : '')
    setSelectedTaskId(id)
    if (owner) setSelectedProjectId(owner)
    setTab('overview')
  }
  const selectProject = (id: string) => {
    setSelectedProjectId(id)
    setSelectedTaskId('')
  }
  const openPublish = (projectId?: string, parentId = '') => {
    setPublishProjectId(projectId || selectedProjectId || (views[0] && views[0].project.id) || '')
    setPublishParentId(parentId)
    setPublishOpen(true)
  }
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try { localStorage.setItem(THEME_KEY, next) } catch { /* noop */ }
  }

  async function runAct(key: string, fn: () => Promise<any>, success: string) {
    if (busy) return
    setBusy(key)
    try {
      await fn()
      say(success)
    } catch (e: any) {
      say(String((e && e.message) || t.failed), true)
    } finally {
      setBusy('')
      void refresh()
    }
  }

  async function runSwitch(action: 'checkout' | 'back') {
    if (!selectedTask || busy) return
    setBusy(action)
    try {
      const r: any = await post(action === 'checkout' ? 'task/checkout-preflight' : 'task/back-preflight', { id: selectedTask.task.id })
      const pre = r && r.preflight
      if (!pre) throw new Error(t.failed)
      if (pre.safe) {
        await executeSwitch(action, undefined, pre)
      } else {
        const dirty = Number(pre.dirty) || 0
        setConfirm({
          title: action === 'checkout' ? t.checkoutTitle : t.backTitle,
          body: String(t.demoSwitchDirty).replace('{n}', String(dirty)),
          label: action === 'checkout' ? t.checkout : t.back,
          run: () => executeSwitch(action, 'stash', pre),
        })
      }
    } catch (e: any) {
      say(String((e && e.message) || t.failed), true)
    } finally {
      setBusy('')
    }
  }

  async function executeSwitch(action: 'checkout' | 'back', strategy: string | undefined, pre: any) {
    await postLong(action === 'checkout' ? 'task/checkout' : 'task/back', {
      id: selectedTask.task.id,
      strategy,
      expectedSha: pre && pre.targetSha ? pre.targetSha : undefined,
    })
    setConfirm(null)
    setTab('overview')
    say(action === 'checkout' ? t.checkoutDone : t.backDone)
    void refresh()
  }

  async function runMerge() {
    if (!selectedTask || busy) return
    const snap = selectedTask.snapshot
    const curOnBase = snap.repo.currentBranch === selectedTask.task.baseBranch
    setBusy('merge-pre')
    try {
      const r: any = await post('task/merge-preflight', { id: selectedTask.task.id, switchToBase: !curOnBase, restoreAfter: true })
      const pf = r && r.preflight
      if (!pf) throw new Error(t.failed)
      if (!pf.canMerge) {
        const first = (pf.blockers || [])[0]
        throw new Error((first && first.message) || t.failed)
      }
      const state = previewRef.current
      const preview = state && state.preview
      setConfirm({
        title: String(t.mergeTitle).replace('{base}', selectedTask.task.baseBranch),
        body: String(t.demoMergeConfirm).replace('{branch}', selectedTask.task.branch).replace('{base}', selectedTask.task.baseBranch),
        label: t.mergeConfirm,
        danger: true,
        run: async () => {
          await postLong('task/merge', {
            id: selectedTask.task.id,
            switchToBase: !curOnBase,
            restoreTo: true,
            dirtyStrategy: 'refuse',
            expectedTip: (preview && preview.expectedTip) || undefined,
            expectedBase: (preview && preview.expectedBase) || undefined,
          })
          setConfirm(null)
          say(String(t.mergeDone).replace('{base}', selectedTask.task.baseBranch))
          void refresh()
        },
      })
    } catch (e: any) {
      say(String((e && e.message) || t.failed), true)
    } finally {
      setBusy('')
    }
  }

  function runCleanup() {
    if (!selectedTask || busy) return
    setConfirm({
      title: t.cleanup,
      body: t.demoCleanupConfirm,
      label: t.cleanup,
      danger: true,
      run: async () => {
        await postLong('task/cleanup', { id: selectedTask.task.id, force: false, deleteBranch: false, forceDeleteBranch: false })
        setConfirm(null)
        say(t.cleanupDone)
        void refresh()
      },
    })
  }

  function runAction(action: DemoAction) {
    if (!selectedTask) return
    const task = selectedTask.task
    const projectName = projectOfTask ? projectOfTask.project.name : ''
    if (action === 'merge') { void runMerge(); return }
    if (action === 'checkout' || action === 'back') { void runSwitch(action); return }
    if (action === 'cleanup') { runCleanup(); return }
    if (action === 'continue') { openPublish(task.projectId || selectedProjectId, task.id); return }
    if (action === 'open') { if (!openNativeSession(task.sessionId)) say(t.openSessionFailed, true); return }
    if (action === 'logs') { setTab('live'); return }
    if (action === 'create' || action === 'start' || action === 'retry') {
      if (!remotes) { say(t.failed, true); return }
      setBusy(action)
      startTask(remotes, task, projectName)
        .then(() => { say(action === 'create' ? t.sessionCreated : t.sessionStarted); setTab('live'); void refresh() })
        .catch((e: any) => say(String((e && e.message) || t.openSessionFailed), true))
        .finally(() => setBusy(''))
    }
  }

  function archiveTask(archived: boolean) {
    if (!selectedTask || busy) return
    const id = selectedTask.task.id
    void runAct(archived ? 'unarchive' : 'archive', () => postLong(archived ? 'task/unarchive' : 'task/archive', { id }), archived ? t.unarchiveDone : t.archiveDone)
  }

  async function checkPublished(): Promise<TaskView | undefined> {
    try {
      const d: any = await getJson('projects?includeArchived=1')
      const list: ProjectView[] = d.projects || []
      setViews(list)
      const cutoff = Date.now() - 10 * 60 * 1000
      const fresh = list.flatMap((v: any) => v.tasks).filter((v: any) => (v.task.createdAt || 0) >= cutoff)
      fresh.sort((a: any, b: any) => (b.task.createdAt || 0) - (a.task.createdAt || 0))
      const found = fresh[0]
      if (!found) return undefined
      setSelectedTaskId(found.task.id)
      setSelectedProjectId(found.task.projectId)
      return found
    } catch {
      return undefined
    }
  }

  const archived = !!(selectedTask && selectedTask.task.archivedAt)
  const cta = selectedTask
    ? demoCta(demoStatus(selectedTask.snapshot.status, runningOf(selectedTask.task)), !!selectedTask.task.sessionId)
    : null
  const baseSha = selectedTask ? diffBaseSha(selectedTask.task, selectedTask.snapshot, previewRef.current && previewRef.current.preview ? (previewRef.current.preview.expectedBase || null) : null) : ''
  const canArchive = !!(selectedTask && (selectedTask.snapshot.status === 'merged' || selectedTask.snapshot.status === 'cleaned' || archived))
  const archiveReason = selectedTask && !canArchive ? t.archiveMergedOnly : ''
  const filtered = filterViews(visibleProjectViews(views, false), filter, query, runningOf)

  return h('div', { ref: rootRef, className: 'dshw-demo', 'data-theme': theme },
    h('div', {
      className: 'dshwd-app'
        + (railHidden ? ' dshwd-hide-left' : '')
        + (inspectorHidden || !selectedTask ? ' dshwd-hide-right' : ''),
    },
      h(Rail, {
        t,
        views: filtered,
        selectedTaskId,
        selectedProjectId,
        query,
        filter,
        theme,
        runningOf,
        onQuery: setQuery,
        onFilter: setFilter,
        onSelectTask: selectTask,
        onSelectProject: selectProject,
        onPublish: () => openPublish(),
        onToggleTheme: toggleTheme,
        searchRef,
      }),

      selectedTask && projectOfTask && cta
        ? h(Stage, {
          t,
          taskView: selectedTask,
          projectName: projectOfTask.project.name,
          running: runningOf(selectedTask.task),
          tab,
          onTab: setTab,
          ctas: cta,
          disabledActions: busy ? { merge: t.working, checkout: t.working, back: t.working, cleanup: t.working, open: t.working, create: t.working, start: t.working, retry: t.working, continue: t.working } : {},
          onAction: runAction,
          entries,
          entriesReady,
          sessionId,
          onOpenSession: () => { if (!openNativeSession(sessionId)) say(t.openSessionFailed, true) },
          onStartSession: () => runAction(selectedTask.task.sessionId ? 'open' : 'start'),
          diff,
          diffLoading,
          diffError,
          onRetryDiff: () => setDiffTick((n: number) => n + 1),
          baseSha,
          headSha,
          onToggleRail: () => setRailHidden((v: boolean) => !v),
          onToggleInspector: () => setInspectorHidden((v: boolean) => !v),
        })
        : selectedProject
          ? h('div', { className: 'dshwd-management' },
            h('div', { className: 'dshw-scope' + (theme === 'dark' ? ' dshw-dark' : ''), style: { height: '100%' } },
              h(ProjectDetail, {
                view: selectedProject,
                cfg: null,
                pendingMap,
                sessionMap,
                t,
                railHidden,
                inspectorHidden,
                onToggleRail: () => setRailHidden((v: boolean) => !v),
                onToggleInspector: () => setInspectorHidden((v: boolean) => !v),
                notify: say,
                onChanged: refresh,
                onPublish: () => openPublish(selectedProject.project.id),
                onSelectTask: (id: string) => selectTask(id, selectedProject.project.id),
                onDeleted: refresh,
              })))
          : h('main', { className: 'dshwd-stage' },
            h('div', { className: 'dshwd-topbar' },
              h('div', { className: 'dshwd-topbar-left' },
                h('button', { className: 'dshwd-btn dshwd-btn-ghost', onClick: () => setRailHidden((v: boolean) => !v) }, '◧'),
                h('span', { className: 'dshwd-breadcrumb' }, err || (loaded ? t.demoSelectTask : t.loading)))),
            h('div', { className: 'dshwd-empty', style: { flex: '1' } },
              h('div', { className: 'dshwd-empty-title' }, err ? t.connectionLost : loaded ? t.demoSelectTask : t.loading),
              h('div', { className: 'dshwd-hint' }, err ? err : t.demoSelectTaskHint),
              err ? h('button', { className: 'dshwd-btn', onClick: () => void refresh(true) }, t.retry) : null)),

      selectedTask
        ? h(Inspector, {
          t,
          taskView: selectedTask,
          archived,
          previewState,
          baseSha,
          headSha,
          baseLabel: selectedTask.task.baseBranch,
          busy,
          canArchive,
          archiveReason,
          onCopy: (text: string) => { copyText(text); say(t.copied) },
          onArchive: () => archiveTask(false),
          onUnarchive: () => archiveTask(true),
          onCleanup: runCleanup,
        })
        : null),

    publishOpen
      ? h(PublishModal, {
        t,
        views,
        initialProjectId: publishProjectId,
        parentId: publishParentId,
        onClose: () => setPublishOpen(false),
        onPublished: (task: any, project: any, warning?: string, continued?: boolean) => {
          setPublishOpen(false)
          if (task) {
            setViews((prev: any) => upsertPublishedTask(prev, task, project.id, continued ? 'developing' : 'ready'))
            setSelectedTaskId(task.id)
            setSelectedProjectId(project.id)
            setTab('overview')
          }
          say(warning || t.published)
          void refresh()
        },
        onCheckPublished: checkPublished,
      })
      : null,

    confirm ? h(ConfirmDialog, {
      t,
      title: confirm.title,
      body: confirm.body,
      label: confirm.label,
      danger: !!confirm.danger,
      busy: !!busy,
      onCancel: () => setConfirm(null),
      onConfirm: () => {
        if (!confirm.run) return
        setBusy('confirm')
        Promise.resolve(confirm.run())
          .catch((e: any) => say(String((e && e.message) || t.failed), true))
          .finally(() => { setBusy(''); setConfirm(null) })
      },
    }) : null,

    toast ? h('div', { className: 'dshwd-toast dshwd-show' + (toast.error ? ' dshwd-error' : ''), role: 'status' }, toast.message) : null)
}

function ConfirmDialog(props: any) {
  const { t } = props
  return h('div', { className: 'dshwd-modal-backdrop', onMouseDown: (e: any) => { if (e.target === e.currentTarget && !props.busy) props.onCancel() } },
    h('div', { className: 'dshwd-modal dshwd-modal-sm', role: 'dialog', 'aria-modal': 'true', 'aria-label': props.title },
      h('div', { className: 'dshwd-modal-head' },
        h('div', { className: 'dshwd-modal-title' }, props.title),
        h('button', { className: 'dshwd-btn dshwd-btn-ghost', onClick: props.onCancel, disabled: props.busy }, '×')),
      h('div', { className: 'dshwd-modal-body' },
        h('div', { className: 'dshwd-prose', style: { fontSize: '12.5px' } }, props.body)),
      h('div', { className: 'dshwd-modal-foot' },
        h('span', { className: 'dshwd-modal-foot-meta' }),
        h('div', { className: 'dshwd-modal-foot-actions' },
          h('button', { className: 'dshwd-btn', disabled: props.busy, onClick: props.onCancel }, t.cancel),
          h('button', { className: 'dshwd-btn ' + (props.danger ? 'dshwd-btn-danger' : 'dshwd-btn-cta'), disabled: props.busy, onClick: props.onConfirm },
            props.busy ? t.working : props.label)))))
}
