/**
 * Acceptance report: turns the in-memory task snapshot and the already loaded
 * diff into a portable Markdown document. Pure functions only — no DOM, no
 * network — so the same text feeds the clipboard action, the `.md` download and
 * the unit tests.
 */

import type { TaskDiff, TaskSnapshot, WorktreeTask } from '../models'
import { pad2 } from './format'
import { fill, mdCodeCell, mdInline, reportTimestamp } from './markdown'
import { branchHeadSha, criteria, criteriaProgress } from './model'

export interface ReportInput {
  task: WorktreeTask
  snapshot: TaskSnapshot
  diff: TaskDiff | null
  projectName: string
  statusLabel: string
  t: Record<string, any>
  now?: number
}

/**
 * Machine `TaskDiff.reason` -> message. Written as a switch on purpose: the locale
 * checker reads literal `t.<key>` references, so every message stays discoverable.
 */
function diffReasonText(t: Record<string, any>, diff: TaskDiff): string {
  switch (diff.reason) {
    case 'worktree-missing': return String(t.reportDiffWorktreeMissing)
    case 'no-merge-base': return String(t.reportDiffNoMergeBase)
    case 'error': return String(t.reportDiffError)
    default: return String(t.reportNoDiff)
  }
}

/** `DiffFile.status` -> localized change label; unknown values stay verbatim. */
function fileStatusText(t: Record<string, any>, status: string): string {
  switch (status) {
    case 'added': return String(t.reportStatusAdded)
    case 'modified': return String(t.reportStatusModified)
    case 'deleted': return String(t.reportStatusDeleted)
    case 'renamed': return String(t.reportStatusRenamed)
    case 'untracked': return String(t.reportStatusUntracked)
    default: return status || '—'
  }
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
 * `acceptance-<id8>-<YYYYMMDD>-<HHmm>.md` in the browser's local time. `now` is
 * injectable so tests do not depend on the clock.
 */
export function reportFilename(task: WorktreeTask, now: number = Date.now()): string {
  const date = new Date(now)
  const stamp = String(date.getFullYear())
    + pad2(date.getMonth() + 1)
    + pad2(date.getDate())
    + '-'
    + pad2(date.getHours())
    + pad2(date.getMinutes())
  return `acceptance-${id8(task)}-${stamp}.md`
}

/** Collapse every run of whitespace (including newlines) into one space. */
function metaLine(label: any, value: string): string {
  return `- ${label}: ${value}`
}

/**
 * Build the report body. Sections keep a fixed order and never disappear: when a
 * source is unavailable the section states why, so the document stays readable
 * (and comparable) across every task state.
 */
export function buildAcceptanceReport(input: ReportInput): string {
  const { task, snapshot, diff, projectName, statusLabel, t } = input
  const now = input.now == null ? Date.now() : input.now
  const generatedAt = reportTimestamp(now)
  const worktree = (snapshot && snapshot.worktree) || ({} as TaskSnapshot['worktree'])
  const lines: string[] = []

  lines.push(`# ${fill(t.reportTitle, { title: mdInline(task.title) })}`, '')

  lines.push(metaLine(t.reportProject, projectName ? mdInline(projectName) : '—'))
  lines.push(metaLine(t.reportTaskBranch, mdCodeCell(task.branch || '—')))
  lines.push(metaLine(t.reportBaseBranch, mdCodeCell(task.baseBranch || '—')))
  lines.push(metaLine(t.reportStatus, mdInline(statusLabel || '—')))
  const tags = Array.isArray(task.tags) && task.tags.length ? task.tags.join(', ') : '—'
  lines.push(metaLine(t.taskTags, mdInline(tags)))
  lines.push(metaLine(t.taskPriority, mdInline(
    task.priority === 'high' ? t.priorityHigh : task.priority === 'low' ? t.priorityLow : t.priorityNormal,
  )))
  const head = branchHeadSha(task, snapshot)
  lines.push(metaLine(t.reportHead, mdCodeCell(head || '—')))
  if (task.mergedCommit) lines.push(metaLine(t.reportMergedCommit, mdCodeCell(task.mergedCommit)))
  if (task.sessionId) lines.push(metaLine(t.reportSession, mdCodeCell(task.sessionId)))
  lines.push(metaLine(t.reportGeneratedAt, generatedAt))
  lines.push('')

  lines.push(`## ${t.taskDescription}`)
  lines.push(String(task.description || '—').trim() || '—')
  lines.push('')

  // Merged/cleaned tasks read as fully verified, matching the overview so the
  // report and the interface never contradict each other.
  const items = criteria(task, snapshot.status)
  const progress = criteriaProgress(items)
  lines.push(`## ${t.acceptanceCriteria}`)
  if (items.length) {
    for (const item of items) lines.push(`- [${item.checked ? 'x' : ' '}] ${mdInline(item.text)}`)
    lines.push('')
    lines.push(fill(t.reportProgress, { n: progress.checked, total: progress.total }))
  } else {
    lines.push(String(t.boardNoCriteria))
  }
  lines.push('')

  lines.push(`## ${t.reportNotes}`)
  lines.push(task.notes ? mdInline(task.notes) : String(t.taskNoNotes))
  lines.push('')

  const commits: Array<{ hash: string; subject: string }> = (worktree.commits || [])
  lines.push(`## ${t.reportCommits}`)
  if (commits.length) {
    for (const commit of commits) {
      const hash = String((commit && commit.hash) || '').slice(0, 7)
      const subject = mdInline((commit && commit.subject) || '')
      lines.push(`- ${mdCodeCell(hash)}${subject ? ' ' + subject : ''}`)
    }
  } else {
    lines.push(String(t.reportNoCommits))
  }
  lines.push('')

  lines.push(`## ${t.reportFiles}`)
  const reason = diff && diff.reason ? diff.reason : ''
  const files = (diff && Array.isArray(diff.files) ? diff.files : [])
  if (!diff) {
    lines.push(String(t.reportNoDiff))
  } else if (reason) {
    lines.push(diffReasonText(t, diff))
    // The raw git error is the only part of the message a reviewer can act on.
    if (reason === 'error' && diff.error) lines.push('', String(diff.error).trim())
  } else if (!files.length) {
    lines.push(String(t.reportNoFiles))
  } else {
    // Paths, change kind and line counts only: the report must stay small and
    // must never carry diff bodies out of the workbench.
    lines.push(`| ${t.reportFile} | ${t.reportChange} | + | - |`)
    lines.push('| --- | --- | --- | --- |')
    for (const file of files) {
      const status = fileStatusText(t, file.status)
      lines.push(`| ${mdCodeCell(file.path)} | ${mdInline(status)} | ${Number(file.additions) || 0} | ${Number(file.deletions) || 0} |`)
    }
    lines.push('')
    lines.push(fill(t.reportTotals, {
      files: files.length,
      add: Number(diff.totalAdditions) || 0,
      del: Number(diff.totalDeletions) || 0,
    }))
    if (diff.truncated) lines.push('', String(t.reportTruncated))
  }
  lines.push('')

  const stashes = Array.isArray(task.pendingStashes) ? task.pendingStashes.length : 0
  lines.push(`## ${t.reportWorkspace}`)
  lines.push(`- ${t.reportUncommitted}: ${Number(worktree.dirtyCount) || 0}`)
  lines.push(`- ${t.reportStashes}: ${stashes}`)

  return lines.join('\n') + '\n'
}
