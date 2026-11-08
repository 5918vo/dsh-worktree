import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { bootHost } from './helpers/host.js'
import { callRoute, findRoute } from './helpers/http.js'
import { commitFile, exists, initRepo, mkTempDir, rmrf } from './helpers/git.js'

const PREFIX = '/dsh-worktree/api'

let root = ''
let repo = ''
let routes: any[] = []
let token = ''
let prevStateDir: string | undefined

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
  prevStateDir = process.env.DSH_WORKTREE_STATE_DIR
  process.env.DSH_WORKTREE_STATE_DIR = join(root, 'state')
  const harness = bootHost({})
  routes = harness.routes
  const res = await call('session', { body: {} })
  token = res.body.token
  assert.ok(token, 'expected a board token from POST /session')
})

after(async () => {
  if (prevStateDir === undefined) delete process.env.DSH_WORKTREE_STATE_DIR
  else process.env.DSH_WORKTREE_STATE_DIR = prevStateDir
  // Let the host store's debounced saves settle before deleting the temp tree.
  await new Promise((resolve) => setTimeout(resolve, 500))
  if (root) await rmrf(root)
})

test('requests without a token are rejected', async () => {
  const res = await call('tasks', { method: 'GET' })
  assert.equal(res.status, 403)
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
