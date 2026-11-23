/**
 * Saved board views: a named snapshot of the four rail filters.
 *
 * Pure module (no React / DOM / storage). A view stores filter conditions only —
 * never tasks, selection or scroll position — so applying one always reflects
 * the current task set. The storage adapter lives in `./view-storage`.
 */

import { isBoardFilter, type BoardFilter } from './model'

export const SAVED_VIEW_LIMIT = 20
export const SAVED_VIEW_NAME_MAX = 40

/** Longest query text kept in a view; longer input is truncated, not rejected. */
const QUERY_MAX = 200
/** Longest tag kept in a view; a tag filter is one short label. */
const TAG_MAX = 24

export interface ViewState {
  query: string
  filter: BoardFilter
  tag: string
  showArchived: boolean
}

export interface SavedView extends ViewState {
  id: string
  name: string
  createdAt: number
}

/** Trim a view name; empty and over-long names are invalid (`null`). */
export function normalizeViewName(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const name = String(value).trim()
  if (!name) return null
  if (Array.from(name).length > SAVED_VIEW_NAME_MAX) return null
  return name
}

/** Structural check for the four filter values; lengths are clamped elsewhere. */
export function isViewState(value: unknown): value is ViewState {
  if (!value || typeof value !== 'object') return false
  const state = value as any
  return typeof state.query === 'string'
    && isBoardFilter(state.filter)
    && typeof state.tag === 'string'
    && typeof state.showArchived === 'boolean'
}

function clampText(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value
}

function clampState(state: ViewState): ViewState {
  return {
    query: clampText(state.query, QUERY_MAX),
    filter: state.filter,
    tag: clampText(state.tag, TAG_MAX),
    showArchived: state.showArchived,
  }
}

function nameKey(name: string): string {
  return String(name || '').trim().toLowerCase()
}

/**
 * Build a view from the current filters. `limit` is enforced by the caller,
 * which owns the list; this function only validates the name and state.
 */
export function createSavedView(
  state: ViewState,
  name: unknown,
  options: { now?: number; id?: string } = {},
): { ok: true; view: SavedView } | { ok: false; reason: 'name-empty' | 'name-too-long' | 'limit' | 'state-invalid' } {
  if (!isViewState(state)) return { ok: false, reason: 'state-invalid' }
  const trimmed = name === null || name === undefined ? '' : String(name).trim()
  if (!trimmed) return { ok: false, reason: 'name-empty' }
  if (Array.from(trimmed).length > SAVED_VIEW_NAME_MAX) return { ok: false, reason: 'name-too-long' }
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now()
  const givenId = options.id === null || options.id === undefined ? '' : String(options.id).trim()
  const id = givenId || `view-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return { ok: true, view: { id, name: trimmed, createdAt: now, ...clampState(state) } }
}

/**
 * Keep only well-formed entries: valid state, valid name, non-empty unique id.
 * Duplicate ids keep the first entry; a bad `createdAt` reads as 0. The oldest
 * 20 views win, so a corrupted file cannot push the list past the limit.
 */
export function sanitizeSavedViews(raw: unknown): SavedView[] {
  if (!Array.isArray(raw)) return []
  const out: SavedView[] = []
  const ids = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const entry = item as any
    const id = typeof entry.id === 'string' ? entry.id.trim() : ''
    if (!id || ids.has(id)) continue
    const name = normalizeViewName(entry.name)
    if (!name) continue
    const created = Number(entry.createdAt)
    if (!isViewState(entry)) continue
    ids.add(id)
    out.push({
      id,
      name,
      createdAt: Number.isFinite(created) ? created : 0,
      ...clampState({ query: entry.query, filter: entry.filter, tag: entry.tag, showArchived: entry.showArchived }),
    })
  }
  out.sort((a, b) => a.createdAt - b.createdAt)
  return out.slice(0, SAVED_VIEW_LIMIT)
}

/** Parse persisted JSON; any malformed input (or non-string) reads as no views. */
export function parseSavedViews(text: string | null): SavedView[] {
  if (typeof text !== 'string' || !text.trim()) return []
  try {
    return sanitizeSavedViews(JSON.parse(text))
  } catch {
    return []
  }
}

/** Serialize for storage; sanitizing first guarantees no bad entry is written. */
export function serializeSavedViews(views: SavedView[]): string {
  return JSON.stringify(sanitizeSavedViews(views))
}

/** Whether the current filters still equal a saved view (query compared trimmed). */
export function sameViewState(view: SavedView, state: ViewState): boolean {
  if (!view || !state) return false
  return String(view.query).trim() === String(state.query).trim()
    && view.filter === state.filter
    && view.tag === state.tag
    && view.showArchived === state.showArchived
}

/**
 * Add or replace a view. The same id replaces in place; otherwise a matching
 * name (case- and whitespace-insensitive) updates the existing entry while
 * keeping its id and creation time. New views append; the list stays at 20.
 */
export function upsertSavedView(views: SavedView[], view: SavedView): SavedView[] {
  const list = Array.isArray(views) ? views.slice() : []
  // Store the trimmed name: createSavedView already trims, and a hand-built
  // view should still match and read back like one created by the dialog.
  const incoming: SavedView = { ...view, name: String(view.name || '').trim() || view.name }
  const byId = list.findIndex((item) => item.id === incoming.id)
  let next: SavedView[]
  if (byId >= 0) {
    next = list.map((item, index) => (index === byId ? { ...incoming } : item))
  } else {
    const key = nameKey(incoming.name)
    const byName = list.findIndex((item) => nameKey(item.name) === key)
    next = byName >= 0
      ? list.map((item, index) => (index === byName ? { ...incoming, id: item.id, createdAt: item.createdAt } : item))
      : [...list, incoming]
  }
  return next.slice(0, SAVED_VIEW_LIMIT)
}

export function removeSavedView(views: SavedView[], id: string): SavedView[] {
  const list = Array.isArray(views) ? views : []
  return list.filter((item) => item.id !== id)
}
