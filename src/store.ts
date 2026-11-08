import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { Project, WorktreeTask } from './models.js'

export function stateDir(): string {
  const explicit = process.env.DSH_WORKTREE_STATE_DIR
  if (explicit) return explicit
  const profileDir = process.env.DSH_PROFILE_DIR
  if (profileDir) return join(profileDir, 'deepseek-worktree')
  return join(homedir(), '.dsh', 'worktree-tasks')
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const text = await fs.readFile(file, 'utf8')
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 })
  // Windows can hold the destination briefly (EPERM on rename); retry, then
  // fall back to a plain overwrite so a lost race never crashes the host.
  for (let i = 0; i < 5; i++) {
    try {
      await fs.rename(tmp, file)
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50 * (i + 1)))
    }
  }
  try {
    await fs.writeFile(file, JSON.stringify(value, null, 2), { encoding: 'utf8' })
  } catch {
    /* give up silently; next save retries */
  }
  try {
    await fs.rm(tmp, { force: true })
  } catch {
    /* noop */
  }
}

/** Durable, debounced store for projects, task records and recent target directories. */
export class Store {
  private readonly dir: string
  private projects = new Map<string, Project>()
  private tasks = new Map<string, WorktreeTask>()
  private recents: string[] = []
  private saveTimer: NodeJS.Timeout | null = null

  constructor(dir = stateDir()) {
    this.dir = dir
  }

  private file(name: string): string {
    return join(this.dir, name)
  }

  async load(): Promise<void> {
    const projects = await readJson<Record<string, Project>>(this.file('projects.json'), {})
    this.projects = new Map(Object.entries(projects))
    const tasks = await readJson<Record<string, WorktreeTask>>(this.file('tasks.json'), {})
    this.tasks = new Map(Object.entries(tasks))
    this.recents = await readJson<string[]>(this.file('recents.json'), [])
  }

  directory(): string {
    return this.dir
  }

  // ---- projects ----

  listProjects(): Project[] {
    return [...this.projects.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  getProject(id: string): Project | undefined {
    return this.projects.get(id)
  }

  findProjectByRepo(repoPath: string): Project | undefined {
    const norm = repoPath.replace(/[\\/]+$/, '').toLowerCase()
    return this.listProjects().find((p) => p.repoPath.replace(/[\\/]+$/, '').toLowerCase() === norm)
  }

  putProject(project: Project): void {
    this.projects.set(project.id, project)
    this.scheduleSave()
  }

  deleteProject(id: string): boolean {
    const ok = this.projects.delete(id)
    if (ok) this.scheduleSave()
    return ok
  }

  // ---- tasks ----

  listTasks(): WorktreeTask[] {
    return [...this.tasks.values()].sort((a, b) => b.createdAt - a.createdAt)
  }

  listTasksOfProject(projectId: string): WorktreeTask[] {
    return this.listTasks().filter((t) => t.projectId === projectId)
  }

  getTask(id: string): WorktreeTask | undefined {
    return this.tasks.get(id)
  }

  putTask(task: WorktreeTask): void {
    task.updatedAt = Date.now()
    this.tasks.set(task.id, task)
    this.scheduleSave()
  }

  deleteTask(id: string): boolean {
    const ok = this.tasks.delete(id)
    if (ok) this.scheduleSave()
    return ok
  }

  // ---- misc ----

  listRecents(): string[] {
    return [...this.recents]
  }

  addRecent(dir: string): void {
    const norm = dir.replace(/[\\/]+$/, '')
    this.recents = [norm, ...this.recents.filter((d) => d !== norm)].slice(0, 10)
    this.scheduleSave()
  }

  clearRecents(): void {
    this.recents = []
    this.scheduleSave()
  }

  scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      void this.flush()
    }, 300)
  }

  async flush(): Promise<void> {
    try {
      const projects = Object.fromEntries(this.projects)
      const tasks = Object.fromEntries(this.tasks)
      await Promise.all([
        writeJson(this.file('projects.json'), projects),
        writeJson(this.file('tasks.json'), tasks),
        writeJson(this.file('recents.json'), this.recents),
      ])
    } catch {
      /* a failed save must never take the host down; the next save retries */
    }
  }

  dispose(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    void this.flush()
  }
}
