import {
  closeSync,
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
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { normalizeCriteria } from './criteria.js'
import { NOTES_MAX_LENGTH, normalizePriority, normalizeTags, validateTags } from './task-meta.js'
import { Project, TaskTemplate, WorktreeTask } from './models.js'

/** Outcome of an atomic session binding; callers translate conflicts into 409s. */
export type BindSessionResult =
  | { ok: true; task: WorktreeTask }
  | { ok: false; conflict: 'missing' | 'session-taken' | 'task-bound'; other?: WorktreeTask }

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
}

/** Outcome of an atomic metadata update; callers map reasons to 404 / 400. */
export type TaskMetaResult =
  | { ok: true; task: WorktreeTask }
  | {
    ok: false
    reason: 'missing' | 'tags-too-many' | 'tags-too-long' | 'priority-invalid' | 'notes-too-long'
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

function readJsonSync<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

function writeJsonSync(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true })
  const text = JSON.stringify(value, null, 2)
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  try {
    writeFileSync(tmp, text, { encoding: 'utf8', mode: 0o600 })
    renameSync(tmp, file)
    return
  } catch {
    /* Windows may briefly hold the destination; fall through */
  }
  try {
    writeFileSync(file, text, { encoding: 'utf8' })
  } catch {
    /* a failed save must never take the host down; the next save retries */
  }
  try {
    rmSync(tmp, { force: true })
  } catch {
    /* noop */
  }
}

function sleepSync(ms: number): void {
  const end = Date.now() + ms
  while (Date.now() < end) {
    /* short critical section */
  }
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
  private projects = new Map<string, Project>()
  private tasks = new Map<string, WorktreeTask>()
  private recents: string[] = []
  private criteria: string[] = []
  private templates: TaskTemplate[] = []

  constructor(dir = stateDir()) {
    this.dir = dir
    this.migrateLegacy = dir === stateDir()
  }

  private file(name: string): string {
    return join(this.dir, name)
  }

  private readProjects(): Record<string, Project> {
    return readJsonSync<Record<string, Project>>(this.file('projects.json'), {})
  }

  private readTasks(): Record<string, WorktreeTask> {
    return readJsonSync<Record<string, WorktreeTask>>(this.file('tasks.json'), {})
  }

  private readRecents(): string[] {
    const value = readJsonSync<any>(this.file('recents.json'), [])
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
  }

  private readCriteria(): string[] {
    const value = readJsonSync<any>(this.file('acceptance-criteria.json'), [])
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : []
  }

  /** Templates are an array; malformed rows are dropped instead of failing the board. */
  private readTemplates(): TaskTemplate[] {
    const value = readJsonSync<any>(this.file('templates.json'), [])
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

  private withLock<T>(fn: () => T): T {
    mkdirSync(this.dir, { recursive: true })
    const lock = this.file('.store.lock')
    const start = Date.now()
    let fd: number | null = null
    while (fd === null) {
      try {
        fd = openSync(lock, 'wx')
      } catch {
        try {
          const info = statSync(lock)
          if (Date.now() - info.mtimeMs > 5000) unlinkSync(lock)
        } catch {
          /* lock disappeared between open and stat */
        }
        if (Date.now() - start > 3000) {
          // Never take the host down over a stale lock; the write is still atomic.
          return fn()
        }
        sleepSync(5)
      }
    }
    try {
      return fn()
    } finally {
      try {
        closeSync(fd)
      } catch {
        /* noop */
      }
      try {
        unlinkSync(lock)
      } catch {
        /* noop */
      }
    }
  }

  async load(): Promise<void> {
    this.refreshProjects()
    this.refreshTasks()
    this.refreshRecents()
    this.refreshCriteria()
    this.refreshTemplates()
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
      }
      // 显式清空：刷新可能把磁盘上的旧值写回同一个对象，必须再删一次。
      for (const key of cleared) delete (task as any)[key]
      Object.assign(task, next)
      this.tasks.set(task.id, task)
      this.saveTasks()
    })
  }

  /**
   * Bind one session to one task under the cross-process store lock.
   *
   * Binding used to be read-modify-write outside the lock, so two DSH processes
   * could bind different sessions to one task, or one session to two tasks, and
   * the last writer silently won. Refresh + validate + save in one critical
   * section makes the shared file the single source of truth. Rebinding an
   * existing task to a different session is refused: the client only binds
   * tasks with no session, so an overwrite means two callers raced.
   */
  bindSession(taskId: string, sessionId: string): BindSessionResult {
    return this.withLock(() => {
      this.refreshTasks()
      const task = this.tasks.get(taskId)
      if (!task) return { ok: false, conflict: 'missing' }
      if (task.sessionId === sessionId) {
        if (task.startOnBind !== false) {
          task.startOnBind = false
          task.updatedAt = Date.now()
          this.saveTasks()
        }
        return { ok: true, task }
      }
      const other = [...this.tasks.values()].find((t) => t.id !== taskId && t.sessionId === sessionId)
      if (other) return { ok: false, conflict: 'session-taken', other }
      if (task.sessionId) return { ok: false, conflict: 'task-bound', other: task }
      task.sessionId = sessionId
      task.startOnBind = false
      task.updatedAt = Date.now()
      this.saveTasks()
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
   * Update tags / priority / notes under the store lock.
   *
   * One critical section for all three fields: refresh, validate, then save,
   * so two DSH processes editing different fields cannot overwrite each other.
   * Keys absent from the patch — or present with `undefined`, as an HTTP body
   * may deliver — are left untouched; only an explicit empty value clears.
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
      const notes = has('notes') ? String(patch.notes == null ? '' : patch.notes).trim() : null
      if (notes !== null && notes.length > NOTES_MAX_LENGTH) return { ok: false, reason: 'notes-too-long' }
      if (!tags && !priority && notes === null) return { ok: true, task }

      if (tags) {
        if (tags.length) task.tags = tags
        else delete task.tags
      }
      if (priority) {
        if (priority === 'normal') delete task.priority
        else task.priority = priority
      }
      if (notes !== null) {
        if (notes) task.notes = notes
        else delete task.notes
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
      task.updatedAt = Date.now()
      this.saveTasks()
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
