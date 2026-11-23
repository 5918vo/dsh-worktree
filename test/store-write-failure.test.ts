import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs, chmodSync, closeSync, existsSync, openSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Store, StoreError } from '../src/store.js'
import { Project, WorktreeTask } from '../src/models.js'
import { rmrf } from './helpers/git.js'

/**
 * Write failures must never look like success.
 *
 * The ledger is shared by every DSH window, so a silent failure would leave the
 * board claiming a task/project/merge exists while nothing was persisted. These
 * tests inject real filesystem failures (not mocks) and assert the error reaches
 * the caller as a 5xx-mappable StoreError, with no half-written file behind.
 */

function project(id: string, repoPath = 'C:/repo'): Project {
  return { id, name: 'p-' + id, repoPath, baseBranch: 'main', createdAt: 1 }
}

function task(id: string, projectId: string): WorktreeTask {
  return {
    id,
    projectId,
    title: 't-' + id,
    description: 'd',
    repoPath: 'C:/repo',
    baseBranch: 'main',
    branch: 'b-' + id,
    worktreePath: 'C:/repo/.dsh-worktrees/' + id,
    sessionId: null,
    firstPrompt: '',
    startOnBind: true,
    createdAt: 1,
    updatedAt: 1,
  }
}

async function freshStore(options?: { lockWaitMs?: number }): Promise<{ store: Store; dir: string }> {
  const dir = await fs.mkdtemp(join(tmpdir(), 'dshw-write-'))
  const store = new Store(dir, options)
  await store.load()
  return { store, dir }
}

async function cleanup(store: Store, dir: string): Promise<void> {
  store.dispose()
  await store.flush().catch(() => {})
  await new Promise((resolve) => setTimeout(resolve, 50))
  await rmrf(dir)
}

test('a corrupt ledger file is quarantined instead of silently discarded', async () => {
  const dir = await fs.mkdtemp(join(tmpdir(), 'dshw-corrupt-'))
  await fs.writeFile(join(dir, 'projects.json'), '{ this is not json', 'utf8')
  const store = new Store(dir)
  try {
    await store.load()
    assert.deepEqual(store.listProjects(), [], 'a corrupt file reads as empty rather than throwing')
    assert.equal(store.warnings().length, 1, 'the loss is reported, not swallowed')
    assert.match(store.warnings()[0], /projects/)
    const quarantined = readdirSync(dir).filter((name) => name.includes('.corrupt-'))
    assert.equal(quarantined.length, 1)
    assert.equal(readFileSync(join(dir, quarantined[0]), 'utf8'), '{ this is not json', 'the original bytes are kept for recovery')
  } finally {
    store.dispose()
    await rmrf(dir)
  }
})

test('a missing ledger file is a first run, not a warning', async () => {
  const { store, dir } = await freshStore()
  try {
    assert.deepEqual(store.listProjects(), [])
    assert.deepEqual(store.warnings(), [])
  } finally {
    await cleanup(store, dir)
  }
})

test('saveProjects surfaces a write failure as a 5xx StoreError', async () => {
  const { store, dir } = await freshStore()
  try {
    store.putProject(project('p1'))
    // A directory where the ledger file belongs makes every rename fail.
    await fs.rm(join(dir, 'projects.json'))
    await fs.mkdir(join(dir, 'projects.json'))
    assert.throws(
      () => store.putProject(project('p2')),
      (error: any) => error instanceof StoreError && error.code === 'store-write' && error.status === 500,
    )
    const leftovers = readdirSync(dir).filter((name) => name.endsWith('.tmp'))
    assert.deepEqual(leftovers, [], 'no temp file is left behind')
    // Sibling ledgers are untouched: a failed projects write must not create or
    // truncate them either.
    assert.equal(existsSync(join(dir, 'tasks.json')), false)
  } finally {
    await cleanup(store, dir)
  }
})

test('putTask, bindSession and the merge journal all propagate write failures', async () => {
  const { store, dir } = await freshStore()
  const ledger = join(dir, 'tasks.json')
  // Portable write block that leaves the ledger readable: on Windows the
  // read-only attribute makes the rename fail, elsewhere the directory loses
  // its write bit so the temp file cannot be created. Either way the store must
  // report the failure instead of keeping the in-memory success.
  const block = () => chmodSync(process.platform === 'win32' ? ledger : dir, process.platform === 'win32' ? 0o444 : 0o555)
  const unblock = () => chmodSync(process.platform === 'win32' ? ledger : dir, process.platform === 'win32' ? 0o666 : 0o755)
  try {
    store.putProject(project('p1'))
    store.putTask(task('t1', 'p1'))
    const writeError = (error: any) => error instanceof StoreError && error.code === 'store-write' && error.status === 500
    block()
    try {
      assert.throws(() => store.putTask(task('t2', 'p1')), writeError, 'a task save must not pretend to succeed')
      assert.throws(() => store.bindSession('t1', 's1'), writeError, 'a binding save must not pretend to succeed')
      // The merge journal is written through the same task record.
      const journal = { ...task('t1', 'p1') }
      journal.pendingOp = { operationId: 'op-1', kind: 'merge', taskId: 't1' } as any
      assert.throws(() => store.putTask(journal), writeError, 'a journal write must not pretend to succeed')
    } finally {
      unblock()
    }
    // Recovered: the store works again and nothing was half-written.
    store.putTask(task('t2', 'p1'))
    assert.ok(JSON.parse(readFileSync(ledger, 'utf8'))['t2'])
  } finally {
    await cleanup(store, dir)
  }
})

test('the HTTP layer maps a store write failure to 500 instead of a false success', async () => {
  const { apply } = await import('../src/index.js')
  const { makeCtx } = await import('./helpers/host.js')
  const { findRoute, callRoute } = await import('./helpers/http.js')
  const PREFIX = '/dsh-worktree/api'
  const dir = await fs.mkdtemp(join(tmpdir(), 'dshw-http-write-'))
  const store = new Store(dir)
  await store.load()
  try {
    store.putProject(project('p1'))
    const t = task('t1', 'p1')
    t.sessionId = null
    store.putTask(t)
    const { ctx, routes } = makeCtx()
    apply(ctx, undefined, { store, sessionState: () => 'idle' })
    const json = { 'content-type': 'application/json' }
    const session = await callRoute(findRoute(routes, `${PREFIX}/session`).handler, { method: 'POST', url: '/session', headers: json, body: {} })
    const token = session.body.token
    assert.ok(token)
    // Keep the ledger readable but unwritable, so the handler gets past its
    // lookups and fails only at the save (the case that used to be silent).
    const ledger = join(dir, 'tasks.json')
    chmodSync(process.platform === 'win32' ? ledger : dir, process.platform === 'win32' ? 0o444 : 0o555)
    const route = findRoute(routes, `${PREFIX}/task/pin`)
    const res = await callRoute(route.handler, {
      method: 'POST',
      url: '/task/pin',
      headers: Object.assign({}, json, { 'x-dsh-worktree-token': token }),
      body: { id: 't1', pinned: true },
    })
    assert.equal(res.status, 500)
    assert.match(String(res.body.error), /写入|store/i)
    chmodSync(process.platform === 'win32' ? ledger : dir, process.platform === 'win32' ? 0o666 : 0o755)
  } finally {
    store.dispose()
    await rmrf(dir)
  }
})

test('a failed rename keeps the previous ledger bytes intact (no half write)', { skip: process.platform !== 'win32' }, async () => {
  const { store, dir } = await freshStore()
  try {
    store.putProject(project('p1'))
    const before = readFileSync(join(dir, 'projects.json'), 'utf8')
    // An open handle blocks the rename on Windows, which is exactly the
    // "another process is reading while we write" case.
    const fd = openSync(join(dir, 'projects.json'), 'r')
    try {
      assert.throws(() => store.putProject(project('p2')), (error: any) => error instanceof StoreError)
    } finally {
      closeSync(fd)
    }
    assert.equal(readFileSync(join(dir, 'projects.json'), 'utf8'), before, 'the old ledger is still complete JSON')
    assert.deepEqual(readdirSync(dir).filter((name) => name.endsWith('.tmp')), [])
  } finally {
    await cleanup(store, dir)
  }
})
