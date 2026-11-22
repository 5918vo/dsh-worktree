/**
 * Data & subscription hooks for the workbench board:
 * - project/task polling with exponential backoff and focus refresh
 * - uiSession running/pending status subscription
 * - auto-binding tool-published tasks to remote sessions
 * - live session timeline, per-task diff, and merge-preview polling
 */

import { React } from '../ui'
import { appCtx, getJson, post, bindSession } from '../context'
import { visibleProjectViews } from '../board-data'
import { createPreviewController, shouldPollPreview } from '../merge-preview'
import { buildHistoryEntries } from '../timeline'
import { diffHeadSha } from '../model'
import type { ProjectView, TaskDiff, TaskView, WorktreeTask } from '../../models'

export interface UseBoardDataArgs {
  t: Record<string, any>
  showArchived: boolean
  selectedTaskId: string
  selectedProjectId: string
  setSelectedTaskId: (updater: string | ((prev: string) => string)) => void
  setSelectedProjectId: (updater: string | ((prev: string) => string)) => void
}

export function useBoardData(args: UseBoardDataArgs) {
  const { t, showArchived, selectedTaskId, selectedProjectId, setSelectedTaskId, setSelectedProjectId } = args
  const [views, setViews] = React.useState([] as ProjectView[])
  const [loaded, setLoaded] = React.useState(false)
  const [err, setErr] = React.useState('')
  const [sessionMap, setSessionMap] = React.useState({} as Record<string, boolean>)
  const [pendingMap, setPendingMap] = React.useState({} as Record<string, string>)
  const [entries, setEntries] = React.useState([] as any[])
  const [entriesReady, setEntriesReady] = React.useState(false)
  const [diff, setDiff] = React.useState(null as TaskDiff | null)
  const [diffLoading, setDiffLoading] = React.useState(false)
  const [diffError, setDiffError] = React.useState('')
  const [diffTick, setDiffTick] = React.useState(0)
  const [previewState, setPreviewState] = React.useState({ phase: 'idle' } as any)

  const refreshSeq = React.useRef(0)
  const failures = React.useRef(0)
  const online = React.useRef(true)
  const bindingRef = React.useRef(new Set<string>())
  const previewRef = React.useRef(null as any)
  const remotes = appCtx && appCtx.remote
  const remotesRef = React.useRef(remotes)
  remotesRef.current = remotes

  const selectedTask: TaskView | null = views.flatMap((v: ProjectView) => v.tasks).find((v: TaskView) => v.task.id === selectedTaskId) || null
  const selectedProject: ProjectView | null = views.find((v: ProjectView) => v.project.id === selectedProjectId) || null
  const projectOfTask: ProjectView | null = selectedTask
    ? views.find((v: ProjectView) => v.tasks.some((x: TaskView) => x.task.id === selectedTask.task.id)) || selectedProject
    : selectedProject

  const refresh = React.useCallback(async (_manual?: boolean) => {
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
      // Keep archived tasks selected too: the board fetches them all, and the
      // "show archived" toggle must be able to open one without the next poll
      // dropping the selection.
      setSelectedTaskId((prev: string) => prev && list.some((v) => v.tasks.some((x) => x.task.id === prev)) ? prev : '')
      setSelectedProjectId((prev: string) => {
        if (prev && list.some((v) => v.project.id === prev)) return prev
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

  // Background polling with exponential backoff on network errors.
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

  // First paint selects the first visible task so the three-zone layout is immediately populated.
  const initialSelect = React.useRef(false)
  React.useEffect(() => {
    if (initialSelect.current || !loaded) return
    initialSelect.current = true
    if (!selectedTaskId) {
      const visible = visibleProjectViews(views, showArchived)
      const project = selectedProjectId ? visible.find((v) => v.project.id === selectedProjectId) : null
      const first = project && project.tasks.length ? project : visible.find((v) => v.tasks.length)
      if (first) {
        setSelectedTaskId(first.tasks[0].task.id)
        setSelectedProjectId(first.project.id)
      }
    }
  }, [loaded, views, selectedTaskId, selectedProjectId, showArchived])

  // Subscribe to host session running / pending-interaction state.
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

  const runningOf = (task: WorktreeTask | null | undefined) => task && task.sessionId ? !!sessionMap[task.sessionId] : false

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

  // Live session timeline polling.
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
  React.useEffect(() => {
    previewRef.current = null
    if (!selectedTask) { setPreviewState({ phase: 'idle' }); return }
    const snap = selectedTask.snapshot
    // Merged/cleaned tasks keep whatever the last review-time preflight said;
    // drop it so the inspector reports the completed lifecycle instead.
    if (snap.status === 'merged' || snap.status === 'cleaned') { setPreviewState({ phase: 'idle' }); return }
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
  }, [
    selectedTask && selectedTask.task.id,
    selectedTask && selectedTask.snapshot.status,
    selectedTask && selectedTask.snapshot.branchExists,
    selectedTask && selectedTask.snapshot.worktree.ahead,
    selectedTask && selectedTask.snapshot.postMergeAhead,
  ])

  const checkPublished = async (): Promise<TaskView | undefined> => {
    try {
      const d: any = await getJson('projects?includeArchived=1')
      const list: ProjectView[] = d.projects || []
      setViews(list)
      const cutoff = Date.now() - 10 * 60 * 1000
      const fresh = list.flatMap((v) => v.tasks).filter((v) => (v.task.createdAt || 0) >= cutoff)
      fresh.sort((a, b) => (b.task.createdAt || 0) - (a.task.createdAt || 0))
      const found = fresh[0]
      if (!found) return undefined
      setSelectedTaskId(found.task.id)
      setSelectedProjectId(found.task.projectId)
      return found
    } catch {
      return undefined
    }
  }

  return {
    views,
    setViews,
    loaded,
    err,
    remotes,
    sessionMap,
    pendingMap,
    entries,
    entriesReady,
    sessionId,
    diff,
    diffLoading,
    diffError,
    headSha,
    retryDiff: () => setDiffTick((n: number) => n + 1),
    previewState,
    previewRef,
    selectedTask,
    selectedProject,
    projectOfTask,
    runningOf,
    refresh,
    checkPublished,
  }
}
