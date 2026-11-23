import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir, hostname } from 'node:os'
import { randomUUID } from 'node:crypto'
import { normalizeCriteria } from './criteria.js'
import { normalizeDependencyIds, validateDependencyIds, type DependencyIssue } from './task-deps.js'
import { NOTES_MAX_LENGTH, normalizePriority, normalizeTags, parseDueAt, validateTags } from './task-meta.js'
import { StoreError } from './errors.js'

// Re-exported for callers that catch store failures without importing errors.js.
export { StoreError }
import { BindLease, Project, SessionOwner, TaskTemplate, WorktreeTask } from './models.js'

/** One DSH process that shares this ledger, refreshed by a heartbeat file. */
export interface InstanceLease {
  instanceId: string
  pid: number
  host?: string
  startedAt?: number
  at?: number
  /**
   * Session ids this process currently has a *running* agent for.
   * Absent means "this build does not publish run state", which forces other
   * instances to answer 'unknown' instead of guessing 'idle'.
   */
  running?: string[]
}

/** Contents of `.store.lock`; the token proves ownership on release. */
export interface LockInfo {
  pid?: number
  host?: string
  token?: string
  at?: number
}

/** Outcome of claiming the exclusive right to bind a task session. */
export type ClaimResult =
  | { ok: true; task: WorktreeTask; lease: BindLease }
  | { ok: false; conflict: 'missing' | 'task-bound' | 'lease-held'; other?: WorktreeTask }

/** Outcome of an atomic session binding; callers translate conflicts into 409s. */
export type BindSessionResult =
  | { ok: true; task: WorktreeTask }
  | { ok: false; conflict: 'missing' | 'session-taken' | 'task-bound' | 'lease-lost'; other?: WorktreeTask }

/** Outcome of checking one acceptance criterion; callers map it to 404 / 400. */
export type CriterionResult =
  | { ok: true; task: WorktreeTask }
  | { ok: false; reason: 'missing' | 'unknown' }

/** Outcome of an atomic pin toggle; `missing` maps to 404. */
export type PinResult =
  | { ok: true; task: WorktreeTask }
  | { ok: false; reason: 'missing' }

/** Outcome of saving a template; `missing` maps to 404. */
export type TemplateResult =
  | { ok: true; item: TaskTemplate; templates: TaskTemplate[] }
  | { ok: false; reason: 'missing' }

/** Presentation fields updated together by the meta endpoint. */
export type TaskMetaPatch = {
  tags?: unknown
  priority?: unknown
  notes?: unknown
  dependsOn?: unknown
  dueAt?: unknown
}

/** Outcome of an atomic metadata update; callers map reasons to 404 / 400. */
export type TaskMetaResult =
  | { ok: true; task: WorktreeTask }
  | {
    ok: false
    reason:
      | 'missing'
      | 'tags-too-many'
      | 'tags-too-long'
      | 'priority-invalid'
      | 'due-invalid'
      | 'notes-too-long'
      | 'deps-too-many'
      | 'deps-self'
      | 'deps-missing'
      | 'deps-cross-project'
      | 'deps-cycle'
  }

/** Map a dependency validation issue to the store-level failure reason. */
function dependencyReason(issue: DependencyIssue):
  | 'deps-too-many'
  | 'deps-self'
  | 'deps-missing'
  | 'deps-cross-project'
  | 'deps-cycle' {
  switch (issue) {
    case 'too-many': return 'deps-too-many'
    case 'self': return 'deps-self'
    case 'cross-project': return 'deps-cross-project'
    case 'cycle': return 'deps-cycle'
    default: return 'deps-missing'
  }
}

/**
 * One global task store for every DSH process on this machine.
 *
 * Deliberately independent of the DSH profile and the web port: a task
 * published from `dsh web --port 3080` must be visible from `--port 3090`.
 */
export function stateDir(): string {
  return join(homedir(), '.dsh', 'worktree-tasks')
}

/** How long a `.store.lock` may sit before another process may take it over. */
const LOCK_STALE_MS = 30_000
/** Hard cap on waiting for the lock; timing out fails instead of writing unlocked. */
// Two seconds is plenty for a ledger-sized write; a longer freeze would be felt
// by the UI, and the failure mode (loud 503) is better than waiting longer.
const LOCK_WAIT_MS = 2_000
/** An empty/partial lock file is only trusted for this long (crash mid-write). */
const LOCK_PARTIAL_MS = 2_000
/** Instance heartbeat cadence and the age at which an instance counts as gone. */
const INSTANCE_BEAT_MS = 3_000
const INSTANCE_STALE_MS = 30_000
/** A peer heartbeat older than this cannot be trusted to list every running session. */
const INSTANCE_FRESH_MS = 10_000
/** Default validity of a publish bind lease. */
const BIND_LEASE_MS = 60_000
const WRITE_RETRIES = 5
const WRITE_RETRY_MS = 10

export interface StoreOptions {
  /** How long a blocked mutation waits for `.store.lock` before failing. */
  lockWaitMs?: number
  /** How long a bind lease stays valid before another client may take it. */
  bindLeaseMs?: number
  /** Run the instance heartbeat (default true; tests may disable it). */
  heartbeat?: boolean
  /** Test-only stale threshold; production uses LOCK_STALE_MS. */
  lockStaleMs?: number
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function isMissing(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as any).code === 'ENOENT'
}

const quarantined = new Set<string>()

function readJsonSync<T>(file: string, fallback: T, onCorrupt?: (file: string, detail: string) => void): T {
  let raw: string
  try {
    raw = readFileSync(file, 'utf8')
  } catch (error) {
    if (!isMissing(error)) onCorrupt?.(file, describeError(error))
    return fallback
  }
  try {
    return JSON.parse(raw) as T
  } catch (error) {
    // Keep the broken bytes next to the original before the next save replaces
    // them: a corrupt ledger must leave evidence instead of vanishing. Once per
    // process and file — a refresh loop must not litter the directory.
    if (!quarantined.has(file)) {
      quarantined.add(file)
      try {
        copyFileSync(file, `${file}.corrupt-${Date.now()}`)
      } catch {
        /* best effort only */
      }
    }
    onCorrupt?.(file, describeError(error))
    return fallback
  }
}

/**
 * Write JSON atomically: a unique temp file, then rename over the target.
 *
 * The previous version silently fell back to an in-place write and swallowed
 * both errors, so a full disk or a locked destination reported success while
 * the ledger still held the old bytes (or a half-written file). Failures now
 * throw `StoreError`, which the HTTP and tool layers turn into 5xx.
 */
function writeJsonSync(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true })
  const text = JSON.stringify(value, null, 2)
  const tmp = `${file}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`
  let failure: unknown = null
  try {
    writeFileSync(tmp, text, { encoding: 'utf8', mode: 0o600 })
  } catch (error) {
    failure = error
  }
  if (failure === null) {
    for (let attempt = 0; attempt < WRITE_RETRIES; attempt += 1) {
      try {
        renameSync(tmp, file)
        return
      } catch (error) {
        failure = error
        // Windows can briefly hold the destination open (virus scanner, indexer).
        if (attempt < WRITE_RETRIES - 1) sleepSync(WRITE_RETRY_MS)
      }
    }
  }
  try {
    rmSync(tmp, { force: true })
  } catch {
    /* a leftover temp file is harmless; the next save uses a new name */
  }
  throw new StoreError(`任务台账写入失败：${file}（${describeError(failure)}）`, 'store-write', 500)
}

/**
 * Blocking sleep that parks the thread instead of spinning on the clock.
 *
 * The store keeps a synchronous public API (the host calls it from sync paths),
 * so waiting for the cross-process lock cannot be awaited; `Atomics.wait` keeps
 * the wait bounded and CPU-free. The wait never exceeds `lockWaitMs`, and a
 * timeout throws rather than writing without the lock.
 */
function sleepSync(ms: number): void {
  if (!(ms > 0)) return
  const view = new Int32Array(new SharedArrayBuffer(4))
  Atomics.wait(view, 0, 0, ms)
}

function pidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  if (pid === process.pid) return true
  try {
    process.kill(pid, 0)
    return true
  } catch (error: any) {
    // EPERM: the process exists but belongs to another user.
    return error && error.code === 'EPERM'
  }
}

function readLockInfo(file: string): LockInfo | null {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    return parsed && typeof parsed === 'object' ? (parsed as LockInfo) : null
  } catch {
    return null
  }
}

function staleByInfo(info: LockInfo | null, now = Date.now(), staleMs = LOCK_STALE_MS): boolean {
  if (!info || typeof info.token !== 'string') return false
  const at = Number(info.at) || 0
  if (at > 0 && now - at > staleMs) return true
  if (info.host === hostname() && Number.isInteger(info.pid) && !pidAlive(Number(info.pid))) return true
  return false
}

function describeLockOwner(info: LockInfo | null): string {
  if (!info || typeof info.pid !== 'number') return '未知进程'
  return `pid ${info.pid}`
}

/**
 * Durable store for projects, task records and recent target directories.
 *
 * All reads and writes go through the files under `dir`, so multiple DSH
 * processes share the same state even when they were started from different
 * profiles or ports. Mutations take a small cross-process lock and are
 * read-modify-write, which keeps one process from overwriting another's task.
 */
export class Store {
  private readonly dir: string
  private readonly migrateLegacy: boolean
  private readonly instanceId = randomUUID()
  private readonly startedAt = Date.now()
  private readonly lockWaitMs: number
  private readonly lockStaleMs: number
  private readonly bindLeaseMs: number
  private readonly heartbeatEnabled: boolean
  private beatTimer: ReturnType<typeof setInterval> | null = null
  private inBeat = false
  /** Sessions this process runs; defaults to none so a missed wiring is safe. */
  private runningProvider: () => readonly string[] = () => []
  /** Sessions confirmed running since the last heartbeat. */
  private readonly runHints = new Set<string>()
  private lastBeatAt = 0
  private readWarnings: string[] = []
  private projects = new Map<string, Project>()
  private tasks = new Map<string, WorktreeTask>()
  private recents: string[] = []
  private criteria: string[] = []
  private templates: TaskTemplate[] = []

  constructor(dir = stateDir(), options?: StoreOptions) {
    this.dir = dir
    this.migrateLegacy = dir === stateDir()
    this.lockWaitMs = Math.max(50, Number(options?.lockWaitMs) || LOCK_WAIT_MS)
    this.lockStaleMs = Math.max(50, Number(options?.lockStaleMs) || LOCK_STALE_MS)
    this.bindLeaseMs = Math.max(1_000, Number(options?.bindLeaseMs) || BIND_LEASE_MS)
    this.heartbeatEnabled = options?.heartbeat !== false
  }

  /** This process's identity in the shared ledger. */
  instance(): { instanceId: string; pid: number; host: string } {
    return { instanceId: this.instanceId, pid: process.pid, host: hostname() }
  }

  /**
   * Ledger reads that fell back instead of failing (corrupt or unreadable file).
   * The host logs these; they are the evidence trail for a damaged ledger.
   */
  warnings(): string[] {
    return [...this.readWarnings]
  }

  private noteRead(file: string, detail: string): void {
    const line = `${file}: ${detail}`
    if (this.readWarnings.includes(line)) return
    this.readWarnings.push(line)
    if (this.readWarnings.length > 20) this.readWarnings.shift()
  }

  private file(name: string): string {
    return join(this.dir, name)
  }

  private read(file: string): any {
    return readJsonSync<any>(file, undefined, (target, detail) => {
      this.noteRead(target, detail)
      // A missing file is a valid first run; malformed or unreadable existing
      // state must never be refreshed into an empty map and saved over itself.
      throw new StoreError(`任务台账读取失败，已阻止覆盖原数据：${target}（${detail}）`, 'store-read', 500)
    })
  }

  private readProjects(): Record<string, Project> {
    return this.read(this.file('projects.json')) || {}
  }

  private readTasks(): Record<string, WorktreeTask> {
    return this.read(this.file('tasks.json')) || {}
  }

  private readRecents(): string[] {
    const value = this.read(this.file('recents.json'))
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
  }

  private readCriteria(): string[] {
    const value = this.read(this.file('acceptance-criteria.json'))
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : []
  }

  /** Templates are an array; malformed rows are dropped instead of failing the board. */
  private readTemplates(): TaskTemplate[] {
    const value = this.read(this.file('templates.json'))
    if (!Array.isArray(value)) return []
    return value
      .filter((item) => item && typeof item.id === 'string' && item.id && typeof item.name === 'string' && item.name.trim())
      .map((item) => ({
        id: String(item.id),
        name: String(item.name).trim(),
        title: String(item.title || ''),
        description: String(item.description || ''),
        criteria: normalizeCriteria(item.criteria),
        createdAt: Number(item.createdAt) || 0,
        ...(item.updatedAt ? { updatedAt: Number(item.updatedAt) } : {}),
      }))
  }

  /**
   * 以磁盘为基线刷新：磁盘上已不存在的键必须删掉。
   * JSON 会丢弃 undefined，只做 Object.assign 会让旧字段（如 pendingOp）
   * 在本进程内存里复活，并在下一次写入时被写回共享文件。
   */
  private refreshProjects(): void {
    const disk = this.readProjects()
    const next = new Map<string, Project>()
    for (const [id, project] of Object.entries(disk)) {
      const current = this.projects.get(id)
      if (current) {
        for (const key of Object.keys(current)) {
          if (!(key in project)) delete (current as any)[key]
        }
        Object.assign(current, project)
        next.set(id, current)
      } else {
        next.set(id, project)
      }
    }
    this.projects = next
  }

  private refreshTasks(): void {
    const disk = this.readTasks()
    const next = new Map<string, WorktreeTask>()
    for (const [id, task] of Object.entries(disk)) {
      const current = this.tasks.get(id)
      if (current) {
        for (const key of Object.keys(current)) {
          if (!(key in task)) delete (current as any)[key]
        }
        Object.assign(current, task)
        next.set(id, current)
      } else {
        next.set(id, task)
      }
    }
    this.tasks = next
  }

  private refreshRecents(): void {
    this.recents = this.readRecents()
  }

  private refreshCriteria(): void {
    this.criteria = this.readCriteria()
  }

  private refreshTemplates(): void {
    this.templates = this.readTemplates()
  }

  private saveProjects(): void {
    writeJsonSync(this.file('projects.json'), Object.fromEntries(this.projects))
  }

  private saveTasks(): void {
    writeJsonSync(this.file('tasks.json'), Object.fromEntries(this.tasks))
  }

  private saveRecents(): void {
    writeJsonSync(this.file('recents.json'), this.recents)
  }

  private saveCriteria(): void {
    writeJsonSync(this.file('acceptance-criteria.json'), this.criteria)
  }

  private saveTemplates(): void {
    writeJsonSync(this.file('templates.json'), this.templates)
  }

  private saveAll(): void {
    this.saveProjects()
    this.saveTasks()
    this.saveRecents()
    this.saveCriteria()
    this.saveTemplates()
  }

  /**
   * Run `fn` while holding the cross-process ledger lock.
   *
   * The old version gave up after 3s and ran `fn` *without* the lock, and its
   * `finally` deleted whatever lock file happened to be there. Both are
   * disqualifying for a read-modify-write ledger, so acquisition now either
   * owns the lock (verified by token) or throws `StoreError` (503).
   */
  private withLock<T>(fn: () => T): T {
    mkdirSync(this.dir, { recursive: true })
    this.beat()
    const { fd, token } = this.acquireLock()
    try {
      return fn()
    } finally {
      this.releaseLock(fd, token)
    }
  }

  private acquireLock(): { fd: number; token: string } {
    const lock = this.file('.store.lock')
    const deadline = Date.now() + this.lockWaitMs
    let delay = 1
    for (;;) {
      let fd: number | null = null
      try {
        fd = openSync(lock, 'wx')
      } catch (error: any) {
        if (error?.code !== 'EEXIST') {
          throw new StoreError(`任务台账锁无法创建：${lock}（${describeError(error)}）`, 'store-lock', 503)
        }
      }
      if (fd !== null) {
        const token = randomUUID()
        try {
          writeFileSync(fd, JSON.stringify({ pid: process.pid, host: hostname(), token, at: Date.now() }), 'utf8')
        } catch (error) {
          try {
            closeSync(fd)
          } catch {
            /* noop */
          }
          try {
            rmSync(lock, { force: true })
          } catch {
            /* noop */
          }
          throw new StoreError(`任务台账锁无法写入：${describeError(error)}`, 'store-lock', 503)
        }
        return { fd, token }
      }
      const info = readLockInfo(lock)
      // Never judge freshness, move the file and rename it back in separate
      // operations: a healthy writer could release/replace it in between. A
      // live same-host PID is authoritative and must not have its lock moved.
      if (info?.host === hostname() && pidAlive(Number(info.pid)) && Number(info.at) > 0) {
        // A live local owner can be stalled in synchronous disk I/O; its age is
        // not proof of abandonment. Never move its pathname out from under it.
      } else if (this.lockIsStale(info)) {
        this.takeOverStaleLock(lock)
        continue
      }
      if (Date.now() >= deadline) {
        throw new StoreError(
          `任务台账正被另一个 DSH 进程写入（${describeLockOwner(info)}），本次修改未执行，请稍后重试`,
          'store-lock',
          503,
        )
      }
      sleepSync(delay)
      delay = Math.min(25, delay * 2)
    }
  }

  private lockIsStale(info: LockInfo | null): boolean {
    const lock = this.file('.store.lock')
    let age = 0
    try {
      age = Date.now() - statSync(lock).mtimeMs
    } catch {
      // Gone already: treat as free so the caller retries `openSync`.
      return true
    }
    if (staleByInfo(info, Date.now(), this.lockStaleMs)) return true
    // No readable owner record: only a crashed mid-write can produce that, and
    // it is indistinguishable from a live creator for a few milliseconds.
    if (!info || typeof info.token !== 'string') return age > LOCK_PARTIAL_MS
    return false
  }

  /**
   * Move a stale lock aside and delete it. The rename is atomic, so exactly one
   * contender wins; the loser simply retries `openSync`.
   */
  private takeOverStaleLock(lock: string): void {
    const aside = `${lock}.stale-${process.pid}-${randomUUID().slice(0, 8)}`
    try {
      renameSync(lock, aside)
    } catch {
      return
    }
    const info = readLockInfo(aside)
    // Prove the moved file is the one we judged stale. A live owner may have
    // replaced the lock between stat and rename; put it back untouched then.
    if (staleByInfo(info, Date.now(), this.lockStaleMs)) {
      try {
        rmSync(aside, { force: true })
      } catch {
        /* noop */
      }
      return
    }
    if (info && typeof info.token === 'string') {
      try {
        renameSync(aside, lock)
      } catch {
        /* the path is taken again; keep the aside copy as evidence */
      }
      return
    }
    try {
      rmSync(aside, { force: true })
    } catch {
      /* noop */
    }
  }

  /**
   * Release only our own lock. The token is checked twice: once before the
   * rename-aside and once on the moved file, so a writer that lost its lock to
   * a stale takeover can never delete the new owner's lock.
   */
  private releaseLock(fd: number, token: string): void {
    try {
      closeSync(fd)
    } catch {
      /* noop */
    }
    const lock = this.file('.store.lock')
    const info = readLockInfo(lock)
    if (!info || info.token !== token) return
    const aside = `${lock}.rel-${token}`
    try {
      renameSync(lock, aside)
    } catch {
      return
    }
    const moved = readLockInfo(aside)
    if (moved && moved.token === token) {
      try {
        rmSync(aside, { force: true })
      } catch {
        /* noop */
      }
      return
    }
    try {
      renameSync(aside, lock)
    } catch {
      /* noop */
    }
  }

  private instancesDir(): string {
    return this.file('instances')
  }

  private instanceFile(): string {
    return join(this.instancesDir(), `${this.instanceId}.json`)
  }

  /** Publish this process's heartbeat so other instances can see it exists. */
  beat(force = false): void {
    const now = Date.now()
    // The provider can consult the ledger. Do not re-enter a lock wait from its
    // read path; retain the last successful run list until a complete beat.
    if (this.inBeat || (!force && now - this.lastBeatAt < INSTANCE_BEAT_MS)) return
    this.inBeat = true
    try {
      mkdirSync(this.instancesDir(), { recursive: true })
      const running = [...new Set([...this.runningProvider(), ...this.runHints])]
      const lease: InstanceLease = {
        instanceId: this.instanceId,
        pid: process.pid,
        host: hostname(),
        startedAt: this.startedAt,
        at: now,
        running,
      }
      writeFileSync(this.instanceFile(), JSON.stringify(lease, null, 2), { encoding: 'utf8', mode: 0o600 })
      this.lastBeatAt = now
      this.runHints.clear()
    } catch {
      // Liveness is advisory: a missed beat must not fail a ledger write.
    } finally {
      this.inBeat = false
    }
  }

  /** Instances that are still alive; stale heartbeat files are pruned. */
  listLiveInstances(): InstanceLease[] {
    const live: InstanceLease[] = []
    const now = Date.now()
    let names: string[] = []
    try {
      names = readdirSync(this.instancesDir())
    } catch {
      names = []
    }
    for (const name of names) {
      if (!name.endsWith('.json')) continue
      const file = join(this.instancesDir(), name)
      const info = readJsonSync<InstanceLease | null>(file, null)
      if (!info || typeof info.instanceId !== 'string') continue
      const sameHost = !info.host || info.host === hostname()
      const at = Number(info.at) || 0
      const alive = now - at <= INSTANCE_STALE_MS && (!sameHost || pidAlive(Number(info.pid)))
      if (alive) {
        live.push(info)
        continue
      }
      if (info.instanceId !== this.instanceId) {
        try {
          rmSync(file, { force: true })
        } catch {
          /* another process may be pruning it too */
        }
      }
    }
    if (!live.some((item) => item.instanceId === this.instanceId)) {
      live.push({ instanceId: this.instanceId, pid: process.pid, host: hostname(), startedAt: this.startedAt, at: now })
    }
    return live
  }

  /** True when another live DSH process shares this ledger. */
  hasOtherLiveInstance(): boolean {
    return this.listLiveInstances().some((item) => item.instanceId !== this.instanceId)
  }

  /**
   * Feed the heartbeat the sessions this process is running right now.
   * The host agent registry is process-local, so this list is the only way for
   * a second window to learn that a session bound to the shared ledger is busy.
   */
  setRunningSessionsProvider(provider: () => readonly string[]): void {
    if (typeof provider !== 'function') return
    this.runningProvider = provider
  }

  /**
   * Publish "this session is running" immediately, without waiting for the next
   * heartbeat. Cheap insurance against the few seconds between a session
   * starting to work and the next beat.
   */
  publishRunning(sessionId: string): void {
    if (!sessionId) return
    this.runHints.add(sessionId)
    this.beat(true)
  }

  /**
   * Run state of a session this process cannot see, according to live peers.
   *
   * 'running' — a live instance publishes it as running.
   * 'idle'    — every live instance publishes run state and none claims it.
   * 'unknown' — a live instance is too stale (or too old) to be asked; refuse
   *             rather than assume the session is finished.
   */
  lookupSessionRun(sessionId: string): 'running' | 'idle' | 'unknown' {
    const peers = this.listLiveInstances().filter((item) => item.instanceId !== this.instanceId)
    if (peers.some((item) => Array.isArray(item.running) && item.running.includes(sessionId))) return 'running'
    if (!peers.length) return 'idle'
    const now = Date.now()
    const answerable = peers.every(
      (item) => Array.isArray(item.running) && now - (Number(item.at) || 0) <= INSTANCE_FRESH_MS,
    )
    return answerable ? 'idle' : 'unknown'
  }

  /** Whether an instance id still belongs to a running DSH process. */
  isInstanceLive(instanceId: string): boolean {
    if (!instanceId) return false
    if (instanceId === this.instanceId) return true
    return this.listLiveInstances().some((item) => item.instanceId === instanceId)
  }

  /**
   * Keep the instance heartbeat fresh without holding the event loop open.
   * Other instances use it to decide whether "I cannot see that agent" means
   * "it finished" or "another process is running it".
   */
  private startHeartbeat(): void {
    if (!this.heartbeatEnabled || this.beatTimer) return
    this.beat(true)
    const timer = setInterval(() => this.beat(true), INSTANCE_BEAT_MS)
    if (typeof timer.unref === 'function') timer.unref()
    this.beatTimer = timer
  }

  private stopHeartbeat(): void {
    if (!this.beatTimer) return
    clearInterval(this.beatTimer)
    this.beatTimer = null
    try {
      rmSync(this.instanceFile(), { force: true })
    } catch {
      /* a leftover heartbeat expires on its own */
    }
  }

  async load(): Promise<void> {
    this.refreshProjects()
    this.refreshTasks()
    this.refreshRecents()
    this.refreshCriteria()
    this.refreshTemplates()
    this.startHeartbeat()
    if (!this.migrateLegacy) return
    const marker = this.file('.migrated-v2')
    this.withLock(() => {
      if (!existsSync(marker)) {
        this.migrateFromLegacyDirs()
        try {
          writeFileSync(marker, new Date().toISOString(), { encoding: 'utf8' })
        } catch {
          /* retry on the next boot */
        }
      }
      this.dedupeProjects()
    })
  }

  /**
   * One repository must have one project row. Older builds could create a
   * second row when two servers had separate stores; fold those tasks into the
   * project that has the most task history.
   */
  private dedupeProjects(): void {
    const groups = new Map<string, Project[]>()
    for (const project of this.projects.values()) {
      const key = project.repoPath.replace(/[\\/]+$/, '').toLowerCase()
      const list = groups.get(key)
      if (list) list.push(project)
      else groups.set(key, [project])
    }
    let changed = false
    for (const list of groups.values()) {
      if (list.length < 2) continue
      const taskCount = (project: Project) => {
        let count = 0
        for (const task of this.tasks.values()) if (task.projectId === project.id) count += 1
        return count
      }
      list.sort((a, b) => taskCount(b) - taskCount(a) || a.createdAt - b.createdAt)
      const canonical = list[0]
      for (const duplicate of list.slice(1)) {
        for (const task of this.tasks.values()) {
          if (task.projectId === duplicate.id) {
            task.projectId = canonical.id
            changed = true
          }
        }
        this.projects.delete(duplicate.id)
        changed = true
      }
    }
    if (!changed) return
    this.saveProjects()
    this.saveTasks()
  }

  /**
   * Pull tasks out of stores created by older builds (profile directories or
   * a custom DSH_WORKTREE_STATE_DIR). The old files are left in place.
   */
  private migrateFromLegacyDirs(): void {
    const candidates = new Set<string>()
    const explicit = process.env.DSH_WORKTREE_STATE_DIR
    if (explicit) candidates.add(explicit)
    const profile = process.env.DSH_PROFILE_DIR
    if (profile) candidates.add(join(profile, 'deepseek-worktree'))
    candidates.add(join(homedir(), '.dsh', 'worktree-web'))
    const profilesDir = join(homedir(), '.dsh', 'profiles')
    try {
      for (const name of readdirSync(profilesDir)) {
        candidates.add(join(profilesDir, name, 'deepseek-worktree'))
      }
    } catch {
      /* no profiles directory */
    }
    candidates.delete(this.dir)

    let changed = false
    for (const dir of candidates) {
      const projects = readJsonSync<Record<string, Project>>(join(dir, 'projects.json'), {})
      const tasks = readJsonSync<Record<string, WorktreeTask>>(join(dir, 'tasks.json'), {})
      const recents = readJsonSync<any>(join(dir, 'recents.json'), [])

      for (const [id, project] of Object.entries(projects)) {
        if (!this.projects.has(id)) {
          this.projects.set(id, project)
          changed = true
        }
      }
      for (const [id, task] of Object.entries(tasks)) {
        const current = this.tasks.get(id)
        if (!current || (task.updatedAt || 0) > (current.updatedAt || 0)) {
          this.tasks.set(id, task)
          changed = true
        }
      }
      if (Array.isArray(recents)) {
        for (const item of recents) {
          if (typeof item === 'string' && !this.recents.includes(item)) {
            this.recents.push(item)
            changed = true
          }
        }
      }
    }
    if (!changed) return
    this.recents = this.recents.slice(0, 10)
    this.saveAll()
  }

  directory(): string {
    return this.dir
  }

  // ---- projects ----

  listProjects(): Project[] {
    this.refreshProjects()
    return [...this.projects.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  getProject(id: string): Project | undefined {
    this.refreshProjects()
    return this.projects.get(id)
  }

  findProjectByRepo(repoPath: string): Project | undefined {
    this.refreshProjects()
    const norm = repoPath.replace(/[\\/]+$/, '').toLowerCase()
    return [...this.projects.values()].find((p) => p.repoPath.replace(/[\\/]+$/, '').toLowerCase() === norm)
  }

  putProject(project: Project): void {
    // 快照必须在加锁前拍下；锁内刷新磁盘可能改写同一个对象。
    const next: any = { ...project }
    const cleared: string[] = []
    for (const key of Object.keys(next)) {
      if (next[key] !== undefined) continue
      cleared.push(key)
      delete next[key]
    }
    this.withLock(() => {
      this.refreshProjects()
      // 显式清空：刷新可能把磁盘上的旧值写回同一个对象，必须再删一次。
      for (const key of cleared) delete (project as any)[key]
      Object.assign(project, next)
      this.projects.set(project.id, project)
      this.saveProjects()
    })
  }

  deleteProject(id: string): boolean {
    return this.withLock(() => {
      this.refreshProjects()
      const ok = this.projects.delete(id)
      if (ok) this.saveProjects()
      return ok
    })
  }

  // ---- tasks ----

  listTasks(): WorktreeTask[] {
    this.refreshTasks()
    return [...this.tasks.values()].sort((a, b) => b.createdAt - a.createdAt)
  }

  listTasksOfProject(projectId: string): WorktreeTask[] {
    return this.listTasks().filter((t) => t.projectId === projectId)
  }

  getTask(id: string): WorktreeTask | undefined {
    this.refreshTasks()
    return this.tasks.get(id)
  }

  putTask(task: WorktreeTask): void {
    task.updatedAt = Date.now()
    // Snapshot after the caller's mutation: refreshing from disk below may
    // update this same object, and must not erase fields like sessionId.
    // undefined 键要显式丢弃，锁内刷新已删掉磁盘上不存在的字段，
    // 这样“清空字段”才不会被旧值替代。
    const next: any = { ...task }
    const cleared: string[] = []
    for (const key of Object.keys(next)) {
      if (next[key] !== undefined) continue
      cleared.push(key)
      delete next[key]
    }
    this.withLock(() => {
      this.refreshTasks()
      // Session binding is owned by bindSession/unbindSession. A caller that
      // read the task before another process bound it must not write its stale
      // null over the fresh binding (and must not reopen start-on-bind).
      const current = this.tasks.get(task.id)
      if (current) {
        if (current.sessionId && !next.sessionId) next.sessionId = current.sessionId
        if (current.startOnBind === false && next.startOnBind !== false) next.startOnBind = false
        // Bind leases and session owners belong to claim/bind/unbind only: a
        // caller holding a stale copy must not erase them (or forge an owner).
        if (current.bindLease && !next.bindLease) next.bindLease = { ...current.bindLease }
        if (current.sessionOwner && !next.sessionOwner) next.sessionOwner = { ...current.sessionOwner }
      }
      // 显式清空：刷新可能把磁盘上的旧值写回同一个对象，必须再删一次。
      for (const key of cleared) delete (task as any)[key]
      Object.assign(task, next)
      this.tasks.set(task.id, task)
      this.saveTasks()
    })
  }

  /**
   * Claim the exclusive right to create+bind a session for one task.
   *
   * Session creation and the first prompt are remote calls that cannot be
   * rolled back, so the decision to start work is taken *before* them. The
   * claim is atomic across DSH processes (one critical section), idempotent per
   * client, and time-boxed: an expired lease can be taken over, which is the
   * recovery path when a window crashes mid-bind.
   */
  claimTask(taskId: string, owner: string, ttlMs = this.bindLeaseMs): ClaimResult {
    const client = String(owner || '').trim().slice(0, 120) || `pid-${process.pid}`
    return this.withLock(() => {
      this.refreshTasks()
      const task = this.tasks.get(taskId)
      if (!task) return { ok: false, conflict: 'missing' as const }
      if (task.sessionId) return { ok: false, conflict: 'task-bound' as const, other: task }
      const now = Date.now()
      const current = task.bindLease
      if (current && current.token && current.expiresAt > now) {
        if (current.owner !== client) return { ok: false, conflict: 'lease-held' as const, other: task }
        // Same window retrying: refresh in place so the token stays valid.
        current.instanceId = this.instanceId
        current.pid = process.pid
        current.at = now
        current.expiresAt = now + ttlMs
        task.updatedAt = now
        this.saveTasks()
        return { ok: true, task, lease: { ...current } }
      }
      const lease: BindLease = {
        token: randomUUID(),
        owner: client,
        instanceId: this.instanceId,
        pid: process.pid,
        at: now,
        expiresAt: now + ttlMs,
      }
      task.bindLease = lease
      task.updatedAt = now
      this.saveTasks()
      return { ok: true, task, lease: { ...lease } }
    })
  }

  /** Give back a bind lease that will not be used (creation or prompt failed). */
  releaseBindLease(taskId: string, token: string): boolean {
    if (!token) return false
    return this.withLock(() => {
      this.refreshTasks()
      const task = this.tasks.get(taskId)
      if (!task || !task.bindLease || task.bindLease.token !== token) return false
      delete task.bindLease
      task.updatedAt = Date.now()
      this.saveTasks()
      return true
    })
  }

  /**
   * Bind one session to one task under the cross-process store lock.
   *
   * Binding used to be read-modify-write outside the lock, so two DSH processes
   * could bind different sessions to one task, or one session to two tasks, and
   * the last writer silently won. Refresh + validate + save in one critical
   * section makes the shared file the single source of truth. Rebinding an
   * existing task to a different session is refused: a caller that holds a
   * stale snapshot must not hijack a task another window already started.
   *
   * `options.lease` proves the caller is the window allowed to bind; a lost
   * (expired or taken over) lease fails the bind instead of overwriting.
   */
  bindSession(taskId: string, sessionId: string, options?: { lease?: string }): BindSessionResult {
    return this.withLock(() => {
      this.refreshTasks()
      const task = this.tasks.get(taskId)
      if (!task) return { ok: false, conflict: 'missing' }
      const lease = String(options?.lease || '')
      if (task.sessionId === sessionId) {
        // Idempotent retry (the client may have lost the first response): the
        // binding already exists, so this is a success regardless of the lease.
        if (task.startOnBind !== false || task.bindLease) {
          task.startOnBind = false
          if (!task.bindLease || !lease || task.bindLease.token === lease) delete task.bindLease
          task.updatedAt = Date.now()
          this.saveTasks()
        }
        return { ok: true, task }
      }
      if (lease && task.bindLease && task.bindLease.token !== lease) return { ok: false, conflict: 'lease-lost', other: task }
      const other = [...this.tasks.values()].find((t) => t.id !== taskId && t.sessionId === sessionId)
      if (other) return { ok: false, conflict: 'session-taken', other }
      if (task.sessionId) return { ok: false, conflict: 'task-bound', other: task }
      task.sessionId = sessionId
      task.startOnBind = false
      delete task.bindLease
      task.sessionOwner = { instanceId: this.instanceId, pid: process.pid, at: Date.now() }
      task.updatedAt = Date.now()
      this.saveTasks()
      // Tell peers right away: the binding decides who may start or merge what.
      this.beat(true)
      return { ok: true, task }
    })
  }

  /**
   * Check or uncheck one acceptance criterion under the store lock.
   *
   * Refresh + validate + save in one critical section: two DSH processes
   * checking different criteria must both survive. The standard list stays
   * authoritative, so checkedCriteria is rewritten in acceptanceCriteria order
   * and drops entries whose criterion no longer exists.
   */
  setCriterionChecked(taskId: string, text: string, checked: boolean): CriterionResult {
    return this.withLock(() => {
      this.refreshTasks()
      const task = this.tasks.get(taskId)
      if (!task) return { ok: false, reason: 'missing' }
      const standard = normalizeCriteria(task.acceptanceCriteria)
      if (!standard.includes(text)) return { ok: false, reason: 'unknown' }
      const marked = new Set(task.checkedCriteria || [])
      if (checked) marked.add(text)
      else marked.delete(text)
      task.checkedCriteria = standard.filter((item) => marked.has(item))
      task.updatedAt = Date.now()
      this.saveTasks()
      return { ok: true, task }
    })
  }

  /**
   * Pin or unpin a task under the store lock.
   *
   * Pinning is a presentation bit, never a lifecycle state: it only stamps
   * `pinnedAt` and keeps the original timestamp when already pinned, so a
   * repeated pin cannot reorder the rail.
   */
  setTaskPinned(taskId: string, pinned: boolean): PinResult {
    return this.withLock(() => {
      this.refreshTasks()
      const task = this.tasks.get(taskId)
      if (!task) return { ok: false, reason: 'missing' }
      if (pinned) {
        if (!task.pinnedAt) task.pinnedAt = Date.now()
      } else {
        delete task.pinnedAt
      }
      task.updatedAt = Date.now()
      this.saveTasks()
      return { ok: true, task }
    })
  }

  /**
   * Update tags / priority / notes / dependencies under the store lock.
   *
   * One critical section for all fields: refresh, validate, then save, so two
   * DSH processes editing different fields cannot overwrite each other. Keys
   * absent from the patch — or present with `undefined`, as an HTTP body may
   * deliver — are left untouched; only an explicit empty value clears.
   */
  updateTaskMeta(taskId: string, patch: TaskMetaPatch): TaskMetaResult {
    return this.withLock(() => {
      this.refreshTasks()
      const task = this.tasks.get(taskId)
      if (!task) return { ok: false, reason: 'missing' }
      const has = (key: keyof TaskMetaPatch) =>
        Object.prototype.hasOwnProperty.call(patch, key) && patch[key] !== undefined

      // Normalize and validate everything before touching the record, so a
      // rejected field cannot leave a half-applied in-memory mutation.
      const tags = has('tags') ? normalizeTags(patch.tags) : null
      if (tags) {
        const check = validateTags(tags)
        if (!check.ok) return { ok: false, reason: check.error === 'too-many' ? 'tags-too-many' : 'tags-too-long' }
      }
      const priority = has('priority') ? normalizePriority(patch.priority) : null
      if (has('priority') && !priority) return { ok: false, reason: 'priority-invalid' }
      const hasDue = has('dueAt')
      const due = hasDue ? parseDueAt(patch.dueAt) : null
      if (due && !due.ok) return { ok: false, reason: 'due-invalid' }
      const notes = has('notes') ? String(patch.notes == null ? '' : patch.notes).trim() : null
      if (notes !== null && notes.length > NOTES_MAX_LENGTH) return { ok: false, reason: 'notes-too-long' }
      const dependsOn = has('dependsOn') ? normalizeDependencyIds(patch.dependsOn) : null
      if (dependsOn && dependsOn.length) {
        const check = validateDependencyIds({
          taskId: task.id,
          projectId: task.projectId,
          repoPath: task.repoPath,
          ids: dependsOn,
          tasks: [...this.tasks.values()],
        })
        if (!check.ok) return { ok: false, reason: dependencyReason(check.error) }
      }
      if (!tags && !priority && !hasDue && notes === null && dependsOn === null) return { ok: true, task }

      if (tags) {
        if (tags.length) task.tags = tags
        else delete task.tags
      }
      if (priority) {
        if (priority === 'normal') delete task.priority
        else task.priority = priority
      }
      // `due` may legitimately be null (clear), so track it separately from
      // the truthiness-based fields above.
      if (hasDue && due && due.ok) {
        if (due.value === null) delete task.dueAt
        else task.dueAt = due.value
      }
      if (notes !== null) {
        if (notes) task.notes = notes
        else delete task.notes
      }
      if (dependsOn !== null) {
        if (dependsOn.length) task.dependsOn = dependsOn
        else delete task.dependsOn
      }
      task.updatedAt = Date.now()
      this.saveTasks()
      return { ok: true, task }
    })
  }

  /** Clear the task bound to a session (conversation deleted) atomically. */
  unbindSession(sessionId: string): WorktreeTask | null {
    return this.withLock(() => {
      this.refreshTasks()
      const task = [...this.tasks.values()].find((t) => t.sessionId === sessionId)
      if (!task) return null
      task.sessionId = null
      task.startOnBind = false // the user removed the conversation; do not resurrect it
      delete task.sessionOwner
      delete task.bindLease
      task.updatedAt = Date.now()
      this.saveTasks()
      // Publishing the empty run list is the recovery signal: a peer blocked on
      // this session sees it idle on its next probe instead of staying stuck.
      this.beat(true)
      return task
    })
  }

  /**
   * Manual recovery: forget a session binding the host cannot confirm either
   * way (e.g. its owning instance is frozen). Deliberately explicit — it is the
   * only path that discards a binding without a session/disposed event.
   */
  clearSessionBinding(taskId: string): WorktreeTask | null {
    return this.withLock(() => {
      this.refreshTasks()
      const task = this.tasks.get(taskId)
      if (!task) return null
      task.sessionId = null
      task.startOnBind = false
      delete task.sessionOwner
      delete task.bindLease
      task.updatedAt = Date.now()
      this.saveTasks()
      this.beat(true)
      return task
    })
  }

  deleteTask(id: string): boolean {
    return this.withLock(() => {
      this.refreshTasks()
      const ok = this.tasks.delete(id)
      if (ok) this.saveTasks()
      return ok
    })
  }

  // ---- misc ----

  listRecents(): string[] {
    this.refreshRecents()
    return [...this.recents]
  }

  addRecent(dir: string): void {
    this.withLock(() => {
      this.refreshRecents()
      const norm = dir.replace(/[\\/]+$/, '')
      this.recents = [norm, ...this.recents.filter((d) => d !== norm)].slice(0, 10)
      this.saveRecents()
    })
  }

  clearRecents(): void {
    this.withLock(() => {
      this.refreshRecents()
      this.recents = []
      this.saveRecents()
    })
  }

  // ---- global acceptance-criteria library ----

  listCriteria(): string[] {
    this.refreshCriteria()
    return [...this.criteria]
  }

  /** Append one or more criteria; blanks and duplicates are ignored. */
  addCriteria(values: string[]): string[] {
    const incoming = values.map((v) => String(v || '').trim()).filter(Boolean)
    if (!incoming.length) return this.listCriteria()
    return this.withLock(() => {
      this.refreshCriteria()
      for (const text of incoming) if (!this.criteria.includes(text)) this.criteria.push(text)
      this.saveCriteria()
      return [...this.criteria]
    })
  }

  removeCriterion(text: string): string[] {
    return this.withLock(() => {
      this.refreshCriteria()
      const next = this.criteria.filter((item) => item !== text)
      if (next.length !== this.criteria.length) {
        this.criteria = next
        this.saveCriteria()
      }
      return [...this.criteria]
    })
  }

  /** Replace the whole library (used by edit/reorder; blanks and duplicates dropped). */
  setCriteria(values: string[]): string[] {
    const out: string[] = []
    const seen = new Set<string>()
    for (const value of Array.isArray(values) ? values : []) {
      const text = String(value == null ? '' : value).trim()
      if (!text || seen.has(text)) continue
      seen.add(text)
      out.push(text)
    }
    return this.withLock(() => {
      this.criteria = out
      this.saveCriteria()
      return [...this.criteria]
    })
  }

  // ---- templates ----

  /** Newest first; the picker shows creation order, edits do not reshuffle. */
  listTemplates(): TaskTemplate[] {
    this.refreshTemplates()
    return [...this.templates].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }

  /**
   * Create or update a template under the store lock.
   *
   * The whole read-modify-write lives inside one critical section: two DSH
   * processes saving at once must not drop each other's row. An update keeps
   * `createdAt` and only refreshes `updatedAt`.
   */
  saveTemplate(input: { id?: string; name: string; title?: string; description?: string; criteria?: string[] }): TemplateResult {
    const name = String((input && input.name) || '').trim()
    return this.withLock(() => {
      this.refreshTemplates()
      const id = String((input && input.id) || '').trim()
      const title = String((input && input.title) || '')
      const description = String((input && input.description) || '')
      const criteria = normalizeCriteria(input && input.criteria)
      const now = Date.now()
      let item: TaskTemplate | undefined
      if (id) {
        item = this.templates.find((t) => t.id === id)
        if (!item) return { ok: false, reason: 'missing' }
        item.name = name
        item.title = title
        item.description = description
        item.criteria = criteria
        item.updatedAt = now
      } else {
        item = { id: randomUUID(), name, title, description, criteria, createdAt: now }
        this.templates.push(item)
      }
      this.saveTemplates()
      const templates = [...this.templates].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      return { ok: true, item, templates }
    })
  }

  deleteTemplate(id: string): TaskTemplate[] {
    return this.withLock(() => {
      this.refreshTemplates()
      this.templates = this.templates.filter((t) => t.id !== id)
      this.saveTemplates()
      return [...this.templates].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    })
  }

  async flush(): Promise<void> {
    // 所有 put*/delete* 已在锁内同步落盘；这里绝不能用本进程内存全量覆盖
    // 共享文件，否则会抹掉其他进程刚写的任务。刷新内存即可（等价 no-op）。
    this.refreshProjects()
    this.refreshTasks()
    this.refreshRecents()
    this.refreshCriteria()
    this.refreshTemplates()
  }

  dispose(): void {
    this.stopHeartbeat()
    try {
      // 退出时同样不回写全量缓存：其他 DSH 进程共用这些文件。
      this.refreshProjects()
      this.refreshTasks()
      this.refreshRecents()
      this.refreshCriteria()
      this.refreshTemplates()
    } catch {
      /* shutdown must never throw */
    }
  }
}
