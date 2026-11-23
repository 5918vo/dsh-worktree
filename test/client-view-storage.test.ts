import test from 'node:test'
import assert from 'node:assert/strict'
import { SAVED_VIEWS_KEY, loadSavedViews, saveSavedViews } from '../src/client/view-storage.js'
import { serializeSavedViews, type SavedView } from '../src/client/saved-views.js'

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

function view(over: Record<string, any> = {}): SavedView {
  return {
    id: 'v1',
    name: 'Overdue',
    createdAt: 1,
    query: 'login',
    filter: 'overdue',
    tag: 'api',
    showArchived: false,
    ...over,
  } as SavedView
}

test('SAVED_VIEWS_KEY stays stable for persisted data', () => {
  assert.equal(SAVED_VIEWS_KEY, 'dshw-board:saved-views:v1')
})

test('save then load round-trips views', () => {
  const storage = new MemoryStorage()
  const views = [view(), view({ id: 'v2', name: 'Review', filter: 'review', createdAt: 2 })]
  assert.deepEqual(saveSavedViews(views, storage as any), { ok: true })
  assert.equal(storage.getItem(SAVED_VIEWS_KEY), serializeSavedViews(views))
  assert.deepEqual(loadSavedViews(storage as any), views)
})

test('load reads missing, empty and corrupted content as no views', () => {
  const storage = new MemoryStorage()
  assert.deepEqual(loadSavedViews(storage as any), [])
  storage.setItem(SAVED_VIEWS_KEY, '')
  assert.deepEqual(loadSavedViews(storage as any), [])
  storage.setItem(SAVED_VIEWS_KEY, '{not json')
  assert.deepEqual(loadSavedViews(storage as any), [])
  storage.setItem(SAVED_VIEWS_KEY, '{"views":[]}')
  assert.deepEqual(loadSavedViews(storage as any), [])
  storage.setItem(SAVED_VIEWS_KEY, JSON.stringify([{ id: 'x' }]))
  assert.deepEqual(loadSavedViews(storage as any), [])
})

test('a throwing getItem degrades to an empty list', () => {
  const storage = new MemoryStorage()
  storage.getItem = () => { throw new Error('SecurityError') }
  assert.deepEqual(loadSavedViews(storage as any), [])
})

test('quota or disabled storage reports an error instead of throwing', () => {
  const storage = new MemoryStorage()
  storage.setItem = () => { throw new Error('QuotaExceededError') }
  const result = saveSavedViews([view()], storage as any)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error, 'QuotaExceededError')
})

test('a missing storage object is handled on both paths', () => {
  assert.deepEqual(loadSavedViews(null), [])
  assert.deepEqual(saveSavedViews([view()], null), { ok: false, error: 'storage-unavailable' })
})
