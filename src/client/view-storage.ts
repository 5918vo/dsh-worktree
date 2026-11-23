/**
 * localStorage adapter for saved board views.
 *
 * Storage can be missing, disabled (privacy mode) or full (quota). Every call
 * degrades to an empty list / an error result instead of throwing, so the board
 * keeps working and the caller can offer an in-memory fallback.
 */

import { parseSavedViews, serializeSavedViews, type SavedView } from './saved-views'

export const SAVED_VIEWS_KEY = 'dshw-board:saved-views:v1'

function defaultStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    // Accessing localStorage itself can throw when cookies/storage are blocked.
    return null
  }
}

export function loadSavedViews(storage?: Storage | null): SavedView[] {
  const store = storage === undefined ? defaultStorage() : storage
  if (!store) return []
  try {
    return parseSavedViews(store.getItem(SAVED_VIEWS_KEY))
  } catch {
    return []
  }
}

export function saveSavedViews(
  views: SavedView[],
  storage?: Storage | null,
): { ok: true } | { ok: false; error: string } {
  const store = storage === undefined ? defaultStorage() : storage
  if (!store) return { ok: false, error: 'storage-unavailable' }
  try {
    store.setItem(SAVED_VIEWS_KEY, serializeSavedViews(views))
    return { ok: true }
  } catch (error: any) {
    return { ok: false, error: String((error && error.message) || error || 'storage-failed') }
  }
}
