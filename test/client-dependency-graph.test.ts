import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDependencyGraph,
  DEP_GRAPH_LIMIT,
  NODE_W,
  NODE_H,
  GAP_X,
  GAP_Y,
} from '../src/client/dependency-graph.js'
import type { TaskSnapshot, TaskStatus, TaskView, WorktreeTask } from '../src/models.js'

const NOW = new Date(2026, 5, 15, 12, 0, 0, 0).getTime()

function task(over: Partial<WorktreeTask> = {}): WorktreeTask {
  return {
    id: 't1',
    projectId: 'p1',
    title: 'Task',
    description: '',
    repoPath: 'C:/repo',
    baseBranch: 'main',
    branch: 'dsh/t1',
    worktreePath: 'C:/wt',
    sessionId: null,
    firstPrompt: '',
    startOnBind: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  } as WorktreeTask
}

function snapshot(over: Partial<TaskSnapshot> = {}): TaskSnapshot {
  return {
    worktree: { exists: true, branch: 'dsh/t1', dirtyCount: 0, ahead: 0, commits: [], lastCommitAt: null },
    repo: { exists: true, currentBranch: 'main', dirtyCount: 0 },
    branchExists: true,
    merged: false,
    status: 'review',
    ...over,
  } as TaskSnapshot
}

function view(over: Partial<WorktreeTask> = {}, status: TaskStatus = 'review'): TaskView {
  return { task: task(over), snapshot: snapshot({ status }) }
}

function nodeOf(graph: ReturnType<typeof buildDependencyGraph>, id: string) {
  const node = graph.nodes.find((item) => item.id === id)
  assert.ok(node, 'node ' + id + ' exists')
  return node
}

test('empty input: zero nodes, zero edges, no layers, zero size', () => {
  const graph = buildDependencyGraph([])
  assert.deepEqual(graph.nodes, [])
  assert.deepEqual(graph.edges, [])
  assert.deepEqual(graph.layers, [])
  assert.equal(graph.width, 0)
  assert.equal(graph.height, 0)
  assert.equal(graph.truncated, false)
  assert.deepEqual(graph.cycles, [])
  assert.equal(graph.total, 0)
  assert.equal(graph.shown, 0)
})

test('tasks without dependencies: one root layer, no edges, no empty SVG size', () => {
  const graph = buildDependencyGraph([
    view({ id: 'a', title: 'Alpha', createdAt: NOW - 1 }),
    view({ id: 'b', title: 'Beta', createdAt: NOW - 2 }),
  ])
  assert.equal(graph.total, 2)
  assert.equal(graph.shown, 2)
  assert.equal(graph.truncated, false)
  assert.equal(graph.edges.length, 0)
  assert.equal(graph.layers.length, 1)
  assert.deepEqual(graph.layers[0].nodeIds, ['a', 'b'])
  assert.equal(graph.width, NODE_W)
  assert.equal(graph.height, NODE_H * 2 + GAP_Y)
  for (const node of graph.nodes) {
    assert.equal(node.layer, 0)
    assert.equal(node.missing, false)
    assert.equal(node.done, false)
  }
})

test('single chain layers by prerequisite depth and positions layers by x', () => {
  const graph = buildDependencyGraph([
    view({ id: 'c', title: 'C', dependsOn: ['b'], createdAt: NOW - 3 }),
    view({ id: 'b', title: 'B', dependsOn: ['a'], createdAt: NOW - 2 }),
    view({ id: 'a', title: 'A', createdAt: NOW - 1 }),
  ])
  assert.deepEqual(graph.layers.map((layer) => layer.nodeIds), [['a'], ['b'], ['c']])
  assert.equal(nodeOf(graph, 'a').x, 0)
  assert.equal(nodeOf(graph, 'b').x, NODE_W + GAP_X)
  assert.equal(nodeOf(graph, 'c').x, 2 * (NODE_W + GAP_X))
  assert.deepEqual(
    graph.edges.map((edge) => edge.from + '>' + edge.to).sort(),
    ['a>b', 'b>c'],
  )
  assert.ok(graph.edges.every((edge) => !edge.missing && !edge.cycle))
})

test('diamond: both middle tasks share a layer, the sink waits for both', () => {
  const graph = buildDependencyGraph([
    view({ id: 'a', title: 'A', createdAt: NOW - 4 }),
    view({ id: 'b', title: 'B', dependsOn: ['a'], createdAt: NOW - 3 }),
    view({ id: 'c', title: 'C', dependsOn: ['a'], createdAt: NOW - 2 }),
    view({ id: 'd', title: 'D', dependsOn: ['b', 'c'], createdAt: NOW - 1 }),
  ])
  assert.deepEqual(graph.layers.map((layer) => layer.nodeIds), [['a'], ['c', 'b'], ['d']])
  assert.equal(nodeOf(graph, 'd').layer, 2)
  assert.equal(graph.edges.length, 4)
})

test('multiple roots stay on layer 0 and keep compareTaskOrder order', () => {
  const graph = buildDependencyGraph([
    view({ id: 'old', title: 'Old', createdAt: NOW - 10 }),
    view({ id: 'new', title: 'New', createdAt: NOW - 1 }),
    view({ id: 'pin', title: 'Pinned', pinnedAt: NOW, createdAt: NOW - 20 }),
    view({ id: 'sink', title: 'Sink', dependsOn: ['old', 'new'], createdAt: NOW - 2 }),
  ])
  assert.deepEqual(graph.layers[0].nodeIds, ['pin', 'new', 'old'])
  assert.deepEqual(graph.layers[1].nodeIds, ['sink'])
})

test('multiple prerequisites: layer is max(prereq layer) + 1', () => {
  const graph = buildDependencyGraph([
    view({ id: 'a', title: 'A', createdAt: NOW - 3 }),
    view({ id: 'b', title: 'B', dependsOn: ['a'], createdAt: NOW - 2 }),
    view({ id: 'c', title: 'C', dependsOn: ['a', 'b'], createdAt: NOW - 1 }),
  ])
  assert.equal(nodeOf(graph, 'b').layer, 1)
  assert.equal(nodeOf(graph, 'c').layer, 2)
})

test('missing dependency creates a dashed placeholder node and a missing edge', () => {
  const graph = buildDependencyGraph([view({ id: 'a', title: 'A', dependsOn: ['ghost'] })])
  assert.equal(graph.shown, 1)
  assert.equal(graph.nodes.length, 2)
  const ghost = nodeOf(graph, 'ghost')
  assert.equal(ghost.missing, true)
  assert.equal(ghost.status, 'missing')
  assert.equal(ghost.title, 'ghost')
  assert.equal(ghost.done, false)
  assert.equal(ghost.archived, false)
  assert.deepEqual(ghost.missingDeps, [])
  assert.deepEqual(nodeOf(graph, 'a').missingDeps, ['ghost'])
  assert.equal(graph.layers.length, 2)
  assert.deepEqual(graph.layers[0].nodeIds, ['ghost'])
  assert.deepEqual(graph.layers[1].nodeIds, ['a'])
  assert.equal(graph.edges.length, 1)
  assert.equal(graph.edges[0].from, 'ghost')
  assert.equal(graph.edges[0].missing, true)
  assert.equal(graph.edges[0].cycle, false)
})

test('cycle data terminates, keeps every node and flags the cyclic edges', () => {
  const graph = buildDependencyGraph([
    view({ id: 'a', title: 'A', dependsOn: ['b'], createdAt: NOW - 2 }),
    view({ id: 'b', title: 'B', dependsOn: ['a'], createdAt: NOW - 1 }),
    view({ id: 'c', title: 'C', dependsOn: ['b'], createdAt: NOW }),
  ])
  assert.equal(graph.nodes.length, 3)
  assert.equal(graph.cycles.length, 1)
  assert.deepEqual(graph.cycles[0].slice().sort(), ['a', 'b'])
  const cyclic = graph.edges.filter((edge) => edge.cycle)
  assert.equal(cyclic.length, 2)
  assert.deepEqual(cyclic.map((edge) => edge.from + '>' + edge.to).sort(), ['a>b', 'b>a'])
  const cEdge = graph.edges.find((edge) => edge.from === 'b' && edge.to === 'c')
  assert.ok(cEdge)
  assert.equal(cEdge.cycle, false)
  for (const node of graph.nodes) assert.ok(Number.isFinite(node.layer))
})

test('self dependency is reported as a one-node cycle', () => {
  const graph = buildDependencyGraph([view({ id: 'a', title: 'A', dependsOn: ['a'] })])
  assert.equal(graph.nodes.length, 1)
  assert.deepEqual(graph.cycles, [['a']])
  assert.equal(graph.edges.length, 1)
  assert.equal(graph.edges[0].cycle, true)
})

test('done and archived flags follow mergedAt / cleanedAt / archivedAt', () => {
  const graph = buildDependencyGraph([
    view({ id: 'merged', title: 'Merged', mergedAt: NOW }, 'merged'),
    view({ id: 'cleaned', title: 'Cleaned', cleanedAt: NOW }, 'cleaned'),
    view({ id: 'archived', title: 'Archived', archivedAt: NOW }),
    view({ id: 'open', title: 'Open' }),
  ])
  assert.equal(nodeOf(graph, 'merged').done, true)
  assert.equal(nodeOf(graph, 'cleaned').done, true)
  assert.equal(nodeOf(graph, 'archived').done, false)
  assert.equal(nodeOf(graph, 'archived').archived, true)
  assert.equal(nodeOf(graph, 'open').done, false)
  assert.equal(nodeOf(graph, 'open').archived, false)
  assert.equal(nodeOf(graph, 'merged').status, 'merged')
})

test('more than the limit keeps the first 60 tasks and reports truncation', () => {
  const views: TaskView[] = []
  for (let i = 0; i < DEP_GRAPH_LIMIT + 1; i += 1) {
    views.push(view({ id: 't' + i, title: 'T' + i, createdAt: NOW - i }))
  }
  const graph = buildDependencyGraph(views)
  assert.equal(graph.total, DEP_GRAPH_LIMIT + 1)
  assert.equal(graph.shown, DEP_GRAPH_LIMIT)
  assert.equal(graph.nodes.length, DEP_GRAPH_LIMIT)
  assert.equal(graph.truncated, true)
  assert.equal(nodeOf(graph, 't0').id, 't0')
  assert.equal(graph.nodes.some((node) => node.id === 't' + DEP_GRAPH_LIMIT), false)
})

test('same input is deterministic and every coordinate is finite and non-negative', () => {
  const views = [
    view({ id: 'a', title: 'A', createdAt: NOW - 3 }),
    view({ id: 'b', title: 'B', dependsOn: ['a', 'ghost'], createdAt: NOW - 2 }),
    view({ id: 'c', title: 'C', dependsOn: ['b'], createdAt: NOW - 1 }),
  ]
  const first = buildDependencyGraph(views)
  const second = buildDependencyGraph(views.slice().reverse())
  assert.deepEqual(first, second)
  assert.ok(first.width >= 1)
  assert.ok(first.height >= 1)
  for (const node of first.nodes) {
    for (const value of [node.x, node.y, node.width, node.height]) {
      assert.ok(Number.isFinite(value))
      assert.ok(value >= 0)
    }
  }
})

test('missing nodes sort after real tasks inside the same layer', () => {
  const graph = buildDependencyGraph([
    view({ id: 'a', title: 'A', createdAt: NOW - 1 }),
    view({ id: 'b', title: 'B', createdAt: NOW - 2 }),
    view({ id: 'z', title: 'Z', dependsOn: ['a', 'b', 'zzz'], createdAt: NOW - 3 }),
  ])
  assert.deepEqual(graph.layers[0].nodeIds, ['a', 'b', 'zzz'])
})
