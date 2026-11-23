import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs, readdirSync, writeFileSync, readFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Store } from '../src/store.js'
import { Runtime } from '../src/runtime.js'
import { TaskError } from '../src/runtime.js'
import { assertAgentIdle } from '../src/runtime/types.js'
import { probeSessionState } from '../src/index.js'
import { Project, WorktreeTask } from '../src/models.js'
import { rmrf } from './helpers/git.js'

/**
 * Two DSH windows share one ledger. A window that cannot see an agent must not
 * conclude "not running": the other window may be driving it. These tests cover
 * the cross-instance probe, the crash/restart recovery paths, and the manual
 * escape hatch that keeps a dead window from blocking a session forever.
 */

function hostWith(services: Record<string, any>): any {
  return {
    get(name: string) {
      return services[name]
    },
  }
}

function registry(map: Record<string, any> = {}): any {
  return { get: (id: string) => map[id] }
}

function project(): Project {
  return { id: 'p1', name: '项目', repoPath: 'C:/repo', baseBranch: 'main', createdAt: 1 }
}

function task(id = 't1'): WorktreeTask {
  return {
    id,
    projectId: 'p1',
    title: '任务',
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

async function twoInstances(): Promise<{ dir: string; a: Store; b: Store }> {
  const dir = await fs.mkdtemp(join(tmpdir(), 'dshw-instances-'))
  const a = new Store(dir, { heartbeat: false })
  const b = new Store(dir, { heartbeat: false })
  await a.load()
  await b.load()
  a.putProject(project())
  a.putTask(task())
  return { dir, a, b }
}

async function close(dir: string, ...stores: Store[]): Promise<void> {
  for (const store of stores) store.dispose()
  await new Promise((resolve) => setTimeout(resolve, 50))
  await rmrf(dir)
}

/** Rewrite a peer's heartbeat file, as a crashed/old instance would leave it. */
function rewritePeer(dir: string, store: Store, patch: Record<string, unknown>): void {
  const id = store.instance().instanceId
  const file = join(dir, 'instances', `${id}.json`)
  const current = JSON.parse(readFileSync(file, 'utf8'))
  writeFileSync(file, JSON.stringify({ ...current, ...patch }), 'utf8')
}

test('a session running in another window is never reported as idle', async () => {
  const { dir, a, b } = await twoInstances()
  try {
    a.setRunningSessionsProvider(() => ['s1'])
    a.publishRunning('s1')
    assert.equal(b.lookupSessionRun('s1'), 'running')

    // The registry in this window cannot see the peer's agent at all...
    const blind = hostWith({ agents: registry({}) })
    assert.equal(probeSessionState(blind, 's1', { store: b }), 'running', 'a registry miss is not proof of idleness')
    // ...and even without a registry the answer must not be "safe to merge".
    assert.equal(probeSessionState(hostWith({}), 's1', { store: b }), 'unknown')
    const ctx: any = { sessionState: (id: string, t?: WorktreeTask) => probeSessionState(hostWith({}), id, { store: b }) }
    assert.throws(
      () => assertAgentIdle(ctx, { sessionId: 's1' } as any),
      (error: any) => error instanceof TaskError && error.status === 409 && error.code === 'agent-unknown',
    )
  } finally {
    await close(dir, a, b)
  }
})

test('a peer that reports no run state at all keeps the answer unknown', async () => {
  const { dir, a, b } = await twoInstances()
  try {
    a.publishRunning('s1')
    // Older build: heartbeat without a `running` list. Freshness alone cannot
    // prove the session is idle, so refuse rather than merge.
    rewritePeer(dir, a, { running: undefined, at: Date.now() })
    assert.equal(b.lookupSessionRun('s1'), 'unknown')
  } finally {
    await close(dir, a, b)
  }
})

test('a peer with a fresh heartbeat and an empty run list proves idleness', async () => {
  const { dir, a, b } = await twoInstances()
  try {
    a.setRunningSessionsProvider(() => [])
    a.publishRunning('s1')
    assert.equal(b.lookupSessionRun('s1'), 'running', 'the hint still marks it running')
    rewritePeer(dir, a, { running: ['other'], at: Date.now() })
    assert.equal(b.lookupSessionRun('s1'), 'idle')
  } finally {
    await close(dir, a, b)
  }
})

test('a crashed window stops blocking as soon as its heartbeat goes stale', async () => {
  const { dir, a, b } = await twoInstances()
  try {
    a.setRunningSessionsProvider(() => ['s1'])
    a.publishRunning('s1')
    assert.equal(b.lookupSessionRun('s1'), 'running')

    // Crash: the process is gone, so nothing refreshes the beat and the pid dies.
    rewritePeer(dir, a, { pid: 999_999, at: Date.now() - 120_000 })
    assert.equal(b.lookupSessionRun('s1'), 'idle', 'a dead instance must not lock the session forever')
    const blind = hostWith({ agents: registry({}) })
    assert.equal(probeSessionState(blind, 's1', { store: b }), 'idle')
    assert.deepEqual(
      readdirSync(join(dir, 'instances')).filter((name) => name.startsWith(a.instance().instanceId)),
      [],
      'the stale heartbeat file is pruned',
    )
  } finally {
    await close(dir, a, b)
  }
})

test('a finished session is published as idle immediately, without waiting for a TTL', async () => {
  const { dir, a, b } = await twoInstances()
  try {
    a.setRunningSessionsProvider(() => ['s1'])
    a.publishRunning('s1')
    assert.equal(b.lookupSessionRun('s1'), 'running')

    a.bindSession('t1', 's1')
    a.setRunningSessionsProvider(() => [])
    a.unbindSession('s1')
    assert.equal(b.lookupSessionRun('s1'), 'idle', 'conversation deleted ⇒ peers unblock right away')
    assert.equal(a.getTask('t1')!.sessionId, null)
  } finally {
    await close(dir, a, b)
  }
})

test('a bind shows its owning instance and clears the claim', async () => {
  const { dir, a, b } = await twoInstances()
  try {
    const claimed = a.claimTask('t1', 'window-a')
    assert.equal(claimed.ok, true)
    const bound = a.bindSession('t1', 's1', { lease: (claimed as any).lease.token })
    assert.equal(bound.ok, true)
    const saved = b.getTask('t1')!
    assert.equal(saved.sessionId, 's1')
    assert.equal(saved.sessionOwner?.instanceId, a.instance().instanceId, 'the owner is recorded, not guessed')
    assert.equal(saved.bindLease, undefined)
  } finally {
    await close(dir, a, b)
  }
})

test('an expired claim from a crashed window can be taken over', async () => {
  const { dir, a, b } = await twoInstances()
  try {
    const claimed = a.claimTask('t1', 'window-a', 1)
    assert.equal(claimed.ok, true)
    await new Promise((resolve) => setTimeout(resolve, 15))
    const second = b.claimTask('t1', 'window-b')
    assert.equal(second.ok, true, 'a crashed window must not hold the task hostage')
    assert.notEqual((second as any).lease.token, (claimed as any).lease.token)
  } finally {
    await close(dir, a, b)
  }
})

test('a live claim blocks the second window before it creates a session', async () => {
  const { dir, a, b } = await twoInstances()
  try {
    assert.equal(a.claimTask('t1', 'window-a', 60_000).ok, true)
    const second = b.claimTask('t1', 'window-b', 60_000)
    assert.deepEqual(second.ok, false)
    assert.equal((second as any).conflict, 'lease-held')
    // A retry from the same window is idempotent, not a conflict with itself.
    assert.equal(a.claimTask('t1', 'window-a', 60_000).ok, true)
  } finally {
    await close(dir, a, b)
  }
})

test('merge is refused while a peer may be running the session, and works after reset', async () => {
  const { dir, a, b } = await twoInstances()
  try {
    b.bindSession('t1', 's1')
    let state = 'unknown'
    const runtime = new Runtime({ store: b, config: { dirName: '.dsh-worktrees', branchPrefix: 'dsh-wt/', gitPath: 'git' }, sessionState: () => state as any })
    await assert.rejects(
      () => runtime.merge('t1'),
      (error: any) => error instanceof TaskError && error.status === 409 && error.code === 'agent-unknown',
    )
    // Manual escape hatch: the user confirmed the session is gone.
    assert.equal(runtime.resetSession('t1').sessionId, null)
    assert.throws(() => runtime.resetSession('missing'), (error: any) => error instanceof TaskError && error.status === 404)
    state = 'idle'
  } finally {
    await close(dir, a, b)
  }
})

test('instance heartbeats are keyed by process and never inherit a peer pid', async () => {
  const { dir, a, b } = await twoInstances()
  try {
    a.publishRunning('s1')
    b.beat(true)
    const files = readdirSync(join(dir, 'instances'))
    assert.equal(files.length, 2, 'each store publishes its own file')
    for (const name of files) {
      const info = JSON.parse(readFileSync(join(dir, 'instances', name), 'utf8'))
      assert.equal(info.pid, process.pid)
      assert.equal(info.host, hostname())
    }
    assert.notEqual(a.instance().instanceId, b.instance().instanceId)
    assert.equal(b.isInstanceLive(a.instance().instanceId), true)
  } finally {
    await close(dir, a, b)
  }
})
