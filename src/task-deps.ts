/**
 * Task dependency helpers shared by the host, the client and the tests.
 *
 * `dependsOn` is an advisory field: it only feeds the "waiting on" hints in the
 * detail panel and the rail. A dependency never blocks a merge, a cleanup or
 * any git operation, and it never changes the task status or the sort order.
 *
 * Old records read as "no dependencies", and dependencies on deleted tasks are
 * kept as-is: the helper reports them as `missing` instead of rewriting other
 * task rows, so a record edited elsewhere is never silently changed.
 */

export const DEPENDENCY_LIMIT = 8

export type DependencyIssue =
  | 'too-many'
  | 'invalid'
  | 'self'
  | 'missing'
  | 'cross-project'
  | 'cycle'

/** Accept an array or a comma / whitespace separated string; trim, drop blanks, dedupe. */
export function normalizeDependencyIds(values: unknown): string[] {
  let raw: string[] = []
  if (Array.isArray(values)) {
    raw = values
      .filter((value) => typeof value === 'string' || typeof value === 'number')
      .map((value) => String(value))
  } else if (typeof values === 'string') {
    raw = values.split(/[,\s]+/)
  }
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const id = item.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/** A dependency is done once its worktree was merged or cleaned up. */
export function isDependencyDone(task: any): boolean {
  if (!task) return false
  return !!task.mergedAt || !!task.cleanedAt
}

function cleanPath(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/[\\/]+$/, '').toLowerCase() : ''
}

/**
 * Same-project check: ids when both rows have one, otherwise repo paths.
 * Rows that carry neither are treated as compatible (legacy records).
 */
export function isSameProject(a: any, b: any): boolean {
  const aProject = a && typeof a.projectId === 'string' ? a.projectId.trim() : ''
  const bProject = b && typeof b.projectId === 'string' ? b.projectId.trim() : ''
  if (aProject && bProject) return aProject === bProject
  const aRepo = cleanPath(a && a.repoPath)
  const bRepo = cleanPath(b && b.repoPath)
  if (aRepo && bRepo) return aRepo === bRepo
  return true
}

export interface DependencyValidationInput {
  taskId: string
  projectId?: string
  repoPath?: string
  ids: string[]
  tasks: Array<{
    id: string
    projectId?: string
    repoPath?: string
    dependsOn?: string[]
    mergedAt?: number
    cleanedAt?: number
    archivedAt?: number
  }>
}

/**
 * Validate a dependency id list.
 * - more than DEPENDENCY_LIMIT -> too-many
 * - contains the task itself -> self
 * - any id is unknown -> missing
 * - any dependency lives in another project -> cross-project
 * - the new edges close a cycle -> cycle
 */
export function validateDependencyIds(
  input: DependencyValidationInput,
): { ok: true } | { ok: false; error: DependencyIssue } {
  const ids = normalizeDependencyIds(input.ids)
  if (ids.length > DEPENDENCY_LIMIT) return { ok: false, error: 'too-many' }
  if (ids.indexOf(input.taskId) >= 0) return { ok: false, error: 'self' }
  const byId = new Map(input.tasks.map((task) => [task.id, task]))
  for (const id of ids) {
    if (!byId.has(id)) return { ok: false, error: 'missing' }
  }
  const current = byId.get(input.taskId) || { id: input.taskId }
  const self = {
    projectId: input.projectId !== undefined ? input.projectId : current.projectId,
    repoPath: input.repoPath !== undefined ? input.repoPath : current.repoPath,
  }
  for (const id of ids) {
    if (!isSameProject(self, byId.get(id))) return { ok: false, error: 'cross-project' }
  }
  // Only this task's edges change, so any cycle has to run through it. A
  // path-based DFS also rejects a cycle that already exists further out
  // without flagging a diamond (two paths to the same, acyclic dependency).
  const edges = new Map<string, string[]>()
  for (const task of input.tasks) {
    edges.set(task.id, Array.isArray(task.dependsOn) ? normalizeDependencyIds(task.dependsOn) : [])
  }
  edges.set(input.taskId, ids)
  const state = new Map<string, 1 | 2>()
  const stack: Array<{ id: string; index: number; next: string[] }> = []
  const visit = (id: string) => {
    state.set(id, 1)
    stack.push({ id, index: 0, next: edges.get(id) || [] })
  }
  visit(input.taskId)
  while (stack.length) {
    const top = stack[stack.length - 1]
    if (top.index >= top.next.length) {
      state.set(top.id, 2)
      stack.pop()
      continue
    }
    const nextId = top.next[top.index]
    top.index += 1
    const seen = state.get(nextId)
    if (seen === 1) return { ok: false, error: 'cycle' }
    if (seen === 2) continue
    visit(nextId)
  }
  return { ok: true }
}

export interface DependencyOpenItem {
  id: string
  title: string
  done: boolean
}

export interface DependencyStatus {
  /** Dependencies that still exist in the record set (missing ids excluded). */
  total: number
  done: number
  /** Dependencies that are not finished yet. */
  open: DependencyOpenItem[]
  /** Ids kept in the record whose task no longer exists. */
  missing: string[]
  /** open.length > 0. Missing ids never block. */
  blocked: boolean
}

/**
 * Derive the display state from a task and an id -> task lookup.
 * `lookup` values only need id / title / mergedAt / cleanedAt.
 */
export function dependencyStatus(task: any, lookup: Map<string, any>): DependencyStatus {
  const ids = Array.isArray(task && task.dependsOn) ? task.dependsOn : []
  const open: DependencyOpenItem[] = []
  const missing: string[] = []
  const seen = new Set<string>()
  let total = 0
  let done = 0
  for (const raw of ids) {
    const id = typeof raw === 'string' ? raw.trim() : ''
    if (!id || seen.has(id)) continue
    seen.add(id)
    const dep = lookup ? lookup.get(id) : undefined
    if (!dep) {
      missing.push(id)
      continue
    }
    total += 1
    if (isDependencyDone(dep)) {
      done += 1
      continue
    }
    open.push({ id, title: String(dep.title == null ? '' : dep.title), done: false })
  }
  return { total, done, open, missing, blocked: open.length > 0 }
}
