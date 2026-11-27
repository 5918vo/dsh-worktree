/**
 * Handoff brief: a forward-looking Markdown document for the next agent or
 * teammate who picks this task up.
 *
 * Scope split, on purpose:
 * - `report.ts` is the acceptance archive: what the task did, whether the
 *   criteria passed, which files changed.
 * - `handoff.ts` is the action handoff: the goal, where the work stands, the
 *   state of the code, what to do next and which traps to avoid.
 *
 * Every number comes from the same helpers the board and the report already
 * use (`criteria` / `criteriaProgress` / `branchHeadSha` / `dueInputValue` /
 * `dueStateOf` / `parseEstimate` / `workTimingText` / `dependencyStatus`), so
 * the brief, the interface and the acceptance report can never disagree.
 *
 * Pure module: no DOM, no network, no clock unless `now` is omitted.
 */

import type { TaskDiff, TaskSnapshot, WorktreeTask } from '../models'
import { fill, mdBlock, mdCodeCell, mdInline, reportTimestamp } from './markdown'
import { branchHeadSha, criteria, criteriaProgress, shortSha } from './model'
import { diffReasonText } from './report'
import { dependencyStatus, type DependencyStatus } from '../task-deps'
import { dueInputValue, dueStateOf, parseEstimate } from '../task-meta'
import { workTimingText } from './work-format'

export interface HandoffInput {
  task: WorktreeTask
  snapshot: TaskSnapshot
  /** Already loaded diff; `null` when it was never loaded or failed to load. */
  diff: TaskDiff | null
  /** Every task, used to resolve prerequisites; omitted means "state unknown". */
  tasks?: WorktreeTask[]
  projectName: string
  statusLabel: string
  t: Record<string, any>
  now?: number
}

/** Most recent commits to include; the snapshot lists newest first. */
const COMMIT_LIMIT = 5
/** Changed files to include; paths and line counts only, never diff bodies. */
const FILE_LIMIT = 10
/** Action suggestions cap. */
const SUGGESTION_LIMIT = 4

function metaLine(label: any, value: string): string {
  return `- ${label}: ${value}`
}

/** Comma-joined one-line labels; empty entries disappear. */
function listText(values: string[]): string {
  return values.map((value) => mdInline(value)).filter((value) => !!value).join(', ')
}

/** Dependency ids that will actually be resolved (trimmed, non-empty). */
function dependencyIds(task: WorktreeTask): string[] {
  const raw: string[] = Array.isArray(task && task.dependsOn) ? (task.dependsOn as string[]) : []
  return raw.filter((id): id is string => typeof id === 'string' && id.trim() !== '').map((id) => id.trim())
}

/**
 * Resolve prerequisites against the record set. Returns `null` both for "no
 * dependencies" and "cannot tell"; callers keep `dependencyIds` to distinguish
 * the two instead of guessing.
 */
function dependencyOf(task: WorktreeTask, tasks?: WorktreeTask[]): DependencyStatus | null {
  if (!dependencyIds(task).length || !Array.isArray(tasks)) return null
  const lookup = new Map<string, WorktreeTask>()
  for (const row of tasks) {
    if (row && row.id) lookup.set(String(row.id), row)
  }
  return dependencyStatus(task, lookup)
}

/** One readable sentence for the dependency row. */
function dependencyText(t: Record<string, any>, task: WorktreeTask, dep: DependencyStatus | null): string {
  const ids = dependencyIds(task)
  if (!ids.length) return String(t.handoffDepsNone)
  if (!dep) return String(t.handoffDepsUnknown)
  const parts: string[] = []
  if (dep.open.length) {
    parts.push(fill(t.handoffDepsOpen, {
      n: dep.open.length,
      titles: listText(dep.open.map((item) => item.title || item.id)),
    }))
  }
  if (dep.missing.length) {
    parts.push(fill(t.handoffDepsMissing, { n: dep.missing.length, ids: listText(dep.missing) }))
  }
  return parts.length ? parts.join(' · ') : String(t.handoffDepsAllDone)
}

/** Due date line, worded exactly like the acceptance report. */
function dueText(t: Record<string, any>, task: WorktreeTask, now: number): string {
  const value = dueInputValue(task.dueAt)
  if (!value) return String(t.reportDueNone)
  const state = dueStateOf(task.dueAt, now)
  if (state && state.kind === 'overdue') {
    return value + '（' + fill(t.reportDueOverdue, { n: String(state.days) }) + '）'
  }
  return value
}

/**
 * Derive the action suggestions, in the order fixed by the feature spec:
 * prerequisites, workspace health, status, criteria, post-merge work, wrap-up.
 * Duplicates are dropped and at most `SUGGESTION_LIMIT` survive.
 */
function suggestionsFor(
  t: Record<string, any>,
  task: WorktreeTask,
  status: TaskSnapshot['status'],
  dep: DependencyStatus | null,
  missingCriteria: number,
  postMergeAhead: number,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (value: any) => {
    const text = String(value == null ? '' : value).trim()
    if (!text || seen.has(text)) return
    seen.add(text)
    out.push(text)
  }

  const depIds = dependencyIds(task)
  if (depIds.length && dep && (dep.open.length || dep.missing.length)) {
    const names = [
      ...dep.open.map((item) => item.title || item.id),
      ...dep.missing,
    ]
    push(fill(t.handoffNextDeps, { titles: listText(names) }))
  }

  switch (status) {
    case 'broken':
      push(t.handoffNextBroken)
      break
    case 'ready':
      if (!task.sessionId) push(t.handoffNextReady)
      break
    case 'developing':
      push(t.handoffNextDeveloping)
      break
    case 'reviewing':
      push(t.handoffNextDeveloping)
      push(t.handoffNextReviewing)
      break
    case 'review':
      push(t.handoffNextReview)
      break
    default:
      break
  }

  if (missingCriteria > 0) push(fill(t.handoffNextCriteria, { n: missingCriteria }))
  if (status === 'merged' && postMergeAhead > 0) {
    push(fill(t.handoffNextPostMerge, { n: postMergeAhead }))
  }
  if (status === 'merged' || status === 'cleaned') push(t.handoffNextMerged)
  if (!out.length) push(t.handoffNextEmpty)
  return out.slice(0, SUGGESTION_LIMIT)
}

/**
 * Build the handoff brief body. Sections keep a fixed order and never
 * disappear: when a source is unavailable the section says so, so the document
 * stays readable for every task state (including merged / cleaned / broken).
 */
export function buildHandoffBrief(input: HandoffInput): string {
  const { task, snapshot, diff, projectName, statusLabel, t } = input
  // An unusable `now` falls back to the clock instead of rendering "NaN".
  const rawNow = input.now == null ? Date.now() : Number(input.now)
  const now = Number.isFinite(rawNow) ? rawNow : Date.now()
  const worktree = (snapshot && snapshot.worktree) || ({} as TaskSnapshot['worktree'])
  const status = (snapshot && snapshot.status) as TaskSnapshot['status']
  const postMergeAhead = Math.max(0, Number(snapshot && snapshot.postMergeAhead) || 0)
  const reviewBehind = Math.max(0, Number(snapshot && snapshot.reviewBehind) || 0)
  const stashes = Array.isArray(task.pendingStashes) ? task.pendingStashes.length : 0
  const dirty = Math.max(0, Number(worktree.dirtyCount) || 0)
  const dep = dependencyOf(task, input.tasks)
  const lines: string[] = []

  lines.push(`# ${fill(t.handoffDocTitle, { title: mdInline(task.title) })}`, '')

  lines.push(metaLine(t.reportProject, projectName ? mdInline(projectName) : '—'))
  lines.push(metaLine(t.reportTaskBranch, mdCodeCell(task.branch || '—')))
  lines.push(metaLine(t.reportBaseBranch, mdCodeCell(task.baseBranch || '—')))
  lines.push(metaLine(t.handoffWorktree, mdCodeCell(task.worktreePath || '—')))
  lines.push(metaLine(t.reportStatus, mdInline(statusLabel || '—')))
  const head = branchHeadSha(task, snapshot)
  lines.push(metaLine(t.reportHead, mdCodeCell(head || '—')))
  lines.push(metaLine(t.reportSession, task.sessionId ? mdCodeCell(task.sessionId) : String(t.handoffNoSession)))
  lines.push(metaLine(t.reportGeneratedAt, reportTimestamp(now)))
  lines.push('')

  lines.push(`## ${t.handoffGoal}`)
  lines.push(mdBlock(task.description) || '—')
  lines.push('')

  // Progress: criteria and the dependency state share their wording with the
  // overview, the report and the rail.
  const items = criteria(task, status)
  const progress = criteriaProgress(items)
  lines.push(`## ${t.handoffProgress}`)
  if (items.length) {
    lines.push(`- ${fill(t.handoffCriteria, { n: progress.checked, total: progress.total })}`)
    const unchecked = items.filter((item) => !item.checked).map((item) => item.text)
    if (unchecked.length) lines.push(`- ${fill(t.handoffCriteriaOpen, { items: listText(unchecked) })}`)
  } else {
    lines.push(`- ${t.boardNoCriteria}`)
  }
  lines.push(metaLine(t.taskDeps, dependencyText(t, task, dep)))
  const estimate = parseEstimate(task.estimate)
  lines.push(metaLine(t.taskEstimate, mdInline(
    estimate.ok && estimate.value != null ? fill(t.taskEstimatePoints, { n: estimate.value }) : t.taskEstimateEmpty,
  )))
  lines.push(metaLine(t.taskWork, workTimingText(t, task, now)))
  lines.push(metaLine(t.reportDue, dueText(t, task, now)))
  lines.push('')

  // Code state: short history plus diff totals. Diff bodies, session messages
  // and token usage never leave the workbench, so the clipboard stays small.
  const commits: Array<{ hash?: string; subject?: string }> = (worktree.commits || []) as any
  lines.push(`## ${t.handoffCode}`)
  if (commits.length) {
    lines.push(`- ${t.handoffCommits}:`)
    for (const commit of commits.slice(0, COMMIT_LIMIT)) {
      const hash = shortSha(String((commit && commit.hash) || ''))
      const subject = mdInline((commit && commit.subject) || '')
      lines.push(`  - ${mdCodeCell(hash)}${subject ? ' ' + subject : ''}`)
    }
  } else {
    lines.push(`- ${t.handoffCommits}: ${t.reportNoCommits}`)
  }

  const reason = diff && diff.reason ? diff.reason : ''
  const files = diff && Array.isArray(diff.files) ? diff.files : []
  if (!diff) {
    lines.push(`- ${t.handoffDiff}: ${t.reportNoDiff}`)
  } else if (reason) {
    lines.push(`- ${t.handoffDiff}: ${diffReasonText(t, diff)}`)
  } else if (!files.length) {
    lines.push(`- ${t.handoffDiff}: ${t.reportNoFiles}`)
  } else {
    lines.push(`- ${t.handoffDiff}: ${fill(t.reportTotals, {
      files: files.length,
      add: Number(diff.totalAdditions) || 0,
      del: Number(diff.totalDeletions) || 0,
    })}`)
    for (const file of files.slice(0, FILE_LIMIT)) {
      lines.push(`  - ${mdCodeCell((file && file.path) || '')} +${Number(file && file.additions) || 0} / -${Number(file && file.deletions) || 0}`)
    }
  }
  lines.push(metaLine(t.reportUncommitted, String(dirty)))
  lines.push(metaLine(t.reportStashes, String(stashes)))
  lines.push('')

  // Next steps: what the next agent should actually do first.
  lines.push(`## ${t.handoffNext}`)
  for (const text of suggestionsFor(t, task, status, dep, progress.missing, postMergeAhead)) {
    lines.push(`- ${text}`)
  }
  lines.push('')

  // Cautions: history traps that a fresh agent cannot see in the code.
  const cautions: string[] = []
  const notes = mdInline(task.notes)
  if (notes) cautions.push(fill(t.handoffCautionNotes, { text: notes }))
  if (status === 'merged' && postMergeAhead > 0) {
    cautions.push(fill(t.handoffCautionPostMerge, { n: postMergeAhead }))
  }
  if (reviewBehind > 0) {
    const pinned = task.reviewSha || head
    cautions.push(fill(t.handoffCautionStaleReview, { sha: shortSha(pinned) }))
  }
  if (dirty > 0) cautions.push(fill(t.handoffCautionUncommitted, { n: dirty }))
  if (stashes > 0) cautions.push(fill(t.handoffCautionStash, { n: stashes }))
  if (dep && dep.missing.length) {
    cautions.push(fill(t.handoffCautionDepsMissing, { ids: listText(dep.missing) }))
  } else if (dep && dep.open.length) {
    cautions.push(fill(t.handoffCautionDepsOpen, {
      titles: listText(dep.open.map((item) => item.title || item.id)),
    }))
  }
  lines.push(`## ${t.handoffCaution}`)
  if (cautions.length) {
    for (const text of cautions) lines.push(`- ${text}`)
  } else {
    lines.push(String(t.handoffCautionNone))
  }

  return lines.join('\n') + '\n'
}
