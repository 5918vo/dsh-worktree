import type { ProjectView, TaskDiff, TaskSnapshot, TaskStatus, TaskView, WorktreeTask } from '../models'

export type DemoFilter = 'all' | 'review' | 'developing'
export type DemoTheme = 'dark' | 'light'

export interface DemoStatus {
  key: 'ready' | 'developing' | 'running' | 'review' | 'reviewing' | 'merged' | 'cleaned' | 'broken'
  dot: 'ready' | 'developing' | 'review' | 'merged' | 'broken'
  chip: '' | 'warn' | 'accent' | 'ok' | 'err'
}

const STATUS: Record<TaskStatus, DemoStatus> = {
  ready: { key: 'ready', dot: 'ready', chip: '' },
  developing: { key: 'developing', dot: 'developing', chip: 'accent' },
  review: { key: 'review', dot: 'review', chip: 'warn' },
  reviewing: { key: 'reviewing', dot: 'developing', chip: 'accent' },
  merged: { key: 'merged', dot: 'merged', chip: 'ok' },
  cleaned: { key: 'cleaned', dot: 'ready', chip: '' },
  broken: { key: 'broken', dot: 'broken', chip: 'err' },
}

/** Resolve the status the demo shows: an active review session reads as developing. */
export function demoStatus(status: TaskStatus, running: boolean): DemoStatus {
  if (status === 'review' && running) return { key: 'running', dot: 'developing', chip: 'accent' }
  if (status === 'developing' && running) return { key: 'running', dot: 'developing', chip: 'accent' }
  return STATUS[status] || STATUS.ready
}

export function demoStatusLabel(t: any, status: DemoStatus): string {
  switch (status.key) {
    case 'ready': return t.demoReady
    case 'developing': return t.developing
    case 'running': return t.demoAgentRunning
    case 'review': return t.review
    case 'reviewing': return t.reviewing
    case 'merged': return t.merged
    case 'cleaned': return t.cleaned
    case 'broken': return t.broken
    default: return t.demoReady
  }
}

export type DemoAction =
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

export interface DemoCta {
  secondary?: { action: DemoAction; label: string }
  primary: { action: DemoAction; label: string; disabled?: boolean }
}

/** Exact demo CTA copy and action for a task. */
export function demoCta(status: DemoStatus, hasSession: boolean): DemoCta {
  switch (status.key) {
    case 'review':
      return {
        secondary: { action: 'merge', label: 'demoDirectMerge' },
        primary: { action: 'checkout', label: 'demoCheckoutReview' },
      }
    case 'reviewing':
      return {
        secondary: { action: 'logs', label: 'demoViewLogs' },
        primary: { action: 'back', label: 'demoBack' },
      }
    case 'developing':
      return {
        secondary: { action: 'logs', label: 'demoViewLogs' },
        primary: hasSession
          ? { action: 'open', label: 'demoOpenSession' }
          : { action: 'create', label: 'demoCreateSession' },
      }
    case 'running':
      return {
        secondary: { action: 'logs', label: 'demoViewLogs' },
        primary: { action: 'open', label: 'demoOpenSession' },
      }
    case 'ready':
      return {
        secondary: { action: 'logs', label: 'demoViewLogs' },
        primary: { action: 'start', label: 'demoStartAgent' },
      }
    case 'merged':
      return {
        secondary: { action: 'continue', label: 'demoFollowUp' },
        primary: { action: 'cleanup', label: 'demoCleanup' },
      }
    case 'cleaned':
      return {
        secondary: { action: 'continue', label: 'demoFollowUp' },
        primary: { action: 'none', label: 'cleaned', disabled: true },
      }
    case 'broken':
      return {
        secondary: { action: 'logs', label: 'demoViewLogs' },
        primary: { action: 'retry', label: 'retry' },
      }
  }
}

export function demoBranch(branch: string): string {
  return String(branch || '').replace(/^dsh-wt\//, '')
}

export function demoStat(snapshot: TaskSnapshot | null | undefined): string {
  if (!snapshot) return ''
  const ahead = Number(snapshot.worktree && snapshot.worktree.ahead) || 0
  if (ahead > 0) return '↑' + ahead
  const dirty = Number(snapshot.worktree && snapshot.worktree.dirtyCount) || 0
  if (dirty > 0) return dirty + '•'
  return ''
}

export function taskMatches(task: TaskView, filter: DemoFilter, query: string, running: boolean): boolean {
  const status = demoStatus(task.snapshot ? task.snapshot.status : 'ready', running)
  if (filter === 'review' && status.key !== 'review') return false
  if (filter === 'developing' && status.key !== 'developing' && status.key !== 'running' && status.key !== 'reviewing') return false
  const q = String(query || '').trim().toLowerCase()
  if (!q) return true
  return String(task.task.title || '').toLowerCase().includes(q) || String(task.task.branch || '').toLowerCase().includes(q)
}

/** Filter tasks but keep project groups (with empty task lists removed). */
export function filterViews(views: ProjectView[], filter: DemoFilter, query: string, runningOf: (task: WorktreeTask) => boolean): ProjectView[] {
  return views
    .map((view) => ({
      ...view,
      tasks: view.tasks.filter((tv) => taskMatches(tv, filter, query, runningOf(tv.task))),
    }))
    .filter((view) => view.tasks.length > 0)
}

export function criteria(task: WorktreeTask, status: TaskStatus): Array<{ text: string; checked: boolean }> {
  const done = status === 'merged' || status === 'cleaned'
  return (task.acceptanceCriteria || []).map((text) => ({ text, checked: done }))
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
  key: 'idle' | 'checking' | 'error' | 'blocked' | 'conflict' | 'overlap' | 'baseAhead' | 'safe' | 'merged'
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

export function mergeSummaryText(t: any, summary: MergeSummary): string {
  switch (summary.key) {
    case 'checking': return t.demoPreviewChecking
    case 'error': return summary.message || t.failed
    case 'blocked': return t.demoPreviewBlocked
    case 'conflict': return String(t.demoPreviewConflict).replace('{n}', String(summary.n || 1))
    case 'overlap': return String(t.demoPreviewOverlap).replace('{n}', String(summary.n || 0))
    case 'baseAhead': return String(t.demoPreviewBaseAhead).replace('{n}', String(summary.n || 0))
    case 'safe': return t.demoPreviewSafe
    case 'merged': return t.demoPreviewMerged
    default: return t.demoPreviewIdle
  }
}

export function themeFor(stored: string | null | undefined, hostDark: boolean, prefersDark: boolean): DemoTheme {
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
