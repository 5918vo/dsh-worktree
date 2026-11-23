import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEPENDENCY_LIMIT,
  dependencyStatus,
  isDependencyDone,
  isSameProject,
  normalizeDependencyIds,
  validateDependencyIds,
} from '../src/task-deps.js'

test('normalizeDependencyIds accepts arrays and separated strings', () => {
  assert.deepEqual(normalizeDependencyIds(['a', 'b']), ['a', 'b'])
  assert.deepEqual(normalizeDependencyIds('a, b'), ['a', 'b'])
  assert.deepEqual(normalizeDependencyIds('a b\nc'), ['a', 'b', 'c'])
  assert.deepEqual(normalizeDependencyIds([' a ', 'b,c']), ['a', 'b,c'], 'array entries are not split')
  assert.deepEqual(normalizeDependencyIds(['a', 'a', 'b', '']), ['a', 'b'], 'dedupes and drops blanks')
  assert.deepEqual(normalizeDependencyIds(undefined), [])
  assert.deepEqual(normalizeDependencyIds(null), [])
  assert.deepEqual(normalizeDependencyIds(42), [])
  assert.deepEqual(normalizeDependencyIds([]), [])
})

test('isDependencyDone treats merged and cleaned tasks as done', () => {
  assert.equal(isDependencyDone({ mergedAt: 1 }), true)
  assert.equal(isDependencyDone({ cleanedAt: 1 }), true)
  assert.equal(isDependencyDone({ mergedAt: 1, cleanedAt: 2 }), true)
  assert.equal(isDependencyDone({}), false)
  assert.equal(isDependencyDone(null), false)
})

test('isSameProject prefers projectId and falls back to the repo path', () => {
  assert.equal(isSameProject({ projectId: 'p1' }, { projectId: 'p1' }), true)
  assert.equal(isSameProject({ projectId: 'p1' }, { projectId: 'p2' }), false)
  assert.equal(
    isSameProject({ repoPath: 'C:/repo' }, { repoPath: 'C:/repo/' }),
    true,
    'a trailing separator is not a different project',
  )
  assert.equal(isSameProject({ repoPath: 'C:/repo' }, { repoPath: 'D:/other' }), false)
  assert.equal(isSameProject({}, {}), true, 'legacy rows without an identity are compatible')
})

function rows(...tasks: any[]) {
  return tasks
}

const A = { id: 'a', projectId: 'p1', dependsOn: [] as string[] }
const B = { id: 'b', projectId: 'p1' }
const C = { id: 'c', projectId: 'p1' }

test('validateDependencyIds accepts a valid list', () => {
  assert.deepEqual(
    validateDependencyIds({ taskId: 'a', projectId: 'p1', ids: ['b', 'c'], tasks: rows(A, B, C) }),
    { ok: true },
  )
  assert.deepEqual(
    validateDependencyIds({ taskId: 'a', projectId: 'p1', ids: [], tasks: rows(A, B, C) }),
    { ok: true },
  )
})

test('validateDependencyIds rejects too many, self, missing and cross-project ids', () => {
  const many = Array.from({ length: DEPENDENCY_LIMIT + 1 }, (_, i) => 'x' + i)
  const tasks = rows(A, B, C, ...many.map((id) => ({ id, projectId: 'p1' })))
  assert.deepEqual(
    validateDependencyIds({ taskId: 'a', projectId: 'p1', ids: many, tasks }),
    { ok: false, error: 'too-many' },
  )
  assert.deepEqual(
    validateDependencyIds({ taskId: 'a', projectId: 'p1', ids: ['a'], tasks }),
    { ok: false, error: 'self' },
  )
  assert.deepEqual(
    validateDependencyIds({ taskId: 'a', projectId: 'p1', ids: ['zzz'], tasks }),
    { ok: false, error: 'missing' },
  )
  assert.deepEqual(
    validateDependencyIds({ taskId: 'a', projectId: 'p1', ids: ['other'], tasks: rows(A, B, C, { id: 'other', projectId: 'p2' }) }),
    { ok: false, error: 'cross-project' },
  )
  // Without project ids the repo path is the project identity.
  assert.deepEqual(
    validateDependencyIds({
      taskId: 'a',
      repoPath: 'C:/repo',
      ids: ['elsewhere'],
      tasks: rows({ id: 'a', repoPath: 'C:/repo' }, { id: 'elsewhere', repoPath: 'D:/other' }),
    }),
    { ok: false, error: 'cross-project' },
  )
})

test('validateDependencyIds rejects direct and indirect cycles', () => {
  // b already depends on a; a depending on b closes a 2-cycle.
  const two = rows({ id: 'a', projectId: 'p1' }, { id: 'b', projectId: 'p1', dependsOn: ['a'] })
  assert.deepEqual(
    validateDependencyIds({ taskId: 'a', projectId: 'p1', ids: ['b'], tasks: two }),
    { ok: false, error: 'cycle' },
  )
  // c -> b -> a; a depending on c closes a 3-cycle.
  const three = rows(
    { id: 'a', projectId: 'p1' },
    { id: 'b', projectId: 'p1', dependsOn: ['a'] },
    { id: 'c', projectId: 'p1', dependsOn: ['b'] },
  )
  assert.deepEqual(
    validateDependencyIds({ taskId: 'a', projectId: 'p1', ids: ['c'], tasks: three }),
    { ok: false, error: 'cycle' },
  )
})

test('validateDependencyIds allows chains and diamonds', () => {
  const tasks = rows(
    { id: 'a', projectId: 'p1', dependsOn: [] as string[] },
    { id: 'b', projectId: 'p1', dependsOn: ['a'] },
    { id: 'c', projectId: 'p1', dependsOn: ['a'] },
    { id: 'd', projectId: 'p1', dependsOn: [] as string[] },
  )
  assert.deepEqual(
    validateDependencyIds({ taskId: 'a', projectId: 'p1', ids: ['d'], tasks }),
    { ok: true },
    'a dependency chain is not a cycle',
  )
  assert.deepEqual(
    validateDependencyIds({ taskId: 'd', projectId: 'p1', ids: ['b', 'c'], tasks }),
    { ok: true },
    'two paths to the same dependency are not a cycle',
  )
})

test('dependencyStatus reports done, open and missing dependencies', () => {
  const lookup = new Map<string, any>([
    ['b', { id: 'b', title: 'second', mergedAt: 1 }],
    ['c', { id: 'c', title: 'third' }],
  ])
  const status = dependencyStatus({ dependsOn: ['b', 'c', 'gone', 'c'] }, lookup)
  assert.equal(status.total, 2)
  assert.equal(status.done, 1)
  assert.deepEqual(status.open, [{ id: 'c', title: 'third', done: false }])
  assert.deepEqual(status.missing, ['gone'])
  assert.equal(status.blocked, true)
})

test('dependencyStatus is not blocked by missing ids and keeps the list order', () => {
  const lookup = new Map<string, any>([
    ['b', { id: 'b', title: 'second' }],
    ['c', { id: 'c', title: 'third', cleanedAt: 2 }],
  ])
  const status = dependencyStatus({ dependsOn: ['c', 'b'] }, lookup)
  assert.deepEqual(status.open.map((item) => item.id), ['b'])
  assert.equal(status.done, 1)
  assert.equal(
    dependencyStatus({ dependsOn: ['gone'] }, lookup).blocked,
    false,
    'a deleted dependency never blocks',
  )
  const empty = dependencyStatus({}, lookup)
  assert.deepEqual(empty, { total: 0, done: 0, open: [], missing: [], blocked: false })
})
