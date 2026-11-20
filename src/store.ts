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
import type { Project, WorktreeTask } from './models.js'

const SLEEP_ARRAY = new Int32Array(new SharedArrayBuffer(4))

export function stateDir(): string {
  return join(homedir(), '.dsh', 'worktree-tasks')
}

function sleepQuiet(ms: number): void {
  try {
    Atomics.wait(SLEEP_ARRAY, 0, 0, ms)
  } catch {
    const end = Date.now() + ms
    while (Date.now() < end) { /* fallback */ }
  }
}

function normPath(p: string): string {
  return p.replace(/[\\/]+$/, '').toLowerCase()
}

function readJsonSync<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

function writeJsonAtomic(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true })
  const text = JSON.stringify(value, null, 2)
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  try {
    writeFileSync(tmp, text, { encoding: 'utf8', mode: 0o600 })
    renameSync(tmp, file)
    return
  } catch {
    /* Windows 偶发文件占用，降级直写 */
  }
  try {
    writeFileSync(file, text, { encoding: 'utf8' })
  } catch {
    /* 写入失败不中断宿主进程 */
  }
  try {
    rmSync(tmp, { force: true })
  } catch { /* noop */ }
}

function syncRecordMap<T extends object>(currentMap: Map<string, T>, disk: Record<string, T>): Map<string, T> {
  const next = new Map<string, T>()
  for (const [id, item] of Object.entries(disk)) {
    const existing = currentMap.get(id)
    if (existing) {
      Object.assign(existing, item)
      next.set(id, existing)
    } else {
      next.set(id, item)
    }
  }
  return next
}

export class Store {
  private readonly dir: string
  private readonly migrateLegacy: boolean
  private projects = new Map<string, Project>()
  private tasks = new Map<string, WorktreeTask>()
  private recents: string[] = []
  private criteria: string[] = []

  constructor(dir = stateDir()) {
    this.dir = dir
    this.migrateLegacy = dir === stateDir()
  }

  directory(): string {
    return this.dir
  }

  private file(name: string): string {
    return join(this.dir, name)
  }

  private refreshProjects(): void {
    this.projects = syncRecordMap(this.projects, readJsonSync<Record<string, Project>>(this.file('projects.json'), {}))
  }

  private refreshTasks(): void {
    this.tasks = syncRecordMap(this.tasks, readJsonSync<Record<string, WorktreeTask>>(this.file('tasks.json'), {}))
  }

  private refreshRecents(): void {
    const raw = readJsonSync<unknown>(this.file('recents.json'), [])
    this.recents = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
  }

  private refreshCriteria(): void {
    const raw = readJsonSync<unknown>(this.file('acceptance-criteria.json'), [])
    this.criteria = Array.isArray(raw)
      ? raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim())
      : []
  }

  private saveProjects(): void { writeJsonAtomic(this.file('projects.json'), Object.fromEntries(this.projects)) }
  private saveTasks(): void { writeJsonAtomic(this.file('tasks.json'), Object.fromEntries(this.tasks)) }
  private saveRecents(): void { writeJsonAtomic(this.file('recents.json'), this.recents) }
  private saveCriteria(): void { writeJsonAtomic(this.file('acceptance-criteria.json'), this.criteria) }

  private saveAll(): void {
    this.saveProjects()
    this.saveTasks()
    this.saveRecents()
    this.saveCriteria()
  }

  private withLock<T>(fn: () => T): T {
    mkdirSync(this.dir, { recursive: true })
    const lock = this.file('.store.lock')
    const deadline = Date.now() + 3000
    let fd: number | null = null

    while (fd === null) {
      try {
        fd = openSync(lock, 'wx')
      } catch {
        try {
          if (Date.now() - statSync(lock).mtimeMs > 5000) unlinkSync(lock)
        } catch { /* 锁已被释放 */ }
        if (Date.now() > deadline) return fn()
        sleepQuiet(5)
      }
    }

    try {
      return fn()
    } finally {
      try { closeSync(fd) } catch { /* noop */ }
      try { unlinkSync(lock) } catch { /* noop */ }
    }
  }

  async load(): Promise<void> {
    this.refreshProjects()
    this.refreshTasks()
    this.refreshRecents()
    this.refreshCriteria()
    if (!this.migrateLegacy) return

    const marker = this.file('.migrated-v2')
    this.withLock(() => {
      if (!existsSync(marker)) {
        this.migrateFromLegacyDirs()
        try { writeFileSync(marker, new Date().toISOString(), 'utf8') } catch { /* retry next boot */ }
      }
      this.dedupeProjects()
    })
  }

  private dedupeProjects(): void {
    const groups = new Map<string, Project[]>()
    for (const p of this.projects.values()) {
      const key = normPath(p.repoPath)
      const list = groups.get(key)
      if (list) list.push(p)
      else groups.set(key, [p])
    }

    let changed = false
    for (const list of groups.values()) {
      if (list.length < 2) continue
      const countOf = (id: string) => {
        let n = 0
        for (const t of this.tasks.values()) if (t.projectId === id) n += 1
        return n
      }
      list.sort((a, b) => countOf(b.id) - countOf(a.id) || a.createdAt - b.createdAt)
      const canonical = list[0]
      for (const dup of list.slice(1)) {
        for (const t of this.tasks.values()) {
          if (t.projectId === dup.id) {
            t.projectId = canonical.id
            changed = true
          }
        }
        this.projects.delete(dup.id)
        changed = true
      }
    }

    if (changed) {
      this.saveProjects()
      this.saveTasks()
    }
  }

  private migrateFromLegacyDirs(): void {
    const candidates = new Set<string>()
    if (process.env.DSH_WORKTREE_STATE_DIR) candidates.add(process.env.DSH_WORKTREE_STATE_DIR)
    if (process.env.DSH_PROFILE_DIR) candidates.add(join(process.env.DSH_PROFILE_DIR, 'deepseek-worktree'))
    candidates.add(join(homedir(), '.dsh', 'worktree-web'))
    try {
      for (const name of readdirSync(join(homedir(), '.dsh', 'profiles'))) {
        candidates.add(join(homedir(), '.dsh', 'profiles', name, 'deepseek-worktree'))
      }
    } catch { /* noop */ }
    candidates.delete(this.dir)

    let changed = false
    for (const dir of candidates) {
      const projects = readJsonSync<Record<string, Project>>(join(dir, 'projects.json'), {})
      const tasks = readJsonSync<Record<string, WorktreeTask>>(join(dir, 'tasks.json'), {})
      const recents = readJsonSync<unknown>(join(dir, 'recents.json'), [])

      for (const [id, p] of Object.entries(projects)) {
        if (!this.projects.has(id)) { this.projects.set(id, p); changed = true }
      }
      for (const [id, t] of Object.entries(tasks)) {
        const cur = this.tasks.get(id)
        if (!cur || (t.updatedAt || 0) > (cur.updatedAt || 0)) { this.tasks.set(id, t); changed = true }
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

    if (changed) {
      this.recents = this.recents.slice(0, 10)
      this.saveAll()
    }
  }

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
    const key = normPath(repoPath)
    return [...this.projects.values()].find((p) => normPath(p.repoPath) === key)
  }

  putProject(project: Project): void {
    const next = { ...project }
    this.withLock(() => {
      this.refreshProjects()
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
    const next = { ...task }
    this.withLock(() => {
      this.refreshTasks()
      Object.assign(task, next)
      this.tasks.set(task.id, task)
      this.saveTasks()
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

  listCriteria(): string[] {
    this.refreshCriteria()
    return [...this.criteria]
  }

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

  setCriteria(values: string[]): string[] {
    const seen = new Set<string>()
    const out: string[] = []
    for (const v of Array.isArray(values) ? values : []) {
      const text = String(v ?? '').trim()
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

  async flush(): Promise<void> {
    this.withLock(() => this.saveAll())
  }

  dispose(): void {
    try { this.withLock(() => this.saveAll()) } catch { /* noop */ }
  }
}
