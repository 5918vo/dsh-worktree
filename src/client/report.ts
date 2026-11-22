/**
 * Acceptance report rendering.
 *
 * Pure string building only: the report is derived from the task record, the
 * snapshot and (optionally) the diff, never from Git directly. Keeping it pure
 * makes the exported Markdown testable and lets the UI decide when to copy or
 * download it.
 */
import type { TaskDiff, TaskSnapshot, WorktreeTask } from '../models'
import { boardStatus, boardStatusLabel, criteria, criteriaProgress } from './model'

export interface ReportInput {
  task: WorktreeTask
  snapshot: TaskSnapshot
  diff?: TaskDiff | null
  t: Record<string, any>
  generatedAt?: number
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** ISO-ish local-independent stamp; consumers paste this into tickets/PRs. */
function stamp(ts: number | null | undefined): string {
  if (!ts) return '—'
  return new Date(ts).toISOString()
}

function shortSha(value: string | null | undefined): string {
  const sha = String(value || '')
  return sha ? sha.slice(0, 8) : ''
}

/** Escape the Markdown table separator so a path cannot split its cell. */
function cell(value: string): string {
  return String(value == null ? '' : value).replace(/\|/g, '\\|')
}

function statusLabel(task: WorktreeTask, snapshot: TaskSnapshot, t: Record<string, any>): string {
  return boardStatusLabel(t, boardStatus(snapshot.status, false))
}

export function buildAcceptanceReport(input: ReportInput): string {
  const { task, snapshot, diff, t } = input
  const generatedAt = input.generatedAt || Date.now()
  const items = criteria(task, snapshot.status)
  const progress = criteriaProgress(items)
  const lines: string[] = []

  lines.push(`# ${t.reportTitle}：${task.title || task.id}`)
  lines.push('')
  lines.push(`- ${t.reportTaskId}：\`${task.id}\``)
  lines.push(`- ${t.reportStatus}：${statusLabel(task, snapshot, t)}`)
  lines.push(`- ${t.reportBranch}：\`${task.branch}\` → ${task.baseBranch}`)
  lines.push(`- ${t.reportWorktree}：\`${task.worktreePath}\``)
  lines.push(`- ${t.reportUpdated}：${stamp(task.updatedAt || generatedAt)}`)
  if (task.mergedAt) {
    const parts = [stamp(task.mergedAt)]
    const commit = shortSha(task.mergedCommit)
    const tip = shortSha(task.mergedBranchTip)
    if (commit) parts.push(commit)
    if (tip && tip !== commit) parts.push(tip)
    lines.push(`- ${t.reportMerged}：${parts.join(' · ')}`)
  }
  lines.push(`- ${t.reportCriteria}：${String(t.reportCriteriaProgress)
    .replace('{checked}', String(progress.checked))
    .replace('{total}', String(progress.total))}`)

  lines.push('')
  lines.push(`## ${t.reportCriteria}`)
  if (!items.length) {
    lines.push('')
    lines.push(`- ${t.reportNoCriteria}`)
  } else {
    lines.push('')
    for (const item of items) lines.push(`- [${item.checked ? 'x' : ' '}] ${item.text}`)
  }

  lines.push('')
  lines.push(`## ${t.reportCommits}`)
  const commits = (snapshot.worktree.commits || []).slice(0, 20)
  lines.push('')
  if (!commits.length) lines.push(`- ${t.reportNoCommits}`)
  else for (const commit of commits) lines.push(`- \`${shortSha(commit.hash)}\` ${commit.subject}`)

  lines.push('')
  lines.push(`## ${t.reportFiles}`)
  lines.push('')
  if (!diff) {
    lines.push(`- ${String(t.reportDiffUnavailable).replace('{reason}', '—')}`)
  } else if (diff.reason) {
    const reason = diff.error || diff.reason
    lines.push(`- ${String(t.reportDiffUnavailable).replace('{reason}', String(reason))}`)
  } else if (!diff.files.length) {
    lines.push(`- ${t.reportNoFiles}`)
  } else {
    lines.push(`| ${t.reportFile} | ${t.reportFileStatus} | ${t.reportAdded} | ${t.reportDeleted} |`)
    lines.push('| --- | --- | --- | --- |')
    for (const file of diff.files) {
      lines.push(`| \`${cell(file.path)}\` | ${file.status} | ${file.additions} | ${file.deletions} |`)
    }
    lines.push('')
    lines.push(`- ${t.reportTotals}：+${diff.totalAdditions} -${diff.totalDeletions}`)
    if (diff.truncated) lines.push(`- ${t.reportTruncated}`)
  }

  lines.push('')
  lines.push(`## ${t.reportNotes}`)
  lines.push('')
  lines.push(`- ${t.reportUncommitted}：${Number(snapshot.worktree.dirtyCount) || 0}`)
  lines.push(`- ${t.reportPendingStashes}：${(task.pendingStashes || []).length}`)

  lines.push('')
  lines.push(`> ${t.reportFooter}`)
  lines.push('')
  return lines.join('\n')
}

/** `dshw-report-<id8>-<YYYYMMDD>.md`, date in local time like the rest of the UI. */
export function reportFileName(task: WorktreeTask, now?: number): string {
  const d = new Date(now || Date.now())
  const date = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
  const id8 = String(task.id || 'task').slice(0, 8)
  return `dshw-report-${id8}-${date}.md`
}
