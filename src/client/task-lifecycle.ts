/**
 * Task lifecycle timeline: a pure, derived view over the timestamps already
 * stored on a task record.
 *
 * No DOM, no locale text, no network and no storage fields — the stage and the
 * acceptance report both render this same event list.
 */

export type LifecycleKind =
  | 'created'
  | 'pinned'
  | 'merged'
  | 'cleaned'
  | 'archived'
  | 'updated'

export interface LifecycleEvent {
  kind: LifecycleKind
  at: number
  /** Commit short SHA (7 chars) attached to a merge event; other kinds have none. */
  commit?: string
}

/** Fixed order used for equal timestamps, so the rail never flickers. */
const KIND_ORDER: LifecycleKind[] = ['created', 'pinned', 'merged', 'cleaned', 'archived', 'updated']

const TIMESTAMP_FIELD: Record<LifecycleKind, string> = {
  created: 'createdAt',
  pinned: 'pinnedAt',
  merged: 'mergedAt',
  cleaned: 'cleanedAt',
  archived: 'archivedAt',
  updated: 'updatedAt',
}

/**
 * `updatedAt` only earns a row when it is clearly later than every other
 * event; otherwise polling would add a "just now" row next to the merge.
 */
const UPDATED_GAP_MS = 1000

const DAY_MS = 86_400_000

/** Finite, positive timestamps only; anything else is treated as missing. */
function stamp(value: any): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function commitOf(task: any): string | undefined {
  const raw = String((task && task.mergedCommit) || '').trim().slice(0, 7)
  return raw || undefined
}

/** Events in ascending time order; invalid / missing timestamps are ignored. */
export function buildTaskLifecycle(task: any): LifecycleEvent[] {
  const source = task || {}
  const events: LifecycleEvent[] = []
  let latest = 0

  for (const kind of KIND_ORDER) {
    if (kind === 'updated') continue
    const at = stamp(source[TIMESTAMP_FIELD[kind]])
    if (at == null) continue
    events.push({ kind, at })
    if (at > latest) latest = at
  }

  const updatedAt = stamp(source.updatedAt)
  if (updatedAt != null && (events.length === 0 || updatedAt - latest >= UPDATED_GAP_MS)) {
    events.push({ kind: 'updated', at: updatedAt })
  }

  const merged = events.find((event) => event.kind === 'merged')
  if (merged) {
    const commit = commitOf(source)
    if (commit) merged.commit = commit
  }

  return events.sort((a, b) => a.at - b.at || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
}

/** Days from publish to merge (1 decimal); null without a valid merge time. */
export function lifecycleCycleDays(task: any): number | null {
  const created = stamp(task && task.createdAt)
  const merged = stamp(task && task.mergedAt)
  if (created == null || merged == null || merged < created) return null
  return Math.round(((merged - created) / DAY_MS) * 10) / 10
}

/** Locale key for one event kind. */
export function lifecycleLabelKey(kind: LifecycleKind): string {
  switch (kind) {
    case 'created': return 'lifecycleCreated'
    case 'pinned': return 'lifecyclePinned'
    case 'merged': return 'lifecycleMerged'
    case 'cleaned': return 'lifecycleCleaned'
    case 'archived': return 'lifecycleArchived'
    case 'updated': return 'lifecycleUpdated'
    default: return 'lifecycleUpdated'
  }
}
