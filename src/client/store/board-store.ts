import { React } from '../ui'
import { getJson } from '../context'
import { upsertPublishedTask } from '../board-data'
import type { ProjectView, TaskStatus, WorktreeTask } from '../../models'
import type { AttentionFilterValue } from '../attention-filter'

export interface BoardState {
  projectViews: ProjectView[]
  cfg: any
  env: any
  loaded: boolean
  refreshing: boolean
  error: string
  lastOkAt: number
  query: string
  attentionFilter: AttentionFilterValue
  showArchived: boolean
  selectedProjectId: string
  selectedTaskId: string
  showDetail: boolean
  collapsed: Record<string, boolean>
  repoBusy: Record<string, string>
  taskBusy: Record<string, string>
}

const initialState: BoardState = {
  projectViews: [],
  cfg: null,
  env: null,
  loaded: false,
  refreshing: false,
  error: '',
  lastOkAt: 0,
  query: '',
  attentionFilter: 'all',
  showArchived: false,
  selectedProjectId: '',
  selectedTaskId: '',
  showDetail: false,
  collapsed: {},
  repoBusy: {},
  taskBusy: {},
}

class BoardStore {
  private state: BoardState = { ...initialState }
  private listeners = new Set<() => void>()
  private refreshSeq = 0
  private failures = 0
  private pollTimer: number | null = null
  private activeSubscribers = 0

  getState = (): BoardState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    this.activeSubscribers += 1
    if (this.activeSubscribers === 1) this.startPolling()
    return () => {
      this.listeners.delete(listener)
      this.activeSubscribers -= 1
      if (this.activeSubscribers <= 0) this.stopPolling()
    }
  }

  private setState(patch: Partial<BoardState> | ((prev: BoardState) => Partial<BoardState>)) {
    const nextPatch = typeof patch === 'function' ? patch(this.state) : patch
    this.state = { ...this.state, ...nextPatch }
    for (const fn of this.listeners) fn()
  }

  async loadConfig() {
    try {
      const d = await getJson('config')
      this.setState({ cfg: d.config ?? null, env: d.environment ?? null })
    } catch { /* ignore */ }
  }

  async refresh(manual = false, t?: any) {
    const seq = ++this.refreshSeq
    if (manual) this.setState({ refreshing: true })
    try {
      const d = await getJson('projects?includeArchived=1')
      if (seq !== this.refreshSeq) return
      const list: ProjectView[] = d.projects || []
      this.failures = 0
      this.setState((prev) => ({
        projectViews: list,
        selectedTaskId: prev.selectedTaskId && list.some((pv) => pv.tasks.some((v) => v.task.id === prev.selectedTaskId))
          ? prev.selectedTaskId
          : '',
        selectedProjectId: prev.selectedProjectId && list.some((pv) => pv.project.id === prev.selectedProjectId)
          ? prev.selectedProjectId
          : (list[0]?.project.id ?? ''),
        lastOkAt: Date.now(),
        error: '',
        loaded: true,
        refreshing: false,
      }))
    } catch (e: any) {
      if (seq !== this.refreshSeq) return
      this.failures += 1
      const msg = String(e?.message || '')
      const offline = !navigator.onLine || /failed to fetch|networkerror|load failed|abort|timed out/i.test(msg)
      this.setState({
        error: offline ? (t?.connectionLost || '连接已断开') : (msg || t?.loadFailed || '加载失败'),
        loaded: true,
        refreshing: false,
      })
    }
  }

  private startPolling() {
    void this.loadConfig()
    const tick = async () => {
      if (!document.hidden) await this.refresh(false)
      const delay = this.failures ? Math.min(30_000, 4000 * Math.pow(2, Math.min(this.failures, 3))) : 4000
      this.pollTimer = window.setTimeout(tick, delay)
    }
    void tick()
    window.addEventListener('focus', this.onVisible)
    document.addEventListener('visibilitychange', this.onVisible)
  }

  private stopPolling() {
    if (this.pollTimer !== null) {
      window.clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
    window.removeEventListener('focus', this.onVisible)
    document.removeEventListener('visibilitychange', this.onVisible)
  }

  private onVisible = () => {
    if (!document.hidden) void this.refresh(false)
  }

  setQuery = (query: string) => this.setState({ query })
  setAttentionFilter = (attentionFilter: AttentionFilterValue) => this.setState({ attentionFilter })
  toggleArchived = () => this.setState((s) => ({ showArchived: !s.showArchived }))
  setShowDetail = (showDetail: boolean) => this.setState({ showDetail })

  toggleCollapse = (projectId: string) =>
    this.setState((s) => ({ collapsed: { ...s.collapsed, [projectId]: !s.collapsed[projectId] } }))

  selectProject = (projectId: string) =>
    this.setState((s) => ({
      selectedProjectId: projectId,
      selectedTaskId: '',
      showDetail: true,
      collapsed: { ...s.collapsed, [projectId]: false },
    }))

  selectTask = (taskId: string, projectId?: string) =>
    this.setState((s) => {
      const owner =
        projectId ||
        s.projectViews.find((pv) => pv.tasks.some((v) => v.task.id === taskId))?.project.id ||
        s.selectedProjectId
      return {
        selectedTaskId: taskId,
        selectedProjectId: owner,
        showDetail: true,
        collapsed: owner ? { ...s.collapsed, [owner]: false } : s.collapsed,
      }
    })

  setRepoBusy = (repoPath: string, active: boolean, label: string) => {
    if (!repoPath) return
    this.setState((s) => {
      const next = { ...s.repoBusy }
      if (active) next[repoPath] = label || '…'
      else delete next[repoPath]
      return { repoBusy: next }
    })
  }

  setTaskBusy = (taskId: string, action: string | null) =>
    this.setState((s) => {
      const next = { ...s.taskBusy }
      if (action) next[taskId] = action
      else delete next[taskId]
      return { taskBusy: next }
    })

  optimisticPublish = (task: WorktreeTask, projectId?: string) => {
    const status: TaskStatus = task.sessionId ? 'developing' : 'ready'
    this.setState((s) => ({
      projectViews: upsertPublishedTask(s.projectViews, task, projectId, status),
      selectedProjectId: projectId || s.selectedProjectId,
      selectedTaskId: task.id,
      showDetail: true,
    }))
  }
}

export const boardStore = new BoardStore()

export function useBoardStore<T>(selector: (state: BoardState) => T): T {
  const [, forceUpdate] = React.useState(0)
  const selectedRef = React.useRef(selector(boardStore.getState()))
  const selectorRef = React.useRef(selector)
  selectorRef.current = selector

  React.useEffect(() => {
    return boardStore.subscribe(() => {
      const next = selectorRef.current(boardStore.getState())
      if (!Object.is(selectedRef.current, next)) {
        selectedRef.current = next
        forceUpdate((n: number) => n + 1)
      }
    })
  }, [])

  return selector(boardStore.getState())
}
