import type { ProjectView, TaskDiff, TaskSnapshot, TaskStatus, TaskView, WorktreeTask } from '../models'
import type { AttentionCategory } from './task-attention'

/** The rail filter is an attention category, never a lifecycle status. */
export type BoardFilter = AttentionCategory | 'all'
export type BoardTheme = 'dark' | 'light'

export interface BoardStatus {
  key: 'ready' | 'developing' | 'running' | 'review' | 'reviewing' | 'merged' | 'cleaned' | 'broken'
  dot: 'ready' | 'developing' | 'review' | 'merged' | 'broken'
  chip: '' | 'warn' | 'accent' | 'ok' | 'err'
}

const STATUS: Record<TaskStatus, BoardStatus> = {
  ready: { key: 'ready', dot: 'ready', chip: '' },
  developing: { key: 'developing', dot: 'developing', chip: 'accent' },
  review: { key: 'review', dot: 'review', chip: 'warn' },
  reviewing: { key: 'reviewing', dot: 'developing', chip: 'accent' },
  merged: { key: 'merged', dot: 'merged', chip: 'ok' },
  cleaned: { key: 'cleaned', dot: 'ready', chip: '' },
  broken: { key: 'broken', dot: 'broken', chip: 'err' },
}

/** Resolve the status the board shows: an active review session reads as developing. */
export function boardStatus(status: TaskStatus, running: boolean): BoardStatus {
  if (status === 'review' && running) return { key: 'running', dot: 'developing', chip: 'accent' }
  if (status === 'developing' && running) return { key: 'running', dot: 'developing', chip: 'accent' }
  return STATUS[status] || STATUS.ready
}

export function boardStatusLabel(t: any, status: BoardStatus): string {
  switch (status.key) {
    case 'ready': return t.boardReady
    case 'developing': return t.developing
    case 'running': return t.boardAgentRunning
    case 'review': return t.review
    case 'reviewing': return t.reviewing
    case 'merged': return t.merged
    case 'cleaned': return t.cleaned
    case 'broken': return t.broken
    default: return t.boardReady
  }
}

export type BoardAction =
  | 'merge'
  | 'checkout'
  | 'back'
  | 'open'
  | 'create'
  | 'start'
  | 'continue'
  | 'cleanup'
  | 'logs'
  | 'retry'
  | 'none'

export interface BoardCta {
  secondary?: { action: BoardAction; label: string }
  primary: { action: BoardAction; label: string; disabled?: boolean }
}

/** Exact board CTA copy and action for a task. */
export function boardCta(status: BoardStatus, hasSession: boolean): BoardCta {
  switch (status.key) {
    case 'review':
      return {
        secondary: { action: 'merge', label: 'boardDirectMerge' },
        primary: { action: 'checkout', label: 'boardCheckoutReview' },
      }
    case 'reviewing':
      return {
        secondary: { action: 'logs', label: 'boardViewLogs' },
        primary: { action: 'back', label: 'boardBack' },
      }
    case 'developing':
      return {
        secondary: { action: 'logs', label: 'boardViewLogs' },
        primary: hasSession
          ? { action: 'open', label: 'boardOpenSession' }
          : { action: 'create', label: 'boardCreateSession' },
      }
    case 'running':
      return {
        secondary: { action: 'logs', label: 'boardViewLogs' },
        primary: { action: 'open', label: 'boardOpenSession' },
      }
    case 'ready':
      return {
        secondary: { action: 'logs', label: 'boardViewLogs' },
        // A task with no session yet must offer "create and start", not a start
        // of something that does not exist; a bound session only reopens.
        primary: hasSession
          ? { action: 'open', label: 'boardOpenSession' }
          : { action: 'create', label: 'boardCreateSession' },
      }
    case 'merged':
      return {
        secondary: { action: 'continue', label: 'boardFollowUp' },
        primary: { action: 'cleanup', label: 'boardCleanup' },
      }
    case 'cleaned':
      return {
        secondary: { action: 'continue', label: 'boardFollowUp' },
        primary: { action: 'none', label: 'cleaned', disabled: true },
      }
    case 'broken':
      return {
        secondary: { action: 'logs', label: 'boardViewLogs' },
        primary: { action: 'retry', label: 'retry' },
      }
  }
}

export function boardBranch(branch: string): string {
  return String(branch || '').replace(/^dsh-wt\//, '')
}

export function boardStat(snapshot: TaskSnapshot | null | undefined): string {
  if (!snapshot) return ''
  const ahead = Number(snapshot.worktree && snapshot.worktree.ahead) || 0
  if (ahead > 0) return '↑' + ahead
  const dirty = Number(snapshot.worktree && snapshot.worktree.dirtyCount) || 0
  if (dirty > 0) return dirty + '•'
  return ''
}

/**
 * Case-insensitive board search over any set of fields. An empty query matches
 * everything, so callers can combine it with a filter without special cases.
 */
export function matchesSearch(query: string, fields: Array<string | null | undefined>): boolean {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return true
  return fields.some((field) => String(field || '').toLowerCase().includes(q))
}

/**
 * Filter project groups by attention category and search text, dropping groups
 * that lost every task. With no filter and no query every project stays, so a
 * freshly added repository remains selectable before its first task exists.
 */
export function filterProjectViews(
  views: ProjectView[],
  filter: BoardFilter,
  query: string,
  get: (view: TaskView) => { categories: Set<AttentionCategory> },
  pendingText: (task: WorktreeTask) => string,
): ProjectView[] {
  const q = String(query || '').trim()
  const keepEmpty = filter === 'all' && !q
  return views
    .map((view) => {
      const projectHit = matchesSearch(q, [view.project.name, view.project.repoPath])
      const tasks = view.tasks.filter((tv) => {
        const attention = get(tv)
        if (filter !== 'all' && !(attention && attention.categories.has(filter))) return false
        if (!q || projectHit) return true
        return matchesSearch(q, [tv.task.title, tv.task.branch, pendingText(tv.task)])
      })
      return { ...view, tasks }
    })
    .filter((view) => view.tasks.length > 0 || keepEmpty)
}

/**
 * Which empty state the rail should show. A search or filter may report no
 * matches without widening to the generic "no tasks" copy: only an actually
 * empty filtered list earns an empty state, and the query wins over the filter
 * because it is the more specific thing the user just typed.
 */
export function railEmptyKind(
  projects: ProjectView[],
  filtered: ProjectView[],
  query: string,
  filter: BoardFilter,
): '' | 'no-projects' | 'search' | 'filter' {
  if (!projects.length) return 'no-projects'
  if (filtered.length) return ''
  if (String(query || '').trim()) return 'search'
  return filter === 'all' ? '' : 'filter'
}

export function criteria(task: WorktreeTask, status: TaskStatus): Array<{ text: string; checked: boolean }> {
  const done = status === 'merged' || status === 'cleaned'
  const marked = new Set(task.checkedCriteria || [])
  return (task.acceptanceCriteria || []).map((text) => ({ text, checked: done || marked.has(text) }))
}

/** Count how many criteria are verified; `missing` drives the merge reminder. */
export function criteriaProgress(items: Array<{ checked: boolean }>): { checked: number; total: number; missing: number } {
  const total = items.length
  const checked = items.filter((item) => item.checked).length
  return { checked, total, missing: total - checked }
}

export function diffHeadSha(task: WorktreeTask, snapshot: TaskSnapshot | null | undefined): string {
  if (task.reviewSha) return task.reviewSha
  if (task.mergedBranchTip) return task.mergedBranchTip
  const commits = (snapshot && snapshot.worktree && snapshot.worktree.commits) || []
  if (commits.length && commits[0] && commits[0].hash) return String(commits[0].hash)
  if (task.mergedCommit) return task.mergedCommit
  return ''
}

export function diffBaseSha(task: WorktreeTask, snapshot: TaskSnapshot | null | undefined, mergeBase?: string | null): string {
  if (snapshot && snapshot.repo && snapshot.repo.currentBranch === task.baseBranch && snapshot.repo.headSha) return snapshot.repo.headSha
  return String(mergeBase || '')
}

export function shortSha(value: string | null | undefined): string {
  const s = String(value || '')
  return s ? s.slice(0, 7) : '—'
}

export type DiffLineKind = 'hunk' | 'add' | 'del' | 'muted' | 'context'

export function diffLineKind(line: string): DiffLineKind {
  if (line.startsWith('@@')) return 'hunk'
  if (line.startsWith('\\')) return 'muted'
  if (line.startsWith('+') && !line.startsWith('+++')) return 'add'
  if (line.startsWith('-') && !line.startsWith('---')) return 'del'
  return 'context'
}

export interface MergeSummary {
  tone: 'idle' | 'ok' | 'warn' | 'err'
  key: 'idle' | 'checking' | 'error' | 'blocked' | 'conflict' | 'overlap' | 'baseAhead' | 'safe' | 'merged' | 'cleaned' | 'cleanedMerged'
  n?: number
  message?: string
}

export function mergeSummary(preview: any, phase: string, errorMessage?: string): MergeSummary {
  if (errorMessage) return { key: 'error', tone: 'err', message: errorMessage }
  if (!preview) {
    if (phase === 'checking') return { key: 'checking', tone: 'idle' }
    return { key: 'idle', tone: 'idle' }
  }
  if (preview.applicable === false) return { key: 'blocked', tone: 'warn' }
  const conflicts = Array.isArray(preview.conflictFiles) ? preview.conflictFiles.length : 0
  if (preview.conflict || conflicts) return { key: 'conflict', tone: 'err', n: Math.max(1, conflicts) }
  const overlap = Array.isArray(preview.overlapFiles) ? preview.overlapFiles.length : 0
  if (overlap) return { key: 'overlap', tone: 'warn', n: overlap }
  if (Number(preview.baseAhead) > 0) return { key: 'baseAhead', tone: 'ok', n: Number(preview.baseAhead) }
  return { key: 'safe', tone: 'ok' }
}

/**
 * Merge-state summary for the inspector. `snap.merged` cannot see a branch that
 * cleanup already deleted, so the stored `mergedAt` backs it up: a cleaned
 * worktree whose branch was never merged must not claim it is mergeable.
 */
export function taskMergeSummary(snap: any, task: any, preview: any, phase: string, errorMessage?: string): MergeSummary {
  const status = (snap && snap.status) || ''
  const cleaned = status === 'cleaned'
  const merged = !!(snap && snap.merged === true) || status === 'merged' || (cleaned && !!(task && task.mergedAt))
  if (!preview && phase !== 'checking' && phase !== 'error') {
    if (cleaned) return merged ? { key: 'cleanedMerged', tone: 'ok' } : { key: 'cleaned', tone: 'warn' }
    if (merged) return { key: 'merged', tone: 'ok' }
  }
  return mergeSummary(preview, phase, errorMessage)
}

export function mergeSummaryText(t: any, summary: MergeSummary): string {
  switch (summary.key) {
    case 'checking': return t.boardPreviewChecking
    case 'error': return summary.message || t.failed
    case 'blocked': return t.boardPreviewBlocked
    case 'conflict': return String(t.boardPreviewConflict).replace('{n}', String(summary.n || 1))
    case 'overlap': return String(t.boardPreviewOverlap).replace('{n}', String(summary.n || 0))
    case 'baseAhead': return String(t.boardPreviewBaseAhead).replace('{n}', String(summary.n || 0))
    case 'safe': return t.boardPreviewSafe
    case 'merged': return t.boardPreviewMerged
    case 'cleaned': return t.boardPreviewCleaned
    case 'cleanedMerged': return t.boardPreviewCleanedMerged
    default: return t.boardPreviewIdle
  }
}

export function themeFor(stored: string | null | undefined, hostDark: boolean, prefersDark: boolean): BoardTheme {
  if (stored === 'dark' || stored === 'light') return stored
  return hostDark || prefersDark ? 'dark' : 'light'
}

export function pathPreview(project: any): string {
  if (!project) return 'worktree → .dsh-worktrees/…'
  return `${project.name} → ${project.dirName || '.dsh-worktrees'}/<auto-id>`
}

export function diffCount(diff: TaskDiff | null): number {
  return diff && Array.isArray(diff.files) ? diff.files.length : 0
}
