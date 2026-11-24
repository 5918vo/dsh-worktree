import test from 'node:test'
import assert from 'node:assert/strict'
import { LAST_VISIT_KEY, loadLastVisit, saveLastVisit } from '../src/client/visit-storage.js'

/** Minimal in-memory Storage: the real one is not available under node:test. */
class MemoryStorage {
  private map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value))
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
  clear(): void {
    this.map.clear()
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null
  }
  get length(): number {
    return this.map.size
  }
}

test('LAST_VISIT_KEY stays stable for persisted data', () => {
  assert.equal(LAST_VISIT_KEY, 'dshw-board:last-visit:v1')
})

test('save then load round-trips the timestamp', () => {
  const storage = new MemoryStorage()
  assert.equal(saveLastVisit(1_700_000_000_000, storage as any), true)
  assert.equal(storage.getItem(LAST_VISIT_KEY), JSON.stringify({ at: 1_700_000_000_000 }))
  assert.equal(loadLastVisit(storage as any), 1_700_000_000_000)
})

test('missing or empty storage reads as no baseline', () => {
  const storage = new MemoryStorage()
  assert.equal(loadLastVisit(storage as any), null)
  storage.setItem(LAST_VISIT_KEY, '')
  assert.equal(loadLastVisit(storage as any), null)
  // No storage at all (disabled/blocked) is also a missing baseline.
  assert.equal(loadLastVisit(null), null)
})

test('corrupted or non-object content reads as no baseline', () => {
  const storage = new MemoryStorage()
  for (const raw of ['{not json', 'null', 'true', '42', '"1700000000000"', '[]', '{}', '{"at":null}']) {
    storage.setItem(LAST_VISIT_KEY, raw)
    assert.equal(loadLastVisit(storage as any), null, raw)
  }
})

test('illegal timestamps read as no baseline and are never written back', () => {
  const storage = new MemoryStorage()
  for (const at of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, '1700000000000', null]) {
    storage.setItem(LAST_VISIT_KEY, JSON.stringify({ at }))
    assert.equal(loadLastVisit(storage as any), null, String(at))
  }
  // The bad value stays exactly as it was; load does not repair stored content.
  const raw = JSON.stringify({ at: 'x' })
  storage.setItem(LAST_VISIT_KEY, raw)
  assert.equal(loadLastVisit(storage as any), null)
  assert.equal(storage.getItem(LAST_VISIT_KEY), raw)
})

test('a throwing getItem degrades to null instead of throwing', () => {
  const storage = new MemoryStorage()
  storage.getItem = () => { throw new Error('SecurityError') }
  assert.equal(loadLastVisit(storage as any), null)
})

test('quota or disabled storage reports false instead of throwing', () => {
  const storage = new MemoryStorage()
  storage.setItem = () => { throw new Error('QuotaExceededError') }
  assert.equal(saveLastVisit(1_700_000_000_000, storage as any), false)
  assert.equal(saveLastVisit(1_700_000_000_000, null), false)
})

test('save rejects illegal timestamps without writing', () => {
  const storage = new MemoryStorage()
  for (const at of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(saveLastVisit(at, storage as any), false, String(at))
  }
  assert.equal(storage.getItem(LAST_VISIT_KEY), null)
})
