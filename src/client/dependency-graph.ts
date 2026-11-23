/**
 * Dependency graph: a layered DAG derived from the task records already on
 * screen. Pure functions only — no DOM, no clock, no Git, no writes.
 *
 * The module receives one project's `TaskView[]` (the server already keeps
 * dependencies inside a project). Real tasks are ordered with
 * `compareTaskOrder`, truncated to `DEP_GRAPH_LIMIT`, and then layered with
 * Kahn's algorithm: `layer(node) = max(layer(prereq)) + 1`, roots at 0.
 *
 * Dependencies on ids that are not among the shown tasks (deleted rows, or
 * tasks cut by the truncation) become "missing" nodes instead of vanishing.
 * Cyclic data is not a crash: Kahn stops at the iteration guard, the remaining
 * nodes land on the next layer, the edges inside a strongly connected
 * component are flagged, and `cycles` lists the components.
 */

import type { TaskView } from '../models'
import { isDependencyDone, normalizeDependencyIds } from '../task-deps'
import { compareTaskOrder } from '../task-meta'

export const DEP_GRAPH_LIMIT = 60

/** Fixed node size and spacing: the card scrolls instead of rescaling. */
export const NODE_W = 168
export const NODE_H = 40
export const GAP_X = 28
export const GAP_Y = 12

export interface DepGraphNode {
  id: string
  title: string
  /** Task snapshot status; missing nodes use 'missing'. */
  status: string
  done: boolean
  archived: boolean
  missing: boolean
  layer: number
  x: number
  y: number
  width: number
  height: number
  /** Prerequisite ids that no shown task provides (real tasks only). */
  missingDeps: string[]
}

export interface DepGraphEdge {
  from: string
  to: string
  /** Edge pointing at a missing node. */
  missing: boolean
  /** Edge inside a cycle (abnormal data). */
  cycle: boolean
}

export interface DepGraphLayer { index: number; nodeIds: string[] }

export interface DependencyGraph {
  nodes: DepGraphNode[]
  edges: DepGraphEdge[]
  layers: DepGraphLayer[]
  width: number
  height: number
  truncated: boolean
  cycles: string[][]
  total: number
  shown: number
}

function byIdOrder(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** One order for real nodes: the board order, with the id as a stable tiebreak. */
function compareRealViews(a: TaskView, b: TaskView): number {
  const order = compareTaskOrder(a.task, b.task)
  return order || byIdOrder(a.task.id, b.task.id)
}

interface LayerState {
  layer: Map<string, number>
  remaining: Set<string>
}

/**
 * Kahn layering with a hard iteration cap. Nodes still `remaining` when the
 * queue empties sit on (or below) a cycle; they are placed one layer past the
 * highest layer seen, so the layout stays finite for any input.
 */
function assignLayers(
  ids: string[],
  edges: DepGraphEdge[],
  compareNode: (a: string, b: string) => number,
): LayerState {
  const indegree = new Map<string, number>()
  const out = new Map<string, string[]>()
  for (const id of ids) {
    indegree.set(id, 0)
    out.set(id, [])
  }
  for (const edge of edges) {
    indegree.set(edge.to, (indegree.get(edge.to) || 0) + 1)
    const list = out.get(edge.from)
    if (list) list.push(edge.to)
  }
  const layer = new Map<string, number>()
  const remaining = new Set(ids)
  const queue = ids.filter((id) => (indegree.get(id) || 0) === 0).sort(compareNode)
  // Every node leaves the queue at most once and every edge is relaxed once;
  // the cap is only a belt-and-braces guard against corrupted input.
  const maxSteps = ids.length * (edges.length + ids.length + 2) + 16
  let steps = 0
  while (queue.length && steps < maxSteps) {
    steps += 1
    const id = queue.shift() as string
    remaining.delete(id)
    const base = layer.get(id) || 0
    for (const to of out.get(id) || []) {
      layer.set(to, Math.max(layer.get(to) || 0, base + 1))
      const left = (indegree.get(to) || 0) - 1
      indegree.set(to, left)
      if (left === 0) queue.push(to)
    }
  }
  if (remaining.size) {
    let maxLayer = -1
    for (const value of layer.values()) maxLayer = Math.max(maxLayer, value)
    const next = maxLayer + 1
    for (const id of remaining) layer.set(id, next)
  }
  return { layer, remaining }
}

/**
 * Strongly connected components (iterative Tarjan) over the whole graph.
 * A component is a cycle when it holds more than one node or a self edge.
 */
function findCycles(ids: string[], edges: DepGraphEdge[], compareNode: (a: string, b: string) => number): string[][] {
  const out = new Map<string, string[]>()
  for (const id of ids) out.set(id, [])
  for (const edge of edges) {
    const list = out.get(edge.from)
    if (list) list.push(edge.to)
  }
  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const components: string[][] = []
  let counter = 0
  const maxSteps = 8 * (ids.length + edges.length + 1)
  let steps = 0
  for (const root of ids) {
    if (index.has(root)) continue
    const work: Array<{ id: string; next: number; started: boolean }> = [{ id: root, next: 0, started: false }]
    while (work.length && steps < maxSteps) {
      steps += 1
      const frame = work[work.length - 1]
      const id = frame.id
      if (!frame.started) {
        frame.started = true
        index.set(id, counter)
        low.set(id, counter)
        counter += 1
        stack.push(id)
        onStack.add(id)
      }
      const children = out.get(id) || []
      if (frame.next < children.length) {
        const to = children[frame.next]
        frame.next += 1
        if (!index.has(to)) work.push({ id: to, next: 0, started: false })
        else if (onStack.has(to)) low.set(id, Math.min(low.get(id) as number, index.get(to) as number))
        continue
      }
      work.pop()
      if (work.length) {
        const parent = work[work.length - 1]
        low.set(parent.id, Math.min(low.get(parent.id) as number, low.get(id) as number))
      }
      if (low.get(id) === index.get(id)) {
        const component: string[] = []
        while (stack.length) {
          const member = stack.pop() as string
          onStack.delete(member)
          component.push(member)
          if (member === id) break
        }
        component.sort(compareNode)
        const selfLoop = (out.get(component[0]) || []).indexOf(component[0]) >= 0
        if (component.length > 1 || selfLoop) components.push(component)
      }
    }
  }
  components.sort((a, b) => compareNode(a[0], b[0]))
  return components
}

export function buildDependencyGraph(views: TaskView[]): DependencyGraph {
  const input = Array.isArray(views) ? views : []
  const total = input.length
  const sorted = input
    .filter((view) => view && view.task && typeof view.task.id === 'string' && view.task.id !== '')
    .slice()
    .sort(compareRealViews)
  // Ids are unique in the ledger; keeping the first occurrence keeps the sort
  // deterministic even if a hand-edited record repeats one.
  const seenReal = new Set<string>()
  const realViews: TaskView[] = []
  for (const view of sorted) {
    if (seenReal.has(view.task.id)) continue
    seenReal.add(view.task.id)
    realViews.push(view)
    if (realViews.length >= DEP_GRAPH_LIMIT) break
  }
  const realIds = new Set(realViews.map((view) => view.task.id))
  const realIndex = new Map<string, number>()
  realViews.forEach((view, i) => realIndex.set(view.task.id, i))

  const missingIds = new Set<string>()
  const depsOf = new Map<string, string[]>()
  for (const view of realViews) {
    const deps = normalizeDependencyIds(view.task.dependsOn)
    depsOf.set(view.task.id, deps)
    for (const dep of deps) {
      if (!realIds.has(dep)) missingIds.add(dep)
    }
  }
  const missingSorted = [...missingIds].sort(byIdOrder)
  const allIds = [...realViews.map((view) => view.task.id), ...missingSorted]
  const compareNode = (a: string, b: string): number => {
    const ai = realIndex.get(a)
    const bi = realIndex.get(b)
    if (ai != null && bi != null) return ai - bi
    if (ai != null) return -1
    if (bi != null) return 1
    return byIdOrder(a, b)
  }

  const edges: DepGraphEdge[] = []
  for (const view of realViews) {
    const id = view.task.id
    for (const dep of depsOf.get(id) || []) {
      edges.push({ from: dep, to: id, missing: !realIds.has(dep), cycle: false })
    }
  }

  const { layer } = assignLayers(allIds, edges, compareNode)
  const cycles = findCycles(allIds, edges, compareNode)
  const cyclicEdges = new Set<string>()
  for (const cycle of cycles) {
    const members = new Set(cycle)
    for (const edge of edges) {
      if (members.has(edge.from) && members.has(edge.to)) cyclicEdges.add(edge.from + '\u0000' + edge.to)
    }
  }
  for (const edge of edges) edge.cycle = cyclicEdges.has(edge.from + '\u0000' + edge.to)

  const layerBuckets = new Map<number, string[]>()
  for (const id of allIds) {
    const index = layer.get(id) || 0
    const bucket = layerBuckets.get(index)
    if (bucket) bucket.push(id)
    else layerBuckets.set(index, [id])
  }
  const layerIndexes = [...layerBuckets.keys()].sort((a, b) => a - b)
  const layers: DepGraphLayer[] = layerIndexes.map((index) => ({
    index,
    nodeIds: (layerBuckets.get(index) as string[]).slice().sort(compareNode),
  }))

  const layerCount = layerIndexes.length
  const maxLayer = layerCount ? (layerIndexes[layerCount - 1] as number) : -1
  const maxCount = layers.reduce((max, item) => Math.max(max, item.nodeIds.length), 0)
  const width = layerCount ? (maxLayer + 1) * NODE_W + maxLayer * GAP_X : 0
  const height = maxCount ? maxCount * NODE_H + (maxCount - 1) * GAP_Y : 0

  const nodesById = new Map<string, DepGraphNode>()
  for (const view of realViews) {
    const id = view.task.id
    const deps = depsOf.get(id) || []
    nodesById.set(id, {
      id,
      title: String(view.task.title == null ? '' : view.task.title),
      status: view.snapshot && view.snapshot.status ? String(view.snapshot.status) : 'ready',
      done: isDependencyDone(view.task),
      archived: !!view.task.archivedAt,
      missing: false,
      layer: layer.get(id) || 0,
      x: 0,
      y: 0,
      width: NODE_W,
      height: NODE_H,
      missingDeps: deps.filter((dep) => !realIds.has(dep)),
    })
  }
  for (const id of missingSorted) {
    nodesById.set(id, {
      id,
      title: id,
      status: 'missing',
      done: false,
      archived: false,
      missing: true,
      layer: layer.get(id) || 0,
      x: 0,
      y: 0,
      width: NODE_W,
      height: NODE_H,
      missingDeps: [],
    })
  }

  const nodes: DepGraphNode[] = []
  for (const item of layers) {
    const count = item.nodeIds.length
    const layerHeight = count ? count * NODE_H + (count - 1) * GAP_Y : 0
    // Centre short layers against the tallest one; integer offsets keep the
    // coordinates deterministic and never negative.
    const offset = height > layerHeight ? Math.max(0, Math.round((height - layerHeight) / 2)) : 0
    item.nodeIds.forEach((id, i) => {
      const node = nodesById.get(id)
      if (!node) return
      node.x = item.index * (NODE_W + GAP_X)
      node.y = offset + i * (NODE_H + GAP_Y)
      nodes.push(node)
    })
  }

  return {
    nodes,
    edges,
    layers,
    width: width > 0 ? width : 0,
    height: height > 0 ? height : 0,
    truncated: total > realViews.length,
    cycles,
    total,
    shown: realViews.length,
  }
}
