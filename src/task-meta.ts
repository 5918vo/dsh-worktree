/**
 * Task metadata helpers shared by the host, the client and the tests.
 *
 * Tags, priority and notes are optional presentation fields: an old record
 * reads as "no tags / normal priority / no notes", and clearing a value
 * deletes the field instead of storing an empty one.
 */

export const TAG_LIMIT = 8
export const TAG_MAX_LENGTH = 24
export const NOTES_MAX_LENGTH = 2000

export type TaskPriority = 'low' | 'normal' | 'high'

/**
 * Split one free-text tag field into normalized tags.
 *
 * Accepts English and Chinese commas, strips a leading `#`, collapses runs of
 * whitespace, drops blanks and dedupes case-insensitively while keeping the
 * first spelling the user typed.
 */
export function parseTagText(text: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of String(text == null ? '' : text).split(/[,，]/)) {
    const tag = raw.trim().replace(/^#+/, '').replace(/\s+/g, ' ').trim()
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(tag)
  }
  return out
}

/** Normalize an array (or one string) of tags; anything else reads as []. */
export function normalizeTags(values: unknown): string[] {
  const list = Array.isArray(values) ? values : typeof values === 'string' ? [values] : []
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of list) {
    for (const tag of parseTagText(String(value == null ? '' : value))) {
      const key = tag.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(tag)
    }
  }
  return out
}

/** Count and length limits apply to the normalized list; [] is valid. */
export function validateTags(tags: string[]): { ok: true } | { ok: false; error: 'too-many' | 'too-long' } {
  if (tags.length > TAG_LIMIT) return { ok: false, error: 'too-many' }
  if (tags.some((tag) => tag.length > TAG_MAX_LENGTH)) return { ok: false, error: 'too-long' }
  return { ok: true }
}

/** Canonical priority; ''/null/undefined mean normal, unknown values are invalid. */
export function normalizePriority(value: unknown): TaskPriority | undefined {
  if (value == null) return 'normal'
  const text = String(value).trim().toLowerCase()
  if (!text || text === 'normal') return 'normal'
  if (text === 'low' || text === 'high') return text
  return undefined
}

/** Sort weight: high beats normal beats low. */
export function priorityRank(task: { priority?: string }): number {
  const priority = task && task.priority
  return priority === 'high' ? 2 : priority === 'low' ? 0 : 1
}

/** A task is "due soon" from one day ahead up to this many days ahead. */
export const DUE_SOON_DAYS = 3

export type DueParse = { ok: true; value: number | null } | { ok: false }

/** Local calendar midnight of `value`; a non-finite input reads as 0. */
export function startOfLocalDay(value: number): number {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 0
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/**
 * Parse a due date into local calendar midnight.
 *
 * `null`/`undefined`/`''` clear the field; a positive finite number is
 * normalized to local midnight; `YYYY-MM-DD` is read as a local calendar date
 * and round-trip verified (so `2026-02-30` is rejected); anything else goes
 * through `Date.parse` and must be a real date. Invalid input is never coerced
 * to a value, so a bad edit cannot silently move a deadline.
 */
export function parseDueAt(value: unknown): DueParse {
  if (value === null || value === undefined || value === '') return { ok: true, value: null }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return { ok: false }
    const day = startOfLocalDay(value)
    return day ? { ok: true, value: day } : { ok: false }
  }
  const text = String(value).trim()
  if (!text) return { ok: true, value: null }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (match) {
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    const date = new Date(year, month - 1, day)
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return { ok: false }
    }
    return { ok: true, value: date.getTime() }
  }
  const parsed = Date.parse(text)
  if (!Number.isFinite(parsed)) return { ok: false }
  const day = startOfLocalDay(parsed)
  return day ? { ok: true, value: day } : { ok: false }
}

/**
 * Whole local calendar days from today to the due date.
 *
 * Negative means overdue, 0 means due today. Comparing UTC midnights of the
 * local Y/M/D keeps the count right across DST switches.
 */
export function dueDayOffset(dueAt: number | null | undefined, now: number = Date.now()): number | null {
  const due = Number(dueAt)
  if (!due || !Number.isFinite(due)) return null
  const dueDay = new Date(due)
  if (!Number.isFinite(dueDay.getTime())) return null
  const today = new Date(Number.isFinite(now) ? now : Date.now())
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const b = Date.UTC(dueDay.getFullYear(), dueDay.getMonth(), dueDay.getDate())
  return Math.round((b - a) / 86400000)
}

export type DueKind = 'overdue' | 'today' | 'soon' | 'later'

export interface DueState {
  kind: DueKind
  /** Overdue: days late. Soon: days remaining. Today/later: 0. */
  days: number
}

/** Bucket a due date for chips, filters and reports; null when unset. */
export function dueStateOf(dueAt: number | null | undefined, now: number = Date.now()): DueState | null {
  const offset = dueDayOffset(dueAt, now)
  if (offset === null) return null
  if (offset < 0) return { kind: 'overdue', days: -offset }
  if (offset === 0) return { kind: 'today', days: 0 }
  if (offset <= DUE_SOON_DAYS) return { kind: 'soon', days: offset }
  return { kind: 'later', days: 0 }
}

/** `YYYY-MM-DD` for a date input; '' when unset or invalid. */
export function dueInputValue(dueAt: number | null | undefined): string {
  const value = Number(dueAt)
  if (!value || !Number.isFinite(value)) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const pad = (n: number) => (n < 10 ? '0' + n : String(n))
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** One order for every surface: pinned, then priority, then newest first. */
export function compareTaskOrder(a: any, b: any): number {
  const pinned = (Number(b && b.pinnedAt) || 0) - (Number(a && a.pinnedAt) || 0)
  if (pinned) return pinned
  const rank = priorityRank(b || {}) - priorityRank(a || {})
  if (rank) return rank
  return (Number(b && b.createdAt) || 0) - (Number(a && a.createdAt) || 0)
}
