/**
 * Handover brief: a portable Markdown summary for whoever continues a task.
 *
 * The acceptance report answers "is this finished"; this document answers
 * "where do I pick up". It carries the current state, the remaining acceptance
 * items, the dependency neighbourhood and a heuristic next step — never the
 * diff body or the full file list. Pure functions only: no DOM, no network, no
 * storage, so the clipboard text, the `.md` download and the tests share one
 * source.
 */

import type { TaskSnapshot, TaskView, WorktreeTask } from '../models'
import { pad2 } from './format'
import { fill, mdBlock, mdCodeCell, mdInline, reportTimestamp } from './markdown'
import { boardStatus, boardStatusLabel, branchHeadSha, criteria, criteriaProgress } from './model'
import { dueInputValue, parseEstimate } from '../task-meta'
import { workTimingText } from './work-format'
import { isDependencyDone } from '../task-deps'

export interface HandoverDependency {
  id: string
  title: string
  done: boolean
  missing: boolean
}

export interface HandoverInput {
  task: WorktreeTask
  snapshot: TaskSnapshot
  /** All task views in the same project; used to derive dependents. */
  views: TaskView[]
  projectName: string
  /** Localized status label, matching the Stage chip. */
  statusLabel: string
  /** Localized label for a dependent's view; omitted falls back to the status mapping. */
  statusLabelOf?: (view: TaskView) => string
  t: Record<string, any>
  now?: number
}

/**
 * `id8` for the file name: ASCII letters and digits only, so the name is valid
 * on Windows and macOS and never depends on the raw UUID formatting.
 */
function id8(task: WorktreeTask): string {
  const clean = String((task && task.id) || '').replace(/[^0-9a-zA-Z]/g, '').slice(0, 8).toLowerCase()
  return clean || 'task'
}

/**
 * `handover-<id8>-<YYYYMMDD>-<HHmm>.md` in the browser's local time. `now` is
 * injectable so tests do not depend on the clock.
 */
export function handoverFilename(task: WorktreeTask, now: number = Date.now()): string {
  const date = new Date(now)
  const stamp = String(date.getFullYear())
    + pad2(date.getMonth() + 1)
    + pad2(date.getDate())
    + '-'
    + pad2(date.getHours())
    + pad2(date.getMinutes())
  return `handover-${id8(task)}-${stamp}.md`
}

/** Localized label of one view, bypassing the running-session refinement. */
function viewStatusLabel(t: Record<string, any>, view: TaskView): string {
  const snapshot = (view && view.snapshot) || ({} as TaskSnapshot)
  return String(boardStatusLabel(t, boardStatus(snapshot.status, false)))
}

/**
 * Prerequisites in `dependsOn` order. A missing id keeps the raw id as title
 * and is reported as `missing` instead of being silently dropped.
 */
function prerequisites(task: WorktreeTask, views: TaskView[]): HandoverDependency[] {
  const ids: string[] = Array.isArray(task.dependsOn) ? task.dependsOn : []
  const lookup = new Map<string, TaskView>()
  for (const view of views || []) {
    if (view && view.task) lookup.set(view.task.id, view)
  }
  return ids.map((id) => {
    const view = lookup.get(id)
    if (!view) return { id, title: String(id), done: false, missing: true }
    return {
      id,
      title: String(view.task.title || id),
      done: isDependencyDone(view.task),
      missing: false,
    }
  })
}

/**
 * Tasks that name this task as a prerequisite. Read-only and one level deep.
 * Sorted by title (then id) so the same input always yields the same order.
 */
function dependents(task: WorktreeTask, views: TaskView[]): TaskView[] {
  const out = (views || []).filter((view) => view && view.task
    && view.task.id !== task.id
    && Array.isArray(view.task.dependsOn)
    && view.task.dependsOn.indexOf(task.id) >= 0)
  return out.slice().sort((a, b) => {
    const left = String(a.task.title || a.task.id)
    const right = String(b.task.title || b.task.id)
    if (left < right) return -1
    if (left > right) return 1
    return a.task.id < b.task.id ? -1 : a.task.id > b.task.id ? 1 : 0
  })
}

/**
 * Next-step suggestion for one status. A `switch` on purpose: the locale
 * checker reads literal `t.<key>` references, so every message stays visible.
 */
function nextStepText(t: Record<string, any>, status: string, archived: boolean): string {
  if (archived) return String(t.handoverReportNextArchived)
  switch (status) {
    case 'ready': return String(t.handoverReportNextReady)
    case 'developing': return String(t.handoverReportNextDeveloping)
    case 'review':
    case 'reviewing': return String(t.handoverReportNextReview)
    case 'merged': return String(t.handoverReportNextMerged)
    case 'cleaned': return String(t.handoverReportNextCleaned)
    case 'broken': return String(t.handoverReportNextBroken)
    default: return String(t.handoverReportNextReady)
  }
}

function metaLine(label: any, value: string): string {
  return `- ${label}: ${value}`
}

/**
 * Build the handover body. Sections keep a fixed order and never disappear:
 * when a source is unavailable the section states why, so the document stays
 * readable across every task state.
 */
export function buildHandoverBrief(input: HandoverInput): string {
  const { task, projectName, statusLabel, t } = input
  const now = input.now == null ? Date.now() : input.now
  const snapshot = (input.snapshot || ({} as TaskSnapshot))
  const worktree = (snapshot.worktree || ({} as TaskSnapshot['worktree']))
  const views: TaskView[] = Array.isArray(input.views) ? input.views : []
  const lines: string[] = []

  lines.push(`# ${fill(t.handoverReportTitle, { title: mdInline(task.title) })}`, '')

  // Metadata: where the task stands right now, in the same words as the board.
  lines.push(`## ${t.taskInfo}`)
  lines.push(metaLine(t.reportProject, projectName ? mdInline(projectName) : '—'))
  lines.push(metaLine(t.reportStatus, mdInline(statusLabel || '—')))
  lines.push(metaLine(t.reportTaskBranch, mdCodeCell(task.branch || '—')))
  lines.push(metaLine(t.reportBaseBranch, mdCodeCell(task.baseBranch || '—')))
  lines.push(metaLine(t.handoverWorktree, mdCodeCell(task.worktreePath || '—')))
  const head = branchHeadSha(task, snapshot)
  lines.push(metaLine(t.reportHead, mdCodeCell(head || '—')))
  lines.push(metaLine(t.handoverAhead, String(Number(worktree.ahead) || 0)))
  lines.push(metaLine(t.reportUncommitted, String(Number(worktree.dirtyCount) || 0)))
  lines.push(metaLine(t.reportGeneratedAt, reportTimestamp(now)))
  lines.push('')

  // Planning fields: the numbers a handover note traditionally carries.
  lines.push(`## ${t.handoverSectionPlan}`)
  const priority = task.priority === 'high' ? t.priorityHigh : task.priority === 'low' ? t.priorityLow : t.priorityNormal
  lines.push(metaLine(t.taskPriority, mdInline(priority)))
  const tags = Array.isArray(task.tags) && task.tags.length ? task.tags.join(', ') : '—'
  lines.push(metaLine(t.taskTags, mdInline(tags)))
  lines.push(metaLine(t.reportDue, dueInputValue(task.dueAt) || String(t.reportDueNone)))
  const estimate = parseEstimate(task.estimate)
  lines.push(metaLine(t.taskEstimate, mdInline(
    estimate.ok && estimate.value != null ? fill(t.taskEstimatePoints, { n: estimate.value }) : t.taskEstimateEmpty,
  )))
  lines.push(metaLine(t.taskWork, workTimingText(t, task, now)))
  lines.push('')

  lines.push(`## ${t.reportNotes}`)
  lines.push(mdBlock(task.notes) || String(t.taskNoNotes))
  lines.push('')

  const deps = prerequisites(task, views)
  lines.push(`## ${t.handoverSectionDeps}`)
  if (deps.length) {
    for (const dep of deps) {
      const mark = dep.done ? 'x' : ' '
      const suffix = dep.missing ? ' · ' + String(t.handoverDepMissing) : ''
      lines.push(`- [${mark}] ${mdInline(dep.title)}${suffix}`)
    }
  } else {
    lines.push(String(t.handoverReportNoDeps))
  }
  lines.push('')

  const next = dependents(task, views)
  lines.push(`## ${t.handoverSectionDependents}`)
  if (next.length) {
    for (const view of next) {
      const label = input.statusLabelOf ? input.statusLabelOf(view) : viewStatusLabel(t, view)
      lines.push(`- ${mdInline(view.task.title || view.task.id)} · ${mdInline(label)}`)
    }
  } else {
    lines.push(String(t.handoverReportNoDependents))
  }
  lines.push('')

  // Only the unchecked items travel: the handover reader needs what is left,
  // not a repeated record of what is already verified.
  const items = criteria(task, snapshot.status)
  const progress = criteriaProgress(items)
  lines.push(`## ${t.acceptanceCriteria}`)
  if (!items.length) {
    lines.push(String(t.handoverReportNoCriteria))
  } else {
    const open = items.filter((item) => !item.checked)
    if (open.length) {
      for (const item of open) lines.push(`- [ ] ${mdInline(item.text)}`)
    } else {
      lines.push(String(t.handoverReportAllChecked))
    }
    lines.push('')
    lines.push(fill(t.reportProgress, { n: progress.checked, total: progress.total }))
  }
  lines.push('')

  const commits: Array<{ hash: string; subject: string }> = Array.isArray(worktree.commits) ? worktree.commits : []
  lines.push(`## ${t.reportCommits}`)
  if (commits.length) {
    for (const commit of commits.slice(0, 5)) {
      const hash = String((commit && commit.hash) || '').slice(0, 7)
      const subject = mdInline((commit && commit.subject) || '')
      lines.push(`- ${mdCodeCell(hash)}${subject ? ' ' + subject : ''}`)
    }
  } else {
    lines.push(String(t.handoverReportNoCommits))
  }
  lines.push('')

  lines.push(`## ${t.handoverSectionNext}`)
  const blocked = deps.filter((dep) => !dep.done)
  if (blocked.length) {
    lines.push(fill(t.handoverReportBlockedBy, { deps: blocked.map((dep) => mdInline(dep.title)).join(', ') }))
    lines.push('')
  }
  lines.push(nextStepText(t, snapshot.status, !!task.archivedAt))
  lines.push('')

  lines.push(String(t.handoverReportNote))

  return lines.join('\n') + '\n'
}
