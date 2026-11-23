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

/** One order for every surface: pinned, then priority, then newest first. */
export function compareTaskOrder(a: any, b: any): number {
  const pinned = (Number(b && b.pinnedAt) || 0) - (Number(a && a.pinnedAt) || 0)
  if (pinned) return pinned
  const rank = priorityRank(b || {}) - priorityRank(a || {})
  if (rank) return rank
  return (Number(b && b.createdAt) || 0) - (Number(a && a.createdAt) || 0)
}
