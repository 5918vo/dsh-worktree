import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { applyPublishTemplate } from '../src/client/publish-state.js'
import { Runtime, TaskError } from '../src/runtime.js'
import { Store } from '../src/store.js'
import { bootHost } from './helpers/host.js'
import { callRoute, findRoute } from './helpers/http.js'
import { mkTempDir, rmrf } from './helpers/git.js'

const CONFIG = { dirName: '.dsh-worktrees', branchPrefix: 'dsh-wt/', gitPath: 'git' }
const PREFIX = '/dsh-worktree/api'
const TOKEN_HEADER = 'x-dsh-worktree-token'

let root = ''
let store: Store
let runtime: Runtime
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
  root = await mkTempDir('dshw-templates-')
  store = new Store(join(root, 'state'))
  await store.load()
  runtime = new Runtime({ store, config: CONFIG, sessionState: () => 'idle' })
  const harness = bootHost({}, { stateDir: join(root, 'http-state') })
  routes = harness.routes
  const res = await call('session', { body: {} })
  token = res.body.token
  assert.ok(token)
})

after(async () => {
  store.dispose()
  await new Promise((resolve) => setTimeout(resolve, 100))
  if (root) await rmrf(root)
})

test('applyPublishTemplate splits library picks from manual lines', () => {
  const template = {
    id: 't1',
    name: 'feature',
    title: 'Add {{name}}',
    description: 'Do the thing',
    criteria: ['tests pass', 'docs updated', 'custom check'],
    createdAt: 1,
  }
  const out = applyPublishTemplate(template, ['tests pass', 'docs updated'])
  assert.equal(out.title, 'Add {{name}}')
  assert.equal(out.description, 'Do the thing')
  assert.deepEqual(out.picked, ['tests pass', 'docs updated'])
  assert.equal(out.manual, 'custom check')

  const onlyManual = applyPublishTemplate({ ...template, criteria: ['custom'] }, [])
  assert.deepEqual(onlyManual.picked, [])
  assert.equal(onlyManual.manual, 'custom')
})

test('store creates, updates and deletes templates under its lock', async () => {
  const created = store.saveTemplate({
    name: '  release  ',
    title: 'Ship it',
    description: 'Release checklist',
    criteria: [' changelog ', 'changelog', 'tests pass'],
  })
  assert.equal(created.ok, true)
  if (!created.ok) return
  const item = created.item
  assert.equal(item.name, 'release')
  assert.deepEqual(item.criteria, ['changelog', 'tests pass'])
  assert.equal(item.createdAt > 0, true)
  assert.equal(item.updatedAt, undefined)

  const updated = store.saveTemplate({ id: item.id, name: 'release v2', title: 'Ship v2', criteria: ['tests pass'] })
  assert.equal(updated.ok, true)
  if (!updated.ok) return
  assert.equal(updated.item.id, item.id)
  assert.equal(updated.item.createdAt, item.createdAt, 'createdAt survives edits')
  assert.equal(updated.item.updatedAt! >= item.createdAt, true)

  const listed = store.listTemplates()
  assert.equal(listed.length, 1)
  assert.equal(listed[0].name, 'release v2')
  assert.deepEqual(listed[0].criteria, ['tests pass'])

  assert.equal(store.saveTemplate({ id: 'nope', name: 'x' }).ok, false)
  assert.deepEqual(store.deleteTemplate(item.id), [])
  assert.deepEqual(store.listTemplates(), [])
})

test('listTemplates sorts newest first without reshuffling on edit', async () => {
  const first = store.saveTemplate({ name: 'first' })
  await new Promise((resolve) => setTimeout(resolve, 5))
  const second = store.saveTemplate({ name: 'second' })
  assert.equal(first.ok && second.ok, true)
  if (!first.ok || !second.ok) return
  assert.deepEqual(store.listTemplates().map((t) => t.name), ['second', 'first'])

  store.saveTemplate({ id: first.item.id, name: 'first edited' })
  assert.deepEqual(store.listTemplates().map((t) => t.name), ['second', 'first edited'])
  store.deleteTemplate(first.item.id)
  store.deleteTemplate(second.item.id)
})

test('a second store instance sees templates saved by the first', async () => {
  const second = new Store(join(root, 'state'))
  await second.load()
  second.saveTemplate({ name: 'from second', title: 'T' })
  const names = store.listTemplates().map((t) => t.name)
  assert.deepEqual(names, ['from second'])
  assert.deepEqual(second.listTemplates().map((t) => t.name), ['from second'])
  second.dispose()
  store.deleteTemplate(store.listTemplates()[0].id)
})

test('runtime validates template names and ids', async () => {
  assert.throws(
    () => runtime.saveTaskTemplate({ name: '   ' }),
    (e: any) => e instanceof TaskError && e.status === 400 && /模板名称不能为空/.test(e.message),
  )
  assert.throws(
    () => runtime.saveTaskTemplate({ id: 'missing', name: 'x' }),
    (e: any) => e instanceof TaskError && e.status === 404 && /模板不存在：missing/.test(e.message),
  )
  const saved = runtime.saveTaskTemplate({ name: 'cli', criteria: ['a'] })
  assert.equal(saved.length, 1)
  assert.deepEqual(runtime.listTaskTemplates().map((t) => t.name), ['cli'])
  assert.deepEqual(runtime.deleteTaskTemplate(saved[0].id), [])
})

test('templates HTTP API is public to read and token-guarded to write', async () => {
  const publicList = await call('templates', { method: 'GET' })
  assert.equal(publicList.status, 200)
  assert.deepEqual(publicList.body.templates, [])

  const denied = await call('templates/save', { body: { name: 'x' } })
  assert.equal(denied.status, 403)

  const auth = { [TOKEN_HEADER]: token }
  const created = await call('templates/save', { headers: auth, body: { name: 'web', title: 'Web', criteria: ['done'] } })
  assert.equal(created.status, 200)
  assert.equal(created.body.templates.length, 1)
  const id = created.body.templates[0].id

  const edited = await call('templates/save', { headers: auth, body: { id, name: 'web2', criteria: ['done'] } })
  assert.equal(edited.status, 200)
  assert.equal(edited.body.templates[0].name, 'web2')

  const missing = await call('templates/save', { headers: auth, body: { id: 'nope', name: 'x' } })
  assert.equal(missing.status, 404)

  const removed = await call('templates/delete', { headers: auth, body: { id } })
  assert.equal(removed.status, 200)
  assert.deepEqual(removed.body.templates, [])
})
