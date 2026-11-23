import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Store, StoreError } from '../src/store.js'
import { Project } from '../src/models.js'
import { rmrf } from './helpers/git.js'

/**
 * The store lock is the only thing keeping two DSH windows from interleaving
 * ledger writes. These tests pin the two properties that used to be violated:
 * a waiter may never write without the lock, and releasing may never delete a
 * lock it no longer owns. The contention tests use real processes.
 */

function project(id: string): Project {
  return { id, name: 'p-' + id, repoPath: 'C:/repo', baseBranch: 'main', createdAt: 1 }
}

const lockPath = (dir: string) => join(dir, '.store.lock')

async function freshDir(): Promise<string> {
  return fs.mkdtemp(join(tmpdir(), 'dshw-lock-'))
}

function writeLock(dir: string, info: Record<string, unknown>): void {
  writeFileSync(lockPath(dir), JSON.stringify({ host: hostname(), at: Date.now(), ...info }), 'utf8')
}

/** A real, separate process that holds the lock for `holdMs` and then removes it. */
function holdLockInChild(dir: string, holdMs: number): Promise<{ child: any; exited: Promise<number> }> {
  const script = `
    const { writeFileSync, rmSync } = require('node:fs')
    const { hostname } = require('node:os')
    const [lock, hold] = process.argv.slice(1)
    writeFileSync(lock, JSON.stringify({ pid: process.pid, host: hostname(), token: 'child-token', at: Date.now() }), 'utf8')
    setTimeout(() => { rmSync(lock, { force: true }) }, Number(hold))
  `
  const child = spawn(process.execPath, ['-e', script, lockPath(dir), String(holdMs)], { stdio: 'ignore' })
  const exited = new Promise<number>((resolve) => child.on('exit', (code: number) => resolve(code ?? -1)))
  return Promise.resolve({ child, exited })
}

test('a held lock makes the writer fail with 503 instead of writing without it', async () => {
  const dir = await freshDir()
  try {
    const store = new Store(dir, { lockWaitMs: 150, heartbeat: false })
    await store.load()
    writeLock(dir, { pid: process.pid, token: 'held-by-someone' })
    const before = readFileSync(lockPath(dir), 'utf8')
    assert.throws(
      () => store.putProject(project('p1')),
      (error: any) => error instanceof StoreError && error.code === 'store-lock' && error.status === 503,
    )
    assert.equal(readFileSync(lockPath(dir), 'utf8'), before, 'a lock we do not own is never modified or deleted')
    assert.deepEqual(store.listProjects(), [], 'nothing was written')
    await assert.rejects(fs.access(join(dir, 'projects.json')), 'no ledger file was created behind the lock')
    store.dispose()
  } finally {
    await rmrf(dir)
  }
})

test('waiting for a lock parks the thread instead of burning CPU', async () => {
  const dir = await freshDir()
  const holder = await holdLockInChild(dir, 350)
  try {
    const store = new Store(dir, { lockWaitMs: 5_000, heartbeat: false })
    await store.load()
    // The child needs a few ms to start and create the lock; without this the
    // writer could legitimately win the race and the test would prove nothing.
    for (let i = 0; i < 200 && !existsSync(lockPath(dir)); i += 1) await new Promise((r) => setTimeout(r, 5))
    assert.ok(existsSync(lockPath(dir)), 'the child process owns the lock before we write')
    const cpuBefore = process.cpuUsage()
    const started = Date.now()
    store.putProject(project('p1'))
    const elapsed = Date.now() - started
    const used = process.cpuUsage(cpuBefore)
    const cpuMs = (used.user + used.system) / 1000
    assert.ok(elapsed >= 100, `writer should have waited for the child, waited ${elapsed}ms`)
    // The old implementation spun on Date.now() until the deadline, so it burned
    // roughly the whole wait in CPU. Atomics.wait parks the thread instead.
    assert.ok(cpuMs < elapsed / 2, `wait must not burn CPU (waited ${elapsed}ms, used ${cpuMs.toFixed(1)}ms)`)
    assert.deepEqual(readdirSync(dir).filter((name) => name.includes('.stale-') || name.includes('.rel-')), [])
    store.dispose()
  } finally {
    await holder.exited
    await rmrf(dir)
  }
})

test('a lock left by a crashed process is taken over', async () => {
  const dir = await freshDir()
  try {
    const store = new Store(dir, { lockWaitMs: 300, heartbeat: false })
    await store.load()
    // Dead pid + old timestamp: exactly what a crash leaves behind.
    writeLock(dir, { pid: 999_999, token: 'dead-owner', at: Date.now() - 120_000 })
    store.putProject(project('p1'))
    assert.deepEqual(store.listProjects().map((p) => p.id), ['p1'])
    assert.deepEqual(readdirSync(dir).filter((name) => name.includes('.stale-')), [], 'the stale lock is removed, not accumulated')
    await assert.rejects(fs.access(lockPath(dir)), 'the lock is released after the write')
    store.dispose()
  } finally {
    await rmrf(dir)
  }
})

test('two stores writing the same ledger never interleave or lose a record', async () => {
  const dir = await freshDir()
  try {
    const a = new Store(dir, { heartbeat: false })
    const b = new Store(dir, { heartbeat: false })
    await a.load()
    await b.load()
    for (let i = 0; i < 15; i += 1) {
      a.putProject(project('a' + i))
      b.putProject(project('b' + i))
    }
    const raw = readFileSync(join(dir, 'projects.json'), 'utf8')
    const parsed = JSON.parse(raw)
    assert.equal(Object.keys(parsed).length, 30, 'every write from both instances survived')
    assert.deepEqual(readdirSync(dir).filter((name) => name.endsWith('.tmp') || name.includes('.rel-')), [])
    a.dispose()
    b.dispose()
  } finally {
    await rmrf(dir)
  }
})

test('an unreadable lock left by a crash is only replaced once it is clearly abandoned', async () => {
  const dir = await freshDir()
  try {
    const store = new Store(dir, { lockWaitMs: 120, heartbeat: false })
    await store.load()
    // A crash between `openSync` and the owner record leaves an unparsable file.
    writeFileSync(lockPath(dir), '{ half', 'utf8')
    assert.throws(
      () => store.putProject(project('p1')),
      (error: any) => error instanceof StoreError && error.code === 'store-lock',
      'a just-created partial lock is indistinguishable from a live writer',
    )
    // Age it past the partial window: now it must be taken over, not block forever.
    const old = new Date(Date.now() - 60_000)
    await fs.utimes(lockPath(dir), old, old)
    store.putProject(project('p1'))
    assert.deepEqual(store.listProjects().map((p) => p.id), ['p1'])
    store.dispose()
  } finally {
    await rmrf(dir)
  }
})

test('a release never deletes a lock whose owner token changed underneath it', async () => {
  const dir = await freshDir()
  try {
    const store = new Store(dir, { lockWaitMs: 120, heartbeat: false })
    await store.load()
    // The lock is ours by pid but carries a foreign token: this is what a writer
    // whose lock was replaced would find when it reaches `releaseLock`.
    writeLock(dir, { pid: process.pid, token: "foreign-token" })
    assert.throws(() => store.putProject(project('p1')), /另一个 DSH 进程|锁/)
    assert.equal(JSON.parse(readFileSync(lockPath(dir), "utf8")).token, "foreign-token", "the foreign lock is kept intact")
    store.dispose()
  } finally {
    await rmrf(dir)
  }
})

test('a slow live lock owner is not stolen after the stale threshold', async () => {
  const dir = await freshDir()
  const holder = new Store(dir, { heartbeat: false, lockStaleMs: 100 })
  const waiter = new Store(dir, { lockWaitMs: 50, heartbeat: false, lockStaleMs: 100 })
  try {
    await holder.load()
    await waiter.load()
    holder.putProject(project('owner'))
    ;(holder as any).withLock(() => {
      // Simulate a stalled synchronous filesystem operation with an old owner
      // timestamp. Its live PID still makes moving the lock unsafe.
      const current = JSON.parse(readFileSync(lockPath(dir), 'utf8'))
      writeFileSync(lockPath(dir), JSON.stringify({ ...current, at: Date.now() - 5_000 }))
      assert.throws(
        () => waiter.putProject(project('competitor')),
        (error: any) => error instanceof StoreError && error.code === 'store-lock',
      )
      assert.equal(JSON.parse(readFileSync(lockPath(dir), 'utf8')).token, current.token)
      ;(holder as any).saveProjects()
    })
    assert.deepEqual(holder.listProjects().map((item) => item.id), ['owner'])
    assert.deepEqual(readdirSync(dir).filter((name) => name.includes('.stale-') || name.includes('.rel-')), [])
  } finally {
    holder.dispose()
    waiter.dispose()
    await rmrf(dir)
  }
})
