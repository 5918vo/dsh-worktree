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
