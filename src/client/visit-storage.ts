/**
 * localStorage adapter for the "since your last visit" timestamp.
 *
 * Storage can be missing, disabled (privacy mode) or full (quota). Every call
 * degrades instead of throwing: `loadLastVisit` returns null and
 * `saveLastVisit` returns false, so a broken storage never blocks the board.
 */

export const LAST_VISIT_KEY = 'dshw-board:last-visit:v1'

function defaultStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    // Accessing localStorage itself can throw when cookies/storage are blocked.
    return null
  }
}

function validAt(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

/** Previous visit timestamp; null when missing, invalid or storage is unavailable. */
export function loadLastVisit(storage?: Storage | null): number | null {
  const store = storage === undefined ? defaultStorage() : storage
  if (!store) return null
  try {
    const raw = store.getItem(LAST_VISIT_KEY)
    if (raw == null || raw === '') return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    // Bad content is reported as "no baseline" and never written back.
    return validAt((parsed as { at?: unknown }).at)
  } catch {
    return null
  }
}

/** Persist the current visit; returns false when storage is unavailable or full. */
export function saveLastVisit(at: number, storage?: Storage | null): boolean {
  const store = storage === undefined ? defaultStorage() : storage
  if (!store) return false
  const stamp = validAt(at)
  if (stamp == null) return false
  try {
    store.setItem(LAST_VISIT_KEY, JSON.stringify({ at: stamp }))
    return true
  } catch {
    return false
  }
}
