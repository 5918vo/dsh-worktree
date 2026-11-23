import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { bootHost } from './helpers/host.js'
import { callRoute, findRoute } from './helpers/http.js'
import { commitFile, exists, git, initRepo, mkTempDir, rmrf } from './helpers/git.js'

const PREFIX = '/dsh-worktree/api'

let root = ''
let repo = ''
let routes: any[] = []
let app: any = null
let token = ''

async function call(name: string, opts: { method?: string; body?: unknown; headers?: Record<string, string> }) {
  const route = findRoute(routes, `${PREFIX}/${name}`)
  return callRoute(route.handler, {
    method: opts.method || 'POST',
    url: `${PREFIX}/${name}`,
    headers: Object.assign({ 'content-type': 'application/json' }, opts.headers || {}),
    body: opts.body,
  })
}

before(async () => {
  root = await mkTempDir('dshw-http-')
  repo = join(root, 'repo')
  await fs.mkdir(repo, { recursive: true })
  await initRepo(repo)
  // Isolate the task ledger: the host plugin writes projects/tasks into this
  // temp dir instead of the real `~/.dsh/worktree-tasks`, so a test run never
  // leaves a "test project + subtasks" behind on the user's board. The temp
  // root (including `state/`) is removed in the after() hook below.
  const harness = bootHost({ dirName: join(root, 'worktrees') }, { stateDir: join(root, 'state') })
  routes = harness.routes
  app = harness.app
  const res = await call('session', { body: {} })
  token = res.body.token
  assert.ok(token, 'expected a board token from POST /session')
})

after(async () => {
  // The store writes synchronously, but give the host a beat to finish any
  // in-flight request before deleting the temp tree that also holds `state/`.
  await new Promise((resolve) => setTimeout(resolve, 100))
  if (root) await rmrf(root)
})

test('GET /session is answered instead of 405', async () => {
  // Some hosts probe the board session endpoint with GET before the client
  // posts. Answering it keeps the board from logging a 405 and reloading.
  const route = findRoute(routes, `${PREFIX}/session`)
  const res = await callRoute(route.handler, { method: 'GET', url: `${PREFIX}/session` })
  assert.equal(res.status, 200)
  assert.ok(res.body.token, 'GET should mint a board token')

  // POST is unchanged: only the board client may ask for a token.
  const bad = await callRoute(route.handler, {
    method: 'POST',
    url: `${PREFIX}/session`,
    headers: { 'content-type': 'application/json' },
    body: { sessionId: 'someone-else' },
  })
  assert.equal(bad.status, 403)
  assert.equal(bad.body.error, 'unknown client')
})

test('requests without a token are rejected', async () => {
  const res = await call('tasks', { method: 'GET' })
  assert.equal(res.status, 403)
})

test('recents are not readable or clearable without the board token', async () => {
  // Recents carry absolute repo paths, so they are as sensitive as the task list.
  const read = await call('recents', { method: 'GET' })
  assert.equal(read.status, 403)
  const clear = await call('recents/clear', { body: {} })
  assert.equal(clear.status, 403)
  const wrong = await call('recents', { method: 'GET', headers: { 'x-dsh-worktree-token': 'nope' } })
  assert.equal(wrong.status, 403)

  const auth = { 'x-dsh-worktree-token': token }
  const listed = await call('recents', { method: 'GET', headers: auth })
  assert.equal(listed.status, 200)
  assert.ok(Array.isArray(listed.body.dirs))
  const cleared = await call('recents/clear', { body: {}, headers: auth })
  assert.equal(cleared.status, 200)
  assert.equal(cleared.body.ok, true)
  const empty = await call('recents', { method: 'GET', headers: auth })
  assert.deepEqual(empty.body.dirs, [])
})

test('cross-site requests are rejected even with a token', async () => {
  const res = await call('tasks', { method: 'GET', headers: { 'x-dsh-worktree-token': token, 'sec-fetch-site': 'cross-site' } })
  assert.equal(res.status, 403)
  assert.equal(res.body.error, 'untrusted-origin')
})

test('main flow over HTTP: publish -> bind -> execute -> merge -> cleanup', async () => {
  const auth = { 'x-dsh-worktree-token': token }

  // 1. register the project
  const added = await call('projects/add', { body: { repoPath: repo }, headers: auth })
  assert.equal(added.status, 200)
  const projectId = added.body.project.id
  assert.ok(projectId)

  // 2. publish a task (this is what "新建任务" does)
  const published = await call('publish', {
    body: { projectId, title: '新建任务', description: '实现一个新功能', branchName: 'feat/http-flow' },
    headers: auth,
  })
  assert.equal(published.status, 200, JSON.stringify(published.body))
  const task = published.body.task
  assert.ok(await exists(task.worktreePath), 'worktree should be created on publish')

  // 3. task shows up as ready
  const listed = await call('tasks', { method: 'GET', headers: auth })
  assert.equal(listed.status, 200)
  const found = listed.body.tasks.find((v: any) => v.task.id === task.id)
  assert.ok(found, 'published task should appear on the board')
  assert.equal(found.snapshot.status, 'ready')

  // 4. bind a session (this is what makes the task executable)
  const bound = await call('bind', { body: { id: task.id, sessionId: 'sess-http-1' }, headers: auth })
  assert.equal(bound.status, 200)
  assert.equal(bound.body.task.sessionId, 'sess-http-1')
  assert.equal(bound.body.task.startOnBind, false)

  const developing = await call('tasks', { method: 'GET', headers: auth })
  assert.equal(developing.body.tasks.find((v: any) => v.task.id === task.id).snapshot.status, 'developing')

  // 5. the bound agent commits inside the worktree -> review
  await commitFile(task.worktreePath, 'src/feature.txt', 'hello\n', 'feat: implement')
  const reviewed = await call('tasks', { method: 'GET', headers: auth })
  assert.equal(reviewed.body.tasks.find((v: any) => v.task.id === task.id).snapshot.status, 'review')

  // 6. merge back into base
  const merged = await call('task/merge', { body: { id: task.id }, headers: auth })
  assert.equal(merged.status, 200, JSON.stringify(merged.body))
  assert.equal(merged.body.view.snapshot.status, 'merged')

  // 7. cleanup worktree + branch
  const cleaned = await call('task/cleanup', { body: { id: task.id, deleteBranch: true }, headers: auth })
  assert.equal(cleaned.status, 200, JSON.stringify(cleaned.body))
  assert.equal(cleaned.body.view.snapshot.status, 'cleaned')
  assert.equal(await exists(task.worktreePath), false)

  const finalList = await call('tasks', { method: 'GET', headers: auth })
  assert.equal(finalList.body.tasks.find((v: any) => v.task.id === task.id).snapshot.status, 'cleaned')
})

test('projects/add reports whether the repository was already registered', async () => {
  const auth = { 'x-dsh-worktree-token': token }
  const fresh = join(root, 'repo-existing')
  await fs.mkdir(fresh, { recursive: true })
  await initRepo(fresh)
  await commitFile(fresh, 'readme.md', 'x')

  const first = await call('projects/add', { body: { repoPath: fresh, name: 'dup-check' }, headers: auth })
  assert.equal(first.status, 200, JSON.stringify(first.body))
  assert.equal(first.body.existing, false)

  const again = await call('projects/add', { body: { repoPath: fresh + '/', name: 'renamed' }, headers: auth })
  assert.equal(again.status, 200, JSON.stringify(again.body))
  assert.equal(again.body.existing, true)
  assert.equal(again.body.project.id, first.body.project.id)
  assert.equal(again.body.project.name, 'dup-check')
})

test('publish validation errors surface as 400, not 500', async () => {
  const auth = { 'x-dsh-worktree-token': token }
  const added = await call('projects/add', { body: { repoPath: repo }, headers: auth })
  const projectId = added.body.project.id
  const res = await call('publish', { body: { projectId, title: '', description: 'x' }, headers: auth })
  assert.equal(res.status, 400)
  assert.match(res.body.error, /任务标题不能为空/)
})

test('projects/delete removes worktree folders when withWorktrees is set', async () => {
  const auth = { 'x-dsh-worktree-token': token }
  const added = await call('projects/add', { body: { repoPath: repo }, headers: auth })
  const projectId = added.body.project.id
  const published = await call('publish', {
    body: { projectId, title: '待删除项目任务', description: 'tmp', branchName: 'feat/http-del-wt' },
    headers: auth,
  })
  assert.equal(published.status, 200, JSON.stringify(published.body))
  const task = published.body.task
  assert.ok(await exists(task.worktreePath), 'worktree should exist before delete')

  const res = await call('projects/delete', { body: { id: projectId, withTasks: true, withWorktrees: true }, headers: auth })
  assert.equal(res.status, 200, JSON.stringify(res.body))
  assert.ok(res.body.deletedTasks >= 1)
  assert.equal(res.body.deletedWorktrees, 1)
  assert.equal(await exists(task.worktreePath), false)

  const after = await call('tasks', { method: 'GET', headers: auth })
  assert.equal(after.body.tasks.some((v: any) => v.task.id === task.id), false)
})

test('projects/delete keeps worktree folders when withWorktrees is false', async () => {
  const auth = { 'x-dsh-worktree-token': token }
  const added = await call('projects/add', { body: { repoPath: repo }, headers: auth })
  const projectId = added.body.project.id
  const published = await call('publish', {
    body: { projectId, title: '保留 worktree 任务', description: 'tmp', branchName: 'feat/http-keep-wt' },
    headers: auth,
  })
  const task = published.body.task
  const res = await call('projects/delete', { body: { id: projectId, withTasks: true, withWorktrees: false }, headers: auth })
  assert.equal(res.status, 200, JSON.stringify(res.body))
  assert.equal(res.body.deletedWorktrees, 0)
  assert.ok(await exists(task.worktreePath), 'worktree should stay on disk')
})

test('acting on an unknown task returns 404', async () => {
  const auth = { 'x-dsh-worktree-token': token }
  const res = await call('task/merge', { body: { id: 'nope' }, headers: auth })
  assert.equal(res.status, 404)
})

test('task/diff returns per-file changes for a task', async () => {
  const auth = { 'x-dsh-worktree-token': token }
  const added = await call('projects/add', { body: { repoPath: repo }, headers: auth })
  const projectId = added.body.project.id
  const published = await call('publish', {
    body: { projectId, title: 'diff 任务', description: '实现', branchName: 'feat/http-diff' },
    headers: auth,
  })
  assert.equal(published.status, 200, JSON.stringify(published.body))
  const task = published.body.task
  await commitFile(task.worktreePath, 'src/diff.txt', 'a\nb\n', 'feat: diff')

  const route = findRoute(routes, `${PREFIX}/task/diff`)
  const res = await callRoute(route.handler, {
    method: 'GET',
    url: `${PREFIX}/task/diff?id=${encodeURIComponent(task.id)}`,
    headers: auth,
  })
  assert.equal(res.status, 200, JSON.stringify(res.body))
  assert.ok(res.body.diff, 'diff payload expected')
  const file = res.body.diff.files.find((f: any) => f.path === 'src/diff.txt')
  assert.ok(file, 'committed file should be listed')
  assert.ok(file.patch.includes('+a'))
})

test('task/diff for a merged task reads the merge commit, not the emptied base diff', async () => {
  const auth = { 'x-dsh-worktree-token': token }
  const added = await call('projects/add', { body: { repoPath: repo }, headers: auth })
  const projectId = added.body.project.id
  const published = await call('publish', {
    body: { projectId, title: '已合并 diff', description: '实现', branchName: 'feat/http-merged-diff' },
    headers: auth,
  })
  assert.equal(published.status, 200, JSON.stringify(published.body))
  const task = published.body.task
  await commitFile(task.worktreePath, 'src/merged.txt', 'merged' + String.fromCharCode(10), 'feat: merged diff')
  const merged = await call('task/merge', { body: { id: task.id }, headers: auth })
  assert.equal(merged.status, 200, JSON.stringify(merged.body))

  const route = findRoute(routes, `${PREFIX}/task/diff`)
  const res = await callRoute(route.handler, {
    method: 'GET',
    url: `${PREFIX}/task/diff?id=${encodeURIComponent(task.id)}`,
    headers: auth,
  })
  assert.equal(res.status, 200, JSON.stringify(res.body))
  assert.equal(res.body.diff.source, 'merge-commit')
  const file = res.body.diff.files.find((f: any) => f.path === 'src/merged.txt')
  assert.ok(file, 'merge commit changes should be listed after a merge')
  assert.ok(file.patch.includes('+merged'))
})

test('publish with parentId continues a merged task over HTTP', async () => {
  const auth = { 'x-dsh-worktree-token': token }
  const added = await call('projects/add', { body: { repoPath: repo }, headers: auth })
  const projectId = added.body.project.id

  const published = await call('publish', {
    body: { projectId, title: '父任务', description: '实现父功能', branchName: 'feat/http-parent' },
    headers: auth,
  })
  assert.equal(published.status, 200, JSON.stringify(published.body))
  const parent = published.body.task
  await commitFile(parent.worktreePath, 'src/http-parent.txt', 'x\n', 'feat: parent')

  const merged = await call('task/merge', { body: { id: parent.id }, headers: auth })
  assert.equal(merged.status, 200, JSON.stringify(merged.body))

  const child = await call('publish', {
    body: { projectId, title: '子任务', description: '实现子功能', branchName: 'feat/http-child', parentId: parent.id },
    headers: auth,
  })
  assert.equal(child.status, 200, JSON.stringify(child.body))
  assert.equal(child.body.task.parentId, parent.id)
})

test('publish with an unknown parentId returns 404', async () => {
  const auth = { 'x-dsh-worktree-token': token }
  const added = await call('projects/add', { body: { repoPath: repo }, headers: auth })
  const projectId = added.body.project.id
  const res = await call('publish', {
    body: { projectId, title: 'x', description: 'y', parentId: 'does-not-exist' },
    headers: auth,
  })
  assert.equal(res.status, 404)
})

test('task/archive hides a merged task from the default listing and unarchive restores it', async () => {
  const auth = { 'x-dsh-worktree-token': token }
  const added = await call('projects/add', { body: { repoPath: repo }, headers: auth })
  const projectId = added.body.project.id
  const published = await call('publish', {
    body: { projectId, title: '归档任务', description: '实现后归档', branchName: 'feat/http-archive' },
    headers: auth,
  })
  assert.equal(published.status, 200, JSON.stringify(published.body))
  const task = published.body.task
  await commitFile(task.worktreePath, 'src/http-archive.txt', 'x\n', 'feat: archive')
  const merged = await call('task/merge', { body: { id: task.id }, headers: auth })
  assert.equal(merged.status, 200, JSON.stringify(merged.body))
  const subject = await git(repo, ['log', '-1', '--pretty=%s'])
  assert.match(subject.trim(), /^Merge task [0-9a-f]{8}: 归档任务$/)

  const archived = await call('task/archive', { body: { id: task.id }, headers: auth })
  assert.equal(archived.status, 200, JSON.stringify(archived.body))
  assert.ok(archived.body.view.task.archivedAt, 'archive returns the updated view')

  const def = await call('tasks', { method: 'GET', headers: auth })
  assert.equal(def.body.tasks.some((v: any) => v.task.id === task.id), false, 'archived task hidden by default')
  const route = findRoute(routes, `${PREFIX}/tasks`)
  const all = await callRoute(route.handler, { method: 'GET', url: `${PREFIX}/tasks?includeArchived=1`, headers: auth })
  assert.equal(all.status, 200, JSON.stringify(all.body))
  assert.equal(all.body.tasks.some((v: any) => v.task.id === task.id), true, 'includeArchived returns it')

  const restored = await call('task/unarchive', { body: { id: task.id }, headers: auth })
  assert.equal(restored.status, 200, JSON.stringify(restored.body))
  assert.equal(restored.body.view.task.archivedAt, undefined)
  const def2 = await call('tasks', { method: 'GET', headers: auth })
  assert.equal(def2.body.tasks.some((v: any) => v.task.id === task.id), true, 'unarchive restores the default listing')
})

test('task/meta saves tags, priority and notes without clearing the other fields', async () => {
  const auth = { 'x-dsh-worktree-token': token }
  const added = await call('projects/add', { body: { repoPath: repo }, headers: auth })
  const projectId = added.body.project.id
  const published = await call('publish', {
    body: { projectId, title: 'meta task', description: 'd' },
    headers: auth,
  })
  assert.equal(published.status, 200, JSON.stringify(published.body))
  const id = published.body.task.id

  const seeded = await call('task/meta', {
    body: { id, tags: ['ui', 'UI', 'api'], priority: 'high', notes: 'first note' },
    headers: auth,
  })
  assert.equal(seeded.status, 200, JSON.stringify(seeded.body))
  assert.deepEqual(seeded.body.view.task.tags, ['ui', 'api'])
  assert.equal(seeded.body.view.task.priority, 'high')
  assert.equal(seeded.body.view.task.notes, 'first note')

  // Notes-only: the HTTP layer must not forward tags/priority as cleared.
  const notesOnly = await call('task/meta', { body: { id, notes: 'second note' }, headers: auth })
  assert.equal(notesOnly.status, 200, JSON.stringify(notesOnly.body))
  assert.deepEqual(notesOnly.body.view.task.tags, ['ui', 'api'])
  assert.equal(notesOnly.body.view.task.priority, 'high')
  assert.equal(notesOnly.body.view.task.notes, 'second note')

  // Explicit empty values clear the fields.
  const cleared = await call('task/meta', { body: { id, tags: [], priority: 'normal', notes: '' }, headers: auth })
  assert.equal(cleared.status, 200, JSON.stringify(cleared.body))
  assert.equal('tags' in cleared.body.view.task, false)
  assert.equal('priority' in cleared.body.view.task, false)
  assert.equal('notes' in cleared.body.view.task, false)
})

test('task/meta rejects unauthenticated, unknown and invalid requests', async () => {
  const auth = { 'x-dsh-worktree-token': token }
  const anonymous = await call('task/meta', { body: { id: 'x', notes: 'n' } })
  assert.equal(anonymous.status, 403)

  const unknown = await call('task/meta', { body: { id: 'missing', notes: 'n' }, headers: auth })
  assert.equal(unknown.status, 404)
  assert.match(unknown.body.error, /任务不存在：missing/)

  const added = await call('projects/add', { body: { repoPath: repo }, headers: auth })
  const published = await call('publish', {
    body: { projectId: added.body.project.id, title: 'meta invalid', description: 'd' },
    headers: auth,
  })
  const id = published.body.task.id

  const priority = await call('task/meta', { body: { id, priority: 'urgent' }, headers: auth })
  assert.equal(priority.status, 400)
  assert.equal(priority.body.error, '优先级只能是 low、normal 或 high')

  const tooMany = await call('task/meta', {
    body: { id, tags: Array.from({ length: 9 }, (_, i) => 't' + i) },
    headers: auth,
  })
  assert.equal(tooMany.status, 400)
  assert.equal(tooMany.body.error, '标签最多 8 个')

  const tooLong = await call('task/meta', { body: { id, notes: 'x'.repeat(2001) }, headers: auth })
  assert.equal(tooLong.status, 400)
  assert.equal(tooLong.body.error, '备注最多 2000 个字符')
})

test('publish accepts tags and priority and rejects invalid values', async () => {
  const auth = { 'x-dsh-worktree-token': token }
  const added = await call('projects/add', { body: { repoPath: repo }, headers: auth })
  const projectId = added.body.project.id

  const published = await call('publish', {
    body: { projectId, title: 'tagged', description: 'd', tags: ['ui', 'api'], priority: 'high' },
    headers: auth,
  })
  assert.equal(published.status, 200, JSON.stringify(published.body))
  assert.deepEqual(published.body.task.tags, ['ui', 'api'])
  assert.equal(published.body.task.priority, 'high')

  // normal is the default and stays out of the record.
  const normal = await call('publish', {
    body: { projectId, title: 'normal', description: 'd', priority: 'normal' },
    headers: auth,
  })
  assert.equal(normal.status, 200, JSON.stringify(normal.body))
  assert.equal('priority' in normal.body.task, false)

  const badTags = await call('publish', {
    body: { projectId, title: 'bad tags', description: 'd', tags: Array.from({ length: 9 }, (_, i) => 't' + i) },
    headers: auth,
  })
  assert.equal(badTags.status, 400)
  assert.equal(badTags.body.error, '标签最多 8 个')

  const badPriority = await call('publish', {
    body: { projectId, title: 'bad priority', description: 'd', priority: 'urgent' },
    headers: auth,
  })
  assert.equal(badPriority.status, 400)
  assert.equal(badPriority.body.error, '优先级只能是 low、normal 或 high')
})

test('task/meta stores dependencies and rejects invalid ones', async () => {
  const auth = { 'x-dsh-worktree-token': token }
  const added = await call('projects/add', { body: { repoPath: repo }, headers: auth })
  const projectId = added.body.project.id
  const mk = async (title: string) => {
    const res = await call('publish', { body: { projectId, title, description: 'd' }, headers: auth })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    return res.body.task.id as string
  }
  const a = await mk('dep a')
  const b = await mk('dep b')
  const c = await mk('dep c')

  const set = await call('task/meta', { body: { id: a, dependsOn: [b, c, b] }, headers: auth })
  assert.equal(set.status, 200, JSON.stringify(set.body))
  assert.deepEqual(set.body.view.task.dependsOn, [b, c], 'duplicates are dropped')

  // A patch for another field keeps the edges intact.
  const unrelated = await call('task/meta', { body: { id: a, notes: 'keep deps' }, headers: auth })
  assert.equal(unrelated.status, 200, JSON.stringify(unrelated.body))
  assert.deepEqual(unrelated.body.view.task.dependsOn, [b, c])

  const tooMany = await call('task/meta', {
    body: { id: a, dependsOn: Array.from({ length: 9 }, (_, i) => 'x' + i) },
    headers: auth,
  })
  assert.equal(tooMany.status, 400, JSON.stringify(tooMany.body))
  assert.equal(tooMany.body.error, '前置任务最多 8 个')

  const self = await call('task/meta', { body: { id: a, dependsOn: [a] }, headers: auth })
  assert.equal(self.status, 400, JSON.stringify(self.body))
  assert.equal(self.body.error, '不能依赖自己')

  const missing = await call('task/meta', { body: { id: a, dependsOn: ['nope'] }, headers: auth })
  assert.equal(missing.status, 400, JSON.stringify(missing.body))
  assert.equal(missing.body.error, '前置任务不存在')

  // a -> b is set, so b -> a is a direct cycle.
  const direct = await call('task/meta', { body: { id: b, dependsOn: [a] }, headers: auth })
  assert.equal(direct.status, 400, JSON.stringify(direct.body))
  assert.equal(direct.body.error, '不能形成循环依赖')

  // e <- f <- g; making e depend on g closes a longer cycle.
  const e = await mk('dep e')
  const f = await mk('dep f')
  const g = await mk('dep g')
  assert.equal((await call('task/meta', { body: { id: f, dependsOn: [e] }, headers: auth })).status, 200)
  assert.equal((await call('task/meta', { body: { id: g, dependsOn: [f] }, headers: auth })).status, 200)
  const indirect = await call('task/meta', { body: { id: e, dependsOn: [g] }, headers: auth })
  assert.equal(indirect.status, 400, JSON.stringify(indirect.body))
  assert.equal(indirect.body.error, '不能形成循环依赖')

  // A dependency from another project is refused even though the id exists.
  const repo2 = join(root, 'repo2')
  await fs.mkdir(repo2, { recursive: true })
  await initRepo(repo2)
  const added2 = await call('projects/add', { body: { repoPath: repo2 }, headers: auth })
  const other = (await call('publish', {
    body: { projectId: added2.body.project.id, title: 'dep other', description: 'd' },
    headers: auth,
  })).body.task.id
  const cross = await call('task/meta', { body: { id: a, dependsOn: [other] }, headers: auth })
  assert.equal(cross.status, 400, JSON.stringify(cross.body))
  assert.equal(cross.body.error, '只能依赖同一项目的任务')

  const listed = await call('tasks', { method: 'GET', headers: auth })
  const row = listed.body.tasks.find((v: any) => v.task.id === a)
  assert.deepEqual(row.task.dependsOn, [b, c], 'rejected edits never change the record')

  const cleared = await call('task/meta', { body: { id: a, dependsOn: [] }, headers: auth })
  assert.equal(cleared.status, 200, JSON.stringify(cleared.body))
  assert.equal('dependsOn' in cleared.body.view.task, false)
})

test('publish accepts a due date and rejects an invalid one', async () => {
  const auth = { 'x-dsh-worktree-token': token }
  const added = await call('projects/add', { body: { repoPath: repo }, headers: auth })
  const projectId = added.body.project.id

  const dated = await call('publish', {
    body: { projectId, title: 'dated', description: 'd', dueAt: '2026-07-04' },
    headers: auth,
  })
  assert.equal(dated.status, 200, JSON.stringify(dated.body))
  assert.equal(dated.body.task.dueAt, new Date(2026, 6, 4).getTime(), 'the date lands on local midnight')

  const undated = await call('publish', {
    body: { projectId, title: 'undated', description: 'd' },
    headers: auth,
  })
  assert.equal(undated.status, 200, JSON.stringify(undated.body))
  assert.equal('dueAt' in undated.body.task, false, 'no deadline means no field')

  const bad = await call('publish', {
    body: { projectId, title: 'bad due', description: 'd', dueAt: '2026-02-30' },
    headers: auth,
  })
  assert.equal(bad.status, 400)
  assert.equal(bad.body.error, '截止日期无效')
})

test('task/meta sets and clears the due date', async () => {
  const auth = { 'x-dsh-worktree-token': token }
  const added = await call('projects/add', { body: { repoPath: repo }, headers: auth })
  const published = await call('publish', {
    body: { projectId: added.body.project.id, title: 'due task', description: 'd' },
    headers: auth,
  })
  const id = published.body.task.id

  const set = await call('task/meta', { body: { id, dueAt: '2026-08-09' }, headers: auth })
  assert.equal(set.status, 200, JSON.stringify(set.body))
  assert.equal(set.body.view.task.dueAt, new Date(2026, 7, 9).getTime())

  // A notes-only patch keeps the deadline (the HTTP layer forwards dueAt only when present).
  const notesOnly = await call('task/meta', { body: { id, notes: 'keep the date' }, headers: auth })
  assert.equal(notesOnly.status, 200, JSON.stringify(notesOnly.body))
  assert.equal(notesOnly.body.view.task.dueAt, new Date(2026, 7, 9).getTime())

  const invalid = await call('task/meta', { body: { id, dueAt: 'never' }, headers: auth })
  assert.equal(invalid.status, 400)
  assert.equal(invalid.body.error, '截止日期无效')

  const cleared = await call('task/meta', { body: { id, dueAt: null }, headers: auth })
  assert.equal(cleared.status, 200, JSON.stringify(cleared.body))
  assert.equal('dueAt' in cleared.body.view.task, false)
  assert.equal(cleared.body.view.task.notes, 'keep the date', 'clearing the deadline keeps the notes')
})

test('publish accepts an estimate and rejects an invalid one before creating a task', async () => {
  const auth = { 'x-dsh-worktree-token': token }
  const added = await call('projects/add', { body: { repoPath: repo }, headers: auth })
  const projectId = added.body.project.id

  const invalidTitle = 'bad estimate'
  const invalid = await call('publish', {
    body: { projectId, title: invalidTitle, description: 'd', estimate: 4 },
    headers: auth,
  })
  assert.equal(invalid.status, 400, JSON.stringify(invalid.body))
  assert.equal(invalid.body.error, '规模估算只能是 1、2、3、5 或 8 点')
  const afterInvalid = await call('tasks', { method: 'GET', headers: auth })
  assert.equal(afterInvalid.body.tasks.some((v: any) => v.task.title === invalidTitle), false, 'no task is created for a rejected estimate')

  const estimated = await call('publish', {
    body: { projectId, title: 'sized', description: 'd', estimate: 5 },
    headers: auth,
  })
  assert.equal(estimated.status, 200, JSON.stringify(estimated.body))
  assert.equal(estimated.body.task.estimate, 5)

  const text = await call('publish', {
    body: { projectId, title: 'sized text', description: 'd', estimate: '3' },
    headers: auth,
  })
  assert.equal(text.status, 200, JSON.stringify(text.body))
  assert.equal(text.body.task.estimate, 3, 'a numeric string is normalized to points')

  const unsized = await call('publish', {
    body: { projectId, title: 'unsized', description: 'd' },
    headers: auth,
  })
  assert.equal(unsized.status, 200, JSON.stringify(unsized.body))
  assert.equal('estimate' in unsized.body.task, false, 'no estimate means no field')
})

test('task/meta sets, keeps and clears the estimate', async () => {
  const auth = { 'x-dsh-worktree-token': token }
  const added = await call('projects/add', { body: { repoPath: repo }, headers: auth })
  const published = await call('publish', {
    body: { projectId: added.body.project.id, title: 'estimate task', description: 'd' },
    headers: auth,
  })
  const id = published.body.task.id

  const set = await call('task/meta', { body: { id, estimate: 8 }, headers: auth })
  assert.equal(set.status, 200, JSON.stringify(set.body))
  assert.equal(set.body.view.task.estimate, 8)

  const notesOnly = await call('task/meta', { body: { id, notes: 'keep the size' }, headers: auth })
  assert.equal(notesOnly.status, 200, JSON.stringify(notesOnly.body))
  assert.equal(notesOnly.body.view.task.estimate, 8)

  const invalid = await call('task/meta', { body: { id, estimate: 4 }, headers: auth })
  assert.equal(invalid.status, 400)
  assert.equal(invalid.body.error, '规模估算只能是 1、2、3、5 或 8 点')
  const unchanged = await call('tasks', { method: 'GET', headers: auth })
  assert.equal(unchanged.body.tasks.find((v: any) => v.task.id === id).task.estimate, 8)

  const cleared = await call('task/meta', { body: { id, estimate: null }, headers: auth })
  assert.equal(cleared.status, 200, JSON.stringify(cleared.body))
  assert.equal('estimate' in cleared.body.view.task, false)
  assert.equal(cleared.body.view.task.notes, 'keep the size', 'clearing the estimate keeps the notes')
})

test('task/timer starts and stops the manual work clock', async () => {
  const auth = { 'x-dsh-worktree-token': token }
  const added = await call('projects/add', { body: { repoPath: repo }, headers: auth })
  const published = await call('publish', {
    body: { projectId: added.body.project.id, title: 'timed task', description: 'd' },
    headers: auth,
  })
  assert.equal(published.status, 200, JSON.stringify(published.body))
  const id = published.body.task.id

  const started = await call('task/timer', { body: { id, action: 'start' }, headers: auth })
  assert.equal(started.status, 200, JSON.stringify(started.body))
  assert.equal(started.body.ok, true)
  assert.equal(typeof started.body.view.task.workStartedAt, 'number')

  // Starting again keeps the same stamp: the running interval is not restarted.
  const again = await call('task/timer', { body: { id, action: 'start' }, headers: auth })
  assert.equal(again.status, 200, JSON.stringify(again.body))
  assert.equal(again.body.view.task.workStartedAt, started.body.view.task.workStartedAt)

  const stopped = await call('task/timer', { body: { id, action: 'stop' }, headers: auth })
  assert.equal(stopped.status, 200, JSON.stringify(stopped.body))
  assert.equal(stopped.body.ok, true)
  assert.equal('workStartedAt' in stopped.body.view.task, false)
  assert.equal(typeof stopped.body.view.task.workMs, 'number')
})

test('task/timer rejects unauthenticated, unknown, invalid and closed requests', async () => {
  const auth = { 'x-dsh-worktree-token': token }
  const anonymous = await call('task/timer', { body: { id: 'x', action: 'start' } })
  assert.equal(anonymous.status, 403)

  const unknown = await call('task/timer', { body: { id: 'missing', action: 'start' }, headers: auth })
  assert.equal(unknown.status, 404)
  assert.match(unknown.body.error, /任务不存在：missing/)

  const added = await call('projects/add', { body: { repoPath: repo }, headers: auth })
  const published = await call('publish', {
    body: { projectId: added.body.project.id, title: 'closed timer', description: 'd' },
    headers: auth,
  })
  const id = published.body.task.id

  for (const action of ['pause', '', undefined]) {
    const bad = await call('task/timer', { body: { id, action }, headers: auth })
    assert.equal(bad.status, 400, `action=${String(action)}`)
    assert.equal(bad.body.error, 'action 只能是 start 或 stop')
  }

  // A merged task is closed: no new clock, and nothing is written.
  app.store.putTask({ ...app.store.getTask(id), mergedAt: 1 })
  const closed = await call('task/timer', { body: { id, action: 'start' }, headers: auth })
  assert.equal(closed.status, 400, JSON.stringify(closed.body))
  assert.equal(closed.body.error, '已合并 / 已清理 / 已归档的任务不能开始计时')
  assert.equal(app.store.getTask(id).workStartedAt, undefined)
})
