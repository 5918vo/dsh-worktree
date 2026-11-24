/**
 * Critical path & ready queue: a pure, read-only view over one project's
 * `TaskView[]`. No DOM, no clock, no network, no writes.
 *
 * The chain is measured in *dependency hops*, not in time: `depth(node)` is
 * `1 + max(depth(prerequisite))`, roots (no prerequisite) are 1, and the chain
 * is the depth-maximum node traced back to its root. Prerequisites that are not
 * in the current view are treated as missing, they never join the chain.
 *
 * Abnormal data must never hang the render: cycle edges are skipped and their
 * endpoints reported in `cycles`, and the traversal stops expanding once
 * `CRITICAL_PATH_MAX_NODES` nodes were visited (`capped`).
 */

import type { TaskView } from '../models'
import { isDependencyDone, normalizeDependencyIds } from '../task-deps'
import { compareTaskOrder } from '../task-meta'

export const CRITICAL_PATH_LIMIT = 5
/** Hard guard so abnormal data cannot make the DFS unbounded. */
export const CRITICAL_PATH_MAX_NODES = 500

export interface CriticalPathNode {
  id: string
  title: string
  /** Current snapshot status, for the UI's localized label. */
  status: string
  /** Number of prerequisite hops to this node (0 = no prerequisites). */
  depth: number
}

export interface CriticalPath {
  /** Longest chain, root -> leaf; empty when there is no task. */
  chain: CriticalPathNode[]
  /** Number of tasks on the chain (0 when empty). */
  length: number
  /** Open tasks whose prerequisites are all done (or absent), sorted and capped. */
  ready: CriticalPathNode[]
  /** Total ready tasks before the cap; the stat must not read `ready.length`. */
  readyTotal: number
  /** Open tasks with at least one unfinished or missing prerequisite. */
  blocked: number
  /** Missing prerequisite ids referenced by open tasks (deduped). */
  missing: number
  /** Open tasks considered for ready / blocked. */
  open: number
  /** True when more than CRITICAL_PATH_LIMIT ready tasks exist. */
  truncated: boolean
  /** Node ids that participate in a dependency cycle (safe display only). */
  cycles: string[]
  /** True when the node guard stopped the traversal. */
  capped: boolean
}

function byIdOrder(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Board order with the id as a stable tiebreak, so the input is deterministic. */
function compareRealViews(a: TaskView, b: TaskView): number {
  const order = compareTaskOrder(a.task, b.task)
  return order || byIdOrder(a.task.id, b.task.id)
}

function statusOf(view: TaskView): string {
  return String((view.snapshot && view.snapshot.status) || '')
}

/** Archived, merged and cleaned tasks are no longer part of the ready queue. */
function isOpen(view: TaskView): boolean {
  if (view.task.archivedAt) return false
  const status = statusOf(view)
  return status !== 'merged' && status !== 'cleaned'
}

interface DepthFrame {
  id: string
  next: number
  best: number
}

interface DepthResult {
  depth: Map<string, number>
  cycles: Set<string>
  capped: boolean
}

/**
 * Iterative DFS: `depth(node) = 1 + max(depth(present prerequisite))`.
 * Edges into a node still on the stack are cycle edges: they are skipped and
 * both endpoints are recorded. The guard counts expanded nodes only.
 */
function computeDepths(ids: string[], depsOf: Map<string, string[]>): DepthResult {
  const depth = new Map<string, number>()
  const cycles = new Set<string>()
  const visiting = new Set<string>()
  const done = new Set<string>()
  let visited = 0
  let capped = false

  for (const root of ids) {
    if (done.has(root)) continue
    if (visited >= CRITICAL_PATH_MAX_NODES) {
      capped = true
      depth.set(root, 1)
      done.add(root)
      continue
    }
    visited += 1
    visiting.add(root)
    const stack: DepthFrame[] = [{ id: root, next: 0, best: 0 }]
    while (stack.length) {
      const frame = stack[stack.length - 1]
      const deps = depsOf.get(frame.id) || []
      if (frame.next < deps.length) {
        const dep = deps[frame.next]
        frame.next += 1
        if (!depsOf.has(dep)) continue
        if (visiting.has(dep)) {
          cycles.add(frame.id)
          cycles.add(dep)
          continue
        }
        const known = depth.get(dep)
        if (done.has(dep) && known != null) {
          if (known > frame.best) frame.best = known
          continue
        }
        if (visited >= CRITICAL_PATH_MAX_NODES) {
          // Unbounded input: stop expanding, keep what was already measured.
          capped = true
          continue
        }
        visited += 1
        visiting.add(dep)
        stack.push({ id: dep, next: 0, best: 0 })
        continue
      }
      stack.pop()
      visiting.delete(frame.id)
      const value = 1 + frame.best
      depth.set(frame.id, value)
      done.add(frame.id)
      if (stack.length) {
        const parent = stack[stack.length - 1]
        if (value > parent.best) parent.best = value
      }
    }
  }

  return { depth, cycles, capped }
}

/** Trace the longest chain back to its root; depth strictly decreases. */
function buildChain(
  ids: string[],
  depsOf: Map<string, string[]>,
  depth: Map<string, number>,
  order: Map<string, number>,
): string[] {
  let tail = ''
  let best = 0
  for (const id of ids) {
    const value = depth.get(id) || 0
    if (value > best) {
      best = value
      tail = id
    }
  }
  if (!tail) return []
  const path = [tail]
  let current = tail
  while (path.length <= ids.length) {
    const target = (depth.get(current) || 1) - 1
    if (target <= 0) break
    let next = ''
    for (const dep of depsOf.get(current) || []) {
      if ((depth.get(dep) || 0) !== target) continue
      // Equal depth: the board order (compareTaskOrder) decides, not the
      // stored order of `dependsOn`.
      if (!next || (order.get(dep) || 0) < (order.get(next) || 0)) next = dep
    }
    if (!next) break
    path.push(next)
    current = next
  }
  return path.reverse()
}

export function buildCriticalPath(views: TaskView[]): CriticalPath {
  const input = Array.isArray(views) ? views : []
  const sorted = input
    .filter((view) => view && view.task && typeof view.task.id === 'string' && view.task.id !== '')
    .slice()
    .sort(compareRealViews)
  // Ids are unique in the ledger; the first occurrence wins so a hand-edited
  // duplicate cannot change the result.
  const seen = new Set<string>()
  const viewsById = new Map<string, TaskView>()
  const ids: string[] = []
  for (const view of sorted) {
    const id = view.task.id
    if (seen.has(id)) continue
    seen.add(id)
    viewsById.set(id, view)
    ids.push(id)
  }

  const depsOf = new Map<string, string[]>()
  for (const id of ids) {
    const view = viewsById.get(id) as TaskView
    const deps = normalizeDependencyIds(view.task.dependsOn).filter((dep) => dep !== '')
    depsOf.set(id, deps)
  }

  const { depth, cycles, capped } = computeDepths(ids, depsOf)

  const nodeOf = (id: string, value: number): CriticalPathNode => {
    const view = viewsById.get(id) as TaskView
    return {
      id,
      title: String(view.task.title || id),
      status: statusOf(view),
      depth: value,
    }
  }

  const openIds = ids.filter((id) => isOpen(viewsById.get(id) as TaskView))
  const missingIds = new Set<string>()
  const readyIds: string[] = []
  let blocked = 0
  for (const id of openIds) {
    const deps = depsOf.get(id) || []
    let waiting = false
    for (const dep of deps) {
      const depView = viewsById.get(dep)
      if (!depView) {
        missingIds.add(dep)
        waiting = true
        continue
      }
      if (!isDependencyDone(depView.task)) waiting = true
    }
    if (waiting) blocked += 1
    else readyIds.push(id)
  }

  const order = new Map<string, number>()
  ids.forEach((id, index) => order.set(id, index))

  const chain = buildChain(ids, depsOf, depth, order).map((id) => nodeOf(id, depth.get(id) || 0))
  const ready = readyIds
    .slice(0, CRITICAL_PATH_LIMIT)
    .map((id) => nodeOf(id, depth.get(id) || 0))
  const cycleIds = ids.filter((id) => cycles.has(id))

  return {
    chain,
    length: chain.length,
    ready,
    readyTotal: readyIds.length,
    blocked,
    missing: missingIds.size,
    open: openIds.length,
    truncated: readyIds.length > CRITICAL_PATH_LIMIT,
    cycles: cycleIds,
    capped,
  }
}
